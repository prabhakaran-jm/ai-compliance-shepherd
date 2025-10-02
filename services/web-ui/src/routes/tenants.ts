import { Router } from 'express';
import { TenantsService } from '../services/TenantsService';
import { logger } from '../utils/logger';
import { handleAsyncRoute } from '../utils/asyncHandler';

const router = Router();
const tenantsService = new TenantsService();

/**
 * Tenants API routes
 * Handles multi-tenant management and configuration
 */

// Get tenant information
router.get('/current', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching current tenant', { tenantId });

  const tenant = await tenantsService.getTenant(tenantId);
  
  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  res.json({
    success: true,
    data: tenant
  });
}));

// Update tenant settings
router.put('/current/settings', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  const settings = req.body;
  
  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Authentication required' });
  }

  logger.info('Updating tenant settings', { tenantId, userId });

  const tenant = await tenantsService.updateTenantSettings(
    tenantId, 
    settings, 
    userId
  );
  
  res.json({
    success: true,
    data: tenant
  });
}));

// Get tenant usage statistics
router.get('/current/usage', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { timeRange = '30d' } = req.query;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching tenant usage', { tenantId, timeRange });

  const usage = await tenantsService.getTenantUsage(tenantId, timeRange as string);
  
  res.json({
    success: true,
    data: usage
  });
}));

// Get tenant limits and quotas
router.get('/current/limits', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching tenant limits', { tenantId });

  const limits = await tenantsService.getTenantLimits(tenantId);
  
  res.json({
    success: true,
    data: limits
  });
}));

// Get tenant users
router.get('/current/users', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { limit = 20, offset = 0, role } = req.query;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching tenant users', { tenantId, limit, offset, role });

  const users = await tenantsService.getTenantUsers(tenantId, {
    limit: Number(limit),
    offset: Number(offset),
    role: role as string
  });
  
  res.json({
    success: true,
    data: users
  });
}));

// Invite user to tenant
router.post('/current/users/invite', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  const { email, role = 'user', permissions = [] } = req.body;
  
  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Authentication required' });
  }

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  logger.info('Inviting user to tenant', { tenantId, userId, email, role });

  const invitation = await tenantsService.inviteUser(
    tenantId, 
    email, 
    role, 
    permissions,
    userId
  );
  
  res.json({
    success: true,
    data: invitation
  });
}));

// Update user role/permissions
router.put('/current/users/:targetUserId', handleAsyncRoute(async (req, res) => {
  const { targetUserId } = req.params;
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  const { role, permissions } = req.body;
  
  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Authentication required' });
  }

  logger.info('Updating user role/permissions', { 
    tenantId, 
    userId, 
    targetUserId, 
    role, 
    permissions 
  });

  const user = await tenantsService.updateUserRole(
    tenantId, 
    targetUserId, 
    role, 
    permissions,
    userId
  );
  
  res.json({
    success: true,
    data: user
  });
}));

// Remove user from tenant
router.delete('/current/users/:targetUserId', handleAsyncRoute(async (req, res) => {
  const { targetUserId } = req.params;
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  
  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Authentication required' });
  }

  logger.info('Removing user from tenant', { tenantId, userId, targetUserId });

  await tenantsService.removeUser(tenantId, targetUserId, userId);
  
  res.json({
    success: true,
    message: 'User removed successfully'
  });
}));

// Get tenant audit logs
router.get('/current/audit-logs', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { 
    action,
    userId: filterUserId,
    startDate,
    endDate,
    limit = 50,
    offset = 0
  } = req.query;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching tenant audit logs', { 
    tenantId, 
    action, 
    filterUserId, 
    startDate, 
    endDate, 
    limit, 
    offset 
  });

  const auditLogs = await tenantsService.getAuditLogs(tenantId, {
    action: action as string,
    userId: filterUserId as string,
    startDate: startDate as string,
    endDate: endDate as string,
    limit: Number(limit),
    offset: Number(offset)
  });
  
  res.json({
    success: true,
    data: auditLogs
  });
}));

export { router as tenantsRoutes };
