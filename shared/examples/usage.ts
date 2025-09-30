/**
 * Examples of how to use the shared types and utilities
 */

import {
  // Types
  Finding,
  ScanRequest,
  Tenant,
  ComplianceFramework,
  Severity,
  
  // Constants
  SUPPORTED_FRAMEWORKS,
  SEVERITY_LEVELS,
  ERROR_CODES,
  
  // Validators
  validateTenantId,
  validateFindingId,
  validateScanRequest,
  isValidUUID,
  isValidARN,
} from '../index';

// Example 1: Creating a finding
const exampleFinding: Finding = {
  id: 'finding-123',
  tenantId: 'tenant-456',
  findingId: 'f1234567-89ab-cdef-0123-456789abcdef',
  resourceArn: 'arn:aws:s3:::example-bucket',
  resourceType: 'AWS::S3::Bucket',
  service: 'S3',
  region: 'us-east-1',
  accountId: '123456789012',
  
  framework: 'SOC2',
  controlId: 'CC6.1',
  controlTitle: 'Logical and physical access controls',
  severity: 'high',
  
  title: 'S3 bucket lacks default encryption',
  description: 'The S3 bucket does not have default encryption enabled',
  risk: 'Unencrypted data could be exposed if accessed improperly',
  recommendation: 'Enable default encryption using AES-256 or AWS KMS',
  
  evidence: [
    {
      type: 'configuration',
      description: 'Bucket encryption configuration',
      data: { encryption: 'None' },
      timestamp: new Date().toISOString(),
      source: 'AWS API',
    },
  ],
  references: [
    {
      type: 'aws_doc',
      title: 'Amazon S3 Default Encryption',
      url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-encryption.html',
    },
  ],
  
  status: 'active',
  firstSeen: new Date().toISOString(),
  lastSeen: new Date().toISOString(),
  
  remediation: {
    type: 'automatic',
    description: 'Enable default encryption',
    steps: [
      {
        order: 1,
        action: 'Enable default encryption',
        description: 'Set default encryption to AES-256',
        command: 'aws s3api put-bucket-encryption --bucket example-bucket --server-side-encryption-configuration "{\\"Rules\\":[{\\"ApplyServerSideEncryptionByDefault\\":{\\"SSEAlgorithm\\":\\"AES256\\"}}]}"',
      },
    ],
    estimatedEffort: 'low',
    requiresApproval: false,
    automated: true,
  },
  
  tags: ['security', 'encryption', 's3'],
  hash: 'abc123def456',
  
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Example 2: Creating a scan request
const exampleScanRequest: ScanRequest = {
  scanId: 'scan-789',
  tenantId: 'tenant-456',
  accountId: '123456789012',
  region: 'us-east-1',
  scanType: 'full_environment',
  frameworks: ['SOC2', 'HIPAA'],
  services: ['S3', 'IAM', 'EC2'],
  rules: ['S3-001', 'IAM-001'],
  options: {
    parallel: true,
    maxConcurrency: 10,
    timeout: 300,
    generateReport: true,
    includeEvidence: false,
    includeRecommendations: true,
    dryRun: false,
    skipSuppressed: true,
    includeHistorical: false,
  },
  triggeredBy: {
    type: 'manual',
    source: 'api',
    metadata: {
      userId: 'user-123',
      userAgent: 'Mozilla/5.0...',
    },
  },
  requestedBy: 'user-123',
  requestId: 'req-456',
};

// Example 3: Creating a tenant
const exampleTenant: Tenant = {
  id: 'tenant-456',
  name: 'acme-corp',
  displayName: 'Acme Corporation',
  description: 'Enterprise customer for compliance monitoring',
  
  plan: {
    id: 'enterprise',
    name: 'Enterprise Plan',
    features: ['auto_remediation', 'advanced_reporting', 'api_access'],
    limits: {
      maxAccounts: 50,
      maxScansPerMonth: 1000,
      maxFindingsPerMonth: 10000,
      maxRepositories: 100,
      maxUsers: 25,
      retentionDays: 365,
      regions: ['us-east-1', 'us-west-2'],
      frameworks: ['SOC2', 'HIPAA'],
    },
    pricing: {
      model: 'per_account',
      price: 100,
      currency: 'USD',
      billingPeriod: 'monthly',
    },
  },
  
  entitlements: {
    autoRemediation: true,
    slackIntegration: true,
    jiraIntegration: true,
    githubIntegration: true,
    customRules: true,
    apiAccess: true,
    ssoEnabled: false,
    advancedReporting: true,
    prioritySupport: true,
  },
  
  usage: {
    currentPeriod: {
      accounts: 5,
      scans: 25,
      findings: 150,
      repositories: 10,
      apiCalls: 1000,
    },
    lastReset: '2024-01-01T00:00:00Z',
    nextReset: '2024-02-01T00:00:00Z',
  },
  
  settings: {
    frameworks: ['SOC2'],
    enabledServices: ['S3', 'IAM', 'EC2'],
    regions: ['us-east-1'],
    scanSchedule: {
      enabled: true,
      frequency: 'weekly',
      time: '02:00',
      timezone: 'UTC',
    },
    autoRemediation: {
      enabled: true,
      approvedActions: ['s3-encryption', 's3-public-access'],
      requireApproval: true,
      maxRiskLevel: 'medium',
      dryRunOnly: false,
    },
    notifications: {
      email: {
        enabled: true,
        recipients: ['security@acme.com'],
        frequencies: {
          critical: 'immediate',
          high: 'immediate',
          medium: 'daily',
          low: 'weekly',
        },
      },
    },
    encryption: {
      kmsKeyId: 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012',
      encryptionAtRest: true,
      encryptionInTransit: true,
      keyRotation: true,
    },
    accessControl: {
      ssoEnabled: false,
      allowedDomains: ['acme.com'],
      sessionTimeout: 480,
      mfaRequired: true,
    },
    customRules: {
      enabled: true,
      maxRules: 10,
      rules: ['custom-rule-1', 'custom-rule-2'],
    },
  },
  
  integrations: {
    github: {
      enabled: true,
      organization: 'acme-corp',
      repositories: ['acme/infrastructure', 'acme/application'],
      webhookSecret: 'secret-123',
      accessToken: 'token-456',
      autoComment: true,
      autoPr: false,
    },
    slack: {
      enabled: true,
      workspaceId: 'T1234567890',
      channels: ['#security', '#compliance'],
      botToken: 'xoxb-token-789',
      autoNotify: true,
    },
  },
  
  status: 'active',
  onboardedAt: '2024-01-01T00:00:00Z',
  lastActiveAt: new Date().toISOString(),
  
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: new Date().toISOString(),
};

// Example 4: Using constants
console.log('Supported frameworks:', SUPPORTED_FRAMEWORKS);
console.log('Severity levels:', SEVERITY_LEVELS);
console.log('Error codes:', ERROR_CODES);

// Example 5: Using validators
try {
  const validTenantId = validateTenantId('tenant-123');
  const validFindingId = validateFindingId('f1234567-89ab-cdef-0123-456789abcdef');
  const validScanRequest = validateScanRequest(exampleScanRequest);
  
  console.log('Validation successful:', { validTenantId, validFindingId });
} catch (error) {
  console.error('Validation failed:', error);
}

// Example 6: Using utility functions
console.log('Is UUID valid:', isValidUUID('f1234567-89ab-cdef-0123-456789abcdef'));
console.log('Is ARN valid:', isValidARN('arn:aws:s3:::example-bucket'));

// Example 7: Working with compliance frameworks
const framework: ComplianceFramework = 'SOC2';
const severity: Severity = 'high';

console.log('Framework:', framework);
console.log('Severity:', severity);

// Example 8: Type-safe error handling
const handleError = (error: any) => {
  if (error.code === ERROR_CODES.UNAUTHORIZED) {
    console.log('Authentication required');
  } else if (error.code === ERROR_CODES.RESOURCE_NOT_FOUND) {
    console.log('Resource not found');
  } else {
    console.log('Unknown error:', error.message);
  }
};

export {
  exampleFinding,
  exampleScanRequest,
  exampleTenant,
  handleError,
};
