resource "aws_cloudwatch_log_group" "io_template_service_log" {
    name = "/ecs/io_template_service-stg-log-group"

     retention_in_days = 7
}

# Create New Subnet 1
resource "aws_subnet" "main_ecs_stg_1" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-west-2a"
  map_public_ip_on_launch = true
  tags                    = {
    Name = "${var.project_name} - subnet ECS STG 1"
  }
}

# Create New Subnet 2
resource "aws_subnet" "main_ecs_stg_2" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "us-west-2b"
  map_public_ip_on_launch = true
  tags                    = {
    Name = "${var.project_name} - subnet ECS STG 2"
  }
}

# Create Route Table
resource "aws_route_table" "main" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name} - route-table ECS IO SBX"
  }
}

# Associate Route Table with Subnet
resource "aws_route_table_association" "rta_io_1" {
  subnet_id      = aws_subnet.main_ecs_stg_1.id
  route_table_id = aws_route_table.main.id
}

# Associate Route Table with Subnet
resource "aws_route_table_association" "rta_io_2" {
  subnet_id      = aws_subnet.main_ecs_stg_2.id
  route_table_id = aws_route_table.main.id
}

resource "aws_iam_role" "ecs_task_execution" {
  name = "ecsTaskExecutionRoleAdminStg"

  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect    = "Allow",
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        },
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_policy" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
  role       = aws_iam_role.ecs_task_execution.name
}

resource "aws_ecs_task_definition" "io_template_task" {
  family                   = "io-template-task-stg"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  container_definitions    = jsonencode([
    {
      "name" : "io-template-container",
      "image" : "180088340548.dkr.ecr.us-west-2.amazonaws.com/example-rest:804414086a3ba7b0b32ef6917ebdd534f4de1c22",
      "essential" : true,
      "portMappings" : [
        {
          "containerPort" : 3000,
          "hostPort" : 3000
        }
      ],
      "environment" : [
        { "name" : "SERVICE_NAME", "value" : "io_service" },
        { "name" : "DB_CLIENT", "value" : "mysql" },
        { "name" : "DB_HOST", "value" : "localhost" },
        { "name" : "DB_PORT", "value" : "3306" },
        { "name" : "DB_DATABASE", "value" : "test" },
        { "name" : "DB_USER", "value" : "root" }
      ]
    }
  ]
  )

  tags = {
    Name = "${var.project_name} - IO-TEMPLATE-STG"
  }
}

resource "aws_ecs_service" "io_template_service" {
  name            = "io-template-service"
  cluster         = aws_ecs_cluster.main_cluster.id
  task_definition = aws_ecs_task_definition.io_template_task.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.main_ecs_stg_1.id, aws_subnet.main_ecs_stg_2.id]
    security_groups  = [aws_security_group.ecs_sg_io_template_stg.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.io_template_target_group.arn
    container_name   = "io-template-container"
    container_port   = 3000
  }

  tags = {
    Name = "${var.project_name} - IO-TEMPLATE-STG"
  }
}


resource "aws_security_group" "ecs_sg_io_template_stg" {
  name        = "ecs_sg_io_template_stg"
  description = "STG Security group for ECS service"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name} - IO-TEMPLATE-STG"
  }
}

#ALB SETUP
resource "aws_security_group" "alb_sg_io_template_stg" {
  name        = "alb_sg_io_template_stg"
  description = "Allow inbound traffic to ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["108.137.125.145/32"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name} - IO-TEMPLATE-STG"
  }
}

resource "aws_lb" "io_template_stg_alb" {
  name               = "io-template-stg-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg_io_template_stg.id]
  subnets            = [aws_subnet.main_ecs_stg_1.id, aws_subnet.main_ecs_stg_2.id]

  enable_deletion_protection       = false
  enable_cross_zone_load_balancing = true
  #idle_timeout               = 5

  tags = {
    Name = "${var.project_name} - IO-TEMPLATE-STG"
  }
}

resource "aws_lb_target_group" "io_template_target_group" {
  name        = "io-template-target-group-stg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check {
    path                = "/"
    port                = 3000
    interval            = 60
    timeout             = 15
    healthy_threshold   = 3
    unhealthy_threshold = 6
  }

  tags = {
    Name = "${var.project_name} - IO-TEMPLATE-STG"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.io_template_stg_alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.io_template_target_group.arn
  }

  #certificate_arn = "${var.ssl}"

  tags = {
    Name = "${var.project_name} - IO-TEMPLATE-STG"
  }
}

