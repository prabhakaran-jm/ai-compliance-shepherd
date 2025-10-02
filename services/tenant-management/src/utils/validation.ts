import { z } from 'zod';

/**
 * Validation schemas and utilities for Tenant Management
 */

// Contact details schema
const contactDetailsSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email format').max(255, 'Email too long'),
  phone: z.string().max(20, 'Phone number too long').optional(),
  title: z.string().max(100, 'Title too long').optional()
});

// Address schema
const addressSchema = z.object({
  street: z.string().min(1, 'Street is required').max(255, 'Street too long'),
  city: z.string().min(1, 'City is required').max(100, 'City too long'),
  state: z.string().min(1, 'State is required').max(100, 'State too long'),
  zipCode: z.string().min(1, 'Zip code is required').max(20, 'Zip code too long'),
  country: z.string().min(2, 'Country code required').max(2, 'Invalid country code')
});

// Contact info schema
const contactInfoSchema = z.object({
  primaryContact: contactDetailsSchema,
  technicalContact: contactDetailsSchema.optional(),
  billingContact: contactDetailsSchema.optional()
});

// Billing info schema
const billingInfoSchema = z.object({
  billingEmail: z.string().email('Invalid billing email format').max(255, 'Billing email too long'),
  paymentMethod: z.enum(['CREDIT_CARD', 'INVOICE', 'WIRE_TRANSFER']),
  billingAddress: addressSchema,
  taxId: z.string().max(50, 'Tax ID too long').optional(),
  purchaseOrderRequired: z.boolean().optional()
});

// Resource limits schema
const resourceLimitsSchema = z.object({
  maxFindings: z.number().min(1, 'Max findings must be at least 1').max(1000000, 'Max findings too high'),
  maxScanJobs: z.number().min(1, 'Max scan jobs must be at least 1').max(10000, 'Max scan jobs too high'),
  maxUsers: z.number().min(1, 'Max users must be at least 1').max(10000, 'Max users too high'),
  maxReports: z.number().min(1, 'Max reports must be at least 1').max(100000, 'Max reports too high')
});

// Features schema
const featuresSchema = z.object({
  automatedRemediation: z.boolean(),
  realTimeMonitoring: z.boolean(),
  customRules: z.boolean(),
  apiAccess: z.boolean(),
  ssoIntegration: z.boolean()
});

// Configuration schema
const configurationSchema = z.object({
  complianceFrameworks: z.array(z.string()).min(1, 'At least one compliance framework required'),
  scanSchedule: z.enum(['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']),
  retentionPeriodDays: z.number().min(1, 'Retention period must be at least 1 day').max(2555, 'Retention period too long'),
  encryptionEnabled: z.boolean(),
  auditLoggingEnabled: z.boolean(),
  crossAccountRoleEnabled: z.boolean(),
  allowedRegions: z.array(z.string()).min(1, 'At least one region required'),
  resourceLimits: resourceLimitsSchema.optional(),
  features: featuresSchema.optional()
});

// Tenant request schema
const tenantRequestSchema = z.object({
  name: z.string()
    .min(1, 'Tenant name is required')
    .max(100, 'Tenant name too long')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Tenant name contains invalid characters'),
  
  displayName: z.string()
    .max(200, 'Display name too long')
    .optional(),
  
  organizationId: z.string()
    .min(1, 'Organization ID is required')
    .max(100, 'Organization ID too long')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Organization ID contains invalid characters'),
  
  tier: z.enum(['BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE']).optional(),
  
  configuration: configurationSchema.optional(),
  
  contactInfo: contactInfoSchema.optional(),
  
  billingInfo: billingInfoSchema.optional(),
  
  createdBy: z.string()
    .max(255, 'Created by field too long')
    .optional()
});

// Tenant update request schema
const tenantUpdateRequestSchema = z.object({
  displayName: z.string()
    .max(200, 'Display name too long')
    .optional(),
  
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED', 'PENDING']).optional(),
  
  tier: z.enum(['BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE']).optional(),
  
  contactInfo: contactInfoSchema.partial().optional(),
  
  billingInfo: billingInfoSchema.partial().optional(),
  
  updatedBy: z.string()
    .max(255, 'Updated by field too long')
    .optional()
});

// Tenant configuration request schema
const tenantConfigRequestSchema = configurationSchema.partial();

// Tenant list request schema
const tenantListRequestSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED', 'PENDING']).optional(),
  
  tier: z.enum(['BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE']).optional(),
  
  limit: z.number()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .optional(),
  
  nextToken: z.string().optional()
});

