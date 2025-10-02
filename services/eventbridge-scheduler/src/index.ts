import { APIGatewayProxyEvent, APIGatewayProxyResult, Context, EventBridgeEvent } from 'aws-lambda';
import { EventBridgeSchedulerService } from './services/EventBridgeSchedulerService';
import { EventProcessorService } from './services/EventProcessorService';
import { logger } from './utils/logger';
import { createErrorResponse, handleError } from './utils/errorHandler';
import { validateScheduleRequest, validateEventProcessorRequest } from './utils/validation';

/**
 * Lambda handler for EventBridge scheduling and event processing
 * Manages scheduled compliance operations and event-driven triggers
 */
export const handler = async (
  event: APIGatewayProxyEvent | EventBridgeEvent<string, any>,
  context: Context
): Promise<APIGatewayProxyResult | void> => {
  const correlationId = context.awsRequestId;
  
  // Check if this is an EventBridge event (scheduled or custom event)
  if ('source' in event && 'detail-type' in event) {
    return handleEventBridgeEvent(event as EventBridgeEvent<string, any>, correlationId);
  }

  // Handle API Gateway requests
  return handleApiGatewayRequest(event as APIGatewayProxyEvent, correlationId);
};

/**
 * Handle EventBridge events (scheduled and custom events)
 */
async function handleEventBridgeEvent(
  event: EventBridgeEvent<string, any>,
  correlationId: string
): Promise<void> {
  logger.info('EventBridge event received', {
    correlationId,
    source: event.source,
    detailType: event['detail-type'],
    eventTime: event.time
  });

  try {
    const eventProcessor = new EventProcessorService();
    await eventProcessor.processEvent(event, correlationId);

    logger.info('EventBridge event processed successfully', {
      correlationId,
      source: event.source,
      detailType: event['detail-type']
    });

  } catch (error) {
    logger.error('Error processing EventBridge event', {
      correlationId,
      source: event.source,
      detailType: event['detail-type'],
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Don't throw error for EventBridge events to avoid retries
    // Log the error and continue
  }
}

/**
 * Handle API Gateway requests for schedule management
 */
async function handleApiGatewayRequest(
  event: APIGatewayProxyEvent,
  correlationId: string
): Promise<APIGatewayProxyResult> {
  logger.info('EventBridge scheduler handler invoked', {
    correlationId,
    httpMethod: event.httpMethod,
    path: event.path,
    pathParameters: event.pathParameters
  });

  try {
    // Validate HTTP method
    if (!['POST', 'GET', 'PUT', 'DELETE'].includes(event.httpMethod)) {
      return createErrorResponse(405, 'Method not allowed', correlationId);
    }

    const service = new EventBridgeSchedulerService();

    // Route based on path and method
    const path = event.path;
    const method = event.httpMethod;

    if (method === 'POST' && path === '/schedules') {
      // Create a new schedule
      const validationResult = validateScheduleRequest(event.body);
      if (!validationResult.success) {
        return createErrorResponse(400, 'Invalid request', correlationId, {
          errors: validationResult.errors
        });
      }

      const result = await service.createSchedule(validationResult.data, correlationId);
      
      return {
        statusCode: 201,
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

    if (method === 'GET' && path === '/schedules') {
      // List schedules
      const tenantId = event.queryStringParameters?.tenantId;
      const scheduleType = event.queryStringParameters?.scheduleType;
      const status = event.queryStringParameters?.status;
      const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 50;

      const result = await service.listSchedules({
        tenantId,
        scheduleType,
        status,
        limit
      }, correlationId);
      
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

    if (method === 'GET' && path.startsWith('/schedules/') && !path.includes('/')) {
      // Get specific schedule
      const scheduleId = event.pathParameters?.scheduleId;
      if (!scheduleId) {
        return createErrorResponse(400, 'Missing schedule ID', correlationId);
      }

      const result = await service.getSchedule(scheduleId, correlationId);
      
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

    if (method === 'PUT' && path.startsWith('/schedules/')) {
      // Update schedule
      const scheduleId = event.pathParameters?.scheduleId;
      if (!scheduleId) {
        return createErrorResponse(400, 'Missing schedule ID', correlationId);
      }

      const validationResult = validateScheduleRequest(event.body);
      if (!validationResult.success) {
        return createErrorResponse(400, 'Invalid request', correlationId, {
          errors: validationResult.errors
        });
      }

      const result = await service.updateSchedule(scheduleId, validationResult.data, correlationId);
      
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

    if (method === 'DELETE' && path.startsWith('/schedules/')) {
      // Delete schedule
      const scheduleId = event.pathParameters?.scheduleId;
      if (!scheduleId) {
        return createErrorResponse(400, 'Missing schedule ID', correlationId);
      }

      const result = await service.deleteSchedule(scheduleId, correlationId);
      
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

    if (method === 'POST' && path === '/events/trigger') {
      // Manually trigger an event
      const validationResult = validateEventProcessorRequest(event.body);
      if (!validationResult.success) {
        return createErrorResponse(400, 'Invalid request', correlationId, {
          errors: validationResult.errors
        });
      }

      const eventProcessor = new EventProcessorService();
      const result = await eventProcessor.triggerEvent(validationResult.data, correlationId);
      
      return {
        statusCode: 202,
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

    if (method === 'GET' && path === '/events/history') {
      // Get event processing history
      const tenantId = event.queryStringParameters?.tenantId;
      const eventType = event.queryStringParameters?.eventType;
      const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 50;

      const eventProcessor = new EventProcessorService();
      const result = await eventProcessor.getEventHistory({
        tenantId,
        eventType,
        limit
      }, correlationId);
      
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

  } catch (error) {
    logger.error('Error in EventBridge scheduler handler', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return handleError(error, correlationId);
  }
}
