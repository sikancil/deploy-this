#!/bin/bash

# Log file
LOG_FILE="/opt/codedeploy-agent/deployment-root/deployment-logs/codedeploy-agent-deployments.log"

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

log "Starting validate_service script"

# Check if the application is running
if pm2 list | grep -q "myapp"; then
    log "Application is running"
    
    # You can add more specific checks here, such as:
    # - Checking if the application responds to HTTP requests
    # - Verifying specific functionality
    # Example:
    # if curl -s http://localhost:3000/health | grep -q "OK"; then
    #     log "Application health check passed"
    # else
    #     log "Application health check failed"
    #     exit 1
    # fi
    
    exit 0
else
    log "Application is not running"
    exit 1
fi
