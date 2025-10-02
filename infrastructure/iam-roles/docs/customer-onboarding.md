# Customer Onboarding Guide - AI Compliance Shepherd Cross-Account IAM Roles

This guide provides step-by-step instructions for customers to deploy the necessary IAM roles in their AWS accounts to enable AI Compliance Shepherd access.

## Overview

AI Compliance Shepherd requires cross-account IAM roles to perform compliance scanning, remediation, and audit activities in your AWS environment. These roles are designed with least privilege principles and include multiple security controls.

## Prerequisites

### Customer Requirements
- AWS Account with administrative access
- AWS CLI installed and configured
- Terraform (recommended) or CloudFormation access
- Basic understanding of IAM roles and cross-account access

### Security Considerations
- External ID will be provided by AI Compliance Shepherd for secure access
- All role assumptions are logged and monitored
- Roles can be revoked at any time by the customer
- No persistent access credentials are stored

## Deployment Options

### Option 1: Automated Script (Recommended)

The easiest way to deploy the roles is using our automated deployment script:

```bash
# Download the deployment script
curl -o deploy-roles.sh https://scripts.compliance-shepherd.com/deploy-roles.sh
chmod +x deploy-roles.sh

# Basic deployment for STANDARD tier
./deploy-roles.sh \
  --platform-account-id 123456789012 \
  --customer-name your-company-name

# Enterprise deployment with all capabilities
./deploy-roles.sh \
  --platform-account-id 123456789012 \
  --customer-name your-company-name \
  --deployment-tier ENTERPRISE \
  --enable-iam-remediation true \
  --include-billing-data true
```

### Option 2: Terraform Deployment

For customers who prefer Infrastructure as Code:

```bash
# Clone the repository
git clone https://github.com/ai-compliance-shepherd/iam-roles.git
cd iam-roles/terraform

# Initialize Terraform
terraform init

# Create terraform.tfvars
cat > terraform.tfvars << EOF
platform_account_id = "123456789012"
customer_name = "your-company-name"
deployment_tier = "STANDARD"
# Add other variables as needed
EOF

# Plan and apply
terraform plan
terraform apply
```

### Option 3: CloudFormation Deployment

For customers who prefer AWS native tools:

```bash
# Deploy using AWS CLI
aws cloudformation create-stack \
  --stack-name ai-compliance-shepherd-roles \
  --template-url https://templates.compliance-shepherd.com/master-template.yaml \
  --parameters \
    ParameterKey=PlatformAccountId,ParameterValue=123456789012 \
    ParameterKey=CustomerName,ParameterValue=your-company-name \
    ParameterKey=DeploymentTier,ParameterValue=STANDARD \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM
```

## Deployment Tiers

### BASIC Tier
**Suitable for:** Small organizations, basic compliance monitoring

**Included Roles:**
- ✅ Compliance Scan Role (read-only resource discovery)
- ✅ Read-Only Monitoring Role (basic health checks)
- ❌ Remediation Role
- ❌ Audit Role

**Capabilities:**
- Basic compliance scanning
- Resource inventory
- Health monitoring
- Compliance dashboard

### STANDARD Tier
**Suitable for:** Most organizations, automated remediation

**Included Roles:**
- ✅ Compliance Scan Role
- ✅ Read-Only Monitoring Role
- ✅ Remediation Role (S3 and Security Groups)
- ❌ Audit Role

**Capabilities:**
- Full compliance scanning
- Automated S3 bucket remediation
- Security group remediation
- Professional reporting
- Slack notifications

### PREMIUM Tier
**Suitable for:** Large organizations, comprehensive auditing

**Included Roles:**
- ✅ Compliance Scan Role
- ✅ Read-Only Monitoring Role
- ✅ Remediation Role
- ✅ Audit Role (with billing data access)

**Capabilities:**
- All STANDARD capabilities
- Enhanced audit evidence collection
- Billing and cost data access
- Historical compliance trends
- Audit package generation

