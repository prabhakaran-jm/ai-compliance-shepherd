/**
 * DynamoDB table schemas and definitions
 */

import {
  Tenant,
  Finding,
  ScanJob,
  RemediationJob,
  AuditTrail,
  TenantUser,
  ComplianceAssessment,
  ComplianceMapping,
  ScanSchedule,
  ScanTemplate,
  RemediationTemplate,
  AutoRemediationRule,
  TenantIntegration,
  MarketplaceEntitlement,
  UsageRecord,
  FindingTrend,
  ComplianceTrend,
  RemediationMetrics,
  TenantPermission,
} from '@compliance-shepherd/shared';

// Base table configuration
export interface TableConfig {
  tableName: string;
  partitionKey: string;
  sortKey?: string;
  gsi: GlobalSecondaryIndex[];
  lsi: LocalSecondaryIndex[];
  ttlAttribute?: string;
  streamEnabled: boolean;
  pointInTimeRecovery: boolean;
  encryption: {
    enabled: boolean;
    kmsKeyId?: string;
  };
  billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
  readCapacityUnits?: number;
  writeCapacityUnits?: number;
}

export interface GlobalSecondaryIndex {
  indexName: string;
  partitionKey: string;
  sortKey?: string;
  projectionType: 'ALL' | 'KEYS_ONLY' | 'INCLUDE';
  nonKeyAttributes?: string[];
  readCapacityUnits?: number;
  writeCapacityUnits?: number;
}

export interface LocalSecondaryIndex {
  indexName: string;
  sortKey: string;
  projectionType: 'ALL' | 'KEYS_ONLY' | 'INCLUDE';
  nonKeyAttributes?: string[];
}

// Table schemas
export const TENANTS_TABLE: TableConfig = {
  tableName: 'compliance-shepherd-tenants',
  partitionKey: 'tenantId',
  gsi: [
    {
      indexName: 'GSI-Name',
      partitionKey: 'name',
      projectionType: 'ALL',
    },
    {
      indexName: 'GSI-Status',
      partitionKey: 'status',
      sortKey: 'createdAt',
      projectionType: 'ALL',
    },
  ],
  lsi: [],
  ttlAttribute: undefined,
  streamEnabled: true,
  pointInTimeRecovery: true,
  encryption: {
    enabled: true,
  },
  billingMode: 'PAY_PER_REQUEST',
};

export const FINDINGS_TABLE: TableConfig = {
  tableName: 'compliance-shepherd-findings',
  partitionKey: 'tenantId',
  sortKey: 'findingId',
  gsi: [
    {
      indexName: 'GSI-ResourceArn',
      partitionKey: 'resourceArn',
      sortKey: 'lastSeen',
      projectionType: 'ALL',
    },
    {
      indexName: 'GSI-Severity',
      partitionKey: 'severity',
      sortKey: 'lastSeen',
      projectionType: 'ALL',
    },
    {
      indexName: 'GSI-Framework',
      partitionKey: 'framework',
      sortKey: 'lastSeen',
      projectionType: 'ALL',
    },
    {
      indexName: 'GSI-Status',
      partitionKey: 'status',
      sortKey: 'lastSeen',
      projectionType: 'ALL',
    },
    {
      indexName: 'GSI-Service',
      partitionKey: 'service',
      sortKey: 'lastSeen',
      projectionType: 'ALL',
    },
    {
      indexName: 'GSI-AccountRegion',
      partitionKey: 'accountRegion',
      sortKey: 'lastSeen',
      projectionType: 'ALL',
    },
  ],
  lsi: [
    {
      indexName: 'LSI-CreatedAt',
      sortKey: 'createdAt',
      projectionType: 'ALL',
    },
  ],
  ttlAttribute: 'ttl',
  streamEnabled: true,
  pointInTimeRecovery: true,
  encryption: {
    enabled: true,
  },
  billingMode: 'PAY_PER_REQUEST',
};

