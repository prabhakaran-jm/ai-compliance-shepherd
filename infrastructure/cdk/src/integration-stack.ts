import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface IntegrationStackProps extends StackProps {
  config: {
    account: string;
    region: string;
    environment: string;
    stage: string;
    prefix: string;
  };
  lambdaStackName: string;
  securityStackName: string;
  description: string;
}

export class IntegrationStack extends Stack {
  public readonly integrationEventBus: events.EventBus;
  public readonly slackNotificationTopic: sns.Topic;
  public readonly githubWebhookQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: IntegrationStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Integration Event Bus
    this.integrationEventBus = new events.EventBus(this, 'IntegrationEventBus', {
      eventBusName: `${config.prefix}-integration-bus`,
    });

    // Slack Notification Topic
    this.slackNotificationTopic = new sns.Topic(this, 'SlackNotificationTopic', {
      topicName: `${config.prefix}-slack-notifications`,
      displayName: 'AI Compliance Shepherd Slack Notifications',
    });

    // GitHub Webhook Processing Queue
    this.githubWebhookQueue = new sqs.Queue(this, 'GitHubWebhookQueue', {
      queueName: `${config.prefix}-github-webhooks`,
      visibilityTimeout: cdk.Duration.minutes(6),
      retentionPeriod: cdk.Duration.days(14),
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'GitHubWebhookDLQ', {
          queueName: `${config.prefix}-github-webhooks-dlq`,
          retentionPeriod: cdk.Duration.days(14),
        }),
        maxReceiveCount: 3,
      },
    });

    // Step Functions State Machines for workflows
    const scanWorkflowStateMachine = this.createScanWorkflowStateMachine();
    const remediationWorkflowStateMachine = this.createRemediationWorkflowStateMachine();

    // EventBridge Rules for integrations
    
    // GitHub webhook processing rule
    const githubWebhookRule = new events.Rule(this, 'GitHubWebhookRule', {
      eventBus: this.integrationEventBus,
      ruleName: `${config.prefix}-github-webhook`,
      eventPattern: {
        source: ['github'],
        detailType: ['GitHub Webhook Event'],
      },
    });

    githubWebhookRule.addTarget(new targets.SqsQueue(this.githubWebhookQueue));

    // Slack notification rule
    const slackNotificationRule = new events.Rule(this, 'SlackNotificationRule', {
      eventBus: this.integrationEventBus,
      ruleName: `${config.prefix}-slack-notifications`,
      eventPattern: {
        source: ['ai-compliance-shepherd'],
        detailType: ['Scan Completed', 'Finding Detected', 'Remediation Applied'],
      },
    });

    slackNotificationRule.addTarget(new targets.SnsTopic(this.slackNotificationTopic));

    // Scan workflow triggering rule
    const scanWorkflowRule = new events.Rule(this, 'ScanWorkflowRule', {
      eventBus: this.integrationEventBus,
      ruleName: `${config.prefix}-scan-workflow`,
      eventPattern: {
        source: ['ai-compliance-shepherd'],
        detailType: ['Start Compliance Scan'],
      },
      schedule: events.Schedule.rate(cdk.Duration.hours(1)), // If scheduled
    });

    // Remediation workflow triggering rule
    const remediationWorkflowRule = new events.Rule(this, 'RemediationWorkflowRule', {
      eventBus: this.integrationEventBus,
      ruleName: `${config.prefix}-remediation-workflow`,
      eventPattern: {
        source: ['ai-comphasis-shepherd'],
        detailType: ['Start Remediation'],
      },
    });

    // Cross-Account Integration IAM Roles
    
    // Customer Integration Role (for customers to assume)
    const customerIntegrationRole = new iam.Role(this, 'CustomerIntegrationRole', {
      roleName: `${config.prefix}-customer-integration-role`,
      assumedBy: new iam.CompositePrincipal(
        new iam.AccountPrincipal(config.account),
        new iam.ServicePrincipal('organizations.amazonaws.com')
      ),
      inlinePolicies: {
        CustomerIntegrationPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'iam:PassRole',
                'sts:AssumeRole',
              ],
              resources: [
                `arn:aws:iam::*:role/${config.prefix}-scan-role`,
                `arn:aws:iam::*:role/${config.prefix}-remediation-role`,
              ],
              conditions: {
                'StringEquals': {
                  'aws:ResourceAccount': [config.account],
                },
              },
            }),
          ],
        }),
      },
    });

    // AWS Organization Trust Policy
    const orgTrustPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          principals: [
            new iam.AccountPrincipal(config.account),
            new iam.ArnPrincipal('*'),
          ],
          actions: ['sts:AssumeRole'],
          conditions: {
            'StringEquals': {
              'aws:PrincipalOrgID': '*', // Allow from any organization
            },
          },
        }),
      ],
    });

    // Third-Party Integration Configurations
    
    // GitHub Integration
    const githubIntegration = new events.Rule(this, 'GitHubIntegration', {
      eventBus: this.integrationEventBus,
      ruleName: `${config.prefix}-github-integration`,
      eventPattern: {
        source: ['github.com'],
        detailType: ['Pull Request Opened', 'Pull Request Updated', 'Push'],
      },
    });

    // Slack Integration
    const slackIntegration = new events.Rule(this, 'SlackIntegration', {
      eventBus: this.integrationEventBus,
      ruleName: `${config.prefix}-slack-integration`,
      eventPattern: {
        source: ['api.slack.com'],
        detailType: ['Message Received', 'Command Received'],
      },
    });

    // Marketplace Integration placeholder
    const marketplaceIntegration = new events.Rule(this, 'MarketplaceIntegration', {
      eventBus: this.integrationEventBus,
      ruleName: `${config.prefix}-marketplace-integration`,
      eventPattern: {
        source: ['aws.marketplace'],
        detailType: ['Subscription Notification', 'Entitlement Notification'],
      },
    });

    // Outputs
    new CfnOutput(this, 'IntegrationEventBusArn', {
      value: this.integrationEventBus.eventBusArn,
      description: 'Integration EventBus ARN'
    });

    new CfnOutput(this, 'SlackNotificationTopicArn', {
      value: this.slackNotificationTopic.topicArn,
      description: 'Slack Notification Topic ARN'
    });

    new CfnOutput(this, 'GitHubWebhookQueueUrl', {
      value: this.githubWebhookQueue.queueUrl,
      description: 'GitHub Webhook Queue URL'
    });

    new CfnOutput(this, 'CustomerIntegrationRoleArn', {
      value: customerIntegrationRole.roleArn,
      description: 'Customer Integration Role ARN'
    });

    new CfnOutput(this, 'StepFunctionsWorkflows', {
      value: JSON.stringify({
        scanWorkflow: 'TBD', // Will be updated with actual state machine ARN
        remediationWorkflow: 'TBD', // Will be updated with actual state machine ARN
      }),
      description: 'Step Functions Workflow ARNs'
    });

    new CfnOutput(this, 'IntegrationStackName', {
      value: this.stackName,
      description: 'Integration Stack Name'
    });
  }

  private createScanWorkflowStateMachine(): string {
    // Placeholder for Step Functions state machine
    // This would be implemented as a separate construct or imported from another stack
    return 'scan-workflow-placeholder';
  }

  private createRemediationWorkflowStateMachine(): string {
    // Placeholder for Step Functions state machine
    // This would be implemented as a separate construct or imported from another stack
    return 'remediation-workflow-placeholder';
  }

  public get stackName(): string {
    return this.stackName;
  }
}
