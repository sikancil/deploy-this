import { Configuration } from "./../utils/configuration"
import * as fs from "node:fs"
import * as path from "node:path"
import { execSync } from "node:child_process"
import { ObjectType } from "../utils/object"
import { ShellPrompts } from "../utils/shell.prompts"
import { Validation } from "../utils/validation"
import { handleError } from "../utils/error.handler"
import { ECR, ImageIdentifier } from "@aws-sdk/client-ecr"
import { ObjectIdentifier, S3 } from "@aws-sdk/client-s3"

import { DestroyType } from "../interfaces/common"

export class Rollback {
  private projectRoot: string
  private targetEnvironment: string
  private terraformDir: string
  private enVars: { [key: string]: string }
  private tfVars: string[]

  constructor(targetEnvironment?: string) {
    this.projectRoot = process.cwd()
    this.targetEnvironment = targetEnvironment || ""
    this.terraformDir = ""
    this.enVars = {}
    this.tfVars = []
  }

  async run(destroyType: DestroyType | undefined, force: boolean = false): Promise<void> {
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
      const { enVars, tfVars } = Validation.checkEnvironmentVariables()
      this.enVars = enVars
      this.tfVars = tfVars

      // Set terraform directory
      this.terraformDir = path.join(this.projectRoot, ".terraforms", this.targetEnvironment)

      if (!fs.existsSync(this.terraformDir)) {
        throw new Error(`Terraform directory not found for environment: ${this.targetEnvironment}`)
      }

      // Change to terraform directory
      process.chdir(this.terraformDir)

      // Prompt for destroy type
      if (ObjectType.isEmpty(destroyType)) {
        destroyType = await ShellPrompts.selectDestroyType()
      }

      // Initialize terraform
      this.runInit()

      if (!force) {
        const confirmToDestroy = await ShellPrompts.promptConfirmToDestroy(this.targetEnvironment)
        if (!confirmToDestroy) {
          console.warn("❗️ Rollback cancelled.")
          console.log()
          process.exit(0)
        }
      }

      this.backupTerraformState(this.terraformDir)

      // Clean up S3 artifacts before destroy
      const s3 = new S3({ region: this.enVars.AWS_REGION })
      const isBucketCleanedUp = await this.cleanupBucket(
        `${this.enVars.PROJECT_NAME}-artifacts`,
        s3,
      )

      if (isBucketCleanedUp >= 0) {
        console.log("✅ S3 bucket cleanup completed")
      } else {
        console.error("❌ S3 bucket cleanup failed")
        process.exit(1)
      }

      // Clean up ECR images before destroy
      const ecr = new ECR({ region: this.enVars.AWS_REGION })
      const isRepositoryCleanedUp = await this.cleanupRepository(this.enVars.PROJECT_NAME, ecr)

      if (isRepositoryCleanedUp >= 0) {
        console.log("✅ ECR repository cleanup completed")
      } else {
        console.error("❌ ECR repository cleanup failed")
        process.exit(1)
      }

      // Run destroy based on selected type
      await this.runDestroy(destroyType, force)

      this.removeBackupTerraformState(this.terraformDir)
    } catch (error) {
      // Restore Terraform state from backup
      this.restoreTerraformState(this.terraformDir)

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

  private async runDestroy(
    destroyType: DestroyType | undefined,
    force: boolean = false,
  ): Promise<void> {
    try {
      console.info(`Running ${destroyType} destroy...`)

      let destroyResult: Buffer

      if (!force) {
        const confirmToDestroy = await ShellPrompts.promptConfirmToDestroy(this.targetEnvironment)
        if (!confirmToDestroy) {
          console.warn("❗️ Rollback cancelled.")
          console.log()
          process.exit(0)
        }
      }

      if (destroyType === "partial") {
        // Destroy resources in reverse dependency order
        const resources = [
          // First layer - Load Balancer and Target Group resources
          "aws_lb_listener.http",
          "aws_lb_listener.https",
          "aws_lb.app",
          "aws_lb_target_group.app",
          // Second layer - AutoScaling resources
          "aws_autoscaling_attachment.asg_attachment_alb",
          "aws_autoscaling_lifecycle_hook.termination_hook",
          "aws_autoscaling_policy.cpu_policy",
          "aws_autoscaling_policy.memory_policy",
          "aws_autoscaling_group.app",
          "aws_launch_template.app",
          // Third layer - Monitoring and Deployment resources
          "aws_cloudwatch_metric_alarm.high_cpu",
          "aws_codedeploy_deployment_group.app_dg",
          "aws_codedeploy_app.app",
          "aws_ssm_parameter.current_instance_type",
          // Fourth layer - Container and Storage resources
          "aws_ecr_repository.app_repo",
          "aws_s3_bucket_versioning.artifacts",
          "aws_s3_bucket_server_side_encryption_configuration.artifacts",
          "aws_s3_bucket_public_access_block.artifacts",
          "aws_s3_object.docker_compose",
          "aws_s3_bucket.artifacts",
          // Fifth layer - IAM resources
          "aws_iam_role_policy.s3_access",
          "aws_iam_role_policy_attachment.codedeploy_policy",
          "aws_iam_role_policy_attachment.codedeploy_agent_policy",
          "aws_iam_role_policy_attachment.ec2_policy",
          "aws_iam_instance_profile.ec2_profile",
          "aws_iam_role.codedeploy_role",
          "aws_iam_role.ec2_role",
          // Sixth layer - Security and Access resources
          "aws_security_group_rule.codedeploy_https",
          "aws_security_group_rule.s3_endpoint",
          "aws_security_group.vpc_endpoint",
          "aws_security_group.ec2",
          "aws_security_group.alb",
          // Seventh layer - VPC Endpoint resources
          "aws_vpc_endpoint.codedeploy",
          "aws_vpc_endpoint.ecr_api",
          "aws_vpc_endpoint.ecr_dkr",
          "aws_vpc_endpoint.logs",
          "aws_vpc_endpoint.s3",
          "aws_vpc_endpoint.ssm",
          // Eighth layer - Network resources (except VPC and IGW)
          "aws_route_table_association.public[1]",
          "aws_route_table_association.public[0]",
          "aws_route_table.public",
          "aws_subnet.public[1]",
          "aws_subnet.public[0]",
          // Ninth layer - Key Pair resources
          "aws_key_pair.dt_keypair",
          "local_file.dt_rsa_private",
          "tls_private_key.dt_private",
        ]

        // build a string of all the resources to destroy
        const targetParamsAtOnce = resources.reduce((acc, resource) => {
          return acc + ` -target=${resource}`
        }, "")

        console.info(`Rollback Partially (excludes VPC and IGW)...`)

        // execSync(`terraform destroy ${targetParamsAtOnce} -auto-approve`, { stdio: "inherit" })
        destroyResult = execSync(
          `terraform destroy ${targetParamsAtOnce}${force ? " -auto-approve" : ""}`,
          {
            stdio: "inherit",
          },
        )
      } else {
        // Full destroy including VPC and IGW
        // execSync("terraform destroy -auto-approve", { stdio: "inherit" })
        destroyResult = execSync(`terraform destroy${force ? " -auto-approve" : ""}`, {
          stdio: "inherit",
        })
      }

      if (
        destroyResult?.toString()?.toLowerCase()?.includes("error") ||
        destroyResult?.toString()?.toLowerCase()?.includes("failed") ||
        destroyResult?.toString()?.toLowerCase()?.includes("invalid") ||
        destroyResult?.toString()?.toLowerCase()?.includes("cancelled")
      ) {
        console.error(`❌ Rollback failed. ${destroyResult?.toString()}\n`)
      } else {
        Configuration.updateEnvFile(this.targetEnvironment, {
          VPC_ID: "vpc-00000000000000000",
          IGW_ID: "igw-00000000000000000",
        })
        console.info(`✅ Rollback completed successfully.\n`)
      }
    } catch (error) {
      // Restore Terraform state from backup
      this.restoreTerraformState(this.terraformDir)

      if ((error as Error)?.message?.includes("Command failed: terraform destroy")) {
        console.warn(`❗️ Rollback cancelled.\n`)
      } else if (
        (error as Error)?.message?.includes("request send failed") ||
        (error as Error)?.message?.includes("dial tcp: lookup") ||
        (error as Error)?.message?.includes("amazonaws.com: no such host")
      ) {
        console.error(`❌ Rollback failed. ${(error as Error)?.message}\n`)
      } else {
        throw error
      }
    }
  }

  backupTerraformState(terraformDir: string): void {
    try {
      const backupStateFile = path.join(
        terraformDir,
        `terraform.tfstate.${Math.floor(Date.now() / 1000)}.backup`,
      )
      const stateFile = path.join(terraformDir, "terraform.tfstate")

      if (fs.existsSync(stateFile)) {
        fs.copyFileSync(stateFile, backupStateFile)
      }
    } catch (error) {
      console.error("❌ Error backing up Terraform state:", error)
      process.exit(1)
    }
  }

  removeBackupTerraformState(terraformDir: string): void {
    try {
      // get latest backup file with file name format: terraform.tfstate.timestamp.backup
      const files = fs.readdirSync(terraformDir)
      const backupFiles = files
        ?.filter((file) => {
          // NOTE: The backup file name format is terraform.tfstate.timestamp.backup
          const reBackupFormat = /terraform.tfstate.(\d+).backup/
          const match = reBackupFormat.exec(file)
          return (
            file?.startsWith?.("terraform.tfstate") &&
            file?.endsWith?.(".backup") &&
            match?.length > 1
          )
        })
        ?.sort((a, b) => b?.localeCompare(a))
      const latestBackupFile = backupFiles?.[0] || undefined

      if (latestBackupFile) {
        fs.unlinkSync(path.join(terraformDir, latestBackupFile))
      }
    } catch (error) {
      console.error("❌ Error removing backup Terraform state:", error)
      process.exit(1)
    }
  }

  restoreTerraformState(terraformDir: string): void {
    try {
      // get latest backup file with file name format: terraform.tfstate.timestamp.backup
      const files = fs.readdirSync(terraformDir)
      const backupFiles = files
        ?.filter((file) => {
          // NOTE: The backup file name format is terraform.tfstate.timestamp.backup
          const reBackupFormat = /terraform.tfstate.(\d+).backup/
          const match = reBackupFormat.exec(file)
          return (
            file?.startsWith?.("terraform.tfstate") &&
            file?.endsWith?.(".backup") &&
            match?.length > 1
          )
        })
        ?.sort((a, b) => b?.localeCompare(a))
      const latestBackupFile = backupFiles?.[0] || undefined

      if (!latestBackupFile) {
        console.error("❌ No backup files found in Terraform directory")
        process.exit(1)
      }

      const backupStateFile = path.join(terraformDir, latestBackupFile)
      const stateFile = path.join(terraformDir, "terraform.tfstate")

      if (fs.existsSync(backupStateFile)) {
        fs.createReadStream(backupStateFile)
          .pipe(fs.createWriteStream(stateFile))
          .on("finish", () => {
            // Finally, delete the backup file
            fs.unlinkSync(backupStateFile)
            console.log("✅ Terraform state restored from backup file")
          })
          .on("error", (err) => {
            console.error("❌ Error restoring Terraform state from backup file:", err)
            process.exit(1)
          })
      } else {
        console.error("❌ Backup file not found:", backupStateFile)
        process.exit(1)
      }
    } catch (error) {
      console.error("❌ Error restoring Terraform state:", error)
      process.exit(1)
    }
  }

  // ECR Methods
  /**
   * Lists all images in an ECR repository
   * @param repositoryName The name of the ECR repository
   * @param ecrInstance The ECR client instance
   * @returns Array of image details
   */
  async listRepositoryImages(repositoryName: string, ecrInstance: ECR): Promise<ImageIdentifier[]> {
    try {
      const images: ImageIdentifier[] = []
      let nextToken: string | undefined

      do {
        const response = await ecrInstance.listImages({
          repositoryName,
          nextToken,
        })

        if (response.imageIds) {
          images.push(...response.imageIds)
        }

        nextToken = response.nextToken
      } while (nextToken)

      return images
    } catch (error) {
      if ((error as Error).message?.includes("RepositoryNotFoundException")) {
        return []
      } else if ((error as Error).message?.includes("does not exist in the registry")) {
        return []
      } else {
        console.error(
          `❌ Error to list images in repository ${repositoryName}`,
          (error as Error).message,
        )
        process.exit(1)
      }
    }
  }

  /**
   * Deletes all images from an ECR repository
   * @param repositoryName The name of the ECR repository
   * @param ecrInstance The ECR client instance
   * @returns Number of images deleted
   */
  async cleanupRepository(repositoryName: string, ecrInstance: ECR): Promise<number> {
    try {
      const images = await this.listRepositoryImages(repositoryName, ecrInstance)

      if (images.length === 0) {
        console.log(`Repository ${repositoryName} is already empty`)
        return 0
      }

      // AWS API has a limit of 100 images per batch delete
      const batchSize = 100
      let deletedCount = 0

      for (let i = 0; i < images.length; i += batchSize) {
        const batch = images.slice(i, i + batchSize)

        const response = await ecrInstance.batchDeleteImage({
          repositoryName,
          imageIds: batch,
        })

        if (response.failures && response.failures.length > 0) {
          console.warn("Some images failed to delete:", response.failures)
        }

        deletedCount += response.imageIds?.length || 0
      }

      console.log(`Successfully deleted ${deletedCount} images from ${repositoryName}`)
      return deletedCount
    } catch (error) {
      console.error(`Error cleaning up repository ${repositoryName}:`, error)
      // throw error
    }
  }

  /**
   * Verifies if an ECR repository is empty
   * @param repositoryName The name of the ECR repository
   * @param ecrInstance The ECR client instance
   * @returns boolean indicating if repository is empty
   */
  async isRepositoryEmpty(repositoryName: string, ecrInstance: ECR): Promise<boolean> {
    try {
      const images = await this.listRepositoryImages(repositoryName, ecrInstance)
      const isEmpty = images.length === 0

      console.log(`Repository ${repositoryName} ${isEmpty ? "is" : "is not"} empty`)
      return isEmpty
    } catch (error) {
      console.error(`Error checking if repository ${repositoryName} is empty:`, error)
      // throw error
    }
  }

  // S3 Methods
  /**
   * Lists all objects in an S3 bucket, including objects in all subdirectories
   * @param bucketName The name of the S3 bucket
   * @param s3Instance The S3 client instance
   * @returns Array of S3 objects with their keys and versions
   */
  async listBucketObjects(bucketName: string, s3Instance?: S3): Promise<ObjectIdentifier[]> {
    try {
      const objects: ObjectIdentifier[] = []
      let continuationToken: string | undefined

      // First, list all current objects
      do {
        const response = await s3Instance.listObjectsV2({
          Bucket: bucketName,
          ContinuationToken: continuationToken,
        })

        if (response.Contents) {
          objects.push(
            ...response.Contents.map((obj) => ({
              Key: obj.Key as string,
            })),
          )
        }

        continuationToken = response.NextContinuationToken
      } while (continuationToken)

      // Then, if versioning is enabled, list all versions
      let keyMarker: string | undefined
      let versionIdMarker: string | undefined

      do {
        const response = await s3Instance.listObjectVersions({
          Bucket: bucketName,
          KeyMarker: keyMarker,
          VersionIdMarker: versionIdMarker,
        })

        // Add delete markers and non-current versions
        if (response.DeleteMarkers) {
          objects.push(
            ...response.DeleteMarkers.map((marker) => ({
              Key: marker.Key as string,
              VersionId: marker.VersionId,
            })),
          )
        }

        if (response.Versions) {
          objects.push(
            ...response.Versions.map((version) => ({
              Key: version.Key as string,
              VersionId: version.VersionId,
            })),
          )
        }

        keyMarker = response.NextKeyMarker
        versionIdMarker = response.NextVersionIdMarker
      } while (keyMarker || versionIdMarker)

      return objects
    } catch (error) {
      if (
        (error as Error).message?.includes("NoSuchBucket") ||
        (error as Error).message?.includes("The specified bucket does not exist")
      ) {
        return []
      } else {
        console.error(`❌ Error to get objects in bucket ${bucketName}`, (error as Error).message)
        process.exit(1)
      }
    }
  }

  /**
   * Deletes all objects from an S3 bucket, including all versions and delete markers
   * @param bucketName The name of the S3 bucket
   * @param s3Instance The S3 client instance
   * @returns Number of objects deleted
   */
  async cleanupBucket(bucketName: string, s3Instance: S3): Promise<number> {
    try {
      const objects = await this.listBucketObjects(bucketName, s3Instance)

      if (objects.length === 0) {
        console.log(`Bucket ${bucketName} is already empty`)
        return 0
      }

      // AWS API has a limit of 1000 objects per batch delete
      const batchSize = 1000
      let deletedCount = 0

      for (let i = 0; i < objects.length; i += batchSize) {
        const batch = objects.slice(i, i + batchSize)

        const response = await s3Instance.deleteObjects({
          Bucket: bucketName,
          Delete: {
            Objects: batch,
            Quiet: false,
          },
        })

        if (response.Errors && response.Errors.length > 0) {
          console.warn("Some objects failed to delete:", response.Errors)
        }

        deletedCount += response.Deleted?.length || 0
      }

      console.log(`Successfully deleted ${deletedCount} objects from ${bucketName}`)
      return deletedCount
    } catch (error) {
      console.error(`Error cleaning up bucket ${bucketName}:`, error)
      // throw error
    }
  }

  /**
   * Verifies if an S3 bucket is completely empty (no objects, versions, or delete markers)
   * @param bucketName The name of the S3 bucket
   * @param s3Instance The S3 client instance
   * @returns boolean indicating if bucket is empty
   */
  async isBucketEmpty(bucketName: string, s3Instance: S3): Promise<boolean> {
    try {
      const objects = await this.listBucketObjects(bucketName, s3Instance)
      const isEmpty = objects.length === 0

      console.log(`Bucket ${bucketName} ${isEmpty ? "is" : "is not"} empty`)
      return isEmpty
    } catch (error) {
      console.error(`Error checking if bucket ${bucketName} is empty:`, error)
      // throw error
    }
  }
}
