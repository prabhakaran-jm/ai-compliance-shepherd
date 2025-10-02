/**
 * Lambda handler for AWS Marketplace Integration
 * 
 * This handler processes marketplace webhooks, subscription events,
 * and entitlement notifications.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { MarketplaceWebhookService } from './services/MarketplaceWebhookService';
import { MarketplaceSubscriptionService } from './services/MarketplaceSubscriptionService';
import { MarketplaceMeteringService } from './services/MarketplaceMeteringService';
import { MarketplaceEntitlementService } from './services/MarketplaceEntitlementService';
import { MarketplaceConfig } from './types/marketplace';

// Marketplace configuration
const marketplaceConfig: MarketplaceConfig = {
  productCode: process.env.MARKETPLACE_PRODUCT_CODE || 'ai-compliance-shepherd',
  customerTable: process.env.CUSTOMER_TABLE || 'ai-compliance-customers',
  subscriptionTable: process.env.SUBSCRIPTION_TABLE || 'ai-compliance-subscriptions',
  usageTable: process.env.USAGE_TABLE || 'ai-compliance-usage',
  webhookEndpoint: process.env.WEBHOOK_ENDPOINT || '/marketplace/webhook',
  secretToken: process.env.MARKETPLACE_SECRET_TOKEN || 'default-secret',
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  dimensions: {
    scans: 'scans',
    users: 'users',
    findings: 'findings',
    storage: 'storage-gb',
    apis: 'api-calls',
    aiSessions: 'ai-sessions'
  },
  plans: [
    {
      id: 'basic',
      name: 'Basic Plan',
      description: 'Basic compliance monitoring',
      price: 99,
      currency: 'USD',
      dimensions: {},
      features: ['basic_scanning', 'standard_reports'],
      limits: {
        maxUsers: 5,
        maxScansPerMonth: 100,
        maxAWSAccounts: 1,
        includedRegions: ['us-east-1'],
        supportLevel: 'BASIC',
        slaUptime: 99.0
      },
      tier: 'BASIC'
    },
    {
      id: 'standard',
      name: 'Standard Plan',
      description: 'Advanced compliance with AI guidance',
      price: 299,
      currency: 'USD',
      dimensions: {},
      features: ['advanced_scanning', 'ai_chat', 'custom_reports'],
      limits: {
        maxUsers: 25,
        maxScansPerMonth: 500,
        maxAWSAccounts: 3,
        includedRegions: ['us-east-1', 'us-west-2'],
        supportLevel: 'STANDARD',
        slaUptime: 99.5
      },
      tier: 'STANDARD'
    },
    {
      id: 'premium',
      name: 'Premium Plan',
      description: 'Enterprise compliance automation',
      price: 799,
      currency: 'USD',
      dimensions: {},
      features: ['continuous_scanning', 'ai_automation', 'advanced_reports', 'integrations'],
      limits: {
        maxUsers: 100,
        maxScansPerMonth: 2000,
        maxAWSAccounts: 10,
        includedRegions: ['us-east-1', 'us-west-2', 'eu-west-1'],
        supportLevel: 'PREMIUM',
        slaUptime: 99.9
      },
      tier: 'PREMIUM'
    },
    {
      id: 'enterprise',
      name: 'Enterprise Plan',
      description: 'Unlimited enterprise compliance',
      price: -1, // Custom pricing
      currency: 'USD',
      dimensions: {},
      features: ['unlimited_scanning', 'ai_enterprise', 'enterprise_reports', 'all_integrations'],
      limits: {
        maxUsers: -1, // Unlimited
        maxScansPerMonth: -1, // Unlimited
        maxAWSAccounts: -1, // Unlimited
        includedRegions: [], // All regions
        supportLevel: 'ENTERPRISE',
        slaUptime: 99.99
      },
      tier: 'ENTERPRISE'
    }
  ]
};

// Initialize services
const subscriptionService = new MarketplaceSubscriptionService(marketplaceConfig);
const meteringService = new MarketplaceMeteringService(marketplaceConfig);
const entitlementService = new MarketplaceEntitlementService(marketplaceConfig);
const webhookService = new MarketplaceWebhookService(
  marketplaceConfig,
  subscriptionService,
  meteringService,
  entitlementService
);

/**
 * Main Lambda handler for marketplace webhook processing
 */
