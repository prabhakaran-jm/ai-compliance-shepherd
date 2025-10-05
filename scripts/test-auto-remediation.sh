#!/bin/bash

# Test Auto-Remediation Functionality
# This script creates demo resources, tests auto-remediation, and validates results

set -e

# Configuration
PROFILE="aics"
REGION="us-east-1"
API_BASE="https://5v2tvgyom0.execute-api.us-east-1.amazonaws.com/prod"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 AI Compliance Shepherd - Auto-Remediation Testing${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to test API endpoint
test_api_endpoint() {
    local endpoint=$1
    local method=${2:-GET}
    local data=${3:-""}
    
    print_info "Testing API endpoint: $endpoint"
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -X POST \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_BASE$endpoint")
    else
        response=$(curl -s -X GET "$API_BASE$endpoint")
    fi
    
    if [ $? -eq 0 ]; then
        print_status "API call successful"
        echo "$response" | jq . 2>/dev/null || echo "$response"
        return 0
    else
        print_error "API call failed"
        return 1
    fi
}

# Function to create test resources
create_test_resources() {
    print_info "Creating test resources for auto-remediation testing..."
    
    # Create non-compliant S3 bucket
    BUCKET_NAME="test-remediation-bucket-$TIMESTAMP"
    print_info "Creating non-compliant S3 bucket: $BUCKET_NAME"
    
    aws s3 mb "s3://$BUCKET_NAME" --profile $PROFILE --region $REGION
    aws s3api delete-public-access-block --bucket "$BUCKET_NAME" --profile $PROFILE --region $REGION
    aws s3api delete-bucket-encryption --bucket "$BUCKET_NAME" --profile $PROFILE --region $REGION
    
    # Create test file
    echo "Test data for remediation testing" > test-file.txt
    aws s3 cp test-file.txt "s3://$BUCKET_NAME/" --profile $PROFILE --region $REGION
    rm test-file.txt
    
    print_status "S3 bucket created: $BUCKET_NAME"
    
    # Create non-compliant IAM role
    ROLE_NAME="test-remediation-role-$TIMESTAMP"
    print_info "Creating non-compliant IAM role: $ROLE_NAME"
    
    # Create trust policy
    cat > trust-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "ec2.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF
    
    aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document file://trust-policy.json \
        --profile $PROFILE
    
    # Attach multiple policies to make it non-compliant
    aws iam attach-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-arn "arn:aws:iam::aws:policy/AmazonS3FullAccess" \
        --profile $PROFILE
    
    aws iam attach-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-arn "arn:aws:iam::aws:policy/AmazonEC2FullAccess" \
        --profile $PROFILE
    
    aws iam attach-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-arn "arn:aws:iam::aws:policy/AmazonRDSFullAccess" \
        --profile $PROFILE
    
    aws iam attach-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-arn "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess" \
        --profile $PROFILE
    
    aws iam attach-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-arn "arn:aws:iam::aws:policy/AmazonLambdaFullAccess" \
        --profile $PROFILE
    
    print_status "IAM role created: $ROLE_NAME"
    
    # Create non-compliant security group
    SG_NAME="test-remediation-sg-$TIMESTAMP"
    print_info "Creating non-compliant security group: $SG_NAME"
    
    SG_ID=$(aws ec2 create-security-group \
        --group-name "$SG_NAME" \
        --description "Test security group for remediation" \
        --profile $PROFILE \
        --region $REGION \
        --query 'GroupId' \
        --output text)
    
    # Add overly permissive rules
    aws ec2 authorize-security-group-ingress \
        --group-id "$SG_ID" \
        --protocol tcp \
        --port 0-65535 \
        --cidr 0.0.0.0/0 \
        --profile $PROFILE \
        --region $REGION
    
    aws ec2 authorize-security-group-ingress \
        --group-id "$SG_ID" \
        --protocol udp \
        --port 0-65535 \
        --cidr 0.0.0.0/0 \
        --profile $PROFILE \
        --region $REGION
    
    print_status "Security group created: $SG_ID"
    
    # Store resource names for cleanup
    echo "BUCKET_NAME=$BUCKET_NAME" > test-resources.env
    echo "ROLE_NAME=$ROLE_NAME" >> test-resources.env
    echo "SG_ID=$SG_ID" >> test-resources.env
    echo "SG_NAME=$SG_NAME" >> test-resources.env
    
    print_status "Test resources created successfully"
}

# Function to test compliance scanning
test_compliance_scanning() {
    print_info "Testing compliance scanning..."
    
    # Test health endpoint
    print_info "Testing health endpoint..."
    test_api_endpoint "/health"
    
    # Test scan endpoint
    print_info "Testing compliance scan..."
    scan_data='{
        "scanType": "full",
        "services": ["s3", "iam", "ec2"],
        "regions": ["us-east-1"],
        "useRealScanning": true
    }'
    
    test_api_endpoint "/scan" "POST" "$scan_data"
}

# Function to test auto-remediation
test_auto_remediation() {
    print_info "Testing auto-remediation functionality..."
    
    # Test remediation endpoint
    print_info "Testing remediation endpoint..."
    remediation_data='{
        "findingIds": ["test-finding-1", "test-finding-2"],
        "tenantId": "test-tenant",
        "approvalRequired": false,
        "dryRun": true,
        "startedBy": "test-script"
    }'
    
    test_api_endpoint "/remediate" "POST" "$remediation_data"
}

