/**
 * AWS service-specific types
 */

// S3 types
export interface S3Bucket {
  name: string;
  region: string;
  creationDate: string;
  versioning: {
    status: 'Enabled' | 'Suspended' | 'Disabled';
    mfaDelete: 'Enabled' | 'Disabled';
  };
  encryption: {
    defaultEncryption: 'AES256' | 'aws:kms' | 'None';
    kmsKeyId?: string;
    sseAlgorithm?: string;
  };
  publicAccessBlock: {
    blockPublicAcls: boolean;
    blockPublicPolicy: boolean;
    ignorePublicAcls: boolean;
    restrictPublicBuckets: boolean;
  };
  policy?: string;
  cors?: S3CorsConfiguration[];
  lifecycle?: S3LifecycleConfiguration;
  tags: Record<string, string>;
}

export interface S3CorsConfiguration {
  allowedHeaders: string[];
  allowedMethods: string[];
  allowedOrigins: string[];
  exposeHeaders?: string[];
  maxAgeSeconds?: number;
}

export interface S3LifecycleConfiguration {
  rules: S3LifecycleRule[];
}

export interface S3LifecycleRule {
  id: string;
  status: 'Enabled' | 'Disabled';
  filter: S3LifecycleRuleFilter;
  transitions?: S3Transition[];
  expiration?: S3Expiration;
}

export interface S3LifecycleRuleFilter {
  prefix?: string;
  tags?: Record<string, string>;
}

export interface S3Transition {
  days: number;
  storageClass: string;
}

export interface S3Expiration {
  days: number;
  expiredObjectDeleteMarker?: boolean;
}

// IAM types
export interface IAMUser {
  userName: string;
  userId: string;
  arn: string;
  createDate: string;
  passwordLastUsed?: string;
  mfaDevices: IAMMfaDevice[];
  attachedPolicies: IAMAttachedPolicy[];
  inlinePolicies: string[];
  groups: string[];
  accessKeys: IAMAccessKey[];
}

export interface IAMMfaDevice {
  userName: string;
  serialNumber: string;
  deviceName: string;
  enableDate: string;
}

export interface IAMAttachedPolicy {
  policyName: string;
  policyArn: string;
  attachDate: string;
}

export interface IAMAccessKey {
  accessKeyId: string;
  status: 'Active' | 'Inactive';
  createDate: string;
  lastUsedDate?: string;
  lastUsedService?: string;
  lastUsedRegion?: string;
}

export interface IAMPolicy {
  policyName: string;
  policyId: string;
  arn: string;
  version: string;
  document: IAMPolicyDocument;
  createDate: string;
  updateDate: string;
  description?: string;
}

export interface IAMPolicyDocument {
  version: string;
  statement: IAMPolicyStatement[];
}

export interface IAMPolicyStatement {
  sid?: string;
  effect: 'Allow' | 'Deny';
  principal?: string | Record<string, string[]>;
  action: string | string[];
  resource: string | string[];
  condition?: Record<string, Record<string, unknown>>;
}

export interface IAMRole {
  roleName: string;
  roleId: string;
  arn: string;
  createDate: string;
  assumeRolePolicyDocument: IAMPolicyDocument;
  description?: string;
  maxSessionDuration?: number;
  attachedPolicies: IAMAttachedPolicy[];
  inlinePolicies: string[];
  tags: Record<string, string>;
}

export interface IAMPasswordPolicy {
  minimumPasswordLength?: number;
  requireSymbols?: boolean;
  requireNumbers?: boolean;
  requireUppercaseCharacters?: boolean;
  requireLowercaseCharacters?: boolean;
  allowUsersToChangePassword?: boolean;
  maxPasswordAge?: number;
  passwordReusePrevention?: number;
  hardExpiry?: boolean;
}

// EC2 Security Group types
export interface SecurityGroup {
  groupId: string;
  groupName: string;
  description: string;
  vpcId: string;
  ownerId: string;
  tags: Record<string, string>;
  ipPermissions: SecurityGroupRule[];
  ipPermissionsEgress: SecurityGroupRule[];
}

