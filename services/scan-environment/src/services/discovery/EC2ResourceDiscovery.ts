/**
 * EC2 Resource Discovery Service
 * 
 * Discovers EC2 instances and security groups for compliance scanning.
 */

import { EC2 } from 'aws-sdk';
import {
  AWSResource,
  ResourceConfig,
  Region
} from '@compliance-shepherd/shared';
import { logger } from '../../utils/logger';

export class EC2ResourceDiscovery {
  private ec2: EC2;

  constructor() {
    this.ec2 = new EC2();
  }

  /**
   * Discover EC2 resources in a specific region
   */
  async discoverRegionalResources(accountId: string, region: Region): Promise<AWSResource[]> {
    const resources: AWSResource[] = [];

    try {
      // Set region for EC2 client
      this.ec2 = new EC2({ region });

      // Discover EC2 instances
      const instances = await this.discoverEC2Instances(accountId, region);
      resources.push(...instances);

      // Discover security groups
      const securityGroups = await this.discoverSecurityGroups(accountId, region);
      resources.push(...securityGroups);

      logger.info('EC2 resource discovery completed', {
        accountId,
        region,
        instanceCount: instances.length,
        securityGroupCount: securityGroups.length
      });

      return resources;

    } catch (error) {
      logger.error('EC2 resource discovery failed', {
        accountId,
        region,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Discover EC2 instances
   */
  private async discoverEC2Instances(accountId: string, region: Region): Promise<AWSResource[]> {
    const resources: AWSResource[] = [];

    try {
      const instances = await this.ec2.describeInstances().promise();

      for (const reservation of instances.Reservations || []) {
        for (const instance of reservation.Instances || []) {
          const resource: AWSResource = {
            id: instance.InstanceId!,
            type: 'ec2_instance',
            arn: `arn:aws:ec2:${region}:${accountId}:instance/${instance.InstanceId}`,
            name: instance.InstanceId!,
            accountId,
            region,
            service: 'ec2',
            resourceType: 'instance',
            tags: this.extractTags(instance.Tags),
            metadata: {
              instanceType: instance.InstanceType,
              state: instance.State?.Name,
              launchTime: instance.LaunchTime?.toISOString(),
              vpcId: instance.VpcId,
              subnetId: instance.SubnetId,
              securityGroups: instance.SecurityGroups,
              keyName: instance.KeyName,
              imageId: instance.ImageId,
              platform: instance.Platform
            }
          };

          resources.push(resource);
        }
      }

      return resources;

    } catch (error) {
      logger.error('Failed to discover EC2 instances', {
        accountId,
        region,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Discover security groups
   */
  private async discoverSecurityGroups(accountId: string, region: Region): Promise<AWSResource[]> {
    const resources: AWSResource[] = [];

    try {
      const securityGroups = await this.ec2.describeSecurityGroups().promise();

      for (const sg of securityGroups.SecurityGroups || []) {
        const resource: AWSResource = {
          id: sg.GroupId!,
          type: 'security_group',
          arn: `arn:aws:ec2:${region}:${accountId}:security-group/${sg.GroupId}`,
          name: sg.GroupName!,
          accountId,
          region,
          service: 'ec2',
          resourceType: 'security-group',
          tags: this.extractTags(sg.Tags),
          metadata: {
            description: sg.Description,
            vpcId: sg.VpcId,
            ownerId: sg.OwnerId
          }
        };

        resources.push(resource);
      }

      return resources;

    } catch (error) {
      logger.error('Failed to discover security groups', {
        accountId,
        region,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get resource configuration for EC2 resource
   */
  async getResourceConfiguration(resource: AWSResource): Promise<ResourceConfig> {
    const config: ResourceConfig = {
      resourceId: resource.id,
      resourceType: resource.type,
      configuration: {}
    };

    try {
      switch (resource.type) {
        case 'ec2_instance':
          config.configuration = await this.getInstanceConfiguration(resource.id, resource.region);
          break;
        case 'security_group':
          config.configuration = await this.getSecurityGroupConfiguration(resource.id, resource.region);
          break;
        default:
          throw new Error(`Unsupported EC2 resource type: ${resource.type}`);
      }

      logger.info('EC2 resource configuration retrieved', {
        resourceType: resource.type,
        resourceId: resource.id
      });

      return config;

    } catch (error) {
      logger.error('Failed to get EC2 resource configuration', {
        resourceType: resource.type,
        resourceId: resource.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get instance configuration
   */
  private async getInstanceConfiguration(instanceId: string, region: Region): Promise<any> {
    const configuration: any = {};

    try {
      // Set region for EC2 client
      this.ec2 = new EC2({ region });

      // Get instance details
      const instances = await this.ec2.describeInstances({ InstanceIds: [instanceId] }).promise();
      const instance = instances.Reservations?.[0]?.Instances?.[0];
      
      if (instance) {
        configuration.instance = {
          instanceId: instance.InstanceId,
          instanceType: instance.InstanceType,
          state: instance.State,
          launchTime: instance.LaunchTime,
          vpcId: instance.VpcId,
          subnetId: instance.SubnetId,
          securityGroups: instance.SecurityGroups,
          keyName: instance.KeyName,
          imageId: instance.ImageId,
          platform: instance.Platform,
          architecture: instance.Architecture,
          hypervisor: instance.Hypervisor,
          virtualizationType: instance.VirtualizationType,
          monitoring: instance.Monitoring,
          placement: instance.Placement,
          networkInterfaces: instance.NetworkInterfaces,
          blockDeviceMappings: instance.BlockDeviceMappings,
          ebsOptimized: instance.EbsOptimized,
          sourceDestCheck: instance.SourceDestCheck,
          iamInstanceProfile: instance.IamInstanceProfile,
          tags: instance.Tags
        };

        // Get instance attributes
        try {
          const attributes = await this.ec2.describeInstanceAttribute({
            InstanceId: instanceId,
            Attribute: 'userData'
          }).promise();
          configuration.userData = attributes.UserData?.Value;
        } catch (error) {
          configuration.userData = null;
        }

        // Get instance status
        try {
          const status = await this.ec2.describeInstanceStatus({ InstanceIds: [instanceId] }).promise();
          configuration.status = status.InstanceStatuses?.[0];
        } catch (error) {
          configuration.status = null;
        }
      }

      return configuration;

    } catch (error) {
      logger.error('Failed to get instance configuration', {
        instanceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get security group configuration
   */
  private async getSecurityGroupConfiguration(groupId: string, region: Region): Promise<any> {
    const configuration: any = {};

    try {
      // Set region for EC2 client
      this.ec2 = new EC2({ region });

      // Get security group details
      const securityGroups = await this.ec2.describeSecurityGroups({ GroupIds: [groupId] }).promise();
      const sg = securityGroups.SecurityGroups?.[0];
      
      if (sg) {
        configuration.securityGroup = {
          groupId: sg.GroupId,
          groupName: sg.GroupName,
          description: sg.Description,
          vpcId: sg.VpcId,
          ownerId: sg.OwnerId,
          ipPermissions: sg.IpPermissions,
          ipPermissionsEgress: sg.IpPermissionsEgress,
          tags: sg.Tags
        };
      }

      return configuration;

    } catch (error) {
      logger.error('Failed to get security group configuration', {
        groupId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Extract tags from AWS resource
   */
  private extractTags(tags?: Array<{ Key?: string; Value?: string }>): Record<string, string> {
    const tagMap: Record<string, string> = {};
    
    if (tags) {
      for (const tag of tags) {
        if (tag.Key && tag.Value) {
          tagMap[tag.Key] = tag.Value;
        }
      }
    }
    
    return tagMap;
  }
}
