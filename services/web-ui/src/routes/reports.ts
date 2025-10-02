import { Router } from 'express';
import { ReportsService } from '../services/ReportsService';
import { logger } from '../utils/logger';
import { handleAsyncRoute } from '../utils/asyncHandler';

const router = Router();
const reportsService = new ReportsService();

/**
 * Reports API routes
 * Handles compliance reports, generation, and viewing
 */

// Get list of reports
router.get('/', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { 
    reportType,
    startDate,
    endDate,
    limit = 20,
    offset = 0,
    status
  } = req.query;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching reports list', { 
    tenantId, 
    reportType, 
    startDate, 
    endDate, 
    limit, 
    offset,
    status
  });

  const reports = await reportsService.getReports(tenantId, {
    reportType: reportType as string,
    startDate: startDate as string,
    endDate: endDate as string,
    limit: Number(limit),
    offset: Number(offset),
    status: status as string
  });
  
  res.json({
    success: true,
    data: reports
  });
}));

// Get specific report
router.get('/:reportId', handleAsyncRoute(async (req, res) => {
  const { reportId } = req.params;
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching report', { reportId, tenantId });

  const report = await reportsService.getReport(reportId, tenantId);
  
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  res.json({
    success: true,
    data: report
  });
}));

// Generate new report
router.post('/generate', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  const {
    reportType,
    title,
    description,
    filters,
    format = 'html',
    includeCharts = true,
    includeRecommendations = true
  } = req.body;
  
  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Authentication required' });
  }

  if (!reportType) {
    return res.status(400).json({ error: 'Report type required' });
  }

  logger.info('Generating new report', { 
    tenantId, 
    userId, 
    reportType, 
    title,
    format
  });

  const report = await reportsService.generateReport({
    tenantId,
    userId,
    reportType,
    title,
    description,
    filters,
    format,
    includeCharts,
    includeRecommendations
  });
  
  res.json({
    success: true,
    data: report
  });
}));

// Get report content/download
router.get('/:reportId/download', handleAsyncRoute(async (req, res) => {
  const { reportId } = req.params;
  const tenantId = req.user?.tenantId;
  const { format } = req.query;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Downloading report', { reportId, tenantId, format });

  const reportContent = await reportsService.downloadReport(
    reportId, 
    tenantId, 
    format as string
  );
  
  if (!reportContent) {
    return res.status(404).json({ error: 'Report not found or not ready' });
  }

  // Set appropriate headers for download
  res.setHeader('Content-Type', reportContent.contentType);
  res.setHeader(
    'Content-Disposition', 
    `attachment; filename="${reportContent.filename}"`
  );
  
  res.send(reportContent.content);
}));

// Get report preview
router.get('/:reportId/preview', handleAsyncRoute(async (req, res) => {
  const { reportId } = req.params;
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Previewing report', { reportId, tenantId });

  const preview = await reportsService.getReportPreview(reportId, tenantId);
  
  if (!preview) {
    return res.status(404).json({ error: 'Report not found' });
  }

  res.json({
    success: true,
    data: preview
  });
}));

// Delete report
router.delete('/:reportId', handleAsyncRoute(async (req, res) => {
  const { reportId } = req.params;
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Deleting report', { reportId, tenantId });

  await reportsService.deleteReport(reportId, tenantId);
  
  res.json({
    success: true,
    message: 'Report deleted successfully'
  });
}));

// Get report types and templates
router.get('/templates/available', handleAsyncRoute(async (req, res) => {
  logger.info('Fetching available report templates');

  const templates = await reportsService.getAvailableTemplates();
  
  res.json({
    success: true,
    data: templates
  });
}));

// Share report (generate shareable link)
router.post('/:reportId/share', handleAsyncRoute(async (req, res) => {
  const { reportId } = req.params;
  const tenantId = req.user?.tenantId;
  const { expirationHours = 24, password } = req.body;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Sharing report', { reportId, tenantId, expirationHours });

  const shareLink = await reportsService.createShareLink(
    reportId, 
    tenantId, 
    expirationHours,
    password
  );
  
  res.json({
    success: true,
    data: shareLink
  });
}));

export { router as reportsRoutes };
