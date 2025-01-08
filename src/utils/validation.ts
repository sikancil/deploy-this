import fs from "node:fs"
import path from "node:path"
import _ from "lodash"
import {
  DescribeInternetGatewaysCommand,
  DescribeInternetGatewaysResult,
  DescribeVpcsCommand,
  DescribeVpcsResult,
  EC2Client,
} from "@aws-sdk/client-ec2"

import { ObjectType } from "./object"
import { patchEnvs } from "./env"
import { DotenvParseOutput } from "dotenv"
import { Configuration } from "./configuration"

import { DeploymentType } from "../interfaces/common"
import { TFState } from "../interfaces/tfstate"

export class Validation {
  static readonly projectRoot: string = process.cwd()

  // checkTargetEnvironment checks for the existence of .terraforms directory and its contents.
  // NOTE: It throws an error if the directory or its contents are missing.  Interacts with the file system.
  static checkTargetEnvironment(): string[] {
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

  // checkDeploymentType checks for the deployment type (SINGLE.md or ASG.md) in the Terraform directory.
  // NOTE: It throws an error if the deployment type is not found or ambiguous. Interacts with the file system.
  static checkDeploymentType(targetEnvironment: string): DeploymentType {
    const terraformDir = Configuration.getTerraformDir(targetEnvironment)

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

    return deploymentTypeFiles?.[0].replace(".md", "")?.toLowerCase() as DeploymentType
  }

  // checkEnvironmentVariables checks for required and optional environment variables.
  // NOTE: It reads environment variables from .env and .env.dt.<NODE_ENV> files.  Interacts with the file system and environment variables.
  static checkEnvironmentVariables(useEnv: string | undefined = undefined): {
    enVars: { [key: string]: string }
    tfVars: string[]
  } {
    let NODE_ENV = useEnv ? useEnv : process.env.NODE_ENV
    let dotEnv: DotenvParseOutput = {}

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
      dotEnv = Configuration.envConfig
    }

    const dtEnvFile = path.join(this.projectRoot, `.env.dt.${NODE_ENV}`)

    let dtEnv: DotenvParseOutput
    if (!fs.existsSync(dtEnvFile)) {
      console.warn(`WARN: ${dtEnvFile} file not found. Please create it.`)
      dtEnv = {}
    } else {
      // dtEnv = dotenv.parse(fs.readFileSync(dtEnvFile))
      dtEnv = patchEnvs(dtEnvFile)
      console.log(`✅ .env.dt.${NODE_ENV}\n`)
    }

    const requiredEnvVars = ["NODE_ENV", "PROJECT_NAME"]
    const requiredDtEnvVars = [
      "DEPLOYMENT_TYPE",

      "AWS_PROFILE",
      "AWS_REGION",
      "AWS_ACCOUNT_ID",
      "AWS_ACCESS_KEY",
      "AWS_SECRET_KEY",

      "VPC_ID",
      "IGW_ID",

      "AMI_ID",
      "INSTANCE_TYPES",

      "BITBUCKET_USERNAME",
      "BITBUCKET_APP_PASSWORD",
      "BITBUCKET_WORKSPACE",
      "BITBUCKET_BRANCH",
    ]

    const deploymentType = this.checkDeploymentType(NODE_ENV as string)

    if (deploymentType === DeploymentType.ASG || deploymentType === DeploymentType.ECS) {
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
    optionalVars
      .filter((varName) => Configuration.optionalVariables.includes(varName))
      .forEach((varName) => {
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

  static async checkAwsVpc(
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

  static async checkAwsIgw(
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

  static async checkAwsVpcIgw(
    ec2Client: EC2Client,
    vpcId: string,
    igwId: string,
  ): Promise<{ valid: boolean; vpcId: string | undefined; igwId: string | undefined }> {
    const vpc = await this.checkAwsVpc(ec2Client, [vpcId])
    const igw = await this.checkAwsIgw(ec2Client, [igwId])

    return { valid: vpc.valid && igw.valid, vpcId: vpc.id, igwId: igw.id }
  }

  // checkTfState checks the Terraform state file for existing resources (VPC and IGW).
  // NOTE: It parses the state file and returns information about the existence of resources. Interacts with the file system and Terraform state file.
  static checkTfState(targetEnvironment: string): {
    tfStateExists: string | null | undefined
    vpcExists: string | null | undefined
    igwExists: string | null | undefined
  } {
    const terraformDir = Configuration.getTerraformDir(targetEnvironment)

    try {
      const stateFile = fs.readdirSync(terraformDir).find((file) => file.endsWith(".tfstate"))

      if (!ObjectType.isEmpty(stateFile)) {
        try {
          const fileTfState = fs.readFileSync(path.join(terraformDir, stateFile as string), "utf8")
          const tfState = JSON.parse(fileTfState) as TFState

          if (ObjectType.isEmpty(tfState?.resources)) {
            return { tfStateExists: undefined, vpcExists: undefined, igwExists: undefined }
          }

          const vpcs = (tfState?.resources || [])?.filter(
            (resource) => resource?.type === "aws_vpc" || resource?.name === "VPC",
          )
          // const vpcId = vpcs.find((vpc) => (vpc?.instances || [])?.find((instance) => instance?.attributes?.id === this.enVars.VPC_ID))
          //   ?.instances?.[0]?.attributes?.id
          const vpcId = vpcs.find((vpc) =>
            (vpc?.instances || [])?.find((instance) => instance?.attributes?.id),
          )?.instances?.[0]?.attributes?.id

          const igws = (tfState?.resources || [])?.filter(
            (resource) =>
              resource?.type === "aws_internet_gateway" || resource?.name === "InternetGateway",
          )
          // const igwId = igws.find((igw) => (igw?.instances || [])?.find((instance) => instance?.attributes?.id === this.enVars.IGW_ID))
          //   ?.instances?.[0]?.attributes?.id
          const igwId = igws.find((igw) =>
            (igw?.instances || [])?.find((instance) => instance?.attributes?.id),
          )?.instances?.[0]?.attributes?.id

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
}
