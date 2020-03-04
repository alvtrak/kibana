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

import expect from '@kbn/expect';
import { spawn } from 'child_process';
import { resolve } from 'path';

const ROOT_DIR = resolve(__dirname, '../../../../..');
const MOCKS_DIR = resolve(__dirname, './mocks');
const assertions = {
  staticHostIncluded: /https:\/\/kibana-coverage\.elastic\.dev/,
  jobNameIncluded: /jobs\/elastic\+kibana\+code-coverage/,
  timeStampIncluded: /\d{4}-\d{2}-\d{2}T\d{2}.*\d{2}.*\d{2}Z/,
  folderStructureIncluded: /live_cc_app\/coverage_data/,
  endsInDotHtml: /.html$/,
};
const env = {
  BUILD_ID: 407,
  CI_RUN_URL: 'https://kibana-ci.elastic.co/job/elastic+kibana+code-coverage/407/',
  STATIC_SITE_URL_BASE: 'https://kibana-coverage.elastic.dev/jobs/elastic+kibana+code-coverage',
  TIME_STAMP: '2020-03-02T21:11:47Z',
  ES_HOST: 'https://super:changeme@142fea2d3047486e925eb8b223559cae.europe-west1.gcp.cloud.es.io:9243',
  NODE_ENV: 'integration_test',
};

const setup = summaryPath => done => xs => {
  const args = [
    'scripts/ingest_coverage.js',
    '--debug',
    '--path',
    summaryPath,
  ];
  const create = spawn(process.execPath, args, { cwd: ROOT_DIR, env });
  create.stdout.on('data', x => xs.push(x + ''));
  create.on('close', done);
};

const resolveMocksDirWith = resolve.bind(null, MOCKS_DIR);
const setupWithoutTotals = setup(resolveMocksDirWith('jest-combined/coverage-summary-NO-total.json'));
const setupWithTotals = setup(resolveMocksDirWith('jest-combined/coverage-summary-just-total.json'));

describe('Ingesting Coverage to Cluster', () => {
  describe('Without "Totals" Data', () => {
    const chunksWithoutTotals = [];

    beforeAll(done => {
      setupWithoutTotals(done)(chunksWithoutTotals);
    });

    it('should result in every posted item having a static site url that meets certain requirements, tested via regex', () => {
      const includesSiteUrlPredicate = x => x.includes('staticSiteUrl');
      const expectAllRegexesToPass = urlLine =>
        Object.entries(assertions).forEach(reList => expect(reList[1].test(urlLine)).to.be(true));

      chunksWithoutTotals
        .filter(includesSiteUrlPredicate)
        .map(x => x.split('\n').reduce(getUrlLine))
        .forEach(expectAllRegexesToPass);
    })
  });
  describe('With "Totals" Data', () => {
    const chunksWithTotals = [];

    beforeAll(done => {
      setupWithTotals(done)(chunksWithTotals);
    });
    it('NOT IMPLEMENTED YET', () => {
      expect(true).to.be(true);
    });
  });

});

function getUrlLine(acc, item) {
  if (item != '') {
    return item;
  }
  return acc;
}
