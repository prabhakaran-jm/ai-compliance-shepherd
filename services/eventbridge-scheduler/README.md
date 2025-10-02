# EventBridge Scheduler Service

The EventBridge Scheduler service provides automated scheduling and event-driven compliance operations for the AI Compliance Shepherd platform. It manages scheduled scans, processes AWS service events, and orchestrates compliance workflows based on triggers.

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  EventBridge    │───▶│ EventBridge      │───▶│ Step Functions  │
│  Scheduler      │    │ Event Processor  │    │ Workflows       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Scheduled Scans │    │ AWS Service      │    │ Lambda          │
│ (Cron-based)    │    │ Events           │    │ Functions       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │ Custom Events    │    │ SNS             │
                       │ (Manual/API)     │    │ Notifications   │
                       └──────────────────┘    └─────────────────┘
```

## 🚀 Features

### Automated Scheduling
- **Cron-based Schedules**: Create recurring compliance scans and assessments
- **Flexible Time Windows**: Allow schedules to execute within configurable time windows
- **Multiple Target Types**: Support for Step Functions, Lambda, and SNS targets
- **Timezone Support**: Schedule operations across different timezones

### Event-Driven Processing
- **AWS Service Events**: Automatically respond to S3, IAM, EC2, and other AWS service changes
- **Custom Events**: Process manual triggers and compliance-specific events
- **Real-time Processing**: Immediate response to critical compliance violations
- **Event History**: Track and audit all processed events

### Workflow Orchestration
- **Step Functions Integration**: Trigger complex multi-step compliance workflows
- **Parallel Execution**: Handle multiple events and schedules concurrently
- **Error Handling**: Robust error handling with retries and circuit breakers
- **Metadata Tracking**: Include correlation IDs and execution context

### Compliance Automation
- **Scheduled Scans**: Daily, weekly, or custom interval compliance scans
- **Incident Response**: Automatic response to critical compliance violations
- **Continuous Monitoring**: Ongoing monitoring with configurable intervals
- **Assessment Reports**: Scheduled generation of compliance assessment reports

## 📋 API Endpoints

### Schedule Management

#### Create Schedule
```http
POST /schedules
Content-Type: application/json

{
  "scheduleType": "compliance-scan",
  "tenantId": "my-company",
  "cronExpression": "0 6 * * ? *",
  "timezone": "America/New_York",
  "enabled": true,
  "description": "Daily compliance scan at 6 AM EST",
  "target": {
    "type": "step-functions",
    "stateMachineName": "ComplianceScanWorkflow"
  },
  "parameters": {
    "scanType": "comprehensive",
    "includeRecommendations": true
  },
  "flexibleTimeWindowMinutes": 15
}
```

#### List Schedules
```http
GET /schedules?tenantId=my-company&scheduleType=compliance-scan&status=ENABLED&limit=50
```

#### Get Schedule
```http
GET /schedules/{scheduleId}
```

#### Update Schedule
```http
PUT /schedules/{scheduleId}
Content-Type: application/json

{
  "cronExpression": "0 8 * * ? *",
  "enabled": false,
  "description": "Updated schedule"
}
```

#### Delete Schedule
```http
DELETE /schedules/{scheduleId}
```

### Event Processing

#### Trigger Manual Event
```http
POST /events/trigger
Content-Type: application/json

{
  "eventType": "manual-scan",
  "tenantId": "my-company",
  "parameters": {
    "scanType": "security-focused",
    "priority": "high"
  },
  "triggeredBy": "user@company.com",
  "processImmediately": true
}
```

#### Get Event History
```http
GET /events/history?tenantId=my-company&eventType=scheduled-scan&limit=50
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

# EventBridge Configuration
SCHEDULER_KMS_KEY_ARN=arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012

# Step Functions ARNs
COMPLIANCE_SCAN_WORKFLOW_ARN=arn:aws:states:us-east-1:123456789012:stateMachine:ComplianceScanWorkflow
REMEDIATION_WORKFLOW_ARN=arn:aws:states:us-east-1:123456789012:stateMachine:RemediationWorkflow
COMPLIANCE_ASSESSMENT_WORKFLOW_ARN=arn:aws:states:us-east-1:123456789012:stateMachine:ComplianceAssessmentWorkflow
INCIDENT_RESPONSE_WORKFLOW_ARN=arn:aws:states:us-east-1:123456789012:stateMachine:IncidentResponseWorkflow
AUDIT_PACK_GENERATION_WORKFLOW_ARN=arn:aws:states:us-east-1:123456789012:stateMachine:AuditPackGenerationWorkflow
CONTINUOUS_MONITORING_WORKFLOW_ARN=arn:aws:states:us-east-1:123456789012:stateMachine:ContinuousMonitoringWorkflow

# Lambda Function Names
SCAN_ENVIRONMENT_FUNCTION=scan-environment
FINDINGS_STORAGE_FUNCTION=findings-storage
APPLY_FIX_FUNCTION=apply-fix

