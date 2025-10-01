/**
 * Report Template Engine
 * 
 * Handles HTML template compilation and rendering for compliance reports
 * using Handlebars templates with dynamic content generation.
 */

import * as Handlebars from 'handlebars';
import { logger } from '../utils/logger';
import { ReportDataService } from './ReportDataService';

export interface ReportTemplateData {
  reportId: string;
  scanData: any;
  findings: any[];
  reportType: 'executive' | 'detailed' | 'technical' | 'remediation';
  includeCharts: boolean;
  includeRemediation: boolean;
  customSections?: string[];
  generatedBy: string;
  generatedAt: string;
}

export interface ReportSection {
  id: string;
  title: string;
  content: string;
  order: number;
  visible: boolean;
}

export class ReportTemplateEngine {
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private dataService: ReportDataService;

  constructor() {
    this.dataService = new ReportDataService();
    this.registerHelpers();
    this.loadTemplates();
  }

  /**
   * Generate complete HTML report
   */
  async generateReport(data: ReportTemplateData): Promise<string> {
    try {
      logger.info('Generating report template', {
        reportId: data.reportId,
        reportType: data.reportType,
        findingsCount: data.findings.length
      });

      // Get base template
      const baseTemplate = this.getTemplate('base');
      if (!baseTemplate) {
        throw new Error('Base template not found');
      }

      // Generate report sections
      const sections = await this.generateSections(data);

      // Prepare template data
      const templateData = {
        ...data,
        sections,
        summary: this.generateSummary(data),
        charts: data.includeCharts ? this.generateCharts(data) : null,
        metadata: this.generateMetadata(data)
      };

      // Render the report
      const html = baseTemplate(templateData);

      logger.info('Report template generated successfully', {
        reportId: data.reportId,
        sectionsCount: sections.length,
        htmlSize: html.length
      });

      return html;

    } catch (error) {
      logger.error('Failed to generate report template', {
        reportId: data.reportId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate report sections based on type
   */
  private async generateSections(data: ReportTemplateData): Promise<ReportSection[]> {
    const sections: ReportSection[] = [];

    // Executive Summary (always included)
    sections.push({
      id: 'executive-summary',
      title: 'Executive Summary',
      content: await this.generateExecutiveSummary(data),
      order: 1,
      visible: true
    });

    // Compliance Overview
    sections.push({
      id: 'compliance-overview',
      title: 'Compliance Overview',
      content: await this.generateComplianceOverview(data),
      order: 2,
      visible: true
    });

    // Findings Summary
    sections.push({
      id: 'findings-summary',
      title: 'Findings Summary',
      content: await this.generateFindingsSummary(data),
      order: 3,
      visible: true
    });

    // Detailed Findings (for detailed and technical reports)
    if (data.reportType === 'detailed' || data.reportType === 'technical') {
      sections.push({
        id: 'detailed-findings',
        title: 'Detailed Findings',
        content: await this.generateDetailedFindings(data),
        order: 4,
        visible: true
      });
    }

    // Technical Details (for technical reports)
    if (data.reportType === 'technical') {
      sections.push({
        id: 'technical-details',
        title: 'Technical Details',
        content: await this.generateTechnicalDetails(data),
        order: 5,
        visible: true
      });
    }

    // Remediation Guidance (if requested)
    if (data.includeRemediation) {
      sections.push({
        id: 'remediation-guidance',
        title: 'Remediation Guidance',
        content: await this.generateRemediationGuidance(data),
        order: 6,
        visible: true
      });
    }

    // Custom sections
    if (data.customSections && data.customSections.length > 0) {
      for (const sectionId of data.customSections) {
        const customSection = await this.generateCustomSection(sectionId, data);
        if (customSection) {
          sections.push(customSection);
        }
      }
    }

    // Appendices
    sections.push({
      id: 'appendices',
      title: 'Appendices',
      content: await this.generateAppendices(data),
      order: 999,
      visible: true
    });

    return sections.sort((a, b) => a.order - b.order);
  }

  /**
   * Generate executive summary section
   */
  private async generateExecutiveSummary(data: ReportTemplateData): Promise<string> {
    const template = this.getTemplate('executive-summary');
    if (!template) {
      return '<p>Executive summary template not available.</p>';
    }

    const summaryData = {
      scanData: data.scanData,
      findings: data.findings,
      totalFindings: data.findings.length,
      criticalFindings: data.findings.filter(f => f.severity === 'critical').length,
      highFindings: data.findings.filter(f => f.severity === 'high').length,
      mediumFindings: data.findings.filter(f => f.severity === 'medium').length,
      lowFindings: data.findings.filter(f => f.severity === 'low').length,
      complianceScore: data.scanData?.complianceScore || 0,
      frameworks: data.scanData?.frameworks || [],
      regions: data.scanData?.regions || [],
      services: data.scanData?.services || []
    };

    return template(summaryData);
  }

  /**
   * Generate compliance overview section
   */
  private async generateComplianceOverview(data: ReportTemplateData): Promise<string> {
    const template = this.getTemplate('compliance-overview');
    if (!template) {
      return '<p>Compliance overview template not available.</p>';
    }

    const overviewData = {
      scanData: data.scanData,
      frameworks: data.scanData?.frameworks || [],
      complianceScore: data.scanData?.complianceScore || 0,
      totalResources: data.scanData?.totalResources || 0,
      passedChecks: data.scanData?.results?.passed || 0,
      failedChecks: data.scanData?.results?.failed || 0,
      skippedChecks: data.scanData?.results?.skipped || 0
    };

    return template(overviewData);
  }

  /**
   * Generate findings summary section
   */
  private async generateFindingsSummary(data: ReportTemplateData): Promise<string> {
    const template = this.getTemplate('findings-summary');
    if (!template) {
      return '<p>Findings summary template not available.</p>';
    }

    const summaryData = {
      findings: data.findings,
      totalFindings: data.findings.length,
      bySeverity: this.groupFindingsBySeverity(data.findings),
      byService: this.groupFindingsByService(data.findings),
      byFramework: this.groupFindingsByFramework(data.findings),
      byRegion: this.groupFindingsByRegion(data.findings)
    };

    return template(summaryData);
  }

  /**
   * Generate detailed findings section
   */
  private async generateDetailedFindings(data: ReportTemplateData): Promise<string> {
    const template = this.getTemplate('detailed-findings');
    if (!template) {
      return '<p>Detailed findings template not available.</p>';
    }

    const detailedData = {
      findings: data.findings,
      totalFindings: data.findings.length,
      groupedFindings: this.groupFindingsForDetailedView(data.findings)
    };

    return template(detailedData);
  }

  /**
   * Generate technical details section
   */
  private async generateTechnicalDetails(data: ReportTemplateData): Promise<string> {
    const template = this.getTemplate('technical-details');
    if (!template) {
      return '<p>Technical details template not available.</p>';
    }

    const technicalData = {
      scanData: data.scanData,
      findings: data.findings,
      scanDuration: data.scanData?.duration || 0,
      scanStartedAt: data.scanData?.startedAt,
      scanCompletedAt: data.scanData?.completedAt,
      regions: data.scanData?.regions || [],
      services: data.scanData?.services || []
    };

    return template(technicalData);
  }

  /**
   * Generate remediation guidance section
   */
  private async generateRemediationGuidance(data: ReportTemplateData): Promise<string> {
    const template = this.getTemplate('remediation-guidance');
    if (!template) {
      return '<p>Remediation guidance template not available.</p>';
    }

    const remediationData = {
      findings: data.findings,
      criticalFindings: data.findings.filter(f => f.severity === 'critical'),
      highFindings: data.findings.filter(f => f.severity === 'high'),
      remediationSteps: this.generateRemediationSteps(data.findings),
      priorityMatrix: this.generatePriorityMatrix(data.findings)
    };

    return template(remediationData);
  }

  /**
   * Generate custom section
   */
  private async generateCustomSection(sectionId: string, data: ReportTemplateData): Promise<ReportSection | null> {
    const template = this.getTemplate(`custom-${sectionId}`);
    if (!template) {
      logger.warn('Custom section template not found', { sectionId });
      return null;
    }

    const content = template(data);
    return {
      id: `custom-${sectionId}`,
      title: this.formatSectionTitle(sectionId),
      content,
      order: 100, // Custom sections come after standard sections
      visible: true
    };
  }

  /**
   * Generate appendices section
   */
  private async generateAppendices(data: ReportTemplateData): Promise<string> {
    const template = this.getTemplate('appendices');
    if (!template) {
      return '<p>Appendices template not available.</p>';
    }

    const appendicesData = {
      scanData: data.scanData,
      findings: data.findings,
      generatedAt: data.generatedAt,
      generatedBy: data.generatedBy,
      reportId: data.reportId
    };

    return template(appendicesData);
  }

  /**
   * Generate report summary
   */
  private generateSummary(data: ReportTemplateData): any {
    return {
      totalFindings: data.findings.length,
      criticalFindings: data.findings.filter(f => f.severity === 'critical').length,
      highFindings: data.findings.filter(f => f.severity === 'high').length,
      mediumFindings: data.findings.filter(f => f.severity === 'medium').length,
      lowFindings: data.findings.filter(f => f.severity === 'low').length,
      complianceScore: data.scanData?.complianceScore || 0,
      frameworks: data.scanData?.frameworks || [],
      regions: data.scanData?.regions || [],
      services: data.scanData?.services || []
    };
  }

  /**
   * Generate charts data
   */
  private generateCharts(data: ReportTemplateData): any {
    return {
      findingsBySeverity: this.groupFindingsBySeverity(data.findings),
      findingsByService: this.groupFindingsByService(data.findings),
      findingsByFramework: this.groupFindingsByFramework(data.findings),
      findingsByRegion: this.groupFindingsByRegion(data.findings),
      complianceScore: data.scanData?.complianceScore || 0,
      trendData: this.generateTrendData(data.findings)
    };
  }

  /**
   * Generate metadata
   */
  private generateMetadata(data: ReportTemplateData): any {
    return {
      reportId: data.reportId,
      reportType: data.reportType,
      generatedAt: data.generatedAt,
      generatedBy: data.generatedBy,
      scanId: data.scanData?.scanId,
      scanStartedAt: data.scanData?.startedAt,
      scanCompletedAt: data.scanData?.completedAt,
      version: process.env.VERSION || '1.0.0'
    };
  }

  /**
   * Group findings by severity
   */
  private groupFindingsBySeverity(findings: any[]): any {
    const groups = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    findings.forEach(finding => {
      if (groups[finding.severity] !== undefined) {
        groups[finding.severity]++;
      }
    });

    return groups;
  }

  /**
   * Group findings by service
   */
  private groupFindingsByService(findings: any[]): any {
    const groups: { [key: string]: number } = {};
    
    findings.forEach(finding => {
      const service = finding.service || 'unknown';
      groups[service] = (groups[service] || 0) + 1;
    });

    return groups;
  }

  /**
   * Group findings by framework
   */
  private groupFindingsByFramework(findings: any[]): any {
    const groups: { [key: string]: number } = {};
    
    findings.forEach(finding => {
      const frameworks = finding.frameworks || [];
      frameworks.forEach((framework: string) => {
        groups[framework] = (groups[framework] || 0) + 1;
      });
    });

    return groups;
  }

  /**
   * Group findings by region
   */
  private groupFindingsByRegion(findings: any[]): any {
    const groups: { [key: string]: number } = {};
    
    findings.forEach(finding => {
      const region = finding.region || 'unknown';
      groups[region] = (groups[region] || 0) + 1;
    });

    return groups;
  }

  /**
   * Group findings for detailed view
   */
  private groupFindingsForDetailedView(findings: any[]): any {
    const groups: { [key: string]: any[] } = {};
    
    findings.forEach(finding => {
      const severity = finding.severity || 'unknown';
      if (!groups[severity]) {
        groups[severity] = [];
      }
      groups[severity].push(finding);
    });

    return groups;
  }

  /**
   * Generate remediation steps
   */
  private generateRemediationSteps(findings: any[]): any[] {
    const steps: any[] = [];
    
    findings.forEach(finding => {
      if (finding.remediation && finding.remediation.steps) {
        steps.push({
          findingId: finding.findingId,
          title: finding.title,
          severity: finding.severity,
          steps: finding.remediation.steps,
          automated: finding.remediation.automated || false
        });
      }
    });

    return steps.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Generate priority matrix
   */
  private generatePriorityMatrix(findings: any[]): any {
    const matrix: { [key: string]: { [key: string]: number } } = {};
    
    findings.forEach(finding => {
      const severity = finding.severity || 'unknown';
      const service = finding.service || 'unknown';
      
      if (!matrix[severity]) {
        matrix[severity] = {};
      }
      
      matrix[severity][service] = (matrix[severity][service] || 0) + 1;
    });

    return matrix;
  }

  /**
   * Generate trend data
   */
  private generateTrendData(findings: any[]): any {
    // In a real implementation, this would fetch historical data
    // For now, return mock trend data
    return {
      complianceScore: [85, 82, 78, 73, 75],
      findingsCount: [12, 15, 18, 22, 20],
      criticalFindings: [2, 3, 4, 5, 4],
      highFindings: [3, 4, 5, 6, 5]
    };
  }

  /**
   * Format section title
   */
  private formatSectionTitle(sectionId: string): string {
    return sectionId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get template by name
   */
  private getTemplate(name: string): HandlebarsTemplateDelegate | null {
    return this.templates.get(name) || null;
  }

  /**
   * Load all templates
   */
  private loadTemplates(): void {
    // In a real implementation, templates would be loaded from files
    // For now, we'll create basic templates programmatically
    
    this.templates.set('base', Handlebars.compile(this.getBaseTemplate()));
    this.templates.set('executive-summary', Handlebars.compile(this.getExecutiveSummaryTemplate()));
    this.templates.set('compliance-overview', Handlebars.compile(this.getComplianceOverviewTemplate()));
    this.templates.set('findings-summary', Handlebars.compile(this.getFindingsSummaryTemplate()));
    this.templates.set('detailed-findings', Handlebars.compile(this.getDetailedFindingsTemplate()));
    this.templates.set('technical-details', Handlebars.compile(this.getTechnicalDetailsTemplate()));
    this.templates.set('remediation-guidance', Handlebars.compile(this.getRemediationGuidanceTemplate()));
    this.templates.set('appendices', Handlebars.compile(this.getAppendicesTemplate()));
  }

  /**
   * Register Handlebars helpers
   */
  private registerHelpers(): void {
    // Date formatting helper
    Handlebars.registerHelper('formatDate', (date: string) => {
      return new Date(date).toLocaleDateString();
    });

    // Severity color helper
    Handlebars.registerHelper('severityColor', (severity: string) => {
      const colors = {
        critical: 'danger',
        high: 'warning',
        medium: 'info',
        low: 'success'
      };
      return colors[severity] || 'secondary';
    });

    // Percentage helper
    Handlebars.registerHelper('percentage', (value: number, total: number) => {
      return total > 0 ? Math.round((value / total) * 100) : 0;
    });

    // Conditional helper
    Handlebars.registerHelper('if_eq', function(a: any, b: any, options: any) {
      return a === b ? options.fn(this) : options.inverse(this);
    });
  }

  /**
   * Get base template
   */
  private getBaseTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Compliance Report - {{scanData.scanId}}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        .report-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .severity-critical { color: #dc3545; }
        .severity-high { color: #fd7e14; }
        .severity-medium { color: #ffc107; }
        .severity-low { color: #198754; }
        .compliance-score { font-size: 2rem; font-weight: bold; }
        .chart-container { height: 300px; }
        .finding-card { border-left: 4px solid; }
        .finding-critical { border-left-color: #dc3545; }
        .finding-high { border-left-color: #fd7e14; }
        .finding-medium { border-left-color: #ffc107; }
        .finding-low { border-left-color: #198754; }
    </style>
</head>
<body>
    <div class="container-fluid">
        <!-- Report Header -->
        <div class="report-header p-4 mb-4">
            <div class="row">
                <div class="col-md-8">
                    <h1 class="mb-0">Compliance Report</h1>
                    <p class="mb-0">Scan ID: {{scanData.scanId}}</p>
                    <p class="mb-0">Generated: {{formatDate generatedAt}}</p>
                </div>
                <div class="col-md-4 text-end">
                    <div class="compliance-score">{{complianceScore}}%</div>
                    <p class="mb-0">Compliance Score</p>
                </div>
            </div>
        </div>

        <!-- Report Content -->
        <div class="row">
            <div class="col-md-3">
                <!-- Table of Contents -->
                <div class="card">
                    <div class="card-header">
                        <h5>Table of Contents</h5>
                    </div>
                    <div class="card-body">
                        <ul class="list-unstyled">
                            {{#each sections}}
                            <li class="mb-2">
                                <a href="#{{id}}" class="text-decoration-none">{{title}}</a>
                            </li>
                            {{/each}}
                        </ul>
                    </div>
                </div>
            </div>
            <div class="col-md-9">
                <!-- Report Sections -->
                {{#each sections}}
                <div id="{{id}}" class="mb-5">
                    <h2>{{title}}</h2>
                    {{{content}}}
                </div>
                {{/each}}
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</body>
</html>
    `;
  }

  /**
   * Get executive summary template
   */
  private getExecutiveSummaryTemplate(): string {
    return `
<div class="row">
    <div class="col-md-6">
        <div class="card">
            <div class="card-header">
                <h5>Scan Overview</h5>
            </div>
            <div class="card-body">
                <p><strong>Scan ID:</strong> {{scanData.scanId}}</p>
                <p><strong>Frameworks:</strong> {{#each frameworks}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}</p>
                <p><strong>Regions:</strong> {{#each regions}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}</p>
                <p><strong>Services:</strong> {{#each services}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}</p>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card">
            <div class="card-header">
                <h5>Findings Summary</h5>
            </div>
            <div class="card-body">
                <p><strong>Total Findings:</strong> {{totalFindings}}</p>
                <p class="severity-critical"><strong>Critical:</strong> {{criticalFindings}}</p>
                <p class="severity-high"><strong>High:</strong> {{highFindings}}</p>
                <p class="severity-medium"><strong>Medium:</strong> {{mediumFindings}}</p>
                <p class="severity-low"><strong>Low:</strong> {{lowFindings}}</p>
            </div>
        </div>
    </div>
</div>
    `;
  }

  /**
   * Get compliance overview template
   */
  private getComplianceOverviewTemplate(): string {
    return `
<div class="row">
    <div class="col-md-4">
        <div class="card text-center">
            <div class="card-body">
                <h3 class="text-success">{{complianceScore}}%</h3>
                <p class="card-text">Compliance Score</p>
            </div>
        </div>
    </div>
    <div class="col-md-4">
        <div class="card text-center">
            <div class="card-body">
                <h3 class="text-primary">{{totalResources}}</h3>
                <p class="card-text">Total Resources</p>
            </div>
        </div>
    </div>
    <div class="col-md-4">
        <div class="card text-center">
            <div class="card-body">
                <h3 class="text-info">{{passedChecks}}</h3>
                <p class="card-text">Passed Checks</p>
            </div>
        </div>
    </div>
</div>
    `;
  }

  /**
   * Get findings summary template
   */
  private getFindingsSummaryTemplate(): string {
    return `
<div class="row">
    <div class="col-md-6">
        <h5>Findings by Severity</h5>
        <ul class="list-group">
            {{#each bySeverity}}
            <li class="list-group-item d-flex justify-content-between align-items-center">
                {{@key}}
                <span class="badge bg-primary rounded-pill">{{this}}</span>
            </li>
            {{/each}}
        </ul>
    </div>
    <div class="col-md-6">
        <h5>Findings by Service</h5>
        <ul class="list-group">
            {{#each byService}}
            <li class="list-group-item d-flex justify-content-between align-items-center">
                {{@key}}
                <span class="badge bg-secondary rounded-pill">{{this}}</span>
            </li>
            {{/each}}
        </ul>
    </div>
</div>
    `;
  }

  /**
   * Get detailed findings template
   */
  private getDetailedFindingsTemplate(): string {
    return `
{{#each groupedFindings}}
<h4 class="severity-{{@key}}">{{@key}} Findings ({{this.length}})</h4>
{{#each this}}
<div class="card finding-card finding-{{severity}} mb-3">
    <div class="card-body">
        <h5 class="card-title">{{title}}</h5>
        <p class="card-text">{{description}}</p>
        <p><strong>Resource:</strong> {{resourceId}} ({{resourceType}})</p>
        <p><strong>Service:</strong> {{service}} | <strong>Region:</strong> {{region}}</p>
        <p><strong>Frameworks:</strong> {{#each frameworks}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}</p>
    </div>
</div>
{{/each}}
{{/each}}
    `;
  }

  /**
   * Get technical details template
   */
  private getTechnicalDetailsTemplate(): string {
    return `
<div class="row">
    <div class="col-md-6">
        <h5>Scan Information</h5>
        <ul class="list-group">
            <li class="list-group-item"><strong>Duration:</strong> {{scanDuration}}ms</li>
            <li class="list-group-item"><strong>Started:</strong> {{formatDate scanStartedAt}}</li>
            <li class="list-group-item"><strong>Completed:</strong> {{formatDate scanCompletedAt}}</li>
        </ul>
    </div>
    <div class="col-md-6">
        <h5>Scan Scope</h5>
        <ul class="list-group">
            <li class="list-group-item"><strong>Regions:</strong> {{#each regions}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}</li>
            <li class="list-group-item"><strong>Services:</strong> {{#each services}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}</li>
        </ul>
    </div>
</div>
    `;
  }

  /**
   * Get remediation guidance template
   */
  private getRemediationGuidanceTemplate(): string {
    return `
{{#each remediationSteps}}
<div class="card mb-3">
    <div class="card-header">
        <h5 class="severity-{{severity}}">{{title}}</h5>
    </div>
    <div class="card-body">
        <p><strong>Severity:</strong> {{severity}}</p>
        <p><strong>Automated:</strong> {{#if automated}}Yes{{else}}No{{/if}}</p>
        <h6>Remediation Steps:</h6>
        <ol>
            {{#each steps}}
            <li>{{this}}</li>
            {{/each}}
        </ol>
    </div>
</div>
{{/each}}
    `;
  }

  /**
   * Get appendices template
   */
  private getAppendicesTemplate(): string {
    return `
<div class="row">
    <div class="col-md-6">
        <h5>Report Metadata</h5>
        <ul class="list-group">
            <li class="list-group-item"><strong>Report ID:</strong> {{reportId}}</li>
            <li class="list-group-item"><strong>Generated:</strong> {{formatDate generatedAt}}</li>
            <li class="list-group-item"><strong>Generated By:</strong> {{generatedBy}}</li>
            <li class="list-group-item"><strong>Version:</strong> {{version}}</li>
        </ul>
    </div>
    <div class="col-md-6">
        <h5>Scan Metadata</h5>
        <ul class="list-group">
            <li class="list-group-item"><strong>Scan ID:</strong> {{scanData.scanId}}</li>
            <li class="list-group-item"><strong>Started:</strong> {{formatDate scanData.startedAt}}</li>
            <li class="list-group-item"><strong>Completed:</strong> {{formatDate scanData.completedAt}}</li>
            <li class="list-group-item"><strong>Duration:</strong> {{scanData.duration}}ms</li>
        </ul>
    </div>
</div>
    `;
  }
}
