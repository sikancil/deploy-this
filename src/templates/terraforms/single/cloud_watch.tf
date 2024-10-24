# CloudWatch log group
resource "aws_cloudwatch_log_group" "ec2_logs" {
  name              = "/aws/ec2/${var.project_name}"
  retention_in_days = 30

  tags = merge(
    var.common_tags,
    {
      Name = "${var.project_name}-logs"
    }
  )
}
