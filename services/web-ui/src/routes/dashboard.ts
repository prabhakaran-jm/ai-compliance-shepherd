import { Router } from 'express';
import { DashboardService } from '../services/DashboardService';
import { logger } from '../utils/logger';
import { handleAsyncRoute } from '../utils/asyncHandler';

const router = Router();
const dashboardService = new DashboardService();

/**
 * Dashboard API routes
 * Provides aggregated data for the main dashboard view
 */

// Get dashboard overview
router.get('/overview', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching dashboard overview', { tenantId });

  const overview = await dashboardService.getOverview(tenantId);
  
  res.json({
    success: true,
    data: overview
  });
}));

// Get compliance score trends
router.get('/compliance-trends', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { timeRange = '30d' } = req.query;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching compliance trends', { tenantId, timeRange });

  const trends = await dashboardService.getComplianceTrends(tenantId, timeRange as string);
  
  res.json({
    success: true,
    data: trends
  });
}));

// Get recent activity
router.get('/recent-activity', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { limit = 10 } = req.query;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching recent activity', { tenantId, limit });

  const activity = await dashboardService.getRecentActivity(tenantId, Number(limit));
  
  res.json({
    success: true,
    data: activity
  });
}));

// Get critical findings summary
router.get('/critical-findings', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching critical findings', { tenantId });

  const findings = await dashboardService.getCriticalFindings(tenantId);
  
  res.json({
    success: true,
    data: findings
  });
}));

// Get scan status
router.get('/scan-status', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching scan status', { tenantId });

  const status = await dashboardService.getScanStatus(tenantId);
  
  res.json({
    success: true,
    data: status
  });
}));

// Get resource statistics
router.get('/resource-stats', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching resource statistics', { tenantId });

  const stats = await dashboardService.getResourceStatistics(tenantId);
  
  res.json({
    success: true,
    data: stats
  });
}));

export { router as dashboardRoutes };
