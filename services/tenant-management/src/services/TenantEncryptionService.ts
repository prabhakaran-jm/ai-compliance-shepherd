import { KMSClient, CreateKeyCommand, CreateAliasCommand, EnableKeyRotationCommand, DescribeKeyCommand } from '@aws-sdk/client-kms';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { logger } from '../utils/logger';
import { TenantManagementError } from '../utils/errorHandler';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for managing tenant-specific encryption keys and policies
 */
export class TenantEncryptionService {
  private kmsClient: KMSClient;
  private stsClient: STSClient;
  private accountId?: string;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.kmsClient = new KMSClient({ region: this.region });
    this.stsClient = new STSClient({ region: this.region });
  }

  /**
   * Create tenant-specific KMS keys
   */
  async createTenantKeys(tenantId: string, correlationId: string): Promise<any> {
    try {
      logger.info('Creating tenant encryption keys', {
        correlationId,
        tenantId
      });

      // Get account ID if not cached
      if (!this.accountId) {
        const identity = await this.stsClient.send(new GetCallerIdentityCommand({}));
        this.accountId = identity.Account;
      }

      const keyAlias = `compliance-shepherd-${tenantId.replace('tenant-', '')}`;
      
      // Create KMS key with tenant-specific policy
      const keyPolicy = this.generateTenantKeyPolicy(tenantId);
      
      const createKeyResult = await this.kmsClient.send(new CreateKeyCommand({
        Description: `Encryption key for tenant ${tenantId}`,
        KeyUsage: 'ENCRYPT_DECRYPT',
        KeySpec: 'SYMMETRIC_DEFAULT',
        Origin: 'AWS_KMS',
        Policy: JSON.stringify(keyPolicy),
        Tags: [
          { TagKey: 'TenantId', TagValue: tenantId },
          { TagKey: 'Service', TagValue: 'compliance-shepherd' },
          { TagKey: 'Environment', TagValue: process.env.ENVIRONMENT || 'production' }
        ]
      }));

      const keyId = createKeyResult.KeyMetadata?.KeyId;
      const keyArn = createKeyResult.KeyMetadata?.Arn;

      if (!keyId || !keyArn) {
        throw new TenantManagementError('Failed to create KMS key');
      }

      // Create key alias
      await this.kmsClient.send(new CreateAliasCommand({
        AliasName: `alias/${keyAlias}`,
        TargetKeyId: keyId
      }));

      // Enable key rotation
      await this.kmsClient.send(new EnableKeyRotationCommand({
        KeyId: keyId
      }));

      logger.info('Tenant encryption keys created successfully', {
        correlationId,
        tenantId,
        keyId,
        keyAlias
      });

      return {
        keyId,
        keyArn,
        keyAlias,
        rotationEnabled: true
      };

    } catch (error) {
      logger.error('Error creating tenant encryption keys', {
        correlationId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new TenantManagementError(
        `Failed to create tenant encryption keys: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate tenant-specific KMS key policy
   */
  private generateTenantKeyPolicy(tenantId: string): any {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'Enable IAM User Permissions',
          Effect: 'Allow',
          Principal: {
            AWS: `arn:aws:iam::${this.accountId}:root`
          },
          Action: 'kms:*',
          Resource: '*'
        },
        {
          Sid: 'Allow use of the key for tenant operations',
          Effect: 'Allow',
          Principal: {
            AWS: [
              `arn:aws:iam::${this.accountId}:role/ComplianceShepherd-${tenantId.replace('tenant-', '')}`,
              `arn:aws:iam::${this.accountId}:role/ComplianceShepherdLambdaRole`
            ]
          },
          Action: [
            'kms:Encrypt',
            'kms:Decrypt',
            'kms:ReEncrypt*',
            'kms:GenerateDataKey*',
            'kms:DescribeKey'
          ],
          Resource: '*',
          Condition: {
            StringEquals: {
              'kms:ViaService': [
                `s3.${this.region}.amazonaws.com`,
                `dynamodb.${this.region}.amazonaws.com`,
                `secretsmanager.${this.region}.amazonaws.com`
              ]
            }
          }
        },
        {
          Sid: 'Allow attachment of persistent resources',
          Effect: 'Allow',
          Principal: {
            AWS: [
              `arn:aws:iam::${this.accountId}:role/ComplianceShepherd-${tenantId.replace('tenant-', '')}`,
              `arn:aws:iam::${this.accountId}:role/ComplianceShepherdLambdaRole`
            ]
          },
          Action: [
            'kms:CreateGrant',
            'kms:ListGrants',
            'kms:RevokeGrant'
          ],
          Resource: '*',
          Condition: {
            Bool: {
              'kms:GrantIsForAWSResource': 'true'
            }
          }
        }
      ]
    };
  }
}
