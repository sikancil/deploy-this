/* eslint-disable no-useless-catch */

import axios, { AxiosInstance } from "axios"
import { UUID, isUUID } from "../utils/uuid"
import { Configuration } from "../utils/configuration"
import _ from "lodash";

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
  stage?: string
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
  private allowedVariables: string[] = Configuration.gitopsAllowedVariables

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

  private async getDeploymentVariables(
    stage?: UUID | string | undefined,
  ): Promise<{ [key: string]: BitbucketVariable[] }> {
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
            `/repositories/${this.config.workspace}/${this.config.repoSlug}/deployments_config/environments/${encodeURIComponent(envStage.uuid)}/variables?page=1&pagelen=100`,
          )
          return {
            scope: VariableScope.DEPLOYMENT,
            stage: stage || envStage.slug,
            name: envStage.name,
            variables: (response.data.values as BitbucketVariable[]).filter(
              (env: BitbucketVariable) => env.type === "pipeline_variable",
            ),
          }
        }),
      )

      const finalResponse = Object.fromEntries(
        responses.map((response) => [
          response.stage,
          response.variables.map((env) => ({
            scope: VariableScope.DEPLOYMENT,
            name: response.name,
            stage: response.stage,
            ...env,
          })) as BitbucketVariable[],
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

  private async getRepositoryVariables(): Promise<BitbucketVariable[]> {
    try {
      const response = await this.client.get(
        `/repositories/${this.config.workspace}/${this.config.repoSlug}/pipelines_config/variables`,
      )

      return (response.data.values as BitbucketVariable[]).filter(
        (env: BitbucketVariable) => env.type === "pipeline_variable",
      )
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
  }): Promise<{
    deployments?: { [key: string]: BitbucketVariable[] }
    repository?: BitbucketVariable[]
  }> {
    try {
      const deployments = !options.scope
        ? await this.getDeploymentVariables(options.stage)
        : options.scope === VariableScope.DEPLOYMENT
          ? !options.stage
            ? await this.getDeploymentVariables(options.stage)
            : {
                [options.stage]: (await this.getDeploymentVariables(options.stage))?.[
                  options.stage
                ],
              }
          : undefined

      const repository = !options.scope
        ? await this.getRepositoryVariables()
        : options.scope === VariableScope.REPOSITORY
          ? await this.getRepositoryVariables()
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
      scope: VariableScope | undefined
      stage?: UUID | string | undefined
    },
  ): Promise<void> {
    try {
      let baseUrl: string
      options.scope = options.scope || VariableScope.REPOSITORY

      const existingVariables = await this.listVariables(options)

      if (isUUID(options.stage)) {
        baseUrl = `/repositories/${this.config.workspace}/${this.config.repoSlug}/deployments_config/environments/${encodeURIComponent(options.stage)}/variables`
      } else if (options.scope === "repository") {
        baseUrl = `/repositories/${this.config.workspace}/${this.config.repoSlug}/pipelines_config/variables`
      } else {
        const stageEnv = await this.getEnvironment(options.stage || "test")
        options.stage = stageEnv.uuid
        baseUrl = `/repositories/${this.config.workspace}/${this.config.repoSlug}/deployments_config/environments/${encodeURIComponent(options.stage)}/variables`
      }

      const payload = {
        type: "",
        key: variable.key,
        value: variable.value,
        secured: variable.secured,
      }

      if (options.scope === VariableScope.REPOSITORY) {
        if (!this.allowedVariables.includes(variable.key)) {
          console.warn(`❗️ WARN: Filter Unnecessary Variable ${variable.key}`)
          return
        }

        // Upsert repository variables only
        const existingVar = existingVariables?.repository?.find((v) => v?.key === variable?.key)
        payload.type = "pipeline_variable"

        if (existingVar) {
          const result = await this.client.put(`${baseUrl}/${existingVar.uuid}`, payload)
          console.log(
            result
              ? `✅ Set Exist Repository Variable ${variable.key}`
              : `❌ Failed to set Repository Variable ${variable.key}`,
          )
        } else {
          const result = await this.client.post(baseUrl, payload)
          console.log(
            result
              ? `✅ Set New Repository Variable ${variable.key}`
              : `❌ Failed to set Repository Variable ${variable.key}`,
          )
        }
      } else if (options.scope === VariableScope.DEPLOYMENT) {
        // if (!this.allowedVariables.includes(variable.key)) {
        //   console.warn(`❗️ WARN: Filter Unnecessary Variable ${variable.key}`)
        //   return
        // }

        // Upsert deployment variables only
        const existingVar: BitbucketVariable = Object.keys(
          existingVariables?.deployments,
        ).reduce<BitbucketVariable>((_acc, _env: string) => {
          const existingVarInDeployment: BitbucketVariable = (
            existingVariables?.deployments as { [key: string]: BitbucketVariable[] }
          )?.[_env]?.find((v) => v?.key === variable?.key)
          _acc = !existingVarInDeployment ? _acc : existingVarInDeployment
          return _acc
        }, undefined)

        payload.type = "pipeline_variable"

        if (existingVar) {
          const result = await this.client.put(`${baseUrl}/${existingVar.uuid}`, payload)
          console.log(
            result
              ? `✅ Set Exist Deployment Variable ${variable.key}`
              : `❌ Failed to set Deployment Variable ${variable.key}`,
          )
        } else {
          const result = await this.client.post(baseUrl, payload)
          console.log(
            result
              ? `✅ Set New Deployment Variable ${variable.key}`
              : `❌ Failed to set Deployment Variable ${variable.key}`,
          )
        }
      } else {
        console.error(`Invalid scope ${options.scope}`)
      }
    } catch (error) {
      // console.error(`Failed to ensure variable ${variable.key}: `, error)
      throw error
    }
  }

  async removeVariable(
    key: string,
    options: {
      scope: VariableScope | undefined
      stage?: UUID | string | undefined
    },
  ): Promise<void> {
    try {
      let baseUrl: string

      options.scope = options.scope || VariableScope.REPOSITORY

      const existingVariables = await this.listVariables(options)

      if (isUUID(options.stage)) {
        baseUrl = `/repositories/${this.config.workspace}/${this.config.repoSlug}/deployments_config/environments/${encodeURIComponent(options.stage)}/variables`
      } else if (options.scope === "repository") {
        baseUrl = `/repositories/${this.config.workspace}/${this.config.repoSlug}/pipelines_config/variables`
      } else {
        const stageEnv = await this.getEnvironment(options.stage || "test")
        options.stage = stageEnv.uuid
        baseUrl = `/repositories/${this.config.workspace}/${this.config.repoSlug}/deployments_config/environments/${encodeURIComponent(options.stage)}/variables`
      }

      // Check if variable exists in deployments
      const existingVarInDeployments: BitbucketVariable = Object.keys(
        existingVariables?.deployments || {},
      ).reduce<BitbucketVariable>((_acc, _env: string) => {
        const existingVarInDeployment: BitbucketVariable = (
          existingVariables?.deployments as { [key: string]: BitbucketVariable[] }
        )?.[_env]?.find((v) => v?.key === key)
        _acc = !existingVarInDeployment ? _acc : existingVarInDeployment
        return _acc
      }, undefined)

      // Check if variable exists in repository
      const existingVarInRespository: BitbucketVariable = existingVariables?.repository?.find(
        (v: BitbucketVariable) => v?.key === key,
      )

      if (options.scope === VariableScope.REPOSITORY) {
        if (!existingVarInRespository) {
          console.error(`Variable ${key} not found`)
        }

        const result = await this.client.delete(`${baseUrl}/${existingVarInRespository.uuid}`)
        console.log(
          result
            ? `✅ Removed Repository Variable ${key}`
            : `❌ Failed to remove Repository Variable ${key}`,
        )

        return
      } else if (options.scope === VariableScope.DEPLOYMENT) {
        if (!existingVarInDeployments) {
          console.error(`Variable ${key} not found`)
        }

        const result = await this.client.delete(`${baseUrl}/${existingVarInDeployments.uuid}`)
        console.log(
          result
            ? `✅ Removed Deployment Variable ${key}`
            : `❌ Failed to remove Deployment Variable ${key}`,
        )

        return
      } else {
        console.error(`Invalid scope ${options.scope}`)
      }
    } catch (error) {
      // console.error(`Failed to remove variable ${key}: `, error)
      throw error
    }
  }

  // Bulk Operations
  async initializeFromEnvironment(
    variables: Record<string, string>,
    stage?: string | undefined,
  ): Promise<void> {
    try {
      const existingVariables = await this.listVariables({ scope: undefined, stage: stage })
      if(variables.DEPLOYMENT_TYPE == "ecs") {
        variables =  _.pick(variables, Configuration.gitopsAllowedEcsDeploymentVariables)
      }

      const entries = Object.entries(variables)

      for (const [key, value] of entries) {
        // Skip empty or undefined values
        if (!value) continue

        // if (!this.allowedVariables.includes(key)) {
        //   console.warn(`❗️ WARN: Filter Unnecessary Variable ${key}`)
        //   continue
        // }

        // Check if variable exists in deployments
        const existingVarInDeployments: BitbucketVariable = Object.keys(
          existingVariables?.deployments || {},
        ).reduce<BitbucketVariable>((_acc, _env: string) => {
          const existingVarInDeployment: BitbucketVariable = (
            existingVariables?.deployments as { [key: string]: BitbucketVariable[] }
          )?.[_env]?.find((v) => v?.key === key)
          _acc = !existingVarInDeployment ? _acc : existingVarInDeployment
          return _acc
        }, undefined)

        // Check if variable exists in repository
        const existingVarInRepository: BitbucketVariable = existingVariables?.repository?.find(
          (v) => v?.key === key,
        )

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
          variable.type = "pipeline_variable"
          await this.ensureVariable(existingVarInRepository ? modifyExistVar(existingVarInDeployments, variable) : variable, {
            scope: VariableScope.REPOSITORY,
          })
        } else {
          // Set as deployment variable for both staging and production
          variable.type = "pipeline_variable"
          await this.ensureVariable(
            existingVarInDeployments ? modifyExistVar(existingVarInDeployments, variable) : variable,
            { scope: VariableScope.DEPLOYMENT, stage: stage || "test" },
          )
        }
      }
    } catch (error) {
      // console.error(`Failed to initialize variables: `, error)
      throw error
    }
  }
}

function modifyExistVar(existingVarInDeployments, variable){
  existingVarInDeployments.value = variable.value
  return existingVarInDeployments
}
