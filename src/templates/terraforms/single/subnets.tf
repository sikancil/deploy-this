# This module defines the subnet and route table for a single EC2 instance deployment.
# It interacts with the VPC and internet gateway defined in 'main.tf' and uses variables defined in 'variables.tf'.

resource "aws_subnet" "main" {
  # ID of the VPC to which this subnet belongs.  Defined in 'main.tf'.
  vpc_id                  = aws_vpc.VPC.id
  
  # CIDR block for the subnet. Defined in 'variables.tf'.
  cidr_block              = var.subnet_cidr
  
  # Public IP assignment is controlled by 'var.map_public_ip'.
  # map_public_ip_on_launch = true
  
  # Whether to automatically assign public IPs to instances in this subnet.  Defined in 'variables.tf'.
  map_public_ip_on_launch = var.map_public_ip

  # Availability zone for the subnet. Defined in 'variables.tf'.
  availability_zone       = var.availability_zone

  tags = merge(
    # Merge common tags defined in 'variables.tf'
    var.common_tags,
    {
      # Name tag for the subnet, including the project name.
      Name = "${var.project_name}-subnet"
    }
  )
}

# This resource creates a route table that directs traffic to the internet gateway.
resource "aws_route_table" "main" {
  # ID of the VPC to which this route table belongs. Defined in 'main.tf'.
  vpc_id = aws_vpc.VPC.id

  route {
    # Default route for all traffic.
    cidr_block = "0.0.0.0/0"

    # ID of the internet gateway. Defined in 'main.tf'.
    gateway_id = aws_internet_gateway.InternetGateway.id
  }

  tags = merge(
    # Merge common tags defined in 'variables.tf'
    var.common_tags,
    {
      # Name tag for the route table, including the project name.
      Name = "${var.project_name}-rt"
    }
  )
}

# This resource associates the subnet with the route table, enabling internet access for instances in the subnet.
resource "aws_route_table_association" "main" {
  # ID of the subnet to associate.
  subnet_id      = aws_subnet.main.id
  
  # ID of the route table to associate.
  route_table_id = aws_route_table.main.id
}
