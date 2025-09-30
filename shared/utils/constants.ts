/**
 * Application constants and enums
 */

import { ComplianceFramework, Severity, Environment } from '../types';

// Application constants
export const APP_NAME = 'AI Compliance Shepherd';
export const APP_VERSION = '1.0.0';
export const DEFAULT_REGION = 'us-east-1' as const;

// Compliance framework constants
export const SUPPORTED_FRAMEWORKS: ComplianceFramework[] = ['SOC2', 'HIPAA', 'GDPR'];
export const DEFAULT_FRAMEWORK: ComplianceFramework = 'SOC2';

// Severity levels
export const SEVERITY_LEVELS: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

// AWS service constants
export const SUPPORTED_AWS_SERVICES = [
  'S3',
  'IAM',
  'EC2',
  'EBS',
  'CloudTrail',
  'Config',
  'Lambda',
  'RDS',
  'KMS',
  'CloudWatch',
] as const;

export const SUPPORTED_AWS_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-central-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
] as const;

// Bedrock model constants
export const BEDROCK_MODELS = {
  CLAUDE_3_5_SONNET: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  CLAUDE_3_HAIKU: 'anthropic.claude-3-haiku-20240307-v1:0',
  TITAN_TEXT_V1: 'amazon.titan-text-v1',
  JURASSIC_2_ULTRA: 'ai21.j2-ultra-v1',
} as const;

// Default model parameters
export const DEFAULT_MODEL_PARAMS = {
  temperature: 0.1,
  topP: 0.9,
  maxTokens: 4000,
  stopSequences: [],
} as const;

// Scan constants
export const DEFAULT_SCAN_TIMEOUT = 300; // 5 minutes
export const DEFAULT_SCAN_CONCURRENCY = 10;
export const MAX_SCAN_DURATION = 3600; // 1 hour
export const DEFAULT_PAGINATION_LIMIT = 100;
export const MAX_PAGINATION_LIMIT = 1000;

// Remediation constants
export const DEFAULT_REMEDIATION_TIMEOUT = 600; // 10 minutes
export const MAX_AUTO_REMEDIATION_RISK = 'medium';
export const DEFAULT_DRY_RUN = true;

// Report constants
export const REPORT_FORMATS = ['html', 'pdf', 'json', 'csv'] as const;
export const DEFAULT_REPORT_FORMAT = 'html' as const;
export const REPORT_RETENTION_DAYS = 365;
export const REPORT_MAX_SIZE = 100 * 1024 * 1024; // 100MB

// Audit constants
export const AUDIT_LOG_RETENTION_DAYS = 2555; // 7 years
export const EVIDENCE_RETENTION_DAYS = 90;
export const FINDING_RETENTION_DAYS = 90;

// API constants
export const API_RATE_LIMITS = {
  SCAN: 10, // per minute
  CHAT: 100, // per minute
  REPORT: 5, // per minute
  REMEDIATION: 20, // per minute
} as const;

export const API_TIMEOUTS = {
  SCAN: 300000, // 5 minutes
  CHAT: 30000, // 30 seconds
  REPORT: 60000, // 1 minute
  REMEDIATION: 600000, // 10 minutes
} as const;

