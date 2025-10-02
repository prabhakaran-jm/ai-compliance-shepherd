# AI Compliance Shepherd - CDK Infrastructure

This directory contains the AWS CDK (Cloud Development Kit) infrastructure code for deploying the AI Compliance Shepherd platform to AWS.

## 📋 Overview

The CDK infrastructure creates a complete, production-ready AWS environment with:

- **Multi-Stack Architecture**: Modular stacks for different components
- **Production-Ready**: Security, monitoring, and compliance built-in
- **Multi-Environment**: Support for dev, staging, and production deployments
- **Auto-Scaling**: Pay-per-use model with automatic scaling
- **Security-First**: Encryption, IAM roles, and security best practices

## 🏗️ Stack Architecture

### Core Stacks

| Stack | Purpose | Key Resources |
|-------|---------|---------------|
| **Core Stack** | Platform foundation | Environment configuration, platform info |
| **Database Stack** | Data persistence | DynamoDB tables, encryption keys |
| **Security Stack** | Security and identity | IAM roles, KMS keys, Cognito |
| **Storage Stack** | File storage | S3 buckets, CloudFront distribution |
| **Lambda Stack** | Compute layer | 16 Lambda functions |
| **API Stack** | API management | API Gateway, routes, authentication |
| **Monitoring Stack** | Observability | CloudWatch dashboards, alarms |
| **Integration Stack** | Third-party integrations | EventBridge, SNS, SQS |

### Dependency Flow

```
Core Stack
├── Database Stack
├── Security Stack
│   └── Storage Stack
│       └── Lambda Stack
│           ├── API Stack
│           ├── Monitoring Stack
│           └── Integration Stack
```

## 🚀 Quick Deployment

### Prerequisites

1. **AWS CLI**: Configured with appropriate credentials
2. **Node.js**: Version 18 or higher
3. **AWS CDK**: Install globally with `npm install -g aws-cdk`
4. **AWS Account**: With sufficient permissions

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ai-compliance-shepherd

# Navigate to CDK directory
cd infrastructure/cdk

# Install dependencies
npm install

# Bootstrap CDK (run once per region/account)
cdk bootstrap
```

### Deployment

#### Development Environment

```bash
# Deploy to development
npm run deploy:dev

# Or using the deployment script
./deploy.sh --environment dev
```

#### Production Deployment

```bash
# Deploy to production
npm run deploy:prod

# Or using the deployment script with verification
./deploy.sh --environment prod --region us-west-2 --verbose
```

### Dry Run / Diff

```bash
# See what changes would be made
npm run diff

