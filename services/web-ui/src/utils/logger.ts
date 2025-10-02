/**
 * Structured JSON logger for Web UI Service
 * Provides consistent logging across the application
 */

export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  correlationId?: string;
  userId?: string;
  tenantId?: string;
  component: string;
  metadata?: Record<string, any>;
}

class Logger {
  private correlationId?: string;
  private component = 'web-ui';

  /**
   * Set correlation ID for request tracking
   */
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  /**
   * Clear correlation ID
   */
  clearCorrelationId(): void {
    this.correlationId = undefined;
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log('DEBUG', message, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log('INFO', message, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log('WARN', message, metadata);
  }

  /**
   * Log error message
   */
  error(message: string, metadata?: Record<string, any>): void {
    this.log('ERROR', message, metadata);
  }

  /**
   * Core logging method
   */
  private log(level: LogEntry['level'], message: string, metadata?: Record<string, any>): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component: this.component,
      correlationId: this.correlationId
    };

    // Extract common fields from metadata
    if (metadata) {
      const { userId, tenantId, ...rest } = metadata;
      
      if (userId) logEntry.userId = userId;
      if (tenantId) logEntry.tenantId = tenantId;
      
      if (Object.keys(rest).length > 0) {
        logEntry.metadata = rest;
      }
    }

    // Sanitize sensitive data
    this.sanitizeLogEntry(logEntry);

    // Output structured JSON
    console.log(JSON.stringify(logEntry));
  }

  /**
   * Sanitize sensitive information from log entries
   */
  private sanitizeLogEntry(entry: LogEntry): void {
    if (entry.metadata) {
      // Remove or mask sensitive fields
      const sensitiveFields = [
        'password', 'token', 'apiKey', 'secret', 'authorization',
        'cookie', 'session', 'credentials', 'key', 'signature'
      ];

      this.sanitizeObject(entry.metadata, sensitiveFields);
    }
  }

  /**
   * Recursively sanitize object properties
   */
  private sanitizeObject(obj: any, sensitiveFields: string[]): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const lowerKey = key.toLowerCase();
        
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          this.sanitizeObject(obj[key], sensitiveFields);
        }
      }
    }
  }

  /**
   * Create child logger with specific component name
   */
  child(component: string): Logger {
    const childLogger = new Logger();
    childLogger.component = `${this.component}:${component}`;
    childLogger.correlationId = this.correlationId;
    return childLogger;
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, metadata?: Record<string, any>): void {
    this.info(`Performance: ${operation}`, {
      ...metadata,
      duration_ms: duration,
      performance: true
    });
  }

  /**
   * Log business metrics
   */
  metric(name: string, value: number, unit?: string, metadata?: Record<string, any>): void {
    this.info(`Metric: ${name}`, {
      ...metadata,
      metric_name: name,
      metric_value: value,
      metric_unit: unit || 'count',
      metric: true
    });
  }

  /**
   * Log user action
   */
  userAction(action: string, userId: string, tenantId: string, metadata?: Record<string, any>): void {
    this.info(`User action: ${action}`, {
      ...metadata,
      userId,
      tenantId,
      action,
      user_action: true
    });
  }

  /**
   * Log API request
   */
  apiRequest(method: string, path: string, statusCode: number, duration: number, metadata?: Record<string, any>): void {
    const level = statusCode >= 400 ? 'ERROR' : statusCode >= 300 ? 'WARN' : 'INFO';
    
    this.log(level, `${method} ${path} ${statusCode}`, {
      ...metadata,
      http_method: method,
      http_path: path,
      http_status: statusCode,
      duration_ms: duration,
      api_request: true
    });
  }

  /**
   * Log security event
   */
  security(event: string, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', metadata?: Record<string, any>): void {
    this.warn(`Security event: ${event}`, {
      ...metadata,
      security_event: event,
      security_severity: severity,
      security: true
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export utility function for request correlation
export function withCorrelationId<T>(correlationId: string, fn: () => T): T {
  logger.setCorrelationId(correlationId);
  try {
    return fn();
  } finally {
    logger.clearCorrelationId();
  }
}
