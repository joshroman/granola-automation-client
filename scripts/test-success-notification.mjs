#!/usr/bin/env node
/**
 * Test Success Notification to Slack
 * 
 * This script tests sending a success notification to Slack using the webhook URL
 * 
 * Usage:
 *   node test-success-notification.mjs
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as url from 'url';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
function loadEnvFile() {
  const envPath = path.join(path.dirname(__dirname), '.env');
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment variables from ${envPath}`);
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Parse each line in the .env file
    envContent.split('\n').forEach(line => {
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
    });
  }
}

// Load environment variables
loadEnvFile();

// Get webhook URL from environment
const webhookUrl = process.env.SLACK_WEBHOOK_URL;

if (!webhookUrl) {
  console.error('Error: SLACK_WEBHOOK_URL not found in environment variables');
  console.error('Please set SLACK_WEBHOOK_URL in your .env file');
  process.exit(1);
}

// Parse the webhook URL
const parsedUrl = url.parse(webhookUrl);

// Create a test meeting title
const meetingTitle = "Weekly Strategy Meeting";
const meetingId = "12345678-abcd-1234-efgh-123456789012";

// Create the message payload
const message = {
  text: `✅ Success: processed "${meetingTitle}"\n\nSuccessfully processed meeting:\n- Title: ${meetingTitle}\n- ID: ${meetingId}\n- Time: ${new Date().toLocaleString()}\n- Environment: production`
};

// Convert the message to JSON
const data = JSON.stringify(message);

// Configure the request options
const options = {
  hostname: parsedUrl.hostname,
  port: 443,
  path: parsedUrl.path,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
};

// Send the request
const req = https.request(options, (res) => {
  console.log(`Status code: ${res.statusCode}`);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('Success notification sent successfully!');
    } else {
      console.error(`Error: ${responseData}`);
    }
  });
});

req.on('error', (error) => {
  console.error(`Request error: ${error.message}`);
});

// Write the data and end the request
req.write(data);
req.end();

console.log('Sending success notification to Slack webhook...');