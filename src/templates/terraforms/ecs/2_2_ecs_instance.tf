resource "aws_cloudwatch_log_group" "io_template_service_log" {
  name              = var.log_group_name
  retention_in_days = 7
}

resource "aws_subnet" "main_ecs_stg_1" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.subnet_1_cidr
  availability_zone       = var.availability_zone_1
  map_public_ip_on_launch = true
  tags = {
    Name = "${var.project_name} - subnet ECS 1"
  }
}

resource "aws_subnet" "main_ecs_stg_2" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.subnet_2_cidr
  availability_zone       = var.availability_zone_2
  map_public_ip_on_launch = true
  tags = {
    Name = "${var.project_name} - subnet ECS 2"
  }
}

resource "aws_route_table" "main" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = var.route_table_cidr
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name} - ECS route-table"
  }
}

resource "aws_route_table_association" "rta_io_1" {
  subnet_id      = aws_subnet.main_ecs_stg_1.id
  route_table_id = aws_route_table.main.id
}

resource "aws_route_table_association" "rta_io_2" {
  subnet_id      = aws_subnet.main_ecs_stg_2.id
  route_table_id = aws_route_table.main.id
}

resource "aws_iam_role" "ecs_task_execution" {
  name = var.ecs_task_execution_role_name

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
  family                   = var.ecs_task_family
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  container_definitions    = jsonencode([
    {
      "name" : var.container_name,
      "image" : var.container_image,
      "essential" : true,
      "portMappings" : [
        {
          "containerPort" : 3000,
          "hostPort" : 3000
        }
      ],
      "environment" : [
        { "name" : "SERVICE_NAME", "value" : var.service_name },
        { "name" : "DB_CLIENT", "value" : var.db_client },
        { "name" : "DB_HOST", "value" : var.db_host },
        { "name" : "DB_PORT", "value" : var.db_port },
        { "name" : "DB_DATABASE", "value" : var.db_database },
        { "name" : "DB_USER", "value" : var.db_user }
      ]
    }
  ])

  tags = {
    Name = "${var.project_name} task"
  }
}

resource "aws_ecs_service" "io_template_service" {
  name            = var.ecs_service_name
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
    container_name   = var.container_name
    container_port   = 3000
  }

  tags = {
    Name = "${var.project_name} service"
  }
}

resource "aws_security_group" "ecs_sg_io_template_stg" {
  name        = var.ecs_sg_io_template_stg
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
    Name = "${var.project_name} ECS SG"
  }
}

resource "aws_security_group" "alb_sg_io_template" {
  name        = var.alb_sg_io_template
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
    cidr_blocks = [var.alb_sg_ingress_ip]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name} ECS SG ALB"
  }
}

resource "aws_lb" "io_template_stg_alb" {
  name               = var.alb_name
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg_io_template.id]
  subnets            = [aws_subnet.main_ecs_stg_1.id, aws_subnet.main_ecs_stg_2.id]

  enable_deletion_protection       = false
  enable_cross_zone_load_balancing = true

  tags = {
    Name = "${var.project_name} ECS ALB"
  }
}

resource "aws_lb_target_group" "io_template_target_group" {
  name        = var.target_group_name
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
    Name = "${var.project_name} ECS Target LB"
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

  tags = {
    Name = "${var.project_name} ECS"
  }
}