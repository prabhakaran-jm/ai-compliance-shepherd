import { APIGatewayProxyEvent } from 'aws-lambda';
import { z } from 'zod';
import { logger } from './logger';
import { validateWebhookSignature } from './errorHandler';

/**
 * Validation schemas for GitHub webhook payloads
 */
const GitHubRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  owner: z.object({
    login: z.string(),
    id: z.number()
  }),
  private: z.boolean(),
  default_branch: z.string().optional()
});

const GitHubUserSchema = z.object({
  login: z.string(),
  id: z.number(),
  type: z.string()
});

const GitHubPullRequestSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(['open', 'closed']),
  head: z.object({
    ref: z.string(),
    sha: z.string(),
    repo: GitHubRepositorySchema.nullable()
  }),
  base: z.object({
    ref: z.string(),
    sha: z.string(),
    repo: GitHubRepositorySchema
  }),
  user: GitHubUserSchema,
  draft: z.boolean().optional(),
  mergeable: z.boolean().nullable().optional(),
  mergeable_state: z.string().optional()
});

const PullRequestEventSchema = z.object({
  action: z.enum(['opened', 'closed', 'reopened', 'synchronize', 'edited', 'assigned', 'unassigned', 'labeled', 'unlabeled']),
  number: z.number(),
  pull_request: GitHubPullRequestSchema,
  repository: GitHubRepositorySchema,
  sender: GitHubUserSchema
});

const WebhookHeadersSchema = z.object({
  'x-github-event': z.string(),
  'x-github-delivery': z.string(),
  'x-hub-signature-256': z.string().optional(),
  'user-agent': z.string().optional()
});

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

export interface ValidatedWebhookPayload {
  payload: any;
  githubEvent: string;
  githubDelivery: string;
  signature?: string;
}

/**
 * Validate GitHub webhook payload and headers
 */
export function validateWebhookPayload(event: APIGatewayProxyEvent): ValidationResult<ValidatedWebhookPayload> {
  try {
    // Validate required headers
    const headerValidation = WebhookHeadersSchema.safeParse({
      'x-github-event': event.headers['x-github-event'] || event.headers['X-GitHub-Event'],
      'x-github-delivery': event.headers['x-github-delivery'] || event.headers['X-GitHub-Delivery'],
      'x-hub-signature-256': event.headers['x-hub-signature-256'] || event.headers['X-Hub-Signature-256'],
      'user-agent': event.headers['user-agent'] || event.headers['User-Agent']
    });

    if (!headerValidation.success) {
      return {
        success: false,
        errors: ['Missing required GitHub webhook headers']
      };
    }

    const { 'x-github-event': githubEvent, 'x-github-delivery': githubDelivery, 'x-hub-signature-256': signature } = headerValidation.data;

    // Validate payload exists
    if (!event.body) {
      return {
        success: false,
        errors: ['Missing webhook payload']
      };
    }

    // Parse JSON payload
    let payload: any;
    try {
      payload = JSON.parse(event.body);
    } catch (error) {
      return {
        success: false,
        errors: ['Invalid JSON payload']
      };
    }

    // Validate webhook signature if secret is configured
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const isValidSignature = validateWebhookSignature(event.body, signature, webhookSecret);
      if (!isValidSignature) {
        logger.warn('Invalid webhook signature', {
          githubEvent,
          githubDelivery,
          signature: signature.substring(0, 10) + '...'
        });
        return {
          success: false,
          errors: ['Invalid webhook signature']
        };
      }
    }

    // Validate specific event types
    if (githubEvent === 'pull_request') {
      const pullRequestValidation = PullRequestEventSchema.safeParse(payload);
      if (!pullRequestValidation.success) {
        const errors = pullRequestValidation.error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        );
        return {
          success: false,
          errors: [`Invalid pull request payload: ${errors.join(', ')}`]
        };
      }
    }

    return {
      success: true,
      data: {
        payload,
        githubEvent,
        githubDelivery,
        signature
      }
    };

  } catch (error) {
    logger.error('Error validating webhook payload', { error });
    return {
      success: false,
      errors: ['Webhook validation failed']
    };
  }
}

/**
 * Validate Terraform plan content
 */
export function validateTerraformPlan(plan: string): ValidationResult<string> {
  if (!plan || typeof plan !== 'string') {
    return {
      success: false,
      errors: ['Terraform plan must be a non-empty string']
    };
  }

  const trimmedPlan = plan.trim();
  if (trimmedPlan.length === 0) {
    return {
      success: false,
      errors: ['Terraform plan cannot be empty']
    };
  }

  // Check for common Terraform plan indicators
  const terraformIndicators = [
    'Terraform will perform',
    'Plan:',
    'terraform plan',
    '# ',
    'resource "',
    'data "',
    'module "'
  ];

  const hasValidContent = terraformIndicators.some(indicator => 
    trimmedPlan.includes(indicator)
  );

  if (!hasValidContent) {
    return {
      success: false,
      errors: ['Content does not appear to be a valid Terraform plan']
    };
  }

  // Check plan size (reasonable limits)
  const maxPlanSize = 10 * 1024 * 1024; // 10MB
  if (trimmedPlan.length > maxPlanSize) {
    return {
      success: false,
      errors: [`Terraform plan too large (${trimmedPlan.length} bytes, max ${maxPlanSize} bytes)`]
    };
  }

  return {
    success: true,
    data: trimmedPlan
  };
}

/**
 * Validate GitHub repository access
 */
export function validateRepositoryAccess(repository: any): ValidationResult<any> {
  try {
    const validation = GitHubRepositorySchema.safeParse(repository);
    
    if (!validation.success) {
      const errors = validation.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      );
      return {
        success: false,
        errors: [`Invalid repository data: ${errors.join(', ')}`]
      };
    }

    return {
      success: true,
      data: validation.data
    };
  } catch (error) {
    return {
      success: false,
      errors: ['Repository validation failed']
    };
  }
}

/**
 * Validate pull request data
 */
export function validatePullRequest(pullRequest: any): ValidationResult<any> {
  try {
    const validation = GitHubPullRequestSchema.safeParse(pullRequest);
    
    if (!validation.success) {
      const errors = validation.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      );
      return {
        success: false,
        errors: [`Invalid pull request data: ${errors.join(', ')}`]
      };
    }

    // Additional business logic validation
    if (validation.data.state !== 'open') {
      return {
        success: false,
        errors: ['Pull request must be open for analysis']
      };
    }

    return {
      success: true,
      data: validation.data
    };
  } catch (error) {
    return {
      success: false,
      errors: ['Pull request validation failed']
    };
  }
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
    .trim();
}

/**
 * Validate and sanitize comment content
 */
export function validateCommentContent(content: string): ValidationResult<string> {
  if (!content || typeof content !== 'string') {
    return {
      success: false,
      errors: ['Comment content must be a non-empty string']
    };
  }

  const trimmedContent = content.trim();
  if (trimmedContent.length === 0) {
    return {
      success: false,
      errors: ['Comment content cannot be empty']
    };
  }

  // Check maximum length (GitHub comment limit)
  const maxLength = 65536; // 64KB
  if (trimmedContent.length > maxLength) {
    return {
      success: false,
      errors: [`Comment too long (${trimmedContent.length} chars, max ${maxLength})`]
    };
  }

  // Sanitize content
  const sanitizedContent = sanitizeInput(trimmedContent);

  return {
    success: true,
    data: sanitizedContent
  };
}
