import { APIGatewayProxyResult } from 'aws-lambda';
import { logger } from './logger';

/**
 * Custom error classes for apply-fix service
 */
export class RemediationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly originalError?: Error;

  constructor(message: string, originalError?: Error, code = 'REMEDIATION_ERROR', statusCode = 500) {
    super(message);
    this.name = 'RemediationError';
    this.code = code;
    this.statusCode = statusCode;
    this.originalError = originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RemediationError);
    }
  }
}

export class SafetyViolationError extends RemediationError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError, 'SAFETY_VIOLATION', 403);
    this.name = 'SafetyViolationError';
  }
}

export class ApprovalError extends RemediationError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError, 'APPROVAL_ERROR', 500);
    this.name = 'ApprovalError';
  }
}

export class RollbackError extends RemediationError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError, 'ROLLBACK_ERROR', 500);
    this.name = 'RollbackError';
  }
}

export class ValidationError extends RemediationError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class AuthorizationError extends RemediationError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class ResourceNotFoundError extends RemediationError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError, 'RESOURCE_NOT_FOUND', 404);
    this.name = 'ResourceNotFoundError';
  }
}

export class ConflictError extends RemediationError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError, 'CONFLICT_ERROR', 409);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends RemediationError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError, 'RATE_LIMIT_ERROR', 429);
    this.name = 'RateLimitError';
  }
}

/**
 * Create standardized error response
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
      message,
      code: getErrorCodeFromStatus(statusCode),
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
      'Access-Control-Allow-Methods': 'POST,PUT,GET,OPTIONS'
    },
    body: JSON.stringify(errorResponse)
  };
}

/**
 * Handle errors and return appropriate API Gateway response
 */
export function handleError(error: any, correlationId: string): APIGatewayProxyResult {
  // Handle known error types
  if (error instanceof RemediationError) {
    logger.error('Remediation error', {
      correlationId,
      errorCode: error.code,
      message: error.message,
      statusCode: error.statusCode,
      originalError: error.originalError?.message
    });

    return createErrorResponse(
      error.statusCode,
      error.message,
      correlationId,
      { code: error.code }
    );
  }

  // Handle AWS SDK errors
  if (error.name && error.name.includes('AWS')) {
    logger.error('AWS service error', {
      correlationId,
      errorName: error.name,
      errorCode: error.code,
      message: error.message,
      statusCode: error.$metadata?.httpStatusCode
    });

    const statusCode = error.$metadata?.httpStatusCode || 500;
    let message = 'AWS service error occurred';

    // Map common AWS errors to user-friendly messages
    switch (error.name) {
      case 'AccessDenied':
      case 'UnauthorizedOperation':
        message = 'Insufficient permissions to perform this operation';
        break;
      case 'ResourceNotFoundException':
      case 'NoSuchBucket':
      case 'NoSuchKey':
        message = 'Resource not found';
        break;
      case 'InvalidParameterValue':
      case 'ValidationException':
        message = 'Invalid parameters provided';
        break;
      case 'ThrottlingException':
      case 'RequestLimitExceeded':
        message = 'Request rate limit exceeded';
        break;
      case 'ServiceUnavailable':
        message = 'AWS service temporarily unavailable';
        break;
      default:
        message = 'AWS service error occurred';
    }

    return createErrorResponse(
      statusCode,
      message,
      correlationId,
      { 
        code: error.code || 'AWS_ERROR',
        service: error.name
      }
    );
  }

  // Handle validation errors
  if (error.name === 'ValidationError' || error.name === 'ZodError') {
    logger.error('Validation error', {
      correlationId,
      message: error.message,
      issues: error.issues || error.errors
    });

    return createErrorResponse(
      400,
      'Request validation failed',
      correlationId,
      { 
        code: 'VALIDATION_ERROR',
        issues: error.issues || error.errors
      }
    );
  }

  // Handle timeout errors
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    logger.error('Timeout error', {
      correlationId,
      message: error.message,
      code: error.code
    });

    return createErrorResponse(
      504,
      'Operation timeout',
      correlationId,
      { code: 'TIMEOUT_ERROR' }
    );
  }

  // Handle network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    logger.error('Network error', {
      correlationId,
      message: error.message,
      code: error.code
    });

    return createErrorResponse(
      502,
      'Network connectivity error',
      correlationId,
      { code: 'NETWORK_ERROR' }
    );
  }

  // Handle generic errors
  logger.error('Unhandled error', {
    correlationId,
    message: error.message || 'Unknown error',
    name: error.name,
    code: error.code,
    stack: error.stack
  });

  return createErrorResponse(
    500,
    'Internal server error',
    correlationId,
    { code: 'INTERNAL_ERROR' }
  );
}

