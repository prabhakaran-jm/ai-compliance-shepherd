#!/bin/bash

# AI Compliance Shepherd - Terraform Module Deployment Script
# This script automates customer onboarding using Terraform modules

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
DEFAULT_REGION="us-east-1"
DEFAULT_TIER="STANDARD"
DEFAULT_ENVIRONMENT="prod"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to validate AWS credentials
validate_aws_credentials() {
    print_status "Validating AWS credentials..."
    
    if ! aws sts get-caller-identity > /dev/null 2>&1; then
        print_error "AWS credentials not configured or invalid"
        print_status "Please configure AWS credentials using:"
        print_status "  aws configure"
        print_status "  or"
        print_status "  export AWS_ACCESS_KEY_ID=your_key"
        print_status "  export AWS_SECRET_ACCESS_KEY=your_secret"
        exit 1
    fi
    
    CUSTOMER_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    print_success "AWS credentials validated. Account ID: $CUSTOMER_ACCOUNT_ID"
}

# Function to prompt for customer information
get_customer_info() {
    print_status "Gathering customer information..."
    
    if [[ -z "${CUSTOMER_NAME:-}" ]]; then
        read -p "Enter customer organization name: " CUSTOMER_NAME
    fi
    
    if [[ -z "${CUSTOMER_EMAIL:-}" ]]; then
        read -p "Enter customer contact email: " CUSTOMER_EMAIL
    fi
    
    if [[ -z "${CUSTOMER_TIER:-}" ]]; then
        echo "Select customer tier:"
        echo "1) BASIC    ($99/month)     - Up to 1,000 resources, 24h scans"
        echo "2) STANDARD ($499/month)    - Up to 10,000 resources, 12h scans"
        echo "3) PREMIUM  ($1,999/month)  - Up to 50,000 resources, 6h scans"
        echo "4) ENTERPRISE (Custom)      - Unlimited resources, hourly scans"
        
        read -p "Enter choice (1-4) [default: 2]: " tier_choice
        
        case "${tier_choice:-2}" in
            1) CUSTOMER_TIER="BASIC" ;;
            2) CUSTOMER_TIER="STANDARD" ;;
            3) CUSTOMER_TIER="PREMIUM" ;;
            4) CUSTOMER_TIER="ENTERPRISE" ;;
            *) CUSTOMER_TIER="STANDARD" ;;
        esac
    fi
    
    if [[ -z "${AWS_REGION:-}" ]]; then
        read -p "Enter AWS region [$DEFAULT_REGION]: " AWS_REGION
        AWS_REGION="${AWS_REGION:-$DEFAULT_REGION}"
    fi
    
    if [[ -z "${ENVIRONMENT:-}" ]]; then SIGKILL
        read -p "Enter environment (dev/staging/prod) [$DEFAULT_ENVIRONMENT]: " ENVIRONMENT
        ENVIRONMENT="${ENVIRONMENT:-$DEFAULT_ENVIRONMENT}"
    fi
    
    print_success "Customer configuration:"
    print_status "  Name: $CUSTOMER_NAME"
    print_status "  Email: $CUSTOMER_EMAIL"
    print_status "  Tier: $CUSTOMER_TIER"
    print_status "  Region: $AWS_REGION"
    print_status "  Environment: $ENVIRONMENT"
    print_status "  Account ID: $CUSTOMER_ACCOUNT_ID"
}

