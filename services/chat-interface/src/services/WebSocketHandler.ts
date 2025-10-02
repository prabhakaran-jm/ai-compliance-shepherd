import { WebSocket } from 'ws';
import { ChatInterfaceService } from './ChatInterfaceService';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * WebSocket handler for real-time chat communication
 */

interface WebSocketClient {
  id: string;
  ws: WebSocket;
  sessionId?: string;
  lastActivity: number;
  messageCount: number;
}

interface WebSocketMessage {
  type: 'chat' | 'ping' | 'subscribe' | 'unsubscribe';
  data?: any;
  messageId?: string;
  sessionId?: string;
}

export class WebSocketHandler {
  private clients: Map<string, WebSocketClient> = new Map();
  private chatService: ChatInterfaceService;
  private readonly maxInactiveTime = 30 * 60 * 1000; // 30 minutes
  private readonly maxMessagesPerMinute = 10;

  constructor(chatService: ChatInterfaceService) {
    this.chatService = chatService;
    
    // Clean up inactive clients periodically
    setInterval(() => this.cleanupInactiveClients(), 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws: WebSocket, clientId: string): void {
    logger.info('New WebSocket client connected', { clientId });

    const client: WebSocketClient = {
      id: clientId,
      ws,
      lastActivity: Date.now(),
      messageCount: 0
    };

    this.clients.set(clientId, client);

    // Send welcome message
    this.sendMessage(client, {
      type: 'system',
      data: {
        message: 'Connected to AI Compliance Shepherd',
        clientId,
        timestamp: new Date().toISOString()
      }
    });

    // Handle incoming messages
    ws.on('message', (data) => {
      this.handleMessage(client, data);
    });

    // Handle client disconnect
    ws.on('close', (code, reason) => {
      logger.info('WebSocket client disconnected', {
        clientId,
        code,
        reason: reason.toString()
      });
      this.clients.delete(clientId);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error', {
        clientId,
        error: error.message
      });
      this.clients.delete(clientId);
    });

