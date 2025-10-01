/**
 * Security Analyzer
 * 
 * Analyzes Terraform plans for security vulnerabilities and misconfigurations
 * that could lead to security breaches or unauthorized access.
 */

import { TerraformPlan } from './TerraformPlanParser';
import { logger } from '../utils/logger';

export interface SecurityAnalysisResult {
  score: number;
  findings: Array<{
    id: string;
    type: 'security';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    resource: string;
    rule: string;
    recommendation: string;
    evidence: any;
    category: string;
    cve?: string;
  }>;
  categoryScores: { [category: string]: number };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resourceTypes: string[];
  check: (resource: any, plan: TerraformPlan) => boolean;
  getRecommendation: (resource: any) => string;
  cve?: string;
}

export class SecurityAnalyzer {
  private rules: SecurityRule[];

  constructor() {
    this.rules = this.initializeSecurityRules();
  }

  /**
   * Analyze Terraform plan for security vulnerabilities
   */
  async analyzePlan(plan: TerraformPlan, scanOptions: any): Promise<SecurityAnalysisResult> {
    try {
      logger.info('Starting security analysis', {
        totalResources: plan.resource_changes.length,
        severityThreshold: scanOptions.severityThreshold || 'medium'
      });

      const result: SecurityAnalysisResult = {
        score: 100, // Start with perfect score
        findings: [],
        categoryScores: {},
        riskLevel: 'low'
      };

      // Initialize category scores
      const categories = ['encryption', 'access_control', 'network_security', 'data_protection', 'logging'];
      categories.forEach(category => {
        result.categoryScores[category] = 100;
      });

      // Analyze each resource change
      for (const resourceChange of plan.resource_changes) {
        const resourceFindings = await this.analyzeResource(resourceChange, plan, scanOptions);
        result.findings.push(...resourceFindings);
      }

      // Calculate scores based on findings
      result.score = this.calculateSecurityScore(result.findings, plan.resource_changes.length);
      
      // Calculate category-specific scores
      categories.forEach(category => {
        result.categoryScores[category] = this.calculateCategoryScore(result.findings, category);
      });

      // Determine overall risk level
      result.riskLevel = this.determineRiskLevel(result.findings);

      logger.info('Security analysis completed', {
        totalFindings: result.findings.length,
        securityScore: result.score,
        riskLevel: result.riskLevel,
        categoryScores: result.categoryScores
      });

      return result;

    } catch (error) {
      logger.error('Security analysis failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Analyze individual resource for security vulnerabilities
   */
  private async analyzeResource(resourceChange: any, plan: TerraformPlan, scanOptions: any): Promise<any[]> {
    const findings: any[] = [];
    const resourceType = resourceChange.type;
    const resourceAddress = resourceChange.address;

    // Apply relevant security rules
    for (const rule of this.rules) {
      if (rule.resourceTypes.includes(resourceType) || rule.resourceTypes.includes('*')) {
        try {
          const isVulnerability = rule.check(resourceChange, plan);
          
          if (isVulnerability) {
            const finding = {
              id: `${rule.id}-${resourceAddress}`,
              type: 'security' as const,
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
              category: rule.category,
              cve: rule.cve
            };

            findings.push(finding);
          }
        } catch (error) {
          logger.warn('Security rule check failed', {
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
   * Calculate overall security score
   */
  private calculateSecurityScore(findings: any[], totalResources: number): number {
    if (totalResources === 0) return 100;

    let totalPenalty = 0;
    
    findings.forEach(finding => {
      switch (finding.severity) {
        case 'critical':
          totalPenalty += 25;
          break;
        case 'high':
          totalPenalty += 15;
          break;
        case 'medium':
          totalPenalty += 8;
          break;
        case 'low':
          totalPenalty += 3;
          break;
      }
    });

    const score = Math.max(0, 100 - (totalPenalty / totalResources));
    return Math.round(score * 10) / 10;
  }

  /**
   * Calculate category-specific score
   */
  private calculateCategoryScore(findings: any[], category: string): number {
    const categoryFindings = findings.filter(f => f.category === category);
    
    if (categoryFindings.length === 0) return 100;

    let totalPenalty = 0;
    
    categoryFindings.forEach(finding => {
      switch (finding.severity) {
        case 'critical':
          totalPenalty += 25;
          break;
        case 'high':
          totalPenalty += 15;
          break;
        case 'medium':
          totalPenalty += 8;
          break;
        case 'low':
          totalPenalty += 3;
          break;
      }
    });

    const score = Math.max(0, 100 - totalPenalty);
    return Math.round(score * 10) / 10;
  }

  /**
   * Determine overall risk level
   */
  private determineRiskLevel(findings: any[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const highCount = findings.filter(f => f.severity === 'high').length;
    const mediumCount = findings.filter(f => f.severity === 'medium').length;

    if (criticalCount > 0) return 'critical';
    if (highCount > 2) return 'high';
    if (highCount > 0 || mediumCount > 5) return 'medium';
    return 'low';
  }

  /**
   * Initialize security rules
   */
  private initializeSecurityRules(): SecurityRule[] {
    return [
      // Encryption Security Rules
      {
        id: 's3-unencrypted-bucket',
        name: 'Unencrypted S3 Bucket',
        description: 'S3 bucket without encryption exposes data to unauthorized access',
        category: 'encryption',
        severity: 'high',
        resourceTypes: ['aws_s3_bucket'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return !after?.server_side_encryption_configuration;
        },
        getRecommendation: (resource) => 'Enable server-side encryption on S3 bucket'
      },
      {
        id: 'ebs-unencrypted-volume',
        name: 'Unencrypted EBS Volume',
        description: 'EBS volume without encryption exposes data to unauthorized access',
        category: 'encryption',
        severity: 'high',
        resourceTypes: ['aws_ebs_volume'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.encrypted !== true;
        },
        getRecommendation: (resource) => 'Enable encryption on EBS volume'
      },
      {
        id: 'rds-unencrypted-instance',
        name: 'Unencrypted RDS Instance',
        description: 'RDS instance without encryption exposes sensitive data',
        category: 'encryption',
        severity: 'high',
        resourceTypes: ['aws_db_instance', 'aws_rds_cluster'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.storage_encrypted !== true;
        },
        getRecommendation: (resource) => 'Enable encryption on RDS instance'
      },

      // Access Control Security Rules
      {
        id: 's3-public-bucket',
        name: 'Public S3 Bucket',
        description: 'S3 bucket with public access exposes data to unauthorized users',
        category: 'access_control',
        severity: 'critical',
        resourceTypes: ['aws_s3_bucket'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.public_access_block?.block_public_acls !== true;
        },
        getRecommendation: (resource) => 'Enable public access block on S3 bucket'
      },
      {
        id: 'iam-wildcard-policy',
        name: 'IAM Policy with Wildcard Permissions',
        description: 'IAM policy with wildcard permissions grants excessive access',
        category: 'access_control',
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
        id: 'rds-public-access',
        name: 'Publicly Accessible RDS Instance',
        description: 'RDS instance with public access exposes database to unauthorized users',
        category: 'access_control',
        severity: 'critical',
        resourceTypes: ['aws_db_instance', 'aws_rds_cluster'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.publicly_accessible === true;
        },
        getRecommendation: (resource) => 'Disable public access on RDS instance'
      },

      // Network Security Rules
      {
        id: 'sg-open-ports',
        name: 'Security Group with Open Ports',
        description: 'Security group with open ports exposes services to unauthorized access',
        category: 'network_security',
        severity: 'medium',
        resourceTypes: ['aws_security_group'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          const ingress = after?.ingress || [];
          return ingress.some((rule: any) => 
            rule.cidr_blocks?.includes('0.0.0.0/0') || 
            rule.ipv6_cidr_blocks?.includes('::/0')
          );
        },
        getRecommendation: (resource) => 'Restrict security group ingress rules'
      },
      {
        id: 'ec2-public-ip',
        name: 'EC2 Instance with Public IP',
        description: 'EC2 instance with public IP exposes it to the internet',
        category: 'network_security',
        severity: 'medium',
        resourceTypes: ['aws_instance'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.associate_public_ip_address === true;
        },
        getRecommendation: (resource) => 'Avoid assigning public IPs to EC2 instances'
      },
      {
        id: 'elb-insecure-listener',
        name: 'ELB with Insecure Listener',
        description: 'ELB listener without SSL/TLS exposes traffic to interception',
        category: 'network_security',
        severity: 'high',
        resourceTypes: ['aws_lb_listener', 'aws_elb'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.protocol === 'HTTP' || after?.protocol === 'TCP';
        },
        getRecommendation: (resource) => 'Use HTTPS/TLS for ELB listeners'
      },

      // Data Protection Security Rules
      {
        id: 'lambda-unencrypted-env',
        name: 'Lambda with Unencrypted Environment Variables',
        description: 'Lambda environment variables without encryption expose sensitive data',
        category: 'data_protection',
        severity: 'medium',
        resourceTypes: ['aws_lambda_function'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.environment && !after?.kms_key_arn;
        },
        getRecommendation: (resource) => 'Encrypt Lambda environment variables with KMS'
      },
      {
        id: 'cloudtrail-unencrypted',
        name: 'Unencrypted CloudTrail Logs',
        description: 'CloudTrail logs without encryption expose audit data',
        category: 'data_protection',
        severity: 'high',
        resourceTypes: ['aws_cloudtrail'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return !after?.kms_key_id;
        },
        getRecommendation: (resource) => 'Enable encryption on CloudTrail logs'
      },

      // Logging Security Rules
      {
        id: 'cloudtrail-log-validation',
        name: 'CloudTrail without Log Validation',
        description: 'CloudTrail without log validation cannot detect tampering',
        category: 'logging',
        severity: 'medium',
        resourceTypes: ['aws_cloudtrail'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.enable_log_file_validation !== true;
        },
        getRecommendation: (resource) => 'Enable log file validation on CloudTrail'
      },
      {
        id: 'cloudtrail-multi-region',
        name: 'CloudTrail not Multi-Region',
        description: 'CloudTrail should be configured for multi-region logging',
        category: 'logging',
        severity: 'medium',
        resourceTypes: ['aws_cloudtrail'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.is_multi_region_trail !== true;
        },
        getRecommendation: (resource) => 'Enable multi-region logging for CloudTrail'
      },

      // Additional Security Rules
      {
        id: 'iam-root-user',
        name: 'Root User Configuration',
        description: 'Root user should not be used for regular operations',
        category: 'access_control',
        severity: 'critical',
        resourceTypes: ['aws_iam_user'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.name === 'root' || after?.path === '/';
        },
        getRecommendation: (resource) => 'Avoid using root user for regular operations'
      },
      {
        id: 's3-versioning-disabled',
        name: 'S3 Versioning Disabled',
        description: 'S3 bucket without versioning cannot recover from accidental deletion',
        category: 'data_protection',
        severity: 'medium',
        resourceTypes: ['aws_s3_bucket'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return after?.versioning?.[0]?.enabled !== true;
        },
        getRecommendation: (resource) => 'Enable versioning on S3 bucket'
      },
      {
        id: 'rds-backup-retention',
        name: 'RDS Backup Retention Too Low',
        description: 'RDS backup retention period should be at least 7 days',
        category: 'data_protection',
        severity: 'medium',
        resourceTypes: ['aws_db_instance', 'aws_rds_cluster'],
        check: (resource, plan) => {
          const after = resource.change?.after;
          return (after?.backup_retention_period || 0) < 7;
        },
        getRecommendation: (resource) => 'Set backup retention period to at least 7 days'
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
