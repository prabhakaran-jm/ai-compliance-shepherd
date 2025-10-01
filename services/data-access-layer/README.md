# Data Access Layer

This package provides a comprehensive data access layer for the AI Compliance Shepherd application, built on top of Amazon DynamoDB.

## Features

- **Type-safe repositories** for all major entities
- **Comprehensive table schemas** with proper indexing
- **Base repository class** with common CRUD operations
- **Query builders** for complex queries
- **Validation helpers** for data integrity
- **Pagination support** for large datasets
- **Batch operations** for efficient data processing
- **Error handling** with proper retry logic

## Table Schemas

### Core Tables

1. **Tenants** - Multi-tenant organization data
2. **Findings** - Compliance findings and violations
3. **Scan Jobs** - Environment scanning operations
4. **Remediation Jobs** - Automated and manual remediation
5. **Audit Logs** - Comprehensive audit trail
6. **Tenant Users** - User management and permissions
7. **Compliance Assessments** - Framework assessments
8. **Integrations** - Third-party service integrations

### Supporting Tables

9. **Usage Metrics** - Billing and usage tracking
10. **Scan Schedules** - Automated scan scheduling
11. **Scan Templates** - Reusable scan configurations
12. **Remediation Templates** - Reusable remediation steps
13. **Auto Remediation Rules** - Automated remediation logic
14. **Marketplace Entitlements** - AWS Marketplace integration
15. **Usage Records** - Detailed usage tracking

## Repository Classes

### BaseRepository

The foundation class that provides common DynamoDB operations:

```typescript
import { BaseRepository } from '@compliance-shepherd/data-access-layer';

class MyRepository extends BaseRepository<MyEntity> {
  constructor() {
    super({
      tableName: 'my-table',
      region: 'us-east-1'
    });
  }
}
```

**Available Methods:**
- `create(item)` - Create new item
- `getById(id, tenantId)` - Get item by ID
- `update(id, tenantId, updates)` - Update item
- `delete(id, tenantId)` - Delete item
- `query(condition, options, pagination)` - Query items
- `scan(options, pagination)` - Scan items
- `batchGet(keys)` - Batch get items
- `batchWrite(items)` - Batch write items
- `count(condition, options)` - Count items
- `exists(id, tenantId)` - Check if item exists

### Specialized Repositories

#### FindingsRepository

```typescript
import { FindingsRepository } from '@compliance-shepherd/data-access-layer';

const findingsRepo = new FindingsRepository();

// Get findings by tenant with filters
const findings = await findingsRepo.getFindingsByTenant('tenant-1', {
  severity: 'high',
  framework: 'SOC2',
  status: 'active'
});

// Get findings by severity
const highSeverityFindings = await findingsRepo.getFindingsBySeverity('high');

// Get findings by framework
const soc2Findings = await findingsRepo.getFindingsByFramework('SOC2');

// Update finding status
await findingsRepo.updateFindingStatus('finding-1', 'tenant-1', 'resolved', 'user-1');

// Suppress finding
await findingsRepo.suppressFinding('finding-1', 'tenant-1', 'False positive', 'user-1');

// Get statistics
const stats = await findingsRepo.getFindingStatistics('tenant-1');
```

#### TenantsRepository

```typescript
import { TenantsRepository } from '@compliance-shepherd/data-access-layer';

const tenantsRepo = new TenantsRepository();

// Get tenant by name
const tenant = await tenantsRepo.getTenantByName('acme-corp');

// Get tenants by status
const activeTenants = await tenantsRepo.getActiveTenants();

// Update tenant status
await tenantsRepo.updateTenantStatus('tenant-1', 'active');

// Update tenant settings
await tenantsRepo.updateTenantSettings('tenant-1', {
  scanSchedule: { enabled: true, frequency: 'daily' }
});
```

#### ScanJobsRepository

```typescript
import { ScanJobsRepository } from '@compliance-shepherd/data-access-layer';

const scanJobsRepo = new ScanJobsRepository();

// Get scan jobs by status
const runningJobs = await scanJobsRepo.getRunningScanJobs();

// Get scan jobs by type
const scheduledJobs = await scanJobsRepo.getScheduledScanJobs();

// Update scan job progress
await scanJobsRepo.updateScanJobProgress('scan-1', 'tenant-1', {
  current: 50,
  total: 100,
  percentage: 50
});
```

#### RemediationJobsRepository

```typescript
import { RemediationJobsRepository } from '@compliance-shepherd/data-access-layer';

const remediationRepo = new RemediationJobsRepository();

// Get remediation jobs by status
const pendingJobs = await remediationRepo.getPendingRemediationJobs();

// Get remediation jobs by type
const automaticJobs = await remediationRepo.getAutomaticRemediationJobs();

// Update remediation job status
await remediationRepo.updateRemediationJobStatus('remediation-1', 'tenant-1', 'completed');
```

#### AuditLogsRepository

```typescript
import { AuditLogsRepository } from '@compliance-shepherd/data-access-layer';

const auditRepo = new AuditLogsRepository();

// Get audit logs by action
const loginLogs = await auditRepo.getAuditLogsByAction('user_login');

// Get audit logs by actor
const userLogs = await auditRepo.getAuditLogsByActor('user-1');

// Get recent audit logs
const recentLogs = await auditRepo.getRecentAuditLogs('tenant-1', 100);
```

