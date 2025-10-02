import * as Handlebars from 'handlebars';
import { logger } from '../utils/logger';
import { SlackNotificationError } from '../utils/errorHandler';
import { ComplianceEvent } from '../types/slack';

/**
 * Service for managing notification templates and rendering
 */
export class NotificationTemplateService {
  private templates: Map<string, HandlebarsTemplateDelegate>;

  constructor() {
    this.templates = new Map();
    this.initializeTemplates();
    this.registerHelpers();
  }

  /**
   * Initialize default templates
   */
  private initializeTemplates(): void {
    // Scan completed template
    this.templates.set('scan_completed', Handlebars.compile(`
🔍 *Compliance Scan Completed*

*Status:* {{#if criticalCount}}🔴 Critical Issues Found{{else}}{{#if highCount}}🟡 Issues Found{{else}}🟢 All Clear{{/if}}{{/if}}
*Total Findings:* {{findingsCount}}

*Breakdown:*
• Critical: {{criticalCount}}
• High: {{highCount}}
• Medium: {{mediumCount}}
• Low: {{lowCount}}

{{#if criticalCount}}⚠️ *Immediate attention required for critical findings*{{/if}}

🆔 Scan: {{scanId}} | 🏢 {{tenantId}} | ⏰ {{formatDate timestamp}}
    `));

    // Critical finding template
    this.templates.set('critical_finding', Handlebars.compile(`
🚨 *Critical Security Finding Detected*

*{{title}}*
{{description}}

*Details:*
• Severity: {{severity}}
• Resource Type: {{resourceType}}
• Resource ID: {{resourceId}}
• Finding ID: {{findingId}}

🏢 {{tenantId}} | ⏰ {{formatDate timestamp}}
    `));

    // Remediation applied template
    this.templates.set('remediation_applied', Handlebars.compile(`
{{#if (eq status 'SUCCESS')}}✅{{else}}{{#if (eq status 'FAILED')}}❌{{else}}⏳{{/if}}{{/if}} *Remediation {{status}}*

*Action:* {{action}}
*Resource:* {{resourceType}} ({{resourceId}})
*Status:* {{status}}
*Applied:* {{formatDate timestamp}}

{{#if (eq status 'FAILED')}}⚠️ *Remediation failed. Manual intervention may be required.*{{/if}}

🆔 {{remediationId}} | 🏢 {{tenantId}} | ⏰ {{formatDate timestamp}}
    `));

    // Audit pack generated template
    this.templates.set('audit_pack_generated', Handlebars.compile(`
📋 *{{framework}} Audit Pack Ready*

*Type:* {{auditType}}
*Compliance Score:* {{#if (gte complianceScore 90)}}🟢{{else}}{{#if (gte complianceScore 80)}}🟡{{else}}🔴{{/if}}{{/if}} {{complianceScore}}%

*Package Contents:*
• Executive Summary
• Detailed Findings Report
• Evidence Collection
• Compliance Assessment
• Remediation Report

*Statistics:*
• Total Findings: {{totalFindings}}
• Critical Issues: {{criticalFindings}}

🆔 {{auditPackId}} | 🏢 {{tenantId}} | ⏰ {{formatDate timestamp}}
    `));

    // Compliance score changed template
    this.templates.set('compliance_score_changed', Handlebars.compile(`
{{#if (gt scoreDiff 0)}}📈{{else}}{{#if (lt scoreDiff 0)}}📉{{else}}➡️{{/if}}{{/if}} *Compliance Score {{#if (gt scoreDiff 0)}}Improved{{else}}{{#if (lt scoreDiff 0)}}Decreased{{else}}Unchanged{{/if}}{{/if}}*

*{{framework}} Compliance Score:* {{#if (gte complianceScore 90)}}🟢{{else}}{{#if (gte complianceScore 80)}}🟡{{else}}🔴{{/if}}{{/if}} {{complianceScore}}%
*Previous Score:* {{previousScore}}%
*Change:* {{#if (gt scoreDiff 0)}}+{{/if}}{{scoreDiff}}%

{{#if changeReason}}*Reason:* {{changeReason}}{{/if}}

🏢 {{tenantId}} | ⏰ {{formatDate timestamp}}
    `));

    // Scan failed template
    this.templates.set('scan_failed', Handlebars.compile(`
❌ *Compliance Scan Failed*

*Scan ID:* {{scanId}}
*Type:* {{scanType}}
*Error:* {{errorMessage}}

*Recommended Actions:*
• Check scan configuration
• Verify AWS permissions
• Review error logs
• Contact support if issue persists

🆔 {{scanId}} | 🏢 {{tenantId}} | ⏰ {{formatDate timestamp}}
    `));

    // Daily summary template
    this.templates.set('daily_summary', Handlebars.compile(`
📊 *Daily Compliance Summary*

*Scans Completed:* {{scansCompleted}}
*New Findings:* {{newFindings}}
*Remediations Applied:* {{remediationsApplied}}
*Compliance Score:* {{#if (gte avgComplianceScore 90)}}🟢{{else}}{{#if (gte avgComplianceScore 80)}}🟡{{else}}🔴{{/if}}{{/if}} {{avgComplianceScore}}%

*Top Issues:*
{{#each topIssues}}
• {{this.title}} ({{this.count}} occurrences)
{{/each}}

🏢 {{tenantId}} | 📅 {{formatDate date}}
    `));

    // Weekly summary template
    this.templates.set('weekly_summary', Handlebars.compile(`
📈 *Weekly Compliance Report*

*This Week:*
• Scans: {{scansThisWeek}}
• Findings: {{findingsThisWeek}}
• Remediations: {{remediationsThisWeek}}
• Avg Score: {{#if (gte avgScoreThisWeek 90)}}🟢{{else}}{{#if (gte avgScoreThisWeek 80)}}🟡{{else}}🔴{{/if}}{{/if}} {{avgScoreThisWeek}}%

*Compared to Last Week:*
• Scans: {{#if (gt scansTrend 0)}}📈 +{{scansTrend}}{{else}}{{#if (lt scansTrend 0)}}📉 {{scansTrend}}{{else}}➡️ No change{{/if}}{{/if}}
• Score: {{#if (gt scoreTrend 0)}}📈 +{{scoreTrend}}%{{else}}{{#if (lt scoreTrend 0)}}📉 {{scoreTrend}}%{{else}}➡️ No change{{/if}}{{/if}}

*Focus Areas:*
{{#each focusAreas}}
• {{this}}
{{/each}}

🏢 {{tenantId}} | 📅 Week of {{formatDate weekStart}}
    `));

    logger.debug('Notification templates initialized', {
      templateCount: this.templates.size
    });
  }

