# IAM Roles module for AI Compliance Shepherd customer onboarding

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.9"
    }
  }
}

locals {
  common_role_tags = merge(var.tags, {
    Module = "iam-roles"
    Usage  = "customer-roles"
  })

  # Base trust policy for service account
  service_trust_policy = {
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
            "sts:ExternalId" = var.external_id
          }
        }
      }
    ]
  }

  # Time conditions for role expiration (if needed)
  time_conditions = {
    DateGreaterThan = "${time_rotation.trust_boundary_unlock_after.rfc3339}"
  }
}

resource "time_rotation" "trust_boundary_unlock_after" {
  rotation_hours = 168  # 7 days
}

# Permission boundary for customer roles
resource "aws_iam_policy" "customer_permission_boundary" {
  name_prefix = "compliance-shepherd-boundary-${var.tenant_id}"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Deny"
        NotAction = concat(
          var.permissions.read_permissions,
          var.permissions.scan_permissions,
          var.enable_auto_remediation ? var.permissions.remediation_permissions : [],
          var.permissions.audit_permissions
        )
        Resource = "*"
        Condition = {
          StringNotEquals = {
            "aws:PrincipalServiceName" = ["compliance-shepherd"]
          }
        }
      }
    ]
  })

  tags = local.common_role_tags
}

# Scan Role - Read-only access for compliance scanning
resource "aws_iam_role" "scan_role" {
  name_prefix         = "compliance-scan-${var.customer_name}"
  assume_role_policy  = jsonencode(local.service_trust_policy)
  permissions_boundary = aws_iam_policy.customer_permission_boundary.arn
  
  tags = merge(local.common_role_tags, {
    Purpose = "compliance-scanning"
    Tier    = var.customer_tier
  })
}

resource "aws_iam_policy" "scan_policy" {
  name_prefix = "compliance-scan-policy-${var.tenant_id}"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = var.permissions.scan_permissions
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:CreateLogGroup"
      ]
      Resource = [
        "arn:aws:logs:*:${var.customer_account_id}:log-group:/aws/compliance-shepherd/*"
      ]
    },
    {
      Effect = "Allow"
      Action = [
        "kms:Decrypt",
        "kms:GenerateDataKey"
      ]
      Resource = "arn:aws:kms:*:${var.customer_account_id}:key/*"
      Condition = {
        StringEquals = {
          "kms:ViaService" = "logs.*.amazonaws.com"
        }
      }
    }
    ]
  })

  tags = local.common_role_tags
}

resource "aws_iam_role_policy_attachment" "scan_policy_attach" {
  role       = aws_iam_role.scan_role.name
  policy_arn = aws_iam_policy.scan_policy.arn
}

# Read-only Role - For dashboard and monitoring access
resource "aws_iam_role" "readonly_role" {
  name_prefix        = "compliance-readonly-${var.customer_name}"
  assume_role_policy = jsonencode(local.service_trust_policy)
  
  tags = merge(local.common_role_tags, {
    Purpose = "read-only-access"
    Tier    = var.customer_tier
  })
}

resource "aws_iam_policy" "readonly_policy" {
  name_prefix = "compliance-readonly-policy-${var.tenant_id}"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = var.permissions.read_permissions
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics",
          "cloudwatch:GetDashboards"
        ]
        Resource = "*"
      }
    ]
  })

  tags = local.common_role_tags
}

resource "aws_iam_role_policy_attachment" "readonly_policy_attach" {
  role       = aws_iam_role.readonly_role.name
  policy_arn = aws_iam_policy.readonly_policy.arn
}

# Remediation Role (conditionally created based on customer tier)
resource "aws_iam_role" "remediation_role" {
  count              = var.enable_auto_remediation ? 1 : 0
  name_prefix        = "compliance-remediation-${var.customer_name}"
  assume_role_policy = jsonencode(local.service_trust_policy)
  
  tags = merge(local.common_role_tags, {
    Purpose = "automated-remediation"
    Tier    = var.customer_tier
  })
}

resource "aws_iam_policy" "remediation_policy" {
  count = var.enable_auto_remediation ? 1 : 0
  
  name_prefix = "compliance-remediation-policy-${var.tenant_id}"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = var.permissions.remediation_permissions
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudformation:CreateChangeSet",
          "cloudformation:ExecuteChangeSet",
          "s3:PutBucketNotification"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "arn:aws:logs:*:${var.customer_account_id}:log-group:/aws/compliance-shepherd/*"
        ]
      }
    ]
  })

  tags = local.common_role_tags
}

resource "aws_iam_role_policy_attachment" "remediation_policy_attach" {
  count      = var.enable_auto_remediation ? 1 : 0
  role       = aws_iam_role.remediation_role[0].name
  policy_arn = aws_iam_policy.remediation_policy[0].arn
}

# Audit Role - For audit pack generation and evidence collection
resource "aws_iam_role" "audit_role" {
  name_prefix        = "compliance-audit-${var.customer_name}"
  assume_role_policy = jsonencode(local.service_trust_policy)
  
  tags = merge(local.common_role_tags, {
    Perurpose = "audit-evidence-collection"
    Tier     = var.customer_tier
  })
}

resource "aws_iam_policy" "audit_policy" {
  name_prefix = "compliance-audit-policy-${var.tenant_id}"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = var.permissions.audit_permissions
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::compliance-shepherd-${var.customer_name}-*",
          "arn:aws:s3:::compliance-shepherd-${var.customer_name}-*/*"
        ]
      }
    ]
  })

  tags = local.common_role_tags
}

resource "aws_iam_role_policy_attachment" "audit_policy_attach" {
  role       = aws_iam_role.audit_role.name
  policy_arn = aws_iam_policy.audit_policy.arn
}

# Service-specific role for GitHub integration
resource "aws_iam_role" "github_integration_role" {
  name_prefix        = "compliance-github-${var.customer_name}"
  assume_role_policy = jsonencode(local.service_trust_policy)
  
  tags = merge(local.common_role_tags, {
    Purpose = "github-integration"
    Tier    = var.customer_tier
  })
}

resource "aws_iam_policy" "github_integration_policy" {
  name_prefix = "compliance-github-policy-${var.tenant_id}"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "codepipeline:GetPipeline",
          "codepipeline:ListPipelines",
          "codecommit:GetRepository",
          "codecommit:ListRepositories"
        ]
        Resource = "*"
      }
    ]
  })

  tags = local.common_role_tags
}

resource "aws_iam_role_policy_attach" "github_integration_policy_attach" {
  role       = aws_iam_role.github_integration_role.name
  policy_arn = aws_iam_policy.github_integration_policy.arn
}
