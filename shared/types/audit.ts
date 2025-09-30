/**
 * Audit and evidence collection types
 */

import { BaseEntity } from './common';
import { ComplianceFramework } from './compliance';
import { Finding } from './findings';

// Audit pack generation
export interface AuditPackRequest {
  packId: string;
  tenantId: string;
  scanId?: string;
  frameworks: ComplianceFramework[];
  options: AuditPackOptions;
  requestedBy: string;
  requestedAt: string;
}

export interface AuditPackOptions {
  // Content options
  includeFindings: boolean;
  includeEvidence: boolean;
  includeScreenshots: boolean;
  includeReports: boolean;
  includeTrends: boolean;
  
  // Format options
  format: 'zip' | 'tar' | 'pdf';
  includeMetadata: boolean;
  includeRawData: boolean;
  
  // Filtering options
  dateRange?: {
    start: string;
    end: string;
  };
  severityFilter?: string[];
  serviceFilter?: string[];
  
  // Customization
  customFields?: Record<string, unknown>;
  branding?: AuditPackBranding;
}

export interface AuditPackBranding {
  companyName?: string;
  logo?: string;
  primaryColor?: string;
  footer?: string;
}

export interface AuditPack extends BaseEntity {
  packId: string;
  status: AuditPackStatus;
  progress: AuditPackProgress;
  
  // Configuration
  request: AuditPackRequest;
  
  // Generation details
  startedAt: string;
  completedAt?: string;
  duration?: number; // milliseconds
  
  // Results
  contents: AuditPackContent[];
  downloadUrl?: string;
  expiresAt?: string;
  
  // Metadata
  size?: number;
  fileCount?: number;
  checksum?: string;
}

export type AuditPackStatus = 
  | 'pending'
  | 'generating'
  | 'completed'
  | 'failed'
  | 'expired';

export interface AuditPackProgress {
  totalSteps: number;
  completedSteps: number;
  currentStep: string;
  percentage: number;
  estimatedTimeRemaining?: number; // seconds
}

export interface AuditPackContent {
  type: 'finding' | 'evidence' | 'report' | 'screenshot' | 'metadata' | 'trend';
  name: string;
  description: string;
  size: number;
  format: string;
  path: string;
  checksum: string;
  metadata?: Record<string, unknown>;
}

// Evidence collection
export interface EvidenceRequest {
  evidenceId: string;
  tenantId: string;
  findingId: string;
  type: EvidenceType;
  options: EvidenceOptions;
  requestedBy: string;
  requestedAt: string;
}

export type EvidenceType = 
  | 'configuration_snapshot'
  | 'api_response'
  | 'cloudtrail_logs'
  | 'config_snapshot'
  | 'screenshot'
  | 'terraform_state'
  | 'cost_data'
  | 'performance_metrics';

export interface EvidenceOptions {
  // Collection options
  includeMetadata: boolean;
  includeHistory: boolean;
  maxAge?: number; // hours
  
  // Filtering
  dateRange?: {
    start: string;
    end: string;
  };
  resourceFilter?: string[];
  
  // Format options
  format: 'json' | 'yaml' | 'xml' | 'csv' | 'raw';
  compression: boolean;
}

export interface Evidence extends BaseEntity {
  evidenceId: string;
  findingId: string;
  type: EvidenceType;
  status: EvidenceStatus;
  
  // Collection details
  collectedAt: string;
  collectedBy: string;
  source: string;
  
  // Content
  data: EvidenceData;
  metadata: EvidenceMetadata;
  
  // Storage
  storageUrl?: string;
  size: number;
  checksum: string;
  format: string;
}

export type EvidenceStatus = 'collecting' | 'completed' | 'failed' | 'expired';

export interface EvidenceData {
  content: string; // Base64 encoded or JSON
  format: string;
  schema?: Record<string, unknown>;
  validation?: EvidenceValidation;
}

export interface EvidenceValidation {
  schemaValid: boolean;
  checksumValid: boolean;
  timestampValid: boolean;
  errors?: string[];
}

export interface EvidenceMetadata {
  resourceArn: string;
  resourceType: string;
  service: string;
  region: string;
  accountId: string;
  
  // Collection metadata
  collectionMethod: string;
  collectionDuration: number;
  sourceVersion?: string;
  
  // Content metadata
  recordCount?: number;
  dataRange?: {
    start: string;
    end: string;
  };
  
