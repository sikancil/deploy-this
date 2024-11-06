import fs from "node:fs"
import path from "node:path"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import { satisfies, compare, CompareOperator } from "compare-versions"

import { ObjectType } from "../utils/object"
import { patchEnvs } from "../utils/env"

// Promisify the exec function for asynchronous execution of shell commands.
const execAsync = promisify(exec)

export class ValidateEnvironment {
  private projectRoot: string

  // Constructor initializes the Deploy class with the target environment.
  // NOTE: It sets the project root directory, target environment, and initializes other properties.
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  public async run(): Promise<{ stage: string | undefined }> {
    const validResult = await this.validates(this.projectRoot, undefined, false)
    if (ObjectType.isEmpty(validResult)) {
      throw new Error("Unknown Stage or Environment")
    }

    console.info(`Current Stage: ${validResult}`)

    return {
      stage: validResult,
    }
  }

  // NOTE: This function validates the environment variables and tools required for deployment.
  // It's the main entry point for environment validation and is called by src/index.ts.
  // It checks for .env, .env.dt.{environment} files, AWS credentials, and required tools.
  public async validates(
    TARGET_DIR: string,
    targetEnvironment: string | undefined = undefined,
    doForce: boolean = false,
  ): Promise<string | undefined> {
    const checkPoint: {
      stage?: string | undefined
      targetEnvironment?: boolean
      dtEnvFile?: boolean
      awsCredentials?: boolean
      requiredVariables?: boolean
      requiredTools?: boolean
    } = {}

    try {
      // Determine the target environment, prioritizing the provided argument, then the NODE_ENV environment variable.
      targetEnvironment = this.checkTargetEnvironment(TARGET_DIR, targetEnvironment, doForce)
      checkPoint.targetEnvironment = !!targetEnvironment
    } catch (error) {
      console.error("Error checking target environment:", error)
      checkPoint.targetEnvironment = false
    }
    checkPoint.stage = targetEnvironment
    console.info(
      `${ObjectType.isEmpty(checkPoint.targetEnvironment) ? "❌" : "✅"} Target environment`,
      checkPoint.targetEnvironment,
    )

    try {
      // Check for and create the .env.dt.{environment} file if it doesn't exist and doForce is true.
      checkPoint.dtEnvFile = this.checkDtEnvFile(TARGET_DIR, targetEnvironment, doForce)
    } catch (error) {
      console.error("Error checking .env.dt.{environment} file:", error)
      checkPoint.dtEnvFile = false
    }
    console.info(`${checkPoint.dtEnvFile ? "✅" : "❌"} .env.dt.${targetEnvironment}`)

    try {
      // Validate AWS credentials from the .env.dt.{environment} file.
      checkPoint.awsCredentials = this.validateAwsCredentials(TARGET_DIR, targetEnvironment)
    } catch (error) {
      console.error("Error validating AWS credentials:", error)
      checkPoint.awsCredentials = false
    }
    console.info(`${checkPoint.awsCredentials ? "✅" : "❌"} AWS credentials`)

    try {
      // Validate required environment variables from the .env.dt.{environment} file.
      checkPoint.requiredVariables = this.validateRequiredVariables(TARGET_DIR, targetEnvironment)
    } catch (error) {
      console.error("Error validating required environment variables:", error)
      checkPoint.requiredVariables = false
    }
    console.info(`${checkPoint.requiredVariables ? "✅" : "❌"} Required environment variables`)

    try {
      // Asynchronously validate that required tools (node, npm, terraform, aws, docker, git) are installed.
      checkPoint.requiredTools = await this.validateRequiredTools()
    } catch (error) {
      console.error("Error validating required tools:", error)
      checkPoint.requiredTools = false
    }
    console.info(`${checkPoint.requiredTools ? "✅" : "❌"} Required tools`)

    console.log()

    return Object.values(checkPoint).some((value) => value === false)
      ? undefined
      : targetEnvironment

    // return checkPoint.stage
  }


  //=== Private Functions ===//


