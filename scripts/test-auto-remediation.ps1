# Test Auto-Remediation Functionality
# This script creates demo resources, tests auto-remediation, and validates results

param(
    [string]$Action = "all"
)

# Configuration
$PROFILE = "aics"
$REGION = "us-east-1"
$API_BASE = "https://5v2tvgyom0.execute-api.us-east-1.amazonaws.com/prod"
$TIMESTAMP = Get-Date -Format "yyyyMMdd-HHmmss"

# Colors for output
$RED = "Red"
$GREEN = "Green"
$YELLOW = "Yellow"
$BLUE = "Blue"

Write-Host "🧪 AI Compliance Shepherd - Auto-Remediation Testing" -ForegroundColor $BLUE
Write-Host "================================================" -ForegroundColor $BLUE
Write-Host ""

# Function to print status
function Print-Status {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor $GREEN
}

function Print-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor $YELLOW
}

function Print-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor $RED
}

function Print-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor $BLUE
}

# Function to test API endpoint
function Test-ApiEndpoint {
    param(
        [string]$Endpoint,
        [string]$Method = "GET",
        [string]$Data = ""
    )
    
    Print-Info "Testing API endpoint: $Endpoint"
    
    try {
        if ($Method -eq "POST" -and $Data -ne "") {
            $response = Invoke-WebRequest -Uri "$API_BASE$Endpoint" -Method POST -ContentType "application/json" -Body $Data -UseBasicParsing
        } else {
            $response = Invoke-WebRequest -Uri "$API_BASE$Endpoint" -Method GET -UseBasicParsing
        }
        
        Print-Status "API call successful"
        $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
        return $true
    } catch {
        Print-Error "API call failed: $($_.Exception.Message)"
        return $false
    }
}

# Function to create test resources
function Create-TestResources {
    Print-Info "Creating test resources for auto-remediation testing..."
    
    # Create non-compliant S3 bucket
    $BUCKET_NAME = "test-remediation-bucket-$TIMESTAMP"
    Print-Info "Creating non-compliant S3 bucket: $BUCKET_NAME"
    
    aws s3 mb "s3://$BUCKET_NAME" --profile $PROFILE --region $REGION
    aws s3api delete-public-access-block --bucket "$BUCKET_NAME" --profile $PROFILE --region $REGION
    aws s3api delete-bucket-encryption --bucket "$BUCKET_NAME" --profile $PROFILE --region $REGION
    
    # Create test file
    "Test data for remediation testing" | Out-File -FilePath "test-file.txt" -Encoding UTF8
    aws s3 cp test-file.txt "s3://$BUCKET_NAME/" --profile $PROFILE --region $REGION
    Remove-Item test-file.txt -Force
    
    Print-Status "S3 bucket created: $BUCKET_NAME"
    
    # Create non-compliant IAM role
    $ROLE_NAME = "test-remediation-role-$TIMESTAMP"
    Print-Info "Creating non-compliant IAM role: $ROLE_NAME"
    
    # Create trust policy
    $trustPolicy = @"
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
"@
    
    $trustPolicy | Out-File -FilePath "trust-policy.json" -Encoding UTF8
    
    aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document file://trust-policy.json --profile $PROFILE
    
    # Attach multiple policies to make it non-compliant
    $policies = @(
        "arn:aws:iam::aws:policy/AmazonS3FullAccess",
        "arn:aws:iam::aws:policy/AmazonEC2FullAccess",
        "arn:aws:iam::aws:policy/AmazonRDSFullAccess",
        "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess",
        "arn:aws:iam::aws:policy/AmazonLambdaFullAccess"
    )
    
    foreach ($policyArn in $policies) {
        aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "$policyArn" --profile $PROFILE
    }
    
    Print-Status "IAM role created: $ROLE_NAME"
    
    # Create non-compliant security group
    $SG_NAME = "test-remediation-sg-$TIMESTAMP"
    Print-Info "Creating non-compliant security group: $SG_NAME"
    
    $SG_ID = aws ec2 create-security-group --group-name "$SG_NAME" --description "Test security group for remediation" --profile $PROFILE --region $REGION --query 'GroupId' --output text
    
    # Add overly permissive rules
    aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 0-65535 --cidr 0.0.0.0/0 --profile $PROFILE --region $REGION
    aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol udp --port 0-65535 --cidr 0.0.0.0/0 --profile $PROFILE --region $REGION
    
    Print-Status "Security group created: $SG_ID"
    
    # Store resource names for cleanup
    $env:TEST_BUCKET_NAME = $BUCKET_NAME
    $env:TEST_ROLE_NAME = $ROLE_NAME
    $env:TEST_SG_ID = $SG_ID
    $env:TEST_SG_NAME = $SG_NAME
    
    Print-Status "Test resources created successfully"
}

