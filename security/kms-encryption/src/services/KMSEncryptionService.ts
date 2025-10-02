import { 
  KMSClient, 
  CreateKeyCommand, 
  CreateAliasCommand,
  EncryptCommand, 
  DecryptCommand,
  DescribeKeyCommand,
  ListKeysCommand,
  ListAliasesCommand,
  ScheduleKeyDeletionCommand,
  EnableKeyRotationCommand,
  GetKeyRotationStatusCommand,
  KeyUsageType,
  KeyState,
  EncryptionAlgorithmSpec
} from '@aws-sdk/client-kms';
import { 
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { logger } from '../utils/logger';
import { EncryptionError, ValidationError } from '../utils/errorHandler';
import { v4 as uuidv4 } from 'uuid';

export interface EncryptionResult {
  encryptedData: string;
  keyId: string;
  encryptionAlgorithm: string;
}

export interface DecryptionResult {
  data: string;
  keyId: string;
}

export interface KeyGenerationResult {
  keyId: string;
  keyArn: string;
  keyAlias: string;
  keyUsage: KeyUsageType;
  keyState: KeyState;
}

export interface KeyRotationResult {
  keyId: string;
  rotationDate: string;
  nextRotationDate: string;
}

export interface KeyListResult {
  keys: Array<{
    keyId: string;
    keyArn: string;
    keyAlias: string;
    keyUsage: KeyUsageType;
    keyState: KeyState;
    creationDate: string;
    lastRotationDate?: string;
    nextRotationDate?: string;
  }>;
  totalCount: number;
}

export interface HealthCheckResult {
  kms: boolean;
  dynamodb: boolean;
  keyAccess: boolean;
}

/**
 * KMS Encryption Service
 * 
 * Provides centralized encryption/decryption services with multi-tenant key management,
 * automatic key rotation, and comprehensive audit logging.
 */
export class KMSEncryptionService {
  private kmsClient: KMSClient;
  private dynamoClient: DynamoDBClient;
  private readonly keysTableName: string;
  private readonly region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.kmsClient = new KMSClient({ region: this.region });
    this.dynamoClient = new DynamoDBClient({ region: this.region });
    this.keysTableName = process.env.KEYS_TABLE_NAME || 'compliance-shepherd-encryption-keys';
  }

  /**
   * Encrypt data using tenant-specific KMS key
   */
  async encrypt(
    data: string,
    tenantId: string,
    context?: string,
    keyAlias?: string
  ): Promise<EncryptionResult> {
    try {
      logger.info('Starting encryption operation', {
        tenantId,
        dataLength: data.length,
        hasContext: !!context,
        keyAlias
      });

      // Get or create tenant key
      const keyInfo = await this.getTenantKey(tenantId, keyAlias);
      
      // Prepare encryption context
      const encryptionContext: Record<string, string> = {
        tenantId,
        service: 'ai-compliance-shepherd',
        timestamp: new Date().toISOString()
      };

      if (context) {
        encryptionContext.context = context;
      }

      // Encrypt the data
      const encryptCommand = new EncryptCommand({
        KeyId: keyInfo.keyId,
        Plaintext: Buffer.from(data, 'utf8'),
        EncryptionContext: encryptionContext,
        EncryptionAlgorithm: EncryptionAlgorithmSpec.SYMMETRIC_DEFAULT
      });

      const encryptResult = await this.kmsClient.send(encryptCommand);

      if (!encryptResult.CiphertextBlob) {
        throw new EncryptionError('Encryption failed: No ciphertext returned');
      }

      // Convert to base64 for storage/transmission
      const encryptedData = Buffer.from(encryptResult.CiphertextBlob).toString('base64');

      // Log encryption operation
      await this.logEncryptionOperation(tenantId, keyInfo.keyId, 'encrypt', true);

      logger.info('Encryption operation completed successfully', {
        tenantId,
        keyId: keyInfo.keyId,
        encryptedDataLength: encryptedData.length
      });

      return {
        encryptedData,
        keyId: encryptResult.KeyId || keyInfo.keyId,
        encryptionAlgorithm: encryptResult.EncryptionAlgorithm || EncryptionAlgorithmSpec.SYMMETRIC_DEFAULT
      };

    } catch (error) {
      logger.error('Encryption operation failed', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Log failed operation
      await this.logEncryptionOperation(tenantId, keyAlias || 'unknown', 'encrypt', false, error);

      if (error instanceof EncryptionError || error instanceof ValidationError) {
        throw error;
      }

      throw new EncryptionError(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt data using KMS
   */
  async decrypt(
    encryptedData: string,
    tenantId: string,
    context?: string
  ): Promise<DecryptionResult> {
    try {
      logger.info('Starting decryption operation', {
        tenantId,
        encryptedDataLength: encryptedData.length,
        hasContext: !!context
      });

      // Convert from base64
      const ciphertextBlob = Buffer.from(encryptedData, 'base64');

      // Prepare encryption context for validation
      const encryptionContext: Record<string, string> = {
        tenantId,
        service: 'ai-compliance-shepherd'
      };

      if (context) {
        encryptionContext.context = context;
      }

      // Decrypt the data
      const decryptCommand = new DecryptCommand({
        CiphertextBlob: ciphertextBlob,
        EncryptionContext: encryptionContext
      });

      const decryptResult = await this.kmsClient.send(decryptCommand);

      if (!decryptResult.Plaintext) {
        throw new EncryptionError('Decryption failed: No plaintext returned');
      }

      const data = Buffer.from(decryptResult.Plaintext).toString('utf8');

      // Log decryption operation
      await this.logEncryptionOperation(tenantId, decryptResult.KeyId || 'unknown', 'decrypt', true);

      logger.info('Decryption operation completed successfully', {
        tenantId,
        keyId: decryptResult.KeyId,
        dataLength: data.length
      });

      return {
        data,
        keyId: decryptResult.KeyId || 'unknown'
      };

    } catch (error) {
      logger.error('Decryption operation failed', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Log failed operation
      await this.logEncryptionOperation(tenantId, 'unknown', 'decrypt', false, error);

      if (error instanceof EncryptionError || error instanceof ValidationError) {
        throw error;
      }

      throw new EncryptionError(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a new KMS key for a tenant
   */
  async generateKey(
    tenantId: string,
    keyAlias: string,
    keyUsage: KeyUsageType = KeyUsageType.ENCRYPT_DECRYPT,
    description?: string
  ): Promise<KeyGenerationResult> {
    try {
      logger.info('Starting key generation', {
        tenantId,
        keyAlias,
        keyUsage,
        description
      });

      // Check if key already exists
      const existingKey = await this.getKeyByAlias(tenantId, keyAlias);
      if (existingKey) {
        throw new ValidationError(`Key with alias '${keyAlias}' already exists for tenant '${tenantId}'`);
      }

      // Create the KMS key
      const createKeyCommand = new CreateKeyCommand({
        Description: description || `AI Compliance Shepherd encryption key for tenant ${tenantId}`,
        KeyUsage: keyUsage,
        KeySpec: 'SYMMETRIC_DEFAULT',
        Origin: 'AWS_KMS',
        Policy: this.generateKeyPolicy(tenantId),
        Tags: [
          { TagKey: 'TenantId', TagValue: tenantId },
          { TagKey: 'Service', TagValue: 'ai-compliance-shepherd' },
          { TagKey: 'KeyAlias', TagValue: keyAlias },
          { TagKey: 'CreatedBy', TagValue: 'kms-encryption-service' },
          { TagKey: 'CreatedAt', TagValue: new Date().toISOString() }
        ]
      });

      const createKeyResult = await this.kmsClient.send(createKeyCommand);

      if (!createKeyResult.KeyMetadata?.KeyId) {
        throw new EncryptionError('Key creation failed: No key ID returned');
      }

      const keyId = createKeyResult.KeyMetadata.KeyId;
      const keyArn = createKeyResult.KeyMetadata.Arn || '';

      // Create alias
      const fullAlias = `alias/compliance-shepherd/${tenantId}/${keyAlias}`;
      const createAliasCommand = new CreateAliasCommand({
        AliasName: fullAlias,
        TargetKeyId: keyId
      });

      await this.kmsClient.send(createAliasCommand);

      // Enable automatic key rotation
      const enableRotationCommand = new EnableKeyRotationCommand({
        KeyId: keyId
      });

      await this.kmsClient.send(enableRotationCommand);

      // Store key information in DynamoDB
      await this.storeKeyInfo(tenantId, keyAlias, keyId, keyArn, keyUsage);

      logger.info('Key generation completed successfully', {
        tenantId,
        keyId,
        keyAlias: fullAlias
      });

      return {
        keyId,
        keyArn,
        keyAlias: fullAlias,
        keyUsage,
        keyState: createKeyResult.KeyMetadata.KeyState || KeyState.Enabled
      };

    } catch (error) {
      logger.error('Key generation failed', {
        tenantId,
        keyAlias,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof EncryptionError || error instanceof ValidationError) {
        throw error;
      }

      throw new EncryptionError(`Key generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Rotate a KMS key
   */
  async rotateKey(tenantId: string, keyAlias: string): Promise<KeyRotationResult> {
    try {
      logger.info('Starting key rotation', { tenantId, keyAlias });

      const keyInfo = await this.getKeyByAlias(tenantId, keyAlias);
      if (!keyInfo) {
        throw new ValidationError(`Key with alias '${keyAlias}' not found for tenant '${tenantId}'`);
      }

      // Check current rotation status
      const rotationStatusCommand = new GetKeyRotationStatusCommand({
        KeyId: keyInfo.keyId
      });

      const rotationStatus = await this.kmsClient.send(rotationStatusCommand);

      if (!rotationStatus.KeyRotationEnabled) {
        // Enable rotation if not already enabled
        const enableRotationCommand = new EnableKeyRotationCommand({
          KeyId: keyInfo.keyId
        });

        await this.kmsClient.send(enableRotationCommand);
      }

      // Update key info with rotation date
      const rotationDate = new Date().toISOString();
      const nextRotationDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year from now

      await this.updateKeyRotationInfo(tenantId, keyAlias, rotationDate, nextRotationDate);

      logger.info('Key rotation completed successfully', {
        tenantId,
        keyId: keyInfo.keyId,
        rotationDate
      });

      return {
        keyId: keyInfo.keyId,
        rotationDate,
        nextRotationDate
      };

    } catch (error) {
      logger.error('Key rotation failed', {
        tenantId,
        keyAlias,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof EncryptionError || error instanceof ValidationError) {
        throw error;
      }

      throw new EncryptionError(`Key rotation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List keys for a tenant
   */
  async listKeys(tenantId: string): Promise<KeyListResult> {
    try {
      logger.info('Listing keys for tenant', { tenantId });

      const queryCommand = new QueryCommand({
        TableName: this.keysTableName,
        KeyConditionExpression: 'tenantId = :tenantId',
        ExpressionAttributeValues: marshall({
          ':tenantId': tenantId
        })
      });

      const result = await this.dynamoClient.send(queryCommand);
      const keys = result.Items?.map(item => unmarshall(item)) || [];

      // Enrich with current KMS status
      const enrichedKeys = await Promise.all(
        keys.map(async (key) => {
          try {
            const describeCommand = new DescribeKeyCommand({ KeyId: key.keyId });
            const keyMetadata = await this.kmsClient.send(describeCommand);

            return {
              keyId: key.keyId,
              keyArn: key.keyArn,
              keyAlias: key.keyAlias,
              keyUsage: key.keyUsage,
              keyState: keyMetadata.KeyMetadata?.KeyState || KeyState.Unknown,
              creationDate: key.creationDate,
              lastRotationDate: key.lastRotationDate,
              nextRotationDate: key.nextRotationDate
            };
          } catch (error) {
            logger.warn('Failed to get key metadata', {
              keyId: key.keyId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });

            return {
              keyId: key.keyId,
              keyArn: key.keyArn,
              keyAlias: key.keyAlias,
              keyUsage: key.keyUsage,
              keyState: KeyState.Unknown,
              creationDate: key.creationDate,
              lastRotationDate: key.lastRotationDate,
              nextRotationDate: key.nextRotationDate
            };
          }
        })
      );

      logger.info('Keys listed successfully', {
        tenantId,
        keyCount: enrichedKeys.length
      });

      return {
        keys: enrichedKeys,
        totalCount: enrichedKeys.length
      };

    } catch (error) {
      logger.error('Failed to list keys', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new EncryptionError(`Failed to list keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult = {
      kms: false,
      dynamodb: false,
      keyAccess: false
    };

    try {
      // Test KMS access
      const listKeysCommand = new ListKeysCommand({ Limit: 1 });
      await this.kmsClient.send(listKeysCommand);
      checks.kms = true;
    } catch (error) {
      logger.warn('KMS health check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    try {
      // Test DynamoDB access
      const queryCommand = new QueryCommand({
        TableName: this.keysTableName,
        KeyConditionExpression: 'tenantId = :tenantId',
        ExpressionAttributeValues: marshall({ ':tenantId': 'health-check' }),
        Limit: 1
      });
      await this.dynamoClient.send(queryCommand);
      checks.dynamodb = true;
    } catch (error) {
      logger.warn('DynamoDB health check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    try {
      // Test key access (try to describe a key)
      const listAliasesCommand = new ListAliasesCommand({ Limit: 1 });
      await this.kmsClient.send(listAliasesCommand);
      checks.keyAccess = true;
    } catch (error) {
      logger.warn('Key access health check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    return checks;
  }

  /**
   * Get or create tenant-specific key
   */
  private async getTenantKey(tenantId: string, keyAlias?: string): Promise<{ keyId: string; keyArn: string }> {
    const alias = keyAlias || 'default';
    
    // Try to get existing key
    let keyInfo = await this.getKeyByAlias(tenantId, alias);
    
    if (!keyInfo) {
      // Create new key if it doesn't exist
      const newKey = await this.generateKey(tenantId, alias);
      keyInfo = {
        keyId: newKey.keyId,
        keyArn: newKey.keyArn
      };
    }

    return keyInfo;
  }

  /**
   * Get key information by alias
   */
  private async getKeyByAlias(tenantId: string, keyAlias: string): Promise<{ keyId: string; keyArn: string } | null> {
    try {
      const getItemCommand = new GetItemCommand({
        TableName: this.keysTableName,
        Key: marshall({
          tenantId,
          keyAlias
        })
      });

      const result = await this.dynamoClient.send(getItemCommand);
      
      if (!result.Item) {
        return null;
      }

      const item = unmarshall(result.Item);
      return {
        keyId: item.keyId,
        keyArn: item.keyArn
      };

    } catch (error) {
      logger.warn('Failed to get key by alias', {
        tenantId,
        keyAlias,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Store key information in DynamoDB
   */
  private async storeKeyInfo(
    tenantId: string,
    keyAlias: string,
    keyId: string,
    keyArn: string,
    keyUsage: KeyUsageType
  ): Promise<void> {
    const putItemCommand = new PutItemCommand({
      TableName: this.keysTableName,
      Item: marshall({
        tenantId,
        keyAlias,
        keyId,
        keyArn,
        keyUsage,
        creationDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      })
    });

    await this.dynamoClient.send(putItemCommand);
  }

  /**
   * Update key rotation information
   */
  private async updateKeyRotationInfo(
    tenantId: string,
    keyAlias: string,
    rotationDate: string,
    nextRotationDate: string
  ): Promise<void> {
    const updateItemCommand = new UpdateItemCommand({
      TableName: this.keysTableName,
      Key: marshall({ tenantId, keyAlias }),
      UpdateExpression: 'SET lastRotationDate = :rotationDate, nextRotationDate = :nextRotationDate, lastUpdated = :lastUpdated',
      ExpressionAttributeValues: marshall({
        ':rotationDate': rotationDate,
        ':nextRotationDate': nextRotationDate,
        ':lastUpdated': new Date().toISOString()
      })
    });

    await this.dynamoClient.send(updateItemCommand);
  }

  /**
   * Log encryption/decryption operations for audit purposes
   */
  private async logEncryptionOperation(
    tenantId: string,
    keyId: string,
    operation: 'encrypt' | 'decrypt',
    success: boolean,
    error?: any
  ): Promise<void> {
    try {
      const logEntry = {
        tenantId,
        keyId,
        operation,
        success,
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
        error: error ? (error instanceof Error ? error.message : String(error)) : undefined
      };

      // In a production environment, you might want to send this to a dedicated audit log table
      logger.info('Encryption operation logged', logEntry);

    } catch (logError) {
      logger.error('Failed to log encryption operation', {
        tenantId,
        keyId,
        operation,
        error: logError instanceof Error ? logError.message : 'Unknown error'
      });
    }
  }

  /**
   * Generate key policy for tenant isolation
   */
  private generateKeyPolicy(tenantId: string): string {
    return JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'Enable IAM User Permissions',
          Effect: 'Allow',
          Principal: {
            AWS: `arn:aws:iam::${process.env.AWS_ACCOUNT_ID || '*'}:root`
          },
          Action: 'kms:*',
          Resource: '*'
        },
        {
          Sid: 'Allow use of the key for encryption/decryption',
          Effect: 'Allow',
          Principal: {
            AWS: `arn:aws:iam::${process.env.AWS_ACCOUNT_ID || '*'}:role/ai-compliance-shepherd-*`
          },
          Action: [
            'kms:Encrypt',
            'kms:Decrypt',
            'kms:ReEncrypt*',
            'kms:GenerateDataKey*',
            'kms:DescribeKey'
          ],
          Resource: '*',
          Condition: {
            StringEquals: {
              'kms:EncryptionContext:tenantId': tenantId,
              'kms:EncryptionContext:service': 'ai-compliance-shepherd'
            }
          }
        }
      ]
    });
  }
}
