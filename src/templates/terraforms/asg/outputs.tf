# VPC and Network outputs
output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.VPC.id
}

output "vpc_cidr" {
  description = "The CIDR block of the VPC"
  value       = aws_vpc.VPC.cidr_block
}

output "internet_gateway_id" {
  description = "The ID of the Internet Gateway"
  value       = aws_internet_gateway.InternetGateway.id
}

output "public_subnet_ids" {
  description = "The IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "public_subnet_cidrs" {
  description = "The CIDR blocks of the public subnets"
  value       = aws_subnet.public[*].cidr_block
}

# Security Group outputs
output "alb_security_group_id" {
  description = "The ID of the ALB security group"
  value       = aws_security_group.alb.id
}

output "ec2_security_group_id" {
  description = "The ID of the EC2 security group"
  value       = aws_security_group.ec2.id
}

# Load Balancer outputs
output "alb_id" {
  description = "The ID of the Application Load Balancer"
  value       = aws_lb.app.id
}

output "alb_arn" {
  description = "The ARN of the Application Load Balancer"
  value       = aws_lb.app.arn
}

output "alb_dns_name" {
  description = "The DNS name of the Application Load Balancer"
  value       = aws_lb.app.dns_name
}

output "alb_zone_id" {
  description = "The canonical hosted zone ID of the Application Load Balancer"
  value       = aws_lb.app.zone_id
}

# Target Group outputs
output "target_group_arn" {
  description = "The ARN of the Target Group"
  value       = aws_lb_target_group.app.arn
}

output "target_group_name" {
  description = "The name of the Target Group"
  value       = aws_lb_target_group.app.name
}

# Auto Scaling Group outputs
output "asg_id" {
  description = "The ID of the Auto Scaling Group"
  value       = aws_autoscaling_group.app.id
}

output "asg_name" {
  description = "The name of the Auto Scaling Group"
  value       = aws_autoscaling_group.app.name
}

output "asg_arn" {
  description = "The ARN of the Auto Scaling Group"
  value       = aws_autoscaling_group.app.arn
}

# Launch Template outputs
output "launch_template_id" {
  description = "The ID of the Launch Template"
  value       = aws_launch_template.app.id
}

output "launch_template_arn" {
  description = "The ARN of the Launch Template"
  value       = aws_launch_template.app.arn
}

output "launch_template_latest_version" {
  description = "The latest version of the Launch Template"
  value       = aws_launch_template.app.latest_version
}

# IAM outputs
output "ec2_role_name" {
  description = "The name of the EC2 IAM role"
  value       = aws_iam_role.ec2_role.name
}

output "ec2_role_arn" {
  description = "The ARN of the EC2 IAM role"
  value       = aws_iam_role.ec2_role.arn
}

# EC2 Key Pair outputs
output "key_pair_name" {
  description = "The name of the key pair"
  value       = aws_key_pair.dt_keypair.key_name
}

output "key_pair_id" {
  description = "The ID of the key pair"
  value       = aws_key_pair.dt_keypair.key_pair_id
}

output "private_key_file" {
  description = "The path to the private key PEM file"
  value       = local_file.dt_rsa_private.filename
}

# ECR outputs
output "ecr_repository_url" {
  description = "The URL of the ECR repository"
  value       = aws_ecr_repository.app_repo.repository_url
}

output "ecr_repository_arn" {
  description = "The ARN of the ECR repository"
  value       = aws_ecr_repository.app_repo.arn
}

# S3 outputs
output "artifacts_bucket_name" {
  description = "The name of the S3 bucket for artifacts"
  value       = aws_s3_bucket.artifacts.id
}

output "artifacts_bucket_arn" {
  description = "The ARN of the S3 bucket for artifacts"
  value       = aws_s3_bucket.artifacts.arn
}

# output "instance_ids" {
#   description = "A list of IDs of the EC2 instances"
#   # value       = aws_instance.vm_instance.*.id
#   value       = aws_autoscaling_group.app.instance_ids
# }

# output "public_ips" {
#   description = "A list of public IP addresses of the EC2 instances"
#   # value       = aws_instance.vm_instance.*.public_ip
#   value       = aws_autoscaling_group.app.instances.*.public_ip
# }
