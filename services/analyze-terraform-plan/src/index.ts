/**
 * Terraform Plan Analyzer Lambda Function
 * 
 * Analyzes Terraform plans for compliance violations and security issues
 * before infrastructure is deployed (shift-left security).
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { TerraformPlanAnalyzerService } from './services/TerraformPlanAnalyzerService';
import { logger } from './utils/logger';
import { errorHandler } from './utils/errorHandler';
import { extractContextFromEvent } from './utils/logger';

/**
 * Lambda handler for Terraform plan analysis
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestContext = extractContextFromEvent(event, context);
  logger.setContext(requestContext);

  logger.info('Terraform Plan Analyzer Lambda started', {
    method: event.httpMethod,
    path: event.path,
    resource: event.resource,
    queryStringParameters: event.queryStringParameters,
    pathParameters: event.pathParameters,
    headers: event.headers
  });

  try {
    const analyzerService = new TerraformPlanAnalyzerService();

    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return handleCorsPreflight(event);
    }

    // Route requests based on path and method
    const result = await analyzerService.routeRequest(event, context);

    logger.info('Terraform Plan Analyzer Lambda completed successfully', {
      method: event.httpMethod,
      path: event.path,
      statusCode: result.statusCode
    });

    return result;

  } catch (error) {
    logger.error('Terraform Plan Analyzer Lambda failed', {
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
