# Setting Up Slack Webhook Notifications

If the email-based notifications aren't working reliably, you can use Slack webhooks instead, which are generally more reliable.

## Creating a Slack Webhook

1. Go to your Slack workspace settings
2. Navigate to **Apps & integrations**
3. Search for "Incoming WebHooks" and add it to your workspace
4. Click "Add to Slack"
5. Choose the channel where you want notifications to appear
6. Click "Add Incoming WebHooks integration"
7. Copy the Webhook URL provided (it will look like: https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX)

## Configuring the Webhook URL

Once you have your webhook URL, add it to your `.env` file:

```
# Slack webhook URL (preferred over email for reliability)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX

# Only needed if webhook URL is not set
SLACK_EMAIL=your-channel@slack.com
```

## Testing Your Webhook

You can test your webhook configuration with the provided test script:

```bash
node scripts/test-slack-webhook.js "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"
```

Or, if you've configured it in your `.env` file:

```bash
node scripts/test-slack-webhook.js
```

## Updating the Webhook Monitor

To modify the webhook monitor to use Slack webhooks instead of email, you'll need to make the following changes:

1. Edit `examples/webhook-monitor.ts`:
   - Replace the `sendSlackNotification` function with one that uses the webhook URL
   - Update error handling to use the webhook for notifications

2. Update the cron scripts to use the webhook approach.

These changes can be implemented as needed if the email-based approach isn't working for your environment.