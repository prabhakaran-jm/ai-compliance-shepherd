/**
 * Global Jest setup for AI Compliance Shepherd integration tests
 * 
 * This file configures the integration testing environment, sets up LocalStack,
 * and provides utilities for end-to-end testing scenarios.
 */

import { jest } from '@jest/globals';
import { setupLocalStack } from './localstack';
import { setupTestEnvironment } from './test-environment';
import { cleanupTestData } from './cleanup';

// Increase timeout for integration tests
jest.setTimeout(60000);

// Setup global environment variables for integration testing
process.env.NODE_ENV = 'test';
process.env.INTEGRATION_TEST_MODE = 'true';
process.env.AWS_REGION = 'us-east-1';
process.env.LOCALSTACK_ENDPOINT = 'http://localhost:4566';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
process.env.XRAY_TRACING_ENABLED = 'false'; // Disable X-Ray in tests

// AWS LocalStack configuration
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';
process.env.AWS_ENDPOINT_URL = 'http://localhost:4566';
process.env.DYNAMODB_ENDPOINT = 'http://localhost:4566';
process.env.S3_ENDPOINT = 'http://localhost:4566';
process.env.LAMBDA_ENDPOINT = 'http://localhost:4566';
process.env.CLOUDWATCH_ENDPOINT = 'http://localhost:4566';
process.env.EVENTBRIDGE_ENDPOINT = 'http://localhost:4566';
process.env.STEPFUNCTIONS_ENDPOINT = 'http://localhost:4566';

// Test-specific configurations
process.env.S3_FORCE_PATH_STYLE = 'true';
process.env.DYNAMODB_TABLE_PREFIX = 'ai-compliance-';
process.env.DYNAMODB_TABLE_SUFFIX = '-test';
process.env.S3_REPORTS_BUCKET = 'ai-compliance-test-reports';
process.env.S3_ARTIFACTS_BUCKET = 'ai-compliance-test-artifacts';

