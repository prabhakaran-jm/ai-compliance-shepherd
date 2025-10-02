#!/usr/bin/env node

/**
 * Deployment script for EventBridge Scheduler
 * Sets up EventBridge rules, IAM roles, and default schedules
 */

const {
  EventBridgeClient,
  CreateEventBusCommand,
  PutRuleCommand,
  PutTargetsCommand,
  ListRulesCommand
} = require('@aws-sdk/client-eventbridge');

const {
  SchedulerClient,
  CreateScheduleGroupCommand,
  ListScheduleGroupsCommand
} = require('@aws-sdk/client-scheduler');

const {
  IAMClient,
  CreateRoleCommand,
  AttachRolePolicyCommand,
  PutRolePolicyCommand,
  GetRoleCommand
} = require('@aws-sdk/client-iam');

const {
  SNSClient,
  CreateTopicCommand,
  GetTopicAttributesCommand
} = require('@aws-sdk/client-sns');

const region = process.env.AWS_REGION || 'us-east-1';
const accountId = process.env.AWS_ACCOUNT_ID;

if (!accountId) {
  console.error('AWS_ACCOUNT_ID environment variable is required');
  process.exit(1);
}

const eventBridgeClient = new EventBridgeClient({ region });
const schedulerClient = new SchedulerClient({ region });
const iamClient = new IAMClient({ region });
const snsClient = new SNSClient({ region });

/**
 * Main deployment function
 */
async function deploy() {
  console.log('🚀 Starting EventBridge Scheduler deployment...');
  
  try {
    // Step 1: Create IAM roles
    console.log('📋 Creating IAM roles...');
    await createIAMRoles();
    
    // Step 2: Create SNS topics
    console.log('📢 Creating SNS topics...');
    await createSNSTopics();
    
    // Step 3: Create EventBridge custom bus
    console.log('🚌 Creating EventBridge custom bus...');
    await createEventBridge();
    
    // Step 4: Create schedule group
    console.log('📅 Creating schedule group...');
    await createScheduleGroup();
    
    // Step 5: Create EventBridge rules
    console.log('📏 Creating EventBridge rules...');
    await createEventBridgeRules();
    
    // Step 6: Create default schedules
    console.log('⏰ Creating default schedules...');
    await createDefaultSchedules();
    
    console.log('✅ EventBridge Scheduler deployment completed successfully!');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

/**
 * Create IAM roles for EventBridge Scheduler
 */
async function createIAMRoles() {
  const roles = [
    {
      name: 'EventBridgeSchedulerRole',
      description: 'Role for EventBridge Scheduler to invoke targets',
      assumeRolePolicy: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'scheduler.amazonaws.com'
            },
            Action: 'sts:AssumeRole'
          }
        ]
      },
      policies: [
        {
          name: 'EventBridgeSchedulerPolicy',
          policy: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'states:StartExecution',
                  'lambda:InvokeFunction',
                  'sns:Publish'
                ],
                Resource: [
                  `arn:aws:states:${region}:${accountId}:stateMachine:*`,
                  `arn:aws:lambda:${region}:${accountId}:function:*`,
                  `arn:aws:sns:${region}:${accountId}:*`
                ]
              }
            ]
          }
        }
      ]
    },
    {
      name: 'EventBridgeRuleRole',
      description: 'Role for EventBridge rules to invoke targets',
      assumeRolePolicy: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'events.amazonaws.com'
            },
            Action: 'sts:AssumeRole'
          }
        ]
      },
      policies: [
        {
          name: 'EventBridgeRulePolicy',
          policy: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'lambda:InvokeFunction',
                  'sns:Publish',
                  'sqs:SendMessage'
                ],
                Resource: [
                  `arn:aws:lambda:${region}:${accountId}:function:*`,
                  `arn:aws:sns:${region}:${accountId}:*`,
                  `arn:aws:sqs:${region}:${accountId}:*`
                ]
              }
            ]
          }
        }
      ]
    }
  ];

  for (const roleConfig of roles) {
    try {
      // Check if role exists
      await iamClient.send(new GetRoleCommand({ RoleName: roleConfig.name }));
      console.log(`  ✓ Role ${roleConfig.name} already exists`);
    } catch (error) {
      if (error.name === 'NoSuchEntity') {
        // Create role
        await iamClient.send(new CreateRoleCommand({
          RoleName: roleConfig.name,
          AssumeRolePolicyDocument: JSON.stringify(roleConfig.assumeRolePolicy),
          Description: roleConfig.description
        }));
        
        // Attach policies
        for (const policyConfig of roleConfig.policies) {
          await iamClient.send(new PutRolePolicyCommand({
            RoleName: roleConfig.name,
            PolicyName: policyConfig.name,
            PolicyDocument: JSON.stringify(policyConfig.policy)
          }));
        }
        
        console.log(`  ✓ Created role ${roleConfig.name}`);
      } else {
        throw error;
      }
    }
  }
}

