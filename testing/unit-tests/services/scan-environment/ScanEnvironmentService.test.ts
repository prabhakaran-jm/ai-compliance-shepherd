/**
 * Unit tests for ScanEnvironmentService
 */

import { ScanEnvironmentService } from '../../../../services/scan-environment/src/services/ScanEnvironmentService';
import { AWSResourceDiscovery } from '../../../../services/scan-environment/src/services/AWSResourceDiscovery';
import { ScanResultProcessor } from '../../../../services/scan-environment/src/services/ScanResultProcessor';
import { mockAWSResponses } from '../../setup/aws-mocks';

// Mock dependencies
jest.mock('../../../../services/scan-environment/src/services/AWSResourceDiscovery');
jest.mock('../../../../services/scan-environment/src/services/ScanResultProcessor');

describe('ScanEnvironmentService', () => {
  let scanEnvironmentService: ScanEnvironmentService;
  let mockResourceDiscovery: jest.Mocked<AWSResourceDiscovery>;
  let mockResultProcessor: jest.Mocked<ScanResultProcessor>;

  beforeEach(() => {
    scanEnvironmentService = new ScanEnvironmentService();
    mockResourceDiscovery = new AWSResourceDiscovery() as jest.Mocked<AWSResourceDiscovery>;
    mockResultProcessor = new ScanResultProcessor() as jest.Mocked<ScanResultProcessor>;

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('startScan', () => {
    it('should start a compliance scan successfully', async () => {
      // Arrange
      const scanRequest = {
        tenantId: global.testUtils.generateTenantId(),
        scanType: 'FULL_COMPLIANCE' as const,
        regions: ['us-east-1'],
        services: ['s3', 'iam'],
        configuration: {
          includeCompliant: false,
          excludeRules: []
        }
      };

      const mockScanJob = global.testUtils.createTestScanJob({
        tenantId: scanRequest.tenantId,
        scanType: scanRequest.scanType,
        status: 'IN_PROGRESS'
      });

      // Mock dependencies
      mockResourceDiscovery.discoverResources = jest.fn().mockResolvedValue({
        resources: [
          {
            resourceId: 'bucket-1',
            resourceType: 'S3Bucket',
            region: 'us-east-1',
            configuration: { bucketName: 'test-bucket-1' }
          },
          {
            resourceId: 'user-1',
            resourceType: 'IAMUser',
            region: 'us-east-1',
            configuration: { userName: 'test-user-1' }
          }
        ],
        metadata: {
          totalResources: 2,
          discoveryTime: 1500
        }
      });

      mockResultProcessor.processResults = jest.fn().mockResolvedValue({
        findings: [
          global.testUtils.createTestFinding({
            resourceId: 'bucket-1',
            resourceType: 'S3Bucket',
            severity: 'HIGH'
          })
        ],
        statistics: {
          totalFindings: 1,
          criticalFindings: 0,
          highFindings: 1,
          mediumFindings: 0,
          lowFindings: 0
        }
      });

      // Act
      const result = await scanEnvironmentService.startScan(scanRequest);

      // Assert
      expect(result).toBeDefined();
      expect(result.scanId).toMatch(/^scan-/);
      expect(result.status).toBe('IN_PROGRESS');
      expect(result.tenantId).toBe(scanRequest.tenantId);
      expect(result.scanType).toBe(scanRequest.scanType);
      expect(result.configuration).toEqual(scanRequest.configuration);
    });

    it('should handle scan request validation errors', async () => {
      // Arrange
      const invalidScanRequest = {
        tenantId: '', // Invalid empty tenant ID
        scanType: 'FULL_COMPLIANCE' as const,
        regions: [],
        services: []
      };

      // Act & Assert
      await expect(scanEnvironmentService.startScan(invalidScanRequest))
        .rejects
        .toThrow('Invalid scan request');
    });

    it('should handle resource discovery failures', async () => {
      // Arrange
      const scanRequest = {
        tenantId: global.testUtils.generateTenantId(),
        scanType: 'FULL_COMPLIANCE' as const,
        regions: ['us-east-1'],
        services: ['s3']
      };

      mockResourceDiscovery.discoverResources = jest.fn().mockRejectedValue(
        new Error('Failed to discover resources')
      );

      // Act & Assert
      await expect(scanEnvironmentService.startScan(scanRequest))
        .rejects
        .toThrow('Failed to discover resources');
    });
  });

  describe('getScanStatus', () => {
    it('should return scan status for existing scan', async () => {
      // Arrange
      const scanId = 'scan-123';
      const tenantId = global.testUtils.generateTenantId();

      const mockScanJob = global.testUtils.createTestScanJob({
        scanId,
        tenantId,
        status: 'COMPLETED'
      });

      // Mock the repository method
      jest.spyOn(scanEnvironmentService as any, 'getScanFromRepository')
        .mockResolvedValue(mockScanJob);

      // Act
      const result = await scanEnvironmentService.getScanStatus(scanId, tenantId);

      // Assert
      expect(result).toBeDefined();
      expect(result.scanId).toBe(scanId);
      expect(result.tenantId).toBe(tenantId);
      expect(result.status).toBe('COMPLETED');
    });

    it('should throw error for non-existent scan', async () => {
      // Arrange
      const scanId = 'non-existent-scan';
      const tenantId = global.testUtils.generateTenantId();

      jest.spyOn(scanEnvironmentService as any, 'getScanFromRepository')
        .mockResolvedValue(null);

      // Act & Assert
      await expect(scanEnvironmentService.getScanStatus(scanId, tenantId))
        .rejects
        .toThrow('Scan not found');
    });

    it('should throw error for unauthorized tenant access', async () => {
      // Arrange
      const scanId = 'scan-123';
      const ownerTenantId = global.testUtils.generateTenantId();
      const requestorTenantId = global.testUtils.generateTenantId();

      const mockScanJob = global.testUtils.createTestScanJob({
        scanId,
        tenantId: ownerTenantId
      });

      jest.spyOn(scanEnvironmentService as any, 'getScanFromRepository')
        .mockResolvedValue(mockScanJob);

      // Act & Assert
      await expect(scanEnvironmentService.getScanStatus(scanId, requestorTenantId))
        .rejects
        .toThrow('Unauthorized access to scan');
    });
  });

  describe('listScans', () => {
    it('should return paginated list of scans for tenant', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();
      const options = {
        maxResults: 10,
        nextToken: undefined,
        status: undefined
      };

      const mockScans = [
        global.testUtils.createTestScanJob({ tenantId }),
        global.testUtils.createTestScanJob({ tenantId }),
        global.testUtils.createTestScanJob({ tenantId })
      ];

      jest.spyOn(scanEnvironmentService as any, 'listScansFromRepository')
        .mockResolvedValue({
          scans: mockScans,
          nextToken: null,
          totalCount: 3
        });

      // Act
      const result = await scanEnvironmentService.listScans(tenantId, options);

      // Assert
      expect(result).toBeDefined();
      expect(result.scans).toHaveLength(3);
      expect(result.scans[0].tenantId).toBe(tenantId);
      expect(result.totalCount).toBe(3);
      expect(result.nextToken).toBeNull();
    });

    it('should filter scans by status', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();
      const options = {
        maxResults: 10,
        status: 'COMPLETED' as const
      };

      const mockScans = [
        global.testUtils.createTestScanJob({ tenantId, status: 'COMPLETED' })
      ];

      jest.spyOn(scanEnvironmentService as any, 'listScansFromRepository')
        .mockResolvedValue({
          scans: mockScans,
          nextToken: null,
          totalCount: 1
        });

      // Act
      const result = await scanEnvironmentService.listScans(tenantId, options);

      // Assert
      expect(result.scans).toHaveLength(1);
      expect(result.scans[0].status).toBe('COMPLETED');
    });

    it('should handle pagination correctly', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();
      const options = {
        maxResults: 2,
        nextToken: 'next-page-token'
      };

      const mockScans = [
        global.testUtils.createTestScanJob({ tenantId }),
        global.testUtils.createTestScanJob({ tenantId })
      ];

      jest.spyOn(scanEnvironmentService as any, 'listScansFromRepository')
        .mockResolvedValue({
          scans: mockScans,
          nextToken: 'next-page-token-2',
          totalCount: 5
        });

      // Act
      const result = await scanEnvironmentService.listScans(tenantId, options);

      // Assert
      expect(result.scans).toHaveLength(2);
      expect(result.nextToken).toBe('next-page-token-2');
      expect(result.totalCount).toBe(5);
    });
  });

  describe('cancelScan', () => {
    it('should cancel an in-progress scan', async () => {
      // Arrange
      const scanId = 'scan-123';
      const tenantId = global.testUtils.generateTenantId();

      const mockScanJob = global.testUtils.createTestScanJob({
        scanId,
        tenantId,
        status: 'IN_PROGRESS'
      });

      jest.spyOn(scanEnvironmentService as any, 'getScanFromRepository')
        .mockResolvedValue(mockScanJob);

      jest.spyOn(scanEnvironmentService as any, 'updateScanInRepository')
        .mockResolvedValue({
          ...mockScanJob,
          status: 'CANCELLED'
        });

      // Act
      const result = await scanEnvironmentService.cancelScan(scanId, tenantId);

      // Assert
      expect(result).toBeDefined();
      expect(result.scanId).toBe(scanId);
      expect(result.status).toBe('CANCELLED');
    });

    it('should not cancel completed scans', async () => {
      // Arrange
      const scanId = 'scan-123';
      const tenantId = global.testUtils.generateTenantId();

      const mockScanJob = global.testUtils.createTestScanJob({
        scanId,
        tenantId,
        status: 'COMPLETED'
      });

      jest.spyOn(scanEnvironmentService as any, 'getScanFromRepository')
        .mockResolvedValue(mockScanJob);

      // Act & Assert
      await expect(scanEnvironmentService.cancelScan(scanId, tenantId))
        .rejects
        .toThrow('Cannot cancel scan in COMPLETED status');
    });
  });

  describe('processAsyncScan', () => {
    it('should process async scan successfully', async () => {
      // Arrange
      const scanId = 'scan-123';
      const tenantId = global.testUtils.generateTenantId();

      const mockScanJob = global.testUtils.createTestScanJob({
        scanId,
        tenantId,
        status: 'PENDING'
      });

      jest.spyOn(scanEnvironmentService as any, 'getScanFromRepository')
        .mockResolvedValue(mockScanJob);

      mockResourceDiscovery.discoverResources = jest.fn().mockResolvedValue({
        resources: [
          {
            resourceId: 'bucket-1',
            resourceType: 'S3Bucket',
            region: 'us-east-1',
            configuration: { bucketName: 'test-bucket-1' }
          }
        ],
        metadata: {
          totalResources: 1,
          discoveryTime: 1000
        }
      });

      mockResultProcessor.processResults = jest.fn().mockResolvedValue({
        findings: [
          global.testUtils.createTestFinding({
            resourceId: 'bucket-1',
            resourceType: 'S3Bucket'
          })
        ],
        statistics: {
          totalFindings: 1,
          criticalFindings: 0,
          highFindings: 1,
          mediumFindings: 0,
          lowFindings: 0
        }
      });

      jest.spyOn(scanEnvironmentService as any, 'updateScanInRepository')
        .mockResolvedValue({
          ...mockScanJob,
          status: 'COMPLETED'
        });

      // Act
      await scanEnvironmentService.processAsyncScan(scanId, tenantId);

      // Assert
      expect(mockResourceDiscovery.discoverResources).toHaveBeenCalled();
      expect(mockResultProcessor.processResults).toHaveBeenCalled();
    });

    it('should handle processing errors gracefully', async () => {
      // Arrange
      const scanId = 'scan-123';
      const tenantId = global.testUtils.generateTenantId();

      const mockScanJob = global.testUtils.createTestScanJob({
        scanId,
        tenantId,
        status: 'PENDING'
      });

      jest.spyOn(scanEnvironmentService as any, 'getScanFromRepository')
        .mockResolvedValue(mockScanJob);

      mockResourceDiscovery.discoverResources = jest.fn().mockRejectedValue(
        new Error('Discovery failed')
      );

      jest.spyOn(scanEnvironmentService as any, 'updateScanInRepository')
        .mockResolvedValue({
          ...mockScanJob,
          status: 'FAILED'
        });

      // Act & Assert
      await expect(scanEnvironmentService.processAsyncScan(scanId, tenantId))
        .rejects
        .toThrow('Discovery failed');
    });
  });

  describe('health check', () => {
    it('should return healthy status when all dependencies are available', async () => {
      // Arrange
      jest.spyOn(scanEnvironmentService as any, 'checkDatabaseHealth')
        .mockResolvedValue(true);
      
      jest.spyOn(scanEnvironmentService as any, 'checkAWSHealth')
        .mockResolvedValue(true);

      // Act
      const result = await scanEnvironmentService.healthCheck();

      // Assert
      expect(result).toBeDefined();
      expect(result.database).toBe(true);
      expect(result.aws).toBe(true);
      expect(result.resourceDiscovery).toBe(true);
    });

    it('should return unhealthy status when dependencies are unavailable', async () => {
      // Arrange
      jest.spyOn(scanEnvironmentService as any, 'checkDatabaseHealth')
        .mockResolvedValue(false);

      // Act
      const result = await scanEnvironmentService.healthCheck();

      // Assert
      expect(result.database).toBe(false);
    });
  });
});
