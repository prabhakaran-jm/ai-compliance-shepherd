# AI Compliance Shepherd - Cross-Account IAM Roles Terraform Configuration
# This configuration deploys all necessary IAM roles for cross-account access

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
  }
}

# Variables
variable "platform_account_id" {
  description = "AWS Account ID of the AI Compliance Shepherd platform"
  type        = string
  validation {
    condition     = can(regex("^[0-9]{12}$", var.platform_account_id))
    error_message = "Platform account ID must be a valid 12-digit AWS Account ID."
  }
}

variable "customer_name" {
  description = "Customer name for role naming and tagging"
  type        = string
  validation {
    condition     = can(regex("^[a-zA-Z0-9\\-_]+$", var.customer_name))
    error_message = "Customer name must contain only alphanumeric characters, hyphens, and underscores."
  }
}

variable "deployment_tier" {
  description = "Customer tier determining which roles to deploy"
  type        = string
  default     = "STANDARD"
  validation {
    condition     = contains(["BASIC", "STANDARD", "PREMIUM", "ENTERPRISE"], var.deployment_tier)
    error_message = "Deployment tier must be one of: BASIC, STANDARD, PREMIUM, ENTERPRISE."
  }
}

variable "external_id" {
  description = "Unique external ID for secure cross-account access"
  type        = string
  default     = null
  validation {
    condition = var.external_id == null || (
      length(var.external_id) >= 16 && 
      length(var.external_id) <= 64 && 
      can(regex("^[a-zA-Z0-9\\-_]+$", var.external_id))
    )
    error_message = "External ID must be 16-64 characters, alphanumeric with hyphens and underscores."
  }
}

variable "enable_scan_role" {
  description = "Deploy compliance scanning role"
  type        = bool
  default     = true
}

variable "enable_remediation_role" {
  description = "Deploy compliance remediation role"
  type        = bool
  default     = true
}

variable "enable_audit_role" {
  description = "Deploy compliance audit role"
  type        = bool
  default     = false
}

variable "enable_readonly_role" {
  description = "Deploy read-only monitoring role"
  type        = bool
  default     = true
}

# Remediation capabilities
variable "enable_s3_remediation" {
  description = "Enable S3 bucket remediation capabilities"
  type        = bool
  default     = true
}

variable "enable_security_group_remediation" {
  description = "Enable Security Group remediation capabilities"
  type        = bool
  default     = true
}

variable "enable_iam_remediation" {
  description = "Enable IAM remediation capabilities (high risk, ENTERPRISE only)"
  type        = bool
  default     = false
}

# Audit capabilities
variable "include_billing_data" {
  description = "Include billing data access in audit role"
  type        = bool
  default     = false
}

