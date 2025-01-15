import { ValidateEnvironment } from "./../services/validate"
import { handleError } from "../utils/error.handler"
import {DeploymentType} from "../interfaces/common";

export async function run(deploymentType: DeploymentType): Promise<void> {
  const TARGET_DIR = process.cwd()

  try {
    // Create a new instance of the ValidateEnvironment service with the target environment.
    const VE = new ValidateEnvironment(TARGET_DIR)
    // Run the validation process using the ValidateEnvironment service.
    await VE.run(deploymentType)
  } catch (error) {
    handleError(
      "Environment validation failed. Please check required files and it's contents.",
      error,
    )
  }
}
