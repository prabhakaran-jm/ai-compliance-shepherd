import { z } from 'zod';

/**
 * Validation schemas and utilities for EventBridge Scheduler
 */

// Schedule target schema
const scheduleTargetSchema = z.object({
  type: z.enum(['step-functions', 'lambda', 'sns']),
  stateMachineName: z.string().optional(),
  functionName: z.string().optional(),
  topicName: z.string().optional()
}).refine((data) => {
  // Ensure required field is present based on type
  if (data.type === 'step-functions' && !data.stateMachineName) {
    return false;
  }
  if (data.type === 'lambda' && !data.functionName) {
    return false;
  }
  if (data.type === 'sns' && !data.topicName) {
    return false;
  }
  return true;
}, {
  message: 'Required field missing for target type'
});

// Schedule request schema
const scheduleRequestSchema = z.object({
  scheduleType: z.string()
    .min(1, 'Schedule type is required')
    .max(100, 'Schedule type too long')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Schedule type contains invalid characters'),
  
  tenantId: z.string()
    .min(1, 'Tenant ID is required')
    .max(100, 'Tenant ID too long')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Tenant ID contains invalid characters'),
  
  cronExpression: z.string()
    .min(1, 'Cron expression is required')
    .regex(/^(\*|[0-5]?\d|\*\/\d+)\s+(\*|[01]?\d|2[0-3]|\*\/\d+)\s+(\*|[0-2]?\d|3[01]|\*\/\d+)\s+(\*|[0]?\d|1[0-2]|\*\/\d+)\s+(\*|[0-6]|\*\/\d+)(\s+(\*|\d{4}))?$/, 
      'Invalid cron expression format'),
  
  timezone: z.string()
    .optional()
    .refine((tz) => !tz || isValidTimezone(tz), 'Invalid timezone'),
  
  enabled: z.boolean(),
  
  description: z.string()
    .max(500, 'Description too long')
    .optional(),
  
  target: scheduleTargetSchema,
  
  parameters: z.record(z.any()).optional(),
  
  flexibleTimeWindowMinutes: z.number()
    .min(1, 'Flexible time window must be at least 1 minute')
    .max(1440, 'Flexible time window cannot exceed 24 hours')
    .optional(),
  
  createdBy: z.string()
    .max(100, 'Created by field too long')
    .optional()
});

// Event processor request schema
const eventProcessorRequestSchema = z.object({
  eventType: z.string()
    .min(1, 'Event type is required')
    .max(100, 'Event type too long')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Event type contains invalid characters'),
  
  tenantId: z.string()
    .min(1, 'Tenant ID is required')
    .max(100, 'Tenant ID too long')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Tenant ID contains invalid characters'),
  
  parameters: z.record(z.any()).optional(),
  
  triggeredBy: z.string()
    .max(100, 'Triggered by field too long')
    .optional(),
  
  processImmediately: z.boolean().optional()
});

// Schedule list request schema
const scheduleListRequestSchema = z.object({
  tenantId: z.string()
    .max(100, 'Tenant ID too long')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Tenant ID contains invalid characters')
    .optional(),
  
  scheduleType: z.string()
    .max(100, 'Schedule type too long')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Schedule type contains invalid characters')
    .optional(),
  
  status: z.enum(['ENABLED', 'DISABLED']).optional(),
  
  limit: z.number()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .optional(),
  
  nextToken: z.string().optional()
});

