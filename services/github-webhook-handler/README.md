# GitHub Webhook Handler Service

The GitHub Webhook Handler Service provides automated Terraform plan analysis for pull requests. It integrates with GitHub webhooks to detect infrastructure changes and provides compliance feedback directly in pull request comments.

## Features

### Core Capabilities
- **Automatic PR Analysis**: Detects Terraform files in pull requests and triggers compliance analysis
- **GitHub Integration**: Seamless integration with GitHub webhooks and API
- **Terraform Plan Detection**: Extracts Terraform plans from PR comments or artifacts
- **Compliance Feedback**: Posts detailed compliance analysis results as PR comments
- **Multi-Framework Support**: Analyzes against SOC 2, HIPAA, GDPR, and other frameworks
- **Security Validation**: Validates webhook signatures and handles authentication securely

### Supported Events
- **Pull Request Opened**: Analyzes new pull requests with Terraform changes
- **Pull Request Synchronize**: Re-analyzes when new commits are pushed
- **Pull Request Reopened**: Analyzes reopened pull requests

### Analysis Features
- **Infrastructure Compliance**: Checks Terraform plans against compliance frameworks
- **Security Analysis**: Identifies security vulnerabilities and misconfigurations
- **Cost Analysis**: Provides cost impact and optimization recommendations
- **Detailed Reporting**: Generates comprehensive reports with remediation guidance

## Architecture

### Components
```
GitHub Webhook → API Gateway → Lambda Handler → Terraform Analyzer
                                    ↓
GitHub API ← Comment Generator ← Analysis Results
```

### Key Services
- **GitHubWebhookHandlerService**: Main orchestration service
- **Terraform Plan Analyzer**: Analyzes infrastructure code for compliance
- **GitHub API Client**: Manages GitHub API interactions
- **Comment Generator**: Creates formatted PR comments with results

### Dependencies
- **@octokit/rest**: GitHub API client
- **AWS Lambda**: Serverless compute for Terraform analysis
- **AWS Secrets Manager**: Secure storage for GitHub tokens
- **Terraform Analyzer Service**: Backend compliance analysis

## API Reference

### Webhook Endpoint
```
POST /webhook
```

**Headers:**
- `X-GitHub-Event`: GitHub event type (e.g., "pull_request")
- `X-GitHub-Delivery`: Unique delivery identifier
- `X-Hub-Signature-256`: Webhook signature for validation
- `Content-Type`: application/json

**Supported Events:**
- `pull_request` with actions: `opened`, `synchronize`, `reopened`

**Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "correlationId": "uuid",
  "result": {
    "processed": true,
    "action": "analyzed",
    "repository": "owner/repo",
    "pullRequest": 123,
    "analysisTriggered": true,
    "commentPosted": true
  }
}
```

## Configuration

### Environment Variables
```bash
# AWS Configuration
AWS_REGION=us-east-1
TERRAFORM_ANALYZER_FUNCTION_NAME=ai-compliance-shepherd-analyze-terraform-plan

# GitHub Configuration
GITHUB_TOKEN_SECRET_NAME=ai-compliance-shepherd/github-token
GITHUB_WEBHOOK_SECRET=your-webhook-secret

# Optional Configuration
NODE_ENV=production
DEBUG=false
```

### GitHub Token Setup
Store GitHub token in AWS Secrets Manager:
```json
{
  "token": "ghp_your_github_token_here"
}
```

**Required Permissions:**
- `repo`: Full repository access
- `pull_requests:write`: Create and update PR comments
- `contents:read`: Read repository contents

### Webhook Configuration
Configure GitHub webhook with:
- **Payload URL**: Your API Gateway endpoint
- **Content Type**: application/json
- **Secret**: Webhook secret for signature validation
- **Events**: Pull requests

## Usage Examples

### Basic Workflow
1. **Developer creates PR** with Terraform changes
2. **Webhook triggers** analysis automatically
3. **Service detects** Terraform files in the PR
4. **Analysis runs** against compliance frameworks
5. **Results posted** as PR comment with findings and recommendations

### Comment Examples

#### Plan Request Comment
```markdown
## 🔍 AI Compliance Shepherd

