# Apply Fix Service

The Apply Fix Service provides safe, automated remediation of compliance issues with comprehensive guardrails, approval workflows, and rollback capabilities. It ensures that fixes are applied safely with proper oversight and can be reversed if needed.

## Features

### Core Capabilities
- **Safe Remediation**: Automated fixes for common compliance issues across AWS services
- **Safety Guardrails**: Comprehensive pre-flight checks to prevent dangerous operations
- **Approval Workflows**: Multi-level approval system for high-risk changes
- **Rollback Management**: Ability to reverse applied changes when needed
- **Impact Assessment**: Detailed analysis of potential impact before applying fixes
- **Audit Trail**: Complete logging of all remediation activities

### Supported AWS Services
- **S3**: Bucket encryption, versioning, public access blocking
- **IAM**: Policy attachments, least privilege policies, MFA requirements
- **Security Groups**: Rule modifications, access restrictions
- **CloudTrail**: Log file validation, event configuration
- **KMS**: Key rotation, policy updates
- **RDS**: Encryption, backup configuration, Multi-AZ setup
- **Lambda**: VPC configuration, runtime updates

### Safety Features
- **Multi-Layer Validation**: Request validation, business rules, safety checks
- **Risk Assessment**: Automatic risk level determination based on resource and operation
- **Production Protection**: Enhanced checks for production resources
- **Business Hours Awareness**: Warnings for changes during business hours
- **Dependency Analysis**: Checks for resource dependencies and usage

## Architecture

### Components
```
API Gateway → Apply Fix Handler → Safety Guardrails → Remediation Engine
                    ↓                      ↓                    ↓
            Approval Workflow ← Impact Assessment → Rollback Manager
                    ↓
            Notification System (SNS, Slack, Step Functions)
```

### Key Services
- **ApplyFixService**: Main orchestration service
- **RemediationEngine**: Executes actual AWS API calls for fixes
- **SafetyGuardrails**: Runs comprehensive safety checks
- **ApprovalWorkflow**: Manages approval requests and notifications
- **RollbackManager**: Handles rollback of applied changes

### Data Flow
1. **Request Validation**: Validate input parameters and business rules
2. **Safety Checks**: Run comprehensive safety assessments
3. **Impact Analysis**: Estimate potential impact and risk level
4. **Approval Decision**: Determine if approval is required
5. **Execution**: Apply remediation or request approval
6. **Audit Logging**: Record all activities for compliance

## API Reference

### Apply Remediation
```
POST /remediation/apply
```

**Request Body:**
```json
{
  "findingId": "finding-123",
  "remediationType": "ENABLE_BUCKET_ENCRYPTION",
  "resourceId": "my-s3-bucket",
  "resourceType": "S3_BUCKET",
  "region": "us-east-1",
  "accountId": "123456789012",
  "tenantId": "tenant-123",
  "userId": "user-123",
  "autoApprove": false,
  "dryRun": false,
  "parameters": {}
}
```

**Response:**
```json
{
  "success": true,
  "correlationId": "uuid",
  "result": {
    "remediationId": "remediation-456",
    "status": "APPLIED",
    "findingId": "finding-123",
    "resourceId": "my-s3-bucket",
    "resourceType": "S3_BUCKET",
    "remediationType": "ENABLE_BUCKET_ENCRYPTION",
    "appliedAt": "2024-01-01T00:00:00Z",
    "rollbackInfo": {
      "type": "s3",
      "data": { "encryption": "disabled" },
      "instructions": ["Disable bucket encryption"]
    },
    "approvalRequired": false,
    "safetyChecks": {
      "passed": true,
      "checks": [
        {
          "name": "Production Environment Check",
          "passed": true,
          "message": "Resource is not in production environment",
          "severity": "LOW"
        }
      ]
    },
    "estimatedImpact": {
      "riskLevel": "LOW",
      "affectedResources": 1,
      "downtime": false,
      "costImpact": 0
    },
    "changes": [
      {
        "action": "Enable bucket encryption",
        "resource": "my-s3-bucket",
        "before": { "encryption": "disabled" },
        "after": { "encryption": "AES256" }
      }
    ]
  }
}
```

