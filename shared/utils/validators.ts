/**
 * Type validation utilities
 */

import { z } from 'zod';

// Common validation schemas
export const tenantIdSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9-_]+$/);
export const findingIdSchema = z.string().uuid();
export const scanIdSchema = z.string().uuid();
export const remediationIdSchema = z.string().uuid();
export const arnSchema = z.string().regex(/^arn:aws:[a-z0-9-]+:[a-z0-9-]*:[0-9]{12}:[a-zA-Z0-9-_./]+$/);
export const awsAccountIdSchema = z.string().regex(/^[0-9]{12}$/);
export const awsRegionSchema = z.string().regex(/^[a-z0-9-]+$/);
export const emailSchema = z.string().email();
export const urlSchema = z.string().url();

// Severity validation
export const severitySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);

// Framework validation
export const frameworkSchema = z.enum(['SOC2', 'HIPAA', 'GDPR', 'PCI_DSS', 'ISO27001']);

// Status validation
export const statusSchema = z.enum(['pending', 'in_progress', 'completed', 'failed', 'cancelled']);

// Environment validation
export const environmentSchema = z.enum(['development', 'staging', 'production']);

// Pagination validation
export const paginationSchema = z.object({
  limit: z.number().min(1).max(1000).default(100),
  offset: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Date validation
export const dateSchema = z.string().datetime();
export const dateRangeSchema = z.object({
  start: dateSchema,
  end: dateSchema,
}).refine(data => new Date(data.start) <= new Date(data.end), {
  message: "Start date must be before end date",
});

// Finding filter validation
export const findingFilterSchema = z.object({
  tenantId: tenantIdSchema.optional(),
  accountId: awsAccountIdSchema.optional(),
  region: awsRegionSchema.optional(),
  service: z.string().optional(),
  framework: frameworkSchema.optional(),
  severity: severitySchema.optional(),
  status: z.enum(['active', 'suppressed', 'resolved', 'false_positive', 'accepted_risk']).optional(),
  resourceType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dateFrom: dateSchema.optional(),
  dateTo: dateSchema.optional(),
});

// Scan request validation
export const scanRequestSchema = z.object({
  scanId: scanIdSchema,
  tenantId: tenantIdSchema,
  accountId: awsAccountIdSchema,
  region: awsRegionSchema.optional(),
  scanType: z.enum(['full_environment', 'service_specific', 'rule_specific', 'resource_specific', 'incremental', 'scheduled']),
  frameworks: z.array(frameworkSchema).min(1),
  services: z.array(z.string()).min(1),
  rules: z.array(z.string()).optional(),
  options: z.object({
    resourceTypes: z.array(z.string()).optional(),
    resourceTags: z.record(z.array(z.string())).optional(),
    excludeResources: z.array(z.string()).optional(),
    parallel: z.boolean().default(true),
    maxConcurrency: z.number().min(1).max(50).default(10),
    timeout: z.number().min(60).max(3600).default(300),
    generateReport: z.boolean().default(true),
    includeEvidence: z.boolean().default(false),
    includeRecommendations: z.boolean().default(true),
    dryRun: z.boolean().default(false),
    skipSuppressed: z.boolean().default(true),
    includeHistorical: z.boolean().default(false),
  }),
  scheduledAt: dateSchema.optional(),
  triggeredBy: z.object({
    type: z.enum(['manual', 'scheduled', 'event', 'webhook', 'api']),
    source: z.string(),
    metadata: z.record(z.unknown()).optional(),
  }),
  requestedBy: z.string(),
  requestId: z.string(),
});

// Chat request validation
export const chatRequestSchema = z.object({
  tenantId: tenantIdSchema,
  message: z.string().min(1).max(4000),
  conversationId: z.string().optional(),
  context: z.object({
    scanId: scanIdSchema.optional(),
    findingIds: z.array(findingIdSchema).optional(),
    resourceArns: z.array(arnSchema).optional(),
    frameworks: z.array(frameworkSchema).optional(),
    services: z.array(z.string()).optional(),
  }).optional(),
  options: z.object({
    includeCitations: z.boolean().default(true),
    includeRecommendations: z.boolean().default(true),
    maxTokens: z.number().min(100).max(4000).default(2000),
    temperature: z.number().min(0).max(2).default(0.1),
    model: z.string().optional(),
  }).optional(),
});

// Remediation request validation
export const remediationRequestSchema = z.object({
  remediationId: remediationIdSchema,
  tenantId: tenantIdSchema,
  findingIds: z.array(findingIdSchema).min(1),
  type: z.enum(['automatic', 'semi_automatic', 'manual_guidance', 'ticket_creation', 'pr_creation']),
  approach: z.enum(['direct_fix', 'terraform_plan', 'cloudformation_change_set', 'aws_cli_commands', 'documentation_only']),
  options: z.object({
    dryRun: z.boolean().default(true),
    backup: z.boolean().default(false),
    rollbackPlan: z.boolean().default(true),
    maxRiskLevel: severitySchema.default('medium'),
    confirmationRequired: z.boolean().default(true),
    timeoutMinutes: z.number().min(5).max(120).default(30),
    notifyOnStart: z.boolean().default(true),
    notifyOnComplete: z.boolean().default(true),
    notifyOnFailure: z.boolean().default(true),
    createTicket: z.boolean().default(false),
    createPR: z.boolean().default(false),
    updateSlack: z.boolean().default(true),
  }),
  requiresApproval: z.boolean(),
  approvedBy: z.string().optional(),
  approvedAt: dateSchema.optional(),
  approvalTicket: z.string().optional(),
  requestedBy: z.string(),
  requestedAt: dateSchema,
  scheduledAt: dateSchema.optional(),
});

// Report request validation
export const reportRequestSchema = z.object({
  scanId: scanIdSchema,
  format: z.enum(['html', 'pdf', 'json', 'csv']),
  filters: findingFilterSchema.optional(),
  options: z.object({
    includeEvidence: z.boolean().default(false),
    includeRecommendations: z.boolean().default(true),
    includeTrends: z.boolean().default(false),
  }).optional(),
});

// Tenant validation
export const tenantSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  displayName: z.string().min(1).max(200),
  description: z.string().optional(),
  plan: z.object({
    id: z.string(),
    name: z.string(),
    features: z.array(z.string()),
    limits: z.object({
      maxAccounts: z.number().min(1),
      maxScansPerMonth: z.number().min(1),
      maxFindingsPerMonth: z.number().min(1),
      maxRepositories: z.number().min(1),
      maxUsers: z.number().min(1),
      retentionDays: z.number().min(30).max(2555),
      regions: z.array(z.string()),
      frameworks: z.array(frameworkSchema),
    }),
  }),
  status: z.enum(['active', 'suspended', 'trial', 'expired', 'cancelled']),
});

