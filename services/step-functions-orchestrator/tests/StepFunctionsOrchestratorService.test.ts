import { StepFunctionsOrchestratorService } from '../src/services/StepFunctionsOrchestratorService';
import { WorkflowRequest, WorkflowExecution } from '../src/types/workflow';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-sfn');
jest.mock('@aws-sdk/client-sts');

const mockSFNClient = {
  send: jest.fn()
};

const mockSTSClient = {
  send: jest.fn()
};

// Mock the AWS SDK constructors
const { SFNClient } = require('@aws-sdk/client-sfn');
const { STSClient } = require('@aws-sdk/client-sts');

SFNClient.mockImplementation(() => mockSFNClient);
STSClient.mockImplementation(() => mockSTSClient);

describe('StepFunctionsOrchestratorService', () => {
  let service: StepFunctionsOrchestratorService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set environment variables
    process.env.AWS_REGION = 'us-east-1';

    service = new StepFunctionsOrchestratorService();
  });

  afterEach(() => {
    delete process.env.AWS_REGION;
  });

  describe('startWorkflow', () => {
    it('should successfully start a workflow execution', async () => {
      const mockRequest: WorkflowRequest = {
        workflowType: 'compliance-scan',
        tenantId: 'test-tenant',
        parameters: {
          scanType: 'full',
          regions: ['us-east-1']
        },
        startedBy: 'test-user'
      };

      // Mock STS response
      mockSTSClient.send.mockResolvedValue({
        Account: '123456789012'
      });

      // Mock Step Functions response
      mockSFNClient.send.mockResolvedValue({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:test-execution'
      });

      const result = await service.startWorkflow(mockRequest, 'test-correlation-id');

      expect(result).toEqual({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:test-execution',
        executionName: expect.stringMatching(/^compliance-scan-\d+-[a-f0-9]{8}$/),
        stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:ComplianceScanWorkflow',
        status: 'RUNNING',
        startDate: expect.any(String),
        input: {
          correlationId: 'test-correlation-id',
          tenantId: 'test-tenant',
          workflowType: 'compliance-scan',
          parameters: {
            scanType: 'full',
            regions: ['us-east-1']
          },
          metadata: {
            startedBy: 'test-user',
            startedAt: expect.any(String)
          }
        },
        workflowType: 'compliance-scan',
        tenantId: 'test-tenant',
        correlationId: 'test-correlation-id'
      });

      expect(mockSFNClient.send).toHaveBeenCalledTimes(1);
      expect(mockSTSClient.send).toHaveBeenCalledTimes(1);
    });

    it('should throw error for unknown workflow type', async () => {
      const mockRequest: WorkflowRequest = {
        workflowType: 'unknown-workflow',
        tenantId: 'test-tenant'
      };

      await expect(
        service.startWorkflow(mockRequest, 'test-correlation-id')
      ).rejects.toThrow('Unknown workflow type: unknown-workflow');
    });

    it('should handle Step Functions errors', async () => {
      const mockRequest: WorkflowRequest = {
        workflowType: 'compliance-scan',
        tenantId: 'test-tenant'
      };

      // Mock STS response
      mockSTSClient.send.mockResolvedValue({
        Account: '123456789012'
      });

      // Mock Step Functions error
      mockSFNClient.send.mockRejectedValue(new Error('Step Functions error'));

      await expect(
        service.startWorkflow(mockRequest, 'test-correlation-id')
      ).rejects.toThrow('Failed to start workflow');
    });
  });

  describe('getWorkflowStatus', () => {
    it('should successfully get workflow status', async () => {
      const executionArn = 'arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:test-execution';

      const mockResponse = {
        status: 'SUCCEEDED',
        startDate: new Date('2024-01-15T10:00:00Z'),
        stopDate: new Date('2024-01-15T10:30:00Z'),
        input: JSON.stringify({
          tenantId: 'test-tenant',
          workflowType: 'compliance-scan'
        }),
        output: JSON.stringify({
          scanResults: { findingsCount: 5 }
        }),
        stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:ComplianceScanWorkflow'
      };

      mockSTSClient.send.mockResolvedValue(mockResponse);

      const result = await service.getWorkflowStatus(executionArn, 'test-correlation-id');

      expect(result).toEqual({
        executionArn,
        status: 'SUCCEEDED',
        startDate: '2024-01-15T10:00:00.000Z',
        stopDate: '2024-01-15T10:30:00.000Z',
        input: {
          tenantId: 'test-tenant',
          workflowType: 'compliance-scan'
        },
        output: {
          scanResults: { findingsCount: 5 }
        },
        stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:ComplianceScanWorkflow'
      });

      expect(mockSTSClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle execution not found error', async () => {
      const executionArn = 'arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:nonexistent';

      mockSTSClient.send.mockRejectedValue({
        name: 'ExecutionDoesNotExist',
        message: 'Execution does not exist'
      });

      await expect(
        service.getWorkflowStatus(executionArn, 'test-correlation-id')
      ).rejects.toThrow('Failed to get workflow status');
    });
  });

  describe('stopWorkflow', () => {
    it('should successfully stop workflow execution', async () => {
      const executionArn = 'arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:test-execution';

      mockSFNClient.send.mockResolvedValue({});

      const result = await service.stopWorkflow(executionArn, 'test-correlation-id');

      expect(result).toEqual({
        stopped: true,
        message: 'Workflow execution stopped successfully'
      });

      expect(mockSFNClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          executionArn,
          error: 'UserRequested',
          cause: 'Workflow stopped by user request'
        })
      );
    });

    it('should handle stop workflow errors', async () => {
      const executionArn = 'arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:test-execution';

      mockSFNClient.send.mockRejectedValue(new Error('Cannot stop execution'));

      await expect(
        service.stopWorkflow(executionArn, 'test-correlation-id')
      ).rejects.toThrow('Failed to stop workflow');
    });
  });

  describe('listWorkflowExecutions', () => {
    it('should successfully list workflow executions', async () => {
      const mockRequest = {
        tenantId: 'test-tenant',
        workflowType: 'compliance-scan',
        limit: 10
      };

      // Mock STS response
      mockSTSClient.send.mockResolvedValue({
        Account: '123456789012'
      });

      // Mock Step Functions list executions response
      mockSFNClient.send.mockResolvedValue({
        executions: [
          {
            executionArn: 'arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:exec-1',
            name: 'exec-1',
            stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:ComplianceScanWorkflow',
            status: 'SUCCEEDED',
            startDate: new Date('2024-01-15T10:00:00Z'),
            stopDate: new Date('2024-01-15T10:30:00Z'),
            input: JSON.stringify({
              tenantId: 'test-tenant',
              correlationId: 'corr-1'
            })
          },
          {
            executionArn: 'arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:exec-2',
            name: 'exec-2',
            stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:ComplianceScanWorkflow',
            status: 'RUNNING',
            startDate: new Date('2024-01-15T11:00:00Z'),
            input: JSON.stringify({
              tenantId: 'test-tenant',
              correlationId: 'corr-2'
            })
          }
        ]
      });

      const result = await service.listWorkflowExecutions(mockRequest, 'test-correlation-id');

      expect(result.executions).toHaveLength(2);
      expect(result.executions[0]).toEqual({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:exec-2',
        executionName: 'exec-2',
        stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:ComplianceScanWorkflow',
        status: 'RUNNING',
        startDate: '2024-01-15T11:00:00.000Z',
        stopDate: undefined,
        workflowType: 'compliance-scan',
        tenantId: 'test-tenant',
        correlationId: 'corr-2',
        input: {
          tenantId: 'test-tenant',
          correlationId: 'corr-2'
        }
      });

      expect(mockSFNClient.send).toHaveBeenCalledTimes(1);
      expect(mockSTSClient.send).toHaveBeenCalledTimes(1);
    });

    it('should filter executions by tenant ID', async () => {
      const mockRequest = {
        tenantId: 'specific-tenant',
        limit: 10
      };

      // Mock STS response
      mockSTSClient.send.mockResolvedValue({
        Account: '123456789012'
      });

      // Mock Step Functions response with mixed tenant IDs
      mockSFNClient.send.mockResolvedValue({
        executions: [
          {
            executionArn: 'arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:exec-1',
            name: 'exec-1',
            stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:ComplianceScanWorkflow',
            status: 'SUCCEEDED',
            startDate: new Date('2024-01-15T10:00:00Z'),
            input: JSON.stringify({
              tenantId: 'specific-tenant',
              correlationId: 'corr-1'
            })
          },
          {
            executionArn: 'arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:exec-2',
            name: 'exec-2',
            stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:ComplianceScanWorkflow',
            status: 'SUCCEEDED',
            startDate: new Date('2024-01-15T11:00:00Z'),
            input: JSON.stringify({
              tenantId: 'other-tenant',
              correlationId: 'corr-2'
            })
          }
        ]
      });

      const result = await service.listWorkflowExecutions(mockRequest, 'test-correlation-id');

      expect(result.executions).toHaveLength(1);
      expect(result.executions[0].tenantId).toBe('specific-tenant');
    });
  });

  describe('getWorkflowDefinitions', () => {
    it('should return all workflow definitions', async () => {
      const result = await service.getWorkflowDefinitions('test-correlation-id');

      expect(result).toHaveLength(6);
      expect(result.map(d => d.workflowType)).toEqual([
        'compliance-scan',
        'remediation',
        'compliance-assessment',
        'incident-response',
        'audit-pack-generation',
        'continuous-monitoring'
      ]);

      // Verify each definition has required properties
      result.forEach(definition => {
        expect(definition).toHaveProperty('workflowType');
        expect(definition).toHaveProperty('name');
        expect(definition).toHaveProperty('description');
        expect(definition).toHaveProperty('version');
        expect(definition).toHaveProperty('stateMachineName');
        expect(definition).toHaveProperty('requiredParameters');
        expect(definition).toHaveProperty('estimatedDuration');
        expect(definition).toHaveProperty('stateMachineDefinition');
      });
    });
  });

  describe('getWorkflowMetrics', () => {
    it('should calculate workflow metrics correctly', async () => {
      // Mock STS response
      mockSTSClient.send.mockResolvedValue({
        Account: '123456789012'
      });

      // Mock executions with different statuses
      mockSFNClient.send.mockResolvedValue({
        executions: [
          {
            executionArn: 'arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:exec-1',
            name: 'exec-1',
            stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:ComplianceScanWorkflow',
            status: 'SUCCEEDED',
            startDate: new Date('2024-01-15T10:00:00Z'),
            stopDate: new Date('2024-01-15T10:30:00Z'),
            input: JSON.stringify({ tenantId: 'test-tenant' })
          },
          {
            executionArn: 'arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:exec-2',
            name: 'exec-2',
            stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:ComplianceScanWorkflow',
            status: 'FAILED',
            startDate: new Date('2024-01-15T11:00:00Z'),
            stopDate: new Date('2024-01-15T11:15:00Z'),
            input: JSON.stringify({ tenantId: 'test-tenant' })
          },
          {
            executionArn: 'arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:exec-3',
            name: 'exec-3',
            stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:ComplianceScanWorkflow',
            status: 'RUNNING',
            startDate: new Date('2024-01-15T12:00:00Z'),
            input: JSON.stringify({ tenantId: 'test-tenant' })
          }
        ]
      });

      const result = await service.getWorkflowMetrics('compliance-scan', 'test-tenant', 'test-correlation-id');

      expect(result).toEqual({
        totalExecutions: 3,
        successfulExecutions: 1,
        failedExecutions: 1,
        runningExecutions: 1,
        averageExecutionTime: expect.any(Number)
      });

      // Average execution time should be calculated from completed executions
      // (30 minutes + 15 minutes) / 2 = 22.5 minutes = 1,350,000 ms
      expect(result.averageExecutionTime).toBe(1350000);
    });

    it('should handle empty execution list', async () => {
      // Mock STS response
      mockSTSClient.send.mockResolvedValue({
        Account: '123456789012'
      });

      // Mock empty executions
      mockSFNClient.send.mockResolvedValue({
        executions: []
      });

      const result = await service.getWorkflowMetrics('compliance-scan', 'test-tenant', 'test-correlation-id');

      expect(result).toEqual({
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        runningExecutions: 0,
        averageExecutionTime: 0
      });
    });
  });
});
