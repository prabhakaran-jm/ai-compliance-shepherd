/**
 * LocalStack setup and management for integration tests
 * 
 * This module handles the setup, configuration, and management of LocalStack
 * services required for integration testing.
 */

import { DynamoDBClient, CreateTableCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, CreateBucketCommand, ListBucketsCommand } from '@aws-sdk/client-s3';
import { LambdaClient, ListFunctionsCommand } from '@aws-sdk/client-lambda';
import { CloudWatchClient, ListMetricsCommand } from '@aws-sdk/client-cloudwatch';

// LocalStack configuration
const LOCALSTACK_ENDPOINT = process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// AWS clients configured for LocalStack
const dynamoDBClient = new DynamoDBClient({
  endpoint: LOCALSTACK_ENDPOINT,
  region: AWS_REGION,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test'
  }
});

const s3Client = new S3Client({
  endpoint: LOCALSTACK_ENDPOINT,
  region: AWS_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test'
  }
});

const lambdaClient = new LambdaClient({
  endpoint: LOCALSTACK_ENDPOINT,
  region: AWS_REGION,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test'
  }
});

const cloudWatchClient = new CloudWatchClient({
  endpoint: LOCALSTACK_ENDPOINT,
  region: AWS_REGION,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test'
  }
});

/**
 * Check if LocalStack is running and accessible
 */
