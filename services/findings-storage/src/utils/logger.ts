/**
 * Logger utility for findings storage Lambda
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';

export interface LogContext {
  requestId?: string;
  tenantId?: string;
  findingId?: string;
  scanId?: string;
  resourceArn?: string;
  severity?: string;
  framework?: string;
  status?: string;
  [key: string]: any;
}

export class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  private log(level: string, message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...data
    };

    console.log(JSON.stringify(logEntry));
  }

  info(message: string, data?: any): void {
    this.log('INFO', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('WARN', message, data);
  }

  error(message: string, data?: any): void {
    this.log('ERROR', message, data);
  }

  debug(message: string, data?: any): void {
    this.log('DEBUG', message, data);
  }

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  getContext(): LogContext {
    return { ...this.context };
  }
}

// Global logger instance
export const logger = new Logger();

// Helper function to create logger with context
export function createLogger(context: LogContext): Logger {
  return new Logger(context);
}

// Helper function to extract context from Lambda event
export function extractContextFromEvent(event: APIGatewayProxyEvent, context: Context): LogContext {
  return {
    requestId: context.awsRequestId,
    userAgent: event.headers?.['User-Agent'],
    sourceIp: event.requestContext?.identity?.sourceIp,
    method: event.httpMethod,
    path: event.path,
    queryStringParameters: event.queryStringParameters,
    pathParameters: event.pathParameters
  };
}
