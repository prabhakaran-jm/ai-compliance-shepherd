# HTML Report Generator Lambda Function

A comprehensive HTML report generator for compliance scan results that creates professional, detailed reports with executive summaries, findings analysis, and remediation guidance.

## Overview

The HTML Report Generator Lambda function creates detailed compliance reports from scan results, including:

- **Executive Summaries**: High-level overview for management
- **Detailed Findings**: Comprehensive analysis of compliance issues
- **Technical Reports**: In-depth technical details for engineers
- **Remediation Guidance**: Step-by-step remediation instructions
- **Interactive Charts**: Visual representation of compliance data
- **Multiple Formats**: HTML and PDF output support

## Architecture

```
HTML Report Generator Lambda
├── Report Template Engine
│   ├── Handlebars Templates
│   ├── Dynamic Content Generation
│   └── Chart Integration
├── Report Data Service
│   ├── Scan Data Retrieval
│   ├── Findings Processing
│   └── Historical Data Analysis
├── Report Storage Service
│   ├── S3 Storage Management
│   ├── Metadata Tracking
│   └── Expiration Handling
└── Utilities
    ├── Logger
    ├── Error Handler
    └── Validation Helpers
```

## API Endpoints

### Generate Report
```http
POST /reports
Content-Type: application/json
Authorization: Bearer <token>

{
  "scanId": "scan-123456",
  "reportType": "detailed",
  "format": "html",
  "includeCharts": true,
  "includeRemediation": true,
  "customSections": ["custom-section-1"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reportId": "report-123456",
    "reportUrl": "https://s3.amazonaws.com/bucket/reports/tenant-123/2024-01-01/report-123456.html",
    "reportSize": 245760,
    "generatedAt": "2024-01-01T10:00:00Z",
    "expiresAt": "2024-01-31T10:00:00Z"
  }
}
```

### Get Report
```http
GET /reports/{reportId}
Authorization: Bearer <token>
```

**Response:** HTML content with appropriate headers

### List Reports
```http
GET /reports?limit=10&offset=0&reportType=detailed&scanId=scan-123
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "reportId": "report-123",
        "tenantId": "tenant-123",
        "scanId": "scan-456",
        "reportType": "detailed",
        "format": "html",
        "generatedBy": "user-123",
        "generatedAt": "2024-01-01T10:00:00Z",
        "expiresAt": "2024-01-31T10:00:00Z",
        "size": 245760,
        "s3Key": "reports/tenant-123/2024-01-01/report-123.html",
        "s3Bucket": "compliance-shepherd-reports"
      }
    ],
    "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 25,
      "hasMore": true
    }
  }
}
```

### Delete Report
```http
DELETE /reports/{reportId}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Report deleted successfully"
}
```

## Report Types

### Executive Report
- **Target Audience**: C-level executives, board members
- **Content**: High-level summary, compliance score, key findings
- **Sections**: Executive summary, compliance overview, findings summary
- **Charts**: Compliance score, findings by severity
- **Length**: 2-3 pages

### Detailed Report
- **Target Audience**: Compliance officers, security teams
- **Content**: Comprehensive analysis with detailed findings
- **Sections**: All standard sections plus detailed findings
- **Charts**: All available charts and visualizations
- **Length**: 10-15 pages

### Technical Report
- **Target Audience**: Engineers, technical teams
- **Content**: Technical details, implementation guidance
- **Sections**: All sections plus technical details
- **Charts**: Technical metrics, performance data
- **Length**: 15-20 pages

### Remediation Report
- **Target Audience**: Operations teams, implementers
- **Content**: Focus on remediation steps and guidance
- **Sections**: Executive summary, findings, remediation guidance
- **Charts**: Priority matrix, remediation timeline
- **Length**: 8-12 pages

## Report Sections

### 1. Executive Summary
- Compliance score overview
- Key findings summary
- Risk assessment
- Recommendations

### 2. Compliance Overview
- Framework compliance status
- Resource coverage
- Scan scope and duration
- Overall compliance metrics

### 3. Findings Summary
- Findings by severity
- Findings by service
- Findings by framework
- Findings by region

### 4. Detailed Findings
- Individual finding details
- Evidence and context
- Impact assessment
- Affected resources

### 5. Technical Details
- Scan configuration
- Performance metrics
- Resource discovery details
- Technical implementation notes

### 6. Remediation Guidance
- Step-by-step remediation
- Priority matrix
- Automated vs manual fixes
- Estimated effort and timeline

### 7. Appendices
- Report metadata
- Scan configuration
- Framework requirements
- Glossary of terms

## Template Engine

### Handlebars Templates
The report generator uses Handlebars templates for flexible, dynamic content generation:

```handlebars
<!DOCTYPE html>
<html>
<head>
    <title>Compliance Report - {{scanData.scanId}}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <div class="container">
        <h1>Compliance Report</h1>
        <p>Scan ID: {{scanData.scanId}}</p>
        <p>Compliance Score: {{complianceScore}}%</p>
        
        {{#each sections}}
        <div id="{{id}}">
            <h2>{{title}}</h2>
            {{{content}}}
        </div>
        {{/each}}
    </div>
</body>
</html>
```

