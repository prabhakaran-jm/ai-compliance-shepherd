#!/bin/bash

# AI Compliance Shepherd - Cross-Account IAM Roles Deployment Script
# This script automates the deployment of IAM roles for customer accounts

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$PROJECT_ROOT/terraform"
CLOUDFORMATION_DIR="$PROJECT_ROOT/cloudformation"

# Default values
DEPLOYMENT_METHOD="terraform"
DEPLOYMENT_TIER="STANDARD"
ENABLE_SCAN_ROLE="true"
ENABLE_REMEDIATION_ROLE="true"
ENABLE_AUDIT_ROLE="false"
ENABLE_READONLY_ROLE="true"
ENABLE_S3_REMEDIATION="true"
ENABLE_SG_REMEDIATION="true"
ENABLE_IAM_REMEDIATION="false"
INCLUDE_BILLING_DATA="false"
INCLUDE_HISTORICAL_DATA="true"
DRY_RUN="false"
VERBOSE="false"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Usage function
usage() {
    cat << EOF
AI Compliance Shepherd - Cross-Account IAM Roles Deployment Script

USAGE:
    $0 [OPTIONS]

REQUIRED OPTIONS:
    --platform-account-id ACCOUNT_ID    AWS Account ID of the AI Compliance Shepherd platform
    --customer-name NAME                 Customer name for role naming and tagging

OPTIONAL OPTIONS:
    --deployment-method METHOD           Deployment method: terraform|cloudformation (default: terraform)
    --deployment-tier TIER              Customer tier: BASIC|STANDARD|PREMIUM|ENTERPRISE (default: STANDARD)
    --external-id ID                     External ID for cross-account access (auto-generated if not provided)
    
    Role Deployment Options:
    --enable-scan-role BOOL             Deploy scanning role (default: true)
    --enable-remediation-role BOOL      Deploy remediation role (default: true)
    --enable-audit-role BOOL            Deploy audit role (default: false)
    --enable-readonly-role BOOL         Deploy readonly role (default: true)
    
    Remediation Capabilities:
    --enable-s3-remediation BOOL        Enable S3 remediation (default: true)
    --enable-sg-remediation BOOL        Enable Security Group remediation (default: true)
    --enable-iam-remediation BOOL       Enable IAM remediation (default: false, ENTERPRISE only)
    
    Audit Capabilities:
    --include-billing-data BOOL         Include billing data access (default: false)
    --include-historical-data BOOL      Include historical data access (default: true)
    
    Script Options:
    --dry-run                           Show what would be deployed without making changes
    --verbose                           Enable verbose output
    --help                              Show this help message

EXAMPLES:
    # Basic deployment for STANDARD tier customer
    $0 --platform-account-id 123456789012 --customer-name acme-corp
    
    # ENTERPRISE tier with all capabilities
    $0 --platform-account-id 123456789012 --customer-name enterprise-client \\
       --deployment-tier ENTERPRISE --enable-iam-remediation true \\
       --include-billing-data true
    
    # BASIC tier with minimal roles
    $0 --platform-account-id 123456789012 --customer-name startup-client \\
       --deployment-tier BASIC --enable-remediation-role false --enable-audit-role false
    
    # Dry run to see what would be deployed
    $0 --platform-account-id 123456789012 --customer-name test-client --dry-run

NOTES:
    - External ID will be auto-generated if not provided
    - IAM remediation is only available for ENTERPRISE tier
    - Billing data access is only available for PREMIUM and ENTERPRISE tiers
    - All boolean options accept: true|false, yes|no, 1|0

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --platform-account-id)
                PLATFORM_ACCOUNT_ID="$2"
                shift 2
                ;;
            --customer-name)
                CUSTOMER_NAME="$2"
                shift 2
                ;;
            --deployment-method)
                DEPLOYMENT_METHOD="$2"
                shift 2
                ;;
            --deployment-tier)
                DEPLOYMENT_TIER="$2"
                shift 2
                ;;
            --external-id)
                EXTERNAL_ID="$2"
                shift 2
                ;;
            --enable-scan-role)
                ENABLE_SCAN_ROLE="$2"
                shift 2
                ;;
            --enable-remediation-role)
                ENABLE_REMEDIATION_ROLE="$2"
                shift 2
                ;;
            --enable-audit-role)
                ENABLE_AUDIT_ROLE="$2"
                shift 2
                ;;
            --enable-readonly-role)
                ENABLE_READONLY_ROLE="$2"
                shift 2
                ;;
            --enable-s3-remediation)
                ENABLE_S3_REMEDIATION="$2"
                shift 2
                ;;
            --enable-sg-remediation)
                ENABLE_SG_REMEDIATION="$2"
                shift 2
                ;;
            --enable-iam-remediation)
                ENABLE_IAM_REMEDIATION="$2"
                shift 2
                ;;
            --include-billing-data)
                INCLUDE_BILLING_DATA="$2"
                shift 2
                ;;
            --include-historical-data)
                INCLUDE_HISTORICAL_DATA="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --verbose)
                VERBOSE="true"
                shift
                ;;
            --help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
}

