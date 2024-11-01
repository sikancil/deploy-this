# DeployThis (dt) CLI Workflows

This document outlines the workflows for both developers and users of the DeployThis (dt) CLI tool, including detailed information about environment variables, Terraform configuration workflows, and use cases for different deployment types.

## Table of Contents
- [DeployThis (dt) CLI Workflows](#deploythis-dt-cli-workflows)
  - [Table of Contents](#table-of-contents)
  - [Developer Workflows](#developer-workflows)
    - [Setting Up the Development Environment](#setting-up-the-development-environment)
    - [Making Changes](#making-changes)
    - [Testing](#testing)
    - [Submitting Changes](#submitting-changes)
    - [Terraform Configuration Workflow](#terraform-configuration-workflow)
  - [User Workflows](#user-workflows)
    - [Installation](#installation)
    - [Configuration](#configuration)
    - [Basic Usage](#basic-usage)
    - [Advanced Usage](#advanced-usage)
  - [Environment Variables](#environment-variables)
  - [Deployment Types](#deployment-types)
    - [Single Instance Deployment](#single-instance-deployment)
    - [Auto Scaling Group (ASG) Deployment](#auto-scaling-group-asg-deployment)
  - [AWS Resource Initialization and Relationships](#aws-resource-initialization-and-relationships)
    - [Resource Relationships](#resource-relationships)
  - [Bitbucket Pipelines Integration](#bitbucket-pipelines-integration)
    - [How Bitbucket Pipelines Works with AWS Resources](#how-bitbucket-pipelines-works-with-aws-resources)

## Developer Workflows

### Setting Up the Development Environment

1. Clone the repository:
   ```
   git clone https://github.com/sikancil/deploy-this.git
   cd deploy-this
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the project:
   ```
   npm run build
   ```

4. Link the CLI globally for testing:
   ```
   npm link
   ```

### Making Changes

1. Create a new branch for your feature or bug fix:
   ```
   git checkout -b feature/your-feature-name
   ```

2. Make your changes in the appropriate files under the `src/` directory.

3. Update or add tests as necessary in the `src/tests/` directory.

4. Update documentation in `README.md` and this `WORKFLOWS.md` file if your changes affect the user interface or workflows.

### Testing

1. Run the linter to check for code style issues:
   ```
   npm run lint
   ```

2. Run the test suite:
   ```
   npm test
   ```

3. Manually test the CLI by running various commands:
   ```
   dt init staging single
   dt deploy staging
   dt status
   ```

### Submitting Changes

1. Commit your changes:
   ```
   git add .
   git commit -m "Description of your changes"
   ```

2. Push your branch to the remote repository:
   ```
   git push origin feature/your-feature-name
   ```

3. Create a pull request on GitHub and wait for review.

### Terraform Configuration Workflow

1. Terraform configurations are stored in `src/templates/terraforms/` directory.
2. There are two main configuration types: `single` for single instance deployments and `asg` for Auto Scaling Group deployments.
3. When making changes to Terraform configurations:
   - Ensure variables are properly defined in `variables.tf`.
   - Update `main.tf` for core infrastructure changes.
   - Modify specific resource files (e.g., `instance.tf`, `asg.tf`) as needed.
   - Update `outputs.tf` if new outputs are required.
4. Test Terraform configurations locally:
   ```
   cd src/templates/terraforms/single  # or asg
   terraform init
   terraform plan
   ```
5. Ensure that changes are compatible with both deployment types when applicable.

## User Workflows

### Installation

1. Install the DeployThis CLI globally:
   ```
   npm install -g deploy-this
   ```

### Configuration

1. Create a `.env` file in your project root:
   ```
   NODE_ENV=staging
   ```

2. Create a `.env.dt.staging` (or `.env.dt.production`) file with the necessary AWS and Bitbucket credentials. Refer to the `.env.dt.stage-example` file for the required variables.

### Basic Usage

1. Initialize the project:
   ```
   dt init staging single
   ```
   This command will set up the necessary Terraform configurations for a single instance deployment in the staging environment.

2. Deploy the infrastructure:
   ```
   dt deploy staging
   ```
   This command will create or update the AWS resources defined in your Terraform configurations.

3. Check the status of your deployment:
   ```
   dt status
   ```
   This will show you information about the currently deployed resources.

### Advanced Usage

1. Manage IAM service accounts:
   ```
   dt iam show
   dt iam create my-service-account
   dt iam delete my-service-account
   ```

2. Validate your current setup:
   ```
   dt validate
   ```
   This command checks for required tools, AWS credentials, and environment variables.

3. View current configuration:
   ```
   dt config
   ```

4. Rollback infrastructure (except VPC and InternetGateway):
   ```
   dt rollback
   ```
   Use this command with caution as it will destroy most of your deployed resources.

## Environment Variables

The DeployThis CLI uses two main environment files:

1. `.env`: Contains the `NODE_ENV` variable to specify the current environment (e.g., staging, production).

2. `.env.dt.<environment>`: Contains AWS and Bitbucket credentials, as well as deployment-specific variables. Key variables include:
   - `AWS_PROFILE`: AWS CLI profile to use
   - `AWS_REGION`: Target AWS region
   - `AWS_ACCESS_KEY` and `AWS_SECRET_KEY`: AWS credentials
   - `VPC_ID` and `IGW_ID`: Existing VPC and Internet Gateway IDs
   - `BITBUCKET_APP_PASSWORD`, `BITBUCKET_WORKSPACE`, `BITBUCKET_BRANCH`: Bitbucket-related variables
   - `DEPLOYMENT_TYPE`: "single" or "asg"
   - `AMI_ID`: ID of the Amazon Machine Image to use
   - `INSTANCE_TYPES`: List of instance types for ASG deployments

Ensure all required variables are set before running `dt` commands.

## Deployment Types

### Single Instance Deployment

Single instance deployment creates a single EC2 instance with associated resources.

1. Initialize:
   ```
   dt init staging single
   ```

2. Deploy:
   ```
   dt deploy staging
   ```

3. Access the instance:
   - Use the output IP address to SSH into the instance
   - The application should be running on the specified port

### Auto Scaling Group (ASG) Deployment

ASG deployment creates an Auto Scaling Group with multiple EC2 instances behind a load balancer.

1. Initialize:
   ```
   dt init staging asg
   ```

2. Deploy:
   ```
   dt deploy staging
   ```

3. Access the application:
   - Use the output load balancer DNS name to access the application
   - Instances will scale based on defined metrics

## AWS Resource Initialization and Relationships

When using DeployThis CLI for initial deployment, the following AWS resources are created and configured:

1. **VPC (Virtual Private Cloud)**: 
   - Created first as the foundation of your network infrastructure.
   - Isolates your resources in a private network environment.

2. **Internet Gateway**: 
   - Attached to the VPC to enable communication between the VPC and the internet.

3. **Subnets**: 
   - Created within the VPC.
   - For single instance deployments, one subnet is created.
   - For ASG deployments, multiple subnets are created across different availability zones.

4. **Route Tables**: 
   - Associated with the subnets to control network traffic routing.

5. **Security Groups**: 
   - Created to control inbound and outbound traffic for EC2 instances.
   - For ASG deployments, additional security groups are created for the Application Load Balancer.

6. **EC2 Instance(s)**: 
   - For single instance deployments, one EC2 instance is created.
   - For ASG deployments, multiple instances are created and managed by the Auto Scaling Group.

7. **IAM Roles and Instance Profiles**: 
   - Created to grant necessary permissions to EC2 instances for accessing other AWS services.

8. **Application Load Balancer (ALB)** (ASG deployments only): 
   - Distributes incoming application traffic across multiple EC2 instances.

9. **Auto Scaling Group (ASG)** (ASG deployments only): 
   - Manages EC2 instances automatically based on specified conditions.

10. **CloudWatch Alarms**: 
    - Set up to monitor the health and performance of your resources.

11. **ECR Repository**: 
    - Created to store Docker images of your application.

### Resource Relationships

- The VPC contains all other networking components (subnets, route tables, internet gateway).
- EC2 instances are launched in the subnets within the VPC.
- Security groups are attached to EC2 instances and the ALB (in ASG deployments) to control traffic.
- The ALB (in ASG deployments) distributes traffic to EC2 instances across multiple subnets.
- The ASG (in ASG deployments) manages EC2 instances based on CloudWatch metrics and alarms.
- IAM roles are associated with EC2 instances through instance profiles.

## Bitbucket Pipelines Integration

DeployThis CLI integrates with Bitbucket Pipelines for continuous deployment:

1. In your Bitbucket repository, create a `bitbucket-pipelines.yml` file.

2. Configure the pipeline to use the DeployThis CLI:

   ```yaml
   pipelines:
     branches:
       main:
         - step:
             name: Deploy to AWS
             script:
               - npm install -g deploy-this
               - dt validate
               - dt deploy production
   ```

3. Set up Bitbucket Pipelines environment variables to match your `.env.dt.<environment>` file.

4. Commit and push changes to trigger the pipeline and automatic deployment.

### How Bitbucket Pipelines Works with AWS Resources

1. When code is pushed to the specified branch, Bitbucket Pipelines triggers a build.
2. The pipeline builds your application and creates a Docker image.
3. The Docker image is pushed to the ECR repository created by DeployThis.
4. For single instance deployments:
   - The pipeline triggers a deployment to update the EC2 instance with the new image.
5. For ASG deployments:
   - The pipeline updates the launch template or launch configuration with the new image details.
   - CodeDeploy is then used to perform a rolling update of the EC2 instances in the ASG.

This integration ensures that your latest code changes are automatically deployed to your AWS infrastructure, maintaining consistency between your codebase and deployed application.

Remember to always review the changes proposed by the `dt deploy` command before confirming the deployment, especially in production environments.

For more detailed information on each command and its options, refer to the README.md file or use the `dt help` command.
