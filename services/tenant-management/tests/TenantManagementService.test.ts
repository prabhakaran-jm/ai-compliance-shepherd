import { TenantManagementService } from '../src/services/TenantManagementService';
import { TenantRequest, TenantUpdateRequest } from '../src/types/tenant';
import { TenantManagementError } from '../src/utils/errorHandler';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-kms');
jest.mock('@aws-sdk/client-sts');

const mockSTSClient = {
  send: jest.fn()
};

// Mock the clients
jest.doMock('@aws-sdk/client-sts', () => ({
  STSClient: jest.fn(() => mockSTSClient),
  GetCallerIdentityCommand: jest.fn()
}));

describe('TenantManagementService', () => {
  let service: TenantManagementService;
  const correlationId = 'test-correlation-id';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TenantManagementService();
    
    // Mock STS response
    mockSTSClient.send.mockResolvedValue({
      Account: '123456789012'
    });
  });

  describe('createTenant', () => {
    const validTenantRequest: TenantRequest = {
      name: 'test-company',
      displayName: 'Test Company Inc.',
      organizationId: 'org-123',
      tier: 'STANDARD',
      configuration: {
        complianceFrameworks: ['SOC2'],
        scanSchedule: 'DAILY',
        retentionPeriodDays: 365,
        encryptionEnabled: true,
        auditLoggingEnabled: true,
        crossAccountRoleEnabled: false,
        allowedRegions: ['us-east-1'],
        resourceLimits: {
          maxFindings: 10000,
          maxScanJobs: 100,
          maxUsers: 50,
          maxReports: 1000
        },
        features: {
          automatedRemediation: true,
          realTimeMonitoring: true,
          customRules: false,
          apiAccess: true,
          ssoIntegration: false
        }
      },
      contactInfo: {
        primaryContact: {
          name: 'John Doe',
          email: 'john.doe@test-company.com',
          phone: '+1-555-0123'
        }
      },
      billingInfo: {
        billingEmail: 'billing@test-company.com',
        paymentMethod: 'CREDIT_CARD',
        billingAddress: {
          street: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94105',
          country: 'US'
        }
      },
      createdBy: 'admin@test-company.com'
    };

    it('should create a tenant successfully', async () => {
      const result = await service.createTenant(validTenantRequest, correlationId);

      expect(result).toMatchObject({
        name: 'test-company',
        displayName: 'Test Company Inc.',
        organizationId: 'org-123',
        status: 'ACTIVE',
        tier: 'STANDARD'
      });

      expect(result.tenantId).toBeDefined();
      expect(result.tenantId).toMatch(/^tenant-test-company$/);
      expect(result.resources).toBeDefined();
      expect(result.resources.kmsKeyId).toBeDefined();
      expect(result.resources.s3BucketName).toBeDefined();
      expect(result.metadata.createdAt).toBeDefined();
      expect(result.metadata.version).toBe(1);
    });

    it('should generate correct tenant ID from name', async () => {
      const testCases = [
        { name: 'test-company', expected: 'tenant-test-company' },
        { name: 'Test Company!', expected: 'tenant-test-company' },
        { name: 'my_awesome_company', expected: 'tenant-my-awesome-company' },
        { name: 'Company123', expected: 'tenant-company123' }
      ];

      for (const testCase of testCases) {
        const request = { ...validTenantRequest, name: testCase.name };
        const result = await service.createTenant(request, correlationId);
        expect(result.tenantId).toBe(testCase.expected);
      }
    });

    it('should apply default configuration values', async () => {
      const minimalRequest: TenantRequest = {
        name: 'minimal-company',
        organizationId: 'org-456'
      };

      const result = await service.createTenant(minimalRequest, correlationId);

      expect(result.configuration).toMatchObject({
        complianceFrameworks: ['SOC2'],
        scanSchedule: 'DAILY',
        retentionPeriodDays: 365,
        encryptionEnabled: true,
        auditLoggingEnabled: true,
        crossAccountRoleEnabled: false
      });

      expect(result.tier).toBe('STANDARD');
    });

    it('should handle encryption service errors', async () => {
      // Mock encryption service to throw error
      jest.spyOn(service['encryptionService'], 'createTenantKeys')
        .mockRejectedValue(new Error('KMS error'));

      await expect(service.createTenant(validTenantRequest, correlationId))
        .rejects
        .toThrow(TenantManagementError);
    });

    it('should handle resource service errors', async () => {
      // Mock resource service to throw error
      jest.spyOn(service['resourceService'], 'createTenantResources')
        .mockRejectedValue(new Error('S3 error'));

      await expect(service.createTenant(validTenantRequest, correlationId))
        .rejects
        .toThrow(TenantManagementError);
    });
  });

  describe('getTenant', () => {
    it('should get tenant successfully', async () => {
      const tenantId = 'tenant-demo-company';
      const result = await service.getTenant(tenantId, correlationId);

      expect(result).toMatchObject({
        tenantId,
        name: 'demo-company',
        displayName: 'Demo Company Inc.',
        status: 'ACTIVE'
      });

      expect(result.configuration).toBeDefined();
      expect(result.resources).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should throw error for non-existent tenant', async () => {
      const tenantId = 'tenant-non-existent';

      await expect(service.getTenant(tenantId, correlationId))
        .rejects
        .toThrow(TenantManagementError);
    });
  });

  describe('updateTenant', () => {
    const tenantId = 'tenant-demo-company';
    const updateRequest: TenantUpdateRequest = {
      displayName: 'Updated Demo Company',
      tier: 'PREMIUM',
      status: 'ACTIVE',
      contactInfo: {
        primaryContact: {
          name: 'Jane Smith',
          email: 'jane.smith@demo-company.com'
        }
      },
      updatedBy: 'admin@demo-company.com'
    };

    it('should update tenant successfully', async () => {
      const result = await service.updateTenant(tenantId, updateRequest, correlationId);

      expect(result).toMatchObject({
        tenantId,
        displayName: 'Updated Demo Company',
        tier: 'PREMIUM'
      });

      expect(result.metadata.version).toBeGreaterThan(1);
      expect(result.metadata.lastModifiedAt).toBeDefined();
      expect(result.metadata.lastModifiedBy).toBe('admin@demo-company.com');
    });

    it('should throw error for non-existent tenant', async () => {
      const nonExistentTenantId = 'tenant-non-existent';

      await expect(service.updateTenant(nonExistentTenantId, updateRequest, correlationId))
        .rejects
        .toThrow(TenantManagementError);
    });

    it('should preserve existing values when partial update', async () => {
      const partialUpdate: TenantUpdateRequest = {
        displayName: 'Partially Updated Company'
      };

      const result = await service.updateTenant(tenantId, partialUpdate, correlationId);

      expect(result.displayName).toBe('Partially Updated Company');
      expect(result.tier).toBe('ENTERPRISE'); // Should preserve existing value
      expect(result.status).toBe('ACTIVE'); // Should preserve existing value
    });
  });

  describe('deleteTenant', () => {
    const tenantId = 'tenant-demo-company';

    it('should delete tenant successfully (soft delete)', async () => {
      const result = await service.deleteTenant(tenantId, correlationId);

      expect(result).toEqual({
        deleted: true,
        message: 'Tenant marked for deletion. Resources will be cleaned up asynchronously.'
      });
    });

    it('should throw error for non-existent tenant', async () => {
      const nonExistentTenantId = 'tenant-non-existent';

      await expect(service.deleteTenant(nonExistentTenantId, correlationId))
        .rejects
        .toThrow(TenantManagementError);
    });
  });

  describe('listTenants', () => {
    it('should list tenants successfully', async () => {
      const result = await service.listTenants({
        limit: 10
      }, correlationId);

      expect(result.tenants).toBeDefined();
      expect(Array.isArray(result.tenants)).toBe(true);
      expect(result.tenants.length).toBeGreaterThan(0);

      const tenant = result.tenants[0];
      expect(tenant).toMatchObject({
        tenantId: expect.any(String),
        name: expect.any(String),
        status: expect.any(String),
        tier: expect.any(String)
      });
    });

    it('should filter tenants by status', async () => {
      const result = await service.listTenants({
        status: 'ACTIVE',
        limit: 10
      }, correlationId);

      result.tenants.forEach(tenant => {
        expect(tenant.status).toBe('ACTIVE');
      });
    });

    it('should respect limit parameter', async () => {
      const result = await service.listTenants({
        limit: 5
      }, correlationId);

      expect(result.tenants.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getTenantConfiguration', () => {
    const tenantId = 'tenant-demo-company';

    it('should get tenant configuration successfully', async () => {
      const result = await service.getTenantConfiguration(tenantId, correlationId);

      expect(result).toMatchObject({
        complianceFrameworks: expect.any(Array),
        scanSchedule: expect.any(String),
        retentionPeriodDays: expect.any(Number),
        encryptionEnabled: expect.any(Boolean),
        auditLoggingEnabled: expect.any(Boolean)
      });

      expect(result.resourceLimits).toBeDefined();
      expect(result.features).toBeDefined();
    });
  });

  describe('updateTenantConfiguration', () => {
    const tenantId = 'tenant-demo-company';

    it('should update tenant configuration successfully', async () => {
      const configUpdate = {
        scanSchedule: 'WEEKLY' as const,
        retentionPeriodDays: 730,
        features: {
          automatedRemediation: false,
          realTimeMonitoring: true,
          customRules: true,
          apiAccess: true,
          ssoIntegration: true
        }
      };

      const result = await service.updateTenantConfiguration(tenantId, configUpdate, correlationId);

      expect(result).toMatchObject({
        scanSchedule: 'WEEKLY',
        retentionPeriodDays: 730
      });

      expect(result.features).toMatchObject({
        automatedRemediation: false,
        customRules: true,
        ssoIntegration: true
      });
    });
  });

  describe('getTenantMetrics', () => {
    const tenantId = 'tenant-demo-company';

    it('should get tenant metrics successfully', async () => {
      const result = await service.getTenantMetrics(tenantId, correlationId);

      expect(result).toMatchObject({
        tenantId,
        period: expect.any(String),
        scanJobs: {
          total: expect.any(Number),
          successful: expect.any(Number),
          failed: expect.any(Number),
          averageDuration: expect.any(Number)
        },
        findings: {
          total: expect.any(Number),
          critical: expect.any(Number),
          high: expect.any(Number),
          medium: expect.any(Number),
          low: expect.any(Number)
        },
        compliance: {
          overallScore: expect.any(Number),
          soc2Score: expect.any(Number)
        }
      });

      expect(result.generatedAt).toBeDefined();
    });
  });

  describe('getTenantHealth', () => {
    const tenantId = 'tenant-demo-company';

    it('should get tenant health successfully', async () => {
      const result = await service.getTenantHealth(tenantId, correlationId);

      expect(result).toMatchObject({
        tenantId,
        overallStatus: expect.stringMatching(/^(HEALTHY|WARNING|UNHEALTHY)$/),
        components: expect.any(Object),
        metrics: {
          uptime: expect.any(Number),
          errorRate: expect.any(Number),
          avgResponseTime: expect.any(Number),
          throughput: expect.any(Number)
        }
      });

      expect(result.lastHealthCheck).toBeDefined();
      expect(result.alerts).toBeDefined();
      expect(Array.isArray(result.alerts)).toBe(true);
    });

    it('should have valid component health statuses', async () => {
      const result = await service.getTenantHealth(tenantId, correlationId);

      Object.values(result.components).forEach(component => {
        expect(component.status).toMatch(/^(HEALTHY|WARNING|UNHEALTHY)$/);
        expect(component.responseTime).toBeGreaterThanOrEqual(0);
        expect(component.lastCheck).toBeDefined();
      });
    });
  });

  describe('error handling', () => {
    it('should handle STS errors gracefully', async () => {
      mockSTSClient.send.mockRejectedValue(new Error('STS access denied'));

      const request: TenantRequest = {
        name: 'test-company',
        organizationId: 'org-123'
      };

      await expect(service.createTenant(request, correlationId))
        .rejects
        .toThrow(TenantManagementError);
    });

    it('should handle invalid tenant names', async () => {
      const invalidRequest: TenantRequest = {
        name: '', // Empty name
        organizationId: 'org-123'
      };

      await expect(service.createTenant(invalidRequest, correlationId))
        .rejects
        .toThrow();
    });
  });

  describe('tenant ID generation', () => {
    it('should generate valid tenant IDs', () => {
      const testCases = [
        { input: 'simple', expected: 'tenant-simple' },
        { input: 'with-dashes', expected: 'tenant-with-dashes' },
        { input: 'With Spaces', expected: 'tenant-with-spaces' },
        { input: 'Special!@#Characters', expected: 'tenant-special-characters' },
        { input: 'multiple---dashes', expected: 'tenant-multiple-dashes' },
        { input: '-leading-trailing-', expected: 'tenant-leading-trailing' }
      ];

      testCases.forEach(testCase => {
        const result = service['generateTenantId'](testCase.input);
        expect(result).toBe(testCase.expected);
        expect(result).toMatch(/^tenant-[a-z0-9-]+$/);
        expect(result.length).toBeGreaterThan(7); // 'tenant-' + at least 1 char
        expect(result.length).toBeLessThanOrEqual(100);
      });
    });
  });
});
