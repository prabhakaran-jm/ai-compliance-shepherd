import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends StackProps {
  config: {
    account: string;
    region: string;
    environment: string;
    stage: string;
    prefix: string;
  };
  lambdaStackName: string;
  apiStackName: string;
  description: string;
}

export class MonitoringStack extends Stack {
  public readonly platformDashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { config } = props;

    // SNS Topic for alerts
    const alertsTopic = new sns.Topic(this, 'AlertsTopic', {
      topicName: `${config.prefix}-alerts`,
      displayName: 'AI Compliance Shepherd Alerts',
    });

    // Create Platform Overview Dashboard
    this.platformDashboard = new cloudwatch.Dashboard(this, 'PlatformDashboard', {
      dashboardName: `${config.prefix}-platform-overview`,
    });

    // Lambda Performance Metrics
    const lambdaErrorMetric = new cloudwatch.Metric({
      namespace: 'AWS/Lambda',
      metricName: 'Errors',
      dimensionsMap: {
        FunctionName: 'All Functions',
      },
      statistic: 'Sum',
      period: cloudwatch.Duration.minutes(5),
    });

    const lambdaDurationMetric = new cloudwatch.Metric({
      namespace: 'AWS/Lambda',
      metricName: 'Duration',
      dimensionsMap: {
        FunctionName: 'All Functions',
      },
      statistic: 'Average',
      period: cloudwatch.Duration.minutes(5),
    });

    const lambdaInvocationMetric = new cloudwatch.Metric({
      namespace: 'AWS/Lambda',
      metricName: 'Invocations',
      dimensionsMap: {
        FunctionName: 'All Functions',
      },
      statistic: 'Sum',
      period: cloudwatch.Duration.minutes(5),
    });

