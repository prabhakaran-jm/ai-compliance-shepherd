# Scan Environment Lambda Function

This Lambda function performs read-only AWS posture checks using the compliance rules engine and stores results in DynamoDB for reporting and analysis.

## Features

- **Read-only AWS scanning** - No modifications to customer resources
- **Multi-service support** - S3, IAM, EC2, CloudTrail, KMS, RDS, Lambda
- **Multi-region scanning** - Scan across multiple AWS regions
- **Compliance frameworks** - SOC 2, HIPAA, GDPR, PCI, ISO 27001, NIST
- **Real-time progress tracking** - Monitor scan progress and status
- **Comprehensive reporting** - Detailed findings with evidence and recommendations
- **Asynchronous processing** - Non-blocking scan execution
- **Error handling** - Robust error handling and retry logic
- **Audit logging** - Complete audit trail of scan activities

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Gateway   │───▶│  Lambda Handler  │───▶│ Scan Service    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   DynamoDB      │◀───│  Data Access     │◀───│ Resource        │
│   (Results)     │    │  Layer           │    │ Discovery       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CloudWatch    │    │  Rules Engine    │    │ AWS Resources   │
│   (Logs)        │    │  (Compliance)    │    │ (S3, IAM, etc.) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## API Endpoints

### POST /scan

Start a new compliance scan.

**Request Body:**
```json
{
  "tenantId": "tenant-123",
  "accountId": "123456789012",
  "regions": ["us-east-1", "us-west-2"],
  "scanType": "full_environment",
  "services": ["s3", "iam", "ec2"],
  "frameworks": ["SOC2", "HIPAA"],
  "requestedBy": "user-123",
  "settings": {
    "scanSchedule": {
      "enabled": true,
      "frequency": "daily"
    },
    "autoRemediation": {
      "enabled": false,
      "riskLevel": "low"
    }
  },
  "metadata": {
    "source": "api",
    "tags": ["production", "critical"]
  }
}
```

**Response:**
```json
{
  "scanId": "scan-123",
  "status": "initializing",
  "message": "Scan started successfully",
  "estimatedDuration": 300000,
  "scanUrl": "https://api.example.com/scans/scan-123"
}
```

### GET /scans/{scanId}

Get scan status and results.

**Response:**
```json
{
  "scanJob": {
    "id": "scan-123",
    "status": "completed",
    "progress": {
      "current": 100,
      "total": 100,
      "percentage": 100,
      "stage": "Completed"
    },
    "results": {
      "totalResources": 150,
      "totalFindings": 8,
      "complianceScore": 94.5,
      "findingsBySeverity": {
        "critical": 0,
        "high": 2,
        "medium": 4,
        "low": 2
      }
    }
  },
  "findings": [
    {
      "id": "finding-123",
      "severity": "high",
      "framework": "SOC2",
      "title": "S3 bucket not encrypted",
      "description": "S3 bucket 'my-bucket' does not have encryption enabled",
      "recommendation": "Enable server-side encryption for the S3 bucket",
      "evidence": {
        "resourceArn": "arn:aws:s3:::my-bucket",
        "configuration": {
          "encryption": null
        }
      }
    }
  ],
  "statistics": {
    "total": 8,
    "bySeverity": {
      "critical": 0,
      "high": 2,
      "medium": 4,
      "low": 2
    },
    "byFramework": {
      "SOC2": 6,
      "HIPAA": 2
    }
  }
}
```

### GET /scans

List scans for a tenant.

**Query Parameters:**
- `limit` - Number of scans to return (default: 100)
- `nextToken` - Pagination token
- `status` - Filter by scan status
- `scanType` - Filter by scan type

**Response:**
```json
{
  "scans": [
    {
      "id": "scan-123",
      "status": "completed",
      "scanType": "full_environment",
      "startedAt": "2023-01-01T00:00:00Z",
      "completedAt": "2023-01-01T00:05:00Z",
      "results": {
        "totalResources": 150,
        "totalFindings": 8,
        "complianceScore": 94.5
      }
    }
  ],
  "nextToken": "eyJpZCI6InNjYW4tMTIzIiwidGVuYW50SWQiOiJ0ZW5hbnQtMTIzIn0=",
  "totalCount": 25
}
```

### DELETE /scans/{scanId}

Cancel a running scan.

**Response:**
```json
{
  "message": "Scan cancelled successfully"
}
```

## Scan Types

### full_environment
Complete scan of all supported services and resources across specified regions.

### incremental
Scan only resources that have changed since the last scan.

### service_specific
Scan only specified services (e.g., S3, IAM, EC2).

### rule_specific
Scan only specified compliance rules.

### resource_specific
Scan only specified resources by ARN.

### scheduled
Automated scan triggered by schedule.

## Supported Services

