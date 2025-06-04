# Setting Up Granola Webhook Integration for n8n

This guide explains how to set up the Granola webhook integration to send meeting data to n8n or other webhook endpoints.

## Prerequisites

- A Granola account with API access
- An n8n instance with a webhook node configured
- Node.js 16+ or Bun runtime

## Configuration

1. **Create your configuration file**:

   ```bash
   # Copy the example config
   cp webhook-config.example.json webhook-config.private.json
   
   # Edit with your settings
   nano webhook-config.private.json
   ```

2. **Configure your webhook endpoint**:

   ```json
   {
     "webhook": {
       "url": "https://your-n8n-instance.com/webhook/your-webhook-id",
       "headers": {
         "X-Api-Key": "your-webhook-auth-key"
       },
       "secret": "your-signing-secret",
       "maxRetries": 3,
       "retryStrategy": "exponential",
       "retryDelay": 1000,
       "includeTranscript": true
     },
     ...
   }
   ```

3. **Configure organization detection**:

   Update the organizations array with your specific organizations:

   ```json
   "organizations": [
     {
       "name": "MyCompany",
       "titleKeywords": ["weekly standup", "team meeting"],
       "emailDomains": ["mycompany.com"],
       "emailAddresses": ["important@mycompany.com"],
       "companyNames": ["My Company, Inc."]
     }
   ]
   ```

## Running the Monitor

### Manual Execution

Run the webhook monitor script to process meetings:

```bash
# Using node
node examples/webhook-monitor.js

# Using bun
bun examples/webhook-monitor.ts

# With a custom config path
bun examples/webhook-monitor.ts ./path/to/config.json
```

### Scheduled Execution

To run the monitor on a schedule:

1. **Using cron (Linux/macOS)**:

   ```bash
   # Edit crontab
   crontab -e
   
   # Add a schedule (e.g., every 15 minutes)
   */15 * * * * cd /path/to/granola-ts-client && /usr/local/bin/bun examples/webhook-monitor.ts
   ```

2. **Using systemd timer (Linux)**:

   Create a service file:
   
   ```
   [Unit]
   Description=Granola Webhook Monitor
   
   [Service]
   WorkingDirectory=/path/to/granola-ts-client
   ExecStart=/usr/local/bin/bun examples/webhook-monitor.ts
   Type=oneshot
   User=youruser
   ```
   
   Create a timer file:
   
   ```
   [Unit]
   Description=Run Granola Webhook Monitor every 15 minutes
   
   [Timer]
   OnBootSec=1min
   OnUnitActiveSec=15min
   Unit=granola-webhook.service
   
   [Install]
   WantedBy=timers.target
   ```

## Setting Up n8n

1. **Create a new workflow** in your n8n instance

2. **Add a Webhook node** as the trigger:
   - Configure it to receive POST requests
   - Set authentication if needed (Basic Auth or Header Auth)
   - Keep the endpoint URL

3. **Configure data handling nodes**:
   - Add JSON parsing if needed
   - Extract meeting metadata, organization, and content
   - Process action items, decisions, or other structured data

4. **Set up integrations**:
   - Send summaries to Slack, Discord, or other communication platforms
   - Create tasks in project management tools
   - Update CRM records
   - Store in database for reporting

## Data Structure

The webhook sends this JSON structure to your endpoint:

```json
{
  "meetingId": "document-id",
  "meetingTitle": "Meeting Title",
  "meetingDate": "2025-06-03T15:19:07.779Z",
  "metadata": {
    "participants": [
      { "name": "John Doe", "email": "john@example.com", "role": "Creator" }
    ],
    "duration": 3600,
    "organization": {
      "name": "MyCompany",
      "confidence": 0.9,
      "signals": { "titleMatch": true }
    },
    "creator": {
      "name": "John Doe",
      "email": "john@example.com",
      "company": "My Company, Inc."
    }
  },
  "joshTemplate": {
    "introduction": "This is the introduction...",
    "agendaItems": "1. Discuss project status\n2. Review timeline",
    "keyDecisions": "Decided to move forward with plan A",
    "actionItems": "John: Complete the report by Friday",
    "meetingNarrative": "The full meeting summary...",
    "otherNotes": "Additional discussion points..."
  },
  "enhancedTranscript": {
    "markdownContent": "Me:\nHello everyone...\n\nThem:\nHi there..."
  },
  "processingTimestamp": "2025-06-03T16:45:00.000Z"
}
```

## Troubleshooting

- Check the `processed-meetings.json` file to see which meetings have been processed
- Set up error notifications in n8n for webhook failures
- Ensure your configuration file has the correct webhook URL and authentication
- Verify that the Josh Template ID is correct if you're using template detection

## Advanced Configuration

- **Webhook Signing**: Use the `secret` field to enable HMAC-SHA256 signing
- **Retry Strategy**: Choose between "linear" and "exponential" backoff
- **Transcript Options**: Set `includeTranscript` to `false` to reduce payload size

For more information, refer to the main README.md and the TypeScript documentation in the codebase.