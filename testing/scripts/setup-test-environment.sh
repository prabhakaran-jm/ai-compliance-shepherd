#!/bin/bash

# AI Compliance Shepherd - Test Environment Setup Script
# This script sets up the complete testing environment including dependencies,
# test data, and external services required for testing

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTING_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$TESTING_DIR")"

# Function to print colored output
print_status() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

# Function to print section headers
print_header() {
  local message=$1
  echo ""
  echo "================================================="
  echo "$message"
  echo "================================================="
  echo ""
}

# Function to check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to install Node.js dependencies
install_dependencies() {
  print_header "Installing Dependencies"
  
  # Install main testing dependencies
  print_status $YELLOW "📦 Installing main testing dependencies..."
  cd "$TESTING_DIR"
  npm install
  
  # Install unit test dependencies
  if [[ -d "unit-tests" ]]; then
    print_status $YELLOW "📦 Installing unit test dependencies..."
    cd "$TESTING_DIR/unit-tests"
    npm install || npm install --legacy-peer-deps
  fi
  
  # Install integration test dependencies
  if [[ -d "integration-tests" ]]; then
    print_status $YELLOW "📦 Installing integration test dependencies..."
    cd "$TESTING_DIR/integration-tests"
    npm install || npm install --legacy-peer-deps
  fi
  
  # Install E2E test dependencies
  if [[ -d "e2e-tests" ]]; then
    print_status $YELLOW "📦 Installing E2E test dependencies..."
    cd "$TESTING_DIR/e2e-tests"
    npm install || npm install --legacy-peer-deps
    
    # Install Playwright browsers
    print_status $YELLOW "🎭 Installing Playwright browsers..."
    npx playwright install
    npx playwright install-deps
  fi
  
  print_status $GREEN "✅ Dependencies installed successfully"
}

# Function to setup Docker and LocalStack
setup_localstack() {
  print_header "Setting Up LocalStack"
  
  if ! command_exists docker; then
    print_status $YELLOW "⚠️  Docker not found. Installing Docker..."
    
    # Check if running in CI or if user wants to install Docker
    if [[ "${CI:-false}" == "true" ]] || [[ "${INSTALL_DOCKER:-false}" == "true" ]]; then
      # Install Docker (Ubuntu/Debian)
      if command_exists apt-get; then
        sudo apt-get update
        sudo apt-get install -y docker.io
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -aG docker $USER
      # Install Docker (CentOS/RHEL)
      elif command_exists yum; then
        sudo yum install -y docker
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -aG docker $USER
      # Install Docker (macOS)
      elif [[ "$OSTYPE" == "darwin"* ]]; then
        print_status $YELLOW "Please install Docker Desktop for macOS from https://docs.docker.com/desktop/mac/install/"
        exit 1
      else
        print_status $RED "❌ Cannot automatically install Docker on this system"
        print_status $YELLOW "Please install Docker manually and run this script again"
        exit 1
      fi
    else
      print_status $YELLOW "Docker not found. Please install Docker and run this script again."
      print_status $BLUE "Visit: https://docs.docker.com/get-docker/"
      exit 1
    fi
  fi
  
  print_status $GREEN "✅ Docker is available"
  
  # Pull LocalStack image
  print_status $YELLOW "🐳 Pulling LocalStack image..."
  docker pull localstack/localstack:latest
  
  # Create docker-compose file for LocalStack
  cat > "$TESTING_DIR/docker-compose.test.yml" << 'EOF'
version: '3.8'

services:
  localstack:
    container_name: ai-compliance-test-localstack
    image: localstack/localstack:latest
    ports:
      - "4566:4566"
    environment:
      - SERVICES=dynamodb,s3,lambda,cloudwatch,kms,secretsmanager,sts,iam,sns,events
      - DEBUG=1
      - DATA_DIR=/tmp/localstack/data
      - LAMBDA_EXECUTOR=docker
      - DOCKER_HOST=unix:///var/run/docker.sock
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - localstack_data:/tmp/localstack
    networks:
      - ai-compliance-test

networks:
  ai-compliance-test:
    driver: bridge

volumes:
  localstack_data:
EOF
  
  print_status $GREEN "✅ LocalStack configuration created"
}

