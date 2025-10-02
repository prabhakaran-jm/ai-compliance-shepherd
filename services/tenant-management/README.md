# Tenant Management Service

The Tenant Management service provides comprehensive multi-tenant architecture with secure isolation for the AI Compliance Shepherd platform. It manages tenant lifecycle, resource isolation, security boundaries, and onboarding/offboarding processes.

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Tenant          │───▶│ Tenant           │───▶│ Resource        │
│ Management      │    │ Isolation        │    │ Management      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Tenant CRUD     │    │ Security         │    │ AWS Resources   │
│ Operations      │    │ Validation       │    │ (S3, KMS, IAM)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Onboarding/     │    │ Compliance       │    │ Encryption      │
│ Offboarding     │    │ Monitoring       │    │ Management      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 Features

### Multi-Tenant Architecture
- **Secure Tenant Isolation**: Complete data and resource separation between tenants
- **Tenant Lifecycle Management**: Full CRUD operations for tenant management
- **Resource Provisioning**: Automated creation of tenant-specific AWS resources
- **Configuration Management**: Flexible tenant-specific configurations and limits

### Security & Isolation
- **Data Isolation**: Tenant-specific S3 buckets, DynamoDB table prefixes, and encryption keys
- **Network Isolation**: VPC-based network separation and security group controls
- **Access Control**: IAM roles and policies with tenant-specific restrictions
- **Encryption**: Tenant-specific KMS keys with automatic rotation

### Onboarding & Offboarding
- **Automated Onboarding**: Complete tenant setup with infrastructure provisioning
- **Step-by-Step Process**: Tracked onboarding steps with rollback capabilities
- **Resource Cleanup**: Safe offboarding with data export and resource cleanup
- **Compliance Validation**: Automated security and isolation validation

### Monitoring & Compliance
- **Health Monitoring**: Real-time tenant health and performance metrics
- **Compliance Tracking**: Framework-specific compliance scoring and reporting
- **Audit Logging**: Comprehensive audit trails for all tenant operations
- **Violation Detection**: Automated detection and alerting of isolation violations

## 📋 API Endpoints

### Tenant Management

#### Create Tenant
```http
POST /tenants
Content-Type: application/json

{
  "name": "acme-corp",
  "displayName": "ACME Corporation",
  "organizationId": "org-12345",
  "tier": "ENTERPRISE",
  "configuration": {
    "complianceFrameworks": ["SOC2", "HIPAA"],
    "scanSchedule": "DAILY",
    "retentionPeriodDays": 365,
    "encryptionEnabled": true,
    "auditLoggingEnabled": true,
    "crossAccountRoleEnabled": true,
    "allowedRegions": ["us-east-1", "us-west-2"],
    "resourceLimits": {
      "maxFindings": 50000,
      "maxScanJobs": 500,
      "maxUsers": 200,
      "maxReports": 5000
    },
    "features": {
      "automatedRemediation": true,
      "realTimeMonitoring": true,
      "customRules": true,
      "apiAccess": true,
      "ssoIntegration": true
    }
  },
  "contactInfo": {
    "primaryContact": {
      "name": "John Doe",
      "email": "john.doe@acme-corp.com",
      "phone": "+1-555-0123"
    },
    "technicalContact": {
      "name": "Jane Smith",
      "email": "jane.smith@acme-corp.com"
    }
  },
  "billingInfo": {
    "billingEmail": "billing@acme-corp.com",
    "paymentMethod": "CREDIT_CARD",
    "billingAddress": {
      "street": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "zipCode": "94105",
      "country": "US"
    }
  }
}
```

#### List Tenants
```http
GET /tenants?status=ACTIVE&tier=ENTERPRISE&limit=50
```

#### Get Tenant
```http
GET /tenants/{tenantId}
```

#### Update Tenant
```http
PUT /tenants/{tenantId}
Content-Type: application/json

{
  "displayName": "Updated ACME Corporation",
  "tier": "PREMIUM",
  "contactInfo": {
    "primaryContact": {
      "name": "John Smith",
      "email": "john.smith@acme-corp.com"
    }
  }
}
```

#### Delete Tenant
```http
DELETE /tenants/{tenantId}
```

### Tenant Configuration

#### Get Configuration
```http
GET /tenants/{tenantId}/config
```

#### Update Configuration
```http
PUT /tenants/{tenantId}/config
Content-Type: application/json

{
  "scanSchedule": "WEEKLY",
  "retentionPeriodDays": 730,
  "features": {
    "automatedRemediation": false,
    "customRules": true
  }
}
```

### Tenant Isolation

#### Get Isolation Status
```http
GET /tenants/{tenantId}/isolation
```

#### Validate Isolation
```http
POST /tenants/{tenantId}/isolation/validate
```

