/**
 * Compliance framework and rule definitions
 */

export type ComplianceFramework = 'SOC2' | 'HIPAA' | 'GDPR' | 'PCI_DSS' | 'ISO27001';

export type ControlType = 'security' | 'availability' | 'processing_integrity' | 'confidentiality' | 'privacy';

export interface ComplianceControl {
  id: string;
  framework: ComplianceFramework;
  category: ControlType;
  title: string;
  description: string;
  requirements: string[];
  implementationGuidance?: string;
  references: ComplianceReference[];
}

export interface ComplianceReference {
  type: 'document' | 'standard' | 'guidance' | 'tool';
  title: string;
  url?: string;
  section?: string;
  version?: string;
}

// SOC 2 specific controls
export interface SOC2Control extends ComplianceControl {
  framework: 'SOC2';
  trustServiceCriteria: 'CC1' | 'CC2' | 'CC3' | 'CC4' | 'CC5' | 'CC6' | 'CC7' | 'CC8' | 'CC9';
  controlNumber: string;
}

// HIPAA specific controls
export interface HIPAAControl extends ComplianceControl {
  framework: 'HIPAA';
  safeguardCategory: 'administrative' | 'physical' | 'technical';
  standard: string;
}

// GDPR specific controls
export interface GDPRControl extends ComplianceControl {
  framework: 'GDPR';
  article: string;
  principle: string;
}

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  frameworks: ComplianceFramework[];
  controls: string[]; // Control IDs
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'data_protection' | 'access_control' | 'encryption' | 'monitoring' | 'network_security';
  enabled: boolean;
  autoRemediation: boolean;
  tags: string[];
}

// Deterministic rules from SRS
export interface DeterministicRule extends ComplianceRule {
  type: 'deterministic';
  checkFunction: string; // Lambda function name
  parameters: Record<string, unknown>;
  resourceTypes: string[]; // AWS resource types this rule applies to
}

export interface MLRule extends ComplianceRule {
  type: 'ml';
  modelId: string;
  confidenceThreshold: number;
  trainingData: string[]; // S3 paths to training data
}

export type RuleType = DeterministicRule | MLRule;

// Compliance assessment
export interface ComplianceAssessment {
  id: string;
  tenantId: string;
  framework: ComplianceFramework;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  totalControls: number;
  assessedControls: number;
  compliantControls: number;
  nonCompliantControls: number;
  findings: string[]; // Finding IDs
  score: number; // 0-100
  reportUrl?: string;
}

// Compliance mapping
export interface ComplianceMapping {
  resourceType: string;
  resourceArn: string;
  framework: ComplianceFramework;
  controls: string[];
  lastAssessed: string;
  complianceStatus: 'compliant' | 'non_compliant' | 'not_assessed';
}
