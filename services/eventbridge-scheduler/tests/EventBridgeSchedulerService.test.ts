import { EventBridgeSchedulerService } from '../src/services/EventBridgeSchedulerService';
import { ScheduleRequest } from '../src/types/schedule';
import { EventBridgeSchedulerError } from '../src/utils/errorHandler';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-scheduler');
jest.mock('@aws-sdk/client-sts');

const mockSchedulerClient = {
  send: jest.fn()
};

const mockSTSClient = {
  send: jest.fn()
};

// Mock the clients
jest.doMock('@aws-sdk/client-scheduler', () => ({
  SchedulerClient: jest.fn(() => mockSchedulerClient),
  CreateScheduleCommand: jest.fn(),
  UpdateScheduleCommand: jest.fn(),
  DeleteScheduleCommand: jest.fn(),
  GetScheduleCommand: jest.fn(),
  ListSchedulesCommand: jest.fn()
}));

jest.doMock('@aws-sdk/client-sts', () => ({
  STSClient: jest.fn(() => mockSTSClient),
  GetCallerIdentityCommand: jest.fn()
}));

describe('EventBridgeSchedulerService', () => {
  let service: EventBridgeSchedulerService;
  const correlationId = 'test-correlation-id';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EventBridgeSchedulerService();
    
    // Mock STS response
    mockSTSClient.send.mockResolvedValue({
      Account: '123456789012'
    });
  });

  describe('createSchedule', () => {
    const validScheduleRequest: ScheduleRequest = {
      scheduleType: 'compliance-scan',
      tenantId: 'test-tenant',
      cronExpression: '0 6 * * ? *',
      timezone: 'UTC',
      enabled: true,
      description: 'Daily compliance scan',
      target: {
        type: 'step-functions',
        stateMachineName: 'ComplianceScanWorkflow'
      },
      parameters: {
        scanType: 'comprehensive'
      },
      flexibleTimeWindowMinutes: 15,
      createdBy: 'test-user'
    };

    it('should create a schedule successfully', async () => {
      mockSchedulerClient.send.mockResolvedValue({});

      const result = await service.createSchedule(validScheduleRequest, correlationId);

      expect(result).toMatchObject({
        scheduleType: 'compliance-scan',
        tenantId: 'test-tenant',
        cronExpression: '0 6 * * ? *',
        enabled: true,
        description: 'Daily compliance scan'
      });

      expect(result.scheduleId).toBeDefined();
      expect(result.scheduleName).toBeDefined();
      expect(result.nextExecution).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });

    it('should handle invalid cron expression', async () => {
      const invalidRequest = {
        ...validScheduleRequest,
        cronExpression: 'invalid-cron'
      };

      await expect(service.createSchedule(invalidRequest, correlationId))
        .rejects
        .toThrow(EventBridgeSchedulerError);
    });

    it('should handle AWS service errors', async () => {
      mockSchedulerClient.send.mockRejectedValue(new Error('AWS service error'));

      await expect(service.createSchedule(validScheduleRequest, correlationId))
        .rejects
        .toThrow(EventBridgeSchedulerError);
    });

    it('should build correct target for Step Functions', async () => {
      mockSchedulerClient.send.mockResolvedValue({});

      await service.createSchedule(validScheduleRequest, correlationId);

      expect(mockSchedulerClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Target: expect.objectContaining({
              Arn: expect.stringContaining('stateMachine:ComplianceScanWorkflow'),
              SfnParameters: expect.objectContaining({
                Input: expect.stringContaining('test-tenant')
              })
            })
          })
        })
      );
    });

    it('should build correct target for Lambda', async () => {
      const lambdaRequest = {
        ...validScheduleRequest,
        target: {
          type: 'lambda' as const,
          functionName: 'scan-environment'
        }
      };

      mockSchedulerClient.send.mockResolvedValue({});

      await service.createSchedule(lambdaRequest, correlationId);

      expect(mockSchedulerClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Target: expect.objectContaining({
              Arn: expect.stringContaining('function:scan-environment'),
              LambdaParameters: expect.objectContaining({
                Payload: expect.stringContaining('test-tenant')
              })
            })
          })
        })
      );
    });

    it('should build correct target for SNS', async () => {
      const snsRequest = {
        ...validScheduleRequest,
        target: {
          type: 'sns' as const,
          topicName: 'compliance-notifications'
        }
      };

      mockSchedulerClient.send.mockResolvedValue({});

      await service.createSchedule(snsRequest, correlationId);

      expect(mockSchedulerClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Target: expect.objectContaining({
              Arn: expect.stringContaining('sns:us-east-1:123456789012:compliance-notifications'),
              SnsParameters: expect.objectContaining({
                Message: expect.stringContaining('test-tenant')
              })
            })
          })
        })
      );
    });
  });

  describe('updateSchedule', () => {
    const scheduleId = 'test-schedule-id';
    const updateRequest: ScheduleRequest = {
      scheduleType: 'compliance-scan',
      tenantId: 'test-tenant',
      cronExpression: '0 8 * * ? *', // Changed time
      timezone: 'UTC',
      enabled: false, // Changed to disabled
      description: 'Updated daily compliance scan',
      target: {
        type: 'step-functions',
        stateMachineName: 'ComplianceScanWorkflow'
      }
    };

    it('should update a schedule successfully', async () => {
      mockSchedulerClient.send.mockResolvedValue({});

      const result = await service.updateSchedule(scheduleId, updateRequest, correlationId);

      expect(result).toMatchObject({
        scheduleId,
        scheduleType: 'compliance-scan',
        cronExpression: '0 8 * * ? *',
        enabled: false,
        description: 'Updated daily compliance scan'
      });

      expect(result.updatedAt).toBeDefined();
    });

    it('should handle schedule not found', async () => {
      mockSchedulerClient.send.mockRejectedValue({
        name: 'ResourceNotFoundException'
      });

      await expect(service.updateSchedule(scheduleId, updateRequest, correlationId))
        .rejects
        .toThrow(EventBridgeSchedulerError);
    });
  });

  describe('deleteSchedule', () => {
    const scheduleId = 'test-schedule-id';

    it('should delete a schedule successfully', async () => {
      mockSchedulerClient.send.mockResolvedValue({});

      const result = await service.deleteSchedule(scheduleId, correlationId);

      expect(result).toEqual({
        deleted: true,
        message: 'Schedule deleted successfully'
      });
    });

    it('should handle schedule not found during deletion', async () => {
      mockSchedulerClient.send.mockRejectedValue({
        name: 'ResourceNotFoundException'
      });

      await expect(service.deleteSchedule(scheduleId, correlationId))
        .rejects
        .toThrow(EventBridgeSchedulerError);
    });
  });

  describe('getSchedule', () => {
    const scheduleId = 'test-schedule-id';

    it('should get a schedule successfully', async () => {
      const mockScheduleResponse = {
        Name: 'compliance-schedule-test-schedule-id',
        ScheduleExpression: 'cron(0 6 * * ? *)',
        State: 'ENABLED',
        Description: 'Test schedule',
        ScheduleExpressionTimezone: 'UTC',
        CreationDate: new Date('2023-01-01T00:00:00Z'),
        LastModificationDate: new Date('2023-01-02T00:00:00Z')
      };

      mockSchedulerClient.send.mockResolvedValue(mockScheduleResponse);

      const result = await service.getSchedule(scheduleId, correlationId);

      expect(result).toMatchObject({
        scheduleId,
        scheduleName: 'compliance-schedule-test-schedule-id',
        cronExpression: '0 6 * * ? *',
        enabled: true,
        description: 'Test schedule',
        timezone: 'UTC'
      });

      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should handle schedule not found', async () => {
      mockSchedulerClient.send.mockRejectedValue({
        name: 'ResourceNotFoundException'
      });

      await expect(service.getSchedule(scheduleId, correlationId))
        .rejects
        .toThrow(EventBridgeSchedulerError);
    });
  });

  describe('listSchedules', () => {
    it('should list schedules successfully', async () => {
      const mockListResponse = {
        Schedules: [
          {
            Name: 'compliance-schedule-1',
            State: 'ENABLED',
            CreationDate: new Date('2023-01-01T00:00:00Z')
          },
          {
            Name: 'compliance-schedule-2',
            State: 'DISABLED',
            CreationDate: new Date('2023-01-02T00:00:00Z')
          }
        ],
        NextToken: 'next-token'
      };

      const mockGetResponse = {
        Name: 'compliance-schedule-1',
        ScheduleExpression: 'cron(0 6 * * ? *)',
        State: 'ENABLED',
        Description: 'Test schedule',
        ScheduleExpressionTimezone: 'UTC'
      };

      mockSchedulerClient.send
        .mockResolvedValueOnce(mockListResponse) // ListSchedulesCommand
        .mockResolvedValue(mockGetResponse); // GetScheduleCommand calls

      const result = await service.listSchedules({
        limit: 10
      }, correlationId);

      expect(result.schedules).toHaveLength(2);
      expect(result.nextToken).toBe('next-token');
    });

    it('should filter schedules by tenant ID', async () => {
      const mockListResponse = {
        Schedules: [
          { Name: 'compliance-schedule-1', State: 'ENABLED' },
          { Name: 'compliance-schedule-2', State: 'ENABLED' }
        ]
      };

      const mockGetResponse1 = {
        Name: 'compliance-schedule-1',
        ScheduleExpression: 'cron(0 6 * * ? *)',
        State: 'ENABLED',
        Target: {
          SfnParameters: {
            Input: JSON.stringify({ tenantId: 'tenant-1' })
          }
        }
      };

      const mockGetResponse2 = {
        Name: 'compliance-schedule-2',
        ScheduleExpression: 'cron(0 8 * * ? *)',
        State: 'ENABLED',
        Target: {
          SfnParameters: {
            Input: JSON.stringify({ tenantId: 'tenant-2' })
          }
        }
      };

      mockSchedulerClient.send
        .mockResolvedValueOnce(mockListResponse)
        .mockResolvedValueOnce(mockGetResponse1)
        .mockResolvedValueOnce(mockGetResponse2);

      const result = await service.listSchedules({
        tenantId: 'tenant-1',
        limit: 10
      }, correlationId);

      // Should only return schedules for tenant-1
      expect(result.schedules).toHaveLength(1);
    });

    it('should handle empty schedule list', async () => {
      mockSchedulerClient.send.mockResolvedValue({
        Schedules: []
      });

      const result = await service.listSchedules({}, correlationId);

      expect(result.schedules).toHaveLength(0);
      expect(result.nextToken).toBeUndefined();
    });
  });

  describe('cron expression validation', () => {
    it('should validate valid cron expressions', async () => {
      const validExpressions = [
        '0 6 * * ? *',      // Daily at 6 AM
        '0 */4 * * ? *',    // Every 4 hours
        '0 0 ? * MON *',    // Every Monday
        '0 30 8 ? * MON-FRI *' // Weekdays at 8:30 AM
      ];

      for (const expression of validExpressions) {
        const request = {
          scheduleType: 'test',
          tenantId: 'test-tenant',
          cronExpression: expression,
          enabled: true,
          target: {
            type: 'lambda' as const,
            functionName: 'test-function'
          }
        };

        mockSchedulerClient.send.mockResolvedValue({});

        await expect(service.createSchedule(request, correlationId))
          .resolves
          .toBeDefined();
      }
    });

    it('should reject invalid cron expressions', async () => {
      const invalidExpressions = [
        'invalid',
        '60 6 * * ? *',     // Invalid minute (60)
        '0 25 * * ? *',     // Invalid hour (25)
        '0 6 32 * ? *',     // Invalid day (32)
        '0 6 * 13 ? *'      // Invalid month (13)
      ];

      for (const expression of invalidExpressions) {
        const request = {
          scheduleType: 'test',
          tenantId: 'test-tenant',
          cronExpression: expression,
          enabled: true,
          target: {
            type: 'lambda' as const,
            functionName: 'test-function'
          }
        };

        await expect(service.createSchedule(request, correlationId))
          .rejects
          .toThrow(EventBridgeSchedulerError);
      }
    });
  });

  describe('target configuration', () => {
    it('should reject unsupported target types', async () => {
      const request = {
        scheduleType: 'test',
        tenantId: 'test-tenant',
        cronExpression: '0 6 * * ? *',
        enabled: true,
        target: {
          type: 'unsupported' as any
        }
      };

      await expect(service.createSchedule(request, correlationId))
        .rejects
        .toThrow(EventBridgeSchedulerError);
    });

    it('should include metadata in target input', async () => {
      const request: ScheduleRequest = {
        scheduleType: 'compliance-scan',
        tenantId: 'test-tenant',
        cronExpression: '0 6 * * ? *',
        enabled: true,
        target: {
          type: 'step-functions',
          stateMachineName: 'TestWorkflow'
        },
        parameters: {
          scanType: 'quick'
        }
      };

      mockSchedulerClient.send.mockResolvedValue({});

      await service.createSchedule(request, correlationId);

      const createCall = mockSchedulerClient.send.mock.calls[0][0];
      const targetInput = JSON.parse(createCall.input.Target.SfnParameters.Input);

      expect(targetInput).toMatchObject({
        tenantId: 'test-tenant',
        workflowType: 'compliance-scan',
        parameters: {
          scanType: 'quick'
        },
        metadata: {
          scheduledExecution: true,
          scheduleId: 'compliance-scan'
        }
      });

      expect(targetInput.metadata.triggeredAt).toBeDefined();
    });
  });
});
