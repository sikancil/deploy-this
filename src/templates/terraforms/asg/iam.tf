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
}

# IAM policy for CodeDeploy permissions
# resource "aws_iam_user_policy" "codedeploy_policy" {
#   name = "${var.project_name}-codedeploy-policy"
#   user = "dimas-console"  # Replace with your IAM user if different

#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [
#       {
#         Effect = "Allow"
#         Action = [
#           "codedeploy:*",
#           "ec2:*",
#           "elasticloadbalancing:*",
#           "autoscaling:*",
#           "cloudwatch:*",
#           "s3:*",
#           "sns:*",
#           "iam:CreateRole",
#           "iam:GetRole",
#           "iam:PutRolePolicy",
#           "iam:DeleteRolePolicy",
#           "iam:DeleteRole"
#         ]
#         Resource = "*"
#       }
#     ]
#   })
# }

# IAM role for EC2 instances
resource "aws_iam_role" "ec2_role" {
  name = "${var.project_name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "codedeploy_policy" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSCodeDeployRole"
  role       = aws_iam_role.codedeploy_role.name
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

resource "aws_iam_role_policy_attachment" "ec2_policy" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
  role       = aws_iam_role.ec2_role.name
}

# Add S3 access policy for EC2 instances
resource "aws_iam_role_policy" "s3_access" {
  name = "${var.project_name}-s3-access"
  role = aws_iam_role.ec2_role.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          "${aws_s3_bucket.artifacts.arn}",
          "${aws_s3_bucket.artifacts.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = [
          aws_sns_topic.config_updates.arn
        ]
      }
    ]
  })
}
