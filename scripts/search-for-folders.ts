import { PanelClient } from "../src/panel-client";

// Meeting IDs to check
const MEETINGS = [
  { id: "20fde695-1fc7-473f-b9e7-a9e60ff641eb", expectedFolder: "Mindshift" }, // Meet This Moment
  { id: "fc21681f-acc9-4d00-a5e9-15d81ad8a0a9", expectedFolder: "OMAI" }      // OMAI Team Talk
];

async function searchForFolders() {
  try {
    console.log("Searching for folder information in Granola API...");
    
    // Initialize client
    const client = new PanelClient();
    
    // First, check if there's a folders endpoint
    console.log("\n1. Testing potential folder endpoints:");
    const folderEndpoints = [
      '/v1/get-folders',
      '/v2/get-folders',
      '/v1/folders',
      '/v1/workspaces',
      '/v1/get-workspaces',
      '/v1/get-document-folders'
    ];
    
    for (const endpoint of folderEndpoints) {
      try {
        console.log(`Trying ${endpoint}...`);
        // @ts-ignore - Accessing private http property
        const result = await client.http.post(endpoint, {});
        console.log(`Success! Response:`, JSON.stringify(result).substring(0, 500));
      } catch (error) {
        console.log(`Failed: ${(error as Error).message}`);
      }
    }
    
    // Try to get detailed document information for each meeting
    console.log("\n2. Examining full document objects for folder references:");
    
    for (const meeting of MEETINGS) {
      console.log(`\nChecking meeting ${meeting.id} (expected folder: ${meeting.expectedFolder}):`);
      
      // Get documents that match this ID
      const documents = await client.getDocuments({ limit: 50 });
      const document = documents.docs?.find(doc => doc.id === meeting.id);
      
      if (!document) {
        console.log(`Meeting not found in recent documents`);
        continue;
      }
      
      // Examine all fields for potential folder references
      console.log("Document fields:");
      const docKeys = Object.keys(document).sort();
      
      // Look for any fields that might contain folder info
      const folderRelatedKeys = docKeys.filter(key => 
        key.toLowerCase().includes('folder') ||
        key.toLowerCase().includes('workspace') ||
        key.toLowerCase().includes('category') ||
        key.toLowerCase().includes('collection') ||
        key.toLowerCase().includes('group') ||
        key.toLowerCase().includes('parent') ||
        key.toLowerCase().includes('path') ||
        key.toLowerCase().includes('location')
      );
      
      if (folderRelatedKeys.length > 0) {
        console.log("Potential folder-related fields:");
        folderRelatedKeys.forEach(key => {
          console.log(`${key}: ${JSON.stringify(document[key as keyof typeof document])}`);
        });
      } else {
        console.log("No obvious folder-related fields found");
      }
      
      // Check all document fields for values matching the expected folder names
      const folderMatches = docKeys.filter(key => {
        const value = document[key as keyof typeof document];
        if (typeof value === 'string') {
          return value.includes(meeting.expectedFolder);
        } else if (typeof value === 'object' && value !== null) {
          return JSON.stringify(value).includes(meeting.expectedFolder);
        }
        return false;
      });
      
      if (folderMatches.length > 0) {
        console.log(`\nFields with values containing "${meeting.expectedFolder}":`);
        folderMatches.forEach(key => {
          console.log(`${key}: ${JSON.stringify(document[key as keyof typeof document])}`);
        });
      } else {
        console.log(`\nNo fields found containing "${meeting.expectedFolder}"`);
      }
    }
    
    // 3. Try calling the direct get-document endpoint
    console.log("\n3. Trying direct get-document endpoint for each meeting:");
    
    for (const meeting of MEETINGS) {
      console.log(`\nFetching direct document data for ${meeting.id}:`);
      try {
        // @ts-ignore - Accessing private http property
        const docData = await client.http.post('/v1/get-document', { document_id: meeting.id });
        
        // Look for folder information
        console.log("Document data keys:", Object.keys(docData).sort());
        
        // Check for folder or workspace fields
        const folderRelatedKeys = Object.keys(docData).filter(key => 
          key.toLowerCase().includes('folder') ||
          key.toLowerCase().includes('workspace')
        );
        
        if (folderRelatedKeys.length > 0) {
          console.log("Folder-related fields in document data:");
          folderRelatedKeys.forEach(key => {
            console.log(`${key}: ${JSON.stringify(docData[key])}`);
          });
        } else {
          console.log("No folder-related fields found in document data");
        }
        
        // Search for the expected folder name in all fields
        const allKeys = Object.keys(docData);
        for (const key of allKeys) {
          const value = docData[key];
          if (typeof value === 'string' && value.includes(meeting.expectedFolder)) {
            console.log(`Found "${meeting.expectedFolder}" in field ${key}: ${value}`);
          } else if (typeof value === 'object' && value !== null) {
            const valueStr = JSON.stringify(value);
            if (valueStr.includes(meeting.expectedFolder)) {
              console.log(`Found "${meeting.expectedFolder}" in object field ${key}:`);
              console.log(valueStr.substring(0, 200) + "...");
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching document data:`, error);
      }
    }
    
    // 4. Try the workspaces endpoint with more parameters
    console.log("\n4. Trying workspaces endpoint with additional parameters:");
    try {
      // @ts-ignore - Accessing private http property
      const workspaceData = await client.http.post('/v1/get-workspaces', { 
        include_folders: true,
        include_details: true
      });
      
      console.log("Workspace data:", JSON.stringify(workspaceData).substring(0, 500));
    } catch (error) {
      console.error("Error fetching workspace data:", error);
    }
    
  } catch (error) {
    console.error("Error searching for folders:", error);
  }
}

// Run the script
searchForFolders();