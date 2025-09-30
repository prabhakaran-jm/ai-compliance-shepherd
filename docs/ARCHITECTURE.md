# Architecture Overview

## System Architecture

AI Compliance Shepherd is built as a multi-tenant SaaS application on AWS with the following key components:

### Core Components

#### 1. AI Brain (Amazon Bedrock)
- **Purpose**: Natural language processing, reasoning, and decision-making
- **Components**:
  - Bedrock Nova/Sonnet/Haiku models for conversation
  - Bedrock Knowledge Bases with RAG for compliance framework data
  - Bedrock AgentCore for autonomous agent capabilities

#### 2. Lambda Services
- **scan_environment**: Read-only AWS posture assessment
- **analyze_terraform_plan**: Infrastructure as Code analysis
- **apply_fix**: Guardrailed remediation with audit logging
- **generate_audit_pack**: Evidence collection and report generation
- **api_gateway**: REST API endpoints for chat and scanning

#### 3. Data Layer
- **DynamoDB**: Tenant data, findings, actions, and audit logs
- **S3**: Reports, artifacts, and evidence packs
- **CloudWatch**: Metrics, logs, and monitoring

#### 4. Orchestration
- **Step Functions**: Workflow orchestration for complex processes
- **EventBridge**: Scheduled scans and event-driven triggers
- **API Gateway**: REST API and webhook endpoints

### Data Flow

#### 1. Environment Scan Flow
```
EventBridge (scheduled) → Step Functions → scan_environment Lambda → DynamoDB → Report Generation → S3
```

#### 2. Chat Interaction Flow
```
User → API Gateway → Bedrock AgentCore → Action Groups (Lambdas) → Response
```

#### 3. Remediation Flow
```
User Request → Validation → Dry Run → Apply Fix → Verify → Audit Log → Notification
```

### Security Architecture

#### Multi-Tenant Isolation
- Tenant-scoped KMS keys for encryption
- DynamoDB partition keys with tenant isolation
- IAM roles with least privilege access
- Cross-account assume role for customer environments

#### Data Protection
- Encryption at rest (S3, DynamoDB, EBS)
- Encryption in transit (HTTPS, TLS)
- Secrets management via AWS Secrets Manager
- Audit logging for all actions

### Compliance Frameworks

#### SOC 2 Controls (Initial Focus)
- **CC6.1**: Logical and physical access controls
- **CC6.2**: Data encryption at rest and in transit
- **CC6.3**: Network security controls
- **CC6.4**: Access monitoring and logging
- **CC6.5**: Data disposal and retention

#### Supported AWS Services
- **S3**: Encryption, public access, bucket policies
- **IAM**: Root MFA, password policies, wildcard permissions
- **EC2**: Security groups, EBS encryption
- **CloudTrail**: Multi-region trails, immutable logs

### Deployment Architecture

#### Environments
- **Development**: Full stack for testing
- **Staging**: Production-like environment
- **Production**: Multi-region deployment

#### Infrastructure as Code
- **AWS CDK**: Core application infrastructure (Lambda, API Gateway, DynamoDB, S3, Bedrock)
- **Terraform**: Cross-account roles, customer onboarding, compliance rule modules
- **GitHub Actions**: CI/CD pipeline

### Monitoring and Observability

#### Metrics
- Scan duration and success rates
- Finding counts by severity
- Remediation success rates
- API response times

#### Logging
- Structured JSON logs
- CloudWatch Logs aggregation
- X-Ray tracing for distributed systems

#### Alerting
- CloudWatch alarms for critical failures
- SNS notifications for operational issues
- Slack integration for team notifications

### Scalability Considerations

#### Horizontal Scaling
- Lambda auto-scaling
- DynamoDB on-demand billing
- S3 unlimited storage

#### Performance Optimization
- Parallel processing for large scans
- Caching for frequent queries
- Batch operations for efficiency

### Disaster Recovery

#### Backup Strategy
- DynamoDB point-in-time recovery
- S3 cross-region replication
- Configuration backup in Git

#### Recovery Procedures
- Multi-region deployment capability
- Automated failover mechanisms
- Data restoration procedures