    // API Gateway Metrics
    const apiErrorMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '4XXError',
      dimensionsMap: {
        ApiName: `${config.prefix}-api`,
      },
      statistic: 'Sum',
      period: cloudwatch.Duration.minutes(5),
    });

    const apiLatencyMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Latency',
      dimensionsMap: {
        ApiName: `${config.prefix}-api`,
      },
      statistic: 'Average',
      period: cloudwatch.Duration.minutes(5),
    });

    // DynamoDB Metrics
    const dynamoDbReadThrottleMetric = new cloudwatch.Metric({
      namespace: 'AWS/DynamoDB',
      metricName: 'ReadThrottledEvents',
      dimensionsMap: {
        TableName: 'All Tables',
      },
      statistic: 'Sum',
      period: cloudwatch.Duration.minutes(5),
    });

    const dynamoDbWriteThrottleMetric = new cloudwatch.Metric({
      namespace: 'AWS/DynamoDB',
      metricName: 'WriteThrottledEvents',
      dimensionsMap: {
        TableName: 'All Tables',
      },
      statistic: 'Sum',
      period: cloudwatch.Duration.minutes(5),
    });

    // S3 Metrics
    const s3ErrorMetric = new cloudwatch.Metric({
      namespace: 'AWS/S3',
      metricName: 'RequestsWithErrors',
      dimensionsMap: {
        BucketName: 'All Buckets',
      },
      statistic: 'Sum',
      period: cloudwatch.Duration.minutes(5),
    });

    // Custom Business Metrics
    const scanMetric = new cloudwatch.Metric({
      namespace: 'AiComplianceShepherd',
      metricName: 'ScansCompleted',
      statistic: 'Sum',
      period: cloudwatch.Duration.minutes(5),
    });

    const findingsMetric = new cloudwatch.Metric({
      namespace: 'AiComplianceShepherd',
      metricName: 'FindingsDetected',
      statistic: 'Sum',
      period: cloudwatch.Duration.minutes(5),
    });

    const complianceScoreMetric = new cloudwatch.Metric({
      namespace: 'AiComplianceShepherd',
      metricName: 'ComplianceScore',
      statistic: 'Average',
      period: cloudwatch.Duration.minutes(5),
    });

    // Add widgets to dashboard
    this.platformDashboard.addWidgets(
      // Lambda Metrics Row
      new cloudwatch.GraphWidget({
        title: 'Lambda Errors (5min)',
        left: [lambdaErrorMetric],
        width: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration (avg ms)',
        left: [lambdaDurationMetric],
        width: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Invocations',
        left: [lambdaInvocationMetric],
        width: 6,
      }),
      // API Gateway Metrics Row
      new cloudwatch.GraphWidget({
        title: 'API Gateway Errors',
        left: [apiErrorMetric],
        width: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway Latency (ms)',
        left: [apiLatencyMetric],
        width: 6,
      }),
      // DynamoDB Metrics Row
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Read Throttles',
        left: [dynamoDbReadThrottleMetric],
        width: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Write Throttles',
        left: [dynamoDbWriteThrottleMetric],
        width: 6,
      }),
      // S3 Metrics Row
      new cloudwatch.GraphWidget({
        title: 'S3 Errors',
        left: [s3ErrorMetric],
        width: 6,
      }),
      // Business Metrics Row
      new cloudwatch.GraphWidget({
        title: 'Scans Completed',
        left: [scanMetric],
        width: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Findings Detected',
        left: [findingsMetric],
        width: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Average Compliance Score',
        left: [complianceScoreMetric],
        width: 6,
      }),
    );

    // Create CloudWatch Alarms
    
    // Lambda Error Rate Alert
    const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
      alarmName: `${config.prefix}-lambda-errors`,
      alarmDescription: 'High error rate in Lambda functions',
      metric: lambdaErrorMetric,
      threshold: 10,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    lambdaErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));

    // Lambda Duration Alarm
    const lambdaDurationAlarm = new cloudwatch.Alarm(this, 'LambdaDurationAlarm', {
      alarmName: `${config.prefix}-lambda-duration`,
      alarmDescription: 'High Lambda function duration',
      metric: lambdaDurationMetric,
      threshold: 10000, // 10 seconds
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    lambdaDurationAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));

    // API Gateway Error Alarm
    const apiErrorAlarm = new cloudwatch.Alarm(this, 'ApiErrorAlarm', {
      alarmName: `${config.prefix}-api-errors`,
      alarmDescription: 'High API Gateway error rate',
      metric: apiErrorMetric,
      threshold: 20,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    apiErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));

    // DynamoDB Throttle Alarm
    const dynamoDbThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoDBThrottleAlarm', {
      alarmName: `${config.prefix}-dynamodb-throttles`,
      alarmDescription: 'DynamoDB throttling detected',
      metric: dynamoDbWriteThrottleMetric,
      threshold: 5,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    dynamoDbThrottleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));

    // Compliance Score Alarm
    const complianceScoreAlarm = new cloudwatch.Alarm(this, 'ComplianceScoreAlarm', {
      alarmName: `${config.prefix}-compliance-score`,
      alarmDescription: 'Compliance score below threshold',
      metric: complianceScoreMetric,
      threshold: 70,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    complianceScoreAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));

    // Create log groups for centralized logging
    const centralLogGroup = new logs.LogGroup(this, 'CentralLogGroup', {
      logGroupName: `/aws/lambda/${config.prefix}-all`,
      retention: config.environment === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
    });

    // Custom Log Group for business metrics
    const businessMetricsLogGroup = new logs.LogGroup(this, 'BusinessMetricsLogGroup', {
      logGroupName: `/aws/lambda/${config.prefix}-business-metrics`,
      retention: config.environment === 'prod' ? logs.RetentionDays.THREE_MONTHS : logs.RetentionDays.ONE_WEEK,
    });

    // Create log stream filters for business metrics
    new logs.LogFilter(this, 'ScanCompletedFilter', {
      logGroup: businessMetricsLogGroup,
      filterPattern: logs.FilterPattern.stringValue('$.event', '=', 'scan_completed'),
    });

    new logs.LogFilter(this, 'FindingDetectedFilter', {
      logGroup: businessMetricsLogGroup,
      filterPattern: logs.FilterPattern.stringValue('$.event', '=', 'finding_detected'),
    });

    // Outputs
    new CfnOutput(this, 'PlatformDashboardUrl', {
      value: `https://${this.env.region}.console.aws.amazon.com/cloudwatch/home?region=${this.env.region}#dashboards:name=${this.platformDashboard.dashboardName}`,
      description: 'Platform Dashboard URL'
    });

    new CfnOutput(this, 'DashboardName', {
      value: this.platformDashboard.dashboardName,
      description: 'CloudWatch Dashboard Name'
    });

    new CfnOutput(this, 'AlertsTopicArn', {
      value: alertsTopic.topicArn,
      description: 'SNS Alerts Topic ARN'
    });

    new CfnOutput(this, 'MonitoringStackName', {
      value: this.stackName,
      description: 'Monitoring Stack Name'
    });
  }

  public get stackName(): string {
    return this.stackName;
  }
}
