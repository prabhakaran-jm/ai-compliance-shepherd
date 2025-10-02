import { BedrockKnowledgeBaseService, QueryRequest, IngestRequest } from '../src/services/BedrockKnowledgeBaseService';
import { logger } from '../src/utils/logger';

// Mock dependencies
jest.mock('@aws-sdk/client-bedrock-agent');
jest.mock('@aws-sdk/client-bedrock-runtime');
jest.mock('@aws-sdk/client-s3');
jest.mock('../src/services/ComplianceDataProcessor');
jest.mock('../src/utils/logger');

const mockBedrockAgentClient = {
  send: jest.fn()
};

const mockBedrockRuntimeClient = {
  send: jest.fn()
};

const mockS3Client = {
  send: jest.fn()
};

const mockComplianceDataProcessor = {
  processContent: jest.fn()
};

// Mock modules
jest.mock('@aws-sdk/client-bedrock-agent', () => ({
  BedrockAgentClient: jest.fn(() => mockBedrockAgentClient),
  CreateKnowledgeBaseCommand: jest.fn(),
  CreateDataSourceCommand: jest.fn(),
  GetKnowledgeBaseCommand: jest.fn(),
  ListDataSourcesCommand: jest.fn(),
  StartIngestionJobCommand: jest.fn(),
  GetIngestionJobCommand: jest.fn(),
  ListKnowledgeBasesCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => mockBedrockRuntimeClient),
  RetrieveAndGenerateCommand: jest.fn(),
  RetrieveCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => mockS3Client),
  PutObjectCommand: jest.fn(),
  ListObjectsV2Command: jest.fn()
}));

jest.mock('../src/services/ComplianceDataProcessor', () => ({
  ComplianceDataProcessor: jest.fn(() => mockComplianceDataProcessor)
}));

