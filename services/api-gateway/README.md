# API Gateway Lambda Function

A unified API gateway for the AI Compliance Shepherd application that provides authentication, request routing, and standardized responses.

## Overview

The API Gateway Lambda function serves as the entry point for all API requests, handling:

- **Authentication & Authorization**: JWT tokens and API key validation
- **Request Routing**: Routes requests to appropriate controllers
- **CORS Handling**: Cross-origin resource sharing support
- **Error Handling**: Standardized error responses
- **Health Checks**: System health and dependency monitoring

## Architecture

```
API Gateway Lambda
├── Authentication Service
│   ├── JWT Token Validation
│   ├── API Key Validation
│   └── User Context Extraction
├── Controllers
│   ├── Scan Controller
│   ├── Findings Controller
│   └── Health Controller
└── Utilities
    ├── Logger
    ├── Error Handler
    └── Validation Helpers
```

## API Endpoints

### Authentication

All endpoints except health checks require authentication via:

- **JWT Token**: `Authorization: Bearer <token>`
- **API Key**: `X-API-Key: <api-key>`
- **Tenant ID**: `X-Tenant-ID: <tenant-id>` (optional)

### Scan Endpoints

#### Start Scan
```http
POST /scans
Content-Type: application/json
Authorization: Bearer <token>

{
  "regions": ["us-east-1", "us-west-2"],
  "services": ["s3", "iam", "ec2", "cloudtrail"],
  "frameworks": ["SOC2", "HIPAA"],
  "options": {
    "includeResources": true,
    "generateReport": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "scanId": "scan-123456",
  "status": "started",
  "message": "Scan has been started successfully",
  "estimatedDuration": 300000,
  "statusUrl": "/scans/scan-123456"
}
```

#### Get Scan Status
```http
GET /scans/{scanId}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "scanId": "scan-123456",
    "tenantId": "tenant-123",
    "status": "completed",
    "startedAt": "2024-01-01T10:00:00Z",
    "completedAt": "2024-01-01T10:05:00Z",
    "duration": 300000,
    "regions": ["us-east-1", "us-west-2"],
    "services": ["s3", "iam", "ec2", "cloudtrail"],
    "frameworks": ["SOC2", "HIPAA"],
    "totalResources": 45,
    "findingsCount": 12,
    "complianceScore": 73.3,
    "findings": {
      "critical": 2,
      "high": 3,
      "medium": 4,
      "low": 3
    },
    "results": {
      "passed": 33,
      "failed": 12,
      "skipped": 0
    }
  }
}
```

#### List Scans
```http
GET /scans?limit=10&offset=0&status=completed
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "scans": [
      {
        "scanId": "scan-001",
        "tenantId": "tenant-123",
        "status": "completed",
        "startedAt": "2024-01-01T09:00:00Z",
        "completedAt": "2024-01-01T09:05:00Z",
        "duration": 300000,
        "regions": ["us-east-1"],
        "services": ["s3", "iam"],
        "frameworks": ["SOC2"],
        "findingsCount": 8,
        "complianceScore": 85.2
      }
    ],
    "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 25,
      "hasMore": true
    }
  }
}
```

### Findings Endpoints

#### Get Finding Details
```http
GET /findings/{findingId}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "findingId": "finding-123",
    "tenantId": "tenant-123",
    "scanId": "scan-456",
    "resourceId": "bucket-789",
    "resourceType": "s3",
    "service": "s3",
    "region": "us-east-1",
    "ruleId": "s3-encryption-required",
    "ruleName": "S3 Bucket Encryption Required",
    "severity": "high",
    "status": "open",
    "title": "S3 bucket is not encrypted",
    "description": "The S3 bucket does not have server-side encryption enabled",
    "evidence": {
      "bucketName": "my-bucket",
      "encryption": null,
      "lastModified": "2024-01-01T08:00:00Z"
    },
    "remediation": {
      "description": "Enable server-side encryption on the S3 bucket",
      "steps": [
        "Navigate to S3 console",
        "Select the bucket",
        "Go to Properties tab",
        "Enable server-side encryption"
      ],
      "automated": true
    },
    "frameworks": ["SOC2", "HIPAA"],
    "tags": ["encryption", "s3", "security"],
    "createdAt": "2024-01-01T10:00:00Z",
    "updatedAt": "2024-01-01T10:00:00Z"
  }
}
```

