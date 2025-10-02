import { WorkflowDefinition } from '../types/workflow';

/**
 * Service for managing workflow definitions
 * Provides workflow templates and state machine definitions
 */
export class WorkflowDefinitionService {
  
  /**
   * Get workflow definition by type
   */
  getWorkflowDefinition(workflowType: string): WorkflowDefinition | null {
    const definitions = this.getAllWorkflowDefinitions();
    return definitions.find(d => d.workflowType === workflowType) || null;
  }

  /**
   * Get all available workflow definitions
   */
  getAllWorkflowDefinitions(): WorkflowDefinition[] {
    return [
      this.getComplianceScanWorkflow(),
      this.getRemediationWorkflow(),
      this.getComplianceAssessmentWorkflow(),
      this.getIncidentResponseWorkflow(),
      this.getAuditPackGenerationWorkflow(),
      this.getContinuousMonitoringWorkflow()
    ];
  }

  /**
   * Compliance Scan Workflow
   * Orchestrates comprehensive environment scanning
   */
  private getComplianceScanWorkflow(): WorkflowDefinition {
    return {
      workflowType: 'compliance-scan',
      name: 'Compliance Environment Scan',
      description: 'Comprehensive scan of AWS environment for compliance violations',
      version: '1.0.0',
      stateMachineName: 'ComplianceScanWorkflow',
      requiredParameters: ['tenantId'],
      optionalParameters: ['regions', 'services', 'scanType', 'notificationTargets'],
      parameterSchema: {
        tenantId: { type: 'string', required: true },
        regions: { type: 'array', items: { type: 'string' } },
        services: { type: 'array', items: { type: 'string' } },
        scanType: { type: 'string', enum: ['full', 'security', 'compliance', 'cost'] },
        notificationTargets: { type: 'array', items: { type: 'string' } }
      },
      estimatedDuration: '10-30 minutes',
      stateMachineDefinition: {
        Comment: 'Compliance Environment Scan Workflow',
        StartAt: 'InitializeScan',
        States: {
          InitializeScan: {
            Type: 'Task',
            Resource: '${ScanEnvironmentLambdaArn}',
            Parameters: {
              'action': 'initialize',
              'tenantId.$': '$.tenantId',
              'scanType.$': '$.parameters.scanType',
              'regions.$': '$.parameters.regions',
              'services.$': '$.parameters.services',
              'correlationId.$': '$.correlationId'
            },
            ResultPath: '$.scanJob',
            Next: 'DiscoverResources',
            Retry: [
              {
                ErrorEquals: ['States.TaskFailed'],
                IntervalSeconds: 2,
                MaxAttempts: 3,
                BackoffRate: 2.0
              }
            ],
            Catch: [
              {
                ErrorEquals: ['States.ALL'],
                Next: 'HandleScanError',
                ResultPath: '$.error'
              }
            ]
          },
          DiscoverResources: {
            Type: 'Parallel',
            Branches: [
              {
                StartAt: 'DiscoverS3Resources',
                States: {
                  DiscoverS3Resources: {
                    Type: 'Task',
                    Resource: '${ScanEnvironmentLambdaArn}',
                    Parameters: {
                      'action': 'discover',
                      'service': 'S3',
                      'scanJobId.$': '$.scanJob.scanJobId',
                      'tenantId.$': '$.tenantId',
                      'correlationId.$': '$.correlationId'
                    },
                    End: true
                  }
                }
              },
              {
                StartAt: 'DiscoverIAMResources',
                States: {
                  DiscoverIAMResources: {
                    Type: 'Task',
                    Resource: '${ScanEnvironmentLambdaArn}',
                    Parameters: {
                      'action': 'discover',
                      'service': 'IAM',
                      'scanJobId.$': '$.scanJob.scanJobId',
                      'tenantId.$': '$.tenantId',
                      'correlationId.$': '$.correlationId'
                    },
                    End: true
                  }
                }
              },
              {
                StartAt: 'DiscoverEC2Resources',
                States: {
                  DiscoverEC2Resources: {
                    Type: 'Task',
                    Resource: '${ScanEnvironmentLambdaArn}',
                    Parameters: {
                      'action': 'discover',
                      'service': 'EC2',
                      'scanJobId.$': '$.scanJob.scanJobId',
                      'tenantId.$': '$.tenantId',
                      'correlationId.$': '$.correlationId'
                    },
                    End: true
                  }
                }
              }
            ],
            ResultPath: '$.discoveryResults',
            Next: 'AnalyzeCompliance',
            Catch: [
              {
                ErrorEquals: ['States.ALL'],
                Next: 'HandleScanError',
                ResultPath: '$.error'
              }
            ]
          },
          AnalyzeCompliance: {
            Type: 'Task',
            Resource: '${ScanEnvironmentLambdaArn}',
            Parameters: {
              'action': 'analyze',
              'scanJobId.$': '$.scanJob.scanJobId',
              'tenantId.$': '$.tenantId',
              'correlationId.$': '$.correlationId'
            },
            ResultPath: '$.analysisResults',
            Next: 'StoreFindings',
            Retry: [
              {
                ErrorEquals: ['States.TaskFailed'],
                IntervalSeconds: 5,
                MaxAttempts: 2,
                BackoffRate: 2.0
              }
            ]
          },
          StoreFindings: {
            Type: 'Task',
            Resource: '${FindingsStorageLambdaArn}',
            Parameters: {
              'action': 'store',
              'scanJobId.$': '$.scanJob.scanJobId',
              'findings.$': '$.analysisResults.findings',
              'tenantId.$': '$.tenantId',
              'correlationId.$': '$.correlationId'
            },
            ResultPath: '$.storageResults',
            Next: 'CheckNotificationRequired'
          },
          CheckNotificationRequired: {
            Type: 'Choice',
            Choices: [
              {
                Variable: '$.parameters.notificationTargets',
                IsPresent: true,
                Next: 'SendNotifications'
              }
            ],
            Default: 'GenerateSummaryReport'
          },
          SendNotifications: {
            Type: 'Task',
            Resource: 'arn:aws:states:::sns:publish',
            Parameters: {
              'TopicArn': '${NotificationTopicArn}',
              'Message.$': '$.analysisResults.summary',
              'Subject': 'Compliance Scan Completed'
            },
            ResultPath: '$.notificationResults',
            Next: 'GenerateSummaryReport'
          },
          GenerateSummaryReport: {
            Type: 'Task',
            Resource: '${HTMLReportGeneratorLambdaArn}',
            Parameters: {
              'action': 'generate',
              'reportType': 'scan-summary',
              'scanJobId.$': '$.scanJob.scanJobId',
              'tenantId.$': '$.tenantId',
              'correlationId.$': '$.correlationId'
            },
            ResultPath: '$.reportResults',
            Next: 'CompleteScan'
          },
          CompleteScan: {
            Type: 'Task',
            Resource: '${ScanEnvironmentLambdaArn}',
            Parameters: {
              'action': 'complete',
              'scanJobId.$': '$.scanJob.scanJobId',
              'tenantId.$': '$.tenantId',
              'correlationId.$': '$.correlationId'
            },
            End: true
          },
          HandleScanError: {
            Type: 'Task',
            Resource: '${ScanEnvironmentLambdaArn}',
            Parameters: {
              'action': 'error',
              'scanJobId.$': '$.scanJob.scanJobId',
              'error.$': '$.error',
              'tenantId.$': '$.tenantId',
              'correlationId.$': '$.correlationId'
            },
            Next: 'ScanFailed'
          },
          ScanFailed: {
            Type: 'Fail',
            Cause: 'Compliance scan failed',
            Error: 'ScanExecutionError'
          }
        }
      }
    };
  }

