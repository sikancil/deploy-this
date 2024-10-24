#!/bin/bash

# Log file
LOG_FILE="/opt/codedeploy-agent/deployment-root/deployment-logs/codedeploy-agent-deployments.log"

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

log "Starting start_application script"

# Navigate to the application directory
cd /home/ubuntu/app

# Start the application using PM2
log "Starting the application with PM2"
pm2 start npm --name "myapp" -- start

log "Application started"
