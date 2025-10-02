/**
 * AWS Marketplace Subscription Service
 * 
 * Handles subscription lifecycle management including create, update,
 * cancel, and status tracking for AWS Marketplace integrations.
 */

import { 
  MarketplaceSubscription,
  MarketplaceCustomer,
  SubscriptionCreationRequest,
  SubscriptionUpdateRequest,
  SubscriptionCancelRequest,
  MarketplaceSubscriptionPlan,
  MarketplaceConfig,
  MarketplaceError
} from '../types/marketplace';
import { Tenant } from '@ai-compliance-shepherd/shared-types';
import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from './utils/logger';
import { errorHandler } from './utils/errorHandler';

export class MarketplaceSubscriptionService {
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
   * Create a new subscription for a customer
   */
  async createSubscription(request: SubscriptionCreationRequest): Promise<MarketplaceSubscription> {
    try {
      logger.info('Creating new marketplace subscription', {
        customerIdentifier: request.customerIdentifier,
        productCode: request.marketplaceProductCode,
        plan: request.subscriptionPlan
      });

      // Validate customer exists
      const customer = await this.getCustomer(request.customerIdentifier);
      if (!customer) {
        throw new Error(`Customer ${request.customerIdentifier} not found`);
      }

      // Get subscription plan details
      const plan = this.config.plans.find<p => p.id === request.subscriptionPlan);
      if (!plan) {
        throw new Error(`Subscription plan ${request.subscriptionPlan} not found`);
      }

      // Create subscription record
      const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const subscription: MarketplaceSubscription = {
        id: subscriptionId,
        customerIdentifier: request.customerIdentifier,
        marketplaceProductCode: request.marketplaceProductCode,
        plan,
        status: 'ACTIVE',
        startDate: new Date(),
        usageMetrics: {
          totalScans: 0,
          totalUsers: 0,
          totalFindings: 0,
          storageUsedGB: 0,
          apiCalls: 0,
          aiChatSessions: 0,
          regionsScanned: []
        },
        billingTerms: {
          billingPeriod: 'MONTHLY',
          usageType: plan.tier === 'ENTERPRISE' ? 'FLAT_FEE' : 'DIMENSION_BASED',
          dimensions: request.initialDimensions || {},
          includedUsage: this.calculateIncludedUsage(plan),
          overageRates: this.calculateOverageRates(plan)
        }
      };

      // Save subscription to DynamoDB
      await this.dynamoClient.send(new PutCommand({
        TableName: this.config.subscriptionTable,
        Item: subscription
      }));

      // Update customer status
      await this.updateCustomerSubscriptionStatus(request.customerIdentifier, subscriptionId, 'ACTIVE');

      // Provision tenant infrastructure
      await this.provisionTenantInfrastructure(subscription);

      logger.info('Marketplace subscription created successfully', {
        subscriptionId,
        customerIdentifier: request.customerIdentifier,
        tier: plan.tier
      });

      return subscription;

    } catch (error) {
      const marketplaceError = errorHandler.handleMarketplaceError(error as Error, 'CREATE_SUBSCRIPTION');
      logger.error('Failed to create marketplace subscription', marketplaceError);
      throw marketplaceError;
    }
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(request: SubscriptionUpdateRequest): Promise<MarketplaceSubscription> {
    try {
      logger.info('Updating marketplace subscription', {
        subscriptionId: request.subscriptionId,
        updates: {
          newPlan: request.newPlan,
          dimensionUpdates: request.dimensionUpdates,
          status: request.status
        }
      });

      // Get existing subscription
      const subscription = await this.getSubscription(request.subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription ${request.subscriptionId} not found`);
      }

      // Update subscription fields
      if (request.newPlan) {
        const newPlan = this.config.plans.find(plan => plan.id === request.newPlan);
        if (!newPlan) {
          throw new Error(`Subscription plan ${request.newPlan} not found`);
        }
        subscription.plan = newPlan;
        subscription.billingTerms.includedUsage = this.calculateIncludedUsage(newPlan);
        subscription.billingTerms.overageRates = this.calculateOverageRates(newPlan);
      }

      if (request.dimensionUpdates) {
        Object.assign(subscription.billingTerms.dimensions, request.dimensionUpdates);
      }

      if (request.status) {
        subscription.status = request.status;
      }

      // Save updated subscription
      await this.dynamoClient.send(new PutCommand({
        TableName: this.config.subscriptionTable,
        Item: subscription
      }));

      // Update tenant configuration if needed
      if (request.newPlan || request.dimensionUpdates) {
        await this.updateTenantConfiguration(subscription);
      }

      logger.info('Marketplace subscription updated successfully', {
        subscriptionId: request.subscriptionId
      });

      return subscription;

    } catch (error) {
      const marketplaceError = errorHandler.handleMarketplaceError(error as Error, 'UPDATE_SUBSCRIPTION');
      logger.error('Failed to update marketplace subscription', marketplaceError);
      throw marketplaceError;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(request: SubscriptionCancelRequest): Promise<void> {
    try {
      logger.info('Cancelling marketplace subscription', {
        subscriptionId: request.subscriptionId,
        cancellationReason: request.cancellationReason,
        effectiveDate: request.effectiveDate
      });

      // Get subscription
      const subscription = await this.getSubscription(request.subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription ${request.subscriptionId} not found`);
      }

      // Update subscription status
      subscription.status = 'CANCELLED';
      subscription.endDate = request.effectiveDate;

      // Save updated subscription
      await this.dynamoClient.send(new PutCommand({
        TableName: this.config.subscriptionTable,
        Item: subscription
      }));

      // Update customer status
      await this.updateCustomerSubscriptionStatus(subscription.customerIdentifier, undefined, 'CANCELLED');

      // Schedule tenant deprovisioning (if immediate cancellation)
      if (request.effectiveDate <= new Date()) {
        await this.scheduleTenantDeprovisioning(subscription);
      }

      logger.info('Marketplace subscription cancelled successfully', {
        subscriptionId: request.subscriptionId
      });

    } catch (error) {
      const marketplaceError = errorHandler.handleMarketplaceError(error as Error, 'CANCEL_SUBSCRIPTION');
      logger.error('Failed to cancel marketplace subscription', marketplaceError);
      throw marketplaceError;
    }
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<MarketplaceSubscription | null> {
    try {
      const result = await this.dynamoClient.send(new GetCommand({
        TableName: this.config.subscriptionTable,
        Key: { id: subscriptionId }
      }));

      return result.Item as MarketplaceSubscription || null;

    } catch (error) {
      logger.error('Failed to get marketplace subscription', { subscriptionId, error });
      return null;
    }
  }

