import { APIGatewayProxyResult } from 'aws-lambda';
import { logger } from './logger';

/**
 * Custom error classes for Slack notifications
 */

export class SlackNotificationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    code: string = 'SLACK_NOTIFICATION_ERROR',
    statusCode: number = 500,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'SlackNotificationError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SlackNotificationError);
    }
  }
}

export class SlackConfigurationError extends SlackNotificationError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'SLACK_CONFIGURATION_ERROR', 400, details);
    this.name = 'SlackConfigurationError';
  }
}

export class SlackTokenError extends SlackNotificationError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'SLACK_TOKEN_ERROR', 401, details);
    this.name = 'SlackTokenError';
  }
}

export class SlackChannelError extends SlackNotificationError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'SLACK_CHANNEL_ERROR', 404, details);
    this.name = 'SlackChannelError';
  }
}

export class SlackMessageError extends SlackNotificationError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'SLACK_MESSAGE_ERROR', 400, details);
    this.name = 'SlackMessageError';
  }
}

export class SlackRateLimitError extends SlackNotificationError {
  constructor(message: string, retryAfter: number, details?: Record<string, any>) {
    super(message, 'SLACK_RATE_LIMIT_ERROR', 429, { retryAfter, ...details });
    this.name = 'SlackRateLimitError';
  }
}

export class SlackPermissionError extends SlackNotificationError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'SLACK_PERMISSION_ERROR', 403, details);
    this.name = 'SlackPermissionError';
  }
}

export class TemplateRenderError extends SlackNotificationError {
  constructor(message: string, templateName: string, details?: Record<string, any>) {
    super(message, 'TEMPLATE_RENDER_ERROR', 500, { templateName, ...details });
    this.name = 'TemplateRenderError';
  }
}

export class NotificationQueueError extends SlackNotificationError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'NOTIFICATION_QUEUE_ERROR', 500, details);
    this.name = 'NotificationQueueError';
  }
}

export class ValidationError extends SlackNotificationError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends SlackNotificationError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'DATABASE_ERROR', 500, details);
    this.name = 'DatabaseError';
  }
}

export class ExternalServiceError extends SlackNotificationError {
  constructor(message: string, service: string, details?: Record<string, any>) {
    super(message, 'EXTERNAL_SERVICE_ERROR', 502, { service, ...details });
    this.name = 'ExternalServiceError';
  }
}

export class TimeoutError extends SlackNotificationError {
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
      'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify(errorResponse)
  };
}

