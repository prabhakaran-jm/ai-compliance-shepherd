# AWS Marketplace Integration for AI Compliance Shepherd

This module provides AWS Marketplace SaaS integration capabilities for the AI Compliance Shepherd platform, enabling commercial distribution through AWS Marketplace with subscription management, usage metering, and customer onboarding.

## 📋 Overview

The AWS Marketplace integration enables:
- **Subscription Management**: Handle customer subscriptions and lifecycle events
- **Usage Metering**: Track and submit usage data to AWS Marketplace for billing
- **Entitlement Management**: Control feature access based on subscription tiers
- **Customer Onboarding**: Automatic tenant provisioning for marketplace customers
- **Webhook Processing**: Handle AWS Marketplace notifications and events

## 🏗️ Architecture

### Services

| Service | Purpose | Key Features |
|---------|---------|--------------|
| **MarketplaceSubscriptionService** | Customer subscription lifecycle | Create, update, cancel subscriptions |
| **MarketplaceMeteringService** | Usage tracking and billing | Track usage metrics, submit billing data |
| **MarketplaceEntitlementService** | Feature access control | Tier-based feature access, quota management |
| **MarketplaceWebhookService** | AWS Marketplace events | Process subscription/entitlement notifications |

### AWS Marketplace Dimensions

| Dimension | Description | Use Case |
|-----------|-------------|----------|
| **scans** | Compliance scans executed | Per-scan billing |
| **users** | Active platform users | Per-user pricing |
| **findings** | Compliance issues found | Per-finding processing |
| **storage-gb** | Data storage used | Storage-based billing |
| **api-calls** | API requests made | Usage-based billing |
| **ai-sessions** | AI chat interactions | AI usage billing |

## 📦 Subscription Plans

### BASIC ($99/month)
- 100 scans/month
- 5 users
- 10GB storage
- Basic compliance reports
- Email support

### STANDARD ($299/month)
- 500 scans/month
- 25 users
- 50GB storage
- AI chat assistant
- Advanced reports
- Slack/Email notifications

### PREMUIM ($799/month)
- 2,000 scans/month
- 100 users
- 200GB storage
- Continuous scanning
- AI automation
- All integrations

### ENTERPRISE (Custom pricing)
- Unlimited scans
- Unlimited users
- Unlimited storage
- Enterprise AI
- Custom integrations
- Dedicated support

## 🔧 Configuration

### Environment Variables

```bash
# AWS Marketplace Configuration
MARKETPLACE_PRODUCT_CODE=ai-compliance-shepherd
MARKETPLACE_SECRET_TOKEN=your-secret-token

# DynamoDB Tables
CUSTOMER_TABLE=ai-compliance-customers
SUBSCRIPTION_TABLE=ai-compliance-subscriptions
USAGE_TABLE=ai-compliance-usage

# AWS Configuration
AWS_REGION=us-east-1
WEBHOOK_ENDPOINT=/marketplace/webhook

# Optional
SERVICE_VERSION=1.0.0
LOG_LEVEL=INFO
```

### MarketplaceConfig Interface

```typescript
interface MarketplaceConfig {
  productCode: string;           // AWS Marketplace product code
  customerTable: string;         // DynamoDB customer table
  subscriptionTable: string;     // DynamoDB subscription table
  usageTable: string;            // DynamoDB usage tracking table
  webhookEndpoint: string;       // Webhook endpoint path
  secretToken: string;          // Secret for webhook verification
  awsRegion: string;            // AWS region for services
  dimensions: {
    scans: string;
    users: string;
    findings: string;
    storage: string;
    apis: string;
    aiSessions: string;
  };
  plans: MarketplaceSubscriptionPlan[];
}
```

## 📊 Usage Tracking

### Dimension Mapping

Platform usage is automatically tracked and converted to AWS Marketplace dimensions:

```
Platform Metrics → Marketplace Dimensions
├── totalScans → scans
├── totalUsers → users  
├── totalFindings → findings
├── storageUsedGB → storage-gb
├── apiCalls → api-calls
└── aiChatSessions → ai-sessions
```

### Usage Submission

Usage data is automatically submitted to AWS Marketplace:

```typescript
// Track usage for subscription
await meteringService.trackUsage(subscriptionId, {
  totalScans: 50,
  totalUsers: 10,
  totalFindings: 125,
  storageUsedGB: 25,
  apiCalls: 1000,
  aiChatSessions: 25
});
```

## 🔗 API Endpoints

### Webhook Endpoint
```
POST /marketplace/webhook
```
- **Purpose**: Receives AWS Marketplace notifications
- **Handles**: Subscription events, entitlement changes, usage reports
- **Security**: Signature verification required

### Subscription Management
```
GET    /marketplace/subscriptions/{id}     # Get subscription
POST   /marketplace/subscriptions          # Create subscription
PUT    /marketplace/subscriptions/{id}     # Update subscription
DELETE /marketplace/subscriptions/{id}     # Cancel subscription
```

### Usage Metering
```
GET  /marketplace/subscriptions/{id}/usage  # Get usage metrics
POST /marketplace/subscriptions/{id}/meter # Submit usage data
```

## 🎯 Marketplace Onboarding Flow

### 1. Customer Subscribe
```
AWS Marketplace → Webhook → Create Subscription → Provision Tenant
```

### 2. Entitlement Activation
```
Marketplace Event → Check Plans → Enable Features → Set Quotas
```

### 3. Usage Tracking
```
Platform Activity → Track Metrics → Submit to Marketplace → Billing
```

## 🔒 Security

### Webhook Verification
- Signature validation using HMAC
- Timestamp validation (prevent replay attacks)
- Secret token verification

### Data Protection
- All customer data encrypted at rest
- Secure transmission (HTTPS/TLS)
- Tenant data isolation
- Audit logging for all operations

### Access Control
- Role-based access to marketplace data
- Least privilege principles
- Regular permission reviews

## 📈 Monitoring

### Key Metrics
- Subscription creation/updates/cancellations
- Usage submission success rates
- Webhook processing performance
- Customer onboarding time
- Revenue tracking

### CloudWatch Alarms
- Failed webhook processing
- Usage submission failures
- Subscription creation errors
- High customer onboarding time

## 🔧 Development

### Setup
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Deploy to AWS
npm run deploy
```

### Testing
```bash
# Unit tests
npm run test

# Integration tests with localstack
npm run test:integration

# Marketplace webhook testing
npm run test:webhooks
```

## 📞 Support

### Documentation
- [AWS Marketplace SaaS Integration Guide](https://docs.aws.amazon.com/marketplace/latest/userguide/integration.html)
- [Platform User Manual](../docs/user-manual.md)
- [Administrator Guide](../docs/administrator-guide.md)

### Troubleshooting
- Webhook signature verification issues
- Usage submission failures
- Subscription status inconsistencies
- Customer onboarding errors

---

**AWS Marketplace Integration Ready!** 🚀

This integration enables commercial distribution of AI Compliance Shepherd through AWS Marketplace with complete subscription management, usage metering, and customer onboarding capabilities.