  // NOTE: Checks if the .env file exists in the target directory. If not and doForce is true, it creates one.
  // Interacts with src/index.ts which calls this function to ensure the .env file exists before proceeding.
  private checkEnvFile(
    TARGET_DIR: string,
    targetEnvironment: string | undefined = undefined,
    doForce: boolean = false,
  ): boolean {
    const targetEnvFile = path.join(TARGET_DIR, ".env")
    if (!fs.existsSync(targetEnvFile)) {
      const exampleEnvFile = path.join(__dirname, "../templates/environments/.env-example")
      if (doForce) {
        // If targetEnvironment is not specified, copy the example .env file. Otherwise, create a .env file with NODE_ENV set.
        if (ObjectType.isEmpty(targetEnvironment)) {
          fs.copyFileSync(exampleEnvFile, targetEnvFile)
        } else {
          fs.writeFileSync(targetEnvFile, `NODE_ENV="${targetEnvironment}"\n`, "utf8")
        }
      } else {
        // throw new Error(".env file not found")
        console.warn("WARN: .env file not found. Use force option -f to create one.")
        return false
      }
    }

    return true
  }

  // NOTE: Determines the target environment.  Prioritizes explicitly provided environment, then checks process.env.NODE_ENV,
  // then falls back to creating a .env file if doForce is true.  Called by validateEnvironment and checkDtEnvFile.
  private checkTargetEnvironment(
    TARGET_DIR: string,
    targetEnvironment: string | undefined = undefined,
    doForce: boolean = false,
  ): string | undefined {
    // Prioritize explicitly provided environment, then check process.env.NODE_ENV.
    targetEnvironment = targetEnvironment || process.env.NODE_ENV

    let nodeEnv: string | undefined = targetEnvironment

    const targetEnvFile = path.join(TARGET_DIR, ".env")
    const targetDotEnvExists = fs.existsSync(targetEnvFile)
    // If .env file doesn't exist, create it if doForce is true.
    if (!targetDotEnvExists) {
      const checkEnvResult = this.checkEnvFile(TARGET_DIR, targetEnvironment, doForce)
      if (!checkEnvResult) {
        return
      }
    }

    // If targetEnvironment is not set, read NODE_ENV from .env file.
    if (ObjectType.isEmpty(targetEnvironment)) {
      const targetDotEnv = patchEnvs(targetEnvFile)
      nodeEnv = targetDotEnv.NODE_ENV
    }

    if (!nodeEnv) {
      // throw new Error("Target environment is not set")
      console.error("Target environment is not set")
      return
    }

    return nodeEnv
  }

  // NOTE: Checks if the .env.dt.{environment} file exists. If not and doForce is true, it creates one.
  // Uses checkTargetEnvironment to determine the environment.  Called by validateEnvironment.
  private checkDtEnvFile(
    TARGET_DIR: string,
    targetEnvironment: string | undefined = undefined,
    doForce: boolean = false,
  ): boolean {
    // Determine the target environment.
    const nodeEnv: string | undefined =
      targetEnvironment || this.checkTargetEnvironment(TARGET_DIR, targetEnvironment, doForce)

    if (!nodeEnv) {
      return false
    }

    const targetDtEnvFile = path.join(TARGET_DIR, `.env.dt.${nodeEnv}`)
    if (!fs.existsSync(targetDtEnvFile)) {
      if (doForce) {
        const exampleDtEnvFile = path.join(
          __dirname,
          "../templates/environments/.env.dt.stage-example",
        )
        // Copy the example .env.dt.stage file.
        fs.copyFileSync(exampleDtEnvFile, targetDtEnvFile)
      } else {
        // throw new Error(`.env.dt.${nodeEnv} file not found`)
        console.warn(`WARN: .env.dt.${nodeEnv} file not found. Use force -f option to create one.`)
        return false
      }
    }

    return true
  }

