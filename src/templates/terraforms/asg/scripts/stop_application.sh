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
    log "Gracefully stopping container: $CURRENT_CONTAINER"
    # Send SIGTERM and wait up to 30 seconds
    timeout 30 docker stop $CURRENT_CONTAINER || {
        log "Container did not stop gracefully, forcing..."
        docker kill $CURRENT_CONTAINER
    }
    docker rm $CURRENT_CONTAINER || true
else
    log "No running container found"
fi

# Verify no containers are running on port 3000
if netstat -ln | grep -q ':3000 '; then
    log "WARNING: Port 3000 is still in use"
    # Don't fail deployment, but log for investigation
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
