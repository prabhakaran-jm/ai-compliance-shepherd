/**
 * Tests for FindingsStorageService
 */

import { FindingsStorageService } from '../src/services/FindingsStorageService';
import { Finding, Severity, ComplianceFramework, FindingStatus } from '@compliance-shepherd/shared';
import AWS from 'aws-sdk-mock';

describe('FindingsStorageService', () => {
  let service: FindingsStorageService;

  beforeEach(() => {
    service = new FindingsStorageService();
    AWS.restore();
  });

  afterEach(() => {
    AWS.restore();
  });

  describe('createFinding', () => {
    it('should create a finding successfully', async () => {
      const findingData = {
        resourceArn: 'arn:aws:s3:::test-bucket',
        severity: 'high' as Severity,
        framework: 'SOC2' as ComplianceFramework,
        title: 'S3 bucket not encrypted',
        description: 'S3 bucket does not have encryption enabled'
      };

      const expectedFinding = {
        id: expect.any(String),
        tenantId: 'tenant-1',
        resourceArn: 'arn:aws:s3:::test-bucket',
        severity: 'high',
        framework: 'SOC2',
        title: 'S3 bucket not encrypted',
        description: 'S3 bucket does not have encryption enabled',
        status: 'active',
        firstSeen: expect.any(String),
        lastSeen: expect.any(String),
        count: 1
      };

      AWS.mock('DynamoDB.DocumentClient', 'put', (params: any, callback: any) => {
        callback(null, {});
      });

      const result = await service.createFinding(findingData, 'tenant-1');

      expect(result).toMatchObject(expectedFinding);
    });

    it('should throw error if creation fails', async () => {
      const findingData = {
        resourceArn: 'arn:aws:s3:::test-bucket',
        severity: 'high' as Severity
      };

      AWS.mock('DynamoDB.DocumentClient', 'put', (params: any, callback: any) => {
        callback(new Error('DynamoDB error'));
      });

      await expect(service.createFinding(findingData, 'tenant-1')).rejects.toThrow('DynamoDB error');
    });
  });

  describe('createFindings', () => {
    it('should create multiple findings successfully', async () => {
      const findingsData = [
        {
          resourceArn: 'arn:aws:s3:::bucket1',
          severity: 'high' as Severity,
          title: 'Finding 1'
        },
        {
          resourceArn: 'arn:aws:s3:::bucket2',
          severity: 'medium' as Severity,
          title: 'Finding 2'
        }
      ];

      AWS.mock('DynamoDB.DocumentClient', 'put', (params: any, callback: any) => {
        callback(null, {});
      });

      const result = await service.createFindings(findingsData, 'tenant-1');

      expect(result.created).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.total).toBe(2);
    });

    it('should handle partial failures in batch creation', async () => {
      const findingsData = [
        {
          resourceArn: 'arn:aws:s3:::bucket1',
          severity: 'high' as Severity,
          title: 'Finding 1'
        },
        {
          resourceArn: 'arn:aws:s3:::bucket2',
          severity: 'medium' as Severity,
          title: 'Finding 2'
        }
      ];

      let callCount = 0;
      AWS.mock('DynamoDB.DocumentClient', 'put', (params: any, callback: any) => {
        callCount++;
        if (callCount === 1) {
          callback(null, {}); // First call succeeds
        } else {
          callback(new Error('DynamoDB error')); // Second call fails
        }
      });

      const result = await service.createFindings(findingsData, 'tenant-1');

      expect(result.created).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.total).toBe(2);
    });
  });

  describe('getFinding', () => {
    it('should get a finding successfully', async () => {
      const finding = {
        id: 'finding-1',
        tenantId: 'tenant-1',
        severity: 'high',
        framework: 'SOC2',
        status: 'active'
      };

      AWS.mock('DynamoDB.DocumentClient', 'get', (params: any, callback: any) => {
        callback(null, { Item: finding });
      });

      const result = await service.getFinding('finding-1', 'tenant-1');

      expect(result).toEqual(finding);
    });

    it('should return null if finding not found', async () => {
      AWS.mock('DynamoDB.DocumentClient', 'get', (params: any, callback: any) => {
        callback(null, {});
      });

      const result = await service.getFinding('nonexistent-finding', 'tenant-1');

      expect(result).toBeNull();
    });
  });

  describe('getFindings', () => {
    it('should get findings with filters', async () => {
      const findings = [
        {
          id: 'finding-1',
          tenantId: 'tenant-1',
          severity: 'high',
          framework: 'SOC2'
        },
        {
          id: 'finding-2',
          tenantId: 'tenant-1',
          severity: 'medium',
          framework: 'HIPAA'
        }
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: findings.length
        });
      });

      const result = await service.getFindings('tenant-1', {
        severity: 'high',
        framework: 'SOC2'
      });

      expect(result.items).toEqual(findings);
      expect(result.totalCount).toBe(2);
    });
  });

  describe('updateFinding', () => {
    it('should update a finding successfully', async () => {
      const updates = {
        status: 'resolved' as FindingStatus,
        resolvedBy: 'user-1'
      };

      const updatedFinding = {
        id: 'finding-1',
        tenantId: 'tenant-1',
        status: 'resolved',
        resolvedBy: 'user-1',
        lastSeen: expect.any(String)
      };

      AWS.mock('DynamoDB.DocumentClient', 'update', (params: any, callback: any) => {
        callback(null, { Attributes: updatedFinding });
      });

      const result = await service.updateFinding('finding-1', 'tenant-1', updates);

      expect(result).toEqual(updatedFinding);
    });
  });

  describe('deleteFinding', () => {
    it('should delete a finding successfully', async () => {
      AWS.mock('DynamoDB.DocumentClient', 'delete', (params: any, callback: any) => {
        callback(null, {});
      });

      await expect(service.deleteFinding('finding-1', 'tenant-1')).resolves.not.toThrow();
    });
  });

  describe('updateFindingStatus', () => {
    it('should update finding status successfully', async () => {
      const updatedFinding = {
        id: 'finding-1',
        tenantId: 'tenant-1',
        status: 'resolved',
        resolvedBy: 'user-1',
        resolvedAt: expect.any(String)
      };

      AWS.mock('DynamoDB.DocumentClient', 'update', (params: any, callback: any) => {
        callback(null, { Attributes: updatedFinding });
      });

      const result = await service.updateFindingStatus('finding-1', 'tenant-1', 'resolved', 'user-1');

      expect(result).toEqual(updatedFinding);
    });
  });

  describe('suppressFinding', () => {
    it('should suppress a finding successfully', async () => {
      const suppressedFinding = {
        id: 'finding-1',
        tenantId: 'tenant-1',
        status: 'suppressed',
        suppression: {
          reason: 'False positive',
          suppressedBy: 'user-1',
          suppressedAt: expect.any(String)
        }
      };

      AWS.mock('DynamoDB.DocumentClient', 'update', (params: any, callback: any) => {
        callback(null, { Attributes: suppressedFinding });
      });

      const result = await service.suppressFinding('finding-1', 'tenant-1', 'False positive', 'user-1');

      expect(result).toEqual(suppressedFinding);
    });
  });

  describe('getFindingsBySeverity', () => {
    it('should get findings by severity', async () => {
      const findings = [
        {
          id: 'finding-1',
          tenantId: 'tenant-1',
          severity: 'high'
        }
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: findings.length
        });
      });

      const result = await service.getFindingsBySeverity('tenant-1', 'high');

      expect(result.items).toEqual(findings);
    });
  });

  describe('getFindingsByFramework', () => {
    it('should get findings by framework', async () => {
      const findings = [
        {
          id: 'finding-1',
          tenantId: 'tenant-1',
          framework: 'SOC2'
        }
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: findings.length
        });
      });

      const result = await service.getFindingsByFramework('tenant-1', 'SOC2');

      expect(result.items).toEqual(findings);
    });
  });

  describe('getFindingsByStatus', () => {
    it('should get findings by status', async () => {
      const findings = [
        {
          id: 'finding-1',
          tenantId: 'tenant-1',
          status: 'active'
        }
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: findings.length
        });
      });

      const result = await service.getFindingsByStatus('tenant-1', 'active');

      expect(result.items).toEqual(findings);
    });
  });

  describe('getFindingsByService', () => {
    it('should get findings by service', async () => {
      const findings = [
        {
          id: 'finding-1',
          tenantId: 'tenant-1',
          service: 's3'
        }
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: findings.length
        });
      });

      const result = await service.getFindingsByService('tenant-1', 's3');

      expect(result.items).toEqual(findings);
    });
  });

  describe('getFindingsByResource', () => {
    it('should get findings by resource ARN', async () => {
      const findings = [
        {
          id: 'finding-1',
          tenantId: 'tenant-1',
          resourceArn: 'arn:aws:s3:::test-bucket'
        }
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: findings.length
        });
      });

      const result = await service.getFindingsByResource('tenant-1', 'arn:aws:s3:::test-bucket');

      expect(result.items).toEqual(findings);
    });
  });

  describe('getFindingsByDateRange', () => {
    it('should get findings by date range', async () => {
      const findings = [
        {
          id: 'finding-1',
          tenantId: 'tenant-1',
          firstSeen: '2023-01-01T00:00:00Z'
        }
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: findings.length
        });
      });

      const result = await service.getFindingsByDateRange(
        'tenant-1',
        '2023-01-01T00:00:00Z',
        '2023-01-31T23:59:59Z'
      );

      expect(result.items).toEqual(findings);
    });
  });

  describe('getActiveFindings', () => {
    it('should get active findings', async () => {
      const findings = [
        {
          id: 'finding-1',
          tenantId: 'tenant-1',
          status: 'active'
        }
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: findings.length
        });
      });

      const result = await service.getActiveFindings('tenant-1');

      expect(result.items).toEqual(findings);
    });
  });

  describe('getResolvedFindings', () => {
    it('should get resolved findings', async () => {
      const findings = [
        {
          id: 'finding-1',
          tenantId: 'tenant-1',
          status: 'resolved'
        }
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: findings.length
        });
      });

      const result = await service.getResolvedFindings('tenant-1');

      expect(result.items).toEqual(findings);
    });
  });

  describe('getFindingStatistics', () => {
    it('should get finding statistics', async () => {
      const statistics = {
        total: 10,
        bySeverity: { high: 3, medium: 4, low: 3 },
        byStatus: { active: 7, resolved: 3 },
        byFramework: { SOC2: 6, HIPAA: 4 },
        byService: { s3: 5, iam: 3, ec2: 2 }
      };

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: [],
          Count: 10
        });
      });

      AWS.mock('DynamoDB.DocumentClient', 'scan', (params: any, callback: any) => {
        callback(null, {
          Items: [],
          Count: 10
        });
      });

      const result = await service.getFindingStatistics('tenant-1');

      expect(result.total).toBe(10);
      expect(result.bySeverity).toBeDefined();
      expect(result.byStatus).toBeDefined();
      expect(result.byFramework).toBeDefined();
      expect(result.byService).toBeDefined();
    });
  });

  describe('searchFindings', () => {
    it('should search findings by text', async () => {
      const findings = [
        {
          id: 'finding-1',
          tenantId: 'tenant-1',
          title: 'S3 bucket encryption issue',
          description: 'Bucket is not encrypted',
          tags: ['encryption', 's3']
        }
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: findings.length
        });
      });

      const result = await service.searchFindings('tenant-1', 'encryption');

      expect(result.items).toEqual(findings);
    });
  });
});
