/**
 * Scanning and environment assessment types
 */

import { BaseEntity, Severity } from './common';
import { ComplianceFramework, ComplianceRule } from './compliance';
import { Finding } from './findings';

export interface ScanRequest {
  scanId: string;
  tenantId: string;
  accountId: string;
  region?: string;
  scanType: ScanType;
  
  // Scan configuration
  frameworks: ComplianceFramework[];
  services: string[];
  rules: string[]; // Rule IDs
  
  // Scan options
  options: ScanOptions;
  
  // Scheduling
  scheduledAt?: string;
  triggeredBy: ScanTrigger;
  
  // Metadata
  requestedBy: string;
  requestId: string;
}

export type ScanType = 
  | 'full_environment'
  | 'service_specific'
  | 'rule_specific'
  | 'resource_specific'
  | 'incremental'
  | 'scheduled';

export interface ScanOptions {
  // Resource filtering
  resourceTypes?: string[];
  resourceTags?: Record<string, string[]>;
  excludeResources?: string[];
  
  // Scan behavior
  parallel: boolean;
  maxConcurrency: number;
  timeout: number; // seconds
  
  // Output options
  generateReport: boolean;
  includeEvidence: boolean;
  includeRecommendations: boolean;
  
  // Advanced options
  dryRun: boolean;
  skipSuppressed: boolean;
  includeHistorical: boolean;
}

export interface ScanTrigger {
  type: 'manual' | 'scheduled' | 'event' | 'webhook' | 'api';
  source: string;
  metadata?: Record<string, unknown>;
}

export interface ScanJob extends BaseEntity {
  scanId: string;
  status: ScanStatus;
  progress: ScanProgress;
  
  // Configuration
  request: ScanRequest;
  
  // Execution details
  startedAt: string;
  completedAt?: string;
  duration?: number; // milliseconds
  
  // Results
  results?: ScanResults;
  errors?: ScanError[];
  
  // Metadata
  executionArn?: string; // Step Functions execution ARN
  logGroup?: string;
  logStream?: string;
}

export type ScanStatus = 
  | 'pending'
  | 'initializing'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export interface ScanProgress {
  totalSteps: number;
  completedSteps: number;
  currentStep: string;
  percentage: number;
  estimatedTimeRemaining?: number; // seconds
}

export interface ScanResults {
  // Summary
  totalResources: number;
  scannedResources: number;
  skippedResources: number;
  errorResources: number;
  
  // Findings
  totalFindings: number;
  findingsBySeverity: Record<Severity, number>;
  findingsByService: Record<string, number>;
  findingsByFramework: Record<ComplianceFramework, number>;
  
  // Detailed results
  findings: Finding[];
  resources: ScannedResource[];
  
  // Compliance scores
  complianceScores: Record<ComplianceFramework, number>;
  
  // Metadata
  scanDuration: number;
  rulesExecuted: string[];
  servicesScanned: string[];
}

export interface ScannedResource {
  arn: string;
  type: string;
  service: string;
  region: string;
  accountId: string;
  
  // Resource details
  name: string;
  tags: Record<string, string>;
  configuration: Record<string, unknown>;
  
  // Scan results
  status: 'scanned' | 'skipped' | 'error';
  findings: string[]; // Finding IDs
  errors?: string[];
  
  // Metadata
  scannedAt: string;
  scanDuration: number;
  rulesApplied: string[];
}

export interface ScanError {
  resourceArn?: string;
  resourceType?: string;
  service?: string;
  error: string;
  errorCode: string;
  errorType: 'permission' | 'timeout' | 'service_unavailable' | 'configuration' | 'unknown';
  timestamp: string;
  retryable: boolean;
}

// Resource scanning
export interface ResourceScanner {
  service: string;
  resourceType: string;
  scanFunction: string; // Lambda function name
  dependencies: string[];
  timeout: number;
  retryCount: number;
}

export interface ResourceScanResult {
  resourceArn: string;
  resourceType: string;
  service: string;
  
  // Scan results
  findings: Finding[];
  errors: ScanError[];
  
  // Resource state
  configuration: Record<string, unknown>;
  tags: Record<string, string>;
  
  // Metadata
  scannedAt: string;
  scanDuration: number;
  rulesApplied: string[];
}

// Incremental scanning
export interface IncrementalScanConfig {
  enabled: boolean;
  changeDetection: ChangeDetectionConfig;
  batchSize: number;
  maxAge: number; // hours
}

export interface ChangeDetectionConfig {
  method: 'cloudtrail' | 'config' | 'eventbridge' | 'polling';
  sources: string[];
  filters: Record<string, unknown>;
}

export interface ResourceChange {
  resourceArn: string;
  resourceType: string;
  changeType: 'created' | 'modified' | 'deleted';
  timestamp: string;
  details: Record<string, unknown>;
  detectedBy: string;
}

// Scan scheduling
export interface ScanSchedule {
  scheduleId: string;
  tenantId: string;
  name: string;
  description?: string;
  
  // Schedule configuration
  cronExpression: string;
  timezone: string;
  
  // Scan configuration
  scanConfig: ScanRequest;
  
  // Status
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// Scan templates
export interface ScanTemplate {
  templateId: string;
  name: string;
  description: string;
  category: 'compliance' | 'security' | 'cost' | 'performance';
  
  // Template configuration
  frameworks: ComplianceFramework[];
  services: string[];
  rules: string[];
  options: ScanOptions;
  
  // Usage
  usageCount: number;
  lastUsed?: string;
  
  // Metadata
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
