import { APIGatewayProxyEvent, APIGatewayProxyResult, Context, ScheduledEvent } from 'aws-lambda';
import { SecretsManagementService } from './services/SecretsManagementService';
import { RotationService } from './services/RotationService';
import { logger } from './utils/logger';
import { handleError, ValidationError } from './utils/errorHandler';
import { z } from 'zod';

// Request validation schemas
const CreateSecretRequestSchema = z.object({
  secretName: z.string().min(1).max(256),
  secretValue: z.string().min(1).max(65536), // 64KB limit
  tenantId: z.string().min(1).max(100),
  description: z.string().optional(),
  rotationEnabled: z.boolean().default(false),
  rotationInterval: z.number().min(1).max(365).optional(), // days
  tags: z.record(z.string()).optional()
});

const UpdateSecretRequestSchema = z.object({
  secretValue: z.string().min(1).max(65536),
  description: z.string().optional(),
  tags: z.record(z.string()).optional()
});

const RotationConfigSchema = z.object({
  enabled: z.boolean(),
  interval: z.number().min(1).max(365), // days
  lambdaFunctionArn: z.string().optional()
});

// Initialize services
const secretsService = new SecretsManagementService();
const rotationService = new RotationService();

/**
 * Main Lambda handler for secrets management operations
 */
