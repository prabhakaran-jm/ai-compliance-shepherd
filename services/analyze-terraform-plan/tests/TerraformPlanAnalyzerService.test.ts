/**
 * Terraform Plan Analyzer Service Tests
 * 
 * Comprehensive unit tests for the Terraform plan analyzer service including
 * plan parsing, compliance analysis, security analysis, and cost analysis.
 */

import { TerraformPlanAnalyzerService } from '../src/services/TerraformPlanAnalyzerService';
import { TerraformPlanParser } from '../src/services/TerraformPlanParser';
import { ComplianceAnalyzer } from '../src/services/ComplianceAnalyzer';
import { SecurityAnalyzer } from '../src/services/SecurityAnalyzer';
import { CostAnalyzer } from '../src/services/CostAnalyzer';
import { FindingsProcessor } from '../src/services/FindingsProcessor';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { ValidationError, NotFoundError } from '../src/utils/errorHandler';

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  S3: jest.fn().mockImplementation(() => ({
    getObject: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Body: Buffer.from('test') })
    }),
    putObject: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({})
    })
  })),
  DynamoDB: jest.fn().mockImplementation(() => ({
    putItem: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({})
    }),
    getItem: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({})
    }),
    query: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Items: [] })
    }),
    deleteItem: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({})
    })
  }))
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn(),
    getContext: jest.fn().mockReturnValue({})
  }
}));

