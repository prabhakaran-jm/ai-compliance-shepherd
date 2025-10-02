import { z } from 'zod';
import { ValidationResult, AuditPackRequest, AuditPackListRequest } from '../types/auditPack';

/**
 * Validation schemas and utilities for audit pack generator
 */

// Base schemas
const DateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime()
}).refine(
  (data) => new Date(data.startDate) < new Date(data.endDate),
  {
    message: "Start date must be before end date",
    path: ["dateRange"]
  }
);

const AuditPackConfigurationSchema = z.object({
  includePolicies: z.boolean().optional().default(true),
  includeFindings: z.boolean().optional().default(true),
  includeRemediation: z.boolean().optional().default(true),
  includeEvidence: z.boolean().optional().default(true),
  includeMetrics: z.boolean().optional().default(true),
  dateRange: DateRangeSchema.optional(),
  format: z.enum(['PDF', 'HTML', 'ZIP', 'JSON']).optional().default('PDF'),
  customSections: z.array(z.string()).optional().default([])
});

const AuditPackRequestSchema = z.object({
  tenantId: z.string().min(1, "Tenant ID is required").regex(
    /^tenant-[a-z0-9-]+$/,
    "Tenant ID must start with 'tenant-' and contain only lowercase letters, numbers, and hyphens"
  ),
  framework: z.enum(['SOC2', 'HIPAA', 'GDPR', 'PCI-DSS', 'ISO27001'], {
    errorMap: () => ({ message: "Framework must be one of: SOC2, HIPAA, GDPR, PCI-DSS, ISO27001" })
  }),
  auditType: z.enum(['ANNUAL', 'QUARTERLY', 'MONTHLY', 'AD_HOC'], {
    errorMap: () => ({ message: "Audit type must be one of: ANNUAL, QUARTERLY, MONTHLY, AD_HOC" })
  }),
  requestedBy: z.string().email("Invalid email format").optional(),
  configuration: AuditPackConfigurationSchema.optional()
});

const AuditPackListRequestSchema = z.object({
  tenantId: z.string().regex(
    /^tenant-[a-z0-9-]+$/,
    "Tenant ID must start with 'tenant-' and contain only lowercase letters, numbers, and hyphens"
  ).optional(),
  framework: z.enum(['SOC2', 'HIPAA', 'GDPR', 'PCI-DSS', 'ISO27001']).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED']).optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  nextToken: z.string().optional()
});

/**
 * Validate audit pack request
 */
