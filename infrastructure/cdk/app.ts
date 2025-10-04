#!/usr/bin/env node

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AiCompliancePlatformStack } from './src/ai-compliance-platform-stack';
import { DatabaseStack } from './src/database-stack';
import { ApiStack } from './src/api-stack';
import { LambdaStack } from './src/lambda-stack';
import { StorageStack } from './src/storage-stack';
import { SecurityStack } from './src/security-stack';
import { MonitoringStack } from './src/monitoring-stack';
import { IntegrationStack } from './src/integration-stack';

const app = new cdk.App();

// Get environment from context
const environment = app.node.tryGetContext('environment') || 'dev';
const region = app.node.tryGetContext('region') || 'us-east-1';

// Environment-specific configuration
const config = {
  dev: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: region,
    environment: 'dev',
    stage: 'dev',
    prefix: 'ai-compliance'
  },
  staging: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: region,
    environment: 'staging',
    stage: 'staging',
    prefix: 'ai-compliance-staging'
  },
  prod: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: region,
    environment: 'prod',
    stage: 'prod',
    prefix: 'ai-compliance-prod'
  }
};

const envConfig = config[environment as keyof typeof config] || config.dev;

// Core stack dependencies
const coreStack = new AiCompliancePlatformStack(app, `${envConfig.prefix}-core`, {
  env: { account: envConfig.account, region: envConfig.region },
  config: envConfig,
  description: 'AI Compliance Shepherd Core Platform Stack'
});

// Database infrastructure
const databaseStack = new DatabaseStack(app, `${envConfig.prefix}-database`, {
  env: { account: envConfig.account, region: envConfig.region },
  config: envConfig,
  description: 'AI Compliance Shepherd Database Stack'
});

// Security infrastructure
const securityStack = new SecurityStack(app, `${envConfig.prefix}-security`, {
  env: { account: envConfig.account, region: envConfig.region },
  config: envConfig,
  description: 'AI Compliance Shepherd Security Stack'
});

// Storage infrastructure
const storageStack = new StorageStack(app, `${envConfig.prefix}-storage`, {
  env: { account: envConfig.account, region: envConfig.region },
  config: envConfig,
  description: 'AI Compliance Shepherd Storage Stack'
});

// Lambda functions
const lambdaStack = new LambdaStack(app, `${envConfig.prefix}-lambda`, {
  env: { account: envConfig.account, region: envConfig.region },
  config: envConfig,
  description: 'AI Compliance Shepherd Lambda Stack'
});

// API Gateway
const apiStack = new ApiStack(app, `${envConfig.prefix}-api`, {
  env: { account: envConfig.account, region: envConfig.region },
  config: envConfig,
  description: 'AI Compliance Shepherd API Stack'
});

// Monitoring and observability
const monitoringStack = new MonitoringStack(app, `${envConfig.prefix}-monitoring`, {
  env: { account: envConfig.account, region: envConfig.region },
  config: envConfig,
  description: 'AI Compliance Shepherd Monitoring Stack'
});

// Integrations (GitHub, Slack, etc.)
const integrationStack = new IntegrationStack(app, `${envConfig.prefix}-integration`, {
  env: { account: envConfig.account, region: envConfig.region },
  config: envConfig,
  description: 'AI Compliance Shepherd Integration Stack'
});

// Stack dependency ordering

// Define stack dependencies
databaseStack.addDependency(coreStack);
securityStack.addDependency(coreStack);
storageStack.addDependency(securityStack);
lambdaStack.addDependency(databaseStack);
lambdaStack.addDependency(securityStack);
lambdaStack.addDependency(storageStack);
apiStack.addDependency(lambdaStack);
apiStack.addDependency(securityStack);
monitoringStack.addDependency(lambdaStack);
monitoringStack.addDependency(apiStack);
integrationStack.addDependency(lambdaStack);
integrationStack.addDependency(securityStack);

// Tags for all stacks
cdk.Tags.of(app).add('Project', 'AI-Compliance-Shepherd');
cdk.Tags.of(app).add('Environment', envConfig.environment);
cdk.Tags.of(app).add('Stage', envConfig.stage);
cdk.Tags.of(app).add('ManagedBy', 'CDK');

// Output deployment information
new cdk.CfnOutput(coreStack, 'DeploymentInfo', {
  value: JSON.stringify({
    environment: envConfig.environment,
    region: envConfig.region,
    deploymentTime: new Date().toISOString(),
    stackDependencies: {
      core: coreStack.stackName,
      database: databaseStack.stackName,
      security: securityStack.stackName,
      storage: storageStack.stackName,
      lambda: lambdaStack.stackName,
      api: apiStack.stackName,
      monitoring: monitoringStack.stackName,
      integration: integrationStack.stackName
    }
  }),
  description: 'Deployment configuration and stack information'
});