### Request Approval
```
POST /remediation/request
```

**Request Body:** Same as apply remediation

**Response:**
```json
{
  "success": true,
  "correlationId": "uuid",
  "result": {
    "remediationId": "remediation-456",
    "status": "PENDING_APPROVAL",
    "approvalRequired": true,
    "message": "Approval request submitted successfully"
  }
}
```

### Approve Remediation
```
PUT /remediation/{remediationId}/approve
```

**Response:**
```json
{
  "success": true,
  "correlationId": "uuid",
  "result": {
    "remediationId": "remediation-456",
    "status": "APPLIED",
    "message": "Remediation approved and applied successfully"
  }
}
```

### Rollback Remediation
```
PUT /remediation/{remediationId}/rollback
```

**Response:**
```json
{
  "success": true,
  "correlationId": "uuid",
  "result": {
    "remediationId": "remediation-456",
    "status": "ROLLED_BACK",
    "message": "Remediation rolled back successfully"
  }
}
```

### Get Remediation Status
```
GET /remediation/{remediationId}
```

**Response:**
```json
{
  "success": true,
  "correlationId": "uuid",
  "result": {
    "remediationId": "remediation-456",
    "status": "APPLIED",
    "findingId": "finding-123",
    "resourceId": "my-s3-bucket",
    "appliedAt": "2024-01-01T00:00:00Z",
    "rollbackInfo": { ... },
    "safetyChecks": { ... },
    "estimatedImpact": { ... }
  }
}
```

### List Pending Remediations
```
GET /remediation/pending
```

**Response:**
```json
{
  "success": true,
  "correlationId": "uuid",
  "result": [
    {
      "remediationId": "remediation-789",
      "status": "PENDING_APPROVAL",
      "findingId": "finding-456",
      "resourceId": "prod-bucket",
      "resourceType": "S3_BUCKET",
      "remediationType": "BLOCK_PUBLIC_ACCESS",
      "approvalRequired": true,
      "estimatedImpact": {
        "riskLevel": "HIGH",
        "affectedResources": 3,
        "downtime": false,
        "costImpact": 0
      }
    }
  ]
}
```

## Configuration

### Environment Variables
```bash
# AWS Configuration
AWS_REGION=us-east-1

# Approval Workflow
APPROVAL_WORKFLOW_STATE_MACHINE_ARN=arn:aws:states:us-east-1:123456789012:stateMachine:approval-workflow
APPROVAL_TOPIC_SECURITY_TEAM=arn:aws:sns:us-east-1:123456789012:security-approvals
APPROVAL_TOPIC_OPS_MANAGER=arn:aws:sns:us-east-1:123456789012:ops-approvals
APPROVAL_TOPIC_OPS_TEAM=arn:aws:sns:us-east-1:123456789012:ops-team

# Slack Integration
SLACK_APPROVAL_WEBHOOK=https://hooks.slack.com/services/...
SLACK_APPROVAL_CHANNEL=#compliance-approvals

# Dashboard
DASHBOARD_URL=https://compliance.example.com

# Debug
NODE_ENV=production
DEBUG=false
```

