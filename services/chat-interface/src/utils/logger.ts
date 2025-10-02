/**
 * Structured logging utility for chat interface service
 */

export interface LogContext {
  correlationId?: string;
  sessionId?: string;
  clientId?: string;
  userId?: string;
  messageId?: string;
  [key: string]: any;
}

export class Logger {
  private serviceName = 'chat-interface';
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
   * Log chat message
   */
  logChatMessage(
    sessionId: string,
    messageLength: number,
    correlationId: string,
    context: LogContext = {}
  ): void {
    this.info('Chat message processed', {
      correlationId,
      sessionId,
      messageLength,
      ...context
    });
  }

  /**
   * Log WebSocket event
   */
  logWebSocketEvent(
    event: string,
    clientId: string,
    context: LogContext = {}
  ): void {
    this.info('WebSocket event', {
      event,
      clientId,
      ...context
    });
  }

  /**
   * Log API request
   */
  logApiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    correlationId: string,
    context: LogContext = {}
  ): void {
    this.info('API request', {
      method,
      path,
      statusCode,
      duration,
      correlationId,
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
      operation,
      duration,
      correlationId,
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
      securityEvent: event,
      severity,
      correlationId,
      ...context
    });
  }

  /**
   * Log rate limit event
   */
  logRateLimitEvent(
    clientId: string,
    limit: number,
    current: number,
    context: LogContext = {}
  ): void {
    this.warn('Rate limit exceeded', {
      clientId,
      limit,
      current,
      ...context
    });
  }

  /**
   * Log session event
   */
  logSessionEvent(
    event: string,
    sessionId: string,
    correlationId: string,
    context: LogContext = {}
  ): void {
    this.info('Session event', {
      event,
      sessionId,
      correlationId,
      ...context
    });
  }
}

export const logger = new Logger();
