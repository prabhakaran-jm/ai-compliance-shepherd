import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { KMSEncryptionService } from './services/KMSEncryptionService';
import { logger } from './utils/logger';
import { handleError, ValidationError, EncryptionError } from './utils/errorHandler';
import { z } from 'zod';

// Request validation schemas
const EncryptRequestSchema = z.object({
  data: z.string().min(1).max(4096), // Max 4KB for Lambda payload
  tenantId: z.string().min(1).max(100),
  context: z.string().optional(),
  keyAlias: z.string().optional()
});

const DecryptRequestSchema = z.object({
  encryptedData: z.string().min(1),
  tenantId: z.string().min(1).max(100),
  context: z.string().optional()
});

const GenerateKeyRequestSchema = z.object({
  tenantId: z.string().min(1).max(100),
  keyAlias: z.string().min(1).max(256),
  keyUsage: z.enum(['ENCRYPT_DECRYPT', 'SIGN_VERIFY']).default('ENCRYPT_DECRYPT'),
  description: z.string().optional()
});

const RotateKeyRequestSchema = z.object({
  tenantId: z.string().min(1).max(100),
  keyAlias: z.string().min(1).max(256)
});

// Initialize services
const kmsService = new KMSEncryptionService();

/**
 * Main Lambda handler for KMS encryption operations
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const correlationId = context.awsRequestId;
  
  logger.info('KMS Encryption request received', {
    correlationId,
    httpMethod: event.httpMethod,
    path: event.path,
    userAgent: event.headers['User-Agent'],
    sourceIp: event.requestContext.identity.sourceIp
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
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: ''
      };
    }

    // Route requests based on path and method
    const path = event.path;
    const method = event.httpMethod;

    let result: any;

    switch (true) {
      case path === '/encrypt' && method === 'POST':
        result = await handleEncrypt(event, correlationId);
        break;
      
      case path === '/decrypt' && method === 'POST':
        result = await handleDecrypt(event, correlationId);
        break;
      
      case path === '/keys' && method === 'POST':
        result = await handleGenerateKey(event, correlationId);
        break;
      
      case path.startsWith('/keys/') && path.endsWith('/rotate') && method === 'POST':
        result = await handleRotateKey(event, correlationId);
        break;
      
      case path === '/keys' && method === 'GET':
        result = await handleListKeys(event, correlationId);
        break;
      
      case path === '/health' && method === 'GET':
        result = await handleHealthCheck(correlationId);
        break;
      
      default:
        throw new ValidationError(`Unsupported path: ${method} ${path}`);
    }

    logger.info('KMS Encryption request completed successfully', {
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
 * Handle encrypt request
 */
async function handleEncrypt(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const body = JSON.parse(event.body || '{}');
  const validatedData = EncryptRequestSchema.parse(body);

  logger.info('Processing encrypt request', {
    correlationId,
    tenantId: validatedData.tenantId,
    dataLength: validatedData.data.length,
    hasContext: !!validatedData.context
  });

  const result = await kmsService.encrypt(
    validatedData.data,
    validatedData.tenantId,
    validatedData.context,
    validatedData.keyAlias
  );

  return {
    encryptedData: result.encryptedData,
    keyId: result.keyId,
    encryptionAlgorithm: result.encryptionAlgorithm
  };
}

/**
 * Handle decrypt request
 */
async function handleDecrypt(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const body = JSON.parse(event.body || '{}');
  const validatedData = DecryptRequestSchema.parse(body);

  logger.info('Processing decrypt request', {
    correlationId,
    tenantId: validatedData.tenantId,
    hasContext: !!validatedData.context
  });

  const result = await kmsService.decrypt(
    validatedData.encryptedData,
    validatedData.tenantId,
    validatedData.context
  );

  return {
    data: result.data,
    keyId: result.keyId
  };
}

/**
 * Handle generate key request
 */
async function handleGenerateKey(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const body = JSON.parse(event.body || '{}');
  const validatedData = GenerateKeyRequestSchema.parse(body);

  logger.info('Processing generate key request', {
    correlationId,
    tenantId: validatedData.tenantId,
    keyAlias: validatedData.keyAlias,
    keyUsage: validatedData.keyUsage
  });

  const result = await kmsService.generateKey(
    validatedData.tenantId,
    validatedData.keyAlias,
    validatedData.keyUsage,
    validatedData.description
  );

  return {
    keyId: result.keyId,
    keyArn: result.keyArn,
    keyAlias: result.keyAlias,
    keyUsage: result.keyUsage,
    keyState: result.keyState
  };
}

/**
 * Handle rotate key request
 */
async function handleRotateKey(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const pathParts = event.path.split('/');
  const keyAlias = pathParts[2]; // /keys/{keyAlias}/rotate
  
  const body = JSON.parse(event.body || '{}');
  const validatedData = RotateKeyRequestSchema.parse({
    ...body,
    keyAlias
  });

  logger.info('Processing rotate key request', {
    correlationId,
    tenantId: validatedData.tenantId,
    keyAlias: validatedData.keyAlias
  });

  const result = await kmsService.rotateKey(
    validatedData.tenantId,
    validatedData.keyAlias
  );

  return {
    keyId: result.keyId,
    rotationDate: result.rotationDate,
    nextRotationDate: result.nextRotationDate
  };
}

/**
 * Handle list keys request
 */
async function handleListKeys(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const tenantId = event.queryStringParameters?.tenantId;
  
  if (!tenantId) {
    throw new ValidationError('tenantId query parameter is required');
  }

  logger.info('Processing list keys request', {
    correlationId,
    tenantId
  });

  const result = await kmsService.listKeys(tenantId);

  return {
    keys: result.keys,
    totalCount: result.totalCount
  };
}

/**
 * Handle health check request
 */
async function handleHealthCheck(correlationId: string): Promise<any> {
  logger.info('Processing health check request', { correlationId });

  const health = await kmsService.healthCheck();

  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'kms-encryption',
    version: '1.0.0',
    checks: health
  };
}
