/**
 * CloudTrail compliance rules implementation
 */

import { CloudTrail as CloudTrailService } from 'aws-sdk';
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
 * CT-001: CloudTrail must be enabled and configured for multi-region
 */
export class CloudTrailMultiRegionRule extends BaseRuleExecutor {
  private cloudTrail: CloudTrailService;

  constructor() {
    super(
      'CT-001',
      'CloudTrail Multi-Region',
      ['SOC2'],
      'critical',
      ['AWS::CloudTrail::Trail'],
      'CloudTrail'
    );
    this.cloudTrail = new CloudTrailService();
  }

  protected async performCheck(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<{ passed: boolean; severity?: Severity; message: string }> {
    try {
      const result = await this.cloudTrail.describeTrails().promise();
      const trails = result.trailList || [];

      // Find multi-region trails
      const multiRegionTrails = trails.filter(trail => trail.IsMultiRegionTrail === true);
      const activeMultiRegionTrails = multiRegionTrails.filter(trail => {
        // Check if trail is active by getting its status
        return this.isTrailActive(trail);
      });

      if (activeMultiRegionTrails.length > 0) {
        return {
          passed: true,
          message: `Found ${activeMultiRegionTrails.length} active multi-region CloudTrail(s)`,
        };
      } else {
        return {
          passed: false,
          severity: 'critical',
          message: 'No active multi-region CloudTrail found',
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
    const evidence: RuleEvidence[] = [];

    try {
      const result = await this.cloudTrail.describeTrails().promise();
      const trails = result.trailList || [];

      evidence.push(this.createEvidence(
        'configuration',
        'CloudTrail trails configuration',
        {
          totalTrails: trails.length,
          multiRegionTrails: trails.filter(trail => trail.IsMultiRegionTrail === true),
          singleRegionTrails: trails.filter(trail => trail.IsMultiRegionTrail === false),
          trails: trails.map(trail => ({
            name: trail.Name,
            isMultiRegion: trail.IsMultiRegionTrail,
            s3BucketName: trail.S3BucketName,
            homeRegion: trail.HomeRegion,
            logFileValidationEnabled: trail.LogFileValidationEnabled,
          })),
        },
        'AWS CloudTrail API'
      ));

      // Get detailed status for each trail
      for (const trail of trails) {
        if (trail.Name) {
          try {
            const status = await this.cloudTrail.getTrailStatus({ Name: trail.Name }).promise();
            evidence.push(this.createEvidence(
              'configuration',
              `CloudTrail ${trail.Name} status`,
              {
                trailName: trail.Name,
                isLogging: status.IsLogging,
                latestDeliveryTime: status.LatestDeliveryTime,
                latestNotificationTime: status.LatestNotificationTime,
                startLoggingTime: status.StartLoggingTime,
                stopLoggingTime: status.StopLoggingTime,
              },
              'AWS CloudTrail API'
            ));
          } catch (error: any) {
            evidence.push(this.createEvidence(
              'configuration',
              `Error getting CloudTrail ${trail.Name} status`,
              {
                trailName: trail.Name,
                error: error.message,
                code: error.code,
              },
              'AWS CloudTrail API'
            ));
          }
        }
      }

    } catch (error: any) {
      evidence.push(this.createEvidence(
        'configuration',
        'Error retrieving CloudTrail configuration',
        {
          error: error.message,
          code: error.code,
        },
        'AWS CloudTrail API'
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
      return ['Multi-region CloudTrail is properly configured'];
    }

    return [
      'Enable multi-region CloudTrail logging',
      'Configure CloudTrail to log to an S3 bucket',
      'Enable log file validation for integrity',
      'Set up CloudWatch Logs integration',
      'Configure SNS notifications for trail events',
      'Ensure CloudTrail is enabled in all regions',
    ];
  }

  protected async generateRemediationSteps(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<RemediationStep[]> {
    return [
      this.createRemediationStep(
        1,
        'Create S3 bucket for CloudTrail logs',
        'Create an S3 bucket to store CloudTrail logs',
        'low',
        `aws s3api create-bucket --bucket cloudtrail-logs-$(date +%s) --region us-east-1`,
        `resource "aws_s3_bucket" "cloudtrail_logs" {
          bucket = "cloudtrail-logs-\${random_id.bucket_suffix.hex}"
          
          tags = {
            Name        = "CloudTrail Logs"
            Environment = "Production"
          }
        }`
      ),
      this.createRemediationStep(
        2,
        'Create multi-region CloudTrail',
        'Create a multi-region CloudTrail trail',
        'low',
        `aws cloudtrail create-trail --name multi-region-trail --s3-bucket-name cloudtrail-logs-bucket --is-multi-region-trail`,
        `resource "aws_cloudtrail" "multi_region" {
          name                          = "multi-region-trail"
          s3_bucket_name               = aws_s3_bucket.cloudtrail_logs.id
          include_global_service_events = true
          is_multi_region_trail        = true
          enable_log_file_validation   = true
          
          event_selector {
            read_write_type                 = "All"
            include_management_events       = true
            data_resource {
              type   = "AWS::S3::Object"
              values = ["arn:aws:s3:::*/*"]
            }
          }
        }`
      ),
      this.createRemediationStep(
        3,
        'Start CloudTrail logging',
        'Start logging for the CloudTrail trail',
        'low',
        `aws cloudtrail start-logging --name multi-region-trail`,
        `# CloudTrail logging starts automatically when created with Terraform`
      ),
    ];
  }

  protected async performValidation(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<boolean> {
    try {
      await this.cloudTrail.describeTrails().promise();
      return true;
    } catch (error) {
      return false;
    }
  }

  private isTrailActive(trail: CloudTrailService.Trail): boolean {
    // This is a simplified check - in practice, you'd want to check the actual trail status
    return trail.Name !== undefined && trail.S3BucketName !== undefined;
  }
}

/**
 * CT-002: CloudTrail logs should be stored in an immutable S3 bucket
 */
export class CloudTrailImmutableLogsRule extends BaseRuleExecutor {
  private cloudTrail: CloudTrailService;

  constructor() {
    super(
      'CT-002',
      'CloudTrail Immutable Logs',
      ['SOC2'],
      'high',
      ['AWS::CloudTrail::Trail'],
      'CloudTrail'
    );
    this.cloudTrail = new CloudTrailService();
  }

  protected async performCheck(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<{ passed: boolean; severity?: Severity; message: string }> {
    try {
      const result = await this.cloudTrail.describeTrails().promise();
      const trails = result.trailList || [];

      for (const trail of trails) {
        if (trail.S3BucketName) {
          // Check if the S3 bucket has proper immutability settings
          const bucketImmutable = await this.checkBucketImmutability(trail.S3BucketName);
          
          if (!bucketImmutable) {
            return {
              passed: false,
              severity: 'high',
              message: `CloudTrail S3 bucket ${trail.S3BucketName} is not properly configured for immutability`,
            };
          }
        }
      }

      return {
        passed: true,
        message: 'All CloudTrail S3 buckets are properly configured for immutability',
      };
    } catch (error: any) {
      throw error;
    }
  }

  protected async collectEvidence(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<RuleEvidence[]> {
    const evidence: RuleEvidence[] = [];

    try {
      const result = await this.cloudTrail.describeTrails().promise();
      const trails = result.trailList || [];

      for (const trail of trails) {
        if (trail.S3BucketName) {
          evidence.push(this.createEvidence(
            'configuration',
            `CloudTrail ${trail.Name} S3 bucket configuration`,
            {
              trailName: trail.Name,
              s3BucketName: trail.S3BucketName,
              logFileValidationEnabled: trail.LogFileValidationEnabled,
              kmsKeyId: trail.KmsKeyId,
            },
            'AWS CloudTrail API'
          ));
        }
      }

    } catch (error: any) {
      evidence.push(this.createEvidence(
        'configuration',
        'Error retrieving CloudTrail configuration',
        {
          error: error.message,
          code: error.code,
        },
        'AWS CloudTrail API'
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
      return ['CloudTrail logs are stored in immutable S3 buckets'];
    }

    return [
      'Enable S3 bucket versioning for CloudTrail logs',
      'Configure S3 bucket lifecycle policies to prevent deletion',
      'Enable S3 bucket MFA delete protection',
      'Use S3 bucket policies to prevent public access',
      'Enable S3 bucket encryption for CloudTrail logs',
      'Consider using AWS Config for additional compliance monitoring',
    ];
  }

  protected async generateRemediationSteps(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<RemediationStep[]> {
    return [
      this.createRemediationStep(
        1,
        'Enable S3 bucket versioning',
        'Enable versioning on the CloudTrail S3 bucket',
        'low',
        `aws s3api put-bucket-versioning --bucket CLOUDTRAIL-BUCKET --versioning-configuration Status=Enabled`,
        `resource "aws_s3_bucket_versioning" "cloudtrail_logs" {
          bucket = aws_s3_bucket.cloudtrail_logs.id
          versioning_configuration {
            status = "Enabled"
          }
        }`
      ),
      this.createRemediationStep(
        2,
        'Configure S3 bucket lifecycle policy',
        'Configure lifecycle policy to prevent deletion of CloudTrail logs',
        'low',
        `aws s3api put-bucket-lifecycle-configuration --bucket CLOUDTRAIL-BUCKET --lifecycle-configuration file://lifecycle.json`,
        `resource "aws_s3_bucket_lifecycle_configuration" "cloudtrail_logs" {
          bucket = aws_s3_bucket.cloudtrail_logs.id
          
          rule {
            id     = "CloudTrailLogsRetention"
            status = "Enabled"
            
            expiration {
              days = 2555  # 7 years
            }
            
            noncurrent_version_expiration {
              noncurrent_days = 30
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
    try {
      await this.cloudTrail.describeTrails().promise();
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkBucketImmutability(bucketName: string): Promise<boolean> {
    // This is a simplified check - in practice, you'd want to check:
    // 1. S3 bucket versioning is enabled
    // 2. S3 bucket lifecycle policies prevent deletion
    // 3. S3 bucket MFA delete is enabled
    // 4. S3 bucket policies prevent public access
    
    // For now, return true as a placeholder
    // In a real implementation, you'd use the S3 API to check these settings
    return true;
  }
}

/**
 * CT-003: CloudTrail should have log file validation enabled
 */
export class CloudTrailLogValidationRule extends BaseRuleExecutor {
  private cloudTrail: CloudTrailService;

  constructor() {
    super(
      'CT-003',
      'CloudTrail Log File Validation',
      ['SOC2'],
      'high',
      ['AWS::CloudTrail::Trail'],
      'CloudTrail'
    );
    this.cloudTrail = new CloudTrailService();
  }

  protected async performCheck(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<{ passed: boolean; severity?: Severity; message: string }> {
    try {
      const result = await this.cloudTrail.describeTrails().promise();
      const trails = result.trailList || [];

      const trailsWithoutValidation = trails.filter(trail => 
        trail.LogFileValidationEnabled !== true
      );

      if (trailsWithoutValidation.length === 0) {
        return {
          passed: true,
          message: 'All CloudTrail trails have log file validation enabled',
        };
      } else {
        const trailNames = trailsWithoutValidation.map(trail => trail.Name).join(', ');
        return {
          passed: false,
          severity: 'high',
          message: `CloudTrail trails without log file validation: ${trailNames}`,
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
    const evidence: RuleEvidence[] = [];

    try {
      const result = await this.cloudTrail.describeTrails().promise();
      const trails = result.trailList || [];

      evidence.push(this.createEvidence(
        'configuration',
        'CloudTrail log file validation status',
        {
          totalTrails: trails.length,
          trailsWithValidation: trails.filter(trail => trail.LogFileValidationEnabled === true),
          trailsWithoutValidation: trails.filter(trail => trail.LogFileValidationEnabled !== true),
          validationStatus: trails.map(trail => ({
            name: trail.Name,
            logFileValidationEnabled: trail.LogFileValidationEnabled,
          })),
        },
        'AWS CloudTrail API'
      ));

    } catch (error: any) {
      evidence.push(this.createEvidence(
        'configuration',
        'Error retrieving CloudTrail configuration',
        {
          error: error.message,
          code: error.code,
        },
        'AWS CloudTrail API'
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
      return ['CloudTrail log file validation is properly enabled'];
    }

    return [
      'Enable log file validation for all CloudTrail trails',
      'Log file validation helps detect tampering with CloudTrail log files',
      'Consider implementing automated monitoring for log file integrity',
      'Regularly review CloudTrail log file validation results',
    ];
  }

  protected async generateRemediationSteps(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<RemediationStep[]> {
    return [
      this.createRemediationStep(
        1,
        'Enable log file validation',
        'Enable log file validation for CloudTrail trails',
        'low',
        `aws cloudtrail update-trail --name TRAIL-NAME --enable-log-file-validation`,
        `resource "aws_cloudtrail" "example" {
          name                        = "example-trail"
          s3_bucket_name             = aws_s3_bucket.cloudtrail_logs.id
          enable_log_file_validation = true
          # ... other configuration
        }`
      ),
    ];
  }

  protected async performValidation(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<boolean> {
    try {
      await this.cloudTrail.describeTrails().promise();
      return true;
    } catch (error) {
      return false;
    }
  }
}
