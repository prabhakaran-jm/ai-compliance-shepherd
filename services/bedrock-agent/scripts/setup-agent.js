#!/usr/bin/env node

/**
 * Setup script for Bedrock Agent
 * Creates the agent, action groups, and necessary IAM roles
 */

const {
  BedrockAgentClient,
  CreateAgentCommand,
  CreateAgentActionGroupCommand,
  PrepareAgentCommand,
  CreateAgentAliasCommand
} = require('@aws-sdk/client-bedrock-agent');

const {
  IAMClient,
  CreateRoleCommand,
  AttachRolePolicyCommand,
  CreatePolicyCommand,
  GetRoleCommand
} = require('@aws-sdk/client-iam');

const {
  STSClient,
  GetCallerIdentityCommand
} = require('@aws-sdk/client-sts');

const fs = require('fs');
const path = require('path');

class BedrockAgentSetup {
  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.bedrockClient = new BedrockAgentClient({ region: this.region });
    this.iamClient = new IAMClient({ region: this.region });
    this.stsClient = new STSClient({ region: this.region });
    this.accountId = null;
  }

  async setup() {
    try {
      console.log('🚀 Starting Bedrock Agent setup...');

      // Get AWS account ID
      const identity = await this.stsClient.send(new GetCallerIdentityCommand({}));
      this.accountId = identity.Account;
      console.log(`📋 AWS Account ID: ${this.accountId}`);

      // Create IAM role for Bedrock Agent
      const roleArn = await this.createBedrockAgentRole();
      console.log(`🔐 Created IAM role: ${roleArn}`);

      // Wait for role propagation
      console.log('⏳ Waiting for IAM role propagation...');
      await this.sleep(10000);

      // Create the Bedrock Agent
      const agentId = await this.createAgent(roleArn);
      console.log(`🤖 Created Bedrock Agent: ${agentId}`);

      // Create action groups
      const actionGroups = await this.createActionGroups(agentId);
      console.log(`⚡ Created ${actionGroups.length} action groups`);

      // Prepare the agent
      await this.prepareAgent(agentId);
      console.log(`✅ Agent prepared successfully`);

      // Create agent alias
      const aliasId = await this.createAgentAlias(agentId);
      console.log(`🏷️  Created agent alias: ${aliasId}`);

      // Save configuration
      await this.saveConfiguration(agentId, aliasId, roleArn);
      console.log(`💾 Configuration saved`);

      console.log('\n🎉 Bedrock Agent setup completed successfully!');
      console.log(`\n📝 Configuration:`);
      console.log(`   Agent ID: ${agentId}`);
      console.log(`   Alias ID: ${aliasId}`);
      console.log(`   Role ARN: ${roleArn}`);
      console.log(`\n🔧 Set these environment variables:`);
      console.log(`   BEDROCK_AGENT_ID=${agentId}`);
      console.log(`   BEDROCK_AGENT_ALIAS_ID=${aliasId}`);
      console.log(`   BEDROCK_AGENT_ROLE_ARN=${roleArn}`);

    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      process.exit(1);
    }
  }

  async createBedrockAgentRole() {
    const roleName = 'BedrockAgentRole';
    
    try {
      // Check if role already exists
      await this.iamClient.send(new GetRoleCommand({ RoleName: roleName }));
      console.log(`🔐 IAM role ${roleName} already exists`);
      return `arn:aws:iam::${this.accountId}:role/${roleName}`;
    } catch (error) {
      if (error.name !== 'NoSuchEntityException') {
        throw error;
      }
    }

    // Trust policy for Bedrock Agent
    const trustPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: 'bedrock.amazonaws.com'
          },
          Action: 'sts:AssumeRole',
          Condition: {
            StringEquals: {
              'aws:SourceAccount': this.accountId
            }
          }
        }
      ]
    };

    // Create the role
    const createRoleCommand = new CreateRoleCommand({
      RoleName: roleName,
      AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
      Description: 'IAM role for AI Compliance Shepherd Bedrock Agent'
    });

    const roleResult = await this.iamClient.send(createRoleCommand);

    // Create and attach custom policy
    const policyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'bedrock:InvokeModel',
            'bedrock:InvokeModelWithResponseStream'
          ],
          Resource: [
            `arn:aws:bedrock:${this.region}::foundation-model/*`
          ]
        },
        {
          Effect: 'Allow',
          Action: [
            'lambda:InvokeFunction'
          ],
          Resource: [
            `arn:aws:lambda:${this.region}:${this.accountId}:function:scan-environment*`,
            `arn:aws:lambda:${this.region}:${this.accountId}:function:findings-storage*`,
            `arn:aws:lambda:${this.region}:${this.accountId}:function:apply-fix*`,
            `arn:aws:lambda:${this.region}:${this.accountId}:function:html-report-generator*`,
            `arn:aws:lambda:${this.region}:${this.accountId}:function:analyze-terraform-plan*`,
            `arn:aws:lambda:${this.region}:${this.accountId}:function:s3-bucket-manager*`
          ]
        },
        {
          Effect: 'Allow',
          Action: [
            'bedrock:Retrieve',
            'bedrock:RetrieveAndGenerate'
          ],
          Resource: [
            `arn:aws:bedrock:${this.region}:${this.accountId}:knowledge-base/*`
          ]
        },
        {
          Effect: 'Allow',
          Action: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents'
          ],
          Resource: [
            `arn:aws:logs:${this.region}:${this.accountId}:*`
          ]
        }
      ]
    };

    const createPolicyCommand = new CreatePolicyCommand({
      PolicyName: 'BedrockAgentPolicy',
      PolicyDocument: JSON.stringify(policyDocument),
      Description: 'Policy for AI Compliance Shepherd Bedrock Agent'
    });

    const policyResult = await this.iamClient.send(createPolicyCommand);

    // Attach policy to role
    const attachPolicyCommand = new AttachRolePolicyCommand({
      RoleName: roleName,
      PolicyArn: policyResult.Policy.Arn
    });

    await this.iamClient.send(attachPolicyCommand);

    return roleResult.Role.Arn;
  }

  async createAgent(roleArn) {
    const agentName = 'AI-Compliance-Shepherd-Agent';
    
    const instruction = `You are an AI compliance assistant for cloud infrastructure. You help users:

1. **Scan and Assess**: Analyze AWS environments for compliance violations
2. **Remediate Issues**: Apply fixes to resolve security and compliance problems  
3. **Generate Reports**: Create detailed compliance reports and audit documentation
4. **Answer Questions**: Provide guidance on compliance frameworks like SOC 2, HIPAA, GDPR
5. **Terraform Analysis**: Review infrastructure-as-code for compliance issues

You have access to action groups that can:
- Start environment scans
- Retrieve and analyze findings
- Apply automated fixes with safety checks
- Generate HTML reports
- Analyze Terraform plans
- Manage S3 buckets and configurations

Always prioritize security and follow the principle of least privilege. When applying fixes, explain what will be changed and ask for confirmation for high-risk operations.

Be helpful, accurate, and security-conscious in all interactions.`;

    const createAgentCommand = new CreateAgentCommand({
      agentName,
      description: 'AI agent for cloud compliance management and remediation',
      foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
      instruction,
      agentResourceRoleArn: roleArn,
      idleSessionTTLInSeconds: 3600
    });

    const response = await this.bedrockClient.send(createAgentCommand);
    return response.agent.agentId;
  }

  async createActionGroups(agentId) {
    const actionGroups = [
      {
        name: 'ScanActions',
        description: 'Actions for scanning AWS environments and assessing compliance',
        lambdaArn: `arn:aws:lambda:${this.region}:${this.accountId}:function:scan-environment`,
        schema: this.getScanActionSchema()
      },
      {
        name: 'FindingsActions',
        description: 'Actions for managing compliance findings and violations',
        lambdaArn: `arn:aws:lambda:${this.region}:${this.accountId}:function:findings-storage`,
        schema: this.getFindingsActionSchema()
      },
      {
        name: 'RemediationActions',
        description: 'Actions for applying fixes and remediating compliance violations',
        lambdaArn: `arn:aws:lambda:${this.region}:${this.accountId}:function:apply-fix`,
        schema: this.getRemediationActionSchema()
      },
      {
        name: 'ReportingActions',
        description: 'Actions for generating compliance reports and documentation',
        lambdaArn: `arn:aws:lambda:${this.region}:${this.accountId}:function:html-report-generator`,
        schema: this.getReportingActionSchema()
      },
      {
        name: 'TerraformActions',
        description: 'Actions for analyzing Terraform plans and Infrastructure as Code',
        lambdaArn: `arn:aws:lambda:${this.region}:${this.accountId}:function:analyze-terraform-plan`,
        schema: this.getTerraformActionSchema()
      },
      {
        name: 'S3ManagementActions',
        description: 'Actions for managing S3 buckets and configurations',
        lambdaArn: `arn:aws:lambda:${this.region}:${this.accountId}:function:s3-bucket-manager`,
        schema: this.getS3ManagementActionSchema()
      }
    ];

    const createdActionGroups = [];

    for (const actionGroup of actionGroups) {
      try {
        const command = new CreateAgentActionGroupCommand({
          agentId,
          actionGroupName: actionGroup.name,
          description: actionGroup.description,
          actionGroupExecutor: {
            lambda: actionGroup.lambdaArn
          },
          apiSchema: {
            payload: JSON.stringify(actionGroup.schema)
          },
          actionGroupState: 'ENABLED'
        });

        const response = await this.bedrockClient.send(command);
        createdActionGroups.push({
          name: actionGroup.name,
          id: response.agentActionGroup.actionGroupId
        });

        console.log(`✅ Created action group: ${actionGroup.name}`);
      } catch (error) {
        console.warn(`⚠️  Failed to create action group ${actionGroup.name}:`, error.message);
      }
    }

    return createdActionGroups;
  }

  async prepareAgent(agentId) {
    const command = new PrepareAgentCommand({ agentId });
    await this.bedrockClient.send(command);
  }

  async createAgentAlias(agentId) {
    const command = new CreateAgentAliasCommand({
      agentId,
      agentAliasName: 'production',
      description: 'Production alias for AI Compliance Shepherd agent'
    });

    const response = await this.bedrockClient.send(command);
    return response.agentAlias.agentAliasId;
  }

  async saveConfiguration(agentId, aliasId, roleArn) {
    const config = {
      agentId,
      aliasId,
      roleArn,
      region: this.region,
      accountId: this.accountId,
      createdAt: new Date().toISOString()
    };

    const configPath = path.join(__dirname, '..', 'agent-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  getScanActionSchema() {
    return {
      openapi: '3.0.0',
      info: {
        title: 'Scan Actions API',
        version: '1.0.0'
      },
      paths: {
        '/scan/start': {
          post: {
            summary: 'Start an environment scan',
            operationId: 'startScan',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      tenantId: { type: 'string' },
                      scanType: { type: 'string', enum: ['full', 'security', 'compliance', 'cost'] }
                    },
                    required: ['tenantId']
                  }
                }
              }
            },
            responses: {
              '200': { description: 'Scan started' }
            }
          }
        }
      }
    };
  }

  getFindingsActionSchema() {
    return {
      openapi: '3.0.0',
      info: {
        title: 'Findings Actions API',
        version: '1.0.0'
      },
      paths: {
        '/findings/search': {
          get: {
            summary: 'Search findings',
            operationId: 'searchFindings',
            parameters: [
              { name: 'tenantId', in: 'query', required: true, schema: { type: 'string' } }
            ],
            responses: {
              '200': { description: 'Findings retrieved' }
            }
          }
        }
      }
    };
  }

  getRemediationActionSchema() {
    return {
      openapi: '3.0.0',
      info: {
        title: 'Remediation Actions API',
        version: '1.0.0'
      },
      paths: {
        '/remediation/apply': {
          post: {
            summary: 'Apply remediation',
            operationId: 'applyRemediation',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      findingId: { type: 'string' },
                      remediationType: { type: 'string' }
                    },
                    required: ['findingId', 'remediationType']
                  }
                }
              }
            },
            responses: {
              '200': { description: 'Remediation applied' }
            }
          }
        }
      }
    };
  }

  getReportingActionSchema() {
    return {
      openapi: '3.0.0',
      info: {
        title: 'Reporting Actions API',
        version: '1.0.0'
      },
      paths: {
        '/reports/generate': {
          post: {
            summary: 'Generate compliance report',
            operationId: 'generateReport',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      tenantId: { type: 'string' },
                      reportType: { type: 'string' }
                    },
                    required: ['tenantId', 'reportType']
                  }
                }
              }
            },
            responses: {
              '200': { description: 'Report generated' }
            }
          }
        }
      }
    };
  }

  getTerraformActionSchema() {
    return {
      openapi: '3.0.0',
      info: {
        title: 'Terraform Actions API',
        version: '1.0.0'
      },
      paths: {
        '/terraform/analyze': {
          post: {
            summary: 'Analyze Terraform plan',
            operationId: 'analyzeTerraformPlan',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      planData: { type: 'string' }
                    },
                    required: ['planData']
                  }
                }
              }
            },
            responses: {
              '200': { description: 'Analysis completed' }
            }
          }
        }
      }
    };
  }

  getS3ManagementActionSchema() {
    return {
      openapi: '3.0.0',
      info: {
        title: 'S3 Management Actions API',
        version: '1.0.0'
      },
      paths: {
        '/s3/buckets/configure': {
          post: {
            summary: 'Configure S3 bucket',
            operationId: 'configureS3Bucket',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      bucketName: { type: 'string' }
                    },
                    required: ['bucketName']
                  }
                }
              }
            },
            responses: {
              '200': { description: 'Configuration applied' }
            }
          }
        }
      }
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new BedrockAgentSetup();
  setup.setup();
}

module.exports = BedrockAgentSetup;
