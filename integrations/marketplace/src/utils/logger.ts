/**
 * Logger utility for AWS Marketplace Integration
 */

interface LogContext {
  customerIdentifier?: string;
  subscriptionId?: string;
  entitlementId?: string;
  [key: string]: any;
}

export const logger = {
  info: (message: string, context?: LogContext) => {
    console.log(JSON.stringify({
      level: 'INFO',
      timestamp: new Date().toISOString(),
      service: 'marketplace-integration',
      message,
      ...context
    }));
  },

  warn: (message: string, context?: LogContext) => {
    console.warn(JSON.stringify({
      level: 'WARN',
      timestamp: new Date().toISOString(),
      service: 'marketplace-integration',
      message,
      ...context
    }));
  },

  error: (message: string, context?: LogContext) => {
    console.error(JSON.stringify({
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      service: 'marketplace-integration',
      message,
      ...context
    }));
  },

  debug: (message: string, context?: LogContext) => {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      console.debug(JSON.stringify({
        level: 'DEBUG',
        timestamp: new Date().toISOString(),
        service: 'marketplace-integration',
        message,
        ...context
      }));
    }
  }
};
