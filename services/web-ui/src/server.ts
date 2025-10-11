import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import passport from 'passport';

import { setupRoutes } from './routes';
import { setupSocketHandlers } from './socket';
import { setupAuthentication } from './auth';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/authMiddleware';

/**
 * AI Compliance Shepherd Web UI Server
 * Provides unified dashboard with chat interface and report viewing
 */

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ["http://localhost:3001"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ["http://localhost:3001"],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression and parsing with security limits
app.use(compression());

// Request size limits for security
const requestSizeLimit = process.env.REQUEST_SIZE_LIMIT || '1mb';
app.use(express.json({ 
  limit: requestSizeLimit,
  verify: (req, res, buf) => {
    // Log large requests for monitoring
    if (buf.length > 500 * 1024) { // 500KB threshold
      console.warn('Large request received', {
        size: buf.length,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }
    
    // Prevent extremely large requests
    if (buf.length > 10 * 1024 * 1024) { // 10MB hard limit
      throw new Error('Request payload too large');
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: requestSizeLimit 
}));

// Rate limiting - consistent across environments
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // Consistent limit
  message: {
    error: 'Too many requests from this IP, please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Add IP-based tracking for better security
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  },
  // Skip rate limiting for health checks
  skip: (req) => {
    return req.path === '/health' || req.path === '/health/';
  },
  // Add custom handler for rate limit exceeded
  handler: (req, res) => {
    console.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later',
      retryAfter: '15 minutes',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }
});
app.use('/api', limiter);

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Authentication setup
app.use(passport.initialize());
app.use(passport.session());
setupAuthentication(passport);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: NODE_ENV
  });
});

// API routes
app.use('/api', authMiddleware, setupRoutes());

// Socket.IO setup
setupSocketHandlers(io);

// SPA fallback routes
app.get('/chat*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/chat.html'));
});

app.get('/reports*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/reports.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Error handling
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  
  httpServer.close(() => {
    logger.info('HTTP server closed');
    
    // Close database connections, cleanup resources, etc.
    process.exit(0);
  });

  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
httpServer.listen(PORT, () => {
  logger.info('AI Compliance Shepherd Web UI started', {
    port: PORT,
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { 
    reason: reason instanceof Error ? reason.message : String(reason),
    promise: String(promise)
  });
});

export { app, httpServer, io };
