# Variables for IAM Roles module

variable "customer_account_id" {
  description = "AWS Account ID of the customer"
  type        = string
}

variable "service_account_id" {
  description = "AWS Account ID of the AI Compliance Shepherd service"
  type        = string
}

variable "customer_name" {
  description = "Customer organization name"
  type        = string
}

variable "customer_tier" {
  description = "Customer subscription tier"
  type        = string
  validation {
    condition = contains(["BASIC", "STANDARD", "PREMIUM", "ENTERPRISE"], var.customer_tier)
    error_message = "Customer tier must be BASIC, STANDARD, PREMIUM, or ENTERPRISE."
  }
}

variable "tenant_id" {
  description = "Unique customer tenant identifier"
  type        = string
}

variable "external_id" {
  description = "External ID for secure cross-account access"
  type        = string
  sensitive   = true
}

variable "enable_auto_remediation" {
  description = "Enable automatic remediation features"
  type        = bool
  default     = false
}

variable "allowed_regions" {
  description = "List of AWS regions the service is allowed to scan"
  type        = list(string)
  default     = ["us-east-1", "us-west-2", "eu-west-1"]
}

variable "permissions" {
  description = "Permissions configuration for different role types"
  type = object({
    read_permissions        = list(string)
    scan_permissions        = list(string)
    remediation_permissions = list(string)
    audit_permissions       = list(string)
  })
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