# Or using deployment script
./deploy.sh --environment dev --dry-run
```

## 📊 Environment Configuration

### Development Environment

```typescript
const devConfig = {
  account: "123456789012",
  region: "us-east-1",
  environment: "dev",
  stage: "dev",
  prefix: "ai-compliance-dev"
};
```

### Staging Environment

```typescript
const stagingConfig = {
  account: "123456789012", 
  region: "us-east-1",
  environment: "staging",
  stage: "staging", 
  prefix: "ai-compliance-staging"
};
```

### Production Environment

```typescript
const prodConfig = {
  account: "123456789012",
  region: "us-west-2",
  environment: "prod",
  stage: "prod",
  prefix: "ai-compliance-prod"
};
```

## 🔧 Stack Details

### Database Stack

Creates **15 DynamoDB tables** with:

- **Encryption**: Customer-managed KMS keys
- **Auto-scaling**: Pay-per-request billing
- **Point-in-time recovery**: Enabled for all tables
- **Global Secondary Indexes**: Optimized for common queries
- **Streams**: Change data capture enabled

**Tables Created:**
- `tenants` - Customer tenant information
- `findings` - Compliance findings with GSIs
- `scan-jobs` - Scanning operations and results
- `remediation-jobs` - Automated remediation tracking
- `audit-logs` - Complete audit trail
- `compliance-rules` - Compliance rule definitions
- `notification-settings` - Tenant notification preferences
- `user-sessions` - User authentication sessions
- `subscriptions` - Marketplace subscription data
- `usage` - Usage tracking for metering
- `tenant-isolation` - Security isolation metadata
- `step-functions-templates` - Workflow templates
- `workflow-executions` - Workflow execution tracking
- `event-schedules` - Scheduled event configuration
- `integration-configs` - Third-party integration settings

### Security Stack

Creates **bank-grade security** with:

**IAM Roles:**
- `PlatformExecutionRole` - Lambda execution role
- `ScanRole` - Cross-account scanning (read-only)
- `RemediationRole` - Cross-account remediation (limited write)
- `AuditRole` - Enhanced audit evidence collection
- `ReadOnlyRole` - Minimal monitoring access

**KMS Keys:**
- `DynamoDBKey` - Database encryption
- `S3Key` - S3 object encryption
- `APIKey` - API data encryption
- `SecretsManagerKey` - Secrets encryption

**Cognito:**
- User pool with multi-factor authentication
- Custom attributes for tenant and role management
- Strong password policies
- Session management

### Storage Stack

Creates **4 S3 buckets** with:

- **Reports Bucket**: HTML/PDF reports with lifecycle policies
- **Artifacts Bucket**: Scan data and temporary files
- **Audit Packs Bucket**: Audit evidence packages
- **Static Assets Bucket**: Web UI with CloudFront distribution

**Features:**
- Server-side encryption with KMS
- Versioning enabled
- Lifecycle policies for cost optimization
- Public access blocked
- CloudFront CDN distribution

### Lambda Stack

Creates **16 Lambda functions** with:

**Core Services:**
- `scan-environment` - AWS resource scanning
- `findings-storage` - Findings management
- `api-gateway` - API routing and authentication
- `html-report-generator` - Professional reports
- `s3-bucket-manager` - S3 operations

**Analysis Services:**
- `terraform-analyzer` - Infrastructure as code analysis
- `github-webhook-handler` - GitHub integration
- `apply-fix` - Safe remediation automation

**AI Services:**
- `bedrock-knowledge-base` - Compliance knowledge management
- `bedrock-agent` - AI agent coordination
- `chat-interface` - Conversational AI interface

**Orchestration:**
- `step-functions-orchestrator` - Workflow management
- `eventbridge-scheduler` - Event scheduling
- `tenant-management` - Multi-tenant operations

**Business Logic:**
- `audit-pack-generator` - Evidence collection
- `slack-notifications` - Slack integration
- `web-ui` - Express.js web application

### API Stack

Creates **API Gateway** with:

- **REST API**: Regional deployment
- **Authentication**: Cognito and API key authorization
- **CORS**: Pre-configured for web UI
- **Rate Limiting**: Built-in throttling
- **Usage Plans**: Tiered API access
- **Monitoring**: CloudWatch integration

**Endpoints:**
- `/scans` - Scan management
- `/findings` - Findings access
- `/reports` - Report generation
- `/terraform` - Infrastructure analysis
- `/webhooks` - Third-party integrations
- `/chat` - AI chat interface
- `/admin` - Administrative functions

### Monitoring Stack

Creates **comprehensive monitoring** with:

**CloudWatch Dashboard:**
- Lambda function metrics
- API Gateway performance
- DynamoDB utilization
- S3 operations
- Business metrics tracking

**CloudWatch Alarms:**
- Lambda error rate monitoring
- Function duration alerts
- API Gateway error tracking
- DynamoDB throttling detection
- Compliance score monitoring

**Logging:**
- Centralized log groups
- Retention policies
- Business metrics extraction

### Integration Stack

Creates **third-party integrations** with:

**EventBridge:**
- Custom event bus for integrations
- GitHub webhook processing
- Slack notification routing
- Marketplace integration events

**SNS/SQS:**
- Slack notification topics
- GitHub webhook queues
- Dead letter queues for reliability

**Step Functions:**
- Scan workflow automation
- Remediation workflow automation

**Cross-Account Roles:**
- Customer integration roles
- Organization trust relationships

## 🔐 Security Features

### Multi-Layer Security

1. **Network Security**: Private networking, security groups
2. **Access Control**: IAM roles with least privilege
3. **Data Encryption**: KMS encryption for all data
4. **Audit Logging**: Complete action trail
5. **Authentication**: Multi-factor authentication

### Compliance Ready

- **SOC 2**: Security controls implementation
- **HIPAA**: Healthcare compliance ready
- **PCI-DSS**: Payment compliance support
- **GDPR**: Data protection mechanisms

## 💰 Cost Optimization

### Pay-Per-Use Model

- **DynamoDB**: Pay-per-request with auto-scaling
- **Lambda**: Pay per execution
- **API Gateway**: Pay per request
- **S3**: Pay for storage used

### Lifecycle Policies

- **Automated Tiering**: Infrequent Access → Glacier → Deep Archive
- **Data Retention**: Configurable retention periods
- **Log Rotation**: Automatic log management

## 🚀 Deployment Commands

### Development

```bash
# Deploy all stacks to development
npm run deploy:dev

# Deploy specific stack
cdk deploy ai-compliance-dev-database

# Diff changes
cdk diff --context environment=dev
```

### Staging

```bash
# Deploy to staging environment
npm run deploy:staging

# Verify deployment
cdk synth --context environment=staging
```

### Production

```bash
# Deploy to production
npm run deploy:prod

# With additional validation
cdk deploy --require-approval never --context environment=prod
```

### Maintenance

```bash
# Update dependencies
npm update

# Clean build artifacts
npm run clean

# Lint CDK code
npm run lint
```

## 🔍 Troubleshooting

### Common Issues

**Permission Errors:**
```
Error: Access Denied
Solution: Check AWS credentials and IAM permissions
```

**CDK Won't Bootstrap:**
```
Error: Bootstrap failed
Solution: Ensure CDK version compatibility
```

**Stack Deletion Failed:**
```
Error: Cannot delete stack
Solution: Remove deletion protection and dependencies
```

### Stack Outputs

After deployment, retrieve stack outputs:

```bash
# Get API Gateway URL
aws cloudformation describe-stacks \
  --stack-name ai-compliance-prod-api \
  --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue" \
  --output text

# Get DynamoDB table names
aws cloudformation describe-stacks \
  --stack-name ai-compliance-prod-database \
  --query "Stacks[0].Outputs[?OutputKey=='DynamoDBTables'].OutputValue" \
  --output text
```

## 📞 Support

### Documentation

- [Deployment Guide](../../docs/deployment-guide.md)
- [Architecture Overview](../../docs/architecture-overview.md)
- [Security Architecture](../../docs/security-architecture.md)

### Contact

For infrastructure issues or deployment questions:
- Check CloudFormation console for stack status
- Review CloudWatch logs for Lambda function errors
- Contact platform administrator

---

**CDK Infrastructure Ready!** 🚀

This CDK setup provides a complete, production-ready infrastructure for the AI Compliance Shepherd platform with enterprise-grade security, monitoring, and scalability.