# Function to configure advanced settings
get_advanced_settings() {
    print_status "Configuring advanced settings..."
    
    # Ask about auto-remediation
    if [[ -z "${ENABLE_AUTO_REMEDIATION:-}" ]]; then
        read -p "Enable auto-remediation? (y/N): " enable_remediation
        if [[ "${enable_remediation:-n}" =~ ^[Yy]$ ]]; then
            ENABLE_AUTO_REMEDIATION="true"
        else
            ENABLE_AUTO_REMEDIATION="false"
        fi
    fi
    
    # Ask about notification settings
    if [[ -z "${SLACK_WEBHOOK_URL:-}" ]]; then
        read -p "Enter Slack webhook URL (optional): " SLACK_WEBHOOK_URL
    fi
    
    if [[ -z "${GITHUB_REPOS:-}" ]]; then
        read -p "Enter GitHub repositories (comma-separated, optional): " github_repos_input
        if [[ -n "${github_repos_input:-}" ]]; then
            IFS=',' read -ra GITHUB_REPOS <<< "$github_repos_input"
        else
            GITHUB_REPOS=()
        fi
    fi
    
    # Ask about scan frequency
    if [[ -z "${SCAN_SCHEDULE:-}" ]]; then
        echo "Select scan schedule:"
        echo "1) Daily scanning"
        echo "2) Every 12 hours"
        echo "3) Every 6 hours"
        echo "4) Hourly scanning"
        echo "5) Custom cron expression"
        
        read -p "Enter choice (1-5) [default: 1]: " schedule_choice
        
        case "${schedule_choice:-1}" in
            1) SCAN_SCHEDULE="rate(24 hours)" ;;
            2) SCAN_SCHEDULE="rate(12 hours)" ;;
            3) SCAN_SCHEDULE="rate(6 hours)" ;;
            4) SCAN_SCHEDULE="rate(1 hour)" ;;
            5) 
                read -p "Enter custom cron expression: " SCAN_SCHEDULE
                ;;
            *) SCAN_SCHEDULE="rate(24 hours)" ;;
        esac
    fi
}

# Function to create Terraform configuration
create_terraform_config() {
    print_status "Creating Terraform configuration..."
    
    local terraform_file="infrastructure/terraform-modules/main.tf"
    
    # Backup existing main.tf if it exists
    if [[ -f "$terraform_file" ]]; then
        cp "$terraform_file" "$terraform_file.backup"
    fi
    
    # Create new main.tf with customer configuration
    cat > "$terraform_file" << EOF
# AI Compliance Shepherd Customer Onboarding Configuration
# Generated on: $(date)

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
  
  backend "s3" {
    key            = "ai-compliance-shepherd/customer-onboarding/\${var.customer_name}/terraform.tfstate"
    bucket         = "ai-compliance-shepherd-terraform-state"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "ai-compliance-shepherd-terraform-locks"
  }
}

provider "aws" {
  region = var.customer_region
  
  default_tags {
    tags = {
      Environment = var.environment
      Customer    = var.customer_name
      Service     = "ai-compliance-shepherd"
      ManagedBy   = "terraform"
    }
  }
}

module "customer_onboarding" {
  source = "../.."
  
  # Required parameters
  customer_account_id = "\$CUSTOMER_ACCOUNT_ID"
  service_account_id   = "987654321098"  # AI Compliance Shepherd service account
  customer_name        = "\$CUSTOMER_NAME"
  customer_email       = "\$CUSTOMER_EMAIL"
  
  # Configuration
  customer_tier        = "\$CUSTOMER_TIER"
  customer_region      = "\$AWS_REGION"
  environment          = "\$ENVIRONMENT"
  
  # Scanning configuration
  allowed_regions = [
    "\$AWS_REGION",
    "us-west-2",
    "eu-west-1"
  ]
  
  # Advanced settings
  enable_auto_remediation = $ENABLE_AUTO_REMEDIATION
  scan_schedule_expression = "\$SCAN_SCHEDULE"
  slack_webhook_url        = "\$SLACK_WEBHOOK_URL"
  
  # GitHub repositories
$(printf "  github_repositories = [\n%s  ]\n" "$(for repo in "${GITHUB_REPOS[@]}"; do echo "    \"$repo\","; done)")
  
