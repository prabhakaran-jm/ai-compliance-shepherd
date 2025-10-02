# Bedrock Agent Service

The Bedrock Agent service provides an AI-powered conversational interface for cloud compliance management. It uses Amazon Bedrock Agent with action groups to enable the AI to perform actual operations like scanning environments, managing findings, applying fixes, and generating reports.

## Overview

This service creates and manages a Bedrock Agent that can:

- **Converse Naturally**: Chat with users about compliance topics using natural language
- **Take Actions**: Execute operations through action groups (scan, remediate, report)
- **Access Knowledge**: Leverage the Bedrock Knowledge Base for compliance guidance
- **Maintain Context**: Keep conversation context across multiple interactions

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Chat     │───▶│  Bedrock Agent   │───▶│ Action Groups   │
│   Interface     │    │   (Claude 3)     │    │  (Lambda Fns)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │ Knowledge Base   │    │ Compliance      │
                       │ (SOC 2, etc.)    │    │ Operations      │
                       └──────────────────┘    └─────────────────┘
```

## Features

### 🤖 AI Agent Capabilities

- **Natural Language Processing**: Understands compliance questions and requests
- **Context Awareness**: Maintains conversation state and remembers previous interactions
- **Multi-turn Conversations**: Supports complex workflows across multiple messages
- **Intelligent Routing**: Automatically determines which actions to take based on user intent

### ⚡ Action Groups

The agent has access to six action groups that enable it to perform real operations:

1. **ScanActions**: Start environment scans, check scan status, list recent scans
2. **FindingsActions**: Search findings, get details, resolve findings, view statistics
3. **RemediationActions**: Apply fixes, check remediation status, rollback changes
4. **ReportingActions**: Generate compliance reports, retrieve reports, list available reports
5. **TerraformActions**: Analyze Terraform plans, validate configurations
6. **S3ManagementActions**: Analyze and configure S3 buckets for compliance

### 🧠 Knowledge Integration

- **Bedrock Knowledge Base**: Access to comprehensive SOC 2 compliance documentation
- **Contextual Answers**: Provides accurate compliance guidance with citations
- **Real-time Information**: Combines knowledge base content with live system data

### 🔒 Security & Safety

- **Input Validation**: Comprehensive validation of all user inputs
- **Error Handling**: Robust error handling with detailed logging
- **Rate Limiting**: Built-in protection against abuse
- **Audit Logging**: Complete audit trail of all agent interactions

## API Endpoints

### POST /agent/invoke
Invoke the agent with a message and get a response with potential actions.

```json
{
  "sessionId": "optional-session-id",
  "inputText": "Scan my AWS environment for compliance issues",
  "enableTrace": false,
  "endSession": false
}
```

**Response:**
```json
{
  "success": true,
  "correlationId": "req-123",
  "result": {
    "sessionId": "session-456",
    "response": "I'll start a compliance scan of your AWS environment...",
    "traces": [],
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### POST /agent/chat
Chat with the agent using the knowledge base for compliance questions.

```json
{
  "sessionId": "optional-session-id",
  "inputText": "What are the SOC 2 requirements for data encryption?",
  "enableTrace": false
}
```

**Response:**
```json
{
  "success": true,
  "correlationId": "req-124",
  "result": {
    "sessionId": "session-456",
    "response": "SOC 2 requires encryption of data both in transit and at rest...",
    "citations": [
      {
        "generatedResponsePart": {
          "textResponsePart": {
            "text": "encryption requirements",
            "span": { "start": 15, "end": 37 }
          }
        },
        "retrievedReferences": [
          {
            "content": { "text": "Data encryption requirements..." },
            "location": { "s3Location": { "uri": "s3://kb-bucket/soc2-data.md" } }
          }
        ]
      }
    ],
    "timestamp": "2024-01-15T10:31:00Z"
  }
}
```

### GET /agent/status
Get the current status and configuration of the agent.

**Response:**
```json
{
  "success": true,
  "correlationId": "req-125",
  "result": {
    "configured": true,
    "agentId": "agent-123",
    "agentName": "AI-Compliance-Shepherd-Agent",
    "agentStatus": "PREPARED",
    "foundationModel": "anthropic.claude-3-sonnet-20240229-v1:0",
    "actionGroups": [
      {
        "actionGroupId": "ag-1",
        "actionGroupName": "ScanActions",
        "actionGroupState": "ENABLED",
        "description": "Actions for scanning AWS environments"
      }
    ],
    "createdAt": "2024-01-15T09:00:00Z",
    "updatedAt": "2024-01-15T09:30:00Z"
  }
}
```

### PUT /agent/prepare
Create or update the agent and its action groups.

**Response:**
```json
{
  "success": true,
  "correlationId": "req-126",
  "result": {
    "agentId": "agent-123",
    "agentAliasId": "alias-456",
    "actionGroups": [
      {
        "actionGroupId": "ag-1",
        "actionGroupName": "ScanActions",
        "status": "created"
      }
    ],
    "status": "prepared",
    "message": "Agent and action groups configured successfully"
  }
}
```

## Usage Examples

### Basic Conversation

```bash
# Start a conversation
curl -X POST https://api.compliance-shepherd.com/agent/chat \
  -H "Content-Type: application/json" \
  -d '{
    "inputText": "Hello, I need help with SOC 2 compliance"
  }'

# Continue the conversation
curl -X POST https://api.compliance-shepherd.com/agent/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-from-previous-response",
    "inputText": "What are the key controls I need to implement?"
  }'
```

### Action-Oriented Requests

```bash
# Request a scan
curl -X POST https://api.compliance-shepherd.com/agent/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "inputText": "Please scan my AWS environment for security violations",
    "enableTrace": true
  }'

# Ask about findings
curl -X POST https://api.compliance-shepherd.com/agent/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-456",
    "inputText": "Show me all critical findings from the last scan"
  }'

# Request remediation
curl -X POST https://api.compliance-shepherd.com/agent/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-456",
    "inputText": "Fix the S3 bucket encryption issues you found"
  }'
```

## Setup and Configuration

### Prerequisites

- AWS account with Bedrock access
- IAM permissions for Bedrock Agent operations
- Lambda functions for action groups deployed
- Bedrock Knowledge Base configured

### Environment Variables

```bash
# Required
BEDROCK_AGENT_ID=agent-123456789
BEDROCK_AGENT_ALIAS_ID=TSTALIASID
BEDROCK_KNOWLEDGE_BASE_ID=kb-123456789
AWS_REGION=us-east-1

# Optional
LOG_LEVEL=INFO
AGENT_TIMEOUT=300000
```

### Automated Setup

Use the setup script to create the agent and action groups:

```bash
cd services/bedrock-agent
npm run setup-agent
```

This script will:
1. Create the IAM role for Bedrock Agent
2. Create the Bedrock Agent with Claude 3 Sonnet
3. Create all six action groups
4. Prepare the agent for use
5. Create a production alias
6. Save configuration to `agent-config.json`

### Manual Setup

1. **Create IAM Role**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": { "Service": "bedrock.amazonaws.com" },
         "Action": "sts:AssumeRole"
       }
     ]
   }
   ```

2. **Create Bedrock Agent**:
   - Foundation Model: `anthropic.claude-3-sonnet-20240229-v1:0`
   - Instruction: See setup script for full instruction text
   - Session TTL: 3600 seconds

3. **Create Action Groups**:
   - Link each action group to its corresponding Lambda function
   - Use the OpenAPI schemas defined in `ActionGroupService`

4. **Prepare Agent**:
   - Run the prepare command to make the agent ready for use

## Action Group Integration

Each action group corresponds to a Lambda function:

| Action Group | Lambda Function | Purpose |
|--------------|----------------|---------|
| ScanActions | scan-environment | Start and manage environment scans |
| FindingsActions | findings-storage | Manage compliance findings |
| RemediationActions | apply-fix | Apply fixes and remediations |
| ReportingActions | html-report-generator | Generate compliance reports |
| TerraformActions | analyze-terraform-plan | Analyze infrastructure code |
| S3ManagementActions | s3-bucket-manager | Manage S3 configurations |

### Action Group Schema

Each action group uses OpenAPI 3.0 schemas to define available operations:

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Scan Actions API",
    "version": "1.0.0"
  },
  "paths": {
    "/scan/start": {
      "post": {
        "summary": "Start an environment scan",
        "operationId": "startScan",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "tenantId": { "type": "string" },
                  "scanType": { 
                    "type": "string", 
                    "enum": ["full", "security", "compliance", "cost"] 
                  }
                },
                "required": ["tenantId"]
              }
            }
          }
        }
      }
    }
  }
}
```

