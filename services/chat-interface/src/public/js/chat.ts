/**
 * Chat interface client-side JavaScript
 * Handles WebSocket communication and UI interactions
 */

interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  metadata?: any;
}

interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: string;
  lastActivity: string;
  messageCount: number;
}

interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: string;
}

class ChatInterface {
  private ws: WebSocket | null = null;
  private currentSessionId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private messageQueue: any[] = [];

  // DOM elements
  private chatMessages: HTMLElement;
  private messageInput: HTMLTextAreaElement;
  private sendButton: HTMLButtonElement;
  private connectionStatus: HTMLElement;
  private sessionInfo: HTMLElement;
  private typingIndicator: HTMLElement;
  private sessionList: HTMLElement;
  private enableTraceCheckbox: HTMLInputElement;
  private autoScrollCheckbox: HTMLInputElement;

  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.connect();
    this.loadSessions();
  }

  private initializeElements(): void {
    this.chatMessages = document.getElementById('chatMessages')!;
    this.messageInput = document.getElementById('messageInput') as HTMLTextAreaElement;
    this.sendButton = document.getElementById('sendButton') as HTMLButtonElement;
    this.connectionStatus = document.getElementById('connectionStatus')!;
    this.sessionInfo = document.getElementById('sessionInfo')!;
    this.typingIndicator = document.getElementById('typingIndicator')!;
    this.sessionList = document.getElementById('sessionList')!;
    this.enableTraceCheckbox = document.getElementById('enableTrace') as HTMLInputElement;
    this.autoScrollCheckbox = document.getElementById('autoScroll') as HTMLInputElement;
  }

  private setupEventListeners(): void {
    // Send message on button click
    this.sendButton.addEventListener('click', () => this.sendMessage());

    // Send message on Enter key (but not Shift+Enter)
    this.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    this.messageInput.addEventListener('input', () => {
      this.messageInput.style.height = 'auto';
      this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
    });

    // Handle window beforeunload
    window.addEventListener('beforeunload', () => {
      if (this.ws) {
        this.ws.close();
      }
    });

    // Handle window focus/blur for reconnection
    window.addEventListener('focus', () => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.connect();
      }
    });
  }

  private connect(): void {
    if (this.isConnecting) return;
    
    this.isConnecting = true;
    this.updateConnectionStatus('connecting', 'Connecting...');

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.updateConnectionStatus('connected', 'Connected');
        
        // Process queued messages
        this.processMessageQueue();
        
        // Subscribe to current session if exists
        if (this.currentSessionId) {
          this.subscribeToSession(this.currentSessionId);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        this.isConnecting = false;
        this.ws = null;
        this.updateConnectionStatus('disconnected', 'Disconnected');
        
        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
          }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.updateConnectionStatus('disconnected', 'Connection error');
      };

    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.isConnecting = false;
      this.updateConnectionStatus('disconnected', 'Connection failed');
    }
  }

  private handleWebSocketMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'chat_response':
        this.handleChatResponse(message.data);
        break;
      
      case 'typing':
        this.handleTypingIndicator(message.data.typing);
        break;
      
      case 'session_history':
        this.handleSessionHistory(message.data);
        break;
      
      case 'error':
        this.handleError(message.data);
        break;
      
      case 'system':
        console.log('System message:', message.data.message);
        break;
      
      case 'ping':
        // Respond to ping with pong
        this.sendWebSocketMessage({ type: 'pong' });
        break;
      
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private handleChatResponse(data: any): void {
    this.hideTypingIndicator();
    
    // Add agent message to UI
    this.addMessage({
      id: data.messageId,
      role: 'agent',
      content: data.content,
      timestamp: data.timestamp,
      metadata: {
        formattedContent: data.formattedContent,
        actionsTaken: data.actionsTaken,
        citations: data.citations
      }
    });

    // Update session info
    this.currentSessionId = data.sessionId;
    this.updateSessionInfo();
    
    // Re-enable input
    this.setInputEnabled(true);
  }

  private handleTypingIndicator(typing: boolean): void {
    if (typing) {
      this.showTypingIndicator();
    } else {
      this.hideTypingIndicator();
    }
  }

  private handleSessionHistory(data: any): void {
    this.currentSessionId = data.sessionId;
    
    // Clear current messages
    this.clearMessages();
    
    // Add messages from history
    data.messages.forEach((message: ChatMessage) => {
      this.addMessage(message);
    });
    
    this.updateSessionInfo();
  }

  private handleError(data: any): void {
    this.hideTypingIndicator();
    this.setInputEnabled(true);
    
    this.showError(data.message || 'An error occurred');
  }

  public sendMessage(): void {
    const message = this.messageInput.value.trim();
    if (!message) return;

    // Add user message to UI
    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    
    this.addMessage(userMessage);
    
    // Clear input and disable it
    this.messageInput.value = '';
    this.messageInput.style.height = 'auto';
    this.setInputEnabled(false);
    
    // Show typing indicator
    this.showTypingIndicator();
    
    // Send via WebSocket
    const wsMessage = {
      type: 'chat',
      sessionId: this.currentSessionId,
      data: {
        message,
        enableTrace: this.enableTraceCheckbox.checked
      }
    };
    
    this.sendWebSocketMessage(wsMessage);
  }

  private sendWebSocketMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for later
      this.messageQueue.push(message);
      
      // Try to reconnect if not already connecting
      if (!this.isConnecting) {
        this.connect();
      }
    }
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.sendWebSocketMessage(message);
    }
  }

  private addMessage(message: ChatMessage): void {
    const messageElement = this.createMessageElement(message);
    this.chatMessages.appendChild(messageElement);
    
    if (this.autoScrollCheckbox.checked) {
      this.scrollToBottom();
    }
  }

  private createMessageElement(message: ChatMessage): HTMLElement {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${message.role}`;
    messageDiv.setAttribute('data-message-id', message.id);

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Format content based on role
    if (message.role === 'agent' && message.metadata?.formattedContent) {
      contentDiv.innerHTML = DOMPurify.sanitize(message.metadata.formattedContent);
    } else {
      contentDiv.textContent = message.content;
    }

    bubbleDiv.appendChild(contentDiv);

    // Add timestamp
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'message-timestamp';
    timestampDiv.textContent = this.formatTimestamp(message.timestamp);
    bubbleDiv.appendChild(timestampDiv);

    // Add actions if present
    if (message.metadata?.actionsTaken && message.metadata.actionsTaken.length > 0) {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'message-actions';
      
      const actionsTitle = document.createElement('div');
      actionsTitle.innerHTML = '<strong><i class="fas fa-cog me-1"></i>Actions Taken:</strong>';
      actionsDiv.appendChild(actionsTitle);

      message.metadata.actionsTaken.forEach((action: any) => {
        const actionDiv = document.createElement('div');
        actionDiv.className = 'action-item';
        actionDiv.innerHTML = `
          <div class="action-name">${this.escapeHtml(action.action)}</div>
          <div>${this.escapeHtml(action.description)}</div>
          <small class="text-muted">${this.escapeHtml(action.result)}</small>
        `;
        actionsDiv.appendChild(actionDiv);
      });

      bubbleDiv.appendChild(actionsDiv);
    }

    // Add citations if present
    if (message.metadata?.citations && message.metadata.citations.length > 0) {
      const citationsDiv = document.createElement('div');
      citationsDiv.className = 'citations';
      
      const citationsTitle = document.createElement('div');
      citationsTitle.innerHTML = '<strong><i class="fas fa-quote-right me-1"></i>Sources:</strong>';
      citationsDiv.appendChild(citationsTitle);

      message.metadata.citations.forEach((citation: any, index: number) => {
        if (citation.retrievedReferences) {
          citation.retrievedReferences.forEach((ref: any) => {
            const citationDiv = document.createElement('div');
            citationDiv.className = 'citation';
            citationDiv.innerHTML = `
              <small>
                <strong>Reference ${index + 1}:</strong> 
                ${this.escapeHtml(ref.content?.text?.substring(0, 100) || 'Knowledge base reference')}...
              </small>
            `;
            citationsDiv.appendChild(citationDiv);
          });
        }
      });

      bubbleDiv.appendChild(citationsDiv);
    }

    messageDiv.appendChild(bubbleDiv);

    // Highlight code blocks
    setTimeout(() => {
      const codeBlocks = messageDiv.querySelectorAll('pre code');
      codeBlocks.forEach((block) => {
        hljs.highlightElement(block as HTMLElement);
      });
    }, 0);

    return messageDiv;
  }

  private showTypingIndicator(): void {
    this.typingIndicator.style.display = 'block';
    if (this.autoScrollCheckbox.checked) {
      this.scrollToBottom();
    }
  }

  private hideTypingIndicator(): void {
    this.typingIndicator.style.display = 'none';
  }

  private setInputEnabled(enabled: boolean): void {
    this.messageInput.disabled = !enabled;
    this.sendButton.disabled = !enabled;
    
    if (enabled) {
      this.messageInput.focus();
    }
  }

  private updateConnectionStatus(status: 'connected' | 'disconnected' | 'connecting', message: string): void {
    this.connectionStatus.className = `connection-status ${status}`;
    this.connectionStatus.textContent = message;
  }

  private updateSessionInfo(): void {
    if (this.currentSessionId) {
      this.sessionInfo.textContent = `Session: ${this.currentSessionId.substring(0, 8)}...`;
    } else {
      this.sessionInfo.textContent = 'Ready to help with compliance';
    }
  }

  private scrollToBottom(): void {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  private clearMessages(): void {
    this.chatMessages.innerHTML = '';
  }

  private showError(message: string): void {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>${this.escapeHtml(message)}`;
    
    this.chatMessages.appendChild(errorDiv);
    
    if (this.autoScrollCheckbox.checked) {
      this.scrollToBottom();
    }

    // Remove error after 5 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 5000);
  }

  private subscribeToSession(sessionId: string): void {
    this.sendWebSocketMessage({
      type: 'subscribe',
      sessionId
    });
  }

  private loadSessions(): void {
    // For now, just show current session
    // In a full implementation, this would load from localStorage or API
    this.updateSessionList([]);
  }

  private updateSessionList(sessions: ChatSession[]): void {
    this.sessionList.innerHTML = '';
    
    if (sessions.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'text-muted text-center';
      emptyDiv.innerHTML = '<small>No previous sessions</small>';
      this.sessionList.appendChild(emptyDiv);
      return;
    }

    sessions.forEach(session => {
      const sessionDiv = document.createElement('div');
      sessionDiv.className = 'session-item';
      if (session.id === this.currentSessionId) {
        sessionDiv.classList.add('active');
      }
      
      sessionDiv.innerHTML = `
        <div class="fw-bold">${session.id.substring(0, 8)}...</div>
        <div class="small text-muted">${session.messageCount} messages</div>
        <div class="small text-muted">${this.formatTimestamp(session.lastActivity)}</div>
      `;
      
      sessionDiv.addEventListener('click', () => {
        this.loadSession(session.id);
      });
      
      this.sessionList.appendChild(sessionDiv);
    });
  }

  private loadSession(sessionId: string): void {
    this.subscribeToSession(sessionId);
    this.updateSessionList([]);
  }

  private formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) { // Less than 1 minute
      return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
      return `${Math.floor(diff / 60000)}m ago`;
    } else if (diff < 86400000) { // Less than 1 day
      return `${Math.floor(diff / 3600000)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private generateId(): string {
    return 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  // Public methods for global access
  public startNewSession(): void {
    this.currentSessionId = null;
    this.clearMessages();
    this.updateSessionInfo();
    this.messageInput.focus();
  }

  public clearCurrentSession(): void {
    if (this.currentSessionId && confirm('Are you sure you want to clear this chat session?')) {
      this.clearMessages();
      this.currentSessionId = null;
      this.updateSessionInfo();
    }
  }

  public toggleSidebar(): void {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.toggle('show');
    }
  }

  public showHelp(): void {
    const helpMessage: ChatMessage = {
      id: this.generateId(),
      role: 'system',
      content: `Here are some example questions you can ask:

• "Scan my AWS environment for compliance issues"
• "What are the SOC 2 requirements for data encryption?"
• "Generate a compliance report for my last scan"
• "Fix the S3 bucket security issues you found"
• "Analyze this Terraform plan for compliance"
• "Show me all critical findings from yesterday"
• "What GDPR controls do I need for my application?"
• "Help me understand HIPAA requirements"

You can also upload Terraform files or ask about specific AWS services and configurations.`,
      timestamp: new Date().toISOString()
    };
    
    this.addMessage(helpMessage);
  }
}

// Global functions
let chatInterface: ChatInterface;

function startNewSession(): void {
  chatInterface.startNewSession();
}

function clearCurrentSession(): void {
  chatInterface.clearCurrentSession();
}

function toggleSidebar(): void {
  chatInterface.toggleSidebar();
}

function showHelp(): void {
  chatInterface.showHelp();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  chatInterface = new ChatInterface();
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ChatInterface };
}
