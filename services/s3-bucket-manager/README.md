# S3 Bucket Manager Lambda Function

A comprehensive S3 bucket management service for reports and artifacts with proper permissions, lifecycle policies, and security configurations.

## Overview

The S3 Bucket Manager Lambda function provides centralized management of S3 buckets for the AI Compliance Shepherd application, including:

- **Bucket Creation**: Automated bucket creation with proper configurations
- **Security Management**: IAM policies, bucket policies, and access controls
- **Lifecycle Policies**: Automated data transitions and expiration
- **Configuration Management**: Versioning, encryption, and CORS settings
- **Monitoring**: Bucket statistics and security validation
- **Cost Optimization**: Lifecycle policies for storage cost reduction

## Architecture

```
S3 Bucket Manager Lambda
├── Bucket Configuration Service
│   ├── Bucket Creation
│   ├── Configuration Updates
│   └── Statistics Collection
├── Bucket Security Service
│   ├── IAM Policy Management
│   ├── Bucket Policy Configuration
│   └── Access Control Validation
├── Bucket Lifecycle Service
│   ├── Lifecycle Policy Management
│   ├── Cost Optimization
│   └── Data Transitions
└── Utilities
    ├── Logger
    ├── Error Handler
    └── Validation Helpers
```

## API Endpoints

### Create Bucket
```http
POST /buckets
Content-Type: application/json
Authorization: Bearer <token>

{
  "bucketName": "compliance-shepherd-reports-tenant-123",
  "region": "us-east-1",
  "purpose": "reports",
  "encryption": "AES256",
  "versioning": true,
  "publicAccessBlock": true,
  "lifecyclePolicy": {
    "enabled": true,
    "rules": [
      {
        "id": "reports-cleanup",
        "status": "Enabled",
        "transitions": [
          {
            "days": 30,
            "storageClass": "STANDARD_IA"
          },
          {
            "days": 90,
            "storageClass": "GLACIER"
          }
        ],
        "expiration": {
          "days": 365
        }
      }
    ]
  },
  "corsConfiguration": {
    "allowedOrigins": ["https://app.example.com"],
    "allowedMethods": ["GET", "POST", "PUT"],
    "allowedHeaders": ["Content-Type", "Authorization"],
    "maxAgeSeconds": 3600
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bucketName": "compliance-shepherd-reports-tenant-123",
    "region": "us-east-1",
    "purpose": "reports",
    "encryption": "AES256",
    "versioning": true,
    "publicAccessBlock": true,
    "lifecyclePolicy": true,
    "corsConfiguration": true,
    "createdBy": "user-123",
    "createdAt": "2024-01-01T10:00:00Z"
  }
}
```

### Get Bucket Information
```http
GET /buckets/{bucketName}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bucketName": "compliance-shepherd-reports-tenant-123",
    "region": "us-east-1",
    "purpose": "reports",
    "creationDate": "2024-01-01T10:00:00Z",
    "size": 1048576,
    "objectCount": 25,
    "encryption": "AES256",
    "versioning": true,
    "publicAccessBlock": true,
    "lifecyclePolicy": true,
    "corsConfiguration": true
  }
}
```

### List Buckets
```http
GET /buckets?limit=10&offset=0&purpose=reports
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "buckets": [
      {
        "bucketName": "compliance-shepherd-reports-tenant-123",
        "region": "us-east-1",
        "purpose": "reports",
        "creationDate": "2024-01-01T10:00:00Z",
        "size": 1048576,
        "objectCount": 25,
        "encryption": "AES256",
        "versioning": true,
        "publicAccessBlock": true,
        "lifecyclePolicy": true,
        "corsConfiguration": true
      }
    ],
    "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 1,
      "hasMore": false
    }
  }
}
```

### Update Bucket Configuration
```http
PUT /buckets/{bucketName}/configuration
Content-Type: application/json
Authorization: Bearer <token>

{
  "encryption": "aws-kms",
  "kmsKeyId": "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012",
  "versioning": true,
  "corsConfiguration": {
    "allowedOrigins": ["https://app.example.com", "https://admin.example.com"],
    "allowedMethods": ["GET", "POST", "PUT", "DELETE"],
    "allowedHeaders": ["Content-Type", "Authorization", "X-API-Key"],
    "maxAgeSeconds": 3600
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bucketName": "compliance-shepherd-reports-tenant-123",
    "region": "us-east-1",
    "purpose": "reports",
    "encryption": "aws-kms",
    "versioning": true,
    "corsConfiguration": true
  },
  "message": "Bucket configuration updated successfully"
}
```

