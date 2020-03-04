/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

const { Client } = require('@elastic/elasticsearch');
import { createFailError } from '@kbn/dev-utils';
import chalk from 'chalk';
import { green } from './utils';
import { fromNullable as fN, tryCatch as tc, left, right } from './either';
import { always as F } from './utils';

const COVERAGE_INDEX = process.env.COVERAGE_INDEX || 'kibana_code_coverage';
const TOTALS_INDEX = process.env.TOTALS_INDEX || `kibana_total_code_coverage`;

const node = process.env.ES_HOST || 'http://localhost:9200';
const client = new Client({ node });
const redacted = redact(node);

const red = color('red');

const logAndSend = log => index => body =>
  tc(async () => await client.index({ index, body }))
    .fold(
      e => { throw createFailError(errMsg(index, body, e))},
      F(logSuccess(log, index, body))
    );

const logOnly = log => index => body => {
  log.debug(green(`### Just Logging, ${red('NOT')} actually sending`));
  logSuccess(log, index, body);
}
const logOrSendAndLog = process.env.NODE_ENV === 'integration_test' ? left() : right();

export const ingest = log => async body => {
  const index = !body.staticSiteUrl ? TOTALS_INDEX : COVERAGE_INDEX;

  logOrSendAndLog
    .fold(
      F(logOnly(log)(index)(body)),
      F(logAndSend(log)(index)(body))
    );
};

function logSuccess (log, index, body) {
  log.verbose(`
### Sent:
### ES HOST (redacted): ${redacted}
### Index: ${green(index)}
${pretty(body)}
`);

  const { staticSiteUrl } = body;

  log.debug(`
### Sent:
### Index: ${green(index)}
### staticSiteUrl: ${staticSiteUrl}
`);
}
function errMsg (index, body, e) {
  const orig = fN(e.body).fold(F(''), () => `### Orig Err:\n${pretty(e.body.error)}`);

  return `
### ES HOST (redacted): \n\t${red(redacted)}
### INDEX: \n\t${red(index)}
### Partial orig err stack: \n\t${partial(e.stack)}
### Item BODY:\n${pretty(body)}
${orig}

### Troubleshooting Hint:
${red('Perhaps the coverage data was not merged properly?\n')}
`;

}

function partial (x) {
  return x
    .split('\n')
    .splice(0, 2)
    .join('\n');
}
function redact (x) {
  const url = new URL(x);
  if (url.password) {
    return `${url.protocol}//${url.host}`;
  } else {
    return x;
  }
}
function color (whichColor) {
  return function colorInner (x) {
    return chalk[whichColor].bgWhiteBright(x);
  };
}
function pretty (x) {
  return JSON.stringify(x, null, 2);
}
