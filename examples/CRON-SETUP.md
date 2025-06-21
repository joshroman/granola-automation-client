# Cron Job Setup

Guide for setting up automated meeting processing using cron jobs.

## Basic Cron Setup

1. **Create a wrapper script** (`granola-monitor.sh`):
   ```bash
   #!/bin/bash
   cd /path/to/your/granola-ts-client
   bun run examples/webhook-monitor.ts --config webhook-config.private.json
   ```

2. **Make it executable:**
   ```bash
   chmod +x granola-monitor.sh
   ```

3. **Add to crontab:**
   ```bash
   crontab -e
   ```

   Add one of these lines:

   ```bash
   # Every 15 minutes
   */15 * * * * /path/to/granola-monitor.sh

   # Every hour
   0 * * * * /path/to/granola-monitor.sh

   # Every 30 minutes during business hours (9 AM - 6 PM, weekdays)
   */30 9-18 * * 1-5 /path/to/granola-monitor.sh
   ```

## Advanced Setup with Logging

Create a more robust script with logging:

```bash
#!/bin/bash
# granola-monitor-with-logs.sh

SCRIPT_DIR="/path/to/your/granola-ts-client"
LOG_DIR="/var/log/granola-monitor"
LOG_FILE="$LOG_DIR/monitor-$(date +%Y-%m-%d).log"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Change to script directory
cd "$SCRIPT_DIR" || exit 1

# Run with logging
echo "$(date): Starting Granola monitor" >> "$LOG_FILE"

if bun run examples/webhook-monitor.ts --config webhook-config.private.json >> "$LOG_FILE" 2>&1; then
    echo "$(date): Monitor completed successfully" >> "$LOG_FILE"
else
    echo "$(date): Monitor failed with exit code $?" >> "$LOG_FILE"
fi

# Rotate logs (keep last 30 days)
find "$LOG_DIR" -name "monitor-*.log" -mtime +30 -delete
```

## Using systemd (Linux)

For more robust service management on Linux:

1. **Create a service file** (`/etc/systemd/system/granola-monitor.service`):
   ```ini
   [Unit]
   Description=Granola Meeting Monitor
   After=network.target

   [Service]
   Type=oneshot
   ExecStart=/usr/local/bin/bun run examples/webhook-monitor.ts --config webhook-config.private.json
   WorkingDirectory=/path/to/your/granola-ts-client
   User=granola
   Group=granola

   [Install]
   WantedBy=multi-user.target
   ```

2. **Create a timer** (`/etc/systemd/system/granola-monitor.timer`):
   ```ini
   [Unit]
   Description=Run Granola Monitor every 15 minutes
   Requires=granola-monitor.service

   [Timer]
   OnCalendar=*:0/15
   Persistent=true

   [Install]
   WantedBy=timers.target
   ```

3. **Enable and start:**
   ```bash
   sudo systemctl enable granola-monitor.timer
   sudo systemctl start granola-monitor.timer
   ```

## Using launchd (macOS)

For macOS systems:

1. **Create a plist file** (`~/Library/LaunchAgents/com.granola.monitor.plist`):
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <key>Label</key>
       <string>com.granola.monitor</string>
       <key>ProgramArguments</key>
       <array>
           <string>/usr/local/bin/bun</string>
           <string>run</string>
           <string>examples/webhook-monitor.ts</string>
           <string>--config</string>
           <string>webhook-config.private.json</string>
       </array>
       <key>WorkingDirectory</key>
       <string>/path/to/your/granola-ts-client</string>
       <key>StartInterval</key>
       <integer>900</integer>
       <key>StandardOutPath</key>
       <string>/tmp/granola-monitor.out</string>
       <key>StandardErrorPath</key>
       <string>/tmp/granola-monitor.err</string>
   </dict>
   </plist>
   ```

2. **Load the service:**
   ```bash
   launchctl load ~/Library/LaunchAgents/com.granola.monitor.plist
   ```

## Environment Variables

Set required environment variables in your cron environment:

```bash
# In crontab, add before your job:
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
NODE_ENV=production
LOG_LEVEL=info

# Then your cron job:
*/15 * * * * /path/to/granola-monitor.sh
```

## Monitoring the Monitor

Add health checks to ensure the monitor is working:

```bash
#!/bin/bash
# health-check.sh

LAST_RUN_FILE="/tmp/granola-monitor-lastrun"
ALERT_THRESHOLD=3600  # 1 hour in seconds

if [ -f "$LAST_RUN_FILE" ]; then
    LAST_RUN=$(cat "$LAST_RUN_FILE")
    CURRENT_TIME=$(date +%s)
    TIME_DIFF=$((CURRENT_TIME - LAST_RUN))
    
    if [ $TIME_DIFF -gt $ALERT_THRESHOLD ]; then
        echo "ALERT: Granola monitor hasn't run in $TIME_DIFF seconds" | \
        mail -s "Granola Monitor Alert" admin@company.com
    fi
fi
```

## Troubleshooting

- **Permission errors**: Ensure the cron user has access to files and Granola app
- **Path issues**: Use absolute paths in cron scripts
- **Environment differences**: Cron runs with minimal environment; set all required variables
- **Authentication**: Ensure Granola authentication persists across cron runs