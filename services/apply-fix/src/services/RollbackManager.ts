import { S3Client, PutBucketEncryptionCommand, PutBucketVersioningCommand, DeleteBucketEncryptionCommand } from '@aws-sdk/client-s3';
import { IAMClient, DetachRolePolicyCommand, DeletePolicyCommand } from '@aws-sdk/client-iam';
import { EC2Client, AuthorizeSecurityGroupIngressCommand, RevokeSecurityGroupIngressCommand } from '@aws-sdk/client-ec2';
import { CloudTrailClient, UpdateTrailCommand } from '@aws-sdk/client-cloudtrail';
import { KMSClient, DisableKeyRotationCommand } from '@aws-sdk/client-kms';
import { RDSClient, ModifyDBInstanceCommand, ModifyDBClusterCommand } from '@aws-sdk/client-rds';
import { LambdaClient, UpdateFunctionConfigurationCommand } from '@aws-sdk/client-lambda';
import { logger } from '../utils/logger';
import { RollbackError } from '../utils/errorHandler';

export interface RollbackRequest {
  remediationId: string;
  resourceId: string;
  resourceType: string;
  remediationType: string;
  region: string;
  accountId: string;
  rollbackInfo: {
    type: string;
    data: any;
    instructions: string[];
  };
}

export interface RollbackResult {
  success: boolean;
  message: string;
  rollbackActions: Array<{
    action: string;
    resource: string;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    error?: string;
  }>;
  partialRollback: boolean;
}

/**
 * Manages rollback of applied remediations
 */
