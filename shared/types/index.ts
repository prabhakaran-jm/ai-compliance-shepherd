/**
 * Shared TypeScript types and interfaces for AI Compliance Shepherd
 * 
 * This module defines all core types used across the application,
 * ensuring type safety and consistency between services.
 */

// Re-export all types for easy importing
export * from './common';
export * from './compliance';
export * from './findings';
export * from './tenant';
export * from './scanning';
export * from './remediation';
export * from './api';
export * from './bedrock';
export * from './aws';
export * from './audit';

// Re-export utilities
export * from '../utils';
