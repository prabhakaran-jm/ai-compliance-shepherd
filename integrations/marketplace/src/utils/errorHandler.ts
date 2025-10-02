/**
 * Error Handler utility for AWS Marketplace Integration
 */

import { MarketplaceError } from '../types/marketplace';

export const errorHandler = {
  handleMarketplaceError: (error: Error, operation: string): MarketplaceError => {
    const errorCode = `MARKETPLACE_${operation}_ERROR`;
    const errorMessage = error.message || 'Unknown marketplace operation error';

    return {
      errorType: 'VALIDATION_ERROR',
      errorCode,
      errorMessage,
      timestamp: new Date()
    };
  },

  handleSubscriptionError: (error: Error, subscriptionId: string): MarketplaceError => {
    return {
      errorType: 'SUBSCRIPTION_ERROR',
      errorCode: 'SUBSCRIPTION_OPERATION_FAILED',
      errorMessage: error.message || 'Subscription operation failed',
      timestamp: new Date(),
      subscriptionId
    };
  },

  handleMeteringError: (error: Error, customerIdentifier: string): MarketplaceError => {
    return {
      errorType: 'METERING_ERROR',
      errorCode: 'USAGE_METERING_FAILED',
      errorMessage: error.message || 'Usage metering failed',
      timestamp: new Date(),
      customerIdentifier
    };
  },

  handleEntitlementError: (error: Error, entitlementId: string): MarketplaceError => {
    return {
      errorType: 'ENTITLEMENT_ERROR',
      errorCode: 'ENTITLEMENT_OPERATION_FAILED',
      errorMessage: error.message || 'Entitlement operation failed',
      timestamp: new Date()
    };
  }
};
