import { z } from 'zod';
import { logger } from './logger';

/**
 * Validation schemas for Bedrock Knowledge Base service
 */
const QueryRequestSchema = z.object({
  query: z.string().min(1, 'Query is required').max(4000, 'Query too long'),
  maxResults: z.number().min(1).max(20).optional(),
  retrievalConfiguration: z.object({
    vectorSearchConfiguration: z.object({
      numberOfResults: z.number().min(1).max(20).optional(),
      overrideSearchType: z.enum(['HYBRID', 'SEMANTIC']).optional()
    }).optional()
  }).optional(),
  sessionId: z.string().uuid().optional(),
  context: z.object({
    framework: z.string().optional(),
    resourceType: z.string().optional(),
    findingId: z.string().optional()
  }).optional()
});

const IngestRequestSchema = z.object({
  dataType: z.enum(['SOC2', 'HIPAA', 'GDPR', 'CUSTOM']),
  content: z.string().min(50, 'Content too short (minimum 50 characters)').max(100000, 'Content too long (maximum 100KB)'),
  metadata: z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
    description: z.string().max(500, 'Description too long').optional(),
    framework: z.string().min(1, 'Framework is required'),
    category: z.string().min(1, 'Category is required'),
    tags: z.array(z.string()).optional(),
    version: z.string().optional(),
    lastUpdated: z.string().datetime().optional()
  }),
  format: z.enum(['MARKDOWN', 'TEXT', 'JSON'])
});

const ChatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000, 'Message too long'),
  sessionId: z.string().uuid().optional(),
  context: z.object({
    framework: z.string().optional(),
    resourceType: z.string().optional(),
    previousMessages: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string()
    })).optional()
  }).optional()
});

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Validate query request
 */
