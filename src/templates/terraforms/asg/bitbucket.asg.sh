#!/bin/bash

# Set strict error handling
set -euo pipefail

# Script variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/bitbucket-config.log"
ENV_FILE="${SCRIPT_DIR}/.env"

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

# URL encode a string
url_encode() {
    local string="$1"
    local encoded=""
    local length="${#string}"
    local pos c o
    
    for (( pos=0; pos<length; pos++ )); do
        c="${string:$pos:1}"
        case "$c" in
            [-_.~a-zA-Z0-9]) # Keep unreserved characters as-is
                o="$c"
                ;;
            *)  # Encode everything else
                printf -v o '%%%02X' "'$c"
                ;;
        esac
        encoded+="$o"
    done
    
    echo "$encoded"
}

# Set error handler
trap 'handle_error ${LINENO} $?' ERR

# Load environment variables
load_env_vars() {
  log "Loading environment variables..."

  if [ ! -f "${ENV_FILE}" ]; then
    log "ERROR: Environment file not found at ${ENV_FILE}"
    exit 1
  fi

  # Source environment variables
  set -a
  source "${ENV_FILE}"
  set +a

  # Validate required variables
  required_vars=(
    "PROJECT_NAME"
    "AWS_PROFILE"
    "AWS_REGION"
    "AWS_ACCOUNT_ID"
    "AWS_ACCESS_KEY"
    "AWS_SECRET_KEY"
    # "CODEDEPLOY_APP_NAME"
    # "CODEDEPLOY_GROUP_NAME"
    # "CODEDEPLOY_S3_BUCKET"
    # "ECR_REGISTRY"
    # "ECR_REPOSITORY_NAME"
    "BITBUCKET_USERNAME"
    "BITBUCKET_APP_PASSWORD"
    "BITBUCKET_WORKSPACE"
    "BITBUCKET_REPO_SLUG"
    "BITBUCKET_BRANCH"
  )

  for var in "${required_vars[@]}"; do
    if [ -z "${!var:-}" ]; then
      log "ERROR: Required environment variable ${var} is not set"
      exit 1
    fi
  done

  #Conditional variables based on deployment type
  if [[ "${DEPLOYMENT_TYPE}" == "asg" ]]; then
    required_vars+=(
      "CODEDEPLOY_APP_NAME"
      "CODEDEPLOY_GROUP_NAME"
      "CODEDEPLOY_S3_BUCKET"
      "ECR_REGISTRY"
      "ECR_REPOSITORY_NAME"
    )
  fi

  for var in "${required_vars[@]}"; do
    if [ -z "${!var:-}" ]; then
      log "ERROR: Required environment variable ${var} is not set"
      exit 1
    fi
  done

  log "Environment variables loaded successfully"
}

# Configure BitBucket API client
get_bitbucket_auth() {
  local bb_username="$BITBUCKET_USERNAME"
  local bb_password="$BITBUCKET_APP_PASSWORD"
  local test_endpoint="https://api.bitbucket.org/2.0/workspaces"

  # Create Basic Auth credentials
  local auth_string="${bb_username}:${bb_password}"
  local base64_auth=$(echo -n "$auth_string" | base64)
  local auth_header="Authorization: Basic ${base64_auth}"

  # Test the credentials with a curl request
  local response_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "$auth_header" \
    "$test_endpoint")

  if [ "$response_code" -eq 200 ]; then
    # If successful, echo the auth header for capture
    echo "$auth_header"
    return 0
  else
    echo "Error: Authentication failed with status code $response_code" >&2
    return 1
  fi
}

