# Outputs for AI Compliance Shepherd Terraform Modules

output "cross_account_role_arn" {
  description = "ARN of the cross-account role created for scanning"
  value       = module.iam_roles.scan_role_arn
}

output "readonly_role_arn" {
  description = "ARN of the read-only role for monitoring"
  value       = module.iam_roles.readonly_role_arn
}

output "remediation_role_arn" {
  description = "ARN of the remediation role (if enabled)"
  value       = module.iam_roles.remediation_role_arn
}

output "audit_role_arn" {
  description = "ARN of the audit role for evidence collection"
  value       = module.iam_roles.audit_role_arn
}

output "external_id" {
  description = "External ID for secure cross-account access"
  value       = random_password.external_id.result
  sensitive   = true
}

output "customer_tenant_id" {
  description = "Unique customer tenant identifier"
  value       = aws_dynamodb_table_item.tenant_config.id
}

output "kms_key_id" {
  description = "Customer-specific KMS key ID for encryption"
  value       = aws_kms_key.customer_encryption_key.key_id
}

output "encryption_key_arn" {
  description = "ARN of the customer encryption key"
  value       = aws_kms_key.customer_encryption_key.arn
}

output "notification_topic_arn" {
  description = "ARN of the notification topic for alerts"
  value       = aws_sns_topic.notifications.arn
}

output "scan_schedule_rule_arn" {
  description = "ARN of the scheduled scan rule"
  value       = aws_cloudwatch_event_rule.scheduled_scans.arn
}

output "cloudwatch_log_group_name" {
  description = "CloudWatch log group for compliance logs"
  value       = aws_cloudwatch_log_group.compliance_logs.name
}

output "trust_account_ids" {
  description = "List of trusted AWS account IDs"
  value       = [var.service_account_id]
}

output "permission_boundary_arn" {
  description = "Permission boundary for customer roles"
  value       = aws_iam_policy.customer_permission_boundary.arn
}

output "customer_permissions_summary" {
  description = "Summary of granted permissions"
  value = {
    read_permissions = local.read_permissions
    scan_permissions = local.scan_permissions
    remediation_permissions = var.enable_auto_remediation ? local.remediation_permissions : []
    audit_permissions = local.audit_permissions
  }
}

output "next_steps" {
  description = "Instructions for completing customer onboarding"
  value = [
    "1. Provide the cross-account role ARN to the AI Compliance Shepherd team",
    "2. Configure scan schedules in the web interface",
    "3. Test the connection using the validation endpoint",
    "4. Set up notification preferences in Slack/GitHub",
    "5. Review initial compliance findings in the dashboard"
  ]
}

output "validation_endpoint" {
  description = "Endpoint URL for testing customer setup"
  value = "https://api.ai-compliance-shepherd.com/v1/onboarding/validate/${aws_dynamodb_table_item.tenant_config.id}"
}

output "monitoring_summary" {
  description = "Summary of monitoring resources"
  value = module.monitoring.monitoring_summary
}