// Utility functions
export function validateTenantId(tenantId: unknown): string {
  return tenantIdSchema.parse(tenantId);
}

export function validateFindingId(findingId: unknown): string {
  return findingIdSchema.parse(findingId);
}

export function validateScanId(scanId: unknown): string {
  return scanIdSchema.parse(scanId);
}

export function validateARN(arn: unknown): string {
  return arnSchema.parse(arn);
}

export function validateAWSAccountId(accountId: unknown): string {
  return awsAccountIdSchema.parse(accountId);
}

export function validateEmail(email: unknown): string {
  return emailSchema.parse(email);
}

export function validateSeverity(severity: unknown): 'critical' | 'high' | 'medium' | 'low' | 'info' {
  return severitySchema.parse(severity);
}

export function validateFramework(framework: unknown): 'SOC2' | 'HIPAA' | 'GDPR' | 'PCI_DSS' | 'ISO27001' {
  return frameworkSchema.parse(framework);
}

export function validateEnvironment(environment: unknown): 'development' | 'staging' | 'production' {
  return environmentSchema.parse(environment);
}

export function validateScanRequest(request: unknown) {
  return scanRequestSchema.parse(request);
}

export function validateChatRequest(request: unknown) {
  return chatRequestSchema.parse(request);
}

export function validateRemediationRequest(request: unknown) {
  return remediationRequestSchema.parse(request);
}

export function validateReportRequest(request: unknown) {
  return reportRequestSchema.parse(request);
}

export function validateTenant(tenant: unknown) {
  return tenantSchema.parse(tenant);
}

export function validateFindingFilter(filter: unknown) {
  return findingFilterSchema.parse(filter);
}

export function validatePagination(pagination: unknown) {
  return paginationSchema.parse(pagination);
}

export function validateDateRange(range: unknown) {
  return dateRangeSchema.parse(range);
}

// Custom validation functions
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function isValidARN(arn: string): boolean {
  const arnRegex = /^arn:aws:[a-z0-9-]+:[a-z0-9-]*:[0-9]{12}:[a-zA-Z0-9-_./]+$/;
  return arnRegex.test(arn);
}

export function isValidAWSAccountId(accountId: string): boolean {
  return /^[0-9]{12}$/.test(accountId);
}

export function isValidAWSRegion(region: string): boolean {
  const validRegions = [
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'eu-west-1', 'eu-west-2', 'eu-central-1',
    'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1'
  ];
  return validRegions.includes(region);
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

export function isFutureDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date > new Date();
}

export function isPastDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date < new Date();
}

// Validation error types
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
  code?: string;
}

export function createValidationError(
  field: string,
  message: string,
  value?: unknown,
  code?: string
): ValidationError {
  return { field, message, value, code };
}

export function validateRequired(value: unknown, fieldName: string): void {
  if (value === null || value === undefined || value === '') {
    throw createValidationError(fieldName, `${fieldName} is required`);
  }
}

export function validateMinLength(value: string, minLength: number, fieldName: string): void {
  if (value.length < minLength) {
    throw createValidationError(
      fieldName,
      `${fieldName} must be at least ${minLength} characters long`
    );
  }
}

export function validateMaxLength(value: string, maxLength: number, fieldName: string): void {
  if (value.length > maxLength) {
    throw createValidationError(
      fieldName,
      `${fieldName} must be no more than ${maxLength} characters long`
    );
  }
}

export function validateMinValue(value: number, minValue: number, fieldName: string): void {
  if (value < minValue) {
    throw createValidationError(
      fieldName,
      `${fieldName} must be at least ${minValue}`
    );
  }
}

export function validateMaxValue(value: number, maxValue: number, fieldName: string): void {
  if (value > maxValue) {
    throw createValidationError(
      fieldName,
      `${fieldName} must be no more than ${maxValue}`
    );
  }
}
