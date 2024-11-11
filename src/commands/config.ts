// DO NOT IMPLEMENT ESLINT OR PRETTIER OR OTHER FORMATTERS

// prettier-ignore
/* eslint-disable */
/* eslint-disable no-console */
/* eslint-disable-next-line prettier/prettier */

import path from "node:path"
import { patchEnvs } from "../utils/env"
import { undefinedText } from "../interfaces/common"

export async function run(): Promise<void> {
  const TARGET_DIR = process.cwd()
  const envFile = path.join(TARGET_DIR, ".env")
  const envConfig = patchEnvs(envFile)

  const dtEnvFile = path.join(TARGET_DIR, `.env.dt.${envConfig.NODE_ENV}`)
  const dtEnvConfig = patchEnvs(dtEnvFile)

  console.info(`
Current Configuration:
----------------------
${envConfig.NODE_ENV                  ? "🔹" : "🔸"} Stage Environment      : ${envConfig.NODE_ENV || undefinedText}
${envConfig.PROJECT_NAME              ? "🔹" : "🔸"} Project Name           : ${envConfig.PROJECT_NAME || undefinedText}
${dtEnvConfig.DEPLOYMENT_TYPE         ? "🔹" : "🔸"} Deployment Type        : ${dtEnvConfig.DEPLOYMENT_TYPE || undefinedText}

${dtEnvConfig.AWS_PROFILE             ? "🔹" : "🔸"} AWS Profile            : ${dtEnvConfig.AWS_PROFILE || undefinedText}
${dtEnvConfig.AWS_REGION              ? "🔹" : "🔸"} AWS Region             : ${dtEnvConfig.AWS_REGION || undefinedText}
${dtEnvConfig.AWS_ACCOUNT_ID          ? "🔹" : "🔸"} AWS Account            : ${dtEnvConfig.AWS_ACCOUNT_ID || undefinedText}

${dtEnvConfig.AWS_ACCESS_KEY          ? "🔹" : "🔸"} AWS Access Key         : ${dtEnvConfig.AWS_ACCESS_KEY || undefinedText}
${dtEnvConfig.AWS_SECRET_KEY          ? "🔹" : "🔸"} AWS Secret Key         : ${dtEnvConfig.AWS_SECRET_KEY || undefinedText}

${dtEnvConfig.VPC_ID                  ? "🔹" : "🔸"} VPC ID                 : ${dtEnvConfig.VPC_ID || undefinedText}
${dtEnvConfig.IGW_ID                  ? "🔹" : "🔸"} Internet Gateway ID    : ${dtEnvConfig.IGW_ID || undefinedText}

${dtEnvConfig.BITBUCKET_USERNAME      ? "🔹" : "🔸"} Bitbucket Username     : ${dtEnvConfig.BITBUCKET_USERNAME || undefinedText}
${dtEnvConfig.BITBUCKET_APP_PASSWORD  ? "🔹" : "🔸"} Bitbucket Credentials  : ${dtEnvConfig.BITBUCKET_APP_PASSWORD || undefinedText}
${dtEnvConfig.BITBUCKET_WORKSPACE     ? "🔹" : "🔸"} Bitbucket Workspace    : ${dtEnvConfig.BITBUCKET_WORKSPACE || undefinedText}
${dtEnvConfig.BITBUCKET_BRANCH        ? "🔹" : "🔸"} Bitbucket Branch       : ${dtEnvConfig.BITBUCKET_BRANCH || undefinedText}
`)
}
