/**
 * Structured logging utility for Step Functions orchestrator
 */

export interface LogContext {
  correlationId?: string;
  executionArn?: string;
  workflowType?: string;
  tenantId?: string;
  stateMachine?: string;
  [key: string]: any;
}

export class Logger {
  private serviceName = 'step-functions-orchestrator';
  private version = '1.0.0';

  private formatMessage(level: string, message: string, context: LogContext = {}): string {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      version: this.version,
      message,
      ...context
    };

    return JSON.stringify(logEntry);
  }

  info(message: string, context: LogContext = {}): void {
    console.log(this.formatMessage('INFO', message, context));
  }

  warn(message: string, context: LogContext = {}): void {
    console.warn(this.formatMessage('WARN', message, context));
  }

  error(message: string, context: LogContext = {}): void {
    console.error(this.formatMessage('ERROR', message, context));
  }

  debug(message: string, context: LogContext = {}): void {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      console.debug(this.formatMessage('DEBUG', message, context));
    }
  }

  /**
   * Log workflow execution start
   */
  logWorkflowStart(
    executionArn: string,
    workflowType: string,
    tenantId: string,
    correlationId: string,
    context: LogContext = {}
  ): void {
    this.info('Workflow execution started', {
      correlationId,
      executionArn,
      workflowType,
      tenantId,
      ...context
    });
  }

  /**
   * Log workflow execution completion
   */
  logWorkflowComplete(
    executionArn: string,
    workflowType: string,
    status: string,
    duration: number,
    correlationId: string,
    context: LogContext = {}
  ): void {
    this.info('Workflow execution completed', {
      correlationId,
      executionArn,
      workflowType,
      status,
      duration,
      ...context
    });
  }

  /**
   * Log workflow execution error
   */
  logWorkflowError(
    executionArn: string,
    workflowType: string,
    error: Error,
    correlationId: string,
    context: LogContext = {}
  ): void {
    this.error('Workflow execution error', {
      correlationId,
      executionArn,
      workflowType,
      error: error.message,
      stack: error.stack,
      ...context
    });
  }

  /**
   * Log state transition
   */
  logStateTransition(
    executionArn: string,
    fromState: string,
    toState: string,
    correlationId: string,
    context: LogContext = {}
  ): void {
    this.debug('State transition', {
      correlationId,
      executionArn,
      fromState,
      toState,
      ...context
    });
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetrics(
    operation: string,
    duration: number,
    correlationId: string,
    context: LogContext = {}
  ): void {
    this.info('Performance metrics', {
      correlationId,
      operation,
      duration,
      ...context
    });
  }

  /**
   * Log workflow approval event
   */
  logApprovalEvent(
    executionArn: string,
    workflowType: string,
    action: string,
    approver: string,
    correlationId: string,
    context: LogContext = {}
  ): void {
    this.info('Workflow approval event', {
      correlationId,
      executionArn,
      workflowType,
      approvalAction: action,
      approver,
      ...context
    });
  }

  /**
   * Log notification event
   */
  logNotificationEvent(
    executionArn: string,
    workflowType: string,
    notificationType: string,
    recipients: string[],
    correlationId: string,
    context: LogContext = {}
  ): void {
    this.info('Notification sent', {
      correlationId,
      executionArn,
      workflowType,
      notificationType,
      recipientCount: recipients.length,
      ...context
    });
  }
}

export const logger = new Logger();
