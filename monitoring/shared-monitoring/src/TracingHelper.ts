import * as AWSXRay from 'aws-xray-sdk-core';
import { v4 as uuidv4 } from 'uuid';

export interface TraceContext {
  traceId: string;
  segmentId: string;
  correlationId: string;
  tenantId?: string;
  userId?: string;
  operation?: string;
}

export interface SubsegmentOptions {
  name: string;
  namespace?: string;
  metadata?: Record<string, any>;
  annotations?: Record<string, string | number | boolean>;
}

/**
 * X-Ray tracing helper for consistent distributed tracing across all services
 */
export class TracingHelper {
  private static instance: TracingHelper;
  private isEnabled: boolean;

  private constructor() {
    this.isEnabled = process.env.XRAY_TRACING_ENABLED !== 'false';
    
    if (this.isEnabled) {
      // Configure X-Ray
      AWSXRay.config([
        AWSXRay.plugins.ECSPlugin,
        AWSXRay.plugins.EC2Plugin,
        AWSXRay.plugins.ElasticBeanstalkPlugin
      ]);

      // Set sampling rules
      AWSXRay.middleware.setSamplingRules({
        version: 2,
        default: {
          fixed_target: 1,
          rate: 0.1
        },
        rules: [
          {
            description: 'High priority operations',
            service_name: 'ai-compliance-shepherd-*',
            http_method: '*',
            url_path: '/scan*',
            fixed_target: 2,
            rate: 0.5
          },
          {
            description: 'Security operations',
            service_name: 'ai-compliance-shepherd-*',
            http_method: '*',
            url_path: '/security*',
            fixed_target: 2,
            rate: 1.0
          },
          {
            description: 'Health checks',
            service_name: 'ai-compliance-shepherd-*',
            http_method: 'GET',
            url_path: '/health',
            fixed_target: 0,
            rate: 0.01
          }
        ]
      });
    }
  }

  public static getInstance(): TracingHelper {
    if (!TracingHelper.instance) {
      TracingHelper.instance = new TracingHelper();
    }
    return TracingHelper.instance;
  }

  /**
   * Get current trace context
   */
  getCurrentTraceContext(): TraceContext | null {
    if (!this.isEnabled) {
      return null;
    }

    const segment = AWSXRay.getSegment();
    if (!segment) {
      return null;
    }

    return {
      traceId: segment.trace_id,
      segmentId: segment.id,
      correlationId: segment.annotations?.correlationId as string || uuidv4(),
      tenantId: segment.annotations?.tenantId as string,
      userId: segment.annotations?.userId as string,
      operation: segment.annotations?.operation as string
    };
  }

  /**
   * Create a new subsegment for tracing operations
   */
  async traceAsyncOperation<T>(
    options: SubsegmentOptions,
    operation: () => Promise<T>
  ): Promise<T> {
    if (!this.isEnabled) {
      return await operation();
    }

    return new Promise((resolve, reject) => {
      AWSXRay.captureAsyncFunc(options.name, async (subsegment) => {
        try {
          // Add namespace
          if (options.namespace) {
            subsegment.namespace = options.namespace;
          }

          // Add annotations (indexed for filtering)
          if (options.annotations) {
            Object.entries(options.annotations).forEach(([key, value]) => {
              subsegment.addAnnotation(key, value);
            });
          }

          // Add metadata (not indexed, for detailed information)
          if (options.metadata) {
            Object.entries(options.metadata).forEach(([key, value]) => {
              subsegment.addMetadata(key, value);
            });
          }

          // Execute the operation
          const result = await operation();

          // Mark as successful
          subsegment.close();
          resolve(result);

        } catch (error) {
          // Add error information
          subsegment.addError(error as Error);
          subsegment.close(error as Error);
          reject(error);
        }
      });
    });
  }

  /**
   * Trace a synchronous operation
   */
  traceSyncOperation<T>(
    options: SubsegmentOptions,
    operation: () => T
  ): T {
    if (!this.isEnabled) {
      return operation();
    }

    return AWSXRay.captureFunc(options.name, (subsegment) => {
      try {
        // Add namespace
        if (options.namespace) {
          subsegment.namespace = options.namespace;
        }

        // Add annotations
        if (options.annotations) {
          Object.entries(options.annotations).forEach(([key, value]) => {
            subsegment.addAnnotation(key, value);
          });
        }

        // Add metadata
        if (options.metadata) {
          Object.entries(options.metadata).forEach(([key, value]) => {
            subsegment.addMetadata(key, value);
          });
        }

        // Execute the operation
        const result = operation();

        // Mark as successful
        subsegment.close();
        return result;

      } catch (error) {
        // Add error information
        subsegment.addError(error as Error);
        subsegment.close(error as Error);
        throw error;
      }
    });
  }

  /**
   * Add annotation to current segment
   */
  addAnnotation(key: string, value: string | number | boolean): void {
    if (!this.isEnabled) {
      return;
    }

    const segment = AWSXRay.getSegment();
    if (segment) {
      segment.addAnnotation(key, value);
    }
  }