- **S3** - Buckets, encryption, public access, versioning
- **IAM** - Users, roles, policies, MFA
- **EC2** - Instances, security groups, key pairs
- **CloudTrail** - Trails, logging, encryption
- **KMS** - Keys, rotation, policies
- **RDS** - Instances, encryption, backups
- **Lambda** - Functions, environment variables, VPC

## Supported Regions

- us-east-1, us-east-2, us-west-1, us-west-2
- eu-west-1, eu-west-2, eu-west-3, eu-central-1
- ap-southeast-1, ap-southeast-2, ap-northeast-1, ap-northeast-2
- ca-central-1, sa-east-1

## Compliance Frameworks

- **SOC 2** - Security, availability, processing integrity, confidentiality, privacy
- **HIPAA** - Health Insurance Portability and Accountability Act
- **GDPR** - General Data Protection Regulation
- **PCI** - Payment Card Industry Data Security Standard
- **ISO 27001** - Information Security Management
- **NIST** - National Institute of Standards and Technology

## Error Handling

The Lambda function includes comprehensive error handling:

- **Validation errors** - Invalid request parameters
- **Authentication errors** - Missing or invalid credentials
- **Authorization errors** - Insufficient permissions
- **AWS service errors** - Throttling, service unavailable
- **Resource errors** - Resource not found, access denied

## Monitoring

### CloudWatch Metrics

- **ScanDuration** - Time taken to complete scans
- **ScanSuccessRate** - Percentage of successful scans
- **FindingCount** - Number of findings per scan
- **ComplianceScore** - Average compliance score
- **ErrorRate** - Percentage of failed scans

### CloudWatch Logs

- **Structured logging** - JSON format with context
- **Request tracking** - Request ID for tracing
- **Error details** - Stack traces and error context
- **Performance metrics** - Execution time and resource usage

### X-Ray Tracing

- **Request tracing** - End-to-end request flow
- **Service mapping** - AWS service call tracking
- **Performance analysis** - Bottleneck identification
- **Error analysis** - Failure point identification

## Security

### IAM Permissions

The Lambda function requires the following IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListAllMyBuckets",
        "s3:GetBucket*",
        "s3:GetObject*",
        "iam:List*",
        "iam:Get*",
        "ec2:Describe*",
        "cloudtrail:Describe*",
        "cloudtrail:Get*",
        "cloudtrail:List*",
        "kms:List*",
        "kms:Describe*",
        "kms:Get*",
        "rds:Describe*",
        "lambda:List*",
        "lambda:Get*"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/compliance-shepherd-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

### Data Protection

- **Encryption in transit** - TLS/SSL for all communications
- **Encryption at rest** - KMS encryption for DynamoDB
- **Access control** - IAM policies and resource-based policies
- **Audit logging** - CloudTrail for all API calls
- **Data retention** - Configurable retention policies

## Performance

### Optimization Strategies

- **Parallel processing** - Concurrent resource discovery
- **Batch operations** - Efficient DynamoDB operations
- **Caching** - Reduce redundant API calls
- **Pagination** - Handle large result sets
- **Timeout handling** - Prevent hanging operations

### Scaling

- **Concurrent executions** - Multiple scan instances
- **Memory optimization** - Efficient resource usage
- **Timeout configuration** - Appropriate timeouts
- **Retry logic** - Handle transient failures
- **Circuit breakers** - Prevent cascade failures

## Deployment

### Prerequisites

- Node.js 18.x or later
- AWS CLI configured
- CDK or Terraform for infrastructure
- DynamoDB tables created
- IAM roles and policies

### Build

```bash
npm install
npm run build
npm run package
```

### Deploy

```bash
# Using CDK
cdk deploy ScanEnvironmentStack

# Using Terraform
terraform apply
```

### Environment Variables

- `AWS_REGION` - AWS region
- `DYNAMODB_TABLE_PREFIX` - DynamoDB table prefix
- `API_BASE_URL` - Base URL for API endpoints
- `LOG_LEVEL` - Logging level (DEBUG, INFO, WARN, ERROR)

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### Load Tests

```bash
npm run test:load
```

## Troubleshooting

### Common Issues

1. **Permission denied** - Check IAM permissions
2. **Resource not found** - Verify resource ARNs
3. **Timeout errors** - Increase Lambda timeout
4. **Memory errors** - Increase Lambda memory
5. **Throttling** - Implement exponential backoff

### Debug Mode

Enable debug logging by setting `LOG_LEVEL=DEBUG` environment variable.

### Support

For issues and questions:
- Check CloudWatch logs
- Review X-Ray traces
- Consult documentation
- Contact support team

## Contributing

1. Follow TypeScript best practices
2. Add comprehensive tests
3. Update documentation
4. Use consistent naming
5. Handle errors properly
6. Optimize for performance
7. Consider security implications
8. Test with real data
9. Monitor in production
10. Document changes
