/**
 * Repository for Findings table operations
 */

import { DynamoDB } from 'aws-sdk';
import {
  Finding,
  FindingFilter,
  FindingQuery,
  Severity,
  ComplianceFramework,
  FindingStatus,
  PaginationParams,
  PaginatedResponse,
} from '@compliance-shepherd/shared';
import { BaseRepository, QueryOptions } from './BaseRepository';
import { FINDINGS_TABLE } from '../tables/TableSchemas';

export interface FindingsRepositoryConfig {
  region?: string;
  endpoint?: string;
}

export class FindingsRepository extends BaseRepository<Finding> {
  constructor(config: FindingsRepositoryConfig = {}) {
    super({
      tableName: FINDINGS_TABLE.tableName,
      region: config.region,
      endpoint: config.endpoint,
    });
  }

  /**
   * Get findings by tenant with filters
   */
  async getFindingsByTenant(
    tenantId: string,
    filters: FindingFilter = {},
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    const options: QueryOptions = {
      filterExpression: this.buildFilterExpression(filters),
      expressionAttributeNames: this.buildAttributeNames(filters),
      expressionAttributeValues: this.buildAttributeValues(filters),
    };

    return this.query(
      'tenantId = :tenantId',
      options,
      pagination
    );
  }

  /**
   * Get findings by resource ARN
   */
  async getFindingsByResource(
    resourceArn: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    return this.query(
      'resourceArn = :resourceArn',
      {
        indexName: 'GSI-ResourceArn',
        expressionAttributeValues: {
          ':resourceArn': resourceArn,
        },
      },
      pagination
    );
  }

  /**
   * Get findings by severity
   */
  async getFindingsBySeverity(
    severity: Severity,
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    const options: QueryOptions = {
      indexName: 'GSI-Severity',
      expressionAttributeValues: {
        ':severity': severity,
      },
    };

    if (tenantId) {
      options.filterExpression = 'tenantId = :tenantId';
      options.expressionAttributeValues![':tenantId'] = tenantId;
    }

    return this.query(
      'severity = :severity',
      options,
      pagination
    );
  }

  /**
   * Get findings by framework
   */
  async getFindingsByFramework(
    framework: ComplianceFramework,
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    const options: QueryOptions = {
      indexName: 'GSI-Framework',
      expressionAttributeValues: {
        ':framework': framework,
      },
    };

    if (tenantId) {
      options.filterExpression = 'tenantId = :tenantId';
      options.expressionAttributeValues![':tenantId'] = tenantId;
    }

    return this.query(
      'framework = :framework',
      options,
      pagination
    );
  }

