import fs from "node:fs"
import path from "node:path"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import { satisfies, compare, CompareOperator } from "compare-versions"

import { ObjectType } from "../utils/object"
import { patchEnvs } from "../utils/env"
import { Configuration } from "../utils/configuration"

// Promisify the exec function for asynchronous execution of shell commands.
const execAsync = promisify(exec)

export class ValidateEnvironment {
  private projectRoot: string

  // Constructor initializes the Deploy class with the target environment.
  // NOTE: It sets the project root directory, target environment, and initializes other properties.
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot || Configuration.projectRoot
  }

  public async run(): Promise<{ stage: string | undefined }> {
    const validResult = await this.validates(undefined, false)
    if (ObjectType.isEmpty(validResult)) {
      throw new Error(
        `Checks failed!. Update configuration files, or use "init" command force option "init -f" to assist in creating environment files.`,
      )
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
    targetStage: string | undefined = undefined,
    doForce: boolean = false,
  ): Promise<string | undefined> {
    const checkPoint: {
      stage?: string | undefined
      targetStage?: boolean
      dtEnvFile?: boolean
      awsCredentials?: boolean
      requiredVariables?: { valid: boolean; invalid: string[] }
      requiredTools?: boolean
    } = {}

    try {
      // Determine the target environment, prioritizing the provided argument, then the NODE_ENV environment variable.
      targetStage = this.checkTargetEnvironment(targetStage, doForce)
      checkPoint.targetStage = !!targetStage
    } catch (error) {
      console.error("Error checking target environment:", error)
      checkPoint.targetStage = false
    }
    checkPoint.stage = targetStage
    console.info(
      `${ObjectType.isEmpty(checkPoint.targetStage) ? "❌ Invalid Stage" : "✅ Target stage"}`,
    )

    try {
      // Check for and create the .env.dt.{environment} file if it doesn't exist and doForce is true.
      checkPoint.dtEnvFile = this.checkDtEnvFile(targetStage, doForce)
    } catch (error) {
      console.error("Error checking .env.dt.{environment} file:", error)
      checkPoint.dtEnvFile = false
    }
    console.info(`${checkPoint.dtEnvFile ? "✅ dt Configuration" : "❌ Invalid Configuration"}`)

    try {
      checkPoint.awsCredentials = this.validateAwsCredentials(targetStage)
    } catch (error) {
      console.error("Error validating AWS credentials:", error)
      checkPoint.awsCredentials = false
    }
    console.info(
      `${checkPoint.awsCredentials ? "✅ AWS credentials" : "❌ Invalid AWS Credentials"}`,
    )

    try {
      checkPoint.requiredVariables = this.validateRequiredVariables(targetStage)
    } catch (error) {
      console.error("Error validating required environment variables:", error)
      checkPoint.requiredVariables = { valid: false, invalid: [(error as Error).message] }
    }
    console.info(
      checkPoint.requiredVariables.valid
        ? "✅ Required environment variables"
        : `❌ Invalid Required Variables:\n   - ${checkPoint.requiredVariables?.invalid.join("\n   - ")}`,
    )

    console.log()
    try {
      // Asynchronously validate that required tools (node, npm, terraform, aws, docker, git) are installed.
      checkPoint.requiredTools = await this.validateRequiredTools()
    } catch (error) {
      console.error("Error validating required tools:", error)
      checkPoint.requiredTools = false
    }
    console.info(`${checkPoint.requiredTools ? "✅" : "❌"} Required tools`)

    console.log()

    return Object.values(checkPoint).some((value) => value === false) ? undefined : targetStage

    // return checkPoint.stage
  }

  // NOTE: Determines the target environment.  Prioritizes explicitly provided environment, then checks process.env.NODE_ENV,
  // then falls back to creating a .env file if doForce is true.  Called by validateEnvironment and checkDtEnvFile.
  private checkTargetEnvironment(
    targetStage: string | undefined = undefined,
    doForce: boolean = false,
  ): string | undefined {
    // Prioritize explicitly provided environment, then check process.env.NODE_ENV.
    targetStage = targetStage || process.env.NODE_ENV

    let nodeEnv: string | undefined = targetStage

    const targetEnvFile = Configuration.envFile
    try {
      const envConfig = Configuration.envConfig
      nodeEnv = envConfig?.NODE_ENV
    } catch (error) {
      if (!doForce) {
        // console.error(`Error reading .env file: ${(error as Error).message}`)
        return
      }

      if (ObjectType.isEmpty(targetStage)) {
        const exampleEnvFile = path.join(__dirname, "../templates/environments/.env-example")
        fs.copyFileSync(exampleEnvFile, targetEnvFile)
      } else {
        fs.writeFileSync(targetEnvFile, `NODE_ENV="${targetStage}"\n`, "utf8")
      }
      nodeEnv = targetStage || patchEnvs(targetEnvFile)?.NODE_ENV
    }

    if (!nodeEnv) {
      // throw new Error("Target environment is not set")
      console.error("❌ Target environment is not set")
      return
    }

    return nodeEnv
  }

  // NOTE: Checks if the .env.dt.{environment} file exists. If not and doForce is true, it creates one.
  // Uses checkTargetEnvironment to determine the environment.  Called by validateEnvironment.
  private checkDtEnvFile(
    targetStage: string | undefined = undefined,
    doForce: boolean = false,
  ): boolean {
    // Determine the target environment.
    const nodeEnv: string | undefined =
      targetStage || this.checkTargetEnvironment(targetStage, doForce)

    if (!nodeEnv) {
      return false
    }

    const targetDtEnvFile = Configuration.dtEnvFile
    try {
      const dtEnvConfig = Configuration.dtEnvConfig
      return !ObjectType.isEmpty(dtEnvConfig)
    } catch (error) {
      if (!doForce) {
        // console.error(`Error reading .env.dt.${nodeEnv} file: ${(error as Error).message}`)
        return false
      }

      const exampleDtEnvFile = path.join(
        __dirname,
        "../templates/environments/.env.dt.stage-example",
      )
      // Copy the example .env.dt.stage file.
      fs.copyFileSync(exampleDtEnvFile, targetDtEnvFile)
      return true
    }
  }

  // NOTE: Validates AWS credentials from the .env.dt.{environment} file. Called by validateEnvironment.
  private validateAwsCredentials(
    targetStage: string | undefined = undefined,
    doForce: boolean = false,
  ): boolean {
    // Determine the target environment.
    const nodeEnv: string | undefined =
      targetStage || this.checkTargetEnvironment(targetStage, false)

    if (!nodeEnv) {
      return false
    }

    const targetDtEnvFile = Configuration.dtEnvFile

    const exampleDtEnvFile = path.join(__dirname, "../templates/environments/.env.dt.stage-example")

    let dtEnvConfig: Record<string, string>
    try {
      dtEnvConfig = Configuration.dtEnvConfig

      if (ObjectType.isEmpty(dtEnvConfig)) {
        fs.copyFileSync(exampleDtEnvFile, targetDtEnvFile)
        console.warn(`❗️ WARN: Update configuration within .env.dt.${nodeEnv} file.`)
        return false
      }
    } catch (error) {
      if (!doForce) {
        // console.error(`Error reading .env.dt.${nodeEnv} file: ${(error as Error).message}`)
        return false
      }
    }

    // Check if AWS credentials are set.
    if (
      ObjectType.isEmpty(dtEnvConfig.AWS_REGION) ||
      ObjectType.isEmpty(dtEnvConfig.AWS_ACCESS_KEY) ||
      ObjectType.isEmpty(dtEnvConfig.AWS_SECRET_KEY)
    ) {
      // throw new Error("AWS credentials are not set in the environment")
      console.error("AWS credentials are not set in the environment")
      return false
    }

    return true
  }

  // NOTE: Validates required environment variables from the .env.dt.{environment} file. Called by validateEnvironment.
  private validateRequiredVariables(targetStage: string | undefined = undefined): {
    valid: boolean
    invalid: string[]
  } {
    // Determine the target environment.
    const nodeEnv: string | undefined =
      targetStage || this.checkTargetEnvironment(targetStage, false)

    // Define required variables and their validation rules
    const requiredVars = {
      // NODE_ENV: (value: string) => (value.length > 0 && ["staging","production"].includes(value)),
      PROJECT_NAME: (value: string) => value.length > 0,

      DEPLOYMENT_TYPE: (value: string) => ["single", "asg"].includes(value),

      AWS_PROFILE: (value: string) => value.length > 0,
      AWS_REGION: (value: string) => /^[a-z]{2}-[a-z]+-\d$/.test(value),
      AWS_ACCOUNT_ID: (value: string) => /^[0-9]{12}$/.test(value),
      AWS_ACCESS_KEY: (value: string) => /^[A-Z0-9]{20}$/.test(value),
      AWS_SECRET_KEY: (value: string) => value.length >= 40,

      VPC_ID: (value: string) => /^vpc-[a-f0-9]{17}$/.test(value),
      IGW_ID: (value: string) => /^igw-[a-f0-9]{17}$/.test(value),

      SSL_CERTIFICATE_ARN: (value: string) =>
        /^arn:aws:acm:[a-z]{2}-[a-z]+-\d+:\d+:certificate\/[a-z0-9-]+$/.test(value),
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

      // ECR_REGISTRY: (value: string) => /^[0-9]{12}.dkr.ecr.[a-z]{2}-[a-z]+-\d+.amazonaws.com$/.test(value),
      // ECR_REPOSITORY_NAME: (value: string) => value.length > 0,

      // CODEDEPLOY_APP_NAME: (value: string) => value.length > 0,
      // CODEDEPLOY_GROUP_NAME: (value: string) => value.length > 0,
      // CODEDEPLOY_S3_BUCKET: (value: string) => value.length > 0,

      BITBUCKET_USERNAME: (value: string) => value.length > 0,
      BITBUCKET_APP_PASSWORD: (value: string) => value.length > 0,
      BITBUCKET_WORKSPACE: (value: string) => value.length > 0,
      BITBUCKET_BRANCH: (value: string) => value.length > 0,
    }

    const missingVars: string[] = []
    const invalidVars: string[] = []

    if (!nodeEnv) {
      return { valid: false, invalid: ["NODE_ENV"].concat(Object.keys(requiredVars)) }
    }

    // Load environment variables from .env.dt.{stage} file
    let envConfig: Record<string, string>
    let dtEnvConfig: Record<string, string>
    try {
      envConfig = Configuration.envConfig
      const __dtEnvConfig = Configuration.dtEnvConfig
      dtEnvConfig = { ...envConfig, ...__dtEnvConfig }
    } catch (error) {
      // console.error(`Error reading .env.dt.${nodeEnv} file: ${(error as Error).message}`)
      return { valid: false, invalid: Object.keys(requiredVars) }
    }

    Object.entries(requiredVars).forEach(([varName, validationFn]) => {
      if (!(varName in dtEnvConfig)) {
        missingVars.push(varName)
      } else if (!validationFn(dtEnvConfig[varName])) {
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
    if (dtEnvConfig.DEPLOYMENT_TYPE === "asg") {
      const asgVars = [
        "SSL_CERTIFICATE_ARN",
        "ASG_DESIRED_CAPACITY",
        "ASG_MIN_SIZE",
        "ASG_MAX_SIZE",
      ]
      const missingAsgVars = asgVars.filter((varName) => !(varName in dtEnvConfig))
      if (missingAsgVars.length > 0) {
        // throw new Error(`Missing required ASG environment variables: ${missingAsgVars.join(", ")}`)
        console.error(`Missing required ASG environment variables: ${missingAsgVars.join(", ")}`)
        checkPoint.requiredVars = false
      }
    }

    return Object.values(checkPoint).some((value) => value === false)
      ? { valid: false, invalid: [].concat(missingVars, invalidVars) }
      : { valid: true, invalid: [] }

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
        // version may contain alphanumeric characters, hyphens, periods, underscores, and max 4 segments
        // const reExtractVersion = /\d+\.\d+\.\d+/gi
        const reExtractVersion = /\d+\.\d+\.\d+(?:-\w+)?/gi

        const extractVersion = reExtractVersion.exec(toolVersion.stdout.trim().replace("\n", ""))
        const extractedVersion = (extractVersion?.[0] as string).replace(" ", "")

        // const isVersionSatisfied: boolean = !compare(
        //   extractVersion?.[0] as string,
        //   version.version,
        //   version.requirement as CompareOperator,
        // )
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