/**
 * Create SNS topics for notifications
 */
async function createSNSTopics() {
  const topics = [
    {
      name: 'compliance-notifications',
      displayName: 'Compliance Notifications'
    },
    {
      name: 'schedule-alerts',
      displayName: 'Schedule Alerts'
    },
    {
      name: 'event-processing-alerts',
      displayName: 'Event Processing Alerts'
    }
  ];

  for (const topicConfig of topics) {
    try {
      const topicArn = `arn:aws:sns:${region}:${accountId}:${topicConfig.name}`;
      
      // Check if topic exists
      await snsClient.send(new GetTopicAttributesCommand({ TopicArn: topicArn }));
      console.log(`  ✓ SNS topic ${topicConfig.name} already exists`);
    } catch (error) {
      if (error.name === 'NotFound') {
        // Create topic
        const response = await snsClient.send(new CreateTopicCommand({
          Name: topicConfig.name,
          Attributes: {
            DisplayName: topicConfig.displayName
          }
        }));
        
        console.log(`  ✓ Created SNS topic ${topicConfig.name}`);
      } else {
        throw error;
      }
    }
  }
}

/**
 * Create EventBridge custom bus
 */
async function createEventBridge() {
  try {
    await eventBridgeClient.send(new CreateEventBusCommand({
      Name: 'compliance-events'
    }));
    console.log('  ✓ Created EventBridge custom bus: compliance-events');
  } catch (error) {
    if (error.name === 'ResourceAlreadyExistsException') {
      console.log('  ✓ EventBridge custom bus already exists');
    } else {
      throw error;
    }
  }
}

/**
 * Create schedule group
 */
async function createScheduleGroup() {
  try {
    // Check if group exists
    const response = await schedulerClient.send(new ListScheduleGroupsCommand({}));
    const existingGroup = response.ScheduleGroups?.find(group => group.Name === 'compliance-schedules');
    
    if (existingGroup) {
      console.log('  ✓ Schedule group already exists');
    } else {
      await schedulerClient.send(new CreateScheduleGroupCommand({
        Name: 'compliance-schedules',
        Description: 'Schedule group for compliance operations'
      }));
      console.log('  ✓ Created schedule group: compliance-schedules');
    }
  } catch (error) {
    if (error.name === 'ConflictException') {
      console.log('  ✓ Schedule group already exists');
    } else {
      throw error;
    }
  }
}

/**
 * Create EventBridge rules for AWS service events
 */
async function createEventBridgeRules() {
  const rules = [
    {
      name: 'S3BucketEvents',
      description: 'Capture S3 bucket creation and policy changes',
      eventPattern: {
        source: ['aws.s3'],
        'detail-type': [
          'S3 Bucket Created',
          'S3 Bucket Policy Changed',
          'S3 Bucket Encryption Changed'
        ]
      },
      targets: [
        {
          id: 'EventProcessorLambda',
          arn: `arn:aws:lambda:${region}:${accountId}:function:eventbridge-scheduler`,
          roleArn: `arn:aws:iam::${accountId}:role/EventBridgeRuleRole`
        }
      ]
    },
    {
      name: 'IAMEvents',
      description: 'Capture IAM user, role, and policy changes',
      eventPattern: {
        source: ['aws.iam'],
        'detail-type': [
          'IAM User Created',
          'IAM Role Created',
          'IAM Policy Changed',
          'IAM User Login'
        ]
      },
      targets: [
        {
          id: 'EventProcessorLambda',
          arn: `arn:aws:lambda:${region}:${accountId}:function:eventbridge-scheduler`,
          roleArn: `arn:aws:iam::${accountId}:role/EventBridgeRuleRole`
        }
      ]
    },
    {
      name: 'EC2Events',
      description: 'Capture EC2 instance and security group changes',
      eventPattern: {
        source: ['aws.ec2'],
        'detail-type': [
          'EC2 Instance State-change Notification',
          'Security Group Rule Changed',
          'VPC Created'
        ]
      },
      targets: [
        {
          id: 'EventProcessorLambda',
          arn: `arn:aws:lambda:${region}:${accountId}:function:eventbridge-scheduler`,
          roleArn: `arn:aws:iam::${accountId}:role/EventBridgeRuleRole`
        }
      ]
    },
    {
      name: 'ComplianceEvents',
      description: 'Capture custom compliance events',
      eventPattern: {
        source: ['compliance.shepherd'],
        'detail-type': [
          'manual-scan',
          'manual-remediation',
          'compliance-violation-detected',
          'remediation-completed'
        ]
      },
      targets: [
        {
          id: 'EventProcessorLambda',
          arn: `arn:aws:lambda:${region}:${accountId}:function:eventbridge-scheduler`,
          roleArn: `arn:aws:iam::${accountId}:role/EventBridgeRuleRole`
        }
      ]
    }
  ];

  for (const ruleConfig of rules) {
    try {
      // Create rule
      await eventBridgeClient.send(new PutRuleCommand({
        Name: ruleConfig.name,
        Description: ruleConfig.description,
        EventPattern: JSON.stringify(ruleConfig.eventPattern),
        State: 'ENABLED'
      }));

      // Add targets
      await eventBridgeClient.send(new PutTargetsCommand({
        Rule: ruleConfig.name,
        Targets: ruleConfig.targets.map((target, index) => ({
          Id: target.id,
          Arn: target.arn,
          RoleArn: target.roleArn
        }))
      }));

      console.log(`  ✓ Created EventBridge rule: ${ruleConfig.name}`);
    } catch (error) {
      console.warn(`  ⚠️ Failed to create rule ${ruleConfig.name}:`, error.message);
    }
  }
}

