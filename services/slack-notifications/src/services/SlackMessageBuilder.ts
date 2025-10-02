import { SlackMessage, SlackAttachment, ComplianceEvent } from '../types/slack';
import { format } from 'date-fns';

/**
 * Service for building Slack messages with rich formatting
 */
export class SlackMessageBuilder {

  /**
   * Build test message
   */
  buildTestMessage(customMessage?: string): SlackMessage {
    return {
      text: customMessage || 'Test notification from AI Compliance Shepherd',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🧪 *Test Notification*\n\n${customMessage || 'This is a test notification from AI Compliance Shepherd to verify your Slack integration is working correctly.'}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `⏰ ${format(new Date(), 'MMM dd, yyyy HH:mm:ss')} | 🤖 AI Compliance Shepherd`
            }
          ]
        }
      ]
    };
  }

  /**
   * Build welcome message
   */
  buildWelcomeMessage(tenantId: string): SlackMessage {
    return {
      text: 'Welcome to AI Compliance Shepherd!',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '🎉 *Welcome to AI Compliance Shepherd!*\n\nYour Slack integration has been configured successfully. You\'ll now receive compliance notifications directly in this channel.'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*What you\'ll receive:*\n• 🔍 Scan completion notifications\n• 🚨 Critical security findings\n• ✅ Remediation confirmations\n• 📋 Audit pack ready alerts\n• 📊 Compliance score changes'
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `🏢 Tenant: ${tenantId} | ⏰ ${format(new Date(), 'MMM dd, yyyy HH:mm:ss')}`
            }
          ]
        }
      ]
    };
  }

  /**
   * Build scan completed message
   */
  buildScanCompletedMessage(eventData: ComplianceEvent): SlackMessage {
    const { scanId, tenantId, findingsCount = 0, criticalCount = 0, highCount = 0, mediumCount = 0, lowCount = 0 } = eventData;
    
    const totalFindings = findingsCount;
    const statusEmoji = criticalCount > 0 ? '🔴' : highCount > 0 ? '🟡' : '🟢';
    const statusText = criticalCount > 0 ? 'Critical Issues Found' : highCount > 0 ? 'Issues Found' : 'All Clear';

    return {
      text: `Compliance scan completed - ${totalFindings} findings`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${statusEmoji} *Compliance Scan Completed*\n\n*Status:* ${statusText}\n*Total Findings:* ${totalFindings}`
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Details'
            },
            url: `https://compliance-shepherd.com/scans/${scanId}`,
            action_id: 'view_scan_details'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Critical:* ${criticalCount}`
            },
            {
              type: 'mrkdwn',
              text: `*High:* ${highCount}`
            },
            {
              type: 'mrkdwn',
              text: `*Medium:* ${mediumCount}`
            },
            {
              type: 'mrkdwn',
              text: `*Low:* ${lowCount}`
            }
          ]
        },
        ...(criticalCount > 0 ? [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '⚠️ *Immediate attention required for critical findings*'
          }
        }] : []),
        {
          type: 'divider'
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `🆔 Scan: ${scanId} | 🏢 ${tenantId} | ⏰ ${format(new Date(), 'MMM dd, yyyy HH:mm:ss')}`
            }
          ]
        }
      ]
    };
  }

  /**
   * Build critical finding message
   */
  buildCriticalFindingMessage(eventData: ComplianceEvent): SlackMessage {
    const { findingId, tenantId, title, description, resourceType, resourceId, severity = 'CRITICAL' } = eventData;

    return {
      text: `🚨 Critical security finding detected: ${title}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🚨 *Critical Security Finding Detected*\n\n*${title}*\n${description}`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Severity:* ${severity}`
            },
            {
              type: 'mrkdwn',
              text: `*Resource Type:* ${resourceType}`
            },
            {
              type: 'mrkdwn',
              text: `*Resource ID:* ${resourceId}`
            },
            {
              type: 'mrkdwn',
              text: `*Finding ID:* ${findingId}`
            }
          ]
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Finding'
              },
              style: 'danger',
              url: `https://compliance-shepherd.com/findings/${findingId}`,
              action_id: 'view_finding'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Apply Fix'
              },
              style: 'primary',
              url: `https://compliance-shepherd.com/findings/${findingId}/remediate`,
              action_id: 'apply_fix'
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `🏢 ${tenantId} | ⏰ ${format(new Date(), 'MMM dd, yyyy HH:mm:ss')}`
            }
          ]
        }
      ]
    };
  }

  /**
   * Build remediation applied message
   */
  buildRemediationAppliedMessage(eventData: ComplianceEvent): SlackMessage {
    const { remediationId, tenantId, findingId, action, status, resourceType, resourceId } = eventData;
    
    const statusEmoji = status === 'SUCCESS' ? '✅' : status === 'FAILED' ? '❌' : '⏳';
    const statusColor = status === 'SUCCESS' ? 'good' : status === 'FAILED' ? 'danger' : 'warning';

    return {
      text: `${statusEmoji} Remediation ${status?.toLowerCase()}: ${action}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${statusEmoji} *Remediation ${status}*\n\n*Action:* ${action}\n*Resource:* ${resourceType} (${resourceId})`
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Details'
            },
            url: `https://compliance-shepherd.com/remediation/${remediationId}`,
            action_id: 'view_remediation'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Status:* ${status}`
            },
            {
              type: 'mrkdwn',
              text: `*Finding ID:* ${findingId}`
            },
            {
              type: 'mrkdwn',
              text: `*Remediation ID:* ${remediationId}`
            },
            {
              type: 'mrkdwn',
              text: `*Applied:* ${format(new Date(), 'MMM dd, HH:mm')}`
            }
          ]
        },
        ...(status === 'FAILED' ? [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '⚠️ *Remediation failed. Manual intervention may be required.*'
          }
        }] : []),
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `🏢 ${tenantId} | ⏰ ${format(new Date(), 'MMM dd, yyyy HH:mm:ss')}`
            }
          ]
        }
      ]
    };
  }

  /**
   * Build audit pack generated message
   */
  buildAuditPackGeneratedMessage(eventData: ComplianceEvent): SlackMessage {
    const { auditPackId, tenantId, framework, auditType, complianceScore, totalFindings, criticalFindings } = eventData;
    
    const scoreEmoji = (complianceScore || 0) >= 90 ? '🟢' : (complianceScore || 0) >= 80 ? '🟡' : '🔴';
    const scoreText = (complianceScore || 0) >= 90 ? 'Excellent' : (complianceScore || 0) >= 80 ? 'Good' : 'Needs Improvement';

    return {
      text: `📋 ${framework} audit pack ready for download`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📋 *${framework} Audit Pack Ready*\n\n*Type:* ${auditType}\n*Compliance Score:* ${scoreEmoji} ${complianceScore}% (${scoreText})`
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Download Pack'
            },
            style: 'primary',
            url: `https://compliance-shepherd.com/audit-packs/${auditPackId}/download`,
            action_id: 'download_audit_pack'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Framework:* ${framework}`
            },
            {
              type: 'mrkdwn',
              text: `*Audit Type:* ${auditType}`
            },
            {
              type: 'mrkdwn',
              text: `*Total Findings:* ${totalFindings || 0}`
            },
            {
              type: 'mrkdwn',
              text: `*Critical Issues:* ${criticalFindings || 0}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Package Contents:*\n• Executive Summary\n• Detailed Findings Report\n• Evidence Collection\n• Compliance Assessment\n• Remediation Report'
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Summary'
              },
              url: `https://compliance-shepherd.com/audit-packs/${auditPackId}`,
              action_id: 'view_audit_pack'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Download ZIP'
              },
              style: 'primary',
              url: `https://compliance-shepherd.com/audit-packs/${auditPackId}/download`,
              action_id: 'download_zip'
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `🆔 ${auditPackId} | 🏢 ${tenantId} | ⏰ ${format(new Date(), 'MMM dd, yyyy HH:mm:ss')}`
            }
          ]
        }
      ]
    };
  }

  /**
   * Build compliance score changed message
   */
  buildComplianceScoreChangedMessage(eventData: ComplianceEvent): SlackMessage {
    const { tenantId, framework, complianceScore = 0, previousScore = 0, changeReason } = eventData;
    
    const scoreDiff = complianceScore - previousScore;
    const trendEmoji = scoreDiff > 0 ? '📈' : scoreDiff < 0 ? '📉' : '➡️';
    const trendText = scoreDiff > 0 ? 'Improved' : scoreDiff < 0 ? 'Decreased' : 'No Change';
    const scoreEmoji = complianceScore >= 90 ? '🟢' : complianceScore >= 80 ? '🟡' : '🔴';

    return {
      text: `${trendEmoji} Compliance score ${trendText.toLowerCase()}: ${complianceScore}%`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${trendEmoji} *Compliance Score ${trendText}*\n\n*${framework} Compliance Score:* ${scoreEmoji} ${complianceScore}%\n*Previous Score:* ${previousScore}%\n*Change:* ${scoreDiff > 0 ? '+' : ''}${scoreDiff}%`
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Details'
            },
            url: `https://compliance-shepherd.com/compliance/${framework}`,
            action_id: 'view_compliance'
          }
        },
        ...(changeReason ? [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Reason for Change:* ${changeReason}`
          }
        }] : []),
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Framework:* ${framework}`
            },
            {
              type: 'mrkdwn',
              text: `*Current Score:* ${complianceScore}%`
            },
            {
              type: 'mrkdwn',
              text: `*Previous Score:* ${previousScore}%`
            },
            {
              type: 'mrkdwn',
              text: `*Change:* ${scoreDiff > 0 ? '+' : ''}${scoreDiff}%`
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `🏢 ${tenantId} | ⏰ ${format(new Date(), 'MMM dd, yyyy HH:mm:ss')}`
            }
          ]
        }
      ]
    };
  }

  /**
   * Build scan failed message
   */
  buildScanFailedMessage(eventData: ComplianceEvent): SlackMessage {
    const { scanId, tenantId, errorMessage, scanType } = eventData;

    return {
      text: `❌ Compliance scan failed: ${scanId}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `❌ *Compliance Scan Failed*\n\n*Scan ID:* ${scanId}\n*Type:* ${scanType || 'Unknown'}\n*Error:* ${errorMessage || 'Unknown error occurred'}`
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Logs'
            },
            url: `https://compliance-shepherd.com/scans/${scanId}/logs`,
            action_id: 'view_scan_logs'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '⚠️ *Recommended Actions:*\n• Check scan configuration\n• Verify AWS permissions\n• Review error logs\n• Contact support if issue persists'
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Retry Scan'
              },
              style: 'primary',
              url: `https://compliance-shepherd.com/scans/${scanId}/retry`,
              action_id: 'retry_scan'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Contact Support'
              },
              url: 'https://compliance-shepherd.com/support',
              action_id: 'contact_support'
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `🆔 ${scanId} | 🏢 ${tenantId} | ⏰ ${format(new Date(), 'MMM dd, yyyy HH:mm:ss')}`
            }
          ]
        }
      ]
    };
  }

  /**
   * Build scheduled report message
   */
  buildScheduledReportMessage(eventData: ComplianceEvent): SlackMessage {
    const { tenantId, reportType, reportId, framework, complianceScore } = eventData;
    
    const scoreEmoji = (complianceScore || 0) >= 90 ? '🟢' : (complianceScore || 0) >= 80 ? '🟡' : '🔴';

    return {
      text: `📊 ${reportType} report ready`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📊 *${reportType} Report Ready*\n\n*Framework:* ${framework}\n*Compliance Score:* ${scoreEmoji} ${complianceScore}%`
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Report'
            },
            style: 'primary',
            url: `https://compliance-shepherd.com/reports/${reportId}`,
            action_id: 'view_report'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Report Type:* ${reportType}`
            },
            {
              type: 'mrkdwn',
              text: `*Framework:* ${framework}`
            },
            {
              type: 'mrkdwn',
              text: `*Generated:* ${format(new Date(), 'MMM dd, HH:mm')}`
            },
            {
              type: 'mrkdwn',
              text: `*Report ID:* ${reportId}`
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `🏢 ${tenantId} | ⏰ ${format(new Date(), 'MMM dd, yyyy HH:mm:ss')}`
            }
          ]
        }
      ]
    };
  }

  /**
   * Build custom notification message
   */
  buildCustomNotificationMessage(
    title: string,
    message: string,
    tenantId: string,
    severity: 'INFO' | 'WARNING' | 'ERROR' = 'INFO',
    actionUrl?: string
  ): SlackMessage {
    const severityEmoji = {
      'INFO': 'ℹ️',
      'WARNING': '⚠️',
      'ERROR': '❌'
    };

    const blocks: any[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${severityEmoji[severity]} *${title}*\n\n${message}`
        }
      }
    ];

    if (actionUrl) {
      blocks[0].accessory = {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Take Action'
        },
        url: actionUrl,
        action_id: 'custom_action'
      };
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🏢 ${tenantId} | ⏰ ${format(new Date(), 'MMM dd, yyyy HH:mm:ss')}`
        }
      ]
    });

    return {
      text: `${severityEmoji[severity]} ${title}`,
      blocks
    };
  }

  /**
   * Build summary message with multiple findings
   */
  buildSummaryMessage(
    title: string,
    summary: { label: string; value: string | number; emoji?: string }[],
    tenantId: string,
    actionUrl?: string
  ): SlackMessage {
    const fields = summary.map(item => ({
      type: 'mrkdwn',
      text: `*${item.label}:* ${item.emoji || ''}${item.value}`
    }));

    const blocks: any[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📊 *${title}*`
        }
      },
      {
        type: 'section',
        fields
      }
    ];

    if (actionUrl) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Details'
            },
            style: 'primary',
            url: actionUrl,
            action_id: 'view_summary_details'
          }
        ]
      });
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🏢 ${tenantId} | ⏰ ${format(new Date(), 'MMM dd, yyyy HH:mm:ss')}`
        }
      ]
    });

    return {
      text: title,
      blocks
    };
  }
}
