import fs from "node:fs"
import path from "node:path"
import dotenv from "dotenv"

export async function run(): Promise<void> {
  const TARGET_DIR = process.cwd()
  const envFile = path.join(TARGET_DIR, ".env")
  const envConfig = dotenv.parse(fs.readFileSync(envFile))

  const dtEnvFile = path.join(TARGET_DIR, `.env.dt.${envConfig.NODE_ENV}`)
  const dtEnvConfig = dotenv.parse(fs.readFileSync(dtEnvFile))

  console.log("Current Configuration:")
  console.log("---------------------")
  console.log(`Environment: ${envConfig.NODE_ENV}`)
  console.log(`Deployment Type: ${dtEnvConfig.DEPLOYMENT_TYPE}`)
  console.log(`AWS Region: ${dtEnvConfig.AWS_REGION}`)
  console.log(`VPC ID: ${dtEnvConfig.VPC_ID}`)
  console.log(`Internet Gateway ID: ${dtEnvConfig.IGW_ID}`)
  // Add more configuration details as needed
}
