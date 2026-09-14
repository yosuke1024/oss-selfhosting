/**
 * Work state, listing state, verification and approval.
 *
 * These are the rules that decide whether this repository makes a public claim
 * about a product, so each one is tested from the direction that would publish
 * something untrue.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { asProduction, codesOf, fixture, messagesOf, refreshDigests, validateDocuments } from './helpers.mjs';

const testedRecord = async () => asProduction(await fixture('records/tested.json'));
const experimentalRecord = async () => asProduction(await fixture('records/experimental.json'));

async function expectCodes(records, expected, options) {
  const result = await validateDocuments({ records }, options);
  for (const code of expected) {
    assert.ok(codesOf(result).includes(code), `expected ${code}, got:\n${messagesOf(result)}`);
  }
  return result;
}

test('a record in preparation cannot carry a verification block', async () => {
  const record = await testedRecord();
  record.states.work_state = 'ai_prepared';
  record.states.listing_state = 'unlisted';
  delete record.states.approval;
  await expectCodes([record], ['VERIFICATION_WITHOUT_VERIFIED_STATE']);
});

test('a record in preparation cannot carry an approval', async () => {
  const record = await testedRecord();
  record.states.work_state = 'draft';
  record.states.listing_state = 'unlisted';
  delete record.verification;
  await expectCodes([record], ['APPROVAL_WITHOUT_VERIFIED_STATE']);
});

test('a machine-prepared record cannot be listed', async () => {
  const record = await testedRecord();
  record.states.work_state = 'ai_prepared';
  await expectCodes([record], ['LISTED_WITHOUT_VERIFIED_WORK_STATE']);
});

test('a listing without a human approval is refused', async () => {
  const record = await testedRecord();
  delete record.states.approval;
  await expectCodes([record], ['LISTED_WITHOUT_APPROVAL']);
});

test('a listing state without a verification block is refused', async () => {
  const record = await testedRecord();
  delete record.verification;
  await expectCodes([record], ['MISSING_VERIFICATION']);
});

test('an approval dated before the verification it approves is refused', async () => {
  const record = await testedRecord();
  record.states.approval.approved_at = '2026-09-01';
  await expectCodes([record], ['APPROVAL_BEFORE_VERIFICATION']);
});

test('a verification date in the future is refused', async () => {
  const record = await testedRecord();
  record.verification.verified_at = '2026-12-01';
  record.states.approval.approved_at = '2026-12-02';
  await expectCodes([record], ['FUTURE_DATE'], { today: '2026-09-14' });
});

test('a verification that does not pin what was deployed is refused', async () => {
  const record = await testedRecord();
  record.verification.target = { upstream_version: 'v2.4.0' };
  refreshDigests(record);
  await expectCodes([record], ['TARGET_NOT_PINNED']);
});

test('a required check left unanswered blocks a listing', async () => {
  const record = await testedRecord();
  record.verification.checks = record.verification.checks.filter((check) => check.check_id !== 'primary-flow-works');
  await expectCodes([record], ['MISSING_REQUIRED_CHECK']);
});

test('a failed required check is not listable, experimental included', async () => {
  for (const listingState of ['tested', 'experimental']) {
    const record = await experimentalRecord();
    record.states.listing_state = listingState;
    record.verification.checks = record.verification.checks.map((check) =>
      check.check_id === 'persistence-survives-restart' ? { ...check, result: 'failed', reason: 'Data was gone after a redeploy.' } : check,
    );
    await expectCodes([record], ['REQUIRED_CHECK_FAILED']);
  }
});

test('a record that is not listed may record a deployment that failed', async () => {
  // "We tried this and it did not work" is worth keeping. The required-check
  // rules decide what may be listed, not what may be written down.
  const record = await experimentalRecord();
  record.states.listing_state = 'unlisted';
  delete record.states.approval;
  record.verification.checks = record.verification.checks.map((check) =>
    check.check_id === 'primary-flow-works'
      ? { check_id: check.check_id, result: 'failed', reason: 'The editor never loaded; the API returned 500 on every save.' }
      : check,
  );
  const result = await validateDocuments({ records: [record] });
  assert.equal(result.errors.length, 0, messagesOf(result));
});

test('experimental does not waive a required check left untested', async () => {
  const record = await experimentalRecord();
  record.verification.checks = record.verification.checks.map((check) =>
    check.check_id === 'access-and-auth-understood' ? { check_id: check.check_id, result: 'not_tested' } : check,
  );
  await expectCodes([record], ['REQUIRED_CHECK_NOT_TESTED']);
});

test('not_applicable without a reason is refused', async () => {
  const record = await testedRecord();
  record.verification.checks = record.verification.checks.map((check) =>
    check.check_id === 'upgrade-path' ? { check_id: check.check_id, result: 'not_applicable' } : check,
  );
  await expectCodes([record], ['NOT_APPLICABLE_WITHOUT_REASON']);
});

test('an unknown check id is refused rather than counted', async () => {
  const record = await testedRecord();
  record.verification.checks.push({ check_id: 'looks-fine-to-me', result: 'passed' });
  await expectCodes([record], ['UNKNOWN_CHECK_ID']);
});

test('the same check answered twice is refused', async () => {
  const record = await testedRecord();
  record.verification.checks.push({ check_id: 'deploy-completes', result: 'failed', reason: 'Second answer.' });
  await expectCodes([record], ['DUPLICATE_CHECK_RESULT']);
});

test('tested means nothing is left untested', async () => {
  const record = await testedRecord();
  record.verification.not_tested = ['Behaviour under load was never exercised.'];
  await expectCodes([record], ['TESTED_WITH_OPEN_GAP']);
});

test('tested is refused while an optional check is still not_tested', async () => {
  const record = await testedRecord();
  record.verification.checks = record.verification.checks.map((check) =>
    check.check_id === 'backup-and-restore' ? { check_id: check.check_id, result: 'not_tested' } : check,
  );
  await expectCodes([record], ['TESTED_WITH_OPEN_GAP']);
});

test('experimental must name what remains outstanding', async () => {
  const record = await experimentalRecord();
  record.verification.not_tested = [];
  record.verification.checks = record.verification.checks.map((check) =>
    check.result === 'not_tested' ? { check_id: check.check_id, result: 'passed' } : check,
  );
  await expectCodes([record], ['EXPERIMENTAL_WITHOUT_GAP']);
});

test('a retired product keeps its reason and loses its deployment route', async () => {
  const record = asProduction(await fixture('records/retired.json'));
  record.deployment.route_url = 'https://railway.com/template/example-retired';
  refreshDigests(record);
  await expectCodes([record], ['RETIRED_WITH_ROUTE']);

  const withoutReason = asProduction(await fixture('records/retired.json'));
  delete withoutReason.states.retirement;
  await expectCodes([withoutReason], ['RETIRED_WITHOUT_REASON']);
});

test('a retirement block on a product that is not retired is refused', async () => {
  const record = await testedRecord();
  record.states.retirement = { retired_at: '2026-09-13', reason: 'Left over from an earlier edit.' };
  await expectCodes([record], ['RETIREMENT_WITHOUT_RETIRED_STATE']);
});

test('a listing needs a deployment route and a guide', async () => {
  const record = await testedRecord();
  delete record.deployment.route_url;
  delete record.deployment.guide_path;
  refreshDigests(record);
  await expectCodes([record], ['ROUTE_URL_REQUIRED', 'GUIDE_REQUIRED']);
});

test('a product whose licence is unknown or forbids self-hosting is not listable', async () => {
  const unknownLicence = await testedRecord();
  unknownLicence.product.upstream.license = 'unknown';
  refreshDigests(unknownLicence);
  await expectCodes([unknownLicence], ['UNKNOWN_LICENSE']);

  const forbidden = await testedRecord();
  forbidden.product.upstream.self_hosting_permitted = false;
  await expectCodes([forbidden], ['SELF_HOSTING_NOT_PERMITTED']);
});

test('changing the deployment after verification invalidates it and its approval', async () => {
  const record = await testedRecord();
  record.deployment.route_url = 'https://railway.com/template/example-tested-v2';
  const result = await expectCodes([record], ['CONFIG_DIGEST_STALE', 'APPROVAL_DIGEST_STALE']);
  assert.match(messagesOf(result), /Re-verification and a fresh approval are required/);
});

test('changing maintained deployment configuration invalidates the verification', async () => {
  const record = await experimentalRecord();
  const fileHashes = { 'deployments/example-experimental/Dockerfile': 'f'.repeat(64) };
  const result = await validateDocuments({ records: [record], fileHashes });
  assert.ok(codesOf(result).includes('CONFIG_DIGEST_STALE'), messagesOf(result));
});

test('editing the prose guide does not invalidate a verification', async () => {
  const record = await experimentalRecord();
  // The guide is Markdown, so it is deliberately outside the digest: a typo fix
  // is not a reason to redeploy something a person already verified.
  const fileHashes = {
    'deployments/example-experimental/Dockerfile': (await fixtureDockerfileHash()),
    'deployments/example-experimental/README.md': 'a'.repeat(64),
  };
  const result = await validateDocuments({ records: [record], fileHashes });
  assert.equal(result.errors.length, 0, messagesOf(result));
});

async function fixtureDockerfileHash() {
  const { FIXTURE_FILE_HASHES } = await import('./helpers.mjs');
  return FIXTURE_FILE_HASHES['deployments/example-experimental/Dockerfile'];
}