  # Standard tags
  tags = {
    Environment    = "\$ENVIRONMENT"
    Project        = "compliance"
    Department     = "security"
    CustomerTier   = "\$CUSTOMER_TIER"
    CostCenter     = "IT001"
  }
}

output "customer_onboarding_summary" {
  description = "Summary of customer onboarding results"
  value = {
    scan_role_arn      = module.customer_onboarding.cross_account_role_arn
    audit_role_arn     = module.customer_onboarding.audit_role_arn
    tenant_id          = module.customer_onboarding.customer_tenant_id
    external_id        = module.customer_onboarding.external_id
    validation_endpoint = module.customer_onboarding.validation_endpoint
    dashboard_url      = "https://console.aws.amazon.com/cloudwatch/home?region=\$AWS_REGION#dashboards:name=compliance-shepherd-\$CUSTOMER_NAME-prod"
    next_steps         = module.customer_onboarding.next_steps
  }
}
EOF

    print_success "Terraform configuration created"
}

# Function to initialize Terraform
terraform_init() {
    print_status "Initializing Terraform..."
    
    cd infrastructure/terraform-modules
    
    # Create .terraformrc if it doesn't exist
    if [[ ! -f ~/.terraformrc ]]; then
        cat > ~/.terraformrc << EOF
credentials "aws" {
  type      = "aws"
  profile   = "default"
}
EOF
    fi
    
    # Initialize terraform
    terraform init -input=false
    
    print_success "Terraform initialized"
}

# Function to validate Terraform configuration
terraform_validate() {
    print_status "Validating Terraform configuration..."
    
    terraform fmt -check=true
    terraform validate
    
    print_success "Terraform configuration is valid"
}

# Function to run Terraform plan
terraform_plan() {
    print_status "Running Terraform plan..."
    
    terraform plan -out=tfplan
    
    # Ask for confirmation before applying
    echo
    print_warning "Please review the Terraform plan above."
    read -p "Do you want to proceed with deployment? (y/N): " confirm_deploy
    
    if [[ ! "${confirm_deploy:-n}" =~ ^[Yy]$ ]]; then
        print_status "Deployment cancelled by user"
        exit 0
    fi
    
    print_success "Plan approved by user"
}

# Function to run Terraform apply
terraform_apply() {
    print_status "Applying Terraform configuration..."
    
    terraform apply tfplan
    
    print_success "Terraform configuration applied successfully"
}

# Function to validate deployment
validate_deployment() {
    print_status "Validating deployment..."
    
    # Extract outputs
    local tenant_id
    local validation_endpoint
    local scan_role_arn
    
    tenant_id=$(terraform output -raw customer_onboarding_summary | jq -r '.tenant_id')
    validation_endpoint=$(terraform output -raw customer_onboarding_summary | jq -r '.validation_endpoint')
    scan_role_arn=$(terraform output -raw customer_onboarding_summary | jq -r '.scan_role_arn')
    
    print_success "Deployment validation results:"
    print_status "  Tenant ID: $tenant_id"
    print_status "  Scan Role ARN: $scan_role_arn"
    print_status "  Validation Endpoint: $validation_endpoint"
    
    # Test validation endpoint
    print_status "Testing validation endpoint..."
    if curl -s "$validation_endpoint" | grep -q "success"; then
        print_success "Validation endpoint test passed"
    else
        print_warning "Validation endpoint test failed - check configuration"
    fi
}

# Function to display next steps
show_next_steps() {
    print_success "Customer onboarding completed successfully!"
    echo
    
    print_status "Next steps for completing setup:"
    echo "  1. Configure notification settings in the web dashboard"
    echo "  2. Set up GitHub repository webhooks (if applicable)"
    echo "  3. Configure Slack notifications (if applicable)"
    echo "  4. Run initial compliance scan"
    echo "  5. Review initial findings and configure remediation workflows"
    echo "  6. Set up monitoring alerts and dashboards"
    echo
    
    print_status "Access your compliance dashboard at:"
    echo "  https://dashboard.ai-compliance-shepherd.com/tenants/$tenant_id"
    echo
    
    print_status "Important files created:"
    echo "  ├── terraform.tfstate          # Terraform state file"
    echo "  ├── tfplan                     # Terraform execution plan"
    echo "  └── main.tf                    # Customer configuration"
    echo
    print_warning "Keep these files secure - they contain sensitive information!"
}