// Event history request schema
const eventHistoryRequestSchema = z.object({
  tenantId: z.string()
    .max(100, 'Tenant ID too long')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Tenant ID contains invalid characters')
    .optional(),
  
  eventType: z.string()
    .max(100, 'Event type too long')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Event type contains invalid characters')
    .optional(),
  
  status: z.enum(['TRIGGERED', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
  
  startDate: z.string()
    .datetime('Invalid start date format')
    .optional(),
  
  endDate: z.string()
    .datetime('Invalid end date format')
    .optional(),
  
  limit: z.number()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .optional(),
  
  nextToken: z.string().optional()
}).refine((data) => {
  // Ensure end date is after start date if both are provided
  if (data.startDate && data.endDate) {
    return new Date(data.endDate) > new Date(data.startDate);
  }
  return true;
}, {
  message: 'End date must be after start date'
});

// Batch operation schema
const batchOperationSchema = z.object({
  operation: z.enum(['ENABLE', 'DISABLE', 'DELETE', 'UPDATE']),
  
  scheduleIds: z.array(z.string())
    .min(1, 'At least one schedule ID is required')
    .max(50, 'Cannot process more than 50 schedules at once'),
  
  parameters: z.record(z.any()).optional(),
  
  performedBy: z.string()
    .max(100, 'Performed by field too long')
    .optional()
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
 * Validate schedule request
 */
export function validateScheduleRequest(body: string | null): ValidationResult<any> {
  try {
    if (!body) {
      return {
        success: false,
        errors: ['Request body is required']
      };
    }

    const parsed = JSON.parse(body);
    const result = scheduleRequestSchema.safeParse(parsed);

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
 * Validate event processor request
 */
export function validateEventProcessorRequest(body: string | null): ValidationResult<any> {
  try {
    if (!body) {
      return {
        success: false,
        errors: ['Request body is required']
      };
    }

    const parsed = JSON.parse(body);
    const result = eventProcessorRequestSchema.safeParse(parsed);

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
 * Validate schedule list request
 */
export function validateScheduleListRequest(queryParams: any): ValidationResult<any> {
  const result = scheduleListRequestSchema.safeParse(queryParams || {});

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
 * Validate event history request
 */
export function validateEventHistoryRequest(queryParams: any): ValidationResult<any> {
  const result = eventHistoryRequestSchema.safeParse(queryParams || {});

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
 * Validate batch operation request
 */
export function validateBatchOperationRequest(body: string | null): ValidationResult<any> {
  try {
    if (!body) {
      return {
        success: false,
        errors: ['Request body is required']
      };
    }

    const parsed = JSON.parse(body);
    const result = batchOperationSchema.safeParse(parsed);

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
 * Validate schedule ID
 */
export function validateScheduleId(scheduleId: string | null | undefined): ValidationResult<string> {
  if (!scheduleId) {
    return {
      success: false,
      errors: ['Schedule ID is required']
    };
  }

  if (scheduleId.length < 1 || scheduleId.length > 100) {
    return {
      success: false,
      errors: ['Schedule ID must be between 1 and 100 characters']
    };
  }

  if (!/^[a-zA-Z0-9-_]+$/.test(scheduleId)) {
    return {
      success: false,
      errors: ['Schedule ID contains invalid characters']
    };
  }

  return {
    success: true,
    data: scheduleId
  };
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
 * Validate cron expression
 */
export function validateCronExpression(cronExpression: string): ValidationResult<string> {
  if (!cronExpression) {
    return {
      success: false,
      errors: ['Cron expression is required']
    };
  }

  // Basic cron validation (5 or 6 fields)
  const parts = cronExpression.trim().split(/\s+/);
  
  if (parts.length < 5 || parts.length > 6) {
    return {
      success: false,
      errors: ['Cron expression must have 5 or 6 fields']
    };
  }

  // Validate each field
  const validators = [
    { name: 'minute', range: [0, 59] },
    { name: 'hour', range: [0, 23] },
    { name: 'day', range: [1, 31] },
    { name: 'month', range: [1, 12] },
    { name: 'weekday', range: [0, 6] }
  ];

  if (parts.length === 6) {
    validators.push({ name: 'year', range: [1970, 3000] });
  }

  for (let i = 0; i < validators.length; i++) {
    const part = parts[i];
    const validator = validators[i];

    if (part === '*') continue;

    // Handle step values (*/n)
    if (part.includes('/')) {
      const [range, step] = part.split('/');
      if (range !== '*' && !isValidRange(range, validator.range)) {
        return {
          success: false,
          errors: [`Invalid ${validator.name} range: ${range}`]
        };
      }
      if (!/^\d+$/.test(step) || parseInt(step) <= 0) {
        return {
          success: false,
          errors: [`Invalid ${validator.name} step: ${step}`]
        };
      }
      continue;
    }

    // Handle ranges (n-m)
    if (part.includes('-')) {
      const [start, end] = part.split('-');
      if (!isValidNumber(start, validator.range) || !isValidNumber(end, validator.range)) {
        return {
          success: false,
          errors: [`Invalid ${validator.name} range: ${part}`]
        };
      }
      if (parseInt(start) >= parseInt(end)) {
        return {
          success: false,
          errors: [`Invalid ${validator.name} range: start must be less than end`]
        };
      }
      continue;
    }

    // Handle lists (n,m,o)
    if (part.includes(',')) {
      const values = part.split(',');
      for (const value of values) {
        if (!isValidNumber(value, validator.range)) {
          return {
            success: false,
            errors: [`Invalid ${validator.name} value: ${value}`]
          };
        }
      }
      continue;
    }

    // Handle single values
    if (!isValidNumber(part, validator.range)) {
      return {
        success: false,
        errors: [`Invalid ${validator.name} value: ${part}`]
      };
    }
  }

  return {
    success: true,
    data: cronExpression
  };
}

/**
 * Check if timezone is valid
 */
function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if number is valid within range
 */
function isValidNumber(value: string, range: [number, number]): boolean {
  if (!/^\d+$/.test(value)) return false;
  const num = parseInt(value);
  return num >= range[0] && num <= range[1];
}

/**
 * Check if range is valid
 */
function isValidRange(range: string, validRange: [number, number]): boolean {
  if (range === '*') return true;
  return isValidNumber(range, validRange);
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
 * Validate AWS ARN format
 */
export function validateAwsArn(arn: string): ValidationResult<string> {
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
