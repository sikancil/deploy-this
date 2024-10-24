resource "tls_private_key" "dt_private" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

# https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/key_pair
resource "aws_key_pair" "dt_keypair" {
  key_name   = var.project_name
  public_key = tls_private_key.dt_private.public_key_openssh

  tags = {
    Name = var.project_name
  }
}

# https://registry.terraform.io/providers/hashicorp/local/latest/docs/resources/file
resource "local_file" "dt_rsa_private" {
  content         = tls_private_key.dt_private.private_key_pem
  filename        = "${path.module}/${var.project_name}.pem"
  file_permission = "0400"
}
