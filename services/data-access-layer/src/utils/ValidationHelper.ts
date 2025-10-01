/**
 * Validation helper for DynamoDB operations
 */

import { z } from 'zod';

export class ValidationHelper {
  /**
   * Validate DynamoDB item against schema
   */
  static validateItem<T>(item: any, schema: z.ZodSchema<T>): T {
    try {
      return schema.parse(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation failed: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Validate DynamoDB query parameters
   */
  static validateQueryParams(params: any): void {
    if (!params.TableName) {
      throw new Error('TableName is required');
    }

    if (params.KeyConditionExpression && !params.ExpressionAttributeValues) {
      throw new Error('ExpressionAttributeValues is required when using KeyConditionExpression');
    }

    if (params.FilterExpression && !params.ExpressionAttributeValues) {
      throw new Error('ExpressionAttributeValues is required when using FilterExpression');
    }
  }

  /**
   * Validate pagination parameters
   */
  static validatePaginationParams(params: any): void {
    if (params.limit && (params.limit < 1 || params.limit > 1000)) {
      throw new Error('Limit must be between 1 and 1000');
    }

    if (params.nextToken && typeof params.nextToken !== 'string') {
      throw new Error('NextToken must be a string');
    }
  }

  /**
   * Validate tenant ID
   */
  static validateTenantId(tenantId: string): void {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('TenantId is required and must be a string');
    }

    if (tenantId.length < 1 || tenantId.length > 255) {
      throw new Error('TenantId must be between 1 and 255 characters');
    }
  }

  /**
   * Validate resource ID
   */
  static validateResourceId(resourceId: string): void {
    if (!resourceId || typeof resourceId !== 'string') {
      throw new Error('ResourceId is required and must be a string');
    }

    if (resourceId.length < 1 || resourceId.length > 255) {
      throw new Error('ResourceId must be between 1 and 255 characters');
    }
  }

  /**
   * Validate date range
   */
  static validateDateRange(startDate: string, endDate: string): void {
    if (!startDate || !endDate) {
      throw new Error('StartDate and EndDate are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format');
    }

    if (start >= end) {
      throw new Error('StartDate must be before EndDate');
    }
  }

  /**
   * Validate email address
   */
  static validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
  }

  /**
   * Validate IP address
   */
  static validateIPAddress(ip: string): void {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
      throw new Error('Invalid IP address format');
    }
  }

  /**
   * Validate AWS region
   */
  static validateAWSRegion(region: string): void {
    const validRegions = [
      'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
      'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
      'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
      'ca-central-1', 'sa-east-1'
    ];

    if (!validRegions.includes(region)) {
      throw new Error(`Invalid AWS region: ${region}`);
    }
  }

  /**
   * Validate AWS account ID
   */
  static validateAWSAccountId(accountId: string): void {
    const accountIdRegex = /^\d{12}$/;
    if (!accountIdRegex.test(accountId)) {
      throw new Error('Invalid AWS account ID format');
    }
  }

  /**
   * Validate ARN format
   */
  static validateARN(arn: string): void {
    const arnRegex = /^arn:aws:[a-z0-9-]+:[a-z0-9-]*:[0-9]{12}:[a-zA-Z0-9-_/.:]+$/;
    if (!arnRegex.test(arn)) {
      throw new Error('Invalid ARN format');
    }
  }

  /**
   * Validate severity level
   */
  static validateSeverity(severity: string): void {
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(severity)) {
      throw new Error(`Invalid severity level: ${severity}`);
    }
  }

  /**
   * Validate status
   */
  static validateStatus(status: string, validStatuses: string[]): void {
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Valid statuses: ${validStatuses.join(', ')}`);
    }
  }

  /**
   * Validate tags
   */
  static validateTags(tags: Record<string, string>): void {
    if (!tags || typeof tags !== 'object') {
      throw new Error('Tags must be an object');
    }

    for (const [key, value] of Object.entries(tags)) {
      if (typeof key !== 'string' || typeof value !== 'string') {
        throw new Error('Tag keys and values must be strings');
      }

      if (key.length < 1 || key.length > 128) {
        throw new Error('Tag key must be between 1 and 128 characters');
      }

      if (value.length < 1 || value.length > 256) {
        throw new Error('Tag value must be between 1 and 256 characters');
      }
    }
  }

  /**
   * Sanitize input string
   */
  static sanitizeString(input: string): string {
    return input.trim().replace(/[<>]/g, '');
  }

  /**
   * Sanitize object keys
   */
  static sanitizeObjectKeys(obj: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = this.sanitizeString(key);
      sanitized[sanitizedKey] = value;
    }
    
    return sanitized;
  }

  /**
   * Check if value is empty
   */
  static isEmpty(value: any): boolean {
    if (value === null || value === undefined) {
      return true;
    }
    
    if (typeof value === 'string') {
      return value.trim().length === 0;
    }
    
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    
    if (typeof value === 'object') {
      return Object.keys(value).length === 0;
    }
    
    return false;
  }

  /**
   * Check if value is not empty
   */
  static isNotEmpty(value: any): boolean {
    return !this.isEmpty(value);
  }

  /**
   * Validate required fields
   */
  static validateRequiredFields(data: Record<string, any>, requiredFields: string[]): void {
    const missingFields = requiredFields.filter(field => this.isEmpty(data[field]));
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  /**
   * Validate field types
   */
  static validateFieldTypes(data: Record<string, any>, fieldTypes: Record<string, string>): void {
    for (const [field, expectedType] of Object.entries(fieldTypes)) {
      if (data[field] !== undefined) {
        const actualType = typeof data[field];
        if (actualType !== expectedType) {
          throw new Error(`Field '${field}' must be of type '${expectedType}', got '${actualType}'`);
        }
      }
    }
  }
}
