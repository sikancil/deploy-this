resource "aws_codedeploy_app" "app" {
  # name = var.codedeploy_app_name
  name = "${var.project_name}-cd"
}

# First, create an SNS Topic for deployment notifications
resource "aws_sns_topic" "deployment_notifications" {
  name = "${var.project_name}-deployment-notifications"
  
  tags = {
    Name        = "${var.project_name}-deployment-notifications"
    Environment = var.node_env
    Project     = var.project_name
  }
}

resource "aws_codedeploy_deployment_group" "app_dg" {
  # app_name               = var.codedeploy_app_name
  app_name               = aws_codedeploy_app.app.name
  
  #deployment_group_name  = "${var.project_name}-cd-dg-${var.aws_region}"
  deployment_group_name  = "${var.project_name}-cd-dg"
  service_role_arn       = aws_iam_role.codedeploy_role.arn
  deployment_config_name = "CodeDeployDefault.OneAtATime"

  deployment_style {
    deployment_option = "WITH_TRAFFIC_CONTROL"
    deployment_type   = "IN_PLACE"
  }

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE"]
  }

  # Reference your Auto Scaling Group
  autoscaling_groups = [aws_autoscaling_group.app.name]

  # Correct trigger configuration using SNS Topic
  trigger_configuration {
    trigger_events = [
      "DeploymentSuccess",
      "DeploymentFailure"
    ]
    trigger_name       = "deployment-trigger"
    # Use SNS Topic ARN instead of ASG ARN
    trigger_target_arn = aws_sns_topic.deployment_notifications.arn
  }

  load_balancer_info {
    target_group_info {
      name = aws_lb_target_group.app.name
    }
  }

  ec2_tag_set {
    ec2_tag_filter {
      key   = "Name"
      type  = "KEY_AND_VALUE"
      value = "${var.project_name}-vm"
    }
  }
}
