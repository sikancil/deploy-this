# IAM role for EC2 instances with versioning
resource "aws_iam_role" "ec2_role" {
  name_prefix = "${var.project_name}-ec2-"
  description = "IAM role for EC2 instances in ${var.project_name}"
  
  assume_role_policy = file("${path.module}/iam_roles.json")
  
  tags = merge(
    var.common_tags,
    {
      Name = "${var.project_name}-ec2-role"
      Service = "EC2"
    }
  )

  lifecycle {
    create_before_destroy = true
  }
}

# IAM role for CodeDeploy
resource "aws_iam_role" "codedeploy_role" {
  name = "${var.project_name}-codedeploy-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codedeploy.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.common_tags,
    {
      Name = "${var.project_name}-codedeploy-role"
      Service = "CodeDeploy"
    }
  )
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${var.project_name}-ec2-profile"
  role = aws_iam_role.ec2_role.name
}

# Add EC2 Instance Connect policy
# resource "aws_iam_role_policy_attachment" "ec2_instance_connect" {
#   policy_arn = "arn:aws:iam::aws:policy/AWSEc2InstanceConnectPolicy"
#   role       = aws_iam_role.ec2_role.name
# }

# resource "aws_iam_role_policy_attachment" "codedeploy_policy" {
#   policy_arn = "arn:aws:iam::aws:policy/service-role/AWSCodeDeployRole"
#   role       = aws_iam_role.codedeploy_role.name
# }

# Attach EC2 Container Service role policy
resource "aws_iam_role_policy_attachment" "ec2_container_service_policy" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
  role       = aws_iam_role.ec2_role.name
}

# Attach the AWS CodeDeploy Service Role policy
resource "aws_iam_role_policy_attachment" "codedeploy_service_role" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSCodeDeployRole"
  role       = aws_iam_role.codedeploy_role.name
}

# resource "aws_iam_role_policy_attachment" "codedeploy_agent_policy" {
#   policy_arn = "arn:aws:iam::aws:policy/service-role/AWSCodeDeployRole"
#   role       = aws_iam_role.ec2_role.name
# }

# Add AWS Systems Manager (SSM) access for EC2 instances
resource "aws_iam_role_policy_attachment" "ec2_ssm_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  role       = aws_iam_role.ec2_role.name
}

# Add SNS permissions for CodeDeploy
resource "aws_iam_role_policy" "codedeploy_sns_policy" {
  name = "${var.project_name}-codedeploy-sns"
  role = aws_iam_role.codedeploy_role.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish",
          "sns:ListTopics",
          "sns:GetTopicAttributes",
          "autoscaling:Describe*"
        ]
        Resource = "*"
      }
    ]
  })
}

# Comprehensive EC2 instance permissions
resource "aws_iam_role_policy" "ec2_permissions" {
  name = "${var.project_name}-ec2-permissions"
  role = aws_iam_role.ec2_role.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:Get*",
          "s3:List*"
        ]
        Resource = [
          "${aws_s3_bucket.artifacts.arn}",
          "${aws_s3_bucket.artifacts.arn}/*",
          "arn:aws:s3:::aws-codedeploy-*/*",
          "arn:aws:s3:::aws-codedeploy-*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:GetRepositoryPolicy",
          "ecr:DescribeRepositories",
          "ecr:ListImages",
          "ecr:DescribeImages",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "codedeploy:*",
          "codedeploy-commands:*"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "ec2:DescribeTags",
          "autoscaling:Describe*",
          "autoscaling:UpdateAutoScalingGroup",
          "autoscaling:CompleteLifecycleAction"
        ]
        Resource = "*"
      }
    ]
  })
}

# Get current AWS region and account ID for reference
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}