# Function to setup test databases
setup_test_databases() {
  print_header "Setting Up Test Databases"
  
  # Start LocalStack
  print_status $YELLOW "🐳 Starting LocalStack..."
  cd "$TESTING_DIR"
  docker-compose -f docker-compose.test.yml up -d
  
  # Wait for LocalStack to be ready
  print_status $YELLOW "⏳ Waiting for LocalStack to be ready..."
  sleep 15
  
  # Test LocalStack connection
  if curl -s http://localhost:4566/health | grep -q "running"; then
    print_status $GREEN "✅ LocalStack is running"
  else
    print_status $RED "❌ LocalStack failed to start"
    docker-compose -f docker-compose.test.yml logs
    exit 1
  fi
  
  # Create test DynamoDB tables
  print_status $YELLOW "📊 Creating test DynamoDB tables..."
  
  # Set AWS credentials for LocalStack
  export AWS_ACCESS_KEY_ID=test
  export AWS_SECRET_ACCESS_KEY=test
  export AWS_DEFAULT_REGION=us-east-1
  
  # Create tables using AWS CLI
  if command_exists aws; then
    # Tenants table
    aws dynamodb create-table \
      --endpoint-url http://localhost:4566 \
      --table-name ai-compliance-tenants-test \
      --attribute-definitions \
        AttributeName=tenantId,AttributeType=S \
      --key-schema \
        AttributeName=tenantId,KeyType=HASH \
      --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5
    
    # Findings table
    aws dynamodb create-table \
      --endpoint-url http://localhost:4566 \
      --table-name ai-compliance-findings-test \
      --attribute-definitions \
        AttributeName=findingId,AttributeType=S \
        AttributeName=tenantId,AttributeType=S \
        AttributeName=scanId,AttributeType=S \
      --key-schema \
        AttributeName=findingId,KeyType=HASH \
      --global-secondary-indexes \
        'IndexName=TenantIndex,KeySchema=[{AttributeName=tenantId,KeyType=HASH},{AttributeName=scanId,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5}' \
      --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5
    
    # Scan Jobs table
    aws dynamodb create-table \
      --endpoint-url http://localhost:4566 \
      --table-name ai-compliance-scan-jobs-test \
      --attribute-definitions \
        AttributeName=scanId,AttributeType=S \
        AttributeName=tenantId,AttributeType=S \
      --key-schema \
        AttributeName=scanId,KeyType=HASH \
      --global-secondary-indexes \
        'IndexName=TenantIndex,KeySchema=[{AttributeName=tenantId,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5}' \
      --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5
    
    print_status $GREEN "✅ DynamoDB tables created"
  else
    print_status $YELLOW "⚠️  AWS CLI not found, skipping table creation"
    print_status $BLUE "Tables will be created automatically during tests"
  fi
  
  # Create test S3 buckets
  print_status $YELLOW "🪣 Creating test S3 buckets..."
  if command_exists aws; then
    aws s3 mb s3://ai-compliance-test-reports --endpoint-url http://localhost:4566
    aws s3 mb s3://ai-compliance-test-artifacts --endpoint-url http://localhost:4566
    print_status $GREEN "✅ S3 buckets created"
  fi
}

# Function to setup test data
setup_test_data() {
  print_header "Setting Up Test Data"
  
  # Create test data directory
  mkdir -p "$TESTING_DIR/test-data/fixtures"
  mkdir -p "$TESTING_DIR/test-data/sample-aws-resources"
  mkdir -p "$TESTING_DIR/test-data/compliance-findings"
  mkdir -p "$TESTING_DIR/test-data/terraform-plans"
  
  # Create sample AWS resource data
  cat > "$TESTING_DIR/test-data/sample-aws-resources/s3-buckets.json" << 'EOF'
{
  "buckets": [
    {
      "name": "test-public-bucket",
      "region": "us-east-1",
      "publicReadAccess": true,
      "publicWriteAccess": false,
      "encryption": false,
      "versioning": false,
      "tags": {
        "Environment": "test",
        "Team": "security"
      }
    },
    {
      "name": "test-private-bucket",
      "region": "us-east-1",
      "publicReadAccess": false,
      "publicWriteAccess": false,
      "encryption": true,
      "versioning": true,
      "tags": {
        "Environment": "production",
        "Team": "engineering"
      }
    }
  ]
}
EOF
  
  # Create sample compliance findings
  cat > "$TESTING_DIR/test-data/compliance-findings/sample-findings.json" << 'EOF'
{
  "findings": [
    {
      "findingId": "finding-test-001",
      "tenantId": "tenant-test-demo",
      "scanId": "scan-test-001",
      "resourceId": "test-public-bucket",
      "resourceType": "S3Bucket",
      "region": "us-east-1",
      "accountId": "123456789012",
      "severity": "HIGH",
      "status": "OPEN",
      "ruleId": "S3_BUCKET_PUBLIC_READ_PROHIBITED",
      "ruleName": "S3 Bucket Public Read Prohibited",
      "description": "S3 bucket allows public read access",
      "remediation": "Remove public read access from S3 bucket",
      "evidence": {
        "bucketName": "test-public-bucket",
        "publicReadAcl": true,
        "bucketPolicy": null
      },
      "createdAt": "2024-01-01T10:00:00Z",
      "updatedAt": "2024-01-01T10:00:00Z"
    }
  ]
}
EOF
  
  # Create sample Terraform plan
  cat > "$TESTING_DIR/test-data/terraform-plans/sample-plan.json" << 'EOF'
{
  "format_version": "1.0",
  "terraform_version": "1.5.0",
  "planned_values": {
    "root_module": {
      "resources": [
        {
          "address": "aws_s3_bucket.example",
          "mode": "managed",
          "type": "aws_s3_bucket",
          "name": "example",
          "values": {
            "bucket": "example-bucket",
            "force_destroy": false,
            "tags": {
              "Name": "Example Bucket"
            }
          }
        }
      ]
    }
  },
  "resource_changes": [
    {
      "address": "aws_s3_bucket.example",
      "mode": "managed",
      "type": "aws_s3_bucket",
      "name": "example",
      "change": {
        "actions": ["create"],
        "before": null,
        "after": {
          "bucket": "example-bucket",
          "force_destroy": false
        }
      }
    }
  ]
}
EOF
  
  print_status $GREEN "✅ Test data created"
}

