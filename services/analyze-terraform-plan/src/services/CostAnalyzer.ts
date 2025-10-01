/**
 * Cost Analyzer
 * 
 * Analyzes Terraform plans for cost optimization opportunities
 * and estimates the financial impact of infrastructure changes.
 */

import { TerraformPlan } from './TerraformPlanParser';
import { logger } from '../utils/logger';

export interface CostAnalysisResult {
  totalCost: number;
  monthlyCost: number;
  annualCost: number;
  costBreakdown: {
    compute: number;
    storage: number;
    network: number;
    database: number;
    other: number;
  };
  findings: Array<{
    id: string;
    type: 'cost';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    resource: string;
    rule: string;
    recommendation: string;
    evidence: any;
    potentialSavings: number;
    category: string;
  }>;
  recommendations: Array<{
    category: string;
    description: string;
    potentialSavings: number;
    effort: 'low' | 'medium' | 'high';
  }>;
}

export interface CostRule {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resourceTypes: string[];
  check: (resource: any, plan: TerraformPlan) => boolean;
  getRecommendation: (resource: any) => string;
  calculateSavings: (resource: any) => number;
}

export class CostAnalyzer {
  private rules: CostRule[];
  private pricingData: { [key: string]: any };

  constructor() {
    this.rules = this.initializeCostRules();
    this.pricingData = this.initializePricingData();
  }