  /**
   * Add metadata to current segment
   */
  addMetadata(key: string, value: any, namespace?: string): void {
    if (!this.isEnabled) {
      return;
    }

    const segment = AWSXRay.getSegment();
    if (segment) {
      if (namespace) {
        segment.addMetadata(key, value, namespace);
      } else {
        segment.addMetadata(key, value);
      }
    }
  }

  /**
   * Add error to current segment
   */
  addError(error: Error, remote: boolean = false): void {
    if (!this.isEnabled) {
      return;
    }

    const segment = AWSXRay.getSegment();
    if (segment) {
      segment.addError(error, remote);
    }
  }

  /**
   * Set user information on current segment
   */
  setUser(userId: string, tenantId?: string): void {
    if (!this.isEnabled) {
      return;
    }

    this.addAnnotation('userId', userId);
    if (tenantId) {
      this.addAnnotation('tenantId', tenantId);
    }
  }

  /**
   * Set operation information on current segment
   */
  setOperation(operation: string, correlationId?: string): void {
    if (!this.isEnabled) {
      return;
    }

    this.addAnnotation('operation', operation);
    if (correlationId) {
      this.addAnnotation('correlationId', correlationId);
    }
  }

  /**
   * Trace AWS SDK calls
   */
  captureAWS<T>(awsService: T): T {
    if (!this.isEnabled) {
      return awsService;
    }

    return AWSXRay.captureAWS(awsService);
  }

  /**
   * Trace HTTP calls
   */
  captureHTTPs(module: any, downstreamXRayEnabled?: boolean): any {
    if (!this.isEnabled) {
      return module;
    }

    return AWSXRay.captureHTTPs(module, downstreamXRayEnabled);
  }

  /**
   * Create a custom segment
   */
  async createCustomSegment<T>(
    name: string,
    operation: (segment: any) => Promise<T>,
    traceId?: string
  ): Promise<T> {
    if (!this.isEnabled) {
      // Execute operation without tracing
      return await operation(null);
    }

    return new Promise((resolve, reject) => {
      const segment = new AWSXRay.Segment(name, traceId);
      
      AWSXRay.setSegment(segment);

      operation(segment)
        .then((result) => {
          segment.close();
          resolve(result);
        })
        .catch((error) => {
          segment.addError(error);
          segment.close(error);
          reject(error);
        });
    });
  }

  /**
   * Get trace header for downstream services
   */
  getTraceHeader(): string | null {
    if (!this.isEnabled) {
      return null;
    }

    const segment = AWSXRay.getSegment();
    if (!segment) {
      return null;
    }

    return `Root=${segment.trace_id};Parent=${segment.id};Sampled=1`;
  }

  /**
   * Parse trace header from upstream service
   */
  parseTraceHeader(traceHeader: string): {
    traceId: string;
    parentId: string;
    sampled: boolean;
  } | null {
    if (!this.isEnabled || !traceHeader) {
      return null;
    }

    try {
      const parts = traceHeader.split(';');
      const traceId = parts.find(p => p.startsWith('Root='))?.split('=')[1];
      const parentId = parts.find(p => p.startsWith('Parent='))?.split('=')[1];
      const sampled = parts.find(p => p.startsWith('Sampled='))?.split('=')[1] === '1';

      if (traceId && parentId) {
        return { traceId, parentId, sampled };
      }
    } catch (error) {
      // Ignore parsing errors
    }

    return null;
  }

  /**
   * Check if tracing is enabled
   */
  isTracingEnabled(): boolean {
    return this.isEnabled;
  }
}

// Export singleton instance
export const tracingHelper = TracingHelper.getInstance();

// Export utility functions
export const traceAsyncOperation = <T>(
  options: SubsegmentOptions,
  operation: () => Promise<T>
): Promise<T> => tracingHelper.traceAsyncOperation(options, operation);

export const traceSyncOperation = <T>(
  options: SubsegmentOptions,
  operation: () => T
): T => tracingHelper.traceSyncOperation(options, operation);

export const addAnnotation = (key: string, value: string | number | boolean): void =>
  tracingHelper.addAnnotation(key, value);

export const addMetadata = (key: string, value: any, namespace?: string): void =>
  tracingHelper.addMetadata(key, value, namespace);

export const addError = (error: Error, remote: boolean = false): void =>
  tracingHelper.addError(error, remote);

export const setUser = (userId: string, tenantId?: string): void =>
  tracingHelper.setUser(userId, tenantId);

export const setOperation = (operation: string, correlationId?: string): void =>
  tracingHelper.setOperation(operation, correlationId);

export const captureAWS = <T>(awsService: T): T =>
  tracingHelper.captureAWS(awsService);

export const getCurrentTraceContext = (): TraceContext | null =>
  tracingHelper.getCurrentTraceContext();

export const getTraceHeader = (): string | null =>
  tracingHelper.getTraceHeader();
