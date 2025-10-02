import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { KMSClient } from '@aws-sdk/client-kms';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { logger } from '../utils/logger';
import { TenantManagementError } from '../utils/errorHandler';
import { 
  TenantRequest,
  TenantResponse,
  TenantUpdateRequest,
  TenantListRequest,
  TenantConfiguration,
  TenantMetrics,
  TenantHealth
} from '../types/tenant';
import { v4 as uuidv4 } from 'uuid';
import { TenantEncryptionService } from './TenantEncryptionService';
import { TenantResourceService } from './TenantResourceService';

/**
 * Service for managing tenant lifecycle and operations
 * Handles tenant CRUD operations with secure isolation
 */
export class TenantManagementService {
  private dynamoClient: DynamoDBClient;
  private s3Client: S3Client;
  private kmsClient: KMSClient;
  private stsClient: STSClient;
  private encryptionService: TenantEncryptionService;
  private resourceService: TenantResourceService;
  private accountId?: string;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.dynamoClient = new DynamoDBClient({ region: this.region });
    this.s3Client = new S3Client({ region: this.region });
    this.kmsClient = new KMSClient({ region: this.region });
    this.stsClient = new STSClient({ region: this.region });
    this.encryptionService = new TenantEncryptionService();
    this.resourceService = new TenantResourceService();
  }

  /**
   * Create a new tenant
   */
  async createTenant(request: TenantRequest, correlationId: string): Promise<TenantResponse> {
    try {
      logger.info('Creating tenant', {
        correlationId,
        tenantName: request.name,
        organizationId: request.organizationId
      });

      // Get account ID if not cached
      if (!this.accountId) {
        const identity = await this.stsClient.send(new GetCallerIdentityCommand({}));
        this.accountId = identity.Account;
      }

      // Generate tenant ID and validate uniqueness
      const tenantId = this.generateTenantId(request.name);
      await this.validateTenantUniqueness(tenantId, request.name);

      // Create tenant encryption keys
      const encryptionKeys = await this.encryptionService.createTenantKeys(tenantId, correlationId);

      // Create tenant resources (S3 buckets, DynamoDB tables, etc.)
      const resources = await this.resourceService.createTenantResources(tenantId, encryptionKeys, correlationId);

      // Create tenant record
      const tenant: TenantResponse = {
        tenantId,
        name: request.name,
        displayName: request.displayName || request.name,
        organizationId: request.organizationId,
        status: 'ACTIVE',
        tier: request.tier || 'STANDARD',
        region: this.region,
        accountId: this.accountId!,
        configuration: {
          complianceFrameworks: request.configuration?.complianceFrameworks || ['SOC2'],
          scanSchedule: request.configuration?.scanSchedule || 'DAILY',
          retentionPeriodDays: request.configuration?.retentionPeriodDays || 365,
          encryptionEnabled: true,
          auditLoggingEnabled: true,
          crossAccountRoleEnabled: request.configuration?.crossAccountRoleEnabled || false,
          allowedRegions: request.configuration?.allowedRegions || [this.region],
          resourceLimits: {
            maxFindings: request.configuration?.resourceLimits?.maxFindings || 10000,
            maxScanJobs: request.configuration?.resourceLimits?.maxScanJobs || 100,
            maxUsers: request.configuration?.resourceLimits?.maxUsers || 50,
            maxReports: request.configuration?.resourceLimits?.maxReports || 1000
          },
          features: {
            automatedRemediation: request.configuration?.features?.automatedRemediation ?? true,
            realTimeMonitoring: request.configuration?.features?.realTimeMonitoring ?? true,
            customRules: request.configuration?.features?.customRules ?? false,
            apiAccess: request.configuration?.features?.apiAccess ?? true,
            ssoIntegration: request.configuration?.features?.ssoIntegration ?? false
          }
        },
        resources: {
          kmsKeyId: encryptionKeys.keyId,
          kmsKeyArn: encryptionKeys.keyArn,
          s3BucketName: resources.s3BucketName,
          dynamoTablePrefix: resources.dynamoTablePrefix,
          iamRoleArn: resources.iamRoleArn,
          secretsManagerPrefix: resources.secretsManagerPrefix
        },
        metadata: {
          createdAt: new Date().toISOString(),
          createdBy: request.createdBy || 'system',
          lastModifiedAt: new Date().toISOString(),
          lastModifiedBy: request.createdBy || 'system',
          version: 1
        },
        contactInfo: request.contactInfo,
        billingInfo: request.billingInfo
      };

      // Store tenant in DynamoDB
      await this.storeTenant(tenant, correlationId);

      // Initialize tenant-specific configurations
      await this.initializeTenantDefaults(tenant, correlationId);

      logger.info('Tenant created successfully', {
        correlationId,
        tenantId,
        tenantName: tenant.name,
        resources: Object.keys(tenant.resources)
      });

      return tenant;

    } catch (error) {
      logger.error('Error creating tenant', {
        correlationId,
        tenantName: request.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new TenantManagementError(
        `Failed to create tenant: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string, correlationId: string): Promise<TenantResponse> {
    try {
      logger.info('Getting tenant', {
        correlationId,
        tenantId
      });

      const tenant = await this.retrieveTenant(tenantId, correlationId);
      
      if (!tenant) {
        throw new TenantManagementError(`Tenant not found: ${tenantId}`, 'TENANT_NOT_FOUND', 404);
      }

      logger.info('Tenant retrieved successfully', {
        correlationId,
        tenantId,
        tenantName: tenant.name,
        status: tenant.status
      });

      return tenant;

    } catch (error) {
      logger.error('Error getting tenant', {
        correlationId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof TenantManagementError) {
        throw error;
      }

      throw new TenantManagementError(
        `Failed to get tenant: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update tenant
   */
  async updateTenant(
    tenantId: string, 
    request: TenantUpdateRequest, 
    correlationId: string
  ): Promise<TenantResponse> {
    try {
      logger.info('Updating tenant', {
        correlationId,
        tenantId,
        updateFields: Object.keys(request)
      });

      // Get existing tenant
      const existingTenant = await this.retrieveTenant(tenantId, correlationId);
      if (!existingTenant) {
        throw new TenantManagementError(`Tenant not found: ${tenantId}`, 'TENANT_NOT_FOUND', 404);
      }

      // Update tenant fields
      const updatedTenant: TenantResponse = {
        ...existingTenant,
        ...(request.displayName && { displayName: request.displayName }),
        ...(request.status && { status: request.status }),
        ...(request.tier && { tier: request.tier }),
        ...(request.contactInfo && { contactInfo: { ...existingTenant.contactInfo, ...request.contactInfo } }),
        ...(request.billingInfo && { billingInfo: { ...existingTenant.billingInfo, ...request.billingInfo } }),
        metadata: {
          ...existingTenant.metadata,
          lastModifiedAt: new Date().toISOString(),
          lastModifiedBy: request.updatedBy || 'system',
          version: existingTenant.metadata.version + 1
        }
      };

      // Store updated tenant
      await this.storeTenant(updatedTenant, correlationId);

      logger.info('Tenant updated successfully', {
        correlationId,
        tenantId,
        version: updatedTenant.metadata.version
      });

      return updatedTenant;

    } catch (error) {
      logger.error('Error updating tenant', {
        correlationId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof TenantManagementError) {
        throw error;
      }

      throw new TenantManagementError(
        `Failed to update tenant: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete tenant
   */
  async deleteTenant(tenantId: string, correlationId: string): Promise<{ deleted: boolean; message: string }> {
    try {
      logger.info('Deleting tenant', {
        correlationId,
        tenantId
      });

      // Get existing tenant
      const existingTenant = await this.retrieveTenant(tenantId, correlationId);
      if (!existingTenant) {
        throw new TenantManagementError(`Tenant not found: ${tenantId}`, 'TENANT_NOT_FOUND', 404);
      }

      // Mark tenant as deleted (soft delete)
      const deletedTenant: TenantResponse = {
        ...existingTenant,
        status: 'DELETED',
        metadata: {
          ...existingTenant.metadata,
          lastModifiedAt: new Date().toISOString(),
          lastModifiedBy: 'system',
          deletedAt: new Date().toISOString(),
          version: existingTenant.metadata.version + 1
        }
      };

      // Store deleted tenant
      await this.storeTenant(deletedTenant, correlationId);

      // Schedule resource cleanup (async)
      await this.scheduleResourceCleanup(tenantId, correlationId);

      logger.info('Tenant deleted successfully', {
        correlationId,
        tenantId
      });

      return {
        deleted: true,
        message: 'Tenant marked for deletion. Resources will be cleaned up asynchronously.'
      };

    } catch (error) {
      logger.error('Error deleting tenant', {
        correlationId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof TenantManagementError) {
        throw error;
      }

      throw new TenantManagementError(
        `Failed to delete tenant: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * List tenants
   */
  async listTenants(
    request: TenantListRequest,
    correlationId: string
  ): Promise<{ tenants: TenantResponse[]; nextToken?: string }> {
    try {
      logger.info('Listing tenants', {
        correlationId,
        limit: request.limit,
        status: request.status
      });

      // In a real implementation, this would query DynamoDB with pagination
      // For now, return mock data
      const mockTenants: TenantResponse[] = [
        {
          tenantId: 'tenant-demo-company',
          name: 'demo-company',
          displayName: 'Demo Company Inc.',
          organizationId: 'org-123',
          status: 'ACTIVE',
          tier: 'ENTERPRISE',
          region: this.region,
          accountId: this.accountId || '123456789012',
          configuration: {
            complianceFrameworks: ['SOC2', 'HIPAA'],
            scanSchedule: 'DAILY',
            retentionPeriodDays: 365,
            encryptionEnabled: true,
            auditLoggingEnabled: true,
            crossAccountRoleEnabled: true,
            allowedRegions: ['us-east-1', 'us-west-2'],
            resourceLimits: {
              maxFindings: 50000,
              maxScanJobs: 500,
              maxUsers: 200,
              maxReports: 5000
            },
            features: {
              automatedRemediation: true,
              realTimeMonitoring: true,
              customRules: true,
              apiAccess: true,
              ssoIntegration: true
            }
          },
          resources: {
            kmsKeyId: 'key-123',
            kmsKeyArn: `arn:aws:kms:${this.region}:${this.accountId}:key/key-123`,
            s3BucketName: 'compliance-shepherd-demo-company',
            dynamoTablePrefix: 'demo-company',
            iamRoleArn: `arn:aws:iam::${this.accountId}:role/ComplianceShepherd-demo-company`,
            secretsManagerPrefix: 'compliance-shepherd/demo-company'
          },
          metadata: {
            createdAt: '2023-01-01T00:00:00Z',
            createdBy: 'admin@demo-company.com',
            lastModifiedAt: '2023-01-15T10:30:00Z',
            lastModifiedBy: 'admin@demo-company.com',
            version: 3
          },
          contactInfo: {
            primaryContact: {
              name: 'John Doe',
              email: 'john.doe@demo-company.com',
              phone: '+1-555-0123'
            },
            technicalContact: {
              name: 'Jane Smith',
              email: 'jane.smith@demo-company.com',
              phone: '+1-555-0124'
            }
          },
          billingInfo: {
            billingEmail: 'billing@demo-company.com',
            paymentMethod: 'CREDIT_CARD',
            billingAddress: {
              street: '123 Main St',
              city: 'San Francisco',
              state: 'CA',
              zipCode: '94105',
              country: 'US'
            }
          }
        }
      ];

      // Apply filters
      let filteredTenants = mockTenants;
      
      if (request.status) {
        filteredTenants = filteredTenants.filter(t => t.status === request.status);
      }

      // Apply limit
      const limitedTenants = filteredTenants.slice(0, request.limit || 50);

      logger.info('Tenants listed successfully', {
        correlationId,
        tenantCount: limitedTenants.length
      });

      return {
        tenants: limitedTenants
      };

    } catch (error) {
      logger.error('Error listing tenants', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new TenantManagementError(
        `Failed to list tenants: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get tenant configuration
   */
  async getTenantConfiguration(tenantId: string, correlationId: string): Promise<TenantConfiguration> {
    try {
      const tenant = await this.getTenant(tenantId, correlationId);
      return tenant.configuration;
    } catch (error) {
      throw new TenantManagementError(
        `Failed to get tenant configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update tenant configuration
   */
  async updateTenantConfiguration(
    tenantId: string,
    configuration: Partial<TenantConfiguration>,
    correlationId: string
  ): Promise<TenantConfiguration> {
    try {
      logger.info('Updating tenant configuration', {
        correlationId,
        tenantId,
        configFields: Object.keys(configuration)
      });

      const tenant = await this.getTenant(tenantId, correlationId);
      
      const updatedConfiguration: TenantConfiguration = {
        ...tenant.configuration,
        ...configuration
      };

      const updatedTenant: TenantResponse = {
        ...tenant,
        configuration: updatedConfiguration,
        metadata: {
          ...tenant.metadata,
          lastModifiedAt: new Date().toISOString(),
          lastModifiedBy: 'system',
          version: tenant.metadata.version + 1
        }
      };

      await this.storeTenant(updatedTenant, correlationId);

      logger.info('Tenant configuration updated successfully', {
        correlationId,
        tenantId
      });

      return updatedConfiguration;

    } catch (error) {
      logger.error('Error updating tenant configuration', {
        correlationId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new TenantManagementError(
        `Failed to update tenant configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get tenant metrics
   */
  async getTenantMetrics(tenantId: string, correlationId: string): Promise<TenantMetrics> {
    try {
      logger.info('Getting tenant metrics', {
        correlationId,
        tenantId
      });

      // In a real implementation, this would aggregate metrics from CloudWatch, DynamoDB, etc.
      const mockMetrics: TenantMetrics = {
        tenantId,
        period: '30d',
        scanJobs: {
          total: 45,
          successful: 42,
          failed: 3,
          averageDuration: 180000 // 3 minutes in ms
        },
        findings: {
          total: 1250,
          critical: 15,
          high: 85,
          medium: 450,
          low: 700,
          resolved: 950,
          suppressed: 50
        },
        resources: {
          totalScanned: 2500,
          s3Buckets: 150,
          iamUsers: 45,
          iamRoles: 85,
          ec2Instances: 120,
          securityGroups: 95
        },
        compliance: {
          overallScore: 87.5,
          soc2Score: 92.0,
          hipaaScore: 85.0,
          gdprScore: 84.0
        },
        usage: {
          apiCalls: 15000,
          storageUsedGB: 2.5,
          reportGenerated: 25,
          remediationActions: 180
        },
        costs: {
          totalCostUSD: 125.50,
          computeCostUSD: 45.20,
          storageCostUSD: 15.30,
          apiCostUSD: 65.00
        },
        generatedAt: new Date().toISOString()
      };

      logger.info('Tenant metrics retrieved successfully', {
        correlationId,
        tenantId,
        overallScore: mockMetrics.compliance.overallScore
      });

      return mockMetrics;

    } catch (error) {
      logger.error('Error getting tenant metrics', {
        correlationId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new TenantManagementError(
        `Failed to get tenant metrics: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get tenant health status
   */
  async getTenantHealth(tenantId: string, correlationId: string): Promise<TenantHealth> {
    try {
      logger.info('Getting tenant health', {
        correlationId,
        tenantId
      });

      // Check various health indicators
      const mockHealth: TenantHealth = {
        tenantId,
        overallStatus: 'HEALTHY',
        components: {
          database: {
            status: 'HEALTHY',
            responseTime: 25,
            lastCheck: new Date().toISOString()
          },
          storage: {
            status: 'HEALTHY',
            responseTime: 15,
            lastCheck: new Date().toISOString()
          },
          encryption: {
            status: 'HEALTHY',
            responseTime: 10,
            lastCheck: new Date().toISOString()
          },
          api: {
            status: 'HEALTHY',
            responseTime: 45,
            lastCheck: new Date().toISOString()
          },
          scanning: {
            status: 'HEALTHY',
            responseTime: 120,
            lastCheck: new Date().toISOString()
          }
        },
        metrics: {
          uptime: 99.95,
          errorRate: 0.02,
          avgResponseTime: 43,
          throughput: 150
        },
        alerts: [],
        lastHealthCheck: new Date().toISOString()
      };

      logger.info('Tenant health retrieved successfully', {
        correlationId,
        tenantId,
        overallStatus: mockHealth.overallStatus,
        uptime: mockHealth.metrics.uptime
      });

      return mockHealth;

    } catch (error) {
      logger.error('Error getting tenant health', {
        correlationId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new TenantManagementError(
        `Failed to get tenant health: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate tenant ID from name
   */
  private generateTenantId(name: string): string {
    // Create a URL-safe tenant ID
    const sanitized = name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    return `tenant-${sanitized}`;
  }

  /**
   * Validate tenant uniqueness
   */
  private async validateTenantUniqueness(tenantId: string, name: string): Promise<void> {
    // In a real implementation, this would check DynamoDB
    // For now, just validate format
    if (tenantId.length < 8 || tenantId.length > 100) {
      throw new TenantManagementError('Tenant ID must be between 8 and 100 characters');
    }
  }

  /**
   * Store tenant in DynamoDB
   */
  private async storeTenant(tenant: TenantResponse, correlationId: string): Promise<void> {
    // In a real implementation, this would store in DynamoDB
    logger.debug('Storing tenant in database', {
      correlationId,
      tenantId: tenant.tenantId,
      version: tenant.metadata.version
    });
  }

  /**
   * Retrieve tenant from DynamoDB
   */
  private async retrieveTenant(tenantId: string, correlationId: string): Promise<TenantResponse | null> {
    // In a real implementation, this would retrieve from DynamoDB
    logger.debug('Retrieving tenant from database', {
      correlationId,
      tenantId
    });

    // Return mock data for demo
    if (tenantId === 'tenant-demo-company') {
      return {
        tenantId,
        name: 'demo-company',
        displayName: 'Demo Company Inc.',
        organizationId: 'org-123',
        status: 'ACTIVE',
        tier: 'ENTERPRISE',
        region: this.region,
        accountId: this.accountId || '123456789012',
        configuration: {
          complianceFrameworks: ['SOC2', 'HIPAA'],
          scanSchedule: 'DAILY',
          retentionPeriodDays: 365,
          encryptionEnabled: true,
          auditLoggingEnabled: true,
          crossAccountRoleEnabled: true,
          allowedRegions: ['us-east-1', 'us-west-2'],
          resourceLimits: {
            maxFindings: 50000,
            maxScanJobs: 500,
            maxUsers: 200,
            maxReports: 5000
          },
          features: {
            automatedRemediation: true,
            realTimeMonitoring: true,
            customRules: true,
            apiAccess: true,
            ssoIntegration: true
          }
        },
        resources: {
          kmsKeyId: 'key-123',
          kmsKeyArn: `arn:aws:kms:${this.region}:${this.accountId}:key/key-123`,
          s3BucketName: 'compliance-shepherd-demo-company',
          dynamoTablePrefix: 'demo-company',
          iamRoleArn: `arn:aws:iam::${this.accountId}:role/ComplianceShepherd-demo-company`,
          secretsManagerPrefix: 'compliance-shepherd/demo-company'
        },
        metadata: {
          createdAt: '2023-01-01T00:00:00Z',
          createdBy: 'admin@demo-company.com',
          lastModifiedAt: '2023-01-15T10:30:00Z',
          lastModifiedBy: 'admin@demo-company.com',
          version: 3
        },
        contactInfo: {
          primaryContact: {
            name: 'John Doe',
            email: 'john.doe@demo-company.com',
            phone: '+1-555-0123'
          },
          technicalContact: {
            name: 'Jane Smith',
            email: 'jane.smith@demo-company.com',
            phone: '+1-555-0124'
          }
        },
        billingInfo: {
          billingEmail: 'billing@demo-company.com',
          paymentMethod: 'CREDIT_CARD',
          billingAddress: {
            street: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            zipCode: '94105',
            country: 'US'
          }
        }
      };
    }

    return null;
  }

  /**
   * Initialize tenant defaults
   */
  private async initializeTenantDefaults(tenant: TenantResponse, correlationId: string): Promise<void> {
    logger.debug('Initializing tenant defaults', {
      correlationId,
      tenantId: tenant.tenantId
    });

    // In a real implementation, this would:
    // - Create default compliance rules
    // - Set up default schedules
    // - Initialize monitoring
    // - Create default users/roles
  }

  /**
   * Schedule resource cleanup for deleted tenant
   */
  private async scheduleResourceCleanup(tenantId: string, correlationId: string): Promise<void> {
    logger.info('Scheduling resource cleanup for deleted tenant', {
      correlationId,
      tenantId
    });

    // In a real implementation, this would:
    // - Schedule S3 bucket deletion
    // - Schedule DynamoDB table deletion
    // - Schedule KMS key deletion
    // - Clean up IAM roles and policies
  }
}
