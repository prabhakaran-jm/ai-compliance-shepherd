/**
 * Lambda Resource Discovery Service
 * 
 * Discovers Lambda functions for compliance scanning.
 */

import { Lambda } from 'aws-sdk';
import {
  AWSResource,
  ResourceConfig,
  Region
} from '@compliance-shepherd/shared';
import { logger } from '../../utils/logger';

export class LambdaResourceDiscovery {
  private lambda: Lambda;

  constructor() {
    this.lambda = new Lambda();
  }

  /**
   * Discover Lambda resources in a specific region
   */
  async discoverRegionalResources(accountId: string, region: Region): Promise<AWSResource[]> {
    const resources: AWSResource[] = [];

    try {
      // Set region for Lambda client
      this.lambda = new Lambda({ region });

      // List all functions
      const functions = await this.lambda.listFunctions().promise();

      for (const func of functions.Functions || []) {
        const resource: AWSResource = {
          id: func.FunctionName!,
          type: 'lambda_function',
          arn: func.FunctionArn!,
          name: func.FunctionName!,
          accountId,
          region,
          service: 'lambda',
          resourceType: 'function',
          tags: await this.getFunctionTags(func.FunctionArn!),
          metadata: {
            runtime: func.Runtime,
            role: func.Role,
            handler: func.Handler,
            codeSize: func.CodeSize,
            description: func.Description,
            timeout: func.Timeout,
            memorySize: func.MemorySize,
            lastModified: func.LastModified,
            codeSha256: func.CodeSha256,
            version: func.Version,
            vpcConfig: func.VpcConfig,
            deadLetterConfig: func.DeadLetterConfig,
            environment: func.Environment,
            kmsKeyArn: func.KMSKeyArn,
            tracingConfig: func.TracingConfig,
            masterArn: func.MasterArn,
            revisionId: func.RevisionId,
            layers: func.Layers,
            state: func.State,
            stateReason: func.StateReason,
            stateReasonCode: func.StateReasonCode,
            lastUpdateStatus: func.LastUpdateStatus,
            lastUpdateStatusReason: func.LastUpdateStatusReason,
            lastUpdateStatusReasonCode: func.LastUpdateStatusReasonCode,
            packageType: func.PackageType,
            imageConfigResponse: func.ImageConfigResponse,
            signingProfileVersionArn: func.SigningProfileVersionArn,
            signingJobArn: func.SigningJobArn,
            architectures: func.Architectures,
            ephemeralStorage: func.EphemeralStorage,
            snapStart: func.SnapStart,
            runtimeVersionConfig: func.RuntimeVersionConfig,
            loggingConfig: func.LoggingConfig
          }
        };

        resources.push(resource);
      }

      logger.info('Lambda resource discovery completed', {
        accountId,
        region,
        functionCount: resources.length
      });

      return resources;

    } catch (error) {
      logger.error('Lambda resource discovery failed', {
        accountId,
        region,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get resource configuration for Lambda function
   */
  async getResourceConfiguration(resource: AWSResource): Promise<ResourceConfig> {
    const functionName = resource.name;
    const config: ResourceConfig = {
      resourceId: resource.id,
      resourceType: resource.type,
      configuration: {}
    };

    try {
      // Get function details
      const functionDetails = await this.lambda.getFunction({ FunctionName: functionName }).promise();
      config.configuration.function = functionDetails;

      // Get function configuration
      const functionConfig = await this.lambda.getFunctionConfiguration({ FunctionName: functionName }).promise();
      config.configuration.configuration = functionConfig;

      // Get function policy
      try {
        const policy = await this.lambda.getPolicy({ FunctionName: functionName }).promise();
        config.configuration.policy = policy.Policy;
      } catch (error) {
        config.configuration.policy = null;
      }

      // Get function event source mappings
      try {
        const eventSourceMappings = await this.lambda.listEventSourceMappings({ FunctionName: functionName }).promise();
        config.configuration.eventSourceMappings = eventSourceMappings.EventSourceMappings;
      } catch (error) {
        config.configuration.eventSourceMappings = null;
      }

      // Get function aliases
      try {
        const aliases = await this.lambda.listAliases({ FunctionName: functionName }).promise();
        config.configuration.aliases = aliases.Aliases;
      } catch (error) {
        config.configuration.aliases = null;
      }

      // Get function versions
      try {
        const versions = await this.lambda.listVersionsByFunction({ FunctionName: functionName }).promise();
        config.configuration.versions = versions.Versions;
      } catch (error) {
        config.configuration.versions = null;
      }

      // Get function layers
      try {
        const layers = await this.lambda.listLayers().promise();
        config.configuration.availableLayers = layers.Layers;
      } catch (error) {
        config.configuration.availableLayers = null;
      }

      // Get function concurrency
      try {
        const concurrency = await this.lambda.getFunctionConcurrency({ FunctionName: functionName }).promise();
        config.configuration.concurrency = concurrency;
      } catch (error) {
        config.configuration.concurrency = null;
      }

      // Get function URL config
      try {
        const urlConfig = await this.lambda.getFunctionUrlConfig({ FunctionName: functionName }).promise();
        config.configuration.urlConfig = urlConfig;
      } catch (error) {
        config.configuration.urlConfig = null;
      }

      logger.info('Lambda function configuration retrieved', {
        functionName,
        hasPolicy: !!config.configuration.policy,
        hasEventSourceMappings: !!config.configuration.eventSourceMappings
      });

      return config;

    } catch (error) {
      logger.error('Failed to get Lambda function configuration', {
        functionName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get function tags
   */
  private async getFunctionTags(functionArn: string): Promise<Record<string, string>> {
    try {
      const tags = await this.lambda.listTags({ Resource: functionArn }).promise();
      return tags.Tags || {};
    } catch (error) {
      return {};
    }
  }
}
