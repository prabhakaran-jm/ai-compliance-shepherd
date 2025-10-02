import {
  BedrockAgentClient,
  CreateAgentCommand,
  UpdateAgentCommand,
  GetAgentCommand,
  PrepareAgentCommand,
  CreateAgentActionGroupCommand,
  UpdateAgentActionGroupCommand,
  ListAgentActionGroupsCommand,
  CreateAgentAliasCommand,
  UpdateAgentAliasCommand,
  GetAgentAliasCommand
} from '@aws-sdk/client-bedrock-agent';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
  RetrieveAndGenerateCommand
} from '@aws-sdk/client-bedrock-agent-runtime';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { logger } from '../utils/logger';
import { ComplianceAgentError } from '../utils/errorHandler';
import { 
  AgentRequest, 
  AgentResponse, 
  AgentStatus,
  ActionGroupDefinition 
} from '../types/agent';
import { ActionGroupService } from './ActionGroupService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for managing Bedrock Agent operations
 * Handles agent creation, action groups, and invocations
 */
export class BedrockAgentService {
  private bedrockAgentClient: BedrockAgentClient;
  private bedrockAgentRuntimeClient: BedrockAgentRuntimeClient;
  private stsClient: STSClient;
  private actionGroupService: ActionGroupService;
  private agentId?: string;
  private agentAliasId?: string;

  constructor() {
    this.bedrockAgentClient = new BedrockAgentClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.bedrockAgentRuntimeClient = new BedrockAgentRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.stsClient = new STSClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.actionGroupService = new ActionGroupService();
    
    // Get agent configuration from environment
    this.agentId = process.env.BEDROCK_AGENT_ID;
    this.agentAliasId = process.env.BEDROCK_AGENT_ALIAS_ID || 'TSTALIASID';
  }

