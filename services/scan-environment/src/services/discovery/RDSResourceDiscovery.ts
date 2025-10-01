/**
 * RDS Resource Discovery Service
 * 
 * Discovers RDS instances for compliance scanning.
 */

import { RDS } from 'aws-sdk';
import {
  AWSResource,
  ResourceConfig,
  Region
} from '@compliance-shepherd/shared';
import { logger } from '../../utils/logger';

export class RDSResourceDiscovery {
  private rds: RDS;

  constructor() {
    this.rds = new RDS();
  }

  /**
   * Discover RDS resources in a specific region
   */
  async discoverRegionalResources(accountId: string, region: Region): Promise<AWSResource[]> {
    const resources: AWSResource[] = [];

    try {
      // Set region for RDS client
      this.rds = new RDS({ region });

      // List all DB instances
      const dbInstances = await this.rds.describeDBInstances().promise();

      for (const dbInstance of dbInstances.DBInstances || []) {
        const resource: AWSResource = {
          id: dbInstance.DBInstanceIdentifier!,
          type: 'rds_instance',
          arn: dbInstance.DBInstanceArn!,
          name: dbInstance.DBInstanceIdentifier!,
          accountId,
          region,
          service: 'rds',
          resourceType: 'instance',
          tags: await this.getDBInstanceTags(dbInstance.DBInstanceArn!),
          metadata: {
            engine: dbInstance.Engine,
            engineVersion: dbInstance.EngineVersion,
            dbInstanceClass: dbInstance.DBInstanceClass,
            dbInstanceStatus: dbInstance.DBInstanceStatus,
            masterUsername: dbInstance.MasterUsername,
            allocatedStorage: dbInstance.AllocatedStorage,
            storageType: dbInstance.StorageType,
            storageEncrypted: dbInstance.StorageEncrypted,
            kmsKeyId: dbInstance.KmsKeyId,
            dbInstancePort: dbInstance.DbInstancePort,
            vpcId: dbInstance.DBSubnetGroup?.VpcId,
            availabilityZone: dbInstance.AvailabilityZone,
            multiAZ: dbInstance.MultiAZ,
            publiclyAccessible: dbInstance.PubliclyAccessible,
            backupRetentionPeriod: dbInstance.BackupRetentionPeriod,
            preferredBackupWindow: dbInstance.PreferredBackupWindow,
            preferredMaintenanceWindow: dbInstance.PreferredMaintenanceWindow,
            autoMinorVersionUpgrade: dbInstance.AutoMinorVersionUpgrade,
            deletionProtection: dbInstance.DeletionProtection,
            performanceInsightsEnabled: dbInstance.PerformanceInsightsEnabled,
            performanceInsightsKMSKeyId: dbInstance.PerformanceInsightsKMSKeyId,
            performanceInsightsRetentionPeriod: dbInstance.PerformanceInsightsRetentionPeriod,
            monitoringInterval: dbInstance.MonitoringInterval,
            monitoringRoleArn: dbInstance.MonitoringRoleArn,
            enhancedMonitoringResourceArn: dbInstance.EnhancedMonitoringResourceArn,
            iamDatabaseAuthenticationEnabled: dbInstance.IAMDatabaseAuthenticationEnabled,
            processorFeatures: dbInstance.ProcessorFeatures,
            enabledCloudwatchLogsExports: dbInstance.EnabledCloudwatchLogsExports,
            pendingCloudwatchLogsExports: dbInstance.PendingCloudwatchLogsExports,
            copyTagsToSnapshot: dbInstance.CopyTagsToSnapshot,
            monitoringInterval: dbInstance.MonitoringInterval,
            monitoringRoleArn: dbInstance.MonitoringRoleArn,
            promotionTier: dbInstance.PromotionTier,
            timezone: dbInstance.Timezone,
            iops: dbInstance.Iops,
            storageThroughput: dbInstance.StorageThroughput,
            caCertificateIdentifier: dbInstance.CACertificateIdentifier,
            dbSystemId: dbInstance.DBSystemId,
            dedicatedLogVolume: dbInstance.DedicatedLogVolume,
            multiTenant: dbInstance.MultiTenant,
            engineLifecycleSupport: dbInstance.EngineLifecycleSupport
          }
        };

        resources.push(resource);
      }

      logger.info('RDS resource discovery completed', {
        accountId,
        region,
        instanceCount: resources.length
      });

      return resources;

    } catch (error) {
      logger.error('RDS resource discovery failed', {
        accountId,
        region,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get resource configuration for RDS instance
   */
  async getResourceConfiguration(resource: AWSResource): Promise<ResourceConfig> {
    const dbInstanceIdentifier = resource.id;
    const config: ResourceConfig = {
      resourceId: resource.id,
      resourceType: resource.type,
      configuration: {}
    };

    try {
      // Get DB instance details
      const dbInstances = await this.rds.describeDBInstances({ DBInstanceIdentifier: dbInstanceIdentifier }).promise();
      const dbInstance = dbInstances.DBInstances?.[0];
      
      if (dbInstance) {
        config.configuration.dbInstance = dbInstance;

        // Get DB parameter groups
        try {
          const parameterGroups = await this.rds.describeDBParameterGroups({
            DBParameterGroupName: dbInstance.DBParameterGroups?.[0]?.DBParameterGroupName
          }).promise();
          config.configuration.parameterGroups = parameterGroups.DBParameterGroups;
        } catch (error) {
          config.configuration.parameterGroups = null;
        }

        // Get DB security groups
        try {
          const securityGroups = await this.rds.describeDBSecurityGroups({
            DBSecurityGroupName: dbInstance.DBSecurityGroups?.[0]?.DBSecurityGroupName
          }).promise();
          config.configuration.securityGroups = securityGroups.DBSecurityGroups;
        } catch (error) {
          config.configuration.securityGroups = null;
        }

        // Get DB subnet group
        try {
          const subnetGroups = await this.rds.describeDBSubnetGroups({
            DBSubnetGroupName: dbInstance.DBSubnetGroup?.DBSubnetGroupName
          }).promise();
          config.configuration.subnetGroup = subnetGroups.DBSubnetGroups?.[0];
        } catch (error) {
          config.configuration.subnetGroup = null;
        }

        // Get DB option groups
        try {
          const optionGroups = await this.rds.describeOptionGroups({
            OptionGroupName: dbInstance.OptionGroupMemberships?.[0]?.OptionGroupName
          }).promise();
          config.configuration.optionGroups = optionGroups.OptionGroupsList;
        } catch (error) {
          config.configuration.optionGroups = null;
        }

        // Get DB snapshots
        try {
          const snapshots = await this.rds.describeDBSnapshots({
            DBInstanceIdentifier: dbInstanceIdentifier
          }).promise();
          config.configuration.snapshots = snapshots.DBSnapshots;
        } catch (error) {
          config.configuration.snapshots = null;
        }

        // Get DB log files
        try {
          const logFiles = await this.rds.describeDBLogFiles({
            DBInstanceIdentifier: dbInstanceIdentifier
          }).promise();
          config.configuration.logFiles = logFiles.DescribeDBLogFiles;
        } catch (error) {
          config.configuration.logFiles = null;
        }
      }

      logger.info('RDS instance configuration retrieved', {
        dbInstanceIdentifier,
        hasParameterGroups: !!config.configuration.parameterGroups,
        hasSecurityGroups: !!config.configuration.securityGroups
      });

      return config;

    } catch (error) {
      logger.error('Failed to get RDS instance configuration', {
        dbInstanceIdentifier,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get DB instance tags
   */
  private async getDBInstanceTags(dbInstanceArn: string): Promise<Record<string, string>> {
    try {
      const tags = await this.rds.listTagsForResource({ ResourceName: dbInstanceArn }).promise();
      const tagMap: Record<string, string> = {};
      
      for (const tag of tags.TagList || []) {
        if (tag.Key && tag.Value) {
          tagMap[tag.Key] = tag.Value;
        }
      }
      
      return tagMap;
    } catch (error) {
      return {};
    }
  }
}