  // NOTE: Validates AWS credentials from the .env.dt.{environment} file. Called by validateEnvironment.
  private validateAwsCredentials(
    TARGET_DIR: string,
    targetEnvironment: string | undefined = undefined,
  ): boolean {
    // Determine the target environment.
    const nodeEnv: string | undefined =
      targetEnvironment || this.checkTargetEnvironment(TARGET_DIR, targetEnvironment, false)

    if (!nodeEnv) {
      return false
    }

    const targetDtEnvFile = path.join(TARGET_DIR, `.env.dt.${nodeEnv}`)
    const targetDotEnvDtExists = fs.existsSync(targetDtEnvFile)
    if (!targetDotEnvDtExists) {
      throw new Error(`Working directory doesn't have .env.dt.${nodeEnv} file`)
    }

    // Read and parse the .env.dt.{environment} file.
    // const targetDotEnvDt = dotenv.parse(fs.readFileSync(targetDtEnvFile, "utf-8"))
    const targetDotEnvDt = patchEnvs(targetDtEnvFile)
    // Check if AWS credentials are set.
    if (
      ObjectType.isEmpty(targetDotEnvDt.AWS_REGION) ||
      ObjectType.isEmpty(targetDotEnvDt.AWS_ACCESS_KEY) ||
      ObjectType.isEmpty(targetDotEnvDt.AWS_SECRET_KEY)
    ) {
      // throw new Error("AWS credentials are not set in the environment")
      console.error("AWS credentials are not set in the environment")
      return false
    }

    return true
  }

  // NOTE: Validates required environment variables from the .env.dt.{environment} file. Called by validateEnvironment.
  private validateRequiredVariables(
    TARGET_DIR: string,
    targetEnvironment: string | undefined = undefined,
  ): boolean {
    // Determine the target environment.
    const nodeEnv: string | undefined =
      targetEnvironment || this.checkTargetEnvironment(TARGET_DIR, targetEnvironment, false)

    if (!nodeEnv) {
      return false
    }

    const dtEnvFile = path.join(TARGET_DIR, `.env.dt.${nodeEnv}`)

    // Load environment variables from .env.dt.{stage} file
    const envConfig = patchEnvs(dtEnvFile)

    // Define required variables and their validation rules
    const requiredVars = {
      DEPLOYMENT_TYPE: (value: string) => ["single", "asg"].includes(value),
      AWS_PROFILE: (value: string) => value.length > 0,
      AWS_REGION: (value: string) => /^[a-z]{2}-[a-z]+-\d$/.test(value),
      AWS_ACCOUNT_ID: (value: string) => /^[0-9]{12}$/.test(value),
      AWS_ACCESS_KEY: (value: string) => /^[A-Z0-9]{20}$/.test(value),
      AWS_SECRET_KEY: (value: string) => value.length >= 40,
      VPC_ID: (value: string) => /^vpc-[a-f0-9]{17}$/.test(value),
      IGW_ID: (value: string) => /^igw-[a-f0-9]{17}$/.test(value),
      SSL_CERTIFICATE_ARN: (value: string) => /^arn:aws:acm:[a-z]{2}-[a-z]+-\d+:\d+:certificate\/[a-z0-9-]+$/.test(value),
      AMI_ID: (value: string) => /^ami-[a-f0-9]{17}$/.test(value),
      INSTANCE_TYPES: (value: string) => {
        try {
          const types = JSON.parse(value)
          return (
            Array.isArray(types) &&
            types.length > 0 &&
            types.every((type: string) => /^[a-z1-9.]+$/.test(type))
          )
        } catch {
          return false
        }
      },
      ECR_REGISTRY: (value: string) => /^[0-9]{12}.dkr.ecr.[a-z]{2}-[a-z]+-\d+.amazonaws.com$/.test(value),
      ECR_REPOSITORY_NAME: (value: string) => value.length > 0,
      CODEDEPLOY_APP_NAME: (value: string) => value.length > 0,
      CODEDEPLOY_GROUP_NAME: (value: string) => value.length > 0,
      CODEDEPLOY_S3_BUCKET: (value: string) => value.length > 0,
      BITBUCKET_APP_PASSWORD: (value: string) => value.length > 0,
      BITBUCKET_WORKSPACE: (value: string) => value.length > 0,
      BITBUCKET_BRANCH: (value: string) => value.length > 0,
    }

    const missingVars: string[] = []
    const invalidVars: string[] = []

    Object.entries(requiredVars).forEach(([varName, validationFn]) => {
      if (!(varName in envConfig)) {
        missingVars.push(varName)
      } else if (!validationFn(envConfig[varName])) {
        invalidVars.push(varName)
      }
    })

    const checkPoint: Record<string, boolean> = {
      missingVars: true,
      invalidVars: true,
      requiredVars: true,
    }

    if (missingVars.length > 0) {
      // throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`)
      console.error(`Missing required environment variables: ${missingVars.join(", ")}`)
      checkPoint.missingVars = false
    }

    if (invalidVars.length > 0) {
      // throw new Error(`Invalid environment variables: ${invalidVars.join(", ")}`)
      console.error(`Invalid environment variables: ${invalidVars.join(", ")}`)
      checkPoint.invalidVars = false
    }

    // Additional validation for deployment-specific variables
    if (envConfig.DEPLOYMENT_TYPE === "asg") {
      const asgVars = [
        "SSL_CERTIFICATE_ARN",
        "ASG_DESIRED_CAPACITY",
        "ASG_MIN_SIZE",
        "ASG_MAX_SIZE",
      ]
      const missingAsgVars = asgVars.filter((varName) => !(varName in envConfig))
      if (missingAsgVars.length > 0) {
        // throw new Error(`Missing required ASG environment variables: ${missingAsgVars.join(", ")}`)
        console.error(`Missing required ASG environment variables: ${missingAsgVars.join(", ")}`)
        checkPoint.requiredVars = false
      }
    }

    return Object.values(checkPoint).some((value) => value === false) ? false : true

    // return true
  }

