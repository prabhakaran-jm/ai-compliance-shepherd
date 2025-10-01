/**
 * API Gateway Service Tests
 * 
 * Comprehensive unit tests for the API Gateway service including
 * authentication, routing, and error handling.
 */

import { APIGatewayService } from '../src/services/APIGatewayService';
import { AuthenticationService } from '../src/services/AuthenticationService';
import { ScanController } from '../src/services/controllers/ScanController';
import { FindingsController } from '../src/services/controllers/FindingsController';
import { HealthController } from '../src/services/controllers/HealthController';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { AuthenticationError, ValidationError, NotFoundError } from '../src/utils/errorHandler';

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  Lambda: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Payload: JSON.stringify({ success: true, data: {} }),
        $response: { requestId: 'test-request-id' }
      })
    })
  }))
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn(),
    getContext: jest.fn().mockReturnValue({})
  }
}));

describe('APIGatewayService', () => {
  let apiService: APIGatewayService;
  let mockEvent: APIGatewayProxyEvent;
  let mockContext: Context;

  beforeEach(() => {
    apiService = new APIGatewayService();
    
    mockEvent = {
      httpMethod: 'GET',
      path: '/health',
      resource: '/health',
      headers: {},
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      requestContext: {
        requestId: 'test-request-id',
        stage: 'test',
        resourcePath: '/health',
        httpMethod: 'GET',
        requestTime: '01/Jan/2024:00:00:00 +0000',
        requestTimeEpoch: 1704067200,
        identity: {
          cognitoIdentityPoolId: null,
          accountId: null,
          cognitoIdentityId: null,
          caller: null,
          sourceIp: '127.0.0.1',
          principalOrgId: null,
          accessKey: null,
          cognitoAuthenticationType: null,
          cognitoAuthenticationProvider: null,
          userArn: null,
          userAgent: 'test-agent',
          user: null
        },
        path: '/health',
        accountId: '123456789012',
        apiId: 'test-api-id',
        protocol: 'HTTP/1.1',
        resourceId: 'test-resource-id'
      },
      body: null,
      isBase64Encoded: false
    };

    mockContext = {
      callbackWaitsForEmptyEventLoop: false,
      functionName: 'test-function',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
      memoryLimitInMB: '128',
      awsRequestId: 'test-request-id',
      logGroupName: '/aws/lambda/test-function',
      logStreamName: '2024/01/01/[$LATEST]test-stream',
      getRemainingTimeInMillis: () => 30000,
      done: jest.fn(),
      fail: jest.fn(),
      succeed: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('routeRequest', () => {
    it('should route health check requests correctly', async () => {
      const result = await apiService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.body).toContain('healthy');
    });

    it('should handle CORS preflight requests', async () => {
      mockEvent.httpMethod = 'OPTIONS';
      
      const result = await apiService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Methods');
    });

    it('should authenticate requests for protected endpoints', async () => {
      mockEvent.path = '/scans';
      mockEvent.headers.Authorization = 'Bearer valid-token';
      
      // Mock authentication service
      jest.spyOn(AuthenticationService.prototype, 'authenticateRequest')
        .mockResolvedValue({
          isAuthenticated: true,
          user: {
            userId: 'test-user',
            tenantId: 'test-tenant',
            role: 'user',
            permissions: ['read', 'write']
          }
        });

      const result = await apiService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
    });

    it('should reject unauthenticated requests for protected endpoints', async () => {
      mockEvent.path = '/scans';
      // No authorization header
      
      const result = await apiService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(401);
      expect(result.body).toContain('Authentication failed');
    });

    it('should handle scan requests correctly', async () => {
      mockEvent.path = '/scans';
      mockEvent.httpMethod = 'POST';
      mockEvent.body = JSON.stringify({
        regions: ['us-east-1'],
        services: ['s3', 'iam'],
        frameworks: ['SOC2']
      });
      mockEvent.headers.Authorization = 'Bearer valid-token';
      
      // Mock authentication
      jest.spyOn(AuthenticationService.prototype, 'authenticateRequest')
        .mockResolvedValue({
          isAuthenticated: true,
          user: {
            userId: 'test-user',
            tenantId: 'test-tenant',
            role: 'user',
            permissions: ['read', 'write']
          }
        });

      const result = await apiService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(202);
      expect(result.body).toContain('scanId');
    });

    it('should handle findings requests correctly', async () => {
      mockEvent.path = '/findings';
      mockEvent.httpMethod = 'GET';
      mockEvent.headers.Authorization = 'Bearer valid-token';
      
      // Mock authentication
      jest.spyOn(AuthenticationService.prototype, 'authenticateRequest')
        .mockResolvedValue({
          isAuthenticated: true,
          user: {
            userId: 'test-user',
            tenantId: 'test-tenant',
            role: 'user',
            permissions: ['read']
          }
        });

      const result = await apiService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
    });

    it('should return 404 for unknown routes', async () => {
      mockEvent.path = '/unknown-route';
      mockEvent.headers.Authorization = 'Bearer valid-token';
      
      // Mock authentication
      jest.spyOn(AuthenticationService.prototype, 'authenticateRequest')
        .mockResolvedValue({
          isAuthenticated: true,
          user: {
            userId: 'test-user',
            tenantId: 'test-tenant',
            role: 'user',
            permissions: ['read']
          }
        });

      const result = await apiService.routeRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(404);
      expect(result.body).toContain('Route not found');
    });
  });

  describe('getCorsHeaders', () => {
    it('should return CORS headers with wildcard origin', () => {
      const headers = apiService.getCorsHeaders(mockEvent);

      expect(headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(headers).toHaveProperty('Access-Control-Allow-Headers');
      expect(headers).toHaveProperty('Access-Control-Allow-Methods');
      expect(headers).toHaveProperty('Access-Control-Allow-Credentials');
    });

    it('should return CORS headers with specific origin', () => {
      mockEvent.headers.Origin = 'https://example.com';
      
      const headers = apiService.getCorsHeaders(mockEvent);

      expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
    });
  });
});

describe('AuthenticationService', () => {
  let authService: AuthenticationService;

  beforeEach(() => {
    authService = new AuthenticationService();
  });

  describe('authenticateRequest', () => {
    it('should authenticate with valid JWT token', async () => {
      const mockEvent = {
        headers: {
          Authorization: 'Bearer valid-jwt-token'
        }
      } as APIGatewayProxyEvent;

      // Mock JWT verification
      jest.spyOn(require('jsonwebtoken'), 'verify').mockReturnValue({
        userId: 'test-user',
        tenantId: 'test-tenant',
        role: 'user',
        permissions: ['read', 'write']
      });

      const result = await authService.authenticateRequest(mockEvent);

      expect(result.isAuthenticated).toBe(true);
      expect(result.user?.userId).toBe('test-user');
    });

    it('should authenticate with valid API key', async () => {
      const mockEvent = {
        headers: {
          'X-API-Key': 'ak_admin_123456789012345678901234567890'
        }
      } as APIGatewayProxyEvent;

      const result = await authService.authenticateRequest(mockEvent);

      expect(result.isAuthenticated).toBe(true);
      expect(result.user?.role).toBe('admin');
    });

    it('should reject invalid JWT token', async () => {
      const mockEvent = {
        headers: {
          Authorization: 'Bearer invalid-token'
        }
      } as APIGatewayProxyEvent;

      // Mock JWT verification to throw error
      jest.spyOn(require('jsonwebtoken'), 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await authService.authenticateRequest(mockEvent);

      expect(result.isAuthenticated).toBe(false);
      expect(result.error).toContain('Invalid or expired token');
    });

    it('should reject invalid API key', async () => {
      const mockEvent = {
        headers: {
          'X-API-Key': 'invalid-key'
        }
      } as APIGatewayProxyEvent;

      const result = await authService.authenticateRequest(mockEvent);

      expect(result.isAuthenticated).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('should reject request without authentication', async () => {
      const mockEvent = {
        headers: {}
      } as APIGatewayProxyEvent;

      const result = await authService.authenticateRequest(mockEvent);

      expect(result.isAuthenticated).toBe(false);
      expect(result.error).toContain('No valid authentication provided');
    });
  });

  describe('generateToken', () => {
    it('should generate valid JWT token', () => {
      const user = {
        userId: 'test-user',
        tenantId: 'test-tenant',
        role: 'user',
        permissions: ['read', 'write'],
        email: 'test@example.com',
        name: 'Test User'
      };

      const token = authService.generateToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'test-password';
      const hash = await authService.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hash is long
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'test-password';
      const hash = await authService.hashPassword(password);

      const isValid = await authService.verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'test-password';
      const hash = await authService.hashPassword(password);

      const isValid = await authService.verifyPassword('wrong-password', hash);

      expect(isValid).toBe(false);
    });
  });
});

describe('ScanController', () => {
  let scanController: ScanController;

  beforeEach(() => {
    scanController = new ScanController();
  });

  describe('handleRequest', () => {
    it('should start scan with valid request', async () => {
      const mockEvent = {
        httpMethod: 'POST',
        path: '/scans',
        body: JSON.stringify({
          regions: ['us-east-1'],
          services: ['s3', 'iam'],
          frameworks: ['SOC2']
        }),
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        }
      } as APIGatewayProxyEvent;

      const result = await scanController.handleRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(202);
      expect(result.body).toContain('scanId');
    });

    it('should reject invalid scan request', async () => {
      const mockEvent = {
        httpMethod: 'POST',
        path: '/scans',
        body: JSON.stringify({
          // Missing required fields
        }),
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        }
      } as APIGatewayProxyEvent;

      const result = await scanController.handleRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('Validation Error');
    });

    it('should get scan status', async () => {
      const mockEvent = {
        httpMethod: 'GET',
        path: '/scans/scan-123',
        pathParameters: {
          scanId: 'scan-123'
        },
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        }
      } as APIGatewayProxyEvent;

      const result = await scanController.handleRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.body).toContain('scanId');
    });

    it('should list scans', async () => {
      const mockEvent = {
        httpMethod: 'GET',
        path: '/scans',
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        }
      } as APIGatewayProxyEvent;

      const result = await scanController.handleRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.body).toContain('scans');
    });
  });
});

