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
    
    Write-Host "🪣 Creating truly non-compliant S3 bucket: $bucketName" -ForegroundColor Cyan
    
    # 1. Create bucket
    aws s3 mb "s3://$bucketName" --profile $AWSProfile --region $Region
    
    # 2. Explicitly disable public access block (necessary in most modern AWS accounts)
    Write-Host "   - Disabling public access block..."
    aws s3api put-public-access-block --bucket $bucketName --profile $AWSProfile --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

    # 2.5. Explicitly disable encryption (AWS may enable it by default)
    Write-Host "   - Disabling server-side encryption..."
    # Try multiple times as AWS might re-enable it
    for ($i = 1; $i -le 3; $i++) {
        try {
            aws s3api delete-bucket-encryption --bucket $bucketName --profile $AWSProfile
        }
        catch {
            # Ignore if encryption is already disabled
        }
        Start-Sleep -Seconds 2
    }

    # 3. Create and apply a public read policy
    Write-Host "   - Applying public read bucket policy..."
    $policy = "{
        `"Version`": `"2012-10-17`",
        `"Statement`": [
            {
                `"Sid`": `"PublicReadGetObject`",
                `"Effect`": `"Allow`",
                `"Principal`": `"*`",
                `"Action`": `"s3:GetObject`",
                `"Resource`": `"arn:aws:s3:::$bucketName/*`"
            }
        ]
    }"
    $policy | Out-File -FilePath "bucket-policy.json" -Encoding UTF8
    aws s3api put-bucket-policy --bucket $bucketName --policy file://bucket-policy.json --profile $AWSProfile
    Remove-Item "bucket-policy.json" -Force

    # 4. Add test data
    "This is test data for compliance scanning demo" | aws s3 cp - "s3://$bucketName/test-data.txt" --profile $AWSProfile
    
    # 5. Verify non-compliance
    Write-Host "   - Verifying non-compliant status..."
    
    # Verify public access block is off
    try {
        $pab = aws s3api get-public-access-block --bucket $bucketName --profile $AWSProfile | ConvertFrom-Json
        $config = $pab.PublicAccessBlockConfiguration
        Write-Host "     DEBUG: Public access block settings:" -ForegroundColor Gray
        Write-Host "       BlockPublicAcls: $($config.BlockPublicAcls)" -ForegroundColor Gray
        Write-Host "       IgnorePublicAcls: $($config.IgnorePublicAcls)" -ForegroundColor Gray
        Write-Host "       BlockPublicPolicy: $($config.BlockPublicPolicy)" -ForegroundColor Gray
        Write-Host "       RestrictPublicBuckets: $($config.RestrictPublicBuckets)" -ForegroundColor Gray
        
        # Check if ALL four settings are false (not blocked)
        if ($config.BlockPublicAcls -eq $false -and 
            $config.IgnorePublicAcls -eq $false -and 
            $config.BlockPublicPolicy -eq $false -and 
            $config.RestrictPublicBuckets -eq $false) {
            Write-Host "     ✅ VERIFIED: Public access is not blocked (all settings disabled)." -ForegroundColor Green
        } else {
            Write-Host "     ❌ FAILED VERIFICATION: Public access is still blocked (some settings enabled)." -ForegroundColor Red
        }
    } catch {
        # If the command fails with NoSuchPublicAccessBlockConfiguration, it's also considered not blocked.
        if ($_.Exception.Message -like "*NoSuchPublicAccessBlockConfiguration*") {
            Write-Host "     ✅ VERIFIED: Public access block is not configured (not blocked)." -ForegroundColor Green
        } else {
            Write-Host "     ❌ FAILED VERIFICATION: Could not get public access block status. Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    # Verify encryption is off
    try {
        $encryption = aws s3api get-bucket-encryption --bucket $bucketName --profile $AWSProfile 2>&1
        Write-Host "     DEBUG: Encryption configuration found:" -ForegroundColor Gray
        Write-Host "       $encryption" -ForegroundColor Gray
        Write-Host "     ❌ FAILED VERIFICATION: Bucket IS encrypted (encryption config found)." -ForegroundColor Red
    } catch {
        if ($_.Exception.Message -like "*ServerSideEncryptionConfigurationNotFoundError*") {
            Write-Host "     ✅ VERIFIED: Bucket is NOT encrypted (no encryption config found)." -ForegroundColor Green
        } else {
            Write-Host "     ❌ FAILED VERIFICATION: Could not get encryption status. Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    Write-Host "✅ Created S3 bucket: $bucketName" -ForegroundColor Green
    Write-Host "   - Public access: Not blocked (non-compliant)" -ForegroundColor Yellow
    Write-Host "   - Encryption: Check verification above" -ForegroundColor Yellow
    Write-Host "   - Publicly readable via bucket policy" -ForegroundColor Yellow
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
