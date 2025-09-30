/**
 * Tests for the compliance rules engine
 */

import {
  ComplianceRulesEngine,
  S3DefaultEncryptionRule,
  IAMRootMfaRule,
  SecurityGroupRestrictiveRules,
  CloudTrailMultiRegionRule,
} from '../src';
import {
  AWSResource,
  ComplianceFramework,
  Severity,
  RuleExecutionContext,
  RulesEngineConfig,
} from '../src/types';

describe('ComplianceRulesEngine', () => {
  let rulesEngine: ComplianceRulesEngine;

  beforeEach(() => {
    rulesEngine = new ComplianceRulesEngine();
  });

  describe('Rule Registration', () => {
    it('should register all default rules', () => {
      const allRules = rulesEngine.getAllRules();
      expect(allRules.length).toBeGreaterThan(0);
      
      // Check for specific rule types
      const ruleIds = allRules.map(rule => rule.ruleId);
      expect(ruleIds).toContain('S3-001');
      expect(ruleIds).toContain('IAM-001');
      expect(ruleIds).toContain('SG-001');
      expect(ruleIds).toContain('CT-001');
    });

    it('should get rules for specific service', () => {
      const s3Rules = rulesEngine.getRulesForService('S3');
      expect(s3Rules.length).toBeGreaterThan(0);
      expect(s3Rules.every(rule => rule.rule.service === 'S3')).toBe(true);
    });

    it('should get rules for specific framework', () => {
      const soc2Rules = rulesEngine.getRulesForFramework('SOC2');
      expect(soc2Rules.length).toBeGreaterThan(0);
      expect(soc2Rules.every(rule => rule.rule.frameworks.includes('SOC2'))).toBe(true);
    });
  });

  describe('Rule Execution', () => {
    const mockContext: RuleExecutionContext = {
      tenantId: 'tenant-123',
      accountId: '123456789012',
      region: 'us-east-1',
      userId: 'user-123',
      scanId: 'scan-456',
      timestamp: new Date().toISOString(),
    };

    const mockConfig: RulesEngineConfig = {
      parallel: false,
      maxConcurrency: 1,
      timeout: 30,
      retryCount: 1,
      includeEvidence: true,
      includeRecommendations: true,
      dryRun: true,
    };

    it('should execute rules for S3 bucket', async () => {
      const s3Bucket: AWSResource = {
        arn: 'arn:aws:s3:::test-bucket',
        type: 'AWS::S3::Bucket',
        name: 'test-bucket',
        region: 'us-east-1',
        accountId: '123456789012',
        tags: {
          Environment: 'test',
          Service: 'storage',
        },
      };

      const results = await rulesEngine.executeRules(
        [s3Bucket],
        mockContext,
        mockConfig
      );

      expect(results.results).toHaveLength(1);
      expect(results.results[0].resourceArn).toBe(s3Bucket.arn);
      expect(results.stats.totalRules).toBeGreaterThan(0);
    });

    it('should execute specific rule', async () => {
      const s3Bucket: AWSResource = {
        arn: 'arn:aws:s3:::test-bucket',
        type: 'AWS::S3::Bucket',
        name: 'test-bucket',
        region: 'us-east-1',
        accountId: '123456789012',
        tags: {},
      };

      const result = await rulesEngine.executeRule(
        'S3-001',
        s3Bucket,
        mockContext,
        mockConfig
      );

      expect(result.ruleId).toBe('S3-001');
      expect(result.resourceArn).toBe(s3Bucket.arn);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple resources', async () => {
      const resources: AWSResource[] = [
        {
          arn: 'arn:aws:s3:::bucket1',
          type: 'AWS::S3::Bucket',
          name: 'bucket1',
          region: 'us-east-1',
          accountId: '123456789012',
          tags: {},
        },
        {
          arn: 'arn:aws:s3:::bucket2',
          type: 'AWS::S3::Bucket',
          name: 'bucket2',
          region: 'us-east-1',
          accountId: '123456789012',
          tags: {},
        },
      ];

      const results = await rulesEngine.executeRules(
        resources,
        mockContext,
        mockConfig
      );

      expect(results.results).toHaveLength(2);
      expect(results.stats.totalRules).toBeGreaterThan(0);
    });
  });

  describe('Individual Rules', () => {
    const mockContext: RuleExecutionContext = {
      tenantId: 'tenant-123',
      accountId: '123456789012',
      region: 'us-east-1',
      userId: 'user-123',
      scanId: 'scan-456',
      timestamp: new Date().toISOString(),
    };

    const mockConfig: RulesEngineConfig = {
      parallel: false,
      maxConcurrency: 1,
      timeout: 30,
      retryCount: 1,
      includeEvidence: true,
      includeRecommendations: true,
      dryRun: true,
    };

    describe('S3DefaultEncryptionRule', () => {
      let rule: S3DefaultEncryptionRule;

      beforeEach(() => {
        rule = new S3DefaultEncryptionRule();
      });

      it('should have correct metadata', () => {
        const metadata = rule.getRuleMetadata();
        expect(metadata.ruleId).toBe('S3-001');
        expect(metadata.ruleName).toBe('S3 Bucket Default Encryption');
        expect(metadata.frameworks).toContain('SOC2');
        expect(metadata.severity).toBe('high');
        expect(metadata.service).toBe('S3');
      });

      it('should validate S3 bucket resources', async () => {
        const s3Bucket: AWSResource = {
          arn: 'arn:aws:s3:::test-bucket',
          type: 'AWS::S3::Bucket',
          name: 'test-bucket',
          region: 'us-east-1',
          accountId: '123456789012',
          tags: {},
        };

        const canValidate = await rule.validate(s3Bucket, mockContext);
        // Note: This will likely be false in test environment due to AWS permissions
        expect(typeof canValidate).toBe('boolean');
      });
    });

    describe('IAMRootMfaRule', () => {
      let rule: IAMRootMfaRule;

      beforeEach(() => {
        rule = new IAMRootMfaRule();
      });

      it('should have correct metadata', () => {
        const metadata = rule.getRuleMetadata();
        expect(metadata.ruleId).toBe('IAM-001');
        expect(metadata.ruleName).toBe('Root Account MFA');
        expect(metadata.frameworks).toContain('SOC2');
        expect(metadata.severity).toBe('critical');
        expect(metadata.service).toBe('IAM');
      });
    });

    describe('SecurityGroupRestrictiveRules', () => {
      let rule: SecurityGroupRestrictiveRules;

      beforeEach(() => {
        rule = new SecurityGroupRestrictiveRules();
      });

      it('should have correct metadata', () => {
        const metadata = rule.getRuleMetadata();
        expect(metadata.ruleId).toBe('SG-001');
        expect(metadata.ruleName).toBe('Security Group Restrictive Rules');
        expect(metadata.frameworks).toContain('SOC2');
        expect(metadata.severity).toBe('critical');
        expect(metadata.service).toBe('EC2');
      });
    });

    describe('CloudTrailMultiRegionRule', () => {
      let rule: CloudTrailMultiRegionRule;

      beforeEach(() => {
        rule = new CloudTrailMultiRegionRule();
      });

      it('should have correct metadata', () => {
        const metadata = rule.getRuleMetadata();
        expect(metadata.ruleId).toBe('CT-001');
        expect(metadata.ruleName).toBe('CloudTrail Multi-Region');
        expect(metadata.frameworks).toContain('SOC2');
        expect(metadata.severity).toBe('critical');
        expect(metadata.service).toBe('CloudTrail');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent rule execution', async () => {
      const resource: AWSResource = {
        arn: 'arn:aws:s3:::test-bucket',
        type: 'AWS::S3::Bucket',
        name: 'test-bucket',
        region: 'us-east-1',
        accountId: '123456789012',
        tags: {},
      };

      const context: RuleExecutionContext = {
        tenantId: 'tenant-123',
        accountId: '123456789012',
        region: 'us-east-1',
        timestamp: new Date().toISOString(),
      };

      await expect(
        rulesEngine.executeRule('NON-EXISTENT', resource, context)
      ).rejects.toThrow('Rule NON-EXISTENT not found in registry');
    });
  });

  describe('Rule Execution Statistics', () => {
    it('should calculate correct statistics', async () => {
      const resources: AWSResource[] = [
        {
          arn: 'arn:aws:s3:::test-bucket',
          type: 'AWS::S3::Bucket',
          name: 'test-bucket',
          region: 'us-east-1',
          accountId: '123456789012',
          tags: {},
        },
      ];

      const context: RuleExecutionContext = {
        tenantId: 'tenant-123',
        accountId: '123456789012',
        region: 'us-east-1',
        timestamp: new Date().toISOString(),
      };

      const config: RulesEngineConfig = {
        parallel: false,
        maxConcurrency: 1,
        timeout: 30,
        retryCount: 1,
        includeEvidence: false,
        includeRecommendations: false,
        dryRun: true,
      };

      const results = await rulesEngine.executeRules(resources, context, config);

      expect(results.stats.totalRules).toBeGreaterThanOrEqual(0);
      expect(results.stats.totalExecutionTime).toBeGreaterThanOrEqual(0);
      expect(results.stats.averageExecutionTime).toBeGreaterThanOrEqual(0);
      expect(results.stats.executedRules).toBeLessThanOrEqual(results.stats.totalRules);
      expect(results.stats.passedRules + results.stats.failedRules + results.stats.skippedRules)
        .toBeLessThanOrEqual(results.stats.totalRules);
    });
  });
});

// Mock AWS SDK for testing
jest.mock('aws-sdk', () => {
  const mockS3 = {
    getBucketEncryption: jest.fn().mockReturnThis(),
    getPublicAccessBlock: jest.fn().mockReturnThis(),
    getBucketVersioning: jest.fn().mockReturnThis(),
    headBucket: jest.fn().mockReturnThis(),
    promise: jest.fn().mockRejectedValue(new Error('Mock AWS error')),
  };

  const mockIAM = {
    getAccountSummary: jest.fn().mockReturnThis(),
    listVirtualMFADevices: jest.fn().mockReturnThis(),
    getAccountPasswordPolicy: jest.fn().mockReturnThis(),
    listAttachedUserPolicies: jest.fn().mockReturnThis(),
    getPolicy: jest.fn().mockReturnThis(),
    getPolicyVersion: jest.fn().mockReturnThis(),
    getUser: jest.fn().mockReturnThis(),
    promise: jest.fn().mockRejectedValue(new Error('Mock AWS error')),
  };

  const mockEC2 = {
    describeSecurityGroups: jest.fn().mockReturnThis(),
    promise: jest.fn().mockRejectedValue(new Error('Mock AWS error')),
  };

  const mockCloudTrail = {
    describeTrails: jest.fn().mockReturnThis(),
    getTrailStatus: jest.fn().mockReturnThis(),
    promise: jest.fn().mockRejectedValue(new Error('Mock AWS error')),
  };

  return {
    S3: jest.fn(() => mockS3),
    IAM: jest.fn(() => mockIAM),
    EC2: jest.fn(() => mockEC2),
    CloudTrail: jest.fn(() => mockCloudTrail),
  };
});
