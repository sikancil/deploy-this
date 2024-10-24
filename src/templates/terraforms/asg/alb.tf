# Application Load Balancer and related resources

resource "aws_lb" "app" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
  # subnets            = var.subnet_ids

  tags = merge(
    var.common_tags,
    {
      Name = "${var.project_name}-alb"
    }
  )
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    # type             = "forward"
    # target_group_arn = aws_lb_target_group.app.arn
    
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.app.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = var.ssl_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

resource "aws_lb_target_group" "app" {
  name     = "${var.project_name}-tg"
  port     = var.app_port
  protocol = "HTTP"
  vpc_id   = aws_vpc.VPC.id

  health_check {
    enabled             = true
    path                = var.health_check_path
    healthy_threshold   = var.asg_health_check_healthy_threshold
    unhealthy_threshold = var.asg_health_check_unhealthy_threshold
    timeout             = var.asg_health_check_timeout
    interval            = var.asg_health_check_interval
    matcher             = var.asg_health_check_matcher
  }

  tags = merge(
    var.common_tags,
    {
      Name = "${var.project_name}-tg"
    }
  )
}

# CloudWatch Alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "${var.project_name}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = var.asg_cpu_target
  alarm_description   = "This metric monitors EC2 CPU utilization"
  alarm_actions       = [aws_autoscaling_policy.cpu_policy.arn]

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.app.name
  }
}

# SSM Parameter for current instance type (useful for tracking)
resource "aws_ssm_parameter" "current_instance_type" {
  name  = "/asg/${var.project_name}/current-instance-type"
  type  = "String"
  value = local.instance_types[0]

  tags = {
    AppName = "${var.project_name}-ssm-params"
  }
}
