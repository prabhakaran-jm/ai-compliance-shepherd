import { Router } from 'express';
import { SlackService } from '../services/SlackService';
import { logger } from '../utils/logger';
import { handleAsyncRoute } from '../utils/asyncHandler';

const router = Router();
const slackService = new SlackService();

/**
 * Slack Integration API routes
 * Handles Slack configuration and notifications
 */

// Get Slack configuration
router.get('/config', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching Slack configuration', { tenantId });

  const config = await slackService.getSlackConfiguration(tenantId);
  
  res.json({
    success: true,
    data: config
  });
}));

// Update Slack configuration
router.put('/config', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  const config = req.body;
  
  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Authentication required' });
  }

  logger.info('Updating Slack configuration', { tenantId, userId });

  const updatedConfig = await slackService.updateSlackConfiguration(
    tenantId, 
    config, 
    userId
  );
  
  res.json({
    success: true,
    data: updatedConfig
  });
}));

// Test Slack connection
router.post('/test-connection', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { botToken, channelId } = req.body;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  if (!botToken) {
    return res.status(400).json({ error: 'Bot token required' });
  }

  logger.info('Testing Slack connection', { tenantId, channelId });

  const testResult = await slackService.testConnection(
    tenantId, 
    botToken, 
    channelId
  );
  
  res.json({
    success: true,
    data: testResult
  });
}));

// Get Slack channels
router.get('/channels', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching Slack channels', { tenantId });

  const channels = await slackService.getSlackChannels(tenantId);
  
  res.json({
    success: true,
    data: channels
  });
}));

// Send test notification
router.post('/test-notification', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { channelId, messageType = 'test' } = req.body;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  if (!channelId) {
    return res.status(400).json({ error: 'Channel ID required' });
  }

  logger.info('Sending test notification', { tenantId, channelId, messageType });

  const result = await slackService.sendTestNotification(
    tenantId, 
    channelId, 
    messageType
  );
  
  res.json({
    success: true,
    data: result
  });
}));

// Get notification history
router.get('/notifications', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { 
    channelId,
    messageType,
    status,
    startDate,
    endDate,
    limit = 50,
    offset = 0
  } = req.query;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching notification history', { 
    tenantId, 
    channelId, 
    messageType, 
    status,
    startDate,
    endDate,
    limit, 
    offset 
  });

  const notifications = await slackService.getNotificationHistory(tenantId, {
    channelId: channelId as string,
    messageType: messageType as string,
    status: status as string,
    startDate: startDate as string,
    endDate: endDate as string,
    limit: Number(limit),
    offset: Number(offset)
  });
  
  res.json({
    success: true,
    data: notifications
  });
}));

// Get notification statistics
router.get('/statistics', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { timeRange = '30d' } = req.query;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  logger.info('Fetching notification statistics', { tenantId, timeRange });

  const statistics = await slackService.getNotificationStatistics(
    tenantId, 
    timeRange as string
  );
  
  res.json({
    success: true,
    data: statistics
  });
}));

// Disable Slack integration
router.post('/disable', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  
  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Authentication required' });
  }

  logger.info('Disabling Slack integration', { tenantId, userId });

  await slackService.disableSlackIntegration(tenantId, userId);
  
  res.json({
    success: true,
    message: 'Slack integration disabled successfully'
  });
}));

// Enable Slack integration
router.post('/enable', handleAsyncRoute(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  
  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Authentication required' });
  }

  logger.info('Enabling Slack integration', { tenantId, userId });

  await slackService.enableSlackIntegration(tenantId, userId);
  
  res.json({
    success: true,
    message: 'Slack integration enabled successfully'
  });
}));

export { router as slackRoutes };
