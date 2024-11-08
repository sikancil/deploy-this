import { Command } from "commander"
import { BitbucketService, BitbucketVariable, VariableScope } from "../services/bitbucket"
import { handleError } from "../utils/error.handler"
import { Configuration } from "../utils/configuration"
import { ObjectType } from "../utils/object"

// Create subcommands for variables management
const variablesCommand = new Command("variables").description("Manage Bitbucket Pipeline variables")

// List variables command
variablesCommand
  .command("list")
  .description("List pipeline variables")
  .option("--stage <stage>", "Stage for deployment variables (staging/production)")
  .option("--scope <scope>", "Variable scope (deployment/repository)")
  .action(async (options) => {
    try {
      const scope: VariableScope | undefined = ObjectType.strToEnum(VariableScope, options.scope)
      const stage = options.stage

      const service = createBitbucketService()
      const displayVariables = await service.listVariables({ scope, stage })

      console.log("\nBitbucket Pipeline Variables:")
      if (!ObjectType.isEmpty(displayVariables)) {
        if (!ObjectType.isEmpty(displayVariables?.["deployments"])) {
          console.info("Deployment Variables:")

          for (const [stage, variables] of Object.entries(displayVariables?.["deployments"])) {
            console.info(`Stage: ${stage}`)

            const stageVariables = (variables as BitbucketVariable[])?.map((variable: any) => {
              return {
                key: variable.key,
                value: variable.secured ? "********" : variable.value,
                secured: variable.secured,
              }
            })
            console.table(stageVariables)
          }
        } else {
          console.info("Deployment Variables ignored or has no variables.")
        }
        console.log()

        if (!ObjectType.isEmpty(displayVariables?.["repository"])) {
          console.info("Repository Variables:")
          const displayRepository = displayVariables?.["repository"]?.map((variable: any) => {
            return {
              key: variable.key,
              value: variable.secured ? "********" : variable.value,
              secured: variable.secured,
            }
          })
          console.table(displayRepository)
          console.log()
        } else {
          console.info("Repository Variables ignored or has no variables.")
        }
      } else {
        console.log("No variables found.")
      }
      console.log()
    } catch (error) {
      handleError("Failed to list variables", error)
    }
  })

// Initialize variables from environment
variablesCommand
  .command("init")
  .description("Initialize pipeline variables from environment")
  .action(async () => {
    try {
      const service = createBitbucketService()

      // Convert ProcessEnv to Record<string, string> by filtering out undefined values
      const envVars: Record<string, string> = Object.entries(process.env)
        .filter(([, value]) => value !== undefined)
        .reduce(
          (acc, [key, value]) => ({
            ...acc,
            [key]: value as string,
          }),
          {},
        )

      console.log("\nInitializing Bitbucket Pipeline variables...")
      await service.initializeFromEnvironment(envVars)
      console.log("Variables initialized successfully!\n")
    } catch (error) {
      handleError("Failed to initialize variables", error)
    }
  })

// Ensure variable command
variablesCommand
  .command("ensure")
  .description("Ensure pipeline variable exists with specified value")
  .requiredOption("--key <key>", "Variable key")
  .requiredOption("--value <value>", "Variable value")
  .option("--scope <scope>", "Variable scope (deployment/repository)", "deployment")
  .option("--stage <stage>", "Stage for deployment variables (staging/production)")
  .option("--secure", "Mark variable as secured", false)
  .action(async (options) => {
    try {
      const scope: VariableScope | undefined = ObjectType.strToEnum(VariableScope, options.scope)
      if (scope !== VariableScope.DEPLOYMENT && scope !== VariableScope.REPOSITORY) {
        throw new Error('Invalid scope. Must be either "deployment" or "repository"')
      }

      const service = createBitbucketService()
      await service.ensureVariable(
        {
          key: options.key,
          value: options.value,
          secured: options.secure,
        },
        {
          scope,
          stage: options.stage,
        },
      )

      console.log(`\nVariable '${options.key}' ensured successfully!\n`)
    } catch (error) {
      handleError("Failed to ensure variable", error)
    }
  })

// Remove variable command
variablesCommand
  .command("remove")
  .description("Remove pipeline variable")
  .requiredOption("--key <key>", "Variable key")
  .requiredOption("--scope <scope>", "Variable scope (deployment/repository)")
  .option("--stage <stage>", "Stage for deployment variables (staging/production)")
  .action(async (options) => {
    try {
      const scope = options.scope as VariableScope
      if (scope !== VariableScope.DEPLOYMENT && scope !== VariableScope.REPOSITORY) {
        throw new Error('Invalid scope. Must be either "deployment" or "repository"')
      }

      const service = createBitbucketService()
      await service.removeVariable(options.key, {
        scope,
        stage: options.stage,
      })

      console.log(`\nVariable '${options.key}' removed successfully!\n`)
    } catch (error) {
      handleError("Failed to remove variable", error)
    }
  })

// Helper function to create BitbucketService instance
function createBitbucketService(): BitbucketService {
  const envConfig = Configuration.getConfig()

  const username = envConfig.BITBUCKET_USERNAME
  const appPassword = envConfig.BITBUCKET_APP_PASSWORD
  const workspace = envConfig.BITBUCKET_WORKSPACE
  const repoSlug = envConfig.BITBUCKET_REPO_SLUG

  if (!username || !appPassword || !workspace || !repoSlug) {
    throw new Error(
      "Missing required environment variables: BITBUCKET_USERNAME, BITBUCKET_APP_PASSWORD, BITBUCKET_WORKSPACE, BITBUCKET_REPO_SLUG",
    )
  }

  return new BitbucketService({ username, appPassword }, { workspace, repoSlug })
}

// Export the variables command
export const run = (program: Command): void => {
  program
    .command("pipelines")
    .description("Manage Bitbucket Pipelines")
    .addCommand(variablesCommand)
}