## Utility Classes

### DynamoDBHelper

```typescript
import { DynamoDBHelper } from '@compliance-shepherd/data-access-layer';

// Get DynamoDB client instance
const dynamoDB = DynamoDBHelper.getInstance();

// Batch write with retry
await DynamoDBHelper.batchWriteWithRetry('my-table', items);

// Batch get with retry
const items = await DynamoDBHelper.batchGetWithRetry('my-table', keys);

// Scan with pagination
const allItems = await DynamoDBHelper.scanWithPagination('my-table', params);
```

### QueryBuilder

```typescript
import { QueryBuilder } from '@compliance-shepherd/data-access-layer';

const query = new QueryBuilder()
  .keyCondition('tenantId = :tenantId', { ':tenantId': 'tenant-1' })
  .equals('status', 'active')
  .greaterThan('createdAt', '2023-01-01')
  .in('severity', ['high', 'critical'])
  .limit(100)
  .index('GSI-Status');

const params = query.build();
```

### ValidationHelper

```typescript
import { ValidationHelper } from '@compliance-shepherd/data-access-layer';

// Validate required fields
ValidationHelper.validateRequiredFields(data, ['id', 'name', 'email']);

// Validate field types
ValidationHelper.validateFieldTypes(data, {
  id: 'string',
  age: 'number',
  active: 'boolean'
});

// Validate email
ValidationHelper.validateEmail('user@example.com');

// Validate AWS region
ValidationHelper.validateAWSRegion('us-east-1');
```

## Configuration

### Environment Variables

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
DYNAMODB_ENDPOINT=http://localhost:8000  # For local development
```

### Table Configuration

Each table is configured with:

- **Partition Key** - Primary identifier
- **Sort Key** - Secondary identifier (optional)
- **Global Secondary Indexes** - For querying by different attributes
- **Local Secondary Indexes** - For querying within partition
- **TTL** - Automatic item expiration
- **Streams** - Change data capture
- **Point-in-time Recovery** - Backup and restore
- **Encryption** - Data at rest encryption

## Error Handling

The data access layer includes comprehensive error handling:

- **Validation errors** - Invalid input data
- **Conditional check failures** - Item conflicts
- **Throttling** - Rate limiting
- **Network errors** - Connection issues
- **Permission errors** - IAM issues

## Testing

Run tests with:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

## Performance Considerations

### Indexing Strategy

- **Partition Key** - Distributes data evenly
- **Sort Key** - Enables range queries
- **GSI** - Query by different attributes
- **LSI** - Query within partition

### Query Optimization

- Use **Query** instead of **Scan** when possible
- Use **ProjectionExpression** to limit returned attributes
- Use **FilterExpression** to reduce result set
- Use **Limit** to control result size

### Batch Operations

- Use **BatchGetItem** for multiple reads
- Use **BatchWriteItem** for multiple writes
- Handle **UnprocessedItems** with retry logic

## Security

### Data Protection

- **Encryption at rest** - KMS encryption
- **Encryption in transit** - TLS/SSL
- **Access control** - IAM policies
- **Audit logging** - CloudTrail integration

### Input Validation

- **Schema validation** - Zod schemas
- **Type checking** - TypeScript
- **Sanitization** - Input cleaning
- **Rate limiting** - Request throttling

## Monitoring

### CloudWatch Metrics

- **Consumed capacity** - Read/write units
- **Throttled requests** - Rate limiting
- **Error rates** - Failed operations
- **Latency** - Response times

### Logging

- **Structured logging** - JSON format
- **Error tracking** - Exception details
- **Performance metrics** - Operation timing
- **Audit trail** - User actions

## Best Practices

1. **Use appropriate data types** - String, Number, Binary
2. **Design for access patterns** - Query requirements
3. **Minimize item size** - Store references, not data
4. **Use batch operations** - Reduce API calls
5. **Implement pagination** - Handle large datasets
6. **Monitor performance** - Track metrics
7. **Handle errors gracefully** - Retry logic
8. **Validate input data** - Prevent bad data
9. **Use consistent naming** - Table and attribute names
10. **Document access patterns** - Query requirements

## Migration

### Schema Changes

1. **Add new attributes** - Backward compatible
2. **Remove attributes** - Deprecate first
3. **Change data types** - Migration required
4. **Add indexes** - Online operation
5. **Remove indexes** - Offline operation

### Data Migration

1. **Export data** - DynamoDB export
2. **Transform data** - ETL process
3. **Import data** - DynamoDB import
4. **Validate data** - Quality checks
5. **Update application** - Code changes

## Troubleshooting

### Common Issues

1. **Throttling** - Increase capacity or add retry logic
2. **Hot partitions** - Redistribute data
3. **Large items** - Split into multiple items
4. **Slow queries** - Optimize indexes
5. **High costs** - Monitor capacity usage

### Debugging

1. **Enable logging** - CloudWatch Logs
2. **Monitor metrics** - CloudWatch Metrics
3. **Use X-Ray** - Request tracing
4. **Check IAM** - Permission issues
5. **Validate data** - Input/output

## Contributing

1. Follow TypeScript best practices
2. Add comprehensive tests
3. Update documentation
4. Use consistent naming
5. Handle errors properly
6. Optimize for performance
7. Consider security implications
8. Test with real data
9. Monitor in production
10. Document changes
