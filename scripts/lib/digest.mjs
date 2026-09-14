/**
 * The deployment configuration digest.
 *
 * A verification is a statement about one deployment of one version. What it
 * has to survive is drift: the record gets edited after the fact — a newer
 * upstream commit, a different template, an added service, an edited
 * Dockerfile — while the verification block, and the approval on it, stay as
 * they were. Nothing in the text of the record makes that visible.
 *
 * So the fields that decide what actually gets deployed are hashed, together
 * with the contents of any deployment configuration this repository maintains
 * for the product. The verification records the digest it covers; the approval
 * records the digest a person signed off. Change any of those inputs and both
 * stop matching, which is exactly the moment re-verification and re-approval
 * are required.
 *
 * Prose is deliberately excluded: fixing a typo in a setup guide does not
 * invalidate a deployment that was actually performed.
 */

import { createHash } from 'node:crypto';
import { canonicalJson } from './json.mjs';

export function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Files under deployments/<slug>/ that participate in the digest.
 * Markdown is the reader-facing guide; everything else is configuration.
 */
export function isConfigFile(path) {
  return !path.toLowerCase().endsWith('.md');
}

/**
 * @param {object} record a product record
 * @param {Record<string, string>} configFileHashes repository-relative path -> sha256 of contents
 * @returns {string} hex sha256
 */
export function computeConfigDigest(record, configFileHashes = {}) {
  const deployment = record.deployment ?? {};
  const target = record.verification?.target ?? {};
  const material = {
    digest_inputs_version: 1,
    upstream_repo_url: record.product?.upstream?.repo_url ?? null,
    upstream_license: record.product?.upstream?.license ?? null,
    provider: deployment.provider ?? null,
    template_type: deployment.template_type ?? null,
    route_url: deployment.route_url ?? null,
    maintained_path: deployment.maintained_path ?? null,
    dependent_services: (deployment.dependent_services ?? [])
      .map((service) => ({
        name: service.name,
        required: service.required,
        supplied_by: service.supplied_by,
      }))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
    target: {
      upstream_commit: target.upstream_commit ?? null,
      upstream_version: target.upstream_version ?? null,
      image_digest: target.image_digest ?? null,
      template_revision: target.template_revision ?? null,
    },
    maintained_config: Object.keys(configFileHashes)
      .sort()
      .map((path) => ({ path, sha256: configFileHashes[path] })),
  };
  return sha256(canonicalJson(material));
}
