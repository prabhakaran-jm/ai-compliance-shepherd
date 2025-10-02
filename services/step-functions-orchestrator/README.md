# Step Functions Orchestrator Service

The Step Functions Orchestrator service provides sophisticated workflow orchestration for complex compliance operations. It manages multi-step processes like comprehensive scans, remediation workflows, incident response, and audit pack generation using AWS Step Functions.

## Overview

This service creates and manages Step Functions state machines that orchestrate complex compliance workflows by coordinating multiple Lambda functions, handling errors, managing approvals, and providing comprehensive monitoring and logging.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Gateway   │───▶│ Step Functions   │───▶│ Lambda Functions│
│   (Triggers)    │    │  Orchestrator    │    │ (Scan/Fix/etc.) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Workflow State  │    │ State Machines   │    │ Notifications   │
│ (DynamoDB)      │    │ (6 Workflows)    │    │ (SNS/Slack)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Features

### 🔄 **Workflow Orchestration**

- **Complex Coordination**: Orchestrates multi-step compliance processes
- **Parallel Execution**: Runs multiple operations concurrently for efficiency
- **Error Handling**: Comprehensive error handling with retries and rollbacks
- **Conditional Logic**: Smart branching based on results and conditions
- **State Management**: Maintains workflow state across long-running operations

### 📋 **Six Pre-built Workflows**

1. **Compliance Scan Workflow**: Comprehensive environment scanning with parallel resource discovery
2. **Remediation Workflow**: Safe remediation with approval workflows and rollback capabilities
3. **Compliance Assessment Workflow**: Full compliance assessment with gap analysis and recommendations
4. **Incident Response Workflow**: Automated incident response with severity-based actions
5. **Audit Pack Generation Workflow**: Comprehensive audit documentation generation
6. **Continuous Monitoring Workflow**: Ongoing compliance monitoring with automated alerting

### 🛡️ **Advanced Features**

- **Approval Workflows**: Multi-level approval processes for sensitive operations
- **Circuit Breakers**: Protection against cascading failures
- **Retry Logic**: Intelligent retry mechanisms with exponential backoff
- **Notifications**: Integration with SNS, Slack, and email notifications
- **Audit Logging**: Complete audit trail of all workflow executions
- **Performance Monitoring**: Detailed metrics and execution history

## Workflow Definitions

### 1. Compliance Scan Workflow

**Purpose**: Orchestrates comprehensive environment scanning across multiple AWS services.

**Flow**:
```
Initialize Scan → Discover Resources (Parallel) → Analyze Compliance → 
Store Findings → Send Notifications → Generate Report → Complete
```

**Features**:
- Parallel resource discovery across S3, IAM, EC2, etc.
- Configurable scan types (full, security, compliance, cost)
- Automatic notification on completion
- Error handling with rollback capabilities

**Parameters**:
- `tenantId` (required): Tenant identifier
- `scanType` (optional): Type of scan to perform
- `regions` (optional): AWS regions to scan
- `services` (optional): AWS services to include
- `notificationTargets` (optional): Notification recipients

### 2. Remediation Workflow

**Purpose**: Safely applies fixes to compliance violations with approval and rollback.

**Flow**:
```
Initialize → Check Approval → Wait for Approval → Validate Findings → 
Apply Remediations (Map) → Validate Results → Complete
```

**Features**:
- Multi-level approval workflow
- Dry-run capability for testing
- Parallel remediation execution
- Automatic rollback on failures
- Safety guardrails and validation

**Parameters**:
- `tenantId` (required): Tenant identifier
- `findingIds` (required): Array of finding IDs to remediate
- `approvalRequired` (optional): Whether approval is needed
- `dryRun` (optional): Perform dry run only
- `notificationTargets` (optional): Notification recipients

### 3. Compliance Assessment Workflow

**Purpose**: Comprehensive compliance assessment with detailed reporting.

**Flow**:
```
Initialize → Run Compliance Scan → Analyze Gaps → 
Generate Recommendations → Generate Assessment Report
```

**Features**:
- Framework-specific assessments (SOC 2, HIPAA, GDPR)
- Gap analysis and recommendations
- AI-powered compliance guidance
- Executive and technical reporting

