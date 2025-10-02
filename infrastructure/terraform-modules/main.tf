# Main Terraform configuration for AI Compliance Shepherd customer onboarding

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.9"
    }
  }

  backend "s3" {
    key            = "ai-compliance-shepherd/customer-onboarding/terraform.tfstate"
    bucket         = "ai-compliance-shepherd-terraform-state"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "ai-compliance-shepherd-terraform-locks"
  }
}

provider "aws" {
  region = var.customer_region
  
  default_tags {
    tags = local.common_tags
  }
}

provider "random" {}

# Generate unique identifiers
resource "random_id" "tenant_id" {
  byte_length = 4
}

resource "random_password" "external_id" {
  length  = 32
  special = false
}

# Customer-specific DynamoDB table for tenant configuration
resource "aws_dynamodb_table_item" "tenant_config" {
  table_name = "ai-compliance-shepherd-tenants"
  hash_key   = "tenantId"
  
  item = jsonencode({
    tenantId = {
      S = local.tenant_id
    }
    customerName = {
      S = var.customer_name
    }
    customerEmail = {
      S = var.customer_email
    }
    customerAccountId = {
      S = var.customer_account_id
    }
    tier = {
      S = var.customer_tier
    }
    status = {
      S = "ACTIVE"
    }
    createdAt = {
      S = time_static.current.rfc3339
    }
    scanConfig = {
      M = {
        maxResourcesPerScan = {
          N = tostring(local.current_scan_config.max_resources_per_scan)
        }
        scanFrequencyHours = {
          N = tostring(local.current_scan_config.scan_frequency_hours)
        }
        retentionDays = {
          N = tostring(local.current_scan_config.retention_days)
        }
        enabledChecks = {
          SS = local.current_scan_config.enabled_checks
        }
      }
    }
    notificationConfig = {
      M = {
        slackWebhookUrl = {
          S = var.slack_webhook_url != "" ? var.slack_webhook_url : ""
        }
        githubRepositories = {
          SS = var.github_repositories
        }
      }
    }
  })
  
  lifecycle {
    ignore_changes = [
      item.ComplianceShepherdServiceArn.S,
      item.LastScanTime.S,
      item.LastActiveTime.S
    ]
  }
}

resource "time_static" "current" {}

# Customer-specific KMS key for encryption
resource "aws_kms_key" "customer_encryption_key" {
  description = "Encryption key for AI Compliance Shepherd customer: ${var.customer_name}"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${var.customer_account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow Compliance Shepherd Service"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${var.service_account_id}:root"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:PrincipalServiceName" = "compliance-shepherd"
          }
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Usage = "customer-encryption"
  })
}

resource "aws_kms_alias" "customer_encryption_key_alias" {
  name          = "alias/compliance-shepherd-${local.customer_id}"
  target_key_id = aws_kms_key.customer_encryption_key.key_id
}

# CloudWatch Log Group for compliance logs
resource "aws_cloudwatch_log_group" "compliance_logs" {
  name              = "/aws/compliance-shepherd/${local.customer_id}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.customer_encryption_key.arn

  tags = local.common_tags
}

# SNS topics for notifications
resource "aws_sns_topic" "notifications" {
  name              = "compliance-shepherd-${local.customer_id}"
  kms_master_key_id = aws_kms_key.customer_encryption_key.id

  tags = local.common_tags
}

resource "aws_sns_topic_policy" "notifications" {
  arn = aws_sns_topic.notifications.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${var.service_account_id}:root"
        }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.notifications.arn
      }
    ]
  })
}

# Local resources for module dependencies

# Include the IAM roles module
module "iam_roles" {
  source = "./modules/iam-roles"
  
  customer_account_id    = var.customer_account_id
  service_account_id     = var.service_account_id
  customer_name          = var.customer_name
  customer_tier          = var.customer_tier
  tenant_id              = local.tenant_id
  external_id            = random_password.external_id.result
  enable_auto_remediation = var.enable_auto_remediation
  allowed_regions        = var.allowed_regions
  
  permissions = {
    read_permissions        = local.read_permissions
    scan_permissions        = local.scan_permissions
    remediation_permissions = local.remediation_permissions
    audit_permissions       = local.audit_permissions
  }
  
  tags = local.common_tags
}

# Include the monitoring module
module "monitoring" {
  source = "./modules/monitoring"
  
  customer_account_id  = var.customer_account_id
  service_account_id   = var.service_account_id
  customer_name        = var.customer_name
  customer_region      = var.customer_region
  tenant_id            = local.tenant_id
  environment          = var.environment
  kms_key_arn         = aws_kms_key.customer_encryption_key.arn
  scan_schedule_expression = var.scan_schedule_expression
  log_retention_days   = var.log_retention_days
  
  tags = local.common_tags
}
