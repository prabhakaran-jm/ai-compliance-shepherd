import { BedrockAgentService } from '../src/services/BedrockAgentService';
import { ActionGroupService } from '../src/services/ActionGroupService';
import { AgentRequest, AgentResponse, AgentStatus } from '../src/types/agent';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-bedrock-agent');
jest.mock('@aws-sdk/client-bedrock-agent-runtime');
jest.mock('@aws-sdk/client-sts');

const mockBedrockAgentClient = {
  send: jest.fn()
};

const mockBedrockAgentRuntimeClient = {
  send: jest.fn()
};

const mockSTSClient = {
  send: jest.fn()
};

// Mock the AWS SDK constructors
const { BedrockAgentClient } = require('@aws-sdk/client-bedrock-agent');
const { BedrockAgentRuntimeClient } = require('@aws-sdk/client-bedrock-agent-runtime');
const { STSClient } = require('@aws-sdk/client-sts');

BedrockAgentClient.mockImplementation(() => mockBedrockAgentClient);
BedrockAgentRuntimeClient.mockImplementation(() => mockBedrockAgentRuntimeClient);
STSClient.mockImplementation(() => mockSTSClient);

describe('BedrockAgentService', () => {
  let service: BedrockAgentService;
  let mockActionGroupService: jest.Mocked<ActionGroupService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set environment variables
    process.env.BEDROCK_AGENT_ID = 'test-agent-id';
    process.env.BEDROCK_AGENT_ALIAS_ID = 'test-alias-id';
    process.env.AWS_REGION = 'us-east-1';

    service = new BedrockAgentService();
    
    // Mock ActionGroupService
    mockActionGroupService = {
      getActionGroupDefinitions: jest.fn()
    } as any;
  });

  afterEach(() => {
    delete process.env.BEDROCK_AGENT_ID;
    delete process.env.BEDROCK_AGENT_ALIAS_ID;
    delete process.env.AWS_REGION;
  });

  describe('invokeAgent', () => {
    it('should successfully invoke agent', async () => {
      const mockRequest: AgentRequest = {
        sessionId: 'test-session-id',
        inputText: 'Test input',
        enableTrace: false
      };

      const mockCompletion = {
        completion: {
          async *[Symbol.asyncIterator]() {
            yield {
              chunk: {
                bytes: new TextEncoder().encode('Test response')
              }
            };
          }
        }
      };

      mockBedrockAgentRuntimeClient.send.mockResolvedValue(mockCompletion);

      const result = await service.invokeAgent(mockRequest, 'test-correlation-id');

      expect(result).toEqual({
        sessionId: 'test-session-id',
        response: 'Test response',
        traces: undefined,
        timestamp: expect.any(String)
      });

      expect(mockBedrockAgentRuntimeClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle agent invocation with traces', async () => {
      const mockRequest: AgentRequest = {
        sessionId: 'test-session-id',
        inputText: 'Test input',
        enableTrace: true
      };

      const mockTrace = { traceId: 'test-trace' };
      const mockCompletion = {
        completion: {
          async *[Symbol.asyncIterator]() {
            yield {
              chunk: {
                bytes: new TextEncoder().encode('Test response')
              },
              trace: mockTrace
            };
          }
        }
      };

      mockBedrockAgentRuntimeClient.send.mockResolvedValue(mockCompletion);

      const result = await service.invokeAgent(mockRequest, 'test-correlation-id');

      expect(result).toEqual({
        sessionId: 'test-session-id',
        response: 'Test response',
        traces: [mockTrace],
        timestamp: expect.any(String)
      });
    });

    it('should throw error when agent not configured', async () => {
      delete process.env.BEDROCK_AGENT_ID;
      service = new BedrockAgentService();

      const mockRequest: AgentRequest = {
        inputText: 'Test input'
      };

      await expect(
        service.invokeAgent(mockRequest, 'test-correlation-id')
      ).rejects.toThrow('Agent not configured');
    });

    it('should handle agent invocation errors', async () => {
      const mockRequest: AgentRequest = {
        inputText: 'Test input'
      };

      mockBedrockAgentRuntimeClient.send.mockRejectedValue(
        new Error('Bedrock service error')
      );

      await expect(
        service.invokeAgent(mockRequest, 'test-correlation-id')
      ).rejects.toThrow('Failed to invoke agent');
    });
  });

  describe('chatWithAgent', () => {
    it('should successfully chat with agent', async () => {
      const mockRequest: AgentRequest = {
        sessionId: 'test-session-id',
        inputText: 'Test question'
      };

      const mockResponse = {
        sessionId: 'test-session-id',
        output: {
          text: 'Test answer'
        },
        citations: []
      };

      mockBedrockAgentRuntimeClient.send.mockResolvedValue(mockResponse);

      const result = await service.chatWithAgent(mockRequest, 'test-correlation-id');

      expect(result).toEqual({
        sessionId: 'test-session-id',
        response: 'Test answer',
        citations: [],
        timestamp: expect.any(String)
      });

      expect(mockBedrockAgentRuntimeClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle chat errors', async () => {
      const mockRequest: AgentRequest = {
        inputText: 'Test question'
      };

      mockBedrockAgentRuntimeClient.send.mockRejectedValue(
        new Error('Knowledge base error')
      );

      await expect(
        service.chatWithAgent(mockRequest, 'test-correlation-id')
      ).rejects.toThrow('Failed to chat with agent');
    });
  });

  describe('getAgentStatus', () => {
    it('should return agent status when configured', async () => {
      const mockAgent = {
        agent: {
          agentName: 'Test Agent',
          agentStatus: 'PREPARED',
          foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
          instruction: 'Test instruction',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02')
        }
      };

      const mockActionGroups = {
        actionGroupSummaries: [
          {
            actionGroupId: 'ag-1',
            actionGroupName: 'TestActionGroup',
            actionGroupState: 'ENABLED',
            description: 'Test action group'
          }
        ]
      };

      mockBedrockAgentClient.send
        .mockResolvedValueOnce(mockAgent)
        .mockResolvedValueOnce(mockActionGroups);

      const result = await service.getAgentStatus('test-correlation-id');

      expect(result).toEqual({
        configured: true,
        agentId: 'test-agent-id',
        agentName: 'Test Agent',
        agentStatus: 'PREPARED',
        foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
        instruction: 'Test instruction',
        actionGroups: [
          {
            actionGroupId: 'ag-1',
            actionGroupName: 'TestActionGroup',
            actionGroupState: 'ENABLED',
            description: 'Test action group'
          }
        ],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z'
      });
    });

    it('should return not configured when agent ID missing', async () => {
      delete process.env.BEDROCK_AGENT_ID;
      service = new BedrockAgentService();

      const result = await service.getAgentStatus('test-correlation-id');

      expect(result).toEqual({
        configured: false,
        message: 'Agent not configured'
      });
    });

    it('should handle agent status errors', async () => {
      mockBedrockAgentClient.send.mockRejectedValue(
        new Error('Agent not found')
      );

      const result = await service.getAgentStatus('test-correlation-id');

      expect(result).toEqual({
        configured: false,
        message: 'Error: Agent not found'
      });
    });
  });

  describe('listSessions', () => {
    it('should return placeholder session list', async () => {
      const result = await service.listSessions('test-agent-id', 'test-correlation-id');

      expect(result).toEqual({
        sessions: [],
        message: 'Session listing not implemented - sessions are ephemeral'
      });
    });
  });

  describe('prepareAgent', () => {
    it('should successfully prepare new agent', async () => {
      // Mock STS response
      mockSTSClient.send.mockResolvedValue({
        Account: '123456789012'
      });

      // Mock create agent response
      const mockCreateAgentResponse = {
        agent: {
          agentId: 'new-agent-id'
        }
      };

      // Mock action group definitions
      const mockActionGroups = [
        {
          actionGroupName: 'TestActionGroup',
          description: 'Test action group',
          actionGroupExecutor: {
            lambda: 'arn:aws:lambda:us-east-1:123456789012:function:test'
          },
          apiSchema: {
            payload: JSON.stringify({ openapi: '3.0.0' })
          }
        }
      ];

      // Mock list action groups (empty for new agent)
      const mockListActionGroups = {
        actionGroupSummaries: []
      };

      // Mock create action group response
      const mockCreateActionGroupResponse = {
        agentActionGroup: {
          actionGroupId: 'ag-1'
        }
      };

      // Mock create alias response
      const mockCreateAliasResponse = {
        agentAlias: {
          agentAliasId: 'alias-1'
        }
      };

      // Set up mocks
      delete process.env.BEDROCK_AGENT_ID; // Simulate no existing agent
      service = new BedrockAgentService();
      
      // Mock ActionGroupService
      (service as any).actionGroupService = {
        getActionGroupDefinitions: jest.fn().mockReturnValue(mockActionGroups)
      };

      mockBedrockAgentClient.send
        .mockResolvedValueOnce(mockCreateAgentResponse) // CreateAgent
        .mockResolvedValueOnce(mockListActionGroups) // ListActionGroups
        .mockResolvedValueOnce(mockCreateActionGroupResponse) // CreateActionGroup
        .mockResolvedValueOnce({}) // PrepareAgent
        .mockResolvedValueOnce(mockCreateAliasResponse); // CreateAlias

      const result = await service.prepareAgent('test-correlation-id');

      expect(result).toEqual({
        agentId: 'new-agent-id',
        agentAliasId: 'alias-1',
        actionGroups: [
          {
            actionGroupId: 'ag-1',
            actionGroupName: 'TestActionGroup',
            status: 'created'
          }
        ],
        status: 'prepared',
        message: 'Agent and action groups configured successfully'
      });

      expect(mockSTSClient.send).toHaveBeenCalledTimes(1);
      expect(mockBedrockAgentClient.send).toHaveBeenCalledTimes(5);
    });

    it('should handle prepare agent errors', async () => {
      mockSTSClient.send.mockRejectedValue(
        new Error('STS error')
      );

      await expect(
        service.prepareAgent('test-correlation-id')
      ).rejects.toThrow('Failed to prepare agent');
    });
  });
});

