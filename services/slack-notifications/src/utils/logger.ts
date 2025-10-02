/**
 * Structured JSON logger for Slack notifications service
 */

export interface LogContext {
  correlationId?: string;
  tenantId?: string;
  notificationId?: string;
  eventType?: string;
  channel?: string;
  messageId?: string;
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
  private serviceName = 'slack-notifications';

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

  // Convenience methods for common Slack operations
  slackConfigured(tenantId: string, channelCount: number, correlationId?: string): void {
    this.info('Slack integration configured', {
      correlationId,
      tenantId,
      channelCount,
      operation: 'SLACK_CONFIGURE'
    });
  }

  slackConfigurationUpdated(tenantId: string, updateKeys: string[], correlationId?: string): void {
    this.info('Slack configuration updated', {
      correlationId,
      tenantId,
      updateKeys,
      operation: 'SLACK_CONFIG_UPDATE'
    });
  }

  slackConfigurationDeleted(tenantId: string, correlationId?: string): void {
    this.info('Slack configuration deleted', {
      correlationId,
      tenantId,
      operation: 'SLACK_CONFIG_DELETE'
    });
  }

  notificationSent(
    tenantId: string,
    eventType: string,
    channel: string,
    messageId: string,
    correlationId?: string
  ): void {
    this.info('Slack notification sent', {
      correlationId,
      tenantId,
      eventType,
      channel,
      messageId,
      operation: 'NOTIFICATION_SENT'
    });
  }

  notificationFailed(
    tenantId: string,
    eventType: string,
    channel: string,
    error: Error,
    correlationId?: string
  ): void {
    this.error('Slack notification failed', {
      correlationId,
      tenantId,
      eventType,
      channel,
      operation: 'NOTIFICATION_FAILED'
    }, error);
  }

  eventProcessingStarted(eventType: string, tenantId: string, correlationId?: string): void {
    this.info('Event processing started', {
      correlationId,
      eventType,
      tenantId,
      operation: 'EVENT_PROCESSING_START'
    });
  }

  eventProcessingCompleted(eventType: string, tenantId: string, correlationId?: string): void {
    this.info('Event processing completed', {
      correlationId,
      eventType,
      tenantId,
      operation: 'EVENT_PROCESSING_COMPLETE'
    });
  }

  eventProcessingSkipped(eventType: string, tenantId: string, reason: string, correlationId?: string): void {
    this.debug('Event processing skipped', {
      correlationId,
      eventType,
      tenantId,
      reason,
      operation: 'EVENT_PROCESSING_SKIPPED'
    });
  }

  templateRendered(templateName: string, dataKeys: string[], correlationId?: string): void {
    this.debug('Template rendered', {
      correlationId,
      templateName,
      dataKeys,
      operation: 'TEMPLATE_RENDER'
    });
  }

  templateRenderFailed(templateName: string, error: Error, correlationId?: string): void {
    this.error('Template render failed', {
      correlationId,
      templateName,
      operation: 'TEMPLATE_RENDER_FAILED'
    }, error);
  }

  slackTokenValidated(tenantId: string, teamId: string, userId: string, correlationId?: string): void {
    this.debug('Slack token validated', {
      correlationId,
      tenantId,
      teamId,
      userId,
      operation: 'TOKEN_VALIDATION'
    });
  }

  slackTokenValidationFailed(tenantId: string, error: Error, correlationId?: string): void {
    this.error('Slack token validation failed', {
      correlationId,
      tenantId,
      operation: 'TOKEN_VALIDATION_FAILED'
    }, error);
  }

  messageBuilt(messageType: string, tenantId: string, correlationId?: string): void {
    this.debug('Slack message built', {
      correlationId,
      messageType,
      tenantId,
      operation: 'MESSAGE_BUILD'
    });
  }

  channelMessageSent(tenantId: string, channel: string, messageType: string, correlationId?: string): void {
    this.debug('Message sent to channel', {
      correlationId,
      tenantId,
      channel,
      messageType,
      operation: 'CHANNEL_MESSAGE_SENT'
    });
  }

