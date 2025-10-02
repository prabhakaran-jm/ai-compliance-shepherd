/**
 * Type definitions for tenant management
 */

export interface TenantRequest {
  name: string;
  displayName?: string;
  organizationId: string;
  tier?: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
  configuration?: Partial<TenantConfiguration>;
  contactInfo?: TenantContactInfo;
  billingInfo?: TenantBillingInfo;
  createdBy?: string;
}

export interface TenantUpdateRequest {
  displayName?: string;
  status?: TenantStatus;
  tier?: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
  contactInfo?: Partial<TenantContactInfo>;
  billingInfo?: Partial<TenantBillingInfo>;
  updatedBy?: string;
}

export interface TenantResponse {
  tenantId: string;
  name: string;
  displayName: string;
  organizationId: string;
  status: TenantStatus;
  tier: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
  region: string;
  accountId: string;
  configuration: TenantConfiguration;
  resources: TenantResources;
  metadata: TenantMetadata;
  contactInfo?: TenantContactInfo;
  billingInfo?: TenantBillingInfo;
}

export interface TenantConfiguration {
  complianceFrameworks: string[];
  scanSchedule: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  retentionPeriodDays: number;
  encryptionEnabled: boolean;
  auditLoggingEnabled: boolean;
  crossAccountRoleEnabled: boolean;
  allowedRegions: string[];
  resourceLimits: TenantResourceLimits;
  features: TenantFeatures;
}

export interface TenantResourceLimits {
  maxFindings: number;
  maxScanJobs: number;
  maxUsers: number;
  maxReports: number;
}

export interface TenantFeatures {
  automatedRemediation: boolean;
  realTimeMonitoring: boolean;
  customRules: boolean;
  apiAccess: boolean;
  ssoIntegration: boolean;
}

export interface TenantResources {
  kmsKeyId: string;
  kmsKeyArn: string;
  s3BucketName: string;
  dynamoTablePrefix: string;
  iamRoleArn: string;
  secretsManagerPrefix: string;
}

export interface TenantMetadata {
  createdAt: string;
  createdBy: string;
  lastModifiedAt: string;
  lastModifiedBy: string;
  deletedAt?: string;
  version: number;
}

export interface TenantContactInfo {
  primaryContact: ContactDetails;
  technicalContact?: ContactDetails;
  billingContact?: ContactDetails;
}

export interface ContactDetails {
  name: string;
  email: string;
  phone?: string;
  title?: string;
}

export interface TenantBillingInfo {
  billingEmail: string;
  paymentMethod: 'CREDIT_CARD' | 'INVOICE' | 'WIRE_TRANSFER';
  billingAddress: Address;
  taxId?: string;
  purchaseOrderRequired?: boolean;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface TenantListRequest {
  status?: TenantStatus;
  tier?: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
  limit?: number;
  nextToken?: string;
}

export interface TenantMetrics {
  tenantId: string;
  period: string;
  scanJobs: {
    total: number;
    successful: number;
    failed: number;
    averageDuration: number;
  };
  findings: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    resolved: number;
    suppressed: number;
  };
  resources: {
    totalScanned: number;
    s3Buckets: number;
    iamUsers: number;
    iamRoles: number;
    ec2Instances: number;
    securityGroups: number;
  };
  compliance: {
    overallScore: number;
    soc2Score: number;
    hipaaScore: number;
    gdprScore: number;
  };
  usage: {
    apiCalls: number;
    storageUsedGB: number;
    reportGenerated: number;
    remediationActions: number;
  };
  costs: {
    totalCostUSD: number;
    computeCostUSD: number;
    storageCostUSD: number;
    apiCostUSD: number;
  };
  generatedAt: string;
}

export interface TenantHealth {
  tenantId: string;
  overallStatus: 'HEALTHY' | 'WARNING' | 'UNHEALTHY';
  components: {
    [componentName: string]: ComponentHealth;
  };
  metrics: {
    uptime: number;
    errorRate: number;
    avgResponseTime: number;
    throughput: number;
  };
  alerts: HealthAlert[];
  lastHealthCheck: string;
}

export interface ComponentHealth {
  status: 'HEALTHY' | 'WARNING' | 'UNHEALTHY';
  responseTime: number;
  lastCheck: string;
  error?: string;
}

export interface HealthAlert {
  alertId: string;
  component: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  triggeredAt: string;
  acknowledged: boolean;
}

export interface TenantOnboardingResult {
  onboardingId: string;
  tenantId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  steps: OnboardingStep[];
  resources: {
    cloudFormationStackId: string;
    cloudFormationStackArn: string;
    kmsKeyId: string;
    kmsKeyArn: string;
    s3BucketName: string;
    dynamoTablePrefix: string;
    iamRoleArn: string;
    secretsManagerPrefix: string;
  };
  credentials: {
    apiKeyId: string;
    apiKeySecret: string;
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    expiresAt: string;
  };
  endpoints: {
    apiGatewayUrl: string;
    chatInterfaceUrl: string;
    reportsUrl: string;
    documentationUrl: string;
  };
  startedAt: string;
  completedAt?: string;
  duration?: number;
  createdBy: string;
}

export interface TenantOffboardingResult {
  offboardingId: string;
  tenantId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  steps: OnboardingStep[];
  dataExport: {
    exportId: string;
    s3Location: string;
    size: string;
    checksum: string;
    retentionUntil: string;
  };
  startedAt: string;
  completedAt?: string;
  duration?: number;
}

export interface OnboardingStep {
  stepId: string;
  type: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  result?: any;
  error?: string;
}

export interface TenantUser {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER' | 'VIEWER';
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  permissions: string[];
  lastLoginAt?: string;
  createdAt: string;
  createdBy: string;
}

export interface TenantApiKey {
  keyId: string;
  tenantId: string;
  name: string;
  description?: string;
  permissions: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'REVOKED';
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  createdBy: string;
}

export interface TenantAuditLog {
  logId: string;
  tenantId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  correlationId?: string;
}

export interface TenantQuota {
  tenantId: string;
  quotaType: 'API_CALLS' | 'STORAGE' | 'SCAN_JOBS' | 'FINDINGS' | 'USERS';
  limit: number;
  used: number;
  resetPeriod: 'HOURLY' | 'DAILY' | 'MONTHLY';
  lastReset: string;
  nextReset: string;
}

export interface TenantBilling {
  tenantId: string;
  billingPeriod: string;
  usage: {
    apiCalls: number;
    storageGB: number;
    scanJobs: number;
    computeHours: number;
  };
  costs: {
    baseFee: number;
    usageFees: number;
    totalCost: number;
    currency: string;
  };
  invoiceId?: string;
  invoiceUrl?: string;
  paidAt?: string;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
}

export interface TenantBackup {
  backupId: string;
  tenantId: string;
  type: 'FULL' | 'INCREMENTAL';
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  s3Location: string;
  size: number;
  checksum: string;
  retentionUntil: string;
  createdAt: string;
  completedAt?: string;
}

export interface TenantRestore {
  restoreId: string;
  tenantId: string;
  backupId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  restoredItems: string[];
  startedAt: string;
  completedAt?: string;
  requestedBy: string;
}

export type TenantStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DELETED' | 'PENDING';
