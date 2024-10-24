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
apt-get install -y wget curl net-tools iproute2

# Install Node.js v20 LTS
log "Installing Node.js v20 LTS"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install Deno 2.0
log "Installing Deno 2.0"
curl -fsSL https://deno.land/x/install/install.sh | sh

# Install Bun
log "Installing Bun"
curl -fsSL https://bun.sh/install | bash

# Install Docker and Docker Compose plugin
log "Installing Docker and Docker Compose plugin"
curl -fsSL https://get.docker.com | sh
apt-get install -y docker-compose-plugin

# Install AWS CLI
log "Installing AWS CLI"
curl "https://s3.amazonaws.com/aws-cli/awscli-bundle.zip" -o "awscli-bundle.zip"
unzip awscli-bundle.zip
./awscli-bundle/install -i /usr/local/aws -b /usr/local/bin/aws

# Install CodeDeploy agent
log "Installing CodeDeploy agent"
apt-get install -y ruby-full
cd /home/ubuntu
wget https://aws-codedeploy-${aws_region}.s3.amazonaws.com/latest/install
chmod +x ./install
./install auto

# Export variables
log "Exporting variables"
cat << EOF > /home/ubuntu/.env.vm
NODE_ENV=${node_env}
AWS_PROFILE=${aws_profile}
AWS_REGION=${aws_region}
AWS_ACCESS_KEY=${aws_access_key}
AWS_SECRET_KEY=${aws_secret_key}
BITBUCKET_APP_PASSWORD=${bitbucket_app_password}
BITBUCKET_WORKSPACE=${bitbucket_workspace}
BITBUCKET_BRANCH=${bitbucket_branch}
EOF

# Add environment variables to .bashrc for persistence
echo "set -a; source /home/ubuntu/.env.vm; set +a" >> /home/ubuntu/.bashrc

# Set correct ownership and permissions
chown ubuntu:ubuntu /home/ubuntu/.env.vm
chmod 600 /home/ubuntu/.env.vm

# Source the environment variables
echo "source /home/ubuntu/.env.vm" >> /home/ubuntu/.bashrc

log "Cloud-init script completed"
