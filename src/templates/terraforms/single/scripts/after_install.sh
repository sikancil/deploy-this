#!/bin/bash

# Log file
LOG_FILE="/opt/codedeploy-agent/deployment-root/deployment-logs/codedeploy-agent-deployments.log"

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

log "Starting after_install script"

# Navigate to the application directory
cd /home/ubuntu/app

# Install dependencies
log "Installing dependencies"
npm install

# Build the application (if necessary)
log "Building the application"
npm run build

# Set correct permissions
log "Setting correct permissions"
chown -R ubuntu:ubuntu /home/ubuntu/app

log "After_install script completed"
