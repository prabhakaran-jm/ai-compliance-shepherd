import { APIGatewayProxyEvent, APIGatewayProxyResult, Context, EventBridgeEvent, SNSEvent } from 'aws-lambda';
import { SlackNotificationService } from './services/SlackNotificationService';
import { logger } from './utils/logger';
import { createErrorResponse, handleError } from './utils/errorHandler';
import { validateSlackConfigRequest, validateNotificationRequest } from './utils/validation';

/**
 * Lambda handler for Slack notifications
 * Handles both API Gateway requests and EventBridge/SNS events
 */
export const handler = async (
  event: APIGatewayProxyEvent | EventBridgeEvent<string, any> | SNSEvent,
  context: Context
): Promise<APIGatewayProxyResult | void> => {
  const correlationId = context.awsRequestId;
  
  logger.info('Slack notification handler invoked', {
    correlationId,
    eventType: determineEventType(event),
    source: (event as any).source || 'unknown'
  });

  try {
    const slackService = new SlackNotificationService();

    // Handle API Gateway requests (configuration management)
    if (isAPIGatewayEvent(event)) {
      return await handleAPIGatewayEvent(event, slackService, correlationId);
    }

    // Handle EventBridge events (compliance events)
    if (isEventBridgeEvent(event)) {
      await handleEventBridgeEvent(event, slackService, correlationId);
      return;
    }

    // Handle SNS events (system notifications)
    if (isSNSEvent(event)) {
      await handleSNSEvent(event, slackService, correlationId);
      return;
    }

    logger.warn('Unknown event type received', {
      correlationId,
      eventType: typeof event,
      eventKeys: Object.keys(event)
    });

  } catch (error) {
    logger.error('Error in Slack notification handler', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    if (isAPIGatewayEvent(event)) {
      return handleError(error, correlationId);
    }

    // For non-API Gateway events, we don't return a response
    throw error;
  }
};

/**
 * Handle API Gateway events (configuration management)
 */
async function handleAPIGatewayEvent(
  event: APIGatewayProxyEvent,
  slackService: SlackNotificationService,
  correlationId: string
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  // Configure Slack integration
  if (method === 'POST' && path === '/slack/configure') {
    const validationResult = validateSlackConfigRequest(event.body);
    if (!validationResult.success) {
      return createErrorResponse(400, 'Invalid request', correlationId, {
        errors: validationResult.errors
      });
    }

    const result = await slackService.configureSlackIntegration(validationResult.data, correlationId);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        correlationId,
        result
      })
    };
  }

  // Get Slack configuration
  if (method === 'GET' && path.startsWith('/slack/config/')) {
    const tenantId = event.pathParameters?.tenantId;
    if (!tenantId) {
      return createErrorResponse(400, 'Missing tenant ID', correlationId);
    }

    const result = await slackService.getSlackConfiguration(tenantId, correlationId);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        correlationId,
        result
      })
    };
  }

  // Update Slack configuration
  if (method === 'PUT' && path.startsWith('/slack/config/')) {
    const tenantId = event.pathParameters?.tenantId;
    if (!tenantId) {
      return createErrorResponse(400, 'Missing tenant ID', correlationId);
    }

    const validationResult = validateSlackConfigRequest(event.body);
    if (!validationResult.success) {
      return createErrorResponse(400, 'Invalid request', correlationId, {
        errors: validationResult.errors
      });
    }

    const result = await slackService.updateSlackConfiguration(tenantId, validationResult.data, correlationId);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        correlationId,
        result
      })
    };
  }

  // Delete Slack configuration
  if (method === 'DELETE' && path.startsWith('/slack/config/')) {
    const tenantId = event.pathParameters?.tenantId;
    if (!tenantId) {
      return createErrorResponse(400, 'Missing tenant ID', correlationId);
    }

    const result = await slackService.deleteSlackConfiguration(tenantId, correlationId);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        correlationId,
        result
      })
    };
  }

  // Test Slack notification
  if (method === 'POST' && path === '/slack/test') {
    const validationResult = validateNotificationRequest(event.body);
    if (!validationResult.success) {
      return createErrorResponse(400, 'Invalid request', correlationId, {
        errors: validationResult.errors
      });
    }

    const result = await slackService.sendTestNotification(validationResult.data, correlationId);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        correlationId,
        result
      })
    };
  }

  // List notification history
  if (method === 'GET' && path === '/slack/notifications') {
    const tenantId = event.queryStringParameters?.tenantId;
    const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 50;
    const nextToken = event.queryStringParameters?.nextToken;

    if (!tenantId) {
      return createErrorResponse(400, 'Missing tenant ID', correlationId);
    }

    const result = await slackService.getNotificationHistory(tenantId, limit, nextToken, correlationId);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        correlationId,
        result
      })
    };
  }

  // Handle OPTIONS for CORS
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,OPTIONS'
      },
      body: ''
    };
  }

  return createErrorResponse(404, 'Not found', correlationId);
}

/**
 * Handle EventBridge events (compliance events)
 */
async function handleEventBridgeEvent(
  event: EventBridgeEvent<string, any>,
  slackService: SlackNotificationService,
  correlationId: string
): Promise<void> {
  logger.info('Processing EventBridge event', {
    correlationId,
    source: event.source,
    detailType: event['detail-type']
  });

  const eventType = event['detail-type'];
  const eventData = event.detail;

  switch (eventType) {
    case 'Compliance Scan Completed':
      await slackService.handleScanCompletedEvent(eventData, correlationId);
      break;

    case 'Critical Finding Detected':
      await slackService.handleCriticalFindingEvent(eventData, correlationId);
      break;

    case 'Remediation Applied':
      await slackService.handleRemediationAppliedEvent(eventData, correlationId);
      break;

    case 'Audit Pack Generated':
      await slackService.handleAuditPackGeneratedEvent(eventData, correlationId);
      break;

    case 'Compliance Score Changed':
      await slackService.handleComplianceScoreChangedEvent(eventData, correlationId);
      break;

    case 'Scheduled Scan Failed':
      await slackService.handleScanFailedEvent(eventData, correlationId);
      break;

    default:
      logger.warn('Unknown EventBridge event type', {
        correlationId,
        eventType,
        source: event.source
      });
  }
}

/**
 * Handle SNS events (system notifications)
 */
async function handleSNSEvent(
  event: SNSEvent,
  slackService: SlackNotificationService,
  correlationId: string
): Promise<void> {
  logger.info('Processing SNS event', {
    correlationId,
    recordCount: event.Records.length
  });

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.Sns.Message);
      const subject = record.Sns.Subject;

      await slackService.handleSNSNotification(subject, message, correlationId);

    } catch (error) {
      logger.error('Error processing SNS record', {
        correlationId,
        messageId: record.Sns.MessageId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

/**
 * Type guards for event detection
 */
function isAPIGatewayEvent(event: any): event is APIGatewayProxyEvent {
  return event.httpMethod !== undefined && event.path !== undefined;
}

function isEventBridgeEvent(event: any): event is EventBridgeEvent<string, any> {
  return event.source !== undefined && event['detail-type'] !== undefined;
}

function isSNSEvent(event: any): event is SNSEvent {
  return event.Records !== undefined && event.Records[0]?.Sns !== undefined;
}

/**
 * Determine event type for logging
 */
function determineEventType(event: any): string {
  if (isAPIGatewayEvent(event)) {
    return 'API_GATEWAY';
  }
  if (isEventBridgeEvent(event)) {
    return 'EVENT_BRIDGE';
  }
  if (isSNSEvent(event)) {
    return 'SNS';
  }
  return 'UNKNOWN';
}