# Set deployment variables for an environment
set_deployment_variables() {
  local environment=$1
  local auth_header=$2
  local api_url="https://api.bitbucket.org/2.0"

  log "Setting deployment variables for ${environment} environment..."

  # Get or create environment
  local envars_url="${api_url}/repositories/${BITBUCKET_WORKSPACE}/${BITBUCKET_REPO_SLUG}/environments"
  log "Getting environment from: ${envars_url}"
  log "Authentication Header: ${auth_header}"
  local env_response=$(curl -s -w "%{http_code}" -H "${auth_header}" "${envars_url}")
  local env_http_code=${env_response: -3}
  local env_body=${env_response%???}

  log "Environment Response Body: ${env_body}"

  local environment_uuid=""
  if [[ "${env_http_code}" == "200" ]]; then
    log "Before jq: environment = ${environment}, environment_body = ${env_body}"
    environment_uuid=$(echo "${env_body}" | jq -r ".values[] | select(.name | ascii_downcase == \"${environment}\") | .uuid")
  fi

  if [[ -z "${environment_uuid}" ]]; then
    log "Creating new environment: ${environment}"
    local create_response=$(curl -v -s -w "\nHTTP_CODE:%{http_code}" -X POST -H "${auth_header}" \
      -H "Content-Type: application/json" \
      "${api_url}/repositories/${BITBUCKET_WORKSPACE}/${BITBUCKET_REPO_SLUG}/environments" \
      -d "{\"type\": \"deployment\", \"name\": \"${environment}\"}" 2>&1)

    local create_http_code=$(echo "$create_response" | grep "HTTP_CODE:" | cut -d':' -f2)
    local create_body=$(echo "$create_response" | sed '$d') # Remove last line (HTTP_CODE)

    if [[ "${create_http_code}" != "201" ]]; then
      log "ERROR: Failed to create environment. HTTP Code: ${create_http_code}"
      log "Full Response:"
      log "----------------------------------------"
      log "${create_body}"
      log "----------------------------------------"
      log "API URL: ${api_url}/repositories/${BITBUCKET_WORKSPACE}/${BITBUCKET_REPO_SLUG}/environments"
      log "Workspace: ${BITBUCKET_WORKSPACE}"
      log "Repo Slug: ${BITBUCKET_REPO_SLUG}"
      return 1
    fi

    environment_uuid=$(echo "${create_body}" | jq -r '.uuid')
  fi

  log "Using environment UUID: ${environment_uuid}"

  # Create JSON string of deployment variables.  Conditional based on deployment type
  local deploy_vars_json=""
  if [[ "${DEPLOYMENT_TYPE}" == "asg" ]]; then
    deploy_vars_json=$(
      cat <<EOF
{
  "NODE_ENV": "${NODE_ENV}",
  "AWS_PROFILE": "${AWS_PROFILE}",
  "AWS_REGION": "${AWS_REGION}",
  "AWS_ACCOUNT_ID": "${AWS_ACCOUNT_ID}",
  "AWS_ACCESS_KEY_ID": "${AWS_ACCESS_KEY}",
  "AWS_SECRET_ACCESS_KEY": "${AWS_SECRET_KEY}",
  "ECR_REGISTRY": "${ECR_REGISTRY}",
  "ECR_REPOSITORY_NAME": "${ECR_REPOSITORY_NAME}",
  "CODEDEPLOY_APP_NAME": "${CODEDEPLOY_APP_NAME}",
  "CODEDEPLOY_GROUP_NAME": "${CODEDEPLOY_GROUP_NAME}",
  "CODEDEPLOY_S3_BUCKET": "${CODEDEPLOY_S3_BUCKET}"
}
EOF
    )
  else
    deploy_vars_json=$(
      cat <<EOF
{
  "NODE_ENV": "${NODE_ENV}",
  "AWS_PROFILE": "${AWS_PROFILE}",
  "AWS_REGION": "${AWS_REGION}",
  "AWS_ACCOUNT_ID": "${AWS_ACCOUNT_ID}",
  "AWS_ACCESS_KEY_ID": "${AWS_ACCESS_KEY}",
  "AWS_SECRET_ACCESS_KEY": "${AWS_SECRET_KEY}"
}
EOF
    )
  fi


  # Get current variables
  local encoded_environment_uuid=$(url_encode "${environment_uuid}")
  local vars_url="${api_url}/repositories/${BITBUCKET_WORKSPACE}/${BITBUCKET_REPO_SLUG}/deployments_config/environments/${encoded_environment_uuid}/variables"
  log "Getting variables from: ${vars_url}"
  log "Authentication Header: ${auth_header}"
  local vars_response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -H "${auth_header}" -H "Content-Type: application/json" "${vars_url}" 2>&1)
  local vars_http_code=$(echo "$vars_response" | grep "HTTP_CODE:" | cut -d':' -f2 | tr -d '[:space:]')
  local vars_body=$(echo "$vars_response" | sed '$d')

  log "Variables Response Body: ${vars_body}"

  if [[ "${vars_http_code}" != "200" ]]; then
    log "WARNING: Failed to get existing variables. HTTP Code: ${vars_http_code}"
    log "Full Response:"
    log "----------------------------------------"
    log "${vars_body}"
    log "----------------------------------------"
    log "API URL: ${vars_url}"
  fi

  # Set each variable from JSON
  for key in $(echo "$deploy_vars_json" | jq -r 'keys[]'); do
    local value=$(echo "$deploy_vars_json" | jq -r --arg k "$key" '.[$k]')
    local var_uuid=""

    # Check if variable exists
    if [[ "${vars_http_code}" == "200" ]]; then
      var_uuid=$(echo "${vars_body}" | jq -r ".values[] | select(.key == \"${key}\") | .uuid")
    fi

    local method="POST"
    local url="${api_url}/repositories/${BITBUCKET_WORKSPACE}/${BITBUCKET_REPO_SLUG}/deployments_config/environments/${encoded_environment_uuid}/variables"
    
    local variable_data="{}"
    
    local set_secured="false"
    
    if [[ ! -z "${var_uuid}" ]]; then
      method="PUT"
      encoded_var_uuid=$(url_encode "${var_uuid}")
      url="${url}/${encoded_var_uuid}"
      variable_data="{ \"type\": \"pipeline_variable\", \"key\": \"${key}\", \"value\": \"${value}\", \"secured\": ${set_secured} }"
    else
      method="POST"
      url="${url}"
      variable_data="{ \"type\": \"pipeline_variable\", \"key\": \"${key}\", \"value\": \"${value}\", \"secured\": ${set_secured} }"
    fi

    local set_url="${url}"
    
    log "Setting variable ${key} with URL: ${set_url}"
    log "Authentication Header: ${auth_header}"
    local set_var_response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X ${method} -H "${auth_header}" \
      -H "Content-Type: application/json" \
      "${set_url}" \
      -d "${variable_data}")
    local set_var_http_code=$(echo "$set_var_response" | grep "HTTP_CODE:" | cut -d':' -f2 | tr -d '[:space:]')
    local set_var_body=$(echo "$set_var_response" | sed '$d')

    log "Variables Response Body: ${set_var_body}"

    if [[ "${set_var_http_code}" != "200" ]]; then
      log "WARNING: Failed to get existing variables. HTTP Code: ${set_var_http_code}"
      log "Full Response:"
      log "----------------------------------------"
      log "${set_var_body}"
      log "----------------------------------------"
      log "API URL: ${set_url}"
    fi

    log "✅ Set ${key} for ${environment} environment"
  done

  log "Deployment variables set successfully for ${environment} environment"
}

