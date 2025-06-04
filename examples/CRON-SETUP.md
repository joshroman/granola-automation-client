# Setting Up Automated Webhook Monitoring

This guide explains how to set up automated monitoring of Granola meetings to send data to your n8n webhook.

## Cron Job Setup

The `scripts/granola-webhook-cron.sh` script is designed to be run regularly via cron to monitor for new meetings and send them to your n8n webhook.

### Prerequisites

1. Ensure your webhook configuration is set up properly in `webhook-config.private.json`
2. Make sure the script is executable:
   ```bash
   chmod +x scripts/granola-webhook-cron.sh
   ```

### Setting Up the Cron Job (macOS/Linux)

1. Open your crontab for editing:
   ```bash
   crontab -e
   ```

2. Add a line to run the script at your desired frequency. For example, to run every 30 minutes:
   ```bash
   */30 * * * * cd /path/to/granola-ts-client && ./scripts/granola-webhook-cron.sh >> ./logs/webhook-cron.log 2>&1
   ```

   Or to run once per day at 8am:
   ```bash
   0 8 * * * cd /path/to/granola-ts-client && ./scripts/granola-webhook-cron.sh >> ./logs/webhook-cron.log 2>&1
   ```

3. Save and exit the editor.

### Setting Up a Scheduled Task (Windows)

1. Create a batch file (e.g., `run-webhook-monitor.bat`) with the following content:
   ```batch
   @echo off
   cd C:\path\to\granola-ts-client
   bun examples/webhook-monitor.ts --env production >> logs\webhook-cron.log 2>&1
   ```

2. Open Task Scheduler
3. Create a new Basic Task
4. Set the trigger to Daily, Hourly, or at system startup as needed
5. Set the action to "Start a program" and point it to your batch file

## Log Rotation (Optional)

For long-running systems, you may want to set up log rotation to prevent the log file from growing too large:

1. Install logrotate (if not already present)
2. Create a configuration file `/etc/logrotate.d/granola-webhook`:
   ```
   /path/to/granola-ts-client/logs/webhook-cron.log {
     rotate 7
     daily
     compress
     missingok
     notifempty
   }
   ```

## Monitoring and Troubleshooting

- Check the `logs/webhook-cron.log` file to see the output from each run
- The script logs when it starts, what meetings it processed, and when it finishes
- For each meeting, it logs whether the webhook delivery was successful
- All processed meetings are tracked in `data/processed-meetings.json`

## Manual Run

To run the script manually:

```bash
./scripts/granola-webhook-cron.sh
```

Or with custom parameters:

```bash
./scripts/granola-webhook-cron.sh --config /path/to/custom-config.json --env test
```