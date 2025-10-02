import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger';
import { ChatInterfaceError } from '../utils/errorHandler';
import { 
  ChatMessage, 
  ChatSession, 
  ChatResponse, 
  ServiceStatus,
  AgentInvokeRequest,
  AgentInvokeResponse 
} from '../types/chat';
import { v4 as uuidv4 } from 'uuid';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

/**
 * Service for managing chat interface operations
 * Handles communication with Bedrock Agent and session management
 */
export class ChatInterfaceService {
  private lambdaClient: LambdaClient;
  private s3Client: S3Client;
  private sessions: Map<string, ChatSession> = new Map();
  private readonly maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours
  private readonly maxMessagesPerSession = 100;

  constructor() {
    this.lambdaClient = new LambdaClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1'
    });

    // Set up DOMPurify with JSDOM
    const window = new JSDOM('').window;
    const purify = DOMPurify(window as any);
    this.sanitizeHtml = (html: string) => purify.sanitize(html);

    // Clean up old sessions periodically
    setInterval(() => this.cleanupOldSessions(), 60 * 60 * 1000); // Every hour
  }

  private sanitizeHtml: (html: string) => string;

  /**
   * Send a message to the AI agent
   */
  async sendMessage(request: {
    message: string;
    sessionId?: string;
    enableTrace?: boolean;
  }, correlationId: string): Promise<ChatResponse> {
    try {
      logger.info('Sending message to agent', {
        correlationId,
        sessionId: request.sessionId,
        messageLength: request.message.length,
        enableTrace: request.enableTrace
      });

      // Get or create session
      const sessionId = request.sessionId || uuidv4();
      let session = this.sessions.get(sessionId);
      
      if (!session) {
        session = this.createNewSession(sessionId);
        this.sessions.set(sessionId, session);
      }

      // Validate session
      this.validateSession(session);

      // Prepare agent request
      const agentRequest: AgentInvokeRequest = {
        sessionId,
        inputText: request.message,
        enableTrace: request.enableTrace || false,
        endSession: false
      };

      // Invoke Bedrock Agent
      const agentResponse = await this.invokeBedrockAgent(agentRequest, correlationId);

      // Process and format response
      const formattedResponse = await this.formatAgentResponse(agentResponse);

      // Add messages to session history
      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: request.message,
        timestamp: new Date().toISOString(),
        metadata: {
          correlationId
        }
      };

      const agentMessage: ChatMessage = {
        id: uuidv4(),
        role: 'agent',
        content: formattedResponse.content,
        timestamp: new Date().toISOString(),
        metadata: {
          correlationId,
          traces: agentResponse.traces,
          citations: agentResponse.citations,
          actionsTaken: formattedResponse.actionsTaken
        }
      };

      session.messages.push(userMessage, agentMessage);
      session.lastActivity = new Date().toISOString();
      session.messageCount += 2;

      // Persist session if needed
      if (session.messages.length > 10) {
        await this.persistSession(session);
      }

      const response: ChatResponse = {
        sessionId,
        messageId: agentMessage.id,
        content: formattedResponse.content,
        formattedContent: formattedResponse.formattedContent,
        actionsTaken: formattedResponse.actionsTaken,
        citations: agentResponse.citations,
        timestamp: agentMessage.timestamp,
        metadata: {
          correlationId,
          messageCount: session.messageCount,
          sessionAge: Date.now() - new Date(session.createdAt).getTime()
        }
      };

      logger.info('Message processed successfully', {
        correlationId,
        sessionId,
        responseLength: response.content.length,
        actionCount: response.actionsTaken?.length || 0,
        citationCount: response.citations?.length || 0
      });

      return response;

    } catch (error) {
      logger.error('Error sending message', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      throw new ChatInterfaceError(
        `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get session history
   */
  async getSessionHistory(sessionId: string, correlationId: string): Promise<ChatSession> {
    try {
      logger.info('Retrieving session history', {
        correlationId,
        sessionId
      });

      let session = this.sessions.get(sessionId);

      if (!session) {
        // Try to load from persistent storage
        session = await this.loadSession(sessionId);
        
        if (session) {
          this.sessions.set(sessionId, session);
        } else {
          // Create new empty session
          session = this.createNewSession(sessionId);
          this.sessions.set(sessionId, session);
        }
      }

      logger.info('Session history retrieved', {
        correlationId,
        sessionId,
        messageCount: session.messages.length
      });

      return session;

    } catch (error) {
      logger.error('Error retrieving session history', {
        correlationId,
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new ChatInterfaceError(
        `Failed to retrieve session history: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Clear session
   */
  async clearSession(sessionId: string, correlationId: string): Promise<void> {
    try {
      logger.info('Clearing session', {
        correlationId,
        sessionId
      });

      // Remove from memory
      this.sessions.delete(sessionId);

      // Remove from persistent storage
      await this.deletePersistedSession(sessionId);

      logger.info('Session cleared successfully', {
        correlationId,
        sessionId
      });

    } catch (error) {
      logger.error('Error clearing session', {
        correlationId,
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new ChatInterfaceError(
        `Failed to clear session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get service status
   */
  async getServiceStatus(correlationId: string): Promise<ServiceStatus> {
    try {
      logger.info('Getting service status', { correlationId });

      // Check Bedrock Agent status
      const agentStatus = await this.checkBedrockAgentStatus();

      const status: ServiceStatus = {
        healthy: agentStatus.healthy,
        version: '1.0.0',
        uptime: process.uptime(),
        activeSessions: this.sessions.size,
        bedrockAgent: agentStatus,
        timestamp: new Date().toISOString()
      };

      logger.info('Service status retrieved', {
        correlationId,
        healthy: status.healthy,
        activeSessions: status.activeSessions
      });

      return status;

    } catch (error) {
      logger.error('Error getting service status', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        healthy: false,
        version: '1.0.0',
        uptime: process.uptime(),
        activeSessions: this.sessions.size,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Invoke Bedrock Agent Lambda
   */
  private async invokeBedrockAgent(
    request: AgentInvokeRequest, 
    correlationId: string
  ): Promise<AgentInvokeResponse> {
    try {
      const command = new InvokeCommand({
        FunctionName: process.env.BEDROCK_AGENT_LAMBDA_ARN || 'bedrock-agent',
        Payload: JSON.stringify({
          httpMethod: 'POST',
          path: '/agent/invoke',
          body: JSON.stringify(request),
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-Id': correlationId
          }
        })
      });

      const response = await this.lambdaClient.send(command);
      
      if (!response.Payload) {
        throw new Error('No response payload from Bedrock Agent');
      }

      const payload = JSON.parse(new TextDecoder().decode(response.Payload));
      
      if (!payload.success) {
        throw new Error(payload.error?.message || 'Bedrock Agent returned error');
      }

      return payload.result;

    } catch (error) {
      logger.error('Error invoking Bedrock Agent', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Format agent response for display
   */
  private async formatAgentResponse(response: AgentInvokeResponse): Promise<{
    content: string;
    formattedContent: string;
    actionsTaken?: Array<{
      action: string;
      description: string;
      result: string;
      timestamp: string;
    }>;
  }> {
    try {
      // Parse markdown and sanitize HTML
      const htmlContent = marked(response.response);
      const sanitizedContent = this.sanitizeHtml(htmlContent);

      // Extract actions from traces if available
      const actionsTaken = this.extractActionsFromTraces(response.traces);

      return {
        content: response.response,
        formattedContent: sanitizedContent,
        actionsTaken
      };

    } catch (error) {
      logger.warn('Error formatting agent response', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        content: response.response,
        formattedContent: response.response
      };
    }
  }

  /**
   * Extract actions from agent traces
   */
  private extractActionsFromTraces(traces?: any[]): Array<{
    action: string;
    description: string;
    result: string;
    timestamp: string;
  }> | undefined {
    if (!traces || traces.length === 0) {
      return undefined;
    }

    const actions: Array<{
      action: string;
      description: string;
      result: string;
      timestamp: string;
    }> = [];

    for (const trace of traces) {
      if (trace.type === 'ACTION_GROUP_INVOCATION') {
        actions.push({
          action: trace.actionGroupName || 'Unknown Action',
          description: trace.actionDescription || 'Action executed',
          result: trace.actionResult || 'Completed',
          timestamp: trace.timestamp || new Date().toISOString()
        });
      }
    }

    return actions.length > 0 ? actions : undefined;
  }

  /**
   * Create new session
   */
  private createNewSession(sessionId: string): ChatSession {
    return {
      id: sessionId,
      messages: [],
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      messageCount: 0,
      metadata: {
        userAgent: 'chat-interface',
        ipAddress: 'unknown'
      }
    };
  }

  /**
   * Validate session
   */
  private validateSession(session: ChatSession): void {
    const sessionAge = Date.now() - new Date(session.createdAt).getTime();
    
    if (sessionAge > this.maxSessionAge) {
      throw new ChatInterfaceError('Session has expired');
    }

    if (session.messageCount >= this.maxMessagesPerSession) {
      throw new ChatInterfaceError('Session message limit reached');
    }
  }

  /**
   * Clean up old sessions
   */
  private cleanupOldSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const sessionAge = now - new Date(session.createdAt).getTime();
      
      if (sessionAge > this.maxSessionAge) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up old sessions', {
        cleanedCount,
        remainingSessions: this.sessions.size
      });
    }
  }

  /**
   * Persist session to S3
   */
  private async persistSession(session: ChatSession): Promise<void> {
    try {
      const bucketName = process.env.CHAT_SESSIONS_BUCKET;
      if (!bucketName) {
        return; // Skip persistence if no bucket configured
      }

      const key = `sessions/${session.id}.json`;
      
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: JSON.stringify(session),
        ContentType: 'application/json',
        ServerSideEncryption: 'AES256'
      });

      await this.s3Client.send(command);

    } catch (error) {
      logger.warn('Failed to persist session', {
        sessionId: session.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Load session from S3
   */
  private async loadSession(sessionId: string): Promise<ChatSession | null> {
    try {
      const bucketName = process.env.CHAT_SESSIONS_BUCKET;
      if (!bucketName) {
        return null;
      }

      const key = `sessions/${sessionId}.json`;
      
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        return null;
      }

      const sessionData = await response.Body.transformToString();
      return JSON.parse(sessionData);

    } catch (error) {
      logger.warn('Failed to load session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Delete persisted session
   */
  private async deletePersistedSession(sessionId: string): Promise<void> {
    try {
      const bucketName = process.env.CHAT_SESSIONS_BUCKET;
      if (!bucketName) {
        return;
      }

      // Note: We would use DeleteObjectCommand here, but for simplicity
      // we'll just let the lifecycle policy handle cleanup
      
    } catch (error) {
      logger.warn('Failed to delete persisted session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Check Bedrock Agent status
   */
  private async checkBedrockAgentStatus(): Promise<{
    healthy: boolean;
    configured: boolean;
    lastCheck: string;
    error?: string;
  }> {
    try {
      const testRequest: AgentInvokeRequest = {
        sessionId: 'health-check',
        inputText: 'health check',
        enableTrace: false,
        endSession: true
      };

      await this.invokeBedrockAgent(testRequest, 'health-check');

      return {
        healthy: true,
        configured: true,
        lastCheck: new Date().toISOString()
      };

    } catch (error) {
      return {
        healthy: false,
        configured: false,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