**Parameters**:
- `tenantId` (required): Tenant identifier
- `framework` (required): Compliance framework
- `scope` (optional): Assessment scope
- `reportFormat` (optional): Report format
- `includeRecommendations` (optional): Include AI recommendations

### 4. Incident Response Workflow

**Purpose**: Automated incident response for critical compliance violations.

**Flow**:
```
Classify Incident → Determine Response → 
[Critical: Immediate Response | High: Urgent Response | Standard: Standard Response]
```

**Features**:
- Severity-based response routing
- Automatic remediation for critical incidents
- Multi-channel notifications
- Integration with security teams

**Parameters**:
- `tenantId` (required): Tenant identifier
- `incidentType` (required): Type of incident
- `severity` (optional): Incident severity
- `autoRemediate` (optional): Enable auto-remediation

### 5. Audit Pack Generation Workflow

**Purpose**: Generates comprehensive audit documentation and evidence.

**Flow**:
```
Initialize → Collect Audit Data (Parallel) → Generate Audit Report
```

**Features**:
- Parallel data collection from multiple sources
- Evidence collection and packaging
- Multiple output formats (HTML, PDF, ZIP)
- Compliance framework alignment

**Parameters**:
- `tenantId` (required): Tenant identifier
- `auditType` (required): Type of audit
- `dateRange` (optional): Date range for audit
- `includeEvidence` (optional): Include evidence files
- `format` (optional): Output format

### 6. Continuous Monitoring Workflow

**Purpose**: Ongoing compliance monitoring with automated alerting.

**Flow**:
```
Schedule Next Scan → Perform Incremental Scan → Evaluate Changes → 
[New Findings: Process → Check Thresholds → Trigger Incident Response]
```

**Features**:
- Configurable monitoring frequency
- Incremental scanning for efficiency
- Threshold-based alerting
- Automatic incident response integration

**Parameters**:
- `tenantId` (required): Tenant identifier
- `monitoringFrequency` (optional): Scan frequency in seconds
- `alertThresholds` (optional): Alert threshold configuration

## API Endpoints

### POST /workflows/start
Start a new workflow execution.

**Request:**
```json
{
  "workflowType": "compliance-scan",
  "tenantId": "tenant-123",
  "parameters": {
    "scanType": "full",
    "regions": ["us-east-1", "us-west-2"],
    "notificationTargets": ["security-team@company.com"]
  },
  "startedBy": "user@company.com",
  "metadata": {
    "source": "scheduled-scan",
    "priority": "high"
  }
}
```

**Response:**
```json
{
  "success": true,
  "correlationId": "req-123456789",
  "result": {
    "executionArn": "arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:scan-1642678800-abc123",
    "executionName": "scan-1642678800-abc123",
    "stateMachineArn": "arn:aws:states:us-east-1:123456789012:stateMachine:ComplianceScanWorkflow",
    "status": "RUNNING",
    "startDate": "2024-01-15T10:30:00Z",
    "workflowType": "compliance-scan",
    "tenantId": "tenant-123",
    "correlationId": "req-123456789"
  }
}
```

### GET /workflows/{executionArn}/status
Get workflow execution status and progress.

**Response:**
```json
{
  "success": true,
  "correlationId": "req-123456790",
  "result": {
    "executionArn": "arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:scan-1642678800-abc123",
    "status": "SUCCEEDED",
    "startDate": "2024-01-15T10:30:00Z",
    "stopDate": "2024-01-15T10:45:00Z",
    "input": {
      "tenantId": "tenant-123",
      "workflowType": "compliance-scan",
      "parameters": {
        "scanType": "full"
      }
    },
    "output": {
      "scanJob": {
        "scanJobId": "scan-456",
        "findingsCount": 23,
        "status": "COMPLETED"
      },
      "reportResults": {
        "reportId": "report-789",
        "reportUrl": "https://s3.amazonaws.com/reports/report-789.html"
      }
    },
    "stateMachineArn": "arn:aws:states:us-east-1:123456789012:stateMachine:ComplianceScanWorkflow"
  }
}
```

### PUT /workflows/{executionArn}/stop
Stop a running workflow execution.

**Response:**
```json
{
  "success": true,
  "correlationId": "req-123456791",
  "result": {
    "stopped": true,
    "message": "Workflow execution stopped successfully"
  }
}
```

