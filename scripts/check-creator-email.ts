import { PanelClient } from "../src/panel-client";

// Meeting IDs to check
const MEETINGS = [
  { 
    id: "20fde695-1fc7-473f-b9e7-a9e60ff641eb", 
    name: "Meet This Moment Tuesday Talk",
    expectedOrg: "Mindshift" 
  },
  { 
    id: "fc21681f-acc9-4d00-a5e9-15d81ad8a0a9", 
    name: "OMAI Team Talk Tuesday",
    expectedOrg: "OMAI" 
  }
];

// Email mappings
const EMAIL_ORG_MAPPINGS = {
  "josh@mindshift.org": "Mindshift",
  "josh@omaihq.com": "OMAI"
};

async function checkCreatorEmail() {
  try {
    console.log("Checking creator email addresses for organization affiliation...");
    
    // Initialize client
    const client = new PanelClient();
    
    // Get all documents
    console.log("Fetching documents...");
    const documents = await client.getDocuments({ limit: 50 });
    
    console.log(`\nExamining creator emails for each meeting:`);
    
    for (const meeting of MEETINGS) {
      console.log(`\n=== ${meeting.name} (${meeting.id}) ===`);
      console.log(`Expected organization: ${meeting.expectedOrg}`);
      
      // Find the document
      const doc = documents.docs?.find(d => d.id === meeting.id);
      
      if (!doc) {
        console.log("Meeting not found in recent documents");
        continue;
      }
      
      // Check creator email
      if (doc.people?.creator?.email) {
        const creatorEmail = doc.people.creator.email;
        console.log(`Creator email: ${creatorEmail}`);
        
        // Determine organization from email
        const emailDomain = creatorEmail.split('@')[1];
        const mappedOrg = EMAIL_ORG_MAPPINGS[creatorEmail] || 
                         (emailDomain.includes('mindshift') ? 'Mindshift' : 
                          emailDomain.includes('omai') ? 'OMAI' : 'Unknown');
        
        console.log(`Organization based on email: ${mappedOrg}`);
        
        // Check if this matches expected org
        if (mappedOrg === meeting.expectedOrg) {
          console.log(`✅ Email correctly indicates ${meeting.expectedOrg} organization`);
        } else {
          console.log(`❌ Email indicates ${mappedOrg}, but expected ${meeting.expectedOrg}`);
        }
      } else {
        console.log("No creator email found");
      }
      
      // Check all attendee emails
      console.log("\nAll email addresses in meeting:");
      
      // Creator
      if (doc.people?.creator?.email) {
        console.log(`- Creator: ${doc.people.creator.name} <${doc.people.creator.email}>`);
      }
      
      // Attendees
      if (Array.isArray(doc.people?.attendees)) {
        doc.people.attendees.forEach(attendee => {
          if (attendee.email) {
            console.log(`- Attendee: ${attendee.name || 'Unnamed'} <${attendee.email}>`);
          }
        });
      }
      
      // Check Calendar event data if available
      if (doc.google_calendar_event) {
        console.log("\nCalendar event data:");
        
        if (doc.google_calendar_event.creator?.email) {
          console.log(`Calendar creator: ${doc.google_calendar_event.creator.email}`);
        }
        
        if (Array.isArray(doc.google_calendar_event.attendees)) {
          console.log("Calendar attendees:");
          doc.google_calendar_event.attendees.forEach((attendee: any) => {
            console.log(`- ${attendee.email} (${attendee.responseStatus || 'unknown status'})`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error("Error checking creator emails:", error);
  }
}

// Run the script
checkCreatorEmail();