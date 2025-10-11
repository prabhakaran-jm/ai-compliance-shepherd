/**
 * API Gateway Lambda Function
 * 
 * Provides a unified API gateway with authentication, routing,
 * and request/response handling for the AI Compliance Shepherd application.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { APIGatewayService } from './services/APIGatewayService';
import { logger } from './utils/logger';
import { errorHandler } from './utils/errorHandler';
import { extractContextFromEvent } from './utils/logger';

/**
 * Lambda handler for API Gateway requests
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestContext = extractContextFromEvent(event, context);
  logger.setContext(requestContext);

  logger.info('API Gateway Lambda started', {
    method: event.httpMethod,
    path: event.path,
    resource: event.resource,
    queryStringParameters: event.queryStringParameters,
    pathParameters: event.pathParameters,
    headers: event.headers
  });

  try {
    const apiService = new APIGatewayService();

    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return handleCorsPreflight(event);
    }

    // Route requests based on path and method
    const result = await apiService.routeRequest(event, context);

    logger.info('API Gateway Lambda completed successfully', {
      method: event.httpMethod,
      path: event.path,
      statusCode: result.statusCode
    });

    return result;

  } catch (error) {
    logger.error('API Gateway Lambda failed', {
      method: event.httpMethod,
      path: event.path,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return errorHandler(error);
  }
};

/**
 * Handle CORS preflight requests
 */
function handleCorsPreflight(event: APIGatewayProxyEvent): APIGatewayProxyResult {
  // Default allowed origins - prioritize production domains
  const defaultOrigins = [
    'https://demo.cloudaimldevops.com',
    'https://www.cloudaimldevops.com',
    'http://localhost:3001', // Keep for development
    'http://localhost:3000'  // Keep for development
  ];
  
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || defaultOrigins;
  const origin = event.headers.Origin || event.headers.origin;
  
  // Validate origin against allowed list
  let allowedOrigin = allowedOrigins[0]; // Default to first allowed origin
  
  if (allowedOrigins.includes('*')) {
    // Legacy support - log warning but allow
    console.warn('WARNING: CORS configured to allow all origins (*) - this is insecure for production');
    allowedOrigin = origin || '*';
  } else if (allowedOrigins.includes(origin)) {
    allowedOrigin = origin;
  } else if (origin) {
    // Log suspicious origins for security monitoring
    console.warn('SECURITY: Blocked CORS request from unauthorized origin', {
      origin,
      allowedOrigins,
      userAgent: event.headers['User-Agent'],
      sourceIp: event.requestContext?.identity?.sourceIp
    });
  }

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Tenant-ID',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Credentials': 'true'
    },
    body: ''
  };
}
