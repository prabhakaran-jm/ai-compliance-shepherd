/**
 * AWS Marketplace Webhook Service
 * 
 * Handles incoming webhooks from AWS Marketplace for subscription,
 * entitlement, and metering events.
 */

import {
  MarketplaceSubscriptionEvent,
  MarketplaceEntitlementEvent,
  MarketplaceUsageEvent,
  MarketplaceWebhookPayload,
  WebhookVerificationResult,
  MarketplaceConfig,
  MarketplaceError
} from '../types/marketplace';
import { MarketplaceSubscriptionService } from './MarketplaceSubscriptionService';
import { MarketplaceMeteringService } from './MarketplaceMeteringService';
import { MarketplaceEntitlementService } from './MarketplaceEntitlementService';
import crypto from 'crypto';
import { logger } from './utils/logger';
import { errorHandler } from './utils/errorHandler';

export class MarketplaceWebhookService {
  private subscriptionService: MarketplaceSubscriptionService;
  private meteringService: MarketplaceMeteringService;
  private entitlementService: MarketplaceEntitlementService;
  private config: MarketplaceConfig;

  constructor(
    config: MarketplaceConfig,
    subscriptionService: MarketplaceSubscriptionService,
    meteringService: MarketplaceMeteringService,
    entitlementService: MarketplaceEntitlementService
  ) {
    this.config = config;
    this.subscriptionService = subscriptionService;
    this.meteringService = meteringService;
    this.entitlementService = entitlementService;
  }

  /**
   * Process incoming AWS Marketplace webhook
   */
  async processWebhook(
    payload: any,
    headers: Record<string, string>,
    rawBody: string
  ): Promise<any> {
    try {
      logger.info('Processing marketplace webhook', {
        headers: this.sanitizeHeaders(headers),
        payloadType: payload.Type || 'Unknown'
      });

      // Verify webhook authenticity
      const verification = await this.verifyWebhook(payload, headers, rawBody);
      if (!verification.isValid) {
        logger.warn('Invalid webhook signature', verification);
        return { success: false, error: 'INVALID_SIGNATURE' };
      }

      // Parse marketplace webhook message
      const marketplacePayload = this.parseMarketplacePayload(payload);

      // Route to appropriate handler based on message type
      switch (marketplacePayload.Type) {
        case 'Notification':
          return await this.handleNotification(marketplacePayload);
        
        case 'SubscriptionNotification':
          return await this.handleSubscriptionNotification(marketplacePayload);
        
        case 'EntitlementNotification':
          return await this.handleEntitlementNotification(marketplacePayload);
        
        default:
          logger.warn('Unknown marketplace webhook type', { type: marketplacePayload.Type });
          return { success: false, error: 'UNKNOWN_WEBHOOK_TYPE' };
      }

    } catch (error) {
      const marketplaceError = errorHandler.handleMarketplaceError(error as Error, 'PROCESS_WEBHOOK');
      logger.error('Failed to process marketplace webhook', marketplaceError);
      
      return {
        success: false,
        error: marketplaceError.errorCode,
        message: marketplaceError.errorMessage
      };
    }
  }

  /**
   * Handle subscription notification webhooks
   */
  private async handleSubscriptionNotification(payload: MarketplaceWebhookPayload): Promise<any> {
    try {
      const message = JSON.parse(payload.Message);
      
      logger.info('Processing subscription notification', {
        customerIdentifier: message.customerIdentifier,
        action: message.action,
        actionType: message.actionType
      });

      switch (message.action) {
        case 'subscribe':
          return await this.handleSubscriptionSubscribe(message);
        
        case 'unsubscribe':
          return await this.handleSubscriptionUnsubscribe(message);
        
        case 'change-seat-quantity':
          return await this.handleSubscriptionQuantityChange(message);
        
        default:
          logger.warn('Unknown subscription action', { action: message.action });
          return { success: false, error: 'UNKNOWN_SUBSCRIPTION_ACTION' };
      }

    } catch (error) {
      logger.error('Failed to handle subscription notification', { error });
      throw error;
    }
  }

