import { APIGatewayProxyResult } from 'aws-lambda';
import { logger } from './logger';

/**
 * Custom error classes for Tenant Management
 */
export class TenantManagementError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: string = 'TENANT_MANAGEMENT_ERROR',
    statusCode: number = 500,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'TenantManagementError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TenantManagementError);
    }
  }
}

export class TenantValidationError extends TenantManagementError {
  constructor(message: string) {
    super(message, 'TENANT_VALIDATION_ERROR', 400, false);
    this.name = 'TenantValidationError';
  }
}

export class TenantNotFoundError extends TenantManagementError {
  constructor(tenantId: string) {
    super(`Tenant not found: ${tenantId}`, 'TENANT_NOT_FOUND', 404, false);
    this.name = 'TenantNotFoundError';
  }
}

export class TenantConflictError extends TenantManagementError {
  constructor(message: string) {
    super(message, 'TENANT_CONFLICT', 409, false);
    this.name = 'TenantConflictError';
  }
}

export class TenantIsolationError extends TenantManagementError {
  constructor(message: string) {
    super(message, 'TENANT_ISOLATION_ERROR', 500, false);
    this.name = 'TenantIsolationError';
  }
}

export class TenantOnboardingError extends TenantManagementError {
  constructor(message: string, retryable: boolean = true) {
    super(message, 'TENANT_ONBOARDING_ERROR', 500, retryable);
    this.name = 'TenantOnboardingError';
  }
}

export class TenantOffboardingError extends TenantManagementError {
  constructor(message: string) {
    super(message, 'TENANT_OFFBOARDING_ERROR', 500, false);
    this.name = 'TenantOffboardingError';
  }
}

export class TenantResourceError extends TenantManagementError {
  constructor(message: string, retryable: boolean = true) {
    super(message, 'TENANT_RESOURCE_ERROR', 500, retryable);
    this.name = 'TenantResourceError';
  }
}

export class TenantQuotaExceededError extends TenantManagementError {
  constructor(quotaType: string, limit: number) {
    super(`Quota exceeded for ${quotaType}: limit is ${limit}`, 'TENANT_QUOTA_EXCEEDED', 429, false);
    this.name = 'TenantQuotaExceededError';
  }
}

export class TenantAuthenticationError extends TenantManagementError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'TENANT_AUTHENTICATION_ERROR', 401, false);
    this.name = 'TenantAuthenticationError';
  }
}

export class TenantAuthorizationError extends TenantManagementError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'TENANT_AUTHORIZATION_ERROR', 403, false);
    this.name = 'TenantAuthorizationError';
  }
}

/**
 * Circuit breaker for external service calls
 */
export class CircuitBreaker {
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeout: number = 60000, // 1 minute
    private readonly monitoringPeriod: number = 120000 // 2 minutes
  ) {}

  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        logger.info('Circuit breaker transitioning to HALF_OPEN state');
      } else {
        logger.warn('Circuit breaker is OPEN, executing fallback');
        if (fallback) {
          return await fallback();
        }
        throw new TenantManagementError('Circuit breaker is open', 'CIRCUIT_BREAKER_OPEN', 503, true);
      }
    }

    try {
      const result = await operation();
      
      if (this.state === 'HALF_OPEN') {
        this.reset();
        logger.info('Circuit breaker reset to CLOSED state');
      }
      
      return result;
    } catch (error) {
      this.recordFailure();
      
      if (fallback && this.state === 'OPEN') {
        logger.warn('Circuit breaker opened, executing fallback');
        return await fallback();
      }
      
      throw error;
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.error('Circuit breaker opened due to failure threshold', {
        failureCount: this.failureCount,
        failureThreshold: this.failureThreshold
      });
    }
  }

  private reset(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
  }

  getState(): string {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }
}

/**
 * Retry mechanism with exponential backoff
 */
export class RetryHandler {
  constructor(
    private readonly maxAttempts: number = 3,
    private readonly baseDelay: number = 1000,
    private readonly maxDelay: number = 30000,
    private readonly backoffMultiplier: number = 2
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    shouldRetry: (error: any) => boolean = (error) => error instanceof TenantManagementError && error.retryable
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === this.maxAttempts || !shouldRetry(error)) {
          throw error;
        }

        const delay = Math.min(
          this.baseDelay * Math.pow(this.backoffMultiplier, attempt - 1),
          this.maxDelay
        );

