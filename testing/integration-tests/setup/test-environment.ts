/**
 * Test environment setup for integration tests
 * 
 * This module handles the setup of the complete test environment,
 * including test data, configurations, and service initialization.
 */

import { dynamoDBClient, s3Client } from './localstack';
import { PutItemCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { marshall } from '@aws-sdk/util-dynamodb';

/**
 * Setup complete test environment
 */
export async function setupTestEnvironment(): Promise<void> {
  console.log('🛠️ Setting up integration test environment...');
  
  try {
    // Setup test data
    await setupTestData();
    
    // Setup test configurations
    await setupTestConfigurations();
    
    console.log('✅ Integration test environment setup complete');
  } catch (error) {
    console.error('❌ Failed to setup test environment:', error);
    throw error;
  }
}

/**
 * Setup test data in DynamoDB and S3
 */
async function setupTestData(): Promise<void> {
  console.log('📊 Setting up test data...');
  
  // Create sample compliance rules
  const sampleRules = [
    {
      ruleId: 'S3_BUCKET_PUBLIC_READ_PROHIBITED',
      ruleName: 'S3 Bucket Public Read Prohibited',
      description: 'S3 buckets should not allow public read access',
      severity: 'HIGH',
      category: 'Security',
      service: 's3',
      resourceType: 'S3Bucket',
      enabled: true,
      remediationAvailable: true
    },
    {
      ruleId: 'IAM_USER_MFA_ENABLED',
      ruleName: 'IAM User MFA Enabled',
      description: 'IAM users should have MFA enabled',
      severity: 'MEDIUM',
      category: 'Access Control',
      service: 'iam',
      resourceType: 'IAMUser',
      enabled: true,
      remediationAvailable: false
    }
  ];
  
  // Store rules in DynamoDB
  for (const rule of sampleRules) {
    await dynamoDBClient.send(new PutItemCommand({
      TableName: 'ai-compliance-rules-test',
      Item: marshall(rule)
    }));
  }
  
  // Create sample AWS resources data in S3
  const sampleAWSResources = {
    s3Buckets: [
      {
        name: 'test-public-bucket-integration',
        region: 'us-east-1',
        publicReadAccess: true,
        publicWriteAccess: false,
        encryption: false,
        versioning: false,
        tags: {
          Environment: 'test',
          Team: 'security'
        }
      },
      {
        name: 'test-private-bucket-integration',
        region: 'us-east-1',
        publicReadAccess: false,
        publicWriteAccess: false,
        encryption: true,
        versioning: true,
        tags: {
          Environment: 'production',
          Team: 'engineering'
        }
      }
    ],
    iamUsers: [
      {
        userName: 'test-user-no-mfa',
        mfaEnabled: false,
        accessKeys: 2,
        lastActivity: new Date(Date.now() - 86400000).toISOString(),
        policies: ['ReadOnlyAccess']
      },
      {
        userName: 'test-user-with-mfa',
        mfaEnabled: true,
        accessKeys: 1,
        lastActivity: new Date(Date.now() - 3600000).toISOString(),
        policies: ['PowerUserAccess']
      }
    ],
    ec2Instances: [
      {
        instanceId: 'i-1234567890abcdef0',
        instanceType: 't3.micro',
        state: 'running',
        securityGroups: ['sg-12345678'],
        publicIp: '203.0.113.1',
        privateIp: '10.0.1.100',
        tags: {
          Name: 'test-instance',
          Environment: 'test'
        }
      }
    ]
  };
  
  await s3Client.send(new PutObjectCommand({
    Bucket: 'ai-compliance-test-artifacts',
    Key: 'test-data/aws-resources.json',
    Body: JSON.stringify(sampleAWSResources, null, 2),
    ContentType: 'application/json'
  }));
  
  // Create sample Terraform plan
  const sampleTerraformPlan = {
    format_version: '1.0',
    terraform_version: '1.5.0',
    planned_values: {
      root_module: {
        resources: [
          {
            address: 'aws_s3_bucket.test_bucket',
            mode: 'managed',
            type: 'aws_s3_bucket',
            name: 'test_bucket',
            values: {
              bucket: 'integration-test-bucket',
              force_destroy: false,
              tags: {
                Name: 'Integration Test Bucket',
                Environment: 'test'
              }
            }
          }
        ]
      }
    },
    resource_changes: [
      {
        address: 'aws_s3_bucket.test_bucket',
        mode: 'managed',
        type: 'aws_s3_bucket',
        name: 'test_bucket',
        change: {
          actions: ['create'],
          before: null,
          after: {
            bucket: 'integration-test-bucket',
            force_destroy: false
          }
        }
      }
    ]
  };
  
  await s3Client.send(new PutObjectCommand({
    Bucket: 'ai-compliance-test-terraform-plans',
    Key: 'test-data/sample-plan.json',
    Body: JSON.stringify(sampleTerraformPlan, null, 2),
    ContentType: 'application/json'
  }));
  
  console.log('✅ Test data setup complete');
}

/**
 * Setup test configurations
 */
async function setupTestConfigurations(): Promise<void> {
  console.log('⚙️ Setting up test configurations...');
  
  // Create default tenant configuration
  const defaultTenantConfig = {
    tenantId: 'default-test-tenant',
    name: 'Default Test Tenant',
    tier: 'STANDARD',
    status: 'ACTIVE',
    settings: {
      scanRegions: ['us-east-1', 'us-west-2'],
      enabledServices: ['s3', 'iam', 'ec2', 'cloudtrail', 'kms'],
      notificationsEnabled: true,
      aiChatEnabled: true,
      maxConcurrentScans: 5,
      retentionDays: 90
    },
    limits: {
      maxScansPerMonth: 1000,
      maxFindingsPerScan: 10000,
      maxReportsPerMonth: 100,
      maxChatMessagesPerDay: 500
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  await dynamoDBClient.send(new PutItemCommand({
    TableName: 'ai-compliance-tenants-test',
    Item: marshall(defaultTenantConfig)
  }));
  
  // Create test compliance frameworks
  const complianceFrameworks = [
    {
      frameworkId: 'SOC2',
      name: 'SOC 2 Type II',
      version: '2017',
      categories: ['Security', 'Availability', 'Processing Integrity', 'Confidentiality', 'Privacy'],
      controls: [
        {
          controlId: 'CC6.1',
          title: 'Logical and Physical Access Controls',
          description: 'The entity implements logical and physical access controls to protect against threats from sources outside its system boundaries.',
          mappedRules: ['S3_BUCKET_PUBLIC_READ_PROHIBITED', 'IAM_USER_MFA_ENABLED']
        }
      ]
    },
    {
      frameworkId: 'HIPAA',
      name: 'Health Insurance Portability and Accountability Act',
      version: '2013',
      categories: ['Administrative Safeguards', 'Physical Safeguards', 'Technical Safeguards'],
      controls: [
        {
          controlId: '164.312(a)(1)',
          title: 'Access Control',
          description: 'Implement technical policies and procedures for electronic information systems that maintain electronic protected health information.',
          mappedRules: ['IAM_USER_MFA_ENABLED']
        }
      ]
    }
  ];
  
  for (const framework of complianceFrameworks) {
    await dynamoDBClient.send(new PutItemCommand({
      TableName: 'ai-compliance-frameworks-test',
      Item: marshall(framework)
    }));
  }
  
  console.log('✅ Test configurations setup complete');
}

/**
 * Verify test environment is ready
 */
export async function verifyTestEnvironment(): Promise<boolean> {
  console.log('🔍 Verifying test environment...');
  
  try {
    // Check if test data exists
    const testDataExists = await s3Client.send(new GetObjectCommand({
      Bucket: 'ai-compliance-test-artifacts',
      Key: 'test-data/aws-resources.json'
    }));
    
    if (!testDataExists.Body) {
      console.error('❌ Test data not found');
      return false;
    }
    
    // Check if default tenant exists
    const defaultTenant = await dynamoDBClient.send(new GetItemCommand({
      TableName: 'ai-compliance-tenants-test',
      Key: marshall({ tenantId: 'default-test-tenant' })
    }));
    
    if (!defaultTenant.Item) {
      console.error('❌ Default test tenant not found');
      return false;
    }
    
    console.log('✅ Test environment verification complete');
    return true;
  } catch (error) {
    console.error('❌ Test environment verification failed:', error);
    return false;
  }
}
