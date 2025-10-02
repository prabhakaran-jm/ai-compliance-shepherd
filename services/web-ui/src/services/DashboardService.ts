import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * Dashboard Service
 * Aggregates data from various services for dashboard display
 */
export class DashboardService {
  private readonly apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:8080';
  }

  /**
   * Get dashboard overview with key metrics
   */
  async getOverview(tenantId: string) {
    try {
      logger.info('Fetching dashboard overview', { tenantId });

      // Fetch data from multiple sources in parallel
      const [
        scanStatus,
        findingsStats,
        complianceScore,
        recentActivity,
        resourceStats
      ] = await Promise.all([
        this.getScanStatus(tenantId),
        this.getFindingsStatistics(tenantId),
        this.getComplianceScore(tenantId),
        this.getRecentActivity(tenantId, 5),
        this.getResourceStatistics(tenantId)
      ]);

      return {
        scanStatus,
        findingsStats,
        complianceScore,
        recentActivity,
        resourceStats,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error fetching dashboard overview', { 
        tenantId, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get compliance score trends over time
   */
  async getComplianceTrends(tenantId: string, timeRange: string) {
    try {
      logger.info('Fetching compliance trends', { tenantId, timeRange });

      const response = await axios.get(
        `${this.apiBaseUrl}/api/compliance/trends`,
        {
          params: { tenantId, timeRange },
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching compliance trends', { 
        tenantId, 
        timeRange,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get recent activity/audit logs
   */
  async getRecentActivity(tenantId: string, limit: number = 10) {
    try {
      logger.info('Fetching recent activity', { tenantId, limit });

      const response = await axios.get(
        `${this.apiBaseUrl}/api/audit-logs`,
        {
          params: { 
            tenantId, 
            limit,
            sortBy: 'timestamp',
            sortOrder: 'desc'
          },
          timeout: 30000
        }
      );

      return response.data.data.items || [];
    } catch (error) {
      logger.error('Error fetching recent activity', { 
        tenantId, 
        limit,
        error: error instanceof Error ? error.message : String(error) 
      });
      return [];
    }
  }

  /**
   * Get critical findings summary
   */
  async getCriticalFindings(tenantId: string) {
    try {
      logger.info('Fetching critical findings', { tenantId });

      const response = await axios.get(
        `${this.apiBaseUrl}/api/findings`,
        {
          params: { 
            tenantId, 
            severity: 'critical',
            status: 'open',
            limit: 10
          },
          timeout: 30000
        }
      );

      return response.data.data.items || [];
    } catch (error) {
      logger.error('Error fetching critical findings', { 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      return [];
    }
  }

  /**
   * Get current scan status
   */
  async getScanStatus(tenantId: string) {
    try {
      logger.info('Fetching scan status', { tenantId });

      const response = await axios.get(
        `${this.apiBaseUrl}/api/scans/status`,
        {
          params: { tenantId },
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching scan status', { 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      return {
        status: 'unknown',
        lastScan: null,
        nextScan: null,
        progress: 0
      };
    }
  }

  /**
   * Get resource statistics
   */
  async getResourceStatistics(tenantId: string) {
    try {
      logger.info('Fetching resource statistics', { tenantId });

      const response = await axios.get(
        `${this.apiBaseUrl}/api/resources/statistics`,
        {
          params: { tenantId },
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching resource statistics', { 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      return {
        totalResources: 0,
        resourcesByService: {},
        resourcesByRegion: {},
        complianceByService: {}
      };
    }
  }

  /**
   * Get compliance score
   */
  private async getComplianceScore(tenantId: string) {
    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/api/compliance/score`,
        {
          params: { tenantId },
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching compliance score', { 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      return {
        overall: 0,
        byFramework: {},
        trend: 'stable'
      };
    }
  }

  /**
   * Get findings statistics
   */
  private async getFindingsStatistics(tenantId: string) {
    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/api/findings/statistics`,
        {
          params: { tenantId },
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching findings statistics', { 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      return {
        total: 0,
        bySeverity: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0
        },
        byStatus: {
          open: 0,
          resolved: 0,
          suppressed: 0,
          false_positive: 0
        },
        byCategory: {}
      };
    }
  }
}
