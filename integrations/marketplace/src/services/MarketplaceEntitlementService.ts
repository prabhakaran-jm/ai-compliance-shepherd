

/**
 * AWS Marketplace Entitlement Service
 * 
 * Handles entitlement management for AWS Marketplace subscriptions,
 * including feature access control, usage limits, and authorization.
 */

 import {
   MarketplaceEntitlementEvent,
   MarketplaceSubscription,
   MarketplaceConfig,
   MarketplaceError
 } from '../types/marketplace';
 import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
 import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
 import { logger } from './utils/logger';
 import { errorHandler } from './utils/errorHandler';

export class MarketplaceEntitlementService {
  private dynamoClient: DynamoDBDocumentClient;
  private config: MarketplaceConfig;

  constructor(config: MarketplaceConfig, dynamoConfig?: DynamoDBClientConfig) {
    this.config = config;
    
    const clientConfig: DynamoDBClientConfig = {
      region: config.awsRegion,
      ...dynamoConfig
    };
    
    this.dynamoClient = DynamoDBDocumentClient.from(
      new DynamoDBClient(clientConfig)
    );
  }

  /**
   * Create entitlement for marketplace subscription
   */
  async createEntitlement(event: MarketplaceEntitlementEvent): Promise<void> {
    try {
      logger.info('Creating marketplace entitlement', {
        customerIdentifier: event.customerIdentifier,
        entitlementIdentifier: event.entitlementIdentifier
      });

      // Get subscription information
      const subscription = await this.getSubscriptionByCustomer(event.customerIdentifier);
      if (!subscription) {
        throw new Error(`No active subscription found for customer ${event.customerIdentifier}`);
      }

      // Create entitlement record
      const entitlement = {
        id: event.entitlementIdentifier,
        customerIdentifier: event.customerIdentifier,
        subscriptionId: subscription.id,
        marketplaceProductCode: event.marketplaceProductCode,
        status: 'ACTIVE',
        features: this.getFeaturesForTier(subscription.plan.tier),
        quotas: this.getQuotasForTier(subscription.plan.tier),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save entitlement to DynamoDB
      await this.dynamoClient.send(new PutCommand({
        TableName: this.config.subscriptionTable,
        Item: entitlement
      }));

      logger.info('Marketplace entitlement created successfully', {
        entitlementId: entitlement.id,
        customerIdentifier: event.customerIdentifier
      });

    } catch (error) {
      const marketplaceError = errorHandler.handleMarketplaceError(error as Error, 'CREATE_ENTITLEMENT');
      logger.error('Failed to create marketplace entitlement', marketplaceError);
      throw marketplaceError;
    }
  }

  /**
   * Update entitlement for marketplace subscription
   */
  async updateEntitlement(event: MarketplaceEntitlementEvent): Promise<void> {
    try {
      logger.info('Updating marketplace entitlement', {
        customerIdentifier: event.customerIdentifier,
        entitlementIdentifier: event.entitlementIdentifier,
        operation: event.operation
      });

      // Get existing entitlement
      const entitlement = await this.getEntitlement(event.entitlementIdentifier);
      if (!entitlement) {
        throw new Error(`Entitlement ${event.entitlementIdentifier} not found`);
      }

      // Update entitlement based on marketplace operation
      const updatedEntitlement = {
        ...entitlement,
        status: 'ACTIVE',
        updatedAt: new Date()
      };

      // Get latest subscription to update features/quotas
      const subscription = await this.getSubscriptionByCustomer(event.customerIdentifier);
      if (subscription) {
        updatedEntitlement.features = this.getFeaturesForTier(subscription.plan.tier);
        updatedEntitlement.quotas = this.getQuotasForTier(subscription.plan.tier);
      }

      // Save updated entitlement
      await this.dynamoClient.send(new PutCommand({
        TableName: this.config.subscriptionTable,
        Item: updatedEntitlement
      }));

      logger.info('Marketplace entitlement updated successfully', {
        entitlementId: updatedEntitlement.id
      });

    } catch (error) {
      const marketplaceError = errorHandler.handleMarketplaceError(error as Error, 'UPDATE_ENTITLEMENT');
      logger.error('Failed to update marketplace entitlement', marketplaceError);
      throw marketplaceError;
    }
  }

  /**
   * Cancel entitlement
   */
  async cancelEntitlement(event: MarketplaceEntitlementEvent): Promise<void> {
    try {
      logger.info('Cancelling marketplace entitlement', {
        customerIdentifier: event.customerIdentifier,
        entitlementIdentifier: event.entitlementIdentifier
      });

      // Update entitlement status to cancelled
      await this.updateEntitlementStatus(event.entitlementIdentifier, 'CANCELLED');

      logger.info('Marketplace entitlement cancelled successfully', {
        entitlementId: event.entitlementIdentifier
      });

    } catch (error) {
      const marketplaceError = errorHandler.handleMarketplaceError(error as Error, 'CANCEL_ENTITLEMENT');
      logger.error('Failed to cancel marketplace entitlement', marketplaceError);
      throw marketplaceError;
    }
  }

  /**
   * Suspend entitlement
   */
  async suspendEntitlement(event: MarketplaceEntitlementEvent): Promise<void> {
    try {
      logger.info('Suspending marketplace entitlement', {
        customerIdentifier: event.customerIdentifier,
        entitlementIdentifier: event.entitlementIdentifier
      });

      // Update entitlement status to suspended
      await this.updateEntitlementStatus(event.entitlementIdentifier, 'SUSPENDED');

      logger.info('Marketplace entitlement suspended successfully', {
        entitlementId: event.entitlementIdentifier
      });

    } catch (error) {
> const marketplaceError = errorHandler.handleMarketplaceError(error as Error, 'SUSPEND_ENTITLEMENT');
      logger.error('Failed to suspend marketplace entitlement', marketplaceError);
      throw marketplaceError;
    }
  }

  /**
   * Reinstate entitlement
   */
  async reinstateEntitlement(event: MarketplaceEntitlementEvent): Promise<void> {
    try {
      logger.info('Reinstating marketplace entitlement', {
        customerIdentifier: event.customerIdentifier,
        entitlementIdentifier: event.entitlementIdentifier
      });

      // Update entitlement status to active
      await this.updateEntitlementStatus(event.entitlementIdentifier, 'ACTIVE');

      logger.info('Marketplace entitlement reinstated successfully', {
        entitlementId: event.entitlementIdentifier
      });

    } catch (error) {
      const marketplaceError = errorHandler.handleMarketplaceError(error as Error, 'REINSTATE_ENTITLEMENT');
      logger.error('Failed to reinstate marketplace entitlement', marketplaceError);
      throw marketplaceError;
    }
  }

  /**
   * Check if customer has entitlement access
   */
  async hasEntitlement(
    customerIdentifier: string,
    feature: string
  ): Promise<boolean> {
    try {
      const entitlement = await this.getEntitlementByCustomer(customerIdentifier);
      
      if (!entitlement || entitlement.status !== 'ACTIVE') {
        return false;
      }

      return entitlement.features.includes(feature);

    } catch (error) {
      logger.error('Failed to check entitlement access', {
        customerIdentifier,
        feature,
        error
      });
      return false;
    }
  }

  /**
   * Check customer quota usage
   */
  async checkQuotaUsage(
    customerIdentifier: string,
    quotaType: string,
    requestedQuantity: number = 1
  ): Promise<{ allowed: boolean; remaining: number }> {
    try {
      const entitlement = await this.getEntitlementByCustomer(customerIdentifier);
      
      if (!entitlement || entitlement.status !== 'ACTIVE') {
        return { allowed: false, remaining: 0 };
      }

      // Get quota limits for this entitlement
      const quotaLimit = entitlement.quotas[quotaType];
      if (!quotaLimit) {
        return { allowed: false, remaining: 0 };
      }

      // Get current usage (this would integrate with actual usage tracking)
      const currentUsage = await this.getCurrentUsage(customerIdentifier, quotaType);

      const remaining = Math.max(0, quotaLimit - currentUsage);
      const allowed = remaining >= requestedQuantity;

      return { allowed, remaining };

    } catch (error) {
      logger.error('Failed to check quota usage', {
        customerIdentifier,
        quotaType,
        requestedQuantity,
        error
      });
      
      return { allowed: false, remaining: 0 };
    }
  }

  /**
   * Get entitlement for customer
   */
  async getEntitlementByCustomer(customerIdentifier: string): Promise<any | null> {
    try {
      const result = await this.dynamoClient.send(new GetCommand({
        TableName: this.config.subscriptionTable,
        Key: { customerIdentifier }
      }));

      return result.Item || null;

    } catch (error) {
      logger.error('Failed to get entitlement by customer', { customerIdentifier, error });
      return null;
    }
  }

  /**
   * Get entitlement by ID
   */
  private async getEntitlement(entitlementIdentifier: string): Promise<any | null> {
    try {
      const result = await this.dynamoClient.send(new GetCommand({
        TableName: this.config.subscriptionTable,
        Key: { id: entitlementIdentifier }
      }));

      return result.Item || null;

    } catch (error) {
      logger.error('Failed to get entitlement', { entitlementIdentifier, error });
      return null;
    }
  }

  /**
   * Get subscription by customer identifier
   */
  private async getSubscriptionByCustomer(customerIdentifier: string): Promise<MarketplaceSubscription | null> {
    try {
      // This would query the subscription table for customer-specific subscriptions
      // Implementation depends on DynamoDB table structure
      const result = await this.dynamoClient.send(new GetCommand({
        TableName: this.config.subscriptionTable,
        Key: { customerIdentifier }
      }));

      return result.Item as MarketplaceSubscription || null;

    } catch (error) {
      logger.error('Failed to get subscription by customer', { customerIdentifier, error });
      return null;
    }
  }

  /**
   * Update entitlement status
   */
  private async updateEntitlementStatus(entitlementIdentifier: string, status: string): Promise<void> {
    try {
      await this.dynamoClient.send(new UpdateCommand({
        TableName: this.config.subscriptionTable,
        Key: { id: entitlementIdentifier },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': status,
          ':updatedAt': new Date().toISOString()
        }
      }));
    } catch (error) {
      logger.error('Failed to update entitlement status', {
        entitlementIdentifier,
        status,
        error
      });
    }
  }

