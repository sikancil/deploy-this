export enum DeploymentType {
  SINGLE = "single",
  ASG = "asg",
}

export enum DestroyType {
  FULL = "full",
  PARTIAL = "partial",
}

export interface RollbackOptions {
  targetEnvironment?: string
  destroyType?: DestroyType | undefined
}
