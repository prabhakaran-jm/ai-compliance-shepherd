import { Router } from 'express';
import { ChatService } from '../services/ChatService';
import { logger } from '../utils/logger';
import { handleAsyncRoute } from '../utils/asyncHandler';

const router = Router();
const chatService = new ChatService();

/**
 * Chat API routes
 * Handles chat sessions and AI agent interactions
 */

// Start new chat session
router.post('/sessions', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  
  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Authentication required' });
  }

  logger.info('Starting new chat session', { tenantId, userId });

  const session = await chatService.createSession(tenantId, userId);
  
  res.json({
    success: true,
    data: session
  });
}));

// Get chat session
router.get('/sessions/:sessionId', handleAsyncRoute(async (req, res) => {
  const { sessionId } = req.params;
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching chat session', { sessionId, tenantId });

  const session = await chatService.getSession(sessionId, tenantId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    success: true,
    data: session
  });
}));

// Get chat history
router.get('/sessions/:sessionId/messages', handleAsyncRoute(async (req, res) => {
  const { sessionId } = req.params;
  const tenantId = req.user?.tenantId;
  const { limit = 50, offset = 0 } = req.query;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching chat messages', { sessionId, tenantId, limit, offset });

  const messages = await chatService.getMessages(
    sessionId,
    tenantId,
    Number(limit),
    Number(offset)
  );
  
  res.json({
    success: true,
    data: messages
  });
}));

// Send message to AI agent
router.post('/sessions/:sessionId/messages', handleAsyncRoute(async (req, res) => {
  const { sessionId } = req.params;
  const { message, messageType = 'text' } = req.body;
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  
  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Authentication required' });
  }

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message content required' });
  }

  logger.info('Processing chat message', { 
    sessionId, 
    tenantId, 
    userId, 
    messageLength: message.length,
    messageType
  });

  const response = await chatService.processMessage({
    sessionId,
    tenantId,
    userId,
    message,
    messageType
  });
  
  res.json({
    success: true,
    data: response
  });
}));

// Get user's chat sessions
router.get('/sessions', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  const { limit = 20, offset = 0 } = req.query;
  
  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Authentication required' });
  }

  logger.info('Fetching user chat sessions', { tenantId, userId, limit, offset });

  const sessions = await chatService.getUserSessions(
    tenantId,
    userId,
    Number(limit),
    Number(offset)
  );
  
  res.json({
    success: true,
    data: sessions
  });
}));

// Update session (e.g., title, status)
router.put('/sessions/:sessionId', handleAsyncRoute(async (req, res) => {
  const { sessionId } = req.params;
  const tenantId = req.user?.tenantId;
  const updates = req.body;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Updating chat session', { sessionId, tenantId, updates });

  const session = await chatService.updateSession(sessionId, tenantId, updates);
  
  res.json({
    success: true,
    data: session
  });
}));

// Delete session
router.delete('/sessions/:sessionId', handleAsyncRoute(async (req, res) => {
  const { sessionId } = req.params;
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Deleting chat session', { sessionId, tenantId });

  await chatService.deleteSession(sessionId, tenantId);
  
  res.json({
    success: true,
    message: 'Session deleted successfully'
  });
}));

// Get AI agent capabilities
router.get('/capabilities', handleAsyncRoute(async (req, res) => {
  logger.info('Fetching AI agent capabilities');

  const capabilities = await chatService.getAgentCapabilities();
  
  res.json({
    success: true,
    data: capabilities
  });
}));

export { router as chatRoutes };
