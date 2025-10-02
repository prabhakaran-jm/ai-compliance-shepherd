#!/usr/bin/env node

/**
 * AI Compliance Shepherd - Demo Scenarios Script
 * Creates realistic demo scenarios for judge evaluation
 */

const fs = require('fs');

console.log('🎪 AI Compliance Shepherd - Demo Scenarios Generation...\n');

// Scenario 1: SOC 2 Compliance Journey
const scenario1 = {
  id: 'SOC2_COMPLIANCE_JOURNEY',
  name: 'SOC 2 Type II Compliance Assessment',
  description: 'Complete enterprise SOC 2 compliance evaluation',
  duration: '5 minutes',
  audience: 'Enterprise Security Teams',
  
  flow: [
    {
      step: 1,
      title: 'Initial Assessment',
      action: 'User asks: "Assess our SOC 2 compliance status"',
      agentResponse: 'I\'ll scan your AWS environment against SOC 2 Type II controls...',
      outcomes: [
        'Discovers 23 resources across 2 regions',
        'Identifies 15 compliance findings',
        'Prioritizes by business impact and risk'
      ],
      metrics: {
        scannedResources: 23,
        findingsFound: 15,
        criticalIssues: 3,
        estimatedSavings: '$12,400/month'
      }
    },
    {
      step: 2,
      title: 'Deep Dive Analysis',
      action: 'User follows: "Show me the critical CC 6.1 encryption issues"',
      agentResponse: 'Focusing on CC 6.1 - System Security controls...',
      outcomes: [
        'Details specific S3 buckets without encryption',
        'Explains SOC 2 requirements in plain English',
        'Provides remediation roadmap'
      ],
      metrics: {
        issuesDetailed: 3,
        frameworksReferenced: ['SOC2-CC6.1', 'AWS-Security-Best-Practices'],
        remediationActions: 7
      }
    },
    {
      step: 3,
      title: 'Automated Remediation',
      action: 'User approves: "Apply safe fixes for encryption issues"',
      agentResponse: 'Initiating safe remediation with guardrails...',
      outcomes: [
        'Applies S3 encryption to 3 buckets',
        'Updates IAM policies for least privilege',
        'Validates changes and updates compliance score'
      ],
      metrics: {
        automatedFixes: 7,
        successRate: '100%',
        timeToFix: '3 minutes',
        complianceScoreIncrease: '+12.3%'
      }
    }
  ],
  
  businessImpact: {
    beforeCompliance: {
      auditCost: 45000,
      manualEffortHours: 200,
      complianceScore: 62,
      riskRating: 'HIGH'
    },
    afterCompliance: {
      auditCost: 8500,
      manualEffortHours: 15,
      complianceScore: 89,
      riskRating: 'LOW',
      monthlySavings: 12400
    }
  }
};

// Scenario 2: Conversational Compliance Assistant
const scenario2 = {
  id: 'CONVERSATIONAL_COMPLIANCE_ASSISTANT',
  name: 'AI-Powered Compliance Conversation',
  description: 'Natural language compliance guidance and analysis',
  duration: '3 minutes',
  audience: 'Non-technical users',
  
  conversationFlow: [
    {
      human: 'Our auditor is asking about our AWS security controls. What should I tell them?',
      agent: 'I can help you prepare for your audit! Let me check your current AWS security posture and identify what SOC 2 controls you\'re complying with.',
      actions: ['Scan AWS resources', 'Analyze against SOC 2 controls', 'Generate audit-ready summary']
    },
    {
      human: 'Specifically, they\'re asking about CC 6.1 system security measures.',
      agent: 'Perfect! CC 6.1 covers logical and physical access security. Based on your AWS environment, here\'s what you\'d tell your auditor...',
      evidence: [
        '✅ S3 buckets configured with encryption at rest',
        '✅ IAM policies follow least privilege principles',
        '⚠️ 3 security groups could be more restrictive',
        '✅ CloudTrail logging enabled across all regions'
      ]
    },
    {
      human: 'How do I explain the security group issue to them?',
      agent: 'Great question! Here\'s exactly how to address it with your auditor...',
      response: 'Three security groups allow overly broad access (0.0.0.0/0). SOC 2 CC 6.1 requires restricting access to only authorized personnel and systems. You can explain our automation has identified these gaps and we\'ve created a remediation plan to tighten access controls.'
    }
  ],
  
  aiCapabilitiesDemonstrated: [
    'Context understanding',
    'Framework-specific knowledge',
    'Plain English explanations',
    'Audit readiness assistance',
    'Proactive problem identification'
  ]
};

