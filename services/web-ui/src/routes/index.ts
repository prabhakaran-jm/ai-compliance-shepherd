import { Router } from 'express';
import { dashboardRoutes } from './dashboard';
import { chatRoutes } from './chat';
import { reportsRoutes } from './reports';
import { scansRoutes } from './scans';
import { findingsRoutes } from './findings';
import { tenantsRoutes } from './tenants';
import { auditPacksRoutes } from './auditPacks';
import { slackRoutes } from './slack';

/**
 * Main router setup for all API endpoints
 */
export function setupRoutes(): Router {
  const router = Router();

  // Dashboard routes
  router.use('/dashboard', dashboardRoutes);

  // Chat interface routes
  router.use('/chat', chatRoutes);

  // Reports and audit packs
  router.use('/reports', reportsRoutes);
  router.use('/audit-packs', auditPacksRoutes);

  // Core compliance operations
  router.use('/scans', scansRoutes);
  router.use('/findings', findingsRoutes);

  // Multi-tenant management
  router.use('/tenants', tenantsRoutes);

  // Slack integration
  router.use('/slack', slackRoutes);

  return router;
}
