/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { ActionExecutorContract } from './action_executor';
import { ExecutorError } from './executor_error';
import { Logger, CoreStart } from '../../../../../src/core/server';
import { RunContext } from '../../../task_manager/server';
import { PluginStartContract as EncryptedSavedObjectsStartContract } from '../../../encrypted_saved_objects/server';
import { ActionTaskParams, GetBasePathFunction, SpaceIdToNamespaceFunction } from '../types';

export interface TaskRunnerContext {
  logger: Logger;
  encryptedSavedObjectsPlugin: EncryptedSavedObjectsStartContract;
  spaceIdToNamespace: SpaceIdToNamespaceFunction;
  getBasePath: GetBasePathFunction;
  getScopedSavedObjectsClient: CoreStart['savedObjects']['getScopedClient'];
}

export class TaskRunnerFactory {
  private isInitialized = false;
  private taskRunnerContext?: TaskRunnerContext;
  private readonly actionExecutor: ActionExecutorContract;

  constructor(actionExecutor: ActionExecutorContract) {
    this.actionExecutor = actionExecutor;
  }

  public initialize(taskRunnerContext: TaskRunnerContext) {
    if (this.isInitialized) {
      throw new Error('TaskRunnerFactory already initialized');
    }
    this.isInitialized = true;
    this.taskRunnerContext = taskRunnerContext;
  }

  public create({ taskInstance }: RunContext) {
    if (!this.isInitialized) {
      throw new Error('TaskRunnerFactory not initialized');
    }

    const { actionExecutor } = this;
    const {
      logger,
      encryptedSavedObjectsPlugin,
      spaceIdToNamespace,
      getBasePath,
      getScopedSavedObjectsClient,
    } = this.taskRunnerContext!;

    return {
      async run() {
        const { spaceId, actionTaskParamsId } = taskInstance.params;
        const namespace = spaceIdToNamespace(spaceId);

        const {
          attributes: { actionId, params, apiKey },
        } = await encryptedSavedObjectsPlugin.getDecryptedAsInternalUser<ActionTaskParams>(
          'action_task_params',
          actionTaskParamsId,
          { namespace }
        );

        const requestHeaders: Record<string, string> = {};
        if (apiKey) {
          requestHeaders.authorization = `ApiKey ${apiKey}`;
        }

        // Since we're using API keys and accessing elasticsearch can only be done
        // via a request, we're faking one with the proper authorization headers.
        const fakeRequest: any = {
          headers: requestHeaders,
          getBasePath: () => getBasePath(spaceId),
          path: '/',
          route: { settings: {} },
          url: {
            href: '/',
          },
          raw: {
            req: {
              url: '/',
            },
          },
        };

        const executorResult = await actionExecutor.execute({
          params,
          actionId,
          request: fakeRequest,
        });

        if (executorResult.status === 'error') {
          // Task manager error handler only kicks in when an error thrown (at this time)
          // So what we have to do is throw when the return status is `error`.
          throw new ExecutorError(
            executorResult.message,
            executorResult.data,
            executorResult.retry == null ? false : executorResult.retry
          );
        }

        // Cleanup action_task_params object now that we're done with it
        try {
          const savedObjectsClient = getScopedSavedObjectsClient(fakeRequest);
          await savedObjectsClient.delete('action_task_params', actionTaskParamsId);
        } catch (e) {
          // Log error only, we shouldn't fail the task because of an error here (if ever there's retry logic)
          logger.error(
            `Failed to cleanup action_task_params object [id="${actionTaskParamsId}"]: ${e.message}`
          );
        }
      },
    };
  }
}