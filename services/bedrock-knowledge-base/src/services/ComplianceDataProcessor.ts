import MarkdownIt from 'markdown-it';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';

export interface ComplianceMetadata {
  title: string;
  description?: string;
  framework: string;
  category: string;
  tags?: string[];
  version?: string;
  lastUpdated?: string;
}

/**
 * Processes compliance data for ingestion into Bedrock Knowledge Base
 */
export class ComplianceDataProcessor {
  private markdownParser: MarkdownIt;

  constructor() {
    this.markdownParser = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true
    });
  }

  /**
   * Process content based on format and add metadata
   */
  async processContent(
    content: string,
    format: 'MARKDOWN' | 'TEXT' | 'JSON',
    metadata: ComplianceMetadata
  ): Promise<string> {
    logger.info('Processing compliance content', {
      format,
      contentLength: content.length,
      framework: metadata.framework,
      category: metadata.category
    });

    try {
      let processedContent = '';

      switch (format) {
        case 'MARKDOWN':
          processedContent = await this.processMarkdown(content, metadata);
          break;
        case 'TEXT':
          processedContent = await this.processText(content, metadata);
          break;
        case 'JSON':
          processedContent = await this.processJSON(content, metadata);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      // Add metadata header
      const metadataHeader = this.generateMetadataHeader(metadata);
      const finalContent = `${metadataHeader}\n\n${processedContent}`;

      logger.info('Content processing completed', {
        originalLength: content.length,
        processedLength: finalContent.length,
        format
      });

      return finalContent;

    } catch (error) {
      logger.error('Error processing content', {
        error: error instanceof Error ? error.message : 'Unknown error',
        format,
        framework: metadata.framework
      });

      throw error;
    }
  }

  /**
   * Process markdown content
   */
  private async processMarkdown(content: string, metadata: ComplianceMetadata): Promise<string> {
    // Clean up markdown content
    let processed = content
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .trim();

    // Add framework-specific formatting
    processed = this.addFrameworkContext(processed, metadata.framework);

    // Enhance with compliance-specific markers
    processed = this.addComplianceMarkers(processed, metadata);

    return processed;
  }

  /**
   * Process plain text content
   */
  private async processText(content: string, metadata: ComplianceMetadata): Promise<string> {
    // Convert text to markdown format
    let processed = content
      .replace(/\r\n/g, '\n')
      .trim();

    // Add basic markdown structure
    const lines = processed.split('\n');
    const markdownLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) {
        markdownLines.push('');
        continue;
      }

      // Detect headings (lines that are all caps or end with colon)
      if (line === line.toUpperCase() && line.length > 5) {
        markdownLines.push(`## ${line}`);
      } else if (line.endsWith(':') && !line.includes('.')) {
        markdownLines.push(`### ${line.slice(0, -1)}`);
      } else if (line.match(/^\d+\./)) {
        // Numbered lists
        markdownLines.push(line);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        // Bullet lists
        markdownLines.push(line);
      } else {
        markdownLines.push(line);
      }
    }

    processed = markdownLines.join('\n');
    processed = this.addFrameworkContext(processed, metadata.framework);
    processed = this.addComplianceMarkers(processed, metadata);

    return processed;
  }

  /**
   * Process JSON content
   */
  private async processJSON(content: string, metadata: ComplianceMetadata): Promise<string> {
    try {
      const jsonData = JSON.parse(content);
      let processed = '';

      // Convert JSON to markdown format
      if (Array.isArray(jsonData)) {
        processed = this.convertArrayToMarkdown(jsonData, metadata);
      } else if (typeof jsonData === 'object') {
        processed = this.convertObjectToMarkdown(jsonData, metadata);
      } else {
        processed = `\`\`\`json\n${JSON.stringify(jsonData, null, 2)}\n\`\`\``;
      }

      processed = this.addFrameworkContext(processed, metadata.framework);
      processed = this.addComplianceMarkers(processed, metadata);

      return processed;

    } catch (error) {
      logger.error('Error parsing JSON content', { error });
      // Treat as text if JSON parsing fails
      return await this.processText(content, metadata);
    }
  }

  /**
   * Convert array to markdown
   */
  private convertArrayToMarkdown(data: any[], metadata: ComplianceMetadata): string {
    const lines: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      
      if (typeof item === 'object' && item !== null) {
        lines.push(`## Item ${i + 1}`);
        lines.push('');
        lines.push(this.convertObjectToMarkdown(item, metadata, 3));
      } else {
        lines.push(`${i + 1}. ${String(item)}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Convert object to markdown
   */
  private convertObjectToMarkdown(data: any, metadata: ComplianceMetadata, headerLevel = 2): string {
    const lines: string[] = [];
    const headerPrefix = '#'.repeat(headerLevel);

    for (const [key, value] of Object.entries(data)) {
      const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      
      if (typeof value === 'object' && value !== null) {
        lines.push(`${headerPrefix} ${formattedKey}`);
        lines.push('');
        
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            if (typeof value[i] === 'object') {
              lines.push(`${headerPrefix}# ${formattedKey} ${i + 1}`);
              lines.push('');
              lines.push(this.convertObjectToMarkdown(value[i], metadata, headerLevel + 2));
            } else {
              lines.push(`- ${String(value[i])}`);
            }
          }
        } else {
          lines.push(this.convertObjectToMarkdown(value, metadata, headerLevel + 1));
        }
      } else {
        lines.push(`**${formattedKey}:** ${String(value)}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Add framework-specific context
   */
  private addFrameworkContext(content: string, framework: string): string {
    const frameworkInfo = this.getFrameworkInfo(framework);
    
    if (frameworkInfo) {
      const contextSection = `
## Framework Context

**Framework:** ${framework}
**Full Name:** ${frameworkInfo.fullName}
**Description:** ${frameworkInfo.description}
**Key Focus Areas:** ${frameworkInfo.focusAreas.join(', ')}

---

`;
      return contextSection + content;
    }

    return content;
  }

  /**
   * Add compliance-specific markers
   */
  private addComplianceMarkers(content: string, metadata: ComplianceMetadata): string {
    // Add semantic markers for better retrieval
    let processed = content;

    // Mark requirements
    processed = processed.replace(
      /\b(must|shall|required|mandatory)\b/gi,
      '**[REQUIREMENT]** $1'
    );

    // Mark recommendations
    processed = processed.replace(
      /\b(should|recommended|best practice)\b/gi,
      '**[RECOMMENDATION]** $1'
    );

    // Mark controls
    processed = processed.replace(
      /\b(control|safeguard|measure)\b/gi,
      '**[CONTROL]** $1'
    );

    // Add category markers
    if (metadata.category) {
      processed = `**[CATEGORY: ${metadata.category.toUpperCase()}]**\n\n${processed}`;
    }

    return processed;
  }

  /**
   * Generate metadata header
   */
  private generateMetadataHeader(metadata: ComplianceMetadata): string {
    const lines = [
      '---',
      `title: "${metadata.title}"`,
      `framework: "${metadata.framework}"`,
      `category: "${metadata.category}"`
    ];

    if (metadata.description) {
      lines.push(`description: "${metadata.description}"`);
    }

    if (metadata.version) {
      lines.push(`version: "${metadata.version}"`);
    }

    if (metadata.lastUpdated) {
      lines.push(`lastUpdated: "${metadata.lastUpdated}"`);
    }

    if (metadata.tags && metadata.tags.length > 0) {
      lines.push(`tags: [${metadata.tags.map(tag => `"${tag}"`).join(', ')}]`);
    }

    lines.push('---');

    return lines.join('\n');
  }

  /**
   * Get framework information
   */
  private getFrameworkInfo(framework: string): {
    fullName: string;
    description: string;
    focusAreas: string[];
  } | null {
    const frameworks: Record<string, any> = {
      'SOC2': {
        fullName: 'Service Organization Control 2',
        description: 'Framework for managing customer data based on five trust service criteria',
        focusAreas: ['Security', 'Availability', 'Processing Integrity', 'Confidentiality', 'Privacy']
      },
      'HIPAA': {
        fullName: 'Health Insurance Portability and Accountability Act',
        description: 'US legislation that provides data privacy and security provisions for safeguarding medical information',
        focusAreas: ['Administrative Safeguards', 'Physical Safeguards', 'Technical Safeguards']
      },
      'GDPR': {
        fullName: 'General Data Protection Regulation',
        description: 'EU regulation on data protection and privacy in the European Union and the European Economic Area',
        focusAreas: ['Lawfulness', 'Fairness', 'Transparency', 'Data Minimization', 'Accuracy', 'Storage Limitation', 'Security']
      },
      'PCI-DSS': {
        fullName: 'Payment Card Industry Data Security Standard',
        description: 'Information security standard for organizations that handle branded credit cards',
        focusAreas: ['Network Security', 'Data Protection', 'Vulnerability Management', 'Access Control', 'Monitoring', 'Information Security Policy']
      },
      'ISO27001': {
        fullName: 'ISO/IEC 27001',
        description: 'International standard for information security management systems',
        focusAreas: ['Information Security Policy', 'Risk Management', 'Asset Management', 'Access Control', 'Incident Management']
      }
    };

    return frameworks[framework.toUpperCase()] || null;
  }

  /**
   * Extract key terms and concepts from content
   */
  extractKeyTerms(content: string): string[] {
    const terms = new Set<string>();

    // Common compliance terms
    const complianceTerms = [
      'access control', 'authentication', 'authorization', 'encryption', 'audit',
      'monitoring', 'incident response', 'risk assessment', 'vulnerability',
      'data protection', 'privacy', 'confidentiality', 'integrity', 'availability',
      'backup', 'recovery', 'business continuity', 'change management',
      'security policy', 'training', 'awareness', 'compliance', 'governance'
    ];

    const lowerContent = content.toLowerCase();

    for (const term of complianceTerms) {
      if (lowerContent.includes(term)) {
        terms.add(term);
      }
    }

    // Extract AWS service names
    const awsServices = [
      'S3', 'IAM', 'EC2', 'VPC', 'CloudTrail', 'CloudWatch', 'KMS', 'RDS',
      'Lambda', 'API Gateway', 'ELB', 'Route 53', 'CloudFront', 'WAF'
    ];

    for (const service of awsServices) {
      if (content.includes(service)) {
        terms.add(service.toLowerCase());
      }
    }

    return Array.from(terms);
  }

  /**
   * Validate content quality
   */
  validateContent(content: string, metadata: ComplianceMetadata): {
    isValid: boolean;
    issues: string[];
    score: number;
  } {
    const issues: string[] = [];
    let score = 100;

    // Check minimum length
    if (content.length < 100) {
      issues.push('Content too short (minimum 100 characters)');
      score -= 20;
    }

    // Check for framework-specific terms
    const frameworkTerms = this.getFrameworkTerms(metadata.framework);
    const hasFrameworkTerms = frameworkTerms.some(term => 
      content.toLowerCase().includes(term.toLowerCase())
    );

    if (!hasFrameworkTerms) {
      issues.push(`Content lacks ${metadata.framework}-specific terminology`);
      score -= 15;
    }

    // Check for actionable content
    const actionableWords = ['must', 'should', 'implement', 'configure', 'ensure', 'verify'];
    const hasActionableContent = actionableWords.some(word => 
      content.toLowerCase().includes(word)
    );

    if (!hasActionableContent) {
      issues.push('Content lacks actionable guidance');
      score -= 10;
    }

    // Check for structure
    const hasHeaders = content.includes('#') || content.includes('**');
    if (!hasHeaders) {
      issues.push('Content lacks proper structure (headers, emphasis)');
      score -= 10;
    }

    return {
      isValid: issues.length === 0,
      issues,
      score: Math.max(0, score)
    };
  }

  /**
   * Get framework-specific terms
   */
  private getFrameworkTerms(framework: string): string[] {
    const terms: Record<string, string[]> = {
      'SOC2': ['trust services', 'security', 'availability', 'processing integrity', 'confidentiality', 'privacy'],
      'HIPAA': ['PHI', 'covered entity', 'business associate', 'administrative safeguards', 'physical safeguards', 'technical safeguards'],
      'GDPR': ['personal data', 'data subject', 'controller', 'processor', 'consent', 'legitimate interest', 'data protection officer'],
      'PCI-DSS': ['cardholder data', 'payment card', 'PAN', 'sensitive authentication data', 'compensating controls'],
      'ISO27001': ['ISMS', 'risk assessment', 'statement of applicability', 'management review', 'continual improvement']
    };

    return terms[framework.toUpperCase()] || [];
  }
}
