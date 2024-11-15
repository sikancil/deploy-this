#!/bin/bash

# Log file
ISO_DATE=$(date -u +"%Y-%m-%d")
LOG_PATH="/opt/codedeploy-logs/${ISO_DATE}/"
mkdir -p $LOG_PATH
LOG_FILE="${LOG_PATH}deployments.log"

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

log "Starting before_block_traffic script"

# Verify AWS CLI is available
if ! command -v aws &> /dev/null; then
    log "ERROR: AWS CLI not found"
    exit 1
fi

# Get instance ID from metadata service
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
if [ -z "$INSTANCE_ID" ]; then
    log "ERROR: Could not determine instance ID"
    exit 1
fi

log "Instance ID: ${INSTANCE_ID}"
log "Before_block_traffic completed successfully\n\n"
