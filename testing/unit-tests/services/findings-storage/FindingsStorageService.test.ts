/**
 * Unit tests for FindingsStorageService
 */

import { FindingsStorageService } from '../../../../services/findings-storage/src/services/FindingsStorageService';
import { FindingsRepository } from '../../../../services/data-access-layer/src/repositories/FindingsRepository';
import { mockAWSResponses } from '../../setup/aws-mocks';

// Mock dependencies
jest.mock('../../../../services/data-access-layer/src/repositories/FindingsRepository');

describe('FindingsStorageService', () => {
  let findingsService: FindingsStorageService;
  let mockFindingsRepository: jest.Mocked<FindingsRepository>;

  beforeEach(() => {
    findingsService = new FindingsStorageService();
    mockFindingsRepository = new FindingsRepository() as jest.Mocked<FindingsRepository>;

    // Reset mocks
    jest.clearAllMocks();

    // Set up default repository responses
    (findingsService as any).findingsRepository = mockFindingsRepository;
  });

  describe('createFinding', () => {
    it('should create a finding successfully', async () => {
      // Arrange
      const findingData = {
        tenantId: global.testUtils.generateTenantId(),
        scanId: 'scan-123',
        resourceId: 'bucket-1',
        resourceType: 'S3Bucket',
        region: 'us-east-1',
        accountId: '123456789012',
        severity: 'HIGH' as const,
        ruleId: 'S3_BUCKET_PUBLIC_READ_PROHIBITED',
        ruleName: 'S3 Bucket Public Read Prohibited',
        description: 'S3 bucket allows public read access',
        remediation: 'Remove public read access from S3 bucket',
        evidence: {
          bucketName: 'test-bucket',
          publicReadAcl: true
        }
      };

      const mockCreatedFinding = global.testUtils.createTestFinding(findingData);
      mockFindingsRepository.create = jest.fn().mockResolvedValue(mockCreatedFinding);

      // Act
      const result = await findingsService.createFinding(findingData);

      // Assert
      expect(result).toBeDefined();
      expect(result.findingId).toMatch(/^finding-/);
      expect(result.tenantId).toBe(findingData.tenantId);
      expect(result.resourceId).toBe(findingData.resourceId);
      expect(result.severity).toBe(findingData.severity);
      expect(mockFindingsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: findingData.tenantId,
          resourceId: findingData.resourceId,
          severity: findingData.severity
        })
      );
    });

    it('should validate required fields', async () => {
      // Arrange
      const invalidFindingData = {
        tenantId: '', // Invalid empty tenant ID
        resourceId: 'bucket-1',
        resourceType: 'S3Bucket'
      } as any;

      // Act & Assert
      await expect(findingsService.createFinding(invalidFindingData))
        .rejects
        .toThrow('Invalid finding data');
    });

    it('should handle repository errors', async () => {
      // Arrange
      const findingData = global.testUtils.createTestFinding();
      mockFindingsRepository.create = jest.fn().mockRejectedValue(
        new Error('Database error')
      );

      // Act & Assert
      await expect(findingsService.createFinding(findingData))
        .rejects
        .toThrow('Database error');
    });
  });

  describe('getFinding', () => {
    it('should retrieve finding by ID', async () => {
      // Arrange
      const findingId = 'finding-123';
      const tenantId = global.testUtils.generateTenantId();
      const mockFinding = global.testUtils.createTestFinding({ findingId, tenantId });

      mockFindingsRepository.getById = jest.fn().mockResolvedValue(mockFinding);

      // Act
      const result = await findingsService.getFinding(findingId, tenantId);

      // Assert
      expect(result).toBeDefined();
      expect(result.findingId).toBe(findingId);
      expect(result.tenantId).toBe(tenantId);
      expect(mockFindingsRepository.getById).toHaveBeenCalledWith(findingId, tenantId);
    });

    it('should return null for non-existent finding', async () => {
      // Arrange
      const findingId = 'non-existent-finding';
      const tenantId = global.testUtils.generateTenantId();

      mockFindingsRepository.getById = jest.fn().mockResolvedValue(null);

      // Act
      const result = await findingsService.getFinding(findingId, tenantId);

      // Assert
      expect(result).toBeNull();
    });

    it('should enforce tenant isolation', async () => {
      // Arrange
      const findingId = 'finding-123';
      const ownerTenantId = global.testUtils.generateTenantId();
      const requestorTenantId = global.testUtils.generateTenantId();

      mockFindingsRepository.getById = jest.fn().mockResolvedValue(null);

      // Act
      const result = await findingsService.getFinding(findingId, requestorTenantId);

      // Assert
      expect(result).toBeNull();
      expect(mockFindingsRepository.getById).toHaveBeenCalledWith(findingId, requestorTenantId);
    });
  });

  describe('listFindings', () => {
    it('should return paginated findings list', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();
      const filters = {
        severity: ['HIGH', 'CRITICAL'],
        status: ['OPEN'],
        resourceTypes: ['S3Bucket']
      };
      const pagination = {
        maxResults: 10,
        nextToken: undefined
      };

      const mockFindings = [
        global.testUtils.createTestFinding({ tenantId, severity: 'HIGH' }),
        global.testUtils.createTestFinding({ tenantId, severity: 'CRITICAL' })
      ];

      mockFindingsRepository.list = jest.fn().mockResolvedValue({
        items: mockFindings,
        nextToken: null,
        totalCount: 2
      });

      // Act
      const result = await findingsService.listFindings(tenantId, filters, pagination);

      // Assert
      expect(result).toBeDefined();
      expect(result.findings).toHaveLength(2);
      expect(result.findings[0].tenantId).toBe(tenantId);
      expect(result.totalCount).toBe(2);
      expect(result.nextToken).toBeNull();
    });

    it('should handle empty results', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();
      const filters = {};
      const pagination = { maxResults: 10 };

      mockFindingsRepository.list = jest.fn().mockResolvedValue({
        items: [],
        nextToken: null,
        totalCount: 0
      });

      // Act
      const result = await findingsService.listFindings(tenantId, filters, pagination);

      // Assert
      expect(result.findings).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should apply severity filters correctly', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();
      const filters = { severity: ['CRITICAL'] };
      const pagination = { maxResults: 10 };

      const mockFindings = [
        global.testUtils.createTestFinding({ tenantId, severity: 'CRITICAL' })
      ];

      mockFindingsRepository.list = jest.fn().mockResolvedValue({
        items: mockFindings,
        nextToken: null,
        totalCount: 1
      });

      // Act
      const result = await findingsService.listFindings(tenantId, filters, pagination);

      // Assert
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].severity).toBe('CRITICAL');
    });
  });

  describe('updateFindingStatus', () => {
    it('should update finding status to resolved', async () => {
      // Arrange
      const findingId = 'finding-123';
      const tenantId = global.testUtils.generateTenantId();
      const newStatus = 'RESOLVED';
      const reason = 'Fixed by remediation action';

      const mockFinding = global.testUtils.createTestFinding({ findingId, tenantId });
      const updatedFinding = { ...mockFinding, status: newStatus };

      mockFindingsRepository.getById = jest.fn().mockResolvedValue(mockFinding);
      mockFindingsRepository.update = jest.fn().mockResolvedValue(updatedFinding);

      // Act
      const result = await findingsService.updateFindingStatus(findingId, tenantId, newStatus, reason);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe(newStatus);
      expect(mockFindingsRepository.update).toHaveBeenCalledWith(
        findingId,
        expect.objectContaining({
          status: newStatus,
          statusReason: reason
        })
      );
    });

    it('should update finding status to suppressed', async () => {
      // Arrange
      const findingId = 'finding-123';
      const tenantId = global.testUtils.generateTenantId();
      const newStatus = 'SUPPRESSED';
      const reason = 'False positive - expected configuration';

      const mockFinding = global.testUtils.createTestFinding({ findingId, tenantId });
      const updatedFinding = { ...mockFinding, status: newStatus };

      mockFindingsRepository.getById = jest.fn().mockResolvedValue(mockFinding);
      mockFindingsRepository.update = jest.fn().mockResolvedValue(updatedFinding);

      // Act
      const result = await findingsService.updateFindingStatus(findingId, tenantId, newStatus, reason);

      // Assert
      expect(result.status).toBe(newStatus);
    });

    it('should throw error for non-existent finding', async () => {
      // Arrange
      const findingId = 'non-existent-finding';
      const tenantId = global.testUtils.generateTenantId();

      mockFindingsRepository.getById = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(findingsService.updateFindingStatus(findingId, tenantId, 'RESOLVED', 'Fixed'))
        .rejects
        .toThrow('Finding not found');
    });
  });

  describe('batchCreateFindings', () => {
    it('should create multiple findings in batch', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();
      const findingsData = [
        {
          tenantId,
          scanId: 'scan-123',
          resourceId: 'bucket-1',
          resourceType: 'S3Bucket',
          severity: 'HIGH' as const,
          ruleId: 'S3_BUCKET_PUBLIC_READ'
        },
        {
          tenantId,
          scanId: 'scan-123',
          resourceId: 'bucket-2',
          resourceType: 'S3Bucket',
          severity: 'MEDIUM' as const,
          ruleId: 'S3_BUCKET_VERSIONING'
        }
      ];

      const mockCreatedFindings = findingsData.map(data => 
        global.testUtils.createTestFinding(data)
      );

      mockFindingsRepository.batchCreate = jest.fn().mockResolvedValue({
        created: mockCreatedFindings,
        failed: []
      });

      // Act
      const result = await findingsService.batchCreateFindings(findingsData);

      // Assert
      expect(result).toBeDefined();
      expect(result.created).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.totalProcessed).toBe(2);
    });

    it('should handle partial batch failures', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();
      const findingsData = [
        {
          tenantId,
          scanId: 'scan-123',
          resourceId: 'bucket-1',
          resourceType: 'S3Bucket',
          severity: 'HIGH' as const,
          ruleId: 'S3_BUCKET_PUBLIC_READ'
        },
        {
          tenantId,
          scanId: 'scan-123',
          resourceId: '', // Invalid resource ID
          resourceType: 'S3Bucket',
          severity: 'MEDIUM' as const,
          ruleId: 'S3_BUCKET_VERSIONING'
        }
      ];

      const mockCreatedFindings = [global.testUtils.createTestFinding(findingsData[0])];

      mockFindingsRepository.batchCreate = jest.fn().mockResolvedValue({
        created: mockCreatedFindings,
        failed: [
          {
            item: findingsData[1],
            error: 'Invalid resource ID'
          }
        ]
      });

      // Act
      const result = await findingsService.batchCreateFindings(findingsData);

      // Assert
      expect(result.created).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.totalProcessed).toBe(2);
    });
  });

  describe('searchFindings', () => {
    it('should perform full-text search on findings', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();
      const searchQuery = 'S3 bucket public access';
      const filters = {};
      const pagination = { maxResults: 10 };

      const mockFindings = [
        global.testUtils.createTestFinding({
          tenantId,
          description: 'S3 bucket allows public read access'
        })
      ];

      mockFindingsRepository.search = jest.fn().mockResolvedValue({
        items: mockFindings,
        nextToken: null,
        totalCount: 1
      });

      // Act
      const result = await findingsService.searchFindings(tenantId, searchQuery, filters, pagination);

      // Assert
      expect(result).toBeDefined();
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].description).toContain('S3 bucket');
      expect(mockFindingsRepository.search).toHaveBeenCalledWith(
        tenantId,
        searchQuery,
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should return empty results for no matches', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();
      const searchQuery = 'nonexistent term';

      mockFindingsRepository.search = jest.fn().mockResolvedValue({
        items: [],
        nextToken: null,
        totalCount: 0
      });

      // Act
      const result = await findingsService.searchFindings(tenantId, searchQuery);

      // Assert
      expect(result.findings).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });
  });

  describe('getFindingStatistics', () => {
    it('should return finding statistics by severity', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();
      const filters = {};

      const mockStatistics = {
        totalFindings: 100,
        criticalFindings: 10,
        highFindings: 20,
        mediumFindings: 30,
        lowFindings: 40,
        openFindings: 70,
        resolvedFindings: 20,
        suppressedFindings: 10
      };

      mockFindingsRepository.getStatistics = jest.fn().mockResolvedValue(mockStatistics);

      // Act
      const result = await findingsService.getFindingStatistics(tenantId, filters);

      // Assert
      expect(result).toBeDefined();
      expect(result.totalFindings).toBe(100);
      expect(result.criticalFindings).toBe(10);
      expect(result.highFindings).toBe(20);
      expect(result.mediumFindings).toBe(30);
      expect(result.lowFindings).toBe(40);
    });

    it('should filter statistics by scan ID', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();
      const filters = { scanId: 'scan-123' };

      const mockStatistics = {
        totalFindings: 25,
        criticalFindings: 5,
        highFindings: 10,
        mediumFindings: 5,
        lowFindings: 5,
        openFindings: 20,
        resolvedFindings: 5,
        suppressedFindings: 0
      };

      mockFindingsRepository.getStatistics = jest.fn().mockResolvedValue(mockStatistics);

      // Act
      const result = await findingsService.getFindingStatistics(tenantId, filters);

      // Assert
      expect(result.totalFindings).toBe(25);
      expect(mockFindingsRepository.getStatistics).toHaveBeenCalledWith(tenantId, filters);
    });
  });

  describe('health check', () => {
    it('should return healthy status when repository is accessible', async () => {
      // Arrange
      mockFindingsRepository.healthCheck = jest.fn().mockResolvedValue(true);

      // Act
      const result = await findingsService.healthCheck();

      // Assert
      expect(result).toBeDefined();
      expect(result.repository).toBe(true);
      expect(result.database).toBe(true);
    });

    it('should return unhealthy status when repository is inaccessible', async () => {
      // Arrange
      mockFindingsRepository.healthCheck = jest.fn().mockResolvedValue(false);

      // Act
      const result = await findingsService.healthCheck();

      // Assert
      expect(result.repository).toBe(false);
      expect(result.database).toBe(false);
    });
  });
});
