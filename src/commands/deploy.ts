import { Deploy } from "../services/deploy"
import { handleError } from "../utils/error.handler"

// This function runs the deployment process.
// It takes the target environment as input and uses the Deploy service to handle the deployment.
// It interacts with the src/services/deploy.ts file to perform the actual deployment steps.
export async function run(targetEnvironment: string): Promise<void> {
  try {
    // Create a new instance of the Deploy service with the target environment.
    const deploy = new Deploy(targetEnvironment)
    // Run the deployment process using the Deploy service.
    await deploy.run()
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
        case "TerraformPlanError":
          handleError(
            "Terraform plan generation failed. Please review your Terraform configuration for errors.",
            error,
          )
          break
        case "TerraformApplyError":
          handleError(
            "Terraform apply failed. Please review the error message and your Terraform configuration.",
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
          handleError("An unexpected error occurred during deployment.", error)
      }
    } else {
      handleError("An unknown error occurred during deployment.", error as unknown)
    }
  }
}

// TODO: Implement other commands (destroy, plan, apply, import, state) with similar error handling
