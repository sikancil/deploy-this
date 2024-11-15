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

log "Starting stop_application script"

# Load environment variables
if [ -f /home/ubuntu/.env.vm ]; then
    source /home/ubuntu/.env.vm
fi

# Stop lighttpd if running
if systemctl is-active --quiet lighttpd; then
    log "Stopping lighttpd service..."
    systemctl stop lighttpd
    systemctl disable lighttpd
fi

# Find and stop any current container
CURRENT_CONTAINER=$(docker ps -q --filter "name=app-")

if [ -n "$CURRENT_CONTAINER" ]; then
    log "Current container found: $CURRENT_CONTAINER"
    
    # Check if container is healthy before stopping
    HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' $CURRENT_CONTAINER 2>/dev/null)
    log "Current container health status: ${HEALTH_STATUS:-unknown}"
    
    # Graceful shutdown with timeout
    log "Initiating graceful shutdown..."
    if ! timeout 60 docker stop $CURRENT_CONTAINER; then
        log "WARNING: Container did not stop gracefully, forcing shutdown..."
        docker kill $CURRENT_CONTAINER
    fi
    
    # Remove container
    log "Removing stopped container..."
    docker rm $CURRENT_CONTAINER || true
else
    log "No running container found"
fi

# Verify port availability
PORT_CHECK=$(netstat -ln | grep ':3000 ')
if [ ! -z "$PORT_CHECK" ]; then
    log "WARNING: Port 3000 is still in use:"
    log "$PORT_CHECK"
    # Additional cleanup if needed
    fuser -k 3000/tcp || true
fi

# Cleanup
log "Running cleanup tasks..."

# Remove unused containers
log "Removing unused containers..."
docker container prune -f

# Remove unused images
log "Removing unused images..."
docker image prune -f

# Keep only recent images
log "Cleaning up old images..."
if [ ! -z "${ECR_REGISTRY}" ] && [ ! -z "${ECR_REPOSITORY_NAME}" ]; then
    IMAGES_TO_REMOVE=$(docker images "${ECR_REGISTRY}/${ECR_REPOSITORY_NAME}" --format "{{.ID}}" | tail -n +4)
    if [ ! -z "$IMAGES_TO_REMOVE" ]; then
        echo "$IMAGES_TO_REMOVE" | xargs -r docker rmi -f
    fi
fi

log "Stop application script completed successfully\n\n"
