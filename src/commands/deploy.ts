// import * as fs from "fs"
// import * as path from "path"
import { Deploy } from "../services/deploy"
import { handleError } from "../utils/error.handler"
// import { ObjectType } from "../utils/object"

// const projectRoot = process.cwd()

// TODO: later should breakdown to util functions
// async function updateEnvFile(
//   targetEnvironment: string,
//   updates: Record<string, string>,
// ): Promise<void> {
//   if (ObjectType.isEmpty(targetEnvironment)) {
//     console.warn(`❌ Target environment is empty (${targetEnvironment}). Skipping update.`)
//     return
//   }

//   const envFile = path.join(projectRoot, `.env.dt.${targetEnvironment}`)
//   console.log(`📝 Updating ${envFile}...`)
//   let content = fs.readFileSync(envFile, "utf8")

//   Object.entries(updates).forEach(([key, value]) => {
//     const regex = new RegExp(`^${key}=.*$`, "m")
//     if (content.match(regex)) {
//       content = content.replace(regex, `${key}="${value}"`)
//     } else {
//       content += `\n${key}="${value}"`
//     }
//   })

//   fs.writeFileSync(envFile, content)
// }

// This function runs the deployment process.

export async function run(targetEnvironment: string): Promise<void> {
  try {
    const deploy = new Deploy(targetEnvironment)
    const result = await deploy.run()
    console.log(`🚀 Deployment completed.`, result)

    // if (result?.vpcId && result?.igwId) {
    //   await updateEnvFile(targetEnvironment, {
    //     VPC_ID: result.vpcId,
    //     IGW_ID: result.igwId
    //   })
    // }
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
