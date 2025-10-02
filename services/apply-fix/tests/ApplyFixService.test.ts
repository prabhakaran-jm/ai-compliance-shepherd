import { ApplyFixService, RemediationRequest } from '../src/services/ApplyFixService';
import { RemediationJobsRepository } from '@ai-compliance-shepherd/data-access-layer';
import { AuditLogsRepository } from '@ai-compliance-shepherd/data-access-layer';
import { logger } from '../src/utils/logger';

// Mock dependencies
jest.mock('@ai-compliance-shepherd/data-access-layer');
jest.mock('../src/services/RemediationEngine');
jest.mock('../src/services/SafetyGuardrails');
jest.mock('../src/services/ApprovalWorkflow');
jest.mock('../src/services/RollbackManager');
jest.mock('../src/utils/logger');

const mockRemediationJobsRepo = {
  create: jest.fn(),
  update: jest.fn(),
  getById: jest.fn(),
  findByStatus: jest.fn()
};

const mockAuditLogsRepo = {
  create: jest.fn()
};

const mockRemediationEngine = {
  estimateImpact: jest.fn(),
  executeRemediation: jest.fn()
};

const mockSafetyGuardrails = {
  runSafetyChecks: jest.fn()
};

const mockApprovalWorkflow = {
  requestApproval: jest.fn()
};

const mockRollbackManager = {
  executeRollback: jest.fn()
};

// Mock modules
jest.mock('@ai-compliance-shepherd/data-access-layer', () => ({
  RemediationJobsRepository: jest.fn(() => mockRemediationJobsRepo),
  AuditLogsRepository: jest.fn(() => mockAuditLogsRepo)
}));

jest.mock('../src/services/RemediationEngine', () => ({
  RemediationEngine: jest.fn(() => mockRemediationEngine)
}));

jest.mock('../src/services/SafetyGuardrails', () => ({
  SafetyGuardrails: jest.fn(() => mockSafetyGuardrails)
}));

jest.mock('../src/services/ApprovalWorkflow', () => ({
  ApprovalWorkflow: jest.fn(() => mockApprovalWorkflow)
}));

jest.mock('../src/services/RollbackManager', () => ({
  RollbackManager: jest.fn(() => mockRollbackManager)
}));

