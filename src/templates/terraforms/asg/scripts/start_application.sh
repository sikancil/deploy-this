#!/bin/bash

# Log file
LOG_FILE="/opt/codedeploy-agent/deployment-root/deployment-logs/codedeploy-agent-deployments.log"

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

log "Starting start_application script"

# Start the new container
NEW_CONTAINER_NAME="app-${DEPLOYMENT_GROUP_ID:0:7}"
FULL_IMAGE_NAME="${ECR_REGISTRY}/${ECR_REPOSITORY_NAME}:latest"

log "Starting new container: ${NEW_CONTAINER_NAME}"
docker run -d \
    --name ${NEW_CONTAINER_NAME} \
    --restart unless-stopped \
    --network host \
    --env-file /home/ubuntu/.env.vm \
    --health-cmd="curl -f http://localhost:3000/health || exit 1" \
    --health-interval=30s \
    --health-timeout=10s \
    --health-retries=3 \
    --health-start-period=30s \
    ${FULL_IMAGE_NAME}

if [ $? -ne 0 ]; then
    log "ERROR: Failed to start new container"
    exit 1
fi

# Wait for container to be healthy
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_INTERVAL=10

for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
    if docker inspect ${NEW_CONTAINER_NAME} --format='{{.State.Health.Status}}' | grep -q "healthy"; then
        log "New container is healthy"
        exit 0
    fi
    log "Waiting for container to be healthy... (${i}/${HEALTH_CHECK_RETRIES})"
    sleep $HEALTH_CHECK_INTERVAL
done

log "ERROR: Container health check failed"
docker logs ${NEW_CONTAINER_NAME}
exit 1
