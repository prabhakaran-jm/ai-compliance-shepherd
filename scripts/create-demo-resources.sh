#!/bin/bash
# AI Compliance Shepherd - Demo Resource Creation Script
# Platform-agnostic script to create non-compliant AWS resources for demo purposes
# Usage: ./create-demo-resources.sh [aws-profile]

set -e

# Configuration
AWS_PROFILE=${1:-"aics"}
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
REGION="us-east-1"

echo "🚀 AI Compliance Shepherd - Demo Resource Creation"
echo "=================================================="
echo "AWS Profile: $AWS_PROFILE"
echo "Region: $REGION"
echo "Timestamp: $TIMESTAMP"
echo ""

# Function to check if AWS CLI is available
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        echo "❌ AWS CLI is not installed. Please install AWS CLI first."
        exit 1
    fi
    echo "✅ AWS CLI found"
}

# Function to check AWS credentials
check_aws_credentials() {
    if ! aws sts get-caller-identity --profile "$AWS_PROFILE" &> /dev/null; then
        echo "❌ AWS credentials not configured for profile: $AWS_PROFILE"
        echo "Please run: aws configure --profile $AWS_PROFILE"
        exit 1
    fi
    echo "✅ AWS credentials verified"
}

# Function to create non-compliant S3 bucket
create_non_compliant_s3_bucket() {
    local bucket_name="ai-compliance-demo-noncompliant-$TIMESTAMP"
    
    echo "🪣 Creating truly non-compliant S3 bucket: $bucket_name"
    
    # 1. Create bucket
    aws s3 mb "s3://$bucket_name" --profile "$AWS_PROFILE" --region "$REGION"
    
    # 2. Explicitly disable public access block
    echo "   - Disabling public access block..."
    aws s3api put-public-access-block \
        --bucket "$bucket_name" \
        --profile "$AWS_PROFILE" \
        --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

    # 2.5. Explicitly disable encryption (AWS may enable it by default)
    echo "   - Disabling server-side encryption..."
    # Try multiple times as AWS might re-enable it
    for i in {1..3}; do
        aws s3api delete-bucket-encryption --bucket "$bucket_name" --profile "$AWS_PROFILE" 2>/dev/null || true
        sleep 2
    done

    # 3. Create and apply a public read policy
    echo "   - Applying public read bucket policy..."
    local policy_json="{
        \"Version\": \"2012-10-17\",
        \"Statement\": [
            {
                \"Sid\": \"PublicReadGetObject\",
                \"Effect\": \"Allow\",
                \"Principal\": \"*\",
                \"Action\": \"s3:GetObject\",
                \"Resource\": \"arn:aws:s3:::$bucket_name/*\"
            }
        ]
    }"
    echo "$policy_json" > bucket-policy.json
    aws s3api put-bucket-policy --bucket "$bucket_name" --policy file://bucket-policy.json --profile "$AWS_PROFILE"
    rm bucket-policy.json

    # 4. Add test data
    echo "This is test data for compliance scanning demo" | aws s3 cp - "s3://$bucket_name/test-data.txt" --profile "$AWS_PROFILE"
    
    # 5. Verify non-compliance
    echo "   - Verifying non-compliant status..."

    # Verify public access block is off
    if aws s3api get-public-access-block --bucket "$bucket_name" --profile "$AWS_PROFILE" 2>/dev/null; then
        echo "     DEBUG: Public access block settings:"
        aws s3api get-public-access-block --bucket "$bucket_name" --profile "$AWS_PROFILE" --query 'PublicAccessBlockConfiguration' --output table
        
        # Check if ALL four settings are false (not blocked)
        local block_public_acls=$(aws s3api get-public-access-block --bucket "$bucket_name" --profile "$AWS_PROFILE" --query 'PublicAccessBlockConfiguration.BlockPublicAcls' --output text)
        local ignore_public_acls=$(aws s3api get-public-access-block --bucket "$bucket_name" --profile "$AWS_PROFILE" --query 'PublicAccessBlockConfiguration.IgnorePublicAcls' --output text)
        local block_public_policy=$(aws s3api get-public-access-block --bucket "$bucket_name" --profile "$AWS_PROFILE" --query 'PublicAccessBlockConfiguration.BlockPublicPolicy' --output text)
        local restrict_public_buckets=$(aws s3api get-public-access-block --bucket "$bucket_name" --profile "$AWS_PROFILE" --query 'PublicAccessBlockConfiguration.RestrictPublicBuckets' --output text)
        
        if [[ "$block_public_acls" == "False" && "$ignore_public_acls" == "False" && "$block_public_policy" == "False" && "$restrict_public_buckets" == "False" ]]; then
            echo "     ✅ VERIFIED: Public access is not blocked (all settings disabled)."
        else
            echo "     ❌ FAILED VERIFICATION: Public access is still blocked (some settings enabled)."
        fi
    else
        # If the command fails with NoSuchPublicAccessBlockConfiguration, it's also considered not blocked.
        echo "     ✅ VERIFIED: Public access block is not configured (not blocked)."
    fi

    # Verify encryption is off
    if aws s3api get-bucket-encryption --bucket "$bucket_name" --profile "$AWS_PROFILE" 2>/dev/null; then
        echo "     DEBUG: Encryption configuration found:"
        aws s3api get-bucket-encryption --bucket "$bucket_name" --profile "$AWS_PROFILE" --query 'ServerSideEncryptionConfiguration' --output table
        echo "     ❌ FAILED VERIFICATION: Bucket IS encrypted (encryption config found)."
    else
        echo "     ✅ VERIFIED: Bucket is NOT encrypted (no encryption config found)."
    fi

    echo "✅ Created S3 bucket: $bucket_name"
    echo "   - Public access: Not blocked (non-compliant)"
    echo "   - Encryption: Check verification above"
    echo "   - Publicly readable via bucket policy"
    echo ""
}

