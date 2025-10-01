/**
 * Data Access Layer - Main entry point
 */

// Export table schemas
export * from './tables/TableSchemas';

// Export base repository
export * from './repositories/BaseRepository';

// Export specific repositories
export * from './repositories/FindingsRepository';
export * from './repositories/TenantsRepository';
export * from './repositories/ScanJobsRepository';
export * from './repositories/RemediationJobsRepository';
export * from './repositories/AuditLogsRepository';

// Export utilities
export * from './utils/DynamoDBHelper';
export * from './utils/QueryBuilder';
export * from './utils/ValidationHelper';
