# Compliance Rules Engine

The core compliance rules engine for AI Compliance Shepherd that implements deterministic rules for AWS resource compliance checking.

## Overview

This package provides a comprehensive set of compliance rules that can be executed against AWS resources to identify security and compliance violations. The engine supports SOC 2, HIPAA, and GDPR compliance frameworks with extensible rule architecture.

## Features

- **Deterministic Rules**: Precise, rule-based compliance checking
- **Multiple Frameworks**: SOC 2, HIPAA, GDPR support
- **AWS Service Coverage**: S3, IAM, EC2 Security Groups, CloudTrail
- **Parallel Execution**: Configurable parallel rule execution
- **Evidence Collection**: Detailed evidence gathering for findings
- **Remediation Guidance**: Automated remediation step generation
- **Extensible Architecture**: Easy to add new rules and services

## Supported Compliance Rules

### S3 Rules
- **S3-001**: S3 buckets must have default encryption enabled
- **S3-002**: S3 buckets must have public access blocked
- **S3-003**: S3 buckets should have versioning enabled

### IAM Rules
- **IAM-001**: Root account must have MFA enabled
- **IAM-002**: IAM password policy must meet requirements
- **IAM-003**: IAM users should not have wildcard permissions

### Security Group Rules
- **SG-001**: Security Groups should not allow unrestricted access
- **SG-002**: Security Groups should not allow all traffic (0.0.0.0/0) on any port

### CloudTrail Rules
- **CT-001**: CloudTrail must be enabled and configured for multi-region
- **CT-002**: CloudTrail logs should be stored in an immutable S3 bucket
- **CT-003**: CloudTrail should have log file validation enabled

## Installation

```bash
# This package is part of the monorepo workspace
npm install
```

## Usage

### Basic Usage

```typescript
import { ComplianceRulesEngine } from '@compliance-shepherd/compliance-rules-engine';
import { AWSResource, RuleExecutionContext, RulesEngineConfig } from '@compliance-shepherd/shared';

// Initialize the rules engine
const rulesEngine = new ComplianceRulesEngine();

// Define AWS resources to check
const resources: AWSResource[] = [
  {
    arn: 'arn:aws:s3:::example-bucket',
    type: 'AWS::S3::Bucket',
    name: 'example-bucket',
    region: 'us-east-1',
    accountId: '123456789012',
    tags: {
      Environment: 'production',
      Service: 'storage',
    },
  },
];

// Set up execution context
const context: RuleExecutionContext = {
  tenantId: 'tenant-123',
  accountId: '123456789012',
  region: 'us-east-1',
  userId: 'user-123',
  scanId: 'scan-456',
  timestamp: new Date().toISOString(),
};

// Configure execution options
const config: RulesEngineConfig = {
  parallel: true,
  maxConcurrency: 5,
  timeout: 300,
  retryCount: 3,
  includeEvidence: true,
  includeRecommendations: true,
  dryRun: false,
};

// Execute compliance rules
const results = await rulesEngine.executeRules(resources, context, config);

console.log(`Executed ${results.stats.totalRules} rules`);
console.log(`Found ${results.results.length} resource results`);
console.log(`Compliance score: ${results.results[0].complianceScore}%`);
```

### Executing Individual Rules

```typescript
// Execute a specific rule
const result = await rulesEngine.executeRule(
  'S3-001', // Rule ID
  resources[0], // Resource
  context,
  config
);

console.log(`Rule ${result.ruleId} result: ${result.passed ? 'PASSED' : 'FAILED'}`);
console.log(`Message: ${result.message}`);
console.log(`Evidence: ${result.evidence.length} items collected`);
```

### Getting Rule Information

```typescript
// Get all available rules
const allRules = rulesEngine.getAllRules();
console.log(`Available rules: ${allRules.length}`);

// Get rules for specific service
const s3Rules = rulesEngine.getRulesForService('S3');
console.log(`S3 rules: ${s3Rules.length}`);

// Get rules for specific framework
const soc2Rules = rulesEngine.getRulesForFramework('SOC2');
console.log(`SOC 2 rules: ${soc2Rules.length}`);
```

## Rule Architecture

### Base Rule Executor

All rules extend the `BaseRuleExecutor` class which provides:

- **Validation**: Check if rule applies to resource type
- **Execution**: Perform compliance check
- **Evidence Collection**: Gather supporting data
- **Recommendations**: Generate remediation guidance
- **Error Handling**: Graceful error management

### Creating Custom Rules

