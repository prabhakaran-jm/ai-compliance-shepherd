/**
 * Scan Environment Lambda Function
 * 
 * Performs read-only AWS posture checks using the compliance rules engine
 * and stores results in DynamoDB for reporting and analysis.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ScanEnvironmentService } from './services/ScanEnvironmentService';
import { ScanRequest, ScanResponse, ScanStatus } from '@compliance-shepherd/shared';
import { logger } from './utils/logger';
import { errorHandler } from './utils/errorHandler';
import { validateScanRequest } from './utils/validation';

/**
 * Lambda handler for scan environment requests
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  logger.info('Scan environment Lambda started', {
    requestId: context.awsRequestId,
    event: JSON.stringify(event, null, 2)
  });

  try {
    // Parse and validate request
    const scanRequest: ScanRequest = JSON.parse(event.body || '{}');
    const validationResult = validateScanRequest(scanRequest);
    
    if (!validationResult.isValid) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        body: JSON.stringify({
          error: 'Invalid request',
          details: validationResult.errors
        })
      };
    }

    // Initialize scan service
    const scanService = new ScanEnvironmentService();
    
    // Start scan
    const scanResponse = await scanService.startScan(scanRequest, context.awsRequestId);

    logger.info('Scan environment Lambda completed successfully', {
      requestId: context.awsRequestId,
      scanId: scanResponse.scanId,
      status: scanResponse.status
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify(scanResponse)
    };

  } catch (error) {
    logger.error('Scan environment Lambda failed', {
      requestId: context.awsRequestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return errorHandler(error);
  }
};

/**
 * Handler for OPTIONS requests (CORS preflight)
 */
export const optionsHandler = async (): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'POST,OPTIONS'
    },
    body: ''
  };
};