export interface SecurityGroupRule {
  ipProtocol: string;
  fromPort?: number;
  toPort?: number;
  ipRanges: SecurityGroupIpRange[];
  ipv6Ranges: SecurityGroupIpv6Range[];
  prefixListIds: SecurityGroupPrefixListId[];
  userIdGroupPairs: SecurityGroupUserIdGroupPair[];
}

export interface SecurityGroupIpRange {
  cidrIp: string;
  description?: string;
}

export interface SecurityGroupIpv6Range {
  cidrIpv6: string;
  description?: string;
}

export interface SecurityGroupPrefixListId {
  prefixListId: string;
  description?: string;
}

export interface SecurityGroupUserIdGroupPair {
  userId: string;
  groupId: string;
  groupName?: string;
  description?: string;
  vpcId?: string;
  vpcPeeringConnectionId?: string;
  peeringStatus?: string;
}

// EBS types
export interface EBSVolume {
  volumeId: string;
  size: number;
  snapshotId?: string;
  availabilityZone: string;
  state: 'creating' | 'available' | 'in-use' | 'deleting' | 'deleted' | 'error';
  createTime: string;
  volumeType: 'standard' | 'io1' | 'io2' | 'gp2' | 'gp3' | 'sc1' | 'st1';
  encrypted: boolean;
  kmsKeyId?: string;
  tags: Record<string, string>;
  attachments: EBSVolumeAttachment[];
}

export interface EBSVolumeAttachment {
  volumeId: string;
  instanceId: string;
  device: string;
  state: 'attaching' | 'attached' | 'detaching' | 'detached';
  attachTime?: string;
  deleteOnTermination?: boolean;
}

// CloudTrail types
export interface CloudTrail {
  trailName: string;
  trailArn: string;
  s3BucketName: string;
  s3KeyPrefix?: string;
  s3KmsKeyId?: string;
  isMultiRegion: boolean;
  isOrganizationTrail: boolean;
  logFileValidationEnabled: boolean;
  cloudWatchLogsLogGroupArn?: string;
  cloudWatchLogsRoleArn?: string;
  kmsKeyId?: string;
  homeRegion: string;
  tags: Record<string, string>;
  status?: CloudTrailStatus;
}

export interface CloudTrailStatus {
  isLogging: boolean;
  latestDeliveryTime?: string;
  latestNotificationTime?: string;
  latestCloudWatchLogsDeliveryTime?: string;
  startLoggingTime?: string;
  stopLoggingTime?: string;
}

// Config types
export interface ConfigRule {
  configRuleName: string;
  configRuleArn: string;
  configRuleId: string;
  description?: string;
  scope: ConfigRuleScope;
  source: ConfigRuleSource;
  inputParameters?: string;
  maximumExecutionFrequency?: string;
  configRuleState: 'ACTIVE' | 'DELETING' | 'DELETING_RESULTS' | 'EVALUATING';
  createdBy?: string;
  evaluationModes: ConfigRuleEvaluationMode[];
}

export interface ConfigRuleScope {
  complianceResourceTypes?: string[];
  tagKey?: string;
  tagValue?: string;
  complianceResourceId?: string;
}

export interface ConfigRuleSource {
  owner: 'AWS' | 'CUSTOM_LAMBDA' | 'CUSTOM_POLICY';
  sourceIdentifier: string;
  sourceDetails?: ConfigRuleSourceDetail[];
}

export interface ConfigRuleSourceDetail {
  eventSource: string;
  messageType: string;
  maximumExecutionFrequency?: string;
}

export interface ConfigRuleEvaluationMode {
  mode: 'DETECTIVE' | 'PROACTIVE';
}

// Lambda types
export interface LambdaFunction {
  functionName: string;
  functionArn: string;
  runtime: string;
  role: string;
  handler: string;
  codeSize: number;
  description?: string;
  timeout: number;
  memorySize: number;
  lastModified: string;
  codeSha256: string;
  version: string;
  vpcConfig?: LambdaVpcConfig;
  environment?: LambdaEnvironment;
  deadLetterConfig?: LambdaDeadLetterConfig;
  kmsKeyArn?: string;
  tracingConfig?: LambdaTracingConfig;
  tags: Record<string, string>;
}

