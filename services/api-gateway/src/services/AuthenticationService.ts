/**
 * Authentication Service
 * 
 * Handles API authentication using JWT tokens and API keys.
 * Supports both user authentication and service-to-service authentication.
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { logger } from '../utils/errorHandler';
import { AuthenticationError } from '../utils/errorHandler';

export interface AuthResult {
  isAuthenticated: boolean;
  user?: {
    userId?: string;
    tenantId?: string;
    role?: string;
    permissions?: string[];
  };
  error?: string;
}

export interface AuthUser {
  userId: string;
  tenantId: string;
  role: string;
  permissions: string[];
  email?: string;
  name?: string;
}

export class AuthenticationService {
  private readonly jwtSecret: string;
  private readonly apiKeySecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret-change-in-production';
    this.apiKeySecret = process.env.API_KEY_SECRET || 'default-api-key-secret';
  }

  /**
   * Authenticate incoming request
   */
  async authenticateRequest(event: APIGatewayProxyEvent): Promise<AuthResult> {
    try {
      const authHeader = event.headers.Authorization || event.headers.authorization;
      const apiKey = event.headers['X-API-Key'] || event.headers['x-api-key'];
      const tenantId = event.headers['X-Tenant-ID'] || event.headers['x-tenant-id'];

      // Try JWT authentication first
      if (authHeader) {
        const result = await this.authenticateWithJWT(authHeader, tenantId);
        if (result.isAuthenticated) {
          return result;
        }
      }

      // Try API key authentication
      if (apiKey) {
        const result = await this.authenticateWithApiKey(apiKey, tenantId);
        if (result.isAuthenticated) {
          return result;
        }
      }

      // No valid authentication found
      return {
        isAuthenticated: false,
        error: 'No valid authentication provided'
      };

    } catch (error) {
      logger.error('Authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        isAuthenticated: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Authenticate with JWT token
   */
  private async authenticateWithJWT(authHeader: string, tenantId?: string): Promise<AuthResult> {
    try {
      // Extract token from "Bearer <token>" format
      const token = authHeader.replace(/^Bearer\s+/i, '');
      
      if (!token) {
        return {
          isAuthenticated: false,
          error: 'Invalid authorization header format'
        };
      }

      // Verify JWT token
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      if (!decoded || !decoded.userId) {
        return {
          isAuthenticated: false,
          error: 'Invalid token payload'
        };
      }

      // Validate tenant access
      if (tenantId && decoded.tenantId && decoded.tenantId !== tenantId) {
        return {
          isAuthenticated: false,
          error: 'Tenant access denied'
        };
      }

      return {
        isAuthenticated: true,
        user: {
          userId: decoded.userId,
          tenantId: decoded.tenantId || tenantId,
          role: decoded.role || 'user',
          permissions: decoded.permissions || []
        }
      };

    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return {
          isAuthenticated: false,
          error: 'Invalid or expired token'
        };
      }

      return {
        isAuthenticated: false,
        error: 'Token verification failed'
      };
    }
  }

  /**
   * Authenticate with API key
   */
  private async authenticateWithApiKey(apiKey: string, tenantId?: string): Promise<AuthResult> {
    try {
      // In a real implementation, you would:
      // 1. Look up the API key in a database
      // 2. Validate the key and its permissions
      // 3. Check if the key is active and not expired
      
      // For now, we'll use a simple validation approach
      // In production, store API keys in DynamoDB with proper hashing
      
      const isValidKey = await this.validateApiKey(apiKey);
      
      if (!isValidKey) {
        return {
          isAuthenticated: false,
          error: 'Invalid API key'
        };
      }

      // Extract user information from API key (in real implementation, look up in database)
      const userInfo = await this.getUserInfoFromApiKey(apiKey);
      
      if (!userInfo) {
        return {
          isAuthenticated: false,
          error: 'API key not associated with any user'
        };
      }

      // Validate tenant access
      if (tenantId && userInfo.tenantId && userInfo.tenantId !== tenantId) {
        return {
          isAuthenticated: false,
          error: 'Tenant access denied'
        };
      }

      return {
        isAuthenticated: true,
        user: {
          userId: userInfo.userId,
          tenantId: userInfo.tenantId || tenantId,
          role: userInfo.role || 'service',
          permissions: userInfo.permissions || ['read', 'write']
        }
      };

    } catch (error) {
      return {
        isAuthenticated: false,
        error: 'API key validation failed'
      };
    }
  }

  /**
   * Validate API key format and signature
   */
  private async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      // Basic format validation
      if (!apiKey || apiKey.length < 32) {
        return false;
      }

      // In production, implement proper API key validation:
      // 1. Check key format (prefix, length, character set)
      // 2. Verify signature/hash
      // 3. Check against database of valid keys
      // 4. Validate expiration and status
      
      // For demo purposes, accept keys that start with 'ak_' and are at least 32 chars
      return apiKey.startsWith('ak_') && apiKey.length >= 32;

    } catch (error) {
      return false;
    }
  }

  /**
   * Get user information from API key
   */
  private async getUserInfoFromApiKey(apiKey: string): Promise<AuthUser | null> {
    try {
      // In production, look up API key in DynamoDB and return associated user info
      // For demo purposes, return mock user info
      
      if (apiKey.startsWith('ak_admin_')) {
        return {
          userId: 'admin-user',
          tenantId: 'default-tenant',
          role: 'admin',
          permissions: ['read', 'write', 'admin'],
          email: 'admin@compliance-shepherd.com',
          name: 'Admin User'
        };
      }

      if (apiKey.startsWith('ak_service_')) {
        return {
          userId: 'service-user',
          tenantId: 'default-tenant',
          role: 'service',
          permissions: ['read', 'write'],
          email: 'service@compliance-shepherd.com',
          name: 'Service User'
        };
      }

      return null;

    } catch (error) {
      return null;
    }
  }

  /**
   * Generate JWT token for user
   */
  generateToken(user: AuthUser, expiresIn: string = '24h'): string {
    const payload = {
      userId: user.userId,
      tenantId: user.tenantId,
      role: user.role,
      permissions: user.permissions,
      email: user.email,
      name: user.name,
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn });
  }

  /**
   * Hash password for storage
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
