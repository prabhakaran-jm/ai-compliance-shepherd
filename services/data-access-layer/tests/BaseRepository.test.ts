/**
 * Tests for BaseRepository
 */

import { BaseRepository } from '../src/repositories/BaseRepository';
import { BaseEntity } from '@compliance-shepherd/shared';
import AWS from 'aws-sdk-mock';

interface TestEntity extends BaseEntity {
  name: string;
  value: number;
}

class TestRepository extends BaseRepository<TestEntity> {
  constructor() {
    super({
      tableName: 'test-table',
    });
  }
}

describe('BaseRepository', () => {
  let repository: TestRepository;

  beforeEach(() => {
    repository = new TestRepository();
    AWS.restore();
  });

  afterEach(() => {
    AWS.restore();
  });

  describe('create', () => {
    it('should create a new item', async () => {
      const item = { name: 'test', value: 42 };
      const expectedItem = {
        ...item,
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      };

      AWS.mock('DynamoDB.DocumentClient', 'put', (params: any, callback: any) => {
        callback(null, {});
      });

      const result = await repository.create(item);

      expect(result).toEqual(expectedItem);
    });

    it('should throw error if item already exists', async () => {
      const item = { name: 'test', value: 42 };

      AWS.mock('DynamoDB.DocumentClient', 'put', (params: any, callback: any) => {
        callback(new Error('ConditionalCheckFailedException'));
      });

      await expect(repository.create(item)).rejects.toThrow('Item with id');
    });
  });

  describe('getById', () => {
    it('should get item by ID', async () => {
      const item = {
        id: 'test-id',
        tenantId: 'tenant-1',
        name: 'test',
        value: 42,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      AWS.mock('DynamoDB.DocumentClient', 'get', (params: any, callback: any) => {
        callback(null, { Item: item });
      });

      const result = await repository.getById('test-id', 'tenant-1');

      expect(result).toEqual(item);
    });

    it('should return null if item not found', async () => {
      AWS.mock('DynamoDB.DocumentClient', 'get', (params: any, callback: any) => {
        callback(null, {});
      });

      const result = await repository.getById('test-id', 'tenant-1');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update an item', async () => {
      const updates = { name: 'updated', value: 100 };
      const updatedItem = {
        id: 'test-id',
        tenantId: 'tenant-1',
        ...updates,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: expect.any(String),
      };

      AWS.mock('DynamoDB.DocumentClient', 'update', (params: any, callback: any) => {
        callback(null, { Attributes: updatedItem });
      });

      const result = await repository.update('test-id', 'tenant-1', updates);

      expect(result).toEqual(updatedItem);
    });

    it('should throw error if item not found', async () => {
      const updates = { name: 'updated' };

      AWS.mock('DynamoDB.DocumentClient', 'update', (params: any, callback: any) => {
        callback(new Error('ConditionalCheckFailedException'));
      });

      await expect(repository.update('test-id', 'tenant-1', updates)).rejects.toThrow('Item with id test-id not found');
    });
  });

  describe('delete', () => {
    it('should delete an item', async () => {
      AWS.mock('DynamoDB.DocumentClient', 'delete', (params: any, callback: any) => {
        callback(null, {});
      });

      await expect(repository.delete('test-id', 'tenant-1')).resolves.not.toThrow();
    });

    it('should throw error if item not found', async () => {
      AWS.mock('DynamoDB.DocumentClient', 'delete', (params: any, callback: any) => {
        callback(new Error('ConditionalCheckFailedException'));
      });

      await expect(repository.delete('test-id', 'tenant-1')).rejects.toThrow('Item with id test-id not found');
    });
  });

  describe('query', () => {
    it('should query items with pagination', async () => {
      const items = [
        { id: '1', tenantId: 'tenant-1', name: 'test1' },
        { id: '2', tenantId: 'tenant-1', name: 'test2' },
      ];

      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, {
          Items: items,
          Count: 2,
          LastEvaluatedKey: { id: '2', tenantId: 'tenant-1' },
        });
      });

      const result = await repository.query('tenantId = :tenantId', {
        expressionAttributeValues: { ':tenantId': 'tenant-1' },
      });

      expect(result.items).toEqual(items);
      expect(result.totalCount).toBe(2);
      expect(result.nextToken).toBeDefined();
    });
  });

  describe('scan', () => {
    it('should scan items with pagination', async () => {
      const items = [
        { id: '1', tenantId: 'tenant-1', name: 'test1' },
        { id: '2', tenantId: 'tenant-2', name: 'test2' },
      ];

      AWS.mock('DynamoDB.DocumentClient', 'scan', (params: any, callback: any) => {
        callback(null, {
          Items: items,
          Count: 2,
        });
      });

      const result = await repository.scan();

      expect(result.items).toEqual(items);
      expect(result.totalCount).toBe(2);
    });
  });

  describe('batchGet', () => {
    it('should batch get items', async () => {
      const items = [
        { id: '1', tenantId: 'tenant-1', name: 'test1' },
        { id: '2', tenantId: 'tenant-1', name: 'test2' },
      ];

      AWS.mock('DynamoDB.DocumentClient', 'batchGet', (params: any, callback: any) => {
        callback(null, {
          Responses: {
            'test-table': items,
          },
        });
      });

      const result = await repository.batchGet([
        { id: '1', tenantId: 'tenant-1' },
        { id: '2', tenantId: 'tenant-1' },
      ]);

      expect(result).toEqual(items);
    });
  });

  describe('batchWrite', () => {
    it('should batch write items', async () => {
      const items = [
        { id: '1', tenantId: 'tenant-1', name: 'test1' },
        { id: '2', tenantId: 'tenant-1', name: 'test2' },
      ];

      AWS.mock('DynamoDB.DocumentClient', 'batchWrite', (params: any, callback: any) => {
        callback(null, {});
      });

      await expect(repository.batchWrite(items)).resolves.not.toThrow();
    });
  });

  describe('count', () => {
    it('should count items', async () => {
      AWS.mock('DynamoDB.DocumentClient', 'query', (params: any, callback: any) => {
        callback(null, { Count: 5 });
      });

      const result = await repository.count('tenantId = :tenantId', {
        expressionAttributeValues: { ':tenantId': 'tenant-1' },
      });

      expect(result).toBe(5);
    });
  });

  describe('exists', () => {
    it('should return true if item exists', async () => {
      AWS.mock('DynamoDB.DocumentClient', 'get', (params: any, callback: any) => {
        callback(null, { Item: { id: 'test-id' } });
      });

      const result = await repository.exists('test-id', 'tenant-1');

      expect(result).toBe(true);
    });

    it('should return false if item does not exist', async () => {
      AWS.mock('DynamoDB.DocumentClient', 'get', (params: any, callback: any) => {
        callback(null, {});
      });

      const result = await repository.exists('test-id', 'tenant-1');

      expect(result).toBe(false);
    });
  });
});
