# AI Compliance Shepherd - Demo Resource Cleanup Script (PowerShell)
# Cleans up all demo resources created by create-demo-resources.ps1
# Usage: .\cleanup-demo-resources.ps1 [aws-profile] [timestamp]

param(
    [string]$AWSProfile = "aics",
    [string]$Timestamp = ""
)

Write-Host "🧹 AI Compliance Shepherd - Demo Resource Cleanup" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host "AWS Profile: $AWSProfile" -ForegroundColor Yellow
Write-Host "Timestamp: $Timestamp" -ForegroundColor Yellow
Write-Host ""

# Function to check if AWS CLI is available
function Test-AWSCLI {
    try {
        aws --version | Out-Null
        Write-Host "✅ AWS CLI found" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ AWS CLI is not installed. Please install AWS CLI first." -ForegroundColor Red
        return $false
    }
}

# Function to check AWS credentials
function Test-AWSCredentials {
    try {
        aws sts get-caller-identity --profile $AWSProfile | Out-Null
        Write-Host "✅ AWS credentials verified" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ AWS credentials not configured for profile: $AWSProfile" -ForegroundColor Red
        Write-Host "Please run: aws configure --profile $AWSProfile" -ForegroundColor Yellow
        return $false
    }
}

# Function to cleanup S3 buckets
function Remove-DemoS3Buckets {
    Write-Host "🪣 Cleaning up S3 buckets..." -ForegroundColor Cyan
    
    # List all demo buckets
    $buckets = aws s3api list-buckets --profile $AWSProfile --query 'Buckets[?starts_with(Name, `ai-compliance-demo-noncompliant-`)].Name' --output text
    
    if ($buckets) {
        $bucketList = $buckets -split "`t"
        foreach ($bucket in $bucketList) {
            if ($bucket -and ($Timestamp -eq "" -or $bucket -like "*$Timestamp*")) {
                Write-Host "   - Removing bucket: $bucket" -ForegroundColor Yellow
                # Empty bucket first
                aws s3 rm "s3://$bucket" --recursive --profile $AWSProfile 2>$null
                # Remove bucket
                aws s3 rb "s3://$bucket" --profile $AWSProfile 2>$null
                Write-Host "     ✅ Removed bucket: $bucket" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "   ℹ️  No demo S3 buckets found" -ForegroundColor Gray
    }
    Write-Host ""
}

# Function to cleanup IAM roles
function Remove-DemoIAMRoles {
    Write-Host "👤 Cleaning up IAM roles..." -ForegroundColor Cyan
    
    # List all demo roles
    $roles = aws iam list-roles --profile $AWSProfile --query 'Roles[?starts_with(RoleName, `ai-compliance-demo-excessive-permissions-`)].RoleName' --output text
    
    if ($roles) {
        $roleList = $roles -split "`t"
        foreach ($role in $roleList) {
            if ($role -and ($Timestamp -eq "" -or $role -like "*$Timestamp*")) {
                Write-Host "   - Removing role: $role" -ForegroundColor Yellow
                
                # Detach all policies first
                $policies = aws iam list-attached-role-policies --role-name $role --profile $AWSProfile --query 'AttachedPolicies[].PolicyArn' --output text
                if ($policies) {
                    $policyList = $policies -split "`t"
                    foreach ($policy in $policyList) {
                        if ($policy) {
                            aws iam detach-role-policy --role-name $role --policy-arn $policy --profile $AWSProfile 2>$null
                        }
                    }
                }
                
                # Delete role
                aws iam delete-role --role-name $role --profile $AWSProfile 2>$null
                Write-Host "     ✅ Removed role: $role" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "   ℹ️  No demo IAM roles found" -ForegroundColor Gray
    }
    Write-Host ""
}

# Function to cleanup security groups
function Remove-DemoSecurityGroups {
    Write-Host "🔒 Cleaning up security groups..." -ForegroundColor Cyan
    
    # List all demo security groups
    $sgs = aws ec2 describe-security-groups --profile $AWSProfile --query 'SecurityGroups[?starts_with(GroupName, `ai-compliance-demo-permissive-sg-`)].GroupId' --output text
    
    if ($sgs) {
        $sgList = $sgs -split "`t"
        foreach ($sg in $sgList) {
            if ($sg) {
                Write-Host "   - Removing security group: $sg" -ForegroundColor Yellow
                aws ec2 delete-security-group --group-id $sg --profile $AWSProfile 2>$null
                Write-Host "     ✅ Removed security group: $sg" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "   ℹ️  No demo security groups found" -ForegroundColor Gray
    }
    Write-Host ""
}

# Function to cleanup EC2 instances
function Remove-DemoEC2Instances {
    Write-Host "🖥️  Cleaning up EC2 instances..." -ForegroundColor Cyan
    
    # List all demo instances
    $instances = aws ec2 describe-instances --profile $AWSProfile --query 'Reservations[].Instances[?starts_with(Tags[?Key==`Name`].Value | [0], `ai-compliance-demo-instance-`)].InstanceId' --output text
    
    if ($instances) {
        $instanceList = $instances -split "`t"
        foreach ($instance in $instanceList) {
            if ($instance) {
                Write-Host "   - Terminating instance: $instance" -ForegroundColor Yellow
                aws ec2 terminate-instances --instance-ids $instance --profile $AWSProfile 2>$null
                Write-Host "     ✅ Terminated instance: $instance" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "   ℹ️  No demo EC2 instances found" -ForegroundColor Gray
    }
    Write-Host ""
}

# Function to cleanup EC2 key pairs
function Remove-DemoEC2KeyPairs {
    Write-Host "🔑 Cleaning up EC2 key pairs..." -ForegroundColor Cyan
    
    # List all demo key pairs
    $keyPairs = aws ec2 describe-key-pairs --profile $AWSProfile --query 'KeyPairs[?starts_with(KeyName, `ai-compliance-demo-key-`)].KeyName' --output text
    
    if ($keyPairs) {
        $keyPairList = $keyPairs -split "`t"
        foreach ($keyPair in $keyPairList) {
            if ($keyPair -and ($Timestamp -eq "" -or $keyPair -like "*$Timestamp*")) {
                Write-Host "   - Removing key pair: $keyPair" -ForegroundColor Yellow
                aws ec2 delete-key-pair --key-name $keyPair --profile $AWSProfile 2>$null
                # Also remove local .pem file if it exists
                Remove-Item "${keyPair}.pem" -Force -ErrorAction SilentlyContinue
                Write-Host "     ✅ Removed key pair: $keyPair" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "   ℹ️  No demo EC2 key pairs found" -ForegroundColor Gray
    }
    Write-Host ""
}

# Function to show manual cleanup commands
function Show-ManualCommands {
    Write-Host "📋 MANUAL CLEANUP COMMANDS" -ForegroundColor Magenta
    Write-Host "==========================" -ForegroundColor Magenta
    Write-Host "If the automated cleanup fails, you can run these commands manually:" -ForegroundColor Yellow
    Write-Host ""
    
    if ($Timestamp) {
        Write-Host "# Remove S3 bucket (specific timestamp)" -ForegroundColor White
        Write-Host "aws s3 rb s3://ai-compliance-demo-noncompliant-$Timestamp --force --profile $AWSProfile" -ForegroundColor Gray
        Write-Host ""
        Write-Host "# Remove IAM role (specific timestamp)" -ForegroundColor White
        Write-Host "aws iam delete-role --role-name ai-compliance-demo-excessive-permissions-$Timestamp --profile $AWSProfile" -ForegroundColor Gray
        Write-Host ""
        Write-Host "# Remove security group (specific timestamp)" -ForegroundColor White
        Write-Host "aws ec2 delete-security-group --group-name ai-compliance-demo-permissive-sg-$Timestamp --profile $AWSProfile" -ForegroundColor Gray
        Write-Host ""
        Write-Host "# Remove EC2 key pair (specific timestamp)" -ForegroundColor White
        Write-Host "aws ec2 delete-key-pair --key-name ai-compliance-demo-key-$Timestamp --profile $AWSProfile" -ForegroundColor Gray
    } else {
        Write-Host "# List and remove all demo S3 buckets" -ForegroundColor White
        Write-Host "aws s3api list-buckets --profile $AWSProfile --query 'Buckets[?starts_with(Name, \`ai-compliance-demo-noncompliant-\`)].Name' --output text" -ForegroundColor Gray
        Write-Host "# Then: aws s3 rb s3://<bucket-name> --force --profile $AWSProfile" -ForegroundColor Gray
        Write-Host ""
        Write-Host "# List and remove all demo IAM roles" -ForegroundColor White
        Write-Host "aws iam list-roles --profile $AWSProfile --query 'Roles[?starts_with(RoleName, \`ai-compliance-demo-excessive-permissions-\`)].RoleName' --output text" -ForegroundColor Gray
        Write-Host "# Then: aws iam delete-role --role-name <role-name> --profile $AWSProfile" -ForegroundColor Gray
        Write-Host ""
        Write-Host "# List and remove all demo security groups" -ForegroundColor White
        Write-Host "aws ec2 describe-security-groups --profile $AWSProfile --query 'SecurityGroups[?starts_with(GroupName, \`ai-compliance-demo-permissive-sg-\`)].GroupId' --output text" -ForegroundColor Gray
        Write-Host "# Then: aws ec2 delete-security-group --group-id <sg-id> --profile $AWSProfile" -ForegroundColor Gray
    }
    Write-Host ""
}

# Main execution
function Main {
    Write-Host "Starting demo resource cleanup..." -ForegroundColor Green
    Write-Host ""
    
    # Pre-flight checks
    if (-not (Test-AWSCLI)) { exit 1 }
    if (-not (Test-AWSCredentials)) { exit 1 }
    Write-Host ""
    
    # Cleanup resources
    Remove-DemoS3Buckets
    Remove-DemoIAMRoles
    Remove-DemoSecurityGroups
    Remove-DemoEC2Instances
    Remove-DemoEC2KeyPairs
    
    # Show manual commands
    Show-ManualCommands
    
    Write-Host "🎉 Demo resource cleanup completed!" -ForegroundColor Green
    Write-Host "All demo resources have been removed to avoid charges." -ForegroundColor Yellow
    Write-Host ""
}

# Run main function
Main
