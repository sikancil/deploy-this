export const undefinedText = "Not set⁉️"

export enum DeploymentType {
  SINGLE = "single",
  ASG = "asg",
  ECS = "ecs",
}

export enum DestroyType {
  FULL = "full",
  PARTIAL = "partial",
}

export interface RollbackOptions {
  targetEnvironment?: string
  destroyType?: DestroyType | undefined
}
