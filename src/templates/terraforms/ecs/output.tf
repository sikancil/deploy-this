output "log_group_name" {
  value = aws_cloudwatch_log_group.io_template_service_log.name
  description = "Name of the CloudWatch log group"
}

output "subnet_ecs_stg_1_id" {
  value = aws_subnet.main_ecs_stg_1.id
  description = "ID of the first ECS subnet"
}

output "subnet_ecs_stg_2_id" {
  value = aws_subnet.main_ecs_stg_2.id
  description = "ID of the second ECS subnet"
}

output "route_table_id" {
  value = aws_route_table.main.id
  description = "ID of the main route table"
}


output "iam_role_ecs_task_execution_arn" {
  value = aws_iam_role.ecs_task_execution.arn
  description = "ARN of the ECS task execution IAM role"
}

output "ecs_task_definition_arn" {
  value = aws_ecs_task_definition.io_template_task.arn
  description = "ARN of the ECS task definition"
}

output "ecs_service_name" {
    value = aws_ecs_service.io_template_service.name
    description = "Name of the ECS service"
}

output "ecs_service_id" {
    value = aws_ecs_service.io_template_service.id
    description = "ID of the ECS service"
}

output "ecs_security_group_id" {
  value = aws_security_group.ecs_sg_io_template_stg.id
  description = "ID of the security group for ECS tasks"
}

output "alb_security_group_id" {
  value = aws_security_group.alb_sg_io_template_stg.id
  description = "ID of the security group for the ALB"
}


output "alb_arn" {
  value = aws_lb.io_template_stg_alb.arn
  description = "ARN of the application load balancer"
}

output "alb_dns_name" {
  value = aws_lb.io_template_stg_alb.dns_name
  description = "DNS name of the application load balancer"
}


output "alb_target_group_arn" {
  value = aws_lb_target_group.io_template_target_group.arn
  description = "ARN of the ALB target group"
}

output "alb_listener_arn" {
  value = aws_lb_listener.http.arn
  description = "ARN of the ALB HTTP listener"
}