/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { schema, TypeOf } from '@kbn/config-schema';
import JoiNamespace from 'joi';

export const config = {
  schema: schema.object({
    enabled: schema.boolean(),
    registryUrl: schema.string(),
  }),
};

export type EPMConfigSchema = TypeOf<typeof config.schema>;

// This is needed for the legacy plugin / NP shim setup in ../index
// It has been moved here to keep the two config schemas as close together as possible.
// Once we've moved to NP, the Joi version will disappear, so we're not trying to generate
// these two config schemas from a common definition or from each other.

export const getConfigSchema = (Joi: typeof JoiNamespace) => {
  const EPMConfigSchema = Joi.object({
    enabled: Joi.boolean().default(true),
    registryUrl: Joi.string()
      .uri()
      .default(),
  }).default();

  return EPMConfigSchema;
};

const DEFAULT_CONFIG = {
  enabled: true,
  // This is the staging url and should be later switched to https://epr.elastic.co for production
  // Both are behind a CDN with caching, so upgrading the registry will not immidiately invalidate
  // all the cached information.
  registryUrl: 'https://epr-staging.elastic.co',
};

// As of 2019, this is a Singleton because of the way JavaScript modules are specified.
// Every module that imports this file will have access to the same object.

// This is meant to be only updated from the config$ Observable's subscription
// (see the Plugin class constructor in server/plugin.ts) but this is not enforced.

let _config: EPMConfigSchema = DEFAULT_CONFIG;

export const epmConfigStore = {
  updateConfig(newConfig: EPMConfigSchema) {
    _config = Object.assign({}, _config, newConfig);
  },
  getConfig() {
    return _config;
  },
};