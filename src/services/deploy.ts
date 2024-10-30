import * as fs from "node:fs"
import * as path from "node:path"
import { execSync } from "node:child_process"
import dotenv from "dotenv"
import prompts from "prompts"
import {
  EC2Client,
  DescribeVpcsCommand,
  DescribeInternetGatewaysCommand,
  DescribeVpcsResult,
  DescribeInternetGatewaysResult,
} from "@aws-sdk/client-ec2"
import _ from "lodash"
import { TFState } from "../interfaces/tfstate"
import { ObjectType } from "../utils/object"

// dotenv.config()

// Deploy class handles the deployment of infrastructure using Terraform.
// NOTE: It interacts with environment variables, Terraform state files, and executes Terraform commands.
export class Deploy {
  private projectRoot: string
  private targetEnvironment: string
  private deploymentType: string | undefined
  private terraformDir: string
  private enVars: { [key: string]: string }
  private tfVars: string[]

  private optCreateNewVpc: boolean

  // Constructor initializes the Deploy class with the target environment.
  // NOTE: It sets the project root directory, target environment, and initializes other properties.
  constructor(targetEnvironment: string, createNewVpc: boolean = false) {
    this.projectRoot = process.cwd()
    this.targetEnvironment = targetEnvironment
    this.terraformDir = ""
    this.enVars = {}
    this.tfVars = []

    this.optCreateNewVpc = createNewVpc
  }

