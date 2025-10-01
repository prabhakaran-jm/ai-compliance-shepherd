/**
 * Terraform Plan Parser
 * 
 * Parses Terraform plan data in JSON and binary formats,
 * extracting resource changes and configuration details.
 */

import { logger } from '../utils/logger';

export interface TerraformPlan {
  format_version: string;
  terraform_version: string;
  variables: { [key: string]: any };
  resource_changes: Array<{
    address: string;
    module_address?: string;
    mode: 'managed' | 'data';
    type: string;
    name: string;
    index?: number;
    provider_name: string;
    change: {
      actions: string[];
      before?: any;
      after?: any;
      after_unknown?: any;
      before_sensitive?: boolean;
      after_sensitive?: boolean;
    };
  }>;
  output_changes: { [key: string]: any };
  configuration: {
    provider_config: { [key: string]: any };
    root_module: {
      resources: Array<{
        address: string;
        mode: 'managed' | 'data';
        type: string;
        name: string;
        provider_config_key: string;
        provisioners?: any[];
        expressions: { [key: string]: any };
        schema_version: number;
        create_before_destroy?: boolean;
        lifecycle?: {
          create_before_destroy?: boolean;
          prevent_destroy?: boolean;
          ignore_changes?: string[];
        };
      }>;
      module_calls: { [key: string]: any };
      child_modules: Array<{
        address: string;
        resources: any[];
        module_calls: { [key: string]: any };
      }>;
    };
  };
  planned_values: {
    root_module: {
      resources: any[];
      child_modules: any[];
    };
  };
  prior_state: {
    values: {
      root_module: {
        resources: any[];
        child_modules: any[];
      };
    };
  };
}

