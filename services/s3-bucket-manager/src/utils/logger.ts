/**
 * Logger Utility
 * 
 * Provides structured JSON logging for the S3 Bucket Manager Lambda function.
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
 * Log S3 bucket management request
 */
export function logBucketRequest(event: any, context: any): void {
  logger.info('S3 bucket management request received', {
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
 * Log S3 bucket management response
 */
export function logBucketResponse(statusCode: number, responseTime: number, data?: any): void {
  logger.performance('S3 bucket management response sent', responseTime, {
    statusCode,
    responseSize: data ? JSON.stringify(data).length : 0
  });
}

/**
 * Log bucket creation
 */
export function logBucketCreation(bucketName: string, purpose: string, region: string): void {
  logger.info('S3 bucket created', {
    bucketName,
    purpose,
    region
  });
}

/**
 * Log bucket configuration
 */
export function logBucketConfiguration(bucketName: string, configuration: any): void {
  logger.info('S3 bucket configured', {
    bucketName,
    configuration
  });
}

/**
 * Log bucket security configuration
 */
export function logBucketSecurity(bucketName: string, securitySettings: any): void {
  logger.info('S3 bucket security configured', {
    bucketName,
    securitySettings
  });
}

/**
 * Log bucket lifecycle configuration
 */
export function logBucketLifecycle(bucketName: string, lifecyclePolicy: any): void {
  logger.info('S3 bucket lifecycle configured', {
    bucketName,
    lifecyclePolicy
  });
}

/**
 * Log bucket deletion
 */
export function logBucketDeletion(bucketName: string): void {
  logger.info('S3 bucket deleted', {
    bucketName
  });
}

/**
 * Log bucket access
 */
export function logBucketAccess(bucketName: string, operation: string, success: boolean): void {
  logger.info('S3 bucket access', {
    bucketName,
    operation,
    success
  });
}

/**
 * Log bucket validation
 */
export function logBucketValidation(bucketName: string, validation: any): void {
  logger.info('S3 bucket validation', {
    bucketName,
    validation
  });
}
