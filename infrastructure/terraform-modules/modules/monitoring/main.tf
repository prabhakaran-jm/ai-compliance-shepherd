# Monitoring module for AI Compliance Shepherd customer onboarding

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.9"
    }
  }
}

locals {
  common_tags = merge(var.tags, {
    Module = "monitoring"
    Usage  = "customer-monitoring"
  })

  dashboard_name = "compliance-shepherd-${var.customer_name}-${var.environment}"
}

# CloudWatch Dashboard for customer compliance overview
resource "aws_cloudwatch_dashboard" "customer_dashboard" {
  dashboard_name = local.dashboard_name

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ComplianceShepherd", "TotalScans", "CustomerTenant", var.tenant_id],
            ["AWS/ComplianceShepherd", "SuccessfulScans", "CustomerTenant", var.tenant_id],
            ["AWS/ComplianceShepherd", "FailedScans", "CustomerTenant", var.tenant_id]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.customer_region
          title   = "Compliance Scan Activity"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ComplianceShepherd", "TotalFindings", "CustomerTenant", var.tenant_id],
            ["AWS/ComplianceShepherd", "CriticalFindings", "CustomerTenant", var.tenant_id],
            ["AWS/ComplianceShepherd", "ResolvedFindings", "CustomerTenant", var.tenant_id]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.customer_region
          title   = "Compliance Findings"
          period  = 300
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 6
        width  = 24
        height = 6
        properties = {
          query   = "SOURCE '${aws_cloudwatch_log_group.compliance_logs.name}' | fields @timestamp, @message\n| filter @message like /ERROR/\n| sort @timestamp desc\n| limit 100"
          region  = var.customer_region
          title   = "Recent Error Logs"
          view    = "table"
        }
      }
    ]
  })

  tags = local.common_tags
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "compliance_logs" {
  name              = "/aws/compliance-shepherd/${var.customer_name}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kops_key_arn

  tags = local.common_tags
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  alarm_name          = "compliance-shepherd-${var.customer_name}-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods = "2"
  metric_name         = "FailedScans"
  namespace           = "AWS/ComplianceShepherd"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "High failure rate for compliance scans"
  
  dimensions = {
    CustomerTenant = var.tenant_id
  }
  
  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "crit_findings_alert" {
  alarm_name          = "compliance-shepherd-${var.customer_name}-critical-findings"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods = "1"
  metric_name         = "CriticalFindings"
  namespace           = "AWS/ComplianceShepherd"
  period              = "300"
  statistic           = "Maximum"
  threshold           = "0"
  alarm_description   = "Critical compliance findings detected"
  
  dimensions = {
    CustomerTenant = var.tenant_id
  }
  
  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "scan_latency" {
  alarm_name          = "compliance-shepherd-${var.customer_name}-scan-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods = "2"
  metric_name         = "ScanDuration"
  namespace           = "AWS/ComplianceShepherd"
  period              = "300"
  statistic           = "Average"
  threshold           = "1800"  # 30 minutes
  alarm_description   = "High scan latency detected"
  
  dimensions = {
    CustomerTenant = var.tenant_id
  }
  
  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

# SNS Topic for alerts
resource "aws_sns_topic" "alerts" {
  name              = "compliance-shepherd-${var.customer_name}-alerts"
  kms_master_key_id = var.kops_key_arn

  tags = local.common_tags
}

resource "aws_sns_topic_policy" "alerts" {
  arn = aws_sns_topic.alerts.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${var.service_account_id}:root"
        }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.alerts.arn
      }
    ]
  })
}

# CloudWatch Event Rules
resource "aws_cloudwatch_event_rule" "scheduled_scans" {
  name                = "compliance-shepherd-${var.customer_name}-scheduled-scans"
  description         = "Trigger compliance scans on schedule"
  schedule_expression = var.scan_schedule_expression

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "scans" {
  rule      = aws_cloudwatch_event_rule.scheduled_scans.name
  target_id = "StartComplianceScan"
  arn       = "arn:aws:lambda:${var.customer_region}:${var.service_account_id}:function:compliance-shepherd-start-scan"

  input = jsonencode({
    tenantId = var.tenant_id
    customerName = var.customer_name
    scheduledScan = true
  })
}

# Custom Metrics for compliance scoring
resource "aws_cloudwatch_log_metric_filter" "compliance_score" {
  name = "compliance-shepherd-${var.customer_name}-score"
  pattern = "[timestamp, level=INFO, tenant=${var.tenant_id}, score=*]"
  log_group_name = aws_cloudwatch_log_group.compliance_logs.name

  metric_transformation {
    name      = "ComplianceScore"
    namespace = "AWS/ComplianceShepherd"
    value     = "$score"
  }
}

# Cost monitoring alarm
resource "aws_cloudwatch_metric_alarm" "cost_anomaly" {
  count               = var.monitor_cost ? 1 : 0
  alarm_name          = "compliance-shepherd-${var.customer_name}-cost-anomaly"
  namespace           = "AWS/DYNAMODB"
  metric_name         = "ConsumedReadCapacityUnits"
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.cost_threshold
  evaluation_periods  = "2"
  period              = "3600"
  statistic           = "Sum"
  alarm_description   = "Unusual DynamoDB read consumption detected"

  dimensions = {
    TableName = "${var.customer_name}-findings-table"
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

# X-Ray Tracing (if enabled)
resource "aws_xray_sampling_rule" "customer_tracing" {
  count = var.enable_xray_tracing ? 1 : 0
  
  rule_name      = "compliance-shepherd-${var.customer_name}-tracing"
  priority       = 9000
  fixed_target   = 1
  reservoir_size = 1
  service_name   = "*"
  service_type   = "*"
  host           = "*"
  http_method    = "*"
  url_path       = "*"
  version        = 1

  tags = local.common_tags
}
