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

variable "log_group_name" {
  default = "/ecs/io_template_service-stg-log-group"
}

variable "subnet_1_cidr" {
  default = "10.0.1.0/24"
}

variable "subnet_2_cidr" {
  default = "10.0.2.0/24"
}

variable "availability_zone_1" {
  default = "us-west-2a"
}

variable "availability_zone_2" {
  default = "us-west-2b"
}

variable "route_table_cidr" {
  default = "0.0.0.0/0"
}

variable "ecs_task_execution_role_name" {
  default = "ecsTaskExecutionRoleAdminStg"
}

variable "ecs_task_family" {
  default = "io-template-task-stg"
}

variable "container_name" {
  default = "io-template-container"
}

variable "container_image" {
  default = "aaa"
}

variable "service_name" {
  default = "io_service"
}

variable "db_client" {
  default = "mysql"
}

variable "db_host" {
  default = "localhost"
}

variable "db_port" {
  default = "3306"
}

variable "db_database" {
  default = "test"
}

variable "db_user" {
  default = "root"
}

variable "ecs_service_name" {
  default = "io-template-service"
}

variable "alb_sg_ingress_ip" {
  default = "108.137.125.145/32"
}

variable "alb_name" {
  default = "io-template-stg-alb"
}

variable "target_group_name" {
  default = "io-template-target-group-stg"
}

variable "ecs_sg_io_template_stg" {
  default = "ecs_sg_io_template_stg"
}

variable "alb_sg_io_template" {
  default = "alb_sg_io_template"
}