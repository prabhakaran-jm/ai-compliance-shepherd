/**
 * IAM compliance rules implementation
 */

import { IAM } from 'aws-sdk';
import {
  AWSResource,
  Severity,
  ComplianceFramework,
} from '@compliance-shepherd/shared';
import { BaseRuleExecutor } from '../engines/BaseRuleExecutor';
import {
  RuleExecutionContext,
  RuleEvidence,
  RemediationStep,
  RulesEngineConfig,
} from '../types';

/**
 * IAM-001: Root account must have MFA enabled
 */
export class IAMRootMfaRule extends BaseRuleExecutor {
  private iam: IAM;

  constructor() {
    super(
      'IAM-001',
      'Root Account MFA',
      ['SOC2'],
      'critical',
      ['AWS::IAM::User'],
      'IAM'
    );
    this.iam = new IAM();
  }

  protected async performCheck(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<{ passed: boolean; severity?: Severity; message: string }> {
    try {
      const result = await this.iam.getAccountSummary().promise();
      
      if (result.SummaryMap?.AccountMFAEnabled === 1) {
        return {
          passed: true,
          message: 'Root account has MFA enabled',
        };
      } else {
        return {
          passed: false,
          severity: 'critical',
          message: 'Root account does not have MFA enabled',
        };
      }
    } catch (error: any) {
      throw error;
    }
  }

  protected async collectEvidence(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<RuleEvidence[]> {
    const evidence: RuleEvidence[] = [];

    try {
      const accountSummary = await this.iam.getAccountSummary().promise();
      
      evidence.push(this.createEvidence(
        'configuration',
        'AWS account summary',
        {
          accountMfaEnabled: accountSummary.SummaryMap?.AccountMFAEnabled,
          totalUsers: accountSummary.SummaryMap?.Users,
          totalGroups: accountSummary.SummaryMap?.Groups,
          totalRoles: accountSummary.SummaryMap?.Roles,
          totalPolicies: accountSummary.SummaryMap?.AccountAccessKeysPresent,
        },
        'AWS IAM API'
      ));

      // Get MFA devices for root user
      try {
        const mfaDevices = await this.iam.listVirtualMFADevices().promise();
        const rootMfaDevices = mfaDevices.VirtualMFADevices?.filter(device => 
          device.User?.UserName === 'root'
        );

        evidence.push(this.createEvidence(
          'configuration',
          'Root user MFA devices',
          {
            rootMfaDevices: rootMfaDevices?.length || 0,
            devices: rootMfaDevices,
          },
          'AWS IAM API'
        ));
      } catch (error: any) {
        evidence.push(this.createEvidence(
          'configuration',
          'Error retrieving MFA devices',
          {
            error: error.message,
            code: error.code,
          },
          'AWS IAM API'
        ));
      }

    } catch (error: any) {
      evidence.push(this.createEvidence(
        'configuration',
        'Error retrieving account summary',
        {
          error: error.message,
          code: error.code,
        },
        'AWS IAM API'
      ));
    }

    return evidence;
  }

  protected async generateRecommendations(
    resource: AWSResource,
    context: RuleExecutionContext,
    checkResult: { passed: boolean; severity?: Severity; message: string }
  ): Promise<string[]> {
    if (checkResult.passed) {
      return ['Root account MFA is properly configured'];
    }

    return [
      'Enable MFA for the root account immediately',
      'Use a hardware MFA device for maximum security',
      'Store MFA backup codes in a secure location',
      'Consider using IAM users instead of root account for daily operations',
      'Regularly review and rotate MFA devices',
    ];
  }

  protected async generateRemediationSteps(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<RemediationStep[]> {
    return [
      this.createRemediationStep(
        1,
        'Create virtual MFA device',
        'Create a virtual MFA device for the root account',
        'medium',
        `aws iam create-virtual-mfa-device --virtual-mfa-device-name root-mfa --outfile QRCode.png --bootstrap-method QRCodePNG`,
        undefined,
        {
          deviceName: 'root-mfa',
          bootstrapMethod: 'QRCodePNG',
        }
      ),
      this.createRemediationStep(
        2,
        'Enable MFA for root account',
        'Enable MFA for the root account using the virtual MFA device',
        'medium',
        `aws iam enable-mfa-device --user-name root --serial-number arn:aws:iam::ACCOUNT-ID:mfa/root-mfa --authentication-code1 CODE1 --authentication-code2 CODE2`,
        undefined,
        {
          userName: 'root',
          serialNumber: 'arn:aws:iam::ACCOUNT-ID:mfa/root-mfa',
        }
      ),
    ];
  }

  protected async performValidation(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<boolean> {
    try {
      await this.iam.getAccountSummary().promise();
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * IAM-002: IAM password policy must meet requirements
 */
export class IAMPasswordPolicyRule extends BaseRuleExecutor {
  private iam: IAM;

  constructor() {
    super(
      'IAM-002',
      'IAM Password Policy',
      ['SOC2'],
      'high',
      ['AWS::IAM::AccountPasswordPolicy'],
      'IAM'
    );
    this.iam = new IAM();
  }

  protected async performCheck(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<{ passed: boolean; severity?: Severity; message: string }> {
    try {
      const result = await this.iam.getAccountPasswordPolicy().promise();
      const policy = result.PasswordPolicy;

      const requirements = {
        minLength: (policy?.MinimumPasswordLength || 0) >= 14,
        requireSymbols: policy?.RequireSymbols === true,
        requireNumbers: policy?.RequireNumbers === true,
        requireUppercase: policy?.RequireUppercaseCharacters === true,
        requireLowercase: policy?.RequireLowercaseCharacters === true,
        maxAge: (policy?.MaxPasswordAge || 0) <= 90,
        preventReuse: (policy?.PasswordReusePrevention || 0) >= 5,
      };

      const passedCount = Object.values(requirements).filter(Boolean).length;
      const totalRequirements = Object.keys(requirements).length;

      if (passedCount === totalRequirements) {
        return {
          passed: true,
          message: 'IAM password policy meets all requirements',
        };
      } else {
        const failedRequirements = Object.entries(requirements)
          .filter(([, passed]) => !passed)
          .map(([req]) => req);

        return {
          passed: false,
          severity: 'high',
          message: `IAM password policy does not meet requirements: ${failedRequirements.join(', ')}`,
        };
      }
    } catch (error: any) {
      if (error.code === 'NoSuchEntity') {
        return {
          passed: false,
          severity: 'high',
          message: 'No IAM password policy is configured',
        };
      }
      throw error;
    }
  }

  protected async collectEvidence(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<RuleEvidence[]> {
    const evidence: RuleEvidence[] = [];

    try {
      const passwordPolicy = await this.iam.getAccountPasswordPolicy().promise();
      
      evidence.push(this.createEvidence(
        'configuration',
        'IAM account password policy',
        {
          policy: passwordPolicy.PasswordPolicy,
          requirements: {
            minLength: passwordPolicy.PasswordPolicy?.MinimumPasswordLength,
            requireSymbols: passwordPolicy.PasswordPolicy?.RequireSymbols,
            requireNumbers: passwordPolicy.PasswordPolicy?.RequireNumbers,
            requireUppercase: passwordPolicy.PasswordPolicy?.RequireUppercaseCharacters,
            requireLowercase: passwordPolicy.PasswordPolicy?.RequireLowercaseCharacters,
            maxAge: passwordPolicy.PasswordPolicy?.MaxPasswordAge,
            preventReuse: passwordPolicy.PasswordPolicy?.PasswordReusePrevention,
          },
        },
        'AWS IAM API'
      ));

    } catch (error: any) {
      if (error.code !== 'NoSuchEntity') {
        evidence.push(this.createEvidence(
          'configuration',
          'Error retrieving password policy',
          {
            error: error.message,
            code: error.code,
          },
          'AWS IAM API'
        ));
      } else {
        evidence.push(this.createEvidence(
          'configuration',
          'No password policy configured',
          {
            error: 'NoSuchEntity',
            message: 'No IAM password policy is configured',
          },
          'AWS IAM API'
        ));
      }
    }

    return evidence;
  }

  protected async generateRecommendations(
    resource: AWSResource,
    context: RuleExecutionContext,
    checkResult: { passed: boolean; severity?: Severity; message: string }
  ): Promise<string[]> {
    if (checkResult.passed) {
      return ['Password policy meets all requirements'];
    }

    return [
      'Set minimum password length to at least 14 characters',
      'Require symbols, numbers, uppercase, and lowercase characters',
      'Set maximum password age to 90 days or less',
      'Prevent password reuse for at least 5 previous passwords',
      'Enable password expiration',
      'Consider implementing password complexity requirements',
    ];
  }

  protected async generateRemediationSteps(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<RemediationStep[]> {
    return [
      this.createRemediationStep(
        1,
        'Update password policy',
        'Update IAM password policy to meet security requirements',
        'low',
        `aws iam update-account-password-policy --minimum-password-length 14 --require-symbols --require-numbers --require-uppercase-characters --require-lowercase-characters --max-password-age 90 --password-reuse-prevention 5`,
        `resource "aws_iam_account_password_policy" "strict" {
          minimum_password_length        = 14
          require_symbols                = true
          require_numbers                = true
          require_uppercase_characters   = true
          require_lowercase_characters   = true
          max_password_age              = 90
          password_reuse_prevention     = 5
          hard_expiry                   = true
          allow_users_to_change_password = true
        }`
      ),
    ];
  }

  protected async performValidation(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<boolean> {
    try {
      await this.iam.getAccountSummary().promise();
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * IAM-003: IAM users should not have wildcard permissions
 */
export class IAMWildcardPermissionsRule extends BaseRuleExecutor {
  private iam: IAM;

  constructor() {
    super(
      'IAM-003',
      'IAM Wildcard Permissions',
      ['SOC2'],
      'high',
      ['AWS::IAM::User', 'AWS::IAM::Role', 'AWS::IAM::Policy'],
      'IAM'
    );
    this.iam = new IAM();
  }

  protected async performCheck(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<{ passed: boolean; severity?: Severity; message: string }> {
    const wildcardActions = ['*', 's3:*', 'iam:*', 'ec2:*'];
    const wildcardResources = ['*'];
    
    try {
      let hasWildcards = false;
      const wildcardPolicies: string[] = [];

      if (resource.type === 'AWS::IAM::User') {
        const userName = this.extractUserName(resource.arn);
        const result = await this.iam.listAttachedUserPolicies({ UserName: userName }).promise();
        
        for (const policy of result.AttachedPolicies || []) {
          const policyDoc = await this.iam.getPolicy({ PolicyArn: policy.PolicyArn }).promise();
          const policyVersion = await this.iam.getPolicyVersion({
            PolicyArn: policy.PolicyArn,
            VersionId: policyDoc.Policy?.DefaultVersionId
          }).promise();
          
          const policyDocument = JSON.parse(policyVersion.PolicyVersion?.Document || '{}');
          
          if (this.hasWildcardPermissions(policyDocument, wildcardActions, wildcardResources)) {
            hasWildcards = true;
            wildcardPolicies.push(policy.PolicyName || '');
          }
        }
      }

      if (hasWildcards) {
        return {
          passed: false,
          severity: 'high',
          message: `IAM entity has wildcard permissions in policies: ${wildcardPolicies.join(', ')}`,
        };
      } else {
        return {
          passed: true,
          message: 'IAM entity does not have wildcard permissions',
        };
      }
    } catch (error: any) {
      throw error;
    }
  }

  protected async collectEvidence(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<RuleEvidence[]> {
    const evidence: RuleEvidence[] = [];

    try {
      if (resource.type === 'AWS::IAM::User') {
        const userName = this.extractUserName(resource.arn);
        const attachedPolicies = await this.iam.listAttachedUserPolicies({ UserName: userName }).promise();
        
        evidence.push(this.createEvidence(
          'policy',
          'IAM user attached policies',
          {
            userName,
            attachedPolicies: attachedPolicies.AttachedPolicies,
          },
          'AWS IAM API'
        ));

        // Get inline policies
        const inlinePolicies = await this.iam.listUserPolicies({ UserName: userName }).promise();
        evidence.push(this.createEvidence(
          'policy',
          'IAM user inline policies',
          {
            userName,
            inlinePolicies: inlinePolicies.PolicyNames,
          },
          'AWS IAM API'
        ));
      }

    } catch (error: any) {
      evidence.push(this.createEvidence(
        'policy',
        'Error retrieving IAM policies',
        {
          error: error.message,
          code: error.code,
        },
        'AWS IAM API'
      ));
    }

    return evidence;
  }

  protected async generateRecommendations(
    resource: AWSResource,
    context: RuleExecutionContext,
    checkResult: { passed: boolean; severity?: Severity; message: string }
  ): Promise<string[]> {
    if (checkResult.passed) {
      return ['No wildcard permissions found'];
    }

    return [
      'Replace wildcard permissions with specific actions',
      'Use least privilege principle',
      'Review and remove unnecessary permissions',
      'Consider using AWS managed policies with specific permissions',
      'Implement regular permission audits',
    ];
  }

  protected async generateRemediationSteps(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<RemediationStep[]> {
    return [
      this.createRemediationStep(
        1,
        'Review permissions',
        'Review all attached and inline policies for wildcard permissions',
        'high',
        undefined,
        undefined,
        {
          action: 'manual_review',
          description: 'Manual review required to identify and replace wildcard permissions',
        }
      ),
      this.createRemediationStep(
        2,
        'Update policies',
        'Update policies to use specific actions instead of wildcards',
        'medium',
        undefined,
        undefined,
        {
          action: 'policy_update',
          description: 'Replace wildcard actions and resources with specific permissions',
        }
      ),
    ];
  }

  protected async performValidation(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<boolean> {
    try {
      if (resource.type === 'AWS::IAM::User') {
        const userName = this.extractUserName(resource.arn);
        await this.iam.getUser({ UserName: userName }).promise();
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  private extractUserName(arn: string): string {
    // Extract username from ARN: arn:aws:iam::123456789012:user/username
    const parts = arn.split('/');
    return parts[parts.length - 1] || '';
  }

  private hasWildcardPermissions(
    policyDocument: any,
    wildcardActions: string[],
    wildcardResources: string[]
  ): boolean {
    const statements = policyDocument.Statement || [];
    
    return statements.some((statement: any) => {
      const actions = Array.isArray(statement.Action) ? statement.Action : [statement.Action];
      const resources = Array.isArray(statement.Resource) ? statement.Resource : [statement.Resource];
      
      const hasWildcardAction = actions.some((action: string) => 
        wildcardActions.includes(action)
      );
      
      const hasWildcardResource = resources.some((resource: string) => 
        wildcardResources.includes(resource)
      );
      
      return hasWildcardAction || hasWildcardResource;
    });
  }
}