# SNS Topics
COMPLIANCE_NOTIFICATIONS_TOPIC=arn:aws:sns:us-east-1:123456789012:compliance-notifications
SCHEDULE_ALERTS_TOPIC=arn:aws:sns:us-east-1:123456789012:schedule-alerts
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
        "scheduler:CreateSchedule",
        "scheduler:UpdateSchedule",
        "scheduler:DeleteSchedule",
        "scheduler:GetSchedule",
        "scheduler:ListSchedules",
        "scheduler:CreateScheduleGroup",
        "scheduler:ListScheduleGroups"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "events:PutEvents",
        "events:PutRule",
        "events:PutTargets",
        "events:ListRules",
        "events:DescribeRule"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "states:StartExecution",
        "states:DescribeExecution",
        "states:ListExecutions"
      ],
      "Resource": "arn:aws:states:*:*:stateMachine:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": "arn:aws:lambda:*:*:function:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "sns:Publish"
      ],
      "Resource": "arn:aws:sns:*:*:*"
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

## 📅 Schedule Types and Examples

### Daily Compliance Scan
```json
{
  "scheduleType": "daily-compliance-scan",
  "cronExpression": "0 6 * * ? *",
  "target": {
    "type": "step-functions",
    "stateMachineName": "ComplianceScanWorkflow"
  },
  "parameters": {
    "scanType": "comprehensive",
    "includeRecommendations": true
  }
}
```

### Weekly Assessment Report
```json
{
  "scheduleType": "weekly-assessment",
  "cronExpression": "0 8 ? * MON *",
  "target": {
    "type": "step-functions",
    "stateMachineName": "ComplianceAssessmentWorkflow"
  },
  "parameters": {
    "framework": "SOC2",
    "generateReport": true
  }
}
```

### Continuous Monitoring
```json
{
  "scheduleType": "continuous-monitoring",
  "cronExpression": "0 */4 * * ? *",
  "target": {
    "type": "step-functions",
    "stateMachineName": "ContinuousMonitoringWorkflow"
  },
  "parameters": {
    "monitoringType": "incremental",
    "alertOnCritical": true
  }
}
```

### Monthly Audit Pack Generation
```json
{
  "scheduleType": "monthly-audit-pack",
  "cronExpression": "0 9 1 * ? *",
  "target": {
    "type": "step-functions",
    "stateMachineName": "AuditPackGenerationWorkflow"
  },
  "parameters": {
    "includeEvidence": true,
    "format": "comprehensive"
  }
}
```

## 🎯 Event Types and Triggers

### AWS Service Events

#### S3 Events
- **S3 Bucket Created**: Triggers compliance check for new buckets
- **S3 Bucket Policy Changed**: Validates policy changes against compliance rules
- **S3 Bucket Encryption Changed**: Ensures encryption compliance

#### IAM Events
- **IAM User Created**: Validates user permissions and MFA requirements
- **IAM Role Created**: Checks role permissions and trust policies
- **IAM Policy Changed**: Analyzes policy changes for compliance impact

#### EC2 Events
- **EC2 Instance State-change**: Validates security groups for new instances
- **Security Group Rule Changed**: Checks rule changes against compliance policies
- **VPC Created**: Validates VPC configuration and security settings

### Custom Compliance Events

#### Manual Operations
- **manual-scan**: User-initiated compliance scan
- **manual-remediation**: User-initiated remediation workflow
- **manual-assessment**: User-initiated compliance assessment

#### System Events
- **compliance-violation-detected**: Automatic response to violations
- **remediation-completed**: Post-remediation validation
- **assessment-completed**: Assessment workflow completion

## 🔄 Workflow Integration

### Step Functions Workflows

The service integrates with the following Step Functions workflows:

1. **ComplianceScanWorkflow**
   - Comprehensive environment scanning
   - Resource discovery and analysis
   - Finding generation and storage

2. **RemediationWorkflow**
   - Automated fix application
   - Safety checks and approvals
   - Rollback capabilities

3. **ComplianceAssessmentWorkflow**
   - Framework-specific assessments
   - Gap analysis and recommendations
   - Report generation

4. **IncidentResponseWorkflow**
   - Critical violation handling
   - Escalation procedures
   - Automated containment

5. **AuditPackGenerationWorkflow**
   - Evidence collection
   - Compliance documentation
   - Audit trail generation

6. **ContinuousMonitoringWorkflow**
   - Ongoing compliance monitoring
   - Drift detection
   - Automated alerting

### Workflow Input Format

All workflows receive standardized input:

```json
{
  "tenantId": "my-company",
  "workflowType": "compliance-scan",
  "parameters": {
    "scanType": "comprehensive",
    "includeRecommendations": true
  },
  "metadata": {
    "scheduledExecution": true,
    "eventTriggered": false,
    "scheduleId": "daily-scan-123",
    "triggeredAt": "2023-01-01T06:00:00Z",
    "correlationId": "corr-123456"
  }
}
```

