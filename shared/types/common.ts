/**
 * Common types used throughout the application
 */

export type Environment = 'development' | 'staging' | 'production';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type Status = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  nextToken?: string;
  totalCount?: number;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
  requestId: string;
}

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
  requestId: string;
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

// AWS Region type
export type AWSRegion = 
  | 'us-east-1'
  | 'us-east-2'
  | 'us-west-1'
  | 'us-west-2'
  | 'eu-west-1'
  | 'eu-west-2'
  | 'eu-central-1'
  | 'ap-southeast-1'
  | 'ap-southeast-2'
  | 'ap-northeast-1';

// Common configuration interface
export interface BaseConfig {
  environment: Environment;
  region: AWSRegion;
  logLevel: LogLevel;
  tenantId?: string;
}
