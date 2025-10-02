import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface ApiStackProps extends StackProps {
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

export class ApiStack extends Stack {
  public readonly api: apigateway.RestApi;
  public readonly authorizer: apigateway.CognitoUserPoolsAuthorizer;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Get Lambda functions from Lambda stack
    const lambdaStack = Stack.fromStackName(this, props.lambdaStackName);

    // Import Lambda functions
    const scanEnvironmentFunction = lambda.Function.fromFunctionName(
      this, 
      'ScanEnvironmentFunction', 
      `${config.prefix}-scan-environment`
    );

    const findingsStorageFunction = lambda.Function.fromFunctionName(
      this, 
      'FindingsStorageFunction', 
      `${config.prefix}-findings-storage`
    );

    const apiGatewayFunction = lambda.Function.fromFunctionName(
      this, 
      'ApiGatewayFunction', 
      `${config.prefix}-api-gateway`
    );

    const htmlReportGeneratorFunction = lambda.Function.fromFunctionName(
      this, 
      'HTMLReportGeneratorFunction', 
      `${config.prefix}-html-report-generator`
    );

    const terraformAnalyzerFunction = lambda.Function.fromFunctionName(
      this, 
      'TerraformAnalyzerFunction', 
      `${config.prefix}-terraform-analyzer`
    );

    const webUIFunction = lambda.Function.fromFunctionName(
      this, 
      'WebUIFunction', 
      `${config.prefix}-web-ui`
    );

    // Import Cognito User Pool from Security stack
    const userPool = cognito.UserPool.fromUserPoolId(
      this, 
      'UserPool', 
      `${config.prefix}-users`
    );

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
    new CfnOutput(this, 'ApiGatewayUrl', {
      value: this.api.url,
      description: 'API Gateway URL'
    });

    new CfnOutput(this, 'ApiGatewayId', {
      value: this.api.restApiId,
      description: 'API Gateway ID'
    });

    new CfnOutput(this, 'ApiKey', {
      value: apiKey.keyId,
      description: 'API Key ID'
    });

    new CfnOutput(this, 'AuthorizerId', {
      value: this.authorizer.authorizerId,
      description: 'API Gateway Cognito Authorizer ID'
    });

    new CfnOutput(this, 'UsagePlanId', {
      value: usagePlan.usagePlanId,
      description: 'Usage Plan ID'
    });

    new CfnOutput(this, 'ApiStackName', {
      value: this.stackName,
      description: 'API Stack Name'
    });
  }

  public get stackName(): string {
    return this.stackName;
  }
}
