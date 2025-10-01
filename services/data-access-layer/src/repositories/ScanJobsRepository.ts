/**
 * Repository for Scan Jobs table operations
 */

import {
  ScanJob,
  ScanStatus,
  ScanType,
  PaginationParams,
  PaginatedResponse,
} from '@compliance-shepherd/shared';
import { BaseRepository, QueryOptions } from './BaseRepository';
import { SCAN_JOBS_TABLE } from '../tables/TableSchemas';

export interface ScanJobsRepositoryConfig {
  region?: string;
  endpoint?: string;
}

export class ScanJobsRepository extends BaseRepository<ScanJob> {
  constructor(config: ScanJobsRepositoryConfig = {}) {
    super({
      tableName: SCAN_JOBS_TABLE.tableName,
      region: config.region,
      endpoint: config.endpoint,
    });
  }

  /**
   * Get scan jobs by status
   */
  async getScanJobsByStatus(
    status: ScanStatus,
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<ScanJob>> {
    const options: QueryOptions = {
      indexName: 'GSI-Status',
      expressionAttributeValues: {
        ':status': status,
      },
    };

    if (tenantId) {
      options.filterExpression = 'tenantId = :tenantId';
      options.expressionAttributeValues![':tenantId'] = tenantId;
    }

    return this.query(
      'status = :status',
      options,
      pagination
    );
  }

  /**
   * Get scan jobs by account ID
   */
  async getScanJobsByAccount(
    accountId: string,
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<ScanJob>> {
    const options: QueryOptions = {
      indexName: 'GSI-AccountId',
      expressionAttributeValues: {
        ':accountId': accountId,
      },
    };

    if (tenantId) {
      options.filterExpression = 'tenantId = :tenantId';
      options.expressionAttributeValues![':tenantId'] = tenantId;
    }

    return this.query(
      'accountId = :accountId',
      options,
      pagination
    );
  }

  /**
   * Get scan jobs by type
   */
  async getScanJobsByType(
    scanType: ScanType,
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<ScanJob>> {
    const options: QueryOptions = {
      indexName: 'GSI-ScanType',
      expressionAttributeValues: {
        ':scanType': scanType,
      },
    };

    if (tenantId) {
      options.filterExpression = 'tenantId = :tenantId';
      options.expressionAttributeValues![':tenantId'] = tenantId;
    }

    return this.query(
      'scanType = :scanType',
      options,
      pagination
    );
  }

  /**
   * Get scan jobs by tenant
   */
  async getScanJobsByTenant(
    tenantId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<ScanJob>> {
    return this.query(
      'tenantId = :tenantId',
      {
        expressionAttributeValues: {
          ':tenantId': tenantId,
        },
      },
      pagination
    );
  }

  /**
   * Get scan jobs by date range
   */
  async getScanJobsByDateRange(
    tenantId: string,
    startDate: string,
    endDate: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<ScanJob>> {
    const options: QueryOptions = {
      indexName: 'LSI-StartedAt',
      filterExpression: 'startedAt BETWEEN :startDate AND :endDate',
      expressionAttributeValues: {
        ':startDate': startDate,
        ':endDate': endDate,
      },
    };

    return this.query(
      'tenantId = :tenantId',
      options,
      pagination
    );
  }

  /**
   * Get running scan jobs
   */
  async getRunningScanJobs(
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<ScanJob>> {
    const options: QueryOptions = {
      filterExpression: 'status IN (:pending, :initializing, :in_progress)',
      expressionAttributeValues: {
        ':pending': 'pending',
        ':initializing': 'initializing',
        ':in_progress': 'in_progress',
      },
    };

    if (tenantId) {
      options.filterExpression += ' AND tenantId = :tenantId';
      options.expressionAttributeValues![':tenantId'] = tenantId;
    }

    return this.scan(options, pagination);
  }

  /**
   * Get completed scan jobs
   */
  async getCompletedScanJobs(
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<ScanJob>> {
    return this.getScanJobsByStatus('completed', tenantId, pagination);
  }

  /**
   * Get failed scan jobs
   */
  async getFailedScanJobs(
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<ScanJob>> {
    return this.getScanJobsByStatus('failed', tenantId, pagination);
  }

  /**
   * Get cancelled scan jobs
   */
  async getCancelledScanJobs(
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<ScanJob>> {
    return this.getScanJobsByStatus('cancelled', tenantId, pagination);
  }

  /**
   * Get timeout scan jobs
   */
  async getTimeoutScanJobs(
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<ScanJob>> {
    return this.getScanJobsByStatus('timeout', tenantId, pagination);
  }

  /**
   * Get scheduled scan jobs
   */
  async getScheduledScanJobs(
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<ScanJob>> {
    return this.getScanJobsByType('scheduled', tenantId, pagination);
  }

  /**
   * Get manual scan jobs
   */
  async getManualScanJobs(
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<ScanJob>> {
    return this.getScanJobsByType('full_environment', tenantId, pagination);
  }

  /**
   * Get incremental scan jobs
   */
  async getIncrementalScanJobs(
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<ScanJob>> {
    return this.getScanJobsByType('incremental', tenantId, pagination);
  }

  /**
   * Get service-specific scan jobs
   */
  async getServiceSpecificScanJobs(
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<ScanJob>> {
    return this.getScanJobsByType('service_specific', tenantId, pagination);
  }

  /**
   * Get rule-specific scan jobs
   */
  async getRuleSpecificScanJobs(
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<ScanJob>> {
    return this.getScanJobsByType('rule_specific', tenantId, pagination);
  }

  /**
   * Get resource-specific scan jobs
   */
  async getResourceSpecificScanJobs(
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<ScanJob>> {
    return this.getScanJobsByType('resource_specific', tenantId, pagination);
  }

  /**
   * Update scan job status
   */
  async updateScanJobStatus(
    scanId: string,
    tenantId: string,
    status: ScanStatus,
    progress?: ScanJob['progress']
  ): Promise<ScanJob> {
    const updates: Partial<ScanJob> = {
      status,
    };

    if (progress) {
      updates.progress = progress;
    }

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updates.completedAt = new Date().toISOString();
    }

    return this.update(scanId, tenantId, updates);
  }

  /**
   * Update scan job progress
   */
  async updateScanJobProgress(
    scanId: string,
    tenantId: string,
    progress: ScanJob['progress']
  ): Promise<ScanJob> {
    return this.update(scanId, tenantId, { progress });
  }

  /**
   * Update scan job results
   */
  async updateScanJobResults(
    scanId: string,
    tenantId: string,
    results: ScanJob['results'],
    errors?: ScanJob['errors']
  ): Promise<ScanJob> {
    const updates: Partial<ScanJob> = {
      results,
    };

    if (errors) {
      updates.errors = errors;
    }

    return this.update(scanId, tenantId, updates);
  }

  /**
   * Update scan job duration
   */
  async updateScanJobDuration(
    scanId: string,
    tenantId: string,
    duration: number
  ): Promise<ScanJob> {
    return this.update(scanId, tenantId, { duration });
  }

  /**
   * Get scan job statistics by tenant
   */
  async getScanJobStatistics(tenantId: string): Promise<{
    total: number;
    byStatus: Record<ScanStatus, number>;
    byType: Record<ScanType, number>;
    byAccount: Record<string, number>;
    averageDuration: number;
    successRate: number;
  }> {
    const [total, byStatus, byType, byAccount, averageDuration, successRate] = await Promise.all([
      this.count('tenantId = :tenantId', {
        expressionAttributeValues: { ':tenantId': tenantId },
      }),
      this.getCountsByAttribute(tenantId, 'status'),
      this.getCountsByAttribute(tenantId, 'scanType'),
      this.getCountsByAttribute(tenantId, 'accountId'),
      this.getAverageDuration(tenantId),
      this.getSuccessRate(tenantId),
    ]);

    return {
      total,
      byStatus: byStatus as Record<ScanStatus, number>,
      byType: byType as Record<ScanType, number>,
      byAccount,
      averageDuration,
      successRate,
    };
  }

  /**
   * Get scan job statistics across all tenants
   */
  async getAllScanJobStatistics(): Promise<{
    total: number;
    byStatus: Record<ScanStatus, number>;
    byType: Record<ScanType, number>;
    byTenant: Record<string, number>;
    averageDuration: number;
    successRate: number;
  }> {
    const [total, byStatus, byType, byTenant, averageDuration, successRate] = await Promise.all([
      this.count(),
      this.getCountsByAttribute('status'),
      this.getCountsByAttribute('scanType'),
      this.getCountsByAttribute('tenantId'),
      this.getAverageDuration(),
      this.getSuccessRate(),
    ]);

    return {
      total,
      byStatus: byStatus as Record<ScanStatus, number>,
      byType: byType as Record<ScanType, number>,
      byTenant,
      averageDuration,
      successRate,
    };
  }

  /**
   * Get counts by attribute
   */
  private async getCountsByAttribute(
    tenantIdOrAttribute: string,
    attribute?: string
  ): Promise<Record<string, number>> {
    const isTenantId = !attribute;
    const result = isTenantId ? 
      await this.query('tenantId = :tenantId', {
        expressionAttributeValues: { ':tenantId': tenantIdOrAttribute },
      }) :
      await this.scan();

    const counts: Record<string, number> = {};
    const targetAttribute = attribute || tenantIdOrAttribute;
    
    for (const item of result.items) {
      const value = (item as any)[targetAttribute];
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
      }
    }

    return counts;
  }

  /**
   * Get average duration
   */
  private async getAverageDuration(tenantId?: string): Promise<number> {
    const options: QueryOptions = {
      filterExpression: 'attribute_exists(duration)',
    };

    if (tenantId) {
      options.filterExpression += ' AND tenantId = :tenantId';
      options.expressionAttributeValues = { ':tenantId': tenantId };
    }

    const result = tenantId ? 
      await this.query('tenantId = :tenantId', options) :
      await this.scan(options);

    if (result.items.length === 0) return 0;

    const totalDuration = result.items.reduce((sum, item) => {
      return sum + (item.duration || 0);
    }, 0);

    return totalDuration / result.items.length;
  }

  /**
   * Get success rate
   */
  private async getSuccessRate(tenantId?: string): Promise<number> {
    const options: QueryOptions = {};

    if (tenantId) {
      options.filterExpression = 'tenantId = :tenantId';
      options.expressionAttributeValues = { ':tenantId': tenantId };
    }

    const result = tenantId ? 
      await this.query('tenantId = :tenantId', options) :
      await this.scan(options);

    if (result.items.length === 0) return 0;

    const completedJobs = result.items.filter(item => item.status === 'completed');
    return (completedJobs.length / result.items.length) * 100;
  }
}