## Conversation Flow Examples

### Compliance Assessment Flow

```
User: "I need to assess my AWS environment for SOC 2 compliance"

Agent: "I'll help you assess your AWS environment for SOC 2 compliance. Let me start by scanning your environment to identify any compliance gaps.

[Executes ScanActions.startScan with scanType: 'compliance']

I've initiated a comprehensive compliance scan of your AWS environment. This will check for:
- Data encryption requirements
- Access control configurations  
- Logging and monitoring setup
- Network security controls

The scan is running and should complete in about 10-15 minutes. Would you like me to explain what SOC 2 controls we're checking for while we wait?"

User: "Yes, please explain the key SOC 2 controls"

Agent: "SOC 2 focuses on five trust service criteria, but for AWS environments, we primarily focus on Security and Availability controls:

**Security Controls:**
- CC6.1: Logical access controls restrict access to data
- CC6.2: Multi-factor authentication for privileged users
- CC6.3: Network security controls (firewalls, VPCs)
- CC6.7: Data transmission encryption
- CC6.8: Data at rest encryption

[Continues with detailed explanation from knowledge base...]

Your scan has completed! I found 12 findings that need attention. Would you like me to show you the critical ones first?"
```

### Remediation Flow

```
User: "Show me the critical findings and help me fix them"

Agent: "[Executes FindingsActions.searchFindings with severity: 'CRITICAL']

I found 3 critical findings in your environment:

1. **S3 Bucket Public Access** (CRITICAL)
   - Bucket: my-app-data-bucket
   - Issue: Public read access enabled
   - Risk: Potential data exposure

2. **Unencrypted RDS Database** (CRITICAL)  
   - Database: prod-customer-db
   - Issue: Encryption at rest not enabled
   - Risk: Sensitive data not protected

3. **IAM User with Admin Access** (CRITICAL)
   - User: service-account-1
   - Issue: Full administrative permissions
   - Risk: Excessive privileges

I can help you fix these issues safely. Should I start with the S3 bucket since that's the most immediate risk?"

User: "Yes, fix the S3 bucket issue"

Agent: "I'll fix the S3 bucket public access issue. Let me first check what exactly is configured and then apply the appropriate fix.

[Executes RemediationActions.applyRemediation with dryRun: true]

**Dry Run Results:**
- Will disable public read access on bucket 'my-app-data-bucket'
- Will enable bucket-level public access block
- No existing applications should be affected (no public website hosting detected)

This change is safe to apply. Should I proceed with the actual fix?"

User: "Yes, go ahead"

Agent: "[Executes RemediationActions.applyRemediation with dryRun: false]

✅ **Fix Applied Successfully**
- Disabled public read access on my-app-data-bucket
- Enabled public access block settings
- Remediation job ID: rem-789 (for rollback if needed)

The S3 bucket is now secure. Would you like me to fix the RDS encryption issue next? Note that this will require a maintenance window as it involves recreating the database with encryption enabled."
```

