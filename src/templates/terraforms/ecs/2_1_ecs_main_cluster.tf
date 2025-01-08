resource "aws_ecs_cluster" "main_cluster" {
  name = "stg-cluster"

  tags = {
    Name = "${var.project_name} - MAIN-CLUSTER-STG"
  }
}