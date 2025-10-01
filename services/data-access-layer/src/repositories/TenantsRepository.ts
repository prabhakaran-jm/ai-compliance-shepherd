/**
 * Repository for Tenants table operations
 */

import {
  Tenant,
  TenantUser,
  TenantStatus,
  PaginationParams,
  PaginatedResponse,
} from '@compliance-shepherd/shared';
import { BaseRepository, QueryOptions } from './BaseRepository';
import { TENANTS_TABLE } from '../tables/TableSchemas';

export interface TenantsRepositoryConfig {
  region?: string;
  endpoint?: string;
}

export class TenantsRepository extends BaseRepository<Tenant> {
  constructor(config: TenantsRepositoryConfig = {}) {
    super({
      tableName: TENANTS_TABLE.tableName,
      region: config.region,
      endpoint: config.endpoint,
    });
  }

  /**
   * Get tenant by name
   */
  async getTenantByName(name: string): Promise<Tenant | null> {
    const result = await this.query(
      'name = :name',
      {
        indexName: 'GSI-Name',
        expressionAttributeValues: {
          ':name': name,
        },
      }
    );

    return result.items[0] || null;
  }

  /**
   * Get tenants by status
   */
  async getTenantsByStatus(
    status: TenantStatus,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    return this.query(
      'status = :status',
      {
        indexName: 'GSI-Status',
        expressionAttributeValues: {
          ':status': status,
        },
      },
      pagination
    );
  }

  /**
   * Get active tenants
   */
  async getActiveTenants(
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    return this.getTenantsByStatus('active', pagination);
  }

  /**
   * Get trial tenants
   */
  async getTrialTenants(
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    return this.getTenantsByStatus('trial', pagination);
  }

  /**
   * Get suspended tenants
   */
  async getSuspendedTenants(
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    return this.getTenantsByStatus('suspended', pagination);
  }

  /**
   * Update tenant status
   */
  async updateTenantStatus(
    tenantId: string,
    status: TenantStatus
  ): Promise<Tenant> {
    return this.update(tenantId, tenantId, { status });
  }

  /**
   * Update tenant usage
   */
  async updateTenantUsage(
    tenantId: string,
    usage: Partial<Tenant['usage']>
  ): Promise<Tenant> {
    return this.update(tenantId, tenantId, { usage });
  }

  /**
   * Update tenant settings
   */
  async updateTenantSettings(
    tenantId: string,
    settings: Partial<Tenant['settings']>
  ): Promise<Tenant> {
    return this.update(tenantId, tenantId, { settings });
  }

  /**
   * Update tenant integrations
   */
  async updateTenantIntegrations(
    tenantId: string,
    integrations: Partial<Tenant['integrations']>
  ): Promise<Tenant> {
    return this.update(tenantId, tenantId, { integrations });
  }

  /**
   * Update tenant plan
   */
  async updateTenantPlan(
    tenantId: string,
    plan: Tenant['plan']
  ): Promise<Tenant> {
    return this.update(tenantId, tenantId, { plan });
  }

  /**
   * Update tenant entitlements
   */
  async updateTenantEntitlements(
    tenantId: string,
    entitlements: Partial<Tenant['entitlements']>
  ): Promise<Tenant> {
    return this.update(tenantId, tenantId, { entitlements });
  }

  /**
   * Get tenant statistics
   */
  async getTenantStatistics(): Promise<{
    total: number;
    byStatus: Record<TenantStatus, number>;
    byPlan: Record<string, number>;
  }> {
    const [total, byStatus, byPlan] = await Promise.all([
      this.count(),
      this.getCountsByAttribute('status'),
      this.getCountsByAttribute('plan.id'),
    ]);

    return {
      total,
      byStatus: byStatus as Record<TenantStatus, number>,
      byPlan,
    };
  }

  /**
   * Get tenants created within date range
   */
  async getTenantsByDateRange(
    startDate: string,
    endDate: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    const options: QueryOptions = {
      filterExpression: 'createdAt BETWEEN :startDate AND :endDate',
      expressionAttributeValues: {
        ':startDate': startDate,
        ':endDate': endDate,
      },
    };

    return this.scan(options, pagination);
  }

  /**
   * Get tenants by plan
   */
  async getTenantsByPlan(
    planId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    const options: QueryOptions = {
      filterExpression: 'plan.id = :planId',
      expressionAttributeValues: {
        ':planId': planId,
      },
    };

    return this.scan(options, pagination);
  }

  /**
   * Get tenants with specific entitlement
   */
  async getTenantsWithEntitlement(
    entitlement: keyof Tenant['entitlements'],
    enabled: boolean = true,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    const options: QueryOptions = {
      filterExpression: `entitlements.${entitlement} = :enabled`,
      expressionAttributeValues: {
        ':enabled': enabled,
      },
    };

    return this.scan(options, pagination);
  }

  /**
   * Get tenants with auto-remediation enabled
   */
  async getTenantsWithAutoRemediation(
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    return this.getTenantsWithEntitlement('autoRemediation', true, pagination);
  }

