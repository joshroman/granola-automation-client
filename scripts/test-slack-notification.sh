#!/bin/bash
#
# Test script to verify Slack notifications are working correctly
# 
# This script sends a test email to the Slack channel to verify that
# the notification system is configured correctly.
#
# Usage:
#   ./test-slack-notification.sh [--email your-slack-channel@slack.com]
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
SLACK_EMAIL_ARG=""

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --email)
            SLACK_EMAIL_ARG="$2"
            shift
            ;;
        *)
            echo "Unknown parameter: $1"
            exit 1
            ;;
    esac
    shift
done

# Use argument email if provided, otherwise use environment variable
if [ -n "$SLACK_EMAIL_ARG" ]; then
    SLACK_EMAIL="$SLACK_EMAIL_ARG"
fi

# Check if Slack email is configured
if [ -z "$SLACK_EMAIL" ]; then
    echo "Error: No Slack email configured."
    echo "Either:"
    echo "  1. Set SLACK_EMAIL in .env file"
    echo "  2. Set SLACK_EMAIL environment variable"
    echo "  3. Use --email parameter"
    exit 1
fi

echo "Sending test notification to: $SLACK_EMAIL"

# Create timestamp
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

# Prepare email content
SUBJECT="✅ GRANOLA PROCESSING TEST NOTIFICATION"
BODY="
*GRANOLA PROCESSING TEST NOTIFICATION*

This is a test notification from the Granola Webhook Monitor.

Timestamp: $TIMESTAMP
Host: $(hostname)
Working directory: $PROJECT_DIR

If you're receiving this message, your Slack notification system is working correctly.
"

# Send the email
echo "$BODY" | mail -s "$SUBJECT" "$SLACK_EMAIL"

# Check if the mail command was successful
if [ $? -eq 0 ]; then
    echo "Test notification sent successfully!"
    echo "Please check your Slack channel for the message."
else
    echo "Error: Failed to send test notification."
    echo "Please ensure your system's mail command is properly configured."
fi