### Update Bucket Permissions
```http
PUT /buckets/{bucketName}/permissions
Content-Type: application/json
Authorization: Bearer <token>

{
  "publicAccessBlock": false,
  "bucketPolicy": {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "AllowComplianceShepherdAccess",
        "Effect": "Allow",
        "Principal": {
          "AWS": "arn:aws:iam::123456789012:role/compliance-shepherd-*"
        },
        "Action": [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ],
        "Resource": [
          "arn:aws:s3:::bucket-name",
          "arn:aws:s3:::bucket-name/*"
        ]
      }
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "publicAccessBlock": false,
    "bucketPolicy": {
      "Version": "2012-10-17",
      "Statement": [...]
    }
  },
  "message": "Bucket permissions updated successfully"
}
```

### Update Bucket Lifecycle
```http
PUT /buckets/{bucketName}/lifecycle
Content-Type: application/json
Authorization: Bearer <token>

{
  "enabled": true,
  "rules": [
    {
      "id": "reports-cleanup",
      "status": "Enabled",
      "filter": {
        "prefix": "reports/"
      },
      "transitions": [
        {
          "days": 30,
          "storageClass": "STANDARD_IA"
        },
        {
          "days": 90,
          "storageClass": "GLACIER"
        }
      ],
      "expiration": {
        "days": 365
      },
      "noncurrentVersionExpiration": {
        "noncurrentDays": 30
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "rules": [
      {
        "id": "reports-cleanup",
        "status": "Enabled",
        "filter": {
          "prefix": "reports/"
        },
        "transitions": [
          {
            "days": 30,
            "storageClass": "STANDARD_IA"
          },
          {
            "days": 90,
            "storageClass": "GLACIER"
          }
        ],
        "expiration": {
          "days": 365
        },
        "noncurrentVersionExpiration": {
          "noncurrentDays": 30
        }
      }
    ]
  },
  "message": "Bucket lifecycle policy updated successfully"
}
```

### Delete Bucket
```http
DELETE /buckets/{bucketName}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Bucket deleted successfully"
}
```

## Bucket Purposes

### Reports Bucket
- **Purpose**: Store compliance reports and documentation
- **Lifecycle**: 30 days in Standard, 90 days in Glacier, 1 year expiration
- **Access**: Read/write for report generation services
- **Encryption**: AES256 or AWS KMS

### Artifacts Bucket
- **Purpose**: Store scan artifacts and temporary files
- **Lifecycle**: 7 days in Standard, 30 days in Glacier, 90 days expiration
- **Access**: Read/write for scan services
- **Encryption**: AES256 or AWS KMS

### Logs Bucket
- **Purpose**: Store application and audit logs
- **Lifecycle**: 1 day in Standard, 7 days in Glacier, 30 days expiration
- **Access**: Write-only for logging services
- **Encryption**: AES256 or AWS KMS

### Backups Bucket
- **Purpose**: Store backup data and snapshots
- **Lifecycle**: 30 days in Standard, 90 days in Glacier, 7 years in Deep Archive
- **Access**: Read/write for backup services
- **Encryption**: AES256 or AWS KMS

## Security Features

### Public Access Block
- **BlockPublicAcls**: Prevents public ACLs
- **IgnorePublicAcls**: Ignores public ACLs
- **BlockPublicPolicy**: Blocks public bucket policies
- **RestrictPublicBuckets**: Restricts public bucket access

### Bucket Policies
- **Deny Public Access**: Explicitly denies public access
- **Allow Service Access**: Allows access from compliance-shepherd services
- **Purpose-Specific Access**: Different permissions based on bucket purpose
- **Conditional Access**: Access based on conditions and requirements

### IAM Policies
- **Service-Specific Policies**: Policies for different service types
- **Least Privilege**: Minimum required permissions
- **Resource-Specific**: Policies scoped to specific buckets
- **Conditional Policies**: Policies with conditions and restrictions

### Encryption
- **Server-Side Encryption**: AES256 or AWS KMS encryption
- **Key Management**: KMS key rotation and management
- **Encryption at Rest**: All data encrypted at rest
- **Encryption in Transit**: HTTPS/TLS for data in transit

## Lifecycle Policies

### Default Policies by Purpose

#### Reports
```json
{
  "enabled": true,
  "rules": [
    {
      "id": "reports-cleanup",
      "status": "Enabled",
      "filter": {
        "prefix": "reports/"
      },
      "transitions": [
        {
          "days": 30,
          "storageClass": "STANDARD_IA"
        },
        {
          "days": 90,
          "storageClass": "GLACIER"
        }
      ],
      "expiration": {
        "days": 365
      },
      "noncurrentVersionExpiration": {
        "noncurrentDays": 30
      }
    }
  ]
}
```

