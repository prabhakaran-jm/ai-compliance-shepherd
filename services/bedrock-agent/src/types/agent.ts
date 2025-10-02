/**
 * Type definitions for Bedrock Agent operations
 */

export interface AgentRequest {
  sessionId?: string;
  inputText: string;
  enableTrace?: boolean;
  endSession?: boolean;
}

export interface AgentResponse {
  sessionId: string;
  response: string;
  traces?: any[];
  citations?: any[];
  timestamp: string;
}

export interface AgentStatus {
  configured: boolean;
  agentId?: string;
  agentName?: string;
  agentStatus?: string;
  foundationModel?: string;
  instruction?: string;
  actionGroups?: ActionGroupSummary[];
  createdAt?: string;
  updatedAt?: string;
  message?: string;
}

export interface ActionGroupSummary {
  actionGroupId: string;
  actionGroupName: string;
  actionGroupState: string;
  description?: string;
}

export interface ActionGroupDefinition {
  actionGroupName: string;
  description: string;
  actionGroupExecutor: {
    lambda: string;
  };
  apiSchema: {
    payload: string;
  };
}

export interface AgentConfiguration {
  agentName: string;
  description: string;
  foundationModel: string;
  instruction: string;
  agentResourceRoleArn: string;
  idleSessionTTLInSeconds?: number;
}

export interface ActionGroupConfiguration {
  actionGroupName: string;
  description: string;
  actionGroupExecutor: {
    lambda: string;
  };
  apiSchema: {
    payload: string;
  };
  actionGroupState: 'ENABLED' | 'DISABLED';
}

export interface AgentInvocationResult {
  sessionId: string;
  response: string;
  traces?: AgentTrace[];
  citations?: AgentCitation[];
  timestamp: string;
}

export interface AgentTrace {
  traceId?: string;
  timestamp?: string;
  type?: string;
  content?: any;
}

export interface AgentCitation {
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

export interface ChatRequest {
  message: string;
  sessionId?: string;
  context?: Record<string, any>;
}

export interface ChatResponse {
  response: string;
  sessionId: string;
  citations?: AgentCitation[];
  timestamp: string;
}

export interface AgentSession {
  sessionId: string;
  agentId: string;
  createdAt: string;
  lastInteractionAt: string;
  messageCount: number;
  status: 'active' | 'ended';
}

export interface AgentMetrics {
  totalInvocations: number;
  averageResponseTime: number;
  successRate: number;
  errorRate: number;
  lastInvocation?: string;
}

export interface ActionGroupMetrics {
  actionGroupName: string;
  invocationCount: number;
  successCount: number;
  errorCount: number;
  averageExecutionTime: number;
}

export interface AgentError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface AgentAuditLog {
  timestamp: string;
  sessionId: string;
  action: string;
  input?: string;
  output?: string;
  duration?: number;
  success: boolean;
  error?: string;
  userId?: string;
  tenantId?: string;
}
