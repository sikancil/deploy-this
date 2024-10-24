import { IAMService } from "../services/iam"
import { handleError } from "../utils/error.handler"

/**
 * Runs the IAM command based on the provided action and user.
 * @param action - The IAM action to perform (show, create, delete, update).
 * @param user - The IAM user to perform the action on (optional for 'show' action).
 */
export async function run(action: string, user?: string): Promise<void> {
  const iamService = new IAMService()

  await iamService.initialize()

  try {
    switch (action) {
      case "show":
        await iamService.show(user)
        break
      case "create":
        if (!user) {
          throw new Error("User parameter is required for create action")
        }
        await iamService.create(user)
        break
      case "delete":
        if (!user) {
          throw new Error("User parameter is required for delete action")
        }
        await iamService.delete(user)
        break
      case "update":
        if (!user) {
          throw new Error("User parameter is required for update action")
        }
        await iamService.update(user)
        break
      default:
        throw new Error(`Invalid action: ${action}`)
    }
  } catch (error) {
    handleError(`Error in IAM command: ${action}`, error)
  }
}
