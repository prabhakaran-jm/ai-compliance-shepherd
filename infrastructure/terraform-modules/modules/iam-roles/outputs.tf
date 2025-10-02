# Outputs for IAM Roles module

output "scan_role_arn" {
  description = "ARN of the compliance scan role"
  value       = aws_iam_role.scan_role.arn
}

output "readonly_role_arn" {
  description = "ARN of the read-only role"
  value       = aws_iam_role.readonly_role.arn
}

output "remediation_role_arn" {
  description = "ARN of the remediation role"
  value       = var.enable_auto_remediation ? aws_iam_role.remediation_role[0].arn : null
}

output "audit_role_arn" {
  description = "ARN of the audit role"
  value       = aws_iam_role.audit_role.arn
}

output "github_integration_role_arn" {
  description = "ARN of the GitHub integration role"
  value       = aws_iam_role.github_integration_role.arn
}

output "permission_boundary_arn" {
  description = "ARN of the permission boundary policy"
  value       = aws_iam_policy.customer_permission_boundary.arn
}

output "role_summary" {
  description = "Summary of all created roles"
  value = {
    scan_role = {
      name = aws_iam_role.scan_role.name
      arn  = aws_iam_role.scan_role.arn
    }
    readonly_role = {
      name = aws_iam_role.readonly_role.name
      arn  = aws_iam_role.readonly_role.arn
    }
    remediation_role = var.enable_auto_remediation ? {
      name = aws_iam_role.remediation_role[0].name
      arn  = aws_iam_role.remediation_role[0].arn
    } : null
    audit_role = {
      name = aws_iam_role.audit_role.name
      arn  = aws_iam_role.audit_role.arn
    }
    github_integration_role = {
      name = aws_iam_role.github_integration_role.name
      arn  = aws_iam_role.github_integration_role.arn
    }
  }
}
