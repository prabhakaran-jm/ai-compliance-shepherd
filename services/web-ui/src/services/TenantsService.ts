import axios from 'axios';
import { logger } from '../utils/logger';

interface TenantsFilters {
  limit?: number;
  offset?: number;
  role?: string;
}

interface AuditLogsFilters {
  action?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Tenants Service
 * Handles multi-tenant management and configuration
 */
export class TenantsService {
  private readonly tenantManagementUrl: string;
  private readonly apiBaseUrl: string;

  constructor() {
    this.tenantManagementUrl = process.env.TENANT_MANAGEMENT_URL || 'http://localhost:8087';
    this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:8080';
  }

  /**
   * Get tenant information
   */
  async getTenant(tenantId: string) {
    try {
      logger.info('Fetching tenant', { tenantId });

      const response = await axios.get(
        `${this.tenantManagementUrl}/api/tenants/${tenantId}`,
        { timeout: 30000 }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching tenant', { 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  /**
   * Update tenant settings
   */
  async updateTenantSettings(tenantId: string, settings: any, userId: string) {
    try {
      logger.info('Updating tenant settings', { tenantId, userId });

      const response = await axios.put(
        `${this.tenantManagementUrl}/api/tenants/${tenantId}/settings`,
        {
          settings,
          userId
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error updating tenant settings', { 
        tenantId, 
        userId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get tenant usage statistics
   */
  async getTenantUsage(tenantId: string, timeRange: string) {
    try {
      logger.info('Fetching tenant usage', { tenantId, timeRange });

      const response = await axios.get(
        `${this.tenantManagementUrl}/api/tenants/${tenantId}/usage`,
        {
          params: { timeRange },
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching tenant usage', { 
        tenantId, 
        timeRange,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get tenant limits and quotas
   */
  async getTenantLimits(tenantId: string) {
    try {
      logger.info('Fetching tenant limits', { tenantId });

      const response = await axios.get(
        `${this.tenantManagementUrl}/api/tenants/${tenantId}/limits`,
        { timeout: 30000 }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching tenant limits', { 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get tenant users
   */
  async getTenantUsers(tenantId: string, filters: TenantsFilters) {
    try {
      logger.info('Fetching tenant users', { tenantId, filters });

      const response = await axios.get(
        `${this.tenantManagementUrl}/api/tenants/${tenantId}/users`,
        {
          params: filters,
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching tenant users', { 
        tenantId, 
        filters,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Invite user to tenant
   */
  async inviteUser(
    tenantId: string,
    email: string,
    role: string,
    permissions: string[],
    userId: string
  ) {
    try {
      logger.info('Inviting user to tenant', { 
        tenantId, 
        email, 
        role, 
        userId 
      });

      const response = await axios.post(
        `${this.tenantManagementUrl}/api/tenants/${tenantId}/users/invite`,
        {
          email,
          role,
          permissions,
          invitedBy: userId
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error inviting user', { 
        tenantId, 
        email, 
        role, 
        userId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Update user role/permissions
   */
  async updateUserRole(
    tenantId: string,
    targetUserId: string,
    role: string,
    permissions: string[],
    userId: string
  ) {
    try {
      logger.info('Updating user role/permissions', { 
        tenantId, 
        targetUserId, 
        role, 
        userId 
      });

      const response = await axios.put(
        `${this.tenantManagementUrl}/api/tenants/${tenantId}/users/${targetUserId}`,
        {
          role,
          permissions,
          updatedBy: userId
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error updating user role', { 
        tenantId, 
        targetUserId, 
        role, 
        userId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Remove user from tenant
   */
  async removeUser(tenantId: string, targetUserId: string, userId: string) {
    try {
      logger.info('Removing user from tenant', { 
        tenantId, 
        targetUserId, 
        userId 
      });

      await axios.delete(
        `${this.tenantManagementUrl}/api/tenants/${tenantId}/users/${targetUserId}`,
        {
          data: { removedBy: userId },
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('User removed successfully', { tenantId, targetUserId });
    } catch (error) {
      logger.error('Error removing user', { 
        tenantId, 
        targetUserId, 
        userId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get tenant audit logs
   */
  async getAuditLogs(tenantId: string, filters: AuditLogsFilters) {
    try {
      logger.info('Fetching tenant audit logs', { tenantId, filters });

      const response = await axios.get(
        `${this.tenantManagementUrl}/api/tenants/${tenantId}/audit-logs`,
        {
          params: filters,
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching audit logs', { 
        tenantId, 
        filters,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }
}
