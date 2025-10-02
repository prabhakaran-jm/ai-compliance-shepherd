# Bedrock Knowledge Base Service

The Bedrock Knowledge Base Service provides AI-powered compliance guidance using AWS Bedrock and a comprehensive knowledge base of SOC 2, HIPAA, GDPR, and other compliance frameworks. It enables natural language queries for compliance questions and supports automated data ingestion.

## Features

### Core Capabilities
- **AI-Powered Query Engine**: Natural language queries for compliance guidance
- **Multi-Framework Support**: SOC 2, HIPAA, GDPR, PCI-DSS, ISO 27001, and NIST
- **Intelligent Data Processing**: Automatic content processing and enhancement
- **Conversational Chat Interface**: Interactive compliance assistance
- **Automated Data Ingestion**: Streamlined process for adding new compliance content
- **Vector Search**: Semantic search capabilities for accurate information retrieval

### Knowledge Base Features
- **Comprehensive SOC 2 Coverage**: Detailed guidance for all trust service criteria
- **AWS Implementation Guides**: Specific guidance for AWS services and compliance
- **Best Practices**: Industry best practices and recommendations
- **Control Mappings**: Mapping between compliance requirements and AWS controls
- **Remediation Guidance**: Step-by-step remediation instructions

### AI Capabilities
- **Contextual Understanding**: Understands compliance context and provides relevant answers
- **Citation Support**: Provides sources and references for all responses
- **Session Management**: Maintains conversation context across queries
- **Multi-Modal Processing**: Supports text, markdown, and JSON content formats

## Architecture

### Components
```
API Gateway → Bedrock KB Handler → Bedrock Knowledge Base → Vector Store
                    ↓                        ↓                    ↓
            Data Processor ← Content Ingestion ← S3 Data Sources
                    ↓
            Compliance Chat Interface
```

### Key Services
- **BedrockKnowledgeBaseService**: Main orchestration service
- **ComplianceDataProcessor**: Processes and enhances compliance content
- **Vector Search Engine**: Semantic search using Amazon Bedrock embeddings
- **Chat Interface**: Conversational AI for compliance guidance

### Data Flow
1. **Content Ingestion**: Upload compliance documents to S3
2. **Data Processing**: Enhance content with metadata and structure
3. **Vector Indexing**: Create embeddings using Bedrock models
4. **Query Processing**: Handle natural language queries
5. **Response Generation**: Generate contextual responses with citations

## API Reference

### Query Knowledge Base
```
POST /knowledge-base/query
```

**Request Body:**
```json
{
  "query": "What are the SOC 2 security requirements for access controls?",
  "maxResults": 5,
  "retrievalConfiguration": {
    "vectorSearchConfiguration": {
      "numberOfResults": 5,
      "overrideSearchType": "HYBRID"
    }
  },
  "sessionId": "session-uuid",
  "context": {
    "framework": "SOC2",
    "resourceType": "IAM_ROLE",
    "findingId": "finding-123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "correlationId": "uuid",
  "result": {
    "answer": "SOC 2 security requirements for access controls include implementing logical and physical access controls to restrict access to system resources...",
    "sources": [
      {
        "content": "Access controls are fundamental to SOC 2 security...",
        "location": {
          "type": "S3",
          "s3Location": {
            "uri": "s3://compliance-bucket/soc2-security.md"
          }
        },
        "score": 0.95
      }
    ],
    "sessionId": "session-uuid",
    "citations": [
      {
        "generatedResponsePart": {
          "textResponsePart": {
            "text": "implement logical and physical access controls",
            "span": { "start": 45, "end": 85 }
          }
        },
        "retrievedReferences": [
          {
            "content": { "text": "Access controls must be implemented..." },
            "location": {
              "type": "S3",
              "s3Location": { "uri": "s3://compliance-bucket/soc2-security.md" }
            }
          }
        ]
      }
    ]
  }
}
```

### Ingest Compliance Data
```
POST /knowledge-base/ingest
```