  /**
   * Remediation Workflow
   * Orchestrates safe remediation of compliance violations
   */
  private getRemediationWorkflow(): WorkflowDefinition {
    return {
      workflowType: 'remediation',
      name: 'Compliance Remediation',
      description: 'Safe remediation of compliance violations with approval and rollback',
      version: '1.0.0',
      stateMachineName: 'RemediationWorkflow',
      requiredParameters: ['tenantId', 'findingIds'],
      optionalParameters: ['approvalRequired', 'dryRun', 'notificationTargets'],
      parameterSchema: {
        tenantId: { type: 'string', required: true },
        findingIds: { type: 'array', items: { type: 'string' }, required: true },
        approvalRequired: { type: 'boolean', default: true },
        dryRun: { type: 'boolean', default: false },
        notificationTargets: { type: 'array', items: { type: 'string' } }
      },
      estimatedDuration: '5-60 minutes',
      stateMachineDefinition: {
        Comment: 'Compliance Remediation Workflow',
        StartAt: 'InitializeRemediation',
        States: {
          InitializeRemediation: {
            Type: 'Task',
            Resource: '${ApplyFixLambdaArn}',
            Parameters: {
              'action': 'initialize',
              'tenantId.$': '$.tenantId',
              'findingIds.$': '$.parameters.findingIds',
              'correlationId.$': '$.correlationId'
            },
            ResultPath: '$.remediationJob',
            Next: 'CheckApprovalRequired'
          },
          CheckApprovalRequired: {
            Type: 'Choice',
            Choices: [
              {
                Variable: '$.parameters.approvalRequired',
                BooleanEquals: true,
                Next: 'WaitForApproval'
              }
            ],
            Default: 'ValidateFindings'
          },
          WaitForApproval: {
            Type: 'Wait',
            Seconds: 300,
            Next: 'CheckApprovalStatus'
          },
          CheckApprovalStatus: {
            Type: 'Task',
            Resource: '${ApplyFixLambdaArn}',
            Parameters: {
              'action': 'checkApproval',
              'remediationJobId.$': '$.remediationJob.remediationJobId',
              'tenantId.$': '$.tenantId',
              'correlationId.$': '$.correlationId'
            },
            Next: 'EvaluateApproval'
          },
          EvaluateApproval: {
            Type: 'Choice',
            Choices: [
              {
                Variable: '$.approvalStatus',
                StringEquals: 'APPROVED',
                Next: 'ValidateFindings'
              },
              {
                Variable: '$.approvalStatus',
                StringEquals: 'REJECTED',
                Next: 'RemediationRejected'
              }
            ],
            Default: 'WaitForApproval'
          },
          ValidateFindings: {
            Type: 'Task',
            Resource: '${ApplyFixLambdaArn}',
            Parameters: {
              'action': 'validate',
              'remediationJobId.$': '$.remediationJob.remediationJobId',
              'tenantId.$': '$.tenantId',
              'correlationId.$': '$.correlationId'
            },
            ResultPath: '$.validationResults',
            Next: 'CheckDryRun'
          },
          CheckDryRun: {
            Type: 'Choice',
            Choices: [
              {
                Variable: '$.parameters.dryRun',
                BooleanEquals: true,
                Next: 'PerformDryRun'
              }
            ],
            Default: 'ApplyRemediations'
          },
          PerformDryRun: {
            Type: 'Task',
            Resource: '${ApplyFixLambdaArn}',
            Parameters: {
              'action': 'dryRun',
              'remediationJobId.$': '$.remediationJob.remediationJobId',
              'tenantId.$': '$.tenantId',
              'correlationId.$': '$.correlationId'
            },
            ResultPath: '$.dryRunResults',
            Next: 'DryRunComplete'
          },
          ApplyRemediations: {
            Type: 'Map',
            ItemsPath: '$.validationResults.remediations',
            MaxConcurrency: 3,
            Iterator: {
              StartAt: 'ApplySingleRemediation',
              States: {
                ApplySingleRemediation: {
                  Type: 'Task',
                  Resource: '${ApplyFixLambdaArn}',
                  Parameters: {
                    'action': 'apply',
                    'remediation.$': '$',
                    'remediationJobId.$': '$.remediationJobId',
                    'tenantId.$': '$.tenantId',
                    'correlationId.$': '$.correlationId'
                  },
                  End: true,
                  Retry: [
                    {
                      ErrorEquals: ['States.TaskFailed'],
                      IntervalSeconds: 10,
                      MaxAttempts: 2,
                      BackoffRate: 2.0
                    }
                  ],
                  Catch: [
                    {
                      ErrorEquals: ['States.ALL'],
                      ResultPath: '$.error',
                      Next: 'RemediationFailed'
                    }
                  ]
                },
                RemediationFailed: {
                  Type: 'Pass',
                  Result: { status: 'FAILED' },
                  End: true
                }
              }
            },
            ResultPath: '$.remediationResults',
            Next: 'ValidateRemediations'
          },
          ValidateRemediations: {
            Type: 'Task',
            Resource: '${ApplyFixLambdaArn}',
            Parameters: {
              'action': 'validateResults',
              'remediationJobId.$': '$.remediationJob.remediationJobId',
              'tenantId.$': '$.tenantId',
              'correlationId.$': '$.correlationId'
            },
            ResultPath: '$.validationResults',
            Next: 'CompleteRemediation'
          },
          CompleteRemediation: {
            Type: 'Task',
            Resource: '${ApplyFixLambdaArn}',
            Parameters: {
              'action': 'complete',
              'remediationJobId.$': '$.remediationJob.remediationJobId',
              'tenantId.$': '$.tenantId',
              'correlationId.$': '$.correlationId'
            },
            End: true
          },
          DryRunComplete: {
            Type: 'Pass',
            Result: { status: 'DRY_RUN_COMPLETE' },
            End: true
          },
          RemediationRejected: {
            Type: 'Pass',
            Result: { status: 'REJECTED' },
            End: true
          }
        }
      }
    };
  }

