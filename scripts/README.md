# Scripts - AI Compliance Shepherd

This directory contains automation scripts for demo data generation, test scenarios, performance benchmarks, and environment deployment.

## 📁 Scripts Overview

### 🎮 Demo and Testing Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| **seed-demo-data.js** | Generate comprehensive demo data | `npm run demo:data` |
| **deploy-demo-environment.js** | Deploy complete demo environment | `npm run demo:deploy` |
| **test-scenarios.js** | Generate test scenarios and validation cases | `npm run demo:scenarios` |
| **performance-benchmarks.js** | Create performance benchmarks and SLAs | `npm run demo:benchmarks` |

## 🚀 Quick Start

### Generate All Demo Assets
```bash
# Generate demo data, scenarios, and benchmarks in one command
npm run demo:generate-all
```

### Individual Script Execution
```bash
# Generate demo data for 5 companies with realistic compliance findings
npm run demo:data

# Create comprehensive test scenarios
npm run demo:scenarios

# Generate performance benchmarks and SLAs
npm run demo:benchmarks

# Deploy complete demo environment (requires AWS credentials)
npm run demo:deploy
```

## 📊 Demo Data Generation (seed-demo-data.js)

### What It Creates
- **5 Demo Companies** with realistic profiles (ACME Corp, Healthcare Plus, StartupXL, Education Platform, Retail Chain)
- **250+ Compliance Scans** with historical trends and realistic durations
- **2,500+ Compliance Findings** across CRITICAL, HIGH, MEDIUM, and LOW severities
- **50+ User Accounts** with role-based permissions and sessions
- **1,000+ Audit Log Entries** tracking all actions and events

### Demo Company Profiles
```
🏢 ACME Corporation (PREMIUM) - FinTech with PCI-DSS requirements
🏥 Healthcare Plus (ENTERPRISE) - Healthcare with HIPAA compliance
🚀 StartupXL (STANDARD) - SaaS startup focusing on SOC 2
🎓 Education Platform (BASIC) - EdTech with basic requirements
🏪 Retail Chain Corp (PREMIUM) - Retail with GDPR compliance
```

### Generated Output Files
```
📄 demo-data/demo-data.json       - Complete comprehensive dataset
🏢 demo-data/companies.json       - Company profiles and analytics
🔍 demo-data/scans.json           - Historical scan results
⚠️ demo-data/findings.json        - Compliance findings with evidence
👥 demo-data/users.json           - User accounts and permissions
📋 demo-data/README.md            - Summary report with metrics
```

### Key Features
- **Realistic Resource Data**: S3 buckets, IAM users, EC2 instances with actual configurations
- **Compliance Framework Coverage**: SOC 2, HIPAA, PCI-DSS, GDPR mappings
- **Severity Distribution**: Industry-realistic 10% critical, 20% high, 40% medium, 30% low
- **Tenant Isolation**: Complete multi-tenant data segregation
- **Historical Trends**: 5+ scans per company showing improvement over time
- **Resolution Tracking**: 60-100% resolution rates showing platform effectiveness

## 🎯 Test Scenarios (test-scenarios.js)

### Test Categories Generated
- **Functional Tests** (3 scenarios) - Core workflow validation
- **Performance Tests** (2 scenarios) - Load and scalability validation
- **Security Tests** (3 scenarios) - Data security and isolation
- **Integration Tests** (3 scenarios) - Third-party service integration
- **Resilience Tests** (2 scenarios) - Failure handling and recovery
- **Business Logic Tests** (3 scenarios) - Compliance framework validation

### Key Test Scenarios
1. **Complete Compliance Scan Workflow** - End-to-end scan validation
2. **AI Chat Interaction Workflow** - Natural language AI testing
3. **Automated Security Remediation** - Safe remediation with approval
4. **Multi-Tenant Data Isolation** - Security isolation validation
5. **GitHub Webhook Integration** - Infrastructure as Code compliance
6. **Compliance Framework Validation** - SOC 2, HIPAA, PCI-DSS mapping

### Test Scenario Features
- **Detailed Execution Steps** with prerequisites and acceptance criteria
- **Performance Targets** with specific SLA requirements
- **Risk Assessment** with priority classification (CRITICAL, HIGH, MEDIUM)
- **Test Data Configuration** with realistic input parameters
- **Success Metrics** with quantifiable acceptance criteria

## 🏃 Performance Benchmarks (performance-benchmarks.js)

### Performance Categories
- **API Performance** - Response times and throughput for all endpoints
- **Database Performance** - DynamoDB read/write performance benchmarks
- **Storage Performance** - S3 operation latency and throughput
- **Scan Performance** - AWS resource discovery and rule evaluation speed
- **Concurrent Load** - Multi-tenant and high-load performance validation
- **AI/Ml Performance** - Bedrock Agent response times and accuracy

### Key Performance Targets
```
⚡ API Gateway Response: <5s (95th percentile)
⚡ Lambda Cold Start: <2s
⚡ DynamoDB Queries: <50ms average
⚡ Complete Compliance Scan: <10min
⚡ AI Response Time: <30s (complex queries)
⚡ Concurrent Users: 1000+ (without degradation)
⚡ Throughput: 500+ RPS sustained
```

