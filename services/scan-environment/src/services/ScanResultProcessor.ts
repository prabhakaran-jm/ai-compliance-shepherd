/**
 * Scan Result Processor
 * 
 * Processes compliance rule results and creates findings for storage.
 */

import {
  Finding,
  Severity,
  ComplianceFramework,
  FindingStatus,
  ScanJob,
  RuleResult,
  RuleContext
} from '@compliance-shepherd/shared';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

export class ScanResultProcessor {
  /**
   * Process rule results and create findings
   */
  async processResults(
    ruleResults: RuleResult[],
    scanJob: ScanJob
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    logger.info('Processing scan results', {
      scanId: scanJob.id,
      ruleResultCount: ruleResults.length
    });

    for (const ruleResult of ruleResults) {
      if (!ruleResult.compliant) {
        const finding = await this.createFinding(ruleResult, scanJob);
        findings.push(finding);
      }
    }

    logger.info('Scan results processed', {
      scanId: scanJob.id,
      totalFindings: findings.length,
      compliantRules: ruleResults.filter(r => r.compliant).length,
      nonCompliantRules: ruleResults.filter(r => !r.compliant).length
    });

    return findings;
  }

  /**
   * Create a finding from a rule result
   */
  private async createFinding(ruleResult: RuleResult, scanJob: ScanJob): Promise<Finding> {
    const findingId = uuidv4();
    const now = new Date().toISOString();

    // Generate hash for deduplication
    const hash = this.generateFindingHash(ruleResult, scanJob);

    const finding: Finding = {
      id: findingId,
      tenantId: scanJob.tenantId,
      scanId: scanJob.id,
      ruleId: ruleResult.ruleId,
      resourceArn: ruleResult.resourceArn,
      resourceType: ruleResult.resourceType,
      service: ruleResult.service,
      region: ruleResult.region,
      accountId: ruleResult.accountId,
      severity: this.mapSeverity(ruleResult.severity),
      framework: this.mapFramework(ruleResult.framework),
      status: 'active' as FindingStatus,
      title: ruleResult.title,
      description: ruleResult.description,
      recommendation: ruleResult.recommendation,
      evidence: ruleResult.evidence,
      tags: this.extractTags(ruleResult, scanJob),
      hash,
      firstSeen: now,
      lastSeen: now,
      count: 1,
      metadata: {
        scanType: scanJob.scanType,
        requestedBy: scanJob.requestedBy,
        ruleVersion: ruleResult.ruleVersion,
        executionTime: ruleResult.executionTime,
        ...ruleResult.metadata
      }
    };

    return finding;
  }

  /**
   * Generate hash for finding deduplication
   */
  private generateFindingHash(ruleResult: RuleResult, scanJob: ScanJob): string {
    const hashInput = {
      ruleId: ruleResult.ruleId,
      resourceArn: ruleResult.resourceArn,
      tenantId: scanJob.tenantId,
      framework: ruleResult.framework
    };

    return createHash('sha256')
      .update(JSON.stringify(hashInput))
      .digest('hex');
  }

  /**
   * Map rule severity to finding severity
   */
  private mapSeverity(ruleSeverity: string): Severity {
    switch (ruleSeverity.toLowerCase()) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Map rule framework to compliance framework
   */
  private mapFramework(ruleFramework: string): ComplianceFramework {
    switch (ruleFramework.toLowerCase()) {
      case 'soc2':
        return 'SOC2';
      case 'hipaa':
        return 'HIPAA';
      case 'gdpr':
        return 'GDPR';
      case 'pci':
        return 'PCI';
      case 'iso27001':
        return 'ISO27001';
      case 'nist':
        return 'NIST';
      default:
        return 'SOC2';
    }
  }

  /**
   * Extract tags from rule result and scan job
   */
  private extractTags(ruleResult: RuleResult, scanJob: ScanJob): string[] {
    const tags: string[] = [];

    // Add service tag
    if (ruleResult.service) {
      tags.push(ruleResult.service);
    }

    // Add framework tag
    if (ruleResult.framework) {
      tags.push(ruleResult.framework);
    }

    // Add severity tag
    if (ruleResult.severity) {
      tags.push(ruleResult.severity);
    }

    // Add scan type tag
    tags.push(scanJob.scanType);

    // Add region tag
    if (ruleResult.region) {
      tags.push(ruleResult.region);
    }

    // Add custom tags from scan job
    if (scanJob.settings?.tags) {
      tags.push(...scanJob.settings.tags);
    }

    // Add custom tags from rule result
    if (ruleResult.metadata?.tags) {
      tags.push(...ruleResult.metadata.tags);
    }

    // Remove duplicates and return
    return [...new Set(tags)];
  }

  /**
   * Group findings by severity
   */
  groupFindingsBySeverity(findings: Finding[]): Record<Severity, number> {
    return findings.reduce((acc, finding) => {
      acc[finding.severity] = (acc[finding.severity] || 0) + 1;
      return acc;
    }, {} as Record<Severity, number>);
  }

  /**
   * Group findings by framework
   */
  groupFindingsByFramework(findings: Finding[]): Record<ComplianceFramework, number> {
    return findings.reduce((acc, finding) => {
      acc[finding.framework] = (acc[finding.framework] || 0) + 1;
      return acc;
    }, {} as Record<ComplianceFramework, number>);
  }

  /**
   * Group findings by service
   */
  groupFindingsByService(findings: Finding[]): Record<string, number> {
    return findings.reduce((acc, finding) => {
      acc[finding.service] = (acc[finding.service] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Group findings by region
   */
  groupFindingsByRegion(findings: Finding[]): Record<string, number> {
    return findings.reduce((acc, finding) => {
      acc[finding.region] = (acc[finding.region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Group findings by resource type
   */
  groupFindingsByResourceType(findings: Finding[]): Record<string, number> {
    return findings.reduce((acc, finding) => {
      acc[finding.resourceType] = (acc[finding.resourceType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Calculate compliance score
   */
  calculateComplianceScore(findings: Finding[], totalResources: number): number {
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

  /**
   * Get top findings by severity
   */
  getTopFindingsBySeverity(findings: Finding[], limit: number = 10): Finding[] {
    const severityOrder = ['critical', 'high', 'medium', 'low'];
    
    return findings
      .sort((a, b) => {
        const aIndex = severityOrder.indexOf(a.severity);
        const bIndex = severityOrder.indexOf(b.severity);
        
        if (aIndex !== bIndex) {
          return aIndex - bIndex;
        }
        
        return new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime();
      })
      .slice(0, limit);
  }

  /**
   * Get findings summary
   */
  getFindingsSummary(findings: Finding[]): {
    total: number;
    bySeverity: Record<Severity, number>;
    byFramework: Record<ComplianceFramework, number>;
    byService: Record<string, number>;
    byRegion: Record<string, number>;
    byResourceType: Record<string, number>;
    topFindings: Finding[];
    complianceScore: number;
  } {
    return {
      total: findings.length,
      bySeverity: this.groupFindingsBySeverity(findings),
      byFramework: this.groupFindingsByFramework(findings),
      byService: this.groupFindingsByService(findings),
      byRegion: this.groupFindingsByRegion(findings),
      byResourceType: this.groupFindingsByResourceType(findings),
      topFindings: this.getTopFindingsBySeverity(findings),
      complianceScore: this.calculateComplianceScore(findings, findings.length)
    };
  }
}
