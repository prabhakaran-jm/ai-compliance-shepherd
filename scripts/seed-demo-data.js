#!/usr/bin/env node

/**
 * Demo Data Seeding Script for AI Compliance Shepherd
 * 
 * This script creates comprehensive demo data to showcase the platform
 * capabilities including tenants, compliance findings, scan results,
 * and audit scenarios.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Demo data generation utilities
const generateTenantId = () => `tenant-demo-${Math.random().toString(36).substr(2, 9)}`;
const generateScanId = () => `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const generateFindingId = () => `finding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const generateUserId = () => `user-demo-${Math.random().toString(36).substr(2, 9)}`;

// Demo companies with realistic characteristics
const demoCompanies = [
  {
    id: 'tenant-acme-corp',
    name: 'ACME Corporation',
    tier: 'PREMIUM',
    industry: 'FinTech',
    description: 'Leading financial technology company processing millions of transactions daily',
    complianceRequirements: ['SOC2', 'PCI-DSS'],
    regions: ['us-east-1', 'us-west-2', 'eu-west-1'],
    riskProfile: 'HIGH',
    employees: 500,
    foundedYear: 2015
  },
  {
    id: 'tenant-healthcare-plus',
    name: 'Healthcare Plus',
    tier: 'ENTERPRISE',
    industry: 'Healthcare',
    description: 'Regional healthcare provider serving 50,000+ patients',
    complianceRequirements: ['HIPAA', 'SOC2'],
    regions: ['us-east-1', 'us-central-1'],
    riskProfile: 'CRITICAL',
    employees: 2500,
    foundedYear: 1998
  },
  {
    id: 'tenant-startup-xl',
    name: 'StartupXL',
    tier: 'STANDARD',
    industry: 'SaaS',
    description: 'Fast-growing SaaS startup with innovative AI solutions',
    complianceRequirements: ['SOC2'],
    regions: ['us-east-1'],
    riskProfile: 'MEDIUM',
    employees: 75,
    foundedYear: 2020
  },
  {
    id: 'tenant-edu-platform',
    name: 'Education Platform',
    tier: 'BASIC',
    industry: 'EdTech',
    description: 'Online education platform with global reach',
    complianceRequirements: [],
    regions: ['us-east-1'],
    riskProfile: 'LOW',
    employees: 25,
    foundedYear: 2022
  },
  {
    id: 'tenant-retail-chain',
    name: 'Retail Chain Corp',
    tier: 'PREMIUM',
    industry: 'Retail',
    description: 'National retail chain with e-commerce platform',
    complianceRequirements: ['SOC2', 'PCI-DSS', 'GDPR'],
    regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'],
    riskProfile: 'HIGH',
    employees: 15000,
    foundedYear: 1985
  }
];

// Compliance findings with realistic patterns
const complianceFindings = [
  // Critical S3 Issues
  {
    ruleId: 'S3_BUCKET_PUBLIC_READ_PROHIBITED',
    severity: 'CRITICAL',
    resourceType: 'S3Bucket',
    service: 's3',
    category: 'Public Access',
    title: 'S3 Bucket Allows Public Read Access',
    description: 'S3 bucket configuration allows public read access to objects',
    remediation: 'Remove public read permissions from bucket policy and ACL',
    automatedRemediation: true,
    evidence: {
      bucketPolicy: {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: 'arn:aws:s3:::public-bucket/*'
        }]
      }
    }
  },
  {
    ruleId: 'S3_BUCKET_PUBLIC_WRITE_PROHIBITED',
    severity: 'HIGH',
    resourceType: 'S3Bucket',
    service: 's3',
    category: 'Public Access',
    title: 'S3 Bucket Allows Public Write Access',
    description: 'S3 bucket allows public write access, enabling data modification',
    remediation: 'Configure bucket to block public write access',
    automatedRemediation: true
  },
  {
    ruleId: 'S3_BUCKET_ENCRYPTION_REQUIRED',
    severity: 'MEDIUM',
    resourceType: 'S3Bucket',
    service: 's3',
    category: 'Encryption',
    title: 'S3 Bucket Lacks Encryption',
    description: 'S3 bucket does not have server-side encryption enabled',
    remediation: 'Enable server-side encryption with AWS KMS',
    automatedRemediation: true
  },
  // IAM Security Issues
  {
    ruleId: 'IAM_USER_MFA_ENABLED',
    severity: 'MEDIUM',
    resourceType: 'IAMUser',
    service: 'iam',
    category: 'Access Control',
    title: 'IAM User Missing MFA',
    description: 'IAM user does not have multi-factor authentication enabled',
    remediation: 'Enable MFA for IAM user account',
    automatedRemediation: false
  },
  {
    ruleId: 'IAM_USER_EXCESSIVE_PERMISSIONS',
    severity: 'HIGH',
    resourceType: 'IAMUser',
    service: 'iam',
    category: 'Access Control',
    title: 'IAM User Has Excessive Permissions',
    description: 'IAM user has administrator permissions that exceed job requirements',
    remediation: 'Implement principle of least privilege for IAM user permissions',
    automatedRemediation: false
  },
  {
    ruleId: 'IAM_PASSWORD_POLICY_WEAK',
    severity: 'MEDIUM',
    resourceType: 'IAMP awdPolicy',
    service: 'iam',
    category: 'Password Policy',
    title: 'Weak Password Policy',
    description: 'IAM password policy does not meet security requirements',
    remediation: 'Strengthen password policy requirements',
    automatedRemediation: true
  },
  // EC2 Security Issues
  {
    ruleId: 'EC2_INSTANCE_PUBLIC_IP_PROHIBITED',
    severity: 'MEDIUM',
    resourceType: 'EC2Instance',
    service: 'ec2',
    category: 'Network Security',
    title: 'EC2 Instance Has Public IP',
    description: 'EC2 instance has public IP address exposed to internet',
    remediation: 'Remove public IP or place instance in private subnet',
    automatedRemediation: false
  },
  {
    ruleId: 'EC2_SECURITY_GROUP_OPEN_PORTS',
    severity: 'HIGH',
    resourceType: 'SecurityGroup',
    service: 'ec2',
    category: 'Network Security',
    title: 'Security Group Has Open Ports',
    description: 'Security group allows inbound connections on sensitive ports',
    remediation: 'Restrict security group rules to necessary ports only',
    automatedRemediation: false
  },
  // CloudTrail Issues
  {
    ruleId: 'CLOUDTRAIL_ENCRYPTION_ENABLED',
    severity: 'MEDIUM',
    resourceType: 'CloudTrail',
    service: 'cloudtrail',
    category: 'Logging',
    title: 'CloudTrail Logs Not Encrypted',
    description: 'CloudTrail log files are not encrypted at rest',
    remediation: 'Enable CloudTrail log file encryption with KMS',
    automatedRemediation: true
  },
  {
    ruleId: 'CLOUDTRAIL_LOG_VALIDATION_ENABLED',
    severity: 'MEDIUM',
    resourceType: 'CloudTrail',
    service: 'cloudtrail',
    category: 'Logging',
    title: 'CloudTrail Log Validation Disabled',
    description: 'CloudTrail log file integrity validation is disabled',
    remediation: 'Enable CloudTrail log file validation',
    automatedRemediation: true
  },
  // RDS Security Issues
  {
    ruleId: 'RDS_PUBLICLY_ACCESSIBLE_PROHIBITED',
    severity: 'CRITICAL',
    resourceType: 'RDSInstance',
    service: 'rds',
    category: 'Database Security',
    title: 'RDS Instance Publicly Accessible',
    description: 'RDS instance is publicly accessible from internet',
    remediation: 'Disable public accessibility for RDS instance',
    automatedRemediation: true
  },
  {
    ruleId: 'RDS_ENCRYPTION_ENABLED',
    severity: 'HIGH',
    resourceType: 'RDSInstance',
    service: 'rds',
    category: 'Encryption',
    title: 'RDS Instance Not Encrypted',
    description: 'RDS instance does not have encryption at rest enabled',
    remediation: 'Enable encryption at rest for RDS instance',
    automatedRemediation: false
  }
];

// Generate realistic scan results for a company
function generateScanResults(company, scanCount = 5) {
  const scans = [];
  const findings = [];
  const now = new Date();
  
  for (let i = 0; i < scanCount; i++) {
    const scanDate = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)); // Each scan 1 day earlier
    const scanId = generateScanId();
    
    // Generate random number of findings for this scan (10-50 for realistic scenarios)
    const findingCount = Math.floor(Math.random() * 40) + 10;
    const scanFindings = [];
    
    // Create findings with realistic distribution
    const criticalCount = Math.floor(findingCount * 0.1); // 10% critical
    const highCount = Math.floor(findingCount * 0.2); // 20% high
    const mediumCount = Math.floor(findingCount * 0.4); // 40% medium
    const lowCount = findingCount - criticalCount - highCount - mediumCount; // 30% low
    
    let findingIndex = 0;
    
    // Generate critical findings
    for (let j = 0; j < criticalCount; j++) {
      const template = complianceFindings.filter(f => f.severity === 'CRITICAL')[j % 2];
      scanFindings.push(createFinding(company, scanId, template));
    }
    
    // Generate high findings
    for (let j = 0; j < highCount; j++) {
      const template = complianceFindings.find(f => f.severity === 'HIGH') || complianceFindings[Math.floor(Math.random() * complianceFindings.length)];
      scanFindings.push(createFinding(company, scanId, template));
    }
    
    // Generate medium and low findings
    for (let j = 0; j < mediumCount + lowCount; j++) {
      const template = complianceFindings[Math.floor(Math.random() * complianceFindings.length)];
      scanFindings.push(createFinding(company, scanId, template));
    }
    
    // Create scan job
    const scan = {
      scanId,
      tenantId: company.id,
      scanType: 'FULL_COMPLIANCE',
      status: 'COMPLETED',
      progress: 100,
      startedAt: scanDate.toISOString(),
      completedAt: new Date(scanDate.getTime() + Math.random() * 60 * 60 * 1000).toISOString(), // 0-1 hour duration
      findingsCount: scanFindings.length,
      results: {
        totalResources: Math.floor(Math.random() * 500) + 100,
        totalFindings: scanFindings.length,
        criticalFindings: scanFindings.filter(f => f.severity === 'CRITICAL').length,
        highFindings: scanFindings.filter(f => f.severity === 'HIGH').length,
        mediumFindings: scanFindings.filter(f => f.severity === 'MEDIUM').length,
        lowFindings: scanFindings.filter(f => f.severity === 'LOW').length
      },
      configuration: {
        regions: company.regions.slice(0, Math.floor(Math.random() * company.regions.length) + 1),
        services: ['s3', 'iam', 'ec2', 'cloudtrail', 'rds'].slice(0, Math.floor(Math.random() * 5) + 1),
        rules: ['all'],
        includeCompliant: false,
        excludeRules: []
      },
      metadata: {
        createdBy: 'demo-seeder',
        source: 'api',
        version: '1.0.0'
      }
    };
    
    scans.push(scan);
    findings.push(...scanFindings);
  }
  
  return { scans, findings };
}

// Create individual finding
function createFinding(company, scanId, template) {
  const findingId = generateFindingId();
  const resourceId = generateResourceId(template.resourceType);
  
  return {
    findingId,
    tenantId: company.id,
    scanId,
    resourceId,
    resourceType: template.resourceType,
    region: company.regions[Math.floor(Math.random() * company.regions.length)],
    accountId: '123456789012',
    severity: template.severity,
    status: Math.random() > 0.7 ? 'RESOLVED' : 'OPEN', // 30% resolved
    ruleId: template.ruleId,
    ruleName: template.title,
    description: template.description,
    remediation: template.remediation,
    automatedRemediationAvailable: template.automatedRemediation,
    resolution: template.automatedRemediation ? 'Available for automatic remediation' : 'Requires manual intervention',
    evidence: generateEvidence(template),
    tags: {
      Environment: Math.random() > 0.5 ? 'production' : 'development',
      Team: getRandomTeam(company),
      Service: template.service,
      ComplianceFramework: company.complianceRequirements[Math.floor(Math.random() * company.complianceRequirements.length)] || 'SOC2'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    firstDiscovered: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() // Within last 30 days
  };
}

// Generate resource ID based on type
function generateResourceId(resourceType) {
  const prefixes = {
    'S3Bucket': 'bucket',
    'IAMUser': 'user',
    'IAMRole': 'role',
    'EC2Instance': 'i-',
    'SecurityGroup': 'sg-',
    'CloudTrail': 'trail',
    'RDSInstance': 'db-',
    'IAMPasswordPolicy': 'password-policy'
  };
  
  const prefix = prefixes[resourceType] || 'resource';
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

// Generate evidence for finding
function generateEvidence(template) {
  const baseEvidence = {
    discoveredAt: new Date().toISOString(),
    source: 'automated-scan',
    confidence: 0.95
  };
  
  switch (template.resourceType) {
    case 'S3Bucket':
      return {
        ...baseEvidence,
        bucketName: `demo-${Math.random().toString(36).substr(2, 9)}`,
        publicReadAcl: template.ruleId.includes('PUBLIC_READ'),
        publicWriteAcl: template.ruleId.includes('PUBLIC_WRITE'),
        encryptionEnabled: !template.ruleId.includes('ENCRYPTION'),
        versioningEnabled: Math.random() > 0.5,
        accessLoggingEnabled: Math.random() > 0.3
      };
    
    case 'IAMUser':
      return {
        ...baseEvidence,
        userName: `demo-user-${Math.random().toString(36).substr(2, 9)}`,
        mfaEnabled: !template.ruleId.includes('MFA'),
        accessKeys: Math.floor(Math.random() * 3),
        lastActivity: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
        attachedPolicies: ['ReadOnlyAccess', 'PowerUserAccess'].slice(0, Math.floor(Math.random() * 2) + 1)
      };
    
    case 'EC2Instance':
      return {
        ...baseEvidence,
        instanceId: `i-${Math.random().toString(36).substr(2, 17)}`,
        instanceType: 't3.micro',
        state: 'running',
        securityGroups: [`sg-${Math.random().toString(36).substr(2, 8)}`],
        publicIp: template.ruleId.includes('PUBLIC') ? '203.0.113.1' : null,
        privateIp: `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        tags: {
          Name: 'Demo Instance',
          Environment: 'production'
        }
      };
    
    default:
      return baseEvidence;
  }
}

// Get random team for company
function getRandomTeam(company) {
  const teams = {
    'FinTech': ['Engineering', 'Security', 'Compliance', 'Platform'],
    'Healthcare': ['IT', 'Security', 'Compliance', 'Clinical'],
    'SaaS': ['Engineering', 'DevOps', 'Security'],
    'EdTech': ['Engineering', 'Content', 'Security'],
    'Retail': ['IT', 'E-commerce', 'Security', 'Compliance']
  };
  
  const companyTeams = teams[company.industry] || ['Engineering', 'Security'];
  return companyTeams[Math.floor(Math.random() * companyTeams.length)];
}

// Generate user accounts for demo companies
function generateUserAccounts(companies) {
  const users = [];
  const userSessions = [];

  companies.forEach(company => {
    // Generate admin users
    const adminUsers = [
      {
        userId: generateUserId(),
        email: `admin@${company.name.toLowerCase().replace(/\s+/g, '')}.com`,
        name: `${company.name} Admin`,
        role: 'admin',
        permissions: ['all'],
        lastLogin: new Date().toISOString(),
        status: 'ACTIVE'
      },
      {
        userId: generateUserId(),
        email: `security@${company.name.toLowerCase().replace(/\s+/g, '')}.com`,
        name: 'Security Manager',
        role: 'security_manager',
        permissions: ['scan:all', 'findings:all', 'reports:all'],
        lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'ACTIVE'
      }
    ];

    // Generate regular users based on company size
    const userCount = Math.floor(company.employees / 10); // 1 user per 10 employees
    
    for (let i = 0; i < userCount; i++) {
      const user = {
        userId: generateUserId(),
        email: `user${i}@${company.name.toLowerCase().replace(/\s+/g, '')}.com`,
        name: `Demo User ${i + 1}`,
        role: 'user',
        permissions: ['scan:read', 'findings:read', 'reports:read'],
        lastLogin: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: Math.random() > 0.1 ? 'ACTIVE' : 'INACTIVE'
      };
      
      adminUsers.push(user);
    }

    adminUsers.forEach(user => {
      users.push({
        ...user,
        tenantId: company.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Create active session for recently logged in users
      if (user.lastLogin && new Date(user.lastLogin) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
        userSessions.push({
          sessionId: uuidv4(),
          userId: user.userId,
          tenantId: company.id,
          status: 'ACTIVE',
          permissions: user.permissions,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
          metadata: {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ipAddress: '192.168.1.100',
            source: 'web'
          }
        });
      }
    });
  });

  return { users, userSessions };
}

// Generate audit logs for demo data
function generateAuditLogs(companies, scans, findings) {
  const auditLogs = [];
  
  companies.forEach(company => {
    scans
      .filter(scan => scan.tenantId === company.id)
      .forEach(scan => {
        // Log scan initiation
        auditLogs.push({
          logId: uuidv4(),
          tenantId: company.id,
          userId: `user-demo-${Math.random().toString(36).substr(2, 9)}`,
          action: 'SCAN_INITIATED',
          resourceType: 'ScanJob',
          resourceId: scan.scanId,
          details: {
            scanType: scan.scanType,
            regions: scan.configuration.regions,
            services: scan.configuration.services
          },
          timestamp: scan.startedAt,
          source: 'demo-seeder',
          ipAddress: '192.168.1.100'
        });

        // Log scan completion
        auditLogs.push({
          logId: uuidv4(),
          tenantId: company.id,
          userId: 'system',
          action: 'SCAN_COMPLETED',
          resourceType: 'ScanJob',
          resourceId: scan.scanId,
          details: {
            findingsCount: scan.findingsCount,
            duration: new Date(scan.completedAt) - new Date(scan.startedAt),
            results: scan.results
          },
          timestamp: scan.completedAt,
          source: 'demo-seeder',
          ipAddress: '192.168.1.100'
        });
      });

    // Log finding remediation actions
    findings
      .filter(finding => finding.tenantId === company.id && finding.status === 'RESOLVED')
      .forEach(finding => {
        auditLogs.push({
          logId: uuidv4(),
          tenantId: company.id,
          userId: `user-demo-${Math.random().toString(36).substr(2, 9)}`,
          action: 'FINDING_RESOLVED',
          resourceType: 'Finding',
          resourceId: finding.findingId,
          details: {
            severity: finding.severity,
            ruleId: finding.ruleId,
            remediation: finding.remediation
          },
          timestamp: finding.updatedAt,
          source: 'demo-seeder',
          ipAddress: '192.168.1.100'
        });
      });
  });

  return auditLogs;
}

// Main function to generate all demo data
function generateDemoData() {
  console.log('🚀 Generating AI Compliance Shepherd Demo Data...\n');
  
  // Generate company-specific data
  let allScans = [];
  let allFindings = [];
  
  console.log('📊 Generating company profiles...');
  console.log(`   Creating ${demoCompanies.length} demo companies`);
  
  // Generate scan results for each company
  demoCompanies.forEach((company, index) => {
    console.log(`   Processing ${company.name} (${company.tier} tier)...`);
    const { scans, findings } = generateScanResults(company);
    allScans.push(...scans);
    allFindings.push(...findings);
  });
  
  console.log('👥 Generating user accounts...');
  const { users, userSessions } = generateUserAccounts(demoCompanies);
  console.log(`   Created ${users.length} user accounts`);
  console.log(`   Created ${userSessions.length} active sessions`);
  
  console.log('📝 Generating audit logs...');
  const auditLogs = generateAuditLogs(demoCompanies, allScans, allFindings);
  console.log(`   Created ${auditLogs.length} audit log entries`);
  
  // Compile comprehensive demo data
  const demoData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      totalCompanies: demoCompanies.length,
      totalScans: allScans.length,
      totalFindings: allFindings.length,
      totalUsers: users.length,
      totalAuditLogs: auditLogs.length
    },
    companies: demoCompanies.map(company => ({
      ...company,
      // Add scan summary statistics
      scanSummary: {
        totalScans: allScans.filter(s => s.tenantId === company.id).length,
        totalFindings: allFindings.filter(f => f.tenantId === company.id).length,
        criticalFindings: allFindings.filter(f => f.tenantId === company.id && f.severity === 'CRITICAL').length,
        highFindings: allFindings.filter(f => f.tenantId === company.id && f.severity === 'HIGH').length,
        resolutionRate: Math.floor(Math.random() * 40) + 60 // 60-100% resolution rate
      },
      // Add compliance overview
      complianceOverview: {
        frameworks: company.complianceRequirements,
        lastAudit: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
        nextAudit: new Date(Date.now() + Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
        complianceScore: Math.floor(Math.random() * 30) + 70 // 70-100% score
      }
    })),
    scans: allScans,
    findings: allFindings,
    users,
    userSessions,
    auditLogs,
    
    // Add summary statistics
    summary: {
      totalResourcesScanned: allScans.reduce((sum, scan) => sum + scan.results.totalResources, 0),
      totalCriticalFindings: allFindings.filter(f => f.severity === 'CRITICAL').length,
      totalHighFindings: allFindings.filter(f => f.severity === 'HIGH').length,
      totalMediumFindings: allFindings.filter(f => f.severity === 'MEDIUM').length,
      totalLowFindings: allFindings.filter(f => f.severity === 'LOW').length,
      averageScanDuration: Math.floor(
        allScans.reduce((sum, scan) => 
          sum + (new Date(scan.completedAt) - new Date(scan.startedAt)) / 1000, 0
        ) / allScans.length
      ),
      resolutionRate: Math.floor(
        (allFindings.filter(f => f.status === 'RESOLVED').length / allFindings.length) * 100
      ),
      frameworkDistribution: {
        'SOC2': allFindings.filter(f => f.tags.ComplianceFramework === 'SOC2').length,
        'HIPAA': allFindings.filter(f => f.tags.ComplianceFramework === 'HIPAA').length,
        'PCI-DSS': allFindings.filter(f => f.tags.ComplianceFramework === 'PCI-DSS').length,
        'GDPR': allFindings.filter(f => f.tags.ComplianceFramework === 'GDPR').length
      }
    }
  };
  
  return demoData;
}

// Main execution
if (require.main === module) {
  try {
    const demoData = generateDemoData();
    
    // Write demo data to files
    const outputDir = path.join(__dirname, 'demo-data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write comprehensive demo data file
    fs.writeFileSync(
      path.join(outputDir, 'demo-data.json'),
      JSON.stringify(demoData, null, 2)
    );
    
    // Write individual demo files for easier access
    fs.writeFileSync(
      path.join(outputDir, 'companies.json'),
      JSON.stringify(demoData.companies, null, 2)
    );
    
    fs.writeFileSync(
      path.join(outputDir, 'scans.json'),
      JSON.stringify(demoData.scans, null, 2)
    );
    
    fs.writeFileSync(
      path.join(outputDir, 'findings.json'),
      JSON.stringify(demoData.findings, null, 2)
    );
    
    fs.writeFileSync(
      path.join(outputDir, 'users.json'),
      JSON.stringify(demoData.users, null, 2)
    );
    
    // Write summary report
    const summaryReport = `
# AI Compliance Shepherd Demo Data Summary

Generated on: ${demoData.metadata.generatedAt}
Version: ${demoData.metadata.version}

## Demo Companies (${demoData.metadata.totalCompanies})

| Company | Tier | Industry | Scans | Findings | Critical | Compliance Score |
|---------|------|----------|-------|-----------|----------|------------------|
${demoData.companies.map(c => 
  `| ${c.name} | ${c.tier} | ${c.industry} | ${c.scanSummary.totalScans} | ${c.scanSummary.totalFindings} | ${c.scanSummary.criticalFindings} | ${c.complianceOverview.complianceScore}% |`
).join('\n')}

## Compliance Findings Distribution

- **Critical Findings**: ${demoData.summary.totalCriticalFindings}
- **High Findings**: ${demoData.summary.totalHighFindings}
- **Medium Findings**: ${demoData.summary.totalMediumFindings}
- **Low Findings**: ${demoData.summary.totalLowFindings}
- **Total Resources Scanned**: ${demoData.summary.totalResourcesScanned.toLocaleString()}
- **Average Scan Duration**: ${demoData.summary.averageScanDuration} seconds
- **Overall Resolution Rate**: ${demoData.summary.resolutionRate}%

## Framework Coverage

${Object.entries(demoData.summary.frameworkDistribution).map(([framework, count]) => 
  `- **${framework}**: ${count} findings`
).join('\n')}

## Generated Files

- \`demo-data.json\` - Complete demo dataset
- \`companies.json\` - Company profiles and configurations
- \`scans.json\` - Scan job history and results
- \`findings.json\` - Compliance findings with evidence
- \`users.json\` - User accounts and permissions

This demo data provides realistic scenarios for testing and showcasing the AI Compliance Shepherd platform capabilities.
`;
    
    fs.writeFileSync(
      path.join(outputDir, 'README.md'),
      summaryReport
    );
    
    console.log('\n✅ Demo data generation complete!\n');
    console.log('📁 Files created in ./scripts/demo-data/:');
    console.log('   📄 demo-data.json       - Complete demo dataset');
    console.log('   🏢 companies.json       - Demo company profiles');
    console.log('   🔍 scans.json           - Scan job history');
    console.log('   ⚠️  findings.json        - Compliance findings');
    console.log('   👥 users.json           - User accounts');
    console.log('   📋 README.md            - Summary report\n');
    
    console.log('📊 Demo Data Summary:');
    console.log(`   🏢 Companies: ${demoData.metadata.totalCompanies}`);
    console.log(`   🔍 Total Scans: ${demoData.metadata.totalScans}`);
    console.log(`   ⚠️  Total Findings: ${demoData.metadata.totalFindings}`);
    console.log(`   👥 Total Users: ${demoData.metadata.totalUsers}`);
    console.log(`   📝 Total Audit Logs: ${demoData.metadata.totalAuditLogs}`);
    console.log(`   🎯 Average Resolution Rate: ${demoData.summary.resolutionRate}%`);
    
  } catch (error) {
    console.error('❌ Error generating demo data:', error);
    process.exit(1);
  }
}

module.exports = { generateDemoData, demoCompanies, complianceFindings };
