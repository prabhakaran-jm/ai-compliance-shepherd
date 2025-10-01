/**
 * Findings Storage Service
 * 
 * Provides comprehensive CRUD operations, filtering, and statistics
 * for compliance findings stored in DynamoDB.
 */

import {
  Finding,
  FindingFilter,
  PaginationParams,
  PaginatedResponse,
  Severity,
  ComplianceFramework,
  FindingStatus,
  FindingEvidence,
  RemediationRecommendation
} from '@compliance-shepherd/shared';
import { FindingsRepository } from '@compliance-shepherd/data-access-layer';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

export class FindingsStorageService {
  private findingsRepo: FindingsRepository;

  constructor() {
    this.findingsRepo = new FindingsRepository();
  }

  /**
   * Create a single finding
   */
  async createFinding(findingData: Partial<Finding>, tenantId: string): Promise<Finding> {
    logger.info('Creating finding', {
      tenantId,
      resourceArn: findingData.resourceArn,
      severity: findingData.severity,
      framework: findingData.framework
    });

    try {
      const now = new Date().toISOString();
      
      const finding: Finding = {
        id: uuidv4(),
        tenantId,
        scanId: findingData.scanId || '',
        ruleId: findingData.ruleId || '',
        resourceArn: findingData.resourceArn || '',
        resourceType: findingData.resourceType || '',
        service: findingData.service || '',
        region: findingData.region || '',
        accountId: findingData.accountId || '',
        severity: findingData.severity || 'medium',
        framework: findingData.framework || 'SOC2',
        status: findingData.status || 'active',
        title: findingData.title || '',
        description: findingData.description || '',
        recommendation: findingData.recommendation || '',
        evidence: findingData.evidence || {},
        tags: findingData.tags || [],
        hash: this.generateFindingHash(findingData, tenantId),
        firstSeen: now,
        lastSeen: now,
        count: 1,
        metadata: {
          createdBy: findingData.metadata?.createdBy || 'system',
          source: findingData.metadata?.source || 'api',
          ...findingData.metadata
        }
      };

      const result = await this.findingsRepo.create(finding);
      
      logger.info('Finding created successfully', {
        findingId: result.id,
        tenantId,
        severity: result.severity,
        framework: result.framework
      });

      return result;

    } catch (error) {
      logger.error('Failed to create finding', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Create multiple findings in batch
   */
  async createFindings(findingsData: Partial<Finding>[], tenantId: string): Promise<{
    created: Finding[];
    failed: Array<{ data: Partial<Finding>; error: string }>;
    total: number;
  }> {
    logger.info('Creating findings in batch', {
      tenantId,
      count: findingsData.length
    });

    const created: Finding[] = [];
    const failed: Array<{ data: Partial<Finding>; error: string }> = [];

    for (const findingData of findingsData) {
      try {
        const finding = await this.createFinding(findingData, tenantId);
        created.push(finding);
      } catch (error) {
        failed.push({
          data: findingData,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    logger.info('Batch findings creation completed', {
      tenantId,
      created: created.length,
      failed: failed.length,
      total: findingsData.length
    });

    return {
      created,
      failed,
      total: findingsData.length
    };
  }

  /**
   * Get a single finding by ID
   */
  async getFinding(findingId: string, tenantId: string): Promise<Finding | null> {
    logger.info('Getting finding', {
      findingId,
      tenantId
    });

    try {
      const finding = await this.findingsRepo.getById(findingId, tenantId);
      
      if (finding) {
        logger.info('Finding retrieved successfully', {
          findingId,
          tenantId,
          severity: finding.severity,
          status: finding.status
        });
      } else {
        logger.warn('Finding not found', {
          findingId,
          tenantId
        });
      }

      return finding;

    } catch (error) {
      logger.error('Failed to get finding', {
        findingId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get findings with filters and pagination
   */
  async getFindings(
    tenantId: string,
    filters: FindingFilter = {},
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    logger.info('Getting findings with filters', {
      tenantId,
      filters,
      pagination
    });

    try {
      const result = await this.findingsRepo.getFindingsByTenant(tenantId, filters, pagination);
      
      logger.info('Findings retrieved successfully', {
        tenantId,
        count: result.items.length,
        totalCount: result.totalCount,
        hasNextToken: !!result.nextToken
      });

      return result;

    } catch (error) {
      logger.error('Failed to get findings', {
        tenantId,
        filters,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update a finding
   */
  async updateFinding(
    findingId: string,
    tenantId: string,
    updates: Partial<Finding>
  ): Promise<Finding> {
    logger.info('Updating finding', {
      findingId,
      tenantId,
      updates: Object.keys(updates)
    });

    try {
      // Remove fields that shouldn't be updated directly
      const { id, tenantId: _, createdAt, ...allowedUpdates } = updates;
      
      const result = await this.findingsRepo.update(findingId, tenantId, {
        ...allowedUpdates,
        lastSeen: new Date().toISOString()
      });

      logger.info('Finding updated successfully', {
        findingId,
        tenantId,
        updatedFields: Object.keys(allowedUpdates)
      });

      return result;

    } catch (error) {
      logger.error('Failed to update finding', {
        findingId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Delete a finding
   */
  async deleteFinding(findingId: string, tenantId: string): Promise<void> {
    logger.info('Deleting finding', {
      findingId,
      tenantId
    });

    try {
      await this.findingsRepo.delete(findingId, tenantId);
      
      logger.info('Finding deleted successfully', {
        findingId,
        tenantId
      });

    } catch (error) {
      logger.error('Failed to delete finding', {
        findingId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
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
    logger.info('Updating finding status', {
      findingId,
      tenantId,
      status,
      resolvedBy
    });

    try {
      const result = await this.findingsRepo.updateFindingStatus(findingId, tenantId, status, resolvedBy);
      
      logger.info('Finding status updated successfully', {
        findingId,
        tenantId,
        status,
        resolvedBy
      });

      return result;

    } catch (error) {
      logger.error('Failed to update finding status', {
        findingId,
        tenantId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Suppress a finding
   */
  async suppressFinding(
    findingId: string,
    tenantId: string,
    reason: string,
    suppressedBy: string,
    expiresAt?: string
  ): Promise<Finding> {
    logger.info('Suppressing finding', {
      findingId,
      tenantId,
      reason,
      suppressedBy,
      expiresAt
    });

    try {
      const result = await this.findingsRepo.suppressFinding(findingId, tenantId, reason, suppressedBy, expiresAt);
      
      logger.info('Finding suppressed successfully', {
        findingId,
        tenantId,
        reason,
        suppressedBy
      });

      return result;

    } catch (error) {
      logger.error('Failed to suppress finding', {
        findingId,
        tenantId,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get findings by severity
   */
  async getFindingsBySeverity(
    tenantId: string,
    severity: Severity,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    logger.info('Getting findings by severity', {
      tenantId,
      severity
    });

    try {
      const result = await this.findingsRepo.getFindingsBySeverity(severity, tenantId, pagination);
      
      logger.info('Findings by severity retrieved successfully', {
        tenantId,
        severity,
        count: result.items.length
      });

      return result;

    } catch (error) {
      logger.error('Failed to get findings by severity', {
        tenantId,
        severity,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get findings by framework
   */
  async getFindingsByFramework(
    tenantId: string,
    framework: ComplianceFramework,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    logger.info('Getting findings by framework', {
      tenantId,
      framework
    });

    try {
      const result = await this.findingsRepo.getFindingsByFramework(framework, tenantId, pagination);
      
      logger.info('Findings by framework retrieved successfully', {
        tenantId,
        framework,
        count: result.items.length
      });

      return result;

    } catch (error) {
      logger.error('Failed to get findings by framework', {
        tenantId,
        framework,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get findings by status
   */
  async getFindingsByStatus(
    tenantId: string,
    status: FindingStatus,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    logger.info('Getting findings by status', {
      tenantId,
      status
    });

    try {
      const result = await this.findingsRepo.getFindingsByStatus(status, tenantId, pagination);
      
      logger.info('Findings by status retrieved successfully', {
        tenantId,
        status,
        count: result.items.length
      });

      return result;

    } catch (error) {
      logger.error('Failed to get findings by status', {
        tenantId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get findings by service
   */
  async getFindingsByService(
    tenantId: string,
    service: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    logger.info('Getting findings by service', {
      tenantId,
      service
    });

    try {
      const result = await this.findingsRepo.getFindingsByService(service, tenantId, pagination);
      
      logger.info('Findings by service retrieved successfully', {
        tenantId,
        service,
        count: result.items.length
      });

      return result;

    } catch (error) {
      logger.error('Failed to get findings by service', {
        tenantId,
        service,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get findings by resource ARN
   */
  async getFindingsByResource(
    tenantId: string,
    resourceArn: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    logger.info('Getting findings by resource', {
      tenantId,
      resourceArn
    });

    try {
      const result = await this.findingsRepo.getFindingsByResource(resourceArn, pagination);
      
      // Filter by tenant if needed
      const tenantFindings = result.items.filter(finding => finding.tenantId === tenantId);
      
      logger.info('Findings by resource retrieved successfully', {
        tenantId,
        resourceArn,
        count: tenantFindings.length
      });

      return {
        items: tenantFindings,
        nextToken: result.nextToken,
        totalCount: tenantFindings.length
      };

    } catch (error) {
      logger.error('Failed to get findings by resource', {
        tenantId,
        resourceArn,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get findings by date range
   */
  async getFindingsByDateRange(
    tenantId: string,
    startDate: string,
    endDate: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    logger.info('Getting findings by date range', {
      tenantId,
      startDate,
      endDate
    });

    try {
      const result = await this.findingsRepo.getFindingsByDateRange(tenantId, startDate, endDate, pagination);
      
      logger.info('Findings by date range retrieved successfully', {
        tenantId,
        startDate,
        endDate,
        count: result.items.length
      });

      return result;

    } catch (error) {
      logger.error('Failed to get findings by date range', {
        tenantId,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get active findings
   */
  async getActiveFindings(
    tenantId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    logger.info('Getting active findings', {
      tenantId
    });

    try {
      const result = await this.findingsRepo.getActiveFindings(tenantId, pagination);
      
      logger.info('Active findings retrieved successfully', {
        tenantId,
        count: result.items.length
      });

      return result;

    } catch (error) {
      logger.error('Failed to get active findings', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get resolved findings
   */
  async getResolvedFindings(
    tenantId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    logger.info('Getting resolved findings', {
      tenantId
    });

    try {
      const result = await this.findingsRepo.getResolvedFindings(tenantId, pagination);
      
      logger.info('Resolved findings retrieved successfully', {
        tenantId,
        count: result.items.length
      });

      return result;

    } catch (error) {
      logger.error('Failed to get resolved findings', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get finding statistics
   */
  async getFindingStatistics(tenantId: string): Promise<{
    total: number;
    bySeverity: Record<Severity, number>;
    byStatus: Record<FindingStatus, number>;
    byFramework: Record<ComplianceFramework, number>;
    byService: Record<string, number>;
  }> {
    logger.info('Getting finding statistics', {
      tenantId
    });

    try {
      const result = await this.findingsRepo.getFindingStatistics(tenantId);
      
      logger.info('Finding statistics retrieved successfully', {
        tenantId,
        total: result.total,
        bySeverity: result.bySeverity,
        byStatus: result.byStatus
      });

      return result;

    } catch (error) {
      logger.error('Failed to get finding statistics', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Search findings by text
   */
  async searchFindings(
    tenantId: string,
    searchTerm: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Finding>> {
    logger.info('Searching findings', {
      tenantId,
      searchTerm
    });

    try {
      // Get all findings for the tenant and filter by search term
      const allFindings = await this.findingsRepo.getFindingsByTenant(tenantId, {}, { limit: 1000 });
      
      const searchResults = allFindings.items.filter(finding => 
        finding.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        finding.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        finding.recommendation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        finding.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      // Apply pagination
      const startIndex = 0;
      const endIndex = pagination.limit ? startIndex + pagination.limit : searchResults.length;
      const paginatedResults = searchResults.slice(startIndex, endIndex);

      logger.info('Findings search completed successfully', {
        tenantId,
        searchTerm,
        count: paginatedResults.length,
        total: searchResults.length
      });

      return {
        items: paginatedResults,
        nextToken: endIndex < searchResults.length ? 'has-more' : undefined,
        totalCount: searchResults.length
      };

    } catch (error) {
      logger.error('Failed to search findings', {
        tenantId,
        searchTerm,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate hash for finding deduplication
   */
  private generateFindingHash(findingData: Partial<Finding>, tenantId: string): string {
    const hashInput = {
      ruleId: findingData.ruleId,
      resourceArn: findingData.resourceArn,
      tenantId,
      framework: findingData.framework
    };

    return createHash('sha256')
      .update(JSON.stringify(hashInput))
      .digest('hex');
  }
}
