import axios from 'axios';
import { logger } from '../utils/logger';

interface NotificationFilters {
  channelId?: string;
  messageType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Slack Service
 * Handles Slack configuration and notifications
 */
export class SlackService {
  private readonly slackNotificationsUrl: string;

  constructor() {
    this.slackNotificationsUrl = process.env.SLACK_NOTIFICATIONS_URL || 'http://localhost:8089';
  }

  /**
   * Get Slack configuration
   */
  async getSlackConfiguration(tenantId: string) {
    try {
      logger.info('Fetching Slack configuration', { tenantId });

      const response = await axios.get(
        `${this.slackNotificationsUrl}/api/slack/config`,
        {
          params: { tenantId },
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching Slack configuration', { 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Update Slack configuration
   */
  async updateSlackConfiguration(tenantId: string, config: any, userId: string) {
    try {
      logger.info('Updating Slack configuration', { tenantId, userId });

      const response = await axios.put(
        `${this.slackNotificationsUrl}/api/slack/config`,
        {
          tenantId,
          config,
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
      logger.error('Error updating Slack configuration', { 
        tenantId, 
        userId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Test Slack connection
   */
  async testConnection(tenantId: string, botToken: string, channelId?: string) {
    try {
      logger.info('Testing Slack connection', { tenantId, channelId });

      const response = await axios.post(
        `${this.slackNotificationsUrl}/api/slack/test-connection`,
        {
          tenantId,
          botToken,
          channelId
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
      logger.error('Error testing Slack connection', { 
        tenantId, 
        channelId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get Slack channels
   */
  async getSlackChannels(tenantId: string) {
    try {
      logger.info('Fetching Slack channels', { tenantId });

      const response = await axios.get(
        `${this.slackNotificationsUrl}/api/slack/channels`,
        {
          params: { tenantId },
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching Slack channels', { 
        tenantId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification(tenantId: string, channelId: string, messageType: string) {
    try {
      logger.info('Sending test notification', { tenantId, channelId, messageType });

      const response = await axios.post(
        `${this.slackNotificationsUrl}/api/slack/test-notification`,
        {
          tenantId,
          channelId,
          messageType
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
      logger.error('Error sending test notification', { 
        tenantId, 
        channelId, 
        messageType,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get notification history
   */
  async getNotificationHistory(tenantId: string, filters: NotificationFilters) {
    try {
      logger.info('Fetching notification history', { tenantId, filters });

      const response = await axios.get(
        `${this.slackNotificationsUrl}/api/slack/notifications`,
        {
          params: {
            tenantId,
            ...filters
          },
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching notification history', { 
        tenantId, 
        filters,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStatistics(tenantId: string, timeRange: string) {
    try {
      logger.info('Fetching notification statistics', { tenantId, timeRange });

      const response = await axios.get(
        `${this.slackNotificationsUrl}/api/slack/statistics`,
        {
          params: { 
            tenantId,
            timeRange
          },
          timeout: 30000
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching notification statistics', { 
        tenantId, 
        timeRange,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Disable Slack integration
   */
  async disableSlackIntegration(tenantId: string, userId: string) {
    try {
      logger.info('Disabling Slack integration', { tenantId, userId });

      await axios.post(
        `${this.slackNotificationsUrl}/api/slack/disable`,
        {
          tenantId,
          userId
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Slack integration disabled', { tenantId, userId });
    } catch (error) {
      logger.error('Error disabling Slack integration', { 
        tenantId, 
        userId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Enable Slack integration
   */
  async enableSlackIntegration(tenantId: string, userId: string) {
    try {
      logger.info('Enabling Slack integration', { tenantId, userId });

      await axios.post(
        `${this.slackNotificationsUrl}/api/slack/enable`,
        {
          tenantId,
          userId
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Slack integration enabled', { tenantId, userId });
    } catch (error) {
      logger.error('Error enabling Slack integration', { 
        tenantId, 
        userId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }
}
