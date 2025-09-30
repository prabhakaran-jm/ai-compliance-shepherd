# Deployment Guide

## Prerequisites

### Required Tools
- Node.js 18+ 
- AWS CLI v2
- AWS CDK CLI
- Terraform CLI
- Docker (for local testing)
- Git

### AWS Account Setup
- AWS account with appropriate permissions
- Bedrock access enabled in target region
- IAM roles for cross-account access (if scanning customer accounts)

## Environment Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/ai-compliance-shepherd.git
cd ai-compliance-shepherd
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
cp env.example .env
# Edit .env with your configuration
```

### 4. AWS CLI Configuration
```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, region, and output format
```

### 5. CDK Bootstrap (First Time Only)
```bash
cd infra/cdk
npm install
cdk bootstrap
```

## Deployment Steps

### Development Environment

#### 1. Deploy Infrastructure
```bash
npm run deploy:dev
```

#### 2. Seed Demo Data
```bash
npm run seed-demo
```

#### 3. Test Deployment
```bash
npm run test:integration
```

### Staging Environment

#### 1. Deploy with Staging Config
```bash
npm run deploy:staging
```

#### 2. Run Integration Tests
```bash
npm run test:integration:staging
```

### Production Environment

#### 1. Pre-deployment Checklist
- [ ] All tests passing
- [ ] Security review completed
- [ ] Performance testing done
- [ ] Backup procedures verified
- [ ] Monitoring configured

#### 2. Deploy Production
```bash
npm run deploy:prod
```

#### 3. Post-deployment Verification
```bash
npm run health-check:prod
```

## Configuration

### Environment Variables

#### Required Variables
```bash
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
```

#### Optional Variables
```bash
ENABLE_AUTO_REMEDIATION=false
ENABLE_SLACK_NOTIFICATIONS=true
LOG_LEVEL=info
```

### IAM Permissions

#### Service Role Permissions
- Bedrock access for model invocation
- DynamoDB read/write access
- S3 bucket access for reports
- CloudWatch logs and metrics
- Secrets Manager access

#### Cross-Account Permissions (for scanning)
- Read-only access to customer AWS resources
- AssumeRole capability
- CloudTrail access for audit logs

## Monitoring Setup

### CloudWatch Dashboards
```bash
# Create monitoring dashboard
aws cloudwatch put-dashboard --dashboard-name "ComplianceShepherd" --dashboard-body file://docs/dashboards/main.json
```

### Alarms Configuration
```bash
# Set up critical alarms
aws cloudwatch put-metric-alarm --cli-input-json file://docs/alarms/critical.json
```

## Security Configuration

### KMS Key Setup
```bash
# Create KMS key for encryption
aws kms create-key --description "Compliance Shepherd Encryption Key"
```

### Secrets Manager
```bash
# Store sensitive configuration
aws secretsmanager create-secret --name "compliance-shepherd/config" --secret-string file://secrets.json
```

## Troubleshooting

### Common Issues

#### 1. Bedrock Access Denied
```bash
# Check Bedrock permissions
aws bedrock list-foundation-models --region us-east-1
```

#### 2. DynamoDB Table Not Found
```bash
# Verify table creation
aws dynamodb describe-table --table-name compliance-shepherd-findings
```

#### 3. Lambda Timeout Issues
- Check Lambda timeout settings
- Review CloudWatch logs for errors
- Verify IAM permissions

### Debug Commands
```bash
# Check Lambda logs
aws logs tail /aws/lambda/compliance-shepherd-scan-environment --follow

# Verify API Gateway
aws apigateway get-rest-apis

# Check Step Functions
aws stepfunctions list-state-machines
```

## Rollback Procedures

### Infrastructure Rollback
```bash
# Rollback to previous version
cdk deploy --previous-parameters
```

### Data Rollback
```bash
# Restore DynamoDB from backup
aws dynamodb restore-table-from-backup --target-table-name compliance-shepherd-findings --backup-arn arn:aws:dynamodb:...
```

## Maintenance

### Regular Tasks
- Update dependencies monthly
- Review and rotate secrets quarterly
- Clean up old scan results based on retention policy
- Monitor costs and optimize resources

### Backup Procedures
- Automated DynamoDB backups
- S3 lifecycle policies for old reports
- Configuration backups in Git

## Support

### Getting Help
- Check CloudWatch logs for errors
- Review this documentation
- Create GitHub issue for bugs
- Contact team for urgent issues

### Log Analysis
```bash
# Search for errors
aws logs filter-log-events --log-group-name /aws/lambda/compliance-shepherd --filter-pattern "ERROR"
```
