locals {
  # instance_types = jsondecode(var.instance_types)
  instance_types = var.instance_types
  # NOTE: This local variable defines the instance types to be used for the EC2 instance.
  # It uses the value provided in the 'instance_types' variable.
}

resource "aws_instance" "vm_instance" {
  # NOTE: This resource creates an AWS EC2 instance.
  # It uses the AMI ID specified in 'var.ami_id', the first instance type from 'var.instance_types', and the key pair defined in 'key.tf'.
  # The instance is associated with the security group defined in 'aws_security_group.web_sg' and the subnet defined in 'subnets.tf'.
  ami           = var.ami_id
  instance_type = var.instance_types[0]  # Base instance type
  
  key_name      = aws_key_pair.dt_keypair.id

  vpc_security_group_ids = [aws_security_group.web_sg.id]
  
  # NOTE: This block configures the network settings for the EC2 instance.
  # It specifies the security group and subnet IDs.
  subnet_id              = aws_subnet.main.id
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name

  root_block_device {
    # NOTE: This block configures the root block device for the EC2 instance.
    # It specifies the volume type, size, and encryption settings.
    volume_type = var.root_volume_type
    volume_size = var.root_volume_size
    encrypted   = var.root_volume_encrypted
  }

  tags = merge(
    var.common_tags,
    {
      # NOTE: This block defines the tags for the EC2 instance.  It merges common tags with project-specific tags.
      Name = "${var.project_name}-vm"
      Args = "• ${var.node_env} • ${var.project_name} • ${var.aws_profile} • ${var.aws_region} • ${var.bitbucket_workspace} • ${var.bitbucket_branch}"
    }
  )

  # NOTE: This block defines the user data script that will be executed when the instance is launched.
  # It uses the 'cloud-init.sh' script located in the same directory.
  user_data = base64encode(templatefile("${path.module}/cloud-init.sh", {
    node_env               = var.node_env
    aws_profile            = var.aws_profile
    aws_region             = var.aws_region
    aws_access_key         = var.aws_access_key
    aws_secret_key         = var.aws_secret_key
    bitbucket_app_password = var.bitbucket_app_password
    bitbucket_workspace    = var.bitbucket_workspace
    bitbucket_branch       = var.bitbucket_branch
    ecr_repository_name    = var.ecr_repository_name
    # NOTE: These variables are passed to the cloud-init script.  They contain environment-specific information.
  }))
}

resource "aws_security_group" "web_sg" {
  # NOTE: This resource creates an AWS security group.
  # It allows inbound traffic based on the rules defined in 'var.ingress_rules' and allows all outbound traffic.
  name        = "${var.project_name}-sg"
  description = "Allow inbound traffic for web server"
  vpc_id      = aws_vpc.VPC.id

  # NOTE: These commented-out ingress rules demonstrate how to define individual ingress rules.
  # The dynamic block below provides a more flexible approach.

  # ingress {
  #   description = "HTTP from anywhere"
  #   from_port   = 80
  #   to_port     = 80
  #   protocol    = "tcp"
  #   cidr_blocks = ["0.0.0.0/0"]
  # }

  # ingress {
  #   description = "HTTPS from anywhere"
  #   from_port   = 443
  #   to_port     = 443
  #   protocol    = "tcp"
  #   cidr_blocks = ["0.0.0.0/0"]
  # }

  # ingress {
  #   description = "SSH from anywhere"
  #   from_port   = 22
  #   to_port     = 22
  #   protocol    = "tcp"
  #   cidr_blocks = ["0.0.0.0/0"]
  # }
  
  # Dynamic ingress
  dynamic "ingress" {
    for_each = var.ingress_rules
    content {
      # NOTE: This dynamic block iterates over the 'var.ingress_rules' variable to define multiple ingress rules dynamically.
      description = ingress.value.description
      from_port   = ingress.value.from_port
      to_port     = ingress.value.to_port
      protocol    = ingress.value.protocol
      cidr_blocks = ingress.value.cidr_blocks
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    # NOTE: This block defines the egress rule, allowing all outbound traffic.
  }

  tags = merge(
    var.common_tags,
    {
      # NOTE: This block defines the tags for the security group.  It merges common tags with project-specific tags.
      Name = "${var.project_name}-sg"
    }
  )

  # TODO: Review and tighten security group rules to minimize the attack surface.  Consider using principle of least privilege.
}
