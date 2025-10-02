import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface SecurityStackProps extends StackProps {
  config: {
    account: string;
    region: string;
    environment: string;
    stage: string;
    prefix: string;
  };
  description: string;
}

export class SecurityStack extends Stack {
  public readonly platformExecutionRole: iam.Role;
  public readonly scanRole: iam.Role;
  public readonly remediationRole: iam.Role;
  public readonly auditRole: iam.Role;
  public readonly readonlyRole: iam.Role;
  public readonly dynamoDBKey: kms.Key;
  public readonly s3Key: kms.Key;
  public readonly apiKey: kms.Key;
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly secretsManagerKey: kms.Key;

  constructor(scope: Construct, id: string, props: SecurityStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Platform Execution Role (for Lambda functions)
    this.platformExecutionRole = new iam.Role(this, 'PlatformExecutionRole', {
      roleName: `${config.prefix}-platform-execution-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Cross-Account Scanning Role
    this.scanRole = new iam.Role(this, 'ScanRole', {
      roleName: `${config.prefix}-scan-role`,
      assumedBy: new iam.AccountPrincipal(config.account),
      inlinePolicies: {
        ScanPermissions: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ec2:DescribeInstances',
                'ec2:DescribeSecurityGroups',
                'ec2:DescribeVolumes',
                'ec2:DescribeImages',
                'ec2:DescribeSubnets',
                'ec2:DescribeVpcs',
                's3:ListBucket',
                's3:GetBucketPolicy',
                's3:GetBucketAcl',
                's3:GetBucketVersioning',
                's3:GetBucketPublicAccessBlock',
                's3:GetBucketEncryption',
                'iam:ListUsers',
                'iam:ListRoles',
                'iam:ListPolicies',
                'iam:GetPolicy',
                'iam:GetPolicyVersion',
                'iam:GetRole',
                'iam:GetRolePolicy',
                'iam:ListAttachedRolePolicies',
                'iam:ListRolePolicies',
                'cloudtrail:DescribeTrails',
                'cloudtrail:GetTrailStatus',
                'cloudtrail:GetEventSelectors',
                'rds:DescribeDBInstances',
                'rds:DescribeDBSnapshots',
                'lambda:ListFunctions',
                'lambda:GetFunction',
                'kms:ListKeys',
                'kms:DescribeKey',
                'kms:GetKeyPolicy',
                'kms:GetKeyRotationStatus',
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // Cross-Account Remediation Role
    this.remediationRole = new iam.Role(this, 'RemediationRole', {
      roleName: `${config.prefix}-remediation-role`,
      assumedBy: new iam.AccountPrincipal(config.account),
      inlinePolicies: {
        RemediationPermissions: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:PutBucketPolicy',
                's3:PutBucketAcl',
                's3:PutBucketPublicAccessBlock',
                's3:PutEncryptionConfiguration',
                'iam:AttachRolePolicy',
                'iam:DetachRolePolicy',
                'iam:PutRolePolicy',
                'iam:DeleteRolePolicy',
                'iam:UpdateAssumeRolePolicy',
                'ec2:AuthorizeSecurityGroupEgress',
                'ec2:AuthorizeSecurityGroupIngress',
                'ec2:RevokeSecurityGroupEgress',
                'ec2:RevokeSecurityGroupIngress',
                'cloudtrail:PutEventSelectors',
                'cloudtrail:StartLogging',
                'rds:ModifyDBInstance',
                'lambda:UpdateFunctionConfiguration',
                'kms:EnableKeyRotation',
                'kms:TagResource',
              ],
              resources: ['*'],
              conditions: {
                'StringEquals': {
                  'aws:RequestedRegion': config.region,
                },
              },
            }),
          ],
        }),
      },
    });

    // Cross-Account Audit Role
    this.auditRole = new iam.Role(this, 'AuditRole', {
      roleName: `${config.prefix}-audit-role`,
      assumedBy: new iam.AccountPrincipal(config.account),
      inlinePolicies: {
        AuditPermissions: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cloudtrail:LookupEvents',
                'config:BatchGetResourceConfigs',
                'config:GetResourceConfigHistory',
                'config:ListDiscoveredResources',
                'logs:DescribeLogGroups',
                'logs:DescribeLogStreams',
                'logs:GetLogEvents',
                'cloudwatch:GetMetricStatistics',
                'cloudwatch:ListMetrics',
                'organizations:DescribeOrganization',
                'organizations:ListAccounts',
                'organizations:ListOrganizationalUnitsForParent',
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // Cross-Account Read-Only Role
    this.readonlyRole = new iam.Role(this, 'ReadOnlyRole', {
      roleName: `${config.prefix}-readonly-role`,
      assumedBy: new iam.AccountPrincipal(config.account),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'),
      ],
    });

    // DynamoDB Encryption Key
    this.dynamoDBKey = new kms.Key(this, 'DynamoDBEncryptionKey', {
      keyName: `${config.prefix}-dynamodb-key`,
      description: `DynamoDB encryption key for ${config.prefix}`,
      enableKeyRotation: true,
      alias: `${config.prefix}-dynamodb-alias`,
    });

    // S3 Encryption Key
    this.s3Key = new kms.Key(this, 'S3EncryptionKey', {
      keyName: `${config.prefix}-s3-key`,
      description: `S3 encryption key for ${config.prefix}`,
      enableKeyRotation: true,
      alias: `${config.prefix}-s3-alias`,
    });

    // API Encryption Key
    this.apiKey = new kms.Key(this, 'APIEncryptionKey', {
      keyName: `${config.prefix}-api-key`,
      description: `API encryption key for ${config.prefix}`,
      enableKeyRotation: true,
      alias: `${config.prefix}-api-alias`,
    });

    // Secrets Manager KMS Key
    this.secretsManagerKey = new kms.Key(this, 'SecretsManagerKey', {
      keyName: `${config.prefix}-secrets-key`,
      description: `Secrets Manager encryption key for ${config.prefix}`,
      enableKeyRotation: true,
      alias: `${config.prefix}-secrets-alias`,
    });

    // Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${config.prefix}-users`,
      selfSignUpEnabled: false,
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: true,
          mutable: true,
        },
        familyName: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        tenantId: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 256,
          mutable: true,
        }),
        role: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 50,
          mutable: true,
        }),
        department: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 100,
          mutable: true,
        }),
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      mfaSecondFactor: {
        type: cognito.Mfa.OPTIONAL,
      },
      removalPolicy: config.environment === 'prod' ? cognito.RemovalPolicy.RETAIN : cognito.RemovalPolicy.DESTROY,
    });

    // Cognito User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `${config.prefix}-client`,
      generateSecret: true,
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      tokenValidityUnits: {
        accessToken: cognito.TokenValidityUnit.HOURS,
        idToken: cognito.TokenValidityUnit.HOURS,
        refreshToken: cognito.TokenValidityUnit.DAYS,
      },
      preventUserExistenceErrors: true,
      authFlows: {
        userPassword: true,
        userSrp: true,
        refreshToken: true,
        adminUserPassword: true,
      },
    });

    // Secrets Manager for API keys and sensitive data
    const secretsManagerRole = new iam.Role(this, 'SecretsManagerRole', {
      assumedBy: this.platformExecutionRole,
      inlinePolicies: {
        SecretsManagerAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'secretsmanager:GetSecretValue',
                'secretsmanager:DescribeSecret',
                'secretsmanager:CreateSecret',
                'secretsmanager:UpdateSecret',
                'secretsmanager:TagResource',
                'secretsmanager:UntagResource',
              ],
              resources: [`arn:aws:secretsmanager:${config.region}:${config.account}:secret:${config.prefix}/*`],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'kms:Decrypt',
                kms:Encrypt,
                'kms:GenerateDataKey',
                'kms:CreateGrant',
              ],
              resources: [this.secretsManagerKey.keyArn],
            }),
          ],
        }),
      },
    });

    // Platform execution role updates
    this.platformExecutionRole.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:*',
        's3:*',
        'kms:*',
        'cloudwatch:*',
        'logs:*',
        'xray:*',
        'states:*',
        'events:*',
        'events:TagResource',
        'lambda:*',
        'apigateway:*',
        'bedrock:*',
        'bedrockagent:*',
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:GetParametersByPath',
      ],
      resources: ['*'],
    }));

    // Outputs
    new CfnOutput(this, 'IAMRoles', {
      value: JSON.stringify({
        platformExecution: this.platformExecutionRole.roleArn,
        scan: this.scanRole.roleArn,
        remediation: this.remediationRole.roleArn,
        audit: this.auditRole.roleArn,
        readonly: this.readonlyRole.roleArn,
      }),
      description: 'IAM Role ARNs'
    });

    new CfnOutput(this, 'KMSKeys', {
      value: JSON.stringify({
        dynamoDB: this.dynamoDBKey.keyArn,
        s3: this.s3Key.keyArn,
        api: this.apiKey.keyArn,
        secrets: this.secretsManagerKey.keyArn,
      }),
      description: 'KMS Key ARNs'
    });

    new CfnOutput(this, 'CognitoUserPool', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID'
    });

    new CfnOutput(this, 'CognitoClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID'
    });

    new CfnOutput(this, 'SecurityStackName', {
      value: this.stackName,
      description: 'Security Stack Name'
    });
  }

  public get stackName(): string {
    return this.stackName;
  }
}
