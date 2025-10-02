import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

/**
 * Async route handler wrapper
 * Catches async errors and passes them to error middleware
 */
export function handleAsyncRoute(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Async middleware wrapper with logging
 */
export function handleAsyncMiddleware(
  name: string,
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      await fn(req, res, next);
      
      const duration = Date.now() - startTime;
      logger.performance(`Middleware: ${name}`, duration, {
        path: req.path,
        method: req.method
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Middleware error: ${name}`, {
        path: req.path,
        method: req.method,
        duration_ms: duration,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      next(error);
    }
  };
}

/**
 * Retry wrapper for async operations
 */
export async function retryAsync<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  backoffMultiplier: number = 2
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      logger.warn('Async operation failed, retrying', {
        attempt,
        maxRetries,
        error: lastError.message,
        nextRetryDelay: attempt < maxRetries ? baseDelay * Math.pow(backoffMultiplier, attempt - 1) : null
      });
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  logger.error('Async operation failed after all retries', {
    maxRetries,
    finalError: lastError.message,
    stack: lastError.stack
  });
  
  throw lastError;
}

/**
 * Timeout wrapper for async operations
 */
export async function timeoutAsync<T>(
  operation: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  return Promise.race([operation, timeoutPromise]);
}

/**
 * Circuit breaker for async operations
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000,
    private readonly resetTimeout: number = 30000
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
        logger.info('Circuit breaker moving to half-open state');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await timeoutAsync(operation(), this.timeout);
      
      if (this.state === 'half-open') {
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
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
      logger.warn('Circuit breaker opened', {
        failures: this.failures,
        threshold: this.threshold
      });
    }
  }
  
  private reset(): void {
    this.failures = 0;
    this.state = 'closed';
    logger.info('Circuit breaker reset to closed state');
  }
  
  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}
