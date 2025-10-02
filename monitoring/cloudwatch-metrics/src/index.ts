import { APIGatewayProxyEvent, APIGatewayProxyResult, Context, ScheduledEvent } from 'aws-lambda';
import { CloudWatchMetricsService } from './services/CloudWatchMetricsService';
import { CustomMetricsCollector } from './services/CustomMetricsCollector';
import { DashboardService } from './services/DashboardService';
import { AlertingService } from './services/AlertingService';
import { logger } from './utils/logger';
import { handleError, ValidationError } from './utils/errorHandler';
import { z } from 'zod';

// Request validation schemas
const PublishMetricRequestSchema = z.object({
  metricName: z.string().min(1).max(255),
  value: z.number(),
  unit: z.enum(['Count', 'Percent', 'Seconds', 'Milliseconds', 'Bytes', 'Kilobytes', 'Megabytes', 'Gigabytes', 'Terabytes']).default('Count'),
  dimensions: z.record(z.string()).optional(),
  timestamp: z.string().optional(),
  namespace: z.string().default('AIComplianceShepherd')
});

const PublishBatchMetricsRequestSchema = z.object({
  metrics: z.array(PublishMetricRequestSchema).min(1).max(20)
});

const CreateDashboardRequestSchema = z.object({
  dashboardName: z.string().min(1).max(255),
  dashboardBody: z.string().min(1),
  tenantId: z.string().optional()
});

const CreateAlarmRequestSchema = z.object({
  alarmName: z.string().min(1).max(255),
  alarmDescription: z.string().optional(),
  metricName: z.string().min(1),
  namespace: z.string().min(1),
  statistic: z.enum(['Average', 'Sum', 'Maximum', 'Minimum', 'SampleCount']),
  threshold: z.number(),
  comparisonOperator: z.enum(['GreaterThanThreshold', 'LessThanThreshold', 'GreaterThanOrEqualToThreshold', 'LessThanOrEqualToThreshold']),
  evaluationPeriods: z.number().min(1).max(5),
  period: z.number().min(60),
  dimensions: z.record(z.string()).optional(),
  snsTopicArn: z.string().optional()
});

// Initialize services
const metricsService = new CloudWatchMetricsService();
const customMetricsCollector = new CustomMetricsCollector();
const dashboardService = new DashboardService();
const alertingService = new AlertingService();

/**
 * Main Lambda handler for CloudWatch metrics operations
 */
export const handler = async (
  event: APIGatewayProxyEvent | ScheduledEvent,
  context: Context
): Promise<APIGatewayProxyResult | void> => {
  const correlationId = context.awsRequestId;
  
  // Handle scheduled metric collection events
  if ('source' in event && event.source === 'aws.events') {
    return await handleScheduledMetricsCollection(event as ScheduledEvent, correlationId);
  }

  // Handle API Gateway events
  const apiEvent = event as APIGatewayProxyEvent;
  
  logger.info('CloudWatch metrics request received', {
    correlationId,
    httpMethod: apiEvent.httpMethod,
    path: apiEvent.path,
    userAgent: apiEvent.headers['User-Agent'],
    sourceIp: apiEvent.requestContext.identity.sourceIp
  });

  try {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (apiEvent.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: ''
      };
    }

    // Route requests based on path and method
    const path = apiEvent.path;
    const method = apiEvent.httpMethod;

    let result: any;

    switch (true) {
      case path === '/metrics' && method === 'POST':
        result = await handlePublishMetric(apiEvent, correlationId);
        break;
      
      case path === '/metrics/batch' && method === 'POST':
        result = await handlePublishBatchMetrics(apiEvent, correlationId);
        break;
      
      case path === '/metrics' && method === 'GET':
        result = await handleGetMetrics(apiEvent, correlationId);
        break;
      
      case path === '/dashboards' && method === 'POST':
        result = await handleCreateDashboard(apiEvent, correlationId);
        break;
      
      case path === '/dashboards' && method === 'GET':
        result = await handleListDashboards(apiEvent, correlationId);
        break;
      
      case path.startsWith('/dashboards/') && method === 'GET':
        result = await handleGetDashboard(apiEvent, correlationId);
        break;
      
      case path === '/alarms' && method === 'POST':
        result = await handleCreateAlarm(apiEvent, correlationId);
        break;
      
      case path === '/alarms' && method === 'GET':
        result = await handleListAlarms(apiEvent, correlationId);
        break;
      
      case path === '/health' && method === 'GET':
        result = await handleHealthCheck(correlationId);
        break;
      
      default:
        throw new ValidationError(`Unsupported path: ${method} ${path}`);
    }

    logger.info('CloudWatch metrics request completed successfully', {
      correlationId,
      statusCode: 200
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: result,
        correlationId
      })
    };

  } catch (error) {
    return handleError(error, correlationId);
  }
};

/**
 * Handle scheduled metrics collection
 */
