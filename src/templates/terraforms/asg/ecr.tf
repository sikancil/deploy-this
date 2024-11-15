resource "aws_ecr_repository" "app_repo" {
  # name = var.ecr_repository_name
  name = var.project_name
  force_delete = true

  image_scanning_configuration {
    scan_on_push = true
  }
}
