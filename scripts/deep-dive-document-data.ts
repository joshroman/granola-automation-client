import { PanelClient } from "../src/panel-client";
import GranolaClient from "../src/client";

// Meeting IDs to check
const MEETING_IDS = [
  "20fde695-1fc7-473f-b9e7-a9e60ff641eb", // Meet This Moment - Mindshift
  "fc21681f-acc9-4d00-a5e9-15d81ad8a0a9"  // OMAI Team Talk
];

async function deepDiveDocumentData() {
  try {
    console.log("Deep diving into document data to find folder information...");
    
    // Initialize client
    const client = new PanelClient();
    
    // Check for organization hints in people/company info
    console.log("\nExamining document people/company information:");
    
    for (const meetingId of MEETING_IDS) {
      console.log(`\n=== Meeting ${meetingId} ===`);
      
      // Get document with full metadata
      const documents = await client.getDocuments({ limit: 50 });
      const document = documents.docs?.find(doc => doc.id === meetingId);
      
      if (!document) {
        console.log(`Meeting not found in recent documents`);
        continue;
      }
      
      console.log(`Title: ${document.title}`);
      
      // Check people object for company info
      if (document.people) {
        console.log("\nPeople information:");
        
        // Check creator's company
        if (document.people.creator?.details?.company?.name) {
          console.log(`Creator's company: ${document.people.creator.details.company.name}`);
        }
        
        // Check all attendees
        if (Array.isArray(document.people.attendees)) {
          console.log(`\nAttendee companies:`);
          for (const attendee of document.people.attendees) {
            if (attendee.details?.company?.name) {
              console.log(`- ${attendee.name || attendee.email}: ${attendee.details.company.name}`);
            } else if (attendee.email) {
              // Check email domain
              const domain = attendee.email.split('@')[1];
              console.log(`- ${attendee.name || attendee.email}: Email domain ${domain}`);
            }
          }
        }
      }
      
      // Check for category-related fields
      console.log("\nSearching for categorization fields:");
      const fields = Object.keys(document);
      for (const field of fields) {
        const value = document[field as keyof typeof document];
        if (field.includes('category') || 
            field.includes('type') || 
            field.includes('tag') || 
            field.includes('label') ||
            field.includes('class')) {
          console.log(`${field}: ${JSON.stringify(value)}`);
        }
      }
      
      // Check if emails provide clues
      console.log("\nAnalyzing email domains for organizational hints:");
      if (document.people?.creator?.email) {
        const creatorDomain = document.people.creator.email.split('@')[1];
        console.log(`Creator email domain: ${creatorDomain}`);
      }
      
      // Count email domains to determine likely organization
      if (Array.isArray(document.people?.attendees)) {
        const domainCounts: {[key: string]: number} = {};
        for (const attendee of document.people.attendees) {
          if (attendee.email) {
            const domain = attendee.email.split('@')[1];
            domainCounts[domain] = (domainCounts[domain] || 0) + 1;
          }
        }
        
        console.log("Email domain counts:");
        Object.entries(domainCounts).forEach(([domain, count]) => {
          console.log(`- ${domain}: ${count} attendee(s)`);
        });
        
        // Determine primary organization
        if (Object.keys(domainCounts).length > 0) {
          const primaryDomain = Object.entries(domainCounts)
            .sort((a, b) => b[1] - a[1])[0][0];
          console.log(`\nPrimary organization domain appears to be: ${primaryDomain}`);
        }
      }
      
      // Try to get full document data with an internal API call
      try {
        console.log("\nAttempting to fetch extended document data:");
        // @ts-ignore - Accessing private http property
        const fullData = await client.http.post('/v1/document', { document_id: meetingId });
        
        console.log(`Full data keys: ${Object.keys(fullData).join(', ')}`);
        
        // Check for any folder/org related fields
        for (const key of Object.keys(fullData)) {
          if (key.includes('folder') || 
              key.includes('workspace') || 
              key.includes('organization') || 
              key.includes('group')) {
            console.log(`${key}: ${JSON.stringify(fullData[key])}`);
          }
        }
      } catch (error) {
        console.log(`Error fetching extended data: ${(error as Error).message}`);
      }
    }
    
    // Try v2 endpoints
    console.log("\nTrying v2 endpoints to find folder data:");
    try {
      // @ts-ignore - Accessing private http property
      const v2Data = await client.http.post('/v2/get-documents', { 
        limit: 50,
        include_folders: true
      });
      
      console.log(`V2 response keys: ${Object.keys(v2Data).join(', ')}`);
      
      if (v2Data.docs) {
        // Check the first few docs for folder info
        console.log("\nExamining v2 document structure:");
        const sampleDoc = v2Data.docs[0];
        console.log(`Sample doc keys: ${Object.keys(sampleDoc).join(', ')}`);
        
        // Check for any folder fields in the first doc
        for (const key of Object.keys(sampleDoc)) {
          if (key.includes('folder') || 
              key.includes('workspace') || 
              key.includes('organization') || 
              key.includes('group')) {
            console.log(`${key}: ${JSON.stringify(sampleDoc[key])}`);
          }
        }
        
        // Check all documents for our specific meeting IDs
        for (const meetingId of MEETING_IDS) {
          const doc = v2Data.docs.find((d: any) => d.id === meetingId);
          if (doc) {
            console.log(`\nFound meeting ${meetingId} in v2 response`);
            
            // Check all fields for folder data
            for (const key of Object.keys(doc)) {
              if (key.includes('folder') || 
                  key.includes('workspace') || 
                  key.includes('organization') || 
                  key.includes('group')) {
                console.log(`${key}: ${JSON.stringify(doc[key])}`);
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(`Error with v2 endpoint: ${(error as Error).message}`);
    }
    
    // Try a specific search for folders
    console.log("\nAttempting to search for folders directly:");
    
    const searchEndpoints = [
      { endpoint: '/v1/search', payload: { query: "folder:Mindshift" } },
      { endpoint: '/v1/search', payload: { query: "folder:OMAI" } },
      { endpoint: '/v2/search', payload: { query: "folder:Mindshift" } },
      { endpoint: '/v2/search', payload: { query: "folder:OMAI" } }
    ];
    
    for (const { endpoint, payload } of searchEndpoints) {
      try {
        console.log(`Trying ${endpoint} with payload ${JSON.stringify(payload)}...`);
        // @ts-ignore - Accessing private http property
        const result = await client.http.post(endpoint, payload);
        console.log(`Success! Results:`, result);
      } catch (error) {
        console.log(`Failed: ${(error as Error).message}`);
      }
    }
    
  } catch (error) {
    console.error("Error in deep dive:", error);
  }
}

// Run the script
deepDiveDocumentData();