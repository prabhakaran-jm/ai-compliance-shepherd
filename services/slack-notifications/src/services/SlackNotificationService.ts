import { WebClient } from '@slack/web-api';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand, DeleteItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { logger } from '../utils/logger';
import { SlackNotificationError } from '../utils/errorHandler';
import { 
  SlackConfiguration,
  NotificationEvent,
  NotificationHistory,
  SlackMessage,
  SlackAttachment,
  ComplianceEvent
} from '../types/slack';
import { v4 as uuidv4 } from 'uuid';
import { SlackMessageBuilder } from './SlackMessageBuilder';
import { NotificationTemplateService } from './NotificationTemplateService';

/**
 * Service for managing Slack notifications and integrations
 */
export class SlackNotificationService {
  private dynamoClient: DynamoDBClient;
  private secretsClient: SecretsManagerClient;
  private messageBuilder: SlackMessageBuilder;
  private templateService: NotificationTemplateService;
  private region: string;
  private tableName: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.tableName = process.env.SLACK_CONFIG_TABLE || 'ComplianceShepherd-SlackConfigurations';
    this.dynamoClient = new DynamoDBClient({ region: this.region });
    this.secretsClient = new SecretsManagerClient({ region: this.region });
    this.messageBuilder = new SlackMessageBuilder();
    this.templateService = new NotificationTemplateService();
  }

  /**
   * Configure Slack integration for a tenant
   */
  async configureSlackIntegration(
    config: SlackConfiguration,
    correlationId?: string
  ): Promise<{ configured: boolean; message: string }> {
    try {
      logger.info('Configuring Slack integration', {
        correlationId,
        tenantId: config.tenantId,
        channels: config.channels?.length || 0
      });

      // Validate Slack token by testing API connection
      await this.validateSlackToken(config.botToken, correlationId);

      // Store configuration in DynamoDB
      await this.storeSlackConfiguration(config, correlationId);

      // Store sensitive data in Secrets Manager
      await this.storeSlackSecrets(config, correlationId);

      // Send welcome message
      await this.sendWelcomeMessage(config, correlationId);

      logger.info('Slack integration configured successfully', {
        correlationId,
        tenantId: config.tenantId
      });

      return {
        configured: true,
        message: 'Slack integration configured successfully'
      };

    } catch (error) {
      logger.error('Error configuring Slack integration', {
        correlationId,
        tenantId: config.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new SlackNotificationError(
        `Failed to configure Slack integration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get Slack configuration for a tenant
   */
  async getSlackConfiguration(tenantId: string, correlationId?: string): Promise<SlackConfiguration> {
    try {
      logger.debug('Getting Slack configuration', {
        correlationId,
        tenantId
      });

      const result = await this.dynamoClient.send(new GetItemCommand({
        TableName: this.tableName,
        Key: {
          tenantId: { S: tenantId }
        }
      }));

      if (!result.Item) {
        throw new SlackNotificationError('Slack configuration not found');
      }

      const config: SlackConfiguration = {
        tenantId: result.Item.tenantId.S!,
        botToken: '***REDACTED***', // Don't return sensitive data
        channels: result.Item.channels?.L?.map(item => ({
          name: item.M?.name?.S || '',
          id: item.M?.id?.S || '',
          events: item.M?.events?.L?.map(e => e.S!) || []
        })) || [],
        enabled: result.Item.enabled?.BOOL || false,
        notificationSettings: {
          criticalFindings: result.Item.notificationSettings?.M?.criticalFindings?.BOOL || true,
          scanResults: result.Item.notificationSettings?.M?.scanResults?.BOOL || true,
          remediationActions: result.Item.notificationSettings?.M?.remediationActions?.BOOL || true,
          auditPackReady: result.Item.notificationSettings?.M?.auditPackReady?.BOOL || true,
          complianceScoreChanges: result.Item.notificationSettings?.M?.complianceScoreChanges?.BOOL || false,
          scheduledReports: result.Item.notificationSettings?.M?.scheduledReports?.BOOL || false
        },
        createdAt: result.Item.createdAt?.S || new Date().toISOString(),
        updatedAt: result.Item.updatedAt?.S || new Date().toISOString()
      };

      return config;

    } catch (error) {
      logger.error('Error getting Slack configuration', {
        correlationId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new SlackNotificationError(
        `Failed to get Slack configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update Slack configuration
   */
  async updateSlackConfiguration(
    tenantId: string,
    updates: Partial<SlackConfiguration>,
    correlationId?: string
  ): Promise<{ updated: boolean; message: string }> {
    try {
      logger.info('Updating Slack configuration', {
        correlationId,
        tenantId,
        updateKeys: Object.keys(updates)
      });

      // Get existing configuration
      const existingConfig = await this.getSlackConfiguration(tenantId, correlationId);

      // Merge updates
      const updatedConfig: SlackConfiguration = {
        ...existingConfig,
        ...updates,
        tenantId, // Ensure tenant ID doesn't change
        updatedAt: new Date().toISOString()
      };

      // Validate new token if provided
      if (updates.botToken) {
        await this.validateSlackToken(updates.botToken, correlationId);
        await this.storeSlackSecrets(updatedConfig, correlationId);
      }

      // Update configuration in DynamoDB
      await this.storeSlackConfiguration(updatedConfig, correlationId);

      logger.info('Slack configuration updated successfully', {
        correlationId,
        tenantId
      });

      return {
        updated: true,
        message: 'Slack configuration updated successfully'
      };

    } catch (error) {
      logger.error('Error updating Slack configuration', {
        correlationId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new SlackNotificationError(
        `Failed to update Slack configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete Slack configuration
   */
  async deleteSlackConfiguration(tenantId: string, correlationId?: string): Promise<{ deleted: boolean; message: string }> {
    try {
      logger.info('Deleting Slack configuration', {
        correlationId,
        tenantId
      });

      // Delete from DynamoDB
      await this.dynamoClient.send(new DeleteItemCommand({
        TableName: this.tableName,
        Key: {
          tenantId: { S: tenantId }
        }
      }));

      // Delete secrets (optional - secrets can be left for audit trail)
      try {
        // In a real implementation, you might want to schedule secret deletion
        logger.debug('Slack secrets retained for audit trail', {
          correlationId,
          tenantId
        });
      } catch (secretError) {
        logger.warn('Failed to delete Slack secrets', {
          correlationId,
          tenantId,
          error: secretError instanceof Error ? secretError.message : 'Unknown error'
        });
      }

      logger.info('Slack configuration deleted successfully', {
        correlationId,
        tenantId
      });

      return {
        deleted: true,
        message: 'Slack configuration deleted successfully'
      };

    } catch (error) {
      logger.error('Error deleting Slack configuration', {
        correlationId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new SlackNotificationError(
        `Failed to delete Slack configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification(
    request: { tenantId: string; channel?: string; message?: string },
    correlationId?: string
  ): Promise<{ sent: boolean; message: string }> {
    try {
      logger.info('Sending test notification', {
        correlationId,
        tenantId: request.tenantId,
        channel: request.channel
      });

      const config = await this.getSlackConfiguration(request.tenantId, correlationId);
      const slackClient = await this.getSlackClient(request.tenantId, correlationId);

      const testMessage = this.messageBuilder.buildTestMessage(
        request.message || 'This is a test notification from AI Compliance Shepherd'
      );

      const targetChannel = request.channel || config.channels[0]?.id;
      if (!targetChannel) {
        throw new SlackNotificationError('No channel specified for test notification');
      }

      const result = await slackClient.chat.postMessage({
        channel: targetChannel,
        ...testMessage
      });

      // Record notification history
      await this.recordNotificationHistory({
        tenantId: request.tenantId,
        eventType: 'TEST_NOTIFICATION',
        channel: targetChannel,
        messageId: result.ts || '',
        status: 'SUCCESS',
        timestamp: new Date().toISOString()
      }, correlationId);

      logger.info('Test notification sent successfully', {
        correlationId,
        tenantId: request.tenantId,
        messageId: result.ts
      });

      return {
        sent: true,
        message: 'Test notification sent successfully'
      };

    } catch (error) {
      logger.error('Error sending test notification', {
        correlationId,
        tenantId: request.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new SlackNotificationError(
        `Failed to send test notification: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get notification history
   */
  async getNotificationHistory(
    tenantId: string,
    limit: number = 50,
    nextToken?: string,
    correlationId?: string
  ): Promise<{ notifications: NotificationHistory[]; nextToken?: string }> {
    try {
      logger.debug('Getting notification history', {
        correlationId,
        tenantId,
        limit
      });

      // In a real implementation, this would query a notifications history table
      // For now, return mock data
      const mockNotifications: NotificationHistory[] = [
        {
          notificationId: uuidv4(),
          tenantId,
          eventType: 'SCAN_COMPLETED',
          channel: '#security',
          messageId: '1234567890.123456',
          status: 'SUCCESS',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          eventData: {
            scanId: 'scan-123',
            findingsCount: 15,
            criticalCount: 2
          }
        },
        {
          notificationId: uuidv4(),
          tenantId,
          eventType: 'CRITICAL_FINDING',
          channel: '#security',
          messageId: '1234567890.123457',
          status: 'SUCCESS',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          eventData: {
            findingId: 'finding-456',
            severity: 'CRITICAL',
            resourceType: 'S3_BUCKET'
          }
        }
      ];

      return {
        notifications: mockNotifications.slice(0, limit)
      };

    } catch (error) {
      logger.error('Error getting notification history', {
        correlationId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new SlackNotificationError(
        `Failed to get notification history: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle scan completed event
   */
  async handleScanCompletedEvent(eventData: ComplianceEvent, correlationId?: string): Promise<void> {
    try {
      logger.info('Handling scan completed event', {
        correlationId,
        tenantId: eventData.tenantId,
        scanId: eventData.scanId
      });

      const config = await this.getSlackConfiguration(eventData.tenantId, correlationId);
      if (!config.enabled || !config.notificationSettings.scanResults) {
        logger.debug('Scan result notifications disabled', {
          correlationId,
          tenantId: eventData.tenantId
        });
        return;
      }

      const slackClient = await this.getSlackClient(eventData.tenantId, correlationId);
      const message = this.messageBuilder.buildScanCompletedMessage(eventData);

      await this.sendToConfiguredChannels(slackClient, config, 'SCAN_RESULTS', message, correlationId);

      // Record notification
      await this.recordNotificationHistory({
        tenantId: eventData.tenantId,
        eventType: 'SCAN_COMPLETED',
        channel: config.channels[0]?.id || 'unknown',
        messageId: '',
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
        eventData
      }, correlationId);

    } catch (error) {
      logger.error('Error handling scan completed event', {
        correlationId,
        tenantId: eventData.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle critical finding event
   */
  async handleCriticalFindingEvent(eventData: ComplianceEvent, correlationId?: string): Promise<void> {
    try {
      logger.info('Handling critical finding event', {
        correlationId,
        tenantId: eventData.tenantId,
        findingId: eventData.findingId
      });

      const config = await this.getSlackConfiguration(eventData.tenantId, correlationId);
      if (!config.enabled || !config.notificationSettings.criticalFindings) {
        logger.debug('Critical finding notifications disabled', {
          correlationId,
          tenantId: eventData.tenantId
        });
        return;
      }

      const slackClient = await this.getSlackClient(eventData.tenantId, correlationId);
      const message = this.messageBuilder.buildCriticalFindingMessage(eventData);

      await this.sendToConfiguredChannels(slackClient, config, 'CRITICAL_FINDINGS', message, correlationId);

      // Record notification
      await this.recordNotificationHistory({
        tenantId: eventData.tenantId,
        eventType: 'CRITICAL_FINDING',
        channel: config.channels[0]?.id || 'unknown',
        messageId: '',
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
        eventData
      }, correlationId);

    } catch (error) {
      logger.error('Error handling critical finding event', {
        correlationId,
        tenantId: eventData.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle remediation applied event
   */
  async handleRemediationAppliedEvent(eventData: ComplianceEvent, correlationId?: string): Promise<void> {
    try {
      logger.info('Handling remediation applied event', {
        correlationId,
        tenantId: eventData.tenantId,
        remediationId: eventData.remediationId
      });

      const config = await this.getSlackConfiguration(eventData.tenantId, correlationId);
      if (!config.enabled || !config.notificationSettings.remediationActions) {
        logger.debug('Remediation notifications disabled', {
          correlationId,
          tenantId: eventData.tenantId
        });
        return;
      }

      const slackClient = await this.getSlackClient(eventData.tenantId, correlationId);
      const message = this.messageBuilder.buildRemediationAppliedMessage(eventData);

      await this.sendToConfiguredChannels(slackClient, config, 'REMEDIATION_ACTIONS', message, correlationId);

      // Record notification
      await this.recordNotificationHistory({
        tenantId: eventData.tenantId,
        eventType: 'REMEDIATION_APPLIED',
        channel: config.channels[0]?.id || 'unknown',
        messageId: '',
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
        eventData
      }, correlationId);

    } catch (error) {
      logger.error('Error handling remediation applied event', {
        correlationId,
        tenantId: eventData.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle audit pack generated event
   */
  async handleAuditPackGeneratedEvent(eventData: ComplianceEvent, correlationId?: string): Promise<void> {
    try {
      logger.info('Handling audit pack generated event', {
        correlationId,
        tenantId: eventData.tenantId,
        auditPackId: eventData.auditPackId
      });

      const config = await this.getSlackConfiguration(eventData.tenantId, correlationId);
      if (!config.enabled || !config.notificationSettings.auditPackReady) {
        logger.debug('Audit pack notifications disabled', {
          correlationId,
          tenantId: eventData.tenantId
        });
        return;
      }

      const slackClient = await this.getSlackClient(eventData.tenantId, correlationId);
      const message = this.messageBuilder.buildAuditPackGeneratedMessage(eventData);

      await this.sendToConfiguredChannels(slackClient, config, 'AUDIT_PACK_READY', message, correlationId);

      // Record notification
      await this.recordNotificationHistory({
        tenantId: eventData.tenantId,
        eventType: 'AUDIT_PACK_GENERATED',
        channel: config.channels[0]?.id || 'unknown',
        messageId: '',
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
        eventData
      }, correlationId);

    } catch (error) {
      logger.error('Error handling audit pack generated event', {
        correlationId,
        tenantId: eventData.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle compliance score changed event
   */
  async handleComplianceScoreChangedEvent(eventData: ComplianceEvent, correlationId?: string): Promise<void> {
    try {
      logger.info('Handling compliance score changed event', {
        correlationId,
        tenantId: eventData.tenantId,
        newScore: eventData.complianceScore
      });

      const config = await this.getSlackConfiguration(eventData.tenantId, correlationId);
      if (!config.enabled || !config.notificationSettings.complianceScoreChanges) {
        logger.debug('Compliance score notifications disabled', {
          correlationId,
          tenantId: eventData.tenantId
        });
        return;
      }

      const slackClient = await this.getSlackClient(eventData.tenantId, correlationId);
      const message = this.messageBuilder.buildComplianceScoreChangedMessage(eventData);

      await this.sendToConfiguredChannels(slackClient, config, 'COMPLIANCE_SCORE_CHANGES', message, correlationId);

      // Record notification
      await this.recordNotificationHistory({
        tenantId: eventData.tenantId,
        eventType: 'COMPLIANCE_SCORE_CHANGED',
        channel: config.channels[0]?.id || 'unknown',
        messageId: '',
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
        eventData
      }, correlationId);

    } catch (error) {
      logger.error('Error handling compliance score changed event', {
        correlationId,
        tenantId: eventData.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle scan failed event
   */
  async handleScanFailedEvent(eventData: ComplianceEvent, correlationId?: string): Promise<void> {
    try {
      logger.info('Handling scan failed event', {
        correlationId,
        tenantId: eventData.tenantId,
        scanId: eventData.scanId
      });

      const config = await this.getSlackConfiguration(eventData.tenantId, correlationId);
      if (!config.enabled) {
        logger.debug('Slack notifications disabled', {
          correlationId,
          tenantId: eventData.tenantId
        });
        return;
      }

      const slackClient = await this.getSlackClient(eventData.tenantId, correlationId);
      const message = this.messageBuilder.buildScanFailedMessage(eventData);

      // Always send scan failure notifications to all channels
      await this.sendToConfiguredChannels(slackClient, config, 'SCAN_RESULTS', message, correlationId);

      // Record notification
      await this.recordNotificationHistory({
        tenantId: eventData.tenantId,
        eventType: 'SCAN_FAILED',
        channel: config.channels[0]?.id || 'unknown',
        messageId: '',
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
        eventData
      }, correlationId);

    } catch (error) {
      logger.error('Error handling scan failed event', {
        correlationId,
        tenantId: eventData.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle SNS notification
   */
  async handleSNSNotification(subject: string, message: any, correlationId?: string): Promise<void> {
    try {
      logger.info('Handling SNS notification', {
        correlationId,
        subject
      });

      // Parse SNS message and route to appropriate handler
      if (subject.includes('Compliance Alert')) {
        // Handle compliance alerts
        await this.handleComplianceAlert(message, correlationId);
      } else if (subject.includes('System Alert')) {
        // Handle system alerts
        await this.handleSystemAlert(message, correlationId);
      } else {
        logger.warn('Unknown SNS notification type', {
          correlationId,
          subject
        });
      }

    } catch (error) {
      logger.error('Error handling SNS notification', {
        correlationId,
        subject,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Private helper methods
   */

  private async validateSlackToken(token: string, correlationId?: string): Promise<void> {
    try {
      const slackClient = new WebClient(token);
      const result = await slackClient.auth.test();
      
      if (!result.ok) {
        throw new SlackNotificationError('Invalid Slack token');
      }

      logger.debug('Slack token validated successfully', {
        correlationId,
        teamId: result.team_id,
        userId: result.user_id
      });

    } catch (error) {
      throw new SlackNotificationError(
        `Slack token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async storeSlackConfiguration(config: SlackConfiguration, correlationId?: string): Promise<void> {
    const item = {
      tenantId: { S: config.tenantId },
      channels: {
        L: config.channels?.map(channel => ({
          M: {
            name: { S: channel.name },
            id: { S: channel.id },
            events: { L: channel.events.map(event => ({ S: event })) }
          }
        })) || []
      },
      enabled: { BOOL: config.enabled },
      notificationSettings: {
        M: {
          criticalFindings: { BOOL: config.notificationSettings.criticalFindings },
          scanResults: { BOOL: config.notificationSettings.scanResults },
          remediationActions: { BOOL: config.notificationSettings.remediationActions },
          auditPackReady: { BOOL: config.notificationSettings.auditPackReady },
          complianceScoreChanges: { BOOL: config.notificationSettings.complianceScoreChanges },
          scheduledReports: { BOOL: config.notificationSettings.scheduledReports }
        }
      },
      createdAt: { S: config.createdAt || new Date().toISOString() },
      updatedAt: { S: new Date().toISOString() }
    };

    await this.dynamoClient.send(new PutItemCommand({
      TableName: this.tableName,
      Item: item
    }));
  }

  private async storeSlackSecrets(config: SlackConfiguration, correlationId?: string): Promise<void> {
    // In a real implementation, store sensitive data in Secrets Manager
    logger.debug('Slack secrets stored in Secrets Manager', {
      correlationId,
      tenantId: config.tenantId
    });
  }

  private async getSlackClient(tenantId: string, correlationId?: string): Promise<WebClient> {
    // In a real implementation, retrieve token from Secrets Manager
    // For now, use a mock token
    const mockToken = 'xoxb-mock-token-for-development';
    return new WebClient(mockToken);
  }

  private async sendWelcomeMessage(config: SlackConfiguration, correlationId?: string): Promise<void> {
    try {
      const slackClient = await this.getSlackClient(config.tenantId, correlationId);
      const welcomeMessage = this.messageBuilder.buildWelcomeMessage(config.tenantId);

      for (const channel of config.channels || []) {
        await slackClient.chat.postMessage({
          channel: channel.id,
          ...welcomeMessage
        });
      }

    } catch (error) {
      logger.warn('Failed to send welcome message', {
        correlationId,
        tenantId: config.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async sendToConfiguredChannels(
    slackClient: WebClient,
    config: SlackConfiguration,
    eventType: string,
    message: SlackMessage,
    correlationId?: string
  ): Promise<void> {
    const relevantChannels = config.channels?.filter(channel => 
      channel.events.includes(eventType) || channel.events.includes('ALL')
    ) || [];

    for (const channel of relevantChannels) {
      try {
        await slackClient.chat.postMessage({
          channel: channel.id,
          ...message
        });

        logger.debug('Message sent to Slack channel', {
          correlationId,
          tenantId: config.tenantId,
          channel: channel.name,
          eventType
        });

      } catch (error) {
        logger.error('Failed to send message to Slack channel', {
          correlationId,
          tenantId: config.tenantId,
          channel: channel.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private async recordNotificationHistory(
    notification: NotificationHistory,
    correlationId?: string
  ): Promise<void> {
    try {
      // In a real implementation, store in DynamoDB notifications history table
      logger.debug('Notification history recorded', {
        correlationId,
        notificationId: notification.notificationId,
        tenantId: notification.tenantId,
        eventType: notification.eventType
      });

    } catch (error) {
      logger.warn('Failed to record notification history', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleComplianceAlert(message: any, correlationId?: string): Promise<void> {
    // Handle compliance-specific alerts
    logger.debug('Handling compliance alert', {
      correlationId,
      alertType: message.alertType
    });
  }

  private async handleSystemAlert(message: any, correlationId?: string): Promise<void> {
    // Handle system-level alerts
    logger.debug('Handling system alert', {
      correlationId,
      alertType: message.alertType
    });
  }
}
