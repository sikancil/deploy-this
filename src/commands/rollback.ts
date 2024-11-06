import prompts from "prompts"
import { DestroyType, Rollback } from "../services/rollback"
import { ValidateEnvironment } from "../services/validate"
import { handleError } from "../utils/error.handler"

export async function run(targetEnvironment?: string, destroyType?: string, force: boolean = false): Promise<void> {
  try {
    // Get the current working directory, which is assumed to be the root of the project.
    const projectRoot = process.cwd()

    // Validate the target environment or use a default if not provided
    const validateEnvironment = new ValidateEnvironment(projectRoot)
    targetEnvironment =
      targetEnvironment ||
      (await validateEnvironment.validates(projectRoot, targetEnvironment, false))

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
    if (!destroyType) {
      const response = await prompts({
        type: "select",
        name: "destroyType",
        message: "Select destroy type:",
        choices: [
          { title: "Full Destroy (All Resources)", value: "full" },
          { title: "Partial Destroy (Exclude VPC and IGW)", value: "partial" },
          { title: "Exit", value: "exit" },
        ],
      })
      // If the user selects 'exit', log a message and return, cancelling the initialization.
      if (response.destroyType === "exit") {
        console.log("Exiting...")
        return
      }
      destroyType = response.destroyType
    }

    console.info(`🚀 Starting rollback...`)
    console.info(`👁️ ${process.cwd()}`)

    const rollback = new Rollback(targetEnvironment, destroyType as DestroyType, force)
    await rollback.run()
  } catch (error) {
    if (error instanceof Error) {
      switch (error.name) {
        case "EnvironmentValidationError":
          handleError(
            "Environment validation failed. Please check your .env and .env.dt files.",
            error
          )
          break
        case "TerraformInitError":
          handleError(
            "Terraform initialization failed. Please check your Terraform configuration.",
            error
          )
          break
        case "TerraformDestroyError":
          handleError(
            "Terraform destroy failed. Please review the error message and your Terraform configuration.",
            error
          )
          break
        case "AWSCredentialsError":
          handleError(
            "AWS credentials are invalid or not set. Please check your AWS configuration.",
            error
          )
          break
        default:
          handleError("An unexpected error occurred during rollback.", error)
      }
    } else {
      handleError("An unknown error occurred during rollback.", error as unknown)
    }
  }
}