describe('BedrockKnowledgeBaseService', () => {
  let service: BedrockKnowledgeBaseService;
  let mockLogger: jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BedrockKnowledgeBaseService();
    mockLogger = logger as jest.Mocked<typeof logger>;

    // Mock environment variables
    process.env.AWS_REGION = 'us-east-1';
    process.env.BEDROCK_KNOWLEDGE_BASE_ID = 'TEST123456';
    process.env.COMPLIANCE_DATA_BUCKET = 'test-compliance-bucket';
    process.env.BEDROCK_MODEL_ARN = 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-v2';
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('queryKnowledgeBase', () => {
    const mockQueryRequest: QueryRequest = {
      query: 'What are the SOC 2 security requirements?',
      maxResults: 5,
      context: {
        framework: 'SOC2',
        resourceType: 'S3_BUCKET'
      }
    };

    it('should query knowledge base successfully', async () => {
      const mockResponse = {
        output: {
          text: 'SOC 2 security requirements include access controls, system boundaries, and risk assessment...'
        },
        citations: [
          {
            retrievedReferences: [
              {
                content: { text: 'Access controls are fundamental to SOC 2 security...' },
                location: { 
                  type: 'S3',
                  s3Location: { uri: 's3://test-bucket/soc2-data.md' }
                },
                metadata: { score: 0.95 }
              }
            ]
          }
        ],
        sessionId: 'session-123'
      };

      mockBedrockRuntimeClient.send.mockResolvedValueOnce(mockResponse);

      const result = await service.queryKnowledgeBase(mockQueryRequest, 'correlation-123');

      expect(result.answer).toBe(mockResponse.output.text);
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].content).toBe('Access controls are fundamental to SOC 2 security...');
      expect(result.sessionId).toBe('session-123');
      expect(mockBedrockRuntimeClient.send).toHaveBeenCalledTimes(1);
    });

    it('should enhance query with context', async () => {
      const mockResponse = {
        output: { text: 'Enhanced response with context...' },
        citations: [],
        sessionId: 'session-456'
      };

      mockBedrockRuntimeClient.send.mockResolvedValueOnce(mockResponse);

      await service.queryKnowledgeBase(mockQueryRequest, 'correlation-123');

      // Verify that the query was enhanced with context
      const sentCommand = mockBedrockRuntimeClient.send.mock.calls[0][0];
      expect(sentCommand.input.input.text).toContain('Framework: SOC2');
      expect(sentCommand.input.input.text).toContain('Resource Type: S3_BUCKET');
    });

    it('should handle missing knowledge base ID', async () => {
      // Clear the environment variable
      delete process.env.BEDROCK_KNOWLEDGE_BASE_ID;
      service = new BedrockKnowledgeBaseService();

      await expect(service.queryKnowledgeBase(mockQueryRequest, 'correlation-123'))
        .rejects.toThrow('Knowledge base not configured');
    });

    it('should handle Bedrock API errors', async () => {
      const error = new Error('Bedrock service error');
      error.name = 'ServiceUnavailableException';
      mockBedrockRuntimeClient.send.mockRejectedValueOnce(error);

      await expect(service.queryKnowledgeBase(mockQueryRequest, 'correlation-123'))
        .rejects.toThrow('Failed to query knowledge base');
    });

    it('should handle empty response from Bedrock', async () => {
      const mockResponse = {
        output: null,
        citations: [],
        sessionId: 'session-789'
      };

      mockBedrockRuntimeClient.send.mockResolvedValueOnce(mockResponse);

      await expect(service.queryKnowledgeBase(mockQueryRequest, 'correlation-123'))
        .rejects.toThrow('No response from Bedrock');
    });
  });

  describe('ingestComplianceData', () => {
    const mockIngestRequest: IngestRequest = {
      dataType: 'SOC2',
      content: 'This is SOC 2 compliance documentation...',
      metadata: {
        title: 'SOC 2 Security Controls',
        framework: 'SOC2',
        category: 'ACCESS_CONTROL',
        tags: ['security', 'access-control'],
        version: '1.0'
      },
      format: 'MARKDOWN'
    };

    it('should ingest compliance data successfully', async () => {
      const processedContent = '# Processed SOC 2 Content\n\nThis is processed content...';
      mockComplianceDataProcessor.processContent.mockResolvedValueOnce(processedContent);

      mockS3Client.send.mockResolvedValueOnce({}); // PutObjectCommand response

      // Mock data source creation/retrieval
      mockBedrockAgentClient.send
        .mockResolvedValueOnce({ // ListDataSourcesCommand
          dataSourceSummaries: [
            { dataSourceId: 'DS123456', name: 'Compliance Data Source' }
          ]
        })
        .mockResolvedValueOnce({ // StartIngestionJobCommand
          ingestionJob: {
            ingestionJobId: 'JOB123456',
            status: 'STARTING'
          }
        });

      const result = await service.ingestComplianceData(mockIngestRequest, 'correlation-123');

      expect(result.ingestionJobId).toBe('JOB123456');
      expect(result.status).toBe('STARTING');
      expect(result.s3Location).toContain('s3://test-compliance-bucket/compliance-data/soc2/');
      expect(mockComplianceDataProcessor.processContent).toHaveBeenCalledWith(
        mockIngestRequest.content,
        mockIngestRequest.format,
        mockIngestRequest.metadata
      );
      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
      expect(mockBedrockAgentClient.send).toHaveBeenCalledTimes(2);
    });

    it('should create new data source if none exists', async () => {
      const processedContent = 'Processed content...';
      mockComplianceDataProcessor.processContent.mockResolvedValueOnce(processedContent);

      mockS3Client.send.mockResolvedValueOnce({}); // PutObjectCommand response

      // Mock empty data sources list, then creation
      mockBedrockAgentClient.send
        .mockResolvedValueOnce({ // ListDataSourcesCommand
          dataSourceSummaries: []
        })
        .mockResolvedValueOnce({ // CreateDataSourceCommand
          dataSource: { dataSourceId: 'NEWDS123456' }
        })
        .mockResolvedValueOnce({ // StartIngestionJobCommand
          ingestionJob: {
            ingestionJobId: 'NEWJOB123456',
            status: 'STARTING'
          }
        });

      const result = await service.ingestComplianceData(mockIngestRequest, 'correlation-123');

      expect(result.dataSourceId).toBe('NEWDS123456');
      expect(mockBedrockAgentClient.send).toHaveBeenCalledTimes(3);
    });

    it('should handle S3 upload errors', async () => {
      const processedContent = 'Processed content...';
      mockComplianceDataProcessor.processContent.mockResolvedValueOnce(processedContent);

      const s3Error = new Error('S3 access denied');
      s3Error.name = 'AccessDenied';
      mockS3Client.send.mockRejectedValueOnce(s3Error);

      await expect(service.ingestComplianceData(mockIngestRequest, 'correlation-123'))
        .rejects.toThrow('Failed to ingest compliance data');
    });

    it('should handle content processing errors', async () => {
      const processingError = new Error('Invalid content format');
      mockComplianceDataProcessor.processContent.mockRejectedValueOnce(processingError);

      await expect(service.ingestComplianceData(mockIngestRequest, 'correlation-123'))
        .rejects.toThrow('Failed to ingest compliance data');
    });
  });

  describe('getKnowledgeBaseStatus', () => {
    it('should return knowledge base status successfully', async () => {
      const mockKnowledgeBase = {
        knowledgeBaseId: 'TEST123456',
        name: 'Test Knowledge Base',
        status: 'ACTIVE',
        description: 'Test description',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02')
      };

      const mockDataSources = {
        dataSourceSummaries: [
          {
            dataSourceId: 'DS123456',
            name: 'Test Data Source',
            status: 'AVAILABLE',
            updatedAt: new Date('2024-01-01')
          }
        ]
      };

      mockBedrockAgentClient.send
        .mockResolvedValueOnce({ knowledgeBase: mockKnowledgeBase }) // GetKnowledgeBaseCommand
        .mockResolvedValueOnce(mockDataSources); // ListDataSourcesCommand

      const result = await service.getKnowledgeBaseStatus('correlation-123');

      expect(result.knowledgeBaseId).toBe('TEST123456');
      expect(result.name).toBe('Test Knowledge Base');
      expect(result.status).toBe('ACTIVE');
      expect(result.dataSources).toHaveLength(1);
      expect(result.dataSources[0].dataSourceId).toBe('DS123456');
    });

    it('should handle missing knowledge base', async () => {
      mockBedrockAgentClient.send.mockResolvedValueOnce({ knowledgeBase: null });

      await expect(service.getKnowledgeBaseStatus('correlation-123'))
        .rejects.toThrow('Knowledge base not found');
    });

    it('should list available knowledge bases when none configured', async () => {
      // Clear the environment variable
      delete process.env.BEDROCK_KNOWLEDGE_BASE_ID;
      service = new BedrockKnowledgeBaseService();

      const mockKnowledgeBases = {
        knowledgeBaseSummaries: [
          { knowledgeBaseId: 'AUTO123456', name: 'Auto-discovered KB' }
        ]
      };

      const mockKnowledgeBase = {
        knowledgeBaseId: 'AUTO123456',
        name: 'Auto-discovered KB',
        status: 'ACTIVE'
      };

      mockBedrockAgentClient.send
        .mockResolvedValueOnce(mockKnowledgeBases) // ListKnowledgeBasesCommand
        .mockResolvedValueOnce({ knowledgeBase: mockKnowledgeBase }) // GetKnowledgeBaseCommand
        .mockResolvedValueOnce({ dataSourceSummaries: [] }); // ListDataSourcesCommand

      const result = await service.getKnowledgeBaseStatus('correlation-123');

      expect(result.knowledgeBaseId).toBe('AUTO123456');
    });
  });

  describe('listDataSources', () => {
    it('should list data sources successfully', async () => {
      const mockDataSources = {
        dataSourceSummaries: [
          {
            dataSourceId: 'DS123456',
            name: 'SOC2 Data Source',
            description: 'SOC 2 compliance data',
            status: 'AVAILABLE',
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02')
          }
        ]
      };

      mockBedrockAgentClient.send.mockResolvedValueOnce(mockDataSources);

      const result = await service.listDataSources('TEST123456', 'correlation-123');

      expect(result).toHaveLength(1);
      expect(result[0].dataSourceId).toBe('DS123456');
      expect(result[0].name).toBe('SOC2 Data Source');
    });

    it('should handle empty data sources list', async () => {
      mockBedrockAgentClient.send.mockResolvedValueOnce({ dataSourceSummaries: [] });

      const result = await service.listDataSources('TEST123456', 'correlation-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('syncDataSources', () => {
    it('should sync all data sources successfully', async () => {
      const mockDataSources = [
        { dataSourceId: 'DS123456', name: 'Data Source 1' },
        { dataSourceId: 'DS789012', name: 'Data Source 2' }
      ];

      // Mock listDataSources call
      jest.spyOn(service, 'listDataSources').mockResolvedValueOnce(mockDataSources);

      // Mock ingestion job starts
      mockBedrockAgentClient.send
        .mockResolvedValueOnce({ // First StartIngestionJobCommand
          ingestionJob: { ingestionJobId: 'JOB123456' }
        })
        .mockResolvedValueOnce({ // Second StartIngestionJobCommand
          ingestionJob: { ingestionJobId: 'JOB789012' }
        });

      const result = await service.syncDataSources('correlation-123');

      expect(result.syncJobs).toHaveLength(2);
      expect(result.syncJobs).toContain('JOB123456');
      expect(result.syncJobs).toContain('JOB789012');
    });

    it('should handle sync failures gracefully', async () => {
      const mockDataSources = [
        { dataSourceId: 'DS123456', name: 'Data Source 1' }
      ];

      jest.spyOn(service, 'listDataSources').mockResolvedValueOnce(mockDataSources);

      const syncError = new Error('Sync failed');
      mockBedrockAgentClient.send.mockRejectedValueOnce(syncError);

      await expect(service.syncDataSources('correlation-123'))
        .rejects.toThrow('Failed to sync data sources');
    });
  });

  describe('chatWithCompliance', () => {
    const mockChatRequest: QueryRequest = {
      query: 'How do I implement SOC 2 access controls in AWS?',
      sessionId: 'chat-session-123'
    };

    it('should provide compliance chat response', async () => {
      const mockResponse = {
        output: {
          text: 'To implement SOC 2 access controls in AWS, you should: 1. Enable MFA...'
        },
        citations: [],
        sessionId: 'chat-session-123'
      };

      mockBedrockRuntimeClient.send.mockResolvedValueOnce(mockResponse);

      const result = await service.chatWithCompliance(mockChatRequest, 'correlation-123');

      expect(result.answer).toContain('To implement SOC 2 access controls');
      expect(result.sessionId).toBe('chat-session-123');

      // Verify that the query was enhanced with chat prompt
      const sentCommand = mockBedrockRuntimeClient.send.mock.calls[0][0];
      expect(sentCommand.input.input.text).toContain('compliance expert assistant');
      expect(sentCommand.input.input.text).toContain('clear, direct answer');
    });

    it('should handle chat errors', async () => {
      const chatError = new Error('Chat service unavailable');
      mockBedrockRuntimeClient.send.mockRejectedValueOnce(chatError);

      await expect(service.chatWithCompliance(mockChatRequest, 'correlation-123'))
        .rejects.toThrow('Failed to process compliance chat');
    });
  });
});
