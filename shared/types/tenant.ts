/**
 * Multi-tenant architecture types
 */

import { BaseEntity, AWSRegion } from './common';
import { ComplianceFramework } from './compliance';

export interface Tenant extends BaseEntity {
  name: string;
  displayName: string;
  description?: string;
  
  // Subscription and billing
  plan: TenantPlan;
  entitlements: TenantEntitlements;
  usage: TenantUsage;
  
  // Configuration
  settings: TenantSettings;
  integrations: TenantIntegrations;
  
  // Status
  status: TenantStatus;
  onboardedAt: string;
  lastActiveAt: string;
}

export interface TenantPlan {
  id: string;
  name: string;
  features: string[];
  limits: TenantLimits;
  pricing: {
    model: 'per_account' | 'per_finding' | 'per_scan' | 'flat_rate';
    price: number;
    currency: string;
    billingPeriod: 'monthly' | 'yearly';
  };
}

export interface TenantLimits {
  maxAccounts: number;
  maxScansPerMonth: number;
  maxFindingsPerMonth: number;
  maxRepositories: number;
  maxUsers: number;
  retentionDays: number;
  regions: AWSRegion[];
  frameworks: ComplianceFramework[];
}

export interface TenantEntitlements {
  autoRemediation: boolean;
  slackIntegration: boolean;
  jiraIntegration: boolean;
  githubIntegration: boolean;
  customRules: boolean;
  apiAccess: boolean;
  ssoEnabled: boolean;
  advancedReporting: boolean;
  prioritySupport: boolean;
}

export interface TenantUsage {
  currentPeriod: {
    accounts: number;
    scans: number;
    findings: number;
    repositories: number;
    apiCalls: number;
  };
  lastReset: string;
  nextReset: string;
}

export interface TenantSettings {
  // Compliance settings
  frameworks: ComplianceFramework[];
  enabledServices: string[];
  regions: AWSRegion[];
  
  // Scanning settings
  scanSchedule: ScanSchedule;
  autoRemediation: AutoRemediationSettings;
  
  // Notification settings
  notifications: NotificationSettings;
  
  // Security settings
  encryption: EncryptionSettings;
  accessControl: AccessControlSettings;
  
  // Custom settings
  customRules: CustomRuleSettings;
  branding?: BrandingSettings;
}

export interface ScanSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  time: string; // HH:MM format
  timezone: string;
  daysOfWeek?: number[]; // 0-6, Sunday=0
  dayOfMonth?: number; // 1-31
}

export interface AutoRemediationSettings {
  enabled: boolean;
  approvedActions: string[];
  requireApproval: boolean;
  maxRiskLevel: 'low' | 'medium' | 'high';
  dryRunOnly: boolean;
}

export interface NotificationSettings {
  email: EmailNotificationSettings;
  slack?: SlackNotificationSettings;
  webhook?: WebhookNotificationSettings;
}

export interface EmailNotificationSettings {
  enabled: boolean;
  recipients: string[];
  frequencies: {
    critical: 'immediate' | 'daily' | 'weekly';
    high: 'immediate' | 'daily' | 'weekly';
    medium: 'daily' | 'weekly';
    low: 'weekly' | 'monthly';
  };
}

export interface SlackNotificationSettings {
  enabled: boolean;
  webhookUrl: string;
  channels: string[];
  frequencies: {
    critical: 'immediate' | 'daily' | 'weekly';
    high: 'immediate' | 'daily' | 'weekly';
    medium: 'daily' | 'weekly';
    low: 'weekly' | 'monthly';
  };
}

export interface WebhookNotificationSettings {
  enabled: boolean;
  url: string;
  secret?: string;
  events: string[];
}

export interface EncryptionSettings {
  kmsKeyId: string;
  encryptionAtRest: boolean;
  encryptionInTransit: boolean;
  keyRotation: boolean;
}

export interface AccessControlSettings {
  ssoEnabled: boolean;
  ssoProvider?: string;
  allowedDomains: string[];
  sessionTimeout: number; // minutes
  mfaRequired: boolean;
}

export interface CustomRuleSettings {
  enabled: boolean;
  maxRules: number;
  rules: string[]; // Rule IDs
}

export interface BrandingSettings {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  companyName?: string;
}

export interface TenantIntegrations {
  github?: GitHubIntegration;
  gitlab?: GitLabIntegration;
  jira?: JiraIntegration;
  slack?: SlackIntegration;
  aws?: AWSIntegration[];
}

export interface GitHubIntegration {
  enabled: boolean;
  organization: string;
  repositories: string[];
  webhookSecret: string;
  accessToken: string;
  autoComment: boolean;
  autoPr: boolean;
}

export interface GitLabIntegration {
  enabled: boolean;
  instance: string;
  projects: string[];
  webhookSecret: string;
  accessToken: string;
  autoComment: boolean;
  autoMr: boolean;
}

export interface JiraIntegration {
  enabled: boolean;
  baseUrl: string;
  projectKey: string;
  username: string;
  apiToken: string;
  autoCreateTickets: boolean;
  ticketTemplate: string;
}

export interface SlackIntegration {
  enabled: boolean;
  workspaceId: string;
  channels: string[];
  botToken: string;
  autoNotify: boolean;
}

export interface AWSIntegration {
  accountId: string;
  roleArn: string;
  regions: AWSRegion[];
  name: string;
  description?: string;
  enabled: boolean;
  lastScan?: string;
}

export type TenantStatus = 'active' | 'suspended' | 'trial' | 'expired' | 'cancelled';

// Tenant user management
export interface TenantUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: TenantUserRole;
  permissions: TenantPermission[];
  status: 'active' | 'inactive' | 'pending';
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export type TenantUserRole = 'admin' | 'security_lead' | 'developer' | 'viewer';

export interface TenantPermission {
  resource: string;
  actions: string[];
}

// Marketplace integration
export interface MarketplaceEntitlement {
  customerIdentifier: string;
  productCode: string;
  dimension: string;
  value: number;
  effectiveDate: string;
  expirationDate?: string;
}

export interface UsageRecord {
  customerIdentifier: string;
  dimension: string;
  quantity: number;
  effectiveDate: string;
}
