/**
 * Scan Controller
 * 
 * Handles scan-related API endpoints including:
 * - POST /scans - Start a new scan
 * - GET /scans/{scanId} - Get scan status and results
 * - GET /scans - List scans for tenant
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Lambda } from 'aws-sdk';
import { logger } from '../../utils/logger';
import { ValidationError, NotFoundError } from '../../utils/errorHandler';
import { ScanRequestSchema } from '@compliance-shepherd/shared';

export class ScanController {
  private lambda: Lambda;

  constructor() {
    this.lambda = new Lambda({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }

  /**
   * Handle scan-related requests
   */
  async handleRequest(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    const { httpMethod, path, pathParameters, body } = event;
    const scanId = pathParameters?.scanId;

    logger.info('Scan controller request', {
      method: httpMethod,
      path,
      scanId,
      hasBody: !!body
    });

    try {
      switch (httpMethod) {
        case 'POST':
          if (path.endsWith('/scans')) {
            return await this.startScan(event, context);
          }
          break;

        case 'GET':
          if (scanId) {
            return await this.getScanStatus(event, context, scanId);
          } else if (path.endsWith('/scans')) {
            return await this.listScans(event, context);
          }
          break;

        default:
          throw new ValidationError(`Method ${httpMethod} not supported for scans`);
      }

      throw new NotFoundError(`Scan endpoint not found: ${path}`);

    } catch (error) {
      logger.error('Scan controller error', {
        method: httpMethod,
        path,
        scanId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Start a new compliance scan
   */
  private async startScan(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    try {
      // Parse and validate request body
      const requestBody = JSON.parse(body || '{}');
      const validatedRequest = ScanRequestSchema.parse(requestBody);

      // Extract tenant information from auth context
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';
      const userId = event.requestContext.authorizer?.userId || 'unknown-user';

      logger.info('Starting new scan', {
        tenantId,
        userId,
        regions: validatedRequest.regions,
        services: validatedRequest.services,
        frameworks: validatedRequest.frameworks
      });

      // Prepare scan request for Lambda
      const scanRequest = {
        ...validatedRequest,
        tenantId,
        userId,
        requestId: context.awsRequestId,
        timestamp: new Date().toISOString()
      };

      // Invoke scan-environment Lambda function
      const lambdaResponse = await this.lambda.invoke({
        FunctionName: process.env.SCAN_ENVIRONMENT_FUNCTION_NAME || 'scan-environment',
        InvocationType: 'Event', // Async invocation
        Payload: JSON.stringify(scanRequest)
      }).promise();

      if (lambdaResponse.FunctionError) {
        throw new Error(`Lambda function error: ${lambdaResponse.FunctionError}`);
      }

      // Extract scan ID from Lambda response or generate one
      const scanId = context.awsRequestId;

      logger.info('Scan started successfully', {
        scanId,
        tenantId,
        userId,
        lambdaRequestId: lambdaResponse.$response.requestId
      });

      return {
        statusCode: 202, // Accepted
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          scanId,
          status: 'started',
          message: 'Scan has been started successfully',
          estimatedDuration: this.estimateScanDuration(validatedRequest),
          statusUrl: `/scans/${scanId}`
        })
      };

    } catch (error) {
      if (error instanceof ValidationError) {
        return {
          statusCode: 400,
          headers: this.getCorsHeaders(event),
          body: JSON.stringify({
            success: false,
            error: 'Validation Error',
            message: error.message,
            details: error.details
          })
        };
      }

      throw error;
    }
  }

  /**
   * Get scan status and results
   */
  private async getScanStatus(
    event: APIGatewayProxyEvent,
    context: Context,
    scanId: string
  ): Promise<APIGatewayProxyResult> {
    try {
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';

      logger.info('Getting scan status', {
        scanId,
        tenantId
      });

      // In a real implementation, you would:
      // 1. Query DynamoDB for scan job status
      // 2. Get scan results and findings
      // 3. Return comprehensive status information

      // For now, return mock status
      const mockStatus = {
        scanId,
        tenantId,
        status: 'completed',
        startedAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
        completedAt: new Date().toISOString(),
        duration: 300000, // 5 minutes
        regions: ['us-east-1', 'us-west-2'],
        services: ['s3', 'iam', 'ec2', 'cloudtrail'],
        frameworks: ['SOC2', 'HIPAA'],
        totalResources: 45,
        findingsCount: 12,
        complianceScore: 73.3,
        findings: {
          critical: 2,
          high: 3,
          medium: 4,
          low: 3
        },
        results: {
          passed: 33,
          failed: 12,
          skipped: 0
        }
      };

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          data: mockStatus
        })
      };

    } catch (error) {
      logger.error('Failed to get scan status', {
        scanId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * List scans for tenant
   */
  private async listScans(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    try {
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';
      const queryParams = event.queryStringParameters || {};
      
      const limit = parseInt(queryParams.limit || '10');
      const offset = parseInt(queryParams.offset || '0');
      const status = queryParams.status;

      logger.info('Listing scans', {
        tenantId,
        limit,
        offset,
        status
      });

      // In a real implementation, you would:
      // 1. Query DynamoDB for scan jobs
      // 2. Apply filters and pagination
      // 3. Return paginated results

      // For now, return mock data
      const mockScans = [
        {
          scanId: 'scan-001',
          tenantId,
          status: 'completed',
          startedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          completedAt: new Date(Date.now() - 3300000).toISOString(), // 30 minutes ago
          duration: 300000,
          regions: ['us-east-1'],
          services: ['s3', 'iam'],
          frameworks: ['SOC2'],
          findingsCount: 8,
          complianceScore: 85.2
        },
        {
          scanId: 'scan-002',
          tenantId,
          status: 'running',
          startedAt: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
          completedAt: null,
          duration: null,
          regions: ['us-east-1', 'us-west-2'],
          services: ['s3', 'iam', 'ec2', 'cloudtrail'],
          frameworks: ['SOC2', 'HIPAA'],
          findingsCount: null,
          complianceScore: null
        }
      ];

      // Apply status filter if provided
      const filteredScans = status 
        ? mockScans.filter(scan => scan.status === status)
        : mockScans;

      // Apply pagination
      const paginatedScans = filteredScans.slice(offset, offset + limit);

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          data: {
            scans: paginatedScans,
            pagination: {
              limit,
              offset,
              total: filteredScans.length,
              hasMore: offset + limit < filteredScans.length
            }
          }
        })
      };

    } catch (error) {
      logger.error('Failed to list scans', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Estimate scan duration based on request parameters
   */
  private estimateScanDuration(request: any): number {
    const baseDuration = 60000; // 1 minute base
    const regionMultiplier = 30000; // 30 seconds per region
    const serviceMultiplier = 10000; // 10 seconds per service
    const frameworkMultiplier = 5000; // 5 seconds per framework

    const regions = request.regions?.length || 1;
    const services = request.services?.length || 4;
    const frameworks = request.frameworks?.length || 1;

    return baseDuration + 
           (regions * regionMultiplier) + 
           (services * serviceMultiplier) + 
           (frameworks * frameworkMultiplier);
  }

  /**
   * Get CORS headers for response
   */
  private getCorsHeaders(event: APIGatewayProxyEvent): Record<string, string> {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
    const origin = event.headers.Origin || event.headers.origin;
    const allowedOrigin = allowedOrigins.includes('*') || allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    return {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Tenant-ID',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Credentials': 'true'
    };
  }
}