# Function to setup environment variables
setup_environment_variables() {
  print_header "Setting Up Environment Variables"
  
  # Create .env.test file
  cat > "$TESTING_DIR/.env.test" << 'EOF'
# Test Environment Configuration
NODE_ENV=test
LOG_LEVEL=error

# AWS Configuration for LocalStack
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_ENDPOINT_URL=http://localhost:4566

# DynamoDB Configuration
DYNAMODB_ENDPOINT=http://localhost:4566
DYNAMODB_TABLE_PREFIX=ai-compliance-
DYNAMODB_TABLE_SUFFIX=-test

# S3 Configuration
S3_ENDPOINT=http://localhost:4566
S3_FORCE_PATH_STYLE=true
S3_REPORTS_BUCKET=ai-compliance-test-reports
S3_ARTIFACTS_BUCKET=ai-compliance-test-artifacts

# Lambda Configuration
LAMBDA_ENDPOINT=http://localhost:4566

# CloudWatch Configuration
CLOUDWATCH_ENDPOINT=http://localhost:4566

# KMS Configuration
KMS_ENDPOINT=http://localhost:4566

# Secrets Manager Configuration
SECRETS_MANAGER_ENDPOINT=http://localhost:4566

# Testing Configuration
TEST_TIMEOUT=30000
TEST_RETRIES=3
TEST_PARALLEL_WORKERS=4

# Disable external services in tests
XRAY_TRACING_ENABLED=false
SLACK_NOTIFICATIONS_ENABLED=false
BEDROCK_ENABLED=false

# Test-specific overrides
MOCK_AWS_SERVICES=true
SKIP_AUTH_VALIDATION=true
FAST_TEST_MODE=true
EOF
  
  # Create environment loader for tests
  cat > "$TESTING_DIR/setup/load-test-env.ts" << 'EOF'
/**
 * Load test environment variables
 */
import { config } from 'dotenv';
import { join } from 'path';

// Load test environment variables
config({ path: join(__dirname, '..', '.env.test') });

// Override any production settings
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';

// Ensure LocalStack endpoints are used
if (process.env.MOCK_AWS_SERVICES === 'true') {
  process.env.AWS_ENDPOINT_URL = 'http://localhost:4566';
  process.env.DYNAMODB_ENDPOINT = 'http://localhost:4566';
  process.env.S3_ENDPOINT = 'http://localhost:4566';
  process.env.LAMBDA_ENDPOINT = 'http://localhost:4566';
  process.env.CLOUDWATCH_ENDPOINT = 'http://localhost:4566';
  process.env.KMS_ENDPOINT = 'http://localhost:4566';
  process.env.SECRETS_MANAGER_ENDPOINT = 'http://localhost:4566';
}

export {};
EOF
  
  print_status $GREEN "✅ Environment variables configured"
}

# Function to setup security tools
setup_security_tools() {
  print_header "Setting Up Security Tools"
  
  # Install Snyk for vulnerability scanning
  if ! command_exists snyk; then
    print_status $YELLOW "📦 Installing Snyk..."
    npm install -g snyk
  fi
  print_status $GREEN "✅ Snyk is available"
  
  # Install Semgrep for static analysis (optional)
  if ! command_exists semgrep; then
    print_status $YELLOW "📦 Installing Semgrep..."
    if command_exists pip3; then
      pip3 install semgrep
    elif command_exists pip; then
      pip install semgrep
    else
      print_status $YELLOW "⚠️  pip not found, skipping Semgrep installation"
    fi
  fi
  
  if command_exists semgrep; then
    print_status $GREEN "✅ Semgrep is available"
  else
    print_status $YELLOW "⚠️  Semgrep not available, some security tests will be skipped"
  fi
}

