# Testing Framework - AI Compliance Shepherd

This directory contains comprehensive testing infrastructure for the AI Compliance Shepherd platform, including unit tests, integration tests, performance tests, and security tests.

## Testing Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Testing Architecture                         │
└─────────────────────────────────────────────────────────────────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
         ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
         │Unit     │ │Integration│ │End-to-End│
         │Tests    │ │Tests      │ │Tests      │
         │         │ │           │ │           │
         └─────────┘ └─────────┘ └─────────┘
              │           │           │
              │    ┌──────▼──────┐    │
              │    │Performance  │    │
              │    │& Security   │    │
              │    │Tests        │    │
              │    │             │    │
              │    │• Load Tests │    │
              │    │• Sec Tests  │    │
              └────┤• Compliance ├────┘
                   └─────────────┘
```

## Testing Strategy

### Test Pyramid
1. **Unit Tests (70%)**: Fast, isolated tests for individual functions and classes
2. **Integration Tests (20%)**: Tests for service interactions and API contracts
3. **End-to-End Tests (10%)**: Full workflow tests from user perspective

### Testing Principles
- **Test-Driven Development (TDD)**: Write tests before implementation
- **Behavior-Driven Development (BDD)**: Focus on business requirements
- **Continuous Testing**: Automated tests in CI/CD pipeline
- **Test Coverage**: Minimum 80% code coverage for all services

## Testing Components

### 1. Unit Testing Framework
**Purpose**: Test individual functions, classes, and modules in isolation
**Tools**: Jest, TypeScript, AWS SDK Mocks
**Coverage**: All Lambda functions, services, utilities, and shared libraries

### 2. Integration Testing Framework
**Purpose**: Test service interactions, API contracts, and data flows
**Tools**: Jest, Supertest, Docker, LocalStack
**Coverage**: API endpoints, service integrations, database operations

### 3. End-to-End Testing Framework
**Purpose**: Test complete workflows from user perspective
**Tools**: Playwright, Cypress, AWS CLI
**Coverage**: User journeys, compliance workflows, audit processes

### 4. Performance Testing Framework
**Purpose**: Test performance, scalability, and load handling
**Tools**: Artillery, K6, AWS Load Testing
**Coverage**: API performance, Lambda cold starts, database throughput

### 5. Security Testing Framework
**Purpose**: Test security controls, vulnerabilities, and compliance
**Tools**: OWASP ZAP, SonarQube, Snyk
**Coverage**: Security guardrails, encryption, access controls

## Test Coverage Requirements

### Service-Level Coverage
- **Lambda Functions**: 90% line coverage, 85% branch coverage
- **API Endpoints**: 100% endpoint coverage, all HTTP methods
- **Database Operations**: 100% repository method coverage
- **Security Controls**: 100% security function coverage

### Business Logic Coverage
- **Compliance Rules**: 100% rule coverage, all scenarios
- **Remediation Actions**: 100% action coverage, success/failure paths
- **Report Generation**: 100% template coverage, all formats
- **AI Interactions**: 100% action group coverage, all intents

### Error Handling Coverage
- **Exception Scenarios**: All error paths tested
- **Input Validation**: All validation rules tested
- **Circuit Breakers**: All failure modes tested
- **Rate Limiting**: All limit scenarios tested

## Files Structure

```
testing/
├── README.md                           # This documentation
├── unit-tests/                         # Unit test implementations
│   ├── jest.config.js                  # Jest configuration
│   ├── setup/                          # Test setup and utilities
│   │   ├── jest.setup.ts               # Global Jest setup
│   │   ├── aws-mocks.ts                # AWS SDK mocks
│   │   ├── test-helpers.ts             # Common test utilities
│   │   └── fixtures/                   # Test data fixtures
│   ├── services/                       # Service-specific unit tests
│   │   ├── scan-environment/           # Scan environment tests
│   │   ├── findings-storage/           # Findings storage tests
│   │   ├── api-gateway/               # API gateway tests
│   │   ├── html-report-generator/     # Report generator tests
│   │   ├── s3-bucket-manager/         # S3 manager tests
│   │   ├── analyze-terraform-plan/    # Terraform analyzer tests
│   │   ├── github-webhook-handler/    # GitHub webhook tests
│   │   ├── apply-fix/                 # Apply fix tests
│   │   ├── bedrock-knowledge-base/    # Bedrock KB tests
│   │   ├── bedrock-agent/             # Bedrock agent tests
│   │   ├── chat-interface/            # Chat interface tests
│   │   ├── step-functions-orchestrator/ # Step functions tests
│   │   ├── eventbridge-scheduler/     # EventBridge tests
│   │   ├── tenant-management/         # Tenant management tests
│   │   ├── audit-pack-generator/      # Audit pack tests
│   │   ├── slack-notifications/       # Slack notifications tests
│   │   └── web-ui/                    # Web UI tests
│   ├── security/                      # Security service tests
│   │   ├── kms-encryption/            # KMS encryption tests
│   │   ├── secrets-management/        # Secrets management tests
│   │   ├── security-guardrails/       # Security guardrails tests
│   │   └── security-monitoring/       # Security monitoring tests
│   ├── monitoring/                    # Monitoring service tests
│   │   ├── cloudwatch-metrics/        # CloudWatch metrics tests
│   │   ├── xray-tracing/              # X-Ray tracing tests
│   │   ├── log-analytics/             # Log analytics tests
│   │   └── shared-monitoring/         # Shared monitoring tests
│   └── shared/                        # Shared library tests
│       ├── data-access-layer/         # Data access layer tests
│       ├── compliance-rules-engine/   # Rules engine tests
│       └── shared-types/              # Type definition tests
├── integration-tests/                 # Integration test implementations
│   ├── jest.config.js                 # Integration test Jest config
│   ├── setup/                         # Integration test setup
│   │   ├── localstack.ts              # LocalStack setup
│   │   ├── test-environment.ts        # Test environment setup
│   │   └── cleanup.ts                 # Test cleanup utilities
│   ├── api/                           # API integration tests
│   │   ├── scan-endpoints.test.ts     # Scan API tests
│   │   ├── findings-endpoints.test.ts # Findings API tests
│   │   ├── reports-endpoints.test.ts  # Reports API tests
│   │   └── auth-endpoints.test.ts     # Authentication tests
│   ├── workflows/                     # Workflow integration tests
│   │   ├── compliance-scan.test.ts    # Full scan workflow
│   │   ├── remediation.test.ts        # Remediation workflow
│   │   ├── audit-pack.test.ts         # Audit pack generation
│   │   └── chat-interaction.test.ts   # AI chat workflow
│   └── database/                      # Database integration tests
│       ├── repositories.test.ts       # Repository tests
│       ├── migrations.test.ts         # Migration tests
│       └── performance.test.ts        # Database performance tests
├── e2e-tests/                         # End-to-end test implementations
│   ├── playwright.config.ts           # Playwright configuration
│   ├── fixtures/                      # E2E test fixtures
│   ├── pages/                         # Page object models
│   ├── workflows/                     # User workflow tests
│   │   ├── customer-onboarding.spec.ts # Onboarding workflow
│   │   ├── compliance-scanning.spec.ts # Scanning workflow
│   │   ├── ai-chat.spec.ts            # AI chat workflow
│   │   └── audit-generation.spec.ts   # Audit workflow
│   └── api/                           # API E2E tests
│       ├── rest-api.spec.ts           # REST API tests
│       └── websocket-api.spec.ts      # WebSocket API tests
├── performance-tests/                 # Performance test implementations
│   ├── artillery.yml                  # Artillery configuration
│   ├── load-tests/                    # Load testing scenarios
│   │   ├── api-load.js                # API load tests
│   │   ├── scan-load.js               # Scan performance tests
│   │   └── chat-load.js               # Chat performance tests
│   ├── stress-tests/                  # Stress testing scenarios
│   └── benchmarks/                    # Performance benchmarks
├── security-tests/                    # Security test implementations
│   ├── owasp-zap/                     # OWASP ZAP security tests
│   ├── penetration-tests/             # Penetration testing
│   ├── vulnerability-scans/           # Vulnerability scanning
│   └── compliance-tests/              # Compliance validation tests
├── test-data/                         # Test data and fixtures
│   ├── sample-aws-resources/          # Sample AWS resource data
│   ├── compliance-findings/           # Sample compliance findings
│   ├── terraform-plans/               # Sample Terraform plans
│   └── audit-evidence/                # Sample audit evidence
├── scripts/                           # Testing scripts and utilities
│   ├── run-all-tests.sh              # Run all test suites
│   ├── run-unit-tests.sh             # Run unit tests only
│   ├── run-integration-tests.sh      # Run integration tests only
│   ├── run-e2e-tests.sh              # Run E2E tests only
│   ├── generate-coverage.sh          # Generate coverage reports
│   ├── setup-test-environment.sh     # Setup test environment
│   └── cleanup-test-data.sh          # Cleanup test data
└── reports/                           # Test reports and coverage
    ├── coverage/                      # Code coverage reports
    ├── junit/                         # JUnit test reports
    ├── performance/                   # Performance test reports
    └── security/                      # Security test reports
