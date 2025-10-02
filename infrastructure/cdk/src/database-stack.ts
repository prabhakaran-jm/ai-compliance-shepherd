import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends StackProps {
  config: {
    account: string;
    region: string;
    environment: string;
    stage: string;
    prefix: string;
  };
  description: string;
}

export class DatabaseStack extends Stack {
  public readonly tenantsTable: dynamodb.Table;
  public readonly findingsTable: dynamodb.Table;
  public readonly scanJobsTable: dynamodb.Table;
  public readonly remediationJobsTable: dynamodb.Table;
  public readonly auditLogsTable: dynamodb.Table;
  public readonly complianceRulesTable: dynamodb.Table;
  public readonly notificationSettingsTable: dynamodb.Table;
  public readonly userSessionTable: dynamodb.Table;
  public readonly subscriptionTable: dynamodb.Table;
  public readonly usageTable: dynamodb.Table;
  public readonly tenantIsolationTable: dynamodb.Table;
  public readonly stepFunctionsTemplatesTable: dynamodb.Table;
  public readonly workflowExecutionsTable: dynamodb.Table;
  public readonly eventSchedulesTable: dynamodb.Table;
  public readonly integrationConfigsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Create KMS key for DynamoDB encryption
    const dynamoDbKey = new kms.Key(this, 'DynamoDBEncryptionKey', {
      description: `DynamoDB encryption key for ${config.prefix}`,
      enableKeyRotation: true,
    });

