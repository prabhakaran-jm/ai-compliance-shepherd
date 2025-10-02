import { ChatInterfaceService } from '../src/services/ChatInterfaceService';
import { ChatMessage, ChatSession, ChatResponse } from '../src/types/chat';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-lambda');
jest.mock('@aws-sdk/client-s3');

const mockLambdaClient = {
  send: jest.fn()
};

const mockS3Client = {
  send: jest.fn()
};

// Mock the AWS SDK constructors
const { LambdaClient } = require('@aws-sdk/client-lambda');
const { S3Client } = require('@aws-sdk/client-s3');

LambdaClient.mockImplementation(() => mockLambdaClient);
S3Client.mockImplementation(() => mockS3Client);

// Mock DOMPurify and JSDOM
jest.mock('dompurify', () => ({
  __esModule: true,
  default: () => ({
    sanitize: jest.fn((html) => html)
  })
}));

jest.mock('jsdom', () => ({
  JSDOM: jest.fn(() => ({
    window: {
      // Mock window object
    }
  }))
}));

describe('ChatInterfaceService', () => {
  let service: ChatInterfaceService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set environment variables
    process.env.AWS_REGION = 'us-east-1';
    process.env.BEDROCK_AGENT_LAMBDA_ARN = 'arn:aws:lambda:us-east-1:123456789012:function:bedrock-agent';

    service = new ChatInterfaceService();
  });

  afterEach(() => {
    delete process.env.AWS_REGION;
    delete process.env.BEDROCK_AGENT_LAMBDA_ARN;
  });

  describe('sendMessage', () => {
    it('should successfully send message and return response', async () => {
      const mockAgentResponse = {
        success: true,
        result: {
          sessionId: 'test-session-id',
          response: 'Test response from agent',
          traces: [],
          citations: [],
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      mockLambdaClient.send.mockResolvedValue({
        Payload: new TextEncoder().encode(JSON.stringify(mockAgentResponse))
      });

      const request = {
        message: 'Test message',
        sessionId: 'test-session-id',
        enableTrace: false
      };

      const result = await service.sendMessage(request, 'test-correlation-id');

      expect(result).toEqual({
        sessionId: 'test-session-id',
        messageId: expect.any(String),
        content: 'Test response from agent',
        formattedContent: 'Test response from agent',
        actionsTaken: undefined,
        citations: [],
        timestamp: '2024-01-15T10:30:00Z',
        metadata: {
          correlationId: 'test-correlation-id',
          messageCount: 2,
          sessionAge: expect.any(Number)
        }
      });

      expect(mockLambdaClient.send).toHaveBeenCalledTimes(1);
    });

    it('should create new session if none provided', async () => {
      const mockAgentResponse = {
        success: true,
        result: {
          sessionId: 'new-session-id',
          response: 'Welcome message',
          traces: [],
          citations: [],
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      mockLambdaClient.send.mockResolvedValue({
        Payload: new TextEncoder().encode(JSON.stringify(mockAgentResponse))
      });

      const request = {
        message: 'Hello',
        enableTrace: false
      };

      const result = await service.sendMessage(request, 'test-correlation-id');

      expect(result.sessionId).toBe('new-session-id');
      expect(mockLambdaClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          FunctionName: 'arn:aws:lambda:us-east-1:123456789012:function:bedrock-agent',
          Payload: expect.stringContaining('"sessionId":"new-session-id"')
        })
      );
    });

    it('should handle agent errors', async () => {
      const mockErrorResponse = {
        success: false,
        error: {
          message: 'Agent error',
          code: 'AGENT_ERROR'
        }
      };

      mockLambdaClient.send.mockResolvedValue({
        Payload: new TextEncoder().encode(JSON.stringify(mockErrorResponse))
      });

      const request = {
        message: 'Test message'
      };

      await expect(
        service.sendMessage(request, 'test-correlation-id')
      ).rejects.toThrow('Failed to send message');
    });

    it('should handle Lambda invocation errors', async () => {
      mockLambdaClient.send.mockRejectedValue(new Error('Lambda error'));

      const request = {
        message: 'Test message'
      };

      await expect(
        service.sendMessage(request, 'test-correlation-id')
      ).rejects.toThrow('Failed to send message');
    });

    it('should format agent response with actions', async () => {
      const mockAgentResponse = {
        success: true,
        result: {
          sessionId: 'test-session-id',
          response: 'I started a scan for you',
          traces: [
            {
              type: 'ACTION_GROUP_INVOCATION',
              actionGroupName: 'ScanActions',
              actionDescription: 'Started environment scan',
              actionResult: 'Scan initiated successfully',
              timestamp: '2024-01-15T10:30:00Z'
            }
          ],
          citations: [],
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      mockLambdaClient.send.mockResolvedValue({
        Payload: new TextEncoder().encode(JSON.stringify(mockAgentResponse))
      });

      const request = {
        message: 'Scan my environment',
        enableTrace: true
      };

      const result = await service.sendMessage(request, 'test-correlation-id');

      expect(result.actionsTaken).toEqual([
        {
          action: 'ScanActions',
          description: 'Started environment scan',
          result: 'Scan initiated successfully',
          timestamp: '2024-01-15T10:30:00Z'
        }
      ]);
    });
  });

  describe('getSessionHistory', () => {
    it('should return existing session from memory', async () => {
      // First create a session by sending a message
      const mockAgentResponse = {
        success: true,
        result: {
          sessionId: 'test-session-id',
          response: 'Test response',
          traces: [],
          citations: [],
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      mockLambdaClient.send.mockResolvedValue({
        Payload: new TextEncoder().encode(JSON.stringify(mockAgentResponse))
      });

      await service.sendMessage({
        message: 'Test message',
        sessionId: 'test-session-id'
      }, 'test-correlation-id');

      // Now get the session history
      const session = await service.getSessionHistory('test-session-id', 'test-correlation-id-2');

      expect(session.id).toBe('test-session-id');
      expect(session.messages).toHaveLength(2); // User message + agent response
      expect(session.messageCount).toBe(2);
    });

    it('should create new session if not found', async () => {
      const session = await service.getSessionHistory('non-existent-session', 'test-correlation-id');

      expect(session.id).toBe('non-existent-session');
      expect(session.messages).toHaveLength(0);
      expect(session.messageCount).toBe(0);
    });
  });

  describe('clearSession', () => {
    it('should clear session from memory', async () => {
      // First create a session
      const mockAgentResponse = {
        success: true,
        result: {
          sessionId: 'test-session-id',
          response: 'Test response',
          traces: [],
          citations: [],
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      mockLambdaClient.send.mockResolvedValue({
        Payload: new TextEncoder().encode(JSON.stringify(mockAgentResponse))
      });

      await service.sendMessage({
        message: 'Test message',
        sessionId: 'test-session-id'
      }, 'test-correlation-id');

      // Clear the session
      await service.clearSession('test-session-id', 'test-correlation-id-2');

      // Try to get the session - should create a new empty one
      const session = await service.getSessionHistory('test-session-id', 'test-correlation-id-3');
      expect(session.messages).toHaveLength(0);
    });
  });

  describe('getServiceStatus', () => {
    it('should return healthy status when agent is working', async () => {
      const mockAgentResponse = {
        success: true,
        result: {
          sessionId: 'health-check',
          response: 'OK',
          traces: [],
          citations: [],
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      mockLambdaClient.send.mockResolvedValue({
        Payload: new TextEncoder().encode(JSON.stringify(mockAgentResponse))
      });

      const status = await service.getServiceStatus('test-correlation-id');

      expect(status.healthy).toBe(true);
      expect(status.version).toBe('1.0.0');
      expect(status.bedrockAgent?.healthy).toBe(true);
      expect(status.bedrockAgent?.configured).toBe(true);
    });

    it('should return unhealthy status when agent fails', async () => {
      mockLambdaClient.send.mockRejectedValue(new Error('Agent not available'));

      const status = await service.getServiceStatus('test-correlation-id');

      expect(status.healthy).toBe(false);
      expect(status.bedrockAgent?.healthy).toBe(false);
      expect(status.bedrockAgent?.error).toBe('Agent not available');
    });
  });

  describe('session management', () => {
    it('should validate session age', async () => {
      // Create a session with old timestamp
      const oldSession = {
        id: 'old-session',
        messages: [],
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
        lastActivity: new Date().toISOString(),
        messageCount: 0,
        metadata: {}
      };

      // Manually add to sessions map to simulate old session
      (service as any).sessions.set('old-session', oldSession);

      await expect(
        service.sendMessage({
          message: 'Test message',
          sessionId: 'old-session'
        }, 'test-correlation-id')
      ).rejects.toThrow('Session has expired');
    });

    it('should validate message count limit', async () => {
      // Create a session with max messages
      const fullSession = {
        id: 'full-session',
        messages: new Array(100).fill(null).map((_, i) => ({
          id: `msg-${i}`,
          role: 'user' as const,
          content: `Message ${i}`,
          timestamp: new Date().toISOString()
        })),
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        messageCount: 100,
        metadata: {}
      };

      // Manually add to sessions map
      (service as any).sessions.set('full-session', fullSession);

      await expect(
        service.sendMessage({
          message: 'Test message',
          sessionId: 'full-session'
        }, 'test-correlation-id')
      ).rejects.toThrow('Session message limit reached');
    });
  });
});
