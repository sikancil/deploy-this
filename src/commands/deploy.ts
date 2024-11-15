import { Deploy } from "../services/deploy"
import { handleError } from "../utils/error.handler"
import { ObjectType } from "../utils/object"

export async function run(targetEnvironment: string): Promise<void> {
  try {
    const deploy = new Deploy(targetEnvironment)
    const result = await deploy.run()
    if (ObjectType.isEmpty(result)) {
      console.warn(`❗️ WARN: Deployment failed!.`)
      return
    } else {
      if (!ObjectType.isEmpty(result.vpcId) && !ObjectType.isEmpty(result.igwId)) {
        console.log(`🚀 Deployment completed.`, result)
      } else {
        console.warn(`❌ Deployment failed!.`)
      }
    }
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
