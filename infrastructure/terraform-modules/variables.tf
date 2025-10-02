# Variables for AI Compliance Shepherd Terraform Modules

variable "customer_account_id" {
  description = "AWS Account ID of the customer"
  type        = string
}

variable "service_account_id" {
  description = "AWS Account ID of the AI Compliance Shepherd service"
  type        = string
}

variable "customer_region" {
  description = "AWS region for customer resources"
  type        = string
  default     = "us-east-1"
}

variable "customer_tier" {
  description = "Customer subscription tier (BASIC, STANDARD, PREMIUM, ENTERPRISE)"
  type        = string
  default     = "STANDARD"
  validation {
    condition = contains(["BASIC", "STANDARD", "PREMIUM", "ENTERPRISE"], var.customer_tier)
    error_message = "Customer tier must be BASIC, STANDARD, PREMIUM, or ENTERPRISE."
  }
}

variable "customer_name" {
  description = "Customer organization name"
  type        = string
}

variable "customer_email" {
  description = "Customer contact email"
  type        = string
}

variable "allowed_regions" {
  description = "List of AWS regions the service is allowed to scan"
  type        = list(string)
  default     = ["us-east-1", "us-west-2", "eu-west-1"]
}

variable "scan_schedule_expression" {
  description = "CloudWatch Events schedule expression for automated scans"
  type        = string
  default     = "rate(24 hours)"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "enable_auto_remediation" {
  description = "Enable automatic remediation features"
  type        = bool
  default     = false
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications (optional)"
  type        = string
  default     = ""
}

variable "github_repositories" {
  description = "List of GitHub repositories for webhook integration"
  type        = list(string)
  default     = []
}

variable "encryption_key_id" {
  description = "KMS key ID for encryption (if using existing key)"
  type        = string
  default     = ""
}

variable "trust_boundary_ip_ranges" {
  description = "IP ranges allowed to access compliance data"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 30
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
  validation {
    condition = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}
