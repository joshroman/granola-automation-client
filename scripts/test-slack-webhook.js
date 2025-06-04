#!/usr/bin/env node
/**
 * Test Slack Webhook Directly
 * 
 * This script tests sending a message to Slack using a webhook URL
 * instead of relying on email delivery.
 * 
 * Usage:
 *   node test-slack-webhook.js <webhook-url>
 */

const https = require('https');
const url = require('url');

// Get webhook URL from command line argument
const webhookUrl = process.argv[2];

if (!webhookUrl) {
  console.error('Error: No webhook URL provided');
  console.error('Usage: node test-slack-webhook.js <webhook-url>');
  process.exit(1);
}

// Parse the webhook URL
const parsedUrl = url.parse(webhookUrl);

// Create the message payload
const message = {
  text: `✅ *Granola Webhook Monitor Test*\n\nThis is a test message from the Granola webhook monitor.\n\nTimestamp: ${new Date().toISOString()}\nHostname: ${require('os').hostname()}`,
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
      console.log('Test message sent successfully!');
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

console.log('Sending test message to Slack webhook...');