# Validate required arguments
validate_args() {
    local errors=0
    
    if [[ -z "${PLATFORM_ACCOUNT_ID:-}" ]]; then
        log_error "Platform Account ID is required"
        errors=$((errors + 1))
    elif [[ ! "$PLATFORM_ACCOUNT_ID" =~ ^[0-9]{12}$ ]]; then
        log_error "Platform Account ID must be a 12-digit number"
        errors=$((errors + 1))
    fi
    
    if [[ -z "${CUSTOMER_NAME:-}" ]]; then
        log_error "Customer name is required"
        errors=$((errors + 1))
    elif [[ ! "$CUSTOMER_NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        log_error "Customer name must contain only alphanumeric characters, hyphens, and underscores"
        errors=$((errors + 1))
    fi
    
    if [[ ! "$DEPLOYMENT_METHOD" =~ ^(terraform|cloudformation)$ ]]; then
        log_error "Deployment method must be 'terraform' or 'cloudformation'"
        errors=$((errors + 1))
    fi
    
    if [[ ! "$DEPLOYMENT_TIER" =~ ^(BASIC|STANDARD|PREMIUM|ENTERPRISE)$ ]]; then
        log_error "Deployment tier must be BASIC, STANDARD, PREMIUM, or ENTERPRISE"
        errors=$((errors + 1))
    fi
    
    if [[ $errors -gt 0 ]]; then
        log_error "Please fix the above errors and try again"
        exit 1
    fi
}

# Normalize boolean values
normalize_bool() {
    local value="$1"
    case "${value,,}" in
        true|yes|1) echo "true" ;;
        false|no|0) echo "false" ;;
        *) echo "$value" ;;
    esac
}

# Normalize all boolean variables
normalize_bools() {
    ENABLE_SCAN_ROLE=$(normalize_bool "$ENABLE_SCAN_ROLE")
    ENABLE_REMEDIATION_ROLE=$(normalize_bool "$ENABLE_REMEDIATION_ROLE")
    ENABLE_AUDIT_ROLE=$(normalize_bool "$ENABLE_AUDIT_ROLE")
    ENABLE_READONLY_ROLE=$(normalize_bool "$ENABLE_READONLY_ROLE")
    ENABLE_S3_REMEDIATION=$(normalize_bool "$ENABLE_S3_REMEDIATION")
    ENABLE_SG_REMEDIATION=$(normalize_bool "$ENABLE_SG_REMEDIATION")
    ENABLE_IAM_REMEDIATION=$(normalize_bool "$ENABLE_IAM_REMEDIATION")
    INCLUDE_BILLING_DATA=$(normalize_bool "$INCLUDE_BILLING_DATA")
    INCLUDE_HISTORICAL_DATA=$(normalize_bool "$INCLUDE_HISTORICAL_DATA")
    DRY_RUN=$(normalize_bool "$DRY_RUN")
    VERBOSE=$(normalize_bool "$VERBOSE")
}

# Generate external ID if not provided
generate_external_id() {
    if [[ -z "${EXTERNAL_ID:-}" ]]; then
        EXTERNAL_ID="acs-$(openssl rand -hex 16)"
        log_info "Generated external ID: $EXTERNAL_ID"
    fi
}

# Validate tier-specific configurations
validate_tier_config() {
    case "$DEPLOYMENT_TIER" in
        BASIC)
            if [[ "$ENABLE_REMEDIATION_ROLE" == "true" ]]; then
                log_warning "Remediation role is not typically enabled for BASIC tier"
            fi
            if [[ "$ENABLE_AUDIT_ROLE" == "true" ]]; then
                log_warning "Audit role is not available for BASIC tier"
                ENABLE_AUDIT_ROLE="false"
            fi
            ;;
        STANDARD)
            if [[ "$ENABLE_AUDIT_ROLE" == "true" ]]; then
                log_warning "Audit role is not available for STANDARD tier"
                ENABLE_AUDIT_ROLE="false"
            fi
            ;;
        PREMIUM)
            if [[ "$ENABLE_IAM_REMEDIATION" == "true" ]]; then
                log_warning "IAM remediation is only available for ENTERPRISE tier"
                ENABLE_IAM_REMEDIATION="false"
            fi
            ;;
        ENTERPRISE)
            # All features available
            ;;
    esac
    
    # Billing data only for PREMIUM and ENTERPRISE
    if [[ "$INCLUDE_BILLING_DATA" == "true" && ! "$DEPLOYMENT_TIER" =~ ^(PREMIUM|ENTERPRISE)$ ]]; then
        log_warning "Billing data access is only available for PREMIUM and ENTERPRISE tiers"
        INCLUDE_BILLING_DATA="false"
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is required but not installed"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or invalid"
        exit 1
    fi
    
    # Check deployment method specific tools
    case "$DEPLOYMENT_METHOD" in
        terraform)
            if ! command -v terraform &> /dev/null; then
                log_error "Terraform is required but not installed"
                exit 1
            fi
            ;;
        cloudformation)
            # AWS CLI is sufficient for CloudFormation
            ;;
    esac
    
    log_success "Prerequisites check passed"
}

