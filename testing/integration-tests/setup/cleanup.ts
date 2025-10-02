/**
 * Test cleanup utilities for integration tests
 * 
 * This module provides utilities to clean up test data and resources
 * after integration tests to prevent interference between test runs.
 */

import { dynamoDBClient, s3Client } from './localstack';
import { ScanCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { unmarshall } from '@aws-sdk/util-dynamodb';

/**
 * Clean up all test data
 */
export async function cleanupTestData(): Promise<void> {
  console.log('🧹 Cleaning up test data...');
  
  try {
    // Clean up DynamoDB test data
    await cleanupDynamoDBData();
    
    // Clean up S3 test data
    await cleanupS3Data();
    
    console.log('✅ Test data cleanup complete');
  } catch (error) {
    console.warn('⚠️ Warning: Test data cleanup failed:', error);
    // Don't throw error as cleanup failures shouldn't fail tests
  }
}

/**
 * Clean up DynamoDB test data
 */
async function cleanupDynamoDBData(): Promise<void> {
  console.log('📊 Cleaning up DynamoDB test data...');
  
  const tables = [
    'ai-compliance-tenants-test',
    'ai-compliance-findings-test',
    'ai-compliance-scan-jobs-test',
    'ai-compliance-remediation-jobs-test',
    'ai-compliance-audit-logs-test',
    'ai-compliance-user-sessions-test',
    'ai-compliance-chat-sessions-test',
    'ai-compliance-rules-test',
    'ai-compliance-frameworks-test'
  ];
  
  for (const tableName of tables) {
    try {
      // Scan table to get all items
      const scanResult = await dynamoDBClient.send(new ScanCommand({
        TableName: tableName,
        ProjectionExpression: '#pk, #sk',
        ExpressionAttributeNames: {
          '#pk': getPartitionKey(tableName),
          '#sk': getSortKey(tableName)
        }
      }));
      
      if (scanResult.Items && scanResult.Items.length > 0) {
        // Delete items in batches
        const deletePromises = scanResult.Items.map(item => {
          const key = getSortKey(tableName) 
            ? { [getPartitionKey(tableName)]: item[getPartitionKey(tableName)], [getSortKey(tableName)]: item[getSortKey(tableName)] }
            : { [getPartitionKey(tableName)]: item[getPartitionKey(tableName)] };
          
          return dynamoDBClient.send(new DeleteItemCommand({
            TableName: tableName,
            Key: key
          }));
        });
        
        await Promise.all(deletePromises);
        console.log(`✅ Cleaned up ${scanResult.Items.length} items from ${tableName}`);
      }
    } catch (error) {
      console.warn(`⚠️ Warning: Failed to cleanup table ${tableName}:`, error);
    }
  }
}

/**
 * Clean up S3 test data
 */
async function cleanupS3Data(): Promise<void> {
  console.log('🪣 Cleaning up S3 test data...');
  
  const buckets = [
    'ai-compliance-test-reports',
    'ai-compliance-test-artifacts',
    'ai-compliance-test-audit-packs',
    'ai-compliance-test-terraform-plans'
  ];
  
  for (const bucketName of buckets) {
    try {
      // List all objects in bucket
      const listResult = await s3Client.send(new ListObjectsV2Command({
        Bucket: bucketName
      }));
      
      if (listResult.Contents && listResult.Contents.length > 0) {
        // Delete objects in batches
        const deletePromises = listResult.Contents.map(object => 
          s3Client.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: object.Key!
          }))
        );
        
        await Promise.all(deletePromises);
        console.log(`✅ Cleaned up ${listResult.Contents.length} objects from ${bucketName}`);
      }
    } catch (error) {
      console.warn(`⚠️ Warning: Failed to cleanup bucket ${bucketName}:`, error);
    }
  }
}

/**
 * Clean up test data for specific tenant
 */
export async function cleanupTenantData(tenantId: string): Promise<void> {
  console.log(`🧹 Cleaning up data for tenant: ${tenantId}...`);
  
  try {
    // Clean up tenant-specific data from DynamoDB
    const tenantTables = [
      'ai-compliance-findings-test',
      'ai-compliance-scan-jobs-test',
      'ai-compliance-remediation-jobs-test',
      'ai-compliance-audit-logs-test',
      'ai-compliance-user-sessions-test',
      'ai-compliance-chat-sessions-test'
    ];
    
    for (const tableName of tenantTables) {
      try {
        // Query items for this tenant
        const queryResult = await dynamoDBClient.send(new QueryCommand({
          TableName: tableName,
          IndexName: 'TenantIndex',
          KeyConditionExpression: 'tenantId = :tenantId',
          ExpressionAttributeValues: {
            ':tenantId': { S: tenantId }
          }
        }));
        
        if (queryResult.Items && queryResult.Items.length > 0) {
          // Delete tenant items
          const deletePromises = queryResult.Items.map(item => {
            const unmarshalled = unmarshall(item);
            const key = getSortKey(tableName)
              ? { [getPartitionKey(tableName)]: item[getPartitionKey(tableName)], [getSortKey(tableName)]: item[getSortKey(tableName)] }
              : { [getPartitionKey(tableName)]: item[getPartitionKey(tableName)] };
            
            return dynamoDBClient.send(new DeleteItemCommand({
              TableName: tableName,
              Key: key
            }));
          });
          
          await Promise.all(deletePromises);
          console.log(`✅ Cleaned up ${queryResult.Items.length} items for tenant ${tenantId} from ${tableName}`);
        }
      } catch (error) {
        console.warn(`⚠️ Warning: Failed to cleanup tenant data from ${tableName}:`, error);
      }
    }
    
    // Clean up tenant-specific S3 objects
    const buckets = [
      'ai-compliance-test-reports',
      'ai-compliance-test-artifacts',
      'ai-compliance-test-audit-packs'
    ];
    
    for (const bucketName of buckets) {
      try {
        const listResult = await s3Client.send(new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: `${tenantId}/`
        }));
        
        if (listResult.Contents && listResult.Contents.length > 0) {
          const deletePromises = listResult.Contents.map(object =>
            s3Client.send(new DeleteObjectCommand({
              Bucket: bucketName,
              Key: object.Key!
            }))
          );
          
          await Promise.all(deletePromises);
          console.log(`✅ Cleaned up ${listResult.Contents.length} objects for tenant ${tenantId} from ${bucketName}`);
        }
      } catch (error) {
        console.warn(`⚠️ Warning: Failed to cleanup tenant S3 data from ${bucketName}:`, error);
      }
    }
    
    console.log(`✅ Tenant data cleanup complete for: ${tenantId}`);
  } catch (error) {
    console.warn(`⚠️ Warning: Tenant data cleanup failed for ${tenantId}:`, error);
  }
}

