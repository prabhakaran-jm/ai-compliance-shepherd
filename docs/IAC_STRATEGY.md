# Infrastructure as Code Strategy

## Dual IaC Approach: CDK + Terraform

We're using both **AWS CDK** and **Terraform** strategically to demonstrate versatility and real-world best practices for the AWS AI Agent Hackathon.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Compliance Shepherd                   │
├─────────────────────────────────────────────────────────────┤
│  AWS CDK (Primary)           │  Terraform (Modules)        │
│  ┌─────────────────────────┐ │  ┌─────────────────────────┐ │
│  │ Core Application Stack  │ │  │ Cross-Account Roles     │ │
│  │ • Lambda Functions      │ │  │ • Customer Onboarding   │ │
│  │ • API Gateway           │ │  │ • Compliance Rules      │ │
│  │ • DynamoDB Tables       │ │  │ • Security Templates    │ │
│  │ • S3 Buckets            │ │  │ • IAM Policies          │ │
│  │ • Bedrock Integration   │ │  │                         │ │
│  │ • Step Functions        │ │  │                         │ │
│  │ • EventBridge           │ │  │                         │ │
│  └─────────────────────────┘ │  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## AWS CDK (Primary Infrastructure)

### **Purpose**: Core application infrastructure
### **Location**: `infra/cdk/`

#### **Components**:
- **Lambda Functions**: All service functions with bundling
- **API Gateway**: REST API with custom authorizers
- **DynamoDB**: Tables with GSI and TTL configuration
- **S3 Buckets**: Reports, artifacts, and static hosting
- **Bedrock**: Knowledge bases and AgentCore configuration
- **Step Functions**: Workflow orchestration
- **EventBridge**: Scheduled and event-driven triggers
- **CloudWatch**: Log groups, metrics, and alarms
- **KMS**: Encryption keys for multi-tenant isolation

#### **Why CDK for Core Infrastructure?**
- ✅ **Native AWS Integration**: Best support for complex AWS services
- ✅ **TypeScript Native**: Matches our application stack
- ✅ **Lambda Bundling**: Built-in support for Lambda deployment packages
- ✅ **Bedrock Support**: Latest constructs for AI services
- ✅ **Rapid Development**: Faster iteration for hackathon timeline

## Terraform (Specialized Modules)

### **Purpose**: Reusable, modular infrastructure components
### **Location**: `infra/terraform/`

#### **Module Structure**:

##### 1. **Cross-Account Roles** (`modules/cross-account-roles/`)
```hcl
# Customer scanning roles with least privilege
resource "aws_iam_role" "compliance_scanner_readonly" {
  name = "${var.tenant_id}-compliance-scanner-readonly"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          AWS = var.compliance_shepherd_account_id
        }
      }
    ]
  })
}
```

##### 2. **Customer Onboarding** (`modules/customer-onboarding/`)
```hcl
# Complete customer environment setup
module "customer_environment" {
  source = "../customer-onboarding"
  
  tenant_id                    = var.tenant_id
  aws_account_id              = var.aws_account_id
  compliance_frameworks       = ["SOC2", "HIPAA"]
  enabled_services           = ["S3", "IAM", "EC2", "CloudTrail"]
  auto_remediation_enabled   = false
}
```

##### 3. **Compliance Rules** (`modules/compliance-rules/`)
```hcl
# Reusable compliance rule definitions
module "s3_compliance_rules" {
  source = "../compliance-rules/s3"
  
  environment = var.environment
  tenant_id   = var.tenant_id
  
  rules = {
    encryption_required = true
    public_access_block = true
    versioning_enabled = false
    lifecycle_policy = true
  }
}
```

#### **Why Terraform for Modules?**
- ✅ **Reusability**: Perfect for customer onboarding templates
- ✅ **State Management**: Better for cross-account resource management
- ✅ **Module Ecosystem**: Rich community modules for compliance
- ✅ **Enterprise Adoption**: Widely used in enterprise environments
- ✅ **HashiCorp Ecosystem**: Integrates with Vault, Consul, etc.

## Deployment Strategy

### **Development Workflow**:

#### 1. **Core Infrastructure (CDK)**
```bash
# Deploy core application stack
cd infra/cdk
npm run deploy:dev
```

#### 2. **Customer Setup (Terraform)**
```bash
# Deploy customer onboarding
cd infra/terraform/environments/dev
terraform init
terraform plan -var="tenant_id=demo-customer"
terraform apply
```

### **Environment Management**:

#### **CDK Environments**:
- `dev` - Development with mock data
- `staging` - Production-like testing
- `prod` - Multi-region production

#### **Terraform Workspaces**:
- `customer-onboarding` - New customer setup
- `compliance-rules` - Rule updates
- `cross-account` - Cross-account role management

## Integration Points

### **CDK ↔ Terraform Integration**:

#### 1. **Shared State**:
```typescript
// CDK references Terraform outputs
const customerRoleArn = new CfnOutput(this, 'CustomerRoleArn', {
  value: terraformOutput.customerRoleArn,
  exportName: 'CustomerRoleArn'
});
```

#### 2. **Cross-Stack References**:
```hcl
# Terraform references CDK resources
data "aws_ssm_parameter" "compliance_shepherd_role" {
  name = "/compliance-shepherd/cross-account-role"
}
```

## Hackathon Demonstration Points

### **1. Multi-Tool Expertise**
- Show proficiency in both major IaC tools
- Demonstrate when to use each tool appropriately
- Real-world scenario: Core app (CDK) + Customer templates (Terraform)

### **2. Best Practices**
- **CDK**: Type safety, AWS-native constructs, rapid development
- **Terraform**: Reusable modules, state management, enterprise patterns

### **3. Integration Patterns**
- Cross-tool resource references
- Shared configuration management
- Unified deployment pipelines

### **4. Compliance Focus**
- Terraform modules for compliance rule templates
- CDK constructs for security-hardened infrastructure
- Audit trails across both tools

## File Structure

```
infra/
├── cdk/                          # AWS CDK (Primary)
│   ├── lib/
│   │   ├── compliance-shepherd-stack.ts
│   │   ├── lambda-stack.ts
│   │   ├── database-stack.ts
│   │   └── bedrock-stack.ts
│   ├── bin/
│   │   └── app.ts
│   └── package.json
└── terraform/                    # Terraform (Modules)
    ├── modules/
    │   ├── cross-account-roles/
    │   │   ├── main.tf
    │   │   ├── variables.tf
    │   │   └── outputs.tf
    │   ├── customer-onboarding/
    │   │   ├── main.tf
    │   │   ├── variables.tf
    │   │   └── outputs.tf
    │   └── compliance-rules/
    │       ├── s3/
    │       ├── iam/
    │       └── ec2/
    ├── environments/
    │   ├── dev/
    │   ├── staging/
    │   └── prod/
    └── examples/
        ├── customer-setup.tf
        └── compliance-template.tf
```

## Benefits for Hackathon

### **Technical Excellence**:
- ✅ **Tool Versatility**: Demonstrates expertise in both major IaC tools
- ✅ **Real-World Patterns**: Shows practical multi-tool integration
- ✅ **Compliance Focus**: Specialized modules for compliance requirements
- ✅ **Scalability**: Templates for customer onboarding and scaling

### **Judging Criteria Alignment**:
- ✅ **Creativity**: Novel approach to IaC management
- ✅ **Architecture**: Well-designed separation of concerns
- ✅ **Impact**: Reusable patterns for enterprise adoption
- ✅ **Technical Depth**: Advanced integration patterns

This dual approach showcases both technical versatility and practical real-world experience with enterprise-grade infrastructure management.
