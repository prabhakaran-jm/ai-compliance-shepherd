/**
 * Integration tests for API Gateway to Lambda service integration
 * 
 * This test suite validates the complete API Gateway integration,
 * including authentication, routing, and service communication.
 */

import { APIGatewayService } from '../../../services/api-gateway/src/services/APIGatewayService';
import { ScanEnvironmentService } from '../../../services/scan-environment/src/services/ScanEnvironmentService';
import { FindingsStorageService } from '../../../services/findings-storage/src/services/FindingsStorageService';
import { dynamoDBClient } from '../setup/localstack';
import { PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

describe('API Gateway Integration Tests', () => {
  let apiGatewayService: APIGatewayService;
  let testTenantId: string;
  let testUserId: string;
  let validJWTToken: string;

  beforeEach(async () => {
    // Initialize services
    apiGatewayService = new APIGatewayService();
    
    // Generate test identifiers
    testTenantId = global.integrationTestUtils.generateTenantId();
    testUserId = global.integrationTestUtils.generateUserId();
    
    // Create test JWT token (mock)
    validJWTToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    
    // Create test tenant
    await dynamoDBClient.send(new PutItemCommand({
      TableName: 'ai-compliance-tenants-test',
      Item: marshall({
        tenantId: testTenantId,
        name: 'API Integration Test Tenant',
        tier: 'STANDARD',
        status: 'ACTIVE',
        apiKeys: ['test-api-key-123'],
        settings: {
          apiRateLimit: 1000,
          enabledEndpoints: ['scan', 'findings', 'reports']
        },
        createdAt: new Date().toISOString()
      })
    }));
    
    // Create test user session
    await dynamoDBClient.send(new PutItemCommand({
      TableName: 'ai-compliance-user-sessions-test',
      Item: marshall({
        sessionId: `session-${testUserId}`,
        userId: testUserId,
        tenantId: testTenantId,
        status: 'ACTIVE',
        permissions: [
          'scan:read', 'scan:create',
          'findings:read', 'findings:update',
          'reports:read', 'reports:generate'
        ],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      })
    }));
  });

  describe('Authentication and Authorization', () => {
    it('should authenticate valid JWT tokens', async () => {
      console.log('🔐 Testing JWT authentication...');
      
      const event = global.integrationTestUtils.createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/health',
        headers: {
          'Authorization': validJWTToken,
          'Content-Type': 'application/json'
        }
      });
      
      const context = global.integrationTestUtils.createLambdaContext();
      
      const response = await apiGatewayService.handleRequest(event, context);
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['Content-Type']).toBe('application/json');
      
      const body = JSON.parse(response.body);
      expect(body.status).toBe('healthy');
      
      console.log('✅ JWT authentication verified');
    });
    
    it('should authenticate valid API keys', async () => {
      console.log('🔑 Testing API key authentication...');
      
      const event = global.integrationTestUtils.createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/health',
        headers: {
          'X-API-Key': 'test-api-key-123',
          'Content-Type': 'application/json'
        }
      });
      
      const context = global.integrationTestUtils.createLambdaContext();
      
      const response = await apiGatewayService.handleRequest(event, context);
      
      expect(response.statusCode).toBe(200);
      
      console.log('✅ API key authentication verified');
    });
    
    it('should reject invalid authentication', async () => {
      console.log('❌ Testing invalid authentication rejection...');
      
      const event = global.integrationTestUtils.createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/scans',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json'
        }
      });
      
      const context = global.integrationTestUtils.createLambdaContext();
      
      const response = await apiGatewayService.handleRequest(event, context);
      
      expect(response.statusCode).toBe(401);
      
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unauthorized');
      
      console.log('✅ Invalid authentication rejection verified');
    });
    
    it('should enforce permission-based authorization', async () => {
      console.log('🛡️ Testing permission-based authorization...');
      
      // Create user with limited permissions
      const limitedUserId = global.integrationTestUtils.generateUserId();
      
      await dynamoDBClient.send(new PutItemCommand({
        TableName: 'ai-compliance-user-sessions-test',
        Item: marshall({
          sessionId: `session-${limitedUserId}`,
          userId: limitedUserId,
          tenantId: testTenantId,
          status: 'ACTIVE',
          permissions: ['scan:read'], // Only read permissions
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        })
      }));
      
      // Try to create scan (requires scan:create permission)
      const event = global.integrationTestUtils.createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scans',
        headers: {
          'Authorization': validJWTToken,
          'Content-Type': 'application/json',
          'X-User-ID': limitedUserId
        },
        body: JSON.stringify({
          scanType: 'FULL_COMPLIANCE',
          regions: ['us-east-1'],
          services: ['s3']
        })
      });
      
      const context = global.integrationTestUtils.createLambdaContext();
      
      const response = await apiGatewayService.handleRequest(event, context);
      
      expect(response.statusCode).toBe(403);
      
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Forbidden');
      
      console.log('✅ Permission-based authorization verified');
    });
  });
  
  describe('Request Routing and Processing', () => {
    it('should route scan requests correctly', async () => {
      console.log('🔄 Testing scan request routing...');
      
      // Test POST /scans - Start scan
      const createScanEvent = global.integrationTestUtils.createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scans',
        headers: {
          'Authorization': validJWTToken,
          'Content-Type': 'application/json',
          'X-User-ID': testUserId
        },
        body: JSON.stringify({
          scanType: 'FULL_COMPLIANCE',
          regions: ['us-east-1'],
          services: ['s3', 'iam']
        })
      });
      
      const createResponse = await apiGatewayService.handleRequest(
        createScanEvent,
        global.integrationTestUtils.createLambdaContext()
      );
      
      expect(createResponse.statusCode).toBe(200);
      
      const createBody = JSON.parse(createResponse.body);
      expect(createBody.scanId).toMatch(/^scan-/);
      expect(createBody.status).toBe('IN_PROGRESS');
      
      const scanId = createBody.scanId;
      
      // Test GET /scans/{scanId} - Get scan status
      const getScanEvent = global.integrationTestUtils.createAPIGatewayEvent({
        httpMethod: 'GET',
        path: `/scans/${scanId}`,
        pathParameters: { scanId },
        headers: {
          'Authorization': validJWTToken,
          'X-User-ID': testUserId
        }
      });
      
      const getResponse = await apiGatewayService.handleRequest(
        getScanEvent,
        global.integrationTestUtils.createLambdaContext()
      );
      
      expect(getResponse.statusCode).toBe(200);
      
      const getBody = JSON.parse(getResponse.body);
      expect(getBody.scanId).toBe(scanId);
      expect(getBody.tenantId).toBe(testTenantId);
      
      console.log('✅ Scan request routing verified');
    });
    
    it('should route findings requests correctly', async () => {
      console.log('🔍 Testing findings request routing...');
      
      // Create test finding first
      const testFinding = global.integrationTestUtils.createTestFinding({
        tenantId: testTenantId
      });
      
      await dynamoDBClient.send(new PutItemCommand({
        TableName: 'ai-compliance-findings-test',
        Item: marshall(testFinding)
      }));
      
      // Test GET /findings - List findings
      const listFindingsEvent = global.integrationTestUtils.createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/findings',
        queryStringParameters: {
          severity: 'HIGH,CRITICAL',
          maxResults: '10'
        },
        headers: {
          'Authorization': validJWTToken,
          'X-User-ID': testUserId
        }
      });
      
      const listResponse = await apiGatewayService.handleRequest(
        listFindingsEvent,
        global.integrationTestUtils.createLambdaContext()
      );
      
      expect(listResponse.statusCode).toBe(200);
      
      const listBody = JSON.parse(listResponse.body);
      expect(listBody.findings).toBeDefined();
      expect(Array.isArray(listBody.findings)).toBe(true);
      
      // Test GET /findings/{findingId} - Get specific finding
      const getFindingEvent = global.integrationTestUtils.createAPIGatewayEvent({
        httpMethod: 'GET',
        path: `/findings/${testFinding.findingId}`,
        pathParameters: { findingId: testFinding.findingId },
        headers: {
          'Authorization': validJWTToken,
          'X-User-ID': testUserId
        }
      });
      
      const getResponse = await apiGatewayService.handleRequest(
        getFindingEvent,
        global.integrationTestUtils.createLambdaContext()
      );
      
      expect(getResponse.statusCode).toBe(200);
      
      const getBody = JSON.parse(getResponse.body);
      expect(getBody.findingId).toBe(testFinding.findingId);
      
      console.log('✅ Findings request routing verified');
    });
    
    it('should handle CORS preflight requests', async () => {
      console.log('🌐 Testing CORS preflight handling...');
      
      const corsEvent = global.integrationTestUtils.createAPIGatewayEvent({
        httpMethod: 'OPTIONS',
        path: '/scans',
        headers: {
          'Origin': 'https://app.compliance-shepherd.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type,Authorization'
        }
      });
      
      const response = await apiGatewayService.handleRequest(
        corsEvent,
        global.integrationTestUtils.createLambdaContext()
      );
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers['Access-Control-Allow-Methods']).toContain('POST');
      expect(response.headers['Access-Control-Allow-Headers']).toContain('Content-Type');
      expect(response.headers['Access-Control-Allow-Headers']).toContain('Authorization');
      
      console.log('✅ CORS preflight handling verified');
    });
  });
  
  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON requests', async () => {
      console.log('🚫 Testing malformed JSON handling...');
      
      const event = global.integrationTestUtils.createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scans',
        headers: {
          'Authorization': validJWTToken,
          'Content-Type': 'application/json',
          'X-User-ID': testUserId
        },
        body: '{ invalid json syntax'
      });
      
      const response = await apiGatewayService.handleRequest(
        event,
        global.integrationTestUtils.createLambdaContext()
      );
      
      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('JSON');
      
      console.log('✅ Malformed JSON handling verified');
    });
    
    it('should handle route not found', async () => {
      console.log('🔍 Testing route not found handling...');
      
      const event = global.integrationTestUtils.createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/nonexistent-endpoint',
        headers: {
          'Authorization': validJWTToken
        }
      });
      
      const response = await apiGatewayService.handleRequest(
        event,
        global.integrationTestUtils.createLambdaContext()
      );
      
      expect(response.statusCode).toBe(404);
      
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Not Found');
      
      console.log('✅ Route not found handling verified');
    });
    
    it('should handle service errors gracefully', async () => {
      console.log('⚠️ Testing service error handling...');
      
      // Mock service to throw error
      const originalScanService = ScanEnvironmentService.prototype.startScan;
      ScanEnvironmentService.prototype.startScan = jest.fn().mockRejectedValue(
        new Error('Service temporarily unavailable')
      );
      
      const event = global.integrationTestUtils.createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scans',
        headers: {
          'Authorization': validJWTToken,
          'Content-Type': 'application/json',
          'X-User-ID': testUserId
        },
        body: JSON.stringify({
          scanType: 'FULL_COMPLIANCE',
          regions: ['us-east-1'],
          services: ['s3']
        })
      });
      
      const response = await apiGatewayService.handleRequest(
        event,
        global.integrationTestUtils.createLambdaContext()
      );
      
      expect(response.statusCode).toBe(500);
      
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal Server Error');
      
      // Restore original method
      ScanEnvironmentService.prototype.startScan = originalScanService;
      
      console.log('✅ Service error handling verified');
    });
  });
  
  describe('Rate Limiting and Throttling', () => {
    it('should enforce rate limits', async () => {
      console.log('🚦 Testing rate limiting...');
      
      // Send multiple requests rapidly
      const requests = Array.from({ length: 20 }, (_, i) =>
        global.integrationTestUtils.createAPIGatewayEvent({
          httpMethod: 'GET',
          path: '/health',
          headers: {
            'Authorization': validJWTToken,
            'X-User-ID': testUserId
          }
        })
      );
      
      const responses = await Promise.all(
        requests.map(event =>
          apiGatewayService.handleRequest(
            event,
            global.integrationTestUtils.createLambdaContext()
          )
        )
      );
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
      const successfulResponses = responses.filter(r => r.statusCode === 200);
      
      expect(successfulResponses.length).toBeGreaterThan(0);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      // Check rate limit headers
      const rateLimitedResponse = rateLimitedResponses[0];
      expect(rateLimitedResponse.headers['X-RateLimit-Limit']).toBeDefined();
      expect(rateLimitedResponse.headers['X-RateLimit-Remaining']).toBeDefined();
      
      console.log('✅ Rate limiting verified');
    });
  });
  
  describe('Request Validation', () => {
    it('should validate request parameters', async () => {
      console.log('✅ Testing request validation...');
      
      // Test missing required fields
      const invalidScanEvent = global.integrationTestUtils.createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scans',
        headers: {
          'Authorization': validJWTToken,
          'Content-Type': 'application/json',
          'X-User-ID': testUserId
        },
        body: JSON.stringify({
          // Missing required scanType field
          regions: ['us-east-1']
        })
      });
      
      const response = await apiGatewayService.handleRequest(
        invalidScanEvent,
        global.integrationTestUtils.createLambdaContext()
      );
      
      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('scanType');
      
      console.log('✅ Request validation verified');
    });
    
    it('should validate query parameters', async () => {
      console.log('🔍 Testing query parameter validation...');
      
      // Test invalid query parameters
      const invalidQueryEvent = global.integrationTestUtils.createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/findings',
        queryStringParameters: {
          maxResults: 'invalid-number', // Should be a number
          severity: 'INVALID_SEVERITY' // Should be valid severity
        },
        headers: {
          'Authorization': validJWTToken,
          'X-User-ID': testUserId
        }
      });
      
      const response = await apiGatewayService.handleRequest(
        invalidQueryEvent,
        global.integrationTestUtils.createLambdaContext()
      );
      
      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
      
      console.log('✅ Query parameter validation verified');
    });
  });
});
