#!/bin/bash

# Log file
LOG_FILE="/opt/codedeploy-agent/deployment-root/deployment-logs/codedeploy-agent-deployments.log"

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

log "Starting before_install script"

# Update package lists
log "Updating package lists"
sudo apt-get update

# Install Node.js and npm if not already installed
if ! command -v node &> /dev/null; then
    log "Installing Node.js and npm"
    curl -fsSL https://deb.nodesource.com/setup_14.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Create application directory if it doesn't exist
log "Creating application directory"
sudo mkdir -p /home/ubuntu/app
sudo chown ubuntu:ubuntu /home/ubuntu/app

log "Before_install script completed"
