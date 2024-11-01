#!/bin/bash

# Log file
LOG_FILE="/opt/codedeploy-agent/deployment-root/deployment-logs/codedeploy-agent-deployments.log"

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

log "Starting validate_service script"

# Get the container ID of the new deployment
NEW_CONTAINER_NAME="app-${DEPLOYMENT_GROUP_ID:0:7}"
NEW_CONTAINER_ID=$(docker ps -q --filter "name=${NEW_CONTAINER_NAME}")

if [ -z "$NEW_CONTAINER_ID" ]; then
    log "ERROR: New container ${NEW_CONTAINER_NAME} not found"
    exit 1
fi

# Check container health status
CONTAINER_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' $NEW_CONTAINER_ID)

if [ "$CONTAINER_HEALTH" != "healthy" ]; then
    log "ERROR: Container health check failed. Status: $CONTAINER_HEALTH"
    docker logs $NEW_CONTAINER_ID
    exit 1
fi

# Check if application responds to HTTP requests
RETRY_COUNT=3
RETRY_DELAY=5

for i in $(seq 1 $RETRY_COUNT); do
    if curl -s http://localhost:3000/health | grep -q "OK"; then
        log "Application health check passed"
        exit 0
    fi
    log "Health check attempt $i failed, retrying in $RETRY_DELAY seconds..."
    sleep $RETRY_DELAY
done

log "ERROR: Application health check failed after $RETRY_COUNT attempts"
exit 1