  /**
   * Get all subscriptions for a customer
   */
  async getCustomerSubscriptions(customerIdentifier: string): Promise<MarketplaceSubscription[]> {
    try {
      const result = await this.dynamoClient.send(new QueryCommand({
        TableName: this.config.subscriptionTable,
        IndexName: 'CustomerSubscriptionsIndex',
        KeyConditionExpression: 'customerIdentifier = :customerId',
        ExpressionAttributeValues: {
          ':customerId': customerIdentifier
        }
      }));

      return result.Items as MarketplaceSubscription[] || [];

    } catch (error) {
      logger.error('Failed to get customer subscriptions', { customerIdentifier, error });

      return [];
    }
  }

  /**
   * Get customer by identifier
   */
  private async getCustomer(customerIdentifier: string): Promise<MarketplaceCustomer | null> {
    try {
      const result = await this.dynamoClient.send(new GetCommand({
        TableName: this.config.customerTable,
        Key: { customerIdentifier }
      }));

      return result.Item as MarketplaceCustomer || null;

    } catch (error) {
      logger.error('Failed to get marketplace customer', { customerIdentifier, error });
      return null;
    }
  }

  /**
   * Update customer subscription status
   */
  private async updateCustomerSubscriptionStatus(
    customerIdentifier: string,
    subscriptionId: string | undefined,
    status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'
  ): Promise<void> {
    try {
      await this.dynamoClient.send(new UpdateCommand({
        TableName: this.config.customerTable,
        Key: { customerIdentifier },
        UpdateExpression: 'SET subscriptionId = :subscriptionId, status = :status, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':subscriptionId': subscriptionId,
          ':status': status,
          ':updatedAt': new Date().toISOString()
        }
      }));
    } catch (error) {
      logger.error('Failed to update customer subscription status', {
        customerIdentifier,
        subscriptionId,
        status,
        error
      });
    }
  }

  /**
   * Calculate included usage for subscription plan
   */
  private calculateIncludedUsage(plan: MarketplaceSubscriptionPlan) {
    const baseUsage = {
      totalScans: plan.limits.maxScansPerMonth,
      totalUsers: plan.limits.maxUsers,
      totalFindings: plan.limits.maxScansPerMonth * 50, // Estimate 50 findings per scan
      storageUsedGB: 10, // Base storage allowance
      apiCalls: plan.limits.maxScansPerMonth * 100, // Estimate API calls per scan
      aiChatSessions: plan.tier === 'ENTERPRISE' ? 1000 : plan.limits.maxUsers * 10,
      regionsScanned: plan.limits.includedRegions
    };

    // Scale based on tier
    const multiplier = {
      'BASIC': 1,
      'STANDARD': 2,
      'PREMIUM': 5,
      'ENTERPRISE': 10
    }[plan.tier];

    return {
      totalScans: baseUsage.totalScans * multiplier,
      totalUsers: baseUsage.totalUsers * multiplier,
      totalFindings: baseUsage.totalFindings * multiplier,
      storageUsedGB: baseUsage.storageUsedGB * multiplier,
      apiCalls: baseUsage.apiCalls * multiplier,
      aiChatSessions: baseUsage.aiChatSessions * multiplier,
      regionsScanned: baseUsage.regionsScanned
    };
  }

  /**
   * Calculate overage rates for subscription plan
   */
  private calculateOverageRates(plan: MarketplaceSubscriptionPlan) {
    const baseRate = 0.10; // $0.10 base rate per unit
    
    const rates = {
      'BASIC': baseRate,
      'STANDARD': baseRate * 0.8,
      'PREMIUM': baseRate * 0.6,
      'ENTERPRISE': baseRate * 0.4
    };

    const tierRate = rates[plan.tier];

    return {
      scans: tierRate,
      users: tierRate * 2,
      findings: tierRate * 0.1,
      storage: tierRate * 0.5,
      apis: tierRate * 0.01,
      aiSessions: tierRate * 0.05
    };
  }

  /**
   * Provision tenant infrastructure for new subscription
   */
  private async provisionTenantInfrastructure(subscription: MarketplaceSubscription): Promise<void> {
    // This would integrate with the tenant management service
    // to provision appropriate infrastructure based on subscription tier
    
    logger.info('Provisioning tenant infrastructure', {
      subscriptionId: subscription.id,
      tier: subscription.plan.tier,
      customerIdentifier: subscription.customerIdentifier
    });

    // TODO: Integrate with TenantManagementService for infrastructure provisioning
    // This is a placeholder for the actual tenant provisioning logic
  }

  /**
   * Update tenant configuration when subscription changes
   */
  private async updateTenantConfiguration(subscription: MarketplaceSubscription): Promise<void> {
    logger.info('Updating tenant configuration', {
      subscriptionId: subscription.id,
      newPlan: subscription.plan.id
    });

    // TODO: Integrate with TenantManagementService for configuration updates
    // This is a placeholder for the actual tenant configuration update logic
  }

  /**
 there * Schedule tenant deprovisioning
   */
  private async scheduleTenantDeprovisioning(subscription: MarketplaceSubscription): Promise<void> {
    logger.info('Scheduling tenant deprovisioning', {
      subscriptionId: subscription.id,
      customerIdentifier: subscription.customerIdentifier
    });

    // TODO: Integrate with TenantManagementService for tenant cleanup
    // This is a placeholder for the actual tenant deprovisioning logic
  }
}