# Display deployment plan
show_deployment_plan() {
    log_info "Deployment Plan:"
    echo "=================="
    echo "Customer Name: $CUSTOMER_NAME"
    echo "Deployment Tier: $DEPLOYMENT_TIER"
    echo "Platform Account: $PLATFORM_ACCOUNT_ID"
    echo "External ID: $EXTERNAL_ID"
    echo "Deployment Method: $DEPLOYMENT_METHOD"
    echo ""
    echo "Roles to Deploy:"
    echo "  Scan Role: $ENABLE_SCAN_ROLE"
    echo "  Remediation Role: $ENABLE_REMEDIATION_ROLE"
    echo "  Audit Role: $ENABLE_AUDIT_ROLE"
    echo "  Read-Only Role: $ENABLE_READONLY_ROLE"
    echo ""
    echo "Capabilities:"
    echo "  S3 Remediation: $ENABLE_S3_REMEDIATION"
    echo "  Security Group Remediation: $ENABLE_SG_REMEDIATION"
    echo "  IAM Remediation: $ENABLE_IAM_REMEDIATION"
    echo "  Billing Data Access: $INCLUDE_BILLING_DATA"
    echo "  Historical Data Access: $INCLUDE_HISTORICAL_DATA"
    echo "=================="
    echo ""
}

