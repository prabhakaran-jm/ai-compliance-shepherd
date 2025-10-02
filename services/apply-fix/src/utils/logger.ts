/**
 * Structured logging utility for apply-fix service
 * Provides consistent JSON logging with correlation IDs and metadata
 */

export interface LogContext {
  correlationId?: string;
  remediationId?: string;
  findingId?: string;
  resourceId?: string;
  resourceType?: string;
  remediationType?: string;
  userId?: string;
  tenantId?: string;
  accountId?: string;
  region?: string;
  [key: string]: any;
}

export class Logger {
  private serviceName: string;
  private environment: string;

  constructor() {
    this.serviceName = 'apply-fix';
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
   * Log remediation operation start
   */
  logRemediationStart(
    remediationId: string,
    resourceId: string,
    remediationType: string,
    context?: LogContext
  ): void {
    this.info('Remediation operation started', {
      remediationId,
      resourceId,
      remediationType,
      operation: 'start',
      ...context
    });
  }

  /**
   * Log remediation operation completion
   */
  logRemediationComplete(
    remediationId: string,
    success: boolean,
    duration: number,
    context?: LogContext
  ): void {
    this.info('Remediation operation completed', {
      remediationId,
      success,
      duration,
      operation: 'complete',
      unit: 'ms',
      ...context
    });
  }

  /**
   * Log safety check results
   */
  logSafetyChecks(
    remediationId: string,
    passed: boolean,
    totalChecks: number,
    failedChecks: number,
    context?: LogContext
  ): void {
    this.info('Safety checks completed', {
      remediationId,
      passed,
      totalChecks,
      failedChecks,
      operation: 'safety_check',
      ...context
    });
  }

  /**
   * Log approval request
   */
  logApprovalRequest(
    remediationId: string,
    approvers: string[],
    riskLevel: string,
    context?: LogContext
  ): void {
    this.info('Approval request sent', {
      remediationId,
      approvers,
      riskLevel,
      operation: 'approval_request',
      ...context
    });
  }

  /**
   * Log approval response
   */
  logApprovalResponse(
    remediationId: string,
    approved: boolean,
    approver: string,
    context?: LogContext
  ): void {
    this.info('Approval response received', {
      remediationId,
      approved,
      approver,
      operation: 'approval_response',
      ...context
    });
  }

  /**
   * Log rollback operation
   */
  logRollback(
    remediationId: string,
    success: boolean,
    partialRollback: boolean,
    actionsCount: number,
    context?: LogContext
  ): void {
    this.info('Rollback operation completed', {
      remediationId,
      success,
      partialRollback,
      actionsCount,
      operation: 'rollback',
      ...context
    });
  }

  /**
   * Log AWS API operation
   */
  logAWSOperation(
    service: string,
    operation: string,
    resourceId: string,
    success: boolean,
    context?: LogContext
  ): void {
    this.debug('AWS API operation', {
      service,
      operation,
      resourceId,
      success,
      type: 'aws_api',
      ...context
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(
    operation: string,
    duration: number,
    resourceCount?: number,
    context?: LogContext
  ): void {
    this.info('Performance metric', {
      operation,
      duration,
      resourceCount,
      unit: 'ms',
      type: 'performance',
      ...context
    });
  }

  /**
   * Log security event
   */
  logSecurity(
    event: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    details: any,
    context?: LogContext
  ): void {
    this.warn('Security event', {
      securityEvent: event,
      severity,
      details,
      type: 'security',
      ...context
    });
  }

  /**
   * Log audit event
   */
  logAudit(
    action: string,
    userId: string,
    resourceId: string,
    success: boolean,
    context?: LogContext
  ): void {
    this.info('Audit event', {
      auditAction: action,
      userId,
      resourceId,
      success,
      type: 'audit',
      ...context
    });
  }

  /**
   * Log compliance event
   */
  logCompliance(
    framework: string,
    ruleId: string,
    status: 'PASS' | 'FAIL' | 'SKIP',
    resourceId: string,
    context?: LogContext
  ): void {
    this.info('Compliance check', {
      framework,
      ruleId,
      status,
      resourceId,
      type: 'compliance',
      ...context
    });
  }
}

// Export singleton instance
export const logger = new Logger();
