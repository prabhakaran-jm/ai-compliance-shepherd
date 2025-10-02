import { z } from 'zod';
import { ValidationError } from './errorHandler';

/**
 * Validation schemas for Bedrock Agent requests
 */

// Agent request schema
const AgentRequestSchema = z.object({
  sessionId: z.string().optional(),
  inputText: z.string().min(1, 'Input text is required').max(10000, 'Input text too long'),
  enableTrace: z.boolean().optional().default(false),
  endSession: z.boolean().optional().default(false)
});

// Chat request schema
const ChatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required').max(10000, 'Message too long'),
  sessionId: z.string().optional(),
  context: z.record(z.any()).optional()
});

// Agent configuration schema
const AgentConfigurationSchema = z.object({
  agentName: z.string().min(1, 'Agent name is required'),
  description: z.string().min(1, 'Description is required'),
  foundationModel: z.string().min(1, 'Foundation model is required'),
  instruction: z.string().min(1, 'Instruction is required'),
  agentResourceRoleArn: z.string().min(1, 'Agent resource role ARN is required'),
  idleSessionTTLInSeconds: z.number().min(60).max(3600).optional()
});

// Action group configuration schema
const ActionGroupConfigurationSchema = z.object({
  actionGroupName: z.string().min(1, 'Action group name is required'),
  description: z.string().min(1, 'Description is required'),
  actionGroupExecutor: z.object({
    lambda: z.string().min(1, 'Lambda ARN is required')
  }),
  apiSchema: z.object({
    payload: z.string().min(1, 'API schema payload is required')
  }),
  actionGroupState: z.enum(['ENABLED', 'DISABLED']).default('ENABLED')
});

// Scan request schema
const ScanRequestSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  scanType: z.enum(['full', 'security', 'compliance', 'cost']).optional().default('full'),
  regions: z.array(z.string()).optional(),
  services: z.array(z.string()).optional()
});

// Findings search schema
const FindingsSearchSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']).optional(),
  status: z.enum(['OPEN', 'RESOLVED', 'SUPPRESSED', 'IN_PROGRESS']).optional(),
  service: z.string().optional(),
  region: z.string().optional(),
  limit: z.number().min(1).max(1000).optional().default(50),
  offset: z.number().min(0).optional().default(0)
});

// Remediation request schema
const RemediationRequestSchema = z.object({
  findingId: z.string().min(1, 'Finding ID is required'),
  remediationType: z.string().min(1, 'Remediation type is required'),
  dryRun: z.boolean().optional().default(true),
  approvalRequired: z.boolean().optional().default(true),
  parameters: z.record(z.any()).optional()
});

// Report generation schema
const ReportGenerationSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  reportType: z.enum(['executive', 'detailed', 'technical', 'audit']),
  scanJobId: z.string().optional(),
  includeCharts: z.boolean().optional().default(true),
  includeRecommendations: z.boolean().optional().default(true),
  customSections: z.array(z.string()).optional()
});

// Terraform analysis schema
const TerraformAnalysisSchema = z.object({
  planData: z.string().min(1, 'Plan data is required'),
  planFormat: z.enum(['json', 'binary']).optional().default('json'),
  analysisType: z.enum(['compliance', 'security', 'cost', 'all']).optional().default('all'),
  customRules: z.array(z.string()).optional()
});

// S3 bucket configuration schema
const S3BucketConfigurationSchema = z.object({
  bucketName: z.string().min(1, 'Bucket name is required'),
  region: z.string().optional(),
  configurations: z.object({
    encryption: z.boolean().optional(),
    versioning: z.boolean().optional(),
    publicAccessBlock: z.boolean().optional(),
    lifecyclePolicy: z.boolean().optional(),
    logging: z.boolean().optional(),
    monitoring: z.boolean().optional()
  })
});

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Validate agent request
 */
export function validateAgentRequest(body: string | null): ValidationResult<any> {
  try {
    if (!body) {
      return {
        success: false,
        errors: ['Request body is required']
      };
    }

    const parsed = JSON.parse(body);
    const result = AgentRequestSchema.safeParse(parsed);

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

  } catch (error) {
    return {
      success: false,
      errors: ['Invalid JSON in request body']
    };
  }
}

/**
 * Validate chat request
 */
export function validateChatRequest(body: string | null): ValidationResult<any> {
  try {
    if (!body) {
      return {
        success: false,
        errors: ['Request body is required']
      };
    }

    const parsed = JSON.parse(body);
    const result = ChatRequestSchema.safeParse(parsed);

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

  } catch (error) {
    return {
      success: false,
      errors: ['Invalid JSON in request body']
    };
  }
}