### GET /workflows/list
List workflow executions with filtering.

**Query Parameters:**
- `tenantId` (optional): Filter by tenant
- `workflowType` (optional): Filter by workflow type
- `status` (optional): Filter by execution status
- `limit` (optional): Maximum number of results (default: 50)

**Response:**
```json
{
  "success": true,
  "correlationId": "req-123456792",
  "result": {
    "executions": [
      {
        "executionArn": "arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:scan-1642678800-abc123",
        "executionName": "scan-1642678800-abc123",
        "stateMachineArn": "arn:aws:states:us-east-1:123456789012:stateMachine:ComplianceScanWorkflow",
        "status": "SUCCEEDED",
        "startDate": "2024-01-15T10:30:00Z",
        "stopDate": "2024-01-15T10:45:00Z",
        "workflowType": "compliance-scan",
        "tenantId": "tenant-123",
        "correlationId": "req-123456789"
      }
    ]
  }
}
```

### GET /workflows/definitions
Get available workflow definitions.

**Response:**
```json
{
  "success": true,
  "correlationId": "req-123456793",
  "result": [
    {
      "workflowType": "compliance-scan",
      "name": "Compliance Environment Scan",
      "description": "Comprehensive scan of AWS environment for compliance violations",
      "version": "1.0.0",
      "stateMachineName": "ComplianceScanWorkflow",
      "requiredParameters": ["tenantId"],
      "optionalParameters": ["regions", "services", "scanType", "notificationTargets"],
      "estimatedDuration": "10-30 minutes"
    }
  ]
}
```

## Usage Examples

### Starting a Compliance Scan

```bash
curl -X POST https://api.compliance-shepherd.com/workflows/start \
  -H "Content-Type: application/json" \
  -d '{
    "workflowType": "compliance-scan",
    "tenantId": "my-company",
    "parameters": {
      "scanType": "security",
      "regions": ["us-east-1"]
    }
  }'
```

### Starting a Remediation Workflow

```bash
curl -X POST https://api.compliance-shepherd.com/workflows/start \
  -H "Content-Type: application/json" \
  -d '{
    "workflowType": "remediation",
    "tenantId": "my-company",
    "parameters": {
      "findingIds": ["finding-123", "finding-456"],
      "approvalRequired": true,
      "dryRun": false
    },
    "startedBy": "security-team@company.com"
  }'
```

### Monitoring Workflow Progress

```bash
# Get execution status
curl -X GET "https://api.compliance-shepherd.com/workflows/arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:scan-123/status"

# List recent executions
curl -X GET "https://api.compliance-shepherd.com/workflows/list?tenantId=my-company&limit=10"
```

### JavaScript/TypeScript Integration

```typescript
import { StepFunctionsOrchestratorService } from './services/StepFunctionsOrchestratorService';

const orchestrator = new StepFunctionsOrchestratorService();

// Start a compliance assessment
const assessmentRequest = {
  workflowType: 'compliance-assessment',
  tenantId: 'my-company',
  parameters: {
    framework: 'SOC2',
    includeRecommendations: true
  },
  startedBy: 'audit-team@company.com'
};

const execution = await orchestrator.startWorkflow(assessmentRequest, 'correlation-123');
console.log('Assessment started:', execution.executionArn);

// Monitor progress
const status = await orchestrator.getWorkflowStatus(execution.executionArn, 'correlation-124');
console.log('Current status:', status.status);

// Get workflow metrics
const metrics = await orchestrator.getWorkflowMetrics('compliance-assessment', 'my-company');
console.log('Success rate:', metrics.successfulExecutions / metrics.totalExecutions);
```

## Setup and Deployment

### Prerequisites

- AWS account with Step Functions access
- IAM permissions for Step Functions operations
- Lambda functions for action groups deployed
- SNS topics for notifications configured

### Environment Variables

```bash
# Required
AWS_REGION=us-east-1

# Optional
LOG_LEVEL=INFO
STEP_FUNCTIONS_ROLE_ARN=arn:aws:iam::123456789012:role/StepFunctionsExecutionRole
```

### Automated Deployment

Use the deployment script to create all state machines:

