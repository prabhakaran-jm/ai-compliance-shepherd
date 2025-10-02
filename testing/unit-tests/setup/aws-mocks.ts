/**
 * AWS SDK mocks for unit testing
 * 
 * This file provides comprehensive mocking for all AWS SDK clients
 * used throughout the AI Compliance Shepherd platform.
 */

import { jest } from '@jest/globals';

// Mock data for AWS responses
const mockAWSResponses = {
  // DynamoDB mock responses
  dynamodb: {
    putItem: { $metadata: { requestId: 'test-request-id' } },
    getItem: { 
      Item: { 
        id: { S: 'test-id' }, 
        name: { S: 'test-name' } 
      } 
    },
    query: { 
      Items: [
        { id: { S: 'test-id-1' }, name: { S: 'test-name-1' } },
        { id: { S: 'test-id-2' }, name: { S: 'test-name-2' } }
      ],
      Count: 2
    },
    scan: { 
      Items: [
        { id: { S: 'test-id-1' }, name: { S: 'test-name-1' } }
      ],
      Count: 1
    },
    updateItem: { $metadata: { requestId: 'test-request-id' } },
    deleteItem: { $metadata: { requestId: 'test-request-id' } }
  },

  // S3 mock responses
  s3: {
    putObject: { ETag: '"test-etag"' },
    getObject: { 
      Body: Buffer.from('test content'),
      ContentType: 'application/json'
    },
    listObjectsV2: {
      Contents: [
        { Key: 'test-file-1.json', Size: 1024 },
        { Key: 'test-file-2.json', Size: 2048 }
      ]
    },
    deleteObject: { $metadata: { requestId: 'test-request-id' } },
    headObject: { 
      ContentLength: 1024,
      LastModified: new Date()
    },
    createBucket: { Location: 'http://test-bucket.s3.amazonaws.com/' },
    getBucketPolicy: {
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: []
      })
    }
  },

  // Lambda mock responses
  lambda: {
    invoke: {
      StatusCode: 200,
      Payload: Buffer.from(JSON.stringify({ success: true }))
    },
    createFunction: {
      FunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function'
    },
    updateFunctionCode: {
      FunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function'
    }
  },

  // CloudWatch mock responses
  cloudwatch: {
    putMetricData: { $metadata: { requestId: 'test-request-id' } },
    getMetricStatistics: {
      Datapoints: [
        { Timestamp: new Date(), Average: 100, Unit: 'Count' }
      ]
    },
    listMetrics: {
      Metrics: [
        { MetricName: 'TestMetric', Namespace: 'Test' }
      ]
    },
    putDashboard: { $metadata: { requestId: 'test-request-id' } },
    putMetricAlarm: { $metadata: { requestId: 'test-request-id' } }
  },

  // KMS mock responses
  kms: {
    createKey: {
      KeyMetadata: {
        KeyId: 'test-key-id',
        Arn: 'arn:aws:kms:us-east-1:123456789012:key/test-key-id'
      }
    },
    encrypt: {
      CiphertextBlob: Buffer.from('encrypted-data'),
      KeyId: 'test-key-id'
    },
    decrypt: {
      Plaintext: Buffer.from('decrypted-data'),
      KeyId: 'test-key-id'
    },
    listKeys: {
      Keys: [
        { KeyId: 'test-key-id-1' },
        { KeyId: 'test-key-id-2' }
      ]
    }
  },

  // Secrets Manager mock responses
  secretsmanager: {
    createSecret: {
      ARN: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret',
      Name: 'test-secret'
    },
    getSecretValue: {
      SecretString: JSON.stringify({ key: 'value' }),
      ARN: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret'
    },
    updateSecret: {
      ARN: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret'
    },
    deleteSecret: {
      ARN: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret',
      DeletionDate: new Date()
    }
  },

  // STS mock responses
  sts: {
    assumeRole: {
      Credentials: {
        AccessKeyId: 'AKIATEST',
        SecretAccessKey: 'test-secret',
        SessionToken: 'test-session-token',
        Expiration: new Date(Date.now() + 3600000)
      }
    },
    getCallerIdentity: {
      Account: '123456789012',
      Arn: 'arn:aws:iam::123456789012:user/test-user',
      UserId: 'AIDATEST'
    }
  },

  // SNS mock responses
  sns: {
    publish: {
      MessageId: 'test-message-id'
    },
    createTopic: {
      TopicArn: 'arn:aws:sns:us-east-1:123456789012:test-topic'
    }
  },

  // EventBridge mock responses
  eventbridge: {
    putEvents: {
      FailedEntryCount: 0,
      Entries: []
    },
    putRule: {
      RuleArn: 'arn:aws:events:us-east-1:123456789012:rule/test-rule'
    }
  },

  // X-Ray mock responses
  xray: {
    getTraceSummaries: {
      TraceSummaries: [
        {
          Id: 'test-trace-id',
          Duration: 1.5,
          ResponseTime: 0.5
        }
      ]
    },
    batchGetTraces: {
      Traces: [
        {
          Id: 'test-trace-id',
          Duration: 1.5,
          Segments: []
        }
      ]
    }
  },

  // Bedrock mock responses
  bedrock: {
    invokeModel: {
      body: Buffer.from(JSON.stringify({
        completion: 'This is a test response from the AI model.',
        stop_reason: 'end_turn'
      }))
    },
    createKnowledgeBase: {
      knowledgeBase: {
        knowledgeBaseId: 'test-kb-id',
        name: 'test-knowledge-base'
      }
    }
  },

  // Step Functions mock responses
  stepfunctions: {
    startExecution: {
      executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-state-machine:test-execution',
      startDate: new Date()
    },
    describeExecution: {
      status: 'SUCCEEDED',
      startDate: new Date(),
      stopDate: new Date()
    }
  }
};

