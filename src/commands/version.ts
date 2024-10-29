import { readFileSync } from "fs"
import { join } from "path"

export function run(): string {
  try {
    const packagePath = join(__dirname, "../../package.json")
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8"))
    return packageJson.version
  } catch (error) {
    throw new Error(`Failed to read version: ${error}`)
  }
}
