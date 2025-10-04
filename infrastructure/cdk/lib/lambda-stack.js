"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LambdaStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const lambdaNodeJs = require("aws-cdk-lib/aws-lambda-nodejs");
const iam = require("aws-cdk-lib/aws-iam");
class LambdaStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
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
            timeout: aws_cdk_lib_1.Duration.minutes(15),
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
            timeout: aws_cdk_lib_1.Duration.minutes(5),
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
            timeout: aws_cdk_lib_1.Duration.seconds(30),
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
            timeout: aws_cdk_lib_1.Duration.minutes(10),
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
            timeout: aws_cdk_lib_1.Duration.minutes(5),
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
            timeout: aws_cdk_lib_1.Duration.minutes(10),
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
            timeout: aws_cdk_lib_1.Duration.minutes(5),
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
            timeout: aws_cdk_lib_1.Duration.minutes(15),
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
            timeout: aws_cdk_lib_1.Duration.minutes(10),
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
            timeout: aws_cdk_lib_1.Duration.minutes(5),
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
            timeout: aws_cdk_lib_1.Duration.minutes(5),
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
        this;
        stepFunctionsOrchestratorFunction = new lambdaNodeJs.NodejsFunction(this, 'StepFunctionsOrchestratorFunction', {
            functionName: `${config.prefix}-step-functions-orchestrator`,
            entry: '../../../services/step-functions-orchestrator/src/index.ts',
            handler: 'handler',
            runtime: lambda.Runtime.NODEJS_18_X,
            role: lambdaExecutionRole,
            timeout: aws_cdk_lib_1.Duration.minutes(10),
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
            timeout: aws_cdk_lib_1.Duration.minutes(5),
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
            timeout: aws_cdk_lib_1.Duration.minutes(10),
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
            timeout: aws_cdk_lib_1.Duration.minutes(15),
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
            timeout: aws_cdk_lib_1.Duration.minutes(5),
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
            timeout: aws_cdk_lib_1.Duration.minutes(5),
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
        new aws_cdk_lib_1.CfnOutput(this, 'LambdaFunctions', {
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
        new aws_cdk_lib_1.CfnOutput(this, 'LambdaStackName', {
            value: this.stackName,
            description: 'Lambda Stack Name'
        });
    }
    get stackName() {
        return this.stackName;
    }
}
exports.LambdaStack = LambdaStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2xhbWJkYS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2Q0FBcUU7QUFDckUsaURBQWlEO0FBQ2pELDhEQUE4RDtBQUM5RCwyQ0FBMkM7QUFrQjNDLE1BQWEsV0FBWSxTQUFRLG1CQUFLO0lBNEJwQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXVCO1FBQy9ELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFekIsaURBQWlEO1FBQ2pELE1BQU0sYUFBYSxHQUFHO1lBQ3BCLFFBQVEsRUFBRSxNQUFNLENBQUMsV0FBVztZQUM1QixVQUFVLEVBQUUsTUFBTSxDQUFDLE1BQU07WUFDekIsU0FBUyxFQUFFLE1BQU07WUFDakIsb0JBQW9CLEVBQUUsTUFBTTtZQUM1QixpQkFBaUIsRUFBRSxNQUFNLENBQUMsTUFBTTtTQUNqQyxDQUFDO1FBRUYsNkNBQTZDO1FBQzdDLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUNwRSxRQUFRLEVBQUUsR0FBRyxNQUFNLENBQUMsTUFBTSx3QkFBd0I7WUFDbEQsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLHNCQUFzQixDQUFDO1lBQzNELGVBQWUsRUFBRTtnQkFDZixHQUFHLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLDBDQUEwQyxDQUFDO2dCQUN0RixHQUFHLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLDhDQUE4QyxDQUFDO2FBQzNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsa0RBQWtEO1FBQ2xELG1CQUFtQixDQUFDLGVBQWUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDMUQs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LEVBQUUsaUJBQWlCLEVBQUU7WUFDckMsS0FBSyxFQUFFLElBQUksQ0FBQyxTQUFTO1lBQ3JCLFdBQVcsRUFBRSxtQkFBbUI7U0FDakMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELElBQVcsU0FBUztRQUNsQixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUM7SUFDeEIsQ0FBQztDQUNGO0FBbmFELGtDQW1hQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFN0YWNrLCBTdGFja1Byb3BzLCBDZm5PdXRwdXQsIER1cmF0aW9uIH0gZnJvbSAnYXdzLWNkay1saWInO1xyXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XHJcbmltcG9ydCAqIGFzIGxhbWJkYU5vZGVKcyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhLW5vZGVqcyc7XHJcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcclxuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBMYW1iZGFTdGFja1Byb3BzIGV4dGVuZHMgU3RhY2tQcm9wcyB7XHJcbiAgY29uZmlnOiB7XHJcbiAgICBhY2NvdW50OiBzdHJpbmc7XHJcbiAgICByZWdpb246IHN0cmluZztcclxuICAgIGVudmlyb25tZW50OiBzdHJpbmc7XHJcbiAgICBzdGFnZTogc3RyaW5nO1xyXG4gICAgcHJlZml4OiBzdHJpbmc7XHJcbiAgfTtcclxuICBkYXRhYmFzZVN0YWNrTmFtZTogc3RyaW5nO1xyXG4gIHNlY3VyaXR5U3RhY2tOYW1lOiBzdHJpbmc7XHJcbiAgc3RvcmFnZVN0YWNrTmFtZTogc3RyaW5nO1xyXG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBMYW1iZGFTdGFjayBleHRlbmRzIFN0YWNrIHtcclxuICAvLyBDb3JlIFNlcnZpY2UgTGFtYmRhc1xyXG4gIHB1YmxpYyByZWFkb25seSBzY2FuRW52aXJvbm1lbnRGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xyXG4gIHB1YmxpYyByZWFkb25seSBmaW5kaW5nc1N0b3JhZ2VGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xyXG4gIHB1YmxpYyByZWFkb25seSBhcGlHYXRld2F5RnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcclxuICBwdWJsaWMgcmVhZG9ubHkgaHRtbFJlcG9ydEdlbmVyYXRvckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XHJcbiAgcHVibGljIHJlYWRvbmx5IHMzQnVja2V0TWFuYWdlckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XHJcblxyXG4gIC8vIEFuYWx5c2lzIExhbWJkYXNcclxuICBwdWJsaWMgcmVhZG9ubHkgdGVycmFmb3JtQW5hbHl6ZXJGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xyXG4gIHB1YmxpYyByZWFkb25seSBnaXRodWJXZWJob29rSGFuZGxlckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XHJcbiAgcHVibGljIHJlYWRvbmx5IGFwcGx5Rml4RnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcclxuXHJcbiAgLy8gQUkgTGFtYmRhc1xyXG4gIHB1YmxpYyByZWFkb25seSBiZWRyb2NrS25vd2xlZGdlQmFzZUZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XHJcbiAgcHVibGljIHJlYWRvbmx5IGJlZHJvY2tBZ2VudEZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XHJcbiAgcHVibGljIHJlYWRvbmx5IGNoYXRJbnRlcmZhY2VGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xyXG5cclxuICAvLyBPcmNoZXN0cmF0aW9uIExhbWJkYXNcclxuICBwdWJsaWMgcmVhZG9ubHkgc3RlcEZ1bmN0aW9uc09yY2hlc3RyYXRvckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XHJcbiAgcHVibGljIHJlYWRvbmx5IGV2ZW50YnJpZGdlU2NoZWR1bGVyRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcclxuICBwdWJsaWMgcmVhZG9ubHkgdGVuYW50TWFuYWdlbWVudEZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XHJcblxyXG4gIC8vIEJ1c2luZXNzIExvZ2ljIExhbWJkYXNcclxuICBwdWJsaWMgcmVhZG9ubHkgYXVkaXRQYWNrR2VuZXJhdG9yRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcclxuICBwdWJsaWMgcmVhZG9ubHkgc2xhY2tOb3RpZmljYXRpb25zRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcclxuICBwdWJsaWMgcmVhZG9ubHkgd2ViVUlGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xyXG5cclxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTGFtYmRhU3RhY2tQcm9wcykge1xyXG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XHJcblxyXG4gICAgY29uc3QgeyBjb25maWcgfSA9IHByb3BzO1xyXG5cclxuICAgIC8vIEVudmlyb25tZW50IHZhcmlhYmxlcyBmb3IgYWxsIExhbWJkYSBmdW5jdGlvbnNcclxuICAgIGNvbnN0IGNvbW1vbkVudlZhcnMgPSB7XHJcbiAgICAgIE5PREVfRU5WOiBjb25maWcuZW52aXJvbm1lbnQsXHJcbiAgICAgIEFXU19SRUdJT046IGNvbmZpZy5yZWdpb24sXHJcbiAgICAgIExPR19MRVZFTDogJ0lORk8nLFxyXG4gICAgICBYUkFZX1RSQUNJTkdfRU5BQkxFRDogJ3RydWUnLFxyXG4gICAgICBERVBMT1lNRU5UX1BSRUZJWDogY29uZmlnLnByZWZpeCxcclxuICAgIH07XHJcblxyXG4gICAgLy8gQ3JlYXRlIGV4ZWN1dGlvbiByb2xlIGZvciBMYW1iZGEgZnVuY3Rpb25zXHJcbiAgICBjb25zdCBsYW1iZGFFeGVjdXRpb25Sb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdMYW1iZGFFeGVjdXRpb25Sb2xlJywge1xyXG4gICAgICByb2xlTmFtZTogYCR7Y29uZmlnLnByZWZpeH0tbGFtYmRhLWV4ZWN1dGlvbi1yb2xlYCxcclxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXHJcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xyXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxyXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYVZQQ0FjY2Vzc0V4ZWN1dGlvblJvbGUnKSxcclxuICAgICAgXSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEFkZCBhZGRpdGlvbmFsIHBlcm1pc3Npb25zIGZvciBMYW1iZGEgZnVuY3Rpb25zXHJcbiAgICBsYW1iZGFFeGVjdXRpb25Sb2xlLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcclxuICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICdkeW5hbW9kYjoqJyxcclxuICAgICAgICAnczM6KicsXHJcbiAgICAgICAgJ2ttczoqJyxcclxuICAgICAgICAnY2xvdWR3YXRjaDoqJyxcclxuICAgICAgICAnbG9nczoqJyxcclxuICAgICAgICAneHJheToqJyxcclxuICAgICAgICAnc3RhdGVzOionLFxyXG4gICAgICAgICdldmVudHM6KicsXHJcbiAgICAgICAgJ2xhbWJkYTpJbnZva2VGdW5jdGlvbicsXHJcbiAgICAgICAgJ2FwaWdhdGV3YXk6KicsXHJcbiAgICAgICAgJ2JlZHJvY2s6KicsXHJcbiAgICAgICAgJ2JlZHJvY2thZ2VudDoqJyxcclxuICAgICAgICAnc3NtOkdldFBhcmFtZXRlcicsXHJcbiAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXJzJyxcclxuICAgICAgICAnc3NtOkdldFBhcmFtZXRlcnNCeVBhdGgnLFxyXG4gICAgICAgICdzZWNyZXRzbWFuYWdlcjpHZXRTZWNyZXRWYWx1ZScsXHJcbiAgICAgICAgJ29yZ2FuaXphdGlvbnM6KicsXHJcbiAgICAgICAgJ3N0czpBc3N1bWVSb2xlJyxcclxuICAgICAgXSxcclxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcclxuICAgIH0pKTtcclxuXHJcbiAgICAvLyBTY2FuIEVudmlyb25tZW50IEZ1bmN0aW9uXHJcbiAgICB0aGlzLnNjYW5FbnZpcm9ubWVudEZ1bmN0aW9uID0gbmV3IGxhbWJkYU5vZGVKcy5Ob2RlanNGdW5jdGlvbih0aGlzLCAnU2NhbkVudmlyb25tZW50RnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogYCR7Y29uZmlnLnByZWZpeH0tc2Nhbi1lbnZpcm9ubWVudGAsXHJcbiAgICAgIGVudHJ5OiAnLi4vLi4vLi4vc2VydmljZXMvc2Nhbi1lbnZpcm9ubWVudC9zcmMvaW5kZXgudHMnLFxyXG4gICAgICBoYW5kbGVyOiAnaGFuZGxlcicsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICByb2xlOiBsYW1iZGFFeGVjdXRpb25Sb2xlLFxyXG4gICAgICB0aW1lb3V0OiBEdXJhdGlvbi5taW51dGVzKDE1KSxcclxuICAgICAgbWVtb3J5U2l6ZTogMjA0OCxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAuLi5jb21tb25FbnZWYXJzLFxyXG4gICAgICAgIFNDQU5fVElNRU9VVF9NSU5VVEVTOiAnMTUnLFxyXG4gICAgICAgIERJU0NPVkVSWV9DT05DVVJSRU5DWTogJzEwJyxcclxuICAgICAgfSxcclxuICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICBleHRlcm5hbE1vZHVsZXM6IFsnYXdzLXNkayddLFxyXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBGaW5kaW5ncyBTdG9yYWdlIEZ1bmN0aW9uXHJcbiAgICB0aGlzLmZpbmRpbmdzU3RvcmFnZUZ1bmN0aW9uID0gbmV3IGxhbWJkYU5vZGVKcy5Ob2RlanNGdW5jdGlvbih0aGlzLCAnRmluZGluZ3NTdG9yYWdlRnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogYCR7Y29uZmlnLnByZWZpeH0tZmluZGluZ3Mtc3RvcmFnZWAsXHJcbiAgICAgIGVudHJ5OiAnLi4vLi4vLi4vc2VydmljZXMvZmluZGluZ3Mtc3RvcmFnZS9zcmMvaW5kZXgudHMnLFxyXG4gICAgICBoYW5kbGVyOiAnaGFuZGxlcicsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICByb2xlOiBsYW1iZGFFeGVjdXRpb25Sb2xlLFxyXG4gICAgICB0aW1lb3V0OiBEdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LFxyXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52VmFycyxcclxuICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICBleHRlcm5hbE1vZHVsZXM6IFsnYXdzLXNkayddLFxyXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBUEkgR2F0ZXdheSBGdW5jdGlvblxyXG4gICAgdGhpcy5hcGlHYXRld2F5RnVuY3Rpb24gPSBuZXcgbGFtYmRhTm9kZUpzLk5vZGVqc0Z1bmN0aW9uKHRoaXMsICdBcGlHYXRld2F5RnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogYCR7Y29uZmlnLnByZWZpeH0tYXBpLWdhdGV3YXlgLFxyXG4gICAgICBlbnRyeTogJy4uLy4uLy4uL3NlcnZpY2VzL2FwaS1nYXRld2F5L3NyYy9pbmRleC50cycsXHJcbiAgICAgIGhhbmRsZXI6ICdoYW5kbGVyJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIHJvbGU6IGxhbWJkYUV4ZWN1dGlvblJvbGUsXHJcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LFxyXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52VmFycyxcclxuICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICBleHRlcm5hbE1vZHVsZXM6IFsnYXdzLXNkayddLFxyXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBIVE1MIFJlcG9ydCBHZW5lcmF0b3IgRnVuY3Rpb25cclxuICAgIHRoaXMuaHRtbFJlcG9ydEdlbmVyYXRvckZ1bmN0aW9uID0gbmV3IGxhbWJkYU5vZGVKcy5Ob2RlanNGdW5jdGlvbih0aGlzLCAnSFRNTFJlcG9ydEdlbmVyYXRvckZ1bmN0aW9uJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6IGAke2NvbmZpZy5wcmVmaXh9LWh0bWwtcmVwb3J0LWdlbmVyYXRvcmAsXHJcbiAgICAgIGVudHJ5OiAnLi4vLi4vLi4vc2VydmljZXMvaHRtbC1yZXBvcnQtZ2VuZXJhdG9yL3NyYy9pbmRleC50cycsXHJcbiAgICAgIGhhbmRsZXI6ICdoYW5kbGVyJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIHJvbGU6IGxhbWJkYUV4ZWN1dGlvblJvbGUsXHJcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLm1pbnV0ZXMoMTApLFxyXG4gICAgICBtZW1vcnlTaXplOiAyMDQ4LFxyXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52VmFycyxcclxuICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICBleHRlcm5hbE1vZHVsZXM6IFsnYXdzLXNkayddLFxyXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTMyBCdWNrZXQgTWFuYWdlciBGdW5jdGlvblxyXG4gICAgdGhpcy5zM0J1Y2tldE1hbmFnZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGFOb2RlSnMuTm9kZWpzRnVuY3Rpb24odGhpcywgJ1MzQnVja2V0TWFuYWdlckZ1bmN0aW9uJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6IGAke2NvbmZpZy5wcmVmaXh9LXMzLWJ1Y2tldC1tYW5hZ2VyYCxcclxuICAgICAgZW50cnk6ICcuLi8uLi8uLi9zZXJ2aWNlcy9zMy1idWNrZXQtbWFuYWdlci9zcmMvaW5kZXgudHMnLFxyXG4gICAgICBoYW5kbGVyOiAnaGFuZGxlcicsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICByb2xlOiBsYW1iZGFFeGVjdXRpb25Sb2xlLFxyXG4gICAgICB0aW1lb3V0OiBEdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LFxyXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52VmFycyxcclxuICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICBleHRlcm5hbE1vZHVsZXM6IFsnYXdzLXNkayddLFxyXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBUZXJyYWZvcm0gQW5hbHl6ZXIgRnVuY3Rpb25cclxuICAgIHRoaXMudGVycmFmb3JtQW5hbHl6ZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGFOb2RlSnMuTm9kZWpzRnVuY3Rpb24odGhpcywgJ1RlcnJhZm9ybUFuYWx5emVyRnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogYCR7Y29uZmlnLnByZWZpeH0tdGVycmFmb3JtLWFuYWx5emVyYCxcclxuICAgICAgZW50cnk6ICcuLi8uLi8uLi9zZXJ2aWNlcy9hbmFseXplLXRlcnJhZm9ybS1wbGFuL3NyYy9pbmRleC50cycsXHJcbiAgICAgIGhhbmRsZXI6ICdoYW5kbGVyJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIHJvbGU6IGxhbWJkYUV4ZWN1dGlvblJvbGUsXHJcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLm1pbnV0ZXMoMTApLFxyXG4gICAgICBtZW1vcnlTaXplOiAyMDQ4LFxyXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52VmFycyxcclxuICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICBleHRlcm5hbE1vZHVsZXM6IFsnYXdzLXNkayddLFxyXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHaXRIdWIgV2ViaG9vayBIYW5kbGVyIEZ1bmN0aW9uXHJcbiAgICB0aGlzLmdpdGh1YldlYmhvb2tIYW5kbGVyRnVuY3Rpb24gPSBuZXcgbGFtYmRhTm9kZUpzLk5vZGVqc0Z1bmN0aW9uKHRoaXMsICdHaXRIdWJXZWJob29rSGFuZGxlckZ1bmN0aW9uJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6IGAke2NvbmZpZy5wcmVmaXh9LWdpdGh1Yi13ZWJob29rLWhhbmRsZXJgLFxyXG4gICAgICBlbnRyeTogJy4uLy4uLy4uL3NlcnZpY2VzL2dpdGh1Yi13ZWJob29rLWhhbmRsZXIvc3JjL2luZGV4LnRzJyxcclxuICAgICAgaGFuZGxlcjogJ2hhbmRsZXInLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgcm9sZTogbGFtYmRhRXhlY3V0aW9uUm9sZSxcclxuICAgICAgdGltZW91dDogRHVyYXRpb24ubWludXRlcyg1KSxcclxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcclxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkVudlZhcnMsXHJcbiAgICAgIGJ1bmRsaW5nOiB7XHJcbiAgICAgICAgZXh0ZXJuYWxNb2R1bGVzOiBbJ2F3cy1zZGsnXSxcclxuICAgICAgICBtaW5pZnk6IHRydWUsXHJcbiAgICAgICAgc291cmNlTWFwOiB0cnVlLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQXBwbHkgRml4IEZ1bmN0aW9uXHJcbiAgICB0aGlzLmFwcGx5Rml4RnVuY3Rpb24gPSBuZXcgbGFtYmRhTm9kZUpzLk5vZGVqc0Z1bmN0aW9uKHRoaXMsICdBcHBseUZpeEZ1bmN0aW9uJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6IGAke2NvbmZpZy5wcmVmaXh9LWFwcGx5LWZpeGAsXHJcbiAgICAgIGVudHJ5OiAnLi4vLi4vLi4vc2VydmljZXMvYXBwbHktZml4L3NyYy9pbmRleC50cycsXHJcbiAgICAgIGhhbmRsZXI6ICdoYW5kbGVyJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUlVOVElNRS5OT0RFSlNfMThfWCxcclxuICAgICAgcm9sZTogbGFtYmRhRXhlY3V0aW9uUm9sZSxcclxuICAgICAgdGltZW91dDogRHVyYXRpb24ubWludXRlcygxNSksXHJcbiAgICAgIG1lbW9yeVNpemU6IDIwNDgsXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgLi4uY29tbW9uRW52VmFycyxcclxuICAgICAgICBSRU1FRElBVElPTl9USU1FT1VUX01JTlVURVM6ICcxNScsXHJcbiAgICAgICAgU0FGRVRZX0NIRUNLU19FTkFCTEVEOiAndHJ1ZScsXHJcbiAgICAgIH0sXHJcbiAgICAgIGJ1bmRsaW5nOiB7XHJcbiAgICAgICAgZXh0ZXJuYWxNb2R1bGVzOiBbJ2F3cy1zZGsnXSxcclxuICAgICAgICBtaW5pZnk6IHRydWUsXHJcbiAgICAgICAgc291cmNlTWFwOiB0cnVlLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQmVkcm9jayBLbm93bGVkZ2UgQmFzZSBGdW5jdGlvblxyXG4gICAgdGhpcy5iZWRyb2NrS25vd2xlZGdlQmFzZUZ1bmN0aW9uID0gbmV3IGxhbWJkYU5vZGVKcy5Ob2RlanNGdW5jdGlvbih0aGlzLCAnQmVkcm9ja0tub3dsZWRnZUJhc2VGdW5jdGlvbicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiBgJHtjb25maWcucHJlZml4fS1iZWRyb2NrLWtub3dsZWRnZS1iYXNlYCxcclxuICAgICAgZW50cnk6ICcuLi8uLi8uLi9zZXJ2aWNlcy9iZWRyb2NrLWtub3dsZWRnZS1iYXNlL3NyYy9pbmRleC50cycsXHJcbiAgICAgIGhhbmRsZXI6ICdoYW5kbGVyJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIHJvbGU6IGxhbWJkYUV4ZWN1dGlvblJvbGUsXHJcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLm1pbnV0ZXMoMTApLFxyXG4gICAgICBtZW1vcnlTaXplOiAyMDQ4LFxyXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52VmFycyxcclxuICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICBleHRlcm5hbE1vZHVsZXM6IFsnYXdzLXNkayddLFxyXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBCZWRyb2NrIEFnZW50IEZ1bmN0aW9uXHJcbiAgICB0aGlzLmJlZHJvY2tBZ2VudEZ1bmN0aW9uID0gbmV3IGxhbWJkYU5vZGVKcy5Ob2RlanNGdW5jdGlvbih0aGlzLCAnQmVkcm9ja0FnZW50RnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogYCR7Y29uZmlnLnByZWZpeH0tYmVkcm9jay1hZ2VudGAsXHJcbiAgICAgIGVudHJ5OiAnLi4vLi4vLi4vc2VydmljZXMvYmVkcm9jay1hZ2VudC9zcmMvaW5kZXgudHMnLFxyXG4gICAgICBoYW5kbGVyOiAnaGFuZGxlcicsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICByb2xlOiBsYW1iZGFFeGVjdXRpb25Sb2xlLFxyXG4gICAgICB0aW1lb3V0OiBEdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgICBtZW1wcnlTaXplOiAyMDQ4LFxyXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52VmFycyxcclxuICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICBleHRlcm5hbE1vZHVsZXM6IFsnYXdzLXNkayddLFxyXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBDaGF0IEludGVyZmFjZSBGdW5jdGlvblxyXG4gICAgdGhpcy5jaGF0SW50ZXJmYWNlRnVuY3Rpb24gPSBuZXcgbGFtYmRhTm9kZUpzLk5vZGVqc0Z1bmN0aW9uKHRoaXMsICdDaGF0SW50ZXJmYWNlRnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogYCR7Y29uZmlnLnByZWZpeH0tY2hhdC1pbnRlcmZhY2VgLFxyXG4gICAgICBlbnRyeTogJy4uLy4uLy4uL3NlcnZpY2VzL2NoYXQtaW50ZXJmYWNlL3NyYy9pbmRleC50cycsXHJcbiAgICAgIGhhbmRsZXI6ICdoYW5kbGVyJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIHJvbGU6IGxhbWJkYUV4ZWN1dGlvblJvbGUsXHJcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLm1pbnV0ZXMoNSksXHJcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgLi4uY29tbW9uRW52VmFycyxcclxuICAgICAgICBXRUJTT0NLRVRfVElNRU9VVDogJzMwMCcsXHJcbiAgICAgICAgTUFYX0NPTk5FQ1RJT05TX1BFUl9URU5BTlQ6ICcxMDAnLFxyXG4gICAgICB9LFxyXG4gICAgICBidW5kbGluZzoge1xyXG4gICAgICAgIGV4dGVybmFsTW9kdWxlczogWydhd3Mtc2RrJ10sXHJcbiAgICAgICAgbWluaWZ5OiB0cnVlLFxyXG4gICAgICAgIHNvdXJjZU1hcDogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFN0ZXAgRnVuY3Rpb25zIE9yY2hlc3RyYXRvciBGdW5jdGlvblxyXG4gICAgdGhpcyBzdGVwRnVuY3Rpb25zT3JjaGVzdHJhdG9yRnVuY3Rpb24gPSBuZXcgbGFtYmRhTm9kZUpzLk5vZGVqc0Z1bmN0aW9uKHRoaXMsICdTdGVwRnVuY3Rpb25zT3JjaGVzdHJhdG9yRnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogYCR7Y29uZmlnLnByZWZpeH0tc3RlcC1mdW5jdGlvbnMtb3JjaGVzdHJhdG9yYCxcclxuICAgICAgZW50cnk6ICcuLi8uLi8uLi9zZXJ2aWNlcy9zdGVwLWZ1bmN0aW9ucy1vcmNoZXN0cmF0b3Ivc3JjL2luZGV4LnRzJyxcclxuICAgICAgaGFuZGxlcjogJ2hhbmRsZXInLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgcm9sZTogbGFtYmRhRXhlY3V0aW9uUm9sZSxcclxuICAgICAgdGltZW91dDogRHVyYXRpb24ubWludXRlcygxMCksXHJcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsXHJcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25FbnZWYXJzLFxyXG4gICAgICBidW5kbGluZzoge1xyXG4gICAgICAgIGV4dGVybmFsTW9kdWxlczogWydhd3Mtc2RrJ10sXHJcbiAgICAgICAgbWluaWZ5OiB0cnVlLFxyXG4gICAgICAgIHNvdXJjZU1hcDogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEV2ZW50QnJpZGdlIFNjaGVkdWxlciBGdW5jdGlvblxyXG4gICAgdGhpcy5ldmVudGJyaWRnZVNjaGVkdWxlckZ1bmN0aW9uID0gbmV3IGxhbWJkYU5vZGVKcy5Ob2RlanNGdW5jdGlvbih0aGlzLCAnRXZlbnRCcmlkZ2VTY2hlZHVsZXJGdW5jdGlvbicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiBgJHtjb25maWcucHJlZml4fS1ldmVudGJyaWRnZS1zY2hlZHVsZXJgLFxyXG4gICAgICBlbnRyeTogJy4uLy4uLy4uL3NlcnZpY2VzL2V2ZW50YnJpZGdlLXNjaGVkdWxlci9zcmMvaW5kZXgudHMnLFxyXG4gICAgICBoYW5kbGVyOiAnaGFuZGxlcicsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICByb2xlOiBsYW1iZGFFeGVjdXRpb25Sb2xlLFxyXG4gICAgICB0aW1lb3V0OiBEdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LFxyXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52VmFycyxcclxuICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICBleHRlcm5hbE1vZHVsZXM6IFsnYXdzLXNkayddLFxyXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBUZW5hbnQgTWFuYWdlbWVudCBGdW5jdGlvblxyXG4gICAgdGhpcy50ZW5hbnRNYW5hZ2VtZW50RnVuY3Rpb24gPSBuZXcgbGFtYmRhTm9kZUpzLk5vZGVqc0Z1bmN0aW9uKHRoaXMsICdUZW5hbnRNYW5hZ2VtZW50RnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogYCR7Y29uZmlnLnByZWZpeH0tdGVuYW50LW1hbmFnZW1lbnRgLFxyXG4gICAgICBlbnRyeTogJy4uLy4uLy4uL3NlcnZpY2VzL3RlbmFudC1tYW5hZ2VtZW50L3NyYy9pbmRleC50cycsXHJcbiAgICAgIGhhbmRsZXI6ICdoYW5kbGVyJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIHJvbGU6IGxhbWJkYUV4ZWN1dGlvblJvbGUsXHJcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLm1pbnV0ZXMoMTApLFxyXG4gICAgICBtZW1vcnlTaXplOiAyMDQ4LFxyXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52VmFycyxcclxuICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICBleHRlcm5hbE1vZHVsZXM6IFsnYXdzLXNkayddLFxyXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBdWRpdCBQYWNrIEdlbmVyYXRvciBGdW5jdGlvblxyXG4gICAgdGhpcy5hdWRpdFBhY2tHZW5lcmF0b3JGdW5jdGlvbiA9IG5ldyBsYW1iZGFOb2RlSnMuTm9kZWpzRnVuY3Rpb24odGhpcywgJ0F1ZGl0UGFja0dlbmVyYXRvckZ1bmN0aW9uJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6IGAke2NvbmZpZy5wcmVmaXh9LWF1ZGl0LXBhY2stZ2VuZXJhdG9yYCxcclxuICAgICAgZW50cnk6ICcuLi8uLi8uLi9zZXJ2aWNlcy9hdWRpdC1wYWNrLWdlbmVyYXRvci9zcmMvaW5kZXgudHMnLFxyXG4gICAgICBoYW5kbGVyOiAnaGFuZGxlcicsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICByb2xlOiBsYW1iZGFFeGVjdXRpb25Sb2xlLFxyXG4gICAgICB0aW1lb3V0OiBEdXJhdGlvbi5taW51dGVzKDE1KSxcclxuICAgICAgbWVtb3J5U2l6ZTogMjA0OCxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAuLi5jb21tb25FbnZWYXJzLFxyXG4gICAgICAgIEFVRElUX1BBQ0tfVElNRU9VVF9NSU5VVEVTOiAnMTUnLFxyXG4gICAgICB9LFxyXG4gICAgICBidW5kbGluZzoge1xyXG4gICAgICAgIGV4dGVybmFsTW9kdWxlczogWydhd3Mtc2RrJ10sXHJcbiAgICAgICAgbWluaWZ5OiB0cnVlLFxyXG4gICAgICAgIHNvdXJjZU1hcDogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFNsYWNrIE5vdGlmaWNhdGlvbnMgRnVuY3Rpb25cclxuICAgIHRoaXMuc2xhY2tOb3RpZmljYXRpb25zRnVuY3Rpb24gPSBuZXcgbGFtYmRhTm9kZUpzLk5vZGVqc0Z1bmN0aW9uKHRoaXMsICdTbGFja05vdGlmaWNhdGlvbnNGdW5jdGlvbicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiBgJHtjb25maWcucHJlZml4fS1zbGFjay1ub3RpZmljYXRpb25zYCxcclxuICAgICAgZW50cnk6ICcuLi8uLi8uLi9zZXJ2aWNlcy9zbGFjay1ub3RpZmljYXRpb25zL3NyYy9pbmRleC50cycsXHJcbiAgICAgIGhhbmRsZXI6ICdoYW5kbGVyJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIHJvbGU6IGxhbWJkYUV4ZWN1dGlvblJvbGUsXHJcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLm1pbnV0ZXMoNSksXHJcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsXHJcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25FbnZWYXJzLFxyXG4gICAgICBidW5kbGluZzoge1xyXG4gICAgICAgIGV4dGVybmFsTW9kdWxlczogWydhd3Mtc2RrJ10sXHJcbiAgICAgICAgbWluaWZ5OiB0cnVlLFxyXG4gICAgICAgIHNvdXJjZU1hcDogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFdlYiBVSSBGdW5jdGlvblxyXG4gICAgdGhpcy53ZWJVSUZ1bmN0aW9uID0gbmV3IGxhbWJkYU5vZGVKcy5Ob2RlanNGdW5jdGlvbih0aGlzLCAnV2ViVUlGdW5jdGlvbicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiBgJHtjb25maWcucHJlZml4fS13ZWItdWlgLFxyXG4gICAgICBlbnRyeTogJy4uLy4uLy4uL3NlcnZpY2VzL3dlYi11aS9zcmMvc2VydmVyLnRzJyxcclxuICAgICAgaGFuZGxlcjogJ2hhbmRsZXInLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgcm9sZTogbGFtYmRhRXhlY3V0aW9uUm9sZSxcclxuICAgICAgdGltZW91dDogRHVyYXRpb24ubWludXRlcyg1KSxcclxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAuLi5jb21tb25FbnZWYXJzLFxyXG4gICAgICAgIFBPUlQ6ICczMDAwJyxcclxuICAgICAgICBNQVhfQ09OQ1VSUkVOVF9DT05ORUNUSU9OUzogJzEwMDAnLFxyXG4gICAgICB9LFxyXG4gICAgICBidW5kbGluZzoge1xyXG4gICAgICAgIGV4dGVybmFsTW9kdWxlczogWydhd3Mtc2RrJ10sXHJcbiAgICAgICAgbWluaWZ5OiB0cnVlLFxyXG4gICAgICAgIHNvdXJjZU1hcDogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIE91dHB1dHNcclxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ0xhbWJkYUZ1bmN0aW9ucycsIHtcclxuICAgICAgdmFsdWU6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICBzY2FuRW52aXJvbm1lbnQ6IHRoaXMuc2NhbkVudmlyb25tZW50RnVuY3Rpb24uZnVuY3Rpb25Bcm4sXHJcbiAgICAgICAgZmluZGluZ3NTdG9yYWdlOiB0aGlzLmZpbmRpbmdzU3RvcmFnZUZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxyXG4gICAgICAgIGFwaUdhdGV3YXk6IHRoaXMuYXBpR2F0ZXdheUZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxyXG4gICAgICAgIGh0bWxSZXBvcnRHZW5lcmF0b3I6IHRoaXMuaHRtbFJlcG9ydEdlbmVyYXRvckZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxyXG4gICAgICAgIHMzQnVja2V0TWFuYWdlcjogdGhpcy5zM0J1Y2tldE1hbmFnZXJGdW5jdGlvbi5mdW5jdGlvbkFybixcclxuICAgICAgICB0ZXJyYWZvcm1BbmFseXplcjogdGhpcy50ZXJyYWZvcm1BbmFseXplckZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxyXG4gICAgICAgIGdpdGh1YldlYmhvb2tIYW5kbGVyOiB0aGlzLmdpdGh1YldlYmhvb2tIYW5kbGVyRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXHJcbiAgICAgICAgYXBwbHlGaXg6IHRoaXMuYXBwbHlGaXhGdW5jdGlvbi5mdW5jdGlvbkFybixcclxuICAgICAgICBiZWRyb2NrS25vd2xlZGdlQmFzZTogdGhpcy5iZWRyb2NrS25vd2xlZGdlQmFzZUZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxyXG4gICAgICAgIGJlZHJvY2tBZ2VudDogdGhpcy5iZWRyb2NrQWdlbnRGdW5jdGlvbi5mdW5jdGlvbkFybixcclxuICAgICAgICBjaGF0SW50ZXJmYWNlOiB0aGlzLmNoYXRJbnRlcmZhY2VGdW5jdGlvbi5mdW5jdGlvbkFybixcclxuICAgICAgICBzdGVwRnVuY3Rpb25zT3JjaGVzdHJhdG9yOiB0aGlzLnN0ZXBGdW5jdGlvbnNPcmNoZXN0cmF0b3JGdW5jdGlvbi5mdW5jdGlvbkFybixcclxuICAgICAgICBldmVudGJyaWRnZVNjaGVkdWxlcjogdGhpcy5ldmVudGJyaWRnZVNjaGVkdWxlckZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxyXG4gICAgICAgIHRlbmFudE1hbmFnZW1lbnQ6IHRoaXMudGVuYW50TWFuYWdlbWVudEZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxyXG4gICAgICAgIGF1ZGl0UGFja0dlbmVyYXRvcjogdGhpcy5hdWRpdFBhY2tHZW5lcmF0b3JGdW5jdGlvbi5mdW5jdGlvbkFybixcclxuICAgICAgICBzbGFja05vdGlmaWNhdGlvbnM6IHRoaXMuc2xhY2tOb3RpZmljYXRpb25zRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXHJcbiAgICAgICAgd2ViVUk6IHRoaXMud2ViVUlGdW5jdGlvbi5mdW5jdGlvbkFybixcclxuICAgICAgfSksXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnTGFtYmRhIEZ1bmN0aW9uIEFSTnMnXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdMYW1iZGFTdGFja05hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiB0aGlzLnN0YWNrTmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246ICdMYW1iZGEgU3RhY2sgTmFtZSdcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBzdGFja05hbWUoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB0aGlzLnN0YWNrTmFtZTtcclxuICB9XHJcbn1cclxuIl19