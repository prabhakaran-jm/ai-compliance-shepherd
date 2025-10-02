import { z } from 'zod';
import { logger } from './logger';

/**
 * Validation schemas for apply-fix service
 */
const RemediationRequestSchema = z.object({
  findingId: z.string().min(1, 'Finding ID is required'),
  remediationType: z.string().min(1, 'Remediation type is required'),
  resourceId: z.string().min(1, 'Resource ID is required'),
  resourceType: z.enum([
    'S3_BUCKET',
    'IAM_ROLE',
    'IAM_USER',
    'IAM_POLICY',
    'SECURITY_GROUP',
    'CLOUDTRAIL',
    'KMS_KEY',
    'RDS_INSTANCE',
    'RDS_CLUSTER',
    'LAMBDA_FUNCTION',
    'EC2_INSTANCE',
    'VPC',
    'SUBNET'
  ]),
  region: z.string().min(1, 'Region is required'),
  accountId: z.string().regex(/^\d{12}$/, 'Account ID must be 12 digits'),
  tenantId: z.string().min(1, 'Tenant ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  autoApprove: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  parameters: z.record(z.any()).optional()
});

const ApprovalRequestSchema = z.object({
  remediationId: z.string().uuid('Invalid remediation ID format'),
  approver: z.string().min(1, 'Approver is required'),
  approved: z.boolean(),
  reason: z.string().optional(),
  conditions: z.array(z.string()).optional()
});

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Validate remediation request
 */
export function validateRemediationRequest(body: string | null): ValidationResult<any> {
  if (!body) {
    return {
      success: false,
      errors: ['Request body is required']
    };
  }

  try {
    const data = JSON.parse(body);
    const validation = RemediationRequestSchema.safeParse(data);

    if (!validation.success) {
      const errors = validation.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      );
      return {
        success: false,
        errors
      };
    }

    // Additional business logic validation
    const businessValidation = validateBusinessRules(validation.data);
    if (!businessValidation.success) {
      return businessValidation;
    }

    return {
      success: true,
      data: validation.data
    };

  } catch (error) {
    return {
      success: false,
      errors: ['Invalid JSON format']
    };
  }
}

/**
 * Validate approval request
 */
export function validateApprovalRequest(body: string | null): ValidationResult<any> {
  if (!body) {
    return {
      success: false,
      errors: ['Request body is required']
    };
  }

  try {
    const data = JSON.parse(body);
    const validation = ApprovalRequestSchema.safeParse(data);

    if (!validation.success) {
      const errors = validation.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      );
      return {
        success: false,
        errors
      };
    }

    return {
      success: true,
      data: validation.data
    };

  } catch (error) {
    return {
      success: false,
      errors: ['Invalid JSON format']
    };
  }
}

/**
 * Validate business rules for remediation requests
 */
function validateBusinessRules(data: any): ValidationResult<any> {
  const errors: string[] = [];

  // Validate remediation type for resource type
  const validRemediationTypes = getValidRemediationTypes(data.resourceType);
  if (!validRemediationTypes.includes(data.remediationType)) {
    errors.push(`Remediation type '${data.remediationType}' is not valid for resource type '${data.resourceType}'`);
  }

  // Validate region format
  if (!isValidAWSRegion(data.region)) {
    errors.push(`Invalid AWS region format: ${data.region}`);
  }

  // Validate resource ID format based on resource type
  const resourceIdValidation = validateResourceId(data.resourceId, data.resourceType);
  if (!resourceIdValidation.valid) {
    errors.push(resourceIdValidation.error!);
  }

  // Validate parameters for specific remediation types
  const parameterValidation = validateRemediationParameters(data.remediationType, data.parameters);
  if (!parameterValidation.valid) {
    errors.push(parameterValidation.error!);
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors
    };
  }

  return {
    success: true,
    data
  };
}

/**
 * Get valid remediation types for a resource type
 */
