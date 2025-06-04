#!/usr/bin/env node
/**
 * Scheduled Webhook Monitor
 * 
 * Node.js script to run the webhook monitor at regular intervals.
 * This can be used as an alternative to cron when running on systems
 * where cron isn't available or convenient.
 * 
 * Usage:
 *   node scheduled-webhook-monitor.js --interval 30 --config ./webhook-config.private.json --env production
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
let interval = 30; // Default interval in minutes
let configPath = './webhook-config.private.json';
let environment = 'production';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--interval' || args[i] === '-i') {
    interval = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--config' || args[i] === '-c') {
    configPath = args[i + 1];
    i++;
  } else if (args[i] === '--env' || args[i] === '-e') {
    environment = args[i + 1];
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Scheduled Webhook Monitor

Usage: node scheduled-webhook-monitor.js [options]

Options:
  --interval, -i <minutes>  Run interval in minutes (default: 30)
  --config, -c <path>       Path to webhook configuration file (default: ./webhook-config.private.json)
  --env, -e <env>           Environment to use (default: production)
  --help, -h                Show this help message
    `);
    process.exit(0);
  }
}

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file path
const logFile = path.join(logsDir, 'webhook-monitor.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Function to run the webhook monitor
function runWebhookMonitor() {
  const now = new Date().toISOString();
  
  logStream.write(`\n===== Running webhook monitor at ${now} =====\n`);
  
  const bunPath = process.platform === 'win32' ? 'bun.cmd' : 'bun';
  
  const monitor = spawn(bunPath, [
    'examples/webhook-monitor.ts',
    '--config', configPath,
    '--env', environment
  ]);
  
  monitor.stdout.on('data', (data) => {
    logStream.write(data.toString());
  });
  
  monitor.stderr.on('data', (data) => {
    logStream.write(`ERROR: ${data.toString()}`);
  });
  
  monitor.on('close', (code) => {
    logStream.write(`\nWebhook monitor exited with code ${code}\n`);
    logStream.write(`===== Completed at ${new Date().toISOString()} =====\n\n`);
  });
}

// Log startup information
console.log(`Scheduled Webhook Monitor`);
console.log(`Configuration: ${configPath}`);
console.log(`Environment: ${environment}`);
console.log(`Interval: ${interval} minutes`);
console.log(`Logging to: ${logFile}`);
console.log(`Press Ctrl+C to exit\n`);

// Run once immediately at startup
runWebhookMonitor();

// Schedule regular runs
console.log(`Next run scheduled in ${interval} minutes`);
const intervalMs = interval * 60 * 1000;

const timer = setInterval(() => {
  console.log(`Running webhook monitor (${new Date().toLocaleString()})`);
  runWebhookMonitor();
  console.log(`Next run scheduled in ${interval} minutes`);
}, intervalMs);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down scheduled webhook monitor');
  clearInterval(timer);
  logStream.end();
  process.exit(0);
});