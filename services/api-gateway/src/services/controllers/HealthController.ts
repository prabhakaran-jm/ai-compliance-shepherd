/**
 * Health Controller
 * 
 * Handles health check endpoints for monitoring and load balancer health checks.
 * Provides system status, dependency health, and basic metrics.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from '../../utils/logger';

export class HealthController {
  /**
   * Handle health check requests
   */
  async handleRequest(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    const { httpMethod, path } = event;

    logger.info('Health controller request', {
      method: httpMethod,
      path
    });

    try {
      if (path.endsWith('/health') || path.endsWith('/health/')) {
        return await this.healthCheck(event, context);
      }

      if (path.endsWith('/health/ready')) {
        return await this.readinessCheck(event, context);
      }

      if (path.endsWith('/health/live')) {
        return await this.livenessCheck(event, context);
      }

      if (path.endsWith('/health/metrics')) {
        return await this.metricsCheck(event, context);
      }

      // Default health check
      return await this.healthCheck(event, context);

    } catch (error) {
      logger.error('Health controller error', {
        method: httpMethod,
        path,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        statusCode: 503,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: false,
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        })
      };
    }
  }

  /**
   * Basic health check
   */
  private async healthCheck(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    const startTime = Date.now();

    try {
      // Check basic system health
      const healthStatus = {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.VERSION || '1.0.0',
        environment: process.env.ENVIRONMENT || 'development',
        region: process.env.AWS_REGION || 'us-east-1',
        functionName: context.functionName,
        functionVersion: context.functionVersion,
        requestId: context.awsRequestId,
        responseTime: Date.now() - startTime
      };

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify(healthStatus)
      };

    } catch (error) {
      return {
        statusCode: 503,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: false,
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime
        })
      };
    }
  }

  /**
   * Readiness check - indicates if the service is ready to accept traffic
   */
  private async readinessCheck(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    const startTime = Date.now();

    try {
      // Check if all dependencies are available
      const dependencies = await this.checkDependencies();

      const isReady = dependencies.every(dep => dep.healthy);

      const readinessStatus = {
        success: isReady,
        status: isReady ? 'ready' : 'not_ready',
        timestamp: new Date().toISOString(),
        dependencies,
        responseTime: Date.now() - startTime
      };

      return {
        statusCode: isReady ? 200 : 503,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify(readinessStatus)
      };

    } catch (error) {
      return {
        statusCode: 503,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: false,
          status: 'not_ready',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime
        })
      };
    }
  }

  /**
   * Liveness check - indicates if the service is alive
   */
  private async livenessCheck(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    const startTime = Date.now();

    try {
      // Simple liveness check - just verify the function is responding
      const livenessStatus = {
        success: true,
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        responseTime: Date.now() - startTime
      };

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify(livenessStatus)
      };

    } catch (error) {
      return {
        statusCode: 503,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: false,
          status: 'dead',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime
        })
      };
    }
  }

  /**
   * Metrics check - provides basic metrics
   */
  private async metricsCheck(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    const startTime = Date.now();

    try {
      const metrics = {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        metrics: {
          system: {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            platform: process.platform,
            nodeVersion: process.version,
            arch: process.arch
          },
          aws: {
            region: process.env.AWS_REGION || 'us-east-1',
            functionName: context.functionName,
            functionVersion: context.functionVersion,
            requestId: context.awsRequestId,
            remainingTime: context.getRemainingTimeInMillis()
          },
          application: {
            version: process.env.VERSION || '1.0.0',
            environment: process.env.ENVIRONMENT || 'development'
          }
        },
        responseTime: Date.now() - startTime
      };

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify(metrics)
      };

    } catch (error) {
      return {
        statusCode: 503,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: false,
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime
        })
      };
    }
  }

  /**
   * Check dependencies health
   */
  private async checkDependencies(): Promise<Array<{ name: string; healthy: boolean; error?: string }>> {
    const dependencies = [];

    // Check DynamoDB
    try {
      // In a real implementation, you would check DynamoDB connectivity
      dependencies.push({
        name: 'dynamodb',
        healthy: true
      });
    } catch (error) {
      dependencies.push({
        name: 'dynamodb',
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Check Lambda functions
    try {
      // In a real implementation, you would check if Lambda functions are available
      dependencies.push({
        name: 'scan-environment-lambda',
        healthy: true
      });
      dependencies.push({
        name: 'findings-storage-lambda',
        healthy: true
      });
    } catch (error) {
      dependencies.push({
        name: 'lambda-functions',
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Check environment variables
    try {
      const requiredEnvVars = ['AWS_REGION'];
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      
      dependencies.push({
        name: 'environment-variables',
        healthy: missingVars.length === 0,
        error: missingVars.length > 0 ? `Missing: ${missingVars.join(', ')}` : undefined
      });
    } catch (error) {
      dependencies.push({
        name: 'environment-variables',
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return dependencies;
  }

  /**
   * Get CORS headers for response
   */
  private getCorsHeaders(event: APIGatewayProxyEvent): Record<string, string> {
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
