import { logger } from '../utils/logger';
import { AuditPackGeneratorError } from '../utils/errorHandler';
import { 
  ComplianceSummary,
  EvidenceItem,
  ComplianceControl,
  ComplianceGap,
  DateRange
} from '../types/auditPack';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for analyzing compliance status and generating summaries
 */
export class ComplianceAnalyzerService {
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
  }

  /**
   * Generate compliance summary
   */
  async generateComplianceSummary(
    tenantId: string,
    framework: string,
    dateRange?: DateRange,
    correlationId?: string
  ): Promise<ComplianceSummary> {
    try {
      logger.info('Generating compliance summary', {
        correlationId,
        tenantId,
        framework
      });

      // Get framework-specific controls
      const controls = this.getFrameworkControls(framework);
      
      // Analyze compliance status for each control
      const analyzedControls = await this.analyzeControls(tenantId, controls, dateRange, correlationId);
      
      // Calculate overall compliance score
      const overallScore = this.calculateOverallScore(analyzedControls);
      
      // Identify compliance gaps
      const gaps = this.identifyComplianceGaps(analyzedControls);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(analyzedControls, gaps);

      const summary: ComplianceSummary = {
        summaryId: uuidv4(),
        tenantId,
        framework,
        generatedAt: new Date().toISOString(),
        dateRange: dateRange || {
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        },
        overallScore,
        controls: analyzedControls,
        gaps,
        recommendations,
        statistics: {
          totalControls: controls.length,
          compliantControls: analyzedControls.filter(c => c.status === 'COMPLIANT').length,
          nonCompliantControls: analyzedControls.filter(c => c.status === 'NON_COMPLIANT').length,
          partiallyCompliantControls: analyzedControls.filter(c => c.status === 'PARTIALLY_COMPLIANT').length,
          notApplicableControls: analyzedControls.filter(c => c.status === 'NOT_APPLICABLE').length,
          criticalGaps: gaps.filter(g => g.severity === 'CRITICAL').length,
          highGaps: gaps.filter(g => g.severity === 'HIGH').length,
          mediumGaps: gaps.filter(g => g.severity === 'MEDIUM').length,
          lowGaps: gaps.filter(g => g.severity === 'LOW').length
        }
      };

      logger.info('Compliance summary generated successfully', {
        correlationId,
        tenantId,
        framework,
        overallScore,
        totalControls: summary.statistics.totalControls,
        compliantControls: summary.statistics.compliantControls
      });

      return summary;

    } catch (error) {
      logger.error('Error generating compliance summary', {
        correlationId,
        tenantId,
        framework,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AuditPackGeneratorError(
        `Failed to generate compliance summary: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Analyze compliance based on evidence
   */
  async analyzeCompliance(
    tenantId: string,
    framework: string,
    evidence: EvidenceItem[],
    correlationId?: string
  ): Promise<ComplianceSummary> {
    try {
      logger.info('Analyzing compliance from evidence', {
        correlationId,
        tenantId,
        framework,
        evidenceCount: evidence.length
      });

      // Get framework controls
      const controls = this.getFrameworkControls(framework);
      
      // Map evidence to controls
      const controlsWithEvidence = this.mapEvidenceToControls(controls, evidence);
      
      // Analyze each control based on available evidence
      const analyzedControls = this.analyzeControlsWithEvidence(controlsWithEvidence);
      
      // Calculate compliance score
      const overallScore = this.calculateOverallScore(analyzedControls);
      
      // Identify gaps
      const gaps = this.identifyComplianceGaps(analyzedControls);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(analyzedControls, gaps);

      const analysis: ComplianceSummary = {
        summaryId: uuidv4(),
        tenantId,
        framework,
        generatedAt: new Date().toISOString(),
        dateRange: {
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        },
        overallScore,
        controls: analyzedControls,
        gaps,
        recommendations,
        statistics: {
          totalControls: controls.length,
          compliantControls: analyzedControls.filter(c => c.status === 'COMPLIANT').length,
          nonCompliantControls: analyzedControls.filter(c => c.status === 'NON_COMPLIANT').length,
          partiallyCompliantControls: analyzedControls.filter(c => c.status === 'PARTIALLY_COMPLIANT').length,
          notApplicableControls: analyzedControls.filter(c => c.status === 'NOT_APPLICABLE').length,
          criticalGaps: gaps.filter(g => g.severity === 'CRITICAL').length,
          highGaps: gaps.filter(g => g.severity === 'HIGH').length,
          mediumGaps: gaps.filter(g => g.severity === 'MEDIUM').length,
          lowGaps: gaps.filter(g => g.severity === 'LOW').length
        }
      };

      logger.info('Compliance analysis completed', {
        correlationId,
        tenantId,
        framework,
        overallScore: analysis.overallScore,
        compliantControls: analysis.statistics.compliantControls,
        totalControls: analysis.statistics.totalControls
      });

      return analysis;

    } catch (error) {
      logger.error('Error analyzing compliance', {
        correlationId,
        tenantId,
        framework,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AuditPackGeneratorError(
        `Failed to analyze compliance: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get framework-specific controls
   */
  private getFrameworkControls(framework: string): ComplianceControl[] {
    const frameworkControls: Record<string, ComplianceControl[]> = {
      'SOC2': [
        {
          controlId: 'CC6.1',
          controlName: 'Logical and Physical Access Controls',
          description: 'The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events to meet the entity\'s objectives.',
          category: 'ACCESS_CONTROL',
          requirements: [
            'Multi-factor authentication for privileged users',
            'Regular access reviews',
            'Principle of least privilege',
            'Segregation of duties'
          ],
          testProcedures: [
            'Review user access provisioning process',
            'Test MFA configuration',
            'Validate access review procedures'
          ],
          status: 'PENDING',
          score: 0,
          evidence: [],
          lastAssessed: new Date().toISOString()
        },
        {
          controlId: 'CC6.2',
          controlName: 'System Access Monitoring',
          description: 'Prior to issuing system credentials and granting system access, the entity registers and authorizes new internal and external users whose access is administered by the entity.',
          category: 'MONITORING',
          requirements: [
            'User registration process',
            'Access authorization procedures',
            'Monitoring of system access',
            'Logging of authentication events'
          ],
          testProcedures: [
            'Review user registration procedures',
            'Test access monitoring systems',
            'Validate authentication logs'
          ],
          status: 'PENDING',
          score: 0,
          evidence: [],
          lastAssessed: new Date().toISOString()
        },
        {
          controlId: 'CC6.3',
          controlName: 'Network Security',
          description: 'The entity authorizes, modifies, or removes access to data, software, functions, and other protected information assets based on roles, responsibilities, or the system design and changes.',
          category: 'NETWORK_SECURITY',
          requirements: [
            'Network segmentation',
            'Firewall configuration',
            'Intrusion detection systems',
            'Network monitoring'
          ],
          testProcedures: [
            'Review network architecture',
            'Test firewall rules',
            'Validate intrusion detection'
          ],
          status: 'PENDING',
          score: 0,
          evidence: [],
          lastAssessed: new Date().toISOString()
        },
        {
          controlId: 'CC7.1',
          controlName: 'System Operations',
          description: 'To meet its objectives, the entity uses detection and monitoring procedures to identify (1) changes to configurations that result in the introduction of new vulnerabilities, and (2) susceptibilities to newly discovered vulnerabilities.',
          category: 'OPERATIONS',
          requirements: [
            'Configuration management',
            'Vulnerability scanning',
            'Change management process',
            'System monitoring'
          ],
          testProcedures: [
            'Review configuration management procedures',
            'Test vulnerability scanning process',
            'Validate change management controls'
          ],
          status: 'PENDING',
          score: 0,
          evidence: [],
          lastAssessed: new Date().toISOString()
        }
      ],
      'HIPAA': [
        {
          controlId: '164.308(a)(1)(i)',
          controlName: 'Security Officer',
          description: 'Assign security responsibilities to an individual',
          category: 'ADMINISTRATIVE',
          requirements: [
            'Designated security officer',
            'Security responsibilities documented',
            'Security officer training'
          ],
          testProcedures: [
            'Review security officer designation',
            'Validate security responsibilities',
            'Check training records'
          ],
          status: 'PENDING',
          score: 0,
          evidence: [],
          lastAssessed: new Date().toISOString()
        },
        {
          controlId: '164.312(a)(1)',
          controlName: 'Access Control',
          description: 'Implement technical policies and procedures for electronic information systems',
          category: 'TECHNICAL',
          requirements: [
            'Unique user identification',
            'Emergency access procedures',
            'Automatic logoff',
            'Encryption and decryption'
          ],
          testProcedures: [
            'Review access control procedures',
            'Test emergency access',
            'Validate automatic logoff'
          ],
          status: 'PENDING',
          score: 0,
          evidence: [],
          lastAssessed: new Date().toISOString()
        }
      ],
      'GDPR': [
        {
          controlId: 'Art. 25',
          controlName: 'Data Protection by Design and by Default',
          description: 'Implement appropriate technical and organisational measures to ensure data protection principles',
          category: 'DATA_PROTECTION',
          requirements: [
            'Privacy by design',
            'Data minimization',
            'Purpose limitation',
            'Storage limitation'
          ],
          testProcedures: [
            'Review data processing procedures',
            'Test data minimization controls',
            'Validate purpose limitation'
          ],
          status: 'PENDING',
          score: 0,
          evidence: [],
          lastAssessed: new Date().toISOString()
        },
        {
          controlId: 'Art. 32',
          controlName: 'Security of Processing',
          description: 'Implement appropriate technical and organisational measures to ensure security',
          category: 'SECURITY',
          requirements: [
            'Pseudonymisation and encryption',
            'Confidentiality and integrity',
            'Availability and resilience',
            'Regular testing and evaluation'
          ],
          testProcedures: [
            'Review encryption implementation',
            'Test backup and recovery',
            'Validate security testing'
          ],
          status: 'PENDING',
          score: 0,
          evidence: [],
          lastAssessed: new Date().toISOString()
        }
      ]
    };

    return frameworkControls[framework] || [];
  }

  /**
   * Analyze controls (mock implementation)
   */
  private async analyzeControls(
    tenantId: string,
    controls: ComplianceControl[],
    dateRange?: DateRange,
    correlationId?: string
  ): Promise<ComplianceControl[]> {
    // Mock analysis - in real implementation, this would check actual evidence
    return controls.map(control => ({
      ...control,
      status: Math.random() > 0.2 ? 'COMPLIANT' : 'NON_COMPLIANT',
      score: Math.random() > 0.2 ? Math.floor(Math.random() * 20) + 80 : Math.floor(Math.random() * 60) + 20,
      evidence: [
        `Evidence item 1 for ${control.controlId}`,
        `Evidence item 2 for ${control.controlId}`
      ],
      lastAssessed: new Date().toISOString(),
      assessor: 'compliance-engine',
      notes: `Assessment completed for ${control.controlName}`
    }));
  }

  /**
   * Map evidence to controls
   */
  private mapEvidenceToControls(controls: ComplianceControl[], evidence: EvidenceItem[]): ComplianceControl[] {
    return controls.map(control => {
      const relevantEvidence = evidence.filter(item => 
        item.metadata?.complianceFrameworks?.some(framework => 
          control.controlId.includes(framework) || 
          item.category === control.category
        )
      );

      return {
        ...control,
        evidence: relevantEvidence.map(item => item.title)
      };
    });
  }

  /**
   * Analyze controls with evidence
   */
  private analyzeControlsWithEvidence(controls: ComplianceControl[]): ComplianceControl[] {
    return controls.map(control => {
      const evidenceCount = control.evidence?.length || 0;
      let status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT' | 'NOT_APPLICABLE' = 'NON_COMPLIANT';
      let score = 0;

      if (evidenceCount >= 3) {
        status = 'COMPLIANT';
        score = Math.floor(Math.random() * 20) + 80; // 80-100
      } else if (evidenceCount >= 1) {
        status = 'PARTIALLY_COMPLIANT';
        score = Math.floor(Math.random() * 30) + 50; // 50-80
      } else {
        status = 'NON_COMPLIANT';
        score = Math.floor(Math.random() * 50); // 0-50
      }

      return {
        ...control,
        status,
        score,
        lastAssessed: new Date().toISOString(),
        assessor: 'evidence-analyzer',
        notes: `Analysis based on ${evidenceCount} evidence items`
      };
    });
  }

  /**
   * Calculate overall compliance score
   */
  private calculateOverallScore(controls: ComplianceControl[]): number {
    if (controls.length === 0) return 0;
    
    const totalScore = controls.reduce((sum, control) => sum + (control.score || 0), 0);
    return Math.round(totalScore / controls.length);
  }

  /**
   * Identify compliance gaps
   */
  private identifyComplianceGaps(controls: ComplianceControl[]): ComplianceGap[] {
    const gaps: ComplianceGap[] = [];

    controls.forEach(control => {
      if (control.status === 'NON_COMPLIANT' || control.status === 'PARTIALLY_COMPLIANT') {
        const severity = control.score && control.score < 30 ? 'CRITICAL' : 
                        control.score && control.score < 60 ? 'HIGH' : 
                        control.score && control.score < 80 ? 'MEDIUM' : 'LOW';

        gaps.push({
          gapId: uuidv4(),
          controlId: control.controlId,
          controlName: control.controlName,
          category: control.category,
          severity,
          description: `Control ${control.controlId} is ${control.status.toLowerCase()}`,
          impact: this.getGapImpact(control, severity),
          remediation: this.getRemediationSteps(control),
          estimatedEffort: this.estimateRemediationEffort(control, severity),
          priority: this.calculateGapPriority(control, severity)
        });
      }
    });

    return gaps.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(controls: ComplianceControl[], gaps: ComplianceGap[]): string[] {
    const recommendations: string[] = [];

    // High-level recommendations based on gaps
    const criticalGaps = gaps.filter(g => g.severity === 'CRITICAL');
    const highGaps = gaps.filter(g => g.severity === 'HIGH');

    if (criticalGaps.length > 0) {
      recommendations.push(`Address ${criticalGaps.length} critical compliance gaps immediately to reduce audit risk`);
    }

    if (highGaps.length > 0) {
      recommendations.push(`Prioritize remediation of ${highGaps.length} high-severity gaps within the next quarter`);
    }

    // Category-specific recommendations
    const categoryGaps = this.groupGapsByCategory(gaps);
    Object.entries(categoryGaps).forEach(([category, categoryGapList]) => {
      if (categoryGapList.length > 2) {
        recommendations.push(`Focus on ${category.toLowerCase()} improvements - ${categoryGapList.length} gaps identified`);
      }
    });

    // Overall recommendations
    const overallScore = this.calculateOverallScore(controls);
    if (overallScore < 70) {
      recommendations.push('Consider engaging compliance consultants to accelerate remediation efforts');
    }

    if (overallScore >= 85) {
      recommendations.push('Maintain current compliance posture through regular monitoring and assessment');
    }

    return recommendations;
  }

  /**
   * Get gap impact description
   */
  private getGapImpact(control: ComplianceControl, severity: string): string {
    const impacts = {
      'CRITICAL': `Critical compliance violation in ${control.category} may result in audit failure`,
      'HIGH': `High-risk gap in ${control.category} requires immediate attention`,
      'MEDIUM': `Medium-risk gap in ${control.category} should be addressed in next review cycle`,
      'LOW': `Low-risk gap in ${control.category} can be addressed during routine maintenance`
    };

    return impacts[severity as keyof typeof impacts] || 'Impact assessment needed';
  }

  /**
   * Get remediation steps
   */
  private getRemediationSteps(control: ComplianceControl): string[] {
    // Generic remediation steps based on control category
    const remediationMap: Record<string, string[]> = {
      'ACCESS_CONTROL': [
        'Review and update access control policies',
        'Implement multi-factor authentication',
        'Conduct access review and cleanup',
        'Document access procedures'
      ],
      'MONITORING': [
        'Configure comprehensive logging',
        'Set up monitoring dashboards',
        'Implement alerting mechanisms',
        'Establish log review procedures'
      ],
      'NETWORK_SECURITY': [
        'Review network architecture',
        'Update firewall configurations',
        'Implement network segmentation',
        'Deploy intrusion detection systems'
      ],
      'DATA_PROTECTION': [
        'Implement data classification',
        'Enable encryption at rest and in transit',
        'Establish data retention policies',
        'Configure backup and recovery'
      ]
    };

    return remediationMap[control.category] || [
      'Conduct detailed control assessment',
      'Develop remediation plan',
      'Implement necessary controls',
      'Test and validate implementation'
    ];
  }

  /**
   * Estimate remediation effort
   */
  private estimateRemediationEffort(control: ComplianceControl, severity: string): string {
    const effortMap = {
      'CRITICAL': '2-4 weeks',
      'HIGH': '1-3 weeks',
      'MEDIUM': '1-2 weeks',
      'LOW': '1-5 days'
    };

    return effortMap[severity as keyof typeof effortMap] || '1-2 weeks';
  }

  /**
   * Calculate gap priority
   */
  private calculateGapPriority(control: ComplianceControl, severity: string): number {
    const severityWeights = {
      'CRITICAL': 100,
      'HIGH': 75,
      'MEDIUM': 50,
      'LOW': 25
    };

    const categoryWeights = {
      'ACCESS_CONTROL': 1.2,
      'SECURITY': 1.1,
      'DATA_PROTECTION': 1.1,
      'MONITORING': 1.0,
      'OPERATIONS': 0.9,
      'ADMINISTRATIVE': 0.8
    };

    const severityWeight = severityWeights[severity as keyof typeof severityWeights] || 50;
    const categoryWeight = categoryWeights[control.category as keyof typeof categoryWeights] || 1.0;

    return Math.round(severityWeight * categoryWeight);
  }

  /**
   * Group gaps by category
   */
  private groupGapsByCategory(gaps: ComplianceGap[]): Record<string, ComplianceGap[]> {
    return gaps.reduce((grouped, gap) => {
      const category = gap.category;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(gap);
      return grouped;
    }, {} as Record<string, ComplianceGap[]>);
  }
}
