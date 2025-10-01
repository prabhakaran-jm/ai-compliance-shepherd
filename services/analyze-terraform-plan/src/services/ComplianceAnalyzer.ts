/**
 * Compliance Analyzer
 * 
 * Analyzes Terraform plans for compliance violations against
 * various frameworks (SOC 2, HIPAA, GDPR, etc.).
 */

import { TerraformPlan } from './TerraformPlanParser';
import { logger } from '../utils/logger';

export interface ComplianceAnalysisResult {
  score: number;
  findings: Array<{
    id: string;
    type: 'compliance';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    resource: string;
    rule: string;
    recommendation: string;
    evidence: any;
    framework: string;
    control: string;
  }>;
  frameworkScores: { [framework: string]: number };
  controlScores: { [control: string]: number };
}

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  frameworks: string[];
  controls: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  resourceTypes: string[];
  check: (resource: any, plan: TerraformPlan) => boolean;
  getRecommendation: (resource: any) => string;
}

export class ComplianceAnalyzer {
  private rules: ComplianceRule[];

  constructor() {
    this.rules = this.initializeComplianceRules();
  }

  /**
   * Analyze Terraform plan for compliance violations
   */
  async analyzePlan(plan: TerraformPlan, scanOptions: any): Promise<ComplianceAnalysisResult> {
    try {
      logger.info('Starting compliance analysis', {
        totalResources: plan.resource_changes.length,
        frameworks: scanOptions.frameworks || ['SOC2', 'HIPAA', 'GDPR']
      });

      const result: ComplianceAnalysisResult = {
        score: 100, // Start with perfect score
        findings: [],
        frameworkScores: {},
        controlScores: {}
      };

      // Initialize framework scores
      const frameworks = scanOptions.frameworks || ['SOC2', 'HIPAA', 'GDPR'];
      frameworks.forEach(framework => {
        result.frameworkScores[framework] = 100;
      });

      // Analyze each resource change
      for (const resourceChange of plan.resource_changes) {
        const resourceFindings = await this.analyzeResource(resourceChange, plan, scanOptions);
        result.findings.push(...resourceFindings);
      }

      // Calculate scores based on findings
      result.score = this.calculateComplianceScore(result.findings, plan.resource_changes.length);
      
      // Calculate framework-specific scores
      frameworks.forEach(framework => {
        result.frameworkScores[framework] = this.calculateFrameworkScore(result.findings, framework);
      });

      // Calculate control-specific scores
      const allControls = new Set<string>();
      result.findings.forEach(finding => {
        if (finding.evidence.control) {
          allControls.add(finding.evidence.control);
        }
      });
      
      allControls.forEach(control => {
        result.controlScores[control] = this.calculateControlScore(result.findings, control);
      });

      logger.info('Compliance analysis completed', {
        totalFindings: result.findings.length,
        complianceScore: result.score,
        frameworkScores: result.frameworkScores
      });

      return result;

    } catch (error) {
      logger.error('Compliance analysis failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Analyze individual resource for compliance violations
   */
  private async analyzeResource(resourceChange: any, plan: TerraformPlan, scanOptions: any): Promise<any[]> {
    const findings: any[] = [];
    const resourceType = resourceChange.type;
    const resourceAddress = resourceChange.address;

    // Apply relevant compliance rules
    for (const rule of this.rules) {
      if (rule.resourceTypes.includes(resourceType) || rule.resourceTypes.includes('*')) {
        try {
          const isViolation = rule.check(resourceChange, plan);
          
          if (isViolation) {
            const finding = {
              id: `${rule.id}-${resourceAddress}`,
              type: 'compliance' as const,
              severity: rule.severity,
              title: rule.name,
              description: rule.description,
              resource: resourceAddress,
              rule: rule.id,
              recommendation: rule.getRecommendation(resourceChange),
              evidence: {
                resourceType,
                resourceAddress,
                frameworks: rule.frameworks,
                controls: rule.controls,
                rule: rule.id
              },
              framework: rule.frameworks[0], // Primary framework
              control: rule.controls[0] // Primary control
            };

            findings.push(finding);
          }
        } catch (error) {
          logger.warn('Compliance rule check failed', {
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
   * Calculate overall compliance score
   */
  private calculateComplianceScore(findings: any[], totalResources: number): number {
    if (totalResources === 0) return 100;

    let totalPenalty = 0;
    
    findings.forEach(finding => {
      switch (finding.severity) {
        case 'critical':
          totalPenalty += 20;
          break;
        case 'high':
          totalPenalty += 10;
          break;
        case 'medium':
          totalPenalty += 5;
          break;
        case 'low':
          totalPenalty += 2;
          break;
      }
    });

    const score = Math.max(0, 100 - (totalPenalty / totalResources));
    return Math.round(score * 10) / 10;
  }

  /**
   * Calculate framework-specific score
   */
  private calculateFrameworkScore(findings: any[], framework: string): number {
    const frameworkFindings = findings.filter(f => f.framework === framework);
    
    if (frameworkFindings.length === 0) return 100;

    let totalPenalty = 0;
    
    frameworkFindings.forEach(finding => {
      switch (finding.severity) {
        case 'critical':
          totalPenalty += 20;
          break;
        case 'high':
          totalPenalty += 10;
          break;
        case 'medium':
          totalPenalty += 5;
          break;
        case 'low':
          totalPenalty += 2;
          break;
      }
    });

    const score = Math.max(0, 100 - totalPenalty);
    return Math.round(score * 10) / 10;
  }

  /**
   * Calculate control-specific score
   */
  private calculateControlScore(findings: any[], control: string): number {
    const controlFindings = findings.filter(f => f.control === control);
    
    if (controlFindings.length === 0) return 100;

    let totalPenalty = 0;
    
    controlFindings.forEach(finding => {
      switch (finding.severity) {
        case 'critical':
          totalPenalty += 20;
          break;
        case 'high':
          totalPenalty += 10;
          break;
        case 'medium':
          totalPenalty += 5;
          break;
        case 'low':
          totalPenalty += 2;
          break;
      }
    });

    const score = Math.max(0, 100 - totalPenalty);
    return Math.round(score * 10) / 10;
  }

  /**
   * Initialize compliance rules
   */
  private initializeComplianceRules(): ComplianceRule[] {
    return [
      // S3 Compliance Rules
      {
        id: 's3-encryption-required',
        name: 'S3 Bucket Encryption Required',
        description: 'S3 buckets must have server-side encryption enabled',
        frameworks: ['SOC2', 'HIPAA', 'GDPR'],
        controls: ['CC6.1', '164.312(a)(2)(iv)', 'Art. 32'],
        severity: 'high',
        resourceTypes: ['aws_s3_bucket'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return !after?.server_side_encryption_configuration;
        },
        getRecommendation: (resource) => 'Enable server-side encryption on S3 bucket'
      },
      {
        id: 's3-public-access-block',
        name: 'S3 Public Access Block Required',
        description: 'S3 buckets must have public access block enabled',
        frameworks: ['SOC2', 'HIPAA', 'GDPR'],
        controls: ['CC6.1', '164.312(a)(2)(iv)', 'Art. 32'],
        severity: 'high',
        resourceTypes: ['aws_s3_bucket'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return !after?.public_access_block;
        },
        getRecommendation: (resource) => 'Enable public access block on S3 bucket'
      },
      {
        id: 's3-versioning-required',
        name: 'S3 Versioning Required',
        description: 'S3 buckets should have versioning enabled for data protection',
        frameworks: ['SOC2', 'HIPAA'],
        controls: ['CC6.1', '164.312(a)(2)(iv)'],
        severity: 'medium',
        resourceTypes: ['aws_s3_bucket'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.versioning?.[0]?.enabled !== true;
        },
        getRecommendation: (resource) => 'Enable versioning on S3 bucket'
      },

      // IAM Compliance Rules
      {
        id: 'iam-policy-wildcard',
        name: 'IAM Policy Wildcard Restriction',
        description: 'IAM policies should not use wildcard permissions',
        frameworks: ['SOC2', 'HIPAA', 'GDPR'],
        controls: ['CC6.1', '164.312(a)(2)(i)', 'Art. 32'],
        severity: 'high',
        resourceTypes: ['aws_iam_policy', 'aws_iam_role_policy', 'aws_iam_user_policy'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          const policy = after?.policy || after?.inline_policy;
          if (typeof policy === 'string') {
            try {
              const parsed = JSON.parse(policy);
              return this.hasWildcardPermissions(parsed);
            } catch {
              return false;
            }
          }
          return false;
        },
        getRecommendation: (resource) => 'Remove wildcard permissions from IAM policy'
      },
      {
        id: 'iam-root-access',
        name: 'Root Access Restriction',
        description: 'Root user access should be restricted',
        frameworks: ['SOC2', 'HIPAA'],
        controls: ['CC6.1', '164.312(a)(2)(i)'],
        severity: 'critical',
        resourceTypes: ['aws_iam_user'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.name === 'root' || after?.path === '/';
        },
        getRecommendation: (resource) => 'Avoid using root user for regular operations'
      },

      // EC2 Compliance Rules
      {
        id: 'ec2-public-ip',
        name: 'EC2 Public IP Restriction',
        description: 'EC2 instances should not have public IPs unless necessary',
        frameworks: ['SOC2', 'HIPAA', 'GDPR'],
        controls: ['CC6.1', '164.312(a)(2)(iv)', 'Art. 32'],
        severity: 'medium',
        resourceTypes: ['aws_instance'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.associate_public_ip_address === true;
        },
        getRecommendation: (resource) => 'Avoid assigning public IPs to EC2 instances'
      },
      {
        id: 'ec2-encryption',
        name: 'EC2 EBS Encryption Required',
        description: 'EBS volumes must be encrypted',
        frameworks: ['SOC2', 'HIPAA', 'GDPR'],
        controls: ['CC6.1', '164.312(a)(2)(iv)', 'Art. 32'],
        severity: 'high',
        resourceTypes: ['aws_ebs_volume'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.encrypted !== true;
        },
        getRecommendation: (resource) => 'Enable encryption on EBS volume'
      },

      // RDS Compliance Rules
      {
        id: 'rds-encryption',
        name: 'RDS Encryption Required',
        description: 'RDS instances must have encryption enabled',
        frameworks: ['SOC2', 'HIPAA', 'GDPR'],
        controls: ['CC6.1', '164.312(a)(2)(iv)', 'Art. 32'],
        severity: 'high',
        resourceTypes: ['aws_db_instance', 'aws_rds_cluster'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.storage_encrypted !== true;
        },
        getRecommendation: (resource) => 'Enable encryption on RDS instance'
      },
      {
        id: 'rds-public-access',
        name: 'RDS Public Access Restriction',
        description: 'RDS instances should not be publicly accessible',
        frameworks: ['SOC2', 'HIPAA', 'GDPR'],
        controls: ['CC6.1', '164.312(a)(2)(iv)', 'Art. 32'],
        severity: 'high',
        resourceTypes: ['aws_db_instance', 'aws_rds_cluster'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.publicly_accessible === true;
        },
        getRecommendation: (resource) => 'Disable public access on RDS instance'
      },

      // Lambda Compliance Rules
      {
        id: 'lambda-environment-variables',
        name: 'Lambda Environment Variables Encryption',
        description: 'Lambda environment variables should be encrypted',
        frameworks: ['SOC2', 'HIPAA', 'GDPR'],
        controls: ['CC6.1', '164.312(a)(2)(iv)', 'Art. 32'],
        severity: 'medium',
        resourceTypes: ['aws_lambda_function'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.environment && !after?.kms_key_arn;
        },
        getRecommendation: (resource) => 'Encrypt Lambda environment variables with KMS'
      },

      // CloudTrail Compliance Rules
      {
        id: 'cloudtrail-encryption',
        name: 'CloudTrail Encryption Required',
        description: 'CloudTrail logs must be encrypted',
        frameworks: ['SOC2', 'HIPAA', 'GDPR'],
        controls: ['CC6.1', '164.312(a)(2)(iv)', 'Art. 32'],
        severity: 'high',
        resourceTypes: ['aws_cloudtrail'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return !after?.kms_key_id;
        },
        getRecommendation: (resource) => 'Enable encryption on CloudTrail logs'
      },
      {
        id: 'cloudtrail-log-validation',
        name: 'CloudTrail Log Validation Required',
        description: 'CloudTrail must have log file validation enabled',
        frameworks: ['SOC2', 'HIPAA'],
        controls: ['CC6.1', '164.312(a)(2)(iv)'],
        severity: 'medium',
        resourceTypes: ['aws_cloudtrail'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.enable_log_file_validation !== true;
        },
        getRecommendation: (resource) => 'Enable log file validation on CloudTrail'
      }
    ];
  }

  /**
   * Check if IAM policy has wildcard permissions
   */
  private hasWildcardPermissions(policy: any): boolean {
    if (!policy.Statement || !Array.isArray(policy.Statement)) {
      return false;
    }

    return policy.Statement.some((statement: any) => {
      if (statement.Effect === 'Allow') {
        // Check for wildcard in Action
        if (statement.Action === '*' || 
            (Array.isArray(statement.Action) && statement.Action.includes('*'))) {
          return true;
        }
        
        // Check for wildcard in Resource
        if (statement.Resource === '*' || 
            (Array.isArray(statement.Resource) && statement.Resource.includes('*'))) {
          return true;
        }
      }
      return false;
    });
  }
}
