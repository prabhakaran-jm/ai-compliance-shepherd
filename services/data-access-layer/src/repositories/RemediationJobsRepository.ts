/**
 * Repository for Remediation Jobs table operations
 */

import {
  RemediationJob,
  RemediationStatus,
  RemediationType,
  PaginationParams,
  PaginatedResponse,
} from '@compliance-shepherd/shared';
import { BaseRepository, QueryOptions } from './BaseRepository';
import { REMEDIATION_JOBS_TABLE } from '../tables/TableSchemas';

export interface RemediationJobsRepositoryConfig {
  region?: string;
  endpoint?: string;
}

export class RemediationJobsRepository extends BaseRepository<RemediationJob> {
  constructor(config: RemediationJobsRepositoryConfig = {}) {
    super({
      tableName: REMEDIATION_JOBS_TABLE.tableName,
      region: config.region,
      endpoint: config.endpoint,
    });
  }

  /**
   * Get remediation jobs by status
   */
  async getRemediationJobsByStatus(
    status: RemediationStatus,
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<RemediationJob>> {
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
   * Get remediation jobs by requester
   */
  async getRemediationJobsByRequester(
    requestedBy: string,
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<RemediationJob>> {
    const options: QueryOptions = {
      indexName: 'GSI-RequestedBy',
      expressionAttributeValues: {
        ':requestedBy': requestedBy,
      },
    };

    if (tenantId) {
      options.filterExpression = 'tenantId = :tenantId';
      options.expressionAttributeValues![':tenantId'] = tenantId;
    }

    return this.query(
      'requestedBy = :requestedBy',
      options,
      pagination
    );
  }

  /**
   * Get remediation jobs by type
   */
  async getRemediationJobsByType(
    type: RemediationType,
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<RemediationJob>> {
    const options: QueryOptions = {
      indexName: 'GSI-Type',
      expressionAttributeValues: {
        ':type': type,
      },
    };

    if (tenantId) {
      options.filterExpression = 'tenantId = :tenantId';
      options.expressionAttributeValues![':tenantId'] = tenantId;
    }

    return this.query(
      'type = :type',
      options,
      pagination
    );
  }

  /**
   * Get remediation jobs by tenant
   */
  async getRemediationJobsByTenant(
    tenantId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<RemediationJob>> {
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
   * Get remediation jobs by date range
   */
  async getRemediationJobsByDateRange(
    tenantId: string,
    startDate: string,
    endDate: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<RemediationJob>> {
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
   * Get pending remediation jobs
   */
  async getPendingRemediationJobs(
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<RemediationJob>> {
    return this.getRemediationJobsByStatus('pending', tenantId, pagination);
  }

  /**
   * Get running remediation jobs
   */
  async getRunningRemediationJobs(
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<RemediationJob>> {
    return this.getRemediationJobsByStatus('in_progress', tenantId, pagination);
  }

  /**
   * Get completed remediation jobs
   */
  async getCompletedRemediationJobs(
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<RemediationJob>> {
    return this.getRemediationJobsByStatus('completed', tenantId, pagination);
  }

  /**
   * Get failed remediation jobs
   */
  async getFailedRemediationJobs(
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<RemediationJob>> {
    return this.getRemediationJobsByStatus('failed', tenantId, pagination);
  }

  /**
   * Get cancelled remediation jobs
   */
  async getCancelledRemediationJobs(
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<RemediationJob>> {
    return this.getRemediationJobsByStatus('cancelled', tenantId, pagination);
  }

  /**
   * Get manual remediation jobs
   */
  async getManualRemediationJobs(
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<RemediationJob>> {
    return this.getRemediationJobsByType('manual', tenantId, pagination);
  }

  /**
   * Get automatic remediation jobs
   */
  async getAutomaticRemediationJobs(
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<RemediationJob>> {
    return this.getRemediationJobsByType('automatic', tenantId, pagination);
  }

  /**
   * Get scheduled remediation jobs
   */
  async getScheduledRemediationJobs(
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<RemediationJob>> {
    return this.getRemediationJobsByType('scheduled', tenantId, pagination);
  }

  /**
   * Get remediation jobs by finding ID
   */
  async getRemediationJobsByFindingId(
    findingId: string,
    tenantId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<RemediationJob>> {
    const options: QueryOptions = {
      filterExpression: 'findingId = :findingId',
      expressionAttributeValues: {
        ':findingId': findingId,
      },
    };

    return this.query(
      'tenantId = :tenantId',
      options,
      pagination
    );
  }

  /**
   * Get remediation jobs by resource ARN
   */
  async getRemediationJobsByResourceArn(
    resourceArn: string,
    tenantId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<RemediationJob>> {
    const options: QueryOptions = {
      filterExpression: 'resourceArn = :resourceArn',
      expressionAttributeValues: {
        ':resourceArn': resourceArn,
      },
    };

    return this.query(
      'tenantId = :tenantId',
      options,
      pagination
    );
  }

  /**
   * Get remediation jobs by service
   */
  async getRemediationJobsByService(
    service: string,
    tenantId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<RemediationJob>> {
    const options: QueryOptions = {
      filterExpression: 'service = :service',
      expressionAttributeValues: {
        ':service': service,
      },
    };

    return this.query(
      'tenantId = :tenantId',
      options,
      pagination
    );
  }

  /**
   * Get remediation jobs by framework
   */
  async getRemediationJobsByFramework(
    framework: string,
    tenantId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<RemediationJob>> {
    const options: QueryOptions = {
      filterExpression: 'framework = :framework',
      expressionAttributeValues: {
        ':framework': framework,
      },
    };

    return this.query(
      'tenantId = :tenantId',
      options,
      pagination
    );
  }

  /**
   * Update remediation job status
   */
  async updateRemediationJobStatus(
    remediationId: string,
    tenantId: string,
    status: RemediationStatus,
    progress?: RemediationJob['progress']
  ): Promise<RemediationJob> {
    const updates: Partial<RemediationJob> = {
      status,
    };

    if (progress) {
      updates.progress = progress;
    }

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updates.completedAt = new Date().toISOString();
    }

    return this.update(remediationId, tenantId, updates);
  }

  /**
   * Update remediation job progress
   */
  async updateRemediationJobProgress(
    remediationId: string,
    tenantId: string,
    progress: RemediationJob['progress']
  ): Promise<RemediationJob> {
    return this.update(remediationId, tenantId, { progress });
  }

  /**
   * Update remediation job results
   */
  async updateRemediationJobResults(
    remediationId: string,
    tenantId: string,
    results: RemediationJob['results'],
    errors?: RemediationJob['errors']
  ): Promise<RemediationJob> {
    const updates: Partial<RemediationJob> = {
      results,
    };

    if (errors) {
      updates.errors = errors;
    }

    return this.update(remediationId, tenantId, updates);
  }

  /**
   * Update remediation job duration
   */
  async updateRemediationJobDuration(
    remediationId: string,
    tenantId: string,
    duration: number
  ): Promise<RemediationJob> {
    return this.update(remediationId, tenantId, { duration });
  }

  /**
   * Get remediation job statistics by tenant
   */
  async getRemediationJobStatistics(tenantId: string): Promise<{
    total: number;
    byStatus: Record<RemediationStatus, number>;
    byType: Record<RemediationType, number>;
    byRequester: Record<string, number>;
    averageDuration: number;
    successRate: number;
  }> {
    const [total, byStatus, byType, byRequester, averageDuration, successRate] = await Promise.all([
      this.count('tenantId = :tenantId', {
        expressionAttributeValues: { ':tenantId': tenantId },
      }),
      this.getCountsByAttribute(tenantId, 'status'),
      this.getCountsByAttribute(tenantId, 'type'),
      this.getCountsByAttribute(tenantId, 'requestedBy'),
      this.getAverageDuration(tenantId),
      this.getSuccessRate(tenantId),
    ]);

    return {
      total,
      byStatus: byStatus as Record<RemediationStatus, number>,
      byType: byType as Record<RemediationType, number>,
      byRequester,
      averageDuration,
      successRate,
    };
  }

  /**
   * Get remediation job statistics across all tenants
   */
  async getAllRemediationJobStatistics(): Promise<{
    total: number;
    byStatus: Record<RemediationStatus, number>;
    byType: Record<RemediationType, number>;
    byTenant: Record<string, number>;
    averageDuration: number;
    successRate: number;
  }> {
    const [total, byStatus, byType, byTenant, averageDuration, successRate] = await Promise.all([
      this.count(),
      this.getCountsByAttribute('status'),
      this.getCountsByAttribute('type'),
      this.getCountsByAttribute('tenantId'),
      this.getAverageDuration(),
      this.getSuccessRate(),
    ]);

    return {
      total,
      byStatus: byStatus as Record<RemediationStatus, number>,
      byType: byType as Record<RemediationType, number>,
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