describe('TerraformPlanAnalyzerService', () => {
  let analyzerService: TerraformPlanAnalyzerService;
  let mockEvent: APIGatewayProxyEvent;
  let mockContext: Context;

  beforeEach(() => {
    analyzerService = new TerraformPlanAnalyzerService();
    
    mockEvent = {
      httpMethod: 'POST',
      path: '/analyze',
      resource: '/analyze',
      headers: {},
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      requestContext: {
        requestId: 'test-request-id',
        stage: 'test',
        resourcePath: '/analyze',
        httpMethod: 'POST',
        requestTime: '01/Jan/2024:00:00:00 +0000',
        requestTimeEpoch: 1704067200,
        identity: {
          cognitoIdentityPoolId: null,
          accountId: null,
          cognitoIdentityId: null,
          caller: null,
          sourceIp: '127.0.0.1',
          principalOrgId: null,
          accessKey: null,
          cognitoAuthenticationType: null,
          cognitoAuthenticationProvider: null,
          userArn: null,
          userAgent: 'test-agent',
          user: null
        },
        path: '/analyze',
        accountId: '123456789012',
        apiId: 'test-api-id',
        protocol: 'HTTP/1.1',
        resourceId: 'test-resource-id'
      },
      body: null,
      isBase64Encoded: false
    };

    mockContext = {
      callbackWaitsForEmptyEventLoop: false,
      functionName: 'test-function',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
      memoryLimitInMB: '128',
      awsRequestId: 'test-request-id',
      logGroupName: '/aws/lambda/test-function',
      logStreamName: '2024/01/01/[$LATEST]test-stream',
      getRemainingTimeInMillis: () => 30000,
      done: jest.fn(),
      fail: jest.fn(),
      succeed: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('routeRequest', () => {
    it('should analyze Terraform plan with valid request', async () => {
      const mockPlanData = {
        format_version: '1.0',
        terraform_version: '1.0.0',
        resource_changes: [
          {
            address: 'aws_s3_bucket.test',
            type: 'aws_s3_bucket',
            name: 'test',
            change: {
              actions: ['create'],
              after: {
                bucket: 'test-bucket'
              }
            }
          }
        ]
      };

      mockEvent.body = JSON.stringify({
        planData: Buffer.from(JSON.stringify(mockPlanData)).toString('base64'),
        planFormat: 'json',
        scanOptions: {
          includeSecurityChecks: true,
          includeComplianceChecks: true,
          includeCostAnalysis: true,
          frameworks: ['SOC2', 'HIPAA', 'GDPR'],
          severityThreshold: 'medium'
        }
      });
      mockEvent.requestContext.authorizer = {
        tenantId: 'tenant-123',
        userId: 'user-123'
      };

      const result = await analyzerService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.body).toContain('analysisId');
      expect(result.body).toContain('status');
      expect(result.body).toContain('summary');
    });

    it('should reject invalid analysis request', async () => {
      mockEvent.body = JSON.stringify({
        // Missing required planData
        planFormat: 'json'
      });

      const result = await analyzerService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('Validation Error');
    });

    it('should get analysis result', async () => {
      mockEvent.httpMethod = 'GET';
      mockEvent.path = '/analyses/test-analysis-id';
      mockEvent.pathParameters = { analysisId: 'test-analysis-id' };
      mockEvent.requestContext.authorizer = {
        tenantId: 'tenant-123',
        userId: 'user-123'
      };

      const result = await analyzerService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(404); // No analysis found in mock
      expect(result.body).toContain('Analysis not found');
    });

    it('should list analyses', async () => {
      mockEvent.httpMethod = 'GET';
      mockEvent.path = '/analyses';
      mockEvent.requestContext.authorizer = {
        tenantId: 'tenant-123',
        userId: 'user-123'
      };

      const result = await analyzerService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.body).toContain('analyses');
    });

    it('should delete analysis', async () => {
      mockEvent.httpMethod = 'DELETE';
      mockEvent.path = '/analyses/test-analysis-id';
      mockEvent.pathParameters = { analysisId: 'test-analysis-id' };
      mockEvent.requestContext.authorizer = {
        tenantId: 'tenant-123',
        userId: 'user-123'
      };

      const result = await analyzerService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(404); // No analysis found in mock
      expect(result.body).toContain('Analysis not found');
    });

    it('should return 404 for unknown routes', async () => {
      mockEvent.path = '/unknown-route';

      const result = await analyzerService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(404);
      expect(result.body).toContain('Terraform plan analysis endpoint not found');
    });
  });

  describe('analyzeTerraformPlan', () => {
    it('should analyze plan with compliance checks', async () => {
      const mockPlanData = {
        format_version: '1.0',
        terraform_version: '1.0.0',
        resource_changes: [
          {
            address: 'aws_s3_bucket.test',
            type: 'aws_s3_bucket',
            name: 'test',
            change: {
              actions: ['create'],
              after: {
                bucket: 'test-bucket'
              }
            }
          }
        ]
      };

      mockEvent.body = JSON.stringify({
        planData: Buffer.from(JSON.stringify(mockPlanData)).toString('base64'),
        planFormat: 'json',
        scanOptions: {
          includeSecurityChecks: true,
          includeComplianceChecks: true,
          includeCostAnalysis: true,
          frameworks: ['SOC2', 'HIPAA', 'GDPR'],
          severityThreshold: 'medium'
        }
      });
      mockEvent.requestContext.authorizer = {
        tenantId: 'tenant-123',
        userId: 'user-123'
      };

      const result = await analyzerService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const response = JSON.parse(result.body);
      expect(response.data.analysisId).toBeDefined();
      expect(response.data.status).toBe('completed');
      expect(response.data.summary).toBeDefined();
    });

    it('should analyze plan with security checks', async () => {
      const mockPlanData = {
        format_version: '1.0',
        terraform_version: '1.0.0',
        resource_changes: [
          {
            address: 'aws_instance.test',
            type: 'aws_instance',
            name: 'test',
            change: {
              actions: ['create'],
              after: {
                instance_type: 't3.micro',
                associate_public_ip_address: true
              }
            }
          }
        ]
      };

      mockEvent.body = JSON.stringify({
        planData: Buffer.from(JSON.stringify(mockPlanData)).toString('base64'),
        planFormat: 'json',
        scanOptions: {
          includeSecurityChecks: true,
          includeComplianceChecks: false,
          includeCostAnalysis: false,
          frameworks: ['SOC2'],
          severityThreshold: 'high'
        }
      });
      mockEvent.requestContext.authorizer = {
        tenantId: 'tenant-123',
        userId: 'user-123'
      };

      const result = await analyzerService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const response = JSON.parse(result.body);
      expect(response.data.analysisId).toBeDefined();
      expect(response.data.status).toBe('completed');
    });

    it('should analyze plan with cost analysis', async () => {
      const mockPlanData = {
        format_version: '1.0',
        terraform_version: '1.0.0',
        resource_changes: [
          {
            address: 'aws_instance.test',
            type: 'aws_instance',
            name: 'test',
            change: {
              actions: ['create'],
              after: {
                instance_type: 'm5.xlarge'
              }
            }
          }
        ]
      };

      mockEvent.body = JSON.stringify({
        planData: Buffer.from(JSON.stringify(mockPlanData)).toString('base64'),
        planFormat: 'json',
        scanOptions: {
          includeSecurityChecks: false,
          includeComplianceChecks: false,
          includeCostAnalysis: true,
          frameworks: [],
          severityThreshold: 'low'
        }
      });
      mockEvent.requestContext.authorizer = {
        tenantId: 'tenant-123',
        userId: 'user-123'
      };

      const result = await analyzerService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const response = JSON.parse(result.body);
      expect(response.data.analysisId).toBeDefined();
      expect(response.data.status).toBe('completed');
    });
  });
});

describe('TerraformPlanParser', () => {
  let planParser: TerraformPlanParser;

  beforeEach(() => {
    planParser = new TerraformPlanParser();
  });

  describe('parsePlan', () => {
    it('should parse JSON plan successfully', async () => {
      const mockPlanData = {
        format_version: '1.0',
        terraform_version: '1.0.0',
        resource_changes: [
          {
            address: 'aws_s3_bucket.test',
            type: 'aws_s3_bucket',
            name: 'test',
            change: {
              actions: ['create'],
              after: {
                bucket: 'test-bucket'
              }
            }
          }
        ]
      };

      const planData = Buffer.from(JSON.stringify(mockPlanData)).toString('base64');
      const result = await planParser.parsePlan(planData, 'json');

      expect(result.format_version).toBe('1.0');
      expect(result.terraform_version).toBe('1.0.0');
      expect(result.resource_changes).toHaveLength(1);
      expect(result.resource_changes[0].address).toBe('aws_s3_bucket.test');
    });

    it('should reject invalid JSON plan', async () => {
      const invalidPlanData = 'invalid-json';

      await expect(planParser.parsePlan(invalidPlanData, 'json')).rejects.toThrow();
    });

    it('should reject binary plan format', async () => {
      const binaryPlanData = 'binary-data';

      await expect(planParser.parsePlan(binaryPlanData, 'binary')).rejects.toThrow();
    });
  });

  describe('extractResourceTypes', () => {
    it('should extract resource types from plan', async () => {
      const mockPlanData = {
        format_version: '1.0',
        terraform_version: '1.0.0',
        resource_changes: [
          {
            address: 'aws_s3_bucket.test',
            type: 'aws_s3_bucket',
            name: 'test',
            change: { actions: ['create'] }
          },
          {
            address: 'aws_instance.test',
            type: 'aws_instance',
            name: 'test',
            change: { actions: ['create'] }
          }
        ]
      };

      const planData = Buffer.from(JSON.stringify(mockPlanData)).toString('base64');
      const plan = await planParser.parsePlan(planData, 'json');
      const resourceTypes = planParser.extractResourceTypes(plan);

      expect(resourceTypes).toContain('aws_s3_bucket');
      expect(resourceTypes).toContain('aws_instance');
      expect(resourceTypes).toHaveLength(2);
    });
  });

  describe('getPlanSummary', () => {
    it('should generate plan summary', async () => {
      const mockPlanData = {
        format_version: '1.0',
        terraform_version: '1.0.0',
        resource_changes: [
          {
            address: 'aws_s3_bucket.test',
            type: 'aws_s3_bucket',
            name: 'test',
            change: { actions: ['create'] }
          },
          {
            address: 'aws_instance.test',
            type: 'aws_instance',
            name: 'test',
            change: { actions: ['update'] }
          }
        ]
      };

      const planData = Buffer.from(JSON.stringify(mockPlanData)).toString('base64');
      const plan = await planParser.parsePlan(planData, 'json');
      const summary = planParser.getPlanSummary(plan);

      expect(summary.totalResources).toBe(2);
      expect(summary.resourcesToCreate).toBe(1);
      expect(summary.resourcesToUpdate).toBe(1);
      expect(summary.resourcesToDelete).toBe(0);
      expect(summary.resourceTypes).toContain('aws_s3_bucket');
      expect(summary.resourceTypes).toContain('aws_instance');
    });
  });
});

describe('ComplianceAnalyzer', () => {
  let complianceAnalyzer: ComplianceAnalyzer;

  beforeEach(() => {
    complianceAnalyzer = new ComplianceAnalyzer();
  });

  describe('analyzePlan', () => {
    it('should analyze plan for compliance violations', async () => {
      const mockPlanData = {
        format_version: '1.0',
        terraform_version: '1.0.0',
        resource_changes: [
          {
            address: 'aws_s3_bucket.test',
            type: 'aws_s3_bucket',
            name: 'test',
            change: {
              actions: ['create'],
              after: {
                bucket: 'test-bucket'
                // Missing encryption configuration
              }
            }
          }
        ]
      };

      const result = await complianceAnalyzer.analyzePlan(mockPlanData, {
        frameworks: ['SOC2', 'HIPAA', 'GDPR'],
        severityThreshold: 'medium'
      });

      expect(result.score).toBeDefined();
      expect(result.findings).toBeDefined();
      expect(result.frameworkScores).toBeDefined();
      expect(result.controlScores).toBeDefined();
    });

    it('should return perfect score for compliant plan', async () => {
      const mockPlanData = {
        format_version: '1.0',
        terraform_version: '1.0.0',
        resource_changes: [
          {
            address: 'aws_s3_bucket.test',
            type: 'aws_s3_bucket',
            name: 'test',
            change: {
              actions: ['create'],
              after: {
                bucket: 'test-bucket',
                server_side_encryption_configuration: {
                  rule: {
                    apply_server_side_encryption_by_default: {
                      sse_algorithm: 'AES256'
                    }
                  }
                },
                public_access_block: {
                  block_public_acls: true,
                  ignore_public_acls: true,
                  block_public_policy: true,
                  restrict_public_buckets: true
                }
              }
            }
          }
        ]
      };

      const result = await complianceAnalyzer.analyzePlan(mockPlanData, {
        frameworks: ['SOC2', 'HIPAA', 'GDPR'],
        severityThreshold: 'medium'
      });

      expect(result.score).toBeGreaterThan(90);
      expect(result.findings).toHaveLength(0);
    });
  });
});

describe('SecurityAnalyzer', () => {
  let securityAnalyzer: SecurityAnalyzer;

  beforeEach(() => {
    securityAnalyzer = new SecurityAnalyzer();
  });

  describe('analyzePlan', () => {
    it('should analyze plan for security vulnerabilities', async () => {
      const mockPlanData = {
        format_version: '1.0',
        terraform_version: '1.0.0',
        resource_changes: [
          {
            address: 'aws_instance.test',
            type: 'aws_instance',
            name: 'test',
            change: {
              actions: ['create'],
              after: {
                instance_type: 't3.micro',
                associate_public_ip_address: true
              }
            }
          }
        ]
      };

      const result = await securityAnalyzer.analyzePlan(mockPlanData, {
        severityThreshold: 'medium'
      });

      expect(result.score).toBeDefined();
      expect(result.findings).toBeDefined();
      expect(result.categoryScores).toBeDefined();
      expect(result.riskLevel).toBeDefined();
    });

    it('should return high security score for secure plan', async () => {
      const mockPlanData = {
        format_version: '1.0',
        terraform_version: '1.0.0',
        resource_changes: [
          {
            address: 'aws_instance.test',
            type: 'aws_instance',
            name: 'test',
            change: {
              actions: ['create'],
              after: {
                instance_type: 't3.micro',
                associate_public_ip_address: false
              }
            }
          }
        ]
      };

      const result = await securityAnalyzer.analyzePlan(mockPlanData, {
        severityThreshold: 'medium'
      });

      expect(result.score).toBeGreaterThan(90);
      expect(result.riskLevel).toBe('low');
    });
  });
});

describe('CostAnalyzer', () => {
  let costAnalyzer: CostAnalyzer;

  beforeEach(() => {
    costAnalyzer = new CostAnalyzer();
  });

  describe('analyzePlan', () => {
    it('should analyze plan for cost optimization opportunities', async () => {
      const mockPlanData = {
        format_version: '1.0',
        terraform_version: '1.0.0',
        resource_changes: [
          {
            address: 'aws_instance.test',
            type: 'aws_instance',
            name: 'test',
            change: {
              actions: ['create'],
              after: {
                instance_type: 'm5.xlarge'
              }
            }
          }
        ]
      };

      const result = await costAnalyzer.analyzePlan(mockPlanData, {
        severityThreshold: 'low'
      });

      expect(result.totalCost).toBeDefined();
      expect(result.monthlyCost).toBeDefined();
      expect(result.annualCost).toBeDefined();
      expect(result.costBreakdown).toBeDefined();
      expect(result.findings).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should identify cost optimization opportunities', async () => {
      const mockPlanData = {
        format_version: '1.0',
        terraform_version: '1.0.0',
        resource_changes: [
          {
            address: 'aws_instance.test',
            type: 'aws_instance',
            name: 'test',
            change: {
              actions: ['create'],
              after: {
                instance_type: 'm5.xlarge'
              }
            }
          }
        ]
      };

      const result = await costAnalyzer.analyzePlan(mockPlanData, {
        severityThreshold: 'low'
      });

      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });
});

describe('FindingsProcessor', () => {
  let findingsProcessor: FindingsProcessor;

  beforeEach(() => {
    findingsProcessor = new FindingsProcessor();
  });

  describe('processFindings', () => {
    it('should process findings successfully', async () => {
      const mockFindings = [
        {
          id: 'test-finding-1',
          type: 'compliance',
          severity: 'high',
          title: 'Test Finding',
          description: 'Test description',
          resource: 'aws_s3_bucket.test',
          rule: 'test-rule',
          recommendation: 'Test recommendation',
          evidence: { test: 'data' }
        }
      ];

      const result = await findingsProcessor.processFindings(
        mockFindings,
        'tenant-123',
        'user-123',
        'analysis-123'
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test-finding-1');
      expect(result[0].tenantId).toBe('tenant-123');
      expect(result[0].userId).toBe('user-123');
      expect(result[0].analysisId).toBe('analysis-123');
    });

    it('should deduplicate findings', async () => {
      const mockFindings = [
        {
          id: 'test-finding-1',
          type: 'compliance',
          severity: 'high',
          title: 'Test Finding',
          description: 'Test description',
          resource: 'aws_s3_bucket.test',
          rule: 'test-rule',
          recommendation: 'Test recommendation',
          evidence: { test: 'data' }
        },
        {
          id: 'test-finding-2',
          type: 'compliance',
          severity: 'high',
          title: 'Test Finding',
          description: 'Test description',
          resource: 'aws_s3_bucket.test',
          rule: 'test-rule',
          recommendation: 'Test recommendation',
          evidence: { test: 'data' }
        }
      ];

      const result = await findingsProcessor.processFindings(
        mockFindings,
        'tenant-123',
        'user-123',
        'analysis-123'
      );

      expect(result).toHaveLength(1); // Should be deduplicated
    });

    it('should sort findings by severity', async () => {
      const mockFindings = [
        {
          id: 'test-finding-1',
          type: 'compliance',
          severity: 'low',
          title: 'Low Severity Finding',
          description: 'Test description',
          resource: 'aws_s3_bucket.test',
          rule: 'test-rule',
          recommendation: 'Test recommendation',
          evidence: { test: 'data' }
        },
        {
          id: 'test-finding-2',
          type: 'compliance',
          severity: 'critical',
          title: 'Critical Severity Finding',
          description: 'Test description',
          resource: 'aws_instance.test',
          rule: 'test-rule',
          recommendation: 'Test recommendation',
          evidence: { test: 'data' }
        }
      ];

      const result = await findingsProcessor.processFindings(
        mockFindings,
        'tenant-123',
        'user-123',
        'analysis-123'
      );

      expect(result).toHaveLength(2);
      expect(result[0].severity).toBe('critical');
      expect(result[1].severity).toBe('low');
    });
  });

  describe('getFindingsSummary', () => {
    it('should generate findings summary', async () => {
      const mockFindings = [
        {
          id: 'test-finding-1',
          type: 'compliance',
          severity: 'high',
          title: 'Test Finding',
          description: 'Test description',
          resource: 'aws_s3_bucket.test',
          rule: 'test-rule',
          recommendation: 'Test recommendation',
          evidence: { test: 'data' }
        },
        {
          id: 'test-finding-2',
          type: 'security',
          severity: 'critical',
          title: 'Security Finding',
          description: 'Test description',
          resource: 'aws_instance.test',
          rule: 'test-rule',
          recommendation: 'Test recommendation',
          evidence: { test: 'data' }
        }
      ];

      const processedFindings = await findingsProcessor.processFindings(
        mockFindings,
        'tenant-123',
        'user-123',
        'analysis-123'
      );

      const summary = findingsProcessor.getFindingsSummary(processedFindings);

      expect(summary.total).toBe(2);
      expect(summary.byType.compliance).toBe(1);
      expect(summary.byType.security).toBe(1);
      expect(summary.bySeverity.high).toBe(1);
      expect(summary.bySeverity.critical).toBe(1);
      expect(summary.criticalCount).toBe(1);
      expect(summary.highCount).toBe(1);
    });
  });

  describe('exportFindings', () => {
    it('should export findings to JSON', async () => {
      const mockFindings = [
        {
          id: 'test-finding-1',
          type: 'compliance',
          severity: 'high',
          title: 'Test Finding',
          description: 'Test description',
          resource: 'aws_s3_bucket.test',
          rule: 'test-rule',
          recommendation: 'Test recommendation',
          evidence: { test: 'data' }
        }
      ];

      const processedFindings = await findingsProcessor.processFindings(
        mockFindings,
        'tenant-123',
        'user-123',
        'analysis-123'
      );

      const jsonExport = findingsProcessor.exportFindings(processedFindings, 'json');
      const parsed = JSON.parse(jsonExport);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('test-finding-1');
    });

    it('should export findings to CSV', async () => {
      const mockFindings = [
        {
          id: 'test-finding-1',
          type: 'compliance',
          severity: 'high',
          title: 'Test Finding',
          description: 'Test description',
          resource: 'aws_s3_bucket.test',
          rule: 'test-rule',
          recommendation: 'Test recommendation',
          evidence: { test: 'data' }
        }
      ];

      const processedFindings = await findingsProcessor.processFindings(
        mockFindings,
        'tenant-123',
        'user-123',
        'analysis-123'
      );

      const csvExport = findingsProcessor.exportFindings(processedFindings, 'csv');

      expect(csvExport).toContain('ID,Type,Severity,Title');
      expect(csvExport).toContain('test-finding-1');
    });

    it('should export findings to Markdown', async () => {
      const mockFindings = [
        {
          id: 'test-finding-1',
          type: 'compliance',
          severity: 'high',
          title: 'Test Finding',
          description: 'Test description',
          resource: 'aws_s3_bucket.test',
          rule: 'test-rule',
          recommendation: 'Test recommendation',
          evidence: { test: 'data' }
        }
      ];

      const processedFindings = await findingsProcessor.processFindings(
        mockFindings,
        'tenant-123',
        'user-123',
        'analysis-123'
      );

      const markdownExport = findingsProcessor.exportFindings(processedFindings, 'markdown');

      expect(markdownExport).toContain('# Terraform Plan Analysis Findings');
      expect(markdownExport).toContain('Test Finding');
    });
  });
});