/**
 * Validate agent configuration
 */
export function validateAgentConfiguration(config: any): ValidationResult<any> {
  const result = AgentConfigurationSchema.safeParse(config);

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
 * Validate action group configuration
 */
export function validateActionGroupConfiguration(config: any): ValidationResult<any> {
  const result = ActionGroupConfigurationSchema.safeParse(config);

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
 * Validate scan request
 */
export function validateScanRequest(body: string | null): ValidationResult<any> {
  try {
    if (!body) {
      return {
        success: false,
        errors: ['Request body is required']
      };
    }

    const parsed = JSON.parse(body);
    const result = ScanRequestSchema.safeParse(parsed);

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

  } catch (error) {
    return {
      success: false,
      errors: ['Invalid JSON in request body']
    };
  }
}

/**
 * Validate findings search parameters
 */
export function validateFindingsSearch(params: any): ValidationResult<any> {
  const result = FindingsSearchSchema.safeParse(params);

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
 * Validate remediation request
 */
export function validateRemediationRequest(body: string | null): ValidationResult<any> {
  try {
    if (!body) {
      return {
        success: false,
        errors: ['Request body is required']
      };
    }

    const parsed = JSON.parse(body);
    const result = RemediationRequestSchema.safeParse(parsed);

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

  } catch (error) {
    return {
      success: false,
      errors: ['Invalid JSON in request body']
    };
  }
}

/**
 * Validate report generation request
 */
export function validateReportGeneration(body: string | null): ValidationResult<any> {
  try {
    if (!body) {
      return {
        success: false,
        errors: ['Request body is required']
      };
    }

    const parsed = JSON.parse(body);
    const result = ReportGenerationSchema.safeParse(parsed);

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

  } catch (error) {
    return {
      success: false,
      errors: ['Invalid JSON in request body']
    };
  }
}

/**
 * Validate Terraform analysis request
 */
export function validateTerraformAnalysis(body: string | null): ValidationResult<any> {
  try {
    if (!body) {
      return {
        success: false,
        errors: ['Request body is required']
      };
    }

    const parsed = JSON.parse(body);
    const result = TerraformAnalysisSchema.safeParse(parsed);

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

  } catch (error) {
    return {
      success: false,
      errors: ['Invalid JSON in request body']
    };
  }
}

/**
 * Validate S3 bucket configuration request
 */
export function validateS3BucketConfiguration(body: string | null): ValidationResult<any> {
  try {
    if (!body) {
      return {
        success: false,
        errors: ['Request body is required']
      };
    }

    const parsed = JSON.parse(body);
    const result = S3BucketConfigurationSchema.safeParse(parsed);

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

  } catch (error) {
    return {
      success: false,
      errors: ['Invalid JSON in request body']
    };
  }
}

/**
 * Sanitize input string
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/['"]/g, '') // Remove quotes
    .trim();
}

/**
 * Validate session ID format
 */
export function validateSessionId(sessionId: string): boolean {
  // UUID v4 format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(sessionId);
}

/**
 * Validate AWS ARN format
 */
export function validateAwsArn(arn: string): boolean {
  const arnRegex = /^arn:aws:[a-zA-Z0-9-]+:[a-zA-Z0-9-]*:[0-9]*:[a-zA-Z0-9-/._]+$/;
  return arnRegex.test(arn);
}

/**
 * Validate AWS region format
 */
export function validateAwsRegion(region: string): boolean {
  const regionRegex = /^[a-z]{2}-[a-z]+-[0-9]$/;
  return regionRegex.test(region);
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
 * Validate input text for agent
 */
export function validateInputText(text: string): ValidationResult<string> {
  if (!text || text.trim().length === 0) {
    return {
      success: false,
      errors: ['Input text cannot be empty']
    };
  }

  if (text.length > 10000) {
    return {
      success: false,
      errors: ['Input text exceeds maximum length of 10,000 characters']
    };
  }

  // Check for potentially malicious content
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(text)) {
      return {
        success: false,
        errors: ['Input text contains potentially malicious content']
      };
    }
  }

  return {
    success: true,
    data: sanitizeInput(text)
  };
}

/**
 * Validate and throw on error
 */
export function validateAndThrow<T>(
  validationResult: ValidationResult<T>,
  errorMessage: string = 'Validation failed'
): T {
  if (!validationResult.success) {
    throw new ValidationError(errorMessage, {
      errors: validationResult.errors
    });
  }

  return validationResult.data!;
}
