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

# Pull the new Docker image
IMAGE_TAG=${DEPLOYMENT_GROUP_ID:0:7}
FULL_IMAGE_NAME="${ECR_REGISTRY}/${ECR_REPOSITORY_NAME}:${IMAGE_TAG}"

log "Pulling Docker image: ${FULL_IMAGE_NAME}"
docker pull ${FULL_IMAGE_NAME}

if [ $? -ne 0 ]; then
    log "ERROR: Failed to pull Docker image"
    exit 1
fi

# Tag the image as 'latest' locally
docker tag ${FULL_IMAGE_NAME} ${ECR_REPOSITORY_NAME}:latest

# Cleanup unused containers and images
log "Cleaning up unused Docker resources"
docker container prune -f
docker image prune -f

# Keep only the 3 most recent images
log "Removing old images, keeping 3 most recent"
docker images "${ECR_REGISTRY}/${ECR_REPOSITORY_NAME}" --format "{{.ID}}" | tail -n +4 | xargs -r docker rmi -f || true

log "After_install script completed successfully"
