# Slack Webhook Integration

Guide for setting up Slack notifications for Granola meeting processing.

## Prerequisites

- Slack workspace with admin access
- Webhook endpoint configured (see WEBHOOK-SETUP.md)

## Setup Slack Webhook

1. **Create a Slack App:**
   - Go to https://api.slack.com/apps
   - Click "Create New App" → "From scratch"
   - Name: "Granola Monitor"
   - Select your workspace

2. **Enable Incoming Webhooks:**
   - Go to "Incoming Webhooks" in your app settings
   - Turn on "Activate Incoming Webhooks"
   - Click "Add New Webhook to Workspace"
   - Choose the channel for notifications
   - Copy the webhook URL

3. **Configure in webhook-config.json:**
   ```json
   {
     "notifications": {
       "slack": {
         "enabled": true,
         "webhookUrl": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
         "channel": "#granola-alerts",
         "mentionUsers": ["@admin", "@team-lead"]
       }
     }
   }
   ```

## Notification Types

The system sends notifications for:

- ✅ **Successful processing**: Meeting processed and sent to webhook
- 🟡 **Template validation failures**: Required templates missing
- 🔴 **Processing errors**: Technical failures or API issues

## Example Slack Messages

### Success Notification
```
✅ Success: processed "Team Standup"

Successfully processed meeting:
- Title: Team Standup
- ID: abc-123
- Time: 6/20/2024, 2:30:00 PM
- Environment: production
```

### Template Validation
```
🟡 Required Template Missing

REQUIRED TEMPLATE MISSING

Meeting requires template(s) but none were found:
- Title: Team Standup
- ID: abc-123
- Environment: production
- Required: Josh Meeting Template

Please apply the required template(s) in Granola.
```

## Environment Variables

For security, set webhook URL via environment variable:

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
```

The system automatically uses environment variables if available.

## Testing

Test your Slack integration:

```typescript
import { NotificationManager, createLogger } from 'granola-automation-client';

const config = {
  slack: {
    enabled: true,
    webhookUrl: process.env.SLACK_WEBHOOK_URL
  }
};

const logger = createLogger('test');
const notificationManager = new NotificationManager(config, { logger });

await notificationManager.send(
  "Test Notification",
  "This is a test message from Granola integration"
);
```

## Troubleshooting

- **"Invalid webhook URL"**: Check the URL is correctly copied from Slack
- **"Channel not found"**: Ensure the app has access to the specified channel
- **Rate limiting**: Slack limits webhook frequency; notifications are automatically throttled