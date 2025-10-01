/**
 * Query builder for DynamoDB operations
 */

import { DynamoDB } from 'aws-sdk';

export interface QueryBuilderOptions {
  indexName?: string;
  scanIndexForward?: boolean;
  limit?: number;
  exclusiveStartKey?: DynamoDB.DocumentClient.Key;
}

export class QueryBuilder {
  private keyConditions: string[] = [];
  private filterConditions: string[] = [];
  private attributeNames: Record<string, string> = {};
  private attributeValues: Record<string, any> = {};
  private options: QueryBuilderOptions = {};

  constructor() {
    this.reset();
  }

  /**
   * Add key condition
   */
  keyCondition(condition: string, attributeNames: Record<string, string> = {}, attributeValues: Record<string, any> = {}): this {
    this.keyConditions.push(condition);
    Object.assign(this.attributeNames, attributeNames);
    Object.assign(this.attributeValues, attributeValues);
    return this;
  }

  /**
   * Add filter condition
   */
  filter(condition: string, attributeNames: Record<string, string> = {}, attributeValues: Record<string, any> = {}): this {
    this.filterConditions.push(condition);
    Object.assign(this.attributeNames, attributeNames);
    Object.assign(this.attributeValues, attributeValues);
    return this;
  }

  /**
   * Add equals condition
   */
  equals(attribute: string, value: any): this {
    const nameKey = this.generateAttributeName(attribute);
    const valueKey = this.generateAttributeValue(value);
    
    this.attributeNames[nameKey] = attribute;
    this.attributeValues[valueKey] = value;
    
    this.filterConditions.push(`${nameKey} = ${valueKey}`);
    return this;
  }

  /**
   * Add not equals condition
   */
  notEquals(attribute: string, value: any): this {
    const nameKey = this.generateAttributeName(attribute);
    const valueKey = this.generateAttributeValue(value);
    
    this.attributeNames[nameKey] = attribute;
    this.attributeValues[valueKey] = value;
    
    this.filterConditions.push(`${nameKey} <> ${valueKey}`);
    return this;
  }

  /**
   * Add greater than condition
   */
  greaterThan(attribute: string, value: any): this {
    const nameKey = this.generateAttributeName(attribute);
    const valueKey = this.generateAttributeValue(value);
    
    this.attributeNames[nameKey] = attribute;
    this.attributeValues[valueKey] = value;
    
    this.filterConditions.push(`${nameKey} > ${valueKey}`);
    return this;
  }

  /**
   * Add greater than or equals condition
   */
  greaterThanOrEquals(attribute: string, value: any): this {
    const nameKey = this.generateAttributeName(attribute);
    const valueKey = this.generateAttributeValue(value);
    
    this.attributeNames[nameKey] = attribute;
    this.attributeValues[valueKey] = value;
    
    this.filterConditions.push(`${nameKey} >= ${valueKey}`);
    return this;
  }

  /**
   * Add less than condition
   */
  lessThan(attribute: string, value: any): this {
    const nameKey = this.generateAttributeName(attribute);
    const valueKey = this.generateAttributeValue(value);
    
    this.attributeNames[nameKey] = attribute;
    this.attributeValues[valueKey] = value;
    
    this.filterConditions.push(`${nameKey} < ${valueKey}`);
    return this;
  }

  /**
   * Add less than or equals condition
   */
  lessThanOrEquals(attribute: string, value: any): this {
    const nameKey = this.generateAttributeName(attribute);
    const valueKey = this.generateAttributeValue(value);
    
    this.attributeNames[nameKey] = attribute;
    this.attributeValues[valueKey] = value;
    
    this.filterConditions.push(`${nameKey} <= ${valueKey}`);
    return this;
  }

  /**
   * Add between condition
   */
  between(attribute: string, startValue: any, endValue: any): this {
    const nameKey = this.generateAttributeName(attribute);
    const startValueKey = this.generateAttributeValue(startValue);
    const endValueKey = this.generateAttributeValue(endValue);
    
    this.attributeNames[nameKey] = attribute;
    this.attributeValues[startValueKey] = startValue;
    this.attributeValues[endValueKey] = endValue;
    
    this.filterConditions.push(`${nameKey} BETWEEN ${startValueKey} AND ${endValueKey}`);
    return this;
  }

  /**
   * Add in condition
   */
  in(attribute: string, values: any[]): this {
    const nameKey = this.generateAttributeName(attribute);
    const valueKeys = values.map(value => this.generateAttributeValue(value));
    
    this.attributeNames[nameKey] = attribute;
    valueKeys.forEach((key, index) => {
      this.attributeValues[key] = values[index];
    });
    
    this.filterConditions.push(`${nameKey} IN (${valueKeys.join(', ')})`);
    return this;
  }

