import { EventProcessorService } from '../src/services/EventProcessorService';
import { EventProcessorRequest } from '../src/types/event';
import { EventBridgeSchedulerError } from '../src/utils/errorHandler';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-eventbridge');
jest.mock('@aws-sdk/client-sfn');
jest.mock('@aws-sdk/client-lambda');
jest.mock('@aws-sdk/client-sns');
jest.mock('@aws-sdk/client-sts');

const mockEventBridgeClient = {
  send: jest.fn()
};

const mockSFNClient = {
  send: jest.fn()
};

const mockLambdaClient = {
  send: jest.fn()
};

const mockSNSClient = {
  send: jest.fn()
};

const mockSTSClient = {
  send: jest.fn()
};

// Mock the clients
jest.doMock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: jest.fn(() => mockEventBridgeClient),
  PutEventsCommand: jest.fn()
}));

jest.doMock('@aws-sdk/client-sfn', () => ({
  SFNClient: jest.fn(() => mockSFNClient),
  StartExecutionCommand: jest.fn()
}));

jest.doMock('@aws-sdk/client-lambda', () => ({
  LambdaClient: jest.fn(() => mockLambdaClient),
  InvokeCommand: jest.fn()
}));

jest.doMock('@aws-sdk/client-sns', () => ({
  SNSClient: jest.fn(() => mockSNSClient),
  PublishCommand: jest.fn()
}));

jest.doMock('@aws-sdk/client-sts', () => ({
  STSClient: jest.fn(() => mockSTSClient),
  GetCallerIdentityCommand: jest.fn()
}));

