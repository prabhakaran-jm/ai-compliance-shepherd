/**
 * Findings Processor
 * 
 * Processes and stores analysis findings from Terraform plan analysis,
 * including deduplication, severity mapping, and evidence collection.
 */

import { logger } from '../utils/logger';

export interface ProcessedFinding {
  id: string;
  type: 'security' | 'compliance' | 'cost' | 'best_practice';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  resource: string;
  rule: string;
  recommendation: string;
  evidence: any;
  lineNumber?: number;
  filePath?: string;
  framework?: string;
  control?: string;
  category?: string;
  cve?: string;
  potentialSavings?: number;
  processedAt: string;
  tenantId: string;
  userId: string;
  analysisId: string;
}

export class FindingsProcessor {
  /**
   * Process findings from analysis
   */
  async processFindings(
    findings: any[],
    tenantId: string,
    userId: string,
    analysisId: string
  ): Promise<ProcessedFinding[]> {
    try {
      logger.info('Processing analysis findings', {
        totalFindings: findings.length,
        tenantId,
        userId,
        analysisId
      });

      const processedFindings: ProcessedFinding[] = [];

      // Process each finding
      for (const finding of findings) {
        const processedFinding = await this.processFinding(finding, tenantId, userId, analysisId);
        processedFindings.push(processedFinding);
      }

      // Deduplicate findings
      const deduplicatedFindings = this.deduplicateFindings(processedFindings);

      // Sort by severity
      const sortedFindings = this.sortFindingsBySeverity(deduplicatedFindings);

      logger.info('Findings processing completed', {
        originalCount: findings.length,
        processedCount: processedFindings.length,
        deduplicatedCount: deduplicatedFindings.length,
        tenantId,
        userId,
        analysisId
      });

      return sortedFindings;

    } catch (error) {
      logger.error('Findings processing failed', {
        tenantId,
        userId,
        analysisId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Process individual finding
   */
  private async processFinding(
    finding: any,
    tenantId: string,
    userId: string,
    analysisId: string
  ): Promise<ProcessedFinding> {
    try {
      const processedFinding: ProcessedFinding = {
        id: finding.id,
        type: finding.type,
        severity: finding.severity,
        title: finding.title,
        description: finding.description,
        resource: finding.resource,
        rule: finding.rule,
        recommendation: finding.recommendation,
        evidence: finding.evidence,
        lineNumber: finding.lineNumber,
        filePath: finding.filePath,
        framework: finding.framework,
        control: finding.control,
        category: finding.category,
        cve: finding.cve,
        potentialSavings: finding.potentialSavings,
        processedAt: new Date().toISOString(),
        tenantId,
        userId,
        analysisId
      };

      // Enhance evidence with additional context
      processedFinding.evidence = this.enhanceEvidence(processedFinding.evidence, finding);

      // Validate finding data
      this.validateFinding(processedFinding);

      return processedFinding;

    } catch (error) {
      logger.warn('Failed to process individual finding', {
        findingId: finding.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Enhance evidence with additional context
   */
  private enhanceEvidence(evidence: any, originalFinding: any): any {
    const enhancedEvidence = { ...evidence };

    // Add processing metadata
    enhancedEvidence.processedAt = new Date().toISOString();
    enhancedEvidence.processorVersion = '1.0.0';

    // Add resource context
    if (originalFinding.resource) {
      enhancedEvidence.resourceAddress = originalFinding.resource;
      enhancedEvidence.resourceType = originalFinding.evidence?.resourceType;
    }

    // Add rule context
    if (originalFinding.rule) {
      enhancedEvidence.ruleId = originalFinding.rule;
      enhancedEvidence.ruleName = originalFinding.title;
    }

    // Add severity context
    enhancedEvidence.severity = originalFinding.severity;
    enhancedEvidence.severityScore = this.getSeverityScore(originalFinding.severity);

    // Add type-specific enhancements
    switch (originalFinding.type) {
      case 'compliance':
        enhancedEvidence.framework = originalFinding.framework;
        enhancedEvidence.control = originalFinding.control;
        break;

      case 'security':
        enhancedEvidence.category = originalFinding.category;
        enhancedEvidence.cve = originalFinding.cve;
        break;

      case 'cost':
        enhancedEvidence.category = originalFinding.category;
        enhancedEvidence.potentialSavings = originalFinding.potentialSavings;
        break;
    }

    return enhancedEvidence;
  }

  /**
   * Validate finding data
   */
  private validateFinding(finding: ProcessedFinding): void {
    if (!finding.id) {
      throw new Error('Finding ID is required');
    }

    if (!finding.type) {
      throw new Error('Finding type is required');
    }

    if (!finding.severity) {
      throw new Error('Finding severity is required');
    }

    if (!finding.title) {
      throw new Error('Finding title is required');
    }

    if (!finding.description) {
      throw new Error('Finding description is required');
    }

    if (!finding.resource) {
      throw new Error('Finding resource is required');
    }

    if (!finding.rule) {
      throw new Error('Finding rule is required');
    }

    if (!finding.recommendation) {
      throw new Error('Finding recommendation is required');
    }

    if (!finding.evidence) {
      throw new Error('Finding evidence is required');
    }

    // Validate severity
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(finding.severity)) {
      throw new Error(`Invalid severity: ${finding.severity}`);
    }

    // Validate type
    const validTypes = ['security', 'compliance', 'cost', 'best_practice'];
    if (!validTypes.includes(finding.type)) {
      throw new Error(`Invalid type: ${finding.type}`);
    }
  }

  /**
   * Deduplicate findings
   */
  private deduplicateFindings(findings: ProcessedFinding[]): ProcessedFinding[] {
    const seen = new Set<string>();
    const deduplicated: ProcessedFinding[] = [];

    for (const finding of findings) {
      // Create a unique key for deduplication
      const key = `${finding.type}-${finding.resource}-${finding.rule}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(finding);
      } else {
        logger.debug('Deduplicating finding', {
          findingId: finding.id,
          key,
          resource: finding.resource,
          rule: finding.rule
        });
      }
    }

    return deduplicated;
  }

  /**
   * Sort findings by severity
   */
  private sortFindingsBySeverity(findings: ProcessedFinding[]): ProcessedFinding[] {
    const severityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };

    return findings.sort((a, b) => {
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) {
        return severityDiff;
      }

      // If same severity, sort by title
      return a.title.localeCompare(b.title);
    });
  }

  /**
   * Get severity score for numeric comparison
   */
  private getSeverityScore(severity: string): number {
    const scores = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
    return scores[severity as keyof typeof scores] || 0;
  }

  /**
   * Group findings by type
   */
  groupFindingsByType(findings: ProcessedFinding[]): { [type: string]: ProcessedFinding[] } {
    const grouped: { [type: string]: ProcessedFinding[] } = {};

    findings.forEach(finding => {
      if (!grouped[finding.type]) {
        grouped[finding.type] = [];
      }
      grouped[finding.type].push(finding);
    });

    return grouped;
  }

  /**
   * Group findings by severity
   */
  groupFindingsBySeverity(findings: ProcessedFinding[]): { [severity: string]: ProcessedFinding[] } {
    const grouped: { [severity: string]: ProcessedFinding[] } = {};

    findings.forEach(finding => {
      if (!grouped[finding.severity]) {
        grouped[finding.severity] = [];
      }
      grouped[finding.severity].push(finding);
    });

    return grouped;
  }

  /**
   * Group findings by resource
   */
  groupFindingsByResource(findings: ProcessedFinding[]): { [resource: string]: ProcessedFinding[] } {
    const grouped: { [resource: string]: ProcessedFinding[] } = {};

    findings.forEach(finding => {
      if (!grouped[finding.resource]) {
        grouped[finding.resource] = [];
      }
      grouped[finding.resource].push(finding);
    });

    return grouped;
  }

  /**
   * Get findings summary
   */
  getFindingsSummary(findings: ProcessedFinding[]): {
    total: number;
    byType: { [type: string]: number };
    bySeverity: { [severity: string]: number };
    byResource: { [resource: string]: number };
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  } {
    const summary = {
      total: findings.length,
      byType: {} as { [type: string]: number },
      bySeverity: {} as { [severity: string]: number },
      byResource: {} as { [resource: string]: number },
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0
    };

    findings.forEach(finding => {
      // Count by type
      summary.byType[finding.type] = (summary.byType[finding.type] || 0) + 1;

      // Count by severity
      summary.bySeverity[finding.severity] = (summary.bySeverity[finding.severity] || 0) + 1;

      // Count by resource
      summary.byResource[finding.resource] = (summary.byResource[finding.resource] || 0) + 1;

      // Count by severity level
      switch (finding.severity) {
        case 'critical':
          summary.criticalCount++;
          break;
        case 'high':
          summary.highCount++;
          break;
        case 'medium':
          summary.mediumCount++;
          break;
        case 'low':
          summary.lowCount++;
          break;
      }
    });

    return summary;
  }

  /**
   * Filter findings by criteria
   */
  filterFindings(
    findings: ProcessedFinding[],
    criteria: {
      type?: string;
      severity?: string;
      resource?: string;
      rule?: string;
      framework?: string;
      category?: string;
    }
  ): ProcessedFinding[] {
    return findings.filter(finding => {
      if (criteria.type && finding.type !== criteria.type) return false;
      if (criteria.severity && finding.severity !== criteria.severity) return false;
      if (criteria.resource && finding.resource !== criteria.resource) return false;
      if (criteria.rule && finding.rule !== criteria.rule) return false;
      if (criteria.framework && finding.framework !== criteria.framework) return false;
      if (criteria.category && finding.category !== criteria.category) return false;
      return true;
    });
  }

  /**
   * Export findings to different formats
   */
  exportFindings(findings: ProcessedFinding[], format: 'json' | 'csv' | 'markdown'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(findings, null, 2);

      case 'csv':
        return this.exportToCSV(findings);

      case 'markdown':
        return this.exportToMarkdown(findings);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export findings to CSV format
   */
  private exportToCSV(findings: ProcessedFinding[]): string {
    const headers = [
      'ID', 'Type', 'Severity', 'Title', 'Description', 'Resource', 'Rule',
      'Recommendation', 'Framework', 'Control', 'Category', 'CVE', 'Potential Savings',
      'Processed At', 'Tenant ID', 'User ID', 'Analysis ID'
    ];

    const rows = findings.map(finding => [
      finding.id,
      finding.type,
      finding.severity,
      finding.title,
      finding.description,
      finding.resource,
      finding.rule,
      finding.recommendation,
      finding.framework || '',
      finding.control || '',
      finding.category || '',
      finding.cve || '',
      finding.potentialSavings || '',
      finding.processedAt,
      finding.tenantId,
      finding.userId,
      finding.analysisId
    ]);

    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  /**
   * Export findings to Markdown format
   */
  private exportToMarkdown(findings: ProcessedFinding[]): string {
    let markdown = '# Terraform Plan Analysis Findings\n\n';
    markdown += `**Total Findings:** ${findings.length}\n\n`;

    // Summary table
    const summary = this.getFindingsSummary(findings);
    markdown += '## Summary\n\n';
    markdown += '| Severity | Count |\n';
    markdown += '|----------|-------|\n';
    markdown += `| Critical | ${summary.criticalCount} |\n`;
    markdown += `| High | ${summary.highCount} |\n`;
    markdown += `| Medium | ${summary.mediumCount} |\n`;
    markdown += `| Low | ${summary.lowCount} |\n\n`;

    // Findings details
    markdown += '## Findings\n\n';
    findings.forEach((finding, index) => {
      markdown += `### ${index + 1}. ${finding.title}\n\n`;
      markdown += `**Severity:** ${finding.severity}\n\n`;
      markdown += `**Type:** ${finding.type}\n\n`;
      markdown += `**Resource:** ${finding.resource}\n\n`;
      markdown += `**Description:** ${finding.description}\n\n`;
      markdown += `**Recommendation:** ${finding.recommendation}\n\n`;
      
      if (finding.framework) {
        markdown += `**Framework:** ${finding.framework}\n\n`;
      }
      
      if (finding.control) {
        markdown += `**Control:** ${finding.control}\n\n`;
      }
      
      if (finding.category) {
        markdown += `**Category:** ${finding.category}\n\n`;
      }
      
      if (finding.cve) {
        markdown += `**CVE:** ${finding.cve}\n\n`;
      }
      
      if (finding.potentialSavings) {
        markdown += `**Potential Savings:** $${finding.potentialSavings}\n\n`;
      }
      
      markdown += '---\n\n';
    });

    return markdown;
  }
}
