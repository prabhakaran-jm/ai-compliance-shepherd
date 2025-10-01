# Findings Storage Lambda Function

This Lambda function provides comprehensive CRUD operations, filtering, and statistics for compliance findings stored in DynamoDB. It serves as the data access layer for findings management in the AI Compliance Shepherd application.

## Features

- **CRUD Operations** - Create, read, update, and delete findings
- **Advanced Filtering** - Filter by severity, framework, status, service, region, and more
- **Batch Operations** - Create multiple findings in a single request
- **Search Functionality** - Full-text search across finding titles, descriptions, and tags
- **Statistics and Analytics** - Comprehensive finding statistics and trends
- **Status Management** - Update finding status, suppress findings, and track resolution
- **Pagination Support** - Handle large datasets with efficient pagination
- **Multi-tenant Support** - Tenant isolation and data segregation
- **Audit Logging** - Complete audit trail of all operations
- **Error Handling** - Robust error handling with detailed error responses

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Gateway   │───▶│  Lambda Handler  │───▶│ Storage Service │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CloudWatch    │    │  Data Access     │    │   DynamoDB      │
│   (Logs)        │    │  Layer           │    │   (Findings)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## API Endpoints

### GET /findings/{tenantId}

Get findings for a tenant with optional filters and pagination.

**Query Parameters:**
- `severity` - Filter by severity (low, medium, high, critical)
- `framework` - Filter by compliance framework (SOC2, HIPAA, GDPR, etc.)
- `status` - Filter by status (active, resolved, suppressed)
- `service` - Filter by AWS service (s3, iam, ec2, etc.)
- `region` - Filter by AWS region
- `resourceType` - Filter by resource type
- `accountId` - Filter by AWS account ID
- `scanId` - Filter by scan ID
- `tags` - Filter by tags (comma-separated)
- `dateFrom` - Filter by date range (start)
- `dateTo` - Filter by date range (end)
- `limit` - Number of findings to return (default: 100)
- `nextToken` - Pagination token

**Response:**
```json
{
  "items": [
    {
      "id": "finding-123",
      "tenantId": "tenant-1",
      "scanId": "scan-456",
      "ruleId": "rule-789",
      "resourceArn": "arn:aws:s3:::my-bucket",
      "resourceType": "s3_bucket",
      "service": "s3",
      "region": "us-east-1",
      "accountId": "123456789012",
      "severity": "high",
      "framework": "SOC2",
      "status": "active",
      "title": "S3 bucket not encrypted",
      "description": "S3 bucket 'my-bucket' does not have encryption enabled",
      "recommendation": "Enable server-side encryption for the S3 bucket",
      "evidence": {
        "resourceArn": "arn:aws:s3:::my-bucket",
        "configuration": {
          "encryption": null
        }
      },
      "tags": ["s3", "encryption", "SOC2"],
      "hash": "abc123def456",
      "firstSeen": "2023-01-01T00:00:00Z",
      "lastSeen": "2023-01-01T00:00:00Z",
      "count": 1,
      "metadata": {
        "createdBy": "system",
        "source": "scan"
      }
    }
  ],
  "nextToken": "eyJpZCI6ImZpbmRpbmctMTIzIiwidGVuYW50SWQiOiJ0ZW5hbnQtMSJ9",
  "totalCount": 25
}
```

### GET /findings/{tenantId}/{findingId}

Get a specific finding by ID.

**Response:**
```json
{
  "id": "finding-123",
  "tenantId": "tenant-1",
  "scanId": "scan-456",
  "ruleId": "rule-789",
  "resourceArn": "arn:aws:s3:::my-bucket",
  "resourceType": "s3_bucket",
  "service": "s3",
  "region": "us-east-1",
  "accountId": "123456789012",
  "severity": "high",
  "framework": "SOC2",
  "status": "active",
  "title": "S3 bucket not encrypted",
  "description": "S3 bucket 'my-bucket' does not have encryption enabled",
  "recommendation": "Enable server-side encryption for the S3 bucket",
  "evidence": {
    "resourceArn": "arn:aws:s3:::my-bucket",
    "configuration": {
      "encryption": null
    }
  },
  "tags": ["s3", "encryption", "SOC2"],
  "hash": "abc123def456",
  "firstSeen": "2023-01-01T00:00:00Z",
  "lastSeen": "2023-01-01T00:00:00Z",
  "count": 1,
  "metadata": {
    "createdBy": "system",
    "source": "scan"
  }
}
```

### POST /findings/{tenantId}

Create a new finding.

**Request Body:**
```json
{
  "scanId": "scan-456",
  "ruleId": "rule-789",
  "resourceArn": "arn:aws:s3:::my-bucket",
  "resourceType": "s3_bucket",
  "service": "s3",
  "region": "us-east-1",
  "accountId": "123456789012",
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
  },
  "tags": ["s3", "encryption", "SOC2"],
  "metadata": {
    "createdBy": "user-123",
    "source": "api"
  }
}
```

**Response:**
```json
{
  "id": "finding-123",
  "tenantId": "tenant-1",
  "scanId": "scan-456",
  "ruleId": "rule-789",
  "resourceArn": "arn:aws:s3:::my-bucket",
  "resourceType": "s3_bucket",
  "service": "s3",
  "region": "us-east-1",
  "accountId": "123456789012",
  "severity": "high",
  "framework": "SOC2",
  "status": "active",
  "title": "S3 bucket not encrypted",
  "description": "S3 bucket 'my-bucket' does not have encryption enabled",
  "recommendation": "Enable server-side encryption for the S3 bucket",
  "evidence": {
    "resourceArn": "arn:aws:s3:::my-bucket",
    "configuration": {
      "encryption": null
    }
  },
  "tags": ["s3", "encryption", "SOC2"],
  "hash": "abc123def456",
  "firstSeen": "2023-01-01T00:00:00Z",
  "lastSeen": "2023-01-01T00:00:00Z",
  "count": 1,
  "metadata": {
    "createdBy": "user-123",
    "source": "api"
  }
}
```

