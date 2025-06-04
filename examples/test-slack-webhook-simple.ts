// examples/test-slack-webhook-simple.ts
//
// Simple test script for Slack webhook notifications
//

// Get webhook URL from environment variable or .env file
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
function loadEnvVars() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment from ${envPath}`);
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        
        // Remove quotes if present
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          value = value.replace(/^"|"$/g, '');
        }
        
        process.env[key] = value;
      }
    }
  }
}

// Load environment variables
loadEnvVars();

// Get webhook URL
const webhookUrl = process.env.SLACK_WEBHOOK_URL;
if (!webhookUrl) {
  console.error('Error: No webhook URL found. Please set SLACK_WEBHOOK_URL in .env file');
  process.exit(1);
}

console.log(`Using webhook URL: ${webhookUrl.substring(0, 30)}...`);

// Create test data
const meetingTitle = "Weekly Strategy Meeting";
const meetingId = "12345678-abcd-1234-efgh-123456789012";

// Send success notification
async function sendSuccessNotification() {
  const payload = {
    text: `✅ Success: processed "${meetingTitle}"

Successfully processed meeting:
- Title: ${meetingTitle}
- ID: ${meetingId}
- Time: ${new Date().toLocaleString()}
- Environment: production`
  };
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      console.log('Success notification sent!');
    } else {
      console.error(`Error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(`Response: ${text}`);
    }
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}

// Send error notification
async function sendErrorNotification() {
  const payload = {
    text: `🔴 ERROR: Failed to process "${meetingTitle}"

*MEETING PROCESSING ERROR*

Failed to process meeting:
- Title: ${meetingTitle}
- ID: ${meetingId}
- Time: ${new Date().toLocaleString()}
- Environment: production

Please check the logs for detailed error information.`
  };
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      console.log('Error notification sent!');
    } else {
      console.error(`Error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(`Response: ${text}`);
    }
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}

// Run both tests
async function main() {
  console.log('Sending success notification...');
  await sendSuccessNotification();
  
  console.log('\nSending error notification...');
  await sendErrorNotification();
}

main().catch(console.error);