# AI Compliance Shepherd - API Reference

Complete API documentation for the AI Compliance Shepherd platform, including authentication, endpoints, data models, and code examples.

## 📋 Table of Contents

- [API Overview](#api-overview)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
- [Data Models](#data-models)
- [SDKs and Examples](#sdks-and-examples)

## 🌐 API Overview

### Base URLs

| Environment | URL | Description |
|-------------|-----|-------------|
| **Production** | `https://api.ai-compliance-shepherd.com/v1` | Live production API |
| **Staging** | `https://api-staging.ai-compliance-shepherd.com/v1` | Testing environment |
| **Development** | `https://api-dev.ai-compliance-shepherd.com/v1` | Development environment |

### API Versioning

- **Current Version**: v1
- **Version Header**: `Accept: application/vnd.ai-compliance-shepherd.v1+json`
- **Deprecation Policy**: 6-month notice for breaking changes

### Content Types

- **Request**: `Content-Type: application/json`
- **Response**: `Content-Type: application/json; charset=utf-8`

---

## 🔐 Authentication

### Authentication Methods

#### 2. JWT Token Authentication
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 2. API Key Authentication
```http
X-API-Key: ak_live_1234567890abcdef
```

#### 3. Session Cookie (Web UI)
```http
Cookie: session_token=abc123def456...
```

### Getting Access Credentials

#### JWT Token (User Authentication)
1. POST `/auth/login` with credentials
2. Receive JWT token in response
3. Include token in subsequent requests

#### API Key (Service Authentication)
1. Generate API key in platform settings
2. Copy the generated key (store securely)
3. Include key in `X-API-Key` header

#### Session Cookie (Web Authentication)
1. Authenticate via web login
2. Browser automatically includes session cookie
3. CSRF tokens handled automatically

---

## 🚦 Rate Limiting

### Rate Limits

| Endpoint Type | Limit | Window | Burst |
|---------------|-------|--------|-------|
| **Authentication** | 100 requests | 15 minutes | 20 |
| **Scans** | 10 requests | 1 hour | 3 |
| **Reports** | 25 requests | 1 hour | 10 |
| **General API** | 1000 requests | 15 minutes | 100 |
| **AI Chat** | 60 requests | 1 hour | 20 |

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
X-RateLimit-Retry-After: 60
```

### Handling Rate Limits

```javascript
// Check rate limit headers
const limit = response.headers['x-ratelimit-remaining'];
if (limit <= 0) {
  const retryAfter = response.headers['x-ratelimit-retry-after'];
  await delay(retryAfter * 1000);
}
```

---

## ❌ Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "field": "region",
      "reason": "Invalid region code"
    },
    "request_id": "req_123456789",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### HTTP Status Codes

| Code | Description | Meaning |
|------|-------------|---------|
| **200** | OK | Request successful |
| **201** | Created | Resource created successfully |
| **202** | Accepted | Request accepted for processing |
| **400** | Bad Request | Invalid request format or parameters |
| **401** | Unauthorized | Authentication required |
| **403** | Forbidden | Insufficient permissions |
| **404** | Not Found | Resource not found |
| **409** | Conflict | Resource already exists |
| **422** | Validation Error | Request validation failed |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Error | Server-side error |
| **502** | Bad Gateway | Upstream service error |
| **503** | Service Unavailable | Service temporarily unavailable |

### Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `INVALID_TOKEN` | JWT token is invalid or expired | Refresh or re-authenticate |
| `MISSING_PERMISSIONS` | Insufficient permissions for action | Check user role and permissions |
| `RESOURCE_NOT_FOUND` | Requested resource doesn't exist | Verify resource ID and existence |
| `VALIDATION_ERROR` | Request validation failed | Check request format and parameters |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Implement exponential backoff |
| `SERVICE_UNAVAILABLE` | Service temporarily down | Retry with backoff |

---

## 🛠️ Endpoints

### Authentication Endpoints

#### POST `/auth/login`
Authenticate user and receive JWT token.

**Request:**
```json
{
  "email": "user@company.com",
  "password": "userpassword123"
}
```

**Response:**
```json
{
  "auth": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600,
    "token_type": "Bearer"
  },
  "user": {
    "id": "user_123456",
    "email": "user@company.com",
    "name": "John Doe",
    "role": "manager",
    "tenant_id": "tenant_456"
  }
}
```

#### POST `/auth/logout`
Invalidate current session.

**Request:** (JWT token required)

**Response:**
```json
{
  "message": "Successfully logged out"
}
```

#### GET `/auth/me`
Get current user information.

**Response:**
```json
{
  "user": {
    "id": "user_123456",
    "email": "user@company.com",
    "name": "John Doe",
    "role": "manager",
    "permissions": [
      "scan:create",
      "scan:read",
      "findings:read",
      "findings:update",
      "reports:generate"
    ],
    "tenant": {
      "id": "tenant_456",
      "name": "ACME Corporation",
      "tier": "PREMIUM"
    }
  }
}
```

### Scan Management Endpoints

#### POST `/scans`
Create a new compliance scan.

**Request:**
```json
{
  "scan_type": "FULL_COMPLIANCE",
  "config": {
    "regions": ["us-east-1", "us-west-2"],
    "services": ["s3", "iam", "ec2", "cloudtrail"],
    "rules": ["all"],
    "include_compliant": false
  },
  "schedule": {
    "immediate": true,
    "repeat": "once"
  }
}
```

**Response:**
```json
{
  "scan": {
    "id": "scan_123456789",
    "tenant_id": "tenant_456",
    "type": "FULL_COMPLIANCE",
    "status": "IN_PROGRESS",
    "created_at": "2024-01-01T12:00:00Z",
    "config": {
      "regions": ["us-east-1", "us-west-2"],
      "services": ["s3", "iam", "ec2", "cloudtrail"]
    }
  }
}
```

#### GET `/scans`
List scans with filtering and pagination.

**Query Parameters:**
- `status` - Filter by scan status
- `scan_type` - Filter by scan type
- `created_after` - ISO 8601 timestamp
- `created_before` - ISO 8601 timestamp
- `limit` - Number of results (max 100)
- `offset` - Pagination offset

**Example:**
```http
GET /scans?status=completed&limit=20&offset=0
```

**Response:**
```json
{
  "scans": [
    {
      "id": "scan_123456789",
      "status": "COMPLETED",
      "scan_type": "FULL_COMPLIANCE",
      "results": {
        "total_resources": 1250,
        "total_findings": 45,
        "critical_findings": 3,
        "high_findings": 12,
        "medium_findings": 20,
        "low_findings": 10
      },
      "created_at": "2024-01-01T12:00:00Z",
      "completed_at": "2024-01-01T12:15:30Z"
    }
  ],
  "pagination": {
    "total": 156,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

#### GET `/scans/{scan_id}`
Get detailed scan information.

**Response:**
```json
{
  "scan": {
    "id": "scan_123456789",
    "tenant_id": "tenant_456",
    "type": "FULL_COMPLIANCE",
    "status": "COMPLETED",
    "progress": 100,
    "config": {
      "regions": ["us-east-1", "us-west-2"],
      "services": ["s3", "iam", "ec2", "cloudtrail"],
      "rules": ["all"]
    },
    "results": {
      "total_resources": 1250,
      "total_findings": 45,
      "critical_findings": 3,
      "high_findings": 12,
      "medium_findings": 20,
      "low_findings": 10,
      "compliance_score": 78.7
    },
    "created_at": "2024-01-01T12:00:00Z",
    "started_at": "2024-01-01T12:00:30Z",
    "completed_at": "2024-01-01T12:15:30Z"
  }
}
```

#### DELETE `/scans/{scan_id}`
Cancel an in-progress scan.

**Response:**
```json
{
  "message": "Scan cancelled successfully"
}
```

### Findings Endpoints

#### GET `/findings`
List compliance findings with filtering.

**Query Parameters:**
- `severity` - Filter by severity (critical,high,medium,low)
- `status` - Filter by status (open,resolved,acknowledged)
- `resource_type` - Filter by AWS resource type
- `region` - Filter by AWS region
- `scan_id` - Filter by scan ID
- `created_after` - ISO 8601 timestamp
- `limit` - Number of results (max 100)
- `offset` - Pagination offset

**Example:**
```http
GET /findings?severity=critical,high&status=open&limit=50
```

**Response:**
```json
{
  "findings": [
    {
      "id": "finding_123456789",
      "scan_id": "scan_123456789",
      "resource_id": "bucket-public-data",
      "resource_type": "s3",
      "region": "us-east-1",
      "severity": "critical",
      "status": "open",
      "rule_id": "S3_BUCKET_PUBLIC_READ_PROHIBITED",
      "title": "S3 Bucket Allows Public Read Access",
      "description": "S3 bucket configuration allows public read access to objects",
      "remediation": "Remove public read permissions from bucket policy",
      "evidence": {
        "bucket_name": "bucket-public-data",
        "public_read_acl": true,
        "bucket_policy": "..."
      },
      "created_at": "2024-01-01T12:00:00Z",
      "updated_at": "2024-01-01T12:00:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 50,
    "offset": 0,
    "has_more": false
  }
}
```

#### GET `/findings/{finding_id}`
Get detailed finding information.

**Response:**
```json
{
  "finding": {
    "id": "finding_123456789",
    "scan_id": "scan_123456789",
    "tenant_id": "tenant_456",
    "resource_id": "bucket-public-data",
    "resource_type": "s3",
    "region": "us-east-1",
    "severity": "critical",
    "status": "open",
    "rule": {
      "id": "S3_BUCKET_PUBLIC_READ_PROHIBITED",
      "name": "S3 Bucket Public Read Prohibited",
      "category": "Public Access",
      "automated_remediation": true
    },
    "title": "S3 Bucket Allows Public Read Access",
    "description": "S3 bucket configuration allows public read access to objects",
    "remediation": "Remove public read permissions from bucket policy",
    "evidence": {
      "bucket_name": "bucket-public-data",
      "public_read_acl": true,
      "bucket_policy": "...",
      "discovered_at": "2024-01-01T12:00:00Z"
    },
    "tags": {
      "Environment": "production",
      "Team": "security"
    },
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z"
  }
}
```

#### PATCH `/findings/{finding_id}`
Update finding status or acknowledgment.

**Request:**
```json
{
  "status": "acknowledged",
  "acknowledgment": {
    "reason": "Acceptable risk for internal development bucket",
    "approved_by": "security-manager@company.com"
  }
}
```

**Response:**
```json
{
  "finding": {
    "id": "finding_123456789",
    "status": "acknowledged",
    "updated_at": "2024-01-01T13:00:00Z"
  }
}
```

---

## 📊 Data Models

### Tenant

```typescript
interface Tenant {
  id: string;
  name: string;
  tier: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  settings: {
    scan_regions: string[];
    enabled_services: string[];
    notification_settings: NotificationSettings;
    ai_chat_enabled: boolean;
  };
  created_at: string;
  updated_at: string;
}
```

### Scan Job

```typescript
interface ScanJob {
  id: string;
  tenant_id: string;
  type: 'FULL_COMPLIANCE' | 'TARGETED_SCAN' | 'CONTINUOUS_SCAN';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number; // 0-100
  config: {
    regions: string[];
    services: string[];
    rules: string[];
    include_compliant: boolean;
  };
  results: {
    total_resources: number;
    total_findings: number;
    critical_findings: number;
    high_findings: number;
    medium_findings: number;
    low_findings: number;
    compliance_score: number;
  };
  created_at: string;
  started_at?: string;
  completed_at?: string;
}
```

### Finding

```typescript
interface Finding {
  id: string;
  tenant_id: string;
  scan_id: string;
  resource_id: string;
  resource_type: string;
  region: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ACKNOWLEDGED';
  rule: {
    id: string;
    name: string;
    category: string;
    automated_remediation: boolean;
  };
  title: string;
  description: string;
  remediation: string;
  evidence: Record<string, any>;
  tags: Record<string, string>;
  created_at: string;
  updated_at: string;
}
```

### User Session

```typescript
interface UserSession {
  id: string;
  user_id: string;
  tenant_id: string;
  token: string;
  expires_at: string;
  permissions: string[];
  metadata: {
    ip_address: string;
    user_agent: string;
    created_at: string;
  };
}
```

---

## 💻 SDKs and Examples

### JavaScript/Node.js SDK

#### Installation
```bash
npm install ai-compliance-shepherd-sdk
```

#### Basic Usage
```javascript
const ComplianceAPI = require('ai-compliance-shepherd-sdk');

const client = new ComplianceAPI({
  apiKey: 'ak_live_1234567890abcdef',
  environment: 'production'
});

// List findings
const findings = await client.findings.list({
  severity: ['critical', 'high'],
  status: 'open'
});

// Start a scan
const scan = await client.scans.create({
  scan_type: 'FULL_COMPLIANCE',
  config: {
    regions: ['us-east-1'],
    services: ['s3', 'iam']
  }
});
```

### Python SDK

```python
from ai_compliance_shepherd import ComplianceAPI

client = ComplianceAPI(
    api_key='ak_live_1234567890abcdef',
    environment='production'
)

# List findings
findings = client.findings.list(
    severity=['critical', 'high'],
    status='open'
)

# Start a scan
scan = client.scans.create({
    'scan_type': 'FULL_COMPLIANCE',
    'config': {
        'regions': ['us-east-1'],
        'services': ['s3', 'iam']
    }
})
```

### cURL Examples

#### Start a Compliance Scan
```bash
curl -X POST \
  https://api.ai-compliance-shepherd.com/v1/scans \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scan_type": "FULL_COMPLIANCE",
    "config": {
      "regions": ["us-east-1", "us-west-2"],
      "services": ["s3", "iam", "ec2"]
    }
  }'
```

#### Get Findings
```bash
curl -X GET \
  "https://api.ai-compliance-shepherd.com/v1/findings?severity=critical&status=open" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Generate Audit Report
```bash
curl -X POST \
  https://api.ai-compliance-shepherd.com/v1/reports/generate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "report_type": "AUDIT_PACK",
    "framework": "SOC2",
    "date_range": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    }
  }'
```

---

## 🔍 Testing and Validation

### API Testing Tools

#### Postman Collection
```bash
# Import collection
curl -o postman-collection.json \
  https://api.ai-compliance-shepherd.com/v1/docs/postman-collection
```

#### OpenAPI Specification
```bash
# Download OpenAPI spec
curl -o openapi.json \
  https://api.ai-compliance-shepherd.com/v1/openapi.json
```

### Response Time Expectations

| Endpoint Type | Expected Response Time | SLA |
|---------------|----------------------|-----|
| **Authentication** | <200ms | 95% under 500ms |
| **Simple Queries** | <300ms | 95% under 1000ms |
| **Complex Reports** | <5s | 95% under 10s |
| **Scan Creation** | <1s | 95% under 2s |
| **AI Chat** | <3s | 95% under 5s |

---

**API Documentation Complete** 📚

For additional examples, troubleshooting, and support resources, visit our [developer portal](https://developers.ai-compliance-shepherd.com) or contact our API support team.