I detected Terraform files in this pull request but couldn't find a Terraform plan to analyze.

To get compliance analysis for your infrastructure changes, please:

1. **Generate a Terraform plan:**
   ```bash
   terraform plan -out=tfplan.binary
   terraform show -json tfplan.binary > tfplan.json
   ```

2. **Share the plan in a comment:**
   ```terraform
   # Paste your terraform plan output here
   ```
```

#### Analysis Results Comment
```markdown
## ✅ AI Compliance Shepherd Analysis

**Status:** PASSED | **Compliance Score:** 85%

### 📊 Summary
| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 2 |
| 🟡 Medium | 5 |
| 🔵 Low | 3 |
| **Total** | **10** |

### 🚨 Critical & High Severity Issues

#### 🟠 S3 bucket encryption not enabled
**Resource:** `aws_s3_bucket.example`
**Framework:** SOC2
**Description:** S3 bucket should have server-side encryption enabled
**Remediation:** Add server_side_encryption_configuration block
```

## Integration Guide

### CI/CD Integration
Integrate with your CI/CD pipeline to automatically post Terraform plans:

```yaml
# GitHub Actions Example
name: Terraform Plan
on:
  pull_request:
    paths:
      - '**/*.tf'
      - '**/*.tfvars'

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
        
      - name: Terraform Plan
        run: |
          terraform init
          terraform plan -out=tfplan.binary
          terraform show -json tfplan.binary > tfplan.json
          
      - name: Post Plan to PR
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const plan = fs.readFileSync('tfplan.json', 'utf8');
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `\`\`\`terraform\n${plan}\n\`\`\``
            });
```

### Manual Plan Posting
Developers can manually post Terraform plans in PR comments:

```bash
# Generate plan
terraform plan -out=tfplan.binary
terraform show -json tfplan.binary > tfplan.json