export const SCAN_JOBS_TABLE: TableConfig = {
  tableName: 'compliance-shepherd-scan-jobs',
  partitionKey: 'tenantId',
  sortKey: 'scanId',
  gsi: [
    {
      indexName: 'GSI-Status',
      partitionKey: 'status',
      sortKey: 'startedAt',
      projectionType: 'ALL',
    },
    {
      indexName: 'GSI-AccountId',
      partitionKey: 'accountId',
      sortKey: 'startedAt',
      projectionType: 'ALL',
    },
    {
      indexName: 'GSI-ScanType',
      partitionKey: 'scanType',
      sortKey: 'startedAt',
      projectionType: 'ALL',
    },
  ],
  lsi: [
    {
      indexName: 'LSI-StartedAt',
      sortKey: 'startedAt',
      projectionType: 'ALL',
    },
  ],
  ttlAttribute: 'ttl',
  streamEnabled: true,
  pointInTimeRecovery: true,
  encryption: {
    enabled: true,
  },
  billingMode: 'PAY_PER_REQUEST',
};

export const REMEDIATION_JOBS_TABLE: TableConfig = {
  tableName: 'compliance-shepherd-remediation-jobs',
  partitionKey: 'tenantId',
  sortKey: 'remediationId',
  gsi: [
    {
      indexName: 'GSI-Status',
      partitionKey: 'status',
      sortKey: 'startedAt',
      projectionType: 'ALL',
    },
    {
      indexName: 'GSI-RequestedBy',
      partitionKey: 'requestedBy',
      sortKey: 'startedAt',
      projectionType: 'ALL',
    },
    {
      indexName: 'GSI-Type',
      partitionKey: 'type',
      sortKey: 'startedAt',
      projectionType: 'ALL',
    },
  ],
  lsi: [
    {
      indexName: 'LSI-StartedAt',
      sortKey: 'startedAt',
      projectionType: 'ALL',
    },
  ],
  ttlAttribute: 'ttl',
  streamEnabled: true,
  pointInTimeRecovery: true,
  encryption: {
    enabled: true,
  },
  billingMode: 'PAY_PER_REQUEST',
};

export const AUDIT_LOGS_TABLE: TableConfig = {
  tableName: 'compliance-shepherd-audit-logs',
  partitionKey: 'tenantId',
  sortKey: 'timestamp',
  gsi: [
    {
      indexName: 'GSI-Action',
      partitionKey: 'action',
      sortKey: 'timestamp',
      projectionType: 'ALL',
    },
    {
      indexName: 'GSI-Actor',
      partitionKey: 'actorId',
      sortKey: 'timestamp',
      projectionType: 'ALL',
    },
    {
      indexName: 'GSI-Target',
      partitionKey: 'targetType',
      sortKey: 'timestamp',
      projectionType: 'ALL',
    },
  ],
  lsi: [],
  ttlAttribute: 'ttl',
  streamEnabled: false,
  pointInTimeRecovery: true,
  encryption: {
    enabled: true,
  },
  billingMode: 'PAY_PER_REQUEST',
};

export const TENANT_USERS_TABLE: TableConfig = {
  tableName: 'compliance-shepherd-tenant-users',
  partitionKey: 'tenantId',
  sortKey: 'userId',
  gsi: [
    {
      indexName: 'GSI-Email',
      partitionKey: 'email',
      projectionType: 'ALL',
    },
    {
      indexName: 'GSI-Role',
      partitionKey: 'role',
      sortKey: 'createdAt',
      projectionType: 'ALL',
    },
    {
      indexName: 'GSI-Status',
      partitionKey: 'status',
      sortKey: 'lastLogin',
      projectionType: 'ALL',
    },
  ],
  lsi: [
    {
      indexName: 'LSI-CreatedAt',
      sortKey: 'createdAt',
      projectionType: 'ALL',
    },
  ],
  ttlAttribute: undefined,
  streamEnabled: true,
  pointInTimeRecovery: true,
  encryption: {
    enabled: true,
  },
  billingMode: 'PAY_PER_REQUEST',
};

export const COMPLIANCE_ASSESSMENTS_TABLE: TableConfig = {
  tableName: 'compliance-shepherd-compliance-assessments',
  partitionKey: 'tenantId',
  sortKey: 'assessmentId',
  gsi: [
    {
      indexName: 'GSI-Framework',
      partitionKey: 'framework',
      sortKey: 'startedAt',
      projectionType: 'ALL',
    },
    {
      indexName: 'GSI-Status',
      partitionKey: 'status',
      sortKey: 'startedAt',
      projectionType: 'ALL',
    },
  ],
  lsi: [
    {
      indexName: 'LSI-StartedAt',
      sortKey: 'startedAt',
      projectionType: 'ALL',
    },
  ],
  ttlAttribute: 'ttl',
  streamEnabled: false,
  pointInTimeRecovery: true,
  encryption: {
    enabled: true,
  },
  billingMode: 'PAY_PER_REQUEST',
};

