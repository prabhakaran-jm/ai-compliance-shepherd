/**
 * S3 Resource Discovery Service
 * 
 * Discovers S3 buckets and their configurations for compliance scanning.
 */

import { S3 } from 'aws-sdk';
import {
  AWSResource,
  ResourceConfig,
  Region
} from '@compliance-shepherd/shared';
import { logger } from '../../utils/logger';

export class S3ResourceDiscovery {
  private s3: S3;

  constructor() {
    this.s3 = new S3();
  }

  /**
   * Discover S3 resources in a specific region
   */
  async discoverRegionalResources(accountId: string, region: Region): Promise<AWSResource[]> {
    const resources: AWSResource[] = [];

    try {
      // List all buckets
      const buckets = await this.s3.listBuckets().promise();

      for (const bucket of buckets.Buckets || []) {
        try {
          // Get bucket location
          const location = await this.s3.getBucketLocation({ Bucket: bucket.Name! }).promise();
          const bucketRegion = location.LocationConstraint || 'us-east-1';

          // Only process buckets in the requested region
          if (bucketRegion === region) {
            const resource: AWSResource = {
              id: `s3://${bucket.Name}`,
              type: 's3_bucket',
              arn: `arn:aws:s3:::${bucket.Name}`,
              name: bucket.Name!,
              accountId,
              region: bucketRegion as Region,
              service: 's3',
              resourceType: 'bucket',
              tags: await this.getBucketTags(bucket.Name!),
              metadata: {
                creationDate: bucket.CreationDate?.toISOString(),
                location: bucketRegion
              }
            };

            resources.push(resource);
          }
        } catch (error) {
          logger.error('Failed to process S3 bucket', {
            bucketName: bucket.Name,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info('S3 resource discovery completed', {
        accountId,
        region,
        bucketCount: resources.length
      });

      return resources;

    } catch (error) {
      logger.error('S3 resource discovery failed', {
        accountId,
        region,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get resource configuration for S3 bucket
   */
  async getResourceConfiguration(resource: AWSResource): Promise<ResourceConfig> {
    const bucketName = resource.name;
    const config: ResourceConfig = {
      resourceId: resource.id,
      resourceType: resource.type,
      configuration: {}
    };

    try {
      // Get bucket encryption
      try {
        const encryption = await this.s3.getBucketEncryption({ Bucket: bucketName }).promise();
        config.configuration.encryption = encryption.ServerSideEncryptionConfiguration;
      } catch (error) {
        // Bucket may not have encryption configured
        config.configuration.encryption = null;
      }

      // Get bucket versioning
      try {
        const versioning = await this.s3.getBucketVersioning({ Bucket: bucketName }).promise();
        config.configuration.versioning = versioning;
      } catch (error) {
        config.configuration.versioning = null;
      }

      // Get bucket public access block
      try {
        const publicAccessBlock = await this.s3.getPublicAccessBlock({ Bucket: bucketName }).promise();
        config.configuration.publicAccessBlock = publicAccessBlock.PublicAccessBlockConfiguration;
      } catch (error) {
        config.configuration.publicAccessBlock = null;
      }

      // Get bucket policy
      try {
        const policy = await this.s3.getBucketPolicy({ Bucket: bucketName }).promise();
        config.configuration.policy = policy.Policy;
      } catch (error) {
        config.configuration.policy = null;
      }

      // Get bucket ACL
      try {
        const acl = await this.s3.getBucketAcl({ Bucket: bucketName }).promise();
        config.configuration.acl = acl;
      } catch (error) {
        config.configuration.acl = null;
      }

      // Get bucket lifecycle configuration
      try {
        const lifecycle = await this.s3.getBucketLifecycleConfiguration({ Bucket: bucketName }).promise();
        config.configuration.lifecycle = lifecycle.Rules;
      } catch (error) {
        config.configuration.lifecycle = null;
      }

      // Get bucket notification configuration
      try {
        const notifications = await this.s3.getBucketNotificationConfiguration({ Bucket: bucketName }).promise();
        config.configuration.notifications = notifications;
      } catch (error) {
        config.configuration.notifications = null;
      }

      // Get bucket website configuration
      try {
        const website = await this.s3.getBucketWebsite({ Bucket: bucketName }).promise();
        config.configuration.website = website;
      } catch (error) {
        config.configuration.website = null;
      }

      // Get bucket CORS configuration
      try {
        const cors = await this.s3.getBucketCors({ Bucket: bucketName }).promise();
        config.configuration.cors = cors.CORSRules;
      } catch (error) {
        config.configuration.cors = null;
      }

      // Get bucket logging configuration
      try {
        const logging = await this.s3.getBucketLogging({ Bucket: bucketName }).promise();
        config.configuration.logging = logging.LoggingEnabled;
      } catch (error) {
        config.configuration.logging = null;
      }

      // Get bucket replication configuration
      try {
        const replication = await this.s3.getBucketReplication({ Bucket: bucketName }).promise();
        config.configuration.replication = replication.ReplicationConfiguration;
      } catch (error) {
        config.configuration.replication = null;
      }

      // Get bucket request payment configuration
      try {
        const requestPayment = await this.s3.getBucketRequestPayment({ Bucket: bucketName }).promise();
        config.configuration.requestPayment = requestPayment.Payer;
      } catch (error) {
        config.configuration.requestPayment = null;
      }

      // Get bucket tagging
      try {
        const tagging = await this.s3.getBucketTagging({ Bucket: bucketName }).promise();
        config.configuration.tagging = tagging.TagSet;
      } catch (error) {
        config.configuration.tagging = null;
      }

      logger.info('S3 bucket configuration retrieved', {
        bucketName,
        hasEncryption: !!config.configuration.encryption,
        hasVersioning: !!config.configuration.versioning,
        hasPublicAccessBlock: !!config.configuration.publicAccessBlock
      });

      return config;

    } catch (error) {
      logger.error('Failed to get S3 bucket configuration', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get bucket tags
   */
  private async getBucketTags(bucketName: string): Promise<Record<string, string>> {
    try {
      const tagging = await this.s3.getBucketTagging({ Bucket: bucketName }).promise();
      const tags: Record<string, string> = {};
      
      for (const tag of tagging.TagSet || []) {
        if (tag.Key && tag.Value) {
          tags[tag.Key] = tag.Value;
        }
      }
      
      return tags;
    } catch (error) {
      // Bucket may not have tags
      return {};
    }
  }
}
