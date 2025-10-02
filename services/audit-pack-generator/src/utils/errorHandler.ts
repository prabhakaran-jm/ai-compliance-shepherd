import { APIGatewayProxyResult } from 'aws-lambda';
import { logger } from './logger';

/**
 * Custom error classes for audit pack generator
 */

export class AuditPackGeneratorError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    code: string = 'AUDIT_PACK_ERROR',
    statusCode: number = 500,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AuditPackGeneratorError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuditPackGeneratorError);
    }
  }
}

export class ValidationError extends AuditPackGeneratorError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class EvidenceCollectionError extends AuditPackGeneratorError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'EVIDENCE_COLLECTION_ERROR', 500, details);
    this.name = 'EvidenceCollectionError';
  }
}

export class ComplianceAnalysisError extends AuditPackGeneratorError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'COMPLIANCE_ANALYSIS_ERROR', 500, details);
    this.name = 'ComplianceAnalysisError';
  }
}

export class ReportGenerationError extends AuditPackGeneratorError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'REPORT_GENERATION_ERROR', 500, details);
    this.name = 'ReportGenerationError';
  }
}

export class PackageBuildError extends AuditPackGeneratorError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'PACKAGE_BUILD_ERROR', 500, details);
    this.name = 'PackageBuildError';
  }
}

export class S3OperationError extends AuditPackGeneratorError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'S3_OPERATION_ERROR', 500, details);
    this.name = 'S3OperationError';
  }
}

export class DatabaseError extends AuditPackGeneratorError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'DATABASE_ERROR', 500, details);
    this.name = 'DatabaseError';
  }
}

export class AuthenticationError extends AuditPackGeneratorError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AuditPackGeneratorError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'AUTHORIZATION_ERROR', 403, details);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AuditPackGeneratorError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'NOT_FOUND_ERROR', 404, details);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AuditPackGeneratorError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CONFLICT_ERROR', 409, details);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AuditPackGeneratorError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'RATE_LIMIT_ERROR', 429, details);
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends AuditPackGeneratorError {
  constructor(message: string, service: string, details?: Record<string, any>) {
    super(message, 'EXTERNAL_SERVICE_ERROR', 502, { service, ...details });
    this.name = 'ExternalServiceError';
  }
}

export class TimeoutError extends AuditPackGeneratorError {
  constructor(message: string, operation: string, timeout: number, details?: Record<string, any>) {
    super(message, 'TIMEOUT_ERROR', 504, { operation, timeout, ...details });
    this.name = 'TimeoutError';
  }
}

/**
 * Error handling utilities
 */

export function createErrorResponse(
  statusCode: number,
  message: string,
  correlationId?: string,
  details?: Record<string, any>
): APIGatewayProxyResult {
  const errorResponse = {
    success: false,
    error: {
      message,
      code: getErrorCodeFromStatus(statusCode),
      timestamp: new Date().toISOString(),
      correlationId,
      details
    }
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'POST,GET,DELETE,OPTIONS'
    },
    body: JSON.stringify(errorResponse)
  };
}

export function handleError(error: unknown, correlationId?: string): APIGatewayProxyResult {
  if (error instanceof AuditPackGeneratorError) {
    logger.error('Audit pack generator error', {
      correlationId,
      errorCode: error.code,
      errorMessage: error.message,
      statusCode: error.statusCode,
      details: error.details
    }, error);

    return createErrorResponse(
      error.statusCode,
      error.message,
      correlationId,
      error.details
    );
  }

  if (error instanceof Error) {
    // Handle AWS SDK errors
    if (error.name.includes('AWS')) {
      return handleAWSError(error, correlationId);
    }

    // Handle other known errors
    if (error.name === 'ValidationError') {
      return createErrorResponse(400, error.message, correlationId);
    }

    if (error.name === 'TimeoutError') {
      return createErrorResponse(504, error.message, correlationId);
    }

    // Generic error handling
    logger.error('Unhandled error', {
      correlationId,
      errorName: error.name,
      errorMessage: error.message
    }, error);

    return createErrorResponse(
      500,
      'Internal server error',
      correlationId,
      { originalError: error.message }
    );
  }

  // Handle non-Error objects
  logger.error('Unknown error type', {
    correlationId,
    error: String(error)
  });

  return createErrorResponse(
    500,
    'An unexpected error occurred',
    correlationId
  );
}

