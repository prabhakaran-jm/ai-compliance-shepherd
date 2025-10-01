/**
 * Error handler utility for findings storage Lambda
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import { logger } from './logger';

export interface ErrorResponse {
  error: string;
  message: string;
  details?: any;
  requestId?: string;
  timestamp: string;
}

export class FindingsStorageError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.name = 'FindingsStorageError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends FindingsStorageError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends FindingsStorageError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends FindingsStorageError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends FindingsStorageError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
  }
}

export class ConflictError extends FindingsStorageError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends FindingsStorageError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

export class ServiceUnavailableError extends FindingsStorageError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE_ERROR');
  }
}

export class TimeoutError extends FindingsStorageError {
  constructor(message: string = 'Operation timeout') {
    super(message, 504, 'TIMEOUT_ERROR');
  }
}

export function errorHandler(error: unknown): APIGatewayProxyResult {
  const timestamp = new Date().toISOString();
  
  // Log the error
  logger.error('Lambda error occurred', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    timestamp
  });

  // Handle known error types
  if (error instanceof FindingsStorageError) {
    return {
      statusCode: error.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        error: error.code,
        message: error.message,
        details: error.details,
        timestamp
      })
    };
  }

  // Handle AWS SDK errors
  if (error && typeof error === 'object' && 'code' in error) {
    const awsError = error as any;
    
    switch (awsError.code) {
      case 'AccessDenied':
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
          },
          body: JSON.stringify({
            error: 'ACCESS_DENIED',
            message: 'Access denied to AWS resource',
            details: awsError.message,
            timestamp
          })
        };

      case 'ThrottlingException':
        return {
          statusCode: 429,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
          },
          body: JSON.stringify({
            error: 'THROTTLING_ERROR',
            message: 'AWS service is throttling requests',
            details: awsError.message,
            timestamp
          })
        };

      case 'ServiceUnavailable':
        return {
          statusCode: 503,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
          },
          body: JSON.stringify({
            error: 'SERVICE_UNAVAILABLE',
            message: 'AWS service is temporarily unavailable',
            details: awsError.message,
            timestamp
          })
        };

      default:
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
          },
          body: JSON.stringify({
            error: 'AWS_ERROR',
            message: 'AWS service error',
            details: awsError.message,
            timestamp
          })
        };
    }
  }

  // Handle generic errors
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  
  return {
    statusCode: 500,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify({
      error: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
      details: errorMessage,
      timestamp
    })
  };
}

export function validateRequiredFields(data: any, requiredFields: string[]): void {
  const missingFields = requiredFields.filter(field => !data[field]);
  
  if (missingFields.length > 0) {
    throw new ValidationError(`Missing required fields: ${missingFields.join(', ')}`, {
      missingFields,
      providedFields: Object.keys(data)
    });
  }
}

export function validateFieldTypes(data: any, fieldTypes: Record<string, string>): void {
  const typeErrors: string[] = [];
  
  for (const [field, expectedType] of Object.entries(fieldTypes)) {
    if (data[field] !== undefined) {
      const actualType = typeof data[field];
      if (actualType !== expectedType) {
        typeErrors.push(`Field '${field}' must be of type '${expectedType}', got '${actualType}'`);
      }
    }
  }
  
  if (typeErrors.length > 0) {
    throw new ValidationError('Field type validation failed', {
      typeErrors,
      fieldTypes
    });
  }
}

export function validateArrayFields(data: any, arrayFields: string[]): void {
  const arrayErrors: string[] = [];
  
  for (const field of arrayFields) {
    if (data[field] !== undefined && !Array.isArray(data[field])) {
      arrayErrors.push(`Field '${field}' must be an array`);
    }
  }
  
  if (arrayErrors.length > 0) {
    throw new ValidationError('Array field validation failed', {
      arrayErrors,
      arrayFields
    });
  }
}

export function validateEnumFields(data: any, enumFields: Record<string, string[]>): void {
  const enumErrors: string[] = [];
  
  for (const [field, allowedValues] of Object.entries(enumFields)) {
    if (data[field] !== undefined && !allowedValues.includes(data[field])) {
      enumErrors.push(`Field '${field}' must be one of: ${allowedValues.join(', ')}`);
    }
  }
  
  if (enumErrors.length > 0) {
    throw new ValidationError('Enum field validation failed', {
      enumErrors,
      enumFields
    });
  }
}
