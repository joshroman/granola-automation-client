// scripts/reprocess-last-7days.ts
import { WebhookClient, OrganizationDetector } from '../src';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Reprocess all meetings from the last 7 days
 * This version ignores the state file and reprocesses all meetings regardless of previous status
 */
async function reprocessLast7Days() {
  console.log("========================================");
  console.log("REPROCESSING ALL MEETINGS FROM LAST 7 DAYS");
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
    
    // Don't load the state file - we're going to reprocess everything
    
    // Sort documents by created_at, oldest first to maintain chronological processing
    const sortedDocs = [...documents.docs].sort((a, b) => {
      const dateA = new Date(a.created_at || "").getTime();
      const dateB = new Date(b.created_at || "").getTime();
      return dateA - dateB;
    });
    
    // Process each meeting
    console.log("\nReprocessing meetings:");
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < sortedDocs.length; i++) {
      const doc = sortedDocs[i];
      const documentId = doc.document_id || doc.id;
      
      if (!documentId) {
        console.log(`  ${i+1}/${sortedDocs.length}: ❓ Meeting has no ID, skipping`);
        continue;
      }
      
      console.log(`  ${i+1}/${sortedDocs.length}: 🔄 Reprocessing ${doc.title} (${documentId})`);
      
      try {
        // Process and send the meeting
        const result = await client.processMeeting(documentId);
        
        if (result.success) {
          console.log(`    ✅ Success!`);
          successCount++;
        } else {
          console.log(`    ❌ Failed: ${result.error}`);
          failCount++;
        }
      } catch (error) {
        console.log(`    ❌ Error: ${error}`);
        failCount++;
      }
    }
    
    // Summary
    console.log("\n========== PROCESSING SUMMARY ==========");
    console.log(`Total meetings found: ${sortedDocs.length}`);
    console.log(`Successfully reprocessed: ${successCount}`);
    console.log(`Failed to process: ${failCount}`);
    console.log("=======================================");
    
  } catch (error) {
    console.error(`Error processing meetings:`, error);
    process.exit(1);
  }
}

// Run the function
reprocessLast7Days()
  .then(() => {
    console.log("\nFinished reprocessing all meetings from the past 7 days.");
  })
  .catch(error => {
    console.error("\nError:", error);
    process.exit(1);
  });