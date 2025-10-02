# AI Compliance Shepherd - Terraform Outputs for Cross-Account IAM Roles

# Deployment Summary
output "deployment_summary" {
  description = "Summary of deployed roles and capabilities"
  value = {
    customer_name    = var.customer_name
    deployment_tier  = var.deployment_tier
    platform_account = var.platform_account_id
    external_id     = local.external_id
    region          = data.aws_region.current.name
    account_id      = data.aws_caller_identity.current.account_id
    
    deployed_roles = {
      scan_role        = local.deploy_scan_role
      remediation_role = local.deploy_remediation_role
      audit_role       = local.deploy_audit_role
      readonly_role    = local.deploy_readonly_role
    }
    
    capabilities = {
      s3_remediation            = var.enable_s3_remediation
      security_group_remediation = var.enable_security_group_remediation
      iam_remediation           = local.enable_iam_remediation_final
      billing_data              = local.enable_billing_data_final
      historical_data           = var.include_historical_data
    }
  }
}

# Role ARNs (conditional outputs)
output "scan_role_arn" {
  description = "ARN of the compliance scanning role"
  value       = local.deploy_scan_role ? module.scan_role[0].role_arn : null
}

output "remediation_role_arn" {
  description = "ARN of the compliance remediation role"
  value       = local.deploy_remediation_role ? module.remediation_role[0].role_arn : null
}

output "audit_role_arn" {
  description = "ARN of the compliance audit role"
  value       = local.deploy_audit_role ? module.audit_role[0].role_arn : null
}

output "readonly_role_arn" {
  description = "ARN of the read-only monitoring role"
  value       = local.deploy_readonly_role ? module.readonly_role[0].role_arn : null
}

# Role Names
output "scan_role_name" {
  description = "Name of the compliance scanning role"
  value       = local.deploy_scan_role ? module.scan_role[0].role_name : null
}

output "remediation_role_name" {
  description = "Name of the compliance remediation role"
  value       = local.deploy_remediation_role ? module.remediation_role[0].role_name : null
}

output "audit_role_name" {
  description = "Name of the compliance audit role"
  value       = local.deploy_audit_role ? module.audit_role[0].role_name : null
}

output "readonly_role_name" {
  description = "Name of the read-only monitoring role"
  value       = local.deploy_readonly_role ? module.readonly_role[0].role_name : null
}

# External ID for role assumption
output "external_id" {
  description = "External ID for role assumption (sensitive)"
  value       = local.external_id
  sensitive   = true
}

# Customer Configuration
output "customer_config_parameter_name" {
  description = "SSM Parameter name containing customer configuration"
  value       = aws_ssm_parameter.customer_config.name
}

output "customer_config_parameter_arn" {
  description = "SSM Parameter ARN containing customer configuration"
  value       = aws_ssm_parameter.customer_config.arn
}

# Monitoring Resources
output "dashboard_url" {
  description = "CloudWatch Dashboard URL for role monitoring"
  value       = "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.role_monitoring.dashboard_name}"
}

output "log_group_name" {
  description = "CloudWatch Log Group name for role usage tracking"
  value       = aws_cloudwatch_log_group.role_usage.name
}

output "log_group_arn" {
  description = "CloudWatch Log Group ARN for role usage tracking"
  value       = aws_cloudwatch_log_group.role_usage.arn
}

output "monitoring_sns_topic_arn" {
  description = "SNS Topic ARN for role monitoring alerts"
  value       = aws_sns_topic.role_monitoring_alerts.arn
}

# Quick Start Commands
output "test_scan_role_command" {
  description = "AWS CLI command to test scan role assumption"
  value = local.deploy_scan_role ? join(" ", [
    "aws sts assume-role",
    "--role-arn ${module.scan_role[0].role_arn}",
    "--role-session-name test-scan-session",
    "--external-id ${local.external_id}"
  ]) : null
}

output "test_remediation_role_command" {
  description = "AWS CLI command to test remediation role assumption"
  value = local.deploy_remediation_role ? join(" ", [
    "aws sts assume-role",
    "--role-arn ${module.remediation_role[0].role_arn}",
    "--role-session-name test-remediation-session",
    "--external-id ${local.external_id}"
  ]) : null
}

output "test_audit_role_command" {
  description = "AWS CLI command to test audit role assumption"
  value = local.deploy_audit_role ? join(" ", [
    "aws sts assume-role",
    "--role-arn ${module.audit_role[0].role_arn}",
    "--role-session-name test-audit-session",
    "--external-id ${local.external_id}"
  ]) : null
}

output "test_readonly_role_command" {
  description = "AWS CLI command to test readonly role assumption"
  value = local.deploy_readonly_role ? join(" ", [
    "aws sts assume-role",
    "--role-arn ${module.readonly_role[0].role_arn}",
    "--role-session-name test-readonly-session",
    "--external-id ${local.external_id}"
  ]) : null
}

# Security Information
output "security_considerations" {
  description = "Important security considerations for deployed roles"
  value = {
    external_id_security = "Keep the external ID secure and confidential"
    platform_account    = "Only account ${var.platform_account_id} can assume these roles"
    monitoring_enabled  = "Role usage is monitored via CloudWatch and EventBridge"
    session_limits = {
      scan_role        = local.deploy_scan_role ? "3600 seconds (1 hour)" : "Not deployed"
      remediation_role = local.deploy_remediation_role ? "1800 seconds (30 minutes)" : "Not deployed"
      audit_role       = local.deploy_audit_role ? "7200 seconds (2 hours)" : "Not deployed"
      readonly_role    = local.deploy_readonly_role ? "900 seconds (15 minutes)" : "Not deployed"
    }
    high_risk_capabilities = {
      iam_remediation = local.enable_iam_remediation_final ? "ENABLED - Monitor carefully" : "Disabled"
      billing_access  = local.enable_billing_data_final ? "ENABLED - Sensitive financial data" : "Disabled"
    }
  }
}

