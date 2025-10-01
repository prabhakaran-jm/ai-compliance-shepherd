/**
 * KMS Resource Discovery Service
 * 
 * Discovers KMS keys for compliance scanning.
 */

import { KMS } from 'aws-sdk';
import {
  AWSResource,
  ResourceConfig,
  Region
} from '@compliance-shepherd/shared';
import { logger } from '../../utils/logger';

export class KMSResourceDiscovery {
  private kms: KMS;

  constructor() {
    this.kms = new KMS();
  }

  /**
   * Discover KMS resources in a specific region
   */
  async discoverRegionalResources(accountId: string, region: Region): Promise<AWSResource[]> {
    const resources: AWSResource[] = [];

    try {
      // Set region for KMS client
      this.kms = new KMS({ region });

      // List all keys
      const keys = await this.kms.listKeys().promise();

      for (const key of keys.Keys || []) {
        try {
          // Get key details
          const keyDetails = await this.kms.describeKey({ KeyId: key.KeyId! }).promise();
          const keyMetadata = keyDetails.KeyMetadata!;

          const resource: AWSResource = {
            id: keyMetadata.KeyId!,
            type: 'kms_key',
            arn: keyMetadata.Arn!,
            name: keyMetadata.KeyId!,
            accountId,
            region,
            service: 'kms',
            resourceType: 'key',
            tags: await this.getKeyTags(keyMetadata.KeyId!),
            metadata: {
              keyUsage: keyMetadata.KeyUsage,
              keyState: keyMetadata.KeyState,
              description: keyMetadata.Description,
              creationDate: keyMetadata.CreationDate?.toISOString(),
              enabled: keyMetadata.Enabled,
              keyManager: keyMetadata.KeyManager,
              keySpec: keyMetadata.KeySpec,
              origin: keyMetadata.Origin,
              validTo: keyMetadata.ValidTo?.toISOString(),
              multiRegion: keyMetadata.MultiRegion,
              multiRegionConfiguration: keyMetadata.MultiRegionConfiguration,
              pendingDeletionWindowInDays: keyMetadata.PendingDeletionWindowInDays,
              macAlgorithms: keyMetadata.MacAlgorithms,
              xksKeyConfiguration: keyMetadata.XksKeyConfiguration
            }
          };

          resources.push(resource);
        } catch (error) {
          logger.error('Failed to process KMS key', {
            keyId: key.KeyId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info('KMS resource discovery completed', {
        accountId,
        region,
        keyCount: resources.length
      });

      return resources;

    } catch (error) {
      logger.error('KMS resource discovery failed', {
        accountId,
        region,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get resource configuration for KMS key
   */
  async getResourceConfiguration(resource: AWSResource): Promise<ResourceConfig> {
    const keyId = resource.id;
    const config: ResourceConfig = {
      resourceId: resource.id,
      resourceType: resource.type,
      configuration: {}
    };

    try {
      // Get key details
      const keyDetails = await this.kms.describeKey({ KeyId: keyId }).promise();
      config.configuration.key = keyDetails.KeyMetadata;

      // Get key policy
      try {
        const keyPolicy = await this.kms.getKeyPolicy({ KeyId: keyId, PolicyName: 'default' }).promise();
        config.configuration.policy = keyPolicy.Policy;
      } catch (error) {
        config.configuration.policy = null;
      }

      // Get key rotation status
      try {
        const rotationStatus = await this.kms.getKeyRotationStatus({ KeyId: keyId }).promise();
        config.configuration.rotationStatus = rotationStatus;
      } catch (error) {
        config.configuration.rotationStatus = null;
      }

      // Get key grants
      try {
        const grants = await this.kms.listGrants({ KeyId: keyId }).promise();
        config.configuration.grants = grants.Grants;
      } catch (error) {
        config.configuration.grants = null;
      }

      // Get key aliases
      try {
        const aliases = await this.kms.listAliases({ KeyId: keyId }).promise();
        config.configuration.aliases = aliases.Aliases;
      } catch (error) {
        config.configuration.aliases = null;
      }

      logger.info('KMS key configuration retrieved', {
        keyId,
        hasPolicy: !!config.configuration.policy,
        hasRotation: !!config.configuration.rotationStatus
      });

      return config;

    } catch (error) {
      logger.error('Failed to get KMS key configuration', {
        keyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get key tags
   */
  private async getKeyTags(keyId: string): Promise<Record<string, string>> {
    try {
      const tags = await this.kms.listResourceTags({ KeyId: keyId }).promise();
      const tagMap: Record<string, string> = {};
      
      for (const tag of tags.Tags || []) {
        if (tag.TagKey && tag.TagValue) {
          tagMap[tag.TagKey] = tag.TagValue;
        }
      }
      
      return tagMap;
    } catch (error) {
      return {};
    }
  }
}
