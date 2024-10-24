#!/usr/bin/env node

// Import necessary modules
import { Command } from "commander"
import { validateEnvironment } from "./utils/environment.validator"
import { handleError } from "./utils/error.handler"
import { run as cmdInit } from "./commands/init"
import { run as cmdDeploy } from "./commands/deploy"
import { run as cmdConfig } from "./commands/config"
import { run as cmdValidate } from "./commands/validate"
import { run as cmdStatus } from "./commands/status"
import { run as cmdRollback } from "./commands/rollback"
import { run as cmdIAM } from "./commands/iam"

// Create a new command-line interface (CLI) program
const program = new Command()
// Set the current working directory as the target directory
const TARGET_DIR = process.cwd()

// Configure the CLI program
program
  .name("dt")
  .description("DeployThis (dt) CLI for AWS infrastructure deployment")
  .version("1.0.0", "-v, --version")

// Define the 'init' command for initializing project configuration
// NOTE: This command initializes the project configuration based on the provided target environment and deployment type.
// It uses the validateEnvironment function from ./utils/environment.validator to validate the target environment.
// It then calls the cmdInit function from ./commands/init to perform the initialization.
program
  .command("init [targetEnvironment] [deploymentType]")
  .option("-f, --force", "Force initializing DeployThis requirements")
  .description("Initialize the project configuration")
  .action(async (targetEnvironment, deploymentType, args) => {
    // Determine if the force flag is set
    const doForce = args?.force === true
    try {
      // Validate the target environment or use a default if not provided
      targetEnvironment =
        targetEnvironment || (await validateEnvironment(TARGET_DIR, targetEnvironment, doForce))
      
      console.info(`🌥️ Target environment: ${targetEnvironment}\n`)

      // Run the initialization command
      await cmdInit(targetEnvironment, deploymentType, doForce)
    } catch (error) {
      // Handle any errors during initialization
      handleError(`Error during initialization.`, error)
    }
  })

// Define the 'deploy' command for deploying infrastructure
// NOTE: This command deploys the infrastructure to the specified target environment.
// It calls the cmdDeploy function from ./commands/deploy to perform the deployment.
program
  .command("deploy [targetEnvironment]")
  .description("Deploy infrastructure")
  .action(async (targetEnvironment) => {
    try {
      // Run the deployment command
      await cmdDeploy(targetEnvironment)
    } catch (error) {
      // Handle any errors during deployment
      handleError(`Error during deployment.`, error)
    }
  })

// Define the 'config' command for showing current configuration
program
  .command("config")
  .description("Show current configuration")
  .action(async () => {
    try {
      await cmdConfig()
    } catch (error) {
      handleError(`Error showing configuration.`, error)
    }
  })

// Define the 'validate' command for validating current setup
program
  .command("validate")
  .description("Validate current setup")
  .action(async () => {
    try {
      await cmdValidate()
    } catch (error) {
      handleError(`Error validating setup.`, error)
    }
  })

// Define the 'status' command for getting project-specific AWS information
program
  .command("status")
  .description("Get status and information for current project")
  .action(async () => {
    try {
      await cmdStatus()
    } catch (error) {
      handleError(`Error getting status.`, error)
    }
  })

// Define the 'rollback' command for rolling back infrastructure
program
  .command("rollback")
  .description("Rollback infrastructure (except VPC and InternetGateway)")
  .action(async () => {
    try {
      await cmdRollback()
    } catch (error) {
      handleError(`Error during rollback.`, error)
    }
  })

// Define the 'iam' command for managing IAM service accounts
program
  .command("iam <action> [user]")
  .description("Manage IAM service accounts")
  .action(async (action, user) => {
    try {
      await cmdIAM(action, user)
    } catch (error) {
      handleError(`Error in IAM command.`, error)
    }
  })

// Define the 'help' command for displaying help information
// NOTE: This command displays help information about the CLI program.
// It logs the current working directory and then uses program.outputHelp() to display the help information.
program
  .command("help")
  .description("Display help information")
  .action(() => {
    console.log(`Working directory: ${TARGET_DIR}`)
    program.outputHelp()
  })

// Parse the command-line arguments and execute the corresponding command
program.parse(process.argv)

// NOTE: If no command is provided, this will display the help information.
if (!process.argv.slice(2).length) {
  program.outputHelp()
}
