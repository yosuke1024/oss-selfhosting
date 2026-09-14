/**
 * The public entry point: validate a checkout of this repository.
 *
 * Consumers pin a version of this repository and call `validateRepository`
 * (or `validateDocuments`) rather than reimplementing any of it. A second
 * implementation of these rules somewhere else would drift, and the drift
 * would surface as something wrong being published.
 */

import { loadCatalog } from './loader.mjs';
import { validateCatalog, SUPPORTED_SCHEMA_VERSIONS, PUBLIC_LISTING_STATES } from './rules.mjs';

const SCHEMA_FOR = {
  record: 'product-record.schema.json',
  bundle: 'bundle.schema.json',
  checks: 'check-definition.schema.json',
};

function schemaErrors(schemas, schemaFile, path, document) {
  return schemas.validate(schemaFile, document).map((error) => ({
    code: 'SCHEMA_INVALID',
    file: path,
    pointer: error.path,
    message: `${error.path || '/'} ${error.message}`,
  }));
}

/**
 * @param {object} catalog the result of loadCatalog()
 * @param {{today?: string}} [options]
 */
export function validateLoadedCatalog(catalog, options = {}) {
  const errors = [];
  const keep = { records: [], bundles: [] };

  for (const entry of catalog.records) {
    const found = schemaErrors(catalog.schemas, SCHEMA_FOR.record, entry.path, entry.document);
    errors.push(...found);
    // A document that does not match the schema is already an error. Passing it
    // on to the rules would only produce a second description of the same
    // problem, so the rules see structurally sound documents only.
    if (found.length === 0) keep.records.push(entry);
  }
  for (const entry of catalog.bundles) {
    const found = schemaErrors(catalog.schemas, SCHEMA_FOR.bundle, entry.path, entry.document);
    errors.push(...found);
    if (found.length === 0) keep.bundles.push(entry);
  }
  let checks = catalog.checks;
  if (checks) {
    const found = schemaErrors(catalog.schemas, SCHEMA_FOR.checks, checks.path, checks.document);
    errors.push(...found);
    if (found.length > 0) checks = null;
  }

  const result = validateCatalog(
    { records: keep.records, bundles: keep.bundles, checks, files: catalog.files, fileHashes: catalog.fileHashes },
    options,
  );

  return {
    errors: [...errors, ...result.errors],
    warnings: result.warnings,
    listed: result.listed,
  };
}

/**
 * @param {string} root absolute path to a checkout of this repository
 * @param {{today?: string}} [options]
 */
export async function validateRepository(root, options = {}) {
  const catalog = await loadCatalog(root);
  return { catalog, ...validateLoadedCatalog(catalog, options) };
}

export { SUPPORTED_SCHEMA_VERSIONS, PUBLIC_LISTING_STATES };