  /**
   * Handle entitlement notification webhooks
   */
  private async handleEntitlementNotification(payload: MarketplaceWebhookPayload): Promise<any> {
    try {
      const message = JSON.parse(payload.Message);
      
      logger.info('Processing entitlement notification', {
        customerIdentifier: message.customerIdentifier,
        operation: message.operation
      });

      switch (message.operation) {
        case 'Create':
          return await this.handleEntitlementCreate(message);
        
        case 'Update':
          return await this.handleEntitlementUpdate(message);
        
        case 'Cancel':
          return await this.handleEntitlementCancel(message);
        
        case 'Suspend':
          return await this.handleEntitlementSuspend(message);
        
        case 'Reinstate':
          return await this.handleEntitlementReinstate(message);
        
        default:
          logger.warn('Unknown entitlement operation', { operation: message.operation });
          return { success: false, error: 'UNKNOWN_ENTITLEMENT_OPERATION' };
      }

    } catch (error) {
      logger.error('Failed to handle entitlement notification', { error });
      throw error;
    }
  }

  /**
   * Handle general notification webhooks
   */
  private async handleNotification(payload: MarketplaceWebhookPayload): Promise<any> {
    try {
      const message = JSON.parse(payload.Message);
      
      logger.info('Processing general notification', {
        messageType: message.notificationType || 'Unknown',
        subject: payload.Subject
      });

      // Handle usage reports, billing events, etc.
      if (message.notificationType === 'UsageReport') {
        return await this.handleUsageReport(message);
      }

      if (message.notificationType === 'BillingEvent') {
        return await this.handleBillingEvent(message);
      }

      return { success: true, message: 'NOTIFICATION_PROCESSED' };

    } catch (error) {
      logger.error('Failed to handle notification', { error });
      throw error;
    }
  }

  /**
   * Handle subscription subscribe event
   */
  private async handleSubscriptionSubscribe(event: MarketplaceSubscriptionEvent): Promise<any> {
    logger.info('Handling subscription subscribe', {
      customerIdentifier: event.customerIdentifier,
      marketplaceProductCode: event.marketplaceProductCode
    });

    // Create new subscription for customer
    const subscriptionCreated = await this.subscriptionService.createSubscription({
      customerIdentifier: event.customerIdentifier,
      marketplaceProductCode: event.marketplaceProductCode,
      subscriptionPlan: 'STANDARD', // Default plan, should be determined from marketplace data
      customerMetadata: {
        marketplaceCustomerId: event.marketplaceCustomerId,
        subscriptionIdentifier: event.subscriptionIdentifier
      }
    });

    return {
      success: true,
      subscriptionId: subscriptionCreated.id,
      message: 'SUBSCRIPTION_CREATED'
    };
  }

  /**
   * Handle subscription unsubscribe event
   */
  private async handleSubscriptionUnsubscribe(event: MarketplaceSubscriptionEvent): Promise<any> {
    logger.info('Handling subscription unsubscribe', {
      customerIdentifier: event.customerIdentifier,
      subscriptionIdentifier: event.subscriptionIdentifier
    });

    // Cancel subscription
    await this.subscriptionService.cancelSubscription({
      subscriptionId: event.subscriptionIdentifier,
      cancellationReason: 'Marketplace unsubscribe',
      effectiveDate: event.timestamp
    });

    return {
      success: true,
      message: 'SUBSCRIPTION_CANCELLED'
    };
  }

  /**
   * Handle subscription quantity change event
   */
  private async handleSubscriptionQuantityChange(event: MarketplaceSubscriptionEvent): Promise<any> {
    logger.info('Handling subscription quantity change', {
      customerIdentifier: event.customerIdentifier,
      subscriptionIdentifier: event.subscriptionIdentifier
    });

    // Update subscription based on quantity change
    // This would typically involve updating dimension usage limits
    // Implementation would depend on specific marketplace dimension structure

    return {
      success: true,
      message: 'SUBSCRIPTION_QUANTITY_UPDATED'
    };
  }

  /**
   * Handle entitlement create event
   */
  private async handleEntitlementCreate(event: MarketplaceEntitlementEvent): Promise<any> {
    logger.info('Handling entitlement create', {
      customerIdentifier: event.customerIdentifier,
      entitlementIdentifier: event.entitlementIdentifier
    });

    // Process entitlement creation
    await this.entitlementService.createEntitlement(event);

    return {
      success: true,
      entitlementId: event.entitlementIdentifier,
      message: 'ENTITLEMENT_CREATED'
    };
  }

