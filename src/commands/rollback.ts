import { execSync } from "node:child_process"
import { loadConfig } from "../utils/config.loader"

export async function run(): Promise<void> {
  const config = await loadConfig()

  console.log("Starting rollback process...")

  try {
    // Change to the Terraform directory
    process.chdir(`.terraforms/${config.NODE_ENV}`)

    // Run Terraform destroy, excluding VPC and InternetGateway
    execSync(
      'terraform destroy -target="aws_autoscaling_group.app" -target="aws_launch_template.app" -target="aws_lb.app" -auto-approve',
      { stdio: "inherit" },
    )

    console.log("Rollback completed successfully.")
  } catch (error) {
    console.error("Error during rollback:", (error as Error).message)
  }
}