```

## Testing Tools and Technologies

### Unit Testing Stack
- **Jest**: JavaScript testing framework with TypeScript support
- **AWS SDK Mock**: Mock AWS SDK calls for isolated testing
- **Supertest**: HTTP assertion library for API testing
- **Sinon**: Standalone test spies, stubs, and mocks

### Integration Testing Stack
- **LocalStack**: Local AWS cloud stack for integration testing
- **Docker**: Containerized test environments
- **TestContainers**: Integration testing with real dependencies
- **Postman/Newman**: API testing and collection runner

### E2E Testing Stack
- **Playwright**: Cross-browser web testing framework
- **Cypress**: JavaScript E2E testing framework
- **Puppeteer**: Headless Chrome API for automation
- **AWS CLI**: Command-line testing of AWS services

### Performance Testing Stack
- **Artillery**: Load testing toolkit
- **K6**: Performance testing framework
- **Apache Bench**: HTTP server benchmarking
- **AWS Load Testing Solution**: Cloud-based load testing

### Security Testing Stack
- **OWASP ZAP**: Web application security scanner
- **SonarQube**: Static code analysis and security scanning
- **Snyk**: Vulnerability scanning for dependencies
- **Bandit**: Python security linter

## Test Execution Strategy

### Local Development
```bash
# Run all unit tests
npm run test:unit