#### List Findings
```http
GET /findings?severity=high&status=open&service=s3&limit=20&offset=0
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "findings": [
      {
        "findingId": "finding-123",
        "scanId": "scan-456",
        "resourceId": "bucket-789",
        "resourceType": "s3",
        "service": "s3",
        "region": "us-east-1",
        "ruleName": "S3 Bucket Encryption Required",
        "severity": "high",
        "status": "open",
        "title": "S3 bucket is not encrypted",
        "frameworks": ["SOC2", "HIPAA"],
        "createdAt": "2024-01-01T10:00:00Z"
      }
    ],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 150,
      "hasMore": true
    },
    "filters": {
      "severity": "high",
      "status": "open",
      "service": "s3"
    },
    "summary": {
      "total": 150,
      "bySeverity": {
        "critical": 5,
        "high": 25,
        "medium": 60,
        "low": 60
      },
      "byStatus": {
        "open": 120,
        "resolved": 25,
        "suppressed": 5
      }
    }
  }
}
```

#### Update Finding
```http
PUT /findings/{findingId}
Content-Type: application/json
Authorization: Bearer <token>

{
  "status": "resolved",
  "notes": "Issue has been fixed by enabling encryption",
  "tags": ["encryption", "s3", "security", "resolved"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "findingId": "finding-123",
    "status": "resolved",
    "notes": "Issue has been fixed by enabling encryption",
    "tags": ["encryption", "s3", "security", "resolved"],
    "updatedAt": "2024-01-01T11:00:00Z",
    "updatedBy": "user-123"
  },
  "message": "Finding updated successfully"
}
```

#### Batch Operations
```http
POST /findings/batch
Content-Type: application/json
Authorization: Bearer <token>

{
  "operation": "resolve",
  "findingIds": ["finding-1", "finding-2", "finding-3"],
  "operationData": {
    "notes": "Bulk resolution of encryption issues"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "operation": "resolve",
    "successCount": 3,
    "failureCount": 0,
    "results": [
      {
        "findingId": "finding-1",
        "success": true
      },
      {
        "findingId": "finding-2",
        "success": true
      },
      {
        "findingId": "finding-3",
        "success": true
      }
    ]
  },
  "message": "Batch operation completed: 3 successful, 0 failed"
}
```

### Health Endpoints

#### Basic Health Check
```http
GET /health
```

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-01T10:00:00Z",
  "version": "1.0.0",
  "environment": "production",
  "region": "us-east-1",
  "functionName": "api-gateway",
  "functionVersion": "1",
  "requestId": "req-123",
  "responseTime": 45
}
```

#### Readiness Check
```http
GET /health/ready
```

**Response:**
```json
{
  "success": true,
  "status": "ready",
  "timestamp": "2024-01-01T10:00:00Z",
  "dependencies": [
    {
      "name": "dynamodb",
      "healthy": true
    },
    {
      "name": "scan-environment-lambda",
      "healthy": true
    },
    {
      "name": "findings-storage-lambda",
      "healthy": true
    }
  ],
  "responseTime": 67
}
```

#### Liveness Check
```http
GET /health/live
```

**Response:**
```json
{
  "success": true,
  "status": "alive",
  "timestamp": "2024-01-01T10:00:00Z",
  "uptime": 3600,
  "memoryUsage": {
    "rss": 45678592,
    "heapTotal": 20971520,
    "heapUsed": 15728640,
    "external": 1048576
  },
  "responseTime": 12
}
```

#### Metrics
```http
GET /health/metrics
```

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-01T10:00:00Z",
  "metrics": {
    "system": {
      "uptime": 3600,
      "memoryUsage": {
        "rss": 45678592,
        "heapTotal": 20971520,
        "heapUsed": 15728640,
        "external": 1048576
      },
      "cpuUsage": {
        "user": 1234567,
        "system": 234567
      },
      "platform": "linux",
      "nodeVersion": "18.17.0",
      "arch": "x64"
    },
    "aws": {
      "region": "us-east-1",
      "functionName": "api-gateway",
      "functionVersion": "1",
      "requestId": "req-123",
      "remainingTime": 25000
    },
    "application": {
      "version": "1.0.0",
      "environment": "production"
    }
  },
  "responseTime": 89
}
```

## Authentication

### JWT Token Authentication

JWT tokens are used for user authentication and contain:

```json
{
  "userId": "user-123",
  "tenantId": "tenant-456",
  "role": "admin",
  "permissions": ["read", "write", "admin"],
  "email": "user@example.com",
  "name": "John Doe",
  "iat": 1704067200,
  "exp": 1704153600
}
```

