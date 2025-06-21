import { GranolaClient } from '../src/client.js';

// Test API call to get documents and check for panels
async function checkDocuments() {
  try {
    console.log('Creating Granola client...');
    
    // Use automatic token retrieval
    const client = new GranolaClient();
    console.log('Using automatic token retrieval from local Granola app');
    
    // Fetch documents
    console.log('Fetching documents from Granola API...');
    const docsResponse = await client.getDocuments({ limit: 10 });
    
    // Log the results
    console.log('\nSuccess! Received documents:');
    const docs = docsResponse.docs || [];
    console.log(`Found ${docs.length} document(s)`);
    
    if (docs.length === 0) {
      console.log('No documents found to examine');
      return true;
    }
    
    // Display document summaries
    console.log('\nDocument summary:');
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      console.log(`${i + 1}. ${doc.title || 'Untitled'} (ID: ${doc.document_id || doc.id || 'Unknown'})`);
      console.log(`   Created: ${doc.created_at || 'Unknown'}`);
      
      // If the document has panels, list them
      if (doc.panels && doc.panels.length > 0) {
        console.log(`   Panels (${doc.panels.length}):`);
        doc.panels.forEach((panel, index) => {
          console.log(`     ${index + 1}. ${panel.title || 'Untitled'} (Type: ${panel.type || 'Unknown'})`);
        });
      } else {
        console.log('   No panels found in document summary');
      }
      
      // For the first document, try to get detailed metadata
      if (i === 0) {
        try {
          console.log(`\nFetching detailed metadata for document: ${doc.title}`);
          const metadata = await client.getDocumentMetadata(doc.document_id || doc.id);
          console.log('Metadata received:');
          console.log(JSON.stringify(metadata, null, 2));
          
          // Check if metadata contains panel information
          if (metadata.panels && metadata.panels.length > 0) {
            console.log(`\nFound ${metadata.panels.length} panel(s) in metadata:`);
            metadata.panels.forEach((panel, index) => {
              console.log(`  ${index + 1}. ${panel.title || 'Untitled'} (Type: ${panel.type || 'Unknown'})`);
              if (panel.ai_generated) console.log('     ** AI Generated **');
            });
          } else {
            console.log('\nNo panels found in metadata');
          }
        } catch (error) {
          console.error(`Error fetching metadata: ${error.message}`);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('\nError checking documents:');
    console.error(error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
    return false;
  }
}

// Run the check
console.log('=== Granola Documents Check ===\n');
checkDocuments().then(success => {
  console.log(`\n=== Check ${success ? 'COMPLETED' : 'FAILED'} ===`);
  process.exit(success ? 0 : 1);
});