#!/bin/bash
#
# Install Granola Webhook Monitor Cron Job
# 
# This script installs a cron job to run the webhook monitor at specified times:
# - 9:45 AM
# - 12:45 PM
# - 3:45 PM
# - 6:45 PM
#

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the project root directory (parent of scripts)
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Create logs directory if it doesn't exist
if [ ! -d "$PROJECT_DIR/logs" ]; then
    mkdir -p "$PROJECT_DIR/logs"
    echo "Created logs directory at $PROJECT_DIR/logs"
fi

# Make webhook cron script executable
chmod +x "$PROJECT_DIR/scripts/granola-webhook-cron.sh"
echo "Made webhook cron script executable"

# Create a temporary file to hold the current crontab
TEMP_CRONTAB=$(mktemp)
crontab -l > "$TEMP_CRONTAB" 2>/dev/null || echo "# Granola Webhook Monitor" > "$TEMP_CRONTAB"

# Check if our cron job is already installed
if grep -q "granola-webhook-cron.sh" "$TEMP_CRONTAB"; then
    echo "Granola webhook cron job is already installed. Updating it..."
    # Remove existing entries
    grep -v "granola-webhook-cron.sh" "$TEMP_CRONTAB" > "${TEMP_CRONTAB}.new"
    mv "${TEMP_CRONTAB}.new" "$TEMP_CRONTAB"
fi

# Add our cron jobs for the specified times
cat << EOF >> "$TEMP_CRONTAB"
# Granola Webhook Monitor - Runs at 9:45am, 12:45pm, 3:45pm, and 6:45pm
45 9,12,15,18 * * * cd $PROJECT_DIR && ./scripts/granola-webhook-cron.sh >> ./logs/webhook-cron.log 2>&1
EOF

# Install the updated crontab
crontab "$TEMP_CRONTAB"
rm "$TEMP_CRONTAB"

# Verify the crontab was installed
echo "Cron job installed successfully. Current crontab:"
crontab -l | grep "granola-webhook-cron"

echo "Webhook monitor will run at 9:45 AM, 12:45 PM, 3:45 PM, and 6:45 PM daily."
echo "Logs will be written to: $PROJECT_DIR/logs/webhook-cron.log"