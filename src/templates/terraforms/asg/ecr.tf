resource "aws_ecr_repository" "app_repo" {
  name = var.ecr_repository_name
}