export const handler = async (
  event: APIGatewayProxyEvent | ScheduledEvent,
  context: Context
): Promise<APIGatewayProxyResult | void> => {
  const correlationId = context.awsRequestId;
  
  // Handle scheduled rotation events
  if ('source' in event && event.source === 'aws.events') {
    return await handleScheduledRotation(event as ScheduledEvent, correlationId);
  }

  // Handle API Gateway events
  const apiEvent = event as APIGatewayProxyEvent;
  
  logger.info('Secrets management request received', {
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
      case path === '/secrets' && method === 'POST':
        result = await handleCreateSecret(apiEvent, correlationId);
        break;
      
      case path.startsWith('/secrets/') && method === 'GET':
        result = await handleGetSecret(apiEvent, correlationId);
        break;
      
      case path.startsWith('/secrets/') && method === 'PUT':
        result = await handleUpdateSecret(apiEvent, correlationId);
        break;
      
      case path.startsWith('/secrets/') && method === 'DELETE':
        result = await handleDeleteSecret(apiEvent, correlationId);
        break;
      
      case path === '/secrets' && method === 'GET':
        result = await handleListSecrets(apiEvent, correlationId);
        break;
      
      case path.startsWith('/secrets/') && path.endsWith('/rotate') && method === 'POST':
        result = await handleRotateSecret(apiEvent, correlationId);
        break;
      
      case path.startsWith('/secrets/') && path.endsWith('/rotation-config') && method === 'PUT':
        result = await handleUpdateRotationConfig(apiEvent, correlationId);
        break;
      
      case path === '/health' && method === 'GET':
        result = await handleHealthCheck(correlationId);
        break;
      
      default:
        throw new ValidationError(`Unsupported path: ${method} ${path}`);
    }

    logger.info('Secrets management request completed successfully', {
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
 * Handle scheduled rotation events
 */
async function handleScheduledRotation(event: ScheduledEvent, correlationId: string): Promise<void> {
  logger.info('Processing scheduled rotation event', {
    correlationId,
    source: event.source,
    detailType: event['detail-type']
  });

  try {
    await rotationService.processScheduledRotations();
    
    logger.info('Scheduled rotation processing completed', { correlationId });
  } catch (error) {
    logger.error('Scheduled rotation processing failed', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Handle create secret request
 */
async function handleCreateSecret(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const body = JSON.parse(event.body || '{}');
  const validatedData = CreateSecretRequestSchema.parse(body);

  logger.info('Processing create secret request', {
    correlationId,
    secretName: validatedData.secretName,
    tenantId: validatedData.tenantId,
    rotationEnabled: validatedData.rotationEnabled
  });

  const result = await secretsService.createSecret(
    validatedData.secretName,
    validatedData.secretValue,
    validatedData.tenantId,
    {
      description: validatedData.description,
      rotationEnabled: validatedData.rotationEnabled,
      rotationInterval: validatedData.rotationInterval,
      tags: validatedData.tags
    }
  );

  return {
    secretArn: result.secretArn,
    secretName: result.secretName,
    versionId: result.versionId,
    rotationEnabled: result.rotationEnabled
  };
}

/**
 * Handle get secret request
 */
async function handleGetSecret(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const pathParts = event.path.split('/');
  const secretName = decodeURIComponent(pathParts[2]);
  const tenantId = event.queryStringParameters?.tenantId;
  const versionId = event.queryStringParameters?.versionId;
  const versionStage = event.queryStringParameters?.versionStage;

  if (!tenantId) {
    throw new ValidationError('tenantId query parameter is required');
  }

  logger.info('Processing get secret request', {
    correlationId,
    secretName,
    tenantId,
    versionId,
    versionStage
  });

  const result = await secretsService.getSecret(secretName, tenantId, {
    versionId,
    versionStage
  });

  return {
    secretValue: result.secretValue,
    versionId: result.versionId,
    versionStages: result.versionStages,
    createdDate: result.createdDate,
    lastChangedDate: result.lastChangedDate
  };
}

/**
 * Handle update secret request
 */
async function handleUpdateSecret(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const pathParts = event.path.split('/');
  const secretName = decodeURIComponent(pathParts[2]);
  const body = JSON.parse(event.body || '{}');
  const validatedData = UpdateSecretRequestSchema.parse(body);
  const tenantId = event.queryStringParameters?.tenantId;

  if (!tenantId) {
    throw new ValidationError('tenantId query parameter is required');
  }

  logger.info('Processing update secret request', {
    correlationId,
    secretName,
    tenantId
  });

  const result = await secretsService.updateSecret(
    secretName,
    validatedData.secretValue,
    tenantId,
    {
      description: validatedData.description,
      tags: validatedData.tags
    }
  );

  return {
    secretArn: result.secretArn,
    versionId: result.versionId
  };
}

/**
 * Handle delete secret request
 */
async function handleDeleteSecret(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const pathParts = event.path.split('/');
  const secretName = decodeURIComponent(pathParts[2]);
  const tenantId = event.queryStringParameters?.tenantId;
  const forceDelete = event.queryStringParameters?.forceDelete === 'true';
  const recoveryWindow = event.queryStringParameters?.recoveryWindow ? 
    parseInt(event.queryStringParameters.recoveryWindow) : undefined;

  if (!tenantId) {
    throw new ValidationError('tenantId query parameter is required');
  }

  logger.info('Processing delete secret request', {
    correlationId,
    secretName,
    tenantId,
    forceDelete,
    recoveryWindow
  });

  const result = await secretsService.deleteSecret(secretName, tenantId, {
    forceDelete,
    recoveryWindow
  });

  return {
    secretArn: result.secretArn,
    deletionDate: result.deletionDate,
    recoveryWindow: result.recoveryWindow
  };
}

/**
 * Handle list secrets request
 */
async function handleListSecrets(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const tenantId = event.queryStringParameters?.tenantId;
  const maxResults = event.queryStringParameters?.maxResults ? 
    parseInt(event.queryStringParameters.maxResults) : undefined;
  const nextToken = event.queryStringParameters?.nextToken;

  if (!tenantId) {
    throw new ValidationError('tenantId query parameter is required');
  }

  logger.info('Processing list secrets request', {
    correlationId,
    tenantId,
    maxResults,
    hasNextToken: !!nextToken
  });

  const result = await secretsService.listSecrets(tenantId, {
    maxResults,
    nextToken
  });

  return {
    secrets: result.secrets,
    nextToken: result.nextToken,
    totalCount: result.totalCount
  };
}

/**
 * Handle rotate secret request
 */
async function handleRotateSecret(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const pathParts = event.path.split('/');
  const secretName = decodeURIComponent(pathParts[2]);
  const tenantId = event.queryStringParameters?.tenantId;

  if (!tenantId) {
    throw new ValidationError('tenantId query parameter is required');
  }

  logger.info('Processing rotate secret request', {
    correlationId,
    secretName,
    tenantId
  });

  const result = await rotationService.rotateSecret(secretName, tenantId);

  return {
    secretArn: result.secretArn,
    versionId: result.versionId,
    rotationDate: result.rotationDate
  };
}

/**
 * Handle update rotation config request
 */
async function handleUpdateRotationConfig(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const pathParts = event.path.split('/');
  const secretName = decodeURIComponent(pathParts[2]);
  const body = JSON.parse(event.body || '{}');
  const validatedData = RotationConfigSchema.parse(body);
  const tenantId = event.queryStringParameters?.tenantId;

  if (!tenantId) {
    throw new ValidationError('tenantId query parameter is required');
  }

  logger.info('Processing update rotation config request', {
    correlationId,
    secretName,
    tenantId,
    enabled: validatedData.enabled,
    interval: validatedData.interval
  });

  const result = await rotationService.updateRotationConfig(
    secretName,
    tenantId,
    validatedData.enabled,
    validatedData.interval,
    validatedData.lambdaFunctionArn
  );

  return {
    secretArn: result.secretArn,
    rotationEnabled: result.rotationEnabled,
    rotationInterval: result.rotationInterval,
    nextRotationDate: result.nextRotationDate
  };
}

/**
 * Handle health check request
 */
async function handleHealthCheck(correlationId: string): Promise<any> {
  logger.info('Processing health check request', { correlationId });

  const health = await secretsService.healthCheck();

  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'secrets-management',
    version: '1.0.0',
    checks: health
  };
}