### ENTERPRISE Tier
**Suitable for:** Enterprise customers, maximum capabilities

**Included Roles:**
- ✅ All roles from PREMIUM tier
- ✅ IAM Remediation capabilities (optional)

**Capabilities:**
- All PREMIUM capabilities
- IAM policy remediation (high risk)
- Advanced security controls
- Custom compliance frameworks
- Priority support

## Role Descriptions

### Compliance Scan Role
**Purpose:** Read-only access for compliance scanning and resource discovery

**Permissions:**
- List and describe AWS resources across all services
- Read configurations, policies, and security settings
- Access CloudTrail logs for audit analysis
- No write permissions

**Session Duration:** 1 hour
**Risk Level:** Low

### Compliance Remediation Role
**Purpose:** Limited write access for automated remediation

**Permissions:**
- All scan role permissions
- S3 bucket policy and encryption management
- Security group rule modifications
- CloudFormation stack operations (approved templates only)
- IAM policy management (ENTERPRISE tier only)

**Session Duration:** 30 minutes
**Risk Level:** Medium (High with IAM remediation)

### Compliance Audit Role
**Purpose:** Enhanced read access for audit evidence collection

**Permissions:**
- All scan role permissions
- Billing and cost data access (PREMIUM+ tiers)
- Historical CloudTrail and CloudWatch data
- Config rule evaluations and compliance history
- Trusted Advisor findings

**Session Duration:** 2 hours
**Risk Level:** Low-Medium

### Read-Only Monitoring Role
**Purpose:** Minimal access for basic monitoring and health checks

**Permissions:**
- Basic resource listing and counting
- Service health status
- CloudWatch metrics (limited)
- No sensitive data access

**Session Duration:** 15 minutes
**Risk Level:** Very Low

## Security Features

### External ID Protection
- Unique external ID required for all role assumptions
- Generated automatically or provided by customer
- Must be kept confidential and secure
- Can be rotated on demand

### Session Management
- Short session durations (15 minutes to 2 hours)
- Automatic session expiration
- No persistent credentials
- All sessions logged and monitored

### Conditional Access
- IP address restrictions (configurable)
- Time-based access controls
- MFA requirements for sensitive operations
- Secure transport (HTTPS/TLS) required

### Monitoring and Alerting
- CloudWatch dashboard for role usage
- EventBridge rules for assumption monitoring
- SNS alerts for unusual activity
- CloudTrail logging for all actions

## Validation and Testing

### Post-Deployment Validation

1. **Test Role Assumption:**
```bash
# Test scan role
aws sts assume-role \
  --role-arn arn:aws:iam::YOUR-ACCOUNT:role/AIComplianceShepherd-YourCompany-ScanRole \
  --role-session-name test-session \
  --external-id YOUR-EXTERNAL-ID
```

2. **Verify Permissions:**
```bash
# Test S3 listing (should work)
aws s3 ls

# Test S3 write (should fail for scan role)
aws s3 cp test.txt s3://test-bucket/
```

3. **Check Monitoring:**
- View CloudWatch dashboard
- Verify EventBridge rules
- Test SNS notifications

### Common Validation Issues

**Role Assumption Fails:**
- Verify external ID is correct
- Check trust policy configuration
- Ensure platform account ID is accurate

**Permission Denied Errors:**
- Verify role has required policies attached
- Check policy conditions and restrictions
- Ensure resource ARNs are accessible

**Monitoring Not Working:**
- Verify CloudTrail is enabled
- Check EventBridge rule configuration
- Ensure SNS topic permissions are correct

## Maintenance and Updates

### Regular Maintenance Tasks

1. **Monthly Reviews:**
   - Review role usage in CloudWatch dashboard
   - Audit role assumptions and activities
   - Check for any unusual access patterns

2. **Quarterly Updates:**
   - Update role policies if needed
   - Review and rotate external ID
   - Validate security controls

3. **Annual Audits:**
   - Comprehensive permission review
   - Security assessment
   - Compliance validation

### Policy Updates

