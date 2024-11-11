import prompts from "prompts"

import { Validation } from "./validation"
import { DeploymentType, DestroyType } from "../interfaces/common"
import { ObjectType } from "./object"

export class ShellPrompts {
  static readonly projectRoot: string = process.cwd()

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

  // selectTargetEnvironment prompts the user to select a target environment from available options.
  // NOTE: It uses the prompts library to create an interactive selection menu. Interacts with the user.
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
  // NOTE: It uses the prompts library to create an interactive selection menu. Interacts with the user.
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
  // NOTE: It uses the prompts library to create an interactive selection menu. Interacts with the user.
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