export function validateQueryRequest(body: string | null): ValidationResult<any> {
  if (!body) {
    return {
      success: false,
      errors: ['Request body is required']
    };
  }

  try {
    const data = JSON.parse(body);
    const validation = QueryRequestSchema.safeParse(data);

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
    const businessValidation = validateQueryBusinessRules(validation.data);
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
 * Validate ingest request
 */
export function validateIngestRequest(body: string | null): ValidationResult<any> {
  if (!body) {
    return {
      success: false,
      errors: ['Request body is required']
    };
  }

  try {
    const data = JSON.parse(body);
    const validation = IngestRequestSchema.safeParse(data);

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
    const businessValidation = validateIngestBusinessRules(validation.data);
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
 * Validate chat request
 */
export function validateChatRequest(body: string | null): ValidationResult<any> {
  if (!body) {
    return {
      success: false,
      errors: ['Request body is required']
    };
  }

  try {
    const data = JSON.parse(body);
    const validation = ChatRequestSchema.safeParse(data);

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
 * Validate business rules for query requests
 */
function validateQueryBusinessRules(data: any): ValidationResult<any> {
  const errors: string[] = [];

  // Check for potentially harmful queries
  const harmfulPatterns = [
    /delete|drop|truncate|alter/i,
    /script|javascript|eval/i,
    /<script|<iframe|<object/i
  ];

  for (const pattern of harmfulPatterns) {
    if (pattern.test(data.query)) {
      errors.push('Query contains potentially harmful content');
      break;
    }
  }

  // Validate context framework
  if (data.context?.framework) {
    const validFrameworks = ['SOC2', 'HIPAA', 'GDPR', 'PCI-DSS', 'ISO27001', 'NIST'];
    if (!validFrameworks.includes(data.context.framework.toUpperCase())) {
      errors.push(`Invalid framework: ${data.context.framework}`);
    }
  }

  // Validate context resource type
  if (data.context?.resourceType) {
    const validResourceTypes = [
      'S3_BUCKET', 'IAM_ROLE', 'IAM_USER', 'IAM_POLICY', 'SECURITY_GROUP',
      'CLOUDTRAIL', 'KMS_KEY', 'RDS_INSTANCE', 'RDS_CLUSTER', 'LAMBDA_FUNCTION',
      'EC2_INSTANCE', 'VPC', 'SUBNET', 'ELB', 'CLOUDFRONT'
    ];
    if (!validResourceTypes.includes(data.context.resourceType)) {
      errors.push(`Invalid resource type: ${data.context.resourceType}`);
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
    data
  };
}

/**
 * Validate business rules for ingest requests
 */
function validateIngestBusinessRules(data: any): ValidationResult<any> {
  const errors: string[] = [];

  // Validate framework
  const validFrameworks = ['SOC2', 'HIPAA', 'GDPR', 'PCI-DSS', 'ISO27001', 'NIST', 'CUSTOM'];
  if (!validFrameworks.includes(data.metadata.framework.toUpperCase())) {
    errors.push(`Invalid framework: ${data.metadata.framework}`);
  }

  // Validate category
  const validCategories = [
    'ACCESS_CONTROL', 'AUTHENTICATION', 'AUTHORIZATION', 'ENCRYPTION',
    'AUDIT_LOGGING', 'MONITORING', 'INCIDENT_RESPONSE', 'RISK_MANAGEMENT',
    'DATA_PROTECTION', 'PRIVACY', 'BUSINESS_CONTINUITY', 'CHANGE_MANAGEMENT',
    'SECURITY_POLICY', 'TRAINING', 'GOVERNANCE', 'COMPLIANCE'
  ];
  if (!validCategories.includes(data.metadata.category.toUpperCase())) {
    errors.push(`Invalid category: ${data.metadata.category}`);
  }

  // Validate content format consistency
  if (data.format === 'JSON') {
    try {
      JSON.parse(data.content);
    } catch (error) {
      errors.push('Content is not valid JSON despite format being JSON');
    }
  }

  // Validate content quality
  const contentValidation = validateContentQuality(data.content, data.metadata.framework);
  if (!contentValidation.isValid) {
    errors.push(...contentValidation.issues);
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
 * Validate content quality
 */
function validateContentQuality(content: string, framework: string): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for minimum meaningful content
  const words = content.split(/\s+/).filter(word => word.length > 2);
  if (words.length < 20) {
    issues.push('Content lacks sufficient detail (minimum 20 meaningful words)');
  }

  // Check for framework-specific terms
  const frameworkTerms = getFrameworkTerms(framework);
  const hasFrameworkTerms = frameworkTerms.some(term => 
    content.toLowerCase().includes(term.toLowerCase())
  );

  if (!hasFrameworkTerms && framework !== 'CUSTOM') {
    issues.push(`Content should include ${framework}-specific terminology`);
  }

  // Check for actionable content
  const actionableWords = ['must', 'should', 'implement', 'configure', 'ensure', 'verify', 'require'];
  const hasActionableContent = actionableWords.some(word => 
    content.toLowerCase().includes(word)
  );

  if (!hasActionableContent) {
    issues.push('Content should include actionable guidance');
  }

  // Check for compliance-related terms
  const complianceTerms = ['control', 'requirement', 'policy', 'procedure', 'standard', 'guideline'];
  const hasComplianceTerms = complianceTerms.some(term => 
    content.toLowerCase().includes(term)
  );

  if (!hasComplianceTerms) {
    issues.push('Content should include compliance-related terminology');
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Get framework-specific terms
 */
function getFrameworkTerms(framework: string): string[] {
  const terms: Record<string, string[]> = {
    'SOC2': [
      'trust services', 'security', 'availability', 'processing integrity', 
      'confidentiality', 'privacy', 'service organization', 'control activities'
    ],
    'HIPAA': [
      'PHI', 'protected health information', 'covered entity', 'business associate',
      'administrative safeguards', 'physical safeguards', 'technical safeguards',
      'minimum necessary', 'breach notification'
    ],
    'GDPR': [
      'personal data', 'data subject', 'controller', 'processor', 'consent',
      'legitimate interest', 'data protection officer', 'privacy by design',
      'right to be forgotten', 'data portability'
    ],
    'PCI-DSS': [
      'cardholder data', 'payment card', 'PAN', 'sensitive authentication data',
      'compensating controls', 'network segmentation', 'vulnerability scanning',
      'penetration testing'
    ],
    'ISO27001': [
      'ISMS', 'information security management system', 'risk assessment',
      'statement of applicability', 'management review', 'continual improvement',
      'security controls', 'risk treatment'
    ],
    'NIST': [
      'cybersecurity framework', 'identify', 'protect', 'detect', 'respond',
      'recover', 'risk management', 'security controls', 'continuous monitoring'
    ]
  };

  return terms[framework.toUpperCase()] || [];
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/\x00/g, '') // Remove null bytes
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
 * Validate knowledge base ID format
 */
export function validateKnowledgeBaseId(id: string): ValidationResult<string> {
  if (!id) {
    return {
      success: false,
      errors: ['Knowledge base ID is required']
    };
  }

  // Bedrock knowledge base IDs are typically alphanumeric with specific format
  if (!/^[A-Z0-9]{10}$/.test(id)) {
    return {
      success: false,
      errors: ['Invalid knowledge base ID format']
    };
  }

  return {
    success: true,
    data: id
  };
}

/**
 * Validate data source ID format
 */
export function validateDataSourceId(id: string): ValidationResult<string> {
  if (!id) {
    return {
      success: false,
      errors: ['Data source ID is required']
    };
  }

  // Bedrock data source IDs are typically alphanumeric with specific format
  if (!/^[A-Z0-9]{10}$/.test(id)) {
    return {
      success: false,
      errors: ['Invalid data source ID format']
    };
  }

  return {
    success: true,
    data: id
  };
}

/**
 * Validate model ARN format
 */
export function validateModelArn(arn: string): ValidationResult<string> {
  if (!arn) {
    return {
      success: false,
      errors: ['Model ARN is required']
    };
  }

  const arnRegex = /^arn:aws:bedrock:[a-z0-9-]+::\w+\/[\w.-]+$/;
  if (!arnRegex.test(arn)) {
    return {
      success: false,
      errors: ['Invalid Bedrock model ARN format']
    };
  }

  return {
    success: true,
    data: arn
  };
}

/**
 * Validate S3 URI format
 */
export function validateS3Uri(uri: string): ValidationResult<string> {
  if (!uri) {
    return {
      success: false,
      errors: ['S3 URI is required']
    };
  }

  const s3UriRegex = /^s3:\/\/[a-z0-9.-]{3,63}\/.*$/;
  if (!s3UriRegex.test(uri)) {
    return {
      success: false,
      errors: ['Invalid S3 URI format']
    };
  }

  return {
    success: true,
    data: uri
  };
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(
  limit?: string,
  nextToken?: string
): ValidationResult<{ limit: number; nextToken?: string }> {
  const errors: string[] = [];
  let parsedLimit = 10; // Default limit

  if (limit) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      errors.push('Limit must be a number between 1 and 100');
    } else {
      parsedLimit = limitNum;
    }
  }

  if (nextToken && typeof nextToken !== 'string') {
    errors.push('Next token must be a string');
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
      nextToken
    }
  };
}