export function handleError(error: unknown, correlationId?: string): APIGatewayProxyResult {
  if (error instanceof SlackNotificationError) {
    logger.error('Slack notification error', {
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
    // Handle Slack API errors
    if (error.name.includes('Slack') || error.message.includes('slack')) {
      return handleSlackError(error, correlationId);
    }

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

export function handleSlackError(error: Error, correlationId?: string): APIGatewayProxyResult {
  const slackError = error as any;
  
  logger.error('Slack API error', {
    correlationId,
    errorName: slackError.name,
    errorCode: slackError.code,
    errorMessage: slackError.message,
    data: slackError.data
  }, error);

  // Map common Slack errors to appropriate HTTP status codes
  const statusCodeMap: Record<string, number> = {
    'not_authed': 401,
    'invalid_auth': 401,
    'account_inactive': 401,
    'token_revoked': 401,
    'no_permission': 403,
    'org_login_required': 403,
    'user_not_found': 404,
    'channel_not_found': 404,
    'not_in_channel': 404,
    'is_archived': 410,
    'msg_too_long': 400,
    'no_text': 400,
    'rate_limited': 429,
    'fatal_error': 500,
    'internal_error': 500
  };

  const statusCode = statusCodeMap[slackError.code] || 500;
  const message = getSlackErrorMessage(slackError.code, slackError.message);

  return createErrorResponse(statusCode, message, correlationId, {
    slackErrorCode: slackError.code,
    slackData: slackError.data
  });
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
    'ResourceNotFound': 404,
    'ResourceNotFoundException': 404,
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
    410: 'GONE',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
    504: 'TIMEOUT'
  };

  return codeMap[statusCode] || 'UNKNOWN_ERROR';
}

function getSlackErrorMessage(errorCode: string, originalMessage: string): string {
  const messageMap: Record<string, string> = {
    'not_authed': 'Slack authentication required. Please check your bot token.',
    'invalid_auth': 'Invalid Slack authentication. Please verify your bot token.',
    'account_inactive': 'Slack account is inactive. Please contact your Slack administrator.',
    'token_revoked': 'Slack token has been revoked. Please reconfigure your integration.',
    'no_permission': 'Insufficient permissions. Please check your Slack app permissions.',
    'org_login_required': 'Organization login required. Please contact your Slack administrator.',
    'user_not_found': 'Slack user not found.',
    'channel_not_found': 'Slack channel not found. Please verify the channel exists.',
    'not_in_channel': 'Bot is not a member of the specified channel. Please invite the bot to the channel.',
    'is_archived': 'Cannot send message to archived channel.',
    'msg_too_long': 'Message is too long. Please reduce the message size.',
    'no_text': 'Message text is required.',
    'rate_limited': 'Slack rate limit exceeded. Please retry after some time.',
    'fatal_error': 'Slack service encountered a fatal error. Please try again later.',
    'internal_error': 'Slack service internal error. Please try again later.'
  };

  return messageMap[errorCode] || originalMessage || 'A Slack API error occurred.';
}

function getAWSErrorMessage(errorCode: string, originalMessage: string): string {
  const messageMap: Record<string, string> = {
    'AccessDenied': 'Access denied. Please check your AWS permissions.',
    'AccessDeniedException': 'Access denied. Please check your AWS permissions.',
    'UnauthorizedOperation': 'Unauthorized operation. Please check your AWS permissions.',
    'InvalidParameterValue': 'Invalid parameter value provided.',
    'ValidationException': 'Request validation failed.',
    'ResourceNotFound': 'The requested AWS resource was not found.',
    'ResourceAlreadyExists': 'The AWS resource already exists.',
    'ThrottlingException': 'AWS request rate exceeded. Please retry after some time.',
    'RequestLimitExceeded': 'AWS request rate exceeded. Please retry after some time.',
    'ServiceUnavailable': 'AWS service temporarily unavailable. Please retry.',
    'InternalError': 'An AWS internal error occurred. Please retry.'
  };

  return messageMap[errorCode] || originalMessage || 'An AWS service error occurred.';
}

/**
 * Circuit breaker for Slack API calls
 */
export class SlackCircuitBreaker {
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
        throw new SlackNotificationError('Slack circuit breaker is OPEN', 'CIRCUIT_BREAKER_OPEN', 503);
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
      logger.warn('Slack circuit breaker opened', {
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
 * Retry mechanism with exponential backoff for Slack operations
 */
export async function retrySlackOperation<T>(
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
        logger.error('Max retries exceeded for Slack operation', {
          correlationId,
          maxRetries,
          lastError: lastError.message
        });
        break;
      }

      // Don't retry on certain error types
      if (error instanceof SlackTokenError || 
          error instanceof SlackPermissionError || 
          error instanceof SlackChannelError ||
          error instanceof ValidationError) {
        throw error;
      }

      // Handle rate limiting with specific retry delay
      if (error instanceof SlackRateLimitError) {
        const retryAfter = error.details?.retryAfter || baseDelay;
        logger.warn('Slack rate limited, retrying after delay', {
          correlationId,
          attempt: attempt + 1,
          maxRetries,
          retryAfter
        });
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      
      logger.warn('Slack operation failed, retrying', {
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
 * Timeout wrapper for Slack operations
 */
export async function withSlackTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string = 'slack-operation',
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
      logger.error('Slack operation timeout', {
        correlationId,
        operationName,
        timeoutMs
      });
    }
    throw error;
  }
}

/**
 * Error aggregation for batch Slack operations
 */
export class SlackErrorAggregator {
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

  throwIfErrors(message: string = 'Multiple Slack operations failed'): void {
    if (this.hasErrors()) {
      const details = this.errors.map(({ operation, error }) => ({
        operation,
        error: error.message
      }));

      throw new SlackNotificationError(
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

/**
 * Rate limit handler for Slack API
 */
export class SlackRateLimitHandler {
  private rateLimitInfo: Map<string, { resetTime: number; remainingRequests: number }> = new Map();

  updateRateLimit(channel: string, resetTime: number, remainingRequests: number): void {
    this.rateLimitInfo.set(channel, { resetTime, remainingRequests });
  }

  canMakeRequest(channel: string): boolean {
    const info = this.rateLimitInfo.get(channel);
    if (!info) return true;

    const now = Date.now();
    if (now >= info.resetTime) {
      this.rateLimitInfo.delete(channel);
      return true;
    }

    return info.remainingRequests > 0;
  }

  getRetryDelay(channel: string): number {
    const info = this.rateLimitInfo.get(channel);
    if (!info) return 0;

    const now = Date.now();
    return Math.max(0, info.resetTime - now);
  }

  decrementRequests(channel: string): void {
    const info = this.rateLimitInfo.get(channel);
    if (info && info.remainingRequests > 0) {
      info.remainingRequests--;
    }
  }
}