### IAM Permissions
The service requires comprehensive AWS permissions to perform remediations:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutBucketEncryption",
        "s3:PutBucketVersioning",
        "s3:PutPublicAccessBlock",
        "s3:GetBucketLocation",
        "s3:GetBucketTagging"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:AttachRolePolicy",
        "iam:CreatePolicy",
        "iam:DetachRolePolicy",
        "iam:DeletePolicy",
        "iam:GetRole",
        "iam:ListAttachedRolePolicies"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:RevokeSecurityGroupIngress",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeInstances"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudtrail:UpdateTrail",
        "cloudtrail:PutEventSelectors"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:EnableKeyRotation",
        "kms:DisableKeyRotation",
        "kms:PutKeyPolicy"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "rds:ModifyDBInstance",
        "rds:ModifyDBCluster"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:UpdateFunctionConfiguration"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "sns:Publish"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "states:StartExecution"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "sts:GetCallerIdentity"
      ],
      "Resource": "*"
    }
  ]
}
```

## Supported Remediations

### S3 Bucket
- **ENABLE_BUCKET_ENCRYPTION**: Enable server-side encryption (AES256 or KMS)
- **ENABLE_BUCKET_VERSIONING**: Enable object versioning
- **BLOCK_PUBLIC_ACCESS**: Block all public access
- **ENABLE_ACCESS_LOGGING**: Configure access logging
- **CONFIGURE_LIFECYCLE_POLICY**: Set up lifecycle rules

### IAM
- **ATTACH_SECURITY_POLICY**: Attach AWS managed security policies
- **CREATE_LEAST_PRIVILEGE_POLICY**: Create custom least privilege policies
- **REMOVE_UNUSED_PERMISSIONS**: Remove unused policy statements
- **ENABLE_MFA_REQUIREMENT**: Add MFA conditions to policies

### Security Groups
- **REMOVE_OVERLY_PERMISSIVE_RULE**: Remove rules allowing 0.0.0.0/0 access
- **RESTRICT_SSH_ACCESS**: Limit SSH access to specific CIDR ranges
- **RESTRICT_RDP_ACCESS**: Limit RDP access to specific CIDR ranges
- **ADD_EGRESS_RESTRICTIONS**: Add outbound traffic restrictions

### CloudTrail
- **ENABLE_LOG_FILE_VALIDATION**: Enable log file integrity validation
- **ENABLE_MANAGEMENT_EVENTS**: Enable management event logging
- **CONFIGURE_DATA_EVENTS**: Configure data event logging
- **ENABLE_ENCRYPTION**: Enable CloudTrail log encryption

### KMS
- **ENABLE_KEY_ROTATION**: Enable automatic key rotation
- **UPDATE_KEY_POLICY**: Update key policies for security
- **ENABLE_KEY_DELETION_PROTECTION**: Prevent accidental key deletion

### RDS
- **ENABLE_ENCRYPTION**: Enable encryption at rest (requires snapshot restore)
- **ENABLE_BACKUP_RETENTION**: Configure automated backups
- **ENABLE_MULTI_AZ**: Enable Multi-AZ deployment
- **CONFIGURE_SECURITY_GROUP**: Update security group associations

### Lambda
- **ENABLE_VPC_CONFIGURATION**: Configure VPC settings
- **UPDATE_RUNTIME_VERSION**: Update to supported runtime versions
- **CONFIGURE_ENVIRONMENT_ENCRYPTION**: Enable environment variable encryption
- **ENABLE_DEAD_LETTER_QUEUE**: Configure dead letter queues

## Safety Guardrails

### General Safety Checks
- **Production Environment Detection**: Enhanced checks for production resources
- **Account Permissions Verification**: Ensure sufficient permissions
- **Business Hours Awareness**: Warnings for changes during business hours
- **Recent Changes Detection**: Check for recent modifications
- **Resource Dependency Analysis**: Identify dependent resources

### Resource-Specific Checks
- **S3 Buckets**: Check for criticality tags, public access impact
- **IAM Roles**: Verify service roles, admin policy attachments
- **Security Groups**: Check instance attachments, permissive rules
- **RDS Instances**: Verify Multi-AZ, read replicas, backup configuration

### Operation-Specific Checks
- **Destructive Operations**: Flag potentially destructive actions
- **Irreversible Operations**: Identify operations that cannot be undone
- **High-Impact Changes**: Assess scope of affected resources
- **Cost Impact Analysis**: Estimate financial impact of changes

## Approval Workflows

### Risk-Based Approval Requirements
- **CRITICAL**: Requires 2 approvals from security team, ops manager, and CTO
- **HIGH**: Requires 1 approval from security team or ops manager
- **MEDIUM**: Requires 1 approval from ops team
- **LOW**: May proceed without approval (configurable)

### Approval Channels
- **SNS Topics**: Email notifications to approval groups
- **Slack Integration**: Interactive approval buttons in Slack
- **Step Functions**: Automated workflow orchestration
- **Dashboard**: Web-based approval interface

### Approval Timeouts
- **CRITICAL**: 4 hours with 1-hour escalation
- **HIGH**: 8 hours with 2-hour escalation
- **MEDIUM**: 24 hours with 4-hour escalation
- **LOW**: 48 hours with 8-hour escalation

## Rollback Management

### Rollback Capabilities
- **Automatic Rollback Info**: Captured during remediation execution
- **Feasibility Assessment**: Validate rollback possibility before execution
- **Partial Rollback Support**: Handle scenarios where only some changes can be reversed
- **Rollback Validation**: Verify successful rollback completion

### Rollback Limitations
- **RDS Encryption**: Cannot be rolled back without snapshot restore
- **Irreversible Operations**: Some changes cannot be undone
- **Time-Sensitive Rollbacks**: Some rollbacks must be performed quickly
- **Dependency Constraints**: Rollbacks may be blocked by resource dependencies

### Rollback Process
1. **Validation**: Check rollback feasibility and prerequisites
2. **Execution**: Perform rollback operations in reverse order
3. **Verification**: Confirm successful rollback
4. **Audit**: Log rollback activities and results

## Error Handling

### Error Types
- **RemediationError**: General remediation failures
- **SafetyViolationError**: Safety check failures
- **ApprovalError**: Approval workflow issues
- **RollbackError**: Rollback operation failures
- **ValidationError**: Input validation failures
- **AuthorizationError**: Permission issues

### Error Recovery
- **Automatic Retry**: Transient failures with exponential backoff
- **Circuit Breaker**: Prevent cascading failures
- **Error Aggregation**: Collect and summarize multiple errors
- **Graceful Degradation**: Continue operation when possible

### Error Responses
```json
{
  "success": false,
  "error": {
    "message": "Safety checks failed",
    "code": "SAFETY_VIOLATION",
    "correlationId": "uuid",
    "timestamp": "2024-01-01T00:00:00Z",
    "details": {
      "failedChecks": [
        {
          "name": "Production Environment Check",
          "message": "Resource is in production environment",
          "severity": "HIGH"
        }
      ]
    }
  }
}
```

## Monitoring and Logging

### Structured Logging
All operations are logged with structured JSON format:
```json
{
  "timestamp": "2024-01-01T00:00:00Z",
  "level": "INFO",
  "service": "apply-fix",
  "message": "Remediation operation started",
  "correlationId": "uuid",
  "remediationId": "remediation-123",
  "resourceId": "my-bucket",
  "remediationType": "ENABLE_BUCKET_ENCRYPTION",
  "userId": "user-123",
  "tenantId": "tenant-123"
}
```

### Key Metrics
- **Remediation Success Rate**: Percentage of successful remediations
- **Safety Check Failure Rate**: Frequency of safety check failures
- **Approval Response Time**: Time to approve/reject requests
- **Rollback Success Rate**: Percentage of successful rollbacks
- **Error Rates**: Frequency and types of errors

### Monitoring Dashboards
- **Remediation Activity**: Volume and success rates
- **Safety Violations**: Failed safety checks and reasons
- **Approval Queues**: Pending approvals and response times
- **Error Tracking**: Error rates and types
- **Performance Metrics**: Response times and throughput

## Security Considerations

### Access Control
- **Role-Based Access**: Different permissions for different user roles
- **Resource-Level Permissions**: Fine-grained access control
- **Tenant Isolation**: Multi-tenant data separation
- **Audit Trail**: Complete logging of all access and actions

### Data Protection
- **Encryption in Transit**: All API communications encrypted
- **Encryption at Rest**: Sensitive data encrypted in storage
- **Secrets Management**: Secure handling of credentials and keys
- **Data Minimization**: Only collect necessary information

### Operational Security
- **Input Validation**: Comprehensive validation of all inputs
- **Output Sanitization**: Clean all outputs to prevent injection
- **Rate Limiting**: Prevent abuse and DoS attacks
- **Circuit Breakers**: Protect against cascading failures

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
- **Service Logic**: All business logic paths
- **Safety Guardrails**: All safety check scenarios
- **Error Handling**: All error conditions
- **Approval Workflows**: All approval scenarios
- **Rollback Operations**: All rollback scenarios

### Test Scenarios
- **Happy Path**: Successful remediation flows
- **Safety Violations**: Various safety check failures
- **Approval Workflows**: Different approval scenarios
- **Rollback Operations**: Successful and failed rollbacks
- **Error Conditions**: Network failures, permission issues, etc.

## Deployment

### AWS Lambda Deployment
```bash
# Build the service
npm run build