AI Compliance Shepherd may occasionally update role policies to:
- Add support for new AWS services
- Enhance security controls
- Improve compliance coverage
- Fix security vulnerabilities

Customers will be notified of policy updates with:
- 30 days advance notice for non-security updates
- Immediate notification for security fixes
- Clear documentation of changes
- Migration assistance if needed

## Troubleshooting

### Common Issues and Solutions

**1. Role Assumption Timeout**
```
Error: The security token included in the request is invalid
```
**Solution:** Check external ID and ensure it matches exactly

**2. Permission Denied**
```
Error: User is not authorized to perform: action on resource
```
**Solution:** Verify role has required policies and conditions are met

**3. Session Duration Exceeded**
```
Error: The requested DurationSeconds exceeds the MaxSessionDuration
```
**Solution:** Reduce session duration or update role configuration

**4. IP Address Restriction**
```
Error: Request does not satisfy IP address condition
```
**Solution:** Update IP restrictions or connect from allowed IP range

### Getting Help

**Documentation:** https://docs.compliance-shepherd.com/iam-roles
**Support Email:** support@compliance-shepherd.com
**Emergency Contact:** +1-800-COMPLIANCE
**Status Page:** https://status.compliance-shepherd.com

## Security Best Practices

### For Customers

1. **Protect External ID:**
   - Store securely (password manager, secrets vault)
   - Don't share via email or chat
   - Rotate regularly (quarterly recommended)

2. **Monitor Usage:**
   - Review CloudWatch dashboard weekly
   - Set up alerts for unusual activity
   - Audit role assumptions monthly

3. **Principle of Least Privilege:**
   - Start with BASIC tier if unsure
   - Only enable IAM remediation if absolutely needed
   - Regularly review and remove unused permissions

4. **Network Security:**
   - Configure IP restrictions if possible
   - Use VPN or private connectivity
   - Monitor network access patterns

### For AI Compliance Shepherd

1. **Secure Role Assumption:**
   - Always use external ID
   - Short session durations
   - Comprehensive logging

2. **Data Protection:**
   - Encrypt data in transit and at rest
   - No persistent credential storage
   - Regular security assessments

3. **Compliance:**
   - SOC 2 Type II certified
   - GDPR compliant
   - Regular third-party audits

## Compliance Frameworks

The deployed roles support compliance scanning and evidence collection for:

- **SOC 2 Type I & II:** Trust Services Criteria
- **HIPAA:** Administrative, Physical, and Technical Safeguards
- **GDPR:** Data Protection and Privacy Requirements
- **PCI DSS:** Payment Card Industry Standards
- **ISO 27001:** Information Security Management
- **NIST Cybersecurity Framework:** Core Functions
- **CIS Controls:** Critical Security Controls

## Cost Considerations

### AWS Costs
- IAM roles and policies: No additional cost
- CloudWatch dashboard: ~$3/month
- CloudTrail logging: Based on API call volume
- EventBridge rules: Minimal cost
- SNS notifications: Based on message volume

### Typical Monthly Costs
- **BASIC Tier:** $5-15/month
- **STANDARD Tier:** $10-30/month
- **PREMIUM Tier:** $15-50/month
- **ENTERPRISE Tier:** $20-75/month

*Costs vary based on AWS usage and monitoring configuration*

## Next Steps

After successful role deployment:

1. **Platform Configuration:**
   - Provide role ARNs to AI Compliance Shepherd
   - Share external ID securely
   - Configure notification preferences

2. **Initial Scan:**
   - Schedule first compliance scan
   - Review findings and recommendations
   - Set up automated remediation (if enabled)

3. **Team Setup:**
   - Configure Slack notifications
   - Set up user accounts and permissions
   - Train team on platform usage

4. **Ongoing Operations:**
   - Regular compliance monitoring
   - Automated remediation workflows
   - Periodic audit package generation

---

**Need Help?** Contact our customer success team at success@compliance-shepherd.com for personalized onboarding assistance.
