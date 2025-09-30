/**
 * Types specific to the compliance rules engine
 */

import {
  Finding,
  ComplianceFramework,
  Severity,
  AWSResource,
  ComplianceControl,
  DeterministicRule,
  MLRule,
  RuleType,
} from '@compliance-shepherd/shared';

// Rule execution context
export interface RuleExecutionContext {
  tenantId: string;
  accountId: string;
  region: string;
  userId?: string;
  scanId?: string;
  timestamp: string;
}

// Rule execution result
export interface RuleExecutionResult {
  ruleId: string;
  resourceArn: string;
  passed: boolean;
  severity?: Severity;
  message: string;
  evidence: RuleEvidence[];
  recommendations: string[];
  metadata: Record<string, unknown>;
  executionTime: number; // milliseconds
}

// Evidence collected during rule execution
export interface RuleEvidence {
  type: 'configuration' | 'api_response' | 'log' | 'metric' | 'policy';
  description: string;
  data: Record<string, unknown>;
  timestamp: string;
  source: string;
}

// Rule definition interface
export interface ComplianceRuleDefinition {
  id: string;
  name: string;
  description: string;
  frameworks: ComplianceFramework[];
  controls: string[];
  severity: Severity;
  category: string;
  resourceTypes: string[];
  service: string;
  enabled: boolean;
  version: string;
  lastUpdated: string;
  createdBy: string;
}

// Deterministic rule definition
export interface DeterministicRuleDefinition extends ComplianceRuleDefinition {
  type: 'deterministic';
  checkFunction: string;
  parameters: Record<string, unknown>;
  remediationSteps: RemediationStep[];
}

// ML rule definition
export interface MLRuleDefinition extends ComplianceRuleDefinition {
  type: 'ml';
  modelId: string;
  confidenceThreshold: number;
  trainingData: string[];
  features: string[];
}

// Remediation step
export interface RemediationStep {
  order: number;
  action: string;
  description: string;
  command?: string;
  terraform?: string;
  parameters?: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high';
}

// Rule engine configuration
export interface RulesEngineConfig {
  parallel: boolean;
  maxConcurrency: number;
  timeout: number;
  retryCount: number;
  includeEvidence: boolean;
  includeRecommendations: boolean;
  dryRun: boolean;
}

// Rule execution statistics
export interface RuleExecutionStats {
  totalRules: number;
  executedRules: number;
  passedRules: number;
  failedRules: number;
  skippedRules: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  findingsBySeverity: Record<Severity, number>;
  findingsByService: Record<string, number>;
}

// Resource scan context
export interface ResourceScanContext {
  resource: AWSResource;
  configuration: Record<string, unknown>;
  tags: Record<string, string>;
  metadata: Record<string, unknown>;
  scanHistory?: Finding[];
}

// Rule registry entry
export interface RuleRegistryEntry {
  ruleId: string;
  rule: ComplianceRuleDefinition;
  executor: RuleExecutor;
  dependencies: string[];
  lastUsed?: string;
  usageCount: number;
}

// Rule executor interface
export interface RuleExecutor {
  execute(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<RuleExecutionResult>;
  
  validate(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<boolean>;
  
  getRemediationSteps(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<RemediationStep[]>;
}

// Rule factory interface
export interface RuleFactory {
  createRule(definition: ComplianceRuleDefinition): RuleExecutor;
  getSupportedServices(): string[];
  getSupportedResourceTypes(): string[];
}

// Rule validation result
export interface RuleValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// Rule performance metrics
export interface RulePerformanceMetrics {
  ruleId: string;
  executionCount: number;
  averageExecutionTime: number;
  successRate: number;
  lastExecution: string;
  slowestExecution: number;
  fastestExecution: number;
}

// Rule dependency graph
export interface RuleDependency {
  ruleId: string;
  dependsOn: string[];
  optional: boolean;
  executionOrder: number;
}

// Rule execution plan
export interface RuleExecutionPlan {
  rules: string[];
  executionOrder: RuleDependency[];
  estimatedDuration: number;
  parallelGroups: string[][];
  dependencies: Map<string, string[]>;
}

// Rule result aggregation
export interface RuleResultAggregation {
  resourceArn: string;
  totalRules: number;
  passedRules: number;
  failedRules: number;
  findings: Finding[];
  complianceScore: number;
  frameworks: ComplianceFramework[];
  overallSeverity: Severity;
  summary: string;
}

// Rule configuration validation
export interface RuleConfigValidation {
  valid: boolean;
  errors: ConfigValidationError[];
  warnings: ConfigValidationWarning[];
}

export interface ConfigValidationError {
  field: string;
  message: string;
  code: string;
  value?: unknown;
}

export interface ConfigValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}
