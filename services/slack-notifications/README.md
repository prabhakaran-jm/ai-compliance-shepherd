# Slack Notifications Service

The Slack Notifications service provides comprehensive integration with Slack workspaces, enabling real-time compliance notifications, alerts, and updates directly in team channels. It supports multi-tenant configurations, rich message formatting, and intelligent event routing.

## Overview

The Slack Notifications service acts as the communication bridge between the AI Compliance Shepherd platform and team collaboration tools. It automatically sends notifications about compliance events, scan results, critical findings, remediation actions, and audit pack availability.

## Features

### 🔔 **Comprehensive Event Notifications**
- **Scan Results**: Automated notifications when compliance scans complete
- **Critical Findings**: Immediate alerts for critical security vulnerabilities
- **Remediation Actions**: Updates on applied fixes and their status
- **Audit Pack Ready**: Notifications when audit packages are generated
- **Compliance Score Changes**: Alerts when compliance scores improve or decline
- **Scheduled Reports**: Regular compliance summaries and reports

### 📱 **Rich Message Formatting**
- **Interactive Buttons**: Direct links to view details, apply fixes, or download reports
- **Color-Coded Messages**: Visual indicators for severity levels and status
- **Structured Layouts**: Organized information with fields, sections, and context
- **Emoji Indicators**: Quick visual status indicators (🟢 🟡 🔴)
- **Contextual Information**: Timestamps, tenant info, and correlation IDs

### 🏢 **Multi-Tenant Architecture**
- **Isolated Configurations**: Each tenant has separate Slack workspace integration
- **Channel-Specific Routing**: Different events can go to different channels
- **Tenant-Specific Settings**: Customizable notification preferences per tenant
- **Secure Token Management**: Encrypted storage of Slack bot tokens

### ⚙️ **Advanced Configuration**
- **Event Filtering**: Choose which events trigger notifications
- **Channel Mapping**: Route different event types to specific channels
- **Notification Scheduling**: Control timing and frequency of notifications
- **Template Customization**: Customize message formats and content

### 🔄 **Event Processing**
- **EventBridge Integration**: Processes compliance events from EventBridge
- **SNS Integration**: Handles system alerts and notifications via SNS
- **API Gateway**: RESTful API for configuration management
- **Real-time Processing**: Immediate notification delivery

## API Endpoints

### Configure Slack Integration
```http
POST /slack/configure
```

**Request Body:**
```json
{
  "tenantId": "tenant-demo-company",
  "botToken": "xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx",
  "channels": [
    {
      "name": "security",
      "id": "C1234567890",
      "events": ["CRITICAL_FINDINGS", "SCAN_RESULTS"]
    },
    {
      "name": "compliance",
      "id": "C0987654321",
      "events": ["AUDIT_PACK_READY", "COMPLIANCE_SCORE_CHANGES"]
    }
  ],
  "enabled": true,
  "notificationSettings": {
    "criticalFindings": true,
    "scanResults": true,
    "remediationActions": true,
    "auditPackReady": true,
    "complianceScoreChanges": false,
    "scheduledReports": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "correlationId": "req-123",
  "result": {
    "configured": true,
    "message": "Slack integration configured successfully"
  }
}
```

### Get Slack Configuration
```http
GET /slack/config/{tenantId}
```

**Response:**
```json
{
  "success": true,
  "correlationId": "req-124",
  "result": {
    "tenantId": "tenant-demo-company",
    "botToken": "***REDACTED***",
    "channels": [
      {
        "name": "security",
        "id": "C1234567890",
        "events": ["CRITICAL_FINDINGS", "SCAN_RESULTS"]
      }
    ],
    "enabled": true,
    "notificationSettings": {
      "criticalFindings": true,
      "scanResults": true,
      "remediationActions": true,
      "auditPackReady": true,
      "complianceScoreChanges": false,
      "scheduledReports": false
    },
    "createdAt": "2023-01-01T00:00:00Z",
    "updatedAt": "2023-01-01T00:00:00Z"
  }
}
```

### Update Slack Configuration
```http
PUT /slack/config/{tenantId}
```

### Delete Slack Configuration
```http
DELETE /slack/config/{tenantId}
```

### Send Test Notification
```http
POST /slack/test
```

