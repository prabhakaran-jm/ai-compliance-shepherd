import { S3Client, CreateBucketCommand, PutBucketEncryptionCommand, PutBucketVersioningCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';
import { IAMClient, CreateRoleCommand, AttachRolePolicyCommand, PutRolePolicyCommand } from '@aws-sdk/client-iam';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { logger } from '../utils/logger';
import { TenantManagementError } from '../utils/errorHandler';

/**
 * Service for creating and managing tenant-specific AWS resources
 */
export class TenantResourceService {
  private s3Client: S3Client;
  private iamClient: IAMClient;
  private stsClient: STSClient;
  private accountId?: string;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.s3Client = new S3Client({ region: this.region });
    this.iamClient = new IAMClient({ region: this.region });
    this.stsClient = new STSClient({ region: this.region });
  }

  /**
   * Create all tenant-specific AWS resources
   */
  async createTenantResources(tenantId: string, encryptionKeys: any, correlationId: string): Promise<any> {
    try {
      logger.info('Creating tenant AWS resources', {
        correlationId,
        tenantId
      });

      // Get account ID if not cached
      if (!this.accountId) {
        const identity = await this.stsClient.send(new GetCallerIdentityCommand({}));
        this.accountId = identity.Account;
      }

      const tenantName = tenantId.replace('tenant-', '');

      // Create resources in parallel
      const [s3BucketName, iamRoleArn] = await Promise.all([
        this.createTenantS3Bucket(tenantName, encryptionKeys, correlationId),
        this.createTenantIAMRole(tenantName, correlationId)
      ]);

      const resources = {
        s3BucketName,
        dynamoTablePrefix: tenantName,
        iamRoleArn,
        secretsManagerPrefix: `compliance-shepherd/${tenantName}`
      };

      logger.info('Tenant AWS resources created successfully', {
        correlationId,
        tenantId,
        resources: Object.keys(resources)
      });

      return resources;

    } catch (error) {
      logger.error('Error creating tenant AWS resources', {
        correlationId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new TenantManagementError(
        `Failed to create tenant AWS resources: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create tenant-specific S3 bucket
   */
  private async createTenantS3Bucket(tenantName: string, encryptionKeys: any, correlationId: string): Promise<string> {
    const bucketName = `compliance-shepherd-${tenantName}`;

    try {
      // Create S3 bucket
      await this.s3Client.send(new CreateBucketCommand({
        Bucket: bucketName,
        CreateBucketConfiguration: this.region !== 'us-east-1' ? {
          LocationConstraint: this.region
        } : undefined
      }));

      // Enable versioning
      await this.s3Client.send(new PutBucketVersioningCommand({
        Bucket: bucketName,
        VersioningConfiguration: {
          Status: 'Enabled'
        }
      }));

      // Configure encryption
      await this.s3Client.send(new PutBucketEncryptionCommand({
        Bucket: bucketName,
        ServerSideEncryptionConfiguration: {
          Rules: [
            {
              ApplyServerSideEncryptionByDefault: {
                SSEAlgorithm: 'aws:kms',
                KMSMasterKeyID: encryptionKeys.keyArn
              },
              BucketKeyEnabled: true
            }
          ]
        }
      }));

      // Set bucket policy for tenant isolation
      const bucketPolicy = this.generateTenantBucketPolicy(bucketName, tenantName);
      await this.s3Client.send(new PutBucketPolicyCommand({
        Bucket: bucketName,
        Policy: JSON.stringify(bucketPolicy)
      }));

      logger.debug('Tenant S3 bucket created', {
        correlationId,
        bucketName,
        tenantName
      });

      return bucketName;

    } catch (error) {
      logger.error('Error creating tenant S3 bucket', {
        correlationId,
        bucketName,
        tenantName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Create tenant-specific IAM role
   */
  private async createTenantIAMRole(tenantName: string, correlationId: string): Promise<string> {
    const roleName = `ComplianceShepherd-${tenantName}`;

    try {
      // Create IAM role
      const createRoleResult = await this.iamClient.send(new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                Service: 'lambda.amazonaws.com'
              },
              Action: 'sts:AssumeRole'
            },
            {
              Effect: 'Allow',
              Principal: {
                AWS: `arn:aws:iam::${this.accountId}:root`
              },
              Action: 'sts:AssumeRole',
              Condition: {
                StringEquals: {
                  'aws:RequestedRegion': this.region
                }
              }
            }
          ]
        }),
        Description: `IAM role for tenant ${tenantName} compliance operations`,
        Tags: [
          { Key: 'TenantName', Value: tenantName },
          { Key: 'Service', Value: 'compliance-shepherd' },
          { Key: 'Environment', Value: process.env.ENVIRONMENT || 'production' }
        ]
      }));

      const roleArn = createRoleResult.Role?.Arn;
      if (!roleArn) {
        throw new TenantManagementError('Failed to create IAM role');
      }

      // Attach basic Lambda execution policy
      await this.iamClient.send(new AttachRolePolicyCommand({
        RoleName: roleName,
        PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
      }));

      // Create tenant-specific inline policy
      const tenantPolicy = this.generateTenantIAMPolicy(tenantName);
      await this.iamClient.send(new PutRolePolicyCommand({
        RoleName: roleName,
        PolicyName: `ComplianceShepherd-${tenantName}-Policy`,
        PolicyDocument: JSON.stringify(tenantPolicy)
      }));

      logger.debug('Tenant IAM role created', {
        correlationId,
        roleName,
        roleArn,
        tenantName
      });

      return roleArn;

    } catch (error) {
      logger.error('Error creating tenant IAM role', {
        correlationId,
        roleName,
        tenantName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Generate tenant-specific S3 bucket policy
   */
  private generateTenantBucketPolicy(bucketName: string, tenantName: string): any {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'DenyInsecureConnections',
          Effect: 'Deny',
          Principal: '*',
          Action: 's3:*',
          Resource: [
            `arn:aws:s3:::${bucketName}`,
            `arn:aws:s3:::${bucketName}/*`
          ],
          Condition: {
            Bool: {
              'aws:SecureTransport': 'false'
            }
          }
        },
        {
          Sid: 'AllowTenantAccess',
          Effect: 'Allow',
          Principal: {
            AWS: [
              `arn:aws:iam::${this.accountId}:role/ComplianceShepherd-${tenantName}`,
              `arn:aws:iam::${this.accountId}:role/ComplianceShepherdLambdaRole`
            ]
          },
          Action: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
            's3:ListBucket',
            's3:GetObjectVersion',
            's3:DeleteObjectVersion'
          ],
          Resource: [
            `arn:aws:s3:::${bucketName}`,
            `arn:aws:s3:::${bucketName}/*`
          ]
        },
        {
          Sid: 'DenyCrossTenantAccess',
          Effect: 'Deny',
          NotPrincipal: {
            AWS: [
              `arn:aws:iam::${this.accountId}:role/ComplianceShepherd-${tenantName}`,
              `arn:aws:iam::${this.accountId}:role/ComplianceShepherdLambdaRole`,
              `arn:aws:iam::${this.accountId}:root`
            ]
          },
          Action: 's3:*',
          Resource: [
            `arn:aws:s3:::${bucketName}`,
            `arn:aws:s3:::${bucketName}/*`
          ]
        }
      ]
    };
  }

  /**
   * Generate tenant-specific IAM policy
   */
  private generateTenantIAMPolicy(tenantName: string): any {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowS3Access',
          Effect: 'Allow',
          Action: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
            's3:ListBucket',
            's3:GetObjectVersion',
            's3:DeleteObjectVersion'
          ],
          Resource: [
            `arn:aws:s3:::compliance-shepherd-${tenantName}`,
            `arn:aws:s3:::compliance-shepherd-${tenantName}/*`
          ]
        },
        {
          Sid: 'AllowDynamoDBAccess',
          Effect: 'Allow',
          Action: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
            'dynamodb:Query',
            'dynamodb:Scan',
            'dynamodb:BatchGetItem',
            'dynamodb:BatchWriteItem'
          ],
          Resource: [
            `arn:aws:dynamodb:${this.region}:${this.accountId}:table/${tenantName}-*`,
            `arn:aws:dynamodb:${this.region}:${this.accountId}:table/${tenantName}-*/index/*`
          ]
        },
        {
          Sid: 'AllowKMSAccess',
          Effect: 'Allow',
          Action: [
            'kms:Encrypt',
            'kms:Decrypt',
            'kms:ReEncrypt*',
            'kms:GenerateDataKey*',
            'kms:DescribeKey'
          ],
          Resource: [
            `arn:aws:kms:${this.region}:${this.accountId}:key/*`
          ],
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
          Sid: 'AllowSecretsManagerAccess',
          Effect: 'Allow',
          Action: [
            'secretsmanager:GetSecretValue',
            'secretsmanager:PutSecretValue',
            'secretsmanager:CreateSecret',
            'secretsmanager:UpdateSecret'
          ],
          Resource: [
            `arn:aws:secretsmanager:${this.region}:${this.accountId}:secret:compliance-shepherd/${tenantName}/*`
          ]
        },
        {
          Sid: 'AllowCloudWatchLogs',
          Effect: 'Allow',
          Action: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents',
            'logs:DescribeLogGroups',
            'logs:DescribeLogStreams'
          ],
          Resource: [
            `arn:aws:logs:${this.region}:${this.accountId}:log-group:/aws/lambda/compliance-shepherd-${tenantName}*`
          ]
        },
        {
          Sid: 'DenyCrossTenantAccess',
          Effect: 'Deny',
          Action: '*',
          Resource: '*',
          Condition: {
            StringLike: {
              'aws:RequestedRegion': '*'
            },
            'ForAllValues:StringNotLike': {
              'aws:RequestedRegion': [this.region]
            }
          }
        }
      ]
    };
  }
}