  // NOTE: Asynchronously validates that required tools are installed. Called by validateEnvironment.
  private async validateRequiredTools(): Promise<boolean> {
    // Define the required tools and their minimum versions.
    // TODO: temporary hardcoded version
    const requiredTools = {
      node: { requirement: ">=", version: "20.0.0" },
      npm: { requirement: ">=", version: "9.0.0" },
      aws: { requirement: ">=", version: "2.0.0" },
      docker: { requirement: ">=", version: "20.0.0" },
      terraform: { requirement: ">=", version: "1.0.0" },
      git: { requirement: ">=", version: "2.0.0" },
    }

    // Iterate over the required tools and check their versions.
    for (const [tool, version] of Object.entries(requiredTools)) {
      try {
        const toolVersion = await execAsync(`${tool} --version`)
        // const reExtractVersion = /\d+\.\d+\.\d+/gi
        // version may contain alphanumeric characters, hyphens, periods, underscores, and max 4 segments
        const reExtractVersion = /\d+\.\d+\.\d+(?:-\w+)?/gi
        const extractVersion = reExtractVersion.exec(toolVersion.stdout.trim().replace("\n", ""))
        // const isVersionSatisfied: boolean = !compare(
        //   extractVersion?.[0] as string,
        //   version.version,
        //   version.requirement as CompareOperator,
        // )
        const extractedVersion = (extractVersion?.[0] as string).replace(" ", "")
        const isVersionSatisfied: boolean = satisfies(
          extractedVersion,
          `${version.requirement}${version.version}`,
        )

        const isVersionCorrect: boolean = compare(
          extractedVersion,
          version.version,
          version.requirement as CompareOperator,
        )

        console.log(
          `${isVersionSatisfied && isVersionCorrect ? "✅" : "❌"} Found ${tool}: version ${extractedVersion} (Required: ${version.requirement}${version.version})`,
        )
      } catch (error) {
        console.error(`Error checking ${tool} version:`, error)
        // throw new Error(`${tool} is not installed or not in PATH`)
      }
    }

    return true
  }
}