  /**
   * Get tenants with Slack integration
   */
  async getTenantsWithSlackIntegration(
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    return this.getTenantsWithEntitlement('slackIntegration', true, pagination);
  }

  /**
   * Get tenants with GitHub integration
   */
  async getTenantsWithGitHubIntegration(
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    return this.getTenantsWithEntitlement('githubIntegration', true, pagination);
  }

  /**
   * Get tenants with Jira integration
   */
  async getTenantsWithJiraIntegration(
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    return this.getTenantsWithEntitlement('jiraIntegration', true, pagination);
  }

  /**
   * Get tenants with API access
   */
  async getTenantsWithApiAccess(
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    return this.getTenantsWithEntitlement('apiAccess', true, pagination);
  }

  /**
   * Get tenants with SSO enabled
   */
  async getTenantsWithSSO(
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    return this.getTenantsWithEntitlement('ssoEnabled', true, pagination);
  }

  /**
   * Get tenants with advanced reporting
   */
  async getTenantsWithAdvancedReporting(
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    return this.getTenantsWithEntitlement('advancedReporting', true, pagination);
  }

  /**
   * Get tenants with priority support
   */
  async getTenantsWithPrioritySupport(
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    return this.getTenantsWithEntitlement('prioritySupport', true, pagination);
  }

  /**
   * Get tenants by framework
   */
  async getTenantsByFramework(
    framework: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    const options: QueryOptions = {
      filterExpression: 'contains(settings.frameworks, :framework)',
      expressionAttributeValues: {
        ':framework': framework,
      },
    };

    return this.scan(options, pagination);
  }

  /**
   * Get tenants by region
   */
  async getTenantsByRegion(
    region: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    const options: QueryOptions = {
      filterExpression: 'contains(settings.regions, :region)',
      expressionAttributeValues: {
        ':region': region,
      },
    };

    return this.scan(options, pagination);
  }

  /**
   * Get tenants by service
   */
  async getTenantsByService(
    service: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    const options: QueryOptions = {
      filterExpression: 'contains(settings.enabledServices, :service)',
      expressionAttributeValues: {
        ':service': service,
      },
    };

    return this.scan(options, pagination);
  }

  /**
   * Get tenants with specific scan schedule
   */
  async getTenantsWithScanSchedule(
    enabled: boolean = true,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    const options: QueryOptions = {
      filterExpression: 'settings.scanSchedule.enabled = :enabled',
      expressionAttributeValues: {
        ':enabled': enabled,
      },
    };

    return this.scan(options, pagination);
  }

  /**
   * Get tenants with auto-remediation settings
   */
  async getTenantsWithAutoRemediationSettings(
    enabled: boolean = true,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    const options: QueryOptions = {
      filterExpression: 'settings.autoRemediation.enabled = :enabled',
      expressionAttributeValues: {
        ':enabled': enabled,
      },
    };

    return this.scan(options, pagination);
  }

  /**
   * Get tenants with notification settings
   */
  async getTenantsWithNotificationSettings(
    notificationType: 'email' | 'slack' | 'webhook',
    enabled: boolean = true,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    const options: QueryOptions = {
      filterExpression: `settings.notifications.${notificationType}.enabled = :enabled`,
      expressionAttributeValues: {
        ':enabled': enabled,
      },
    };

    return this.scan(options, pagination);
  }

  /**
   * Get tenants with encryption settings
   */
  async getTenantsWithEncryption(
    encryptionType: 'encryptionAtRest' | 'encryptionInTransit' | 'keyRotation',
    enabled: boolean = true,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    const options: QueryOptions = {
      filterExpression: `settings.encryption.${encryptionType} = :enabled`,
      expressionAttributeValues: {
        ':enabled': enabled,
      },
    };

    return this.scan(options, pagination);
  }

  /**
   * Get tenants with access control settings
   */
  async getTenantsWithAccessControl(
    setting: 'ssoEnabled' | 'mfaRequired',
    enabled: boolean = true,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    const options: QueryOptions = {
      filterExpression: `settings.accessControl.${setting} = :enabled`,
      expressionAttributeValues: {
        ':enabled': enabled,
      },
    };

    return this.scan(options, pagination);
  }

  /**
   * Get tenants with custom rules
   */
  async getTenantsWithCustomRules(
    enabled: boolean = true,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Tenant>> {
    const options: QueryOptions = {
      filterExpression: 'settings.customRules.enabled = :enabled',
      expressionAttributeValues: {
        ':enabled': enabled,
      },
    };

    return this.scan(options, pagination);
  }

  /**
   * Get counts by attribute
   */
  private async getCountsByAttribute(attribute: string): Promise<Record<string, number>> {
    const result = await this.scan();

    const counts: Record<string, number> = {};
    
    for (const item of result.items) {
      const value = this.getNestedValue(item, attribute);
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
      }
    }

    return counts;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}
