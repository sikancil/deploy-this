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

# Clean up old images (keep last 5)
log "Cleaning up old images"
docker images "${ECR_REGISTRY}/${ECR_REPOSITORY_NAME}" --format "{{.ID}}" | tail -n +6 | xargs -r docker rmi || true

log "Stop application script completed"
