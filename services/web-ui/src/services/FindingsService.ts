import axios from 'axios';
import { logger } from '../utils/logger';

interface FindingsFilters {
  severity?: string;
  category?: string;
  status?: string;
  resource?: string;
  ruleId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Findings Service
 * Handles compliance findings management and remediation
 */
export class FindingsService {
  private readonly findingsStorageUrl: string;
  private readonly applyFixUrl: string;

  constructor() {
    this.findingsStorageUrl = process.env.FINDINGS_STORAGE_URL || 'http://localhost:8085';
    this.applyFixUrl = process.env.APPLY_FIX_URL || 'http://localhost:8086';
  }

  /**
   * Get findings list with filters
   */
  async getFindings(tenantId: string, filters: FindingsFilters) {
    try {
      logger.info('Fetching findings', { tenantId, filters });

      const response = await axios.get(
        `${this.findingsStorageUrl}/api/findings`,
        {
          params: {
            tenantId,
            ...filters
          },
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching findings', { 
        tenantId, 
        filters,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get specific finding
   */
  async getFinding(findingId: string, tenantId: string) {
    try {
      logger.info('Fetching finding', { findingId, tenantId });

      const response = await axios.get(
        `${this.findingsStorageUrl}/api/findings/${findingId}`,
        {
          params: { tenantId },
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching finding', { 
        findingId, 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  /**
   * Update finding status
   */
  async updateFindingStatus(
    findingId: string,
    tenantId: string,
    status: string,
    reason?: string,
    userId?: string
  ) {
    try {
      logger.info('Updating finding status', { 
        findingId, 
        tenantId, 
        status, 
        reason, 
        userId 
      });

      const response = await axios.put(
        `${this.findingsStorageUrl}/api/findings/${findingId}/status`,
        {
          tenantId,
          status,
          reason,
          userId
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error updating finding status', { 
        findingId, 
        tenantId, 
        status,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Suppress finding
   */
  async suppressFinding(
    findingId: string,
    tenantId: string,
    reason: string,
    suppressUntil?: string,
    userId?: string
  ) {
    try {
      logger.info('Suppressing finding', { 
        findingId, 
        tenantId, 
        reason, 
        suppressUntil, 
        userId 
      });

      const response = await axios.post(
        `${this.findingsStorageUrl}/api/findings/${findingId}/suppress`,
        {
          tenantId,
          reason,
          suppressUntil,
          userId
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error suppressing finding', { 
        findingId, 
        tenantId, 
        reason,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Apply remediation to finding
   */
  async applyRemediation(
    findingId: string,
    tenantId: string,
    userId: string,
    remediationType: string = 'auto',
    dryRun: boolean = false
  ) {
    try {
      logger.info('Applying remediation', { 
        findingId, 
        tenantId, 
        userId, 
        remediationType, 
        dryRun 
      });

      const response = await axios.post(
        `${this.applyFixUrl}/api/remediation/apply`,
        {
          findingId,
          tenantId,
          userId,
          remediationType,
          dryRun
        },
        {
          timeout: 60000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error applying remediation', { 
        findingId, 
        tenantId, 
        userId, 
        remediationType,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get findings statistics
   */
  async getFindingsStatistics(tenantId: string, timeRange: string) {
    try {
      logger.info('Fetching findings statistics', { tenantId, timeRange });

      const response = await axios.get(
        `${this.findingsStorageUrl}/api/findings/statistics`,
        {
          params: { 
            tenantId,
            timeRange
          },
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching findings statistics', { 
        tenantId, 
        timeRange,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Bulk update finding status
   */
  async bulkUpdateStatus(
    findingIds: string[],
    tenantId: string,
    status: string,
    reason?: string,
    userId?: string
  ) {
    try {
      logger.info('Bulk updating finding status', { 
        tenantId, 
        findingCount: findingIds.length,
        status, 
        reason, 
        userId 
      });

      const response = await axios.post(
        `${this.findingsStorageUrl}/api/findings/bulk/update-status`,
        {
          findingIds,
          tenantId,
          status,
          reason,
          userId
        },
        {
          timeout: 60000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error bulk updating finding status', { 
        tenantId, 
        findingCount: findingIds.length,
        status,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }
}
