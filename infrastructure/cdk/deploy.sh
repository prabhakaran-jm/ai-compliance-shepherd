#!/bin/bash

# AI Compliance Shepherd CDK Deployment Script
# This script deploys the complete infrastructure stack for AI Compliance Shepherd

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="dev"
REGION="us-east-1"
PROFILE="default"
DRY_RUN=false
VERBOSE=false

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

# Function to show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --environment ENV    Environment (dev, staging, prod) [default: dev]"
    echo "  -r, --region REGION      AWS region [default: us-east-1]"
    echo "  -p, --profile PROFILE     AWS profile [default: default]"
    echo "  -d, --dry-run            Perform a dry run (cdk diff)"
    echo "  -v, --verbose            Verbose output"
    echo "  -h, --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --environment prod --region us-west-2"
    echo "  $0 -e staging --dry-run"
    echo "  $0 --environment prod --profile production"
}

# Parse command line arguments
while [[ $# - gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -p|--profile)
            PROFILE="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac)
done

# Validate environment
if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "prod" ]]; then
    print_error "Invalid environment: $ENVIRONMENT. Must be one of: dev, staging, prod"
    exit 1
fi

# Set AWS profile
export AWS_PROFILE="$PROFILE"

print_status "Starting AI Compliance Shepherd CDK Deployment"
print_status "Environment: $ENVIRONMENT"
print_status "Region: $REGION"
print_status "Profile: $PROFILE"

# Check prerequisites
print_status "Checking prerequisites..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    print_error "AWS CDK is not installed. Please install it first:"
    echo "npm install -g aws-cdk"
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check AWS credentials
print_status "Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured or invalid. Please check your AWS configuration."
    exit 1
fi

print_success "Prerequisites check passed"

# Install dependencies
print_status "Installing CDK dependencies..."
npm install

# Bootstrap CDK if needed
print_status "Bootstrapping CDK for region $REGION..."
cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/$REGION

# Build the project
print_status "Building CDK project..."
npm run build

if [ "$DRY_RUN" = true ]; then
    print_status "Performing dry run (CDK diff)..."
    cdk diff --app 'npx ts-node app.ts' --context environment=$ENVIRONMENT --context region=$REGION
    print_success "Dry run completed"
    exit 0
fi

# Deploy stacks in dependency order
print_status "Deploying CDK stacks..."

deploy_stack() {
    local stack_name=$1
    local description=$2
    
    print_status "Deploying $description..."
    
    if [ "$VERBOSE" = true ]; then
        cdk deploy "$stack_name" \
            --app 'npx ts-node app.ts' \
            --context environment="$ENVIRONMENT" \
            --context region="$REGION" \
            --require-approval never \
            --verbose
    else
        cdk deploy "$stack_name" \
            --app 'npx ts-node app.ts' \
            --context environment="$ENVIRONMENT" \
            --context region="$REGION" \
            --require-approval never
    fi
    
    if [ $? -eq 0 ]; then
        print_success "$description deployed successfully"
    else
        print_error "Failed to deploy $description"
        exit 1
    fi
}

# Deploy stacks in the correct dependency order
deploy_stack "ai-compliance-dev-core" "Core Platform Stack"
deploy_stack "ai-compliance-dev-database" "Database Stack"
deploy_stack "ai-compliance-dev-security" "Security Stack"
deploy_stack "ai-compliance-dev-storage" "Storage Stack"
deploy_stack "ai-compliance-dev-lambda" "Lambda Stack"
deploy_stack "ai-compliance-dev-api" "API Stack"
deploy_stack "ai-compliance-dev-monitoring" "Monitoring Stack"
deploy_stack "ai-compliance-dev-integration" "Integration Stack"

# Deployment Summary
print_success "AI Compliance Shepherd deployment completed successfully!"
echo ""
echo "Environment Information:"
echo "  Environment: $ENVIRONMENT"
echo "  Region: $REGION"
echo "  AWS Account: $(aws sts get-caller-identity --query Account --output text)"
echo ""
echo "Next Steps:"
echo "1. Check CloudFormation stacks in AWS Console"
echo "2. View monitoring dashboard in CloudWatch"
echo "3. Configure third-party integrations (Slack, GitHub)"
echo "4. Run platform health checks"
echo "5. Generate demo data using: npm run demo:data"

# Optional: Display stack outputs
if [ "$VERBOSE" = true ]; then
    print_status "Retrieving stack outputs..."
    # This would retrieve and display stack outputs
    echo "Stack outputs can be found in AWS CloudFormation console"
fi

print_success "AI Compliance Shepherd is ready to use! 🚀"
