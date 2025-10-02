# Variables for Monitoring module

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

variable "customer_region" {
  description = "AWS region for customer resources"
  type        = string
}

variable "tenant_id" {
  description = "Unique customer tenant identifier"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 30
}

variable "kms_key_arn" {
  description = "ARN of the KMS key for encryption"
  type        = string
}

variable "scan_schedule_expression" {
  description = "CloudWatch Events schedule expression for automated scans"
  type        = string
  default     = "rate(24 hours)"
}

variable "monitor_cost" {
  description = " Enable cost monitoring alerts"
  type        = bool
  default     = true
}

variable "cost_threshold" {
  description = "Cost threshold for anomaly detection"
  type        = number
  default     = 1000  # $10 USD
}

variable "enable_xray_tracing" {
  description = "Enable X-Ray distributed tracing"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