describe('ApplyFixService', () => {
  let service: ApplyFixService;
  let mockLogger: jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ApplyFixService();
    mockLogger = logger as jest.Mocked<typeof logger>;
  });

  describe('applyRemediation', () => {
    const mockRequest: RemediationRequest = {
      findingId: 'finding-123',
      remediationType: 'ENABLE_BUCKET_ENCRYPTION',
      resourceId: 'test-bucket',
      resourceType: 'S3_BUCKET',
      region: 'us-east-1',
      accountId: '123456789012',
      tenantId: 'tenant-123',
      userId: 'user-123',
      autoApprove: false,
      dryRun: false
    };

    it('should apply low-risk remediation immediately', async () => {
      // Mock safety checks passing
      mockSafetyGuardrails.runSafetyChecks.mockResolvedValueOnce({
        passed: true,
        checks: [{
          name: 'Test Check',
          passed: true,
          message: 'All good',
          severity: 'LOW'
        }]
      });

      // Mock low impact estimation
      mockRemediationEngine.estimateImpact.mockResolvedValueOnce({
        riskLevel: 'LOW',
        affectedResources: 1,
        downtime: false,
        costImpact: 0,
        description: 'Low risk operation',
        mitigations: []
      });

      // Mock successful remediation
      mockRemediationEngine.executeRemediation.mockResolvedValueOnce({
        success: true,
        message: 'Remediation completed',
        changes: [{
          action: 'Enable encryption',
          resource: 'test-bucket',
          before: { encryption: 'disabled' },
          after: { encryption: 'enabled' }
        }],
        rollbackInfo: {
          type: 's3',
          data: { encryption: 'disabled' },
          instructions: ['Disable encryption']
        }
      });

      mockRemediationJobsRepo.create.mockResolvedValueOnce(undefined);
      mockRemediationJobsRepo.update.mockResolvedValueOnce(undefined);
      mockAuditLogsRepo.create.mockResolvedValueOnce(undefined);

      const result = await service.applyRemediation(mockRequest, 'correlation-123');

      expect(result.status).toBe('APPLIED');
      expect(result.approvalRequired).toBe(false);
      expect(mockRemediationEngine.executeRemediation).toHaveBeenCalled();
      expect(mockRemediationJobsRepo.create).toHaveBeenCalled();
      expect(mockAuditLogsRepo.create).toHaveBeenCalled();
    });

    it('should require approval for high-risk remediation', async () => {
      // Mock safety checks with failures
      mockSafetyGuardrails.runSafetyChecks.mockResolvedValueOnce({
        passed: false,
        checks: [{
          name: 'Production Check',
          passed: false,
          message: 'Production resource detected',
          severity: 'HIGH'
        }]
      });

      // Mock high impact estimation
      mockRemediationEngine.estimateImpact.mockResolvedValueOnce({
        riskLevel: 'HIGH',
        affectedResources: 5,
        downtime: true,
        costImpact: 100,
        description: 'High risk operation',
        mitigations: ['Schedule during maintenance window']
      });

      mockRemediationJobsRepo.create.mockResolvedValueOnce(undefined);
      mockRemediationJobsRepo.update.mockResolvedValueOnce(undefined);
      mockApprovalWorkflow.requestApproval.mockResolvedValueOnce(undefined);

      const result = await service.applyRemediation(mockRequest, 'correlation-123');

      expect(result.status).toBe('PENDING_APPROVAL');
      expect(result.approvalRequired).toBe(true);
      expect(mockApprovalWorkflow.requestApproval).toHaveBeenCalled();
      expect(mockRemediationEngine.executeRemediation).not.toHaveBeenCalled();
    });

    it('should handle remediation execution failure', async () => {
      // Mock safety checks passing
      mockSafetyGuardrails.runSafetyChecks.mockResolvedValueOnce({
        passed: true,
        checks: []
      });

      // Mock low impact estimation
      mockRemediationEngine.estimateImpact.mockResolvedValueOnce({
        riskLevel: 'LOW',
        affectedResources: 1,
        downtime: false,
        costImpact: 0,
        description: 'Low risk operation',
        mitigations: []
      });

      // Mock failed remediation
      mockRemediationEngine.executeRemediation.mockResolvedValueOnce({
        success: false,
        message: 'Remediation failed',
        changes: [],
        rollbackInfo: { type: 'none', data: {}, instructions: [] }
      });

      mockRemediationJobsRepo.create.mockResolvedValueOnce(undefined);
      mockRemediationJobsRepo.update.mockResolvedValueOnce(undefined);
      mockAuditLogsRepo.create.mockResolvedValueOnce(undefined);

      const result = await service.applyRemediation(mockRequest, 'correlation-123');

      expect(result.status).toBe('FAILED');
      expect(mockRemediationJobsRepo.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ status: 'FAILED' })
      );
    });

    it('should handle dry run requests', async () => {
      const dryRunRequest = { ...mockRequest, dryRun: true };

      mockSafetyGuardrails.runSafetyChecks.mockResolvedValueOnce({
        passed: true,
        checks: []
      });

      mockRemediationEngine.estimateImpact.mockResolvedValueOnce({
        riskLevel: 'LOW',
        affectedResources: 1,
        downtime: false,
        costImpact: 0,
        description: 'Low risk operation',
        mitigations: []
      });

      mockRemediationEngine.executeRemediation.mockResolvedValueOnce({
        success: true,
        message: 'Dry run completed',
        changes: [],
        rollbackInfo: { type: 'none', data: {}, instructions: [] }
      });

      mockRemediationJobsRepo.create.mockResolvedValueOnce(undefined);
      mockRemediationJobsRepo.update.mockResolvedValueOnce(undefined);
      mockAuditLogsRepo.create.mockResolvedValueOnce(undefined);

      const result = await service.applyRemediation(dryRunRequest, 'correlation-123');

      expect(result.status).toBe('APPLIED');
      expect(mockRemediationEngine.executeRemediation).toHaveBeenCalledWith(
        expect.objectContaining({ dryRun: true }),
        expect.any(String),
        expect.any(String)
      );
    });
  });

  describe('requestRemediationApproval', () => {
    const mockRequest: RemediationRequest = {
      findingId: 'finding-123',
      remediationType: 'ENABLE_BUCKET_ENCRYPTION',
      resourceId: 'test-bucket',
      resourceType: 'S3_BUCKET',
      region: 'us-east-1',
      accountId: '123456789012',
      tenantId: 'tenant-123',
      userId: 'user-123'
    };

    it('should create approval request successfully', async () => {
      mockSafetyGuardrails.runSafetyChecks.mockResolvedValueOnce({
        passed: true,
        checks: []
      });

      mockRemediationEngine.estimateImpact.mockResolvedValueOnce({
        riskLevel: 'MEDIUM',
        affectedResources: 1,
        downtime: false,
        costImpact: 0,
        description: 'Medium risk operation',
        mitigations: []
      });

      mockRemediationJobsRepo.create.mockResolvedValueOnce(undefined);
      mockApprovalWorkflow.requestApproval.mockResolvedValueOnce(undefined);

      const result = await service.requestRemediationApproval(mockRequest, 'correlation-123');

      expect(result.status).toBe('PENDING_APPROVAL');
      expect(result.approvalRequired).toBe(true);
      expect(mockRemediationJobsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PENDING_APPROVAL',
          approvalRequired: true
        })
      );
      expect(mockApprovalWorkflow.requestApproval).toHaveBeenCalled();
    });
  });

  describe('approveRemediation', () => {
    const mockRemediationId = 'remediation-123';

    it('should approve and execute remediation successfully', async () => {
      const mockJob = {
        id: mockRemediationId,
        findingId: 'finding-123',
        remediationType: 'ENABLE_BUCKET_ENCRYPTION',
        resourceId: 'test-bucket',
        resourceType: 'S3_BUCKET',
        region: 'us-east-1',
        accountId: '123456789012',
        tenantId: 'tenant-123',
        requestedBy: 'user-123',
        status: 'PENDING_APPROVAL',
        parameters: {},
        safetyChecks: { passed: true, checks: [] },
        estimatedImpact: { riskLevel: 'LOW', affectedResources: 1, downtime: false, costImpact: 0 }
      };

      mockRemediationJobsRepo.getById.mockResolvedValueOnce(mockJob);
      mockRemediationJobsRepo.update.mockResolvedValueOnce(undefined);

      mockRemediationEngine.executeRemediation.mockResolvedValueOnce({
        success: true,
        message: 'Remediation completed',
        changes: [],
        rollbackInfo: { type: 'none', data: {}, instructions: [] }
      });

      const result = await service.approveRemediation(mockRemediationId, 'correlation-123');

      expect(result.status).toBe('APPLIED');
      expect(mockRemediationJobsRepo.update).toHaveBeenCalledWith(
        mockRemediationId,
        expect.objectContaining({ status: 'APPROVED' })
      );
      expect(mockRemediationEngine.executeRemediation).toHaveBeenCalled();
    });

    it('should handle non-existent remediation', async () => {
      mockRemediationJobsRepo.getById.mockResolvedValueOnce(null);

      await expect(service.approveRemediation(mockRemediationId, 'correlation-123'))
        .rejects.toThrow('Remediation job not found');
    });

    it('should handle invalid status for approval', async () => {
      const mockJob = {
        id: mockRemediationId,
        status: 'COMPLETED'
      };

      mockRemediationJobsRepo.getById.mockResolvedValueOnce(mockJob);

      await expect(service.approveRemediation(mockRemediationId, 'correlation-123'))
        .rejects.toThrow('Cannot approve remediation in status: COMPLETED');
    });
  });

  describe('rollbackRemediation', () => {
    const mockRemediationId = 'remediation-123';

    it('should rollback remediation successfully', async () => {
      const mockJob = {
        id: mockRemediationId,
        findingId: 'finding-123',
        resourceId: 'test-bucket',
        resourceType: 'S3_BUCKET',
        remediationType: 'ENABLE_BUCKET_ENCRYPTION',
        region: 'us-east-1',
        accountId: '123456789012',
        status: 'COMPLETED',
        result: {
          rollbackInfo: {
            type: 's3',
            data: { encryption: 'disabled' },
            instructions: ['Disable encryption']
          }
        },
        safetyChecks: { passed: true, checks: [] },
        estimatedImpact: { riskLevel: 'LOW', affectedResources: 1, downtime: false, costImpact: 0 }
      };

      mockRemediationJobsRepo.getById.mockResolvedValueOnce(mockJob);
      mockRemediationJobsRepo.update.mockResolvedValueOnce(undefined);

      mockRollbackManager.executeRollback.mockResolvedValueOnce({
        success: true,
        message: 'Rollback completed',
        rollbackActions: [],
        partialRollback: false
      });

      const result = await service.rollbackRemediation(mockRemediationId, 'correlation-123');

      expect(result.status).toBe('ROLLED_BACK');
      expect(mockRollbackManager.executeRollback).toHaveBeenCalled();
      expect(mockRemediationJobsRepo.update).toHaveBeenCalledWith(
        mockRemediationId,
        expect.objectContaining({ status: 'ROLLED_BACK' })
      );
    });

    it('should handle remediation without rollback info', async () => {
      const mockJob = {
        id: mockRemediationId,
        status: 'COMPLETED',
        result: {}
      };

      mockRemediationJobsRepo.getById.mockResolvedValueOnce(mockJob);

      await expect(service.rollbackRemediation(mockRemediationId, 'correlation-123'))
        .rejects.toThrow('No rollback information available for this remediation');
    });
  });

  describe('getRemediationStatus', () => {
    const mockRemediationId = 'remediation-123';

    it('should return remediation status successfully', async () => {
      const mockJob = {
        id: mockRemediationId,
        findingId: 'finding-123',
        resourceId: 'test-bucket',
        resourceType: 'S3_BUCKET',
        remediationType: 'ENABLE_BUCKET_ENCRYPTION',
        status: 'COMPLETED',
        appliedAt: '2024-01-01T00:00:00Z',
        result: {
          rollbackInfo: { type: 'none', data: {}, instructions: [] },
          changes: []
        },
        safetyChecks: { passed: true, checks: [] },
        estimatedImpact: { riskLevel: 'LOW', affectedResources: 1, downtime: false, costImpact: 0 }
      };

      mockRemediationJobsRepo.getById.mockResolvedValueOnce(mockJob);

      const result = await service.getRemediationStatus(mockRemediationId, 'correlation-123');

      expect(result.remediationId).toBe(mockRemediationId);
      expect(result.status).toBe('COMPLETED');
      expect(result.appliedAt).toBe('2024-01-01T00:00:00Z');
    });

    it('should handle non-existent remediation', async () => {
      mockRemediationJobsRepo.getById.mockResolvedValueOnce(null);

      await expect(service.getRemediationStatus(mockRemediationId, 'correlation-123'))
        .rejects.toThrow('Remediation job not found');
    });
  });

  describe('listPendingRemediations', () => {
    it('should return pending remediations successfully', async () => {
      const mockPendingJobs = [
        {
          id: 'remediation-1',
          findingId: 'finding-1',
          resourceId: 'resource-1',
          resourceType: 'S3_BUCKET',
          remediationType: 'ENABLE_BUCKET_ENCRYPTION',
          safetyChecks: { passed: true, checks: [] },
          estimatedImpact: { riskLevel: 'LOW', affectedResources: 1, downtime: false, costImpact: 0 }
        },
        {
          id: 'remediation-2',
          findingId: 'finding-2',
          resourceId: 'resource-2',
          resourceType: 'IAM_ROLE',
          remediationType: 'ATTACH_SECURITY_POLICY',
          safetyChecks: { passed: false, checks: [] },
          estimatedImpact: { riskLevel: 'HIGH', affectedResources: 3, downtime: false, costImpact: 0 }
        }
      ];

      mockRemediationJobsRepo.findByStatus.mockResolvedValueOnce(mockPendingJobs);

      const result = await service.listPendingRemediations('correlation-123');

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('PENDING_APPROVAL');
      expect(result[1].status).toBe('PENDING_APPROVAL');
      expect(mockRemediationJobsRepo.findByStatus).toHaveBeenCalledWith('PENDING_APPROVAL');
    });

    it('should return empty array when no pending remediations', async () => {
      mockRemediationJobsRepo.findByStatus.mockResolvedValueOnce([]);

      const result = await service.listPendingRemediations('correlation-123');

      expect(result).toHaveLength(0);
    });
  });
});
