import { CloudWatchClient, PutMetricDataCommand, MetricDatum, StandardUnit } from '@aws-sdk/client-cloudwatch';
import { v4 as uuidv4 } from 'uuid';

export interface MetricOptions {
  namespace?: string;
  dimensions?: Record<string, string>;
  timestamp?: Date;
  unit?: StandardUnit;
}

export interface BusinessMetrics {
  scanCount?: number;
  findingCount?: number;
  remediationCount?: number;
  reportCount?: number;
  userCount?: number;
  tenantCount?: number;
}

export interface PerformanceMetrics {
  duration?: number;
  errorCount?: number;
  successCount?: number;
  memoryUsed?: number;
  coldStart?: boolean;
  throughput?: number;
}

export interface SecurityMetrics {
  threatCount?: number;
  blockedRequestCount?: number;
  securityIncidentCount?: number;
  complianceScore?: number;
  vulnerabilityCount?: number;
}

/**
 * Shared metrics collector for consistent metric publishing across all services
 */
export class MetricsCollector {
  private cloudWatchClient: CloudWatchClient;
  private readonly defaultNamespace: string;
  private readonly region: string;

  constructor(namespace: string = 'AIComplianceShepherd') {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.cloudWatchClient = new CloudWatchClient({ region: this.region });
    this.defaultNamespace = namespace;
  }

  /**
   * Publish a single metric
   */
  async publishMetric(
    metricName: string,
    value: number,
    options: MetricOptions = {}
  ): Promise<void> {
    const metricData: MetricDatum = {
      MetricName: metricName,
      Value: value,
      Unit: options.unit || StandardUnit.Count,
      Timestamp: options.timestamp || new Date()
    };

    if (options.dimensions) {
      metricData.Dimensions = Object.entries(options.dimensions).map(([name, value]) => ({
        Name: name,
        Value: value
      }));
    }

    const command = new PutMetricDataCommand({
      Namespace: options.namespace || this.defaultNamespace,
      MetricData: [metricData]
    });

    await this.cloudWatchClient.send(command);
  }

  /**
   * Publish multiple metrics in a batch
   */
  async publishBatchMetrics(
    metrics: Array<{
      name: string;
      value: number;
      options?: MetricOptions;
    }>
  ): Promise<void> {
    // Group metrics by namespace
    const metricsByNamespace = new Map<string, MetricDatum[]>();

    for (const metric of metrics) {
      const namespace = metric.options?.namespace || this.defaultNamespace;
      const metricData: MetricDatum = {
        MetricName: metric.name,
        Value: metric.value,
        Unit: metric.options?.unit || StandardUnit.Count,
        Timestamp: metric.options?.timestamp || new Date()
      };

      if (metric.options?.dimensions) {
        metricData.Dimensions = Object.entries(metric.options.dimensions).map(([name, value]) => ({
          Name: name,
          Value: value
        }));
      }

      if (!metricsByNamespace.has(namespace)) {
        metricsByNamespace.set(namespace, []);
      }
      metricsByNamespace.get(namespace)!.push(metricData);
    }

    // Publish metrics for each namespace
    for (const [namespace, namespaceMetrics] of metricsByNamespace) {
      // CloudWatch allows up to 20 metrics per request
      const chunks = this.chunkArray(namespaceMetrics, 20);

      for (const chunk of chunks) {
        const command = new PutMetricDataCommand({
          Namespace: namespace,
          MetricData: chunk
        });

        await this.cloudWatchClient.send(command);
      }
    }
  }

