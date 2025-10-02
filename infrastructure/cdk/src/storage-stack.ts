import { Stack, StackProps, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

export interface StorageStackProps extends StackProps {
  config: {
    account: string;
    region: string;
    environment: string;
    stage: string;
    prefix: string;
  };
  securityStackName: string;
  description: string;
}

export class StorageStack extends Stack {
  public readonly reportsBucket: s3.Bucket;
  public readonly artifactsBucket: s3.Bucket;
  public readonly auditPacksBucket: s3.Bucket;
  public readonly staticAssetsBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Create KMS key for S3 encryption
    const s3Key = new kms.Key(this, 'S3EncryptionKey', {
      description: `S3 encryption key for ${config.prefix}`,
      enableKeyRotation: true,
    });

    // Reports Bucket (HTML reports, PDFs, etc.)
    this.reportsBucket = new s3.Bucket(this, 'ReportsBucket', {
      bucketName: `${config.prefix}-reports`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: s3Key,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'ReportLifecycle',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
            {
              storageClass: s3.StorageClass.DEEP_ARCHIVE,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
          expiration: cdk.Duration.days(2555), // 7 years retention
        },
      ],
      removalPolicy: config.environment === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // Artifacts Bucket (Scans, data, temporary files)
    this.artifactsBucket = new s3.Bucket(this, 'ArtifactsBucket', {
      bucketName: `${config.prefix}-artifacts`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: s3Key,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'ArtifactLifecycle',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(7),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.DEEP_ARCHIVE,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
          expiration: cdk.Duration.days(180), // 6 months retention
        },
      ],
      removalPolicy: config.environment === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // Audit Packs Bucket (Audit evidence packages)
    this.auditPacksBucket = new s3.Bucket(this, 'AuditPacksBucket', {
      bucketName: `${config.prefix}-audit-packs`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: s3Key,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'AuditPackLifecycle',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(365),
            },
            {
              storageClass: s3.StorageClass.DEEP_ARCHIVE,
              transitionAfter: cdk.Duration.days(730),
            },
          ],
          expiration: cdk.Duration.days(2555), // 7 years for audit compliance
        },
      ],
      removalPolicy: config.environment === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // Static Assets Bucket (Web UI static files, templates)
    this.staticAssetsBucket = new s3.Bucket(this, 'StaticAssetsBucket', {
      bucketName: `${config.prefix}-static-assets`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: s3Key,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'StaticAssetLifecycle',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
          expiration: cdk.Duration.days(365),
        },
      ],
      removalPolicy: config.environment === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // CloudFront Distribution for static assets
    this.distribution = new cloudfront.Distribution(this, 'StaticAssetDistribution', {
      comment: `AI Compliance Shepherd Static Assets Distribution - ${config.environment}`,
      defaultBehavior: {
        origin: new origins.S3Origin(this.staticAssetsBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin('TBD_API_GATEWAY_URL'), // Will be updated by API stack
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(30),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(30),
        },
      ],
      priceClass: config.environment === 'prod' ? 
        cloudfront.PriceClass.PRICE_CLASS_ALL : 
        cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // Bucket policies for Lambda access
    this.setupBucketPolicies();

    // Outputs
    s3deploy.BucketDeployment(this, 'StaticAssetDeployment', {
      sources: [s3deploy.Source.asset('../../services/web-ui/dist')],
      destinationBucket: this.staticAssetsBucket,
      distribution: this.distribution,
      distributionPaths: ['/index.html', '/static/*'],
    });

    new CfnOutput(this, 'S3Buckets', {
      value: JSON.stringify({
        reports: this.reportsBucket.bucketName,
        artifacts: this.artifactsBucket.bucketName,
        auditPacks: this.auditPacksBucket.bucketName,
        staticAssets: this.staticAssetsBucket.bucketName,
      }),
      description: 'S3 Bucket Names'
    });

    new CfnOutput(this, 'CloudFrontDistribution', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID'
    });

    new CfnOutput(this, 'WebUIRL', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'Web UI URL'
    });

    new CfnOutput(this, 'S3EncryptionKey', {
      value: s3Key.keyArn,
      description: 'S3 Encryption Key ARN'
    });

    new CfnOutput(this, 'StorageStackName', {
      value: this.stackName,
      description: 'Storage Stack Name'
    });
  }

  private setupBucketPolicies(): void {
    // Policies will be set up when Lambda functions are created
    // This is a placeholder for bucket policies that will be configured
    // in the Lambda stack where the functions have specific permissions
  }

  public get stackName(): string {
    return this.stackName;
  }
}
