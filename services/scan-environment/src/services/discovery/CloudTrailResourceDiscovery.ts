/**
 * CloudTrail Resource Discovery Service
 * 
 * Discovers CloudTrail trails for compliance scanning.
 */

import { CloudTrail } from 'aws-sdk';
import {
  AWSResource,
  ResourceConfig,
  Region
} from '@compliance-shepherd/shared';
import { logger } from '../../utils/logger';

export class CloudTrailResourceDiscovery {
  private cloudTrail: CloudTrail;

  constructor() {
    this.cloudTrail = new CloudTrail();
  }

  /**
   * Discover CloudTrail resources in a specific region
   */
  async discoverRegionalResources(accountId: string, region: Region): Promise<AWSResource[]> {
    const resources: AWSResource[] = [];

    try {
      // Set region for CloudTrail client
      this.cloudTrail = new CloudTrail({ region });

      // List all trails
      const trails = await this.cloudTrail.describeTrails().promise();

      for (const trail of trails.trailList || []) {
        // Only process trails in the requested region
        if (trail.HomeRegion === region) {
          const resource: AWSResource = {
            id: trail.Name!,
            type: 'cloudtrail_trail',
            arn: trail.TrailARN!,
            name: trail.Name!,
            accountId,
            region,
            service: 'cloudtrail',
            resourceType: 'trail',
            tags: await this.getTrailTags(trail.TrailARN!),
            metadata: {
              s3BucketName: trail.S3BucketName,
              s3KeyPrefix: trail.S3KeyPrefix,
              includeGlobalServiceEvents: trail.IncludeGlobalServiceEvents,
              isMultiRegionTrail: trail.IsMultiRegionTrail,
              logFileValidationEnabled: trail.LogFileValidationEnabled,
              cloudWatchLogsLogGroupArn: trail.CloudWatchLogsLogGroupArn,
              cloudWatchLogsRoleArn: trail.CloudWatchLogsRoleArn,
              kmsKeyId: trail.KmsKeyId,
              hasCustomEventSelectors: trail.HasCustomEventSelectors,
              hasInsightSelectors: trail.HasInsightSelectors,
              isOrganizationTrail: trail.IsOrganizationTrail
            }
          };

          resources.push(resource);
        }
      }

      logger.info('CloudTrail resource discovery completed', {
        accountId,
        region,
        trailCount: resources.length
      });

      return resources;

    } catch (error) {
      logger.error('CloudTrail resource discovery failed', {
        accountId,
        region,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get resource configuration for CloudTrail trail
   */
  async getResourceConfiguration(resource: AWSResource): Promise<ResourceConfig> {
    const trailName = resource.name;
    const config: ResourceConfig = {
      resourceId: resource.id,
      resourceType: resource.type,
      configuration: {}
    };

    try {
      // Get trail details
      const trail = await this.cloudTrail.getTrail({ Name: trailName }).promise();
      config.configuration.trail = trail;

      // Get trail status
      const status = await this.cloudTrail.getTrailStatus({ Name: trailName }).promise();
      config.configuration.status = status;

      // Get event selectors
      try {
        const eventSelectors = await this.cloudTrail.getEventSelectors({ TrailName: trailName }).promise();
        config.configuration.eventSelectors = eventSelectors;
      } catch (error) {
        config.configuration.eventSelectors = null;
      }

      // Get insight selectors
      try {
        const insightSelectors = await this.cloudTrail.getInsightSelectors({ TrailName: trailName }).promise();
        config.configuration.insightSelectors = insightSelectors;
      } catch (error) {
        config.configuration.insightSelectors = null;
      }

      // Get trail tags
      try {
        const tags = await this.cloudTrail.listTags({ ResourceIdList: [trailName] }).promise();
        config.configuration.tags = tags;
      } catch (error) {
        config.configuration.tags = null;
      }

      logger.info('CloudTrail trail configuration retrieved', {
        trailName,
        hasEventSelectors: !!config.configuration.eventSelectors,
        hasInsightSelectors: !!config.configuration.insightSelectors
      });

      return config;

    } catch (error) {
      logger.error('Failed to get CloudTrail trail configuration', {
        trailName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get trail tags
   */
  private async getTrailTags(trailArn: string): Promise<Record<string, string>> {
    try {
      const tags = await this.cloudTrail.listTags({ ResourceIdList: [trailArn] }).promise();
      const tagMap: Record<string, string> = {};
      
      for (const resourceTag of tags.ResourceTagList || []) {
        for (const tag of resourceTag.TagsList || []) {
          if (tag.Key && tag.Value) {
            tagMap[tag.Key] = tag.Value;
          }
        }
      }
      
      return tagMap;
    } catch (error) {
      return {};
    }
  }
}