  // Compliance metadata
  frameworks: ComplianceFramework[];
  controls: string[];
  relevanceScore: number;
}

// Audit trail
export interface AuditTrail extends BaseEntity {
  action: string;
  actor: AuditActor;
  target: AuditTarget;
  result: AuditResult;
  context: AuditContext;
  metadata: Record<string, unknown>;
}

export interface AuditActor {
  type: 'user' | 'system' | 'api' | 'service';
  id: string;
  name: string;
  sourceIp?: string;
  userAgent?: string;
}

export interface AuditTarget {
  type: 'finding' | 'scan' | 'remediation' | 'tenant' | 'user' | 'resource';
  id: string;
  name: string;
  arn?: string;
}

export interface AuditResult {
  status: 'success' | 'failure' | 'partial';
  message: string;
  details?: Record<string, unknown>;
  errorCode?: string;
}

export interface AuditContext {
  tenantId: string;
  sessionId?: string;
  requestId?: string;
  source: string;
  environment: string;
}

// Compliance reporting
export interface ComplianceReport {
  reportId: string;
  tenantId: string;
  name: string;
  description: string;
  frameworks: ComplianceFramework[];
  
  // Report configuration
  type: 'executive' | 'technical' | 'auditor' | 'regulatory';
  format: 'html' | 'pdf' | 'json' | 'csv';
  template?: string;
  
  // Content
  sections: ReportSection[];
  summary: ReportSummary;
  
  // Generation details
  generatedAt: string;
  generatedBy: string;
  period: {
    start: string;
    end: string;
  };
  
  // Delivery
  status: 'generating' | 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt?: string;
  recipients?: string[];
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'summary' | 'findings' | 'trends' | 'recommendations' | 'evidence' | 'custom';
  content: ReportSectionContent;
  order: number;
}

export interface ReportSectionContent {
  data: Record<string, unknown>;
  visualizations?: ReportVisualization[];
  tables?: ReportTable[];
  text?: string;
}

export interface ReportVisualization {
  type: 'chart' | 'graph' | 'heatmap' | 'timeline';
  title: string;
  data: Record<string, unknown>;
  config: Record<string, unknown>;
}

export interface ReportTable {
  title: string;
  headers: string[];
  rows: string[][];
  summary?: Record<string, unknown>;
}

export interface ReportSummary {
  totalFindings: number;
  findingsBySeverity: Record<string, number>;
  complianceScores: Record<ComplianceFramework, number>;
  topRisks: string[];
  keyRecommendations: string[];
  trendAnalysis: string;
}

// Evidence analysis
export interface EvidenceAnalysis {
  analysisId: string;
  evidenceId: string;
  type: 'pattern_analysis' | 'anomaly_detection' | 'compliance_check' | 'trend_analysis';
  
  // Analysis details
  startedAt: string;
  completedAt?: string;
  duration?: number;
  
  // Results
  findings: EvidenceAnalysisFinding[];
  insights: string[];
  recommendations: string[];
  
  // Metadata
  model?: string;
  confidence: number;
  accuracy?: number;
}

export interface EvidenceAnalysisFinding {
  id: string;
  type: 'anomaly' | 'pattern' | 'violation' | 'risk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  evidence: string[];
  confidence: number;
  recommendations: string[];
}

// Audit scheduling
export interface AuditSchedule {
  scheduleId: string;
  tenantId: string;
  name: string;
  description?: string;
  
  // Schedule configuration
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  dayOfWeek?: number; // 0-6, Sunday=0
  dayOfMonth?: number; // 1-31
  time: string; // HH:MM format
  timezone: string;
  
  // Audit configuration
  frameworks: ComplianceFramework[];
  reportTypes: string[];
  recipients: string[];
  
  // Status
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// Data retention
export interface DataRetentionPolicy {
  policyId: string;
  tenantId: string;
  name: string;
  
  // Retention rules
  rules: RetentionRule[];
  
  // Enforcement
  enabled: boolean;
  autoDelete: boolean;
  notificationDays: number;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface RetentionRule {
  dataType: 'findings' | 'evidence' | 'reports' | 'audit_logs' | 'scan_results';
  retentionDays: number;
  conditions?: RetentionCondition[];
  exceptions?: RetentionException[];
}

export interface RetentionCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: unknown;
}

export interface RetentionException {
  type: 'legal_hold' | 'investigation' | 'compliance_requirement';
  description: string;
  expiresAt?: string;
  authorizedBy: string;
}
