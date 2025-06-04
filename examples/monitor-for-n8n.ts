// examples/monitor-for-n8n.ts
import { WebhookClient, OrganizationDetector } from '../src';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Configuration for the monitoring script
 */
interface MonitorConfig {
  // N8n webhook URL to send data to
  webhookUrl: string;
  
  // How far back to look for meetings (in days)
  lookbackDays: number;
  
  // Maximum number of meetings to process per run
  maxMeetingsPerRun: number;
  
  // Whether to include full transcript data
  includeTranscript: boolean;
  
  // Path to store the state file
  stateFilePath: string;
  
  // Organization detection configuration file path (optional)
  organizationConfigPath?: string;
}

/**
 * State file structure
 */
interface StateFile {
  // When the last check was performed
  lastCheckTimestamp: string;
  
  // List of processed meeting IDs
  processedMeetings: Array<{
    id: string;
    title: string;
    processed_at: string;
    success: boolean;
  }>;
}

/**
 * Monitor for new Granola meetings and send them to n8n webhook
 */
async function monitorForN8n() {
  // Configuration 
  const config: MonitorConfig = {
    webhookUrl: process.env.N8N_WEBHOOK_URL || 'https://your-n8n-instance.com/webhook/granola-meeting',
    lookbackDays: Number(process.env.LOOKBACK_DAYS || '3'),
    maxMeetingsPerRun: Number(process.env.MAX_MEETINGS || '10'),
    includeTranscript: process.env.INCLUDE_TRANSCRIPT === 'true',
    stateFilePath: process.env.STATE_FILE_PATH || './processed-meetings.json',
    organizationConfigPath: process.env.ORG_CONFIG_PATH
  };
  
  console.log(`
=== Granola Meeting Monitor for n8n ===
Webhook URL: ${config.webhookUrl}
Lookback: ${config.lookbackDays} days
Max meetings per run: ${config.maxMeetingsPerRun}
Include transcript: ${config.includeTranscript ? 'Yes' : 'No'}
State file: ${config.stateFilePath}
Organization config: ${config.organizationConfigPath || 'Using default'}
  `);
  
  // Load or initialize state
  let state: StateFile;
  try {
    if (fs.existsSync(config.stateFilePath)) {
      const stateData = fs.readFileSync(config.stateFilePath, 'utf8');
      state = JSON.parse(stateData);
      console.log(`Loaded state file. Last check: ${state.lastCheckTimestamp}`);
      console.log(`Found ${state.processedMeetings.length} previously processed meetings`);
    } else {
      state = {
        lastCheckTimestamp: new Date(Date.now() - config.lookbackDays * 24 * 60 * 60 * 1000).toISOString(),
        processedMeetings: []
      };
      console.log(`No state file found. Starting with lookback from ${state.lastCheckTimestamp}`);
    }
  } catch (error) {
    console.error(`Error loading state file:`, error);
    state = {
      lastCheckTimestamp: new Date(Date.now() - config.lookbackDays * 24 * 60 * 60 * 1000).toISOString(),
      processedMeetings: []
    };
    console.log(`Initializing new state with lookback from ${state.lastCheckTimestamp}`);
  }
  
  // Create a set of processed IDs for faster lookups
  const processedIds = new Set(state.processedMeetings.map(m => m.id));
  
  // Initialize webhook client
  console.log(`Initializing WebhookClient...`);
  
  // Load organization detector if config is specified
  let organizationDetector: OrganizationDetector | undefined;
  if (config.organizationConfigPath && fs.existsSync(config.organizationConfigPath)) {
    try {
      console.log(`Loading organization configuration from ${config.organizationConfigPath}`);
      organizationDetector = OrganizationDetector.fromFile(config.organizationConfigPath);
    } catch (error) {
      console.error(`Error loading organization configuration:`, error);
    }
  }
  
  // Create webhook client
  const client = new WebhookClient();
  
  // Set webhook configuration
  client.setWebhookConfig({
    url: config.webhookUrl,
    headers: {
      'User-Agent': 'Granola-n8n-Monitor/1.0.0',
      'X-Source': 'granola-ts-client'
    },
    maxRetries: 3,
    retryStrategy: 'exponential',
    retryDelay: 1000,
    includeTranscript: config.includeTranscript
  });
  
  // Set organization detector if available
  if (organizationDetector) {
    client.setOrganizationDetector(organizationDetector);
  }
  
  try {
    // Define lookback date
    const lookbackDate = new Date(state.lastCheckTimestamp);
    console.log(`\nLooking for meetings since: ${lookbackDate.toISOString()}`);
    
    // Process unprocessed meetings
    console.log(`Processing up to ${config.maxMeetingsPerRun} unprocessed meetings...`);
    const results = await client.processUnprocessedMeetings(
      lookbackDate,
      processedIds,
      config.maxMeetingsPerRun
    );
    
    // Update state with results
    if (results.length > 0) {
      console.log(`\nProcessed ${results.length} meetings:`);
      
      // Get documents again to store titles
      const docs = await client.getDocuments({ limit: 100 });
      const docsMap = new Map();
      if (docs.docs) {
        for (const doc of docs.docs) {
          docsMap.set(doc.document_id || doc.id, doc);
        }
      }
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        // Get document ID from processedIds (converted from Set back to Array)
        const documentId = Array.from(processedIds)[processedIds.size - results.length + i];
        const doc = docsMap.get(documentId);
        
        console.log(`  ${i+1}. ${doc?.title || 'Unknown'} (${documentId}): ${result.success ? 'Success' : 'Failed'}`);
        
        // Add to processed meetings
        state.processedMeetings.push({
          id: documentId,
          title: doc?.title || 'Unknown',
          processed_at: new Date().toISOString(),
          success: result.success
        });
      }
    } else {
      console.log(`\nNo new meetings to process.`);
    }
    
    // Update timestamp
    state.lastCheckTimestamp = new Date().toISOString();
    
    // Save state
    fs.writeFileSync(config.stateFilePath, JSON.stringify(state, null, 2));
    console.log(`\nState saved to ${config.stateFilePath}`);
    console.log(`Next run will check for meetings after ${state.lastCheckTimestamp}`);
    
  } catch (error) {
    console.error(`Error monitoring meetings:`, error);
  }
}

// Execute if run directly
if (require.main === module) {
  monitorForN8n()
    .then(() => console.log('\nMonitoring complete.'))
    .catch(error => console.error('\nError running monitor:', error));
}

// Export for module usage
export { monitorForN8n };