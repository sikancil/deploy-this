#!/bin/bash

# Log file
ISO_DATE=$(date -u +"%Y-%m-%d")
LOG_PATH="/opt/codedeploy-logs/${ISO_DATE}/"
mkdir -p $LOG_PATH
LOG_FILE="${LOG_PATH}deployments.log"

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

log "Starting allow_traffic script"

# Get instance ID
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
if [ -z "$INSTANCE_ID" ]; then
    log "ERROR: Could not determine instance ID"
    exit 1
fi

# Get target group ARN from instance tags
TARGET_GROUP_ARN=$(aws ec2 describe-tags \
    --filters "Name=resource-id,Values=${INSTANCE_ID}" "Name=key,Values=TargetGroupArn" \
    --query 'Tags[0].Value' \
    --output text)

if [ -z "$TARGET_GROUP_ARN" ]; then
    log "ERROR: No target group ARN found"
    exit 1
fi

# Register instance with target group
log "Registering instance ${INSTANCE_ID} with target group ${TARGET_GROUP_ARN}"
aws elbv2 register-targets \
    --target-group-arn "${TARGET_GROUP_ARN}" \
    --targets Id="${INSTANCE_ID}"

if [ $? -ne 0 ]; then
    log "ERROR: Failed to register instance with target group"
    exit 1
fi

# Wait for target group health check
HEALTH_CHECK_TIMEOUT=300
START_TIME=$(date +%s)

while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED_TIME=$((CURRENT_TIME - START_TIME))
    
    if [ $ELAPSED_TIME -gt $HEALTH_CHECK_TIMEOUT ]; then
        log "ERROR: Target group health check timeout"
        exit 1
    fi
    
    TARGET_HEALTH=$(aws elbv2 describe-target-health \
        --target-group-arn "${TARGET_GROUP_ARN}" \
        --targets Id="${INSTANCE_ID}" \
        --query 'TargetHealthDescriptions[0].TargetHealth.State' \
        --output text)
    
    if [ "$TARGET_HEALTH" = "healthy" ]; then
        log "Instance is healthy in target group"
        break
    fi
    
    log "Waiting for target group health check... (${ELAPSED_TIME}s elapsed)"
    sleep 10
done

log "Allow_traffic completed successfully\n\n"
