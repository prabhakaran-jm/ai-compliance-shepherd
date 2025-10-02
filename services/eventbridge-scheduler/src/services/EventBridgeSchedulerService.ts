import {
  SchedulerClient,
  CreateScheduleCommand,
  UpdateScheduleCommand,
  DeleteScheduleCommand,
  GetScheduleCommand,
  ListSchedulesCommand
} from '@aws-sdk/client-scheduler';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { logger } from '../utils/logger';
import { EventBridgeSchedulerError } from '../utils/errorHandler';
import { 
  ScheduleRequest,
  ScheduleResponse,
  ScheduleListRequest,
  ScheduleConfiguration 
} from '../types/schedule';
import { v4 as uuidv4 } from 'uuid';
import * as cronParser from 'cron-parser';

/**
 * Service for managing EventBridge Scheduler operations
 * Handles scheduled compliance operations and automated triggers
 */
export class EventBridgeSchedulerService {
  private schedulerClient: SchedulerClient;
  private stsClient: STSClient;
  private accountId?: string;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.schedulerClient = new SchedulerClient({ region: this.region });
    this.stsClient = new STSClient({ region: this.region });
  }

  /**
   * Create a new schedule
   */
  async createSchedule(request: ScheduleRequest, correlationId: string): Promise<ScheduleResponse> {
    try {
      logger.info('Creating schedule', {
        correlationId,
        scheduleType: request.scheduleType,
        tenantId: request.tenantId,
        cronExpression: request.cronExpression
      });

      // Get account ID if not cached
      if (!this.accountId) {
        const identity = await this.stsClient.send(new GetCallerIdentityCommand({}));
        this.accountId = identity.Account;
      }

      // Generate schedule name
      const scheduleId = uuidv4();
      const scheduleName = `compliance-${request.scheduleType}-${scheduleId}`;

      // Validate cron expression
      this.validateCronExpression(request.cronExpression);

      // Prepare target configuration
      const target = this.buildScheduleTarget(request);

      // Create the schedule
      const command = new CreateScheduleCommand({
        Name: scheduleName,
        ScheduleExpression: `cron(${request.cronExpression})`,
        Target: target,
        FlexibleTimeWindow: {
          Mode: 'FLEXIBLE',
          MaximumWindowInMinutes: request.flexibleTimeWindowMinutes || 15
        },
        State: request.enabled ? 'ENABLED' : 'DISABLED',
        Description: request.description || `Automated ${request.scheduleType} for tenant ${request.tenantId}`,
        GroupName: 'compliance-schedules',
        KmsKeyArn: process.env.SCHEDULER_KMS_KEY_ARN,
        ScheduleExpressionTimezone: request.timezone || 'UTC'
      });

      await this.schedulerClient.send(command);

      // Calculate next execution time
      const nextExecution = this.calculateNextExecution(request.cronExpression, request.timezone);

      const schedule: ScheduleResponse = {
        scheduleId,
        scheduleName,
        scheduleType: request.scheduleType,
        tenantId: request.tenantId,
        cronExpression: request.cronExpression,
        timezone: request.timezone || 'UTC',
        enabled: request.enabled,
        description: request.description,
        target: request.target,
        parameters: request.parameters,
        nextExecution,
        createdAt: new Date().toISOString(),
        createdBy: request.createdBy || 'system'
      };

      logger.info('Schedule created successfully', {
        correlationId,
        scheduleId,
        scheduleName,
        nextExecution
      });

      return schedule;

    } catch (error) {
      logger.error('Error creating schedule', {
        correlationId,
        scheduleType: request.scheduleType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new EventBridgeSchedulerError(
        `Failed to create schedule: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update an existing schedule
   */
  async updateSchedule(
    scheduleId: string, 
    request: ScheduleRequest, 
    correlationId: string
  ): Promise<ScheduleResponse> {
    try {
      logger.info('Updating schedule', {
        correlationId,
        scheduleId,
        scheduleType: request.scheduleType
      });

      const scheduleName = await this.getScheduleNameById(scheduleId);
      
      // Validate cron expression
      this.validateCronExpression(request.cronExpression);

      // Prepare target configuration
      const target = this.buildScheduleTarget(request);

      // Update the schedule
      const command = new UpdateScheduleCommand({
        Name: scheduleName,
        ScheduleExpression: `cron(${request.cronExpression})`,
        Target: target,
        FlexibleTimeWindow: {
          Mode: 'FLEXIBLE',
          MaximumWindowInMinutes: request.flexibleTimeWindowMinutes || 15
        },
        State: request.enabled ? 'ENABLED' : 'DISABLED',
        Description: request.description || `Automated ${request.scheduleType} for tenant ${request.tenantId}`,
        KmsKeyArn: process.env.SCHEDULER_KMS_KEY_ARN,
        ScheduleExpressionTimezone: request.timezone || 'UTC'
      });

      await this.schedulerClient.send(command);

      // Calculate next execution time
      const nextExecution = this.calculateNextExecution(request.cronExpression, request.timezone);

      const schedule: ScheduleResponse = {
        scheduleId,
        scheduleName,
        scheduleType: request.scheduleType,
        tenantId: request.tenantId,
        cronExpression: request.cronExpression,
        timezone: request.timezone || 'UTC',
        enabled: request.enabled,
        description: request.description,
        target: request.target,
        parameters: request.parameters,
        nextExecution,
        updatedAt: new Date().toISOString(),
        updatedBy: request.createdBy || 'system'
      };

      logger.info('Schedule updated successfully', {
        correlationId,
        scheduleId,
        scheduleName,
        nextExecution
      });

      return schedule;

    } catch (error) {
      logger.error('Error updating schedule', {
        correlationId,
        scheduleId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new EventBridgeSchedulerError(
        `Failed to update schedule: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: string, correlationId: string): Promise<{ deleted: boolean; message: string }> {
    try {
      logger.info('Deleting schedule', {
        correlationId,
        scheduleId
      });

      const scheduleName = await this.getScheduleNameById(scheduleId);

      const command = new DeleteScheduleCommand({
        Name: scheduleName,
        GroupName: 'compliance-schedules'
      });

      await this.schedulerClient.send(command);

      logger.info('Schedule deleted successfully', {
        correlationId,
        scheduleId,
        scheduleName
      });

      return {
        deleted: true,
        message: 'Schedule deleted successfully'
      };

    } catch (error) {
      logger.error('Error deleting schedule', {
        correlationId,
        scheduleId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new EventBridgeSchedulerError(
        `Failed to delete schedule: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a specific schedule
   */
  async getSchedule(scheduleId: string, correlationId: string): Promise<ScheduleResponse> {
    try {
      logger.info('Getting schedule', {
        correlationId,
        scheduleId
      });

      const scheduleName = await this.getScheduleNameById(scheduleId);

      const command = new GetScheduleCommand({
        Name: scheduleName,
        GroupName: 'compliance-schedules'
      });

      const response = await this.schedulerClient.send(command);

      // Parse the schedule response
      const schedule = this.parseScheduleResponse(scheduleId, response);

      logger.info('Schedule retrieved successfully', {
        correlationId,
        scheduleId,
        scheduleName: schedule.scheduleName
      });

      return schedule;

    } catch (error) {
      logger.error('Error getting schedule', {
        correlationId,
        scheduleId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new EventBridgeSchedulerError(
        `Failed to get schedule: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * List schedules with filtering
   */
  async listSchedules(
    request: ScheduleListRequest,
    correlationId: string
  ): Promise<{ schedules: ScheduleResponse[]; nextToken?: string }> {
    try {
      logger.info('Listing schedules', {
        correlationId,
        tenantId: request.tenantId,
        scheduleType: request.scheduleType,
        status: request.status
      });

      const command = new ListSchedulesCommand({
        GroupName: 'compliance-schedules',
        MaxResults: request.limit || 50,
        NextToken: request.nextToken
      });

      const response = await this.schedulerClient.send(command);

      const schedules: ScheduleResponse[] = [];

      if (response.Schedules) {
        for (const schedule of response.Schedules) {
          try {
            // Extract schedule ID from name
            const scheduleId = this.extractScheduleIdFromName(schedule.Name!);
            
            // Get full schedule details
            const fullSchedule = await this.getSchedule(scheduleId, correlationId);
            
            // Apply filters
            if (request.tenantId && fullSchedule.tenantId !== request.tenantId) {
              continue;
            }
            
            if (request.scheduleType && fullSchedule.scheduleType !== request.scheduleType) {
              continue;
            }
            
            if (request.status) {
              const scheduleEnabled = fullSchedule.enabled;
              const statusMatch = (request.status === 'ENABLED' && scheduleEnabled) ||
                                 (request.status === 'DISABLED' && !scheduleEnabled);
              if (!statusMatch) {
                continue;
              }
            }

            schedules.push(fullSchedule);
          } catch (error) {
            // Skip schedules that can't be parsed
            logger.warn('Failed to parse schedule', {
              correlationId,
              scheduleName: schedule.Name,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }

      logger.info('Schedules listed successfully', {
        correlationId,
        scheduleCount: schedules.length,
        hasNextToken: !!response.NextToken
      });

      return {
        schedules,
        nextToken: response.NextToken
      };

    } catch (error) {
      logger.error('Error listing schedules', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new EventBridgeSchedulerError(
        `Failed to list schedules: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build schedule target configuration
   */
  private buildScheduleTarget(request: ScheduleRequest): any {
    if (!this.accountId) {
      throw new EventBridgeSchedulerError('Account ID not available');
    }

    switch (request.target.type) {
      case 'step-functions':
        return {
          Arn: `arn:aws:states:${this.region}:${this.accountId}:stateMachine:${request.target.stateMachineName}`,
          RoleArn: `arn:aws:iam::${this.accountId}:role/EventBridgeSchedulerRole`,
          SfnParameters: {
            Input: JSON.stringify({
              tenantId: request.tenantId,
              workflowType: request.scheduleType,
              parameters: request.parameters || {},
              metadata: {
                scheduledExecution: true,
                scheduleId: request.scheduleType,
                triggeredAt: new Date().toISOString()
              }
            })
          }
        };

      case 'lambda':
        return {
          Arn: `arn:aws:lambda:${this.region}:${this.accountId}:function:${request.target.functionName}`,
          RoleArn: `arn:aws:iam::${this.accountId}:role/EventBridgeSchedulerRole`,
          LambdaParameters: {
            Payload: JSON.stringify({
              tenantId: request.tenantId,
              scheduleType: request.scheduleType,
              parameters: request.parameters || {},
              metadata: {
                scheduledExecution: true,
                triggeredAt: new Date().toISOString()
              }
            })
          }
        };

      case 'sns':
        return {
          Arn: `arn:aws:sns:${this.region}:${this.accountId}:${request.target.topicName}`,
          RoleArn: `arn:aws:iam::${this.accountId}:role/EventBridgeSchedulerRole`,
          SnsParameters: {
            Message: JSON.stringify({
              tenantId: request.tenantId,
              scheduleType: request.scheduleType,
              parameters: request.parameters || {},
              triggeredAt: new Date().toISOString()
            })
          }
        };

      default:
        throw new EventBridgeSchedulerError(`Unsupported target type: ${request.target.type}`);
    }
  }

  /**
   * Validate cron expression
   */
  private validateCronExpression(cronExpression: string): void {
    try {
      cronParser.parseExpression(cronExpression);
    } catch (error) {
      throw new EventBridgeSchedulerError(`Invalid cron expression: ${cronExpression}`);
    }
  }

  /**
   * Calculate next execution time
   */
  private calculateNextExecution(cronExpression: string, timezone?: string): string {
    try {
      const options = timezone ? { tz: timezone } : {};
      const interval = cronParser.parseExpression(cronExpression, options);
      return interval.next().toISOString();
    } catch (error) {
      logger.warn('Failed to calculate next execution time', {
        cronExpression,
        timezone,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return new Date().toISOString();
    }
  }

  /**
   * Get schedule name by ID (simplified mapping for demo)
   */
  private async getScheduleNameById(scheduleId: string): Promise<string> {
    // In a real implementation, this would query a database
    // For now, we'll use a simple naming convention
    return `compliance-schedule-${scheduleId}`;
  }

  /**
   * Extract schedule ID from name
   */
  private extractScheduleIdFromName(scheduleName: string): string {
    // Extract ID from naming convention
    const parts = scheduleName.split('-');
    return parts[parts.length - 1];
  }

  /**
   * Parse schedule response from AWS
   */
  private parseScheduleResponse(scheduleId: string, response: any): ScheduleResponse {
    // Parse cron expression
    const cronMatch = response.ScheduleExpression?.match(/cron\((.+)\)/);
    const cronExpression = cronMatch ? cronMatch[1] : '';

    // Calculate next execution
    const nextExecution = this.calculateNextExecution(cronExpression, response.ScheduleExpressionTimezone);

    return {
      scheduleId,
      scheduleName: response.Name,
      scheduleType: 'unknown', // Would be extracted from metadata in real implementation
      tenantId: 'unknown', // Would be extracted from target input
      cronExpression,
      timezone: response.ScheduleExpressionTimezone || 'UTC',
      enabled: response.State === 'ENABLED',
      description: response.Description,
      target: {
        type: 'step-functions', // Would be determined from Arn
        stateMachineName: 'unknown'
      },
      nextExecution,
      createdAt: response.CreationDate?.toISOString(),
      updatedAt: response.LastModificationDate?.toISOString()
    };
  }
}
