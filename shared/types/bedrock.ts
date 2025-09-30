/**
 * Amazon Bedrock and AI integration types
 */

import { ComplianceFramework } from './compliance';
import { Finding } from './findings';

// Bedrock model configuration
export interface BedrockModel {
  id: string;
  name: string;
  provider: 'anthropic' | 'amazon' | 'meta' | 'cohere' | 'ai21';
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportedFeatures: BedrockFeature[];
  pricing: BedrockPricing;
}

export type BedrockFeature = 
  | 'text_generation'
  | 'conversation'
  | 'reasoning'
  | 'code_generation'
  | 'analysis'
  | 'summarization';

export interface BedrockPricing {
  inputTokenPrice: number; // per 1000 tokens
  outputTokenPrice: number; // per 1000 tokens
  currency: string;
}

// Knowledge Base
export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  status: 'creating' | 'active' | 'deleting' | 'failed';
  
  // Configuration
  dataSource: KnowledgeBaseDataSource;
  embeddingModel: string;
  vectorIndex: VectorIndex;
  
  // Content
  documents: KnowledgeBaseDocument[];
  lastUpdated: string;
  
  // Usage
  queryCount: number;
  lastQueried?: string;
}

export interface KnowledgeBaseDataSource {
  type: 's3' | 'opensearch' | 'pinecone';
  configuration: Record<string, unknown>;
  credentials?: Record<string, string>;
}

export interface VectorIndex {
  type: 'opensearch' | 'pinecone' | 'faiss';
  endpoint: string;
  indexName: string;
  dimensions: number;
  metric: 'cosine' | 'euclidean' | 'dot_product';
}

export interface KnowledgeBaseDocument {
  id: string;
  name: string;
  type: 'pdf' | 'txt' | 'html' | 'markdown' | 'json';
  size: number;
  status: 'indexing' | 'indexed' | 'failed';
  chunks: DocumentChunk[];
  uploadedAt: string;
  indexedAt?: string;
}

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  relevanceScore?: number;
}

// AgentCore configuration
export interface AgentCoreConfig {
  agentId: string;
  name: string;
  description: string;
  version: string;
  
  // Model configuration
  foundationModel: string;
  modelParameters: ModelParameters;
  
  // Knowledge bases
  knowledgeBases: string[]; // Knowledge base IDs
  
  // Action groups
  actionGroups: ActionGroup[];
  
  // Instructions and prompts
  instructions: string;
  systemPrompt: string;
  
  // Configuration
  guardrails: GuardrailConfig;
  responseFormat: ResponseFormat;
  
  // Status
  status: 'creating' | 'active' | 'updating' | 'failed';
  lastUpdated: string;
}

export interface ModelParameters {
  temperature: number;
  topP: number;
  maxTokens: number;
  stopSequences?: string[];
  topK?: number;
  repetitionPenalty?: number;
}

export interface ActionGroup {
  id: string;
  name: string;
  description: string;
  executor: ActionGroupExecutor;
  apiSchema: string; // OpenAPI schema
  enabled: boolean;
}

export interface ActionGroupExecutor {
  type: 'lambda' | 'step_functions' | 'api_gateway';
  arn: string;
  timeout?: number;
  retryCount?: number;
}

export interface GuardrailConfig {
  enabled: boolean;
  contentFilters: ContentFilter[];
  wordPolicy: WordPolicy;
  topicPolicy: TopicPolicy;
}

export interface ContentFilter {
  type: 'hate' | 'insults' | 'misconduct' | 'prompt_attack' | 'violence';
  threshold: 'none' | 'low' | 'medium' | 'high';
  action: 'block' | 'flag' | 'allow';
}

export interface WordPolicy {
  enabled: boolean;
  blockedWords: string[];
  customWords: string[];
}

export interface TopicPolicy {
  enabled: boolean;
  blockedTopics: string[];
  customTopics: string[];
}

export interface ResponseFormat {
  type: 'text' | 'json' | 'structured';
  schema?: Record<string, unknown>;
}