  // run method orchestrates the entire deployment process.
  // NOTE: It handles environment variable checks, Terraform initialization, resource import, plan generation, and application.
  async run(): Promise<{
    vpcId?: string | null | undefined
    igwId?: string | null | undefined
  }> {
    // If targetEnvironment is not provided, it prompts the user to select one.
    if (!this.targetEnvironment) {
      this.targetEnvironment = await this.selectTargetEnvironment()
    }

    console.info(`🚀 Starting deployment into ${this.targetEnvironment}...`)
    console.info(`👁️ ${this.projectRoot}`)

    // Retrieves environment variables and Terraform variables from checkEnvironmentVariables().
    const { enVars, tfVars } = this.checkEnvironmentVariables()
    this.enVars = enVars
    this.tfVars = tfVars

    // Sets the Terraform directory based on the project root and target environment.
    this.terraformDir = path.join(this.projectRoot, ".terraforms", this.targetEnvironment)

    // Determines the deployment type based on the files present in the Terraform directory.
    this.deploymentType = this.checkDeploymentType(this.terraformDir)

    // Changes the current working directory to the Terraform directory.
    process.chdir(this.terraformDir)

    const ec2Client = new EC2Client({
      region: this.enVars.AWS_REGION,
      credentials: {
        accessKeyId: this.enVars.AWS_ACCESS_KEY,
        secretAccessKey: this.enVars.AWS_SECRET_KEY,
      },
    })

    try {
      // Sets auto-approval for Terraform apply to false.
      const tfApplyAutoApprove = false

      // Initializes Terraform.
      this.runInit()

      // Get current VPC and IGW IDs from Terraform state
      const checkTfStateResult = this.checkTfState()

      let vpcStateValid = undefined
      let igwStateValid = undefined
      let vpcConfigValid = undefined
      let igwConfigValid = undefined

      try {
        // When Terraform state file does not exists, import existing resources..
        if (!checkTfStateResult.tfStateExists) {
          console.info("❓ Terraform state file not exists. Checking resources...")

          // Imports existing VPC if it's not already managed by Terraform state.
          if (ObjectType.isEmpty(checkTfStateResult.vpcExists)) {
            const vpcResource = await this.checkAwsVpc(ec2Client, [
              checkTfStateResult.vpcExists as string,
            ])
            vpcStateValid = vpcResource.valid ? vpcResource.id : undefined
            // this.runImport(`aws_vpc.VPC "${this.enVars.VPC_ID}"`)
          }

          // Imports existing IGW if it's not already managed by Terraform state.
          if (ObjectType.isEmpty(checkTfStateResult.igwExists)) {
            const igwResource = await this.checkAwsIgw(ec2Client, [
              checkTfStateResult.igwExists as string,
            ])
            igwStateValid = igwResource.valid ? igwResource.id : undefined
            // this.runImport(`aws_internet_gateway.InternetGateway "${this.enVars.IGW_ID}"`)
          }
        } else {
          // If Terraform state exists, it skips importing existing resources unless they are missing.
          console.info("✅ Terraform state file found. Skipping import of existing resources.")

          if (!ObjectType.isEmpty(this.enVars.VPC_ID)) {
            const vpcResource = await this.checkAwsVpc(ec2Client, [this.enVars.VPC_ID])
            vpcConfigValid = vpcResource.valid ? vpcResource.id : undefined
          }

          if (!ObjectType.isEmpty(this.enVars.IGW_ID)) {
            const igwResource = await this.checkAwsIgw(ec2Client, [this.enVars.IGW_ID])
            igwConfigValid = igwResource.valid ? igwResource.id : undefined
          }
        }

        console.log(
          `Terraform States:\n` +
            `- VPC: ${!vpcStateValid ? "❌" : "✅"} - ${vpcStateValid}\n` +
            `- IGW: ${!igwStateValid ? "❌" : "✅"} - ${igwStateValid}\n`,
        )
        console.log(
          `Configured Values:\n` +
            `- VPC: ${!vpcConfigValid ? "❌" : "✅"} - ${vpcConfigValid}\n` +
            `- IGW: ${!igwConfigValid ? "❌" : "✅"} - ${igwConfigValid}\n`,
        )

        // When State is valid and Configured is valid, use State, fix Configured, do not import terraform resources
        // When State is valid and Configured is invalid, use State, fix Configured, do import terraform resources
        // When State is invalid and Configured is valid, use Configured, remove State, do import terraform resources
        // When State is invalid and Configured is invalid, use Configured, remove State, do not import terraform resources
        if (vpcStateValid && igwStateValid) {
          // Update values in .env.dt.{targetEnvironment}
          this.updateEnvFile(this.targetEnvironment, {
            VPC_ID: checkTfStateResult.vpcExists as string,
            IGW_ID: checkTfStateResult.igwExists as string,
          })
          this.enVars.VPC_ID = checkTfStateResult.vpcExists as string
          this.enVars.IGW_ID = checkTfStateResult.igwExists as string

          if (!(vpcConfigValid && igwConfigValid)) {
            // Import existing VPC and IGW
            this.runImport(`aws_vpc.VPC "${this.enVars.VPC_ID}"`)
            this.runImport(`aws_internet_gateway.InternetGateway "${this.enVars.IGW_ID}"`)
          }
        } else {
          if (vpcConfigValid && igwConfigValid) {
            // Rename to backup Terraform state file
            const tfStateFile = path.join(this.terraformDir, "terraform.tfstate")
            const backupStateFile = path.join(
              this.terraformDir,
              `terraform.tfstate.${Date.now()}.backup`,
            )
            fs.renameSync(tfStateFile, backupStateFile)

            // Import existing VPC and IGW
            this.runImport(`aws_vpc.VPC "${this.enVars.VPC_ID}"`)
            this.runImport(`aws_internet_gateway.InternetGateway "${this.enVars.IGW_ID}"`)
          }
        }

        this.runInit()
      } catch (error) {
        process.chdir(this.projectRoot)
        console.error("Error checking Terraform state:", error)
        throw error
      }
      console.log()

      // Generates a Terraform plan.
      this.runPlan({
        destroy: false,
        refresh: true,
        refreshOnly: false,
        generateConfig: false,
        planFile: path.join(this.terraformDir, "infra.plan"),
      })
      console.log()

      // Applies the Terraform plan.
      this.runApply(tfApplyAutoApprove)
      console.log()

      // Shows the Terraform status.
      this.runStatus()
      console.log()

      // Shows the Terraform resources.
      this.runShow()
      console.log()

      return { vpcId: this.enVars.VPC_ID, igwId: this.enVars.IGW_ID }
    } catch (error) {
      process.chdir(this.projectRoot)
      console.error("❗️ Error executing Terraform:", error)
      process.exit(1)
    }
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
      name: "deploymentType",
      message: "Select target environment:",
      choices: this.checkTargetEnvironment()
        .concat("exit")
        .map((targetEnvironment) => {
          return {
            title: targetEnvironment,
            value: targetEnvironment,
          }
        }),
    })

    if (response.deploymentType === "exit") {
      console.log("Exiting...")
      process.exit(0)
    }
    return response.deploymentType
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

  // selectDeploymentType prompts the user to select a deployment type (single or asg).
  // NOTE: It uses the prompts library to create an interactive selection menu. Interacts with the user.
  private async selectDeploymentType(): Promise<string> {
    const response = await prompts({
      type: "select",
      name: "deploymentType",
      message: "Select deployment type:",
      choices: [
        { title: "single", value: "single" },
        { title: "asg", value: "asg" },
        { title: "exit", value: "exit" },
      ],
    })

    if (response.deploymentType === "exit") {
      console.log("Exiting...")
      process.exit(0)
    }
    return response.deploymentType
  }

  private updateEnvFile(targetEnvironment: string, updates: Record<string, string>): void {
    if (ObjectType.isEmpty(targetEnvironment)) {
      console.warn(`❌ Target environment is empty (${targetEnvironment}). Skipping update.`)
      return
    }

    const envFile = path.join(this.projectRoot, `.env.dt.${targetEnvironment}`)
    console.log(`📝 Updating ${envFile}...`)
    let content = fs.readFileSync(envFile, "utf8")

    Object.entries(updates).forEach(([key, value]) => {
      const regex = new RegExp(`^${key}=.*$`, "m")
      if (content.match(regex)) {
        content = content.replace(regex, `${key}="${value}"`)
      } else {
        content += `\n${key}="${value}"`
      }
    })

    fs.writeFileSync(envFile, content)
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
        dotEnv = dotenv.parse(fs.readFileSync(envFile))
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
      dtEnv = dotenv.parse(fs.readFileSync(dtEnvFile))
      console.log(`✅ .env.dt.${NODE_ENV}\n`)
    }

    const requiredEnvVars = ["NODE_ENV"]
    const requiredDtEnvVars = [
      "DEPLOYMENT_TYPE",
      "AWS_PROFILE",
      "AWS_REGION",
      "AWS_ACCESS_KEY",
      "AWS_SECRET_KEY",
      "VPC_ID",
      "IGW_ID",
      "BITBUCKET_APP_PASSWORD",
      "BITBUCKET_WORKSPACE",
      "BITBUCKET_BRANCH",
      "AMI_ID",
      "ASG_INSTANCE_TYPES",
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
      if (key === "ASG_INSTANCE_TYPES") {
        process.env[`TF_VAR_instance_types`] = value
        return `TF_VAR_instance_types=${value}`
      } else {
        process.env[`TF_VAR_${key.toLowerCase()}`] = value
        return `TF_VAR_${key.toLowerCase()}=${value}`
      }
    })

    return { enVars: envs, tfVars: expTfVars }
  }

  private async checkAwsVpc(
    ec2Client: EC2Client,
    vpcIds: string[],
  ): Promise<{ valid: boolean; id: string | undefined }> {
    if (
      ObjectType.isEmpty(
        _.compact(vpcIds).map((id) => (ObjectType.isEmpty(id.trim()) ? undefined : id.trim())),
      )
    ) {
      return { valid: false, id: undefined }
    }

    try {
      const command = new DescribeVpcsCommand({ VpcIds: vpcIds })
      const response: DescribeVpcsResult = await ec2Client.send(command)
      const resource = (response as DescribeVpcsResult).Vpcs?.[0]?.VpcId || undefined
      return { valid: !!resource, id: resource?.toString() }
    } catch (error) {
      return { valid: false, id: undefined }
    }
  }

  private async checkAwsIgw(
    ec2Client: EC2Client,
    igwIds: string[],
  ): Promise<{ valid: boolean; id: string | undefined }> {
    if (
      ObjectType.isEmpty(
        _.compact(igwIds).map((id) => (ObjectType.isEmpty(id.trim()) ? undefined : id.trim())),
      )
    ) {
      return { valid: false, id: undefined }
    }

    try {
      const command = new DescribeInternetGatewaysCommand({ InternetGatewayIds: igwIds })
      const response: DescribeInternetGatewaysResult = await ec2Client.send(command)
      const resource =
        (response as DescribeInternetGatewaysResult).InternetGateways?.[0]?.InternetGatewayId ||
        undefined
      return { valid: !!resource, id: resource?.toString() }
    } catch (error) {
      return { valid: false, id: undefined }
    }
  }

  private async checkAwsVpcIgw(
    ec2Client: EC2Client,
    vpcId: string,
    igwId: string,
  ): Promise<{ valid: boolean; vpcId: string | undefined; igwId: string | undefined }> {
    const vpc = await this.checkAwsVpc(ec2Client, [vpcId])
    const igw = await this.checkAwsIgw(ec2Client, [igwId])

    return { valid: vpc.valid && igw.valid, vpcId: vpc.id, igwId: igw.id }
  }

  // runInit initializes the Terraform project.
  // NOTE: It executes the 'terraform init' command. Interacts with the Terraform CLI.
  private runInit(): void {
    try {
      console.info("Executing Terraform init...") // NOTE: Added more descriptive message.
      const command = /* tfVars.join(" ").concat(" ") + */ `terraform init`
      execSync(command, { stdio: "inherit" })
    } catch (error) {
      if (error instanceof Error) {
        console.error("❗️ Error initializing Terraform:", (error as Error).message)
      } else {
        console.error("❗️ Unknown error initializing Terraform:", (error as Buffer).toString())
      }
    }
  }

  // checkTfState checks the Terraform state file for existing resources (VPC and IGW).
  // NOTE: It parses the state file and returns information about the existence of resources. Interacts with the file system and Terraform state file.
  private checkTfState(): {
    tfStateExists: string | null | undefined
    vpcExists: string | null | undefined
    igwExists: string | null | undefined
  } {
    try {
      const stateFile = fs.readdirSync(this.terraformDir).find((file) => file.endsWith(".tfstate"))

      if (!ObjectType.isEmpty(stateFile)) {
        try {
          const fileTfState = fs.readFileSync(
            path.join(this.terraformDir, stateFile as string),
            "utf8",
          )
          const tfState = JSON.parse(fileTfState) as TFState

          const vpcs = tfState.resources.filter(
            (resource) => resource.type === "aws_vpc" || resource.name === "VPC",
          )
          const vpcId = vpcs.find((vpc) => vpc.instances[0].attributes.id === this.enVars.VPC_ID)
            ?.instances[0].attributes.id

          const igws = tfState.resources.filter(
            (resource) =>
              resource.type === "aws_internet_gateway" || resource.name === "InternetGateway",
          )
          const igwId = igws.find((igw) => igw.instances[0].attributes.id === this.enVars.IGW_ID)
            ?.instances[0].attributes.id

          return { tfStateExists: stateFile, vpcExists: vpcId, igwExists: igwId }
        } catch (error) {
          console.error("❗️ Error checking resources in Terraform state:", error as Error)
          return { tfStateExists: stateFile, vpcExists: null, igwExists: null }
        }
      } else {
        return { tfStateExists: undefined, vpcExists: undefined, igwExists: undefined }
      }
    } catch (error) {
      console.error("❗️ Error checking Terraform state:", error as Error)
      return { tfStateExists: null, vpcExists: null, igwExists: null }
    }
  }

  // runPlan generates a Terraform execution plan.
  // NOTE: It executes the 'terraform plan' command with specified options. Interacts with the Terraform CLI.
  private runPlan(options?: {
    destroy: boolean
    refresh: boolean
    refreshOnly: boolean
    generateConfig: boolean
    planFile: string
  }): void {
    const defaultOptions = {
      destroy: false,
      refresh: false,
      refreshOnly: false,
      generateConfig: false,
      planFile: path.join(this.projectRoot, "infra.plan"),
    }

    const opts = { ...defaultOptions, ...(options || {}) }

    try {
      console.log("Generating Terraform plan...") // NOTE: Added more descriptive message.
      const generateConfigPath = path.join(this.projectRoot, "infra.generated.tf")
      const command =
        // `${this.tfVars.length > 0 ? this.tfVars.join(" ").concat(" ") : ""}` + // NOTE: commented out, check later.
        `terraform plan` +
        (opts.destroy ? " -destroy" : "") +
        (opts.refresh ? "" : " -refresh=false") +
        (opts.refreshOnly ? " -refresh-only" : "") +
        (opts.generateConfig ? ` -generate-config-out=${generateConfigPath}` : "") +
        (opts.planFile ? ` -out=${opts.planFile}` : "")
      execSync(command, { stdio: "inherit" })
    } catch (error) {
      console.error("❗️ Error running Terraform plan:", (error as Error).message)
    }
  }

  // runApply applies the generated Terraform plan.
  // NOTE: It executes the 'terraform apply' command with optional auto-approval. Interacts with the Terraform CLI.
  private runApply(tfApplyAutoApprove: boolean): void {
    try {
      console.log("Applying Terraform plan...") // NOTE: Added more descriptive message.
      const command =
        // NOTE: commented out, check later.
        // `${this.tfVars.length > 0 ? this.tfVars.join(" ").concat(" ") : ""}` +
        `terraform apply` + `${tfApplyAutoApprove ? " -auto-approve" : ""}`
      execSync(command, { stdio: "inherit" })
      console.info("✅ Terraform apply completed successfully.")
    } catch (error) {
      if (error instanceof Error) {
        if ((error as Error).message.includes("No changes. Infrastructure is up-to-date.")) {
          console.info("✅ No changes. Infrastructure is up-to-date.")
          return
        } else if ((error as Error).message.includes("Command failed: terraform apply")) {
          console.info("✅ Terraform apply canceled by user.")
          return
        } else {
          console.error("❗️ Error executing Terraform apply:", (error as Error).message)
        }
      } else {
        console.error("❗️ Unknown error executing Terraform apply:", (error as Buffer).toString())
      }
    }
  }

  // runImport imports existing resources into the Terraform state.
  // NOTE: It executes the 'terraform import' command for the specified resource. Interacts with the Terraform CLI.
  private runImport(resource: string): void {
    try {
      console.log(`Importing resource: ${resource}...`) // NOTE: Added more descriptive message.
      // `AWS_ACCESS_KEY_ID=${this.enVars.AWS_ACCESS_KEY} AWS_SECRET_ACCESS_KEY=${this.enVars.AWS_SECRET_KEY} ` +
      const command =
        // NOTE: commented out, check later.
        // `${this.tfVars.length > 0 ? this.tfVars.join(" ").concat(" ") : ""}` +
        `terraform import ${resource}`
      execSync(command, { stdio: "inherit" })
    } catch (error) {
      if (error instanceof Error) {
        console.error("❗️ Error importing Terraform resource:", (error as Error).message)
      } else {
        console.error(
          "❗️ Unknown error importing Terraform resource:",
          (error as Buffer).toString(),
        )
      }
    }
  }

  // runStatus displays the current status of the Terraform infrastructure.
  // NOTE: It executes the 'terraform show' command. Interacts with the Terraform CLI.
  private runStatus(): void {
    try {
      console.log("Showing Terraform status...") // NOTE: Added more descriptive message.
      execSync(`terraform show`, { stdio: "inherit" })
    } catch (error) {
      if (error instanceof Error) {
        console.error("❗️ Error getting Terraform status:", (error as Error).message)
      } else {
        console.error("❗️ Unknown error getting Terraform status:", (error as Buffer).toString())
      }
    }
  }

  // runShow displays the Terraform resources.
  // NOTE: It executes the 'terraform show' command. Interacts with the Terraform CLI.
  private runShow(): void {
    try {
      console.log("Showing Terraform resources...") // NOTE: Added more descriptive message.
      execSync(`terraform show`, { stdio: "inherit" })
    } catch (error) {
      if (error instanceof Error) {
        console.error("❗️ Error showing Terraform resources:", (error as Error).message)
      } else {
        console.error("❗️ Unknown error showing Terraform resources:", (error as Buffer).toString())
      }
    }
  }
}