        logger.warn('Operation failed, retrying', {
          attempt,
          maxAttempts: this.maxAttempts,
          delay,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Error response creator for API Gateway
 */
export function createErrorResponse(
  statusCode: number,
  message: string,
  correlationId: string,
  details?: any
): APIGatewayProxyResult {
  const errorResponse = {
    success: false,
    error: {
      code: getErrorCodeFromStatus(statusCode),
      message,
      correlationId,
      timestamp: new Date().toISOString(),
      ...(details && { details })
    }
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,PATCH,OPTIONS'
    },
    body: JSON.stringify(errorResponse)
  };
}

/**
 * Main error handler for Lambda functions
 */
export function handleError(error: any, correlationId: string): APIGatewayProxyResult {
  logger.error('Unhandled error in Lambda function', {
    correlationId,
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    errorType: error.constructor.name
  });

  if (error instanceof TenantManagementError) {
    return createErrorResponse(error.statusCode, error.message, correlationId, {
      code: error.code,
      retryable: error.retryable
    });
  }

  // Handle AWS SDK errors
  if (error.name && error.name.includes('AWS')) {
    return handleAWSError(error, correlationId);
  }

  // Handle validation errors
  if (error.name === 'ValidationError' || error.message?.includes('validation')) {
    return createErrorResponse(400, 'Validation error', correlationId, {
      details: error.message
    });
  }

  // Handle timeout errors
  if (error.name === 'TimeoutError' || error.code === 'TIMEOUT') {
    return createErrorResponse(408, 'Request timeout', correlationId);
  }

  // Default to internal server error
  return createErrorResponse(500, 'Internal server error', correlationId);
}

/**
 * Handle AWS SDK specific errors
 */
function handleAWSError(error: any, correlationId: string): APIGatewayProxyResult {
  const errorCode = error.code || error.name;
  
  switch (errorCode) {
    case 'ResourceNotFoundException':
    case 'NoSuchEntity':
    case 'NoSuchBucket':
      return createErrorResponse(404, 'Resource not found', correlationId);
    
    case 'ConflictException':
    case 'ResourceAlreadyExistsException':
    case 'EntityAlreadyExists':
      return createErrorResponse(409, 'Resource conflict', correlationId);
    
    case 'ValidationException':
    case 'InvalidParameterException':
    case 'InvalidParameterValue':
      return createErrorResponse(400, 'Invalid parameters', correlationId, {
        details: error.message
      });
    
    case 'UnauthorizedOperation':
    case 'AccessDenied':
    case 'Forbidden':
      return createErrorResponse(403, 'Access denied', correlationId);
    
    case 'ThrottlingException':
    case 'TooManyRequestsException':
    case 'RequestLimitExceeded':
      return createErrorResponse(429, 'Rate limit exceeded', correlationId);
    
    case 'ServiceUnavailableException':
    case 'InternalServiceError':
    case 'ServiceFailure':
      return createErrorResponse(503, 'Service unavailable', correlationId);
    
    default:
      logger.warn('Unhandled AWS error', {
        correlationId,
        errorCode,
        errorMessage: error.message
      });
      return createErrorResponse(500, 'AWS service error', correlationId, {
        code: errorCode
      });
  }
}

/**
 * Get error code from HTTP status
 */
function getErrorCodeFromStatus(statusCode: number): string {
  const codes: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    405: 'METHOD_NOT_ALLOWED',
    408: 'REQUEST_TIMEOUT',
    409: 'CONFLICT',
    429: 'RATE_LIMIT_EXCEEDED',
    500: 'INTERNAL_SERVER_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
    504: 'GATEWAY_TIMEOUT'
  };

  return codes[statusCode] || 'UNKNOWN_ERROR';
}

/**
 * Global circuit breakers for external services
 */
export const circuitBreakers = {
  dynamodb: new CircuitBreaker(5, 60000, 120000),
  s3: new CircuitBreaker(5, 60000, 120000),
  kms: new CircuitBreaker(3, 30000, 60000),
  iam: new CircuitBreaker(3, 30000, 60000),
  cloudformation: new CircuitBreaker(3, 60000, 120000),
  secretsmanager: new CircuitBreaker(3, 30000, 60000)
};

/**
 * Global retry handler
 */
export const retryHandler = new RetryHandler(3, 1000, 30000, 2);
