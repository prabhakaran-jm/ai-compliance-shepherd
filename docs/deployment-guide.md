# AI Compliance Shepherd - Deployment Guide

This comprehensive guide covers deploying the AI Compliance Shepherd platform in production environments, including infrastructure setup, configuration, security hardening, and validation.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Deployment Methods](#deployment-methods)
- [AWS Account Setup](#aws-account-setup)
- [Infrastructure Deployment](#infrastructure-deployment)
- [Service Configuration](#service-configuration)
- [Security Hardening](#security-hardening)
- [Platform Validation](#platform-validation)
- [Monitoring Setup](#monitoring-setup)
- [Scaling Considerations](#scaling-considerations)
- [Maintenance and Updates](#maintenance-and-updates)

## 🔧 Prerequisites

### System Requirements

- **AWS Account**: Administrator-level permissions for resource creation
- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher
- **AWS CLI**: Version 2.0.0 or higher
- **AWS CDK**: For infrastructure deployment
- **Docker**: For local testing (optional)

### Required AWS Services

The platform uses the following AWS services:
- **Lambda**: 24 serverless functions for core functionality
- **API Gateway**: RESTful API endpoints with authentication
- **DynamoDB**: 15 tables for data storage
- **S3**: 4 buckets for reports, artifacts, and audit materials
- **IAM**: Roles and policies for security
- **KMS**: Encryption key management
- **EventBridge**: Event-driven workflows
- **Step Functions**: Workflow orchestration
- **CloudWatch**: Monitoring and logging
- **X-Ray**: Distributed tracing
- **Bedrock**: AI-powered capabilities

### Network Requirements

- **Internet Access**: For AWS service API calls
- **DNS Resolution**: For service endpoints
- **HTTPS/TLS**: Secure communication protocols
- **Port Access**: Standard web ports (80, 443)

## 🏗️ Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI Compliance Shepherd                       │
└─────────────────────────────────────────────────────────────────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
         ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
         │  Web UI │ │   API   │ │  Mobile │
         │         │ │Gateway  │ │  Access │
         └─────────┘ └─────────┘ └─────────┘
              │           │           │
              └───────────┼───────────┘
                         │
            ┌────────────▼────────────┐
            │      Core Services      │
            │                         │
            │  ┌────┐ ┌────┐ ┌────┐   │
            │  │Scan│ │Find│ │AUD │   │
            │  │Env │ │ings│ │Pack│   │
            │  └────┘ └────┘ └────┘   │
            │  ┌────┐ ┌────┐ ┌────┐   │
            │  │AI  │ │Repo│ │Slk │   │
            │  │Chat│ │Gen │ │Not │   │
            │  └────┘ └────┘ └────┘   │
            └────────────┬────────────┘
                         │
            ┌────────────▼────────────┐
            │      Data Layer         │
            │                         │
            │  ┌────┐ ┌────┐ ┌────┐   │
            │  │Dyna│ │ S3 │ │KMS │   │
            │  │moDB│ │    │ │    │   │
            │  └────┘ └────┘ └────┘   │
            └─────────────────────────┘
```

### Service Distribution

| Component | AWS Service | Count | Purpose |
|-----------|-------------|-------|---------|
| API Endpoints | API Gateway | 8 REST APIs | Public-facing interfaces |
| Business Logic | Lambda | 24 functions | Core platform functionality |
| Data Storage | DynamoDB | 15+tables | Structured data persistence |
| File Storage | S3 | 4 buckets | Reports, artifacts, backups |
| Encryption | KMS | Custom keys | Data encryption and key rotation |
| AI/ML | Bedrock | Knowledge base + Agent | Conversational AI and guidance |
| Workflow | Step Functions | 6 state machines | Complex process orchestration |
| Monitoring | CloudWatch | Dashboards + Alarms | Observability and alerting |

## 🚀 Deployment Methods

### Method 1: Automated Deployment (Recommended)

Use our automated deployment script for streamlined setup:

```bash
# Clone repository
git clone https://github.com/your-org/ai-compliance-shepherd.git
cd ai-compliance-shepherd

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your AWS credentials and configuration

# Deploy infrastructure
npm run deploy

# Generate demo data (optional)
npm run demo:data
```

### Method 2: Manual Infrastructure Setup

Deploy infrastructure components individually using AWS CDK:

```bash
# Build infrastructure code
npm run build:infra

# Deploy core services
cd infrastructure/cdk
npm run deploy -- --context environment=production

# Deploy security services
npm run deploy:security -- --context environment=production

# Deploy monitoring services
npm run deploy:monitoring -- --context environment=production
```

### Method 3: Terraform Deployment

Use Terraform modules for infrastructure deployment:

```bash
# Initialize Terraform
cd infrastructure/terraform-modules
terraform init

# Plan deployment
terraform plan -var="environment=production"

# Apply infrastructure
terraform apply -var="environment=production"
```

## ☁️ AWS Account Setup

### 1. IAM Setup

Create the necessary IAM roles and policies:

#### Platform Execution Role
```json
{
  "RoleName": "AICompliancePlatform-ExecutionRole",
  "AssumeRolePolicyDocument": {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": [
            "lambda.amazonaws.com",
            "states.amazonaws.com",
            "events.amazonaws.com"
          ]
        },
        "Action": "sts:AssumeRole"
      }
    ]
  },
  "ManagedPolicyArns": [
    "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
  ]
}
```

#### Cross-Account Scanning Roles

Create customer-facing roles for cross-account scanning:

```bash
# Customer scanning role
aws iam create-role \
  --role-name AIComplianceCustomer-ScanRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:root"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }'

# Attach scanning policy
aws iam attach-role-policy \
  --role-name AIComplianceCustomer-ScanRole \
  --policy-arn arn:aws:iam::YOUR_GITREPO:policy/AIComplianceCustomer-ScanPolicy
```

### 2. KMS Setup

Configure encryption keys for data protection:

```bash
# Create customer master key for DynamoDB
aws kms create-key \
  --description "AI Compliance Platform DynamoDB Encryption" \
  --key-usage ENCRYPT_DECRYPT \
  --key-spec SYMMETRIC_DEFAULT

# Create key alias
aws kms create-alias \
  --alias-name alias/ai-compliance-platform-core \
  --target-key-id YOUR_KEY_ID
```

### 3. S3 Bucket Creation

Create required S3 buckets with proper configurations:

```bash
# Reports bucket
aws s3 mb s3://ai-compliance-platform-reports-prod \
  --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket ai-compliance-platform-reports-prod \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket ai-compliance-platform-reports-prod \
  --server-side-encryption-configuration '{
    "Rules": [
      {
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "aws:kms",
          "KMSMasterKeyID": "alias/ai-compliance-platform-core"
        },
        "BucketKeyEnabled": true
      }
    ]
  }'

# Set lifecycle policies
aws s3api put-bucket-lifecycle-configuration \
  --bucket ai-compliance-platform-reports-prod \
  --lifecycle-configuration file://lifecycle-config.json
```

## 🏭 Infrastructure Deployment

### 1. Core Services Deployment

Deploy Lambda functions and API Gateway:

```bash
# Deploy core Lambda functions
cd infrastructure/cdk
npm run deploy:core -- --context environment=production

# Deploy API Gateway
npm run deploy:api -- --context environment=production

# Deploy DynamoDB tables
npm run deploy:database -- --context environment=production
```

### 2. Security Services

Deploy security and encryption services:

```bash
# Deploy KMS encryption service
npm run deploy:security -- --context environment=production

# Deploy WAF rules
npm run deploy:waf -- --context environment=production

# Deploy secrets management
npm run deploy:secrets -- --context environment=production
```

### 3. Monitoring and Observability

Deploy monitoring and logging infrastructure:

```bash
# Deploy CloudWatch dashboards
npm run deploy:monitoring -- --context environment=production

# Deploy X-Ray tracing
npm run deploy:tracing -- --context environment=production

# Deploy alerting
npm run deploy:alerts -- --context environment=production
```

## ⚙️ Service Configuration

### 1. Environment Variables

Configure service environment variables:

```bash
# Set DynamoDB table names
export DYNAMODB_TABLE_PREFIX="ai-compliance-prod-"
export DYNAMODB_TENANTS_TABLE="${DYNAMODB_TABLE_PREFIX}tenants"
export DYNAMODB_FINDINGS_TABLE="${DYNAMODB_TABLE_PREFIX}findings"
export DYNAMODB_SCANS_TABLE="${DYNAMODB_TABLE_PREFIX}scans"

# Set S3 bucket names
export S3_REPORTS_BUCKET="ai-compliance-platform-reports-prod"
export S3_ARTIFACTS_BUCKET="ai-compliance-platform-artifacts-prod"
export S3_AUDIT_PACKS_BUCKET="ai-compliance-platform-audit-packs-prod"

# Set encryption keys
export KMS_KEY_ID="alias/ai-compliance-platform-core"
export ENCRYPTION_ENABLED="true"

# Set log levels
export LOG_LEVEL="INFO"
export XRAY_TRACING_ENABLED="true"
```

### 2. API Gateway Configuration

Configure API Gateway endpoints and authentication:

```bash
# Create API Gateway
aws apigateway create-rest-api \
  --name "AI-Compliance-Platform-Production" \
  --description "Production API for AI Compliance Shepherd"

# Set up CORS
aws apigateway put-gateway-response \
  --rest-api-id YOUR_API_ID \
  --response-type DEFAULT_4XX \
  --status-code 401 \
  --response-parameters '{"gatewayresponse.header.Access-Control-Allow-Origin":"''*''"}'

# Configure authorizer
aws apigateway create-authorizer \
  --rest-api-id YOUR_API_ID \
  --name "AI-Compliance-Authorizer" \
  --type COGNITO_USER_POOLS \
  --identity-source "method.request.header.Authorization" \
  --provider-arns "arn:aws:cognito-idp:REGION:ACCOUNT:userpool/USER_POOL_ID"
```

### 3. Lambda Function Configuration

Configure Lambda functions for production:

```bash
# Update function configuration for production workloads
aws lambda update-function-configuration \
  --function-name ai-compliance-scan-environment \
  --memory-size 2048 \
  --timeout 900 \
  --environment Variables='{
    "NODE_ENV":"production",
    "LOG_LEVEL":"INFO",
    "XRAY_TRACING_ENABLED":"true"
  }'

# Enable provisioned concurrency for critical functions
aws lambda put-provisioned-concurrency-config \
  --function-name ai-compliance-core-services \
  --provisioned-concurrency-config ProvisionedConcurrencyUnits=10
```

## 🔒 Security Hardening

### 1. Network Security

Implement network-level security controls:

```bash
# Create VPC for Lambda functions (if using VPC)
aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=AI-Compliance-VPC}]'

