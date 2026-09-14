/**
 * The catalog rules.
 *
 * The schemas say what shape a document has. These rules say what it is allowed
 * to *claim* — which is where the interesting failures live. They run over the
 * whole catalog at once because the claims that matter are cross-document: a
 * slug is unique across records, a check id exists in the check suite, a bundle
 * member is actually listed, a verification covers the configuration the record
 * currently describes.
 *
 * Every rule fails closed. An unknown state, an unknown schema version or an
 * unrecognised check id is an error rather than a warning: a validator that
 * passes what it does not understand is not a gate.
 */

import { REVIEW_HOSTS, hostAllowed, repoPathProblem, urlProblem } from './urls.mjs';
import { computeConfigDigest, isConfigFile } from './digest.mjs';

/** Contract versions this validator understands. See schemas/VERSIONING.md. */
export const SUPPORTED_SCHEMA_VERSIONS = ['1.0.0'];

/** Listing states that put a product on a public surface. */
export const PUBLIC_LISTING_STATES = ['tested', 'experimental'];

const RECORD_DIR = 'catalog/projects/';
const BUNDLE_DIR = 'catalog/bundles/';
const DEPLOYMENT_DIR = 'deployments/';
const NOTES_DIR = 'notes/';

class Report {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  error(code, file, message, pointer = '') {
    this.errors.push({ code, file, pointer, message });
  }

  warn(code, file, message, pointer = '') {
    this.warnings.push({ code, file, pointer, message });
  }
}

function checkUrl(report, file, pointer, value) {
  if (value === undefined) return;
  const problem = urlProblem(value);
  if (problem) report.error('UNSAFE_URL', file, `${pointer} ${problem}`, pointer);
}

function checkPath(report, file, pointer, value, { files, prefix }) {
  if (value === undefined) return;
  const problem = repoPathProblem(value);
  if (problem) {
    report.error('UNSAFE_PATH', file, `${pointer} ${problem}`, pointer);
    return;
  }
  // The directory itself is in scope, as is anything below it.
  if (prefix && !value.startsWith(prefix) && `${value}/` !== prefix) {
    report.error('PATH_OUT_OF_SCOPE', file, `${pointer} must point at ${prefix} or inside it`, pointer);
    return;
  }
  if (!files) return;
  const asDirectory = value.endsWith('/') ? value : `${value}/`;
  const exists = files.has(value) || [...files].some((path) => path.startsWith(asDirectory));
  if (!exists) {
    report.error('MISSING_PATH', file, `${pointer} points at ${value}, which does not exist`, pointer);
  }
}

function collectConfigHashes(record, fileHashes) {
  const prefix = record.deployment?.maintained_path;
  if (!prefix) return {};
  const normalized = prefix.endsWith('/') ? prefix : `${prefix}/`;
  const result = {};
  for (const [path, hash] of Object.entries(fileHashes)) {
    // Prose is excluded here as well as in the loader: the digest must mean the
    // same thing whoever assembled the input.
    if (path.startsWith(normalized) && isConfigFile(path)) result[path] = hash;
  }
  return result;
}

/**
 * @param {object} input
 * @param {{path: string, document: object}[]} input.records catalog/projects/*.json
 * @param {{path: string, document: object}[]} input.bundles catalog/bundles/*.json
 * @param {{path: string, document: object}} input.checks checks/checks.json
 * @param {Set<string>} [input.files] every repository-relative file path that exists
 * @param {Record<string, string>} [input.fileHashes] path -> sha256, for deployment config files
 * @param {object} [options]
 * @param {string} [options.today] YYYY-MM-DD in UTC; dates after it are refused
 * @returns {{errors: object[], warnings: object[], listed: object[]}}
 */
export function validateCatalog(input, options = {}) {
  const report = new Report();
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const files = input.files ?? new Set();
  const fileHashes = input.fileHashes ?? {};

  const checkSuite = validateCheckSuite(input.checks, report);
  validateRecords(input.records ?? [], { report, today, files, fileHashes, checkSuite });

  const bySlug = new Map();
  for (const { path, document } of input.records ?? []) {
    if (document?.product?.slug && !bySlug.has(document.product.slug)) {
      bySlug.set(document.product.slug, { path, document });
    }
  }
  validateBundles(input.bundles ?? [], { report, bySlug });

  const listed = (input.records ?? [])
    .map(({ document }) => document)
    .filter((document) => PUBLIC_LISTING_STATES.includes(document?.states?.listing_state));

  return { errors: report.errors, warnings: report.warnings, listed };
}