export function validateAuditPackRequest(body: string | null): ValidationResult<AuditPackRequest> {
  try {
    if (!body) {
      return {
        success: false,
        errors: ['Request body is required']
      };
    }

    let parsedBody: any;
    try {
      parsedBody = JSON.parse(body);
    } catch (error) {
      return {
        success: false,
        errors: ['Invalid JSON in request body']
      };
    }

    const result = AuditPackRequestSchema.safeParse(parsedBody);
    
    if (!result.success) {
      const errors = result.error.errors.map(err => {
        const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
        return `${path}${err.message}`;
      });

      return {
        success: false,
        errors
      };
    }

    // Additional business logic validation
    const validationErrors = validateBusinessRules(result.data);
    if (validationErrors.length > 0) {
      return {
        success: false,
        errors: validationErrors
      };
    }

    return {
      success: true,
      data: result.data
    };

  } catch (error) {
    return {
      success: false,
      errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * Validate audit pack list request
 */
export function validateAuditPackListRequest(params: any): ValidationResult<AuditPackListRequest> {
  try {
    const result = AuditPackListRequestSchema.safeParse(params);
    
    if (!result.success) {
      const errors = result.error.errors.map(err => {
        const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
        return `${path}${err.message}`;
      });

      return {
        success: false,
        errors
      };
    }

    return {
      success: true,
      data: result.data
    };

  } catch (error) {
    return {
      success: false,
      errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * Validate business rules
 */
function validateBusinessRules(request: AuditPackRequest): string[] {
  const errors: string[] = [];

  // Validate date range if provided
  if (request.configuration?.dateRange) {
    const { startDate, endDate } = request.configuration.dateRange;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    // Check if dates are not in the future
    if (start > now) {
      errors.push('Start date cannot be in the future');
    }

    if (end > now) {
      errors.push('End date cannot be in the future');
    }

    // Check date range limits
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 365) {
      errors.push('Date range cannot exceed 365 days');
    }

    if (daysDiff < 1) {
      errors.push('Date range must be at least 1 day');
    }
  }

  // Validate framework-specific rules
  if (request.framework === 'SOC2' && request.auditType === 'MONTHLY') {
    errors.push('SOC2 audits are typically performed annually or quarterly, not monthly');
  }

  if (request.framework === 'PCI-DSS' && request.auditType === 'AD_HOC') {
    errors.push('PCI-DSS audits should follow scheduled assessment cycles');
  }

  // Validate configuration combinations
  if (request.configuration) {
    const config = request.configuration;
    
    // If no content types are selected, that's invalid
    if (!config.includePolicies && 
        !config.includeFindings && 
        !config.includeRemediation && 
        !config.includeEvidence && 
        !config.includeMetrics) {
      errors.push('At least one content type must be included in the audit pack');
    }

    // Validate custom sections
    if (config.customSections && config.customSections.length > 0) {
      const validSections = [
        'executive-summary',
        'technical-details',
        'risk-assessment',
        'compliance-matrix',
        'remediation-plan',
        'appendices'
      ];

      for (const section of config.customSections) {
        if (!validSections.includes(section)) {
          errors.push(`Invalid custom section: ${section}. Valid sections are: ${validSections.join(', ')}`);
        }
      }

      // Check for duplicates
      const uniqueSections = new Set(config.customSections);
      if (uniqueSections.size !== config.customSections.length) {
        errors.push('Custom sections cannot contain duplicates');
      }
    }
  }

  return errors;
}

/**
 * Validate tenant ID format and permissions
 */
export function validateTenantId(tenantId: string): ValidationResult<string> {
  const schema = z.string().regex(
    /^tenant-[a-z0-9-]+$/,
    "Tenant ID must start with 'tenant-' and contain only lowercase letters, numbers, and hyphens"
  );

  const result = schema.safeParse(tenantId);
  
  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map(err => err.message)
    };
  }

  // Additional tenant validation (in real implementation, check against database)
  if (tenantId.length > 50) {
    return {
      success: false,
      errors: ['Tenant ID cannot exceed 50 characters']
    };
  }

  return {
    success: true,
    data: result.data
  };
}

/**
 * Validate audit pack ID format
 */
export function validateAuditPackId(auditPackId: string): ValidationResult<string> {
  const schema = z.string().uuid('Invalid audit pack ID format');
  
  const result = schema.safeParse(auditPackId);
  
  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map(err => err.message)
    };
  }

  return {
    success: true,
    data: result.data
  };
}

/**
 * Validate framework support
 */
export function validateFrameworkSupport(framework: string, tenantTier?: string): ValidationResult<string> {
  const supportedFrameworks = ['SOC2', 'HIPAA', 'GDPR', 'PCI-DSS', 'ISO27001'];
  
  if (!supportedFrameworks.includes(framework)) {
    return {
      success: false,
      errors: [`Unsupported framework: ${framework}. Supported frameworks: ${supportedFrameworks.join(', ')}`]
    };
  }

  // Check tier-based framework access (mock implementation)
  const tierRestrictions: Record<string, string[]> = {
    'BASIC': ['SOC2'],
    'STANDARD': ['SOC2', 'HIPAA'],
    'PREMIUM': ['SOC2', 'HIPAA', 'GDPR'],
    'ENTERPRISE': ['SOC2', 'HIPAA', 'GDPR', 'PCI-DSS', 'ISO27001']
  };

  if (tenantTier && tierRestrictions[tenantTier]) {
    if (!tierRestrictions[tenantTier].includes(framework)) {
      return {
        success: false,
        errors: [`Framework ${framework} is not available for ${tenantTier} tier. Available frameworks: ${tierRestrictions[tenantTier].join(', ')}`]
      };
    }
  }

  return {
    success: true,
    data: framework
  };
}

/**
 * Validate file format support
 */
export function validateFileFormat(format: string): ValidationResult<string> {
  const supportedFormats = ['PDF', 'HTML', 'ZIP', 'JSON'];
  
  if (!supportedFormats.includes(format)) {
    return {
      success: false,
      errors: [`Unsupported format: ${format}. Supported formats: ${supportedFormats.join(', ')}`]
    };
  }

  return {
    success: true,
    data: format
  };
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(limit?: number, nextToken?: string): ValidationResult<{ limit: number; nextToken?: string }> {
  const errors: string[] = [];

  // Validate limit
  if (limit !== undefined) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      errors.push('Limit must be an integer between 1 and 100');
    }
  }

  // Validate nextToken format (in real implementation, this would be more sophisticated)
  if (nextToken !== undefined) {
    if (typeof nextToken !== 'string' || nextToken.length === 0) {
      errors.push('Next token must be a non-empty string');
    }
    
    // Basic format validation (in real implementation, decode and validate token)
    if (nextToken.length > 1000) {
      errors.push('Next token is invalid or corrupted');
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
      limit: limit || 50,
      nextToken
    }
  };
}

