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

log "Starting block_traffic script"

# Get instance ID from metadata service
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)

# Get target group ARN from instance tags
TARGET_GROUP_ARN=$(aws ec2 describe-tags \
    --filters "Name=resource-id,Values=${INSTANCE_ID}" "Name=key,Values=TargetGroupArn" \
    --query 'Tags[0].Value' \
    --output text)

if [ -n "$TARGET_GROUP_ARN" ]; then
    log "Deregistering instance ${INSTANCE_ID} from target group ${TARGET_GROUP_ARN}"
    aws elbv2 deregister-targets \
        --target-group-arn "${TARGET_GROUP_ARN}" \
        --targets Id="${INSTANCE_ID}"
    
    # Wait for connection draining
    log "Waiting for connection draining..."
    sleep 30
else
    log "No target group ARN found, skipping deregistration"
fi

log "Block_traffic completed successfully\n\n"