# Configure security groups
aws ec2 create-security-group \
  --group-name ai-compliance-platform-sg \
  --description "Security group for AI Compliance Platform" \
  --vpc-id YOUR_VPC_ID
```

### 2. Data Encryption

Ensure all data is encrypted:

```bash
# Enable DynamoDB encryption
aws dynamodb update-table \
  --table-name ai-compliance-prod-tenants \
  --sse-specification Update=Enabled=true,KMSMasterKeyId=alias/ai-compliance-platform-core

# Enable S3 bucket encryption for all buckets
for bucket in $S3_REPORTS_BUCKET $S3_ARTIFACTS_BUCKET $S3_AUDIT_PACKS_BUCKET; do
  aws s3api put-bucket-encryption \
    --bucket $bucket \
    --server-side-encryption-configuration '{
      "Rules": [
        {
          "ApplyServerSideEncryptionByDefault": {
            "SSEAlgorithm": "aws:kms",
            "KMSMasterKeyID": "alias/ai-compliance-platform-core"
          }
        }
      ]
    }'
done
```

### 3. Access Controls

Implement strict access controls:

```bash
# Create IAM policy for least privilege access
aws iam create-policy \
  --policy-name AICompliancePlatformLeastPrivilege \
  --policy-document file://least-privilege-policy.json

