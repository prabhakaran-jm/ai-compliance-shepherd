import {
  CloudWatchClient,
  PutMetricDataCommand,
  GetMetricStatisticsCommand,
  ListMetricsCommand,
  MetricDatum,
  Dimension,
  StandardUnit,
  Statistic
} from '@aws-sdk/client-cloudwatch';
import { logger } from '../utils/logger';
import { MetricsError } from '../utils/errorHandler';
import { v4 as uuidv4 } from 'uuid';

export interface MetricData {
  metricName: string;
  value: number;
  unit: StandardUnit;
  namespace: string;
  dimensions?: Record<string, string>;
  timestamp?: Date;
}

export interface PublishMetricResult {
  success: boolean;
  messageId: string;
}

export interface PublishBatchMetricsResult {
  success: boolean;
  publishedCount: number;
  failedCount: number;
  errors: string[];
}

export interface MetricStatisticsResult {
  datapoints: Array<{
    timestamp: Date;
    value: number;
    unit: string;
  }>;
  label: string;
}

export interface HealthCheckResult {
  cloudwatch: boolean;
  metricsPublishing: boolean;
  metricsRetrieval: boolean;
}

/**
 * CloudWatch Metrics Service
 * 
 * Provides comprehensive CloudWatch metrics management including publishing custom metrics,
 * retrieving metric statistics, and managing metric-based monitoring for the platform.
 */
