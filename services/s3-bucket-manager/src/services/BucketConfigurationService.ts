/**
 * Bucket Configuration Service
 * 
 * Handles S3 bucket creation, configuration, and management operations.
 */

import { S3 } from 'aws-sdk';
import { logger } from '../utils/logger';
import { BucketConfiguration, BucketInfo } from './S3BucketManagerService';

export interface BucketListOptions {
  tenantId: string;
  limit: number;
  offset: number;
  purpose?: string;
}

export interface BucketListResult {
  items: BucketInfo[];
  total: number;
  hasMore: boolean;
}

export class BucketConfigurationService {
  private s3: S3;

  constructor() {
    this.s3 = new S3({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }

  /**
   * Create a new S3 bucket with configuration
   */
  async createBucket(config: BucketConfiguration): Promise<void> {
    try {
      logger.info('Creating S3 bucket', {
        bucketName: config.bucketName,
        region: config.region,
        purpose: config.purpose
      });

      // Create bucket parameters
      const createParams: any = {
        Bucket: config.bucketName
      };

      // Set region for non-us-east-1 buckets
      if (config.region !== 'us-east-1') {
        createParams.CreateBucketConfiguration = {
          LocationConstraint: config.region
        };
      }

      // Create the bucket
      await this.s3.createBucket(createParams).promise();

      // Configure versioning
      if (config.versioning) {
        await this.s3.putBucketVersioning({
          Bucket: config.bucketName,
          VersioningConfiguration: {
            Status: 'Enabled'
          }
        }).promise();
      }

      // Configure encryption
      await this.configureEncryption(config.bucketName, config.encryption, config.kmsKeyId);

      // Configure public access block
      if (config.publicAccessBlock) {
        await this.s3.putPublicAccessBlock({
          Bucket: config.bucketName,
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: true,
            IgnorePublicAcls: true,
            BlockPublicPolicy: true,
            RestrictPublicBuckets: true
          }
        }).promise();
      }

      // Add bucket tags
      await this.s3.putBucketTagging({
        Bucket: config.bucketName,
        Tagging: {
          TagSet: [
            { Key: 'Purpose', Value: config.purpose },
            { Key: 'Environment', Value: process.env.ENVIRONMENT || 'development' },
            { Key: 'CreatedBy', Value: 'compliance-shepherd' },
            { Key: 'CreatedAt', Value: new Date().toISOString() }
          ]
        }
      }).promise();

      logger.info('S3 bucket created successfully', {
        bucketName: config.bucketName,
        region: config.region,
        purpose: config.purpose
      });

    } catch (error) {
      logger.error('Failed to create S3 bucket', {
        bucketName: config.bucketName,
        region: config.region,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Configure bucket encryption
   */
  private async configureEncryption(bucketName: string, encryption: string, kmsKeyId?: string): Promise<void> {
    try {
      const encryptionConfig: any = {
        Bucket: bucketName,
        ServerSideEncryptionConfiguration: {
          Rules: []
        }
      };

      if (encryption === 'AES256') {
        encryptionConfig.ServerSideEncryptionConfiguration.Rules.push({
          ApplyServerSideEncryptionByDefault: {
            SSEAlgorithm: 'AES256'
          }
        });
      } else if (encryption === 'aws-kms' && kmsKeyId) {
        encryptionConfig.ServerSideEncryptionConfiguration.Rules.push({
          ApplyServerSideEncryptionByDefault: {
            SSEAlgorithm: 'aws:kms',
            KMSMasterKeyID: kmsKeyId
          }
        });
      }

      await this.s3.putBucketEncryption(encryptionConfig).promise();

      logger.info('Bucket encryption configured', {
        bucketName,
        encryption,
        kmsKeyId
      });

    } catch (error) {
      logger.error('Failed to configure bucket encryption', {
        bucketName,
        encryption,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Configure CORS for bucket
   */
  async configureCORS(bucketName: string, corsConfig: any): Promise<void> {
    try {
      logger.info('Configuring CORS for bucket', {
        bucketName,
        allowedOrigins: corsConfig.allowedOrigins
      });

      const corsParams = {
        Bucket: bucketName,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: corsConfig.allowedOrigins,
              AllowedMethods: corsConfig.allowedMethods,
              AllowedHeaders: corsConfig.allowedHeaders,
              MaxAgeSeconds: corsConfig.maxAgeSeconds
            }
          ]
        }
      };

      await this.s3.putBucketCors(corsParams).promise();

      logger.info('CORS configured successfully', {
        bucketName
      });

    } catch (error) {
      logger.error('Failed to configure CORS', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get bucket information
   */
  async getBucketInfo(bucketName: string): Promise<BucketInfo | null> {
    try {
      logger.info('Getting bucket information', { bucketName });

      // Check if bucket exists
      try {
        await this.s3.headBucket({ Bucket: bucketName }).promise();
      } catch (error) {
        if ((error as any).statusCode === 404) {
          return null;
        }
        throw error;
      }

      // Get bucket location
      const locationResult = await this.s3.getBucketLocation({ Bucket: bucketName }).promise();
      const region = locationResult.LocationConstraint || 'us-east-1';

      // Get bucket tags
      let tags: any[] = [];
      try {
        const tagsResult = await this.s3.getBucketTagging({ Bucket: bucketName }).promise();
        tags = tagsResult.TagSet || [];
      } catch (error) {
        // Tags might not be set
      }

      // Get bucket size and object count
      const listResult = await this.s3.listObjectsV2({ Bucket: bucketName }).promise();
      const objectCount = listResult.KeyCount || 0;
      const size = (listResult.Contents || []).reduce((total, obj) => total + (obj.Size || 0), 0);

      // Get versioning status
      let versioning = false;
      try {
        const versioningResult = await this.s3.getBucketVersioning({ Bucket: bucketName }).promise();
        versioning = versioningResult.Status === 'Enabled';
      } catch (error) {
        // Versioning might not be configured
      }

      // Get encryption status
      let encryption = 'None';
      try {
        const encryptionResult = await this.s3.getBucketEncryption({ Bucket: bucketName }).promise();
        const rule = encryptionResult.ServerSideEncryptionConfiguration?.Rules?.[0];
        if (rule?.ApplyServerSideEncryptionByDefault) {
          encryption = rule.ApplyServerSideEncryptionByDefault.SSEAlgorithm || 'None';
        }
      } catch (error) {
        // Encryption might not be configured
      }

      // Get public access block status
      let publicAccessBlock = false;
      try {
        const pabResult = await this.s3.getPublicAccessBlock({ Bucket: bucketName }).promise();
        publicAccessBlock = pabResult.PublicAccessBlockConfiguration?.BlockPublicAcls || false;
      } catch (error) {
        // Public access block might not be configured
      }

      // Get lifecycle policy status
      let lifecyclePolicy = false;
      try {
        await this.s3.getBucketLifecycleConfiguration({ Bucket: bucketName }).promise();
        lifecyclePolicy = true;
      } catch (error) {
        // Lifecycle policy might not be configured
      }

      // Get CORS configuration status
      let corsConfiguration = false;
      try {
        await this.s3.getBucketCors({ Bucket: bucketName }).promise();
        corsConfiguration = true;
      } catch (error) {
        // CORS might not be configured
      }

      // Extract purpose from tags
      const purposeTag = tags.find(tag => tag.Key === 'Purpose');
      const purpose = purposeTag?.Value || 'unknown';

      // Get creation date
      const creationDate = new Date().toISOString(); // In real implementation, get from bucket metadata

      const bucketInfo: BucketInfo = {
        bucketName,
        region,
        purpose,
        creationDate,
        size,
        objectCount,
        encryption,
        versioning,
        publicAccessBlock,
        lifecyclePolicy,
        corsConfiguration
      };

      logger.info('Bucket information retrieved', {
        bucketName,
        region,
        purpose,
        objectCount,
        size
      });

      return bucketInfo;

    } catch (error) {
      logger.error('Failed to get bucket information', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * List buckets with filtering and pagination
   */
  async listBuckets(options: BucketListOptions): Promise<BucketListResult> {
    try {
      logger.info('Listing buckets', options);

      // List all buckets
      const listResult = await this.s3.listBuckets().promise();
      const allBuckets = listResult.Buckets || [];

      // Filter buckets by purpose (based on tags)
      const filteredBuckets: BucketInfo[] = [];

      for (const bucket of allBuckets) {
        if (bucket.Name) {
          try {
            const bucketInfo = await this.getBucketInfo(bucket.Name);
            if (bucketInfo) {
              // Filter by purpose if specified
              if (!options.purpose || bucketInfo.purpose === options.purpose) {
                filteredBuckets.push(bucketInfo);
              }
            }
          } catch (error) {
            // Skip buckets that can't be accessed
            logger.warn('Skipping bucket due to access error', {
              bucketName: bucket.Name,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }

      // Apply pagination
      const paginatedBuckets = filteredBuckets.slice(options.offset, options.offset + options.limit);
      const hasMore = filteredBuckets.length > options.offset + options.limit;

      logger.info('Buckets listed successfully', {
        total: filteredBuckets.length,
        returned: paginatedBuckets.length,
        hasMore
      });

      return {
        items: paginatedBuckets,
        total: filteredBuckets.length,
        hasMore
      };

    } catch (error) {
      logger.error('Failed to list buckets', {
        options,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update bucket configuration
   */
  async updateBucketConfiguration(bucketName: string, updateData: any): Promise<BucketInfo> {
    try {
      logger.info('Updating bucket configuration', {
        bucketName,
        updateData
      });

      // Update encryption if specified
      if (updateData.encryption) {
        await this.configureEncryption(bucketName, updateData.encryption, updateData.kmsKeyId);
      }

      // Update versioning if specified
      if (updateData.versioning !== undefined) {
        await this.s3.putBucketVersioning({
          Bucket: bucketName,
          VersioningConfiguration: {
            Status: updateData.versioning ? 'Enabled' : 'Suspended'
          }
        }).promise();
      }

      // Update CORS if specified
      if (updateData.corsConfiguration) {
        await this.configureCORS(bucketName, updateData.corsConfiguration);
      }

      // Get updated bucket info
      const updatedInfo = await this.getBucketInfo(bucketName);

      if (!updatedInfo) {
        throw new Error(`Bucket ${bucketName} not found after update`);
      }

      logger.info('Bucket configuration updated successfully', {
        bucketName
      });

      return updatedInfo;

    } catch (error) {
      logger.error('Failed to update bucket configuration', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Delete bucket
   */
  async deleteBucket(bucketName: string): Promise<boolean> {
    try {
      logger.info('Deleting bucket', { bucketName });

      // Check if bucket exists
      try {
        await this.s3.headBucket({ Bucket: bucketName }).promise();
      } catch (error) {
        if ((error as any).statusCode === 404) {
          return false;
        }
        throw error;
      }

      // Delete all objects in the bucket
      const listResult = await this.s3.listObjectsV2({ Bucket: bucketName }).promise();
      const objects = listResult.Contents || [];

      if (objects.length > 0) {
        const deleteParams = {
          Bucket: bucketName,
          Delete: {
            Objects: objects.map(obj => ({ Key: obj.Key! }))
          }
        };

        await this.s3.deleteObjects(deleteParams).promise();
      }

      // Delete the bucket
      await this.s3.deleteBucket({ Bucket: bucketName }).promise();

      logger.info('Bucket deleted successfully', { bucketName });

      return true;

    } catch (error) {
      logger.error('Failed to delete bucket', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get bucket statistics
   */
  async getBucketStatistics(bucketName: string): Promise<any> {
    try {
      logger.info('Getting bucket statistics', { bucketName });

      // Get bucket size and object count
      const listResult = await this.s3.listObjectsV2({ Bucket: bucketName }).promise();
      const objects = listResult.Contents || [];

      const stats = {
        totalObjects: objects.length,
        totalSize: objects.reduce((total, obj) => total + (obj.Size || 0), 0),
        averageObjectSize: objects.length > 0 ? objects.reduce((total, obj) => total + (obj.Size || 0), 0) / objects.length : 0,
        oldestObject: objects.length > 0 ? Math.min(...objects.map(obj => obj.LastModified?.getTime() || 0)) : null,
        newestObject: objects.length > 0 ? Math.max(...objects.map(obj => obj.LastModified?.getTime() || 0)) : null,
        storageClasses: {} as { [key: string]: number },
        fileTypes: {} as { [key: string]: number }
      };

      // Analyze storage classes and file types
      objects.forEach(obj => {
        const storageClass = obj.StorageClass || 'STANDARD';
        const fileType = obj.Key?.split('.').pop() || 'unknown';
        
        stats.storageClasses[storageClass] = (stats.storageClasses[storageClass] || 0) + 1;
        stats.fileTypes[fileType] = (stats.fileTypes[fileType] || 0) + 1;
      });

      logger.info('Bucket statistics calculated', {
        bucketName,
        totalObjects: stats.totalObjects,
        totalSize: stats.totalSize
      });

      return stats;

    } catch (error) {
      logger.error('Failed to get bucket statistics', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}
