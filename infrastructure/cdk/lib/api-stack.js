"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const cognito = require("aws-cdk-lib/aws-cognito");
const lambda = require("aws-cdk-lib/aws-lambda");
class ApiStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { config } = props;
        // Get Lambda functions from Lambda stack
        const lambdaStack = aws_cdk_lib_1.Stack.fromStackName(this, props.lambdaStackName);
        // Import Lambda functions
        const scanEnvironmentFunction = lambda.Function.fromFunctionName(this, 'ScanEnvironmentFunction', `${config.prefix}-scan-environment`);
        const findingsStorageFunction = lambda.Function.fromFunctionName(this, 'FindingsStorageFunction', `${config.prefix}-findings-storage`);
        const apiGatewayFunction = lambda.Function.fromFunctionName(this, 'ApiGatewayFunction', `${config.prefix}-api-gateway`);
        const htmlReportGeneratorFunction = lambda.Function.fromFunctionName(this, 'HTMLReportGeneratorFunction', `${config.prefix}-html-report-generator`);
        const terraformAnalyzerFunction = lambda.Function.fromFunctionName(this, 'TerraformAnalyzerFunction', `${config.prefix}-terraform-analyzer`);
        const webUIFunction = lambda.Function.fromFunctionName(this, 'WebUIFunction', `${config.prefix}-web-ui`);
        // Import Cognito User Pool from Security stack
        const userPool = cognito.UserPool.fromUserPoolId(this, 'UserPool', `${config.prefix}-users`);
        // Create API Gateway
        this.api = new apigateway.RestApi(this, 'AiComplianceApi', {
            restApiName: `${config.prefix}-api`,
            description: 'AI Compliance Shepherd API',
            endpointConfiguration: {
                types: [apigateway.EndpointType.REGIONAL],
            },
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: [
                    'Content-Type',
                    'X-Amz-Date',
                    'Authorization',
                    'X-Api-Key',
                    'X-Amz-Security-Token',
                ],
            },
            deployOptions: {
                stageName: config.stage,
                throttlingRateLimit: 1000,
                throttlingBurstLimit: 2000,
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                tracingEnabled: true,
                dataTraceEnabled: true,
            },
        });
        // Create Cognito Authorizer
        this.authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
            cognitoUserPools: [userPool],
            authorizerName: `${config.prefix}-cognito-authorizer`,
            identitySource: 'method.request.header.Authorization',
        });
        // API Key for programmatic access
        const apiKey = this.api.addApiKey(`${config.prefix}-api-key`, {
            apiKeyName: `${config.prefix}-api-key`,
            description: 'API Key for programmatic access to AI Compliance Shepherd',
        });
        const usagePlan = this.api.addUsagePlan(`${config.prefix}-usage-plan`, {
            name: `${config.prefix}-usage-plan`,
            description: 'Usage plan for AI Compliance Shepherd API',
            throttle: {
                rateLimit: 1000,
                burstLimit: 2000,
            },
            quota: {
                limit: 10000,
                period: apigateway.Period.DAY,
            },
        });
        usagePlan.addApiKey(apiKey);
        usagePlan.addApiStage({
            stage: this.api.deploymentStage,
            api: this.api,
        });
        // Health Check endpoint
        this.api.root.addMethod('GET', new apigateway.LambdaIntegration(apiGatewayFunction), {
            apiKeyRequired: false,
            methodResponses: [
                {
                    statusCode: '200',
                    responseModels: {
                        'application/json': apigateway.Model.EMPTY_MODEL,
                    },
                },
            ],
        });
        // Authenticated endpoints with Cognito authorization
        const authenticatedOptions = {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            apiKeyRequired: true,
        };
        // Scan endpoint
        const scans = this.api.root.addResource('scans');
        scans.addMethod('POST', new apigateway.LambdaIntegration(scanEnvironmentFunction), authenticatedOptions);
        scans.addMethod('GET', new apigateway.LambdaIntegration(apiGatewayFunction), authenticatedOptions);
        const scansById = scans.addResource('{scanId}');
        scansById.addMethod('GET', new apigateway.LambdaIntegration(scanEnvironmentFunction), authenticatedOptions);
        scansById.addMethod('DELETE', new apigateway.LambdaIntegration(scanEnvironmentFunction), authenticatedOptions);
        // Findings endpoint
        const findings = this.api.root.addResource('findings');
        findings.addMethod('GET', new apigateway.LambdaIntegration(findingsStorageFunction), authenticatedOptions);
        const findingsById = findings.addResource('{findingId}');
        findingsById.addMethod('GET', new apigateway.LambdaIntegration(findingsStorageFunction), authenticatedOptions);
        findingsById.addMethod('PATCH', new apigateway.LambdaIntegration(findingsStorageFunction), authenticatedOptions);
        // Reports endpoint
        const reports = this.api.root.addResource('reports');
        reports.addMethod('POST', new apigateway.LambdaIntegration(htmlReportGeneratorFunction), authenticatedOptions);
        const reportsById = reports.addResource('{reportId}');
        reportsById.addMethod('GET', new apigateway.LambdaIntegration(htmlReportGeneratorFunction), authenticatedOptions);
        // Terraform analysis endpoint
        const terraform = this.api.root.addResource('terraform');
        terraform.addMethod('POST', new apigateway.LambdaIntegration(terraformAnalyzerFunction), authenticatedOptions);
        // Admin endpoints with API key authorization
        const adminOptions = {
            authorizationType: apigateway.AuthorizationType.API_KEY,
            apiKeyRequired: true,
        };
        // Admin endpoints
        const admin = this.api.root.addResource('admin');
        // Users endpoint
        const users = admin.addResource('users');
        users.addMethod('GET', new apigateway.LambdaIntegration(apiGatewayFunction), adminOptions);
        users.addMethod('POST', new apigateway.LambdaIntegration(apiGatewayFunction), adminOptions);
        const usersById = users.addResource('{userId}');
        usersById.addMethod('GET', new apigateway.LambdaIntegration(apiGatewayFunction), adminOptions);
        usersById.addMethod('PUT', new apigateway.LambdaIntegration(apiGatewayFunction), adminOptions);
        usersById.addMethod('DELETE', new apigateway.LambdaIntegration(apiGatewayFunction), adminOptions);
        // Tenants endpoint
        const tenants = admin.addResource('tenants');
        tenants.addMethod('GET', new apigateway.LambdaIntegration(apiGatewayFunction), adminOptions);
        tenants.addMethod('POST', new apigateway.LambdaIntegration(apiGatewayFunction), adminOptions);
        const tenantsById = tenants.addResource('{tenantId}');
        tenantsById.addMethod('GET', new apigateway.LambdaIntegration(apiGatewayFunction), adminOptions);
        tenantsById.addMethod('PUT', new apigateway.LambdaIntegration(apiGatewayFunction), adminOptions);
        tenantsById.addMethod('DELETE', new apigateway.LambdaIntegration(apiGatewayFunction), adminOptions);
        // Webhook endpoints (no authentication required for webhooks)
        const webhooks = this.api.root.addResource('webhooks');
        const githubWebhooks = webhooks.addResource('github');
        githubWebhooks.addMethod('POST', new apigateway.LambdaIntegration(apiGatewayFunction), {
            apiKeyRequired: false,
            authorizationType: apigateway.AuthorizationType.NONE,
        });
        const slackWebhooks = webhooks.addResource('slack');
        slackWebhooks.addMethod('POST', new apigateway.LambdaIntegration(apiGatewayFunction), {
            apiKeyRequired: false,
            authorizationType: apigateway.AuthorizationType.NONE,
        });
        // Chat endpoint (WebSocket)
        const chat = this.api.root.addResource('chat');
        chat.addMethod('POST', new apigateway.LambdaIntegration(apiGatewayFunction), authenticatedOptions);
        // Outputs
        new aws_cdk_lib_1.CfnOutput(this, 'ApiGatewayUrl', {
            value: this.api.url,
            description: 'API Gateway URL'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'ApiGatewayId', {
            value: this.api.restApiId,
            description: 'API Gateway ID'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'ApiKey', {
            value: apiKey.keyId,
            description: 'API Key ID'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'AuthorizerId', {
            value: this.authorizer.authorizerId,
            description: 'API Gateway Cognito Authorizer ID'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'UsagePlanId', {
            value: usagePlan.usagePlanId,
            description: 'Usage Plan ID'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'ApiStackName', {
            value: this.stackName,
            description: 'API Stack Name'
        });
    }
    get stackName() {
        return this.stackName;
    }
}
exports.ApiStack = ApiStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2FwaS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2Q0FBMkQ7QUFDM0QseURBQXlEO0FBQ3pELG1EQUFtRDtBQUNuRCxpREFBaUQ7QUFnQmpELE1BQWEsUUFBUyxTQUFRLG1CQUFLO0lBSWpDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBb0I7UUFDNUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV6Qix5Q0FBeUM7UUFDekMsTUFBTSxXQUFXLEdBQUcsbUJBQUssQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUVyRSwwQkFBMEI7UUFDMUIsTUFBTSx1QkFBdUIsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUM5RCxJQUFJLEVBQ0oseUJBQXlCLEVBQ3pCLEdBQUcsTUFBTSxDQUFDLE1BQU0sbUJBQW1CLENBQ3BDLENBQUM7UUFFRixNQUFNLHVCQUF1QixHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQzlELElBQUksRUFDSix5QkFBeUIsRUFDekIsR0FBRyxNQUFNLENBQUMsTUFBTSxtQkFBbUIsQ0FDcEMsQ0FBQztRQUVGLE1BQU0sa0JBQWtCLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FDekQsSUFBSSxFQUNKLG9CQUFvQixFQUNwQixHQUFHLE1BQU0sQ0FBQyxNQUFNLGNBQWMsQ0FDL0IsQ0FBQztRQUVGLE1BQU0sMkJBQTJCLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FDbEUsSUFBSSxFQUNKLDZCQUE2QixFQUM3QixHQUFHLE1BQU0sQ0FBQyxNQUFNLHdCQUF3QixDQUN6QyxDQUFDO1FBRUYsTUFBTSx5QkFB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QUFJLEVBQUUsYUFBYSxFQUFFO1lBQ2pDLEtBQUssRUFBRSxTQUFTLENBQUMsV0FBVztZQUM1QixXQUFXLEVBQUUsZUFBZTtTQUM3QixDQUFDLENBQUM7UUFFSCxJQUFJLHVCQUFTLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUNsQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFNBQVM7WUFDckIsV0FBVyxFQUFFLGdCQUFnQjtTQUM5QixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsSUFBVyxTQUFTO1FBQ2xCLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUN4QixDQUFDO0NBQ0Y7QUF0UEQsNEJBc1BDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgU3RhY2ssIFN0YWNrUHJvcHMsIENmbk91dHB1dCB9IGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XHJcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xyXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBBcGlTdGFja1Byb3BzIGV4dGVuZHMgU3RhY2tQcm9wcyB7XHJcbiAgY29uZmlnOiB7XHJcbiAgICBhY2NvdW50OiBzdHJpbmc7XHJcbiAgICByZWdpb246IHN0cmluZztcclxuICAgIGVudmlyb25tZW50OiBzdHJpbmc7XHJcbiAgICBzdGFnZTogc3RyaW5nO1xyXG4gICAgcHJlZml4OiBzdHJpbmc7XHJcbiAgfTtcclxuICBsYW1iZGFTdGFja05hbWU6IHN0cmluZztcclxuICBzZWN1cml0eVN0YWNrTmFtZTogc3RyaW5nO1xyXG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBBcGlTdGFjayBleHRlbmRzIFN0YWNrIHtcclxuICBwdWJsaWMgcmVhZG9ubHkgYXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XHJcbiAgcHVibGljIHJlYWRvbmx5IGF1dGhvcml6ZXI6IGFwaWdhdGV3YXkuQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXI7XHJcblxyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBcGlTdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuXHJcbiAgICBjb25zdCB7IGNvbmZpZyB9ID0gcHJvcHM7XHJcblxyXG4gICAgLy8gR2V0IExhbWJkYSBmdW5jdGlvbnMgZnJvbSBMYW1iZGEgc3RhY2tcclxuICAgIGNvbnN0IGxhbWJkYVN0YWNrID0gU3RhY2suZnJvbVN0YWNrTmFtZSh0aGlzLCBwcm9wcy5sYW1iZGFTdGFja05hbWUpO1xyXG5cclxuICAgIC8vIEltcG9ydCBMYW1iZGEgZnVuY3Rpb25zXHJcbiAgICBjb25zdCBzY2FuRW52aXJvbm1lbnRGdW5jdGlvbiA9IGxhbWJkYS5GdW5jdGlvbi5mcm9tRnVuY3Rpb25OYW1lKFxyXG4gICAgICB0aGlzLCBcclxuICAgICAgJ1NjYW5FbnZpcm9ubWVudEZ1bmN0aW9uJywgXHJcbiAgICAgIGAke2NvbmZpZy5wcmVmaXh9LXNjYW4tZW52aXJvbm1lbnRgXHJcbiAgICApO1xyXG5cclxuICAgIGNvbnN0IGZpbmRpbmdzU3RvcmFnZUZ1bmN0aW9uID0gbGFtYmRhLkZ1bmN0aW9uLmZyb21GdW5jdGlvbk5hbWUoXHJcbiAgICAgIHRoaXMsIFxyXG4gICAgICAnRmluZGluZ3NTdG9yYWdlRnVuY3Rpb24nLCBcclxuICAgICAgYCR7Y29uZmlnLnByZWZpeH0tZmluZGluZ3Mtc3RvcmFnZWBcclxuICAgICk7XHJcblxyXG4gICAgY29uc3QgYXBpR2F0ZXdheUZ1bmN0aW9uID0gbGFtYmRhLkZ1bmN0aW9uLmZyb21GdW5jdGlvbk5hbWUoXHJcbiAgICAgIHRoaXMsIFxyXG4gICAgICAnQXBpR2F0ZXdheUZ1bmN0aW9uJywgXHJcbiAgICAgIGAke2NvbmZpZy5wcmVmaXh9LWFwaS1nYXRld2F5YFxyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCBodG1sUmVwb3J0R2VuZXJhdG9yRnVuY3Rpb24gPSBsYW1iZGEuRnVuY3Rpb24uZnJvbUZ1bmN0aW9uTmFtZShcclxuICAgICAgdGhpcywgXHJcbiAgICAgICdIVE1MUmVwb3J0R2VuZXJhdG9yRnVuY3Rpb24nLCBcclxuICAgICAgYCR7Y29uZmlnLnByZWZpeH0taHRtbC1yZXBvcnQtZ2VuZXJhdG9yYFxyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCB0ZXJyYWZvcm1BbmFseXplckZ1bmN0aW9uID0gbGFtYmRhLkZ1bmN0aW9uLmZyb21GdW5jdGlvbk5hbWUoXHJcbiAgICAgIHRoaXMsIFxyXG4gICAgICAnVGVycmFmb3JtQW5hbHl6ZXJGdW5jdGlvbicsIFxyXG4gICAgICBgJHtjb25maWcucHJlZml4fS10ZXJyYWZvcm0tYW5hbHl6ZXJgXHJcbiAgICApO1xyXG5cclxuICAgIGNvbnN0IHdlYlVJRnVuY3Rpb24gPSBsYW1iZGEuRnVuY3Rpb24uZnJvbUZ1bmN0aW9uTmFtZShcclxuICAgICAgdGhpcywgXHJcbiAgICAgICdXZWJVSUZ1bmN0aW9uJywgXHJcbiAgICAgIGAke2NvbmZpZy5wcmVmaXh9LXdlYi11aWBcclxuICAgICk7XHJcblxyXG4gICAgLy8gSW1wb3J0IENvZ25pdG8gVXNlciBQb29sIGZyb20gU2VjdXJpdHkgc3RhY2tcclxuICAgIGNvbnN0IHVzZXJQb29sID0gY29nbml0by5Vc2VyUG9vbC5mcm9tVXNlclBvb2xJZChcclxuICAgICAgdGhpcywgXHJcbiAgICAgICdVc2VyUG9vbCcsIFxyXG4gICAgICBgJHtjb25maWcucHJlZml4fS11c2Vyc2BcclxuICAgICk7XHJcblxyXG4gICAgLy8gQ3JlYXRlIEFQSSBHYXRld2F5XHJcbiAgICB0aGlzLmFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ0FpQ29tcGxpYW5jZUFwaScsIHtcclxuICAgICAgcmVzdEFwaU5hbWU6IGAke2NvbmZpZy5wcmVmaXh9LWFwaWAsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQUkgQ29tcGxpYW5jZSBTaGVwaGVyZCBBUEknLFxyXG4gICAgICBlbmRwb2ludENvbmZpZ3VyYXRpb246IHtcclxuICAgICAgICB0eXBlczogW2FwaWdhdGV3YXkuRW5kcG9pbnRUeXBlLlJFR0lPTkFMXSxcclxuICAgICAgfSxcclxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XHJcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXHJcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXHJcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbXHJcbiAgICAgICAgICAnQ29udGVudC1UeXBlJyxcclxuICAgICAgICAgICdYLUFtei1EYXRlJyxcclxuICAgICAgICAgICdBdXRob3JpemF0aW9uJyxcclxuICAgICAgICAgICdYLUFwaS1LZXknLFxyXG4gICAgICAgICAgJ1gtQW16LVNlY3VyaXR5LVRva2VuJyxcclxuICAgICAgICBdLFxyXG4gICAgICB9LFxyXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XHJcbiAgICAgICAgc3RhZ2VOYW1lOiBjb25maWcuc3RhZ2UsXHJcbiAgICAgICAgdGhyb3R0bGluZ1JhdGVMaW1pdDogMTAwMCxcclxuICAgICAgICB0aHJvdHRsaW5nQnVyc3RMaW1pdDogMjAwMCxcclxuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLklORk8sXHJcbiAgICAgICAgdHJhY2luZ0VuYWJsZWQ6IHRydWUsXHJcbiAgICAgICAgZGF0YVRyYWNlRW5hYmxlZDogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENyZWF0ZSBDb2duaXRvIEF1dGhvcml6ZXJcclxuICAgIHRoaXMuYXV0aG9yaXplciA9IG5ldyBhcGlnYXRld2F5LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKHRoaXMsICdDb2duaXRvQXV0aG9yaXplcicsIHtcclxuICAgICAgY29nbml0b1VzZXJQb29sczogW3VzZXJQb29sXSxcclxuICAgICAgYXV0aG9yaXplck5hbWU6IGAke2NvbmZpZy5wcmVmaXh9LWNvZ25pdG8tYXV0aG9yaXplcmAsXHJcbiAgICAgIGlkZW50aXR5U291cmNlOiAnbWV0aG9kLnJlcXVlc3QuaGVhZGVyLkF1dGhvcml6YXRpb24nLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQVBJIEtleSBmb3IgcHJvZ3JhbW1hdGljIGFjY2Vzc1xyXG4gICAgY29uc3QgYXBpS2V5ID0gdGhpcy5hcGkuYWRkQXBpS2V5KGAke2NvbmZpZy5wcmVmaXh9LWFwaS1rZXlgLCB7XHJcbiAgICAgIGFwaUtleU5hbWU6IGAke2NvbmZpZy5wcmVmaXh9LWFwaS1rZXlgLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBLZXkgZm9yIHByb2dyYW1tYXRpYyBhY2Nlc3MgdG8gQUkgQ29tcGxpYW5jZSBTaGVwaGVyZCcsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCB1c2FnZVBsYW4gPSB0aGlzLmFwaS5hZGRVc2FnZVBsYW4oYCR7Y29uZmlnLnByZWZpeH0tdXNhZ2UtcGxhbmAsIHtcclxuICAgICAgbmFtZTogYCR7Y29uZmlnLnByZWZpeH0tdXNhZ2UtcGxhbmAsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnVXNhZ2UgcGxhbiBmb3IgQUkgQ29tcGxpYW5jZSBTaGVwaGVyZCBBUEknLFxyXG4gICAgICB0aHJvdHRsZToge1xyXG4gICAgICAgIHJhdGVMaW1pdDogMTAwMCxcclxuICAgICAgICBidXJzdExpbWl0OiAyMDAwLFxyXG4gICAgICB9LFxyXG4gICAgICBxdW90YToge1xyXG4gICAgICAgIGxpbWl0OiAxMDAwMCxcclxuICAgICAgICBwZXJpb2Q6IGFwaWdhdGV3YXkuUGVyaW9kLkRBWSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIHVzYWdlUGxhbi5hZGRBcGlLZXkoYXBpS2V5KTtcclxuICAgIHVzYWdlUGxhbi5hZGRBcGlTdGFnZSh7XHJcbiAgICAgIHN0YWdlOiB0aGlzLmFwaS5kZXBsb3ltZW50U3RhZ2UsXHJcbiAgICAgIGFwaTogdGhpcy5hcGksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBIZWFsdGggQ2hlY2sgZW5kcG9pbnRcclxuICAgIHRoaXMuYXBpLnJvb3QuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlHYXRld2F5RnVuY3Rpb24pLCB7XHJcbiAgICAgIGFwaUtleVJlcXVpcmVkOiBmYWxzZSxcclxuICAgICAgbWV0aG9kUmVzcG9uc2VzOiBbXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXHJcbiAgICAgICAgICByZXNwb25zZU1vZGVsczoge1xyXG4gICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6IGFwaWdhdGV3YXkuTW9kZWwuRU1QVFlfTU9ERUwsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBdXRoZW50aWNhdGVkIGVuZHBvaW50cyB3aXRoIENvZ25pdG8gYXV0aG9yaXphdGlvblxyXG4gICAgY29uc3QgYXV0aGVudGljYXRlZE9wdGlvbnMgPSB7XHJcbiAgICAgIGF1dGhvcml6ZXI6IHRoaXMuYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgICAgYXBpS2V5UmVxdWlyZWQ6IHRydWUsXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIFNjYW4gZW5kcG9pbnRcclxuICAgIGNvbnN0IHNjYW5zID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnc2NhbnMnKTtcclxuICAgIHNjYW5zLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNjYW5FbnZpcm9ubWVudEZ1bmN0aW9uKSwgYXV0aGVudGljYXRlZE9wdGlvbnMpO1xyXG4gICAgc2NhbnMuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlHYXRld2F5RnVuY3Rpb24pLCBhdXRoZW50aWNhdGVkT3B0aW9ucyk7XHJcbiAgICBcclxuICAgIGNvbnN0IHNjYW5zQnlJZCA9IHNjYW5zLmFkZFJlc291cmNlKCd7c2NhbklkfScpO1xyXG4gICAgc2NhbnNCeUlkLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc2NhbkVudmlyb25tZW50RnVuY3Rpb24pLCBhdXRoZW50aWNhdGVkT3B0aW9ucyk7XHJcbiAgICBzY2Fuc0J5SWQuYWRkTWV0aG9kKCdERUxFVEUnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzY2FuRW52aXJvbm1lbnRGdW5jdGlvbiksIGF1dGhlbnRpY2F0ZWRPcHRpb25zKTtcclxuXHJcbiAgICAvLyBGaW5kaW5ncyBlbmRwb2ludFxyXG4gICAgY29uc3QgZmluZGluZ3MgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdmaW5kaW5ncycpO1xyXG4gICAgZmluZGluZ3MuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmaW5kaW5nc1N0b3JhZ2VGdW5jdGlvbiksIGF1dGhlbnRpY2F0ZWRPcHRpb25zKTtcclxuICAgIFxyXG4gICAgY29uc3QgZmluZGluZ3NCeUlkID0gZmluZGluZ3MuYWRkUmVzb3VyY2UoJ3tmaW5kaW5nSWR9Jyk7XHJcbiAgICBmaW5kaW5nc0J5SWQuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmaW5kaW5nc1N0b3JhZ2VGdW5jdGlvbiksIGF1dGhlbnRpY2F0ZWRPcHRpb25zKTtcclxuICAgIGZpbmRpbmdzQnlJZC5hZGRNZXRob2QoJ1BBVENIJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZmluZGluZ3NTdG9yYWdlRnVuY3Rpb24pLCBhdXRoZW50aWNhdGVkT3B0aW9ucyk7XHJcblxyXG4gICAgLy8gUmVwb3J0cyBlbmRwb2ludFxyXG4gICAgY29uc3QgcmVwb3J0cyA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3JlcG9ydHMnKTtcclxuICAgIHJlcG9ydHMuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oaHRtbFJlcG9ydEdlbmVyYXRvckZ1bmN0aW9uKSwgYXV0aGVudGljYXRlZE9wdGlvbnMpO1xyXG4gICAgXHJcbiAgICBjb25zdCByZXBvcnRzQnlJZCA9IHJlcG9ydHMuYWRkUmVzb3VyY2UoJ3tyZXBvcnRJZH0nKTtcclxuICAgIHJlcG9ydHNCeUlkLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oaHRtbFJlcG9ydEdlbmVyYXRvckZ1bmN0aW9uKSwgYXV0aGVudGljYXRlZE9wdGlvbnMpO1xyXG5cclxuICAgIC8vIFRlcnJhZm9ybSBhbmFseXNpcyBlbmRwb2ludFxyXG4gICAgY29uc3QgdGVycmFmb3JtID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgndGVycmFmb3JtJyk7XHJcbiAgICB0ZXJyYWZvcm0uYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGVycmFmb3JtQW5hbHl6ZXJGdW5jdGlvbiksIGF1dGhlbnRpY2F0ZWRPcHRpb25zKTtcclxuXHJcbiAgICAvLyBBZG1pbiBlbmRwb2ludHMgd2l0aCBBUEkga2V5IGF1dGhvcml6YXRpb25cclxuICAgIGNvbnN0IGFkbWluT3B0aW9ucyA9IHtcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQVBJX0tFWSxcclxuICAgICAgYXBpS2V5UmVxdWlyZWQ6IHRydWUsXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIEFkbWluIGVuZHBvaW50c1xyXG4gICAgY29uc3QgYWRtaW4gPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdhZG1pbicpO1xyXG4gICAgXHJcbiAgICAvLyBVc2VycyBlbmRwb2ludFxyXG4gICAgY29uc3QgdXNlcnMgPSBhZG1pbi5hZGRSZXNvdXJjZSgndXNlcnMnKTtcclxuICAgIHVzZXJzLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYXBpR2F0ZXdheUZ1bmN0aW9uKSwgYWRtaW5PcHRpb25zKTtcclxuICAgIHVzZXJzLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFwaUdhdGV3YXlGdW5jdGlvbiksIGFkbWluT3B0aW9ucyk7XHJcbiAgICBcclxuICAgIGNvbnN0IHVzZXJzQnlJZCA9IHVzZXJzLmFkZFJlc291cmNlKCd7dXNlcklkfScpO1xyXG4gICAgdXNlcnNCeUlkLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYXBpR2F0ZXdheUZ1bmN0aW9uKSwgYWRtaW5PcHRpb25zKTtcclxuICAgIHVzZXJzQnlJZC5hZGRNZXRob2QoJ1BVVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFwaUdhdGV3YXlGdW5jdGlvbiksIGFkbWluT3B0aW9ucyk7XHJcbiAgICB1c2Vyc0J5SWQuYWRkTWV0aG9kKCdERUxFVEUnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlHYXRld2F5RnVuY3Rpb24pLCBhZG1pbk9wdGlvbnMpO1xyXG5cclxuICAgIC8vIFRlbmFudHMgZW5kcG9pbnRcclxuICAgIGNvbnN0IHRlbmFudHMgPSBhZG1pbi5hZGRSZXNvdXJjZSgndGVuYW50cycpO1xyXG4gICAgdGVuYW50cy5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFwaUdhdGV3YXlGdW5jdGlvbiksIGFkbWluT3B0aW9ucyk7XHJcbiAgICB0ZW5hbnRzLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFwaUdhdGV3YXlGdW5jdGlvbiksIGFkbWluT3B0aW9ucyk7XHJcbiAgICBcclxuICAgIGNvbnN0IHRlbmFudHNCeUlkID0gdGVuYW50cy5hZGRSZXNvdXJjZSgne3RlbmFudElkfScpO1xyXG4gICAgdGVuYW50c0J5SWQuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlHYXRld2F5RnVuY3Rpb24pLCBhZG1pbk9wdGlvbnMpO1xyXG4gICAgdGVuYW50c0J5SWQuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlHYXRld2F5RnVuY3Rpb24pLCBhZG1pbk9wdGlvbnMpO1xyXG4gICAgdGVuYW50c0J5SWQuYWRkTWV0aG9kKCdERUxFVEUnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlHYXRld2F5RnVuY3Rpb24pLCBhZG1pbk9wdGlvbnMpO1xyXG5cclxuICAgIC8vIFdlYmhvb2sgZW5kcG9pbnRzIChubyBhdXRoZW50aWNhdGlvbiByZXF1aXJlZCBmb3Igd2ViaG9va3MpXHJcbiAgICBjb25zdCB3ZWJob29rcyA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3dlYmhvb2tzJyk7XHJcbiAgICBjb25zdCBnaXRodWJXZWJob29rcyA9IHdlYmhvb2tzLmFkZFJlc291cmNlKCdnaXRodWInKTtcclxuICAgIGdpdGh1YldlYmhvb2tzLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFwaUdhdGV3YXlGdW5jdGlvbiksIHtcclxuICAgICAgYXBpS2V5UmVxdWlyZWQ6IGZhbHNlLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5OT05FLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3Qgc2xhY2tXZWJob29rcyA9IHdlYmhvb2tzLmFkZFJlc291cmNlKCdzbGFjaycpO1xyXG4gICAgc2xhY2tXZWJob29rcy5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlHYXRld2F5RnVuY3Rpb24pLCB7XHJcbiAgICAgIGFwaUtleVJlcXVpcmVkOiBmYWxzZSxcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuTk9ORSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENoYXQgZW5kcG9pbnQgKFdlYlNvY2tldClcclxuICAgIGNvbnN0IGNoYXQgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdjaGF0Jyk7XHJcbiAgICBjaGF0LmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFwaUdhdGV3YXlGdW5jdGlvbiksIGF1dGhlbnRpY2F0ZWRPcHRpb25zKTtcclxuXHJcbiAgICAvLyBPdXRwdXRzXHJcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdBcGlHYXRld2F5VXJsJywge1xyXG4gICAgICB2YWx1ZTogdGhpcy5hcGkudXJsLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IFVSTCdcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ0FwaUdhdGV3YXlJZCcsIHtcclxuICAgICAgdmFsdWU6IHRoaXMuYXBpLnJlc3RBcGlJZCxcclxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBJRCdcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ0FwaUtleScsIHtcclxuICAgICAgdmFsdWU6IGFwaUtleS5rZXlJZCxcclxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgS2V5IElEJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnQXV0aG9yaXplcklkJywge1xyXG4gICAgICB2YWx1ZTogdGhpcy5hdXRob3JpemVyLmF1dGhvcml6ZXJJZCxcclxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBDb2duaXRvIEF1dGhvcml6ZXIgSUQnXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdVc2FnZVBsYW5JZCcsIHtcclxuICAgICAgdmFsdWU6IHVzYWdlUGxhbi51c2FnZVBsYW5JZCxcclxuICAgICAgZGVzY3JpcHRpb246ICdVc2FnZSBQbGFuIElEJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnQXBpU3RhY2tOYW1lJywge1xyXG4gICAgICB2YWx1ZTogdGhpcy5zdGFja05hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIFN0YWNrIE5hbWUnXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgc3RhY2tOYW1lKCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5zdGFja05hbWU7XHJcbiAgfVxyXG59XHJcbiJdfQ==