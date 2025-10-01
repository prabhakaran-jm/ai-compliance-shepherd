/**
 * Findings Controller
 * 
 * Handles findings-related API endpoints including:
 * - GET /findings - List findings with filtering and search
 * - GET /findings/{findingId} - Get specific finding details
 * - PUT /findings/{findingId} - Update finding status
 * - POST /findings/batch - Batch operations on findings
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Lambda } from 'aws-sdk';
import { logger } from '../../utils/logger';
import { ValidationError, NotFoundError } from '../../utils/errorHandler';

export class FindingsController {
  private lambda: Lambda;

  constructor() {
    this.lambda = new Lambda({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }

  /**
   * Handle findings-related requests
   */
  async handleRequest(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    const { httpMethod, path, pathParameters, body } = event;
    const findingId = pathParameters?.findingId;

    logger.info('Findings controller request', {
      method: httpMethod,
      path,
      findingId,
      hasBody: !!body
    });

    try {
      switch (httpMethod) {
        case 'GET':
          if (findingId) {
            return await this.getFinding(event, context, findingId);
          } else if (path.endsWith('/findings')) {
            return await this.listFindings(event, context);
          }
          break;

        case 'PUT':
          if (findingId) {
            return await this.updateFinding(event, context, findingId);
          }
          break;

        case 'POST':
          if (path.endsWith('/findings/batch')) {
            return await this.batchOperations(event, context);
          }
          break;

        default:
          throw new ValidationError(`Method ${httpMethod} not supported for findings`);
      }

      throw new NotFoundError(`Findings endpoint not found: ${path}`);

    } catch (error) {
      logger.error('Findings controller error', {
        method: httpMethod,
        path,
        findingId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get specific finding details
   */
  private async getFinding(
    event: APIGatewayProxyEvent,
    context: Context,
    findingId: string
  ): Promise<APIGatewayProxyResult> {
    try {
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';

      logger.info('Getting finding details', {
        findingId,
        tenantId
      });

      // Invoke findings-storage Lambda function
      const lambdaResponse = await this.lambda.invoke({
        FunctionName: process.env.FINDINGS_STORAGE_FUNCTION_NAME || 'findings-storage',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({
          action: 'get',
          findingId,
          tenantId
        })
      }).promise();

      if (lambdaResponse.FunctionError) {
        throw new Error(`Lambda function error: ${lambdaResponse.FunctionError}`);
      }

      const result = JSON.parse(lambdaResponse.Payload as string);

      if (!result.success) {
        return {
          statusCode: 404,
          headers: this.getCorsHeaders(event),
          body: JSON.stringify({
            success: false,
            error: 'Finding not found',
            message: result.message || 'Finding not found'
          })
        };
      }

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          data: result.data
        })
      };

    } catch (error) {
      logger.error('Failed to get finding', {
        findingId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * List findings with filtering and search
   */
  private async listFindings(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    try {
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';
      const queryParams = event.queryStringParameters || {};

      logger.info('Listing findings', {
        tenantId,
        queryParams
      });

      // Prepare query parameters for Lambda
      const query = {
        action: 'list',
        tenantId,
        ...queryParams
      };

      // Invoke findings-storage Lambda function
      const lambdaResponse = await this.lambda.invoke({
        FunctionName: process.env.FINDINGS_STORAGE_FUNCTION_NAME || 'findings-storage',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(query)
      }).promise();

      if (lambdaResponse.FunctionError) {
        throw new Error(`Lambda function error: ${lambdaResponse.FunctionError}`);
      }

      const result = JSON.parse(lambdaResponse.Payload as string);

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          data: result.data
        })
      };

    } catch (error) {
      logger.error('Failed to list findings', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update finding status
   */
  private async updateFinding(
    event: APIGatewayProxyEvent,
    context: Context,
    findingId: string
  ): Promise<APIGatewayProxyResult> {
    try {
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';
      const requestBody = JSON.parse(body || '{}');

      logger.info('Updating finding', {
        findingId,
        tenantId,
        updateData: requestBody
      });

      // Validate update request
      if (!requestBody.status && !requestBody.notes && !requestBody.tags) {
        return {
          statusCode: 400,
          headers: this.getCorsHeaders(event),
          body: JSON.stringify({
            success: false,
            error: 'Validation Error',
            message: 'At least one field (status, notes, or tags) must be provided for update'
          })
        };
      }

      // Prepare update request for Lambda
      const updateRequest = {
        action: 'update',
        findingId,
        tenantId,
        updateData: requestBody,
        updatedBy: event.requestContext.authorizer?.userId || 'unknown-user',
        updatedAt: new Date().toISOString()
      };

      // Invoke findings-storage Lambda function
      const lambdaResponse = await this.lambda.invoke({
        FunctionName: process.env.FINDINGS_STORAGE_FUNCTION_NAME || 'findings-storage',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(updateRequest)
      }).promise();

      if (lambdaResponse.FunctionError) {
        throw new Error(`Lambda function error: ${lambdaResponse.FunctionError}`);
      }

      const result = JSON.parse(lambdaResponse.Payload as string);

      if (!result.success) {
        return {
          statusCode: 404,
          headers: this.getCorsHeaders(event),
          body: JSON.stringify({
            success: false,
            error: 'Update failed',
            message: result.message || 'Finding not found or update failed'
          })
        };
      }

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          data: result.data,
          message: 'Finding updated successfully'
        })
      };

    } catch (error) {
      logger.error('Failed to update finding', {
        findingId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Batch operations on findings
   */
  private async batchOperations(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    try {
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';
      const requestBody = JSON.parse(body || '{}');

      logger.info('Batch operations on findings', {
        tenantId,
        operation: requestBody.operation,
        findingIds: requestBody.findingIds?.length || 0
      });

      // Validate batch request
      if (!requestBody.operation || !requestBody.findingIds || !Array.isArray(requestBody.findingIds)) {
        return {
          statusCode: 400,
          headers: this.getCorsHeaders(event),
          body: JSON.stringify({
            success: false,
            error: 'Validation Error',
            message: 'Operation and findingIds array are required'
          })
        };
      }

      // Prepare batch request for Lambda
      const batchRequest = {
        action: 'batch',
        tenantId,
        operation: requestBody.operation,
        findingIds: requestBody.findingIds,
        operationData: requestBody.operationData || {},
        updatedBy: event.requestContext.authorizer?.userId || 'unknown-user',
        updatedAt: new Date().toISOString()
      };

      // Invoke findings-storage Lambda function
      const lambdaResponse = await this.lambda.invoke({
        FunctionName: process.env.FINDINGS_STORAGE_FUNCTION_NAME || 'findings-storage',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(batchRequest)
      }).promise();

      if (lambdaResponse.FunctionError) {
        throw new Error(`Lambda function error: ${lambdaResponse.FunctionError}`);
      }

      const result = JSON.parse(lambdaResponse.Payload as string);

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          data: result.data,
          message: `Batch operation completed: ${result.data.successCount} successful, ${result.data.failureCount} failed`
        })
      };

    } catch (error) {
      logger.error('Failed to perform batch operations', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
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