  /**
   * Register Handlebars helpers
   */
  private registerHelpers(): void {
    Handlebars.registerHelper('formatDate', (date: string | Date) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    });

    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('gt', (a: number, b: number) => a > b);
    Handlebars.registerHelper('lt', (a: number, b: number) => a < b);
    Handlebars.registerHelper('gte', (a: number, b: number) => a >= b);
    Handlebars.registerHelper('lte', (a: number, b: number) => a <= b);

    Handlebars.registerHelper('formatNumber', (num: number) => {
      return num.toLocaleString();
    });

    Handlebars.registerHelper('percentage', (value: number, total: number) => {
      if (total === 0) return '0';
      return Math.round((value / total) * 100);
    });

    Handlebars.registerHelper('truncate', (str: string, length: number) => {
      if (str.length <= length) return str;
      return str.substring(0, length) + '...';
    });

    Handlebars.registerHelper('capitalize', (str: string) => {
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });

    Handlebars.registerHelper('pluralize', (count: number, singular: string, plural?: string) => {
      if (count === 1) return singular;
      return plural || singular + 's';
    });
  }

  /**
   * Render template with data
   */
  renderTemplate(templateName: string, data: any, correlationId?: string): string {
    try {
      const template = this.templates.get(templateName);
      if (!template) {
        throw new SlackNotificationError(`Template not found: ${templateName}`);
      }

      // Add common data
      const templateData = {
        ...data,
        timestamp: data.timestamp || new Date().toISOString(),
        scoreDiff: data.complianceScore && data.previousScore ? 
          data.complianceScore - data.previousScore : 0
      };

      const rendered = template(templateData);

      logger.debug('Template rendered successfully', {
        correlationId,
        templateName,
        dataKeys: Object.keys(data)
      });

      return rendered.trim();

    } catch (error) {
      logger.error('Error rendering template', {
        correlationId,
        templateName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new SlackNotificationError(
        `Failed to render template ${templateName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Add custom template
   */
  addTemplate(name: string, templateString: string, correlationId?: string): void {
    try {
      const template = Handlebars.compile(templateString);
      this.templates.set(name, template);

      logger.info('Custom template added', {
        correlationId,
        templateName: name
      });

    } catch (error) {
      logger.error('Error adding custom template', {
        correlationId,
        templateName: name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new SlackNotificationError(
        `Failed to add template ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Remove template
   */
  removeTemplate(name: string, correlationId?: string): boolean {
    const removed = this.templates.delete(name);

    logger.debug('Template removal attempted', {
      correlationId,
      templateName: name,
      removed
    });

    return removed;
  }

  /**
   * List available templates
   */
  listTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Get template source (for editing)
   */
  getTemplateSource(name: string): string | null {
    // In a real implementation, you would store the original template strings
    // For now, return null as we don't store the original strings
    return null;
  }

  /**
   * Validate template syntax
   */
  validateTemplate(templateString: string): { valid: boolean; error?: string } {
    try {
      Handlebars.compile(templateString);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown template error'
      };
    }
  }

  /**
   * Render scan completed notification
   */
  renderScanCompleted(eventData: ComplianceEvent, correlationId?: string): string {
    return this.renderTemplate('scan_completed', eventData, correlationId);
  }

  /**
   * Render critical finding notification
   */
  renderCriticalFinding(eventData: ComplianceEvent, correlationId?: string): string {
    return this.renderTemplate('critical_finding', eventData, correlationId);
  }

  /**
   * Render remediation applied notification
   */
  renderRemediationApplied(eventData: ComplianceEvent, correlationId?: string): string {
    return this.renderTemplate('remediation_applied', eventData, correlationId);
  }

  /**
   * Render audit pack generated notification
   */
  renderAuditPackGenerated(eventData: ComplianceEvent, correlationId?: string): string {
    return this.renderTemplate('audit_pack_generated', eventData, correlationId);
  }

  /**
   * Render compliance score changed notification
   */
  renderComplianceScoreChanged(eventData: ComplianceEvent, correlationId?: string): string {
    return this.renderTemplate('compliance_score_changed', eventData, correlationId);
  }

  /**
   * Render scan failed notification
   */
  renderScanFailed(eventData: ComplianceEvent, correlationId?: string): string {
    return this.renderTemplate('scan_failed', eventData, correlationId);
  }

  /**
   * Render daily summary
   */
  renderDailySummary(summaryData: any, correlationId?: string): string {
    return this.renderTemplate('daily_summary', summaryData, correlationId);
  }

  /**
   * Render weekly summary
   */
  renderWeeklySummary(summaryData: any, correlationId?: string): string {
    return this.renderTemplate('weekly_summary', summaryData, correlationId);
  }

  /**
   * Render custom notification
   */
  renderCustomNotification(
    templateName: string,
    data: any,
    fallbackMessage: string,
    correlationId?: string
  ): string {
    try {
      return this.renderTemplate(templateName, data, correlationId);
    } catch (error) {
      logger.warn('Failed to render custom template, using fallback', {
        correlationId,
        templateName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return fallbackMessage;
    }
  }

  /**
   * Get template preview with sample data
   */
  getTemplatePreview(templateName: string): string {
    const sampleData = this.getSampleData(templateName);
    try {
      return this.renderTemplate(templateName, sampleData);
    } catch (error) {
      return `Error rendering preview: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Get sample data for template preview
   */
  private getSampleData(templateName: string): any {
    const baseSampleData = {
      tenantId: 'tenant-demo-company',
      timestamp: new Date().toISOString()
    };

    switch (templateName) {
      case 'scan_completed':
        return {
          ...baseSampleData,
          scanId: 'scan-12345',
          findingsCount: 25,
          criticalCount: 3,
          highCount: 8,
          mediumCount: 10,
          lowCount: 4
        };

      case 'critical_finding':
        return {
          ...baseSampleData,
          findingId: 'finding-67890',
          title: 'S3 Bucket Public Access Enabled',
          description: 'S3 bucket "data-backup" has public read access enabled, potentially exposing sensitive data.',
          severity: 'CRITICAL',
          resourceType: 'S3_BUCKET',
          resourceId: 'data-backup'
        };

      case 'remediation_applied':
        return {
          ...baseSampleData,
          remediationId: 'remediation-11111',
          findingId: 'finding-67890',
          action: 'Disable S3 bucket public access',
          status: 'SUCCESS',
          resourceType: 'S3_BUCKET',
          resourceId: 'data-backup'
        };

      case 'audit_pack_generated':
        return {
          ...baseSampleData,
          auditPackId: 'audit-pack-22222',
          framework: 'SOC2',
          auditType: 'ANNUAL',
          complianceScore: 87.5,
          totalFindings: 125,
          criticalFindings: 8
        };

      case 'compliance_score_changed':
        return {
          ...baseSampleData,
          framework: 'SOC2',
          complianceScore: 89.2,
          previousScore: 85.7,
          changeReason: 'Critical findings remediated'
        };

      case 'scan_failed':
        return {
          ...baseSampleData,
          scanId: 'scan-33333',
          scanType: 'SCHEDULED',
          errorMessage: 'AWS credentials expired'
        };

      default:
        return baseSampleData;
    }
  }
}
