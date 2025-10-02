import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { logger } from '../utils/logger';
import { AuditPackGeneratorError } from '../utils/errorHandler';
import { 
  AuditPackRequest,
  AuditPackResponse,
  AuditPackListRequest,
  ComplianceSummary,
  EvidenceReport
} from '../types/auditPack';
import { v4 as uuidv4 } from 'uuid';
import { EvidenceCollectorService } from './EvidenceCollectorService';
import { ComplianceAnalyzerService } from './ComplianceAnalyzerService';
import { ReportGeneratorService } from './ReportGeneratorService';
import { PackageBuilderService } from './PackageBuilderService';

/**
 * Service for generating comprehensive audit packages
 * Orchestrates evidence collection, analysis, and packaging
 */
export class AuditPackGeneratorService {
  private s3Client: S3Client;
  private stsClient: STSClient;
  private evidenceCollector: EvidenceCollectorService;
  private complianceAnalyzer: ComplianceAnalyzerService;
  private reportGenerator: ReportGeneratorService;
  private packageBuilder: PackageBuilderService;
  private accountId?: string;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.s3Client = new S3Client({ region: this.region });
    this.stsClient = new STSClient({ region: this.region });
    this.evidenceCollector = new EvidenceCollectorService();
    this.complianceAnalyzer = new ComplianceAnalyzerService();
    this.reportGenerator = new ReportGeneratorService();
    this.packageBuilder = new PackageBuilderService();
  }

  /**
   * Generate comprehensive audit pack
   */
  async generateAuditPack(request: AuditPackRequest, correlationId: string): Promise<AuditPackResponse> {
    try {
      logger.info('Starting audit pack generation', {
        correlationId,
        tenantId: request.tenantId,
        framework: request.framework,
        auditType: request.auditType
      });

      // Get account ID if not cached
      if (!this.accountId) {
        const identity = await this.stsClient.send(new GetCallerIdentityCommand({}));
        this.accountId = identity.Account;
      }

      const auditPackId = uuidv4();
      const startTime = new Date();

      // Initialize audit pack response
      const auditPack: AuditPackResponse = {
        auditPackId,
        tenantId: request.tenantId,
        framework: request.framework,
        auditType: request.auditType,
        status: 'IN_PROGRESS',
        requestedBy: request.requestedBy || 'system',
        requestedAt: startTime.toISOString(),
        configuration: {
          includePolicies: request.configuration?.includePolicies ?? true,
          includeFindings: request.configuration?.includeFindings ?? true,
          includeRemediation: request.configuration?.includeRemediation ?? true,
          includeEvidence: request.configuration?.includeEvidence ?? true,
          includeMetrics: request.configuration?.includeMetrics ?? true,
          dateRange: request.configuration?.dateRange || {
            startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
            endDate: new Date().toISOString()
          },
          format: request.configuration?.format || 'PDF',
          customSections: request.configuration?.customSections || []
        },
        progress: {
          currentStep: 'INITIALIZING',
          completedSteps: 0,
          totalSteps: 8,
          percentage: 0
        }
      };

      // Store initial audit pack record
      await this.storeAuditPackRecord(auditPack, correlationId);

      // Execute audit pack generation steps
      await this.executeAuditPackGeneration(auditPack, correlationId);

      logger.info('Audit pack generation completed', {
        correlationId,
        auditPackId,
        tenantId: request.tenantId,
        duration: Date.now() - startTime.getTime()
      });

      return auditPack;

    } catch (error) {
      logger.error('Error generating audit pack', {
        correlationId,
        tenantId: request.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AuditPackGeneratorError(
        `Failed to generate audit pack: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get audit pack details
   */
  async getAuditPack(auditPackId: string, correlationId: string): Promise<AuditPackResponse> {
    try {
      logger.info('Getting audit pack', {
        correlationId,
        auditPackId
      });

      // In a real implementation, this would retrieve from DynamoDB
      // For now, return mock data
      const mockAuditPack: AuditPackResponse = {
        auditPackId,
        tenantId: 'tenant-demo-company',
        framework: 'SOC2',
        auditType: 'ANNUAL',
        status: 'COMPLETED',
        requestedBy: 'auditor@demo-company.com',
        requestedAt: '2023-01-01T00:00:00Z',
        completedAt: '2023-01-01T01:30:00Z',
        configuration: {
          includePolicies: true,
          includeFindings: true,
          includeRemediation: true,
          includeEvidence: true,
          includeMetrics: true,
          dateRange: {
            startDate: '2022-10-01T00:00:00Z',
            endDate: '2023-01-01T00:00:00Z'
          },
          format: 'PDF',
          customSections: ['executive-summary', 'technical-details']
        },
        progress: {
          currentStep: 'COMPLETED',
          completedSteps: 8,
          totalSteps: 8,
          percentage: 100
        },
        summary: {
          totalFindings: 1250,
          criticalFindings: 15,
          resolvedFindings: 950,
          complianceScore: 87.5,
          controlsCovered: 64,
          evidenceItems: 342,
          documentCount: 28,
          totalSize: '45.2 MB'
        },
        downloadUrl: `https://compliance-shepherd-demo-company.s3.amazonaws.com/audit-packs/${auditPackId}/audit-pack.zip?X-Amz-Expires=3600`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      };

      logger.info('Audit pack retrieved successfully', {
        correlationId,
        auditPackId,
        status: mockAuditPack.status
      });

      return mockAuditPack;

    } catch (error) {
      logger.error('Error getting audit pack', {
        correlationId,
        auditPackId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AuditPackGeneratorError(
        `Failed to get audit pack: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * List audit packs
   */
  async listAuditPacks(
    request: AuditPackListRequest,
    correlationId: string
  ): Promise<{ auditPacks: AuditPackResponse[]; nextToken?: string }> {
    try {
      logger.info('Listing audit packs', {
        correlationId,
        tenantId: request.tenantId,
        framework: request.framework,
        status: request.status
      });

      // In a real implementation, this would query DynamoDB
      // For now, return mock data
      const mockAuditPacks: AuditPackResponse[] = [
        {
          auditPackId: 'audit-pack-1',
          tenantId: request.tenantId || 'tenant-demo-company',
          framework: 'SOC2',
          auditType: 'ANNUAL',
          status: 'COMPLETED',
          requestedBy: 'auditor@demo-company.com',
          requestedAt: '2023-01-01T00:00:00Z',
          completedAt: '2023-01-01T01:30:00Z',
          configuration: {
            includePolicies: true,
            includeFindings: true,
            includeRemediation: true,
            includeEvidence: true,
            includeMetrics: true,
            dateRange: {
              startDate: '2022-10-01T00:00:00Z',
              endDate: '2023-01-01T00:00:00Z'
            },
            format: 'PDF'
          },
          progress: {
            currentStep: 'COMPLETED',
            completedSteps: 8,
            totalSteps: 8,
            percentage: 100
          },
          summary: {
            totalFindings: 1250,
            criticalFindings: 15,
            resolvedFindings: 950,
            complianceScore: 87.5,
            controlsCovered: 64,
            evidenceItems: 342,
            documentCount: 28,
            totalSize: '45.2 MB'
          }
        },
        {
          auditPackId: 'audit-pack-2',
          tenantId: request.tenantId || 'tenant-demo-company',
          framework: 'HIPAA',
          auditType: 'QUARTERLY',
          status: 'IN_PROGRESS',
          requestedBy: 'compliance@demo-company.com',
          requestedAt: '2023-01-15T00:00:00Z',
          configuration: {
            includePolicies: true,
            includeFindings: true,
            includeRemediation: false,
            includeEvidence: true,
            includeMetrics: true,
            dateRange: {
              startDate: '2022-10-15T00:00:00Z',
              endDate: '2023-01-15T00:00:00Z'
            },
            format: 'ZIP'
          },
          progress: {
            currentStep: 'COLLECTING_EVIDENCE',
            completedSteps: 4,
            totalSteps: 8,
            percentage: 50
          }
        }
      ];

      // Apply filters
      let filteredPacks = mockAuditPacks;
      
      if (request.framework) {
        filteredPacks = filteredPacks.filter(pack => pack.framework === request.framework);
      }
      
      if (request.status) {
        filteredPacks = filteredPacks.filter(pack => pack.status === request.status);
      }

      // Apply limit
      const limitedPacks = filteredPacks.slice(0, request.limit || 50);

      logger.info('Audit packs listed successfully', {
        correlationId,
        auditPackCount: limitedPacks.length
      });

      return {
        auditPacks: limitedPacks
      };

    } catch (error) {
      logger.error('Error listing audit packs', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AuditPackGeneratorError(
        `Failed to list audit packs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get audit pack download URL
   */
  async getAuditPackDownloadUrl(auditPackId: string, correlationId: string): Promise<{ downloadUrl: string; expiresAt: string }> {
    try {
      logger.info('Getting audit pack download URL', {
        correlationId,
        auditPackId
      });

      // Get audit pack details to verify it exists and is completed
      const auditPack = await this.getAuditPack(auditPackId, correlationId);
      
      if (auditPack.status !== 'COMPLETED') {
        throw new AuditPackGeneratorError('Audit pack is not ready for download');
      }

      // Generate presigned URL for download
      const bucketName = `compliance-shepherd-${auditPack.tenantId.replace('tenant-', '')}`;
      const objectKey = `audit-packs/${auditPackId}/audit-pack.zip`;

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: objectKey
      });

      const downloadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 }); // 1 hour
      const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

      logger.info('Audit pack download URL generated', {
        correlationId,
        auditPackId,
        expiresAt
      });

      return {
        downloadUrl,
        expiresAt
      };

    } catch (error) {
      logger.error('Error getting audit pack download URL', {
        correlationId,
        auditPackId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AuditPackGeneratorError(
        `Failed to get download URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete audit pack
   */
  async deleteAuditPack(auditPackId: string, correlationId: string): Promise<{ deleted: boolean; message: string }> {
    try {
      logger.info('Deleting audit pack', {
        correlationId,
        auditPackId
      });

      // Get audit pack details
      const auditPack = await this.getAuditPack(auditPackId, correlationId);

      // Delete from S3
      const bucketName = `compliance-shepherd-${auditPack.tenantId.replace('tenant-', '')}`;
      const objectKey = `audit-packs/${auditPackId}/audit-pack.zip`;

      try {
        await this.s3Client.send(new DeleteObjectCommand({
          Bucket: bucketName,
          Key: objectKey
        }));
      } catch (s3Error) {
        logger.warn('Failed to delete audit pack from S3', {
          correlationId,
          auditPackId,
          error: s3Error instanceof Error ? s3Error.message : 'Unknown error'
        });
      }

      // Delete audit pack record from database
      await this.deleteAuditPackRecord(auditPackId, correlationId);

      logger.info('Audit pack deleted successfully', {
        correlationId,
        auditPackId
      });

      return {
        deleted: true,
        message: 'Audit pack deleted successfully'
      };

    } catch (error) {
      logger.error('Error deleting audit pack', {
        correlationId,
        auditPackId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AuditPackGeneratorError(
        `Failed to delete audit pack: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate compliance summary
   */
  async generateComplianceSummary(request: AuditPackRequest, correlationId: string): Promise<ComplianceSummary> {
    try {
      logger.info('Generating compliance summary', {
        correlationId,
        tenantId: request.tenantId,
        framework: request.framework
      });

      const summary = await this.complianceAnalyzer.generateComplianceSummary(
        request.tenantId,
        request.framework,
        request.configuration?.dateRange,
        correlationId
      );

      logger.info('Compliance summary generated successfully', {
        correlationId,
        tenantId: request.tenantId,
        complianceScore: summary.overallScore
      });

      return summary;

    } catch (error) {
      logger.error('Error generating compliance summary', {
        correlationId,
        tenantId: request.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AuditPackGeneratorError(
        `Failed to generate compliance summary: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate evidence report
   */
  async generateEvidenceReport(request: AuditPackRequest, correlationId: string): Promise<EvidenceReport> {
    try {
      logger.info('Generating evidence report', {
        correlationId,
        tenantId: request.tenantId,
        framework: request.framework
      });

      const evidenceReport = await this.evidenceCollector.generateEvidenceReport(
        request.tenantId,
        request.framework,
        request.configuration?.dateRange,
        correlationId
      );

      logger.info('Evidence report generated successfully', {
        correlationId,
        tenantId: request.tenantId,
        evidenceCount: evidenceReport.evidenceItems.length
      });

      return evidenceReport;

    } catch (error) {
      logger.error('Error generating evidence report', {
        correlationId,
        tenantId: request.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AuditPackGeneratorError(
        `Failed to generate evidence report: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get audit pack status
   */
  async getAuditPackStatus(auditPackId: string, correlationId: string): Promise<{ status: string; progress: any }> {
    try {
      const auditPack = await this.getAuditPack(auditPackId, correlationId);
      
      return {
        status: auditPack.status,
        progress: auditPack.progress
      };

    } catch (error) {
      throw new AuditPackGeneratorError(
        `Failed to get audit pack status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Execute audit pack generation steps
   */
  private async executeAuditPackGeneration(auditPack: AuditPackResponse, correlationId: string): Promise<void> {
    try {
      // Step 1: Initialize and validate
      await this.updateProgress(auditPack, 'INITIALIZING', 1, correlationId);
      
      // Step 2: Collect evidence
      await this.updateProgress(auditPack, 'COLLECTING_EVIDENCE', 2, correlationId);
      const evidence = await this.evidenceCollector.collectEvidence(
        auditPack.tenantId,
        auditPack.framework,
        auditPack.configuration.dateRange,
        correlationId
      );

      // Step 3: Analyze compliance
      await this.updateProgress(auditPack, 'ANALYZING_COMPLIANCE', 3, correlationId);
      const complianceAnalysis = await this.complianceAnalyzer.analyzeCompliance(
        auditPack.tenantId,
        auditPack.framework,
        evidence,
        correlationId
      );

      // Step 4: Generate reports
      await this.updateProgress(auditPack, 'GENERATING_REPORTS', 4, correlationId);
      const reports = await this.reportGenerator.generateReports(
        auditPack,
        evidence,
        complianceAnalysis,
        correlationId
      );

      // Step 5: Collect policies and procedures
      await this.updateProgress(auditPack, 'COLLECTING_POLICIES', 5, correlationId);
      
      // Step 6: Package evidence
      await this.updateProgress(auditPack, 'PACKAGING_EVIDENCE', 6, correlationId);
      
      // Step 7: Generate final package
      await this.updateProgress(auditPack, 'GENERATING_PACKAGE', 7, correlationId);
      const packageInfo = await this.packageBuilder.buildAuditPackage(
        auditPack,
        evidence,
        reports,
        correlationId
      );

      // Step 8: Finalize
      await this.updateProgress(auditPack, 'COMPLETED', 8, correlationId);
      auditPack.status = 'COMPLETED';
      auditPack.completedAt = new Date().toISOString();
      auditPack.downloadUrl = packageInfo.downloadUrl;
      auditPack.summary = packageInfo.summary;

      // Update final audit pack record
      await this.storeAuditPackRecord(auditPack, correlationId);

    } catch (error) {
      auditPack.status = 'FAILED';
      auditPack.error = error instanceof Error ? error.message : 'Unknown error';
      await this.storeAuditPackRecord(auditPack, correlationId);
      throw error;
    }
  }

  /**
   * Update audit pack progress
   */
  private async updateProgress(
    auditPack: AuditPackResponse,
    currentStep: string,
    completedSteps: number,
    correlationId: string
  ): Promise<void> {
    auditPack.progress = {
      currentStep,
      completedSteps,
      totalSteps: auditPack.progress?.totalSteps || 8,
      percentage: Math.round((completedSteps / (auditPack.progress?.totalSteps || 8)) * 100)
    };

    await this.storeAuditPackRecord(auditPack, correlationId);

    logger.info('Audit pack progress updated', {
      correlationId,
      auditPackId: auditPack.auditPackId,
      currentStep,
      percentage: auditPack.progress.percentage
    });
  }

  /**
   * Store audit pack record in database
   */
  private async storeAuditPackRecord(auditPack: AuditPackResponse, correlationId: string): Promise<void> {
    // In a real implementation, this would store in DynamoDB
    logger.debug('Storing audit pack record', {
      correlationId,
      auditPackId: auditPack.auditPackId,
      status: auditPack.status
    });
  }

  /**
   * Delete audit pack record from database
   */
  private async deleteAuditPackRecord(auditPackId: string, correlationId: string): Promise<void> {
    // In a real implementation, this would delete from DynamoDB
    logger.debug('Deleting audit pack record', {
      correlationId,
      auditPackId
    });
  }
}
