// src/config/config-loader.ts
import * as fs from 'fs';
import type { Logger } from 'pino';
import { validateConfig, safeValidateConfig, type WebhookMonitorConfig } from './config-schema';

/**
 * Loads and validates configuration from file
 */
export class ConfigLoader {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: 'ConfigLoader' });
  }

  /**
   * Loads configuration from file and validates it
   * @param configPath Path to the configuration file
   * @returns Validated configuration
   * @throws Error if configuration is invalid or file not found
   */
  load(configPath: string): WebhookMonitorConfig {
    this.logger.info(`Loading configuration from ${configPath}`);

    // Check if file exists
    if (!fs.existsSync(configPath)) {
      const error = `Configuration file not found: ${configPath}`;
      this.logger.error(error);
      throw new Error(error);
    }

    try {
      // Read file
      const configData = fs.readFileSync(configPath, 'utf8');
      const rawConfig = JSON.parse(configData);

      // Apply environment variable overrides
      const configWithOverrides = this.applyEnvironmentOverrides(rawConfig);

      // Validate configuration
      const validation = safeValidateConfig(configWithOverrides);

      if (!validation.success) {
        this.logger.error('Configuration validation failed', {
          errors: validation.error?.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
        
        throw new Error(
          `Configuration validation failed:\n${validation.error?.errors
            .map(e => `  - ${e.path.join('.')}: ${e.message}`)
            .join('\n')}`
        );
      }

      this.logger.info('Configuration loaded and validated successfully', {
        environment: validation.data!.webhook.activeEnvironment,
        notificationChannels: Object.entries(validation.data!.notifications)
          .filter(([_, config]) => config?.enabled)
          .map(([channel]) => channel),
        outputDestinations: Object.entries(validation.data!.outputs)
          .filter(([_, config]) => config?.enabled)
          .map(([destination]) => destination)
      });

      return validation.data!;
    } catch (error) {
      if (error instanceof SyntaxError) {
        const message = `Invalid JSON in configuration file: ${error.message}`;
        this.logger.error(message);
        throw new Error(message);
      }
      throw error;
    }
  }

  /**
   * Applies environment variable overrides to configuration
   * This allows secrets to be kept out of the config file
   */
  private applyEnvironmentOverrides(config: any): any {
    const overridden = { ...config };

    // Override Slack webhook URL if provided
    if (process.env.SLACK_WEBHOOK_URL) {
      if (!overridden.notifications) overridden.notifications = {};
      if (!overridden.notifications.slack) overridden.notifications.slack = {};
      overridden.notifications.slack.webhookUrl = process.env.SLACK_WEBHOOK_URL;
      this.logger.debug('Applied SLACK_WEBHOOK_URL from environment');
    }

    // Override Discord webhook URL if provided
    if (process.env.DISCORD_WEBHOOK_URL) {
      if (!overridden.notifications) overridden.notifications = {};
      if (!overridden.notifications.discord) overridden.notifications.discord = {};
      overridden.notifications.discord.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      this.logger.debug('Applied DISCORD_WEBHOOK_URL from environment');
    }

    // Override Airtable API key if provided
    if (process.env.AIRTABLE_API_KEY) {
      if (!overridden.outputs) overridden.outputs = {};
      if (!overridden.outputs.airtable) overridden.outputs.airtable = {};
      overridden.outputs.airtable.apiKey = process.env.AIRTABLE_API_KEY;
      this.logger.debug('Applied AIRTABLE_API_KEY from environment');
    }

    // Override webhook secret if provided
    if (process.env.WEBHOOK_SECRET) {
      if (!overridden.webhook) overridden.webhook = {};
      overridden.webhook.secret = process.env.WEBHOOK_SECRET;
      this.logger.debug('Applied WEBHOOK_SECRET from environment');
    }

    // Override active environment if provided
    if (process.env.WEBHOOK_ENVIRONMENT) {
      if (!overridden.webhook) overridden.webhook = {};
      overridden.webhook.activeEnvironment = process.env.WEBHOOK_ENVIRONMENT;
      this.logger.debug(`Applied WEBHOOK_ENVIRONMENT from environment: ${process.env.WEBHOOK_ENVIRONMENT}`);
    }

    return overridden;
  }

  /**
   * Creates an example configuration file
   */
  static createExampleConfig(path: string): void {
    const exampleConfig = {
      environments: {
        test: {
          url: "https://your-webhook-endpoint.com/test",
          headers: {
            "X-Api-Key": "your-test-api-key"
          }
        },
        production: {
          url: "https://your-webhook-endpoint.com/prod",
          headers: {
            "X-Api-Key": "your-prod-api-key"
          }
        }
      },
      webhook: {
        activeEnvironment: "test",
        maxRetries: 3,
        retryStrategy: "exponential",
        retryDelay: 1000,
        includeTranscript: false
      },
      templateValidation: {
        enabled: false,
        mode: "disabled",
        requiredTemplateIds: [],
        templateNames: {}
      },
      notifications: {
        slack: {
          enabled: false,
          webhookUrl: "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
        }
      },
      outputs: {
        webhook: {
          enabled: true
        }
      },
      monitoring: {
        lookbackDays: 3,
        maxMeetingsPerRun: 10,
        stateFilePath: "./data/processed-meetings.json"
      },
      organizations: [],
      defaultOrganization: "Unknown"
    };

    fs.writeFileSync(path, JSON.stringify(exampleConfig, null, 2));
  }
}