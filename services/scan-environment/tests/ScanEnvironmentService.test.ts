/**
 * Tests for ScanEnvironmentService
 */

import { ScanEnvironmentService } from '../src/services/ScanEnvironmentService';
import { ScanRequest, ScanType, Region, ComplianceFramework } from '@compliance-shepherd/shared';
import AWS from 'aws-sdk-mock';

describe('ScanEnvironmentService', () => {
  let service: ScanEnvironmentService;

  beforeEach(() => {
    service = new ScanEnvironmentService();
    AWS.restore();
  });

  afterEach(() => {
    AWS.restore();
  });

  describe('startScan', () => {
    it('should start a scan successfully', async () => {
      const scanRequest: ScanRequest = {
        tenantId: 'tenant-1',
        accountId: '123456789012',
        regions: ['us-east-1'],
        scanType: 'full_environment',
        frameworks: ['SOC2'],
        requestedBy: 'user-1'
      };

      // Mock tenant repository
      AWS.mock('DynamoDB.DocumentClient', 'get', (params: any, callback: any) => {
        callback(null, {
          Item: {
            id: 'tenant-1',
            name: 'Test Tenant',
            status: 'active'
          }
        });
      });

      // Mock scan job creation
      AWS.mock('DynamoDB.DocumentClient', 'put', (params: any, callback: any) => {
        callback(null, {});
      });

      const result = await service.startScan(scanRequest, 'request-1');

      expect(result.scanId).toBeDefined();
      expect(result.status).toBe('initializing');
      expect(result.message).toBe('Scan started successfully');
      expect(result.estimatedDuration).toBeGreaterThan(0);
      expect(result.scanUrl).toContain(result.scanId);
    });

    it('should throw error if tenant not found', async () => {
      const scanRequest: ScanRequest = {
        tenantId: 'nonexistent-tenant',
        accountId: '123456789012',
        regions: ['us-east-1'],
        scanType: 'full_environment'
      };

      // Mock tenant not found
      AWS.mock('DynamoDB.DocumentClient', 'get', (params: any, callback: any) => {
        callback(null, {});
      });

      await expect(service.startScan(scanRequest, 'request-1')).rejects.toThrow('Tenant nonexistent-tenant not found');
    });

    it('should handle scan creation failure', async () => {
      const scanRequest: ScanRequest = {
        tenantId: 'tenant-1',
        accountId: '123456789012',
        regions: ['us-east-1'],
        scanType: 'full_environment'
      };

      // Mock tenant repository
      AWS.mock('DynamoDB.DocumentClient', 'get', (params: any, callback: any) => {
        callback(null, {
          Item: {
            id: 'tenant-1',
            name: 'Test Tenant',
            status: 'active'
          }
        });
      });

      // Mock scan job creation failure
      AWS.mock('DynamoDB.DocumentClient', 'put', (params: any, callback: any) => {
        callback(new Error('DynamoDB error'));
      });

      await expect(service.startScan(scanRequest, 'request-1')).rejects.toThrow('DynamoDB error');
    });
  });

  describe('getScanStatus', () => {
    it('should get scan status successfully', async () => {
      const scanJob = {
        id: 'scan-1',
        tenantId: 'tenant-1',
        status: 'in_progress',
        progress: {
          current: 50,
          total: 100,
          percentage: 50,
          stage: 'Executing compliance rules'
        }
      };

      AWS.mock('DynamoDB.DocumentClient', 'get', (params: any, callback: any) => {
        callback(null, { Item: scanJob });
      });

      const result = await service.getScanStatus('scan-1', 'tenant-1');

      expect(result).toEqual(scanJob);
    });

    it('should return null if scan not found', async () => {
      AWS.mock('DynamoDB.DocumentClient', 'get', (params: any, callback: any) => {
        callback(null, {});
      });

      const result = await service.getScanStatus('nonexistent-scan', 'tenant-1');

      expect(result).toBeNull();
    });
  });

  describe('getScanResults', () => {
    it('should get scan results successfully', async () => {
      const scanJob = {
        id: 'scan-1',
        tenantId: 'tenant-1',
        status: 'completed',
        results: {
          totalResources: 100,
          totalFindings: 5,
          complianceScore: 95
        }
      };

      const findings = [
        {
          id: 'finding-1',
          tenantId: 'tenant-1',
          scanId: 'scan-1',
          severity: 'high',
          framework: 'SOC2'
        }
      ];

      const statistics = {
        total: 5,
        bySeverity: { high: 2, medium: 3 },
        byFramework: { SOC2: 5 }
      };

      // Mock scan job retrieval
      AWS.mock('DynamoDB.DocumentClient', 'get', (params: any, callback: any) => {
        if (params.Key.id === 'scan-1') {
          callback(null, { Item: scanJob });
        } else {
          callback(null, {});
        }
      });

      // Mock findings query
      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: findings.length
        });
      });

      // Mock statistics scan
      AWS.mock('DynamoDB.DocumentClient', 'scan', (params: any, callback: any) => {
        callback(null, {
          Items: findings,
          Count: findings.length
        });
      });

      const result = await service.getScanResults('scan-1', 'tenant-1');

      expect(result).toBeDefined();
      expect(result?.scanJob).toEqual(scanJob);
      expect(result?.findings).toEqual(findings);
      expect(result?.statistics).toBeDefined();
    });

    it('should return null if scan not found', async () => {
      AWS.mock('DynamoDB.DocumentClient', 'get', (params: any, callback: any) => {
        callback(null, {});
      });

      const result = await service.getScanResults('nonexistent-scan', 'tenant-1');

      expect(result).toBeNull();
    });
  });

  describe('listScans', () => {
    it('should list scans successfully', async () => {
      const scans = [
        {
          id: 'scan-1',
          tenantId: 'tenant-1',
          status: 'completed'
        },
        {
          id: 'scan-2',
          tenantId: 'tenant-1',
          status: 'in_progress'
        }
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: scans,
          Count: scans.length
        });
      });

      const result = await service.listScans('tenant-1');

      expect(result.scans).toEqual(scans);
      expect(result.totalCount).toBe(2);
    });

    it('should handle pagination', async () => {
      const scans = [
        {
          id: 'scan-1',
          tenantId: 'tenant-1',
          status: 'completed'
        }
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: scans,
          Count: scans.length,
          LastEvaluatedKey: { id: 'scan-1', tenantId: 'tenant-1' }
        });
      });

      const result = await service.listScans('tenant-1', { limit: 10 });

      expect(result.scans).toEqual(scans);
      expect(result.nextToken).toBeDefined();
    });
  });

  describe('cancelScan', () => {
    it('should cancel scan successfully', async () => {
      const scanJob = {
        id: 'scan-1',
        tenantId: 'tenant-1',
        status: 'in_progress'
      };

      // Mock scan job retrieval
      AWS.mock('DynamoDB.DocumentClient', 'get', (params: any, callback: any) => {
        callback(null, { Item: scanJob });
      });

      // Mock scan job update
      AWS.mock('DynamoDB.DocumentClient', 'update', (params: any, callback: any) => {
        callback(null, {});
      });

      await expect(service.cancelScan('scan-1', 'tenant-1', 'user-1')).resolves.not.toThrow();
    });

    it('should throw error if scan not found', async () => {
      AWS.mock('DynamoDB.DocumentClient', 'get', (params: any, callback: any) => {
        callback(null, {});
      });

      await expect(service.cancelScan('nonexistent-scan', 'tenant-1', 'user-1')).rejects.toThrow('Scan nonexistent-scan not found');
    });

    it('should throw error if scan already completed', async () => {
      const scanJob = {
        id: 'scan-1',
        tenantId: 'tenant-1',
        status: 'completed'
      };

      AWS.mock('DynamoDB.DocumentClient', 'get', (params: any, callback: any) => {
        callback(null, { Item: scanJob });
      });

      await expect(service.cancelScan('scan-1', 'tenant-1', 'user-1')).rejects.toThrow('Cannot cancel scan in completed status');
    });
  });
});
