/**
 * HTML Report Generator Service
 * 
 * Generates comprehensive HTML reports for compliance scan results
 * with executive summaries, detailed findings, and remediation guidance.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { S3 } from 'aws-sdk';
import { ReportTemplateEngine } from './ReportTemplateEngine';
import { ReportDataService } from './ReportDataService';
import { ReportStorageService } from './ReportStorageService';
import { logger } from '../utils/logger';
import { ValidationError, NotFoundError } from '../utils/errorHandler';

export interface ReportGenerationRequest {
  scanId: string;
  tenantId: string;
  reportType: 'executive' | 'detailed' | 'technical' | 'remediation';
  format: 'html' | 'pdf';
  includeCharts: boolean;
  includeRemediation: boolean;
  customSections?: string[];
}

export interface ReportGenerationResponse {
  reportId: string;
  reportUrl: string;
  reportSize: number;
  generatedAt: string;
  expiresAt: string;
}

export class HTMLReportGeneratorService {
  private s3: S3;
  private templateEngine: ReportTemplateEngine;
  private dataService: ReportDataService;
  private storageService: ReportStorageService;

  constructor() {
    this.s3 = new S3({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.templateEngine = new ReportTemplateEngine();
    this.dataService = new ReportDataService();
    this.storageService = new ReportStorageService();
  }

  /**
   * Route incoming requests to appropriate handlers
   */
  async routeRequest(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    const { httpMethod, path, pathParameters, body } = event;

    logger.info('Routing report generation request', {
      method: httpMethod,
      path,
      pathParameters
    });

    try {
      // Extract route information
      const route = this.extractRoute(path);
      const reportId = pathParameters?.reportId;

      switch (httpMethod) {
        case 'POST':
          if (path.endsWith('/reports')) {
            return await this.generateReport(event, context);
          }
          break;

        case 'GET':
          if (reportId) {
            return await this.getReport(event, context, reportId);
          } else if (path.endsWith('/reports')) {
            return await this.listReports(event, context);
          }
          break;

        case 'DELETE':
          if (reportId) {
            return await this.deleteReport(event, context, reportId);
          }
          break;

        default:
          throw new ValidationError(`Method ${httpMethod} not supported for reports`);
      }

      throw new NotFoundError(`Report endpoint not found: ${path}`);

    } catch (error) {
      logger.error('Report generation routing failed', {
        method: httpMethod,
        path,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate a new HTML report
   */
  private async generateReport(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    try {
      // Parse and validate request body
      const requestBody = JSON.parse(body || '{}');
      const validatedRequest = this.validateReportRequest(requestBody);

      // Extract tenant information from auth context
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';
      const userId = event.requestContext.authorizer?.userId || 'unknown-user';

      logger.info('Generating new report', {
        tenantId,
        userId,
        scanId: validatedRequest.scanId,
        reportType: validatedRequest.reportType,
        format: validatedRequest.format
      });

      // Generate unique report ID
      const reportId = `report-${context.awsRequestId}`;

      // Fetch scan data and findings
      const scanData = await this.dataService.getScanData(validatedRequest.scanId, tenantId);
      const findings = await this.dataService.getFindingsForScan(validatedRequest.scanId, tenantId);

      // Generate report content
      const reportContent = await this.templateEngine.generateReport({
        reportId,
        scanData,
        findings,
        reportType: validatedRequest.reportType,
        includeCharts: validatedRequest.includeCharts,
        includeRemediation: validatedRequest.includeRemediation,
        customSections: validatedRequest.customSections,
        generatedBy: userId,
        generatedAt: new Date().toISOString()
      });

      // Store report in S3
      const reportUrl = await this.storageService.storeReport({
        reportId,
        tenantId,
        content: reportContent,
        format: validatedRequest.format,
        scanId: validatedRequest.scanId,
        reportType: validatedRequest.reportType,
        generatedBy: userId
      });

      // Calculate report size
      const reportSize = Buffer.byteLength(reportContent, 'utf8');

      // Set expiration (30 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const response: ReportGenerationResponse = {
        reportId,
        reportUrl,
        reportSize,
        generatedAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      };

      logger.info('Report generated successfully', {
        reportId,
        tenantId,
        scanId: validatedRequest.scanId,
        reportSize,
        reportUrl
      });

      return {
        statusCode: 201,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          data: response
        })
      };

    } catch (error) {
      if (error instanceof ValidationError) {
        return {
          statusCode: 400,
          headers: this.getCorsHeaders(event),
          body: JSON.stringify({
            success: false,
            error: 'Validation Error',
            message: error.message,
            details: error.details
          })
        };
      }

      throw error;
    }
  }

  /**
   * Get report by ID
   */
  private async getReport(
    event: APIGatewayProxyEvent,
    context: Context,
    reportId: string
  ): Promise<APIGatewayProxyResult> {
    try {
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';

      logger.info('Getting report', {
        reportId,
        tenantId
      });

      // Get report metadata and content
      const reportMetadata = await this.storageService.getReportMetadata(reportId, tenantId);
      const reportContent = await this.storageService.getReportContent(reportId, tenantId);

      if (!reportMetadata) {
        return {
          statusCode: 404,
          headers: this.getCorsHeaders(event),
          body: JSON.stringify({
            success: false,
            error: 'Report not found',
            message: `Report with ID ${reportId} not found`
          })
        };
      }

      // Check if report has expired
      if (new Date(reportMetadata.expiresAt) < new Date()) {
        return {
          statusCode: 410,
          headers: this.getCorsHeaders(event),
          body: JSON.stringify({
            success: false,
            error: 'Report expired',
            message: `Report with ID ${reportId} has expired`
          })
        };
      }

      // Return report content with appropriate headers
      const headers = {
        ...this.getCorsHeaders(event),
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': reportContent.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Last-Modified': new Date(reportMetadata.generatedAt).toUTCString()
      };

      return {
        statusCode: 200,
        headers,
        body: reportContent
      };

    } catch (error) {
      logger.error('Failed to get report', {
        reportId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * List reports for tenant
   */
  private async listReports(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    try {
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';
      const queryParams = event.queryStringParameters || {};
      
      const limit = parseInt(queryParams.limit || '10');
      const offset = parseInt(queryParams.offset || '0');
      const reportType = queryParams.reportType;
      const scanId = queryParams.scanId;

      logger.info('Listing reports', {
        tenantId,
        limit,
        offset,
        reportType,
        scanId
      });

      // Get reports from storage
      const reports = await this.storageService.listReports({
        tenantId,
        limit,
        offset,
        reportType,
        scanId
      });

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          data: {
            reports: reports.items,
            pagination: {
              limit,
              offset,
              total: reports.total,
              hasMore: reports.hasMore
            }
          }
        })
      };

    } catch (error) {
      logger.error('Failed to list reports', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Delete report
   */
  private async deleteReport(
    event: APIGatewayProxyEvent,
    context: Context,
    reportId: string
  ): Promise<APIGatewayProxyResult> {
    try {
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';

      logger.info('Deleting report', {
        reportId,
        tenantId
      });

      // Delete report from storage
      const deleted = await this.storageService.deleteReport(reportId, tenantId);

      if (!deleted) {
        return {
          statusCode: 404,
          headers: this.getCorsHeaders(event),
          body: JSON.stringify({
            success: false,
            error: 'Report not found',
            message: `Report with ID ${reportId} not found`
          })
        };
      }

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          message: 'Report deleted successfully'
        })
      };

    } catch (error) {
      logger.error('Failed to delete report', {
        reportId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate report generation request
   */
  private validateReportRequest(body: any): ReportGenerationRequest {
    if (!body.scanId || typeof body.scanId !== 'string') {
      throw new ValidationError('scanId is required and must be a string');
    }

    if (!body.reportType || !['executive', 'detailed', 'technical', 'remediation'].includes(body.reportType)) {
      throw new ValidationError('reportType must be one of: executive, detailed, technical, remediation');
    }

    if (!body.format || !['html', 'pdf'].includes(body.format)) {
      throw new ValidationError('format must be one of: html, pdf');
    }

    return {
      scanId: body.scanId,
      tenantId: body.tenantId || 'default-tenant',
      reportType: body.reportType,
      format: body.format,
      includeCharts: body.includeCharts !== false, // Default to true
      includeRemediation: body.includeRemediation !== false, // Default to true
      customSections: body.customSections || []
    };
  }

  /**
   * Extract route from path
   */
  private extractRoute(path: string): string {
    const segments = path.replace(/^\//, '').split('/');
    return segments[0] || 'reports';
  }

  /**
   * Get CORS headers for response
   */
  private getCorsHeaders(event: APIGatewayProxyEvent): Record<string, string> {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
    const origin = event.headers.Origin || event.headers.origin;
    const allowedOrigin = allowedOrigins.includes('*') || allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    return {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Tenant-ID',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Credentials': 'true'
    };
  }
}