```bash
cd services/step-functions-orchestrator
npm install
npm run build
npm run deploy
```

This script will:
1. Create the IAM role for Step Functions execution
2. Deploy all 6 workflow state machines
3. Configure logging and tracing
4. Save deployment configuration
5. Output environment variables to set

### Manual Deployment

1. **Create IAM Role**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": { "Service": "states.amazonaws.com" },
         "Action": "sts:AssumeRole"
       }
     ]
   }
   ```

2. **Create State Machines**: Use the AWS Console or CLI to create state machines from the workflow definitions

3. **Configure Permissions**: Ensure the execution role has permissions to invoke Lambda functions and publish to SNS

## Workflow State Machine Examples

### Compliance Scan State Machine

```json
{
  "Comment": "Compliance Environment Scan Workflow",
  "StartAt": "InitializeScan",
  "States": {
    "InitializeScan": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123456789012:function:scan-environment",
      "Parameters": {
        "action": "initialize",
        "tenantId.$": "$.tenantId",
        "scanType.$": "$.parameters.scanType"
      },
      "Next": "DiscoverResources"
    },
    "DiscoverResources": {
      "Type": "Parallel",
      "Branches": [
        {
          "StartAt": "DiscoverS3Resources",
          "States": {
            "DiscoverS3Resources": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:us-east-1:123456789012:function:scan-environment",
              "Parameters": {
                "action": "discover",
                "service": "S3"
              },
              "End": true
            }
          }
        }
      ],
      "Next": "AnalyzeCompliance"
    }
  }
}
```

### Remediation State Machine with Approval

```json
{
  "Comment": "Compliance Remediation Workflow",
  "StartAt": "InitializeRemediation",
  "States": {
    "InitializeRemediation": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123456789012:function:apply-fix",
      "Next": "CheckApprovalRequired"
    },
    "CheckApprovalRequired": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.parameters.approvalRequired",
          "BooleanEquals": true,
          "Next": "WaitForApproval"
        }
      ],
      "Default": "ApplyRemediations"
    },
    "WaitForApproval": {
      "Type": "Wait",
      "Seconds": 300,
      "Next": "CheckApprovalStatus"
    }
  }
}
```

## Error Handling and Monitoring

### Error Handling Strategies

**Retry Logic**:
- Exponential backoff for transient failures
- Maximum retry attempts per task
- Different retry strategies per task type

**Circuit Breakers**:
- Prevent cascading failures
- Automatic recovery mechanisms
- Fallback procedures

**Rollback Procedures**:
- Automatic rollback on critical failures
- Manual rollback capabilities
- State preservation for recovery

### Monitoring and Alerting

**CloudWatch Integration**:
- Execution metrics and logs
- Custom metrics for business logic
- Automated alerting on failures

**X-Ray Tracing**:
- End-to-end request tracing
- Performance analysis
- Bottleneck identification

**Audit Logging**:
- Complete execution history
- User action tracking
- Compliance audit trails

## Performance Optimization

### Execution Optimization

**Parallel Processing**:
- Concurrent task execution where possible
- Resource discovery parallelization
- Independent remediation execution

**State Management**:
- Minimal state passing between tasks
- Efficient data serialization
- State compression for large payloads

**Resource Management**:
- Lambda concurrency limits
- Step Functions execution limits
- Cost optimization strategies

### Scaling Considerations

**Concurrent Executions**:
- Maximum concurrent workflow executions
- Queue management for high-volume scenarios
- Priority-based execution ordering

**Regional Deployment**:
- Multi-region deployment strategies
- Cross-region workflow coordination
- Disaster recovery procedures

## Security Considerations

### Access Control

**IAM Permissions**:
- Least privilege execution roles
- Resource-based access control
- Cross-account execution permissions

**Encryption**:
- Encryption in transit and at rest
- KMS key management
- Sensitive data handling

### Compliance

**Audit Requirements**:
- Complete execution logging
- Data retention policies
- Regulatory compliance alignment

**Data Protection**:
- PII handling procedures
- Data classification and handling
- Cross-border data transfer compliance

This Step Functions Orchestrator service provides sophisticated workflow management capabilities that enable complex compliance operations to be executed reliably, monitored comprehensively, and scaled efficiently across enterprise environments.
