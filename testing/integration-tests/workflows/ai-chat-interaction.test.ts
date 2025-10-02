/**
 * Integration tests for AI chat interaction workflow
 * 
 * This test suite validates the end-to-end AI chat functionality,
 * from user queries through Bedrock Agent to knowledge base responses.
 */

import { ChatInterfaceService } from '../../../services/chat-interface/src/services/ChatInterfaceService';
import { BedrockAgentService } from '../../../services/bedrock-agent/src/services/BedrockAgentService';
import { BedrockKnowledgeBaseService } from '../../../services/bedrock-knowledge-base/src/services/BedrockKnowledgeBaseService';
import { dynamoDBClient } from '../setup/localstack';
import { PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

// Mock Bedrock services since they're not available in LocalStack
jest.mock('../../../services/bedrock-agent/src/services/BedrockAgentService');
jest.mock('../../../services/bedrock-knowledge-base/src/services/BedrockKnowledgeBaseService');

describe('AI Chat Interaction Workflow', () => {
  let chatService: ChatInterfaceService;
  let mockBedrockAgent: jest.Mocked<BedrockAgentService>;
  let mockKnowledgeBase: jest.Mocked<BedrockKnowledgeBaseService>;
  let testTenantId: string;
  let testUserId: string;
  let testSessionId: string;

  beforeEach(async () => {
    // Initialize services
    chatService = new ChatInterfaceService();
    mockBedrockAgent = new BedrockAgentService() as jest.Mocked<BedrockAgentService>;
    mockKnowledgeBase = new BedrockKnowledgeBaseService() as jest.Mocked<BedrockKnowledgeBaseService>;
    
    // Generate test identifiers
    testTenantId = global.integrationTestUtils.generateTenantId();
    testUserId = global.integrationTestUtils.generateUserId();
    testSessionId = `session-${Math.random().toString(36).substr(2, 9)}`;
    
    // Set up mock responses
    setupMockResponses();
    
    // Create test tenant
    await dynamoDBClient.send(new PutItemCommand({
      TableName: 'ai-compliance-tenants-test',
      Item: marshall({
        tenantId: testTenantId,
        name: 'AI Chat Test Tenant',
        tier: 'PREMIUM',
        status: 'ACTIVE',
        settings: {
          aiChatEnabled: true,
          maxChatSessions: 10,
          chatRetentionDays: 30
        },
        createdAt: new Date().toISOString()
      })
    }));
    
    // Create test user session
    await dynamoDBClient.send(new PutItemCommand({
      TableName: 'ai-compliance-user-sessions-test',
      Item: marshall({
        sessionId: testSessionId,
        userId: testUserId,
        tenantId: testTenantId,
        status: 'ACTIVE',
        permissions: ['chat:use', 'compliance:read'],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      })
    }));
  });

  function setupMockResponses() {
    // Mock Knowledge Base responses
    mockKnowledgeBase.queryKnowledgeBase = jest.fn().mockImplementation(async (query: string) => {
      const responses = {
        'SOC 2': {
          results: [
            {
              content: 'SOC 2 is a compliance framework that focuses on five trust service criteria: Security, Availability, Processing Integrity, Confidentiality, and Privacy.',
              source: 'soc2-compliance-guide.md',
              confidence: 0.95
            }
          ],
          totalResults: 1
        },
        'S3 bucket': {
          results: [
            {
              content: 'S3 buckets should have public access blocked, encryption enabled, and versioning configured for compliance.',
              source: 's3-security-best-practices.md',
              confidence: 0.92
            }
          ],
          totalResults: 1
        },
        'default': {
          results: [
            {
              content: 'I can help you with AWS compliance questions, security best practices, and remediation guidance.',
              source: 'general-help.md',
              confidence: 0.80
            }
          ],
          totalResults: 1
        }
      };
      
      const key = Object.keys(responses).find(k => query.toLowerCase().includes(k.toLowerCase())) || 'default';
      return responses[key];
    });
    
    // Mock Bedrock Agent responses
    mockBedrockAgent.invokeAgent = jest.fn().mockImplementation(async (request) => {
      const { message, sessionId, userId } = request;
      
      // Simulate agent processing with action groups
      if (message.toLowerCase().includes('scan')) {
        return {
          response: 'I can help you start a compliance scan. Would you like me to scan specific AWS services or perform a full compliance scan?',
          sessionId,
          actionsTaken: ['ScanActions.listAvailableScans'],
          confidence: 0.90,
          sources: ['bedrock-agent-scan-actions']
        };
      } else if (message.toLowerCase().includes('findings')) {
        return {
          response: 'I can show you your compliance findings. Let me retrieve the latest findings for your account.',
          sessionId,
          actionsTaken: ['FindingsActions.listFindings'],
          confidence: 0.88,
          sources: ['bedrock-agent-findings-actions']
        };
      } else {
        // Use knowledge base response
        const kbResult = await mockKnowledgeBase.queryKnowledgeBase(message);
        return {
          response: kbResult.results[0]?.content || 'I can help you with AWS compliance questions.',
          sessionId,
          actionsTaken: ['KnowledgeBase.query'],
          confidence: kbResult.results[0]?.confidence || 0.75,
          sources: kbResult.results.map(r => r.source)
        };
      }
    });
  }

  describe('Complete Chat Workflow', () => {
    it('should handle complete chat conversation from user query to AI response', async () => {
      console.log('🚀 Testing complete AI chat workflow...');
      
      // Step 1: Start chat session
      console.log('💬 Step 1: Starting chat session...');
      
      const chatSession = await chatService.startChatSession({
        userId: testUserId,
        tenantId: testTenantId,
        sessionId: testSessionId
      });
      
      expect(chatSession).toBeDefined();
      expect(chatSession.sessionId).toBe(testSessionId);
      expect(chatSession.status).toBe('ACTIVE');
      
      console.log(`✅ Chat session started: ${chatSession.sessionId}`);
      
      // Step 2: Send user message
      console.log('📝 Step 2: Sending user message...');
      
      const userMessage = {
        sessionId: testSessionId,
        userId: testUserId,
        tenantId: testTenantId,
        message: 'What is SOC 2 compliance and how does it apply to AWS?',
        messageType: 'USER_MESSAGE' as const
      };
      
      const chatResponse = await chatService.processMessage(userMessage);
      
      expect(chatResponse).toBeDefined();
      expect(chatResponse.messageId).toMatch(/^msg-/);
      expect(chatResponse.response).toBeDefined();
      expect(chatResponse.response.length).toBeGreaterThan(0);
      expect(chatResponse.confidence).toBeGreaterThan(0.5);
      
      console.log(`✅ AI response received: ${chatResponse.response.substring(0, 100)}...`);
      
      // Step 3: Verify message stored in conversation history
      console.log('💾 Step 3: Verifying conversation history...');
      
      const conversationHistory = await chatService.getChatHistory(testSessionId, testTenantId);
      
      expect(conversationHistory).toBeDefined();
      expect(conversationHistory.messages).toHaveLength(2); // User message + AI response
      
      const userMsg = conversationHistory.messages.find(m => m.messageType === 'USER_MESSAGE');
      const aiMsg = conversationHistory.messages.find(m => m.messageType === 'AI_RESPONSE');
      
      expect(userMsg).toBeDefined();
      expect(userMsg!.message).toBe(userMessage.message);
      expect(userMsg!.userId).toBe(testUserId);
      
      expect(aiMsg).toBeDefined();
      expect(aiMsg!.message).toBe(chatResponse.response);
      expect(aiMsg!.confidence).toBeDefined();
      
      console.log('✅ Conversation history verified');
      
      // Step 4: Test follow-up question
      console.log('🔄 Step 4: Testing follow-up question...');
      
      const followUpMessage = {
        sessionId: testSessionId,
        userId: testUserId,
        tenantId: testTenantId,
        message: 'How do I secure my S3 buckets for SOC 2 compliance?',
        messageType: 'USER_MESSAGE' as const
      };
      
      const followUpResponse = await chatService.processMessage(followUpMessage);
      
      expect(followUpResponse).toBeDefined();
      expect(followUpResponse.response).toContain('S3');
      expect(followUpResponse.response).toContain('bucket');
      
      console.log(`✅ Follow-up response: ${followUpResponse.response.substring(0, 100)}...`);
      
      // Step 5: Verify updated conversation history
      console.log('📚 Step 5: Verifying updated conversation history...');
      
      const updatedHistory = await chatService.getChatHistory(testSessionId, testTenantId);
      
      expect(updatedHistory.messages).toHaveLength(4); // 2 user messages + 2 AI responses
      expect(updatedHistory.sessionId).toBe(testSessionId);
      expect(updatedHistory.totalMessages).toBe(4);
      
      console.log('✅ Updated conversation history verified');
      
      // Step 6: Test action-based query
      console.log('⚡ Step 6: Testing action-based query...');
      
      const actionMessage = {
        sessionId: testSessionId,
        userId: testUserId,
        tenantId: testTenantId,
        message: 'Can you start a compliance scan for my AWS account?',
        messageType: 'USER_MESSAGE' as const
      };
      
      const actionResponse = await chatService.processMessage(actionMessage);
      
      expect(actionResponse).toBeDefined();
      expect(actionResponse.response).toContain('scan');
      expect(actionResponse.actionsTaken).toBeDefined();
      expect(actionResponse.actionsTaken).toContain('ScanActions.listAvailableScans');
      
      console.log(`✅ Action-based response: ${actionResponse.response.substring(0, 100)}...`);
      
      console.log('🎉 Complete AI chat workflow test passed!');
    }, 60000);
    
    it('should handle chat session management', async () => {
      console.log('🚀 Testing chat session management...');
      
      // Start multiple sessions for the same user
      const session1 = await chatService.startChatSession({
        userId: testUserId,
        tenantId: testTenantId,
        sessionId: `${testSessionId}-1`
      });
      
      const session2 = await chatService.startChatSession({
        userId: testUserId,
        tenantId: testTenantId,
        sessionId: `${testSessionId}-2`
      });
      
      expect(session1.sessionId).not.toBe(session2.sessionId);
      
      // List user sessions
      const userSessions = await chatService.getUserChatSessions(testUserId, testTenantId);
      
      expect(userSessions).toBeDefined();
      expect(userSessions.sessions.length).toBeGreaterThanOrEqual(2);
      
      // End a session
      await chatService.endChatSession(session1.sessionId, testTenantId);
      
      const endedSession = await chatService.getChatSession(session1.sessionId, testTenantId);
      expect(endedSession.status).toBe('ENDED');
      
      console.log('✅ Chat session management verified');
    });
  });
  
  describe('Knowledge Base Integration', () => {
    it('should query knowledge base for compliance information', async () => {
      console.log('🚀 Testing knowledge base integration...');
      
      const chatSession = await chatService.startChatSession({
        userId: testUserId,
        tenantId: testTenantId,
        sessionId: testSessionId
      });
      
      // Test SOC 2 query
      const soc2Query = {
        sessionId: testSessionId,
        userId: testUserId,
        tenantId: testTenantId,
        message: 'Tell me about SOC 2 Type II requirements',
        messageType: 'USER_MESSAGE' as const
      };
      
      const soc2Response = await chatService.processMessage(soc2Query);
      
      expect(soc2Response.response).toContain('SOC 2');
      expect(soc2Response.sources).toBeDefined();
      expect(soc2Response.confidence).toBeGreaterThan(0.8);
      
      // Verify knowledge base was called
      expect(mockKnowledgeBase.queryKnowledgeBase).toHaveBeenCalledWith(
        expect.stringContaining('SOC 2')
      );
      
      console.log('✅ Knowledge base integration verified');
    });
  });
  
  describe('Multi-Tenant Chat Isolation', () => {
    it('should isolate chat sessions between tenants', async () => {
      console.log('🚀 Testing multi-tenant chat isolation...');
      
      // Create second tenant
      const tenant2Id = global.integrationTestUtils.generateTenantId();
      const user2Id = global.integrationTestUtils.generateUserId();
      const session2Id = `session-${Math.random().toString(36).substr(2, 9)}`;
      
      await dynamoDBClient.send(new PutItemCommand({
        TableName: 'ai-compliance-tenants-test',
        Item: marshall({
          tenantId: tenant2Id,
          name: 'AI Chat Test Tenant 2',
          tier: 'BASIC',
          status: 'ACTIVE',
          settings: { aiChatEnabled: true },
          createdAt: new Date().toISOString()
        })
      }));
      
      // Start sessions for both tenants
      const session1 = await chatService.startChatSession({
        userId: testUserId,
        tenantId: testTenantId,
        sessionId: testSessionId
      });
      
      const session2 = await chatService.startChatSession({
        userId: user2Id,
        tenantId: tenant2Id,
        sessionId: session2Id
      });
      
      // Send messages in both sessions
      await chatService.processMessage({
        sessionId: testSessionId,
        userId: testUserId,
        tenantId: testTenantId,
        message: 'Tenant 1 message',
        messageType: 'USER_MESSAGE'
      });
      
      await chatService.processMessage({
        sessionId: session2Id,
        userId: user2Id,
        tenantId: tenant2Id,
        message: 'Tenant 2 message',
        messageType: 'USER_MESSAGE'
      });
      
      // Verify tenant 1 cannot access tenant 2's chat
      try {
        await chatService.getChatHistory(session2Id, testTenantId);
        fail('Should not be able to access other tenant\'s chat');
      } catch (error) {
        expect(error.message).toContain('not found');
      }
      
      // Verify tenant 2 cannot access tenant 1's chat
      try {
        await chatService.getChatHistory(testSessionId, tenant2Id);
        fail('Should not be able to access other tenant\'s chat');
      } catch (error) {
        expect(error.message).toContain('not found');
      }
      
      console.log('✅ Multi-tenant chat isolation verified');
    });
  });
  
  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid session gracefully', async () => {
      console.log('🚀 Testing invalid session handling...');
      
      const invalidMessage = {
        sessionId: 'invalid-session-id',
        userId: testUserId,
        tenantId: testTenantId,
        message: 'Test message',
        messageType: 'USER_MESSAGE' as const
      };
      
      try {
        await chatService.processMessage(invalidMessage);
        fail('Should throw error for invalid session');
      } catch (error) {
        expect(error.message).toContain('session');
      }
      
      console.log('✅ Invalid session handling verified');
    });
    
    it('should handle AI service failures gracefully', async () => {
      console.log('🚀 Testing AI service failure handling...');
      
      // Mock AI service failure
      mockBedrockAgent.invokeAgent.mockRejectedValueOnce(new Error('Bedrock service unavailable'));
      
      const chatSession = await chatService.startChatSession({
        userId: testUserId,
        tenantId: testTenantId,
        sessionId: testSessionId
      });
      
      const message = {
        sessionId: testSessionId,
        userId: testUserId,
        tenantId: testTenantId,
        message: 'Test message',
        messageType: 'USER_MESSAGE' as const
      };
      
      const response = await chatService.processMessage(message);
      
      // Should return fallback response
      expect(response).toBeDefined();
      expect(response.response).toContain('temporarily unavailable');
      expect(response.confidence).toBeLessThan(0.5);
      
      console.log('✅ AI service failure handling verified');
    });
    
    it('should handle rate limiting', async () => {
      console.log('🚀 Testing rate limiting...');
      
      const chatSession = await chatService.startChatSession({
        userId: testUserId,
        tenantId: testTenantId,
        sessionId: testSessionId
      });
      
      // Send multiple messages rapidly
      const messages = Array.from({ length: 10 }, (_, i) => ({
        sessionId: testSessionId,
        userId: testUserId,
        tenantId: testTenantId,
        message: `Rapid message ${i}`,
        messageType: 'USER_MESSAGE' as const
      }));
      
      const responses = await Promise.allSettled(
        messages.map(msg => chatService.processMessage(msg))
      );
      
      // Some requests should be rate limited
      const rateLimited = responses.filter(r => 
        r.status === 'rejected' && 
        r.reason.message.includes('rate limit')
      );
      
      expect(rateLimited.length).toBeGreaterThan(0);
      
      console.log('✅ Rate limiting verified');
    });
  });
});
