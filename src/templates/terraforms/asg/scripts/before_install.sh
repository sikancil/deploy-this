#!/bin/bash

# Log file
LOG_FILE="/opt/codedeploy-agent/deployment-root/deployment-logs/codedeploy-agent-deployments.log"

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

log "Starting before_install script"

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    log "ERROR: Docker is not installed"
    exit 1
fi

if ! systemctl is-active --quiet docker; then
    log "ERROR: Docker service is not running"
    exit 1
fi

# Check AWS CLI installation
if ! command -v aws &> /dev/null; then
    log "ERROR: AWS CLI is not installed"
    exit 1
fi

# Create application and scripts directories
log "Creating application directories"
mkdir -p /home/ubuntu/app/scripts
chown -R ubuntu:ubuntu /home/ubuntu/app
chmod 755 /home/ubuntu/app/scripts

# Login to ECR
log "Logging into ECR"
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}

if [ $? -ne 0 ]; then
    log "ERROR: Failed to login to ECR"
    exit 1
fi

log "Before_install script completed successfully"
