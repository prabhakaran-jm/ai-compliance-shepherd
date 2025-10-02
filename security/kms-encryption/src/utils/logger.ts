/**
 * Structured logging utility for KMS Encryption Service
 * 
 * Provides JSON-structured logging with correlation IDs, security context,
 * and compliance-friendly audit trails.
 */

export interface LogContext {
  correlationId?: string;
  tenantId?: string;
  userId?: string;
  operation?: string;
  keyId?: string;
  service?: string;
  component?: string;
  [key: string]: any;
}

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

class Logger {
  private readonly serviceName = 'kms-encryption';
  private readonly version = '1.0.0';

  /**
   * Log an error message
   */
  error(message: string, context: LogContext = {}): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context: LogContext = {}): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context: LogContext = {}): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a debug message
   */
  debug(message: string, context: LogContext = {}): void {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      this.log(LogLevel.DEBUG, message, context);
    }
  }

  /**
   * Log a security event
   */
  security(message: string, context: LogContext = {}): void {
    this.log(LogLevel.INFO, message, {
      ...context,
      eventType: 'SECURITY',
      component: 'security-audit'
    });
  }

  /**
   * Log an audit event
   */
  audit(message: string, context: LogContext = {}): void {
    this.log(LogLevel.INFO, message, {
      ...context,
      eventType: 'AUDIT',
      component: 'audit-trail'
    });
  }

  /**
   * Log a compliance event
   */
  compliance(message: string, context: LogContext = {}): void {
    this.log(LogLevel.INFO, message, {
      ...context,
      eventType: 'COMPLIANCE',
      component: 'compliance-monitoring'
    });
  }

  /**
   * Log a performance metric
   */
  metric(metricName: string, value: number, unit: string = 'Count', context: LogContext = {}): void {
    this.log(LogLevel.INFO, `Metric: ${metricName}`, {
      ...context,
      eventType: 'METRIC',
      component: 'performance-monitoring',
      metricName,
      metricValue: value,
      metricUnit: unit
    });
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context: LogContext = {}): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      service: this.serviceName,
      version: this.version,
      environment: process.env.NODE_ENV || 'development',
      region: process.env.AWS_REGION || 'unknown',
      requestId: process.env.AWS_REQUEST_ID || context.correlationId || 'unknown',
      ...this.sanitizeContext(context)
    };

    // Output to CloudWatch Logs via console
    console.log(JSON.stringify(logEntry));

    // In production, you might also want to send to additional destinations
    if (level === LogLevel.ERROR || context.eventType === 'SECURITY') {
      this.sendToSecurityLog(logEntry);
    }
  }

  /**
   * Sanitize context to remove sensitive information
   */
  private sanitizeContext(context: LogContext): LogContext {
    const sanitized = { ...context };

    // Remove or mask sensitive fields
    const sensitiveFields = [
      'password',
      'secret',
      'token',
      'key',
      'credential',
      'auth',
      'plaintext',
      'data'
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        if (typeof sanitized[field] === 'string') {
          sanitized[field] = this.maskSensitiveData(sanitized[field]);
        } else {
          sanitized[field] = '[REDACTED]';
        }
      }
    }

    // Mask partial sensitive data
    if (sanitized.keyId && typeof sanitized.keyId === 'string') {
      sanitized.keyId = this.maskKeyId(sanitized.keyId);
    }

    if (sanitized.encryptedData && typeof sanitized.encryptedData === 'string') {
      sanitized.encryptedDataLength = sanitized.encryptedData.length;
      delete sanitized.encryptedData;
    }

    return sanitized;
  }

  /**
   * Mask sensitive data while preserving some information for debugging
   */
  private maskSensitiveData(data: string): string {
    if (data.length <= 8) {
      return '[REDACTED]';
    }
    
    const start = data.substring(0, 4);
    const end = data.substring(data.length - 4);
    const middle = '*'.repeat(Math.min(data.length - 8, 20));
    
    return `${start}${middle}${end}`;
  }

  /**
   * Mask KMS key ID while preserving prefix for identification
   */
  private maskKeyId(keyId: string): string {
    if (keyId.startsWith('arn:aws:kms:')) {
      // For ARNs, show region and account but mask key ID
      const parts = keyId.split(':');
      if (parts.length >= 6) {
        const maskedKeyId = this.maskSensitiveData(parts[5]);
        return `${parts.slice(0, 5).join(':')}:${maskedKeyId}`;
      }
    } else if (keyId.length > 8) {
      // For key IDs, mask middle part
      return this.maskSensitiveData(keyId);
    }
    
    return '[REDACTED]';
  }

  /**
   * Send critical logs to security monitoring system
   */
  private sendToSecurityLog(logEntry: any): void {
    try {
      // In a production environment, you might send to:
      // - AWS Security Hub
      // - SIEM system
      // - Security monitoring service
      // - Dedicated security log stream
      
      // For now, we'll just ensure it's marked for security attention
      console.log(JSON.stringify({
        ...logEntry,
        securityAlert: true,
        priority: 'HIGH'
      }));
      
    } catch (error) {
      // Fallback logging - never let logging errors break the application
      console.error('Failed to send security log:', error);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export utility functions for structured logging
export const createLogContext = (
  correlationId?: string,
  tenantId?: string,
  operation?: string
): LogContext => ({
  correlationId,
  tenantId,
  operation,
  component: 'kms-encryption'
});

export const logExecutionTime = async <T>(
  operation: string,
  fn: () => Promise<T>,
  context: LogContext = {}
): Promise<T> => {
  const startTime = Date.now();
  const operationContext = { ...context, operation };
  
  logger.info(`Starting operation: ${operation}`, operationContext);
  
  try {
    const result = await fn();
    const executionTime = Date.now() - startTime;
    
    logger.metric('operation_duration', executionTime, 'Milliseconds', operationContext);
    logger.info(`Completed operation: ${operation}`, {
      ...operationContext,
      executionTime,
      success: true
    });
    
    return result;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error(`Failed operation: ${operation}`, {
      ...operationContext,
      executionTime,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    throw error;
  }
};

export const logSecurityEvent = (
  event: string,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  context: LogContext = {}
): void => {
  logger.security(`Security event: ${event}`, {
    ...context,
    severity,
    eventCategory: 'SECURITY_EVENT'
  });
};

export const logComplianceEvent = (
  framework: string,
  control: string,
  status: 'PASS' | 'FAIL' | 'WARNING',
  context: LogContext = {}
): void => {
  logger.compliance(`Compliance check: ${framework} - ${control}`, {
    ...context,
    framework,
    control,
    status,
    eventCategory: 'COMPLIANCE_CHECK'
  });
};
