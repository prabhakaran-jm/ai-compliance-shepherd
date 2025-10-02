# Integration Tests - AI Compliance Shepherd

This directory contains integration tests that verify end-to-end workflows and service interactions within the AI Compliance Shepherd platform.

## Overview

Integration tests validate that multiple services work together correctly, testing real workflows that users would experience. These tests use LocalStack to simulate AWS services and verify complete user journeys.

## Test Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Integration Test Architecture                 │
└─────────────────────────────────────────────────────────────────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
         ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
         │Workflow │ │Service  │ │Database │
         │Tests    │ │Tests    │ │Tests    │
         │         │ │         │ │         │
         └─────────┘ └─────────┘ └─────────┘
              │           │           │
              │    ┌──────▼──────┐    │
              │    │LocalStack   │    │
              │    │AWS Services │    │
              │    │             │    │
              │    │• DynamoDB   │    │
              │    │• S3         │    │
              │    │• Lambda     │    │
              └────┤• CloudWatch ├────┘
                   └─────────────┘
```

## Test Categories

### 1. Workflow Integration Tests
Test complete user workflows from start to finish:
- **Compliance Scan Workflow**: Trigger scan → Process results → Generate findings → Create reports
- **Remediation Workflow**: Identify issue → Apply fix → Verify resolution → Update status
- **Audit Pack Generation**: Collect evidence → Generate reports → Package artifacts → Store securely
- **AI Chat Workflow**: User query → Knowledge base lookup → Generate response → Track conversation

### 2. Service Integration Tests
Test interactions between specific services:
- **API Gateway ↔ Lambda Services**: Request routing, authentication, response handling
- **Lambda ↔ DynamoDB**: Data persistence, querying, error handling
- **Lambda ↔ S3**: File storage, retrieval, lifecycle management
- **EventBridge ↔ Step Functions**: Event triggering, workflow orchestration

### 3. Data Flow Tests
Test data consistency across service boundaries:
- **Scan Results Processing**: Resource discovery → Rule evaluation → Finding creation → Storage
- **Multi-tenant Data Isolation**: Tenant A data never accessible to Tenant B
- **Event Propagation**: Changes in one service trigger appropriate updates in others

### 4. Error Handling Tests
Test system behavior under failure conditions:
- **Service Unavailability**: How system handles when dependencies are down
- **Data Corruption**: Recovery from invalid or corrupted data
- **Rate Limiting**: Behavior under high load conditions
- **Timeout Scenarios**: Handling of long-running operations

## Test Environment

### LocalStack Services
The integration tests use LocalStack to simulate AWS services:
- **DynamoDB**: For data persistence testing
- **S3**: For file storage and retrieval testing
- **Lambda**: For function invocation testing
- **CloudWatch**: For metrics and logging testing
- **EventBridge**: For event-driven workflow testing
- **Step Functions**: For workflow orchestration testing

### Test Data Management
- **Fixtures**: Pre-defined test data for consistent testing
- **Factories**: Dynamic test data generation for varied scenarios
- **Cleanup**: Automatic cleanup after each test to prevent interference
- **Isolation**: Each test runs in isolation with fresh data

## Test Structure

```
testing/integration-tests/
├── README.md                           # This documentation
├── jest.config.js                      # Jest configuration for integration tests
├── setup/                              # Test setup and utilities
│   ├── jest.setup.ts                   # Global setup for integration tests
│   ├── localstack.ts                   # LocalStack configuration and management
│   ├── test-environment.ts             # Test environment setup
│   ├── cleanup.ts                      # Test cleanup utilities
│   └── fixtures/                       # Test data fixtures
│       ├── aws-resources.json          # Sample AWS resource data
│       ├── compliance-findings.json    # Sample compliance findings
│       ├── terraform-plans.json        # Sample Terraform plans
│       └── user-sessions.json          # Sample user session data
├── workflows/                          # End-to-end workflow tests
│   ├── compliance-scan.test.ts         # Complete compliance scan workflow
│   ├── remediation.test.ts             # Automated remediation workflow
│   ├── audit-pack-generation.test.ts   # Audit pack creation workflow
│   ├── ai-chat-interaction.test.ts     # AI chat conversation workflow
│   ├── tenant-onboarding.test.ts       # Multi-tenant onboarding workflow
│   └── scheduled-operations.test.ts    # EventBridge scheduled operations
├── services/                           # Service interaction tests
│   ├── api-gateway-integration.test.ts # API Gateway to Lambda integration
│   ├── lambda-dynamodb.test.ts         # Lambda to DynamoDB integration
│   ├── lambda-s3.test.ts               # Lambda to S3 integration
│   ├── eventbridge-stepfunctions.test.ts # EventBridge to Step Functions
│   ├── bedrock-integration.test.ts     # Bedrock AI service integration
│   └── slack-notifications.test.ts    # Slack notification integration
├── data-flow/                          # Data consistency tests
│   ├── scan-results-processing.test.ts # End-to-end scan data processing
│   ├── multi-tenant-isolation.test.ts  # Tenant data isolation validation
│   ├── event-propagation.test.ts       # Cross-service event handling
│   └── data-consistency.test.ts        # Data consistency across services
├── error-handling/                     # Error scenario tests
│   ├── service-failures.test.ts        # Service unavailability scenarios
│   ├── data-corruption.test.ts         # Data corruption recovery
│   ├── rate-limiting.test.ts           # Rate limiting behavior
│   └── timeout-scenarios.test.ts       # Long-running operation timeouts
├── performance/                        # Performance integration tests
│   ├── load-testing.test.ts            # System behavior under load
│   ├── concurrent-operations.test.ts   # Concurrent request handling
│   └── resource-utilization.test.ts    # Resource usage validation
└── utils/                              # Test utilities
    ├── api-client.ts                   # HTTP client for API testing
    ├── aws-helpers.ts                  # AWS service interaction helpers
    ├── data-generators.ts              # Dynamic test data generation
    ├── assertions.ts                   # Custom assertion helpers
    └── wait-for.ts                     # Async operation waiting utilities
