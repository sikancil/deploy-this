# Terraform Single Instance Deployment

## 1. Project Overview

This Terraform configuration automates the deployment of a single EC2 instance on AWS.  It utilizes existing VPC and Internet Gateway resources. The architecture is a simple single-instance setup, ideal for small-scale deployments or testing environments.

Key components provisioned:

*   **EC2 Instance:** A single virtual machine running Ubuntu 22.04 LTS.
*   **Security Group:** Controls inbound and outbound network traffic to the instance.
*   **Key Pair:** Used for SSH access to the instance.
*   **Subnet and Route Table:** Provides network connectivity within the VPC and to the internet.


## 2. Prerequisites

*   **Terraform:** Version 1.3 or higher (tested with 1.3.7).
*   **AWS Provider:** Version 5.0 or higher (tested with 5.0.0).
*   **AWS Credentials:**  An AWS profile configured with appropriate permissions to create and manage EC2 instances, security groups, key pairs, subnets, and route tables.  The profile name is specified in the `aws_profile` variable.
*   **Existing VPC and Internet Gateway:** This configuration assumes the existence of a VPC and an internet gateway.  Their IDs are specified in the `vpc_id` and `igw_id` variables respectively.
*   **Bitbucket Credentials:** A Bitbucket App Password or API key is required for deployment automation (specified in `bitbucket_app_password`).


## 3. File Structure

The `src/templates/terraforms/single/` directory contains the following files:

*   **`main.tf`:** The main Terraform configuration file.  It defines the providers, resources, and overall infrastructure setup.
*   **`variables.tf`:** Defines the input variables used to customize the deployment.
*   **`instance.tf`:** Configures the EC2 instance, including AMI ID, instance type, security group, and user data.
*   **`key.tf`:** Manages the creation of an AWS key pair for SSH access.  It also creates a local file containing the private key.  **Keep this file secure.**
*   **`subnets.tf`:** Defines the subnet and route table for the EC2 instance.
*   **`outputs.tf`:** Defines the output values, such as instance ID, public IP, and security group ID.
*   **`cloud-init.sh`:** A shell script executed during instance launch to install software and configure the environment.
*   **`SINGLE.md`:** (Currently empty)  This file can be used for additional documentation or notes specific to this single-instance deployment.


## 4. Configuration Details

### 4.1 Network Setup

The configuration uses an existing VPC and Internet Gateway.  The subnet CIDR block, availability zone, and public IP assignment are configurable via variables.

### 4.2 Instance Configuration

The EC2 instance is configured using the following variables:

*   `ami_id`: The AMI ID for the instance.
*   `instance_types`: A list of instance types (only the first is used).
*   `root_volume_type`, `root_volume_size`, `root_volume_encrypted`: Configure the root EBS volume.

### 4.3 Security Group

The security group allows inbound traffic on ports 80 (HTTP), 443 (HTTPS), and 22 (SSH) from anywhere.  **This should be tightened for production environments.**

### 4.4 Tags

All resources are tagged with common tags and project-specific tags for better organization and identification.


## 5. cloud-init.sh Analysis

The `cloud-init.sh` script performs the following actions:

1.  **Logging:** Sets up logging to `/opt/cloud-init.vm.log`.
2.  **Internet Connectivity Check:** Verifies internet access.
3.  **Package Updates:** Updates and upgrades system packages.
4.  **Package Installation:** Installs `wget`, `curl`, `net-tools`, `iproute2`, Node.js v20 LTS, Deno 2.0, Bun, Docker, and the AWS CLI.
5.  **Environment Variable Export:** Exports environment variables from Terraform variables to `/home/ubuntu/.env.vm` and adds them to `.bashrc`.
6.  **Permissions:** Sets appropriate permissions for `/home/ubuntu/.env.vm`.

**Expected Outcomes:** After execution, the instance will have the specified packages installed, and the environment variables will be set.

**Dependencies:** The script relies on internet connectivity and the `apt` package manager.


## 6. Deployment Workflow

1.  **Initialize Terraform:** `terraform init`
2.  **Plan the deployment:** `terraform plan`
3.  **Apply the configuration:** `terraform apply`
4.  **Verify deployment:** Check the outputs for the instance ID and public IP.

**Estimated Deployment Time:** Approximately 5-10 minutes, depending on AWS infrastructure availability.


## 7. Post-Deployment

After successful deployment, a single EC2 instance will be running with the specified software installed.

**Verification:**

*   Check the instance status in the AWS console.
*   Connect to the instance via SSH using the private key generated by Terraform.
*   Verify that the `cloud-init.sh` script completed successfully by checking the log file.

**Access:** Access the instance via SSH using the private key located at `${path.module}/${var.project_name}.pem`.


## 8. Maintenance and Updates

To update the configuration, modify the Terraform files and run `terraform plan` and `terraform apply`.

**Backups:** Regularly back up the instance and the Terraform state file.

**Scaling:** This configuration is for a single instance.  For scaling, consider using an Auto Scaling Group (ASG).

**Modifications:**  Always test changes in a non-production environment before deploying to production.


## 9. Troubleshooting

*   **Connection Issues:** Check the security group rules and ensure SSH is allowed.
*   **Script Errors:** Check the `/opt/cloud-init.vm.log` file for errors.
*   **AWS Console:** Use the AWS console to troubleshoot any issues with the deployed resources.


**Note:**  This configuration assumes you have an existing VPC and Internet Gateway.  The security group rules are very permissive and should be tightened for production use.  Consider using a more secure method for managing AWS credentials.  The AMI ID should be updated to match your desired region.  The default values for many variables are placeholders and should be replaced with your actual values.
