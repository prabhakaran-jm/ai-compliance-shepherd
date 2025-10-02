import {
  EventBridgeClient,
  PutEventsCommand
} from '@aws-sdk/client-eventbridge';
import {
  SFNClient,
  StartExecutionCommand
} from '@aws-sdk/client-sfn';
import {
  LambdaClient,
  InvokeCommand
} from '@aws-sdk/client-lambda';
import {
  SNSClient,
  PublishCommand
} from '@aws-sdk/client-sns';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { logger } from '../utils/logger';
import { EventBridgeSchedulerError } from '../utils/errorHandler';
import { 
  EventProcessorRequest,
  EventProcessorResponse,
  EventHistoryRequest,
  ComplianceEvent
} from '../types/event';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for processing EventBridge events and triggers
 * Handles event-driven compliance operations
 */
export class EventProcessorService {
  private eventBridgeClient: EventBridgeClient;
  private sfnClient: SFNClient;
  private lambdaClient: LambdaClient;
  private snsClient: SNSClient;
  private stsClient: STSClient;
  private accountId?: string;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.eventBridgeClient = new EventBridgeClient({ region: this.region });
    this.sfnClient = new SFNClient({ region: this.region });
    this.lambdaClient = new LambdaClient({ region: this.region });
    this.snsClient = new SNSClient({ region: this.region });
    this.stsClient = new STSClient({ region: this.region });
  }

  /**
   * Process EventBridge events
   */
  async processEvent(event: any, correlationId: string): Promise<void> {
    try {
      logger.info('Processing EventBridge event', {
        correlationId,
        source: event.source,
        detailType: event['detail-type'],
        eventTime: event.time
      });

      // Route event based on source and detail type
      switch (event.source) {
        case 'aws.scheduler':
          await this.handleScheduledEvent(event, correlationId);
          break;
        
        case 'aws.s3':
          await this.handleS3Event(event, correlationId);
          break;
        
        case 'aws.iam':
          await this.handleIAMEvent(event, correlationId);
          break;
        
        case 'aws.ec2':
          await this.handleEC2Event(event, correlationId);
          break;
        
        case 'compliance.shepherd':
          await this.handleComplianceEvent(event, correlationId);
          break;
        
        default:
          logger.warn('Unknown event source', {
            correlationId,
            source: event.source,
            detailType: event['detail-type']
          });
      }

      // Log event processing
      await this.logEventProcessing(event, correlationId, 'SUCCESS');

    } catch (error) {
      logger.error('Error processing event', {
        correlationId,
        source: event.source,
        detailType: event['detail-type'],
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Log event processing failure
      await this.logEventProcessing(event, correlationId, 'FAILED', error);
      throw error;
    }
  }

  /**
   * Manually trigger an event
   */
  async triggerEvent(request: EventProcessorRequest, correlationId: string): Promise<EventProcessorResponse> {
    try {
      logger.info('Triggering manual event', {
        correlationId,
        eventType: request.eventType,
        tenantId: request.tenantId
      });

      // Get account ID if not cached
      if (!this.accountId) {
        const identity = await this.stsClient.send(new GetCallerIdentityCommand({}));
        this.accountId = identity.Account;
      }

      const eventId = uuidv4();
      const eventTime = new Date().toISOString();

      // Create custom event
      const customEvent = {
        Source: 'compliance.shepherd',
        DetailType: request.eventType,
        Detail: JSON.stringify({
          eventId,
          tenantId: request.tenantId,
          parameters: request.parameters || {},
          triggeredBy: request.triggeredBy || 'manual',
          triggeredAt: eventTime,
          correlationId
        }),
        Time: new Date(eventTime)
      };

      // Publish event to EventBridge
      const command = new PutEventsCommand({
        Entries: [customEvent]
      });

      const response = await this.eventBridgeClient.send(command);

      if (response.FailedEntryCount && response.FailedEntryCount > 0) {
        throw new EventBridgeSchedulerError('Failed to publish event to EventBridge');
      }

      // Process the event immediately if requested
      if (request.processImmediately) {
        await this.processEvent({
          source: customEvent.Source,
          'detail-type': customEvent.DetailType,
          detail: JSON.parse(customEvent.Detail),
          time: eventTime
        }, correlationId);
      }

      const result: EventProcessorResponse = {
        eventId,
        eventType: request.eventType,
        tenantId: request.tenantId,
        status: 'TRIGGERED',
        triggeredAt: eventTime,
        correlationId
      };

      logger.info('Event triggered successfully', {
        correlationId,
        eventId,
        eventType: request.eventType
      });

      return result;

    } catch (error) {
      logger.error('Error triggering event', {
        correlationId,
        eventType: request.eventType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new EventBridgeSchedulerError(
        `Failed to trigger event: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get event processing history
   */
  async getEventHistory(
    request: EventHistoryRequest,
    correlationId: string
  ): Promise<{ events: ComplianceEvent[]; nextToken?: string }> {
    try {
      logger.info('Getting event history', {
        correlationId,
        tenantId: request.tenantId,
        eventType: request.eventType
      });

      // In a real implementation, this would query DynamoDB or CloudWatch Logs
      // For now, return mock data
      const mockEvents: ComplianceEvent[] = [
        {
          eventId: 'event-1',
          eventType: 'scheduled-scan',
          tenantId: request.tenantId || 'demo-tenant',
          status: 'COMPLETED',
          triggeredAt: new Date(Date.now() - 3600000).toISOString(),
          completedAt: new Date(Date.now() - 3300000).toISOString(),
          source: 'aws.scheduler',
          correlationId: 'corr-1',
          result: {
            workflowExecutionArn: 'arn:aws:states:us-east-1:123456789012:execution:ComplianceScanWorkflow:scan-1',
            findingsCount: 15,
            status: 'SUCCEEDED'
          }
        },
        {
          eventId: 'event-2',
          eventType: 'resource-created',
          tenantId: request.tenantId || 'demo-tenant',
          status: 'COMPLETED',
          triggeredAt: new Date(Date.now() - 7200000).toISOString(),
          completedAt: new Date(Date.now() - 7000000).toISOString(),
          source: 'aws.s3',
          correlationId: 'corr-2',
          result: {
            resourceType: 'S3 Bucket',
            resourceId: 'my-new-bucket',
            complianceCheck: 'PASSED'
          }
        }
      ];

      // Apply filters
      let filteredEvents = mockEvents;
      
      if (request.eventType) {
        filteredEvents = filteredEvents.filter(e => e.eventType === request.eventType);
      }

      // Apply limit
      const limitedEvents = filteredEvents.slice(0, request.limit || 50);

      logger.info('Event history retrieved', {
        correlationId,
        eventCount: limitedEvents.length
      });

      return {
        events: limitedEvents
      };

    } catch (error) {
      logger.error('Error getting event history', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new EventBridgeSchedulerError(
        `Failed to get event history: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle scheduled events from EventBridge Scheduler
   */
  private async handleScheduledEvent(event: any, correlationId: string): Promise<void> {
    logger.info('Handling scheduled event', {
      correlationId,
      detailType: event['detail-type']
    });

    // Extract schedule information from event
    const scheduleInfo = event.detail;
    
    // Trigger appropriate workflow based on schedule type
    if (scheduleInfo.workflowType) {
      await this.triggerWorkflow(scheduleInfo.workflowType, scheduleInfo, correlationId);
    }
  }

  /**
   * Handle S3 events (bucket creation, policy changes, etc.)
   */
  private async handleS3Event(event: any, correlationId: string): Promise<void> {
    logger.info('Handling S3 event', {
      correlationId,
      detailType: event['detail-type'],
      bucketName: event.detail?.bucket?.name
    });

    switch (event['detail-type']) {
      case 'S3 Bucket Created':
      case 'S3 Bucket Policy Changed':
        // Trigger compliance check for the bucket
        await this.triggerComplianceCheck('s3-bucket-check', {
          bucketName: event.detail.bucket.name,
          eventType: event['detail-type']
        }, correlationId);
        break;
      
      default:
        logger.debug('Unhandled S3 event type', {
          correlationId,
          detailType: event['detail-type']
        });
    }
  }

  /**
   * Handle IAM events (user creation, policy changes, etc.)
   */
  private async handleIAMEvent(event: any, correlationId: string): Promise<void> {
    logger.info('Handling IAM event', {
      correlationId,
      detailType: event['detail-type']
    });

    switch (event['detail-type']) {
      case 'IAM User Created':
      case 'IAM Role Created':
      case 'IAM Policy Changed':
        // Trigger IAM compliance check
        await this.triggerComplianceCheck('iam-compliance-check', {
          resourceArn: event.detail.resourceArn,
          eventType: event['detail-type']
        }, correlationId);
        break;
      
      default:
        logger.debug('Unhandled IAM event type', {
          correlationId,
          detailType: event['detail-type']
        });
    }
  }

  /**
   * Handle EC2 events (instance launch, security group changes, etc.)
   */
  private async handleEC2Event(event: any, correlationId: string): Promise<void> {
    logger.info('Handling EC2 event', {
      correlationId,
      detailType: event['detail-type']
    });

    switch (event['detail-type']) {
      case 'EC2 Instance State-change Notification':
        if (event.detail.state === 'running') {
          // Trigger security group compliance check for new instances
          await this.triggerComplianceCheck('ec2-security-check', {
            instanceId: event.detail['instance-id'],
            eventType: event['detail-type']
          }, correlationId);
        }
        break;
      
      case 'Security Group Rule Changed':
        // Trigger security group compliance check
        await this.triggerComplianceCheck('security-group-check', {
          groupId: event.detail.groupId,
          eventType: event['detail-type']
        }, correlationId);
        break;
      
      default:
        logger.debug('Unhandled EC2 event type', {
          correlationId,
          detailType: event['detail-type']
        });
    }
  }

  /**
   * Handle custom compliance events
   */
  private async handleComplianceEvent(event: any, correlationId: string): Promise<void> {
    logger.info('Handling compliance event', {
      correlationId,
      detailType: event['detail-type']
    });

    const eventData = event.detail;

    switch (event['detail-type']) {
      case 'manual-scan':
        await this.triggerWorkflow('compliance-scan', eventData, correlationId);
        break;
      
      case 'manual-remediation':
        await this.triggerWorkflow('remediation', eventData, correlationId);
        break;
      
      case 'compliance-violation-detected':
        await this.handleComplianceViolation(eventData, correlationId);
        break;
      
      default:
        logger.debug('Unhandled compliance event type', {
          correlationId,
          detailType: event['detail-type']
        });
    }
  }

  /**
   * Trigger a Step Functions workflow
   */
  private async triggerWorkflow(workflowType: string, parameters: any, correlationId: string): Promise<void> {
    try {
      if (!this.accountId) {
        const identity = await this.stsClient.send(new GetCallerIdentityCommand({}));
        this.accountId = identity.Account;
      }

      const stateMachineArn = `arn:aws:states:${this.region}:${this.accountId}:stateMachine:${this.getStateMachineName(workflowType)}`;
      
      const executionName = `${workflowType}-${Date.now()}-${uuidv4().substring(0, 8)}`;

      const command = new StartExecutionCommand({
        stateMachineArn,
        name: executionName,
        input: JSON.stringify({
          tenantId: parameters.tenantId,
          workflowType,
          parameters: parameters.parameters || parameters,
          metadata: {
            eventTriggered: true,
            triggeredAt: new Date().toISOString(),
            correlationId
          }
        })
      });

      const response = await this.sfnClient.send(command);

      logger.info('Workflow triggered successfully', {
        correlationId,
        workflowType,
        executionArn: response.executionArn
      });

    } catch (error) {
      logger.error('Error triggering workflow', {
        correlationId,
        workflowType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Trigger a compliance check
   */
  private async triggerComplianceCheck(checkType: string, parameters: any, correlationId: string): Promise<void> {
    try {
      const functionName = this.getComplianceCheckFunction(checkType);
      
      const command = new InvokeCommand({
        FunctionName: functionName,
        InvocationType: 'Event', // Asynchronous invocation
        Payload: JSON.stringify({
          checkType,
          parameters,
          eventTriggered: true,
          correlationId
        })
      });

      await this.lambdaClient.send(command);

      logger.info('Compliance check triggered', {
        correlationId,
        checkType,
        functionName
      });

    } catch (error) {
      logger.error('Error triggering compliance check', {
        correlationId,
        checkType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Handle compliance violations
   */
  private async handleComplianceViolation(eventData: any, correlationId: string): Promise<void> {
    const severity = eventData.severity || 'MEDIUM';
    
    // Trigger incident response workflow for high/critical violations
    if (['HIGH', 'CRITICAL'].includes(severity)) {
      await this.triggerWorkflow('incident-response', {
        tenantId: eventData.tenantId,
        parameters: {
          incidentType: 'compliance-violation',
          severity,
          findingId: eventData.findingId
        }
      }, correlationId);
    }

    // Send notification
    await this.sendNotification({
      subject: `Compliance Violation Detected - ${severity}`,
      message: `A ${severity} compliance violation has been detected: ${eventData.description}`,
      severity
    }, correlationId);
  }

  /**
   * Send notification
   */
  private async sendNotification(notification: any, correlationId: string): Promise<void> {
    try {
      if (!this.accountId) {
        const identity = await this.stsClient.send(new GetCallerIdentityCommand({}));
        this.accountId = identity.Account;
      }

      const topicArn = `arn:aws:sns:${this.region}:${this.accountId}:compliance-notifications`;

      const command = new PublishCommand({
        TopicArn: topicArn,
        Subject: notification.subject,
        Message: notification.message
      });

      await this.snsClient.send(command);

      logger.info('Notification sent', {
        correlationId,
        subject: notification.subject
      });

    } catch (error) {
      logger.warn('Failed to send notification', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Log event processing
   */
  private async logEventProcessing(
    event: any, 
    correlationId: string, 
    status: string, 
    error?: any
  ): Promise<void> {
    const logEntry = {
      eventId: uuidv4(),
      source: event.source,
      detailType: event['detail-type'],
      eventTime: event.time,
      status,
      correlationId,
      processedAt: new Date().toISOString(),
      ...(error && { error: error.message })
    };

    // In a real implementation, this would be stored in DynamoDB
    logger.info('Event processing logged', logEntry);
  }

  /**
   * Get state machine name for workflow type
   */
  private getStateMachineName(workflowType: string): string {
    const mapping: Record<string, string> = {
      'compliance-scan': 'ComplianceScanWorkflow',
      'remediation': 'RemediationWorkflow',
      'compliance-assessment': 'ComplianceAssessmentWorkflow',
      'incident-response': 'IncidentResponseWorkflow',
      'audit-pack-generation': 'AuditPackGenerationWorkflow',
      'continuous-monitoring': 'ContinuousMonitoringWorkflow'
    };

    return mapping[workflowType] || 'ComplianceScanWorkflow';
  }

  /**
   * Get compliance check function name
   */
  private getComplianceCheckFunction(checkType: string): string {
    const mapping: Record<string, string> = {
      's3-bucket-check': 'scan-environment',
      'iam-compliance-check': 'scan-environment',
      'ec2-security-check': 'scan-environment',
      'security-group-check': 'scan-environment'
    };

    return mapping[checkType] || 'scan-environment';
  }
}