// Scenario 3: Continuous Compliance Monitoring
const scenario3 = {
  id: 'CONTINUOUS_COMPLIANCE_MONITORING',
  name: 'Real-time Compliance Monitoring',
  description: '24/7 autonomous compliance monitoring dashboard',
  duration: '2 minutes',
  audience: 'Security Operations',
  
  monitoringDashboard: {
    realTimeMetrics: {
      complianceScore: {
        current: 87.5,
        target: 95.0,
        trend: '+3.2% this month',
        color: 'green'
      },
      activeFindings: {
        total: 12,
        critical: 1,
        high: 2,
        medium: 5,
        low: 4,
        trend: '-67% vs last month'
      },
      costSavings: {
        monthly: 84500,
        annually: 1014000,
        roi: 340,
        trend: '+12% vs last quarter'
      },
      automationCoverage: {
        scanning: '100%',
        remediation: '89%',
        reporting: '100%',
        alerting: '100%'
      }
    },
    
    alertsGenerated: [
      {
        timestamp: '2024-01-15T10:30:00Z',
        severity: 'HIGH',
        type: 'Security Group',
        message: 'Wide-open security group detected on prod-database-sg',
        impact: 'PCI DSS Req 1.1 violation',
        autoFixed: true,
        fixedAt: '2024-01-15T10:35:00Z'
      },
      {
        timestamp: '2024-01-15T14:22:00Z',
        severity: 'MEDIUM',
        type: 'IAM Policy',
        message: 'Overly permissive S3 access policy detected',
        impact: 'Principle of least privilege violation',
        autoFixed: false,
        reason: 'Requires human approval for data access changes'
      }
    ],
    
    continuousActivities: [
      'Scanning 47 AWS resources every 2 hours',
      'Monitoring 156 compliance checks continuously',
      'Generating alerts for 7 frameworks',
      'Maintaining audit trail for all changes'
    ]
  }
};

// Scenario 4: Audit Pack Generation
const scenario4 = {
  id: 'AUDIT_PACK_GENERATION',
  name: 'Professional Audit Evidence Package',
  description: 'Automated generation of audit-ready documentation',
  duration: '4 minutes',
  audience: 'External Auditors',
  
  auditPackComponents: {
    overview: {
      framework: 'SOC 2 Type II',
      assessmentPeriod: 'Q4 2024',
      customerName: 'TechCorp Financial',
      complianceScore: 89,
      totalEvidence: 156
    },
    
    generatedDocuments: [
      {
        name: 'Executive Summary',
        format: 'PDF',
        size: '2.3 MB',
        content: 'High-level compliance status and key achievements',
        includes: ['ROI metrics', 'Risk mitigation', 'Strategic recommendations']
      },
      {
        name: 'Detailed Findings Report',
        format: 'Excel',
        size: '1.8 MB', 
        content: 'All 127 findings with remediation status',
        includes: ['Severity ratings', 'Business impact', 'Remediation timelines']
      },
      {
        name: 'Evidence Package',
        format: 'ZIP',
        size: '45.7 MB',
        content: 'Supporting documentation and system configurations',
        includes: ['AWS configs', 'IAM policies', 'Security group rules', 'Service configurations']
      },
      {
        name: 'Compliance Assessment Matrix',
        format: 'PDF',
        size: '3.1 MB',
        content: 'Control-by-control compliance evaluation',
        includes: ['SOC 2 controls mapping', 'Evidence references', 'Gap analysis']
      }
    ],
    
    professionalFeatures: [
      'Auditor-ready formatting',
      'Watermarked with company branding',
      'Digital signatures for authenticity',
      'Compressed archives for easy sharing',
      'Index references for quick navigation'
    ],
    
    businessValue: {
      preparationTime: 'Reduced from 6 weeks to 2 days',
      auditorSatisfaction: '95% positive feedback',
      followUpQuestions: 'Reduced by 70%',
      auditCost: '40% reduction vs manual preparation'
    }
  }
};

