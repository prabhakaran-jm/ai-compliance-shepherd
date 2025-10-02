import { RemediationJobsRepository } from '@ai-compliance-shepherd/data-access-layer';
import { AuditLogsRepository } from '@ai-compliance-shepherd/data-access-layer';
import { RemediationEngine } from './RemediationEngine';
import { SafetyGuardrails } from './SafetyGuardrails';
import { ApprovalWorkflow } from './ApprovalWorkflow';
import { RollbackManager } from './RollbackManager';
import { logger } from '../utils/logger';
import { RemediationError, SafetyViolationError } from '../utils/errorHandler';
import { v4 as uuidv4 } from 'uuid';

export interface RemediationRequest {
  findingId: string;
  remediationType: string;
  resourceId: string;
  resourceType: string;
  region: string;
  accountId: string;
  tenantId: string;
  userId: string;
  autoApprove?: boolean;
  dryRun?: boolean;
  parameters?: Record<string, any>;
}

export interface RemediationResult {
  remediationId: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'APPLIED' | 'FAILED' | 'ROLLED_BACK';
  findingId: string;
  resourceId: string;
  resourceType: string;
  remediationType: string;
  appliedAt?: string;
  rollbackInfo?: any;
  approvalRequired: boolean;
  safetyChecks: {
    passed: boolean;
    checks: Array<{
      name: string;
      passed: boolean;
      message: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }>;
  };
  changes?: Array<{
    action: string;
    resource: string;
    before: any;
    after: any;
  }>;
  estimatedImpact: {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    affectedResources: number;
    downtime: boolean;
    costImpact: number;
  };
  message?: string;
}

export interface ApprovalRequest {
  remediationId: string;
  approver: string;
  approved: boolean;
  reason?: string;
  conditions?: string[];
}

/**
 * Service for applying compliance fixes with comprehensive safety guardrails
 */
export class ApplyFixService {
  private remediationJobsRepo: RemediationJobsRepository;
  private auditLogsRepo: AuditLogsRepository;
  private remediationEngine: RemediationEngine;
  private safetyGuardrails: SafetyGuardrails;
  private approvalWorkflow: ApprovalWorkflow;
  private rollbackManager: RollbackManager;

  constructor() {
    this.remediationJobsRepo = new RemediationJobsRepository();
    this.auditLogsRepo = new AuditLogsRepository();
    this.remediationEngine = new RemediationEngine();
    this.safetyGuardrails = new SafetyGuardrails();
    this.approvalWorkflow = new ApprovalWorkflow();
    this.rollbackManager = new RollbackManager();
  }

