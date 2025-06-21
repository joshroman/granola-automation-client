// src/notifications/channels/discord-channel.ts
import type { Logger } from 'pino';
import type { NotificationChannel, NotificationResult, DiscordConfig } from '../types';

/**
 * Discord notification channel implementation
 */
export class DiscordChannel implements NotificationChannel {
  readonly name = 'discord';
  private config: DiscordConfig;
  private logger: Logger;

  constructor(config: DiscordConfig, logger: Logger) {
    this.config = config;
    this.logger = logger.child({ channel: 'discord' });
  }

  async send(subject: string, body: string): Promise<NotificationResult> {
    try {
      const payload = {
        content: `**${subject}**\n\n${body}`
      };

      this.logger.debug('Sending Discord notification');

      const response = await fetch(this.config.webhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        this.logger.info('Discord notification sent successfully');
        return {
          channel: this.name,
          success: true
        };
      } else {
        const error = `Discord webhook error: ${response.status} ${response.statusText}`;
        this.logger.error({ status: response.status, statusText: response.statusText }, error);
        return {
          channel: this.name,
          success: false,
          error
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: errorMessage }, 'Failed to send Discord notification');
      return {
        channel: this.name,
        success: false,
        error: errorMessage
      };
    }
  }
}