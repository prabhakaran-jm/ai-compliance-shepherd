/**
 * Bucket Security Service
 * 
 * Handles S3 bucket security configurations including IAM policies,
 * bucket policies, and access controls.
 */

import { S3, IAM } from 'aws-sdk';
import { logger } from '../utils/logger';
import { BucketConfiguration } from './S3BucketManagerService';

export interface BucketPolicy {
  Version: string;
  Statement: Array<{
    Sid?: string;
    Effect: 'Allow' | 'Deny';
    Principal?: string | { [key: string]: string[] };
    Action: string | string[];
    Resource: string | string[];
    Condition?: { [key: string]: any };
  }>;
}

export interface IAMPolicy {
  Version: string;
  Statement: Array<{
    Effect: 'Allow' | 'Deny';
    Action: string | string[];
    Resource: string | string[];
    Condition?: { [key: string]: any };
  }>;
}

export class BucketSecurityService {
  private s3: S3;
  private iam: IAM;

  constructor() {
    this.s3 = new S3({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.iam = new IAM({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }

  /**
   * Configure bucket security settings
   */
  async configureBucketSecurity(bucketName: string, config: BucketConfiguration): Promise<void> {
    try {
      logger.info('Configuring bucket security', {
        bucketName,
        publicAccessBlock: config.publicAccessBlock
      });

      // Configure public access block
      if (config.publicAccessBlock) {
        await this.configurePublicAccessBlock(bucketName);
      }

      // Configure bucket policy
      await this.configureBucketPolicy(bucketName, config);

      // Configure IAM policies
      await this.configureIAMPolicy(bucketName, config);

      logger.info('Bucket security configured successfully', {
        bucketName
      });

    } catch (error) {
      logger.error('Failed to configure bucket security', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Configure public access block
   */
  private async configurePublicAccessBlock(bucketName: string): Promise<void> {
    try {
      logger.info('Configuring public access block', { bucketName });

      await this.s3.putPublicAccessBlock({
        Bucket: bucketName,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          IgnorePublicAcls: true,
          BlockPublicPolicy: true,
          RestrictPublicBuckets: true
        }
      }).promise();

      logger.info('Public access block configured', { bucketName });

    } catch (error) {
      logger.error('Failed to configure public access block', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Configure bucket policy
   */
  private async configureBucketPolicy(bucketName: string, config: BucketConfiguration): Promise<void> {
    try {
      logger.info('Configuring bucket policy', { bucketName });

      const bucketPolicy = this.generateBucketPolicy(bucketName, config);

      await this.s3.putBucketPolicy({
        Bucket: bucketName,
        Policy: JSON.stringify(bucketPolicy)
      }).promise();

      logger.info('Bucket policy configured', { bucketName });

    } catch (error) {
      logger.error('Failed to configure bucket policy', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate bucket policy based on configuration
   */
  private generateBucketPolicy(bucketName: string, config: BucketConfiguration): BucketPolicy {
    const policy: BucketPolicy = {
      Version: '2012-10-17',
      Statement: []
    };

    // Base policy - deny all public access
    policy.Statement.push({
      Sid: 'DenyPublicAccess',
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
    });

    // Allow access from compliance-shepherd services
    policy.Statement.push({
      Sid: 'AllowComplianceShepherdAccess',
      Effect: 'Allow',
      Principal: {
        AWS: [
          `arn:aws:iam::${process.env.AWS_ACCOUNT_ID || '123456789012'}:role/compliance-shepherd-*`,
          `arn:aws:iam::${process.env.AWS_ACCOUNT_ID || '123456789012'}:user/compliance-shepherd-*`
        ]
      },
      Action: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:ListBucket'
      ],
      Resource: [
        `arn:aws:s3:::${bucketName}`,
        `arn:aws:s3:::${bucketName}/*`
      ]
    });

    // Purpose-specific policies
    switch (config.purpose) {
      case 'reports':
        policy.Statement.push({
          Sid: 'AllowReportAccess',
          Effect: 'Allow',
          Principal: {
            AWS: [
              `arn:aws:iam::${process.env.AWS_ACCOUNT_ID || '123456789012'}:role/compliance-shepherd-report-*`
            ]
          },
          Action: [
            's3:GetObject',
            's3:PutObject'
          ],
          Resource: `arn:aws:s3:::${bucketName}/*`
        });
        break;

      case 'artifacts':
        policy.Statement.push({
          Sid: 'AllowArtifactAccess',
          Effect: 'Allow',
          Principal: {
            AWS: [
              `arn:aws:iam::${process.env.AWS_ACCOUNT_ID || '123456789012'}:role/compliance-shepherd-artifact-*`
            ]
          },
          Action: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject'
          ],
          Resource: `arn:aws:s3:::${bucketName}/*`
        });
        break;

      case 'logs':
        policy.Statement.push({
          Sid: 'AllowLogAccess',
          Effect: 'Allow',
          Principal: {
            AWS: [
              `arn:aws:iam::${process.env.AWS_ACCOUNT_ID || '123456789012'}:role/compliance-shepherd-log-*`
            ]
          },
          Action: [
            's3:PutObject'
          ],
          Resource: `arn:aws:s3:::${bucketName}/*`
        });
        break;

      case 'backups':
        policy.Statement.push({
          Sid: 'AllowBackupAccess',
          Effect: 'Allow',
          Principal: {
            AWS: [
              `arn:aws:iam::${process.env.AWS_ACCOUNT_ID || '123456789012'}:role/compliance-shepherd-backup-*`
            ]
          },
          Action: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
            's3:RestoreObject'
          ],
          Resource: [
            `arn:aws:s3:::${bucketName}`,
            `arn:aws:s3:::${bucketName}/*`
          ]
        });
        break;
    }

    return policy;
  }

  /**
   * Configure IAM policy
   */
  private async configureIAMPolicy(bucketName: string, config: BucketConfiguration): Promise<void> {
    try {
      logger.info('Configuring IAM policy', { bucketName });

      const policyName = `compliance-shepherd-${config.purpose}-${bucketName}`;
      const policyDocument = this.generateIAMPolicy(bucketName, config);

      // Check if policy already exists
      try {
        await this.iam.getPolicy({
          PolicyArn: `arn:aws:iam::${process.env.AWS_ACCOUNT_ID || '123456789012'}:policy/${policyName}`
        }).promise();

        // Update existing policy
        await this.iam.createPolicyVersion({
          PolicyArn: `arn:aws:iam::${process.env.AWS_ACCOUNT_ID || '123456789012'}:policy/${policyName}`,
          PolicyDocument: JSON.stringify(policyDocument),
          SetAsDefault: true
        }).promise();

        logger.info('IAM policy updated', { policyName });

      } catch (error) {
        if ((error as any).statusCode === 404) {
          // Create new policy
          await this.iam.createPolicy({
            PolicyName: policyName,
            PolicyDocument: JSON.stringify(policyDocument),
            Description: `Policy for compliance-shepherd ${config.purpose} bucket ${bucketName}`
          }).promise();

          logger.info('IAM policy created', { policyName });
        } else {
          throw error;
        }
      }

    } catch (error) {
      logger.error('Failed to configure IAM policy', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate IAM policy document
   */
  private generateIAMPolicy(bucketName: string, config: BucketConfiguration): IAMPolicy {
    const policy: IAMPolicy = {
      Version: '2012-10-17',
      Statement: []
    };

    // Base permissions
    policy.Statement.push({
      Effect: 'Allow',
      Action: [
        's3:ListBucket'
      ],
      Resource: `arn:aws:s3:::${bucketName}`
    });

    // Purpose-specific permissions
    switch (config.purpose) {
      case 'reports':
        policy.Statement.push({
          Effect: 'Allow',
          Action: [
            's3:GetObject',
            's3:PutObject'
          ],
          Resource: `arn:aws:s3:::${bucketName}/*`
        });
        break;

      case 'artifacts':
        policy.Statement.push({
          Effect: 'Allow',
          Action: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject'
          ],
          Resource: `arn:aws:s3:::${bucketName}/*`
        });
        break;

      case 'logs':
        policy.Statement.push({
          Effect: 'Allow',
          Action: [
            's3:PutObject'
          ],
          Resource: `arn:aws:s3:::${bucketName}/*`
        });
        break;

      case 'backups':
        policy.Statement.push({
          Effect: 'Allow',
          Action: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
            's3:RestoreObject'
          ],
          Resource: `arn:aws:s3:::${bucketName}/*`
        });
        break;
    }

    return policy;
  }

  /**
   * Update bucket permissions
   */
  async updateBucketPermissions(bucketName: string, updateData: any): Promise<any> {
    try {
      logger.info('Updating bucket permissions', {
        bucketName,
        updateData
      });

      const updates: any = {};

      // Update public access block
      if (updateData.publicAccessBlock !== undefined) {
        await this.s3.putPublicAccessBlock({
          Bucket: bucketName,
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: updateData.publicAccessBlock,
            IgnorePublicAcls: updateData.publicAccessBlock,
            BlockPublicPolicy: updateData.publicAccessBlock,
            RestrictPublicBuckets: updateData.publicAccessBlock
          }
        }).promise();
        updates.publicAccessBlock = updateData.publicAccessBlock;
      }

      // Update bucket policy
      if (updateData.bucketPolicy) {
        await this.s3.putBucketPolicy({
          Bucket: bucketName,
          Policy: JSON.stringify(updateData.bucketPolicy)
        }).promise();
        updates.bucketPolicy = updateData.bucketPolicy;
      }

      // Update IAM policy
      if (updateData.iamPolicy) {
        const policyName = `compliance-shepherd-${bucketName}`;
        await this.iam.createPolicyVersion({
          PolicyArn: `arn:aws:iam::${process.env.AWS_ACCOUNT_ID || '123456789012'}:policy/${policyName}`,
          PolicyDocument: JSON.stringify(updateData.iamPolicy),
          SetAsDefault: true
        }).promise();
        updates.iamPolicy = updateData.iamPolicy;
      }

      logger.info('Bucket permissions updated successfully', {
        bucketName,
        updates
      });

      return updates;

    } catch (error) {
      logger.error('Failed to update bucket permissions', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get bucket security status
   */
  async getBucketSecurityStatus(bucketName: string): Promise<any> {
    try {
      logger.info('Getting bucket security status', { bucketName });

      const securityStatus: any = {};

      // Get public access block status
      try {
        const pabResult = await this.s3.getPublicAccessBlock({ Bucket: bucketName }).promise();
        securityStatus.publicAccessBlock = pabResult.PublicAccessBlockConfiguration;
      } catch (error) {
        securityStatus.publicAccessBlock = null;
      }

      // Get bucket policy
      try {
        const policyResult = await this.s3.getBucketPolicy({ Bucket: bucketName }).promise();
        securityStatus.bucketPolicy = JSON.parse(policyResult.Policy || '{}');
      } catch (error) {
        securityStatus.bucketPolicy = null;
      }

      // Get IAM policies
      try {
        const policiesResult = await this.iam.listPolicies({
          Scope: 'Local',
          PathPrefix: '/compliance-shepherd/'
        }).promise();

        securityStatus.iamPolicies = policiesResult.Policies?.filter(policy => 
          policy.PolicyName?.includes(bucketName)
        ) || [];
      } catch (error) {
        securityStatus.iamPolicies = [];
      }

      logger.info('Bucket security status retrieved', {
        bucketName,
        hasPublicAccessBlock: !!securityStatus.publicAccessBlock,
        hasBucketPolicy: !!securityStatus.bucketPolicy,
        iamPoliciesCount: securityStatus.iamPolicies.length
      });

      return securityStatus;

    } catch (error) {
      logger.error('Failed to get bucket security status', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate bucket security configuration
   */
  async validateBucketSecurity(bucketName: string): Promise<any> {
    try {
      logger.info('Validating bucket security configuration', { bucketName });

      const validation = {
        bucketName,
        isValid: true,
        issues: [] as string[],
        recommendations: [] as string[]
      };

      // Check public access block
      try {
        const pabResult = await this.s3.getPublicAccessBlock({ Bucket: bucketName }).promise();
        const pab = pabResult.PublicAccessBlockConfiguration;
        
        if (!pab?.BlockPublicAcls || !pab?.IgnorePublicAcls || !pab?.BlockPublicPolicy || !pab?.RestrictPublicBuckets) {
          validation.issues.push('Public access block is not fully configured');
          validation.recommendations.push('Enable all public access block settings');
        }
      } catch (error) {
        validation.issues.push('Public access block is not configured');
        validation.recommendations.push('Configure public access block to prevent public access');
      }

      // Check bucket policy
      try {
        const policyResult = await this.s3.getBucketPolicy({ Bucket: bucketName }).promise();
        const policy = JSON.parse(policyResult.Policy || '{}');
        
        if (!policy.Statement || policy.Statement.length === 0) {
          validation.issues.push('Bucket policy is empty');
          validation.recommendations.push('Configure bucket policy with appropriate permissions');
        }
      } catch (error) {
        validation.issues.push('Bucket policy is not configured');
        validation.recommendations.push('Configure bucket policy for access control');
      }

      // Check encryption
      try {
        const encryptionResult = await this.s3.getBucketEncryption({ Bucket: bucketName }).promise();
        const encryption = encryptionResult.ServerSideEncryptionConfiguration;
        
        if (!encryption?.Rules || encryption.Rules.length === 0) {
          validation.issues.push('Bucket encryption is not configured');
          validation.recommendations.push('Enable server-side encryption');
        }
      } catch (error) {
        validation.issues.push('Bucket encryption is not configured');
        validation.recommendations.push('Enable server-side encryption for data protection');
      }

      // Check versioning
      try {
        const versioningResult = await this.s3.getBucketVersioning({ Bucket: bucketName }).promise();
        
        if (versioningResult.Status !== 'Enabled') {
          validation.issues.push('Bucket versioning is not enabled');
          validation.recommendations.push('Enable versioning for data protection');
        }
      } catch (error) {
        validation.issues.push('Bucket versioning is not configured');
        validation.recommendations.push('Enable versioning for data protection');
      }

      validation.isValid = validation.issues.length === 0;

      logger.info('Bucket security validation completed', {
        bucketName,
        isValid: validation.isValid,
        issuesCount: validation.issues.length
      });

      return validation;

    } catch (error) {
      logger.error('Failed to validate bucket security', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}