export class TerraformPlanParser {
  /**
   * Parse Terraform plan data
   */
  async parsePlan(planData: string, format: 'json' | 'binary'): Promise<TerraformPlan> {
    try {
      logger.info('Parsing Terraform plan', {
        format,
        dataSize: planData.length
      });

      let parsedPlan: TerraformPlan;

      if (format === 'json') {
        parsedPlan = this.parseJsonPlan(planData);
      } else if (format === 'binary') {
        parsedPlan = await this.parseBinaryPlan(planData);
      } else {
        throw new Error(`Unsupported plan format: ${format}`);
      }

      // Validate plan structure
      this.validatePlanStructure(parsedPlan);

      logger.info('Terraform plan parsed successfully', {
        format,
        terraformVersion: parsedPlan.terraform_version,
        resourceChangesCount: parsedPlan.resource_changes?.length || 0,
        outputChangesCount: Object.keys(parsedPlan.output_changes || {}).length
      });

      return parsedPlan;

    } catch (error) {
      logger.error('Failed to parse Terraform plan', {
        format,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Parse JSON format Terraform plan
   */
  private parseJsonPlan(planData: string): TerraformPlan {
    try {
      // Decode base64 if needed
      let jsonData: string;
      try {
        jsonData = Buffer.from(planData, 'base64').toString('utf-8');
      } catch {
        // If base64 decoding fails, assume it's already plain JSON
        jsonData = planData;
      }

      const parsed = JSON.parse(jsonData);
      return parsed as TerraformPlan;

    } catch (error) {
      throw new Error(`Failed to parse JSON plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse binary format Terraform plan
   */
  private async parseBinaryPlan(planData: string): Promise<TerraformPlan> {
    try {
      // For binary format, we would need to use Terraform's internal format
      // This is a simplified implementation - in practice, you'd need to:
      // 1. Use Terraform's plan file format
      // 2. Convert binary to JSON using Terraform CLI
      // 3. Parse the resulting JSON

      logger.warn('Binary plan format not fully supported, attempting basic parsing');

      // Decode base64
      const binaryData = Buffer.from(planData, 'base64');
      
      // This is a placeholder - real implementation would require
      // Terraform's plan file format parsing
      throw new Error('Binary plan format requires Terraform CLI for conversion to JSON');

    } catch (error) {
      throw new Error(`Failed to parse binary plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate Terraform plan structure
   */
  private validatePlanStructure(plan: TerraformPlan): void {
    if (!plan.format_version) {
      throw new Error('Invalid plan: missing format_version');
    }

    if (!plan.terraform_version) {
      throw new Error('Invalid plan: missing terraform_version');
    }

    if (!plan.resource_changes) {
      throw new Error('Invalid plan: missing resource_changes');
    }

    if (!Array.isArray(plan.resource_changes)) {
      throw new Error('Invalid plan: resource_changes must be an array');
    }

    // Validate resource changes structure
    plan.resource_changes.forEach((change, index) => {
      if (!change.address) {
        throw new Error(`Invalid plan: resource_changes[${index}] missing address`);
      }

      if (!change.type) {
        throw new Error(`Invalid plan: resource_changes[${index}] missing type`);
      }

      if (!change.name) {
        throw new Error(`Invalid plan: resource_changes[${index}] missing name`);
      }

      if (!change.change) {
        throw new Error(`Invalid plan: resource_changes[${index}] missing change`);
      }

      if (!change.change.actions || !Array.isArray(change.change.actions)) {
        throw new Error(`Invalid plan: resource_changes[${index}] missing or invalid actions`);
      }
    });

    logger.info('Terraform plan structure validation passed', {
      formatVersion: plan.format_version,
      terraformVersion: plan.terraform_version,
      resourceChangesCount: plan.resource_changes.length
    });
  }

  /**
   * Extract resource types from plan
   */
  extractResourceTypes(plan: TerraformPlan): string[] {
    const resourceTypes = new Set<string>();
    
    plan.resource_changes.forEach(change => {
      resourceTypes.add(change.type);
    });

    return Array.from(resourceTypes).sort();
  }

  /**
   * Extract providers from plan
   */
  extractProviders(plan: TerraformPlan): string[] {
    const providers = new Set<string>();
    
    plan.resource_changes.forEach(change => {
      providers.add(change.provider_name);
    });

    return Array.from(providers).sort();
  }

  /**
   * Extract modules from plan
   */
  extractModules(plan: TerraformPlan): string[] {
    const modules = new Set<string>();
    
    plan.resource_changes.forEach(change => {
      if (change.module_address) {
        modules.add(change.module_address);
      }
    });

    return Array.from(modules).sort();
  }

  /**
   * Get resources by type
   */
  getResourcesByType(plan: TerraformPlan, resourceType: string): any[] {
    return plan.resource_changes.filter(change => change.type === resourceType);
  }

  /**
   * Get resources by action
   */
  getResourcesByAction(plan: TerraformPlan, action: string): any[] {
    return plan.resource_changes.filter(change => 
      change.change.actions.includes(action)
    );
  }

  /**
   * Get resources by provider
   */
  getResourcesByProvider(plan: TerraformPlan, provider: string): any[] {
    return plan.resource_changes.filter(change => change.provider_name === provider);
  }

  /**
   * Get resources by module
   */
  getResourcesByModule(plan: TerraformPlan, moduleAddress: string): any[] {
    return plan.resource_changes.filter(change => 
      change.module_address === moduleAddress
    );
  }

  /**
   * Extract configuration values
   */
  extractConfigurationValues(plan: TerraformPlan): { [key: string]: any } {
    const configValues: { [key: string]: any } = {};

    plan.resource_changes.forEach(change => {
      const key = `${change.type}.${change.name}`;
      
      if (change.change.after) {
        configValues[key] = change.change.after;
      } else if (change.change.before) {
        configValues[key] = change.change.before;
      }
    });

    return configValues;
  }

  /**
   * Extract sensitive values
   */
  extractSensitiveValues(plan: TerraformPlan): { [key: string]: any } {
    const sensitiveValues: { [key: string]: any } = {};

    plan.resource_changes.forEach(change => {
      if (change.change.after_sensitive || change.change.before_sensitive) {
        const key = `${change.type}.${change.name}`;
        sensitiveValues[key] = {
          after_sensitive: change.change.after_sensitive,
          before_sensitive: change.change.before_sensitive,
          address: change.address
        };
      }
    });

    return sensitiveValues;
  }

  /**
   * Get plan summary
   */
  getPlanSummary(plan: TerraformPlan): {
    totalResources: number;
    resourcesToCreate: number;
    resourcesToUpdate: number;
    resourcesToDelete: number;
    resourcesToReplace: number;
    resourceTypes: string[];
    providers: string[];
    modules: string[];
  } {
    const summary = {
      totalResources: plan.resource_changes.length,
      resourcesToCreate: 0,
      resourcesToUpdate: 0,
      resourcesToDelete: 0,
      resourcesToReplace: 0,
      resourceTypes: this.extractResourceTypes(plan),
      providers: this.extractProviders(plan),
      modules: this.extractModules(plan)
    };

    plan.resource_changes.forEach(change => {
      const actions = change.change.actions;
      
      if (actions.includes('create')) {
        summary.resourcesToCreate++;
      }
      if (actions.includes('update')) {
        summary.resourcesToUpdate++;
      }
      if (actions.includes('delete')) {
        summary.resourcesToDelete++;
      }
      if (actions.includes('create') && actions.includes('delete')) {
        summary.resourcesToReplace++;
      }
    });

    return summary;
  }

  /**
   * Check if plan has destructive changes
   */
  hasDestructiveChanges(plan: TerraformPlan): boolean {
    return plan.resource_changes.some(change => 
      change.change.actions.includes('delete') || 
      change.change.actions.includes('replace')
    );
  }

  /**
   * Check if plan has sensitive changes
   */
  hasSensitiveChanges(plan: TerraformPlan): boolean {
    return plan.resource_changes.some(change => 
      change.change.after_sensitive || change.change.before_sensitive
    );
  }

  /**
   * Get plan complexity score
   */
  getPlanComplexityScore(plan: TerraformPlan): number {
    const summary = this.getPlanSummary(plan);
    
    // Simple complexity scoring based on:
    // - Number of resources
    // - Number of resource types
    // - Number of providers
    // - Number of modules
    // - Presence of destructive changes
    // - Presence of sensitive changes
    
    let score = 0;
    
    // Base score from resource count
    score += Math.min(summary.totalResources * 0.1, 10);
    
    // Bonus for resource type diversity
    score += Math.min(summary.resourceTypes.length * 0.5, 5);
    
    // Bonus for provider diversity
    score += Math.min(summary.providers.length * 1, 3);
    
    // Bonus for module usage
    score += Math.min(summary.modules.length * 0.5, 2);
    
    // Penalty for destructive changes
    if (this.hasDestructiveChanges(plan)) {
      score += 5;
    }
    
    // Penalty for sensitive changes
    if (this.hasSensitiveChanges(plan)) {
      score += 3;
    }
    
    return Math.round(score * 10) / 10; // Round to 1 decimal place
  }
}
