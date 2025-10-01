/**
 * Error Handler Utility
 * 
 * Provides centralized error handling, custom error types,
 * and standardized error responses for the API Gateway.
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import { logger } from './logger';

/**
 * Custom error types
 */
export class AuthenticationError extends Error {
  public readonly code = 'AUTHENTICATION_ERROR';
  public readonly statusCode = 401;

  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  public readonly code = 'AUTHORIZATION_ERROR';
  public readonly statusCode = 403;

  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends Error {
  public readonly code = 'VALIDATION_ERROR';
  public readonly statusCode = 400;

  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  public readonly code = 'NOT_FOUND_ERROR';
  public readonly statusCode = 404;

  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  public readonly code = 'CONFLICT_ERROR';
  public readonly statusCode = 409;

  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends Error {
  public readonly code = 'RATE_LIMIT_ERROR';
  public readonly statusCode = 429;

  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class InternalServerError extends Error {
  public readonly code = 'INTERNAL_SERVER_ERROR';
  public readonly statusCode = 500;

  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'InternalServerError';
  }
}

export class ServiceUnavailableError extends Error {
  public readonly code = 'SERVICE_UNAVAILABLE_ERROR';
  public readonly statusCode = 503;

  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Error response interface
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Centralized error handler
 */
export function errorHandler(error: unknown): APIGatewayProxyResult {
  const timestamp = new Date().toISOString();
  const requestId = logger.getContext().requestId;

  // Log the error
  if (error instanceof Error) {
    logger.errorWithStack('Unhandled error occurred', error, {
      requestId,
      timestamp
    });
  } else {
    logger.error('Unknown error occurred', {
      error: String(error),
      requestId,
      timestamp
    });
  }

  // Handle custom error types
  if (error instanceof AuthenticationError) {
    return createErrorResponse(error, timestamp, requestId);
  }

  if (error instanceof AuthorizationError) {
    return createErrorResponse(error, timestamp, requestId);
  }

  if (error instanceof ValidationError) {
    return createErrorResponse(error, timestamp, requestId);
  }

  if (error instanceof NotFoundError) {
    return createErrorResponse(error, timestamp, requestId);
  }

  if (error instanceof ConflictError) {
    return createErrorResponse(error, timestamp, requestId);
  }

  if (error instanceof RateLimitError) {
    return createErrorResponse(error, timestamp, requestId);
  }

  if (error instanceof InternalServerError) {
    return createErrorResponse(error, timestamp, requestId);
  }

  if (error instanceof ServiceUnavailableError) {
    return createErrorResponse(error, timestamp, requestId);
  }

  // Handle AWS SDK errors
  if (error && typeof error === 'object' && 'code' in error) {
    const awsError = error as any;
    return handleAWSError(awsError, timestamp, requestId);
  }

  // Handle generic errors
  if (error instanceof Error) {
    return createErrorResponse(
      new InternalServerError('An unexpected error occurred', { originalError: error.message }),
      timestamp,
      requestId
    );
  }

  // Handle unknown errors
  return createErrorResponse(
    new InternalServerError('An unknown error occurred', { originalError: String(error) }),
    timestamp,
    requestId
  );
}

/**
 * Create standardized error response
 */
function createErrorResponse(
  error: Error & { code?: string; statusCode?: number; details?: any },
  timestamp: string,
  requestId?: string
): APIGatewayProxyResult {
  const statusCode = (error as any).statusCode || 500;
  const code = (error as any).code || 'UNKNOWN_ERROR';

  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code,
      message: error.message,
      details: (error as any).details,
      timestamp,
      requestId
    }
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Tenant-ID',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Credentials': 'true'
    },
    body: JSON.stringify(errorResponse)
  };
}

/**
 * Handle AWS SDK errors
 */
function handleAWSError(error: any, timestamp: string, requestId?: string): APIGatewayProxyResult {
  let statusCode = 500;
  let code = 'AWS_ERROR';
  let message = 'An AWS service error occurred';

  // Map common AWS errors to appropriate HTTP status codes
  switch (error.code) {
    case 'AccessDenied':
    case 'UnauthorizedOperation':
      statusCode = 403;
      code = 'ACCESS_DENIED';
      message = 'Access denied to AWS resource';
      break;

    case 'InvalidParameterValue':
    case 'InvalidParameter':
      statusCode = 400;
      code = 'INVALID_PARAMETER';
      message = 'Invalid parameter provided';
      break;

    case 'ResourceNotFoundException':
      statusCode = 404;
      code = 'RESOURCE_NOT_FOUND';
      message = 'AWS resource not found';
      break;

    case 'ThrottlingException':
    case 'TooManyRequestsException':
      statusCode = 429;
      code = 'RATE_LIMITED';
      message = 'Rate limit exceeded';
      break;

    case 'ServiceUnavailable':
    case 'InternalError':
      statusCode = 503;
      code = 'SERVICE_UNAVAILABLE';
      message = 'AWS service temporarily unavailable';
      break;

    default:
      // Keep default values
      break;
  }

  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      details: {
        awsErrorCode: error.code,
        awsErrorMessage: error.message,
        awsRequestId: error.requestId
      },
      timestamp,
      requestId
    }
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Tenant-ID',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Credentials': 'true'
    },
    body: JSON.stringify(errorResponse)
  };
}

/**
 * Validate request body
 */
export function validateRequestBody(body: string | null, schema?: any): any {
  if (!body) {
    throw new ValidationError('Request body is required');
  }

  try {
    const parsed = JSON.parse(body);
    
    if (schema) {
      const validationResult = schema.safeParse(parsed);
      if (!validationResult.success) {
        throw new ValidationError('Invalid request body', validationResult.error.errors);
      }
      return validationResult.data;
    }

    return parsed;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Invalid JSON in request body');
  }
}

/**
 * Validate query parameters
 */
export function validateQueryParameters(queryParams: { [key: string]: string } | null, schema?: any): any {
  if (!queryParams) {
    return {};
  }

  if (schema) {
    const validationResult = schema.safeParse(queryParams);
    if (!validationResult.success) {
      throw new ValidationError('Invalid query parameters', validationResult.error.errors);
    }
    return validationResult.data;
  }

  return queryParams;
}

/**
 * Validate path parameters
 */
export function validatePathParameters(pathParams: { [key: string]: string } | null, schema?: any): any {
  if (!pathParams) {
    return {};
  }

  if (schema) {
    const validationResult = schema.safeParse(pathParams);
    if (!validationResult.success) {
      throw new ValidationError('Invalid path parameters', validationResult.error.errors);
    }
    return validationResult.data;
  }

  return pathParams;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (error instanceof RateLimitError) {
    return true;
  }

  if (error instanceof ServiceUnavailableError) {
    return true;
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const retryableCodes = [
      'ThrottlingException',
      'TooManyRequestsException',
      'ServiceUnavailable',
      'InternalError',
      'RequestTimeout',
      'RequestTimeoutException'
    ];
    return retryableCodes.includes(error.code);
  }

  return false;
}

/**
 * Get retry delay for retryable errors
 */
export function getRetryDelay(error: any, attempt: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const exponentialBackoff = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * exponentialBackoff;
  
  return Math.floor(exponentialBackoff + jitter);
}
