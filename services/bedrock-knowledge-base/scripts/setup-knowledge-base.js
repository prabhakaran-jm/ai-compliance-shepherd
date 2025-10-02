#!/usr/bin/env node

/**
 * Script to set up Bedrock Knowledge Base with SOC 2 compliance data
 */

const { 
  BedrockAgentClient, 
  CreateKnowledgeBaseCommand,
  CreateDataSourceCommand,
  StartIngestionJobCommand
} = require('@aws-sdk/client-bedrock-agent');
const { S3Client, CreateBucketCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { IAMClient, CreateRoleCommand, AttachRolePolicyCommand } = require('@aws-sdk/client-iam');
const fs = require('fs');
const path = require('path');

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const KNOWLEDGE_BASE_NAME = 'ai-compliance-shepherd-kb';
const DATA_SOURCE_BUCKET = 'ai-compliance-shepherd-knowledge-base';

class KnowledgeBaseSetup {
  constructor() {
    this.bedrockClient = new BedrockAgentClient({ region: AWS_REGION });
    this.s3Client = new S3Client({ region: AWS_REGION });
    this.iamClient = new IAMClient({ region: AWS_REGION });
  }

  async setup() {
    try {
      console.log('🚀 Starting Bedrock Knowledge Base setup...');

      // Step 1: Create S3 bucket for data sources
      console.log('📦 Creating S3 bucket for knowledge base data...');
      await this.createS3Bucket();

      // Step 2: Upload compliance data
      console.log('📄 Uploading compliance data to S3...');
      await this.uploadComplianceData();

      // Step 3: Create IAM roles
      console.log('🔐 Creating IAM roles for Bedrock...');
      const roleArn = await this.createIAMRoles();

      // Step 4: Create knowledge base
      console.log('🧠 Creating Bedrock Knowledge Base...');
      const knowledgeBaseId = await this.createKnowledgeBase(roleArn);

      // Step 5: Create data source
      console.log('📊 Creating data source...');
      const dataSourceId = await this.createDataSource(knowledgeBaseId);

      // Step 6: Start ingestion
      console.log('⚡ Starting data ingestion...');
      await this.startIngestion(knowledgeBaseId, dataSourceId);

      console.log('✅ Knowledge Base setup completed successfully!');
      console.log(`📋 Knowledge Base ID: ${knowledgeBaseId}`);
      console.log(`📋 Data Source ID: ${dataSourceId}`);
      console.log(`📋 S3 Bucket: ${DATA_SOURCE_BUCKET}`);

    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      process.exit(1);
    }
  }

  async createS3Bucket() {
    try {
      await this.s3Client.send(new CreateBucketCommand({
        Bucket: DATA_SOURCE_BUCKET,
        CreateBucketConfiguration: AWS_REGION !== 'us-east-1' ? {
          LocationConstraint: AWS_REGION
        } : undefined
      }));
      console.log(`✅ Created S3 bucket: ${DATA_SOURCE_BUCKET}`);
    } catch (error) {
      if (error.name === 'BucketAlreadyExists' || error.name === 'BucketAlreadyOwnedByYou') {
        console.log(`ℹ️  S3 bucket already exists: ${DATA_SOURCE_BUCKET}`);
      } else {
        throw error;
      }
    }
  }

  async uploadComplianceData() {
    const dataDir = path.join(__dirname, '..', 'data');
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(dataDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const key = `compliance-data/${file}`;

      await this.s3Client.send(new PutObjectCommand({
        Bucket: DATA_SOURCE_BUCKET,
        Key: key,
        Body: content,
        ContentType: 'text/markdown',
        Metadata: {
          source: 'setup-script',
          type: 'compliance-data',
          framework: file.includes('soc2') ? 'SOC2' : 'GENERAL'
        }
      }));

      console.log(`✅ Uploaded: ${key}`);
    }
  }

  async createIAMRoles() {
    const roleName = 'BedrockKnowledgeBaseRole';
    const trustPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: 'bedrock.amazonaws.com'
          },
          Action: 'sts:AssumeRole'
        }
      ]
    };

    const rolePolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            's3:GetObject',
            's3:ListBucket'
          ],
          Resource: [
            `arn:aws:s3:::${DATA_SOURCE_BUCKET}`,
            `arn:aws:s3:::${DATA_SOURCE_BUCKET}/*`
          ]
        },
        {
          Effect: 'Allow',
          Action: [
            'aoss:APIAccessAll'
          ],
          Resource: '*'
        }
      ]
    };

    try {
      const createRoleResponse = await this.iamClient.send(new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
        Description: 'Role for Bedrock Knowledge Base to access S3 and OpenSearch'
      }));

      // Attach inline policy
      await this.iamClient.send(new AttachRolePolicyCommand({
        RoleName: roleName,
        PolicyArn: 'arn:aws:iam::aws:policy/AmazonBedrockFullAccess'
      }));

      console.log(`✅ Created IAM role: ${roleName}`);
      return createRoleResponse.Role.Arn;

    } catch (error) {
      if (error.name === 'EntityAlreadyExists') {
        // Role already exists, get the ARN
        const accountId = await this.getAccountId();
        const roleArn = `arn:aws:iam::${accountId}:role/${roleName}`;
        console.log(`ℹ️  IAM role already exists: ${roleName}`);
        return roleArn;
      } else {
        throw error;
      }
    }
  }

  async createKnowledgeBase(roleArn) {
    const command = new CreateKnowledgeBaseCommand({
      name: KNOWLEDGE_BASE_NAME,
      description: 'AI Compliance Shepherd Knowledge Base for SOC 2 and compliance guidance',
      roleArn: roleArn,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: 'arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1'
        }
      },
      storageConfiguration: {
        type: 'OPENSEARCH_SERVERLESS',
        opensearchServerlessConfiguration: {
          collectionArn: await this.createOpenSearchCollection(),
          vectorIndexName: 'compliance-vector-index',
          fieldMapping: {
            vectorField: 'vector',
            textField: 'text',
            metadataField: 'metadata'
          }
        }
      }
    });

    const response = await this.bedrockClient.send(command);
    console.log(`✅ Created Knowledge Base: ${response.knowledgeBase.knowledgeBaseId}`);
    return response.knowledgeBase.knowledgeBaseId;
  }

  async createDataSource(knowledgeBaseId) {
    const command = new CreateDataSourceCommand({
      knowledgeBaseId: knowledgeBaseId,
      name: 'SOC2-Compliance-Data',
      description: 'SOC 2 compliance documentation and guidance',
      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: `arn:aws:s3:::${DATA_SOURCE_BUCKET}`,
          inclusionPrefixes: ['compliance-data/']
        }
      },
      vectorIngestionConfiguration: {
        chunkingConfiguration: {
          chunkingStrategy: 'FIXED_SIZE',
          fixedSizeChunkingConfiguration: {
            maxTokens: 512,
            overlapPercentage: 20
          }
        }
      }
    });

    const response = await this.bedrockClient.send(command);
    console.log(`✅ Created Data Source: ${response.dataSource.dataSourceId}`);
    return response.dataSource.dataSourceId;
  }

  async startIngestion(knowledgeBaseId, dataSourceId) {
    const command = new StartIngestionJobCommand({
      knowledgeBaseId: knowledgeBaseId,
      dataSourceId: dataSourceId,
      description: 'Initial ingestion of SOC 2 compliance data'
    });

    const response = await this.bedrockClient.send(command);
    console.log(`✅ Started ingestion job: ${response.ingestionJob.ingestionJobId}`);
    return response.ingestionJob.ingestionJobId;
  }

  async createOpenSearchCollection() {
    // This is a placeholder - in practice, you would need to create
    // an OpenSearch Serverless collection first
    // For now, return a placeholder ARN
    const accountId = await this.getAccountId();
    return `arn:aws:aoss:${AWS_REGION}:${accountId}:collection/compliance-kb-collection`;
  }

  async getAccountId() {
    // Get account ID from STS
    const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
    const stsClient = new STSClient({ region: AWS_REGION });
    const response = await stsClient.send(new GetCallerIdentityCommand({}));
    return response.Account;
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  const setup = new KnowledgeBaseSetup();
  setup.setup().catch(console.error);
}

module.exports = KnowledgeBaseSetup;
