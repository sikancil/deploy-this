import {
  IAMClient,
  ListUsersCommand,
  CreateUserCommand,
  DeleteUserCommand,
  AttachUserPolicyCommand,
  DetachUserPolicyCommand,
  ListAttachedUserPoliciesCommand,
  CreateAccessKeyCommand,
  DeleteAccessKeyCommand,
  ListAccessKeysCommand,
  AttachedPolicy,
  GetUserCommand,
  User,
} from "@aws-sdk/client-iam"
import _ from "lodash"
import { Configuration } from "../utils/configuration"

export class IAMService {
  private iamClient: IAMClient | undefined

  constructor() {}

  public initialize() {
    const config = Configuration.getConfig()
    this.iamClient = new IAMClient({
      region: config.AWS_REGION,
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY,
        secretAccessKey: config.AWS_SECRET_KEY,
      },
    })
  }

  /**
   * Shows information about IAM service account users.
   * @param user - Optional user to show information for. If not provided, shows all users.
   */
  async show(user?: string): Promise<void> {
    try {
      console.info(`Sending request to provider...`)
      if (user) {
        const command = new GetUserCommand({ UserName: user })
        const response = await this.iamClient?.send(command)

        if (response?.User === undefined) {
          console.warn("Unknown User")
          return
        }

        const userInfo = response?.User
        if (userInfo) {
          console.info(`👤 ${userInfo.UserName} - ${userInfo.UserId} (${userInfo.Arn})`)
          const policies = await this.showUserPolicies(user)
          console.table(policies)
          console.log("\n")
        } else {
          console.info(`User ${user} not found.`)
        }
      } else {
        const command = new ListUsersCommand({})
        const response = await this.iamClient?.send(command)

        if (response?.Users === undefined) {
          console.warn("Unknown list of users")
          return
        }

        const usersWithTags = _.compact(
          await Promise.all(
            ((response?.Users || []) as User[]).map(async (user) => {
              const command = new GetUserCommand({ UserName: user.UserName })
              const response = await this.iamClient?.send(command)
              return response?.User
            })
          )
        )

        const serviceAccounts = usersWithTags.filter((user) =>
          user.Tags
            ? user?.Tags?.length > 0
              ? user.Tags?.some(
                  (tag) => tag.Key === "ServiceAccount" || tag.Value === "ServiceAccounts",
                )
              : false
            : false
        )

        if (serviceAccounts.length === 0) {
          console.info("No service accounts type (tag) found.")
          return
        }

        if (serviceAccounts?.length > 0) {
          const displayUser = []
          for await (const userInfo of serviceAccounts || []) {
            const displayData = { ...userInfo, policies: [] }
            const policies = await this.showUserPolicies(userInfo.UserName!)
            displayData.policies = policies as never[]
            displayUser.push(displayData)
          }

          displayUser.forEach((user) => {
            console.info(`👤 ${user.UserName} - ${user.UserId} (${user.Arn})`)
            if (user.policies.length > 0) {
              console.table(user.policies)
            }
            console.log("\n")
          })
        }
      }
    } catch (error) {
      console.error("Error showing IAM users:", error)
      throw error
    }
  }

  /**
   * Creates a new IAM service account user with required policies.
   * @param user - The name of the user to create.
   */
  async create(user: string): Promise<void> {
    try {
      const createUserCommand = new CreateUserCommand({ UserName: user })
      await this.iamClient?.send(createUserCommand)

      const policies = this.getRequiredPolicies()
      for (const policy of policies) {
        const attachPolicyCommand = new AttachUserPolicyCommand({
          UserName: user,
          PolicyArn: policy,
        })
        await this.iamClient?.send(attachPolicyCommand)
      }

      const createAccessKeyCommand = new CreateAccessKeyCommand({ UserName: user })
      const accessKeyResponse = await this.iamClient?.send(createAccessKeyCommand)

      console.info(`User ${user} created successfully`)
      console.info("Access Key ID:", accessKeyResponse?.AccessKey?.AccessKeyId)
      console.info("Secret Access Key:", accessKeyResponse?.AccessKey?.SecretAccessKey)
    } catch (error) {
      console.error("Error creating IAM user:", error)
      throw error
    }
  }

  /**
   * Deletes an IAM service account user and its attached policies.
   * @param user - The name of the user to delete.
   */
  async delete(user: string): Promise<void> {
    try {
      const policies = await this.getUserPolicies(user)
      for (const policy of policies) {
        const detachPolicyCommand = new DetachUserPolicyCommand({
          UserName: user,
          PolicyArn: policy.PolicyArn,
        })
        await this.iamClient?.send(detachPolicyCommand)
      }

      const listAccessKeysCommand = new ListAccessKeysCommand({ UserName: user })
      const accessKeysResponse = await this.iamClient?.send(listAccessKeysCommand)
      for (const accessKey of accessKeysResponse?.AccessKeyMetadata || []) {
        const deleteAccessKeyCommand = new DeleteAccessKeyCommand({
          UserName: user,
          AccessKeyId: accessKey.AccessKeyId,
        })
        await this.iamClient?.send(deleteAccessKeyCommand)
      }

      const deleteUserCommand = new DeleteUserCommand({ UserName: user })
      await this.iamClient?.send(deleteUserCommand)

      console.info(`User ${user} deleted successfully`)
    } catch (error) {
      console.error("Error deleting IAM user:", error)
      throw error
    }
  }

  /**
   * Updates an IAM service account user's policies.
   * @param user - The name of the user to update.
   */
  async update(user: string): Promise<void> {
    try {
      const currentPolicies = await this.getUserPolicies(user)
      const requiredPolicies = this.getRequiredPolicies()

      for (const policy of currentPolicies) {
        if (!requiredPolicies.includes(policy.PolicyArn!)) {
          const detachPolicyCommand = new DetachUserPolicyCommand({
            UserName: user,
            PolicyArn: policy.PolicyArn!,
          })
          await this.iamClient?.send(detachPolicyCommand)
        }
      }

      for (const policy of requiredPolicies) {
        if (!currentPolicies.some((p) => p.PolicyArn === policy)) {
          const attachPolicyCommand = new AttachUserPolicyCommand({
            UserName: user,
            PolicyArn: policy,
          })
          await this.iamClient?.send(attachPolicyCommand)
        }
      }

      console.info(`User ${user} updated successfully`)
    } catch (error) {
      console.error("Error updating IAM user:", error)
      throw error
    }
  }

  private async showUserPolicies(user: string): Promise<AttachedPolicy[]> {
    const policies = await this.getUserPolicies(user)
    // for (const policy of policies) {
    //   console.info(`- ${policy.PolicyName} (${policy.PolicyArn})`)
    // }
    return policies
  }

  private async getUserPolicies(user: string): Promise<AttachedPolicy[]> {
    const command = new ListAttachedUserPoliciesCommand({ UserName: user })
    const response = await this.iamClient?.send(command)
    return response?.AttachedPolicies || []
  }

  private getRequiredPolicies(): string[] {
    return [
      "arn:aws:iam::aws:policy/AmazonEC2FullAccess",
      "arn:aws:iam::aws:policy/AmazonVPCFullAccess",
      "arn:aws:iam::aws:policy/AmazonS3FullAccess",
      "arn:aws:iam::aws:policy/AmazonRDSFullAccess",
      "arn:aws:iam::aws:policy/ElasticLoadBalancingFullAccess",
      "arn:aws:iam::aws:policy/AWSCodeDeployFullAccess",
      "arn:aws:iam::aws:policy/AmazonECS_FullAccess",
      "arn:aws:iam::aws:policy/CloudWatchFullAccess",
    ]
  }
}
