# Cross-Account IAM Roles for AI Compliance Shepherd

This directory contains IAM role definitions and policies for secure cross-account access to customer AWS environments. These roles implement least privilege principles and enable the AI Compliance Shepherd platform to perform compliance scanning and remediation across customer accounts.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cross-Account IAM Architecture               │
└─────────────────────────────────────────────────────────────────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
         ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
         │Platform │ │Customer │ │Customer │
         │Account  │ │Account A│ │Account B│
         │(SaaS)   │ │         │ │         │
         └─────────┘ └─────────┘ └─────────┘
              │           │           │
              │    ┌──────▼──────┐    │
              │    │Cross-Account│    │
              │    │IAM Roles    │    │
              │    │             │    │
              │    │• ScanRole   │    │
              │    │• FixRole    │    │
              │    │• ReadRole   │    │
              └────┤• AuditRole  ├────┘
                   └─────────────┘
```

## Role Types

### 1. ComplianceScanRole
**Purpose**: Read-only access for compliance scanning and resource discovery
**Permissions**: 
- List and describe AWS resources
- Read configurations and policies
- Access CloudTrail logs
- No write permissions

### 2. ComplianceRemediationRole
**Purpose**: Limited write access for automated remediation
**Permissions**:
- Specific remediation actions (S3 bucket policies, security groups, etc.)
- Create and manage compliance-related resources
- CloudFormation stack operations for approved templates
- Requires approval workflow for sensitive operations

### 3. ComplianceAuditRole
**Purpose**: Enhanced read access for audit evidence collection
**Permissions**:
- All scan permissions plus
- Access to billing and cost data
- CloudTrail event history
- Config rule evaluations
- Trusted Advisor findings

### 4. ComplianceReadOnlyRole
**Purpose**: Minimal read access for basic monitoring
**Permissions**:
- Basic resource listing
- Health checks
- Status monitoring
- No sensitive data access

## Security Features

### Least Privilege Implementation
- **Granular Permissions**: Each role has only the minimum permissions required
- **Resource-Level Restrictions**: Policies restrict access to specific resources when possible
- **Condition-Based Access**: Time-based, IP-based, and MFA conditions
- **Regular Rotation**: Automated credential rotation and policy updates

### Cross-Account Security
- **External ID Requirements**: Unique external IDs for each customer
- **Assume Role Conditions**: Strict conditions on who can assume roles
- **Session Duration Limits**: Short-lived sessions with automatic expiration
- **Audit Logging**: All role assumptions and actions are logged

### Compliance Controls
- **SOC 2 Compliance**: Roles designed to meet SOC 2 requirements
- **HIPAA Compatibility**: Additional restrictions for healthcare customers
- **GDPR Considerations**: Data access controls for EU customers
- **PCI DSS Support**: Enhanced security for payment processing environments

## Implementation Strategy

### Phase 1: Core Scanning Roles
1. Deploy ComplianceScanRole to customer accounts
2. Implement external ID validation
3. Set up cross-account trust relationships
4. Test resource discovery and scanning

### Phase 2: Remediation Capabilities
1. Deploy ComplianceRemediationRole with approval workflows
2. Implement safety guardrails and rollback mechanisms
3. Create remediation templates and policies
4. Test automated fix applications

### Phase 3: Audit and Advanced Features
1. Deploy ComplianceAuditRole for evidence collection
2. Implement enhanced logging and monitoring
3. Create audit trail aggregation
4. Test complete audit package generation

## Customer Onboarding Process

### Automated Deployment
```bash
# Customer runs this CloudFormation template in their account
aws cloudformation create-stack \
  --stack-name ai-compliance-shepherd-roles \
  --template-url https://templates.compliance-shepherd.com/iam-roles.yaml \
  --parameters ParameterKey=ExternalId,ParameterValue=unique-customer-id \
               ParameterKey=PlatformAccountId,ParameterValue=123456789012 \
  --capabilities CAPABILITY_IAM
