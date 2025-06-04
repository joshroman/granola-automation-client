# Granola TypeScript Client

A TypeScript client for the Granola API with enhanced features.

## Features

- **Basic API Client:** Full TypeScript client for the Granola API
- **Automatic Authentication:** Extracts tokens from the local Granola app installation
- **Enhanced Transcripts:** Speaker identification, deduplication, and improved formatting
- **Document Panels:** Access and extract structured content from meeting summaries
- **Organization Detection:** Determine which organization a meeting belongs to

The client provides powerful capabilities for working with Granola meeting data:

- **Enhanced Transcript Processing**: Extract transcripts with automatic speaker identification and improved formatting
- **AI Meeting Summaries**: Access AI-generated meeting summaries and structured panel content
- **Webhook Integration**: Send meeting data to automation platforms like n8n for custom workflows
- **Organization Detection**: Automatically identify which organization a meeting belongs to based on context clues

## Installation

```bash
npm install granola-ts-client
# or
yarn add granola-ts-client
# or
bun add granola-ts-client
```

## Basic Usage

```typescript
import { GranolaClient } from 'granola-ts-client';

// Initialize with automatic token retrieval from local Granola app
const client = new GranolaClient();

// Get workspaces
const workspaces = await client.getWorkspaces();
console.log(`You have ${workspaces.workspaces.length} workspaces`);

// Get documents
const documents = await client.getDocuments({ limit: 20 });
console.log(`Found ${documents.docs.length} documents`);

// Get transcript for a document
const transcript = await client.getDocumentTranscript('document-id');
console.log(`Transcript has ${transcript.length} segments`);
```

## Enhanced Transcript Features

The `TranscriptClient` extends the base client with speaker identification and transcript processing:

```typescript
import { TranscriptClient } from 'granola-ts-client';

// Initialize client
const client = new TranscriptClient();

// Get transcript with speaker identification
const transcriptWithSpeakers = await client.getDocumentTranscriptWithSpeakers('document-id');

// Export transcript with speaker formatting to markdown
await client.exportTranscriptMarkdown(
  'document-id',
  'output.md',
  {
    deduplicate: true,  // deduplicate segments (default: true)
    similarityThreshold: 0.68,  // similarity threshold (default: 0.68)
    timeWindowSeconds: 4.5,  // time window seconds (default: 4.5)
    groupBySpeaker: true,  // group by speaker (default: true)
    includeTimestamps: true  // include timestamps (default: false)
  }
);
```

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

The client includes a `WebhookClient` class for sending meeting data to external systems like n8n:

```ts
import { WebhookClient } from 'granola-ts-client';

// Initialize the webhook client
const client = new WebhookClient();

// Configure the webhook endpoint
client.setWebhookConfig({
  url: 'https://n8n.example.com/webhook/granola',
  headers: { 'X-Api-Key': 'your-api-key' },
  includeTranscript: true,
  maxRetries: 3,
  retryStrategy: 'exponential',
  retryDelay: 1000
});

// Process a specific meeting and send to webhook
const result = await client.processMeeting('document-id');
console.log(`Webhook delivery: ${result.success ? 'Success' : 'Failed'}`);

// Process all unprocessed meetings since a date
const processedIds = new Set(['already-processed-id-1', 'already-processed-id-2']);
const results = await client.processUnprocessedMeetings(
  new Date('2025-06-01'),  // Only process meetings after this date
  processedIds,           // Skip already processed meetings
  10                      // Process up to 10 meetings
);
```

The webhook client sends detailed meeting information:

1. **Meeting Metadata**: Title, date, participants, duration, organization
2. **Josh Template Content**: Introduction, agenda, decisions, action items, etc.
3. **Enhanced Transcript**: Speaker-identified transcript in text and markdown formats

The client also provides:

- **Retry Logic**: Configurable retry strategy for failed webhook deliveries
- **Webhook Signing**: Optional HMAC signature for secure delivery
- **Filtering**: Process only meetings you haven't processed before
- **Organization Detection**: Automatically determine which organization a meeting belongs to

### Other APIs

```ts
// Get panel templates
const templates = await client.getPanelTemplates();

// Get people data
const people = await client.getPeople();

// Get feature flags
const featureFlags = await client.getFeatureFlags();

// Get Notion integration details
const notionIntegration = await client.getNotionIntegration();

// Get subscription information
const subscriptions = await client.getSubscriptions();

// Refresh Google Calendar events
await client.refreshGoogleEvents();

// Check for application updates
const updateInfo = await client.checkForUpdate();
```

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

## License

MIT