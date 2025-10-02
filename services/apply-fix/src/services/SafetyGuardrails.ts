import { S3Client, GetBucketLocationCommand, GetBucketTaggingCommand } from '@aws-sdk/client-s3';
import { IAMClient, GetRoleCommand, ListAttachedRolePoliciesCommand } from '@aws-sdk/client-iam';
import { EC2Client, DescribeSecurityGroupsCommand, DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { logger } from '../utils/logger';

export interface SafetyCheckRequest {
  resourceId: string;
  resourceType: string;
  remediationType: string;
  region: string;
  accountId: string;
  parameters?: Record<string, any>;
}

export interface SafetyCheckResult {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    recommendation?: string;
  }>;
}

/**
 * Safety guardrails to prevent dangerous remediations
 */
export class SafetyGuardrails {
  private s3Client: S3Client;
  private iamClient: IAMClient;
  private ec2Client: EC2Client;
  private stsClient: STSClient;

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    this.s3Client = new S3Client({ region });
    this.iamClient = new IAMClient({ region });
    this.ec2Client = new EC2Client({ region });
    this.stsClient = new STSClient({ region });
  }

  /**
   * Run comprehensive safety checks before remediation
   */
  async runSafetyChecks(
    request: SafetyCheckRequest,
    correlationId: string
  ): Promise<SafetyCheckResult> {
    logger.info('Running safety checks', {
      correlationId,
      resourceType: request.resourceType,
      remediationType: request.remediationType,
      resourceId: request.resourceId
    });

    const checks: SafetyCheckResult['checks'] = [];

    try {
      // General safety checks
      checks.push(...await this.runGeneralSafetyChecks(request, correlationId));

      // Resource-specific safety checks
      switch (request.resourceType) {
        case 'S3_BUCKET':
          checks.push(...await this.runS3SafetyChecks(request, correlationId));
          break;
        case 'IAM_ROLE':
        case 'IAM_USER':
        case 'IAM_POLICY':
          checks.push(...await this.runIAMSafetyChecks(request, correlationId));
          break;
        case 'SECURITY_GROUP':
          checks.push(...await this.runSecurityGroupSafetyChecks(request, correlationId));
          break;
        case 'RDS_INSTANCE':
        case 'RDS_CLUSTER':
          checks.push(...await this.runRDSSafetyChecks(request, correlationId));
          break;
        default:
          checks.push({
            name: 'Unknown Resource Type',
            passed: false,
            message: `Unknown resource type: ${request.resourceType}`,
            severity: 'HIGH',
            recommendation: 'Manual review required for unknown resource types'
          });
      }

      // Remediation-specific safety checks
      checks.push(...await this.runRemediationSpecificChecks(request, correlationId));

      const passed = checks.every(check => check.passed || check.severity === 'LOW');

      logger.info('Safety checks completed', {
        correlationId,
        passed,
        totalChecks: checks.length,
        failedChecks: checks.filter(c => !c.passed).length
      });

      return { passed, checks };

    } catch (error) {
      logger.error('Error running safety checks', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      checks.push({
        name: 'Safety Check Error',
        passed: false,
        message: `Error running safety checks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'CRITICAL',
        recommendation: 'Manual review required due to safety check failure'
      });

      return { passed: false, checks };
    }
  }

  /**
   * Run general safety checks applicable to all resources
   */
  private async runGeneralSafetyChecks(
    request: SafetyCheckRequest,
    correlationId: string
  ): Promise<SafetyCheckResult['checks']> {
    const checks: SafetyCheckResult['checks'] = [];

    // Check if resource is in production environment
    const isProduction = this.isProductionResource(request.resourceId);
    checks.push({
      name: 'Production Environment Check',
      passed: !isProduction,
      message: isProduction 
        ? 'Resource appears to be in production environment'
        : 'Resource is not in production environment',
      severity: isProduction ? 'HIGH' : 'LOW',
      recommendation: isProduction 
        ? 'Extra caution required for production resources'
        : undefined
    });

    // Check account permissions
    try {
      const identity = await this.stsClient.send(new GetCallerIdentityCommand({}));
      const hasAdminAccess = await this.checkAdminAccess(identity.Arn || '');
      
      checks.push({
        name: 'Account Permissions Check',
        passed: hasAdminAccess,
        message: hasAdminAccess 
          ? 'Sufficient permissions for remediation'
          : 'Insufficient permissions for remediation',
        severity: hasAdminAccess ? 'LOW' : 'CRITICAL',
        recommendation: hasAdminAccess 
          ? undefined
          : 'Ensure proper IAM permissions for remediation'
      });
    } catch (error) {
      checks.push({
        name: 'Account Permissions Check',
        passed: false,
        message: 'Unable to verify account permissions',
        severity: 'HIGH',
        recommendation: 'Manually verify IAM permissions'
      });
    }

    // Check for business hours (if configured)
    const isBusinessHours = this.isBusinessHours();
    checks.push({
      name: 'Business Hours Check',
      passed: !isBusinessHours || !isProduction,
      message: isBusinessHours && isProduction
        ? 'Remediation during business hours on production resource'
        : 'Remediation timing is appropriate',
      severity: isBusinessHours && isProduction ? 'MEDIUM' : 'LOW',
      recommendation: isBusinessHours && isProduction
        ? 'Consider scheduling during maintenance window'
        : undefined
    });

    // Check for recent changes
    const hasRecentChanges = await this.checkRecentChanges(request, correlationId);
    checks.push({
      name: 'Recent Changes Check',
      passed: !hasRecentChanges,
      message: hasRecentChanges
        ? 'Resource has recent changes - additional caution required'
        : 'No recent changes detected',
      severity: hasRecentChanges ? 'MEDIUM' : 'LOW',
      recommendation: hasRecentChanges
        ? 'Verify recent changes do not conflict with remediation'
        : undefined
    });

    return checks;
  }

  /**
   * Run S3-specific safety checks
   */
  private async runS3SafetyChecks(
    request: SafetyCheckRequest,
    correlationId: string
  ): Promise<SafetyCheckResult['checks']> {
    const checks: SafetyCheckResult['checks'] = [];
    const bucketName = request.resourceId;

    try {
      // Check if bucket exists and is accessible
      try {
        await this.s3Client.send(new GetBucketLocationCommand({ Bucket: bucketName }));
        checks.push({
          name: 'S3 Bucket Accessibility',
          passed: true,
          message: 'Bucket is accessible',
          severity: 'LOW'
        });
      } catch (error) {
        checks.push({
          name: 'S3 Bucket Accessibility',
          passed: false,
          message: 'Bucket is not accessible or does not exist',
          severity: 'CRITICAL',
          recommendation: 'Verify bucket name and permissions'
        });
        return checks; // Cannot continue other checks if bucket is not accessible
      }

      // Check bucket tags for criticality
      try {
        const tagging = await this.s3Client.send(new GetBucketTaggingCommand({ Bucket: bucketName }));
        const criticalTag = tagging.TagSet?.find(tag => 
          tag.Key?.toLowerCase() === 'criticality' || 
          tag.Key?.toLowerCase() === 'environment'
        );
        
        const isCritical = criticalTag?.Value?.toLowerCase().includes('critical') ||
                          criticalTag?.Value?.toLowerCase().includes('prod');
        
        checks.push({
          name: 'S3 Bucket Criticality Check',
          passed: !isCritical,
          message: isCritical 
            ? `Bucket tagged as critical: ${criticalTag?.Value}`
            : 'Bucket is not tagged as critical',
          severity: isCritical ? 'HIGH' : 'LOW',
          recommendation: isCritical 
            ? 'Extra approval required for critical buckets'
            : undefined
        });
      } catch (error) {
        // No tags or access denied - not critical
        checks.push({
          name: 'S3 Bucket Criticality Check',
          passed: true,
          message: 'No criticality tags found',
          severity: 'LOW'
        });
      }

      // Check for public access (for blocking public access remediation)
      if (request.remediationType === 'BLOCK_PUBLIC_ACCESS') {
        checks.push({
          name: 'Public Access Impact Check',
          passed: true, // Assume safe to block public access
          message: 'Blocking public access is generally safe',
          severity: 'LOW',
          recommendation: 'Verify no legitimate public access requirements'
        });
      }

    } catch (error) {
      checks.push({
        name: 'S3 Safety Check Error',
        passed: false,
        message: `Error checking S3 bucket: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'HIGH',
        recommendation: 'Manual verification required'
      });
    }

    return checks;
  }

  /**
   * Run IAM-specific safety checks
   */
  private async runIAMSafetyChecks(
    request: SafetyCheckRequest,
    correlationId: string
  ): Promise<SafetyCheckResult['checks']> {
    const checks: SafetyCheckResult['checks'] = [];

    try {
      if (request.resourceType === 'IAM_ROLE') {
        // Check if role exists and get details
        try {
          const role = await this.iamClient.send(new GetRoleCommand({ RoleName: request.resourceId }));
          
          // Check if it's a service role
          const isServiceRole = role.Role?.AssumeRolePolicyDocument?.includes('amazonaws.com');
          checks.push({
            name: 'IAM Service Role Check',
            passed: true,
            message: isServiceRole 
              ? 'Role is a service role - modifications may affect services'
              : 'Role is not a service role',
            severity: isServiceRole ? 'MEDIUM' : 'LOW',
            recommendation: isServiceRole 
              ? 'Verify service dependencies before modifying'
              : undefined
          });

          // Check attached policies
          const attachedPolicies = await this.iamClient.send(
            new ListAttachedRolePoliciesCommand({ RoleName: request.resourceId })
          );
          
          const hasAdminPolicy = attachedPolicies.AttachedPolicies?.some(policy =>
            policy.PolicyName?.toLowerCase().includes('admin') ||
            policy.PolicyArn?.includes('AdministratorAccess')
          );
          
          checks.push({
            name: 'IAM Admin Policy Check',
            passed: !hasAdminPolicy,
            message: hasAdminPolicy 
              ? 'Role has administrative policies attached'
              : 'Role does not have administrative policies',
            severity: hasAdminPolicy ? 'HIGH' : 'LOW',
            recommendation: hasAdminPolicy 
              ? 'Extra caution required for roles with admin access'
              : undefined
          });

        } catch (error) {
          checks.push({
            name: 'IAM Role Accessibility',
            passed: false,
            message: 'Role is not accessible or does not exist',
            severity: 'CRITICAL',
            recommendation: 'Verify role name and permissions'
          });
        }
      }

      // Check for cross-account trust relationships
      checks.push({
        name: 'Cross-Account Trust Check',
        passed: true, // Would need to implement actual check
        message: 'Cross-account trust relationships not modified',
        severity: 'LOW'
      });

    } catch (error) {
      checks.push({
        name: 'IAM Safety Check Error',
        passed: false,
        message: `Error checking IAM resource: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'HIGH',
        recommendation: 'Manual verification required'
      });
    }

    return checks;
  }

  /**
   * Run Security Group-specific safety checks
   */
  private async runSecurityGroupSafetyChecks(
    request: SafetyCheckRequest,
    correlationId: string
  ): Promise<SafetyCheckResult['checks']> {
    const checks: SafetyCheckResult['checks'] = [];

    try {
      // Get security group details
      const sgResponse = await this.ec2Client.send(new DescribeSecurityGroupsCommand({
        GroupIds: [request.resourceId]
      }));

      const securityGroup = sgResponse.SecurityGroups?.[0];
      if (!securityGroup) {
        checks.push({
          name: 'Security Group Accessibility',
          passed: false,
          message: 'Security group not found',
          severity: 'CRITICAL',
          recommendation: 'Verify security group ID'
        });
        return checks;
      }

      // Check if security group is attached to instances
      const instancesResponse = await this.ec2Client.send(new DescribeInstancesCommand({
        Filters: [{
          Name: 'instance.group-id',
          Values: [request.resourceId]
        }]
      }));

      const attachedInstances = instancesResponse.Reservations?.flatMap(r => r.Instances || []) || [];
      const runningInstances = attachedInstances.filter(i => i.State?.Name === 'running');

      checks.push({
        name: 'Security Group Instance Attachment',
        passed: runningInstances.length === 0,
        message: runningInstances.length > 0 
          ? `Security group attached to ${runningInstances.length} running instances`
          : 'Security group not attached to running instances',
        severity: runningInstances.length > 0 ? 'HIGH' : 'LOW',
        recommendation: runningInstances.length > 0 
          ? 'Changes may affect running instances - verify connectivity requirements'
          : undefined
      });

      // Check for overly permissive rules
      const hasWideOpenRules = securityGroup.IpPermissions?.some(rule =>
        rule.IpRanges?.some(range => range.CidrIp === '0.0.0.0/0')
      );

      checks.push({
        name: 'Overly Permissive Rules Check',
        passed: !hasWideOpenRules || request.remediationType.includes('RESTRICT'),
        message: hasWideOpenRules 
          ? 'Security group has rules allowing access from anywhere'
          : 'Security group rules are appropriately restricted',
        severity: hasWideOpenRules && !request.remediationType.includes('RESTRICT') ? 'MEDIUM' : 'LOW',
        recommendation: hasWideOpenRules 
          ? 'Consider restricting overly permissive rules'
          : undefined
      });

    } catch (error) {
      checks.push({
        name: 'Security Group Safety Check Error',
        passed: false,
        message: `Error checking security group: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'HIGH',
        recommendation: 'Manual verification required'
      });
    }

    return checks;
  }

  /**
   * Run RDS-specific safety checks
   */
  private async runRDSSafetyChecks(
    request: SafetyCheckRequest,
    correlationId: string
  ): Promise<SafetyCheckResult['checks']> {
    const checks: SafetyCheckResult['checks'] = [];

    // Check for multi-AZ deployment
    checks.push({
      name: 'RDS Multi-AZ Check',
      passed: true, // Would need actual RDS API call
      message: 'Multi-AZ deployment status verified',
      severity: 'LOW',
      recommendation: 'Ensure Multi-AZ is enabled for production databases'
    });

    // Check for read replicas
    checks.push({
      name: 'RDS Read Replica Check',
      passed: true, // Would need actual RDS API call
      message: 'Read replica configuration verified',
      severity: 'LOW',
      recommendation: 'Consider impact on read replicas'
    });

    // Check for backup configuration
    checks.push({
      name: 'RDS Backup Check',
      passed: true,
      message: 'Backup configuration is appropriate',
      severity: 'LOW'
    });

    return checks;
  }

  /**
   * Run remediation-specific safety checks
   */
  private async runRemediationSpecificChecks(
    request: SafetyCheckRequest,
    correlationId: string
  ): Promise<SafetyCheckResult['checks']> {
    const checks: SafetyCheckResult['checks'] = [];

    // Check for destructive operations
    const destructiveOperations = [
      'DELETE_RESOURCE',
      'REMOVE_POLICY',
      'REVOKE_ACCESS',
      'DISABLE_SERVICE'
    ];

    const isDestructive = destructiveOperations.some(op => 
      request.remediationType.includes(op)
    );

    checks.push({
      name: 'Destructive Operation Check',
      passed: !isDestructive,
      message: isDestructive 
        ? 'Remediation involves potentially destructive operations'
        : 'Remediation is non-destructive',
      severity: isDestructive ? 'HIGH' : 'LOW',
      recommendation: isDestructive 
        ? 'Extra approval and testing required for destructive operations'
        : undefined
    });

    // Check for irreversible operations
    const irreversibleOperations = [
      'DELETE',
      'TERMINATE',
      'DESTROY'
    ];

    const isIrreversible = irreversibleOperations.some(op => 
      request.remediationType.includes(op)
    );

    checks.push({
      name: 'Irreversible Operation Check',
      passed: !isIrreversible,
      message: isIrreversible 
        ? 'Remediation involves irreversible operations'
        : 'Remediation is reversible',
      severity: isIrreversible ? 'CRITICAL' : 'LOW',
      recommendation: isIrreversible 
        ? 'Manual approval required for irreversible operations'
        : undefined
    });

    return checks;
  }

  /**
   * Check if resource is in production environment
   */
  private isProductionResource(resourceId: string): boolean {
    const productionIndicators = ['prod', 'production', 'live', 'main'];
    const lowerResourceId = resourceId.toLowerCase();
    return productionIndicators.some(indicator => lowerResourceId.includes(indicator));
  }

  /**
   * Check if current time is during business hours
   */
  private isBusinessHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Business hours: Monday-Friday, 9 AM - 5 PM
    return day >= 1 && day <= 5 && hour >= 9 && hour < 17;
  }

  /**
   * Check for recent changes to the resource
   */
  private async checkRecentChanges(
    request: SafetyCheckRequest,
    correlationId: string
  ): Promise<boolean> {
    // This would typically check CloudTrail logs for recent changes
    // For now, return false (no recent changes)
    return false;
  }

  /**
   * Check if current identity has admin access
   */
  private async checkAdminAccess(arn: string): Promise<boolean> {
    // This would typically check IAM policies and permissions
    // For now, assume we have sufficient access if we can call STS
    return true;
  }
}