  /**
   * Handle entitlement update event
   */
  private async handleEntitleEvent(event: MarketplaceEntitlementEvent): Promise<any> {
    logger.info('Handling entitlement update', {
      customerIdentifier: event.customerIdentifier,
      entitlementIdentifier: event.entitlementIdentifier
    });

    // Process entitlement update
    await this.entitlementService.updateEntitlement(event);

    return {
      success: true,
      message: 'ENTITLEMENT_UPDATED'
    };
  }

  /**
   * Handle entitlement cancel event
   */
  private async handleEntitlementCancel(event: MarketplaceEntitlementEvent): Promise<any> {
    logger.info('Handling entitlement cancel', {
      customerIdentifier: event.customerIdentifier,
      entitlementIdentifier: event.entitlementIdentifier
    });

    // Process entitlement cancellation
    await this.entitlementService.cancelEntitlement(event);

    retourn {
      success: true,
      message: 'ENTITLEMENT_CANCELLED'
    };
  }

  /**
   * Handle entitlement suspend event
   */
  private async handleEntitlementSuspend(event: MarketplaceEntitlementEvent): Promise<any> {
    logger.info('Handling entitlement suspend', {
      customerIdentifier: event.customerIdentifier,
      entitlementIdentifier: event.entitlementIdentifier
    });

    // Process entitlement suspension
    await this.entitlementService.suspendEntitlement(event);

    return {
      success: true,
      message: 'ENTITLEMENT_SUSPENDED'
    };
  }

  /**
   * Handle entitlement reinstate event
   */
  private async handleEntitlementReinstate(event: MarketplaceEntitlementEvent): Promise<any> {
    logger.info('Handling entitlement reinstate', {
      customerIdentifier: event.customerIdentifier,
      entitlementIdentifier: event.entitlementIdentifier
    });

    // Process entitlement reinstatement
    await this.entitlementService.reinstateEntitlement(event);

    return {
      success: true,
      message: 'ENTITLEMENT_REINSTATED'
    };
  }

  /**
   * Handle usage report event
   */
  private async handleUsageReport(message: any): Promise<any> {
    logger.info('Handling usage report', message);

    // Submit usage data to metering service
    await this.meteringService.processMeteringWebhook(message);

    return {
      success: true,
      message: 'USAGE_REPORT_PROCESSED'
    };
  }

  /**
   * Handle billing event
   */
  private async handleBillingEvent(message: any): Promise<any> {
    logger.info('Handling billing event', message);

    // Process billing-related events
    // This would integrate with internal billing and accounting systems

    return {
      success: true,
      message: 'BILLING_EVENT_PROCESSED'
    };
  }

  /**
   * Verify webhook authenticity using signature validation
   */
  private async verifyWebhook(
    payload: MarketplaceWebhookPayload,
    headers: Record<string, string>,
    rawBody: string
  ): Promise<WebhookVerificationResult> {
    try {
      // Validate timestamp (prevent replay attacks)
      const timestamp = parseInt(headers['x-marketplace-timestamp'] || '0');
      const currentTime = Math.floor(Date.now() / 1000);
      const toleranceSeconds = 300; // 5 minutes

      if (Math.abs(currentTime - timestamp) > toleranceSeconds) {
        return {
          isValid: false,
          authenticity: 'INVALID_TIMESTAMP',
          timestamp: new Date(timestamp * 1000)
        };
      }

      // Validate signature if present
      const signature = headers['x-marketplace-signature'];
      if (!signature) {
        return {
          isValid: false,
          authenticity: 'MISSING_SIGNATURE',
          timestamp: new Date()
        };
      }

      // Verify signature using marketplace signing key
      const expectedSignature = crypto
        .createHmac('sha256', this.config.secretToken)
        .update(rawBody)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      return {
        isValid,
        authenticity: isValid ? 'VERIFIED' : 'INVALID',
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('Failed to verify webhook signature', { error });
      return {
        isValid: false,
        authenticity: 'VERIFICATION_ERROR',
        timestamp: new Date()
      };
    }
  }

  /**
   * Parse marketplace webhook payload
   */
  private parseMarketplacePayload(payload: any): MarketplaceWebhookPayload {
    return payload as MarketplaceWebhookPayload;
  }

  /**
   * Sanitize headers for logging (remove sensitive information)
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    delete sanitized['x-marketplace-signature'];
    delete sanitized['authorization'];
    return sanitized;
  }
}