### Tenant Onboarding

#### Onboard Tenant
```http
POST /tenants/onboard
Content-Type: application/json

{
  "name": "new-company",
  "organizationId": "org-67890",
  "tier": "STANDARD",
  "contactInfo": {
    "primaryContact": {
      "name": "Alice Johnson",
      "email": "alice@new-company.com"
    }
  }
}
```

#### Offboard Tenant
```http
POST /tenants/{tenantId}/offboard
```

### Tenant Metrics & Health

#### Get Metrics
```http
GET /tenants/{tenantId}/metrics
```

#### Get Health Status
```http
GET /tenants/{tenantId}/health
```

## 🔧 Configuration

### Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012

# Service Configuration
SERVICE_VERSION=1.0.0
LOG_LEVEL=INFO
ENVIRONMENT=production

# Tenant Configuration
DEFAULT_TENANT_TIER=STANDARD
DEFAULT_RETENTION_DAYS=365
MAX_TENANTS_PER_ORGANIZATION=10

# Security Configuration
ENCRYPTION_KEY_ROTATION_ENABLED=true
AUDIT_LOGGING_ENABLED=true
ISOLATION_VALIDATION_ENABLED=true

# Resource Limits (per tier)
BASIC_MAX_FINDINGS=1000
STANDARD_MAX_FINDINGS=10000
PREMIUM_MAX_FINDINGS=50000
ENTERPRISE_MAX_FINDINGS=100000
```

### IAM Permissions

The service requires the following IAM permissions:

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
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/tenants*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:DeleteBucket",
        "s3:GetBucketLocation",
        "s3:GetBucketVersioning",
        "s3:PutBucketVersioning",
        "s3:PutBucketEncryption",
        "s3:PutBucketPolicy"
      ],
      "Resource": "arn:aws:s3:::compliance-shepherd-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:CreateKey",
        "kms:CreateAlias",
        "kms:DescribeKey",
        "kms:EnableKeyRotation",
        "kms:GetKeyPolicy",
        "kms:PutKeyPolicy"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:ListAttachedRolePolicies"
      ],
      "Resource": "arn:aws:iam::*:role/ComplianceShepherd-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:CreateSecret",
        "secretsmanager:UpdateSecret",
        "secretsmanager:PutSecretValue",
        "secretsmanager:GetSecretValue",
        "secretsmanager:DeleteSecret"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:compliance-shepherd/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateStack",
        "cloudformation:UpdateStack",
        "cloudformation:DeleteStack",
        "cloudformation:DescribeStacks"
      ],
      "Resource": "arn:aws:cloudformation:*:*:stack/compliance-shepherd-*"
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

## 🏢 Tenant Tiers and Limits

### BASIC Tier
- **Max Findings**: 1,000
- **Max Scan Jobs**: 10
- **Max Users**: 5
- **Max Reports**: 100
- **Features**: Basic scanning, manual remediation
- **Support**: Community support

### STANDARD Tier
- **Max Findings**: 10,000
- **Max Scan Jobs**: 100
- **Max Users**: 50
- **Max Reports**: 1,000
- **Features**: Automated remediation, real-time monitoring
- **Support**: Email support

### PREMIUM Tier
- **Max Findings**: 50,000
- **Max Scan Jobs**: 500
- **Max Users**: 200
- **Max Reports**: 5,000
- **Features**: Custom rules, API access, advanced reporting
- **Support**: Priority support

### ENTERPRISE Tier
- **Max Findings**: 100,000+
- **Max Scan Jobs**: 1,000+
- **Max Users**: 1,000+
- **Max Reports**: 10,000+
- **Features**: SSO integration, custom compliance frameworks, dedicated support
- **Support**: 24/7 dedicated support

## 🔒 Security & Isolation

### Data Isolation

#### S3 Bucket Isolation
- **Tenant-Specific Buckets**: Each tenant gets a dedicated S3 bucket
- **Naming Convention**: `compliance-shepherd-{tenant-name}`
- **Encryption**: Tenant-specific KMS keys for all objects
- **Access Control**: Bucket policies restrict access to tenant resources only

#### DynamoDB Isolation
- **Table Prefixes**: All DynamoDB tables use tenant-specific prefixes
- **Row-Level Security**: Partition keys include tenant ID
- **Access Patterns**: Queries automatically filter by tenant ID
- **Encryption**: Tenant-specific KMS keys for table encryption

#### KMS Key Isolation
- **Tenant-Specific Keys**: Each tenant has dedicated KMS keys
- **Key Policies**: Restrict key usage to tenant resources only
- **Automatic Rotation**: Keys rotate automatically every year
- **Alias Management**: Tenant-specific key aliases for easy identification

### Network Isolation

#### VPC Isolation (Optional)
- **Dedicated VPCs**: Enterprise tenants can have dedicated VPCs
- **Private Subnets**: All tenant resources in private subnets
- **Security Groups**: Tenant-specific security group rules
- **Network ACLs**: Additional network-level isolation

#### API Isolation
- **Tenant Context**: All API calls include tenant context
- **Request Validation**: Automatic tenant ID validation
- **Cross-Tenant Prevention**: Prevents access to other tenant resources
- **Rate Limiting**: Per-tenant rate limiting and quotas

### Access Control

#### IAM Role Isolation
- **Tenant-Specific Roles**: Each tenant has dedicated IAM roles
- **Least Privilege**: Roles have minimal required permissions
- **Resource Restrictions**: Policies restrict access to tenant resources only
- **Cross-Account Support**: Optional cross-account role assumption

#### API Key Management
- **Tenant-Specific Keys**: Each tenant has unique API keys
- **Scoped Permissions**: Keys have tenant-specific permission scopes
- **Rotation**: Automatic key rotation and expiration
- **Audit Logging**: All API key usage is logged and monitored

## 📊 Monitoring & Compliance

### Health Monitoring

The service monitors the following components:

- **Database Health**: DynamoDB table accessibility and performance
- **Storage Health**: S3 bucket accessibility and encryption status
- **Encryption Health**: KMS key availability and rotation status
- **API Health**: API response times and error rates
- **Scanning Health**: Scan job success rates and performance

### Compliance Frameworks

#### SOC 2 Compliance
- **Access Controls**: Logical and physical access controls
- **System Operations**: Monitoring and incident management
- **Change Management**: Configuration and change controls
- **Risk Management**: Risk assessment and mitigation

#### HIPAA Compliance
- **Administrative Safeguards**: Security officer and training
- **Physical Safeguards**: Facility access and workstation controls
- **Technical Safeguards**: Access control and audit controls
- **Breach Notification**: Incident response and reporting

#### GDPR Compliance
- **Data Protection**: Privacy by design and default
- **Data Subject Rights**: Access, rectification, and erasure
- **Data Processing**: Lawful basis and consent management
- **Data Transfers**: Cross-border transfer controls

### Audit Logging

All tenant operations are logged with the following information:

```json
{
  "timestamp": "2023-01-01T12:00:00Z",
  "tenantId": "tenant-acme-corp",
  "userId": "user-123",
  "action": "TENANT_CREATED",
  "resourceType": "TENANT",
  "resourceId": "tenant-acme-corp",
  "details": {
    "tier": "ENTERPRISE",
    "region": "us-east-1"
  },
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "correlationId": "corr-456"
}
```

## 🚀 Onboarding Process

### Automated Onboarding Steps

1. **Validate Request**: Verify tenant information and prerequisites
2. **Create Encryption**: Generate tenant-specific KMS keys
3. **Create Resources**: Provision S3 buckets, IAM roles, and other AWS resources
4. **Deploy Infrastructure**: Deploy CloudFormation stack with tenant resources
5. **Configure Security**: Set up security policies and access controls
6. **Setup Monitoring**: Configure CloudWatch dashboards and alarms
7. **Create Defaults**: Initialize default configurations and schedules
8. **Generate Credentials**: Create API keys and access credentials
9. **Validate Deployment**: Verify tenant deployment and isolation
10. **Send Welcome**: Send welcome notification with credentials and documentation

### Onboarding Response

```json
{
  "onboardingId": "onboard-123",
  "tenantId": "tenant-acme-corp",
  "status": "COMPLETED",
  "steps": [
    {
      "stepId": "step-1",
      "type": "VALIDATE_REQUEST",
      "description": "Validating tenant request and prerequisites",
      "status": "COMPLETED",
      "startedAt": "2023-01-01T12:00:00Z",
      "completedAt": "2023-01-01T12:00:05Z",
      "duration": 5000
    }
  ],
  "resources": {
    "cloudFormationStackId": "stack-456",
    "kmsKeyId": "key-789",
    "s3BucketName": "compliance-shepherd-acme-corp",
    "iamRoleArn": "arn:aws:iam::123456789012:role/ComplianceShepherd-acme-corp"
  },
  "credentials": {
    "apiKeyId": "ak_1234567890abcdef",
    "apiKeySecret": "sk_abcdef1234567890",
    "accessKeyId": "AKIA1234567890ABCDEF",
    "secretAccessKey": "abcdef1234567890...",
    "expiresAt": "2024-01-01T12:00:00Z"
  },
  "endpoints": {
    "apiGatewayUrl": "https://api.compliance-shepherd.com/tenants/tenant-acme-corp",
    "chatInterfaceUrl": "https://chat.compliance-shepherd.com/tenant-acme-corp",
    "reportsUrl": "https://reports.compliance-shepherd.com/tenant-acme-corp"
  },
  "startedAt": "2023-01-01T12:00:00Z",
  "completedAt": "2023-01-01T12:05:00Z",
  "duration": 300000
}
```

## 🧪 Testing

### Unit Tests

Run unit tests:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

### Integration Tests

Test with real AWS services (requires AWS credentials):

```bash
npm run test:integration
```

### Isolation Validation Tests

Test tenant isolation:

```bash
npm run test:isolation
```

## 🚀 Deployment

### Prerequisites

1. AWS CLI configured with appropriate permissions
2. Node.js 18+ installed
3. Terraform or CDK for infrastructure deployment

### Deploy Service

```bash
# Build the service
npm run build

