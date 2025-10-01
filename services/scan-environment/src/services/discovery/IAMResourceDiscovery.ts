/**
 * IAM Resource Discovery Service
 * 
 * Discovers IAM users, roles, and policies for compliance scanning.
 */

import { IAM } from 'aws-sdk';
import {
  AWSResource,
  ResourceConfig,
  Region
} from '@compliance-shepherd/shared';
import { logger } from '../../utils/logger';

export class IAMResourceDiscovery {
  private iam: IAM;

  constructor() {
    this.iam = new IAM();
  }

  /**
   * Discover IAM resources globally
   */
  async discoverGlobalResources(accountId: string): Promise<AWSResource[]> {
    const resources: AWSResource[] = [];

    try {
      // Discover IAM users
      const users = await this.discoverIAMUsers(accountId);
      resources.push(...users);

      // Discover IAM roles
      const roles = await this.discoverIAMRoles(accountId);
      resources.push(...roles);

      // Discover IAM policies
      const policies = await this.discoverIAMPolicies(accountId);
      resources.push(...policies);

      logger.info('IAM resource discovery completed', {
        accountId,
        userCount: users.length,
        roleCount: roles.length,
        policyCount: policies.length
      });

      return resources;

    } catch (error) {
      logger.error('IAM resource discovery failed', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Discover IAM users
   */
  private async discoverIAMUsers(accountId: string): Promise<AWSResource[]> {
    const resources: AWSResource[] = [];

    try {
      const users = await this.iam.listUsers().promise();

      for (const user of users.Users || []) {
        const resource: AWSResource = {
          id: user.UserName!,
          type: 'iam_user',
          arn: user.Arn!,
          name: user.UserName!,
          accountId,
          region: 'us-east-1', // IAM is global
          service: 'iam',
          resourceType: 'user',
          tags: await this.getUserTags(user.UserName!),
          metadata: {
            path: user.Path,
            createDate: user.CreateDate?.toISOString(),
            passwordLastUsed: user.PasswordLastUsed?.toISOString()
          }
        };

        resources.push(resource);
      }

      return resources;

    } catch (error) {
      logger.error('Failed to discover IAM users', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Discover IAM roles
   */
  private async discoverIAMRoles(accountId: string): Promise<AWSResource[]> {
    const resources: AWSResource[] = [];

    try {
      const roles = await this.iam.listRoles().promise();

      for (const role of roles.Roles || []) {
        const resource: AWSResource = {
          id: role.RoleName!,
          type: 'iam_role',
          arn: role.Arn!,
          name: role.RoleName!,
          accountId,
          region: 'us-east-1', // IAM is global
          service: 'iam',
          resourceType: 'role',
          tags: await this.getRoleTags(role.RoleName!),
          metadata: {
            path: role.Path,
            createDate: role.CreateDate?.toISOString(),
            assumeRolePolicyDocument: role.AssumeRolePolicyDocument
          }
        };

        resources.push(resource);
      }

      return resources;

    } catch (error) {
      logger.error('Failed to discover IAM roles', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Discover IAM policies
   */
  private async discoverIAMPolicies(accountId: string): Promise<AWSResource[]> {
    const resources: AWSResource[] = [];

    try {
      // Discover customer managed policies
      const customerPolicies = await this.iam.listPolicies({ Scope: 'Local' }).promise();

      for (const policy of customerPolicies.Policies || []) {
        const resource: AWSResource = {
          id: policy.PolicyName!,
          type: 'iam_policy',
          arn: policy.Arn!,
          name: policy.PolicyName!,
          accountId,
          region: 'us-east-1', // IAM is global
          service: 'iam',
          resourceType: 'policy',
          tags: await this.getPolicyTags(policy.Arn!),
          metadata: {
            path: policy.Path,
            createDate: policy.CreateDate?.toISOString(),
            updateDate: policy.UpdateDate?.toISOString(),
            defaultVersionId: policy.DefaultVersionId,
            attachmentCount: policy.AttachmentCount
          }
        };

        resources.push(resource);
      }

      return resources;

    } catch (error) {
      logger.error('Failed to discover IAM policies', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get resource configuration for IAM resource
   */
  async getResourceConfiguration(resource: AWSResource): Promise<ResourceConfig> {
    const config: ResourceConfig = {
      resourceId: resource.id,
      resourceType: resource.type,
      configuration: {}
    };

    try {
      switch (resource.type) {
        case 'iam_user':
          config.configuration = await this.getUserConfiguration(resource.name);
          break;
        case 'iam_role':
          config.configuration = await this.getRoleConfiguration(resource.name);
          break;
        case 'iam_policy':
          config.configuration = await this.getPolicyConfiguration(resource.arn);
          break;
        default:
          throw new Error(`Unsupported IAM resource type: ${resource.type}`);
      }

      logger.info('IAM resource configuration retrieved', {
        resourceType: resource.type,
        resourceName: resource.name
      });

      return config;

    } catch (error) {
      logger.error('Failed to get IAM resource configuration', {
        resourceType: resource.type,
        resourceName: resource.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get user configuration
   */
  private async getUserConfiguration(userName: string): Promise<any> {
    const configuration: any = {};

    try {
      // Get user details
      const user = await this.iam.getUser({ UserName: userName }).promise();
      configuration.user = user.User;

      // Get user policies
      const attachedPolicies = await this.iam.listAttachedUserPolicies({ UserName: userName }).promise();
      configuration.attachedPolicies = attachedPolicies.AttachedPolicies;

      // Get inline policies
      const inlinePolicies = await this.iam.listUserPolicies({ UserName: userName }).promise();
      configuration.inlinePolicies = inlinePolicies.PolicyNames;

      // Get user groups
      const groups = await this.iam.getGroupsForUser({ UserName: userName }).promise();
      configuration.groups = groups.Groups;

      // Get access keys
      const accessKeys = await this.iam.listAccessKeys({ UserName: userName }).promise();
      configuration.accessKeys = accessKeys.AccessKeyMetadata;

      // Get MFA devices
      const mfaDevices = await this.iam.listMFADevices({ UserName: userName }).promise();
      configuration.mfaDevices = mfaDevices.MFADevices;

      // Get login profile
      try {
        const loginProfile = await this.iam.getLoginProfile({ UserName: userName }).promise();
        configuration.loginProfile = loginProfile.LoginProfile;
      } catch (error) {
        configuration.loginProfile = null;
      }

      return configuration;

    } catch (error) {
      logger.error('Failed to get user configuration', {
        userName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get role configuration
   */
  private async getRoleConfiguration(roleName: string): Promise<any> {
    const configuration: any = {};

    try {
      // Get role details
      const role = await this.iam.getRole({ RoleName: roleName }).promise();
      configuration.role = role.Role;

      // Get role policies
      const attachedPolicies = await this.iam.listAttachedRolePolicies({ RoleName: roleName }).promise();
      configuration.attachedPolicies = attachedPolicies.AttachedPolicies;

      // Get inline policies
      const inlinePolicies = await this.iam.listRolePolicies({ RoleName: roleName }).promise();
      configuration.inlinePolicies = inlinePolicies.PolicyNames;

      // Get instance profiles
      const instanceProfiles = await this.iam.listInstanceProfilesForRole({ RoleName: roleName }).promise();
      configuration.instanceProfiles = instanceProfiles.InstanceProfiles;

      return configuration;

    } catch (error) {
      logger.error('Failed to get role configuration', {
        roleName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get policy configuration
   */
  private async getPolicyConfiguration(policyArn: string): Promise<any> {
    const configuration: any = {};

    try {
      // Get policy details
      const policy = await this.iam.getPolicy({ PolicyArn: policyArn }).promise();
      configuration.policy = policy.Policy;

      // Get policy version
      const policyVersion = await this.iam.getPolicyVersion({
        PolicyArn: policyArn,
        VersionId: policy.Policy!.DefaultVersionId!
      }).promise();
      configuration.policyVersion = policyVersion.PolicyVersion;

      // Get policy entities
      const entities = await this.iam.listEntitiesForPolicy({ PolicyArn: policyArn }).promise();
      configuration.entities = entities;

      return configuration;

    } catch (error) {
      logger.error('Failed to get policy configuration', {
        policyArn,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get user tags
   */
  private async getUserTags(userName: string): Promise<Record<string, string>> {
    try {
      const tags = await this.iam.listUserTags({ UserName: userName }).promise();
      const tagMap: Record<string, string> = {};
      
      for (const tag of tags.Tags || []) {
        if (tag.Key && tag.Value) {
          tagMap[tag.Key] = tag.Value;
        }
      }
      
      return tagMap;
    } catch (error) {
      return {};
    }
  }

  /**
   * Get role tags
   */
  private async getRoleTags(roleName: string): Promise<Record<string, string>> {
    try {
      const tags = await this.iam.listRoleTags({ RoleName: roleName }).promise();
      const tagMap: Record<string, string> = {};
      
      for (const tag of tags.Tags || []) {
        if (tag.Key && tag.Value) {
          tagMap[tag.Key] = tag.Value;
        }
      }
      
      return tagMap;
    } catch (error) {
      return {};
    }
  }

  /**
   * Get policy tags
   */
  private async getPolicyTags(policyArn: string): Promise<Record<string, string>> {
    try {
      const tags = await this.iam.listPolicyTags({ PolicyArn: policyArn }).promise();
      const tagMap: Record<string, string> = {};
      
      for (const tag of tags.Tags || []) {
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