**Request Body:**
```json
{
  "dataType": "SOC2",
  "content": "# SOC 2 Security Controls\n\n## Access Control Requirements\n\nOrganizations must implement...",
  "metadata": {
    "title": "SOC 2 Security Controls",
    "description": "Comprehensive guide to SOC 2 security requirements",
    "framework": "SOC2",
    "category": "ACCESS_CONTROL",
    "tags": ["security", "access-control", "authentication"],
    "version": "1.0",
    "lastUpdated": "2024-01-01T00:00:00Z"
  },
  "format": "MARKDOWN"
}
```

**Response:**
```json
{
  "success": true,
  "correlationId": "uuid",
  "result": {
    "ingestionJobId": "job-123456",
    "dataSourceId": "ds-789012",
    "status": "STARTING",
    "s3Location": "s3://compliance-bucket/compliance-data/soc2/2024-01-01-uuid.md",
    "message": "Compliance data ingestion started successfully"
  }
}
```

### Chat with Compliance Expert
```
POST /knowledge-base/chat
```

**Request Body:**
```json
{
  "query": "How do I implement MFA for SOC 2 compliance in AWS?",
  "sessionId": "chat-session-uuid",
  "context": {
    "framework": "SOC2",
    "resourceType": "IAM_USER"
  }
}
```

**Response:**
```json
{
  "success": true,
  "correlationId": "uuid",
  "result": {
    "answer": "To implement MFA for SOC 2 compliance in AWS:\n\n1. **Enable MFA for all IAM users**:\n   - Navigate to IAM console\n   - Select each user and enable MFA\n   - Choose appropriate MFA device type\n\n2. **Enforce MFA with IAM policies**:\n   - Create conditional policies requiring MFA\n   - Apply to all administrative roles\n\n3. **Monitor MFA usage**:\n   - Use CloudTrail to track MFA events\n   - Set up alerts for non-MFA access attempts\n\nThis addresses SOC 2 CC6.1 requirements for logical access controls.",
    "sources": [...],
    "sessionId": "chat-session-uuid",
    "citations": [...]
  }
}
```

### Get Knowledge Base Status
```
GET /knowledge-base/status
```

**Response:**
```json
{
  "success": true,
  "correlationId": "uuid",
  "result": {
    "knowledgeBaseId": "KB123456789",
    "name": "AI Compliance Shepherd Knowledge Base",
    "status": "ACTIVE",
    "description": "SOC 2 compliance guidance knowledge base",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-02T00:00:00Z",
    "dataSources": [
      {
        "dataSourceId": "DS123456789",
        "name": "SOC2 Compliance Data",
        "status": "AVAILABLE",
        "lastSyncTime": "2024-01-02T00:00:00Z"
      }
    ],
    "vectorIndex": {
      "status": "ACTIVE",
      "documentCount": 150
    }
  }
}
```

### List Data Sources
```
GET /knowledge-base/{knowledgeBaseId}/sources
```

**Response:**
```json
{
  "success": true,
  "correlationId": "uuid",
  "result": [
    {
      "dataSourceId": "DS123456789",
      "name": "SOC2 Compliance Documentation",
      "description": "Comprehensive SOC 2 compliance guidance",
      "status": "AVAILABLE",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-02T00:00:00Z"
    }
  ]
}
```

### Sync Data Sources
```
PUT /knowledge-base/sync
```

**Response:**
```json
{
  "success": true,
  "correlationId": "uuid",
  "result": {
    "syncJobs": ["job-123456", "job-789012"]
  }
}
```

## Configuration

### Environment Variables
```bash
# AWS Configuration
AWS_REGION=us-east-1

# Bedrock Configuration
BEDROCK_KNOWLEDGE_BASE_ID=KB123456789
BEDROCK_MODEL_ARN=arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-v2
BEDROCK_KMS_KEY_ARN=arn:aws:kms:us-east-1:123456789012:key/uuid

# S3 Configuration
COMPLIANCE_DATA_BUCKET=ai-compliance-shepherd-knowledge-base

# Optional Configuration
NODE_ENV=production
DEBUG=false
```

