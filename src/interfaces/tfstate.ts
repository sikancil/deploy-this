// NOTE: This file defines interfaces for representing Terraform state data.
// It's used to structure and type-check data related to deployed AWS infrastructure.
// The interfaces are consumed by other modules within the 'src' directory, particularly those involved in deployment and initialization.

export interface TFState {
  // NOTE: Represents the overall version of the Terraform state.
  version: number
  // NOTE: Represents the version of Terraform used to generate this state.
  terraform_version: string
  // NOTE: Serial number representing the state's version.
  serial: number
  // NOTE: Lineage information for the state.
  lineage: string
  // NOTE: Outputs from the Terraform configuration.  These are values produced by the deployed infrastructure.
  outputs: TFState_Outputs
  // NOTE: Resources defined and managed by the Terraform configuration.  This contains details about each deployed resource.
  resources: TFState_Resource[]
  // NOTE: Results from Terraform's `terraform validate` command.  The structure is unknown as it depends on the validation results.
  check_results: unknown
}

// NOTE: Interface defining the outputs from the Terraform configuration.  These are key values related to the deployed infrastructure.
export interface TFState_Outputs {
  instance_id: TFState_InstanceId
  public_ip: TFState_PublicIp
  security_group_id: TFState_SecurityGroupId
  subnet_id: TFState_SubnetId
  vpc_id: TFState_VpcId
}

// NOTE: Interface for representing an instance ID.  Used within TFState_Outputs.
export interface TFState_InstanceId {
  value: unknown // NOTE: The actual instance ID value.  Type is unknown as it can vary.
  type: string // NOTE: Type information for the instance ID.
}

// NOTE: Interface for representing a public IP address.  Used within TFState_Outputs.
export interface TFState_PublicIp {
  value: unknown // NOTE: The actual public IP address value. Type is unknown as it can vary.
  type: string // NOTE: Type information for the public IP address.
}

// NOTE: Interface for representing a security group ID.  Used within TFState_Outputs.
export interface TFState_SecurityGroupId {
  value: unknown // NOTE: The actual security group ID value. Type is unknown as it can vary.
  type: string // NOTE: Type information for the security group ID.
}

// NOTE: Interface for representing a subnet ID.  Used within TFState_Outputs.
export interface TFState_SubnetId {
  value: unknown // NOTE: The actual subnet ID value. Type is unknown as it can vary.
  type: string // NOTE: Type information for the subnet ID.
}

// NOTE: Interface for representing a VPC ID.  Used within TFState_Outputs.
export interface TFState_VpcId {
  value: string // NOTE: The actual VPC ID value.
  type: string // NOTE: Type information for the VPC ID.
}

// NOTE: Interface for representing a Terraform resource.  Used within TFState.
export interface TFState_Resource {
  mode: string // NOTE: The mode of the resource (e.g., "managed").
  type: string // NOTE: The type of the resource (e.g., "aws_instance").
  name: string // NOTE: The name of the resource.
  provider: string // NOTE: The provider for the resource (e.g., "aws").
  instances: TFState_Instance[] // NOTE: Instances of the resource.  Can be multiple for resources with multiple instances.
}

// NOTE: Interface for representing an instance of a Terraform resource.  Used within TFState_Resource.
export interface TFState_Instance {
  schema_version: number // NOTE: Schema version for the resource instance.
  attributes: TFState_Attributes // NOTE: Attributes of the resource instance.
  sensitive_attributes: unknown[] // NOTE: Sensitive attributes of the resource instance.  Type is unknown for security reasons.
  private: string // NOTE: Indicates if the resource is private.
}

// NOTE: Interface for representing attributes of a Terraform resource instance.  Used within TFState_Instance.
export interface TFState_Attributes {
  arn: string // NOTE: Amazon Resource Name (ARN) of the resource.
  id: string // NOTE: Unique identifier for the resource.
  owner_id: string // NOTE: AWS account ID that owns the resource.
  tags: TFState_Tags // NOTE: Tags associated with the resource.
  tags_all: TFState_TagsAll // NOTE: All tags associated with the resource, including inherited tags.
  timeouts: unknown // NOTE: Timeouts for resource operations.  Type is unknown as it's provider-specific.
  vpc_id?: string // NOTE: ID of the VPC the resource belongs to (optional).
  assign_generated_ipv6_cidr_block?: boolean // NOTE: Whether to assign a generated IPv6 CIDR block (optional).
  cidr_block?: string // NOTE: CIDR block for the resource (optional).
  default_network_acl_id?: string // NOTE: ID of the default network ACL (optional).
  default_route_table_id?: string // NOTE: ID of the default route table (optional).
  default_security_group_id?: string // NOTE: ID of the default security group (optional).
  dhcp_options_id?: string // NOTE: ID of the DHCP options set (optional).
  enable_dns_hostnames?: boolean // NOTE: Whether to enable DNS hostnames (optional).
  enable_dns_support?: boolean // NOTE: Whether to enable DNS support (optional).
  enable_network_address_usage_metrics?: boolean // NOTE: Whether to enable network address usage metrics (optional).
  instance_tenancy?: string // NOTE: Tenancy of the instance (optional).
  ipv4_ipam_pool_id: unknown // NOTE: ID of the IPv4 IPAM pool. Type is unknown as it can vary.
  ipv4_netmask_length: unknown // NOTE: IPv4 netmask length. Type is unknown as it can vary.
  ipv6_association_id?: string // NOTE: ID of the IPv6 association (optional).
  ipv6_cidr_block?: string // NOTE: IPv6 CIDR block (optional).
  ipv6_cidr_block_network_border_group?: string // NOTE: IPv6 CIDR block network border group (optional).
  ipv6_ipam_pool_id?: string // NOTE: ID of the IPv6 IPAM pool (optional).
  ipv6_netmask_length?: number // NOTE: IPv6 netmask length (optional).
  main_route_table_id?: string // NOTE: ID of the main route table (optional).
}

// NOTE: Interface for representing tags associated with a resource.  Used within TFState_Attributes.
export interface TFState_Tags {
  Name: string // NOTE: Name tag for the resource.
}

// NOTE: Interface for representing all tags associated with a resource, including inherited tags. Used within TFState_Attributes.
export interface TFState_TagsAll {
  Name: string // NOTE: Name tag for the resource.
}
