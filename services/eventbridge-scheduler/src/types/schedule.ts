/**
 * Type definitions for EventBridge Scheduler
 */

export interface ScheduleRequest {
  scheduleType: string;
  tenantId: string;
  cronExpression: string;
  timezone?: string;
  enabled: boolean;
  description?: string;
  target: ScheduleTarget;
  parameters?: Record<string, any>;
  flexibleTimeWindowMinutes?: number;
  createdBy?: string;
}

export interface ScheduleTarget {
  type: 'step-functions' | 'lambda' | 'sns';
  stateMachineName?: string;
  functionName?: string;
  topicName?: string;
}

export interface ScheduleResponse {
  scheduleId: string;
  scheduleName: string;
  scheduleType: string;
  tenantId: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  description?: string;
  target: ScheduleTarget;
  parameters?: Record<string, any>;
  nextExecution?: string;
  lastExecution?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface ScheduleListRequest {
  tenantId?: string;
  scheduleType?: string;
  status?: 'ENABLED' | 'DISABLED';
  limit?: number;
  nextToken?: string;
}

export interface ScheduleConfiguration {
  scheduleId: string;
  name: string;
  description: string;
  cronExpression: string;
  timezone: string;
  target: ScheduleTarget;
  parameters: Record<string, any>;
  enabled: boolean;
  flexibleTimeWindow: {
    mode: 'OFF' | 'FLEXIBLE';
    maximumWindowInMinutes?: number;
  };
  retryPolicy?: {
    maximumRetryAttempts?: number;
    maximumEventAge?: number;
  };
  deadLetterConfig?: {
    arn?: string;
  };
}

export interface ScheduleExecution {
  executionId: string;
  scheduleId: string;
  scheduleName: string;
  executionTime: string;
  status: 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'CANCELLED';
  startTime: string;
  endTime?: string;
  output?: any;
  error?: string;
  retryAttempt: number;
}

export interface ScheduleMetrics {
  scheduleId: string;
  scheduleName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecutionTime?: string;
  nextExecutionTime?: string;
  errorRate: number;
}

export interface ScheduleTemplate {
  templateId: string;
  name: string;
  description: string;
  scheduleType: string;
  defaultCronExpression: string;
  defaultTimezone: string;
  defaultTarget: ScheduleTarget;
  defaultParameters: Record<string, any>;
  parameterSchema: Record<string, any>;
  tags: string[];
  createdBy: string;
  createdAt: string;
}

export interface ScheduleGroup {
  groupName: string;
  description?: string;
  scheduleCount: number;
  createdAt: string;
  lastModifiedAt: string;
  tags?: Record<string, string>;
}

export interface ScheduleAuditLog {
  logId: string;
  scheduleId: string;
  scheduleName: string;
  action: 'CREATED' | 'UPDATED' | 'DELETED' | 'ENABLED' | 'DISABLED' | 'EXECUTED';
  performedBy: string;
  performedAt: string;
  details: Record<string, any>;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
}

export interface ScheduleAlert {
  alertId: string;
  scheduleId: string;
  scheduleName: string;
  alertType: 'EXECUTION_FAILED' | 'EXECUTION_TIMEOUT' | 'SCHEDULE_DISABLED' | 'HIGH_ERROR_RATE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  triggeredAt: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface ScheduleBatch {
  batchId: string;
  schedules: string[];
  operation: 'ENABLE' | 'DISABLE' | 'DELETE' | 'UPDATE';
  parameters?: Record<string, any>;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  results?: {
    successful: string[];
    failed: Array<{
      scheduleId: string;
      error: string;
    }>;
  };
}