# Function to test compliance scanning
function Test-ComplianceScanning {
    Print-Info "Testing compliance scanning..."
    
    # Test health endpoint
    Print-Info "Testing health endpoint..."
    Test-ApiEndpoint "/health"
    
    # Test scan endpoint
    Print-Info "Testing compliance scan..."
    $scanData = @{
        scanType = "full"
        services = @("s3", "iam", "ec2")
        regions = @("us-east-1")
        useRealScanning = $true
    } | ConvertTo-Json -Depth 3
    
    Test-ApiEndpoint "/scan" "POST" $scanData
}

# Function to test auto-remediation
function Test-AutoRemediation {
    Print-Info "Testing auto-remediation functionality..."
    
    # Test remediation endpoint
    Print-Info "Testing remediation endpoint..."
    $remediationData = @{
        findingIds = @("test-finding-1", "test-finding-2")
        tenantId = "test-tenant"
        approvalRequired = $false
        dryRun = $true
        startedBy = "test-script"
    } | ConvertTo-Json -Depth 3
    
    Test-ApiEndpoint "/remediate" "POST" $remediationData
}

# Function to validate remediation results
function Validate-RemediationResults {
    Print-Info "Validating remediation results..."
    
    # Check S3 bucket compliance
    if ($env:TEST_BUCKET_NAME) {
        Print-Info "Checking S3 bucket compliance..."
        
        # Check encryption
        try {
            $encryptionStatus = aws s3api get-bucket-encryption --bucket "$env:TEST_BUCKET_NAME" --profile $PROFILE --region $REGION 2>$null
            Print-Status "S3 bucket encryption verified"
        } catch {
            Print-Warning "S3 bucket still not encrypted"
        }
        
        # Check public access block
        try {
            $pabStatus = aws s3api get-public-access-block --bucket "$env:TEST_BUCKET_NAME" --profile $PROFILE --region $REGION 2>$null
            Print-Status "S3 bucket public access block verified"
        } catch {
            Print-Warning "S3 bucket public access block not configured"
        }
    }
    
    # Check IAM role compliance
    if ($env:TEST_ROLE_NAME) {
        Print-Info "Checking IAM role compliance..."
        
        $attachedPolicies = aws iam list-attached-role-policies --role-name "$env:TEST_ROLE_NAME" --profile $PROFILE --query 'AttachedPolicies[].PolicyName' --output text
        $policyCount = ($attachedPolicies -split '\s+').Count
        
        if ($policyCount -gt 5) {
            Print-Warning "IAM role still has $policyCount policies (excessive)"
        } else {
            Print-Status "IAM role policy count acceptable: $policyCount"
        }
    }
    
    # Check security group compliance
    if ($env:TEST_SG_ID) {
        Print-Info "Checking security group compliance..."
        
        $ingressRules = aws ec2 describe-security-groups --group-ids "$env:TEST_SG_ID" --profile $PROFILE --region $REGION --query 'SecurityGroups[0].IpPermissions' --output json
        $ruleCount = ($ingressRules | ConvertFrom-Json).Count
        
        if ($ruleCount -gt 0) {
            Print-Warning "Security group still has $ruleCount ingress rules"
        } else {
            Print-Status "Security group rules cleaned up"
        }
    }
}