function getValidRemediationTypes(resourceType: string): string[] {
  const remediationTypeMap: Record<string, string[]> = {
    'S3_BUCKET': [
      'ENABLE_BUCKET_ENCRYPTION',
      'ENABLE_BUCKET_VERSIONING',
      'BLOCK_PUBLIC_ACCESS',
      'ENABLE_ACCESS_LOGGING',
      'CONFIGURE_LIFECYCLE_POLICY'
    ],
    'IAM_ROLE': [
      'ATTACH_SECURITY_POLICY',
      'CREATE_LEAST_PRIVILEGE_POLICY',
      'REMOVE_UNUSED_PERMISSIONS',
      'ENABLE_MFA_REQUIREMENT'
    ],
    'IAM_USER': [
      'ATTACH_SECURITY_POLICY',
      'ENABLE_MFA',
      'ROTATE_ACCESS_KEYS',
      'REMOVE_UNUSED_PERMISSIONS'
    ],
    'IAM_POLICY': [
      'RESTRICT_PERMISSIONS',
      'ADD_CONDITION_STATEMENTS',
      'REMOVE_WILDCARD_PERMISSIONS'
    ],
    'SECURITY_GROUP': [
      'REMOVE_OVERLY_PERMISSIVE_RULE',
      'RESTRICT_SSH_ACCESS',
      'RESTRICT_RDP_ACCESS',
      'ADD_EGRESS_RESTRICTIONS'
    ],
    'CLOUDTRAIL': [
      'ENABLE_LOG_FILE_VALIDATION',
      'ENABLE_MANAGEMENT_EVENTS',
      'CONFIGURE_DATA_EVENTS',
      'ENABLE_ENCRYPTION'
    ],
    'KMS_KEY': [
      'ENABLE_KEY_ROTATION',
      'UPDATE_KEY_POLICY',
      'ENABLE_KEY_DELETION_PROTECTION'
    ],
    'RDS_INSTANCE': [
      'ENABLE_ENCRYPTION',
      'ENABLE_BACKUP_RETENTION',
      'ENABLE_MULTI_AZ',
      'CONFIGURE_SECURITY_GROUP'
    ],
    'RDS_CLUSTER': [
      'ENABLE_ENCRYPTION',
      'ENABLE_BACKUP_RETENTION',
      'CONFIGURE_SECURITY_GROUP'
    ],
    'LAMBDA_FUNCTION': [
      'ENABLE_VPC_CONFIGURATION',
      'UPDATE_RUNTIME_VERSION',
      'CONFIGURE_ENVIRONMENT_ENCRYPTION',
      'ENABLE_DEAD_LETTER_QUEUE'
    ]
  };

  return remediationTypeMap[resourceType] || [];
}

/**
 * Validate AWS region format
 */
function isValidAWSRegion(region: string): boolean {
  const regionPattern = /^[a-z]{2}-[a-z]+-\d{1}$/;
  return regionPattern.test(region);
}

/**
 * Validate resource ID format based on resource type
 */
function validateResourceId(resourceId: string, resourceType: string): { valid: boolean; error?: string } {
  switch (resourceType) {
    case 'S3_BUCKET':
      if (!/^[a-z0-9.-]{3,63}$/.test(resourceId)) {
        return {
          valid: false,
          error: 'S3 bucket name must be 3-63 characters long and contain only lowercase letters, numbers, dots, and hyphens'
        };
      }
      break;

    case 'IAM_ROLE':
    case 'IAM_USER':
      if (!/^[\w+=,.@-]{1,64}$/.test(resourceId)) {
        return {
          valid: false,
          error: 'IAM resource name must be 1-64 characters long and contain only alphanumeric characters and +=,.@-'
        };
      }
      break;

    case 'SECURITY_GROUP':
      if (!/^sg-[a-f0-9]{8,17}$/.test(resourceId)) {
        return {
          valid: false,
          error: 'Security group ID must start with "sg-" followed by 8-17 hexadecimal characters'
        };
      }
      break;

    case 'KMS_KEY':
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(resourceId) &&
          !/^arn:aws:kms:/.test(resourceId)) {
        return {
          valid: false,
          error: 'KMS key must be a UUID or ARN format'
        };
      }
      break;

    case 'RDS_INSTANCE':
    case 'RDS_CLUSTER':
      if (!/^[a-zA-Z][a-zA-Z0-9-]{0,62}$/.test(resourceId)) {
        return {
          valid: false,
          error: 'RDS identifier must start with a letter and be 1-63 characters long'
        };
      }
      break;

    case 'LAMBDA_FUNCTION':
      if (!/^[a-zA-Z0-9-_]{1,64}$/.test(resourceId) && !/^arn:aws:lambda:/.test(resourceId)) {
        return {
          valid: false,
          error: 'Lambda function name must be 1-64 characters or a valid ARN'
        };
      }
      break;
  }

  return { valid: true };
}

/**
 * Validate remediation parameters
 */
