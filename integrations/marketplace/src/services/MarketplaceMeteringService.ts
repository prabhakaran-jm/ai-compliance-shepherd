/**
 * AWS Marketplace Metering Service
 * 
 * Handles usage metering and billing data submission to AWS Marketplace,
 * including usage tracking, dimension management, and billing reports.
 */

import {
  MarketplaceUsageRecord,
  MarketplaceSubscription,
  MeteringSubmission,
  MeteringReceipt,
  MarketplaceConfig,
  MarketplaceUsageMetrics,
  MarketplaceError
} from '../types/marketplace';
import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import AWS_MarketplaceMetering from 'aws-sdk/clients/marketplacemetering';
import { logger } from './utils/logger';
import { errorHandler } from './utils/errorHandler';

export class MarketplaceMeteringService {
  private dynamoClient: DynamoDBDocumentClient;
  private marketplaceClient: AWS_MarketplaceMetering;
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

    this.marketplaceClient = new AWS_MarketplaceMetering({
      region: config.awsRegion
    });
  }

  /**
   * Track usage metrics for a subscription
   */
  async trackUsage(subscriptionId: string, usageData: Partial<MarketplaceUsageMetrics>): Promise<void> {
    try {
      logger.info('Tracking usage for subscription', {
        subscriptionId,
        usageData
      });

      // Get current subscription usage
      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      // Update usage metrics
      const updatedMetrics: MarketplaceUsageMetrics = {
        ...subscription.usageMetrics,
        ...usageData
      };

      // Update subscription record with new metrics
      await this.dynamoClient.send(new UpdateCommand({
        TableName: this.config.subscriptionTable,
        Key: { id: subscriptionId },
        UpdateExpression: 'SET usageMetrics = :usageMetrics, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':usageMetrics': updatedMetrics,
          ':updatedAt': new Date().toISOString()
        }
      }));

      // Convert usage metrics to marketplace usage records
      const usageRecords = this.convertMetricsToUsageRecords(updatedMetrics, subscription);
      
      // Submit usage to AWS Marketplace
      await this.submitUsage(subscriptionId, usageRecords);

      logger.info('Usage tracked successfully', {
        subscriptionId,
        totalRecords: usageRecords.length
      });

    } catch (error) {
      const marketplaceError = errorHandler.handleMarketplaceError(error as Error, 'TRACK_USAGE');
      logger.error('Failed to track usage', marketplaceError);
      throw marketplaceError;
    }
  }

  /**
   * Submit usage records to AWS Marketplace
   */
  async submitUsage(subscriptionId: string, usageRecords: MarketplaceUsageRecord[]): Promise<MeteringReceipt[]> {
    try {
      logger.info('Submitting usage to marketplace', {
        subscriptionId,
        recordCount: usageRecords.length
      });

      const receipts: MeteringReceipt[] = [];

      for (const record of usageRecords) {
        try {
          const submision: MeteringSubmission = {
            subscriptionId,
            usageRecords: [record],
            timestamp: new Date(),
            apiVersion: '2024-01-01'
          };

          // Submit individual usage record to AWS Marketplace
          const response = await this.marketplaceClient.batchMeterUsage({
            ProductCode: this.config.productCode,
            Marketplace: 'aws-marketplace',
            UsageRecords: [{
              Timestamp: record.timestamp,
              CustomerIdentifier: record.customerIdentifier,
              Dimension: record.dimension,
              Quantity: record.quantity
            }]
          }).promise();

          // Save receipt
          const receipt: MeteringReceipt = {
            meteringRecordId: response.Results?.[0]?.UsageRecord?.Timestamp || Date.now().toString(),
            subscriptionId,
            timestamp: new Date(),
            status: response.Results?.[0]?.Status || 'ACCEPTED'
          };

          receipts.push(receipt);

          // Save metering submission record
          await this.saveMeteringSubmission(submision, receipt);

        } catch (recordError) {
          logger.error('Failed to submit individual usage record', {
            subscriptionId,
            dimension: record.dimension,
            quantity: record.quantity,
            error: recordError
          });

          // Store failed submission for retry
          const failureReceipt: MeteringReceipt = {
            meteringRecordId: `FAILED_${Date.now()}`,
            subscriptionId,
            timestamp: new Date(),
            status: 'REJECTED'
          };
          receipts.push(failureReceipt);
        }
      }

      logger.info('Marketplace usage submission completed', {
        subscriptionId,
        successfulRecords: receipts.filter(r => r.status === 'ACCEPTED').length,
        failedRecords: receipts.filter(r => r.status === 'REJECTED').length
      });

      return receipts;

    } catch (error) {
      const marketplaceError = errorHandler.handleMarketplaceError(error as Error, 'SUBMIT_USAGE');
      logger.error('Failed to submit usage to marketplace', marketplaceError);
      throw marketplaceError;
    }
  }

  /**
   * Get usage metrics for a subscription
   */
  async getUsageMetrics(subscriptionId: string, startDate: Date, endDate: Date): Promise<MarketplaceUsageRecord[]> {
    try {
      const result = await this.dynamoClient.send(new QueryCommand({
        TableName: this.config.usageTable,
        KeyConditionExpression: 'subscriptionId = :subscriptionId AND #timestamp BETWEEN :startDate AND :endDate',
        ExpressionAttributeNames: {
          '#timestamp': 'timestamp'
        },
        ExpressionAttributeValues: {
          ':subscriptionId': subscriptionId,
          ':startDate': startDate.toISOString(),
          ':endDate': endDate.toISOString()
        }
      }));

      return result.Items as MarketplaceUsageRecord[] || [];

    } catch (error) {
      logger.error('Failed to get usage metrics', {
        subscriptionId,
        startDate,
        endDate,
        error
      });

      return [];
    }
  }

  /**
   * Calculate billing period summary
   */
  async calculateBillingSummary(subscriptionId: string, billingPeriod: Date): Promise<any> {
    try {
      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      const endDate = new Date(billingPeriod);
      const startDate = new Date(endDate.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days ago

      const usageRecords = await this.getUsageMetrics(subscriptionId, startDate, endDate);
      const includedUsage = subscription.billingTerms.includedUsage;
      const overageRates = subscription.billingTerms.overageRates;

      // Calculate usage by dimension
      const usageByDimension = usageRecords.reduce((acc, record) => {
        acc[record.dimension] = (acc[record.dimension] || 0) + record.quantity;
        return acc;
      }, {} as Record<string, number>);

      // Calculate overage charges
      const overageCharges: Record<string, number> = {};
      let totalOverage = 0;

      for (const [dimension, used] of Object.entries(usageByDimension)) {
        const included = this.getIncludedAmount(dimension, includedUsage);
        const overage = Math.max(0, used - included);
        
        if (overage > 0) {
          const rate = overageRates[dimension as keyof typeof overageRates];
          overageCharges[dimension] = overage * rate;
          totalOverage += overageCharges[dimension];
        }
      }

      return {
        subscriptionId,
        billingPeriod,
        baseCharges: subscription.plan.price,
        usageByDimension,
        includedUsage,
        overageCharges,
        totalOverage,
        totalBilling: subscription.plan.price + totalOverage,
        currency: subscription.plan.currency
      };

    } catch (error) {
      const marketplaceError = errorHandler.handleMarketplaceError(error as Error, 'CALCULATE_BILLING');
      logger.error('Failed to calculate billing summary', marketplaceError);
      throw marketplaceError;
    }
  }

  /**
   * Process metering webhook from AWS Marketplace
   */
  async processMeteringWebhook(payload: any): Promise<void> {
    try {
      logger.info('Processing marketplace metering webhook', { payload });

      const { eventType, customerIdentifier, dimension, quantity } = payload;

      switch (eventType) {
        case 'UsageReport':
          await this.handleUsageReport(customerIdentifier, dimension, quantity);
          break;
        case 'BillingEvent':
          await this.handleBillingEvent(payload);
          break;
        default:
          logger.warn('Unknown metering webhook event type', { eventType });
      }

    } catch (error) {
      const marketplaceError = errorHandler.handleMarketplaceError(error as Error, 'PROCESS_METERING_WEBHOOK');
      logger.error('Failed to process metering webhook', marketplaceError);
      throw marketplaceError;
    }
  }

  /**
   * Get subscription by ID
   */
  private async getSubscription(subscriptionId: string): Promise<MarketplaceSubscription | null> {
    try {
      const result = await this.dynamoClient.send(new QueryCommand({
        TableName: this.config.subscriptionTable,
        KeyConditionExpression: 'id = :id',
        ExpressionAttributeValues: {
          ':id': subscriptionId
        }
      }));

      return result.Items?.[0] as MarketplaceSubscription || null;

    } catch (error) {
      logger.error('Failed to get subscription', { subscriptionId, error });
      return null;
    }
  }

  /**
   * Convert usage metrics to marketplace usage records
   */
  private convertMetricsToUsageRecords(metrics: MarketplaceUsageMetrics, subscription: MarketplaceSubscription): MarketplaceUsageRecord[] {
    const records: MarketplaceUsageRecord[] = [];

    // Convert each metric to usage record format
    Object.entries(metrics).forEach(([metric, value]) => {
      if (typeof value === 'number' && value > 0) {
        const dimensionName = this.config.dimensions[metric as keyof typeof this.config.dimensions];
        if (dimensionName) {
          records.push({
            dimension: dimensionName,
            timestamp: new Date(),
            quantity: value,
            customerIdentifier: subscription.customerIdentifier
          });
        }
      }
    });

    return records;
  }

  /**
   * Save metering submission record
   */
  private async saveMeteringSubmission(submission: MeteringSubmission, receipt: MeteringReceipt): Promise<void> {
    try {
      await this.dynamoClient.send(new PutCommand({
        TableName: this.config.usageTable,
        Item: {
          id: receipt.meteringRecordId,
          submissionId: submission.subscriptionId,
          ...submission,
          receipt,
          createdAt: new Date().toISOString()
        }
      }));
    } catch (error) {
      logger.error('Failed to save metering submission', { error });
    }
  }

  /**
   * Get included amount for a dimension
   */
  private getIncludedAmount(dimension: string, includedUsage: MarketplaceUsageMetrics): number {
    const dimensionMap: Record<string, keyof MarketplaceUsageMetrics> = {
      [this.config.dimensions.scans]: 'totalScans',
      [this.config.dimensions.users]: 'totalUsers',
      [this.config.dimensions.findings]: 'totalFindings',
      [this.config.dimensions.storage]: 'storageUsedGB',
      [this.config.dimensions.apis]: 'apiCalls',
      [this.analysis.dimensions.aiSessions]: 'aiChatSessions'
    };

    const usageKey = dimensionMap[dimension];
    return usageKey ? includedUsage[usageKey] || 0 : 0;
  }

  /**
   * Handle usage report webhook
   */
  private async handleUsageReport(customerIdentifier: string, dimension: string, quantity: number): Promise<void> {
    logger.info('Handling usage report', {
      customerIdentifier,
      dimension,
      quantity
    });

    // Update customer usage metrics
    // This would integrate with the existing usage tracking system
  }

  /**
   * Handle billing event webhook
   */
  private async handleBillingEvent(payload: any): Promise<void> {
    logger.info('Handling billing event', { payload });

    // Process marketplace billing events
    // This would integrate with internal billing and accounting systems
  }
}
