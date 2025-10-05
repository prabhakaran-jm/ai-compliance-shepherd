# AI Compliance Shepherd - Demo Resource Creation Scripts

This directory contains platform-agnostic scripts to create non-compliant AWS resources for demonstrating the AI Compliance Shepherd's scanning capabilities.

## 📁 Files

- **`create-demo-resources.sh`** - Bash script for Linux/macOS/WSL
- **`create-demo-resources.ps1`** - PowerShell script for Windows
- **`README.md`** - This documentation

## 🚀 Quick Start

### Linux/macOS/WSL
```bash
chmod +x scripts/create-demo-resources.sh
./scripts/create-demo-resources.sh [aws-profile]
```

### Windows PowerShell
```powershell
.\scripts\create-demo-resources.ps1 [aws-profile]
```

### Default Usage
```bash
# Uses default profile "aics"
./scripts/create-demo-resources.sh

# Uses custom profile
./scripts/create-demo-resources.sh my-profile
```

## 🎯 What These Scripts Create

### 1. Non-Compliant S3 Bucket
- **Name**: `ai-compliance-demo-noncompliant-{timestamp}`
- **Violations**:
  - ❌ No server-side encryption
  - ❌ No public access block
  - ✅ Contains test data

### 2. Non-Compliant IAM Role
- **Name**: `ai-compliance-demo-excessive-permissions-{timestamp}`
- **Violations**:
  - ❌ 7+ policies attached (excessive permissions)
  - ❌ Violates least privilege principle

### 3. Non-Compliant Security Group
- **Name**: `ai-compliance-demo-permissive-sg-{timestamp}`
- **Violations**:
  - ❌ Allows all traffic from 0.0.0.0/0
  - ❌ High security risk

## 🔧 Prerequisites

1. **AWS CLI Installed**
   ```bash
   # Install AWS CLI v2
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   ```

2. **AWS Credentials Configured**
   ```bash
   aws configure --profile aics
   # Enter your Access Key ID, Secret Access Key, Region, and Output format
   ```

3. **Required Permissions**
   - S3: `s3:CreateBucket`, `s3:DeleteBucket`, `s3:PutObject`
   - IAM: `iam:CreateRole`, `iam:AttachRolePolicy`, `iam:DeleteRole`
   - EC2: `ec2:CreateSecurityGroup`, `ec2:AuthorizeSecurityGroupIngress`

## 🧪 Testing the Demo

After running the script, test the AI Compliance Shepherd:

```bash
# Get API Gateway URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name AiComplianceAgentStack \
  --profile aics \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentApiBaseUrl`].OutputValue' \
  --output text)

# Test compliance scan
curl -X POST "$API_URL/scan" \
  -H "Content-Type: application/json" \
  -d '{
    "scanType": "general",
    "regions": ["us-east-1"],
    "services": ["s3", "iam", "ec2"],
    "useRealScanning": true
  }'
```

## 🧹 Cleanup Commands

**Important**: Always clean up demo resources to avoid charges!

```bash
# Remove S3 bucket
aws s3 rb s3://ai-compliance-demo-noncompliant-{timestamp} --force --profile aics

# Remove IAM role
aws iam delete-role --role-name ai-compliance-demo-excessive-permissions-{timestamp} --profile aics

# Remove security group
aws ec2 delete-security-group --group-name ai-compliance-demo-permissive-sg-{timestamp} --profile aics
```

## 🎯 Demo Scenarios

### Scenario 1: S3 Compliance Violations
- Shows encryption and public access violations
- Demonstrates data protection compliance gaps

### Scenario 2: IAM Excessive Permissions
- Shows least privilege principle violations
- Demonstrates access control compliance gaps

### Scenario 3: EC2 Security Misconfigurations
- Shows overly permissive security groups
- Demonstrates network security compliance gaps

## 🔍 Expected Scan Results

After running the demo scripts, the AI Compliance Shepherd should detect:

- **S3 Findings**: 2 violations (encryption + public access)
- **IAM Findings**: 1 violation (excessive permissions)
- **EC2 Findings**: 1 violation (permissive security group)
- **Total**: 4+ compliance violations
- **Compliance Score**: ~30-40%

## ⚠️ Important Notes

1. **Cost Awareness**: These scripts create real AWS resources that may incur charges
2. **Cleanup Required**: Always run cleanup commands after demos
3. **CDK Assets Excluded**: The scanning logic excludes CDK-managed resources
4. **Security Focus**: Only security-critical violations are flagged
5. **Profile Usage**: Scripts use the specified AWS profile for all operations

## 🐛 Troubleshooting

### Common Issues

1. **Permission Denied**
   - Ensure your AWS profile has the required permissions
   - Check IAM policies for your user/role

2. **Resource Already Exists**
   - The timestamp ensures unique resource names
   - If conflicts occur, wait a minute and retry

3. **Region Mismatch**
   - Scripts default to `us-east-1`
   - Ensure your AWS profile is configured for the correct region

4. **API Gateway Not Found**
   - Ensure the `AiComplianceAgentStack` is deployed
   - Check CloudFormation stack status

### Debug Mode

Add debug output to see what's happening:

```bash
# Enable verbose AWS CLI output
export AWS_CLI_AUTO_PROMPT=off
export AWS_PAGER=""

# Run script with debug
bash -x scripts/create-demo-resources.sh
```

## 📞 Support

For issues with these scripts:
1. Check AWS CLI configuration
2. Verify permissions
3. Review CloudFormation stack status
4. Check AWS service limits

---

**Happy Demo-ing!** 🎉