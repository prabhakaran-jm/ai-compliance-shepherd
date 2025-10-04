"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const sns = require("aws-cdk-lib/aws-sns");
const sqs = require("aws-cdk-lib/aws-sqs");
const events = require("aws-cdk-lib/aws-events");
const targets = require("aws-cdk-lib/aws-events-targets");
const iam = require("aws-cdk-lib/aws-iam");
class IntegrationStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
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
            assumedBy: new iam.CompositePrincipal(new iam.AccountPrincipal(config.account), new iam.ServicePrincipal('organizations.amazonaws.com')),
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
        new aws_cdk_lib_1.CfnOutput(this, 'IntegrationEventBusArn', {
            value: this.integrationEventBus.eventBusArn,
            description: 'Integration EventBus ARN'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'SlackNotificationTopicArn', {
            value: this.slackNotificationTopic.topicArn,
            description: 'Slack Notification Topic ARN'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'GitHubWebhookQueueUrl', {
            value: this.githubWebhookQueue.queueUrl,
            description: 'GitHub Webhook Queue URL'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'CustomerIntegrationRoleArn', {
            value: customerIntegrationRole.roleArn,
            description: 'Customer Integration Role ARN'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'StepFunctionsWorkflows', {
            value: JSON.stringify({
                scanWorkflow: 'TBD', // Will be updated with actual state machine ARN
                remediationWorkflow: 'TBD', // Will be updated with actual state machine ARN
            }),
            description: 'Step Functions Workflow ARNs'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'IntegrationStackName', {
            value: this.stackName,
            description: 'Integration Stack Name'
        });
    }
    createScanWorkflowStateMachine() {
        // Placeholder for Step Functions state machine
        // This would be implemented as a separate construct or imported from another stack
        return 'scan-workflow-placeholder';
    }
    createRemediationWorkflowStateMachine() {
        // Placeholder for Step Functions state machine
        // This would be implemented as a separate construct or imported from another stack
        return 'remediation-workflow-placeholder';
    }
    get stackName() {
        return this.stackName;
    }
}
exports.IntegrationStack = IntegrationStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZWdyYXRpb24tc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW50ZWdyYXRpb24tc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsNkNBQTJEO0FBQzNELDJDQUEyQztBQUMzQywyQ0FBMkM7QUFDM0MsaURBQWlEO0FBQ2pELDBEQUEwRDtBQUcxRCwyQ0FBMkM7QUFnQjNDLE1BQWEsZ0JBQWlCLFNBQVEsbUJBQUs7SUFLekMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE0QjtRQUNwRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRXpCLHdCQUF3QjtRQUN4QixJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUMxRSxZQUFZLEVBQUUsR0FBRyxNQUFNLENBQUMsTUFBTSxrQkFBa0I7U0FDakQsQ0FBQyxDQUFDO1FBRUgsMkJBQTJCO1FBQzNCLElBQUksQ0FBQyxzQkFBc0IsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLHdCQUF3QixFQUFFO1lBQzFFLFNBQVMsRUFBRSxHQUFHLE1BQU0sQ0FBQyxNQUFNLHNCQUFzQjtZQUNqRCxXQUFXLEVBQUUsNENBQTRDO1NBQzFELENBQUMsQ0FBQztRQUVILGtDQUFrQztRQUNsQyxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUNsRSxTQUFTLEVBQUUsR0FBRyxNQUFNLENBQUMsTUFBTSxrQkFBa0I7WUFDN0MsaUJBQWlCLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQzFDLGVBQWUsRUFBRSxHQUFHLENBQUMsUUFBUSxD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QztJQUVPLDhCQUE4QjtRQUNwQywrQ0FBK0M7UUFDL0MsbUZBQW1GO1FBQ25GLE9BQU8sMkJBQTJCLENBQUM7SUFDckMsQ0FBQztJQUVPLHFDQUFxQztRQUMzQywrQ0FBK0M7UUFDL0MsbUZBQW1GO1FBQ25GLE9BQU8sa0NBQWtDLENBQUM7SUFDNUMsQ0FBQztJQUVELElBQVcsU0FBUztRQUNsQixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUM7SUFDeEIsQ0FBQztDQUNGO0FBNU5ELDRDQTROQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFN0YWNrLCBTdGFja1Byb3BzLCBDZm5PdXRwdXQgfSBmcm9tICdhd3MtY2RrLWxpYic7XHJcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcclxuaW1wb3J0ICogYXMgc3FzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zcXMnO1xyXG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XHJcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcclxuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xyXG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcclxuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgSW50ZWdyYXRpb25TdGFja1Byb3BzIGV4dGVuZHMgU3RhY2tQcm9wcyB7XHJcbiAgY29uZmlnOiB7XHJcbiAgICBhY2NvdW50OiBzdHJpbmc7XHJcbiAgICByZWdpb246IHN0cmluZztcclxuICAgIGVudmlyb25tZW50OiBzdHJpbmc7XHJcbiAgICBzdGFnZTogc3RyaW5nO1xyXG4gICAgcHJlZml4OiBzdHJpbmc7XHJcbiAgfTtcclxuICBsYW1iZGFTdGFja05hbWU6IHN0cmluZztcclxuICBzZWN1cml0eVN0YWNrTmFtZTogc3RyaW5nO1xyXG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBJbnRlZ3JhdGlvblN0YWNrIGV4dGVuZHMgU3RhY2sge1xyXG4gIHB1YmxpYyByZWFkb25seSBpbnRlZ3JhdGlvbkV2ZW50QnVzOiBldmVudHMuRXZlbnRCdXM7XHJcbiAgcHVibGljIHJlYWRvbmx5IHNsYWNrTm90aWZpY2F0aW9uVG9waWM6IHNucy5Ub3BpYztcclxuICBwdWJsaWMgcmVhZG9ubHkgZ2l0aHViV2ViaG9va1F1ZXVlOiBzcXMuUXVldWU7XHJcblxyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBJbnRlZ3JhdGlvblN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIGNvbnN0IHsgY29uZmlnIH0gPSBwcm9wcztcclxuXHJcbiAgICAvLyBJbnRlZ3JhdGlvbiBFdmVudCBCdXNcclxuICAgIHRoaXMuaW50ZWdyYXRpb25FdmVudEJ1cyA9IG5ldyBldmVudHMuRXZlbnRCdXModGhpcywgJ0ludGVncmF0aW9uRXZlbnRCdXMnLCB7XHJcbiAgICAgIGV2ZW50QnVzTmFtZTogYCR7Y29uZmlnLnByZWZpeH0taW50ZWdyYXRpb24tYnVzYCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFNsYWNrIE5vdGlmaWNhdGlvbiBUb3BpY1xyXG4gICAgdGhpcy5zbGFja05vdGlmaWNhdGlvblRvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnU2xhY2tOb3RpZmljYXRpb25Ub3BpYycsIHtcclxuICAgICAgdG9waWNOYW1lOiBgJHtjb25maWcucHJlZml4fS1zbGFjay1ub3RpZmljYXRpb25zYCxcclxuICAgICAgZGlzcGxheU5hbWU6ICdBSSBDb21wbGlhbmNlIFNoZXBoZXJkIFNsYWNrIE5vdGlmaWNhdGlvbnMnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR2l0SHViIFdlYmhvb2sgUHJvY2Vzc2luZyBRdWV1ZVxyXG4gICAgdGhpcy5naXRodWJXZWJob29rUXVldWUgPSBuZXcgc3FzLlF1ZXVlKHRoaXMsICdHaXRIdWJXZWJob29rUXVldWUnLCB7XHJcbiAgICAgIHF1ZXVlTmFtZTogYCR7Y29uZmlnLnByZWZpeH0tZ2l0aHViLXdlYmhvb2tzYCxcclxuICAgICAgdmlzaWJpbGl0eVRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDYpLFxyXG4gICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDE0KSxcclxuICAgICAgZGVhZExldHRlclF1ZXVlOiB7XHJcbiAgICAgICAgcXVldWU6IG5ldyBzcXMuUXVldWUodGhpcywgJ0dpdEh1YldlYmhvb2tETFEnLCB7XHJcbiAgICAgICAgICBxdWV1ZU5hbWU6IGAke2NvbmZpZy5wcmVmaXh9LWdpdGh1Yi13ZWJob29rcy1kbHFgLFxyXG4gICAgICAgICAgcmV0ZW50aW9uUGVyaW9kOiBjZGsuRHVyYXRpb24uZGF5cygxNCksXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgbWF4UmVjZWl2ZUNvdW50OiAzLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU3RlcCBGdW5jdGlvbnMgU3RhdGUgTWFjaGluZXMgZm9yIHdvcmtmbG93c1xyXG4gICAgY29uc3Qgc2NhbldvcmtmbG93U3RhdGVNYWNoaW5lID0gdGhpcy5jcmVhdGVTY2FuV29ya2Zsb3dTdGF0ZU1hY2hpbmUoKTtcclxuICAgIGNvbnN0IHJlbWVkaWF0aW9uV29ya2Zsb3dTdGF0ZU1hY2hpbmUgPSB0aGlzLmNyZWF0ZVJlbWVkaWF0aW9uV29ya2Zsb3dTdGF0ZU1hY2hpbmUoKTtcclxuXHJcbiAgICAvLyBFdmVudEJyaWRnZSBSdWxlcyBmb3IgaW50ZWdyYXRpb25zXHJcbiAgICBcclxuICAgIC8vIEdpdEh1YiB3ZWJob29rIHByb2Nlc3NpbmcgcnVsZVxyXG4gICAgY29uc3QgZ2l0aHViV2ViaG9va1J1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ0dpdEh1YldlYmhvb2tSdWxlJywge1xyXG4gICAgICBldmVudEJ1czogdGhpcy5pbnRlZ3JhdGlvbkV2ZW50QnVzLFxyXG4gICAgICBydWxlTmFtZTogYCR7Y29uZmlnLnByZWZpeH0tZ2l0aHViLXdlYmhvb2tgLFxyXG4gICAgICBldmVudFBhdHRlcm46IHtcclxuICAgICAgICBzb3VyY2U6IFsnZ2l0aHViJ10sXHJcbiAgICAgICAgZGV0YWlsVHlwZTogWydHaXRIdWIgV2ViaG9vayBFdmVudCddLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgZ2l0aHViV2ViaG9va1J1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLlNxc1F1ZXVlKHRoaXMuZ2l0aHViV2ViaG9va1F1ZXVlKSk7XHJcblxyXG4gICAgLy8gU2xhY2sgbm90aWZpY2F0aW9uIHJ1bGVcclxuICAgIGNvbnN0IHNsYWNrTm90aWZpY2F0aW9uUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnU2xhY2tOb3RpZmljYXRpb25SdWxlJywge1xyXG4gICAgICBldmVudEJ1czogdGhpcy5pbnRlZ3JhdGlvbkV2ZW50QnVzLFxyXG4gICAgICBydWxlTmFtZTogYCR7Y29uZmlnLnByZWZpeH0tc2xhY2stbm90aWZpY2F0aW9uc2AsXHJcbiAgICAgIGV2ZW50UGF0dGVybjoge1xyXG4gICAgICAgIHNvdXJjZTogWydhaS1jb21wbGlhbmNlLXNoZXBoZXJkJ10sXHJcbiAgICAgICAgZGV0YWlsVHlwZTogWydTY2FuIENvbXBsZXRlZCcsICdGaW5kaW5nIERldGVjdGVkJywgJ1JlbWVkaWF0aW9uIEFwcGxpZWQnXSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIHNsYWNrTm90aWZpY2F0aW9uUnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuU25zVG9waWModGhpcy5zbGFja05vdGlmaWNhdGlvblRvcGljKSk7XHJcblxyXG4gICAgLy8gU2NhbiB3b3JrZmxvdyB0cmlnZ2VyaW5nIHJ1bGVcclxuICAgIGNvbnN0IHNjYW5Xb3JrZmxvd1J1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1NjYW5Xb3JrZmxvd1J1bGUnLCB7XHJcbiAgICAgIGV2ZW50QnVzOiB0aGlzLmludGVncmF0aW9uRXZlbnRCdXMsXHJcbiAgICAgIHJ1bGVOYW1lOiBgJHtjb25maWcucHJlZml4fS1zY2FuLXdvcmtmbG93YCxcclxuICAgICAgZXZlbnRQYXR0ZXJuOiB7XHJcbiAgICAgICAgc291cmNlOiBbJ2FpLWNvbXBsaWFuY2Utc2hlcGhlcmQnXSxcclxuICAgICAgICBkZXRhaWxUeXBlOiBbJ1N0YXJ0IENvbXBsaWFuY2UgU2NhbiddLFxyXG4gICAgICB9LFxyXG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLnJhdGUoY2RrLkR1cmF0aW9uLmhvdXJzKDEpKSwgLy8gSWYgc2NoZWR1bGVkXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBSZW1lZGlhdGlvbiB3b3JrZmxvdyB0cmlnZ2VyaW5nIHJ1bGVcclxuICAgIGNvbnN0IHJlbWVkaWF0aW9uV29ya2Zsb3dSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdSZW1lZGlhdGlvbldvcmtmbG93UnVsZScsIHtcclxuICAgICAgZXZlbnRCdXM6IHRoaXMuaW50ZWdyYXRpb25FdmVudEJ1cyxcclxuICAgICAgcnVsZU5hbWU6IGAke2NvbmZpZy5wcmVmaXh9LXJlbWVkaWF0aW9uLXdvcmtmbG93YCxcclxuICAgICAgZXZlbnRQYXR0ZXJuOiB7XHJcbiAgICAgICAgc291cmNlOiBbJ2FpLWNvbXBoYXNpcy1zaGVwaGVyZCddLFxyXG4gICAgICAgIGRldGFpbFR5cGU6IFsnU3RhcnQgUmVtZWRpYXRpb24nXSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENyb3NzLUFjY291bnQgSW50ZWdyYXRpb24gSUFNIFJvbGVzXHJcbiAgICBcclxuICAgIC8vIEN1c3RvbWVyIEludGVncmF0aW9uIFJvbGUgKGZvciBjdXN0b21lcnMgdG8gYXNzdW1lKVxyXG4gICAgY29uc3QgY3VzdG9tZXJJbnRlZ3JhdGlvblJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0N1c3RvbWVySW50ZWdyYXRpb25Sb2xlJywge1xyXG4gICAgICByb2xlTmFtZTogYCR7Y29uZmlnLnByZWZpeH0tY3VzdG9tZXItaW50ZWdyYXRpb24tcm9sZWAsXHJcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5Db21wb3NpdGVQcmluY2lwYWwoXHJcbiAgICAgICAgbmV3IGlhbS5BY2NvdW50UHJpbmNpcGFsKGNvbmZpZy5hY2NvdW50KSxcclxuICAgICAgICBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ29yZ2FuaXphdGlvbnMuYW1hem9uYXdzLmNvbScpXHJcbiAgICAgICksXHJcbiAgICAgIGlubGluZVBvbGljaWVzOiB7XHJcbiAgICAgICAgQ3VzdG9tZXJJbnRlZ3JhdGlvblBvbGljeTogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XHJcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXHJcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXHJcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICAgICAgICAgJ2lhbTpQYXNzUm9sZScsXHJcbiAgICAgICAgICAgICAgICAnc3RzOkFzc3VtZVJvbGUnLFxyXG4gICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXHJcbiAgICAgICAgICAgICAgICBgYXJuOmF3czppYW06Oio6cm9sZS8ke2NvbmZpZy5wcmVmaXh9LXNjYW4tcm9sZWAsXHJcbiAgICAgICAgICAgICAgICBgYXJuOmF3czppYW06Oio6cm9sZS8ke2NvbmZpZy5wcmVmaXh9LXJlbWVkaWF0aW9uLXJvbGVgLFxyXG4gICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgICAgY29uZGl0aW9uczoge1xyXG4gICAgICAgICAgICAgICAgJ1N0cmluZ0VxdWFscyc6IHtcclxuICAgICAgICAgICAgICAgICAgJ2F3czpSZXNvdXJjZUFjY291bnQnOiBbY29uZmlnLmFjY291bnRdLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgfSksXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBV1MgT3JnYW5pemF0aW9uIFRydXN0IFBvbGljeVxyXG4gICAgY29uc3Qgb3JnVHJ1c3RQb2xpY3kgPSBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcclxuICAgICAgc3RhdGVtZW50czogW1xyXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcclxuICAgICAgICAgIHByaW5jaXBhbHM6IFtcclxuICAgICAgICAgICAgbmV3IGlhbS5BY2NvdW50UHJpbmNpcGFsKGNvbmZpZy5hY2NvdW50KSxcclxuICAgICAgICAgICAgbmV3IGlhbS5Bcm5QcmluY2lwYWwoJyonKSxcclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgICBhY3Rpb25zOiBbJ3N0czpBc3N1bWVSb2xlJ10sXHJcbiAgICAgICAgICBjb25kaXRpb25zOiB7XHJcbiAgICAgICAgICAgICdTdHJpbmdFcXVhbHMnOiB7XHJcbiAgICAgICAgICAgICAgJ2F3czpQcmluY2lwYWxPcmdJRCc6ICcqJywgLy8gQWxsb3cgZnJvbSBhbnkgb3JnYW5pemF0aW9uXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0pLFxyXG4gICAgICBdLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gVGhpcmQtUGFydHkgSW50ZWdyYXRpb24gQ29uZmlndXJhdGlvbnNcclxuICAgIFxyXG4gICAgLy8gR2l0SHViIEludGVncmF0aW9uXHJcbiAgICBjb25zdCBnaXRodWJJbnRlZ3JhdGlvbiA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnR2l0SHViSW50ZWdyYXRpb24nLCB7XHJcbiAgICAgIGV2ZW50QnVzOiB0aGlzLmludGVncmF0aW9uRXZlbnRCdXMsXHJcbiAgICAgIHJ1bGVOYW1lOiBgJHtjb25maWcucHJlZml4fS1naXRodWItaW50ZWdyYXRpb25gLFxyXG4gICAgICBldmVudFBhdHRlcm46IHtcclxuICAgICAgICBzb3VyY2U6IFsnZ2l0aHViLmNvbSddLFxyXG4gICAgICAgIGRldGFpbFR5cGU6IFsnUHVsbCBSZXF1ZXN0IE9wZW5lZCcsICdQdWxsIFJlcXVlc3QgVXBkYXRlZCcsICdQdXNoJ10sXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTbGFjayBJbnRlZ3JhdGlvblxyXG4gICAgY29uc3Qgc2xhY2tJbnRlZ3JhdGlvbiA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnU2xhY2tJbnRlZ3JhdGlvbicsIHtcclxuICAgICAgZXZlbnRCdXM6IHRoaXMuaW50ZWdyYXRpb25FdmVudEJ1cyxcclxuICAgICAgcnVsZU5hbWU6IGAke2NvbmZpZy5wcmVmaXh9LXNsYWNrLWludGVncmF0aW9uYCxcclxuICAgICAgZXZlbnRQYXR0ZXJuOiB7XHJcbiAgICAgICAgc291cmNlOiBbJ2FwaS5zbGFjay5jb20nXSxcclxuICAgICAgICBkZXRhaWxUeXBlOiBbJ01lc3NhZ2UgUmVjZWl2ZWQnLCAnQ29tbWFuZCBSZWNlaXZlZCddLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gTWFya2V0cGxhY2UgSW50ZWdyYXRpb24gcGxhY2Vob2xkZXJcclxuICAgIGNvbnN0IG1hcmtldHBsYWNlSW50ZWdyYXRpb24gPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ01hcmtldHBsYWNlSW50ZWdyYXRpb24nLCB7XHJcbiAgICAgIGV2ZW50QnVzOiB0aGlzLmludGVncmF0aW9uRXZlbnRCdXMsXHJcbiAgICAgIHJ1bGVOYW1lOiBgJHtjb25maWcucHJlZml4fS1tYXJrZXRwbGFjZS1pbnRlZ3JhdGlvbmAsXHJcbiAgICAgIGV2ZW50UGF0dGVybjoge1xyXG4gICAgICAgIHNvdXJjZTogWydhd3MubWFya2V0cGxhY2UnXSxcclxuICAgICAgICBkZXRhaWxUeXBlOiBbJ1N1YnNjcmlwdGlvbiBOb3RpZmljYXRpb24nLCAnRW50aXRsZW1lbnQgTm90aWZpY2F0aW9uJ10sXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBPdXRwdXRzXHJcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdJbnRlZ3JhdGlvbkV2ZW50QnVzQXJuJywge1xyXG4gICAgICB2YWx1ZTogdGhpcy5pbnRlZ3JhdGlvbkV2ZW50QnVzLmV2ZW50QnVzQXJuLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0ludGVncmF0aW9uIEV2ZW50QnVzIEFSTidcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ1NsYWNrTm90aWZpY2F0aW9uVG9waWNBcm4nLCB7XHJcbiAgICAgIHZhbHVlOiB0aGlzLnNsYWNrTm90aWZpY2F0aW9uVG9waWMudG9waWNBcm4sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2xhY2sgTm90aWZpY2F0aW9uIFRvcGljIEFSTidcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ0dpdEh1YldlYmhvb2tRdWV1ZVVybCcsIHtcclxuICAgICAgdmFsdWU6IHRoaXMuZ2l0aHViV2ViaG9va1F1ZXVlLnF1ZXVlVXJsLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0dpdEh1YiBXZWJob29rIFF1ZXVlIFVSTCdcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ0N1c3RvbWVySW50ZWdyYXRpb25Sb2xlQXJuJywge1xyXG4gICAgICB2YWx1ZTogY3VzdG9tZXJJbnRlZ3JhdGlvblJvbGUucm9sZUFybixcclxuICAgICAgZGVzY3JpcHRpb246ICdDdXN0b21lciBJbnRlZ3JhdGlvbiBSb2xlIEFSTidcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ1N0ZXBGdW5jdGlvbnNXb3JrZmxvd3MnLCB7XHJcbiAgICAgIHZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgc2NhbldvcmtmbG93OiAnVEJEJywgLy8gV2lsbCBiZSB1cGRhdGVkIHdpdGggYWN0dWFsIHN0YXRlIG1hY2hpbmUgQVJOXHJcbiAgICAgICAgcmVtZWRpYXRpb25Xb3JrZmxvdzogJ1RCRCcsIC8vIFdpbGwgYmUgdXBkYXRlZCB3aXRoIGFjdHVhbCBzdGF0ZSBtYWNoaW5lIEFSTlxyXG4gICAgICB9KSxcclxuICAgICAgZGVzY3JpcHRpb246ICdTdGVwIEZ1bmN0aW9ucyBXb3JrZmxvdyBBUk5zJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnSW50ZWdyYXRpb25TdGFja05hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiB0aGlzLnN0YWNrTmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246ICdJbnRlZ3JhdGlvbiBTdGFjayBOYW1lJ1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNyZWF0ZVNjYW5Xb3JrZmxvd1N0YXRlTWFjaGluZSgpOiBzdHJpbmcge1xyXG4gICAgLy8gUGxhY2Vob2xkZXIgZm9yIFN0ZXAgRnVuY3Rpb25zIHN0YXRlIG1hY2hpbmVcclxuICAgIC8vIFRoaXMgd291bGQgYmUgaW1wbGVtZW50ZWQgYXMgYSBzZXBhcmF0ZSBjb25zdHJ1Y3Qgb3IgaW1wb3J0ZWQgZnJvbSBhbm90aGVyIHN0YWNrXHJcbiAgICByZXR1cm4gJ3NjYW4td29ya2Zsb3ctcGxhY2Vob2xkZXInO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjcmVhdGVSZW1lZGlhdGlvbldvcmtmbG93U3RhdGVNYWNoaW5lKCk6IHN0cmluZyB7XHJcbiAgICAvLyBQbGFjZWhvbGRlciBmb3IgU3RlcCBGdW5jdGlvbnMgc3RhdGUgbWFjaGluZVxyXG4gICAgLy8gVGhpcyB3b3VsZCBiZSBpbXBsZW1lbnRlZCBhcyBhIHNlcGFyYXRlIGNvbnN0cnVjdCBvciBpbXBvcnRlZCBmcm9tIGFub3RoZXIgc3RhY2tcclxuICAgIHJldHVybiAncmVtZWRpYXRpb24td29ya2Zsb3ctcGxhY2Vob2xkZXInO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBzdGFja05hbWUoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB0aGlzLnN0YWNrTmFtZTtcclxuICB9XHJcbn1cclxuIl19