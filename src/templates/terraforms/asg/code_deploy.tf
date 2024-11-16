resource "aws_codedeploy_app" "app" {
  # name = var.codedeploy_app_name
  name = "${var.project_name}-cd"
}

resource "aws_codedeploy_deployment_group" "app_dg" {
  # app_name               = var.codedeploy_app_name
  app_name               = aws_codedeploy_app.app.name
  
  #deployment_group_name  = "${var.project_name}-cd-dg-${var.aws_region}"
  deployment_group_name  = "${var.project_name}-cd-dg"
  service_role_arn       = aws_iam_role.codedeploy_role.arn
  deployment_config_name = "CodeDeployDefault.OneAtATime"

  ec2_tag_set {
    ec2_tag_filter {
      key   = "Name"
      type  = "KEY_AND_VALUE"
      value = "${var.project_name}-vm"
    }
  }

  deployment_style {
    # deployment_option = "WITH_TRAFFIC_CONTROL"
    deployment_type   = "IN_PLACE"
  }

  autoscaling_groups = [aws_autoscaling_group.app.name]

  load_balancer_info {
    target_group_info {
      name = aws_lb_target_group.app.name
    }
  }

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE"]
  }
}
