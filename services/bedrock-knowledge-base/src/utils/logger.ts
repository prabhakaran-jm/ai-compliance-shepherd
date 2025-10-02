/**
 * Structured logging utility for Bedrock Knowledge Base service
 * Provides consistent JSON logging with correlation IDs and metadata
 */

export interface LogContext {
  correlationId?: string;
  knowledgeBaseId?: string;
  dataSourceId?: string;
  ingestionJobId?: string;
  sessionId?: string;
  query?: string;
  framework?: string;
  dataType?: string;
  [key: string]: any;
}

export class Logger {
  private serviceName: string;
  private environment: string;

  constructor() {
    this.serviceName = 'bedrock-knowledge-base';
    this.environment = process.env.NODE_ENV || 'development';
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      service: this.serviceName,
      environment: this.environment,
      message,
      ...context
    };

    return JSON.stringify(logEntry);
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, context?: LogContext): void {
    console.error(this.formatMessage('error', message, context));
  }

  debug(message: string, context?: LogContext): void {
    if (this.environment === 'development' || process.env.DEBUG === 'true') {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  /**
   * Log knowledge base query
   */
  logQuery(query: string, sessionId: string, context?: LogContext): void {
    this.info('Knowledge base query', {
      query: query.substring(0, 200),
      sessionId,
      operation: 'query',
      ...context
    });
  }

  /**
   * Log data ingestion
   */
  logIngestion(
    dataType: string,
    framework: string,
    contentLength: number,
    context?: LogContext
  ): void {
    this.info('Data ingestion started', {
      dataType,
      framework,
      contentLength,
      operation: 'ingest',
      ...context
    });
  }

  /**
   * Log Bedrock API operation
   */
  logBedrockAPI(
    operation: string,
    modelArn?: string,
    success?: boolean,
    context?: LogContext
  ): void {
    this.debug('Bedrock API operation', {
      operation,
      modelArn,
      success,
      type: 'bedrock_api',
      ...context
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(
    operation: string,
    duration: number,
    tokensUsed?: number,
    context?: LogContext
  ): void {
    this.info('Performance metric', {
      operation,
      duration,
      tokensUsed,
      unit: 'ms',
      type: 'performance',
      ...context
    });
  }

  /**
   * Log compliance event
   */
  logCompliance(
    framework: string,
    category: string,
    action: string,
    context?: LogContext
  ): void {
    this.info('Compliance event', {
      framework,
      category,
      action,
      type: 'compliance',
      ...context
    });
  }
}

// Export singleton instance
export const logger = new Logger();
