# Webhook Setup Guide

This guide shows how to set up webhook integration for processing Granola meetings.

## Prerequisites

- Node.js 16+ or Bun runtime
- Granola app installed and authenticated
- Webhook endpoint (e.g., n8n, Zapier, custom server)

## Basic Setup

1. **Install the package:**
   ```bash
   npm install granola-ts-client
   # or
   bun add granola-ts-client
   ```

2. **Create a configuration file:**
   ```bash
   cp webhook-config.example.json webhook-config.private.json
   ```

3. **Configure your webhook endpoints:**
   ```json
   {
     "environments": {
       "production": {
         "url": "https://your-endpoint.com/webhook/granola",
         "headers": {
           "X-Api-Key": "your-api-key"
         }
       }
     },
     "webhook": {
       "activeEnvironment": "production",
       "includeTranscript": true
     }
   }
   ```

## Usage Examples

### Basic Meeting Processing

```typescript
import { WebhookClient } from 'granola-ts-client';

const client = new WebhookClient();

client.setWebhookConfig({
  url: 'https://your-endpoint.com/webhook',
  headers: { 'X-Api-Key': 'your-key' },
  includeTranscript: true
});

// Process a specific meeting
await client.processMeeting('meeting-id-here');
```

### Bulk Processing

```typescript
// Process all unprocessed meetings from the last 3 days
const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
const results = await client.processUnprocessedMeetings(threeDaysAgo);
```

## Webhook Payload Structure

Your webhook will receive a JSON payload with this structure:

```json
{
  "meetingId": "abc-123",
  "meetingTitle": "Team Standup",
  "meetingDate": "2024-06-20T14:30:00Z",
  "metadata": {
    "participants": [
      {
        "name": "John Doe",
        "email": "john@company.com",
        "role": "Creator"
      }
    ],
    "duration": 3600,
    "organization": {
      "name": "ACME Corp",
      "confidence": 0.8
    }
  },
  "transcriptMarkdown": "Speaker 1: Hello everyone...",
  "processingTimestamp": "2024-06-20T14:35:00Z"
}
```

## Monitoring Setup

For automated processing, use the webhook monitor:

```bash
bun run examples/webhook-monitor.ts --config webhook-config.private.json
```

See `CRON-SETUP.md` for scheduling instructions.

## Troubleshooting

- **Authentication errors**: Ensure Granola app is running and authenticated
- **Network errors**: Check webhook URL and network connectivity
- **Configuration errors**: Validate JSON structure with schema validation

For more examples, see the other files in this directory.