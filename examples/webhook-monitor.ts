// examples/webhook-monitor.ts
import { WebhookClient, WebhookConfig, OrganizationDetectorConfig, OrganizationDetector } from '../src';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

/**
 * Environment configuration
 */
interface EnvironmentConfig {
  url: string;
  headers: Record<string, string>;
}

/**
 * Configuration loader for webhook monitoring
 */
interface WebhookMonitorConfig {
  environments: {
    test: EnvironmentConfig;
    production: EnvironmentConfig;
    [key: string]: EnvironmentConfig;
  };
  webhook: Omit<WebhookConfig, 'url' | 'headers'> & {
    activeEnvironment: string;
  };
  monitoring: {
    lookbackDays: number;
    maxMeetingsPerRun: number;
    stateFilePath: string;
  };
  organizations: Array<{
    name: string;
    titleKeywords: string[];
    emailDomains: string[];
    emailAddresses?: string[];
    companyNames?: string[];
  }>;
  joshTemplateId: string;
  defaultOrganization: string;
}

/**
 * Loads configuration from file
 */
function loadConfig(configPath: string): WebhookMonitorConfig {
  try {
    if (!fs.existsSync(configPath)) {
      console.error(`Configuration file not found: ${configPath}`);
      console.error(`Please copy webhook-config.example.json to ${configPath} and customize it.`);
      process.exit(1);
    }
    
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error(`Error loading configuration:`, error);
    process.exit(1);
  }
}

/**
 * Creates state file directory if it doesn't exist
 */
function ensureStateDirectory(stateFilePath: string): void {
  const dirName = path.dirname(stateFilePath);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
    console.log(`Created directory: ${dirName}`);
  }
}

/**
 * Send notification to Slack channel via webhook or email
 * @param subject Notification subject/title
 * @param body Notification body/message
 */