### Required AWS Services
- **Amazon Bedrock**: Foundation models and knowledge base
- **Amazon OpenSearch Serverless**: Vector storage
- **Amazon S3**: Document storage
- **AWS IAM**: Access control and permissions

### IAM Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:RetrieveAndGenerate",
        "bedrock:Retrieve"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:CreateKnowledgeBase",
        "bedrock:GetKnowledgeBase",
        "bedrock:ListKnowledgeBases",
        "bedrock:UpdateKnowledgeBase",
        "bedrock:DeleteKnowledgeBase"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:CreateDataSource",
        "bedrock:GetDataSource",
        "bedrock:ListDataSources",
        "bedrock:UpdateDataSource",
        "bedrock:DeleteDataSource",
        "bedrock:StartIngestionJob",
        "bedrock:GetIngestionJob",
        "bedrock:ListIngestionJobs"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::ai-compliance-shepherd-knowledge-base",
        "arn:aws:s3:::ai-compliance-shepherd-knowledge-base/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "aoss:APIAccessAll"
      ],
      "Resource": "*"
    }
  ]
}
```

## Knowledge Base Content

### SOC 2 Framework Coverage

#### Security (CC6.1 - CC6.8)
- **Access Controls**: Logical and physical access restrictions
- **System Boundaries**: Network segmentation and data classification
- **Risk Assessment**: Threat identification and vulnerability management
- **Security Monitoring**: Continuous monitoring and incident response
- **Data Protection**: Encryption and data handling procedures

#### Availability (CC7.1 - CC7.5)
- **System Monitoring**: 24/7 monitoring and alerting
- **Capacity Management**: Performance and capacity planning
- **Backup and Recovery**: Business continuity procedures
- **Change Management**: Controlled system modifications
- **Incident Response**: Availability incident handling

#### Processing Integrity (CC8.1)
- **Data Processing Controls**: Validation and error handling
- **System Development**: Secure development practices
- **Change Controls**: Development lifecycle management

#### Confidentiality (CC9.1)
- **Data Classification**: Confidential data identification
- **Encryption**: Data protection in transit and at rest
- **Access Restrictions**: Need-to-know access controls

#### Privacy (CC10.1 - CC10.4)
- **Privacy Notice**: Transparent data practices
- **Data Collection**: Lawful and limited collection
- **Data Use**: Consistent with stated purposes
- **Data Subject Rights**: Access, correction, and deletion

### AWS Implementation Guidance

#### Identity and Access Management
- IAM best practices and configurations
- Multi-factor authentication implementation
- Role-based access control
- Cross-account access patterns

#### Network Security
- VPC design and configuration
- Security group and NACL management
- AWS WAF and Shield implementation
- Network monitoring and logging

#### Data Protection
- S3 encryption and access controls
- RDS security configurations
- KMS key management
- Data classification and handling

#### Monitoring and Logging
- CloudTrail configuration
- CloudWatch metrics and alarms
- AWS Config compliance monitoring
- Security incident response

## Data Processing

### Content Enhancement
The service automatically enhances ingested content with:

- **Framework Context**: Adds framework-specific information
- **Compliance Markers**: Highlights requirements, recommendations, and controls
- **Metadata Headers**: Structured metadata for better retrieval
- **Semantic Enrichment**: Adds compliance-specific terminology

### Supported Formats
- **Markdown**: Rich text with formatting and structure
- **Plain Text**: Automatic conversion to structured format
- **JSON**: Structured data with automatic markdown conversion

### Content Validation
- **Quality Checks**: Ensures content meets minimum standards
- **Framework Alignment**: Validates framework-specific terminology
- **Actionable Content**: Ensures practical guidance is included
- **Structure Validation**: Checks for proper formatting and organization

## Setup and Deployment

### Prerequisites
1. **AWS Account** with Bedrock access enabled
2. **OpenSearch Serverless** collection created
3. **S3 Bucket** for document storage
4. **IAM Roles** with appropriate permissions

### Setup Script
```bash
# Run the setup script
npm run setup-kb