  /**
   * Get features available for subscription tier
   */
  private getFeaturesForTier(tier: string): string[] {
    const featureMatrix = {
      'BASIC': [
        'scan:basic',
        'findings:view',
        'reports:basic',
        'dashboard:view'
      ],
      'STANDARD': [
        'scan:advanced',
        'findings:manage',
        'reports:advanced',
        'dashboard:interactive',
        'ai:chat',
        'notifications:email'
      ],
      'PREMIUM': [
        'scan:continuous',
        'findings:automation',
        'reports:custom',
        'dashboard:advanced',
        'ai:advanced',
        'notifications:multi',
        'integrations:github',
        'integrations:slack'
      ],
      'ENTERPRISE': [
        'scan:unlimited',
        'findings:enterprise',
        'reports:enterprise',
        'dashboard:enterprise',
        'ai:enterprise',
        'notifications:enterprise',
        'integrations:all',
        'support:enterprise',
        'remediation:automated',
        'api:unlimited'
      ]
    };

    return featureMatrix[tier as keyof typeof featureMatrix] || featureMatrix.BASIC;
  }

  /**
   * Get quotas for subscription tier
   */
  private getQuotasForTier(tier: string): Record<string, number> {
    const quotaMatrix = {
      'BASIC': {
        scans_per_month: 100,
        users: 5,
        storage_gb: 10,
        api_calls_per_day: 1000,
        ai_chat_sessions_per_month: 50
      },
      'STANDARD': {
        scans_per_month: 500,
        users: 25,
        storage_gb: 50,
        api_calls_per_day: 5000,
        ai_chat_sessions_per_month: 250
      },
      'PREMIUM': {
        scans_per_month: 2000,
        users: 100,
        storage_gb: 200,
        api_calls_per_day: 20000,
        ai_chat_sessions_per_month: 1000
      },
      'ENTERPRISE': {
        scans_per_month: -1, // unlimited
        users: -1, // unlimited
        storage_gb: -1, // unlimited
        api_calls_per_day: -1, // unlimited
        ai_chat_sessions_per_month: -1 // unlimited
      }
    };

    return quotaMatrix[tier as keyof typeof quotaMatrix] || quotaMatrix.BASIC;
  }

  /**
   * Get current usage for quota type (placeholder implementation)
   */
  private async getCurrentUsage(customerIdentifier: string, quotaType: string): Promise<number> {
    // This would integrate with actual usage tracking service
    // For now, return a placeholder value
    logger.debug('Getting current usage', { customerIdentifier, quotaType });
    
    return 0; // Placeholder - would be replaced with actual usage query
  }
}
