/**
 * AWS Resource Discovery Service
 * 
 * Discovers AWS resources across multiple services and regions
 * for compliance scanning.
 */

import {
  ResourceConfig,
  Region,
  AWSResource,
  ResourceType,
  ScanJob
} from '@compliance-shepherd/shared';
import { logger } from '../utils/logger';
import { S3ResourceDiscovery } from './discovery/S3ResourceDiscovery';
import { IAMResourceDiscovery } from './discovery/IAMResourceDiscovery';
import { EC2ResourceDiscovery } from './discovery/EC2ResourceDiscovery';
import { CloudTrailResourceDiscovery } from './discovery/CloudTrailResourceDiscovery';
import { KMSResourceDiscovery } from './discovery/KMSResourceDiscovery';
import { RDSResourceDiscovery } from './discovery/RDSResourceDiscovery';
import { LambdaResourceDiscovery } from './discovery/LambdaResourceDiscovery';

export class AWSResourceDiscovery {
  private s3Discovery: S3ResourceDiscovery;
  private iamDiscovery: IAMResourceDiscovery;
  private ec2Discovery: EC2ResourceDiscovery;
  private cloudTrailDiscovery: CloudTrailResourceDiscovery;
  private kmsDiscovery: KMSResourceDiscovery;
  private rdsDiscovery: RDSResourceDiscovery;
  private lambdaDiscovery: LambdaResourceDiscovery;

  constructor() {
    this.s3Discovery = new S3ResourceDiscovery();
    this.iamDiscovery = new IAMResourceDiscovery();
    this.ec2Discovery = new EC2ResourceDiscovery();
    this.cloudTrailDiscovery = new CloudTrailResourceDiscovery();
    this.kmsDiscovery = new KMSResourceDiscovery();
    this.rdsDiscovery = new RDSResourceDiscovery();
    this.lambdaDiscovery = new LambdaResourceDiscovery();
  }

  /**
   * Discover AWS resources based on scan job configuration
   */
  async discoverResources(scanJob: ScanJob): Promise<AWSResource[]> {
    const { accountId, regions, services } = scanJob;
    const allResources: AWSResource[] = [];

    logger.info('Starting AWS resource discovery', {
      scanId: scanJob.id,
      accountId,
      regions: regions.length,
      services: services.length
    });

    try {
      // Discover global resources (IAM, etc.)
      if (services.length === 0 || services.includes('iam')) {
        const iamResources = await this.iamDiscovery.discoverGlobalResources(accountId);
        allResources.push(...iamResources);
      }

      // Discover regional resources
      for (const region of regions) {
        logger.info('Discovering resources in region', {
          scanId: scanJob.id,
          region
        });

        const regionalResources = await this.discoverRegionalResources(accountId, region, services);
        allResources.push(...regionalResources);
      }

      logger.info('AWS resource discovery completed', {
        scanId: scanJob.id,
        totalResources: allResources.length,
        regions: regions.length,
        services: services.length
      });

      return allResources;

    } catch (error) {
      logger.error('AWS resource discovery failed', {
        scanId: scanJob.id,
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Discover resources in a specific region
   */
  private async discoverRegionalResources(
    accountId: string,
    region: Region,
    services: string[]
  ): Promise<AWSResource[]> {
    const resources: AWSResource[] = [];

    // If no specific services requested, discover all supported services
    const servicesToScan = services.length === 0 ? [
      's3', 'ec2', 'cloudtrail', 'kms', 'rds', 'lambda'
    ] : services;

    // Discover S3 resources
    if (servicesToScan.includes('s3')) {
      try {
        const s3Resources = await this.s3Discovery.discoverRegionalResources(accountId, region);
        resources.push(...s3Resources);
      } catch (error) {
        logger.error('S3 resource discovery failed', {
          accountId,
          region,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Discover EC2 resources
    if (servicesToScan.includes('ec2')) {
      try {
        const ec2Resources = await this.ec2Discovery.discoverRegionalResources(accountId, region);
        resources.push(...ec2Resources);
      } catch (error) {
        logger.error('EC2 resource discovery failed', {
          accountId,
          region,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Discover CloudTrail resources
    if (servicesToScan.includes('cloudtrail')) {
      try {
        const cloudTrailResources = await this.cloudTrailDiscovery.discoverRegionalResources(accountId, region);
        resources.push(...cloudTrailResources);
      } catch (error) {
        logger.error('CloudTrail resource discovery failed', {
          accountId,
          region,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Discover KMS resources
    if (servicesToScan.includes('kms')) {
      try {
        const kmsResources = await this.kmsDiscovery.discoverRegionalResources(accountId, region);
        resources.push(...kmsResources);
      } catch (error) {
        logger.error('KMS resource discovery failed', {
          accountId,
          region,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Discover RDS resources
    if (servicesToScan.includes('rds')) {
      try {
        const rdsResources = await this.rdsDiscovery.discoverRegionalResources(accountId, region);
        resources.push(...rdsResources);
      } catch (error) {
        logger.error('RDS resource discovery failed', {
          accountId,
          region,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Discover Lambda resources
    if (servicesToScan.includes('lambda')) {
      try {
        const lambdaResources = await this.lambdaDiscovery.discoverRegionalResources(accountId, region);
        resources.push(...lambdaResources);
      } catch (error) {
        logger.error('Lambda resource discovery failed', {
          accountId,
          region,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return resources;
  }

  /**
   * Get resource configuration for a specific resource
   */
  async getResourceConfiguration(resource: AWSResource): Promise<ResourceConfig> {
    switch (resource.type) {
      case 's3_bucket':
        return this.s3Discovery.getResourceConfiguration(resource);
      case 'iam_role':
      case 'iam_user':
      case 'iam_policy':
        return this.iamDiscovery.getResourceConfiguration(resource);
      case 'ec2_instance':
      case 'security_group':
        return this.ec2Discovery.getResourceConfiguration(resource);
      case 'cloudtrail_trail':
        return this.cloudTrailDiscovery.getResourceConfiguration(resource);
      case 'kms_key':
        return this.kmsDiscovery.getResourceConfiguration(resource);
      case 'rds_instance':
        return this.rdsDiscovery.getResourceConfiguration(resource);
      case 'lambda_function':
        return this.lambdaDiscovery.getResourceConfiguration(resource);
      default:
        throw new Error(`Unsupported resource type: ${resource.type}`);
    }
  }

  /**
   * Get supported resource types
   */
  getSupportedResourceTypes(): ResourceType[] {
    return [
      's3_bucket',
      'iam_role',
      'iam_user',
      'iam_policy',
      'ec2_instance',
      'security_group',
      'cloudtrail_trail',
      'kms_key',
      'rds_instance',
      'lambda_function'
    ];
  }

  /**
   * Get supported services
   */
  getSupportedServices(): string[] {
    return [
      's3',
      'iam',
      'ec2',
      'cloudtrail',
      'kms',
      'rds',
      'lambda'
    ];
  }

  /**
   * Get supported regions
   */
  getSupportedRegions(): Region[] {
    return [
      'us-east-1',
      'us-east-2',
      'us-west-1',
      'us-west-2',
      'eu-west-1',
      'eu-west-2',
      'eu-west-3',
      'eu-central-1',
      'ap-southeast-1',
      'ap-southeast-2',
      'ap-northeast-1',
      'ap-northeast-2',
      'ca-central-1',
      'sa-east-1'
    ];
  }
}
