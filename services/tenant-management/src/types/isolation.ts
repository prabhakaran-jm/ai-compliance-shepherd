/**
 * Type definitions for tenant isolation and security
 */

export interface TenantIsolationStatus {
  tenantId: string;
  overallStatus: 'SECURE' | 'WARNING' | 'VIOLATION';
  overallScore: number;
  components: {
    dataIsolation: IsolationComponent;
    networkIsolation: IsolationComponent;
    computeIsolation: IsolationComponent;
    encryptionIsolation: IsolationComponent;
    accessIsolation: IsolationComponent;
  };
  violations: IsolationViolation[];
  recommendations: string[];
  lastChecked: string;
  nextCheckDue: string;
}

export interface IsolationComponent {
  component: string;
  score: number;
  status: 'SECURE' | 'WARNING' | 'VIOLATION';
  details: Record<string, any>;
  violations: Array<{
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
}

export interface IsolationViolation {
  component: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  remediation: string;
}

export interface TenantIsolationValidation {
  tenantId: string;
  validationId: string;
  status: 'PASSED' | 'WARNING' | 'FAILED';
  isolationScore: number;
  checks: ValidationCheck[];
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    criticalIssues: number;
    warningIssues: number;
  };
  recommendations: string[];
  validatedAt: string;
  validatedBy: string;
}

export interface ValidationCheck {
  checkName: string;
  passed: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  details: string;
  remediation?: string;
}

export interface TenantSecurityPolicy {
  tenantId: string;
  policyId: string;
  name: string;
  description: string;
  rules: SecurityRule[];
  enforcement: 'MONITOR' | 'WARN' | 'BLOCK';
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface SecurityRule {
  ruleId: string;
  name: string;
  description: string;
  type: 'DATA_ACCESS' | 'NETWORK_ACCESS' | 'RESOURCE_ACCESS' | 'API_ACCESS';
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  enabled: boolean;
}

export interface RuleCondition {
  field: string;
  operator: 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'NOT_CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'REGEX';
  value: string | string[];
}

export interface RuleAction {
  type: 'ALLOW' | 'DENY' | 'LOG' | 'ALERT' | 'QUARANTINE';
  parameters?: Record<string, any>;
}

export interface TenantDataClassification {
  tenantId: string;
  classificationId: string;
  dataType: string;
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  retentionPeriod: number;
  encryptionRequired: boolean;
  accessControls: DataAccessControl[];
  auditRequired: boolean;
  geographicRestrictions?: string[];
}

export interface DataAccessControl {
  principal: string;
  principalType: 'USER' | 'ROLE' | 'SERVICE';
  permissions: string[];
  conditions?: Record<string, any>;
  expiresAt?: string;
}

export interface TenantNetworkIsolation {
  tenantId: string;
  vpcId?: string;
  subnetIds: string[];
  securityGroupIds: string[];
  networkAclIds: string[];
  routeTableIds: string[];
  natGatewayIds: string[];
  internetGatewayId?: string;
  vpnGatewayId?: string;
  peeringConnections: string[];
  transitGatewayAttachments: string[];
  isolation: {
    level: 'NONE' | 'BASIC' | 'STANDARD' | 'STRICT';
    crossTenantTrafficBlocked: boolean;
    internetAccessControlled: boolean;
    privateSubnetsUsed: boolean;
    networkMonitoringEnabled: boolean;
  };
}

export interface TenantAccessPattern {
  tenantId: string;
  patternId: string;
  resourceType: string;
  accessType: 'READ' | 'WRITE' | 'DELETE' | 'ADMIN';
  principalType: 'USER' | 'ROLE' | 'SERVICE' | 'API_KEY';
  principalId: string;
  frequency: number;
  lastAccess: string;
  sourceIp?: string;
  userAgent?: string;
  anomalyScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface TenantComplianceMapping {
  tenantId: string;
  framework: string;
  version: string;
  controls: ComplianceControl[];
  overallCompliance: number;
  lastAssessment: string;
  nextAssessment: string;
  certificationStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'CERTIFIED' | 'EXPIRED';
  certificationExpiry?: string;
}

export interface ComplianceControl {
  controlId: string;
  name: string;
  description: string;
  requirement: string;
  implementation: string;
  evidence: string[];
  status: 'NOT_IMPLEMENTED' | 'PARTIALLY_IMPLEMENTED' | 'IMPLEMENTED' | 'NOT_APPLICABLE';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  lastReview: string;
  nextReview: string;
  owner: string;
}

export interface TenantEncryptionPolicy {
  tenantId: string;
  policyId: string;
  name: string;
  description: string;
  encryptionAtRest: {
    required: boolean;
    algorithm: string;
    keyRotationEnabled: boolean;
    keyRotationPeriod: number;
  };
  encryptionInTransit: {
    required: boolean;
    minTlsVersion: string;
    cipherSuites: string[];
  };
  keyManagement: {
    provider: 'AWS_KMS' | 'CUSTOMER_MANAGED' | 'HYBRID';
    keyIds: string[];
    accessControls: string[];
  };
  dataTypes: string[];
  exceptions: EncryptionException[];
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface EncryptionException {
  exceptionId: string;
  dataType: string;
  reason: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt?: string;
  conditions: string[];
}

export interface TenantAuditConfiguration {
  tenantId: string;
  configurationId: string;
  auditScope: 'ALL' | 'SECURITY_EVENTS' | 'DATA_ACCESS' | 'ADMIN_ACTIONS' | 'CUSTOM';
  logDestinations: AuditLogDestination[];
  retentionPeriod: number;
  encryptionEnabled: boolean;
  integrityProtection: boolean;
  realTimeAlerting: boolean;
  complianceReporting: boolean;
  customFilters: AuditFilter[];
  status: 'ACTIVE' | 'INACTIVE';
}

export interface AuditLogDestination {
  type: 'CLOUDWATCH' | 'S3' | 'ELASTICSEARCH' | 'EXTERNAL_SIEM';
  configuration: Record<string, any>;
  enabled: boolean;
}

export interface AuditFilter {
  filterId: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  action: 'INCLUDE' | 'EXCLUDE' | 'ALERT';
  priority: number;
}

export interface TenantRiskAssessment {
  tenantId: string;
  assessmentId: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  categories: {
    dataRisk: number;
    accessRisk: number;
    networkRisk: number;
    complianceRisk: number;
    operationalRisk: number;
  };
  threats: ThreatAssessment[];
  vulnerabilities: VulnerabilityAssessment[];
  mitigations: RiskMitigation[];
  assessedAt: string;
  assessedBy: string;
  nextAssessment: string;
}

export interface ThreatAssessment {
  threatId: string;
  name: string;
  description: string;
  likelihood: number;
  impact: number;
  riskScore: number;
  category: string;
  sources: string[];
  indicators: string[];
}

export interface VulnerabilityAssessment {
  vulnerabilityId: string;
  name: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  cvssScore?: number;
  affectedResources: string[];
  exploitability: number;
  remediation: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ACCEPTED';
}

export interface RiskMitigation {
  mitigationId: string;
  name: string;
  description: string;
  type: 'PREVENTIVE' | 'DETECTIVE' | 'CORRECTIVE' | 'COMPENSATING';
  effectiveness: number;
  cost: number;
  implementation: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'IMPLEMENTED' | 'VERIFIED';
  owner: string;
  dueDate?: string;
}
