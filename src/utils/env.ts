import fs from "node:fs"
import dotenv from "dotenv"

import { ObjectType } from "./object"

function loadEnvs(dotEnfFilePath: string): { [key: string]: string } {
  const fileExists = fs.existsSync(dotEnfFilePath)
  if (!fileExists) {
    const error = new Error(`dotEnv file not found at ${dotEnfFilePath}`)
    error.name = "ENOENT"
    throw error
  }

  const { error, parsed } = dotenv.config({ path: dotEnfFilePath, override: true })
  if (error) {
    throw error
  }
  return parsed as { [key: string]: string }
}

export function patchEnvs(
  dotEnfFilePath: string,
  patches: NodeJS.ProcessEnv | { [key: string]: string } = {},
  merge: boolean = false,
): { [key: string]: string } {
  try {
    let keyValues = loadEnvs(dotEnfFilePath)
    Object.keys(keyValues).forEach((env) => {
      // replace env values contains ${VARIABLES} with the real value
      // e.g. ${HOME} => /home/username
      keyValues[env] = keyValues[env].replace(/\${(.*?)}/g, (_match, p1) => {
        return process.env[p1] || keyValues[env]
      })
    })
    keyValues = merge
      ? ObjectType.applyIf(ObjectType.apply(process.env, keyValues), patches || {})
      : ObjectType.applyIf(keyValues, patches || {})

    return keyValues
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ patchEnvs Exception: ${(error as Error).message}\n`)
      return {}
    } else {
      console.error(`❌ patchEnvs Unknown error: ${error}\n`)
      return {}
    }
  }
}
