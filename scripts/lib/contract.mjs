/**
 * The pinned distribution manifest.
 *
 * A consumer — the JuryPress site build is the first — pins a commit of this
 * repository and calls the validator that ships with it, rather than writing a
 * second implementation of these rules. A second implementation drifts, and the
 * drift shows up as something being published that this repository would have
 * refused.
 *
 * The manifest is what makes that pin checkable: it names the contract version,
 * the schema versions it accepts, the entry points to call, and the hash of
 * every file that carries the contract. A consumer can verify it got what it
 * pinned; CI verifies the manifest still describes the files in the tree.
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SUPPORTED_KEYWORDS } from './schema.mjs';
import { SUPPORTED_SCHEMA_VERSIONS } from './rules.mjs';
import { SCHEMA_DIR, SCHEMA_FILES, CHECKS_FILE } from './loader.mjs';

export const CONTRACT_FILE = 'schemas/contract.json';
export const CONTRACT_VERSION = '1.0.0';

/** Files that carry the contract, in the order they appear in the manifest. */
export const CONTRACT_FILES = [
  ...SCHEMA_FILES.map((name) => `${SCHEMA_DIR}/${name}`),
  CHECKS_FILE,
  'scripts/lib/contract.mjs',
  'scripts/lib/digest.mjs',
  'scripts/lib/json.mjs',
  'scripts/lib/loader.mjs',
  'scripts/lib/rules.mjs',
  'scripts/lib/schema.mjs',
  'scripts/lib/urls.mjs',
  'scripts/lib/validate.mjs',
];

/**
 * @param {string} root absolute path to a checkout of this repository
 * @returns {Promise<object>} the manifest the current tree implies
 */
export async function buildManifest(root) {
  const files = [];
  for (const path of CONTRACT_FILES) {
    const contents = await readFile(join(root, path));
    files.push({ path, sha256: createHash('sha256').update(contents).digest('hex') });
  }
  return {
    contract_version: CONTRACT_VERSION,
    supported_schema_versions: [...SUPPORTED_SCHEMA_VERSIONS],
    description:
      'The OSS Self-Hosting catalog contract: the schemas, the validation rules and the required-check suite. '
      + 'Pin a commit of this repository and call the entry points below; do not reimplement the rules.',
    dialect: {
      base: 'https://json-schema.org/draft/2020-12/schema',
      note:
        'The bundled validator implements the keywords listed here and refuses to load a schema that uses any other. '
        + 'A consumer using a full JSON Schema implementation instead will read the same schemas correctly; '
        + 'the structural schemas are not the whole contract, and the rules in scripts/lib/rules.mjs are the rest.',
      keywords: [...SUPPORTED_KEYWORDS].sort(),
    },
    entry_points: {
      validate_repository: 'scripts/lib/validate.mjs#validateRepository',
      validate_documents: 'scripts/lib/validate.mjs#validateLoadedCatalog',
      rules: 'scripts/lib/rules.mjs#validateCatalog',
      config_digest: 'scripts/lib/digest.mjs#computeConfigDigest',
      schemas: `${SCHEMA_DIR}/`,
      cli: 'scripts/catalog.mjs',
    },
    runtime: {
      node: '>=22',
      dependencies: [],
      network: false,
      credentials: false,
    },
    files,
  };
}
