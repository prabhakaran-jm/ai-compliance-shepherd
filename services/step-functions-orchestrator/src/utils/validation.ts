import { z } from 'zod';
import { WorkflowValidationError } from './errorHandler';

/**
 * Validation schemas for workflow requests
 */

// Workflow request schema
const WorkflowRequestSchema = z.object({
  workflowType: z.string().min(1, 'Workflow type is required'),
  tenantId: z.string().min(1, 'Tenant ID is required'),
  parameters: z.record(z.any()).optional(),
  startedBy: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

// Workflow list request schema
const WorkflowListRequestSchema = z.object({
  tenantId: z.string().optional(),
  workflowType: z.string().optional(),
  status: z.enum(['RUNNING', 'SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED']).optional(),
  limit: z.number().min(1).max(1000).optional().default(50),
  nextToken: z.string().optional()
});

// Execution ARN schema
const ExecutionArnSchema = z.string().regex(
  /^arn:aws:states:[a-z0-9-]+:\d{12}:execution:[a-zA-Z0-9-_]+:[a-zA-Z0-9-_]+$/,
  'Invalid execution ARN format'
);

// State machine ARN schema
const StateMachineArnSchema = z.string().regex(
  /^arn:aws:states:[a-z0-9-]+:\d{12}:stateMachine:[a-zA-Z0-9-_]+$/,
  'Invalid state machine ARN format'
);

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Validate workflow request
 */
export function validateWorkflowRequest(body: string | null): ValidationResult<any> {
  try {
    if (!body) {
      return {
        success: false,
        errors: ['Request body is required']
      };
    }

    const parsed = JSON.parse(body);
    const result = WorkflowRequestSchema.safeParse(parsed);

    if (!result.success) {
      return {
        success: false,
        errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      };
    }

    // Additional validation based on workflow type
    const additionalValidation = validateWorkflowTypeSpecificParameters(
      result.data.workflowType,
      result.data.parameters || {}
    );

    if (!additionalValidation.success) {
      return additionalValidation;
    }

    return {
      success: true,
      data: result.data
    };

  } catch (error) {
    return {
      success: false,
      errors: ['Invalid JSON in request body']
    };
  }
}

/**
 * Validate workflow list request
 */
export function validateWorkflowListRequest(params: any): ValidationResult<any> {
  const result = WorkflowListRequestSchema.safeParse(params);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
    };
  }

  return {
    success: true,
    data: result.data
  };
}

/**
 * Validate execution ARN
 */
export function validateExecutionArn(arn: string): ValidationResult<string> {
  const result = ExecutionArnSchema.safeParse(arn);

  if (!result.success) {
    return {
      success: false,
      errors: ['Invalid execution ARN format']
    };
  }

  return {
    success: true,
    data: result.data
  };
}

/**
 * Validate state machine ARN
 */
export function validateStateMachineArn(arn: string): ValidationResult<string> {
  const result = StateMachineArnSchema.safeParse(arn);

  if (!result.success) {
    return {
      success: false,
      errors: ['Invalid state machine ARN format']
    };
  }

  return {
    success: true,
    data: result.data
  };
}

/**
 * Validate workflow type specific parameters
 */
function validateWorkflowTypeSpecificParameters(
  workflowType: string,
  parameters: Record<string, any>
): ValidationResult<any> {
  switch (workflowType) {
    case 'compliance-scan':
      return validateComplianceScanParameters(parameters);
    
    case 'remediation':
      return validateRemediationParameters(parameters);
    
    case 'compliance-assessment':
      return validateComplianceAssessmentParameters(parameters);
    
    case 'incident-response':
      return validateIncidentResponseParameters(parameters);
    
    case 'audit-pack-generation':
      return validateAuditPackGenerationParameters(parameters);
    
    case 'continuous-monitoring':
      return validateContinuousMonitoringParameters(parameters);
    
    default:
      return {
        success: false,
        errors: [`Unknown workflow type: ${workflowType}`]
      };
  }
}

/**
 * Validate compliance scan parameters
 */
function validateComplianceScanParameters(parameters: Record<string, any>): ValidationResult<any> {
  const schema = z.object({
    regions: z.array(z.string()).optional(),
    services: z.array(z.string()).optional(),
    scanType: z.enum(['full', 'security', 'compliance', 'cost']).optional().default('full'),
    notificationTargets: z.array(z.string()).optional()
  });

  const result = schema.safeParse(parameters);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map(err => `parameters.${err.path.join('.')}: ${err.message}`)
    };
  }

  // Validate AWS regions
  if (result.data.regions) {
    const validRegions = /^[a-z]{2}-[a-z]+-[0-9]$/;
    const invalidRegions = result.data.regions.filter((region: string) => !validRegions.test(region));
    
    if (invalidRegions.length > 0) {
      return {
        success: false,
        errors: [`Invalid AWS regions: ${invalidRegions.join(', ')}`]
      };
    }
  }

  // Validate AWS services
  if (result.data.services) {
    const validServices = ['S3', 'IAM', 'EC2', 'RDS', 'Lambda', 'CloudTrail', 'KMS', 'VPC'];
    const invalidServices = result.data.services.filter((service: string) => !validServices.includes(service));
    
    if (invalidServices.length > 0) {
      return {
        success: false,
        errors: [`Invalid AWS services: ${invalidServices.join(', ')}`]
      };
    }
  }

  return {
    success: true,
    data: result.data
  };
}

