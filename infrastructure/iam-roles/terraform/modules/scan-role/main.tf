# AI Compliance Shepherd - Scan Role Terraform Module

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "platform_account_id" {
  description = "AWS Account ID of the AI Compliance Shepherd platform"
  type        = string
}

variable "external_id" {
  description = "Unique external ID for secure cross-account access"
  type        = string
}

variable "role_name" {
  description = "Name for the compliance scanning role"
  type        = string
}

variable "session_duration" {
  description = "Maximum session duration in seconds"
  type        = number
  default     = 3600
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# IAM Role
resource "aws_iam_role" "scan_role" {
  name        = var.role_name
  description = "Cross-account role for AI Compliance Shepherd scanning operations"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${var.platform_account_id}:root"
        }
        Action = "sts:AssumeRole"
        Condition = {
          StringEquals = {
            "sts:ExternalId" = var.external_id
          }
          Bool = {
            "aws:SecureTransport" = "true"
          }
          DateGreaterThan = {
            "aws:CurrentTime" = "2024-01-01T00:00:00Z"
          }
        }
      }
    ]
  })
  
  max_session_duration = var.session_duration
  
  tags = merge(var.tags, {
    Name = var.role_name
    Type = "ComplianceScanRole"
  })
}

# Compliance Scan Policy
resource "aws_iam_policy" "compliance_scan_policy" {
  name        = "${var.role_name}-ComplianceScanPolicy"
  description = "Core permissions for compliance scanning and resource discovery"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EC2ReadPermissions"
        Effect = "Allow"
        Action = [
          "ec2:Describe*",
          "ec2:Get*",
          "ec2:List*",
          "vpc:Describe*",
          "vpc:Get*",
          "vpc:List*"
        ]
        Resource = "*"
      },
      {
        Sid    = "S3ReadPermissions"
        Effect = "Allow"
        Action = [
          "s3:GetBucket*",
          "s3:GetObject*",
          "s3:List*",
          "s3:GetEncryptionConfiguration",
          "s3:GetPublicAccessBlock",
          "s3:GetBucketVersioning",
          "s3:GetBucketLogging",
          "s3:GetBucketNotification",
          "s3:GetBucketPolicy",
          "s3:GetBucketPolicyStatus",
          "s3:GetBucketAcl",
          "s3:GetBucketCORS",
          "s3:GetBucketWebsite",
          "s3:GetBucketLocation",
          "s3:GetBucketTagging",
          "s3:GetBucketRequestPayment",
          "s3:GetBucketOwnershipControls"
        ]
        Resource = "*"
      },
      {
        Sid    = "IAMReadPermissions"
        Effect = "Allow"
        Action = [
          "iam:Get*",
          "iam:List*",
          "iam:GenerateCredentialReport",
          "iam:GenerateServiceLastAccessedDetails",
          "iam:GetCredentialReport",
          "iam:GetServiceLastAccessedDetails",
          "iam:SimulatePrincipalPolicy",
          "iam:SimulateCustomPolicy"
        ]
        Resource = "*"
      },
      {
        Sid    = "RDSReadPermissions"
        Effect = "Allow"
        Action = [
          "rds:Describe*",
          "rds:List*"
        ]
        Resource = "*"
      },
      {
        Sid    = "LambdaReadPermissions"
        Effect = "Allow"
        Action = [
          "lambda:Get*",
          "lambda:List*"
        ]
        Resource = "*"
      },
      {
        Sid    = "KMSReadPermissions"
        Effect = "Allow"
        Action = [
          "kms:Describe*",
          "kms:Get*",
          "kms:List*"
        ]
        Resource = "*"
      },
      {
        Sid    = "CloudFormationReadPermissions"
        Effect = "Allow"
        Action = [
          "cloudformation:Describe*",
          "cloudformation:Get*",
          "cloudformation:List*"
        ]
        Resource = "*"
      }
    ]
  })
  
  tags = var.tags
}

