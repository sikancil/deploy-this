// NOTE: This function handles errors that occur during the execution of the DeployThis CLI.
// It logs the error message to the console and provides additional context if available.
// After logging the error, it exits the process with a non-zero exit code (1), indicating that an error occurred.
// This function is used by the 'init' and 'deploy' commands in src/index.ts to handle errors that may occur during initialization and deployment.

export function handleError(message: string = "Unknown error.", error: unknown): void {
  console.error(`Error: ${message}`)

  if (error instanceof Error) {
    console.error(`Details: ${error.message}`)
    if (error.stack && process.env.DEBUG === "1") {
      console.error(`Stack trace: ${error.stack}`)
    }
  } else if (typeof error === "string") {
    console.error(`Additional info: ${error}`)
  }

  // TODO: Consider adding more sophisticated error handling, such as logging to a file or sending error reports.

  process.exit(1)
}