# Set global repository variables
set_repository_variables() {
  local auth_header=$1
  local api_url="https://api.bitbucket.org/2.0"

  log "Setting global repository variables..."

  # Define global variables. Using environment variables instead of declare -A
  local node_env="$NODE_ENV"
  local deployment_type="$DEPLOYMENT_TYPE"

  # Create/update repository variable for NODE_ENV
  curl -s -X POST -H "${auth_header}" -H "Content-Type: application/json" \
    "${api_url}/repositories/${BITBUCKET_WORKSPACE}/${BITBUCKET_REPO_SLUG}/workspace/variables" \
    -d "{\"key\": \"NODE_ENV\", \"value\": \"${node_env}\", \"secured\": false}" || {
    log "ERROR: Failed to set global variable NODE_ENV"
    return 1
  }
  log "✅ Set global variable NODE_ENV"

  # Create/update repository variable for DEPLOYMENT_TYPE
  curl -s -X POST -H "${auth_header}" -H "Content-Type: application/json" \
    "${api_url}/repositories/${BITBUCKET_WORKSPACE}/${BITBUCKET_REPO_SLUG}/workspace/variables" \
    -d "{\"key\": \"DEPLOYMENT_TYPE\", \"value\": \"${deployment_type}\", \"secured\": false}" || {
    log "ERROR: Failed to set global variable DEPLOYMENT_TYPE"
    return 1
  }
  log "✅ Set global variable DEPLOYMENT_TYPE"


  log "Global repository variables set successfully"
}

# Main function
main() {
  log "Starting BitBucket repository configuration..."

  # Load environment variables
  load_env_vars

  # Configure BitBucket API
  local auth_header=$(get_bitbucket_auth)

  # Set deployment variables for staging and production
  set_deployment_variables "staging" "${auth_header}"
  set_deployment_variables "production" "${auth_header}"

  # Set global repository variables
  set_repository_variables "${auth_header}"

  log "BitBucket repository configuration completed successfully"
}

# Execute main function
main