# Or manually with Node.js
node scripts/setup-knowledge-base.js
```

### Manual Setup Steps

#### 1. Create OpenSearch Serverless Collection
```bash
aws opensearchserverless create-collection \
  --name compliance-kb-collection \
  --type VECTORSEARCH \
  --description "Vector collection for compliance knowledge base"
```

#### 2. Create S3 Bucket
```bash
aws s3 mb s3://ai-compliance-shepherd-knowledge-base
```

#### 3. Create Knowledge Base
```bash
aws bedrock-agent create-knowledge-base \
  --name "AI Compliance Shepherd KB" \
  --description "SOC 2 compliance guidance" \
  --role-arn "arn:aws:iam::account:role/BedrockKnowledgeBaseRole" \
  --knowledge-base-configuration file://kb-config.json \
  --storage-configuration file://storage-config.json
```

#### 4. Create Data Source
```bash
aws bedrock-agent create-data-source \
  --knowledge-base-id KB123456789 \
  --name "SOC2 Compliance Data" \
  --data-source-configuration file://ds-config.json
```

#### 5. Start Initial Ingestion
```bash
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id KB123456789 \
  --data-source-id DS123456789 \
  --description "Initial SOC 2 data ingestion"
```

### Data Ingestion
```bash
# Ingest compliance data
npm run ingest-data

# Or manually upload to S3
aws s3 cp data/soc2-compliance-data.md \
  s3://ai-compliance-shepherd-knowledge-base/compliance-data/
```

## Usage Examples

### Basic Query
```typescript
const service = new BedrockKnowledgeBaseService();

const response = await service.queryKnowledgeBase({
  query: "What are the SOC 2 requirements for encryption?",
  maxResults: 3,
  context: {
    framework: "SOC2",
    resourceType: "S3_BUCKET"
  }
}, correlationId);

console.log(response.answer);
console.log(response.sources);
```

### Chat Interface
```typescript
const chatResponse = await service.chatWithCompliance({
  query: "How do I implement SOC 2 access controls in AWS?",
  sessionId: "user-session-123"
}, correlationId);

console.log(chatResponse.answer);
```

### Content Ingestion
```typescript
const ingestResponse = await service.ingestComplianceData({
  dataType: "SOC2",
  content: markdownContent,
  metadata: {
    title: "SOC 2 Network Security",
    framework: "SOC2",
    category: "NETWORK_SECURITY",
    tags: ["security", "network", "firewall"]
  },
  format: "MARKDOWN"
}, correlationId);

