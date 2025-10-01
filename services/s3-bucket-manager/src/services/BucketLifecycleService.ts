/**
 * Bucket Lifecycle Service
 * 
 * Handles S3 bucket lifecycle policies for automated data management,
 * including transitions, expiration, and cost optimization.
 */

import { S3 } from 'aws-sdk';
import { logger } from '../utils/logger';

export interface LifecycleRule {
  id: string;
  status: 'Enabled' | 'Disabled';
  filter?: {
    prefix?: string;
    tags?: Array<{ Key: string; Value: string }>;
  };
  transitions?: Array<{
    days: number;
    storageClass: 'STANDARD_IA' | 'GLACIER' | 'DEEP_ARCHIVE';
  }>;
  expiration?: {
    days: number;
  };
  noncurrentVersionExpiration?: {
    noncurrentDays: number;
  };
  abortIncompleteMultipartUpload?: {
    daysAfterInitiation: number;
  };
}

export interface LifecycleConfiguration {
  enabled: boolean;
  rules: LifecycleRule[];
}

export class BucketLifecycleService {
  private s3: S3;

  constructor() {
    this.s3 = new S3({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }

  /**
   * Configure lifecycle policy for bucket
   */
  async configureLifecyclePolicy(bucketName: string, lifecycleConfig: any): Promise<void> {
    try {
      logger.info('Configuring lifecycle policy', {
        bucketName,
        enabled: lifecycleConfig.enabled,
        rulesCount: lifecycleConfig.rules?.length || 0
      });

      if (!lifecycleConfig.enabled || !lifecycleConfig.rules || lifecycleConfig.rules.length === 0) {
        // Remove existing lifecycle configuration
        try {
          await this.s3.deleteBucketLifecycleConfiguration({ Bucket: bucketName }).promise();
          logger.info('Lifecycle policy removed', { bucketName });
        } catch (error) {
          // Lifecycle policy might not exist
          logger.info('No lifecycle policy to remove', { bucketName });
        }
        return;
      }

      // Configure lifecycle policy
      const lifecycleParams = {
        Bucket: bucketName,
        LifecycleConfiguration: {
          Rules: lifecycleConfig.rules.map((rule: any) => this.convertToS3LifecycleRule(rule))
        }
      };

      await this.s3.putBucketLifecycleConfiguration(lifecycleParams).promise();

      logger.info('Lifecycle policy configured successfully', {
        bucketName,
        rulesCount: lifecycleConfig.rules.length
      });

    } catch (error) {
      logger.error('Failed to configure lifecycle policy', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Convert internal lifecycle rule to S3 format
   */
  private convertToS3LifecycleRule(rule: any): any {
    const s3Rule: any = {
      ID: rule.id,
      Status: rule.status
    };

    // Add filter if specified
    if (rule.filter) {
      s3Rule.Filter = {};
      
      if (rule.filter.prefix) {
        s3Rule.Filter.Prefix = rule.filter.prefix;
      }
      
      if (rule.filter.tags && rule.filter.tags.length > 0) {
        s3Rule.Filter.Tag = rule.filter.tags;
      }
    }

    // Add transitions
    if (rule.transitions && rule.transitions.length > 0) {
      s3Rule.Transitions = rule.transitions.map((transition: any) => ({
        Days: transition.days,
        StorageClass: transition.storageClass
      }));
    }

    // Add expiration
    if (rule.expiration) {
      s3Rule.Expiration = {
        Days: rule.expiration.days
      };
    }

    // Add noncurrent version expiration
    if (rule.noncurrentVersionExpiration) {
      s3Rule.NoncurrentVersionExpiration = {
        NoncurrentDays: rule.noncurrentVersionExpiration.noncurrentDays
      };
    }

    // Add abort incomplete multipart upload
    if (rule.abortIncompleteMultipartUpload) {
      s3Rule.AbortIncompleteMultipartUpload = {
        DaysAfterInitiation: rule.abortIncompleteMultipartUpload.daysAfterInitiation
      };
    }

    return s3Rule;
  }

  /**
   * Update lifecycle policy
   */
  async updateLifecyclePolicy(bucketName: string, updateData: any): Promise<LifecycleConfiguration> {
    try {
      logger.info('Updating lifecycle policy', {
        bucketName,
        updateData
      });

      // Get current lifecycle configuration
      let currentConfig: LifecycleConfiguration;
      try {
        const currentResult = await this.s3.getBucketLifecycleConfiguration({ Bucket: bucketName }).promise();
        currentConfig = this.convertFromS3LifecycleConfiguration(currentResult);
      } catch (error) {
        // No existing lifecycle configuration
        currentConfig = {
          enabled: false,
          rules: []
        };
      }

      // Update configuration
      if (updateData.enabled !== undefined) {
        currentConfig.enabled = updateData.enabled;
      }

      if (updateData.rules) {
        currentConfig.rules = updateData.rules;
      }

      // Apply updated configuration
      await this.configureLifecyclePolicy(bucketName, currentConfig);

      logger.info('Lifecycle policy updated successfully', {
        bucketName,
        enabled: currentConfig.enabled,
        rulesCount: currentConfig.rules.length
      });

      return currentConfig;

    } catch (error) {
      logger.error('Failed to update lifecycle policy', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Convert S3 lifecycle configuration to internal format
   */
  private convertFromS3LifecycleConfiguration(s3Config: any): LifecycleConfiguration {
    const config: LifecycleConfiguration = {
      enabled: true,
      rules: []
    };

    if (s3Config.Rules) {
      config.rules = s3Config.Rules.map((rule: any) => ({
        id: rule.ID,
        status: rule.Status,
        filter: rule.Filter ? {
          prefix: rule.Filter.Prefix,
          tags: rule.Filter.Tag
        } : undefined,
        transitions: rule.Transitions?.map((transition: any) => ({
          days: transition.Days,
          storageClass: transition.StorageClass
        })),
        expiration: rule.Expiration ? {
          days: rule.Expiration.Days
        } : undefined,
        noncurrentVersionExpiration: rule.NoncurrentVersionExpiration ? {
          noncurrentDays: rule.NoncurrentVersionExpiration.NoncurrentDays
        } : undefined,
        abortIncompleteMultipartUpload: rule.AbortIncompleteMultipartUpload ? {
          daysAfterInitiation: rule.AbortIncompleteMultipartUpload.DaysAfterInitiation
        } : undefined
      }));
    }

    return config;
  }

  /**
   * Get lifecycle policy
   */
  async getLifecyclePolicy(bucketName: string): Promise<LifecycleConfiguration | null> {
    try {
      logger.info('Getting lifecycle policy', { bucketName });

      const result = await this.s3.getBucketLifecycleConfiguration({ Bucket: bucketName }).promise();
      const config = this.convertFromS3LifecycleConfiguration(result);

      logger.info('Lifecycle policy retrieved', {
        bucketName,
        enabled: config.enabled,
        rulesCount: config.rules.length
      });

      return config;

    } catch (error) {
      if ((error as any).statusCode === 404) {
        logger.info('No lifecycle policy found', { bucketName });
        return null;
      }

      logger.error('Failed to get lifecycle policy', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate default lifecycle policy based on bucket purpose
   */
  generateDefaultLifecyclePolicy(purpose: string): LifecycleConfiguration {
    const config: LifecycleConfiguration = {
      enabled: true,
      rules: []
    };

    switch (purpose) {
      case 'reports':
        config.rules = [
          {
            id: 'reports-cleanup',
            status: 'Enabled',
            filter: {
              prefix: 'reports/'
            },
            transitions: [
              {
                days: 30,
                storageClass: 'STANDARD_IA'
              },
              {
                days: 90,
                storageClass: 'GLACIER'
              }
            ],
            expiration: {
              days: 365
            },
            noncurrentVersionExpiration: {
              noncurrentDays: 30
            }
          }
        ];
        break;

      case 'artifacts':
        config.rules = [
          {
            id: 'artifacts-cleanup',
            status: 'Enabled',
            filter: {
              prefix: 'artifacts/'
            },
            transitions: [
              {
                days: 7,
                storageClass: 'STANDARD_IA'
              },
              {
                days: 30,
                storageClass: 'GLACIER'
              }
            ],
            expiration: {
              days: 90
            },
            noncurrentVersionExpiration: {
              noncurrentDays: 7
            }
          }
        ];
        break;

      case 'logs':
        config.rules = [
          {
            id: 'logs-cleanup',
            status: 'Enabled',
            filter: {
              prefix: 'logs/'
            },
            transitions: [
              {
                days: 1,
                storageClass: 'STANDARD_IA'
              },
              {
                days: 7,
                storageClass: 'GLACIER'
              }
            ],
            expiration: {
              days: 30
            },
            noncurrentVersionExpiration: {
              noncurrentDays: 1
            }
          }
        ];
        break;

      case 'backups':
        config.rules = [
          {
            id: 'backups-cleanup',
            status: 'Enabled',
            filter: {
              prefix: 'backups/'
            },
            transitions: [
              {
                days: 30,
                storageClass: 'STANDARD_IA'
              },
              {
                days: 90,
                storageClass: 'GLACIER'
              },
              {
                days: 365,
                storageClass: 'DEEP_ARCHIVE'
              }
            ],
            expiration: {
              days: 2555 // 7 years
            },
            noncurrentVersionExpiration: {
              noncurrentDays: 30
            }
          }
        ];
        break;

      default:
        config.rules = [
          {
            id: 'default-cleanup',
            status: 'Enabled',
            transitions: [
              {
                days: 30,
                storageClass: 'STANDARD_IA'
              },
              {
                days: 90,
                storageClass: 'GLACIER'
              }
            ],
            expiration: {
              days: 365
            },
            noncurrentVersionExpiration: {
              noncurrentDays: 30
            }
          }
        ];
        break;
    }

    return config;
  }

  /**
   * Validate lifecycle policy
   */
  async validateLifecyclePolicy(bucketName: string): Promise<any> {
    try {
      logger.info('Validating lifecycle policy', { bucketName });

      const validation = {
        bucketName,
        isValid: true,
        issues: [] as string[],
        recommendations: [] as string[]
      };

      try {
        const policy = await this.getLifecyclePolicy(bucketName);
        
        if (!policy) {
          validation.issues.push('No lifecycle policy configured');
          validation.recommendations.push('Configure lifecycle policy for cost optimization');
          validation.isValid = false;
          return validation;
        }

        if (!policy.enabled) {
          validation.issues.push('Lifecycle policy is disabled');
          validation.recommendations.push('Enable lifecycle policy');
        }

        if (!policy.rules || policy.rules.length === 0) {
          validation.issues.push('No lifecycle rules configured');
          validation.recommendations.push('Add lifecycle rules for data management');
        }

        // Validate individual rules
        policy.rules.forEach((rule, index) => {
          if (!rule.id) {
            validation.issues.push(`Rule ${index + 1} has no ID`);
          }

          if (rule.status !== 'Enabled' && rule.status !== 'Disabled') {
            validation.issues.push(`Rule ${index + 1} has invalid status`);
          }

          if (!rule.transitions && !rule.expiration && !rule.noncurrentVersionExpiration) {
            validation.issues.push(`Rule ${index + 1} has no actions configured`);
          }

          if (rule.transitions) {
            rule.transitions.forEach((transition, tIndex) => {
              if (transition.days < 0) {
                validation.issues.push(`Rule ${index + 1}, transition ${tIndex + 1} has invalid days`);
              }
            });
          }

          if (rule.expiration && rule.expiration.days < 0) {
            validation.issues.push(`Rule ${index + 1} has invalid expiration days`);
          }
        });

        validation.isValid = validation.issues.length === 0;

      } catch (error) {
        validation.issues.push('Failed to retrieve lifecycle policy');
        validation.recommendations.push('Check bucket permissions and policy configuration');
        validation.isValid = false;
      }

      logger.info('Lifecycle policy validation completed', {
        bucketName,
        isValid: validation.isValid,
        issuesCount: validation.issues.length
      });

      return validation;

    } catch (error) {
      logger.error('Failed to validate lifecycle policy', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Calculate lifecycle policy cost savings
   */
  async calculateCostSavings(bucketName: string): Promise<any> {
    try {
      logger.info('Calculating lifecycle policy cost savings', { bucketName });

      // Get bucket size and object count
      const listResult = await this.s3.listObjectsV2({ Bucket: bucketName }).promise();
      const objects = listResult.Contents || [];

      if (objects.length === 0) {
        return {
          bucketName,
          totalObjects: 0,
          totalSize: 0,
          estimatedSavings: 0,
          savingsBreakdown: {}
        };
      }

      const totalSize = objects.reduce((total, obj) => total + (obj.Size || 0), 0);
      const totalObjects = objects.length;

      // Get lifecycle policy
      const policy = await this.getLifecyclePolicy(bucketName);
      
      if (!policy || !policy.enabled) {
        return {
          bucketName,
          totalObjects,
          totalSize,
          estimatedSavings: 0,
          savingsBreakdown: {},
          message: 'No lifecycle policy configured'
        };
      }

      // Calculate savings based on transitions
      const savingsBreakdown: any = {};
      let totalSavings = 0;

      // Standard storage cost (per GB per month)
      const standardCost = 0.023; // $0.023 per GB per month
      
      // Transition costs (per GB per month)
      const standardIACost = 0.0125; // $0.0125 per GB per month
      const glacierCost = 0.004; // $0.004 per GB per month
      const deepArchiveCost = 0.00099; // $0.00099 per GB per month

      policy.rules.forEach(rule => {
        if (rule.transitions) {
          rule.transitions.forEach(transition => {
            const sizeGB = totalSize / (1024 * 1024 * 1024);
            const months = transition.days / 30;
            
            let savings = 0;
            switch (transition.storageClass) {
              case 'STANDARD_IA':
                savings = (standardCost - standardIACost) * sizeGB * months;
                break;
              case 'GLACIER':
                savings = (standardCost - glacierCost) * sizeGB * months;
                break;
              case 'DEEP_ARCHIVE':
                savings = (standardCost - deepArchiveCost) * sizeGB * months;
                break;
            }
            
            savingsBreakdown[transition.storageClass] = savings;
            totalSavings += savings;
          });
        }
      });

      const result = {
        bucketName,
        totalObjects,
        totalSize,
        estimatedSavings: totalSavings,
        savingsBreakdown,
        policy: policy
      };

      logger.info('Cost savings calculated', {
        bucketName,
        totalObjects,
        totalSize,
        estimatedSavings: totalSavings
      });

      return result;

    } catch (error) {
      logger.error('Failed to calculate cost savings', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}