  /**
   * Invoke the Bedrock agent with a request
   */
  async invokeAgent(request: AgentRequest, correlationId: string): Promise<AgentResponse> {
    try {
      logger.info('Invoking Bedrock agent', {
        correlationId,
        agentId: this.agentId,
        sessionId: request.sessionId
      });

      if (!this.agentId) {
        throw new ComplianceAgentError('Agent not configured. Run prepare-agent first.');
      }

      const command = new InvokeAgentCommand({
        agentId: this.agentId,
        agentAliasId: this.agentAliasId,
        sessionId: request.sessionId || uuidv4(),
        inputText: request.inputText,
        enableTrace: request.enableTrace || false,
        endSession: request.endSession || false
      });

      const response = await this.bedrockAgentRuntimeClient.send(command);
      
      // Process the streaming response
      const chunks: string[] = [];
      const traces: any[] = [];
      
      if (response.completion) {
        for await (const chunk of response.completion) {
          if (chunk.chunk?.bytes) {
            const text = new TextDecoder().decode(chunk.chunk.bytes);
            chunks.push(text);
          }
          
          if (chunk.trace) {
            traces.push(chunk.trace);
          }
        }
      }

      const result: AgentResponse = {
        sessionId: request.sessionId || uuidv4(),
        response: chunks.join(''),
        traces: request.enableTrace ? traces : undefined,
        timestamp: new Date().toISOString()
      };

      logger.info('Agent invocation completed', {
        correlationId,
        sessionId: result.sessionId,
        responseLength: result.response.length,
        traceCount: traces.length
      });

      return result;

    } catch (error) {
      logger.error('Error invoking agent', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new ComplianceAgentError(
        `Failed to invoke agent: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Chat with the agent using retrieve and generate
   */
  async chatWithAgent(request: AgentRequest, correlationId: string): Promise<AgentResponse> {
    try {
      logger.info('Starting chat with agent', {
        correlationId,
        sessionId: request.sessionId
      });

      const command = new RetrieveAndGenerateCommand({
        input: {
          text: request.inputText
        },
        retrieveAndGenerateConfiguration: {
          type: 'KNOWLEDGE_BASE',
          knowledgeBaseConfiguration: {
            knowledgeBaseId: process.env.BEDROCK_KNOWLEDGE_BASE_ID,
            modelArn: `arn:aws:bedrock:${process.env.AWS_REGION}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`
          }
        },
        sessionId: request.sessionId
      });

      const response = await this.bedrockAgentRuntimeClient.send(command);

      const result: AgentResponse = {
        sessionId: response.sessionId || request.sessionId || uuidv4(),
        response: response.output?.text || '',
        citations: response.citations,
        timestamp: new Date().toISOString()
      };

      logger.info('Chat completed', {
        correlationId,
        sessionId: result.sessionId,
        responseLength: result.response.length,
        citationCount: result.citations?.length || 0
      });

      return result;

    } catch (error) {
      logger.error('Error in chat', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new ComplianceAgentError(
        `Failed to chat with agent: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get agent status and configuration
   */
  async getAgentStatus(correlationId: string): Promise<AgentStatus> {
    try {
      logger.info('Getting agent status', { correlationId });

      if (!this.agentId) {
        return {
          configured: false,
          message: 'Agent not configured'
        };
      }

      const command = new GetAgentCommand({
        agentId: this.agentId
      });

      const response = await this.bedrockAgentClient.send(command);
      
      // Get action groups
      const actionGroupsCommand = new ListAgentActionGroupsCommand({
        agentId: this.agentId
      });
      const actionGroupsResponse = await this.bedrockAgentClient.send(actionGroupsCommand);

      const status: AgentStatus = {
        configured: true,
        agentId: this.agentId,
        agentName: response.agent?.agentName,
        agentStatus: response.agent?.agentStatus,
        foundationModel: response.agent?.foundationModel,
        instruction: response.agent?.instruction,
        actionGroups: actionGroupsResponse.actionGroupSummaries?.map(ag => ({
          actionGroupId: ag.actionGroupId!,
          actionGroupName: ag.actionGroupName!,
          actionGroupState: ag.actionGroupState!,
          description: ag.description
        })) || [],
        createdAt: response.agent?.createdAt?.toISOString(),
        updatedAt: response.agent?.updatedAt?.toISOString()
      };

      logger.info('Agent status retrieved', {
        correlationId,
        configured: status.configured,
        actionGroupCount: status.actionGroups?.length || 0
      });

      return status;

    } catch (error) {
      logger.error('Error getting agent status', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        configured: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * List agent sessions
   */
  async listSessions(agentId: string, correlationId: string): Promise<any> {
    try {
      logger.info('Listing agent sessions', { correlationId, agentId });

      // Note: Bedrock Agent doesn't have a direct API to list sessions
      // This would typically be implemented using DynamoDB or another storage
      // For now, return a placeholder response
      
      return {
        sessions: [],
        message: 'Session listing not implemented - sessions are ephemeral'
      };

    } catch (error) {
      logger.error('Error listing sessions', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new ComplianceAgentError(
        `Failed to list sessions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Prepare the agent (create/update agent and action groups)
   */
  async prepareAgent(correlationId: string): Promise<any> {
    try {
      logger.info('Preparing Bedrock agent', { correlationId });

      // Get AWS account ID for IAM role ARN
      const identity = await this.stsClient.send(new GetCallerIdentityCommand({}));
      const accountId = identity.Account;
      const region = process.env.AWS_REGION || 'us-east-1';

      // Create or update the agent
      let agentId = this.agentId;
      
      if (!agentId) {
        // Create new agent
        const createAgentCommand = new CreateAgentCommand({
          agentName: 'AI-Compliance-Shepherd-Agent',
          description: 'AI agent for cloud compliance management and remediation',
          foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
          instruction: `You are an AI compliance assistant for cloud infrastructure. You help users:

1. **Scan and Assess**: Analyze AWS environments for compliance violations
2. **Remediate Issues**: Apply fixes to resolve security and compliance problems  
3. **Generate Reports**: Create detailed compliance reports and audit documentation
4. **Answer Questions**: Provide guidance on compliance frameworks like SOC 2, HIPAA, GDPR
5. **Terraform Analysis**: Review infrastructure-as-code for compliance issues

You have access to action groups that can:
- Start environment scans
- Retrieve and analyze findings
- Apply automated fixes with safety checks
- Generate HTML reports
- Analyze Terraform plans
- Manage S3 buckets and configurations

Always prioritize security and follow the principle of least privilege. When applying fixes, explain what will be changed and ask for confirmation for high-risk operations.`,
          agentResourceRoleArn: `arn:aws:iam::${accountId}:role/BedrockAgentRole`,
          idleSessionTTLInSeconds: 3600
        });

        const createResponse = await this.bedrockAgentClient.send(createAgentCommand);
        agentId = createResponse.agent?.agentId;
        
        if (!agentId) {
          throw new ComplianceAgentError('Failed to create agent');
        }

        logger.info('Created new agent', { correlationId, agentId });
      } else {
        // Update existing agent
        const updateAgentCommand = new UpdateAgentCommand({
          agentId,
          agentName: 'AI-Compliance-Shepherd-Agent',
          description: 'AI agent for cloud compliance management and remediation',
          foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
          instruction: `You are an AI compliance assistant for cloud infrastructure. You help users:

1. **Scan and Assess**: Analyze AWS environments for compliance violations
2. **Remediate Issues**: Apply fixes to resolve security and compliance problems  
3. **Generate Reports**: Create detailed compliance reports and audit documentation
4. **Answer Questions**: Provide guidance on compliance frameworks like SOC 2, HIPAA, GDPR
5. **Terraform Analysis**: Review infrastructure-as-code for compliance issues

You have access to action groups that can:
- Start environment scans
- Retrieve and analyze findings
- Apply automated fixes with safety checks
- Generate HTML reports
- Analyze Terraform plans
- Manage S3 buckets and configurations

Always prioritize security and follow the principle of least privilege. When applying fixes, explain what will be changed and ask for confirmation for high-risk operations.`,
          agentResourceRoleArn: `arn:aws:iam::${accountId}:role/BedrockAgentRole`
        });

        await this.bedrockAgentClient.send(updateAgentCommand);
        logger.info('Updated existing agent', { correlationId, agentId });
      }

      // Create/update action groups
      const actionGroups = this.actionGroupService.getActionGroupDefinitions();
      const createdActionGroups = [];

      for (const actionGroup of actionGroups) {
        try {
          const actionGroupResult = await this.createOrUpdateActionGroup(
            agentId, 
            actionGroup, 
            correlationId
          );
          createdActionGroups.push(actionGroupResult);
        } catch (error) {
          logger.warn('Failed to create action group', {
            correlationId,
            actionGroupName: actionGroup.actionGroupName,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Prepare the agent
      const prepareCommand = new PrepareAgentCommand({
        agentId
      });
      await this.bedrockAgentClient.send(prepareCommand);

      // Create or update agent alias
      try {
        if (this.agentAliasId && this.agentAliasId !== 'TSTALIASID') {
          const updateAliasCommand = new UpdateAgentAliasCommand({
            agentId,
            agentAliasId: this.agentAliasId,
            agentAliasName: 'production',
            description: 'Production alias for AI Compliance Shepherd agent'
          });
          await this.bedrockAgentClient.send(updateAliasCommand);
        } else {
          const createAliasCommand = new CreateAgentAliasCommand({
            agentId,
            agentAliasName: 'production',
            description: 'Production alias for AI Compliance Shepherd agent'
          });
          const aliasResponse = await this.bedrockAgentClient.send(createAliasCommand);
          this.agentAliasId = aliasResponse.agentAlias?.agentAliasId;
        }
      } catch (error) {
        logger.warn('Failed to create/update agent alias', {
          correlationId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      const result = {
        agentId,
        agentAliasId: this.agentAliasId,
        actionGroups: createdActionGroups,
        status: 'prepared',
        message: 'Agent and action groups configured successfully'
      };

      logger.info('Agent preparation completed', {
        correlationId,
        agentId,
        actionGroupCount: createdActionGroups.length
      });

      return result;

    } catch (error) {
      logger.error('Error preparing agent', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new ComplianceAgentError(
        `Failed to prepare agent: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create or update an action group
   */
  private async createOrUpdateActionGroup(
    agentId: string,
    actionGroup: ActionGroupDefinition,
    correlationId: string
  ): Promise<any> {
    try {
      // Check if action group exists
      const listCommand = new ListAgentActionGroupsCommand({
        agentId
      });
      const listResponse = await this.bedrockAgentClient.send(listCommand);
      
      const existingActionGroup = listResponse.actionGroupSummaries?.find(
        ag => ag.actionGroupName === actionGroup.actionGroupName
      );

      if (existingActionGroup) {
        // Update existing action group
        const updateCommand = new UpdateAgentActionGroupCommand({
          agentId,
          actionGroupId: existingActionGroup.actionGroupId,
          actionGroupName: actionGroup.actionGroupName,
          description: actionGroup.description,
          actionGroupExecutor: actionGroup.actionGroupExecutor,
          apiSchema: actionGroup.apiSchema,
          actionGroupState: 'ENABLED'
        });

        const response = await this.bedrockAgentClient.send(updateCommand);
        
        logger.info('Updated action group', {
          correlationId,
          actionGroupName: actionGroup.actionGroupName,
          actionGroupId: existingActionGroup.actionGroupId
        });

        return {
          actionGroupId: existingActionGroup.actionGroupId,
          actionGroupName: actionGroup.actionGroupName,
          status: 'updated'
        };
      } else {
        // Create new action group
        const createCommand = new CreateAgentActionGroupCommand({
          agentId,
          actionGroupName: actionGroup.actionGroupName,
          description: actionGroup.description,
          actionGroupExecutor: actionGroup.actionGroupExecutor,
          apiSchema: actionGroup.apiSchema,
          actionGroupState: 'ENABLED'
        });

        const response = await this.bedrockAgentClient.send(createCommand);
        
        logger.info('Created action group', {
          correlationId,
          actionGroupName: actionGroup.actionGroupName,
          actionGroupId: response.agentActionGroup?.actionGroupId
        });

        return {
          actionGroupId: response.agentActionGroup?.actionGroupId,
          actionGroupName: actionGroup.actionGroupName,
          status: 'created'
        };
      }

    } catch (error) {
      logger.error('Error creating/updating action group', {
        correlationId,
        actionGroupName: actionGroup.actionGroupName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}
