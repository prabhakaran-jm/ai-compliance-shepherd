/**
 * Type definitions for Slack notifications
 */

export interface SlackConfiguration {
  tenantId: string;
  botToken: string;
  channels?: SlackChannel[];
  enabled: boolean;
  notificationSettings: NotificationSettings;
  createdAt?: string;
  updatedAt?: string;
}

export interface SlackChannel {
  name: string;
  id: string;
  events: string[];
}

export interface NotificationSettings {
  criticalFindings: boolean;
  scanResults: boolean;
  remediationActions: boolean;
  auditPackReady: boolean;
  complianceScoreChanges: boolean;
  scheduledReports: boolean;
}

export interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  channel?: string;
  username?: string;
  icon_emoji?: string;
  icon_url?: string;
  link_names?: boolean;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}

export interface SlackBlock {
  type: string;
  text?: SlackText;
  fields?: SlackText[];
  accessory?: SlackElement;
  elements?: SlackElement[];
}

export interface SlackText {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
}

export interface SlackElement {
  type: string;
  text?: SlackText;
  url?: string;
  action_id?: string;
  style?: 'primary' | 'danger';
  value?: string;
}

export interface SlackAttachment {
  color?: 'good' | 'warning' | 'danger' | string;
  pretext?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: SlackAttachmentField[];
  image_url?: string;
  thumb_url?: string;
  footer?: string;
  footer_icon?: string;
  ts?: number;
  actions?: SlackAction[];
}

export interface SlackAttachmentField {
  title: string;
  value: string;
  short?: boolean;
}

export interface SlackAction {
  type: 'button' | 'select';
  text: string;
  url?: string;
  style?: 'default' | 'primary' | 'danger';
  value?: string;
  confirm?: SlackConfirmation;
}

export interface SlackConfirmation {
  title: string;
  text: string;
  ok_text?: string;
  dismiss_text?: string;
}

export interface ComplianceEvent {
  tenantId: string;
  eventType?: string;
  timestamp?: string;
  
  // Scan-related fields
  scanId?: string;
  scanType?: string;
  findingsCount?: number;
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  
  // Finding-related fields
  findingId?: string;
  title?: string;
  description?: string;
  severity?: string;
  resourceType?: string;
  resourceId?: string;
  
  // Remediation-related fields
  remediationId?: string;
  action?: string;
  status?: string;
  
  // Audit pack-related fields
  auditPackId?: string;
  framework?: string;
  auditType?: string;
  
  // Compliance score-related fields
  complianceScore?: number;
  previousScore?: number;
  changeReason?: string;
  
  // Report-related fields
  reportId?: string;
  reportType?: string;
  
  // Error-related fields
  errorMessage?: string;
  
  // Additional metadata
  metadata?: Record<string, any>;
  
  // Summary fields
  totalFindings?: number;
  criticalFindings?: number;
}

export interface NotificationEvent {
  eventId: string;
  tenantId: string;
  eventType: NotificationEventType;
  eventData: ComplianceEvent;
  timestamp: string;
  processed: boolean;
  retryCount?: number;
  lastRetry?: string;
  error?: string;
}

export type NotificationEventType = 
  | 'SCAN_COMPLETED'
  | 'SCAN_FAILED'
  | 'CRITICAL_FINDING'
  | 'FINDING_RESOLVED'
  | 'REMEDIATION_APPLIED'
  | 'REMEDIATION_FAILED'
  | 'AUDIT_PACK_GENERATED'
  | 'AUDIT_PACK_FAILED'
  | 'COMPLIANCE_SCORE_CHANGED'
  | 'SCHEDULED_REPORT'
  | 'SYSTEM_ALERT'
  | 'CUSTOM_NOTIFICATION'
  | 'TEST_NOTIFICATION';

export interface NotificationHistory {
  notificationId?: string;
  tenantId: string;
  eventType: string;
  channel: string;
  messageId: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  timestamp: string;
  eventData?: any;
  error?: string;
  retryCount?: number;
}

export interface SlackWebhookPayload {
  text: string;
  username?: string;
  icon_emoji?: string;
  icon_url?: string;
  channel?: string;
  attachments?: SlackAttachment[];
  blocks?: SlackBlock[];
}

export interface SlackInteractionPayload {
  type: string;
  user: SlackUser;
  team: SlackTeam;
  channel: SlackChannel;
  message: SlackMessage;
  actions: SlackAction[];
  response_url: string;
  trigger_id: string;
}

export interface SlackUser {
  id: string;
  name: string;
  username: string;
  team_id: string;
}

export interface SlackTeam {
  id: string;
  domain: string;
}

export interface SlackChannelInfo {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
  is_private: boolean;
  is_archived: boolean;
  is_general: boolean;
  is_shared: boolean;
  is_ext_shared: boolean;
  is_org_shared: boolean;
  pending_shared: string[];
  is_pending_ext_shared: boolean;
  is_member: boolean;
  num_members: number;
  topic: {
    value: string;
    creator: string;
    last_set: number;
  };
  purpose: {
    value: string;
    creator: string;
    last_set: number;
  };
}

