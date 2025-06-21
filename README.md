# Granola MacOS Meeting Assistant "API"

A TypeScript client for the Granola internal MacOS API

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

## Installation

```bash
npm install granola-ts-client
# or
yarn add granola-ts-client
# or
bun add granola-ts-client
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

## Client Configuration

The client automatically mimics the official Granola desktop app to bypass API validation. You can customize various aspects of the client if needed:

```ts
const client = new GranolaClient('your-api-token', {
  // API configuration
  baseUrl: 'https://api.granola.ai',
  timeout: 10000,
  retries: 3,
  
  // Client identification (defaults shown)
  appVersion: '6.4.0',
  clientType: 'electron',
  clientPlatform: 'darwin',
  clientArchitecture: 'arm64',
  electronVersion: '33.4.5',
  chromeVersion: '130.0.6723.191',
  nodeVersion: '20.18.3',
  osVersion: '15.3.1',
  osBuild: '24D70',
>>>>>>> feature/n8n-webhooks
});
```

## Document Panel Access

The `PanelClient` provides access to document panels and their structured content:

```ts
import GranolaClient, { 
  // Exported interfaces
  PeopleResponse, 
  FeatureFlagsResponse,
  NotionIntegrationResponse,
  SubscriptionsResponse,
  ClientOpts,
  HttpOpts,
  
  // Transcript processing types
  TranscriptClient,
  TranscriptSegmentWithSpeaker,
  
  // Panel and organization types
  PanelClient,
  DocumentPanel,
  OrganizationDetector,
  OrganizationConfig,
  
  // Webhook integration types
  WebhookClient,
  WebhookConfig,
  MeetingPayload,
  WebhookResult,
  
  // Generated OpenAPI schema types
  components,
  paths
} from 'granola-ts-client';

// Initialize client
const client = new PanelClient();

// Get all panels for a document
const panels = await client.getDocumentPanels('document-id');
console.log(`Document has ${panels.length} panels`);

// Get a specific panel by title
const summaryPanel = await client.getDocumentPanelByTitle('document-id', 'Summary');

// Extract structured content from a panel
if (summaryPanel) {
  const sections = client.extractStructuredContent(summaryPanel);
  console.log('Introduction:', sections['Introduction']);
  console.log('Key Decisions:', sections['Key Decisions']);
}

// Use webhook client types
const webhookClient = new WebhookClient();
webhookClient.setWebhookConfig({
  url: 'https://example.com/webhook'
});
const result: WebhookResult = await webhookClient.processMeeting('doc-id');

// Use generated schema types
type Document = components['schemas']['Document'];
type WorkspaceResponse = components['schemas']['WorkspaceResponse'];
```

## Organization Detection

The library includes an organization detection system that can be customized:

```typescript
import { OrganizationDetector } from 'granola-ts-client';

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