import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface AiCompliancePlatformStackProps extends StackProps {
  config: {
    account: string;
    region: string;
    environment: string;
    stage: string;
    prefix: string;
  };
  description: string;
}

export class AiCompliancePlatformStack extends Stack {
  constructor(scope: Construct, id: string, props: AiCompliancePlatformStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Platform information outputs
    new CfnOutput(this, 'PlatformName', {
      value: 'AI Compliance Shepherd',
      description: 'AI Compliance Shepherd Platform Name'
    });

    new CfnOutput(this, 'Environment', {
      value: config.environment,
      description: 'Deployment Environment'
    });

    new CfnOutput(this, 'Region', {
      value: config.region,
      description: 'AWS Region'
    });

    new CfnOutput(this, 'Account', {
      value: config.account,
      description: 'AWS Account ID'
    });

    new CfnOutput(this, 'DeploymentPrefix', {
      value: config.prefix,
      description: 'Resource Prefix for This Deployment'
    });

    // Platform capabilities output
    new CfnOutput(scope: this, 'PlatformCapabilities', {
      value: JSON.stringify({
        features: [
          'Automated AWS Compliance Scanning',
          'AI-Powered Chat Interface',
          'Multi-Framework Support (SOC 2, HIPAA, PCI-DSS, GDPR)',
          'Automated Remediation',
          'Professional Audit Reports',
          'Multi-Tenant Architecture',
          'Real-Time Monitoring',
          'GitHub Integration',
          'Slack Notifications',
          'Terraform Analysis'
        ],
        frameworks: [
          'SOC 2 Type II',
          'HIPAA',
          'PCI-DSS',
          'GDPR',
          'ISO 27001'
        ],
        awsServices: [
          'Lambda',
          'API Gateway',
          'DynamoDB',
          'S3',
          'KMS',
          'CloudWatch',
          'X-Ray',
          'Step Functions',
          'EventBridge',
          'Bedrock',
          'Bedrock Agent'
        ]
      }),
      description: 'Platform Capabilities and Features'
    });

    // Service endpoints (will be populated by other stacks)
    new CfnOutput(this, 'ServiceEndpoints', {
      value: JSON.stringify({
        apiGateway: 'TBD',
        webUI: 'TBD',
        webhookEndpoint: 'TBD'
      }),
      description: 'Service Endpoints and URLs'
    });

    // Stack dependency information
    new CfnOutput(this, 'StackDependencies', {
      value: JSON.stringify({
        core: true,
        database: false,
        security: false,
        storage: false,
        lambda: false,
        api: false,
        monitoring: false,
        integration: false
      }),
      description: 'Stack Dependency Status'
    });
  }

  public get stackName(): string {
    return this.stackName;
  }
}
