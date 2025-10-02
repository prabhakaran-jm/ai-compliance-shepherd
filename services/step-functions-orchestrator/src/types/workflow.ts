/**
 * Type definitions for Step Functions workflows
 */

export interface WorkflowRequest {
  workflowType: string;
  tenantId: string;
  parameters?: Record<string, any>;
  startedBy?: string;
  metadata?: Record<string, any>;
}

export interface WorkflowExecution {
  executionArn: string;
  executionName: string;
  stateMachineArn: string;
  status: string;
  startDate?: string;
  stopDate?: string;
  input?: any;
  output?: any;
  workflowType: string;
  tenantId: string;
  correlationId: string;
}

export interface WorkflowStatus {
  executionArn: string;
  status: string;
  startDate?: string;
  stopDate?: string;
  input?: any;
  output?: any;
  error?: string;
  cause?: string;
  stateMachineArn: string;
  executionHistory?: any[];
}

export interface WorkflowDefinition {
  workflowType: string;
  name: string;
  description: string;
  version: string;
  stateMachineName: string;
  requiredParameters: string[];
  optionalParameters?: string[];
  parameterSchema?: Record<string, any>;
  estimatedDuration: string;
  stateMachineDefinition: StateMachineDefinition;
}

export interface StateMachineDefinition {
  Comment: string;
  StartAt: string;
  States: Record<string, StateDefinition>;
}

export interface StateDefinition {
  Type: 'Task' | 'Choice' | 'Wait' | 'Pass' | 'Fail' | 'Succeed' | 'Parallel' | 'Map';
  Resource?: string;
  Parameters?: Record<string, any>;
  ResultPath?: string;
  Next?: string;
  End?: boolean;
  Choices?: ChoiceRule[];
  Default?: string;
  Branches?: StateMachineDefinition[];
  Iterator?: StateMachineDefinition;
  ItemsPath?: string;
  MaxConcurrency?: number;
  Seconds?: number;
  SecondsPath?: string;
  Timestamp?: string;
  TimestampPath?: string;
  Retry?: RetryRule[];
  Catch?: CatchRule[];
  Cause?: string;
  Error?: string;
  Result?: any;
}

export interface ChoiceRule {
  Variable: string;
  StringEquals?: string;
  NumericEquals?: number;
  BooleanEquals?: boolean;
  NumericGreaterThan?: number;
  NumericLessThan?: number;
  IsPresent?: boolean;
  Next: string;
}

export interface RetryRule {
  ErrorEquals: string[];
  IntervalSeconds?: number;
  MaxAttempts?: number;
  BackoffRate?: number;
}

export interface CatchRule {
  ErrorEquals: string[];
  Next: string;
  ResultPath?: string;
}

export interface WorkflowListRequest {
  tenantId?: string;
  workflowType?: string;
  status?: string;
  limit?: number;
  nextToken?: string;
}

export interface WorkflowMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  runningExecutions: number;
  averageExecutionTime: number;
}

export interface WorkflowEvent {
  eventType: 'EXECUTION_STARTED' | 'EXECUTION_SUCCEEDED' | 'EXECUTION_FAILED' | 'EXECUTION_TIMED_OUT' | 'EXECUTION_ABORTED';
  executionArn: string;
  stateMachineArn: string;
  timestamp: string;
  input?: any;
  output?: any;
  error?: string;
  cause?: string;
}

export interface WorkflowSchedule {
  scheduleId: string;
  workflowType: string;
  tenantId: string;
  cronExpression: string;
  parameters: Record<string, any>;
  enabled: boolean;
  createdAt: string;
  lastExecution?: string;
  nextExecution?: string;
}

export interface WorkflowTemplate {
  templateId: string;
  name: string;
  description: string;
  workflowType: string;
  defaultParameters: Record<string, any>;
  parameterValidation: Record<string, any>;
  tags: string[];
  createdBy: string;
  createdAt: string;
}

export interface WorkflowApproval {
  approvalId: string;
  executionArn: string;
  workflowType: string;
  tenantId: string;
  requestedBy: string;
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: string;
  reason?: string;
  parameters: Record<string, any>;
}

export interface WorkflowNotification {
  notificationId: string;
  executionArn: string;
  workflowType: string;
  tenantId: string;
  eventType: string;
  message: string;
  recipients: string[];
  channels: ('email' | 'sns' | 'slack')[];
  sentAt: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
}

export interface WorkflowAuditLog {
  logId: string;
  executionArn: string;
  workflowType: string;
  tenantId: string;
  action: string;
  performedBy: string;
  performedAt: string;
  details: Record<string, any>;
  result: 'SUCCESS' | 'FAILURE';
}

export interface WorkflowConfiguration {
  maxConcurrentExecutions: number;
  defaultTimeout: number;
  retryPolicy: {
    maxAttempts: number;
    backoffRate: number;
    intervalSeconds: number;
  };
  notificationSettings: {
    onSuccess: boolean;
    onFailure: boolean;
    onTimeout: boolean;
    recipients: string[];
  };
  approvalSettings: {
    required: boolean;
    approvers: string[];
    timeoutMinutes: number;
  };
}