  /**
   * Compliance Assessment Workflow
   * Comprehensive compliance assessment with reporting
   */
  private getComplianceAssessmentWorkflow(): WorkflowDefinition {
    return {
      workflowType: 'compliance-assessment',
      name: 'Compliance Assessment',
      description: 'Comprehensive compliance assessment with detailed reporting',
      version: '1.0.0',
      stateMachineName: 'ComplianceAssessmentWorkflow',
      requiredParameters: ['tenantId', 'framework'],
      optionalParameters: ['scope', 'reportFormat', 'includeRecommendations'],
      estimatedDuration: '30-90 minutes',
      stateMachineDefinition: {
        Comment: 'Comprehensive Compliance Assessment Workflow',
        StartAt: 'InitializeAssessment',
        States: {
          InitializeAssessment: {
            Type: 'Pass',
            Next: 'RunComplianceScan'
          },
          RunComplianceScan: {
            Type: 'Task',
            Resource: 'arn:aws:states:::states:startExecution.sync',
            Parameters: {
              'StateMachineArn': '${ComplianceScanWorkflowArn}',
              'Input': {
                'tenantId.$': '$.tenantId',
                'parameters': {
                  'scanType': 'compliance',
                  'framework.$': '$.parameters.framework'
                },
                'correlationId.$': '$.correlationId'
              }
            },
            ResultPath: '$.scanResults',
            Next: 'AnalyzeGaps'
          },
          AnalyzeGaps: {
            Type: 'Task',
            Resource: '${FindingsStorageLambdaArn}',
            Parameters: {
              'action': 'analyzeGaps',
              'framework.$': '$.parameters.framework',
              'tenantId.$': '$.tenantId',
              'correlationId.$': '$.correlationId'
            },
            ResultPath: '$.gapAnalysis',
            Next: 'GenerateRecommendations'
          },
          GenerateRecommendations: {
            Type: 'Task',
            Resource: '${BedrockKnowledgeBaseLambdaArn}',
            Parameters: {
              'action': 'generateRecommendations',
              'framework.$': '$.parameters.framework',
              'findings.$': '$.gapAnalysis.findings',
              'tenantId.$': '$.tenantId',
              'correlationId.$': '$.correlationId'
            },
            ResultPath: '$.recommendations',
            Next: 'GenerateAssessmentReport'
          },
          GenerateAssessmentReport: {
            Type: 'Task',
            Resource: '${HTMLReportGeneratorLambdaArn}',
            Parameters: {
              'action': 'generate',
              'reportType': 'compliance-assessment',
              'framework.$': '$.parameters.framework',
              'gapAnalysis.$': '$.gapAnalysis',
              'recommendations.$': '$.recommendations',
              'tenantId.$': '$.tenantId',
              'correlationId.$': '$.correlationId'
            },
            End: true
          }
        }
      }
    };
  }

