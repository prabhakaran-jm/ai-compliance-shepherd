/**
 * Terraform Plan Analyzer Service
 * 
 * Analyzes Terraform plans for compliance violations and security issues
 * before infrastructure is deployed (shift-left security).
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { TerraformPlanParser } from './TerraformPlanParser';
import { ComplianceAnalyzer } from './ComplianceAnalyzer';
import { SecurityAnalyzer } from './SecurityAnalyzer';
import { CostAnalyzer } from './CostAnalyzer';
import { FindingsProcessor } from './FindingsProcessor';
import { logger } from '../utils/logger';
import { ValidationError, NotFoundError } from '../utils/errorHandler';

export interface TerraformPlanAnalysisRequest {
  planData: string; // Base64 encoded Terraform plan JSON
  planFormat: 'json' | 'binary';
  repositoryUrl?: string;
  branch?: string;
  commitHash?: string;
  pullRequestId?: string;
  scanOptions?: {
    includeSecurityChecks: boolean;
    includeComplianceChecks: boolean;
    includeCostAnalysis: boolean;
    frameworks: string[];
    severityThreshold: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface TerraformPlanAnalysisResult {
  analysisId: string;
  status: 'completed' | 'failed' | 'in_progress';
  summary: {
    totalResources: number;
    resourcesToCreate: number;
    resourcesToUpdate: number;
    resourcesToDelete: number;
    complianceScore: number;
    securityScore: number;
    costImpact: number;
    findingsCount: number;
  };
  findings: Array<{
    id: string;
    type: 'security' | 'compliance' | 'cost' | 'best_practice';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    resource: string;
    rule: string;
    recommendation: string;
    evidence: any;
    lineNumber?: number;
    filePath?: string;
  }>;
  resources: Array<{
    address: string;
    type: string;
    name: string;
    change: 'create' | 'update' | 'delete' | 'no-op';
    configuration: any;
    complianceStatus: 'compliant' | 'non-compliant' | 'unknown';
    securityStatus: 'secure' | 'insecure' | 'unknown';
    costImpact: number;
  }>;
  metadata: {
    analyzedAt: string;
    planFormat: string;
    terraformVersion?: string;
    repositoryUrl?: string;
    branch?: string;
    commitHash?: string;
    pullRequestId?: string;
  };
}

export class TerraformPlanAnalyzerService {
  private planParser: TerraformPlanParser;
  private complianceAnalyzer: ComplianceAnalyzer;
  private securityAnalyzer: SecurityAnalyzer;
  private costAnalyzer: CostAnalyzer;
  private findingsProcessor: FindingsProcessor;

  constructor() {
    this.planParser = new TerraformPlanParser();
    this.complianceAnalyzer = new ComplianceAnalyzer();
    this.securityAnalyzer = new SecurityAnalyzer();
    this.costAnalyzer = new CostAnalyzer();
    this.findingsProcessor = new FindingsProcessor();
  }

  /**
   * Route incoming requests to appropriate handlers
   */
  async routeRequest(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    const { httpMethod, path, pathParameters, body } = event;

    logger.info('Routing Terraform plan analysis request', {
      method: httpMethod,
      path,
      pathParameters
    });

    try {
      // Extract route information
      const route = this.extractRoute(path);
      const analysisId = pathParameters?.analysisId;

      switch (httpMethod) {
        case 'POST':
          if (path.endsWith('/analyze')) {
            return await this.analyzeTerraformPlan(event, context);
          }
          break;

        case 'GET':
          if (analysisId) {
            return await this.getAnalysisResult(event, context, analysisId);
          } else if (path.endsWith('/analyses')) {
            return await this.listAnalyses(event, context);
          }
          break;

        case 'DELETE':
          if (analysisId) {
            return await this.deleteAnalysis(event, context, analysisId);
          }
          break;

        default:
          throw new ValidationError(`Method ${httpMethod} not supported for Terraform plan analysis`);
      }

      throw new NotFoundError(`Terraform plan analysis endpoint not found: ${path}`);

    } catch (error) {
      logger.error('Terraform plan analysis routing failed', {
        method: httpMethod,
        path,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Analyze Terraform plan for compliance and security issues
   */
  private async analyzeTerraformPlan(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    try {
      // Parse and validate request body
      const requestBody = JSON.parse(body || '{}');
      const validatedRequest = this.validateAnalysisRequest(requestBody);

      // Extract tenant information from auth context
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';
      const userId = event.requestContext.authorizer?.userId || 'unknown-user';

      logger.info('Starting Terraform plan analysis', {
        tenantId,
        userId,
        planFormat: validatedRequest.planFormat,
        repositoryUrl: validatedRequest.repositoryUrl,
        branch: validatedRequest.branch,
        commitHash: validatedRequest.commitHash,
        pullRequestId: validatedRequest.pullRequestId
      });

      // Generate analysis ID
      const analysisId = this.generateAnalysisId();

      // Parse Terraform plan
      const planData = await this.planParser.parsePlan(validatedRequest.planData, validatedRequest.planFormat);

      // Perform analysis
      const analysisResult = await this.performAnalysis(planData, validatedRequest, analysisId);

      // Process findings
      const processedFindings = await this.findingsProcessor.processFindings(
        analysisResult.findings,
        tenantId,
        userId,
        analysisId
      );

      // Store analysis result
      await this.storeAnalysisResult(analysisResult, tenantId, userId);

      logger.info('Terraform plan analysis completed successfully', {
        analysisId,
        tenantId,
        userId,
        totalResources: analysisResult.summary.totalResources,
        findingsCount: analysisResult.summary.findingsCount,
        complianceScore: analysisResult.summary.complianceScore,
        securityScore: analysisResult.summary.securityScore
      });

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          data: {
            analysisId,
            status: 'completed',
            summary: analysisResult.summary,
            findingsCount: analysisResult.findingsCount,
            complianceScore: analysisResult.summary.complianceScore,
            securityScore: analysisResult.summary.securityScore,
            costImpact: analysisResult.summary.costImpact,
            analyzedAt: analysisResult.metadata.analyzedAt
          }
        })
      };

    } catch (error) {
      if (error instanceof ValidationError) {
        return {
          statusCode: 400,
          headers: this.getCorsHeaders(event),
          body: JSON.stringify({
            success: false,
            error: 'Validation Error',
            message: error.message,
            details: error.details
          })
        };
      }

      throw error;
    }
  }

  /**
   * Get analysis result
   */
  private async getAnalysisResult(
    event: APIGatewayProxyEvent,
    context: Context,
    analysisId: string
  ): Promise<APIGatewayProxyResult> {
    try {
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';

      logger.info('Getting Terraform plan analysis result', {
        analysisId,
        tenantId
      });

      // Get analysis result from storage
      const analysisResult = await this.getAnalysisResultFromStorage(analysisId, tenantId);

      if (!analysisResult) {
        return {
          statusCode: 404,
          headers: this.getCorsHeaders(event),
          body: JSON.stringify({
            success: false,
            error: 'Analysis not found',
            message: `Analysis ${analysisId} not found`
          })
        };
      }

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          data: analysisResult
        })
      };

    } catch (error) {
      logger.error('Failed to get analysis result', {
        analysisId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * List analyses
   */
  private async listAnalyses(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    try {
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';
      const queryParams = event.queryStringParameters || {};
      
      const limit = parseInt(queryParams.limit || '10');
      const offset = parseInt(queryParams.offset || '0');
      const status = queryParams.status;
      const repositoryUrl = queryParams.repositoryUrl;

      logger.info('Listing Terraform plan analyses', {
        tenantId,
        limit,
        offset,
        status,
        repositoryUrl
      });

      // List analyses from storage
      const analyses = await this.listAnalysesFromStorage({
        tenantId,
        limit,
        offset,
        status,
        repositoryUrl
      });

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          data: {
            analyses: analyses.items,
            pagination: {
              limit,
              offset,
              total: analyses.total,
              hasMore: analyses.hasMore
            }
          }
        })
      };

    } catch (error) {
      logger.error('Failed to list analyses', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Delete analysis
   */
  private async deleteAnalysis(
    event: APIGatewayProxyEvent,
    context: Context,
    analysisId: string
  ): Promise<APIGatewayProxyResult> {
    try {
      const tenantId = event.requestContext.authorizer?.tenantId || 'default-tenant';

      logger.info('Deleting Terraform plan analysis', {
        analysisId,
        tenantId
      });

      // Delete analysis from storage
      const deleted = await this.deleteAnalysisFromStorage(analysisId, tenantId);

      if (!deleted) {
        return {
          statusCode: 404,
          headers: this.getCorsHeaders(event),
          body: JSON.stringify({
            success: false,
            error: 'Analysis not found',
            message: `Analysis ${analysisId} not found`
          })
        };
      }

      return {
        statusCode: 200,
        headers: this.getCorsHeaders(event),
        body: JSON.stringify({
          success: true,
          message: 'Analysis deleted successfully'
        })
      };

    } catch (error) {
      logger.error('Failed to delete analysis', {
        analysisId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Perform comprehensive analysis of Terraform plan
   */
  private async performAnalysis(
    planData: any,
    request: TerraformPlanAnalysisRequest,
    analysisId: string
  ): Promise<TerraformPlanAnalysisResult> {
    logger.info('Performing comprehensive Terraform plan analysis', {
      analysisId,
      totalResources: planData.resource_changes?.length || 0
    });

    const analysisResult: TerraformPlanAnalysisResult = {
      analysisId,
      status: 'in_progress',
      summary: {
        totalResources: 0,
        resourcesToCreate: 0,
        resourcesToUpdate: 0,
        resourcesToDelete: 0,
        complianceScore: 0,
        securityScore: 0,
        costImpact: 0,
        findingsCount: 0
      },
      findings: [],
      resources: [],
      metadata: {
        analyzedAt: new Date().toISOString(),
        planFormat: request.planFormat,
        terraformVersion: planData.terraform_version,
        repositoryUrl: request.repositoryUrl,
        branch: request.branch,
        commitHash: request.commitHash,
        pullRequestId: request.pullRequestId
      }
    };

    try {
      // Analyze resources
      const resourceChanges = planData.resource_changes || [];
      analysisResult.summary.totalResources = resourceChanges.length;

      // Count resource changes
      resourceChanges.forEach((change: any) => {
        if (change.change?.actions?.includes('create')) {
          analysisResult.summary.resourcesToCreate++;
        }
        if (change.change?.actions?.includes('update')) {
          analysisResult.summary.resourcesToUpdate++;
        }
        if (change.change?.actions?.includes('delete')) {
          analysisResult.summary.resourcesToDelete++;
        }
      });

      // Perform compliance analysis
      if (request.scanOptions?.includeComplianceChecks !== false) {
        const complianceResults = await this.complianceAnalyzer.analyzePlan(planData, request.scanOptions);
        analysisResult.findings.push(...complianceResults.findings);
        analysisResult.summary.complianceScore = complianceResults.score;
      }

      // Perform security analysis
      if (request.scanOptions?.includeSecurityChecks !== false) {
        const securityResults = await this.securityAnalyzer.analyzePlan(planData, request.scanOptions);
        analysisResult.findings.push(...securityResults.findings);
        analysisResult.summary.securityScore = securityResults.score;
      }

      // Perform cost analysis
      if (request.scanOptions?.includeCostAnalysis !== false) {
        const costResults = await this.costAnalyzer.analyzePlan(planData, request.scanOptions);
        analysisResult.findings.push(...costResults.findings);
        analysisResult.summary.costImpact = costResults.totalCost;
      }

      // Process resources
      analysisResult.resources = resourceChanges.map((change: any) => ({
        address: change.address,
        type: change.type,
        name: change.name,
        change: this.determineChangeType(change.change?.actions),
        configuration: change.change?.after || change.change?.before,
        complianceStatus: 'unknown' as const,
        securityStatus: 'unknown' as const,
        costImpact: 0
      }));

      // Update summary
      analysisResult.summary.findingsCount = analysisResult.findings.length;
      analysisResult.status = 'completed';

      logger.info('Terraform plan analysis completed', {
        analysisId,
        totalResources: analysisResult.summary.totalResources,
        findingsCount: analysisResult.summary.findingsCount,
        complianceScore: analysisResult.summary.complianceScore,
        securityScore: analysisResult.summary.securityScore,
        costImpact: analysisResult.summary.costImpact
      });

      return analysisResult;

    } catch (error) {
      logger.error('Terraform plan analysis failed', {
        analysisId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      analysisResult.status = 'failed';
      analysisResult.findings.push({
        id: 'analysis-error',
        type: 'compliance',
        severity: 'high',
        title: 'Analysis Failed',
        description: `Terraform plan analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        resource: 'plan',
        rule: 'analysis-error',
        recommendation: 'Check plan format and try again',
        evidence: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      return analysisResult;
    }
  }

  /**
   * Determine change type from actions
   */
  private determineChangeType(actions: string[]): 'create' | 'update' | 'delete' | 'no-op' {
    if (actions.includes('create') && actions.includes('delete')) {
      return 'update';
    }
    if (actions.includes('create')) {
      return 'create';
    }
    if (actions.includes('delete')) {
      return 'delete';
    }
    return 'no-op';
  }

  /**
   * Validate analysis request
   */
  private validateAnalysisRequest(body: any): TerraformPlanAnalysisRequest {
    if (!body.planData || typeof body.planData !== 'string') {
      throw new ValidationError('planData is required and must be a string');
    }

    if (!body.planFormat || !['json', 'binary'].includes(body.planFormat)) {
      throw new ValidationError('planFormat must be one of: json, binary');
    }

    return {
      planData: body.planData,
      planFormat: body.planFormat,
      repositoryUrl: body.repositoryUrl,
      branch: body.branch,
      commitHash: body.commitHash,
      pullRequestId: body.pullRequestId,
      scanOptions: body.scanOptions || {
        includeSecurityChecks: true,
        includeComplianceChecks: true,
        includeCostAnalysis: true,
        frameworks: ['SOC2', 'HIPAA', 'GDPR'],
        severityThreshold: 'medium'
      }
    };
  }

  /**
   * Generate unique analysis ID
   */
  private generateAnalysisId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `tf-analysis-${timestamp}-${random}`;
  }

  /**
   * Extract route from path
   */
  private extractRoute(path: string): string {
    const segments = path.replace(/^\//, '').split('/');
    return segments[0] || 'analyze';
  }

  /**
   * Get CORS headers for response
   */
  private getCorsHeaders(event: APIGatewayProxyEvent): Record<string, string> {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
    const origin = event.headers.Origin || event.headers.origin;
    const allowedOrigin = allowedOrigins.includes('*') || allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    return {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Tenant-ID',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Credentials': 'true'
    };
  }

  /**
   * Store analysis result (placeholder - implement with actual storage)
   */
  private async storeAnalysisResult(result: TerraformPlanAnalysisResult, tenantId: string, userId: string): Promise<void> {
    // TODO: Implement with actual storage (DynamoDB, S3, etc.)
    logger.info('Storing analysis result', {
      analysisId: result.analysisId,
      tenantId,
      userId
    });
  }

  /**
   * Get analysis result from storage (placeholder - implement with actual storage)
   */
  private async getAnalysisResultFromStorage(analysisId: string, tenantId: string): Promise<TerraformPlanAnalysisResult | null> {
    // TODO: Implement with actual storage
    logger.info('Getting analysis result from storage', {
      analysisId,
      tenantId
    });
    return null;
  }

  /**
   * List analyses from storage (placeholder - implement with actual storage)
   */
  private async listAnalysesFromStorage(options: any): Promise<{ items: any[]; total: number; hasMore: boolean }> {
    // TODO: Implement with actual storage
    logger.info('Listing analyses from storage', options);
    return { items: [], total: 0, hasMore: false };
  }

  /**
   * Delete analysis from storage (placeholder - implement with actual storage)
   */
  private async deleteAnalysisFromStorage(analysisId: string, tenantId: string): Promise<boolean> {
    // TODO: Implement with actual storage
    logger.info('Deleting analysis from storage', {
      analysisId,
      tenantId
    });
    return false;
  }
}