#### Artifacts
```json
{
  "enabled": true,
  "rules": [
    {
      "id": "artifacts-cleanup",
      "status": "Enabled",
      "filter": {
        "prefix": "artifacts/"
      },
      "transitions": [
        {
          "days": 7,
          "storageClass": "STANDARD_IA"
        },
        {
          "days": 30,
          "storageClass": "GLACIER"
        }
      ],
      "expiration": {
        "days": 90
      },
      "noncurrentVersionExpiration": {
        "noncurrentDays": 7
      }
    }
  ]
}
```

#### Logs
```json
{
  "enabled": true,
  "rules": [
    {
      "id": "logs-cleanup",
      "status": "Enabled",
      "filter": {
        "prefix": "logs/"
      },
      "transitions": [
        {
          "days": 1,
          "storageClass": "STANDARD_IA"
        },
        {
          "days": 7,
          "storageClass": "GLACIER"
        }
      ],
      "expiration": {
        "days": 30
      },
      "noncurrentVersionExpiration": {
        "noncurrentDays": 1
      }
    }
  ]
}
```

#### Backups
```json
{
  "enabled": true,
  "rules": [
    {
      "id": "backups-cleanup",
      "status": "Enabled",
      "filter": {
        "prefix": "backups/"
      },
      "transitions": [
        {
          "days": 30,
          "storageClass": "STANDARD_IA"
        },
        {
          "days": 90,
          "storageClass": "GLACIER"
        },
        {
          "days": 365,
          "storageClass": "DEEP_ARCHIVE"
        }
      ],
      "expiration": {
        "days": 2555
      },
      "noncurrentVersionExpiration": {
        "noncurrentDays": 30
      }
    }
  ]
}
```

## Cost Optimization

### Storage Classes
- **Standard**: Frequently accessed data
- **Standard-IA**: Infrequently accessed data (30+ days)
- **Glacier**: Archive data (90+ days)
- **Deep Archive**: Long-term archive data (365+ days)

### Cost Savings Calculation
- **Standard to Standard-IA**: ~45% savings
- **Standard to Glacier**: ~83% savings
- **Standard to Deep Archive**: ~96% savings

### Lifecycle Policy Benefits
- **Automatic Transitions**: No manual intervention required
- **Cost Reduction**: Significant savings on storage costs
- **Compliance**: Meets data retention requirements
- **Performance**: Optimizes access patterns

## Monitoring and Validation

### Bucket Statistics
- **Total Objects**: Count of objects in bucket
- **Total Size**: Total size of all objects
- **Average Object Size**: Average size per object
- **Storage Classes**: Distribution across storage classes
- **File Types**: Distribution by file extension

### Security Validation
- **Public Access Block**: Validates public access settings
- **Bucket Policy**: Validates bucket policy configuration
- **Encryption**: Validates encryption settings
- **Versioning**: Validates versioning configuration
- **IAM Policies**: Validates IAM policy attachments

### Lifecycle Validation
- **Policy Configuration**: Validates lifecycle policy syntax
- **Rule Validation**: Validates individual lifecycle rules
- **Cost Impact**: Calculates potential cost savings
- **Compliance**: Ensures compliance with retention policies

## Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012

# Application Configuration
VERSION=1.0.0
ENVIRONMENT=production
LOG_DESTINATION=cloudwatch

# Bucket Configuration
DEFAULT_BUCKET_PREFIX=compliance-shepherd
DEFAULT_LIFECYCLE_ENABLED=true
DEFAULT_ENCRYPTION=AES256

# Security Configuration
ENABLE_PUBLIC_ACCESS_BLOCK=true
ENABLE_VERSIONING=true
ENABLE_ENCRYPTION=true
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
- **Security Testing**: Security configuration validation
- **Performance Testing**: Bucket operation performance

### Deployment
```bash
# Package for deployment
npm run package

# Deploy using AWS CLI or CDK
aws lambda update-function-code \
  --function-name s3-bucket-manager \
  --zip-file fileb://s3-bucket-manager.zip
```

## Troubleshooting

### Common Issues

1. **Bucket Creation Failures**
   - Check IAM permissions
   - Verify bucket name uniqueness
   - Ensure region availability

2. **Permission Errors**
   - Verify IAM role permissions
   - Check bucket policy configuration
   - Validate public access block settings

3. **Lifecycle Policy Errors**
   - Check policy syntax
   - Verify transition rules
   - Ensure expiration settings

4. **Encryption Issues**
   - Verify KMS key permissions
   - Check encryption configuration
   - Ensure key availability

### Debug Mode
Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

This will provide detailed information about:
- Bucket creation process
- Security configuration
- Lifecycle policy application
- Error details and stack traces

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new functionality
3. Update documentation for API changes
4. Ensure all tests pass before submitting
5. Use conventional commit messages

## License

This project is licensed under the MIT License - see the LICENSE file for details.
