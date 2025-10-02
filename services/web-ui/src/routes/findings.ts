import { Router } from 'express';
import { FindingsService } from '../services/FindingsService';
import { logger } from '../utils/logger';
import { handleAsyncRoute } from '../utils/asyncHandler';

const router = Router();
const findingsService = new FindingsService();

/**
 * Findings API routes
 * Handles compliance findings management and remediation
 */

// Get findings list
router.get('/', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { 
    severity,
    category,
    status,
    resource,
    ruleId,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching findings', { 
    tenantId, 
    severity, 
    category, 
    status, 
    resource, 
    ruleId,
    startDate,
    endDate,
    limit, 
    offset,
    sortBy,
    sortOrder
  });

  const findings = await findingsService.getFindings(tenantId, {
    severity: severity as string,
    category: category as string,
    status: status as string,
    resource: resource as string,
    ruleId: ruleId as string,
    startDate: startDate as string,
    endDate: endDate as string,
    limit: Number(limit),
    offset: Number(offset),
    sortBy: sortBy as string,
    sortOrder: sortOrder as 'asc' | 'desc'
  });
  
  res.json({
    success: true,
    data: findings
  });
}));

// Get specific finding
router.get('/:findingId', handleAsyncRoute(async (req, res) => {
  const { findingId } = req.params;
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching finding', { findingId, tenantId });

  const finding = await findingsService.getFinding(findingId, tenantId);
  
  if (!finding) {
    return res.status(404).json({ error: 'Finding not found' });
  }

  res.json({
    success: true,
    data: finding
  });
}));

// Update finding status
router.put('/:findingId/status', handleAsyncRoute(async (req, res) => {
  const { findingId } = req.params;
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  const { status, reason } = req.body;
  
  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Authentication required' });
  }

  if (!status) {
    return res.status(400).json({ error: 'Status required' });
  }

  logger.info('Updating finding status', { 
    findingId, 
    tenantId, 
    userId, 
    status, 
    reason 
  });

  const finding = await findingsService.updateFindingStatus(
    findingId, 
    tenantId, 
    status, 
    reason,
    userId
  );
  
  res.json({
    success: true,
    data: finding
  });
}));

// Suppress finding
router.post('/:findingId/suppress', handleAsyncRoute(async (req, res) => {
  const { findingId } = req.params;
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  const { reason, suppressUntil } = req.body;
  
  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Authentication required' });
  }

  if (!reason) {
    return res.status(400).json({ error: 'Suppression reason required' });
  }

  logger.info('Suppressing finding', { 
    findingId, 
    tenantId, 
    userId, 
    reason, 
    suppressUntil 
  });

  const finding = await findingsService.suppressFinding(
    findingId, 
    tenantId, 
    reason, 
    suppressUntil,
    userId
  );
  
  res.json({
    success: true,
    data: finding
  });
}));

// Apply remediation
router.post('/:findingId/remediate', handleAsyncRoute(async (req, res) => {
  const { findingId } = req.params;
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  const { remediationType = 'auto', dryRun = false } = req.body;
  
  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Authentication required' });
  }

  logger.info('Applying remediation', { 
    findingId, 
    tenantId, 
    userId, 
    remediationType, 
    dryRun 
  });

  const remediation = await findingsService.applyRemediation(
    findingId, 
    tenantId, 
    userId,
    remediationType,
    dryRun
  );
  
  res.json({
    success: true,
    data: remediation
  });
}));

// Get findings statistics
router.get('/statistics/summary', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { timeRange = '30d' } = req.query;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching findings statistics', { tenantId, timeRange });

  const statistics = await findingsService.getFindingsStatistics(
    tenantId, 
    timeRange as string
  );
  
  res.json({
    success: true,
    data: statistics
  });
}));

// Bulk operations
router.post('/bulk/update-status', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  const { findingIds, status, reason } = req.body;
  
  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Authentication required' });
  }

  if (!findingIds || !Array.isArray(findingIds) || findingIds.length === 0) {
    return res.status(400).json({ error: 'Finding IDs array required' });
  }

  if (!status) {
    return res.status(400).json({ error: 'Status required' });
  }

  logger.info('Bulk updating finding status', { 
    tenantId, 
    userId, 
    findingCount: findingIds.length,
    status, 
    reason 
  });

  const results = await findingsService.bulkUpdateStatus(
    findingIds,
    tenantId, 
    status, 
    reason,
    userId
  );
  
  res.json({
    success: true,
    data: results
  });
}));

export { router as findingsRoutes };
