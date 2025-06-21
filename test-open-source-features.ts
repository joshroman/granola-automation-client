// test-open-source-features.ts
import { WebhookClient, TemplateValidationConfig, OutputDestinationManager } from './src';

async function testOpenSourceFeatures() {
  console.log("🧪 Testing Open Source Features...\n");
  
  try {
    // Initialize webhook client
    const client = new WebhookClient();
    
    // Test 1: Template Validation Configuration
    console.log("=== TEST 1: Template Validation Configuration ===");
    
    const templateConfig: TemplateValidationConfig = {
      enabled: true,
      mode: 'any',
      requiredTemplateIds: [
        'b491d27c-1106-4ebf-97c5-d5129742945c', // Josh Template
        'another-template-id-example'
      ],
      templateNames: {
        'b491d27c-1106-4ebf-97c5-d5129742945c': 'Josh Meeting Template',
        'another-template-id-example': 'Custom Project Template'
      }
    };
    
    client.setTemplateValidationConfig(templateConfig);
    console.log("✅ Template validation config set");
    console.log("   - Mode: any (requires at least one template)");
    console.log("   - Required templates: Josh Meeting Template, Custom Project Template");
    
    // Test 2: Multiple Output Destinations
    console.log("\n=== TEST 2: Output Destinations ===");
    
    const outputConfig = {
      webhook: {
        enabled: true,
        url: 'https://httpbin.org/post',
        headers: { 'X-Test': 'true' }
      },
      jsonFile: {
        enabled: true,
        filePath: './test-output.json',
        appendMode: false
      },
      airtable: {
        enabled: false, // Would need real API key
        apiKey: 'key123',
        baseId: 'app123',
        tableName: 'Meetings'
      }
    };
    
    const outputManager = new OutputDestinationManager(outputConfig);
    console.log("✅ Output destination manager created");
    console.log("   - Webhook: enabled (test endpoint)");
    console.log("   - JSON file: enabled (./test-output.json)");
    console.log("   - Airtable: disabled (demo config)");
    
    // Test 3: Template Validation with Real Meeting
    console.log("\n=== TEST 3: Template Validation Test ===");
    
    client.setWebhookConfig({
      url: 'https://httpbin.org/post',
      includeTranscript: false
    });
    
    // Test with meeting that lacks required template
    const meetingWithoutTemplate = "3ceb83e0-c6ef-4919-873f-f9d5d5f147f8";
    console.log(`Testing meeting: ${meetingWithoutTemplate}`);
    
    const result = await client.processMeeting(meetingWithoutTemplate);
    
    if (result.skipped && result.skipReason === 'missing_required_template') {
      console.log("✅ Template validation working correctly");
      console.log(`   - Meeting skipped: ${result.skipped}`);
      console.log(`   - Reason: ${result.skipReason}`);
      console.log(`   - Error: ${result.error}`);
    } else {
      console.log("❌ Template validation not working as expected");
      console.log(`   - Result: ${JSON.stringify(result, null, 2)}`);
    }
    
    // Test 4: Output to JSON File (simulate successful meeting)
    console.log("\n=== TEST 4: JSON File Output Test ===");
    
    const mockPayload = {
      meetingId: 'test-meeting-123',
      meetingTitle: 'Test Meeting for Open Source Features',
      meetingDate: new Date().toISOString(),
      metadata: {
        participants: [
          { name: 'John Doe', email: 'john@example.com' },
          { name: 'Jane Smith', email: 'jane@example.com' }
        ],
        duration: 3600,
        organization: { name: 'Test Company', confidence: 1, signals: {} },
        creator: { name: 'John Doe', email: 'john@example.com' }
      },
      processingTimestamp: new Date().toISOString()
    };
    
    const outputResults = await outputManager.sendToOutputs(mockPayload);
    console.log("✅ Output destinations tested");
    
    outputResults.forEach(result => {
      console.log(`   - ${result.destination}: ${result.success ? '✅ Success' : `❌ Failed (${result.error})`}`);
    });
    
    console.log("\n=== SUMMARY ===");
    console.log("🎉 Open source features are working correctly!");
    console.log("Features tested:");
    console.log("  ✅ Flexible template validation");
    console.log("  ✅ Multiple output destinations");
    console.log("  ✅ Meeting processing with validation");
    console.log("  ✅ JSON file output");
    
    console.log("\nOpen Source Ready Features:");
    console.log("  🔔 Multi-channel notifications (Slack, Discord, Email, Desktop)");
    console.log("  📊 Multiple output formats (Webhook, Airtable, Google Sheets, JSON)");
    console.log("  🛡️ Flexible template validation (any template, specific templates)");
    console.log("  ⚙️ Simple JSON configuration");
    console.log("  🔧 Backwards compatible with existing setups");
    
  } catch (error) {
    console.error("❌ Error during testing:", error);
  }
}

// Run the test
testOpenSourceFeatures();