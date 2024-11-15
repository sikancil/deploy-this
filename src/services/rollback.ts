import { ObjectType } from "./../utils/object"
import { Configuration } from "./../utils/configuration"
import * as fs from "node:fs"
import * as path from "node:path"
import { execSync } from "node:child_process"
import { ShellPrompts } from "../utils/shell.prompts"
import { Validation } from "../utils/validation"
import { handleError } from "../utils/error.handler"
import { ECR, ImageIdentifier } from "@aws-sdk/client-ecr"
import { ObjectIdentifier, S3 } from "@aws-sdk/client-s3"

import { DestroyType } from "../interfaces/common"

export class Rollback {
  private projectRoot: string
  private targetEnvironment: string
  // private deploymentType: string | undefined
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
    // this.deploymentType = ""
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

      // Determines the deployment type based on the files present in the Terraform directory.
      // this.deploymentType = Validation.checkDeploymentType(this.terraformDir)

      // Change to terraform directory
      process.chdir(this.terraformDir)

      // Prompt for destroy type
      const selectedDestroyType = this.destroyType
        ? this.destroyType
        : await ShellPrompts.selectDestroyType()

      // Initialize terraform
      this.runInit()

      // Clean up S3 artifacts before destroy
      const s3 = new S3({ region: this.enVars.AWS_REGION })
      // await this.cleanupS3Artifacts()
      const isBucketCleanedUp = await this.cleanupBucket(
        `${this.enVars.PROJECT_NAME}-artifacts`,
        s3,
      )

      if (isBucketCleanedUp) {
        console.log("✅ S3 bucket cleanup completed")
      } else {
        console.error("❌ S3 bucket cleanup failed")
        process.exit(1)
      }

      // Clean up ECR images before destroy
      const ecr = new ECR({ region: this.enVars.AWS_REGION })
      // await this.cleanupECRImages()
      const isRepositoryCleanedUp = await this.cleanupRepository(this.enVars.PROJECT_NAME, ecr)

      if (isRepositoryCleanedUp) {
        console.log("✅ ECR repository cleanup completed")
      } else {
        console.error("❌ ECR repository cleanup failed")
        process.exit(1)
      }

      // Run destroy based on selected type
      await this.runDestroy(selectedDestroyType, this.force)
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

  private async runDestroy(
    destroyType: DestroyType | undefined,
    force: boolean = false,
  ): Promise<void> {
    try {
      console.info(`Running ${destroyType} destroy...`)

      let destroyResult: Buffer

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
        destroyResult.toString().toLowerCase().includes("error") ||
        destroyResult.toString().toLowerCase().includes("failed") ||
        destroyResult.toString().toLowerCase().includes("invalid")
      ) {
        console.error(`❌ Terraform destroy failed:\n${destroyResult.toString()}\n`)
      } else {
        Configuration.updateEnvFile(this.targetEnvironment, {
          VPC_ID: "vpc-00000000000000000",
          IGW_ID: "igw-00000000000000000",
        })
        console.info(`✅ Terraform destroy completed successfully.\n`)
      }
    } catch (error) {
      throw new Error(`Terraform destroy failed: ${error}`)
    }
  }

  private async cliCleanupS3Artifacts(): Promise<void> {
    try {
      console.info("Cleaning up S3 artifacts...")

      // Delete all objects in the S3 bucket
      const deleteCommand = `aws s3 rm s3://${this.enVars.PROJECT_NAME}-artifacts --recursive`
      execSync(deleteCommand, { stdio: "inherit" })

      // Verify that the S3 bucket is empty
      const verifyCommand = `aws s3 ls s3://${this.enVars.PROJECT_NAME}-artifacts`
      const verifyResult = execSync(verifyCommand, { stdio: "inherit" })

      if (verifyResult?.toString()?.includes("NoSuchBucket") || ObjectType.isEmpty(verifyResult)) {
        console.info("✅ S3 artifacts cleanup completed")
      } else {
        console.error("❌ S3 artifacts cleanup failed")
      }
    } catch (error) {
      console.warn("Warning: Failed to cleanup S3 artifacts:", error)
      // Continue with destroy even if cleanup fails
    }
  }

  private async cliCleanupECRImages(): Promise<void> {
    try {
      console.info("Cleaning up ECR images...")

      // Get all image IDs in the ECR repository using AWS CLI
      const existingImageIds: string[] = []
      const listImageCommand = `aws ecr list-images \
        --repository-name ${this.enVars.PROJECT_NAME} \
        --query 'imageIds[*]'`
      const listImageResult = execSync(listImageCommand, { stdio: "inherit" })
      const imageIds = JSON.parse(listImageResult.toString())
      for (const imageId of imageIds) {
        existingImageIds.push(imageId)
      }

      // Delete all images in the ECR repository using AWS CLI
      for await (const imageId of existingImageIds) {
        console.info(`Deleting image ${imageId}...`)

        const deleteCommand = `aws ecr batch-delete-image \
          --repository-name ${this.enVars.PROJECT_NAME} \
          --image-ids ${imageId}`

        execSync(deleteCommand, { stdio: "inherit" })
      }

      // Verify that the ECR repository is empty
      const verifyCommand = `aws ecr describe-repositories \
        --repository-names ${this.enVars.PROJECT_NAME} \
        --query 'repositories[*].repositoryUri'`

      const verifyResult = execSync(verifyCommand, { stdio: "inherit" })
      if (verifyResult.toString().includes("null")) {
        console.info("✅ ECR images cleanup completed")
      } else {
        console.error("❌ ECR images cleanup failed")
      }
    } catch (error) {
      console.warn("Warning: Failed to cleanup ECR images:", error)
      // Continue with destroy even if cleanup fails
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
      console.error(`Error listing images in repository ${repositoryName}:`, error)
      throw error
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
      throw error
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
      throw error
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
        const response = await s3Instance
          .listObjectVersions({
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
      console.error(`Error listing objects in bucket ${bucketName}:`, error)
      throw error
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
      throw error
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
      throw error
    }
  }
}