  /**
   * Incident Response Workflow
   * Automated incident response for compliance violations
   */
  private getIncidentResponseWorkflow(): WorkflowDefinition {
    return {
      workflowType: 'incident-response',
      name: 'Incident Response',
      description: 'Automated incident response for critical compliance violations',
      version: '1.0.0',
      stateMachineName: 'IncidentResponseWorkflow',
      requiredParameters: ['tenantId', 'incidentType'],
      optionalParameters: ['severity', 'autoRemediate'],
      estimatedDuration: '5-30 minutes',
      stateMachineDefinition: {
        Comment: 'Incident Response Workflow',
        StartAt: 'ClassifyIncident',
        States: {
          ClassifyIncident: {
            Type: 'Task',
            Resource: '${FindingsStorageLambdaArn}',
            Parameters: {
              'action': 'classify',
              'incidentType.$': '$.parameters.incidentType',
              'tenantId.$': '$.tenantId',
              'correlationId.$': '$.correlationId'
            },
            ResultPath: '$.classification',
            Next: 'DetermineResponse'
          },
          DetermineResponse: {
            Type: 'Choice',
            Choices: [
              {
                Variable: '$.classification.severity',
                StringEquals: 'CRITICAL',
                Next: 'ImmediateResponse'
              },
              {
                Variable: '$.classification.severity',
                StringEquals: 'HIGH',
                Next: 'UrgentResponse'
              }
            ],
            Default: 'StandardResponse'
          },
          ImmediateResponse: {
            Type: 'Parallel',
            Branches: [
              {
                StartAt: 'NotifySecurityTeam',
                States: {
                  NotifySecurityTeam: {
                    Type: 'Task',
                    Resource: 'arn:aws:states:::sns:publish',
                    Parameters: {
                      'TopicArn': '${CriticalIncidentTopicArn}',
                      'Message.$': '$.classification.description'
                    },
                    End: true
                  }
                }
              },
              {
                StartAt: 'AutoRemediate',
                States: {
                  AutoRemediate: {
                    Type: 'Task',
                    Resource: 'arn:aws:states:::states:startExecution.sync',
                    Parameters: {
                      'StateMachineArn': '${RemediationWorkflowArn}',
                      'Input': {
                        'tenantId.$': '$.tenantId',
                        'parameters': {
                          'findingIds.$': '$.classification.findingIds',
                          'approvalRequired': false
                        }
                      }
                    },
                    End: true
                  }
                }
              }
            ],
            End: true
          },
          UrgentResponse: {
            Type: 'Task',
            Resource: 'arn:aws:states:::sns:publish',
            Parameters: {
              'TopicArn': '${IncidentTopicArn}',
              'Message.$': '$.classification.description'
            },
            End: true
          },
          StandardResponse: {
            Type: 'Task',
            Resource: '${FindingsStorageLambdaArn}',
            Parameters: {
              'action': 'createTicket',
              'classification.$': '$.classification',
              'tenantId.$': '$.tenantId',
              'correlationId.$': '$.correlationId'
            },
            End: true
          }
        }
      }
    };
  }

