import * as fs from "node:fs"
import * as path from "node:path"
import { execSync } from "node:child_process"
import dotenv from "dotenv"
import prompts from "prompts"
import { ObjectType } from "../utils/object"
import { patchEnvs } from "../utils/env"
import { handleError } from "../utils/error.handler"

export enum DestroyType {
  Full = "full",
  Partial = "partial",
}

export interface RollbackOptions {
  targetEnvironment?: string
  destroyType?: DestroyType | undefined
}

export class Rollback {
  private projectRoot: string
  private targetEnvironment: string
  private deploymentType: string | undefined
  private destroyType: DestroyType | undefined
  private force: boolean
  private terraformDir: string
  private enVars: { [key: string]: string }
  private tfVars: string[]

  constructor(
    targetEnvironment?: string,
    destroyType?: DestroyType | undefined,
    force: boolean = false,
  ) {
    this.projectRoot = process.cwd()
    this.targetEnvironment = targetEnvironment || ""
    this.deploymentType = ""
    this.destroyType = destroyType
    this.force = force
    this.terraformDir = ""
    this.enVars = {}
    this.tfVars = []
  }

  async run(): Promise<void> {
    try {
      // If targetEnvironment is not provided, prompt for selection
      if (!this.targetEnvironment) {
        this.targetEnvironment = await this.selectTargetEnvironment()
      }

      if (this.targetEnvironment === "exit") {
        console.log("Rollback cancelled.")
        return
      }

      console.info(`🔄 Starting rollback for ${this.targetEnvironment}...`)
      console.info(`👁️ ${this.projectRoot}`)

      // Retrieves environment variables and Terraform variables from checkEnvironmentVariables().
      const { enVars, tfVars } = this.checkEnvironmentVariables()
      this.enVars = enVars
      this.tfVars = tfVars

      // Set terraform directory
      this.terraformDir = path.join(this.projectRoot, ".terraforms", this.targetEnvironment)

      if (!fs.existsSync(this.terraformDir)) {
        throw new Error(`Terraform directory not found for environment: ${this.targetEnvironment}`)
      }

      // Determines the deployment type based on the files present in the Terraform directory.
      this.deploymentType = this.checkDeploymentType(this.terraformDir)

      // Change to terraform directory
      process.chdir(this.terraformDir)

      // Prompt for destroy type
      const selectedDestroyType = this.destroyType ? this.destroyType : await this.selectDestroyType()

      // Initialize terraform
      this.runInit()

      // Run destroy based on selected type
      await this.runDestroy(selectedDestroyType, this.force)

      console.info("✅ Rollback completed successfully.")
    } catch (error) {
      handleError("Rollback failed", error)
      process.exit(1)
    }
  }

