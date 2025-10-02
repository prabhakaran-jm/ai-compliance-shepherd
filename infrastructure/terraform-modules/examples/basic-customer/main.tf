# Example: Basic customer onboarding for AI Compliance Shepherd

module "basic_customer" {
  source = "../.."
  
  # Required parameters
  customer_account_id = "123456789012"
  service_account_id   = "987654321098"  # AI Compliance Shepherd service account
  customer_name        = "Example Corp"
  customer_email       = "security@example.com"
  
  # Tier and configuration
  customer_tier        = "STANDARD"
  customer_region      = "us-east-1"
  environment          = "prod"
  
  # Scanning configuration
  allowed_regions = [
    "us-east-1",
    "us-west-2",
    "eu-west-1"
  ]
  
  # Notification settings
  slack_webhook_url = ""  # Configure if Slack notifications are needed
  github_repositories = []  # Configure if GitHub integration is needed
  
  # Scan scheduling
  scan_schedule_expression = "rate(24 hours)"
  
  # Security settings
  enable_auto_remediation = false  # Start with manual remediation first
  log_retention_days     = 30
  trust_boundary_ip_ranges = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
  
  # Standard tags
  tags = {
    Environment = "production"
    Project     = "compliance"
    Department  = "security"
    CostCenter  = "IT001"
  }
}

# Example outputs to use after deployment
output "customer_setup_summaries" {
  description = "Summary of customer onboarding results"
  value = {
    scan_role_arn = module.basic_customer.cross_account_role_arn
    tenant_id     = module.basic_customer.customer_tenant_id
    external_id   = module.basic_customer.external_id
    validation_endpoint = module.basic_customer.validation_endpoint
    dashboard_url = module.basic_customer.monitoring_summary.dashboard_url
  }
}
