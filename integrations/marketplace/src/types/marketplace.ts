/**
 * AWS Marketplace Integration Types
 * 
 * These types define the interface for AWS Marketplace SaaS integration,
 * including subscription management, entitlement tracking, and metering.
 */

export interface MarketplaceDimensions {
  [dimension: string]: string;
}

export interface MarketplaceUsageRecord {
  dimension: string;
  timestamp: Date;
  quantity: number;
  customerIdentifier?: string;
}

export interface MarketplaceSubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  dimensions: MarketplaceDimensions;
  features: string[];
  limits: MarketplaceLimitations;
  tier: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
}

export interface MarketplaceLimitations {
  maxUsers: number;
  maxScansPerMonth: number;
  maxAWSAccounts: number;
  includedRegions: string[];
  supportLevel: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
  slaUptime: number;
}

export interface MarketplaceCustomer {
  customerIdentifier: string;
  customerAWSAccountId: string;
  customerEmail: string;
  customerName: string;
  registrationDate: Date;
  subscriptionId?: string;
  tier: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
}

export interface MarketplaceSubscription {
  id: string;
  customerIdentifier: string;
  marketplaceProductCode: string;
  subscriptionId?: string;
  plan: MarketplaceSubscriptionPlan;
  status: 'ACTIVE' | 'PENDING' | 'CANCELLED' | 'EXPIRED';
  startDate: Date;
  endDate?: Date;
  usageMetrics: MarketplaceUsageMetrics;
  billingTerms: MarketplaceBillingTerms;
}

export interface MarketplaceUsageMetrics {
  totalScans: number;
  totalUsers: number;
  totalFindings: number;
  storageUsedGB: number;
  apiCalls: number;
  aiChatSessions: number;
  regionsScanned: string[];
}

export interface MarketplaceBillingTerms {
  billingPeriod: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  usageType: 'FLAT_FEE' | 'DIMENSION_BASED' | 'TIERED';
  dimensions: MarketplaceDimensions;
  includedUsage: MarketplaceUsageMetrics;
  overageRates: { [dimension: string]: number };
}

// AWS Marketplace Webhook Event Types
export interface MarketplaceSubscriptionEvent {
  action: 'subscribe' | 'unsubscribe' | 'change-seat-quantity';
  marketplaceProductCode: string;
  marketplaceCustomerId: string;
  customerIdentifier: string;
  subscriptionIdentifier: string;
  offerIdentifier?: string;
  actionType: 'Create' | 'Update' | 'Cancel' | 'Renew';
  timestamp: Date;
}

export interface MarketplaceEntitlementEvent {
  action: 'entitlement-updated';
  marketplaceProductCode: string;
  marketplaceCustomerId: string;
  customerIdentifier: string;
  entitlementIdentifier: string;
  operation: 'Create' | 'Update' | 'Cancel' | 'Renew' | 'Suspend' | 'Reinstate';
  timestamp: Date;
}

export interface MarketplaceUsageEvent {
  action: 'usage-updated';
  marketplaceProductCode: string;
  marketplaceCustomerId: string;
  customerIdentifier: string;
  usageReports: MarketplaceUsageRecord[];
  timestamp: Date;
}

// Marketplace Integration Configuration
 export interface MarketplaceConfig {
  productCode: string;
  customerTable: string;
  subscriptionTable: string;
  usageTable: string;
  webhookEndpoint: string;
  secretToken: string;
  awsRegion: string;
  dimensions: {
    scans: string;
    users: string;
    findings: string;
    storage: string;
    apis: string;
    aiSessions: string;
  };
  plans: MarketplaceSubscriptionPlan[];
}

// Error Types for Marketplace Operations
export interface MarketplaceError {
  errorType: 'VALIDATION_ERROR' | 'SUBSCRIPTION_ERROR' | 'METERING_ERROR' | 'ENTITLEMENT_ERROR';
  errorCode: string;
  errorMessage: string;
  timestamp: Date;
  customerIdentifier?: string;
  subscriptionId?: string;
}

// Subscription Management Types
export interface SubscriptionCreationRequest {
  customerIdentifier: string;
  marketplaceProductCode: string;
  subscriptionPlan: string;
  initialDimensions?: MarketplaceDimensions;
  customerMetadata?: Record<string, string>;
}

export interface SubscriptionUpdateRequest {
  subscriptionId: string;
  newPlan?: string;
  dimensionUpdates?: MarketplaceDimensions;
  status?: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
}

export interface SubscriptionCancelRequest {
  subscriptionId: string;
  cancellationReason?: string;
  effectiveDate: Date;
}

// Metering and Billing Types
export interface MeteringSubmission {
  subscriptionId: string;
  usageRecords: MarketplaceUsageRecord[];
  timestamp: Date;
  apiVersion: string;
}

export interface MeteringReceipt {
  meteringRecordId: string;
  subscriptionId: string;
  timestamp: Date;
  status: 'ACCEPTED' | 'REJECTED' | 'AGED_OUT';
}

export interface BillingEvent {
  subscriptionId: string;
  customerIdentifier: string;
  eventType: 'SUBSCRIPTION_START' | 'USAGE_CHARGE' | 'SUBSCRIPTION_RENEWAL' | 'SUBSCRIPTION_CANCEL';
  amount: number;
  currency: string;
  billingPeriod: Date;
  invoiceData?: Record<string, any>;
}

// Tenant Provisioning Types
export interface TenantProvisionRequest {
  customerIdentifier: string;
  subscriptionId: string;
  customerEmail: string;
  companyName: string;
  tier: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
  configuration: {
    regions: string[];
    complianceFrameworks: string[];
    notificationPreferences: Record<string, boolean>;
  };
}

export interface TenantProvisionResult {
  tenantId: string;
  status: 'SUCCESS' | 'FAILED';
  resources: {
    dynamodbTables: string[];
    s3Buckets: string[];
    lambdaFunctions: string[];
    iamRoles: string[];
    kmsKeys: string[];
  };
  provisioningTime: number;
  errors?: string[];
}

// Marketplace Integration Status Types
export interface MarketplaceIntegrationHealth {
  subscriptionService: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  entitlementService: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  meteringService: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  webhookService: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  lastHealthCheck: Date;
  errorDetails?: MarketplaceError[];
}

// Webhook Verification and Security Types
export interface WebhookSignature {
  timestamp: string;
  signature: string;
  algorithm: string;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  authenticity: 'VERIFIED' | 'INVALID' | 'MISSING_SIGNATURE';
  timestamp: Date;
  customerIdentifier?: string;
}

export interface MarketplaceWebhookPayload {
  Type: 'Notification' | 'SubscriptionNotification' | 'EntitlementNotification';
  MessageId: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  Subject?: string;
  Message: string;
  TopicArn?: string;
}
