import { Rollback } from "../services/rollback"
import { ValidateEnvironment } from "../services/validate"
import { handleError } from "../utils/error.handler"
import { ShellPrompts } from "./../utils/shell.prompts"
import { Validation } from "./../utils/validation"
import { DestroyType } from "../interfaces/common"

export async function run(
  targetEnvironment?: string,
  destroyType?: string,
  force: boolean = false,
): Promise<void> {
  try {
    // Get the current working directory, which is assumed to be the root of the project.
    const projectRoot = process.cwd()

    // Validate the target environment or use a default if not provided
    const validateEnvironment = new ValidateEnvironment(projectRoot)
    targetEnvironment =
      targetEnvironment || (await validateEnvironment.validates(targetEnvironment, false))

    console.info(`🌥️ Target environment: ${targetEnvironment}\n`)

    // If the target environment is not provided as a command-line argument, prompt the user to enter it.
    // NOTE: This uses the prompts library to interactively ask the user for the target environment.  It validates the input to ensure it's either 'staging' or 'production'.
    if (!targetEnvironment) {
      if (!force) {
        console.error("Target environment is required.")
        process.exit(1)
      }

      targetEnvironment = await ShellPrompts.promptForTargetEnvironment(targetEnvironment)
    }

    // Check if Terraform state file exists
    // NOTE: This checks if the Terraform state file exists for the target environment, otherwise it exits with an error.
    const validTfState = Validation.checkTfState(targetEnvironment)
    if (!validTfState.tfStateExists || !validTfState.vpcExists || !validTfState.igwExists) {
      console.error(
        `❌ Invalid Terraform state file or not found or has empty resources.\n`,
        `  Please ensure it exists or valid before rolling back!\n`,
      )
      process.exit(1)
    }

    // If the deployment type is not provided, prompt the user to select one.
    // NOTE: This uses a select prompt to allow the user to choose between 'single' and 'asg' deployment types.  It also provides an 'exit' option to cancel the initialization.
    if (!destroyType) {
      destroyType = await ShellPrompts.selectDestroyType()
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
            error,
          )
          break
        case "TerraformInitError":
          handleError(
            "Terraform initialization failed. Please check your Terraform configuration.",
            error,
          )
          break
        case "TerraformDestroyError":
          handleError(
            "Terraform destroy failed. Please review the error message and your Terraform configuration.",
            error,
          )
          break
        case "AWSCredentialsError":
          handleError(
            "AWS credentials are invalid or not set. Please check your AWS configuration.",
            error,
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
