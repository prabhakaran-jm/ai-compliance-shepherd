import { ActionGroupDefinition } from '../types/agent';

/**
 * Service for managing Bedrock Agent action groups
 * Defines the available actions the agent can perform
 */
export class ActionGroupService {
  
  /**
   * Get all action group definitions
   */
  getActionGroupDefinitions(): ActionGroupDefinition[] {
    return [
      this.getScanActionGroup(),
      this.getFindingsActionGroup(),
      this.getRemediationActionGroup(),
      this.getReportingActionGroup(),
      this.getTerraformActionGroup(),
      this.getS3ManagementActionGroup()
    ];
  }

  /**
   * Scan and Assessment Action Group
   */
  private getScanActionGroup(): ActionGroupDefinition {
    return {
      actionGroupName: 'ScanActions',
      description: 'Actions for scanning AWS environments and assessing compliance',
      actionGroupExecutor: {
        lambda: process.env.SCAN_ENVIRONMENT_LAMBDA_ARN || 'arn:aws:lambda:us-east-1:123456789012:function:scan-environment'
      },
      apiSchema: {
        payload: JSON.stringify({
          openapi: '3.0.0',
          info: {
            title: 'Scan Actions API',
            version: '1.0.0',
            description: 'API for scanning AWS environments'
          },
          paths: {
            '/scan/start': {
              post: {
                summary: 'Start an environment scan',
                description: 'Initiates a comprehensive scan of the AWS environment for compliance violations',
                operationId: 'startScan',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          tenantId: {
                            type: 'string',
                            description: 'Tenant identifier'
                          },
                          scanType: {
                            type: 'string',
                            enum: ['full', 'security', 'compliance', 'cost'],
                            description: 'Type of scan to perform'
                          },
                          regions: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'AWS regions to scan'
                          },
                          services: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'AWS services to include in scan'
                          }
                        },
                        required: ['tenantId']
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Scan started successfully',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            scanJobId: { type: 'string' },
                            status: { type: 'string' },
                            estimatedDuration: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '/scan/{scanJobId}/status': {
              get: {
                summary: 'Get scan status',
                description: 'Retrieves the current status and progress of a scan job',
                operationId: 'getScanStatus',
                parameters: [
                  {
                    name: 'scanJobId',
                    in: 'path',
                    required: true,
                    schema: { type: 'string' },
                    description: 'Scan job identifier'
                  }
                ],
                responses: {
                  '200': {
                    description: 'Scan status retrieved',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            scanJobId: { type: 'string' },
                            status: { type: 'string' },
                            progress: { type: 'number' },
                            findingsCount: { type: 'number' },
                            startedAt: { type: 'string' },
                            completedAt: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '/scan/list': {
              get: {
                summary: 'List recent scans',
                description: 'Lists recent scan jobs for the tenant',
                operationId: 'listScans',
                parameters: [
                  {
                    name: 'tenantId',
                    in: 'query',
                    required: true,
                    schema: { type: 'string' }
                  },
                  {
                    name: 'limit',
                    in: 'query',
                    schema: { type: 'number', default: 10 }
                  }
                ],
                responses: {
                  '200': {
                    description: 'Scan list retrieved',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            scans: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  scanJobId: { type: 'string' },
                                  status: { type: 'string' },
                                  findingsCount: { type: 'number' },
                                  createdAt: { type: 'string' }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })
      }
    };
  }

  /**
   * Findings Management Action Group
   */
  private getFindingsActionGroup(): ActionGroupDefinition {
    return {
      actionGroupName: 'FindingsActions',
      description: 'Actions for managing compliance findings and violations',
      actionGroupExecutor: {
        lambda: process.env.FINDINGS_STORAGE_LAMBDA_ARN || 'arn:aws:lambda:us-east-1:123456789012:function:findings-storage'
      },
      apiSchema: {
        payload: JSON.stringify({
          openapi: '3.0.0',
          info: {
            title: 'Findings Actions API',
            version: '1.0.0',
            description: 'API for managing compliance findings'
          },
          paths: {
            '/findings/search': {
              get: {
                summary: 'Search findings',
                description: 'Search and filter compliance findings',
                operationId: 'searchFindings',
                parameters: [
                  {
                    name: 'tenantId',
                    in: 'query',
                    required: true,
                    schema: { type: 'string' }
                  },
                  {
                    name: 'severity',
                    in: 'query',
                    schema: { 
                      type: 'string',
                      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']
                    }
                  },
                  {
                    name: 'status',
                    in: 'query',
                    schema: { 
                      type: 'string',
                      enum: ['OPEN', 'RESOLVED', 'SUPPRESSED', 'IN_PROGRESS']
                    }
                  },
                  {
                    name: 'service',
                    in: 'query',
                    schema: { type: 'string' }
                  },
                  {
                    name: 'region',
                    in: 'query',
                    schema: { type: 'string' }
                  },
                  {
                    name: 'limit',
                    in: 'query',
                    schema: { type: 'number', default: 50 }
                  }
                ],
                responses: {
                  '200': {
                    description: 'Findings retrieved',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            findings: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  findingId: { type: 'string' },
                                  title: { type: 'string' },
                                  description: { type: 'string' },
                                  severity: { type: 'string' },
                                  status: { type: 'string' },
                                  service: { type: 'string' },
                                  region: { type: 'string' },
                                  resourceId: { type: 'string' },
                                  createdAt: { type: 'string' }
                                }
                              }
                            },
                            totalCount: { type: 'number' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '/findings/{findingId}': {
              get: {
                summary: 'Get finding details',
                description: 'Retrieve detailed information about a specific finding',
                operationId: 'getFinding',
                parameters: [
                  {
                    name: 'findingId',
                    in: 'path',
                    required: true,
                    schema: { type: 'string' }
                  }
                ],
                responses: {
                  '200': {
                    description: 'Finding details retrieved'
                  }
                }
              }
            },
            '/findings/{findingId}/resolve': {
              put: {
                summary: 'Resolve finding',
                description: 'Mark a finding as resolved',
                operationId: 'resolveFinding',
                parameters: [
                  {
                    name: 'findingId',
                    in: 'path',
                    required: true,
                    schema: { type: 'string' }
                  }
                ],
                requestBody: {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          reason: { type: 'string' },
                          resolvedBy: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Finding resolved'
                  }
                }
              }
            },
            '/findings/statistics': {
              get: {
                summary: 'Get findings statistics',
                description: 'Retrieve statistics about findings by severity, status, service, etc.',
                operationId: 'getFindingsStatistics',
                parameters: [
                  {
                    name: 'tenantId',
                    in: 'query',
                    required: true,
                    schema: { type: 'string' }
                  }
                ],
                responses: {
                  '200': {
                    description: 'Statistics retrieved'
                  }
                }
              }
            }
          }
        })
      }
    };
  }

  /**
   * Remediation Action Group
   */
  private getRemediationActionGroup(): ActionGroupDefinition {
    return {
      actionGroupName: 'RemediationActions',
      description: 'Actions for applying fixes and remediating compliance violations',
      actionGroupExecutor: {
        lambda: process.env.APPLY_FIX_LAMBDA_ARN || 'arn:aws:lambda:us-east-1:123456789012:function:apply-fix'
      },
      apiSchema: {
        payload: JSON.stringify({
          openapi: '3.0.0',
          info: {
            title: 'Remediation Actions API',
            version: '1.0.0',
            description: 'API for applying compliance fixes'
          },
          paths: {
            '/remediation/apply': {
              post: {
                summary: 'Apply remediation',
                description: 'Apply a fix for a compliance finding with safety checks',
                operationId: 'applyRemediation',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          findingId: {
                            type: 'string',
                            description: 'Finding to remediate'
                          },
                          remediationType: {
                            type: 'string',
                            description: 'Type of remediation to apply'
                          },
                          dryRun: {
                            type: 'boolean',
                            description: 'Whether to perform a dry run',
                            default: true
                          },
                          approvalRequired: {
                            type: 'boolean',
                            description: 'Whether approval is required',
                            default: true
                          }
                        },
                        required: ['findingId', 'remediationType']
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Remediation applied or queued'
                  }
                }
              }
            },
            '/remediation/{jobId}/status': {
              get: {
                summary: 'Get remediation status',
                description: 'Check the status of a remediation job',
                operationId: 'getRemediationStatus',
                parameters: [
                  {
                    name: 'jobId',
                    in: 'path',
                    required: true,
                    schema: { type: 'string' }
                  }
                ],
                responses: {
                  '200': {
                    description: 'Remediation status retrieved'
                  }
                }
              }
            },
            '/remediation/{jobId}/rollback': {
              post: {
                summary: 'Rollback remediation',
                description: 'Rollback a previously applied remediation',
                operationId: 'rollbackRemediation',
                parameters: [
                  {
                    name: 'jobId',
                    in: 'path',
                    required: true,
                    schema: { type: 'string' }
                  }
                ],
                responses: {
                  '200': {
                    description: 'Rollback initiated'
                  }
                }
              }
            }
          }
        })
      }
    };
  }

  /**
   * Reporting Action Group
   */
  private getReportingActionGroup(): ActionGroupDefinition {
    return {
      actionGroupName: 'ReportingActions',
      description: 'Actions for generating compliance reports and documentation',
      actionGroupExecutor: {
        lambda: process.env.HTML_REPORT_GENERATOR_LAMBDA_ARN || 'arn:aws:lambda:us-east-1:123456789012:function:html-report-generator'
      },
      apiSchema: {
        payload: JSON.stringify({
          openapi: '3.0.0',
          info: {
            title: 'Reporting Actions API',
            version: '1.0.0',
            description: 'API for generating compliance reports'
          },
          paths: {
            '/reports/generate': {
              post: {
                summary: 'Generate compliance report',
                description: 'Generate a comprehensive compliance report',
                operationId: 'generateReport',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          tenantId: { type: 'string' },
                          reportType: {
                            type: 'string',
                            enum: ['executive', 'detailed', 'technical', 'audit']
                          },
                          scanJobId: { type: 'string' },
                          includeCharts: { type: 'boolean', default: true },
                          includeRecommendations: { type: 'boolean', default: true }
                        },
                        required: ['tenantId', 'reportType']
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Report generated'
                  }
                }
              }
            },
            '/reports/{reportId}': {
              get: {
                summary: 'Get report',
                description: 'Retrieve a generated report',
                operationId: 'getReport',
                parameters: [
                  {
                    name: 'reportId',
                    in: 'path',
                    required: true,
                    schema: { type: 'string' }
                  }
                ],
                responses: {
                  '200': {
                    description: 'Report retrieved'
                  }
                }
              }
            },
            '/reports/list': {
              get: {
                summary: 'List reports',
                description: 'List available reports for a tenant',
                operationId: 'listReports',
                parameters: [
                  {
                    name: 'tenantId',
                    in: 'query',
                    required: true,
                    schema: { type: 'string' }
                  }
                ],
                responses: {
                  '200': {
                    description: 'Reports listed'
                  }
                }
              }
            }
          }
        })
      }
    };
  }

  /**
   * Terraform Analysis Action Group
   */
  private getTerraformActionGroup(): ActionGroupDefinition {
    return {
      actionGroupName: 'TerraformActions',
      description: 'Actions for analyzing Terraform plans and Infrastructure as Code',
      actionGroupExecutor: {
        lambda: process.env.ANALYZE_TERRAFORM_PLAN_LAMBDA_ARN || 'arn:aws:lambda:us-east-1:123456789012:function:analyze-terraform-plan'
      },
      apiSchema: {
        payload: JSON.stringify({
          openapi: '3.0.0',
          info: {
            title: 'Terraform Actions API',
            version: '1.0.0',
            description: 'API for analyzing Terraform plans'
          },
          paths: {
            '/terraform/analyze': {
              post: {
                summary: 'Analyze Terraform plan',
                description: 'Analyze a Terraform plan for compliance and security issues',
                operationId: 'analyzeTerraformPlan',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          planData: {
                            type: 'string',
                            description: 'Base64 encoded Terraform plan'
                          },
                          planFormat: {
                            type: 'string',
                            enum: ['json', 'binary'],
                            default: 'json'
                          },
                          analysisType: {
                            type: 'string',
                            enum: ['compliance', 'security', 'cost', 'all'],
                            default: 'all'
                          }
                        },
                        required: ['planData']
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Analysis completed'
                  }
                }
              }
            },
            '/terraform/validate': {
              post: {
                summary: 'Validate Terraform configuration',
                description: 'Validate Terraform configuration against compliance rules',
                operationId: 'validateTerraformConfig',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          configFiles: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                filename: { type: 'string' },
                                content: { type: 'string' }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Validation completed'
                  }
                }
              }
            }
          }
        })
      }
    };
  }

  /**
   * S3 Management Action Group
   */
  private getS3ManagementActionGroup(): ActionGroupDefinition {
    return {
      actionGroupName: 'S3ManagementActions',
      description: 'Actions for managing S3 buckets and configurations',
      actionGroupExecutor: {
        lambda: process.env.S3_BUCKET_MANAGER_LAMBDA_ARN || 'arn:aws:lambda:us-east-1:123456789012:function:s3-bucket-manager'
      },
      apiSchema: {
        payload: JSON.stringify({
          openapi: '3.0.0',
          info: {
            title: 'S3 Management Actions API',
            version: '1.0.0',
            description: 'API for managing S3 buckets'
          },
          paths: {
            '/s3/buckets/analyze': {
              post: {
                summary: 'Analyze S3 bucket configuration',
                description: 'Analyze S3 bucket for compliance and security issues',
                operationId: 'analyzeS3Bucket',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          bucketName: { type: 'string' },
                          region: { type: 'string' }
                        },
                        required: ['bucketName']
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Analysis completed'
                  }
                }
              }
            },
            '/s3/buckets/configure': {
              post: {
                summary: 'Configure S3 bucket',
                description: 'Apply security and compliance configurations to S3 bucket',
                operationId: 'configureS3Bucket',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          bucketName: { type: 'string' },
                          configurations: {
                            type: 'object',
                            properties: {
                              encryption: { type: 'boolean' },
                              versioning: { type: 'boolean' },
                              publicAccessBlock: { type: 'boolean' },
                              lifecyclePolicy: { type: 'boolean' }
                            }
                          }
                        },
                        required: ['bucketName', 'configurations']
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Configuration applied'
                  }
                }
              }
            }
          }
        })
      }
    };
  }
}
