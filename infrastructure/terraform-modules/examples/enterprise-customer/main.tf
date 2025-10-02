# Example: Enterprise customer onboarding with advanced features

module "enterprise_customer" {
  source = "../.."
  
  # Required parameters
  customer_account_id = "123456789012"
  service_account_id   = "987654321098"
  customer_name        = "Enterprise Corp"
  customer_email       = "ciso@enterprise.com"
  
  # Enterprise tier with full features
  customer_tier        = "ENTERPRISE"
  customer_region      = "us-east-1"
  environment          = "prod"
  
  # Multi-region scanning
  allowed_regions = [
    "us-east-1", "us-west-2", "us-west-1",
    "eu-west-1", "eu-central-1", "eu-north-1",
    "ap-southeast-1", "ap-northeast-1"
  ]
  
  # Advanced notification settings
  slack_webhook_url = "https://hooks.slack.com/services/xxx/yyy/zzz"  # Configure actual Slack URL
  github_repositories = [
    "Enterprise-Corp/infrastructure",
    "Enterprise-Corp/applications",
    "Enterprise-Corp/security-configs"
  ]
  
  # Intensive scanning schedule
  scan_schedule_expression = "rate(6 hours)"
  
  # Advanced features
  enable_auto_remediation = true  # Enable automated remediation
  log_retention_days     = 365   # Long-term retention for compliance
  trust_boundary_ip_ranges = [
    "10.0.0.0/8",
    "172.16.0.0/12", 
    "192.168.0.0/16",
    "x.x.x.x/32"  # Specific IP for admin access
  ]
  
  encoder_key_id = "arn:aws:kms:us-east1:123456789012:key/xxxxxxxx"  # Use existing KMS key
  
  # Compliance and security tags
  tags = {
    Environment         = "production"
    Project            = "compliance"
    Department        = "security"
    CostCenter       <｜tool▁calls▁end｜> "IT001"
    ComplianceFramework = "SOC2,TYPE-II"
    DataClassification = "confidential"
    Owner             = "security-team"
    Backup           = "required"
  }
}

output "enterprise_setup_summaries" {
  description = "Enterprise customer onboarding summary"
  value = {
    scan_role_arn = module.enterprise_customer.cross_account_role_arn
    remediation_role_arn = module.enterprise_customer.remediation_role_arn
    audit_role_arn = module.enterprise_customer.audit_role_arn
    tenant_id     = module.enterprise_customer.customer_tenant_id
    external_id   = module.enterprise_customer.external_id
    validation_endpoint = module.enterprise_customer.validation_endpoint
    next_steps = module.enterprise_customer.next_steps
  }
}