// Create mock functions for AWS SDK clients
export const setupAWSMocks = (): void => {
  // Mock AWS SDK v3 clients
  jest.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockImplementation((command) => {
        const commandName = command.constructor.name;
        switch (commandName) {
          case 'PutItemCommand':
            return Promise.resolve(mockAWSResponses.dynamodb.putItem);
          case 'GetItemCommand':
            return Promise.resolve(mockAWSResponses.dynamodb.getItem);
          case 'QueryCommand':
            return Promise.resolve(mockAWSResponses.dynamodb.query);
          case 'ScanCommand':
            return Promise.resolve(mockAWSResponses.dynamodb.scan);
          case 'UpdateItemCommand':
            return Promise.resolve(mockAWSResponses.dynamodb.updateItem);
          case 'DeleteItemCommand':
            return Promise.resolve(mockAWSResponses.dynamodb.deleteItem);
          default:
            return Promise.resolve({});
        }
      })
    })),
    PutItemCommand: jest.fn(),
    GetItemCommand: jest.fn(),
    QueryCommand: jest.fn(),
    ScanCommand: jest.fn(),
    UpdateItemCommand: jest.fn(),
    DeleteItemCommand: jest.fn(),
    marshall: jest.fn().mockImplementation((obj) => obj),
    unmarshall: jest.fn().mockImplementation((obj) => obj)
  }));

  jest.mock('@aws-sdk/client-s3', () => ({
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockImplementation((command) => {
        const commandName = command.constructor.name;
        switch (commandName) {
          case 'PutObjectCommand':
            return Promise.resolve(mockAWSResponses.s3.putObject);
          case 'GetObjectCommand':
            return Promise.resolve(mockAWSResponses.s3.getObject);
          case 'ListObjectsV2Command':
            return Promise.resolve(mockAWSResponses.s3.listObjectsV2);
          case 'DeleteObjectCommand':
            return Promise.resolve(mockAWSResponses.s3.deleteObject);
          case 'HeadObjectCommand':
            return Promise.resolve(mockAWSResponses.s3.headObject);
          case 'CreateBucketCommand':
            return Promise.resolve(mockAWSResponses.s3.createBucket);
          case 'GetBucketPolicyCommand':
            return Promise.resolve(mockAWSResponses.s3.getBucketPolicy);
          default:
            return Promise.resolve({});
        }
      })
    })),
    PutObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
    ListObjectsV2Command: jest.fn(),
    DeleteObjectCommand: jest.fn(),
    HeadObjectCommand: jest.fn(),
    CreateBucketCommand: jest.fn(),
    GetBucketPolicyCommand: jest.fn()
  }));

  jest.mock('@aws-sdk/client-lambda', () => ({
    LambdaClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockImplementation((command) => {
        const commandName = command.constructor.name;
        switch (commandName) {
          case 'InvokeCommand':
            return Promise.resolve(mockAWSResponses.lambda.invoke);
          case 'CreateFunctionCommand':
            return Promise.resolve(mockAWSResponses.lambda.createFunction);
          case 'UpdateFunctionCodeCommand':
            return Promise.resolve(mockAWSResponses.lambda.updateFunctionCode);
          default:
            return Promise.resolve({});
        }
      })
    })),
    InvokeCommand: jest.fn(),
    CreateFunctionCommand: jest.fn(),
    UpdateFunctionCodeCommand: jest.fn()
  }));

  jest.mock('@aws-sdk/client-cloudwatch', () => ({
    CloudWatchClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockImplementation((command) => {
        const commandName = command.constructor.name;
        switch (commandName) {
          case 'PutMetricDataCommand':
            return Promise.resolve(mockAWSResponses.cloudwatch.putMetricData);
          case 'GetMetricStatisticsCommand':
            return Promise.resolve(mockAWSResponses.cloudwatch.getMetricStatistics);
          case 'ListMetricsCommand':
            return Promise.resolve(mockAWSResponses.cloudwatch.listMetrics);
          case 'PutDashboardCommand':
            return Promise.resolve(mockAWSResponses.cloudwatch.putDashboard);
          case 'PutMetricAlarmCommand':
            return Promise.resolve(mockAWSResponses.cloudwatch.putMetricAlarm);
          default:
            return Promise.resolve({});
        }
      })
    })),
    PutMetricDataCommand: jest.fn(),
    GetMetricStatisticsCommand: jest.fn(),
    ListMetricsCommand: jest.fn(),
    PutDashboardCommand: jest.fn(),
    PutMetricAlarmCommand: jest.fn()
  }));

  jest.mock('@aws-sdk/client-kms', () => ({
    KMSClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockImplementation((command) => {
        const commandName = command.constructor.name;
        switch (commandName) {
          case 'CreateKeyCommand':
            return Promise.resolve(mockAWSResponses.kms.createKey);
          case 'EncryptCommand':
            return Promise.resolve(mockAWSResponses.kms.encrypt);
          case 'DecryptCommand':
            return Promise.resolve(mockAWSResponses.kms.decrypt);
          case 'ListKeysCommand':
            return Promise.resolve(mockAWSResponses.kms.listKeys);
          default:
            return Promise.resolve({});
        }
      })
    })),
    CreateKeyCommand: jest.fn(),
    EncryptCommand: jest.fn(),
    DecryptCommand: jest.fn(),
    ListKeysCommand: jest.fn()
  }));

  jest.mock('@aws-sdk/client-secrets-manager', () => ({
    SecretsManagerClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockImplementation((command) => {
        const commandName = command.constructor.name;
        switch (commandName) {
          case 'CreateSecretCommand':
            return Promise.resolve(mockAWSResponses.secretsmanager.createSecret);
          case 'GetSecretValueCommand':
            return Promise.resolve(mockAWSResponses.secretsmanager.getSecretValue);
          case 'UpdateSecretCommand':
            return Promise.resolve(mockAWSResponses.secretsmanager.updateSecret);
          case 'DeleteSecretCommand':
            return Promise.resolve(mockAWSResponses.secretsmanager.deleteSecret);
          default:
            return Promise.resolve({});
        }
      })
    })),
    CreateSecretCommand: jest.fn(),
    GetSecretValueCommand: jest.fn(),
    UpdateSecretCommand: jest.fn(),
    DeleteSecretCommand: jest.fn()
  }));

  // Mock other AWS services
  jest.mock('@aws-sdk/client-sts', () => ({
    STSClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockImplementation(() => Promise.resolve(mockAWSResponses.sts.assumeRole))
    })),
    AssumeRoleCommand: jest.fn(),
    GetCallerIdentityCommand: jest.fn()
  }));

  jest.mock('@aws-sdk/client-sns', () => ({
    SNSClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockImplementation(() => Promise.resolve(mockAWSResponses.sns.publish))
    })),
    PublishCommand: jest.fn(),
    CreateTopicCommand: jest.fn()
  }));

  jest.mock('@aws-sdk/client-eventbridge', () => ({
    EventBridgeClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockImplementation(() => Promise.resolve(mockAWSResponses.eventbridge.putEvents))
    })),
    PutEventsCommand: jest.fn(),
    PutRuleCommand: jest.fn()
  }));

  // Mock X-Ray SDK
  jest.mock('aws-xray-sdk-core', () => ({
    captureAWS: jest.fn().mockImplementation((service) => service),
    captureHTTPs: jest.fn().mockImplementation((module) => module),
    captureFunc: jest.fn().mockImplementation((name, fn) => fn()),
    captureAsyncFunc: jest.fn().mockImplementation((name, fn) => fn({})),
    getSegment: jest.fn().mockReturnValue({
      id: 'test-segment-id',
      trace_id: 'test-trace-id',
      addAnnotation: jest.fn(),
      addMetadata: jest.fn(),
      addError: jest.fn(),
      close: jest.fn()
    }),
    setSegment: jest.fn(),
    Segment: jest.fn().mockImplementation((name) => ({
      name,
      id: 'test-segment-id',
      trace_id: 'test-trace-id',
      addAnnotation: jest.fn(),
      addMetadata: jest.fn(),
      addError: jest.fn(),
      close: jest.fn()
    }))
  }));
};

// Export mock data for use in tests
export { mockAWSResponses };

// Utility functions for creating test-specific mocks
export const createMockDynamoDBClient = () => ({
  send: jest.fn().mockResolvedValue(mockAWSResponses.dynamodb.putItem)
});

export const createMockS3Client = () => ({
  send: jest.fn().mockResolvedValue(mockAWSResponses.s3.putObject)
});

export const createMockLambdaClient = () => ({
  send: jest.fn().mockResolvedValue(mockAWSResponses.lambda.invoke)
});

export const createMockCloudWatchClient = () => ({
  send: jest.fn().mockResolvedValue(mockAWSResponses.cloudwatch.putMetricData)
});

export const createMockKMSClient = () => ({
  send: jest.fn().mockResolvedValue(mockAWSResponses.kms.encrypt)
});

export const createMockSecretsManagerClient = () => ({
  send: jest.fn().mockResolvedValue(mockAWSResponses.secretsmanager.getSecretValue)
});
