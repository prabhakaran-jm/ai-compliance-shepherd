"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const iam = require("aws-cdk-lib/aws-iam");
const kms = require("aws-cdk-lib/aws-kms");
const cognito = require("aws-cdk-lib/aws-cognito");
class SecurityStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
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
                                kms, Encrypt,
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
        new aws_cdk_lib_1.CfnOutput(this, 'IAMRoles', {
            value: JSON.stringify({
                platformExecution: this.platformExecutionRole.roleArn,
                scan: this.scanRole.roleArn,
                remediation: this.remediationRole.roleArn,
                audit: this.auditRole.roleArn,
                readonly: this.readonlyRole.roleArn,
            }),
            description: 'IAM Role ARNs'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'KMSKeys', {
            value: JSON.stringify({
                dynamoDB: this.dynamoDBKey.keyArn,
                s3: this.s3Key.keyArn,
                api: this.apiKey.keyArn,
                secrets: this.secretsManagerKey.keyArn,
            }),
            description: 'KMS Key ARNs'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'CognitoUserPool', {
            value: this.userPool.userPoolId,
            description: 'Cognito User Pool ID'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'CognitoClientId', {
            value: this.userPoolClient.userPoolClientId,
            description: 'Cognito User Pool Client ID'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'SecurityStackName', {
            value: this.stackName,
            description: 'Security Stack Name'
        });
    }
    get stackName() {
        return this.stackName;
    }
}
exports.SecurityStack = SecurityStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvc2VjdXJpdHktc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsNkNBQTJEO0FBQzNELDJDQUEyQztBQUMzQywyQ0FBMkM7QUFDM0MsbURBQW1EO0FBZW5ELE1BQWEsYUFBYyxTQUFRLG1CQUFLO0lBYXRDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBeUI7UUFDakUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV6QixpREFBaUQ7UUFDakQsSUFBSSxDQUFDLHFCQUFxQixHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDdkUsUUFBUSxFQUFFLEdBQUcsTUFBTSxDQUFDLE1BQU0sMEJBQTBCO1lBQ3BELFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxzQkFBc0IsQ0FBQztZQUMzRCxlQUFlLEVBQUU7Z0JBQ2YsR0FBRyxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQywwQ0FBMEMsQ0FBQzthQUN2RjtTQUNGLENBQUMsQ0FBQztRQUVILDhCQUE4QjtRQUM5QixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFO1lBQzdDLFFBQVEsRUFBRSxHQUFHLE1BQU0sQ0FBQyxNQUFNLFlBQVk7WUFDdEMsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7WUFDbkQsY0FBYyxFQUFFO2dCQUNkLGVBQWUsRUFBRSxJQUFJLEdBQUcsQ0FBQyxjQUFjLENBQUM7b0JBQ3RDLFVBQVUsRUFBRTt3QkFDVixJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7NEJBQ3RC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V0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBTdGFjaywgU3RhY2tQcm9wcywgQ2ZuT3V0cHV0IH0gZnJvbSAnYXdzLWNkay1saWInO1xyXG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XHJcbmltcG9ydCAqIGFzIGttcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mta21zJztcclxuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XHJcbmltcG9ydCAqIGFzIHNlY3JldHNtYW5hZ2VyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zZWNyZXRzbWFuYWdlcic7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBTZWN1cml0eVN0YWNrUHJvcHMgZXh0ZW5kcyBTdGFja1Byb3BzIHtcclxuICBjb25maWc6IHtcclxuICAgIGFjY291bnQ6IHN0cmluZztcclxuICAgIHJlZ2lvbjogc3RyaW5nO1xyXG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZztcclxuICAgIHN0YWdlOiBzdHJpbmc7XHJcbiAgICBwcmVmaXg6IHN0cmluZztcclxuICB9O1xyXG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBTZWN1cml0eVN0YWNrIGV4dGVuZHMgU3RhY2sge1xyXG4gIHB1YmxpYyByZWFkb25seSBwbGF0Zm9ybUV4ZWN1dGlvblJvbGU6IGlhbS5Sb2xlO1xyXG4gIHB1YmxpYyByZWFkb25seSBzY2FuUm9sZTogaWFtLlJvbGU7XHJcbiAgcHVibGljIHJlYWRvbmx5IHJlbWVkaWF0aW9uUm9sZTogaWFtLlJvbGU7XHJcbiAgcHVibGljIHJlYWRvbmx5IGF1ZGl0Um9sZTogaWFtLlJvbGU7XHJcbiAgcHVibGljIHJlYWRvbmx5IHJlYWRvbmx5Um9sZTogaWFtLlJvbGU7XHJcbiAgcHVibGljIHJlYWRvbmx5IGR5bmFtb0RCS2V5OiBrbXMuS2V5O1xyXG4gIHB1YmxpYyByZWFkb25seSBzM0tleToga21zLktleTtcclxuICBwdWJsaWMgcmVhZG9ubHkgYXBpS2V5OiBrbXMuS2V5O1xyXG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbDogY29nbml0by5Vc2VyUG9vbDtcclxuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2xDbGllbnQ6IGNvZ25pdG8uVXNlclBvb2xDbGllbnQ7XHJcbiAgcHVibGljIHJlYWRvbmx5IHNlY3JldHNNYW5hZ2VyS2V5OiBrbXMuS2V5O1xyXG5cclxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogU2VjdXJpdHlTdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuXHJcbiAgICBjb25zdCB7IGNvbmZpZyB9ID0gcHJvcHM7XHJcblxyXG4gICAgLy8gUGxhdGZvcm0gRXhlY3V0aW9uIFJvbGUgKGZvciBMYW1iZGEgZnVuY3Rpb25zKVxyXG4gICAgdGhpcy5wbGF0Zm9ybUV4ZWN1dGlvblJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ1BsYXRmb3JtRXhlY3V0aW9uUm9sZScsIHtcclxuICAgICAgcm9sZU5hbWU6IGAke2NvbmZpZy5wcmVmaXh9LXBsYXRmb3JtLWV4ZWN1dGlvbi1yb2xlYCxcclxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXHJcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xyXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxyXG4gICAgICBdLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ3Jvc3MtQWNjb3VudCBTY2FubmluZyBSb2xlXHJcbiAgICB0aGlzLnNjYW5Sb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdTY2FuUm9sZScsIHtcclxuICAgICAgcm9sZU5hbWU6IGAke2NvbmZpZy5wcmVmaXh9LXNjYW4tcm9sZWAsXHJcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5BY2NvdW50UHJpbmNpcGFsKGNvbmZpZy5hY2NvdW50KSxcclxuICAgICAgaW5saW5lUG9saWNpZXM6IHtcclxuICAgICAgICBTY2FuUGVybWlzc2lvbnM6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xyXG4gICAgICAgICAgc3RhdGVtZW50czogW1xyXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgICAgICAgICdlYzI6RGVzY3JpYmVJbnN0YW5jZXMnLFxyXG4gICAgICAgICAgICAgICAgJ2VjMjpEZXNjcmliZVNlY3VyaXR5R3JvdXBzJyxcclxuICAgICAgICAgICAgICAgICdlYzI6RGVzY3JpYmVWb2x1bWVzJyxcclxuICAgICAgICAgICAgICAgICdlYzI6RGVzY3JpYmVJbWFnZXMnLFxyXG4gICAgICAgICAgICAgICAgJ2VjMjpEZXNjcmliZVN1Ym5ldHMnLFxyXG4gICAgICAgICAgICAgICAgJ2VjMjpEZXNjcmliZVZwY3MnLFxyXG4gICAgICAgICAgICAgICAgJ3MzOkxpc3RCdWNrZXQnLFxyXG4gICAgICAgICAgICAgICAgJ3MzOkdldEJ1Y2tldFBvbGljeScsXHJcbiAgICAgICAgICAgICAgICAnczM6R2V0QnVja2V0QWNsJyxcclxuICAgICAgICAgICAgICAgICdzMzpHZXRCdWNrZXRWZXJzaW9uaW5nJyxcclxuICAgICAgICAgICAgICAgICdzMzpHZXRCdWNrZXRQdWJsaWNBY2Nlc3NCbG9jaycsXHJcbiAgICAgICAgICAgICAgICAnczM6R2V0QnVja2V0RW5jcnlwdGlvbicsXHJcbiAgICAgICAgICAgICAgICAnaWFtOkxpc3RVc2VycycsXHJcbiAgICAgICAgICAgICAgICAnaWFtOkxpc3RSb2xlcycsXHJcbiAgICAgICAgICAgICAgICAnaWFtOkxpc3RQb2xpY2llcycsXHJcbiAgICAgICAgICAgICAgICAnaWFtOkdldFBvbGljeScsXHJcbiAgICAgICAgICAgICAgICAnaWFtOkdldFBvbGljeVZlcnNpb24nLFxyXG4gICAgICAgICAgICAgICAgJ2lhbTpHZXRSb2xlJyxcclxuICAgICAgICAgICAgICAgICdpYW06R2V0Um9sZVBvbGljeScsXHJcbiAgICAgICAgICAgICAgICAnaWFtOkxpc3RBdHRhY2hlZFJvbGVQb2xpY2llcycsXHJcbiAgICAgICAgICAgICAgICAnaWFtOkxpc3RSb2xlUG9saWNpZXMnLFxyXG4gICAgICAgICAgICAgICAgJ2Nsb3VkdHJhaWw6RGVzY3JpYmVUcmFpbHMnLFxyXG4gICAgICAgICAgICAgICAgJ2Nsb3VkdHJhaWw6R2V0VHJhaWxTdGF0dXMnLFxyXG4gICAgICAgICAgICAgICAgJ2Nsb3VkdHJhaWw6R2V0RXZlbnRTZWxlY3RvcnMnLFxyXG4gICAgICAgICAgICAgICAgJ3JkczpEZXNjcmliZURCSW5zdGFuY2VzJyxcclxuICAgICAgICAgICAgICAgICdyZHM6RGVzY3JpYmVEQlNuYXBzaG90cycsXHJcbiAgICAgICAgICAgICAgICAnbGFtYmRhOkxpc3RGdW5jdGlvbnMnLFxyXG4gICAgICAgICAgICAgICAgJ2xhbWJkYTpHZXRGdW5jdGlvbicsXHJcbiAgICAgICAgICAgICAgICAna21zOkxpc3RLZXlzJyxcclxuICAgICAgICAgICAgICAgICdrbXM6RGVzY3JpYmVLZXknLFxyXG4gICAgICAgICAgICAgICAgJ2ttczpHZXRLZXlQb2xpY3knLFxyXG4gICAgICAgICAgICAgICAgJ2ttczpHZXRLZXlSb3RhdGlvblN0YXR1cycsXHJcbiAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgfSksXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBDcm9zcy1BY2NvdW50IFJlbWVkaWF0aW9uIFJvbGVcclxuICAgIHRoaXMucmVtZWRpYXRpb25Sb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdSZW1lZGlhdGlvblJvbGUnLCB7XHJcbiAgICAgIHJvbGVOYW1lOiBgJHtjb25maWcucHJlZml4fS1yZW1lZGlhdGlvbi1yb2xlYCxcclxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLkFjY291bnRQcmluY2lwYWwoY29uZmlnLmFjY291bnQpLFxyXG4gICAgICBpbmxpbmVQb2xpY2llczoge1xyXG4gICAgICAgIFJlbWVkaWF0aW9uUGVybWlzc2lvbnM6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xyXG4gICAgICAgICAgc3RhdGVtZW50czogW1xyXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgICAgICAgICdzMzpQdXRCdWNrZXRQb2xpY3knLFxyXG4gICAgICAgICAgICAgICAgJ3MzOlB1dEJ1Y2tldEFjbCcsXHJcbiAgICAgICAgICAgICAgICAnczM6UHV0QnVja2V0UHVibGljQWNjZXNzQmxvY2snLFxyXG4gICAgICAgICAgICAgICAgJ3MzOlB1dEVuY3J5cHRpb25Db25maWd1cmF0aW9uJyxcclxuICAgICAgICAgICAgICAgICdpYW06QXR0YWNoUm9sZVBvbGljeScsXHJcbiAgICAgICAgICAgICAgICAnaWFtOkRldGFjaFJvbGVQb2xpY3knLFxyXG4gICAgICAgICAgICAgICAgJ2lhbTpQdXRSb2xlUG9saWN5JyxcclxuICAgICAgICAgICAgICAgICdpYW06RGVsZXRlUm9sZVBvbGljeScsXHJcbiAgICAgICAgICAgICAgICAnaWFtOlVwZGF0ZUFzc3VtZVJvbGVQb2xpY3knLFxyXG4gICAgICAgICAgICAgICAgJ2VjMjpBdXRob3JpemVTZWN1cml0eUdyb3VwRWdyZXNzJyxcclxuICAgICAgICAgICAgICAgICdlYzI6QXV0aG9yaXplU2VjdXJpdHlHcm91cEluZ3Jlc3MnLFxyXG4gICAgICAgICAgICAgICAgJ2VjMjpSZXZva2VTZWN1cml0eUdyb3VwRWdyZXNzJyxcclxuICAgICAgICAgICAgICAgICdlYzI6UmV2b2tlU2VjdXJpdHlHcm91cEluZ3Jlc3MnLFxyXG4gICAgICAgICAgICAgICAgJ2Nsb3VkdHJhaWw6UHV0RXZlbnRTZWxlY3RvcnMnLFxyXG4gICAgICAgICAgICAgICAgJ2Nsb3VkdHJhaWw6U3RhcnRMb2dnaW5nJyxcclxuICAgICAgICAgICAgICAgICdyZHM6TW9kaWZ5REJJbnN0YW5jZScsXHJcbiAgICAgICAgICAgICAgICAnbGFtYmRhOlVwZGF0ZUZ1bmN0aW9uQ29uZmlndXJhdGlvbicsXHJcbiAgICAgICAgICAgICAgICAna21zOkVuYWJsZUtleVJvdGF0aW9uJyxcclxuICAgICAgICAgICAgICAgICdrbXM6VGFnUmVzb3VyY2UnLFxyXG4gICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcclxuICAgICAgICAgICAgICBjb25kaXRpb25zOiB7XHJcbiAgICAgICAgICAgICAgICAnU3RyaW5nRXF1YWxzJzoge1xyXG4gICAgICAgICAgICAgICAgICAnYXdzOlJlcXVlc3RlZFJlZ2lvbic6IGNvbmZpZy5yZWdpb24sXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgXSxcclxuICAgICAgICB9KSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENyb3NzLUFjY291bnQgQXVkaXQgUm9sZVxyXG4gICAgdGhpcy5hdWRpdFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0F1ZGl0Um9sZScsIHtcclxuICAgICAgcm9sZU5hbWU6IGAke2NvbmZpZy5wcmVmaXh9LWF1ZGl0LXJvbGVgLFxyXG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uQWNjb3VudFByaW5jaXBhbChjb25maWcuYWNjb3VudCksXHJcbiAgICAgIGlubGluZVBvbGljaWVzOiB7XHJcbiAgICAgICAgQXVkaXRQZXJtaXNzaW9uczogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XHJcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXHJcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXHJcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICAgICAgICAgJ2Nsb3VkdHJhaWw6TG9va3VwRXZlbnRzJyxcclxuICAgICAgICAgICAgICAgICdjb25maWc6QmF0Y2hHZXRSZXNvdXJjZUNvbmZpZ3MnLFxyXG4gICAgICAgICAgICAgICAgJ2NvbmZpZzpHZXRSZXNvdXJjZUNvbmZpZ0hpc3RvcnknLFxyXG4gICAgICAgICAgICAgICAgJ2NvbmZpZzpMaXN0RGlzY292ZXJlZFJlc291cmNlcycsXHJcbiAgICAgICAgICAgICAgICAnbG9nczpEZXNjcmliZUxvZ0dyb3VwcycsXHJcbiAgICAgICAgICAgICAgICAnbG9nczpEZXNjcmliZUxvZ1N0cmVhbXMnLFxyXG4gICAgICAgICAgICAgICAgJ2xvZ3M6R2V0TG9nRXZlbnRzJyxcclxuICAgICAgICAgICAgICAgICdjbG91ZHdhdGNoOkdldE1ldHJpY1N0YXRpc3RpY3MnLFxyXG4gICAgICAgICAgICAgICAgJ2Nsb3Vkd2F0Y2g6TGlzdE1ldHJpY3MnLFxyXG4gICAgICAgICAgICAgICAgJ29yZ2FuaXphdGlvbnM6RGVzY3JpYmVPcmdhbml6YXRpb24nLFxyXG4gICAgICAgICAgICAgICAgJ29yZ2FuaXphdGlvbnM6TGlzdEFjY291bnRzJyxcclxuICAgICAgICAgICAgICAgICdvcmdhbml6YXRpb25zOkxpc3RPcmdhbml6YXRpb25hbFVuaXRzRm9yUGFyZW50JyxcclxuICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICAgIHJlc291cmNlczogWycqJ10sXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgXSxcclxuICAgICAgICB9KSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENyb3NzLUFjY291bnQgUmVhZC1Pbmx5IFJvbGVcclxuICAgIHRoaXMucmVhZG9ubHlSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdSZWFkT25seVJvbGUnLCB7XHJcbiAgICAgIHJvbGVOYW1lOiBgJHtjb25maWcucHJlZml4fS1yZWFkb25seS1yb2xlYCxcclxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLkFjY291bnRQcmluY2lwYWwoY29uZmlnLmFjY291bnQpLFxyXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcclxuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ1JlYWRPbmx5QWNjZXNzJyksXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBEeW5hbW9EQiBFbmNyeXB0aW9uIEtleVxyXG4gICAgdGhpcy5keW5hbW9EQktleSA9IG5ldyBrbXMuS2V5KHRoaXMsICdEeW5hbW9EQkVuY3J5cHRpb25LZXknLCB7XHJcbiAgICAgIGtleU5hbWU6IGAke2NvbmZpZy5wcmVmaXh9LWR5bmFtb2RiLWtleWAsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiBgRHluYW1vREIgZW5jcnlwdGlvbiBrZXkgZm9yICR7Y29uZmlnLnByZWZpeH1gLFxyXG4gICAgICBlbmFibGVLZXlSb3RhdGlvbjogdHJ1ZSxcclxuICAgICAgYWxpYXM6IGAke2NvbmZpZy5wcmVmaXh9LWR5bmFtb2RiLWFsaWFzYCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFMzIEVuY3J5cHRpb24gS2V5XHJcbiAgICB0aGlzLnMzS2V5ID0gbmV3IGttcy5LZXkodGhpcywgJ1MzRW5jcnlwdGlvbktleScsIHtcclxuICAgICAga2V5TmFtZTogYCR7Y29uZmlnLnByZWZpeH0tczMta2V5YCxcclxuICAgICAgZGVzY3JpcHRpb246IGBTMyBlbmNyeXB0aW9uIGtleSBmb3IgJHtjb25maWcucHJlZml4fWAsXHJcbiAgICAgIGVuYWJsZUtleVJvdGF0aW9uOiB0cnVlLFxyXG4gICAgICBhbGlhczogYCR7Y29uZmlnLnByZWZpeH0tczMtYWxpYXNgLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQVBJIEVuY3J5cHRpb24gS2V5XHJcbiAgICB0aGlzLmFwaUtleSA9IG5ldyBrbXMuS2V5KHRoaXMsICdBUElFbmNyeXB0aW9uS2V5Jywge1xyXG4gICAgICBrZXlOYW1lOiBgJHtjb25maWcucHJlZml4fS1hcGkta2V5YCxcclxuICAgICAgZGVzY3JpcHRpb246IGBBUEkgZW5jcnlwdGlvbiBrZXkgZm9yICR7Y29uZmlnLnByZWZpeH1gLFxyXG4gICAgICBlbmFibGVLZXlSb3RhdGlvbjogdHJ1ZSxcclxuICAgICAgYWxpYXM6IGAke2NvbmZpZy5wcmVmaXh9LWFwaS1hbGlhc2AsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTZWNyZXRzIE1hbmFnZXIgS01TIEtleVxyXG4gICAgdGhpcy5zZWNyZXRzTWFuYWdlcktleSA9IG5ldyBrbXMuS2V5KHRoaXMsICdTZWNyZXRzTWFuYWdlcktleScsIHtcclxuICAgICAga2V5TmFtZTogYCR7Y29uZmlnLnByZWZpeH0tc2VjcmV0cy1rZXlgLFxyXG4gICAgICBkZXNjcmlwdGlvbjogYFNlY3JldHMgTWFuYWdlciBlbmNyeXB0aW9uIGtleSBmb3IgJHtjb25maWcucHJlZml4fWAsXHJcbiAgICAgIGVuYWJsZUtleVJvdGF0aW9uOiB0cnVlLFxyXG4gICAgICBhbGlhczogYCR7Y29uZmlnLnByZWZpeH0tc2VjcmV0cy1hbGlhc2AsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBDb2duaXRvIFVzZXIgUG9vbFxyXG4gICAgdGhpcy51c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsICdVc2VyUG9vbCcsIHtcclxuICAgICAgdXNlclBvb2xOYW1lOiBgJHtjb25maWcucHJlZml4fS11c2Vyc2AsXHJcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiBmYWxzZSxcclxuICAgICAgc3RhbmRhcmRBdHRyaWJ1dGVzOiB7XHJcbiAgICAgICAgZW1haWw6IHtcclxuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxyXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIGdpdmVuTmFtZToge1xyXG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXHJcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZmFtaWx5TmFtZToge1xyXG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXHJcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIGN1c3RvbUF0dHJpYnV0ZXM6IHtcclxuICAgICAgICB0ZW5hbnRJZDogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHtcclxuICAgICAgICAgIG1pbkxlbjogMSxcclxuICAgICAgICAgIG1heExlbjogMjU2LFxyXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcclxuICAgICAgICB9KSxcclxuICAgICAgICByb2xlOiBuZXcgY29nbml0by5TdHJpbmdBdHRyaWJ1dGUoe1xyXG4gICAgICAgICAgbWluTGVuOiAxLFxyXG4gICAgICAgICAgbWF4TGVuOiA1MCxcclxuICAgICAgICAgIG11dGFibGU6IHRydWUsXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgZGVwYXJ0bWVudDogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHtcclxuICAgICAgICAgIG1pbkxlbjogMSxcclxuICAgICAgICAgIG1heExlbjogMTAwLFxyXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcclxuICAgICAgICB9KSxcclxuICAgICAgfSxcclxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcclxuICAgICAgICBtaW5MZW5ndGg6IDEyLFxyXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXHJcbiAgICAgICAgcmVxdWlyZVVwcGVyY2FzZTogdHJ1ZSxcclxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxyXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxyXG4gICAgICB9LFxyXG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXHJcbiAgICAgIG1mYVNlY29uZEZhY3Rvcjoge1xyXG4gICAgICAgIHR5cGU6IGNvZ25pdG8uTWZhLk9QVElPTkFMLFxyXG4gICAgICB9LFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjb25maWcuZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IGNvZ25pdG8uUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBjb2duaXRvLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENvZ25pdG8gVXNlciBQb29sIENsaWVudFxyXG4gICAgdGhpcy51c2VyUG9vbENsaWVudCA9IG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KHRoaXMsICdVc2VyUG9vbENsaWVudCcsIHtcclxuICAgICAgdXNlclBvb2w6IHRoaXMudXNlclBvb2wsXHJcbiAgICAgIHVzZXJQb29sQ2xpZW50TmFtZTogYCR7Y29uZmlnLnByZWZpeH0tY2xpZW50YCxcclxuICAgICAgZ2VuZXJhdGVTZWNyZXQ6IHRydWUsXHJcbiAgICAgIHJlZnJlc2hUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uZGF5cygzMCksXHJcbiAgICAgIGFjY2Vzc1Rva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcclxuICAgICAgaWRUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uaG91cnMoMSksXHJcbiAgICAgIHRva2VuVmFsaWRpdHlVbml0czoge1xyXG4gICAgICAgIGFjY2Vzc1Rva2VuOiBjb2duaXRvLlRva2VuVmFsaWRpdHlVbml0LkhPVVJTLFxyXG4gICAgICAgIGlkVG9rZW46IGNvZ25pdG8uVG9rZW5WYWxpZGl0eVVuaXQuSE9VUlMsXHJcbiAgICAgICAgcmVmcmVzaFRva2VuOiBjb2duaXRvLlRva2VuVmFsaWRpdHlVbml0LkRBWVMsXHJcbiAgICAgIH0sXHJcbiAgICAgIHByZXZlbnRVc2VyRXhpc3RlbmNlRXJyb3JzOiB0cnVlLFxyXG4gICAgICBhdXRoRmxvd3M6IHtcclxuICAgICAgICB1c2VyUGFzc3dvcmQ6IHRydWUsXHJcbiAgICAgICAgdXNlclNycDogdHJ1ZSxcclxuICAgICAgICByZWZyZXNoVG9rZW46IHRydWUsXHJcbiAgICAgICAgYWRtaW5Vc2VyUGFzc3dvcmQ6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTZWNyZXRzIE1hbmFnZXIgZm9yIEFQSSBrZXlzIGFuZCBzZW5zaXRpdmUgZGF0YVxyXG4gICAgY29uc3Qgc2VjcmV0c01hbmFnZXJSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdTZWNyZXRzTWFuYWdlclJvbGUnLCB7XHJcbiAgICAgIGFzc3VtZWRCeTogdGhpcy5wbGF0Zm9ybUV4ZWN1dGlvblJvbGUsXHJcbiAgICAgIGlubGluZVBvbGljaWVzOiB7XHJcbiAgICAgICAgU2VjcmV0c01hbmFnZXJBY2Nlc3M6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xyXG4gICAgICAgICAgc3RhdGVtZW50czogW1xyXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgICAgICAgICdzZWNyZXRzbWFuYWdlcjpHZXRTZWNyZXRWYWx1ZScsXHJcbiAgICAgICAgICAgICAgICAnc2VjcmV0c21hbmFnZXI6RGVzY3JpYmVTZWNyZXQnLFxyXG4gICAgICAgICAgICAgICAgJ3NlY3JldHNtYW5hZ2VyOkNyZWF0ZVNlY3JldCcsXHJcbiAgICAgICAgICAgICAgICAnc2VjcmV0c21hbmFnZXI6VXBkYXRlU2VjcmV0JyxcclxuICAgICAgICAgICAgICAgICdzZWNyZXRzbWFuYWdlcjpUYWdSZXNvdXJjZScsXHJcbiAgICAgICAgICAgICAgICAnc2VjcmV0c21hbmFnZXI6VW50YWdSZXNvdXJjZScsXHJcbiAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtgYXJuOmF3czpzZWNyZXRzbWFuYWdlcjoke2NvbmZpZy5yZWdpb259OiR7Y29uZmlnLmFjY291bnR9OnNlY3JldDoke2NvbmZpZy5wcmVmaXh9LypgXSxcclxuICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXHJcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICAgICAgICAgJ2ttczpEZWNyeXB0JyxcclxuICAgICAgICAgICAgICAgIGttczpFbmNyeXB0LFxyXG4gICAgICAgICAgICAgICAgJ2ttczpHZW5lcmF0ZURhdGFLZXknLFxyXG4gICAgICAgICAgICAgICAgJ2ttczpDcmVhdGVHcmFudCcsXHJcbiAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFt0aGlzLnNlY3JldHNNYW5hZ2VyS2V5LmtleUFybl0sXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgXSxcclxuICAgICAgICB9KSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFBsYXRmb3JtIGV4ZWN1dGlvbiByb2xlIHVwZGF0ZXNcclxuICAgIHRoaXMucGxhdGZvcm1FeGVjdXRpb25Sb2xlLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcclxuICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICdkeW5hbW9kYjoqJyxcclxuICAgICAgICAnczM6KicsXHJcbiAgICAgICAgJ2ttczoqJyxcclxuICAgICAgICAnY2xvdWR3YXRjaDoqJyxcclxuICAgICAgICAnbG9nczoqJyxcclxuICAgICAgICAneHJheToqJyxcclxuICAgICAgICAnc3RhdGVzOionLFxyXG4gICAgICAgICdldmVudHM6KicsXHJcbiAgICAgICAgJ2V2ZW50czpUYWdSZXNvdXJjZScsXHJcbiAgICAgICAgJ2xhbWJkYToqJyxcclxuICAgICAgICAnYXBpZ2F0ZXdheToqJyxcclxuICAgICAgICAnYmVkcm9jazoqJyxcclxuICAgICAgICAnYmVkcm9ja2FnZW50OionLFxyXG4gICAgICAgICdzc206R2V0UGFyYW1ldGVyJyxcclxuICAgICAgICAnc3NtOkdldFBhcmFtZXRlcnMnLFxyXG4gICAgICAgICdzc206R2V0UGFyYW1ldGVyc0J5UGF0aCcsXHJcbiAgICAgIF0sXHJcbiAgICAgIHJlc291cmNlczogWycqJ10sXHJcbiAgICB9KSk7XHJcblxyXG4gICAgLy8gT3V0cHV0c1xyXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnSUFNUm9sZXMnLCB7XHJcbiAgICAgIHZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgcGxhdGZvcm1FeGVjdXRpb246IHRoaXMucGxhdGZvcm1FeGVjdXRpb25Sb2xlLnJvbGVBcm4sXHJcbiAgICAgICAgc2NhbjogdGhpcy5zY2FuUm9sZS5yb2xlQXJuLFxyXG4gICAgICAgIHJlbWVkaWF0aW9uOiB0aGlzLnJlbWVkaWF0aW9uUm9sZS5yb2xlQXJuLFxyXG4gICAgICAgIGF1ZGl0OiB0aGlzLmF1ZGl0Um9sZS5yb2xlQXJuLFxyXG4gICAgICAgIHJlYWRvbmx5OiB0aGlzLnJlYWRvbmx5Um9sZS5yb2xlQXJuLFxyXG4gICAgICB9KSxcclxuICAgICAgZGVzY3JpcHRpb246ICdJQU0gUm9sZSBBUk5zJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnS01TS2V5cycsIHtcclxuICAgICAgdmFsdWU6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICBkeW5hbW9EQjogdGhpcy5keW5hbW9EQktleS5rZXlBcm4sXHJcbiAgICAgICAgczM6IHRoaXMuczNLZXkua2V5QXJuLFxyXG4gICAgICAgIGFwaTogdGhpcy5hcGlLZXkua2V5QXJuLFxyXG4gICAgICAgIHNlY3JldHM6IHRoaXMuc2VjcmV0c01hbmFnZXJLZXkua2V5QXJuLFxyXG4gICAgICB9KSxcclxuICAgICAgZGVzY3JpcHRpb246ICdLTVMgS2V5IEFSTnMnXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdDb2duaXRvVXNlclBvb2wnLCB7XHJcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29nbml0byBVc2VyIFBvb2wgSUQnXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdDb2duaXRvQ2xpZW50SWQnLCB7XHJcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29nbml0byBVc2VyIFBvb2wgQ2xpZW50IElEJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnU2VjdXJpdHlTdGFja05hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiB0aGlzLnN0YWNrTmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBTdGFjayBOYW1lJ1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IHN0YWNrTmFtZSgpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHRoaXMuc3RhY2tOYW1lO1xyXG4gIH1cclxufVxyXG4iXX0=