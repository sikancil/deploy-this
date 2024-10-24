import fs from "node:fs"
import path from "node:path"
import dotenv from "dotenv"

export async function loadConfig() {
  const TARGET_DIR = process.cwd()
  const envFile = path.join(TARGET_DIR, ".env")
  const envConfig = dotenv.parse(fs.readFileSync(envFile))

  const dtEnvFile = path.join(TARGET_DIR, `.env.dt.${envConfig.NODE_ENV}`)
  const dtEnvConfig = dotenv.parse(fs.readFileSync(dtEnvFile))

  return { ...envConfig, ...dtEnvConfig }
}