  /**
   * Publish business metrics
   */
  async publishBusinessMetrics(
    metrics: BusinessMetrics,
    tenantId?: string,
    additionalDimensions?: Record<string, string>
  ): Promise<void> {
    const metricsToPublish: Array<{ name: string; value: number; options?: MetricOptions }> = [];
    const timestamp = new Date();
    const dimensions = {
      ...(tenantId && { TenantId: tenantId }),
      ...additionalDimensions
    };

    if (metrics.scanCount !== undefined) {
      metricsToPublish.push({
        name: 'ScanCount',
        value: metrics.scanCount,
        options: {
          namespace: `${this.defaultNamespace}/Business`,
          dimensions,
          timestamp,
          unit: StandardUnit.Count
        }
      });
    }

    if (metrics.findingCount !== undefined) {
      metricsToPublish.push({
        name: 'FindingCount',
        value: metrics.findingCount,
        options: {
          namespace: `${this.defaultNamespace}/Business`,
          dimensions,
          timestamp,
          unit: StandardUnit.Count
        }
      });
    }

    if (metrics.remediationCount !== undefined) {
      metricsToPublish.push({
        name: 'RemediationCount',
        value: metrics.remediationCount,
        options: {
          namespace: `${this.defaultNamespace}/Business`,
          dimensions,
          timestamp,
          unit: StandardUnit.Count
        }
      });
    }

    if (metrics.reportCount !== undefined) {
      metricsToPublish.push({
        name: 'ReportCount',
        value: metrics.reportCount,
        options: {
          namespace: `${this.defaultNamespace}/Business`,
          dimensions,
          timestamp,
          unit: StandardUnit.Count
        }
      });
    }

    if (metrics.userCount !== undefined) {
      metricsToPublish.push({
        name: 'UserCount',
        value: metrics.userCount,
        options: {
          namespace: `${this.defaultNamespace}/Business`,
          dimensions,
          timestamp,
          unit: StandardUnit.Count
        }
      });
    }

    if (metrics.tenantCount !== undefined) {
      metricsToPublish.push({
        name: 'TenantCount',
        value: metrics.tenantCount,
        options: {
          namespace: `${this.defaultNamespace}/Business`,
          dimensions,
          timestamp,
          unit: StandardUnit.Count
        }
      });
    }

    if (metricsToPublish.length > 0) {
      await this.publishBatchMetrics(metricsToPublish);
    }
  }

  /**
   * Publish performance metrics
   */
  async publishPerformanceMetrics(
    serviceName: string,
    metrics: PerformanceMetrics,
    additionalDimensions?: Record<string, string>
  ): Promise<void> {
    const metricsToPublish: Array<{ name: string; value: number; options?: MetricOptions }> = [];
    const timestamp = new Date();
    const dimensions = {
      ServiceName: serviceName,
      ...additionalDimensions
    };

    if (metrics.duration !== undefined) {
      metricsToPublish.push({
        name: 'Duration',
        value: metrics.duration,
        options: {
          namespace: `${this.defaultNamespace}/Performance`,
          dimensions,
          timestamp,
          unit: StandardUnit.Milliseconds
        }
      });
    }

    if (metrics.errorCount !== undefined) {
      metricsToPublish.push({
        name: 'ErrorCount',
        value: metrics.errorCount,
        options: {
          namespace: `${this.defaultNamespace}/Performance`,
          dimensions,
          timestamp,
          unit: StandardUnit.Count
        }
      });
    }

    if (metrics.successCount !== undefined) {
      metricsToPublish.push({
        name: 'SuccessCount',
        value: metrics.successCount,
        options: {
          namespace: `${this.defaultNamespace}/Performance`,
          dimensions,
          timestamp,
          unit: StandardUnit.Count
        }
      });
    }

    if (metrics.memoryUsed !== undefined) {
      metricsToPublish.push({
        name: 'MemoryUsed',
        value: metrics.memoryUsed,
        options: {
          namespace: `${this.defaultNamespace}/Performance`,
          dimensions,
          timestamp,
          unit: StandardUnit.Megabytes
        }
      });
    }

    if (metrics.coldStart !== undefined) {
      metricsToPublish.push({
        name: 'ColdStart',
        value: metrics.coldStart ? 1 : 0,
        options: {
          namespace: `${this.defaultNamespace}/Performance`,
          dimensions,
          timestamp,
          unit: StandardUnit.Count
        }
      });
    }

    if (metrics.throughput !== undefined) {
      metricsToPublish.push({
        name: 'Throughput',
        value: metrics.throughput,
        options: {
          namespace: `${this.defaultNamespace}/Performance`,
          dimensions,
          timestamp,
          unit: StandardUnit.CountPerSecond
        }
      });
    }

    if (metricsToPublish.length > 0) {
      await this.publishBatchMetrics(metricsToPublish);
    }
  }