console.log(ingestResponse.ingestionJobId);
```

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Test Coverage
- **Query Processing**: All query types and contexts
- **Data Ingestion**: All content formats and validation
- **Error Handling**: All error conditions and recovery
- **Chat Interface**: Conversational flows and context
- **Content Processing**: Format conversion and enhancement

### Mock Data
Test fixtures include:
- Sample compliance queries and responses
- Mock Bedrock API responses
- Test compliance documents
- Error scenarios and edge cases

## Monitoring and Logging

### Structured Logging
All operations are logged with structured JSON format:
```json
{
  "timestamp": "2024-01-01T00:00:00Z",
  "level": "INFO",
  "service": "bedrock-knowledge-base",
  "message": "Knowledge base query completed",
  "correlationId": "uuid",
  "query": "SOC 2 access controls",
  "answerLength": 1250,
  "sourcesCount": 3,
  "sessionId": "session-uuid"
}
```

### Key Metrics
- **Query Response Time**: Time to process and respond to queries
- **Token Usage**: Input and output tokens for cost monitoring
- **Success Rate**: Percentage of successful queries
- **Content Quality**: Validation scores for ingested content
- **User Engagement**: Session duration and query patterns

### Monitoring Dashboards
- **Query Performance**: Response times and success rates
- **Content Management**: Ingestion status and data source health
- **Cost Tracking**: Token usage and Bedrock costs
- **Error Tracking**: Error rates and types
- **User Analytics**: Query patterns and popular topics

## Error Handling

### Common Errors
- **Knowledge Base Not Found**: Invalid or missing knowledge base ID
- **Model Unavailable**: Bedrock model not accessible
- **Content Validation Failed**: Invalid or low-quality content
- **Rate Limiting**: Bedrock API rate limits exceeded
- **Permission Denied**: Insufficient IAM permissions

### Error Responses
```json
{
  "success": false,
  "error": {
    "message": "Knowledge base query failed",
    "code": "BEDROCK_ERROR",
    "correlationId": "uuid",
    "timestamp": "2024-01-01T00:00:00Z",
    "details": {
      "modelArn": "arn:aws:bedrock:...",
      "knowledgeBaseId": "KB123456789"
    }
  }
}
```

### Recovery Strategies
- **Automatic Retry**: Transient failures with exponential backoff
- **Circuit Breaker**: Prevent cascading failures
- **Fallback Responses**: Default responses when service unavailable
- **Graceful Degradation**: Reduced functionality during outages

## Security Considerations

### Data Protection
- **Encryption**: All data encrypted in transit and at rest
- **Access Control**: Fine-grained IAM permissions
- **Data Classification**: Automatic classification of sensitive content
- **Audit Logging**: Complete audit trail of all operations

### Query Security
- **Input Validation**: Comprehensive validation of all queries
- **Content Filtering**: Prevention of harmful or inappropriate queries
- **Rate Limiting**: Protection against abuse
- **Session Management**: Secure session handling

### Compliance
- **Data Residency**: Control over data location and storage
- **Retention Policies**: Configurable data retention
- **Privacy Controls**: Support for data subject rights
- **Audit Requirements**: Comprehensive logging for compliance

## Best Practices

### Content Management
- **Regular Updates**: Keep compliance content current
- **Quality Control**: Validate content before ingestion
- **Version Control**: Track content versions and changes
- **Source Attribution**: Maintain proper citations and references

### Query Optimization
- **Context Provision**: Include relevant context in queries
- **Specific Questions**: Ask specific rather than general questions
- **Session Continuity**: Use session IDs for related queries
- **Result Validation**: Verify responses against authoritative sources

### Performance
- **Caching**: Implement response caching for common queries
- **Batch Processing**: Use batch operations for bulk ingestion
- **Resource Monitoring**: Monitor token usage and costs
- **Optimization**: Regular performance tuning and optimization

## Troubleshooting

### Common Issues

#### Knowledge Base Not Responding
- **Cause**: Knowledge base not properly configured or inactive
- **Solution**: Check knowledge base status and configuration
- **Prevention**: Implement health checks and monitoring

#### Poor Query Results
- **Cause**: Insufficient or low-quality content in knowledge base
- **Solution**: Improve content quality and coverage
- **Prevention**: Regular content audits and updates

#### High Costs
- **Cause**: Excessive token usage or inefficient queries
- **Solution**: Optimize queries and implement caching
- **Prevention**: Monitor usage and set cost alerts

#### Ingestion Failures
- **Cause**: Invalid content format or S3 access issues
- **Solution**: Validate content and check permissions
- **Prevention**: Implement content validation and testing

### Debug Mode
Enable debug logging:
```bash
export DEBUG=true
export NODE_ENV=development
```

### Log Analysis
Key log entries to monitor:
- Query processing and response generation
- Content ingestion and validation
- Error conditions and retries
- Performance metrics and token usage

## Support

### Documentation
- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [OpenSearch Serverless Guide](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless.html)
- [SOC 2 Compliance Guide](https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/aicpasoc2report.html)

### Community
- GitHub Issues for bug reports and feature requests
- Slack channel for community support
- Documentation wiki for additional examples

### Enterprise Support
- Professional services for custom compliance frameworks
- Priority support for enterprise customers
- Training and onboarding assistance
- Custom content development and curation
