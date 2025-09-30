/**
 * Main compliance rules engine that orchestrates rule execution
 */

import {
  AWSResource,
  ComplianceFramework,
  Severity,
  Finding,
} from '@compliance-shepherd/shared';
import {
  RuleExecutor,
  RuleExecutionContext,
  RuleExecutionResult,
  RulesEngineConfig,
  RuleExecutionStats,
  RuleResultAggregation,
  RuleRegistryEntry,
  RuleFactory,
  RuleExecutionPlan,
  RuleDependency,
} from '../types';
import { BaseRuleExecutor } from './BaseRuleExecutor';

// Import all rule implementations
import { S3DefaultEncryptionRule, S3PublicAccessBlockRule, S3VersioningRule } from '../rules/S3Rules';
import { IAMRootMfaRule, IAMPasswordPolicyRule, IAMWildcardPermissionsRule } from '../rules/IAMRules';
import { SecurityGroupRestrictiveRules, SecurityGroupNoPublicAccessRule } from '../rules/SecurityGroupRules';
import { CloudTrailMultiRegionRule, CloudTrailImmutableLogsRule, CloudTrailLogValidationRule } from '../rules/CloudTrailRules';

export class ComplianceRulesEngine {
  private ruleRegistry: Map<string, RuleRegistryEntry> = new Map();
  private ruleFactory: RuleFactory;

  constructor() {
    this.ruleFactory = new DefaultRuleFactory();
    this.initializeRules();
  }

  /**
   * Execute compliance rules against a list of resources
   */
  async executeRules(
    resources: AWSResource[],
    context: RuleExecutionContext,
    config: RulesEngineConfig = this.getDefaultConfig()
  ): Promise<{
    results: RuleResultAggregation[];
    stats: RuleExecutionStats;
  }> {
    const startTime = Date.now();
    const results: RuleResultAggregation[] = [];
    const allRuleResults: RuleExecutionResult[] = [];

    // Create execution plan
    const executionPlan = this.createExecutionPlan(resources, context, config);

    // Execute rules according to the plan
    for (const resource of resources) {
      const resourceResults = await this.executeRulesForResource(
        resource,
        context,
        config,
        executionPlan
      );
      
      allRuleResults.push(...resourceResults);
      results.push(this.aggregateResultsForResource(resource, resourceResults));
    }

    const totalExecutionTime = Date.now() - startTime;
    const stats = this.calculateStats(allRuleResults, totalExecutionTime);

    return { results, stats };
  }

  /**
   * Execute a specific rule against a resource
   */
  async executeRule(
    ruleId: string,
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig = this.getDefaultConfig()
  ): Promise<RuleExecutionResult> {
    const ruleEntry = this.ruleRegistry.get(ruleId);
    if (!ruleEntry) {
      throw new Error(`Rule ${ruleId} not found in registry`);
    }

    // Validate rule can be executed against resource
    const canExecute = await ruleEntry.executor.validate(resource, context);
    if (!canExecute) {
      return {
        ruleId,
        resourceArn: resource.arn,
        passed: true,
        severity: 'info',
        message: `Rule ${ruleId} is not applicable to resource type ${resource.type}`,
        evidence: [],
        recommendations: [],
        metadata: {
          skipped: true,
          reason: 'Resource type not supported',
        },
        executionTime: 0,
      };
    }

    // Execute the rule
    const result = await ruleEntry.executor.execute(resource, context, config);
    
    // Update usage statistics
    ruleEntry.usageCount++;
    ruleEntry.lastUsed = new Date().toISOString();

    return result;
  }

  /**
   * Get all available rules
   */
  getAllRules(): RuleRegistryEntry[] {
    return Array.from(this.ruleRegistry.values());
  }

  /**
   * Get rules for a specific service
   */
  getRulesForService(service: string): RuleRegistryEntry[] {
    return Array.from(this.ruleRegistry.values())
      .filter(entry => entry.rule.service === service);
  }

  /**
   * Get rules for a specific framework
   */
  getRulesForFramework(framework: ComplianceFramework): RuleRegistryEntry[] {
    return Array.from(this.ruleRegistry.values())
      .filter(entry => entry.rule.frameworks.includes(framework));
  }

  /**
   * Register a new rule
   */
  registerRule(rule: RuleExecutor): void {
    const metadata = rule.getRuleMetadata();
    const entry: RuleRegistryEntry = {
      ruleId: metadata.ruleId,
      rule: {
        id: metadata.ruleId,
        name: metadata.ruleName,
        description: '',
        frameworks: metadata.frameworks,
        controls: [],
        severity: metadata.severity,
        category: '',
        resourceTypes: metadata.resourceTypes,
        service: metadata.service,
        enabled: true,
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        createdBy: 'system',
      },
      executor: rule,
      dependencies: [],
      usageCount: 0,
    };

    this.ruleRegistry.set(metadata.ruleId, entry);
  }