// Agent invocation
export interface AgentInvocation {
  agentId: string;
  sessionId: string;
  message: string;
  context?: AgentContext;
  options?: InvocationOptions;
}

export interface AgentContext {
  tenantId: string;
  userId: string;
  conversationHistory?: ConversationMessage[];
  currentScan?: string;
  currentFindings?: string[];
  userPreferences?: Record<string, unknown>;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface InvocationOptions {
  includeSources: boolean;
  includeReasoning: boolean;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface AgentResponse {
  response: string;
  sessionId: string;
  sources?: AgentSource[];
  reasoning?: string;
  actions?: AgentAction[];
  metadata: AgentMetadata;
}

export interface AgentSource {
  type: 'knowledge_base' | 'api_response' | 'database' | 'external';
  title: string;
  content: string;
  url?: string;
  relevanceScore: number;
  metadata?: Record<string, unknown>;
}

export interface AgentAction {
  type: 'scan_environment' | 'analyze_terraform' | 'apply_fix' | 'generate_report';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: Record<string, unknown>;
  error?: string;
}

export interface AgentMetadata {
  model: string;
  tokens: number;
  processingTime: number;
  confidence: number;
  actionGroupsUsed: string[];
  knowledgeBasesUsed: string[];
}

// Compliance-specific AI types
export interface ComplianceAnalysisRequest {
  findings: Finding[];
  frameworks: ComplianceFramework[];
  context: {
    tenantId: string;
    accountId: string;
    region?: string;
  };
  options?: {
    includeRecommendations: boolean;
    includeRiskAssessment: boolean;
    includeTrendAnalysis: boolean;
  };
}

export interface ComplianceAnalysisResponse {
  analysis: ComplianceAnalysis;
  recommendations: ComplianceRecommendation[];
  riskAssessment?: RiskAssessment;
  trendAnalysis?: TrendAnalysis;
  citations: ComplianceCitation[];
}

export interface ComplianceAnalysis {
  overallScore: number;
  frameworkScores: Record<ComplianceFramework, number>;
  criticalIssues: string[];
  improvementAreas: string[];
  summary: string;
  insights: string[];
}

export interface ComplianceRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'security' | 'compliance' | 'cost' | 'performance';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  timeframe: string;
  actions: string[];
  relatedFindings: string[];
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  riskScore: number;
  mitigationStrategies: string[];
}

export interface RiskFactor {
  factor: string;
  impact: 'low' | 'medium' | 'high';
  likelihood: 'low' | 'medium' | 'high';
  description: string;
  relatedFindings: string[];
}

export interface TrendAnalysis {
  timeframe: string;
  trends: ComplianceTrend[];
  predictions: CompliancePrediction[];
  insights: string[];
}

export interface ComplianceTrend {
  metric: string;
  direction: 'improving' | 'declining' | 'stable';
  change: number;
  significance: 'low' | 'medium' | 'high';
  description: string;
}

export interface CompliancePrediction {
  metric: string;
  prediction: number;
  confidence: number;
  timeframe: string;
  factors: string[];
}

export interface ComplianceCitation {
  type: 'control' | 'standard' | 'guidance' | 'best_practice';
  title: string;
  content: string;
  url?: string;
  relevance: number;
  framework: ComplianceFramework;
}

// AI model fine-tuning
export interface ModelFineTuningRequest {
  modelId: string;
  trainingData: TrainingData;
  hyperparameters: FineTuningHyperparameters;
  validationData?: TrainingData;
}

export interface TrainingData {
  format: 'jsonl' | 'csv' | 'json';
  data: string; // Base64 encoded training data
  size: number;
}

export interface FineTuningHyperparameters {
  learningRate: number;
  batchSize: number;
  epochs: number;
  warmupSteps?: number;
  weightDecay?: number;
}

export interface FineTuningJob {
  jobId: string;
  modelId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt: string;
  completedAt?: string;
  metrics?: FineTuningMetrics;
}

export interface FineTuningMetrics {
  trainingLoss: number;
  validationLoss: number;
  accuracy: number;
  perplexity?: number;
}