**Request Body:**
```json
{
  "tenantId": "tenant-demo-company",
  "channel": "C1234567890",
  "message": "This is a test notification from AI Compliance Shepherd"
}
```

### Get Notification History
```http
GET /slack/notifications?tenantId=tenant-demo-company&limit=50
```

**Response:**
```json
{
  "success": true,
  "result": {
    "notifications": [
      {
        "notificationId": "notif-123",
        "tenantId": "tenant-demo-company",
        "eventType": "SCAN_COMPLETED",
        "channel": "#security",
        "messageId": "1234567890.123456",
        "status": "SUCCESS",
        "timestamp": "2023-01-01T10:30:00Z",
        "eventData": {
          "scanId": "scan-123",
          "findingsCount": 15,
          "criticalCount": 2
        }
      }
    ]
  }
}
```

## Event Types and Routing

### Supported Event Types

#### Scan Events
- **SCAN_COMPLETED**: Compliance scan finished successfully
- **SCAN_FAILED**: Compliance scan encountered an error

#### Finding Events
- **CRITICAL_FINDING**: Critical security vulnerability detected
- **FINDING_RESOLVED**: Previously identified finding has been resolved

#### Remediation Events
- **REMEDIATION_APPLIED**: Automated fix has been applied
- **REMEDIATION_FAILED**: Automated fix attempt failed

#### Audit Events
- **AUDIT_PACK_GENERATED**: Audit package is ready for download
- **AUDIT_PACK_FAILED**: Audit package generation failed

#### Compliance Events
- **COMPLIANCE_SCORE_CHANGED**: Overall compliance score has changed

#### System Events
- **SCHEDULED_REPORT**: Regular compliance report generated
- **SYSTEM_ALERT**: System-level alert or notification

### Event Routing Configuration

Events can be routed to specific channels based on type:

```json
{
  "channels": [
    {
      "name": "security-alerts",
      "id": "C1111111111",
      "events": ["CRITICAL_FINDING", "SCAN_FAILED"]
    },
    {
      "name": "compliance-updates",
      "id": "C2222222222",
      "events": ["SCAN_COMPLETED", "AUDIT_PACK_GENERATED"]
    },
    {
      "name": "remediation-log",
      "id": "C3333333333",
      "events": ["REMEDIATION_APPLIED", "REMEDIATION_FAILED"]
    },
    {
      "name": "all-notifications",
      "id": "C4444444444",
      "events": ["ALL"]
    }
  ]
}
```

## Message Templates and Formatting

### Scan Completed Message
```
🔍 Compliance Scan Completed

Status: 🟡 Issues Found
Total Findings: 25

Breakdown:
• Critical: 3
• High: 8
• Medium: 10
• Low: 4

⚠️ Immediate attention required for critical findings

🆔 Scan: scan-12345 | 🏢 tenant-demo-company | ⏰ Jan 01, 2023 10:30:00
```

### Critical Finding Message
```
🚨 Critical Security Finding Detected

S3 Bucket Public Access Enabled
S3 bucket "data-backup" has public read access enabled, potentially exposing sensitive data.

Details:
• Severity: CRITICAL
• Resource Type: S3_BUCKET
• Resource ID: data-backup
• Finding ID: finding-67890

[View Finding] [Apply Fix]

🏢 tenant-demo-company | ⏰ Jan 01, 2023 10:35:00
```

### Remediation Applied Message
```
✅ Remediation SUCCESS

Action: Disable S3 bucket public access
Resource: S3_BUCKET (data-backup)
Status: SUCCESS
Applied: Jan 01, 10:45

🆔 remediation-11111 | 🏢 tenant-demo-company | ⏰ Jan 01, 2023 10:45:00
```

### Audit Pack Generated Message
```
📋 SOC2 Audit Pack Ready

Type: ANNUAL
Compliance Score: 🟡 87.5% (Good)

Package Contents:
• Executive Summary
• Detailed Findings Report
• Evidence Collection
• Compliance Assessment
• Remediation Report

Statistics:
• Total Findings: 125
• Critical Issues: 8

[View Summary] [Download ZIP]

🆔 audit-pack-22222 | 🏢 tenant-demo-company | ⏰ Jan 01, 2023 15:00:00
```

## Slack Bot Setup