# Function to cleanup temporary files
cleanup() {
    print_status "Cleaning up temporary files..."
    
    cd infrastructure/terraform-modules
    rm -f tfplan
    rm -f *.tf.backup
    
    print_success "Cleanup completed"
}

# Function to handle errors
handle_error() {
    print_error "Deployment failed at step: $1"
    print_status "Check the error above and fix any issues"
    print_status "You can resume deployment by running the script again"
    exit 1
}

# Main execution function
main() {
    print_status "Starting AI Compliance Shepherd customer onboarding..."
    echo
    
    # Validate prerequisites
    validate_aws_credentials
    
    # Gather customer information
    get_customer_info
    get_advanced_settings
    
    # Create and validate Terraform configuration
    create_terraform_config
    
    # Initialize Terraform
    terraform_init
    
    # Validate configuration
    terraform_validate
    
    # Plan deployment
    if ! terraform_plan; then
        handle_error "terraform plan"
    fi
    
    # Apply configuration
    if ! terraform_apply; then
        handle_error "terraform apply"
    fi
    
    # Validate deployment
    validate_deployment
    
    # Show next steps
    show_next_steps
    
    # Cleanup
    cleanup
    
    print_success "Customer onboarding completed successfully!"
}

# Script execution
trap 'handle_error "unknown"' ERR

# Check if running with --help
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    cat << EOF
AI Compliance Shepherd - Terraform Module Deployment Script

Usage: ./deploy.sh [OPTIONS]

Options:
  -h, --help          Show this help message
  --customer-name      Set customer organization name
  --customer-email     Set customer contact email
  --customer-tier      Set customer tier (BASIC/STANDARD/PREMIUM/ENTERPRISE)
  --aws-region         Set AWS region
  --environment        Set environment (dev/staging/prod)
  --auto-remediation   Enable auto-remediation (true/false)
  --slack-webhook      Set Slack webhook URL
  --github-repos       Set GitHub repositories (comma-separated)

Environment Variables:
  CUSTOMER_NAME           Customer organization name
  CUSTOMER_EMAIL          Customer contact email
  CUSTOMER_TIER           Customer tier
  AWS_REGION              AWS region
  ENVIRONMENT             Environment
  ENABLE_AUTO_REMEDIATION Enable auto-remediation
  SLACK_WEBHOOK_URL       Slack webhook URL
  GITHUB_REPOS            GitHub repositories (comma-separated)

Examples:
  # Interactive mode
  ./deploy.sh
  
  # Non-interactive mode
  ./deploy.sh --customer-name "Example Corp" --customer-email "security@example.com"
  
  # Enterprise setup
  CUSTOMER_NAME="Enterprise Corp" CUSTOMER_TIER="ENTERPRISE" ./deploy.sh

EOF
    exit 0
fi

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --customer-name)
            CUSTOMER_NAME="$2"
            shift 2
            ;;
        --customer-email)
            CUSTOMER_EMAIL="$2"
            shift 2
            ;;
        --customer-tier)
            CUSTOMER_TIER="$2"
            shift 2
            ;;
        --aws-region)
            AWS_REGION="$2"
            shift 2
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --auto-remediation)
            ENABLE_AUTO_REMEDIATION="$2"
            shift 2
            ;;
        --slack-webhook)
            SLACK_WEBHOOK_URL="$2"
            shift 2
            ;;
        --github-repos)
            IFS=',' read -ra GITHUB_REPOS <<< "$2"
            shift 2
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main "$@"
