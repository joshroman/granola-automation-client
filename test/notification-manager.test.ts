// test/notification-manager.test.ts
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { NotificationManager } from '../src/notifications/notification-manager';
import { createLogger } from '../src/utils/logger';
import type { NotificationConfig } from '../src/webhook-types';

// Mock the notification channels
mock.module('../src/notifications/channels/slack-channel', () => ({
  SlackChannel: class MockSlackChannel {
    name = 'slack';
    async send() {
      return { channel: 'slack', success: true };
    }
  }
}));

mock.module('../src/notifications/channels/discord-channel', () => ({
  DiscordChannel: class MockDiscordChannel {
    name = 'discord';
    async send() {
      return { channel: 'discord', success: true };
    }
  }
}));

mock.module('../src/notifications/channels/email-channel', () => ({
  EmailChannel: class MockEmailChannel {
    name = 'email';
    async send() {
      return { channel: 'email', success: true };
    }
  }
}));

mock.module('../src/notifications/channels/desktop-channel', () => ({
  DesktopChannel: class MockDesktopChannel {
    name = 'desktop';
    async send() {
      return { channel: 'desktop', success: true };
    }
  }
}));

describe('NotificationManager', () => {
  let logger: any;

  beforeEach(() => {
    logger = createLogger('test');
  });

  it('should initialize with no channels when all disabled', () => {
    const config: NotificationConfig = {
      slack: { enabled: false },
      discord: { enabled: false },
      email: { enabled: false },
      desktop: { enabled: false }
    };

    const manager = new NotificationManager(config, { logger });
    expect(manager.getEnabledChannels()).toEqual([]);
  });

  it('should initialize with Slack channel when enabled', () => {
    const config: NotificationConfig = {
      slack: { 
        enabled: true, 
        webhookUrl: 'https://hooks.slack.com/test' 
      }
    };

    const manager = new NotificationManager(config, { logger });
    expect(manager.getEnabledChannels()).toEqual(['slack']);
  });

  it('should initialize multiple channels when enabled', () => {
    const config: NotificationConfig = {
      slack: { 
        enabled: true, 
        webhookUrl: 'https://hooks.slack.com/test' 
      },
      discord: { 
        enabled: true, 
        webhookUrl: 'https://discord.com/api/webhooks/test' 
      },
      email: { 
        enabled: true, 
        to: ['test@example.com'] 
      }
    };

    const manager = new NotificationManager(config, { logger });
    const channels = manager.getEnabledChannels();
    expect(channels).toContain('slack');
    expect(channels).toContain('discord');
    expect(channels).toContain('email');
    expect(channels.length).toBe(3);
  });

  it('should send notifications to all enabled channels', async () => {
    const config: NotificationConfig = {
      slack: { 
        enabled: true, 
        webhookUrl: 'https://hooks.slack.com/test' 
      },
      discord: { 
        enabled: true, 
        webhookUrl: 'https://discord.com/api/webhooks/test' 
      }
    };

    const manager = new NotificationManager(config, { logger });
    const results = await manager.send('Test Subject', 'Test Body');

    expect(results).toHaveLength(2);
    expect(results.find(r => r.channel === 'slack')).toEqual({
      channel: 'slack',
      success: true
    });
    expect(results.find(r => r.channel === 'discord')).toEqual({
      channel: 'discord',
      success: true
    });
  });

  it('should include desktop notification when requested', async () => {
    const config: NotificationConfig = {
      slack: { 
        enabled: true, 
        webhookUrl: 'https://hooks.slack.com/test' 
      }
    };

    const manager = new NotificationManager(config, { logger });
    const results = await manager.send('Test Subject', 'Test Body', true);

    expect(results).toHaveLength(2);
    expect(results.find(r => r.channel === 'slack')).toBeDefined();
    expect(results.find(r => r.channel === 'desktop')).toBeDefined();
  });
});