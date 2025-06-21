// src/notifications/channels/desktop-channel.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';
import type { Logger } from 'pino';
import type { NotificationChannel, NotificationResult, DesktopConfig } from '../types';

const execAsync = promisify(exec);

/**
 * Desktop notification channel implementation (macOS only currently)
 */
export class DesktopChannel implements NotificationChannel {
  readonly name = 'desktop';
  private config: DesktopConfig;
  private logger: Logger;

  constructor(config: DesktopConfig, logger: Logger) {
    this.config = config;
    this.logger = logger.child({ channel: 'desktop' });
  }

  async send(subject: string, body: string): Promise<NotificationResult> {
    try {
      if (platform() !== 'darwin') {
        this.logger.warn('Desktop notifications are only supported on macOS');
        return {
          channel: this.name,
          success: false,
          error: 'Desktop notifications are only supported on macOS'
        };
      }

      // Escape quotes for AppleScript
      const escapedTitle = subject.replace(/'/g, "\\'").replace(/"/g, '\\"');
      const escapedMessage = body.replace(/'/g, "\\'").replace(/"/g, '\\"');
      
      let appleScript: string;
      
      if (this.config.openAppOnClick) {
        const appName = this.config.appName || 'Granola';
        // Use alert dialog with button to open app
        appleScript = `
          set userChoice to display alert "${escapedTitle}" message "${escapedMessage}" buttons {"Open ${appName}", "Dismiss"} default button "Open ${appName}" as warning
          if button returned of userChoice is "Open ${appName}" then
            tell application "${appName}" to activate
          end if
        `;
      } else {
        // Use standard notification
        appleScript = `display notification "${escapedMessage}" with title "Granola Monitor" subtitle "${escapedTitle}" sound name "Basso"`;
      }
      
      const command = `osascript -e '${appleScript}'`;
      
      this.logger.debug('Sending desktop notification');

      const { stdout } = await execAsync(command);
      
      if (stdout && stdout.includes('Open')) {
        this.logger.info('User chose to open app from desktop notification');
      }

      this.logger.info('Desktop notification sent successfully');
      return {
        channel: this.name,
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: errorMessage }, 'Failed to send desktop notification');
      return {
        channel: this.name,
        success: false,
        error: errorMessage
      };
    }
  }
}