/**
 * Tests for FindingsRepository
 */

import { FindingsRepository } from '../src/repositories/FindingsRepository';
import { Finding, Severity, ComplianceFramework, FindingStatus } from '@compliance-shepherd/shared';
import AWS from 'aws-sdk-mock';

describe('FindingsRepository', () => {
  let repository: FindingsRepository;

  beforeEach(() => {
    repository = new FindingsRepository();
    AWS.restore();
  });

  afterEach(() => {
    AWS.restore();
  });

  describe('getFindingsByTenant', () => {
    it('should get findings by tenant with filters', async () => {
      const findings = [
        {
          id: '1',
          tenantId: 'tenant-1',
          severity: 'high' as Severity,
          framework: 'SOC2' as ComplianceFramework,
          status: 'active' as FindingStatus,
        },
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: 1,
        });
      });

      const result = await repository.getFindingsByTenant('tenant-1', {
        severity: 'high',
        framework: 'SOC2',
      });

      expect(result.items).toEqual(findings);
      expect(result.totalCount).toBe(1);
    });
  });

  describe('getFindingsBySeverity', () => {
    it('should get findings by severity', async () => {
      const findings = [
        {
          id: '1',
          tenantId: 'tenant-1',
          severity: 'high' as Severity,
        },
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: 1,
        });
      });

      const result = await repository.getFindingsBySeverity('high');

      expect(result.items).toEqual(findings);
    });
  });

  describe('getFindingsByFramework', () => {
    it('should get findings by framework', async () => {
      const findings = [
        {
          id: '1',
          tenantId: 'tenant-1',
          framework: 'SOC2' as ComplianceFramework,
        },
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: 1,
        });
      });

      const result = await repository.getFindingsByFramework('SOC2');

      expect(result.items).toEqual(findings);
    });
  });

  describe('getFindingsByStatus', () => {
    it('should get findings by status', async () => {
      const findings = [
        {
          id: '1',
          tenantId: 'tenant-1',
          status: 'active' as FindingStatus,
        },
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: 1,
        });
      });

      const result = await repository.getFindingsByStatus('active');

      expect(result.items).toEqual(findings);
    });
  });

  describe('getFindingsByService', () => {
    it('should get findings by service', async () => {
      const findings = [
        {
          id: '1',
          tenantId: 'tenant-1',
          service: 's3',
        },
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: 1,
        });
      });

      const result = await repository.getFindingsByService('s3');

      expect(result.items).toEqual(findings);
    });
  });

  describe('getFindingsByAccountRegion', () => {
    it('should get findings by account and region', async () => {
      const findings = [
        {
          id: '1',
          tenantId: 'tenant-1',
          accountRegion: '123456789012#us-east-1',
        },
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: 1,
        });
      });

      const result = await repository.getFindingsByAccountRegion('123456789012', 'us-east-1');

      expect(result.items).toEqual(findings);
    });
  });

  describe('getFindingsByDateRange', () => {
    it('should get findings by date range', async () => {
      const findings = [
        {
          id: '1',
          tenantId: 'tenant-1',
          createdAt: '2023-01-01T00:00:00Z',
        },
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: 1,
        });
      });

      const result = await repository.getFindingsByDateRange(
        'tenant-1',
        '2023-01-01T00:00:00Z',
        '2023-01-31T23:59:59Z'
      );

      expect(result.items).toEqual(findings);
    });
  });

  describe('getFindingsByTags', () => {
    it('should get findings by tags', async () => {
      const findings = [
        {
          id: '1',
          tenantId: 'tenant-1',
          tags: ['production', 'critical'],
        },
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: 1,
        });
      });

      const result = await repository.getFindingsByTags('tenant-1', ['production']);

      expect(result.items).toEqual(findings);
    });
  });

  describe('getActiveFindings', () => {
    it('should get active findings', async () => {
      const findings = [
        {
          id: '1',
          tenantId: 'tenant-1',
          status: 'active' as FindingStatus,
        },
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: 1,
        });
      });

      const result = await repository.getActiveFindings('tenant-1');

      expect(result.items).toEqual(findings);
    });
  });

  describe('getResolvedFindings', () => {
    it('should get resolved findings', async () => {
      const findings = [
        {
          id: '1',
          tenantId: 'tenant-1',
          status: 'resolved' as FindingStatus,
        },
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: 1,
        });
      });

      const result = await repository.getResolvedFindings('tenant-1');

      expect(result.items).toEqual(findings);
    });
  });

  describe('getFindingsByHash', () => {
    it('should get findings by hash', async () => {
      const findings = [
        {
          id: '1',
          tenantId: 'tenant-1',
          hash: 'abc123',
        },
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: 1,
        });
      });

      const result = await repository.getFindingsByHash('tenant-1', 'abc123');

      expect(result.items).toEqual(findings);
    });
  });

  describe('updateFindingStatus', () => {
    it('should update finding status', async () => {
      const updatedFinding = {
        id: '1',
        tenantId: 'tenant-1',
        status: 'resolved' as FindingStatus,
        resolvedAt: expect.any(String),
        resolvedBy: 'user-1',
        lastSeen: expect.any(String),
      };

      AWS.mock('DynamoDB.DocumentClient', 'update', (params: any, callback: any) => {
        callback(null, { Attributes: updatedFinding });
      });

      const result = await repository.updateFindingStatus('1', 'tenant-1', 'resolved', 'user-1');

      expect(result).toEqual(updatedFinding);
    });
  });

  describe('suppressFinding', () => {
    it('should suppress finding', async () => {
      const suppressedFinding = {
        id: '1',
        tenantId: 'tenant-1',
        status: 'suppressed' as FindingStatus,
        suppression: {
          reason: 'False positive',
          suppressedBy: 'user-1',
          suppressedAt: expect.any(String),
        },
      };

      AWS.mock('DynamoDB.DocumentClient', 'update', (params: any, callback: any) => {
        callback(null, { Attributes: suppressedFinding });
      });

      const result = await repository.suppressFinding('1', 'tenant-1', 'False positive', 'user-1');

      expect(result).toEqual(suppressedFinding);
    });
  });

  describe('getFindingStatistics', () => {
    it('should get finding statistics', async () => {
      const findings = [
        { id: '1', tenantId: 'tenant-1', severity: 'high', status: 'active', framework: 'SOC2', service: 's3' },
        { id: '2', tenantId: 'tenant-1', severity: 'medium', status: 'resolved', framework: 'HIPAA', service: 'ec2' },
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: 2,
        });
      });

      const result = await repository.getFindingStatistics('tenant-1');

      expect(result.total).toBe(2);
      expect(result.bySeverity.high).toBe(1);
      expect(result.bySeverity.medium).toBe(1);
      expect(result.byStatus.active).toBe(1);
      expect(result.byStatus.resolved).toBe(1);
      expect(result.byFramework.SOC2).toBe(1);
      expect(result.byFramework.HIPAA).toBe(1);
      expect(result.byService.s3).toBe(1);
      expect(result.byService.ec2).toBe(1);
    });
  });
});
