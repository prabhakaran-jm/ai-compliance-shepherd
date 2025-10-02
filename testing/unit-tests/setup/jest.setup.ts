/**
 * Global Jest setup for AI Compliance Shepherd unit tests
 * 
 * This file configures the testing environment, sets up global mocks,
 * and provides utilities for all unit tests.
 */

import { jest } from '@jest/globals';
import { setupAWSMocks } from './aws-mocks';

// Increase timeout for all tests
jest.setTimeout(30000);

// Setup global environment variables for testing
process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'us-east-1';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
process.env.XRAY_TRACING_ENABLED = 'false'; // Disable X-Ray in tests

// Mock AWS SDK globally
setupAWSMocks();

// Global test utilities
global.testUtils = {
  // Generate test correlation ID
  generateCorrelationId: (): string => {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  // Generate test tenant ID
  generateTenantId: (): string => {
    return `tenant-test-${Math.random().toString(36).substr(2, 9)}`;
  },

  // Generate test user ID
  generateUserId: (): string => {
    return `user-test-${Math.random().toString(36).substr(2, 9)}`;
  },

  // Generate test timestamp
  generateTimestamp: (): string => {
    return new Date().toISOString();
  },

  // Create test context for Lambda functions
  createLambdaContext: (options: Partial<any> = {}): any => {
    return {
      awsRequestId: global.testUtils.generateCorrelationId(),
      invokeid: global.testUtils.generateCorrelationId(),
      logGroupName: '/aws/lambda/test-function',
      logStreamName: '2024/01/01/[$LATEST]test-stream',
      functionName: 'test-function',
      functionVersion: '$LATEST',
      memoryLimitInMB: '256',
      getRemainingTimeInMillis: () => 30000,
      callbackWaitsForEmptyEventLoop: true,
      ...options
    };
  },

  // Create test API Gateway event
  createAPIGatewayEvent: (options: Partial<any> = {}): any => {
    return {
      httpMethod: 'GET',
      path: '/test',
      pathParameters: null,
      queryStringParameters: null,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'test-agent'
      },
      body: null,
      isBase64Encoded: false,
      requestContext: {
        requestId: global.testUtils.generateCorrelationId(),
        identity: {
          sourceIp: '127.0.0.1',
          userAgent: 'test-agent'
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

  // Create test scheduled event
  createScheduledEvent: (options: Partial<any> = {}): any => {
    return {
      version: '0',
      id: global.testUtils.generateCorrelationId(),
      'detail-type': 'Scheduled Event',
      source: 'aws.events',
      account: '123456789012',
      time: new Date().toISOString(),
      region: 'us-east-1',
      detail: {},
      ...options
    };
  },

  // Create test finding
  createTestFinding: (overrides: Partial<any> = {}): any => {
    return {
      findingId: `finding-${Math.random().toString(36).substr(2, 9)}`,
      tenantId: global.testUtils.generateTenantId(),
      scanId: `scan-${Math.random().toString(36).substr(2, 9)}`,
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
        bucketName: 'test-bucket',
        publicReadAcl: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };
  },

  // Create test scan job
  createTestScanJob: (overrides: Partial<any> = {}): any => {
    return {
      scanId: `scan-${Math.random().toString(36).substr(2, 9)}`,
      tenantId: global.testUtils.generateTenantId(),
      scanType: 'FULL_COMPLIANCE',
      status: 'COMPLETED',
      progress: 100,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      configuration: {
        regions: ['us-east-1'],
        services: ['s3', 'iam', 'ec2'],
        rules: ['all']
      },
      results: {
        totalResources: 100,
        totalFindings: 10,
        criticalFindings: 2,
        highFindings: 3,
        mediumFindings: 3,
        lowFindings: 2
      },
      ...overrides
    };
  },

  // Create test user session
  createTestUserSession: (overrides: Partial<any> = {}): any => {
    return {
      userId: global.testUtils.generateUserId(),
      tenantId: global.testUtils.generateTenantId(),
      sessionId: `session-${Math.random().toString(36).substr(2, 9)}`,
      roles: ['user'],
      permissions: ['scan:read', 'findings:read'],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      ...overrides
    };
  }
};

// Global type declarations for test utilities
declare global {
  var testUtils: {
    generateCorrelationId(): string;
    generateTenantId(): string;
    generateUserId(): string;
    generateTimestamp(): string;
    createLambdaContext(options?: Partial<any>): any;
    createAPIGatewayEvent(options?: Partial<any>): any;
    createScheduledEvent(options?: Partial<any>): any;
    createTestFinding(overrides?: Partial<any>): any;
    createTestScanJob(overrides?: Partial<any>): any;
    createTestUserSession(overrides?: Partial<any>): any;
  };
}

// Setup test database cleanup
afterEach(() => {
  // Clear all mocks after each test
  jest.clearAllMocks();
});

afterAll(async () => {
  // Cleanup any test resources
  await new Promise((resolve) => setTimeout(resolve, 100));
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests, just log the error
});

// Handle uncaught exceptions in tests
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process in tests, just log the error
});

// Console override for cleaner test output
const originalConsole = console;
global.console = {
  ...originalConsole,
  // Suppress logs during tests unless LOG_LEVEL is debug
  log: process.env.LOG_LEVEL === 'debug' ? originalConsole.log : jest.fn(),
  info: process.env.LOG_LEVEL === 'debug' ? originalConsole.info : jest.fn(),
  warn: process.env.LOG_LEVEL === 'debug' ? originalConsole.warn : jest.fn(),
  error: originalConsole.error, // Always show errors
  debug: process.env.LOG_LEVEL === 'debug' ? originalConsole.debug : jest.fn()
};

// Test performance monitoring
let testStartTime: number;

beforeEach(() => {
  testStartTime = Date.now();
});

afterEach(() => {
  const testDuration = Date.now() - testStartTime;
  if (testDuration > 5000) { // Warn about slow tests
    console.warn(`Slow test detected: ${expect.getState().currentTestName} took ${testDuration}ms`);
  }
});

// Memory leak detection
let initialMemoryUsage: NodeJS.MemoryUsage;

beforeAll(() => {
  initialMemoryUsage = process.memoryUsage();
});

afterAll(() => {
  const finalMemoryUsage = process.memoryUsage();
  const memoryDiff = finalMemoryUsage.heapUsed - initialMemoryUsage.heapUsed;
  
  if (memoryDiff > 50 * 1024 * 1024) { // 50MB threshold
    console.warn(`Potential memory leak detected: ${memoryDiff / (1024 * 1024)}MB increase`);
  }
});

export {};
