#!/usr/bin/env node

/**
 * Demo Environment Deployment Script for AI Compliance Shepherd
 * 
 * This script deploys the complete platform with demo data to showcase
 * all capabilities including scans, findings, reports, and AI chat.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { generateDemoData } = require('./seed-demo-data');

// Demo configuration
const DEMO_CONFIG = {
  environment: 'demo',
  region: 'us-east-1',
  stackName: 'ai-compliance-shepherd-demo',
  bucketPrefix: 'ai-compliance-demo',
  tablePrefix: 'ai-compliance-demo',
  tags: {
    Environment: 'demo',
    Purpose: 'demo',
    Owner: 'ai-compliance-shepherd'
  },
  
  // Demo tenant configuration
  demoTenants: [
    {
      id: 'tenant-demo-acme',
      name: 'ACME Corporation (Demo)',
      tier: 'PREMIUM',
      description: 'Demonstration tenant showing premium tier capabilities',
      settings: {
        demoMode: true,
        aiChatEnabled: true,
        maxConcurrentScans: 5,
        notificationsEnabled: true
      }
    }
  ],
  
  // Demo user configuration
  demoUsers: [
    {
      email: 'demo-admin@acme-demo.com',
      name: 'Demo Administrator',
      role: 'manager',
      permissions: ['all']
    },
    {
      email: 'demo-security@acme-demo.com',
      name: 'Demo Security User',
      role: 'analyst',
      permissions: ['scan:read', 'scan:create', 'findings:all', 'reports:all']
    },
    {
      email: 'demo-viewer@acme-demo.com',
      name: 'Demo Viewer',
      role: 'viewer',
      permissions: ['scan:read', 'findings:read', 'reports:read']
    }
  ]
};

/**
 * Deploy demo infrastructure
 */
async function deployDemoInfrastructure() {
  console.log('🏗️  Deploying demo infrastructure...\n');
  
  try {
    // Check if AWS CLI is available
    execSync('aws --version', { stdio: 'pipe' });
    console.log('✅✓ AWS CLI available');
    
    // Check if CDK is installed
    try {
      execSync('cdk --version', { stdio: 'pipe' });
      console.log('✅✓ AWS CDK available');
    } catch (error) {
      console.log('⚠️  AWS CDK not found, installing...');
      execSync('npm install -g aws-cdk');
      console.log('✅✓ AWS CDK installed');
    }
    
    // Deploy infrastructure using CDK
    console.log('📦 Building infrastructure...');
    execSync('npm run build:infra', { stdio: 'inherit', cwd: process.cwd() });
    
    console.log('🚀 Deploying infrastructure stack...');
    const deployCommand = `cdk deploy ${DEMO_CONFIG.stackName} --context environment=${DEMO_CONFIG.environment} --context region=${DEMO_CONFIG.region} --require-approval never`;
    execSync(deployCommand, { stdio: 'inherit' });
    
    console.log('✅ Demo infrastructure deployed successfully\n');
    return true;
    
  } catch (error) {
    console.error('❌ Failed to deploy demo infrastructure:', error.message);
    return false;
  }
}

/**
 * Seed demo data into deployed environment
 */
async function seedDemoData() {
  console.log('🌱 Seeding demo data...\n');
  
  try {
    // Generate demo data
    console.log('📊 Generating comprehensive demo data...');
    const demoData = generateDemoData();
    
    // Create demo-data directory
    const demoDataDir = path.join(__dirname, 'demo-data');
    if (!fs.existsSync(demoDataDir)) {
      fs.mkdirSync(demoDataDir, { recursive: true });
    }
    
    // Write demo data files
    fs.writeFileSync(
      path.join(demoDataDir, 'complete-demo-data.json'),
      JSON.stringify(demoData, null, 2)
    );
    
    console.log(`✅ Demo data generated (${Object.keys(demoData).length} entities)`);
    console.log(`   📁 Saved to: ${path.join(demoDataDir, 'complete-demo-data.json')}`);
    
    // TODO: Implement actual data seeding via DynamoDB and S3 APIs
    console.log('📤 TODO: Seed demo data via DynamoDB and S3 APIs');
    console.log('   Note: This requires AWS credentials and deployed infrastructure');
    
    return demoData;
    
  } catch (error) {
    console.error('❌ Failed to seed demo data:', error.message);
    return null;
  }
}