// Scenario 5: Multi-Tenant Enterprise Demo
const scenario5 = {
  id: 'MULTI_TENANT_ENTERPRISE',
  name: 'Enterprise Multi-Tenant Platform',
  description: 'Demonstration of scalable enterprise platform',
  duration: '3 minutes',
  audience: 'Enterprise Buyers',
  
  enterpriseFeatures: {
    tenantOverview: [
      {
        tenant: 'Financial Services Corp',
        tier: 'ENTERPRISE',
        regions: ['us-east-1', 'eu-west-1'],
        spend: 285000,
        savings: 189000,
        complianceScore: 94
      },
      {
        tenant: 'Healthcare Provider Inc',
        tier: 'PREMIUM',
        regions: ['us-west-2'],
        spend: 125000,
        savings: 67000,
        complianceScore: 87
      },
      {
        tenant: 'Tech Startup LLC',
        tier: 'STANDARD',
        regions: ['us-east-1'],
        spend: 15000,
        savings: 4500,
        complianceScore: 79
      }
    ],
    
    scalabilityMetrics: {
      totalActiveTenants: '247',
      totalAWSResourcesMonitored: '156,000',
      totalComplianceChecksPerDay: '2.3M',
      averageScanLatency: '2.4 seconds',
      platformUptime: '99.97%'
    },
    
    enterpriseFeatures: [
      'Customer-specific data isolation',
      'Custom compliance frameworks',
      'Advanced reporting and analytics',
      'API-based integrations',
      'White-label deployment options',
      'Dedicated customer support'
    ],
    
    businessMetrics: {
      marketSize: '$50 billion compliance industry',
      addressableMarket: '12,000 enterprise AWS customers',
      averageDealSize: '$500K annually',
      expansionRevenue: '180% MRR growth'
    }
  }
};

// Generate demo data files
async function generateDemoScenarioFiles() {
  console.log('📝 Generating demo scenario files...');
  
  const scenarios = {
    soc2ComplianceJourney: scenario1,
    conversationalAssistant: scenario2,
    continuousMonitoring: scenario3,
    auditPackGeneration: scenario4,
    multiTenantEnterprise: scenario5
  };
  
  // Save individual scenario files
  Object.entries(scenarios).forEach(([key, scenario]) => {
    fs.writeFileSync(
      `demo-scenarios/${key}.json`, 
      JSON.stringify(scenario, null, 2)
    );
    console.log(`✅ Created demo-scenarios/${key}.json`);
  });
  
  // Create master scenario configuration
  const masterConfig = {
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      hackathonTarget: 'AWS AI Agent Global Hackathon 2025',
      totalScenarios: Object.keys(scenarios).length,
      totalDuration: '17 minutes for all scenarios'
    },
    
    recommendedDemoFlow: [
      {
        scenario: 'conversationalAssistant',
        duration: '3 minutes',
        audience: 'General judges',
        priority: 'HIGH'
      },
      {
        scenario: 'continuousMonitoring', 
        duration: '2 minutes',
        audience: 'Technical judges',
        priority: 'HIGH'
      },
      {
        scenario: 'soc2ComplianceJourney',
        duration: '5 minutes',
        audience: 'Business judges',
        priority: 'MEDIUM'
      },
      {
        scenario: 'auditPackGeneration',
        duration: '4 minutes', 
        audience: 'Assessment judges',
        priority: 'MEDIUM'
      },
      {
        scenario: 'multiTenantEnterprise',
        duration: '3 minutes',
        audience: 'Enterprise judges',
        priority: 'LOW'
      }
    ],
    
    demoTiming: {
      totalDuration: '17 minutes',
      recommendedDemonstration: 'Choose 3 scenarios (10 minutes)',
      fullDemonstration: 'All scenarios (17 minutes)',
      highlightReel: '2 scenarios (5 minutes)'
    },
    
    scenarios: scenarios
  };
  
  // Ensure demo-scenarios directory exists
  if (!fs.existsSync('demo-scenarios')) {
    fs.mkdirSync('demo-scenarios');
  }
  
  fs.writeFileSync(
    'demo-scenarios/master-config.json',
    JSON.stringify(masterConfig, null, 2)
  );
  
  console.log('✅ Created demo-scenarios/master-config.json');
}

