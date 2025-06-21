// src/notifications/types.ts
import type { Logger } from 'pino';

/**
 * Configuration for Slack notifications
 */
export interface SlackConfig {
  enabled: boolean;
  webhookUrl?: string;
  channel?: string;
  mentionUsers?: string[];
}

/**
 * Configuration for Discord notifications
 */
export interface DiscordConfig {
  enabled: boolean;
  webhookUrl?: string;
}

/**
 * Configuration for email notifications
 */
export interface EmailConfig {
  enabled: boolean;
  smtpHost?: string;
  smtpPort?: number;
  username?: string;
  password?: string;
  from?: string;
  to?: string[];
}

/**
 * Configuration for desktop notifications
 */
export interface DesktopConfig {
  enabled: boolean;
  openAppOnClick?: boolean;
  appName?: string;
}

/**
 * Result of a notification send operation
 */
export interface NotificationResult {
  channel: string;
  success: boolean;
  error?: string;
}

/**
 * Base interface for all notification channels
 */
export interface NotificationChannel {
  readonly name: string;
  send(subject: string, body: string): Promise<NotificationResult>;
}

/**
 * Options for NotificationManager
 */
export interface NotificationManagerOptions {
  logger: Logger;
}