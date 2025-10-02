import { Stack, StackProps, CfnOutput, Duration } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface LambdaStackProps extends StackProps {
  config: {
    account: string;
    region: string;
    environment: string;
    stage: string;
    prefix: string;
  };
  databaseStackName: string;
  securityStackName: string;
  storageStackName: string;
  description: string;
}

export class LambdaStack extends Stack {
  // Core Service Lambdas
  public readonly scanEnvironmentFunction: lambda.Function;
  public readonly findingsStorageFunction: lambda.Function;
  public readonly apiGatewayFunction: lambda.Function;
  public readonly htmlReportGeneratorFunction: lambda.Function;
  public readonly s3BucketManagerFunction: lambda.Function;

  // Analysis Lambdas
  public readonly terraformAnalyzerFunction: lambda.Function;
  public readonly githubWebhookHandlerFunction: lambda.Function;
  public readonly applyFixFunction: lambda.Function;

  // AI Lambdas
  public readonly bedrockKnowledgeBaseFunction: lambda.Function;
  public readonly bedrockAgentFunction: lambda.Function;
  public readonly chatInterfaceFunction: lambda.Function;

  // Orchestration Lambdas
  public readonly stepFunctionsOrchestratorFunction: lambda.Function;
  public readonly eventbridgeSchedulerFunction: lambda.Function;
  public readonly tenantManagementFunction: lambda.Function;

  // Business Logic Lambdas
  public readonly auditPackGeneratorFunction: lambda.Function;
  public readonly slackNotificationsFunction: lambda.Function;
  public readonly webUIFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Environment variables for all Lambda functions
    const commonEnvVars = {
      NODE_ENV: config.environment,
      AWS_REGION: config.region,
      LOG_LEVEL: 'INFO',
      XRAY_TRACING_ENABLED: 'true',
      DEPLOYMENT_PREFIX: config.prefix,
    };

