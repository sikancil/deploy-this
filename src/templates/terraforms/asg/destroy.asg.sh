#!/bin/bash

# Set strict error handling
set -euo pipefail

# Script variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/terraform-destroy.log"
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

  log "AWS Access Key: ${AWS_ACCESS_KEY}"
  log "AWS Secret Key: ${AWS_SECRET_KEY}"
  log "AWS Region: ${AWS_REGION}"
  log "Account ID: ${ACCOUNT_ID}"
  log "IAM User: ${IAM_USER}"

  log "Prerequisites check passed"
}

# Initialize Terraform
init_terraform() {
  log "Initializing Terraform..."
  terraform -chdir="${TERRAFORM_DIR}" init
}

# Plan Terraform destroy
plan_terraform_destroy() {
  log "Planning Terraform destroy..."
  terraform -chdir="${TERRAFORM_DIR}" plan -destroy -out=tfdestroyplan
}

# Apply Terraform destroy
apply_terraform_destroy() {
  log "Applying Terraform destroy..."
  terraform -chdir="${TERRAFORM_DIR}" apply tfdestroyplan
}

# Cleanup function
cleanup() {
  log "Cleaning up temporary files..."
  rm -f "${TERRAFORM_DIR}/tfdestroyplan"
  rm -f "${TERRAFORM_DIR}/*.pem"
  log "Cleanup completed"
}

# Main destroy function
destroy() {
  log "Starting destroy process..."

  # Check if terraform state exists
  if [ ! -f "${TERRAFORM_DIR}/terraform.tfstate" ]; then
    log "No terraform state found. Nothing to destroy."
    exit 0
  fi

  # Confirm destruction
  read -p "Are you sure you want to destroy all resources? (Y)es/(N)o " -r
  echo
  if [[ ! $REPLY =~ ^[yY]$ ]]; then
    log "Destroy cancelled by user"
    exit 1
  fi

  init_terraform
  plan_terraform_destroy
  apply_terraform_destroy
  cleanup

  log "Destroy completed successfully"
}

# Main script execution
main() {
  log "Starting ASG infrastructure destroy script"

  check_prerequisites
  destroy

  log "Script completed successfully"
}

# Execute main function
main
