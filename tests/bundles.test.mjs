/**
 * Bundles reference listed products. They never restate a member's record, and
 * they follow a member out of the catalog rather than outliving it.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { asProduction, codesOf, fixture, messagesOf, validateDocuments } from './helpers.mjs';

async function scenario(mutate = () => {}) {
  const records = [
    asProduction(await fixture('records/tested.json')),
    asProduction(await fixture('records/experimental.json')),
    asProduction(await fixture('records/retired.json')),
  ];
  const bundle = asProduction(await fixture('bundles/bundle.json'));
  mutate({ records, bundle });
  return validateDocuments({ records, bundles: [bundle] });
}

test('a bundle of listed products validates', async () => {
  const result = await scenario();
  assert.equal(result.errors.length, 0, messagesOf(result));
});

test('a bundle cannot reference a product with no record', async () => {
  const result = await scenario(({ bundle }) => {
    bundle.members[1].product_slug = 'never-heard-of-it';
  });
  assert.ok(codesOf(result).includes('BUNDLE_MEMBER_UNKNOWN'), messagesOf(result));
});

test('a bundle follows a member that is retired or unlisted', async () => {
  const retiredMember = await scenario(({ bundle }) => {
    bundle.members[1].product_slug = 'example-retired';
  });
  assert.ok(codesOf(retiredMember).includes('BUNDLE_MEMBER_NOT_LISTED'), messagesOf(retiredMember));

  const unlistedMember = await scenario(({ records }) => {
    const member = records.find((r) => r.product.slug === 'example-experimental');
    member.states.listing_state = 'unlisted';
    delete member.states.approval;
  });
  assert.ok(codesOf(unlistedMember).includes('BUNDLE_MEMBER_NOT_LISTED'), messagesOf(unlistedMember));
});

test('a bundle must declare every service its members require', async () => {
  const result = await scenario(({ bundle }) => {
    bundle.combined_dependent_services = [];
  });
  assert.ok(codesOf(result).includes('BUNDLE_SERVICE_MISSING'), messagesOf(result));
});

test('a bundle cannot list the same member twice', async () => {
  const result = await scenario(({ bundle }) => {
    bundle.members[1].product_slug = 'example-tested';
  });
  assert.ok(codesOf(result).includes('BUNDLE_DUPLICATE_MEMBER'), messagesOf(result));
});

test('an overlap can only name members of the bundle', async () => {
  const result = await scenario(({ bundle }) => {
    bundle.overlaps[0].product_slugs = ['example-tested', 'example-retired'];
  });
  assert.ok(codesOf(result).includes('BUNDLE_OVERLAP_UNKNOWN_MEMBER'), messagesOf(result));
});

test('a bundle cannot carry a copy of a member record', async () => {
  const result = await scenario(({ bundle }) => {
    bundle.members[0].verification = { verifier: 'someone', verified_at: '2026-09-11' };
  });
  assert.deepEqual(codesOf(result), ['SCHEMA_INVALID'], messagesOf(result));
});
