/**
 * Test helpers.
 *
 * The fixtures on disk are written as `data_class: "fixture"` — that is what
 * they are, and it is what stops one of them from ever being mistaken for a
 * listing. A test that wants to exercise the catalog rules copies a fixture and
 * marks the copy production, in memory. Nothing writes a production document
 * into tests/, and nothing writes a fixture into catalog/.
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJson } from '../scripts/lib/json.mjs';
import { loadSchemas } from '../scripts/lib/loader.mjs';
import { validateLoadedCatalog } from '../scripts/lib/validate.mjs';
import { computeConfigDigest } from '../scripts/lib/digest.mjs';

export const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** Deployment configuration the fixtures pretend this repository maintains. */
export const FIXTURE_DEPLOYMENT_FILES = {
  'deployments/example-experimental/Dockerfile': 'FROM node:22-alpine\nWORKDIR /app\nCMD ["node", "server.js"]\n',
};

export const FIXTURE_FILE_HASHES = Object.fromEntries(
  Object.entries(FIXTURE_DEPLOYMENT_FILES).map(([path, contents]) => [
    path,
    createHash('sha256').update(contents).digest('hex'),
  ]),
);

/** Paths the fixtures reference. The rules only ask whether a path exists. */
export const FIXTURE_FILES = new Set([
  ...Object.keys(FIXTURE_DEPLOYMENT_FILES),
  'deployments/example-tested/README.md',
  'deployments/example-experimental/README.md',
  'deployments/example-retired/README.md',
  'notes/example-tested/2026-09-11-cost.md',
]);

let schemasPromise;
export function schemas() {
  schemasPromise ??= loadSchemas(REPO_ROOT);
  return schemasPromise;
}

export async function fixture(relativePath) {
  const path = join(REPO_ROOT, 'tests/fixtures', relativePath);
  return parseJson(await readFile(path, 'utf8'), `tests/fixtures/${relativePath}`);
}

/** A deep copy, so a test can mutate freely without touching another test. */
export function clone(document) {
  return structuredClone(document);
}

/** The same document as it would appear in catalog/: production data. */
export function asProduction(document) {
  const copy = clone(document);
  copy.data_class = 'production';
  return copy;
}

/** Recompute both digests so a mutated fixture stays self-consistent. */
export function refreshDigests(record, fileHashes = FIXTURE_FILE_HASHES) {
  const prefix = record.deployment?.maintained_path;
  const relevant = prefix
    ? Object.fromEntries(
        Object.entries(fileHashes).filter(([path]) => path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`)),
      )
    : {};
  const digest = computeConfigDigest(record, relevant);
  if (record.verification) record.verification.config_digest = digest;
  if (record.states?.approval) record.states.approval.approved_config_digest = digest;
  return record;
}

export function recordEntry(document) {
  return { path: `catalog/projects/${document.product.slug}.json`, document };
}

export function bundleEntry(document) {
  return { path: `catalog/bundles/${document.bundle_slug}.json`, document };
}

/**
 * Build an in-memory catalog and validate it.
 *
 * @param {object} input
 * @param {object[]} [input.records] product record documents
 * @param {object[]} [input.bundles] bundle documents
 * @param {object} [input.checks] a check suite document, defaulting to the real one
 * @param {{today?: string}} [options]
 */
export async function validateDocuments(input, options = {}) {
  const checks = input.checks ?? parseJson(await readFile(join(REPO_ROOT, 'checks/checks.json'), 'utf8'), 'checks/checks.json');
  const catalog = {
    records: (input.records ?? []).map((document) => input.entryFor?.(document) ?? recordEntry(document)),
    bundles: (input.bundles ?? []).map(bundleEntry),
    checks: { path: 'checks/checks.json', document: checks },
    files: input.files ?? FIXTURE_FILES,
    fileHashes: input.fileHashes ?? FIXTURE_FILE_HASHES,
    schemas: await schemas(),
  };
  return validateLoadedCatalog(catalog, { today: options.today ?? '2026-09-14' });
}

/** Error codes, sorted and de-duplicated, for readable assertions. */
export function codesOf(result) {
  return [...new Set(result.errors.map((error) => error.code))].sort();
}

export function messagesOf(result) {
  return result.errors.map((error) => `[${error.code}] ${error.file} ${error.message}`).join('\n');
}
