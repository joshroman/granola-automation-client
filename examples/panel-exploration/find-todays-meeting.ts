import { PanelClient } from "../../src/panel-client";

async function findTodaysMeeting() {
  try {
    console.log("Searching for today's 'OMAI Team Talk Tuesday' meeting...");
    
    // Initialize client
    const client = new PanelClient();
    
    // Get today's date in format YYYY-MM-DD
    const today = new Date();
    const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    console.log(`Today's date: ${formattedDate}`);
    
    // Fetch recent documents
    console.log("Fetching recent documents...");
    const documents = await client.getDocuments({ limit: 50 });
    console.log(`Found ${documents.docs?.length || 0} documents`);
    
    // Filter for today's meetings with "OMAI Team Talk Tuesday" in the title
    const todaysMeetings = documents.docs?.filter(doc => {
      const isToday = doc.created_at && doc.created_at.startsWith(formattedDate);
      const hasTitle = doc.title && doc.title.includes("OMAI Team Talk Tuesday");
      return isToday && hasTitle;
    });
    
    console.log(`\nFound ${todaysMeetings?.length || 0} "OMAI Team Talk Tuesday" meetings from today:`);
    
    if (todaysMeetings && todaysMeetings.length > 0) {
      todaysMeetings.forEach((doc, i) => {
        console.log(`\n${i+1}. ${doc.title}`);
        console.log(`   ID: ${doc.id}`);
        console.log(`   Created: ${new Date(doc.created_at || "").toLocaleString()}`);
        
        // Check for additional metadata
        if (doc.overview) {
          console.log(`   Overview: ${doc.overview}`);
        }
        
        if (doc.notes_plain) {
          console.log(`   Notes Preview: ${doc.notes_plain.substring(0, 100)}...`);
        }
      });
      
      // Return the first matching meeting ID
      return todaysMeetings[0].id;
    } else {
      // If no exact match today, look for any recent "OMAI Team Talk Tuesday" meeting
      console.log("\nNo exact match found for today. Checking recent meetings with similar title...");
      
      const similarMeetings = documents.docs?.filter(doc => 
        doc.title && doc.title.includes("OMAI Team Talk Tuesday")
      );
      
      if (similarMeetings && similarMeetings.length > 0) {
        console.log(`\nFound ${similarMeetings.length} similar meetings:`);
        
        similarMeetings.forEach((doc, i) => {
          console.log(`\n${i+1}. ${doc.title}`);
          console.log(`   ID: ${doc.id}`);
          console.log(`   Created: ${new Date(doc.created_at || "").toLocaleString()}`);
        });
        
        // Return the first similar meeting ID
        return similarMeetings[0].id;
      } else {
        console.log("\nNo similar meetings found. Listing 5 most recent meetings:");
        
        // Sort documents by creation date, descending
        const sortedDocs = [...(documents.docs || [])].sort((a, b) => {
          const dateA = new Date(a.created_at || "").getTime();
          const dateB = new Date(b.created_at || "").getTime();
          return dateB - dateA;
        });
        
        sortedDocs.slice(0, 5).forEach((doc, i) => {
          console.log(`\n${i+1}. ${doc.title}`);
          console.log(`   ID: ${doc.id}`);
          console.log(`   Created: ${new Date(doc.created_at || "").toLocaleString()}`);
        });
        
        return null;
      }
    }
    
  } catch (error) {
    console.error("Error finding today's meeting:", error);
    return null;
  }
}

// Run the script
findTodaysMeeting().then(meetingId => {
  if (meetingId) {
    console.log(`\nTarget Meeting ID: ${meetingId}`);
    console.log("You can use this ID to work with the meeting's panels");
  }
});