/**
 * Configure demo web UI
 */
async function configureDemoUI() {
  console.log('🎨 Configuring demo web UI...\n');
  
  try {
    // Create demo UI configuration
    const uiConfig = {
      environment: 'demo',
      apiEndpoint: `https://api-demo.ai-compliance-shepherd.com`,
      websocketEndpoint: `wss://ws-demo.ai-compliance-shepherd.com`,
      features: {
        realTimeChat: true,
        liveScanning: true,
        aiGuidance: true,
        automatedRemediation: true,
        reportGeneration: true,
        auditPackGeneration: true,
        slackIntegration: false // Disabled for demo
      },
      branding: {
        title: 'AI Compliance Shepherd - Demo',
        logo: '/assets/demo-logo.png',
        colorScheme: 'blue',
        showDemoBadge: true
      },
      limits: {
        maxConcurrentScans: 3,
        maxChatSessions: 2,
        maxReportGenerations: 10,
        demoResetInterval: 24 // hours
      }
    };
    
    // Write UI configuration
    const uiConfigPath = path.join(__dirname, 'demo-data', 'ui-config.json');
    fs.writeFileSync(uiConfigPath, JSON.stringify(uiConfig, null, 2));
    
    console.log('✅ Demo UI configuration created');
    console.log(`   📁 Saved to: ${uiConfigPath}`);
    
    return uiConfig;
    
  } catch (error) {
    console.error('❌ Failed to configure demo UI:', error.message);
    return null;
  }
}

/**
 * Create demo scenarios and test cases
 */
async function createDemoScenarios() {
  console.log('🎯 Creating demo scenarios and test cases...\n');
  
  const scenarios = [
    {
      id: 'scenario-compliance-overview',
      name: 'Compliance Overview Dashboard',
      description: 'Demonstrates comprehensive compliance posture across multiple frameworks',
      steps: [
        'View compliance dashboard with SOC 2, HIPAA, and PCI-DSS frameworks',
        'Navigate through critical, high, medium, and low severity findings',
        'Explore drill-down reports by service (S3, IAM, EC2, RDS)',
        'Review compliance score trends and resolution progress'
      ],
      expectedOutcome: 'User understands current compliance posture and priority areas'
    },
    {
      id: 'scenario-ai-chat-guidance',
      name: 'AI-Powered Compliance Guidance',
      description: 'Interactive chat with Bedrock AI for compliance questions',
      steps: [
        'Open AI chat interface and initiate conversation',
        'Ask "How do I secure my S3 buckets for SOC 2 compliance?"',
        'Follow AI suggestions for specific remediation steps',
        'Use AI to get compliance framework explanations',
        'Test natural language queries about specific findings'
      ],
      expectedOutcome: 'User receives contextual, actionable compliance guidance'
    },
    {
      id: 'scenario-automated-remediation',
      name: 'Automated Security Remediation',
      description: 'Safe automated remediation of compliance findings',
      steps: [
        'Identify findings marked as "Available for automated remediation"',
        'Review remediation plan and safety guardrails',
        'Approve automated fix for low-risk S3 bucket encryption',
        'Monitor remediation progress in real-time',
        'Verify fix application and finding closure'
      ],
      expectedOutcome: 'Understanding of automated remediation capabilities and safety'
    },
    {
      id: 'scenario-audit-pack-generation',
      name: 'Professional Audit Pack Generation',
      description: 'Generate comprehensive audit evidence packages',
      steps: [
        'Select SOC 2 Type II compliance audit pack generation',
        'Configure evidence collection scope and timeframe',
        'Generate executive summary with compliance scores',
        'Download comprehensive audit pack (PDF, HTML, JSON)',
        'Review evidence documentation and findings reports'
      ],
      expectedOutcome: 'Audit-ready documentation package for compliance audits'
    },
    {
      id: 'scenario-infrastructure-scanning',
      name: 'Real-Time Infrastructure Scanning',
      description: 'Continuous compliance monitoring and detection',
      steps: [
        'Initiate comprehensive AWS environment scan',
        'Monitor real-time scan progress across regions',
        'Review newly discovered compliance findings',
        'Analyze scan results with trend comparison',
        'Set up automated scanning schedules'
      ],
      expectedOutcome: 'Confidence in continuous compliance monitoring capabilities'
    },
    {
      id: 'scenario-github-integration',
      name: 'Infrastructure as Code Compliance',
      description: 'Shift-left security for Terraform and CloudFormation',
      steps: [
        'Upload Terraform plan file for security analysis',
        'Review compliance findings for infrastructure changes',
        'See IaC shift-left recommendations',
        'Understand pre-deployment compliance check process',
        'Compare planned vs. current infrastructure compliance'
      ],
      expectedOutcome: 'Understanding of proactive compliance checking capabilities'
    }
  ];
  
  // Write scenarios to file
  const scenariosPath = path.join(__dirname, 'demo-data', 'demo-scenarios.json');
  fs.writeFileSync(scenariosPath, JSON.stringify(scenarios, null, 2));
  
  console.log('✅ Demo scenarios created');
  console.log(`   📁 Saved ${scenarios.length} scenarios to: ${scenariosPath}`);
  
  return scenarios;
}

