// Import the Init service from the services directory. This service handles the actual initialization logic.
import { ValidateEnvironment } from "../services/validate"
import { Init } from "../services/init"
// Import the prompts library for user interaction.  This allows the command to prompt the user for input.
import prompts from "prompts"
import {DeploymentType} from "../interfaces/common";
import {ShellPrompts} from "../utils/shell.prompts";

// This function is the main entry point for the 'init' command. It takes optional parameters for target environment, deployment type, and a force flag.
// It returns a Promise that resolves when the initialization is complete.
export async function run(
  targetEnvironment?: string,
  deploymentType?: string,
  force = false,
): Promise<void> {
  // Get the current working directory, which is assumed to be the root of the project.
  const projectRoot = process.cwd()
  deploymentType = await ShellPrompts.selectDeploymentType(deploymentType)


  // Validate the target environment or use a default if not provided
  const validateEnvironment = new ValidateEnvironment(projectRoot)
  targetEnvironment =
    targetEnvironment || (await validateEnvironment.validates(deploymentType as DeploymentType, targetEnvironment , force))

  console.info(`🌥️ Target environment: ${targetEnvironment}\n`)

  // If the target environment is not provided as a command-line argument, prompt the user to enter it.
  // NOTE: This uses the prompts library to interactively ask the user for the target environment.  It validates the input to ensure it's either 'staging' or 'production'.
  if (!targetEnvironment) {
    if (!force) {
      console.error("Target environment is required.")
      process.exit(1)
    }

    const response = await prompts({
      type: "text",
      name: "targetEnvironment",
      message: "Enter target environment (staging or production):",
      validate: (value) =>
        ["staging", "production"].includes(value)
          ? true
          : "Please enter either 'staging' or 'production'",
    })
    targetEnvironment = response.targetEnvironment
  }

  // If the deployment type is not provided, prompt the user to select one.
  // NOTE: This uses a select prompt to allow the user to choose between 'single' and 'asg' deployment types.  It also provides an 'exit' option to cancel the initialization.
  if (!deploymentType) {
    const response = await prompts({
      type: "select",
      name: "deploymentType",
      message: "Select deployment type:",
      choices: [
        { title: "single", value: "single" },
        { title: "asg", value: "asg" },
        { title: "ecs", value: "ecs" },
        { title: "exit", value: "exit" },
      ],
    })
    // If the user selects 'exit', log a message and return, cancelling the initialization.
    if (response.deploymentType === "exit") {
      console.log("Exiting...")
      return
    }
    deploymentType = response.deploymentType
  }

  // Create a new instance of the Init service, passing in the project root, target environment, deployment type, and force flag.
  const init = new Init(projectRoot, targetEnvironment, deploymentType, force)
  // Call the run method of the Init service to perform the initialization.
  await init.run()
}
