# AI Compliance Shepherd - Scripts Directory

Essential scripts for demo resources, testing, and validation of the AI Compliance Shepherd platform.

## 📁 Files

### Installation Scripts
- **`install.sh`** - Automated installation script for Linux/macOS/WSL
- **`install.bat`** - Automated installation script for Windows

### Demo Resources
- **`create-demo-resources.sh`** - Bash script for Linux/macOS/WSL
- **`create-demo-resources.ps1`** - PowerShell script for Windows

### Auto-Remediation Testing
- **`test-auto-remediation.sh`** - Comprehensive testing script for auto-remediation functionality
- **`test-auto-remediation.ps1`** - PowerShell version of the auto-remediation testing script
- **`validate-frontend-remediation.sh`** - Frontend validation script for auto-remediation features

### Quick Demo
- **`quick-demo.js`** - Quick demo script for testing the platform

## 🚀 Quick Start

### Installation Scripts
```bash
# Linux/macOS/WSL
chmod +x scripts/install.sh
./scripts/install.sh

# Windows
scripts\install.bat
```

### Demo Resources
```bash
# Linux/macOS/WSL
chmod +x scripts/create-demo-resources.sh
./scripts/create-demo-resources.sh [aws-profile]

# Windows PowerShell
.\scripts\create-demo-resources.ps1 [aws-profile]

# Default usage (uses profile "aics")
./scripts/create-demo-resources.sh
```

### Auto-Remediation Testing
```bash
# Linux/macOS/WSL
chmod +x scripts/test-auto-remediation.sh
./scripts/test-auto-remediation.sh [command]

# Windows PowerShell
.\scripts\test-auto-remediation.ps1 [command]

# Commands: create|scan|remediate|validate|cleanup|test|all
./scripts/test-auto-remediation.sh all
```

### Frontend Validation
```bash
# Linux/macOS/WSL
chmod +x scripts/validate-frontend-remediation.sh
./scripts/validate-frontend-remediation.sh [command]

# Commands: frontend|api|features|javascript|css|workflow|report|all
./scripts/validate-frontend-remediation.sh all
```

## 📋 What It Creates

### Demo Resources
- **Non-compliant S3 bucket** (no encryption, public access)
- **Non-compliant IAM role** (excessive permissions)
- **Non-compliant EC2 security group** (overly permissive rules)

### Auto-Remediation Testing
- **Resource Creation**: Creates test resources for remediation testing
- **Compliance Scanning**: Tests scanning functionality with real AWS resources
- **Auto-Remediation**: Validates remediation workflow and API endpoints
- **Safety Features**: Tests safety confirmations and rollback options
- **Frontend Validation**: Ensures all UI components are working correctly

## 🧹 Cleanup

All scripts include cleanup commands to remove created resources when done testing:

```bash
# Cleanup demo resources
./scripts/create-demo-resources.sh cleanup

# Cleanup test resources
./scripts/test-auto-remediation.sh cleanup
```

## 📋 Prerequisites

- **AWS CLI** configured with appropriate permissions
- **Node.js** for JavaScript scripts
- **Bash shell** for .sh scripts (Linux/macOS)
- **PowerShell** for .ps1 scripts (Windows)
- **jq** for JSON processing (Linux/macOS)

## ⚠️ Important

These scripts create resources that violate compliance standards. Use only for demo purposes and clean up afterward.