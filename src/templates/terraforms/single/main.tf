terraform {
  # NOTE: This block defines the required providers for this Terraform configuration.
  # It's essential for Terraform to function correctly.
  required_providers {
    aws = {
      # NOTE: Specifies the AWS provider to use, along with its source and version constraint.
      # This ensures compatibility and allows Terraform to manage AWS resources.
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  # NOTE: Configures the AWS provider with credentials and region.
  # These values are sourced from variables defined in 'variables.tf'.
  profile    = var.aws_profile
  region     = var.aws_region
  access_key = var.aws_access_key
  secret_key = var.aws_secret_key
}

# Reuse existing VPC.  This assumes a VPC already exists with the CIDR block specified in 'variables.tf'.
resource "aws_vpc" "VPC" {
  cidr_block = var.vpc_cidr
  
  # NOTE: This resource references an existing VPC.  The 'vpc_id' variable in 'variables.tf' should be set to the ID of the existing VPC.
  tags = {
    # NOTE: Tags the VPC resource for easier identification and management.
    "Name" = "VPC"
  }
  
  # TODO: Add error handling or alternative logic if the VPC does not exist.
}

# Reuse existing Internet Gateway.  This assumes an internet gateway already exists and is associated with the VPC.
resource "aws_internet_gateway" "InternetGateway" {
  vpc_id = aws_vpc.VPC.id

  # NOTE: Attaches the internet gateway to the VPC.  It relies on the 'aws_vpc.VPC' resource defined earlier in this file.
  tags   = {
    # NOTE: Tags the internet gateway resource for easier identification and management.
    "Name" = "InternetGateway"
  }
  
  # TODO: Add error handling or alternative logic if the internet gateway does not exist or cannot be attached.
}