export class CloudWatchMetricsService {
  private cloudWatchClient: CloudWatchClient;
  private readonly region: string;
  private readonly defaultNamespace: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.cloudWatchClient = new CloudWatchClient({ region: this.region });
    this.defaultNamespace = 'AIComplianceShepherd';
  }

  /**
   * Publish a single metric to CloudWatch
   */
  async publishMetric(
    metricName: string,
    value: number,
    unit: StandardUnit = StandardUnit.Count,
    namespace: string = this.defaultNamespace,
    dimensions?: Record<string, string>,
    timestamp?: Date
  ): Promise<PublishMetricResult> {
    try {
      logger.info('Publishing metric to CloudWatch', {
        metricName,
        value,
        unit,
        namespace,
        dimensions,
        timestamp
      });

      const metricData: MetricDatum = {
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Timestamp: timestamp || new Date()
      };

      if (dimensions) {
        metricData.Dimensions = Object.entries(dimensions).map(([name, value]) => ({
          Name: name,
          Value: value
        }));
      }

      const command = new PutMetricDataCommand({
        Namespace: namespace,
        MetricData: [metricData]
      });

      const result = await this.cloudWatchClient.send(command);
      const messageId = result.$metadata.requestId || uuidv4();

      logger.info('Metric published successfully', {
        metricName,
        namespace,
        messageId
      });

      return {
        success: true,
        messageId
      };

    } catch (error) {
      logger.error('Failed to publish metric', {
        metricName,
        namespace,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new MetricsError(`Failed to publish metric: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Publish multiple metrics to CloudWatch in a batch
   */
  async publishBatchMetrics(metrics: MetricData[]): Promise<PublishBatchMetricsResult> {
    try {
      logger.info('Publishing batch metrics to CloudWatch', {
        metricCount: metrics.length
      });

      // Group metrics by namespace (CloudWatch requirement)
      const metricsByNamespace = new Map<string, MetricDatum[]>();

      for (const metric of metrics) {
        const metricData: MetricDatum = {
          MetricName: metric.metricName,
          Value: metric.value,
          Unit: metric.unit,
          Timestamp: metric.timestamp || new Date()
        };

        if (metric.dimensions) {
          metricData.Dimensions = Object.entries(metric.dimensions).map(([name, value]) => ({
            Name: name,
            Value: value
          }));
        }

        const namespace = metric.namespace || this.defaultNamespace;
        if (!metricsByNamespace.has(namespace)) {
          metricsByNamespace.set(namespace, []);
        }
        metricsByNamespace.get(namespace)!.push(metricData);
      }

      let publishedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      // Publish metrics for each namespace
      for (const [namespace, namespaceMetrics] of metricsByNamespace) {
        try {
          // CloudWatch allows up to 20 metrics per request
          const chunks = this.chunkArray(namespaceMetrics, 20);

          for (const chunk of chunks) {
            const command = new PutMetricDataCommand({
              Namespace: namespace,
              MetricData: chunk
            });

            await this.cloudWatchClient.send(command);
            publishedCount += chunk.length;
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to publish metrics for namespace ${namespace}: ${errorMessage}`);
          failedCount += namespaceMetrics.length;

          logger.error('Failed to publish metrics for namespace', {
            namespace,
            metricCount: namespaceMetrics.length,
            error: errorMessage
          });
        }
      }

      logger.info('Batch metrics publishing completed', {
        publishedCount,
        failedCount,
        errorCount: errors.length
      });

      return {
        success: failedCount === 0,
        publishedCount,
        failedCount,
        errors
      };

    } catch (error) {
      logger.error('Failed to publish batch metrics', {
        metricCount: metrics.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new MetricsError(`Failed to publish batch metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get metric statistics from CloudWatch
   */
  async getMetricStatistics(
    metricName: string,
    namespace: string,
    startTime: Date,
    endTime: Date,
    period: number,
    statistic: Statistic,
    dimensions?: Record<string, string>
  ): Promise<MetricStatisticsResult> {
    try {
      logger.info('Retrieving metric statistics from CloudWatch', {
        metricName,
        namespace,
        startTime,
        endTime,
        period,
        statistic,
        dimensions
      });

      const dimensionsArray: Dimension[] = dimensions
        ? Object.entries(dimensions).map(([name, value]) => ({
            Name: name,
            Value: value
          }))
        : [];

      const command = new GetMetricStatisticsCommand({
        Namespace: namespace,
        MetricName: metricName,
        StartTime: startTime,
        EndTime: endTime,
        Period: period,
        Statistics: [statistic],
        Dimensions: dimensionsArray
      });

      const result = await this.cloudWatchClient.send(command);

      const datapoints = (result.Datapoints || [])
        .map(datapoint => ({
          timestamp: datapoint.Timestamp!,
          value: this.getStatisticValue(datapoint, statistic),
          unit: datapoint.Unit || 'None'
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      logger.info('Metric statistics retrieved successfully', {
        metricName,
        namespace,
        datapointCount: datapoints.length
      });

      return {
        datapoints,
        label: result.Label || metricName
      };

    } catch (error) {
      logger.error('Failed to retrieve metric statistics', {
        metricName,
        namespace,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new MetricsError(`Failed to retrieve metric statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List available metrics
   */
  async listMetrics(
    namespace?: string,
    metricName?: string,
    dimensions?: Record<string, string>,
    nextToken?: string
  ): Promise<{
    metrics: Array<{
      metricName: string;
      namespace: string;
      dimensions: Record<string, string>;
    }>;
    nextToken?: string;
  }> {
    try {
      logger.info('Listing metrics from CloudWatch', {
        namespace,
        metricName,
        dimensions,
        hasNextToken: !!nextToken
      });

      const dimensionsArray: Dimension[] = dimensions
        ? Object.entries(dimensions).map(([name, value]) => ({
            Name: name,
            Value: value
          }))
        : [];

      const command = new ListMetricsCommand({
        Namespace: namespace,
        MetricName: metricName,
        Dimensions: dimensionsArray.length > 0 ? dimensionsArray : undefined,
        NextToken: nextToken
      });

      const result = await this.cloudWatchClient.send(command);

      const metrics = (result.Metrics || []).map(metric => ({
        metricName: metric.MetricName!,
        namespace: metric.Namespace!,
        dimensions: (metric.Dimensions || []).reduce((acc, dim) => {
          acc[dim.Name!] = dim.Value!;
          return acc;
        }, {} as Record<string, string>)
      }));

      logger.info('Metrics listed successfully', {
        metricCount: metrics.length,
        hasNextToken: !!result.NextToken
      });

      return {
        metrics,
        nextToken: result.NextToken
      };

    } catch (error) {
      logger.error('Failed to list metrics', {
        namespace,
        metricName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new MetricsError(`Failed to list metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Publish business metrics for the platform
   */
  async publishBusinessMetrics(tenantId: string, metrics: {
    scanCount?: number;
    findingCount?: number;
    remediationCount?: number;
    reportCount?: number;
    userCount?: number;
  }): Promise<void> {
    const metricsToPublish: MetricData[] = [];
    const timestamp = new Date();
    const dimensions = { TenantId: tenantId };

    if (metrics.scanCount !== undefined) {
      metricsToPublish.push({
        metricName: 'ScanCount',
        value: metrics.scanCount,
        unit: StandardUnit.Count,
        namespace: `${this.defaultNamespace}/Business`,
        dimensions,
        timestamp
      });
    }

    if (metrics.findingCount !== undefined) {
      metricsToPublish.push({
        metricName: 'FindingCount',
        value: metrics.findingCount,
        unit: StandardUnit.Count,
        namespace: `${this.defaultNamespace}/Business`,
        dimensions,
        timestamp
      });
    }

    if (metrics.remediationCount !== undefined) {
      metricsToPublish.push({
        metricName: 'RemediationCount',
        value: metrics.remediationCount,
        unit: StandardUnit.Count,
        namespace: `${this.defaultNamespace}/Business`,
        dimensions,
        timestamp
      });
    }

    if (metrics.reportCount !== undefined) {
      metricsToPublish.push({
        metricName: 'ReportCount',
        value: metrics.reportCount,
        unit: StandardUnit.Count,
        namespace: `${this.defaultNamespace}/Business`,
        dimensions,
        timestamp
      });
    }

    if (metrics.userCount !== undefined) {
      metricsToPublish.push({
        metricName: 'UserCount',
        value: metrics.userCount,
        unit: StandardUnit.Count,
        namespace: `${this.defaultNamespace}/Business`,
        dimensions,
        timestamp
      });
    }

    if (metricsToPublish.length > 0) {
      await this.publishBatchMetrics(metricsToPublish);
    }
  }

  /**
   * Publish performance metrics
   */
  async publishPerformanceMetrics(serviceName: string, metrics: {
    duration?: number;
    errorCount?: number;
    successCount?: number;
    memoryUsed?: number;
    coldStart?: boolean;
  }): Promise<void> {
    const metricsToPublish: MetricData[] = [];
    const timestamp = new Date();
    const dimensions = { ServiceName: serviceName };

    if (metrics.duration !== undefined) {
      metricsToPublish.push({
        metricName: 'Duration',
        value: metrics.duration,
        unit: StandardUnit.Milliseconds,
        namespace: `${this.defaultNamespace}/Performance`,
        dimensions,
        timestamp
      });
    }

    if (metrics.errorCount !== undefined) {
      metricsToPublish.push({
        metricName: 'ErrorCount',
        value: metrics.errorCount,
        unit: StandardUnit.Count,
        namespace: `${this.defaultNamespace}/Performance`,
        dimensions,
        timestamp
      });
    }

    if (metrics.successCount !== undefined) {
      metricsToPublish.push({
        metricName: 'SuccessCount',
        value: metrics.successCount,
        unit: StandardUnit.Count,
        namespace: `${this.defaultNamespace}/Performance`,
        dimensions,
        timestamp
      });
    }

    if (metrics.memoryUsed !== undefined) {
      metricsToPublish.push({
        metricName: 'MemoryUsed',
        value: metrics.memoryUsed,
        unit: StandardUnit.Megabytes,
        namespace: `${this.defaultNamespace}/Performance`,
        dimensions,
        timestamp
      });
    }

    if (metrics.coldStart !== undefined) {
      metricsToPublish.push({
        metricName: 'ColdStart',
        value: metrics.coldStart ? 1 : 0,
        unit: StandardUnit.Count,
        namespace: `${this.defaultNamespace}/Performance`,
        dimensions,
        timestamp
      });
    }

    if (metricsToPublish.length > 0) {
      await this.publishBatchMetrics(metricsToPublish);
    }
  }

  /**
   * Publish security metrics
   */
  async publishSecurityMetrics(metrics: {
    threatCount?: number;
    blockedRequestCount?: number;
    securityIncidentCount?: number;
    complianceScore?: number;
  }): Promise<void> {
    const metricsToPublish: MetricData[] = [];
    const timestamp = new Date();

    if (metrics.threatCount !== undefined) {
      metricsToPublish.push({
        metricName: 'ThreatCount',
        value: metrics.threatCount,
        unit: StandardUnit.Count,
        namespace: `${this.defaultNamespace}/Security`,
        timestamp
      });
    }

    if (metrics.blockedRequestCount !== undefined) {
      metricsToPublish.push({
        metricName: 'BlockedRequestCount',
        value: metrics.blockedRequestCount,
        unit: StandardUnit.Count,
        namespace: `${this.defaultNamespace}/Security`,
        timestamp
      });
    }

    if (metrics.securityIncidentCount !== undefined) {
      metricsToPublish.push({
        metricName: 'SecurityIncidentCount',
        value: metrics.securityIncidentCount,
        unit: StandardUnit.Count,
        namespace: `${this.defaultNamespace}/Security`,
        timestamp
      });
    }

    if (metrics.complianceScore !== undefined) {
      metricsToPublish.push({
        metricName: 'ComplianceScore',
        value: metrics.complianceScore,
        unit: StandardUnit.Percent,
        namespace: `${this.defaultNamespace}/Security`,
        timestamp
      });
    }

    if (metricsToPublish.length > 0) {
      await this.publishBatchMetrics(metricsToPublish);
    }
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult = {
      cloudwatch: false,
      metricsPublishing: false,
      metricsRetrieval: false
    };

    try {
      // Test CloudWatch connectivity
      const listCommand = new ListMetricsCommand({ Namespace: this.defaultNamespace });
      await this.cloudWatchClient.send(listCommand);
      checks.cloudwatch = true;
    } catch (error) {
      logger.warn('CloudWatch connectivity check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    try {
      // Test metrics publishing
      await this.publishMetric('HealthCheck', 1, StandardUnit.Count, `${this.defaultNamespace}/HealthCheck`);
      checks.metricsPublishing = true;
    } catch (error) {
      logger.warn('Metrics publishing check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    try {
      // Test metrics retrieval
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 300000); // 5 minutes ago
      await this.getMetricStatistics(
        'HealthCheck',
        `${this.defaultNamespace}/HealthCheck`,
        startTime,
        endTime,
        300,
        Statistic.Sum
      );
      checks.metricsRetrieval = true;
    } catch (error) {
      logger.warn('Metrics retrieval check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    return checks;
  }

  /**
   * Get statistic value from datapoint
   */
  private getStatisticValue(datapoint: any, statistic: Statistic): number {
    switch (statistic) {
      case Statistic.Average:
        return datapoint.Average || 0;
      case Statistic.Sum:
        return datapoint.Sum || 0;
      case Statistic.Maximum:
        return datapoint.Maximum || 0;
      case Statistic.Minimum:
        return datapoint.Minimum || 0;
      case Statistic.SampleCount:
        return datapoint.SampleCount || 0;
      default:
        return datapoint.Average || 0;
    }
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