/**
 * Create default schedules
 */
async function createDefaultSchedules() {
  const defaultSchedules = [
    {
      name: 'DailyComplianceScan',
      description: 'Daily comprehensive compliance scan',
      scheduleExpression: 'cron(0 6 * * ? *)', // 6 AM UTC daily
      target: {
        Arn: `arn:aws:states:${region}:${accountId}:stateMachine:ComplianceScanWorkflow`,
        RoleArn: `arn:aws:iam::${accountId}:role/EventBridgeSchedulerRole`,
        SfnParameters: {
          Input: JSON.stringify({
            tenantId: 'default',
            workflowType: 'compliance-scan',
            parameters: {
              scanType: 'comprehensive',
              includeRecommendations: true
            },
            metadata: {
              scheduledExecution: true,
              scheduleType: 'daily-scan'
            }
          })
        }
      }
    },
    {
      name: 'WeeklyComplianceAssessment',
      description: 'Weekly compliance assessment with reporting',
      scheduleExpression: 'cron(0 8 ? * MON *)', // 8 AM UTC every Monday
      target: {
        Arn: `arn:aws:states:${region}:${accountId}:stateMachine:ComplianceAssessmentWorkflow`,
        RoleArn: `arn:aws:iam::${accountId}:role/EventBridgeSchedulerRole`,
        SfnParameters: {
          Input: JSON.stringify({
            tenantId: 'default',
            workflowType: 'compliance-assessment',
            parameters: {
              framework: 'SOC2',
              includeRecommendations: true,
              generateReport: true
            },
            metadata: {
              scheduledExecution: true,
              scheduleType: 'weekly-assessment'
            }
          })
        }
      }
    },
    {
      name: 'ContinuousMonitoring',
      description: 'Continuous monitoring every 4 hours',
      scheduleExpression: 'cron(0 */4 * * ? *)', // Every 4 hours
      target: {
        Arn: `arn:aws:states:${region}:${accountId}:stateMachine:ContinuousMonitoringWorkflow`,
        RoleArn: `arn:aws:iam::${accountId}:role/EventBridgeSchedulerRole`,
        SfnParameters: {
          Input: JSON.stringify({
            tenantId: 'default',
            workflowType: 'continuous-monitoring',
            parameters: {
              monitoringType: 'incremental',
              alertOnCritical: true
            },
            metadata: {
              scheduledExecution: true,
              scheduleType: 'continuous-monitoring'
            }
          })
        }
      }
    }
  ];

  console.log('  ℹ️ Default schedules would be created here in a real deployment');
  console.log('  ℹ️ Use the API to create schedules after Lambda functions are deployed');
  
  for (const schedule of defaultSchedules) {
    console.log(`  📋 Schedule template: ${schedule.name} - ${schedule.description}`);
  }
}

/**
 * Cleanup function for development
 */
async function cleanup() {
  console.log('🧹 Cleaning up EventBridge Scheduler resources...');
  
  try {
    // List and delete rules
    const rulesResponse = await eventBridgeClient.send(new ListRulesCommand({}));
    
    if (rulesResponse.Rules) {
      for (const rule of rulesResponse.Rules) {
        if (rule.Name && rule.Name.includes('compliance') || rule.Name.includes('Compliance')) {
          console.log(`  🗑️ Would delete rule: ${rule.Name}`);
        }
      }
    }
    
    console.log('✅ Cleanup completed (dry run)');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Handle command line arguments
const command = process.argv[2];

switch (command) {
  case 'deploy':
    deploy();
    break;
  case 'cleanup':
    cleanup();
    break;
  default:
    console.log('Usage: node deploy-schedules.js [deploy|cleanup]');
    console.log('');
    console.log('Commands:');
    console.log('  deploy  - Deploy EventBridge Scheduler resources');
    console.log('  cleanup - Clean up EventBridge Scheduler resources');
    process.exit(1);
}