async function handleScheduledMetricsCollection(event: ScheduledEvent, correlationId: string): Promise<void> {
  logger.info('Processing scheduled metrics collection', {
    correlationId,
    source: event.source,
    detailType: event['detail-type']
  });

  try {
    await customMetricsCollector.collectSystemMetrics();
    await customMetricsCollector.collectBusinessMetrics();
    await customMetricsCollector.collectSecurityMetrics();
    
    logger.info('Scheduled metrics collection completed', { correlationId });
  } catch (error) {
    logger.error('Scheduled metrics collection failed', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Handle publish metric request
 */
async function handlePublishMetric(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const body = JSON.parse(event.body || '{}');
  const validatedData = PublishMetricRequestSchema.parse(body);

  logger.info('Processing publish metric request', {
    correlationId,
    metricName: validatedData.metricName,
    namespace: validatedData.namespace,
    value: validatedData.value,
    unit: validatedData.unit
  });

  const result = await metricsService.publishMetric(
    validatedData.metricName,
    validatedData.value,
    validatedData.unit,
    validatedData.namespace,
    validatedData.dimensions,
    validatedData.timestamp ? new Date(validatedData.timestamp) : undefined
  );

  return {
    success: result.success,
    messageId: result.messageId
  };
}

/**
 * Handle publish batch metrics request
 */
async function handlePublishBatchMetrics(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const body = JSON.parse(event.body || '{}');
  const validatedData = PublishBatchMetricsRequestSchema.parse(body);

  logger.info('Processing publish batch metrics request', {
    correlationId,
    metricCount: validatedData.metrics.length
  });

  const result = await metricsService.publishBatchMetrics(validatedData.metrics);

  return {
    success: result.success,
    publishedCount: result.publishedCount,
    failedCount: result.failedCount,
    errors: result.errors
  };
}

/**
 * Handle get metrics request
 */
async function handleGetMetrics(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const metricName = event.queryStringParameters?.metricName;
  const namespace = event.queryStringParameters?.namespace || 'AIComplianceShepherd';
  const startTime = event.queryStringParameters?.startTime;
  const endTime = event.queryStringParameters?.endTime;
  const period = event.queryStringParameters?.period ? parseInt(event.queryStringParameters.period) : 300;
  const statistic = event.queryStringParameters?.statistic || 'Average';

  if (!metricName) {
    throw new ValidationError('metricName query parameter is required');
  }

  logger.info('Processing get metrics request', {
    correlationId,
    metricName,
    namespace,
    startTime,
    endTime,
    period,
    statistic
  });

  const result = await metricsService.getMetricStatistics(
    metricName,
    namespace,
    startTime ? new Date(startTime) : new Date(Date.now() - 3600000), // Default: 1 hour ago
    endTime ? new Date(endTime) : new Date(),
    period,
    statistic as any
  );

  return {
    metricName,
    namespace,
    datapoints: result.datapoints,
    label: result.label
  };
}

/**
 * Handle create dashboard request
 */
async function handleCreateDashboard(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const body = JSON.parse(event.body || '{}');
  const validatedData = CreateDashboardRequestSchema.parse(body);

  logger.info('Processing create dashboard request', {
    correlationId,
    dashboardName: validatedData.dashboardName,
    tenantId: validatedData.tenantId
  });

  const result = await dashboardService.createDashboard(
    validatedData.dashboardName,
    validatedData.dashboardBody,
    validatedData.tenantId
  );

  return {
    dashboardArn: result.dashboardArn,
    dashboardName: result.dashboardName
  };
}

/**
 * Handle list dashboards request
 */
async function handleListDashboards(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const tenantId = event.queryStringParameters?.tenantId;
  const nextToken = event.queryStringParameters?.nextToken;

  logger.info('Processing list dashboards request', {
    correlationId,
    tenantId,
    hasNextToken: !!nextToken
  });

  const result = await dashboardService.listDashboards(tenantId, nextToken);

  return {
    dashboards: result.dashboards,
    nextToken: result.nextToken
  };
}

/**
 * Handle get dashboard request
 */
async function handleGetDashboard(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const pathParts = event.path.split('/');
  const dashboardName = decodeURIComponent(pathParts[2]);

  logger.info('Processing get dashboard request', {
    correlationId,
    dashboardName
  });

  const result = await dashboardService.getDashboard(dashboardName);

  return {
    dashboardName: result.dashboardName,
    dashboardArn: result.dashboardArn,
    dashboardBody: result.dashboardBody,
    size: result.size
  };
}

/**
 * Handle create alarm request
 */
async function handleCreateAlarm(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const body = JSON.parse(event.body || '{}');
  const validatedData = CreateAlarmRequestSchema.parse(body);

  logger.info('Processing create alarm request', {
    correlationId,
    alarmName: validatedData.alarmName,
    metricName: validatedData.metricName,
    threshold: validatedData.threshold
  });

  const result = await alertingService.createAlarm(
    validatedData.alarmName,
    validatedData.alarmDescription,
    validatedData.metricName,
    validatedData.namespace,
    validatedData.statistic,
    validatedData.threshold,
    validatedData.comparisonOperator,
    validatedData.evaluationPeriods,
    validatedData.period,
    validatedData.dimensions,
    validatedData.snsTopicArn
  );

  return {
    alarmArn: result.alarmArn,
    alarmName: result.alarmName
  };
}

/**
 * Handle list alarms request
 */
async function handleListAlarms(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const stateValue = event.queryStringParameters?.stateValue;
  const actionPrefix = event.queryStringParameters?.actionPrefix;
  const nextToken = event.queryStringParameters?.nextToken;

  logger.info('Processing list alarms request', {
    correlationId,
    stateValue,
    actionPrefix,
    hasNextToken: !!nextToken
  });

  const result = await alertingService.listAlarms(stateValue as any, actionPrefix, nextToken);

  return {
    alarms: result.alarms,
    nextToken: result.nextToken
  };
}

/**
 * Handle health check request
 */
async function handleHealthCheck(correlationId: string): Promise<any> {
  logger.info('Processing health check request', { correlationId });

  const health = await metricsService.healthCheck();

  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'cloudwatch-metrics',
    version: '1.0.0',
    checks: health
  };
}