/**
 * Validate remediation parameters
 */
function validateRemediationParameters(parameters: Record<string, any>): ValidationResult<any> {
  const schema = z.object({
    findingIds: z.array(z.string().min(1)).min(1, 'At least one finding ID is required'),
    approvalRequired: z.boolean().optional().default(true),
    dryRun: z.boolean().optional().default(false),
    notificationTargets: z.array(z.string()).optional()
  });

  const result = schema.safeParse(parameters);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map(err => `parameters.${err.path.join('.')}: ${err.message}`)
    };
  }

  // Validate finding ID format (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const invalidFindingIds = result.data.findingIds.filter((id: string) => !uuidRegex.test(id));
  
  if (invalidFindingIds.length > 0) {
    return {
      success: false,
      errors: [`Invalid finding IDs (must be UUIDs): ${invalidFindingIds.join(', ')}`]
    };
  }

  return {
    success: true,
    data: result.data
  };
}

/**
 * Validate compliance assessment parameters
 */
function validateComplianceAssessmentParameters(parameters: Record<string, any>): ValidationResult<any> {
  const schema = z.object({
    framework: z.enum(['SOC2', 'HIPAA', 'GDPR', 'PCI-DSS', 'ISO27001']),
    scope: z.array(z.string()).optional(),
    reportFormat: z.enum(['HTML', 'PDF', 'JSON']).optional().default('HTML'),
    includeRecommendations: z.boolean().optional().default(true)
  });

  const result = schema.safeParse(parameters);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map(err => `parameters.${err.path.join('.')}: ${err.message}`)
    };
  }

  return {
    success: true,
    data: result.data
  };
}

/**
 * Validate incident response parameters
 */
function validateIncidentResponseParameters(parameters: Record<string, any>): ValidationResult<any> {
  const schema = z.object({
    incidentType: z.enum(['security-breach', 'compliance-violation', 'data-leak', 'unauthorized-access']),
    severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
    autoRemediate: z.boolean().optional().default(false)
  });

  const result = schema.safeParse(parameters);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map(err => `parameters.${err.path.join('.')}: ${err.message}`)
    };
  }

  return {
    success: true,
    data: result.data
  };
}

/**
 * Validate audit pack generation parameters
 */
function validateAuditPackGenerationParameters(parameters: Record<string, any>): ValidationResult<any> {
  const schema = z.object({
    auditType: z.enum(['SOC2', 'HIPAA', 'GDPR', 'PCI-DSS', 'ISO27001', 'CUSTOM']),
    dateRange: z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    }).optional(),
    includeEvidence: z.boolean().optional().default(true),
    format: z.enum(['HTML', 'PDF', 'ZIP']).optional().default('HTML')
  });

  const result = schema.safeParse(parameters);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map(err => `parameters.${err.path.join('.')}: ${err.message}`)
    };
  }

  // Validate date range
  if (result.data.dateRange) {
    const startDate = new Date(result.data.dateRange.startDate);
    const endDate = new Date(result.data.dateRange.endDate);
    
    if (startDate >= endDate) {
      return {
        success: false,
        errors: ['Start date must be before end date']
      };
    }
    
    if (endDate > new Date()) {
      return {
        success: false,
        errors: ['End date cannot be in the future']
      };
    }
  }

  return {
    success: true,
    data: result.data
  };
}

/**
 * Validate continuous monitoring parameters
 */
function validateContinuousMonitoringParameters(parameters: Record<string, any>): ValidationResult<any> {
  const schema = z.object({
    monitoringFrequency: z.number().min(300).max(86400).optional().default(3600), // 5 minutes to 24 hours
    alertThresholds: z.object({
      critical: z.number().min(0).optional().default(1),
      high: z.number().min(0).optional().default(5),
      medium: z.number().min(0).optional().default(10)
    }).optional()
  });

  const result = schema.safeParse(parameters);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map(err => `parameters.${err.path.join('.')}: ${err.message}`)
    };
  }

  return {
    success: true,
    data: result.data
  };
}

/**
 * Validate tenant ID format
 */
export function validateTenantId(tenantId: string): boolean {
  // Alphanumeric with hyphens, 3-50 characters
  const tenantRegex = /^[a-zA-Z0-9-]{3,50}$/;
  return tenantRegex.test(tenantId);
}

/**
 * Validate correlation ID format
 */
export function validateCorrelationId(correlationId: string): boolean {
  // Allow alphanumeric, hyphens, and underscores, 8-50 characters
  const correlationIdRegex = /^[a-zA-Z0-9\-_]{8,50}$/;
  return correlationIdRegex.test(correlationId);
}

/**
 * Validate workflow name format
 */
export function validateWorkflowName(name: string): boolean {
  // Alphanumeric with hyphens and underscores, 1-64 characters
  const nameRegex = /^[a-zA-Z0-9\-_]{1,64}$/;
  return nameRegex.test(name);
}

/**
 * Validate and throw on error
 */
export function validateAndThrow<T>(
  validationResult: ValidationResult<T>,
  errorMessage: string = 'Validation failed'
): T {
  if (!validationResult.success) {
    throw new WorkflowValidationError(errorMessage, {
      errors: validationResult.errors
    });
  }

  return validationResult.data!;
}