  // checkEnvironmentVariables checks for required and optional environment variables.
  // NOTE: It reads environment variables from .env and .env.dt.<NODE_ENV> files.  Interacts with the file system and environment variables.
  private checkEnvironmentVariables(): { enVars: { [key: string]: string }; tfVars: string[] } {
    let NODE_ENV = process.env.NODE_ENV
    let dotEnv: dotenv.DotenvParseOutput = {}

    if (ObjectType.isEmpty(NODE_ENV)) {
      const envFile = path.join(this.projectRoot, ".env")

      if (!fs.existsSync(envFile)) {
        console.error(`${envFile} file not found. Please create it.`)
        process.exit(1)
      } else {
        // dotEnv = dotenv.parse(fs.readFileSync(envFile))
        dotEnv = patchEnvs(envFile)
        console.log(`✅ .env`)
      }

      process.env.NODE_ENV = dotEnv.NODE_ENV
      NODE_ENV = dotEnv.NODE_ENV
    } else {
      dotEnv["NODE_ENV"] = process.env.NODE_ENV as string
    }

    const dtEnvFile = path.join(this.projectRoot, `.env.dt.${NODE_ENV}`)

    let dtEnv: dotenv.DotenvParseOutput
    if (!fs.existsSync(dtEnvFile)) {
      console.warn(`WARN: ${dtEnvFile} file not found. Please create it.`)
      dtEnv = {}
    } else {
      // dtEnv = dotenv.parse(fs.readFileSync(dtEnvFile))
      dtEnv = patchEnvs(dtEnvFile)
      console.log(`✅ .env.dt.${NODE_ENV}\n`)
    }

    const requiredEnvVars = ["NODE_ENV"]
    const requiredDtEnvVars = [
      "DEPLOYMENT_TYPE",
      "PROJECT_NAME",

      "AWS_PROFILE",
      "AWS_REGION",
      "AWS_ACCOUNT_ID",
      "AWS_ACCESS_KEY",
      "AWS_SECRET_KEY",

      "VPC_ID",
      "IGW_ID",

      "AMI_ID",
      "INSTANCE_TYPES",

      // "ECR_REGISTRY",
      // "ECR_REPOSITORY_NAME",

      // "CODEDEPLOY_APP_NAME",
      // "CODEDEPLOY_GROUP_NAME",
      // "CODEDEPLOY_S3_BUCKET",

      "BITBUCKET_APP_PASSWORD",
      "BITBUCKET_WORKSPACE",
      "BITBUCKET_BRANCH",
    ]

    if (this.deploymentType === "asg") {
      requiredDtEnvVars.push("SSL_CERTIFICATE_ARN")
    }

    const envs = { ...dotEnv, ...dtEnv }
    requiredEnvVars.concat(requiredDtEnvVars).forEach((varName) => {
      console.info(
        `${envs[varName] ? `🔹` : `🔸`} ${varName}`.padEnd(40, " ") + `: ${envs[varName]}`,
      )
    })

    const missingVars = requiredEnvVars.concat(requiredDtEnvVars).filter((varName) => {
      return !envs[varName]
    })

    if (missingVars.length > 0) {
      console.error(`Some variables are not set in required environment files:`)
      missingVars.forEach((varName) => console.error(`- ${varName}`))
      process.exit(1)
    }
    console.info(`✅ Required environment variables are set.\n`)

    // The rest of the variables are optional
    const optionalVars = Object.keys(envs).filter(
      (key) => !requiredEnvVars.concat(requiredDtEnvVars).includes(key),
    )
    optionalVars.forEach((varName) => {
      console.info(
        `${envs[varName] ? `💧` : `🩸`} ${varName}`.padEnd(40, " ") + `: ${envs[varName]}`,
      )
    })
    console.info(`✅ Optional environment variables are set.\n`)

    // Set Terraform environment variables
    const expTfVars: string[] = Object.keys(envs).map((key) => {
      const value = envs[key]
      if (key === "INSTANCE_TYPES") {
        process.env[`TF_VAR_instance_types`] = value
        return `TF_VAR_instance_types=${value}`
      } else {
        process.env[`TF_VAR_${key.toLowerCase()}`] = value
        return `TF_VAR_${key.toLowerCase()}=${value}`
      }
    })

    return { enVars: envs, tfVars: expTfVars }
  }

  // checkTargetEnvironment checks for the existence of .terraforms directory and its contents.
  // NOTE: It throws an error if the directory or its contents are missing.  Interacts with the file system.
  private checkTargetEnvironment(): string[] {
    // Check in Project root directory for .terraforms directory
    const dotTerraformsDir = path.join(this.projectRoot, ".terraforms")
    if (!fs.existsSync(dotTerraformsDir)) {
      throw new Error(".terraforms not exists for any environments.")
    }

    // Check if .terraforms directory has some target environments
    const targetEnvironments = fs.readdirSync(path.join(this.projectRoot, ".terraforms"))

    if (ObjectType.isEmpty(targetEnvironments)) {
      throw new Error(".terraforms has no initialized target environments.")
    }

    return targetEnvironments
  }

  // selectTargetEnvironment prompts the user to select a target environment from available options.
  // NOTE: It uses the prompts library to create an interactive selection menu. Interacts with the user.
  private async selectTargetEnvironment(): Promise<string> {
    const response = await prompts({
      type: "select",
      name: "selectedEnvironment",
      message: "Select environment to rollback:",
      choices: this.checkTargetEnvironment()
        .concat("exit")
        .map((targetEnvironment) => {
          return {
            title: targetEnvironment,
            value: targetEnvironment,
          }
        }),
    })

    if (response.selectedEnvironment === "exit") {
      console.log("Exiting...")
      process.exit(0)
    }
    return response.selectedEnvironment
  }