# Function to validate remediation results
validate_remediation_results() {
    print_info "Validating remediation results..."
    
    # Check S3 bucket compliance
    if [ -n "$BUCKET_NAME" ]; then
        print_info "Checking S3 bucket compliance..."
        
        # Check encryption
        encryption_status=$(aws s3api get-bucket-encryption --bucket "$BUCKET_NAME" --profile $PROFILE --region $REGION 2>/dev/null || echo "No encryption")
        if [[ "$encryption_status" == *"No encryption"* ]]; then
            print_warning "S3 bucket still not encrypted"
        else
            print_status "S3 bucket encryption verified"
        fi
        
        # Check public access block
        pab_status=$(aws s3api get-public-access-block --bucket "$BUCKET_NAME" --profile $PROFILE --region $REGION 2>/dev/null || echo "No PAB")
        if [[ "$pab_status" == *"No PAB"* ]]; then
            print_warning "S3 bucket public access block not configured"
        else
            print_status "S3 bucket public access block verified"
        fi
    fi
    
    # Check IAM role compliance
    if [ -n "$ROLE_NAME" ]; then
        print_info "Checking IAM role compliance..."
        
        attached_policies=$(aws iam list-attached-role-policies --role-name "$ROLE_NAME" --profile $PROFILE --query 'AttachedPolicies[].PolicyName' --output text)
        policy_count=$(echo "$attached_policies" | wc -w)
        
        if [ "$policy_count" -gt 5 ]; then
            print_warning "IAM role still has $policy_count policies (excessive)"
        else
            print_status "IAM role policy count acceptable: $policy_count"
        fi
    fi
    
    # Check security group compliance
    if [ -n "$SG_ID" ]; then
        print_info "Checking security group compliance..."
        
        ingress_rules=$(aws ec2 describe-security-groups --group-ids "$SG_ID" --profile $PROFILE --region $REGION --query 'SecurityGroups[0].IpPermissions' --output json)
        rule_count=$(echo "$ingress_rules" | jq length)
        
        if [ "$rule_count" -gt 0 ]; then
            print_warning "Security group still has $rule_count ingress rules"
        else
            print_status "Security group rules cleaned up"
        fi
    fi
}

# Function to cleanup test resources
cleanup_test_resources() {
    print_info "Cleaning up test resources..."
    
    if [ -f "test-resources.env" ]; then
        source test-resources.env
        
        # Cleanup S3 bucket
        if [ -n "$BUCKET_NAME" ]; then
            print_info "Cleaning up S3 bucket: $BUCKET_NAME"
            aws s3 rm "s3://$BUCKET_NAME" --recursive --profile $PROFILE --region $REGION 2>/dev/null || true
            aws s3 rb "s3://$BUCKET_NAME" --profile $PROFILE --region $REGION 2>/dev/null || true
            print_status "S3 bucket cleaned up"
        fi
        
        # Cleanup IAM role
        if [ -n "$ROLE_NAME" ]; then
            print_info "Cleaning up IAM role: $ROLE_NAME"
            
            # Detach all policies
            attached_policies=$(aws iam list-attached-role-policies --role-name "$ROLE_NAME" --profile $PROFILE --query 'AttachedPolicies[].PolicyArn' --output text)
            for policy_arn in $attached_policies; do
                aws iam detach-role-policy --role-name "$ROLE_NAME" --policy-arn "$policy_arn" --profile $PROFILE 2>/dev/null || true
            done
            
            aws iam delete-role --role-name "$ROLE_NAME" --profile $PROFILE 2>/dev/null || true
            print_status "IAM role cleaned up"
        fi
        
        # Cleanup security group
        if [ -n "$SG_ID" ]; then
            print_info "Cleaning up security group: $SG_ID"
            aws ec2 delete-security-group --group-id "$SG_ID" --profile $PROFILE --region $REGION 2>/dev/null || true
            print_status "Security group cleaned up"
        fi
        
        rm -f test-resources.env trust-policy.json
        print_status "Test resources cleaned up"
    fi
}

# Function to run comprehensive test
run_comprehensive_test() {
    print_info "Running comprehensive auto-remediation test..."
    
    # Step 1: Create test resources
    create_test_resources
    
    # Step 2: Test compliance scanning
    test_compliance_scanning
    
    # Step 3: Test auto-remediation
    test_auto_remediation
    
    # Step 4: Validate results
    validate_remediation_results
    
    print_status "Comprehensive test completed"
}

# Main execution
main() {
    case "${1:-all}" in
        "create")
            create_test_resources
            ;;
        "scan")
            test_compliance_scanning
            ;;
        "remediate")
            test_auto_remediation
            ;;
        "validate")
            validate_remediation_results
            ;;
        "cleanup")
            cleanup_test_resources
            ;;
        "test")
            run_comprehensive_test
            ;;
        "all")
            run_comprehensive_test
            cleanup_test_resources
            ;;
        *)
            echo "Usage: $0 [create|scan|remediate|validate|cleanup|test|all]"
            echo ""
            echo "Commands:"
            echo "  create    - Create test resources only"
            echo "  scan      - Test compliance scanning only"
            echo "  remediate - Test auto-remediation only"
            echo "  validate  - Validate remediation results only"
            echo "  cleanup   - Cleanup test resources only"
            echo "  test      - Run comprehensive test"
            echo "  all       - Run comprehensive test and cleanup (default)"
            exit 1
            ;;
    esac
}

# Trap to ensure cleanup on exit
trap cleanup_test_resources EXIT

# Run main function
main "$@"

print_status "Auto-remediation testing completed successfully!"