# Deploy using AWS CLI
aws lambda create-function \
  --function-name tenant-management \
  --runtime nodejs18.x \
  --role arn:aws:iam::123456789012:role/TenantManagementRole \
  --handler index.handler \
  --zip-file fileb://dist/tenant-management.zip
```

### Deploy Infrastructure

```bash
# Deploy tenant infrastructure
npm run deploy
```

## 🔧 Troubleshooting

### Common Issues

#### Tenant Creation Fails
1. Check IAM permissions for KMS, S3, and IAM operations
2. Verify AWS account limits for resources
3. Check CloudFormation stack creation permissions
4. Review tenant name format and uniqueness

#### Isolation Validation Fails
1. Verify KMS key policies and permissions
2. Check S3 bucket policies and encryption
3. Validate IAM role policies and restrictions
4. Review network security group rules

#### Onboarding Process Hangs
1. Check CloudFormation stack status
2. Verify AWS service availability
3. Review IAM role assumption permissions
4. Check resource creation limits

### Debug Mode

Enable debug logging:

```bash
export LOG_LEVEL=DEBUG
```

### Health Checks

Check service health:

```bash
curl https://api.compliance-shepherd.com/tenants/health
```

## 📚 Examples

### Complete Tenant Lifecycle

```javascript
// Create a tenant
const tenant = await fetch('/tenants', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'example-corp',
    organizationId: 'org-123',
    tier: 'STANDARD',
    contactInfo: {
      primaryContact: {
        name: 'John Doe',
        email: 'john@example-corp.com'
      }
    }
  })
});

