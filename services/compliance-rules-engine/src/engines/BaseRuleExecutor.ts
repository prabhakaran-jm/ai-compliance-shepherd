/**
 * Base class for all compliance rule executors
 */

import {
  AWSResource,
  Finding,
  Severity,
  ComplianceFramework,
} from '@compliance-shepherd/shared';
import {
  RuleExecutor,
  RuleExecutionContext,
  RuleExecutionResult,
  RuleEvidence,
  RemediationStep,
  RulesEngineConfig,
} from '../types';

export abstract class BaseRuleExecutor implements RuleExecutor {
  protected ruleId: string;
  protected ruleName: string;
  protected frameworks: ComplianceFramework[];
  protected severity: Severity;
  protected resourceTypes: string[];
  protected service: string;

  constructor(
    ruleId: string,
    ruleName: string,
    frameworks: ComplianceFramework[],
    severity: Severity,
    resourceTypes: string[],
    service: string
  ) {
    this.ruleId = ruleId;
    this.ruleName = ruleName;
    this.frameworks = frameworks;
    this.severity = severity;
    this.resourceTypes = resourceTypes;
    this.service = service;
  }

  /**
   * Execute the compliance rule against a resource
   */
  async execute(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<RuleExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Validate resource type compatibility
      if (!this.isResourceTypeSupported(resource.type)) {
        return this.createSkippedResult(
          resource.arn,
          `Resource type ${resource.type} not supported by rule ${this.ruleId}`
        );
      }

      // Perform the actual compliance check
      const checkResult = await this.performCheck(resource, context, config);
      
      // Collect evidence if requested
      const evidence = config.includeEvidence 
        ? await this.collectEvidence(resource, context, config)
        : [];

      // Generate recommendations if requested
      const recommendations = config.includeRecommendations
        ? await this.generateRecommendations(resource, context, checkResult)
        : [];

      const executionTime = Date.now() - startTime;

      return {
        ruleId: this.ruleId,
        resourceArn: resource.arn,
        passed: checkResult.passed,
        severity: checkResult.severity || this.severity,
        message: checkResult.message,
        evidence,
        recommendations,
        metadata: {
          ruleName: this.ruleName,
          frameworks: this.frameworks,
          service: this.service,
          executionTime,
          timestamp: new Date().toISOString(),
        },
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        ruleId: this.ruleId,
        resourceArn: resource.arn,
        passed: false,
        severity: 'high',
        message: `Rule execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        evidence: [],
        recommendations: ['Review rule configuration and resource permissions'],
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime,
          timestamp: new Date().toISOString(),
        },
        executionTime,
      };
    }
  }

  /**
   * Validate if the rule can be executed against the resource
   */
  async validate(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<boolean> {
    // Check if resource type is supported
    if (!this.isResourceTypeSupported(resource.type)) {
      return false;
    }

    // Check if service is supported
    if (resource.type.split('::')[0] !== this.service) {
      return false;
    }

    // Additional validation can be implemented by subclasses
    return await this.performValidation(resource, context);
  }

  /**
   * Get remediation steps for failed compliance checks
   */
  async getRemediationSteps(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<RemediationStep[]> {
    return await this.generateRemediationSteps(resource, context);
  }

  /**
   * Check if resource type is supported by this rule
   */
  protected isResourceTypeSupported(resourceType: string): boolean {
    return this.resourceTypes.some(type => 
      resourceType === type || resourceType.endsWith(type)
    );
  }

  /**
   * Create a skipped result for unsupported resources
   */
  protected createSkippedResult(resourceArn: string, reason: string): RuleExecutionResult {
    return {
      ruleId: this.ruleId,
      resourceArn,
      passed: true,
      severity: 'info',
      message: `Skipped: ${reason}`,
      evidence: [],
      recommendations: [],
      metadata: {
        skipped: true,
        reason,
        timestamp: new Date().toISOString(),
      },
      executionTime: 0,
    };
  }

  /**
   * Abstract method to be implemented by subclasses
   * Perform the actual compliance check
   */
  protected abstract performCheck(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<{
    passed: boolean;
    severity?: Severity;
    message: string;
  }>;

  /**
   * Abstract method to be implemented by subclasses
   * Collect evidence for the compliance check
   */
  protected abstract collectEvidence(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<RuleEvidence[]>;

  /**
   * Abstract method to be implemented by subclasses
   * Generate recommendations for failed checks
   */
  protected abstract generateRecommendations(
    resource: AWSResource,
    context: RuleExecutionContext,
    checkResult: { passed: boolean; severity?: Severity; message: string }
  ): Promise<string[]>;

  /**
   * Abstract method to be implemented by subclasses
   * Generate remediation steps
   */
  protected abstract generateRemediationSteps(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<RemediationStep[]>;

  /**
   * Abstract method to be implemented by subclasses
   * Perform additional validation
   */
  protected abstract performValidation(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<boolean>;

  /**
   * Create evidence object
   */
  protected createEvidence(
    type: 'configuration' | 'api_response' | 'log' | 'metric' | 'policy',
    description: string,
    data: Record<string, unknown>,
    source: string
  ): RuleEvidence {
    return {
      type,
      description,
      data,
      timestamp: new Date().toISOString(),
      source,
    };
  }

  /**
   * Create remediation step
   */
  protected createRemediationStep(
    order: number,
    action: string,
    description: string,
    riskLevel: 'low' | 'medium' | 'high',
    command?: string,
    terraform?: string,
    parameters?: Record<string, unknown>
  ): RemediationStep {
    return {
      order,
      action,
      description,
      command,
      terraform,
      parameters,
      riskLevel,
    };
  }

  /**
   * Get rule metadata
   */
  public getRuleMetadata() {
    return {
      ruleId: this.ruleId,
      ruleName: this.ruleName,
      frameworks: this.frameworks,
      severity: this.severity,
      resourceTypes: this.resourceTypes,
      service: this.service,
    };
  }
}
