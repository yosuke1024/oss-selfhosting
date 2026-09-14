/**
 * The refusals that protect the published surface: unsafe links, paths that
 * leave the repository, test data reaching the catalog, and documents that try
 * to be more than data.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { parseJson } from '../scripts/lib/json.mjs';
import { asProduction, codesOf, fixture, messagesOf, refreshDigests, validateDocuments } from './helpers.mjs';

const record = async () => asProduction(await fixture('records/tested.json'));

test('a fixture is refused inside the catalog', async () => {
  const asFixture = await fixture('records/tested.json');
  const result = await validateDocuments({ records: [asFixture] });
  assert.ok(codesOf(result).includes('FIXTURE_IN_CATALOG'), messagesOf(result));
});

test('a fixture bundle is refused inside the catalog', async () => {
  const bundle = await fixture('bundles/bundle.json');
  const records = [asProduction(await fixture('records/tested.json')), asProduction(await fixture('records/experimental.json'))];
  const result = await validateDocuments({ records, bundles: [bundle] });
  assert.ok(codesOf(result).includes('FIXTURE_IN_CATALOG'), messagesOf(result));
});

test('every fixture on disk says it is a fixture', async () => {
  for (const name of ['records/tested.json', 'records/experimental.json', 'records/retired.json', 'records/draft.json', 'bundles/bundle.json']) {
    const document = await fixture(name);
    assert.equal(document.data_class, 'fixture', `${name} must be marked as a fixture`);
  }
});

test('a non-https or otherwise unsafe URL is refused', async () => {
  const cases = [
    'http://example.com/x',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'https://user:secret@example.com/x',
    'https://127.0.0.1/x',
    'https://localhost/x',
    'https://deploy.internal/x',
  ];
  for (const route of cases) {
    const document = await record();
    document.deployment.route_url = route;
    refreshDigests(document);
    const result = await validateDocuments({ records: [document] });
    assert.ok(
      codesOf(result).some((code) => ['UNSAFE_URL', 'SCHEMA_INVALID'].includes(code)),
      `${route} should have been refused, got:\n${messagesOf(result)}`,
    );
  }
});

test('a review URL must point at the review site', async () => {
  const document = await record();
  document.review.review_url = 'https://example.com/reviews/example-org-example-tested-a1b2c3/';
  const result = await validateDocuments({ records: [document] });
  assert.ok(codesOf(result).includes('REVIEW_URL_HOST'), messagesOf(result));
});

test('a path that escapes the repository is refused', async () => {
  const document = await record();
  document.deployment.guide_path = 'deployments/example-tested/../../../etc/passwd';
  refreshDigests(document);
  const result = await validateDocuments({ records: [document] });
  assert.ok(
    codesOf(result).some((code) => ['UNSAFE_PATH', 'SCHEMA_INVALID'].includes(code)),
    messagesOf(result),
  );
});

test('a path pointing outside the directory the field allows is refused', async () => {
  const document = await record();
  document.deployment.guide_path = 'deployments/example-experimental/README.md';
  refreshDigests(document);
  const result = await validateDocuments({ records: [document] });
  assert.ok(codesOf(result).includes('PATH_OUT_OF_SCOPE'), messagesOf(result));
});

test('a path that does not exist is refused', async () => {
  const document = await record();
  document.deployment.guide_path = 'deployments/example-tested/MISSING.md';
  refreshDigests(document);
  const result = await validateDocuments({ records: [document] });
  assert.ok(codesOf(result).includes('MISSING_PATH'), messagesOf(result));
});

test('maintained configuration is only for a route this repository maintains', async () => {
  const official = await record();
  official.deployment.maintained_path = 'deployments/example-tested';
  refreshDigests(official);
  const first = await validateDocuments({ records: [official] });
  assert.ok(codesOf(first).includes('MAINTAINED_PATH_NOT_ALLOWED'), messagesOf(first));

  const maintained = asProduction(await fixture('records/experimental.json'));
  delete maintained.deployment.maintained_path;
  refreshDigests(maintained);
  const second = await validateDocuments({ records: [maintained] });
  assert.ok(codesOf(second).includes('MAINTAINED_PATH_REQUIRED'), messagesOf(second));
});

test('a document is parsed as data, never as something that can touch a prototype', () => {
  assert.throws(
    () => parseJson('{"product": {"__proto__": {"polluted": true}}}', 'x.json'),
    /forbidden key/,
  );
  assert.equal({}.polluted, undefined);
});

test('two records cannot claim the same slug or the same review', async () => {
  const first = await record();
  const second = await record();
  second.product.name = 'A second record for the same product';
  const result = await validateDocuments({ records: [first, second] });
  assert.ok(codesOf(result).includes('DUPLICATE_SLUG'), messagesOf(result));
  assert.ok(codesOf(result).includes('DUPLICATE_REVIEW_SLUG'), messagesOf(result));
});

test('a record stored under the wrong file name is refused', async () => {
  const document = await record();
  const result = await validateDocuments({
    records: [document],
    entryFor: (doc) => ({ path: 'catalog/projects/something-else.json', document: doc }),
  });
  assert.ok(codesOf(result).includes('SLUG_FILENAME_MISMATCH'), messagesOf(result));
});
