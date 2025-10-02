/**
 * Structured logging utility for Bedrock Agent service
 */

export interface LogContext {
  correlationId?: string;
  sessionId?: string;
  agentId?: string;
  actionGroup?: string;
  userId?: string;
  tenantId?: string;
  [key: string]: any;
}

export class Logger {
  private serviceName = 'bedrock-agent';
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
   * Log agent invocation
   */
  logAgentInvocation(
    sessionId: string,
    inputText: string,
    correlationId: string,
    context: LogContext = {}
  ): void {
    this.info('Agent invocation started', {
      correlationId,
      sessionId,
      inputLength: inputText.length,
      ...context
    });
  }

  /**
   * Log agent response
   */
  logAgentResponse(
    sessionId: string,
    responseLength: number,
    duration: number,
    correlationId: string,
    context: LogContext = {}
  ): void {
    this.info('Agent invocation completed', {
      correlationId,
      sessionId,
      responseLength,
      duration,
      ...context
    });
  }

  /**
   * Log action group execution
   */
  logActionGroupExecution(
    actionGroupName: string,
    operation: string,
    correlationId: string,
    context: LogContext = {}
  ): void {
    this.info('Action group execution', {
      correlationId,
      actionGroup: actionGroupName,
      operation,
      ...context
    });
  }

  /**
   * Log agent error
   */
  logAgentError(
    error: Error,
    correlationId: string,
    context: LogContext = {}
  ): void {
    this.error('Agent error occurred', {
      correlationId,
      error: error.message,
      stack: error.stack,
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
   * Log security event
   */
  logSecurityEvent(
    event: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    correlationId: string,
    context: LogContext = {}
  ): void {
    this.warn('Security event', {
      correlationId,
      securityEvent: event,
      severity,
      ...context
    });
  }

  /**
   * Log audit event
   */
  logAuditEvent(
    action: string,
    resource: string,
    correlationId: string,
    context: LogContext = {}
  ): void {
    this.info('Audit event', {
      correlationId,
      auditAction: action,
      resource,
      ...context
    });
  }
}

export const logger = new Logger();
