import fs from "node:fs"
import dotenv from "dotenv"

import { ObjectType } from "./object"

function loadEnvs(dotEnfFilePath: string): { [key: string]: string } {
  const fileExists = fs.existsSync(dotEnfFilePath)
  if (!fileExists) {
    throw new Error(`dotEnv file not found at ${dotEnfFilePath}`)
  }

  const { error, parsed } = dotenv.config({ path: dotEnfFilePath, override: true })
  if (error) {
    throw error
  }
  return parsed as { [key: string]: string }
}

export function patchEnvs(
  dotEnfFilePath: string,
  patches?: NodeJS.ProcessEnv,
): { [key: string]: string } {
  let keyValues = loadEnvs(dotEnfFilePath)
  Object.keys(keyValues).forEach((env) => {
    // replace env values contains ${VARIABLES} with the real value
    // e.g. ${HOME} => /home/username
    keyValues[env] = keyValues[env].replace(/\${(.*?)}/g, (_match, p1) => {
      return process.env[p1] || keyValues[env]
    })
  })
  keyValues = ObjectType.applyIf(ObjectType.apply(process.env, keyValues), patches || {})

  return keyValues
}
