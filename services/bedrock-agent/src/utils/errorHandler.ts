import { APIGatewayProxyResult } from 'aws-lambda';
import { logger } from './logger';

/**
 * Custom error classes for Bedrock Agent operations
 */

export class ComplianceAgentError extends Error {
  constructor(
    message: string,
    public code: string = 'AGENT_ERROR',
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ComplianceAgentError';
  }
}

export class AgentConfigurationError extends ComplianceAgentError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'AGENT_CONFIGURATION_ERROR', 400, details);
    this.name = 'AgentConfigurationError';
  }
}

export class ActionGroupError extends ComplianceAgentError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'ACTION_GROUP_ERROR', 500, details);
    this.name = 'ActionGroupError';
  }
}

export class AgentInvocationError extends ComplianceAgentError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'AGENT_INVOCATION_ERROR', 500, details);
    this.name = 'AgentInvocationError';
  }
}

export class ValidationError extends ComplianceAgentError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ComplianceAgentError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ComplianceAgentError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'AUTHORIZATION_ERROR', 403, details);
    this.name = 'AuthorizationError';
  }
}

export class RateLimitError extends ComplianceAgentError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'RATE_LIMIT_ERROR', 429, details);
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends ComplianceAgentError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'SERVICE_UNAVAILABLE', 503, details);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Error response creator
 */
export function createErrorResponse(
  statusCode: number,
  message: string,
  correlationId: string,
  details?: Record<string, any>
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
      'Access-Control-Allow-Methods': 'POST,GET,PUT,OPTIONS'
    },
    body: JSON.stringify(errorResponse)
  };
}

/**
 * Generic error handler
 */
export function handleError(error: unknown, correlationId: string): APIGatewayProxyResult {
  if (error instanceof ComplianceAgentError) {
    logger.error('Compliance agent error', {
      correlationId,
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details
    });

    return createErrorResponse(
      error.statusCode,
      error.message,
      correlationId,
      error.details
    );
  }

  // Handle AWS SDK errors
  if (error && typeof error === 'object' && 'name' in error) {
    const awsError = error as any;
    
    switch (awsError.name) {
      case 'ValidationException':
        return createErrorResponse(400, awsError.message || 'Validation failed', correlationId);
      
      case 'ResourceNotFoundException':
        return createErrorResponse(404, awsError.message || 'Resource not found', correlationId);
      
      case 'AccessDeniedException':
        return createErrorResponse(403, awsError.message || 'Access denied', correlationId);
      
      case 'ThrottlingException':
      case 'TooManyRequestsException':
        return createErrorResponse(429, awsError.message || 'Rate limit exceeded', correlationId);
      
      case 'ServiceUnavailableException':
        return createErrorResponse(503, awsError.message || 'Service unavailable', correlationId);
      
      case 'InternalServerException':
        return createErrorResponse(500, awsError.message || 'Internal server error', correlationId);
    }
  }

  // Handle generic errors
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  
  logger.error('Unhandled error', {
    correlationId,
    error: errorMessage,
    stack: error instanceof Error ? error.stack : undefined
  });

  return createErrorResponse(500, 'Internal server error', correlationId);
}

/**
 * Get error code from HTTP status
 */
function getErrorCodeFromStatus(statusCode: number): string {
  switch (statusCode) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 422: return 'UNPROCESSABLE_ENTITY';
    case 429: return 'TOO_MANY_REQUESTS';
    case 500: return 'INTERNAL_SERVER_ERROR';
    case 502: return 'BAD_GATEWAY';
    case 503: return 'SERVICE_UNAVAILABLE';
    case 504: return 'GATEWAY_TIMEOUT';
    default: return 'UNKNOWN_ERROR';
  }
}

/**
 * Circuit breaker for external service calls
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000, // 1 minute
    private resetTimeout: number = 30000 // 30 seconds
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new ServiceUnavailableError('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }
}

/**
 * Retry mechanism with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );

      logger.warn('Operation failed, retrying', {
        attempt: attempt + 1,
        maxRetries,
        delay,
        error: lastError.message
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Timeout wrapper for operations
 */
export function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    operation,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new ServiceUnavailableError(timeoutMessage));
      }, timeoutMs);
    })
  ]);
}
