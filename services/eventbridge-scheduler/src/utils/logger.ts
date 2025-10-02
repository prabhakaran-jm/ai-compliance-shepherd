/**
 * Structured logging utility for EventBridge Scheduler
 */

export interface LogContext {
  correlationId?: string;
  tenantId?: string;
  scheduleId?: string;
  eventId?: string;
  eventType?: string;
  source?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  service: string;
  version: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private serviceName: string;
  private version: string;
  private logLevel: string;

  constructor() {
    this.serviceName = 'eventbridge-scheduler';
    this.version = process.env.SERVICE_VERSION || '1.0.0';
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
  }

  private shouldLog(level: string): boolean {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private createLogEntry(
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      version: this.version
    };

    if (context) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    return entry;
  }

  private log(entry: LogEntry): void {
    if (this.shouldLog(entry.level)) {
      console.log(JSON.stringify(entry));
    }
  }

  debug(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('DEBUG', message, context);
    this.log(entry);
  }

  info(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('INFO', message, context);
    this.log(entry);
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    const entry = this.createLogEntry('WARN', message, context, error);
    this.log(entry);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    const entry = this.createLogEntry('ERROR', message, context, error);
    this.log(entry);
  }

  // Convenience methods for common logging scenarios
  scheduleCreated(scheduleId: string, scheduleName: string, context?: LogContext): void {
    this.info('Schedule created', {
      ...context,
      scheduleId,
      scheduleName,
      action: 'SCHEDULE_CREATED'
    });
  }

  scheduleUpdated(scheduleId: string, scheduleName: string, context?: LogContext): void {
    this.info('Schedule updated', {
      ...context,
      scheduleId,
      scheduleName,
      action: 'SCHEDULE_UPDATED'
    });
  }

  scheduleDeleted(scheduleId: string, scheduleName: string, context?: LogContext): void {
    this.info('Schedule deleted', {
      ...context,
      scheduleId,
      scheduleName,
      action: 'SCHEDULE_DELETED'
    });
  }

  scheduleExecuted(scheduleId: string, scheduleName: string, executionId: string, context?: LogContext): void {
    this.info('Schedule executed', {
      ...context,
      scheduleId,
      scheduleName,
      executionId,
      action: 'SCHEDULE_EXECUTED'
    });
  }

  eventProcessed(eventId: string, eventType: string, status: string, context?: LogContext): void {
    this.info('Event processed', {
      ...context,
      eventId,
      eventType,
      status,
      action: 'EVENT_PROCESSED'
    });
  }

  eventFailed(eventId: string, eventType: string, error: Error, context?: LogContext): void {
    this.error('Event processing failed', {
      ...context,
      eventId,
      eventType,
      action: 'EVENT_FAILED'
    }, error);
  }

  workflowTriggered(workflowType: string, executionArn: string, context?: LogContext): void {
    this.info('Workflow triggered', {
      ...context,
      workflowType,
      executionArn,
      action: 'WORKFLOW_TRIGGERED'
    });
  }

  complianceCheckTriggered(checkType: string, resourceId: string, context?: LogContext): void {
    this.info('Compliance check triggered', {
      ...context,
      checkType,
      resourceId,
      action: 'COMPLIANCE_CHECK_TRIGGERED'
    });
  }

  notificationSent(notificationType: string, recipient: string, context?: LogContext): void {
    this.info('Notification sent', {
      ...context,
      notificationType,
      recipient,
      action: 'NOTIFICATION_SENT'
    });
  }

  apiRequest(method: string, path: string, statusCode: number, duration: number, context?: LogContext): void {
    this.info('API request processed', {
      ...context,
      httpMethod: method,
      path,
      statusCode,
      duration,
      action: 'API_REQUEST'
    });
  }

  auditLog(action: string, resourceType: string, resourceId: string, performedBy: string, context?: LogContext): void {
    this.info('Audit log entry', {
      ...context,
      action,
      resourceType,
      resourceId,
      performedBy,
      auditAction: action
    });
  }

  securityEvent(eventType: string, severity: string, details: any, context?: LogContext): void {
    this.warn('Security event detected', {
      ...context,
      securityEventType: eventType,
      severity,
      details,
      action: 'SECURITY_EVENT'
    });
  }

  performanceMetric(operation: string, duration: number, success: boolean, context?: LogContext): void {
    this.info('Performance metric', {
      ...context,
      operation,
      duration,
      success,
      action: 'PERFORMANCE_METRIC'
    });
  }

  resourceUsage(resourceType: string, usage: any, context?: LogContext): void {
    this.debug('Resource usage', {
      ...context,
      resourceType,
      usage,
      action: 'RESOURCE_USAGE'
    });
  }

  configurationChange(configType: string, oldValue: any, newValue: any, context?: LogContext): void {
    this.info('Configuration changed', {
      ...context,
      configType,
      oldValue,
      newValue,
      action: 'CONFIGURATION_CHANGE'
    });
  }

  healthCheck(component: string, status: string, details?: any, context?: LogContext): void {
    const level = status === 'healthy' ? 'INFO' : 'WARN';
    const message = `Health check: ${component} is ${status}`;
    
    if (level === 'INFO') {
      this.info(message, {
        ...context,
        component,
        healthStatus: status,
        details,
        action: 'HEALTH_CHECK'
      });
    } else {
      this.warn(message, {
        ...context,
        component,
        healthStatus: status,
        details,
        action: 'HEALTH_CHECK'
      });
    }
  }
}

export const logger = new Logger();
