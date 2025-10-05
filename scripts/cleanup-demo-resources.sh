#!/bin/bash
# AI Compliance Shepherd - Demo Resource Cleanup Script
# Cleans up all demo resources created by create-demo-resources.sh
# Usage: ./cleanup-demo-resources.sh [aws-profile] [timestamp]

set -e

# Configuration
AWS_PROFILE=${1:-"aics"}
TIMESTAMP=${2:-""}

echo "🧹 AI Compliance Shepherd - Demo Resource Cleanup"
echo "================================================="
echo "AWS Profile: $AWS_PROFILE"
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

# Function to cleanup S3 buckets
cleanup_s3_buckets() {
    echo "🪣 Cleaning up S3 buckets..."
    
    # List all demo buckets
    local buckets=$(aws s3api list-buckets --profile "$AWS_PROFILE" --query 'Buckets[?starts_with(Name, `ai-compliance-demo-noncompliant-`)].Name' --output text)
    
    if [[ -n "$buckets" ]]; then
        for bucket in $buckets; do
            if [[ -z "$TIMESTAMP" || "$bucket" == *"$TIMESTAMP"* ]]; then
                echo "   - Removing bucket: $bucket"
                # Empty bucket first
                aws s3 rm "s3://$bucket" --recursive --profile "$AWS_PROFILE" 2>/dev/null || true
                # Remove bucket
                aws s3 rb "s3://$bucket" --profile "$AWS_PROFILE" 2>/dev/null || true
                echo "     ✅ Removed bucket: $bucket"
            fi
        done
    else
        echo "   ℹ️  No demo S3 buckets found"
    fi
    echo ""
}

# Function to cleanup IAM roles
cleanup_iam_roles() {
    echo "👤 Cleaning up IAM roles..."
    
    # List all demo roles
    local roles=$(aws iam list-roles --profile "$AWS_PROFILE" --query 'Roles[?starts_with(RoleName, `ai-compliance-demo-excessive-permissions-`)].RoleName' --output text)
    
    if [[ -n "$roles" ]]; then
        for role in $roles; do
            if [[ -z "$TIMESTAMP" || "$role" == *"$TIMESTAMP"* ]]; then
                echo "   - Removing role: $role"
                
                # Detach all policies first
                local policies=$(aws iam list-attached-role-policies --role-name "$role" --profile "$AWS_PROFILE" --query 'AttachedPolicies[].PolicyArn' --output text)
                for policy in $policies; do
                    aws iam detach-role-policy --role-name "$role" --policy-arn "$policy" --profile "$AWS_PROFILE" 2>/dev/null || true
                done
                
                # Delete role
                aws iam delete-role --role-name "$role" --profile "$AWS_PROFILE" 2>/dev/null || true
                echo "     ✅ Removed role: $role"
            fi
        done
    else
        echo "   ℹ️  No demo IAM roles found"
    fi
    echo ""
}

# Function to cleanup security groups
cleanup_security_groups() {
    echo "🔒 Cleaning up security groups..."
    
    # List all demo security groups
    local sgs=$(aws ec2 describe-security-groups --profile "$AWS_PROFILE" --query 'SecurityGroups[?starts_with(GroupName, `ai-compliance-demo-permissive-sg-`)].GroupId' --output text)
    
    if [[ -n "$sgs" ]]; then
        for sg in $sgs; do
            echo "   - Removing security group: $sg"
            aws ec2 delete-security-group --group-id "$sg" --profile "$AWS_PROFILE" 2>/dev/null || true
            echo "     ✅ Removed security group: $sg"
        done
    else
        echo "   ℹ️  No demo security groups found"
    fi
    echo ""
}

# Function to cleanup EC2 instances
cleanup_ec2_instances() {
    echo "🖥️  Cleaning up EC2 instances..."
    
    # List all demo instances
    local instances=$(aws ec2 describe-instances --profile "$AWS_PROFILE" --query 'Reservations[].Instances[?starts_with(Tags[?Key==`Name`].Value | [0], `ai-compliance-demo-instance-`)].InstanceId' --output text)
    
    if [[ -n "$instances" ]]; then
        for instance in $instances; do
            echo "   - Terminating instance: $instance"
            aws ec2 terminate-instances --instance-ids "$instance" --profile "$AWS_PROFILE" 2>/dev/null || true
            echo "     ✅ Terminated instance: $instance"
        done
    else
        echo "   ℹ️  No demo EC2 instances found"
    fi
    echo ""
}

