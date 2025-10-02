import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

/**
 * Custom error classes for chat interface
 */

export class ChatInterfaceError extends Error {
  constructor(
    message: string,
    public code: string = 'CHAT_ERROR',
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ChatInterfaceError';
  }
}

export class ValidationError extends ChatInterfaceError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class SessionError extends ChatInterfaceError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'SESSION_ERROR', 400, details);
    this.name = 'SessionError';
  }
}

export class RateLimitError extends ChatInterfaceError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'RATE_LIMIT_ERROR', 429, details);
    this.name = 'RateLimitError';
  }
}

export class AgentError extends ChatInterfaceError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'AGENT_ERROR', 502, details);
    this.name = 'AgentError';
  }
}

/**
 * Express error handler middleware
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId = req.headers['x-correlation-id'] as string || 
                       `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Log the error
  logger.error('Express error handler', {
    correlationId,
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });

  // Handle known error types
  if (error instanceof ChatInterfaceError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
        correlationId,
        timestamp: new Date().toISOString(),
        ...(error.details && { details: error.details })
      }
    });
    return;
  }

  // Handle validation errors from express-validator
  if (error.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        correlationId,
        timestamp: new Date().toISOString(),
        details: error.message
      }
    });
    return;
  }

  // Handle JSON parsing errors
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Invalid JSON in request body',
        code: 'JSON_PARSE_ERROR',
        correlationId,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  // Handle generic errors
  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      correlationId,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const correlationId = req.headers['x-correlation-id'] as string || 
                       `404-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  logger.warn('Route not found', {
    correlationId,
    url: req.url,
    method: req.method,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND',
      correlationId,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  statusCode: number,
  message: string,
  code: string,
  correlationId: string,
  details?: Record<string, any>
) {
  return {
    success: false,
    error: {
      message,
      code,
      correlationId,
      timestamp: new Date().toISOString(),
      ...(details && { details })
    }
  };
}

/**
 * WebSocket error handler
 */
export function handleWebSocketError(
  error: Error,
  clientId: string,
  operation: string
): { type: string; data: any } {
  const correlationId = `ws-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  logger.error('WebSocket error', {
    correlationId,
    clientId,
    operation,
    error: error.message,
    stack: error.stack
  });

  if (error instanceof ChatInterfaceError) {
    return {
      type: 'error',
      data: {
        message: error.message,
        code: error.code,
        correlationId,
        timestamp: new Date().toISOString()
      }
    };
  }

  return {
    type: 'error',
    data: {
      message: 'An error occurred',
      code: 'WEBSOCKET_ERROR',
      correlationId,
      timestamp: new Date().toISOString()
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
    private threshold: number = 5,
    private timeout: number = 60000, // 1 minute
    private resetTimeout: number = 30000 // 30 seconds
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new AgentError('Circuit breaker is open - service unavailable');
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
        reject(new ChatInterfaceError(timeoutMessage, 'TIMEOUT_ERROR', 408));
      }, timeoutMs);
    })
  ]);
}
