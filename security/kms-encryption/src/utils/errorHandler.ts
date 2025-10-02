import { APIGatewayProxyResult } from 'aws-lambda';
import { logger } from './logger';

/**
 * Custom error classes for KMS Encryption Service
 */

export class EncryptionError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string = 'ENCRYPTION_ERROR', statusCode: number = 500) {
    super(message);
    this.name = 'EncryptionError';
    this.code = code;
    this.statusCode = statusCode;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EncryptionError);
    }
  }
}

export class ValidationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly field?: string;

  constructor(message: string, field?: string, code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.statusCode = 400;
    this.field = field;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

export class AuthenticationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string = 'AUTHENTICATION_ERROR') {
    super(message);
    this.name = 'AuthenticationError';
    this.code = code;
    this.statusCode = 401;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthenticationError);
    }
  }
}

export class AuthorizationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string = 'AUTHORIZATION_ERROR') {
    super(message);
    this.name = 'AuthorizationError';
    this.code = code;
    this.statusCode = 403;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthorizationError);
    }
  }
}

export class RateLimitError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number, code: string = 'RATE_LIMIT_ERROR') {
    super(message);
    this.name = 'RateLimitError';
    this.code = code;
    this.statusCode = 429;
    this.retryAfter = retryAfter;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RateLimitError);
    }
  }
}

export class ServiceUnavailableError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string = 'SERVICE_UNAVAILABLE') {
    super(message);
    this.name = 'ServiceUnavailableError';
    this.code = code;
    this.statusCode = 503;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ServiceUnavailableError);
    }
  }
}

/**
 * Error response interface
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    field?: string;
    details?: any;
    timestamp: string;
    correlationId: string;
  };
}

/**
 * Main error handler for Lambda functions
 */
export function handleError(error: any, correlationId: string): APIGatewayProxyResult {
  // Log the error with appropriate level
  const errorLevel = getErrorLevel(error);
  const errorContext = {
    correlationId,
    errorType: error.constructor.name,
    errorCode: error.code || 'UNKNOWN_ERROR',
    stack: error.stack
  };

  if (errorLevel === 'ERROR') {
    logger.error(error.message, errorContext);
  } else if (errorLevel === 'WARN') {
    logger.warn(error.message, errorContext);
  } else {
    logger.info(error.message, errorContext);
  }

  // Determine status code and error response
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let errorMessage = 'An internal server error occurred';
  let field: string | undefined;
  let retryAfter: number | undefined;

  if (error instanceof ValidationError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    errorMessage = error.message;
    field = error.field;
  } else if (error instanceof AuthenticationError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    errorMessage = error.message;
  } else if (error instanceof AuthorizationError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    errorMessage = error.message;
  } else if (error instanceof RateLimitError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    errorMessage = error.message;
    retryAfter = error.retryAfter;
  } else if (error instanceof EncryptionError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    errorMessage = error.message;
  } else if (error instanceof ServiceUnavailableError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    errorMessage = error.message;
  } else if (error.name === 'ZodError') {
    // Handle Zod validation errors
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    errorMessage = formatZodError(error);
  } else if (isAWSError(error)) {
    // Handle AWS SDK errors
    const awsError = handleAWSError(error);
    statusCode = awsError.statusCode;
    errorCode = awsError.code;
    errorMessage = awsError.message;
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message: errorMessage,
      field,
      timestamp: new Date().toISOString(),
      correlationId
    }
  };

  // Add retry-after header if applicable
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };

  if (retryAfter) {
    headers['Retry-After'] = retryAfter.toString();
  }

  return {
    statusCode,
    headers,
    body: JSON.stringify(errorResponse)
  };
}

/**
 * Determine appropriate log level for error
 */
function getErrorLevel(error: any): 'ERROR' | 'WARN' | 'INFO' {
  if (error instanceof ValidationError || error instanceof AuthenticationError) {
    return 'WARN';
  }
  
  if (error instanceof RateLimitError) {
    return 'INFO';
  }
  
  if (error instanceof EncryptionError || error instanceof ServiceUnavailableError) {
    return 'ERROR';
  }
  
  return 'ERROR';
}

/**
 * Format Zod validation errors
 */
