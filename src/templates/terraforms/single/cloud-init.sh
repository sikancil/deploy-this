#!/bin/bash

# Log file.  Used for logging script execution events.
LOG_FILE="/opt/cloud-init.vm.log"

# Function to log messages.  Simplifies logging to the LOG_FILE.
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

# Ensure log directory exists. Creates the directory if it doesn't exist.
mkdir -p $(dirname $LOG_FILE)

log "Starting cloud-init script"

# Check internet connectivity.  Pings google.com to verify internet access.
# Exits with an error if no internet connection is detected.
if ! ping -c 3 google.com &> /dev/null; then
    log "ERROR: No internet connection. Exiting."
    exit 1
fi

log "Internet connection confirmed"

# Update and upgrade packages. Updates the package list and upgrades installed packages.
log "Updating and upgrading packages"
apt-get update && apt-get upgrade -y

# Install required packages. Installs essential packages like wget, curl, net-tools, and iproute2.
log "Installing required packages"
apt-get install -y wget curl net-tools iproute2 ruby-full

# Install Node.js v20 LTS. Installs the Node.js v20 LTS version using the nodesource repository.
log "Installing Node.js v20 LTS"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install Deno 2.0. Installs Deno version 2.0 using the official installer script.
log "Installing Deno 2.0"
curl -fsSL https://deno.land/x/install/install.sh | sh

# Install Bun. Installs Bun, a fast JavaScript runtime.
log "Installing Bun"
curl -fsSL https://bun.sh/install | bash

# Install Docker and Docker Compose plugin. Installs Docker and the Docker Compose plugin.
log "Installing Docker and Docker Compose plugin"
curl -fsSL https://get.docker.com | sh
apt-get install -y docker-compose-plugin

# Install AWS CLI. Installs the AWS command-line interface.
log "Installing AWS CLI"
curl "https://s3.amazonaws.com/aws-cli/awscli-bundle.zip" -o "awscli-bundle.zip"
unzip awscli-bundle.zip
./awscli-bundle/install -i /usr/local/aws -b /usr/local/bin/aws

# Install CodeDeploy agent
log "Installing CodeDeploy agent"
# cd /home/ubuntu
wget https://aws-codedeploy-${aws_region}.s3.amazonaws.com/latest/install
chmod +x ./install
./install auto

log "Installing CloudWatch agent"
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i -E ./amazon-cloudwatch-agent.deb

log "Configuring CloudWatch agent"
cat << EOF > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "root"
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/syslog",
            "log_group_name": "/aws/ec2/${project_name}",
            "log_stream_name": "{instance_id}/syslog"
          },
          {
            "file_path": "/opt/cloud-init.vm.log",
            "log_group_name": "/aws/ec2/${project_name}",
            "log_stream_name": "{instance_id}/cloud-init"
          }
        ]
      }
    }
  }
}
EOF

log "Starting CloudWatch agent"
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

# Export variables.  Exports environment variables from Terraform variables to a .env file.
# These variables are used by other scripts and applications running on the instance.
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
ECR_REPOSITORY_NAME=${ecr_repository_name}
EOF

# Add environment variables to .bashrc for persistence.  Ensures the environment variables are loaded on each shell startup.
echo "set -a; source /home/ubuntu/.env.vm; set +a" >> /home/ubuntu/.bashrc

# Set correct ownership and permissions. Sets ownership and permissions for the .env.vm file for security.
chown ubuntu:ubuntu /home/ubuntu/.env.vm
chmod 600 /home/ubuntu/.env.vm

# Source the environment variables. Adds a command to source the .env.vm file in the .bashrc file.
echo "source /home/ubuntu/.env.vm" >> /home/ubuntu/.bashrc

log "Installing PM2"
npm install -g pm2

log "Cloud-init script completed"

# TODO: Add error handling for each command to improve robustness.

# TODO: Use a package manager like `apt`? to manage the installation of Node.js, Deno, and Bun for better version control and updates.
