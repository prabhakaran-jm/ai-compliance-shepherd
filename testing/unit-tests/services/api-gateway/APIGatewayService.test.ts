/**
 * Unit tests for APIGatewayService
 */

import { APIGatewayService } from '../../../../services/api-gateway/src/services/APIGatewayService';
import { AuthenticationService } from '../../../../services/api-gateway/src/services/AuthenticationService';
import { ScanController } from '../../../../services/api-gateway/src/services/controllers/ScanController';
import { FindingsController } from '../../../../services/api-gateway/src/services/controllers/FindingsController';
import { HealthController } from '../../../../services/api-gateway/src/services/controllers/HealthController';

// Mock dependencies
jest.mock('../../../../services/api-gateway/src/services/AuthenticationService');
jest.mock('../../../../services/api-gateway/src/services/controllers/ScanController');
jest.mock('../../../../services/api-gateway/src/services/controllers/FindingsController');
jest.mock('../../../../services/api-gateway/src/services/controllers/HealthController');

describe('APIGatewayService', () => {
  let apiGatewayService: APIGatewayService;
  let mockAuthService: jest.Mocked<AuthenticationService>;
  let mockScanController: jest.Mocked<ScanController>;
  let mockFindingsController: jest.Mocked<FindingsController>;
  let mockHealthController: jest.Mocked<HealthController>;

  beforeEach(() => {
    apiGatewayService = new APIGatewayService();
    mockAuthService = new AuthenticationService() as jest.Mocked<AuthenticationService>;
    mockScanController = new ScanController() as jest.Mocked<ScanController>;
    mockFindingsController = new FindingsController() as jest.Mocked<FindingsController>;
    mockHealthController = new HealthController() as jest.Mocked<HealthController>;

    // Set up service dependencies
    (apiGatewayService as any).authService = mockAuthService;
    (apiGatewayService as any).scanController = mockScanController;
    (apiGatewayService as any).findingsController = mockFindingsController;
    (apiGatewayService as any).healthController = mockHealthController;

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('handleRequest', () => {
    it('should handle authenticated scan request', async () => {
      // Arrange
      const event = global.testUtils.createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scans',
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scanType: 'FULL_COMPLIANCE',
          regions: ['us-east-1'],
          services: ['s3', 'iam']
        })
      });

      const context = global.testUtils.createLambdaContext();

      const mockUserContext = global.testUtils.createTestUserSession();
      const mockScanResponse = {
        scanId: 'scan-123',
        status: 'IN_PROGRESS',
        tenantId: mockUserContext.tenantId
      };

      mockAuthService.authenticate = jest.fn().mockResolvedValue(mockUserContext);
      mockScanController.startScan = jest.fn().mockResolvedValue(mockScanResponse);

      // Act
      const result = await apiGatewayService.handleRequest(event, context);

      // Assert
      expect(result).toBeDefined();
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual(mockScanResponse);
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    });

    it('should handle authentication failure', async () => {
      // Arrange
      const event = global.testUtils.createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scans',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json'
        }
      });

      const context = global.testUtils.createLambdaContext();

      mockAuthService.authenticate = jest.fn().mockRejectedValue(
        new Error('Invalid token')
      );

      // Act
      const result = await apiGatewayService.handleRequest(event, context);

      // Assert
      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toEqual({
        error: 'Unauthorized',
        message: 'Invalid token'
      });
    });

    it('should handle CORS preflight request', async () => {
      // Arrange
      const event = global.testUtils.createAPIGatewayEvent({
        httpMethod: 'OPTIONS',
        path: '/scans',
        headers: {
          'Origin': 'https://app.compliance-shepherd.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type,Authorization'
        }
      });

      const context = global.testUtils.createLambdaContext();

      // Act
      const result = await apiGatewayService.handleRequest(event, context);

      // Assert
      expect(result.statusCode).toBe(200);
      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers['Access-Control-Allow-Methods']).toBe('GET,POST,PUT,DELETE,OPTIONS');
      expect(result.headers['Access-Control-Allow-Headers']).toContain('Content-Type');
      expect(result.headers['Access-Control-Allow-Headers']).toContain('Authorization');
    });

    it('should handle health check request', async () => {
      // Arrange
      const event = global.testUtils.createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/health'
      });

      const context = global.testUtils.createLambdaContext();

      const mockHealthResponse = {
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services: {
          database: true,
          auth: true,
          scan: true
        }
      };

      mockHealthController.getHealth = jest.fn().mockResolvedValue(mockHealthResponse);

      // Act
      const result = await apiGatewayService.handleRequest(event, context);

      // Assert
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual(mockHealthResponse);
      expect(mockAuthService.authenticate).not.toHaveBeenCalled();
    });

    it('should handle findings list request with filters', async () => {
      // Arrange
      const event = global.testUtils.createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/findings',
        queryStringParameters: {
          severity: 'HIGH,CRITICAL',
          status: 'OPEN',
          maxResults: '20'
        },
        headers: {
          'Authorization': 'Bearer valid-jwt-token'
        }
      });

      const context = global.testUtils.createLambdaContext();

      const mockUserContext = global.testUtils.createTestUserSession();
      const mockFindingsResponse = {
        findings: [
          global.testUtils.createTestFinding({ severity: 'HIGH' }),
          global.testUtils.createTestFinding({ severity: 'CRITICAL' })
        ],
        totalCount: 2,
        nextToken: null
      };

      mockAuthService.authenticate = jest.fn().mockResolvedValue(mockUserContext);
      mockFindingsController.listFindings = jest.fn().mockResolvedValue(mockFindingsResponse);

      // Act
      const result = await apiGatewayService.handleRequest(event, context);

      // Assert
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual(mockFindingsResponse);
      expect(mockFindingsController.listFindings).toHaveBeenCalledWith(
        mockUserContext,
        expect.objectContaining({
          severity: ['HIGH', 'CRITICAL'],
          status: ['OPEN']
        }),
        expect.objectContaining({
          maxResults: 20
        })
      );
    });

    it('should handle route not found', async () => {
      // Arrange
      const event = global.testUtils.createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/nonexistent-route'
      });

      const context = global.testUtils.createLambdaContext();

      // Act
      const result = await apiGatewayService.handleRequest(event, context);

      // Assert
      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toEqual({
        error: 'Not Found',
        message: 'Route not found: GET /nonexistent-route'
      });
    });

    it('should handle malformed JSON request body', async () => {
      // Arrange
      const event = global.testUtils.createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scans',
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
          'Content-Type': 'application/json'
        },
        body: '{ invalid json'
      });

      const context = global.testUtils.createLambdaContext();

      const mockUserContext = global.testUtils.createTestUserSession();
      mockAuthService.authenticate = jest.fn().mockResolvedValue(mockUserContext);

      // Act
      const result = await apiGatewayService.handleRequest(event, context);

      // Assert
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({
        error: 'Bad Request',
        message: 'Invalid JSON in request body'
      });
    });

    it('should handle internal server errors', async () => {
      // Arrange
      const event = global.testUtils.createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scans',
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scanType: 'FULL_COMPLIANCE',
          regions: ['us-east-1']
        })
      });

      const context = global.testUtils.createLambdaContext();

      const mockUserContext = global.testUtils.createTestUserSession();
      mockAuthService.authenticate = jest.fn().mockResolvedValue(mockUserContext);
      mockScanController.startScan = jest.fn().mockRejectedValue(
        new Error('Internal processing error')
      );

      // Act
      const result = await apiGatewayService.handleRequest(event, context);

      // Assert
      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toEqual({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred'
      });
    });
  });

  describe('route matching', () => {
    it('should match scan routes correctly', async () => {
      // Arrange
      const routes = [
        { method: 'POST', path: '/scans' },
        { method: 'GET', path: '/scans/scan-123' },
        { method: 'GET', path: '/scans' },
        { method: 'DELETE', path: '/scans/scan-123' }
      ];

      const mockUserContext = global.testUtils.createTestUserSession();
      mockAuthService.authenticate = jest.fn().mockResolvedValue(mockUserContext);
      mockScanController.startScan = jest.fn().mockResolvedValue({ scanId: 'scan-123' });
      mockScanController.getScan = jest.fn().mockResolvedValue({ scanId: 'scan-123' });
      mockScanController.listScans = jest.fn().mockResolvedValue({ scans: [] });
      mockScanController.cancelScan = jest.fn().mockResolvedValue({ scanId: 'scan-123' });

      // Act & Assert
      for (const route of routes) {
        const event = global.testUtils.createAPIGatewayEvent({
          httpMethod: route.method,
          path: route.path,
          headers: { 'Authorization': 'Bearer valid-token' }
        });

        const result = await apiGatewayService.handleRequest(event, global.testUtils.createLambdaContext());
        expect(result.statusCode).toBe(200);
      }
    });

    it('should match findings routes correctly', async () => {
      // Arrange
      const routes = [
        { method: 'GET', path: '/findings' },
        { method: 'GET', path: '/findings/finding-123' },
        { method: 'PUT', path: '/findings/finding-123' },
        { method: 'POST', path: '/findings/search' }
      ];

      const mockUserContext = global.testUtils.createTestUserSession();
      mockAuthService.authenticate = jest.fn().mockResolvedValue(mockUserContext);
      mockFindingsController.listFindings = jest.fn().mockResolvedValue({ findings: [] });
      mockFindingsController.getFinding = jest.fn().mockResolvedValue({ findingId: 'finding-123' });
      mockFindingsController.updateFinding = jest.fn().mockResolvedValue({ findingId: 'finding-123' });
      mockFindingsController.searchFindings = jest.fn().mockResolvedValue({ findings: [] });

      // Act & Assert
      for (const route of routes) {
        const event = global.testUtils.createAPIGatewayEvent({
          httpMethod: route.method,
          path: route.path,
          headers: { 'Authorization': 'Bearer valid-token' }
        });

        const result = await apiGatewayService.handleRequest(event, global.testUtils.createLambdaContext());
        expect(result.statusCode).toBe(200);
      }
    });
  });

  describe('error handling', () => {
    it('should handle validation errors with 400 status', async () => {
      // Arrange
      const event = global.testUtils.createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scans',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scanType: 'INVALID_TYPE'
        })
      });

      const mockUserContext = global.testUtils.createTestUserSession();
      mockAuthService.authenticate = jest.fn().mockResolvedValue(mockUserContext);
      mockScanController.startScan = jest.fn().mockRejectedValue(
        new Error('Invalid scan type')
      );

      // Act
      const result = await apiGatewayService.handleRequest(event, global.testUtils.createLambdaContext());

      // Assert
      expect(result.statusCode).toBe(500); // Internal error handling
    });

    it('should handle authorization errors with 403 status', async () => {
      // Arrange
      const event = global.testUtils.createAPIGatewayEvent({
        httpMethod: 'DELETE',
        path: '/scans/scan-123',
        headers: {
          'Authorization': 'Bearer limited-token'
        }
      });

      const mockUserContext = global.testUtils.createTestUserSession({
        permissions: ['scan:read'] // Missing scan:delete permission
      });
      
      mockAuthService.authenticate = jest.fn().mockResolvedValue(mockUserContext);
      mockScanController.cancelScan = jest.fn().mockRejectedValue(
        new Error('Insufficient permissions')
      );

      // Act
      const result = await apiGatewayService.handleRequest(event, global.testUtils.createLambdaContext());

      // Assert
      expect(result.statusCode).toBe(500); // Internal error handling
    });
  });

  describe('request logging', () => {
    it('should log request details with correlation ID', async () => {
      // Arrange
      const event = global.testUtils.createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/health'
      });
      
      const context = global.testUtils.createLambdaContext();
      
      mockHealthController.getHealth = jest.fn().mockResolvedValue({
        status: 'healthy'
      });

      const consoleSpy = jest.spyOn(console, 'log');

      // Act
      await apiGatewayService.handleRequest(event, context);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Request processed')
      );
    });
  });
});
