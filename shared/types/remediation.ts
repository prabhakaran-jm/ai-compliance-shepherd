/**
 * Remediation and fix application types
 */

import { BaseEntity, Severity } from './common';
import { Finding } from './findings';

export interface RemediationRequest {
  remediationId: string;
  tenantId: string;
  findingIds: string[];
  
  // Remediation configuration
  type: RemediationType;
  approach: RemediationApproach;
  options: RemediationOptions;
  
  // Approval workflow
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: string;
  approvalTicket?: string;
  
  // Execution
  requestedBy: string;
  requestedAt: string;
  scheduledAt?: string;
}

export type RemediationType = 
  | 'automatic'
  | 'semi_automatic'
  | 'manual_guidance'
  | 'ticket_creation'
  | 'pr_creation';

export type RemediationApproach = 
  | 'direct_fix'
  | 'terraform_plan'
  | 'cloudformation_change_set'
  | 'aws_cli_commands'
  | 'documentation_only';

export interface RemediationOptions {
  // Execution options
  dryRun: boolean;
  backup: boolean;
  rollbackPlan: boolean;
  
  // Risk management
  maxRiskLevel: Severity;
  confirmationRequired: boolean;
  timeoutMinutes: number;
  
  // Notification options
  notifyOnStart: boolean;
  notifyOnComplete: boolean;
  notifyOnFailure: boolean;
  
  // Integration options
  createTicket: boolean;
  createPR: boolean;
  updateSlack: boolean;
}

export interface RemediationJob extends BaseEntity {
  remediationId: string;
  status: RemediationStatus;
  progress: RemediationProgress;
  
  // Configuration
  request: RemediationRequest;
  
  // Execution details
  startedAt: string;
  completedAt?: string;
  duration?: number; // milliseconds
  
  // Results
  results?: RemediationResults;
  errors?: RemediationError[];
  
  // Metadata
  executionArn?: string; // Step Functions execution ARN
  logGroup?: string;
  logStream?: string;
}

export type RemediationStatus = 
  | 'pending'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'rolled_back';

export interface RemediationProgress {
  totalSteps: number;
  completedSteps: number;
  currentStep: string;
  percentage: number;
  estimatedTimeRemaining?: number; // seconds
}

export interface RemediationResults {
  // Summary
  totalFindings: number;
  successfulRemediations: number;
  failedRemediations: number;
  skippedRemediations: number;
  
  // Detailed results
  remediations: RemediationResult[];
  
  // Verification
  verificationResults: VerificationResult[];
  
  // Rollback information
  rollbackAvailable: boolean;
  rollbackSteps?: RollbackStep[];
}

export interface RemediationResult {
  findingId: string;
  resourceArn: string;
  resourceType: string;
  
  // Remediation details
  action: string;
  method: RemediationApproach;
  status: 'success' | 'failed' | 'skipped';
  
  // Execution details
  executedAt: string;
  duration: number;
  
  // Results
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
  
  // Evidence
  evidence: RemediationEvidence[];
  
  // Errors
  errors?: RemediationError[];
}

export interface RemediationEvidence {
  type: 'command' | 'terraform' | 'cloudformation' | 'api_response' | 'screenshot';
  description: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface VerificationResult {
  findingId: string;
  resourceArn: string;
  
  // Verification details
  verified: boolean;
  verificationMethod: 'api_check' | 'scan_rerun' | 'manual_review';
  verifiedAt: string;
  
  // Results
  complianceStatus: 'compliant' | 'non_compliant' | 'unknown';
  remainingIssues: string[];
  
  // Evidence
  evidence: RemediationEvidence[];
}

export interface RemediationError {
  findingId?: string;
  resourceArn?: string;
  error: string;
  errorCode: string;
  errorType: 'permission' | 'configuration' | 'service_unavailable' | 'validation' | 'unknown';
  timestamp: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export interface RollbackStep {
  order: number;
  action: string;
  description: string;
  command?: string;
  terraform?: string;
  parameters?: Record<string, unknown>;
}

// Automatic remediation
export interface AutoRemediationRule {
  ruleId: string;
  name: string;
  description: string;
  
  // Conditions
  conditions: RemediationCondition[];
  
  // Actions
  actions: RemediationAction[];
  
  // Configuration
  enabled: boolean;
  riskLevel: Severity;
  requiresApproval: boolean;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface RemediationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than';
  value: unknown;
  logicalOperator?: 'AND' | 'OR';
}

export interface RemediationAction {
  type: 'aws_api_call' | 'terraform_apply' | 'create_ticket' | 'create_pr' | 'send_notification';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  timeoutMinutes?: number;
  retryCount?: number;
}

// PR and ticket creation
export interface PRCreationRequest {
  findingIds: string[];
  repository: string;
  branch: string;
  title: string;
  description: string;
  files: PRFile[];
  labels?: string[];
  reviewers?: string[];
}

export interface PRFile {
  path: string;
  content: string;
  operation: 'create' | 'modify' | 'delete';
  originalContent?: string;
}

export interface TicketCreationRequest {
  findingIds: string[];
  project: string;
  issueType: string;
  title: string;
  description: string;
  priority: 'lowest' | 'low' | 'medium' | 'high' | 'highest';
  assignee?: string;
  labels?: string[];
  customFields?: Record<string, unknown>;
}

// Remediation templates
export interface RemediationTemplate {
  templateId: string;
  name: string;
  description: string;
  category: 'security' | 'compliance' | 'cost' | 'performance';
  
  // Template configuration
  applicableServices: string[];
  applicableResourceTypes: string[];
  applicableFrameworks: string[];
  
  // Template actions
  actions: RemediationAction[];
  
  // Usage
  usageCount: number;
  lastUsed?: string;
  
  // Metadata
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Remediation analytics
export interface RemediationMetrics {
  tenantId: string;
  period: string; // YYYY-MM format
  
  // Volume metrics
  totalRemediations: number;
  automaticRemediations: number;
  manualRemediations: number;
  
  // Success metrics
  successRate: number;
  averageTimeToRemediate: number; // minutes
  averageTimeToVerify: number; // minutes
  
  // Cost metrics
  estimatedCostSavings: number;
  riskReductionScore: number;
  
  // Trends
  trends: RemediationTrend[];
}

export interface RemediationTrend {
  date: string; // YYYY-MM-DD
  remediations: number;
  successRate: number;
  averageTime: number;
}
