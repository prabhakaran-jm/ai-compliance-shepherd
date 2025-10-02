/**
 * Type definitions for EventBridge event processing
 */

export interface EventProcessorRequest {
  eventType: string;
  tenantId: string;
  parameters?: Record<string, any>;
  triggeredBy?: string;
  processImmediately?: boolean;
}

export interface EventProcessorResponse {
  eventId: string;
  eventType: string;
  tenantId: string;
  status: 'TRIGGERED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  triggeredAt: string;
  completedAt?: string;
  correlationId: string;
  result?: any;
  error?: string;
}

export interface EventHistoryRequest {
  tenantId?: string;
  eventType?: string;
  status?: 'TRIGGERED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  startDate?: string;
  endDate?: string;
  limit?: number;
  nextToken?: string;
}

export interface ComplianceEvent {
  eventId: string;
  eventType: string;
  tenantId: string;
  status: 'TRIGGERED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  triggeredAt: string;
  completedAt?: string;
  source: string;
  correlationId: string;
  parameters?: Record<string, any>;
  result?: any;
  error?: string;
  retryCount?: number;
  nextRetryAt?: string;
}

export interface EventRule {
  ruleId: string;
  ruleName: string;
  description: string;
  eventPattern: EventPattern;
  targets: EventTarget[];
  state: 'ENABLED' | 'DISABLED';
  tenantId?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
}

export interface EventPattern {
  source?: string[];
  'detail-type'?: string[];
  detail?: Record<string, any>;
  account?: string[];
  region?: string[];
  time?: {
    prefix?: string;
    range?: {
      start: string;
      end: string;
    };
  };
}

export interface EventTarget {
  id: string;
  arn: string;
  roleArn?: string;
  input?: string;
  inputPath?: string;
  inputTransformer?: {
    inputPathsMap?: Record<string, string>;
    inputTemplate: string;
  };
  kmsKeyId?: string;
  retryPolicy?: {
    maximumRetryAttempts?: number;
    maximumEventAge?: number;
  };
  deadLetterConfig?: {
    arn?: string;
  };
}

export interface EventMetrics {
  eventType: string;
  tenantId?: string;
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  averageProcessingTime: number;
  errorRate: number;
  lastEventTime?: string;
  eventsPerHour: number;
  eventsPerDay: number;
}

export interface EventAlert {
  alertId: string;
  eventType: string;
  tenantId?: string;
  alertType: 'HIGH_ERROR_RATE' | 'PROCESSING_TIMEOUT' | 'UNUSUAL_VOLUME' | 'SYSTEM_ERROR';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  triggeredAt: string;
  threshold?: number;
  currentValue?: number;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface EventBatch {
  batchId: string;
  events: ComplianceEvent[];
  batchType: 'SCHEDULED' | 'MANUAL' | 'TRIGGERED';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  results?: {
    successful: number;
    failed: number;
    errors: Array<{
      eventId: string;
      error: string;
    }>;
  };
}

export interface EventFilter {
  filterId: string;
  name: string;
  description: string;
  eventPattern: EventPattern;
  action: 'ALLOW' | 'DENY' | 'TRANSFORM';
  transformation?: {
    inputTemplate: string;
    inputPathsMap?: Record<string, string>;
  };
  priority: number;
  enabled: boolean;
  tenantId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface EventArchive {
  archiveId: string;
  archiveName: string;
  description?: string;
  eventSourceArn: string;
  eventPattern?: EventPattern;
  retentionDays: number;
  state: 'ENABLED' | 'DISABLED' | 'CREATING' | 'UPDATING';
  createdAt: string;
  sizeBytes?: number;
  eventCount?: number;
}

export interface EventReplay {
  replayId: string;
  replayName: string;
  description?: string;
  eventSourceArn: string;
  archiveName: string;
  eventStartTime: string;
  eventEndTime: string;
  destination: {
    arn: string;
    filterArns?: string[];
  };
  state: 'STARTING' | 'RUNNING' | 'CANCELLING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  replayedEventCount?: number;
}

export interface CustomEvent {
  eventId: string;
  source: string;
  detailType: string;
  detail: Record<string, any>;
  time: string;
  region: string;
  account: string;
  resources?: string[];
}

export interface EventSubscription {
  subscriptionId: string;
  tenantId: string;
  eventTypes: string[];
  deliveryMethod: 'WEBHOOK' | 'EMAIL' | 'SNS' | 'SQS';
  endpoint: string;
  filters?: EventPattern;
  enabled: boolean;
  createdAt: string;
  updatedAt?: string;
  lastDeliveryAt?: string;
  deliveryCount: number;
  failureCount: number;
}

export interface EventWebhook {
  webhookId: string;
  subscriptionId: string;
  eventId: string;
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
  payload: string;
  status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'RETRYING';
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  deliveredAt?: string;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  error?: string;
}