  /**
   * Publish security metrics
   */
  async publishSecurityMetrics(
    metrics: SecurityMetrics,
    additionalDimensions?: Record<string, string>
  ): Promise<void> {
    const metricsToPublish: Array<{ name: string; value: number; options?: MetricOptions }> = [];
    const timestamp = new Date();
    const dimensions = additionalDimensions || {};

    if (metrics.threatCount !== undefined) {
      metricsToPublish.push({
        name: 'ThreatCount',
        value: metrics.threatCount,
        options: {
          namespace: `${this.defaultNamespace}/Security`,
          dimensions,
          timestamp,
          unit: StandardUnit.Count
        }
      });
    }

    if (metrics.blockedRequestCount !== undefined) {
      metricsToPublish.push({
        name: 'BlockedRequestCount',
        value: metrics.blockedRequestCount,
        options: {
          namespace: `${this.defaultNamespace}/Security`,
          dimensions,
          timestamp,
          unit: StandardUnit.Count
        }
      });
    }

    if (metrics.securityIncidentCount !== undefined) {
      metricsToPublish.push({
        name: 'SecurityIncidentCount',
        value: metrics.securityIncidentCount,
        options: {
          namespace: `${this.defaultNamespace}/Security`,
          dimensions,
          timestamp,
          unit: StandardUnit.Count
        }
      });
    }

    if (metrics.complianceScore !== undefined) {
      metricsToPublish.push({
        name: 'ComplianceScore',
        value: metrics.complianceScore,
        options: {
          namespace: `${this.defaultNamespace}/Security`,
          dimensions,
          timestamp,
          unit: StandardUnit.Percent
        }
      });
    }

    if (metrics.vulnerabilityCount !== undefined) {
      metricsToPublish.push({
        name: 'VulnerabilityCount',
        value: metrics.vulnerabilityCount,
        options: {
          namespace: `${this.defaultNamespace}/Security`,
          dimensions,
          timestamp,
          unit: StandardUnit.Count
        }
      });
    }

    if (metricsToPublish.length > 0) {
      await this.publishBatchMetrics(metricsToPublish);
    }
  }

  /**
   * Create a timer for measuring execution time
   */
  createTimer(metricName: string, options: MetricOptions = {}): {
    stop: () => Promise<void>;
  } {
    const startTime = Date.now();

    return {
      stop: async () => {
        const duration = Date.now() - startTime;
        await this.publishMetric(metricName, duration, {
          ...options,
          unit: StandardUnit.Milliseconds
        });
      }
    };
  }

  /**
   * Increment a counter metric
   */
  async incrementCounter(
    metricName: string,
    value: number = 1,
    options: MetricOptions = {}
  ): Promise<void> {
    await this.publishMetric(metricName, value, {
      ...options,
      unit: StandardUnit.Count
    });
  }

  /**
   * Record a gauge metric
   */
  async recordGauge(
    metricName: string,
    value: number,
    options: MetricOptions = {}
  ): Promise<void> {
    await this.publishMetric(metricName, value, options);
  }

  /**
   * Record a histogram metric (using CloudWatch percentiles)
   */
  async recordHistogram(
    metricName: string,
    value: number,
    options: MetricOptions = {}
  ): Promise<void> {
    await this.publishMetric(metricName, value, {
      ...options,
      unit: options.unit || StandardUnit.Milliseconds
    });
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

// Export singleton instance
export const metricsCollector = new MetricsCollector();

// Export utility functions
export const publishBusinessMetrics = (
  metrics: BusinessMetrics,
  tenantId?: string,
  additionalDimensions?: Record<string, string>
) => metricsCollector.publishBusinessMetrics(metrics, tenantId, additionalDimensions);

export const publishPerformanceMetrics = (
  serviceName: string,
  metrics: PerformanceMetrics,
  additionalDimensions?: Record<string, string>
) => metricsCollector.publishPerformanceMetrics(serviceName, metrics, additionalDimensions);

export const publishSecurityMetrics = (
  metrics: SecurityMetrics,
  additionalDimensions?: Record<string, string>
) => metricsCollector.publishSecurityMetrics(metrics, additionalDimensions);

export const createTimer = (metricName: string, options: MetricOptions = {}) =>
  metricsCollector.createTimer(metricName, options);

export const incrementCounter = (
  metricName: string,
  value: number = 1,
  options: MetricOptions = {}
) => metricsCollector.incrementCounter(metricName, value, options);

export const recordGauge = (
  metricName: string,
  value: number,
  options: MetricOptions = {}
) => metricsCollector.recordGauge(metricName, value, options);

export const recordHistogram = (
  metricName: string,
  value: number,
  options: MetricOptions = {}
) => metricsCollector.recordHistogram(metricName, value, options);
