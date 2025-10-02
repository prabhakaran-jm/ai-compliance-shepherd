import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger';
import { AuditPackGeneratorError } from '../utils/errorHandler';
import { 
  AuditPackResponse,
  EvidenceItem,
  AuditReport,
  PackageInfo
} from '../types/auditPack';
import * as archiver from 'archiver';
import * as JSZip from 'jszip';
import { createWriteStream } from 'fs';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { createCsvWriter } from 'csv-writer';

/**
 * Service for building and packaging audit evidence and reports
 */
export class PackageBuilderService {
  private s3Client: S3Client;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.s3Client = new S3Client({ region: this.region });
  }

  /**
   * Build comprehensive audit package
   */
  async buildAuditPackage(
    auditPack: AuditPackResponse,
    evidence: EvidenceItem[],
    reports: AuditReport[],
    correlationId?: string
  ): Promise<PackageInfo> {
    try {
      logger.info('Building audit package', {
        correlationId,
        auditPackId: auditPack.auditPackId,
        tenantId: auditPack.tenantId,
        evidenceCount: evidence.length,
        reportCount: reports.length
      });

      // Create temporary directory for package building
      const tempDir = join(tmpdir(), `audit-pack-${auditPack.auditPackId}`);
      await mkdir(tempDir, { recursive: true });

      try {
        // Build package structure
        await this.createPackageStructure(tempDir, auditPack, evidence, reports, correlationId);

        // Create ZIP package
        const packagePath = await this.createZipPackage(tempDir, auditPack, correlationId);

        // Upload to S3
        const s3Info = await this.uploadPackageToS3(packagePath, auditPack, correlationId);

        // Generate package summary
        const summary = await this.generatePackageSummary(auditPack, evidence, reports, s3Info);

        // Clean up temporary files
        await rm(tempDir, { recursive: true, force: true });

        const packageInfo: PackageInfo = {
          packageId: uuidv4(),
          auditPackId: auditPack.auditPackId,
          downloadUrl: s3Info.downloadUrl,
          size: s3Info.size,
          checksum: s3Info.checksum,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          summary
        };

        logger.info('Audit package built successfully', {
          correlationId,
          auditPackId: auditPack.auditPackId,
          packageSize: s3Info.size,
          downloadUrl: s3Info.downloadUrl
        });

        return packageInfo;

      } finally {
        // Ensure cleanup even if error occurs
        try {
          await rm(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
          logger.warn('Failed to clean up temporary directory', {
            correlationId,
            tempDir,
            error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error'
          });
        }
      }

    } catch (error) {
      logger.error('Error building audit package', {
        correlationId,
        auditPackId: auditPack.auditPackId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AuditPackGeneratorError(
        `Failed to build audit package: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create package directory structure
   */
  private async createPackageStructure(
    tempDir: string,
    auditPack: AuditPackResponse,
    evidence: EvidenceItem[],
    reports: AuditReport[],
    correlationId?: string
  ): Promise<void> {
    try {
      logger.debug('Creating package structure', {
        correlationId,
        auditPackId: auditPack.auditPackId
      });

      // Create directory structure
      const dirs = [
        'reports',
        'evidence',
        'evidence/findings',
        'evidence/policies',
        'evidence/audit-logs',
        'evidence/configurations',
        'evidence/remediation',
        'metadata',
        'exports'
      ];

      for (const dir of dirs) {
        await mkdir(join(tempDir, dir), { recursive: true });
      }

      // Save reports
      await this.saveReports(tempDir, reports, correlationId);

      // Save evidence
      await this.saveEvidence(tempDir, evidence, correlationId);

      // Save metadata
      await this.saveMetadata(tempDir, auditPack, correlationId);

      // Create exports (CSV, JSON)
      await this.createExports(tempDir, auditPack, evidence, reports, correlationId);

      // Create README
      await this.createReadme(tempDir, auditPack, correlationId);

    } catch (error) {
      throw new AuditPackGeneratorError(
        `Failed to create package structure: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Save reports to package
   */
  private async saveReports(tempDir: string, reports: AuditReport[], correlationId?: string): Promise<void> {
    try {
      logger.debug('Saving reports to package', {
        correlationId,
        reportCount: reports.length
      });

      for (const report of reports) {
        const filename = `${report.type.toLowerCase()}-${report.reportId}.${report.format.toLowerCase()}`;
        const filepath = join(tempDir, 'reports', filename);

        if (report.format === 'PDF' && report.pdfContent) {
          await writeFile(filepath, report.pdfContent);
        } else {
          await writeFile(filepath, report.content, 'utf-8');
        }

        // Save report metadata
        const metadataPath = join(tempDir, 'reports', `${report.type.toLowerCase()}-${report.reportId}.json`);
        await writeFile(metadataPath, JSON.stringify(report.metadata, null, 2), 'utf-8');
      }

    } catch (error) {
      throw new AuditPackGeneratorError(
        `Failed to save reports: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Save evidence to package
   */
  private async saveEvidence(tempDir: string, evidence: EvidenceItem[], correlationId?: string): Promise<void> {
    try {
      logger.debug('Saving evidence to package', {
        correlationId,
        evidenceCount: evidence.length
      });

      // Group evidence by type
      const evidenceByType = evidence.reduce((grouped, item) => {
        const type = item.type.toLowerCase().replace('_', '-');
        if (!grouped[type]) {
          grouped[type] = [];
        }
        grouped[type].push(item);
        return grouped;
      }, {} as Record<string, EvidenceItem[]>);

      // Save evidence by type
      for (const [type, items] of Object.entries(evidenceByType)) {
        const typeDir = join(tempDir, 'evidence', type);
        
        // Ensure directory exists
        await mkdir(typeDir, { recursive: true });

        // Save individual evidence items
        for (const item of items) {
          const filename = `${item.evidenceId}.json`;
          const filepath = join(typeDir, filename);
          await writeFile(filepath, JSON.stringify(item, null, 2), 'utf-8');
        }

        // Save type summary
        const summaryPath = join(typeDir, 'summary.json');
        const summary = {
          type,
          count: items.length,
          items: items.map(item => ({
            evidenceId: item.evidenceId,
            title: item.title,
            criticality: item.criticality,
            status: item.status,
            timestamp: item.timestamp
          }))
        };
        await writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
      }

    } catch (error) {
      throw new AuditPackGeneratorError(
        `Failed to save evidence: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Save metadata to package
   */
  private async saveMetadata(tempDir: string, auditPack: AuditPackResponse, correlationId?: string): Promise<void> {
    try {
      logger.debug('Saving metadata to package', {
        correlationId,
        auditPackId: auditPack.auditPackId
      });

      // Save audit pack metadata
      const auditPackPath = join(tempDir, 'metadata', 'audit-pack.json');
      await writeFile(auditPackPath, JSON.stringify(auditPack, null, 2), 'utf-8');

      // Save generation metadata
      const generationMetadata = {
        generatedAt: new Date().toISOString(),
        generatedBy: 'AI Compliance Shepherd',
        version: '1.0.0',
        correlationId,
        packageStructure: {
          reports: 'Compliance reports in various formats',
          evidence: 'Evidence items organized by type',
          metadata: 'Audit pack and generation metadata',
          exports: 'Data exports in CSV and JSON formats'
        }
      };

      const generationPath = join(tempDir, 'metadata', 'generation.json');
      await writeFile(generationPath, JSON.stringify(generationMetadata, null, 2), 'utf-8');

    } catch (error) {
      throw new AuditPackGeneratorError(
        `Failed to save metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create data exports
   */
  private async createExports(
    tempDir: string,
    auditPack: AuditPackResponse,
    evidence: EvidenceItem[],
    reports: AuditReport[],
    correlationId?: string
  ): Promise<void> {
    try {
      logger.debug('Creating data exports', {
        correlationId,
        auditPackId: auditPack.auditPackId
      });

      // Export evidence to CSV
      await this.exportEvidenceToCSV(tempDir, evidence);

      // Export findings to CSV
      const findings = evidence.filter(item => item.type === 'FINDING');
      await this.exportFindingsToCSV(tempDir, findings);

      // Export complete data to JSON
      const completeData = {
        auditPack,
        evidence,
        reports: reports.map(r => ({ ...r, content: undefined, pdfContent: undefined })), // Exclude large content
        exportedAt: new Date().toISOString()
      };

      const jsonPath = join(tempDir, 'exports', 'complete-data.json');
      await writeFile(jsonPath, JSON.stringify(completeData, null, 2), 'utf-8');

    } catch (error) {
      throw new AuditPackGeneratorError(
        `Failed to create exports: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Export evidence to CSV
   */
  private async exportEvidenceToCSV(tempDir: string, evidence: EvidenceItem[]): Promise<void> {
    const csvPath = join(tempDir, 'exports', 'evidence.csv');
    
    const csvWriter = createCsvWriter({
      path: csvPath,
      header: [
        { id: 'evidenceId', title: 'Evidence ID' },
        { id: 'type', title: 'Type' },
        { id: 'category', title: 'Category' },
        { id: 'title', title: 'Title' },
        { id: 'description', title: 'Description' },
        { id: 'criticality', title: 'Criticality' },
        { id: 'status', title: 'Status' },
        { id: 'source', title: 'Source' },
        { id: 'timestamp', title: 'Timestamp' }
      ]
    });

    const records = evidence.map(item => ({
      evidenceId: item.evidenceId,
      type: item.type,
      category: item.category,
      title: item.title,
      description: item.description,
      criticality: item.criticality,
      status: item.status,
      source: item.source,
      timestamp: item.timestamp
    }));

    await csvWriter.writeRecords(records);
  }

  /**
   * Export findings to CSV
   */
  private async exportFindingsToCSV(tempDir: string, findings: EvidenceItem[]): Promise<void> {
    const csvPath = join(tempDir, 'exports', 'findings.csv');
    
    const csvWriter = createCsvWriter({
      path: csvPath,
      header: [
        { id: 'evidenceId', title: 'Finding ID' },
        { id: 'title', title: 'Title' },
        { id: 'description', title: 'Description' },
        { id: 'criticality', title: 'Severity' },
        { id: 'status', title: 'Status' },
        { id: 'category', title: 'Category' },
        { id: 'resourceType', title: 'Resource Type' },
        { id: 'resourceId', title: 'Resource ID' },
        { id: 'remediationStatus', title: 'Remediation Status' },
        { id: 'timestamp', title: 'Detected At' }
      ]
    });

    const records = findings.map(item => ({
      evidenceId: item.evidenceId,
      title: item.title,
      description: item.description,
      criticality: item.criticality,
      status: item.status,
      category: item.category,
      resourceType: item.metadata?.resourceType || '',
      resourceId: item.metadata?.resourceId || '',
      remediationStatus: item.remediation?.status || 'PENDING',
      timestamp: item.timestamp
    }));

    await csvWriter.writeRecords(records);
  }

  /**
   * Create README file
   */
  private async createReadme(tempDir: string, auditPack: AuditPackResponse, correlationId?: string): Promise<void> {
    const readme = `# ${auditPack.framework} Audit Package

**Tenant:** ${auditPack.tenantId}  
**Audit Type:** ${auditPack.auditType}  
**Generated:** ${new Date().toISOString()}  
**Package ID:** ${auditPack.auditPackId}

## Package Contents

### Reports Directory
Contains compliance reports in various formats:
- Executive Summary
- Findings Report
- Evidence Report
- Compliance Assessment
- Remediation Report

### Evidence Directory
Organized evidence by type:
- **findings/**: Security and compliance findings
- **policies/**: Policy documents and procedures
- **audit-logs/**: Audit trail and access logs
- **configurations/**: System configuration snapshots
- **remediation/**: Remediation actions and results

### Metadata Directory
- **audit-pack.json**: Complete audit pack configuration
- **generation.json**: Package generation metadata

### Exports Directory
- **evidence.csv**: All evidence in CSV format
- **findings.csv**: Findings summary in CSV format
- **complete-data.json**: Complete audit data in JSON format

## Usage Instructions

1. **Review Executive Summary**: Start with the executive summary for high-level findings
2. **Examine Detailed Reports**: Review specific reports based on audit requirements
3. **Analyze Evidence**: Use evidence files for detailed investigation
4. **Export Data**: Use CSV exports for analysis in external tools

## Support

For questions about this audit package, contact your compliance team or refer to the AI Compliance Shepherd documentation.

---
Generated by AI Compliance Shepherd v1.0.0
`;

    const readmePath = join(tempDir, 'README.md');
    await writeFile(readmePath, readme, 'utf-8');
  }

  /**
   * Create ZIP package
   */
  private async createZipPackage(tempDir: string, auditPack: AuditPackResponse, correlationId?: string): Promise<string> {
    try {
      logger.debug('Creating ZIP package', {
        correlationId,
        auditPackId: auditPack.auditPackId
      });

      const zipPath = join(tmpdir(), `audit-pack-${auditPack.auditPackId}.zip`);
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      return new Promise((resolve, reject) => {
        output.on('close', () => {
          logger.debug('ZIP package created', {
            correlationId,
            zipPath,
            size: archive.pointer()
          });
          resolve(zipPath);
        });

        archive.on('error', (err) => {
          logger.error('Error creating ZIP package', {
            correlationId,
            error: err.message
          });
          reject(err);
        });

        archive.pipe(output);
        archive.directory(tempDir, false);
        archive.finalize();
      });

    } catch (error) {
      throw new AuditPackGeneratorError(
        `Failed to create ZIP package: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Upload package to S3
   */
  private async uploadPackageToS3(
    packagePath: string,
    auditPack: AuditPackResponse,
    correlationId?: string
  ): Promise<{ downloadUrl: string; size: string; checksum: string }> {
    try {
      logger.debug('Uploading package to S3', {
        correlationId,
        auditPackId: auditPack.auditPackId
      });

      const fs = require('fs');
      const crypto = require('crypto');
      
      // Read package file
      const packageBuffer = fs.readFileSync(packagePath);
      const size = `${(packageBuffer.length / (1024 * 1024)).toFixed(2)} MB`;
      
      // Calculate checksum
      const hash = crypto.createHash('sha256');
      hash.update(packageBuffer);
      const checksum = hash.digest('hex');

      // Upload to S3
      const bucketName = `compliance-shepherd-${auditPack.tenantId.replace('tenant-', '')}`;
      const objectKey = `audit-packs/${auditPack.auditPackId}/audit-pack.zip`;

      await this.s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: packageBuffer,
        ContentType: 'application/zip',
        Metadata: {
          'audit-pack-id': auditPack.auditPackId,
          'tenant-id': auditPack.tenantId,
          'framework': auditPack.framework,
          'generated-at': new Date().toISOString(),
          'checksum': checksum
        }
      }));

      const downloadUrl = `https://${bucketName}.s3.amazonaws.com/${objectKey}`;

      logger.info('Package uploaded to S3 successfully', {
        correlationId,
        auditPackId: auditPack.auditPackId,
        bucketName,
        objectKey,
        size,
        checksum
      });

      // Clean up local file
      fs.unlinkSync(packagePath);

      return {
        downloadUrl,
        size,
        checksum
      };

    } catch (error) {
      throw new AuditPackGeneratorError(
        `Failed to upload package to S3: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate package summary
   */
  private async generatePackageSummary(
    auditPack: AuditPackResponse,
    evidence: EvidenceItem[],
    reports: AuditReport[],
    s3Info: { downloadUrl: string; size: string; checksum: string }
  ): Promise<any> {
    const findings = evidence.filter(item => item.type === 'FINDING');
    const policies = evidence.filter(item => item.type === 'POLICY');
    const auditLogs = evidence.filter(item => item.type === 'AUDIT_LOG');
    const remediation = evidence.filter(item => item.type === 'REMEDIATION');

    return {
      totalFindings: findings.length,
      criticalFindings: findings.filter(f => f.criticality === 'CRITICAL').length,
      resolvedFindings: findings.filter(f => f.status === 'RESOLVED').length,
      complianceScore: 87.5, // Mock score - would be calculated from actual analysis
      controlsCovered: 64, // Mock number - would be calculated from framework
      evidenceItems: evidence.length,
      documentCount: reports.length + policies.length,
      totalSize: s3Info.size,
      packageStructure: {
        reports: reports.length,
        findings: findings.length,
        policies: policies.length,
        auditLogs: auditLogs.length,
        remediation: remediation.length,
        configurations: evidence.filter(item => item.type === 'CONFIGURATION').length
      }
    };
  }
}