  /**
   * Audit Pack Generation Workflow
   * Generates comprehensive audit documentation
   */
  private getAuditPackGenerationWorkflow(): WorkflowDefinition {
    return {
      workflowType: 'audit-pack-generation',
      name: 'Audit Pack Generation',
      description: 'Generate comprehensive audit documentation and evidence',
      version: '1.0.0',
      stateMachineName: 'AuditPackGenerationWorkflow',
      requiredParameters: ['tenantId', 'auditType'],
      optionalParameters: ['dateRange', 'includeEvidence', 'format'],
      estimatedDuration: '15-45 minutes',
      stateMachineDefinition: {
        Comment: 'Audit Pack Generation Workflow',
        StartAt: 'InitializeAuditPack',
        States: {
          InitializeAuditPack: {
            Type: 'Pass',
            Next: 'CollectAuditData'
          },
          CollectAuditData: {
            Type: 'Parallel',
            Branches: [
              {
                StartAt: 'CollectFindings',
                States: {
                  CollectFindings: {
                    Type: 'Task',
                    Resource: '${FindingsStorageLambdaArn}',
                    Parameters: {
                      'action': 'collectForAudit',
                      'auditType.$': '$.parameters.auditType',
                      'dateRange.$': '$.parameters.dateRange',
                      'tenantId.$': '$.tenantId'
                    },
                    End: true
                  }
                }
              },
              {
                StartAt: 'CollectRemediations',
                States: {
                  CollectRemediations: {
                    Type: 'Task',
                    Resource: '${ApplyFixLambdaArn}',
                    Parameters: {
                      'action': 'collectForAudit',
                      'auditType.$': '$.parameters.auditType',
                      'dateRange.$': '$.parameters.dateRange',
                      'tenantId.$': '$.tenantId'
                    },
                    End: true
                  }
                }
              },
              {
                StartAt: 'CollectScanHistory',
                States: {
                  CollectScanHistory: {
                    Type: 'Task',
                    Resource: '${ScanEnvironmentLambdaArn}',
                    Parameters: {
                      'action': 'collectForAudit',
                      'auditType.$': '$.parameters.auditType',
                      'dateRange.$': '$.parameters.dateRange',
                      'tenantId.$': '$.tenantId'
                    },
                    End: true
                  }
                }
              }
            ],
            ResultPath: '$.auditData',
            Next: 'GenerateAuditReport'
          },
          GenerateAuditReport: {
            Type: 'Task',
            Resource: '${HTMLReportGeneratorLambdaArn}',
            Parameters: {
              'action': 'generate',
              'reportType': 'audit-pack',
              'auditType.$': '$.parameters.auditType',
              'auditData.$': '$.auditData',
              'tenantId.$': '$.tenantId',
              'correlationId.$': '$.correlationId'
            },
            End: true
          }
        }
      }
    };
  }

