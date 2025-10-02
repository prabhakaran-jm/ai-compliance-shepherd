import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { StepFunctionsClient, StartExecutionCommand } from '@aws-sdk/client-stepfunctions';
import { logger } from '../utils/logger';
import { ApprovalError } from '../utils/errorHandler';

export interface ApprovalRequest {
  remediationId: string;
  findingId: string;
  resourceId: string;
  remediationType: string;
  requestedBy: string;
  tenantId: string;
  safetyChecks: any;
  estimatedImpact: any;
}

export interface ApprovalNotification {
  type: 'EMAIL' | 'SLACK' | 'SNS' | 'STEP_FUNCTION';
  target: string;
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Manages approval workflows for high-risk remediations
 */
export class ApprovalWorkflow {
  private snsClient: SNSClient;
  private stepFunctionsClient: StepFunctionsClient;

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    this.snsClient = new SNSClient({ region });
    this.stepFunctionsClient = new StepFunctionsClient({ region });
  }

  /**
   * Request approval for remediation
   */
  async requestApproval(
    request: ApprovalRequest,
    correlationId: string
  ): Promise<void> {
    logger.info('Requesting remediation approval', {
      correlationId,
      remediationId: request.remediationId,
      resourceId: request.resourceId,
      remediationType: request.remediationType,
      requestedBy: request.requestedBy
    });

    try {
      // Determine approval requirements based on risk level
      const approvalRequirements = this.determineApprovalRequirements(request);
      
      // Send notifications to approvers
      const notifications = this.buildApprovalNotifications(request, approvalRequirements);
      
      for (const notification of notifications) {
        await this.sendNotification(notification, correlationId);
      }

      // Start approval workflow if Step Functions is configured
      if (process.env.APPROVAL_WORKFLOW_STATE_MACHINE_ARN) {
        await this.startApprovalWorkflow(request, correlationId);
      }

      logger.info('Approval request sent successfully', {
        correlationId,
        remediationId: request.remediationId,
        notificationsSent: notifications.length
      });

    } catch (error) {
      logger.error('Error requesting approval', {
        correlationId,
        remediationId: request.remediationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new ApprovalError('Failed to request approval', error);
    }
  }

  /**
   * Determine approval requirements based on risk assessment
   */
  private determineApprovalRequirements(request: ApprovalRequest): {
    approvers: string[];
    approvalCount: number;
    timeoutHours: number;
    escalationHours: number;
  } {
    const riskLevel = request.estimatedImpact?.riskLevel || 'MEDIUM';
    const isProduction = request.resourceId.toLowerCase().includes('prod');
    const hasFailedSafetyChecks = !request.safetyChecks?.passed;

    // Base requirements
    let approvers: string[] = [];
    let approvalCount = 1;
    let timeoutHours = 24;
    let escalationHours = 4;

    // Adjust based on risk level
    switch (riskLevel) {
      case 'CRITICAL':
        approvers = ['security-team', 'ops-manager', 'cto'];
        approvalCount = 2;
        timeoutHours = 4;
        escalationHours = 1;
        break;
      case 'HIGH':
        approvers = ['security-team', 'ops-manager'];
        approvalCount = 1;
        timeoutHours = 8;
        escalationHours = 2;
        break;
      case 'MEDIUM':
        approvers = ['ops-team'];
        approvalCount = 1;
        timeoutHours = 24;
        escalationHours = 4;
        break;
      case 'LOW':
        approvers = ['ops-team'];
        approvalCount = 1;
        timeoutHours = 48;
        escalationHours = 8;
        break;
    }

    // Additional approvers for production resources
    if (isProduction && !approvers.includes('ops-manager')) {
      approvers.push('ops-manager');
    }

    // Additional approvers for failed safety checks
    if (hasFailedSafetyChecks && !approvers.includes('security-team')) {
      approvers.push('security-team');
      approvalCount = Math.max(approvalCount, 1);
    }

    return {
      approvers,
      approvalCount,
      timeoutHours,
      escalationHours
    };
  }

  /**
   * Build approval notifications
   */
  private buildApprovalNotifications(
    request: ApprovalRequest,
    requirements: ReturnType<typeof this.determineApprovalRequirements>
  ): ApprovalNotification[] {
    const notifications: ApprovalNotification[] = [];

    // Build approval message
    const message = this.buildApprovalMessage(request);

    // SNS notifications to approval topics
    for (const approver of requirements.approvers) {
      const topicArn = process.env[`APPROVAL_TOPIC_${approver.toUpperCase().replace('-', '_')}`];
      if (topicArn) {
        notifications.push({
          type: 'SNS',
          target: topicArn,
          message,
          metadata: {
            remediationId: request.remediationId,
            approver,
            timeoutHours: requirements.timeoutHours
          }
        });
      }
    }

    // Slack notifications if configured
    const slackWebhook = process.env.SLACK_APPROVAL_WEBHOOK;
    if (slackWebhook) {
      notifications.push({
        type: 'SLACK',
        target: slackWebhook,
        message: this.buildSlackApprovalMessage(request),
        metadata: {
          remediationId: request.remediationId,
          channel: process.env.SLACK_APPROVAL_CHANNEL || '#compliance-approvals'
        }
      });
    }

    return notifications;
  }

  /**
   * Build approval message
   */
  private buildApprovalMessage(request: ApprovalRequest): string {
    const riskLevel = request.estimatedImpact?.riskLevel || 'UNKNOWN';
    const failedChecks = request.safetyChecks?.checks?.filter((c: any) => !c.passed) || [];
    
    let message = `🚨 REMEDIATION APPROVAL REQUIRED\n\n`;
    message += `Remediation ID: ${request.remediationId}\n`;
    message += `Finding ID: ${request.findingId}\n`;
    message += `Resource: ${request.resourceId}\n`;
    message += `Remediation Type: ${request.remediationType}\n`;
    message += `Requested By: ${request.requestedBy}\n`;
    message += `Risk Level: ${riskLevel}\n\n`;

    if (request.estimatedImpact) {
      message += `📊 ESTIMATED IMPACT:\n`;
      message += `• Affected Resources: ${request.estimatedImpact.affectedResources}\n`;
      message += `• Downtime Expected: ${request.estimatedImpact.downtime ? 'Yes' : 'No'}\n`;
      message += `• Cost Impact: $${request.estimatedImpact.costImpact}\n`;
      message += `• Description: ${request.estimatedImpact.description}\n\n`;
    }

    if (failedChecks.length > 0) {
      message += `⚠️ FAILED SAFETY CHECKS:\n`;
      for (const check of failedChecks) {
        message += `• ${check.name}: ${check.message} (${check.severity})\n`;
      }
      message += `\n`;
    }

    message += `To approve this remediation, reply with:\n`;
    message += `APPROVE ${request.remediationId}\n\n`;
    message += `To reject this remediation, reply with:\n`;
    message += `REJECT ${request.remediationId} [reason]\n\n`;
    message += `For more details, visit the compliance dashboard.`;

    return message;
  }

  /**
   * Build Slack approval message
   */
  private buildSlackApprovalMessage(request: ApprovalRequest): string {
    const riskLevel = request.estimatedImpact?.riskLevel || 'UNKNOWN';
    const riskEmoji = this.getRiskEmoji(riskLevel);
    
    return JSON.stringify({
      text: `${riskEmoji} Remediation Approval Required`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${riskEmoji} Remediation Approval Required`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Remediation ID:*\n${request.remediationId}`
            },
            {
              type: 'mrkdwn',
              text: `*Resource:*\n${request.resourceId}`
            },
            {
              type: 'mrkdwn',
              text: `*Type:*\n${request.remediationType}`
            },
            {
              type: 'mrkdwn',
              text: `*Risk Level:*\n${riskLevel}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Requested by:* ${request.requestedBy}\n*Finding ID:* ${request.findingId}`
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '✅ Approve'
              },
              style: 'primary',
              value: `approve_${request.remediationId}`,
              action_id: 'approve_remediation'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '❌ Reject'
              },
              style: 'danger',
              value: `reject_${request.remediationId}`,
              action_id: 'reject_remediation'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📋 View Details'
              },
              url: `${process.env.DASHBOARD_URL}/remediations/${request.remediationId}`,
              action_id: 'view_details'
            }
          ]
        }
      ]
    });
  }

  /**
   * Send notification
   */
  private async sendNotification(
    notification: ApprovalNotification,
    correlationId: string
  ): Promise<void> {
    try {
      switch (notification.type) {
        case 'SNS':
          await this.snsClient.send(new PublishCommand({
            TopicArn: notification.target,
            Message: notification.message,
            Subject: 'Remediation Approval Required',
            MessageAttributes: {
              remediationId: {
                DataType: 'String',
                StringValue: notification.metadata?.remediationId || ''
              },
              correlationId: {
                DataType: 'String',
                StringValue: correlationId
              }
            }
          }));
          break;

        case 'SLACK':
          // Would implement Slack webhook call here
          logger.info('Slack notification would be sent', {
            correlationId,
            webhook: notification.target,
            channel: notification.metadata?.channel
          });
          break;

        default:
          logger.warn('Unsupported notification type', {
            correlationId,
            type: notification.type
          });
      }

      logger.info('Notification sent successfully', {
        correlationId,
        type: notification.type,
        target: notification.target
      });

    } catch (error) {
      logger.error('Error sending notification', {
        correlationId,
        type: notification.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new ApprovalError(`Failed to send ${notification.type} notification`, error);
    }
  }

  /**
   * Start approval workflow using Step Functions
   */
  private async startApprovalWorkflow(
    request: ApprovalRequest,
    correlationId: string
  ): Promise<void> {
    try {
      const stateMachineArn = process.env.APPROVAL_WORKFLOW_STATE_MACHINE_ARN;
      if (!stateMachineArn) {
        logger.warn('Approval workflow state machine not configured', { correlationId });
        return;
      }

      const input = {
        remediationId: request.remediationId,
        findingId: request.findingId,
        resourceId: request.resourceId,
        remediationType: request.remediationType,
        requestedBy: request.requestedBy,
        tenantId: request.tenantId,
        safetyChecks: request.safetyChecks,
        estimatedImpact: request.estimatedImpact,
        correlationId
      };

      await this.stepFunctionsClient.send(new StartExecutionCommand({
        stateMachineArn,
        name: `approval-${request.remediationId}-${Date.now()}`,
        input: JSON.stringify(input)
      }));

      logger.info('Approval workflow started', {
        correlationId,
        remediationId: request.remediationId,
        stateMachineArn
      });

    } catch (error) {
      logger.error('Error starting approval workflow', {
        correlationId,
        remediationId: request.remediationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new ApprovalError('Failed to start approval workflow', error);
    }
  }

  /**
   * Get risk emoji for Slack messages
   */
  private getRiskEmoji(riskLevel: string): string {
    switch (riskLevel) {
      case 'CRITICAL': return '🔴';
      case 'HIGH': return '🟠';
      case 'MEDIUM': return '🟡';
      case 'LOW': return '🟢';
      default: return '⚪';
    }
  }

  /**
   * Process approval response (would be called by webhook or Step Functions)
   */
  async processApprovalResponse(
    remediationId: string,
    approved: boolean,
    approver: string,
    reason?: string,
    correlationId?: string
  ): Promise<void> {
    logger.info('Processing approval response', {
      correlationId,
      remediationId,
      approved,
      approver,
      reason
    });

    try {
      // This would typically update the remediation job status
      // and trigger the next step in the workflow
      
      // For now, just log the response
      logger.info('Approval response processed', {
        correlationId,
        remediationId,
        approved,
        approver,
        reason
      });

    } catch (error) {
      logger.error('Error processing approval response', {
        correlationId,
        remediationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new ApprovalError('Failed to process approval response', error);
    }
  }
}
