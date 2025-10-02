import axios from 'axios';
import { logger } from '../utils/logger';

interface StartScanRequest {
  tenantId: string;
  userId: string;
  scanType: string;
  regions: string[];
  services: string[];
  priority: string;
}

interface ScanFilters {
  status?: string;
  scanType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

interface ScanResultsFilters {
  severity?: string;
  category?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

/**
 * Scans Service
 * Handles environment scanning operations
 */
export class ScansService {
  private readonly scanEnvironmentUrl: string;
  private readonly apiBaseUrl: string;

  constructor() {
    this.scanEnvironmentUrl = process.env.SCAN_ENVIRONMENT_URL || 'http://localhost:8084';
    this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:8080';
  }

  /**
   * Start new scan
   */
  async startScan(request: StartScanRequest) {
    try {
      logger.info('Starting new scan', { 
        tenantId: request.tenantId,
        scanType: request.scanType,
        regions: request.regions,
        services: request.services
      });

      const response = await axios.post(
        `${this.scanEnvironmentUrl}/api/scan/start`,
        {
          tenantId: request.tenantId,
          userId: request.userId,
          scanType: request.scanType,
          regions: request.regions,
          services: request.services,
          priority: request.priority
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
      logger.error('Error starting scan', { 
        tenantId: request.tenantId,
        scanType: request.scanType,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get scan status
   */
  async getScanStatus(scanId: string, tenantId: string) {
    try {
      logger.info('Fetching scan status', { scanId, tenantId });

      const response = await axios.get(
        `${this.scanEnvironmentUrl}/api/scan/${scanId}/status`,
        {
          params: { tenantId },
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching scan status', { 
        scanId, 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  /**
   * Get scan results
   */
  async getScanResults(scanId: string, tenantId: string, filters: ScanResultsFilters) {
    try {
      logger.info('Fetching scan results', { scanId, tenantId, filters });

      const response = await axios.get(
        `${this.scanEnvironmentUrl}/api/scan/${scanId}/results`,
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
      logger.error('Error fetching scan results', { 
        scanId, 
        tenantId, 
        filters,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get list of scans
   */
  async getScans(tenantId: string, filters: ScanFilters) {
    try {
      logger.info('Fetching scans list', { tenantId, filters });

      const response = await axios.get(
        `${this.scanEnvironmentUrl}/api/scan/list`,
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
      logger.error('Error fetching scans list', { 
        tenantId, 
        filters,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Cancel scan
   */
  async cancelScan(scanId: string, tenantId: string) {
    try {
      logger.info('Cancelling scan', { scanId, tenantId });

      await axios.post(
        `${this.scanEnvironmentUrl}/api/scan/${scanId}/cancel`,
        { tenantId },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Scan cancelled successfully', { scanId, tenantId });
    } catch (error) {
      logger.error('Error cancelling scan', { 
        scanId, 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get scan statistics
   */
  async getScanStatistics(scanId: string, tenantId: string) {
    try {
      logger.info('Fetching scan statistics', { scanId, tenantId });

      const response = await axios.get(
        `${this.scanEnvironmentUrl}/api/scan/${scanId}/statistics`,
        {
          params: { tenantId },
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching scan statistics', { 
        scanId, 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }
}
