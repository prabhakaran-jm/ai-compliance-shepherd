import { Router } from 'express';
import { AuditPacksService } from '../services/AuditPacksService';
import { logger } from '../utils/logger';
import { handleAsyncRoute } from '../utils/asyncHandler';

const router = Router();
const auditPacksService = new AuditPacksService();

/**
 * Audit Packs API routes
 * Handles audit package generation and management
 */

// Get audit packs list
router.get('/', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { 
    status,
    framework,
    startDate,
    endDate,
    limit = 20,
    offset = 0
  } = req.query;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching audit packs', { 
    tenantId, 
    status, 
    framework, 
    startDate, 
    endDate, 
    limit, 
    offset 
  });

  const auditPacks = await auditPacksService.getAuditPacks(tenantId, {
    status: status as string,
    framework: framework as string,
    startDate: startDate as string,
    endDate: endDate as string,
    limit: Number(limit),
    offset: Number(offset)
  });
  
  res.json({
    success: true,
    data: auditPacks
  });
}));

// Get specific audit pack
router.get('/:auditPackId', handleAsyncRoute(async (req, res) => {
  const { auditPackId } = req.params;
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching audit pack', { auditPackId, tenantId });

  const auditPack = await auditPacksService.getAuditPack(auditPackId, tenantId);
  
  if (!auditPack) {
    return res.status(404).json({ error: 'Audit pack not found' });
  }

  res.json({
    success: true,
    data: auditPack
  });
}));

// Generate new audit pack
router.post('/generate', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  const {
    framework,
    title,
    description,
    dateRange,
    includeRemediation = true,
    includeEvidence = true,
    exportFormats = ['pdf', 'html'],
    priority = 'normal'
  } = req.body;
  
  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Authentication required' });
  }

  if (!framework) {
    return res.status(400).json({ error: 'Compliance framework required' });
  }

  logger.info('Generating audit pack', { 
    tenantId, 
    userId, 
    framework, 
    title,
    dateRange,
    exportFormats,
    priority
  });

  const auditPack = await auditPacksService.generateAuditPack({
    tenantId,
    userId,
    framework,
    title,
    description,
    dateRange,
    includeRemediation,
    includeEvidence,
    exportFormats,
    priority
  });
  
  res.json({
    success: true,
    data: auditPack
  });
}));

// Download audit pack
router.get('/:auditPackId/download', handleAsyncRoute(async (req, res) => {
  const { auditPackId } = req.params;
  const tenantId = req.user?.tenantId;
  const { format = 'zip' } = req.query;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Downloading audit pack', { auditPackId, tenantId, format });

  const downloadData = await auditPacksService.downloadAuditPack(
    auditPackId, 
    tenantId, 
    format as string
  );
  
  if (!downloadData) {
    return res.status(404).json({ error: 'Audit pack not found or not ready' });
  }

  // Set appropriate headers for download
  res.setHeader('Content-Type', downloadData.contentType);
  res.setHeader(
    'Content-Disposition', 
    `attachment; filename="${downloadData.filename}"`
  );
  
  res.send(downloadData.content);
}));

// Get audit pack status
router.get('/:auditPackId/status', handleAsyncRoute(async (req, res) => {
  const { auditPackId } = req.params;
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching audit pack status', { auditPackId, tenantId });

  const status = await auditPacksService.getAuditPackStatus(auditPackId, tenantId);
  
  if (!status) {
    return res.status(404).json({ error: 'Audit pack not found' });
  }

  res.json({
    success: true,
    data: status
  });
}));

// Cancel audit pack generation
router.post('/:auditPackId/cancel', handleAsyncRoute(async (req, res) => {
  const { auditPackId } = req.params;
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Cancelling audit pack generation', { auditPackId, tenantId });

  await auditPacksService.cancelAuditPack(auditPackId, tenantId);
  
  res.json({
    success: true,
    message: 'Audit pack generation cancelled'
  });
}));

// Delete audit pack
router.delete('/:auditPackId', handleAsyncRoute(async (req, res) => {
  const { auditPackId } = req.params;
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Deleting audit pack', { auditPackId, tenantId });

  await auditPacksService.deleteAuditPack(auditPackId, tenantId);
  
  res.json({
    success: true,
    message: 'Audit pack deleted successfully'
  });
}));

// Get available compliance frameworks
router.get('/frameworks/available', handleAsyncRoute(async (req, res) => {
  logger.info('Fetching available compliance frameworks');

  const frameworks = await auditPacksService.getAvailableFrameworks();
  
  res.json({
    success: true,
    data: frameworks
  });
}));

// Share audit pack (generate shareable link)
router.post('/:auditPackId/share', handleAsyncRoute(async (req, res) => {
  const { auditPackId } = req.params;
  const tenantId = req.user?.tenantId;
  const { expirationHours = 24, password, allowedEmails = [] } = req.body;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Sharing audit pack', { 
    auditPackId, 
    tenantId, 
    expirationHours,
    allowedEmailsCount: allowedEmails.length
  });

  const shareLink = await auditPacksService.createShareLink(
    auditPackId, 
    tenantId, 
    expirationHours,
    password,
    allowedEmails
  );
  
  res.json({
    success: true,
    data: shareLink
  });
}));

export { router as auditPacksRoutes };