## 📊 Monitoring and Alerting

### CloudWatch Metrics

The service publishes the following metrics:

- **SchedulesCreated**: Number of schedules created
- **SchedulesExecuted**: Number of successful schedule executions
- **SchedulesFailed**: Number of failed schedule executions
- **EventsProcessed**: Number of events processed
- **EventsProcessingFailed**: Number of event processing failures
- **WorkflowsTriggered**: Number of workflows triggered
- **NotificationsSent**: Number of notifications sent

### Logging

Structured JSON logging includes:

```json
{
  "timestamp": "2023-01-01T06:00:00Z",
  "level": "INFO",
  "message": "Schedule executed successfully",
  "service": "eventbridge-scheduler",
  "version": "1.0.0",
  "context": {
    "correlationId": "corr-123456",
    "scheduleId": "daily-scan-123",
    "scheduleName": "DailyComplianceScan",
    "tenantId": "my-company",
    "executionArn": "arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:exec-123",
    "action": "SCHEDULE_EXECUTED"
  }
}
```

### Alerts

Automatic alerts are generated for:

- **Schedule Execution Failures**: When scheduled operations fail
- **High Error Rates**: When event processing error rate exceeds threshold
- **Workflow Failures**: When triggered workflows fail
- **Critical Violations**: When critical compliance violations are detected

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

### Load Testing

Test schedule and event processing performance:

```bash
npm run test:load
```

## 🚀 Deployment

### Prerequisites

1. AWS CLI configured with appropriate permissions
2. Node.js 18+ installed
3. EventBridge Scheduler service available in your region

### Deploy Infrastructure

```bash
# Set environment variables
export AWS_ACCOUNT_ID=123456789012
export AWS_REGION=us-east-1

# Deploy EventBridge resources
npm run deploy
```

### Deploy Lambda Function

```bash
# Build the service
npm run build

# Deploy using AWS CLI or CDK
aws lambda create-function \
  --function-name eventbridge-scheduler \
  --runtime nodejs18.x \
  --role arn:aws:iam::123456789012:role/EventBridgeSchedulerRole \
  --handler index.handler \
  --zip-file fileb://dist/eventbridge-scheduler.zip
```

### Create Default Schedules

```bash
# Create default compliance schedules
curl -X POST https://api.compliance-shepherd.com/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "scheduleType": "daily-compliance-scan",
    "tenantId": "default",
    "cronExpression": "0 6 * * ? *",
    "enabled": true,
    "target": {
      "type": "step-functions",
      "stateMachineName": "ComplianceScanWorkflow"
    }
  }'
```

## 🔧 Troubleshooting

### Common Issues

#### Schedule Not Executing
1. Check schedule is enabled: `GET /schedules/{scheduleId}`
2. Verify IAM permissions for EventBridge Scheduler
3. Check target resource exists and is accessible
4. Review CloudWatch logs for execution errors

#### Event Processing Failures
1. Check EventBridge rule configuration
2. Verify Lambda function permissions
3. Review event pattern matching
4. Check Step Functions execution history

#### Workflow Trigger Failures
1. Verify Step Functions state machine exists
2. Check IAM permissions for cross-service calls
3. Review workflow input format
4. Check Step Functions execution limits

### Debug Mode

Enable debug logging:

```bash
export LOG_LEVEL=DEBUG
```

### Health Checks

Check service health:

```bash
curl https://api.compliance-shepherd.com/health
```

## 📚 Examples

### Complete Schedule Lifecycle

```javascript
// Create a schedule
const schedule = await fetch('/schedules', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scheduleType: 'compliance-scan',
    tenantId: 'my-company',
    cronExpression: '0 6 * * ? *',
    enabled: true,
    target: {
      type: 'step-functions',
      stateMachineName: 'ComplianceScanWorkflow'
    }
  })
});

const { scheduleId } = await schedule.json();

// Update the schedule
await fetch(`/schedules/${scheduleId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cronExpression: '0 8 * * ? *',
    description: 'Updated to 8 AM'
  })
});

// Get schedule details
const details = await fetch(`/schedules/${scheduleId}`);
const scheduleData = await details.json();

// Delete the schedule
await fetch(`/schedules/${scheduleId}`, {
  method: 'DELETE'
});
```

### Event Processing Example

```javascript
// Trigger a manual event
const event = await fetch('/events/trigger', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventType: 'manual-scan',
    tenantId: 'my-company',
    parameters: {
      scanType: 'security-focused',
      regions: ['us-east-1', 'us-west-2']
    },
    processImmediately: true
  })
});

const { eventId } = await event.json();

// Check event history
const history = await fetch('/events/history?tenantId=my-company&limit=10');
const events = await history.json();
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