function validateCheckSuite(entry, report) {
  const suite = new Map();
  if (!entry) {
    report.error('MISSING_CHECK_SUITE', 'checks/checks.json', 'the check suite is missing; no record can be validated without it');
    return suite;
  }
  const { path, document } = entry;
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(document.schema_version)) {
    report.error('UNSUPPORTED_SCHEMA_VERSION', path, `schema_version ${JSON.stringify(document.schema_version)} is not supported by this validator`);
  }
  if (document.data_class !== 'production') {
    report.error('FIXTURE_IN_CATALOG', path, 'the check suite must be production data');
  }
  for (const check of document.checks ?? []) {
    if (suite.has(check.check_id)) {
      report.error('DUPLICATE_CHECK_ID', path, `check id ${JSON.stringify(check.check_id)} is defined twice`);
      continue;
    }
    suite.set(check.check_id, check);
  }
  return suite;
}

function validateRecords(records, context) {
  const { report } = context;
  const seenSlugs = new Map();
  const seenReviewSlugs = new Map();

  for (const { path, document } of records) {
    validateRecord(path, document, context);

    const slug = document?.product?.slug;
    if (slug) {
      const expected = `${RECORD_DIR}${slug}.json`;
      if (path !== expected) {
        report.error('SLUG_FILENAME_MISMATCH', path, `product slug ${JSON.stringify(slug)} requires the file to be ${expected}`);
      }
      if (seenSlugs.has(slug)) {
        report.error('DUPLICATE_SLUG', path, `product slug ${JSON.stringify(slug)} is already used by ${seenSlugs.get(slug)}`);
      } else {
        seenSlugs.set(slug, path);
      }
    }

    const reviewSlug = document?.review?.review_slug;
    if (reviewSlug) {
      if (seenReviewSlugs.has(reviewSlug)) {
        report.error('DUPLICATE_REVIEW_SLUG', path, `review_slug ${JSON.stringify(reviewSlug)} is already claimed by ${seenReviewSlugs.get(reviewSlug)}`);
      } else {
        seenReviewSlugs.set(reviewSlug, path);
      }
    }
  }
}