export const INTEGRATIONS_TABLE: TableConfig = {
  tableName: 'compliance-shepherd-integrations',
  partitionKey: 'tenantId',
  sortKey: 'integrationId',
  gsi: [
    {
      indexName: 'GSI-Service',
      partitionKey: 'service',
      sortKey: 'createdAt',
      projectionType: 'ALL',
    },
    {
      indexName: 'GSI-Status',
      partitionKey: 'status',
      sortKey: 'createdAt',
      projectionType: 'ALL',
    },
  ],
  lsi: [
    {
      indexName: 'LSI-CreatedAt',
      sortKey: 'createdAt',
      projectionType: 'ALL',
    },
  ],
  ttlAttribute: undefined,
  streamEnabled: true,
  pointInTimeRecovery: true,
  encryption: {
    enabled: true,
  },
  billingMode: 'PAY_PER_REQUEST',
};

export const USAGE_METRICS_TABLE: TableConfig = {
  tableName: 'compliance-shepherd-usage-metrics',
  partitionKey: 'tenantId',
  sortKey: 'period',
  gsi: [
    {
      indexName: 'GSI-Period',
      partitionKey: 'period',
      sortKey: 'tenantId',
      projectionType: 'ALL',
    },
  ],
  lsi: [],
  ttlAttribute: 'ttl',
  streamEnabled: false,
  pointInTimeRecovery: true,
  encryption: {
    enabled: true,
  },
  billingMode: 'PAY_PER_REQUEST',
};

export const SCAN_SCHEDULES_TABLE: TableConfig = {
  tableName: 'compliance-shepherd-scan-schedules',
  partitionKey: 'tenantId',
  sortKey: 'scheduleId',
  gsi: [
    {
      indexName: 'GSI-Enabled',
      partitionKey: 'enabled',
      sortKey: 'nextRun',
      projectionType: 'ALL',
    },
  ],
  lsi: [
    {
      indexName: 'LSI-CreatedAt',
      sortKey: 'createdAt',
      projectionType: 'ALL',
    },
  ],
  ttlAttribute: undefined,
  streamEnabled: false,
  pointInTimeRecovery: true,
  encryption: {
    enabled: true,
  },
  billingMode: 'PAY_PER_REQUEST',
};

export const SCAN_TEMPLATES_TABLE: TableConfig = {
  tableName: 'compliance-shepherd-scan-templates',
  partitionKey: 'templateId',
  gsi: [
    {
      indexName: 'GSI-Category',
      partitionKey: 'category',
      sortKey: 'usageCount',
      projectionType: 'ALL',
    },
    {
      indexName: 'GSI-CreatedBy',
      partitionKey: 'createdBy',
      sortKey: 'createdAt',
      projectionType: 'ALL',
    },
  ],
  lsi: [],
  ttlAttribute: undefined,
  streamEnabled: false,
  pointInTimeRecovery: true,
  encryption: {
    enabled: true,
  },
  billingMode: 'PAY_PER_REQUEST',
};

export const REMEDIATION_TEMPLATES_TABLE: TableConfig = {
  tableName: 'compliance-shepherd-remediation-templates',
  partitionKey: 'templateId',
  gsi: [
    {
      indexName: 'GSI-Category',
      partitionKey: 'category',
      sortKey: 'usageCount',
      projectionType: 'ALL',
    },
    {
      indexName: 'GSI-CreatedBy',
      partitionKey: 'createdBy',
      sortKey: 'createdAt',
      projectionType: 'ALL',
    },
  ],
  lsi: [],
  ttlAttribute: undefined,
  streamEnabled: false,
  pointInTimeRecovery: true,
  encryption: {
    enabled: true,
  },
  billingMode: 'PAY_PER_REQUEST',
};

export const AUTO_REMEDIATION_RULES_TABLE: TableConfig = {
  tableName: 'compliance-shepherd-auto-remediation-rules',
  partitionKey: 'tenantId',
  sortKey: 'ruleId',
  gsi: [
    {
      indexName: 'GSI-Enabled',
      partitionKey: 'enabled',
      sortKey: 'createdAt',
      projectionType: 'ALL',
    },
    {
      indexName: 'GSI-RiskLevel',
      partitionKey: 'riskLevel',
      sortKey: 'createdAt',
      projectionType: 'ALL',
    },
  ],
  lsi: [
    {
      indexName: 'LSI-CreatedAt',
      sortKey: 'createdAt',
      projectionType: 'ALL',
    },
  ],
  ttlAttribute: undefined,
  streamEnabled: true,
  pointInTimeRecovery: true,
  encryption: {
    enabled: true,
  },
  billingMode: 'PAY_PER_REQUEST',
};