### Custom Helpers
- `formatDate`: Format dates for display
- `severityColor`: Get color class for severity levels
- `percentage`: Calculate percentages
- `if_eq`: Conditional rendering

### Dynamic Sections
Sections are generated dynamically based on:
- Report type
- Available data
- User preferences
- Custom requirements

## Data Processing

### Scan Data Integration
- Fetches scan results from DynamoDB
- Processes compliance scores
- Analyzes resource coverage
- Calculates performance metrics

### Findings Processing
- Groups findings by severity, service, framework
- Calculates statistics and trends
- Identifies patterns and correlations
- Generates remediation priorities

### Historical Analysis
- Compares with previous scans
- Tracks compliance trends
- Identifies improvement areas
- Generates progress reports

## Storage Management

### S3 Integration
- Stores reports in organized folder structure
- Implements proper access controls
- Supports multiple formats (HTML, PDF)
- Handles large file sizes efficiently

### Metadata Tracking
- Tracks report generation metadata
- Monitors storage usage
- Manages expiration policies
- Provides audit trails

### Expiration Handling
- Automatic cleanup of expired reports
- Configurable retention policies
- Graceful handling of expired access
- Storage optimization

## Charts and Visualizations

### Compliance Score Chart
- Overall compliance percentage
- Trend over time
- Comparison with benchmarks
- Target vs actual

### Findings Distribution
- Findings by severity (pie chart)
- Findings by service (bar chart)
- Findings by framework (stacked bar)
- Findings by region (map)

### Trend Analysis
- Compliance score over time
- Findings count trends
- Severity distribution changes
- Improvement tracking

### Priority Matrix
- Severity vs impact matrix
- Remediation priority ranking
- Effort vs impact analysis
- Timeline visualization

## Customization

### Custom Sections
Add custom sections to reports:

```json
{
  "customSections": [
    "risk-assessment",
    "compliance-mapping",
    "audit-trail"
  ]
}
```

### Template Customization
- Modify Handlebars templates
- Add custom CSS styling
- Include company branding
- Customize layout and design

### Data Sources
- Integrate additional data sources
- Custom compliance frameworks
- External audit data
- Third-party integrations

## Performance Optimization

### Caching
- Template compilation caching
- Data retrieval caching
- Report generation caching
- CDN integration

### Parallel Processing
- Concurrent section generation
- Parallel data fetching
- Async template rendering
- Background processing

### Memory Management
- Efficient data structures
- Garbage collection optimization
- Memory usage monitoring
- Resource cleanup

## Security

### Access Control
- Tenant isolation
- Role-based permissions
- Report access controls
- Audit logging

### Data Protection
- Encryption at rest
- Encryption in transit
- PII handling
- Data retention policies

### Input Validation
- Request validation
- Data sanitization
- XSS prevention
- Injection protection

## Monitoring and Observability

### Logging
- Structured JSON logging
- Request/response tracking
- Performance metrics
- Error tracking

### Metrics
- Report generation time
- Storage usage
- Error rates
- User activity

### Health Checks
- Service health monitoring
- Dependency checks
- Performance monitoring
- Alerting

## Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1

# S3 Configuration
REPORTS_S3_BUCKET=compliance-shepherd-reports

# Application Configuration
VERSION=1.0.0
ENVIRONMENT=production
LOG_DESTINATION=cloudwatch

# Performance Configuration
MAX_REPORT_SIZE=10485760  # 10MB
REPORT_CACHE_TTL=3600     # 1 hour
CLEANUP_INTERVAL=86400    # 24 hours
```

## Development

### Prerequisites
- Node.js 18+
- TypeScript 5+
- AWS CLI configured
- npm or yarn

### Installation
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

### Local Development
```bash
# Watch mode for development
npm run watch

# Run tests in watch mode
npm run test:watch
```

### Testing
The test suite includes:
- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end workflow testing
- **Mock Testing**: AWS SDK and external service mocking
- **Template Testing**: Handlebars template validation
- **Performance Testing**: Report generation performance

### Deployment
```bash
# Package for deployment
npm run package

# Deploy using AWS CLI or CDK
aws lambda update-function-code \
  --function-name html-report-generator \
  --zip-file fileb://html-report-generator.zip
```

## Troubleshooting

### Common Issues

1. **Template Compilation Errors**
   - Check Handlebars syntax
   - Verify template data structure
   - Validate helper functions

2. **S3 Storage Issues**
   - Verify bucket permissions
   - Check IAM roles
   - Monitor storage limits

3. **Performance Issues**
   - Monitor memory usage
   - Check Lambda timeout
   - Optimize data queries

4. **Report Generation Failures**
   - Check scan data availability
   - Verify findings data
   - Monitor error logs

### Debug Mode
Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

This will provide detailed information about:
- Template compilation
- Data processing
- S3 operations
- Performance metrics

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new functionality
3. Update documentation for API changes
4. Ensure all tests pass before submitting
5. Use conventional commit messages

## License

This project is licensed under the MIT License - see the LICENSE file for details.
