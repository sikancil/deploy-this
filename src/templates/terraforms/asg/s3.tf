# S3 bucket for storing Docker Compose and deployment artifacts
resource "aws_s3_bucket" "artifacts" {
  bucket = "${var.project_name}-artifacts"

  tags = merge(
    var.common_tags,
    {
      Name = "${var.project_name}-artifacts"
    }
  )
}

# Enable versioning for configuration rollbacks
resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Upload docker-compose.yml to S3
resource "aws_s3_object" "docker_compose" {
  bucket = aws_s3_bucket.artifacts.id
  key    = "docker-compose.yml"
  source = "${path.module}/docker-compose.yml"
  etag   = filemd5("${path.module}/docker-compose.yml")

  tags = merge(
    var.common_tags,
    {
      Name = "docker-compose-config"
    }
  )
}
