# Terraform Multiple Instances Deployment
## Auto Scaling Group with Application Load Balancer - Terraform Configuration

This document provides a comprehensive guide to the Terraform configuration located in the `src/templates/terraforms/asg/` directory. This configuration automates the deployment of an AWS Auto Scaling Group (ASG) with an Application Load Balancer (ALB) for managing and scaling EC2 instances.

## 1. Project Overview

This Terraform configuration automates the deployment of a highly available and scalable application infrastructure on AWS. It utilizes an Auto Scaling Group to manage EC2 instances, an Application Load Balancer to distribute traffic, and associated security groups and subnets.  The architecture is designed for a multiple-instances form as Auto Scaling Group setup.

**Target Infrastructure Architecture:**

The architecture consists of:

* **VPC:** A Virtual Private Cloud (VPC) to isolate the infrastructure.
* **Subnets:** Public subnets for the EC2 instances and ALB.
* **Internet Gateway:** An Internet Gateway to allow internet access.
* **Security Groups:** Security groups to control network traffic.
* **Application Load Balancer (ALB):** Distributes incoming traffic across the EC2 instances.
* **Auto Scaling Group (ASG):** Manages the lifecycle of EC2 instances, ensuring high availability and scalability.
* **EC2 Instances:** The compute instances running the application.
* **Key Pair:**  Used for SSH access to the EC2 instances.
* **CloudWatch Alarms:** Monitor CPU utilization and trigger scaling actions.
* **SSM Parameter:** Stores the current instance type for tracking purposes.

**Key Components and Resources Being Provisioned:**

* AWS VPC
* AWS Subnets (Public)
* AWS Internet Gateway
* AWS Security Groups (for ALB and EC2 instances)
* AWS Application Load Balancer (ALB)
* AWS Autoscaling Group (ASG)
* AWS Launch Template
* AWS Key Pair
* AWS CloudWatch Metric Alarms
* AWS SSM Parameter


## 2. Prerequisites

* **Terraform Version:**  `~> 5.0` (as specified in `main.tf`)
* **AWS Provider Version:** `~> 5.0` (as specified in `main.tf`)
* **AWS Credentials:**  You need valid AWS credentials configured.  The configuration uses the profile specified in the `aws_profile` variable.  Alternatively, you can provide `aws_access_key` and `aws_secret_key` directly.
* **Permissions:**  The AWS user or role must have sufficient permissions to create and manage the resources defined in this configuration (VPCs, subnets, security groups, load balancers, auto scaling groups, EC2 instances, etc.).
* **Dependencies:**  This configuration assumes the existence of an AWS account and requires the AWS CLI to be installed on the machine where the `cloud-init.sh` script will run.


## 3. File Structure

The `src/templates/terraforms/asg/` directory contains the following files:

* **`main.tf`:** The main Terraform configuration file.  This file defines the providers, VPC, and Internet Gateway.
* **`variables.tf`:** Defines the input variables for the configuration.
* **`alb.tf`:** Configures the Application Load Balancer (ALB), listeners, and target group.
* **`asg.tf`:** Configures the Auto Scaling Group (ASG), launch template, and scaling policies.
* **`security_groups.tf`:** Defines the security groups for the ALB and EC2 instances.
* **`subnets.tf`:** Defines the public subnets and route tables.
* **`key.tf`:** Manages the creation and storage of the SSH key pair.
* **`outputs.tf`:** Defines the output values, such as the ASG name and ALB DNS name.
* **`cloud-init.sh`:** A user-data script that runs on the EC2 instances after launch.


## 4. Configuration Details

### 4.1 Network Setup and Security Configurations

The configuration uses a VPC with public subnets.  Security groups are defined to control inbound and outbound traffic. The ALB security group allows HTTP and HTTPS traffic from anywhere, while the EC2 instance security group allows HTTP traffic only from the ALB.

### 4.2 Instance Specifications and Configurations

The EC2 instances are launched using a launch template. The instance type, AMI ID, key name, and root volume configuration are defined as variables.  The `cloud-init.sh` script is used to configure the instances after launch.

### 4.3 Tags and Naming Conventions

The configuration uses tags to organize and identify resources.  A common set of tags is defined in the `common_tags` variable.  Resources are named using a consistent naming convention based on the `project_name` variable.

## 5. `cloud-init.sh` Analysis

The `cloud-init.sh` script performs the following actions:

1. **Logging:** Sets up logging to `/opt/cloud-init.vm.log`.
2. **Connectivity Check:** Checks for internet connectivity.
3. **Package Updates:** Updates and upgrades the system packages.
4. **Package Installation:** Installs Node.js, Deno, Bun, Docker, and the AWS CLI.
5. **Environment Variable Setup:** Sets up environment variables from the provided variables in the Terraform configuration and stores them in `/home/ubuntu/.env.vm`.  These variables are then sourced into the user's `.bashrc` file for persistence.
6. **Permissions:** Sets correct ownership and permissions for the `.env.vm` file.

**Expected Outcomes:** After script execution, the EC2 instance will have Node.js, Deno, Bun, Docker, and the AWS CLI installed, and the environment variables will be set.

## 6. Deployment Workflow

1. **Initialize Terraform:** `terraform init`
2. **Plan the deployment:** `terraform plan`
3. **Apply the configuration:** `terraform apply`

**Expected Behavior:** The deployment will create the VPC, subnets, security groups, ALB, ASG, and EC2 instances.

**Estimated Deployment Time:**  The deployment time will vary depending on the AWS region and instance type.  Expect it to take several minutes.

## 7. Post-Deployment

**Expected State:** After successful deployment, you will have a running ASG with one or more EC2 instances behind an ALB.

**Verification:**

* Verify the ASG status in the AWS console.
* Check the ALB DNS name and access the application.
* Check the CloudWatch metrics for CPU utilization.

**Access Methods:** Access the EC2 instances using the key pair and the public IP address.  The ALB DNS name can be used to access the application.

## 8. Maintenance and Updates

**Updating Configurations:** To update the configuration, make the necessary changes to the Terraform files and run `terraform apply`.

**Backup Considerations:** Regularly back up your Terraform state file.

**Scaling Considerations:**  The ASG can be scaled by modifying the `asg_min_size`, `asg_max_size`, and `asg_desired_capacity` variables.

**Best Practices:**  Follow AWS best practices for security and resource management.

## 9. Troubleshooting

**Common Issues:**

* **Network connectivity issues:** Check the security group rules and subnet configurations.
* **ASG issues:** Check the ASG health status and logs.
* **ALB issues:** Check the ALB health status and logs.

**Debug Tips:** Use `terraform plan` to review changes before applying them.  Check the AWS console for error messages.

**Logs:** Check the CloudWatch logs for the ALB and EC2 instances.  Also check the `/opt/cloud-init.vm.log` file on the EC2 instances for cloud-init script logs.

**Support Resources:** Refer to the AWS documentation for troubleshooting and support.
