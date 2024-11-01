#!/bin/bash

# Log file
LOG_FILE="/opt/cloud-init.vm.log"

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

# Ensure log directory exists
mkdir -p $(dirname $LOG_FILE)

log "Starting cloud-init script"

# Check internet connectivity
if ! ping -c 3 google.com &> /dev/null; then
    log "ERROR: No internet connection. Exiting."
    exit 1
fi

log "Internet connection confirmed"

# Update and upgrade packages
log "Updating and upgrading packages"
apt-get update && apt-get upgrade -y

# Install required packages
log "Installing required packages"
apt-get install -y wget curl net-tools iproute2 jq unzip

# Install Docker and Docker Compose plugin
log "Installing Docker and Docker Compose plugin"
curl -fsSL https://get.docker.com | sh
apt-get install -y docker-compose-plugin

# Configure Docker daemon with log rotation
cat << EOF > /etc/docker/daemon.json
{
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    }
}
EOF

# Restart Docker to apply changes
systemctl restart docker

# Install AWS CLI v2
log "Installing AWS CLI v2"
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install
rm -rf aws awscliv2.zip

# Install CodeDeploy agent
log "Installing CodeDeploy agent"
apt-get install -y ruby-full
cd /home/ubuntu
wget https://aws-codedeploy-${aws_region}.s3.amazonaws.com/latest/install
chmod +x ./install
./install auto

# Configure AWS credentials and region
log "Configuring AWS credentials"
mkdir -p /root/.aws
cat << EOF > /root/.aws/credentials
[default]
aws_access_key_id = ${aws_access_key}
aws_secret_access_key = ${aws_secret_key}
EOF

cat << EOF > /root/.aws/config
[default]
region = ${aws_region}
output = json
EOF

# Export variables
log "Exporting variables"
cat << EOF > /home/ubuntu/.env.vm
NODE_ENV=${node_env}
AWS_PROFILE=${aws_profile}
AWS_REGION=${aws_region}
AWS_ACCOUNT_ID=${aws_account_id}
AWS_ACCESS_KEY=${aws_access_key}
AWS_SECRET_KEY=${aws_secret_key}
ECR_REGISTRY=${aws_account_id}.dkr.ecr.${aws_region}.amazonaws.com
ECR_REPOSITORY_NAME=${project_name}
CODEDEPLOY_APP_NAME=${codedeploy_app_name}
CODEDEPLOY_GROUP_NAME=${codedeploy_group_name}
CODEDEPLOY_S3_BUCKET=${codedeploy_s3_bucket}
BITBUCKET_APP_PASSWORD=${bitbucket_app_password}
BITBUCKET_WORKSPACE=${bitbucket_workspace}
BITBUCKET_BRANCH=${bitbucket_branch}
EOF

# Add environment variables to .bashrc for persistence
echo "set -a; source /home/ubuntu/.env.vm; set +a" >> /home/ubuntu/.bashrc

# Set correct ownership and permissions
chown -R ubuntu:ubuntu /home/ubuntu
chmod 600 /home/ubuntu/.env.vm
chmod 600 /root/.aws/credentials

# Login to ECR
log "Logging into ECR"
aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin ${aws_account_id}.dkr.ecr.${aws_region}.amazonaws.com

log "Cloud-init script completed"
