import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { SecurityGuardrailsService } from './services/SecurityGuardrailsService';
import { InputValidationService } from './services/InputValidationService';
import { RateLimitingService } from './services/RateLimitingService';
import { ThreatDetectionService } from './services/ThreatDetectionService';
import { logger } from './utils/logger';
import { handleError, ValidationError, SecurityError } from './utils/errorHandler';
import { z } from 'zod';

// Request validation schemas
const ValidateInputRequestSchema = z.object({
  input: z.any(),
  validationType: z.enum(['sql_injection', 'xss', 'command_injection', 'path_traversal', 'general']),
  context: z.string().optional()
});

const CheckRateLimitRequestSchema = z.object({
  identifier: z.string().min(1).max(256),
  resource: z.string().min(1).max(256),
  tenantId: z.string().min(1).max(100)
});

const AnalyzeThreatRequestSchema = z.object({
  requestData: z.object({
    headers: z.record(z.string()).optional(),
    body: z.string().optional(),
    queryParams: z.record(z.string()).optional(),
    sourceIp: z.string().optional(),
    userAgent: z.string().optional()
  }),
  tenantId: z.string().min(1).max(100),
  context: z.string().optional()
});

// Initialize services
const guardrailsService = new SecurityGuardrailsService();
const inputValidationService = new InputValidationService();
const rateLimitingService = new RateLimitingService();
const threatDetectionService = new ThreatDetectionService();

/**
 * Main Lambda handler for security guardrails operations
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const correlationId = context.awsRequestId;
  
  logger.info('Security guardrails request received', {
    correlationId,
    httpMethod: event.httpMethod,
    path: event.path,
    userAgent: event.headers['User-Agent'],
    sourceIp: event.requestContext.identity.sourceIp
  });

  try {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: ''
      };
    }

    // Apply security guardrails to the incoming request
    const securityCheck = await guardrailsService.validateRequest(event, correlationId);
    
    if (!securityCheck.allowed) {
      logger.security('Request blocked by security guardrails', {
        correlationId,
        reason: securityCheck.reason,
        riskScore: securityCheck.riskScore,
        sourceIp: event.requestContext.identity.sourceIp
      });

      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'SECURITY_VIOLATION',
            message: 'Request blocked by security guardrails',
            reason: securityCheck.reason,
            correlationId
          }
        })
      };
    }

    // Route requests based on path and method
    const path = event.path;
    const method = event.httpMethod;

    let result: any;

    switch (true) {
      case path === '/validate-input' && method === 'POST':
        result = await handleValidateInput(event, correlationId);
        break;
      
      case path === '/check-rate-limit' && method === 'POST':
        result = await handleCheckRateLimit(event, correlationId);
        break;
      
      case path === '/analyze-threat' && method === 'POST':
        result = await handleAnalyzeThreat(event, correlationId);
        break;
      
      case path === '/security-status' && method === 'GET':
        result = await handleSecurityStatus(event, correlationId);
        break;
      
      case path === '/health' && method === 'GET':
        result = await handleHealthCheck(correlationId);
        break;
      
      default:
        throw new ValidationError(`Unsupported path: ${method} ${path}`);
    }

    logger.info('Security guardrails request completed successfully', {
      correlationId,
      statusCode: 200,
      riskScore: securityCheck.riskScore
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: result,
        security: {
          riskScore: securityCheck.riskScore,
          checks: securityCheck.checks
        },
        correlationId
      })
    };

  } catch (error) {
    return handleError(error, correlationId);
  }
};

/**
 * Handle input validation request
 */
async function handleValidateInput(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const body = JSON.parse(event.body || '{}');
  const validatedData = ValidateInputRequestSchema.parse(body);

  logger.info('Processing input validation request', {
    correlationId,
    validationType: validatedData.validationType,
    hasContext: !!validatedData.context
  });

  const result = await inputValidationService.validateInput(
    validatedData.input,
    validatedData.validationType,
    validatedData.context
  );

  if (!result.isValid) {
    logger.security('Input validation failed', {
      correlationId,
      validationType: validatedData.validationType,
      violations: result.violations,
      riskScore: result.riskScore
    });
  }

  return {
    isValid: result.isValid,
    violations: result.violations,
    sanitizedInput: result.sanitizedInput,
    riskScore: result.riskScore,
    recommendations: result.recommendations
  };
}

/**
 * Handle rate limit check request
 */
async function handleCheckRateLimit(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const body = JSON.parse(event.body || '{}');
  const validatedData = CheckRateLimitRequestSchema.parse(body);

  logger.info('Processing rate limit check request', {
    correlationId,
    identifier: validatedData.identifier,
    resource: validatedData.resource,
    tenantId: validatedData.tenantId
  });

  const result = await rateLimitingService.checkRateLimit(
    validatedData.identifier,
    validatedData.resource,
    validatedData.tenantId
  );

  if (!result.allowed) {
    logger.security('Rate limit exceeded', {
      correlationId,
      identifier: validatedData.identifier,
      resource: validatedData.resource,
      tenantId: validatedData.tenantId,
      currentCount: result.currentCount,
      limit: result.limit
    });
  }

  return {
    allowed: result.allowed,
    currentCount: result.currentCount,
    limit: result.limit,
    resetTime: result.resetTime,
    retryAfter: result.retryAfter
  };
}

/**
 * Handle threat analysis request
 */
async function handleAnalyzeThreat(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const body = JSON.parse(event.body || '{}');
  const validatedData = AnalyzeThreatRequestSchema.parse(body);

  logger.info('Processing threat analysis request', {
    correlationId,
    tenantId: validatedData.tenantId,
    hasHeaders: !!validatedData.requestData.headers,
    hasBody: !!validatedData.requestData.body,
    sourceIp: validatedData.requestData.sourceIp
  });

  const result = await threatDetectionService.analyzeThreat(
    validatedData.requestData,
    validatedData.tenantId,
    validatedData.context
  );

  if (result.threatLevel === 'HIGH' || result.threatLevel === 'CRITICAL') {
    logger.security('High-risk threat detected', {
      correlationId,
      tenantId: validatedData.tenantId,
      threatLevel: result.threatLevel,
      threatTypes: result.threatTypes,
      riskScore: result.riskScore,
      sourceIp: validatedData.requestData.sourceIp
    });
  }

  return {
    threatLevel: result.threatLevel,
    threatTypes: result.threatTypes,
    riskScore: result.riskScore,
    confidence: result.confidence,
    recommendations: result.recommendations,
    blockedReasons: result.blockedReasons
  };
}

/**
 * Handle security status request
 */
async function handleSecurityStatus(event: APIGatewayProxyEvent, correlationId: string): Promise<any> {
  const tenantId = event.queryStringParameters?.tenantId;
  const timeRange = event.queryStringParameters?.timeRange || '24h';

  logger.info('Processing security status request', {
    correlationId,
    tenantId,
    timeRange
  });

  const result = await guardrailsService.getSecurityStatus(tenantId, timeRange);

  return {
    status: result.status,
    metrics: result.metrics,
    alerts: result.alerts,
    recommendations: result.recommendations,
    lastUpdated: result.lastUpdated
  };
}

/**
 * Handle health check request
 */
async function handleHealthCheck(correlationId: string): Promise<any> {
  logger.info('Processing health check request', { correlationId });

  const health = await guardrailsService.healthCheck();

  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'security-guardrails',
    version: '1.0.0',
    checks: health
  };
}
