/**
 * Reading the repository into the shape the rules expect.
 *
 * Everything here is filesystem access and JSON parsing. No network, no
 * credentials, no access to JuryPress data: the same command runs for a
 * contributor with a clone and nothing else. That is a requirement of the
 * contract, not a convenience — a gate that only CI can run is not a gate a
 * contributor can satisfy before pushing.
 */

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { readJson } from './json.mjs';
import { SchemaSet } from './schema.mjs';
import { isConfigFile } from './digest.mjs';

const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules']);

export const RECORD_DIR = 'catalog/projects';
export const BUNDLE_DIR = 'catalog/bundles';
export const CHECKS_FILE = 'checks/checks.json';
export const SCHEMA_DIR = 'schemas';
export const SCHEMA_FILES = [
  'common.schema.json',
  'product-record.schema.json',
  'bundle.schema.json',
  'check-definition.schema.json',
];

/** Every file in the repository, as repository-relative POSIX paths. */
export async function listFiles(root, directory = '') {
  const absolute = directory ? join(root, directory) : root;
  const entries = await readdir(absolute, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      found.push(...(await listFiles(root, join(directory, entry.name))));
    } else if (entry.isFile()) {
      found.push(join(directory, entry.name).split(sep).join('/'));
    }
  }
  return found;
}

async function readJsonDirectory(root, directory) {
  let entries;
  try {
    entries = await readdir(join(root, directory), { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const documents = [];
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const path = `${directory}/${entry.name}`;
    documents.push({ path, document: await readJson(join(root, path), path) });
  }
  return documents;
}

/** The schema files, loaded and checked for keywords this validator implements. */
export async function loadSchemas(root) {
  const files = {};
  for (const name of SCHEMA_FILES) {
    files[name] = await readJson(join(root, SCHEMA_DIR, name), `${SCHEMA_DIR}/${name}`);
  }
  return new SchemaSet(files);
}

/**
 * @param {string} root absolute path to the repository root
 */
export async function loadCatalog(root) {
  const files = await listFiles(root);
  const fileHashes = {};
  for (const path of files) {
    if (!path.startsWith('deployments/') || !isConfigFile(path)) continue;
    const contents = await readFile(join(root, path));
    fileHashes[path] = createHash('sha256').update(contents).digest('hex');
  }

  let checks = null;
  if (files.includes(CHECKS_FILE)) {
    checks = { path: CHECKS_FILE, document: await readJson(join(root, CHECKS_FILE), CHECKS_FILE) };
  }

  return {
    root,
    files: new Set(files),
    fileHashes,
    records: await readJsonDirectory(root, RECORD_DIR),
    bundles: await readJsonDirectory(root, BUNDLE_DIR),
    checks,
    schemas: await loadSchemas(root),
  };
}
