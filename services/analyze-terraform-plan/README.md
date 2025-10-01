# Terraform Plan Analyzer Lambda Function

A comprehensive Terraform plan analyzer for Infrastructure as Code (IaC) shift-left scanning, compliance validation, security analysis, and cost optimization.

## Overview

The Terraform Plan Analyzer Lambda function provides comprehensive analysis of Terraform plans before infrastructure is deployed, including:

- **Compliance Analysis**: Validates against SOC 2, HIPAA, GDPR, and other frameworks
- **Security Analysis**: Identifies security vulnerabilities and misconfigurations
- **Cost Analysis**: Optimizes infrastructure costs and identifies savings opportunities
- **Plan Parsing**: Supports both JSON and binary Terraform plan formats
- **Findings Processing**: Deduplicates, categorizes, and prioritizes findings
- **Export Capabilities**: Exports findings in JSON, CSV, and Markdown formats

## Architecture

```
Terraform Plan Analyzer Lambda
├── Terraform Plan Parser
│   ├── JSON Plan Parsing
│   ├── Binary Plan Parsing
│   └── Plan Validation
├── Compliance Analyzer
│   ├── SOC 2 Compliance Rules
│   ├── HIPAA Compliance Rules
│   ├── GDPR Compliance Rules
│   └── Custom Framework Support
├── Security Analyzer
│   ├── Encryption Security Rules
│   ├── Access Control Rules
│   ├── Network Security Rules
│   └── Data Protection Rules
├── Cost Analyzer
│   ├── Resource Cost Calculation
│   ├── Optimization Opportunities
│   ├── Savings Recommendations
│   └── Pricing Data Integration
├── Findings Processor
│   ├── Deduplication
│   ├── Severity Mapping
│   ├── Evidence Collection
│   └── Export Generation
└── Utilities
    ├── Logger
    ├── Error Handler
    └── Validation Helpers
```

## API Endpoints

### Analyze Terraform Plan
```http
POST /analyze
Content-Type: application/json
Authorization: Bearer <token>

{
  "planData": "base64-encoded-terraform-plan",
  "planFormat": "json",
  "repositoryUrl": "https://github.com/org/repo",
  "branch": "main",
  "commitHash": "abc123",
  "pullRequestId": "123",
  "scanOptions": {
    "includeSecurityChecks": true,
    "includeComplianceChecks": true,
    "includeCostAnalysis": true,
    "frameworks": ["SOC2", "HIPAA", "GDPR"],
    "severityThreshold": "medium"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysisId": "tf-analysis-1704067200000-abc123",
    "status": "completed",
    "summary": {
      "totalResources": 15,
      "resourcesToCreate": 10,
      "resourcesToUpdate": 3,
      "resourcesToDelete": 2,
      "complianceScore": 85.5,
      "securityScore": 92.0,
      "costImpact": 250.0,
      "findingsCount": 8
    },
    "findingsCount": 8,
    "complianceScore": 85.5,
    "securityScore": 92.0,
    "costImpact": 250.0,
    "analyzedAt": "2024-01-01T10:00:00Z"
  }
}
```

### Get Analysis Result
```http
GET /analyses/{analysisId}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysisId": "tf-analysis-1704067200000-abc123",
    "status": "completed",
    "summary": {
      "totalResources": 15,
      "resourcesToCreate": 10,
      "resourcesToUpdate": 3,
      "resourcesToDelete": 2,
      "complianceScore": 85.5,
      "securityScore": 92.0,
      "costImpact": 250.0,
      "findingsCount": 8
    },
    "findings": [
      {
        "id": "s3-encryption-required-aws_s3_bucket.test",
        "type": "compliance",
        "severity": "high",
        "title": "S3 Bucket Encryption Required",
        "description": "S3 buckets must have server-side encryption enabled",
        "resource": "aws_s3_bucket.test",
        "rule": "s3-encryption-required",
        "recommendation": "Enable server-side encryption on S3 bucket",
        "evidence": {
          "resourceType": "aws_s3_bucket",
          "resourceAddress": "aws_s3_bucket.test",
          "frameworks": ["SOC2", "HIPAA", "GDPR"],
          "controls": ["CC6.1", "164.312(a)(2)(iv)", "Art. 32"],
          "rule": "s3-encryption-required"
        },
        "framework": "SOC2",
        "control": "CC6.1"
      }
    ],
    "resources": [
      {
        "address": "aws_s3_bucket.test",
        "type": "aws_s3_bucket",
        "name": "test",
        "change": "create",
        "configuration": {
          "bucket": "test-bucket"
        },
        "complianceStatus": "non-compliant",
        "securityStatus": "insecure",
        "costImpact": 25.0
      }
    ],
    "metadata": {
      "analyzedAt": "2024-01-01T10:00:00Z",
      "planFormat": "json",
      "terraformVersion": "1.0.0",
      "repositoryUrl": "https://github.com/org/repo",
      "branch": "main",
      "commitHash": "abc123",
      "pullRequestId": "123"
    }
  }
}
```

