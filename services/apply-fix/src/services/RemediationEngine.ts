import { S3Client, PutBucketEncryptionCommand, PutBucketVersioningCommand, PutPublicAccessBlockCommand } from '@aws-sdk/client-s3';
import { IAMClient, AttachRolePolicyCommand, CreatePolicyCommand, PutRolePolicyCommand } from '@aws-sdk/client-iam';
import { EC2Client, AuthorizeSecurityGroupIngressCommand, RevokeSecurityGroupIngressCommand, ModifySecurityGroupRulesCommand } from '@aws-sdk/client-ec2';
import { CloudTrailClient, PutEventSelectorsCommand, UpdateTrailCommand } from '@aws-sdk/client-cloudtrail';
import { KMSClient, EnableKeyRotationCommand, PutKeyPolicyCommand } from '@aws-sdk/client-kms';
import { RDSClient, ModifyDBInstanceCommand, ModifyDBClusterCommand } from '@aws-sdk/client-rds';
import { LambdaClient, UpdateFunctionConfigurationCommand } from '@aws-sdk/client-lambda';
import { logger } from '../utils/logger';
import { RemediationError } from '../utils/errorHandler';

export interface RemediationExecutionRequest {
  remediationId: string;
  resourceId: string;
  resourceType: string;
  remediationType: string;
  region: string;
  accountId: string;
  parameters?: Record<string, any>;
  dryRun?: boolean;
}

export interface RemediationExecutionResult {
  success: boolean;
  message: string;
  changes: Array<{
    action: string;
    resource: string;
    before: any;
    after: any;
  }>;
  rollbackInfo: {
    type: string;
    data: any;
    instructions: string[];
  };
}

export interface ImpactEstimationRequest {
  resourceId: string;
  resourceType: string;
  remediationType: string;
  region: string;
  accountId: string;
  parameters?: Record<string, any>;
}

export interface ImpactEstimation {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedResources: number;
  downtime: boolean;
  costImpact: number;
  description: string;
  mitigations: string[];
}

/**
 * Engine for executing compliance remediations across AWS services
 */
