import fs from "node:fs"
import path from "node:path"
import prompts from "prompts"
import { ShellPrompts } from "../utils/shell.prompts"
import { DeploymentType } from "../interfaces/common"
import { ObjectType } from "../utils/object"

// NOTE: This class handles the initialization of the project, creating necessary directories and files for Terraform configurations.
// It interacts with the file system (fs), path manipulation (path), user prompts (prompts), and object type checking (ObjectType).
export class Init {
  private projectRoot: string
  private targetEnvironment: string | undefined
  private deploymentType: DeploymentType | string | undefined
  private force: boolean

  // NOTE: Constructor initializes the Init class with project root, target environment, deployment type, and a force flag.
  constructor(
    projectRoot: string,
    targetEnvironment: string | undefined,
    deploymentType: DeploymentType | string | undefined,
    force: boolean = false,
  ) {
    this.projectRoot = projectRoot
    this.targetEnvironment = targetEnvironment
    this.deploymentType = deploymentType
    this.force = force
  }

  // NOTE: This method orchestrates the initialization process. It calls createTerraformDirectories to handle the creation of Terraform directories.
  async run(): Promise<void> {
    await this.createTerraformDirectories(this.targetEnvironment, this.deploymentType, this.force)

    console.info("👍 Initialization completed successfully 🙌.\n")

    console.info(`👉 Next steps:`)
    console.info(`==============`)
    console.info(`  1. Review and update ".env" file`)
    console.info(`     🎯 ${this.projectRoot}/.env\n`)
    console.info(
      `  2. Review and update ".env.dt.${this.targetEnvironment}" file with correct credentials and other configurations.`,
    )
    console.info(`     🎯 ${this.projectRoot}/.env.dt.${this.targetEnvironment}\n`)
    console.info(
      `  3. Run command with "deploy" option to start the deployment for current stage environment.`,
    )
  }

  // NOTE: This method creates the necessary directories for Terraform configurations based on the target environment and deployment type.
  // It prompts the user for input if the environment or deployment type is not provided.
  // It handles existing directories and files, offering the option to replace them or skip.
  // It interacts with the file system (fs) and path manipulation (path).
  private async createTerraformDirectories(
    targetEnvironment: string | undefined,
    deploymentType: DeploymentType | string | undefined,
    force: boolean,
  ): Promise<void> {
    targetEnvironment = await ShellPrompts.promptForTargetEnvironment(targetEnvironment)

    if (
      !ObjectType.isEmpty(deploymentType) &&
      (deploymentType as unknown as DeploymentType) !== DeploymentType.SINGLE &&
      (deploymentType as unknown as DeploymentType) !== DeploymentType.ASG
    ) {
      console.error(`Invalid "deploymentType" value (${Object.values(DeploymentType).join(", ")})`)
      process.exit(1)
    }

    deploymentType = await ShellPrompts.selectDeploymentType(deploymentType)

    if (deploymentType === "exit") {
      console.log("Exiting...")
      return
    }

    const terraformDir = path.join(this.projectRoot, ".terraforms", targetEnvironment as string)
    const templateDir = path.join(
      __dirname,
      "../",
      "templates",
      "terraforms",
      deploymentType as string,
    )

    await this.ensureTerraformDirectory(terraformDir, force)
    await this.generateTerraformFiles(terraformDir, templateDir, deploymentType as string)

    await this.ensureTerraformDirectory(`${terraformDir}/scripts`, force)
    await this.generateTerraformFiles(
      `${terraformDir}/scripts`,
      `${templateDir}/scripts`,
      deploymentType as string,
    )
  }

  private async ensureTerraformDirectory(terraformDir: string, force: boolean): Promise<void> {
    if (fs.existsSync(terraformDir)) {
      const files = fs.readdirSync(terraformDir)
      const hasTerraformFiles = files.some((file) =>
        [".tf", ".yml", ".sh", ".md"].some((ext) => file.endsWith(ext)),
      )

      if (hasTerraformFiles && !force) {
        const response = await prompts({
          type: "confirm",
          name: "replace",
          message: "Terraform files already exist. Do you want to replace them?",
          initial: false,
        })

        if (!response.replace) {
          console.warn("Terraform directory already contains files. Skipping file creation.")
          return
        }
      }
    } else {
      fs.mkdirSync(terraformDir, { recursive: true })
    }

    // Remove existing Terraform files
    fs.readdirSync(terraformDir).forEach((file) => {
      if (
        file.endsWith(".tf") ||
        file.endsWith(".yml") ||
        file.endsWith(".sh") ||
        file.endsWith(".md")
      ) {
        fs.unlinkSync(path.join(terraformDir, file))
      }
    })
  }

  private async generateTerraformFiles(
    terraformDir: string,
    templateDir: string,
    deploymentType: string,
  ): Promise<void> {
    const files = fs.readdirSync(templateDir)
    for (const file of files) {
      if (
        file.endsWith(".tf") ||
        file.endsWith(".yml") ||
        file.endsWith(".sh") ||
        file.endsWith(".md")
      ) {
        const templateContent = fs.readFileSync(path.join(templateDir, file), "utf8")

        fs.writeFileSync(path.join(terraformDir, file), templateContent)
        // console.log(`${file} created in ${terraformDir}`)
      }
    }

    // const deploymentTypeFile = deploymentType === "asg" ? "ASG.md" : "SINGLE.md"
    // if (!fs.existsSync(path.join(terraformDir, deploymentTypeFile))) {
    //   fs.writeFileSync(path.join(terraformDir, deploymentTypeFile), "")
    //   // console.log(`${deploymentTypeFile} created in ${terraformDir}`)
    // }

    console.info(`✅ Deployment ${deploymentType} template applied.`)
    console.log()
  }

  private renderTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\${(\w+)}/g, (_, key) => variables[key] || "${" + key + "}")
  }
}
