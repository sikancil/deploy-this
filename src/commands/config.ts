// DO NOT IMPLEMENT ESLINT OR PRETTIER OR OTHER FORMATTERS

// prettier-ignore
/* eslint-disable */
/* eslint-disable no-console */
/* eslint-disable-next-line prettier/prettier */

import path from "node:path"
import { patchEnvs } from "../utils/env"

export async function run(): Promise<void> {
  const TARGET_DIR = process.cwd()
  const envFile = path.join(TARGET_DIR, ".env")
  const envConfig = patchEnvs(envFile)

  const dtEnvFile = path.join(TARGET_DIR, `.env.dt.${envConfig.NODE_ENV}`)
  const dtEnvConfig = patchEnvs(dtEnvFile)

  console.info(`
Current Configuration:
----------------------
${envConfig.NODE_ENV                  ? "🔹" : "🔸"} Environment            : ${envConfig.NODE_ENV}  
${dtEnvConfig.DEPLOYMENT_TYPE         ? "🔹" : "🔸"} Deployment Type        : ${dtEnvConfig.DEPLOYMENT_TYPE}

${dtEnvConfig.AWS_PROFILE             ? "🔹" : "🔸"} AWS Profile            : ${dtEnvConfig.AWS_PROFILE}
${dtEnvConfig.AWS_REGION              ? "🔹" : "🔸"} AWS Region             : ${dtEnvConfig.AWS_REGION}
${dtEnvConfig.AWS_ACCOUNT_ID          ? "🔹" : "🔸"} AWS Account            : ${dtEnvConfig.AWS_ACCOUNT_ID}

${dtEnvConfig.AWS_ACCESS_KEY          ? "🔹" : "🔸"} AWS Access Key         : ${dtEnvConfig.AWS_ACCESS_KEY}
${dtEnvConfig.AWS_SECRET_KEY          ? "🔹" : "🔸"} AWS Secret Key         : ${dtEnvConfig.AWS_SECRET_KEY}

${dtEnvConfig.VPC_ID                  ? "🔹" : "🔸"} VPC ID                 : ${dtEnvConfig.VPC_ID}
${dtEnvConfig.IGW_ID                  ? "🔹" : "🔸"} Internet Gateway ID    : ${dtEnvConfig.IGW_ID}

${dtEnvConfig.ECR_REGISTRY            ? "🔹" : "🔸"} ECR Registry           : ${dtEnvConfig.ECR_REGISTRY}
${dtEnvConfig.ECR_REPOSITORY_NAME     ? "🔹" : "🔸"} ECR Repository Name    : ${dtEnvConfig.ECR_REPOSITORY_NAME}

${dtEnvConfig.CODEDEPLOY_APP_NAME     ? "🔹" : "🔸"} CodeDeploy App Name    : ${dtEnvConfig.CODEDEPLOY_APP_NAME}
${dtEnvConfig.CODEDEPLOY_GROUP_NAME   ? "🔹" : "🔸"} CodeDeploy Group Name  : ${dtEnvConfig.CODEDEPLOY_GROUP_NAME}
${dtEnvConfig.CODEDEPLOY_S3_BUCKET    ? "🔹" : "🔸"} CodeDeploy S3 Bucket   : ${dtEnvConfig.CODEDEPLOY_S3_BUCKET}

${dtEnvConfig.BITBUCKET_APP_PASSWORD  ? "🔹" : "🔸"} Bitbucket Credentials  : ${dtEnvConfig.BITBUCKET_APP_PASSWORD}
${dtEnvConfig.BITBUCKET_WORKSPACE     ? "🔹" : "🔸"} Bitbucket Workspace    : ${dtEnvConfig.BITBUCKET_WORKSPACE}
${dtEnvConfig.BITBUCKET_BRANCH        ? "🔹" : "🔸"} Bitbucket Branch       : ${dtEnvConfig.BITBUCKET_BRANCH}
`)
}