# Function to cleanup test resources
function Cleanup-TestResources {
    Print-Info "Cleaning up test resources..."
    
    # Cleanup S3 bucket
    if ($env:TEST_BUCKET_NAME) {
        Print-Info "Cleaning up S3 bucket: $env:TEST_BUCKET_NAME"
        try {
            aws s3 rm "s3://$env:TEST_BUCKET_NAME" --recursive --profile $PROFILE --region $REGION 2>$null
            aws s3 rb "s3://$env:TEST_BUCKET_NAME" --profile $PROFILE --region $REGION 2>$null
            Print-Status "S3 bucket cleaned up"
        } catch {
            Print-Warning "Failed to cleanup S3 bucket: $env:TEST_BUCKET_NAME"
        }
    }
    
    # Cleanup IAM role
    if ($env:TEST_ROLE_NAME) {
        Print-Info "Cleaning up IAM role: $env:TEST_ROLE_NAME"
        
        try {
            # Detach all policies
            $attachedPolicies = aws iam list-attached-role-policies --role-name "$env:TEST_ROLE_NAME" --profile $PROFILE --query 'AttachedPolicies[].PolicyArn' --output text
            foreach ($policyArn in $attachedPolicies -split '\s+') {
                if ($policyArn) {
                    aws iam detach-role-policy --role-name "$env:TEST_ROLE_NAME" --policy-arn "$policyArn" --profile $PROFILE 2>$null
                }
            }
            
            aws iam delete-role --role-name "$env:TEST_ROLE_NAME" --profile $PROFILE 2>$null
            Print-Status "IAM role cleaned up"
        } catch {
            Print-Warning "Failed to cleanup IAM role: $env:TEST_ROLE_NAME"
        }
    }
    
    # Cleanup security group
    if ($env:TEST_SG_ID) {
        Print-Info "Cleaning up security group: $env:TEST_SG_ID"
        try {
            aws ec2 delete-security-group --group-id "$env:TEST_SG_ID" --profile $PROFILE --region $REGION 2>$null
            Print-Status "Security group cleaned up"
        } catch {
            Print-Warning "Failed to cleanup security group: $env:TEST_SG_ID"
        }
    }
    
    # Cleanup files
    if (Test-Path "trust-policy.json") {
        Remove-Item "trust-policy.json" -Force
    }
    
    Print-Status "Test resources cleaned up"
}

# Function to run comprehensive test
function Run-ComprehensiveTest {
    Print-Info "Running comprehensive auto-remediation test..."
    
    # Step 1: Create test resources
    Create-TestResources
    
    # Step 2: Test compliance scanning
    Test-ComplianceScanning
    
    # Step 3: Test auto-remediation
    Test-AutoRemediation
    
    # Step 4: Validate results
    Validate-RemediationResults
    
    Print-Status "Comprehensive test completed"
}

# Main execution
switch ($Action.ToLower()) {
    "create" {
        Create-TestResources
    }
    "scan" {
        Test-ComplianceScanning
    }
    "remediate" {
        Test-AutoRemediation
    }
    "validate" {
        Validate-RemediationResults
    }
    "cleanup" {
        Cleanup-TestResources
    }
    "test" {
        Run-ComprehensiveTest
    }
    "all" {
        Run-ComprehensiveTest
        Cleanup-TestResources
    }
    default {
        Write-Host "Usage: .\test-auto-remediation.ps1 [create|scan|remediate|validate|cleanup|test|all]"
        Write-Host ""
        Write-Host "Commands:"
        Write-Host "  create    - Create test resources only"
        Write-Host "  scan      - Test compliance scanning only"
        Write-Host "  remediate - Test auto-remediation only"
        Write-Host "  validate  - Validate remediation results only"
        Write-Host "  cleanup   - Cleanup test resources only"
        Write-Host "  test      - Run comprehensive test"
        Write-Host "  all       - Run comprehensive test and cleanup (default)"
        exit 1
    }
}

Print-Status "Auto-remediation testing completed successfully!"