describe('EventProcessorService', () => {
  let service: EventProcessorService;
  const correlationId = 'test-correlation-id';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EventProcessorService();
    
    // Mock STS response
    mockSTSClient.send.mockResolvedValue({
      Account: '123456789012'
    });
  });

  describe('processEvent', () => {
    it('should process scheduled events', async () => {
      const scheduledEvent = {
        source: 'aws.scheduler',
        'detail-type': 'Scheduled Event',
        detail: {
          tenantId: 'test-tenant',
          workflowType: 'compliance-scan',
          parameters: {
            scanType: 'comprehensive'
          }
        },
        time: '2023-01-01T00:00:00Z'
      };

      mockSFNClient.send.mockResolvedValue({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:test-execution'
      });

      await service.processEvent(scheduledEvent, correlationId);

      expect(mockSFNClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            stateMachineArn: expect.stringContaining('ComplianceScanWorkflow'),
            input: expect.stringContaining('test-tenant')
          })
        })
      );
    });

    it('should process S3 events', async () => {
      const s3Event = {
        source: 'aws.s3',
        'detail-type': 'S3 Bucket Created',
        detail: {
          bucket: {
            name: 'test-bucket'
          }
        },
        time: '2023-01-01T00:00:00Z'
      };

      mockLambdaClient.send.mockResolvedValue({});

      await service.processEvent(s3Event, correlationId);

      expect(mockLambdaClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            FunctionName: 'scan-environment',
            InvocationType: 'Event',
            Payload: expect.stringContaining('s3-bucket-check')
          })
        })
      );
    });

    it('should process IAM events', async () => {
      const iamEvent = {
        source: 'aws.iam',
        'detail-type': 'IAM User Created',
        detail: {
          resourceArn: 'arn:aws:iam::123456789012:user/test-user'
        },
        time: '2023-01-01T00:00:00Z'
      };

      mockLambdaClient.send.mockResolvedValue({});

      await service.processEvent(iamEvent, correlationId);

      expect(mockLambdaClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            FunctionName: 'scan-environment',
            Payload: expect.stringContaining('iam-compliance-check')
          })
        })
      );
    });

    it('should process EC2 events', async () => {
      const ec2Event = {
        source: 'aws.ec2',
        'detail-type': 'EC2 Instance State-change Notification',
        detail: {
          state: 'running',
          'instance-id': 'i-1234567890abcdef0'
        },
        time: '2023-01-01T00:00:00Z'
      };

      mockLambdaClient.send.mockResolvedValue({});

      await service.processEvent(ec2Event, correlationId);

      expect(mockLambdaClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Payload: expect.stringContaining('ec2-security-check')
          })
        })
      );
    });

    it('should process custom compliance events', async () => {
      const complianceEvent = {
        source: 'compliance.shepherd',
        'detail-type': 'manual-scan',
        detail: {
          tenantId: 'test-tenant',
          parameters: {
            scanType: 'quick'
          }
        },
        time: '2023-01-01T00:00:00Z'
      };

      mockSFNClient.send.mockResolvedValue({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:test-execution'
      });

      await service.processEvent(complianceEvent, correlationId);

      expect(mockSFNClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            input: expect.stringContaining('compliance-scan')
          })
        })
      );
    });

    it('should handle compliance violations', async () => {
      const violationEvent = {
        source: 'compliance.shepherd',
        'detail-type': 'compliance-violation-detected',
        detail: {
          tenantId: 'test-tenant',
          severity: 'CRITICAL',
          findingId: 'finding-123',
          description: 'Critical security violation detected'
        },
        time: '2023-01-01T00:00:00Z'
      };

      mockSFNClient.send.mockResolvedValue({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:IncidentResponseWorkflow:test-execution'
      });

      mockSNSClient.send.mockResolvedValue({
        MessageId: 'message-123'
      });

      await service.processEvent(violationEvent, correlationId);

      // Should trigger incident response workflow for critical violations
      expect(mockSFNClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            input: expect.stringContaining('incident-response')
          })
        })
      );

      // Should send notification
      expect(mockSNSClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Subject: expect.stringContaining('Compliance Violation Detected - CRITICAL'),
            Message: expect.stringContaining('Critical security violation detected')
          })
        })
      );
    });

    it('should handle unknown event sources gracefully', async () => {
      const unknownEvent = {
        source: 'unknown.service',
        'detail-type': 'Unknown Event',
        detail: {},
        time: '2023-01-01T00:00:00Z'
      };

      // Should not throw an error
      await expect(service.processEvent(unknownEvent, correlationId))
        .resolves
        .toBeUndefined();
    });

    it('should handle processing errors', async () => {
      const event = {
        source: 'aws.scheduler',
        'detail-type': 'Scheduled Event',
        detail: {
          workflowType: 'compliance-scan'
        },
        time: '2023-01-01T00:00:00Z'
      };

      mockSFNClient.send.mockRejectedValue(new Error('Step Functions error'));

      await expect(service.processEvent(event, correlationId))
        .rejects
        .toThrow('Step Functions error');
    });
  });

  describe('triggerEvent', () => {
    const triggerRequest: EventProcessorRequest = {
      eventType: 'manual-scan',
      tenantId: 'test-tenant',
      parameters: {
        scanType: 'comprehensive'
      },
      triggeredBy: 'user@example.com',
      processImmediately: true
    };

    it('should trigger event successfully', async () => {
      mockEventBridgeClient.send.mockResolvedValue({
        FailedEntryCount: 0
      });

      mockSFNClient.send.mockResolvedValue({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:test-execution'
      });

      const result = await service.triggerEvent(triggerRequest, correlationId);

      expect(result).toMatchObject({
        eventType: 'manual-scan',
        tenantId: 'test-tenant',
        status: 'TRIGGERED',
        correlationId
      });

      expect(result.eventId).toBeDefined();
      expect(result.triggeredAt).toBeDefined();

      // Should publish event to EventBridge
      expect(mockEventBridgeClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Entries: expect.arrayContaining([
              expect.objectContaining({
                Source: 'compliance.shepherd',
                DetailType: 'manual-scan',
                Detail: expect.stringContaining('test-tenant')
              })
            ])
          })
        })
      );

      // Should process immediately if requested
      expect(mockSFNClient.send).toHaveBeenCalled();
    });

    it('should handle EventBridge publish failures', async () => {
      mockEventBridgeClient.send.mockResolvedValue({
        FailedEntryCount: 1
      });

      await expect(service.triggerEvent(triggerRequest, correlationId))
        .rejects
        .toThrow(EventBridgeSchedulerError);
    });

    it('should not process immediately if not requested', async () => {
      const requestWithoutImmediate = {
        ...triggerRequest,
        processImmediately: false
      };

      mockEventBridgeClient.send.mockResolvedValue({
        FailedEntryCount: 0
      });

      await service.triggerEvent(requestWithoutImmediate, correlationId);

      // Should publish event but not process immediately
      expect(mockEventBridgeClient.send).toHaveBeenCalled();
      expect(mockSFNClient.send).not.toHaveBeenCalled();
    });
  });

  describe('getEventHistory', () => {
    it('should return event history', async () => {
      const historyRequest = {
        tenantId: 'test-tenant',
        eventType: 'scheduled-scan',
        limit: 10
      };

      const result = await service.getEventHistory(historyRequest, correlationId);

      expect(result.events).toBeDefined();
      expect(Array.isArray(result.events)).toBe(true);
      
      if (result.events.length > 0) {
        expect(result.events[0]).toMatchObject({
          eventId: expect.any(String),
          eventType: expect.any(String),
          tenantId: expect.any(String),
          status: expect.any(String),
          triggeredAt: expect.any(String)
        });
      }
    });

    it('should filter events by type', async () => {
      const historyRequest = {
        eventType: 'resource-created',
        limit: 10
      };

      const result = await service.getEventHistory(historyRequest, correlationId);

      // All returned events should match the filter
      result.events.forEach(event => {
        expect(event.eventType).toBe('resource-created');
      });
    });

    it('should handle empty history', async () => {
      const historyRequest = {
        tenantId: 'non-existent-tenant',
        limit: 10
      };

      const result = await service.getEventHistory(historyRequest, correlationId);

      expect(result.events).toHaveLength(0);
    });
  });

  describe('workflow triggering', () => {
    it('should map workflow types to correct state machines', async () => {
      const workflowMappings = [
        { type: 'compliance-scan', expected: 'ComplianceScanWorkflow' },
        { type: 'remediation', expected: 'RemediationWorkflow' },
        { type: 'compliance-assessment', expected: 'ComplianceAssessmentWorkflow' },
        { type: 'incident-response', expected: 'IncidentResponseWorkflow' },
        { type: 'audit-pack-generation', expected: 'AuditPackGenerationWorkflow' },
        { type: 'continuous-monitoring', expected: 'ContinuousMonitoringWorkflow' }
      ];

      for (const mapping of workflowMappings) {
        mockSFNClient.send.mockResolvedValue({
          executionArn: `arn:aws:states:us-east-1:123456789012:execution:${mapping.expected}:test-execution`
        });

        const event = {
          source: 'compliance.shepherd',
          'detail-type': 'manual-scan',
          detail: {
            tenantId: 'test-tenant',
            workflowType: mapping.type
          },
          time: '2023-01-01T00:00:00Z'
        };

        await service.processEvent(event, correlationId);

        expect(mockSFNClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.objectContaining({
              stateMachineArn: expect.stringContaining(mapping.expected)
            })
          })
        );

        mockSFNClient.send.mockClear();
      }
    });

    it('should include correct metadata in workflow input', async () => {
      const event = {
        source: 'aws.scheduler',
        'detail-type': 'Scheduled Event',
        detail: {
          tenantId: 'test-tenant',
          workflowType: 'compliance-scan',
          parameters: {
            scanType: 'comprehensive'
          }
        },
        time: '2023-01-01T00:00:00Z'
      };

      mockSFNClient.send.mockResolvedValue({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:test-execution'
      });

      await service.processEvent(event, correlationId);

      const startExecutionCall = mockSFNClient.send.mock.calls[0][0];
      const workflowInput = JSON.parse(startExecutionCall.input.input);

      expect(workflowInput).toMatchObject({
        tenantId: 'test-tenant',
        workflowType: 'compliance-scan',
        parameters: {
          scanType: 'comprehensive'
        },
        metadata: {
          eventTriggered: true,
          correlationId
        }
      });

      expect(workflowInput.metadata.triggeredAt).toBeDefined();
    });
  });

  describe('compliance check triggering', () => {
    it('should map check types to correct functions', async () => {
      const checkMappings = [
        { type: 's3-bucket-check', expected: 'scan-environment' },
        { type: 'iam-compliance-check', expected: 'scan-environment' },
        { type: 'ec2-security-check', expected: 'scan-environment' },
        { type: 'security-group-check', expected: 'scan-environment' }
      ];

      for (const mapping of checkMappings) {
        mockLambdaClient.send.mockResolvedValue({});

        const event = {
          source: 'aws.s3',
          'detail-type': 'S3 Bucket Created',
          detail: {
            bucket: { name: 'test-bucket' }
          },
          time: '2023-01-01T00:00:00Z'
        };

        await service.processEvent(event, correlationId);

        expect(mockLambdaClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.objectContaining({
              FunctionName: mapping.expected,
              InvocationType: 'Event'
            })
          })
        );

        mockLambdaClient.send.mockClear();
      }
    });
  });

  describe('notification handling', () => {
    it('should send notifications for compliance violations', async () => {
      const violationEvent = {
        source: 'compliance.shepherd',
        'detail-type': 'compliance-violation-detected',
        detail: {
          tenantId: 'test-tenant',
          severity: 'HIGH',
          findingId: 'finding-123',
          description: 'High severity violation'
        },
        time: '2023-01-01T00:00:00Z'
      };

      mockSFNClient.send.mockResolvedValue({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:IncidentResponseWorkflow:test-execution'
      });

      mockSNSClient.send.mockResolvedValue({
        MessageId: 'message-123'
      });

      await service.processEvent(violationEvent, correlationId);

      expect(mockSNSClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TopicArn: expect.stringContaining('compliance-notifications'),
            Subject: 'Compliance Violation Detected - HIGH',
            Message: expect.stringContaining('High severity violation')
          })
        })
      );
    });

    it('should handle notification failures gracefully', async () => {
      const violationEvent = {
        source: 'compliance.shepherd',
        'detail-type': 'compliance-violation-detected',
        detail: {
          tenantId: 'test-tenant',
          severity: 'MEDIUM',
          description: 'Medium severity violation'
        },
        time: '2023-01-01T00:00:00Z'
      };

      mockSNSClient.send.mockRejectedValue(new Error('SNS error'));

      // Should not throw error even if notification fails
      await expect(service.processEvent(violationEvent, correlationId))
        .resolves
        .toBeUndefined();
    });
  });
});
