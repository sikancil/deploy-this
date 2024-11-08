import * as fs from "node:fs"
import * as path from "node:path"
import { execSync } from "node:child_process"
// import prompts from "prompts"
// import { EC2Client } from "@aws-sdk/client-ec2"
// import { ObjectType } from "../utils/object"
import { ShellPrompts } from "../utils/shell.prompts"
// import { Validation } from "../utils/validation"
// import { Configuration } from "../utils/configuration"
// import { patchEnvs } from "../utils/env"
import { handleError } from "../utils/error.handler"

import { DestroyType } from "../interfaces/common"

export class Rollback {
  private projectRoot: string
  private targetEnvironment: string
  // private deploymentType: string | undefined
  private destroyType: DestroyType | undefined
  private force: boolean
  private terraformDir: string
  // private enVars: { [key: string]: string }
  // private tfVars: string[]

  constructor(
    targetEnvironment?: string,
    destroyType?: DestroyType | undefined,
    force: boolean = false,
  ) {
    this.projectRoot = process.cwd()
    this.targetEnvironment = targetEnvironment || ""
    // this.deploymentType = ""
    this.destroyType = destroyType
    this.force = force
    this.terraformDir = ""
    // this.enVars = {}
    // this.tfVars = []
  }

  async run(): Promise<void> {
    try {
      // If targetEnvironment is not provided, prompt for selection
      if (!this.targetEnvironment) {
        this.targetEnvironment = await ShellPrompts.selectTargetEnvironment()
      }

      if (this.targetEnvironment === "exit") {
        console.log("Rollback cancelled.")
        return
      }

      console.info(`🔄 Starting rollback for ${this.targetEnvironment}...`)
      console.info(`👁️ ${this.projectRoot}`)

      // Retrieves environment variables and Terraform variables from checkEnvironmentVariables().
      // const { enVars, tfVars } = Validation.checkEnvironmentVariables()
      // this.enVars = enVars
      // this.tfVars = tfVars

      // Set terraform directory
      this.terraformDir = path.join(this.projectRoot, ".terraforms", this.targetEnvironment)

      if (!fs.existsSync(this.terraformDir)) {
        throw new Error(`Terraform directory not found for environment: ${this.targetEnvironment}`)
      }

      // Determines the deployment type based on the files present in the Terraform directory.
      // this.deploymentType = Validation.checkDeploymentType(this.terraformDir)

      // Change to terraform directory
      process.chdir(this.terraformDir)

      // Prompt for destroy type
      const selectedDestroyType = this.destroyType ? this.destroyType : await ShellPrompts.selectDestroyType()

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