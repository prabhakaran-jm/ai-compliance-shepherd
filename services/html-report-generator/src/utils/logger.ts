/**
 * Logger Utility
 * 
 * Provides structured JSON logging for the HTML Report Generator Lambda function.
 * Includes request context, correlation IDs, and performance metrics.
 */

interface LogContext {
  requestId?: string;
  tenantId?: string;
  userId?: string;
  correlationId?: string;
  functionName?: string;
  functionVersion?: string;
  region?: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: LogContext;
  data?: any;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    duration?: number;
    memoryUsage?: NodeJS.MemoryUsage;
  };
}

class Logger {
  private context: LogContext = {};

  /**
   * Set logging context
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Get current context
   */
  getContext(): LogContext {
    return { ...this.context };
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Log info message
   */
  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  /**
   * Log error message
   */
  error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  /**
   * Log with performance metrics
   */
  performance(message: string, duration: number, data?: any): void {
    this.log('info', message, {
      ...data,
      performance: {
        duration,
        memoryUsage: process.memoryUsage()
      }
    });
  }

  /**
   * Log with error details
   */
  errorWithStack(message: string, error: Error, data?: any): void {
    this.log('error', message, {
      ...data,
      error: {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      }
    });
  }

  /**
   * Core logging method
   */
  private log(level: string, message: string, data?: any): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context
    };

    if (data) {
      logEntry.data = data;
    }

    // Output to console in JSON format
    console.log(JSON.stringify(logEntry));

    // In production, you might want to send logs to CloudWatch, ELK, etc.
    if (process.env.LOG_DESTINATION === 'cloudwatch') {
      // Send to CloudWatch Logs
      this.sendToCloudWatch(logEntry);
    }
  }

  /**
   * Send log entry to CloudWatch
   */
  private sendToCloudWatch(logEntry: LogEntry): void {
    // In a real implementation, you would use AWS SDK to send logs to CloudWatch
    // For now, we'll just output to console
    console.log('CloudWatch:', JSON.stringify(logEntry));
  }
}

// Create singleton instance
export const logger = new Logger();

/**
 * Extract context from API Gateway event
 */
export function extractContextFromEvent(event: any, context: any): LogContext {
  return {
    requestId: context.awsRequestId,
    functionName: context.functionName,
    functionVersion: context.functionVersion,
    region: process.env.AWS_REGION,
    correlationId: event.headers?.['X-Correlation-ID'] || event.headers?.['x-correlation-id'],
    tenantId: event.requestContext?.authorizer?.tenantId,
    userId: event.requestContext?.authorizer?.userId
  };
}

/**
 * Create child logger with additional context
 */
export function createChildLogger(additionalContext: LogContext): Logger {
  const childLogger = new Logger();
  childLogger.setContext({
    ...logger.getContext(),
    ...additionalContext
  });
  return childLogger;
}

/**
 * Log report generation request
 */
export function logReportRequest(event: any, context: any): void {
  logger.info('Report generation request received', {
    method: event.httpMethod,
    path: event.path,
    resource: event.resource,
    queryStringParameters: event.queryStringParameters,
    pathParameters: event.pathParameters,
    headers: {
      'User-Agent': event.headers?.['User-Agent'],
      'Content-Type': event.headers?.['Content-Type'],
      'Authorization': event.headers?.Authorization ? '[REDACTED]' : undefined,
      'X-API-Key': event.headers?.['X-API-Key'] ? '[REDACTED]' : undefined
    },
    bodySize: event.body?.length || 0,
    requestContext: {
      requestId: event.requestContext?.requestId,
      stage: event.requestContext?.stage,
      resourcePath: event.requestContext?.resourcePath,
      httpMethod: event.requestContext?.httpMethod
    }
  });
}

/**
 * Log report generation response
 */
export function logReportResponse(statusCode: number, responseTime: number, data?: any): void {
  logger.performance('Report generation response sent', responseTime, {
    statusCode,
    responseSize: data ? JSON.stringify(data).length : 0
  });
}

/**
 * Log template compilation
 */
export function logTemplateCompilation(templateName: string, duration: number): void {
  logger.performance('Template compiled', duration, {
    templateName
  });
}

/**
 * Log report storage
 */
export function logReportStorage(reportId: string, size: number, s3Key: string): void {
  logger.info('Report stored', {
    reportId,
    size,
    s3Key
  });
}

/**
 * Log report retrieval
 */
export function logReportRetrieval(reportId: string, size: number): void {
  logger.info('Report retrieved', {
    reportId,
    size
  });
}
