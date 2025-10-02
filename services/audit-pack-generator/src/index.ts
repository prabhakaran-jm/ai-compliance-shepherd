import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { AuditPackGeneratorService } from './services/AuditPackGeneratorService';
import { logger } from './utils/logger';
import { createErrorResponse, handleError } from './utils/errorHandler';
import { validateAuditPackRequest, validateAuditPackListRequest } from './utils/validation';

/**
 * Lambda handler for audit pack generation
 * Collects comprehensive compliance evidence and generates audit packages
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const correlationId = context.awsRequestId;
  
  logger.info('Audit pack generator handler invoked', {
    correlationId,
    httpMethod: event.httpMethod,
    path: event.path,
    pathParameters: event.pathParameters
  });

  try {
    // Validate HTTP method
    if (!['POST', 'GET', 'DELETE'].includes(event.httpMethod)) {
      return createErrorResponse(405, 'Method not allowed', correlationId);
    }

    const auditPackService = new AuditPackGeneratorService();

    // Route based on path and method
    const path = event.path;
    const method = event.httpMethod;

    // Generate audit pack
    if (method === 'POST' && path === '/audit-packs') {
      const validationResult = validateAuditPackRequest(event.body);
      if (!validationResult.success) {
        return createErrorResponse(400, 'Invalid request', correlationId, {
          errors: validationResult.errors
        });
      }

      const result = await auditPackService.generateAuditPack(validationResult.data, correlationId);
      
      return {
        statusCode: 202,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    // List audit packs
    if (method === 'GET' && path === '/audit-packs') {
      const tenantId = event.queryStringParameters?.tenantId;
      const framework = event.queryStringParameters?.framework;
      const status = event.queryStringParameters?.status;
      const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 50;
      const nextToken = event.queryStringParameters?.nextToken;

      const validationResult = validateAuditPackListRequest({
        tenantId,
        framework,
        status,
        limit,
        nextToken
      });

      if (!validationResult.success) {
        return createErrorResponse(400, 'Invalid request parameters', correlationId, {
          errors: validationResult.errors
        });
      }

      const result = await auditPackService.listAuditPacks(validationResult.data, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    // Get specific audit pack
    if (method === 'GET' && path.startsWith('/audit-packs/') && !path.includes('/download')) {
      const auditPackId = event.pathParameters?.auditPackId;
      if (!auditPackId) {
        return createErrorResponse(400, 'Missing audit pack ID', correlationId);
      }

      const result = await auditPackService.getAuditPack(auditPackId, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    // Download audit pack
    if (method === 'GET' && path.includes('/download')) {
      const auditPackId = event.pathParameters?.auditPackId;
      if (!auditPackId) {
        return createErrorResponse(400, 'Missing audit pack ID', correlationId);
      }

      const result = await auditPackService.getAuditPackDownloadUrl(auditPackId, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    // Delete audit pack
    if (method === 'DELETE' && path.startsWith('/audit-packs/')) {
      const auditPackId = event.pathParameters?.auditPackId;
      if (!auditPackId) {
        return createErrorResponse(400, 'Missing audit pack ID', correlationId);
      }

      const result = await auditPackService.deleteAuditPack(auditPackId, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    // Generate compliance summary
    if (method === 'POST' && path === '/audit-packs/summary') {
      const validationResult = validateAuditPackRequest(event.body);
      if (!validationResult.success) {
        return createErrorResponse(400, 'Invalid request', correlationId, {
          errors: validationResult.errors
        });
      }

      const result = await auditPackService.generateComplianceSummary(validationResult.data, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    // Generate evidence report
    if (method === 'POST' && path === '/audit-packs/evidence') {
      const validationResult = validateAuditPackRequest(event.body);
      if (!validationResult.success) {
        return createErrorResponse(400, 'Invalid request', correlationId, {
          errors: validationResult.errors
        });
      }

      const result = await auditPackService.generateEvidenceReport(validationResult.data, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,DELETE,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    // Get audit pack status
    if (method === 'GET' && path.includes('/status')) {
      const auditPackId = event.pathParameters?.auditPackId;
      if (!auditPackId) {
        return createErrorResponse(400, 'Missing audit pack ID', correlationId);
      }

      const result = await auditPackService.getAuditPackStatus(auditPackId, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,DELETE,OPTIONS'
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
          'Access-Control-Allow-Methods': 'POST,GET,DELETE,OPTIONS'
        },
        body: ''
      };
    }

    return createErrorResponse(404, 'Not found', correlationId);

  } catch (error) {
    logger.error('Error in audit pack generator handler', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return handleError(error, correlationId);
  }
};
