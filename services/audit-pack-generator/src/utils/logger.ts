/**
 * Structured JSON logger for audit pack generator
 */

export interface LogContext {
  correlationId?: string;
  auditPackId?: string;
  tenantId?: string;
  framework?: string;
  operation?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  service: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private serviceName = 'audit-pack-generator';

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
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private log(entry: LogEntry): void {
    // In production, this would integrate with CloudWatch Logs
    // For now, output to console with structured JSON
    console.log(JSON.stringify(entry));
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      this.log(this.createLogEntry('DEBUG', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    this.log(this.createLogEntry('INFO', message, context));
  }

  warn(message: string, context?: LogContext): void {
    this.log(this.createLogEntry('WARN', message, context));
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log(this.createLogEntry('ERROR', message, context, error));
  }

  // Convenience methods for common audit pack operations
  auditPackStarted(auditPackId: string, tenantId: string, framework: string, correlationId?: string): void {
    this.info('Audit pack generation started', {
      correlationId,
      auditPackId,
      tenantId,
      framework,
      operation: 'AUDIT_PACK_START'
    });
  }

  auditPackCompleted(auditPackId: string, tenantId: string, duration: number, correlationId?: string): void {
    this.info('Audit pack generation completed', {
      correlationId,
      auditPackId,
      tenantId,
      duration,
      operation: 'AUDIT_PACK_COMPLETE'
    });
  }

  auditPackFailed(auditPackId: string, tenantId: string, error: Error, correlationId?: string): void {
    this.error('Audit pack generation failed', {
      correlationId,
      auditPackId,
      tenantId,
      operation: 'AUDIT_PACK_FAILED'
    }, error);
  }

  evidenceCollectionStarted(auditPackId: string, evidenceType: string, correlationId?: string): void {
    this.info('Evidence collection started', {
      correlationId,
      auditPackId,
      evidenceType,
      operation: 'EVIDENCE_COLLECTION_START'
    });
  }

  evidenceCollectionCompleted(auditPackId: string, evidenceType: string, count: number, correlationId?: string): void {
    this.info('Evidence collection completed', {
      correlationId,
      auditPackId,
      evidenceType,
      evidenceCount: count,
      operation: 'EVIDENCE_COLLECTION_COMPLETE'
    });
  }

  reportGenerationStarted(auditPackId: string, reportType: string, correlationId?: string): void {
    this.info('Report generation started', {
      correlationId,
      auditPackId,
      reportType,
      operation: 'REPORT_GENERATION_START'
    });
  }

  reportGenerationCompleted(auditPackId: string, reportType: string, correlationId?: string): void {
    this.info('Report generation completed', {
      correlationId,
      auditPackId,
      reportType,
      operation: 'REPORT_GENERATION_COMPLETE'
    });
  }

  packageBuildStarted(auditPackId: string, correlationId?: string): void {
    this.info('Package build started', {
      correlationId,
      auditPackId,
      operation: 'PACKAGE_BUILD_START'
    });
  }

  packageBuildCompleted(auditPackId: string, packageSize: string, correlationId?: string): void {
    this.info('Package build completed', {
      correlationId,
      auditPackId,
      packageSize,
      operation: 'PACKAGE_BUILD_COMPLETE'
    });
  }

  s3UploadStarted(auditPackId: string, bucketName: string, objectKey: string, correlationId?: string): void {
    this.info('S3 upload started', {
      correlationId,
      auditPackId,
      bucketName,
      objectKey,
      operation: 'S3_UPLOAD_START'
    });
  }

  s3UploadCompleted(auditPackId: string, bucketName: string, objectKey: string, correlationId?: string): void {
    this.info('S3 upload completed', {
      correlationId,
      auditPackId,
      bucketName,
      objectKey,
      operation: 'S3_UPLOAD_COMPLETE'
    });
  }

  complianceAnalysisStarted(auditPackId: string, framework: string, correlationId?: string): void {
    this.info('Compliance analysis started', {
      correlationId,
      auditPackId,
      framework,
      operation: 'COMPLIANCE_ANALYSIS_START'
    });
  }

  complianceAnalysisCompleted(auditPackId: string, framework: string, score: number, correlationId?: string): void {
    this.info('Compliance analysis completed', {
      correlationId,
      auditPackId,
      framework,
      complianceScore: score,
      operation: 'COMPLIANCE_ANALYSIS_COMPLETE'
    });
  }

  progressUpdate(auditPackId: string, step: string, percentage: number, correlationId?: string): void {
    this.info('Audit pack progress update', {
      correlationId,
      auditPackId,
      currentStep: step,
      percentage,
      operation: 'PROGRESS_UPDATE'
    });
  }

  // Performance logging
  performanceMetric(operation: string, duration: number, context?: LogContext): void {
    this.info('Performance metric', {
      ...context,
      operation,
      duration,
      metric: 'PERFORMANCE'
    });
  }

  // Security logging
  securityEvent(event: string, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', context?: LogContext): void {
    this.warn('Security event', {
      ...context,
      securityEvent: event,
      severity,
      metric: 'SECURITY'
    });
  }

  // Business metrics
  businessMetric(metric: string, value: number, unit?: string, context?: LogContext): void {
    this.info('Business metric', {
      ...context,
      metric,
      value,
      unit,
      type: 'BUSINESS_METRIC'
    });
  }

  // API request logging
  apiRequest(method: string, path: string, statusCode: number, duration: number, correlationId?: string): void {
    this.info('API request', {
      correlationId,
      httpMethod: method,
      path,
      statusCode,
      duration,
      operation: 'API_REQUEST'
    });
  }

  // Database operation logging
  databaseOperation(operation: string, table: string, duration: number, correlationId?: string): void {
    this.debug('Database operation', {
      correlationId,
      dbOperation: operation,
      table,
      duration,
      operation: 'DATABASE'
    });
  }

  // External service call logging
  externalServiceCall(service: string, operation: string, duration: number, success: boolean, correlationId?: string): void {
    this.info('External service call', {
      correlationId,
      externalService: service,
      operation,
      duration,
      success,
      type: 'EXTERNAL_SERVICE'
    });
  }

  // Validation logging
  validationError(field: string, value: any, rule: string, correlationId?: string): void {
    this.warn('Validation error', {
      correlationId,
      validationField: field,
      value,
      rule,
      operation: 'VALIDATION_ERROR'
    });
  }

  // Configuration logging
  configurationLoaded(configKey: string, source: string): void {
    this.debug('Configuration loaded', {
      configKey,
      source,
      operation: 'CONFIG_LOAD'
    });
  }

  // Health check logging
  healthCheck(component: string, status: 'HEALTHY' | 'UNHEALTHY', details?: any): void {
    const level = status === 'HEALTHY' ? 'INFO' : 'WARN';
    this[level.toLowerCase() as 'info' | 'warn']('Health check', {
      component,
      status,
      details,
      operation: 'HEALTH_CHECK'
    });
  }

  // Resource usage logging
  resourceUsage(resource: string, usage: number, limit?: number, unit?: string): void {
    this.debug('Resource usage', {
      resource,
      usage,
      limit,
      unit,
      utilizationPercentage: limit ? Math.round((usage / limit) * 100) : undefined,
      operation: 'RESOURCE_USAGE'
    });
  }

  // Audit trail logging
  auditTrail(action: string, resourceId: string, userId?: string, details?: any, correlationId?: string): void {
    this.info('Audit trail', {
      correlationId,
      auditAction: action,
      resourceId,
      userId,
      details,
      operation: 'AUDIT_TRAIL'
    });
  }
}

export const logger = new Logger();