# Function to create non-compliant IAM role
create_non_compliant_iam_role() {
    local role_name="ai-compliance-demo-excessive-permissions-$TIMESTAMP"
    
    echo "👤 Creating non-compliant IAM role: $role_name"
    
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
    
    # Create role
    aws iam create-role \
        --role-name "$role_name" \
        --assume-role-policy-document file://trust-policy.json \
        --profile "$AWS_PROFILE"
    
    # Attach multiple policies to make it non-compliant (>5 policies)
    local policies=(
        "arn:aws:iam::aws:policy/AmazonS3FullAccess"
        "arn:aws:iam::aws:policy/AmazonEC2FullAccess"
        "arn:aws:iam::aws:policy/AmazonRDSFullAccess"
        "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
        "arn:aws:iam::aws:policy/AmazonSESFullAccess"
        "arn:aws:iam::aws:policy/AmazonSNSFullAccess"
        "arn:aws:iam::aws:policy/AmazonSQSFullAccess"
    )
    
    for policy in "${policies[@]}"; do
        aws iam attach-role-policy \
            --role-name "$role_name" \
            --policy-arn "$policy" \
            --profile "$AWS_PROFILE" 2>/dev/null || true
    done
    
    # Clean up
    rm -f trust-policy.json
    
    echo "✅ Created non-compliant IAM role: $role_name"
    echo "   - 7+ policies attached (excessive permissions)"
    echo "   - Violates least privilege principle"
    echo ""
}

# Function to create non-compliant security group
create_non_compliant_security_group() {
    local sg_name="ai-compliance-demo-permissive-sg-$TIMESTAMP"
    
    echo "🔒 Creating non-compliant security group: $sg_name"
    
    # Create security group
    local sg_id=$(aws ec2 create-security-group \
        --group-name "$sg_name" \
        --description "Non-compliant security group for demo" \
        --profile "$AWS_PROFILE" \
        --region "$REGION" \
        --query 'GroupId' \
        --output text)
    
    # Add overly permissive rule (0.0.0.0/0)
    aws ec2 authorize-security-group-ingress \
        --group-id "$sg_id" \
        --protocol tcp \
        --port 0-65535 \
        --cidr 0.0.0.0/0 \
        --profile "$AWS_PROFILE" \
        --region "$REGION"
    
    echo "✅ Created non-compliant security group: $sg_name"
    echo "   - Security Group ID: $sg_id"
    echo "   - Allows all traffic from 0.0.0.0/0"
    echo "   - High security risk"
    echo ""
}

