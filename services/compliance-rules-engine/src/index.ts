/**
 * AI Compliance Shepherd - Compliance Rules Engine
 * 
 * Main entry point for the compliance rules engine package
 */

// Export main classes and interfaces
export { ComplianceRulesEngine } from './engines/RulesEngine';
export { BaseRuleExecutor } from './engines/BaseRuleExecutor';

// Export rule implementations
export * from './rules/S3Rules';
export * from './rules/IAMRules';
export * from './rules/SecurityGroupRules';
export * from './rules/CloudTrailRules';

// Export types
export * from './types';

// Export version information
export const VERSION = '1.0.0';
export const PACKAGE_NAME = '@compliance-shepherd/compliance-rules-engine';
