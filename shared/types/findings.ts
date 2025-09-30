/**
 * Findings and scan result types
 */

import { BaseEntity, Severity } from './common';
import { ComplianceFramework, ComplianceControl } from './compliance';

export interface Finding extends BaseEntity {
  findingId: string;
  resourceArn: string;
  resourceType: string;
  service: string;
  region: string;
  accountId: string;
  
  // Compliance details
  framework: ComplianceFramework;
  controlId: string;
  controlTitle: string;
  severity: Severity;
  
  // Finding details
  title: string;
  description: string;
  risk: string;
  recommendation: string;
  
  // Evidence and references
  evidence: FindingEvidence[];
  references: FindingReference[];
  
  // Status and lifecycle
  status: FindingStatus;
  firstSeen: string;
  lastSeen: string;
  resolvedAt?: string;
  resolvedBy?: string;
  
  // Remediation
  remediation: RemediationInfo;
  suppression?: SuppressionInfo;
  
  // Metadata
  tags: string[];
  hash: string; // For deduplication
}

export interface FindingEvidence {
  type: 'configuration' | 'log' | 'screenshot' | 'api_response' | 'terraform_plan';
  description: string;
  data: Record<string, unknown>;
  timestamp: string;
  source: string;
}

export interface FindingReference {
  type: 'aws_doc' | 'compliance_standard' | 'best_practice' | 'internal_policy';
  title: string;
  url: string;
  section?: string;
}

export type FindingStatus = 
  | 'active'
  | 'suppressed'
  | 'resolved'
  | 'false_positive'
  | 'accepted_risk';

export interface RemediationInfo {
  type: 'automatic' | 'manual' | 'ticket' | 'pr';
  description: string;
  steps: RemediationStep[];
  estimatedEffort: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  automated: boolean;
}

export interface RemediationStep {
  order: number;
  action: string;
  description: string;
  command?: string;
  terraform?: string;
  parameters?: Record<string, unknown>;
}

export interface SuppressionInfo {
  reason: string;
  suppressedBy: string;
  suppressedAt: string;
  expiresAt?: string;
  ticketReference?: string;
}

// Scan result aggregation
export interface ScanResult {
  scanId: string;
  tenantId: string;
  accountId: string;
  region: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  
  // Scan metadata
  startedAt: string;
  completedAt?: string;
  duration?: number; // milliseconds
  
  // Resource coverage
  totalResources: number;
  scannedResources: number;
  skippedResources: number;
  errorResources: number;
  
  // Findings summary
  totalFindings: number;
  findingsBySeverity: Record<Severity, number>;
  findingsByService: Record<string, number>;
  findingsByFramework: Record<ComplianceFramework, number>;
  
  // Findings details
  findings: Finding[];
  errors: ScanError[];
  
  // Report generation
  reportUrl?: string;
  reportGeneratedAt?: string;
}

export interface ScanError {
  resourceArn: string;
  resourceType: string;
  error: string;
  errorCode: string;
  timestamp: string;
}

// Finding filters and queries
export interface FindingFilter {
  tenantId?: string;
  accountId?: string;
  region?: string;
  service?: string;
  framework?: ComplianceFramework;
  severity?: Severity;
  status?: FindingStatus;
  resourceType?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface FindingQuery {
  filters: FindingFilter;
  pagination: {
    limit: number;
    offset?: string;
  };
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

// Trend analysis
export interface FindingTrend {
  period: string; // YYYY-MM-DD format
  totalFindings: number;
  newFindings: number;
  resolvedFindings: number;
  findingsBySeverity: Record<Severity, number>;
}

export interface ComplianceTrend {
  framework: ComplianceFramework;
  period: string;
  complianceScore: number;
  totalControls: number;
  compliantControls: number;
  trend: 'improving' | 'declining' | 'stable';
}
