variable "project_name" {
  # NOTE: This variable defines the name of the project.
  # It is used throughout the Terraform configuration to identify resources related to this specific project.
  description = "The name of the project"
  type        = string
  default     = "single"
}

variable "node_env" {
  # NOTE: This variable specifies the Node environment.
  # It's used to configure application settings (not directly used in this Terraform configuration).
  description = "Node environment (e.g., development, production)"
  type        = string
  # default     = "development"
}

variable "aws_profile" {
  # NOTE: This variable specifies the AWS profile to use for authentication.
  # It should be configured in the user's AWS credentials file (~/.aws/credentials).
  description = "The AWS profile to use"
  type        = string
  # default     = "unknown"
}

variable "aws_region" {
  # NOTE: This variable specifies the AWS region where the infrastructure will be deployed.
  # It affects resource naming and availability.
  description = "The AWS region to deploy to"
  type        = string
  # default     = "us-east-2"
}

variable "aws_access_key" {
  # NOTE: This variable should contain the AWS access key ID.
  # It's crucial for authentication and should be kept secure.
  # TODO: Replace with a secure method of providing AWS credentials (e.g., environment variables or AWS Secrets Manager).
  description = "AWS Access Key"
  type        = string
  # default     = "UNKOWN AWS ACCESS KEY"
}

variable "aws_secret_key" {
  # NOTE: This variable should contain the AWS secret access key.
  # It's crucial for authentication and should be kept secure.
  # TODO: Replace with a secure method of providing AWS credentials (e.g., environment variables or AWS Secrets Manager).
  description = "AWS Secret Key"
  type        = string
  # default     = "UNKOWN AWS SECRET KEY"
}

variable "vpc_id" {
  # NOTE: This variable specifies the ID of an existing VPC.
  # If not provided, a new VPC will need to be created (not currently supported in this configuration).
  # TODO: Add support for creating a new VPC if vpc_id is not provided.
  description = "The ID of the existing VPC"
  type        = string
  # default     = "UNKOWN_VPC_ID"
}

variable "igw_id" {
  # NOTE: This variable specifies the ID of an existing internet gateway.  It's used to connect the VPC to the internet.
  # If not provided, a new internet gateway will need to be created (not currently supported in this configuration).
  # TODO: Add support for creating a new internet gateway if igw_id is not provided.
  description = "The ID of the existing Internet Gateway"
  type        = string
  # default     = "UNKOWN_IGW_ID"
}

# Single Instance does not required ELB/ALB which depends on SSL Certificate
# variable "ssl_certificate_arn" {
#   description = "The ARN of the SSL certificate for HTTPS listener within the LoadBalancer"
#   type        = string
#   # example: "arn:aws:acm:us-east-2:123456789012:certificate/12345678-1234-1234-1234-123456789012"
#   # default     = "UNKOWN_SSL_CERTIFICATE_ARN"
# }

variable "bitbucket_app_password" {
  # NOTE: This variable stores the Bitbucket App Password or API key used for authentication with the Bitbucket API.
  # It will use for deployment automation.
  # It's use a secure method for storing this credential, such as environment variables.
  description = "BitBucket App Password or API Key"
  type        = string
  # default     = "UNKOWN BITBUCKET APP PASSWORD OR API KEY"
}

variable "bitbucket_workspace" {
  # NOTE: This variable specifies the Bitbucket workspace where the repository is located.
  # It will use for deployment automation.
  description = "BitBucket Workspace"
  type        = string
  # default     = "UNKOWN_BITBUCKET_WORKSPACE"
}

variable "bitbucket_branch" {
  # NOTE: This variable specifies the Bitbucket branch to deploy from.
  # It will use for deployment automation.
  description = "BitBucket Branch for initial infrastructure creation or deployment"
  type        = string
  # default     = "UNKOWN_BITBUCKET_BRANCH"
}

variable "ecr_repository_name" {
  # NOTE: This variable specifies the ECR repository name to deploy from.
  # It will use for deployment automation.
  description = "ECR Repository Name"
  type        = string
  # default     = "UNKOWN_ECR_REPOSITORY_NAME"
}

variable "vpc_cidr" {
  # NOTE: This variable defines the CIDR block for the VPC.  It's used for IP address allocation within the VPC.
  description = "VPC CIDR"
  type = string
  default = "10.0.0.0/16"
}

variable "ami_id" {
  # NOTE: This variable specifies the Amazon Machine Image (AMI) ID to use for creating the EC2 instance.
  # The default AMI is for Ubuntu 22.04 LTS in us-east-1.  This should be updated to match the desired AMI for the target region.
  # TODO:  Make this AMI ID configurable based on the aws_region variable.
  description = "The AMI ID to use for the EC2 instance (Ubuntu x64 22.04 LTS)"
  type        = string
  # This is the AMI ID for Ubuntu 22.04 LTS in us-east-1. Update for your region.
  default     = "ami-0430580de6244e02e"
}

# For Auto Scaling Group require 1 or more instance types, Single Instance will use first element
variable "instance_types" {
  # NOTE: This variable provides a list of instance types.
  # For a single instance deployment, only the first element will be used.
  description = "List of instance types for mixed instances policy"
  type        = list(string)
  default     = ["t2.micro", "t2.small", "t2.medium"]
}

variable "subnet_cidr" {
  # NOTE: This variable defines the CIDR block for the subnet within the VPC.
  description = "The CIDR block for the subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "availability_zone" {
  # NOTE: This variable specifies the availability zone for the subnet.
  description = "The availability zone for the subnet"
  type        = string
  default     = "us-west-2a"
}

variable "map_public_ip" {
  # NOTE: This variable determines whether the EC2 instance should be assigned a public IP address.
  description = "Specify if instances in the subnet should be assigned a public IP address"
  type        = bool
  default     = true
}

variable "root_volume_type" {
  # NOTE: This variable specifies the type of EBS volume for the root device.
  description = "The type of volume for the root block device"
  type        = string
  default     = "gp3"
}

variable "root_volume_size" {
  # NOTE: This variable specifies the size of the root volume in GB.
  description = "The size of the volume in gigabytes for the root block device"
  type        = number
  default     = 30
}

variable "root_volume_encrypted" {
  # NOTE: This variable enables encryption for the root volume.
  description = "Enables EBS encryption on the volume for the root block device"
  type        = bool
  default     = true
}

variable "ingress_rules" {
  # NOTE: This variable defines the ingress rules for the security group associated with the EC2 instance.
  # It allows HTTP, HTTPS, and SSH traffic from anywhere.
  description = "List of ingress rules for the security group"
  type = list(object({
    description = string
    from_port   = number
    to_port     = number
    protocol    = string
    cidr_blocks = list(string)
  }))

  # TODO:  Restrict the CIDR blocks to more specific ranges for enhanced security.
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

variable "common_tags" {
  # NOTE: This variable defines common tags applied to all resources created by this Terraform configuration.
  # This helps with organization and resource identification.
  description = "Common tags to be applied to all resources"
  type        = map(string)
  default = {
    DeploymentType = "SingleInstance"
    DeployEngine   = "DeployThis"
  }
}
