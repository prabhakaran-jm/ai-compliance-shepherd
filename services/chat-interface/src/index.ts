import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { ChatInterfaceService } from './services/ChatInterfaceService';
import { WebSocketHandler } from './services/WebSocketHandler';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './utils/errorHandler';
import { validateChatMessage, validateSessionRequest } from './utils/validation';

/**
 * Express server for the chat interface
 * Provides web UI and WebSocket connections for real-time chat
 */

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Initialize services
const chatService = new ChatInterfaceService();
const wsHandler = new WebSocketHandler(chatService);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);

// Body parsing and compression
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes

/**
 * POST /api/chat/message
 * Send a message to the AI agent
 */
app.post('/api/chat/message', validateChatMessage, async (req, res) => {
  try {
    const { message, sessionId, enableTrace } = req.body;
    const correlationId = req.headers['x-correlation-id'] as string || 
                         `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Chat message received', {
      correlationId,
      sessionId,
      messageLength: message.length,
      enableTrace
    });

    const result = await chatService.sendMessage({
      message,
      sessionId,
      enableTrace: enableTrace || false
    }, correlationId);

    res.json({
      success: true,
      correlationId,
      result
    });

  } catch (error) {
    logger.error('Error processing chat message', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to process message',
        code: 'CHAT_ERROR'
      }
    });
  }
});

/**
 * GET /api/chat/sessions/:sessionId
 * Get chat session history
 */
app.get('/api/chat/sessions/:sessionId', validateSessionRequest, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const correlationId = req.headers['x-correlation-id'] as string || 
                         `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Session history requested', {
      correlationId,
      sessionId
    });

    const result = await chatService.getSessionHistory(sessionId, correlationId);

    res.json({
      success: true,
      correlationId,
      result
    });

  } catch (error) {
    logger.error('Error retrieving session history', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve session history',
        code: 'SESSION_ERROR'
      }
    });
  }
});

/**
 * DELETE /api/chat/sessions/:sessionId
 * Clear chat session
 */
app.delete('/api/chat/sessions/:sessionId', validateSessionRequest, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const correlationId = req.headers['x-correlation-id'] as string || 
                         `clear-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Session clear requested', {
      correlationId,
      sessionId
    });

    await chatService.clearSession(sessionId, correlationId);

    res.json({
      success: true,
      correlationId,
      message: 'Session cleared successfully'
    });

  } catch (error) {
    logger.error('Error clearing session', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to clear session',
        code: 'SESSION_ERROR'
      }
    });
  }
});

/**
 * GET /api/chat/status
 * Get chat service status
 */
app.get('/api/chat/status', async (req, res) => {
  try {
    const correlationId = req.headers['x-correlation-id'] as string || 
                         `status-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const result = await chatService.getServiceStatus(correlationId);

    res.json({
      success: true,
      correlationId,
      result
    });

  } catch (error) {
    logger.error('Error getting service status', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get service status',
        code: 'STATUS_ERROR'
      }
    });
  }
});

// Serve the main application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  logger.info('WebSocket connection established', {
    clientId,
    userAgent: req.headers['user-agent'],
    ip: req.socket.remoteAddress
  });

  wsHandler.handleConnection(ws, clientId);
});

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  logger.info('Chat interface server started', {
    port: PORT,
    host: HOST,
    env: process.env.NODE_ENV || 'development'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export { app, server };
