# Main Terraform configuration file

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  profile    = var.aws_profile
  region     = var.aws_region
  access_key = var.aws_access_key
  secret_key = var.aws_secret_key
}

# Reuse existing VPC
resource "aws_vpc" "VPC" {
  cidr_block = var.vpc_cidr
  tags = {
    "Name" = "VPC"
  }
}

# Reuse existing Internet Gateway
resource "aws_internet_gateway" "InternetGateway" {
  vpc_id = aws_vpc.VPC.id
  tags   = {
    "Name" = "InternetGateway"
  }
}
