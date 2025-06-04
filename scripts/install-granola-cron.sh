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
# Usage:
#   ./install-granola-cron.sh [--slack-webhook webhook_url] [--slack-email email@example.com] [--config /path/to/config.json] [--env production|test]
#
# Options:
#   --slack-webhook webhook_url      Slack webhook URL for notifications (preferred over email)
#   --slack-email email@example.com  Email address for Slack notifications
#   --config /path/to/config.json    Path to webhook configuration file
#   --env production|test            Environment to use (default: production)
#

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the project root directory (parent of scripts)
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Parse arguments
CONFIG_PARAM=""
ENV_PARAM=""
SLACK_EMAIL_PARAM=""
SLACK_WEBHOOK_PARAM=""

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --config)
            CONFIG_PARAM="--config $2"
            shift
            ;;
        --env)
            ENV_PARAM="--env $2"
            shift
            ;;
        --slack-email)
            SLACK_EMAIL_PARAM="--slack-email $2"
            shift
            ;;
        --slack-webhook)
            SLACK_WEBHOOK_PARAM="--slack-webhook $2"
            shift
            ;;
        *)
            echo "Unknown parameter: $1"
            exit 1
            ;;
    esac
    shift
done

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

# Add our cron jobs for the specified times with optional parameters
CRON_COMMAND="cd $PROJECT_DIR && ./scripts/granola-webhook-cron.sh"

# Add parameters if provided
if [ -n "$CONFIG_PARAM" ]; then
    CRON_COMMAND="$CRON_COMMAND $CONFIG_PARAM"
fi

if [ -n "$ENV_PARAM" ]; then
    CRON_COMMAND="$CRON_COMMAND $ENV_PARAM"
fi

if [ -n "$SLACK_EMAIL_PARAM" ]; then
    CRON_COMMAND="$CRON_COMMAND $SLACK_EMAIL_PARAM"
fi

if [ -n "$SLACK_WEBHOOK_PARAM" ]; then
    CRON_COMMAND="$CRON_COMMAND $SLACK_WEBHOOK_PARAM"
fi

CRON_COMMAND="$CRON_COMMAND >> ./logs/webhook-cron.log 2>&1"

cat << EOF >> "$TEMP_CRONTAB"
# Granola Webhook Monitor - Runs at 9:45am, 12:45pm, 3:45pm, and 6:45pm
45 9,12,15,18 * * * $CRON_COMMAND
EOF

# Install the updated crontab
crontab "$TEMP_CRONTAB"
rm "$TEMP_CRONTAB"

# Verify the crontab was installed
echo "Cron job installed successfully. Current crontab:"
crontab -l | grep "granola-webhook-cron"

echo "Webhook monitor will run at 9:45 AM, 12:45 PM, 3:45 PM, and 6:45 PM daily."
echo "Logs will be written to: $PROJECT_DIR/logs/webhook-cron.log"