# Attach policy to execution role
aws iam attach-role-policy \
  --role-name AICompliancePlatform-ExecutionRole \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/AICompliancePlatformLeastPrivilege
```

### 4. Secrets Management

Configure AWS Secrets Manager for sensitive data:

```bash
# Store database credentials
aws secretsmanager create-secret \
  --name "ai-compliance/platform/database-credentials" \
  --description "Database credentials for AI Compliance Platform" \
  --secret-string '{
    "username": "admin",
    "password": "secure-password-here"
  }'

# Store API keys
aws secretsmanager create-secret \
  --name "ai-compliance/platform/api-keys" \
  --description "External API keys for integrations" \
  --secret-string '{
    "github_token": "ghp_example_token",
    "slack_token": "xoxb_slack_token"
  }'
```

## ✅ Platform Validation

### 1. Health Checks

Run comprehensive health checks:

```bash
# Test API Gateway endpoints
curl -X GET https://YOUR_API_ID.execute-api.REGION.amazonaws.com/prod/health

# Validate Lambda functions
aws lambda invoke \
  --function-name ai-compliance-health-check \
  --payload '{"test":"health"}' \
  /tmp/response.json

# Check DynamoDB connectivity
aws dynamodb describe-table \
  --table-name ai-compliance-prod-tenants
```

### 2. Security Validation

Verify security configurations:

```bash
# Check encryption status
aws dynamodb describe-table \
  --table-name ai-compliance-prod-tenants \
  --query 'Table.SSEDescription.{Status:Status,KMSMasterKeyArn:KMSMasterKeyArn}'