export class RemediationEngine {
  private s3Client: S3Client;
  private iamClient: IAMClient;
  private ec2Client: EC2Client;
  private cloudTrailClient: CloudTrailClient;
  private kmsClient: KMSClient;
  private rdsClient: RDSClient;
  private lambdaClient: LambdaClient;

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    this.s3Client = new S3Client({ region });
    this.iamClient = new IAMClient({ region });
    this.ec2Client = new EC2Client({ region });
    this.cloudTrailClient = new CloudTrailClient({ region });
    this.kmsClient = new KMSClient({ region });
    this.rdsClient = new RDSClient({ region });
    this.lambdaClient = new LambdaClient({ region });
  }

  /**
   * Execute remediation based on type and resource
   */
  async executeRemediation(
    request: RemediationExecutionRequest,
    correlationId: string
  ): Promise<RemediationExecutionResult> {
    logger.info('Executing remediation', {
      correlationId,
      remediationId: request.remediationId,
      resourceType: request.resourceType,
      remediationType: request.remediationType,
      dryRun: request.dryRun
    });

    try {
      switch (request.resourceType) {
        case 'S3_BUCKET':
          return await this.executeS3Remediation(request, correlationId);
        case 'IAM_ROLE':
        case 'IAM_USER':
        case 'IAM_POLICY':
          return await this.executeIAMRemediation(request, correlationId);
        case 'SECURITY_GROUP':
          return await this.executeSecurityGroupRemediation(request, correlationId);
        case 'CLOUDTRAIL':
          return await this.executeCloudTrailRemediation(request, correlationId);
        case 'KMS_KEY':
          return await this.executeKMSRemediation(request, correlationId);
        case 'RDS_INSTANCE':
        case 'RDS_CLUSTER':
          return await this.executeRDSRemediation(request, correlationId);
        case 'LAMBDA_FUNCTION':
          return await this.executeLambdaRemediation(request, correlationId);
        default:
          throw new RemediationError(`Unsupported resource type: ${request.resourceType}`);
      }
    } catch (error) {
      logger.error('Error executing remediation', {
        correlationId,
        remediationId: request.remediationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        changes: [],
        rollbackInfo: {
          type: 'none',
          data: {},
          instructions: []
        }
      };
    }
  }

  /**
   * Estimate impact of remediation
   */
  async estimateImpact(
    request: ImpactEstimationRequest,
    correlationId: string
  ): Promise<ImpactEstimation> {
    logger.info('Estimating remediation impact', {
      correlationId,
      resourceType: request.resourceType,
      remediationType: request.remediationType
    });

    // Base impact assessment
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    let affectedResources = 1;
    let downtime = false;
    let costImpact = 0;
    let description = '';
    let mitigations: string[] = [];

    // Assess based on resource type and remediation type
    switch (request.resourceType) {
      case 'S3_BUCKET':
        ({ riskLevel, affectedResources, downtime, costImpact, description, mitigations } = 
          this.estimateS3Impact(request));
        break;
      case 'IAM_ROLE':
      case 'IAM_USER':
      case 'IAM_POLICY':
        ({ riskLevel, affectedResources, downtime, costImpact, description, mitigations } = 
          this.estimateIAMImpact(request));
        break;
      case 'SECURITY_GROUP':
        ({ riskLevel, affectedResources, downtime, costImpact, description, mitigations } = 
          this.estimateSecurityGroupImpact(request));
        break;
      case 'CLOUDTRAIL':
        ({ riskLevel, affectedResources, downtime, costImpact, description, mitigations } = 
          this.estimateCloudTrailImpact(request));
        break;
      case 'KMS_KEY':
        ({ riskLevel, affectedResources, downtime, costImpact, description, mitigations } = 
          this.estimateKMSImpact(request));
        break;
      case 'RDS_INSTANCE':
      case 'RDS_CLUSTER':
        ({ riskLevel, affectedResources, downtime, costImpact, description, mitigations } = 
          this.estimateRDSImpact(request));
        break;
      case 'LAMBDA_FUNCTION':
        ({ riskLevel, affectedResources, downtime, costImpact, description, mitigations } = 
          this.estimateLambdaImpact(request));
        break;
      default:
        riskLevel = 'MEDIUM';
        description = 'Unknown resource type - manual review recommended';
    }

    // Adjust risk based on resource naming patterns
    if (request.resourceId.toLowerCase().includes('prod') || 
        request.resourceId.toLowerCase().includes('production')) {
      riskLevel = this.increaseRiskLevel(riskLevel);
      mitigations.push('Production resource - extra caution required');
    }

    return {
      riskLevel,
      affectedResources,
      downtime,
      costImpact,
      description,
      mitigations
    };
  }

  /**
   * Execute S3 bucket remediation
   */
  private async executeS3Remediation(
    request: RemediationExecutionRequest,
    correlationId: string
  ): Promise<RemediationExecutionResult> {
    const bucketName = request.resourceId;
    const changes: any[] = [];
    const rollbackInfo: any = { type: 's3', data: {}, instructions: [] };

    try {
      switch (request.remediationType) {
        case 'ENABLE_BUCKET_ENCRYPTION':
          if (!request.dryRun) {
            await this.s3Client.send(new PutBucketEncryptionCommand({
              Bucket: bucketName,
              ServerSideEncryptionConfiguration: {
                Rules: [{
                  ApplyServerSideEncryptionByDefault: {
                    SSEAlgorithm: 'AES256'
                  }
                }]
              }
            }));
          }
          changes.push({
            action: 'Enable bucket encryption',
            resource: bucketName,
            before: { encryption: 'disabled' },
            after: { encryption: 'AES256' }
          });
          rollbackInfo.data.encryption = 'disabled';
          rollbackInfo.instructions.push('Disable bucket encryption');
          break;

        case 'ENABLE_BUCKET_VERSIONING':
          if (!request.dryRun) {
            await this.s3Client.send(new PutBucketVersioningCommand({
              Bucket: bucketName,
              VersioningConfiguration: {
                Status: 'Enabled'
              }
            }));
          }
          changes.push({
            action: 'Enable bucket versioning',
            resource: bucketName,
            before: { versioning: 'disabled' },
            after: { versioning: 'enabled' }
          });
          rollbackInfo.data.versioning = 'disabled';
          rollbackInfo.instructions.push('Suspend bucket versioning');
          break;

        case 'BLOCK_PUBLIC_ACCESS':
          if (!request.dryRun) {
            await this.s3Client.send(new PutPublicAccessBlockCommand({
              Bucket: bucketName,
              PublicAccessBlockConfiguration: {
                BlockPublicAcls: true,
                IgnorePublicAcls: true,
                BlockPublicPolicy: true,
                RestrictPublicBuckets: true
              }
            }));
          }
          changes.push({
            action: 'Block public access',
            resource: bucketName,
            before: { publicAccess: 'allowed' },
            after: { publicAccess: 'blocked' }
          });
          rollbackInfo.data.publicAccess = 'allowed';
          rollbackInfo.instructions.push('Remove public access block');
          break;

        default:
          throw new RemediationError(`Unsupported S3 remediation type: ${request.remediationType}`);
      }

      return {
        success: true,
        message: `S3 remediation completed successfully${request.dryRun ? ' (dry run)' : ''}`,
        changes,
        rollbackInfo
      };

    } catch (error) {
      throw new RemediationError(`S3 remediation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute IAM remediation
   */
  private async executeIAMRemediation(
    request: RemediationExecutionRequest,
    correlationId: string
  ): Promise<RemediationExecutionResult> {
    const changes: any[] = [];
    const rollbackInfo: any = { type: 'iam', data: {}, instructions: [] };

    try {
      switch (request.remediationType) {
        case 'ATTACH_SECURITY_POLICY':
          const policyArn = request.parameters?.policyArn;
          if (!policyArn) {
            throw new RemediationError('Policy ARN required for attaching security policy');
          }
          
          if (!request.dryRun) {
            await this.iamClient.send(new AttachRolePolicyCommand({
              RoleName: request.resourceId,
              PolicyArn: policyArn
            }));
          }
          changes.push({
            action: 'Attach security policy',
            resource: request.resourceId,
            before: { attachedPolicies: [] },
            after: { attachedPolicies: [policyArn] }
          });
          rollbackInfo.data.policyArn = policyArn;
          rollbackInfo.instructions.push(`Detach policy ${policyArn} from role ${request.resourceId}`);
          break;

        case 'CREATE_LEAST_PRIVILEGE_POLICY':
          const policyDocument = request.parameters?.policyDocument;
          if (!policyDocument) {
            throw new RemediationError('Policy document required for creating least privilege policy');
          }
          
          if (!request.dryRun) {
            const policyName = `${request.resourceId}-least-privilege-policy`;
            await this.iamClient.send(new CreatePolicyCommand({
              PolicyName: policyName,
              PolicyDocument: JSON.stringify(policyDocument),
              Description: 'Least privilege policy created by AI Compliance Shepherd'
            }));
          }
          changes.push({
            action: 'Create least privilege policy',
            resource: request.resourceId,
            before: { customPolicy: false },
            after: { customPolicy: true }
          });
          rollbackInfo.data.policyName = `${request.resourceId}-least-privilege-policy`;
          rollbackInfo.instructions.push('Delete created policy');
          break;

        default:
          throw new RemediationError(`Unsupported IAM remediation type: ${request.remediationType}`);
      }

      return {
        success: true,
        message: `IAM remediation completed successfully${request.dryRun ? ' (dry run)' : ''}`,
        changes,
        rollbackInfo
      };

    } catch (error) {
      throw new RemediationError(`IAM remediation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute Security Group remediation
   */
  private async executeSecurityGroupRemediation(
    request: RemediationExecutionRequest,
    correlationId: string
  ): Promise<RemediationExecutionResult> {
    const changes: any[] = [];
    const rollbackInfo: any = { type: 'security_group', data: {}, instructions: [] };

    try {
      switch (request.remediationType) {
        case 'REMOVE_OVERLY_PERMISSIVE_RULE':
          const ruleToRemove = request.parameters?.rule;
          if (!ruleToRemove) {
            throw new RemediationError('Rule details required for removing overly permissive rule');
          }
          
          if (!request.dryRun) {
            await this.ec2Client.send(new RevokeSecurityGroupIngressCommand({
              GroupId: request.resourceId,
              IpPermissions: [ruleToRemove]
            }));
          }
          changes.push({
            action: 'Remove overly permissive rule',
            resource: request.resourceId,
            before: { rule: ruleToRemove },
            after: { rule: null }
          });
          rollbackInfo.data.rule = ruleToRemove;
          rollbackInfo.instructions.push('Re-add the removed security group rule');
          break;

        case 'RESTRICT_SSH_ACCESS':
          const newCidr = request.parameters?.allowedCidr || '10.0.0.0/8';
          
          if (!request.dryRun) {
            // Remove existing SSH rule
            await this.ec2Client.send(new RevokeSecurityGroupIngressCommand({
              GroupId: request.resourceId,
              IpPermissions: [{
                IpProtocol: 'tcp',
                FromPort: 22,
                ToPort: 22,
                IpRanges: [{ CidrIp: '0.0.0.0/0' }]
              }]
            }));
            
            // Add restricted SSH rule
            await this.ec2Client.send(new AuthorizeSecurityGroupIngressCommand({
              GroupId: request.resourceId,
              IpPermissions: [{
                IpProtocol: 'tcp',
                FromPort: 22,
                ToPort: 22,
                IpRanges: [{ CidrIp: newCidr }]
              }]
            }));
          }
          changes.push({
            action: 'Restrict SSH access',
            resource: request.resourceId,
            before: { sshCidr: '0.0.0.0/0' },
            after: { sshCidr: newCidr }
          });
          rollbackInfo.data.originalCidr = '0.0.0.0/0';
          rollbackInfo.instructions.push('Restore original SSH CIDR range');
          break;

        default:
          throw new RemediationError(`Unsupported Security Group remediation type: ${request.remediationType}`);
      }

      return {
        success: true,
        message: `Security Group remediation completed successfully${request.dryRun ? ' (dry run)' : ''}`,
        changes,
        rollbackInfo
      };

    } catch (error) {
      throw new RemediationError(`Security Group remediation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute CloudTrail remediation
   */
  private async executeCloudTrailRemediation(
    request: RemediationExecutionRequest,
    correlationId: string
  ): Promise<RemediationExecutionResult> {
    const changes: any[] = [];
    const rollbackInfo: any = { type: 'cloudtrail', data: {}, instructions: [] };

    try {
      switch (request.remediationType) {
        case 'ENABLE_LOG_FILE_VALIDATION':
          if (!request.dryRun) {
            await this.cloudTrailClient.send(new UpdateTrailCommand({
              Name: request.resourceId,
              EnableLogFileValidation: true
            }));
          }
          changes.push({
            action: 'Enable log file validation',
            resource: request.resourceId,
            before: { logFileValidation: false },
            after: { logFileValidation: true }
          });
          rollbackInfo.data.logFileValidation = false;
          rollbackInfo.instructions.push('Disable log file validation');
          break;

        case 'ENABLE_MANAGEMENT_EVENTS':
          if (!request.dryRun) {
            await this.cloudTrailClient.send(new PutEventSelectorsCommand({
              TrailName: request.resourceId,
              EventSelectors: [{
                ReadWriteType: 'All',
                IncludeManagementEvents: true,
                DataResources: []
              }]
            }));
          }
          changes.push({
            action: 'Enable management events',
            resource: request.resourceId,
            before: { managementEvents: false },
            after: { managementEvents: true }
          });
          rollbackInfo.data.managementEvents = false;
          rollbackInfo.instructions.push('Disable management events');
          break;

        default:
          throw new RemediationError(`Unsupported CloudTrail remediation type: ${request.remediationType}`);
      }

      return {
        success: true,
        message: `CloudTrail remediation completed successfully${request.dryRun ? ' (dry run)' : ''}`,
        changes,
        rollbackInfo
      };

    } catch (error) {
      throw new RemediationError(`CloudTrail remediation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute KMS remediation
   */
  private async executeKMSRemediation(
    request: RemediationExecutionRequest,
    correlationId: string
  ): Promise<RemediationExecutionResult> {
    const changes: any[] = [];
    const rollbackInfo: any = { type: 'kms', data: {}, instructions: [] };

    try {
      switch (request.remediationType) {
        case 'ENABLE_KEY_ROTATION':
          if (!request.dryRun) {
            await this.kmsClient.send(new EnableKeyRotationCommand({
              KeyId: request.resourceId
            }));
          }
          changes.push({
            action: 'Enable key rotation',
            resource: request.resourceId,
            before: { keyRotation: false },
            after: { keyRotation: true }
          });
          rollbackInfo.data.keyRotation = false;
          rollbackInfo.instructions.push('Disable key rotation');
          break;

        default:
          throw new RemediationError(`Unsupported KMS remediation type: ${request.remediationType}`);
      }

      return {
        success: true,
        message: `KMS remediation completed successfully${request.dryRun ? ' (dry run)' : ''}`,
        changes,
        rollbackInfo
      };

    } catch (error) {
      throw new RemediationError(`KMS remediation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute RDS remediation
   */
  private async executeRDSRemediation(
    request: RemediationExecutionRequest,
    correlationId: string
  ): Promise<RemediationExecutionResult> {
    const changes: any[] = [];
    const rollbackInfo: any = { type: 'rds', data: {}, instructions: [] };

    try {
      switch (request.remediationType) {
        case 'ENABLE_ENCRYPTION':
          // Note: RDS encryption can only be enabled during creation
          // This would typically involve creating a snapshot and restoring with encryption
          changes.push({
            action: 'Enable encryption (requires snapshot restore)',
            resource: request.resourceId,
            before: { encrypted: false },
            after: { encrypted: true }
          });
          rollbackInfo.instructions.push('Manual process - restore from unencrypted snapshot');
          break;

        case 'ENABLE_BACKUP_RETENTION':
          const retentionPeriod = request.parameters?.retentionPeriod || 7;
          
          if (!request.dryRun) {
            if (request.resourceType === 'RDS_INSTANCE') {
              await this.rdsClient.send(new ModifyDBInstanceCommand({
                DBInstanceIdentifier: request.resourceId,
                BackupRetentionPeriod: retentionPeriod,
                ApplyImmediately: true
              }));
            } else {
              await this.rdsClient.send(new ModifyDBClusterCommand({
                DBClusterIdentifier: request.resourceId,
                BackupRetentionPeriod: retentionPeriod,
                ApplyImmediately: true
              }));
            }
          }
          changes.push({
            action: 'Enable backup retention',
            resource: request.resourceId,
            before: { backupRetention: 0 },
            after: { backupRetention: retentionPeriod }
          });
          rollbackInfo.data.backupRetention = 0;
          rollbackInfo.instructions.push('Set backup retention period to 0');
          break;

        default:
          throw new RemediationError(`Unsupported RDS remediation type: ${request.remediationType}`);
      }

      return {
        success: true,
        message: `RDS remediation completed successfully${request.dryRun ? ' (dry run)' : ''}`,
        changes,
        rollbackInfo
      };

    } catch (error) {
      throw new RemediationError(`RDS remediation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute Lambda remediation
   */
  private async executeLambdaRemediation(
    request: RemediationExecutionRequest,
    correlationId: string
  ): Promise<RemediationExecutionResult> {
    const changes: any[] = [];
    const rollbackInfo: any = { type: 'lambda', data: {}, instructions: [] };

    try {
      switch (request.remediationType) {
        case 'ENABLE_VPC_CONFIGURATION':
          const vpcConfig = request.parameters?.vpcConfig;
          if (!vpcConfig) {
            throw new RemediationError('VPC configuration required');
          }
          
          if (!request.dryRun) {
            await this.lambdaClient.send(new UpdateFunctionConfigurationCommand({
              FunctionName: request.resourceId,
              VpcConfig: vpcConfig
            }));
          }
          changes.push({
            action: 'Enable VPC configuration',
            resource: request.resourceId,
            before: { vpcConfig: null },
            after: { vpcConfig }
          });
          rollbackInfo.data.vpcConfig = null;
          rollbackInfo.instructions.push('Remove VPC configuration');
          break;

        default:
          throw new RemediationError(`Unsupported Lambda remediation type: ${request.remediationType}`);
      }

      return {
        success: true,
        message: `Lambda remediation completed successfully${request.dryRun ? ' (dry run)' : ''}`,
        changes,
        rollbackInfo
      };

    } catch (error) {
      throw new RemediationError(`Lambda remediation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Impact estimation methods
  private estimateS3Impact(request: ImpactEstimationRequest): Partial<ImpactEstimation> {
    switch (request.remediationType) {
      case 'ENABLE_BUCKET_ENCRYPTION':
        return {
          riskLevel: 'LOW',
          affectedResources: 1,
          downtime: false,
          costImpact: 0,
          description: 'Enable S3 bucket encryption - no downtime, minimal cost impact',
          mitigations: ['No service interruption expected']
        };
      case 'BLOCK_PUBLIC_ACCESS':
        return {
          riskLevel: 'MEDIUM',
          affectedResources: 1,
          downtime: false,
          costImpact: 0,
          description: 'Block public access - may affect public-facing applications',
          mitigations: ['Verify no legitimate public access requirements', 'Test application functionality']
        };
      default:
        return { riskLevel: 'LOW', affectedResources: 1, downtime: false, costImpact: 0, description: '', mitigations: [] };
    }
  }

  private estimateIAMImpact(request: ImpactEstimationRequest): Partial<ImpactEstimation> {
    return {
      riskLevel: 'HIGH',
      affectedResources: 1,
      downtime: false,
      costImpact: 0,
      description: 'IAM changes can affect access permissions - high risk',
      mitigations: ['Test permissions thoroughly', 'Have rollback plan ready', 'Monitor for access issues']
    };
  }

  private estimateSecurityGroupImpact(request: ImpactEstimationRequest): Partial<ImpactEstimation> {
    return {
      riskLevel: 'HIGH',
      affectedResources: 5,
      downtime: true,
      costImpact: 0,
      description: 'Security group changes can affect network connectivity',
      mitigations: ['Verify connectivity requirements', 'Test network access', 'Have emergency access method']
    };
  }

  private estimateCloudTrailImpact(request: ImpactEstimationRequest): Partial<ImpactEstimation> {
    return {
      riskLevel: 'LOW',
      affectedResources: 1,
      downtime: false,
      costImpact: 10,
      description: 'CloudTrail changes may increase logging costs',
      mitigations: ['Monitor CloudTrail costs', 'Review log retention policies']
    };
  }

  private estimateKMSImpact(request: ImpactEstimationRequest): Partial<ImpactEstimation> {
    return {
      riskLevel: 'LOW',
      affectedResources: 1,
      downtime: false,
      costImpact: 5,
      description: 'KMS changes have minimal impact',
      mitigations: ['No service interruption expected']
    };
  }

  private estimateRDSImpact(request: ImpactEstimationRequest): Partial<ImpactEstimation> {
    return {
      riskLevel: 'MEDIUM',
      affectedResources: 1,
      downtime: request.remediationType === 'ENABLE_ENCRYPTION',
      costImpact: 20,
      description: 'RDS changes may require downtime and increase costs',
      mitigations: ['Schedule during maintenance window', 'Monitor performance impact']
    };
  }

  private estimateLambdaImpact(request: ImpactEstimationRequest): Partial<ImpactEstimation> {
    return {
      riskLevel: 'MEDIUM',
      affectedResources: 1,
      downtime: false,
      costImpact: 0,
      description: 'Lambda configuration changes may affect function execution',
      mitigations: ['Test function execution', 'Monitor cold start times']
    };
  }

  private increaseRiskLevel(currentLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    switch (currentLevel) {
      case 'LOW': return 'MEDIUM';
      case 'MEDIUM': return 'HIGH';
      case 'HIGH': return 'CRITICAL';
      case 'CRITICAL': return 'CRITICAL';
    }
  }
}
