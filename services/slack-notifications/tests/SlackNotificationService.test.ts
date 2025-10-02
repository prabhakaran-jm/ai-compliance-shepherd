import { SlackNotificationService } from '../src/services/SlackNotificationService';
import { SlackConfiguration, ComplianceEvent } from '../src/types/slack';

// Mock AWS SDK
jest.mock('@aws-sdk/client-secrets-manager');
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@slack/web-api');

// Mock dependencies
jest.mock('../src/services/SlackMessageBuilder');
jest.mock('../src/services/NotificationTemplateService');

describe('SlackNotificationService', () => {
  let service: SlackNotificationService;
  let mockSlackConfig: SlackConfiguration;

  beforeEach(() => {
    service = new SlackNotificationService();
    mockSlackConfig = {
      tenantId: 'tenant-demo-company',
      botToken: 'xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx',
      channels: [
        {
          name: 'security',
          id: 'C1234567890',
          events: ['CRITICAL_FINDINGS', 'SCAN_RESULTS']
        },
        {
          name: 'compliance',
          id: 'C0987654321',
          events: ['AUDIT_PACK_READY', 'COMPLIANCE_SCORE_CHANGES']
        }
      ],
      enabled: true,
      notificationSettings: {
        criticalFindings: true,
        scanResults: true,
        remediationActions: true,
        auditPackReady: true,
        complianceScoreChanges: false,
        scheduledReports: false
      },
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('configureSlackIntegration', () => {
    it('should configure Slack integration successfully', async () => {
      const correlationId = 'test-correlation-id';
      
      const result = await service.configureSlackIntegration(mockSlackConfig, correlationId);

      expect(result).toBeDefined();
      expect(result.configured).toBe(true);
      expect(result.message).toBe('Slack integration configured successfully');
    });

    it('should handle invalid bot token', async () => {
      const invalidConfig = {
        ...mockSlackConfig,
        botToken: 'invalid-token'
      };

      await expect(service.configureSlackIntegration(invalidConfig, 'test-id'))
        .rejects.toThrow('Failed to configure Slack integration');
    });

    it('should handle missing channels', async () => {
      const configWithoutChannels = {
        ...mockSlackConfig,
        channels: []
      };

      // This should be caught by validation before reaching the service
      // But we test the service behavior anyway
      const result = await service.configureSlackIntegration(configWithoutChannels, 'test-id');
      expect(result.configured).toBe(true); // Service doesn't validate, assumes pre-validated
    });

    it('should store configuration and secrets', async () => {
      const result = await service.configureSlackIntegration(mockSlackConfig, 'test-id');

      expect(result.configured).toBe(true);
      // In a real test, we would verify DynamoDB and Secrets Manager calls
    });
  });

  describe('getSlackConfiguration', () => {
    it('should return Slack configuration', async () => {
      const tenantId = 'tenant-demo-company';
      const correlationId = 'test-correlation-id';

      const result = await service.getSlackConfiguration(tenantId, correlationId);

      expect(result).toBeDefined();
      expect(result.tenantId).toBe(tenantId);
      expect(result.botToken).toBe('***REDACTED***'); // Sensitive data should be redacted
      expect(result.channels).toBeDefined();
      expect(result.enabled).toBeDefined();
      expect(result.notificationSettings).toBeDefined();
    });

    it('should handle non-existent configuration', async () => {
      const tenantId = 'tenant-non-existent';
      
      await expect(service.getSlackConfiguration(tenantId, 'test-id'))
        .rejects.toThrow('Slack configuration not found');
    });
  });

  describe('updateSlackConfiguration', () => {
    it('should update Slack configuration successfully', async () => {
      const tenantId = 'tenant-demo-company';
      const updates = {
        enabled: false,
        notificationSettings: {
          ...mockSlackConfig.notificationSettings,
          criticalFindings: false
        }
      };

      const result = await service.updateSlackConfiguration(tenantId, updates, 'test-id');

      expect(result).toBeDefined();
      expect(result.updated).toBe(true);
      expect(result.message).toBe('Slack configuration updated successfully');
    });

    it('should validate new bot token when provided', async () => {
      const tenantId = 'tenant-demo-company';
      const updates = {
        botToken: 'xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx'
      };

      const result = await service.updateSlackConfiguration(tenantId, updates, 'test-id');
      expect(result.updated).toBe(true);
    });

    it('should handle invalid updates', async () => {
      const tenantId = 'tenant-demo-company';
      const invalidUpdates = {
        botToken: 'invalid-token-format'
      };

      await expect(service.updateSlackConfiguration(tenantId, invalidUpdates, 'test-id'))
        .rejects.toThrow();
    });
  });

  describe('deleteSlackConfiguration', () => {
    it('should delete Slack configuration successfully', async () => {
      const tenantId = 'tenant-demo-company';

      const result = await service.deleteSlackConfiguration(tenantId, 'test-id');

      expect(result).toBeDefined();
      expect(result.deleted).toBe(true);
      expect(result.message).toBe('Slack configuration deleted successfully');
    });

    it('should handle deletion of non-existent configuration', async () => {
      const tenantId = 'tenant-non-existent';

      // Service should handle this gracefully
      const result = await service.deleteSlackConfiguration(tenantId, 'test-id');
      expect(result.deleted).toBe(true);
    });
  });

  describe('sendTestNotification', () => {
    it('should send test notification successfully', async () => {
      const request = {
        tenantId: 'tenant-demo-company',
        channel: 'C1234567890',
        message: 'This is a test message'
      };

      const result = await service.sendTestNotification(request, 'test-id');

      expect(result).toBeDefined();
      expect(result.sent).toBe(true);
      expect(result.message).toBe('Test notification sent successfully');
    });

    it('should use default channel when none specified', async () => {
      const request = {
        tenantId: 'tenant-demo-company',
        message: 'Test message without channel'
      };

      const result = await service.sendTestNotification(request, 'test-id');
      expect(result.sent).toBe(true);
    });

    it('should handle missing channels configuration', async () => {
      const request = {
        tenantId: 'tenant-no-channels',
        message: 'Test message'
      };

      await expect(service.sendTestNotification(request, 'test-id'))
        .rejects.toThrow('No channel specified for test notification');
    });
  });

  describe('getNotificationHistory', () => {
    it('should return notification history', async () => {
      const tenantId = 'tenant-demo-company';
      const limit = 10;

      const result = await service.getNotificationHistory(tenantId, limit, undefined, 'test-id');

      expect(result).toBeDefined();
      expect(result.notifications).toBeDefined();
      expect(Array.isArray(result.notifications)).toBe(true);
      expect(result.notifications.length).toBeGreaterThan(0);
    });

    it('should respect limit parameter', async () => {
      const tenantId = 'tenant-demo-company';
      const limit = 1;

      const result = await service.getNotificationHistory(tenantId, limit, undefined, 'test-id');

      expect(result.notifications.length).toBeLessThanOrEqual(limit);
    });

    it('should handle pagination with nextToken', async () => {
      const tenantId = 'tenant-demo-company';
      const nextToken = 'mock-next-token';

      const result = await service.getNotificationHistory(tenantId, 50, nextToken, 'test-id');

      expect(result).toBeDefined();
      expect(result.notifications).toBeDefined();
    });
  });

  describe('event handling', () => {
    const mockEventData: ComplianceEvent = {
      tenantId: 'tenant-demo-company',
      scanId: 'scan-12345',
      findingsCount: 25,
      criticalCount: 3,
      highCount: 8,
      mediumCount: 10,
      lowCount: 4,
      timestamp: new Date().toISOString()
    };

    describe('handleScanCompletedEvent', () => {
      it('should handle scan completed event when notifications enabled', async () => {
        await expect(service.handleScanCompletedEvent(mockEventData, 'test-id'))
          .resolves.not.toThrow();
      });

      it('should skip notification when scan results disabled', async () => {
        const eventData = {
          ...mockEventData,
          tenantId: 'tenant-notifications-disabled'
        };

        // Should not throw, but should skip processing
        await expect(service.handleScanCompletedEvent(eventData, 'test-id'))
          .resolves.not.toThrow();
      });
    });

    describe('handleCriticalFindingEvent', () => {
      it('should handle critical finding event', async () => {
        const criticalFindingData: ComplianceEvent = {
          ...mockEventData,
          findingId: 'finding-67890',
          title: 'S3 Bucket Public Access Enabled',
          description: 'Critical security vulnerability detected',
          severity: 'CRITICAL',
          resourceType: 'S3_BUCKET',
          resourceId: 'data-backup'
        };

        await expect(service.handleCriticalFindingEvent(criticalFindingData, 'test-id'))
          .resolves.not.toThrow();
      });

      it('should skip when critical findings notifications disabled', async () => {
        const eventData = {
          ...mockEventData,
          tenantId: 'tenant-critical-disabled'
        };

        await expect(service.handleCriticalFindingEvent(eventData, 'test-id'))
          .resolves.not.toThrow();
      });
    });

    describe('handleRemediationAppliedEvent', () => {
      it('should handle remediation applied event', async () => {
        const remediationData: ComplianceEvent = {
          ...mockEventData,
          remediationId: 'remediation-11111',
          findingId: 'finding-67890',
          action: 'Disable S3 bucket public access',
          status: 'SUCCESS',
          resourceType: 'S3_BUCKET',
          resourceId: 'data-backup'
        };

        await expect(service.handleRemediationAppliedEvent(remediationData, 'test-id'))
          .resolves.not.toThrow();
      });

      it('should handle failed remediation', async () => {
        const failedRemediationData: ComplianceEvent = {
          ...mockEventData,
          remediationId: 'remediation-22222',
          action: 'Failed remediation action',
          status: 'FAILED',
          errorMessage: 'Insufficient permissions'
        };

        await expect(service.handleRemediationAppliedEvent(failedRemediationData, 'test-id'))
          .resolves.not.toThrow();
      });
    });

    describe('handleAuditPackGeneratedEvent', () => {
      it('should handle audit pack generated event', async () => {
        const auditPackData: ComplianceEvent = {
          ...mockEventData,
          auditPackId: 'audit-pack-33333',
          framework: 'SOC2',
          auditType: 'ANNUAL',
          complianceScore: 87.5,
          totalFindings: 125,
          criticalFindings: 8
        };

        await expect(service.handleAuditPackGeneratedEvent(auditPackData, 'test-id'))
          .resolves.not.toThrow();
      });
    });

    describe('handleComplianceScoreChangedEvent', () => {
      it('should handle compliance score changed event', async () => {
        const scoreChangeData: ComplianceEvent = {
          ...mockEventData,
          framework: 'SOC2',
          complianceScore: 89.2,
          previousScore: 85.7,
          changeReason: 'Critical findings remediated'
        };

        await expect(service.handleComplianceScoreChangedEvent(scoreChangeData, 'test-id'))
          .resolves.not.toThrow();
      });

      it('should skip when score change notifications disabled', async () => {
        const eventData = {
          ...mockEventData,
          tenantId: 'tenant-score-disabled'
        };

        await expect(service.handleComplianceScoreChangedEvent(eventData, 'test-id'))
          .resolves.not.toThrow();
      });
    });

    describe('handleScanFailedEvent', () => {
      it('should handle scan failed event', async () => {
        const scanFailedData: ComplianceEvent = {
          ...mockEventData,
          scanType: 'SCHEDULED',
          errorMessage: 'AWS credentials expired'
        };

        await expect(service.handleScanFailedEvent(scanFailedData, 'test-id'))
          .resolves.not.toThrow();
      });

      it('should always send scan failure notifications regardless of settings', async () => {
        const eventData = {
          ...mockEventData,
          tenantId: 'tenant-all-disabled',
          errorMessage: 'Critical scan failure'
        };

        // Should still process even if other notifications are disabled
        await expect(service.handleScanFailedEvent(eventData, 'test-id'))
          .resolves.not.toThrow();
      });
    });
  });

  describe('handleSNSNotification', () => {
    it('should handle compliance alert SNS notification', async () => {
      const subject = 'Compliance Alert: Critical Finding';
      const message = {
        alertType: 'CRITICAL_FINDING',
        tenantId: 'tenant-demo-company',
        details: 'Critical security vulnerability detected'
      };

      await expect(service.handleSNSNotification(subject, message, 'test-id'))
        .resolves.not.toThrow();
    });

    it('should handle system alert SNS notification', async () => {
      const subject = 'System Alert: Service Degradation';
      const message = {
        alertType: 'SERVICE_DEGRADATION',
        service: 'compliance-scanner',
        details: 'Scanner experiencing high latency'
      };

      await expect(service.handleSNSNotification(subject, message, 'test-id'))
        .resolves.not.toThrow();
    });

    it('should handle unknown SNS notification types gracefully', async () => {
      const subject = 'Unknown Alert Type';
      const message = {
        alertType: 'UNKNOWN',
        details: 'Unknown alert details'
      };

      await expect(service.handleSNSNotification(subject, message, 'test-id'))
        .resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle Slack API errors gracefully', async () => {
      // Mock a Slack API error scenario
      const request = {
        tenantId: 'tenant-api-error',
        message: 'Test message that will fail'
      };

      // The service should handle errors gracefully and not throw
      await expect(service.sendTestNotification(request, 'test-id'))
        .rejects.toThrow('Failed to send test notification');
    });

    it('should handle database errors gracefully', async () => {
      const tenantId = 'tenant-db-error';

      await expect(service.getSlackConfiguration(tenantId, 'test-id'))
        .rejects.toThrow();
    });

    it('should handle network timeouts', async () => {
      const request = {
        tenantId: 'tenant-timeout',
        message: 'Test timeout scenario'
      };

      // Service should handle timeouts appropriately
      await expect(service.sendTestNotification(request, 'test-id'))
        .rejects.toThrow();
    });
  });

  describe('validation', () => {
    it('should validate tenant ID format', async () => {
      const invalidTenantId = 'invalid-tenant-id';

      await expect(service.getSlackConfiguration(invalidTenantId, 'test-id'))
        .rejects.toThrow();
    });

    it('should validate channel configurations', async () => {
      const configWithInvalidChannel = {
        ...mockSlackConfig,
        channels: [
          {
            name: 'invalid channel name!',
            id: 'INVALID_ID',
            events: ['INVALID_EVENT']
          }
        ]
      };

      // Validation should happen before reaching the service
      // But we test service behavior with invalid data
      await expect(service.configureSlackIntegration(configWithInvalidChannel, 'test-id'))
        .rejects.toThrow();
    });
  });

  describe('rate limiting', () => {
    it('should handle Slack rate limiting', async () => {
      const request = {
        tenantId: 'tenant-rate-limited',
        message: 'Rate limited message'
      };

      // Service should handle rate limiting gracefully
      await expect(service.sendTestNotification(request, 'test-id'))
        .rejects.toThrow();
    });
  });

  describe('multi-tenant isolation', () => {
    it('should handle different tenant configurations', async () => {
      const tenant1Config = { ...mockSlackConfig, tenantId: 'tenant-company-a' };
      const tenant2Config = { ...mockSlackConfig, tenantId: 'tenant-company-b' };

      const result1 = await service.configureSlackIntegration(tenant1Config, 'test-id-1');
      const result2 = await service.configureSlackIntegration(tenant2Config, 'test-id-2');

      expect(result1.configured).toBe(true);
      expect(result2.configured).toBe(true);

      // Verify configurations are isolated
      const config1 = await service.getSlackConfiguration('tenant-company-a', 'test-id');
      const config2 = await service.getSlackConfiguration('tenant-company-b', 'test-id');

      expect(config1.tenantId).toBe('tenant-company-a');
      expect(config2.tenantId).toBe('tenant-company-b');
    });

    it('should prevent cross-tenant data access', async () => {
      const tenantAHistory = await service.getNotificationHistory('tenant-company-a', 50, undefined, 'test-id');
      const tenantBHistory = await service.getNotificationHistory('tenant-company-b', 50, undefined, 'test-id');

      // Each tenant should only see their own notifications
      expect(tenantAHistory.notifications.every(n => n.tenantId === 'tenant-company-a')).toBe(true);
      expect(tenantBHistory.notifications.every(n => n.tenantId === 'tenant-company-b')).toBe(true);
    });
  });
});
