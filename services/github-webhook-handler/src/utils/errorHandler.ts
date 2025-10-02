import { APIGatewayProxyResult } from 'aws-lambda';
import { logger } from './logger';

/**
 * Custom error classes for GitHub webhook handling
 */
export class GitHubWebhookError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly originalError?: Error;

  constructor(message: string, originalError?: Error, code = 'GITHUB_WEBHOOK_ERROR', statusCode = 500) {
    super(message);
    this.name = 'GitHubWebhookError';
    this.code = code;
    this.statusCode = statusCode;
    this.originalError = originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GitHubWebhookError);
    }
  }
}

export class WebhookValidationError extends GitHubWebhookError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError, 'WEBHOOK_VALIDATION_ERROR', 400);
    this.name = 'WebhookValidationError';
  }
}

export class GitHubAPIError extends GitHubWebhookError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError, 'GITHUB_API_ERROR', 502);
    this.name = 'GitHubAPIError';
  }
}

export class TerraformAnalysisError extends GitHubWebhookError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError, 'TERRAFORM_ANALYSIS_ERROR', 500);
    this.name = 'TerraformAnalysisError';
  }
}

export class AuthenticationError extends GitHubWebhookError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends GitHubWebhookError {
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
      'Access-Control-Allow-Methods': 'POST,OPTIONS'
    },
    body: JSON.stringify(errorResponse)
  };
}

/**
 * Handle errors and return appropriate API Gateway response
 */
export function handleError(error: any, correlationId: string): APIGatewayProxyResult {
  // Handle known error types
  if (error instanceof GitHubWebhookError) {
    logger.error('GitHub webhook error', {
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
    return createErrorResponse(
      statusCode,
      'AWS service error occurred',
      correlationId,
      { 
        code: error.code || 'AWS_ERROR',
        service: error.name
      }
    );
  }

  // Handle GitHub API errors (from Octokit)
  if (error.status && error.response) {
    logger.error('GitHub API error', {
      correlationId,
      status: error.status,
      message: error.message,
      url: error.response?.url,
      headers: error.response?.headers
    });

    let statusCode = 502; // Bad Gateway for external API errors
    let message = 'GitHub API error occurred';

    if (error.status === 401) {
      statusCode = 401;
      message = 'GitHub authentication failed';
    } else if (error.status === 403) {
      statusCode = 403;
      message = 'GitHub API access forbidden';
    } else if (error.status === 404) {
      statusCode = 404;
      message = 'GitHub resource not found';
    } else if (error.status === 422) {
      statusCode = 400;
      message = 'Invalid GitHub API request';
    }

    return createErrorResponse(
      statusCode,
      message,
      correlationId,
      { 
        code: 'GITHUB_API_ERROR',
        githubStatus: error.status
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
 * Retry wrapper for operations that might fail temporarily
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
      
      logger.warn('Operation failed, retrying', {
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
 * Validate webhook signature (for GitHub webhook security)
 */
export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const crypto = require('crypto');
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error('Error validating webhook signature', { error });
    return false;
  }
}