# Function to cleanup EC2 key pairs
cleanup_ec2_key_pairs() {
    echo "🔑 Cleaning up EC2 key pairs..."
    
    # List all demo key pairs
    local key_pairs=$(aws ec2 describe-key-pairs --profile "$AWS_PROFILE" --query 'KeyPairs[?starts_with(KeyName, `ai-compliance-demo-key-`)].KeyName' --output text)
    
    if [[ -n "$key_pairs" ]]; then
        for key_pair in $key_pairs; do
            if [[ -z "$TIMESTAMP" || "$key_pair" == *"$TIMESTAMP"* ]]; then
                echo "   - Removing key pair: $key_pair"
                aws ec2 delete-key-pair --key-name "$key_pair" --profile "$AWS_PROFILE" 2>/dev/null || true
                # Also remove local .pem file if it exists
                rm -f "${key_pair}.pem" 2>/dev/null || true
                echo "     ✅ Removed key pair: $key_pair"
            fi
        done
    else
        echo "   ℹ️  No demo EC2 key pairs found"
    fi
    echo ""
}

# Function to show manual cleanup commands
show_manual_commands() {
    echo "📋 MANUAL CLEANUP COMMANDS"
    echo "=========================="
    echo "If the automated cleanup fails, you can run these commands manually:"
    echo ""
    
    if [[ -n "$TIMESTAMP" ]]; then
        echo "# Remove S3 bucket (specific timestamp)"
        echo "aws s3 rb s3://ai-compliance-demo-noncompliant-$TIMESTAMP --force --profile $AWS_PROFILE"
        echo ""
        echo "# Remove IAM role (specific timestamp)"
        echo "aws iam delete-role --role-name ai-compliance-demo-excessive-permissions-$TIMESTAMP --profile $AWS_PROFILE"
        echo ""
        echo "# Remove security group (specific timestamp)"
        echo "aws ec2 delete-security-group --group-name ai-compliance-demo-permissive-sg-$TIMESTAMP --profile $AWS_PROFILE"
        echo ""
        echo "# Remove EC2 key pair (specific timestamp)"
        echo "aws ec2 delete-key-pair --key-name ai-compliance-demo-key-$TIMESTAMP --profile $AWS_PROFILE"
    else
        echo "# List and remove all demo S3 buckets"
        echo "aws s3api list-buckets --profile $AWS_PROFILE --query 'Buckets[?starts_with(Name, \`ai-compliance-demo-noncompliant-\`)].Name' --output text"
        echo "# Then: aws s3 rb s3://<bucket-name> --force --profile $AWS_PROFILE"
        echo ""
        echo "# List and remove all demo IAM roles"
        echo "aws iam list-roles --profile $AWS_PROFILE --query 'Roles[?starts_with(RoleName, \`ai-compliance-demo-excessive-permissions-\`)].RoleName' --output text"
        echo "# Then: aws iam delete-role --role-name <role-name> --profile $AWS_PROFILE"
        echo ""
        echo "# List and remove all demo security groups"
        echo "aws ec2 describe-security-groups --profile $AWS_PROFILE --query 'SecurityGroups[?starts_with(GroupName, \`ai-compliance-demo-permissive-sg-\`)].GroupId' --output text"
        echo "# Then: aws ec2 delete-security-group --group-id <sg-id> --profile $AWS_PROFILE"
    fi
    echo ""
}

# Main execution
main() {
    echo "Starting demo resource cleanup..."
    echo ""
    
    # Pre-flight checks
    check_aws_cli
    check_aws_credentials
    echo ""
    
    # Cleanup resources
    cleanup_s3_buckets
    cleanup_iam_roles
    cleanup_security_groups
    cleanup_ec2_instances
    cleanup_ec2_key_pairs
    
    # Show manual commands
    show_manual_commands
    
    echo "🎉 Demo resource cleanup completed!"
    echo "All demo resources have been removed to avoid charges."
    echo ""
}

# Run main function
main "$@"
