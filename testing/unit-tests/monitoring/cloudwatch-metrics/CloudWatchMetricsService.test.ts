/**
 * Unit tests for CloudWatchMetricsService
 */

import { CloudWatchMetricsService } from '../../../../monitoring/cloudwatch-metrics/src/services/CloudWatchMetricsService';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { mockAWSResponses } from '../../setup/aws-mocks';

// Mock CloudWatch Client
jest.mock('@aws-sdk/client-cloudwatch');

describe('CloudWatchMetricsService', () => {
  let metricsService: CloudWatchMetricsService;
  let mockCloudWatchClient: jest.Mocked<CloudWatchClient>;

  beforeEach(() => {
    metricsService = new CloudWatchMetricsService();
    mockCloudWatchClient = new CloudWatchClient({}) as jest.Mocked<CloudWatchClient>;
    
    // Set up mock client
    (metricsService as any).cloudWatchClient = mockCloudWatchClient;

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('publishBusinessMetrics', () => {
    it('should publish business metrics successfully', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();
      const metrics = {
        scansCompleted: 5,
        findingsCreated: 25,
        criticalFindings: 3,
        highFindings: 8,
        remediationsApplied: 2,
        reportsGenerated: 1,
        activeUsers: 10,
        apiCalls: 150
      };

      mockCloudWatchClient.send = jest.fn().mockResolvedValue(mockAWSResponses.cloudwatch.putMetricData);

      // Act
      const result = await metricsService.publishBusinessMetrics(tenantId, metrics);

      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.metricsPublished).toBe(8);
      expect(mockCloudWatchClient.send).toHaveBeenCalledTimes(1);

      // Verify the metrics were properly formatted
      const putMetricDataCall = mockCloudWatchClient.send.mock.calls[0][0];
      expect(putMetricDataCall.input.Namespace).toBe('AI-Compliance-Shepherd/Business');
      expect(putMetricDataCall.input.MetricData).toHaveLength(8);
    });

    it('should handle missing optional metrics', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();
      const metrics = {
        scansCompleted: 3,
        findingsCreated: 15
        // Other metrics omitted
      };

      mockCloudWatchClient.send = jest.fn().mockResolvedValue(mockAWSResponses.cloudwatch.putMetricData);

      // Act
      const result = await metricsService.publishBusinessMetrics(tenantId, metrics);

      // Assert
      expect(result.success).toBe(true);
      expect(result.metricsPublished).toBe(2);
    });

    it('should handle CloudWatch errors', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();
      const metrics = { scansCompleted: 1 };

      mockCloudWatchClient.send = jest.fn().mockRejectedValue(
        new Error('InvalidParameterValue: Invalid metric data')
      );

      // Act & Assert
      await expect(metricsService.publishBusinessMetrics(tenantId, metrics))
        .rejects
        .toThrow('InvalidParameterValue: Invalid metric data');
    });
  });

  describe('publishPerformanceMetrics', () => {
    it('should publish performance metrics successfully', async () => {
      // Arrange
      const serviceName = 'scan-environment';
      const metrics = {
        responseTime: 250.5,
        errorRate: 0.02,
        requestCount: 100,
        cpuUtilization: 45.8,
        memoryUtilization: 62.3,
        diskUtilization: 35.1,
        networkIn: 1024,
        networkOut: 2048
      };

      mockCloudWatchClient.send = jest.fn().mockResolvedValue(mockAWSResponses.cloudwatch.putMetricData);

      // Act
      const result = await metricsService.publishPerformanceMetrics(serviceName, metrics);

      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.metricsPublished).toBe(8);
      expect(mockCloudWatchClient.send).toHaveBeenCalledTimes(1);

      // Verify the metrics were properly formatted
      const putMetricDataCall = mockCloudWatchClient.send.mock.calls[0][0];
      expect(putMetricDataCall.input.Namespace).toBe('AI-Compliance-Shepherd/Performance');
      expect(putMetricDataCall.input.MetricData).toHaveLength(8);
    });

    it('should validate metric values', async () => {
      // Arrange
      const serviceName = 'test-service';
      const invalidMetrics = {
        responseTime: -10, // Invalid negative value
        errorRate: 1.5, // Invalid rate > 1
        requestCount: 'invalid' as any // Invalid type
      };

      // Act & Assert
      await expect(metricsService.publishPerformanceMetrics(serviceName, invalidMetrics))
        .rejects
        .toThrow('Invalid metric values');
    });
  });

  describe('publishSecurityMetrics', () => {
    it('should publish security metrics successfully', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();
      const metrics = {
        threatsDetected: 2,
        requestsBlocked: 5,
        vulnerabilitiesFound: 8,
        complianceScore: 85.5,
        authenticationFailures: 3,
        unauthorizedAttempts: 1,
        dataEncrypted: 1024000,
        keysRotated: 2
      };

      mockCloudWatchClient.send = jest.fn().mockResolvedValue(mockAWSResponses.cloudwatch.putMetricData);

      // Act
      const result = await metricsService.publishSecurityMetrics(tenantId, metrics);

      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.metricsPublished).toBe(8);
      expect(mockCloudWatchClient.send).toHaveBeenCalledTimes(1);

      // Verify the metrics were properly formatted
      const putMetricDataCall = mockCloudWatchClient.send.mock.calls[0][0];
      expect(putMetricDataCall.input.Namespace).toBe('AI-Compliance-Shepherd/Security');
    });

    it('should handle zero security events', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();
      const metrics = {
        threatsDetected: 0,
        requestsBlocked: 0,
        complianceScore: 100
      };

      mockCloudWatchClient.send = jest.fn().mockResolvedValue(mockAWSResponses.cloudwatch.putMetricData);

      // Act
      const result = await metricsService.publishSecurityMetrics(tenantId, metrics);

      // Assert
      expect(result.success).toBe(true);
      expect(result.metricsPublished).toBe(3);
    });
  });

  describe('publishInfrastructureMetrics', () => {
    it('should publish infrastructure metrics successfully', async () => {
      // Arrange
      const metrics = {
        lambdaInvocations: 500,
        lambdaErrors: 2,
        lambdaDuration: 1500,
        dynamodbReads: 1000,
        dynamodbWrites: 200,
        s3Requests: 300,
        s3Storage: 10240000,
        apiGatewayRequests: 750
      };

      mockCloudWatchClient.send = jest.fn().mockResolvedValue(mockAWSResponses.cloudwatch.putMetricData);

      // Act
      const result = await metricsService.publishInfrastructureMetrics(metrics);

      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.metricsPublished).toBe(8);
      expect(mockCloudWatchClient.send).toHaveBeenCalledTimes(1);

      // Verify the metrics were properly formatted
      const putMetricDataCall = mockCloudWatchClient.send.mock.calls[0][0];
      expect(putMetricDataCall.input.Namespace).toBe('AI-Compliance-Shepherd/Infrastructure');
    });
  });

  describe('createCustomMetric', () => {
    it('should create custom metric successfully', async () => {
      // Arrange
      const metricName = 'CustomBusinessKPI';
      const value = 42.5;
      const unit = 'Count';
      const dimensions = {
        TenantId: global.testUtils.generateTenantId(),
        Environment: 'production'
      };

      mockCloudWatchClient.send = jest.fn().mockResolvedValue(mockAWSResponses.cloudwatch.putMetricData);

      // Act
      const result = await metricsService.createCustomMetric(metricName, value, unit, dimensions);

      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.metricName).toBe(metricName);
      expect(result.value).toBe(value);
      expect(mockCloudWatchClient.send).toHaveBeenCalledTimes(1);
    });

    it('should validate custom metric parameters', async () => {
      // Arrange
      const invalidMetricName = '';
      const value = 100;

      // Act & Assert
      await expect(metricsService.createCustomMetric(invalidMetricName, value))
        .rejects
        .toThrow('Invalid metric parameters');
    });
  });

  describe('getMetricStatistics', () => {
    it('should retrieve metric statistics successfully', async () => {
      // Arrange
      const metricName = 'ScansCompleted';
      const startTime = new Date(Date.now() - 3600000); // 1 hour ago
      const endTime = new Date();
      const period = 300; // 5 minutes

      const mockStatistics = {
        Datapoints: [
          {
            Timestamp: new Date(),
            Average: 5.5,
            Maximum: 10,
            Minimum: 1,
            Sum: 55,
            SampleCount: 10,
            Unit: 'Count'
          }
        ]
      };

      mockCloudWatchClient.send = jest.fn().mockResolvedValue(mockStatistics);

      // Act
      const result = await metricsService.getMetricStatistics(metricName, startTime, endTime, period);

      // Assert
      expect(result).toBeDefined();
      expect(result.datapoints).toHaveLength(1);
      expect(result.datapoints[0].average).toBe(5.5);
      expect(result.datapoints[0].maximum).toBe(10);
      expect(result.datapoints[0].minimum).toBe(1);
    });

    it('should handle empty metric data', async () => {
      // Arrange
      const metricName = 'NonExistentMetric';
      const startTime = new Date(Date.now() - 3600000);
      const endTime = new Date();

      mockCloudWatchClient.send = jest.fn().mockResolvedValue({
        Datapoints: []
      });

      // Act
      const result = await metricsService.getMetricStatistics(metricName, startTime, endTime);

      // Assert
      expect(result.datapoints).toHaveLength(0);
    });
  });

  describe('createAlarm', () => {
    it('should create CloudWatch alarm successfully', async () => {
      // Arrange
      const alarmConfig = {
        alarmName: 'HighErrorRate',
        metricName: 'ErrorRate',
        threshold: 0.05,
        comparisonOperator: 'GreaterThanThreshold' as const,
        evaluationPeriods: 2,
        period: 300,
        statistic: 'Average' as const,
        description: 'Alert when error rate exceeds 5%'
      };

      mockCloudWatchClient.send = jest.fn().mockResolvedValue(mockAWSResponses.cloudwatch.putMetricAlarm);

      // Act
      const result = await metricsService.createAlarm(alarmConfig);

      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.alarmName).toBe(alarmConfig.alarmName);
      expect(mockCloudWatchClient.send).toHaveBeenCalledTimes(1);
    });

    it('should validate alarm configuration', async () => {
      // Arrange
      const invalidAlarmConfig = {
        alarmName: '',
        threshold: -1,
        evaluationPeriods: 0
      } as any;

      // Act & Assert
      await expect(metricsService.createAlarm(invalidAlarmConfig))
        .rejects
        .toThrow('Invalid alarm configuration');
    });
  });

  describe('batchPublishMetrics', () => {
    it('should publish multiple metrics in batch', async () => {
      // Arrange
      const metrics = [
        {
          metricName: 'ScansCompleted',
          value: 5,
          unit: 'Count',
          dimensions: { TenantId: global.testUtils.generateTenantId() }
        },
        {
          metricName: 'FindingsCreated',
          value: 25,
          unit: 'Count',
          dimensions: { TenantId: global.testUtils.generateTenantId() }
        },
        {
          metricName: 'ResponseTime',
          value: 150.5,
          unit: 'Milliseconds',
          dimensions: { Service: 'api-gateway' }
        }
      ];

      mockCloudWatchClient.send = jest.fn().mockResolvedValue(mockAWSResponses.cloudwatch.putMetricData);

      // Act
      const result = await metricsService.batchPublishMetrics(metrics);

      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.metricsPublished).toBe(3);
      expect(mockCloudWatchClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle batch size limits', async () => {
      // Arrange
      const largeMetricsBatch = Array(25).fill(null).map((_, index) => ({
        metricName: `Metric${index}`,
        value: index,
        unit: 'Count'
      }));

      mockCloudWatchClient.send = jest.fn().mockResolvedValue(mockAWSResponses.cloudwatch.putMetricData);

      // Act
      const result = await metricsService.batchPublishMetrics(largeMetricsBatch);

      // Assert
      expect(result.success).toBe(true);
      expect(result.metricsPublished).toBe(25);
      // Should be called twice due to batch size limit (20 metrics per batch)
      expect(mockCloudWatchClient.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTenantMetrics', () => {
    it('should retrieve tenant-specific metrics', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();
      const startTime = new Date(Date.now() - 86400000); // 24 hours ago
      const endTime = new Date();

      const mockMetrics = {
        businessMetrics: {
          scansCompleted: 10,
          findingsCreated: 50,
          complianceScore: 87.5
        },
        performanceMetrics: {
          averageResponseTime: 200,
          errorRate: 0.01
        },
        securityMetrics: {
          threatsDetected: 1,
          complianceScore: 87.5
        }
      };

      mockCloudWatchClient.send = jest.fn().mockResolvedValue({
        Datapoints: [
          {
            Timestamp: new Date(),
            Average: 10,
            Unit: 'Count'
          }
        ]
      });

      // Act
      const result = await metricsService.getTenantMetrics(tenantId, startTime, endTime);

      // Assert
      expect(result).toBeDefined();
      expect(result.tenantId).toBe(tenantId);
      expect(result.timeRange.startTime).toEqual(startTime);
      expect(result.timeRange.endTime).toEqual(endTime);
      expect(result.metrics).toBeDefined();
    });
  });

  describe('health check', () => {
    it('should return healthy status when CloudWatch is accessible', async () => {
      // Arrange
      mockCloudWatchClient.send = jest.fn().mockResolvedValue({
        Metrics: []
      });

      // Act
      const result = await metricsService.healthCheck();

      // Assert
      expect(result).toBeDefined();
      expect(result.cloudwatch).toBe(true);
      expect(result.connectivity).toBe(true);
    });

    it('should return unhealthy status when CloudWatch is inaccessible', async () => {
      // Arrange
      mockCloudWatchClient.send = jest.fn().mockRejectedValue(
        new Error('Service temporarily unavailable')
      );

      // Act
      const result = await metricsService.healthCheck();

      // Assert
      expect(result.cloudwatch).toBe(false);
      expect(result.connectivity).toBe(false);
    });
  });

  describe('metric validation', () => {
    it('should validate metric dimensions', async () => {
      // Arrange
      const metrics = {
        scansCompleted: 5
      };
      const invalidTenantId = 'invalid tenant id with spaces';

      // Act & Assert
      await expect(metricsService.publishBusinessMetrics(invalidTenantId, metrics))
        .rejects
        .toThrow('Invalid tenant ID format');
    });

    it('should validate metric values range', async () => {
      // Arrange
      const serviceName = 'test-service';
      const metrics = {
        errorRate: 2.0, // Invalid rate > 1.0
        cpuUtilization: 150 // Invalid percentage > 100
      };

      // Act & Assert
      await expect(metricsService.publishPerformanceMetrics(serviceName, metrics))
        .rejects
        .toThrow('Invalid metric values');
    });
  });
});
