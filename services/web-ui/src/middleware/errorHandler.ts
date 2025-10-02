import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Custom error classes
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
  }
  
  field?: string;
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: Error) {
    super(`External service error: ${service}`, 502, 'EXTERNAL_SERVICE_ERROR');
    this.originalError = originalError;
  }
  
  originalError?: Error;
}

/**
 * Error response interface
 */
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: any;
    timestamp: string;
    correlationId?: string;
  };
}

/**
 * Main error handling middleware
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Set default values
  let statusCode = 500;
  let message = 'Internal server error';
  let code: string | undefined;
  let details: any;

  // Handle different error types
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.code;
    
    if (error instanceof ValidationError) {
      details = { field: error.field };
    }
    
    if (error instanceof ExternalServiceError && error.originalError) {
      details = { originalError: error.originalError.message };
    }
  } else if (error.name === 'ValidationError') {
    // Mongoose/Joi validation errors
    statusCode = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    details = error.message;
  } else if (error.name === 'CastError') {
    // MongoDB cast errors
    statusCode = 400;
    message = 'Invalid ID format';
    code = 'INVALID_ID';
  } else if (error.name === 'MongoError' && (error as any).code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    message = 'Duplicate entry';
    code = 'DUPLICATE_ENTRY';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  }

  // Log error
  const correlationId = (req as any).correlationId;
  logger.error('Request error', {
    correlationId,
    method: req.method,
    path: req.path,
    statusCode,
    error: message,
    code,
    details,
    stack: error.stack,
    userId: (req as any).user?.id,
    tenantId: (req as any).user?.tenantId,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // Prepare response
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      message,
      code,
      timestamp: new Date().toISOString(),
      correlationId
    }
  };

  // Include details in development
  if (process.env.NODE_ENV === 'development' && details) {
    errorResponse.error.details = details;
  }

  // Send response
  res.status(statusCode).json(errorResponse);
}

/**
 * 404 handler for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new NotFoundError(`Route ${req.method} ${req.path}`);
  next(error);
}

/**
 * Async error wrapper
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation error helper
 */
export function createValidationError(message: string, field?: string): ValidationError {
  return new ValidationError(message, field);
}

/**
 * Check if error is operational (expected) vs programming error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}
