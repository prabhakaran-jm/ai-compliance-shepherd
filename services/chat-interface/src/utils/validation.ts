import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { ValidationError } from './errorHandler';

/**
 * Validation middleware for chat interface endpoints
 */

/**
 * Validate chat message request
 */
export const validateChatMessage = [
  body('message')
    .isString()
    .withMessage('Message must be a string')
    .isLength({ min: 1, max: 10000 })
    .withMessage('Message must be between 1 and 10,000 characters')
    .trim()
    .escape(),
  
  body('sessionId')
    .optional()
    .isUUID()
    .withMessage('Session ID must be a valid UUID'),
  
  body('enableTrace')
    .optional()
    .isBoolean()
    .withMessage('Enable trace must be a boolean'),

  handleValidationErrors
];

/**
 * Validate session request
 */
export const validateSessionRequest = [
  param('sessionId')
    .isUUID()
    .withMessage('Session ID must be a valid UUID'),

  handleValidationErrors
];

/**
 * Handle validation errors middleware
 */
function handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value
    }));

    const correlationId = req.headers['x-correlation-id'] as string || 
                         `validation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        correlationId,
        timestamp: new Date().toISOString(),
        details: {
          errors: errorMessages
        }
      }
    });
    return;
  }

  next();
}

/**
 * Validate WebSocket message
 */
export function validateWebSocketMessage(message: any): {
  valid: boolean;
  errors?: string[];
} {
  const errors: string[] = [];

  // Check message structure
  if (!message || typeof message !== 'object') {
    errors.push('Message must be a valid object');
    return { valid: false, errors };
  }

  // Validate message type
  const validTypes = ['chat', 'ping', 'subscribe', 'unsubscribe'];
  if (!message.type || !validTypes.includes(message.type)) {
    errors.push(`Message type must be one of: ${validTypes.join(', ')}`);
  }

  // Validate chat message data
  if (message.type === 'chat') {
    if (!message.data || typeof message.data !== 'object') {
      errors.push('Chat message must have data object');
    } else {
      if (!message.data.message || typeof message.data.message !== 'string') {
        errors.push('Chat message data must contain a message string');
      } else if (message.data.message.length === 0 || message.data.message.length > 10000) {
        errors.push('Message must be between 1 and 10,000 characters');
      }

      if (message.data.enableTrace !== undefined && typeof message.data.enableTrace !== 'boolean') {
        errors.push('Enable trace must be a boolean');
      }
    }
  }

  // Validate session ID if provided
  if (message.sessionId !== undefined) {
    if (typeof message.sessionId !== 'string' || !isValidUUID(message.sessionId)) {
      errors.push('Session ID must be a valid UUID');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/data:/gi, '') // Remove data: URLs
    .trim();
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate message content for security
 */
export function validateMessageSecurity(message: string): {
  safe: boolean;
  issues?: string[];
} {
  const issues: string[] = [];

  // Check for potentially malicious content
  const suspiciousPatterns = [
    { pattern: /<script/i, description: 'Script tags detected' },
    { pattern: /javascript:/i, description: 'JavaScript URLs detected' },
    { pattern: /data:text\/html/i, description: 'HTML data URLs detected' },
    { pattern: /vbscript:/i, description: 'VBScript URLs detected' },
    { pattern: /on\w+\s*=/i, description: 'Event handlers detected' },
    { pattern: /<iframe/i, description: 'Iframe tags detected' },
    { pattern: /<object/i, description: 'Object tags detected' },
    { pattern: /<embed/i, description: 'Embed tags detected' }
  ];

  for (const { pattern, description } of suspiciousPatterns) {
    if (pattern.test(message)) {
      issues.push(description);
    }
  }

  // Check for excessively long words (potential buffer overflow attempts)
  const words = message.split(/\s+/);
  const maxWordLength = 100;
  
  for (const word of words) {
    if (word.length > maxWordLength) {
      issues.push('Excessively long words detected');
      break;
    }
  }

  // Check for excessive special characters
  const specialCharCount = (message.match(/[^\w\s.,!?;:()\-'"]/g) || []).length;
  const specialCharRatio = specialCharCount / message.length;
  
  if (specialCharRatio > 0.3) {
    issues.push('High ratio of special characters detected');
  }

  return {
    safe: issues.length === 0,
    issues: issues.length > 0 ? issues : undefined
  };
}

/**
 * Rate limiting validation
 */
export function validateRateLimit(
  clientId: string,
  rateLimitMap: Map<string, { count: number; resetTime: number }>,
  maxRequests: number = 60,
  windowMs: number = 60000
): { allowed: boolean; resetTime?: number; remaining?: number } {
  const now = Date.now();
  const clientData = rateLimitMap.get(clientId);

  if (!clientData || now > clientData.resetTime) {
    // Reset or initialize rate limit data
    rateLimitMap.set(clientId, {
      count: 1,
      resetTime: now + windowMs
    });
    
    return {
      allowed: true,
      resetTime: now + windowMs,
      remaining: maxRequests - 1
    };
  }

  if (clientData.count >= maxRequests) {
    return {
      allowed: false,
      resetTime: clientData.resetTime,
      remaining: 0
    };
  }

  clientData.count++;
  
  return {
    allowed: true,
    resetTime: clientData.resetTime,
    remaining: maxRequests - clientData.count
  };
}

/**
 * Validate session age
 */
export function validateSessionAge(
  sessionCreatedAt: string,
  maxAgeMs: number = 24 * 60 * 60 * 1000 // 24 hours
): { valid: boolean; age: number; expired: boolean } {
  const createdTime = new Date(sessionCreatedAt).getTime();
  const now = Date.now();
  const age = now - createdTime;
  
  return {
    valid: !isNaN(createdTime),
    age,
    expired: age > maxAgeMs
  };
}

/**
 * Validate message count per session
 */
export function validateMessageCount(
  currentCount: number,
  maxMessages: number = 100
): { valid: boolean; remaining: number; exceeded: boolean } {
  return {
    valid: currentCount >= 0,
    remaining: Math.max(0, maxMessages - currentCount),
    exceeded: currentCount >= maxMessages
  };
}

/**
 * Content length validation
 */
export function validateContentLength(
  content: string,
  maxLength: number = 10000
): { valid: boolean; length: number; exceeded: boolean } {
  const length = content.length;
  
  return {
    valid: length > 0,
    length,
    exceeded: length > maxLength
  };
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
 * Validate client ID format
 */
export function validateClientId(clientId: string): boolean {
  // Allow alphanumeric, hyphens, and underscores, 8-50 characters
  const clientIdRegex = /^[a-zA-Z0-9\-_]{8,50}$/;
  return clientIdRegex.test(clientId);
}