export interface NotificationTemplate {
  templateId: string;
  name: string;
  description: string;
  eventType: NotificationEventType;
  template: string;
  variables: TemplateVariable[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object';
  required: boolean;
  description?: string;
  defaultValue?: any;
}

export interface NotificationRule {
  ruleId: string;
  tenantId: string;
  name: string;
  description: string;
  eventType: NotificationEventType;
  conditions: NotificationCondition[];
  actions: NotificationAction[];
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'in' | 'not_in';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface NotificationAction {
  type: 'slack_message' | 'email' | 'webhook' | 'sns';
  target: string;
  template?: string;
  parameters?: Record<string, any>;
}

export interface NotificationMetrics {
  tenantId: string;
  date: string;
  totalNotifications: number;
  successfulNotifications: number;
  failedNotifications: number;
  notificationsByType: Record<NotificationEventType, number>;
  notificationsByChannel: Record<string, number>;
  averageDeliveryTime: number;
  retryCount: number;
}

export interface SlackAppConfig {
  appId: string;
  clientId: string;
  clientSecret: string;
  signingSecret: string;
  verificationToken: string;
  redirectUri: string;
  scopes: string[];
}

export interface SlackOAuthResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: {
    id: string;
    name: string;
  };
  enterprise?: {
    id: string;
    name: string;
  };
  authed_user: {
    id: string;
    scope: string;
    access_token: string;
    token_type: string;
  };
  incoming_webhook?: {
    channel: string;
    channel_id: string;
    configuration_url: string;
    url: string;
  };
}

export interface SlackRateLimitInfo {
  retryAfter: number;
  resetTime: number;
  remainingRequests: number;
  totalRequests: number;
}

export interface NotificationQueue {
  queueId: string;
  tenantId: string;
  notifications: QueuedNotification[];
  processingStatus: 'IDLE' | 'PROCESSING' | 'PAUSED' | 'ERROR';
  lastProcessed: string;
  errorCount: number;
  maxRetries: number;
}

export interface QueuedNotification {
  notificationId: string;
  eventType: NotificationEventType;
  eventData: ComplianceEvent;
  scheduledFor: string;
  priority: number;
  retryCount: number;
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED';
  createdAt: string;
  processedAt?: string;
  error?: string;
}

export interface NotificationBatch {
  batchId: string;
  tenantId: string;
  notifications: QueuedNotification[];
  batchType: 'IMMEDIATE' | 'SCHEDULED' | 'DIGEST';
  scheduledFor: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  processedAt?: string;
  results?: NotificationBatchResult[];
}

export interface NotificationBatchResult {
  notificationId: string;
  status: 'SUCCESS' | 'FAILED';
  messageId?: string;
  error?: string;
  deliveredAt: string;
}

export interface SlackWorkspace {
  teamId: string;
  teamName: string;
  teamDomain: string;
  enterpriseId?: string;
  enterpriseName?: string;
  botUserId: string;
  botAccessToken: string;
  userAccessToken?: string;
  installedAt: string;
  installedBy: string;
  scopes: string[];
  channels: SlackChannelInfo[];
}

export interface NotificationDigest {
  digestId: string;
  tenantId: string;
  digestType: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalScans: number;
    totalFindings: number;
    criticalFindings: number;
    remediationsApplied: number;
    complianceScore: number;
    scoreChange: number;
  };
  topIssues: Array<{
    title: string;
    count: number;
    severity: string;
  }>;
  trends: {
    scansTrend: number;
    findingsTrend: number;
    scoreTrend: number;
  };
  generatedAt: string;
  sentAt?: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
}

export interface SlackModalView {
  type: 'modal';
  callback_id: string;
  title: SlackText;
  submit?: SlackText;
  close?: SlackText;
  blocks: SlackBlock[];
  private_metadata?: string;
  notify_on_close?: boolean;
  clear_on_close?: boolean;
}

export interface SlackHomeView {
  type: 'home';
  blocks: SlackBlock[];
  private_metadata?: string;
  callback_id?: string;
  external_id?: string;
}

// Validation schemas
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

// Error types
export interface SlackNotificationError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

// Status tracking
export interface NotificationStatus {
  notificationId: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  attempts: number;
  lastAttempt?: string;
  nextRetry?: string;
  error?: string;
}

// Configuration validation
export interface SlackConfigValidation {
  tokenValid: boolean;
  channelsValid: boolean;
  permissionsValid: boolean;
  webhookValid?: boolean;
  errors: string[];
  warnings: string[];
}

// Analytics and reporting
export interface NotificationAnalytics {
  tenantId: string;
  period: {
    startDate: string;
    endDate: string;
  };
  metrics: {
    totalNotifications: number;
    deliveryRate: number;
    averageDeliveryTime: number;
    errorRate: number;
    retryRate: number;
  };
  breakdown: {
    byEventType: Record<NotificationEventType, number>;
    byChannel: Record<string, number>;
    byDay: Record<string, number>;
    byHour: Record<string, number>;
  };
  topErrors: Array<{
    error: string;
    count: number;
    percentage: number;
  }>;
}

// Integration settings
export interface SlackIntegrationSettings {
  tenantId: string;
  workspaceId: string;
  botToken: string;
  userToken?: string;
  webhookUrl?: string;
  signingSecret: string;
  appId: string;
  channels: SlackChannel[];
  notificationSettings: NotificationSettings;
  rateLimits: {
    messagesPerMinute: number;
    messagesPerHour: number;
    burstLimit: number;
  };
  retrySettings: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffTime: number;
  };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastHealthCheck?: string;
  healthStatus?: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
}
