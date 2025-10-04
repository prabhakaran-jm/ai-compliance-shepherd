"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiCompliancePlatformStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
class AiCompliancePlatformStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { config } = props;
        // Platform information outputs
        new aws_cdk_lib_1.CfnOutput(this, 'PlatformName', {
            value: 'AI Compliance Shepherd',
            description: 'AI Compliance Shepherd Platform Name'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'Environment', {
            value: config.environment,
            description: 'Deployment Environment'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'Region', {
            value: config.region,
            description: 'AWS Region'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'Account', {
            value: config.account,
            description: 'AWS Account ID'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'DeploymentPrefix', {
            value: config.prefix,
            description: 'Resource Prefix for This Deployment'
        });
        // Platform capabilities output
        new aws_cdk_lib_1.CfnOutput(scope, this, 'PlatformCapabilities', {
            value: JSON.stringify({
                features: [
                    'Automated AWS Compliance Scanning',
                    'AI-Powered Chat Interface',
                    'Multi-Framework Support (SOC 2, HIPAA, PCI-DSS, GDPR)',
                    'Automated Remediation',
                    'Professional Audit Reports',
                    'Multi-Tenant Architecture',
                    'Real-Time Monitoring',
                    'GitHub Integration',
                    'Slack Notifications',
                    'Terraform Analysis'
                ],
                frameworks: [
                    'SOC 2 Type II',
                    'HIPAA',
                    'PCI-DSS',
                    'GDPR',
                    'ISO 27001'
                ],
                awsServices: [
                    'Lambda',
                    'API Gateway',
                    'DynamoDB',
                    'S3',
                    'KMS',
                    'CloudWatch',
                    'X-Ray',
                    'Step Functions',
                    'EventBridge',
                    'Bedrock',
                    'Bedrock Agent'
                ]
            }),
            description: 'Platform Capabilities and Features'
        });
        // Service endpoints (will be populated by other stacks)
        new aws_cdk_lib_1.CfnOutput(this, 'ServiceEndpoints', {
            value: JSON.stringify({
                apiGateway: 'TBD',
                webUI: 'TBD',
                webhookEndpoint: 'TBD'
            }),
            description: 'Service Endpoints and URLs'
        });
        // Stack dependency information
        new aws_cdk_lib_1.CfnOutput(this, 'StackDependencies', {
            value: JSON.stringify({
                core: true,
                database: false,
                security: false,
                storage: false,
                lambda: false,
                api: false,
                monitoring: false,
                integration: false
            }),
            description: 'Stack Dependency Status'
        });
    }
    get stackName() {
        return this.stackName;
    }
}
exports.AiCompliancePlatformStack = AiCompliancePlatformStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWktY29tcGxpYW5jZS1wbGF0Zm9ybS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9haS1jb21wbGlhbmNlLXBsYXRmb3JtLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZDQUEyRDtBQWMzRCxNQUFhLHlCQUEwQixTQUFRLG1CQUFLO0lBQ2xELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBcUM7UUFDN0UsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV6QiwrQkFBK0I7UUFDL0IsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDbEMsS0FBSyxFQUFFLHdCQUF3QjtZQUMvQixXQUFXLEVBQUUsc0NBQXNDO1NBQ3BELENBQUMsQ0FBQztRQUVILElBQUksdUJBQVMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ2pDLEtBQUssRUFBRSxNQUFNLENBQUMsV0FBVztZQUN6QixXQUFXLEVBQUUsd0JBQXdCO1NBQ3RDLENBQUMsQ0FBQztRQUVILElBQUksdUJBQVMsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFO1lBQzVCLEtBQUssRUFBRSxNQUFNLENBQUMsTUFBTTtZQUNwQixXQUFXLEVBQUUsWUFBWTtTQUMxQixDQUFDLENBQUM7UUFFSCxJQUFJLHVCQUFTLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRTtZQUM3QixLQUFLLEVBQUUsTUFBTSxDQUFDLE9BQU87WUFDckIsV0FBVyxFQUFFLGdCQUFnQjtTQUM5QixDQUFDLENBQUM7UUFFSCxJQUFJLHVCQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQ3RDLEtBQUssRUFBRSxNQUFNLENBQUMsTUFBTTtZQUNwQixXQUFXLEVBQUUscUNBQXFDO1NBQ25ELENBQUMsQ0FBQztRQUVILCtCQUErQjtRQUMvQixJQUFJLHVCQUFTLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUNqRCxLQUFLLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQztnQkFDcEIsUUFBUSxFQUFFO29CQUNSLG1DQUFtQztvQkFDbkMsMkJBQTJCO29CQUMzQix1REFBdUQ7b0JBQ3ZELHVCQUF1QjtvQkFDdkIsNEJBQTRCO29CQUM1QiwyQkFBMkI7b0JBQzNCLHNCQUFzQjtvQkFDdEIsb0JBQW9CO29CQUNwQixxQkFBcUI7b0JBQ3JCLG9CQUFvQjtpQkFDckI7Z0JBQ0QsVUFBVSxFQUFFO29CQUNWLGVBQWU7b0JBQ2YsT0FBTztvQkFDUCxTQUFTO29CQUNULE1BQU07b0JBQ04sV0FBVztpQkFDWjtnQkFDRCxXQUFXLEVBQUU7b0JBQ1gsUUFBUTtvQkFDUixhQUFhO29CQUNiLFVBQVU7b0JBQ1YsSUFBSTtvQkFDSixLQUFLO29CQUNMLFlBQVk7b0JBQ1osT0FBTztvQkFDUCxnQkFBZ0I7b0JBQ2hCLGFBQWE7b0JBQ2IsU0FBUztvQkFDVCxlQUFlO2lCQUNoQjthQUNGLENBQUM7WUFDRixXQUFXLEVBQUUsb0NBQW9DO1NBQ2xELENBQUMsQ0FBQztRQUVILHdEQUF3RDtRQUN4RCxJQUFJLHVCQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQ3RDLEtBQUssRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUNwQixVQUFVLEVBQUUsS0FBSztnQkFDakIsS0FBSyxFQUFFLEtBQUs7Z0JBQ1osZUFBZSxFQUFFLEtBQUs7YUFDdkIsQ0FBQztZQUNGLFdBQVcsRUFBRSw0QkFBNEI7U0FDMUMsQ0FBQyxDQUFDO1FBRUgsK0JBQStCO1FBQy9CLElBQUksdUJBQVMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDdkMsS0FBSyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ3BCLElBQUksRUFBRSxJQUFJO2dCQUNWLFFBQVEsRUFBRSxLQUFLO2dCQUNmLFFBQVEsRUFBRSxLQUFLO2dCQUNmLE9BQU8sRUFBRSxLQUFLO2dCQUNkLE1BQU0sRUFBRSxLQUFLO2dCQUNiLEdBQUcsRUFBRSxLQUFLO2dCQUNWLFVBQVUsRUFBRSxLQUFLO2dCQUNqQixXQUFXLEVBQUUsS0FBSzthQUNuQixDQUFDO1lBQ0YsV0FBVyxFQUFFLHlCQUF5QjtTQUN2QyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsSUFBVyxTQUFTO1FBQ2xCLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUN4QixDQUFDO0NBQ0Y7QUFwR0QsOERBb0dDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgU3RhY2ssIFN0YWNrUHJvcHMsIENmbk91dHB1dCB9IGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEFpQ29tcGxpYW5jZVBsYXRmb3JtU3RhY2tQcm9wcyBleHRlbmRzIFN0YWNrUHJvcHMge1xyXG4gIGNvbmZpZzoge1xyXG4gICAgYWNjb3VudDogc3RyaW5nO1xyXG4gICAgcmVnaW9uOiBzdHJpbmc7XHJcbiAgICBlbnZpcm9ubWVudDogc3RyaW5nO1xyXG4gICAgc3RhZ2U6IHN0cmluZztcclxuICAgIHByZWZpeDogc3RyaW5nO1xyXG4gIH07XHJcbiAgZGVzY3JpcHRpb246IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIEFpQ29tcGxpYW5jZVBsYXRmb3JtU3RhY2sgZXh0ZW5kcyBTdGFjayB7XHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEFpQ29tcGxpYW5jZVBsYXRmb3JtU3RhY2tQcm9wcykge1xyXG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XHJcblxyXG4gICAgY29uc3QgeyBjb25maWcgfSA9IHByb3BzO1xyXG5cclxuICAgIC8vIFBsYXRmb3JtIGluZm9ybWF0aW9uIG91dHB1dHNcclxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ1BsYXRmb3JtTmFtZScsIHtcclxuICAgICAgdmFsdWU6ICdBSSBDb21wbGlhbmNlIFNoZXBoZXJkJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdBSSBDb21wbGlhbmNlIFNoZXBoZXJkIFBsYXRmb3JtIE5hbWUnXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdFbnZpcm9ubWVudCcsIHtcclxuICAgICAgdmFsdWU6IGNvbmZpZy5lbnZpcm9ubWVudCxcclxuICAgICAgZGVzY3JpcHRpb246ICdEZXBsb3ltZW50IEVudmlyb25tZW50J1xyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnUmVnaW9uJywge1xyXG4gICAgICB2YWx1ZTogY29uZmlnLnJlZ2lvbixcclxuICAgICAgZGVzY3JpcHRpb246ICdBV1MgUmVnaW9uJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnQWNjb3VudCcsIHtcclxuICAgICAgdmFsdWU6IGNvbmZpZy5hY2NvdW50LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0FXUyBBY2NvdW50IElEJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnRGVwbG95bWVudFByZWZpeCcsIHtcclxuICAgICAgdmFsdWU6IGNvbmZpZy5wcmVmaXgsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnUmVzb3VyY2UgUHJlZml4IGZvciBUaGlzIERlcGxveW1lbnQnXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBQbGF0Zm9ybSBjYXBhYmlsaXRpZXMgb3V0cHV0XHJcbiAgICBuZXcgQ2ZuT3V0cHV0KHNjb3BlOiB0aGlzLCAnUGxhdGZvcm1DYXBhYmlsaXRpZXMnLCB7XHJcbiAgICAgIHZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgZmVhdHVyZXM6IFtcclxuICAgICAgICAgICdBdXRvbWF0ZWQgQVdTIENvbXBsaWFuY2UgU2Nhbm5pbmcnLFxyXG4gICAgICAgICAgJ0FJLVBvd2VyZWQgQ2hhdCBJbnRlcmZhY2UnLFxyXG4gICAgICAgICAgJ011bHRpLUZyYW1ld29yayBTdXBwb3J0IChTT0MgMiwgSElQQUEsIFBDSS1EU1MsIEdEUFIpJyxcclxuICAgICAgICAgICdBdXRvbWF0ZWQgUmVtZWRpYXRpb24nLFxyXG4gICAgICAgICAgJ1Byb2Zlc3Npb25hbCBBdWRpdCBSZXBvcnRzJyxcclxuICAgICAgICAgICdNdWx0aS1UZW5hbnQgQXJjaGl0ZWN0dXJlJyxcclxuICAgICAgICAgICdSZWFsLVRpbWUgTW9uaXRvcmluZycsXHJcbiAgICAgICAgICAnR2l0SHViIEludGVncmF0aW9uJyxcclxuICAgICAgICAgICdTbGFjayBOb3RpZmljYXRpb25zJyxcclxuICAgICAgICAgICdUZXJyYWZvcm0gQW5hbHlzaXMnXHJcbiAgICAgICAgXSxcclxuICAgICAgICBmcmFtZXdvcmtzOiBbXHJcbiAgICAgICAgICAnU09DIDIgVHlwZSBJSScsXHJcbiAgICAgICAgICAnSElQQUEnLFxyXG4gICAgICAgICAgJ1BDSS1EU1MnLFxyXG4gICAgICAgICAgJ0dEUFInLFxyXG4gICAgICAgICAgJ0lTTyAyNzAwMSdcclxuICAgICAgICBdLFxyXG4gICAgICAgIGF3c1NlcnZpY2VzOiBbXHJcbiAgICAgICAgICAnTGFtYmRhJyxcclxuICAgICAgICAgICdBUEkgR2F0ZXdheScsXHJcbiAgICAgICAgICAnRHluYW1vREInLFxyXG4gICAgICAgICAgJ1MzJyxcclxuICAgICAgICAgICdLTVMnLFxyXG4gICAgICAgICAgJ0Nsb3VkV2F0Y2gnLFxyXG4gICAgICAgICAgJ1gtUmF5JyxcclxuICAgICAgICAgICdTdGVwIEZ1bmN0aW9ucycsXHJcbiAgICAgICAgICAnRXZlbnRCcmlkZ2UnLFxyXG4gICAgICAgICAgJ0JlZHJvY2snLFxyXG4gICAgICAgICAgJ0JlZHJvY2sgQWdlbnQnXHJcbiAgICAgICAgXVxyXG4gICAgICB9KSxcclxuICAgICAgZGVzY3JpcHRpb246ICdQbGF0Zm9ybSBDYXBhYmlsaXRpZXMgYW5kIEZlYXR1cmVzJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU2VydmljZSBlbmRwb2ludHMgKHdpbGwgYmUgcG9wdWxhdGVkIGJ5IG90aGVyIHN0YWNrcylcclxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ1NlcnZpY2VFbmRwb2ludHMnLCB7XHJcbiAgICAgIHZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgYXBpR2F0ZXdheTogJ1RCRCcsXHJcbiAgICAgICAgd2ViVUk6ICdUQkQnLFxyXG4gICAgICAgIHdlYmhvb2tFbmRwb2ludDogJ1RCRCdcclxuICAgICAgfSksXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VydmljZSBFbmRwb2ludHMgYW5kIFVSTHMnXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTdGFjayBkZXBlbmRlbmN5IGluZm9ybWF0aW9uXHJcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdTdGFja0RlcGVuZGVuY2llcycsIHtcclxuICAgICAgdmFsdWU6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICBjb3JlOiB0cnVlLFxyXG4gICAgICAgIGRhdGFiYXNlOiBmYWxzZSxcclxuICAgICAgICBzZWN1cml0eTogZmFsc2UsXHJcbiAgICAgICAgc3RvcmFnZTogZmFsc2UsXHJcbiAgICAgICAgbGFtYmRhOiBmYWxzZSxcclxuICAgICAgICBhcGk6IGZhbHNlLFxyXG4gICAgICAgIG1vbml0b3Jpbmc6IGZhbHNlLFxyXG4gICAgICAgIGludGVncmF0aW9uOiBmYWxzZVxyXG4gICAgICB9KSxcclxuICAgICAgZGVzY3JpcHRpb246ICdTdGFjayBEZXBlbmRlbmN5IFN0YXR1cydcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBzdGFja05hbWUoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB0aGlzLnN0YWNrTmFtZTtcclxuICB9XHJcbn1cclxuIl19