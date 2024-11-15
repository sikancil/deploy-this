#!/bin/bash

# Log file
# Log file
ISO_DATE=$(date -u +"%Y-%m-%d")
LOG_PATH="/opt/codedeploy-logs/${ISO_DATE}/"
mkdir -p $LOG_PATH
LOG_FILE="${LOG_PATH}deployments.log"

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

# Check AWS CLI installation and configure
if ! command -v aws &> /dev/null; then
    log "ERROR: AWS CLI is not installed"
    exit 1
fi

# Create application directories
log "Creating application directories"
mkdir -p /home/ubuntu/app/scripts
chown -R ubuntu:ubuntu /home/ubuntu/app
chmod 755 /home/ubuntu/app/scripts

# Configure AWS CLI and login to ECR
log "Configuring AWS CLI and logging into ECR"
aws configure set default.region ${AWS_REGION}
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}

if [ $? -ne 0 ]; then
    log "ERROR: Failed to login to ECR"
    exit 1
fi

# Verify ECR access
if ! aws ecr describe-repositories --repository-names ${ECR_REPOSITORY_NAME} &>/dev/null; then
    log "ERROR: Cannot access ECR repository ${ECR_REPOSITORY_NAME}"
    exit 1
fi

# Cleanup unused containers and images
log "Cleaning up unused Docker resources"
docker container prune -f
docker image prune -f

# Keep only the 3 most recent images
log "Removing old images, keeping 3 most recent"
docker images "${ECR_REGISTRY}/${ECR_REPOSITORY_NAME}" --format "{{.ID}}" | tail -n +4 | xargs -r docker rmi -f || true

# Download latest docker-compose.yml from S3
log "Downloading latest docker-compose.yml from S3"
if ! aws s3 cp s3://${project_name}-artifacts/config/docker-compose.yml /home/ubuntu/app/docker-compose.yml; then
    log "ERROR: Failed to download docker-compose.yml from S3"
    exit 1
fi

chown ubuntu:ubuntu /home/ubuntu/app/docker-compose.yml
chmod 644 /home/ubuntu/app/docker-compose.yml

log "Before_install script completed successfully"
