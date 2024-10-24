#!/bin/bash

# Log file
LOG_FILE="/opt/codedeploy-agent/deployment-root/deployment-logs/codedeploy-agent-deployments.log"

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

log "Starting stop_application script"

# Check if the application is running
if pm2 list | grep -q "myapp"; then
    log "Stopping the application"
    pm2 stop myapp
    pm2 delete myapp
else
    log "Application is not running"
fi

log "Application stopped"
