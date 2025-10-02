/**
 * Tests for AWS Marketplace Integration
 */

import {
  MarketplaceSubscriptionService,
  MarketplaceMeteringService,
  MarketplaceEntitlementService,
  MarketplaceWebhookService
} from '../src/services';
import { MarketplaceConfig } from '../src/types/marketplace';

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('aws-sdk/clients/marketplacemetering');

describe('Marketplace Integration Tests', () => {
  let mockConfig: MarketplaceConfig;

  beforeEach(() => {
    mockConfig = {
      productCode: 'test-product',
      customerTable: 'test-customers',
      subscriptionTable: 'test-subscriptions',
      usageTable: 'test-usage',
      webhookEndpoint: '/test/webhook',
      secretToken: 'test-secret',
      awsRegion: 'us-east-1',
      dimensions: {
        scans: 'scans',
        users: 'users',
        findings: 'findings',
        storage: 'storage-gb',
        apis: 'api-calls',
        aiSessions: 'ai-sessions'
      },
      plans: []
    };
  });

  describe('MarketplaceSubscriptionService', () => {
    let subscriptionService: MarketplaceSubscriptionService;

    beforeEach(() => {
      subscriptionService = new MarketplaceSubscriptionService(mockConfig);
    });

    test('should create subscription successfully', async () => {
      const request = {
        customerIdentifier: 'customer-123',
        marketplaceProductCode: 'test-product',
        subscriptionPlan: 'basic',
        customerMetadata: {}
      };

      // Mock DynamoDB responses
      const mockCustomer = {
        customerIdentifier: 'customer-123',
        customerName: 'Test Customer',
        tier: 'BASIC',
        status: 'ACTIVE'
      };

      jest.spyOn(subscriptionService as any, 'getCustomer')
        .mockResolvedValue(mockCustomer);

      jest.spyOn(subscriptionService as any, 'dynamoClient', 'get')
        .mockReturnValue({
          send: jest.fn().mockResolvedValue({})
        });

      const result = await subscriptionService.createSubscription(request);

      expect(result).toBeDefined();
      expect(result.customerIdentifier).toBe('customer-123');
      expect(result.status).toBe('ACTIVE');
    });

    test('should handle subscription creation failure', async () => {
      const request = {
        customerIdentifier: 'customer-123',
        marketplaceProductCode: 'test-product',
        subscriptionPlan: 'invalid-plan'
      };

      jest.spyOn(subscriptionService as any, 'getCustomer')
        .mockResolvedValue(null);

      await expect(subscriptionService.createSubscription(request))
        .rejects.toThrow();
    });
  });

  describe('MarketplaceMeteringService', () => {
    let meteringService: MarketplaceMeteringService;

    beforeEach(() => {
      meteringService = new MarketplaceMeteringService(mockConfig);
    });

    test('should track usage successfully', async () => {
      const subscriptionId = 'sub-123';
      const usageData = {
        totalScans: 50,
        totalUsers: 10,
        totalFindings: 125
      };

      // Mock subscription exists
      jest.spyOn(meteringService as any, 'getSubscription')
        .mockResolvedValue({
          id: subscriptionId,
          customerIdentifier: 'customer-123',
          plan: { tier: 'STANDARD' },
          usageMetrics: {}
        });

      // Mock DynamoDB update
      jest.spyOn(meteringService as any, 'dynamoClient', 'get')
        .mockReturnValue({
          send: jest.fn().mockResolvedValue({})
        });

      // Mock marketplace client
      jest.spyOn(meteringService as any, 'marketplaceClient')
        .mockReturnValue({
          batchMeterUsage: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue({
              Results: [{
                Status: 'ACCEPTED',
                UsageRecord: { Timestamp: Date.now() }
              }]
            })
          })
        });

      await expect(meteringService.trackUsage(subscriptionId, usageData))
        .resolves.not.toThrow();
    });

    test('should calculate billing summary correctly', async () => {
      const subscriptionId = 'sub-123';
      const billingDate = new Date();

      // Mock subscription
      jest.spyOn(meteringService as any, 'getSubscription')
        .mockResolvedValue({
          id: subscriptionId,
          customerIdentifier: 'customer-123',
          plan: {
            price: 299,
            currency: 'USD',
            tier: 'STANDARD'
          },
          billingTerms: {
            includedUsage: {
              totalScans: 500,
              totalUsers: 25,
              totalFindings: 25000,
              storageUsedGB: 50,
              apiCalls: 50000,
              aiChatSessions: 2500,
              regionsScanned: ['us-east-1', 'us-west-2']
            },
            overageRates: {
              scans: 0.08,
              users: 0.16,
              findings: 0.008,
              storage: 0.04,
              apis: 0.008,
              aiSessions: 0.004
            }
          }
        });

      // Mock usage metrics
      jest.spyOn(meteringService as any, 'getUsageMetrics')
        .mockResolvedValue([]);

      const result = await meteringService.calculateBillingSummary(subscriptionId, billingDate);

      expect(result).toBeDefined();
      expect(result.subscriptionId).toBe(subscriptionId);
      expect(result.totalBilling).toBe(299); // Base price for unused subscription
      expect(result.currency).toBe('USD');
    });
  });

  describe('MarketplaceEntitlementService', () => {
    let entitlementService: MarketplaceEntitlementService;

    beforeEach(() => {
      entitlementService = new MarketplaceEntitlementService(mockConfig);
    });

    test('should check entitlement access correctly', async () => {
      const customerIdentifier = 'customer-123';
      const feature = 'ai:chat';

      // Mock entitlement exists
      jest.spyOn(entitlementService as any, 'getEntitlementByCustomer')
        .mockResolvedValue({
          customerIdentifier,
          status: 'ACTIVE',
          features: ['scan:advanced', 'ai:chat', 'reports:advanced']
        });

      const hasAccess = await entitlementService.hasEntitlement(customerIdentifier, feature);

      expect(hasAccess).toBe(true);
    });

    test('should deny access for inactive entitlement', async () => {
      const customerIdentifier = 'customer-123';
      const feature = 'ai:chat';

      // Mock inactive entitlement
      jest.spyOn(entitlementService as any, 'getEntitlementByCustomer')
        .mockResolvedValue({
          customerIdentifier,
          status: 'SUSPENDED',
          features: ['scan:advanced', 'ai:chat', 'reports:advanced']
        });

      const hasAccess = await entitlementService.hasEntitlement(customerIdentifier, feature);

      expect(hasAccess).toBe(false);
    });

    test('should check quota usage correctly', async () => {
      const customerIdentifier = 'customer-123';
      const quotaType = 'scans_per_month';
      const requestedQuantity = 10;

      // Mock entitlement with quotas
      jest.spyOn(entitlementService as any, 'getEntitlementByCustomer')
        .mockResolvedValue({
          customerIdentifier,
          status: 'ACTIVE',
          quotas: {
            scans_per_month: 500,
            users: 25,
            storage_gb: 50
          }
        });

      // Mock current usage
      jest.spyOn(entitlementService as any, 'getCurrentUsage')
        .mockResolvedValue(450); // Used 450 out of 500

      const quotaCheck = await entitlementService.checkQuotaUsage(
        customerIdentifier,
        quotaType,
        requestedQuantity
      );

      expect(quotaCheck.allowed).toBe(true);
      expect(quotaCheck.remaining).toBe(50); // 500 - 450
    });
  });

  describe('MarketplaceWebhookService', () => {
    let webhookService: MarketplaceWebhookService;
    let mockSubscriptionService: jest.Mocked<MarketplaceSubscriptionService>;
    let mockMeteringService: jest.Mocked<MarketplaceMeteringService>;
    let mockEntitlementService: jest.Mocked<MarketplaceEntitlementService>;

    beforeEach(() => {
      mockSubscriptionService = new MarketplaceSubscriptionService(mockConfig) as any;
      mockMeteringService = new MarketplaceMeteringService(mockConfig) as any;
      mockEntitlementService = new MarketplaceEntitlementService(mockConfig) as any;

      webhookService = new MarketplaceWebhookService(
        mockConfig,
        mockSubscriptionService,
        mockMeteringService,
        mockEntitlementService
      );
    });

    test('should verify webhook signature correctly', async () => {
      const payload = {
        Type: 'SubscriptionNotification',
        MessageId: 'test-message-id',
        Timestamp: new Date().toISOString()
      };

      const headers = {
        'x-marketplace-timestamp': Math.floor(Date.now() / 1000).toString(),
        'x-marketplace-signature': 'test-signature'
      };

      const rawBody = JSON.stringify(payload);

      // Mock crypto for signature verification
      jest.spyOn(require('crypto'), 'createHmac')
        .mockReturnValue({
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockReturnValue('test-signature')
        });

      const result = await (webhookService as any).verifyWebhook(payload, headers, rawBody);

      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
    });

    test('handle subscription notification webhook', async () => {
      const payload = {
        Type: 'SubscriptionNotification',
        Message: JSON.stringify({
          action: 'subscribe',
          customerIdentifier: 'customer-123',
          marketplaceProductCode: 'test-product',
          subscriptionIdentifier: 'sub-123',
          timestamp: new Date()
        })
      };

      // Mock signature verification
      jest.spyOn(webhookService as any, 'verifyWebhook')
        .mockResolvedValue({
          isValid: true,
          authenticity: 'VERIFIED',
          timestamp: new Date()
        });

      // Mock subscription creation
      jest.spyOn(mockSubscriptionService, 'createSubscription')
        .mockResolvedValue({
          id: 'sub-123',
          customerIdentifier: 'customer-123',
          status: 'ACTIVE'
        } as any);

      const result = await webhookService.processWebhook(payload, {}, JSON.stringify(payload));

      expect(result.success).toBe(true);
      expect(mockSubscriptionService.createSubscription).toHaveBeenCalled();
    });
  });
});