# Deploy using Terraform
deploy_terraform() {
    log_info "Deploying using Terraform..."
    
    cd "$TERRAFORM_DIR"
    
    # Initialize Terraform
    log_info "Initializing Terraform..."
    terraform init
    
    # Create terraform.tfvars file
    cat > terraform.tfvars << EOF
platform_account_id = "$PLATFORM_ACCOUNT_ID"
customer_name = "$CUSTOMER_NAME"
deployment_tier = "$DEPLOYMENT_TIER"
external_id = "$EXTERNAL_ID"
enable_scan_role = $ENABLE_SCAN_ROLE
enable_remediation_role = $ENABLE_REMEDIATION_ROLE
enable_audit_role = $ENABLE_AUDIT_ROLE
enable_readonly_role = $ENABLE_READONLY_ROLE
enable_s3_remediation = $ENABLE_S3_REMEDIATION
enable_security_group_remediation = $ENABLE_SG_REMEDIATION
enable_iam_remediation = $ENABLE_IAM_REMEDIATION
include_billing_data = $INCLUDE_BILLING_DATA
include_historical_data = $INCLUDE_HISTORICAL_DATA

tags = {
  DeployedBy = "deploy-roles.sh"
  DeploymentDate = "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    
    # Plan deployment
    log_info "Planning Terraform deployment..."
    if [[ "$VERBOSE" == "true" ]]; then
        terraform plan -var-file=terraform.tfvars
    else
        terraform plan -var-file=terraform.tfvars > /dev/null
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run completed. No resources were created."
        return 0
    fi
    
    # Apply deployment
    log_info "Applying Terraform deployment..."
    if [[ "$VERBOSE" == "true" ]]; then
        terraform apply -var-file=terraform.tfvars -auto-approve
    else
        terraform apply -var-file=terraform.tfvars -auto-approve > /dev/null
    fi
    
    # Show outputs
    log_success "Terraform deployment completed!"
    terraform output -json > "${CUSTOMER_NAME}-deployment-outputs.json"
    log_info "Deployment outputs saved to: ${CUSTOMER_NAME}-deployment-outputs.json"
}

# Deploy using CloudFormation
deploy_cloudformation() {
    log_info "Deploying using CloudFormation..."
    
    local stack_name="ai-compliance-shepherd-${CUSTOMER_NAME}"
    
    # Prepare parameters
    local parameters=(
        "ParameterKey=PlatformAccountId,ParameterValue=$PLATFORM_ACCOUNT_ID"
        "ParameterKey=ExternalId,ParameterValue=$EXTERNAL_ID"
        "ParameterKey=CustomerName,ParameterValue=$CUSTOMER_NAME"
        "ParameterKey=DeploymentTier,ParameterValue=$DEPLOYMENT_TIER"
        "ParameterKey=EnableScanRole,ParameterValue=$ENABLE_SCAN_ROLE"
        "ParameterKey=EnableRemediationRole,ParameterValue=$ENABLE_REMEDIATION_ROLE"
        "ParameterKey=EnableAuditRole,ParameterValue=$ENABLE_AUDIT_ROLE"
        "ParameterKey=EnableReadOnlyRole,ParameterValue=$ENABLE_READONLY_ROLE"
        "ParameterKey=EnableS3Remediation,ParameterValue=$ENABLE_S3_REMEDIATION"
        "ParameterKey=EnableSecurityGroupRemediation,ParameterValue=$ENABLE_SG_REMEDIATION"
        "ParameterKey=EnableIAMRemediation,ParameterValue=$ENABLE_IAM_REMEDIATION"
        "ParameterKey=IncludeBillingData,ParameterValue=$INCLUDE_BILLING_DATA"
        "ParameterKey=IncludeHistoricalData,ParameterValue=$INCLUDE_HISTORICAL_DATA"
    )
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run: Would deploy CloudFormation stack '$stack_name' with parameters:"
        printf '%s\n' "${parameters[@]}"
        return 0
    fi
    
    # Deploy stack
    log_info "Deploying CloudFormation stack: $stack_name"
    aws cloudformation create-stack \
        --stack-name "$stack_name" \
        --template-body "file://$CLOUDFORMATION_DIR/master-template.yaml" \
        --parameters "${parameters[@]}" \
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
        --tags "Key=CustomerName,Value=$CUSTOMER_NAME" \
               "Key=DeploymentTier,Value=$DEPLOYMENT_TIER" \
               "Key=DeployedBy,Value=deploy-roles.sh" \
               "Key=DeploymentDate,Value=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    
    # Wait for completion
    log_info "Waiting for stack deployment to complete..."
    aws cloudformation wait stack-create-complete --stack-name "$stack_name"
    
    # Get outputs
    aws cloudformation describe-stacks --stack-name "$stack_name" \
        --query 'Stacks[0].Outputs' > "${CUSTOMER_NAME}-deployment-outputs.json"
    
    log_success "CloudFormation deployment completed!"
    log_info "Deployment outputs saved to: ${CUSTOMER_NAME}-deployment-outputs.json"
}

# Validate deployment
validate_deployment() {
    log_info "Validating deployment..."
    
    local current_account
    current_account=$(aws sts get-caller-identity --query Account --output text)
    
    # Test role assumptions if roles were deployed
    if [[ "$ENABLE_SCAN_ROLE" == "true" ]]; then
        local scan_role_arn="arn:aws:iam::${current_account}:role/AIComplianceShepherd-${CUSTOMER_NAME}-ScanRole"
        log_info "Testing scan role assumption..."
        if aws sts assume-role \
            --role-arn "$scan_role_arn" \
            --role-session-name "validation-test" \
            --external-id "$EXTERNAL_ID" \
            --query 'Credentials.AccessKeyId' \
            --output text > /dev/null; then
            log_success "Scan role assumption test passed"
        else
            log_error "Scan role assumption test failed"
        fi
    fi
    
    # Additional validation tests can be added here
    
    log_success "Deployment validation completed"
}

# Main function
main() {
    log_info "AI Compliance Shepherd - Cross-Account IAM Roles Deployment"
    log_info "============================================================"
    
    parse_args "$@"
    validate_args
    normalize_bools
    generate_external_id
    validate_tier_config
    check_prerequisites
    show_deployment_plan
    
    if [[ "$DRY_RUN" == "false" ]]; then
        read -p "Do you want to proceed with this deployment? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Deployment cancelled by user"
            exit 0
        fi
    fi
    
    case "$DEPLOYMENT_METHOD" in
        terraform)
            deploy_terraform
            ;;
        cloudformation)
            deploy_cloudformation
            ;;
    esac
    
    if [[ "$DRY_RUN" == "false" ]]; then
        validate_deployment
        
        log_success "Deployment completed successfully!"
        log_info "Next steps:"
        log_info "1. Securely store the external ID: $EXTERNAL_ID"
        log_info "2. Configure the AI Compliance Shepherd platform with the role ARNs"
        log_info "3. Test the compliance scanning functionality"
        log_info "4. Set up monitoring and alerting for role usage"
    fi
}

# Run main function with all arguments
main "$@"