### API Key Authentication

API keys are used for service-to-service authentication:

- **Format**: `ak_<type>_<identifier>`
- **Admin Key**: `ak_admin_123456789012345678901234567890`
- **Service Key**: `ak_service_123456789012345678901234567890`

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [
      {
        "field": "regions",
        "message": "At least one region is required"
      }
    ],
    "timestamp": "2024-01-01T10:00:00Z",
    "requestId": "req-123"
  }
}
```

### Error Codes

- `AUTHENTICATION_ERROR` (401): Invalid or missing authentication
- `AUTHORIZATION_ERROR` (403): Insufficient permissions
- `VALIDATION_ERROR` (400): Invalid request data
- `NOT_FOUND_ERROR` (404): Resource not found
- `CONFLICT_ERROR` (409): Resource conflict
- `RATE_LIMIT_ERROR` (429): Rate limit exceeded
- `INTERNAL_SERVER_ERROR` (500): Internal server error
- `SERVICE_UNAVAILABLE_ERROR` (503): Service unavailable

## Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1

# Authentication
JWT_SECRET=your-jwt-secret-key
API_KEY_SECRET=your-api-key-secret

# CORS Configuration
ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com

# Lambda Function Names
SCAN_ENVIRONMENT_FUNCTION_NAME=scan-environment
FINDINGS_STORAGE_FUNCTION_NAME=findings-storage

# Application Configuration
VERSION=1.0.0
ENVIRONMENT=production
LOG_DESTINATION=cloudwatch
```

## Development

### Prerequisites

- Node.js 18+
- TypeScript 5+
- AWS CLI configured
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

### Local Development

```bash
# Watch mode for development
npm run watch

# Run tests in watch mode
npm run test:watch
```

### Testing

The test suite includes:

- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end workflow testing
- **Mock Testing**: AWS SDK and external service mocking
- **Error Handling**: Error scenario testing
- **Authentication**: JWT and API key validation testing

### Deployment

```bash
# Package for deployment
npm run package

# Deploy using AWS CLI or CDK
aws lambda update-function-code \
  --function-name api-gateway \
  --zip-file fileb://api-gateway.zip
```

## Security Considerations

### Authentication Security

- JWT tokens use strong secrets and short expiration times
- API keys are validated with proper format checking
- Tenant isolation is enforced at the API level
- All authentication failures are logged

### CORS Security

- Specific origins are configured (no wildcards in production)
- Credentials are only allowed for trusted origins
- Preflight requests are handled securely

### Input Validation

- All request bodies are validated using Zod schemas
- Path and query parameters are sanitized
- SQL injection and XSS prevention measures are in place

### Error Handling

- Sensitive information is not exposed in error messages
- Stack traces are only shown in development mode
- All errors are logged for monitoring and debugging

## Monitoring and Observability

### Logging

- Structured JSON logging with correlation IDs
- Request/response logging with performance metrics
- Authentication and authorization event logging
- Error logging with stack traces and context

### Metrics

- Request count and response time metrics
- Error rate and status code distribution
- Authentication success/failure rates
- Lambda function performance metrics

### Health Checks

- Basic health check for load balancer integration
- Readiness check for dependency validation
- Liveness check for container orchestration
- Metrics endpoint for monitoring systems

## Performance Optimization

### Caching

- JWT token validation results are cached
- API key validation results are cached
- Health check results are cached for short periods

### Connection Pooling

- AWS SDK clients are reused across requests
- Database connections are pooled efficiently
- HTTP connections are kept alive

### Response Optimization

- Gzip compression is enabled for large responses
- Pagination is implemented for list endpoints
- Field selection is supported for large objects

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Check JWT token expiration
   - Verify API key format and validity
   - Ensure tenant ID matches user's tenant

2. **CORS Errors**
   - Verify allowed origins configuration
   - Check preflight request handling
   - Ensure credentials are properly configured

3. **Lambda Timeouts**
   - Check downstream service response times
   - Verify connection pooling configuration
   - Monitor memory usage and optimization

4. **Validation Errors**
   - Check request body format
   - Verify required fields are present
   - Ensure data types match schema requirements

### Debug Mode

Enable debug logging by setting:

```bash
LOG_LEVEL=debug
```

This will provide detailed information about:
- Request processing flow
- Authentication steps
- Validation results
- Error details

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new functionality
3. Update documentation for API changes
4. Ensure all tests pass before submitting
5. Use conventional commit messages

## License

This project is licensed under the MIT License - see the LICENSE file for details.
