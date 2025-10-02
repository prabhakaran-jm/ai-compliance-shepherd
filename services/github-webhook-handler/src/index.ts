import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { GitHubWebhookHandlerService } from './services/GitHubWebhookHandlerService';
import { logger } from './utils/logger';
import { createErrorResponse, handleError } from './utils/errorHandler';
import { validateWebhookPayload } from './utils/validation';

/**
 * Lambda handler for GitHub webhook events
 * Processes pull request events and provides Terraform plan analysis
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const correlationId = context.awsRequestId;
  
  logger.info('GitHub webhook handler invoked', {
    correlationId,
    httpMethod: event.httpMethod,
    path: event.path,
    headers: {
      'x-github-event': event.headers['x-github-event'],
      'x-github-delivery': event.headers['x-github-delivery'],
      'user-agent': event.headers['user-agent']
    }
  });

  try {
    // Validate HTTP method
    if (event.httpMethod !== 'POST') {
      return createErrorResponse(405, 'Method not allowed', correlationId);
    }

    // Validate webhook payload
    const validationResult = validateWebhookPayload(event);
    if (!validationResult.success) {
      logger.warn('Invalid webhook payload', {
        correlationId,
        errors: validationResult.errors
      });
      return createErrorResponse(400, 'Invalid webhook payload', correlationId);
    }

    const { payload, githubEvent, githubDelivery } = validationResult.data;

    // Initialize service
    const webhookService = new GitHubWebhookHandlerService();

    // Process webhook event
    const result = await webhookService.processWebhookEvent({
      event: githubEvent,
      delivery: githubDelivery,
      payload,
      correlationId
    });

    logger.info('Webhook processed successfully', {
      correlationId,
      event: githubEvent,
      delivery: githubDelivery,
      result: {
        processed: result.processed,
        action: result.action,
        repository: result.repository,
        pullRequest: result.pullRequest
      }
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        message: 'Webhook processed successfully',
        correlationId,
        result
      })
    };

  } catch (error) {
    logger.error('Error processing webhook', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return handleError(error, correlationId);
  }
};