const { tenantId } = await tenant.json();

// Update tenant configuration
await fetch(`/tenants/${tenantId}/config`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scanSchedule: 'WEEKLY',
    features: {
      automatedRemediation: true,
      customRules: true
    }
  })
});

// Get tenant metrics
const metrics = await fetch(`/tenants/${tenantId}/metrics`);
const metricsData = await metrics.json();

// Validate isolation
const validation = await fetch(`/tenants/${tenantId}/isolation/validate`, {
  method: 'POST'
});
const validationResult = await validation.json();

// Offboard tenant
await fetch(`/tenants/${tenantId}/offboard`, {
  method: 'POST'
});
```

### Tenant Onboarding with Full Configuration

```javascript
const onboardingResult = await fetch('/tenants/onboard', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'enterprise-client',
    displayName: 'Enterprise Client Corp',
    organizationId: 'org-enterprise-123',
    tier: 'ENTERPRISE',
    configuration: {
      complianceFrameworks: ['SOC2', 'HIPAA', 'GDPR'],
      scanSchedule: 'DAILY',
      retentionPeriodDays: 2555, // 7 years
      encryptionEnabled: true,
      auditLoggingEnabled: true,
      crossAccountRoleEnabled: true,
      allowedRegions: ['us-east-1', 'us-west-2', 'eu-west-1'],
      resourceLimits: {
        maxFindings: 100000,
        maxScanJobs: 1000,
        maxUsers: 500,
        maxReports: 10000
      },
      features: {
        automatedRemediation: true,
        realTimeMonitoring: true,
        customRules: true,
        apiAccess: true,
        ssoIntegration: true
      }
    },
    contactInfo: {
      primaryContact: {
        name: 'Jane Smith',
        email: 'jane.smith@enterprise-client.com',
        phone: '+1-555-0199'
      },
      technicalContact: {
        name: 'Bob Johnson',
        email: 'bob.johnson@enterprise-client.com'
      }
    },
    billingInfo: {
      billingEmail: 'billing@enterprise-client.com',
      paymentMethod: 'INVOICE',
      billingAddress: {
        street: '456 Enterprise Blvd',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US'
      }
    }
  })
});

const onboarding = await onboardingResult.json();
console.log('Onboarding completed:', onboarding.status);
console.log('API Key:', onboarding.credentials.apiKeyId);
console.log('Chat Interface:', onboarding.endpoints.chatInterfaceUrl);
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
