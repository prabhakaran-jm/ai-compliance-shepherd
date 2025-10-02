import { Router } from 'express';
import { ScansService } from '../services/ScansService';
import { logger } from '../utils/logger';
import { handleAsyncRoute } from '../utils/asyncHandler';

const router = Router();
const scansService = new ScansService();

/**
 * Scans API routes
 * Handles environment scanning operations
 */

// Start new scan
router.post('/start', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  const {
    scanType = 'full',
    regions = [],
    services = [],
    priority = 'normal'
  } = req.body;
  
  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Authentication required' });
  }

  logger.info('Starting new scan', { 
    tenantId, 
    userId, 
    scanType, 
    regions, 
    services, 
    priority 
  });

  const scan = await scansService.startScan({
    tenantId,
    userId,
    scanType,
    regions,
    services,
    priority
  });
  
  res.json({
    success: true,
    data: scan
  });
}));

// Get scan status
router.get('/:scanId/status', handleAsyncRoute(async (req, res) => {
  const { scanId } = req.params;
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching scan status', { scanId, tenantId });

  const status = await scansService.getScanStatus(scanId, tenantId);
  
  if (!status) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  res.json({
    success: true,
    data: status
  });
}));

// Get scan results
router.get('/:scanId/results', handleAsyncRoute(async (req, res) => {
  const { scanId } = req.params;
  const tenantId = req.user?.tenantId;
  const { 
    severity,
    category,
    status,
    limit = 50,
    offset = 0
  } = req.query;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching scan results', { 
    scanId, 
    tenantId, 
    severity, 
    category, 
    status, 
    limit, 
    offset 
  });

  const results = await scansService.getScanResults(scanId, tenantId, {
    severity: severity as string,
    category: category as string,
    status: status as string,
    limit: Number(limit),
    offset: Number(offset)
  });
  
  res.json({
    success: true,
    data: results
  });
}));

// List scans
router.get('/', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { 
    status,
    scanType,
    startDate,
    endDate,
    limit = 20,
    offset = 0
  } = req.query;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching scans list', { 
    tenantId, 
    status, 
    scanType, 
    startDate, 
    endDate, 
    limit, 
    offset 
  });

  const scans = await scansService.getScans(tenantId, {
    status: status as string,
    scanType: scanType as string,
    startDate: startDate as string,
    endDate: endDate as string,
    limit: Number(limit),
    offset: Number(offset)
  });
  
  res.json({
    success: true,
    data: scans
  });
}));

// Cancel scan
router.post('/:scanId/cancel', handleAsyncRoute(async (req, res) => {
  const { scanId } = req.params;
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Cancelling scan', { scanId, tenantId });

  await scansService.cancelScan(scanId, tenantId);
  
  res.json({
    success: true,
    message: 'Scan cancelled successfully'
  });
}));

// Get scan statistics
router.get('/:scanId/statistics', handleAsyncRoute(async (req, res) => {
  const { scanId } = req.params;
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching scan statistics', { scanId, tenantId });

  const statistics = await scansService.getScanStatistics(scanId, tenantId);
  
  if (!statistics) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  res.json({
    success: true,
    data: statistics
  });
}));

export { router as scansRoutes };
