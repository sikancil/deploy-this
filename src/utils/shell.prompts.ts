import prompts from "prompts"

import { Validation } from "./validation"
import { DeploymentType, DestroyType } from "../interfaces/common"
import { ObjectType } from "./object"

export class ShellPrompts {
  static readonly projectRoot: string = process.cwd()

  // promptForTargetEnvironment prompts the user to enter a target environment.
  // NOTE: When target environment is not provided, it prompts the user to enter one.
  // It validates the input to ensure it's either 'staging' or 'production'.
  static async promptForTargetEnvironment(
    targetEnvironment: string | undefined,
  ): Promise<string | undefined> {
    if (ObjectType.isEmpty(targetEnvironment)) {
      const response = await prompts({
        type: "text",
        name: "targetEnvironment",
        message: "Enter target environment (staging or production):",
        validate: (value) =>
          ["staging", "production"].includes(value)
            ? true
            : "Please enter either 'staging' or 'production'",
      })

      if (ObjectType.isEmpty(response.targetEnvironment)) {
        console.error("Target environment is required.")
        process.exit(1)
      }

      targetEnvironment = response.targetEnvironment
    }
    return targetEnvironment
  }

  // promptForProjectName prompts the user to enter a project name.
  // NOTE: When project name is not provided, it prompts the user to enter one.
  static async promptForProjectName(projectName: string | undefined): Promise<string | undefined> {
    if (ObjectType.isEmpty(projectName)) {
      const response = await prompts({
        type: "text",
        name: "projectName",
        message: "Enter project name:",
        validate: (value) => (value.length > 0 ? true : "Please enter a valid project name"),
      })

      if (ObjectType.isEmpty(response.projectName)) {
        console.error("Project name is required.")
        process.exit(1)
      }

      projectName = response.projectName
    }
    return projectName
  }

  // promptConfirmToDeploy prompts the user to confirm deployment.
  // NOTE: Prompt to confirm deployment (Y/N).
  static async promptConfirmToDeploy(projectName: string): Promise<boolean> {
    const response = await prompts({
      type: "confirm",
      name: "confirmDeployment",
      message: `Deployment will CREATE or UPDATES resources for ${projectName} within AWS. Proceed?`,
      initial: false,
    })
    return response.confirmDeployment
  }

  // promptConfirmToDestroy prompts the user to confirm destroy.
  // NOTE: Prompt to confirm destroy (Y/N).
  static async promptConfirmToDestroy(projectName: string): Promise<boolean> {
    const response = await prompts({
      type: "confirm",
      name: "confirmDestroy",
      message: `Rollback will DESTROY resources in ${projectName}. Proceed?`,
      initial: false,
    })
    return response.confirmDestroy
  }

  // selectTargetEnvironment prompts the user to select a target environment from available options.
  // NOTE: Prompt to select existing target environment or exit.
  static async selectTargetEnvironment(): Promise<string> {
    const response = await prompts({
      type: "select",
      name: "selectedEnvironment",
      message: "Select target environment:",
      choices: Validation.checkTargetEnvironment()
        .concat("exit")
        .map((targetEnvironment) => {
          return {
            title: targetEnvironment,
            value: targetEnvironment,
          }
        }),
    })

    if (response.selectedEnvironment === "exit") {
      console.log("Exiting...")
      process.exit(0)
    }
    return response.selectedEnvironment
  }

  // selectDeploymentType prompts the user to select a deployment type (single or asg).
  // NOTE: Prompt to select existing deployment type or exit.
  static async selectDeploymentType(
    deploymentType: DeploymentType | string | undefined,
  ): Promise<DeploymentType | undefined> {
    if (ObjectType.isEmpty(deploymentType)) {
      const response = await prompts({
        type: "select",
        name: "deploymentType",
        message: "Select deployment type:",
        choices: [
          { title: "single", value: DeploymentType.SINGLE },
          { title: "asg", value: DeploymentType.ASG },
          { title: "exit", value: "exit" },
        ],
      })

      if (response.deploymentType === "exit") {
        console.log("Exiting...")
        process.exit(0)
      }

      deploymentType = response.deploymentType as DeploymentType
    }

    return deploymentType as DeploymentType | undefined
  }

  // selectDestroyType prompts the user to select a destroy type (full or partial).
  // NOTE: Prompt to select destroying method or exit.
  static async selectDestroyType(): Promise<DestroyType> {
    const response = await prompts({
      type: "select",
      name: "destroyType",
      message: "Select destroy type:",
      choices: [
        { title: "Full Destroy (All Resources)", value: DestroyType.FULL },
        { title: "Partial Destroy (Exclude VPC and IGW)", value: DestroyType.PARTIAL },
        { title: "Exit", value: "exit" },
      ],
    })

    if (response.destroyType === "exit") {
      console.log("Rollback cancelled.")
      process.exit(0)
    }

    return response.destroyType as DestroyType
  }
}
