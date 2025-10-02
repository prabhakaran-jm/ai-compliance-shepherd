import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { StepFunctionsOrchestratorService } from './services/StepFunctionsOrchestratorService';
import { logger } from './utils/logger';
import { createErrorResponse, handleError } from './utils/errorHandler';
import { validateWorkflowRequest } from './utils/validation';

/**
 * Lambda handler for Step Functions orchestration
 * Manages workflow execution and monitoring
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const correlationId = context.awsRequestId;
  
  logger.info('Step Functions orchestrator handler invoked', {
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

    const service = new StepFunctionsOrchestratorService();

    // Route based on path and method
    const path = event.path;
    const method = event.httpMethod;

    if (method === 'POST' && path === '/workflows/start') {
      // Start a workflow execution
      const validationResult = validateWorkflowRequest(event.body);
      if (!validationResult.success) {
        return createErrorResponse(400, 'Invalid request', correlationId, {
          errors: validationResult.errors
        });
      }

      const result = await service.startWorkflow(validationResult.data, correlationId);
      
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

    if (method === 'GET' && path.startsWith('/workflows/') && path.endsWith('/status')) {
      // Get workflow execution status
      const executionArn = event.pathParameters?.executionArn;
      if (!executionArn) {
        return createErrorResponse(400, 'Missing execution ARN', correlationId);
      }

      const result = await service.getWorkflowStatus(executionArn, correlationId);
      
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

    if (method === 'PUT' && path.startsWith('/workflows/') && path.endsWith('/stop')) {
      // Stop workflow execution
      const executionArn = event.pathParameters?.executionArn;
      if (!executionArn) {
        return createErrorResponse(400, 'Missing execution ARN', correlationId);
      }

      const result = await service.stopWorkflow(executionArn, correlationId);
      
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

    if (method === 'GET' && path === '/workflows/list') {
      // List workflow executions
      const tenantId = event.queryStringParameters?.tenantId;
      const workflowType = event.queryStringParameters?.workflowType;
      const status = event.queryStringParameters?.status;
      const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 50;

      const result = await service.listWorkflowExecutions({
        tenantId,
        workflowType,
        status,
        limit
      }, correlationId);
      
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

    if (method === 'GET' && path === '/workflows/definitions') {
      // Get available workflow definitions
      const result = await service.getWorkflowDefinitions(correlationId);
      
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
    logger.error('Error in Step Functions orchestrator handler', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return handleError(error, correlationId);
  }
};