### Benchmark Features
- **Realistic Load Profiles** with actual usage patterns
- **SLA Validation** with specific performance thresholds
- **Resource Utilization** monitoring CPU, memory, and capacity
- **Scalability Metrics** for enterprise-level growth
- **Cost Efficiency** optimization recommendations

## 🚀 Demo Environment Deployment (deploy-demo-environment.js)

### Deployment Components
- **Infrastructure Setup** via AWS CDK with proper configurations
- **Demo Data Seeding** into DynamoDB and S3 with realistic datasets
- **UI Configuration** for demo-specific branding and features
- **Test Scenarios** setup for user walkthroughs
- **Documentation Generation** with complete user guides

### Demo Environment Features
- **Multi-Tenant Configuration** with proper isolation and security
- **Realistic Company Profiles** with industry-specific compliance requirements
- **Interactive Scenarios** for hands-on exploration
- **Performance Validation** with automated benchmarking
- **User Account Management** with role-based access controls

### Deployment Options
```bash
# Full demo environment deployment
node scripts/deploy-demo-environment.js

# Infrastructure deployment only
node scripts/deploy-demo-environment.js --infra-only

# Demo data generation only
node scripts/deploy-demo-environment.js --data-only

# Documentation generation only
node scripts/deploy-demo-environment.js --guide-only
```

## 📁 Generated Output Structure

```
scripts/
├── README.md                         # This documentation
├── seed-demo-data.js                 # Demo data generation
├── deploy-demo-environment.js        # Demo deployment
├── test-scenarios.js                 # Test scenario creation
├── performance-benchmarks.js         # Performance benchmarking
├── demo-data/                        # Generated demo data
│   ├── demo-data.json               # Complete dataset
│   ├── companies.json               # Company profiles
│   ├── scans.json                   # Historical scans
│   ├── findings.json                # Compliance findings
│   ├── users.json                   # User accounts
│   ├── ui-config.json               # UI configuration
│   ├── demo-scenarios.json          # Interactive scenarios
│   └── DEMO_GUIDE.md                # User guide
├── scenarios/                        # Generated test scenarios
│   ├── functional-tests.json        # Core functionality tests
│   ├── performance-tests.json      # Performance validation
│   ├── security-tests.json         # Security validation
│   ├── integration-tests.json      # Third-party integrations
│   ├── resilience-tests.json       # Failure handling
│   ├── business-tests.json          # Business logic validation
│   └── TEST_SCENARIOS_GUIDE.md     # Test documentation
└── benchmarks/                       # Performance benchmarks
    ├── api-performance.json         # API performance tests
    ├── database-performance.json    # Database benchmarks
    ├── scan-performance.json        # Scanning benchmarks
    ├── concurrent-load.json         # Load testing
    ├── ai-performance.json         # AI/ML performance
    └── PERFORMANCE_GUIDE.md         # Performance documentation
```

## 🎮 Demo Usage Workflow

### For Sales Demos
1. Run `npm run demo:generate-all` to create fresh demo assets
2. Deploy demo environment with `npm run demo:deploy`
3. Use generated DEMO_GUIDE.md for walkthrough scenarios
4. Reference demo-scenarios.json for interactive demos
5. Show performance-benchmarks.json for enterprise scalability

### For Testing Documentation
1. Generate test scenarios with `npm run demo:scenarios`
2. Use TEST_SCENARIOS_GUIDE.md for comprehensive test planning
3. Reference individual test scenario files in testing/ directories
4. Validate performance targets with benchmarks output

### For Development Validation
1. Generate realistic demo data for development testing
2. Use test scenarios for automated validation
3. Reference performance benchmarks for optimization targets
4. Validate multi-tenant isolation with generated data

## 🔧 Customization Options

### Demo Data Customization
- Modify `demoCompanies` array in `seed-demo-data.js` for different industries
- Adjust `complianceFindings` templates for different compliance frameworks
- Customize user accounts and permissions in demo generation
- Modify tenant tiers and capabilities for different sales scenarios

### Performance Target Updates
- Update performance targets in `performance-benchmarks.js`
- Modify SLA requirements based on enterprise customer needs
- Adjust concurrency limits and throughput targets
- Customize benchmark categories for specific use cases

### Test Scenario Modifications
- Add new test categories to `test-scenarios.js`
- Customize acceptance criteria for specific compliance requirements
- Modify test data requirements for different environments
- Add industry-specific validation scenarios

## ✅ Quality Assurance

### Script Validation
- All scripts include comprehensive error handling
- Input validation and sanitization implemented
- Output validation ensures data integrity
- Performance optimized for large dataset generation

### Data Quality
- Generated data follows realistic patterns and distributions
- Compliance findings map to actual AWS configurations
- Test scenarios provide actionable validation steps
- Performance benchmarks align with enterprise requirements

### Output Completeness
- All demo assets include comprehensive documentation
- Generated files provide immediate utility for demos and testing
- Performance targets are industry-standard and achievable
- Test scenarios cover all critical platform functionality

---

**Scripts Purpose**: Comprehensive demo and testing automation for enterprise sales, development validation, and quality assurance
**Quality Target**: Production-ready demo assets that showcase full platform capabilities
**Validation Level**: Full coverage of critical functionality with realistic data and scenarios