/**
 * Get error code from HTTP status code
 */
function getErrorCodeFromStatus(statusCode: number): string {
  const statusCodeMap: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    405: 'METHOD_NOT_ALLOWED',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
    504: 'GATEWAY_TIMEOUT'
  };

  return statusCodeMap[statusCode] || 'UNKNOWN_ERROR';
}

/**
 * Retry wrapper for operations that might fail temporarily
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000,
  correlationId?: string
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry certain error types
      if (error instanceof SafetyViolationError ||
          error instanceof ValidationError ||
          error instanceof AuthorizationError ||
          error instanceof ResourceNotFoundError) {
        throw error;
      }

      logger.warn('Operation failed, retrying', {
        correlationId,
        attempt,
        maxRetries,
        error: lastError.message,
        nextRetryIn: attempt < maxRetries ? delayMs : 'no more retries'
      });

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // Exponential backoff
      }
    }
  }

  throw lastError!;
}

/**
 * Circuit breaker for external service calls
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly failureThreshold = 5,
    private readonly recoveryTimeout = 60000, // 1 minute
    private readonly correlationId?: string
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        logger.info('Circuit breaker transitioning to HALF_OPEN', {
          correlationId: this.correlationId,
          failures: this.failures
        });
      } else {
        throw new RemediationError('Circuit breaker is OPEN - service unavailable');
      }
    }

    try {
      const result = await operation();
      
      if (this.state === 'HALF_OPEN') {
        this.reset();
        logger.info('Circuit breaker reset to CLOSED', {
          correlationId: this.correlationId
        });
      }
      
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.warn('Circuit breaker opened due to failures', {
        correlationId: this.correlationId,
        failures: this.failures,
        threshold: this.failureThreshold
      });
    }
  }

  private reset(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  getState(): string {
    return this.state;
  }
}

/**
 * Error aggregator for batch operations
 */
export class ErrorAggregator {
  private errors: Array<{
    operation: string;
    error: Error;
    context?: any;
  }> = [];

  addError(operation: string, error: Error, context?: any): void {
    this.errors.push({ operation, error, context });
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getErrors(): typeof this.errors {
    return this.errors;
  }

  getSummary(): {
    totalErrors: number;
    errorTypes: Record<string, number>;
    criticalErrors: number;
  } {
    const errorTypes: Record<string, number> = {};
    let criticalErrors = 0;

    for (const { error } of this.errors) {
      const errorType = error.constructor.name;
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;

      if (error instanceof SafetyViolationError || 
          error instanceof AuthorizationError) {
        criticalErrors++;
      }
    }

    return {
      totalErrors: this.errors.length,
      errorTypes,
      criticalErrors
    };
  }

  createAggregateError(): RemediationError {
    if (this.errors.length === 0) {
      throw new Error('No errors to aggregate');
    }

    const summary = this.getSummary();
    const message = `Multiple operations failed: ${summary.totalErrors} errors (${summary.criticalErrors} critical)`;
    
    return new RemediationError(message, undefined, 'AGGREGATE_ERROR', 500);
  }
}