function validateRecord(path, record, context) {
  const { report, today, files, fileHashes, checkSuite } = context;

  if (!SUPPORTED_SCHEMA_VERSIONS.includes(record.schema_version)) {
    report.error('UNSUPPORTED_SCHEMA_VERSION', path, `schema_version ${JSON.stringify(record.schema_version)} is not supported by this validator`, '/schema_version');
  }
  if (record.data_class !== 'production') {
    report.error('FIXTURE_IN_CATALOG', path, `data_class is ${JSON.stringify(record.data_class)}; catalog/ holds production records only`, '/data_class');
  }

  const upstream = record.product?.upstream ?? {};
  checkUrl(report, path, '/product/upstream/repo_url', upstream.repo_url);
  checkUrl(report, path, '/product/upstream/homepage_url', upstream.homepage_url);
  checkUrl(report, path, '/product/upstream/license_url', upstream.license_url);
  checkUrl(report, path, '/review/review_url', record.review?.review_url);
  checkUrl(report, path, '/deployment/route_url', record.deployment?.route_url);
  checkUrl(report, path, '/states/approval/approval_reference', record.states?.approval?.approval_reference);

  if (record.review?.review_url && !hostAllowed(record.review.review_url, REVIEW_HOSTS)) {
    report.error('REVIEW_URL_HOST', path, `/review/review_url must be on ${REVIEW_HOSTS.join(' or ')}`, '/review/review_url');
  }

  const deployment = record.deployment ?? {};
  const slug = record.product?.slug;
  checkPath(report, path, '/deployment/guide_path', deployment.guide_path, { files, prefix: slug ? `${DEPLOYMENT_DIR}${slug}/` : DEPLOYMENT_DIR });
  checkPath(report, path, '/deployment/maintained_path', deployment.maintained_path, { files, prefix: slug ? `${DEPLOYMENT_DIR}${slug}/` : DEPLOYMENT_DIR });
  for (const [index, notePath] of (record.notes_paths ?? []).entries()) {
    checkPath(report, path, `/notes_paths/${index}`, notePath, { files, prefix: slug ? `${NOTES_DIR}${slug}/` : NOTES_DIR });
  }

  if (deployment.template_type === 'maintained_here' && !deployment.maintained_path) {
    report.error('MAINTAINED_PATH_REQUIRED', path, 'template_type maintained_here requires /deployment/maintained_path', '/deployment/maintained_path');
  }
  if (deployment.template_type !== 'maintained_here' && deployment.maintained_path) {
    report.error('MAINTAINED_PATH_NOT_ALLOWED', path, `/deployment/maintained_path is only for template_type maintained_here, not ${JSON.stringify(deployment.template_type)}`, '/deployment/maintained_path');
  }

  validateStates(path, record, context);
  validateVerification(path, record, { report, today, checkSuite });

  const digest = computeConfigDigest(record, collectConfigHashes(record, fileHashes));
  if (record.verification && record.verification.config_digest !== digest) {
    report.error(
      'CONFIG_DIGEST_STALE',
      path,
      `the deployment configuration has changed since this verification (recorded ${record.verification.config_digest}, current ${digest}). Re-verify on the current configuration, or restore it.`,
      '/verification/config_digest',
    );
  }
  const approval = record.states?.approval;
  if (approval && approval.approved_config_digest !== digest) {
    report.error(
      'APPROVAL_DIGEST_STALE',
      path,
      `the deployment configuration has changed since approval (approved ${approval.approved_config_digest}, current ${digest}). Re-verification and a fresh approval are required.`,
      '/states/approval/approved_config_digest',
    );
  }
}

function validateStates(path, record, context) {
  const { report, today } = context;
  const states = record.states ?? {};
  const { work_state: workState, listing_state: listingState, approval, retirement } = states;
  const isPublic = PUBLIC_LISTING_STATES.includes(listingState);

  if (workState !== 'verified') {
    if (record.verification) {
      report.error('VERIFICATION_WITHOUT_VERIFIED_STATE', path, `work_state is ${JSON.stringify(workState)}; a verification block may only exist once a person has verified the deployment`, '/verification');
    }
    if (approval) {
      report.error('APPROVAL_WITHOUT_VERIFIED_STATE', path, `work_state is ${JSON.stringify(workState)}; nothing can be approved before it is verified`, '/states/approval');
    }
    if (listingState !== 'unlisted') {
      report.error('LISTED_WITHOUT_VERIFIED_WORK_STATE', path, `listing_state ${JSON.stringify(listingState)} requires work_state "verified", not ${JSON.stringify(workState)}`, '/states/listing_state');
    }
  }

  if (listingState !== 'unlisted' && !record.verification) {
    report.error('MISSING_VERIFICATION', path, `listing_state ${JSON.stringify(listingState)} requires a verification block`, '/verification');
  }

  if (isPublic && !approval) {
    report.error('LISTED_WITHOUT_APPROVAL', path, `listing_state ${JSON.stringify(listingState)} requires a recorded human approval`, '/states/approval');
  }

  if (approval) {
    if (approval.approved_at > today) {
      report.error('FUTURE_DATE', path, `approved_at ${approval.approved_at} is in the future (today is ${today})`, '/states/approval/approved_at');
    }
    const verifiedAt = record.verification?.verified_at;
    if (verifiedAt && approval.approved_at < verifiedAt) {
      report.error('APPROVAL_BEFORE_VERIFICATION', path, `approved_at ${approval.approved_at} precedes verified_at ${verifiedAt}`, '/states/approval/approved_at');
    }
  }

  if (listingState === 'retired') {
    if (!retirement) {
      report.error('RETIRED_WITHOUT_REASON', path, 'listing_state "retired" requires /states/retirement with a reason', '/states/retirement');
    } else if (retirement.retired_at > today) {
      report.error('FUTURE_DATE', path, `retired_at ${retirement.retired_at} is in the future (today is ${today})`, '/states/retirement/retired_at');
    }
    if (record.deployment?.route_url) {
      report.error('RETIRED_WITH_ROUTE', path, 'a retired product keeps its record but loses its deployment route; remove /deployment/route_url', '/deployment/route_url');
    }
  } else {
    if (retirement) {
      report.error('RETIREMENT_WITHOUT_RETIRED_STATE', path, `/states/retirement is only valid when listing_state is "retired", not ${JSON.stringify(listingState)}`, '/states/retirement');
    }
    if (isPublic && !record.deployment?.route_url) {
      report.error('ROUTE_URL_REQUIRED', path, `listing_state ${JSON.stringify(listingState)} requires /deployment/route_url`, '/deployment/route_url');
    }
  }

  if (isPublic) {
    if (record.product?.upstream?.self_hosting_permitted !== true) {
      report.error('SELF_HOSTING_NOT_PERMITTED', path, 'a product may only be listed when its upstream license permits self-hosting', '/product/upstream/self_hosting_permitted');
    }
    if ((record.product?.upstream?.license ?? 'unknown').toLowerCase() === 'unknown') {
      report.error('UNKNOWN_LICENSE', path, 'a product may only be listed once its upstream license has been established', '/product/upstream/license');
    }
    if (!record.deployment?.guide_path) {
      report.error('GUIDE_REQUIRED', path, `listing_state ${JSON.stringify(listingState)} requires /deployment/guide_path`, '/deployment/guide_path');
    }
  }
}