```

## Key Test Scenarios

### 1. Complete Compliance Scan Workflow
```typescript
describe('Complete Compliance Scan Workflow', () => {
  it('should execute full scan from trigger to report generation', async () => {
    // 1. Trigger scan via API Gateway
    // 2. Verify scan job created in DynamoDB
    // 3. Process AWS resource discovery
    // 4. Execute compliance rules evaluation
    // 5. Store findings in DynamoDB
    // 6. Generate HTML report
    // 7. Store report in S3
    // 8. Send Slack notification
    // 9. Verify all data consistency
  });
});
```

### 2. Multi-Tenant Data Isolation
```typescript
describe('Multi-Tenant Data Isolation', () => {
  it('should prevent cross-tenant data access', async () => {
    // 1. Create data for Tenant A
    // 2. Create data for Tenant B
    // 3. Attempt cross-tenant access
    // 4. Verify access denied
    // 5. Verify data isolation maintained
  });
});
```

### 3. AI Chat Integration
```typescript
describe('AI Chat Integration', () => {
  it('should handle complete chat conversation', async () => {
    // 1. Send user message via WebSocket
    // 2. Process through Bedrock Agent
    // 3. Query Knowledge Base
    // 4. Generate AI response
    // 5. Store conversation history
    // 6. Return response to user
  });
});
```

### 4. Automated Remediation
```typescript
describe('Automated Remediation', () => {
  it('should safely apply fixes with rollback capability', async () => {
    // 1. Identify compliance finding
    // 2. Generate remediation plan
    // 3. Execute safety checks
    // 4. Apply remediation
    // 5. Verify fix applied
    // 6. Update finding status
    // 7. Test rollback if needed
  });
});
```

## Test Configuration

### Environment Variables
```bash
# LocalStack Configuration
LOCALSTACK_ENDPOINT=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_DEFAULT_REGION=us-east-1

