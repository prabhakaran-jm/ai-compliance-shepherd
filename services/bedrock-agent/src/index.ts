import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { BedrockAgentService } from './services/BedrockAgentService';
import { logger } from './utils/logger';
import { createErrorResponse, handleError } from './utils/errorHandler';
import { validateAgentRequest } from './utils/validation';

/**
 * Lambda handler for Bedrock Agent operations
 * Provides AI agent with action groups for compliance operations
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const correlationId = context.awsRequestId;
  
  logger.info('Bedrock Agent handler invoked', {
    correlationId,
    httpMethod: event.httpMethod,
    path: event.path,
    pathParameters: event.pathParameters
  });

  try {
    // Validate HTTP method
    if (!['POST', 'GET', 'PUT'].includes(event.httpMethod)) {
      return createErrorResponse(405, 'Method not allowed', correlationId);
    }

    const service = new BedrockAgentService();

    // Route based on path and method
    const path = event.path;
    const method = event.httpMethod;

    if (method === 'POST' && path === '/agent/invoke') {
      // Invoke the agent with a request
      const validationResult = validateAgentRequest(event.body);
      if (!validationResult.success) {
        return createErrorResponse(400, 'Invalid request', correlationId, {
          errors: validationResult.errors
        });
      }

      const result = await service.invokeAgent(validationResult.data, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,PUT,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    if (method === 'POST' && path === '/agent/chat') {
      // Chat with the agent
      const validationResult = validateAgentRequest(event.body);
      if (!validationResult.success) {
        return createErrorResponse(400, 'Invalid request', correlationId, {
          errors: validationResult.errors
        });
      }

      const result = await service.chatWithAgent(validationResult.data, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,PUT,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    if (method === 'GET' && path === '/agent/status') {
      // Get agent status
      const result = await service.getAgentStatus(correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,PUT,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    if (method === 'GET' && path.startsWith('/agent/') && path.endsWith('/sessions')) {
      // List agent sessions
      const agentId = event.pathParameters?.agentId;
      if (!agentId) {
        return createErrorResponse(400, 'Missing agent ID', correlationId);
      }

      const result = await service.listSessions(agentId, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,PUT,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    if (method === 'PUT' && path === '/agent/prepare') {
      // Prepare the agent (create/update agent and action groups)
      const result = await service.prepareAgent(correlationId);
      
      return {
        statusCode: 202,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,PUT,OPTIONS'
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
          'Access-Control-Allow-Methods': 'POST,GET,PUT,OPTIONS'
        },
        body: ''
      };
    }

    return createErrorResponse(404, 'Not found', correlationId);

  } catch (error) {
    logger.error('Error in Bedrock Agent handler', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return handleError(error, correlationId);
  }
};
