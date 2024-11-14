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

log "Starting start_application script"

# Load environment variables
if [ -f /home/ubuntu/.env.vm ]; then
    source /home/ubuntu/.env.vm
else
    log "ERROR: Environment file not found"
    exit 1
fi

# Validate required variables
for VAR in ECR_REGISTRY ECR_REPOSITORY_NAME DEPLOYMENT_GROUP_ID; do
    if [ -z "${!VAR}" ]; then
        log "ERROR: Required variable $VAR is not set"
        exit 1
    fi
done

# Configure container
NEW_CONTAINER_NAME="app-${DEPLOYMENT_GROUP_ID:0:7}"
FULL_IMAGE_NAME="${ECR_REGISTRY}/${ECR_REPOSITORY_NAME}:latest"

# Get instance metadata
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
AVAILABILITY_ZONE=$(curl -s http://169.254.169.254/latest/meta-data/placement/availability-zone)

# Start container with enhanced configuration
log "Starting new container: ${NEW_CONTAINER_NAME}"
docker run -d \
    --name ${NEW_CONTAINER_NAME} \
    --restart unless-stopped \
    --network host \
    --env-file /home/ubuntu/.env.vm \
    --env AWS_INSTANCE_ID="${INSTANCE_ID}" \
    --env AWS_AVAILABILITY_ZONE="${AVAILABILITY_ZONE}" \
    --health-cmd="curl -f http://localhost:3000/health || exit 1" \
    --health-interval=15s \
    --health-timeout=5s \
    --health-retries=3 \
    --health-start-period=30s \
    --memory="512m" \
    --memory-reservation="256m" \
    --cpu-shares=1024 \
    ${FULL_IMAGE_NAME}

if [ $? -ne 0 ]; then
    log "ERROR: Failed to start container"
    exit 1
fi

# Monitor container health
HEALTH_CHECK_TIMEOUT=180
START_TIME=$(date +%s)

while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED_TIME=$((CURRENT_TIME - START_TIME))
    
    if [ $ELAPSED_TIME -gt $HEALTH_CHECK_TIMEOUT ]; then
        log "ERROR: Health check timeout after ${HEALTH_CHECK_TIMEOUT} seconds"
        docker logs ${NEW_CONTAINER_NAME}
        docker stop ${NEW_CONTAINER_NAME}
        docker rm ${NEW_CONTAINER_NAME}
        exit 1
    fi
    
    HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' ${NEW_CONTAINER_NAME})
    
    case $HEALTH_STATUS in
        "healthy")
            log "Container is healthy after ${ELAPSED_TIME} seconds"
            exit 0
            ;;
        "unhealthy")
            log "ERROR: Container became unhealthy"
            docker logs ${NEW_CONTAINER_NAME}
            docker stop ${NEW_CONTAINER_NAME}
            docker rm ${NEW_CONTAINER_NAME}
            exit 1
            ;;
        *)
            if [ $((ELAPSED_TIME % 10)) -eq 0 ]; then
                log "Waiting for container health check... (${ELAPSED_TIME}s elapsed)"
            fi
            sleep 2
            ;;
    esac
done
