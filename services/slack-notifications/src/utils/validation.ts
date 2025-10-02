import { z } from 'zod';
import { ValidationResult, SlackConfiguration } from '../types/slack';

/**
 * Validation schemas and utilities for Slack notifications
 */

// Base schemas
const SlackChannelSchema = z.object({
  name: z.string().min(1, "Channel name is required").max(80, "Channel name too long"),
  id: z.string().min(1, "Channel ID is required").regex(
    /^[C|G|D][A-Z0-9]{8,}$/,
    "Invalid Slack channel ID format"
  ),
  events: z.array(z.string()).min(1, "At least one event type must be specified")
});

const NotificationSettingsSchema = z.object({
  criticalFindings: z.boolean().default(true),
  scanResults: z.boolean().default(true),
  remediationActions: z.boolean().default(true),
  auditPackReady: z.boolean().default(true),
  complianceScoreChanges: z.boolean().default(false),
  scheduledReports: z.boolean().default(false)
});

const SlackConfigurationSchema = z.object({
  tenantId: z.string().min(1, "Tenant ID is required").regex(
    /^tenant-[a-z0-9-]+$/,
    "Tenant ID must start with 'tenant-' and contain only lowercase letters, numbers, and hyphens"
  ),
  botToken: z.string().min(1, "Bot token is required").regex(
    /^xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+$/,
    "Invalid Slack bot token format"
  ),
  channels: z.array(SlackChannelSchema).min(1, "At least one channel must be configured").max(10, "Maximum 10 channels allowed"),
  enabled: z.boolean().default(true),
  notificationSettings: NotificationSettingsSchema
});

const NotificationRequestSchema = z.object({
  tenantId: z.string().min(1, "Tenant ID is required").regex(
    /^tenant-[a-z0-9-]+$/,
    "Tenant ID must start with 'tenant-' and contain only lowercase letters, numbers, and hyphens"
  ),
  channel: z.string().optional(),
  message: z.string().min(1, "Message is required").max(4000, "Message too long").optional()
});

/**
 * Validate Slack configuration request
 */
export function validateSlackConfigRequest(body: string | null): ValidationResult<SlackConfiguration> {
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

    const result = SlackConfigurationSchema.safeParse(parsedBody);
    
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
    const validationErrors = validateSlackConfigBusinessRules(result.data);
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
 * Validate notification request
 */
export function validateNotificationRequest(body: string | null): ValidationResult<any> {
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

    const result = NotificationRequestSchema.safeParse(parsedBody);
    
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
 * Validate Slack configuration business rules
 */
function validateSlackConfigBusinessRules(config: SlackConfiguration): string[] {
  const errors: string[] = [];

  // Validate channel configurations
  const channelIds = new Set<string>();
  const channelNames = new Set<string>();

  for (const channel of config.channels || []) {
    // Check for duplicate channel IDs
    if (channelIds.has(channel.id)) {
      errors.push(`Duplicate channel ID: ${channel.id}`);
    }
    channelIds.add(channel.id);

    // Check for duplicate channel names
    if (channelNames.has(channel.name)) {
      errors.push(`Duplicate channel name: ${channel.name}`);
    }
    channelNames.add(channel.name);

    // Validate event types
    const validEventTypes = [
      'SCAN_RESULTS',
      'CRITICAL_FINDINGS',
      'REMEDIATION_ACTIONS',
      'AUDIT_PACK_READY',
      'COMPLIANCE_SCORE_CHANGES',
      'SCHEDULED_REPORTS',
      'ALL'
    ];

    for (const eventType of channel.events) {
      if (!validEventTypes.includes(eventType)) {
        errors.push(`Invalid event type for channel ${channel.name}: ${eventType}`);
      }
    }

    // Validate channel name format
    if (!/^[a-z0-9_-]+$/.test(channel.name)) {
      errors.push(`Invalid channel name format: ${channel.name}. Use only lowercase letters, numbers, hyphens, and underscores.`);
    }
  }

  // Validate notification settings consistency
  const settings = config.notificationSettings;
  let hasEnabledNotifications = false;

  Object.values(settings).forEach(enabled => {
    if (enabled) hasEnabledNotifications = true;
  });

  if (!hasEnabledNotifications) {
    errors.push('At least one notification type must be enabled');
  }

  // Validate bot token format more strictly
  if (config.botToken) {
    const tokenParts = config.botToken.split('-');
    if (tokenParts.length !== 4 || tokenParts[0] !== 'xoxb') {
      errors.push('Invalid bot token format. Expected format: xoxb-xxxx-xxxx-xxxxxxxx');
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

  // Additional tenant validation
  if (tenantId.length > 50) {
    return {
      success: false,
      errors: ['Tenant ID cannot exceed 50 characters']
    };
  }

  if (tenantId.includes('--') || tenantId.endsWith('-')) {
    return {
      success: false,
      errors: ['Tenant ID cannot contain consecutive hyphens or end with a hyphen']
    };
  }

  return {
    success: true,
    data: result.data
  };
}

/**
 * Validate Slack bot token format
 */
export function validateSlackBotToken(token: string): ValidationResult<string> {
  const schema = z.string().regex(
    /^xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+$/,
    "Invalid Slack bot token format. Expected: xoxb-xxxx-xxxx-xxxxxxxx"
  );

  const result = schema.safeParse(token);
  
  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map(err => err.message)
    };
  }

  // Additional token validation
  const tokenParts = token.split('-');
  if (tokenParts.length !== 4) {
    return {
      success: false,
      errors: ['Bot token must have exactly 4 parts separated by hyphens']
    };
  }

  if (tokenParts[1].length < 10 || tokenParts[2].length < 10 || tokenParts[3].length < 20) {
    return {
      success: false,
      errors: ['Bot token parts are too short, token may be invalid']
    };
  }

  return {
    success: true,
    data: result.data
  };
}

/**
 * Validate Slack channel ID format
 */
export function validateSlackChannelId(channelId: string): ValidationResult<string> {
  const schema = z.string().regex(
    /^[C|G|D][A-Z0-9]{8,}$/,
    "Invalid Slack channel ID format. Expected: C/G/D followed by 8+ alphanumeric characters"
  );

  const result = schema.safeParse(channelId);
  
  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map(err => err.message)
    };
  }

  // Additional channel ID validation
  if (channelId.length > 15) {
    return {
      success: false,
      errors: ['Channel ID is too long']
    };
  }

  const channelType = channelId.charAt(0);
  const validTypes = ['C', 'G', 'D']; // Channel, Group, Direct Message
  if (!validTypes.includes(channelType)) {
    return {
      success: false,
      errors: ['Channel ID must start with C (channel), G (group), or D (direct message)']
    };
  }

  return {
    success: true,
    data: result.data
  };
}

