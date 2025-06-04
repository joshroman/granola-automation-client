// examples/test-slack-notification.ts
//
// Test script for Slack notifications using both email and webhook approaches
//
// Usage:
//   bun examples/test-slack-notification.ts [--email slack-email@example.com] [--webhook https://hooks.slack.com/services/...]

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Parse command line arguments
const args = process.argv.slice(2);
let slackEmail = '';
let slackWebhook = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--email' && i + 1 < args.length) {
    slackEmail = args[i + 1];
    i++;
  } else if (args[i] === '--webhook' && i + 1 < args.length) {
    slackWebhook = args[i + 1];
    i++;
  }
}

// Load environment variables from .env file
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment variables from ${envPath}`);
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Parse each line in the .env file
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        
        // Remove quotes if present
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          value = value.replace(/^"|"$/g, '');
        }
        
        process.env[key] = value;
      }
    });
  }
}

// If no command line arguments, try to load from .env
if (!slackEmail && !slackWebhook) {
  loadEnvFile();
  slackEmail = process.env.SLACK_EMAIL || '';
  slackWebhook = process.env.SLACK_WEBHOOK_URL || '';
}

// Create a test message
function createTestMessage() {
  const timestamp = new Date().toLocaleString();
  const hostname = require('os').hostname();
  return {
    subject: `✅ Granola Webhook Monitor Test (${timestamp})`,
    body: `
This is a test message from the Granola webhook monitor.

Timestamp: ${timestamp}
Hostname: ${hostname}
Directory: ${process.cwd()}

If you received this message, the notification system is working correctly!
`
  };
}

// Send email notification
async function sendEmailNotification(email: string, message: { subject: string, body: string }) {
  if (!email) {
    console.error('No Slack email provided. Set SLACK_EMAIL in .env or use --email parameter.');
    return false;
  }
  
  console.log(`Sending test email to: ${email}`);
  
  try {
    const escapedSubject = message.subject.replace(/"/g, '\\"');
    const escapedBody = message.body.replace(/"/g, '\\"');
    const command = `echo "${escapedBody}" | mail -s "${escapedSubject}" ${email}`;
    
    await execAsync(command);
    console.log('Email sent successfully! Check your Slack channel.');
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

// Send webhook notification
async function sendWebhookNotification(webhookUrl: string, message: { subject: string, body: string }) {
  if (!webhookUrl) {
    console.error('No Slack webhook URL provided. Set SLACK_WEBHOOK_URL in .env or use --webhook parameter.');
    return false;
  }
  
  console.log(`Sending test message to webhook: ${webhookUrl.substring(0, 30)}...`);
  
  try {
    const payload = {
      text: `*${message.subject}*\n\n${message.body}`
    };
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      console.log('Webhook message sent successfully! Check your Slack channel.');
      return true;
    } else {
      console.error(`Webhook error: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error('Failed to send webhook message:', error);
    return false;
  }
}

// Main function
async function main() {
  console.log('Granola Webhook Monitor Notification Test');
  console.log('-----------------------------------------');
  
  const message = createTestMessage();
  let emailSuccess = false;
  let webhookSuccess = false;
  
  // Try email notification if configured
  if (slackEmail) {
    emailSuccess = await sendEmailNotification(slackEmail, message);
  }
  
  // Try webhook notification if configured
  if (slackWebhook) {
    webhookSuccess = await sendWebhookNotification(slackWebhook, message);
  }
  
  // Show summary
  console.log('\nNotification Test Results:');
  console.log('--------------------------');
  if (slackEmail) {
    console.log(`Email notification: ${emailSuccess ? '✅ Success' : '❌ Failed'}`);
  } else {
    console.log('Email notification: ⚠️ Not configured');
  }
  
  if (slackWebhook) {
    console.log(`Webhook notification: ${webhookSuccess ? '✅ Success' : '❌ Failed'}`);
  } else {
    console.log('Webhook notification: ⚠️ Not configured');
  }
  
  if (!slackEmail && !slackWebhook) {
    console.log('\n⚠️ No notification methods configured!');
    console.log('Please configure either SLACK_EMAIL or SLACK_WEBHOOK_URL in your .env file');
    console.log('or provide them as command line arguments.');
    return;
  }
  
  if (emailSuccess || webhookSuccess) {
    console.log('\n✅ At least one notification method worked successfully!');
  } else {
    console.log('\n❌ All notification methods failed. Check your configuration and try again.');
  }
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});