import { 
  BedrockAgentClient, 
  CreateKnowledgeBaseCommand,
  CreateDataSourceCommand,
  GetKnowledgeBaseCommand,
  ListDataSourcesCommand,
  StartIngestionJobCommand,
  GetIngestionJobCommand,
  ListKnowledgeBasesCommand
} from '@aws-sdk/client-bedrock-agent';
import { 
  BedrockRuntimeClient,
  RetrieveAndGenerateCommand,
  RetrieveCommand
} from '@aws-sdk/client-bedrock-runtime';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger';
import { BedrockError, KnowledgeBaseError } from '../utils/errorHandler';
import { ComplianceDataProcessor } from './ComplianceDataProcessor';
import { v4 as uuidv4 } from 'uuid';

export interface QueryRequest {
  query: string;
  maxResults?: number;
  retrievalConfiguration?: {
    vectorSearchConfiguration?: {
      numberOfResults?: number;
      overrideSearchType?: 'HYBRID' | 'SEMANTIC';
    };
  };
  sessionId?: string;
  context?: {
    framework?: string;
    resourceType?: string;
    findingId?: string;
  };
}

export interface QueryResponse {
  answer: string;
  sources: Array<{
    content: string;
    location: {
      type: string;
      s3Location?: {
        uri: string;
      };
    };
    score?: number;
  }>;
  sessionId: string;
  citations: Array<{
    generatedResponsePart: {
      textResponsePart: {
        text: string;
        span: {
          start: number;
          end: number;
        };
      };
    };
    retrievedReferences: Array<{
      content: {
        text: string;
      };
      location: {
        type: string;
        s3Location?: {
          uri: string;
        };
      };
    }>;
  }>;
}

export interface IngestRequest {
  dataType: 'SOC2' | 'HIPAA' | 'GDPR' | 'CUSTOM';
  content: string;
  metadata: {
    title: string;
    description?: string;
    framework: string;
    category: string;
    tags?: string[];
    version?: string;
    lastUpdated?: string;
  };
  format: 'MARKDOWN' | 'TEXT' | 'JSON';
}

export interface IngestResponse {
  ingestionJobId: string;
  dataSourceId: string;
  status: 'STARTING' | 'IN_PROGRESS' | 'COMPLETE' | 'FAILED';
  s3Location: string;
  message: string;
}

export interface KnowledgeBaseStatus {
  knowledgeBaseId: string;
  name: string;
  status: 'CREATING' | 'ACTIVE' | 'DELETING' | 'UPDATING' | 'FAILED';
  description: string;
  createdAt: string;
  updatedAt: string;
  dataSources: Array<{
    dataSourceId: string;
    name: string;
    status: string;
    lastSyncTime?: string;
  }>;
  vectorIndex: {
    status: string;
    documentCount: number;
  };
}

/**
 * Service for managing Bedrock Knowledge Base with SOC 2 compliance data
 */
export class BedrockKnowledgeBaseService {
  private bedrockAgentClient: BedrockAgentClient;
  private bedrockRuntimeClient: BedrockRuntimeClient;
  private s3Client: S3Client;
  private complianceDataProcessor: ComplianceDataProcessor;
  private knowledgeBaseId: string;
  private dataSourceBucket: string;

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    this.bedrockAgentClient = new BedrockAgentClient({ region });
    this.bedrockRuntimeClient = new BedrockRuntimeClient({ region });
    this.s3Client = new S3Client({ region });
    this.complianceDataProcessor = new ComplianceDataProcessor();
    