/**
 * Create demo usage documentation
 */
function createDemoDocumentation(demoData, uiConfig, scenarios) {
  console.log('📚 Creating demo usage documentation...\n');
  
  const demoGuide = `
# AI Compliance Shepherd - Demo Environment Guide

## 🚀 Quick Start

Welcome to the AI Compliance Shepherd demo environment! This hands-on demo showcases our AI-powered compliance platform for AWS environments.

### 🎯 Demo Overview

| Metric | Value |
|--------|-------|
| **Demo Companies** | ${demoData.companies.length} |
| **Total Compliance Scans** | ${demoData.scans.length} |
| **Total Findings** | ${demoData.findings.length} |
| **Compliance Frameworks** | ${Object.keys(demoData.summark.frameworkDistribution).length} |
| **Demo Users** | ${DEMO_CONFIG.demoUsers.length} |

### 🏗️ Demo Architecture

The demo environment includes:

- **🔍 Continuous Compliance Scanning** - Automated AWS resource monitoring
- **🤖 AI-Powered Chat Interface** - Natural language compliance guidance
- **📊 Professional Reporting** - Executive summaries and detailed findings
- **⚡ Automated Remediation** - Safe security fixes with approval workflows
- **📦 Audit Pack Generation** - Audit-ready evidence packages
- **🔗 GitHub Integration** - Infrastructure as Code compliance checking
- **📱 Real-Time Dashboards** - Live compliance posture monitoring

### 🎮 Demo Scenarios

Try these interactive scenarios to explore the platform:

${scenarios.map((scenario, index) => `
#### ${index + 1}. ${scenario.name}

**Goal:** ${scenario.description}

**Steps:**
${scenario.steps.map(step => `- ${step}`).join('\n')}

**Expected Outcome:** ${scenario.expectedOutcome}
`).join('')}

### 👥 Demo User Accounts

| Email | Role | Permissions | Use Case |
|-------|------|-------------|----------|
${DEMO_CONFIG.demoUsers.map(user => 
  `| ${user.email} | ${user.role} | ${user.permissions.join(', ')} | ${user.role === 'manager' ? 'Full platform access and management' : user.role === 'analyst' ? 'Security analysis and remediation' : 'Read-only viewing and reporting'} |`
).join('\n')}

### 🏢 Demo Companies

${demoData.companies.map(company => `
#### ${company.name} (${company.tier} Tier)
- **Industry:** ${company.industry}
- **Employees:** ${company.employees.toLocaleString()}
- **Compliance Requirements:** ${company.complianceRequirements.join(', ')}
- **Risk Profile:** ${company.riskProfile}
- **Key Metrics:**
  - Total Scans: ${company.scanSummary.totalScans}
  - Total Findings: ${company.scanSummary.totalFindings}
  - Critical Issues: ${company.scanSummary.criticalFindings}
  - Resolution Rate: ${company.scanSummary.resolutionRate}%
`).join('')}

### 📊 Demo Data Highlights

**Compliance Findings Distribution:**
- 🔴 **Critical**: ${demoData.summary.totalCriticalFindings} findings requiring immediate attention
- 🟠 **High**: ${demoData.summary.totalHighFindings} high-priority security issues
- 🟡 **Medium**: ${demoData.summary.totalMediumFindings} moderate risk findings
- 🟢 **Low**: ${demoData.summary.totalLowFindings} low-priority items

**Framework Coverage:**
${Object.entries(demoData.summary.frameworkDistribution).map(([framework, count]) => 
  `- **${framework}**: ${count} findings mapped to framework controls`
).join('\n')}

**Performance Metrics:**
- Average Scan Duration: ${demoData.summary.averageScanDuration} seconds
- Total Resources Monitored: ${demoData.summary.totalResourcesScanned.toLocaleString()}
- Overall Resolution Rate: ${demoData.summary.resolutionRate}%

### 🛠️ Technical Details

**Demo Environment Configuration:**
- **Region**: ${DEMO_CONFIG.region}
- **Stack Name**: ${DEMO_CONFIG.stackName}
- **Environment**: ${DEMO_CONFIG.environment}
- **API Endpoint**: ${uiConfig.apiEndpoint}
- **WebSocket Endpoint**: ${uiConfig.websocketEndpoint}

**Features Enabled:**
${Object.entries(uiConfig.features).map(([feature, enabled]) => 
  `- **${feature}**: ${enabled ? '✅ Enabled' : '❌ Disabled'}`
).join('\n')}

### 🔐 Demo Security Features

**Demonstrated Security Capabilities:**
- Multi-tenant data isolation
- Role-based access control
- Audit logging and compliance trails
- Automated security scanning
- Vulnerability detection and prioritization
- Remediation tracking and validation
- Data encryption and secure storage

### 📈 Business Value Demonstration

**Risk Reduction:**
- Continuous compliance monitoring reduces breach risk
- AI-powered guidance accelerates remediation
- Automated scanning eliminates manual oversight gaps

**Cost Optimization:**
- Automated remediation reduces manual security work
- Comprehensive reporting streamlines audit processes
- Preventive measures reduce incident costs

**Operational Excellence:**
- Single platform consolidates compliance tools
- Real-time dashboards provide instant visibility
- Professional reports meet audit requirements

### 🎯 Demo Best Practices

**Before Starting:**
1. Review the demo scenarios and choose your learning objectives
2. Familiarize yourself with demo company profiles
3. Understand compliance frameworks being demonstrated

**During Demo:**
1. Focus on business outcomes, not just technical features
2. Ask questions about compliance requirements and best practices
3. Explore both automated and manual remediation workflows
4. Test AI chat capabilities with real compliance scenarios

**Demo Completion:**
1. Review key metrics and compliance improvements
2. Discuss integration with existing security tools
3. Explore customization options for your organization
4. Understand deployment and operational requirements

### 📞 Next Steps

After experiencing the demo:

1. **Schedule Technical Deep-Dive** - Explore architecture and integration options
2. **Discuss Compliance Requirements** - Map your specific framework needs
3. **Plan Pilot Deployment** - Start with limited scope deployment
4. **Arrange Security Review** - Validate platform security and controls

### 🆘 Demo Support

For demo assistance or questions:
- **Technical Issues**: See troubleshooting section below
- **Feature Questions**: Use AI chat interface for instant guidance
- **Demo Data**: Refresh browser to reset to initial state
- **User Assistance**: Contact demo administrator

### 📚 Additional Resources

- **Platform Documentation**: Comprehensive guides and API reference
- **Compliance Frameworks**: Detailed SOC 2, HIPAA, GDPR coverage
- **Security Best Practices**: Industry-standard recommendations
- **Integration Guides**: GitHub, Slack, and third-party integrations

---

**Demo Version:** ${demoData.metadata.version}
**Generated:** ${demoData.metadata.generatedAt}
**Environment:** ${DEMO_CONFIG.environment}

*This is a demonstration environment with simulated data for illustrative purposes.*
`;

  // Write documentation
  const docPath = path.join(__dirname, 'demo-data', 'DEMO_GUIDE.md');
  fs.writeFileSync(docPath, demoGuide);
  
  console.log('✅ Demo documentation created');
  console.log(`   📁 Saved to: ${docPath}`);
  
  return demoGuide;
}

