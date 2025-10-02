#!/usr/bin/env node

/**
 * Deployment script for Step Functions workflows
 * Creates state machines and configures IAM roles
 */

const {
  SFNClient,
  CreateStateMachineCommand,
  UpdateStateMachineCommand,
  DescribeStateMachineCommand
} = require('@aws-sdk/client-sfn');

const {
  IAMClient,
  CreateRoleCommand,
  AttachRolePolicyCommand,
  CreatePolicyCommand,
  GetRoleCommand
} = require('@aws-sdk/client-iam');

const {
  STSClient,
  GetCallerIdentityCommand
} = require('@aws-sdk/client-sts');

const { WorkflowDefinitionService } = require('../dist/services/WorkflowDefinitionService');

class WorkflowDeployer {
  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.sfnClient = new SFNClient({ region: this.region });
    this.iamClient = new IAMClient({ region: this.region });
    this.stsClient = new STSClient({ region: this.region });
    this.workflowDefinitionService = new WorkflowDefinitionService();
    this.accountId = null;
  }

  async deploy() {
    try {
      console.log('🚀 Starting Step Functions workflow deployment...');

      // Get AWS account ID
      const identity = await this.stsClient.send(new GetCallerIdentityCommand({}));
      this.accountId = identity.Account;
      console.log(`📋 AWS Account ID: ${this.accountId}`);

      // Create IAM role for Step Functions
      const roleArn = await this.createStepFunctionsRole();
      console.log(`🔐 Created IAM role: ${roleArn}`);

      // Wait for role propagation
      console.log('⏳ Waiting for IAM role propagation...');
      await this.sleep(10000);

      // Deploy all workflow definitions
      const definitions = this.workflowDefinitionService.getAllWorkflowDefinitions();
      const deployedWorkflows = [];

      for (const definition of definitions) {
        try {
          const stateMachineArn = await this.deployWorkflow(definition, roleArn);
          deployedWorkflows.push({
            workflowType: definition.workflowType,
            stateMachineName: definition.stateMachineName,
            stateMachineArn
          });
          console.log(`✅ Deployed workflow: ${definition.workflowType}`);
        } catch (error) {
          console.error(`❌ Failed to deploy workflow ${definition.workflowType}:`, error.message);
        }
      }

      // Save deployment configuration
      await this.saveDeploymentConfig(deployedWorkflows, roleArn);
      console.log(`💾 Deployment configuration saved`);

      console.log('\n🎉 Step Functions workflow deployment completed!');
      console.log(`\n📝 Deployed workflows:`);
      deployedWorkflows.forEach(workflow => {
        console.log(`   ${workflow.workflowType}: ${workflow.stateMachineArn}`);
      });

      console.log(`\n🔧 Set these environment variables:`);
      console.log(`   STEP_FUNCTIONS_ROLE_ARN=${roleArn}`);
      deployedWorkflows.forEach(workflow => {
        const envVar = `${workflow.workflowType.toUpperCase().replace(/-/g, '_')}_STATE_MACHINE_ARN`;
        console.log(`   ${envVar}=${workflow.stateMachineArn}`);
      });

    } catch (error) {
      console.error('❌ Deployment failed:', error.message);
      process.exit(1);
    }
  }

  async createStepFunctionsRole() {
    const roleName = 'StepFunctionsExecutionRole';
    
    try {
      // Check if role already exists
      await this.iamClient.send(new GetRoleCommand({ RoleName: roleName }));
      console.log(`🔐 IAM role ${roleName} already exists`);
      return `arn:aws:iam::${this.accountId}:role/${roleName}`;
    } catch (error) {
      if (error.name !== 'NoSuchEntityException') {
        throw error;
      }
    }

    // Trust policy for Step Functions
    const trustPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: 'states.amazonaws.com'
          },
          Action: 'sts:AssumeRole'
        }
      ]
    };

    // Create the role
    const createRoleCommand = new CreateRoleCommand({
      RoleName: roleName,
      AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
      Description: 'IAM role for AI Compliance Shepherd Step Functions'
    });

    const roleResult = await this.iamClient.send(createRoleCommand);

    // Create and attach custom policy
    const policyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'lambda:InvokeFunction'
          ],
          Resource: [
            `arn:aws:lambda:${this.region}:${this.accountId}:function:scan-environment*`,
            `arn:aws:lambda:${this.region}:${this.accountId}:function:findings-storage*`,
            `arn:aws:lambda:${this.region}:${this.accountId}:function:apply-fix*`,
            `arn:aws:lambda:${this.region}:${this.accountId}:function:html-report-generator*`,
            `arn:aws:lambda:${this.region}:${this.accountId}:function:analyze-terraform-plan*`,
            `arn:aws:lambda:${this.region}:${this.accountId}:function:bedrock-knowledge-base*`
          ]
        },
        {
          Effect: 'Allow',
          Action: [
            'sns:Publish'
          ],
          Resource: [
            `arn:aws:sns:${this.region}:${this.accountId}:*`
          ]
        },
        {
          Effect: 'Allow',
          Action: [
            'states:StartExecution',
            'states:DescribeExecution',
            'states:StopExecution'
          ],
          Resource: [
            `arn:aws:states:${this.region}:${this.accountId}:stateMachine:*`,
            `arn:aws:states:${this.region}:${this.accountId}:execution:*`
          ]
        },
        {
          Effect: 'Allow',
          Action: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents',
            'logs:DescribeLogGroups',
            'logs:DescribeLogStreams'
          ],
          Resource: [
            `arn:aws:logs:${this.region}:${this.accountId}:*`
          ]
        },
        {
          Effect: 'Allow',
          Action: [
            'xray:PutTraceSegments',
            'xray:PutTelemetryRecords'
          ],
          Resource: '*'
        }
      ]
    };

    const createPolicyCommand = new CreatePolicyCommand({
      PolicyName: 'StepFunctionsExecutionPolicy',
      PolicyDocument: JSON.stringify(policyDocument),
      Description: 'Policy for AI Compliance Shepherd Step Functions'
    });

    const policyResult = await this.iamClient.send(createPolicyCommand);

    // Attach policy to role
    const attachPolicyCommand = new AttachRolePolicyCommand({
      RoleName: roleName,
      PolicyArn: policyResult.Policy.Arn
    });

    await this.iamClient.send(attachPolicyCommand);

    return roleResult.Role.Arn;
  }

  async deployWorkflow(definition, roleArn) {
    const stateMachineName = definition.stateMachineName;
    
    // Replace placeholders in state machine definition
    const stateMachineDefinition = this.replacePlaceholders(definition.stateMachineDefinition);

    try {
      // Check if state machine already exists
      const describeCommand = new DescribeStateMachineCommand({
        stateMachineArn: `arn:aws:states:${this.region}:${this.accountId}:stateMachine:${stateMachineName}`
      });
      
      await this.sfnClient.send(describeCommand);
      
      // Update existing state machine
      const updateCommand = new UpdateStateMachineCommand({
        stateMachineArn: `arn:aws:states:${this.region}:${this.accountId}:stateMachine:${stateMachineName}`,
        definition: JSON.stringify(stateMachineDefinition),
        roleArn
      });

      await this.sfnClient.send(updateCommand);
      return `arn:aws:states:${this.region}:${this.accountId}:stateMachine:${stateMachineName}`;

    } catch (error) {
      if (error.name !== 'StateMachineDoesNotExist') {
        throw error;
      }

      // Create new state machine
      const createCommand = new CreateStateMachineCommand({
        name: stateMachineName,
        definition: JSON.stringify(stateMachineDefinition),
        roleArn,
        type: 'STANDARD',
        loggingConfiguration: {
          level: 'ERROR',
          includeExecutionData: false,
          destinations: [
            {
              cloudWatchLogsLogGroup: {
                logGroupArn: `arn:aws:logs:${this.region}:${this.accountId}:log-group:/aws/stepfunctions/${stateMachineName}`
              }
            }
          ]
        },
        tracingConfiguration: {
          enabled: true
        }
      });

      const response = await this.sfnClient.send(createCommand);
      return response.stateMachineArn;
    }
  }

  replacePlaceholders(definition) {
    let definitionStr = JSON.stringify(definition);
    
    // Replace Lambda ARN placeholders
    const lambdaReplacements = {
      '${ScanEnvironmentLambdaArn}': `arn:aws:lambda:${this.region}:${this.accountId}:function:scan-environment`,
      '${FindingsStorageLambdaArn}': `arn:aws:lambda:${this.region}:${this.accountId}:function:findings-storage`,
      '${ApplyFixLambdaArn}': `arn:aws:lambda:${this.region}:${this.accountId}:function:apply-fix`,
      '${HTMLReportGeneratorLambdaArn}': `arn:aws:lambda:${this.region}:${this.accountId}:function:html-report-generator`,
      '${AnalyzeTerraformPlanLambdaArn}': `arn:aws:lambda:${this.region}:${this.accountId}:function:analyze-terraform-plan`,
      '${BedrockKnowledgeBaseLambdaArn}': `arn:aws:lambda:${this.region}:${this.accountId}:function:bedrock-knowledge-base`
    };

    // Replace SNS topic ARN placeholders
    const snsReplacements = {
      '${NotificationTopicArn}': `arn:aws:sns:${this.region}:${this.accountId}:compliance-notifications`,
      '${CriticalIncidentTopicArn}': `arn:aws:sns:${this.region}:${this.accountId}:critical-incidents`,
      '${IncidentTopicArn}': `arn:aws:sns:${this.region}:${this.accountId}:incidents`
    };

    // Replace Step Functions ARN placeholders
    const stepFunctionsReplacements = {
      '${ComplianceScanWorkflowArn}': `arn:aws:states:${this.region}:${this.accountId}:stateMachine:ComplianceScanWorkflow`,
      '${RemediationWorkflowArn}': `arn:aws:states:${this.region}:${this.accountId}:stateMachine:RemediationWorkflow`,
      '${IncidentResponseWorkflowArn}': `arn:aws:states:${this.region}:${this.accountId}:stateMachine:IncidentResponseWorkflow`
    };

    // Apply all replacements
    const allReplacements = {
      ...lambdaReplacements,
      ...snsReplacements,
      ...stepFunctionsReplacements
    };

    for (const [placeholder, replacement] of Object.entries(allReplacements)) {
      definitionStr = definitionStr.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
    }

    return JSON.parse(definitionStr);
  }

  async saveDeploymentConfig(workflows, roleArn) {
    const config = {
      deployedAt: new Date().toISOString(),
      region: this.region,
      accountId: this.accountId,
      roleArn,
      workflows: workflows.reduce((acc, workflow) => {
        acc[workflow.workflowType] = {
          stateMachineName: workflow.stateMachineName,
          stateMachineArn: workflow.stateMachineArn
        };
        return acc;
      }, {})
    };

    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, '..', 'deployment-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run deployment if called directly
if (require.main === module) {
  const deployer = new WorkflowDeployer();
  deployer.deploy();
}

module.exports = WorkflowDeployer;
