/**
 * Security Group compliance rules implementation
 */

import { EC2 } from 'aws-sdk';
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
 * SG-001: Security Groups should not allow unrestricted access
 */
export class SecurityGroupRestrictiveRules extends BaseRuleExecutor {
  private ec2: EC2;

  constructor() {
    super(
      'SG-001',
      'Security Group Restrictive Rules',
      ['SOC2'],
      'critical',
      ['AWS::EC2::SecurityGroup'],
      'EC2'
    );
    this.ec2 = new EC2();
  }

  protected async performCheck(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<{ passed: boolean; severity?: Severity; message: string }> {
    const securityGroupId = this.extractSecurityGroupId(resource.arn);
    
    try {
      const result = await this.ec2.describeSecurityGroups({
        GroupIds: [securityGroupId]
      }).promise();

      const securityGroup = result.SecurityGroups?.[0];
      if (!securityGroup) {
        return {
          passed: false,
          severity: 'high',
          message: 'Security group not found',
        };
      }

      const dangerousRules = this.findDangerousRules(securityGroup.IpPermissions || []);

      if (dangerousRules.length === 0) {
        return {
          passed: true,
          message: 'Security group has restrictive rules',
        };
      } else {
        const ruleDescriptions = dangerousRules.map(rule => 
          `${rule.protocol}:${rule.fromPort}-${rule.toPort} from ${rule.cidrIp}`
        ).join(', ');

        return {
          passed: false,
          severity: 'critical',
          message: `Security group has dangerous rules: ${ruleDescriptions}`,
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
    const securityGroupId = this.extractSecurityGroupId(resource.arn);
    const evidence: RuleEvidence[] = [];

    try {
      const result = await this.ec2.describeSecurityGroups({
        GroupIds: [securityGroupId]
      }).promise();

      const securityGroup = result.SecurityGroups?.[0];
      if (securityGroup) {
        evidence.push(this.createEvidence(
          'configuration',
          'Security group configuration',
          {
            groupId: securityGroup.GroupId,
            groupName: securityGroup.GroupName,
            description: securityGroup.Description,
            vpcId: securityGroup.VpcId,
            ipPermissions: securityGroup.IpPermissions,
            ipPermissionsEgress: securityGroup.IpPermissionsEgress,
            tags: securityGroup.Tags,
          },
          'AWS EC2 API'
        ));

        // Analyze ingress rules
        const dangerousRules = this.findDangerousRules(securityGroup.IpPermissions || []);
        if (dangerousRules.length > 0) {
          evidence.push(this.createEvidence(
            'configuration',
            'Dangerous security group rules',
            {
              groupId: securityGroup.GroupId,
              dangerousRules,
              riskLevel: 'critical',
            },
            'AWS EC2 API'
          ));
        }
      }

    } catch (error: any) {
      evidence.push(this.createEvidence(
        'configuration',
        'Error retrieving security group configuration',
        {
          securityGroupId,
          error: error.message,
          code: error.code,
        },
        'AWS EC2 API'
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
      return ['Security group rules are properly restrictive'];
    }

    return [
      'Remove rules that allow access from 0.0.0.0/0',
      'Restrict SSH (port 22) access to specific IP ranges',
      'Restrict RDP (port 3389) access to specific IP ranges',
      'Use security groups as source instead of IP ranges where possible',
      'Implement least privilege access principles',
      'Regularly audit and review security group rules',
    ];
  }

  protected async generateRemediationSteps(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<RemediationStep[]> {
    const securityGroupId = this.extractSecurityGroupId(resource.arn);

    return [
      this.createRemediationStep(
        1,
        'Review security group rules',
        'Review all ingress and egress rules for the security group',
        'high',
        `aws ec2 describe-security-groups --group-ids ${securityGroupId}`,
        undefined,
        {
          action: 'manual_review',
          description: 'Manual review required to identify dangerous rules',
        }
      ),
      this.createRemediationStep(
        2,
        'Remove dangerous rules',
        'Remove rules that allow unrestricted access from 0.0.0.0/0',
        'medium',
        `aws ec2 revoke-security-group-ingress --group-id ${securityGroupId} --protocol tcp --port 22 --cidr 0.0.0.0/0`,
        `resource "aws_security_group_rule" "example" {
          type              = "ingress"
          from_port         = 22
          to_port           = 22
          protocol          = "tcp"
          cidr_blocks       = ["10.0.0.0/8"]  # Replace with specific CIDR
          security_group_id = "${securityGroupId}"
        }`
      ),
    ];
  }

  protected async performValidation(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<boolean> {
    try {
      const securityGroupId = this.extractSecurityGroupId(resource.arn);
      await this.ec2.describeSecurityGroups({
        GroupIds: [securityGroupId]
      }).promise();
      return true;
    } catch (error) {
      return false;
    }
  }

  private extractSecurityGroupId(arn: string): string {
    // Extract security group ID from ARN: arn:aws:ec2:region:account:security-group/sg-12345678
    const parts = arn.split('/');
    return parts[parts.length - 1] || '';
  }

  private findDangerousRules(ipPermissions: EC2.IpPermission[]): Array<{
    protocol: string;
    fromPort?: number;
    toPort?: number;
    cidrIp: string;
    risk: string;
  }> {
    const dangerousRules: Array<{
      protocol: string;
      fromPort?: number;
      toPort?: number;
      cidrIp: string;
      risk: string;
    }> = [];

    const dangerousPorts = [22, 3389]; // SSH and RDP
    const unrestrictedCidr = '0.0.0.0/0';

    for (const permission of ipPermissions) {
      const fromPort = permission.FromPort || 0;
      const toPort = permission.ToPort || 65535;
      const protocol = permission.IpProtocol || 'tcp';

      // Check for unrestricted access
      for (const ipRange of permission.IpRanges || []) {
        const cidrIp = ipRange.CidrIp || '';
        
        if (cidrIp === unrestrictedCidr) {
          // Check if it's a dangerous port
          const isDangerousPort = dangerousPorts.some(port => 
            (fromPort <= port && toPort >= port)
          );

          if (isDangerousPort) {
            dangerousRules.push({
              protocol,
              fromPort,
              toPort,
              cidrIp,
              risk: 'Unrestricted access to sensitive port',
            });
          } else if (fromPort === -1 || toPort === 65535) {
            // All ports open
            dangerousRules.push({
              protocol,
              fromPort,
              toPort,
              cidrIp,
              risk: 'Unrestricted access to all ports',
            });
          }
        }
      }

      // Check for IPv6 unrestricted access
      for (const ipv6Range of permission.Ipv6Ranges || []) {
        const cidrIpv6 = ipv6Range.CidrIpv6 || '';
        
        if (cidrIpv6 === '::/0') {
          const isDangerousPort = dangerousPorts.some(port => 
            (fromPort <= port && toPort >= port)
          );

          if (isDangerousPort) {
            dangerousRules.push({
              protocol,
              fromPort,
              toPort,
              cidrIp: cidrIpv6,
              risk: 'Unrestricted IPv6 access to sensitive port',
            });
          }
        }
      }
    }

    return dangerousRules;
  }
}

/**
 * SG-002: Security Groups should not allow all traffic (0.0.0.0/0) on any port
 */
export class SecurityGroupNoPublicAccessRule extends BaseRuleExecutor {
  private ec2: EC2;

  constructor() {
    super(
      'SG-002',
      'Security Group No Public Access',
      ['SOC2'],
      'critical',
      ['AWS::EC2::SecurityGroup'],
      'EC2'
    );
    this.ec2 = new EC2();
  }

  protected async performCheck(
    resource: AWSResource,
    context: RuleExecutionContext,
    config: RulesEngineConfig
  ): Promise<{ passed: boolean; severity?: Severity; message: string }> {
    const securityGroupId = this.extractSecurityGroupId(resource.arn);
    
    try {
      const result = await this.ec2.describeSecurityGroups({
        GroupIds: [securityGroupId]
      }).promise();

      const securityGroup = result.SecurityGroups?.[0];
      if (!securityGroup) {
        return {
          passed: false,
          severity: 'high',
          message: 'Security group not found',
        };
      }

      const publicAccessRules = this.findPublicAccessRules(securityGroup.IpPermissions || []);

      if (publicAccessRules.length === 0) {
        return {
          passed: true,
          message: 'Security group does not allow public access',
        };
      } else {
        const ruleDescriptions = publicAccessRules.map(rule => 
          `${rule.protocol}:${rule.fromPort}-${rule.toPort} from ${rule.cidrIp}`
        ).join(', ');

        return {
          passed: false,
          severity: 'critical',
          message: `Security group allows public access: ${ruleDescriptions}`,
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
    const securityGroupId = this.extractSecurityGroupId(resource.arn);
    const evidence: RuleEvidence[] = [];

    try {
      const result = await this.ec2.describeSecurityGroups({
        GroupIds: [securityGroupId]
      }).promise();

      const securityGroup = result.SecurityGroups?.[0];
      if (securityGroup) {
        evidence.push(this.createEvidence(
          'configuration',
          'Security group public access analysis',
          {
            groupId: securityGroup.GroupId,
            groupName: securityGroup.GroupName,
            publicAccessRules: this.findPublicAccessRules(securityGroup.IpPermissions || []),
            totalRules: securityGroup.IpPermissions?.length || 0,
          },
          'AWS EC2 API'
        ));
      }

    } catch (error: any) {
      evidence.push(this.createEvidence(
        'configuration',
        'Error retrieving security group configuration',
        {
          securityGroupId,
          error: error.message,
          code: error.code,
        },
        'AWS EC2 API'
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
      return ['Security group does not allow public access'];
    }

    return [
      'Remove all rules allowing access from 0.0.0.0/0',
      'Use specific IP ranges or security groups as sources',
      'Implement network segmentation',
      'Use VPC endpoints for private communication',
      'Consider using AWS WAF for additional protection',
    ];
  }

  protected async generateRemediationSteps(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<RemediationStep[]> {
    const securityGroupId = this.extractSecurityGroupId(resource.arn);

    return [
      this.createRemediationStep(
        1,
        'Remove public access rules',
        'Remove all ingress rules that allow access from 0.0.0.0/0',
        'high',
        `aws ec2 revoke-security-group-ingress --group-id ${securityGroupId} --protocol all --cidr 0.0.0.0/0`,
        `# Remove public access rules
        # This should be done manually after reviewing each rule
        resource "aws_security_group_rule" "private_access" {
          type              = "ingress"
          from_port         = 443
          to_port           = 443
          protocol          = "tcp"
          cidr_blocks       = ["10.0.0.0/8"]  # Use private CIDR
          security_group_id = "${securityGroupId}"
        }`
      ),
    ];
  }

  protected async performValidation(
    resource: AWSResource,
    context: RuleExecutionContext
  ): Promise<boolean> {
    try {
      const securityGroupId = this.extractSecurityGroupId(resource.arn);
      await this.ec2.describeSecurityGroups({
        GroupIds: [securityGroupId]
      }).promise();
      return true;
    } catch (error) {
      return false;
    }
  }

  private extractSecurityGroupId(arn: string): string {
    const parts = arn.split('/');
    return parts[parts.length - 1] || '';
  }

  private findPublicAccessRules(ipPermissions: EC2.IpPermission[]): Array<{
    protocol: string;
    fromPort?: number;
    toPort?: number;
    cidrIp: string;
  }> {
    const publicAccessRules: Array<{
      protocol: string;
      fromPort?: number;
      toPort?: number;
      cidrIp: string;
    }> = [];

    const unrestrictedCidrs = ['0.0.0.0/0', '::/0'];

    for (const permission of ipPermissions) {
      const fromPort = permission.FromPort;
      const toPort = permission.ToPort;
      const protocol = permission.IpProtocol || 'tcp';

      // Check IPv4 ranges
      for (const ipRange of permission.IpRanges || []) {
        const cidrIp = ipRange.CidrIp || '';
        
        if (unrestrictedCidrs.includes(cidrIp)) {
          publicAccessRules.push({
            protocol,
            fromPort,
            toPort,
            cidrIp,
          });
        }
      }

      // Check IPv6 ranges
      for (const ipv6Range of permission.Ipv6Ranges || []) {
        const cidrIpv6 = ipv6Range.CidrIpv6 || '';
        
        if (unrestrictedCidrs.includes(cidrIpv6)) {
          publicAccessRules.push({
            protocol,
            fromPort,
            toPort,
            cidrIp: cidrIpv6,
          });
        }
      }
    }

    return publicAccessRules;
  }
}