// User request schema
const userRequestSchema = z.object({
  email: z.string().email('Invalid email format').max(255, 'Email too long'),
  
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  
  role: z.enum(['ADMIN', 'USER', 'VIEWER']),
  
  permissions: z.array(z.string()).optional()
});

// API key request schema
const apiKeyRequestSchema = z.object({
  name: z.string().min(1, 'API key name is required').max(100, 'API key name too long'),
  
  description: z.string().max(500, 'Description too long').optional(),
  
  permissions: z.array(z.string()).min(1, 'At least one permission required'),
  
  expiresAt: z.string().datetime('Invalid expiration date format').optional()
});

/**
 * Validation result interface
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Validate tenant request
 */
export function validateTenantRequest(body: string | null): ValidationResult<any> {
  try {
    if (!body) {
      return {
        success: false,
        errors: ['Request body is required']
      };
    }

    const parsed = JSON.parse(body);
    const result = tenantRequestSchema.safeParse(parsed);

    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      return {
        success: false,
        errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      };
    }
  } catch (error) {
    return {
      success: false,
      errors: ['Invalid JSON format']
    };
  }
}

/**
 * Validate tenant update request
 */
export function validateTenantUpdateRequest(body: string | null): ValidationResult<any> {
  try {
    if (!body) {
      return {
        success: false,
        errors: ['Request body is required']
      };
    }

    const parsed = JSON.parse(body);
    const result = tenantUpdateRequestSchema.safeParse(parsed);

    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      return {
        success: false,
        errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      };
    }
  } catch (error) {
    return {
      success: false,
      errors: ['Invalid JSON format']
    };
  }
}

/**
 * Validate tenant configuration request
 */
export function validateTenantConfigRequest(body: string | null): ValidationResult<any> {
  try {
    if (!body) {
      return {
        success: false,
        errors: ['Request body is required']
      };
    }

    const parsed = JSON.parse(body);
    const result = tenantConfigRequestSchema.safeParse(parsed);

    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      return {
        success: false,
        errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      };
    }
  } catch (error) {
    return {
      success: false,
      errors: ['Invalid JSON format']
    };
  }
}

/**
 * Validate tenant list request
 */
export function validateTenantListRequest(queryParams: any): ValidationResult<any> {
  const result = tenantListRequestSchema.safeParse(queryParams || {});

  if (result.success) {
    return {
      success: true,
      data: result.data
    };
  } else {
    return {
      success: false,
      errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
    };
  }
}

/**
 * Validate user request
 */
export function validateUserRequest(body: string | null): ValidationResult<any> {
  try {
    if (!body) {
      return {
        success: false,
        errors: ['Request body is required']
      };
    }

    const parsed = JSON.parse(body);
    const result = userRequestSchema.safeParse(parsed);

    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      return {
        success: false,
        errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      };
    }
  } catch (error) {
    return {
      success: false,
      errors: ['Invalid JSON format']
    };
  }
}

/**
 * Validate API key request
 */
export function validateApiKeyRequest(body: string | null): ValidationResult<any> {
  try {
    if (!body) {
      return {
        success: false,
        errors: ['Request body is required']
      };
    }

    const parsed = JSON.parse(body);
    const result = apiKeyRequestSchema.safeParse(parsed);

    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      return {
        success: false,
        errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      };
    }
  } catch (error) {
    return {
      success: false,
      errors: ['Invalid JSON format']
    };
  }
}

/**
 * Validate tenant ID
 */
export function validateTenantId(tenantId: string | null | undefined): ValidationResult<string> {
  if (!tenantId) {
    return {
      success: false,
      errors: ['Tenant ID is required']
    };
  }

  if (tenantId.length < 1 || tenantId.length > 100) {
    return {
      success: false,
      errors: ['Tenant ID must be between 1 and 100 characters']
    };
  }

  if (!/^[a-zA-Z0-9-_]+$/.test(tenantId)) {
    return {
      success: false,
      errors: ['Tenant ID contains invalid characters']
    };
  }

  return {
    success: true,
    data: tenantId
  };
}

/**
 * Validate organization ID
 */
