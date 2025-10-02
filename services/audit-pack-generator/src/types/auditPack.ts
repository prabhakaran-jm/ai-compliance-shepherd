/**
 * Type definitions for audit pack generation
 */

export interface AuditPackRequest {
  tenantId: string;
  framework: 'SOC2' | 'HIPAA' | 'GDPR' | 'PCI-DSS' | 'ISO27001';
  auditType: 'ANNUAL' | 'QUARTERLY' | 'MONTHLY' | 'AD_HOC';
  requestedBy?: string;
  configuration?: AuditPackConfiguration;
}

export interface AuditPackConfiguration {
  includePolicies?: boolean;
  includeFindings?: boolean;
  includeRemediation?: boolean;
  includeEvidence?: boolean;
  includeMetrics?: boolean;
  dateRange?: DateRange;
  format?: 'PDF' | 'HTML' | 'ZIP' | 'JSON';
  customSections?: string[];
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface AuditPackResponse {
  auditPackId: string;
  tenantId: string;
  framework: string;
  auditType: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  requestedBy: string;
  requestedAt: string;
  completedAt?: string;
  configuration: AuditPackConfiguration;
  progress?: AuditPackProgress;
  summary?: AuditPackSummary;
  downloadUrl?: string;
  expiresAt?: string;
  error?: string;
}

export interface AuditPackProgress {
  currentStep: string;
  completedSteps: number;
  totalSteps: number;
  percentage: number;
}

export interface AuditPackSummary {
  totalFindings: number;
  criticalFindings: number;
  resolvedFindings: number;
  complianceScore: number;
  controlsCovered: number;
  evidenceItems: number;
  documentCount: number;
  totalSize: string;
  packageStructure?: Record<string, number>;
}

export interface AuditPackListRequest {
  tenantId?: string;
  framework?: string;
  status?: string;
  limit?: number;
  nextToken?: string;
}

export interface EvidenceItem {
  evidenceId: string;
  type: 'FINDING' | 'POLICY' | 'AUDIT_LOG' | 'COMPLIANCE_ASSESSMENT' | 'REMEDIATION' | 'CONFIGURATION';
  category: string;
  title: string;
  description: string;
  source: string;
  timestamp: string;
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'ACTIVE' | 'RESOLVED' | 'OPEN' | 'COMPLETED' | 'IN_PROGRESS';
  metadata?: Record<string, any>;
  evidence?: Record<string, any>;
  remediation?: RemediationInfo;
}

export interface RemediationInfo {
  action: string;
  appliedAt: string;
  appliedBy: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'IN_PROGRESS';
  details?: Record<string, any>;
}

export interface EvidenceReport {
  reportId: string;
  tenantId: string;
  framework: string;
  generatedAt: string;
  dateRange: DateRange;
  evidenceItems: EvidenceItem[];
  categories: Record<string, EvidenceItem[]>;
  statistics: Record<string, any>;
  summary: {
    totalItems: number;
    criticalEvidence: number;
    highEvidence: number;
    mediumEvidence: number;
    lowEvidence: number;
    coveragePercentage: number;
  };
}

export interface ComplianceSummary {
  summaryId: string;
  tenantId: string;
  framework: string;
  generatedAt: string;
  dateRange: DateRange;
  overallScore: number;
  controls: ComplianceControl[];
  gaps: ComplianceGap[];
  recommendations: string[];
  statistics: ComplianceStatistics;
}

export interface ComplianceControl {
  controlId: string;
  controlName: string;
  description: string;
  category: string;
  requirements: string[];
  testProcedures: string[];
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT' | 'NOT_APPLICABLE' | 'PENDING';
  score: number;
  evidence?: string[];
  lastAssessed: string;
  assessor?: string;
  notes?: string;
}

export interface ComplianceGap {
  gapId: string;
  controlId: string;
  controlName: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  impact: string;
  remediation: string[];
  estimatedEffort: string;
  priority: number;
}

export interface ComplianceStatistics {
  totalControls: number;
  compliantControls: number;
  nonCompliantControls: number;
  partiallyCompliantControls: number;
  notApplicableControls: number;
  criticalGaps: number;
  highGaps: number;
  mediumGaps: number;
  lowGaps: number;
}

export interface AuditReport {
  reportId: string;
  type: 'EXECUTIVE_SUMMARY' | 'FINDINGS' | 'EVIDENCE' | 'COMPLIANCE' | 'REMEDIATION' | 'CUSTOM';
  title: string;
  format: 'MARKDOWN' | 'HTML' | 'PDF' | 'JSON';
  content: string;
  pdfContent?: Buffer;
  generatedAt: string;
  metadata: {
    auditPackId: string;
    tenantId: string;
    framework: string;
    pageCount?: number;
    wordCount?: number;
    [key: string]: any;
  };
}

export interface PackageInfo {
  packageId: string;
  auditPackId: string;
  downloadUrl: string;
  size: string;
  checksum: string;
  createdAt: string;
  expiresAt: string;
  summary: AuditPackSummary;
}

export interface PolicyDocument {
  policyId: string;
  title: string;
  version: string;
  type: string;
  approvedBy: string;
  effectiveDate: string;
  reviewDate?: string;
  content: string;
  sections: string[];
  approvals: PolicyApproval[];
  complianceFrameworks: string[];
}

export interface PolicyApproval {
  role: string;
  name: string;
  date: string;
  signature?: string;
}

export interface AuditLog {
  logId: string;
  eventType: string;
  timestamp: string;
  userId?: string;
  resourceId?: string;
  action: string;
  result: 'SUCCESS' | 'FAILURE' | 'WARNING';
  details: Record<string, any>;
  sourceIp?: string;
  userAgent?: string;
}

export interface ComplianceEvidence {
  evidenceId: string;
  controlId: string;
  evidenceType: 'DOCUMENT' | 'SCREENSHOT' | 'LOG' | 'CONFIGURATION' | 'ATTESTATION';
  title: string;
  description: string;
  collectedAt: string;
  collectedBy: string;
  validFrom: string;
  validTo?: string;
  content: string | Buffer;
  metadata: Record<string, any>;
}

// Validation schemas
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

// Error types
export interface AuditPackError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

// Status tracking
export interface StatusUpdate {
  auditPackId: string;
  status: string;
  progress?: AuditPackProgress;
  message?: string;
  timestamp: string;
}

// Export formats
export interface ExportOptions {
  format: 'CSV' | 'JSON' | 'XML' | 'XLSX';
  includeMetadata: boolean;
  dateFormat?: string;
  delimiter?: string;
}

// Template definitions
export interface ReportTemplate {
  templateId: string;
  name: string;
  description: string;
  framework: string;
  sections: TemplateSection[];
  variables: TemplateVariable[];
}

export interface TemplateSection {
  sectionId: string;
  name: string;
  order: number;
  required: boolean;
  template: string;
  dataSource: string;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required: boolean;
  defaultValue?: any;
  description?: string;
}

// Audit trail
export interface AuditTrail {
  trailId: string;
  auditPackId: string;
  action: string;
  performedBy: string;
  performedAt: string;
  details: Record<string, any>;
  result: 'SUCCESS' | 'FAILURE' | 'WARNING';
}

// Notification settings
export interface NotificationSettings {
  email?: string[];
  slack?: {
    webhook: string;
    channel: string;
  };
  teams?: {
    webhook: string;
  };
  events: NotificationEvent[];
}

export interface NotificationEvent {
  event: 'STARTED' | 'COMPLETED' | 'FAILED' | 'PROGRESS_UPDATE';
  enabled: boolean;
  threshold?: number;
}

// Archive settings
export interface ArchiveSettings {
  retentionDays: number;
  archiveLocation: 'S3' | 'GLACIER' | 'DEEP_ARCHIVE';
  encryptionEnabled: boolean;
  compressionEnabled: boolean;
}

// Quality metrics
export interface QualityMetrics {
  completeness: number; // Percentage of required evidence collected
  accuracy: number; // Percentage of evidence validated
  timeliness: number; // Percentage of evidence collected within SLA
  coverage: number; // Percentage of controls covered
  overallQuality: number; // Weighted average of all metrics
}

// Compliance framework definitions
export interface ComplianceFramework {
  frameworkId: string;
  name: string;
  version: string;
  description: string;
  controls: ComplianceControl[];
  requirements: FrameworkRequirement[];
  mappings?: FrameworkMapping[];
}

export interface FrameworkRequirement {
  requirementId: string;
  title: string;
  description: string;
  category: string;
  mandatory: boolean;
  evidenceTypes: string[];
  testProcedures: string[];
}

export interface FrameworkMapping {
  sourceFramework: string;
  targetFramework: string;
  mappings: ControlMapping[];
}

export interface ControlMapping {
  sourceControlId: string;
  targetControlId: string;
  mappingType: 'EXACT' | 'PARTIAL' | 'RELATED';
  confidence: number;
}

// Risk assessment
export interface RiskAssessment {
  assessmentId: string;
  auditPackId: string;
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: RiskFactor[];
  mitigationRecommendations: string[];
  assessedAt: string;
  assessedBy: string;
}

export interface RiskFactor {
  factorId: string;
  category: string;
  description: string;
  likelihood: 'LOW' | 'MEDIUM' | 'HIGH';
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  mitigationStatus: 'NONE' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
}

// Benchmarking
export interface BenchmarkData {
  framework: string;
  industry: string;
  organizationSize: 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';
  averageScore: number;
  percentile: number;
  topPerformingControls: string[];
  improvementAreas: string[];
}

// Integration settings
export interface IntegrationSettings {
  jira?: {
    url: string;
    username: string;
    apiToken: string;
    projectKey: string;
  };
  servicenow?: {
    instance: string;
    username: string;
    password: string;
    table: string;
  };
  splunk?: {
    host: string;
    port: number;
    token: string;
    index: string;
  };
}

// Custom fields
export interface CustomField {
  fieldId: string;
  name: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT' | 'MULTISELECT';
  required: boolean;
  options?: string[];
  validation?: string;
  description?: string;
}