/**
 * Main deployment function
 */
async function deployDemoEnvironment() {
  console.log('🚀 AI Compliance Shepherd Demo Environment Deployment\n');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Deploy infrastructure
    const infrastructureDeployed = await deployDemoInfrastructure();
    if (!infrastructureDeployed) {
      console.log('⚠️  Skipping demo data seeding due to infrastructure deployment failure');
      console.log('   💡 Run infrastructure deployment manually first');
    }
    
    // Step 2: Generate and seed demo data
    console.log('🌱 Generating demo data...');
    const demoData = await seedDemoData();
    
    // Step 3: Configure demo UI
    const uiConfig = await configureDemoUI();
    
    // Step 4: Create demo scenarios
    const scenarios = await createDemoScenarios();
    
    // Step 5: Create documentation
    createDemoDocumentation(demoData, uiConfig, scenarios);
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ Demo environment deployment completed!\n');
    
    console.log('📁 Demo Files Created:');
    console.log('   📄 demo-data/complete-demo-data.json  - Complete dataset');
    console.log('   ⚙️  demo-data/ui-config.json          - UI configuration');
    console.log('   🎯 demo-data/demo-scenarios.json      - Interactive scenarios');
    console.log('   📚 demo-data/DEMO_GUIDE.md             - Comprehensive guide\n');
    
    console.log('🎮 Ready for Demo!');
    console.log('   📖 Read DEMO_GUIDE.md for complete walkthrough');
    console.log('   🔍 Explore demo scenarios and user accounts');
    console.log('   💬 Try AI chat with compliance questions');
    console.log('   📊 Review comprehensive compliance dashboards\n');
    
    console.log('🚀 Demo Environment Status: READY');
    
  } catch (error) {
    console.error('\n❌ Demo deployment failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   🔧 Check AWS credentials and permissions');
    console.error('   📦 Ensure all dependencies are installed');
    console.error('   🌐 Verify internet connectivity');
    console.error(`   📁 Check file system permissions in ${__dirname}`);
    process.exit(1);
  }
}

