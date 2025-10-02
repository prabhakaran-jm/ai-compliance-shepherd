import { APIGatewayProxyResult } from 'aws-lambda';
import { logger } from './logger';

/**
 * Custom error classes for Bedrock Knowledge Base service
 */
export class BedrockError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly originalError?: Error;

  constructor(message: string, originalError?: Error, code = 'BEDROCK_ERROR', statusCode = 500) {
    super(message);
    this.name = 'BedrockError';
    this.code = code;
    this.statusCode = statusCode;
    this.originalError = originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BedrockError);
    }
  }
}

export class KnowledgeBaseError extends BedrockError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError, 'KNOWLEDGE_BASE_ERROR', 500);
    this.name = 'KnowledgeBaseError';
  }
}

export class DataIngestionError extends BedrockError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError, 'DATA_INGESTION_ERROR', 500);
    this.name = 'DataIngestionError';
  }
}

export class QueryError extends BedrockError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError, 'QUERY_ERROR', 500);
    this.name = 'QueryError';
  }
}

export class ValidationError extends BedrockError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class ModelError extends BedrockError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError, 'MODEL_ERROR', 502);
    this.name = 'ModelError';
  }
}

export class RateLimitError extends BedrockError {
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
      'Access-Control-Allow-Methods': 'POST,GET,PUT,OPTIONS'
    },
    body: JSON.stringify(errorResponse)
  };
}

/**
 * Handle errors and return appropriate API Gateway response
 */
export function handleError(error: any, correlationId: string): APIGatewayProxyResult {
  // Handle known error types
  if (error instanceof BedrockError) {
    logger.error('Bedrock error', {
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
      case 'AccessDeniedException':
      case 'UnauthorizedOperation':
        message = 'Insufficient permissions to access Bedrock services';
        break;
      case 'ResourceNotFoundException':
        message = 'Knowledge base or model not found';
        break;
      case 'ValidationException':
        message = 'Invalid request parameters';
        break;
      case 'ThrottlingException':
      case 'ServiceQuotaExceededException':
        message = 'Request rate limit exceeded';
        break;
      case 'ModelTimeoutException':
        message = 'Model request timeout';
        break;
      case 'ModelNotReadyException':
        message = 'Model is not ready for inference';
        break;
      case 'ServiceUnavailableException':
        message = 'Bedrock service temporarily unavailable';
        break;
      default:
        message = 'Bedrock service error occurred';
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
      'Request timeout',
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
 * Retry wrapper for Bedrock operations
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
      if (error instanceof ValidationError ||
          error.name === 'AccessDeniedException' ||
          error.name === 'ResourceNotFoundException') {
        throw error;
      }

      logger.warn('Bedrock operation failed, retrying', {
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
 * Circuit breaker for Bedrock API calls
 */
export class BedrockCircuitBreaker {
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
        logger.info('Bedrock circuit breaker transitioning to HALF_OPEN', {
          correlationId: this.correlationId,
          failures: this.failures
        });
      } else {
        throw new BedrockError('Circuit breaker is OPEN - Bedrock service unavailable');
      }
    }

    try {
      const result = await operation();
      
      if (this.state === 'HALF_OPEN') {
        this.reset();
        logger.info('Bedrock circuit breaker reset to CLOSED', {
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
      logger.warn('Bedrock circuit breaker opened due to failures', {
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
 * Token usage tracker for cost monitoring
 */
export class TokenUsageTracker {
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private requestCount = 0;

  trackUsage(inputTokens: number, outputTokens: number, correlationId?: string): void {
    this.totalInputTokens += inputTokens;
    this.totalOutputTokens += outputTokens;
    this.requestCount++;

    logger.info('Token usage tracked', {
      correlationId,
      inputTokens,
      outputTokens,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      requestCount: this.requestCount,
      type: 'token_usage'
    });
  }

  getUsageStats(): {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    requestCount: number;
    averageTokensPerRequest: number;
  } {
    const totalTokens = this.totalInputTokens + this.totalOutputTokens;
    return {
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      totalTokens,
      requestCount: this.requestCount,
      averageTokensPerRequest: this.requestCount > 0 ? totalTokens / this.requestCount : 0
    };
  }

  reset(): void {
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.requestCount = 0;
  }
}
