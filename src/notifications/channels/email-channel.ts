// src/notifications/channels/email-channel.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import type { Logger } from 'pino';
import type { NotificationChannel, NotificationResult, EmailConfig } from '../types';

const execAsync = promisify(exec);

/**
 * Email notification channel implementation
 * Note: Currently uses system mail command. In production, consider using nodemailer.
 */
export class EmailChannel implements NotificationChannel {
  readonly name = 'email';
  private config: EmailConfig;
  private logger: Logger;

  constructor(config: EmailConfig, logger: Logger) {
    this.config = config;
    this.logger = logger.child({ channel: 'email' });
  }

  /**
   * Validates email address format to prevent command injection
   * @param email Email address to validate
   * @returns true if email is valid and safe
   */
  private isValidEmail(email: string): boolean {
    // Strict email validation to prevent command injection
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    // Additional security checks
    const hasShellMetachars = /[;&|`$(){}[\]\\<>]/.test(email);
    const isReasonableLength = email.length > 0 && email.length < 254;
    
    return emailRegex.test(email) && !hasShellMetachars && isReasonableLength;
  }

  /**
   * Escapes shell arguments to prevent injection
   * @param arg Argument to escape
   * @returns Safely escaped argument
   */
  private escapeShellArg(arg: string): string {
    // Replace potentially dangerous characters
    return arg
      .replace(/\\/g, '\\\\')     // Escape backslashes
      .replace(/"/g, '\\"')       // Escape double quotes
      .replace(/'/g, "\\'")       // Escape single quotes
      .replace(/`/g, '\\`')       // Escape backticks
      .replace(/\$/g, '\\$')      // Escape dollar signs
      .replace(/\n/g, '\\n')      // Escape newlines
      .replace(/\r/g, '\\r');     // Escape carriage returns
  }

  async send(subject: string, body: string): Promise<NotificationResult> {
    try {
      if (!this.config.to || this.config.to.length === 0) {
        throw new Error('No email recipients configured');
      }

      // SECURITY: Validate all email addresses to prevent command injection
      for (const email of this.config.to) {
        if (!this.isValidEmail(email)) {
          const errorMsg = `Security: Invalid email address detected: ${email}`;
          this.logger.error(errorMsg);
          return { channel: this.name, success: false, error: errorMsg };
        }
      }

      // Escape quotes and shell metacharacters for shell command
      const escapedSubject = this.escapeShellArg(subject);
      const escapedBody = this.escapeShellArg(body);
      const recipients = this.config.to.join(' '); // Now safe after validation

      // TODO: In production, replace with proper SMTP library like nodemailer
      const emailCommand = `echo "${escapedBody}" | mail -s "${escapedSubject}" ${recipients}`;

      this.logger.debug('Sending email notification', { recipients: this.config.to });

      await execAsync(emailCommand);

      this.logger.info('Email notification sent successfully', { recipients: this.config.to });
      return {
        channel: this.name,
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: errorMessage }, 'Failed to send email notification');
      return {
        channel: this.name,
        success: false,
        error: errorMessage
      };
    }
  }
}