  /**
   * Create execution plan for resources
   */
  private createExecutionPlan(
    resources: AWSResource[],
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): RuleExecutionPlan {
    const applicableRules = this.getApplicableRules(resources);
    const executionOrder = this.calculateExecutionOrder(applicableRules);
    const parallelGroups = this.groupParallelExecution(executionOrder, config);

    return {
      rules: applicableRules.map(rule => rule.ruleId),
      executionOrder,
      estimatedDuration: this.estimateExecutionDuration(applicableRules),
      parallelGroups,
      dependencies: new Map(),
    };
  }

  /**
   * Execute rules for a specific resource
   */
  private async executeRulesForResource(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig,
    plan: RuleExecutionPlan
  ): Promise<RuleExecutionResult[]> {
    const results: RuleExecutionResult[] = [];

    // Execute rules in parallel groups if configured
    if (config.parallel && config.maxConcurrency > 1) {
      const chunks = this.chunkArray(plan.parallelGroups, config.maxConcurrency);
      
      for (const chunk of chunks) {
        const promises = chunk.flat().map(ruleId => 
          this.executeRule(ruleId, resource, context, config)
        );
        
        const chunkResults = await Promise.all(promises);
        results.push(...chunkResults);
      }
    } else {
      // Execute rules sequentially
      for (const ruleId of plan.rules) {
        const result = await this.executeRule(ruleId, resource, context, config);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Aggregate results for a resource
   */
  private aggregateResultsForResource(
    resource: AWSResource,
    results: RuleExecutionResult[]
  ): RuleResultAggregation {
    const passedRules = results.filter(r => r.passed).length;
    const failedRules = results.filter(r => !r.passed).length;
    const totalRules = results.length;

    const findings = this.createFindingsFromResults(resource, results);
    const frameworks = this.extractFrameworks(results);
    const overallSeverity = this.calculateOverallSeverity(results);

    const complianceScore = totalRules > 0 ? (passedRules / totalRules) * 100 : 100;

    return {
      resourceArn: resource.arn,
      totalRules,
      passedRules,
      failedRules,
      findings,
      complianceScore,
      frameworks,
      overallSeverity,
      summary: `${passedRules}/${totalRules} rules passed (${complianceScore.toFixed(1)}% compliance)`,
    };
  }

  /**
   * Calculate execution statistics
   */
  private calculateStats(
    results: RuleExecutionResult[],
    totalExecutionTime: number
  ): RuleExecutionStats {
    const totalRules = results.length;
    const passedRules = results.filter(r => r.passed).length;
    const failedRules = results.filter(r => !r.passed).length;
    const skippedRules = results.filter(r => r.metadata?.skipped).length;

    const averageExecutionTime = totalRules > 0 ? 
      results.reduce((sum, r) => sum + r.executionTime, 0) / totalRules : 0;

    const findingsBySeverity = results.reduce((acc, result) => {
      if (!result.passed && result.severity) {
        acc[result.severity] = (acc[result.severity] || 0) + 1;
      }
      return acc;
    }, {} as Record<Severity, number>);

    const findingsByService = results.reduce((acc, result) => {
      const service = result.metadata?.service as string;
      if (service) {
        acc[service] = (acc[service] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRules,
      executedRules: totalRules - skippedRules,
      passedRules,
      failedRules,
      skippedRules,
      totalExecutionTime,
      averageExecutionTime,
      findingsBySeverity,
      findingsByService,
    };
  }

  /**
   * Get applicable rules for resources
   */
  private getApplicableRules(resources: AWSResource[]): RuleRegistryEntry[] {
    const resourceTypes = new Set(resources.map(r => r.type));
    
    return Array.from(this.ruleRegistry.values())
      .filter(entry => {
        return entry.rule.resourceTypes.some(type => 
          resourceTypes.has(type) || 
          resourceTypes.has(type.replace('AWS::', ''))
        );
      });
  }

  /**
   * Calculate execution order based on dependencies
   */
  private calculateExecutionOrder(rules: RuleRegistryEntry[]): RuleDependency[] {
    // Simple implementation - in practice, you'd implement topological sorting
    return rules.map((rule, index) => ({
      ruleId: rule.ruleId,
      dependsOn: rule.dependencies,
      optional: false,
      executionOrder: index,
    }));
  }

  /**
   * Group rules for parallel execution
   */
  private groupParallelExecution(
    executionOrder: RuleDependency[],
    config: RulesEngineConfig
  ): string[][] {
    if (!config.parallel) {
      return executionOrder.map(dep => [dep.ruleId]);
    }

    // Simple grouping - in practice, you'd consider dependencies
    const groups: string[][] = [];
    const groupSize = config.maxConcurrency;

    for (let i = 0; i < executionOrder.length; i += groupSize) {
      const group = executionOrder.slice(i, i + groupSize).map(dep => dep.ruleId);
      groups.push(group);
    }

    return groups;
  }

  /**
   * Estimate execution duration
   */
  private estimateExecutionDuration(rules: RuleRegistryEntry[]): number {
    // Simple estimation - in practice, you'd use historical data
    return rules.length * 1000; // 1 second per rule
  }

  /**
   * Create findings from rule results
   */
  private createFindingsFromResults(
    resource: AWSResource,
    results: RuleExecutionResult[]
  ): Finding[] {
    return results
      .filter(result => !result.passed)
      .map(result => ({
        id: `finding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        tenantId: '',
        findingId: result.ruleId,
        resourceArn: resource.arn,
        resourceType: resource.type,
        service: resource.tags?.['service'] || 'unknown',
        region: resource.region,
        accountId: resource.accountId,
        framework: 'SOC2', // Default - should be extracted from rule
        controlId: result.ruleId,
        controlTitle: result.metadata?.ruleName as string || '',
        severity: result.severity || 'medium',
        title: result.message,
        description: result.message,
        risk: result.recommendations[0] || 'Risk assessment needed',
        recommendation: result.recommendations.join('; '),
        evidence: result.evidence.map(ev => ({
          type: ev.type as any,
          description: ev.description,
          data: ev.data,
          timestamp: ev.timestamp,
          source: ev.source,
        })),
        references: [],
        status: 'active' as const,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        remediation: {
          type: 'manual_guidance',
          description: result.recommendations.join('; '),
          steps: [],
          estimatedEffort: 'medium',
          requiresApproval: true,
          automated: false,
        },
        tags: [],
        hash: `${result.ruleId}-${resource.arn}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
  }

  /**
   * Extract frameworks from results
   */
  private extractFrameworks(results: RuleExecutionResult[]): ComplianceFramework[] {
    const frameworks = new Set<ComplianceFramework>();
    
    for (const result of results) {
      const ruleEntry = this.ruleRegistry.get(result.ruleId);
      if (ruleEntry) {
        ruleEntry.rule.frameworks.forEach(framework => frameworks.add(framework));
      }
    }

    return Array.from(frameworks);
  }

  /**
   * Calculate overall severity
   */
  private calculateOverallSeverity(results: RuleExecutionResult[]): Severity {
    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    let maxSeverityIndex = -1;

    for (const result of results) {
      if (!result.passed && result.severity) {
        const index = severityOrder.indexOf(result.severity);
        if (index > maxSeverityIndex) {
          maxSeverityIndex = index;
        }
      }
    }

    return maxSeverityIndex >= 0 ? severityOrder[maxSeverityIndex] as Severity : 'info';
  }

  /**
   * Initialize default rules
   */
  private initializeRules(): void {
    // S3 rules
    this.registerRule(new S3DefaultEncryptionRule());
    this.registerRule(new S3PublicAccessBlockRule());
    this.registerRule(new S3VersioningRule());

    // IAM rules
    this.registerRule(new IAMRootMfaRule());
    this.registerRule(new IAMPasswordPolicyRule());
    this.registerRule(new IAMWildcardPermissionsRule());

    // Security Group rules
    this.registerRule(new SecurityGroupRestrictiveRules());
    this.registerRule(new SecurityGroupNoPublicAccessRule());

    // CloudTrail rules
    this.registerRule(new CloudTrailMultiRegionRule());
    this.registerRule(new CloudTrailImmutableLogsRule());
    this.registerRule(new CloudTrailLogValidationRule());
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): RulesEngineConfig {
    return {
      parallel: true,
      maxConcurrency: 5,
      timeout: 300,
      retryCount: 3,
      includeEvidence: true,
      includeRecommendations: true,
      dryRun: false,
    };
  }

  /**
   * Utility function to chunk array
   */
  private chunkArray<T>(array: T[][], size: number): T[][][] {
    const chunks: T[][][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

/**
 * Default rule factory implementation
 */
class DefaultRuleFactory implements RuleFactory {
  createRule(definition: any): RuleExecutor {
    // This would create rules based on definition
    throw new Error('Not implemented');
  }

  getSupportedServices(): string[] {
    return ['S3', 'IAM', 'EC2', 'CloudTrail'];
  }

  getSupportedResourceTypes(): string[] {
    return [
      'AWS::S3::Bucket',
      'AWS::IAM::User',
      'AWS::IAM::Role',
      'AWS::IAM::Policy',
      'AWS::EC2::SecurityGroup',
      'AWS::CloudTrail::Trail',
    ];
  }
}
