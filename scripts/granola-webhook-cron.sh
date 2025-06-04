#!/bin/bash
#
# Granola Webhook Monitor Cron Script
# 
# This script runs the Granola webhook monitor on a scheduled basis to
# process new meetings and send them to n8n.
#
# Usage:
#   ./granola-webhook-cron.sh [--config /path/to/config.json] [--env production|test] [--slack-email your-channel@slack.com]
#
# Options:
#   --config /path/to/config.json    Path to webhook configuration file (default: ./webhook-config.private.json)
#   --env production|test            Environment to use (default: production)
#   --slack-email email@example.com  Email address for Slack notifications (default: aaaalgmvjwhsfklmumu6j6wkc4@openmind-ai.slack.com)
#
# To set up as a cron job, add a line like this to your crontab (edit with 'crontab -e'):
#   */30 * * * * cd /path/to/granola-ts-client && ./scripts/granola-webhook-cron.sh >> ./logs/webhook-cron.log 2>&1
#
# The above example runs every 30 minutes.
#

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the project root directory (parent of scripts)
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Move to the project directory
cd "$PROJECT_DIR" || exit 1

# Load environment variables from .env file if it exists
ENV_FILE="$PROJECT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    echo "Loading environment variables from $ENV_FILE"
    # shellcheck disable=SC1090
    source "$ENV_FILE"
fi

# Parse arguments
CONFIG_PATH="./webhook-config.private.json"
ENVIRONMENT="production"  # Default to production

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --config) CONFIG_PATH="$2"; shift ;;
        --env) ENVIRONMENT="$2"; shift ;;
        --slack-email) SLACK_EMAIL="$2"; shift ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Export Slack email for webhook monitor
export SLACK_EMAIL="${SLACK_EMAIL}"

# Create logs directory if it doesn't exist
if [ ! -d "./logs" ]; then
    mkdir -p ./logs
fi

# Log start time
echo "===== Webhook Monitor Cron Job ====="
echo "Started at: $(date)"
echo "Environment: $ENVIRONMENT"
echo "Configuration: $CONFIG_PATH"

# Run the webhook monitor
echo "Running webhook monitor..."
bun examples/webhook-monitor.ts --config "$CONFIG_PATH" --env "$ENVIRONMENT"

# Log completion
echo "Finished at: $(date)"
echo "===============================\n"