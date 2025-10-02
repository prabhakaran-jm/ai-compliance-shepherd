import { Octokit } from '@octokit/rest';
import { PullRequestEvent, PullRequestSynchronizeEvent } from '@octokit/webhooks-types';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { logger } from '../utils/logger';
import { GitHubWebhookError, TerraformAnalysisError } from '../utils/errorHandler';

export interface WebhookEventData {
  event: string;
  delivery: string;
  payload: any;
  correlationId: string;
}

export interface WebhookProcessingResult {
  processed: boolean;
  action: string;
  repository?: string;
  pullRequest?: number;
  analysisTriggered?: boolean;
  commentPosted?: boolean;
  message?: string;
}

export interface TerraformPlanAnalysisResult {
  scanId: string;
  findings: any[];
  summary: {
    totalFindings: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
    complianceScore: number;
  };
  reportUrl?: string;
}

/**
 * Service for handling GitHub webhook events and integrating with Terraform plan analysis
 */
export class GitHubWebhookHandlerService {
  private octokit: Octokit | null = null;
  private lambdaClient: LambdaClient;
  private secretsClient: SecretsManagerClient;

  constructor() {
    this.lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
  }

  /**
   * Initialize GitHub client with authentication
   */
  private async initializeGitHubClient(): Promise<void> {
    if (this.octokit) {
      return;
    }

    try {
      const secretName = process.env.GITHUB_TOKEN_SECRET_NAME || 'ai-compliance-shepherd/github-token';
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await this.secretsClient.send(command);
      
      if (!response.SecretString) {
        throw new GitHubWebhookError('GitHub token not found in secrets manager');
      }

      const secret = JSON.parse(response.SecretString);
      const githubToken = secret.token || secret.github_token;

      if (!githubToken) {
        throw new GitHubWebhookError('GitHub token not found in secret');
      }

      this.octokit = new Octokit({
        auth: githubToken,
        userAgent: 'AI Compliance Shepherd v1.0.0'
      });

      logger.info('GitHub client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize GitHub client', { error });
      throw new GitHubWebhookError('Failed to initialize GitHub client', error);
    }
  }