### List Analyses
```http
GET /analyses?limit=10&offset=0&status=completed&repositoryUrl=https://github.com/org/repo
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analyses": [
      {
        "analysisId": "tf-analysis-1704067200000-abc123",
        "status": "completed",
        "summary": {
          "totalResources": 15,
          "findingsCount": 8,
          "complianceScore": 85.5,
          "securityScore": 92.0,
          "costImpact": 250.0
        },
        "metadata": {
          "analyzedAt": "2024-01-01T10:00:00Z",
          "repositoryUrl": "https://github.com/org/repo",
          "branch": "main",
          "commitHash": "abc123"
        }
      }
    ],
    "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 1,
      "hasMore": false
    }
  }
}
```

### Delete Analysis
```http
DELETE /analyses/{analysisId}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Analysis deleted successfully"
}
```

## Compliance Frameworks

### SOC 2
- **CC6.1**: Logical and physical access controls
- **CC6.2**: System access controls
- **CC6.3**: Data protection controls
- **CC6.4**: Encryption controls
- **CC6.5**: Network security controls

### HIPAA
- **164.312(a)(2)(i)**: Access control
- **164.312(a)(2)(iv)**: Encryption
- **164.312(b)**: Audit controls
- **164.312(c)(1)**: Integrity controls
- **164.312(e)(1)**: Transmission security

### GDPR
- **Art. 32**: Security of processing
- **Art. 25**: Data protection by design
- **Art. 30**: Records of processing activities
- **Art. 33**: Breach notification
- **Art. 35**: Data protection impact assessment

## Security Analysis Categories

### Encryption
- S3 bucket encryption
- EBS volume encryption
- RDS instance encryption
- Lambda environment variable encryption
- CloudTrail log encryption

### Access Control
- IAM policy wildcard restrictions
- Root user access restrictions
- Public S3 bucket access
- RDS public access
- Security group open ports

### Network Security
- EC2 public IP restrictions
- ELB insecure listeners
- Security group configurations
- VPC security settings
- Network ACL configurations

### Data Protection
- S3 versioning requirements
- RDS backup retention
- Lambda environment variable protection
- CloudTrail log validation
- Data lifecycle management

## Cost Optimization

### Compute Resources
- EC2 instance sizing optimization
- Reserved Instance opportunities
- Lambda memory optimization
- Auto Scaling group optimization
- Spot Instance opportunities

### Storage Resources
- S3 storage class optimization
- EBS volume type optimization
- RDS storage optimization
- CloudFront cache optimization
- Data lifecycle management

### Network Resources
- Load balancer optimization
- CloudFront distribution optimization
- VPC endpoint optimization
- NAT Gateway optimization
- Data transfer optimization

### Database Resources
- RDS instance sizing
- Multi-AZ deployment optimization
- Read replica optimization
- Backup retention optimization
- Performance Insights optimization

## Plan Parsing

### Supported Formats
- **JSON**: Terraform plan in JSON format
- **Binary**: Terraform plan in binary format (requires conversion)

### Plan Structure
```json
{
  "format_version": "1.0",
  "terraform_version": "1.0.0",
  "resource_changes": [
    {
      "address": "aws_s3_bucket.test",
      "type": "aws_s3_bucket",
      "name": "test",
      "change": {
        "actions": ["create"],
        "after": {
          "bucket": "test-bucket"
        }
      }
    }
  ],
  "configuration": {
    "provider_config": {},
    "root_module": {
      "resources": [],
      "module_calls": {},
      "child_modules": []
    }
  }
}
```

### Plan Validation
- Format version validation
- Terraform version validation
- Resource changes validation
- Configuration validation
- Metadata validation

## Findings Processing

### Deduplication
- Resource-based deduplication
- Rule-based deduplication
- Evidence-based deduplication
- Severity-based prioritization

### Severity Mapping
- **Critical**: Immediate action required
- **High**: Action required within 24 hours
- **Medium**: Action required within 1 week
- **Low**: Action required within 1 month

### Evidence Collection
- Resource configuration details
- Rule violation evidence
- Compliance framework mapping
- Security category classification
- Cost impact calculation

### Export Formats
- **JSON**: Structured data format
- **CSV**: Spreadsheet-compatible format
- **Markdown**: Human-readable format

## Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012

# Application Configuration
VERSION=1.0.0
ENVIRONMENT=production
LOG_DESTINATION=cloudwatch

