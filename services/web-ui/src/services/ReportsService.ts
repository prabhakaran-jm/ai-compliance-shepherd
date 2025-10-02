import axios from 'axios';
import { logger } from '../utils/logger';

interface ReportFilters {
  reportType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  status?: string;
}

interface GenerateReportRequest {
  tenantId: string;
  userId: string;
  reportType: string;
  title?: string;
  description?: string;
  filters?: Record<string, any>;
  format: string;
  includeCharts: boolean;
  includeRecommendations: boolean;
}

/**
 * Reports Service
 * Handles compliance reports, generation, and viewing
 */
export class ReportsService {
  private readonly htmlReportGeneratorUrl: string;
  private readonly apiBaseUrl: string;

  constructor() {
    this.htmlReportGeneratorUrl = process.env.HTML_REPORT_GENERATOR_URL || 'http://localhost:8083';
    this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:8080';
  }

  /**
   * Get list of reports
   */
  async getReports(tenantId: string, filters: ReportFilters) {
    try {
      logger.info('Fetching reports list', { tenantId, filters });

      const response = await axios.get(
        `${this.htmlReportGeneratorUrl}/api/reports`,
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
      logger.error('Error fetching reports list', { 
        tenantId, 
        filters,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get specific report
   */
  async getReport(reportId: string, tenantId: string) {
    try {
      logger.info('Fetching report', { reportId, tenantId });

      const response = await axios.get(
        `${this.htmlReportGeneratorUrl}/api/reports/${reportId}`,
        {
          params: { tenantId },
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching report', { 
        reportId, 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  /**
   * Generate new report
   */
  async generateReport(request: GenerateReportRequest) {
    try {
      logger.info('Generating new report', { 
        tenantId: request.tenantId,
        reportType: request.reportType,
        format: request.format
      });

      const response = await axios.post(
        `${this.htmlReportGeneratorUrl}/api/reports/generate`,
        {
          tenantId: request.tenantId,
          userId: request.userId,
          reportType: request.reportType,
          title: request.title,
          description: request.description,
          filters: request.filters || {},
          format: request.format,
          includeCharts: request.includeCharts,
          includeRecommendations: request.includeRecommendations
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
      logger.error('Error generating report', { 
        tenantId: request.tenantId,
        reportType: request.reportType,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Download report
   */
  async downloadReport(reportId: string, tenantId: string, format?: string) {
    try {
      logger.info('Downloading report', { reportId, tenantId, format });

      const response = await axios.get(
        `${this.htmlReportGeneratorUrl}/api/reports/${reportId}/download`,
        {
          params: { 
            tenantId,
            format: format || 'html'
          },
          responseType: 'arraybuffer',
          timeout: 60000
        }
      );

      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const contentDisposition = response.headers['content-disposition'] || '';
      
      let filename = 'report';
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
      logger.error('Error downloading report', { 
        reportId, 
        tenantId, 
        format,
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  /**
   * Get report preview
   */
  async getReportPreview(reportId: string, tenantId: string) {
    try {
      logger.info('Fetching report preview', { reportId, tenantId });

      const response = await axios.get(
        `${this.htmlReportGeneratorUrl}/api/reports/${reportId}/preview`,
        {
          params: { tenantId },
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching report preview', { 
        reportId, 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  /**
   * Delete report
   */
  async deleteReport(reportId: string, tenantId: string) {
    try {
      logger.info('Deleting report', { reportId, tenantId });

      await axios.delete(
        `${this.htmlReportGeneratorUrl}/api/reports/${reportId}`,
        {
          params: { tenantId },
          timeout: 30000
        }
      );

      logger.info('Report deleted successfully', { reportId, tenantId });
    } catch (error) {
      logger.error('Error deleting report', { 
        reportId, 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get available report templates
   */
  async getAvailableTemplates() {
    try {
      logger.info('Fetching available report templates');

      const response = await axios.get(
        `${this.htmlReportGeneratorUrl}/api/reports/templates`,
        { timeout: 30000 }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching report templates', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      // Return default templates
      return [
        {
          type: 'compliance_summary',
          name: 'Compliance Summary',
          description: 'High-level compliance overview with key metrics',
          formats: ['html', 'pdf'],
          estimatedTime: '2-5 minutes'
        },
        {
          type: 'detailed_findings',
          name: 'Detailed Findings Report',
          description: 'Comprehensive findings analysis with remediation recommendations',
          formats: ['html', 'pdf', 'csv'],
          estimatedTime: '5-10 minutes'
        },
        {
          type: 'executive_summary',
          name: 'Executive Summary',
          description: 'Executive-level compliance dashboard and trends',
          formats: ['html', 'pdf'],
          estimatedTime: '3-7 minutes'
        },
        {
          type: 'framework_assessment',
          name: 'Framework Assessment',
          description: 'Detailed assessment against specific compliance frameworks',
          formats: ['html', 'pdf'],
          estimatedTime: '10-15 minutes'
        },
        {
          type: 'remediation_plan',
          name: 'Remediation Plan',
          description: 'Prioritized action plan for addressing findings',
          formats: ['html', 'pdf', 'csv'],
          estimatedTime: '5-8 minutes'
        }
      ];
    }
  }

  /**
   * Create shareable link for report
   */
  async createShareLink(
    reportId: string, 
    tenantId: string, 
    expirationHours: number = 24,
    password?: string
  ) {
    try {
      logger.info('Creating report share link', { 
        reportId, 
        tenantId, 
        expirationHours 
      });

      const response = await axios.post(
        `${this.htmlReportGeneratorUrl}/api/reports/${reportId}/share`,
        {
          tenantId,
          expirationHours,
          password
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
        reportId, 
        tenantId, 
        expirationHours,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }
}
