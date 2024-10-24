# Create CodeDeploy application
resource "aws_codedeploy_app" "app" {
  compute_platform = "Server"
  name             = "${var.project_name}-app"
}

# Create CodeDeploy deployment app group
resource "aws_codedeploy_deployment_group" "app_group" {
  app_name              = aws_codedeploy_app.app.name
  deployment_group_name = "${var.project_name}-app-group"
  service_role_arn      = aws_iam_role.codedeploy_service_role.arn

  ec2_tag_set {
    ec2_tag_filter {
      key   = "Name"
      type  = "KEY_AND_VALUE"
      value = "${var.project_name}-vm"
    }
  }

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE"]
  }
}