    // Create execution role for Lambda functions
    const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      roleName: `${config.prefix}-lambda-execution-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    // Add additional permissions for Lambda functions
    lambdaExecutionRole.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:*',
        's3:*',
        'kms:*',
        'cloudwatch:*',
        'logs:*',
        'xray:*',
        'states:*',
        'events:*',
        'lambda:InvokeFunction',
        'apigateway:*',
        'bedrock:*',
        'bedrockagent:*',
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:GetParametersByPath',
        'secretsmanager:GetSecretValue',
        'organizations:*',
        'sts:AssumeRole',
      ],
      resources: ['*'],
    }));

    // Scan Environment Function
    this.scanEnvironmentFunction = new lambdaNodeJs.NodejsFunction(this, 'ScanEnvironmentFunction', {
      functionName: `${config.prefix}-scan-environment`,
      entry: '../../../services/scan-environment/src/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      role: lambdaExecutionRole,
      timeout: Duration.minutes(15),
      memorySize: 2048,
      environment: {
        ...commonEnvVars,
        SCAN_TIMEOUT_MINUTES: '15',
        DISCOVERY_CONCURRENCY: '10',
      },
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    // Findings Storage Function
    this.findingsStorageFunction = new lambdaNodeJs.NodejsFunction(this, 'FindingsStorageFunction', {
      functionName: `${config.prefix}-findings-storage`,
      entry: '../../../services/findings-storage/src/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      role: lambdaExecutionRole,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      environment: commonEnvVars,
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    // API Gateway Function
    this.apiGatewayFunction = new lambdaNodeJs.NodejsFunction(this, 'ApiGatewayFunction', {
      functionName: `${config.prefix}-api-gateway`,
      entry: '../../../services/api-gateway/src/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      role: lambdaExecutionRole,
      timeout: Duration.seconds(30),
      memorySize: 1024,
      environment: commonEnvVars,
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    // HTML Report Generator Function
    this.htmlReportGeneratorFunction = new lambdaNodeJs.NodejsFunction(this, 'HTMLReportGeneratorFunction', {
      functionName: `${config.prefix}-html-report-generator`,
      entry: '../../../services/html-report-generator/src/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      role: lambdaExecutionRole,
      timeout: Duration.minutes(10),
      memorySize: 2048,
      environment: commonEnvVars,
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    // S3 Bucket Manager Function
    this.s3BucketManagerFunction = new lambdaNodeJs.NodejsFunction(this, 'S3BucketManagerFunction', {
      functionName: `${config.prefix}-s3-bucket-manager`,
      entry: '../../../services/s3-bucket-manager/src/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      role: lambdaExecutionRole,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      environment: commonEnvVars,
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    // Terraform Analyzer Function
    this.terraformAnalyzerFunction = new lambdaNodeJs.NodejsFunction(this, 'TerraformAnalyzerFunction', {
      functionName: `${config.prefix}-terraform-analyzer`,
      entry: '../../../services/analyze-terraform-plan/src/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      role: lambdaExecutionRole,
      timeout: Duration.minutes(10),
      memorySize: 2048,
      environment: commonEnvVars,
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    // GitHub Webhook Handler Function
    this.githubWebhookHandlerFunction = new lambdaNodeJs.NodejsFunction(this, 'GitHubWebhookHandlerFunction', {
      functionName: `${config.prefix}-github-webhook-handler`,
      entry: '../../../services/github-webhook-handler/src/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      role: lambdaExecutionRole,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      environment: commonEnvVars,
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    // Apply Fix Function
    this.applyFixFunction = new lambdaNodeJs.NodejsFunction(this, 'ApplyFixFunction', {
      functionName: `${config.prefix}-apply-fix`,
      entry: '../../../services/apply-fix/src/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.RUNTIME.NODEJS_18_X,
      role: lambdaExecutionRole,
      timeout: Duration.minutes(15),
      memorySize: 2048,
      environment: {
        ...commonEnvVars,
        REMEDIATION_TIMEOUT_MINUTES: '15',
        SAFETY_CHECKS_ENABLED: 'true',
      },
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    // Bedrock Knowledge Base Function
    this.bedrockKnowledgeBaseFunction = new lambdaNodeJs.NodejsFunction(this, 'BedrockKnowledgeBaseFunction', {
      functionName: `${config.prefix}-bedrock-knowledge-base`,
      entry: '../../../services/bedrock-knowledge-base/src/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      role: lambdaExecutionRole,
      timeout: Duration.minutes(10),
      memorySize: 2048,
      environment: commonEnvVars,
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    // Bedrock Agent Function
    this.bedrockAgentFunction = new lambdaNodeJs.NodejsFunction(this, 'BedrockAgentFunction', {
      functionName: `${config.prefix}-bedrock-agent`,
      entry: '../../../services/bedrock-agent/src/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      role: lambdaExecutionRole,
      timeout: Duration.minutes(5),
      memprySize: 2048,
      environment: commonEnvVars,
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    // Chat Interface Function
    this.chatInterfaceFunction = new lambdaNodeJs.NodejsFunction(this, 'ChatInterfaceFunction', {
      functionName: `${config.prefix}-chat-interface`,
      entry: '../../../services/chat-interface/src/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      role: lambdaExecutionRole,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      environment: {
        ...commonEnvVars,
        WEBSOCKET_TIMEOUT: '300',
        MAX_CONNECTIONS_PER_TENANT: '100',
      },
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    // Step Functions Orchestrator Function
    this stepFunctionsOrchestratorFunction = new lambdaNodeJs.NodejsFunction(this, 'StepFunctionsOrchestratorFunction', {
      functionName: `${config.prefix}-step-functions-orchestrator`,
      entry: '../../../services/step-functions-orchestrator/src/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      role: lambdaExecutionRole,
      timeout: Duration.minutes(10),
      memorySize: 1024,
      environment: commonEnvVars,
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    // EventBridge Scheduler Function
    this.eventbridgeSchedulerFunction = new lambdaNodeJs.NodejsFunction(this, 'EventBridgeSchedulerFunction', {
      functionName: `${config.prefix}-eventbridge-scheduler`,
      entry: '../../../services/eventbridge-scheduler/src/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      role: lambdaExecutionRole,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      environment: commonEnvVars,
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    // Tenant Management Function
    this.tenantManagementFunction = new lambdaNodeJs.NodejsFunction(this, 'TenantManagementFunction', {
      functionName: `${config.prefix}-tenant-management`,
      entry: '../../../services/tenant-management/src/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      role: lambdaExecutionRole,
      timeout: Duration.minutes(10),
      memorySize: 2048,
      environment: commonEnvVars,
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    // Audit Pack Generator Function
    this.auditPackGeneratorFunction = new lambdaNodeJs.NodejsFunction(this, 'AuditPackGeneratorFunction', {
      functionName: `${config.prefix}-audit-pack-generator`,
      entry: '../../../services/audit-pack-generator/src/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      role: lambdaExecutionRole,
      timeout: Duration.minutes(15),
      memorySize: 2048,
      environment: {
        ...commonEnvVars,
        AUDIT_PACK_TIMEOUT_MINUTES: '15',
      },
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    // Slack Notifications Function
    this.slackNotificationsFunction = new lambdaNodeJs.NodejsFunction(this, 'SlackNotificationsFunction', {
      functionName: `${config.prefix}-slack-notifications`,
      entry: '../../../services/slack-notifications/src/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      role: lambdaExecutionRole,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      environment: commonEnvVars,
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    // Web UI Function
    this.webUIFunction = new lambdaNodeJs.NodejsFunction(this, 'WebUIFunction', {
      functionName: `${config.prefix}-web-ui`,
      entry: '../../../services/web-ui/src/server.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      role: lambdaExecutionRole,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      environment: {
        ...commonEnvVars,
        PORT: '3000',
        MAX_CONCURRENT_CONNECTIONS: '1000',
      },
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    // Outputs
    new CfnOutput(this, 'LambdaFunctions', {
      value: JSON.stringify({
        scanEnvironment: this.scanEnvironmentFunction.functionArn,
        findingsStorage: this.findingsStorageFunction.functionArn,
        apiGateway: this.apiGatewayFunction.functionArn,
        htmlReportGenerator: this.htmlReportGeneratorFunction.functionArn,
        s3BucketManager: this.s3BucketManagerFunction.functionArn,
        terraformAnalyzer: this.terraformAnalyzerFunction.functionArn,
        githubWebhookHandler: this.githubWebhookHandlerFunction.functionArn,
        applyFix: this.applyFixFunction.functionArn,
        bedrockKnowledgeBase: this.bedrockKnowledgeBaseFunction.functionArn,
        bedrockAgent: this.bedrockAgentFunction.functionArn,
        chatInterface: this.chatInterfaceFunction.functionArn,
        stepFunctionsOrchestrator: this.stepFunctionsOrchestratorFunction.functionArn,
        eventbridgeScheduler: this.eventbridgeSchedulerFunction.functionArn,
        tenantManagement: this.tenantManagementFunction.functionArn,
        auditPackGenerator: this.auditPackGeneratorFunction.functionArn,
        slackNotifications: this.slackNotificationsFunction.functionArn,
        webUI: this.webUIFunction.functionArn,
      }),
      description: 'Lambda Function ARNs'
    });

    new CfnOutput(this, 'LambdaStackName', {
      value: this.stackName,
      description: 'Lambda Stack Name'
    });
  }

  public get stackName(): string {
    return this.stackName;
  }
}