# Copy content and post in PR comment with terraform code block
```

## Security Features

### Webhook Security
- **Signature Validation**: Validates GitHub webhook signatures
- **Event Filtering**: Only processes authorized event types
- **Input Sanitization**: Sanitizes all user inputs
- **Rate Limiting**: Protects against abuse

### Authentication
- **GitHub Token**: Stored securely in AWS Secrets Manager
- **IAM Roles**: Least privilege access to AWS services
- **Encryption**: All data encrypted in transit and at rest

### Access Control
- **Repository Validation**: Validates repository access permissions
- **User Context**: Tracks user actions for audit purposes
- **Tenant Isolation**: Supports multi-tenant deployments

## Error Handling

### Common Errors
- **Invalid Webhook**: Malformed or unauthorized webhook payload
- **GitHub API Errors**: Rate limiting, authentication, or permission issues
- **Analysis Failures**: Terraform plan parsing or analysis errors
- **Comment Posting**: GitHub API errors when posting comments

### Error Responses
```json
{
  "success": false,
  "error": {
    "message": "GitHub API error occurred",
    "code": "GITHUB_API_ERROR",
    "correlationId": "uuid",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### Recovery Strategies
- **Automatic Retry**: Retries transient failures with exponential backoff
- **Error Comments**: Posts error information to PR when possible
- **Logging**: Comprehensive logging for debugging and monitoring
- **Fallback**: Graceful degradation when services are unavailable

## Monitoring and Logging

### Structured Logging
All operations are logged with structured JSON format:
```json
{
  "timestamp": "2024-01-01T00:00:00Z",
  "level": "INFO",
  "service": "github-webhook-handler",
  "message": "Webhook processed successfully",
  "correlationId": "uuid",
  "repository": "owner/repo",
  "pullRequest": 123,
  "action": "analyzed"
}
```

### Key Metrics
- **Webhook Processing Time**: Time to process webhook events
- **Analysis Success Rate**: Percentage of successful analyses
- **GitHub API Calls**: Rate and success of GitHub API operations
- **Error Rates**: Frequency and types of errors

### Monitoring Dashboards
- **Webhook Activity**: Volume and success rates
- **Analysis Performance**: Processing times and throughput
- **Error Tracking**: Error rates and types
- **GitHub Integration**: API usage and limits

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Test Coverage
- **Webhook Processing**: All event types and actions
- **GitHub Integration**: API calls and error handling
- **Terraform Analysis**: Plan extraction and analysis
- **Comment Generation**: All comment types and formats
- **Error Scenarios**: All error conditions and recovery

### Mock Data
Test fixtures include:
- Sample webhook payloads
- GitHub API responses
- Terraform plans and analysis results
- Error conditions and edge cases

## Deployment

### AWS Lambda Deployment
```bash
# Build the service
npm run build

# Deploy with AWS CLI
aws lambda create-function \
  --function-name ai-compliance-shepherd-github-webhook \
  --runtime nodejs18.x \
  --role arn:aws:iam::account:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://dist.zip
```

### API Gateway Integration
```yaml
# CloudFormation template
Resources:
  WebhookAPI:
    Type: AWS::ApiGateway::RestApi
    Properties:
      Name: github-webhook-api
      
  WebhookResource:
    Type: AWS::ApiGateway::Resource
    Properties:
      RestApiId: !Ref WebhookAPI
      ParentId: !GetAtt WebhookAPI.RootResourceId
      PathPart: webhook
      
  WebhookMethod:
    Type: AWS::ApiGateway::Method
    Properties:
      RestApiId: !Ref WebhookAPI
      ResourceId: !Ref WebhookResource
      HttpMethod: POST
      Integration:
        Type: AWS_PROXY
        IntegrationHttpMethod: POST
        Uri: !Sub arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${WebhookFunction.Arn}/invocations
```

### Environment Setup
1. **Create GitHub App** or Personal Access Token
2. **Store credentials** in AWS Secrets Manager
3. **Configure webhook** in GitHub repository settings
4. **Deploy Lambda function** with proper IAM permissions
5. **Set up API Gateway** endpoint
6. **Configure monitoring** and alerting

## Troubleshooting

### Common Issues

#### Webhook Not Triggering
- Check GitHub webhook configuration
- Verify API Gateway endpoint URL
- Check webhook secret configuration
- Review GitHub webhook delivery logs

#### Analysis Not Running
- Verify Terraform files are detected
- Check Terraform plan format in comments
- Review Lambda function logs
- Verify IAM permissions for Lambda invocation

#### Comments Not Posted
- Check GitHub token permissions
- Verify repository access
- Review GitHub API rate limits
- Check comment content size limits

#### Authentication Errors
- Verify GitHub token in Secrets Manager
- Check token permissions and expiration
- Review IAM roles and policies
- Validate webhook signature configuration

### Debug Mode
Enable debug logging:
```bash
export DEBUG=true
export NODE_ENV=development
```

### Log Analysis
Key log entries to monitor:
- Webhook event processing
- GitHub API interactions
- Terraform analysis results
- Error conditions and retries

## Best Practices

### Security
- **Rotate GitHub tokens** regularly
- **Use webhook secrets** for signature validation
- **Implement rate limiting** to prevent abuse
- **Monitor for suspicious activity**

### Performance
- **Optimize Terraform plan size** for faster processing
- **Use caching** for repeated analyses
- **Implement timeouts** for long-running operations
- **Monitor Lambda cold starts**

### Reliability
- **Implement retry logic** for transient failures
- **Use circuit breakers** for external dependencies
- **Monitor error rates** and set up alerts
- **Test failure scenarios** regularly

### Maintenance
- **Keep dependencies updated** for security patches
- **Monitor GitHub API changes** and deprecations
- **Review and update compliance rules** regularly
- **Maintain comprehensive test coverage**

## Support

### Documentation
- [GitHub Webhooks Documentation](https://docs.github.com/en/developers/webhooks-and-events/webhooks)
- [Octokit REST API](https://octokit.github.io/rest.js/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)

### Community
- GitHub Issues for bug reports and feature requests
- Slack channel for community support
- Documentation wiki for additional examples

### Enterprise Support
- Professional services for custom integrations
- Priority support for enterprise customers
- Training and onboarding assistance