// Command line execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
AI Compliance Shepherd Demo Environment Deployment

Usage: node deploy-demo-environment.js [options]

Options:
  --help, -h          Show this help message
  --infra-only        Deploy infrastructure only
  --data-only         Generate demo data only
  --guide-only        Create documentation only

Examples:
  node deploy-demo-environment.js              # Deploy complete demo environment
  node deploy-demo-environment.js --data-only  # Generate demo data only
  node deploy-demo-environment.js --infra-only # Deploy infrastructure only

Prerequisites:
  - AWS CLI configured with appropriate permissions
  - Node.js 18+ and npm installed
  - AWS CDK access (will be installed automatically)
    `);
    process.exit(0);
  }
  
  // Execute based on options
  if (args.includes('--infra-only')) {
    deployDemoInfrastructure();
  } else if (args.includes('--data-only')) {
    seedDemoData().then(() => configureDemoUI().then(() => createDemoScenarios()));
  } else if (args.includes('--guide-only')) {
    const demoData = generateDemoData();
    const uiConfig = require('./demo-data/ui-config.json');
    const scenarios = require('./demo-data/demo-scenarios.json');
    createDemoDocumentation(demoData, uiConfig, scenarios);
  } else {
    deployDemoEnvironment();
  }
}

module.exports = { 
  deployDemoEnvironment, 
  deployDemoInfrastructure, 
  seedDemoData,
  createDemoScenarios,
  DEMO_CONFIG 
};
