# AI Compliance Shepherd - Terraform Modules

This directory contains Terraform modules for automating customer onboarding to the AI Compliance Shepherd platform. These modules provide infrastructure-as-code solutions for setting up cross-account roles, monitoring, and tenant configuration.

## Overview

The Terraform modules enable customers to:
- **Automated Onboarding**: Set up complete customer environment with infrastructure-as-code
- **Cross-Account Access**: Create secure IAM roles for scanning customer AWS accounts
- **Monitoring Integration**: Set up CloudWatch dashboards, alarms, and logging
- **Multi-Tenant Security**: Ensure proper isolation between customers
- **Compliance Configuration**: Configure scan schedules, retention policies, and notification settings

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Customer AWS Account                         │
├─────────────────────────────────────────────────────────────────┤
│  IAM Roles Module         │  Monitoring Module                  │
│  ┌─────────────────┐     │  ┌─────────────────────────────┐    │
│  │ Scan Role       │     │  │ CloudWatch Dashboard        │    │
│  │ Read-only Role  │     │  │ CloudWatch Alarms          │    │
│  │ Remediation     │     │  │ Log Groups                  │    │
│  │ Audit Role      │     │  │ SNS Topics                  │    │
│  └─────────────────┘     │  └─────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│                       Main Module                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                  Tenant Configuration                    │  │
│  │                                                         │  │
│  │  • DynamoDB Tenant Records                              │  │
│  │  • KMS Encryption Keys                                  │  │
│  │  • Notification Topics                                 │  │
│  │  • EventBridge Schedules                                │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Cross-Account Trust
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                AI Compliance Shepherd Service                   │
│                (Account ID: 987654321098)                       │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

1. **Terraform**: Version 1.0 or higher
2. **AWS Credentials**: Configured for customer account
3. **Service Account ID**: Available from AI Compliance Shepherd team
4. **Customer Information**: Account ID, name, email, tier

### Basic Customer Onboarding

```bash
# Clone or download the terraform modules
mkdir customer-onboarding
cd customer-onboarding

# Create terraform configuration
cat > main.tf << 'EOF'
module "customer_onboarding" {
  source = "path/to/terraform-modules"
  
  customer_account_id = "123456789012"
  service_account_id   = "987654321098"  # AI Compliance Shepherd account
  customer_name        = "Your Company"
  customer_email       = "security@yourcompany.com"
  customer_tier        = "STANDARD"
  
  tags = {
    Environment = "production"
    Project     = "compliance"
  }
}

output "setup_summaries" {
  value = {
    scan_role_arn    = module.customer_onboarding.cross_account_role_arn
    tenant_id        = module.customer_onboarding.customer_tenant_id
    validation_url   = module.customer_onboarding.validation_endpoint
  }
}
EOF

# Initialize and deploy
terraform init
terraform plan
terraform apply
```

### Enterprise Customer Setup

```bash
# Enterprise customers with advanced features
cat > enterprise.tf << 'EOF'
module "enterprise_customer" {
  source = "../.."
  
  customer_account_id = "123456789012"
  service_account_id   = "987654321098"
  customer_name        = "Enterprise Corp"
  customer_email       = "ciso@enterprise.com"
  customer_tier        = "ENTERPRISE"
  
  # Advanced features
  allowed_regions = ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"]
  enable_auto_remediation = true
  scan_schedule_expression = "rate(6 hours)"
  log_retention_days     = 365
  
  # Notifications
  slack_webhook_url = "https://hooks.slack.com/services/xxx/yyy/zzz"
  github_repositories = ["org/repo1", "org/repo2"]
  
  tags = {
    Environment        = "production"
    ComplianceFramework = "SOC2,GDPR"
    DataClassification = "confidential"
  }
}
EOF

terraform init
terraform apply
```

## Module Reference

### Main Module

The main module creates:
- Customer-specific DynamoDB tenant configuration
- KMS encryption keys with proper policies
- SNS notification topics
- CloudWatch log groups
- Complete IAM role hierarchy

#### Variables

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| customer_account_id | Customer AWS Account ID | string | n/a | yes |
| service_account_id | AI Compliance Shepherd service account ID | string | n/a | yes |
| customer_name | Customer organization name | string | n/a | yes |
| customer_email | Customer contact email | string | n/a | yes |
| customer_tier | Subscription tier (BASIC/STANDARD/PREMIUM/ENTERPRISE) | string | "STANDARD" | no |
| allowed_regions | AWS regions allowed for scanning | list(string) | ["us-east-1", "us-west-2", "eu-west-1"] | no |
| enable_auto_remediation | Enable automated remediation | bool | false | no |
| scan_schedule_expression | CloudWatch Events schedule for scans | string | "rate(24 hours)" | no |