/**
 * Validate event type
 */
export function validateEventType(eventType: string): ValidationResult<string> {
  const validEventTypes = [
    'SCAN_COMPLETED',
    'SCAN_FAILED',
    'CRITICAL_FINDING',
    'FINDING_RESOLVED',
    'REMEDIATION_APPLIED',
    'REMEDIATION_FAILED',
    'AUDIT_PACK_GENERATED',
    'AUDIT_PACK_FAILED',
    'COMPLIANCE_SCORE_CHANGED',
    'SCHEDULED_REPORT',
    'SYSTEM_ALERT',
    'CUSTOM_NOTIFICATION',
    'TEST_NOTIFICATION',
    'ALL'
  ];

  if (!validEventTypes.includes(eventType)) {
    return {
      success: false,
      errors: [`Invalid event type: ${eventType}. Valid types: ${validEventTypes.join(', ')}`]
    };
  }

  return {
    success: true,
    data: eventType
  };
}

/**
 * Validate notification message content
 */
export function validateNotificationMessage(message: string): ValidationResult<string> {
  if (!message || message.trim().length === 0) {
    return {
      success: false,
      errors: ['Message cannot be empty']
    };
  }

  if (message.length > 4000) {
    return {
      success: false,
      errors: ['Message cannot exceed 4000 characters']
    };
  }

  // Check for potentially harmful content
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(message)) {
      return {
        success: false,
        errors: ['Message contains potentially harmful content']
      };
    }
  }

  return {
    success: true,
    data: message.trim()
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

  // Validate nextToken format
  if (nextToken !== undefined) {
    if (typeof nextToken !== 'string' || nextToken.length === 0) {
      errors.push('Next token must be a non-empty string');
    }
    
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
 * Validate Slack message blocks
 */
export function validateSlackBlocks(blocks: any[]): ValidationResult<any[]> {
  if (!Array.isArray(blocks)) {
    return {
      success: false,
      errors: ['Blocks must be an array']
    };
  }

  if (blocks.length > 50) {
    return {
      success: false,
      errors: ['Maximum 50 blocks allowed']
    };
  }

  const errors: string[] = [];

  blocks.forEach((block, index) => {
    if (!block.type) {
      errors.push(`Block ${index}: type is required`);
    }

    const validBlockTypes = ['section', 'divider', 'image', 'actions', 'context', 'header', 'input'];
    if (block.type && !validBlockTypes.includes(block.type)) {
      errors.push(`Block ${index}: invalid block type '${block.type}'`);
    }

    // Validate section blocks
    if (block.type === 'section') {
      if (!block.text && !block.fields) {
        errors.push(`Block ${index}: section blocks must have either text or fields`);
      }

      if (block.text && (!block.text.type || !block.text.text)) {
        errors.push(`Block ${index}: section text must have type and text properties`);
      }

      if (block.fields && (!Array.isArray(block.fields) || block.fields.length > 10)) {
        errors.push(`Block ${index}: section fields must be an array with maximum 10 items`);
      }
    }

    // Validate actions blocks
    if (block.type === 'actions') {
      if (!block.elements || !Array.isArray(block.elements) || block.elements.length === 0) {
        errors.push(`Block ${index}: actions blocks must have at least one element`);
      }

      if (block.elements && block.elements.length > 5) {
        errors.push(`Block ${index}: actions blocks can have maximum 5 elements`);
      }
    }
  });

  if (errors.length > 0) {
    return {
      success: false,
      errors
    };
  }

  return {
    success: true,
    data: blocks
  };
}

/**
 * Validate notification template
 */
export function validateNotificationTemplate(template: string): ValidationResult<string> {
  if (!template || template.trim().length === 0) {
    return {
      success: false,
      errors: ['Template cannot be empty']
    };
  }

  if (template.length > 10000) {
    return {
      success: false,
      errors: ['Template cannot exceed 10,000 characters']
    };
  }

  // Basic Handlebars syntax validation
  const openBraces = (template.match(/\{\{/g) || []).length;
  const closeBraces = (template.match(/\}\}/g) || []).length;

  if (openBraces !== closeBraces) {
    return {
      success: false,
      errors: ['Template has mismatched Handlebars braces']
    };
  }

  // Check for potentially dangerous Handlebars expressions
  const dangerousPatterns = [
    /\{\{\s*#each\s+.*\.\.\//,  // Path traversal in each
    /\{\{\s*lookup\s+.*\.\.\//,  // Path traversal in lookup
    /\{\{\s*.*constructor/,      // Constructor access
    /\{\{\s*.*prototype/,        // Prototype access
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(template)) {
      return {
        success: false,
        errors: ['Template contains potentially dangerous expressions']
      };
    }
  }

  return {
    success: true,
    data: template.trim()
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
