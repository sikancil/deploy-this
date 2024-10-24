# DeployThis (dt) CLI

DeployThis (dt) is a powerful Command Line Interface (CLI) tool designed to streamline AWS infrastructure deployment and Bitbucket pipeline configuration. It provides a seamless way to manage and deploy your infrastructure as code, supporting both single instance and auto-scaling group (ASG) deployments.

## Key Points

- Automates AWS infrastructure deployment
- Supports single instance and ASG deployments
- Integrates with Bitbucket for CI/CD
- Uses Terraform for infrastructure as code
- Provides a user-friendly CLI interface

## Features

1. **Environment Management**: Easily switch between different environments (e.g., staging, production).
2. **AWS Resource Management**: Create, update, and delete AWS resources including VPCs, EC2 instances, and Auto Scaling Groups.
3. **IAM Integration**: Manage IAM service accounts directly from the CLI.
4. **Terraform Integration**: Utilizes Terraform for infrastructure provisioning and management.
5. **Bitbucket Pipeline Support**: Automates the setup and configuration of Bitbucket pipelines.
6. **Environment Validation**: Checks for required tools, AWS credentials, and environment variables.
7. **Customizable Deployments**: Supports both single instance and auto-scaling group deployments.
8. **Rollback Capability**: Allows for easy rollback of infrastructure changes.

## User Guide

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/your-repo/deploy-this.git
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

4. Link the CLI globally:
   ```
   npm link
   ```

### Basic Usage

The general syntax for using the `dt` CLI is:

```
dt <command> [options]
```

### Available Commands

1. **init**: Initialize the project configuration
   ```
   dt init [targetEnvironment] [deploymentType]
   ```

2. **deploy**: Deploy infrastructure
   ```
   dt deploy [targetEnvironment]
   ```

3. **config**: Show current configuration
   ```
   dt config
   ```

4. **validate**: Validate current setup
   ```
   dt validate
   ```

5. **status**: Get status and information for current project
   ```
   dt status
   ```

6. **rollback**: Rollback infrastructure (except VPC and InternetGateway)
   ```
   dt rollback
   ```

7. **iam**: Manage IAM service accounts
   ```
   dt iam <action> [user]
   ```

### Configuration

1. Create a `.env` file in the project root with the following content:
   ```
   NODE_ENV=staging
   ```

2. Create a `.env.dt.staging` (or `.env.dt.production`) file with the necessary AWS and Bitbucket credentials. Refer to the `.env.dt.stage-example` file for the required variables.

### Deployment Workflow

1. Initialize the project:
   ```
   dt init staging single
   ```

2. Deploy the infrastructure:
   ```
   dt deploy staging
   ```

3. Check the status of your deployment:
   ```
   dt status
   ```

4. If needed, rollback the changes:
   ```
   dt rollback
   ```

## Future Improvements

1. **Multi-cloud Support**: Extend the CLI to support other cloud providers like Azure and Google Cloud Platform.
2. **Enhanced Security Features**: Implement more robust security checks and integrations with AWS security services.
3. **Custom Resource Support**: Allow users to define and deploy custom AWS resources.
4. **Monitoring Integration**: Integrate with AWS CloudWatch for better monitoring and alerting capabilities.
5. **Cost Estimation**: Provide cost estimates for the infrastructure before deployment.
6. **Infrastructure Testing**: Implement automated testing for the deployed infrastructure.
7. **Backup and Disaster Recovery**: Add features for automated backups and disaster recovery planning.
8. **Performance Optimization**: Implement features to suggest and apply performance optimizations for the deployed resources.
9. **Multi-region Deployment**: Support for deploying infrastructure across multiple AWS regions.
10. **Compliance Checks**: Integrate compliance checking tools to ensure deployed infrastructure meets industry standards and best practices.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache-2.0 License.
