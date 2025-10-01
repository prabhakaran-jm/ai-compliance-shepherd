/**
 * DynamoDB helper utilities
 */

import { DynamoDB } from 'aws-sdk';

export interface DynamoDBConfig {
  region?: string;
  endpoint?: string;
  maxRetries?: number;
  retryDelayOptions?: {
    base: number;
  };
}

export class DynamoDBHelper {
  private static instance: DynamoDB.DocumentClient;

  static getInstance(config: DynamoDBConfig = {}): DynamoDB.DocumentClient {
    if (!this.instance) {
      this.instance = new DynamoDB.DocumentClient({
        region: config.region || process.env.AWS_REGION || 'us-east-1',
        endpoint: config.endpoint,
        maxRetries: config.maxRetries || 3,
        retryDelayOptions: config.retryDelayOptions || { base: 300 },
      });
    }
    return this.instance;
  }

  static async batchWriteWithRetry(
    tableName: string,
    items: any[],
    maxRetries: number = 3
  ): Promise<void> {
    const dynamoDB = this.getInstance();
    const chunks = this.chunkArray(items, 25); // DynamoDB batch write limit

    for (const chunk of chunks) {
      let retries = 0;
      let unprocessedItems: any[] = chunk;

      while (unprocessedItems.length > 0 && retries < maxRetries) {
        const params: DynamoDB.DocumentClient.BatchWriteItemInput = {
          RequestItems: {
            [tableName]: unprocessedItems.map(item => ({
              PutRequest: { Item: item }
            }))
          }
        };

        try {
          const result = await dynamoDB.batchWrite(params).promise();
          unprocessedItems = result.UnprocessedItems?.[tableName] || [];
          
          if (unprocessedItems.length > 0) {
            retries++;
            await this.delay(Math.pow(2, retries) * 100); // Exponential backoff
          }
        } catch (error) {
          retries++;
          if (retries >= maxRetries) {
            throw error;
          }
          await this.delay(Math.pow(2, retries) * 100);
        }
      }
    }
  }

  static async batchGetWithRetry(
    tableName: string,
    keys: any[],
    maxRetries: number = 3
  ): Promise<any[]> {
    const dynamoDB = this.getInstance();
    const chunks = this.chunkArray(keys, 100); // DynamoDB batch get limit
    const results: any[] = [];

    for (const chunk of chunks) {
      let retries = 0;
      let unprocessedKeys: any[] = chunk;

      while (unprocessedKeys.length > 0 && retries < maxRetries) {
        const params: DynamoDB.DocumentClient.BatchGetItemInput = {
          RequestItems: {
            [tableName]: {
              Keys: unprocessedKeys
            }
          }
        };

        try {
          const result = await dynamoDB.batchGet(params).promise();
          const items = result.Responses?.[tableName] || [];
          results.push(...items);

          unprocessedKeys = result.UnprocessedKeys?.[tableName]?.Keys || [];
          
          if (unprocessedKeys.length > 0) {
            retries++;
            await this.delay(Math.pow(2, retries) * 100);
          }
        } catch (error) {
          retries++;
          if (retries >= maxRetries) {
            throw error;
          }
          await this.delay(Math.pow(2, retries) * 100);
        }
      }
    }

    return results;
  }

  static async scanWithPagination(
    tableName: string,
    params: DynamoDB.DocumentClient.ScanInput,
    maxItems?: number
  ): Promise<any[]> {
    const dynamoDB = this.getInstance();
    const items: any[] = [];
    let lastEvaluatedKey: DynamoDB.DocumentClient.Key | undefined;

    do {
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await dynamoDB.scan(params).promise();
      items.push(...(result.Items || []));

      if (maxItems && items.length >= maxItems) {
        break;
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return maxItems ? items.slice(0, maxItems) : items;
  }

  static async queryWithPagination(
    tableName: string,
    params: DynamoDB.DocumentClient.QueryInput,
    maxItems?: number
  ): Promise<any[]> {
    const dynamoDB = this.getInstance();
    const items: any[] = [];
    let lastEvaluatedKey: DynamoDB.DocumentClient.Key | undefined;

    do {
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await dynamoDB.query(params).promise();
      items.push(...(result.Items || []));

      if (maxItems && items.length >= maxItems) {
        break;
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return maxItems ? items.slice(0, maxItems) : items;
  }

  static chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static parsePaginationToken(token?: string): DynamoDB.DocumentClient.Key | undefined {
    if (!token) return undefined;
    
    try {
      return JSON.parse(Buffer.from(token, 'base64').toString());
    } catch (error) {
      throw new Error('Invalid pagination token');
    }
  }

  static generatePaginationToken(key?: DynamoDB.DocumentClient.Key): string | undefined {
    if (!key) return undefined;
    
    return Buffer.from(JSON.stringify(key)).toString('base64');
  }

  static buildFilterExpression(filters: Record<string, any>): {
    expression: string;
    attributeNames: Record<string, string>;
    attributeValues: Record<string, any>;
  } {
    const conditions: string[] = [];
    const attributeNames: Record<string, string> = {};
    const attributeValues: Record<string, any> = {};

    Object.entries(filters).forEach(([key, value], index) => {
      if (value !== undefined && value !== null) {
        const nameKey = `#attr${index}`;
        const valueKey = `:val${index}`;
        
        attributeNames[nameKey] = key;
        attributeValues[valueKey] = value;
        
        if (Array.isArray(value)) {
          conditions.push(`${nameKey} IN (${value.map((_, i) => `:val${index}_${i}`).join(', ')})`);
          value.forEach((v, i) => {
            attributeValues[`:val${index}_${i}`] = v;
          });
        } else if (typeof value === 'string' && value.includes('*')) {
          conditions.push(`begins_with(${nameKey}, :val${index})`);
          attributeValues[valueKey] = value.replace('*', '');
        } else {
          conditions.push(`${nameKey} = :val${index}`);
        }
      }
    });

    return {
      expression: conditions.join(' AND '),
      attributeNames,
      attributeValues,
    };
  }

  static buildUpdateExpression(updates: Record<string, any>): {
    expression: string;
    attributeNames: Record<string, string>;
    attributeValues: Record<string, any>;
  } {
    const setExpressions: string[] = [];
    const removeExpressions: string[] = [];
    const attributeNames: Record<string, string> = {};
    const attributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value], index) => {
      const nameKey = `#attr${index}`;
      const valueKey = `:val${index}`;
      
      attributeNames[nameKey] = key;

      if (value === null || value === undefined) {
        removeExpressions.push(nameKey);
      } else {
        setExpressions.push(`${nameKey} = ${valueKey}`);
        attributeValues[valueKey] = value;
      }
    });

    const expressions: string[] = [];
    if (setExpressions.length > 0) {
      expressions.push(`SET ${setExpressions.join(', ')}`);
    }
    if (removeExpressions.length > 0) {
      expressions.push(`REMOVE ${removeExpressions.join(', ')}`);
    }

    return {
      expression: expressions.join(' '),
      attributeNames,
      attributeValues,
    };
  }
}