describe('FindingsController', () => {
  let findingsController: FindingsController;

  beforeEach(() => {
    findingsController = new FindingsController();
  });

  describe('handleRequest', () => {
    it('should get finding details', async () => {
      const mockEvent = {
        httpMethod: 'GET',
        path: '/findings/finding-123',
        pathParameters: {
          findingId: 'finding-123'
        },
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        }
      } as APIGatewayProxyEvent;

      const result = await findingsController.handleRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
    });

    it('should list findings', async () => {
      const mockEvent = {
        httpMethod: 'GET',
        path: '/findings',
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        }
      } as APIGatewayProxyEvent;

      const result = await findingsController.handleRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
    });

    it('should update finding', async () => {
      const mockEvent = {
        httpMethod: 'PUT',
        path: '/findings/finding-123',
        pathParameters: {
          findingId: 'finding-123'
        },
        body: JSON.stringify({
          status: 'resolved',
          notes: 'Issue has been fixed'
        }),
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        }
      } as APIGatewayProxyEvent;

      const result = await findingsController.handleRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
    });

    it('should perform batch operations', async () => {
      const mockEvent = {
        httpMethod: 'POST',
        path: '/findings/batch',
        body: JSON.stringify({
          operation: 'resolve',
          findingIds: ['finding-1', 'finding-2']
        }),
        requestContext: {
          authorizer: {
            tenantId: 'test-tenant',
            userId: 'test-user'
          }
        }
      } as APIGatewayProxyEvent;

      const result = await findingsController.handleRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
    });
  });
});

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(() => {
    healthController = new HealthController();
  });

  describe('handleRequest', () => {
    it('should return health status', async () => {
      const mockEvent = {
        httpMethod: 'GET',
        path: '/health'
      } as APIGatewayProxyEvent;

      const result = await healthController.handleRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.body).toContain('healthy');
    });

    it('should return readiness status', async () => {
      const mockEvent = {
        httpMethod: 'GET',
        path: '/health/ready'
      } as APIGatewayProxyEvent;

      const result = await healthController.handleRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.body).toContain('ready');
    });

    it('should return liveness status', async () => {
      const mockEvent = {
        httpMethod: 'GET',
        path: '/health/live'
      } as APIGatewayProxyEvent;

      const result = await healthController.handleRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.body).toContain('alive');
    });

    it('should return metrics', async () => {
      const mockEvent = {
        httpMethod: 'GET',
        path: '/health/metrics'
      } as APIGatewayProxyEvent;

      const result = await healthController.handleRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.body).toContain('metrics');
    });
  });
});