function formatZodError(error: any): string {
  if (error.errors && Array.isArray(error.errors)) {
    const messages = error.errors.map((err: any) => {
      const path = err.path.join('.');
      return `${path}: ${err.message}`;
    });
    return `Validation failed: ${messages.join(', ')}`;
  }
  
  return 'Validation failed';
}

/**
 * Check if error is from AWS SDK
 */
function isAWSError(error: any): boolean {
  return error && (
    error.$metadata ||
    error.Code ||
    error.code ||
    error.name?.includes('Exception') ||
    error.name?.includes('Error')
  );
}

/**
 * Handle AWS SDK errors
 */
function handleAWSError(error: any): { statusCode: number; code: string; message: string } {
  const errorCode = error.Code || error.code || error.name || 'AWS_ERROR';
  let statusCode = 500;
  let message = error.message || 'AWS service error occurred';

  // Map common AWS errors to appropriate HTTP status codes
  switch (errorCode) {
    case 'AccessDenied':
    case 'AccessDeniedException':
    case 'UnauthorizedOperation':
      statusCode = 403;
      message = 'Access denied to AWS resource';
      break;
    
    case 'InvalidParameterValue':
    case 'InvalidParameter':
    case 'ValidationException':
    case 'MalformedPolicyDocument':
      statusCode = 400;
      message = 'Invalid request parameters';
      break;
    
    case 'ResourceNotFound':
    case 'ResourceNotFoundException':
    case 'NoSuchKey':
    case 'KeyUnavailableException':
      statusCode = 404;
      message = 'Requested resource not found';
      break;
    
    case 'ThrottlingException':
    case 'Throttling':
    case 'RequestLimitExceeded':
      statusCode = 429;
      message = 'Request rate limit exceeded';
      break;
    
    case 'ServiceUnavailable':
    case 'ServiceUnavailableException':
    case 'InternalFailure':
      statusCode = 503;
      message = 'AWS service temporarily unavailable';
      break;
    
    case 'KMSInvalidStateException':
    case 'DisabledException':
      statusCode = 400;
      message = 'KMS key is in invalid state for this operation';
      break;
    
    case 'NotFoundException':
      statusCode = 404;
      message = 'KMS key not found';
      break;
    
    default:
      statusCode = 500;
      message = `AWS service error: ${errorCode}`;
  }

  return {
    statusCode,
    code: errorCode,
    message
  };
}

/**
 * Utility function to create validation errors
 */
export function createValidationError(message: string, field?: string): ValidationError {
  return new ValidationError(message, field);
}

/**
 * Utility function to create encryption errors
 */
export function createEncryptionError(message: string, code?: string): EncryptionError {
  return new EncryptionError(message, code);
}

/**
 * Utility function to create authentication errors
 */
export function createAuthenticationError(message: string): AuthenticationError {
  return new AuthenticationError(message);
}

/**
 * Utility function to create authorization errors
 */
export function createAuthorizationError(message: string): AuthorizationError {
  return new AuthorizationError(message);
}

/**
 * Utility function to create rate limit errors
 */
export function createRateLimitError(message: string, retryAfter?: number): RateLimitError {
  return new RateLimitError(message, retryAfter);
}

/**
 * Utility function to create service unavailable errors
 */
export function createServiceUnavailableError(message: string): ServiceUnavailableError {
  return new ServiceUnavailableError(message);
}

/**
 * Async error wrapper for Lambda handlers
 */
export function asyncErrorHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      // Re-throw known errors
      if (error instanceof ValidationError ||
          error instanceof AuthenticationError ||
          error instanceof AuthorizationError ||
          error instanceof RateLimitError ||
          error instanceof EncryptionError ||
          error instanceof ServiceUnavailableError) {
        throw error;
      }
      
      // Wrap unknown errors
      throw new EncryptionError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        'INTERNAL_ERROR'
      );
    }
  };
}

/**
 * Circuit breaker for external service calls
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new ServiceUnavailableError('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      
      if (this.state === 'HALF_OPEN') {
        this.reset();
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
    }
  }

  private reset(): void {
    this.failures = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
  }

  getState(): string {
    return this.state;
  }
}