  // checkDeploymentType checks for the deployment type (SINGLE.md or ASG.md) in the Terraform directory.
  // NOTE: It throws an error if the deployment type is not found or ambiguous. Interacts with the file system.
  private checkDeploymentType(terraformDir: string): string {
    const deploymentTypes = fs.readdirSync(terraformDir)
    if (ObjectType.isEmpty(deploymentTypes)) {
      throw new Error(`No deployment types found in ${terraformDir}`)
    }

    // check if deploymentTypes contains "SINGLE.md" or "ASG.md"
    const deploymentTypeFiles = deploymentTypes.filter((file) => file.endsWith(".md"))

    if (ObjectType.isEmpty(deploymentTypeFiles) || deploymentTypeFiles.length !== 1) {
      throw new Error(
        `Unknown deployment type in ${terraformDir}. Missing one between SINGLE.md and ASG.md`,
      )
    }

    return deploymentTypes[0]
  }

  private async selectDestroyType(): Promise<DestroyType> {
    const response = await prompts({
      type: "select",
      name: "destroyType",
      message: "Select destroy type:",
      choices: [
        { title: "Full Destroy (All Resources)", value: DestroyType.Full },
        { title: "Partial Destroy (Exclude VPC and IGW)", value: DestroyType.Partial },
        { title: "Exit", value: "exit" },
      ],
    })

    if (response.destroyType === "exit") {
      console.log("Rollback cancelled.")
      process.exit(0)
    }

    return response.destroyType as DestroyType
  }

  private runInit(): void {
    try {
      console.info("Initializing Terraform...")
      execSync("terraform init", { stdio: "inherit" })
    } catch (error) {
      throw new Error(`Terraform initialization failed: ${error}`)
    }
  }

  private async runDestroy(destroyType: DestroyType | undefined, force: boolean = false): Promise<void> {
    try {
      console.info(`Running ${destroyType} destroy...`)

      if (destroyType === "partial") {
        // Destroy resources in reverse dependency order
        const resources = [
          // First layer - dependent resources
          "aws_autoscaling_attachment.asg_attachment_alb",
          "aws_autoscaling_lifecycle_hook.termination_hook",
          "aws_autoscaling_policy.cpu_policy",
          "aws_autoscaling_policy.memory_policy",
          "aws_cloudwatch_metric_alarm.high_cpu",
          // Second layer - core resources
          "aws_codedeploy_deployment_group.app_dg",
          "aws_autoscaling_group.app",
          "aws_lb_listener.http",
          "aws_lb_listener.https",
          "aws_lb.app",
          "aws_launch_template.app",
          // Third layer - supporting resources
          "aws_ecr_repository.app_repo",
          "aws_codedeploy_app.app",
          "aws_lb_target_group.app",
          "aws_iam_role_policy_attachment.codedeploy_policy",
          "aws_iam_role_policy_attachment.ec2_policy",
          "aws_iam_instance_profile.ec2_profile",
          "aws_iam_role.codedeploy_role",
          "aws_iam_role.ec2_role",
          "aws_key_pair.dt_keypair",
          "local_file.dt_rsa_private",
          "tls_private_key.dt_private",
          // Fourth layer - network resources (except VPC and IGW)
          "aws_ssm_parameter.current_instance_type",
          "aws_route_table_association.public[0]",
          "aws_route_table_association.public[1]",
          "aws_route_table.public",
          "aws_subnet.public[0]",
          "aws_subnet.public[1]",
          "aws_security_group.ec2",
          "aws_security_group.alb",
        ]

        // build a string of all the resources to destroy
        const targetParamsAtOnce = resources.reduce((acc, resource) => {
          return acc + ` -target=${resource}`
        }, "")

        console.info(`Destroying partially (excludes VPC and IGW)...`)

        // execSync(`terraform destroy ${targetParamsAtOnce} -auto-approve`, { stdio: "inherit" })
        execSync(`terraform destroy ${targetParamsAtOnce}${force ? " -auto-approve" : ""}`, { stdio: "inherit" })
      } else {
        // Full destroy including VPC and IGW
        // execSync("terraform destroy -auto-approve", { stdio: "inherit" })
        execSync(`terraform destroy${force ? " -auto-approve" : ""}`, { stdio: "inherit" })
      }
    } catch (error) {
      throw new Error(`Terraform destroy failed: ${error}`)
    }
  }
}
