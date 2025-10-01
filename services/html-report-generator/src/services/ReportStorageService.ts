/**
 * Report Storage Service
 * 
 * Handles storage and retrieval of generated reports in S3,
 * including metadata management and expiration handling.
 */

import { S3 } from 'aws-sdk';
import { logger } from '../utils/logger';

export interface ReportMetadata {
  reportId: string;
  tenantId: string;
  scanId: string;
  reportType: string;
  format: string;
  generatedBy: string;
  generatedAt: string;
  expiresAt: string;
  size: number;
  s3Key: string;
  s3Bucket: string;
}

export interface ReportStorageRequest {
  reportId: string;
  tenantId: string;
  content: string;
  format: string;
  scanId: string;
  reportType: string;
  generatedBy: string;
}

export interface ReportListOptions {
  tenantId: string;
  limit: number;
  offset: number;
  reportType?: string;
  scanId?: string;
}

export interface ReportListResult {
  items: ReportMetadata[];
  total: number;
  hasMore: boolean;
}

export class ReportStorageService {
  private s3: S3;
  private bucketName: string;

  constructor() {
    this.s3 = new S3({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.bucketName = process.env.REPORTS_S3_BUCKET || 'compliance-shepherd-reports';
  }

  /**
   * Store report in S3
   */
  async storeReport(request: ReportStorageRequest): Promise<string> {
    try {
      logger.info('Storing report in S3', {
        reportId: request.reportId,
        tenantId: request.tenantId,
        format: request.format,
        size: request.content.length
      });

      // Generate S3 key
      const s3Key = this.generateS3Key(request.tenantId, request.reportId, request.format);

      // Upload report to S3
      const uploadResult = await this.s3.upload({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: request.content,
        ContentType: this.getContentType(request.format),
        Metadata: {
          reportId: request.reportId,
          tenantId: request.tenantId,
          scanId: request.scanId,
          reportType: request.reportType,
          generatedBy: request.generatedBy,
          generatedAt: new Date().toISOString()
        },
        ServerSideEncryption: 'AES256'
      }).promise();

      // Store metadata in DynamoDB (in a real implementation)
      const metadata: ReportMetadata = {
        reportId: request.reportId,
        tenantId: request.tenantId,
        scanId: request.scanId,
        reportType: request.reportType,
        format: request.format,
        generatedBy: request.generatedBy,
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        size: request.content.length,
        s3Key,
        s3Bucket: this.bucketName
      };

      // In a real implementation, you would store metadata in DynamoDB
      // For now, we'll just log it
      logger.info('Report metadata stored', metadata);

      logger.info('Report stored successfully', {
        reportId: request.reportId,
        tenantId: request.tenantId,
        s3Key,
        s3Bucket: this.bucketName
      });

      return uploadResult.Location;

    } catch (error) {
      logger.error('Failed to store report', {
        reportId: request.reportId,
        tenantId: request.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get report content from S3
   */
  async getReportContent(reportId: string, tenantId: string): Promise<string> {
    try {
      logger.info('Getting report content from S3', { reportId, tenantId });

      // Get metadata first to find S3 key
      const metadata = await this.getReportMetadata(reportId, tenantId);
      if (!metadata) {
        throw new Error(`Report not found: ${reportId}`);
      }

      // Download report from S3
      const result = await this.s3.getObject({
        Bucket: this.bucketName,
        Key: metadata.s3Key
      }).promise();

      const content = result.Body?.toString('utf-8') || '';

      logger.info('Report content retrieved successfully', {
        reportId,
        tenantId,
        size: content.length
      });

      return content;

    } catch (error) {
      logger.error('Failed to get report content', {
        reportId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get report metadata
   */
  async getReportMetadata(reportId: string, tenantId: string): Promise<ReportMetadata | null> {
    try {
      logger.info('Getting report metadata', { reportId, tenantId });

      // In a real implementation, you would query DynamoDB
      // For now, we'll check if the file exists in S3
      const s3Key = this.generateS3Key(tenantId, reportId, 'html');

      try {
        const result = await this.s3.headObject({
          Bucket: this.bucketName,
          Key: s3Key
        }).promise();

        const metadata: ReportMetadata = {
          reportId,
          tenantId,
          scanId: result.Metadata?.scanId || 'unknown',
          reportType: result.Metadata?.reportType || 'detailed',
          format: 'html',
          generatedBy: result.Metadata?.generatedBy || 'unknown',
          generatedAt: result.Metadata?.generatedAt || new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          size: result.ContentLength || 0,
          s3Key,
          s3Bucket: this.bucketName
        };

        return metadata;

      } catch (s3Error) {
        if ((s3Error as any).statusCode === 404) {
          return null;
        }
        throw s3Error;
      }

    } catch (error) {
      logger.error('Failed to get report metadata', {
        reportId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * List reports for tenant
   */
  async listReports(options: ReportListOptions): Promise<ReportListResult> {
    try {
      logger.info('Listing reports', options);

      // In a real implementation, you would query DynamoDB with filters
      // For now, we'll list objects from S3
      const prefix = `reports/${options.tenantId}/`;

      const result = await this.s3.listObjectsV2({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: options.limit + options.offset
      }).promise();

      const items: ReportMetadata[] = [];

      if (result.Contents) {
        for (const object of result.Contents) {
          if (object.Key) {
            // Extract report ID from S3 key
            const reportId = this.extractReportIdFromKey(object.Key);
            if (reportId) {
              const metadata = await this.getReportMetadata(reportId, options.tenantId);
              if (metadata) {
                // Apply filters
                if (options.reportType && metadata.reportType !== options.reportType) {
                  continue;
                }
                if (options.scanId && metadata.scanId !== options.scanId) {
                  continue;
                }
                items.push(metadata);
              }
            }
          }
        }
      }

      // Apply pagination
      const paginatedItems = items.slice(options.offset, options.offset + options.limit);
      const hasMore = items.length > options.offset + options.limit;

      logger.info('Reports listed successfully', {
        tenantId: options.tenantId,
        total: items.length,
        returned: paginatedItems.length,
        hasMore
      });

      return {
        items: paginatedItems,
        total: items.length,
        hasMore
      };

    } catch (error) {
      logger.error('Failed to list reports', {
        options,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Delete report from S3
   */
  async deleteReport(reportId: string, tenantId: string): Promise<boolean> {
    try {
      logger.info('Deleting report', { reportId, tenantId });

      // Get metadata first to find S3 key
      const metadata = await this.getReportMetadata(reportId, tenantId);
      if (!metadata) {
        return false;
      }

      // Delete from S3
      await this.s3.deleteObject({
        Bucket: this.bucketName,
        Key: metadata.s3Key
      }).promise();

      // In a real implementation, you would also delete metadata from DynamoDB
      logger.info('Report deleted successfully', {
        reportId,
        tenantId,
        s3Key: metadata.s3Key
      });

      return true;

    } catch (error) {
      logger.error('Failed to delete report', {
        reportId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Clean up expired reports
   */
  async cleanupExpiredReports(): Promise<number> {
    try {
      logger.info('Cleaning up expired reports');

      let deletedCount = 0;

      // List all reports
      const result = await this.s3.listObjectsV2({
        Bucket: this.bucketName,
        Prefix: 'reports/'
      }).promise();

      if (result.Contents) {
        for (const object of result.Contents) {
          if (object.Key) {
            try {
              // Get object metadata
              const headResult = await this.s3.headObject({
                Bucket: this.bucketName,
                Key: object.Key
              }).promise();

              const generatedAt = headResult.Metadata?.generatedAt;
              if (generatedAt) {
                const generatedDate = new Date(generatedAt);
                const expirationDate = new Date(generatedDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

                if (new Date() > expirationDate) {
                  // Delete expired report
                  await this.s3.deleteObject({
                    Bucket: this.bucketName,
                    Key: object.Key
                  }).promise();

                  deletedCount++;
                  logger.info('Deleted expired report', { s3Key: object.Key });
                }
              }
            } catch (error) {
              logger.warn('Failed to process object for cleanup', {
                s3Key: object.Key,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
        }
      }

      logger.info('Cleanup completed', { deletedCount });

      return deletedCount;

    } catch (error) {
      logger.error('Failed to cleanup expired reports', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate S3 key for report
   */
  private generateS3Key(tenantId: string, reportId: string, format: string): string {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `reports/${tenantId}/${timestamp}/${reportId}.${format}`;
  }

  /**
   * Extract report ID from S3 key
   */
  private extractReportIdFromKey(s3Key: string): string | null {
    const parts = s3Key.split('/');
    if (parts.length >= 4) {
      const filename = parts[parts.length - 1];
      return filename.replace(/\.[^/.]+$/, ''); // Remove file extension
    }
    return null;
  }

  /**
   * Get content type for format
   */
  private getContentType(format: string): string {
    const contentTypes = {
      html: 'text/html; charset=utf-8',
      pdf: 'application/pdf',
      json: 'application/json',
      xml: 'application/xml'
    };
    return contentTypes[format] || 'text/plain';
  }

  /**
   * Get presigned URL for report download
   */
  async getPresignedUrl(reportId: string, tenantId: string, expiresIn: number = 3600): Promise<string> {
    try {
      logger.info('Generating presigned URL', { reportId, tenantId, expiresIn });

      const metadata = await this.getReportMetadata(reportId, tenantId);
      if (!metadata) {
        throw new Error(`Report not found: ${reportId}`);
      }

      const url = await this.s3.getSignedUrlPromise('getObject', {
        Bucket: this.bucketName,
        Key: metadata.s3Key,
        Expires: expiresIn
      });

      logger.info('Presigned URL generated successfully', {
        reportId,
        tenantId,
        expiresIn
      });

      return url;

    } catch (error) {
      logger.error('Failed to generate presigned URL', {
        reportId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get report statistics
   */
  async getReportStatistics(tenantId: string): Promise<any> {
    try {
      logger.info('Getting report statistics', { tenantId });

      const reports = await this.listReports({
        tenantId,
        limit: 1000,
        offset: 0
      });

      const stats = {
        totalReports: reports.total,
        byType: {} as { [key: string]: number },
        byFormat: {} as { [key: string]: number },
        totalSize: 0,
        averageSize: 0,
        oldestReport: null as string | null,
        newestReport: null as string | null
      };

      let totalSize = 0;
      let oldestDate: Date | null = null;
      let newestDate: Date | null = null;

      for (const report of reports.items) {
        // Count by type
        stats.byType[report.reportType] = (stats.byType[report.reportType] || 0) + 1;

        // Count by format
        stats.byFormat[report.format] = (stats.byFormat[report.format] || 0) + 1;

        // Calculate total size
        totalSize += report.size;

        // Find oldest and newest reports
        const reportDate = new Date(report.generatedAt);
        if (!oldestDate || reportDate < oldestDate) {
          oldestDate = reportDate;
          stats.oldestReport = report.generatedAt;
        }
        if (!newestDate || reportDate > newestDate) {
          newestDate = reportDate;
          stats.newestReport = report.generatedAt;
        }
      }

      stats.totalSize = totalSize;
      stats.averageSize = reports.total > 0 ? Math.round(totalSize / reports.total) : 0;

      logger.info('Report statistics calculated', {
        tenantId,
        totalReports: stats.totalReports,
        totalSize: stats.totalSize
      });

      return stats;

    } catch (error) {
      logger.error('Failed to get report statistics', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}