  /**
   * Analyze Terraform plan for cost optimization opportunities
   */
  async analyzePlan(plan: TerraformPlan, scanOptions: any): Promise<CostAnalysisResult> {
    try {
      logger.info('Starting cost analysis', {
        totalResources: plan.resource_changes.length
      });

      const result: CostAnalysisResult = {
        totalCost: 0,
        monthlyCost: 0,
        annualCost: 0,
        costBreakdown: {
          compute: 0,
          storage: 0,
          network: 0,
          database: 0,
          other: 0
        },
        findings: [],
        recommendations: []
      };

      // Analyze each resource change
      for (const resourceChange of plan.resource_changes) {
        const resourceCost = await this.analyzeResourceCost(resourceChange, plan);
        const resourceFindings = await this.analyzeResource(resourceChange, plan, scanOptions);
        
        result.findings.push(...resourceFindings);
        result.totalCost += resourceCost.estimatedCost;
        result.costBreakdown[resourceCost.category] += resourceCost.estimatedCost;
      }

      // Calculate monthly and annual costs
      result.monthlyCost = result.totalCost;
      result.annualCost = result.totalCost * 12;

      // Generate recommendations
      result.recommendations = this.generateRecommendations(result.findings);

      logger.info('Cost analysis completed', {
        totalCost: result.totalCost,
        monthlyCost: result.monthlyCost,
        annualCost: result.annualCost,
        findingsCount: result.findings.length,
        recommendationsCount: result.recommendations.length
      });

      return result;

    } catch (error) {
      logger.error('Cost analysis failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Analyze individual resource cost
   */
  private async analyzeResourceCost(resourceChange: any, plan: TerraformPlan): Promise<{
    estimatedCost: number;
    category: 'compute' | 'storage' | 'network' | 'database' | 'other';
  }> {
    const resourceType = resourceChange.type;
    const after = resourceChange.change?.after;
    let estimatedCost = 0;
    let category: 'compute' | 'storage' | 'network' | 'database' | 'other' = 'other';

    try {
      switch (resourceType) {
        case 'aws_instance':
          estimatedCost = this.calculateEC2Cost(after);
          category = 'compute';
          break;

        case 'aws_s3_bucket':
          estimatedCost = this.calculateS3Cost(after);
          category = 'storage';
          break;

        case 'aws_ebs_volume':
          estimatedCost = this.calculateEBSCost(after);
          category = 'storage';
          break;

        case 'aws_db_instance':
        case 'aws_rds_cluster':
          estimatedCost = this.calculateRDSCost(after);
          category = 'database';
          break;

        case 'aws_lambda_function':
          estimatedCost = this.calculateLambdaCost(after);
          category = 'compute';
          break;

        case 'aws_lb':
        case 'aws_elb':
          estimatedCost = this.calculateLoadBalancerCost(after);
          category = 'network';
          break;

        case 'aws_cloudfront_distribution':
          estimatedCost = this.calculateCloudFrontCost(after);
          category = 'network';
          break;

        default:
          estimatedCost = 0;
          category = 'other';
          break;
      }

      return { estimatedCost, category };

    } catch (error) {
      logger.warn('Failed to calculate resource cost', {
        resourceType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { estimatedCost: 0, category: 'other' };
    }
  }

  /**
   * Analyze individual resource for cost optimization opportunities
   */
  private async analyzeResource(resourceChange: any, plan: TerraformPlan, scanOptions: any): Promise<any[]> {
    const findings: any[] = [];
    const resourceType = resourceChange.type;
    const resourceAddress = resourceChange.address;

    // Apply relevant cost rules
    for (const rule of this.rules) {
      if (rule.resourceTypes.includes(resourceType) || rule.resourceTypes.includes('*')) {
        try {
          const isCostIssue = rule.check(resourceChange, plan);
          
          if (isCostIssue) {
            const potentialSavings = rule.calculateSavings(resourceChange);
            
            const finding = {
              id: `${rule.id}-${resourceAddress}`,
              type: 'cost' as const,
              severity: rule.severity,
              title: rule.name,
              description: rule.description,
              resource: resourceAddress,
              rule: rule.id,
              recommendation: rule.getRecommendation(resourceChange),
              evidence: {
                resourceType,
                resourceAddress,
                category: rule.category,
                rule: rule.id
              },
              potentialSavings,
              category: rule.category
            };

            findings.push(finding);
          }
        } catch (error) {
          logger.warn('Cost rule check failed', {
            ruleId: rule.id,
            resourceType,
            resourceAddress,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    return findings;
  }

  /**
   * Calculate EC2 instance cost
   */
  private calculateEC2Cost(instance: any): number {
    if (!instance) return 0;

    const instanceType = instance.instance_type || 't3.micro';
    const pricing = this.pricingData.ec2[instanceType] || { hourly: 0.01 };
    
    return pricing.hourly * 24 * 30; // Monthly cost
  }

  /**
   * Calculate S3 bucket cost
   */
  private calculateS3Cost(bucket: any): number {
    if (!bucket) return 0;

    // Estimate based on typical usage
    const estimatedSize = 100; // GB
    const standardPrice = 0.023; // per GB per month
    
    return estimatedSize * standardPrice;
  }

  /**
   * Calculate EBS volume cost
   */
  private calculateEBSCost(volume: any): number {
    if (!volume) return 0;

    const size = volume.size || 20; // GB
    const type = volume.type || 'gp3';
    const pricing = this.pricingData.ebs[type] || { gb: 0.08 };
    
    return size * pricing.gb;
  }

  /**
   * Calculate RDS instance cost
   */
  private calculateRDSCost(instance: any): number {
    if (!instance) return 0;

    const instanceClass = instance.instance_class || 'db.t3.micro';
    const pricing = this.pricingData.rds[instanceClass] || { hourly: 0.017 };
    
    return pricing.hourly * 24 * 30; // Monthly cost
  }

  /**
   * Calculate Lambda function cost
   */
  private calculateLambdaCost(function_: any): number {
    if (!function_) return 0;

    // Estimate based on typical usage
    const estimatedInvocations = 1000000; // per month
    const estimatedDuration = 100; // ms
    const memory = function_.memory_size || 128; // MB
    
    const invocationCost = estimatedInvocations * 0.0000002;
    const durationCost = (estimatedInvocations * estimatedDuration * memory) / 1024 * 0.0000166667;
    
    return invocationCost + durationCost;
  }

  /**
   * Calculate Load Balancer cost
   */
  private calculateLoadBalancerCost(lb: any): number {
    if (!lb) return 0;

    const type = lb.load_balancer_type || 'application';
    const pricing = this.pricingData.lb[type] || { hourly: 0.0225 };
    
    return pricing.hourly * 24 * 30; // Monthly cost
  }

  /**
   * Calculate CloudFront distribution cost
   */
  private calculateCloudFrontCost(distribution: any): number {
    if (!distribution) return 0;

    // Estimate based on typical usage
    const estimatedDataTransfer = 1000; // GB per month
    const pricing = 0.085; // per GB
    
    return estimatedDataTransfer * pricing;
  }

  /**
   * Generate cost optimization recommendations
   */
  private generateRecommendations(findings: any[]): Array<{
    category: string;
    description: string;
    potentialSavings: number;
    effort: 'low' | 'medium' | 'high';
  }> {
    const recommendations: Array<{
      category: string;
      description: string;
      potentialSavings: number;
      effort: 'low' | 'medium' | 'high';
    }> = [];

    // Group findings by category
    const categoryGroups: { [key: string]: any[] } = {};
    findings.forEach(finding => {
      if (!categoryGroups[finding.category]) {
        categoryGroups[finding.category] = [];
      }
      categoryGroups[finding.category].push(finding);
    });

    // Generate recommendations for each category
    Object.entries(categoryGroups).forEach(([category, categoryFindings]) => {
      const totalSavings = categoryFindings.reduce((sum, finding) => sum + finding.potentialSavings, 0);
      
      if (totalSavings > 0) {
        recommendations.push({
          category,
          description: this.getCategoryRecommendation(category, categoryFindings.length),
          potentialSavings: totalSavings,
          effort: this.getCategoryEffort(category)
        });
      }
    });

    return recommendations.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  /**
   * Get category-specific recommendation
   */
  private getCategoryRecommendation(category: string, findingCount: number): string {
    switch (category) {
      case 'compute':
        return `Optimize ${findingCount} compute resources to reduce costs`;
      case 'storage':
        return `Optimize ${findingCount} storage resources to reduce costs`;
      case 'network':
        return `Optimize ${findingCount} network resources to reduce costs`;
      case 'database':
        return `Optimize ${findingCount} database resources to reduce costs`;
      default:
        return `Optimize ${findingCount} resources to reduce costs`;
    }
  }

  /**
   * Get category-specific effort level
   */
  private getCategoryEffort(category: string): 'low' | 'medium' | 'high' {
    switch (category) {
      case 'storage':
        return 'low';
      case 'compute':
        return 'medium';
      case 'network':
        return 'medium';
      case 'database':
        return 'high';
      default:
        return 'medium';
    }
  }

  /**
   * Initialize cost rules
   */
  private initializeCostRules(): CostRule[] {
    return [
      // EC2 Cost Rules
      {
        id: 'ec2-oversized-instance',
        name: 'Oversized EC2 Instance',
        description: 'EC2 instance may be oversized for its workload',
        category: 'compute',
        severity: 'medium',
        resourceTypes: ['aws_instance'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          const instanceType = after?.instance_type;
          return instanceType && this.isOversizedInstance(instanceType);
        },
        getRecommendation: (resource) => 'Consider downsizing to a smaller instance type',
        calculateSavings: (resource) => {
          const after = resource.change?.after;
          const instanceType = after?.instance_type;
          return this.calculateInstanceDownsizingSavings(instanceType);
        }
      },
      {
        id: 'ec2-reserved-instance',
        name: 'EC2 Reserved Instance Opportunity',
        description: 'Consider Reserved Instances for cost savings',
        category: 'compute',
        severity: 'low',
        resourceTypes: ['aws_instance'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.instance_type && this.isReservedInstanceCandidate(after.instance_type);
        },
        getRecommendation: (resource) => 'Consider Reserved Instances for 1-3 year commitment',
        calculateSavings: (resource) => {
          const after = resource.change?.after;
          const instanceType = after?.instance_type;
          return this.calculateReservedInstanceSavings(instanceType);
        }
      },

      // S3 Cost Rules
      {
        id: 's3-storage-class',
        name: 'S3 Storage Class Optimization',
        description: 'S3 bucket may benefit from different storage classes',
        category: 'storage',
        severity: 'low',
        resourceTypes: ['aws_s3_bucket'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return !after?.lifecycle_rule;
        },
        getRecommendation: (resource) => 'Implement lifecycle rules to transition to cheaper storage classes',
        calculateSavings: (resource) => 50 // Estimated monthly savings
      },

      // EBS Cost Rules
      {
        id: 'ebs-volume-type',
        name: 'EBS Volume Type Optimization',
        description: 'EBS volume may benefit from a different volume type',
        category: 'storage',
        severity: 'medium',
        resourceTypes: ['aws_ebs_volume'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.type === 'gp2' && after?.size > 100;
        },
        getRecommendation: (resource) => 'Consider gp3 for better price-performance ratio',
        calculateSavings: (resource) => {
          const after = resource.change?.after;
          const size = after?.size || 100;
          return size * 0.02; // Estimated savings per GB
        }
      },

      // RDS Cost Rules
      {
        id: 'rds-oversized-instance',
        name: 'Oversized RDS Instance',
        description: 'RDS instance may be oversized for its workload',
        category: 'database',
        severity: 'medium',
        resourceTypes: ['aws_db_instance', 'aws_rds_cluster'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          const instanceClass = after?.instance_class;
          return instanceClass && this.isOversizedRDSInstance(instanceClass);
        },
        getRecommendation: (resource) => 'Consider downsizing to a smaller instance class',
        calculateSavings: (resource) => {
          const after = resource.change?.after;
          const instanceClass = after?.instance_class;
          return this.calculateRDSDownsizingSavings(instanceClass);
        }
      },

      // Lambda Cost Rules
      {
        id: 'lambda-memory-optimization',
        name: 'Lambda Memory Optimization',
        description: 'Lambda function memory may be optimized',
        category: 'compute',
        severity: 'low',
        resourceTypes: ['aws_lambda_function'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          const memory = after?.memory_size;
          return memory && memory > 512;
        },
        getRecommendation: (resource) => 'Consider reducing memory allocation if not needed',
        calculateSavings: (resource) => {
          const after = resource.change?.after;
          const memory = after?.memory_size || 512;
          return (memory - 512) * 0.0000166667 * 1000000; // Estimated monthly savings
        }
      }
    ];
  }

  /**
   * Initialize pricing data
   */
  private initializePricingData(): { [key: string]: any } {
    return {
      ec2: {
        't3.micro': { hourly: 0.0104 },
        't3.small': { hourly: 0.0208 },
        't3.medium': { hourly: 0.0416 },
        't3.large': { hourly: 0.0832 },
        'm5.large': { hourly: 0.096 },
        'm5.xlarge': { hourly: 0.192 },
        'c5.large': { hourly: 0.085 },
        'c5.xlarge': { hourly: 0.17 }
      },
      ebs: {
        'gp2': { gb: 0.10 },
        'gp3': { gb: 0.08 },
        'io1': { gb: 0.125 },
        'io2': { gb: 0.125 }
      },
      rds: {
        'db.t3.micro': { hourly: 0.017 },
        'db.t3.small': { hourly: 0.034 },
        'db.t3.medium': { hourly: 0.068 },
        'db.m5.large': { hourly: 0.115 },
        'db.m5.xlarge': { hourly: 0.23 }
      },
      lb: {
        'application': { hourly: 0.0225 },
        'network': { hourly: 0.0225 },
        'classic': { hourly: 0.025 }
      }
    };
  }

  /**
   * Check if instance is oversized
   */
  private isOversizedInstance(instanceType: string): boolean {
    const oversizedTypes = ['m5.xlarge', 'c5.xlarge', 'r5.xlarge'];
    return oversizedTypes.includes(instanceType);
  }

  /**
   * Check if instance is a good candidate for Reserved Instances
   */
  private isReservedInstanceCandidate(instanceType: string): boolean {
    const candidateTypes = ['m5.large', 'm5.xlarge', 'c5.large', 'c5.xlarge'];
    return candidateTypes.includes(instanceType);
  }

  /**
   * Check if RDS instance is oversized
   */
  private isOversizedRDSInstance(instanceClass: string): boolean {
    const oversizedClasses = ['db.m5.xlarge', 'db.r5.xlarge', 'db.c5.xlarge'];
    return oversizedClasses.includes(instanceClass);
  }

  /**
   * Calculate instance downsizing savings
   */
  private calculateInstanceDownsizingSavings(instanceType: string): number {
    const savingsMap: { [key: string]: number } = {
      'm5.xlarge': 50,
      'c5.xlarge': 45,
      'r5.xlarge': 55
    };
    return savingsMap[instanceType] || 0;
  }

  /**
   * Calculate Reserved Instance savings
   */
  private calculateReservedInstanceSavings(instanceType: string): number {
    const savingsMap: { [key: string]: number } = {
      'm5.large': 30,
      'm5.xlarge': 60,
      'c5.large': 25,
      'c5.xlarge': 50
    };
    return savingsMap[instanceType] || 0;
  }

  /**
   * Calculate RDS downsizing savings
   */
  private calculateRDSDownsizingSavings(instanceClass: string): number {
    const savingsMap: { [key: string]: number } = {
      'db.m5.xlarge': 80,
      'db.r5.xlarge': 90,
      'db.c5.xlarge': 70
    };
    return savingsMap[instanceClass] || 0;
  }
}