export interface LambdaVpcConfig {
  subnetIds: string[];
  securityGroupIds: string[];
  vpcId: string;
}

export interface LambdaEnvironment {
  variables: Record<string, string>;
}

export interface LambdaDeadLetterConfig {
  targetArn: string;
}

export interface LambdaTracingConfig {
  mode: 'Active' | 'PassThrough';
}

// RDS types
export interface RDSInstance {
  dbInstanceIdentifier: string;
  dbInstanceClass: string;
  engine: string;
  engineVersion: string;
  allocatedStorage: number;
  storageType: string;
  dbInstanceStatus: string;
  masterUsername: string;
  endpoint?: RDSInstanceEndpoint;
  availabilityZone: string;
  multiAZ: boolean;
  vpcSecurityGroups: RDSSecurityGroup[];
  dbSubnetGroup: RDSSubnetGroup;
  backupRetentionPeriod: number;
  preferredBackupWindow: string;
  preferredMaintenanceWindow: string;
  publiclyAccessible: boolean;
  storageEncrypted: boolean;
  kmsKeyId?: string;
  tags: Record<string, string>;
}

export interface RDSInstanceEndpoint {
  address: string;
  port: number;
  hostedZoneId: string;
}

export interface RDSSecurityGroup {
  vpcSecurityGroupId: string;
  status: string;
}

export interface RDSSubnetGroup {
  dbSubnetGroupName: string;
  dbSubnetGroupDescription: string;
  vpcId: string;
  subnetGroupStatus: string;
  subnets: RDSSubnet[];
}

export interface RDSSubnet {
  subnetIdentifier: string;
  subnetAvailabilityZone: RDSAvailabilityZone;
  subnetStatus: string;
}

export interface RDSAvailabilityZone {
  name: string;
}

// KMS types
export interface KMSKey {
  keyId: string;
  arn: string;
  description?: string;
  keyUsage: 'ENCRYPT_DECRYPT' | 'SIGN_VERIFY';
  keyState: 'Enabled' | 'Disabled' | 'PendingDeletion' | 'PendingImport' | 'Unavailable';
  origin: 'AWS_KMS' | 'EXTERNAL' | 'AWS_CLOUDHSM';
  creationDate: string;
  enabledDate?: string;
  keyManager: 'AWS' | 'CUSTOMER';
  customerMasterKeySpec?: string;
  keySpec?: string;
  encryptionAlgorithms: string[];
  signingAlgorithms?: string[];
  multiRegion?: boolean;
  multiRegionConfiguration?: KMSMultiRegionConfiguration;
  pendingDeletionWindowInDays?: number;
  tags: Record<string, string>;
}

export interface KMSMultiRegionConfiguration {
  multiRegionKeyType: 'PRIMARY' | 'REPLICA';
  primaryKey: KMSKeyMetadata;
  replicaKeys: KMSKeyMetadata[];
}

export interface KMSKeyMetadata {
  arn: string;
  region: string;
}

// CloudWatch types
export interface CloudWatchMetric {
  namespace: string;
  metricName: string;
  dimensions: CloudWatchDimension[];
  statistic: string;
  period: number;
  startTime: string;
  endTime: string;
  datapoints: CloudWatchDatapoint[];
}

export interface CloudWatchDimension {
  name: string;
  value: string;
}

export interface CloudWatchDatapoint {
  timestamp: string;
  value: number;
  unit: string;
}

// Common AWS resource metadata
export interface AWSResource {
  arn: string;
  type: string;
  name: string;
  region: string;
  accountId: string;
  tags: Record<string, string>;
  createdDate?: string;
  lastModified?: string;
}

// AWS service limits
export interface AWSServiceLimit {
  serviceCode: string;
  quotaCode: string;
  quotaName: string;
  value: number;
  unit: string;
  adjustable: boolean;
  globalQuota: boolean;
}

// AWS cost and billing
export interface AWSCostData {
  timePeriod: {
    start: string;
    end: string;
  };
  total: {
    amount: string;
    unit: string;
  };
  groups: AWSCostGroup[];
}

export interface AWSCostGroup {
  keys: string[];
  metrics: Record<string, AWSCostMetric>;
}

export interface AWSCostMetric {
  amount: string;
  unit: string;
}