export const marketplaceWebhookHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Marketplace webhook received', {
      httpMethod: event.httpMethod,
      path: event.path,
      headers: event.headers,
      bodyLength: event.body?.length || 0
    });

    // Handle different HTTP methods
    switch (event.httpMethod) {
      case 'POST':
        return await handleWebhook(event);
      
      case 'GET':
        return await handleHealthCheck(event);
      
      default:
        return {
          statusCode: 405,
          body: JSON.stringify({ error: 'Methods not allowed' })
        };
    }

  } catch (error) {
    console.error('Marketplace webhook handler error', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Handle marketplace webhook events
 */
async function handleWebhook(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = event.body;
    if (!body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Request body is required' })
      };
    }

    const rawBody = body;
    const headers = event.headers || {};
    
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (parseError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON payload' })
      };
    }

    // Process webhook through marketplace webhook service
    const result = await webhookService.processWebhook(payload, headers, rawBody);

    return {
      statusCode: result.success ? 200 : 400,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Webhook processing error', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

/**
 * Handle health check requests
 */
async function handleHealthCheck(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Basic health check for marketplace integration
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'marketplace-integration',
      version: process.env.SERVICE_VERSION || '1.0.0',
      awsRegion: marketplaceConfig.awsRegion,
      productCode: marketplaceConfig.productCode
    };

    return {
      statusCode: 200,
      body: JSON.stringify(healthStatus)
    };

  } catch (error) {
    console.error('Health check error', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

/**
 * Lambda handler for subscription management
 */
export const subscriptionManagementHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Subscription management request', {
      httpMethod: event.httpMethod,
      path: event.path
    });

    switch (event.httpMethod) {
      case 'POST':
        return await createSubscription(event);
      
      case 'PUT':
        return await updateSubscription(event);
      
      case 'DELETE':
        return await cancelSubscription(event);
      
      case 'GET':
        return await getSubscriptions(event);
      
      default:
        return {
          statusCode: 405,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

  } catch (error) {
    console.error('Subscription management handler error', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Subscription management failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Create subscription endpoint
 */
async function createSubscription(event: APIGatewayProxyEvent): Promise<APIGateway<｜tool▁calls▁end｜>Result> {
  try {
    const body = JSON.parse(event.body || '{}');
    const subscription = await subscriptionService.createSubscription(body);

    return {
      statusCode: 201,
      body: JSON.stringify(subscription)
    };

  } catch (error) {
    console.error('Create subscription error', error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Failed to create subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

/**
 * Update subscription endpoint
 */
async function updateSubscription(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const subscriptionId = event.pathParameters?.id;
    if (!subscriptionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Subscription ID is required' })
      };
    }

    const body = JSON.parse(event.body || '{}');
    const subscription = await subscriptionService.updateSubscription({
      subscriptionId,
      ...body
    });

    return {
      statusCode: 200,
      body: JSON.stringify(subscription)
    };

  } catch (error) {
    console.error('Update subscription error', error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Failed to update subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

/**
 * Cancel subscription endpoint
 */
async function cancelSubscription(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const subscriptionId = event.pathParameters?.id;
    if (!subscriptionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Subscription ID is required' })
      };
    }

    await subscriptionService.cancelSubscription({
      subscriptionId,
      effectiveDate: new Date(),
      cancellationReason: 'API cancellation'
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Subscription cancelled successfully' })
    };

  } catch (error) {
    console.error('Cancel subscription error', error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Failed to cancel subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

/**
 * Get subscriptions endpoint
 */
async function getSubscriptions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const subscriptionId = event.pathParameters?.id;
    const customerIdentifier = event.queryStringParameters?.customerId;

    if (subscriptionId) {
      // Get single subscription
      const subscription = await subscriptionService.getSubscription(subscriptionId);
      return {
        statusCode: subscription ? 200 : 404,
        body: JSON.stringify(subscription || { error: 'Subscription not found' })
      };
    } else if (customerIdentifier) {
      // Get customer subscriptions
      const subscriptions = await subscriptionService.getCustomerSubscriptions(customerIdentifier);
      return {
        statusCode: 200,
        body: JSON.stringify(subscriptions)
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Customer ID or Subscription ID is required' })
      };
    }

  } catch (error) {
    console.error('Get subscriptions error', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to retrieve subscriptions',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

/**
 * Lambda handler for marketplace metering
 */
export const marketplaceMeteringHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Marketplace metering request', {
      httpMethod: event.httpMethod,
      path: event.path
    });

    switch (event.httpMethod) {
      case 'POST':
        return await submitMeteringData(event);
      
      case 'GET':
        return await getUsageMetrics(event);
      
      default:
        return {
          statusCode: 405,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

  } catch (error) {
    console.error('Marketplace metering handler error', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Metering processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Submit metering data endpoint
 */
async function submitMeteringData(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { subscriptionId, usageData } = body;

    if (!subscriptionId || !usageData) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Subscription ID and usage data are required' })
      };
    }

    await meteringService.trackUsage(subscriptionId, usageData);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Usage data submitted successfully' })
    };

  } catch (error) {
    console.error('Submit metering data error', error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Failed to submit metering data',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

/**
 * Get usage metrics endpoint
 */
async function getUsageMetrics(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const subscriptionId = e.pathParameters?.id;
    const startDate = event.queryStringParameters?.startDate;
    const endDate = event.queryStringParameters?.endDate;

    if (!subscriptionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Subscription ID is required' })
      };
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate ? new Date(endDate) : new Date();

    const metrics = await meteringService.getUsageMetrics(subscriptionId, start, end);

    return {
      statusCode: 200,
      body: JSON.stringify(metrics)
    };

  } catch (error) {
    console.error('Get usage metrics error', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to retrieve usage metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}
