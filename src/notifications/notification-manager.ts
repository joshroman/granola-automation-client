// src/notifications/notification-manager.ts
import type { Logger } from 'pino';
import type { NotificationConfig } from '../webhook-types';
import type { 
  NotificationChannel, 
  NotificationResult, 
  NotificationManagerOptions 
} from './types';
import { SlackChannel } from './channels/slack-channel';
import { DiscordChannel } from './channels/discord-channel';
import { EmailChannel } from './channels/email-channel';
import { DesktopChannel } from './channels/desktop-channel';

/**
 * Manages multiple notification channels and sends messages to all enabled channels
 */
export class NotificationManager {
  private channels: NotificationChannel[] = [];
  private logger: Logger;

  constructor(config: NotificationConfig, options: NotificationManagerOptions) {
    this.logger = options.logger.child({ component: 'NotificationManager' });

    // Initialize enabled channels
    if (config.slack?.enabled && config.slack.webhookUrl) {
      this.channels.push(new SlackChannel(config.slack, this.logger));
      this.logger.info('Slack notification channel enabled');
    }

    if (config.discord?.enabled && config.discord.webhookUrl) {
      this.channels.push(new DiscordChannel(config.discord, this.logger));
      this.logger.info('Discord notification channel enabled');
    }

    if (config.email?.enabled && config.email.to && config.email.to.length > 0) {
      this.channels.push(new EmailChannel(config.email, this.logger));
      this.logger.info('Email notification channel enabled');
    }

    if (config.desktop?.enabled) {
      this.channels.push(new DesktopChannel(config.desktop, this.logger));
      this.logger.info('Desktop notification channel enabled');
    }

    this.logger.info(`Initialized with ${this.channels.length} active channels`);
  }

  /**
   * Send a notification to all enabled channels
   * @param subject The notification subject/title
   * @param body The notification body/message
   * @param includeDesktop Whether to force include desktop notifications
   * @returns Array of results from each channel
   */
  async send(
    subject: string, 
    body: string, 
    includeDesktop: boolean = false
  ): Promise<NotificationResult[]> {
    if (this.channels.length === 0 && !includeDesktop) {
      this.logger.warn('No notification channels are configured or enabled');
      return [];
    }

    // Add desktop channel temporarily if requested
    let temporaryChannels = [...this.channels];
    if (includeDesktop && !this.channels.some(c => c.name === 'desktop')) {
      temporaryChannels.push(new DesktopChannel({ enabled: true }, this.logger));
    }

    this.logger.info(`Sending notifications to ${temporaryChannels.length} channels`, { subject });

    // Send to all channels in parallel
    const results = await Promise.allSettled(
      temporaryChannels.map(channel => channel.send(subject, body))
    );

    // Process results
    const processedResults: NotificationResult[] = results.map((result, index) => {
      const channel = temporaryChannels[index];
      
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const error = `Channel failed: ${result.reason}`;
        this.logger.error({ channel: channel.name, error }, 'Notification channel error');
        return {
          channel: channel.name,
          success: false,
          error
        };
      }
    });

    // Log summary
    const successful = processedResults.filter(r => r.success).length;
    const failed = processedResults.filter(r => !r.success).length;
    
    this.logger.info(
      `Notification results: ${successful} successful, ${failed} failed`,
      { 
        channels: processedResults.map(r => ({ 
          channel: r.channel, 
          success: r.success 
        }))
      }
    );

    return processedResults;
  }

  /**
   * Get list of enabled channels
   */
  getEnabledChannels(): string[] {
    return this.channels.map(c => c.name);
  }
}