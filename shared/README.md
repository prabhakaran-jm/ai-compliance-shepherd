# @compliance-shepherd/shared

Shared TypeScript types, interfaces, and utilities for the AI Compliance Shepherd application.

## Overview

This package provides a comprehensive type system and validation utilities that ensure type safety and consistency across all services in the AI Compliance Shepherd application.

## Features

- **Complete Type System**: Comprehensive TypeScript types for all application domains
- **Runtime Validation**: Zod-based validation schemas for API requests and data
- **Constants & Enums**: Application-wide constants and enumerations
- **Utility Functions**: Helper functions for common operations
- **Type Safety**: Full TypeScript support with strict type checking

## Installation

```bash
# This package is part of the monorepo workspace
npm install
```

## Usage

### Basic Types

```typescript
import { Finding, ScanRequest, Tenant, ComplianceFramework } from '@compliance-shepherd/shared';

// Create a finding
const finding: Finding = {
  id: 'finding-123',
  tenantId: 'tenant-456',
  findingId: 'f1234567-89ab-cdef-0123-456789abcdef',
  resourceArn: 'arn:aws:s3:::example-bucket',
  resourceType: 'AWS::S3::Bucket',
  service: 'S3',
  region: 'us-east-1',
  accountId: '123456789012',
  framework: 'SOC2',
  controlId: 'CC6.1',
  controlTitle: 'Logical and physical access controls',
  severity: 'high',
  title: 'S3 bucket lacks default encryption',
  description: 'The S3 bucket does not have default encryption enabled',
  risk: 'Unencrypted data could be exposed if accessed improperly',
  recommendation: 'Enable default encryption using AES-256 or AWS KMS',
  evidence: [],
  references: [],
  status: 'active',
  firstSeen: new Date().toISOString(),
  lastSeen: new Date().toISOString(),
  remediation: {
    type: 'automatic',
    description: 'Enable default encryption',
    steps: [],
    estimatedEffort: 'low',
    requiresApproval: false,
    automated: true,
  },
  tags: ['security', 'encryption'],
  hash: 'abc123def456',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
```

### Validation

```typescript
import { 
  validateTenantId, 
  validateFindingId, 
  validateScanRequest,
  isValidUUID,
  isValidARN 
} from '@compliance-shepherd/shared';

// Validate inputs
try {
  const tenantId = validateTenantId('tenant-123');
  const findingId = validateFindingId('f1234567-89ab-cdef-0123-456789abcdef');
  const scanRequest = validateScanRequest(scanRequestData);
  
  console.log('Validation successful');
} catch (error) {
  console.error('Validation failed:', error);
}

// Utility validations
console.log('Is UUID valid:', isValidUUID('f1234567-89ab-cdef-0123-456789abcdef'));
console.log('Is ARN valid:', isValidARN('arn:aws:s3:::example-bucket'));
```

### Constants

```typescript
import { 
  SUPPORTED_FRAMEWORKS, 
  SEVERITY_LEVELS, 
  ERROR_CODES,
  BEDROCK_MODELS,
  DEFAULT_MODEL_PARAMS 
} from '@compliance-shepherd/shared';

console.log('Supported frameworks:', SUPPORTED_FRAMEWORKS);
console.log('Severity levels:', SEVERITY_LEVELS);
console.log('Error codes:', ERROR_CODES);
console.log('Bedrock models:', BEDROCK_MODELS);
console.log('Default model params:', DEFAULT_MODEL_PARAMS);
```

## Type Categories

### Core Types

- **Common**: Base types, pagination, error responses
- **Compliance**: Framework definitions, controls, rules
- **Findings**: Finding definitions, evidence, remediation
- **Tenant**: Multi-tenant architecture, user management
- **Scanning**: Scan requests, results, scheduling
- **Remediation**: Fix application, approval workflows
- **API**: Request/response types, webhooks
- **Bedrock**: AI model configuration, knowledge bases
- **AWS**: Service-specific resource types
- **Audit**: Evidence collection, reporting

### Utilities

- **Constants**: Application-wide constants and enums
- **Validators**: Runtime validation with Zod schemas

## Validation Schemas

The package includes comprehensive validation schemas for:

- Tenant IDs, Finding IDs, Scan IDs
- Scan requests and responses
- Chat requests and responses
- Remediation requests
- Report requests
- Finding filters and pagination
- Date ranges and formats

## Error Handling

```typescript
import { ERROR_CODES, ValidationError } from '@compliance-shepherd/shared';

const handleError = (error: any) => {
  if (error.code === ERROR_CODES.UNAUTHORIZED) {
    console.log('Authentication required');
  } else if (error.code === ERROR_CODES.RESOURCE_NOT_FOUND) {
    console.log('Resource not found');
  } else {
    console.log('Unknown error:', error.message);
  }
};
```

## Examples

See `examples/usage.ts` for comprehensive examples of how to use all types and utilities.

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

## TypeScript Configuration

This package uses strict TypeScript configuration with:

- Strict type checking
- No implicit any
- No unused locals/parameters
- Exact optional property types
- Declaration maps for better debugging

## Contributing

When adding new types:

1. Add types to appropriate category file
2. Add validation schemas if needed
3. Update constants if applicable
4. Add examples to usage.ts
5. Update this README

## License

MIT License - see LICENSE file for details.