# Security Audit Policy
resource "aws_iam_policy" "security_audit_policy" {
  name        = "${var.role_name}-SecurityAuditPolicy"
  description = "Security-focused read permissions for compliance auditing"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SecurityHubReadPermissions"
        Effect = "Allow"
        Action = [
          "securityhub:Get*",
          "securityhub:List*",
          "securityhub:Describe*"
        ]
        Resource = "*"
      },
      {
        Sid    = "GuardDutyReadPermissions"
        Effect = "Allow"
        Action = [
          "guardduty:Get*",
          "guardduty:List*",
          "guardduty:Describe*"
        ]
        Resource = "*"
      },
      {
        Sid    = "InspectorReadPermissions"
        Effect = "Allow"
        Action = [
          "inspector:Describe*",
          "inspector:Get*",
          "inspector:List*",
          "inspector2:Get*",
          "inspector2:List*",
          "inspector2:Describe*"
        ]
        Resource = "*"
      },
      {
        Sid    = "MacieReadPermissions"
        Effect = "Allow"
        Action = [
          "macie2:Get*",
          "macie2:List*",
          "macie2:Describe*"
        ]
        Resource = "*"
      },
      {
        Sid    = "AccessAnalyzerReadPermissions"
        Effect = "Allow"
        Action = [
          "access-analyzer:Get*",
          "access-analyzer:List*"
        ]
        Resource = "*"
      },
      {
        Sid    = "TrustedAdvisorReadPermissions"
        Effect = "Allow"
        Action = [
          "support:Describe*",
          "support:Get*"
        ]
        Resource = "*"
      }
    ]
  })
  
  tags = var.tags
}

# Config Read Policy
resource "aws_iam_policy" "config_read_policy" {
  name        = "${var.role_name}-ConfigReadPolicy"
  description = "AWS Config read permissions for compliance rule evaluation"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ConfigReadPermissions"
        Effect = "Allow"
        Action = [
          "config:Get*",
          "config:List*",
          "config:Describe*",
          "config:BatchGet*",
          "config:SelectResourceConfig"
        ]
        Resource = "*"
      },
      {
        Sid    = "SSMReadPermissions"
        Effect = "Allow"
        Action = [
          "ssm:Get*",
          "ssm:List*",
          "ssm:Describe*"
        ]
        Resource = "*"
      }
    ]
  })
  
  tags = var.tags
}

# CloudTrail Read Policy
resource "aws_iam_policy" "cloudtrail_read_policy" {
  name        = "${var.role_name}-CloudTrailReadPolicy"
  description = "CloudTrail read permissions for audit trail analysis"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudTrailReadPermissions"
        Effect = "Allow"
        Action = [
          "cloudtrail:Get*",
          "cloudtrail:List*",
          "cloudtrail:Describe*",
          "cloudtrail:LookupEvents"
        ]
        Resource = "*"
      },
      {
        Sid    = "CloudWatchLogsReadPermissions"
        Effect = "Allow"
        Action = [
          "logs:Describe*",
          "logs:Get*",
          "logs:List*",
          "logs:FilterLogEvents",
          "logs:StartQuery",
          "logs:StopQuery",
          "logs:GetQueryResults"
        ]
        Resource = "*"
      },
      {
        Sid    = "CloudWatchReadPermissions"
        Effect = "Allow"
        Action = [
          "cloudwatch:Get*",
          "cloudwatch:List*",
          "cloudwatch:Describe*"
        ]
        Resource = "*"
      }
    ]
  })
  
  tags = var.tags
}

# Attach policies to role
resource "aws_iam_role_policy_attachment" "compliance_scan_policy" {
  role       = aws_iam_role.scan_role.name
  policy_arn = aws_iam_policy.compliance_scan_policy.arn
}

resource "aws_iam_role_policy_attachment" "security_audit_policy" {
  role       = aws_iam_role.scan_role.name
  policy_arn = aws_iam_policy.security_audit_policy.arn
}

resource "aws_iam_role_policy_attachment" "config_read_policy" {
  role       = aws_iam_role.scan_role.name
  policy_arn = aws_iam_policy.config_read_policy.arn
}

resource "aws_iam_role_policy_attachment" "cloudtrail_read_policy" {
  role       = aws_iam_role.scan_role.name
  policy_arn = aws_iam_policy.cloudtrail_read_policy.arn
}

# Outputs
output "role_arn" {
  description = "ARN of the created compliance scanning role"
  value       = aws_iam_role.scan_role.arn
}

output "role_name" {
  description = "Name of the created compliance scanning role"
  value       = aws_iam_role.scan_role.name
}

output "role_id" {
  description = "ID of the created compliance scanning role"
  value       = aws_iam_role.scan_role.id
}

output "external_id" {
  description = "External ID used for role assumption"
  value       = var.external_id
  sensitive   = true
}

output "assume_role_command" {
  description = "AWS CLI command to assume this role"
  value = join(" ", [
    "aws sts assume-role",
    "--role-arn ${aws_iam_role.scan_role.arn}",
    "--role-session-name compliance-scan-session",
    "--external-id ${var.external_id}"
  ])
}
