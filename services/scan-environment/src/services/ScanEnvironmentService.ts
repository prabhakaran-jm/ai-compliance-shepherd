/**
 * Scan Environment Service
 * 
 * Orchestrates the scanning process by coordinating AWS resource discovery,
 * compliance rule execution, and result storage.
 */

import {
  ScanRequest,
  ScanResponse,
  ScanJob,
  ScanStatus,
  ScanType,
  Finding,
  Severity,
  ComplianceFramework,
  FindingStatus,
  Tenant,
  PaginationParams
} from '@compliance-shepherd/shared';
import { RulesEngine } from '@compliance-shepherd/compliance-rules-engine';
import { 
  ScanJobsRepository, 
  FindingsRepository, 
  TenantsRepository 
} from '@compliance-shepherd/data-access-layer';
import { AWSResourceDiscovery } from './AWSResourceDiscovery';
import { ScanResultProcessor } from './ScanResultProcessor';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class ScanEnvironmentService {
  private scanJobsRepo: ScanJobsRepository;
  private findingsRepo: FindingsRepository;
  private tenantsRepo: TenantsRepository;
  private rulesEngine: RulesEngine;
  private resourceDiscovery: AWSResourceDiscovery;
  private resultProcessor: ScanResultProcessor;

  constructor() {
    this.scanJobsRepo = new ScanJobsRepository();
    this.findingsRepo = new FindingsRepository();
    this.tenantsRepo = new TenantsRepository();
    this.rulesEngine = new RulesEngine();
    this.resourceDiscovery = new AWSResourceDiscovery();
    this.resultProcessor = new ScanResultProcessor();
  }

  /**
   * Start a new scan
   */
  async startScan(scanRequest: ScanRequest, requestId: string): Promise<ScanResponse> {
    const scanId = uuidv4();
    const startTime = new Date().toISOString();

    logger.info('Starting scan', {
      scanId,
      requestId,
      tenantId: scanRequest.tenantId,
      scanType: scanRequest.scanType,
      accountId: scanRequest.accountId,
      regions: scanRequest.regions
    });

    try {
      // Validate tenant
      const tenant = await this.tenantsRepo.getById(scanRequest.tenantId, scanRequest.tenantId);
      if (!tenant) {
        throw new Error(`Tenant ${scanRequest.tenantId} not found`);
      }

      // Create scan job
      const scanJob: ScanJob = {
        id: scanId,
        tenantId: scanRequest.tenantId,
        scanType: scanRequest.scanType,
        status: 'initializing',
        accountId: scanRequest.accountId,
        regions: scanRequest.regions,
        services: scanRequest.services || [],
        frameworks: scanRequest.frameworks || [],
        startedAt: startTime,
        progress: {
          current: 0,
          total: 100,
          percentage: 0,
          stage: 'Initializing'
        },
        settings: scanRequest.settings || {},
        requestedBy: scanRequest.requestedBy || 'system',
        metadata: {
          requestId,
          source: 'api',
          ...scanRequest.metadata
        }
      };

      await this.scanJobsRepo.create(scanJob);

      // Start scan asynchronously
      this.executeScan(scanJob).catch(error => {
        logger.error('Scan execution failed', {
          scanId,
          error: error.message,
          stack: error.stack
        });
      });

      return {
        scanId,
        status: 'initializing',
        message: 'Scan started successfully',
        estimatedDuration: this.estimateScanDuration(scanRequest),
        scanUrl: `${process.env.API_BASE_URL}/scans/${scanId}`
      };

    } catch (error) {
      logger.error('Failed to start scan', {
        scanId,
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Update scan job status to failed
      try {
        await this.scanJobsRepo.updateScanJobStatus(scanId, scanRequest.tenantId, 'failed');
      } catch (updateError) {
        logger.error('Failed to update scan job status', {
          scanId,
          error: updateError instanceof Error ? updateError.message : 'Unknown error'
        });
      }

      throw error;
    }
  }

  /**
   * Execute the scan
   */
  private async executeScan(scanJob: ScanJob): Promise<void> {
    const { id: scanId, tenantId } = scanJob;

    try {
      // Update status to in_progress
      await this.scanJobsRepo.updateScanJobStatus(scanId, tenantId, 'in_progress', {
        current: 10,
        total: 100,
        percentage: 10,
        stage: 'Discovering AWS resources'
      });

      // Discover AWS resources
      const resources = await this.resourceDiscovery.discoverResources(scanJob);
      
      await this.scanJobsRepo.updateScanJobProgress(scanId, tenantId, {
        current: 30,
        total: 100,
        percentage: 30,
        stage: 'Executing compliance rules'
      });

      // Execute compliance rules
      const ruleResults = await this.rulesEngine.executeRules(resources, {
        tenantId,
        scanId,
        frameworks: scanJob.frameworks,
        services: scanJob.services
      });

      await this.scanJobsRepo.updateScanJobProgress(scanId, tenantId, {
        current: 70,
        total: 100,
        percentage: 70,
        stage: 'Processing results'
      });

      // Process results and create findings
      const findings = await this.resultProcessor.processResults(ruleResults, scanJob);
      
      // Store findings
      if (findings.length > 0) {
        await this.findingsRepo.batchWrite(findings);
      }

      await this.scanJobsRepo.updateScanJobProgress(scanId, tenantId, {
        current: 90,
        total: 100,
        percentage: 90,
        stage: 'Generating report'
      });

      // Generate scan results
      const results = {
        totalResources: resources.length,
        totalFindings: findings.length,
        findingsBySeverity: this.groupFindingsBySeverity(findings),
        findingsByFramework: this.groupFindingsByFramework(findings),
        findingsByService: this.groupFindingsByService(findings),
        complianceScore: this.calculateComplianceScore(findings, resources.length),
        scanDuration: Date.now() - new Date(scanJob.startedAt).getTime(),
        completedAt: new Date().toISOString()
      };

      // Update scan job with results
      await this.scanJobsRepo.updateScanJobResults(scanId, tenantId, results);
      await this.scanJobsRepo.updateScanJobStatus(scanId, tenantId, 'completed', {
        current: 100,
        total: 100,
        percentage: 100,
        stage: 'Completed'
      });

      logger.info('Scan completed successfully', {
        scanId,
        tenantId,
        totalResources: resources.length,
        totalFindings: findings.length,
        complianceScore: results.complianceScore
      });

    } catch (error) {
      logger.error('Scan execution failed', {
        scanId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Update scan job status to failed
      await this.scanJobsRepo.updateScanJobStatus(scanId, tenantId, 'failed', {
        current: 0,
        total: 100,
        percentage: 0,
        stage: 'Failed'
      });

      // Store error details
      await this.scanJobsRepo.updateScanJobResults(scanId, tenantId, {
        error: error instanceof Error ? error.message : 'Unknown error',
        failedAt: new Date().toISOString()
      });
    }
  }

  /**
   * Get scan status
   */
  async getScanStatus(scanId: string, tenantId: string): Promise<ScanJob | null> {
    return this.scanJobsRepo.getById(scanId, tenantId);
  }

  /**
   * Get scan results
   */
  async getScanResults(scanId: string, tenantId: string): Promise<{
    scanJob: ScanJob;
    findings: Finding[];
    statistics: any;
  } | null> {
    const scanJob = await this.scanJobsRepo.getById(scanId, tenantId);
    if (!scanJob) {
      return null;
    }

    const findings = await this.findingsRepo.getFindingsByTenant(tenantId, {
      scanId
    });

    const statistics = await this.findingsRepo.getFindingStatistics(tenantId);

    return {
      scanJob,
      findings: findings.items,
      statistics
    };
  }

  /**
   * List scans for tenant
   */
  async listScans(tenantId: string, pagination: PaginationParams = {}): Promise<{
    scans: ScanJob[];
    nextToken?: string;
    totalCount?: number;
  }> {
    const result = await this.scanJobsRepo.getScanJobsByTenant(tenantId, pagination);
    return {
      scans: result.items,
      nextToken: result.nextToken,
      totalCount: result.totalCount
    };
  }

  /**
   * Cancel a scan
   */
  async cancelScan(scanId: string, tenantId: string, cancelledBy: string): Promise<void> {
    const scanJob = await this.scanJobsRepo.getById(scanId, tenantId);
    if (!scanJob) {
      throw new Error(`Scan ${scanId} not found`);
    }

    if (scanJob.status === 'completed' || scanJob.status === 'failed' || scanJob.status === 'cancelled') {
      throw new Error(`Cannot cancel scan in ${scanJob.status} status`);
    }

    await this.scanJobsRepo.updateScanJobStatus(scanId, tenantId, 'cancelled', {
      current: 0,
      total: 100,
      percentage: 0,
      stage: 'Cancelled'
    });

    logger.info('Scan cancelled', {
      scanId,
      tenantId,
      cancelledBy
    });
  }

  /**
   * Estimate scan duration
   */
  private estimateScanDuration(scanRequest: ScanRequest): number {
    const baseDuration = 300000; // 5 minutes base
    const regionMultiplier = scanRequest.regions.length * 60000; // 1 minute per region
    const serviceMultiplier = (scanRequest.services?.length || 0) * 30000; // 30 seconds per service
    const frameworkMultiplier = (scanRequest.frameworks?.length || 0) * 60000; // 1 minute per framework

    return baseDuration + regionMultiplier + serviceMultiplier + frameworkMultiplier;
  }

  /**
   * Group findings by severity
   */
  private groupFindingsBySeverity(findings: Finding[]): Record<Severity, number> {
    return findings.reduce((acc, finding) => {
      acc[finding.severity] = (acc[finding.severity] || 0) + 1;
      return acc;
    }, {} as Record<Severity, number>);
  }

  /**
   * Group findings by framework
   */
  private groupFindingsByFramework(findings: Finding[]): Record<ComplianceFramework, number> {
    return findings.reduce((acc, finding) => {
      acc[finding.framework] = (acc[finding.framework] || 0) + 1;
      return acc;
    }, {} as Record<ComplianceFramework, number>);
  }

  /**
   * Group findings by service
   */
  private groupFindingsByService(findings: Finding[]): Record<string, number> {
    return findings.reduce((acc, finding) => {
      acc[finding.service] = (acc[finding.service] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Calculate compliance score
   */
  private calculateComplianceScore(findings: Finding[], totalResources: number): number {
    if (totalResources === 0) return 100;

    const criticalFindings = findings.filter(f => f.severity === 'critical').length;
    const highFindings = findings.filter(f => f.severity === 'high').length;
    const mediumFindings = findings.filter(f => f.severity === 'medium').length;
    const lowFindings = findings.filter(f => f.severity === 'low').length;

    // Weighted scoring: critical = 10, high = 5, medium = 2, low = 1
    const totalWeightedFindings = (criticalFindings * 10) + (highFindings * 5) + (mediumFindings * 2) + lowFindings;
    const maxPossibleWeightedFindings = totalResources * 10; // Assume worst case: all resources have critical findings

    const score = Math.max(0, 100 - (totalWeightedFindings / maxPossibleWeightedFindings) * 100);
    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }
}