# Analysis Configuration
DEFAULT_FRAMEWORKS=SOC2,HIPAA,GDPR
DEFAULT_SEVERITY_THRESHOLD=medium
ENABLE_COST_ANALYSIS=true
ENABLE_SECURITY_CHECKS=true
ENABLE_COMPLIANCE_CHECKS=true

# Storage Configuration
ANALYSIS_STORAGE_BUCKET=compliance-shepherd-analyses
ANALYSIS_STORAGE_TABLE=terraform-analyses
```

## Development

### Prerequisites
- Node.js 18+
- TypeScript 5+
- AWS CLI configured
- npm or yarn

### Installation
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

### Local Development
```bash
# Watch mode for development
npm run watch

# Run tests in watch mode
npm run test:watch
```

### Testing
The test suite includes:
- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end workflow testing
- **Mock Testing**: AWS SDK and external service mocking
- **Security Testing**: Security rule validation
- **Performance Testing**: Plan parsing performance

### Deployment
```bash
# Package for deployment
npm run package

# Deploy using AWS CLI or CDK
aws lambda update-function-code \
  --function-name analyze-terraform-plan \
  --zip-file fileb://analyze-terraform-plan.zip
```

## Usage Examples

### Basic Analysis
```bash
# Analyze a Terraform plan
curl -X POST https://api.example.com/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "planData": "base64-encoded-plan",
    "planFormat": "json",
    "scanOptions": {
      "includeSecurityChecks": true,
      "includeComplianceChecks": true,
      "includeCostAnalysis": true,
      "frameworks": ["SOC2", "HIPAA", "GDPR"],
      "severityThreshold": "medium"
    }
  }'
```

### Get Analysis Results
```bash
# Get analysis results
curl -X GET https://api.example.com/analyses/tf-analysis-123 \
  -H "Authorization: Bearer <token>"
```

### List Analyses
```bash
# List analyses
curl -X GET "https://api.example.com/analyses?limit=10&offset=0" \
  -H "Authorization: Bearer <token>"
```

### Export Findings
```bash
# Export findings to CSV
curl -X GET https://api.example.com/analyses/tf-analysis-123/export?format=csv \
  -H "Authorization: Bearer <token>"
```

## Integration

### CI/CD Pipeline Integration
```yaml
# GitHub Actions example
name: Terraform Plan Analysis
on:
  pull_request:
    paths:
      - 'terraform/**'

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Generate Terraform Plan
        run: |
          cd terraform
          terraform init
          terraform plan -out=plan.tfplan
          terraform show -json plan.tfplan > plan.json
      - name: Analyze Plan
        run: |
          curl -X POST ${{ secrets.ANALYZER_API_URL }}/analyze \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.ANALYZER_API_KEY }}" \
            -d "{
              \"planData\": \"$(base64 -w 0 plan.json)\",
              \"planFormat\": \"json\",
              \"repositoryUrl\": \"${{ github.server_url }}/${{ github.repository }}\",
              \"branch\": \"${{ github.head_ref }}\",
              \"commitHash\": \"${{ github.sha }}\",
              \"pullRequestId\": \"${{ github.event.pull_request.number }}\"
            }"
```

### Terraform Provider Integration
```hcl
# Terraform provider example
resource "null_resource" "plan_analysis" {
  triggers = {
    plan_hash = filemd5("${path.module}/plan.json")
  }

  provisioner "local-exec" {
    command = <<-EOT
      curl -X POST ${var.analyzer_api_url}/analyze \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${var.analyzer_api_key}" \
        -d '{
          "planData": "$(base64 -w 0 ${path.module}/plan.json)",
          "planFormat": "json",
          "scanOptions": {
            "includeSecurityChecks": true,
            "includeComplianceChecks": true,
            "includeCostAnalysis": true,
            "frameworks": ["SOC2", "HIPAA", "GDPR"],
            "severityThreshold": "medium"
          }
        }'
    EOT
  }
}
```

## Troubleshooting

### Common Issues

1. **Plan Parsing Failures**
   - Check plan format (JSON vs binary)
   - Verify plan data encoding
   - Ensure plan is valid Terraform output

2. **Analysis Failures**
   - Check resource type support
   - Verify scan options configuration
   - Ensure sufficient permissions

3. **Storage Issues**
   - Verify S3 bucket permissions
   - Check DynamoDB table configuration
   - Ensure proper IAM roles

4. **Performance Issues**
   - Monitor Lambda memory usage
   - Check plan size limits
   - Optimize analysis rules

### Debug Mode
Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

This will provide detailed information about:
- Plan parsing process
- Analysis rule execution
- Findings processing
- Error details and stack traces

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new functionality
3. Update documentation for API changes
4. Ensure all tests pass before submitting
5. Use conventional commit messages

## License

This project is licensed under the MIT License - see the LICENSE file for details.