# Test Configuration
TEST_TIMEOUT=60000
TEST_RETRIES=3
INTEGRATION_TEST_MODE=true

# Service Endpoints
API_GATEWAY_ENDPOINT=http://localhost:3000
WEBSOCKET_ENDPOINT=ws://localhost:3001
```

### Jest Configuration
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 60000,
  setupFilesAfterEnv: ['<rootDir>/setup/jest.setup.ts'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    '../services/**/*.ts',
    '../security/**/*.ts',
    '../monitoring/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  coverageDirectory: '../reports/coverage/integration',
  maxWorkers: 1, // Sequential execution for integration tests
  forceExit: true,
  detectOpenHandles: true
};
```

## Running Integration Tests

### Prerequisites
1. **Docker**: Required for LocalStack
2. **Node.js 18+**: For running tests
3. **AWS CLI**: For LocalStack interaction (optional)

### Setup Commands
```bash
# Install dependencies
npm install

# Start LocalStack
docker-compose up -d localstack

# Run integration tests
npm run test:integration

# Run specific test suite
npm run test:integration -- --testNamePattern="Compliance Scan"

# Run with coverage
npm run test:integration:coverage

# Clean up after tests
npm run test:cleanup
```

### CI/CD Integration
```bash
# In CI pipeline
npm run test:integration:ci

# With Docker Compose
docker-compose -f docker-compose.test.yml run integration-tests
```

## Best Practices

### Test Design
1. **Test Real Scenarios**: Focus on actual user workflows
2. **Use Realistic Data**: Test with data similar to production
3. **Test Error Paths**: Include failure scenarios and edge cases
4. **Maintain Test Independence**: Each test should run in isolation
5. **Clean Up Resources**: Always clean up test data and resources

### Performance Considerations
1. **Parallel Execution**: Run independent tests in parallel when possible
2. **Resource Sharing**: Share expensive setup operations across tests
3. **Selective Testing**: Allow running specific test suites for faster feedback
4. **Timeout Management**: Set appropriate timeouts for async operations

### Data Management
1. **Fixture Management**: Use consistent test data across test runs
2. **Dynamic Generation**: Generate varied test data for comprehensive coverage
3. **State Management**: Ensure tests don't depend on external state
4. **Cleanup Strategy**: Implement reliable cleanup to prevent test pollution

## Troubleshooting

### Common Issues

#### LocalStack Connection Issues
```bash
# Check LocalStack status
curl http://localhost:4566/health

# Restart LocalStack
docker-compose restart localstack

# Check LocalStack logs
docker-compose logs localstack
```

#### Test Timeouts
- Increase test timeout in Jest configuration
- Check for hanging async operations
- Verify LocalStack service availability

#### Data Consistency Issues
- Ensure proper test cleanup
- Check for race conditions in async operations
- Verify test isolation

#### Memory Issues
- Reduce parallel test execution
- Implement proper resource cleanup
- Monitor memory usage during test runs

### Debugging Tips
1. **Enable Debug Logging**: Set LOG_LEVEL=debug for detailed logs
2. **Use Test Reporters**: Enable verbose reporting for better visibility
3. **Isolate Failing Tests**: Run individual tests to identify issues
4. **Check Service Health**: Verify all dependencies are running correctly

## Metrics and Reporting

### Test Metrics
- **Test Coverage**: Percentage of code covered by integration tests
- **Test Duration**: Time taken for complete test suite execution
- **Success Rate**: Percentage of tests passing consistently
- **Flaky Test Rate**: Tests that fail intermittently

### Reporting
- **HTML Reports**: Detailed test results with coverage information
- **JUnit XML**: For CI/CD integration and reporting
- **Coverage Reports**: Code coverage analysis and trends
- **Performance Reports**: Test execution time and resource usage

---

This integration testing framework ensures the AI Compliance Shepherd platform works correctly as a complete system, validating that all services interact properly and deliver the expected user experience.
