/**
 * Base repository class for DynamoDB operations
 */

import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  PaginationParams,
  PaginatedResponse,
  BaseEntity,
} from '@compliance-shepherd/shared';

export interface RepositoryConfig {
  tableName: string;
  region?: string;
  endpoint?: string;
  maxRetries?: number;
  retryDelayOptions?: {
    base: number;
  };
}

export interface QueryOptions {
  indexName?: string;
  filterExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: Record<string, any>;
  scanIndexForward?: boolean;
  limit?: number;
  exclusiveStartKey?: DynamoDB.DocumentClient.Key;
}

export interface PutOptions {
  conditionExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: Record<string, any>;
  returnValues?: 'NONE' | 'ALL_OLD' | 'UPDATED_OLD' | 'ALL_NEW' | 'UPDATED_NEW';
}

export interface UpdateOptions {
  conditionExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: Record<string, any>;
  returnValues?: 'NONE' | 'ALL_OLD' | 'UPDATED_OLD' | 'ALL_NEW' | 'UPDATED_NEW';
}

export interface DeleteOptions {
  conditionExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: Record<string, any>;
  returnValues?: 'NONE' | 'ALL_OLD' | 'UPDATED_OLD' | 'ALL_NEW' | 'UPDATED_NEW';
}

export abstract class BaseRepository<T extends BaseEntity> {
  protected dynamoDB: DynamoDB.DocumentClient;
  protected tableName: string;

  constructor(config: RepositoryConfig) {
    this.tableName = config.tableName;
    
    this.dynamoDB = new DynamoDB.DocumentClient({
      region: config.region || process.env.AWS_REGION || 'us-east-1',
      endpoint: config.endpoint,
      maxRetries: config.maxRetries || 3,
      retryDelayOptions: config.retryDelayOptions || { base: 300 },
    });
  }

  /**
   * Create a new item
   */
  async create(item: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now = new Date().toISOString();
    const newItem: T = {
      ...item,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    } as T;

    const params: DynamoDB.DocumentClient.PutItemInput = {
      TableName: this.tableName,
      Item: newItem,
      ConditionExpression: 'attribute_not_exists(id)',
    };

    try {
      await this.dynamoDB.put(params).promise();
      return newItem;
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Item with id ${newItem.id} already exists`);
      }
      throw this.handleError(error, 'create');
    }
  }

  /**
   * Get an item by ID
   */
  async getById(id: string, tenantId: string): Promise<T | null> {
    const params: DynamoDB.DocumentClient.GetItemInput = {
      TableName: this.tableName,
      Key: {
        id,
        tenantId,
      },
    };

    try {
      const result = await this.dynamoDB.get(params).promise();
      return result.Item as T || null;
    } catch (error: any) {
      throw this.handleError(error, 'getById');
    }
  }

  /**
   * Update an item
   */
  async update(
    id: string,
    tenantId: string,
    updates: Partial<Omit<T, 'id' | 'tenantId' | 'createdAt'>>,
    options: UpdateOptions = {}
  ): Promise<T> {
    const now = new Date().toISOString();
    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {
      '#updatedAt': 'updatedAt',
    };
    const expressionAttributeValues: Record<string, any> = {
      ':updatedAt': now,
    };

    // Build update expression
    Object.keys(updates).forEach((key, index) => {
      const attributeName = `#attr${index}`;
      const attributeValue = `:val${index}`;
      
      updateExpression.push(`${attributeName} = ${attributeValue}`);
      expressionAttributeNames[attributeName] = key;
      expressionAttributeValues[attributeValue] = (updates as any)[key];
    });

    updateExpression.push('#updatedAt = :updatedAt');

