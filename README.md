# Granola Automation Client

A comprehensive automation system for Granola meetings that captures, processes, and delivers structured meeting data to your preferred destinations.

This system acts as your automated post-meeting assistant, capturing Granola meetings and delivering structured notes to your preferred destination (Airtable, Google Sheets, JSON files, or custom webhooks). From there, you can use additional LLMs to extract and process action items, add to your knowledge base, etc. 

### Key Benefits

- **Save Time**: Eliminate manual note transfer and organization
- **Never Miss Critical Information**: All meeting details are systematically captured
- **Consistent Organization**: Every meeting follows the same structure
- **Searchable Knowledge Base**: Find any meeting detail through your chosen destination
- **Reliable Operation**: System is designed to be bulletproof with Slack and/or desktop alerts if anything requires attention 

### Automated Processing

The system runs automatically on a schedule and:
1. Connects to your Granola account several times daily
2. Identifies any new meetings since the last check
3. Extracts meeting summaries, structured notes, and enhanced transcripts
4. Identifies which organization the meeting belongs to
5. Sends the complete package to your configured destination
6. Tracks all processed meetings to avoid duplication
7. Sends notifications about successful processing

## Features

- **Basic API Client:** Full TypeScript client for the MacOS Granola API w/ automatic authentication
- **Local Meeting Summary Access**: Get meeting summaries and custom template ("panel") content
- **Enhanced Transcript Processing**: Extract transcripts with automatic speaker identification and improved formatting that is not fully available via the internal API
- **Webhook Integration**: Send meeting data to automation platforms like n8n, Airtable, or Google Sheets for custom workflows
- **Organization Detection**: Automatically identify which organization a meeting belongs to based on context clues

## Attribution

