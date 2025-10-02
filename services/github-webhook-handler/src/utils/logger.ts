/**
 * Structured logging utility for GitHub webhook handler
 * Provides consistent JSON logging with correlation IDs and metadata
 */

export interface LogContext {
  correlationId?: string;
  event?: string;
  delivery?: string;
  repository?: string;
  pullRequest?: number;
  owner?: string;
  repo?: string;
  sha?: string;
  branch?: string;
  action?: string;
  [key: string]: any;
}

export class Logger {
  private serviceName: string;
  private environment: string;

  constructor() {
    this.serviceName = 'github-webhook-handler';
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
   * Log GitHub webhook event details
   */
  logWebhookEvent(event: string, delivery: string, payload: any, context?: LogContext): void {
    this.info('GitHub webhook event received', {
      event,
      delivery,
      repository: payload.repository?.full_name,
      action: payload.action,
      pullRequest: payload.pull_request?.number,
      sender: payload.sender?.login,
      ...context
    });
  }

  /**
   * Log GitHub API operation
   */
  logGitHubAPI(operation: string, params: any, context?: LogContext): void {
    this.debug('GitHub API operation', {
      operation,
      params: {
        owner: params.owner,
        repo: params.repo,
        issue_number: params.issue_number,
        ref: params.ref
      },
      ...context
    });
  }

  /**
   * Log Terraform analysis operation
   */
  logTerraformAnalysis(scanId: string, planSize: number, context?: LogContext): void {
    this.info('Terraform plan analysis started', {
      scanId,
      planSize,
      ...context
    });
  }

  /**
   * Log analysis results
   */
  logAnalysisResults(scanId: string, results: any, context?: LogContext): void {
    this.info('Terraform analysis completed', {
      scanId,
      totalFindings: results.summary?.totalFindings || 0,
      criticalFindings: results.summary?.criticalFindings || 0,
      complianceScore: results.summary?.complianceScore || 0,
      ...context
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation: string, duration: number, context?: LogContext): void {
    this.info('Performance metric', {
      operation,
      duration,
      unit: 'ms',
      ...context
    });
  }

  /**
   * Log security event
   */
  logSecurity(event: string, details: any, context?: LogContext): void {
    this.warn('Security event', {
      securityEvent: event,
      details,
      ...context
    });
  }
}

// Export singleton instance
export const logger = new Logger();
