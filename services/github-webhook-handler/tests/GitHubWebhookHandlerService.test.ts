import { GitHubWebhookHandlerService, WebhookEventData, TerraformPlanAnalysisResult } from '../src/services/GitHubWebhookHandlerService';
import { logger } from '../src/utils/logger';

// Mock dependencies
jest.mock('@octokit/rest');
jest.mock('@aws-sdk/client-lambda');
jest.mock('@aws-sdk/client-secrets-manager');
jest.mock('../src/utils/logger');

const mockOctokit = {
  rest: {
    repos: {
      getCommit: jest.fn()
    },
    issues: {
      listComments: jest.fn(),
      createComment: jest.fn()
    }
  }
};

const mockLambdaClient = {
  send: jest.fn()
};

const mockSecretsClient = {
  send: jest.fn()
};

// Mock modules
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(() => mockOctokit)
}));

jest.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: jest.fn(() => mockLambdaClient),
  InvokeCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn(() => mockSecretsClient),
  GetSecretValueCommand: jest.fn()
}));

describe('GitHubWebhookHandlerService', () => {
  let service: GitHubWebhookHandlerService;
  let mockLogger: jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GitHubWebhookHandlerService();
    mockLogger = logger as jest.Mocked<typeof logger>;

    // Mock environment variables
    process.env.AWS_REGION = 'us-east-1';
    process.env.GITHUB_TOKEN_SECRET_NAME = 'test-secret';
    process.env.TERRAFORM_ANALYZER_FUNCTION_NAME = 'test-function';
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('processWebhookEvent', () => {
    const mockEventData: WebhookEventData = {
      event: 'pull_request',
      delivery: 'test-delivery-123',
      payload: {
        action: 'opened',
        repository: {
          full_name: 'test-owner/test-repo',
          owner: { login: 'test-owner' },
          name: 'test-repo'
        },
        pull_request: {
          number: 123,
          head: {
            ref: 'feature-branch',
            sha: 'abc123'
          }
        }
      },
      correlationId: 'test-correlation-id'
    };

    it('should ignore non-pull-request events', async () => {
      const eventData = {
        ...mockEventData,
        event: 'push'
      };

      const result = await service.processWebhookEvent(eventData);

      expect(result).toEqual({
        processed: false,
        action: 'ignored',
        message: "Event type 'push' not supported"
      });
    });

    it('should ignore unsupported pull request actions', async () => {
      const eventData = {
        ...mockEventData,
        payload: {
          ...mockEventData.payload,
          action: 'closed'
        }
      };

      const result = await service.processWebhookEvent(eventData);

      expect(result).toEqual({
        processed: false,
        action: 'ignored',
        message: "Action 'closed' not supported"
      });
    });

    it('should skip PRs without Terraform files', async () => {
      // Mock GitHub token retrieval
      mockSecretsClient.send.mockResolvedValueOnce({
        SecretString: JSON.stringify({ token: 'github-token' })
      });

      // Mock commit with no Terraform files
      mockOctokit.rest.repos.getCommit.mockResolvedValueOnce({
        data: {
          files: [
            { filename: 'README.md' },
            { filename: 'src/index.js' }
          ]
        }
      });

      const result = await service.processWebhookEvent(mockEventData);

      expect(result).toEqual({
        processed: true,
        action: 'skipped',
        repository: 'test-owner/test-repo',
        pullRequest: 123,
        message: 'No Terraform files found in pull request'
      });
    });

    it('should request Terraform plan when files exist but no plan found', async () => {
      // Mock GitHub token retrieval
      mockSecretsClient.send.mockResolvedValueOnce({
        SecretString: JSON.stringify({ token: 'github-token' })
      });

      // Mock commit with Terraform files
      mockOctokit.rest.repos.getCommit.mockResolvedValueOnce({
        data: {
          files: [
            { filename: 'main.tf' },
            { filename: 'variables.tf' }
          ]
        }
      });

      // Mock no comments with Terraform plan
      mockOctokit.rest.issues.listComments.mockResolvedValueOnce({
        data: []
      });

      // Mock comment creation
      mockOctokit.rest.issues.createComment.mockResolvedValueOnce({
        data: { id: 456 }
      });

      const result = await service.processWebhookEvent(mockEventData);

      expect(result).toEqual({
        processed: true,
        action: 'plan_requested',
        repository: 'test-owner/test-repo',
        pullRequest: 123,
        commentPosted: true,
        message: 'Terraform plan requested'
      });

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        body: expect.stringContaining('AI Compliance Shepherd')
      });
    });

    it('should analyze Terraform plan when found', async () => {
      // Mock GitHub token retrieval
      mockSecretsClient.send.mockResolvedValueOnce({
        SecretString: JSON.stringify({ token: 'github-token' })
      });

      // Mock commit with Terraform files
      mockOctokit.rest.repos.getCommit.mockResolvedValueOnce({
        data: {
          files: [
            { filename: 'main.tf' }
          ]
        }
      });

      // Mock comment with Terraform plan
      mockOctokit.rest.issues.listComments.mockResolvedValueOnce({
        data: [
          {
            id: 789,
            body: '```terraform\nresource "aws_s3_bucket" "test" {\n  bucket = "test-bucket"\n}\n```'
          }
        ]
      });

      // Mock Terraform analysis result
      const mockAnalysisResult: TerraformPlanAnalysisResult = {
        scanId: 'scan-123',
        findings: [
          {
            id: 'finding-1',
            title: 'S3 bucket encryption not enabled',
            severity: 'HIGH',
            framework: 'SOC2',
            resourceId: 'aws_s3_bucket.test',
            description: 'S3 bucket should have encryption enabled',
            remediation: {
              description: 'Enable server-side encryption'
            }
          }
        ],
        summary: {
          totalFindings: 1,
          criticalFindings: 0,
          highFindings: 1,
          mediumFindings: 0,
          lowFindings: 0,
          complianceScore: 0.8
        },
        reportUrl: 'https://example.com/report'
      };

      mockLambdaClient.send.mockResolvedValueOnce({
        Payload: Buffer.from(JSON.stringify(mockAnalysisResult))
      });

      // Mock comment creation
      mockOctokit.rest.issues.createComment.mockResolvedValueOnce({
        data: { id: 890 }
      });

      const result = await service.processWebhookEvent(mockEventData);

      expect(result).toEqual({
        processed: true,
        action: 'analyzed',
        repository: 'test-owner/test-repo',
        pullRequest: 123,
        analysisTriggered: true,
        commentPosted: true,
        message: 'Terraform plan analyzed and comment posted'
      });

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        body: expect.stringContaining('⚠️ AI Compliance Shepherd Analysis')
      });
    });

    it('should handle GitHub API errors', async () => {
      // Mock GitHub token retrieval
      mockSecretsClient.send.mockResolvedValueOnce({
        SecretString: JSON.stringify({ token: 'github-token' })
      });

      // Mock GitHub API error
      mockOctokit.rest.repos.getCommit.mockRejectedValueOnce(
        new Error('GitHub API error')
      );

      await expect(service.processWebhookEvent(mockEventData)).rejects.toThrow();
    });

    it('should handle Terraform analysis errors', async () => {
      // Mock GitHub token retrieval
      mockSecretsClient.send.mockResolvedValueOnce({
        SecretString: JSON.stringify({ token: 'github-token' })
      });

      // Mock commit with Terraform files
      mockOctokit.rest.repos.getCommit.mockResolvedValueOnce({
        data: {
          files: [{ filename: 'main.tf' }]
        }
      });

      // Mock comment with Terraform plan
      mockOctokit.rest.issues.listComments.mockResolvedValueOnce({
        data: [
          {
            id: 789,
            body: '```terraform\nresource "aws_s3_bucket" "test" {}\n```'
          }
        ]
      });

      // Mock Lambda error
      mockLambdaClient.send.mockResolvedValueOnce({
        Payload: Buffer.from(JSON.stringify({
          errorMessage: 'Analysis failed'
        }))
      });

      // Mock error comment creation
      mockOctokit.rest.issues.createComment.mockResolvedValueOnce({
        data: { id: 999 }
      });

      await expect(service.processWebhookEvent(mockEventData)).rejects.toThrow();
    });
  });

  describe('GitHub token initialization', () => {
    it('should handle missing GitHub token secret', async () => {
      mockSecretsClient.send.mockResolvedValueOnce({
        SecretString: undefined
      });

      await expect(service.processWebhookEvent(mockEventData)).rejects.toThrow(
        'GitHub token not found in secrets manager'
      );
    });

    it('should handle invalid secret format', async () => {
      mockSecretsClient.send.mockResolvedValueOnce({
        SecretString: JSON.stringify({ invalid: 'format' })
      });

      await expect(service.processWebhookEvent(mockEventData)).rejects.toThrow(
        'GitHub token not found in secret'
      );
    });

    it('should handle secrets manager errors', async () => {
      mockSecretsClient.send.mockRejectedValueOnce(
        new Error('Secrets manager error')
      );

      await expect(service.processWebhookEvent(mockEventData)).rejects.toThrow();
    });
  });

  describe('Terraform file detection', () => {
    beforeEach(async () => {
      // Mock GitHub token retrieval
      mockSecretsClient.send.mockResolvedValueOnce({
        SecretString: JSON.stringify({ token: 'github-token' })
      });
    });

    it('should detect .tf files', async () => {
      mockOctokit.rest.repos.getCommit.mockResolvedValueOnce({
        data: {
          files: [{ filename: 'main.tf' }]
        }
      });

      mockOctokit.rest.issues.listComments.mockResolvedValueOnce({
        data: []
      });

      mockOctokit.rest.issues.createComment.mockResolvedValueOnce({
        data: { id: 123 }
      });

      const result = await service.processWebhookEvent(mockEventData);
      expect(result.action).toBe('plan_requested');
    });

    it('should detect .tfvars files', async () => {
      mockOctokit.rest.repos.getCommit.mockResolvedValueOnce({
        data: {
          files: [{ filename: 'terraform.tfvars' }]
        }
      });

      mockOctokit.rest.issues.listComments.mockResolvedValueOnce({
        data: []
      });

      mockOctokit.rest.issues.createComment.mockResolvedValueOnce({
        data: { id: 123 }
      });

      const result = await service.processWebhookEvent(mockEventData);
      expect(result.action).toBe('plan_requested');
    });

    it('should detect .tfplan files', async () => {
      mockOctokit.rest.repos.getCommit.mockResolvedValueOnce({
        data: {
          files: [{ filename: 'plan.tfplan' }]
        }
      });

      mockOctokit.rest.issues.listComments.mockResolvedValueOnce({
        data: []
      });

      mockOctokit.rest.issues.createComment.mockResolvedValueOnce({
        data: { id: 123 }
      });

      const result = await service.processWebhookEvent(mockEventData);
      expect(result.action).toBe('plan_requested');
    });
  });

  describe('Terraform plan extraction', () => {
    beforeEach(async () => {
      // Mock GitHub token retrieval
      mockSecretsClient.send.mockResolvedValueOnce({
        SecretString: JSON.stringify({ token: 'github-token' })
      });

      // Mock commit with Terraform files
      mockOctokit.rest.repos.getCommit.mockResolvedValueOnce({
        data: {
          files: [{ filename: 'main.tf' }]
        }
      });
    });

    it('should extract plan from terraform code block', async () => {
      const terraformPlan = 'resource "aws_s3_bucket" "test" {}';
      mockOctokit.rest.issues.listComments.mockResolvedValueOnce({
        data: [
          {
            id: 123,
            body: `\`\`\`terraform\n${terraformPlan}\n\`\`\``
          }
        ]
      });

      // Mock successful analysis
      mockLambdaClient.send.mockResolvedValueOnce({
        Payload: Buffer.from(JSON.stringify({
          scanId: 'test-scan',
          findings: [],
          summary: {
            totalFindings: 0,
            criticalFindings: 0,
            highFindings: 0,
            mediumFindings: 0,
            lowFindings: 0,
            complianceScore: 1.0
          }
        }))
      });

      mockOctokit.rest.issues.createComment.mockResolvedValueOnce({
        data: { id: 456 }
      });

      const result = await service.processWebhookEvent(mockEventData);
      expect(result.action).toBe('analyzed');
    });

    it('should extract plan from hcl code block', async () => {
      const terraformPlan = 'resource "aws_s3_bucket" "test" {}';
      mockOctokit.rest.issues.listComments.mockResolvedValueOnce({
        data: [
          {
            id: 123,
            body: `\`\`\`hcl\n${terraformPlan}\n\`\`\``
          }
        ]
      });

      // Mock successful analysis
      mockLambdaClient.send.mockResolvedValueOnce({
        Payload: Buffer.from(JSON.stringify({
          scanId: 'test-scan',
          findings: [],
          summary: {
            totalFindings: 0,
            criticalFindings: 0,
            highFindings: 0,
            mediumFindings: 0,
            lowFindings: 0,
            complianceScore: 1.0
          }
        }))
      });

      mockOctokit.rest.issues.createComment.mockResolvedValueOnce({
        data: { id: 456 }
      });

      const result = await service.processWebhookEvent(mockEventData);
      expect(result.action).toBe('analyzed');
    });

    it('should handle comments without terraform plans', async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValueOnce({
        data: [
          {
            id: 123,
            body: 'This is just a regular comment'
          }
        ]
      });

      mockOctokit.rest.issues.createComment.mockResolvedValueOnce({
        data: { id: 456 }
      });

      const result = await service.processWebhookEvent(mockEventData);
      expect(result.action).toBe('plan_requested');
    });
  });
});
