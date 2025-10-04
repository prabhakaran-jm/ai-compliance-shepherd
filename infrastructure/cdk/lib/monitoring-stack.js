"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const cloudwatch = require("aws-cdk-lib/aws-cloudwatch");
const cloudwatchActions = require("aws-cdk-lib/aws-cloudwatch-actions");
const logs = require("aws-cdk-lib/aws-logs");
const sns = require("aws-cdk-lib/aws-sns");
class MonitoringStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
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
        }), new cloudwatch.GraphWidget({
            title: 'Lambda Duration (avg ms)',
            left: [lambdaDurationMetric],
            width: 6,
        }), new cloudwatch.GraphWidget({
            title: 'Lambda Invocations',
            left: [lambdaInvocationMetric],
            width: 6,
        }), 
        // API Gateway Metrics Row
        new cloudwatch.GraphWidget({
            title: 'API Gateway Errors',
            left: [apiErrorMetric],
            width: 6,
        }), new cloudwatch.GraphWidget({
            title: 'API Gateway Latency (ms)',
            left: [apiLatencyMetric],
            width: 6,
        }), 
        // DynamoDB Metrics Row
        new cloudwatch.GraphWidget({
            title: 'DynamoDB Read Throttles',
            left: [dynamoDbReadThrottleMetric],
            width: 6,
        }), new cloudwatch.GraphWidget({
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
        }), new cloudwatch.GraphWidget({
            title: 'Findings Detected',
            left: [findingsMetric],
            width: 6,
        }), new cloudwatch.GraphWidget({
            title: 'Average Compliance Score',
            left: [complianceScoreMetric],
            width: 6,
        }));
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
        new aws_cdk_lib_1.CfnOutput(this, 'PlatformDashboardUrl', {
            value: `https://${this.env.region}.console.aws.amazon.com/cloudwatch/home?region=${this.env.region}#dashboards:name=${this.platformDashboard.dashboardName}`,
            description: 'Platform Dashboard URL'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'DashboardName', {
            value: this.platformDashboard.dashboardName,
            description: 'CloudWatch Dashboard Name'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'AlertsTopicArn', {
            value: alertsTopic.topicArn,
            description: 'SNS Alerts Topic ARN'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'MonitoringStackName', {
            value: this.stackName,
            description: 'Monitoring Stack Name'
        });
    }
    get stackName() {
        return this.stackName;
    }
}
exports.MonitoringStack = MonitoringStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uaXRvcmluZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9tb25pdG9yaW5nLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZDQUEyRDtBQUMzRCx5REFBeUQ7QUFDekQsd0VBQXdFO0FBQ3hFLDZDQUE2QztBQUM3QywyQ0FBMkM7QUFnQjNDLE1BQWEsZUFBZ0IsU0FBUSxtQkFBSztJQUd4QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTJCO1FBQ25FLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFekIsdUJBQXVCO1FBQ3ZCLE1BQU0sV0FBVyxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3JELFNBQVMsRUFBRSxHQUFHLE1BQU0sQ0FBQyxNQUFNLFNBQVM7WUFDcEMsV0FBVyxFQUFFLCtCQUErQjtTQUM3QyxDQUFDLENBQUM7UUFFSCxxQ0FBcUM7UUFDckMsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksVUFBVSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDM0UsYUFBYSxFQUFFLEdBQUcsTUFBTSxDQUFDLE1BQU0sb0JBQW9CO1NBQ3BELENBQUMsQ0FBQztRQUVILDZCQUE2QjtRQUM3QixNQUFNLGlCQUFpQixHQUFHLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztZQUM5QyxTQUFTLEVBQUUsWUFBWTtZQUN2QixVQUFVLEVBQUUsUUFBUTtZQUNwQixhQUFhLEVBQUU7Z0JBQ2IsWUFBWSxFQUFFLGVBQWU7YUFDOUI7WUFDRCxTQUFTLEVBQUUsS0FBSztZQUNoQixNQUFNLEVBQUUsVUFBVSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1NBQ3ZDLENBQUMsQ0FBQztRQUVILE1BQU0s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SCxVQUFVO1FBQ1YsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUMxQyxLQUFLLEVBQUUsV0FBVyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sa0RBQWtELElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxvQkFBb0IsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGFBQWEsRUFBRTtZQUM1SixXQUFXLEVBQUUsd0JBQXdCO1NBQ3RDLENBQUMsQ0FBQztRQUVILElBQUksdUJBQVMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ25DLEtBQUssRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsYUFBYTtZQUMzQyxXQUFXLEVBQUUsMkJBQTJCO1NBQ3pDLENBQUMsQ0FBQztRQUVILElBQUksdUJBQVMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDcEMsS0FBSyxFQUFFLFdBQVcsQ0FBQyxRQUFRO1lBQzNCLFdBQVcsRUFBRSxzQkFBc0I7U0FDcEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUN6QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFNBQVM7WUFDckIsV0FBVyxFQUFFLHVCQUF1QjtTQUNyQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsSUFBVyxTQUFTO1FBQ2xCLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUN4QixDQUFDO0NBQ0Y7QUE1U0QsMENBNFNDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgU3RhY2ssIFN0YWNrUHJvcHMsIENmbk91dHB1dCB9IGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaCc7XHJcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2hBY3Rpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoLWFjdGlvbnMnO1xyXG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcclxuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgTW9uaXRvcmluZ1N0YWNrUHJvcHMgZXh0ZW5kcyBTdGFja1Byb3BzIHtcclxuICBjb25maWc6IHtcclxuICAgIGFjY291bnQ6IHN0cmluZztcclxuICAgIHJlZ2lvbjogc3RyaW5nO1xyXG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZztcclxuICAgIHN0YWdlOiBzdHJpbmc7XHJcbiAgICBwcmVmaXg6IHN0cmluZztcclxuICB9O1xyXG4gIGxhbWJkYVN0YWNrTmFtZTogc3RyaW5nO1xyXG4gIGFwaVN0YWNrTmFtZTogc3RyaW5nO1xyXG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBNb25pdG9yaW5nU3RhY2sgZXh0ZW5kcyBTdGFjayB7XHJcbiAgcHVibGljIHJlYWRvbmx5IHBsYXRmb3JtRGFzaGJvYXJkOiBjbG91ZHdhdGNoLkRhc2hib2FyZDtcclxuXHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IE1vbml0b3JpbmdTdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuXHJcbiAgICBjb25zdCB7IGNvbmZpZyB9ID0gcHJvcHM7XHJcblxyXG4gICAgLy8gU05TIFRvcGljIGZvciBhbGVydHNcclxuICAgIGNvbnN0IGFsZXJ0c1RvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnQWxlcnRzVG9waWMnLCB7XHJcbiAgICAgIHRvcGljTmFtZTogYCR7Y29uZmlnLnByZWZpeH0tYWxlcnRzYCxcclxuICAgICAgZGlzcGxheU5hbWU6ICdBSSBDb21wbGlhbmNlIFNoZXBoZXJkIEFsZXJ0cycsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBDcmVhdGUgUGxhdGZvcm0gT3ZlcnZpZXcgRGFzaGJvYXJkXHJcbiAgICB0aGlzLnBsYXRmb3JtRGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdQbGF0Zm9ybURhc2hib2FyZCcsIHtcclxuICAgICAgZGFzaGJvYXJkTmFtZTogYCR7Y29uZmlnLnByZWZpeH0tcGxhdGZvcm0tb3ZlcnZpZXdgLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gTGFtYmRhIFBlcmZvcm1hbmNlIE1ldHJpY3NcclxuICAgIGNvbnN0IGxhbWJkYUVycm9yTWV0cmljID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcclxuICAgICAgbmFtZXNwYWNlOiAnQVdTL0xhbWJkYScsXHJcbiAgICAgIG1ldHJpY05hbWU6ICdFcnJvcnMnLFxyXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XHJcbiAgICAgICAgRnVuY3Rpb25OYW1lOiAnQWxsIEZ1bmN0aW9ucycsXHJcbiAgICAgIH0sXHJcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXHJcbiAgICAgIHBlcmlvZDogY2xvdWR3YXRjaC5EdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgbGFtYmRhRHVyYXRpb25NZXRyaWMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xyXG4gICAgICBuYW1lc3BhY2U6ICdBV1MvTGFtYmRhJyxcclxuICAgICAgbWV0cmljTmFtZTogJ0R1cmF0aW9uJyxcclxuICAgICAgZGltZW5zaW9uc01hcDoge1xyXG4gICAgICAgIEZ1bmN0aW9uTmFtZTogJ0FsbCBGdW5jdGlvbnMnLFxyXG4gICAgICB9LFxyXG4gICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcclxuICAgICAgcGVyaW9kOiBjbG91ZHdhdGNoLkR1cmF0aW9uLm1pbnV0ZXMoNSksXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBsYW1iZGFJbnZvY2F0aW9uTWV0cmljID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcclxuICAgICAgbmFtZXNwYWNlOiAnQVdTL0xhbWJkYScsXHJcbiAgICAgIG1ldHJpY05hbWU6ICdJbnZvY2F0aW9ucycsXHJcbiAgICAgIGRpbWVuc2lvbnNNYXA6IHtcclxuICAgICAgICBGdW5jdGlvbk5hbWU6ICdBbGwgRnVuY3Rpb25zJyxcclxuICAgICAgfSxcclxuICAgICAgc3RhdGlzdGljOiAnU3VtJyxcclxuICAgICAgcGVyaW9kOiBjbG91ZHdhdGNoLkR1cmF0aW9uLm1pbnV0ZXMoNSksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBUEkgR2F0ZXdheSBNZXRyaWNzXHJcbiAgICBjb25zdCBhcGlFcnJvck1ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XHJcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5JyxcclxuICAgICAgbWV0cmljTmFtZTogJzRYWEVycm9yJyxcclxuICAgICAgZGltZW5zaW9uc01hcDoge1xyXG4gICAgICAgIEFwaU5hbWU6IGAke2NvbmZpZy5wcmVmaXh9LWFwaWAsXHJcbiAgICAgIH0sXHJcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXHJcbiAgICAgIHBlcmlvZDogY2xvdWR3YXRjaC5EdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgYXBpTGF0ZW5jeU1ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XHJcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5JyxcclxuICAgICAgbWV0cmljTmFtZTogJ0xhdGVuY3knLFxyXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XHJcbiAgICAgICAgQXBpTmFtZTogYCR7Y29uZmlnLnByZWZpeH0tYXBpYCxcclxuICAgICAgfSxcclxuICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXHJcbiAgICAgIHBlcmlvZDogY2xvdWR3YXRjaC5EdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gRHluYW1vREIgTWV0cmljc1xyXG4gICAgY29uc3QgZHluYW1vRGJSZWFkVGhyb3R0bGVNZXRyaWMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xyXG4gICAgICBuYW1lc3BhY2U6ICdBV1MvRHluYW1vREInLFxyXG4gICAgICBtZXRyaWNOYW1lOiAnUmVhZFRocm90dGxlZEV2ZW50cycsXHJcbiAgICAgIGRpbWVuc2lvbnNNYXA6IHtcclxuICAgICAgICBUYWJsZU5hbWU6ICdBbGwgVGFibGVzJyxcclxuICAgICAgfSxcclxuICAgICAgc3RhdGlzdGljOiAnU3VtJyxcclxuICAgICAgcGVyaW9kOiBjbG91ZHdhdGNoLkR1cmF0aW9uLm1pbnV0ZXMoNSksXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBkeW5hbW9EYldyaXRlVGhyb3R0bGVNZXRyaWMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xyXG4gICAgICBuYW1lc3BhY2U6ICdBV1MvRHluYW1vREInLFxyXG4gICAgICBtZXRyaWNOYW1lOiAnV3JpdGVUaHJvdHRsZWRFdmVudHMnLFxyXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XHJcbiAgICAgICAgVGFibGVOYW1lOiAnQWxsIFRhYmxlcycsXHJcbiAgICAgIH0sXHJcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXHJcbiAgICAgIHBlcmlvZDogY2xvdWR3YXRjaC5EdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gUzMgTWV0cmljc1xyXG4gICAgY29uc3QgczNFcnJvck1ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XHJcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9TMycsXHJcbiAgICAgIG1ldHJpY05hbWU6ICdSZXF1ZXN0c1dpdGhFcnJvcnMnLFxyXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XHJcbiAgICAgICAgQnVja2V0TmFtZTogJ0FsbCBCdWNrZXRzJyxcclxuICAgICAgfSxcclxuICAgICAgc3RhdGlzdGljOiAnU3VtJyxcclxuICAgICAgcGVyaW9kOiBjbG91ZHdhdGNoLkR1cmF0aW9uLm1pbnV0ZXMoNSksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBDdXN0b20gQnVzaW5lc3MgTWV0cmljc1xyXG4gICAgY29uc3Qgc2Nhbk1ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XHJcbiAgICAgIG5hbWVzcGFjZTogJ0FpQ29tcGxpYW5jZVNoZXBoZXJkJyxcclxuICAgICAgbWV0cmljTmFtZTogJ1NjYW5zQ29tcGxldGVkJyxcclxuICAgICAgc3RhdGlzdGljOiAnU3VtJyxcclxuICAgICAgcGVyaW9kOiBjbG91ZHdhdGNoLkR1cmF0aW9uLm1pbnV0ZXMoNSksXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBmaW5kaW5nc01ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XHJcbiAgICAgIG5hbWVzcGFjZTogJ0FpQ29tcGxpYW5jZVNoZXBoZXJkJyxcclxuICAgICAgbWV0cmljTmFtZTogJ0ZpbmRpbmdzRGV0ZWN0ZWQnLFxyXG4gICAgICBzdGF0aXN0aWM6ICdTdW0nLFxyXG4gICAgICBwZXJpb2Q6IGNsb3Vkd2F0Y2guRHVyYXRpb24ubWludXRlcyg1KSxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGNvbXBsaWFuY2VTY29yZU1ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XHJcbiAgICAgIG5hbWVzcGFjZTogJ0FpQ29tcGxpYW5jZVNoZXBoZXJkJyxcclxuICAgICAgbWV0cmljTmFtZTogJ0NvbXBsaWFuY2VTY29yZScsXHJcbiAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxyXG4gICAgICBwZXJpb2Q6IGNsb3Vkd2F0Y2guRHVyYXRpb24ubWludXRlcyg1KSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEFkZCB3aWRnZXRzIHRvIGRhc2hib2FyZFxyXG4gICAgdGhpcy5wbGF0Zm9ybURhc2hib2FyZC5hZGRXaWRnZXRzKFxyXG4gICAgICAvLyBMYW1iZGEgTWV0cmljcyBSb3dcclxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xyXG4gICAgICAgIHRpdGxlOiAnTGFtYmRhIEVycm9ycyAoNW1pbiknLFxyXG4gICAgICAgIGxlZnQ6IFtsYW1iZGFFcnJvck1ldHJpY10sXHJcbiAgICAgICAgd2lkdGg6IDYsXHJcbiAgICAgIH0pLFxyXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XHJcbiAgICAgICAgdGl0bGU6ICdMYW1iZGEgRHVyYXRpb24gKGF2ZyBtcyknLFxyXG4gICAgICAgIGxlZnQ6IFtsYW1iZGFEdXJhdGlvbk1ldHJpY10sXHJcbiAgICAgICAgd2lkdGg6IDYsXHJcbiAgICAgIH0pLFxyXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XHJcbiAgICAgICAgdGl0bGU6ICdMYW1iZGEgSW52b2NhdGlvbnMnLFxyXG4gICAgICAgIGxlZnQ6IFtsYW1iZGFJbnZvY2F0aW9uTWV0cmljXSxcclxuICAgICAgICB3aWR0aDogNixcclxuICAgICAgfSksXHJcbiAgICAgIC8vIEFQSSBHYXRld2F5IE1ldHJpY3MgUm93XHJcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcclxuICAgICAgICB0aXRsZTogJ0FQSSBHYXRld2F5IEVycm9ycycsXHJcbiAgICAgICAgbGVmdDogW2FwaUVycm9yTWV0cmljXSxcclxuICAgICAgICB3aWR0aDogNixcclxuICAgICAgfSksXHJcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcclxuICAgICAgICB0aXRsZTogJ0FQSSBHYXRld2F5IExhdGVuY3kgKG1zKScsXHJcbiAgICAgICAgbGVmdDogW2FwaUxhdGVuY3lNZXRyaWNdLFxyXG4gICAgICAgIHdpZHRoOiA2LFxyXG4gICAgICB9KSxcclxuICAgICAgLy8gRHluYW1vREIgTWV0cmljcyBSb3dcclxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xyXG4gICAgICAgIHRpdGxlOiAnRHluYW1vREIgUmVhZCBUaHJvdHRsZXMnLFxyXG4gICAgICAgIGxlZnQ6IFtkeW5hbW9EYlJlYWRUaHJvdHRsZU1ldHJpY10sXHJcbiAgICAgICAgd2lkdGg6IDYsXHJcbiAgICAgIH0pLFxyXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XHJcbiAgICAgICAgdGl0bGU6ICdEeW5hbW9EQiBXcml0ZSBUaHJvdHRsZXMnLFxyXG4gICAgICAgIGxlZnQ6IFtkeW5hbW9EYldyaXRlVGhyb3R0bGVNZXRyaWNdLFxyXG4gICAgICAgIHdpZHRoOiA2LFxyXG4gICAgICB9KSxcclxuICAgICAgLy8gUzMgTWV0cmljcyBSb3dcclxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xyXG4gICAgICAgIHRpdGxlOiAnUzMgRXJyb3JzJyxcclxuICAgICAgICBsZWZ0OiBbczNFcnJvck1ldHJpY10sXHJcbiAgICAgICAgd2lkdGg6IDYsXHJcbiAgICAgIH0pLFxyXG4gICAgICAvLyBCdXNpbmVzcyBNZXRyaWNzIFJvd1xyXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XHJcbiAgICAgICAgdGl0bGU6ICdTY2FucyBDb21wbGV0ZWQnLFxyXG4gICAgICAgIGxlZnQ6IFtzY2FuTWV0cmljXSxcclxuICAgICAgICB3aWR0aDogNixcclxuICAgICAgfSksXHJcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcclxuICAgICAgICB0aXRsZTogJ0ZpbmRpbmdzIERldGVjdGVkJyxcclxuICAgICAgICBsZWZ0OiBbZmluZGluZ3NNZXRyaWNdLFxyXG4gICAgICAgIHdpZHRoOiA2LFxyXG4gICAgICB9KSxcclxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xyXG4gICAgICAgIHRpdGxlOiAnQXZlcmFnZSBDb21wbGlhbmNlIFNjb3JlJyxcclxuICAgICAgICBsZWZ0OiBbY29tcGxpYW5jZVNjb3JlTWV0cmljXSxcclxuICAgICAgICB3aWR0aDogNixcclxuICAgICAgfSksXHJcbiAgICApO1xyXG5cclxuICAgIC8vIENyZWF0ZSBDbG91ZFdhdGNoIEFsYXJtc1xyXG4gICAgXHJcbiAgICAvLyBMYW1iZGEgRXJyb3IgUmF0ZSBBbGVydFxyXG4gICAgY29uc3QgbGFtYmRhRXJyb3JBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdMYW1iZGFFcnJvckFsYXJtJywge1xyXG4gICAgICBhbGFybU5hbWU6IGAke2NvbmZpZy5wcmVmaXh9LWxhbWJkYS1lcnJvcnNgLFxyXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnSGlnaCBlcnJvciByYXRlIGluIExhbWJkYSBmdW5jdGlvbnMnLFxyXG4gICAgICBtZXRyaWM6IGxhbWJkYUVycm9yTWV0cmljLFxyXG4gICAgICB0aHJlc2hvbGQ6IDEwLFxyXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcclxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXHJcbiAgICB9KTtcclxuXHJcbiAgICBsYW1iZGFFcnJvckFsYXJtLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24oYWxlcnRzVG9waWMpKTtcclxuXHJcbiAgICAvLyBMYW1iZGEgRHVyYXRpb24gQWxhcm1cclxuICAgIGNvbnN0IGxhbWJkYUR1cmF0aW9uQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnTGFtYmRhRHVyYXRpb25BbGFybScsIHtcclxuICAgICAgYWxhcm1OYW1lOiBgJHtjb25maWcucHJlZml4fS1sYW1iZGEtZHVyYXRpb25gLFxyXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnSGlnaCBMYW1iZGEgZnVuY3Rpb24gZHVyYXRpb24nLFxyXG4gICAgICBtZXRyaWM6IGxhbWJkYUR1cmF0aW9uTWV0cmljLFxyXG4gICAgICB0aHJlc2hvbGQ6IDEwMDAwLCAvLyAxMCBzZWNvbmRzXHJcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxyXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcclxuICAgIH0pO1xyXG5cclxuICAgIGxhbWJkYUR1cmF0aW9uQWxhcm0uYWRkQWxhcm1BY3Rpb24obmV3IGNsb3Vkd2F0Y2hBY3Rpb25zLlNuc0FjdGlvbihhbGVydHNUb3BpYykpO1xyXG5cclxuICAgIC8vIEFQSSBHYXRld2F5IEVycm9yIEFsYXJtXHJcbiAgICBjb25zdCBhcGlFcnJvckFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0FwaUVycm9yQWxhcm0nLCB7XHJcbiAgICAgIGFsYXJtTmFtZTogYCR7Y29uZmlnLnByZWZpeH0tYXBpLWVycm9yc2AsXHJcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdIaWdoIEFQSSBHYXRld2F5IGVycm9yIHJhdGUnLFxyXG4gICAgICBtZXRyaWM6IGFwaUVycm9yTWV0cmljLFxyXG4gICAgICB0aHJlc2hvbGQ6IDIwLFxyXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcclxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXHJcbiAgICB9KTtcclxuXHJcbiAgICBhcGlFcnJvckFsYXJtLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24oYWxlcnRzVG9waWMpKTtcclxuXHJcbiAgICAvLyBEeW5hbW9EQiBUaHJvdHRsZSBBbGFybVxyXG4gICAgY29uc3QgZHluYW1vRGJUaHJvdHRsZUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0R5bmFtb0RCVGhyb3R0bGVBbGFybScsIHtcclxuICAgICAgYWxhcm1OYW1lOiBgJHtjb25maWcucHJlZml4fS1keW5hbW9kYi10aHJvdHRsZXNgLFxyXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnRHluYW1vREIgdGhyb3R0bGluZyBkZXRlY3RlZCcsXHJcbiAgICAgIG1ldHJpYzogZHluYW1vRGJXcml0ZVRocm90dGxlTWV0cmljLFxyXG4gICAgICB0aHJlc2hvbGQ6IDUsXHJcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxyXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcclxuICAgIH0pO1xyXG5cclxuICAgIGR5bmFtb0RiVGhyb3R0bGVBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaEFjdGlvbnMuU25zQWN0aW9uKGFsZXJ0c1RvcGljKSk7XHJcblxyXG4gICAgLy8gQ29tcGxpYW5jZSBTY29yZSBBbGFybVxyXG4gICAgY29uc3QgY29tcGxpYW5jZVNjb3JlQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnQ29tcGxpYW5jZVNjb3JlQWxhcm0nLCB7XHJcbiAgICAgIGFsYXJtTmFtZTogYCR7Y29uZmlnLnByZWZpeH0tY29tcGxpYW5jZS1zY29yZWAsXHJcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdDb21wbGlhbmNlIHNjb3JlIGJlbG93IHRocmVzaG9sZCcsXHJcbiAgICAgIG1ldHJpYzogY29tcGxpYW5jZVNjb3JlTWV0cmljLFxyXG4gICAgICB0aHJlc2hvbGQ6IDcwLFxyXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkxFU1NfVEhBTl9USFJFU0hPTEQsXHJcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxyXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbXBsaWFuY2VTY29yZUFsYXJtLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24oYWxlcnRzVG9waWMpKTtcclxuXHJcbiAgICAvLyBDcmVhdGUgbG9nIGdyb3VwcyBmb3IgY2VudHJhbGl6ZWQgbG9nZ2luZ1xyXG4gICAgY29uc3QgY2VudHJhbExvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0NlbnRyYWxMb2dHcm91cCcsIHtcclxuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9sYW1iZGEvJHtjb25maWcucHJlZml4fS1hbGxgLFxyXG4gICAgICByZXRlbnRpb246IGNvbmZpZy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCA6IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEN1c3RvbSBMb2cgR3JvdXAgZm9yIGJ1c2luZXNzIG1ldHJpY3NcclxuICAgIGNvbnN0IGJ1c2luZXNzTWV0cmljc0xvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0J1c2luZXNzTWV0cmljc0xvZ0dyb3VwJywge1xyXG4gICAgICBsb2dHcm91cE5hbWU6IGAvYXdzL2xhbWJkYS8ke2NvbmZpZy5wcmVmaXh9LWJ1c2luZXNzLW1ldHJpY3NgLFxyXG4gICAgICByZXRlbnRpb246IGNvbmZpZy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gbG9ncy5SZXRlbnRpb25EYXlzLlRIUkVFX01PTlRIUyA6IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENyZWF0ZSBsb2cgc3RyZWFtIGZpbHRlcnMgZm9yIGJ1c2luZXNzIG1ldHJpY3NcclxuICAgIG5ldyBsb2dzLkxvZ0ZpbHRlcih0aGlzLCAnU2NhbkNvbXBsZXRlZEZpbHRlcicsIHtcclxuICAgICAgbG9nR3JvdXA6IGJ1c2luZXNzTWV0cmljc0xvZ0dyb3VwLFxyXG4gICAgICBmaWx0ZXJQYXR0ZXJuOiBsb2dzLkZpbHRlclBhdHRlcm4uc3RyaW5nVmFsdWUoJyQuZXZlbnQnLCAnPScsICdzY2FuX2NvbXBsZXRlZCcpLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGxvZ3MuTG9nRmlsdGVyKHRoaXMsICdGaW5kaW5nRGV0ZWN0ZWRGaWx0ZXInLCB7XHJcbiAgICAgIGxvZ0dyb3VwOiBidXNpbmVzc01ldHJpY3NMb2dHcm91cCxcclxuICAgICAgZmlsdGVyUGF0dGVybjogbG9ncy5GaWx0ZXJQYXR0ZXJuLnN0cmluZ1ZhbHVlKCckLmV2ZW50JywgJz0nLCAnZmluZGluZ19kZXRlY3RlZCcpLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gT3V0cHV0c1xyXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnUGxhdGZvcm1EYXNoYm9hcmRVcmwnLCB7XHJcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly8ke3RoaXMuZW52LnJlZ2lvbn0uY29uc29sZS5hd3MuYW1hem9uLmNvbS9jbG91ZHdhdGNoL2hvbWU/cmVnaW9uPSR7dGhpcy5lbnYucmVnaW9ufSNkYXNoYm9hcmRzOm5hbWU9JHt0aGlzLnBsYXRmb3JtRGFzaGJvYXJkLmRhc2hib2FyZE5hbWV9YCxcclxuICAgICAgZGVzY3JpcHRpb246ICdQbGF0Zm9ybSBEYXNoYm9hcmQgVVJMJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnRGFzaGJvYXJkTmFtZScsIHtcclxuICAgICAgdmFsdWU6IHRoaXMucGxhdGZvcm1EYXNoYm9hcmQuZGFzaGJvYXJkTmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZFdhdGNoIERhc2hib2FyZCBOYW1lJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnQWxlcnRzVG9waWNBcm4nLCB7XHJcbiAgICAgIHZhbHVlOiBhbGVydHNUb3BpYy50b3BpY0FybixcclxuICAgICAgZGVzY3JpcHRpb246ICdTTlMgQWxlcnRzIFRvcGljIEFSTidcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ01vbml0b3JpbmdTdGFja05hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiB0aGlzLnN0YWNrTmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246ICdNb25pdG9yaW5nIFN0YWNrIE5hbWUnXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgc3RhY2tOYW1lKCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5zdGFja05hbWU7XHJcbiAgfVxyXG59XHJcbiJdfQ==