function validateVerification(path, record, { report, today, checkSuite }) {
  const verification = record.verification;
  if (!verification) return;

  if (verification.verified_at > today) {
    report.error('FUTURE_DATE', path, `verified_at ${verification.verified_at} is in the future (today is ${today})`, '/verification/verified_at');
  }

  const target = verification.target ?? {};
  if (!target.upstream_commit && !target.image_digest) {
    report.error('TARGET_NOT_PINNED', path, 'a verification must name the exact thing deployed: an upstream commit or an image digest. A tag alone moves.', '/verification/target');
  }

  const results = new Map();
  for (const [index, check] of (verification.checks ?? []).entries()) {
    const pointer = `/verification/checks/${index}`;
    if (!checkSuite.has(check.check_id)) {
      report.error('UNKNOWN_CHECK_ID', path, `check id ${JSON.stringify(check.check_id)} is not defined in checks/checks.json`, pointer);
      continue;
    }
    if (results.has(check.check_id)) {
      report.error('DUPLICATE_CHECK_RESULT', path, `check id ${JSON.stringify(check.check_id)} is answered more than once`, pointer);
      continue;
    }
    results.set(check.check_id, check);
    if (check.result === 'not_applicable' && !check.reason) {
      report.error('NOT_APPLICABLE_WITHOUT_REASON', path, `check ${JSON.stringify(check.check_id)} is not_applicable without a reason`, `${pointer}/reason`);
    }
    if (check.result === 'failed' && !check.reason) {
      report.warn('FAILED_WITHOUT_REASON', path, `check ${JSON.stringify(check.check_id)} failed without saying what happened`, `${pointer}/reason`);
    }
  }

  const listingState = record.states?.listing_state;
  const isPublic = PUBLIC_LISTING_STATES.includes(listingState);

  // A record that is not on a public surface may say anything true about what
  // happened, a failed deployment included: "we tried this and it did not work"
  // is worth recording. The required-check rules are about what may be listed.
  if (!isPublic) return;

  for (const [checkId, definition] of checkSuite) {
    if (!definition.required) continue;
    const answer = results.get(checkId);
    if (!answer) {
      report.error('MISSING_REQUIRED_CHECK', path, `required check ${JSON.stringify(checkId)} has no answer`, '/verification/checks');
    } else if (answer.result === 'failed') {
      report.error('REQUIRED_CHECK_FAILED', path, `required check ${JSON.stringify(checkId)} failed; a failed required check is not listable in any state, including experimental`, '/verification/checks');
    } else if (answer.result === 'not_tested') {
      report.error('REQUIRED_CHECK_NOT_TESTED', path, `required check ${JSON.stringify(checkId)} is not_tested; experimental does not waive a required check`, '/verification/checks');
    }
  }

  const namedGaps = [
    ...(verification.not_tested ?? []),
    ...[...results.values()].filter((check) => check.result === 'not_tested' || check.result === 'failed'),
  ];

  if (listingState === 'tested' && namedGaps.length > 0) {
    report.error(
      'TESTED_WITH_OPEN_GAP',
      path,
      'listing_state "tested" means nothing is left untested. An untested area or a failed optional check makes this experimental.',
      '/states/listing_state',
    );
  }
  if (listingState === 'experimental' && namedGaps.length === 0) {
    report.error(
      'EXPERIMENTAL_WITHOUT_GAP',
      path,
      'listing_state "experimental" must name what remains: an untested area in /verification/not_tested, or an optional check left not_tested. With nothing outstanding, this is "tested".',
      '/states/listing_state',
    );
  }
}

