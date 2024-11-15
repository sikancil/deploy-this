#!/bin/bash

# Log file
LOG_FILE="/opt/cloud-init.vm.log"

# Standard User (non-root)
STD_USER=${std_user:-"ubuntu"}

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
apt-get install -y wget curl net-tools iproute2 jq unzip lighttpd

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

# Add user to docker group and set proper permissions
log "Adding user to docker group"
usermod -aG docker $STD_USER
chmod 666 /var/run/docker.sock
newgrp docker

# Ensure docker.sock has correct permissions on restart
log "Ensuring docker.sock has correct permissions on restart"
cat << EOF > /etc/systemd/system/docker.socket.d/override.conf
[Socket]
SocketMode=0666
EOF

log "Reloading systemd daemon"
systemctl daemon-reload

# Install AWS CLI v2
log "Installing AWS CLI v2"
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install
rm -rf aws awscliv2.zip

# Install CodeDeploy agent
log "Installing CodeDeploy agent"
apt-get install -y ruby-full
cd /home/${STD_USER}
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
cat << EOF > /home/${STD_USER}/.env.vm
NODE_ENV=${node_env}
APP_PORT=${app_port}
DEPLOYMENT_TYPE=${deployment_type}
PROJECT_NAME=${project_name}

AWS_PROFILE=${aws_profile}
AWS_REGION=${aws_region}
AWS_ACCOUNT_ID=${aws_account_id}
AWS_ACCESS_KEY=${aws_access_key}
AWS_SECRET_KEY=${aws_secret_key}

ECR_REGISTRY_URL=${aws_account_id}.dkr.ecr.${aws_region}.amazonaws.com/${project_name}

CODEDEPLOY_APP_NAME=${project_name}-cd
CODEDEPLOY_GROUP_NAME=${project_name}-cd-dg
CODEDEPLOY_S3_BUCKET=${project_name}-artifacts

BITBUCKET_USERNAME=${bitbucket_username}
BITBUCKET_APP_PASSWORD=${bitbucket_app_password}
BITBUCKET_WORKSPACE=${bitbucket_workspace}
BITBUCKET_BRANCH=${bitbucket_branch}
EOF

# Add environment variables to .bashrc for persistence
echo "set -a; source /home/${STD_USER}/.env.vm; set +a" >> /home/${STD_USER}/.bashrc

# Set correct ownership and permissions
chown -R ${STD_USER}:${STD_USER} /home/${STD_USER}
chmod 600 /home/${STD_USER}/.env.vm
chmod 600 /root/.aws/credentials

# Setup temporary health check endpoint
log "Setting up temporary health check endpoint"
cat << EOF > /var/www/html/health
OK
EOF

# Start lighttpd on port 3000 temporarily
log "Starting temporary health check server"
sed -i 's/server.port.*=.*80/server.port = 3000/' /etc/lighttpd/lighttpd.conf
systemctl start lighttpd

# Function to download docker-compose.yml from S3 with retries
download_docker_compose() {
    local max_attempts=5
    local attempt=1
    local wait_time=10

    while [ $attempt -le $max_attempts ]; do
        log "Attempting to download docker-compose.yml from S3 (attempt $attempt/$max_attempts)"
        if aws s3 cp s3://${project_name}-artifacts/config/docker-compose.yml /home/$STD_USER/app/docker-compose.yml; then
            log "Successfully downloaded docker-compose.yml"
            chown $STD_USER:$STD_USER /home/$STD_USER/app/docker-compose.yml
            chmod 644 /home/$STD_USER/app/docker-compose.yml
            return 0
        else
            log "Failed to download docker-compose.yml (attempt $attempt/$max_attempts)"
            if [ $attempt -lt $max_attempts ]; then
                log "Waiting $wait_time seconds before next attempt..."
                sleep $wait_time
                wait_time=$((wait_time * 2))
            fi
        fi
        attempt=$((attempt + 1))
    done
    
    log "ERROR: Failed to download docker-compose.yml after $max_attempts attempts"
    return 1
}

# Download docker-compose.yml from S3
download_docker_compose

# Login to ECR and check for container image
log "Logging into ECR"
aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin ${aws_account_id}.dkr.ecr.${aws_region}.amazonaws.com

# Function to stop lighttpd properly
stop_lighttpd() {
    log "Stopping lighttpd service..."
    systemctl stop lighttpd
    systemctl disable lighttpd
    
    # Ensure port 3000 is free
    if netstat -ln | grep -q ':3000 '; then
        log "Force killing any process on port 3000..."
        fuser -k 3000/tcp || true
    fi
}

# Check if container image exists
LATEST_IMAGE="${aws_account_id}.dkr.ecr.${aws_region}.amazonaws.com/${project_name}:latest"
log "Checking for container image: $LATEST_IMAGE"

if docker pull $LATEST_IMAGE; then
    log "Successfully pulled container image"
    
    # Stop temporary health check server
    stop_lighttpd
    
    # Wait for port to be available
    sleep 5
    
    # Run the actual application container
    docker run -d \
        --name app \
        -p 3000:3000 \
        --restart unless-stopped \
        $LATEST_IMAGE
else
    log "No container image found, keeping temporary health check server running"
fi

# Setup graceful shutdown handler
cat << EOF > /usr/local/bin/graceful-shutdown
#!/bin/bash
# Graceful shutdown script
docker stop app -t 30 || true
systemctl stop lighttpd || true
EOF

chmod +x /usr/local/bin/graceful-shutdown

log "Cloud-init script completed"
