import fs from "node:fs"
import path from "node:path"
import dotenv from "dotenv"

import { ObjectType } from "./object"

export class Configuration {
  static readonly projectVariables = ["NODE_ENV", "PROJECT_NAME"]
  static readonly devopsVariables = [
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
  ]
  static readonly gitopsVariables = [
    "BITBUCKET_USERNAME",
    "BITBUCKET_APP_PASSWORD",
    "BITBUCKET_WORKSPACE",
    "BITBUCKET_BRANCH",
  ]
  static readonly optionalVariables = [
    "SSL_CERTIFICATE_ARN",

    "VPC_CIDR",
    "PUBLIC_SUBNET_CIDRS",
    "AVAILABILITY_ZONES",
    "MAP_PUBLIC_IP",

    "ROOT_VOLUME_TYPE",
    "ROOT_VOLUME_SIZE",
    "ROOT_VOLUME_ENCRYPTED",

    "APP_PORT",

    "ASG_DESIRED_CAPACITY",
    "ASG_MIN_SIZE",
    "ASG_MAX_SIZE",
    "BASE_CAPACITY",
    "ASG_CPU_TARGET",
    "ASG_RAM_TARGET",

    "HEALTH_CHECK_PATH",
    "HEALTH_CHECK_INTERVAL",
    "HEALTH_CHECK_TIMEOUT",
    "HEALTH_CHECK_HEALTHY_THRESHOLD",
    "HEALTH_CHECK_UNHEALTHY_THRESHOLD",
    "HEALTH_CHECK_MATCHER",

    "EXPOSE_HTTP",
    "EXPOSE_HTTPS",
    "EXPOSE_SSH",
  ]

  static readonly projectRoot: string = process.cwd()
  static readonly envFile: string = path.join(this.projectRoot, ".env")

  static get envConfig(): Record<string, string> {
    return dotenv.parse(fs.readFileSync(this.envFile))
  }

  static readonly dtEnvFile: string = path.join(
    this.projectRoot,
    `.env.dt.${this.envConfig.NODE_ENV}`,
  )

  static getConfig() {
    const envFile = path.join(this.projectRoot, ".env")
    const envConfig = dotenv.parse(fs.readFileSync(envFile))

    const dtEnvFile = path.join(this.projectRoot, `.env.dt.${envConfig.NODE_ENV}`)
    const dtEnvConfig = dotenv.parse(fs.readFileSync(dtEnvFile))

    return { ...envConfig, ...dtEnvConfig }
  }

  static getTerraformDir(targetEnvironment: string): string {
    if (ObjectType.isEmpty(targetEnvironment)) {
      throw new Error(`Target environment cannot be empty`)
    }
    return path.join(this.projectRoot, ".terraforms", targetEnvironment)
  }

  static updateEnvFile(targetEnvironment: string, updates: Record<string, string>): void {
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
}