async function sendSlackNotification(subject: string, body: string): Promise<void> {
  // Try webhook first if configured (preferred method)
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      // Create payload with formatted message
      const payload = {
        text: `*${subject}*\n\n${body}`
      };
      
      // Send to webhook
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        console.log('Slack notification sent via webhook');
        return;
      } else {
        console.error(`Webhook error: ${response.status} ${response.statusText}`);
        // Fall back to email if webhook fails
      }
    } catch (error) {
      console.error('Failed to send webhook notification:', error);
      // Fall back to email if webhook fails
    }
  }
  
  // Fall back to email if webhook is not configured or failed
  const slackEmail = process.env.SLACK_EMAIL;
  if (slackEmail) {
    try {
      // Prepare email command - escape quotes in subject and body
      const escapedSubject = subject.replace(/"/g, '\\"');
      const escapedBody = body.replace(/"/g, '\\"').replace(/`/g, '\\`');
      const emailCommand = `echo "${escapedBody}" | mail -s "${escapedSubject}" ${slackEmail}`;
      
      // Execute the command
      exec(emailCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error sending notification email: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`Email stderr: ${stderr}`);
          return;
        }
        console.log(`Notification email sent to Slack channel (${slackEmail})`);
      });
    } catch (error) {
      console.error(`Failed to send notification email:`, error);
    }
  } else if (!webhookUrl) {
    // No notification methods configured
    console.error('No Slack notification methods configured. Set SLACK_WEBHOOK_URL or SLACK_EMAIL in .env');
  }
}

/**
 * Load or initialize state file
 */
function loadOrInitializeState(stateFilePath: string, lookbackDays: number): {
  lastCheckTimestamp: string;
  processedMeetings: Array<{
    id: string;
    title: string;
    processed_at: string;
    success: boolean;
  }>;
  failureTracking?: {
    consecutiveFailures: number;
    lastNotificationTime: string | null;
    lastSuccessTime: string;
  };
} {
  try {
    if (fs.existsSync(stateFilePath)) {
      const stateData = fs.readFileSync(stateFilePath, 'utf8');
      return JSON.parse(stateData);
    } else {
      // Initialize with lookback date
      return {
        lastCheckTimestamp: new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString(),
        processedMeetings: [],
        failureTracking: {
          consecutiveFailures: 0,
          lastNotificationTime: null,
          lastSuccessTime: new Date().toISOString()
        }
      };
    }
  } catch (error) {
    console.error(`Error loading state file:`, error);
    // Return fresh state
    return {
      lastCheckTimestamp: new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString(),
      processedMeetings: [],
      failureTracking: {
        consecutiveFailures: 0,
        lastNotificationTime: null,
        lastSuccessTime: new Date().toISOString()
      }
    };
  }
}

/**
 * Monitor for meetings and send them to configured webhook
 */
async function monitorMeetings(configPath: string = './webhook-config.private.json', specificMeetingId?: string): Promise<void> {
  console.log("Starting Granola meeting monitor for webhook integration");
  
  // 1. Load configuration
  const config = loadConfig(configPath);
  console.log(`Loaded configuration from ${configPath}`);
  console.log(`Using webhook URL: ${config.webhook.url}`);
  console.log(`Organization detection configured for: ${config.organizations.map(o => o.name).join(', ')}`);
  
  // 2. Ensure state directory exists
  ensureStateDirectory(config.monitoring.stateFilePath);
  
  // 3. Load or initialize state
  const state = loadOrInitializeState(
    config.monitoring.stateFilePath, 
    config.monitoring.lookbackDays
  );
  console.log(`Monitoring meetings since: ${state.lastCheckTimestamp}`);
  console.log(`Previously processed ${state.processedMeetings.length} meetings`);
  
  // Initialize failure tracking if not present
  if (!state.failureTracking) {
    state.failureTracking = {
      consecutiveFailures: 0,
      lastNotificationTime: null,
      lastSuccessTime: new Date().toISOString()
    };
  }
  
  // 4. Create a set of processed IDs
  const processedIds = new Set(state.processedMeetings.map(m => m.id));
  
  // 5. Create organization detector config
  const orgConfig: OrganizationDetectorConfig = {
    organizations: config.organizations,
    defaultOrganization: config.defaultOrganization
  };
  
  // 6. Initialize webhook client
  console.log("Initializing WebhookClient...");
  const client = new WebhookClient();
  
  // 7. Get active environment
  const activeEnv = config.webhook.activeEnvironment || 'test';
  const environment = config.environments[activeEnv];
  
  if (!environment) {
    throw new Error(`Environment '${activeEnv}' not found in configuration`);
  }
  
  console.log(`Using environment: ${activeEnv}`);
  
  // 8. Configure webhook with the active environment
  const webhookConfig: WebhookConfig = {
    ...config.webhook,
    url: environment.url,
    headers: environment.headers
  };
  
  client.setWebhookConfig(webhookConfig);
  
  // 9. Set the organization detector config
  client.setOrganizationDetector(new OrganizationDetector(orgConfig));
  
  // 9. Set the Josh Template ID if configured
  if (config.joshTemplateId) {
    client.setJoshTemplateId(config.joshTemplateId);
  }
  
  try {
    // If a specific meeting ID was provided, process just that one
    if (specificMeetingId) {
      console.log(`\nProcessing specific meeting with ID: ${specificMeetingId}`);
      const result = await client.processMeeting(specificMeetingId);
      console.log(`\nMeeting processed: ${result.success ? '✅ Success' : '❌ Failed'}`);
      
      // Get documents to store titles
      const docs = await client.getDocuments({ limit: 100 });
      const docsMap = new Map();
      if (docs.docs) {
        for (const doc of docs.docs) {
          docsMap.set(doc.document_id || doc.id, doc);
        }
      }
      
      const doc = docsMap.get(specificMeetingId);
      const meetingTitle = doc?.title || 'Unknown';
      
      // Send notification based on result
      if (result.success) {
        // Success notification
        const successSubject = `✅ Success: processed "${meetingTitle}"`;
        const successBody = `
Successfully processed meeting:
- Title: ${meetingTitle}
- ID: ${specificMeetingId}
- Time: ${new Date().toLocaleString()}
- Environment: ${config.webhook.activeEnvironment}
`;
        await sendSlackNotification(successSubject, successBody);
        
        // Add to processed meetings if not already there
        if (!processedIds.has(specificMeetingId)) {
          state.processedMeetings.push({
            id: specificMeetingId,
            title: meetingTitle,
            processed_at: new Date().toISOString(),
            success: true
          });
        }
      } else {
        // Failure notification
        const failureSubject = `🔴 ERROR: Failed to process "${meetingTitle}"`;
        const failureBody = `
*MEETING PROCESSING ERROR*

Failed to process meeting:
- Title: ${meetingTitle}
- ID: ${specificMeetingId}
- Time: ${new Date().toLocaleString()}
- Environment: ${config.webhook.activeEnvironment}

Please check the logs for detailed error information.
`;
        await sendSlackNotification(failureSubject, failureBody);
        
        // Still add to processed meetings to track the failure
        if (!processedIds.has(specificMeetingId)) {
          state.processedMeetings.push({
            id: specificMeetingId,
            title: meetingTitle,
            processed_at: new Date().toISOString(),
            success: false
          });
        }
      }
    } else {
      // 10. Process unprocessed meetings
      console.log(`\nLooking for unprocessed meetings since ${new Date(state.lastCheckTimestamp).toLocaleString()}...`);
      const lookbackDate = new Date(state.lastCheckTimestamp);
      
      // 11. Get unprocessed meetings
      const results = await client.processUnprocessedMeetings(
        lookbackDate,
        processedIds,
        config.monitoring.maxMeetingsPerRun
      );
      
      // 12. Update state with results
      if (results.length > 0) {
        console.log(`\nProcessed ${results.length} meetings:`);
        
        // Get documents to store titles
        const docs = await client.getDocuments({ limit: 100 });
        const docsMap = new Map();
        if (docs.docs) {
          for (const doc of docs.docs) {
            docsMap.set(doc.document_id || doc.id, doc);
          }
        }
        
        // Add to processed meetings list
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const documentId = Array.from(processedIds)[processedIds.size - results.length + i];
          const doc = docsMap.get(documentId);
          
          const meetingTitle = doc?.title || 'Unknown';
          const success = result.success;
          console.log(`  ${i+1}. ${meetingTitle} (${documentId}): ${success ? '✅ Success' : '❌ Failed'}`);
          
          // Send success notification for each processed meeting
          if (success) {
            const successSubject = `✅ Success: processed "${meetingTitle}"`;
            const successBody = `
Successfully processed meeting:
- Title: ${meetingTitle}
- ID: ${documentId}
- Time: ${new Date().toLocaleString()}
- Environment: ${config.webhook.activeEnvironment}
`;
            await sendSlackNotification(successSubject, successBody);
          } else {
            // Send failure notification for this specific meeting
            const failureSubject = `🔴 ERROR: Failed to process "${meetingTitle}"`;
            const failureBody = `
*MEETING PROCESSING ERROR*

Failed to process meeting:
- Title: ${meetingTitle}
- ID: ${documentId}
- Time: ${new Date().toLocaleString()}
- Environment: ${config.webhook.activeEnvironment}

Please check the logs for detailed error information.
`;
            await sendSlackNotification(failureSubject, failureBody);
          }
          
          // Add to processed meetings
          state.processedMeetings.push({
            id: documentId,
            title: meetingTitle,
            processed_at: new Date().toISOString(),
            success: success
          });
        }
      } else {
        console.log(`\nNo new meetings to process.`);
      }
    }
    
    // 13. Update timestamp and reset failure tracking on success
    state.lastCheckTimestamp = new Date().toISOString();
    
    // Record success and reset failure counter
    if (state.failureTracking) {
      const prevFailures = state.failureTracking.consecutiveFailures;
      state.failureTracking.consecutiveFailures = 0;
      state.failureTracking.lastSuccessTime = new Date().toISOString();
      
      // Send recovery notification if we had failures before
      if (prevFailures >= 3) {
        const subject = `✅ GRANOLA PROCESSING RECOVERED`;
        const body = `
*GRANOLA PROCESSING RECOVERED*

Granola webhook monitor has recovered at ${new Date().toLocaleString()}

Previous consecutive failures: ${prevFailures}
Environment: ${config.webhook.activeEnvironment}
Configuration: ${configPath}

The monitor is now working properly again.
`;
        await sendSlackNotification(subject, body);
      }
    }
    
    // 14. Save state
    fs.writeFileSync(config.monitoring.stateFilePath, JSON.stringify(state, null, 2));
    console.log(`\nState saved to ${config.monitoring.stateFilePath}`);
    console.log(`Next run will check for meetings after ${state.lastCheckTimestamp}`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error monitoring meetings:`, error);
    
    // Increment failure counter
    if (state.failureTracking) {
      state.failureTracking.consecutiveFailures++;
      
      // Only send notification every 3 failures or if this is the first failure
      const shouldNotify = 
        state.failureTracking.consecutiveFailures === 1 || 
        state.failureTracking.consecutiveFailures % 3 === 0;
      
      if (shouldNotify) {
        // Send notification email
        const subject = `🔴 ERROR IN GRANOLA PROCESSING (${state.failureTracking.consecutiveFailures} consecutive failures)`;
        const body = `
*ERROR IN GRANOLA PROCESSING*

Granola webhook monitor encountered an error at ${new Date().toLocaleString()}

Error: ${errorMessage}

Environment: ${config.webhook.activeEnvironment}
Configuration: ${configPath}
Consecutive failures: ${state.failureTracking.consecutiveFailures}
Last success: ${state.failureTracking.lastSuccessTime}

This could indicate that the Granola API has changed, or there are network/authentication issues.
Please check the logs for more details.
`;
        
        await sendSlackNotification(subject, body);
        state.failureTracking.lastNotificationTime = new Date().toISOString();
      }
      
      // Save the updated state even on failure
      try {
        fs.writeFileSync(config.monitoring.stateFilePath, JSON.stringify(state, null, 2));
        console.log(`Failure state saved to ${config.monitoring.stateFilePath}`);
      } catch (stateError) {
        console.error(`Could not save failure state:`, stateError);
      }
    } else {
      // Send notification if failureTracking is not initialized
      const subject = `🔴 ERROR IN GRANOLA PROCESSING`;
      const body = `
*ERROR IN GRANOLA PROCESSING*

Granola webhook monitor encountered an error at ${new Date().toLocaleString()}

Error: ${errorMessage}

Environment: ${config.webhook.activeEnvironment}
Configuration: ${configPath}

This could indicate that the Granola API has changed, or there are network/authentication issues.
Please check the logs for more details.
`;
      
      await sendSlackNotification(subject, body);
    }
    
    process.exit(1);
  }
}

/**
 * Monitor for meetings and send them to configured webhook with specified environment
 */
async function monitorMeetingsWithEnv(configPath: string = './webhook-config.private.json', environment?: string, meetingId?: string): Promise<void> {
  // Load config
  const config = loadConfig(configPath);
  
  // Override environment if specified
  if (environment) {
    if (!config.environments[environment]) {
      throw new Error(`Environment '${environment}' not found in configuration`);
    }
    config.webhook.activeEnvironment = environment;
  }
  
  // Run the monitor with the specified or configured environment
  await monitorMeetings(configPath, meetingId);
}

// Run if called directly
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let configPath = './webhook-config.private.json';
  let environment: string | undefined;
  let meetingId: string | undefined;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' || args[i] === '-c') {
      configPath = args[i + 1];
      i++;
    } else if (args[i] === '--env' || args[i] === '-e') {
      environment = args[i + 1];
      i++;
    } else if (args[i] === '--meeting' || args[i] === '-m') {
      meetingId = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: webhook-monitor.ts [options]

Options:
  --config, -c <path>   Path to webhook configuration file (default: ./webhook-config.private.json)
  --env, -e <env>       Environment to use (test or production)
  --meeting, -m <id>    Process a specific meeting by ID
  --help, -h            Show this help message
      `);
      process.exit(0);
    } else if (!args[i].startsWith('-') && i === 0) {
      // For backward compatibility, assume first non-flag arg is config path
      configPath = args[i];
    }
  }
  
  monitorMeetingsWithEnv(configPath, environment, meetingId)
    .then(() => console.log('\nMonitoring complete.'))
    .catch(error => console.error('\nError running monitor:', error));
}

export { monitorMeetings, monitorMeetingsWithEnv };