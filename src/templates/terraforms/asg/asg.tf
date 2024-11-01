locals {
  # instance_types = jsondecode(var.instance_types)
  instance_types = var.instance_types
}

# Auto Scaling Group and related resources
resource "aws_launch_template" "app" {
  name_prefix   = "${var.project_name}-asg-lt-"
  image_id      = var.ami_id
  instance_type = var.instance_types[0]  # Base instance type
  key_name      = aws_key_pair.dt_keypair.id

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_profile.name
  }

  # vpc_security_group_ids = [aws_security_group.ec2.id]

  network_interfaces {
    # associate_public_ip_address = true
    associate_public_ip_address = var.map_public_ip
    security_groups             = [aws_security_group.ec2.id]
  }

  monitoring {
    enabled = true
  }

  block_device_mappings {
    device_name = "/dev/sda1"

    ebs {
      volume_size           = var.root_volume_size
      volume_type           = var.root_volume_type
      delete_on_termination = true
      encrypted             = var.root_volume_encrypted
    }
  }

  user_data = base64encode(templatefile("${path.module}/cloud-init.sh", {
    node_env               = var.node_env
    project_name           = var.project_name
    aws_profile            = var.aws_profile
    aws_account_id         = var.aws_account_id
    aws_region             = var.aws_region
    aws_access_key         = var.aws_access_key
    aws_secret_key         = var.aws_secret_key
    codedeploy_app_name    = var.codedeploy_app_name
    codedeploy_group_name  = var.codedeploy_group_name
    codedeploy_s3_bucket   = var.codedeploy_s3_bucket
    ecr_registry           = var.ecr_registry
    ecr_repository_name    = var.ecr_repository_name
    bitbucket_app_password = var.bitbucket_app_password
    bitbucket_workspace    = var.bitbucket_workspace
    bitbucket_branch       = var.bitbucket_branch
  }))

  tag_specifications {
    resource_type = "instance"
    tags = merge(
      var.common_tags,
      {
        Name = var.project_name
        Environment = var.node_env
        Project = var.project_name
        Profile = var.aws_profile
        Region = var.aws_region
        Workspace = var.bitbucket_workspace
        Branch = var.bitbucket_branch
      }
    )
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_autoscaling_group" "app" {
  name                = "${var.project_name}-asg"
  desired_capacity    = var.asg_desired_capacity
  max_size            = var.asg_max_size
  min_size            = var.asg_min_size
  target_group_arns   = [aws_lb_target_group.app.arn]

  vpc_zone_identifier = aws_subnet.public[*].id
  # vpc_zone_identifier = data.aws_subnets.default.ids

  health_check_type         = "ELB"
  health_check_grace_period = 300

  # launch_template {
  #   id      = aws_launch_template.app.id
  #   version = "$Latest"
  # }

  mixed_instances_policy {
    launch_template {
      launch_template_specification {
        launch_template_id  = aws_launch_template.app.id
        version             = "$Latest"
      }

      override {
        instance_type       = var.instance_types[0]
        weighted_capacity   = "1"
      }
      override {
        instance_type       = var.instance_types[1]
        weighted_capacity   = "2"
      }
      override {
        instance_type       = var.instance_types[2]
        weighted_capacity   = "4"
      }
    }

    instances_distribution {
      on_demand_base_capacity                   = var.asg_desired_capacity
      on_demand_percentage_above_base_capacity  = 100
      # spot_percentage = 0
    }
  }

  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 90
      instance_warmup = 300 # 5 minutes
    }
    triggers = ["tag"]
  }

  tag {
    key                 = "Name"
    value               = "${var.project_name}-asg-instance"
    propagate_at_launch = true
  }

  dynamic "tag" {
    for_each = var.common_tags
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# CPU-based scaling policy
resource "aws_autoscaling_policy" "cpu_policy" {
  name                   = "${var.project_name}-asg-cpu-policy"
  policy_type            = "TargetTrackingScaling"
  autoscaling_group_name = aws_autoscaling_group.app.name

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = var.asg_cpu_target
    # disable_scale_in = false
  }
}

# Memory-based scaling policy using custom metric
resource "aws_autoscaling_policy" "memory_policy" {
  name                   = "${var.project_name}-asg-ram-policy"
  autoscaling_group_name = aws_autoscaling_group.app.name
  policy_type           = "TargetTrackingScaling"
  
  target_tracking_configuration {
    customized_metric_specification {
      metric_dimension {
        name  = "AutoScalingGroupName"
        value = aws_autoscaling_group.app.name
      }
      metric_name = "MemoryUtilization"
      namespace   = "AWS/EC2"
      statistic   = "Average"
    }
    target_value = var.asg_ram_target
    # disable_scale_in = false
  }
}

# Lifecycle hook for graceful shutdown
resource "aws_autoscaling_lifecycle_hook" "termination_hook" {
  name                    = "${var.project_name}-asg-termination-hook" 
  autoscaling_group_name  = aws_autoscaling_group.app.name
  lifecycle_transition    = "autoscaling:EC2_INSTANCE_TERMINATING"
  default_result         = "CONTINUE"
  heartbeat_timeout      = 300
}

resource "aws_autoscaling_attachment" "asg_attachment_alb" {
  autoscaling_group_name = aws_autoscaling_group.app.id
  lb_target_group_arn    = aws_lb_target_group.app.arn
}