  /**
   * Get findings by status
   */
  async getFindingsByStatus(
    status: FindingStatus,
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
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
   * Get findings by service
   */
  async getFindingsByService(
    service: string,
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    const options: QueryOptions = {
      indexName: 'GSI-Service',
      expressionAttributeValues: {
        ':service': service,
      },
    };

    if (tenantId) {
      options.filterExpression = 'tenantId = :tenantId';
      options.expressionAttributeValues![':tenantId'] = tenantId;
    }

    return this.query(
      'service = :service',
      options,
      pagination
    );
  }

  /**
   * Get findings by account and region
   */
  async getFindingsByAccountRegion(
    accountId: string,
    region: string,
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    const accountRegion = `${accountId}#${region}`;
    const options: QueryOptions = {
      indexName: 'GSI-AccountRegion',
      expressionAttributeValues: {
        ':accountRegion': accountRegion,
      },
    };

    if (tenantId) {
      options.filterExpression = 'tenantId = :tenantId';
      options.expressionAttributeValues![':tenantId'] = tenantId;
    }

    return this.query(
      'accountRegion = :accountRegion',
      options,
      pagination
    );
  }

  /**
   * Get findings created within date range
   */
  async getFindingsByDateRange(
    tenantId: string,
    startDate: string,
    endDate: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    const options: QueryOptions = {
      indexName: 'LSI-CreatedAt',
      filterExpression: 'createdAt BETWEEN :startDate AND :endDate',
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
   * Get findings by tags
   */
  async getFindingsByTags(
    tenantId: string,
    tags: string[],
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    const tagConditions = tags.map((_, index) => `contains(tags, :tag${index})`);
    
    const options: QueryOptions = {
      filterExpression: tagConditions.join(' OR '),
      expressionAttributeValues: tags.reduce((acc, tag, index) => {
        acc[`:tag${index}`] = tag;
        return acc;
      }, {} as Record<string, any>),
    };

    return this.query(
      'tenantId = :tenantId',
      options,
      pagination
    );
  }

  /**
   * Get active findings (not resolved or suppressed)
   */
  async getActiveFindings(
    tenantId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    const options: QueryOptions = {
      filterExpression: 'status IN (:active, :suppressed)',
      expressionAttributeValues: {
        ':active': 'active',
        ':suppressed': 'suppressed',
      },
    };

    return this.query(
      'tenantId = :tenantId',
      options,
      pagination
    );
  }

  /**
   * Get resolved findings
   */
  async getResolvedFindings(
    tenantId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    return this.getFindingsByStatus('resolved', tenantId, pagination);
  }

  /**
   * Get findings by hash (for deduplication)
   */
  async getFindingsByHash(
    tenantId: string,
    hash: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    const options: QueryOptions = {
      filterExpression: 'hash = :hash',
      expressionAttributeValues: {
        ':hash': hash,
      },
    };

    return this.query(
      'tenantId = :tenantId',
      options,
      pagination
    );
  }

  /**
   * Update finding status
   */
  async updateFindingStatus(
    findingId: string,
    tenantId: string,
    status: FindingStatus,
    resolvedBy?: string
  ): Promise<Finding> {
    const updates: Partial<Finding> = {
      status,
      lastSeen: new Date().toISOString(),
    };

    if (status === 'resolved' && resolvedBy) {
      updates.resolvedAt = new Date().toISOString();
      updates.resolvedBy = resolvedBy;
    }

    return this.update(findingId, tenantId, updates);
  }

  /**
   * Suppress finding
   */
  async suppressFinding(
    findingId: string,
    tenantId: string,
    reason: string,
    suppressedBy: string,
    expiresAt?: string
  ): Promise<Finding> {
    const updates: Partial<Finding> = {
      status: 'suppressed',
      suppression: {
        reason,
        suppressedBy,
        suppressedAt: new Date().toISOString(),
        expiresAt,
      },
    };

    return this.update(findingId, tenantId, updates);
  }

  /**
   * Get finding statistics by tenant
   */
  async getFindingStatistics(tenantId: string): Promise<{
    total: number;
    bySeverity: Record<Severity, number>;
    byStatus: Record<FindingStatus, number>;
    byFramework: Record<ComplianceFramework, number>;
    byService: Record<string, number>;
  }> {
    const [total, bySeverity, byStatus, byFramework, byService] = await Promise.all([
      this.count('tenantId = :tenantId', {
        expressionAttributeValues: { ':tenantId': tenantId },
      }),
      this.getCountsByAttribute(tenantId, 'severity'),
      this.getCountsByAttribute(tenantId, 'status'),
      this.getCountsByAttribute(tenantId, 'framework'),
      this.getCountsByAttribute(tenantId, 'service'),
    ]);

    return {
      total,
      bySeverity: bySeverity as Record<Severity, number>,
      byStatus: byStatus as Record<FindingStatus, number>,
      byFramework: byFramework as Record<ComplianceFramework, number>,
      byService,
    };
  }

  /**
   * Get counts by attribute
   */
  private async getCountsByAttribute(
    tenantId: string,
    attribute: string
  ): Promise<Record<string, number>> {
    const result = await this.scan({
      filterExpression: 'tenantId = :tenantId',
      expressionAttributeValues: { ':tenantId': tenantId },
    });

    const counts: Record<string, number> = {};
    
    for (const item of result.items) {
      const value = (item as any)[attribute];
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
      }
    }

    return counts;
  }

  /**
   * Build filter expression from FindingFilter
   */
  private buildFilterExpression(filters: FindingFilter): string | undefined {
    const conditions: string[] = [];

    if (filters.accountId) {
      conditions.push('accountId = :accountId');
    }

    if (filters.region) {
      conditions.push('region = :region');
    }

    if (filters.service) {
      conditions.push('service = :service');
    }

    if (filters.framework) {
      conditions.push('framework = :framework');
    }

    if (filters.severity) {
      conditions.push('severity = :severity');
    }

    if (filters.status) {
      conditions.push('status = :status');
    }

    if (filters.resourceType) {
      conditions.push('resourceType = :resourceType');
    }

    if (filters.tags && filters.tags.length > 0) {
      const tagConditions = filters.tags.map((_, index) => `contains(tags, :tag${index})`);
      conditions.push(`(${tagConditions.join(' OR ')})`);
    }

    if (filters.dateFrom) {
      conditions.push('createdAt >= :dateFrom');
    }

    if (filters.dateTo) {
      conditions.push('createdAt <= :dateTo');
    }

    return conditions.length > 0 ? conditions.join(' AND ') : undefined;
  }

  /**
   * Build attribute names for filter expression
   */
  private buildAttributeNames(filters: FindingFilter): Record<string, string> {
    const names: Record<string, string> = {};

    if (filters.tags && filters.tags.length > 0) {
      filters.tags.forEach((_, index) => {
        names[`#tag${index}`] = 'tags';
      });
    }

    return names;
  }

  /**
   * Build attribute values for filter expression
   */
  private buildAttributeValues(filters: FindingFilter): Record<string, any> {
    const values: Record<string, any> = {};

    if (filters.accountId) {
      values[':accountId'] = filters.accountId;
    }

    if (filters.region) {
      values[':region'] = filters.region;
    }

    if (filters.service) {
      values[':service'] = filters.service;
    }

    if (filters.framework) {
      values[':framework'] = filters.framework;
    }

    if (filters.severity) {
      values[':severity'] = filters.severity;
    }

    if (filters.status) {
      values[':status'] = filters.status;
    }

    if (filters.resourceType) {
      values[':resourceType'] = filters.resourceType;
    }

    if (filters.tags && filters.tags.length > 0) {
      filters.tags.forEach((tag, index) => {
        values[`:tag${index}`] = tag;
      });
    }

    if (filters.dateFrom) {
      values[':dateFrom'] = filters.dateFrom;
    }

    if (filters.dateTo) {
      values[':dateTo'] = filters.dateTo;
    }

    return values;
  }
}
