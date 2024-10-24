output "vpc_id" {
  # NOTE: This output provides the ID of the VPC created or referenced in the 'main.tf' file.
  description = "The ID of the VPC"
  value       = aws_vpc.VPC.id
}

output "subnet_id" {
  # NOTE: This output provides the ID of the subnet created in 'subnets.tf'.
  # This subnet is associated with the VPC and the route table.
  description = "The ID of the subnet"
  value       = aws_subnet.main.id
}

output "instance_id" {
  # NOTE: This output provides the ID of the EC2 instance created in 'instance.tf'.
  description = "The ID of the EC2 instance"
  value       = aws_instance.vm_instance.id
}

output "public_ip" {
  # NOTE: This output provides the public IP address of the EC2 instance.
  # This will only be available if 'map_public_ip' in 'variables.tf' is set to 'true'.
  description = "The public IP address of the EC2 instance"
  value       = aws_instance.vm_instance.public_ip
}

output "security_group_id" {
  # NOTE: This output provides the ID of the security group defined in 'instance.tf'.
  # This security group controls inbound and outbound traffic for the EC2 instance.
  description = "The ID of the security group"
  value       = aws_security_group.web_sg.id
}

output "local_file" {
  # NOTE: This output provides the path to the PEM file containing the private key generated in 'key.tf'.
  # This file is used to connect to the EC2 instance via SSH.
  description = "The PEM file for the private key"
  value       = local_file.dt_rsa_private.filename
}
