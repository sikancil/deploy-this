import * as fs from "node:fs"
import * as path from "node:path"
import { execSync } from "node:child_process"
import prompts from "prompts"
import { EC2Client } from "@aws-sdk/client-ec2"
import { ObjectType } from "../utils/object"
import { ShellPrompts } from "../utils/shell.prompts"
import { Validation } from "../utils/validation"
import { Configuration } from "../utils/configuration"

// Deploy class handles the deployment of infrastructure using Terraform.
// NOTE: It interacts with environment variables, Terraform state files, and executes Terraform commands.
export class Deploy {
  private projectRoot: string
  private targetEnvironment: string
  private deploymentType: string | undefined
  private enVars: { [key: string]: string }
  private tfVars: string[]

  private optCreateNewVpc: boolean

  // Constructor initializes the Deploy class with the target environment.
  // NOTE: It sets the project root directory, target environment, and initializes other properties.
  constructor(targetEnvironment: string, createNewVpc: boolean = false) {
    this.projectRoot = process.cwd()
    this.targetEnvironment = targetEnvironment
    // this.terraformDir = ""
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
      this.targetEnvironment = await ShellPrompts.selectTargetEnvironment()
    }

    console.info(`🚀 Starting deployment into ${this.targetEnvironment}...`)
    console.info(`👁️ ${this.projectRoot}`)

    // Retrieves environment variables and Terraform variables from checkEnvironmentVariables().
    const { enVars, tfVars } = Validation.checkEnvironmentVariables()
    this.enVars = enVars
    this.tfVars = tfVars

    // Sets the Terraform directory based on the project root and target environment.
    // this.terraformDir = path.join(this.projectRoot, ".terraforms", this.targetEnvironment)
    const terraformDir = Configuration.getTerraformDir(this.targetEnvironment)

    // Determines the deployment type based on the files present in the Terraform directory.
    this.deploymentType = Validation.checkDeploymentType(this.targetEnvironment)

    // Changes the current working directory to the Terraform directory.
    process.chdir(terraformDir)

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
      const checkTfStateResult = Validation.checkTfState(this.targetEnvironment)

      let vpcStateValid = undefined
      let igwStateValid = undefined
      let vpcConfigValid = undefined
      let igwConfigValid = undefined