    // Tenants Table
    this.tenantsTable = new dynamodb.Table(this, 'TenantsTable', {
      tableName: `${config.prefix}-tenants`,
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoDbKey,
      pointInTimeRecovery: true,
      removalPolicy: config.environment === 'prod' ? dynamodb.RemovalPolicy.RETAIN : dynamodb.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Findings Table
    this.findingsTable = new dynamodb.Table(this, 'FindingsTable', {
      tableName: `${config.prefix}-findings`,
      partitionKey: { name: 'findingId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoDbKey,
      pointInTimeRecovery: true,
      removalPolicy: config.environment === 'prod' ? dynamodb.RemovalPolicy.RETAIN : dynamodb.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Add GSI for findings queries
    this.findingsTable.addGlobalSecondaryIndex({
      indexName: 'TenantStatusIndex',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
    });

    this.findingsTable.addGlobalSecondaryIndex({
      indexName: 'TenantSeverityIndex',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'severity', type: dynamodb.AttributeType.STRING },
    });

    // Scan Jobs Table
    this.scanJobsTable = new dynamodb.Table(this, 'ScanJobsTable', {
      tableName: `${config.prefix}-scan-jobs`,
      partitionKey: { name: 'scanId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoDbKey,
      pointInTimeRecovery: true,
      removalPolicy: config.environment === 'prod' ? dynamodb.RemovalPolicy.RETAIN : dynamodb.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Remediation Jobs Table
    this.remediationJobsTable = new dynamodb.Table(this, 'RemediationJobsTable', {
      tableName: `${config.prefix}-remediation-jobs`,
      partitionKey: { name: 'remediationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoDbKey,
      pointInTimeRecovery: true,
      removalPolicy: config.environment === 'prod' ? dynamodb.RemovalPolicy.RETAIN : dynamodb.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Audit Logs Table
    this.auditLogsTable = new dynamodb.Table(this, 'AuditLogsTable', {
      tableName: `${config.prefix}-audit-logs`,
      partitionKey: { name: 'logId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoDbKey,
      pointInTimeRecovery: true,
      removalPolicy: config.environment === 'prod' ? dynamodb.RemovalPolicy.RETAIN : dynamodb.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Compliance Rules Table
    this.complianceRulesTable = new dynamodb.Table(this, 'ComplianceRulesTable', {
      tableName: `${config.prefix}-compliance-rules`,
      partitionKey: { name: 'ruleId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoDbKey,
      pointInTimeRecovery: true,
      removalPolicy: config.environment === 'prod' ? dynamodb.RemovalPolicy.RETAIN : dynamodb.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Notification Settings Table
    this.notificationSettingsTable = new dynamodb.Table(this, 'NotificationSettingsTable', {
      tableName: `${config.prefix}-notification-settings`,
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'channelType', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoDbKey,
      pointInTimeRecovery: true,
      removalPolicy: config.environment === 'prod' ? dynamodb.RemovalPolicy.RETAIN : dynamodb.RemovalPolicy.DESTROY,
    });

    // User Session Table
    this.userSessionTable = new dynamodb.Table(this, 'UserSessionTable', {
      tableName: `${config.prefix}-user-sessions`,
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoDbKey,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl',
      removalPolicy: config.environment === 'prod' ? dynamodb.RemovalPolicy.RETAIN : dynamodb.RemovalPolicy.DESTROY,
    });

    // Subscription Table (for marketplace)
    this.subscriptionTable = new dynamodb.Table(this, 'SubscriptionTable', {
      tableName: `${config.prefix}-subscriptions`,
      partitionKey: { name: 'subscriptionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoDbKey,
      pointInTimeRecovery: true,
      removalPolicy: config.environment === 'prod' ? dynamodb.RemovalPolicy.RETAIN : dynamodb.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Usage Table (for marketplace)
    this.usageTable = new dynamodb.Table(this, 'UsageTable', {
      tableName: `${config.prefix}-usage`,
      partitionKey: { name: 'subscriptionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoDbKey,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl',
      removalPolicy: config.environment === 'prod' ? dynamodb.RemovalPolicy.RETAIN : dynamodb.RemovalPolicy.DESTROY,
    });

    // Tenant Isolation Table
    this.tenantIsolationTable = new dynamodb.Table(this, 'TenantIsolationTable', {
      tableName: `${config.prefix}-tenant-isolation`,
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoDbKey,
      pointInTimeRecovery: true,
      removalPolicy: config.environment === 'prod' ? dynamodb.RemovalPolicy.RETAIN : dynamodb.RemovalPolicy.DESTROY,
    });

    // Step Functions Templates Table
    this.stepFunctionsTemplatesTable = new dynamodb.Table(this, 'StepFunctionsTemplatesTable', {
      tableName: `${config.prefix}-step-functions-templates`,
      partitionKey: { name: 'templateId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoDbKey,
      pointInTimeRecovery: true,
      removalPolicy: config.environment === 'prod' ? dynamodb.RemovalPolicy.RETAIN : dynamodb.RemovalPolicy.DESTROY,
    });

    // Workflow Executions Table
    this.workflowExecutionsTable = new dynamodb.Table(this, 'WorkflowExecutionsTable', {
      tableName: `${config.prefix}-workflow-executions`,
      partitionKey: { name: 'executionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoDbKey,
      pointInTimeRecovery: true,
      removalPolicy: config.environment === 'prod' ? dynamodb.RemovalPolicy.RETAIN : dynamodb.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Event Schedules Table
    this.eventSchedulesTable = new dynamodb.Table(this, 'EventSchedulesTable', {
      tableName: `${config.prefix}-event-schedules`,
      partitionKey: { name: 'scheduleId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      explosion: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoDbKey,
      pointInTimeRecovery: true,
      removalPolicy: config.environment === 'prod' ? dynamodb.RemovalPolicy.RETAIN : dynamodb.RemovalPolicy.DESTROY,
    });

    // Integration Configs Table
    this.integrationConfigsTable = new dynamodb.Table(this, 'IntegrationConfigsTable', {
      tableName: `${config.prefix}-integration-configs`,
      partitionKey: { name: 'integrationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BILLING_MODE.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoDbKey,
      pointInTimeRecovery: true,
      removalPolicy: config.environment === 'prod' ? dynamodb.RemovalPolicy.RETAIN : dynamodb.RemovalPolicy.DESTROY,
    });

    // Outputs
    new CfnOutput(this, 'DynamoDBTables', {
      value: JSON.stringify({
        tenants: this.tenantsTable.tableName,
        findings: this.findingsTable.tableName,
        scanJobs: this.scanJobsTable.tableName,
        remediationJobs: this.remediationJobsTable.tableName,
        auditLogs: this.auditLogsTable.tableName,
        complianceRules: this.complianceRulesTable.tableName,
        notificationSettings: this.notificationSettingsTable.tableName,
        userSessions: this.userSessionTable.tableName,
        subscriptions: this.subscriptionTable.tableName,
        usage: this.usageTable.tableName,
        tenantIsolation: this.tenantIsolationTable.tableName,
        stepFunctionsTemplates: this.stepFunctionsTemplatesTable.tableName,
        workflowExecutions: this.workflowExecutionsTable.tableName,
        eventSchedules: this.eventSchedulesTable.tableName,
        integrationConfigs: this.integrationConfigsTable.tableName
      }),
      description: 'DynamoDB Table Names'
    });

    new CfnOutput(this, 'DynamoDBEncryptionKey', {
      value: dynamoDbKey.keyArn,
      description: 'DynamoDB Encryption Key ARN'
    });

    new CfnOutput(this, 'DatabaseStackName', {
      value: this.stackName,
      description: 'Database Stack Name'
    });
  }

  public get stackName(): string {
    return this.stackName;
  }
}
