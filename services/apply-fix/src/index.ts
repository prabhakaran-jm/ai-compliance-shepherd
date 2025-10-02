import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ApplyFixService } from './services/ApplyFixService';
import { logger } from './utils/logger';
import { createErrorResponse, handleError } from './utils/errorHandler';
import { validateRemediationRequest } from './utils/validation';

/**
 * Lambda handler for applying compliance fixes with safety guardrails
 * Supports both immediate fixes and approval-based workflows
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const correlationId = context.awsRequestId;
  
  logger.info('Apply fix handler invoked', {
    correlationId,
    httpMethod: event.httpMethod,
    path: event.path,
    pathParameters: event.pathParameters
  });

  try {
    // Validate HTTP method
    if (!['POST', 'PUT', 'GET'].includes(event.httpMethod)) {
      return createErrorResponse(405, 'Method not allowed', correlationId);
    }

    const service = new ApplyFixService();

    // Route based on path and method
    const path = event.path;
    const method = event.httpMethod;

    if (method === 'POST' && path === '/remediation/apply') {
      // Apply remediation immediately (for safe fixes only)
      const validationResult = validateRemediationRequest(event.body);
      if (!validationResult.success) {
        return createErrorResponse(400, 'Invalid request', correlationId, {
          errors: validationResult.errors
        });
      }

      const result = await service.applyRemediation(validationResult.data, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,PUT,GET,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    if (method === 'POST' && path === '/remediation/request') {
      // Request approval for remediation
      const validationResult = validateRemediationRequest(event.body);
      if (!validationResult.success) {
        return createErrorResponse(400, 'Invalid request', correlationId, {
          errors: validationResult.errors
        });
      }

      const result = await service.requestRemediationApproval(validationResult.data, correlationId);
      
      return {
        statusCode: 202,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,PUT,GET,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    if (method === 'PUT' && path.startsWith('/remediation/') && path.endsWith('/approve')) {
      // Approve pending remediation
      const remediationId = event.pathParameters?.remediationId;
      if (!remediationId) {
        return createErrorResponse(400, 'Missing remediation ID', correlationId);
      }

      const result = await service.approveRemediation(remediationId, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,PUT,GET,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    if (method === 'PUT' && path.startsWith('/remediation/') && path.endsWith('/rollback')) {
      // Rollback applied remediation
      const remediationId = event.pathParameters?.remediationId;
      if (!remediationId) {
        return createErrorResponse(400, 'Missing remediation ID', correlationId);
      }

      const result = await service.rollbackRemediation(remediationId, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,PUT,GET,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    if (method === 'GET' && path.startsWith('/remediation/')) {
      // Get remediation status
      const remediationId = event.pathParameters?.remediationId;
      if (!remediationId) {
        return createErrorResponse(400, 'Missing remediation ID', correlationId);
      }

      const result = await service.getRemediationStatus(remediationId, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,PUT,GET,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    if (method === 'GET' && path === '/remediation/pending') {
      // List pending remediations
      const result = await service.listPendingRemediations(correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,PUT,GET,OPTIONS'
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
          'Access-Control-Allow-Methods': 'POST,PUT,GET,OPTIONS'
        },
        body: ''
      };
    }

    return createErrorResponse(404, 'Not found', correlationId);

  } catch (error) {
    logger.error('Error in apply fix handler', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return handleError(error, correlationId);
  }
};
