/* eslint-disable no-useless-catch */

import axios, { AxiosInstance } from "axios"
import { UUID, isUUID } from "../utils/uuid"

// Interfaces
export interface BitbucketAuth {
  username: string
  appPassword: string
}

export interface BitbucketConfig {
  workspace: string
  repoSlug: string
}

export interface BitbucketVariable {
  scope?: string
  name?: string
  type?: string
  uuid?: string
  key: string
  value: string
  secured: boolean
}

export enum VariableScope {
  DEPLOYMENT = "deployments",
  REPOSITORY = "repository",
}

export interface Environment {
  type: string
  name: string
  slug: string
  rank?: number
  environment_type?: {
    name: string
    rank: number
    type: string
  }
  deployment_gate_enabled?: boolean
  environment_lock_enabled?: boolean
  lock?: {
    name?: string
    type?: string
    lock_opener?: {
      type?: string
      pipeline_uuid?: string
      deployment_group_uuid?: string
      step_uuid?: string
    }
    triggerer?: {
      type?: string
      pipeline_uuid?: string
      step_uuid?: string
    }
  }
  restrictions?: {
    type?: string
    admin_only?: boolean
  }
  hidden?: boolean
  uuid: string
  category?: { [key: string]: string }
}

// Service class
export class BitbucketService {
  private client: AxiosInstance
  private config: BitbucketConfig

