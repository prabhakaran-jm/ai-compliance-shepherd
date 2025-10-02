/**
 * Structured logging utility for Tenant Management
 */

export interface LogContext {
  correlationId?: string;
  tenantId?: string;
  userId?: string;
  organizationId?: string;
  operation?: string;
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
    this.serviceName = 'tenant-management';
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

  // Convenience methods for tenant operations
  tenantCreated(tenantId: string, tenantName: string, context?: LogContext): void {
    this.info('Tenant created', {
      ...context,
      tenantId,
      tenantName,
      action: 'TENANT_CREATED'
    });
  }

  tenantUpdated(tenantId: string, tenantName: string, context?: LogContext): void {
    this.info('Tenant updated', {
      ...context,
      tenantId,
      tenantName,
      action: 'TENANT_UPDATED'
    });
  }

  tenantDeleted(tenantId: string, tenantName: string, context?: LogContext): void {
    this.info('Tenant deleted', {
      ...context,
      tenantId,
      tenantName,
      action: 'TENANT_DELETED'
    });
  }

  tenantOnboarded(tenantId: string, onboardingId: string, duration: number, context?: LogContext): void {
    this.info('Tenant onboarded', {
      ...context,
      tenantId,
      onboardingId,
      duration,
      action: 'TENANT_ONBOARDED'
    });
  }

  tenantOffboarded(tenantId: string, offboardingId: string, duration: number, context?: LogContext): void {
    this.info('Tenant offboarded', {
      ...context,
      tenantId,
      offboardingId,
      duration,
      action: 'TENANT_OFFBOARDED'
    });
  }

  isolationValidated(tenantId: string, status: string, score: number, context?: LogContext): void {
    this.info('Tenant isolation validated', {
      ...context,
      tenantId,
      isolationStatus: status,
      isolationScore: score,
      action: 'ISOLATION_VALIDATED'
    });
  }

  securityViolation(tenantId: string, violationType: string, severity: string, context?: LogContext): void {
    this.warn('Security violation detected', {
      ...context,
      tenantId,
      violationType,
      severity,
      action: 'SECURITY_VIOLATION'
    });
  }

  resourceCreated(tenantId: string, resourceType: string, resourceId: string, context?: LogContext): void {
    this.info('Tenant resource created', {
      ...context,
      tenantId,
      resourceType,
      resourceId,
      action: 'RESOURCE_CREATED'
    });
  }

  resourceDeleted(tenantId: string, resourceType: string, resourceId: string, context?: LogContext): void {
    this.info('Tenant resource deleted', {
      ...context,
      tenantId,
      resourceType,
      resourceId,
      action: 'RESOURCE_DELETED'
    });
  }

  configurationChanged(tenantId: string, configType: string, oldValue: any, newValue: any, context?: LogContext): void {
    this.info('Tenant configuration changed', {
      ...context,
      tenantId,
      configType,
      oldValue,
      newValue,
      action: 'CONFIGURATION_CHANGED'
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

  auditLog(tenantId: string, action: string, resourceType: string, resourceId: string, performedBy: string, context?: LogContext): void {
    this.info('Audit log entry', {
      ...context,
      tenantId,
      action,
      resourceType,
      resourceId,
      performedBy,
      auditAction: action
    });
  }

  complianceCheck(tenantId: string, framework: string, score: number, status: string, context?: LogContext): void {
    this.info('Compliance check completed', {
      ...context,
      tenantId,
      complianceFramework: framework,
      complianceScore: score,
      complianceStatus: status,
      action: 'COMPLIANCE_CHECK'
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

  resourceUsage(tenantId: string, resourceType: string, usage: any, context?: LogContext): void {
    this.debug('Resource usage', {
      ...context,
      tenantId,
      resourceType,
      usage,
      action: 'RESOURCE_USAGE'
    });
  }

  billingEvent(tenantId: string, eventType: string, amount: number, currency: string, context?: LogContext): void {
    this.info('Billing event', {
      ...context,
      tenantId,
      billingEventType: eventType,
      amount,
      currency,
      action: 'BILLING_EVENT'
    });
  }

  healthCheck(component: string, status: string, responseTime: number, context?: LogContext): void {
    const level = status === 'HEALTHY' ? 'INFO' : 'WARN';
    const message = `Health check: ${component} is ${status}`;
    
    if (level === 'INFO') {
      this.info(message, {
        ...context,
        component,
        healthStatus: status,
        responseTime,
        action: 'HEALTH_CHECK'
      });
    } else {
      this.warn(message, {
        ...context,
        component,
        healthStatus: status,
        responseTime,
        action: 'HEALTH_CHECK'
      });
    }
  }

  dataExport(tenantId: string, exportId: string, size: string, destination: string, context?: LogContext): void {
    this.info('Data export completed', {
      ...context,
      tenantId,
      exportId,
      exportSize: size,
      exportDestination: destination,
      action: 'DATA_EXPORT'
    });
  }

  backupCreated(tenantId: string, backupId: string, type: string, size: number, context?: LogContext): void {
    this.info('Backup created', {
      ...context,
      tenantId,
      backupId,
      backupType: type,
      backupSize: size,
      action: 'BACKUP_CREATED'
    });
  }

  restoreCompleted(tenantId: string, restoreId: string, backupId: string, itemsRestored: number, context?: LogContext): void {
    this.info('Restore completed', {
      ...context,
      tenantId,
      restoreId,
      backupId,
      itemsRestored,
      action: 'RESTORE_COMPLETED'
    });
  }
}

export const logger = new Logger();