export function handleAWSError(error: Error, correlationId?: string): APIGatewayProxyResult {
  const awsError = error as any;
  
  logger.error('AWS SDK error', {
    correlationId,
    errorName: awsError.name,
    errorCode: awsError.code,
    errorMessage: awsError.message,
    statusCode: awsError.$metadata?.httpStatusCode
  }, error);

  // Map common AWS errors to appropriate HTTP status codes
  const statusCodeMap: Record<string, number> = {
    'AccessDenied': 403,
    'AccessDeniedException': 403,
    'UnauthorizedOperation': 403,
    'Forbidden': 403,
    'InvalidParameterValue': 400,
    'InvalidParameter': 400,
    'ValidationException': 400,
    'MalformedPolicyDocument': 400,
    'NoSuchBucket': 404,
    'NoSuchKey': 404,
    'ResourceNotFound': 404,
    'ResourceNotFoundException': 404,
    'BucketAlreadyExists': 409,
    'BucketAlreadyOwnedByYou': 409,
    'ResourceAlreadyExists': 409,
    'ThrottlingException': 429,
    'RequestLimitExceeded': 429,
    'ServiceUnavailable': 503,
    'InternalError': 500,
    'ServiceException': 500
  };

  const statusCode = statusCodeMap[awsError.code] || 500;
  const message = getAWSErrorMessage(awsError.code, awsError.message);

  return createErrorResponse(statusCode, message, correlationId, {
    awsErrorCode: awsError.code,
    awsRequestId: awsError.$metadata?.requestId
  });
}

function getErrorCodeFromStatus(statusCode: number): string {
  const codeMap: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
    504: 'TIMEOUT'
  };

  return codeMap[statusCode] || 'UNKNOWN_ERROR';
}

function getAWSErrorMessage(errorCode: string, originalMessage: string): string {
  const messageMap: Record<string, string> = {
    'AccessDenied': 'Access denied. Please check your permissions.',
    'AccessDeniedException': 'Access denied. Please check your permissions.',
    'UnauthorizedOperation': 'Unauthorized operation. Please check your permissions.',
    'InvalidParameterValue': 'Invalid parameter value provided.',
    'ValidationException': 'Request validation failed.',
    'NoSuchBucket': 'The specified bucket does not exist.',
    'NoSuchKey': 'The specified object does not exist.',
    'ResourceNotFound': 'The requested resource was not found.',
    'BucketAlreadyExists': 'A bucket with this name already exists.',
    'ThrottlingException': 'Request rate exceeded. Please retry after some time.',
    'RequestLimitExceeded': 'Request rate exceeded. Please retry after some time.',
    'ServiceUnavailable': 'Service temporarily unavailable. Please retry.',
    'InternalError': 'An internal error occurred. Please retry.'
  };

  return messageMap[errorCode] || originalMessage || 'An AWS service error occurred.';
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
    private readonly recoveryTimeout: number = 60000, // 1 minute
    private readonly successThreshold: number = 2
  ) {}

  async execute<T>(operation: () => Promise<T>, correlationId?: string): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.recoveryTimeout) {
        throw new ExternalServiceError('Circuit breaker is OPEN', 'circuit-breaker');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(correlationId);
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(correlationId?: string): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.warn('Circuit breaker opened', {
        correlationId,
        failures: this.failures,
        threshold: this.failureThreshold
      });
    }
  }

  getState(): string {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }

  reset(): void {
    this.failures = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
  }
}

/**
 * Retry mechanism with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000,
  correlationId?: string
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        logger.error('Max retries exceeded', {
          correlationId,
          maxRetries,
          lastError: lastError.message
        });
        break;
      }

      // Don't retry on certain error types
      if (error instanceof ValidationError || 
          error instanceof AuthenticationError || 
          error instanceof AuthorizationError ||
          error instanceof NotFoundError) {
        throw error;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      
      logger.warn('Operation failed, retrying', {
        correlationId,
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
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string = 'operation',
  correlationId?: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(
        `${operationName} timed out after ${timeoutMs}ms`,
        operationName,
        timeoutMs
      ));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(), timeoutPromise]);
  } catch (error) {
    if (error instanceof TimeoutError) {
      logger.error('Operation timeout', {
        correlationId,
        operationName,
        timeoutMs
      });
    }
    throw error;
  }
}

/**
 * Error aggregation for batch operations
 */
export class ErrorAggregator {
  private errors: Array<{ operation: string; error: Error }> = [];

  addError(operation: string, error: Error): void {
    this.errors.push({ operation, error });
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getErrors(): Array<{ operation: string; error: Error }> {
    return [...this.errors];
  }

  getErrorCount(): number {
    return this.errors.length;
  }

  throwIfErrors(message: string = 'Multiple operations failed'): void {
    if (this.hasErrors()) {
      const details = this.errors.map(({ operation, error }) => ({
        operation,
        error: error.message
      }));

      throw new AuditPackGeneratorError(
        `${message}: ${this.errors.length} operations failed`,
        'BATCH_OPERATION_ERROR',
        500,
        { errors: details }
      );
    }
  }

  clear(): void {
    this.errors = [];
  }
}