// Error codes
export const ERROR_CODES = {
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Resource errors
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_LIMIT_EXCEEDED: 'RESOURCE_LIMIT_EXCEEDED',
  
  // AWS errors
  AWS_ACCESS_DENIED: 'AWS_ACCESS_DENIED',
  AWS_SERVICE_UNAVAILABLE: 'AWS_SERVICE_UNAVAILABLE',
  AWS_THROTTLING: 'AWS_THROTTLING',
  
  // Scan errors
  SCAN_TIMEOUT: 'SCAN_TIMEOUT',
  SCAN_FAILED: 'SCAN_FAILED',
  SCAN_ALREADY_RUNNING: 'SCAN_ALREADY_RUNNING',
  
  // Remediation errors
  REMEDIATION_NOT_APPROVED: 'REMEDIATION_NOT_APPROVED',
  REMEDIATION_FAILED: 'REMEDIATION_FAILED',
  REMEDIATION_ROLLBACK_FAILED: 'REMEDIATION_ROLLBACK_FAILED',
  
  // Internal errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

// Compliance rule IDs (from SRS)
export const COMPLIANCE_RULE_IDS = {
  // S3 rules
  S3_001: 'S3-001', // Default encryption
  S3_002: 'S3-002', // Public access block
  
  // IAM rules
  IAM_001: 'IAM-001', // Root MFA
  IAM_002: 'IAM-002', // Password policy
  
  // Security Group rules
  SG_001: 'SG-001', // Restrictive rules
  
  // EBS rules
  EBS_001: 'EBS-001', // Default encryption
  
  // CloudTrail rules
  CT_001: 'CT-001', // Multi-region trail
} as const;

// Database table names
export const TABLE_NAMES = {
  TENANTS: 'compliance-shepherd-tenants',
  FINDINGS: 'compliance-shepherd-findings',
  ACTIONS: 'compliance-shepherd-actions',
  INTEGRATIONS: 'compliance-shepherd-integrations',
  USAGE: 'compliance-shepherd-usage',
  AUDIT_LOGS: 'compliance-shepherd-audit-logs',
} as const;

// S3 bucket prefixes
export const S3_PREFIXES = {
  REPORTS: 'reports/',
  EVIDENCE: 'evidence/',
  ARTIFACTS: 'artifacts/',
  BACKUPS: 'backups/',
  TEMP: 'temp/',
} as const;

// Step Functions state machine names
export const STATE_MACHINES = {
  SCAN_FLOW: 'compliance-shepherd-scan-flow',
  REMEDIATION_FLOW: 'compliance-shepherd-remediation-flow',
  REPORT_GENERATION: 'compliance-shepherd-report-generation',
  EVIDENCE_COLLECTION: 'compliance-shepherd-evidence-collection',
} as const;

// EventBridge rule names
export const EVENT_RULES = {
  SCHEDULED_SCAN: 'compliance-shepherd-scheduled-scan',
  RESOURCE_CHANGE: 'compliance-shepherd-resource-change',
  REMEDIATION_COMPLETE: 'compliance-shepherd-remediation-complete',
  COMPLIANCE_THRESHOLD: 'compliance-shepherd-compliance-threshold',
} as const;

// Lambda function names
export const LAMBDA_FUNCTIONS = {
  SCAN_ENVIRONMENT: 'compliance-shepherd-scan-environment',
  ANALYZE_TERRAFORM: 'compliance-shepherd-analyze-terraform',
  APPLY_FIX: 'compliance-shepherd-apply-fix',
  GENERATE_AUDIT_PACK: 'compliance-shepherd-generate-audit-pack',
  API_GATEWAY: 'compliance-shepherd-api-gateway',
  CHAT_HANDLER: 'compliance-shepherd-chat-handler',
} as const;

// Environment-specific configurations
export const ENV_CONFIGS: Record<Environment, Record<string, unknown>> = {
  development: {
    logLevel: 'debug',
    enableDetailedLogging: true,
    mockExternalServices: true,
    skipAuthentication: false,
  },
  staging: {
    logLevel: 'info',
    enableDetailedLogging: true,
    mockExternalServices: false,
    skipAuthentication: false,
  },
  production: {
    logLevel: 'warn',
    enableDetailedLogging: false,
    mockExternalServices: false,
    skipAuthentication: false,
  },
};

// Feature flags
export const FEATURE_FLAGS = {
  AUTO_REMEDIATION: 'auto_remediation',
  SLACK_NOTIFICATIONS: 'slack_notifications',
  GITHUB_INTEGRATION: 'github_integration',
  ADVANCED_REPORTING: 'advanced_reporting',
  ML_ANALYSIS: 'ml_analysis',
  CUSTOM_RULES: 'custom_rules',
  API_ACCESS: 'api_access',
  SSO_ENABLED: 'sso_enabled',
} as const;

// Integration types
export const INTEGRATION_TYPES = {
  GITHUB: 'github',
  GITLAB: 'gitlab',
  JIRA: 'jira',
  SLACK: 'slack',
  WEBHOOK: 'webhook',
  EMAIL: 'email',
} as const;

// Notification frequencies
export const NOTIFICATION_FREQUENCIES = {
  IMMEDIATE: 'immediate',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
} as const;