    // Send periodic ping to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendMessage(client, { type: 'ping' });
      } else {
        clearInterval(pingInterval);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(client: WebSocketClient, data: Buffer): Promise<void> {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      const correlationId = `ws-${client.id}-${Date.now()}`;

      logger.debug('WebSocket message received', {
        clientId: client.id,
        messageType: message.type,
        correlationId
      });

      // Update client activity
      client.lastActivity = Date.now();

      // Rate limiting
      if (!this.checkRateLimit(client)) {
        this.sendError(client, 'Rate limit exceeded', correlationId);
        return;
      }

      switch (message.type) {
        case 'chat':
          await this.handleChatMessage(client, message, correlationId);
          break;

        case 'ping':
          this.sendMessage(client, { type: 'pong' });
          break;

        case 'subscribe':
          await this.handleSubscribe(client, message, correlationId);
          break;

        case 'unsubscribe':
          await this.handleUnsubscribe(client, message, correlationId);
          break;

        default:
          this.sendError(client, 'Unknown message type', correlationId);
      }

    } catch (error) {
      logger.error('Error handling WebSocket message', {
        clientId: client.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      this.sendError(client, 'Invalid message format');
    }
  }

  /**
   * Handle chat message
   */
  private async handleChatMessage(
    client: WebSocketClient, 
    message: WebSocketMessage, 
    correlationId: string
  ): Promise<void> {
    try {
      if (!message.data?.message) {
        this.sendError(client, 'Message content is required', correlationId);
        return;
      }

      // Send typing indicator
      this.sendMessage(client, {
        type: 'typing',
        data: { typing: true }
      });

      // Process chat message
      const response = await this.chatService.sendMessage({
        message: message.data.message,
        sessionId: message.sessionId || client.sessionId,
        enableTrace: message.data.enableTrace || false
      }, correlationId);

      // Update client session ID
      client.sessionId = response.sessionId;

      // Send response
      this.sendMessage(client, {
        type: 'chat_response',
        data: {
          messageId: response.messageId,
          sessionId: response.sessionId,
          content: response.content,
          formattedContent: response.formattedContent,
          actionsTaken: response.actionsTaken,
          citations: response.citations,
          timestamp: response.timestamp,
          correlationId
        }
      });

      // Stop typing indicator
      this.sendMessage(client, {
        type: 'typing',
        data: { typing: false }
      });

      logger.info('Chat message processed via WebSocket', {
        clientId: client.id,
        sessionId: response.sessionId,
        correlationId,
        responseLength: response.content.length
      });

    } catch (error) {
      logger.error('Error processing chat message', {
        clientId: client.id,
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Stop typing indicator
      this.sendMessage(client, {
        type: 'typing',
        data: { typing: false }
      });

      this.sendError(client, 'Failed to process message', correlationId);
    }
  }

  /**
   * Handle session subscription
   */
  private async handleSubscribe(
    client: WebSocketClient, 
    message: WebSocketMessage, 
    correlationId: string
  ): Promise<void> {
    try {
      const sessionId = message.sessionId;
      if (!sessionId) {
        this.sendError(client, 'Session ID is required for subscription', correlationId);
        return;
      }

      client.sessionId = sessionId;

      // Get session history
      const session = await this.chatService.getSessionHistory(sessionId, correlationId);

      // Send session history
      this.sendMessage(client, {
        type: 'session_history',
        data: {
          sessionId,
          messages: session.messages,
          messageCount: session.messageCount,
          createdAt: session.createdAt,
          correlationId
        }
      });

      logger.info('Client subscribed to session', {
        clientId: client.id,
        sessionId,
        correlationId
      });

    } catch (error) {
      logger.error('Error handling session subscription', {
        clientId: client.id,
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      this.sendError(client, 'Failed to subscribe to session', correlationId);
    }
  }

  /**
   * Handle session unsubscription
   */
  private async handleUnsubscribe(
    client: WebSocketClient, 
    message: WebSocketMessage, 
    correlationId: string
  ): Promise<void> {
    try {
      client.sessionId = undefined;

      this.sendMessage(client, {
        type: 'unsubscribed',
        data: {
          message: 'Unsubscribed from session',
          correlationId
        }
      });

      logger.info('Client unsubscribed from session', {
        clientId: client.id,
        correlationId
      });

    } catch (error) {
      logger.error('Error handling session unsubscription', {
        clientId: client.id,
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Send message to client
   */
  private sendMessage(client: WebSocketClient, message: any): void {
    try {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          ...message,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (error) {
      logger.error('Error sending WebSocket message', {
        clientId: client.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Send error message to client
   */
  private sendError(client: WebSocketClient, message: string, correlationId?: string): void {
    this.sendMessage(client, {
      type: 'error',
      data: {
        message,
        correlationId,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Check rate limiting for client
   */
  private checkRateLimit(client: WebSocketClient): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    // Reset counter if more than a minute has passed
    if (client.lastActivity < oneMinuteAgo) {
      client.messageCount = 0;
    }

    client.messageCount++;
    return client.messageCount <= this.maxMessagesPerMinute;
  }

  /**
   * Clean up inactive clients
   */
  private cleanupInactiveClients(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [clientId, client] of this.clients.entries()) {
      if (now - client.lastActivity > this.maxInactiveTime) {
        try {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.close(1000, 'Inactive timeout');
          }
        } catch (error) {
          // Ignore errors when closing inactive connections
        }
        
        this.clients.delete(clientId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up inactive WebSocket clients', {
        cleanedCount,
        remainingClients: this.clients.size
      });
    }
  }

  /**
   * Broadcast message to all clients in a session
   */
  broadcastToSession(sessionId: string, message: any): void {
    let broadcastCount = 0;

    for (const client of this.clients.values()) {
      if (client.sessionId === sessionId) {
        this.sendMessage(client, message);
        broadcastCount++;
      }
    }

    if (broadcastCount > 0) {
      logger.debug('Broadcasted message to session clients', {
        sessionId,
        clientCount: broadcastCount
      });
    }
  }

  /**
   * Get active client count
   */
  getActiveClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get clients by session
   */
  getSessionClientCount(sessionId: string): number {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.sessionId === sessionId) {
        count++;
      }
    }
    return count;
  }
}