# Deploy with AWS CLI
aws lambda create-function \
  --function-name ai-compliance-shepherd-apply-fix \
  --runtime nodejs18.x \
  --role arn:aws:iam::account:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://dist.zip
```

### Environment Setup
1. **Configure IAM Roles** with necessary permissions
2. **Set up SNS Topics** for approval notifications
3. **Configure Step Functions** for approval workflows
4. **Set up Slack Integration** (optional)
5. **Configure Environment Variables**
6. **Deploy Lambda Function** with proper VPC settings
7. **Set up API Gateway** integration
8. **Configure CloudWatch** monitoring and alerting

## Best Practices

### Safety First
- **Always run safety checks** before any remediation
- **Require approval for high-risk operations**
- **Test in non-production environments first**
- **Maintain comprehensive rollback information**

### Operational Excellence
- **Monitor all remediation activities**
- **Set up alerting for failures and safety violations**
- **Regularly review and update safety rules**
- **Maintain audit trails for compliance**

### Performance
- **Use circuit breakers** for external dependencies
- **Implement proper retry logic** with exponential backoff
- **Monitor and optimize response times**
- **Use batch operations** where possible

### Security
- **Follow principle of least privilege**
- **Encrypt all sensitive data**
- **Validate all inputs thoroughly**
- **Maintain secure secrets management**

## Troubleshooting

### Common Issues

#### Remediation Fails with Permission Error
- **Cause**: Insufficient IAM permissions
- **Solution**: Review and update IAM policies
- **Prevention**: Use IAM policy simulator for testing

#### Safety Checks Always Fail
- **Cause**: Overly restrictive safety rules
- **Solution**: Review and adjust safety check logic
- **Prevention**: Test safety rules with various scenarios

#### Approval Notifications Not Sent
- **Cause**: SNS topic misconfiguration
- **Solution**: Verify SNS topic ARNs and permissions
- **Prevention**: Test notification channels regularly

#### Rollback Fails
- **Cause**: Missing or invalid rollback information
- **Solution**: Verify rollback data capture during remediation
- **Prevention**: Test rollback scenarios in development

### Debug Mode
Enable debug logging:
```bash
export DEBUG=true
export NODE_ENV=development
```

### Log Analysis
Key log entries to monitor:
- Remediation start/completion events
- Safety check results
- Approval request/response events
- Rollback operations
- Error conditions and retries

## Support

### Documentation
- [AWS SDK Documentation](https://docs.aws.amazon.com/sdk-for-javascript/)
- [Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Step Functions Documentation](https://docs.aws.amazon.com/step-functions/)

### Community
- GitHub Issues for bug reports and feature requests
- Slack channel for community support
- Documentation wiki for additional examples

### Enterprise Support
- Professional services for custom remediations
- Priority support for enterprise customers
- Training and onboarding assistance
