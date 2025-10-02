/**
 * Unit tests for BaseRepository
 */

import { BaseRepository } from '../../../../services/data-access-layer/src/repositories/BaseRepository';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { mockAWSResponses } from '../../setup/aws-mocks';

// Test implementation of BaseRepository
class TestRepository extends BaseRepository<any> {
  constructor() {
    super('TestTable', 'id', 'sortKey');
  }

  protected validateItem(item: any): boolean {
    return item && item.id && item.sortKey;
  }

  protected transformForStorage(item: any): any {
    return {
      ...item,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  protected transformFromStorage(item: any): any {
    return item;
  }
}

describe('BaseRepository', () => {
  let repository: TestRepository;
  let mockDynamoDBClient: jest.Mocked<DynamoDBClient>;

  beforeEach(() => {
    repository = new TestRepository();
    mockDynamoDBClient = new DynamoDBClient({}) as jest.Mocked<DynamoDBClient>;
    
    // Set up mock client
    (repository as any).client = mockDynamoDBClient;

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create item successfully', async () => {
      // Arrange
      const item = {
        id: 'test-id',
        sortKey: 'test-sort',
        name: 'Test Item',
        value: 100
      };

      mockDynamoDBClient.send = jest.fn().mockResolvedValue(mockAWSResponses.dynamodb.putItem);

      // Act
      const result = await repository.create(item);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(item.id);
      expect(result.sortKey).toBe(item.sortKey);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(mockDynamoDBClient.send).toHaveBeenCalledTimes(1);
    });

    it('should throw error for invalid item', async () => {
      // Arrange
      const invalidItem = {
        name: 'Test Item' // Missing required id and sortKey
      };

      // Act & Assert
      await expect(repository.create(invalidItem))
        .rejects
        .toThrow('Invalid item data');
    });

    it('should handle DynamoDB errors', async () => {
      // Arrange
      const item = {
        id: 'test-id',
        sortKey: 'test-sort',
        name: 'Test Item'
      };

      mockDynamoDBClient.send = jest.fn().mockRejectedValue(
        new Error('ConditionalCheckFailedException')
      );

      // Act & Assert
      await expect(repository.create(item))
        .rejects
        .toThrow('ConditionalCheckFailedException');
    });
  });

  describe('getById', () => {
    it('should retrieve item by ID', async () => {
      // Arrange
      const id = 'test-id';
      const sortKey = 'test-sort';

      const mockItem = {
        id: { S: id },
        sortKey: { S: sortKey },
        name: { S: 'Test Item' },
        value: { N: '100' }
      };

      mockDynamoDBClient.send = jest.fn().mockResolvedValue({
        Item: mockItem
      });

      // Act
      const result = await repository.getById(id, sortKey);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(id);
      expect(result.sortKey).toBe(sortKey);
      expect(mockDynamoDBClient.send).toHaveBeenCalledTimes(1);
    });

    it('should return null for non-existent item', async () => {
      // Arrange
      const id = 'non-existent-id';
      const sortKey = 'non-existent-sort';

      mockDynamoDBClient.send = jest.fn().mockResolvedValue({
        Item: undefined
      });

      // Act
      const result = await repository.getById(id, sortKey);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle DynamoDB errors', async () => {
      // Arrange
      const id = 'test-id';
      const sortKey = 'test-sort';

      mockDynamoDBClient.send = jest.fn().mockRejectedValue(
        new Error('ResourceNotFoundException')
      );

      // Act & Assert
      await expect(repository.getById(id, sortKey))
        .rejects
        .toThrow('ResourceNotFoundException');
    });
  });

  describe('update', () => {
    it('should update item successfully', async () => {
      // Arrange
      const id = 'test-id';
      const sortKey = 'test-sort';
      const updates = {
        name: 'Updated Test Item',
        value: 200
      };

      const mockUpdatedItem = {
        id: { S: id },
        sortKey: { S: sortKey },
        name: { S: updates.name },
        value: { N: updates.value.toString() },
        updatedAt: { S: new Date().toISOString() }
      };

      mockDynamoDBClient.send = jest.fn().mockResolvedValue({
        Attributes: mockUpdatedItem
      });

      // Act
      const result = await repository.update(id, updates, sortKey);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe(updates.name);
      expect(result.value).toBe(updates.value);
      expect(result.updatedAt).toBeDefined();
      expect(mockDynamoDBClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle conditional update failures', async () => {
      // Arrange
      const id = 'test-id';
      const sortKey = 'test-sort';
      const updates = { name: 'Updated Name' };

      mockDynamoDBClient.send = jest.fn().mockRejectedValue(
        new Error('ConditionalCheckFailedException')
      );

      // Act & Assert
      await expect(repository.update(id, updates, sortKey))
        .rejects
        .toThrow('ConditionalCheckFailedException');
    });
  });

  describe('delete', () => {
    it('should delete item successfully', async () => {
      // Arrange
      const id = 'test-id';
      const sortKey = 'test-sort';

      mockDynamoDBClient.send = jest.fn().mockResolvedValue(mockAWSResponses.dynamodb.deleteItem);

      // Act
      const result = await repository.delete(id, sortKey);

      // Assert
      expect(result).toBe(true);
      expect(mockDynamoDBClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle item not found during delete', async () => {
      // Arrange
      const id = 'non-existent-id';
      const sortKey = 'non-existent-sort';

      mockDynamoDBClient.send = jest.fn().mockRejectedValue(
        new Error('ConditionalCheckFailedException')
      );

      // Act & Assert
      await expect(repository.delete(id, sortKey))
        .rejects
        .toThrow('ConditionalCheckFailedException');
    });
  });

  describe('list', () => {
    it('should list items with pagination', async () => {
      // Arrange
      const options = {
        maxResults: 10,
        nextToken: undefined,
        filters: {}
      };

      const mockItems = [
        {
          id: { S: 'item-1' },
          sortKey: { S: 'sort-1' },
          name: { S: 'Item 1' }
        },
        {
          id: { S: 'item-2' },
          sortKey: { S: 'sort-2' },
          name: { S: 'Item 2' }
        }
      ];

      mockDynamoDBClient.send = jest.fn().mockResolvedValue({
        Items: mockItems,
        Count: 2,
        LastEvaluatedKey: { id: { S: 'item-2' } }
      });

      // Act
      const result = await repository.list(options);

      // Assert
      expect(result).toBeDefined();
      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe('item-1');
      expect(result.items[1].id).toBe('item-2');
      expect(result.nextToken).toBeDefined();
      expect(result.totalCount).toBe(2);
    });

    it('should handle empty results', async () => {
      // Arrange
      const options = {
        maxResults: 10,
        filters: {}
      };

      mockDynamoDBClient.send = jest.fn().mockResolvedValue({
        Items: [],
        Count: 0
      });

      // Act
      const result = await repository.list(options);

      // Assert
      expect(result.items).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.nextToken).toBeNull();
    });
  });

  describe('query', () => {
    it('should query items by partition key', async () => {
      // Arrange
      const partitionKeyValue = 'test-partition';
      const options = {
        sortKeyCondition: {
          operator: 'begins_with' as const,
          value: 'prefix-'
        },
        maxResults: 5
      };

      const mockItems = [
        {
          id: { S: partitionKeyValue },
          sortKey: { S: 'prefix-1' },
          name: { S: 'Item 1' }
        },
        {
          id: { S: partitionKeyValue },
          sortKey: { S: 'prefix-2' },
          name: { S: 'Item 2' }
        }
      ];

      mockDynamoDBClient.send = jest.fn().mockResolvedValue({
        Items: mockItems,
        Count: 2
      });

      // Act
      const result = await repository.query(partitionKeyValue, options);

      // Assert
      expect(result).toBeDefined();
      expect(result.items).toHaveLength(2);
      expect(result.items[0].sortKey).toBe('prefix-1');
      expect(result.items[1].sortKey).toBe('prefix-2');
    });

    it('should handle query with filters', async () => {
      // Arrange
      const partitionKeyValue = 'test-partition';
      const options = {
        filters: {
          name: 'Test Item'
        }
      };

      const mockItems = [
        {
          id: { S: partitionKeyValue },
          sortKey: { S: 'sort-1' },
          name: { S: 'Test Item' }
        }
      ];

      mockDynamoDBClient.send = jest.fn().mockResolvedValue({
        Items: mockItems,
        Count: 1
      });

      // Act
      const result = await repository.query(partitionKeyValue, options);

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Test Item');
    });
  });

  describe('batchCreate', () => {
    it('should create multiple items in batch', async () => {
      // Arrange
      const items = [
        {
          id: 'item-1',
          sortKey: 'sort-1',
          name: 'Item 1'
        },
        {
          id: 'item-2',
          sortKey: 'sort-2',
          name: 'Item 2'
        }
      ];

      mockDynamoDBClient.send = jest.fn().mockResolvedValue({
        UnprocessedItems: {}
      });

      // Act
      const result = await repository.batchCreate(items);

      // Assert
      expect(result).toBeDefined();
      expect(result.created).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.created[0].id).toBe('item-1');
      expect(result.created[1].id).toBe('item-2');
    });

    it('should handle partial batch failures', async () => {
      // Arrange
      const items = [
        {
          id: 'item-1',
          sortKey: 'sort-1',
          name: 'Item 1'
        },
        {
          id: '', // Invalid item
          sortKey: 'sort-2',
          name: 'Item 2'
        }
      ];

      // Act
      const result = await repository.batchCreate(items);

      // Assert
      expect(result.created).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('Invalid item data');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when DynamoDB is accessible', async () => {
      // Arrange
      mockDynamoDBClient.send = jest.fn().mockResolvedValue({
        Table: {
          TableName: 'TestTable',
          TableStatus: 'ACTIVE'
        }
      });

      // Act
      const result = await repository.healthCheck();

      // Assert
      expect(result).toBe(true);
    });

    it('should return unhealthy status when DynamoDB is inaccessible', async () => {
      // Arrange
      mockDynamoDBClient.send = jest.fn().mockRejectedValue(
        new Error('ResourceNotFoundException')
      );

      // Act
      const result = await repository.healthCheck();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('error handling with retries', () => {
    it('should retry on throttling errors', async () => {
      // Arrange
      const item = {
        id: 'test-id',
        sortKey: 'test-sort',
        name: 'Test Item'
      };

      mockDynamoDBClient.send = jest.fn()
        .mockRejectedValueOnce(new Error('ProvisionedThroughputExceededException'))
        .mockRejectedValueOnce(new Error('ProvisionedThroughputExceededException'))
        .mockResolvedValue(mockAWSResponses.dynamodb.putItem);

      // Act
      const result = await repository.create(item);

      // Assert
      expect(result).toBeDefined();
      expect(mockDynamoDBClient.send).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      // Arrange
      const item = {
        id: 'test-id',
        sortKey: 'test-sort',
        name: 'Test Item'
      };

      mockDynamoDBClient.send = jest.fn().mockRejectedValue(
        new Error('ProvisionedThroughputExceededException')
      );

      // Act & Assert
      await expect(repository.create(item))
        .rejects
        .toThrow('ProvisionedThroughputExceededException');

      expect(mockDynamoDBClient.send).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });
});
