import { Request, Response, NextFunction } from 'express';
import { AuthenticationError, AuthorizationError } from './errorHandler';
import { logger } from '../utils/logger';

/**
 * User interface for authenticated requests
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  tenantId: string;
  role: string;
  permissions: string[];
  name?: string;
}

/**
 * Extend Express Request to include user
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      correlationId?: string;
    }
  }
}

/**
 * Mock authentication middleware for development
 * In production, this would integrate with your actual auth service
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    // Generate correlation ID for request tracking
    req.correlationId = generateCorrelationId();
    logger.setCorrelationId(req.correlationId);

    // Skip auth for health check and public routes
    const publicRoutes = ['/health', '/auth', '/login', '/register'];
    if (publicRoutes.some(route => req.path.startsWith(route))) {
      return next();
    }

    // Extract token from Authorization header or query parameter
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7)
      : req.query.token as string;

    if (!token) {
      throw new AuthenticationError('No authentication token provided');
    }

    // In development, use mock authentication
    if (process.env.NODE_ENV === 'development') {
      req.user = getMockUser(token);
    } else {
      // In production, validate JWT token
      req.user = validateJWTToken(token);
    }

    logger.userAction('Request authenticated', req.user.id, req.user.tenantId, {
      method: req.method,
      path: req.path,
      role: req.user.role
    });

    next();
  } catch (error) {
    logger.security('Authentication failed', 'MEDIUM', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      error: error instanceof Error ? error.message : String(error)
    });

    next(error);
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(requiredRole: string | string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AuthenticationError();
    }

    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    if (!roles.includes(req.user.role)) {
      logger.security('Authorization failed - insufficient role', 'MEDIUM', {
        userId: req.user.id,
        tenantId: req.user.tenantId,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.path,
        method: req.method
      });

      throw new AuthorizationError(`Role ${req.user.role} insufficient. Required: ${roles.join(' or ')}`);
    }

    next();
  };
}

/**
 * Permission-based authorization middleware
 */
export function requirePermission(requiredPermission: string | string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AuthenticationError();
    }

    const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const hasPermission = permissions.some(permission => 
      req.user!.permissions.includes(permission)
    );

    if (!hasPermission) {
      logger.security('Authorization failed - insufficient permissions', 'MEDIUM', {
        userId: req.user.id,
        tenantId: req.user.tenantId,
        userPermissions: req.user.permissions,
        requiredPermissions: permissions,
        path: req.path,
        method: req.method
      });

      throw new AuthorizationError(`Missing required permissions: ${permissions.join(' or ')}`);
    }

    next();
  };
}

/**
 * Tenant isolation middleware
 */
export function requireTenantAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new AuthenticationError();
  }

  // Extract tenant ID from request (params, query, or body)
  const requestTenantId = req.params.tenantId || req.query.tenantId || req.body.tenantId;

  if (requestTenantId && requestTenantId !== req.user.tenantId) {
    logger.security('Tenant isolation violation attempt', 'HIGH', {
      userId: req.user.id,
      userTenantId: req.user.tenantId,
      requestedTenantId: requestTenantId,
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    throw new AuthorizationError('Access denied: tenant isolation violation');
  }

  next();
}

/**
 * Generate correlation ID for request tracking
 */
function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Mock user for development
 */
function getMockUser(token: string): AuthenticatedUser {
  // Simple mock authentication for development
  const mockUsers: Record<string, AuthenticatedUser> = {
    'demo-token': {
      id: 'user-demo-001',
      email: 'demo@compliance-shepherd.com',
      tenantId: 'tenant-demo-company',
      role: 'admin',
      permissions: [
        'scan:read', 'scan:write',
        'findings:read', 'findings:write',
        'reports:read', 'reports:write',
        'tenants:read', 'tenants:write',
        'users:read', 'users:write'
      ],
      name: 'Demo User'
    },
    'user-token': {
      id: 'user-demo-002',
      email: 'user@compliance-shepherd.com',
      tenantId: 'tenant-demo-company',
      role: 'user',
      permissions: [
        'scan:read',
        'findings:read',
        'reports:read'
      ],
      name: 'Regular User'
    }
  };

  const user = mockUsers[token];
  if (!user) {
    throw new AuthenticationError('Invalid token');
  }

  return user;
}

/**
 * Validate JWT token (production implementation)
 */
function validateJWTToken(token: string): AuthenticatedUser {
  // This would integrate with your actual JWT validation logic
  // For now, throw an error to indicate this needs implementation
  throw new Error('JWT validation not implemented - use development mode');
}

/**
 * Clean up correlation ID on response
 */
export function cleanupCorrelationId(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    logger.clearCorrelationId();
  });
  next();
}
