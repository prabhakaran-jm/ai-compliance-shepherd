# AI Compliance Shepherd - Demo Resource Creation Script (PowerShell)
# Platform-agnostic script to create non-compliant AWS resources for demo purposes
# Usage: .\create-demo-resources.ps1 [aws-profile]

param(
    [string]$AWSProfile = "aics"
)

# Configuration
$Region = "us-east-1"
$Timestamp = Get-Date -Format "yyyyMMddHHmmss"

Write-Host "🚀 AI Compliance Shepherd - Demo Resource Creation" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "AWS Profile: $AWSProfile" -ForegroundColor Yellow
Write-Host "Region: $Region" -ForegroundColor Yellow
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

# Function to create non-compliant S3 bucket
function New-NonCompliantS3Bucket {
    $bucketName = "ai-compliance-demo-noncompliant-$Timestamp"
    
    Write-Host "🪣 Creating non-compliant S3 bucket: $bucketName" -ForegroundColor Cyan
    
    # Create bucket
    aws s3 mb "s3://$bucketName" --profile $AWSProfile --region $Region
    
    # Remove public access block (non-compliant)
    aws s3api delete-public-access-block --bucket $bucketName --profile $AWSProfile
    
    # Disable server-side encryption (non-compliant)
    try {
        aws s3api delete-bucket-encryption --bucket $bucketName --profile $AWSProfile
    }
    catch {
        # Ignore if encryption is already disabled
    }
    
    # Add test data
    "This is test data for compliance scanning demo" | aws s3 cp - "s3://$bucketName/test-data.txt" --profile $AWSProfile
    
    Write-Host "✅ Created non-compliant S3 bucket: $bucketName" -ForegroundColor Green
    Write-Host "   - No encryption" -ForegroundColor Yellow
    Write-Host "   - No public access block" -ForegroundColor Yellow
    Write-Host "   - Contains test data" -ForegroundColor Yellow
    Write-Host ""
}

# Function to create non-compliant IAM role
function New-NonCompliantIAMRole {
    $roleName = "ai-compliance-demo-excessive-permissions-$Timestamp"
    
    Write-Host "👤 Creating non-compliant IAM role: $roleName" -ForegroundColor Cyan
    
    # Create trust policy
    $trustPolicy = @'
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
'@
    
    $trustPolicy | Out-File -FilePath "trust-policy.json" -Encoding UTF8
    
    # Create role
    aws iam create-role --role-name $roleName --assume-role-policy-document file://trust-policy.json --profile $AWSProfile
    
    # Attach multiple policies to make it non-compliant (>5 policies)
    $policies = @(
        "arn:aws:iam::aws:policy/AmazonS3FullAccess",
        "arn:aws:iam::aws:policy/AmazonEC2FullAccess",
        "arn:aws:iam::aws:policy/AmazonRDSFullAccess",
        "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess",
        "arn:aws:iam::aws:policy/AmazonSESFullAccess",
        "arn:aws:iam::aws:policy/AmazonSNSFullAccess",
        "arn:aws:iam::aws:policy/AmazonSQSFullAccess"
    )
    
    foreach ($policy in $policies) {
        try {
            aws iam attach-role-policy --role-name $roleName --policy-arn $policy --profile $AWSProfile
        }
        catch {
            # Ignore if policy is already attached
        }
    }
    
    # Clean up
    Remove-Item "trust-policy.json" -Force -ErrorAction SilentlyContinue
    
    Write-Host "✅ Created non-compliant IAM role: $roleName" -ForegroundColor Green
    Write-Host "   - 7+ policies attached (excessive permissions)" -ForegroundColor Yellow
    Write-Host "   - Violates least privilege principle" -ForegroundColor Yellow
    Write-Host ""
}

