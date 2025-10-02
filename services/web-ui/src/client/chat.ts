/**
 * Chat page functionality
 * Handles AI assistant chat interface with WebSocket communication
 */

import { apiClient, NotificationManager, ErrorHandler, DateUtils } from './main';

interface ChatMessage {
  messageId: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  messageType: 'text' | 'code' | 'chart' | 'error';
  metadata?: Record<string, any>;
  timestamp: string;
}

interface ChatSession {
  sessionId: string;
  title: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

class ChatManager {
  private socket: any = null;
  private currentSessionId: string | null = null;
  private messages: ChatMessage[] = [];
  private sessions: ChatSession[] = [];
  private isConnected = false;
  private typingTimeout: number | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.setupEventListeners();
    this.setupWebSocket();
    await this.loadSessions();
    this.setupMarkdownProcessor();
  }

  private setupEventListeners(): void {
    // Send message
    const sendButton = document.getElementById('sendButton');
    const messageInput = document.getElementById('messageInput') as HTMLTextAreaElement;

    if (sendButton && messageInput) {
      sendButton.addEventListener('click', () => this.sendMessage());
      
      messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      messageInput.addEventListener('input', () => {
        this.handleInputChange();
        this.handleTyping();
      });
    }

    // New chat button
    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => this.createNewSession());
    }

    // Quick actions
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const quickAction = target.closest('.quick-action');
      
      if (quickAction) {
        const message = quickAction.getAttribute('data-message');
        if (message) {
          this.sendQuickMessage(message);
        }
      }
    });

    // Mobile sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const chatSidebar = document.getElementById('chatSidebar');

    if (sidebarToggle && chatSidebar) {
      sidebarToggle.addEventListener('click', () => {
        chatSidebar.classList.toggle('show');
      });
    }
  }

  private setupWebSocket(): void {
    try {
      // Initialize Socket.IO connection
      this.socket = (window as any).io({
        auth: {
          token: localStorage.getItem('ai-compliance-token') || 'demo-token'
        },
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.updateConnectionStatus(true);
        console.log('Connected to chat server');
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        this.updateConnectionStatus(false);
        console.log('Disconnected from chat server');
      });

      this.socket.on('connection:welcome', (data: any) => {
        console.log('Welcome message:', data);
      });

      this.socket.on('chat:message:received', (data: any) => {
        console.log('Message received confirmation:', data);
      });

      this.socket.on('chat:typing', (data: any) => {
        if (data.userId !== 'current-user-id') { // Don't show own typing
          this.showTypingIndicator(data.typing);
        }
      });

      this.socket.on('chat:error', (data: any) => {
        console.error('Chat error:', data);
        NotificationManager.error(data.error || 'Chat error occurred');
      });

    } catch (error) {
      console.error('WebSocket setup failed:', error);
      this.isConnected = false;
      this.updateConnectionStatus(false);
    }
  }

  private updateConnectionStatus(connected: boolean): void {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
      statusElement.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
      statusElement.innerHTML = `
        <i class="bi bi-${connected ? 'wifi' : 'wifi-off'} me-1"></i>
        ${connected ? 'Connected' : 'Disconnected'}
      `;
    }
  }

  private setupMarkdownProcessor(): void {
    // Configure marked.js for markdown processing
    if ((window as any).marked) {
      const marked = (window as any).marked;
      
      marked.setOptions({
        highlight: function(code: string, lang: string) {
          if ((window as any).hljs && lang && (window as any).hljs.getLanguage(lang)) {
            try {
              return (window as any).hljs.highlight(code, { language: lang }).value;
            } catch (err) {
              console.error('Highlight.js error:', err);
            }
          }
          return code;
        },
        breaks: true,
        gfm: true
      });
    }
  }

  private async loadSessions(): Promise<void> {
    try {
      this.sessions = await apiClient.get('/chat/sessions', { limit: 20 });
      this.renderSessions();
      
      // Load the most recent session if available
      if (this.sessions.length > 0 && !this.currentSessionId) {
        await this.loadSession(this.sessions[0].sessionId);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
      // Continue with empty sessions list
    }
  }

  private renderSessions(): void {
    const container = document.getElementById('chatSessions');
    if (!container) return;

    if (this.sessions.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted">
          <i class="bi bi-chat-dots display-6 mb-3"></i>
          <p>No chat sessions yet.<br>Start a new conversation!</p>
        </div>
      `;
      return;
    }

    const sessionsHtml = this.sessions.map(session => `
      <div class="session-item ${session.sessionId === this.currentSessionId ? 'active' : ''}" 
           data-session-id="${session.sessionId}">
        <div class="session-title">${session.title}</div>
        <div class="session-preview">
          ${session.messageCount} message${session.messageCount !== 1 ? 's' : ''} • 
          ${DateUtils.formatRelative(session.updatedAt)}
        </div>
      </div>
    `).join('');

    container.innerHTML = sessionsHtml;

    // Add click handlers for sessions
    container.querySelectorAll('.session-item').forEach(item => {
      item.addEventListener('click', () => {
        const sessionId = item.getAttribute('data-session-id');
        if (sessionId) {
          this.loadSession(sessionId);
        }
      });
    });
  }

  private async createNewSession(): Promise<void> {
    try {
      const session = await apiClient.post('/chat/sessions');
      this.sessions.unshift(session);
      this.renderSessions();
      await this.loadSession(session.sessionId);
      NotificationManager.success('New chat session created');
    } catch (error) {
      ErrorHandler.handle(error, 'Failed to create new session');
    }
  }

  private async loadSession(sessionId: string): Promise<void> {
    try {
      this.currentSessionId = sessionId;
      
      // Update active session in UI
      document.querySelectorAll('.session-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-session-id') === sessionId) {
          item.classList.add('active');
        }
      });

      // Join session via WebSocket
      if (this.socket && this.isConnected) {
        this.socket.emit('chat:join', { sessionId });
      }

      // Load session messages
      this.messages = await apiClient.get(`/chat/sessions/${sessionId}/messages`, { limit: 50 });
      this.renderMessages();

    } catch (error) {
      ErrorHandler.handle(error, 'Failed to load session');
    }
  }

  private renderMessages(): void {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    if (this.messages.length === 0) {
      // Show welcome message if no messages
      return;
    }

    const messagesHtml = this.messages.map(message => this.renderMessage(message)).join('');
    
    // Keep welcome message and add conversation messages
    const welcomeContent = container.querySelector('.text-center');
    if (welcomeContent) {
      container.innerHTML = '';
      container.appendChild(welcomeContent);
      container.insertAdjacentHTML('beforeend', messagesHtml);
    } else {
      container.innerHTML = messagesHtml;
    }

    this.scrollToBottom();
  }

  private renderMessage(message: ChatMessage): string {
    const isUser = message.role === 'user';
    const content = this.processMessageContent(message.content, message.messageType);
    
    return `
      <div class="message ${isUser ? 'user' : 'assistant'}">
        <div class="message-avatar">
          <i class="bi bi-${isUser ? 'person' : 'robot'}"></i>
        </div>
        <div class="message-content">
          <div class="message-text">${content}</div>
          <div class="message-time">${DateUtils.formatTime(message.timestamp)}</div>
        </div>
      </div>
    `;
  }

  private processMessageContent(content: string, messageType: string): string {
    if (messageType === 'code') {
      return `<pre><code>${this.escapeHtml(content)}</code></pre>`;
    }
    
    // Process markdown if marked.js is available
    if ((window as any).marked) {
      try {
        const html = (window as any).marked.parse(content);
        // Sanitize HTML if DOMPurify is available
        return (window as any).DOMPurify ? (window as any).DOMPurify.sanitize(html) : html;
      } catch (error) {
        console.error('Markdown processing error:', error);
      }
    }
    
    // Fallback to plain text with basic formatting
    return this.escapeHtml(content).replace(/\n/g, '<br>');
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private handleInputChange(): void {
    const messageInput = document.getElementById('messageInput') as HTMLTextAreaElement;
    const sendButton = document.getElementById('sendButton') as HTMLButtonElement;
    
    if (messageInput && sendButton) {
      const hasContent = messageInput.value.trim().length > 0;
      sendButton.disabled = !hasContent || !this.isConnected;
      
      // Auto-resize textarea
      messageInput.style.height = 'auto';
      messageInput.style.height = messageInput.scrollHeight + 'px';
    }
  }

  private handleTyping(): void {
    if (!this.socket || !this.isConnected || !this.currentSessionId) return;

    // Clear previous timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    // Send typing indicator
    this.socket.emit('chat:typing', {
      sessionId: this.currentSessionId,
      typing: true
    });

    // Stop typing after 3 seconds
    this.typingTimeout = window.setTimeout(() => {
      this.socket.emit('chat:typing', {
        sessionId: this.currentSessionId,
        typing: false
      });
    }, 3000);
  }

  private showTypingIndicator(show: boolean): void {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
      indicator.style.display = show ? 'block' : 'none';
      if (show) {
        this.scrollToBottom();
      }
    }
  }

  private async sendMessage(): Promise<void> {
    const messageInput = document.getElementById('messageInput') as HTMLTextAreaElement;
    const message = messageInput.value.trim();

    if (!message || !this.currentSessionId) return;

    try {
      // Clear input immediately
      messageInput.value = '';
      this.handleInputChange();

      // Create temporary user message
      const userMessage: ChatMessage = {
        messageId: `temp-${Date.now()}`,
        sessionId: this.currentSessionId,
        role: 'user',
        content: message,
        messageType: 'text',
        timestamp: new Date().toISOString()
      };

      // Add to messages and render
      this.messages.push(userMessage);
      this.appendMessage(userMessage);

      // Show typing indicator
      this.showTypingIndicator(true);

      // Send via WebSocket
      if (this.socket && this.isConnected) {
        this.socket.emit('chat:message', {
          sessionId: this.currentSessionId,
          message,
          messageId: userMessage.messageId
        });
      }

      // Send to API
      const response = await apiClient.post(`/chat/sessions/${this.currentSessionId}/messages`, {
        message,
        messageType: 'text'
      });

      // Hide typing indicator
      this.showTypingIndicator(false);

      // Add assistant response
      this.messages.push(response);
      this.appendMessage(response);

    } catch (error) {
      this.showTypingIndicator(false);
      ErrorHandler.handle(error, 'Failed to send message');
    }
  }

  private sendQuickMessage(message: string): void {
    const messageInput = document.getElementById('messageInput') as HTMLTextAreaElement;
    if (messageInput) {
      messageInput.value = message;
      this.handleInputChange();
      this.sendMessage();
    }
  }

  private appendMessage(message: ChatMessage): void {
    const container = document.getElementById('chatMessages');
    if (container) {
      container.insertAdjacentHTML('beforeend', this.renderMessage(message));
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    const container = document.getElementById('chatMessages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }
}

// Initialize chat when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ChatManager();
});
