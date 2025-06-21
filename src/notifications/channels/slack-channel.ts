// src/notifications/channels/slack-channel.ts
import type { Logger } from 'pino';
import type { NotificationChannel, NotificationResult, SlackConfig } from '../types';

/**
 * Slack notification channel implementation
 */
export class SlackChannel implements NotificationChannel {
  readonly name = 'slack';
  private config: SlackConfig;
  private logger: Logger;

  constructor(config: SlackConfig, logger: Logger) {
    this.config = config;
    this.logger = logger.child({ channel: 'slack' });
  }

  async send(subject: string, body: string): Promise<NotificationResult> {
    try {
      const payload: any = {
        text: `*${subject}*\n\n${body}`,
        username: 'Granola Monitor'
      };

      if (this.config.channel) {
        payload.channel = this.config.channel;
      }

      if (this.config.mentionUsers && this.config.mentionUsers.length > 0) {
        payload.text += `\n\nCC: ${this.config.mentionUsers.join(' ')}`;
      }

      this.logger.debug('Sending Slack notification', { webhookUrl: this.config.webhookUrl });

      const response = await fetch(this.config.webhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        this.logger.info('Slack notification sent successfully');
        return {
          channel: this.name,
          success: true
        };
      } else {
        const error = `Slack webhook error: ${response.status} ${response.statusText}`;
        this.logger.error({ status: response.status, statusText: response.statusText }, error);
        return {
          channel: this.name,
          success: false,
          error
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: errorMessage }, 'Failed to send Slack notification');
      return {
        channel: this.name,
        success: false,
        error: errorMessage
      };
    }
  }
}