export function validateOrganizationId(organizationId: string | null | undefined): ValidationResult<string> {
  if (!organizationId) {
    return {
      success: false,
      errors: ['Organization ID is required']
    };
  }

  if (organizationId.length < 1 || organizationId.length > 100) {
    return {
      success: false,
      errors: ['Organization ID must be between 1 and 100 characters']
    };
  }

  if (!/^[a-zA-Z0-9-_]+$/.test(organizationId)) {
    return {
      success: false,
      errors: ['Organization ID contains invalid characters']
    };
  }

  return {
    success: true,
    data: organizationId
  };
}

/**
 * Validate email address
 */
export function validateEmail(email: string | null | undefined): ValidationResult<string> {
  if (!email) {
    return {
      success: false,
      errors: ['Email is required']
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      success: false,
      errors: ['Invalid email format']
    };
  }

  if (email.length > 255) {
    return {
      success: false,
      errors: ['Email too long']
    };
  }

  return {
    success: true,
    data: email
  };
}

/**
 * Validate AWS region
 */
export function validateAwsRegion(region: string | null | undefined): ValidationResult<string> {
  if (!region) {
    return {
      success: false,
      errors: ['AWS region is required']
    };
  }

  // Basic AWS region format validation
  const regionRegex = /^[a-z]{2}-[a-z]+-\d{1}$/;
  if (!regionRegex.test(region)) {
    return {
      success: false,
      errors: ['Invalid AWS region format']
    };
  }

  return {
    success: true,
    data: region
  };
}

/**
 * Validate AWS ARN format
 */
export function validateAwsArn(arn: string | null | undefined): ValidationResult<string> {
  if (!arn) {
    return {
      success: false,
      errors: ['AWS ARN is required']
    };
  }

  const arnPattern = /^arn:aws:[a-zA-Z0-9-]+:[a-zA-Z0-9-]*:\d{12}:[a-zA-Z0-9-_/:*]+$/;
  
  if (!arnPattern.test(arn)) {
    return {
      success: false,
      errors: ['Invalid AWS ARN format']
    };
  }

  return {
    success: true,
    data: arn
  };
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(limit?: number, nextToken?: string): ValidationResult<{ limit: number; nextToken?: string }> {
  const validatedLimit = limit || 50;
  
  if (validatedLimit < 1 || validatedLimit > 100) {
    return {
      success: false,
      errors: ['Limit must be between 1 and 100']
    };
  }

  return {
    success: true,
    data: {
      limit: validatedLimit,
      nextToken
    }
  };
}

/**
 * Validate date range
 */
export function validateDateRange(startDate?: string, endDate?: string): ValidationResult<{ startDate?: Date; endDate?: Date }> {
  let start: Date | undefined;
  let end: Date | undefined;

  if (startDate) {
    start = new Date(startDate);
    if (isNaN(start.getTime())) {
      return {
        success: false,
        errors: ['Invalid start date format']
      };
    }
  }

  if (endDate) {
    end = new Date(endDate);
    if (isNaN(end.getTime())) {
      return {
        success: false,
        errors: ['Invalid end date format']
      };
    }
  }

  if (start && end && end <= start) {
    return {
      success: false,
      errors: ['End date must be after start date']
    };
  }

  return {
    success: true,
    data: { startDate: start, endDate: end }
  };
}

/**
 * Sanitize input string
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>\"'&]/g, '') // Remove potentially dangerous characters
    .substring(0, 1000); // Limit length
}

/**
 * Validate compliance framework
 */
export function validateComplianceFramework(framework: string): ValidationResult<string> {
  const validFrameworks = ['SOC2', 'HIPAA', 'GDPR', 'PCI-DSS', 'ISO27001', 'NIST', 'CIS'];
  
  if (!validFrameworks.includes(framework.toUpperCase())) {
    return {
      success: false,
      errors: [`Invalid compliance framework. Must be one of: ${validFrameworks.join(', ')}`]
    };
  }

  return {
    success: true,
    data: framework.toUpperCase()
  };
}

/**
 * Validate resource limits
 */
export function validateResourceLimits(limits: any): ValidationResult<any> {
  const result = resourceLimitsSchema.safeParse(limits);

  if (result.success) {
    return {
      success: true,
      data: result.data
    };
  } else {
    return {
      success: false,
      errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
    };
  }
}

/**
 * Validate tenant tier
 */
export function validateTenantTier(tier: string): ValidationResult<string> {
  const validTiers = ['BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE'];
  
  if (!validTiers.includes(tier.toUpperCase())) {
    return {
      success: false,
      errors: [`Invalid tenant tier. Must be one of: ${validTiers.join(', ')}`]
    };
  }

  return {
    success: true,
    data: tier.toUpperCase()
  };
}
