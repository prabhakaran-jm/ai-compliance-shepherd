# Chat Interface Service

The Chat Interface service provides a modern, responsive web-based chat interface for interacting with the AI Compliance Shepherd. It offers real-time communication through WebSockets, a beautiful UI, and comprehensive chat management features.

## Overview

This service creates a conversational web interface that allows users to:

- **Chat with AI Agent**: Natural language conversations with the Bedrock Agent
- **Real-time Communication**: WebSocket-based messaging for instant responses
- **Session Management**: Persistent chat sessions with history
- **Rich Message Formatting**: Markdown support, code highlighting, and action displays
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Browser   │───▶│  Chat Interface  │───▶│ Bedrock Agent   │
│   (React/JS)    │◄───│   (Express +     │◄───│   (Lambda)      │
│                 │    │   WebSocket)     │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │ Session Storage  │    │ Compliance      │
                       │ (S3 + Memory)    │    │ Operations      │
                       └──────────────────┘    └─────────────────┘
```

## Features

### 🌐 **Modern Web Interface**

- **Responsive Design**: Bootstrap 5-based UI that works on all devices
- **Real-time Chat**: WebSocket connections for instant messaging
- **Rich Text Support**: Markdown rendering with syntax highlighting
- **Dark/Light Themes**: Automatic theme detection and manual override
- **Mobile Optimized**: Touch-friendly interface with collapsible sidebar

### 💬 **Advanced Chat Features**

- **Session Management**: Persistent chat sessions with unique IDs
- **Message History**: Full conversation history with timestamps
- **Typing Indicators**: Real-time typing status from the AI
- **Message Actions**: Display of actions taken by the AI (scans, fixes, etc.)
- **Citations**: Source references for AI responses with knowledge base links
- **Error Handling**: Graceful error display with retry mechanisms

### 🔄 **Real-time Communication**

- **WebSocket Protocol**: Bi-directional real-time communication
- **Auto-reconnection**: Automatic reconnection with exponential backoff
- **Message Queuing**: Queues messages during disconnections
- **Connection Status**: Visual connection status indicators
- **Rate Limiting**: Built-in rate limiting to prevent abuse

### 🛡️ **Security & Validation**

- **Input Sanitization**: XSS protection with DOMPurify
- **Content Security Policy**: Strict CSP headers for security
- **Rate Limiting**: Per-client rate limiting on messages
- **Session Validation**: Session age and message count limits
- **CORS Protection**: Configurable CORS for cross-origin requests

## API Endpoints

### POST /api/chat/message
Send a message to the AI agent.

**Request:**
```json
{
  "message": "Scan my AWS environment for compliance issues",
  "sessionId": "optional-session-uuid",
  "enableTrace": false
}
```

**Response:**
```json
{
  "success": true,
  "correlationId": "chat-123456789",
  "result": {
    "sessionId": "session-uuid",
    "messageId": "msg-uuid",
    "content": "I'll start scanning your AWS environment...",
    "formattedContent": "<p>I'll start scanning your AWS environment...</p>",
    "actionsTaken": [
      {
        "action": "ScanActions",
        "description": "Started environment scan",
        "result": "Scan initiated successfully",
        "timestamp": "2024-01-15T10:30:00Z"
      }
    ],
    "citations": [],
    "timestamp": "2024-01-15T10:30:00Z",
    "metadata": {
      "correlationId": "chat-123456789",
      "messageCount": 2,
      "sessionAge": 1500
    }
  }
}
```

### GET /api/chat/sessions/:sessionId
Retrieve chat session history.

**Response:**
```json
{
  "success": true,
  "correlationId": "session-123456789",
  "result": {
    "id": "session-uuid",
    "messages": [
      {
        "id": "msg-1",
        "role": "user",
        "content": "Hello",
        "timestamp": "2024-01-15T10:29:00Z"
      },
      {
        "id": "msg-2",
        "role": "agent",
        "content": "Hello! How can I help you with compliance today?",
        "timestamp": "2024-01-15T10:29:05Z",
        "metadata": {
          "formattedContent": "<p>Hello! How can I help you with compliance today?</p>"
        }
      }
    ],
    "createdAt": "2024-01-15T10:29:00Z",
    "lastActivity": "2024-01-15T10:30:00Z",
    "messageCount": 2
  }
}
```

### DELETE /api/chat/sessions/:sessionId
Clear a chat session.

**Response:**
```json
{
  "success": true,
  "correlationId": "clear-123456789",
  "message": "Session cleared successfully"
}
```

### GET /api/chat/status
Get chat service status and health.

**Response:**
```json
{
  "success": true,
  "correlationId": "status-123456789",
  "result": {
    "healthy": true,
    "version": "1.0.0",
    "uptime": 3600,
    "activeSessions": 5,
    "bedrockAgent": {
      "healthy": true,
      "configured": true,
      "lastCheck": "2024-01-15T10:30:00Z"
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## WebSocket Protocol

### Connection
Connect to WebSocket endpoint: `ws://localhost:8080/ws` or `wss://domain.com/ws`

### Message Types

#### Chat Message (Client → Server)
```json
{
  "type": "chat",
  "sessionId": "optional-session-uuid",
  "data": {
    "message": "What are SOC 2 requirements?",
    "enableTrace": false
  }
}
```

#### Chat Response (Server → Client)
```json
{
  "type": "chat_response",
  "data": {
    "messageId": "msg-uuid",
    "sessionId": "session-uuid",
    "content": "SOC 2 requirements include...",
    "formattedContent": "<p>SOC 2 requirements include...</p>",
    "actionsTaken": [],
    "citations": [],
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### Typing Indicator (Server → Client)
```json
{
  "type": "typing",
  "data": {
    "typing": true
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### Session Subscription (Client → Server)
```json
{
  "type": "subscribe",
  "sessionId": "session-uuid"
}
```

#### Error Message (Server → Client)
```json
{
  "type": "error",
  "data": {
    "message": "Rate limit exceeded",
    "code": "RATE_LIMIT_ERROR",
    "correlationId": "ws-error-123"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Frontend Features

### User Interface Components

**Chat Header**
- Service branding and status
- Connection indicator
- Session information
- Action buttons (clear, help)

**Message Area**
- Scrollable message history
- Rich message formatting
- Action displays
- Citation references
- Typing indicators

**Input Area**
- Multi-line text input
- Send button with loading state
- Character counter
- Keyboard shortcuts

**Sidebar**
- Session list
- Settings panel
- Trace toggle
- Auto-scroll toggle

### Message Formatting

The interface supports rich message formatting:

**Markdown Support**
- Headers (H1, H2, H3)
- Bold and italic text
- Code blocks with syntax highlighting
- Lists (ordered and unordered)
- Blockquotes
- Links

**Code Highlighting**
- Automatic language detection
- Syntax highlighting with Highlight.js
- Copy code functionality
- Line numbers for long blocks

**Action Display**
- Visual indicators for AI actions
- Action descriptions and results
- Timestamps for each action
- Success/failure indicators

**Citations**
- Source references from knowledge base
- Expandable citation details
- Links to original sources
- Reference numbering

### Responsive Design

**Desktop (≥768px)**
- Full sidebar visible
- Wide message bubbles
- Keyboard shortcuts enabled
- Multi-column layout

**Mobile (<768px)**
- Collapsible sidebar
- Touch-optimized controls
- Swipe gestures
- Compact message layout

## Setup and Configuration

### Prerequisites

- Node.js 18+ and npm
- AWS account with Bedrock access
- Bedrock Agent Lambda deployed
- Optional: S3 bucket for session persistence

### Environment Variables

```bash
# Required
PORT=8080
HOST=0.0.0.0
BEDROCK_AGENT_LAMBDA_ARN=arn:aws:lambda:us-east-1:123456789012:function:bedrock-agent
AWS_REGION=us-east-1

# Optional
CHAT_SESSIONS_BUCKET=my-chat-sessions-bucket
ALLOWED_ORIGINS=http://localhost:3000,https://mydomain.com
LOG_LEVEL=INFO
NODE_ENV=production
```

### Installation and Build

```bash
# Install dependencies
npm install

# Development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY src/public/ ./dist/public/

EXPOSE 8080
CMD ["node", "dist/index.js"]
```

## Usage Examples

### Basic Chat Interaction

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8080/ws');

// Send a message
ws.send(JSON.stringify({
  type: 'chat',
  data: {
    message: 'Scan my AWS environment for compliance issues'
  }
}));

// Handle response
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'chat_response') {
    console.log('AI Response:', message.data.content);
    console.log('Actions Taken:', message.data.actionsTaken);
  }
};
```

### REST API Usage

```bash
# Send a chat message
curl -X POST http://localhost:8080/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the SOC 2 requirements for encryption?",
    "enableTrace": true
  }'

# Get session history
curl -X GET http://localhost:8080/api/chat/sessions/session-uuid

# Check service status
curl -X GET http://localhost:8080/api/chat/status
```

### Integration with React

```jsx
import React, { useState, useEffect } from 'react';

function ChatComponent() {
  const [ws, setWs] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    const websocket = new WebSocket('ws://localhost:8080/ws');
    
    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'chat_response') {
        setMessages(prev => [...prev, {
          role: 'agent',
          content: message.data.content,
          timestamp: message.data.timestamp
        }]);
      }
    };

    setWs(websocket);
    return () => websocket.close();
  }, []);

  const sendMessage = () => {
    if (ws && inputText.trim()) {
      setMessages(prev => [...prev, {
        role: 'user',
        content: inputText,
        timestamp: new Date().toISOString()
      }]);

      ws.send(JSON.stringify({
        type: 'chat',
        data: { message: inputText }
      }));

      setInputText('');
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>
      <div className="input-area">
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask about compliance..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
```

## Security Considerations

### Input Validation
- All user inputs are validated and sanitized
- XSS prevention with DOMPurify
- Maximum message length enforcement
- Malicious content detection

### Rate Limiting
- Per-client message rate limiting
- WebSocket connection limits
- API endpoint rate limiting
- Exponential backoff for reconnections

### Content Security Policy
```
default-src 'self';
script-src 'self' 'unsafe-inline' cdn.jsdelivr.net cdnjs.cloudflare.com;
style-src 'self' 'unsafe-inline' cdn.jsdelivr.net fonts.googleapis.com;
font-src 'self' fonts.gstatic.com;
img-src 'self' data: https:;
connect-src 'self' ws: wss:;
```

### Session Security
- Session expiration (24 hours default)
- Message count limits per session
- Secure session storage with encryption
- CORS protection for cross-origin requests

## Monitoring and Logging

### Structured Logging

All operations are logged with structured JSON:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "service": "chat-interface",
  "version": "1.0.0",
  "message": "Chat message processed",
  "correlationId": "chat-123456789",
  "sessionId": "session-uuid",
  "messageLength": 45,
  "clientId": "client-abc123"
}
```

### Performance Metrics

Key metrics to monitor:
- Message processing time
- WebSocket connection count
- Session creation/cleanup rates
- Error rates by type
- Memory usage for session storage

### Health Checks

Built-in health check endpoint:
```bash
curl http://localhost:8080/health
```

Returns service health, uptime, and dependency status.

## Troubleshooting

### Common Issues

**WebSocket Connection Fails**
```bash
# Check if service is running
curl http://localhost:8080/health

# Check WebSocket endpoint
wscat -c ws://localhost:8080/ws
```

**Messages Not Sending**
- Check Bedrock Agent Lambda configuration
- Verify AWS credentials and permissions
- Check CloudWatch logs for Lambda errors

**Session Not Persisting**
- Verify S3 bucket configuration
- Check AWS permissions for S3 access
- Review session storage logs

### Debug Mode

Enable debug logging:
```bash
export LOG_LEVEL=DEBUG
npm start
```

This provides detailed logs for:
- WebSocket connection events
- Message processing steps
- Session management operations
- AWS service interactions

### Performance Optimization

**Memory Management**
- Session cleanup runs every hour
- Configurable session limits
- Automatic old session removal

**Connection Optimization**
- WebSocket keep-alive pings
- Automatic reconnection logic
- Message queuing during disconnections

**Caching**
- In-memory session caching
- Persistent storage for long sessions
- Efficient message serialization

## Development

### Local Development

```bash
# Start development server with hot reload
npm run dev

# Run frontend development server
npm run dev:frontend

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint
```

### Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --testNamePattern="ChatInterfaceService"

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

### Building

```bash
# Build TypeScript
npm run build

# Build frontend assets
npm run build:static

# Clean build artifacts
npm run clean
```

This Chat Interface service provides a complete, production-ready web interface for interacting with the AI Compliance Shepherd, offering real-time communication, rich formatting, and comprehensive session management.