# Run specific service tests
npm run test:unit:scan-environment

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### CI/CD Pipeline
```bash
# Stage 1: Unit Tests (Fast feedback)
npm run test:unit:ci

# Stage 2: Integration Tests (Service validation)
npm run test:integration:ci

# Stage 3: Security Tests (Security validation)
npm run test:security:ci

# Stage 4: E2E Tests (User journey validation)
npm run test:e2e:ci

# Stage 5: Performance Tests (Performance validation)
npm run test:performance:ci
```

### Quality Gates
- **Unit Tests**: Must pass with 80% coverage
- **Integration Tests**: Must pass with 0 failures
- **Security Tests**: Must pass with no high-severity issues
- **Performance Tests**: Must meet SLA requirements
- **E2E Tests**: Must pass critical user journeys

## Testing Best Practices

### Unit Testing Best Practices
1. **Arrange-Act-Assert (AAA)**: Structure tests clearly
2. **Single Responsibility**: One assertion per test
3. **Descriptive Names**: Test names describe behavior
4. **Mock External Dependencies**: Isolate unit under test
5. **Test Edge Cases**: Boundary conditions and error scenarios

### Integration Testing Best Practices
1. **Test Real Interactions**: Use actual service dependencies
2. **Clean Test Data**: Setup and teardown test data
3. **Environment Isolation**: Separate test environments
4. **Contract Testing**: Validate API contracts
5. **Error Propagation**: Test error handling across services

### Performance Testing Best Practices
1. **Baseline Establishment**: Establish performance baselines
2. **Gradual Load Increase**: Ramp up load gradually
3. **Resource Monitoring**: Monitor CPU, memory, network
4. **SLA Validation**: Validate against defined SLAs
5. **Bottleneck Identification**: Identify performance bottlenecks

### Security Testing Best Practices
1. **Security by Design**: Test security requirements early
2. **Threat Modeling**: Test against identified threats
3. **Penetration Testing**: Regular penetration testing
4. **Compliance Validation**: Validate compliance requirements
5. **Vulnerability Management**: Regular vulnerability scanning

## Test Data Management

### Test Data Strategy
- **Synthetic Data**: Generated test data for predictable scenarios
- **Anonymized Production Data**: Real data patterns without sensitive information
- **Boundary Data**: Edge cases and boundary conditions
- **Error Data**: Invalid inputs and error scenarios

### Test Data Lifecycle
1. **Generation**: Automated test data generation
2. **Provisioning**: Setup test data before tests
3. **Isolation**: Isolated test data per test suite
4. **Cleanup**: Automated cleanup after tests
5. **Refresh**: Regular refresh of test datasets

## Continuous Testing

### CI/CD Integration
- **Pre-commit Hooks**: Run unit tests before commits
- **Pull Request Validation**: Full test suite on PRs
- **Deployment Validation**: Post-deployment testing
- **Scheduled Testing**: Nightly comprehensive test runs
- **Production Monitoring**: Continuous production validation

### Test Automation
- **Automated Test Discovery**: Automatic test detection
- **Parallel Execution**: Parallel test execution for speed
- **Flaky Test Detection**: Identify and fix flaky tests
- **Test Result Analytics**: Test result trend analysis
- **Automated Reporting**: Automated test result reporting

## Quality Metrics

### Coverage Metrics
- **Line Coverage**: Minimum 80% for all services
- **Branch Coverage**: Minimum 75% for all services
- **Function Coverage**: Minimum 85% for all services
- **Statement Coverage**: Minimum 80% for all services

### Quality Metrics
- **Test Success Rate**: > 98% test success rate
- **Test Execution Time**: < 30 minutes for full suite
- **Flaky Test Rate**: < 2% flaky test rate
- **Mean Time to Repair**: < 4 hours to fix failing tests

### Performance Metrics
- **API Response Time**: < 200ms for 95% of requests
- **Test Execution Speed**: < 5 minutes for unit tests
- **Resource Utilization**: < 80% CPU/memory during tests
- **Throughput**: > 100 RPS for critical endpoints

---

This comprehensive testing framework ensures the AI Compliance Shepherd platform maintains high quality, performance, and security standards through automated testing at all levels.
