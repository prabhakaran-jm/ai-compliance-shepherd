import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../utils/logger';

/**
 * Socket.IO event handlers
 * Manages real-time WebSocket connections for chat and notifications
 */
export function setupSocketHandlers(io: SocketIOServer): void {
  // Authentication middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // In development, use simple token validation
    if (process.env.NODE_ENV === 'development') {
      if (token === 'demo-token' || token === 'user-token') {
        socket.data.user = {
          id: token === 'demo-token' ? 'user-demo-001' : 'user-demo-002',
          tenantId: 'tenant-demo-company',
          role: token === 'demo-token' ? 'admin' : 'user'
        };
        return next();
      }
    }

    // In production, validate JWT token here
    next(new Error('Invalid authentication token'));
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    
    logger.info('Socket connection established', {
      socketId: socket.id,
      userId: user.id,
      tenantId: user.tenantId,
      userAgent: socket.handshake.headers['user-agent']
    });

    // Join tenant-specific room for isolation
    socket.join(`tenant:${user.tenantId}`);
    socket.join(`user:${user.id}`);

    // Handle chat messages
    socket.on('chat:message', async (data) => {
      try {
        logger.info('Chat message received', {
          socketId: socket.id,
          userId: user.id,
          tenantId: user.tenantId,
          sessionId: data.sessionId,
          messageLength: data.message?.length || 0
        });

        // Validate message data
        if (!data.sessionId || !data.message) {
          socket.emit('chat:error', {
            error: 'Session ID and message are required'
          });
          return;
        }

        // Echo message back to confirm receipt
        socket.emit('chat:message:received', {
          messageId: data.messageId,
          timestamp: new Date().toISOString()
        });

        // Broadcast typing indicator
        socket.to(`tenant:${user.tenantId}`).emit('chat:typing', {
          sessionId: data.sessionId,
          userId: user.id,
          typing: false
        });

        // In a real implementation, you would:
        // 1. Process the message through the ChatService
        // 2. Send to AI agent
        // 3. Store in database
        // 4. Emit response back to client

      } catch (error) {
        logger.error('Error handling chat message', {
          socketId: socket.id,
          userId: user.id,
          tenantId: user.tenantId,
          error: error instanceof Error ? error.message : String(error)
        });

        socket.emit('chat:error', {
          error: 'Failed to process message'
        });
      }
    });

    // Handle typing indicators
    socket.on('chat:typing', (data) => {
      socket.to(`tenant:${user.tenantId}`).emit('chat:typing', {
        sessionId: data.sessionId,
        userId: user.id,
        typing: data.typing
      });
    });

    // Handle join chat session
    socket.on('chat:join', (data) => {
      if (data.sessionId) {
        socket.join(`session:${data.sessionId}`);
        logger.info('User joined chat session', {
          socketId: socket.id,
          userId: user.id,
          sessionId: data.sessionId
        });
      }
    });

    // Handle leave chat session
    socket.on('chat:leave', (data) => {
      if (data.sessionId) {
        socket.leave(`session:${data.sessionId}`);
        logger.info('User left chat session', {
          socketId: socket.id,
          userId: user.id,
          sessionId: data.sessionId
        });
      }
    });

    // Handle real-time notifications subscription
    socket.on('notifications:subscribe', (data) => {
      const { types = [] } = data;
      
      // Join notification rooms based on subscription
      types.forEach((type: string) => {
        socket.join(`notifications:${user.tenantId}:${type}`);
      });

      logger.info('User subscribed to notifications', {
        socketId: socket.id,
        userId: user.id,
        tenantId: user.tenantId,
        notificationTypes: types
      });

      socket.emit('notifications:subscribed', {
        types,
        timestamp: new Date().toISOString()
      });
    });

    // Handle scan status updates subscription
    socket.on('scan:subscribe', (data) => {
      const { scanId } = data;
      
      if (scanId) {
        socket.join(`scan:${scanId}`);
        logger.info('User subscribed to scan updates', {
          socketId: socket.id,
          userId: user.id,
          scanId
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', {
        socketId: socket.id,
        userId: user.id,
        tenantId: user.tenantId,
        reason
      });
    });

    // Handle connection errors
    socket.on('error', (error) => {
      logger.error('Socket error', {
        socketId: socket.id,
        userId: user.id,
        tenantId: user.tenantId,
        error: error instanceof Error ? error.message : String(error)
      });
    });

    // Send welcome message
    socket.emit('connection:welcome', {
      message: 'Connected to AI Compliance Shepherd',
      timestamp: new Date().toISOString(),
      features: [
        'Real-time chat',
        'Live notifications',
        'Scan progress updates',
        'Multi-tenant isolation'
      ]
    });
  });

  logger.info('Socket.IO handlers configured', {
    features: [
      'Chat messaging',
      'Typing indicators', 
      'Notifications',
      'Scan updates',
      'Tenant isolation'
    ]
  });
}

/**
 * Emit notification to specific tenant
 */
export function emitToTenant(
  io: SocketIOServer,
  tenantId: string,
  event: string,
  data: any
): void {
  io.to(`tenant:${tenantId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });

  logger.info('Notification emitted to tenant', {
    tenantId,
    event,
    dataKeys: Object.keys(data)
  });
}

/**
 * Emit notification to specific user
 */
export function emitToUser(
  io: SocketIOServer,
  userId: string,
  event: string,
  data: any
): void {
  io.to(`user:${userId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });

  logger.info('Notification emitted to user', {
    userId,
    event,
    dataKeys: Object.keys(data)
  });
}

/**
 * Emit scan progress update
 */
export function emitScanUpdate(
  io: SocketIOServer,
  scanId: string,
  update: any
): void {
  io.to(`scan:${scanId}`).emit('scan:update', {
    scanId,
    ...update,
    timestamp: new Date().toISOString()
  });

  logger.info('Scan update emitted', {
    scanId,
    status: update.status,
    progress: update.progress
  });
}