function validateBundles(bundles, { report, bySlug }) {
  const seen = new Map();
  for (const { path, document } of bundles) {
    if (!SUPPORTED_SCHEMA_VERSIONS.includes(document.schema_version)) {
      report.error('UNSUPPORTED_SCHEMA_VERSION', path, `schema_version ${JSON.stringify(document.schema_version)} is not supported by this validator`, '/schema_version');
    }
    if (document.data_class !== 'production') {
      report.error('FIXTURE_IN_CATALOG', path, `data_class is ${JSON.stringify(document.data_class)}; catalog/ holds production records only`, '/data_class');
    }

    const slug = document.bundle_slug;
    if (slug) {
      const expected = `${BUNDLE_DIR}${slug}.json`;
      if (path !== expected) {
        report.error('SLUG_FILENAME_MISMATCH', path, `bundle slug ${JSON.stringify(slug)} requires the file to be ${expected}`);
      }
      if (seen.has(slug)) {
        report.error('DUPLICATE_SLUG', path, `bundle slug ${JSON.stringify(slug)} is already used by ${seen.get(slug)}`);
      } else {
        seen.set(slug, path);
      }
    }

    const memberSlugs = new Set();
    const requiredServices = new Set();
    for (const [index, member] of (document.members ?? []).entries()) {
      const pointer = `/members/${index}/product_slug`;
      if (memberSlugs.has(member.product_slug)) {
        report.error('BUNDLE_DUPLICATE_MEMBER', path, `member ${JSON.stringify(member.product_slug)} is listed twice`, pointer);
        continue;
      }
      memberSlugs.add(member.product_slug);

      const entry = bySlug.get(member.product_slug);
      if (!entry) {
        report.error('BUNDLE_MEMBER_UNKNOWN', path, `member ${JSON.stringify(member.product_slug)} has no record in ${RECORD_DIR}`, pointer);
        continue;
      }
      if (!PUBLIC_LISTING_STATES.includes(entry.document?.states?.listing_state)) {
        report.error(
          'BUNDLE_MEMBER_NOT_LISTED',
          path,
          `member ${JSON.stringify(member.product_slug)} is ${JSON.stringify(entry.document?.states?.listing_state)}; a bundle may only reference a currently listed product`,
          pointer,
        );
        continue;
      }
      for (const service of entry.document.deployment?.dependent_services ?? []) {
        if (service.required) requiredServices.add(service.name);
      }
    }

    for (const [index, overlap] of (document.overlaps ?? []).entries()) {
      for (const [slugIndex, overlapSlug] of (overlap.product_slugs ?? []).entries()) {
        if (!memberSlugs.has(overlapSlug)) {
          report.error('BUNDLE_OVERLAP_UNKNOWN_MEMBER', path, `overlap names ${JSON.stringify(overlapSlug)}, which is not a member of this bundle`, `/overlaps/${index}/product_slugs/${slugIndex}`);
        }
      }
    }

    const declared = new Set(document.combined_dependent_services ?? []);
    for (const service of requiredServices) {
      if (!declared.has(service)) {
        report.error(
          'BUNDLE_SERVICE_MISSING',
          path,
          `a member requires ${JSON.stringify(service)}, which is missing from combined_dependent_services`,
          '/combined_dependent_services',
        );
      }
    }
  }
}