# Verify S3 encryption
aws s3api get-bucket-encryption \
  --bucket ai-compliance-platform-reports-prod

# Check IAM role permissions
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::YOUR_ACCOUNT_ID:role/AICompliancePlatform-ExecutionRole \
  --action-names dynamodb:Query \
  --resource-arns arn:aws:dynamodb:REGION:YOUR_ACCOUNT_ID:table/ai-compliance-prod-tenants
```

### 3. Performance Testing

Run performance validation tests:

```bash
# Load test API endpoints
npm run test:performance:api

# Database performance test
npm run test:performance:database

# End-to-end workflow test
npm run test:e2e
```

## 📊 Monitoring Setup

### 1. CloudWatch Dashboards

Create comprehensive monitoring dashboards:

```bash
# Create main platform dashboard
aws cloudwatch put-dashboard \
  --dashboard-name "AI-Compliance-Platform-Monitoring" \
  --dashboard-body file://platform-dashboard.json

# Create security dashboard
aws cloudwatch put-dashboard \
  --dashboard-name "AI-Compliance-Security-Monitoring" \
  --dashboard-body file://security-dashboard.json
```

### 2. Alarms and Alerting

Set up critical alerts:

```bash
# Lambda function error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "AI-Compliance-Lambda-Errors" \
  --alarm-description "Alert when Lambda error rate exceeds 5%" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold
```

### 3. Log Aggregation

Configure centralized logging:

```bash
# Create log group for platform logs
aws logs create-log-group \
  --log-group-name "/aws/lambda/ai-compliance-platform" \
  --retention-in-days 30

# Set up log aggregation
aws logs put-retention-policy \
  --log-group-name "/aws/lambda/ai-compliance-platform" \
  --retention-in-days 90
```

## 📈 Scaling Considerations

### 1. Auto-Scaling Configuration

Configure automatic scaling for high availability:

```bash
# Configure DynamoDB auto-scaling
aws application-autoscaling put-scaling-policy \
  --policy-name "ai-compliance-tenants-autoscaling" \
  --policy-type TargetTrackingScaling \
  --resource-id "table/ai-compliance-prod-tenants" \
  --scalable-dimension "dynamodb:table:WriteCapacityUnits" \
  --target-tracking-scaling-policy-configuration file://autoscaling-config.json
```

### 2. Distributed Deployment

Consider multi-region deployment for disaster recovery:

```bash
# Deploy to backup region
npm run deploy -- --context region=us-west-2 --context environment=production-backup
```

## 🔄 Maintenance and Updates

### 1. Patch Management

Implement automated patch management:

```bash
# Update Lambda runtime versions
npm run update:lambda-runtimes -- --target-version node18.x

# Apply security patches
npm audit fix --force
```

### 2. Backup Strategies

Implement comprehensive backup procedures:

```bash
# Enable DynamoDB point-in-time recovery
aws dynamodb update-continuous-backups \
  --table-name ai-compliance-prod-tenants \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=True

# Configure S3 cross-region replication
aws s3api put-bucket-replication \
  --bucket ai-compliance-platform-reports-prod \
  --replication-configuration file://replication-config.json
```

### 3. Performance Optimization

Monitor and optimize performance:

```bash
# Analyze Lambda performance
aws lambda get-function \
  --function-name ai-compliance-scan-environment \
  --query 'Configuration.{Memory:MemorySize,Timeout:Timeout,Environment:Environment}'

# Optimize DynamoDB performance
aws dax describe-clusters \
  --query 'Clusters[0].Status'
```

## 📞 Support and Troubleshooting

### Common Deployment Issues

**Lambda Function Timeouts**
- Increase timeout to 15 minutes for scan operations
- Check Cold Start configurations for performance-critic functions

**DynamoDB Throttling**
- Enable auto-scaling for high-traffic tables
- Monitor consumed capacity metrics

**S3 Access Denied**
- Verify bucket permissions and encryption settings
- Check IAM role policies for S3 access

### Getting Help

- Check the [Troubleshooting Guide](../troubleshooting.md)
- Review CloudWatch logs for detailed error information
- Contact technical support with specific error messages and deployment context

---

**Deployment Complete!** 🚀

Your AI Compliance Shepherd platform is now deployed and ready for production use. Next steps:

1. **Configure initial tenant accounts** using the administrator guide
2. **Set up monitoring alerts** for critical metrics
3. **Train your team** using the user manual
4. **Schedule regular maintenance** windows for updates

For ongoing platform management, refer to the [Administrator Guide](administrator-guide.md).