      try {
        // When Terraform state file does not exists, import existing resources..
        if (!checkTfStateResult.tfStateExists) {
          console.info("❓ Terraform state file not exists. Checking resources...")
        } else {
          console.info("✅ Terraform state file found. Skipping import of existing resources.")
        }

        // Imports existing VPC if it's not already managed by Terraform state.
        if (ObjectType.isEmpty(checkTfStateResult.vpcExists)) {
          const vpcResource = await Validation.checkAwsVpc(ec2Client, [
            checkTfStateResult.vpcExists as string,
          ])
          vpcStateValid = vpcResource.valid ? vpcResource.id : undefined
          // this.runImport(`aws_vpc.VPC "${this.enVars.VPC_ID}"`)
        }

        // Imports existing IGW if it's not already managed by Terraform state.
        if (ObjectType.isEmpty(checkTfStateResult.igwExists)) {
          const igwResource = await Validation.checkAwsIgw(ec2Client, [
            checkTfStateResult.igwExists as string,
          ])
          igwStateValid = igwResource.valid ? igwResource.id : undefined
          // this.runImport(`aws_internet_gateway.InternetGateway "${this.enVars.IGW_ID}"`)
        }

        if (!ObjectType.isEmpty(this.enVars.VPC_ID)) {
          const vpcResource = await Validation.checkAwsVpc(ec2Client, [this.enVars.VPC_ID])
          vpcConfigValid = vpcResource.valid ? vpcResource.id : undefined
        }

        if (!ObjectType.isEmpty(this.enVars.IGW_ID)) {
          const igwResource = await Validation.checkAwsIgw(ec2Client, [this.enVars.IGW_ID])
          igwConfigValid = igwResource.valid ? igwResource.id : undefined
        }

        console.log(
          `Terraform States:\n` +
            `- VPC: ${!vpcStateValid ? "❌ Invalid" : `✅ ${vpcStateValid}`}\n` +
            `- IGW: ${!igwStateValid ? "❌ Invalid" : `✅ ${igwStateValid}`}\n`,
        )
        console.log(
          `Configured Values:\n` +
            `- VPC: ${!vpcConfigValid ? "❌ Invalid" : `✅ ${vpcConfigValid}`}\n` +
            `- IGW: ${!igwConfigValid ? "❌ Invalid" : `✅ ${igwConfigValid}`}\n`,
        )

        // When State is valid and Configured is valid, use State, fix Configured, do not import terraform resources
        // When State is valid and Configured is invalid, use State, fix Configured, do import terraform resources
        // When State is invalid and Configured is valid, use Configured, remove State, do import terraform resources
        // When State is invalid and Configured is invalid, use Configured, remove State, do not import terraform resources
        if (!ObjectType.isEmpty(vpcStateValid) && !ObjectType.isEmpty(igwStateValid)) {
          // Update values in .env.dt.{targetEnvironment}
          Configuration.updateEnvFile(this.targetEnvironment, {
            VPC_ID: checkTfStateResult.vpcExists,
            IGW_ID: checkTfStateResult.igwExists,
          })
          this.enVars.VPC_ID = checkTfStateResult.vpcExists
          this.enVars.IGW_ID = checkTfStateResult.igwExists

          if (vpcConfigValid && igwConfigValid) {
            console.warn(`❗️ Invalid Terraform state and found valid configuration variables.`)
            console.warn(`👉 Now will trying to import resources from configured variables...`)

            // Import existing VPC and IGW
            this.runImport(`aws_vpc.VPC "${this.enVars.VPC_ID}"`)
            this.runImport(`aws_internet_gateway.InternetGateway "${this.enVars.IGW_ID}"`)
          }
        } else {
          if (vpcConfigValid && igwConfigValid) {
            console.warn(`❗️ Invalid Terraform state and found valid configuration variables.`)
            console.warn(`👉 Now will trying to import resources from configured variables...`)

            // Rename to backup Terraform state file
            const tfStateFile = path.join(terraformDir, "terraform.tfstate")
            const backupStateFile = path.join(
              terraformDir,
              `terraform.tfstate.${Date.now()}.backup`,
            )
            
            if (fs.existsSync(tfStateFile)) {
              // fs.renameSync(tfStateFile, backupStateFile)
              fs.copyFileSync(tfStateFile, backupStateFile)
            }

            // Import existing VPC and IGW
            this.runImport(`aws_vpc.VPC "${this.enVars.VPC_ID}"`)
            this.runImport(`aws_internet_gateway.InternetGateway "${this.enVars.IGW_ID}"`)
          } else {
            console.warn(
              `❗️ WARN: Both Terraform state and configured variables are invalid and ignored, and will create new VPC and IGW.`,
            )
            console.log()

            // Prompt confirmation to create new VPC and IGW
            const vpcConfirm = await prompts({
              type: "confirm",
              name: "create_new_vpc_igw",
              message: "Deployment will create new VPC and IGW. Continue?",
              initial: false,
            })

            if (!vpcConfirm.create_new_vpc_igw) {
              console.warn("❗️ WARN: Deployment canceled by user.")
              console.log()
              process.exit(0)
            }
          }
        }
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
        planFile: path.join(terraformDir, "infra.plan"),
      })
      console.log()

      // Applies the Terraform plan.
      this.runApply(tfApplyAutoApprove)
      console.log()

      // Shows the Terraform status.
      // this.runStatus()
      // console.log()

      // Shows the Terraform resources.
      // this.runShow()
      // console.log()

      // TODO: when successful, read terraform tfstate and update .env.dt.${NODE_ENV} file, then return vpcId and igwId
      const succeededState = Validation.checkTfState(this.targetEnvironment)

      if (
        !ObjectType.isEmpty(succeededState?.vpcExists) &&
        !ObjectType.isEmpty(succeededState?.igwExists)
      ) {
        Configuration.updateEnvFile(this.targetEnvironment, {
          VPC_ID: succeededState?.vpcExists,
          IGW_ID: succeededState?.igwExists,
        })
      }

      return { vpcId: succeededState?.vpcExists, igwId: succeededState?.igwExists }
    } catch (error) {
      process.chdir(this.projectRoot)
      console.error("❗️ Error executing Terraform:", error)
      process.exit(1)
    }
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
  public runStatus(): void {
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
  public runShow(): void {
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