  /**
   * Add contains condition
   */
  contains(attribute: string, value: any): this {
    const nameKey = this.generateAttributeName(attribute);
    const valueKey = this.generateAttributeValue(value);
    
    this.attributeNames[nameKey] = attribute;
    this.attributeValues[valueKey] = value;
    
    this.filterConditions.push(`contains(${nameKey}, ${valueKey})`);
    return this;
  }

  /**
   * Add begins with condition
   */
  beginsWith(attribute: string, value: any): this {
    const nameKey = this.generateAttributeName(attribute);
    const valueKey = this.generateAttributeValue(value);
    
    this.attributeNames[nameKey] = attribute;
    this.attributeValues[valueKey] = value;
    
    this.filterConditions.push(`begins_with(${nameKey}, ${valueKey})`);
    return this;
  }

  /**
   * Add attribute exists condition
   */
  attributeExists(attribute: string): this {
    const nameKey = this.generateAttributeName(attribute);
    this.attributeNames[nameKey] = attribute;
    this.filterConditions.push(`attribute_exists(${nameKey})`);
    return this;
  }

  /**
   * Add attribute not exists condition
   */
  attributeNotExists(attribute: string): this {
    const nameKey = this.generateAttributeName(attribute);
    this.attributeNames[nameKey] = attribute;
    this.filterConditions.push(`attribute_not_exists(${nameKey})`);
    return this;
  }

  /**
   * Add size condition
   */
  size(attribute: string, operator: '=' | '<>' | '<' | '<=' | '>' | '>=', value: number): this {
    const nameKey = this.generateAttributeName(attribute);
    const valueKey = this.generateAttributeValue(value);
    
    this.attributeNames[nameKey] = attribute;
    this.attributeValues[valueKey] = value;
    
    this.filterConditions.push(`size(${nameKey}) ${operator} ${valueKey}`);
    return this;
  }

  /**
   * Set index name
   */
  index(indexName: string): this {
    this.options.indexName = indexName;
    return this;
  }

  /**
   * Set scan index forward
   */
  scanIndexForward(forward: boolean): this {
    this.options.scanIndexForward = forward;
    return this;
  }

  /**
   * Set limit
   */
  limit(limit: number): this {
    this.options.limit = limit;
    return this;
  }

  /**
   * Set exclusive start key
   */
  exclusiveStartKey(key: DynamoDB.DocumentClient.Key): this {
    this.options.exclusiveStartKey = key;
    return this;
  }

  /**
   * Build query parameters
   */
  build(): {
    KeyConditionExpression: string;
    FilterExpression?: string;
    ExpressionAttributeNames: Record<string, string>;
    ExpressionAttributeValues: Record<string, any>;
    IndexName?: string;
    ScanIndexForward?: boolean;
    Limit?: number;
    ExclusiveStartKey?: DynamoDB.DocumentClient.Key;
  } {
    const params: any = {
      KeyConditionExpression: this.keyConditions.join(' AND '),
      ExpressionAttributeNames: this.attributeNames,
      ExpressionAttributeValues: this.attributeValues,
    };

    if (this.filterConditions.length > 0) {
      params.FilterExpression = this.filterConditions.join(' AND ');
    }

    if (this.options.indexName) {
      params.IndexName = this.options.indexName;
    }

    if (this.options.scanIndexForward !== undefined) {
      params.ScanIndexForward = this.options.scanIndexForward;
    }

    if (this.options.limit) {
      params.Limit = this.options.limit;
    }

    if (this.options.exclusiveStartKey) {
      params.ExclusiveStartKey = this.options.exclusiveStartKey;
    }

    return params;
  }

  /**
   * Build scan parameters
   */
  buildScan(): {
    FilterExpression?: string;
    ExpressionAttributeNames: Record<string, string>;
    ExpressionAttributeValues: Record<string, any>;
    IndexName?: string;
    Limit?: number;
    ExclusiveStartKey?: DynamoDB.DocumentClient.Key;
  } {
    const params: any = {
      ExpressionAttributeNames: this.attributeNames,
      ExpressionAttributeValues: this.attributeValues,
    };

    if (this.filterConditions.length > 0) {
      params.FilterExpression = this.filterConditions.join(' AND ');
    }

    if (this.options.indexName) {
      params.IndexName = this.options.indexName;
    }

    if (this.options.limit) {
      params.Limit = this.options.limit;
    }

    if (this.options.exclusiveStartKey) {
      params.ExclusiveStartKey = this.options.exclusiveStartKey;
    }

    return params;
  }

  /**
   * Reset builder
   */
  reset(): this {
    this.keyConditions = [];
    this.filterConditions = [];
    this.attributeNames = {};
    this.attributeValues = {};
    this.options = {};
    return this;
  }

  /**
   * Generate unique attribute name
   */
  private generateAttributeName(attribute: string): string {
    const count = Object.keys(this.attributeNames).length;
    return `#attr${count}`;
  }

  /**
   * Generate unique attribute value
   */
  private generateAttributeValue(value: any): string {
    const count = Object.keys(this.attributeValues).length;
    return `:val${count}`;
  }
}