  /**
   * Continuous Monitoring Workflow
   * Ongoing compliance monitoring and alerting
   */
  private getContinuousMonitoringWorkflow(): WorkflowDefinition {
    return {
      workflowType: 'continuous-monitoring',
      name: 'Continuous Monitoring',
      description: 'Ongoing compliance monitoring with automated alerting',
      version: '1.0.0',
      stateMachineName: 'ContinuousMonitoringWorkflow',
      requiredParameters: ['tenantId'],
      optionalParameters: ['monitoringFrequency', 'alertThresholds'],
      estimatedDuration: 'Ongoing',
      stateMachineDefinition: {
        Comment: 'Continuous Monitoring Workflow',
        StartAt: 'ScheduleNextScan',
        States: {
          ScheduleNextScan: {
            Type: 'Wait',
            SecondsPath: '$.parameters.monitoringFrequency',
            Next: 'PerformIncrementalScan'
          },
          PerformIncrementalScan: {
            Type: 'Task',
            Resource: '${ScanEnvironmentLambdaArn}',
            Parameters: {
              'action': 'incrementalScan',
              'tenantId.$': '$.tenantId',
              'correlationId.$': '$.correlationId'
            },
            ResultPath: '$.scanResults',
            Next: 'EvaluateChanges'
          },
          EvaluateChanges: {
            Type: 'Choice',
            Choices: [
              {
                Variable: '$.scanResults.newFindings',
                NumericGreaterThan: 0,
                Next: 'ProcessNewFindings'
              }
            ],
            Default: 'ScheduleNextScan'
          },
          ProcessNewFindings: {
            Type: 'Task',
            Resource: '${FindingsStorageLambdaArn}',
            Parameters: {
              'action': 'processNewFindings',
              'findings.$': '$.scanResults.findings',
              'tenantId.$': '$.tenantId',
              'correlationId.$': '$.correlationId'
            },
            ResultPath: '$.processResults',
            Next: 'CheckAlertThresholds'
          },
          CheckAlertThresholds: {
            Type: 'Choice',
            Choices: [
              {
                Variable: '$.processResults.criticalCount',
                NumericGreaterThan: 0,
                Next: 'TriggerIncidentResponse'
              }
            ],
            Default: 'ScheduleNextScan'
          },
          TriggerIncidentResponse: {
            Type: 'Task',
            Resource: 'arn:aws:states:::states:startExecution',
            Parameters: {
              'StateMachineArn': '${IncidentResponseWorkflowArn}',
              'Input': {
                'tenantId.$': '$.tenantId',
                'parameters': {
                  'incidentType': 'new-critical-findings',
                  'findings.$': '$.processResults.criticalFindings'
                }
              }
            },
            Next: 'ScheduleNextScan'
          }
        }
      }
    };
  }
}