This project builds upon the foundational work by [@mikedemarais](https://github.com/mikedemarais) and extends it into a comprehensive meeting automation system. The original TypeScript client from [mikedemarais/granola-ts-client](https://github.com/mikedemarais/granola-ts-client) provided the foundation for interacting with Granola's internal APIs, including authentication, API structure, and core client functionality.

## Installation

```bash
npm install granola-automation-client
# or
yarn add granola-automation-client
# or
bun add granola-automation-client
```

## Enhanced Transcript Features

The `TranscriptClient` extends the base client with speaker identification and transcript processing which is not fully available via the internal API (and cleans up some challenging formatting.)

The enhanced client provides these key features:

1. **Speaker Identification**: Automatically identifies speakers based on audio source (microphone vs. system). 
2. **Transcript Deduplication**: Removes duplicate speech segments using text similarity detection.
3. **Dialog Coherence**: Applies conversation patterns to improve speaker assignment.
4. **Markdown Export**: Formats transcripts grouped by speaker instead of labeling each line.

Example markdown output:

```markdown
Me:  
Hello there, how are you today?  
I've been working on the project all morning.  

Them:  
I'm doing well, thanks for asking.  
How is the project coming along?  

Me:  
It's going great. I've made significant progress on the API integration.  
```

### Webhook Integration

The client includes a `WebhookClient` class for sending meeting data to external systems like n8n.

The webhook client sends detailed meeting information:

1. **Meeting Metadata**: Title, date, participants, duration, organization
2. **Custom Template Content**: e.g. Introduction, agenda, decisions, action items, etc.
3. **Full Transcript**: Speaker-identified transcript in text and markdown formats

The client also provides:

- **Retry Logic**: Configurable retry strategy for failed webhook deliveries
- **Webhook Signing**: Optional HMAC signature for secure delivery
- **Filtering**: Process only meetings you haven't processed before
- **Organization Detection**: Automatically determine which organization a meeting belongs to

### Other APIs

The system can interact with Slack, Discord, and MacOS for notifications, and send meeting information to Airtable or Google Sheets in addition to webhooks.

## Configuration

### Template Validation

The system can validate that meetings have specific templates applied before processing. Configure which templates to look for:

```json
{
  "templateValidation": {
    "enabled": true,
    "mode": "specific",
    "requiredTemplateIds": ["your-template-id-here"],
    "templateNames": {
      "your-template-id-here": "Your Template Name"
    }
  }
}
```

**Template modes:**
- `"disabled"` - Process all meetings regardless of templates
- `"any"` - Process meetings that have any template applied
- `"specific"` - Only process meetings with specific template IDs

### Webhook Configuration

Configure webhook destinations for meeting data:

```json
{
  "webhooks": [
    {
      "name": "n8n-automation",
      "url": "https://your-n8n-instance.com/webhook/granola",
      "headers": {
        "X-Api-Key": "your-api-key",
        "Content-Type": "application/json"
      },
      "enabled": true
    }
  ]
}
```

### Airtable Configuration

Send meeting data directly to Airtable:

```json
{
  "airtable": {
    "enabled": true,
    "apiKey": "your-airtable-api-key",
    "baseId": "your-base-id",
    "tableName": "Meetings",
    "fields": {
      "title": "Meeting Title",
      "date": "Date",
      "transcript": "Transcript",
      "summary": "Summary",
      "organization": "Organization"
    }
  }
}
```

### Google Sheets Configuration

Configure Google Sheets as a destination:

```json
{
  "googleSheets": {
    "enabled": true,
    "serviceAccountKey": "./path/to/service-account.json",
    "spreadsheetId": "your-spreadsheet-id",
    "sheetName": "Meetings",
    "columns": ["Date", "Title", "Organization", "Summary", "Transcript"]
  }
}
```

### Slack Notifications

Configure Slack notifications for processing status:

```json
{
  "notifications": {
    "slack": {
      "enabled": true,
      "webhookUrl": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
      "channel": "#meetings",
      "mentionUsers": ["@admin"],
      "notifySuccess": true,
      "notifyErrors": true
    }
  }
}
```

### Discord Notifications

Configure Discord notifications:

```json
{
  "notifications": {
    "discord": {
      "enabled": true,
      "webhookUrl": "https://discord.com/api/webhooks/YOUR/DISCORD/WEBHOOK",
      "mentionRoles": ["@Admin"],
      "notifySuccess": true,
      "notifyErrors": true
    }
  }
}
```

### Email Notifications

Configure email notifications:

```json
{
  "notifications": {
    "email": {
      "enabled": true,
      "to": ["admin@yourcompany.com"],
      "from": "granola-automation@yourcompany.com",
      "smtp": {
        "host": "smtp.gmail.com",
        "port": 587,
        "secure": false,
        "auth": {
          "user": "your-email@gmail.com",
          "pass": "your-app-password"
        }
      }
    }
  }
}
```

### Complete Configuration Example

Create a `webhook-config.private.json` file with your full configuration:

```json
{
  "templateValidation": {
    "enabled": true,
    "mode": "specific",
    "requiredTemplateIds": ["b491d27c-1106-4ebf-97c5-d5129742945c"]
  },
  "webhooks": [
    {
      "name": "n8n-production",
      "url": "https://n8n.yourcompany.com/webhook/granola",
      "headers": { "X-Api-Key": "your-key" },
      "enabled": true
    }
  ],
  "airtable": {
    "enabled": true,
    "apiKey": "your-airtable-key",
    "baseId": "your-base-id",
    "tableName": "Meetings"
  },
  "notifications": {
    "slack": {
      "enabled": true,
      "webhookUrl": "https://hooks.slack.com/services/YOUR/WEBHOOK",
      "channel": "#automation"
    },
    "email": {
      "enabled": true,
      "to": ["admin@yourcompany.com"]
    }
  }
}
```

## Organization Detection

The library includes an organization detection system that can be customized:

```typescript
import { OrganizationDetector } from 'granola-automation-client';

// Create detector with custom configuration
const detector = OrganizationDetector.fromFile('./organization-config.json');

// Detect organization for a meeting
const meetingData = await client.getDocuments({ limit: 1 });
const meeting = meetingData.docs[0];
const organization = detector.detectOrganization(meeting);
console.log(`Meeting belongs to: ${organization}`);
```

### Organization Configuration

Create a file named `organization-config.json` with your organization definitions:

```json
{
  "organizations": [
    {
      "name": "Organization1",
      "titleKeywords": ["org1", "team1"],
      "emailDomains": ["org1.com"],
      "emailAddresses": ["admin@org1.com"],
      "companyNames": ["Organization One, Inc."]
    },
    {
      "name": "Organization2",
      "titleKeywords": ["org2", "team2"],
      "emailDomains": ["org2.org"],
      "emailAddresses": ["admin@org2.org"],
      "companyNames": ["Organization Two, LLC"]
    }
  ],
  "defaultOrganization": "Unknown"
}
```

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Build
bun run build
```

## Troubleshooting

### Common Issues

| Error Message | Likely Cause | Solution |
|---------------|--------------|----------|
| "No webhook configuration set" | Missing webhook config | Check webhook-config.private.json file exists and contains valid URL |
| "Error processing meeting" | General processing failure | Check logs for specific error details |
| "HTTP error: 401" | Authentication failure | Check API token validity and refresh if needed |
| "HTTP error: 429" | Rate limiting | Reduce frequency of requests or implement additional backoff |
| "Webhook delivery failed" | Connectivity issue | Verify webhook URL and destination server status |

### Authentication Issues

If you encounter 401 Unauthorized errors:
1. Verify token extraction is working: `bun scripts/test-api-real.js`
2. Check local Granola application installation
3. For persistent issues, manually set an API token in .env file

### Recovery Procedures

If specific meetings need to be processed immediately:
```bash
# Process specific meeting
bun examples/webhook-monitor.ts --meeting <meeting-id>

# Process with different environment
bun examples/webhook-monitor.ts --meeting <meeting-id> --env test
```

If the state file becomes corrupted or needs reset:
```bash
# Backup current state
cp processed-meetings.json processed-meetings.backup.json

# Create new state file with specific lookback
cat > processed-meetings.json << EOF
{
  "lastCheckTimestamp": "$(date -v-7d -u +"%Y-%m-%dT%H:%M:%SZ")",
  "processedMeetings": [],
  "failureTracking": {
    "consecutiveFailures": 0,
    "lastNotificationTime": null,
    "lastSuccessTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  }
}
EOF
```

## License

MIT