// Global test utilities for integration tests
global.integrationTestUtils = {
  // Generate unique test identifiers
  generateTestId: (): string => {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  // Generate test tenant ID with integration prefix
  generateTenantId: (): string => {
    return `tenant-integration-${Math.random().toString(36).substr(2, 9)}`;
  },

  // Generate test user ID
  generateUserId: (): string => {
    return `user-integration-${Math.random().toString(36).substr(2, 9)}`;
  },

  // Generate test scan ID
  generateScanId: (): string => {
    return `scan-integration-${Math.random().toString(36).substr(2, 9)}`;
  },

  // Generate test finding ID
  generateFindingId: (): string => {
    return `finding-integration-${Math.random().toString(36).substr(2, 9)}`;
  },

  // Create test API Gateway event for integration testing
  createAPIGatewayEvent: (options: Partial<any> = {}): any => {
    return {
      httpMethod: 'GET',
      path: '/test',
      pathParameters: null,
      queryStringParameters: null,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'integration-test-agent',
        'X-Test-Mode': 'integration'
      },
      body: null,
      isBase64Encoded: false,
      requestContext: {
        requestId: global.integrationTestUtils.generateTestId(),
        identity: {
          sourceIp: '127.0.0.1',
          userAgent: 'integration-test-agent'
        },
        httpMethod: 'GET',
        path: '/test',
        stage: 'test',
        requestTime: new Date().toISOString(),
        requestTimeEpoch: Date.now()
      },
      ...options
    };
  },

  // Create test Lambda context for integration testing
  createLambdaContext: (options: Partial<any> = {}): any => {
    return {
      awsRequestId: global.integrationTestUtils.generateTestId(),
      invokeid: global.integrationTestUtils.generateTestId(),
      logGroupName: '/aws/lambda/integration-test-function',
      logStreamName: '2024/01/01/[$LATEST]integration-test-stream',
      functionName: 'integration-test-function',
      functionVersion: '$LATEST',
      memoryLimitInMB: '512',
      getRemainingTimeInMillis: () => 60000, // 60 seconds for integration tests
      callbackWaitsForEmptyEventLoop: true,
      ...options
    };
  },

  // Create comprehensive test scan job
  createTestScanJob: (overrides: Partial<any> = {}): any => {
    const tenantId = overrides.tenantId || global.integrationTestUtils.generateTenantId();
    const scanId = overrides.scanId || global.integrationTestUtils.generateScanId();
    
    return {
      scanId,
      tenantId,
      scanType: 'FULL_COMPLIANCE',
      status: 'PENDING',
      progress: 0,
      startedAt: new Date().toISOString(),
      configuration: {
        regions: ['us-east-1'],
        services: ['s3', 'iam', 'ec2', 'cloudtrail'],
        rules: ['all'],
        includeCompliant: false,
        excludeRules: []
      },
      results: {
        totalResources: 0,
        totalFindings: 0,
        criticalFindings: 0,
        highFindings: 0,
        mediumFindings: 0,
        lowFindings: 0
      },
      metadata: {
        createdBy: 'integration-test',
        source: 'api',
        version: '1.0.0'
      },
      ...overrides
    };
  },

  // Create test finding with realistic data
  createTestFinding: (overrides: Partial<any> = {}): any => {
    const tenantId = overrides.tenantId || global.integrationTestUtils.generateTenantId();
    const findingId = overrides.findingId || global.integrationTestUtils.generateFindingId();
    const scanId = overrides.scanId || global.integrationTestUtils.generateScanId();
    
    return {
      findingId,
      tenantId,
      scanId,
      resourceId: `resource-${Math.random().toString(36).substr(2, 9)}`,
      resourceType: 'S3Bucket',
      region: 'us-east-1',
      accountId: '123456789012',
      severity: 'HIGH',
      status: 'OPEN',
      ruleId: 'S3_BUCKET_PUBLIC_READ_PROHIBITED',
      ruleName: 'S3 Bucket Public Read Prohibited',
      description: 'S3 bucket allows public read access',
      remediation: 'Remove public read access from S3 bucket',
      evidence: {
        bucketName: `test-bucket-${Math.random().toString(36).substr(2, 9)}`,
        publicReadAcl: true,
        bucketPolicy: null,
        discoveredAt: new Date().toISOString()
      },
      tags: {
        Environment: 'test',
        Source: 'integration-test'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };
  },

  // Create test user session with realistic permissions
  createTestUserSession: (overrides: Partial<any> = {}): any => {
    const tenantId = overrides.tenantId || global.integrationTestUtils.generateTenantId();
    const userId = overrides.userId || global.integrationTestUtils.generateUserId();
    
    return {
      userId,
      tenantId,
      sessionId: `session-${Math.random().toString(36).substr(2, 9)}`,
      roles: ['user'],
      permissions: [
        'scan:read',
        'scan:create',
        'findings:read',
        'findings:update',
        'reports:read',
        'reports:generate'
      ],
      tier: 'STANDARD',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      metadata: {
        source: 'integration-test',
        userAgent: 'integration-test-agent',
        ipAddress: '127.0.0.1'
      },
      ...overrides
    };
  },

  // Create test AWS resources for scanning
  createTestAWSResources: (): any => {
    return {
      s3Buckets: [
        {
          name: `test-public-bucket-${Math.random().toString(36).substr(2, 9)}`,
          region: 'us-east-1',
          publicReadAccess: true,
          publicWriteAccess: false,
          encryption: false,
          versioning: false,
          tags: {
            Environment: 'test',
            Team: 'security'
          }
        },
        {
          name: `test-private-bucket-${Math.random().toString(36).substr(2, 9)}`,
          region: 'us-east-1',
          publicReadAccess: false,
          publicWriteAccess: false,
          encryption: true,
          versioning: true,
          tags: {
            Environment: 'production',
            Team: 'engineering'
          }
        }
      ],
      iamUsers: [
        {
          userName: `test-user-${Math.random().toString(36).substr(2, 9)}`,
          mfaEnabled: false,
          accessKeys: 2,
          lastActivity: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          policies: ['ReadOnlyAccess']
        }
      ],
      ec2Instances: [
        {
          instanceId: `i-${Math.random().toString(36).substr(2, 17)}`,
          instanceType: 't3.micro',
          state: 'running',
          securityGroups: ['sg-12345678'],
          publicIp: '203.0.113.1',
          privateIp: '10.0.1.100',
          tags: {
            Name: 'test-instance',
            Environment: 'test'
          }
        }
      ]
    };
  },

  // Wait for async operations to complete
  waitFor: async (condition: () => Promise<boolean>, timeout: number = 30000): Promise<void> => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    }
    
    throw new Error(`Condition not met within ${timeout}ms timeout`);
  },

  // Sleep utility for integration tests
  sleep: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Global type declarations for integration test utilities
