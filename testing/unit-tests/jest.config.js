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
  coverageDirectory: '../reports/coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json'
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Service-specific thresholds
    '../../services/scan-environment/**/*.ts': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    '../../services/findings-storage/**/*.ts': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    '../../services/api-gateway/**/*.ts': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    '../../security/**/*.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  setupFilesAfterEnv: [
    '<rootDir>/setup/jest.setup.ts'
  ],
  moduleNameMapping: {
    '^@ai-compliance-shepherd/(.*)$': '<rootDir>/../../$1'
  },
  testTimeout: 30000,
  clearMocks: true,
  restoreMocks: true,
  verbose: true,
  collectCoverage: true,
  forceExit: true,
  detectOpenHandles: true,
  maxWorkers: '50%',
  // Jest configuration for AWS Lambda testing
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
        outputName: 'unit-test-results.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ],
    [
      'jest-html-reporter',
      {
        pageTitle: 'AI Compliance Shepherd - Unit Test Results',
        outputPath: '../reports/unit-test-report.html',
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
    '\\.integration\\.test\\.ts$',
    '\\.e2e\\.test\\.ts$',
    '\\.performance\\.test\\.ts$'
  ],
  // Mock configuration
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
  // Watch mode configuration
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ]
};