/**
 * Clean up test data older than specified hours
 */
export async function cleanupOldTestData(olderThanHours: number = 24): Promise<void> {
  console.log(`🧹 Cleaning up test data older than ${olderThanHours} hours...`);
  
  const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
  
  try {
    // Clean up old scan jobs
    const scanJobsResult = await dynamoDBClient.send(new ScanCommand({
      TableName: 'ai-compliance-scan-jobs-test',
      FilterExpression: 'createdAt < :cutoff',
      ExpressionAttributeValues: {
        ':cutoff': { S: cutoffTime.toISOString() }
      }
    }));
    
    if (scanJobsResult.Items && scanJobsResult.Items.length > 0) {
      const deletePromises = scanJobsResult.Items.map(item =>
        dynamoDBClient.send(new DeleteItemCommand({
          TableName: 'ai-compliance-scan-jobs-test',
          Key: { scanId: item.scanId }
        }))
      );
      
      await Promise.all(deletePromises);
      console.log(`✅ Cleaned up ${scanJobsResult.Items.length} old scan jobs`);
    }
    
    // Clean up old chat sessions
    const chatSessionsResult = await dynamoDBClient.send(new ScanCommand({
      TableName: 'ai-compliance-chat-sessions-test',
      FilterExpression: 'createdAt < :cutoff',
      ExpressionAttributeValues: {
        ':cutoff': { S: cutoffTime.toISOString() }
      }
    }));
    
    if (chatSessionsResult.Items && chatSessionsResult.Items.length > 0) {
      const deletePromises = chatSessionsResult.Items.map(item =>
        dynamoDBClient.send(new DeleteItemCommand({
          TableName: 'ai-compliance-chat-sessions-test',
          Key: { sessionId: item.sessionId }
        }))
      );
      
      await Promise.all(deletePromises);
      console.log(`✅ Cleaned up ${chatSessionsResult.Items.length} old chat sessions`);
    }
    
    console.log('✅ Old test data cleanup complete');
  } catch (error) {
    console.warn('⚠️ Warning: Old test data cleanup failed:', error);
  }
}

/**
 * Get partition key for table
 */
function getPartitionKey(tableName: string): string {
  const keyMap: Record<string, string> = {
    'ai-compliance-tenants-test': 'tenantId',
    'ai-compliance-findings-test': 'findingId',
    'ai-compliance-scan-jobs-test': 'scanId',
    'ai-compliance-remediation-jobs-test': 'remediationId',
    'ai-compliance-audit-logs-test': 'logId',
    'ai-compliance-user-sessions-test': 'sessionId',
    'ai-compliance-chat-sessions-test': 'sessionId',
    'ai-compliance-rules-test': 'ruleId',
    'ai-compliance-frameworks-test': 'frameworkId'
  };
  
  return keyMap[tableName] || 'id';
}

/**
 * Get sort key for table (if exists)
 */
function getSortKey(tableName: string): string | null {
  const keyMap: Record<string, string | null> = {
    'ai-compliance-tenants-test': null,
    'ai-compliance-findings-test': null,
    'ai-compliance-scan-jobs-test': null,
    'ai-compliance-remediation-jobs-test': null,
    'ai-compliance-audit-logs-test': null,
    'ai-compliance-user-sessions-test': null,
    'ai-compliance-chat-sessions-test': null,
    'ai-compliance-rules-test': null,
    'ai-compliance-frameworks-test': null
  };
  
  return keyMap[tableName] || null;
}

/**
 * Reset test environment to clean state
 */
export async function resetTestEnvironment(): Promise<void> {
  console.log('🔄 Resetting test environment...');
  
  try {
    // Clean up all test data
    await cleanupTestData();
    
    // Wait a moment for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Re-setup test environment
    const { setupTestEnvironment } = await import('./test-environment');
    await setupTestEnvironment();
    
    console.log('✅ Test environment reset complete');
  } catch (error) {
    console.error('❌ Failed to reset test environment:', error);
    throw error;
  }
}
