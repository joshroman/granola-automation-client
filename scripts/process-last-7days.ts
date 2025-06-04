// scripts/process-last-7days.ts
import { WebhookClient, OrganizationDetector } from '../src';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Process all meetings from the last 7 days
 */
async function processLast7Days() {
  console.log("========================================");
  console.log("PROCESSING ALL MEETINGS FROM LAST 7 DAYS");
  console.log("========================================");
  
  // Initialize the webhook client
  console.log("\nInitializing WebhookClient...");
  const client = new WebhookClient();
  
  // Load the webhook configuration
  const configPath = './webhook-config.private.json';
  
  if (!fs.existsSync(configPath)) {
    console.error(`Configuration file not found: ${configPath}`);
    process.exit(1);
  }
  
  const configData = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(configData);
  
  // Use production environment
  const environment = 'production';
  console.log(`Using environment: ${environment}`);
  
  if (!config.environments[environment]) {
    console.error(`Environment '${environment}' not found in configuration`);
    process.exit(1);
  }
  
  // Configure the webhook
  const webhookConfig = {
    ...config.webhook,
    url: config.environments[environment].url,
    headers: config.environments[environment].headers
  };
  
  client.setWebhookConfig(webhookConfig);
  
  // Set up organization detector if configured
  const orgConfig = {
    organizations: config.organizations,
    defaultOrganization: config.defaultOrganization
  };
  
  // Create and set the organization detector
  client.setOrganizationDetector(new OrganizationDetector(orgConfig));
  
  // Set the Josh Template ID if configured
  if (config.joshTemplateId) {
    client.setJoshTemplateId(config.joshTemplateId);
  }
  
  try {
    // Calculate the date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    console.log(`\nFetching meetings since: ${sevenDaysAgo.toLocaleString()}`);
    
    // Get documents from the last 7 days
    const documents = await client.getDocuments({
      limit: 100,
      created_after: sevenDaysAgo.toISOString()
    });
    
    console.log(`Found ${documents.docs?.length || 0} meetings in the last 7 days`);
    
    if (!documents.docs || documents.docs.length === 0) {
      console.log("No meetings to process.");
      return;
    }
    
    // Create a set to track processed meetings
    const processedIds = new Set<string>();
    
    // Create a directory for state if it doesn't exist
    const stateDir = path.dirname(config.monitoring.stateFilePath);
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
      console.log(`Created directory: ${stateDir}`);
    }
    
    // Load existing state if available
    let state: any = {
      lastCheckTimestamp: sevenDaysAgo.toISOString(),
      processedMeetings: []
    };
    
    if (fs.existsSync(config.monitoring.stateFilePath)) {
      const stateData = fs.readFileSync(config.monitoring.stateFilePath, 'utf8');
      try {
        state = JSON.parse(stateData);
        
        // Add existing processed IDs to our set
        for (const meeting of state.processedMeetings) {
          processedIds.add(meeting.id);
        }
        
        console.log(`Loaded ${processedIds.size} previously processed meeting IDs`);
      } catch (error) {
        console.error(`Error parsing state file:`, error);
        // Continue with empty state
      }
    }
    
    // Sort documents by created_at, oldest first to maintain chronological processing
    const sortedDocs = [...documents.docs].sort((a, b) => {
      const dateA = new Date(a.created_at || "").getTime();
      const dateB = new Date(b.created_at || "").getTime();
      return dateA - dateB;
    });
    
    // Process each meeting
    console.log("\nProcessing meetings:");
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < sortedDocs.length; i++) {
      const doc = sortedDocs[i];
      const documentId = doc.document_id || doc.id;
      
      if (!documentId) {
        console.log(`  ${i+1}/${sortedDocs.length}: ❓ Meeting has no ID, skipping`);
        skippedCount++;
        continue;
      }
      
      // Skip if already processed
      if (processedIds.has(documentId)) {
        console.log(`  ${i+1}/${sortedDocs.length}: ⏭️  ${doc.title} (${documentId}): Already processed, skipping`);
        skippedCount++;
        continue;
      }
      
      console.log(`  ${i+1}/${sortedDocs.length}: 🔄 Processing ${doc.title} (${documentId})`);
      
      try {
        // Process and send the meeting
        const result = await client.processMeeting(documentId);
        
        if (result.success) {
          console.log(`    ✅ Success!`);
          successCount++;
          
          // Add to processed meetings
          state.processedMeetings.push({
            id: documentId,
            title: doc.title || 'Unknown',
            processed_at: new Date().toISOString(),
            success: true
          });
          processedIds.add(documentId);
        } else {
          console.log(`    ❌ Failed: ${result.error}`);
          failCount++;
          
          // Add to processed meetings as failed
          state.processedMeetings.push({
            id: documentId,
            title: doc.title || 'Unknown',
            processed_at: new Date().toISOString(),
            success: false,
            error: result.error
          });
          processedIds.add(documentId);
        }
      } catch (error) {
        console.log(`    ❌ Error: ${error}`);
        failCount++;
        
        // Add to processed meetings as failed
        state.processedMeetings.push({
          id: documentId,
          title: doc.title || 'Unknown',
          processed_at: new Date().toISOString(),
          success: false,
          error: `${error}`
        });
        processedIds.add(documentId);
      }
    }
    
    // Update timestamp
    state.lastCheckTimestamp = new Date().toISOString();
    
    // Save state
    fs.writeFileSync(config.monitoring.stateFilePath, JSON.stringify(state, null, 2));
    console.log(`\nState saved to ${config.monitoring.stateFilePath}`);
    
    // Summary
    console.log("\n========== PROCESSING SUMMARY ==========");
    console.log(`Total meetings found: ${sortedDocs.length}`);
    console.log(`Successfully processed: ${successCount}`);
    console.log(`Failed to process: ${failCount}`);
    console.log(`Skipped (already processed): ${skippedCount}`);
    console.log("=======================================");
    
  } catch (error) {
    console.error(`Error processing meetings:`, error);
    process.exit(1);
  }
}

// Run the function
processLast7Days()
  .then(() => {
    console.log("\nFinished processing all meetings from the past 7 days.");
  })
  .catch(error => {
    console.error("\nError:", error);
    process.exit(1);
  });