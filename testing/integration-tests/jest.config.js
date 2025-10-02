module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/*.test.ts',
    '**/*.spec.ts'
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  collectCoverageFrom: [
    '../../services/**/*.ts',
    '../../security/**/*.ts',
    '../../monitoring/**/*.ts',
    '../../shared/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/*.config.ts',
    '!**/*.test.ts',
    '!**/*.spec.ts'
  ],
  coverageDirectory: '../reports/coverage/integration',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
  setupFilesAfterEnv: [
    '<rootDir>/setup/jest.setup.ts'
  ],
  moduleNameMapping: {
    '^@ai-compliance-shepherd/(.*)$': '<rootDir>/../../$1'
  },
  testTimeout: 60000, // 60 seconds for integration tests
  clearMocks: true,
  restoreMocks: true,
  verbose: true,
  collectCoverage: true,
  forceExit: true,
  detectOpenHandles: true,
  maxWorkers: 1, // Sequential execution for integration tests
  
  // Jest configuration for integration testing
  globals: {
    'ts-jest': {
      tsconfig: {
        compilerOptions: {
          module: 'commonjs',
          target: 'es2020',
          lib: ['es2020'],
          declaration: false,
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true
        }
      }
    }
  },
  
  // Custom reporters for CI/CD integration
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: '../reports/junit',
        outputName: 'integration-test-results.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ],
    [
      'jest-html-reporter',
      {
        pageTitle: 'AI Compliance Shepherd - Integration Test Results',
        outputPath: '../reports/integration-test-report.html',
        includeFailureMsg: true,
        includeSuiteFailure: true
      }
    ]
  ],
  
  // Test categorization
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '\\.unit\\.test\\.ts$',
    '\\.e2e\\.test\\.ts$',
    '\\.performance\\.test\\.ts$'
  ],
  
  // Module configuration
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],
  
  // Performance optimization
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // Error handling
  errorOnDeprecated: true,
  
  // Test result processing
  passWithNoTests: false,
  bail: false,
  
  // Snapshot configuration
  updateSnapshot: false,
  
  // Watch mode configuration (disabled for integration tests)
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  
  // Environment variables for integration tests
  testEnvironmentOptions: {
    NODE_ENV: 'test',
    INTEGRATION_TEST_MODE: 'true',
    AWS_REGION: 'us-east-1',
    LOCALSTACK_ENDPOINT: 'http://localhost:4566',
    LOG_LEVEL: 'error'
  }
};