// Create demo script integration
function createDemoScriptIntegration() {
  console.log('🎬 Creating demo script integration...');
  
  const scriptIntegration = `# Demo Script Integration Points

## Scenario 1: Conversational Compliance Assistant (RECOMMENDED for 3-minute demo)

### 0:00-0:30 Opening Hook
**Problem Statement**: "Companies spend $500K annually on compliance audits"
- Visual: Show traditional audit workflow complexity
- Voiceover: "Manual compliance is expensive, slow, and error-prone"

### 0:30-1:45 Core Demo - AI Agent Conversation  
**AI Agent Interaction**:
1. (15s) User: "What are our SOC 2 compliance gaps?"
   - Agent: "Scanning your AWS environment against SOC 2 controls..."
   - Live scan results appear

2. (30s) User: "Show me the encryption issues"
   - Agent explains CC 6.1 requirements in plain English
   - Shows specific findings with business impact

3. (30s) User: "How do I fix these automatically?"
   - Agent proposes safe remediation plan
   - Demonstrates autonomous fix application

### 1:45-2:30 Impact Demonstration
**Business Value**:
- Live dashboard showing cost savings ($84K/month)
- Compliance score improvement (+12%)
- Time saved (weeks to days)

### 2:30-3:00 Closing Vision
**Market Transformation**:
- "This is the future of enterprise compliance"
- Demo URLs for judges to explore live

## Scenario 2: Continuous Monitoring Dashboard

### Quick Dashboard Tour (2 minutes)
- Real-time compliance metrics
- Automated alert management  
- Cost savings visualization
- Enterprise scale demonstration

## Scenario 3: Audit Pack Generation

### Professional Output (4 minutes)
- Generate complete SOC 2 audit pack
- Show professional formatting
- Demonstrate business value
- Highlight automation accuracy

## Technical Demo Notes

### Preparing for Demo
\`\`\`bash
# 1. Generate all demo scenarios
node scripts/demo-scenarios.js

# 2. Optimize demo environment  
node scripts/demo-optimization.js

# 3. Deploy demo infrastructure
./scripts/test-and-deploy-strategy.sh deploy

# 4. Prepare demo environment
./scripts/test-and-deploy-strategy.sh optimize
\`\`\`

### During Demo
- Use pre-loaded demo data for consistency
- Follow script timing strictly
- Highlight AI agent autonomy prominently
- Emphasize measurable business impact
- Keep technical details concise

### Backup Plans
- Pre-recorded video if live demo fails
- Static screenshots if dynamic content issues
- Mock responses if APIs are slow
- Local demo environment if AWS issues
`;

  fs.writeFileSync('DEMO_SCRIPT_INTEGRATION.md', scriptIntegration);
  console.log('✅ Created demo script integration guide');
}

// Main execution
async function main() {
  try {
    await generateDemoScenarioFiles();
    createDemoScriptIntegration();
    
    console.log('\n🎉 Demo Scenarios Generation Complete!');
    console.log('\n📁 Generated files:');
    console.log('  • demo-scenarios/soc2ComplianceJourney.json');
    console.log('  • demo-scenarios/conversationalAssistant.json');
    console.log('  • demo-scenarios/continuousMonitoring.json');
    console.log('  • demo-scenarios/auditPackGeneration.json');
    console.log('  • demo-scenarios/multiTenantEnterprise.json');
    console.log('  • demo-scenarios/master-config.json');
    console.log('  • DEMO_SCRIPT_INTEGRATION.md');
    
    console.log('\n🎯 Recommended demo strategy:');
    console.log('  1. Use "Conversational Assistant" scenario for core 3-minute demo');
    console.log('  2. Add "Continuous Monitoring" for technical depth');
    console.log('  3. Include "Audit Pack Generation" for business impact');
    console.log('  4. Reference "Multi-Tenant" for full platform demonstration');
    
    console.log('\n🏆 Perfect for AWS AI Agent Hackathon judges! 🏆');
    
  } catch (error) {
    console.error('❌ Demo scenarios generation failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
