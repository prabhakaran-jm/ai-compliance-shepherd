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
    
    echo "🪣 Creating non-compliant S3 bucket: $bucket_name"
    
    # Create bucket
    aws s3 mb "s3://$bucket_name" --profile "$AWS_PROFILE" --region "$REGION"
    
    # Remove public access block (non-compliant)
    aws s3api delete-public-access-block --bucket "$bucket_name" --profile "$AWS_PROFILE"
    
    # Disable server-side encryption (non-compliant)
    aws s3api delete-bucket-encryption --bucket "$bucket_name" --profile "$AWS_PROFILE" 2>/dev/null || true
    
    # Add test data
    echo "This is test data for compliance scanning demo" | aws s3 cp - "s3://$bucket_name/test-data.txt" --profile "$AWS_PROFILE"
    
    echo "✅ Created non-compliant S3 bucket: $bucket_name"
    echo "   - No encryption"
    echo "   - No public access block"
    echo "   - Contains test data"
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
    
    # Launch instance without security groups (non-compliant)
    local instance_id=$(aws ec2 run-instances \
        --image-id ami-0c02fb55956c7d316 \
        --instance-type t2.micro \
        --key-name default \
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
    # create_non_compliant_ec2_instance
    
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
