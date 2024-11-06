#!/bin/bash

# Set strict error handling
set -euo pipefail

# Script variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/terraform-deploy.log"
ENV_FILE="${SCRIPT_DIR}/.env"
TERRAFORM_DIR="${SCRIPT_DIR}"

# Logging function
log() {
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[${timestamp}] $1" | tee -a "${LOG_FILE}"
}

# Error handler
handle_error() {
  local line_number=$1
  local error_code=$2
  log "ERROR: Command failed at line ${line_number} with exit code ${error_code}"
  exit "${error_code}"
}

# Set error handler
trap 'handle_error ${LINENO} $?' ERR

# Configure AWS credentials
configure_aws_credentials() {
  local aws_dir="$HOME/.aws"
  local credentials_file="$aws_dir/credentials"
  local config_file="$aws_dir/config"

  # Create AWS directory if it doesn't exist
  mkdir -p "$aws_dir"

  # Check if credentials already exist
  if [ -f "$credentials_file" ]; then
    existing_key=$(grep -A1 "\[${AWS_PROFILE}\]" "$credentials_file" | grep "aws_access_key_id" | cut -d= -f2 | tr -d ' ')
    if [ "$existing_key" = "$AWS_ACCESS_KEY" ]; then
      log "Using existing AWS profile: $AWS_PROFILE"
      return 0
    fi
  fi

  # Create/update credentials file
  log "Creating new AWS profile: $AWS_PROFILE"
  cat <<EOF >>"$credentials_file"
[$AWS_PROFILE]
aws_access_key_id=$AWS_ACCESS_KEY
aws_secret_access_key=$AWS_SECRET_KEY
EOF

  # Create/update config file
  cat <<EOF >>"$config_file"
[profile $AWS_PROFILE]
region=$AWS_REGION
output=json
EOF

  chmod 600 "$credentials_file" "$config_file"
  log "AWS credentials configured successfully"
}