  constructor(auth: BitbucketAuth, config: BitbucketConfig) {
    this.config = config
    this.client = axios.create({
      baseURL: "https://api.bitbucket.org/2.0",
      auth: {
        username: auth.username,
        password: auth.appPassword,
      },
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${auth.username}:${auth.appPassword}`, "utf8").toString("base64")}`,
      },
    })
  }

  // Environment Management
  private async getEnvironments(): Promise<Environment[]> {
    try {
      const response = await this.client.get(
        `/repositories/${this.config.workspace}/${this.config.repoSlug}/environments`,
      )

      return response.data?.values
        ?.filter((env: Environment) => env?.type === "deployment_environment")
        ?.map((env: Environment) => ({
          uuid: env?.uuid,
          name: env?.name,
          slug: env?.slug,
        }))
    } catch (error) {
      // console.error(`Failed to get environments: `, error)
      throw error
    }
  }

  private async getEnvironment(name: string): Promise<Environment> {
    try {
      if (!name) {
        throw new Error("Environment name is required")
      }

      const response = await this.client.get(
        `/repositories/${this.config.workspace}/${this.config.repoSlug}/environments`,
      )

      const environment = response.data.values.find(
        (env: Environment) =>
          env.name.toLowerCase() === name.toLowerCase() ||
          env.slug.toLowerCase() === name.toLowerCase(),
      )

      if (environment) {
        return environment
      }

      // Create new environment if it doesn't exist
      const createResponse = await this.client.post(
        `/repositories/${this.config.workspace}/${this.config.repoSlug}/environments`,
        {
          type: "deployment_environment",
          name: name,
        },
      )

      return createResponse.data
    } catch (error) {
      // console.error(`Failed to get/create environment ${name}: `, error)
      throw error
    }
  }

  private async getDeploymentEnvironments(
    stage?: UUID | string | undefined,
  ): Promise<{ [key: string]: Environment[] }> {
    try {
      const stages: { name: string; slug: string; uuid: UUID }[] = []
      if (!stage) {
        const envs = await this.getEnvironments()
        envs?.map((env) =>
          stages.push({ name: env?.name, slug: env?.slug, uuid: env?.uuid as UUID }),
        )
      } else {
        if (isUUID(stage)) {
          stages.push({ name: stage, slug: stage, uuid: stage })
        } else {
          const env = await this.getEnvironment(stage)
          if (!env) {
            throw new Error(`Environment ${stage} not found`)
          }
          stages.push({ name: env?.name, slug: env?.slug, uuid: env?.uuid as UUID })
        }
      }

      const responses = await Promise.all(
        stages.map(async (envStage) => {
          const response = await this.client.get(
            `/repositories/${this.config.workspace}/${this.config.repoSlug}/deployments_config/environments/${encodeURIComponent(envStage.uuid)}/variables`,
          )
          return {
            scope: VariableScope.DEPLOYMENT,
            stage: stage || envStage.slug,
            name: envStage.name,
            variables: response.data.values.filter(
              (env: BitbucketVariable) => env.type === "pipeline_variable",
            ),
          }
        }),
      )

      const finalResponse = Object.fromEntries(
        responses.map((response) => [
          response.stage,
          response.variables.map((env: BitbucketVariable) => ({
            scope: VariableScope.REPOSITORY,
            name: response.name,
            stage: response.stage,
            ...env,
          })),
        ]),
      )

      return finalResponse
    } catch (error) {
      // TODO: Handle error
      // (error as AxiosError).code === "ECONNREFUSED"  // "connect ECONNREFUSED 127.0.0.1:443"
      // (error as AxiosError).code === "ENOTFOUND"  // "getaddrinfo ENOTFOUND api.bitbucket.org"
      // (error as AxiosError).code === "ECONNRESET"  // "read ECONNRESET"
      // (error as AxiosError).code === "ETIMEDOUT"  // "read ETIMEDOUT"
      // (error as AxiosError).code === "EPIPE"  // "read EPIPE"
      // (error as AxiosError).code === "EAI_AGAIN"  // "getaddrinfo EAI_AGAIN api.bitbucket.org"
      // (error as AxiosError).code === "ERR_INVALID_URL"  // "Invalid URL"
      // (error as AxiosError).code === "ERR_BAD_RESPONSE"  // "Invalid response"
      // (error as AxiosError).code === "ERR_BAD_REQUEST"  // "Invalid request"
      // (error as AxiosError).code === "ERR_SOCKET_TIMEOUT"  // "socket timeout"
      // (error as AxiosError).code === "ERR_TIMEOUT"  // "timeout of 0ms exceeded"
      // Limit requests (429 Too Many Requests)

      // console.error(`Failed to get environments: `, error)
      throw error
    }
  }

  private async getRepositoryEnvironments(): Promise<Environment[]> {
    try {
      const response = await this.client.get(
        `/repositories/${this.config.workspace}/${this.config.repoSlug}/pipelines_config/variables`,
      )

      return response.data.values
        .filter((env: BitbucketVariable) => env.type === "pipeline_variable")
        // .map((env: BitbucketVariable) => env)
    } catch (error) {
      // console.error(`Failed to get environments: `, error)
      throw error
    }
  }

  // Variable Management
  async listVariables(options: {
    scope: VariableScope | undefined
    stage?: UUID | string | undefined
  }): Promise<{ [key: string]: any }> {
    try {
      const deployments = !options.scope
        ? await this.getDeploymentEnvironments(options.stage)
        : options.scope === VariableScope.DEPLOYMENT
          ? !options.stage
            ? await this.getDeploymentEnvironments(options.stage)
            : (await this.getDeploymentEnvironments(options.stage))?.[options.stage]
          : undefined

      const repository = !options.scope
        ? await this.getRepositoryEnvironments()
        : options.scope === VariableScope.REPOSITORY
          ? await this.getRepositoryEnvironments()
          : undefined

      const variables = {
        deployments,
        repository,
      }

      return variables
    } catch (error) {
      // console.error(`Failed to list variables: `, error)
      throw error
    }
  }

  async ensureVariable(
    variable: BitbucketVariable,
    options: {
      scope: VariableScope
      stage?: UUID | string | undefined
    },
  ): Promise<void> {
    try {
      let baseUrl: string
      const existingVariables = await this.listVariables(options)

      if (!options.stage) {
        throw new Error("Stage is required")
      }

      if (isUUID(options.stage)) {
        baseUrl = `/repositories/${this.config.workspace}/${this.config.repoSlug}/deployments_config/environments/${options.stage}/variables`
      } else if (options.scope === "repository") {
        baseUrl = `/repositories/${this.config.workspace}/${this.config.repoSlug}/pipelines_config/variables`
      } else {
        const stageEnv = await this.getEnvironment(options.stage || "test")
        baseUrl = `/repositories/${this.config.workspace}/${this.config.repoSlug}/deployments_config/environments/${encodeURIComponent(stageEnv.uuid)}/variables`
      }

      // if (options.scope === "repository") {
      //   baseUrl = `/repositories/${this.config.workspace}/${this.config.repoSlug}/pipelines_config/variables`
      // } else {
      //   const stageEnv = await this.getEnvironmentUuid(options.stage || "test")
      //   baseUrl = `/repositories/${this.config.workspace}/${this.config.repoSlug}/deployments_config/environments/${stageEnv}/variables`
      // }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingVar = existingVariables.find((v: any) => v.key === variable.key)

      const payload = {
        type: "pipeline_variable",
        key: variable.key,
        value: variable.value,
        secured: variable.secured,
      }

      if (existingVar?.uuid) {
        // Update existing variable
        await this.client.put(`${baseUrl}/${existingVar.uuid}`, payload)
      } else {
        // Create new variable
        await this.client.post(baseUrl, payload)
      }
    } catch (error) {
      // console.error(`Failed to ensure variable ${variable.key}: `, error)
      throw error
    }
  }

  async removeVariable(
    key: string,
    options: {
      scope: VariableScope
      stage?: UUID | string | undefined
    },
  ): Promise<void> {
    try {
      let baseUrl: string

      if (!options.stage) {
        throw new Error("Stage is required")
      }

      if (isUUID(options.stage)) {
        baseUrl = `/repositories/${this.config.workspace}/${this.config.repoSlug}/deployments_config/environments/${options.stage}/variables`
      } else if (options.scope === "repository") {
        baseUrl = `/repositories/${this.config.workspace}/${this.config.repoSlug}/pipelines_config/variables`
      } else {
        const envUuid = await this.getEnvironment(options.stage || "test")
        baseUrl = `/repositories/${this.config.workspace}/${this.config.repoSlug}/deployments_config/environments/${envUuid}/variables`
      }

      const existingVariables = await this.listVariables(options)

      const existingVar = existingVariables.find((v: any) => v.key === key)

      if (existingVar?.uuid) {
        await this.client.delete(`${baseUrl}/${existingVar.uuid}`)
      } else {
        throw new Error(`Variable ${key} not found`)
      }
    } catch (error) {
      // console.error(`Failed to remove variable ${key}: `, error)
      throw error
    }
  }

  // Bulk Operations
  async initializeFromEnvironment(variables: Record<string, string>): Promise<void> {
    const entries = Object.entries(variables)

    for (const [key, value] of entries) {
      // Skip empty or undefined values
      if (!value) continue

      // Determine if variable should be secured based on key naming
      const secured =
        key.toLowerCase().includes("key") ||
        key.toLowerCase().includes("secret") ||
        key.toLowerCase().includes("password")

      const variable: BitbucketVariable = {
        key,
        value,
        secured,
      }

      // Set as repository variable if it's a global config
      if (key === "PROJECT_NAME" || key === "DEPLOYER") {
        await this.ensureVariable(variable, { scope: VariableScope.REPOSITORY })
      } else {
        // Set as deployment variable for both staging and production
        await this.ensureVariable(variable, { scope: VariableScope.DEPLOYMENT, stage: "staging" })
        await this.ensureVariable(variable, { scope: VariableScope.DEPLOYMENT, stage: "test" })
      }
    }
  }
}