export class RollbackManager {
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
   * Execute rollback of a remediation
   */
  async executeRollback(
    request: RollbackRequest,
    correlationId: string
  ): Promise<RollbackResult> {
    logger.info('Executing rollback', {
      correlationId,
      remediationId: request.remediationId,
      resourceType: request.resourceType,
      remediationType: request.remediationType
    });

    const rollbackActions: RollbackResult['rollbackActions'] = [];
    let partialRollback = false;

    try {
      // Validate rollback info
      if (!request.rollbackInfo || !request.rollbackInfo.type) {
        throw new RollbackError('Invalid rollback information');
      }

      // Execute rollback based on resource type
      switch (request.resourceType) {
        case 'S3_BUCKET':
          await this.rollbackS3Changes(request, rollbackActions, correlationId);
          break;
        case 'IAM_ROLE':
        case 'IAM_USER':
        case 'IAM_POLICY':
          await this.rollbackIAMChanges(request, rollbackActions, correlationId);
          break;
        case 'SECURITY_GROUP':
          await this.rollbackSecurityGroupChanges(request, rollbackActions, correlationId);
          break;
        case 'CLOUDTRAIL':
          await this.rollbackCloudTrailChanges(request, rollbackActions, correlationId);
          break;
        case 'KMS_KEY':
          await this.rollbackKMSChanges(request, rollbackActions, correlationId);
          break;
        case 'RDS_INSTANCE':
        case 'RDS_CLUSTER':
          await this.rollbackRDSChanges(request, rollbackActions, correlationId);
          break;
        case 'LAMBDA_FUNCTION':
          await this.rollbackLambdaChanges(request, rollbackActions, correlationId);
          break;
        default:
          throw new RollbackError(`Unsupported resource type for rollback: ${request.resourceType}`);
      }

      // Check if any actions failed
      const failedActions = rollbackActions.filter(action => action.status === 'FAILED');
      partialRollback = failedActions.length > 0 && failedActions.length < rollbackActions.length;

      const success = failedActions.length === 0;
      const message = success 
        ? 'Rollback completed successfully'
        : partialRollback 
          ? 'Rollback partially completed - some actions failed'
          : 'Rollback failed';

      logger.info('Rollback execution completed', {
        correlationId,
        remediationId: request.remediationId,
        success,
        partialRollback,
        totalActions: rollbackActions.length,
        failedActions: failedActions.length
      });

      return {
        success,
        message,
        rollbackActions,
        partialRollback
      };

    } catch (error) {
      logger.error('Error executing rollback', {
        correlationId,
        remediationId: request.remediationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      rollbackActions.push({
        action: 'Rollback execution',
        resource: request.resourceId,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        message: 'Rollback failed due to execution error',
        rollbackActions,
        partialRollback: false
      };
    }
  }

  /**
   * Rollback S3 changes
   */
  private async rollbackS3Changes(
    request: RollbackRequest,
    rollbackActions: RollbackResult['rollbackActions'],
    correlationId: string
  ): Promise<void> {
    const bucketName = request.resourceId;
    const rollbackData = request.rollbackInfo.data;

    try {
      switch (request.remediationType) {
        case 'ENABLE_BUCKET_ENCRYPTION':
          if (rollbackData.encryption === 'disabled') {
            try {
              await this.s3Client.send(new DeleteBucketEncryptionCommand({
                Bucket: bucketName
              }));
              rollbackActions.push({
                action: 'Disable bucket encryption',
                resource: bucketName,
                status: 'SUCCESS'
              });
            } catch (error) {
              rollbackActions.push({
                action: 'Disable bucket encryption',
                resource: bucketName,
                status: 'FAILED',
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
          break;

        case 'ENABLE_BUCKET_VERSIONING':
          if (rollbackData.versioning === 'disabled') {
            try {
              await this.s3Client.send(new PutBucketVersioningCommand({
                Bucket: bucketName,
                VersioningConfiguration: {
                  Status: 'Suspended'
                }
              }));
              rollbackActions.push({
                action: 'Suspend bucket versioning',
                resource: bucketName,
                status: 'SUCCESS'
              });
            } catch (error) {
              rollbackActions.push({
                action: 'Suspend bucket versioning',
                resource: bucketName,
                status: 'FAILED',
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
          break;

        case 'BLOCK_PUBLIC_ACCESS':
          if (rollbackData.publicAccess === 'allowed') {
            // Note: Cannot directly remove public access block via API
            // This would require manual intervention or custom implementation
            rollbackActions.push({
              action: 'Remove public access block',
              resource: bucketName,
              status: 'SKIPPED',
              error: 'Manual intervention required to remove public access block'
            });
          }
          break;

        default:
          rollbackActions.push({
            action: `Rollback ${request.remediationType}`,
            resource: bucketName,
            status: 'SKIPPED',
            error: 'Unsupported rollback operation'
          });
      }

    } catch (error) {
      logger.error('Error rolling back S3 changes', {
        correlationId,
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      rollbackActions.push({
        action: 'S3 rollback',
        resource: bucketName,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Rollback IAM changes
   */
  private async rollbackIAMChanges(
    request: RollbackRequest,
    rollbackActions: RollbackResult['rollbackActions'],
    correlationId: string
  ): Promise<void> {
    const rollbackData = request.rollbackInfo.data;

    try {
      switch (request.remediationType) {
        case 'ATTACH_SECURITY_POLICY':
          if (rollbackData.policyArn) {
            try {
              await this.iamClient.send(new DetachRolePolicyCommand({
                RoleName: request.resourceId,
                PolicyArn: rollbackData.policyArn
              }));
              rollbackActions.push({
                action: 'Detach security policy',
                resource: request.resourceId,
                status: 'SUCCESS'
              });
            } catch (error) {
              rollbackActions.push({
                action: 'Detach security policy',
                resource: request.resourceId,
                status: 'FAILED',
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
          break;

        case 'CREATE_LEAST_PRIVILEGE_POLICY':
          if (rollbackData.policyName) {
            try {
              // First detach from role if attached
              try {
                await this.iamClient.send(new DetachRolePolicyCommand({
                  RoleName: request.resourceId,
                  PolicyArn: `arn:aws:iam::${request.accountId}:policy/${rollbackData.policyName}`
                }));
              } catch (detachError) {
                // Policy might not be attached, continue with deletion
              }

              // Delete the policy
              await this.iamClient.send(new DeletePolicyCommand({
                PolicyArn: `arn:aws:iam::${request.accountId}:policy/${rollbackData.policyName}`
              }));

              rollbackActions.push({
                action: 'Delete created policy',
                resource: rollbackData.policyName,
                status: 'SUCCESS'
              });
            } catch (error) {
              rollbackActions.push({
                action: 'Delete created policy',
                resource: rollbackData.policyName,
                status: 'FAILED',
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
          break;

        default:
          rollbackActions.push({
            action: `Rollback ${request.remediationType}`,
            resource: request.resourceId,
            status: 'SKIPPED',
            error: 'Unsupported rollback operation'
          });
      }

    } catch (error) {
      logger.error('Error rolling back IAM changes', {
        correlationId,
        resourceId: request.resourceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      rollbackActions.push({
        action: 'IAM rollback',
        resource: request.resourceId,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Rollback Security Group changes
   */
  private async rollbackSecurityGroupChanges(
    request: RollbackRequest,
    rollbackActions: RollbackResult['rollbackActions'],
    correlationId: string
  ): Promise<void> {
    const rollbackData = request.rollbackInfo.data;

    try {
      switch (request.remediationType) {
        case 'REMOVE_OVERLY_PERMISSIVE_RULE':
          if (rollbackData.rule) {
            try {
              await this.ec2Client.send(new AuthorizeSecurityGroupIngressCommand({
                GroupId: request.resourceId,
                IpPermissions: [rollbackData.rule]
              }));
              rollbackActions.push({
                action: 'Restore removed security group rule',
                resource: request.resourceId,
                status: 'SUCCESS'
              });
            } catch (error) {
              rollbackActions.push({
                action: 'Restore removed security group rule',
                resource: request.resourceId,
                status: 'FAILED',
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
          break;

        case 'RESTRICT_SSH_ACCESS':
          if (rollbackData.originalCidr) {
            try {
              // Remove restricted rule
              await this.ec2Client.send(new RevokeSecurityGroupIngressCommand({
                GroupId: request.resourceId,
                IpPermissions: [{
                  IpProtocol: 'tcp',
                  FromPort: 22,
                  ToPort: 22,
                  IpRanges: [{ CidrIp: '10.0.0.0/8' }] // Assuming this was the restricted CIDR
                }]
              }));

              // Restore original rule
              await this.ec2Client.send(new AuthorizeSecurityGroupIngressCommand({
                GroupId: request.resourceId,
                IpPermissions: [{
                  IpProtocol: 'tcp',
                  FromPort: 22,
                  ToPort: 22,
                  IpRanges: [{ CidrIp: rollbackData.originalCidr }]
                }]
              }));

              rollbackActions.push({
                action: 'Restore original SSH access',
                resource: request.resourceId,
                status: 'SUCCESS'
              });
            } catch (error) {
              rollbackActions.push({
                action: 'Restore original SSH access',
                resource: request.resourceId,
                status: 'FAILED',
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
          break;

        default:
          rollbackActions.push({
            action: `Rollback ${request.remediationType}`,
            resource: request.resourceId,
            status: 'SKIPPED',
            error: 'Unsupported rollback operation'
          });
      }

    } catch (error) {
      logger.error('Error rolling back Security Group changes', {
        correlationId,
        resourceId: request.resourceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      rollbackActions.push({
        action: 'Security Group rollback',
        resource: request.resourceId,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Rollback CloudTrail changes
   */
  private async rollbackCloudTrailChanges(
    request: RollbackRequest,
    rollbackActions: RollbackResult['rollbackActions'],
    correlationId: string
  ): Promise<void> {
    const rollbackData = request.rollbackInfo.data;

    try {
      switch (request.remediationType) {
        case 'ENABLE_LOG_FILE_VALIDATION':
          if (rollbackData.logFileValidation === false) {
            try {
              await this.cloudTrailClient.send(new UpdateTrailCommand({
                Name: request.resourceId,
                EnableLogFileValidation: false
              }));
              rollbackActions.push({
                action: 'Disable log file validation',
                resource: request.resourceId,
                status: 'SUCCESS'
              });
            } catch (error) {
              rollbackActions.push({
                action: 'Disable log file validation',
                resource: request.resourceId,
                status: 'FAILED',
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
          break;

        case 'ENABLE_MANAGEMENT_EVENTS':
          if (rollbackData.managementEvents === false) {
            // Note: This would require more complex logic to restore original event selectors
            rollbackActions.push({
              action: 'Restore original event selectors',
              resource: request.resourceId,
              status: 'SKIPPED',
              error: 'Manual intervention required to restore original event selectors'
            });
          }
          break;

        default:
          rollbackActions.push({
            action: `Rollback ${request.remediationType}`,
            resource: request.resourceId,
            status: 'SKIPPED',
            error: 'Unsupported rollback operation'
          });
      }

    } catch (error) {
      logger.error('Error rolling back CloudTrail changes', {
        correlationId,
        resourceId: request.resourceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      rollbackActions.push({
        action: 'CloudTrail rollback',
        resource: request.resourceId,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Rollback KMS changes
   */
  private async rollbackKMSChanges(
    request: RollbackRequest,
    rollbackActions: RollbackResult['rollbackActions'],
    correlationId: string
  ): Promise<void> {
    const rollbackData = request.rollbackInfo.data;

    try {
      switch (request.remediationType) {
        case 'ENABLE_KEY_ROTATION':
          if (rollbackData.keyRotation === false) {
            try {
              await this.kmsClient.send(new DisableKeyRotationCommand({
                KeyId: request.resourceId
              }));
              rollbackActions.push({
                action: 'Disable key rotation',
                resource: request.resourceId,
                status: 'SUCCESS'
              });
            } catch (error) {
              rollbackActions.push({
                action: 'Disable key rotation',
                resource: request.resourceId,
                status: 'FAILED',
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
          break;

        default:
          rollbackActions.push({
            action: `Rollback ${request.remediationType}`,
            resource: request.resourceId,
            status: 'SKIPPED',
            error: 'Unsupported rollback operation'
          });
      }

    } catch (error) {
      logger.error('Error rolling back KMS changes', {
        correlationId,
        resourceId: request.resourceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      rollbackActions.push({
        action: 'KMS rollback',
        resource: request.resourceId,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Rollback RDS changes
   */
  private async rollbackRDSChanges(
    request: RollbackRequest,
    rollbackActions: RollbackResult['rollbackActions'],
    correlationId: string
  ): Promise<void> {
    const rollbackData = request.rollbackInfo.data;

    try {
      switch (request.remediationType) {
        case 'ENABLE_BACKUP_RETENTION':
          if (rollbackData.backupRetention === 0) {
            try {
              if (request.resourceType === 'RDS_INSTANCE') {
                await this.rdsClient.send(new ModifyDBInstanceCommand({
                  DBInstanceIdentifier: request.resourceId,
                  BackupRetentionPeriod: 0,
                  ApplyImmediately: true
                }));
              } else {
                await this.rdsClient.send(new ModifyDBClusterCommand({
                  DBClusterIdentifier: request.resourceId,
                  BackupRetentionPeriod: 0,
                  ApplyImmediately: true
                }));
              }
              rollbackActions.push({
                action: 'Disable backup retention',
                resource: request.resourceId,
                status: 'SUCCESS'
              });
            } catch (error) {
              rollbackActions.push({
                action: 'Disable backup retention',
                resource: request.resourceId,
                status: 'FAILED',
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
          break;

        case 'ENABLE_ENCRYPTION':
          rollbackActions.push({
            action: 'Rollback encryption',
            resource: request.resourceId,
            status: 'SKIPPED',
            error: 'RDS encryption cannot be rolled back - requires manual snapshot restore'
          });
          break;

        default:
          rollbackActions.push({
            action: `Rollback ${request.remediationType}`,
            resource: request.resourceId,
            status: 'SKIPPED',
            error: 'Unsupported rollback operation'
          });
      }

    } catch (error) {
      logger.error('Error rolling back RDS changes', {
        correlationId,
        resourceId: request.resourceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      rollbackActions.push({
        action: 'RDS rollback',
        resource: request.resourceId,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Rollback Lambda changes
   */
  private async rollbackLambdaChanges(
    request: RollbackRequest,
    rollbackActions: RollbackResult['rollbackActions'],
    correlationId: string
  ): Promise<void> {
    const rollbackData = request.rollbackInfo.data;

    try {
      switch (request.remediationType) {
        case 'ENABLE_VPC_CONFIGURATION':
          if (rollbackData.vpcConfig === null) {
            try {
              await this.lambdaClient.send(new UpdateFunctionConfigurationCommand({
                FunctionName: request.resourceId,
                VpcConfig: {
                  SubnetIds: [],
                  SecurityGroupIds: []
                }
              }));
              rollbackActions.push({
                action: 'Remove VPC configuration',
                resource: request.resourceId,
                status: 'SUCCESS'
              });
            } catch (error) {
              rollbackActions.push({
                action: 'Remove VPC configuration',
                resource: request.resourceId,
                status: 'FAILED',
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
          break;

        default:
          rollbackActions.push({
            action: `Rollback ${request.remediationType}`,
            resource: request.resourceId,
            status: 'SKIPPED',
            error: 'Unsupported rollback operation'
          });
      }

    } catch (error) {
      logger.error('Error rolling back Lambda changes', {
        correlationId,
        resourceId: request.resourceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      rollbackActions.push({
        action: 'Lambda rollback',
        resource: request.resourceId,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Validate rollback feasibility
   */
  async validateRollbackFeasibility(
    request: RollbackRequest,
    correlationId: string
  ): Promise<{
    feasible: boolean;
    reasons: string[];
    warnings: string[];
  }> {
    const reasons: string[] = [];
    const warnings: string[] = [];

    // Check if rollback info is available
    if (!request.rollbackInfo || !request.rollbackInfo.type) {
      reasons.push('No rollback information available');
    }

    // Check for irreversible operations
    const irreversibleOperations = ['DELETE', 'TERMINATE', 'DESTROY'];
    if (irreversibleOperations.some(op => request.remediationType.includes(op))) {
      reasons.push('Operation is irreversible');
    }

    // Check for time-sensitive rollbacks
    const timeSensitiveOperations = ['ENABLE_ENCRYPTION', 'DELETE_RESOURCE'];
    if (timeSensitiveOperations.some(op => request.remediationType.includes(op))) {
      warnings.push('Rollback may have time constraints or dependencies');
    }

    // Resource-specific checks
    switch (request.resourceType) {
      case 'RDS_INSTANCE':
      case 'RDS_CLUSTER':
        if (request.remediationType === 'ENABLE_ENCRYPTION') {
          reasons.push('RDS encryption cannot be rolled back without snapshot restore');
        }
        break;
      case 'S3_BUCKET':
        if (request.remediationType === 'BLOCK_PUBLIC_ACCESS') {
          warnings.push('Public access block removal requires manual intervention');
        }
        break;
    }

    const feasible = reasons.length === 0;

    logger.info('Rollback feasibility check completed', {
      correlationId,
      remediationId: request.remediationId,
      feasible,
      reasons: reasons.length,
      warnings: warnings.length
    });

    return {
      feasible,
      reasons,
      warnings
    };
  }
}
