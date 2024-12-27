variable "project_name" {
  description = "The name of the project"
  type        = string
  default     = "autoscaling"
}

variable "deployment_type" {
  description = "The deployment type (single or asg)"
  type        = string
  default     = "single"
}

variable "node_env" {
  description = "Node environment (e.g., staging, production)"
  type        = string
  # default     = "staging"
}

variable "std_user" {
  description = "The standard user to use for the EC2 instance"
  type        = string
  default     = "ubuntu"
}

variable "aws_profile" {
  description = "The AWS profile to use"
  type        = string
  # default     = "unknown"
}

variable "aws_account_id" {
  description = "The AWS account ID"
  type        = string
  # default     = "UNKOWN AWS ACCOUNT ID"
}

variable "aws_region" {
  description = "The AWS region to deploy to"
  type        = string
  
  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]$", var.aws_region))
    error_message = "AWS region must be valid (e.g., us-east-2, eu-west-1)."
  }
}

variable "aws_access_key" {
  description = "AWS Access Key"
  type        = string
  # default     = "UNKOWN AWS ACCESS KEY"
}

variable "aws_secret_key" {
  description = "AWS Secret Key"
  type        = string
  # default     = "UNKOWN AWS SECRET KEY"
}

variable "vpc_id" {
  description = "The ID of the existing VPC"
  type        = string
  # default     = "UNKOWN_VPC_ID"
}

variable "igw_id" {
  description = "The ID of the existing Internet Gateway"
  type        = string
  # default     = "UNKOWN_IGW_ID"
}

# variable "ecr_registry" {
#   description = "The ECR registry"
#   type        = string
# }

# variable "ecr_repository_name" {
#   description = "The name of the ECR repository"
#   type        = string
# }

variable "ami_id" {
  description = "The AMI ID to use for the EC2 instance (Ubuntu x64 22.04 LTS)"
  type        = string
  # This is the AMI ID for Ubuntu 22.04 LTS 64-bit (x86), HVM), EBS General Purpose (SSD)
  # us-east-2: ami-0ea3c35c5c3284d82  created 2024-09-30T12:23:14.000Z
  # us-west-1: ami-0da424eb883458071  created 2024-09-30T12:22:45.000Z
  default     = "ami-0da424eb883458071"
}

# For Auto Scaling Group require 1 or more instance types, Single Instance will use first element
variable "instance_types" {
  description = "List of instance types for mixed instances policy"
  type        = list(string)
  default     = ["t2.micro", "t2.small", "t2.medium"]
}

# AutoScaling Group Instance does required ELB/ALB which depends on SSL Certificate
variable "ssl_certificate_arn" {
  description = "The ARN of the SSL certificate for HTTPS listener within the LoadBalancer"
  type        = string
  # example: "arn:aws:acm:us-east-2:123456789012:certificate/12345678-1234-1234-1234-123456789012"
  # default     = "UNKOWN_SSL_CERTIFICATE_ARN"
}

variable "vpc_cidr" {
  description = "VPC CIDR"
  type = string
  default = "10.0.0.0/16"
}

# variable "subnet_ids" {
#   description = "The IDs of the subnets to deploy to"
#   type        = list(string)
# }

variable "public_subnet_cidrs" {
  description = "The CIDR blocks for the public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "availability_zones" {
  description = "The availability zones to use"
  type        = list(string)
  default     = ["us-east-2a", "us-east-2b"]

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least two availability zones must be specified for high availability."
  }

  validation {
    condition     = alltrue([for az in var.availability_zones : can(regex("^[a-z]{2}-[a-z]+-\\d[a-z]$", az))])
    error_message = "Availability zones must be valid AWS availability zone names (e.g., us-east-2a)."
  }
}

variable "bitbucket_username" {
  description = "BitBucket Username"
  type        = string
  # default     = "UNKOWN BITBUCKET USERNAME"
}

variable "bitbucket_app_password" {
  description = "BitBucket App Password or API Key"
  type        = string
  # default     = "UNKOWN BITBUCKET APP PASSWORD OR API KEY"
}

variable "bitbucket_workspace" {
  description = "BitBucket Workspace"
  type        = string
  # default     = "UNKOWN_BITBUCKET_WORKSPACE"
}

variable "bitbucket_branch" {
  description = "BitBucket Branch for initial infrastructure creation or deployment"
  type        = string
  # default     = "UNKOWN_BITBUCKET_BRANCH"
}

variable "map_public_ip" {
  description = "Specify if instances should be assigned a public IP address"
  type        = bool
  default     = true
}

variable "root_volume_type" {
  description = "The type of volume for the root block device"
  type        = string
  default     = "gp3"
}

variable "root_volume_size" {
  description = "The size of the volume in gigabytes for the root block device"
  type        = number
  default     = 30
}

variable "root_volume_encrypted" {
  description = "Enables EBS encryption on the volume for the root block device"
  type        = bool
  default     = true
}

variable "app_port" {
  description = "The port the application runs on"
  type        = number
  default     = 3000
}

variable "base_capacity" {
  description = "Number of instances to launch with base instance type"
  type        = number
  default     = 1
}

variable "asg_desired_capacity" {
  description = "The desired number of EC2 instances in the ASG"
  type        = number
  default     = 1
}

variable "asg_min_size" {
  description = "The minimum number of EC2 instances in the ASG"
  type        = number
  default     = 1
}

variable "asg_max_size" {
  description = "The maximum number of EC2 instances in the ASG"
  type        = number
  default     = 2
}

variable "asg_cpu_target" {
  description = "The target CPU utilization for the ASG"
  type        = number
  default     = 90
}

variable "asg_ram_target" {
  description = "The target RAM utilization for the ASG"
  type        = number
  default     = 97
}

variable "asg_health_check_path" {
  description = "The path for the health check"
  type        = string
  default     = "/"
}

variable "asg_health_check_interval" {
  description = "The interval for the health check"
  type        = number
  default     = 300
}

variable "asg_health_check_timeout" {
  description = "The timeout for the health check"
  type        = number
  default     = 15
}

variable "asg_health_check_healthy_threshold" {
  description = "The healthy threshold for the health check"
  type        = number
  default     = 3
}

variable "asg_health_check_unhealthy_threshold" {
  description = "The unhealthy threshold for the health check"
  type        = number
  default     = 10
}

variable "asg_health_check_matcher" {
  description = "The matcher for the health check"
  type        = string
  default     = "200,302,301"
}

variable "common_tags" {
  description = "Common tags to be applied to all resources"
  type        = map(string)
  default = {
    DeploymentType = "SingleInstance"
    DeployEngine   = "DeployThis"
  }
}

variable "health_check_path" {
  description = "The path for the health check"
  type        = string
  default     = "/"
}

variable "ingress_rules" {
  description = "List of ingress rules for the EC2 security group"
  type = list(object({
    description = string
    from_port   = number
    to_port     = number
    protocol    = string
    cidr_blocks = list(string)
  }))
  default = [
    {
      description = "HTTP from anywhere"
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    },
    {
      description = "HTTPS from anywhere"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    },
    {
      description = "SSH from anywhere"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  ]
}

# Add other variables as needed from the original variables.tf file
