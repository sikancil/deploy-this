variable "project_name" {
    description = "IO-STAGING"
    type = string
    default = "IO-STAGING"
}

variable "region" {
    description = "us-west-2"
    default = "us-west-2"
}

variable "ssl" {
    description = "arn:aws:acm:region:aws_account:certificate/ffff3f"
    default = "arn:aws:acm:region:aws_account:certificate/ffff3f"
}

provider "aws" {
  region = "${var.region}"
  profile= "io_staging"
}