#### Outputs

| Name | Description |
|------|-------------|
| cross_account_role_arn | ARN of the main scanning role |
| customer_tenant_id | Unique tenant identifier |
| external_id | External ID for secure access (sensitive) |
| validation_endpoint | URL for testing customer setup |
| next_steps | Instructions for completing onboarding |

### IAM Roles Module

Creates secure cross-account roles with least-privilege permissions:

- **Scan Role**: Read-only access for compliance scanning
- **Read-only Role**: Limited access for dashboard monitoring  
- **Remediation Role**: Write access for automated fixes (conditional)
- **Audit Role**: Enhanced access for evidence collection
- **GitHub Integration Role**: Special permissions for repository access

### Monitoring Module

Sets up comprehensive monitoring infrastructure:

- **CloudWatch Dashboard**: Real-time compliance overview
- **Alarms**: Automated alerts for critical events
- **Log Groups**: Centralized logging with encryption
- **Event Rules**: Scheduled scan triggers
- **SNS Topics**: Notification delivery

## Customer Tiers

### BASIC ($99/month)
- Up to 1,000 resources per scan
- 24-hour scan frequency
- 7-day retention
- Basic compliance checks
- Email support

### STANDARD ($499/month)
- Up to 10,000 resources per scan  
- 12-hour scan frequency
- 30-day retention
- Extended compliance checks
- Slack notifications
- Priority support

### PREMIUM ($1,999/month)
- Up to 50,000 resources per scan
- 6-hour scan frequency
- 90-day retention
- All compliance services
- GitHub integration
- Advanced analytics

### ENTERPRISE (Custom pricing)
- Unlimited resources
- Hourly scans
- 365-day retention
- All features + custom rules
- API integration
- Dedicated support
- Custom onboarding

## Security Features

### Encryption
- Customer-specific KMS keys
- Encryption at rest and in transit
- Automatic key rotation
- Multi-region key support

### Access Control
- Least-privilege IAM roles
- Permission boundaries
- External ID validation
- Region-restricted access
- IP-based restrictions

### Audit Trail
- CloudTrail integration
- Comprehensive logging
- Immutable audit records
- Automated compliance reporting

## Post-Deployment Steps

After successful Terraform deployment:

1. **Validate Setup**
   ```bash
   curl "https://api.ai-compliance-shepherd.com/v1/onboarding/validate/{tenant_id}"
   ```

2. **Configure Notifications**
   - Add Slack webhook URL
   - Set up GitHub repository integration
   - Configure notification preferences

3. **Test Scanning**
   - Trigger initial compliance scan
   - Review scan results in dashboard
   - Configure remediation workflows

4. **Setup Monitoring**
   - Configure CloudWatch alarms
   - Set up custom dashboards
   - Test notification channels

## Troubleshooting

### Common Issues

**1. Terraform Apply Fails**
```bash
# Check AWS credentials
aws sts get-caller-identity

# Validate account ID format
terraform validate

# Check permissions
aws iam list-attached-role-policies --role-name YourRole
```

**2. Cross-Account Trust Fails**
```bash
# Verify service account ID
aws sts get-caller-identity --query Account --output text

# Check external ID format
terraform output external_id

# Validate trust policy
aws iam get-role --role-name compliance-scan-*
```

**3. Monitoring Setup Issues**
```bash
# Check CloudWatch permissions
aws logs describe-log-groups --log-group-name-prefix "/aws/compliance-shepherd"

# Validate SNS topics
aws sns list-topics | grep compliance-shepherd

# Check alarm configuration
aws cloudwatch describe-alarms --alarm-names compliance-shepherd-*
```

## Support

### Documentation
- [Deployment Guide](../docs/deployment-guide.md)
- [Architecture Overview](../docs/architecture-overview.md)
- [API Reference](../docs/architecture/api-reference.md)

### Contact
- **Enterprise Support**: enterprise-support@ai-compliance-shepherd.com
- **Technical Issues**: support@ai-compliance-shepherd.com
- **Security Concerns**: security@ai-compliance-shepherd.com

### Community
- GitHub Issues: [Report bugs or request features](https://github.com/prabhakaran-jm/ai-compliance-shepherd/issues)
- Documentation: [Wiki and guides](https://github.com/prabhakaran-jm/ai-compliance-shepherd/wiki)

## License

All Terraform modules are released under the MIT License. See [LICENSE](../../LICENSE) for details.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.