    const params: DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: this.tableName,
      Key: {
        id,
        tenantId,
      },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: {
        ...expressionAttributeNames,
        ...options.expressionAttributeNames,
      },
      ExpressionAttributeValues: {
        ...expressionAttributeValues,
        ...options.expressionAttributeValues,
      },
      ConditionExpression: options.conditionExpression || 'attribute_exists(id)',
      ReturnValues: options.returnValues || 'ALL_NEW',
    };

    try {
      const result = await this.dynamoDB.update(params).promise();
      return result.Attributes as T;
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Item with id ${id} not found or condition not met`);
      }
      throw this.handleError(error, 'update');
    }
  }

  /**
   * Delete an item
   */
  async delete(
    id: string,
    tenantId: string,
    options: DeleteOptions = {}
  ): Promise<void> {
    const params: DynamoDB.DocumentClient.DeleteItemInput = {
      TableName: this.tableName,
      Key: {
        id,
        tenantId,
      },
      ConditionExpression: options.conditionExpression || 'attribute_exists(id)',
      ExpressionAttributeNames: options.expressionAttributeNames,
      ExpressionAttributeValues: options.expressionAttributeValues,
      ReturnValues: options.returnValues || 'NONE',
    };

    try {
      await this.dynamoDB.delete(params).promise();
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Item with id ${id} not found or condition not met`);
      }
      throw this.handleError(error, 'delete');
    }
  }

  /**
   * Query items with pagination
   */
  async query(
    keyConditionExpression: string,
    options: QueryOptions = {},
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<T>> {
    const params: DynamoDB.DocumentClient.QueryInput = {
      TableName: this.tableName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeNames: options.expressionAttributeNames,
      ExpressionAttributeValues: options.expressionAttributeValues,
      FilterExpression: options.filterExpression,
      IndexName: options.indexName,
      ScanIndexForward: options.scanIndexForward,
      Limit: pagination.limit || options.limit || 100,
      ExclusiveStartKey: options.exclusiveStartKey,
    };

    try {
      const result = await this.dynamoDB.query(params).promise();
      
      return {
        items: result.Items as T[] || [],
        nextToken: result.LastEvaluatedKey ? 
          Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64') : 
          undefined,
        totalCount: result.Count,
      };
    } catch (error: any) {
      throw this.handleError(error, 'query');
    }
  }

  /**
   * Scan items with pagination
   */
  async scan(
    options: QueryOptions = {},
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<T>> {
    const params: DynamoDB.DocumentClient.ScanInput = {
      TableName: this.tableName,
      FilterExpression: options.filterExpression,
      ExpressionAttributeNames: options.expressionAttributeNames,
      ExpressionAttributeValues: options.expressionAttributeValues,
      IndexName: options.indexName,
      Limit: pagination.limit || options.limit || 100,
      ExclusiveStartKey: options.exclusiveStartKey,
    };

    try {
      const result = await this.dynamoDB.scan(params).promise();
      
      return {
        items: result.Items as T[] || [],
        nextToken: result.LastEvaluatedKey ? 
          Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64') : 
          undefined,
        totalCount: result.Count,
      };
    } catch (error: any) {
      throw this.handleError(error, 'scan');
    }
  }

  /**
   * Batch get items
   */
  async batchGet(keys: Array<{ id: string; tenantId: string }>): Promise<T[]> {
    const params: DynamoDB.DocumentClient.BatchGetItemInput = {
      RequestItems: {
        [this.tableName]: {
          Keys: keys,
        },
      },
    };

    try {
      const result = await this.dynamoDB.batchGet(params).promise();
      return result.Responses?.[this.tableName] as T[] || [];
    } catch (error: any) {
      throw this.handleError(error, 'batchGet');
    }
  }

  /**
   * Batch write items
   */
  async batchWrite(
    items: T[],
    operation: 'put' | 'delete' = 'put'
  ): Promise<void> {
    const requests: DynamoDB.DocumentClient.WriteRequest[] = items.map(item => {
      if (operation === 'put') {
        return {
          PutRequest: {
            Item: item,
          },
        };
      } else {
        return {
          DeleteRequest: {
            Key: {
              id: item.id,
              tenantId: item.tenantId,
            },
          },
        };
      }
    });

    // DynamoDB batch write limit is 25 items
    const chunks = this.chunkArray(requests, 25);

    for (const chunk of chunks) {
      const params: DynamoDB.DocumentClient.BatchWriteItemInput = {
        RequestItems: {
          [this.tableName]: chunk,
        },
      };

      try {
        await this.dynamoDB.batchWrite(params).promise();
      } catch (error: any) {
        throw this.handleError(error, 'batchWrite');
      }
    }
  }

  /**
   * Get item count
   */
  async count(
    keyConditionExpression?: string,
    options: QueryOptions = {}
  ): Promise<number> {
    const params: DynamoDB.DocumentClient.QueryInput | DynamoDB.DocumentClient.ScanInput = {
      TableName: this.tableName,
      Select: 'COUNT',
      FilterExpression: options.filterExpression,
      ExpressionAttributeNames: options.expressionAttributeNames,
      ExpressionAttributeValues: options.expressionAttributeValues,
      IndexName: options.indexName,
    };

    if (keyConditionExpression) {
      (params as DynamoDB.DocumentClient.QueryInput).KeyConditionExpression = keyConditionExpression;
    }

    try {
      let totalCount = 0;
      let lastEvaluatedKey: DynamoDB.DocumentClient.Key | undefined;

      do {
        if (lastEvaluatedKey) {
          params.ExclusiveStartKey = lastEvaluatedKey;
        }

        const result = keyConditionExpression ? 
          await this.dynamoDB.query(params as DynamoDB.DocumentClient.QueryInput).promise() :
          await this.dynamoDB.scan(params as DynamoDB.DocumentClient.ScanInput).promise();

        totalCount += result.Count || 0;
        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      return totalCount;
    } catch (error: any) {
      throw this.handleError(error, 'count');
    }
  }

  /**
   * Check if item exists
   */
  async exists(id: string, tenantId: string): Promise<boolean> {
    const params: DynamoDB.DocumentClient.GetItemInput = {
      TableName: this.tableName,
      Key: {
        id,
        tenantId,
      },
      ProjectionExpression: 'id',
    };

    try {
      const result = await this.dynamoDB.get(params).promise();
      return !!result.Item;
    } catch (error: any) {
      throw this.handleError(error, 'exists');
    }
  }

  /**
   * Handle DynamoDB errors
   */
  protected handleError(error: any, operation: string): Error {
    const errorMessage = `DynamoDB ${operation} operation failed: ${error.message}`;
    
    if (error.code === 'ResourceNotFoundException') {
      return new Error(`Table ${this.tableName} not found`);
    } else if (error.code === 'ProvisionedThroughputExceededException') {
      return new Error('Provisioned throughput exceeded. Please retry later.');
    } else if (error.code === 'ThrottlingException') {
      return new Error('Request was throttled. Please retry later.');
    } else if (error.code === 'ValidationException') {
      return new Error(`Validation error: ${error.message}`);
    } else if (error.code === 'AccessDeniedException') {
      return new Error('Access denied. Check IAM permissions.');
    }

    return new Error(errorMessage);
  }

  /**
   * Utility function to chunk array
   */
  protected chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Parse pagination token
   */
  protected parsePaginationToken(token?: string): DynamoDB.DocumentClient.Key | undefined {
    if (!token) return undefined;
    
    try {
      return JSON.parse(Buffer.from(token, 'base64').toString());
    } catch (error) {
      throw new Error('Invalid pagination token');
    }
  }

  /**
   * Generate pagination token
   */
  protected generatePaginationToken(key?: DynamoDB.DocumentClient.Key): string | undefined {
    if (!key) return undefined;
    
    return Buffer.from(JSON.stringify(key)).toString('base64');
  }
}
