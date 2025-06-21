import { PanelClient } from "../src/panel-client";

// Example meeting IDs
const MEETING_IDS = [
  "20fde695-1fc7-473f-b9e7-a9e60ff641eb", // Meet This Moment Tuesday Talk
  "fc21681f-acc9-4d00-a5e9-15d81ad8a0a9"  // Other meeting
];

async function checkMeetingWorkspace() {
  try {
    console.log("Checking meeting workspace/folder information...");
    
    // Initialize client
    const client = new PanelClient();
    
    // First, get workspaces to understand available folders
    console.log("\nFetching available workspaces:");
    const workspaces = await client.getWorkspaces();
    
    console.log(`Found ${workspaces.workspaces?.length || 0} workspaces:`);
    workspaces.workspaces?.forEach((ws, i) => {
      console.log(`${i+1}. ${ws.workspace.display_name || '[Unnamed]'} (${ws.workspace.workspace_id})`);
      console.log(`   Role: ${ws.role}`);
      console.log(`   Plan: ${ws.plan_type}`);
    });
    
    // Check each meeting
    for (const meetingId of MEETING_IDS) {
      console.log(`\n=== Checking meeting ${meetingId} ===`);
      
      // Get document details
      const documents = await client.getDocuments({ 
        limit: 50
      });
      
      // Find this specific document
      const document = documents.docs?.find(doc => doc.id === meetingId);
      
      if (!document) {
        console.log(`Meeting ${meetingId} not found in recent documents`);
        continue;
      }
      
      console.log(`Meeting title: ${document.title}`);
      console.log(`Created: ${document.created_at}`);
      
      // Check if workspace_id is available directly in the document
      if (document.workspace_id) {
        console.log(`Workspace ID: ${document.workspace_id}`);
        
        // Look up the workspace name
        const workspace = workspaces.workspaces?.find(
          ws => ws.workspace.workspace_id === document.workspace_id
        );
        
        if (workspace) {
          console.log(`Workspace name: ${workspace.workspace.display_name}`);
        }
      } else {
        console.log("No workspace_id found in document metadata");
      }
      
      // Check if there are any other workspace-related fields
      const docKeys = Object.keys(document);
      console.log("\nDocument fields related to workspace/folder:");
      
      const workspaceRelatedKeys = docKeys.filter(key => 
        key.toLowerCase().includes('workspace') ||
        key.toLowerCase().includes('folder')
      );
      
      if (workspaceRelatedKeys.length > 0) {
        workspaceRelatedKeys.forEach(key => {
          console.log(`${key}: ${JSON.stringify(document[key as keyof typeof document])}`);
        });
      } else {
        console.log("No workspace/folder related fields found in document");
      }
      
      // Try getting additional metadata
      try {
        console.log("\nFetching additional document metadata:");
        const metadata = await client.getDocumentMetadata(meetingId);
        
        console.log("Metadata fields:");
        console.log(JSON.stringify(metadata, null, 2).substring(0, 500) + "...");
        
        // Check if metadata contains workspace info
        const metadataKeys = Object.keys(metadata);
        const workspaceMetadataKeys = metadataKeys.filter(key => 
          key.toLowerCase().includes('workspace') ||
          key.toLowerCase().includes('folder')
        );
        
        if (workspaceMetadataKeys.length > 0) {
          console.log("\nWorkspace/folder fields in metadata:");
          workspaceMetadataKeys.forEach(key => {
            console.log(`${key}: ${JSON.stringify(metadata[key as keyof typeof metadata])}`);
          });
        } else {
          console.log("\nNo workspace/folder fields found in metadata");
        }
      } catch (error) {
        console.error("Error fetching metadata:", error);
      }
    }
    
  } catch (error) {
    console.error("Error checking meeting workspace:", error);
  }
}

// Run the script
checkMeetingWorkspace();