describe('ActionGroupService', () => {
  let actionGroupService: ActionGroupService;

  beforeEach(() => {
    actionGroupService = new ActionGroupService();
  });

  describe('getActionGroupDefinitions', () => {
    it('should return all action group definitions', () => {
      const definitions = actionGroupService.getActionGroupDefinitions();

      expect(definitions).toHaveLength(6);
      expect(definitions.map(d => d.actionGroupName)).toEqual([
        'ScanActions',
        'FindingsActions',
        'RemediationActions',
        'ReportingActions',
        'TerraformActions',
        'S3ManagementActions'
      ]);

      // Verify each action group has required properties
      definitions.forEach(definition => {
        expect(definition).toHaveProperty('actionGroupName');
        expect(definition).toHaveProperty('description');
        expect(definition).toHaveProperty('actionGroupExecutor');
        expect(definition).toHaveProperty('apiSchema');
        expect(definition.actionGroupExecutor).toHaveProperty('lambda');
        expect(definition.apiSchema).toHaveProperty('payload');
        
        // Verify API schema is valid JSON
        expect(() => JSON.parse(definition.apiSchema.payload)).not.toThrow();
      });
    });

    it('should have valid OpenAPI schemas for all action groups', () => {
      const definitions = actionGroupService.getActionGroupDefinitions();

      definitions.forEach(definition => {
        const schema = JSON.parse(definition.apiSchema.payload);
        
        expect(schema).toHaveProperty('openapi');
        expect(schema).toHaveProperty('info');
        expect(schema).toHaveProperty('paths');
        expect(schema.openapi).toBe('3.0.0');
        expect(schema.info).toHaveProperty('title');
        expect(schema.info).toHaveProperty('version');
        
        // Verify paths have operations
        Object.values(schema.paths).forEach((path: any) => {
          const operations = Object.keys(path);
          expect(operations.length).toBeGreaterThan(0);
          
          operations.forEach(operation => {
            expect(path[operation]).toHaveProperty('summary');
            expect(path[operation]).toHaveProperty('operationId');
            expect(path[operation]).toHaveProperty('responses');
          });
        });
      });
    });
  });
});