  /**
   * Apply remediation immediately (for safe fixes only)
   */
  async applyRemediation(request: RemediationRequest, correlationId: string): Promise<RemediationResult> {
    const remediationId = uuidv4();
    
    logger.info('Starting remediation application', {
      correlationId,
      remediationId,
      findingId: request.findingId,
      resourceId: request.resourceId,
      remediationType: request.remediationType,
      dryRun: request.dryRun
    });

    try {
      // Create remediation job record
      await this.remediationJobsRepo.create({
        id: remediationId,
        tenantId: request.tenantId,
        findingId: request.findingId,
        resourceId: request.resourceId,
        resourceType: request.resourceType,
        remediationType: request.remediationType,
        status: 'PENDING',
        region: request.region,
        accountId: request.accountId,
        requestedBy: request.userId,
        requestedAt: new Date().toISOString(),
        parameters: request.parameters || {},
        dryRun: request.dryRun || false
      });

      // Run safety checks
      const safetyChecks = await this.safetyGuardrails.runSafetyChecks({
        resourceId: request.resourceId,
        resourceType: request.resourceType,
        remediationType: request.remediationType,
        region: request.region,
        accountId: request.accountId,
        parameters: request.parameters
      }, correlationId);

      if (!safetyChecks.passed) {
        const criticalFailures = safetyChecks.checks.filter(c => !c.passed && c.severity === 'CRITICAL');
        if (criticalFailures.length > 0) {
          throw new SafetyViolationError(
            `Critical safety checks failed: ${criticalFailures.map(c => c.message).join(', ')}`
          );
        }
      }

      // Estimate impact
      const estimatedImpact = await this.remediationEngine.estimateImpact({
        resourceId: request.resourceId,
        resourceType: request.resourceType,
        remediationType: request.remediationType,
        region: request.region,
        accountId: request.accountId,
        parameters: request.parameters
      }, correlationId);

      // Determine if approval is required
      const approvalRequired = this.requiresApproval(request, safetyChecks, estimatedImpact);

      if (approvalRequired && !request.autoApprove) {
        // Create approval request
        await this.remediationJobsRepo.update(remediationId, {
          status: 'PENDING_APPROVAL',
          safetyChecks: safetyChecks,
          estimatedImpact: estimatedImpact,
          approvalRequired: true
        });

        await this.approvalWorkflow.requestApproval({
          remediationId,
          findingId: request.findingId,
          resourceId: request.resourceId,
          remediationType: request.remediationType,
          requestedBy: request.userId,
          tenantId: request.tenantId,
          safetyChecks,
          estimatedImpact
        }, correlationId);

        return {
          remediationId,
          status: 'PENDING_APPROVAL',
          findingId: request.findingId,
          resourceId: request.resourceId,
          resourceType: request.resourceType,
          remediationType: request.remediationType,
          approvalRequired: true,
          safetyChecks,
          estimatedImpact,
          message: 'Remediation requires approval due to safety concerns or impact level'
        };
      }

      // Apply remediation
      const remediationResult = await this.executeRemediation(request, remediationId, correlationId);

      // Update job status
      await this.remediationJobsRepo.update(remediationId, {
        status: remediationResult.success ? 'COMPLETED' : 'FAILED',
        appliedAt: new Date().toISOString(),
        result: remediationResult,
        safetyChecks: safetyChecks,
        estimatedImpact: estimatedImpact
      });

      // Log audit trail
      await this.auditLogsRepo.create({
        id: uuidv4(),
        tenantId: request.tenantId,
        userId: request.userId,
        action: 'REMEDIATION_APPLIED',
        resourceType: 'REMEDIATION',
        resourceId: remediationId,
        details: {
          findingId: request.findingId,
          resourceId: request.resourceId,
          remediationType: request.remediationType,
          success: remediationResult.success,
          changes: remediationResult.changes
        },
        timestamp: new Date().toISOString(),
        correlationId
      });

      return {
        remediationId,
        status: remediationResult.success ? 'APPLIED' : 'FAILED',
        findingId: request.findingId,
        resourceId: request.resourceId,
        resourceType: request.resourceType,
        remediationType: request.remediationType,
        appliedAt: new Date().toISOString(),
        rollbackInfo: remediationResult.rollbackInfo,
        approvalRequired: false,
        safetyChecks,
        estimatedImpact,
        changes: remediationResult.changes,
        message: remediationResult.message
      };

    } catch (error) {
      logger.error('Error applying remediation', {
        correlationId,
        remediationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Update job status to failed
      await this.remediationJobsRepo.update(remediationId, {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
        failedAt: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * Request approval for remediation
   */
  async requestRemediationApproval(request: RemediationRequest, correlationId: string): Promise<RemediationResult> {
    const remediationId = uuidv4();
    
    logger.info('Requesting remediation approval', {
      correlationId,
      remediationId,
      findingId: request.findingId,
      resourceId: request.resourceId,
      remediationType: request.remediationType
    });

    try {
      // Run safety checks
      const safetyChecks = await this.safetyGuardrails.runSafetyChecks({
        resourceId: request.resourceId,
        resourceType: request.resourceType,
        remediationType: request.remediationType,
        region: request.region,
        accountId: request.accountId,
        parameters: request.parameters
      }, correlationId);

      // Estimate impact
      const estimatedImpact = await this.remediationEngine.estimateImpact({
        resourceId: request.resourceId,
        resourceType: request.resourceType,
        remediationType: request.remediationType,
        region: request.region,
        accountId: request.accountId,
        parameters: request.parameters
      }, correlationId);

      // Create remediation job record
      await this.remediationJobsRepo.create({
        id: remediationId,
        tenantId: request.tenantId,
        findingId: request.findingId,
        resourceId: request.resourceId,
        resourceType: request.resourceType,
        remediationType: request.remediationType,
        status: 'PENDING_APPROVAL',
        region: request.region,
        accountId: request.accountId,
        requestedBy: request.userId,
        requestedAt: new Date().toISOString(),
        parameters: request.parameters || {},
        safetyChecks: safetyChecks,
        estimatedImpact: estimatedImpact,
        approvalRequired: true
      });

      // Request approval
      await this.approvalWorkflow.requestApproval({
        remediationId,
        findingId: request.findingId,
        resourceId: request.resourceId,
        remediationType: request.remediationType,
        requestedBy: request.userId,
        tenantId: request.tenantId,
        safetyChecks,
        estimatedImpact
      }, correlationId);

      return {
        remediationId,
        status: 'PENDING_APPROVAL',
        findingId: request.findingId,
        resourceId: request.resourceId,
        resourceType: request.resourceType,
        remediationType: request.remediationType,
        approvalRequired: true,
        safetyChecks,
        estimatedImpact,
        message: 'Approval request submitted successfully'
      };

    } catch (error) {
      logger.error('Error requesting remediation approval', {
        correlationId,
        remediationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Approve pending remediation
   */
  async approveRemediation(remediationId: string, correlationId: string): Promise<RemediationResult> {
    logger.info('Approving remediation', {
      correlationId,
      remediationId
    });

    try {
      // Get remediation job
      const job = await this.remediationJobsRepo.getById(remediationId);
      if (!job) {
        throw new RemediationError('Remediation job not found');
      }

      if (job.status !== 'PENDING_APPROVAL') {
        throw new RemediationError(`Cannot approve remediation in status: ${job.status}`);
      }

      // Update status to approved
      await this.remediationJobsRepo.update(remediationId, {
        status: 'APPROVED',
        approvedAt: new Date().toISOString()
      });

      // Execute remediation
      const request: RemediationRequest = {
        findingId: job.findingId,
        remediationType: job.remediationType,
        resourceId: job.resourceId,
        resourceType: job.resourceType,
        region: job.region,
        accountId: job.accountId,
        tenantId: job.tenantId,
        userId: job.requestedBy,
        parameters: job.parameters
      };

      const remediationResult = await this.executeRemediation(request, remediationId, correlationId);

      // Update job status
      await this.remediationJobsRepo.update(remediationId, {
        status: remediationResult.success ? 'COMPLETED' : 'FAILED',
        appliedAt: new Date().toISOString(),
        result: remediationResult
      });

      return {
        remediationId,
        status: remediationResult.success ? 'APPLIED' : 'FAILED',
        findingId: job.findingId,
        resourceId: job.resourceId,
        resourceType: job.resourceType,
        remediationType: job.remediationType,
        appliedAt: new Date().toISOString(),
        rollbackInfo: remediationResult.rollbackInfo,
        approvalRequired: false,
        safetyChecks: job.safetyChecks || { passed: true, checks: [] },
        estimatedImpact: job.estimatedImpact || { riskLevel: 'LOW', affectedResources: 1, downtime: false, costImpact: 0 },
        changes: remediationResult.changes,
        message: remediationResult.message
      };

    } catch (error) {
      logger.error('Error approving remediation', {
        correlationId,
        remediationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Rollback applied remediation
   */
  async rollbackRemediation(remediationId: string, correlationId: string): Promise<RemediationResult> {
    logger.info('Rolling back remediation', {
      correlationId,
      remediationId
    });

    try {
      // Get remediation job
      const job = await this.remediationJobsRepo.getById(remediationId);
      if (!job) {
        throw new RemediationError('Remediation job not found');
      }

      if (job.status !== 'COMPLETED') {
        throw new RemediationError(`Cannot rollback remediation in status: ${job.status}`);
      }

      if (!job.result?.rollbackInfo) {
        throw new RemediationError('No rollback information available for this remediation');
      }

      // Execute rollback
      const rollbackResult = await this.rollbackManager.executeRollback({
        remediationId,
        resourceId: job.resourceId,
        resourceType: job.resourceType,
        remediationType: job.remediationType,
        region: job.region,
        accountId: job.accountId,
        rollbackInfo: job.result.rollbackInfo
      }, correlationId);

      // Update job status
      await this.remediationJobsRepo.update(remediationId, {
        status: 'ROLLED_BACK',
        rolledBackAt: new Date().toISOString(),
        rollbackResult: rollbackResult
      });

      return {
        remediationId,
        status: 'ROLLED_BACK',
        findingId: job.findingId,
        resourceId: job.resourceId,
        resourceType: job.resourceType,
        remediationType: job.remediationType,
        approvalRequired: false,
        safetyChecks: job.safetyChecks || { passed: true, checks: [] },
        estimatedImpact: job.estimatedImpact || { riskLevel: 'LOW', affectedResources: 1, downtime: false, costImpact: 0 },
        message: rollbackResult.success ? 'Remediation rolled back successfully' : 'Rollback failed'
      };

    } catch (error) {
      logger.error('Error rolling back remediation', {
        correlationId,
        remediationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Get remediation status
   */
  async getRemediationStatus(remediationId: string, correlationId: string): Promise<RemediationResult> {
    try {
      const job = await this.remediationJobsRepo.getById(remediationId);
      if (!job) {
        throw new RemediationError('Remediation job not found');
      }

      return {
        remediationId,
        status: job.status as any,
        findingId: job.findingId,
        resourceId: job.resourceId,
        resourceType: job.resourceType,
        remediationType: job.remediationType,
        appliedAt: job.appliedAt,
        rollbackInfo: job.result?.rollbackInfo,
        approvalRequired: job.approvalRequired || false,
        safetyChecks: job.safetyChecks || { passed: true, checks: [] },
        estimatedImpact: job.estimatedImpact || { riskLevel: 'LOW', affectedResources: 1, downtime: false, costImpact: 0 },
        changes: job.result?.changes,
        message: job.result?.message || `Remediation is ${job.status.toLowerCase()}`
      };

    } catch (error) {
      logger.error('Error getting remediation status', {
        correlationId,
        remediationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * List pending remediations
   */
  async listPendingRemediations(correlationId: string): Promise<RemediationResult[]> {
    try {
      const pendingJobs = await this.remediationJobsRepo.findByStatus('PENDING_APPROVAL');
      
      return pendingJobs.map(job => ({
        remediationId: job.id,
        status: 'PENDING_APPROVAL' as const,
        findingId: job.findingId,
        resourceId: job.resourceId,
        resourceType: job.resourceType,
        remediationType: job.remediationType,
        approvalRequired: true,
        safetyChecks: job.safetyChecks || { passed: true, checks: [] },
        estimatedImpact: job.estimatedImpact || { riskLevel: 'LOW', affectedResources: 1, downtime: false, costImpact: 0 },
        message: 'Pending approval'
      }));

    } catch (error) {
      logger.error('Error listing pending remediations', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Execute remediation
   */
  private async executeRemediation(
    request: RemediationRequest,
    remediationId: string,
    correlationId: string
  ): Promise<any> {
    return await this.remediationEngine.executeRemediation({
      remediationId,
      resourceId: request.resourceId,
      resourceType: request.resourceType,
      remediationType: request.remediationType,
      region: request.region,
      accountId: request.accountId,
      parameters: request.parameters,
      dryRun: request.dryRun
    }, correlationId);
  }

  /**
   * Determine if approval is required
   */
  private requiresApproval(
    request: RemediationRequest,
    safetyChecks: any,
    estimatedImpact: any
  ): boolean {
    // Always require approval for high/critical risk
    if (estimatedImpact.riskLevel === 'HIGH' || estimatedImpact.riskLevel === 'CRITICAL') {
      return true;
    }

    // Require approval if safety checks failed
    if (!safetyChecks.passed) {
      const highSeverityFailures = safetyChecks.checks.filter(
        (c: any) => !c.passed && (c.severity === 'HIGH' || c.severity === 'CRITICAL')
      );
      if (highSeverityFailures.length > 0) {
        return true;
      }
    }

    // Require approval for production resources
    if (request.resourceId.includes('prod') || request.resourceId.includes('production')) {
      return true;
    }

    // Require approval for certain resource types
    const highRiskResourceTypes = ['IAM_ROLE', 'IAM_POLICY', 'SECURITY_GROUP', 'VPC'];
    if (highRiskResourceTypes.includes(request.resourceType)) {
      return true;
    }

    // Require approval for certain remediation types
    const highRiskRemediationTypes = ['DELETE_RESOURCE', 'MODIFY_PERMISSIONS', 'CHANGE_ENCRYPTION'];
    if (highRiskRemediationTypes.includes(request.remediationType)) {
      return true;
    }

    return false;
  }
}