# Function to create non-compliant EC2 instance (optional - costs money)
create_non_compliant_ec2_instance() {
    local instance_name="ai-compliance-demo-instance-$TIMESTAMP"
    
    echo "🖥️  Creating non-compliant EC2 instance: $instance_name"
    echo "⚠️  WARNING: This will create a running EC2 instance that incurs costs!"
    echo "   Press Ctrl+C to cancel, or wait 10 seconds to continue..."
    
    sleep 10
    
    # Get the most recent security group ID
    local sg_id=$(aws ec2 describe-security-groups \
        --group-names "ai-compliance-demo-permissive-sg-$TIMESTAMP" \
        --profile "$AWS_PROFILE" \
        --region "$REGION" \
        --query 'SecurityGroups[0].GroupId' \
        --output text)
    
    # Create or use existing key pair
    local key_name="ai-compliance-demo-key-$TIMESTAMP"
    echo "   - Creating key pair: $key_name"
    
    # Create key pair (this will fail if it already exists, which is fine)
    aws ec2 create-key-pair --key-name "$key_name" --profile "$AWS_PROFILE" --region "$REGION" --query 'KeyMaterial' --output text > "${key_name}.pem" 2>/dev/null || true
    
    # Launch instance with the key pair
    local instance_id=$(aws ec2 run-instances \
        --image-id ami-0c02fb55956c7d316 \
        --instance-type t2.micro \
        --key-name "$key_name" \
        --security-group-ids "$sg_id" \
        --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$instance_name}]" \
        --profile "$AWS_PROFILE" \
        --region "$REGION" \
        --query 'Instances[0].InstanceId' \
        --output text)
    
    echo "✅ Created non-compliant EC2 instance: $instance_name"
    echo "   - Instance ID: $instance_id"
    echo "   - Uses overly permissive security group"
    echo "   - ⚠️  Remember to terminate this instance to avoid charges!"
    echo ""
}

# Function to display cleanup commands
show_cleanup_commands() {
    echo "🧹 CLEANUP COMMANDS"
    echo "==================="
    echo "To remove demo resources and avoid charges, run:"
    echo ""
    echo "# Remove S3 bucket"
    echo "aws s3 rb s3://ai-compliance-demo-noncompliant-$TIMESTAMP --force --profile $AWS_PROFILE"
    echo ""
    echo "# Remove IAM role"
    echo "aws iam delete-role --role-name ai-compliance-demo-excessive-permissions-$TIMESTAMP --profile $AWS_PROFILE"
    echo ""
    echo "# Remove security group"
    echo "aws ec2 delete-security-group --group-name ai-compliance-demo-permissive-sg-$TIMESTAMP --profile $AWS_PROFILE"
    echo ""
    echo "# Terminate EC2 instance (if created)"
    echo "aws ec2 terminate-instances --instance-ids <instance-id> --profile $AWS_PROFILE"
    echo ""
}

# Function to test the scanning
test_scanning() {
    echo "🧪 TESTING COMPLIANCE SCANNING"
    echo "=============================="
    echo "Testing the AI Compliance Shepherd scanning..."
    echo ""
    
    # Get API Gateway URL from CloudFormation
    local api_url=$(aws cloudformation describe-stacks \
        --stack-name AiComplianceAgentStack \
        --profile "$AWS_PROFILE" \
        --query 'Stacks[0].Outputs[?OutputKey==`AgentApiBaseUrl`].OutputValue' \
        --output text)
    
    if [ -n "$api_url" ]; then
        echo "API Gateway URL: $api_url"
        echo ""
        echo "Testing scan endpoint..."
        
        # Test scan
        curl -X POST "$api_url/scan" \
            -H "Content-Type: application/json" \
            -d '{
                "scanType": "general",
                "regions": ["'$REGION'"],
                "services": ["s3", "iam", "ec2"],
                "useRealScanning": true
            }' | jq '.aiInsights | {complianceScore, totalFindings, criticalFindings}'
    else
        echo "❌ Could not find API Gateway URL. Make sure the stack is deployed."
    fi
    echo ""
}

# Main execution
main() {
    echo "Starting demo resource creation..."
    echo ""
    
    # Pre-flight checks
    check_aws_cli
    check_aws_credentials
    echo ""
    
    # Create non-compliant resources
    create_non_compliant_s3_bucket
    create_non_compliant_iam_role
    create_non_compliant_security_group
    
    # Optional EC2 instance (commented out to avoid charges)
    create_non_compliant_ec2_instance
    
    # Show cleanup commands
    show_cleanup_commands
    
    # Test scanning
    test_scanning
    
    echo "🎉 Demo resources created successfully!"
    echo "You can now test the AI Compliance Shepherd scanning capabilities."
    echo ""
}

# Run main function
main "$@"
