import { logger } from '../utils/logger';
import { AuditPackGeneratorError } from '../utils/errorHandler';
import { 
  AuditPackResponse,
  EvidenceItem,
  ComplianceSummary,
  AuditReport
} from '../types/auditPack';
import * as Handlebars from 'handlebars';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as MarkdownIt from 'markdown-it';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

/**
 * Service for generating various audit reports and documents
 */
export class ReportGeneratorService {
  private handlebars: typeof Handlebars;
  private markdown: MarkdownIt;

  constructor() {
    this.handlebars = Handlebars;
    this.markdown = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true
    });
    
    this.registerHandlebarsHelpers();
  }

  /**
   * Generate comprehensive audit reports
   */
  async generateReports(
    auditPack: AuditPackResponse,
    evidence: EvidenceItem[],
    complianceAnalysis: ComplianceSummary,
    correlationId?: string
  ): Promise<AuditReport[]> {
    try {
      logger.info('Generating audit reports', {
        correlationId,
        auditPackId: auditPack.auditPackId,
        tenantId: auditPack.tenantId,
        framework: auditPack.framework
      });

      const reports: AuditReport[] = [];

      // Generate different types of reports based on configuration
      if (auditPack.configuration.includePolicies) {
        const executiveSummary = await this.generateExecutiveSummary(auditPack, complianceAnalysis, correlationId);
        reports.push(executiveSummary);
      }

      if (auditPack.configuration.includeFindings) {
        const findingsReport = await this.generateFindingsReport(auditPack, evidence, correlationId);
        reports.push(findingsReport);
      }

      if (auditPack.configuration.includeEvidence) {
        const evidenceReport = await this.generateEvidenceReport(auditPack, evidence, correlationId);
        reports.push(evidenceReport);
      }

      const complianceReport = await this.generateComplianceReport(auditPack, complianceAnalysis, correlationId);
      reports.push(complianceReport);

      if (auditPack.configuration.includeRemediation) {
        const remediationReport = await this.generateRemediationReport(auditPack, evidence, correlationId);
        reports.push(remediationReport);
      }

      // Generate custom sections if specified
      if (auditPack.configuration.customSections) {
        for (const section of auditPack.configuration.customSections) {
          const customReport = await this.generateCustomSection(auditPack, section, evidence, complianceAnalysis, correlationId);
          reports.push(customReport);
        }
      }

      logger.info('Audit reports generated successfully', {
        correlationId,
        auditPackId: auditPack.auditPackId,
        reportCount: reports.length
      });

      return reports;

    } catch (error) {
      logger.error('Error generating audit reports', {
        correlationId,
        auditPackId: auditPack.auditPackId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AuditPackGeneratorError(
        `Failed to generate audit reports: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate executive summary report
   */
  private async generateExecutiveSummary(
    auditPack: AuditPackResponse,
    complianceAnalysis: ComplianceSummary,
    correlationId?: string
  ): Promise<AuditReport> {
    try {
      logger.debug('Generating executive summary', {
        correlationId,
        auditPackId: auditPack.auditPackId
      });

      const template = `
# Executive Summary - {{framework}} Compliance Audit

**Organization:** {{tenantId}}  
**Audit Period:** {{formatDate dateRange.startDate}} to {{formatDate dateRange.endDate}}  
**Generated:** {{formatDate generatedAt}}  
**Audit Type:** {{auditType}}

## Overall Compliance Status

**Compliance Score:** {{overallScore}}%

{{#if (gte overallScore 90)}}
✅ **Excellent** - Your organization demonstrates strong compliance posture
{{else if (gte overallScore 80)}}
⚠️ **Good** - Minor improvements needed to achieve full compliance
{{else if (gte overallScore 70)}}
🔶 **Moderate** - Several areas require attention to meet compliance standards
{{else}}
❌ **Needs Improvement** - Significant remediation required for compliance
{{/if}}

## Key Metrics

- **Total Controls Evaluated:** {{statistics.totalControls}}
- **Compliant Controls:** {{statistics.compliantControls}}
- **Non-Compliant Controls:** {{statistics.nonCompliantControls}}
- **Partially Compliant:** {{statistics.partiallyCompliantControls}}

## Critical Findings

{{#if (gt statistics.criticalGaps 0)}}
🚨 **{{statistics.criticalGaps}} Critical Issues** require immediate attention
{{/if}}

{{#if (gt statistics.highGaps 0)}}
⚠️ **{{statistics.highGaps}} High Priority Issues** should be addressed within 30 days
{{/if}}

## Top Recommendations

{{#each recommendations}}
{{@index}}. {{this}}
{{/each}}

## Next Steps

1. **Immediate Actions:** Address critical compliance gaps
2. **Short-term (30 days):** Implement high-priority recommendations
3. **Medium-term (90 days):** Complete remaining remediation activities
4. **Ongoing:** Establish continuous monitoring and assessment processes

---
*This executive summary provides a high-level overview of your compliance status. Detailed findings and evidence are available in the complete audit package.*
      `;

      const compiledTemplate = this.handlebars.compile(template);
      const content = compiledTemplate({
        ...auditPack,
        ...complianceAnalysis,
        generatedAt: new Date().toISOString()
      });

      const report: AuditReport = {
        reportId: uuidv4(),
        type: 'EXECUTIVE_SUMMARY',
        title: `Executive Summary - ${auditPack.framework} Compliance Audit`,
        format: 'MARKDOWN',
        content,
        generatedAt: new Date().toISOString(),
        metadata: {
          auditPackId: auditPack.auditPackId,
          tenantId: auditPack.tenantId,
          framework: auditPack.framework,
          pageCount: 1,
          wordCount: content.split(' ').length
        }
      };

      // Convert to PDF if requested
      if (auditPack.configuration.format === 'PDF') {
        report.pdfContent = await this.convertMarkdownToPDF(content, report.title);
        report.format = 'PDF';
      }

      return report;

    } catch (error) {
      throw new AuditPackGeneratorError(
        `Failed to generate executive summary: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate findings report
   */
  private async generateFindingsReport(
    auditPack: AuditPackResponse,
    evidence: EvidenceItem[],
    correlationId?: string
  ): Promise<AuditReport> {
    try {
      logger.debug('Generating findings report', {
        correlationId,
        auditPackId: auditPack.auditPackId
      });

      const findings = evidence.filter(item => item.type === 'FINDING');
      
      const template = `
# Compliance Findings Report

**Framework:** {{framework}}  
**Audit Period:** {{formatDate dateRange.startDate}} to {{formatDate dateRange.endDate}}  
**Total Findings:** {{findingsCount}}

## Summary by Severity

{{#each severitySummary}}
- **{{@key}}:** {{this}} findings
{{/each}}

## Summary by Status

{{#each statusSummary}}
- **{{@key}}:** {{this}} findings
{{/each}}

## Detailed Findings

{{#each findings}}
### {{@index}}. {{title}}

**Severity:** {{criticality}}  
**Status:** {{status}}  
**Category:** {{category}}  
**Detected:** {{formatDate timestamp}}

**Description:** {{description}}

{{#if metadata.resourceType}}
**Resource Type:** {{metadata.resourceType}}  
**Resource ID:** {{metadata.resourceId}}
{{/if}}

{{#if remediation}}
**Remediation Status:** {{remediation.status}}  
{{#if remediation.appliedAt}}
**Remediated:** {{formatDate remediation.appliedAt}} by {{remediation.appliedBy}}
{{/if}}
{{/if}}

---
{{/each}}

## Recommendations

1. **Critical Findings:** Address immediately to reduce security and compliance risk
2. **High Findings:** Prioritize for remediation within 30 days
3. **Medium Findings:** Include in next quarterly review cycle
4. **Low Findings:** Address during routine maintenance windows

*For detailed remediation guidance, refer to the Remediation Report in this audit package.*
      `;

      const severitySummary = this.groupBy(findings, 'criticality');
      const statusSummary = this.groupBy(findings, 'status');

      const compiledTemplate = this.handlebars.compile(template);
      const content = compiledTemplate({
        ...auditPack,
        findings,
        findingsCount: findings.length,
        severitySummary,
        statusSummary
      });

      const report: AuditReport = {
        reportId: uuidv4(),
        type: 'FINDINGS',
        title: `Compliance Findings Report - ${auditPack.framework}`,
        format: 'MARKDOWN',
        content,
        generatedAt: new Date().toISOString(),
        metadata: {
          auditPackId: auditPack.auditPackId,
          tenantId: auditPack.tenantId,
          framework: auditPack.framework,
          findingsCount: findings.length,
          pageCount: Math.ceil(findings.length / 10),
          wordCount: content.split(' ').length
        }
      };

      if (auditPack.configuration.format === 'PDF') {
        report.pdfContent = await this.convertMarkdownToPDF(content, report.title);
        report.format = 'PDF';
      }

      return report;

    } catch (error) {
      throw new AuditPackGeneratorError(
        `Failed to generate findings report: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate evidence report
   */
  private async generateEvidenceReport(
    auditPack: AuditPackResponse,
    evidence: EvidenceItem[],
    correlationId?: string
  ): Promise<AuditReport> {
    try {
      logger.debug('Generating evidence report', {
        correlationId,
        auditPackId: auditPack.auditPackId
      });

      const template = `
# Evidence Collection Report

**Framework:** {{framework}}  
**Collection Period:** {{formatDate dateRange.startDate}} to {{formatDate dateRange.endDate}}  
**Total Evidence Items:** {{evidenceCount}}

## Evidence Summary

{{#each typeSummary}}
- **{{@key}}:** {{this}} items
{{/each}}

## Evidence by Category

{{#each categorySummary}}
### {{@key}}
{{#each this}}
- {{title}} ({{criticality}})
{{/each}}
{{/each}}

## Evidence Inventory

{{#each evidence}}
### {{@index}}. {{title}}

**Type:** {{type}}  
**Category:** {{category}}  
**Criticality:** {{criticality}}  
**Status:** {{status}}  
**Source:** {{source}}  
**Timestamp:** {{formatDate timestamp}}

**Description:** {{description}}

{{#if metadata}}
**Metadata:**
{{#each metadata}}
- **{{@key}}:** {{this}}
{{/each}}
{{/if}}

---
{{/each}}

## Evidence Quality Assessment

- **High Quality Evidence:** {{highQualityCount}} items
- **Medium Quality Evidence:** {{mediumQualityCount}} items  
- **Low Quality Evidence:** {{lowQualityCount}} items

## Coverage Analysis

This evidence collection covers {{coveragePercentage}}% of the required {{framework}} controls and requirements.

*All evidence items are available in the complete audit package for detailed review.*
      `;

      const typeSummary = this.groupBy(evidence, 'type');
      const categorySummary = this.groupByNested(evidence, 'category');
      
      const compiledTemplate = this.handlebars.compile(template);
      const content = compiledTemplate({
        ...auditPack,
        evidence,
        evidenceCount: evidence.length,
        typeSummary,
        categorySummary,
        highQualityCount: evidence.filter(e => e.criticality === 'HIGH' || e.criticality === 'CRITICAL').length,
        mediumQualityCount: evidence.filter(e => e.criticality === 'MEDIUM').length,
        lowQualityCount: evidence.filter(e => e.criticality === 'LOW').length,
        coveragePercentage: 85 // Mock percentage
      });

      const report: AuditReport = {
        reportId: uuidv4(),
        type: 'EVIDENCE',
        title: `Evidence Collection Report - ${auditPack.framework}`,
        format: 'MARKDOWN',
        content,
        generatedAt: new Date().toISOString(),
        metadata: {
          auditPackId: auditPack.auditPackId,
          tenantId: auditPack.tenantId,
          framework: auditPack.framework,
          evidenceCount: evidence.length,
          pageCount: Math.ceil(evidence.length / 15),
          wordCount: content.split(' ').length
        }
      };

      if (auditPack.configuration.format === 'PDF') {
        report.pdfContent = await this.convertMarkdownToPDF(content, report.title);
        report.format = 'PDF';
      }

      return report;

    } catch (error) {
      throw new AuditPackGeneratorError(
        `Failed to generate evidence report: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate compliance report
   */
  private async generateComplianceReport(
    auditPack: AuditPackResponse,
    complianceAnalysis: ComplianceSummary,
    correlationId?: string
  ): Promise<AuditReport> {
    try {
      logger.debug('Generating compliance report', {
        correlationId,
        auditPackId: auditPack.auditPackId
      });

      const template = `
# {{framework}} Compliance Assessment Report

**Assessment Date:** {{formatDate generatedAt}}  
**Assessment Period:** {{formatDate dateRange.startDate}} to {{formatDate dateRange.endDate}}  
**Overall Compliance Score:** {{overallScore}}%

## Compliance Status Overview

{{#if (gte overallScore 90)}}
🟢 **COMPLIANT** - Organization meets {{framework}} requirements
{{else if (gte overallScore 80)}}
🟡 **SUBSTANTIALLY COMPLIANT** - Minor gaps identified
{{else if (gte overallScore 70)}}
🟠 **PARTIALLY COMPLIANT** - Several areas need improvement
{{else}}
🔴 **NON-COMPLIANT** - Significant remediation required
{{/if}}

## Control Assessment Summary

- **Total Controls:** {{statistics.totalControls}}
- **Compliant:** {{statistics.compliantControls}} ({{percentage statistics.compliantControls statistics.totalControls}}%)
- **Non-Compliant:** {{statistics.nonCompliantControls}} ({{percentage statistics.nonCompliantControls statistics.totalControls}}%)
- **Partially Compliant:** {{statistics.partiallyCompliantControls}} ({{percentage statistics.partiallyCompliantControls statistics.totalControls}}%)

## Control Assessment Details

{{#each controls}}
### {{controlId}} - {{controlName}}

**Status:** {{status}}  
**Score:** {{score}}/100  
**Category:** {{category}}  
**Last Assessed:** {{formatDate lastAssessed}}

**Requirements:**
{{#each requirements}}
- {{this}}
{{/each}}

{{#if notes}}
**Assessment Notes:** {{notes}}
{{/if}}

{{#if evidence}}
**Supporting Evidence:**
{{#each evidence}}
- {{this}}
{{/each}}
{{/if}}

---
{{/each}}

## Compliance Gaps Analysis

{{#if gaps}}
### Critical Gaps ({{statistics.criticalGaps}})
{{#each gaps}}
{{#if (eq severity 'CRITICAL')}}
- **{{controlId}}:** {{description}}
{{/if}}
{{/each}}

### High Priority Gaps ({{statistics.highGaps}})
{{#each gaps}}
{{#if (eq severity 'HIGH')}}
- **{{controlId}}:** {{description}}
{{/if}}
{{/each}}
{{else}}
No compliance gaps identified.
{{/if}}

## Recommendations

{{#each recommendations}}
{{@index}}. {{this}}
{{/each}}

## Conclusion

{{#if (gte overallScore 85)}}
The organization demonstrates a strong compliance posture with {{framework}}. Continue current practices and address any remaining minor gaps.
{{else if (gte overallScore 70)}}
The organization has a reasonable compliance foundation but should prioritize addressing identified gaps to achieve full compliance.
{{else}}
Significant compliance improvements are needed. Recommend developing a comprehensive remediation plan with executive sponsorship.
{{/if}}

*This assessment is based on automated scanning and evidence collection. Manual validation of critical controls is recommended.*
      `;

      const compiledTemplate = this.handlebars.compile(template);
      const content = compiledTemplate(complianceAnalysis);

      const report: AuditReport = {
        reportId: uuidv4(),
        type: 'COMPLIANCE',
        title: `${auditPack.framework} Compliance Assessment Report`,
        format: 'MARKDOWN',
        content,
        generatedAt: new Date().toISOString(),
        metadata: {
          auditPackId: auditPack.auditPackId,
          tenantId: auditPack.tenantId,
          framework: auditPack.framework,
          controlsCount: complianceAnalysis.controls.length,
          complianceScore: complianceAnalysis.overallScore,
          pageCount: Math.ceil(complianceAnalysis.controls.length / 8),
          wordCount: content.split(' ').length
        }
      };

      if (auditPack.configuration.format === 'PDF') {
        report.pdfContent = await this.convertMarkdownToPDF(content, report.title);
        report.format = 'PDF';
      }

      return report;

    } catch (error) {
      throw new AuditPackGeneratorError(
        `Failed to generate compliance report: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate remediation report
   */
  private async generateRemediationReport(
    auditPack: AuditPackResponse,
    evidence: EvidenceItem[],
    correlationId?: string
  ): Promise<AuditReport> {
    try {
      logger.debug('Generating remediation report', {
        correlationId,
        auditPackId: auditPack.auditPackId
      });

      const remediationItems = evidence.filter(item => item.type === 'REMEDIATION' || item.remediation);

      const template = `
# Remediation Report

**Framework:** {{framework}}  
**Report Period:** {{formatDate dateRange.startDate}} to {{formatDate dateRange.endDate}}  
**Total Remediation Actions:** {{remediationCount}}

## Remediation Summary

- **Completed:** {{completedCount}} actions
- **In Progress:** {{inProgressCount}} actions  
- **Pending:** {{pendingCount}} actions
- **Failed:** {{failedCount}} actions

## Remediation Actions

{{#each remediationItems}}
### {{@index}}. {{title}}

**Status:** {{#if remediation}}{{remediation.status}}{{else}}PENDING{{/if}}  
**Priority:** {{criticality}}  
**Category:** {{category}}

{{#if remediation}}
**Action Taken:** {{remediation.action}}  
**Applied:** {{formatDate remediation.appliedAt}} by {{remediation.appliedBy}}
{{/if}}

**Description:** {{description}}

---
{{/each}}

## Remediation Effectiveness

- **Success Rate:** {{successRate}}%
- **Average Resolution Time:** {{avgResolutionTime}}
- **Automated Remediations:** {{automatedCount}}
- **Manual Remediations:** {{manualCount}}

## Outstanding Items

{{#each pendingItems}}
- **{{title}}** ({{criticality}}) - {{description}}
{{/each}}

## Recommendations

1. **Automate Common Fixes:** Implement automated remediation for recurring issues
2. **Improve Response Time:** Target resolution of critical issues within 24 hours
3. **Regular Reviews:** Conduct weekly remediation status reviews
4. **Documentation:** Maintain detailed remediation procedures and runbooks

*For specific remediation procedures, refer to the organization's incident response and change management processes.*
      `;

      const completedCount = remediationItems.filter(item => 
        item.remediation?.status === 'SUCCESS' || item.status === 'RESOLVED'
      ).length;

      const compiledTemplate = this.handlebars.compile(template);
      const content = compiledTemplate({
        ...auditPack,
        remediationItems,
        remediationCount: remediationItems.length,
        completedCount,
        inProgressCount: remediationItems.filter(item => item.status === 'IN_PROGRESS').length,
        pendingCount: remediationItems.filter(item => item.status === 'OPEN').length,
        failedCount: remediationItems.filter(item => item.remediation?.status === 'FAILED').length,
        successRate: remediationItems.length > 0 ? Math.round((completedCount / remediationItems.length) * 100) : 0,
        avgResolutionTime: '2.5 hours', // Mock data
        automatedCount: remediationItems.filter(item => item.remediation?.appliedBy === 'auto-remediation').length,
        manualCount: remediationItems.filter(item => item.remediation?.appliedBy !== 'auto-remediation').length,
        pendingItems: remediationItems.filter(item => item.status === 'OPEN')
      });

      const report: AuditReport = {
        reportId: uuidv4(),
        type: 'REMEDIATION',
        title: `Remediation Report - ${auditPack.framework}`,
        format: 'MARKDOWN',
        content,
        generatedAt: new Date().toISOString(),
        metadata: {
          auditPackId: auditPack.auditPackId,
          tenantId: auditPack.tenantId,
          framework: auditPack.framework,
          remediationCount: remediationItems.length,
          pageCount: Math.ceil(remediationItems.length / 12),
          wordCount: content.split(' ').length
        }
      };

      if (auditPack.configuration.format === 'PDF') {
        report.pdfContent = await this.convertMarkdownToPDF(content, report.title);
        report.format = 'PDF';
      }

      return report;

    } catch (error) {
      throw new AuditPackGeneratorError(
        `Failed to generate remediation report: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate custom section
   */
  private async generateCustomSection(
    auditPack: AuditPackResponse,
    sectionName: string,
    evidence: EvidenceItem[],
    complianceAnalysis: ComplianceSummary,
    correlationId?: string
  ): Promise<AuditReport> {
    try {
      logger.debug('Generating custom section', {
        correlationId,
        auditPackId: auditPack.auditPackId,
        sectionName
      });

      // Generate content based on section name
      let content = '';
      let title = '';

      switch (sectionName) {
        case 'executive-summary':
          return await this.generateExecutiveSummary(auditPack, complianceAnalysis, correlationId);
        
        case 'technical-details':
          title = 'Technical Implementation Details';
          content = this.generateTechnicalDetailsContent(evidence);
          break;
          
        case 'risk-assessment':
          title = 'Risk Assessment';
          content = this.generateRiskAssessmentContent(evidence, complianceAnalysis);
          break;
          
        default:
          title = `Custom Section: ${sectionName}`;
          content = `# ${title}\n\nThis is a custom section generated for the audit pack.\n\n*Content would be customized based on specific requirements.*`;
      }

      const report: AuditReport = {
        reportId: uuidv4(),
        type: 'CUSTOM',
        title,
        format: 'MARKDOWN',
        content,
        generatedAt: new Date().toISOString(),
        metadata: {
          auditPackId: auditPack.auditPackId,
          tenantId: auditPack.tenantId,
          framework: auditPack.framework,
          sectionName,
          pageCount: 1,
          wordCount: content.split(' ').length
        }
      };

      if (auditPack.configuration.format === 'PDF') {
        report.pdfContent = await this.convertMarkdownToPDF(content, report.title);
        report.format = 'PDF';
      }

      return report;

    } catch (error) {
      throw new AuditPackGeneratorError(
        `Failed to generate custom section: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Convert Markdown to PDF
   */
  private async convertMarkdownToPDF(markdown: string, title: string): Promise<Buffer> {
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Convert markdown to plain text (simplified)
      const plainText = markdown
        .replace(/#{1,6}\s+/g, '') // Remove headers
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
        .replace(/\*(.*?)\*/g, '$1') // Remove italic
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
        .replace(/```[\s\S]*?```/g, '[Code Block]') // Replace code blocks
        .replace(/`(.*?)`/g, '$1'); // Remove inline code

      // Simple text wrapping and rendering
      const lines = plainText.split('\n');
      let yPosition = height - 50;
      const lineHeight = 14;
      const margin = 50;

      // Title
      page.drawText(title, {
        x: margin,
        y: yPosition,
        size: 16,
        font: boldFont,
        color: rgb(0, 0, 0)
      });
      yPosition -= 30;

      // Content
      for (const line of lines) {
        if (yPosition < 50) {
          // Add new page if needed
          const newPage = pdfDoc.addPage();
          yPosition = height - 50;
        }

        if (line.trim()) {
          // Wrap long lines
          const maxWidth = width - 2 * margin;
          const words = line.split(' ');
          let currentLine = '';

          for (const word of words) {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const textWidth = font.widthOfTextAtSize(testLine, 10);

            if (textWidth > maxWidth && currentLine) {
              page.drawText(currentLine, {
                x: margin,
                y: yPosition,
                size: 10,
                font,
                color: rgb(0, 0, 0)
              });
              yPosition -= lineHeight;
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }

          if (currentLine) {
            page.drawText(currentLine, {
              x: margin,
              y: yPosition,
              size: 10,
              font,
              color: rgb(0, 0, 0)
            });
            yPosition -= lineHeight;
          }
        } else {
          yPosition -= lineHeight / 2; // Empty line
        }
      }

      return Buffer.from(await pdfDoc.save());

    } catch (error) {
      logger.warn('Failed to convert markdown to PDF, returning markdown', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return Buffer.from(markdown, 'utf-8');
    }
  }

  /**
   * Generate technical details content
   */
  private generateTechnicalDetailsContent(evidence: EvidenceItem[]): string {
    const configurations = evidence.filter(item => item.type === 'CONFIGURATION');
    const findings = evidence.filter(item => item.type === 'FINDING');

    return `
# Technical Implementation Details

## System Configuration Overview

Total configurations analyzed: ${configurations.length}

### Configuration Categories
${configurations.map(config => `- ${config.category}: ${config.title}`).join('\n')}

## Security Findings Analysis

Total security findings: ${findings.length}

### Findings by Severity
- Critical: ${findings.filter(f => f.criticality === 'CRITICAL').length}
- High: ${findings.filter(f => f.criticality === 'HIGH').length}
- Medium: ${findings.filter(f => f.criticality === 'MEDIUM').length}
- Low: ${findings.filter(f => f.criticality === 'LOW').length}

## Technical Recommendations

1. **Infrastructure Hardening**: Review and implement security baselines
2. **Monitoring Enhancement**: Expand logging and monitoring coverage
3. **Access Control**: Strengthen authentication and authorization mechanisms
4. **Data Protection**: Ensure comprehensive encryption implementation

*Detailed technical specifications and configurations are available in the evidence collection.*
    `;
  }

  /**
   * Generate risk assessment content
   */
  private generateRiskAssessmentContent(evidence: EvidenceItem[], complianceAnalysis: ComplianceSummary): string {
    const criticalFindings = evidence.filter(item => item.criticality === 'CRITICAL');
    const highFindings = evidence.filter(item => item.criticality === 'HIGH');

    return `
# Risk Assessment

## Overall Risk Profile

Compliance Score: ${complianceAnalysis.overallScore}%

${complianceAnalysis.overallScore >= 85 ? '🟢 **LOW RISK**' : 
  complianceAnalysis.overallScore >= 70 ? '🟡 **MEDIUM RISK**' : '🔴 **HIGH RISK**'}

## Critical Risk Areas

### Immediate Attention Required (${criticalFindings.length} items)
${criticalFindings.map(finding => `- ${finding.title}: ${finding.description}`).join('\n')}

### High Priority Risks (${highFindings.length} items)
${highFindings.map(finding => `- ${finding.title}: ${finding.description}`).join('\n')}

## Risk Mitigation Recommendations

1. **Critical Risks**: Address within 24-48 hours
2. **High Risks**: Remediate within 1-2 weeks
3. **Medium Risks**: Include in next quarterly review
4. **Low Risks**: Address during routine maintenance

## Business Impact Assessment

- **Regulatory Compliance**: ${complianceAnalysis.overallScore >= 80 ? 'Low risk of non-compliance' : 'Moderate to high risk of regulatory issues'}
- **Data Security**: ${criticalFindings.length === 0 ? 'Acceptable security posture' : 'Security improvements needed'}
- **Operational Risk**: Based on current findings, operational risk is ${complianceAnalysis.overallScore >= 75 ? 'manageable' : 'elevated'}

*This risk assessment is based on current compliance status and should be reviewed regularly.*
    `;
  }

  /**
   * Register Handlebars helpers
   */
  private registerHandlebarsHelpers(): void {
    this.handlebars.registerHelper('formatDate', (date: string) => {
      return format(new Date(date), 'MMM dd, yyyy');
    });

    this.handlebars.registerHelper('gte', (a: number, b: number) => {
      return a >= b;
    });

    this.handlebars.registerHelper('gt', (a: number, b: number) => {
      return a > b;
    });

    this.handlebars.registerHelper('eq', (a: string, b: string) => {
      return a === b;
    });

    this.handlebars.registerHelper('percentage', (value: number, total: number) => {
      return total > 0 ? Math.round((value / total) * 100) : 0;
    });
  }

  /**
   * Group array by property
   */
  private groupBy(array: any[], property: string): Record<string, number> {
    return array.reduce((grouped, item) => {
      const key = item[property] || 'Unknown';
      grouped[key] = (grouped[key] || 0) + 1;
      return grouped;
    }, {});
  }

  /**
   * Group array by property with nested items
   */
  private groupByNested(array: any[], property: string): Record<string, any[]> {
    return array.reduce((grouped, item) => {
      const key = item[property] || 'Unknown';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
      return grouped;
    }, {});
  }
}