    this.knowledgeBaseId = process.env.BEDROCK_KNOWLEDGE_BASE_ID || '';
    this.dataSourceBucket = process.env.COMPLIANCE_DATA_BUCKET || 'ai-compliance-shepherd-knowledge-base';
  }

  /**
   * Query the knowledge base for compliance guidance
   */
  async queryKnowledgeBase(request: QueryRequest, correlationId: string): Promise<QueryResponse> {
    logger.info('Querying knowledge base', {
      correlationId,
      query: request.query.substring(0, 100),
      maxResults: request.maxResults,
      context: request.context
    });

    try {
      if (!this.knowledgeBaseId) {
        throw new KnowledgeBaseError('Knowledge base not configured');
      }

      // Enhance query with context if provided
      let enhancedQuery = request.query;
      if (request.context) {
        const contextParts = [];
        if (request.context.framework) {
          contextParts.push(`Framework: ${request.context.framework}`);
        }
        if (request.context.resourceType) {
          contextParts.push(`Resource Type: ${request.context.resourceType}`);
        }
        if (contextParts.length > 0) {
          enhancedQuery = `${contextParts.join(', ')}. ${request.query}`;
        }
      }

      const command = new RetrieveAndGenerateCommand({
        input: {
          text: enhancedQuery
        },
        retrieveAndGenerateConfiguration: {
          type: 'KNOWLEDGE_BASE',
          knowledgeBaseConfiguration: {
            knowledgeBaseId: this.knowledgeBaseId,
            modelArn: process.env.BEDROCK_MODEL_ARN || 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-v2',
            retrievalConfiguration: request.retrievalConfiguration || {
              vectorSearchConfiguration: {
                numberOfResults: request.maxResults || 5
              }
            }
          }
        },
        sessionConfiguration: request.sessionId ? {
          kmsKeyArn: process.env.BEDROCK_KMS_KEY_ARN
        } : undefined
      });

      const response = await this.bedrockRuntimeClient.send(command);

      if (!response.output?.text) {
        throw new BedrockError('No response from Bedrock');
      }

      const result: QueryResponse = {
        answer: response.output.text,
        sources: response.citations?.map(citation => ({
          content: citation.retrievedReferences?.[0]?.content?.text || '',
          location: {
            type: citation.retrievedReferences?.[0]?.location?.type || 'S3',
            s3Location: citation.retrievedReferences?.[0]?.location?.s3Location
          },
          score: citation.retrievedReferences?.[0]?.metadata?.score
        })) || [],
        sessionId: response.sessionId || uuidv4(),
        citations: response.citations || []
      };

      logger.info('Knowledge base query completed', {
        correlationId,
        answerLength: result.answer.length,
        sourcesCount: result.sources.length,
        sessionId: result.sessionId
      });

      return result;

    } catch (error) {
      logger.error('Error querying knowledge base', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof BedrockError || error instanceof KnowledgeBaseError) {
        throw error;
      }

      throw new BedrockError('Failed to query knowledge base', error);
    }
  }

  /**
   * Ingest new compliance data into the knowledge base
   */
  async ingestComplianceData(request: IngestRequest, correlationId: string): Promise<IngestResponse> {
    logger.info('Ingesting compliance data', {
      correlationId,
      dataType: request.dataType,
      format: request.format,
      contentLength: request.content.length,
      metadata: request.metadata
    });

    try {
      // Process the content based on format
      const processedContent = await this.complianceDataProcessor.processContent(
        request.content,
        request.format,
        request.metadata
      );

      // Generate S3 key for the content
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const s3Key = `compliance-data/${request.dataType.toLowerCase()}/${request.metadata.framework.toLowerCase()}/${timestamp}-${uuidv4()}.md`;

      // Upload to S3
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.dataSourceBucket,
        Key: s3Key,
        Body: processedContent,
        ContentType: 'text/markdown',
        Metadata: {
          title: request.metadata.title,
          framework: request.metadata.framework,
          category: request.metadata.category,
          dataType: request.dataType,
          format: request.format,
          version: request.metadata.version || '1.0',
          lastUpdated: request.metadata.lastUpdated || new Date().toISOString()
        },
        Tags: request.metadata.tags ? request.metadata.tags.map(tag => `tag=${tag}`).join('&') : undefined
      }));

      // Get or create data source
      const dataSourceId = await this.ensureDataSource(correlationId);

      // Start ingestion job
      const ingestionCommand = new StartIngestionJobCommand({
        knowledgeBaseId: this.knowledgeBaseId,
        dataSourceId,
        description: `Ingest ${request.metadata.title} - ${request.dataType} compliance data`
      });

      const ingestionResponse = await this.bedrockAgentClient.send(ingestionCommand);

      if (!ingestionResponse.ingestionJob?.ingestionJobId) {
        throw new KnowledgeBaseError('Failed to start ingestion job');
      }

      const result: IngestResponse = {
        ingestionJobId: ingestionResponse.ingestionJob.ingestionJobId,
        dataSourceId,
        status: ingestionResponse.ingestionJob.status || 'STARTING',
        s3Location: `s3://${this.dataSourceBucket}/${s3Key}`,
        message: 'Compliance data ingestion started successfully'
      };

      logger.info('Compliance data ingestion started', {
        correlationId,
        ingestionJobId: result.ingestionJobId,
        dataSourceId: result.dataSourceId,
        s3Location: result.s3Location
      });

      return result;

    } catch (error) {
      logger.error('Error ingesting compliance data', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new KnowledgeBaseError('Failed to ingest compliance data', error);
    }
  }

  /**
   * Get knowledge base status and information
   */
  async getKnowledgeBaseStatus(correlationId: string): Promise<KnowledgeBaseStatus> {
    logger.info('Getting knowledge base status', { correlationId });

    try {
      if (!this.knowledgeBaseId) {
        // List available knowledge bases
        const listCommand = new ListKnowledgeBasesCommand({
          maxResults: 10
        });
        const listResponse = await this.bedrockAgentClient.send(listCommand);
        
        if (!listResponse.knowledgeBaseSummaries?.length) {
          throw new KnowledgeBaseError('No knowledge bases found');
        }

        // Use the first knowledge base if none configured
        this.knowledgeBaseId = listResponse.knowledgeBaseSummaries[0].knowledgeBaseId!;
      }

      const command = new GetKnowledgeBaseCommand({
        knowledgeBaseId: this.knowledgeBaseId
      });

      const response = await this.bedrockAgentClient.send(command);

      if (!response.knowledgeBase) {
        throw new KnowledgeBaseError('Knowledge base not found');
      }

      // Get data sources
      const dataSourcesCommand = new ListDataSourcesCommand({
        knowledgeBaseId: this.knowledgeBaseId
      });

      const dataSourcesResponse = await this.bedrockAgentClient.send(dataSourcesCommand);

      const result: KnowledgeBaseStatus = {
        knowledgeBaseId: this.knowledgeBaseId,
        name: response.knowledgeBase.name || 'Compliance Knowledge Base',
        status: response.knowledgeBase.status || 'UNKNOWN',
        description: response.knowledgeBase.description || 'SOC 2 compliance guidance knowledge base',
        createdAt: response.knowledgeBase.createdAt?.toISOString() || '',
        updatedAt: response.knowledgeBase.updatedAt?.toISOString() || '',
        dataSources: dataSourcesResponse.dataSourceSummaries?.map(ds => ({
          dataSourceId: ds.dataSourceId!,
          name: ds.name!,
          status: ds.status!,
          lastSyncTime: ds.updatedAt?.toISOString()
        })) || [],
        vectorIndex: {
          status: 'ACTIVE', // This would need to be retrieved from OpenSearch
          documentCount: 0 // This would need to be calculated
        }
      };

      logger.info('Knowledge base status retrieved', {
        correlationId,
        knowledgeBaseId: result.knowledgeBaseId,
        status: result.status,
        dataSourcesCount: result.dataSources.length
      });

      return result;

    } catch (error) {
      logger.error('Error getting knowledge base status', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new KnowledgeBaseError('Failed to get knowledge base status', error);
    }
  }

  /**
   * List data sources for the knowledge base
   */
  async listDataSources(knowledgeBaseId: string, correlationId: string): Promise<any[]> {
    logger.info('Listing data sources', { correlationId, knowledgeBaseId });

    try {
      const command = new ListDataSourcesCommand({
        knowledgeBaseId,
        maxResults: 50
      });

      const response = await this.bedrockAgentClient.send(command);

      const dataSources = response.dataSourceSummaries?.map(ds => ({
        dataSourceId: ds.dataSourceId,
        name: ds.name,
        description: ds.description,
        status: ds.status,
        createdAt: ds.createdAt?.toISOString(),
        updatedAt: ds.updatedAt?.toISOString()
      })) || [];

      logger.info('Data sources listed', {
        correlationId,
        count: dataSources.length
      });

      return dataSources;

    } catch (error) {
      logger.error('Error listing data sources', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new KnowledgeBaseError('Failed to list data sources', error);
    }
  }

  /**
   * Sync all data sources
   */
  async syncDataSources(correlationId: string): Promise<{ syncJobs: string[] }> {
    logger.info('Syncing data sources', { correlationId });

    try {
      const dataSources = await this.listDataSources(this.knowledgeBaseId, correlationId);
      const syncJobs: string[] = [];

      for (const dataSource of dataSources) {
        const command = new StartIngestionJobCommand({
          knowledgeBaseId: this.knowledgeBaseId,
          dataSourceId: dataSource.dataSourceId,
          description: `Sync data source: ${dataSource.name}`
        });

        const response = await this.bedrockAgentClient.send(command);
        if (response.ingestionJob?.ingestionJobId) {
          syncJobs.push(response.ingestionJob.ingestionJobId);
        }
      }

      logger.info('Data sources sync started', {
        correlationId,
        syncJobsCount: syncJobs.length
      });

      return { syncJobs };

    } catch (error) {
      logger.error('Error syncing data sources', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new KnowledgeBaseError('Failed to sync data sources', error);
    }
  }

  /**
   * Chat interface for compliance guidance
   */
  async chatWithCompliance(request: QueryRequest, correlationId: string): Promise<QueryResponse> {
    logger.info('Starting compliance chat', {
      correlationId,
      query: request.query.substring(0, 100),
      sessionId: request.sessionId
    });

    try {
      // Enhance query for conversational context
      const chatPrompt = `You are a compliance expert assistant specializing in SOC 2, HIPAA, and GDPR regulations. 
      Please provide helpful, accurate, and actionable guidance for the following question:
      
      ${request.query}
      
      Please structure your response with:
      1. A clear, direct answer
      2. Relevant compliance requirements
      3. Specific implementation steps
      4. Best practices and recommendations
      5. Common pitfalls to avoid`;

      const enhancedRequest = {
        ...request,
        query: chatPrompt
      };

      return await this.queryKnowledgeBase(enhancedRequest, correlationId);

    } catch (error) {
      logger.error('Error in compliance chat', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new BedrockError('Failed to process compliance chat', error);
    }
  }

  /**
   * Ensure data source exists for the knowledge base
   */
  private async ensureDataSource(correlationId: string): Promise<string> {
    try {
      // Check if data source already exists
      const dataSources = await this.listDataSources(this.knowledgeBaseId, correlationId);
      const existingDataSource = dataSources.find(ds => ds.name === 'Compliance Data Source');

      if (existingDataSource) {
        return existingDataSource.dataSourceId;
      }

      // Create new data source
      const command = new CreateDataSourceCommand({
        knowledgeBaseId: this.knowledgeBaseId,
        name: 'Compliance Data Source',
        description: 'Data source for SOC 2, HIPAA, and GDPR compliance documentation',
        dataSourceConfiguration: {
          type: 'S3',
          s3Configuration: {
            bucketArn: `arn:aws:s3:::${this.dataSourceBucket}`,
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

      const response = await this.bedrockAgentClient.send(command);

      if (!response.dataSource?.dataSourceId) {
        throw new KnowledgeBaseError('Failed to create data source');
      }

      logger.info('Data source created', {
        correlationId,
        dataSourceId: response.dataSource.dataSourceId
      });

      return response.dataSource.dataSourceId;

    } catch (error) {
      logger.error('Error ensuring data source', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new KnowledgeBaseError('Failed to ensure data source', error);
    }
  }
}
