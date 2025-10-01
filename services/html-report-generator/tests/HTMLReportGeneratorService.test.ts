/**
 * HTML Report Generator Service Tests
 * 
 * Comprehensive unit tests for the HTML report generator service including
 * template compilation, data processing, and report generation.
 */

import { HTMLReportGeneratorService } from '../src/services/HTMLReportGeneratorService';
import { ReportTemplateEngine } from '../src/services/ReportTemplateEngine';
import { ReportDataService } from '../src/services/ReportDataService';
import { ReportStorageService } from '../src/services/ReportStorageService';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { ValidationError, NotFoundError } from '../src/utils/errorHandler';

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  S3: jest.fn().mockImplementation(() => ({
    upload: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Location: 'https://s3.amazonaws.com/bucket/report.html'
      })
    }),
    getObject: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Body: Buffer.from('<html>Mock report content</html>')
      })
    }),
    headObject: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Metadata: {
          reportId: 'report-123',
          tenantId: 'tenant-123',
          scanId: 'scan-123',
          reportType: 'detailed',
          generatedBy: 'user-123',
          generatedAt: '2024-01-01T10:00:00Z'
        },
        ContentLength: 1024
      })
    }),
    listObjectsV2: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Contents: [
          {
            Key: 'reports/tenant-123/2024-01-01/report-123.html',
            Size: 1024,
            LastModified: new Date()
          }
        ]
      })
    }),
    deleteObject: jest.fn().mockReturnValue({
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

describe('HTMLReportGeneratorService', () => {
  let reportService: HTMLReportGeneratorService;
  let mockEvent: APIGatewayProxyEvent;
  let mockContext: Context;

  beforeEach(() => {
    reportService = new HTMLReportGeneratorService();
    
    mockEvent = {
      httpMethod: 'POST',
      path: '/reports',
      resource: '/reports',
      headers: {},
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      requestContext: {
        requestId: 'test-request-id',
        stage: 'test',
        resourcePath: '/reports',
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
        path: '/reports',
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
    it('should generate report with valid request', async () => {
      mockEvent.body = JSON.stringify({
        scanId: 'scan-123',
        reportType: 'detailed',
        format: 'html',
        includeCharts: true,
        includeRemediation: true
      });
      mockEvent.requestContext.authorizer = {
        tenantId: 'tenant-123',
        userId: 'user-123'
      };

      const result = await reportService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(201);
      expect(result.body).toContain('reportId');
      expect(result.body).toContain('reportUrl');
    });

    it('should reject invalid report request', async () => {
      mockEvent.body = JSON.stringify({
        // Missing required scanId
        reportType: 'detailed',
        format: 'html'
      });

      const result = await reportService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('Validation Error');
    });

    it('should get report by ID', async () => {
      mockEvent.httpMethod = 'GET';
      mockEvent.path = '/reports/report-123';
      mockEvent.pathParameters = { reportId: 'report-123' };
      mockEvent.requestContext.authorizer = {
        tenantId: 'tenant-123',
        userId: 'user-123'
      };

      const result = await reportService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers['Content-Type']).toBe('text/html; charset=utf-8');
    });

    it('should list reports', async () => {
      mockEvent.httpMethod = 'GET';
      mockEvent.path = '/reports';
      mockEvent.requestContext.authorizer = {
        tenantId: 'tenant-123',
        userId: 'user-123'
      };

      const result = await reportService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.body).toContain('reports');
    });

    it('should delete report', async () => {
      mockEvent.httpMethod = 'DELETE';
      mockEvent.path = '/reports/report-123';
      mockEvent.pathParameters = { reportId: 'report-123' };
      mockEvent.requestContext.authorizer = {
        tenantId: 'tenant-123',
        userId: 'user-123'
      };

      const result = await reportService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.body).toContain('deleted successfully');
    });

    it('should return 404 for unknown routes', async () => {
      mockEvent.path = '/unknown-route';

      const result = await reportService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(404);
      expect(result.body).toContain('Report endpoint not found');
    });
  });

  describe('generateReport', () => {
    it('should generate executive report', async () => {
      mockEvent.body = JSON.stringify({
        scanId: 'scan-123',
        reportType: 'executive',
        format: 'html',
        includeCharts: true,
        includeRemediation: false
      });
      mockEvent.requestContext.authorizer = {
        tenantId: 'tenant-123',
        userId: 'user-123'
      };

      const result = await reportService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(201);
      const response = JSON.parse(result.body);
      expect(response.data.reportId).toBeDefined();
      expect(response.data.reportUrl).toBeDefined();
    });

    it('should generate technical report', async () => {
      mockEvent.body = JSON.stringify({
        scanId: 'scan-123',
        reportType: 'technical',
        format: 'html',
        includeCharts: true,
        includeRemediation: true
      });
      mockEvent.requestContext.authorizer = {
        tenantId: 'tenant-123',
        userId: 'user-123'
      };

      const result = await reportService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(201);
      const response = JSON.parse(result.body);
      expect(response.data.reportId).toBeDefined();
    });

    it('should generate remediation report', async () => {
      mockEvent.body = JSON.stringify({
        scanId: 'scan-123',
        reportType: 'remediation',
        format: 'html',
        includeCharts: false,
        includeRemediation: true
      });
      mockEvent.requestContext.authorizer = {
        tenantId: 'tenant-123',
        userId: 'user-123'
      };

      const result = await reportService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(201);
      const response = JSON.parse(result.body);
      expect(response.data.reportId).toBeDefined();
    });
  });
});

describe('ReportTemplateEngine', () => {
  let templateEngine: ReportTemplateEngine;

  beforeEach(() => {
    templateEngine = new ReportTemplateEngine();
  });

  describe('generateReport', () => {
    it('should generate HTML report with all sections', async () => {
      const mockData = {
        reportId: 'report-123',
        scanData: {
          scanId: 'scan-123',
          complianceScore: 85,
          frameworks: ['SOC2'],
          regions: ['us-east-1'],
          services: ['s3', 'iam']
        },
        findings: [
          {
            findingId: 'finding-1',
            severity: 'high',
            title: 'Test finding',
            description: 'Test description',
            service: 's3',
            region: 'us-east-1',
            frameworks: ['SOC2']
          }
        ],
        reportType: 'detailed' as const,
        includeCharts: true,
        includeRemediation: true,
        generatedBy: 'user-123',
        generatedAt: '2024-01-01T10:00:00Z'
      };

      const html = await templateEngine.generateReport(mockData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Compliance Report');
      expect(html).toContain('Executive Summary');
      expect(html).toContain('Compliance Overview');
      expect(html).toContain('Findings Summary');
      expect(html).toContain('Detailed Findings');
      expect(html).toContain('Remediation Guidance');
    });

    it('should generate executive report with limited sections', async () => {
      const mockData = {
        reportId: 'report-123',
        scanData: {
          scanId: 'scan-123',
          complianceScore: 85,
          frameworks: ['SOC2'],
          regions: ['us-east-1'],
          services: ['s3', 'iam']
        },
        findings: [],
        reportType: 'executive' as const,
        includeCharts: false,
        includeRemediation: false,
        generatedBy: 'user-123',
        generatedAt: '2024-01-01T10:00:00Z'
      };

      const html = await templateEngine.generateReport(mockData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Executive Summary');
      expect(html).not.toContain('Technical Details');
    });

    it('should handle empty findings gracefully', async () => {
      const mockData = {
        reportId: 'report-123',
        scanData: {
          scanId: 'scan-123',
          complianceScore: 100,
          frameworks: ['SOC2'],
          regions: ['us-east-1'],
          services: ['s3', 'iam']
        },
        findings: [],
        reportType: 'detailed' as const,
        includeCharts: true,
        includeRemediation: true,
        generatedBy: 'user-123',
        generatedAt: '2024-01-01T10:00:00Z'
      };

      const html = await templateEngine.generateReport(mockData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('0%'); // No findings
    });
  });

  describe('generateSections', () => {
    it('should generate all sections for detailed report', async () => {
      const mockData = {
        reportId: 'report-123',
        scanData: { scanId: 'scan-123' },
        findings: [],
        reportType: 'detailed' as const,
        includeCharts: true,
        includeRemediation: true,
        generatedBy: 'user-123',
        generatedAt: '2024-01-01T10:00:00Z'
      };

      const sections = await (templateEngine as any).generateSections(mockData);

      expect(sections).toHaveLength(6); // executive, overview, findings, detailed, remediation, appendices
      expect(sections[0].id).toBe('executive-summary');
      expect(sections[1].id).toBe('compliance-overview');
      expect(sections[2].id).toBe('findings-summary');
      expect(sections[3].id).toBe('detailed-findings');
      expect(sections[4].id).toBe('remediation-guidance');
      expect(sections[5].id).toBe('appendices');
    });

    it('should generate limited sections for executive report', async () => {
      const mockData = {
        reportId: 'report-123',
        scanData: { scanId: 'scan-123' },
        findings: [],
        reportType: 'executive' as const,
        includeCharts: false,
        includeRemediation: false,
        generatedBy: 'user-123',
        generatedAt: '2024-01-01T10:00:00Z'
      };

      const sections = await (templateEngine as any).generateSections(mockData);

      expect(sections).toHaveLength(4); // executive, overview, findings, appendices
      expect(sections[0].id).toBe('executive-summary');
      expect(sections[1].id).toBe('compliance-overview');
      expect(sections[2].id).toBe('findings-summary');
      expect(sections[3].id).toBe('appendices');
    });
  });
});

describe('ReportDataService', () => {
  let dataService: ReportDataService;

  beforeEach(() => {
    dataService = new ReportDataService();
  });

  describe('getScanData', () => {
    it('should return mock scan data', async () => {
      const scanData = await dataService.getScanData('scan-123', 'tenant-123');

      expect(scanData.scanId).toBe('scan-123');
      expect(scanData.tenantId).toBe('tenant-123');
      expect(scanData.status).toBe('completed');
      expect(scanData.frameworks).toContain('SOC2');
      expect(scanData.frameworks).toContain('HIPAA');
      expect(scanData.regions).toContain('us-east-1');
      expect(scanData.regions).toContain('us-west-2');
      expect(scanData.complianceScore).toBe(73.3);
      expect(scanData.findingsCount).toBe(12);
    });
  });

  describe('getFindingsForScan', () => {
    it('should return mock findings data', async () => {
      const findings = await dataService.getFindingsForScan('scan-123', 'tenant-123');

      expect(findings).toHaveLength(4);
      expect(findings[0].findingId).toBe('finding-001');
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].service).toBe('s3');
      expect(findings[0].frameworks).toContain('SOC2');
      expect(findings[0].frameworks).toContain('HIPAA');
      expect(findings[0].remediation.steps).toHaveLength(5);
      expect(findings[0].remediation.automated).toBe(true);
    });
  });

  describe('getHistoricalScanData', () => {
    it('should return historical scan data', async () => {
      const historicalData = await dataService.getHistoricalScanData('tenant-123', 5);

      expect(historicalData).toHaveLength(5);
      expect(historicalData[0].scanId).toBe('scan-001');
      expect(historicalData[0].tenantId).toBe('tenant-123');
      expect(historicalData[0].status).toBe('completed');
      expect(historicalData[0].complianceScore).toBeGreaterThan(0);
    });
  });

  describe('getComplianceFrameworkRequirements', () => {
    it('should return SOC2 requirements', async () => {
      const requirements = await dataService.getComplianceFrameworkRequirements('SOC2');

      expect(requirements.name).toBe('SOC 2 Type II');
      expect(requirements.controls).toHaveLength(3);
      expect(requirements.controls[0].id).toBe('CC6.1');
      expect(requirements.controls[0].title).toBe('Logical and Physical Access Controls');
    });

    it('should return HIPAA requirements', async () => {
      const requirements = await dataService.getComplianceFrameworkRequirements('HIPAA');

      expect(requirements.name).toBe('Health Insurance Portability and Accountability Act');
      expect(requirements.controls).toHaveLength(3);
      expect(requirements.controls[0].id).toBe('164.312(a)(1)');
      expect(requirements.controls[0].title).toBe('Access Control');
    });

    it('should return null for unknown framework', async () => {
      const requirements = await dataService.getComplianceFrameworkRequirements('UNKNOWN');

      expect(requirements).toBeNull();
    });
  });
});

describe('ReportStorageService', () => {
  let storageService: ReportStorageService;

  beforeEach(() => {
    storageService = new ReportStorageService();
  });

  describe('storeReport', () => {
    it('should store report in S3', async () => {
      const request = {
        reportId: 'report-123',
        tenantId: 'tenant-123',
        content: '<html>Test report</html>',
        format: 'html',
        scanId: 'scan-123',
        reportType: 'detailed',
        generatedBy: 'user-123'
      };

      const url = await storageService.storeReport(request);

      expect(url).toBe('https://s3.amazonaws.com/bucket/report.html');
    });
  });

  describe('getReportContent', () => {
    it('should retrieve report content from S3', async () => {
      const content = await storageService.getReportContent('report-123', 'tenant-123');

      expect(content).toBe('<html>Mock report content</html>');
    });
  });

  describe('getReportMetadata', () => {
    it('should retrieve report metadata', async () => {
      const metadata = await storageService.getReportMetadata('report-123', 'tenant-123');

      expect(metadata).toBeDefined();
      expect(metadata?.reportId).toBe('report-123');
      expect(metadata?.tenantId).toBe('tenant-123');
      expect(metadata?.scanId).toBe('scan-123');
      expect(metadata?.reportType).toBe('detailed');
      expect(metadata?.format).toBe('html');
      expect(metadata?.size).toBe(1024);
    });

    it('should return null for non-existent report', async () => {
      // Mock S3 to return 404
      const mockS3 = require('aws-sdk').S3;
      mockS3.mockImplementation(() => ({
        headObject: jest.fn().mockReturnValue({
          promise: jest.fn().mockRejectedValue({ statusCode: 404 })
        })
      }));

      const metadata = await storageService.getReportMetadata('non-existent', 'tenant-123');

      expect(metadata).toBeNull();
    });
  });

  describe('listReports', () => {
    it('should list reports for tenant', async () => {
      const result = await storageService.listReports({
        tenantId: 'tenant-123',
        limit: 10,
        offset: 0
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.items[0].reportId).toBe('report-123');
    });
  });

  describe('deleteReport', () => {
    it('should delete report from S3', async () => {
      const deleted = await storageService.deleteReport('report-123', 'tenant-123');

      expect(deleted).toBe(true);
    });

    it('should return false for non-existent report', async () => {
      // Mock S3 to return 404
      const mockS3 = require('aws-sdk').S3;
      mockS3.mockImplementation(() => ({
        headObject: jest.fn().mockReturnValue({
          promise: jest.fn().mockRejectedValue({ statusCode: 404 })
        })
      }));

      const deleted = await storageService.deleteReport('non-existent', 'tenant-123');

      expect(deleted).toBe(false);
    });
  });

  describe('cleanupExpiredReports', () => {
    it('should cleanup expired reports', async () => {
      const deletedCount = await storageService.cleanupExpiredReports();

      expect(deletedCount).toBe(0); // No expired reports in mock data
    });
  });

  describe('getPresignedUrl', () => {
    it('should generate presigned URL for report', async () => {
      const url = await storageService.getPresignedUrl('report-123', 'tenant-123', 3600);

      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
    });
  });

  describe('getReportStatistics', () => {
    it('should return report statistics', async () => {
      const stats = await storageService.getReportStatistics('tenant-123');

      expect(stats.totalReports).toBe(1);
      expect(stats.byType).toBeDefined();
      expect(stats.byFormat).toBeDefined();
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.averageSize).toBeGreaterThan(0);
    });
  });
});
