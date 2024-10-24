import { ObjectType } from "../utils/object"
import { validateEnvironment } from "../utils/environment.validator"

export class ValidateEnvironment {
  private projectRoot: string

  // Constructor initializes the Deploy class with the target environment.
  // NOTE: It sets the project root directory, target environment, and initializes other properties.
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  async run(): Promise<{ stage: string | undefined }> {
    const validResult = await validateEnvironment(this.projectRoot, undefined, false)
    if (ObjectType.isEmpty(validResult)) {
      throw new Error("Unknown Stage or Environment")
    }
    
    console.info(`Current Stage: ${validResult}`)

    return {
      stage: validResult,
    }
  }
}
