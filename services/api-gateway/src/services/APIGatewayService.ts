/**
 * API Gateway Service
 * 
 * Handles request routing, authentication, and response formatting
 * for the AI Compliance Shepherd API.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { AuthenticationService } from './AuthenticationService';
import { ScanController } from './controllers/ScanController';
import { FindingsController } from './controllers/FindingsController';
import { HealthController } from './controllers/HealthController';
import { logger } from '../utils/logger';
import { AuthenticationError, NotFoundError } from '../utils/errorHandler';

export class APIGatewayService {
  private authService: AuthenticationService;
  private scanController: ScanController;
  private findingsController: FindingsController;
  private healthController: HealthController;

  constructor() {
    this.authService = new AuthenticationService();
    this.scanController = new ScanController();
    this.findingsController = new FindingsController();
    this.healthController = new HealthController();
  }

  /**
   * Route incoming requests to appropriate controllers
   */
  async routeRequest(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    const { httpMethod, path, pathParameters, queryStringParameters } = event;

    logger.info('Routing request', {
      method: httpMethod,
      path,
      pathParameters,
      queryStringParameters
    });

    try {
      // Extract route information
      const route = this.extractRoute(path);
      const tenantId = pathParameters?.tenantId;

      // Handle health check (no authentication required)
      if (route === 'health') {
        return await this.healthController.handleRequest(event, context);
      }

      // Authenticate request (except for health check)
      const authResult = await this.authService.authenticateRequest(event);
      if (!authResult.isAuthenticated) {
        throw new AuthenticationError(authResult.error || 'Authentication failed');
      }

      // Add authentication context to event
      event.requestContext.authorizer = {
        ...event.requestContext.authorizer,
        ...authResult.user
      };

      // Route to appropriate controller
      switch (route) {
        case 'scans':
          return await this.scanController.handleRequest(event, context);
        
        case 'findings':
          return await this.findingsController.handleRequest(event, context);
        
        case 'health':
          return await this.healthController.handleRequest(event, context);
        
        default:
          throw new NotFoundError(`Route not found: ${path}`);
      }

    } catch (error) {
      logger.error('Request routing failed', {
        method: httpMethod,
        path,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Extract route from path
   */
  private extractRoute(path: string): string {
    // Remove leading slash and extract first segment
    const segments = path.replace(/^\//, '').split('/');
    return segments[0] || 'health';
  }

  /**
   * Get CORS headers for response
   */
  getCorsHeaders(event: APIGatewayProxyEvent): Record<string, string> {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
    const origin = event.headers.Origin || event.headers.origin;
    const allowedOrigin = allowedOrigins.includes('*') || allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    return {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Tenant-ID',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Credentials': 'true'
    };
  }
}