# Check prerequisites
check_prerequisites() {
  log "Checking prerequisites..."

  # Check if terraform is installed
  if ! command -v terraform &>/dev/null; then
    log "ERROR: Terraform is not installed"
    exit 1
  fi

  # Check if environment file exists
  if [ ! -f "${ENV_FILE}" ]; then
    log "ERROR: Environment file not found at ${ENV_FILE}"
    exit 1
  fi

  # Check if required environment variables are set
  required_vars=(
    "PROJECT_NAME"
    "DEPLOYMENT_TYPE"
    "AWS_REGION"
    "AWS_PROFILE"
    "AWS_ACCOUNT_ID"
    "AWS_ACCESS_KEY"
    "AWS_SECRET_KEY"
    "VPC_ID"
    "IGW_ID"
    "INSTANCE_TYPES"
    "BITBUCKET_USERNAME",
    "BITBUCKET_APP_PASSWORD"
    "BITBUCKET_WORKSPACE"
    "BITBUCKET_BRANCH"
  )
  # "ECR_REGISTRY"
  # "ECR_REPOSITORY_NAME"
  # "CODEDEPLOY_APP_NAME"
  # "CODEDEPLOY_GROUP_NAME"
  # "CODEDEPLOY_S3_BUCKET"

  # Source environment variables
  set -a
  source "${ENV_FILE}"
  set +a

  # Convert environment variables to Terraform variables
  while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ $key =~ ^#.*$ ]] || [ -z "$key" ] && continue

    # Remove quotes from value
    value=$(echo "$value" | tr -d '"')

    # Export as TF_VAR if not already prefixed
    if [[ ! $key =~ ^TF_VAR_ ]]; then
      # lowercase key
      key=$(echo "$key" | tr '[:upper:]' '[:lower:]')
      # export as TF_VAR_key
      export "TF_VAR_${key}=${value}"
      # read value from dynamically created variable
      NewKeyValue=$(eval "echo \$TF_VAR_${key}")
      log "✅ Converted environment variable ${key} to Terraform variable TF_VAR_${key} with value ${NewKeyValue}"
    fi
  done <"${ENV_FILE}"

  # Check required variables
  for var in "${required_vars[@]}"; do
    if [ -z "${!var:-}" ]; then
      log "ERROR: Required environment variable ${var} is not set"
      exit 1
    fi
    log "✅ Required environment variable ${var} is set"
  done

  # Process environment variables and resolve references
  while IFS='=' read -r key value; do
      # Skip comments and empty lines
      [[ $key =~ ^#.*$ ]] || [ -z "$key" ] && continue
      
      # Remove quotes and leading/trailing whitespace
      value=$(echo "$value" | sed 's/^[[:space:]]*"//;s/"[[:space:]]*$//' | xargs)
      key=$(echo "$key" | xargs)
      
      # Resolve any ${VAR} references in the value
      while [[ $value =~ \$\{([A-Za-z_][A-Za-z0-9_]*)\} ]]; do
          ref_var="${BASH_REMATCH[1]}"
          # Get the referenced value using eval
          ref_value=$(eval "echo \$$ref_var")
          value=${value/\$\{$ref_var\}/$ref_value}
      done

      # Export as TF_VAR if not already prefixed
      if [[ ! $key =~ ^TF_VAR_ ]]; then
          # lowercase key for Terraform
          tf_key=$(echo "$key" | tr '[:upper:]' '[:lower:]')
          export "TF_VAR_${tf_key}=${value}"
          log "✅ Exported: TF_VAR_${tf_key}=${value}"
      fi
  done < "${ENV_FILE}"

  # Configure AWS credentials
  configure_aws_credentials

  IDENTITY=$(aws sts get-caller-identity --profile="${AWS_PROFILE}")
  ACCOUNT_ID=$(echo "${IDENTITY}" | jq -r '.Account')
  IAM_USER=$(echo "${IDENTITY}" | jq -r '.Arn' | cut -d'/' -f2)

  log "AWS Access Key : ${AWS_ACCESS_KEY}"
  log "AWS Secret Key : ${AWS_SECRET_KEY}"
  log "AWS Region     : ${AWS_REGION}"
  log "AWS Account    : ${ACCOUNT_ID}"
  log "AWS IAM User   : ${IAM_USER}"

  log "Prerequisites check passed"
}

# Initialize Terraform
init_terraform() {
  log "Initializing Terraform..."
  terraform -chdir="${TERRAFORM_DIR}" init
}

# Plan Terraform changes
plan_terraform() {
  log "Planning Terraform changes..."
  terraform -chdir="${TERRAFORM_DIR}" plan -out=tfplan
}

# Apply Terraform changes
apply_terraform() {
  log "Applying Terraform changes..."

  # Confirm destruction
  read -p "Are you sure you want to deploy all configured resources? (Y)es/(N)o " -r
  echo
  if [[ ! $REPLY =~ ^[yY]$ ]]; then
    log "Deployment cancelled by user"
    exit 1
  fi

  # NOTE: When command CLI does not require any approval, use the following command:
  # terraform -chdir="${TERRAFORM_DIR}" apply -auto-approve tfplan

  # NOTE: When command CLI requires approval, use the following command:
  terraform -chdir="${TERRAFORM_DIR}" apply tfplan
}

# Main deployment function
deploy() {
  log "Starting deployment process..."

  # Check if this is an initial deployment or update
  if [ ! -f "${TERRAFORM_DIR}/terraform.tfstate" ]; then
    log "Performing initial deployment..."
  else
    log "Performing infrastructure update..."
  fi

  init_terraform
  plan_terraform
  apply_terraform

  log "Deployment completed successfully"
}

# Main script execution
main() {
  log "Starting ASG infrastructure deployment script"

  check_prerequisites
  deploy

  log "Script completed successfully"
}

# Execute main function
main
