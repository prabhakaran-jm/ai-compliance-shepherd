/**
 * S3 compliance rules implementation
 */

import { S3 } from 'aws-sdk';
import {
  AWSResource,
  Severity,
  ComplianceFramework,
} from '@compliance-shepherd/shared';
import { BaseRuleExecutor } from '../engines/BaseRuleExecutor';
import {
  RuleExecutionContext,
  RuleEvidence,
  RemediationStep,
  RulesEngineConfig,
} from '../types';

/**
 * S3-001: S3 buckets must have default encryption enabled
 */
export class S3DefaultEncryptionRule extends BaseRuleExecutor {
  private s3: S3;

  constructor() {
    super(
      'S3-001',
      'S3 Bucket Default Encryption',
      ['SOC2'],
      'high',
      ['AWS::S3::Bucket'],
      'S3'
    );
    this.s3 = new S3();
  }

  protected async performCheck(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<{ passed: boolean; severity?: Severity; message: string }> {
    const bucketName = this.extractBucketName(resource.arn);
    
    try {
      const result = await this.s3.getBucketEncryption({ Bucket: bucketName }).promise();
      
      const hasEncryption = result.ServerSideEncryptionConfiguration?.Rules?.some(rule => 
        rule.ApplyServerSideEncryptionByDefault?.SSEAlgorithm
      );

      if (hasEncryption) {
        return {
          passed: true,
          message: 'S3 bucket has default encryption enabled',
        };
      } else {
        return {
          passed: false,
          severity: 'high',
          message: 'S3 bucket does not have default encryption enabled',
        };
      }
    } catch (error: any) {
      if (error.code === 'ServerSideEncryptionConfigurationNotFoundError') {
        return {
          passed: false,
          severity: 'high',
          message: 'S3 bucket does not have default encryption configured',
        };
      }
      throw error;
    }
  }

  protected async collectEvidence(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<RuleEvidence[]> {
    const bucketName = this.extractBucketName(resource.arn);
    const evidence: RuleEvidence[] = [];

    try {
      // Get encryption configuration
      const encryptionConfig = await this.s3.getBucketEncryption({ Bucket: bucketName }).promise();
      
      evidence.push(this.createEvidence(
        'configuration',
        'S3 bucket encryption configuration',
        {
          bucketName,
          encryptionRules: encryptionConfig.ServerSideEncryptionConfiguration?.Rules,
        },
        'AWS S3 API'
      ));

      // Get bucket location
      const location = await this.s3.getBucketLocation({ Bucket: bucketName }).promise();
      
      evidence.push(this.createEvidence(
        'configuration',
        'S3 bucket location',
        {
          bucketName,
          location: location.LocationConstraint || 'us-east-1',
        },
        'AWS S3 API'
      ));

    } catch (error: any) {
      if (error.code !== 'ServerSideEncryptionConfigurationNotFoundError') {
        evidence.push(this.createEvidence(
          'configuration',
          'Error retrieving encryption configuration',
          {
            bucketName,
            error: error.message,
            code: error.code,
          },
          'AWS S3 API'
        ));
      }
    }

    return evidence;
  }

  protected async generateRecommendations(
    resource: AWSResource,
    context: RuleExecutionContext,
    checkResult: { passed: boolean; severity?: Severity; message: string }
  ): Promise<string[]> {
    if (checkResult.passed) {
      return ['Encryption is properly configured'];
    }

    return [
      'Enable default encryption using AES-256 (server-side encryption)',
      'Consider using AWS KMS for additional key management features',
      'Apply encryption to existing objects using S3 batch operations',
      'Update bucket policy to enforce encryption for new uploads',
    ];
  }

  protected async generateRemediationSteps(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<RemediationStep[]> {
    const bucketName = this.extractBucketName(resource.arn);

    return [
      this.createRemediationStep(
        1,
        'Enable default encryption',
        'Enable AES-256 default encryption for the S3 bucket',
        'low',
        `aws s3api put-bucket-encryption --bucket ${bucketName} --server-side-encryption-configuration '{
          "Rules": [
            {
              "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
              }
            }
          ]
        }'`,
        `resource "aws_s3_bucket_server_side_encryption_configuration" "example" {
          bucket = "${bucketName}"
          
          rule {
            apply_server_side_encryption_by_default {
              sse_algorithm = "AES256"
            }
          }
        }`
      ),
    ];
  }

  protected async performValidation(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<boolean> {
    // Check if we have the necessary permissions
    try {
      const bucketName = this.extractBucketName(resource.arn);
      await this.s3.headBucket({ Bucket: bucketName }).promise();
      return true;
    } catch (error) {
      return false;
    }
  }

  private extractBucketName(arn: string): string {
    // Extract bucket name from ARN: arn:aws:s3:::bucket-name
    const parts = arn.split(':::', 2);
    return parts[1] || '';
  }
}

/**
 * S3-002: S3 buckets must have public access blocked
 */
export class S3PublicAccessBlockRule extends BaseRuleExecutor {
  private s3: S3;

  constructor() {
    super(
      'S3-002',
      'S3 Bucket Public Access Block',
      ['SOC2'],
      'critical',
      ['AWS::S3::Bucket'],
      'S3'
    );
    this.s3 = new S3();
  }

  protected async performCheck(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<{ passed: boolean; severity?: Severity; message: string }> {
    const bucketName = this.extractBucketName(resource.arn);
    
    try {
      const result = await this.s3.getPublicAccessBlock({ Bucket: bucketName }).promise();
      const config = result.PublicAccessBlockConfiguration;

      const allBlocked = config?.BlockPublicAcls &&
                        config?.BlockPublicPolicy &&
                        config?.IgnorePublicAcls &&
                        config?.RestrictPublicBuckets;

      if (allBlocked) {
        return {
          passed: true,
          message: 'S3 bucket has public access blocked',
        };
      } else {
        return {
          passed: false,
          severity: 'critical',
          message: 'S3 bucket does not have complete public access blocking enabled',
        };
      }
    } catch (error: any) {
      if (error.code === 'NoSuchPublicAccessBlockConfiguration') {
        return {
          passed: false,
          severity: 'critical',
          message: 'S3 bucket does not have public access block configuration',
        };
      }
      throw error;
    }
  }

  protected async collectEvidence(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<RuleEvidence[]> {
    const bucketName = this.extractBucketName(resource.arn);
    const evidence: RuleEvidence[] = [];

    try {
      // Get public access block configuration
      const publicAccessConfig = await this.s3.getPublicAccessBlock({ Bucket: bucketName }).promise();
      
      evidence.push(this.createEvidence(
        'configuration',
        'S3 bucket public access block configuration',
        {
          bucketName,
          configuration: publicAccessConfig.PublicAccessBlockConfiguration,
        },
        'AWS S3 API'
      ));

      // Get bucket policy
      try {
        const bucketPolicy = await this.s3.getBucketPolicy({ Bucket: bucketName }).promise();
        evidence.push(this.createEvidence(
          'policy',
          'S3 bucket policy',
          {
            bucketName,
            policy: JSON.parse(bucketPolicy.Policy || '{}'),
          },
          'AWS S3 API'
        ));
      } catch (error: any) {
        if (error.code !== 'NoSuchBucketPolicy') {
          evidence.push(this.createEvidence(
            'policy',
            'Error retrieving bucket policy',
            {
              bucketName,
              error: error.message,
            },
            'AWS S3 API'
          ));
        }
      }

    } catch (error: any) {
      if (error.code !== 'NoSuchPublicAccessBlockConfiguration') {
        evidence.push(this.createEvidence(
          'configuration',
          'Error retrieving public access block configuration',
          {
            bucketName,
            error: error.message,
            code: error.code,
          },
          'AWS S3 API'
        ));
      }
    }

    return evidence;
  }

  protected async generateRecommendations(
    resource: AWSResource,
    context: RuleExecutionContext,
    checkResult: { passed: boolean; severity?: Severity; message: string }
  ): Promise<string[]> {
    if (checkResult.passed) {
      return ['Public access is properly blocked'];
    }

    return [
      'Enable all public access block settings',
      'Block public ACLs and policies',
      'Ignore public ACLs',
      'Restrict public buckets',
      'Review and remove any public bucket policies',
      'Audit existing public objects and remove if necessary',
    ];
  }

  protected async generateRemediationSteps(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<RemediationStep[]> {
    const bucketName = this.extractBucketName(resource.arn);

    return [
      this.createRemediationStep(
        1,
        'Enable public access block',
        'Enable all public access block settings for the S3 bucket',
        'low',
        `aws s3api put-public-access-block --bucket ${bucketName} --public-access-block-configuration '{
          "BlockPublicAcls": true,
          "BlockPublicPolicy": true,
          "IgnorePublicAcls": true,
          "RestrictPublicBuckets": true
        }'`,
        `resource "aws_s3_bucket_public_access_block" "example" {
          bucket = "${bucketName}"
          
          block_public_acls       = true
          block_public_policy     = true
          ignore_public_acls      = true
          restrict_public_buckets = true
        }`
      ),
    ];
  }

  protected async performValidation(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<boolean> {
    try {
      const bucketName = this.extractBucketName(resource.arn);
      await this.s3.headBucket({ Bucket: bucketName }).promise();
      return true;
    } catch (error) {
      return false;
    }
  }

  private extractBucketName(arn: string): string {
    const parts = arn.split(':::', 2);
    return parts[1] || '';
  }
}

/**
 * S3-003: S3 buckets should have versioning enabled
 */
export class S3VersioningRule extends BaseRuleExecutor {
  private s3: S3;

  constructor() {
    super(
      'S3-003',
      'S3 Bucket Versioning',
      ['SOC2'],
      'medium',
      ['AWS::S3::Bucket'],
      'S3'
    );
    this.s3 = new S3();
  }

  protected async performCheck(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<{ passed: boolean; severity?: Severity; message: string }> {
    const bucketName = this.extractBucketName(resource.arn);
    
    try {
      const result = await this.s3.getBucketVersioning({ Bucket: bucketName }).promise();
      
      if (result.Status === 'Enabled') {
        return {
          passed: true,
          message: 'S3 bucket has versioning enabled',
        };
      } else {
        return {
          passed: false,
          severity: 'medium',
          message: `S3 bucket versioning is ${result.Status || 'not enabled'}`,
        };
      }
    } catch (error: any) {
      throw error;
    }
  }

  protected async collectEvidence(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<RuleEvidence[]> {
    const bucketName = this.extractBucketName(resource.arn);
    const evidence: RuleEvidence[] = [];

    try {
      const versioningConfig = await this.s3.getBucketVersioning({ Bucket: bucketName }).promise();
      
      evidence.push(this.createEvidence(
        'configuration',
        'S3 bucket versioning configuration',
        {
          bucketName,
          status: versioningConfig.Status,
          mfaDelete: versioningConfig.MfaDelete,
        },
        'AWS S3 API'
      ));

    } catch (error: any) {
      evidence.push(this.createEvidence(
        'configuration',
        'Error retrieving versioning configuration',
        {
          bucketName,
          error: error.message,
          code: error.code,
        },
        'AWS S3 API'
      ));
    }

    return evidence;
  }

  protected async generateRecommendations(
    resource: AWSResource,
    context: RuleExecutionContext,
    checkResult: { passed: boolean; severity?: Severity; message: string }
  ): Promise<string[]> {
    if (checkResult.passed) {
      return ['Versioning is properly enabled'];
    }

    return [
      'Enable versioning on the S3 bucket',
      'Consider enabling MFA delete for additional protection',
      'Implement lifecycle policies to manage old versions',
      'Monitor storage costs from versioning',
    ];
  }

  protected async generateRemediationSteps(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<RemediationStep[]> {
    const bucketName = this.extractBucketName(resource.arn);

    return [
      this.createRemediationStep(
        1,
        'Enable versioning',
        'Enable versioning on the S3 bucket',
        'low',
        `aws s3api put-bucket-versioning --bucket ${bucketName} --versioning-configuration Status=Enabled`,
        `resource "aws_s3_bucket_versioning" "example" {
          bucket = "${bucketName}"
          versioning_configuration {
            status = "Enabled"
          }
        }`
      ),
    ];
  }

  protected async performValidation(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<boolean> {
    try {
      const bucketName = this.extractBucketName(resource.arn);
      await this.s3.headBucket({ Bucket: bucketName }).promise();
      return true;
    } catch (error) {
      return false;
    }
  }

  private extractBucketName(arn: string): string {
    const parts = arn.split(':::', 2);
    return parts[1] || '';
  }
}
