import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeInstancesCommandOutput,
} from "@aws-sdk/client-ec2"
import { Configuration } from "../utils/configuration"

export async function run(): Promise<void> {
  const config = await Configuration.getConfig()
  const ec2Client = new EC2Client({ region: config.AWS_REGION })

  try {
    const command = new DescribeInstancesCommand({
      Filters: [
        {
          Name: "tag:Project",
          Values: [config.PROJECT_NAME],
        },
      ],
    })

    const response: DescribeInstancesCommandOutput = await ec2Client.send(command)

    console.log("Project Status:")
    console.log("---------------")
    console.log(`Total Instances: ${response?.Reservations?.length}`)

    response?.Reservations?.forEach((reservation, index) => {
      const instance = reservation?.Instances?.[0]
      console.log(`\nInstance ${index + 1}:`)
      console.log(`  Instance ID: ${instance?.InstanceId}`)
      console.log(`  State: ${instance?.State?.Name}`)
      console.log(`  Public IP: ${instance?.PublicIpAddress}`)
      console.log(`  Private IP: ${instance?.PrivateIpAddress}`)
    })
  } catch (error) {
    console.error("Error fetching project status:", error)
  }
}