  /**
   * Process incoming webhook event
   */
  async processWebhookEvent(eventData: WebhookEventData): Promise<WebhookProcessingResult> {
    const { event, delivery, payload, correlationId } = eventData;

    logger.info('Processing webhook event', {
      correlationId,
      event,
      delivery,
      repository: payload.repository?.full_name,
      action: payload.action
    });

    // Only process pull request events
    if (event !== 'pull_request') {
      return {
        processed: false,
        action: 'ignored',
        message: `Event type '${event}' not supported`
      };
    }

    // Only process opened, synchronize, and reopened actions
    const supportedActions = ['opened', 'synchronize', 'reopened'];
    if (!supportedActions.includes(payload.action)) {
      return {
        processed: false,
        action: 'ignored',
        message: `Action '${payload.action}' not supported`
      };
    }

    const pullRequestPayload = payload as PullRequestEvent | PullRequestSynchronizeEvent;
    const { repository, pull_request } = pullRequestPayload;

    try {
      await this.initializeGitHubClient();

      // Check if PR contains Terraform files
      const hasTerraformFiles = await this.checkForTerraformFiles(
        repository.owner.login,
        repository.name,
        pull_request.head.sha,
        correlationId
      );

      if (!hasTerraformFiles) {
        logger.info('No Terraform files found in PR', {
          correlationId,
          repository: repository.full_name,
          pullRequest: pull_request.number
        });

        return {
          processed: true,
          action: 'skipped',
          repository: repository.full_name,
          pullRequest: pull_request.number,
          message: 'No Terraform files found in pull request'
        };
      }

      // Get Terraform plan from PR
      const terraformPlan = await this.extractTerraformPlan(
        repository.owner.login,
        repository.name,
        pull_request.number,
        correlationId
      );

      if (!terraformPlan) {
        // Post comment asking for Terraform plan
        await this.postPlanRequestComment(
          repository.owner.login,
          repository.name,
          pull_request.number,
          correlationId
        );

        return {
          processed: true,
          action: 'plan_requested',
          repository: repository.full_name,
          pullRequest: pull_request.number,
          commentPosted: true,
          message: 'Terraform plan requested'
        };
      }

      // Analyze Terraform plan
      const analysisResult = await this.analyzeTerraformPlan(
        terraformPlan,
        {
          repository: repository.full_name,
          pullRequest: pull_request.number,
          branch: pull_request.head.ref,
          sha: pull_request.head.sha
        },
        correlationId
      );

      // Post analysis results as PR comment
      await this.postAnalysisComment(
        repository.owner.login,
        repository.name,
        pull_request.number,
        analysisResult,
        correlationId
      );

      return {
        processed: true,
        action: 'analyzed',
        repository: repository.full_name,
        pullRequest: pull_request.number,
        analysisTriggered: true,
        commentPosted: true,
        message: 'Terraform plan analyzed and comment posted'
      };

    } catch (error) {
      logger.error('Error processing webhook event', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        repository: repository.full_name,
        pullRequest: pull_request.number
      });

      // Post error comment to PR
      try {
        await this.postErrorComment(
          repository.owner.login,
          repository.name,
          pull_request.number,
          error,
          correlationId
        );
      } catch (commentError) {
        logger.error('Failed to post error comment', {
          correlationId,
          error: commentError
        });
      }

      throw error;
    }
  }

  /**
   * Check if PR contains Terraform files
   */
  private async checkForTerraformFiles(
    owner: string,
    repo: string,
    sha: string,
    correlationId: string
  ): Promise<boolean> {
    try {
      if (!this.octokit) {
        throw new GitHubWebhookError('GitHub client not initialized');
      }

      const { data: commit } = await this.octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: sha
      });

      const terraformExtensions = ['.tf', '.tfvars', '.tfplan'];
      const hasTerraformFiles = commit.files?.some(file => 
        terraformExtensions.some(ext => file.filename.endsWith(ext))
      ) || false;

      logger.info('Checked for Terraform files', {
        correlationId,
        owner,
        repo,
        sha,
        hasTerraformFiles,
        filesCount: commit.files?.length || 0
      });

      return hasTerraformFiles;
    } catch (error) {
      logger.error('Error checking for Terraform files', {
        correlationId,
        error
      });
      return false;
    }
  }

  /**
   * Extract Terraform plan from PR (from comments or artifacts)
   */
  private async extractTerraformPlan(
    owner: string,
    repo: string,
    pullNumber: number,
    correlationId: string
  ): Promise<string | null> {
    try {
      if (!this.octokit) {
        throw new GitHubWebhookError('GitHub client not initialized');
      }

      // Get PR comments
      const { data: comments } = await this.octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: pullNumber
      });

      // Look for Terraform plan in comments
      const planComment = comments.find(comment => 
        comment.body?.includes('terraform plan') ||
        comment.body?.includes('Plan:') ||
        comment.body?.includes('```terraform') ||
        comment.body?.includes('```hcl')
      );

      if (planComment?.body) {
        // Extract plan from comment
        const planMatch = planComment.body.match(/```(?:terraform|hcl)?\n([\s\S]*?)\n```/);
        if (planMatch) {
          logger.info('Terraform plan extracted from comment', {
            correlationId,
            commentId: planComment.id,
            planLength: planMatch[1].length
          });
          return planMatch[1];
        }
      }

      // TODO: Check for plan artifacts in workflow runs
      // This would require additional GitHub API calls to check workflow artifacts

      logger.info('No Terraform plan found in PR', {
        correlationId,
        owner,
        repo,
        pullNumber,
        commentsChecked: comments.length
      });

      return null;
    } catch (error) {
      logger.error('Error extracting Terraform plan', {
        correlationId,
        error
      });
      return null;
    }
  }

  /**
   * Analyze Terraform plan using the analyze-terraform-plan Lambda
   */
  private async analyzeTerraformPlan(
    terraformPlan: string,
    context: {
      repository: string;
      pullRequest: number;
      branch: string;
      sha: string;
    },
    correlationId: string
  ): Promise<TerraformPlanAnalysisResult> {
    try {
      const functionName = process.env.TERRAFORM_ANALYZER_FUNCTION_NAME || 'ai-compliance-shepherd-analyze-terraform-plan';
      
      const payload = {
        terraformPlan,
        context: {
          source: 'github_pr',
          ...context
        },
        options: {
          includeRemediation: true,
          generateReport: true,
          frameworks: ['SOC2', 'HIPAA', 'GDPR']
        }
      };

      const command = new InvokeCommand({
        FunctionName: functionName,
        Payload: JSON.stringify(payload),
        InvocationType: 'RequestResponse'
      });

      const response = await this.lambdaClient.send(command);
      
      if (!response.Payload) {
        throw new TerraformAnalysisError('No response from Terraform analyzer');
      }

      const result = JSON.parse(Buffer.from(response.Payload).toString());
      
      if (result.errorMessage) {
        throw new TerraformAnalysisError(`Terraform analysis failed: ${result.errorMessage}`);
      }

      logger.info('Terraform plan analyzed successfully', {
        correlationId,
        scanId: result.scanId,
        findingsCount: result.findings?.length || 0,
        complianceScore: result.summary?.complianceScore
      });

      return result;
    } catch (error) {
      logger.error('Error analyzing Terraform plan', {
        correlationId,
        error
      });
      throw new TerraformAnalysisError('Failed to analyze Terraform plan', error);
    }
  }

  /**
   * Post comment requesting Terraform plan
   */
  private async postPlanRequestComment(
    owner: string,
    repo: string,
    pullNumber: number,
    correlationId: string
  ): Promise<void> {
    try {
      if (!this.octokit) {
        throw new GitHubWebhookError('GitHub client not initialized');
      }

      const body = `## 🔍 AI Compliance Shepherd

I detected Terraform files in this pull request but couldn't find a Terraform plan to analyze.

To get compliance analysis for your infrastructure changes, please:

1. **Generate a Terraform plan:**
   \`\`\`bash
   terraform plan -out=tfplan.binary
   terraform show -json tfplan.binary > tfplan.json
   \`\`\`

2. **Share the plan in a comment:**
   \`\`\`terraform
   # Paste your terraform plan output here
   \`\`\`

Or configure your CI/CD pipeline to automatically post Terraform plans as PR comments.

---
*Powered by AI Compliance Shepherd - Automated Infrastructure Compliance*`;

      await this.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body
      });

      logger.info('Plan request comment posted', {
        correlationId,
        owner,
        repo,
        pullNumber
      });
    } catch (error) {
      logger.error('Error posting plan request comment', {
        correlationId,
        error
      });
      throw error;
    }
  }

  /**
   * Post analysis results as PR comment
   */
  private async postAnalysisComment(
    owner: string,
    repo: string,
    pullNumber: number,
    analysisResult: TerraformPlanAnalysisResult,
    correlationId: string
  ): Promise<void> {
    try {
      if (!this.octokit) {
        throw new GitHubWebhookError('GitHub client not initialized');
      }

      const { summary, findings } = analysisResult;
      const complianceScore = Math.round(summary.complianceScore * 100);
      
      // Determine overall status
      let statusIcon = '✅';
      let statusText = 'PASSED';
      if (summary.criticalFindings > 0) {
        statusIcon = '❌';
        statusText = 'FAILED';
      } else if (summary.highFindings > 0) {
        statusIcon = '⚠️';
        statusText = 'WARNING';
      }

      // Build comment body
      let body = `## ${statusIcon} AI Compliance Shepherd Analysis

**Status:** ${statusText} | **Compliance Score:** ${complianceScore}%

### 📊 Summary
| Severity | Count |
|----------|-------|
| 🔴 Critical | ${summary.criticalFindings} |
| 🟠 High | ${summary.highFindings} |
| 🟡 Medium | ${summary.mediumFindings} |
| 🔵 Low | ${summary.lowFindings} |
| **Total** | **${summary.totalFindings}** |

`;

      // Add critical and high findings details
      const criticalAndHighFindings = findings.filter(f => 
        f.severity === 'CRITICAL' || f.severity === 'HIGH'
      ).slice(0, 10); // Limit to first 10

      if (criticalAndHighFindings.length > 0) {
        body += `### 🚨 Critical & High Severity Issues\n\n`;
        
        for (const finding of criticalAndHighFindings) {
          const severityIcon = finding.severity === 'CRITICAL' ? '🔴' : '🟠';
          body += `#### ${severityIcon} ${finding.title}\n`;
          body += `**Resource:** \`${finding.resourceId}\`\n`;
          body += `**Framework:** ${finding.framework}\n`;
          body += `**Description:** ${finding.description}\n`;
          
          if (finding.remediation?.description) {
            body += `**Remediation:** ${finding.remediation.description}\n`;
          }
          
          body += `\n`;
        }
      }

      // Add compliance frameworks section
      const frameworks = [...new Set(findings.map(f => f.framework))];
      if (frameworks.length > 0) {
        body += `### 📋 Compliance Frameworks\n`;
        body += `This analysis covers: ${frameworks.join(', ')}\n\n`;
      }

      // Add report link if available
      if (analysisResult.reportUrl) {
        body += `### 📄 Detailed Report\n`;
        body += `[View Full Compliance Report](${analysisResult.reportUrl})\n\n`;
      }

      // Add footer
      body += `---\n`;
      body += `*Analysis ID: \`${analysisResult.scanId}\`*\n`;
      body += `*Powered by AI Compliance Shepherd - Automated Infrastructure Compliance*`;

      await this.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body
      });

      logger.info('Analysis comment posted', {
        correlationId,
        owner,
        repo,
        pullNumber,
        scanId: analysisResult.scanId,
        complianceScore,
        totalFindings: summary.totalFindings
      });
    } catch (error) {
      logger.error('Error posting analysis comment', {
        correlationId,
        error
      });
      throw error;
    }
  }

  /**
   * Post error comment to PR
   */
  private async postErrorComment(
    owner: string,
    repo: string,
    pullNumber: number,
    error: any,
    correlationId: string
  ): Promise<void> {
    try {
      if (!this.octokit) {
        return; // Can't post comment without GitHub client
      }

      const body = `## ❌ AI Compliance Shepherd Error

I encountered an error while analyzing your Terraform plan:

\`\`\`
${error instanceof Error ? error.message : 'Unknown error occurred'}
\`\`\`

Please check your Terraform plan format and try again. If the issue persists, contact support.

---
*Error ID: \`${correlationId}\`*
*Powered by AI Compliance Shepherd - Automated Infrastructure Compliance*`;

      await this.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body
      });

      logger.info('Error comment posted', {
        correlationId,
        owner,
        repo,
        pullNumber
      });
    } catch (commentError) {
      logger.error('Failed to post error comment', {
        correlationId,
        error: commentError
      });
    }
  }
}
