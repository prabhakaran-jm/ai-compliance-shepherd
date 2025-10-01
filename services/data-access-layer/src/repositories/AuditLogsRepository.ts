/**
 * Repository for Audit Logs table operations
 */

import {
  AuditTrail,
  AuditAction,
  PaginationParams,
  PaginatedResponse,
} from '@compliance-shepherd/shared';
import { BaseRepository, QueryOptions } from './BaseRepository';
import { AUDIT_LOGS_TABLE } from '../tables/TableSchemas';

export interface AuditLogsRepositoryConfig {
  region?: string;
  endpoint?: string;
}

export class AuditLogsRepository extends BaseRepository<AuditTrail> {
  constructor(config: AuditLogsRepositoryConfig = {}) {
    super({
      tableName: AUDIT_LOGS_TABLE.tableName,
      region: config.region,
      endpoint: config.endpoint,
    });
  }

  /**
   * Get audit logs by action
   */
  async getAuditLogsByAction(
    action: AuditAction,
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<AuditTrail>> {
    const options: QueryOptions = {
      indexName: 'GSI-Action',
      expressionAttributeValues: {
        ':action': action,
      },
    };

    if (tenantId) {
      options.filterExpression = 'tenantId = :tenantId';
      options.expressionAttributeValues![':tenantId'] = tenantId;
    }

    return this.query(
      'action = :action',
      options,
      pagination
    );
  }

  /**
   * Get audit logs by actor
   */
  async getAuditLogsByActor(
    actorId: string,
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<AuditTrail>> {
    const options: QueryOptions = {
      indexName: 'GSI-Actor',
      expressionAttributeValues: {
        ':actorId': actorId,
      },
    };

    if (tenantId) {
      options.filterExpression = 'tenantId = :tenantId';
      options.expressionAttributeValues![':tenantId'] = tenantId;
    }

    return this.query(
      'actorId = :actorId',
      options,
      pagination
    );
  }

  /**
   * Get audit logs by target
   */
  async getAuditLogsByTarget(
    targetType: string,
    tenantId?: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<AuditTrail>> {
    const options: QueryOptions = {
      indexName: 'GSI-Target',
      expressionAttributeValues: {
        ':targetType': targetType,
      },
    };

    if (tenantId) {
      options.filterExpression = 'tenantId = :tenantId';
      options.expressionAttributeValues![':tenantId'] = tenantId;
    }

    return this.query(
      'targetType = :targetType',
      options,
      pagination
    );
  }

  /**
   * Get audit logs by tenant
   */
  async getAuditLogsByTenant(
    tenantId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<AuditTrail>> {
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
   * Get audit logs by date range
   */
  async getAuditLogsByDateRange(
    tenantId: string,
    startDate: string,
    endDate: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<AuditTrail>> {
    const options: QueryOptions = {
      filterExpression: 'timestamp BETWEEN :startDate AND :endDate',
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
   * Get recent audit logs
   */
  async getRecentAuditLogs(
    tenantId: string,
    limit: number = 100,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<AuditTrail>> {
    return this.query(
      'tenantId = :tenantId',
      {
        expressionAttributeValues: {
          ':tenantId': tenantId,
        },
        scanIndexForward: false, // Sort by timestamp descending
      },
      { ...pagination, limit }
    );
  }

  /**
   * Get audit logs by IP address
   */
  async getAuditLogsByIP(
    ipAddress: string,
    tenantId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<AuditTrail>> {
    const options: QueryOptions = {
      filterExpression: 'ipAddress = :ipAddress',
      expressionAttributeValues: {
        ':ipAddress': ipAddress,
      },
    };

    return this.query(
      'tenantId = :tenantId',
      options,
      pagination
    );
  }

  /**
   * Get audit logs by user agent
   */
  async getAuditLogsByUserAgent(
    userAgent: string,
    tenantId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<AuditTrail>> {
    const options: QueryOptions = {
      filterExpression: 'userAgent = :userAgent',
      expressionAttributeValues: {
        ':userAgent': userAgent,
      },
    };

    return this.query(
      'tenantId = :tenantId',
      options,
      pagination
    );
  }

  /**
   * Get audit logs by resource ID
   */
  async getAuditLogsByResourceId(
    resourceId: string,
    tenantId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<AuditTrail>> {
    const options: QueryOptions = {
      filterExpression: 'resourceId = :resourceId',
      expressionAttributeValues: {
        ':resourceId': resourceId,
      },
    };

    return this.query(
      'tenantId = :tenantId',
      options,
      pagination
    );
  }

  /**
   * Get audit logs by session ID
   */
  async getAuditLogsBySessionId(
    sessionId: string,
    tenantId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<AuditTrail>> {
    const options: QueryOptions = {
      filterExpression: 'sessionId = :sessionId',
      expressionAttributeValues: {
        ':sessionId': sessionId,
      },
    };

    return this.query(
      'tenantId = :tenantId',
      options,
      pagination
    );
  }

  /**
   * Get audit logs by outcome
   */
  async getAuditLogsByOutcome(
    outcome: 'success' | 'failure',
    tenantId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<AuditTrail>> {
    const options: QueryOptions = {
      filterExpression: 'outcome = :outcome',
      expressionAttributeValues: {
        ':outcome': outcome,
      },
    };

    return this.query(
      'tenantId = :tenantId',
      options,
      pagination
    );
  }

  /**
   * Get audit logs by risk level
   */
  async getAuditLogsByRiskLevel(
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    tenantId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<AuditTrail>> {
    const options: QueryOptions = {
      filterExpression: 'riskLevel = :riskLevel',
      expressionAttributeValues: {
        ':riskLevel': riskLevel,
      },
    };

    return this.query(
      'tenantId = :tenantId',
      options,
      pagination
    );
  }

  /**
   * Get audit logs by tags
   */
  async getAuditLogsByTags(
    tags: string[],
    tenantId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<AuditTrail>> {
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
   * Get audit log statistics by tenant
   */
  async getAuditLogStatistics(tenantId: string): Promise<{
    total: number;
    byAction: Record<AuditAction, number>;
    byActor: Record<string, number>;
    byTarget: Record<string, number>;
    byOutcome: Record<string, number>;
    byRiskLevel: Record<string, number>;
    byIP: Record<string, number>;
    byUserAgent: Record<string, number>;
  }> {
    const [total, byAction, byActor, byTarget, byOutcome, byRiskLevel, byIP, byUserAgent] = await Promise.all([
      this.count('tenantId = :tenantId', {
        expressionAttributeValues: { ':tenantId': tenantId },
      }),
      this.getCountsByAttribute(tenantId, 'action'),
      this.getCountsByAttribute(tenantId, 'actorId'),
      this.getCountsByAttribute(tenantId, 'targetType'),
      this.getCountsByAttribute(tenantId, 'outcome'),
      this.getCountsByAttribute(tenantId, 'riskLevel'),
      this.getCountsByAttribute(tenantId, 'ipAddress'),
      this.getCountsByAttribute(tenantId, 'userAgent'),
    ]);

    return {
      total,
      byAction: byAction as Record<AuditAction, number>,
      byActor,
      byTarget,
      byOutcome,
      byRiskLevel,
      byIP,
      byUserAgent,
    };
  }

  /**
   * Get audit log statistics across all tenants
   */
  async getAllAuditLogStatistics(): Promise<{
    total: number;
    byAction: Record<AuditAction, number>;
    byTenant: Record<string, number>;
    byOutcome: Record<string, number>;
    byRiskLevel: Record<string, number>;
  }> {
    const [total, byAction, byTenant, byOutcome, byRiskLevel] = await Promise.all([
      this.count(),
      this.getCountsByAttribute('action'),
      this.getCountsByAttribute('tenantId'),
      this.getCountsByAttribute('outcome'),
      this.getCountsByAttribute('riskLevel'),
    ]);

    return {
      total,
      byAction: byAction as Record<AuditAction, number>,
      byTenant,
      byOutcome,
      byRiskLevel,
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
}
