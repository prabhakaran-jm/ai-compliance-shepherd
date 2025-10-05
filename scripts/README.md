# AI Compliance Shepherd - Demo Resource Scripts

Platform-agnostic scripts to create non-compliant AWS resources for demonstrating the AI Compliance Shepherd's scanning capabilities.

## 📁 Files

- **`create-demo-resources.sh`** - Bash script for Linux/macOS/WSL
- **`create-demo-resources.ps1`** - PowerShell script for Windows

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

## 📋 What It Creates

- **Non-compliant S3 bucket** (no encryption, public access)
- **Non-compliant IAM role** (excessive permissions)
- **Non-compliant EC2 security group** (overly permissive rules)

## 🧹 Cleanup

Both scripts include cleanup commands to remove created resources when done testing.

## ⚠️ Important

These scripts create resources that violate compliance standards. Use only for demo purposes and clean up afterward.