```

### Manual Verification
1. Customer verifies role creation
2. Platform tests cross-account access
3. Initial compliance scan validates permissions
4. Customer approves remediation capabilities (optional)

## Monitoring and Compliance

### Continuous Monitoring
- **Role Usage Tracking**: Monitor all role assumptions and actions
- **Permission Drift Detection**: Alert on unauthorized policy changes
- **Access Pattern Analysis**: Detect unusual access patterns
- **Compliance Validation**: Regular checks against security baselines

### Alerting and Response
- **Failed Assumptions**: Alert on failed role assumption attempts
- **Privilege Escalation**: Detect attempts to expand permissions
- **Unusual Activity**: Flag abnormal resource access patterns
- **Policy Changes**: Notify on any role or policy modifications

## Files Structure

```
infrastructure/iam-roles/
├── README.md                           # This documentation
├── cloudformation/                     # CloudFormation templates
│   ├── compliance-scan-role.yaml      # Read-only scanning role
│   ├── compliance-remediation-role.yaml # Limited write access
│   ├── compliance-audit-role.yaml     # Enhanced audit access
│   ├── compliance-readonly-role.yaml  # Minimal monitoring access
│   └── master-template.yaml           # All roles deployment
├── terraform/                         # Terraform modules
│   ├── modules/                       # Reusable modules
│   │   ├── scan-role/                 # Scanning role module
│   │   ├── remediation-role/          # Remediation role module
│   │   ├── audit-role/                # Audit role module
│   │   └── readonly-role/             # Read-only role module
│   ├── environments/                  # Environment-specific configs
│   │   ├── production/                # Production deployment
│   │   ├── staging/                   # Staging deployment
│   │   └── development/               # Development deployment
│   └── main.tf                        # Main Terraform configuration
├── policies/                          # IAM policy documents
│   ├── scan-policies/                 # Scanning permissions
│   ├── remediation-policies/          # Remediation permissions
│   ├── audit-policies/                # Audit permissions
│   └── shared-policies/               # Common policies
├── scripts/                           # Deployment and management scripts
│   ├── deploy-roles.sh               # Automated deployment
│   ├── validate-permissions.sh       # Permission validation
│   ├── rotate-credentials.sh         # Credential rotation
│   └── cleanup-roles.sh              # Role cleanup
├── tests/                            # Testing and validation
│   ├── integration/                  # Integration tests
│   ├── security/                     # Security validation
│   └── compliance/                   # Compliance checks
└── docs/                             # Additional documentation
    ├── customer-onboarding.md        # Customer setup guide
    ├── security-controls.md          # Security implementation
    ├── troubleshooting.md           # Common issues and solutions
    └── api-reference.md             # API documentation
```

## Security Best Practices

### Role Design Principles
1. **Principle of Least Privilege**: Grant only necessary permissions
2. **Defense in Depth**: Multiple layers of security controls
3. **Zero Trust**: Verify every access request
4. **Continuous Monitoring**: Real-time security monitoring
5. **Regular Auditing**: Periodic permission reviews

### Implementation Guidelines
1. **Use Managed Policies**: Leverage AWS managed policies when appropriate
2. **Resource-Level Permissions**: Restrict access to specific resources
3. **Condition Keys**: Use condition keys for additional security
4. **Session Policies**: Apply additional restrictions during role assumption
5. **Regular Updates**: Keep policies updated with latest security practices

## Compliance Frameworks

### SOC 2 Requirements
- **CC6.1**: Logical access controls
- **CC6.2**: Authentication and authorization
- **CC6.3**: Network security
- **CC6.7**: Data transmission controls
- **CC6.8**: System monitoring

### HIPAA Considerations
- **Administrative Safeguards**: Access management procedures
- **Physical Safeguards**: Workstation and media controls
- **Technical Safeguards**: Access control and audit controls
- **Breach Notification**: Incident response procedures

### GDPR Compliance
- **Data Minimization**: Access only necessary data
- **Purpose Limitation**: Use data only for stated purposes
- **Storage Limitation**: Retain data only as long as necessary
- **Security of Processing**: Implement appropriate security measures

## Troubleshooting

### Common Issues
1. **Role Assumption Failures**: Check external ID and trust policies
2. **Permission Denied**: Verify policy attachments and conditions
3. **Cross-Account Access**: Validate account IDs and trust relationships
4. **Session Expiration**: Check session duration limits

### Diagnostic Commands
```bash
# Test role assumption
aws sts assume-role \
  --role-arn arn:aws:iam::CUSTOMER-ACCOUNT:role/ComplianceScanRole \
  --role-session-name test-session \
  --external-id unique-customer-id

# Validate permissions
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::CUSTOMER-ACCOUNT:role/ComplianceScanRole \
  --action-names s3:ListBucket \
  --resource-arns arn:aws:s3:::example-bucket
```

## Support and Maintenance

### Regular Maintenance Tasks
1. **Policy Updates**: Review and update policies quarterly
2. **Permission Audits**: Audit role permissions monthly
3. **Access Reviews**: Review role usage weekly
4. **Security Scans**: Automated security scanning daily

### Support Contacts
- **Security Team**: security@compliance-shepherd.com
- **Platform Team**: platform@compliance-shepherd.com
- **Customer Success**: success@compliance-shepherd.com
- **Emergency**: emergency@compliance-shepherd.com

---

This IAM role architecture provides secure, scalable, and compliant cross-account access for the AI Compliance Shepherd platform while maintaining strict security boundaries and implementing industry best practices.
