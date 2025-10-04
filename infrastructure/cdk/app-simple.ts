#!/usr/bin/env node

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

// Simple demo stack for hackathon
export class SimpleAiComplianceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Demonstrate CDK is working
    const lambda = new cdk.aws_lambda.Function(this, 'DemoLambda', {
      runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: cdk.aws_lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('AI Compliance Shepherd Demo');
          return {
            statusCode: 200,
            body: JSON.stringify({
              message: 'AI Compliance Shepherd Platform Ready',
              timestamp: new Date().toISOString(),
              environment: 'demo'
            })
          };
        };
      `),
      description: 'AI Compliance Shepherd Demo Lambda Function'
    });

    // API Gateway for demo
    const api = new cdk.aws_apigateway.RestApi(this, 'DemoAPI', {
      restApiName: 'AI Compliance Shepherd Demo API',
      description: 'Demo API for AI Compliance Shepherd Platform',
      endpointConfiguration: {
        types: [cdk.aws_apigateway.EndpointType.REGIONAL]
      }
    });

    // Lambda integration
    const lambdaIntegration = new cdk.aws_apigateway.LambdaIntegration(lambda);

    // API endpoints
    api.root.addMethod('GET');
    api.root.addResource('health').addMethod('GET', lambdaIntegration);
    api.root.addResource('demo').addMethod('GET', lambdaIntegration);

    // DynamoDB table for demo
    const dynamoTable = new cdk.aws_dynamodb.Table(this, 'DemoTable', {
      tableName: 'ai-compliance-demo-findings',
      partitionKey: { name: 'id', type: cdk.aws_dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: cdk.aws_dynamodb.AttributeType.STRING },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For demo purposes
      stream: cdk.aws_dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
    });

    // S3 bucket for demo
    const s3Bucket = new cdk.aws_s3.Bucket(this, 'DemoBucket', {
      bucketName: `${props?.env?.account}-ai-compliance-demo-${Date.now()}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For demo purposes
      autoDeleteObjects: true, // For demo purposes
      blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
      encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
      versioned: true
    });

    // CloudWatch dashboard for demo
    const dashboard = new cdk.aws_cloudwatch.Dashboard(this, 'DemoDashboard', {
      dashboardName: 'AI-Compliance-Demo-Dashboard'
    });

    dashboard.addWidgets(
      new cdk.aws_cloudwatch.TextWidget({
        markdown: '# AI Compliance Shepherd Demo\n\nThis is a demonstration of the AI Compliance Shepherd platform architecture.'
      })
    );

    // Grant permissions
    lambda.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:Query'],
      resources: [dynamoTable.tableArn]
    }));

    lambda.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject'],
      resources: [`${s3Bucket.bucketArn}/*`]
    }));

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'Demo API URL'
    });

    new cdk.CfnOutput(this, 'LambdaArn', {
      value: lambda.functionArn,
      description: 'Demo Lambda Function ARN'
    });

    new cdk.CfnOutput(this, 'DynamoTableName', {
      value: dynamoTable.tableName,
      description: 'Demo DynamoDB Table Name'
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: s3Bucket.bucketName,
      description: 'Demo S3 Bucket Name'
    });

    // Tags
    cdk.Tags.of(this).add('Project', 'AI-Compliance-Shepherd');
    cdk.Tags.of(this).add('Environment', 'demo');
    cdk.Tags.of(this).add('Stage', 'demo');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('Purpose', 'Hackathon Demo');
  }
}

// Simple app for demo
const app = new cdk.App();

const accountId = app.node.tryGetContext('accountId') || process.env.CDK_DEFAULT_ACCOUNT;
const region = app.node.tryGetContext('region') || process.env.CDK_DEFAULT_REGION || 'us-east-1';

new SimpleAiComplianceStack(app, 'AIComplianceDemoStack', {
  env: {
    account: accountId,
    region: region
  },
  description: 'AI Compliance Shepherd Demo Stack for Hackathon'
});

// Add tags to the entire app
cdk.Tags.of(app).add('Project', 'AI-Compliance-Shepherd');
cdk.Tags.of(app).add('Purpose', 'Hackathon Demo');
