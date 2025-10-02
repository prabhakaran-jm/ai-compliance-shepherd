# Outputs for Monitoring module

output "dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.customer_region}#dashboards:name=${aws_cloudwatch_dashboard.customer_dashboard.dashboard_name}"
}

output "log_group_name" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.compliance_logs.name
}

output "log_group_arn" {
  description = "CloudWatch log group ARN"
  value       = aws_cloudwatch_log_group.compliance_logs.arn
}

output "alerts_topic_arn" {
  description = "SNS alerts topic ARN"
  value       = aws_sns_topic.alerts.arn
}

output "scheduled_scans_rule_name" {
  description = "CloudWatch Events rule name for scheduled scans"
  value       = aws_cloudwatch_event_rule.scheduled_scans.name
}

output "scheduled_scans_rule_arn" {
  description = "CloudWatch Events rule ARN for scheduled scans"
  value       = aws_cloudwatch_event_rule.scheduled_scans.arn
}

output "monitoring_summary" {
  description = "Summary of monitoring resources"
  value = {
    dashboard_name = aws_cloudwatch_dashboard.customer_dashboard.dashboard_name
    log_group_name = aws_cloudwatch_log_group.compliance_logs.name
    alarms = [
      aws_cloudwatch_metric_alarm.high_error_rate.alarm_name,
      aws_cloudwatch_metric_alarm.crit_findings_alert.alarm_name,
      aws_cloudwatch_metric_alarm.scan_latency.alarm_name
    ]
    cost_monitoring_enabled = var.monitor_cost
    xray_tracing_enabled = var.enable_xray_tracing
  }
}
