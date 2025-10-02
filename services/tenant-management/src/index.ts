import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { TenantManagementService } from './services/TenantManagementService';
import { TenantIsolationService } from './services/TenantIsolationService';
import { TenantOnboardingService } from './services/TenantOnboardingService';
import { logger } from './utils/logger';
import { createErrorResponse, handleError } from './utils/errorHandler';
import { 
  validateTenantRequest, 
  validateTenantUpdateRequest,
  validateTenantConfigRequest 
} from './utils/validation';

/**
 * Lambda handler for tenant management operations
 * Manages multi-tenant architecture with secure isolation
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const correlationId = context.awsRequestId;
  
  logger.info('Tenant management handler invoked', {
    correlationId,
    httpMethod: event.httpMethod,
    path: event.path,
    pathParameters: event.pathParameters
  });

  try {
    // Validate HTTP method
    if (!['POST', 'GET', 'PUT', 'DELETE', 'PATCH'].includes(event.httpMethod)) {
      return createErrorResponse(405, 'Method not allowed', correlationId);
    }

    const tenantManagementService = new TenantManagementService();
    const tenantIsolationService = new TenantIsolationService();
    const tenantOnboardingService = new TenantOnboardingService();

    // Route based on path and method
    const path = event.path;
    const method = event.httpMethod;

    // Tenant CRUD operations
    if (method === 'POST' && path === '/tenants') {
      // Create a new tenant
      const validationResult = validateTenantRequest(event.body);
      if (!validationResult.success) {
        return createErrorResponse(400, 'Invalid request', correlationId, {
          errors: validationResult.errors
        });
      }

      const result = await tenantManagementService.createTenant(validationResult.data, correlationId);
      
      return {
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,PATCH,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    if (method === 'GET' && path === '/tenants') {
      // List tenants
      const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 50;
      const nextToken = event.queryStringParameters?.nextToken;
      const status = event.queryStringParameters?.status;

      const result = await tenantManagementService.listTenants({
        limit,
        nextToken,
        status
      }, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,PATCH,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    if (method === 'GET' && path.startsWith('/tenants/') && !path.includes('/config') && !path.includes('/isolation')) {
      // Get specific tenant
      const tenantId = event.pathParameters?.tenantId;
      if (!tenantId) {
        return createErrorResponse(400, 'Missing tenant ID', correlationId);
      }

      const result = await tenantManagementService.getTenant(tenantId, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,PATCH,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    if (method === 'PUT' && path.startsWith('/tenants/') && !path.includes('/config')) {
      // Update tenant
      const tenantId = event.pathParameters?.tenantId;
      if (!tenantId) {
        return createErrorResponse(400, 'Missing tenant ID', correlationId);
      }

      const validationResult = validateTenantUpdateRequest(event.body);
      if (!validationResult.success) {
        return createErrorResponse(400, 'Invalid request', correlationId, {
          errors: validationResult.errors
        });
      }

      const result = await tenantManagementService.updateTenant(tenantId, validationResult.data, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,PATCH,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    if (method === 'DELETE' && path.startsWith('/tenants/')) {
      // Delete tenant
      const tenantId = event.pathParameters?.tenantId;
      if (!tenantId) {
        return createErrorResponse(400, 'Missing tenant ID', correlationId);
      }

      const result = await tenantManagementService.deleteTenant(tenantId, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,PATCH,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    // Tenant configuration operations
    if (method === 'GET' && path.includes('/config')) {
      const tenantId = event.pathParameters?.tenantId;
      if (!tenantId) {
        return createErrorResponse(400, 'Missing tenant ID', correlationId);
      }

      const result = await tenantManagementService.getTenantConfiguration(tenantId, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,PATCH,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    if (method === 'PUT' && path.includes('/config')) {
      const tenantId = event.pathParameters?.tenantId;
      if (!tenantId) {
        return createErrorResponse(400, 'Missing tenant ID', correlationId);
      }

      const validationResult = validateTenantConfigRequest(event.body);
      if (!validationResult.success) {
        return createErrorResponse(400, 'Invalid request', correlationId, {
          errors: validationResult.errors
        });
      }

      const result = await tenantManagementService.updateTenantConfiguration(
        tenantId, 
        validationResult.data, 
        correlationId
      );
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,PATCH,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    // Tenant isolation operations
    if (method === 'GET' && path.includes('/isolation')) {
      const tenantId = event.pathParameters?.tenantId;
      if (!tenantId) {
        return createErrorResponse(400, 'Missing tenant ID', correlationId);
      }

      const result = await tenantIsolationService.getTenantIsolationStatus(tenantId, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,PATCH,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    if (method === 'POST' && path.includes('/isolation/validate')) {
      const tenantId = event.pathParameters?.tenantId;
      if (!tenantId) {
        return createErrorResponse(400, 'Missing tenant ID', correlationId);
      }

      const result = await tenantIsolationService.validateTenantIsolation(tenantId, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,PATCH,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    // Tenant onboarding operations
    if (method === 'POST' && path === '/tenants/onboard') {
      const validationResult = validateTenantRequest(event.body);
      if (!validationResult.success) {
        return createErrorResponse(400, 'Invalid request', correlationId, {
          errors: validationResult.errors
        });
      }

      const result = await tenantOnboardingService.onboardTenant(validationResult.data, correlationId);
      
      return {
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,PATCH,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    if (method === 'POST' && path.includes('/offboard')) {
      const tenantId = event.pathParameters?.tenantId;
      if (!tenantId) {
        return createErrorResponse(400, 'Missing tenant ID', correlationId);
      }

      const result = await tenantOnboardingService.offboardTenant(tenantId, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,PATCH,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    // Tenant metrics and health
    if (method === 'GET' && path.includes('/metrics')) {
      const tenantId = event.pathParameters?.tenantId;
      if (!tenantId) {
        return createErrorResponse(400, 'Missing tenant ID', correlationId);
      }

      const result = await tenantManagementService.getTenantMetrics(tenantId, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,PATCH,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          correlationId,
          result
        })
      };
    }

    if (method === 'GET' && path.includes('/health')) {
      const tenantId = event.pathParameters?.tenantId;
      if (!tenantId) {
        return createErrorResponse(400, 'Missing tenant ID', correlationId);
      }

      const result = await tenantManagementService.getTenantHealth(tenantId, correlationId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,PATCH,OPTIONS'
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
          'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,PATCH,OPTIONS'
        },
        body: ''
      };
    }

    return createErrorResponse(404, 'Not found', correlationId);

  } catch (error) {
    logger.error('Error in tenant management handler', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return handleError(error, correlationId);
  }
};
