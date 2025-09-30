# AI Compliance Shepherd

An AI-powered compliance assistant for AWS environments that helps organizations achieve and maintain compliance with frameworks like SOC 2, HIPAA, and GDPR.

## Overview

AI Compliance Shepherd is an autonomous AI agent that:
- Scans AWS environments and Infrastructure as Code (IaC) for compliance violations
- Explains issues in plain English with exact control citations
- Proposes or safely applies remediations
- Generates audit-ready evidence packs
- Integrates into CI/CD pipelines and ticketing tools

## Architecture

The system is built on AWS using:
- **Amazon Bedrock** for AI reasoning and natural language processing
- **Bedrock AgentCore** for autonomous agent capabilities
- **AWS Lambda** for serverless compute functions
- **Amazon DynamoDB** for data storage
- **Amazon S3** for artifact storage
- **AWS Step Functions** for workflow orchestration
- **Amazon API Gateway** for REST APIs

### Infrastructure as Code
- **AWS CDK** (Primary): Core application infrastructure with TypeScript
- **Terraform** (Modules): Cross-account roles, customer onboarding, compliance rules

## Key Features

### 🎯 Conversational Compliance Assistant
- Natural language queries about compliance status
- Plain English explanations with framework citations
- RAG-powered responses using Bedrock Knowledge Bases

### 🔍 Continuous Monitoring
- Automated environment scans for compliance violations
- Event-driven checks on infrastructure changes
- Shift-left PR reviews for Infrastructure as Code

### 🛡️ Guardrailed Remediation
- Pre-approved safe fixes with validation
- Audit trail for all remediation actions
- Integration with ticketing systems

### 📊 Audit-Ready Reporting
- Comprehensive evidence pack generation
- HTML reports with filtering and export capabilities
- Compliance metrics and trend analysis

## Project Structure

```
ai-compliance-shepherd/
├── services/                    # Lambda functions
│   ├── scan-environment/       # Environment scanning
│   ├── analyze-terraform-plan/ # IaC analysis
│   ├── apply-fix/             # Safe remediation
│   ├── generate-audit-pack/   # Evidence generation
│   └── api-gateway/           # API endpoints
├── infra/                      # Infrastructure as Code
│   ├── cdk/                   # AWS CDK definitions
│   └── terraform/             # Terraform modules
├── agent/                      # AI Agent configuration
│   ├── prompts/               # System prompts
│   ├── agentcore/             # AgentCore manifests
│   └── kb/                    # Knowledge base data
├── ui/                        # User interface
│   └── web/                   # React web application
├── integrations/              # Third-party integrations
│   ├── github/               # GitHub webhooks
│   ├── jira/                 # Jira integration
│   └── slack/                # Slack notifications
├── tests/                     # Test suites
│   ├── unit/                 # Unit tests
│   └── integration/          # Integration tests
├── scripts/                   # Utility scripts
└── docs/                      # Documentation
```

## Supported Compliance Frameworks

- **SOC 2** (Type II) - Security, Availability, Processing Integrity, Confidentiality, Privacy
- **HIPAA** - Health Insurance Portability and Accountability Act
- **GDPR** - General Data Protection Regulation

## Supported AWS Services

- Amazon S3 (encryption, public access, bucket policies)
- AWS IAM (root MFA, password policies, wildcard permissions)
- Amazon EC2 Security Groups (insecure rules)
- Amazon EBS (encryption defaults)
- AWS CloudTrail (multi-region trails, immutable logs)

## Getting Started

### Prerequisites

- Node.js 18+
- AWS CLI configured
- AWS CDK CLI installed
- Docker (for local testing)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/ai-compliance-shepherd.git
cd ai-compliance-shepherd
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Deploy infrastructure:
```bash
npm run deploy
```

### Development

```bash
# Run tests
npm test

# Build project
npm run build

# Lint code
npm run lint

# Format code
npm run format
```

## Usage

### Chat Interface

Ask questions about your compliance status:
```
"Scan production for SOC 2 issues"
"What are the high-risk findings in our AWS account?"
"Generate an audit report for Q4"
```

### API Endpoints

- `POST /chat` - Chat with the compliance assistant
- `POST /scan` - Trigger environment scan
- `GET /report/{scanId}` - Get scan report

### GitHub Integration

The system automatically reviews Terraform plans in pull requests and provides compliance feedback with suggested fixes.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue in this repository
- Check the documentation in the `docs/` folder
- Review the architecture diagrams

## Roadmap

- [ ] Cross-cloud support (Azure, GCP)
- [ ] Additional compliance frameworks (PCI DSS, ISO 27001)
- [ ] Advanced remediation workflows
- [ ] Custom compliance rules engine
- [ ] Mobile application