import { DynamoDBClient, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { CloudTrailClient, LookupEventsCommand } from '@aws-sdk/client-cloudtrail';
import { ConfigServiceClient, GetComplianceDetailsByConfigRuleCommand, DescribeConfigRulesCommand } from '@aws-sdk/client-config-service';
import { logger } from '../utils/logger';
import { AuditPackGeneratorError } from '../utils/errorHandler';
import { 
  EvidenceItem,
  EvidenceReport,
  DateRange,
  PolicyDocument,
  AuditLog,
  ComplianceEvidence
} from '../types/auditPack';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for collecting comprehensive audit evidence
 * Gathers findings, policies, logs, and compliance data
 */
export class EvidenceCollectorService {
  private dynamoClient: DynamoDBClient;
  private s3Client: S3Client;
  private cloudTrailClient: CloudTrailClient;
  private configClient: ConfigServiceClient;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.dynamoClient = new DynamoDBClient({ region: this.region });
    this.s3Client = new S3Client({ region: this.region });
    this.cloudTrailClient = new CloudTrailClient({ region: this.region });
    this.configClient = new ConfigServiceClient({ region: this.region });
  }

  /**
   * Collect comprehensive evidence for audit pack
   */
  async collectEvidence(
    tenantId: string,
    framework: string,
    dateRange?: DateRange,
    correlationId?: string
  ): Promise<EvidenceItem[]> {
    try {
      logger.info('Collecting audit evidence', {
        correlationId,
        tenantId,
        framework,
        dateRange
      });

      const evidence: EvidenceItem[] = [];

      // Collect different types of evidence in parallel
      const [
        findings,
        policies,
        auditLogs,
        complianceData,
        remediation,
        configurations
      ] = await Promise.all([
        this.collectFindings(tenantId, dateRange, correlationId),
        this.collectPolicies(tenantId, correlationId),
        this.collectAuditLogs(tenantId, dateRange, correlationId),
        this.collectComplianceData(tenantId, framework, correlationId),
        this.collectRemediationEvidence(tenantId, dateRange, correlationId),
        this.collectConfigurations(tenantId, correlationId)
      ]);

      evidence.push(...findings, ...policies, ...auditLogs, ...complianceData, ...remediation, ...configurations);

      logger.info('Evidence collection completed', {
        correlationId,
        tenantId,
        evidenceCount: evidence.length,
        findingsCount: findings.length,
        policiesCount: policies.length,
        auditLogsCount: auditLogs.length
      });

      return evidence;

    } catch (error) {
      logger.error('Error collecting evidence', {
        correlationId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AuditPackGeneratorError(
        `Failed to collect evidence: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate evidence report
   */
  async generateEvidenceReport(
    tenantId: string,
    framework: string,
    dateRange?: DateRange,
    correlationId?: string
  ): Promise<EvidenceReport> {
    try {
      logger.info('Generating evidence report', {
        correlationId,
        tenantId,
        framework
      });

      const evidenceItems = await this.collectEvidence(tenantId, framework, dateRange, correlationId);

      // Categorize evidence
      const categorizedEvidence = this.categorizeEvidence(evidenceItems);

      // Generate statistics
      const statistics = this.generateEvidenceStatistics(evidenceItems);

      const report: EvidenceReport = {
        reportId: uuidv4(),
        tenantId,
        framework,
        generatedAt: new Date().toISOString(),
        dateRange: dateRange || {
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        },
        evidenceItems,
        categories: categorizedEvidence,
        statistics,
        summary: {
          totalItems: evidenceItems.length,
          criticalEvidence: evidenceItems.filter(item => item.criticality === 'CRITICAL').length,
          highEvidence: evidenceItems.filter(item => item.criticality === 'HIGH').length,
          mediumEvidence: evidenceItems.filter(item => item.criticality === 'MEDIUM').length,
          lowEvidence: evidenceItems.filter(item => item.criticality === 'LOW').length,
          coveragePercentage: this.calculateCoveragePercentage(evidenceItems, framework)
        }
      };

      logger.info('Evidence report generated successfully', {
        correlationId,
        tenantId,
        totalItems: report.summary.totalItems,
        coveragePercentage: report.summary.coveragePercentage
      });

      return report;

    } catch (error) {
      logger.error('Error generating evidence report', {
        correlationId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AuditPackGeneratorError(
        `Failed to generate evidence report: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Collect findings evidence
   */
  private async collectFindings(tenantId: string, dateRange?: DateRange, correlationId?: string): Promise<EvidenceItem[]> {
    try {
      logger.debug('Collecting findings evidence', { correlationId, tenantId });

      // In a real implementation, this would query DynamoDB findings table
      // For now, return mock findings evidence
      const mockFindings: EvidenceItem[] = [
        {
          evidenceId: uuidv4(),
          type: 'FINDING',
          category: 'SECURITY',
          title: 'S3 Bucket Encryption Not Enabled',
          description: 'S3 bucket "data-backup" does not have encryption enabled',
          source: 'compliance-scan',
          timestamp: '2023-01-01T10:30:00Z',
          criticality: 'HIGH',
          status: 'RESOLVED',
          metadata: {
            resourceType: 'S3_BUCKET',
            resourceId: 'data-backup',
            ruleId: 'S3_ENCRYPTION_ENABLED',
            severity: 'HIGH',
            complianceFrameworks: ['SOC2', 'HIPAA']
          },
          evidence: {
            resourceConfiguration: {
              bucketName: 'data-backup',
              encryption: null,
              versioning: 'Enabled',
              publicAccess: 'Blocked'
            },
            scanResults: {
              scanId: 'scan-123',
              scanTime: '2023-01-01T10:30:00Z',
              rulesPassed: 15,
              rulesFailed: 1
            }
          },
          remediation: {
            action: 'ENABLE_S3_ENCRYPTION',
            appliedAt: '2023-01-01T11:00:00Z',
            appliedBy: 'auto-remediation',
            status: 'SUCCESS'
          }
        },
        {
          evidenceId: uuidv4(),
          type: 'FINDING',
          category: 'ACCESS_CONTROL',
          title: 'IAM User Without MFA',
          description: 'IAM user "service-account" does not have MFA enabled',
          source: 'compliance-scan',
          timestamp: '2023-01-01T10:35:00Z',
          criticality: 'MEDIUM',
          status: 'OPEN',
          metadata: {
            resourceType: 'IAM_USER',
            resourceId: 'service-account',
            ruleId: 'IAM_MFA_ENABLED',
            severity: 'MEDIUM',
            complianceFrameworks: ['SOC2']
          },
          evidence: {
            resourceConfiguration: {
              userName: 'service-account',
              mfaDevices: [],
              lastActivity: '2023-01-01T09:00:00Z',
              policies: ['ServiceAccountPolicy']
            }
          }
        }
      ];

      return mockFindings;

    } catch (error) {
      logger.warn('Error collecting findings evidence', {
        correlationId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Collect policies evidence
   */
  private async collectPolicies(tenantId: string, correlationId?: string): Promise<EvidenceItem[]> {
    try {
      logger.debug('Collecting policies evidence', { correlationId, tenantId });

      // Mock policy evidence
      const mockPolicies: EvidenceItem[] = [
        {
          evidenceId: uuidv4(),
          type: 'POLICY',
          category: 'GOVERNANCE',
          title: 'Information Security Policy',
          description: 'Comprehensive information security policy document',
          source: 'policy-management',
          timestamp: '2023-01-01T00:00:00Z',
          criticality: 'HIGH',
          status: 'ACTIVE',
          metadata: {
            policyType: 'SECURITY',
            version: '2.1',
            approvedBy: 'CISO',
            effectiveDate: '2023-01-01T00:00:00Z',
            reviewDate: '2023-07-01T00:00:00Z',
            complianceFrameworks: ['SOC2', 'HIPAA', 'GDPR']
          },
          evidence: {
            policyDocument: {
              title: 'Information Security Policy',
              version: '2.1',
              sections: [
                'Access Control',
                'Data Classification',
                'Incident Response',
                'Risk Management',
                'Security Awareness'
              ],
              approvals: [
                {
                  role: 'CISO',
                  name: 'John Smith',
                  date: '2023-01-01T00:00:00Z'
                }
              ]
            }
          }
        },
        {
          evidenceId: uuidv4(),
          type: 'POLICY',
          category: 'DATA_PROTECTION',
          title: 'Data Retention Policy',
          description: 'Policy governing data retention and disposal',
          source: 'policy-management',
          timestamp: '2023-01-01T00:00:00Z',
          criticality: 'HIGH',
          status: 'ACTIVE',
          metadata: {
            policyType: 'DATA_RETENTION',
            version: '1.3',
            approvedBy: 'DPO',
            effectiveDate: '2023-01-01T00:00:00Z',
            complianceFrameworks: ['GDPR', 'HIPAA']
          }
        }
      ];

      return mockPolicies;

    } catch (error) {
      logger.warn('Error collecting policies evidence', {
        correlationId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Collect audit logs evidence
   */
  private async collectAuditLogs(tenantId: string, dateRange?: DateRange, correlationId?: string): Promise<EvidenceItem[]> {
    try {
      logger.debug('Collecting audit logs evidence', { correlationId, tenantId });

      // Mock audit logs evidence
      const mockAuditLogs: EvidenceItem[] = [
        {
          evidenceId: uuidv4(),
          type: 'AUDIT_LOG',
          category: 'ACCESS_CONTROL',
          title: 'User Login Activity',
          description: 'Audit trail of user authentication events',
          source: 'cloudtrail',
          timestamp: '2023-01-01T12:00:00Z',
          criticality: 'MEDIUM',
          status: 'ACTIVE',
          metadata: {
            logType: 'AUTHENTICATION',
            eventCount: 1250,
            timeSpan: '90 days',
            complianceFrameworks: ['SOC2']
          },
          evidence: {
            auditTrail: {
              totalEvents: 1250,
              successfulLogins: 1180,
              failedLogins: 70,
              uniqueUsers: 45,
              timeRange: {
                startDate: '2022-10-01T00:00:00Z',
                endDate: '2023-01-01T00:00:00Z'
              }
            }
          }
        },
        {
          evidenceId: uuidv4(),
          type: 'AUDIT_LOG',
          category: 'DATA_ACCESS',
          title: 'Data Access Logs',
          description: 'Audit trail of data access and modification events',
          source: 'application-logs',
          timestamp: '2023-01-01T12:00:00Z',
          criticality: 'HIGH',
          status: 'ACTIVE',
          metadata: {
            logType: 'DATA_ACCESS',
            eventCount: 5420,
            timeSpan: '90 days',
            complianceFrameworks: ['SOC2', 'HIPAA']
          }
        }
      ];

      return mockAuditLogs;

    } catch (error) {
      logger.warn('Error collecting audit logs evidence', {
        correlationId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Collect compliance data evidence
   */
  private async collectComplianceData(tenantId: string, framework: string, correlationId?: string): Promise<EvidenceItem[]> {
    try {
      logger.debug('Collecting compliance data evidence', { correlationId, tenantId, framework });

      // Mock compliance evidence
      const mockComplianceData: EvidenceItem[] = [
        {
          evidenceId: uuidv4(),
          type: 'COMPLIANCE_ASSESSMENT',
          category: 'FRAMEWORK_COMPLIANCE',
          title: `${framework} Compliance Assessment`,
          description: `Comprehensive ${framework} compliance assessment results`,
          source: 'compliance-engine',
          timestamp: '2023-01-01T15:00:00Z',
          criticality: 'HIGH',
          status: 'COMPLETED',
          metadata: {
            framework,
            assessmentType: 'COMPREHENSIVE',
            controlsEvaluated: 64,
            controlsPassed: 56,
            controlsFailed: 8,
            complianceScore: 87.5,
            complianceFrameworks: [framework]
          },
          evidence: {
            assessmentResults: {
              overallScore: 87.5,
              controlResults: [
                {
                  controlId: 'CC6.1',
                  controlName: 'Logical and Physical Access Controls',
                  status: 'COMPLIANT',
                  evidence: ['IAM policies', 'MFA configuration', 'Access logs']
                },
                {
                  controlId: 'CC6.2',
                  controlName: 'System Access Monitoring',
                  status: 'NON_COMPLIANT',
                  evidence: ['Incomplete logging configuration']
                }
              ]
            }
          }
        }
      ];

      return mockComplianceData;

    } catch (error) {
      logger.warn('Error collecting compliance data evidence', {
        correlationId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Collect remediation evidence
   */
  private async collectRemediationEvidence(tenantId: string, dateRange?: DateRange, correlationId?: string): Promise<EvidenceItem[]> {
    try {
      logger.debug('Collecting remediation evidence', { correlationId, tenantId });

      // Mock remediation evidence
      const mockRemediation: EvidenceItem[] = [
        {
          evidenceId: uuidv4(),
          type: 'REMEDIATION',
          category: 'SECURITY_FIX',
          title: 'S3 Encryption Remediation',
          description: 'Automated remediation applied to enable S3 bucket encryption',
          source: 'auto-remediation',
          timestamp: '2023-01-01T11:00:00Z',
          criticality: 'HIGH',
          status: 'COMPLETED',
          metadata: {
            remediationType: 'AUTOMATED',
            findingId: 'finding-123',
            actionTaken: 'ENABLE_S3_ENCRYPTION',
            complianceFrameworks: ['SOC2', 'HIPAA']
          },
          evidence: {
            remediationDetails: {
              beforeState: {
                encryption: null,
                complianceStatus: 'NON_COMPLIANT'
              },
              afterState: {
                encryption: 'AES256',
                complianceStatus: 'COMPLIANT'
              },
              approvals: [
                {
                  approver: 'security-team',
                  timestamp: '2023-01-01T10:45:00Z'
                }
              ]
            }
          }
        }
      ];

      return mockRemediation;

    } catch (error) {
      logger.warn('Error collecting remediation evidence', {
        correlationId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Collect configuration evidence
   */
  private async collectConfigurations(tenantId: string, correlationId?: string): Promise<EvidenceItem[]> {
    try {
      logger.debug('Collecting configuration evidence', { correlationId, tenantId });

      // Mock configuration evidence
      const mockConfigurations: EvidenceItem[] = [
        {
          evidenceId: uuidv4(),
          type: 'CONFIGURATION',
          category: 'SYSTEM_CONFIG',
          title: 'Security Configuration Baseline',
          description: 'Current security configuration settings and baselines',
          source: 'config-service',
          timestamp: '2023-01-01T16:00:00Z',
          criticality: 'MEDIUM',
          status: 'ACTIVE',
          metadata: {
            configurationType: 'SECURITY_BASELINE',
            resourcesEvaluated: 150,
            compliantResources: 142,
            nonCompliantResources: 8,
            complianceFrameworks: ['SOC2']
          },
          evidence: {
            configurationSnapshot: {
              evaluationTime: '2023-01-01T16:00:00Z',
              rules: [
                {
                  ruleName: 's3-bucket-public-access-prohibited',
                  complianceStatus: 'COMPLIANT',
                  resourceCount: 25
                },
                {
                  ruleName: 'iam-password-policy',
                  complianceStatus: 'NON_COMPLIANT',
                  resourceCount: 1
                }
              ]
            }
          }
        }
      ];

      return mockConfigurations;

    } catch (error) {
      logger.warn('Error collecting configuration evidence', {
        correlationId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Categorize evidence by type and category
   */
  private categorizeEvidence(evidenceItems: EvidenceItem[]): Record<string, EvidenceItem[]> {
    const categories: Record<string, EvidenceItem[]> = {};

    evidenceItems.forEach(item => {
      const category = item.category;
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(item);
    });

    return categories;
  }

  /**
   * Generate evidence statistics
   */
  private generateEvidenceStatistics(evidenceItems: EvidenceItem[]): Record<string, any> {
    return {
      totalItems: evidenceItems.length,
      byType: {
        findings: evidenceItems.filter(item => item.type === 'FINDING').length,
        policies: evidenceItems.filter(item => item.type === 'POLICY').length,
        auditLogs: evidenceItems.filter(item => item.type === 'AUDIT_LOG').length,
        complianceAssessments: evidenceItems.filter(item => item.type === 'COMPLIANCE_ASSESSMENT').length,
        remediation: evidenceItems.filter(item => item.type === 'REMEDIATION').length,
        configurations: evidenceItems.filter(item => item.type === 'CONFIGURATION').length
      },
      byCriticality: {
        critical: evidenceItems.filter(item => item.criticality === 'CRITICAL').length,
        high: evidenceItems.filter(item => item.criticality === 'HIGH').length,
        medium: evidenceItems.filter(item => item.criticality === 'MEDIUM').length,
        low: evidenceItems.filter(item => item.criticality === 'LOW').length
      },
      byStatus: {
        active: evidenceItems.filter(item => item.status === 'ACTIVE').length,
        resolved: evidenceItems.filter(item => item.status === 'RESOLVED').length,
        open: evidenceItems.filter(item => item.status === 'OPEN').length,
        completed: evidenceItems.filter(item => item.status === 'COMPLETED').length
      }
    };
  }

  /**
   * Calculate coverage percentage for compliance framework
   */
  private calculateCoveragePercentage(evidenceItems: EvidenceItem[], framework: string): number {
    // Mock calculation - in real implementation, this would check against framework requirements
    const frameworkRequirements = {
      'SOC2': 64,
      'HIPAA': 45,
      'GDPR': 35,
      'PCI-DSS': 78
    };

    const requiredControls = frameworkRequirements[framework as keyof typeof frameworkRequirements] || 50;
    const coveredControls = evidenceItems.filter(item => 
      item.metadata?.complianceFrameworks?.includes(framework)
    ).length;

    return Math.min(Math.round((coveredControls / requiredControls) * 100), 100);
  }
}
