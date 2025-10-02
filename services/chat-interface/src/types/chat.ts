/**
 * Type definitions for chat interface
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    correlationId?: string;
    traces?: any[];
    citations?: any[];
    actionsTaken?: Array<{
      action: string;
      description: string;
      result: string;
      timestamp: string;
    }>;
    [key: string]: any;
  };
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: string;
  lastActivity: string;
  messageCount: number;
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    [key: string]: any;
  };
}

export interface ChatResponse {
  sessionId: string;
  messageId: string;
  content: string;
  formattedContent: string;
  actionsTaken?: Array<{
    action: string;
    description: string;
    result: string;
    timestamp: string;
  }>;
  citations?: any[];
  timestamp: string;
  metadata?: {
    correlationId?: string;
    messageCount?: number;
    sessionAge?: number;
    [key: string]: any;
  };
}

export interface ServiceStatus {
  healthy: boolean;
  version: string;
  uptime: number;
  activeSessions: number;
  bedrockAgent?: {
    healthy: boolean;
    configured: boolean;
    lastCheck: string;
    error?: string;
  };
  error?: string;
  timestamp: string;
}

export interface AgentInvokeRequest {
  sessionId: string;
  inputText: string;
  enableTrace: boolean;
  endSession: boolean;
}

export interface AgentInvokeResponse {
  sessionId: string;
  response: string;
  traces?: any[];
  citations?: any[];
  timestamp: string;
}

export interface WebSocketMessage {
  type: 'chat' | 'chat_response' | 'typing' | 'ping' | 'pong' | 'error' | 'system' | 'session_history' | 'unsubscribed';
  data?: any;
  messageId?: string;
  sessionId?: string;
  timestamp?: string;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  enableTrace?: boolean;
}

export interface SessionRequest {
  sessionId: string;
}

export interface ChatError {
  message: string;
  code: string;
  correlationId?: string;
  timestamp: string;
}

export interface Citation {
  generatedResponsePart?: {
    textResponsePart?: {
      text?: string;
      span?: {
        start?: number;
        end?: number;
      };
    };
  };
  retrievedReferences?: RetrievedReference[];
}

export interface RetrievedReference {
  content?: {
    text?: string;
  };
  location?: {
    type?: string;
    s3Location?: {
      uri?: string;
    };
  };
  metadata?: Record<string, any>;
}

export interface ActionTrace {
  type: string;
  actionGroupName?: string;
  actionDescription?: string;
  actionResult?: string;
  timestamp?: string;
  [key: string]: any;
}

export interface ChatMetrics {
  totalMessages: number;
  activeSessions: number;
  averageResponseTime: number;
  errorRate: number;
  lastActivity: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  enableNotifications: boolean;
  enableTrace: boolean;
  autoScroll: boolean;
  messageFormat: 'markdown' | 'plain';
}

export interface ChatConfiguration {
  maxMessageLength: number;
  maxSessionAge: number;
  maxMessagesPerSession: number;
  enableWebSocket: boolean;
  enablePersistence: boolean;
  rateLimitPerMinute: number;
}
