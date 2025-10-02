import axios from 'axios';
import { logger } from '../utils/logger';

interface AuditPacksFilters {
  status?: string;
  framework?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

interface GenerateAuditPackRequest {
  tenantId: string;
  userId: string;
  framework: string;
  title?: string;
  description?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  includeRemediation: boolean;
  includeEvidence: boolean;
  exportFormats: string[];
  priority: string;
}

/**
 * Audit Packs Service
 * Handles audit package generation and management
 */
export class AuditPacksService {
  private readonly auditPackGeneratorUrl: string;

  constructor() {
    this.auditPackGeneratorUrl = process.env.AUDIT_PACK_GENERATOR_URL || 'http://localhost:8088';
  }

  /**
   * Get audit packs list
   */
  async getAuditPacks(tenantId: string, filters: AuditPacksFilters) {
    try {
      logger.info('Fetching audit packs', { tenantId, filters });

      const response = await axios.get(
        `${this.auditPackGeneratorUrl}/api/audit-packs`,
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
      logger.error('Error fetching audit packs', { 
        tenantId, 
        filters,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get specific audit pack
   */
  async getAuditPack(auditPackId: string, tenantId: string) {
    try {
      logger.info('Fetching audit pack', { auditPackId, tenantId });

      const response = await axios.get(
        `${this.auditPackGeneratorUrl}/api/audit-packs/${auditPackId}`,
        {
          params: { tenantId },
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching audit pack', { 
        auditPackId, 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  /**
   * Generate new audit pack
   */
  async generateAuditPack(request: GenerateAuditPackRequest) {
    try {
      logger.info('Generating audit pack', { 
        tenantId: request.tenantId,
        framework: request.framework,
        exportFormats: request.exportFormats
      });

      const response = await axios.post(
        `${this.auditPackGeneratorUrl}/api/audit-packs/generate`,
        request,
        {
          timeout: 60000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error generating audit pack', { 
        tenantId: request.tenantId,
        framework: request.framework,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Download audit pack
   */
  async downloadAuditPack(auditPackId: string, tenantId: string, format: string) {
    try {
      logger.info('Downloading audit pack', { auditPackId, tenantId, format });

      const response = await axios.get(
        `${this.auditPackGeneratorUrl}/api/audit-packs/${auditPackId}/download`,
        {
          params: { 
            tenantId,
            format
          },
          responseType: 'arraybuffer',
          timeout: 60000
        }
      );

      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const contentDisposition = response.headers['content-disposition'] || '';
      
      let filename = 'audit-pack';
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }

      return {
        content: response.data,
        contentType,
        filename
      };
    } catch (error) {
      logger.error('Error downloading audit pack', { 
        auditPackId, 
        tenantId, 
        format,
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  /**
   * Get audit pack status
   */
  async getAuditPackStatus(auditPackId: string, tenantId: string) {
    try {
      logger.info('Fetching audit pack status', { auditPackId, tenantId });

      const response = await axios.get(
        `${this.auditPackGeneratorUrl}/api/audit-packs/${auditPackId}/status`,
        {
          params: { tenantId },
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching audit pack status', { 
        auditPackId, 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  /**
   * Cancel audit pack generation
   */
  async cancelAuditPack(auditPackId: string, tenantId: string) {
    try {
      logger.info('Cancelling audit pack generation', { auditPackId, tenantId });

      await axios.post(
        `${this.auditPackGeneratorUrl}/api/audit-packs/${auditPackId}/cancel`,
        { tenantId },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Audit pack generation cancelled', { auditPackId, tenantId });
    } catch (error) {
      logger.error('Error cancelling audit pack', { 
        auditPackId, 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Delete audit pack
   */
  async deleteAuditPack(auditPackId: string, tenantId: string) {
    try {
      logger.info('Deleting audit pack', { auditPackId, tenantId });

      await axios.delete(
        `${this.auditPackGeneratorUrl}/api/audit-packs/${auditPackId}`,
        {
          params: { tenantId },
          timeout: 30000
        }
      );

      logger.info('Audit pack deleted successfully', { auditPackId, tenantId });
    } catch (error) {
      logger.error('Error deleting audit pack', { 
        auditPackId, 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get available compliance frameworks
   */
  async getAvailableFrameworks() {
    try {
      logger.info('Fetching available compliance frameworks');

      const response = await axios.get(
        `${this.auditPackGeneratorUrl}/api/audit-packs/frameworks`,
        { timeout: 30000 }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching frameworks', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      // Return default frameworks
      return [
        {
          id: 'soc2',
          name: 'SOC 2',
          description: 'Service Organization Control 2',
          controls: 64,
          estimatedTime: '15-30 minutes'
        },
        {
          id: 'hipaa',
          name: 'HIPAA',
          description: 'Health Insurance Portability and Accountability Act',
          controls: 45,
          estimatedTime: '10-20 minutes'
        },
        {
          id: 'gdpr',
          name: 'GDPR',
          description: 'General Data Protection Regulation',
          controls: 32,
          estimatedTime: '8-15 minutes'
        },
        {
          id: 'pci_dss',
          name: 'PCI DSS',
          description: 'Payment Card Industry Data Security Standard',
          controls: 78,
          estimatedTime: '20-35 minutes'
        },
        {
          id: 'iso27001',
          name: 'ISO 27001',
          description: 'Information Security Management',
          controls: 114,
          estimatedTime: '25-45 minutes'
        }
      ];
    }
  }

  /**
   * Create shareable link for audit pack
   */
  async createShareLink(
    auditPackId: string,
    tenantId: string,
    expirationHours: number = 24,
    password?: string,
    allowedEmails: string[] = []
  ) {
    try {
      logger.info('Creating audit pack share link', { 
        auditPackId, 
        tenantId, 
        expirationHours,
        allowedEmailsCount: allowedEmails.length
      });

      const response = await axios.post(
        `${this.auditPackGeneratorUrl}/api/audit-packs/${auditPackId}/share`,
        {
          tenantId,
          expirationHours,
          password,
          allowedEmails
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
      logger.error('Error creating share link', { 
        auditPackId, 
        tenantId, 
        expirationHours,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }
}