## Error Handling

The service includes comprehensive error handling:

### Agent Configuration Errors
```json
{
  "success": false,
  "error": {
    "message": "Agent not configured. Run prepare-agent first.",
    "code": "AGENT_CONFIGURATION_ERROR",
    "correlationId": "req-123",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Validation Errors
```json
{
  "success": false,
  "error": {
    "message": "Invalid request",
    "code": "VALIDATION_ERROR",
    "correlationId": "req-124",
    "details": {
      "errors": ["inputText: Input text is required"]
    }
  }
}
```

### Service Errors
```json
{
  "success": false,
  "error": {
    "message": "Failed to invoke agent: Rate limit exceeded",
    "code": "RATE_LIMIT_ERROR",
    "correlationId": "req-125",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Monitoring and Logging

### Structured Logging

All operations are logged with structured JSON:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "service": "bedrock-agent",
  "version": "1.0.0",
  "message": "Agent invocation started",
  "correlationId": "req-123",
  "sessionId": "session-456",
  "inputLength": 45,
  "agentId": "agent-789"
}
```

### Performance Metrics

Key metrics to monitor:
- Agent response time
- Action group execution time
- Success/error rates
- Session duration
- Token usage

### Audit Events

All agent interactions are audited:
- User inputs and agent responses
- Action group executions
- Configuration changes
- Error events

## Security Considerations

### Input Validation
- All user inputs are validated and sanitized
- Maximum input length enforced (10,000 characters)
- Malicious content detection and blocking

### Access Control
- IAM-based access control for agent operations
- Tenant isolation for multi-tenant deployments
- API key or JWT token authentication required

### Data Protection
- No sensitive data stored in agent memory
- All communications encrypted in transit
- Audit logs for compliance tracking

### Rate Limiting
- Built-in rate limiting to prevent abuse
- Circuit breaker pattern for external service calls
- Timeout protection for long-running operations

## Troubleshooting

### Common Issues

**Agent Not Responding**
```bash
# Check agent status
curl -X GET https://api.compliance-shepherd.com/agent/status

# Check CloudWatch logs
aws logs filter-log-events --log-group-name /aws/lambda/bedrock-agent
```

**Action Group Failures**
```bash
# Enable tracing to see action group execution
curl -X POST https://api.compliance-shepherd.com/agent/invoke \
  -d '{"inputText": "scan environment", "enableTrace": true}'
```

**Knowledge Base Issues**
```bash
# Test knowledge base directly
curl -X POST https://api.compliance-shepherd.com/agent/chat \
  -d '{"inputText": "What is SOC 2?"}'
```

### Debug Mode

Enable debug logging:
```bash
export LOG_LEVEL=DEBUG
```

This will log:
- Detailed request/response data
- Action group execution details
- Knowledge base queries
- Performance timing information

## Development

### Local Testing

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run with coverage
npm run test:coverage

# Build
npm run build

# Lint
npm run lint
```

### Testing with Mock Data

The service includes comprehensive test coverage with mocked AWS services:

```bash
# Run specific test suites
npm test -- --testNamePattern="BedrockAgentService"
npm test -- --testNamePattern="ActionGroupService"

# Run integration tests
npm run test:integration
```

### Adding New Action Groups

1. Define the action group in `ActionGroupService.ts`
2. Create the OpenAPI schema
3. Add the corresponding Lambda function
4. Update the setup script
5. Add tests for the new functionality

## Integration Examples

### Web Application Integration

```javascript
// React component example
import { useState } from 'react';

function ComplianceChat() {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);

  const sendMessage = async (text) => {
    const response = await fetch('/api/agent/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        inputText: text,
        enableTrace: false
      })
    });

    const result = await response.json();
    
    if (result.success) {
      setSessionId(result.result.sessionId);
      setMessages(prev => [...prev, 
        { role: 'user', content: text },
        { role: 'agent', content: result.result.response }
      ]);
    }
  };

  return (
    <div className="compliance-chat">
      {/* Chat UI implementation */}
    </div>
  );
}
```

### CLI Integration

```bash
#!/bin/bash
# compliance-cli.sh

function ask_agent() {
  local question="$1"
  local session_file="/tmp/compliance-session"
  
  local session_id=""
  if [[ -f "$session_file" ]]; then
    session_id=$(cat "$session_file")
  fi

  local response=$(curl -s -X POST "$API_BASE/agent/invoke" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\":\"$session_id\",\"inputText\":\"$question\"}")
  
  local new_session=$(echo "$response" | jq -r '.result.sessionId')
  echo "$new_session" > "$session_file"
  
  echo "$response" | jq -r '.result.response'
}

# Usage
ask_agent "Scan my environment for compliance issues"
ask_agent "Show me the critical findings"
ask_agent "Fix the S3 bucket issues"
```

This Bedrock Agent service provides a powerful, conversational interface for cloud compliance management, combining the natural language capabilities of Claude 3 with the operational power of the compliance platform's Lambda functions.