# Function to verify setup
verify_setup() {
  print_header "Verifying Setup"
  
  local all_good=true
  
  # Check Node.js
  if command_exists node; then
    print_status $GREEN "✅ Node.js: $(node --version)"
  else
    print_status $RED "❌ Node.js not found"
    all_good=false
  fi
  
  # Check npm
  if command_exists npm; then
    print_status $GREEN "✅ npm: $(npm --version)"
  else
    print_status $RED "❌ npm not found"
    all_good=false
  fi
  
  # Check Docker
  if command_exists docker; then
    print_status $GREEN "✅ Docker: $(docker --version)"
  else
    print_status $YELLOW "⚠️  Docker not found (LocalStack tests will be skipped)"
  fi
  
  # Check LocalStack
  if curl -s http://localhost:4566/health >/dev/null 2>&1; then
    print_status $GREEN "✅ LocalStack is running"
  else
    print_status $YELLOW "⚠️  LocalStack not running (integration tests may fail)"
  fi
  
  # Check test dependencies
  if [[ -f "$TESTING_DIR/node_modules/.bin/jest" ]]; then
    print_status $GREEN "✅ Jest is installed"
  else
    print_status $RED "❌ Jest not found"
    all_good=false
  fi
  
  if [[ -f "$TESTING_DIR/e2e-tests/node_modules/.bin/playwright" ]]; then
    print_status $GREEN "✅ Playwright is installed"
  else
    print_status $YELLOW "⚠️  Playwright not found (E2E tests will be skipped)"
  fi
  
  # Check test data
  if [[ -d "$TESTING_DIR/test-data" ]]; then
    print_status $GREEN "✅ Test data is available"
  else
    print_status $RED "❌ Test data not found"
    all_good=false
  fi
  
  # Check environment file
  if [[ -f "$TESTING_DIR/.env.test" ]]; then
    print_status $GREEN "✅ Test environment configuration is available"
  else
    print_status $RED "❌ Test environment configuration not found"
    all_good=false
  fi
  
  if [[ "$all_good" == "true" ]]; then
    print_status $GREEN "🎉 Test environment setup completed successfully!"
    print_status $BLUE "You can now run tests using:"
    print_status $BLUE "  npm run test                    # Run unit tests"
    print_status $BLUE "  npm run test:integration       # Run integration tests"
    print_status $BLUE "  npm run test:e2e               # Run E2E tests"
    print_status $BLUE "  ./scripts/run-all-tests.sh     # Run all tests"
  else
    print_status $RED "❌ Test environment setup incomplete"
    print_status $YELLOW "Please resolve the issues above and run this script again"
    exit 1
  fi
}

# Function to display help
show_help() {
  echo "AI Compliance Shepherd - Test Environment Setup"
  echo ""
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  --skip-localstack    Skip LocalStack setup"
  echo "  --skip-security      Skip security tools setup"
  echo "  --install-docker     Attempt to install Docker automatically"
  echo "  --help              Show this help message"
  echo ""
  echo "This script will:"
  echo "  1. Install Node.js dependencies"
  echo "  2. Setup LocalStack for AWS services"
  echo "  3. Create test databases and data"
  echo "  4. Configure environment variables"
  echo "  5. Install security testing tools"
  echo "  6. Verify the complete setup"
}

# Parse command line arguments
SKIP_LOCALSTACK=false
SKIP_SECURITY=false
INSTALL_DOCKER=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-localstack)
      SKIP_LOCALSTACK=true
      shift
      ;;
    --skip-security)
      SKIP_SECURITY=true
      shift
      ;;
    --install-docker)
      INSTALL_DOCKER=true
      shift
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      show_help
      exit 1
      ;;
  esac
done

# Main execution
main() {
  print_header "AI Compliance Shepherd - Test Environment Setup"
  print_status $BLUE "Starting test environment setup..."
  
  # Install dependencies
  install_dependencies
  
  # Setup LocalStack
  if [[ "$SKIP_LOCALSTACK" != "true" ]]; then
    setup_localstack
    setup_test_databases
  fi
  
  # Setup test data
  setup_test_data
  
  # Setup environment variables
  setup_environment_variables
  
  # Setup security tools
  if [[ "$SKIP_SECURITY" != "true" ]]; then
    setup_security_tools
  fi
  
  # Verify setup
  verify_setup
}

# Export INSTALL_DOCKER for use in functions
export INSTALL_DOCKER

# Run main function
main "$@"