# Compliance Framework Support
output "compliance_frameworks" {
  description = "Supported compliance frameworks"
  value = [
    "SOC 2 Type I & II",
    "HIPAA",
    "GDPR",
    "PCI DSS",
    "ISO 27001",
    "NIST Cybersecurity Framework",
    "CIS Controls"
  ]
}

# Role Capabilities Matrix
output "role_capabilities_matrix" {
  description = "Matrix of capabilities by role type"
  value = {
    scan_role = local.deploy_scan_role ? {
      read_permissions     = "Full AWS resource discovery"
      write_permissions    = "None"
      sensitive_data       = "Configuration data only"
      compliance_frameworks = "All supported frameworks"
      session_duration     = "1 hour"
      risk_level          = "Low"
    } : "Not deployed"
    
    remediation_role = local.deploy_remediation_role ? {
      read_permissions     = "Full AWS resource discovery"
      write_permissions    = "Limited remediation actions"
      sensitive_data       = "Configuration data only"
      compliance_frameworks = "All supported frameworks"
      session_duration     = "30 minutes"
      risk_level          = local.enable_iam_remediation_final ? "High" : "Medium"
      s3_remediation      = var.enable_s3_remediation ? "Enabled" : "Disabled"
      sg_remediation      = var.enable_security_group_remediation ? "Enabled" : "Disabled"
      iam_remediation     = local.enable_iam_remediation_final ? "Enabled" : "Disabled"
    } : "Not deployed"
    
    audit_role = local.deploy_audit_role ? {
      read_permissions     = "Enhanced AWS resource discovery"
      write_permissions    = "None"
      sensitive_data       = local.enable_billing_data_final ? "Including billing data" : "Configuration data only"
      compliance_frameworks = "All supported frameworks"
      session_duration     = "2 hours"
      risk_level          = local.enable_billing_data_final ? "Medium" : "Low"
      billing_access      = local.enable_billing_data_final ? "Enabled" : "Disabled"
      historical_data     = var.include_historical_data ? "Enabled" : "Disabled"
    } : "Not deployed"
    
    readonly_role = local.deploy_readonly_role ? {
      read_permissions     = "Basic AWS resource information"
      write_permissions    = "None"
      sensitive_data       = "None"
      compliance_frameworks = "Basic compliance status only"
      session_duration     = "15 minutes"
      risk_level          = "Very Low"
    } : "Not deployed"
  }
}

# Deployment Validation
output "deployment_validation" {
  description = "Validation checks for the deployment"
  value = {
    required_roles_deployed = {
      scan_role_check = local.deploy_scan_role ? "✓ Deployed" : "✗ Missing (required for all tiers)"
    }
    tier_compliance = {
      basic_tier_requirements = var.deployment_tier == "BASIC" ? {
        scan_role    = local.deploy_scan_role ? "✓" : "✗"
        readonly_role = local.deploy_readonly_role ? "✓" : "✗"
      } : "Not applicable"
      
      standard_tier_requirements = contains(["STANDARD", "PREMIUM", "ENTERPRISE"], var.deployment_tier) ? {
        scan_role        = local.deploy_scan_role ? "✓" : "✗"
        remediation_role = local.deploy_remediation_role ? "✓" : "✗"
        readonly_role    = local.deploy_readonly_role ? "✓" : "✗"
      } : "Not applicable"
      
      premium_tier_requirements = contains(["PREMIUM", "ENTERPRISE"], var.deployment_tier) ? {
        scan_role        = local.deploy_scan_role ? "✓" : "✗"
        remediation_role = local.deploy_remediation_role ? "✓" : "✗"
        audit_role       = local.deploy_audit_role ? "✓" : "○ Optional"
        readonly_role    = local.deploy_readonly_role ? "✓" : "✗"
      } : "Not applicable"
      
      enterprise_tier_requirements = var.deployment_tier == "ENTERPRISE" ? {
        scan_role        = local.deploy_scan_role ? "✓" : "✗"
        remediation_role = local.deploy_remediation_role ? "✓" : "✗"
        audit_role       = local.deploy_audit_role ? "✓" : "○ Optional"
        readonly_role    = local.deploy_readonly_role ? "✓" : "✗"
        iam_remediation  = local.enable_iam_remediation_final ? "✓ Available" : "○ Available but disabled"
      } : "Not applicable"
    }
  }
}

# Next Steps
output "next_steps" {
  description = "Recommended next steps after deployment"
  value = [
    "1. Test role assumption using the provided CLI commands",
    "2. Configure the AI Compliance Shepherd platform with the role ARNs and external ID",
    "3. Set up CloudWatch alarms for role usage monitoring",
    "4. Subscribe to the SNS topic for role monitoring alerts",
    "5. Review the CloudWatch dashboard for role activity",
    "6. Conduct initial compliance scan to validate permissions",
    "7. Set up regular access reviews and permission audits",
    "8. Document the deployment in your security procedures"
  ]
}