variable "include_historical_data" {
  description = "Include historical data access in audit role"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Local values
locals {
  # Generate external ID if not provided
  external_id = var.external_id != null ? var.external_id : random_id.external_id[0].hex
  
  # Tier-based role deployment logic
  deploy_scan_role        = var.enable_scan_role
  deploy_remediation_role = var.enable_remediation_role && contains(["STANDARD", "PREMIUM", "ENTERPRISE"], var.deployment_tier)
  deploy_audit_role       = var.enable_audit_role && contains(["PREMIUM", "ENTERPRISE"], var.deployment_tier)
  deploy_readonly_role    = var.enable_readonly_role
  
  # Feature enablement based on tier
  enable_iam_remediation_final = var.enable_iam_remediation && var.deployment_tier == "ENTERPRISE"
  enable_billing_data_final    = var.include_billing_data && contains(["PREMIUM", "ENTERPRISE"], var.deployment_tier)
  
  # Common tags
  common_tags = merge(var.tags, {
    CustomerName    = var.customer_name
    DeploymentTier  = var.deployment_tier
    ManagedBy      = "Terraform"
    Purpose        = "AIComplianceShepherd"
    CreatedDate    = timestamp()
  })
}

# Generate external ID if not provided
resource "random_id" "external_id" {
  count       = var.external_id == null ? 1 : 0
  byte_length = 16
  prefix      = "acs-"
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Compliance Scanning Role
module "scan_role" {
  count  = local.deploy_scan_role ? 1 : 0
  source = "./modules/scan-role"
  
  platform_account_id = var.platform_account_id
  external_id        = local.external_id
  role_name          = "AIComplianceShepherd-${var.customer_name}-ScanRole"
  session_duration   = 3600
  
  tags = merge(local.common_tags, {
    RoleType = "Scanning"
  })
}

# Compliance Remediation Role
module "remediation_role" {
  count  = local.deploy_remediation_role ? 1 : 0
  source = "./modules/remediation-role"
  
  platform_account_id              = var.platform_account_id
  external_id                     = local.external_id
  role_name                       = "AIComplianceShepherd-${var.customer_name}-RemediationRole"
  session_duration                = 1800
  enable_s3_remediation          = var.enable_s3_remediation
  enable_security_group_remediation = var.enable_security_group_remediation
  enable_iam_remediation         = local.enable_iam_remediation_final
  
  tags = merge(local.common_tags, {
    RoleType = "Remediation"
  })
}

# Compliance Audit Role
module "audit_role" {
  count  = local.deploy_audit_role ? 1 : 0
  source = "./modules/audit-role"
  
  platform_account_id     = var.platform_account_id
  external_id            = local.external_id
  role_name              = "AIComplianceShepherd-${var.customer_name}-AuditRole"
  session_duration       = 7200
  include_billing_data   = local.enable_billing_data_final
  include_historical_data = var.include_historical_data
  
  tags = merge(local.common_tags, {
    RoleType = "Audit"
  })
}

# Read-Only Monitoring Role
module "readonly_role" {
  count  = local.deploy_readonly_role ? 1 : 0
  source = "./modules/readonly-role"
  
  platform_account_id = var.platform_account_id
  external_id        = local.external_id
  role_name          = "AIComplianceShepherd-${var.customer_name}-ReadOnlyRole"
  session_duration   = 900
  
  tags = merge(local.common_tags, {
    RoleType = "ReadOnly"
  })
}

# Customer Configuration in SSM Parameter Store
resource "aws_ssm_parameter" "customer_config" {
  name        = "/compliance-shepherd/customers/${var.customer_name}/config"
  description = "AI Compliance Shepherd customer configuration"
  type        = "String"
  
  value = jsonencode({
    customerName      = var.customer_name
    deploymentTier    = var.deployment_tier
    platformAccountId = var.platform_account_id
    externalId       = local.external_id
    deployedRoles = {
      scanRole        = local.deploy_scan_role
      remediationRole = local.deploy_remediation_role
      auditRole       = local.deploy_audit_role
      readOnlyRole    = local.deploy_readonly_role
    }
    capabilities = {
      s3Remediation           = var.enable_s3_remediation
      securityGroupRemediation = var.enable_security_group_remediation
      iamRemediation          = local.enable_iam_remediation_final
      billingData             = local.enable_billing_data_final
      historicalData          = var.include_historical_data
    }
    deploymentDate = timestamp()
    region        = data.aws_region.current.name
    accountId     = data.aws_caller_identity.current.account_id
  })
  
  tags = merge(local.common_tags, {
    Purpose = "CustomerConfiguration"
  })
}

# CloudWatch Dashboard for Role Monitoring
resource "aws_cloudwatch_dashboard" "role_monitoring" {
  dashboard_name = "AIComplianceShepherd-${var.customer_name}-RoleMonitoring"
  
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 2
        properties = {
          markdown = "# AI Compliance Shepherd - Role Monitoring Dashboard\n**Customer:** ${var.customer_name} | **Tier:** ${var.deployment_tier} | **Region:** ${data.aws_region.current.name}"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 2
        width  = 12
        height = 6
        properties = {
          metrics = concat(
            local.deploy_scan_role ? [["AWS/CloudTrail", "AssumeRole", "RoleName", "AIComplianceShepherd-${var.customer_name}-ScanRole"]] : [],
            local.deploy_remediation_role ? [["...", "AIComplianceShepherd-${var.customer_name}-RemediationRole"]] : [],
            local.deploy_audit_role ? [["...", "AIComplianceShepherd-${var.customer_name}-AuditRole"]] : [],
            local.deploy_readonly_role ? [["...", "AIComplianceShepherd-${var.customer_name}-ReadOnlyRole"]] : []
          )
          period = 300
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "Role Assumption Activity"
          view   = "timeSeries"
        }
      },
      {
        type   = "log"
        x      = 12
        y      = 2
        width  = 12
        height = 6
        properties = {
          query  = "SOURCE '/aws/cloudtrail'\n| fields @timestamp, sourceIPAddress, userIdentity.type, eventName\n| filter eventName = \"AssumeRole\"\n| filter resources.0.ARN like /AIComplianceShepherd-${var.customer_name}/\n| sort @timestamp desc\n| limit 20"
          region = data.aws_region.current.name
          title  = "Recent Role Assumptions"
          view   = "table"
        }
      }
    ]
  })
  
  tags = local.common_tags
}

# CloudWatch Log Group for centralized role usage logging
resource "aws_cloudwatch_log_group" "role_usage" {
  name              = "/aws/iam/compliance-shepherd/${var.customer_name}"
  retention_in_days = 30
  
  tags = merge(local.common_tags, {
    Purpose = "RoleUsageLogging"
  })
}

# EventBridge Rule for Role Assumption Monitoring
resource "aws_cloudwatch_event_rule" "role_assumption_monitoring" {
  name        = "compliance-shepherd-${var.customer_name}-role-assumptions"
  description = "Monitor AI Compliance Shepherd role assumptions"
  
  event_pattern = jsonencode({
    source      = ["aws.sts"]
    detail-type = ["AWS API Call via CloudTrail"]
    detail = {
      eventSource = ["sts.amazonaws.com"]
      eventName   = ["AssumeRole"]
      responseElements = {
        assumedRoleUser = {
          arn = [{
            prefix = "arn:aws:sts::${data.aws_caller_identity.current.account_id}:assumed-role/AIComplianceShepherd-${var.customer_name}-"
          }]
        }
      }
    }
  })
  
  tags = local.common_tags
}

# SNS Topic for Role Monitoring Alerts
resource "aws_sns_topic" "role_monitoring_alerts" {
  name = "compliance-shepherd-${var.customer_name}-role-alerts"
  
  tags = merge(local.common_tags, {
    Purpose = "RoleMonitoringAlerts"
  })
}

# EventBridge Target to send alerts to SNS
resource "aws_cloudwatch_event_target" "role_monitoring_sns" {
  rule      = aws_cloudwatch_event_rule.role_assumption_monitoring.name
  target_id = "SendToSNS"
  arn       = aws_sns_topic.role_monitoring_alerts.arn
}

# SNS Topic Policy
resource "aws_sns_topic_policy" "role_monitoring_alerts_policy" {
  arn = aws_sns_topic.role_monitoring_alerts.arn
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.role_monitoring_alerts.arn
      }
    ]
  })
}