export const MARKETPLACE_ENTITLEMENTS_TABLE: TableConfig = {
  tableName: 'compliance-shepherd-marketplace-entitlements',
  partitionKey: 'customerIdentifier',
  sortKey: 'productCode',
  gsi: [
    {
      indexName: 'GSI-EffectiveDate',
      partitionKey: 'effectiveDate',
      sortKey: 'customerIdentifier',
      projectionType: 'ALL',
    },
    {
      indexName: 'GSI-ExpirationDate',
      partitionKey: 'expirationDate',
      sortKey: 'customerIdentifier',
      projectionType: 'ALL',
    },
  ],
  lsi: [],
  ttlAttribute: 'ttl',
  streamEnabled: false,
  pointInTimeRecovery: true,
  encryption: {
    enabled: true,
  },
  billingMode: 'PAY_PER_REQUEST',
};

export const USAGE_RECORDS_TABLE: TableConfig = {
  tableName: 'compliance-shepherd-usage-records',
  partitionKey: 'customerIdentifier',
  sortKey: 'effectiveDate',
  gsi: [
    {
      indexName: 'GSI-Dimension',
      partitionKey: 'dimension',
      sortKey: 'effectiveDate',
      projectionType: 'ALL',
    },
  ],
  lsi: [],
  ttlAttribute: 'ttl',
  streamEnabled: false,
  pointInTimeRecovery: true,
  encryption: {
    enabled: true,
  },
  billingMode: 'PAY_PER_REQUEST',
};

// All table configurations
export const ALL_TABLES: TableConfig[] = [
  TENANTS_TABLE,
  FINDINGS_TABLE,
  SCAN_JOBS_TABLE,
  REMEDIATION_JOBS_TABLE,
  AUDIT_LOGS_TABLE,
  TENANT_USERS_TABLE,
  COMPLIANCE_ASSESSMENTS_TABLE,
  INTEGRATIONS_TABLE,
  USAGE_METRICS_TABLE,
  SCAN_SCHEDULES_TABLE,
  SCAN_TEMPLATES_TABLE,
  REMEDIATION_TEMPLATES_TABLE,
  AUTO_REMEDIATION_RULES_TABLE,
  MARKETPLACE_ENTITLEMENTS_TABLE,
  USAGE_RECORDS_TABLE,
];

// Table name to config mapping
export const TABLE_CONFIGS: Record<string, TableConfig> = {
  [TENANTS_TABLE.tableName]: TENANTS_TABLE,
  [FINDINGS_TABLE.tableName]: FINDINGS_TABLE,
  [SCAN_JOBS_TABLE.tableName]: SCAN_JOBS_TABLE,
  [REMEDIATION_JOBS_TABLE.tableName]: REMEDIATION_JOBS_TABLE,
  [AUDIT_LOGS_TABLE.tableName]: AUDIT_LOGS_TABLE,
  [TENANT_USERS_TABLE.tableName]: TENANT_USERS_TABLE,
  [COMPLIANCE_ASSESSMENTS_TABLE.tableName]: COMPLIANCE_ASSESSMENTS_TABLE,
  [INTEGRATIONS_TABLE.tableName]: INTEGRATIONS_TABLE,
  [USAGE_METRICS_TABLE.tableName]: USAGE_METRICS_TABLE,
  [SCAN_SCHEDULES_TABLE.tableName]: SCAN_SCHEDULES_TABLE,
  [SCAN_TEMPLATES_TABLE.tableName]: SCAN_TEMPLATES_TABLE,
  [REMEDIATION_TEMPLATES_TABLE.tableName]: REMEDIATION_TEMPLATES_TABLE,
  [AUTO_REMEDIATION_RULES_TABLE.tableName]: AUTO_REMEDIATION_RULES_TABLE,
  [MARKETPLACE_ENTITLEMENTS_TABLE.tableName]: MARKETPLACE_ENTITLEMENTS_TABLE,
  [USAGE_RECORDS_TABLE.tableName]: USAGE_RECORDS_TABLE,
};
