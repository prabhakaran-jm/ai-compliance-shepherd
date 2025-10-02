import { APIGatewayProxyResult } from 'aws-lambda';
import { logger } from './logger';

/**
 * Custom error classes for workflow orchestration
 */

export class WorkflowOrchestratorError extends Error {
  constructor(
    message: string,
    public code: string = 'WORKFLOW_ERROR',
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'WorkflowOrchestratorError';
  }
}

export class WorkflowValidationError extends WorkflowOrchestratorError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'WORKFLOW_VALIDATION_ERROR', 400, details);
    this.name = 'WorkflowValidationError';
  }
}

export class WorkflowExecutionError extends WorkflowOrchestratorError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'WORKFLOW_EXECUTION_ERROR', 500, details);
    this.name = 'WorkflowExecutionError';
  }
}

export class WorkflowNotFoundError extends WorkflowOrchestratorError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'WORKFLOW_NOT_FOUND', 404, details);
    this.name = 'WorkflowNotFoundError';
  }
}

export class WorkflowTimeoutError extends WorkflowOrchestratorError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'WORKFLOW_TIMEOUT', 408, details);
    this.name = 'WorkflowTimeoutError';
  }
}

export class WorkflowApprovalError extends WorkflowOrchestratorError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'WORKFLOW_APPROVAL_ERROR', 403, details);
    this.name = 'WorkflowApprovalError';
  }
}

/**
 * Error response creator
 */
export function createErrorResponse(
  statusCode: number,
  message: string,
  correlationId: string,
  details?: Record<string, any>
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
 * Generic error handler
 */
export function handleError(error: unknown, correlationId: string): APIGatewayProxyResult {
  if (error instanceof WorkflowOrchestratorError) {
    logger.error('Workflow orchestrator error', {
      correlationId,
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details
    });

    return createErrorResponse(
      error.statusCode,
      error.message,
      correlationId,
      error.details
    );
  }

  // Handle AWS SDK errors
  if (error && typeof error === 'object' && 'name' in error) {
    const awsError = error as any;
    
    switch (awsError.name) {
      case 'ValidationException':
        return createErrorResponse(400, awsError.message || 'Validation failed', correlationId);
      
      case 'ResourceNotFoundException':
      case 'ExecutionDoesNotExist':
      case 'StateMachineDoesNotExist':
        return createErrorResponse(404, awsError.message || 'Resource not found', correlationId);
      
      case 'AccessDeniedException':
        return createErrorResponse(403, awsError.message || 'Access denied', correlationId);
      
      case 'ThrottlingException':
      case 'TooManyRequestsException':
        return createErrorResponse(429, awsError.message || 'Rate limit exceeded', correlationId);
      
      case 'ServiceUnavailableException':
        return createErrorResponse(503, awsError.message || 'Service unavailable', correlationId);
      
      case 'InternalServerException':
        return createErrorResponse(500, awsError.message || 'Internal server error', correlationId);
      
      case 'ExecutionLimitExceeded':
        return createErrorResponse(429, 'Too many concurrent executions', correlationId);
      
      case 'ExecutionAlreadyExists':
        return createErrorResponse(409, 'Execution with this name already exists', correlationId);
      
      case 'InvalidArn':
        return createErrorResponse(400, 'Invalid ARN format', correlationId);
      
      case 'InvalidName':
        return createErrorResponse(400, 'Invalid execution name', correlationId);
      
      case 'InvalidDefinition':
        return createErrorResponse(400, 'Invalid state machine definition', correlationId);
    }
  }

  // Handle generic errors
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  
  logger.error('Unhandled error', {
    correlationId,
    error: errorMessage,
    stack: error instanceof Error ? error.stack : undefined
  });

  return createErrorResponse(500, 'Internal server error', correlationId);
}

/**
 * Get error code from HTTP status
 */
function getErrorCodeFromStatus(statusCode: number): string {
  switch (statusCode) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 408: return 'REQUEST_TIMEOUT';
    case 409: return 'CONFLICT';
    case 422: return 'UNPROCESSABLE_ENTITY';
    case 429: return 'TOO_MANY_REQUESTS';
    case 500: return 'INTERNAL_SERVER_ERROR';
    case 502: return 'BAD_GATEWAY';
    case 503: return 'SERVICE_UNAVAILABLE';
    case 504: return 'GATEWAY_TIMEOUT';
    default: return 'UNKNOWN_ERROR';
  }
}

/**
 * Workflow execution error handler
 */
export function handleWorkflowExecutionError(
  executionArn: string,
  workflowType: string,
  error: any,
  correlationId: string
): void {
  logger.error('Workflow execution failed', {
    correlationId,
    executionArn,
    workflowType,
    error: error.message || 'Unknown error',
    errorType: error.name || 'UnknownError',
    cause: error.cause,
    stack: error.stack
  });

  // Additional error handling logic could go here:
  // - Send notifications
  // - Update execution status in database
  // - Trigger rollback procedures
  // - Create incident tickets
}

/**
 * Workflow timeout handler
 */
export function handleWorkflowTimeout(
  executionArn: string,
  workflowType: string,
  timeoutSeconds: number,
  correlationId: string
): void {
  logger.warn('Workflow execution timed out', {
    correlationId,
    executionArn,
    workflowType,
    timeoutSeconds
  });

  // Timeout handling logic:
  // - Stop the execution
  // - Send timeout notifications
  // - Update status
  // - Trigger cleanup procedures
}

/**
 * Circuit breaker for Step Functions operations
 */
export class StepFunctionsCircuitBreaker {
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
        throw new WorkflowExecutionError('Circuit breaker is open - Step Functions unavailable');
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
 * Retry mechanism for Step Functions operations
 */
export async function retryStepFunctionsOperation<T>(
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

      // Don't retry certain errors
      if (error && typeof error === 'object' && 'name' in error) {
        const errorName = (error as any).name;
        if (['ValidationException', 'InvalidArn', 'InvalidName'].includes(errorName)) {
          throw error;
        }
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );

      logger.warn('Step Functions operation failed, retrying', {
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