declare global {
  var integrationTestUtils: {
    generateTestId(): string;
    generateTenantId(): string;
    generateUserId(): string;
    generateScanId(): string;
    generateFindingId(): string;
    createAPIGatewayEvent(options?: Partial<any>): any;
    createLambdaContext(options?: Partial<any>): any;
    createTestScanJob(overrides?: Partial<any>): any;
    createTestFinding(overrides?: Partial<any>): any;
    createTestUserSession(overrides?: Partial<any>): any;
    createTestAWSResources(): any;
    waitFor(condition: () => Promise<boolean>, timeout?: number): Promise<void>;
    sleep(ms: number): Promise<void>;
  };
}

// Global setup for integration tests
beforeAll(async () => {
  console.log('🚀 Setting up integration test environment...');
  
  try {
    // Setup LocalStack and AWS services
    await setupLocalStack();
    
    // Setup test environment (tables, buckets, etc.)
    await setupTestEnvironment();
    
    console.log('✅ Integration test environment ready');
  } catch (error) {
    console.error('❌ Failed to setup integration test environment:', error);
    throw error;
  }
}, 120000); // 2 minutes timeout for setup

// Cleanup after each test
afterEach(async () => {
  try {
    // Clean up test data to prevent interference between tests
    await cleanupTestData();
  } catch (error) {
    console.warn('⚠️ Warning: Failed to cleanup test data:', error);
    // Don't fail the test if cleanup fails
  }
});

// Global cleanup for integration tests
afterAll(async () => {
  console.log('🧹 Cleaning up integration test environment...');
  
  try {
    // Final cleanup
    await cleanupTestData();
    
    console.log('✅ Integration test cleanup complete');
  } catch (error) {
    console.warn('⚠️ Warning: Failed to cleanup integration test environment:', error);
  }
});

// Handle unhandled promise rejections in integration tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in integration test at:', promise, 'reason:', reason);
  // Don't exit the process in tests, just log the error
});

// Handle uncaught exceptions in integration tests
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in integration test:', error);
  // Don't exit the process in tests, just log the error
});

// Console override for cleaner integration test output
const originalConsole = console;
global.console = {
  ...originalConsole,
  // Show more logs in integration tests for debugging
  log: process.env.LOG_LEVEL === 'debug' ? originalConsole.log : jest.fn(),
  info: process.env.LOG_LEVEL === 'debug' ? originalConsole.info : jest.fn(),
  warn: originalConsole.warn, // Always show warnings
  error: originalConsole.error, // Always show errors
  debug: process.env.LOG_LEVEL === 'debug' ? originalConsole.debug : jest.fn()
};

// Integration test performance monitoring
let testStartTime: number;

beforeEach(() => {
  testStartTime = Date.now();
});

afterEach(() => {
  const testDuration = Date.now() - testStartTime;
  if (testDuration > 30000) { // Warn about very slow integration tests
    console.warn(`Slow integration test detected: ${expect.getState().currentTestName} took ${testDuration}ms`);
  }
});

export {};