# Function to create non-compliant security group
function New-NonCompliantSecurityGroup {
    $sgName = "ai-compliance-demo-permissive-sg-$Timestamp"
    
    Write-Host "🔒 Creating non-compliant security group: $sgName" -ForegroundColor Cyan
    
    # Create security group
    $sgId = aws ec2 create-security-group --group-name $sgName --description "Non-compliant security group for demo" --profile $AWSProfile --region $Region --query 'GroupId' --output text
    
    # Add overly permissive rule (0.0.0.0/0)
    aws ec2 authorize-security-group-ingress --group-id $sgId --protocol tcp --port 0-65535 --cidr 0.0.0.0/0 --profile $AWSProfile --region $Region
    
    Write-Host "✅ Created non-compliant security group: $sgName" -ForegroundColor Green
    Write-Host "   - Security Group ID: $sgId" -ForegroundColor Yellow
    Write-Host "   - Allows all traffic from 0.0.0.0/0" -ForegroundColor Yellow
    Write-Host "   - High security risk" -ForegroundColor Yellow
    Write-Host ""
}

# Function to display cleanup commands
function Show-CleanupCommands {
    Write-Host "🧹 CLEANUP COMMANDS" -ForegroundColor Magenta
    Write-Host "===================" -ForegroundColor Magenta
    Write-Host "To remove demo resources and avoid charges, run:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "# Remove S3 bucket" -ForegroundColor White
    Write-Host "aws s3 rb s3://ai-compliance-demo-noncompliant-$Timestamp --force --profile $AWSProfile" -ForegroundColor Gray
    Write-Host ""
    Write-Host "# Remove IAM role" -ForegroundColor White
    Write-Host "aws iam delete-role --role-name ai-compliance-demo-excessive-permissions-$Timestamp --profile $AWSProfile" -ForegroundColor Gray
    Write-Host ""
    Write-Host "# Remove security group" -ForegroundColor White
    Write-Host "aws ec2 delete-security-group --group-name ai-compliance-demo-permissive-sg-$Timestamp --profile $AWSProfile" -ForegroundColor Gray
    Write-Host ""
}

# Function to test the scanning
function Test-ComplianceScanning {
    Write-Host "🧪 TESTING COMPLIANCE SCANNING" -ForegroundColor Magenta
    Write-Host "==============================" -ForegroundColor Magenta
    Write-Host "Testing the AI Compliance Shepherd scanning..." -ForegroundColor Yellow
    Write-Host ""
    
    # Get API Gateway URL from CloudFormation
    try {
        $apiUrl = aws cloudformation describe-stacks --stack-name AiComplianceAgentStack --profile $AWSProfile --query 'Stacks[0].Outputs[?OutputKey==`AgentApiBaseUrl`].OutputValue' --output text
        
        if ($apiUrl) {
            Write-Host "API Gateway URL: $apiUrl" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Testing scan endpoint..." -ForegroundColor Yellow
            
            # Test scan
            $scanBody = @{
                scanType = "general"
                regions = @($Region)
                services = @("s3", "iam", "ec2")
                useRealScanning = $true
            } | ConvertTo-Json
            
            $response = Invoke-WebRequest -Uri "$apiUrl/scan" -Method POST -Body $scanBody -ContentType "application/json"
            $result = $response.Content | ConvertFrom-Json
            
            Write-Host "Scan Results:" -ForegroundColor Green
            Write-Host "  Compliance Score: $($result.aiInsights.complianceScore)%" -ForegroundColor Cyan
            Write-Host "  Total Findings: $($result.aiInsights.totalFindings)" -ForegroundColor Cyan
            Write-Host "  Critical Findings: $($result.aiInsights.criticalFindings)" -ForegroundColor Cyan
        }
        else {
            Write-Host "❌ Could not find API Gateway URL. Make sure the stack is deployed." -ForegroundColor Red
        }
    }
    catch {
        Write-Host "❌ Error testing scan endpoint: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host ""
}

# Main execution
function Main {
    Write-Host "Starting demo resource creation..." -ForegroundColor Green
    Write-Host ""
    
    # Pre-flight checks
    if (-not (Test-AWSCLI)) { exit 1 }
    if (-not (Test-AWSCredentials)) { exit 1 }
    Write-Host ""
    
    # Create non-compliant resources
    New-NonCompliantS3Bucket
    New-NonCompliantIAMRole
    New-NonCompliantSecurityGroup
    
    # Show cleanup commands
    Show-CleanupCommands
    
    # Test scanning
    Test-ComplianceScanning
    
    Write-Host "🎉 Demo resources created successfully!" -ForegroundColor Green
    Write-Host "You can now test the AI Compliance Shepherd scanning capabilities." -ForegroundColor Yellow
    Write-Host ""
}

# Run main function
Main
