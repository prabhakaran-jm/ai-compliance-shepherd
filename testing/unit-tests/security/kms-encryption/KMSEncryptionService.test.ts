/**
 * Unit tests for KMSEncryptionService
 */

import { KMSEncryptionService } from '../../../../security/kms-encryption/src/services/KMSEncryptionService';
import { KMSClient } from '@aws-sdk/client-kms';
import { mockAWSResponses } from '../../setup/aws-mocks';

// Mock KMS Client
jest.mock('@aws-sdk/client-kms');

describe('KMSEncryptionService', () => {
  let kmsService: KMSEncryptionService;
  let mockKMSClient: jest.Mocked<KMSClient>;

  beforeEach(() => {
    kmsService = new KMSEncryptionService();
    mockKMSClient = new KMSClient({}) as jest.Mocked<KMSClient>;
    
    // Set up mock client
    (kmsService as any).kmsClient = mockKMSClient;

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('createTenantKey', () => {
    it('should create tenant-specific KMS key', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();
      const keyDescription = `Encryption key for tenant ${tenantId}`;

      mockKMSClient.send = jest.fn().mockResolvedValue({
        KeyMetadata: {
          KeyId: 'test-key-id',
          Arn: `arn:aws:kms:us-east-1:123456789012:key/test-key-id`,
          Description: keyDescription
        }
      });

      // Act
      const result = await kmsService.createTenantKey(tenantId);

      // Assert
      expect(result).toBeDefined();
      expect(result.keyId).toBe('test-key-id');
      expect(result.keyArn).toBe('arn:aws:kms:us-east-1:123456789012:key/test-key-id');
      expect(result.tenantId).toBe(tenantId);
      expect(mockKMSClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle KMS key creation errors', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();

      mockKMSClient.send = jest.fn().mockRejectedValue(
        new Error('LimitExceededException: Too many keys')
      );

      // Act & Assert
      await expect(kmsService.createTenantKey(tenantId))
        .rejects
        .toThrow('LimitExceededException: Too many keys');
    });

    it('should validate tenant ID', async () => {
      // Arrange
      const invalidTenantId = '';

      // Act & Assert
      await expect(kmsService.createTenantKey(invalidTenantId))
        .rejects
        .toThrow('Invalid tenant ID');
    });
  });

  describe('encryptData', () => {
    it('should encrypt data successfully', async () => {
      // Arrange
      const keyId = 'test-key-id';
      const plaintext = 'sensitive data to encrypt';
      const context = {
        tenantId: global.testUtils.generateTenantId(),
        operation: 'encrypt-test'
      };

      mockKMSClient.send = jest.fn().mockResolvedValue({
        CiphertextBlob: Buffer.from('encrypted-data'),
        KeyId: keyId
      });

      // Act
      const result = await kmsService.encryptData(keyId, plaintext, context);

      // Assert
      expect(result).toBeDefined();
      expect(result.ciphertext).toBeDefined();
      expect(result.keyId).toBe(keyId);
      expect(result.encryptionContext).toEqual(context);
      expect(mockKMSClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle encryption errors', async () => {
      // Arrange
      const keyId = 'invalid-key-id';
      const plaintext = 'test data';

      mockKMSClient.send = jest.fn().mockRejectedValue(
        new Error('NotFoundException: Key not found')
      );

      // Act & Assert
      await expect(kmsService.encryptData(keyId, plaintext))
        .rejects
        .toThrow('NotFoundException: Key not found');
    });

    it('should validate input parameters', async () => {
      // Arrange
      const keyId = '';
      const plaintext = 'test data';

      // Act & Assert
      await expect(kmsService.encryptData(keyId, plaintext))
        .rejects
        .toThrow('Invalid encryption parameters');
    });

    it('should handle large data encryption', async () => {
      // Arrange
      const keyId = 'test-key-id';
      const largeData = 'x'.repeat(5000); // 5KB of data

      mockKMSClient.send = jest.fn().mockResolvedValue({
        CiphertextBlob: Buffer.from('encrypted-large-data'),
        KeyId: keyId
      });

      // Act
      const result = await kmsService.encryptData(keyId, largeData);

      // Assert
      expect(result).toBeDefined();
      expect(result.ciphertext).toBeDefined();
    });
  });

  describe('decryptData', () => {
    it('should decrypt data successfully', async () => {
      // Arrange
      const encryptedData = Buffer.from('encrypted-data');
      const expectedPlaintext = 'decrypted sensitive data';
      const context = {
        tenantId: global.testUtils.generateTenantId(),
        operation: 'decrypt-test'
      };

      mockKMSClient.send = jest.fn().mockResolvedValue({
        Plaintext: Buffer.from(expectedPlaintext),
        KeyId: 'test-key-id'
      });

      // Act
      const result = await kmsService.decryptData(encryptedData, context);

      // Assert
      expect(result).toBeDefined();
      expect(result.plaintext).toBe(expectedPlaintext);
      expect(result.keyId).toBe('test-key-id');
      expect(mockKMSClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle decryption errors', async () => {
      // Arrange
      const invalidEncryptedData = Buffer.from('invalid-encrypted-data');

      mockKMSClient.send = jest.fn().mockRejectedValue(
        new Error('InvalidCiphertextException: Invalid ciphertext')
      );

      // Act & Assert
      await expect(kmsService.decryptData(invalidEncryptedData))
        .rejects
        .toThrow('InvalidCiphertextException: Invalid ciphertext');
    });

    it('should validate encryption context', async () => {
      // Arrange
      const encryptedData = Buffer.from('encrypted-data');
      const wrongContext = {
        tenantId: 'wrong-tenant-id',
        operation: 'decrypt-test'
      };

      mockKMSClient.send = jest.fn().mockRejectedValue(
        new Error('InvalidGrantTokenException: Context mismatch')
      );

      // Act & Assert
      await expect(kmsService.decryptData(encryptedData, wrongContext))
        .rejects
        .toThrow('InvalidGrantTokenException: Context mismatch');
    });
  });

  describe('rotateKey', () => {
    it('should enable automatic key rotation', async () => {
      // Arrange
      const keyId = 'test-key-id';

      mockKMSClient.send = jest.fn().mockResolvedValue({
        $metadata: { requestId: 'test-request-id' }
      });

      // Act
      const result = await kmsService.rotateKey(keyId);

      // Assert
      expect(result).toBeDefined();
      expect(result.keyId).toBe(keyId);
      expect(result.rotationEnabled).toBe(true);
      expect(mockKMSClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle rotation errors', async () => {
      // Arrange
      const keyId = 'invalid-key-id';

      mockKMSClient.send = jest.fn().mockRejectedValue(
        new Error('NotFoundException: Key not found for rotation')
      );

      // Act & Assert
      await expect(kmsService.rotateKey(keyId))
        .rejects
        .toThrow('NotFoundException: Key not found for rotation');
    });
  });

  describe('listTenantKeys', () => {
    it('should list keys for tenant', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();

      mockKMSClient.send = jest.fn().mockResolvedValue({
        Keys: [
          {
            KeyId: 'key-1',
            KeyArn: 'arn:aws:kms:us-east-1:123456789012:key/key-1'
          },
          {
            KeyId: 'key-2',
            KeyArn: 'arn:aws:kms:us-east-1:123456789012:key/key-2'
          }
        ]
      });

      // Act
      const result = await kmsService.listTenantKeys(tenantId);

      // Assert
      expect(result).toBeDefined();
      expect(result.keys).toHaveLength(2);
      expect(result.keys[0].keyId).toBe('key-1');
      expect(result.keys[1].keyId).toBe('key-2');
      expect(result.tenantId).toBe(tenantId);
    });

    it('should handle empty key list', async () => {
      // Arrange
      const tenantId = global.testUtils.generateTenantId();

      mockKMSClient.send = jest.fn().mockResolvedValue({
        Keys: []
      });

      // Act
      const result = await kmsService.listTenantKeys(tenantId);

      // Assert
      expect(result.keys).toHaveLength(0);
      expect(result.tenantId).toBe(tenantId);
    });
  });

  describe('deleteKey', () => {
    it('should schedule key deletion', async () => {
      // Arrange
      const keyId = 'test-key-id';
      const pendingWindowInDays = 7;

      mockKMSClient.send = jest.fn().mockResolvedValue({
        KeyId: keyId,
        DeletionDate: new Date(Date.now() + (pendingWindowInDays * 24 * 60 * 60 * 1000))
      });

      // Act
      const result = await kmsService.deleteKey(keyId, pendingWindowInDays);

      // Assert
      expect(result).toBeDefined();
      expect(result.keyId).toBe(keyId);
      expect(result.deletionDate).toBeDefined();
      expect(result.pendingWindowInDays).toBe(pendingWindowInDays);
    });

    it('should handle deletion errors', async () => {
      // Arrange
      const keyId = 'invalid-key-id';

      mockKMSClient.send = jest.fn().mockRejectedValue(
        new Error('NotFoundException: Key not found for deletion')
      );

      // Act & Assert
      await expect(kmsService.deleteKey(keyId))
        .rejects
        .toThrow('NotFoundException: Key not found for deletion');
    });
  });

  describe('getKeyPolicy', () => {
    it('should retrieve key policy', async () => {
      // Arrange
      const keyId = 'test-key-id';
      const policyDocument = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: 'arn:aws:iam::123456789012:root' },
            Action: 'kms:*',
            Resource: '*'
          }
        ]
      };

      mockKMSClient.send = jest.fn().mockResolvedValue({
        Policy: JSON.stringify(policyDocument)
      });

      // Act
      const result = await kmsService.getKeyPolicy(keyId);

      // Assert
      expect(result).toBeDefined();
      expect(result.keyId).toBe(keyId);
      expect(result.policy).toEqual(policyDocument);
    });

    it('should handle policy retrieval errors', async () => {
      // Arrange
      const keyId = 'invalid-key-id';

      mockKMSClient.send = jest.fn().mockRejectedValue(
        new Error('NotFoundException: Key policy not found')
      );

      // Act & Assert
      await expect(kmsService.getKeyPolicy(keyId))
        .rejects
        .toThrow('NotFoundException: Key policy not found');
    });
  });

  describe('updateKeyPolicy', () => {
    it('should update key policy', async () => {
      // Arrange
      const keyId = 'test-key-id';
      const newPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: 'arn:aws:iam::123456789012:role/TenantRole' },
            Action: ['kms:Encrypt', 'kms:Decrypt'],
            Resource: '*'
          }
        ]
      };

      mockKMSClient.send = jest.fn().mockResolvedValue({
        $metadata: { requestId: 'test-request-id' }
      });

      // Act
      const result = await kmsService.updateKeyPolicy(keyId, newPolicy);

      // Assert
      expect(result).toBeDefined();
      expect(result.keyId).toBe(keyId);
      expect(result.policyUpdated).toBe(true);
    });

    it('should validate policy document', async () => {
      // Arrange
      const keyId = 'test-key-id';
      const invalidPolicy = {
        Version: '2012-10-17'
        // Missing Statement array
      } as any;

      // Act & Assert
      await expect(kmsService.updateKeyPolicy(keyId, invalidPolicy))
        .rejects
        .toThrow('Invalid policy document');
    });
  });

  describe('health check', () => {
    it('should return healthy status when KMS is accessible', async () => {
      // Arrange
      mockKMSClient.send = jest.fn().mockResolvedValue({
        Keys: []
      });

      // Act
      const result = await kmsService.healthCheck();

      // Assert
      expect(result).toBeDefined();
      expect(result.kms).toBe(true);
      expect(result.connectivity).toBe(true);
    });

    it('should return unhealthy status when KMS is inaccessible', async () => {
      // Arrange
      mockKMSClient.send = jest.fn().mockRejectedValue(
        new Error('Service temporarily unavailable')
      );

      // Act
      const result = await kmsService.healthCheck();

      // Assert
      expect(result.kms).toBe(false);
      expect(result.connectivity).toBe(false);
    });
  });

  describe('data key operations', () => {
    it('should generate data key for envelope encryption', async () => {
      // Arrange
      const keyId = 'test-key-id';
      const keySpec = 'AES_256';

      mockKMSClient.send = jest.fn().mockResolvedValue({
        CiphertextBlob: Buffer.from('encrypted-data-key'),
        Plaintext: Buffer.from('plaintext-data-key'),
        KeyId: keyId
      });

      // Act
      const result = await kmsService.generateDataKey(keyId, keySpec);

      // Assert
      expect(result).toBeDefined();
      expect(result.plaintextKey).toBeDefined();
      expect(result.encryptedKey).toBeDefined();
      expect(result.keyId).toBe(keyId);
    });

    it('should decrypt data key', async () => {
      // Arrange
      const encryptedDataKey = Buffer.from('encrypted-data-key');

      mockKMSClient.send = jest.fn().mockResolvedValue({
        Plaintext: Buffer.from('plaintext-data-key'),
        KeyId: 'test-key-id'
      });

      // Act
      const result = await kmsService.decryptDataKey(encryptedDataKey);

      // Assert
      expect(result).toBeDefined();
      expect(result.plaintextKey).toBeDefined();
      expect(result.keyId).toBe('test-key-id');
    });
  });

  describe('multi-tenant isolation', () => {
    it('should enforce tenant isolation in encryption context', async () => {
      // Arrange
      const tenantA = global.testUtils.generateTenantId();
      const tenantB = global.testUtils.generateTenantId();
      const keyId = 'test-key-id';
      const plaintext = 'sensitive data';

      mockKMSClient.send = jest.fn().mockResolvedValue({
        CiphertextBlob: Buffer.from('encrypted-data'),
        KeyId: keyId
      });

      // Act
      const resultA = await kmsService.encryptData(keyId, plaintext, { tenantId: tenantA });
      const resultB = await kmsService.encryptData(keyId, plaintext, { tenantId: tenantB });

      // Assert
      expect(resultA.encryptionContext?.tenantId).toBe(tenantA);
      expect(resultB.encryptionContext?.tenantId).toBe(tenantB);
      expect(mockKMSClient.send).toHaveBeenCalledTimes(2);
    });

    it('should prevent cross-tenant key access', async () => {
      // Arrange
      const encryptedData = Buffer.from('encrypted-data');
      const originalTenant = global.testUtils.generateTenantId();
      const wrongTenant = global.testUtils.generateTenantId();

      mockKMSClient.send = jest.fn().mockRejectedValue(
        new Error('InvalidGrantTokenException: Context validation failed')
      );

      // Act & Assert
      await expect(kmsService.decryptData(encryptedData, { tenantId: wrongTenant }))
        .rejects
        .toThrow('InvalidGrantTokenException: Context validation failed');
    });
  });
});