function validateRemediationParameters(
  remediationType: string,
  parameters?: Record<string, any>
): { valid: boolean; error?: string } {
  switch (remediationType) {
    case 'ATTACH_SECURITY_POLICY':
      if (!parameters?.policyArn) {
        return {
          valid: false,
          error: 'Policy ARN is required for ATTACH_SECURITY_POLICY'
        };
      }
      if (!/^arn:aws:iam::\d{12}:policy\//.test(parameters.policyArn)) {
        return {
          valid: false,
          error: 'Invalid policy ARN format'
        };
      }
      break;

    case 'CREATE_LEAST_PRIVILEGE_POLICY':
      if (!parameters?.policyDocument) {
        return {
          valid: false,
          error: 'Policy document is required for CREATE_LEAST_PRIVILEGE_POLICY'
        };
      }
      try {
        if (typeof parameters.policyDocument === 'string') {
          JSON.parse(parameters.policyDocument);
        }
      } catch (error) {
        return {
          valid: false,
          error: 'Policy document must be valid JSON'
        };
      }
      break;

    case 'REMOVE_OVERLY_PERMISSIVE_RULE':
      if (!parameters?.rule) {
        return {
          valid: false,
          error: 'Rule details are required for REMOVE_OVERLY_PERMISSIVE_RULE'
        };
      }
      break;

    case 'RESTRICT_SSH_ACCESS':
      if (parameters?.allowedCidr && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(parameters.allowedCidr)) {
        return {
          valid: false,
          error: 'Invalid CIDR format for allowedCidr parameter'
        };
      }
      break;

    case 'ENABLE_BACKUP_RETENTION':
      if (parameters?.retentionPeriod && (parameters.retentionPeriod < 1 || parameters.retentionPeriod > 35)) {
        return {
          valid: false,
          error: 'Backup retention period must be between 1 and 35 days'
        };
      }
      break;

    case 'ENABLE_VPC_CONFIGURATION':
      if (!parameters?.vpcConfig) {
        return {
          valid: false,
          error: 'VPC configuration is required for ENABLE_VPC_CONFIGURATION'
        };
      }
      if (!parameters.vpcConfig.SubnetIds || !Array.isArray(parameters.vpcConfig.SubnetIds)) {
        return {
          valid: false,
          error: 'VPC configuration must include SubnetIds array'
        };
      }
      if (!parameters.vpcConfig.SecurityGroupIds || !Array.isArray(parameters.vpcConfig.SecurityGroupIds)) {
        return {
          valid: false,
          error: 'VPC configuration must include SecurityGroupIds array'
        };
      }
      break;
  }

  return { valid: true };
}

/**
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/['"]/g, '') // Remove quotes
    .trim();
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate AWS ARN format
 */
export function isValidARN(arn: string): boolean {
  const arnRegex = /^arn:aws:[a-zA-Z0-9-]+:[a-zA-Z0-9-]*:\d{12}:.+$/;
  return arnRegex.test(arn);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate remediation ID format (UUID)
 */
export function validateRemediationId(remediationId: string): ValidationResult<string> {
  if (!remediationId) {
    return {
      success: false,
      errors: ['Remediation ID is required']
    };
  }

  if (!isValidUUID(remediationId)) {
    return {
      success: false,
      errors: ['Invalid remediation ID format - must be a valid UUID']
    };
  }

  return {
    success: true,
    data: remediationId
  };
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(
  limit?: string,
  offset?: string
): ValidationResult<{ limit: number; offset: number }> {
  const errors: string[] = [];
  let parsedLimit = 50; // Default limit
  let parsedOffset = 0; // Default offset

  if (limit) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      errors.push('Limit must be a number between 1 and 1000');
    } else {
      parsedLimit = limitNum;
    }
  }

  if (offset) {
    const offsetNum = parseInt(offset, 10);
    if (isNaN(offsetNum) || offsetNum < 0) {
      errors.push('Offset must be a non-negative number');
    } else {
      parsedOffset = offsetNum;
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors
    };
  }

  return {
    success: true,
    data: {
      limit: parsedLimit,
      offset: parsedOffset
    }
  };
}

/**
 * Validate filter parameters
 */
export function validateFilterParams(filters: Record<string, string>): ValidationResult<Record<string, any>> {
  const validFilters = [
    'status',
    'resourceType',
    'remediationType',
    'riskLevel',
    'region',
    'accountId',
    'tenantId',
    'userId',
    'dateFrom',
    'dateTo'
  ];

  const errors: string[] = [];
  const validatedFilters: Record<string, any> = {};

  for (const [key, value] of Object.entries(filters)) {
    if (!validFilters.includes(key)) {
      errors.push(`Invalid filter parameter: ${key}`);
      continue;
    }

    // Validate specific filter values
    switch (key) {
      case 'status':
        if (!['PENDING', 'PENDING_APPROVAL', 'APPROVED', 'APPLIED', 'FAILED', 'ROLLED_BACK'].includes(value)) {
          errors.push(`Invalid status value: ${value}`);
        } else {
          validatedFilters[key] = value;
        }
        break;

      case 'riskLevel':
        if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(value)) {
          errors.push(`Invalid risk level value: ${value}`);
        } else {
          validatedFilters[key] = value;
        }
        break;

      case 'region':
        if (!isValidAWSRegion(value)) {
          errors.push(`Invalid AWS region: ${value}`);
        } else {
          validatedFilters[key] = value;
        }
        break;

      case 'accountId':
        if (!/^\d{12}$/.test(value)) {
          errors.push(`Invalid account ID: ${value}`);
        } else {
          validatedFilters[key] = value;
        }
        break;

      case 'dateFrom':
      case 'dateTo':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          errors.push(`Invalid date format for ${key}: ${value}`);
        } else {
          validatedFilters[key] = date.toISOString();
        }
        break;

      default:
        validatedFilters[key] = sanitizeInput(value);
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors
    };
  }

  return {
    success: true,
    data: validatedFilters
  };
}
