/**
 * Validation utility for scan environment Lambda
 */

import { ScanRequest, ScanType, Region, ComplianceFramework } from '@compliance-shepherd/shared';
import { ValidationError, validateRequiredFields, validateFieldTypes, validateArrayFields, validateEnumFields } from './errorHandler';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateScanRequest(scanRequest: ScanRequest): ValidationResult {
  const errors: string[] = [];

  try {
    // Validate required fields
    validateRequiredFields(scanRequest, [
      'tenantId',
      'accountId',
      'regions'
    ]);

    // Validate field types
    validateFieldTypes(scanRequest, {
      tenantId: 'string',
      accountId: 'string',
      scanType: 'string',
      requestedBy: 'string'
    });

    // Validate array fields
    validateArrayFields(scanRequest, [
      'regions',
      'services',
      'frameworks'
    });

    // Validate enum fields
    validateEnumFields(scanRequest, {
      scanType: ['full_environment', 'incremental', 'service_specific', 'rule_specific', 'resource_specific', 'scheduled']
    });

    // Validate tenant ID format
    if (scanRequest.tenantId && !isValidTenantId(scanRequest.tenantId)) {
      errors.push('Invalid tenant ID format');
    }

    // Validate AWS account ID format
    if (scanRequest.accountId && !isValidAWSAccountId(scanRequest.accountId)) {
      errors.push('Invalid AWS account ID format');
    }

    // Validate regions
    if (scanRequest.regions && scanRequest.regions.length > 0) {
      const validRegions = getValidRegions();
      const invalidRegions = scanRequest.regions.filter(region => !validRegions.includes(region));
      if (invalidRegions.length > 0) {
        errors.push(`Invalid regions: ${invalidRegions.join(', ')}`);
      }
    }

    // Validate services
    if (scanRequest.services && scanRequest.services.length > 0) {
      const validServices = getValidServices();
      const invalidServices = scanRequest.services.filter(service => !validServices.includes(service));
      if (invalidServices.length > 0) {
        errors.push(`Invalid services: ${invalidServices.join(', ')}`);
      }
    }

    // Validate frameworks
    if (scanRequest.frameworks && scanRequest.frameworks.length > 0) {
      const validFrameworks = getValidFrameworks();
      const invalidFrameworks = scanRequest.frameworks.filter(framework => !validFrameworks.includes(framework));
      if (invalidFrameworks.length > 0) {
        errors.push(`Invalid frameworks: ${invalidFrameworks.join(', ')}`);
      }
    }

    // Validate scan settings
    if (scanRequest.settings) {
      const settingsErrors = validateScanSettings(scanRequest.settings);
      errors.push(...settingsErrors);
    }

    // Validate metadata
    if (scanRequest.metadata) {
      const metadataErrors = validateMetadata(scanRequest.metadata);
      errors.push(...metadataErrors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };

  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        isValid: false,
        errors: [error.message]
      };
    }
    
    return {
      isValid: false,
      errors: ['Validation failed']
    };
  }
}

function validateScanSettings(settings: any): string[] {
  const errors: string[] = [];

  // Validate scan schedule
  if (settings.scanSchedule) {
    if (settings.scanSchedule.enabled && typeof settings.scanSchedule.enabled !== 'boolean') {
      errors.push('scanSchedule.enabled must be a boolean');
    }
    
    if (settings.scanSchedule.frequency && !['hourly', 'daily', 'weekly', 'monthly'].includes(settings.scanSchedule.frequency)) {
      errors.push('scanSchedule.frequency must be one of: hourly, daily, weekly, monthly');
    }
  }

  // Validate auto remediation
  if (settings.autoRemediation) {
    if (settings.autoRemediation.enabled && typeof settings.autoRemediation.enabled !== 'boolean') {
      errors.push('autoRemediation.enabled must be a boolean');
    }
    
    if (settings.autoRemediation.riskLevel && !['low', 'medium', 'high', 'critical'].includes(settings.autoRemediation.riskLevel)) {
      errors.push('autoRemediation.riskLevel must be one of: low, medium, high, critical');
    }
  }

  // Validate notifications
  if (settings.notifications) {
    if (settings.notifications.email && typeof settings.notifications.email !== 'object') {
      errors.push('notifications.email must be an object');
    }
    
    if (settings.notifications.slack && typeof settings.notifications.slack !== 'object') {
      errors.push('notifications.slack must be an object');
    }
  }

  return errors;
}

function validateMetadata(metadata: any): string[] {
  const errors: string[] = [];

  // Validate source
  if (metadata.source && typeof metadata.source !== 'string') {
    errors.push('metadata.source must be a string');
  }

  // Validate tags
  if (metadata.tags && !Array.isArray(metadata.tags)) {
    errors.push('metadata.tags must be an array');
  }

  // Validate custom fields
  if (metadata.customFields && typeof metadata.customFields !== 'object') {
    errors.push('metadata.customFields must be an object');
  }

  return errors;
}

function isValidTenantId(tenantId: string): boolean {
  // Tenant ID should be alphanumeric with hyphens, 3-50 characters
  const tenantIdRegex = /^[a-zA-Z0-9-]{3,50}$/;
  return tenantIdRegex.test(tenantId);
}

function isValidAWSAccountId(accountId: string): boolean {
  // AWS account ID should be 12 digits
  const accountIdRegex = /^\d{12}$/;
  return accountIdRegex.test(accountId);
}

function getValidRegions(): Region[] {
  return [
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
    'eu-west-1',
    'eu-west-2',
    'eu-west-3',
    'eu-central-1',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-northeast-1',
    'ap-northeast-2',
    'ca-central-1',
    'sa-east-1'
  ];
}

function getValidServices(): string[] {
  return [
    's3',
    'iam',
    'ec2',
    'cloudtrail',
    'kms',
    'rds',
    'lambda'
  ];
}

function getValidFrameworks(): ComplianceFramework[] {
  return [
    'SOC2',
    'HIPAA',
    'GDPR',
    'PCI',
    'ISO27001',
    'NIST'
  ];
}

export function validateScanId(scanId: string): boolean {
  // Scan ID should be a UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(scanId);
}

export function validateTenantId(tenantId: string): boolean {
  return isValidTenantId(tenantId);
}

export function validateAccountId(accountId: string): boolean {
  return isValidAWSAccountId(accountId);
}

export function validateRegion(region: string): boolean {
  return getValidRegions().includes(region as Region);
}

export function validateService(service: string): boolean {
  return getValidServices().includes(service);
}

export function validateFramework(framework: string): boolean {
  return getValidFrameworks().includes(framework as ComplianceFramework);
}
