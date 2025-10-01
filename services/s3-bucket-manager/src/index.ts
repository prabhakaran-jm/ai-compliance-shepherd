/**
 * S3 Bucket Manager Lambda Function
 * 
 * Manages S3 buckets for reports and artifacts with proper permissions,
 * lifecycle policies, and security configurations.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { S3BucketManagerService } from './services/S3BucketManagerService';
import { logger } from './utils/logger';
import { errorHandler } from './utils/errorHandler';
import { extractContextFromEvent } from './utils/logger';

/**
 * Lambda handler for S3 bucket management
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestContext = extractContextFromEvent(event, context);
  logger.setContext(requestContext);

  logger.info('S3 Bucket Manager Lambda started', {
    method: event.httpMethod,
    path: event.path,
    resource: event.resource,
    queryStringParameters: event.queryStringParameters,
    pathParameters: event.pathParameters,
    headers: event.headers
  });

  try {
    const bucketService = new S3BucketManagerService();

    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return handleCorsPreflight(event);
    }

    // Route requests based on path and method
    const result = await bucketService.routeRequest(event, context);

    logger.info('S3 Bucket Manager Lambda completed successfully', {
      method: event.httpMethod,
      path: event.path,
      statusCode: result.statusCode
    });

    return result;

  } catch (error) {
    logger.error('S3 Bucket Manager Lambda failed', {
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
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
  const origin = event.headers.Origin || event.headers.origin;
  const allowedOrigin = allowedOrigins.includes('*') || allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

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
