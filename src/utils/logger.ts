// src/utils/logger.ts
import pino from 'pino';
import type { Logger, LoggerOptions } from 'pino';

/**
 * Creates a configured logger instance
 * @param name The name/component for the logger
 * @param options Additional logger options
 * @returns Configured pino logger
 */
export function createLogger(name: string, options?: Partial<LoggerOptions>): Logger {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  const baseOptions: LoggerOptions = {
    name,
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    ...(isDevelopment && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          messageFormat: '{msg}',
          errorLikeObjectKeys: ['err', 'error']
        }
      }
    }),
    // Production: structured JSON logs
    ...((!isDevelopment) && {
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => {
          return { level: label };
        }
      }
    }),
    // Redact sensitive information
    redact: {
      paths: [
        // Generic sensitive fields
        'webhookUrl',
        'apiKey', 
        'password',
        'secret',
        'token',
        'key',
        
        // HTTP headers
        'headers["X-Api-Key"]',
        'headers["Authorization"]',
        'headers.Authorization',
        
        // Webhook configuration
        'config.webhook.secret',
        'config.notifications.slack.webhookUrl',
        'config.notifications.discord.webhookUrl',
        'config.outputs.airtable.apiKey',
        
        // Environment configurations
        'environments.*.url',
        'environments.*.headers["X-Api-Key"]',
        'environments.*.headers.Authorization',
        'environments.production.url',
        'environments.test.url',
        
        // Notification channels
        'notifications.slack.webhookUrl',
        'notifications.discord.webhookUrl',
        'notifications.email.password',
        'notifications.email.username',
        
        // Output destinations
        'outputs.webhook.url',
        'outputs.webhook.headers',
        'outputs.airtable.apiKey',
        'outputs.googleSheets.credentialsPath',
        
        // Process environment
        'env.SLACK_WEBHOOK_URL',
        'env.DISCORD_WEBHOOK_URL',
        'env.AIRTABLE_API_KEY',
        'env.WEBHOOK_SECRET'
      ],
      censor: '[REDACTED]'
    },
    ...options
  };

  return pino(baseOptions);
}

/**
 * Root logger instance
 */
export const rootLogger = createLogger('granola-webhook-monitor');

/**
 * Helper to create child loggers for specific components
 */
export function getLogger(component: string): Logger {
  return rootLogger.child({ component });
}