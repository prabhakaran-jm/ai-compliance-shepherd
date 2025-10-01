/**
 * S3 Bucket Manager Service
 * 
 * Manages S3 buckets for reports and artifacts with proper permissions,
 * lifecycle policies, and security configurations.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { S3, IAM, KMS } from 'aws-sdk';
import { BucketConfigurationService } from './BucketConfigurationService';
import { BucketSecurityService } from './BucketSecurityService';
import { BucketLifecycleService } from './BucketLifecycleService';
import { logger } from '../utils/logger';
import { ValidationError, NotFoundError } from '../utils/errorHandler';

export interface BucketConfiguration {
  bucketName: string;
  region: string;
  purpose: 'reports' | 'artifacts' | 'logs' | 'backups';
  encryption: 'AES256' | 'aws-kms';
  kmsKeyId?: string;
  versioning: boolean;
  publicAccessBlock: boolean;
  lifecyclePolicy: {
    enabled: boolean;
    rules: Array<{
      id: string;
      status: 'Enabled' | 'Disabled';
      transitions?: Array<{
        days: number;
        storageClass: 'STANDARD_IA' | 'GLACIER' | 'DEEP_ARCHIVE';
      }>;
      expiration?: {
        days: number;
      };
    }>;
  };
  corsConfiguration?: {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    maxAgeSeconds: number;
  };
}

export interface BucketInfo {
  bucketName: string;
  region: string;
  purpose: string;
  creationDate: string;
  size: number;
  objectCount: number;
  encryption: string;
  versioning: boolean;
  publicAccessBlock: boolean;
  lifecyclePolicy: boolean;
  corsConfiguration: boolean;
}

export class S3BucketManagerService {
  private s3: S3;
  private iam: IAM;
  private kms: KMS;
  private configService: BucketConfigurationService;
  private securityService: BucketSecurityService;
  private lifecycleService: BucketLifecycleService;

  constructor() {
    this.s3 = new S3({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.iam = new IAM({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.kms = new KMS({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.configService = new BucketConfigurationService();
    this.securityService = new BucketSecurityService();
    this.lifecycleService = new BucketLifecycleService();
  }

  /**
   * Route incoming requests to appropriate handlers
   */
  async routeRequest(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    const { httpMethod, path, pathParameters, body } = event;

    logger.info('Routing S3 bucket management request', {
      method: httpMethod,
      path,
      pathParameters
    });

    try {
      // Extract route information
      const route = this.extractRoute(path);
      const bucketName = pathParameters?.bucketName;

      switch (httpMethod) {
        case 'POST':
          if (path.endsWith('/buckets')) {
            return await this.createBucket(event, context);
          }
          break;

        case 'GET':
          if (bucketName) {
            return await this.getBucketInfo(event, context, bucketName);
          } else if (path.endsWith('/buckets')) {
            return await this.listBuckets(event, context);
          }
          break;

        case 'PUT':
          if (bucketName && path.endsWith('/configuration')) {
            return await this.updateBucketConfiguration(event, context, bucketName);
          } else if (bucketName && path.endsWith('/permissions')) {
            return await this.updateBucketPermissions(event, context, bucketName);
          } else if (bucketName && path.endsWith('/lifecycle')) {
            return await this.updateBucketLifecycle(event, context, bucketName);
          }
          break;

        case 'DELETE':
          if (bucketName) {
            return await this.deleteBucket(event, context, bucketName);
          }
          break;

        default:
          throw new ValidationError(`Method ${httpMethod} not supported for buckets`);
      }

      throw new NotFoundError(`Bucket endpoint not found: ${path}`);

    } catch (error) {
      logger.error('S3 bucket management routing failed', {
        method: httpMethod,
        path,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Create a new S3 bucket
   */
  private async createBucket(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    try {
      // Parse and validate request body
      const requestBody = JSON.parse(body || '{}');
      const validatedConfig = this.validateBucketConfiguration(requestBody);

      // Extract tenant information from auth context
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';
      const userId = event.requestContext.authorizer?.userId || 'unknown-user';

      logger.info('Creating new S3 bucket', {
        tenantId,
        userId,
        bucketName: validatedConfig.bucketName,
        purpose: validatedConfig.purpose,
        region: validatedConfig.region
      });

      // Generate unique bucket name if not provided
      const bucketName = validatedConfig.bucketName || this.generateBucketName(validatedConfig.purpose, tenantId);

      // Create bucket configuration
      const bucketConfig: BucketConfiguration = {
        ...validatedConfig,
        bucketName
      };

      // Create the bucket
      await this.configService.createBucket(bucketConfig);

      // Configure security settings
      await this.securityService.configureBucketSecurity(bucketName, bucketConfig);

      // Configure lifecycle policy
      if (bucketConfig.lifecyclePolicy.enabled) {
        await this.lifecycleService.configureLifecyclePolicy(bucketName, bucketConfig.lifecyclePolicy);
      }

      // Configure CORS if specified
      if (bucketConfig.corsConfiguration) {
        await this.configService.configureCORS(bucketName, bucketConfig.corsConfiguration);
      }

      logger.info('S3 bucket created successfully', {
        bucketName,
        tenantId,
        userId,
        purpose: bucketConfig.purpose
      });

      return {
        statusCode: 201,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          data: {
            bucketName,
            region: bucketConfig.region,
            purpose: bucketConfig.purpose,
            encryption: bucketConfig.encryption,
            versioning: bucketConfig.versioning,
            publicAccessBlock: bucketConfig.publicAccessBlock,
            lifecyclePolicy: bucketConfig.lifecyclePolicy.enabled,
            corsConfiguration: !!bucketConfig.corsConfiguration,
            createdBy: userId,
            createdAt: new Date().toISOString()
          }
        })
      };

    } catch (error) {
      if (error instanceof ValidationError) {
        return {
          statusCode: 400,
          headers: this.getCorsHeaders(event),
          body: JSON.stringify({
            success: false,
            error: 'Validation Error',
            message: error.message,
            details: error.details
          })
        };
      }

      throw error;
    }
  }

  /**
   * Get bucket information
   */
  private async getBucketInfo(
    event: APIGatewayProxyEvent,
    context: Context,
    bucketName: string
  ): Promise<APIGatewayProxyResult> {
    try {
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';

      logger.info('Getting bucket information', {
        bucketName,
        tenantId
      });

      // Get bucket information
      const bucketInfo = await this.configService.getBucketInfo(bucketName);

      if (!bucketInfo) {
        return {
          statusCode: 404,
          headers: this.getCorsHeaders(event),
          body: JSON.stringify({
            success: false,
            error: 'Bucket not found',
            message: `Bucket ${bucketName} not found`
          })
        };
      }

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          data: bucketInfo
        })
      };

    } catch (error) {
      logger.error('Failed to get bucket information', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * List buckets
   */
  private async listBuckets(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    try {
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';
      const queryParams = event.queryStringParameters || {};
      
      const limit = parseInt(queryParams.limit || '10');
      const offset = parseInt(queryParams.offset || '0');
      const purpose = queryParams.purpose;

      logger.info('Listing buckets', {
        tenantId,
        limit,
        offset,
        purpose
      });

      // List buckets
      const buckets = await this.configService.listBuckets({
        tenantId,
        limit,
        offset,
        purpose
      });

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          data: {
            buckets: buckets.items,
            pagination: {
              limit,
              offset,
              total: buckets.total,
              hasMore: buckets.hasMore
            }
          }
        })
      };

    } catch (error) {
      logger.error('Failed to list buckets', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update bucket configuration
   */
  private async updateBucketConfiguration(
    event: APIGatewayProxyEvent,
    context: Context,
    bucketName: string
  ): Promise<APIGatewayProxyResult> {
    try {
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';
      const requestBody = JSON.parse(body || '{}');

      logger.info('Updating bucket configuration', {
        bucketName,
        tenantId,
        updateData: requestBody
      });

      // Validate update request
      if (!requestBody.encryption && !requestBody.versioning && !requestBody.corsConfiguration) {
        return {
          statusCode: 400,
          headers: this.getCorsHeaders(event),
          body: JSON.stringify({
            success: false,
            error: 'Validation Error',
            message: 'At least one configuration field must be provided for update'
          })
        };
      }

      // Update bucket configuration
      const updatedConfig = await this.configService.updateBucketConfiguration(bucketName, requestBody);

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          data: updatedConfig,
          message: 'Bucket configuration updated successfully'
        })
      };

    } catch (error) {
      logger.error('Failed to update bucket configuration', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update bucket permissions
   */
  private async updateBucketPermissions(
    event: APIGatewayProxyEvent,
    context: Context,
    bucketName: string
  ): Promise<APIGatewayProxyResult> {
    try {
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';
      const requestBody = JSON.parse(body || '{}');

      logger.info('Updating bucket permissions', {
        bucketName,
        tenantId,
        updateData: requestBody
      });

      // Update bucket permissions
      const updatedPermissions = await this.securityService.updateBucketPermissions(bucketName, requestBody);

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          data: updatedPermissions,
          message: 'Bucket permissions updated successfully'
        })
      };

    } catch (error) {
      logger.error('Failed to update bucket permissions', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update bucket lifecycle policy
   */
  private async updateBucketLifecycle(
    event: APIGatewayProxyEvent,
    context: Context,
    bucketName: string
  ): Promise<APIGatewayProxyResult> {
    try {
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';
      const requestBody = JSON.parse(body || '{}');

      logger.info('Updating bucket lifecycle policy', {
        bucketName,
        tenantId,
        updateData: requestBody
      });

      // Update lifecycle policy
      const updatedLifecycle = await this.lifecycleService.updateLifecyclePolicy(bucketName, requestBody);

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          data: updatedLifecycle,
          message: 'Bucket lifecycle policy updated successfully'
        })
      };

    } catch (error) {
      logger.error('Failed to update bucket lifecycle policy', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Delete bucket
   */
  private async deleteBucket(
    event: APIGatewayProxyEvent,
    context: Context,
    bucketName: string
  ): Promise<APIGatewayProxyResult> {
    try {
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';

      logger.info('Deleting bucket', {
        bucketName,
        tenantId
      });

      // Delete bucket
      const deleted = await this.configService.deleteBucket(bucketName);

      if (!deleted) {
        return {
          statusCode: 404,
          headers: this.getCorsHeaders(event),
          body: JSON.stringify({
            success: false,
            error: 'Bucket not found',
            message: `Bucket ${bucketName} not found`
          })
        };
      }

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          message: 'Bucket deleted successfully'
        })
      };

    } catch (error) {
      logger.error('Failed to delete bucket', {
        bucketName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate bucket configuration
   */
  private validateBucketConfiguration(body: any): BucketConfiguration {
    if (!body.purpose || !['reports', 'artifacts', 'logs', 'backups'].includes(body.purpose)) {
      throw new ValidationError('purpose must be one of: reports, artifacts, logs, backups');
    }

    if (!body.region || typeof body.region !== 'string') {
      throw new ValidationError('region is required and must be a string');
    }

    if (body.encryption && !['AES256', 'aws-kms'].includes(body.encryption)) {
      throw new ValidationError('encryption must be one of: AES256, aw-kms');
    }

    if (body.encryption === 'aws-kms' && !body.kmsKeyId) {
      throw new ValidationError('kmsKeyId is required when encryption is aws-kms');
    }

    return {
      bucketName: body.bucketName,
      region: body.region,
      purpose: body.purpose,
      encryption: body.encryption || 'AES256',
      kmsKeyId: body.kmsKeyId,
      versioning: body.versioning !== false, // Default to true
      publicAccessBlock: body.publicAccessBlock !== false, // Default to true
      lifecyclePolicy: body.lifecyclePolicy || {
        enabled: true,
        rules: [
          {
            id: 'default-rule',
            status: 'Enabled',
            expiration: { days: 30 }
          }
        ]
      },
      corsConfiguration: body.corsConfiguration
    };
  }

  /**
   * Generate unique bucket name
   */
  private generateBucketName(purpose: string, tenantId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `compliance-shepherd-${purpose}-${tenantId}-${timestamp}-${random}`;
  }

  /**
   * Extract route from path
   */
  private extractRoute(path: string): string {
    const segments = path.replace(/^\//, '').split('/');
    return segments[0] || 'buckets';
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
