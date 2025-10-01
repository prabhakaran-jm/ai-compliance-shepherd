/**
 * Findings Storage Lambda Function
 * 
 * Handles findings persistence and retrieval with DynamoDB.
 * Provides CRUD operations, filtering, and statistics for compliance findings.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { FindingsStorageService } from './services/FindingsStorageService';
import { logger } from './utils/logger';
import { errorHandler } from './utils/errorHandler';
import { extractContextFromEvent } from './utils/logger';

/**
 * Lambda handler for findings storage requests
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestContext = extractContextFromEvent(event, context);
  logger.setContext(requestContext);

  logger.info('Findings storage Lambda started', {
    method: event.httpMethod,
    path: event.path,
    queryStringParameters: event.queryStringParameters,
    pathParameters: event.pathParameters
  });

  try {
    const findingsService = new FindingsStorageService();

    // Route requests based on HTTP method and path
    switch (event.httpMethod) {
      case 'GET':
        return await handleGetRequest(event, findingsService);
      case 'POST':
        return await handlePostRequest(event, findingsService);
      case 'PUT':
        return await handlePutRequest(event, findingsService);
      case 'DELETE':
        return await handleDeleteRequest(event, findingsService);
      case 'OPTIONS':
        return handleOptionsRequest();
      default:
        return {
          statusCode: 405,
          headers: getCorsHeaders(),
          body: JSON.stringify({
            error: 'METHOD_NOT_ALLOWED',
            message: `Method ${event.httpMethod} not allowed`
          })
        };
    }

  } catch (error) {
    logger.error('Findings storage Lambda failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return errorHandler(error);
  }
};

/**
 * Handle GET requests
 */
async function handleGetRequest(
  event: APIGatewayProxyEvent,
  findingsService: FindingsStorageService
): Promise<APIGatewayProxyResult> {
  const { pathParameters, queryStringParameters } = event;
  const tenantId = pathParameters?.tenantId;

  if (!tenantId) {
    return {
      statusCode: 400,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        error: 'MISSING_TENANT_ID',
        message: 'Tenant ID is required'
      })
    };
  }

  // Check if requesting specific finding
  if (pathParameters?.findingId) {
    const findingId = pathParameters.findingId;
    const finding = await findingsService.getFinding(findingId, tenantId);
    
    if (!finding) {
      return {
        statusCode: 404,
        headers: getCorsHeaders(),
        body: JSON.stringify({
          error: 'FINDING_NOT_FOUND',
          message: `Finding ${findingId} not found`
        })
      };
    }

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify(finding)
    };
  }

  // List findings with filters
  const filters = parseQueryFilters(queryStringParameters || {});
  const pagination = parsePaginationParams(queryStringParameters || {});
  
  const result = await findingsService.getFindings(tenantId, filters, pagination);

  return {
    statusCode: 200,
    headers: getCorsHeaders(),
    body: JSON.stringify(result)
  };
}

/**
 * Handle POST requests
 */
async function handlePostRequest(
  event: APIGatewayProxyEvent,
  findingsService: FindingsStorageService
): Promise<APIGatewayProxyResult> {
  const { pathParameters } = event;
  const tenantId = pathParameters?.tenantId;

  if (!tenantId) {
    return {
      statusCode: 400,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        error: 'MISSING_TENANT_ID',
        message: 'Tenant ID is required'
      })
    };
  }

  // Check if creating multiple findings
  if (pathParameters?.action === 'batch') {
    const findings = JSON.parse(event.body || '[]');
    const result = await findingsService.createFindings(findings, tenantId);
    
    return {
      statusCode: 201,
      headers: getCorsHeaders(),
      body: JSON.stringify(result)
    };
  }

  // Create single finding
  const finding = JSON.parse(event.body || '{}');
  const result = await findingsService.createFinding(finding, tenantId);

  return {
    statusCode: 201,
    headers: getCorsHeaders(),
    body: JSON.stringify(result)
  };
}

/**
 * Handle PUT requests
 */
async function handlePutRequest(
  event: APIGatewayProxyEvent,
  findingsService: FindingsStorageService
): Promise<APIGatewayProxyResult> {
  const { pathParameters } = event;
  const tenantId = pathParameters?.tenantId;
  const findingId = pathParameters?.findingId;

  if (!tenantId || !findingId) {
    return {
      statusCode: 400,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        error: 'MISSING_PARAMETERS',
        message: 'Tenant ID and Finding ID are required'
      })
    };
  }

  const updates = JSON.parse(event.body || '{}');
  const result = await findingsService.updateFinding(findingId, tenantId, updates);

  return {
    statusCode: 200,
    headers: getCorsHeaders(),
    body: JSON.stringify(result)
  };
}

/**
 * Handle DELETE requests
 */
async function handleDeleteRequest(
  event: APIGatewayProxyEvent,
  findingsService: FindingsStorageService
): Promise<APIGatewayProxyResult> {
  const { pathParameters } = event;
  const tenantId = pathParameters?.tenantId;
  const findingId = pathParameters?.findingId;

  if (!tenantId || !findingId) {
    return {
      statusCode: 400,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        error: 'MISSING_PARAMETERS',
        message: 'Tenant ID and Finding ID are required'
      })
    };
  }

  await findingsService.deleteFinding(findingId, tenantId);

  return {
    statusCode: 204,
    headers: getCorsHeaders(),
    body: ''
  };
}

/**
 * Handle OPTIONS requests (CORS preflight)
 */
function handleOptionsRequest(): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: getCorsHeaders(),
    body: ''
  };
}

/**
 * Parse query filters from query string parameters
 */
function parseQueryFilters(queryParams: Record<string, string | undefined>) {
  const filters: any = {};

  if (queryParams.severity) {
    filters.severity = queryParams.severity;
  }

  if (queryParams.framework) {
    filters.framework = queryParams.framework;
  }

  if (queryParams.status) {
    filters.status = queryParams.status;
  }

  if (queryParams.service) {
    filters.service = queryParams.service;
  }

  if (queryParams.region) {
    filters.region = queryParams.region;
  }

  if (queryParams.resourceType) {
    filters.resourceType = queryParams.resourceType;
  }

  if (queryParams.accountId) {
    filters.accountId = queryParams.accountId;
  }

  if (queryParams.scanId) {
    filters.scanId = queryParams.scanId;
  }

  if (queryParams.tags) {
    filters.tags = queryParams.tags.split(',');
  }

  if (queryParams.dateFrom) {
    filters.dateFrom = queryParams.dateFrom;
  }

  if (queryParams.dateTo) {
    filters.dateTo = queryParams.dateTo;
  }

  return filters;
}

/**
 * Parse pagination parameters from query string
 */
function parsePaginationParams(queryParams: Record<string, string | undefined>) {
  return {
    limit: queryParams.limit ? parseInt(queryParams.limit, 10) : undefined,
    nextToken: queryParams.nextToken
  };
}

/**
 * Get CORS headers
 */
function getCorsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };
}