export async function checkLocalStackHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${LOCALSTACK_ENDPOINT}/health`);
    if (!response.ok) {
      return false;
    }
    
    const health = await response.json();
    console.log('LocalStack health status:', health);
    
    // Check if required services are running
    const requiredServices = ['dynamodb', 's3', 'lambda', 'cloudwatch', 'events', 'stepfunctions'];
    const runningServices = Object.keys(health.services || {});
    
    for (const service of requiredServices) {
      if (!runningServices.includes(service)) {
        console.warn(`Required service ${service} is not running in LocalStack`);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Failed to check LocalStack health:', error);
    return false;
  }
}

/**
 * Wait for LocalStack to be ready
 */
export async function waitForLocalStack(timeout: number = 60000): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await checkLocalStackHealth()) {
      console.log('✅ LocalStack is ready');
      return;
    }
    
    console.log('⏳ Waiting for LocalStack to be ready...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
  }
  
  throw new Error(`LocalStack not ready within ${timeout}ms timeout`);
}

/**
 * Create DynamoDB tables required for integration tests
 */
export async function createDynamoDBTables(): Promise<void> {
  console.log('📊 Creating DynamoDB tables...');
  
  const tables = [
    {
      TableName: 'ai-compliance-tenants-test',
      KeySchema: [
        { AttributeName: 'tenantId', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'tenantId', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    },
    {
      TableName: 'ai-compliance-findings-test',
      KeySchema: [
        { AttributeName: 'findingId', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'findingId', AttributeType: 'S' },
        { AttributeName: 'tenantId', AttributeType: 'S' },
        { AttributeName: 'scanId', AttributeType: 'S' },
        { AttributeName: 'severity', AttributeType: 'S' },
        { AttributeName: 'status', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'TenantIndex',
          KeySchema: [
            { AttributeName: 'tenantId', KeyType: 'HASH' },
            { AttributeName: 'scanId', KeyType: 'RANGE' }
          ],
          Projection: { ProjectionType: 'ALL' }
        },
        {
          IndexName: 'SeverityIndex',
          KeySchema: [
            { AttributeName: 'tenantId', KeyType: 'HASH' },
            { AttributeName: 'severity', KeyType: 'RANGE' }
          ],
          Projection: { ProjectionType: 'ALL' }
        },
        {
          IndexName: 'StatusIndex',
          KeySchema: [
            { AttributeName: 'tenantId', KeyType: 'HASH' },
            { AttributeName: 'status', KeyType: 'RANGE' }
          ],
          Projection: { ProjectionType: 'ALL' }
        }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    },
    {
      TableName: 'ai-compliance-scan-jobs-test',
      KeySchema: [
        { AttributeName: 'scanId', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'scanId', AttributeType: 'S' },
        { AttributeName: 'tenantId', AttributeType: 'S' },
        { AttributeName: 'status', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'TenantIndex',
          KeySchema: [
            { AttributeName: 'tenantId', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' }
        },
        {
          IndexName: 'StatusIndex',
          KeySchema: [
            { AttributeName: 'tenantId', KeyType: 'HASH' },
            { AttributeName: 'status', KeyType: 'RANGE' }
          ],
          Projection: { ProjectionType: 'ALL' }
        }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    },
    {
      TableName: 'ai-compliance-remediation-jobs-test',
      KeySchema: [
        { AttributeName: 'remediationId', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'remediationId', AttributeType: 'S' },
        { AttributeName: 'tenantId', AttributeType: 'S' },
        { AttributeName: 'findingId', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'TenantIndex',
          KeySchema: [
            { AttributeName: 'tenantId', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' }
        },
        {
          IndexName: 'FindingIndex',
          KeySchema: [
            { AttributeName: 'findingId', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' }
        }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    },
    {
      TableName: 'ai-compliance-audit-logs-test',
      KeySchema: [
        { AttributeName: 'logId', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'logId', AttributeType: 'S' },
        { AttributeName: 'tenantId', AttributeType: 'S' },
        { AttributeName: 'timestamp', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'TenantTimeIndex',
          KeySchema: [
            { AttributeName: 'tenantId', KeyType: 'HASH' },
            { AttributeName: 'timestamp', KeyType: 'RANGE' }
          ],
          Projection: { ProjectionType: 'ALL' }
        }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    }
  ];
  
  // Check existing tables
  const existingTables = await dynamoDBClient.send(new ListTablesCommand({}));
  const existingTableNames = existingTables.TableNames || [];
  
  // Create tables that don't exist
  for (const table of tables) {
    if (!existingTableNames.includes(table.TableName)) {
      try {
        await dynamoDBClient.send(new CreateTableCommand(table));
        console.log(`✅ Created table: ${table.TableName}`);
      } catch (error) {
        console.error(`❌ Failed to create table ${table.TableName}:`, error);
        throw error;
      }
    } else {
      console.log(`⏭️ Table already exists: ${table.TableName}`);
    }
  }
  
  // Wait for tables to be active
  console.log('⏳ Waiting for tables to be active...');
  await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
}

/**
 * Create S3 buckets required for integration tests
 */
export async function createS3Buckets(): Promise<void> {
  console.log('🪣 Creating S3 buckets...');
  
  const buckets = [
    'ai-compliance-test-reports',
    'ai-compliance-test-artifacts',
    'ai-compliance-test-audit-packs',
    'ai-compliance-test-terraform-plans'
  ];
  
  // Check existing buckets
  const existingBuckets = await s3Client.send(new ListBucketsCommand({}));
  const existingBucketNames = existingBuckets.Buckets?.map(b => b.Name) || [];
  
  // Create buckets that don't exist
  for (const bucketName of buckets) {
    if (!existingBucketNames.includes(bucketName)) {
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
        console.log(`✅ Created bucket: ${bucketName}`);
      } catch (error) {
        console.error(`❌ Failed to create bucket ${bucketName}:`, error);
        throw error;
      }
    } else {
      console.log(`⏭️ Bucket already exists: ${bucketName}`);
    }
  }
}

/**
 * Verify AWS service connectivity
 */
export async function verifyAWSServices(): Promise<void> {
  console.log('🔍 Verifying AWS service connectivity...');
  
  try {
    // Test DynamoDB
    await dynamoDBClient.send(new ListTablesCommand({}));
    console.log('✅ DynamoDB connectivity verified');
    
    // Test S3
    await s3Client.send(new ListBucketsCommand({}));
    console.log('✅ S3 connectivity verified');
    
    // Test Lambda
    await lambdaClient.send(new ListFunctionsCommand({}));
    console.log('✅ Lambda connectivity verified');
    
    // Test CloudWatch
    await cloudWatchClient.send(new ListMetricsCommand({}));
    console.log('✅ CloudWatch connectivity verified');
    
  } catch (error) {
    console.error('❌ AWS service connectivity failed:', error);
    throw error;
  }
}

/**
 * Clean up LocalStack resources
 */
export async function cleanupLocalStackResources(): Promise<void> {
  console.log('🧹 Cleaning up LocalStack resources...');
  
  try {
    // Note: In LocalStack, we typically don't need to clean up between tests
    // as each test should use unique identifiers. However, we can implement
    // cleanup logic here if needed.
    
    console.log('✅ LocalStack cleanup complete');
  } catch (error) {
    console.warn('⚠️ Warning: LocalStack cleanup failed:', error);
  }
}

/**
 * Main LocalStack setup function
 */
export async function setupLocalStack(): Promise<void> {
  console.log('🐳 Setting up LocalStack for integration tests...');
  
  try {
    // Wait for LocalStack to be ready
    await waitForLocalStack();
    
    // Verify AWS service connectivity
    await verifyAWSServices();
    
    // Create required DynamoDB tables
    await createDynamoDBTables();
    
    // Create required S3 buckets
    await createS3Buckets();
    
    console.log('✅ LocalStack setup complete');
  } catch (error) {
    console.error('❌ LocalStack setup failed:', error);
    throw error;
  }
}

// Export AWS clients for use in tests
export {
  dynamoDBClient,
  s3Client,
  lambdaClient,
  cloudWatchClient
};
