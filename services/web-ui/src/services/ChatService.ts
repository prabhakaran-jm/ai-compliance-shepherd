import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

interface ChatSession {
  sessionId: string;
  tenantId: string;
  userId: string;
  title: string;
  status: 'active' | 'archived' | 'deleted';
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface ChatMessage {
  messageId: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  messageType: 'text' | 'code' | 'chart' | 'error';
  metadata?: Record<string, any>;
  timestamp: string;
}

interface ProcessMessageRequest {
  sessionId: string;
  tenantId: string;
  userId: string;
  message: string;
  messageType: string;
}

/**
 * Chat Service
 * Handles chat sessions and AI agent interactions
 */
export class ChatService {
  private readonly bedrockAgentUrl: string;
  private readonly chatInterfaceUrl: string;
  private sessions = new Map<string, ChatSession>();
  private messages = new Map<string, ChatMessage[]>();

  constructor() {
    this.bedrockAgentUrl = process.env.BEDROCK_AGENT_URL || 'http://localhost:8081';
    this.chatInterfaceUrl = process.env.CHAT_INTERFACE_URL || 'http://localhost:8082';
  }

  /**
   * Create new chat session
   */
  async createSession(tenantId: string, userId: string): Promise<ChatSession> {
    try {
      logger.info('Creating chat session', { tenantId, userId });

      const sessionId = uuidv4();
      const session: ChatSession = {
        sessionId,
        tenantId,
        userId,
        title: 'New Chat Session',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0
      };

      this.sessions.set(sessionId, session);
      this.messages.set(sessionId, []);

      // Send welcome message
      const welcomeMessage: ChatMessage = {
        messageId: uuidv4(),
        sessionId,
        role: 'assistant',
        content: `Welcome to AI Compliance Shepherd! 

I'm here to help you with:
• 🔍 **Environment Scanning** - Discover and analyze AWS resources
• 📊 **Findings Management** - Review and resolve compliance issues  
• 🔧 **Automated Remediation** - Apply fixes safely with approval workflows
• 📋 **Report Generation** - Create professional compliance reports
• 🏗️ **Terraform Analysis** - Scan infrastructure-as-code before deployment
• 💬 **Slack Integration** - Configure team notifications

What would you like to do today?`,
        messageType: 'text',
        timestamp: new Date().toISOString()
      };

      this.messages.get(sessionId)!.push(welcomeMessage);
      session.messageCount = 1;

      return session;
    } catch (error) {
      logger.error('Error creating chat session', { 
        tenantId, 
        userId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get chat session
   */
  async getSession(sessionId: string, tenantId: string): Promise<ChatSession | null> {
    try {
      const session = this.sessions.get(sessionId);
      
      if (!session || session.tenantId !== tenantId) {
        return null;
      }

      return session;
    } catch (error) {
      logger.error('Error fetching chat session', { 
        sessionId, 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get chat messages
   */
  async getMessages(
    sessionId: string, 
    tenantId: string, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<ChatMessage[]> {
    try {
      const session = this.sessions.get(sessionId);
      
      if (!session || session.tenantId !== tenantId) {
        return [];
      }

      const messages = this.messages.get(sessionId) || [];
      return messages.slice(offset, offset + limit);
    } catch (error) {
      logger.error('Error fetching chat messages', { 
        sessionId, 
        tenantId, 
        limit, 
        offset,
        error: error instanceof Error ? error.message : String(error) 
      });
      return [];
    }
  }

  /**
   * Process user message and get AI response
   */
  async processMessage(request: ProcessMessageRequest): Promise<ChatMessage> {
    try {
      logger.info('Processing chat message', { 
        sessionId: request.sessionId,
        tenantId: request.tenantId,
        messageLength: request.message.length
      });

      const session = this.sessions.get(request.sessionId);
      
      if (!session || session.tenantId !== request.tenantId) {
        throw new Error('Session not found');
      }

      // Store user message
      const userMessage: ChatMessage = {
        messageId: uuidv4(),
        sessionId: request.sessionId,
        role: 'user',
        content: request.message,
        messageType: request.messageType as any,
        timestamp: new Date().toISOString()
      };

      const sessionMessages = this.messages.get(request.sessionId) || [];
      sessionMessages.push(userMessage);

      // Send to Bedrock Agent for processing
      const response = await axios.post(
        `${this.bedrockAgentUrl}/api/agent/invoke`,
        {
          tenantId: request.tenantId,
          userId: request.userId,
          sessionId: request.sessionId,
          input: request.message,
          sessionState: {
            sessionAttributes: {},
            promptSessionAttributes: {}
          }
        },
        {
          timeout: 60000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      // Create assistant response
      const assistantMessage: ChatMessage = {
        messageId: uuidv4(),
        sessionId: request.sessionId,
        role: 'assistant',
        content: response.data.output?.text || 'I apologize, but I encountered an issue processing your request.',
        messageType: 'text',
        metadata: {
          actionGroupsUsed: response.data.actionGroupsUsed || [],
          knowledgeBaseUsed: response.data.knowledgeBaseUsed || false,
          processingTime: response.data.processingTime
        },
        timestamp: new Date().toISOString()
      };

      sessionMessages.push(assistantMessage);

      // Update session
      session.messageCount = sessionMessages.length;
      session.updatedAt = new Date().toISOString();

      // Auto-generate title if this is the first user message
      if (session.messageCount <= 2) {
        session.title = this.generateSessionTitle(request.message);
      }

      return assistantMessage;
    } catch (error) {
      logger.error('Error processing chat message', { 
        sessionId: request.sessionId,
        tenantId: request.tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });

      // Return error message
      const errorMessage: ChatMessage = {
        messageId: uuidv4(),
        sessionId: request.sessionId,
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again or contact support if the issue persists.',
        messageType: 'error',
        timestamp: new Date().toISOString()
      };

      const sessionMessages = this.messages.get(request.sessionId) || [];
      sessionMessages.push(errorMessage);

      return errorMessage;
    }
  }

  /**
   * Get user's chat sessions
   */
  async getUserSessions(
    tenantId: string, 
    userId: string, 
    limit: number = 20, 
    offset: number = 0
  ): Promise<ChatSession[]> {
    try {
      const userSessions = Array.from(this.sessions.values())
        .filter(session => 
          session.tenantId === tenantId && 
          session.userId === userId &&
          session.status !== 'deleted'
        )
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(offset, offset + limit);

      return userSessions;
    } catch (error) {
      logger.error('Error fetching user sessions', { 
        tenantId, 
        userId, 
        limit, 
        offset,
        error: error instanceof Error ? error.message : String(error) 
      });
      return [];
    }
  }

  /**
   * Update session
   */
  async updateSession(
    sessionId: string, 
    tenantId: string, 
    updates: Partial<ChatSession>
  ): Promise<ChatSession | null> {
    try {
      const session = this.sessions.get(sessionId);
      
      if (!session || session.tenantId !== tenantId) {
        return null;
      }

      // Update allowed fields
      if (updates.title) session.title = updates.title;
      if (updates.status) session.status = updates.status;
      session.updatedAt = new Date().toISOString();

      return session;
    } catch (error) {
      logger.error('Error updating session', { 
        sessionId, 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string, tenantId: string): Promise<void> {
    try {
      const session = this.sessions.get(sessionId);
      
      if (!session || session.tenantId !== tenantId) {
        return;
      }

      session.status = 'deleted';
      session.updatedAt = new Date().toISOString();
    } catch (error) {
      logger.error('Error deleting session', { 
        sessionId, 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get AI agent capabilities
   */
  async getAgentCapabilities() {
    try {
      const response = await axios.get(
        `${this.bedrockAgentUrl}/api/agent/capabilities`,
        { timeout: 30000 }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching agent capabilities', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      // Return default capabilities
      return {
        actionGroups: [
          { name: 'ScanActions', description: 'Environment scanning and discovery' },
          { name: 'FindingsActions', description: 'Findings management and analysis' },
          { name: 'RemediationActions', description: 'Automated remediation and fixes' },
          { name: 'ReportingActions', description: 'Report generation and exports' },
          { name: 'TerraformActions', description: 'Infrastructure-as-code analysis' },
          { name: 'S3ManagementActions', description: 'S3 bucket configuration' }
        ],
        knowledgeBase: {
          enabled: true,
          frameworks: ['SOC 2', 'HIPAA', 'GDPR', 'PCI-DSS', 'ISO 27001']
        },
        features: [
          'Natural language processing',
          'Automated remediation',
          'Real-time scanning',
          'Compliance guidance',
          'Report generation'
        ]
      };
    }
  }

  /**
   * Generate session title from first message
   */
  private generateSessionTitle(message: string): string {
    const words = message.split(' ').slice(0, 6);
    let title = words.join(' ');
    
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }
    
    return title || 'Chat Session';
  }
}