/**
 * Sanitize input strings
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult<string> {
  const schema = z.string().email('Invalid email format');
  
  const result = schema.safeParse(email);
  
  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map(err => err.message)
    };
  }

  // Additional email validation
  if (email.length > 254) {
    return {
      success: false,
      errors: ['Email address is too long']
    };
  }

  return {
    success: true,
    data: result.data
  };
}

/**
 * Validate date string
 */
export function validateDateString(dateString: string, fieldName: string = 'date'): ValidationResult<string> {
  const schema = z.string().datetime(`Invalid ${fieldName} format. Expected ISO 8601 datetime string.`);
  
  const result = schema.safeParse(dateString);
  
  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map(err => err.message)
    };
  }

  // Additional date validation
  const date = new Date(dateString);
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  if (date < oneYearAgo) {
    return {
      success: false,
      errors: [`${fieldName} cannot be more than one year in the past`]
    };
  }

  if (date > oneYearFromNow) {
    return {
      success: false,
      errors: [`${fieldName} cannot be more than one year in the future`]
    };
  }

  return {
    success: true,
    data: result.data
  };
}

/**
 * Validate array of strings
 */
export function validateStringArray(
  array: unknown, 
  fieldName: string, 
  maxItems: number = 100, 
  maxItemLength: number = 100
): ValidationResult<string[]> {
  if (!Array.isArray(array)) {
    return {
      success: false,
      errors: [`${fieldName} must be an array`]
    };
  }

  if (array.length > maxItems) {
    return {
      success: false,
      errors: [`${fieldName} cannot contain more than ${maxItems} items`]
    };
  }

  const errors: string[] = [];
  const validatedItems: string[] = [];

  for (let i = 0; i < array.length; i++) {
    const item = array[i];
    
    if (typeof item !== 'string') {
      errors.push(`${fieldName}[${i}] must be a string`);
      continue;
    }

    if (item.length === 0) {
      errors.push(`${fieldName}[${i}] cannot be empty`);
      continue;
    }

    if (item.length > maxItemLength) {
      errors.push(`${fieldName}[${i}] cannot exceed ${maxItemLength} characters`);
      continue;
    }

    validatedItems.push(sanitizeString(item, maxItemLength));
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors
    };
  }

  return {
    success: true,
    data: validatedItems
  };
}

/**
 * Validate JSON object structure
 */
export function validateJsonObject(
  obj: unknown, 
  fieldName: string, 
  maxDepth: number = 5,
  maxKeys: number = 50
): ValidationResult<Record<string, any>> {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return {
      success: false,
      errors: [`${fieldName} must be a valid object`]
    };
  }

  const errors: string[] = [];
  
  // Check depth and key count
  try {
    const depth = getObjectDepth(obj);
    if (depth > maxDepth) {
      errors.push(`${fieldName} object depth cannot exceed ${maxDepth} levels`);
    }

    const keyCount = getObjectKeyCount(obj);
    if (keyCount > maxKeys) {
      errors.push(`${fieldName} cannot contain more than ${maxKeys} keys`);
    }
  } catch (error) {
    errors.push(`${fieldName} contains invalid structure`);
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors
    };
  }

  return {
    success: true,
    data: obj as Record<string, any>
  };
}

/**
 * Helper function to calculate object depth
 */
function getObjectDepth(obj: any, currentDepth: number = 0): number {
  if (currentDepth > 10) { // Prevent infinite recursion
    throw new Error('Object too deep');
  }

  if (typeof obj !== 'object' || obj === null) {
    return currentDepth;
  }

  if (Array.isArray(obj)) {
    return Math.max(currentDepth, ...obj.map(item => getObjectDepth(item, currentDepth + 1)));
  }

  const depths = Object.values(obj).map(value => getObjectDepth(value, currentDepth + 1));
  return Math.max(currentDepth, ...depths);
}

/**
 * Helper function to count object keys recursively
 */
function getObjectKeyCount(obj: any, visited: Set<any> = new Set()): number {
  if (visited.has(obj) || typeof obj !== 'object' || obj === null) {
    return 0;
  }

  visited.add(obj);
  let count = 0;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      count += getObjectKeyCount(item, visited);
    }
  } else {
    count += Object.keys(obj).length;
    for (const value of Object.values(obj)) {
      count += getObjectKeyCount(value, visited);
    }
  }

  return count;
}
