/**
 * The contract itself: schemas load, fixtures are valid, and the repository as
 * checked in passes its own validator.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { SchemaSet } from '../scripts/lib/schema.mjs';
import { SUPPORTED_SCHEMA_VERSIONS } from '../scripts/lib/rules.mjs';
import { computeConfigDigest } from '../scripts/lib/digest.mjs';
import { validateRepository } from '../scripts/lib/validate.mjs';
import { CONTRACT_FILE, CONTRACT_VERSION, buildManifest } from '../scripts/lib/contract.mjs';
import { parseJson } from '../scripts/lib/json.mjs';
import {
  FIXTURE_FILE_HASHES,
  REPO_ROOT,
  asProduction,
  codesOf,
  fixture,
  messagesOf,
  validateDocuments,
} from './helpers.mjs';

test('the repository as checked in passes its own validator', async () => {
  const result = await validateRepository(REPO_ROOT);
  assert.equal(result.errors.length, 0, messagesOf(result));
});

test('the check suite defines the required checks a listing depends on', async () => {
  const suite = parseJson(await readFile(join(REPO_ROOT, 'checks/checks.json'), 'utf8'), 'checks/checks.json');
  const required = suite.checks.filter((check) => check.required).map((check) => check.check_id);
  assert.deepEqual(required.sort(), [
    'access-and-auth-understood',
    'deploy-completes',
    'initial-setup-completes',
    'persistence-survives-restart',
    'primary-flow-works',
  ]);
});

test('a schema using a keyword the validator does not implement is refused', () => {
  assert.throws(
    () => new SchemaSet({
      'x.schema.json': { type: 'object', properties: { a: { type: 'string', format: 'email' } } },
    }),
    /keyword "format" is not implemented/,
  );
});

test('a schema using an unimplemented keyword is refused wherever it appears', () => {
  assert.throws(
    () => new SchemaSet({ 'x.schema.json': { allOf: [{ type: 'object', dependentRequired: {} }] } }),
    /keyword "dependentRequired" is not implemented/,
  );
});

test('every fixture record carries the digest its own contents produce', async () => {
  for (const name of ['tested.json', 'experimental.json', 'retired.json']) {
    const record = await fixture(`records/${name}`);
    const prefix = record.deployment.maintained_path;
    const hashes = prefix
      ? Object.fromEntries(Object.entries(FIXTURE_FILE_HASHES).filter(([path]) => path.startsWith(`${prefix}/`)))
      : {};
    const expected = computeConfigDigest(record, hashes);
    assert.equal(
      record.verification.config_digest,
      expected,
      `${name}: config_digest is stale. Recompute it: ${expected}`,
    );
  }
});

test('the representative valid records validate with no errors', async () => {
  const records = await Promise.all(
    ['tested.json', 'experimental.json', 'retired.json', 'draft.json'].map((name) => fixture(`records/${name}`)),
  );
  const result = await validateDocuments({ records: records.map(asProduction) });
  assert.equal(result.errors.length, 0, messagesOf(result));
  assert.equal(result.listed.length, 2);
});

test('an unsupported schema_version is refused rather than assumed compatible', async () => {
  const record = asProduction(await fixture('records/tested.json'));
  record.schema_version = '2.0.0';
  const result = await validateDocuments({ records: [record] });
  assert.ok(codesOf(result).includes('UNSUPPORTED_SCHEMA_VERSION'), messagesOf(result));
  assert.ok(!SUPPORTED_SCHEMA_VERSIONS.includes('2.0.0'));
});

test('an unknown field is an error, not something to ignore', async () => {
  const record = asProduction(await fixture('records/tested.json'));
  record.product.jury_score = 91;
  const result = await validateDocuments({ records: [record] });
  assert.deepEqual(codesOf(result), ['SCHEMA_INVALID'], messagesOf(result));
  assert.match(messagesOf(result), /unknown property "jury_score"/);
});

test('the pinned distribution manifest describes the files in this tree', async () => {
  const onDisk = parseJson(await readFile(join(REPO_ROOT, CONTRACT_FILE), 'utf8'), CONTRACT_FILE);
  const current = await buildManifest(REPO_ROOT);
  assert.deepEqual(
    onDisk,
    current,
    `${CONTRACT_FILE} is stale. Run: node scripts/catalog.mjs contract --write`,
  );
});

test('the manifest names the schema versions the validator actually accepts', async () => {
  const manifest = await buildManifest(REPO_ROOT);
  assert.deepEqual(manifest.supported_schema_versions, SUPPORTED_SCHEMA_VERSIONS);
  assert.equal(manifest.contract_version, CONTRACT_VERSION);
  assert.deepEqual(manifest.runtime.dependencies, [], 'the distribution must stay dependency-free');
  assert.equal(manifest.runtime.network, false);
});

test('the manifest covers every file the rules are implemented in', async () => {
  const manifest = await buildManifest(REPO_ROOT);
  const covered = new Set(manifest.files.map((file) => file.path));
  for (const path of ['scripts/lib/rules.mjs', 'scripts/lib/validate.mjs', 'scripts/lib/schema.mjs', 'checks/checks.json']) {
    assert.ok(covered.has(path), `${path} must be part of the pinned distribution`);
  }
});
