import { GranolaClient } from '../src/client.js';

// Test API call to get panel templates
async function checkPanelTemplates() {
  try {
    console.log('Creating Granola client...');
    
    // Use automatic token retrieval
    const client = new GranolaClient();
    console.log('Using automatic token retrieval from local Granola app');
    
    // Fetch panel templates
    console.log('Fetching panel templates from Granola API...');
    const templates = await client.getPanelTemplates();
    
    // Log the results
    console.log('\nSuccess! Received panel templates:');
    console.log(JSON.stringify(templates, null, 2));
    
    // Print a summary of the templates
    const templatesArray = Array.isArray(templates) ? templates : [];
    const count = templatesArray.length;
    console.log(`\nFound ${count} panel template(s)`);
    
    // Check for specific templates
    const searchTerms = ['Josh Template', 'Pipeline Review', 'Pipeline'];
    console.log('\nSearching for specific templates:');
    
    if (count === 0) {
      console.log('  No templates found to search through');
      return true;
    }
    
    searchTerms.forEach(term => {
      const matchingTemplates = templatesArray.filter(template => 
        template.title?.toLowerCase().includes(term.toLowerCase())
      );
      
      console.log(`\n"${term}" matches (${matchingTemplates.length}):`);
      if (matchingTemplates.length > 0) {
        matchingTemplates.forEach((template, index) => {
          console.log(`  ${index + 1}. ${template.title || 'Untitled'} (ID: ${template.id || 'Unknown'})`);
          console.log(`     Type: ${template.type || 'Unknown'}`);
          if (template.description) console.log(`     Description: ${template.description}`);
        });
      } else {
        console.log('  No matches found');
      }
    });
    
    return true;
  } catch (error) {
    console.error('\nError fetching panel templates:');
    console.error(error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
    return false;
  }
}

// Run the check
console.log('=== Granola Panel Templates Check ===\n');
checkPanelTemplates().then(success => {
  console.log(`\n=== Check ${success ? 'COMPLETED' : 'FAILED'} ===`);
  process.exit(success ? 0 : 1);
});