### POST /findings/{tenantId}/batch

Create multiple findings in batch.

**Request Body:**
```json
[
  {
    "scanId": "scan-456",
    "ruleId": "rule-789",
    "resourceArn": "arn:aws:s3:::bucket1",
    "severity": "high",
    "title": "Finding 1"
  },
  {
    "scanId": "scan-456",
    "ruleId": "rule-790",
    "resourceArn": "arn:aws:s3:::bucket2",
    "severity": "medium",
    "title": "Finding 2"
  }
]
```

**Response:**
```json
{
  "created": [
    {
      "id": "finding-123",
      "tenantId": "tenant-1",
      "title": "Finding 1"
    },
    {
      "id": "finding-124",
      "tenantId": "tenant-1",
      "title": "Finding 2"
    }
  ],
  "failed": [],
  "total": 2
}
```

### PUT /findings/{tenantId}/{findingId}

Update a finding.

**Request Body:**
```json
{
  "status": "resolved",
  "resolvedBy": "user-123",
  "resolvedAt": "2023-01-01T12:00:00Z",
  "metadata": {
    "resolutionNotes": "Encryption enabled on the bucket"
  }
}
```

**Response:**
```json
{
  "id": "finding-123",
  "tenantId": "tenant-1",
  "status": "resolved",
  "resolvedBy": "user-123",
  "resolvedAt": "2023-01-01T12:00:00Z",
  "lastSeen": "2023-01-01T12:00:00Z",
  "metadata": {
    "resolutionNotes": "Encryption enabled on the bucket"
  }
}
```

### DELETE /findings/{tenantId}/{findingId}

Delete a finding.

**Response:**
```
Status: 204 No Content
```

## Specialized Endpoints

### GET /findings/{tenantId}/statistics

Get finding statistics for a tenant.

**Response:**
```json
{
  "total": 150,
  "bySeverity": {
    "critical": 5,
    "high": 25,
    "medium": 75,
    "low": 45
  },
  "byStatus": {
    "active": 100,
    "resolved": 40,
    "suppressed": 10
  },
  "byFramework": {
    "SOC2": 80,
    "HIPAA": 45,
    "GDPR": 25
  },
  "byService": {
    "s3": 50,
    "iam": 30,
    "ec2": 25,
    "cloudtrail": 20,
    "kms": 15,
    "rds": 10
  }
}
```

### GET /findings/{tenantId}/search?q={searchTerm}

Search findings by text.

**Query Parameters:**
- `q` - Search term
- `limit` - Number of results to return
- `nextToken` - Pagination token

**Response:**
```json
{
  "items": [
    {
      "id": "finding-123",
      "title": "S3 bucket encryption issue",
      "description": "Bucket is not encrypted",
      "tags": ["encryption", "s3"]
    }
  ],
  "nextToken": "eyJpZCI6ImZpbmRpbmctMTIzIiwidGVuYW50SWQiOiJ0ZW5hbnQtMSJ9",
  "totalCount": 5
}
```

## Error Handling

The Lambda function includes comprehensive error handling:

- **Validation errors** - Invalid request parameters
- **Authentication errors** - Missing or invalid credentials
- **Authorization errors** - Insufficient permissions
- **Not found errors** - Resource not found
- **Conflict errors** - Resource conflicts
- **AWS service errors** - DynamoDB errors, throttling
- **Internal errors** - Unexpected system errors

### Error Response Format

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Missing required fields: tenantId, resourceArn",
  "details": {
    "missingFields": ["tenantId", "resourceArn"],
    "providedFields": ["severity", "framework"]
  },
  "timestamp": "2023-01-01T00:00:00Z"
}
```

## Performance Considerations

### Optimization Strategies

- **Batch operations** - Efficient DynamoDB batch writes
- **Pagination** - Handle large result sets efficiently
- **Indexing** - Use GSI and LSI for fast queries
- **Caching** - Reduce redundant database calls
- **Connection pooling** - Reuse DynamoDB connections

### Scaling

- **Concurrent executions** - Multiple Lambda instances
- **Memory optimization** - Efficient resource usage
- **Timeout configuration** - Appropriate timeouts
- **Retry logic** - Handle transient failures
- **Circuit breakers** - Prevent cascade failures

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
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/compliance-shepherd-findings",
        "arn:aws:dynamodb:*:*:table/compliance-shepherd-findings/index/*"
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

## Monitoring

### CloudWatch Metrics

- **RequestCount** - Number of API requests
- **RequestDuration** - Request processing time
- **ErrorRate** - Percentage of failed requests
- **ThrottleCount** - Number of throttled requests
- **DynamoDBReadCapacity** - DynamoDB read capacity usage
- **DynamoDBWriteCapacity** - DynamoDB write capacity usage

### CloudWatch Logs

- **Structured logging** - JSON format with context
- **Request tracking** - Request ID for tracing
- **Error details** - Stack traces and error context
- **Performance metrics** - Execution time and resource usage

### X-Ray Tracing

- **Request tracing** - End-to-end request flow
- **Service mapping** - DynamoDB call tracking
- **Performance analysis** - Bottleneck identification
- **Error analysis** - Failure point identification

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
cdk deploy FindingsStorageStack

# Using Terraform
terraform apply
```

### Environment Variables

- `AWS_REGION` - AWS region
- `DYNAMODB_TABLE_PREFIX` - DynamoDB table prefix
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
2. **Resource not found** - Verify resource IDs
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
