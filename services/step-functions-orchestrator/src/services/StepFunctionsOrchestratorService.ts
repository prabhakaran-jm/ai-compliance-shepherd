import {
  SFNClient,
  StartExecutionCommand,
  DescribeExecutionCommand,
  StopExecutionCommand,
  ListExecutionsCommand,
  DescribeStateMachineCommand
} from '@aws-sdk/client-sfn';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { logger } from '../utils/logger';
import { WorkflowOrchestratorError } from '../utils/errorHandler';
import { 
  WorkflowRequest,
  WorkflowExecution,
  WorkflowDefinition,
  WorkflowListRequest,
  WorkflowStatus
} from '../types/workflow';
import { WorkflowDefinitionService } from './WorkflowDefinitionService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for orchestrating Step Functions workflows
 * Manages workflow execution, monitoring, and coordination
 */
export class StepFunctionsOrchestratorService {
  private sfnClient: SFNClient;
  private stsClient: STSClient;
  private workflowDefinitionService: WorkflowDefinitionService;
  private accountId?: string;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.sfnClient = new SFNClient({ region: this.region });
    this.stsClient = new STSClient({ region: this.region });
    this.workflowDefinitionService = new WorkflowDefinitionService();
  }

  /**
   * Start a workflow execution
   */
  async startWorkflow(request: WorkflowRequest, correlationId: string): Promise<WorkflowExecution> {
    try {
      logger.info('Starting workflow execution', {
        correlationId,
        workflowType: request.workflowType,
        tenantId: request.tenantId
      });

      // Get workflow definition
      const definition = this.workflowDefinitionService.getWorkflowDefinition(request.workflowType);
      if (!definition) {
        throw new WorkflowOrchestratorError(`Unknown workflow type: ${request.workflowType}`);
      }

      // Get account ID if not cached
      if (!this.accountId) {
        const identity = await this.stsClient.send(new GetCallerIdentityCommand({}));
        this.accountId = identity.Account;
      }

      // Build state machine ARN
      const stateMachineArn = `arn:aws:states:${this.region}:${this.accountId}:stateMachine:${definition.stateMachineName}`;

      // Prepare execution input
      const executionInput = {
        correlationId,
        tenantId: request.tenantId,
        workflowType: request.workflowType,
        parameters: request.parameters || {},
        metadata: {
          startedBy: request.startedBy || 'system',
          startedAt: new Date().toISOString(),
          ...request.metadata
        }
      };

      // Generate execution name
      const executionName = `${request.workflowType}-${Date.now()}-${uuidv4().substring(0, 8)}`;

      // Start execution
      const command = new StartExecutionCommand({
        stateMachineArn,
        name: executionName,
        input: JSON.stringify(executionInput)
      });

      const response = await this.sfnClient.send(command);

      const execution: WorkflowExecution = {
        executionArn: response.executionArn!,
        executionName,
        stateMachineArn,
        status: 'RUNNING',
        startDate: new Date().toISOString(),
        input: executionInput,
        workflowType: request.workflowType,
        tenantId: request.tenantId,
        correlationId
      };

      logger.info('Workflow execution started', {
        correlationId,
        executionArn: execution.executionArn,
        workflowType: request.workflowType,
        tenantId: request.tenantId
      });

      return execution;

    } catch (error) {
      logger.error('Error starting workflow execution', {
        correlationId,
        workflowType: request.workflowType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new WorkflowOrchestratorError(
        `Failed to start workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get workflow execution status
   */
  async getWorkflowStatus(executionArn: string, correlationId: string): Promise<WorkflowStatus> {
    try {
      logger.info('Getting workflow status', {
        correlationId,
        executionArn
      });

      const command = new DescribeExecutionCommand({
        executionArn
      });

      const response = await this.stsClient.send(command);

      const status: WorkflowStatus = {
        executionArn,
        status: response.status!,
        startDate: response.startDate?.toISOString(),
        stopDate: response.stopDate?.toISOString(),
        input: response.input ? JSON.parse(response.input) : undefined,
        output: response.output ? JSON.parse(response.output) : undefined,
        error: response.error,
        cause: response.cause,
        stateMachineArn: response.stateMachineArn!
      };

      // Add execution history if needed
      if (status.status === 'FAILED' || status.status === 'TIMED_OUT' || status.status === 'ABORTED') {
        status.executionHistory = await this.getExecutionHistory(executionArn);
      }

      logger.info('Workflow status retrieved', {
        correlationId,
        executionArn,
        status: status.status
      });

      return status;

    } catch (error) {
      logger.error('Error getting workflow status', {
        correlationId,
        executionArn,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new WorkflowOrchestratorError(
        `Failed to get workflow status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Stop workflow execution
   */
  async stopWorkflow(executionArn: string, correlationId: string): Promise<{ stopped: boolean; message: string }> {
    try {
      logger.info('Stopping workflow execution', {
        correlationId,
        executionArn
      });

      const command = new StopExecutionCommand({
        executionArn,
        error: 'UserRequested',
        cause: 'Workflow stopped by user request'
      });

      await this.sfnClient.send(command);

      logger.info('Workflow execution stopped', {
        correlationId,
        executionArn
      });

      return {
        stopped: true,
        message: 'Workflow execution stopped successfully'
      };

    } catch (error) {
      logger.error('Error stopping workflow execution', {
        correlationId,
        executionArn,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new WorkflowOrchestratorError(
        `Failed to stop workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * List workflow executions
   */
  async listWorkflowExecutions(
    request: WorkflowListRequest,
    correlationId: string
  ): Promise<{ executions: WorkflowExecution[]; nextToken?: string }> {
    try {
      logger.info('Listing workflow executions', {
        correlationId,
        tenantId: request.tenantId,
        workflowType: request.workflowType,
        status: request.status
      });

      // Get all workflow definitions to build state machine ARNs
      const definitions = this.workflowDefinitionService.getAllWorkflowDefinitions();
      
      // Filter definitions by workflow type if specified
      const targetDefinitions = request.workflowType 
        ? definitions.filter(d => d.workflowType === request.workflowType)
        : definitions;

      if (!this.accountId) {
        const identity = await this.stsClient.send(new GetCallerIdentityCommand({}));
        this.accountId = identity.Account;
      }

      const allExecutions: WorkflowExecution[] = [];

      // List executions for each state machine
      for (const definition of targetDefinitions) {
        const stateMachineArn = `arn:aws:states:${this.region}:${this.accountId}:stateMachine:${definition.stateMachineName}`;

        const command = new ListExecutionsCommand({
          stateMachineArn,
          statusFilter: request.status,
          maxResults: request.limit || 50
        });

        const response = await this.sfnClient.send(command);

        if (response.executions) {
          for (const exec of response.executions) {
            const execution: WorkflowExecution = {
              executionArn: exec.executionArn!,
              executionName: exec.name!,
              stateMachineArn: exec.stateMachineArn!,
              status: exec.status!,
              startDate: exec.startDate?.toISOString(),
              stopDate: exec.stopDate?.toISOString(),
              workflowType: definition.workflowType,
              tenantId: 'unknown', // Will be extracted from input if available
              correlationId: 'unknown'
            };

            // Try to extract tenant ID and correlation ID from input
            if (exec.input) {
              try {
                const input = JSON.parse(exec.input);
                execution.tenantId = input.tenantId || 'unknown';
                execution.correlationId = input.correlationId || 'unknown';
                execution.input = input;
              } catch (error) {
                // Ignore parsing errors
              }
            }

            // Filter by tenant ID if specified
            if (!request.tenantId || execution.tenantId === request.tenantId) {
              allExecutions.push(execution);
            }
          }
        }
      }

      // Sort by start date (newest first)
      allExecutions.sort((a, b) => {
        const dateA = new Date(a.startDate || 0).getTime();
        const dateB = new Date(b.startDate || 0).getTime();
        return dateB - dateA;
      });

      // Apply limit
      const limitedExecutions = allExecutions.slice(0, request.limit || 50);

      logger.info('Workflow executions listed', {
        correlationId,
        executionCount: limitedExecutions.length,
        totalFound: allExecutions.length
      });

      return {
        executions: limitedExecutions
      };

    } catch (error) {
      logger.error('Error listing workflow executions', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new WorkflowOrchestratorError(
        `Failed to list workflow executions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get available workflow definitions
   */
  async getWorkflowDefinitions(correlationId: string): Promise<WorkflowDefinition[]> {
    try {
      logger.info('Getting workflow definitions', { correlationId });

      const definitions = this.workflowDefinitionService.getAllWorkflowDefinitions();

      logger.info('Workflow definitions retrieved', {
        correlationId,
        definitionCount: definitions.length
      });

      return definitions;

    } catch (error) {
      logger.error('Error getting workflow definitions', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new WorkflowOrchestratorError(
        `Failed to get workflow definitions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get execution history for failed workflows
   */
  private async getExecutionHistory(executionArn: string): Promise<any[]> {
    try {
      // Note: This would use GetExecutionHistoryCommand in a full implementation
      // For now, return empty array
      return [];

    } catch (error) {
      logger.warn('Failed to get execution history', {
        executionArn,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Validate workflow input
   */
  private validateWorkflowInput(workflowType: string, input: any): void {
    const definition = this.workflowDefinitionService.getWorkflowDefinition(workflowType);
    if (!definition) {
      throw new WorkflowOrchestratorError(`Unknown workflow type: ${workflowType}`);
    }

    // Validate required parameters
    if (definition.requiredParameters) {
      for (const param of definition.requiredParameters) {
        if (!input.parameters || input.parameters[param] === undefined) {
          throw new WorkflowOrchestratorError(`Missing required parameter: ${param}`);
        }
      }
    }

    // Validate parameter types if schema is defined
    if (definition.parameterSchema) {
      // This would use a schema validation library like Joi or Zod
      // For now, skip detailed validation
    }
  }

  /**
   * Get workflow metrics
   */
  async getWorkflowMetrics(
    workflowType?: string,
    tenantId?: string,
    correlationId?: string
  ): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    runningExecutions: number;
    averageExecutionTime: number;
  }> {
    try {
      const executions = await this.listWorkflowExecutions({
        workflowType,
        tenantId,
        limit: 1000
      }, correlationId || 'metrics');

      const total = executions.executions.length;
      const successful = executions.executions.filter(e => e.status === 'SUCCEEDED').length;
      const failed = executions.executions.filter(e => e.status === 'FAILED').length;
      const running = executions.executions.filter(e => e.status === 'RUNNING').length;

      // Calculate average execution time for completed executions
      const completedExecutions = executions.executions.filter(e => 
        e.startDate && e.stopDate && (e.status === 'SUCCEEDED' || e.status === 'FAILED')
      );

      let averageExecutionTime = 0;
      if (completedExecutions.length > 0) {
        const totalTime = completedExecutions.reduce((sum, exec) => {
          const start = new Date(exec.startDate!).getTime();
          const stop = new Date(exec.stopDate!).getTime();
          return sum + (stop - start);
        }, 0);
        averageExecutionTime = totalTime / completedExecutions.length;
      }

      return {
        totalExecutions: total,
        successfulExecutions: successful,
        failedExecutions: failed,
        runningExecutions: running,
        averageExecutionTime
      };

    } catch (error) {
      logger.error('Error getting workflow metrics', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        runningExecutions: 0,
        averageExecutionTime: 0
      };
    }
  }
}
