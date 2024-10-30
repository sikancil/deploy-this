import fs from "node:fs"
import path from "node:path"
import prompts from "prompts"
import { ObjectType } from "../utils/object"

// NOTE: This class handles the initialization of the project, creating necessary directories and files for Terraform configurations.
// It interacts with the file system (fs), path manipulation (path), user prompts (prompts), and object type checking (ObjectType).
export class Init {
  private projectRoot: string
  private targetEnvironment: string | undefined
  private deploymentType: string | undefined
  private force: boolean

  // NOTE: Constructor initializes the Init class with project root, target environment, deployment type, and a force flag.
  constructor(
    projectRoot: string,
    targetEnvironment: string | undefined,
    deploymentType: string | undefined,
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
    console.log()
    
    console.info("👍 Initialization completed successfully 🙌.\n")

    console.info(`👉 Next steps:`)
    console.info(`==============`)
    console.info(`  1. Review and update ".env" file`)
    console.info(`     🎯 ${this.projectRoot}/.env\n`)
    console.info(
      `  2. Review and update ".env.dt.${this.targetEnvironment}" file with correct credentials and other configurations.`,
    )
    console.info(`     🎯 ${this.projectRoot}/.env.dt.${this.targetEnvironment}\n`)
    console.info(`  3. Run command with "deploy" option to start the deployment for current stage environment.`)
  }

  // NOTE: This method creates the necessary directories for Terraform configurations based on the target environment and deployment type.
  // It prompts the user for input if the environment or deployment type is not provided.
  // It handles existing directories and files, offering the option to replace them or skip.
  // It interacts with the file system (fs) and path manipulation (path).
  private async createTerraformDirectories(
    targetEnvironment: string | undefined,
    deploymentType: string | undefined,
    force: boolean,
  ): Promise<void> {
    targetEnvironment = await this.promptForTargetEnvironment(targetEnvironment)
    deploymentType = await this.promptForDeploymentType(deploymentType)

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
    await this.generateTerraformFiles(
      terraformDir,
      templateDir,
      targetEnvironment as string,
      deploymentType as string,
    )
  }

  private async promptForTargetEnvironment(
    targetEnvironment: string | undefined,
  ): Promise<string | undefined> {
    if (ObjectType.isEmpty(targetEnvironment)) {
      const response = await prompts({
        type: "text",
        name: "targetEnvironment",
        message: "Enter target environment (staging or production):",
        validate: (value) =>
          ["staging", "production"].includes(value)
            ? true
            : "Please enter either 'staging' or 'production'",
      })

      if (ObjectType.isEmpty(response.targetEnvironment)) {
        console.error("Target environment is required.")
        process.exit(1)
      }

      targetEnvironment = response.targetEnvironment
    }
    return targetEnvironment
  }

  private async promptForDeploymentType(
    deploymentType: string | undefined,
  ): Promise<string | undefined> {
    if (ObjectType.isEmpty(deploymentType)) {
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

      if (ObjectType.isEmpty(response.deploymentType)) {
        console.error("Deployment type is required.")
        process.exit(1)
      }

      deploymentType = response.deploymentType
    }
    return deploymentType
  }

  private async ensureTerraformDirectory(terraformDir: string, force: boolean): Promise<void> {
    if (fs.existsSync(terraformDir)) {
      const files = fs.readdirSync(terraformDir)
      const hasTerraformFiles = files.some((file) =>
        [".tf", ".sh", ".md"].some((ext) => file.endsWith(ext)),
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
      if (file.endsWith(".tf") || file.endsWith(".sh") || file.endsWith(".md")) {
        fs.unlinkSync(path.join(terraformDir, file))
      }
    })
  }

  private async generateTerraformFiles(
    terraformDir: string,
    templateDir: string,
    targetEnvironment: string,
    deploymentType: string,
  ): Promise<void> {
    const files = fs.readdirSync(templateDir)
    for (const file of files) {
      if (file.endsWith(".tf") || file.endsWith(".sh") || file.endsWith(".md")) {
        const templateContent = fs.readFileSync(path.join(templateDir, file), "utf8")
        
        // const renderedContent = this.renderTemplate(templateContent, {
        //   targetEnvironment: targetEnvironment,
        //   deploymentType: deploymentType,
        //   // Add more variables as needed
        // })
        // fs.writeFileSync(path.join(terraformDir, file), renderedContent)
        
        fs.writeFileSync(path.join(terraformDir, file), templateContent)
        console.log(`${file} created in ${terraformDir}`)
      }
    }

    const deploymentTypeFile = deploymentType === "asg" ? "ASG.md" : "SINGLE.md"
    if (!fs.existsSync(path.join(terraformDir, deploymentTypeFile))) {
      fs.writeFileSync(path.join(terraformDir, deploymentTypeFile), "")
      console.log(`${deploymentTypeFile} created in ${terraformDir}`)
    }
  }

  private renderTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\${(\w+)}/g, (_, key) => variables[key] || "${" + key + "}")
  }
}