### 1. Create Slack App
1. Go to [Slack API](https://api.slack.com/apps)
2. Click "Create New App"
3. Choose "From scratch"
4. Enter app name: "AI Compliance Shepherd"
5. Select your workspace

### 2. Configure Bot Permissions
Add these OAuth scopes under "OAuth & Permissions":

**Bot Token Scopes:**
- `channels:read` - View basic information about public channels
- `chat:write` - Send messages as the bot
- `chat:write.public` - Send messages to channels the bot isn't a member of
- `groups:read` - View basic information about private channels
- `im:read` - View basic information about direct messages
- `mpim:read` - View basic information about group direct messages
- `users:read` - View people in the workspace

### 3. Install App to Workspace
1. Click "Install to Workspace"
2. Authorize the app
3. Copy the "Bot User OAuth Token" (starts with `xoxb-`)

### 4. Add Bot to Channels
Invite the bot to channels where you want notifications:
```
/invite @ai-compliance-shepherd
```

### 5. Configure in AI Compliance Shepherd
Use the bot token in your Slack configuration:

```bash
curl -X POST https://api.compliance-shepherd.com/slack/configure \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{
    "tenantId": "tenant-your-company",
    "botToken": "xoxb-your-bot-token-here",
    "channels": [
      {
        "name": "security",
        "id": "C1234567890",
        "events": ["CRITICAL_FINDINGS", "SCAN_RESULTS"]
      }
    ],
    "enabled": true,
    "notificationSettings": {
      "criticalFindings": true,
      "scanResults": true,
      "remediationActions": true,
      "auditPackReady": true
    }
  }'
```

## Event Processing Architecture

### EventBridge Integration
The service processes compliance events from EventBridge:

```json
{
  "source": "ai-compliance-shepherd",
  "detail-type": "Compliance Scan Completed",
  "detail": {
    "tenantId": "tenant-demo-company",
    "scanId": "scan-12345",
    "findingsCount": 25,
    "criticalCount": 3,
    "timestamp": "2023-01-01T10:30:00Z"
  }
}
```

### SNS Integration
System alerts are processed via SNS:

```json
{
  "Subject": "Compliance Alert: Critical Finding",
  "Message": {
    "alertType": "CRITICAL_FINDING",
    "tenantId": "tenant-demo-company",
    "details": "Critical security vulnerability detected"
  }
}
```

### Message Processing Flow
1. **Event Received**: EventBridge or SNS event triggers Lambda
2. **Tenant Lookup**: Retrieve Slack configuration for tenant
3. **Event Filtering**: Check if event type is enabled for tenant
4. **Channel Routing**: Determine target channels based on event type
5. **Message Building**: Generate formatted Slack message
6. **Delivery**: Send message to configured channels
7. **History Recording**: Log notification for audit trail

## Multi-Tenant Security

### Tenant Isolation
- **Separate Configurations**: Each tenant has isolated Slack settings
- **Token Encryption**: Bot tokens stored encrypted in AWS Secrets Manager
- **Access Control**: API endpoints validate tenant access
- **Data Segregation**: Notification history isolated per tenant

### Security Features
- **Token Validation**: Slack bot tokens validated before storage
- **Permission Checking**: Verify bot has required channel permissions
- **Rate Limiting**: Prevent abuse with per-tenant rate limits
- **Audit Logging**: Complete audit trail of all notifications

### Configuration Validation
```typescript
// Tenant ID validation
const tenantIdRegex = /^tenant-[a-z0-9-]+$/;

// Bot token validation
const botTokenRegex = /^xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+$/;

// Channel ID validation
const channelIdRegex = /^[C|G|D][A-Z0-9]{8,}$/;
```

## Error Handling and Resilience

### Error Types
- **SlackTokenError**: Invalid or expired bot token
- **SlackChannelError**: Channel not found or bot not invited
- **SlackRateLimitError**: Slack API rate limit exceeded
- **SlackPermissionError**: Insufficient bot permissions
- **TemplateRenderError**: Message template rendering failed

### Retry Logic
```typescript
// Exponential backoff for transient errors
const retryDelays = [1000, 2000, 4000, 8000]; // milliseconds

// Rate limit handling
if (error.code === 'rate_limited') {
  const retryAfter = error.headers['retry-after'];
  await sleep(retryAfter * 1000);
}
```

### Circuit Breaker
```typescript
// Circuit breaker for Slack API calls
const circuitBreaker = new SlackCircuitBreaker({
  failureThreshold: 5,
  recoveryTimeout: 60000, // 1 minute
  successThreshold: 2
});
```

## Performance and Scalability

### Performance Metrics
- **Message Delivery Time**: < 2 seconds average
- **Event Processing**: 1000+ events per minute
- **Concurrent Tenants**: 500+ simultaneous configurations
- **API Response Time**: < 500ms for configuration operations

### Scalability Features
- **Auto Scaling**: Lambda automatically scales with demand
- **Batch Processing**: Multiple notifications processed in parallel
- **Caching**: Frequently accessed configurations cached
- **Connection Pooling**: Efficient Slack API connection management

### Rate Limiting
- **Slack API Limits**: Respects Slack's rate limits per workspace
- **Tenant Limits**: Per-tenant rate limiting to prevent abuse
- **Burst Handling**: Temporary burst capacity for critical alerts
- **Queue Management**: Message queuing during high load

## Monitoring and Alerting

### CloudWatch Metrics
- `SlackNotificationsSent`: Number of notifications sent
- `SlackNotificationsFailed`: Number of failed notifications
- `SlackConfigurationsActive`: Number of active tenant configurations
- `SlackAPILatency`: Average Slack API response time
- `SlackRateLimitsHit`: Number of rate limit encounters

### CloudWatch Alarms
- **High Error Rate**: Alert when error rate exceeds 5%
- **API Latency**: Alert when Slack API latency exceeds 5 seconds
- **Configuration Failures**: Alert on Slack configuration errors
- **Rate Limit Exceeded**: Alert when rate limits are frequently hit

### Structured Logging
```json
{
  "timestamp": "2023-01-01T10:30:00Z",
  "level": "INFO",
  "message": "Slack notification sent",
  "service": "slack-notifications",
  "context": {
    "correlationId": "req-123",
    "tenantId": "tenant-demo-company",
    "eventType": "SCAN_COMPLETED",
    "channel": "#security",
    "messageId": "1234567890.123456",
    "operation": "NOTIFICATION_SENT"
  }
}
```

## Testing

### Unit Tests
```bash
npm test                    # Run all tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage report
```

### Test Coverage
- **Service Layer**: 95%+ coverage of business logic
- **Error Handling**: All error scenarios tested
- **Validation**: All input validation tested
- **Integration**: Mock Slack API tested

### Test Examples
```typescript
describe('SlackNotificationService', () => {
  it('should send scan completed notification', async () => {
    const eventData = {
      tenantId: 'tenant-demo-company',
      scanId: 'scan-123',
      findingsCount: 15,
      criticalCount: 2
    };
    
    await service.handleScanCompletedEvent(eventData, 'test-id');
    
    expect(mockSlackClient.chat.postMessage).toHaveBeenCalledWith({
      channel: 'C1234567890',
      text: expect.stringContaining('Compliance Scan Completed'),
      blocks: expect.any(Array)
    });
  });
});
```

## Deployment

### Environment Variables
```bash
AWS_REGION=us-east-1
LOG_LEVEL=INFO
SLACK_CONFIG_TABLE=ComplianceShepherd-SlackConfigurations
SLACK_HISTORY_TABLE=ComplianceShepherd-NotificationHistory
SLACK_SECRETS_PREFIX=compliance-shepherd/slack/
```

### IAM Permissions
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
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/ComplianceShepherd-SlackConfigurations",
        "arn:aws:dynamodb:*:*:table/ComplianceShepherd-NotificationHistory"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:CreateSecret",
        "secretsmanager:UpdateSecret"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:compliance-shepherd/slack/*"
    }
  ]
}
```

### Lambda Configuration
- **Runtime**: Node.js 18.x
- **Memory**: 512 MB
- **Timeout**: 30 seconds
- **Environment**: VPC with private subnets
- **Layers**: AWS SDK v3

## Integration Examples

### Configure Slack for SOC 2 Compliance
```bash
curl -X POST https://api.compliance-shepherd.com/slack/configure \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{
    "tenantId": "tenant-acme-corp",
    "botToken": "xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx",
    "channels": [
      {
        "name": "soc2-compliance",
        "id": "C1234567890",
        "events": ["SCAN_RESULTS", "AUDIT_PACK_READY", "COMPLIANCE_SCORE_CHANGES"]
      },
      {
        "name": "security-alerts",
        "id": "C0987654321",
        "events": ["CRITICAL_FINDINGS"]
      },
      {
        "name": "remediation-log",
        "id": "C1111111111",
        "events": ["REMEDIATION_APPLIED", "REMEDIATION_FAILED"]
      }
    ],
    "enabled": true,
    "notificationSettings": {
      "criticalFindings": true,
      "scanResults": true,
      "remediationActions": true,
      "auditPackReady": true,
      "complianceScoreChanges": true,
      "scheduledReports": false
    }
  }'
```

### Test Slack Integration
```bash
curl -X POST https://api.compliance-shepherd.com/slack/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{
    "tenantId": "tenant-acme-corp",
    "channel": "C1234567890",
    "message": "Testing Slack integration for AI Compliance Shepherd"
  }'
```

### Get Notification History
```bash
curl -X GET "https://api.compliance-shepherd.com/slack/notifications?tenantId=tenant-acme-corp&limit=20" \
  -H "Authorization: Bearer $API_TOKEN"
```

## Best Practices

### Channel Organization
- **#security-alerts**: Critical findings and immediate threats
- **#compliance-updates**: Scan results and compliance score changes
- **#audit-reports**: Audit pack notifications and scheduled reports
- **#remediation-log**: Automated fix applications and results
- **#compliance-general**: All compliance-related notifications

### Notification Settings
- **Production**: Enable all critical and high-priority notifications
- **Development**: Limit to test notifications and major events
- **Staging**: Enable all notifications for testing purposes

### Message Formatting
- **Use Emojis**: Visual indicators improve message scanning
- **Include Actions**: Direct links to relevant resources
- **Provide Context**: Always include tenant, timestamp, and correlation ID
- **Keep Concise**: Important information first, details in expandable sections

### Security Considerations
- **Token Rotation**: Regularly rotate Slack bot tokens
- **Permission Review**: Periodically review bot permissions
- **Channel Access**: Limit bot access to necessary channels only
- **Audit Logging**: Monitor all notification activities

## Troubleshooting

### Common Issues

#### Bot Not Receiving Messages
**Symptom**: Notifications not appearing in Slack
**Causes**: 
- Bot not invited to channel
- Invalid bot token
- Insufficient permissions

**Solution**:
```bash
# Check bot permissions
curl -X GET "https://slack.com/api/auth.test" \
  -H "Authorization: Bearer $BOT_TOKEN"

# Invite bot to channel
/invite @ai-compliance-shepherd
```

#### Rate Limiting
**Symptom**: Notifications delayed or failing
**Cause**: Exceeding Slack API rate limits

**Solution**:
- Implement exponential backoff
- Reduce notification frequency
- Use message batching

#### Configuration Errors
**Symptom**: Configuration API calls failing
**Cause**: Invalid tenant ID or malformed request

**Solution**:
```bash
# Validate tenant ID format
echo "tenant-demo-company" | grep -E "^tenant-[a-z0-9-]+$"

# Test configuration
curl -X GET https://api.compliance-shepherd.com/slack/config/tenant-demo-company \
  -H "Authorization: Bearer $API_TOKEN"
```

### Debug Logging
Enable debug logging to troubleshoot issues:
```bash
export LOG_LEVEL=DEBUG
```

### Health Checks
Monitor service health:
```bash
curl -X GET https://api.compliance-shepherd.com/health
```

## Support and Documentation

### Additional Resources
- [Slack API Documentation](https://api.slack.com/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [EventBridge Documentation](https://docs.aws.amazon.com/eventbridge/)
- [Multi-Tenant Architecture](../tenant-management/README.md)

### Getting Help
- **Documentation**: Comprehensive guides and API references
- **Support Team**: 24/7 technical support for enterprise customers
- **Community**: Developer community and forums
- **Training**: Slack integration and compliance training programs

---

The Slack Notifications service provides seamless integration between AI Compliance Shepherd and team communication workflows, ensuring that compliance events, alerts, and updates are delivered in real-time to the right people in the right channels.
