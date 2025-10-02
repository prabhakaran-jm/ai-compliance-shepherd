# Local values for AI Compliance Shepherd Terraform Modules

locals {
  # Generate unique identifiers
  customer_id = lower(replace(var.customer_name, " ", "-"))
  tenant_id   = "${local.customer_id}-${random_id.tenant_id.hex}"
  
  # Common tags
  common_tags = merge(var.tags, {
    Environment    = var.environment
    Customer       = var.customer_name
    Service        = "ai-compliance-shepherd"
    TenantId       = local.tenant_id
    CustomerTier   = var.customer_tier
    ManagedBy      = "terraform"
  })

  # Define permissions based on customer tier
  read_permissions = [
    "ec2:Describe*",
    "rds:Describe*",
    "s3:GetBucketLocation",
    "s3:GetBucketPolicy",
    "s3:GetBucketPolicyStatus",
    "s3:GetBucketVersioning",
    "s3:GetBucketEncryption",
    "s3:GetBucketPublicAccessBlock",
    "s3:GetBucketAcl",
    "s3:ListBucket",
    "iam:GetAccountSummary",
    "iam:ListUsers",
    "iam:ListRoles",
    "iam:ListPolicies",
    "iam:GetRole",
    "iam:GetPolicy",
    "cloudtrail:DescribeTrails",
    "cloudtrail:GetTrail",
    "cloudtrail:GetEventSelectors",
    "kms:DescribeKey",
    "kms:ListKeys",
    "kms:GetKeyPolicy",
    "kms:DescribeKeyPolicy",
    "lambda:GetFunctionConfiguration",
    "lambda:ListFunctions",
    "logs:DescribeLogGroups",
    "logs:DescribeLogStreams",
    "logs:FilterLogEvents"
  ]

  scan_permissions = concat(local.read_permissions, [
    "ec2:DescribeSecurityGroups",
    "ec2:DescribeVolumes",
    "ec2:DescribeSnapshots",
    "s3:GetBucketNotification",
    "s3:GetBucketTagging",
    "s3:GetBucketCors",
    "s3:GetBucketLifecycleConfiguration",
    "iam:GetUserPolicy",
    "iam:GetRolePolicy",
    "iam:GetPolicyVersion",
    "cloudtrail:LookupEvents",
    "cloudformation:DescribeStacks",
    "cloudformation:GetTemplate",
    "cloudformation:ListStackResources"
  ])

  remediation_permissions = [
    "ec2:AuthorizeSecurityGroupIngress",
    "ec2:AuthorizeSecurityGroupEgress",
    "ec2:RevokeSecurityGroupIngress",
    "ec2:RevokeSecurityGroupEgress",
    "s3:PutBucketPolicy",
    "s3:PutBucketPublicAccessBlock",
    "s3:PutBucketEncryption",
    "s3:PutBucketNotification",
    "iam:AttachRolePolicy",
    "iam:DetachRolePolicy",
    "iam:PutRolePolicy",
    "iam:DeleteRolePolicy",
    "kms:PutKeyPolicy",
    "lambda:UpdateFunctionConfiguration",
    "cloudtrail:PutEventSelectors",
    "cloudformation:UpdateStack"
  ]

  audit_permissions = concat(local.scan_permissions, [
    "organizations:DescribeOrganization",
    "organizations:ListAccounts",
    "sts:GetCallerIdentity",
    "sts:AssumeRole",
    "config:DescribeConfigurationRecorders",
    "config:DescribeConfigRules",
    "config:DescribeComplianceByConfigRule",
    "config:DescribeComplianceByResource",
    "inspector:ListFindings",
    "inspector:DescribeFindings",
    "securityhub:GetFindings",
    "securityhub:ListFindings"
  ])

  # Role assume role policies
  service_account_trust_policy = {
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${var.service_account_id}:root"
        }
        Action = "sts:AssumeRole"
        Condition = {
          StringEquals = {
            "sts:ExternalId" = random_password.external_id.result
          }
        }
      }
    ]
  }

  # Notification configurations
  notification_topics = [
    {
      name = "scan-completion"
      description = "Notifications for scan completion"
    },
    {
      name = "critical-findings"
      description = "Notifications for critical compliance findings"
    },
    {
      name = "remediation-events"
      description = "Notifications for remediation actions"
    },
    {
      name = "system-alerts"
      description = "System operational alerts"
    }
  ]

  # Scan configurations by tier
  scan_config_by_tier = {
    BASIC = {
      max_resources_per_scan = 1000
      scan_frequency_hours = 24
      retention_days = 7
      enabled_checks = ["security-groups", "s3-encryption", "iam-policies"]
    }
    STANDARD = {
      max_resources_per_scan = 10000
      scan_frequency_hours = 12
      retention_days = 30
      enabled_checks = ["security-groups", "s3-encryption", "iam-policies", "cloudtrail", "rds-encryption"]
    }
    PREMIUM = {
      max_resources_per_scan = 50000
      scan_frequency_hours = 6
      retention_days = 90
      enabled_checks = ["all"]
    }
    ENTERPRISE = {
      max_resources_per_scan = -1  # unlimited
      scan_frequency_hours = 1
      retention_days = 365
      enabled_checks = ["all"]
      features = ["advanced-analytics", "custom-rules", "api-integration"]
    }
  }

  current_scan_config = local.scan_config_by_tier[var.customer_tier]
}