```typescript
import { BaseRuleExecutor } from '@compliance-shepherd/compliance-rules-engine';
import { AWSResource, Severity, ComplianceFramework } from '@compliance-shepherd/shared';

class CustomRule extends BaseRuleExecutor {
  constructor() {
    super(
      'CUSTOM-001',
      'Custom Compliance Rule',
      ['SOC2'],
      'high',
      ['AWS::S3::Bucket'],
      'S3'
    );
  }

  protected async performCheck(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<{ passed: boolean; severity?: Severity; message: string }> {
    // Implement compliance check logic
    return {
      passed: true,
      message: 'Custom rule passed',
    };
  }

  protected async collectEvidence(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<RuleEvidence[]> {
    // Collect evidence for the check
    return [];
  }

  protected async generateRecommendations(
    resource: AWSResource,
    context: RuleExecutionContext,
    checkResult: { passed: boolean; severity?: Severity; message: string }
  ): Promise<string[]> {
    // Generate recommendations
    return ['Custom recommendation'];
  }

  protected async generateRemediationSteps(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<RemediationStep[]> {
    // Generate remediation steps
    return [];
  }

  protected async performValidation(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<boolean> {
    // Validate if rule applies to resource
    return true;
  }
}

// Register the custom rule
const rulesEngine = new ComplianceRulesEngine();
rulesEngine.registerRule(new CustomRule());
```

## Configuration Options

### RulesEngineConfig

```typescript
interface RulesEngineConfig {
  parallel: boolean;           // Enable parallel execution
  maxConcurrency: number;      // Maximum concurrent rule executions
  timeout: number;             // Timeout in seconds
  retryCount: number;          // Number of retries on failure
  includeEvidence: boolean;    // Collect evidence during execution
  includeRecommendations: boolean; // Generate recommendations
  dryRun: boolean;            // Execute without making changes
}
```

### Rule Execution Context

```typescript
interface RuleExecutionContext {
  tenantId: string;           // Tenant identifier
  accountId: string;          // AWS account ID
  region: string;             // AWS region
  userId?: string;            // User who initiated the scan
  scanId?: string;            // Scan identifier
  timestamp: string;          // Execution timestamp
}
```

## Result Structure

### Rule Execution Result

```typescript
interface RuleExecutionResult {
  ruleId: string;                    // Rule identifier
  resourceArn: string;               // Resource ARN
  passed: boolean;                   // Whether rule passed
  severity?: Severity;               // Severity if failed
  message: string;                   // Result message
  evidence: RuleEvidence[];          // Collected evidence
  recommendations: string[];         // Generated recommendations
  metadata: Record<string, unknown>; // Additional metadata
  executionTime: number;             // Execution time in milliseconds
}
```

### Resource Result Aggregation

```typescript
interface RuleResultAggregation {
  resourceArn: string;               // Resource ARN
  totalRules: number;                // Total rules executed
  passedRules: number;               // Rules that passed
  failedRules: number;               // Rules that failed
  findings: Finding[];               // Generated findings
  complianceScore: number;           // Compliance score (0-100)
  frameworks: ComplianceFramework[]; // Applicable frameworks
  overallSeverity: Severity;         // Overall severity
  summary: string;                   // Summary description
}
```

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Development

### Building

```bash
npm run build
```

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

## AWS Permissions

The rules engine requires the following AWS permissions:

### S3 Rules
- `s3:GetBucketEncryption`
- `s3:GetPublicAccessBlock`
- `s3:GetBucketVersioning`
- `s3:HeadBucket`

### IAM Rules
- `iam:GetAccountSummary`
- `iam:ListVirtualMFADevices`
- `iam:GetAccountPasswordPolicy`
- `iam:ListAttachedUserPolicies`
- `iam:GetPolicy`
- `iam:GetPolicyVersion`
- `iam:GetUser`

### EC2 Rules
- `ec2:DescribeSecurityGroups`

### CloudTrail Rules
- `cloudtrail:DescribeTrails`
- `cloudtrail:GetTrailStatus`

## Error Handling

The rules engine includes comprehensive error handling:

- **Permission Errors**: Graceful handling of insufficient permissions
- **Service Errors**: Retry logic for transient AWS service errors
- **Timeout Errors**: Configurable timeouts with fallback behavior
- **Validation Errors**: Input validation with detailed error messages

## Performance Considerations

- **Parallel Execution**: Rules can be executed in parallel for better performance
- **Resource Batching**: Multiple resources can be processed together
- **Caching**: AWS API responses can be cached to reduce API calls
- **Timeout Management**: Configurable timeouts prevent hanging executions

## Contributing

When adding new rules:

1. Create a new rule class extending `BaseRuleExecutor`
2. Implement all required abstract methods
3. Add comprehensive tests
4. Update documentation
5. Register the rule in the engine

## License

MIT License - see LICENSE file for details.
