#!/bin/bash

# Log file
LOG_FILE="/opt/codedeploy-agent/deployment-root/deployment-logs/codedeploy-agent-deployments.log"

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

log "Starting stop_application script"

# Find and stop the current container
CURRENT_CONTAINER=$(docker ps -q --filter "name=app-")

if [ ! -z "$CURRENT_CONTAINER" ]; then
    log "Stopping current container: $CURRENT_CONTAINER"
    docker stop $CURRENT_CONTAINER || true
    docker rm $CURRENT_CONTAINER || true
else
    log "No running container found"
fi

# Clean up unused containers
log "Cleaning up unused containers"
docker container prune -f

# Clean up unused images
log "Cleaning up unused images"
docker image prune -f

# Keep only the 3 most recent images
log "Removing old images, keeping 3 most recent"
# docker images "${ECR_REGISTRY}/${ECR_REPOSITORY_NAME}" --format "{{.ID}}" | tail -n +6 | xargs -r docker rmi || true
docker images "${ECR_REGISTRY}/${ECR_REPOSITORY_NAME}" --format "{{.ID}}" | tail -n +4 | xargs -r docker rmi -f || true

log "Stop application script completed"
