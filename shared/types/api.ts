/**
 * API and webhook types
 */

import { BaseEntity, PaginationParams, PaginatedResponse } from './common';
import { ComplianceFramework } from './compliance';
import { Finding, FindingFilter, FindingQuery } from './findings';
import { Tenant, TenantUser } from './tenant';
import { ScanRequest, ScanJob, ScanResults } from './scanning';
import { RemediationRequest, RemediationJob } from './remediation';

// API Gateway events
export interface APIGatewayEvent {
  resource: string;
  path: string;
  httpMethod: string;
  headers: Record<string, string>;
  multiValueHeaders: Record<string, string[]>;
  queryStringParameters: Record<string, string> | null;
  multiValueQueryStringParameters: Record<string, string[]> | null;
  pathParameters: Record<string, string> | null;
  stageVariables: Record<string, string> | null;
  requestContext: APIGatewayRequestContext;
  body: string | null;
  isBase64Encoded: boolean;
}

export interface APIGatewayRequestContext {
  resourceId: string;
  resourcePath: string;
  httpMethod: string;
  extendedRequestId: string;
  requestTime: string;
  path: string;
  accountId: string;
  protocol: string;
  stage: string;
  domainPrefix: string;
  requestTimeEpoch: number;
  requestId: string;
  identity: APIGatewayIdentity;
  domainName: string;
  apiId: string;
}

export interface APIGatewayIdentity {
  cognitoIdentityPoolId: string | null;
  accountId: string | null;
  cognitoIdentityId: string | null;
  caller: string | null;
  sourceIp: string;
  principalOrgId: string | null;
  accessKey: string | null;
  cognitoAuthenticationType: string | null;
  cognitoAuthenticationProvider: string | null;
  userArn: string | null;
  userAgent: string | null;
  user: string | null;
  apiKey: string | null;
  apiKeyId: string | null;
  clientCert: APIGatewayClientCert | null;
}

export interface APIGatewayClientCert {
  clientCertPem: string;
  subjectDN: string;
  issuerDN: string;
  serialNumber: string;
  validity: {
    notBefore: string;
    notAfter: string;
  };
}

export interface APIGatewayResponse {
  statusCode: number;
  headers: Record<string, string>;
  multiValueHeaders: Record<string, string[]>;
  body: string;
  isBase64Encoded: boolean;
}

// Chat API
export interface ChatRequest {
  tenantId: string;
  message: string;
  conversationId?: string;
  context?: ChatContext;
  options?: ChatOptions;
}

export interface ChatContext {
  scanId?: string;
  findingIds?: string[];
  resourceArns?: string[];
  frameworks?: ComplianceFramework[];
  services?: string[];
}

export interface ChatOptions {
  includeCitations: boolean;
  includeRecommendations: boolean;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface ChatResponse {
  message: string;
  conversationId: string;
  citations?: ChatCitation[];
  recommendations?: string[];
  followUpQuestions?: string[];
  metadata: ChatMetadata;
}

export interface ChatCitation {
  type: 'compliance_control' | 'aws_documentation' | 'best_practice' | 'internal_policy';
  title: string;
  url?: string;
  content: string;
  relevance: number;
}

export interface ChatMetadata {
  model: string;
  tokens: number;
  processingTime: number;
  confidence: number;
  sources: string[];
}

// Scan API
export interface ScanAPIRequest {
  tenantId: string;
  accountId?: string;
  region?: string;
  scanType: 'full_environment' | 'service_specific' | 'rule_specific';
  frameworks?: ComplianceFramework[];
  services?: string[];
  options?: {
    generateReport?: boolean;
    dryRun?: boolean;
    parallel?: boolean;
  };
}

export interface ScanAPIResponse {
  scanId: string;
  status: 'accepted' | 'rejected';
  message: string;
  estimatedDuration?: number;
}

// Report API
export interface ReportRequest {
  scanId: string;
  format: 'html' | 'pdf' | 'json' | 'csv';
  filters?: FindingFilter;
  options?: {
    includeEvidence?: boolean;
    includeRecommendations?: boolean;
    includeTrends?: boolean;
  };
}

export interface ReportResponse {
  reportId: string;
  status: 'generating' | 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt?: string;
  size?: number;
}

// Webhook types
export interface WebhookEvent {
  eventId: string;
  eventType: WebhookEventType;
  tenantId: string;
  timestamp: string;
  version: string;
  data: WebhookEventData;
}

export type WebhookEventType = 
  | 'scan.completed'
  | 'scan.failed'
  | 'finding.created'
  | 'finding.updated'
  | 'finding.resolved'
  | 'remediation.completed'
  | 'remediation.failed'
  | 'compliance.score_changed'
  | 'tenant.created'
  | 'tenant.updated';

export interface WebhookEventData {
  scan?: ScanJob;
  finding?: Finding;
  remediation?: RemediationJob;
  tenant?: Tenant;
  complianceScore?: {
    framework: ComplianceFramework;
    previousScore: number;
    currentScore: number;
    change: number;
  };
}

// GitHub webhook
export interface GitHubWebhookEvent {
  action: string;
  pull_request?: GitHubPullRequest;
  repository: GitHubRepository;
  sender: GitHubUser;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  head: GitHubBranch;
  base: GitHubBranch;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  draft: boolean;
  merged: boolean;
}

export interface GitHubBranch {
  ref: string;
  sha: string;
  repo: GitHubRepository;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: GitHubUser;
  private: boolean;
  html_url: string;
  clone_url: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatar_url: string;
}

// Terraform plan analysis
export interface TerraformPlanRequest {
  tenantId: string;
  repository: string;
  pullRequestNumber: number;
  planData: string; // Base64 encoded Terraform plan JSON
  options?: {
    includeRecommendations?: boolean;
    autoComment?: boolean;
    createFixPR?: boolean;
  };
}

export interface TerraformPlanResponse {
  analysisId: string;
  status: 'analyzing' | 'completed' | 'failed';
  findings: TerraformFinding[];
  summary: TerraformAnalysisSummary;
  recommendations?: TerraformRecommendation[];
}

export interface TerraformFinding {
  resourceType: string;
  resourceName: string;
  filePath?: string;
  lineNumber?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  controlId: string;
  recommendation: string;
  terraformFix?: string;
}

export interface TerraformAnalysisSummary {
  totalResources: number;
  compliantResources: number;
  nonCompliantResources: number;
  findingsBySeverity: Record<string, number>;
  frameworks: ComplianceFramework[];
}

export interface TerraformRecommendation {
  type: 'terraform_fix' | 'documentation' | 'policy_change';
  title: string;
  description: string;
  terraformCode?: string;
  documentationUrl?: string;
}

// Admin API
export interface AdminAPIRequest {
  action: 'create_tenant' | 'update_tenant' | 'delete_tenant' | 'get_usage' | 'update_settings';
  tenantId?: string;
  data: Record<string, unknown>;
}

export interface AdminAPIResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  errors?: string[];
}

// Health check
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: ServiceHealth[];
  dependencies: DependencyHealth[];
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastCheck: string;
  details?: Record<string, unknown>;
}

export interface DependencyHealth {
  name: string;
  type: 'database' | 'api' | 'queue' | 'storage';
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastCheck: string;
  details?: Record<string, unknown>;
}