  channelMessageFailed(tenantId: string, channel: string, error: Error, correlationId?: string): void {
    this.error('Failed to send message to channel', {
      correlationId,
      tenantId,
      channel,
      operation: 'CHANNEL_MESSAGE_FAILED'
    }, error);
  }

  notificationHistoryRecorded(notificationId: string, tenantId: string, eventType: string, correlationId?: string): void {
    this.debug('Notification history recorded', {
      correlationId,
      notificationId,
      tenantId,
      eventType,
      operation: 'HISTORY_RECORD'
    });
  }

  notificationHistoryFailed(tenantId: string, eventType: string, error: Error, correlationId?: string): void {
    this.warn('Failed to record notification history', {
      correlationId,
      tenantId,
      eventType,
      operation: 'HISTORY_RECORD_FAILED'
    }, error);
  }

  testNotificationSent(tenantId: string, channel: string, messageId: string, correlationId?: string): void {
    this.info('Test notification sent', {
      correlationId,
      tenantId,
      channel,
      messageId,
      operation: 'TEST_NOTIFICATION'
    });
  }

  welcomeMessageSent(tenantId: string, channelCount: number, correlationId?: string): void {
    this.info('Welcome message sent', {
      correlationId,
      tenantId,
      channelCount,
      operation: 'WELCOME_MESSAGE'
    });
  }

  welcomeMessageFailed(tenantId: string, error: Error, correlationId?: string): void {
    this.warn('Failed to send welcome message', {
      correlationId,
      tenantId,
      operation: 'WELCOME_MESSAGE_FAILED'
    }, error);
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

  // Rate limiting logging
  rateLimitHit(tenantId: string, channel: string, retryAfter: number, correlationId?: string): void {
    this.warn('Slack rate limit hit', {
      correlationId,
      tenantId,
      channel,
      retryAfter,
      operation: 'RATE_LIMIT_HIT'
    });
  }

  rateLimitRecovered(tenantId: string, channel: string, correlationId?: string): void {
    this.info('Slack rate limit recovered', {
      correlationId,
      tenantId,
      channel,
      operation: 'RATE_LIMIT_RECOVERED'
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

  // Batch processing logging
  batchProcessingStarted(batchId: string, itemCount: number, correlationId?: string): void {
    this.info('Batch processing started', {
      correlationId,
      batchId,
      itemCount,
      operation: 'BATCH_PROCESSING_START'
    });
  }

  batchProcessingCompleted(batchId: string, successCount: number, failureCount: number, correlationId?: string): void {
    this.info('Batch processing completed', {
      correlationId,
      batchId,
      successCount,
      failureCount,
      operation: 'BATCH_PROCESSING_COMPLETE'
    });
  }

  // Queue processing logging
  queueProcessingStarted(queueName: string, messageCount: number, correlationId?: string): void {
    this.info('Queue processing started', {
      correlationId,
      queueName,
      messageCount,
      operation: 'QUEUE_PROCESSING_START'
    });
  }

  queueProcessingCompleted(queueName: string, processedCount: number, correlationId?: string): void {
    this.info('Queue processing completed', {
      correlationId,
      queueName,
      processedCount,
      operation: 'QUEUE_PROCESSING_COMPLETE'
    });
  }

  // Retry logging
  retryAttempt(operation: string, attempt: number, maxAttempts: number, correlationId?: string): void {
    this.warn('Retry attempt', {
      correlationId,
      operation,
      attempt,
      maxAttempts,
      operation: 'RETRY_ATTEMPT'
    });
  }

  retryExhausted(operation: string, maxAttempts: number, correlationId?: string): void {
    this.error('Retry attempts exhausted', {
      correlationId,
      operation,
      maxAttempts,
      operation: 'RETRY_EXHAUSTED'
    });
  }

  // Circuit breaker logging
  circuitBreakerOpened(service: string, failureCount: number, correlationId?: string): void {
    this.warn('Circuit breaker opened', {
      correlationId,
      service,
      failureCount,
      operation: 'CIRCUIT_BREAKER_OPENED'
    });
  }

  circuitBreakerClosed(service: string, correlationId?: string): void {
    this.info('Circuit breaker closed', {
      correlationId,
      service,
      operation: 'CIRCUIT_BREAKER_CLOSED'
    });
  }
}

export const logger = new Logger();
