/**
 * The generated index. What is on the front page has to be what the records
 * say, and nothing in preparation may appear there.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { END_MARKER, START_MARKER, applyIndex, renderIndex } from '../scripts/lib/index-render.mjs';
import { REPO_ROOT, asProduction, fixture } from './helpers.mjs';

async function allRecords() {
  return Promise.all(
    ['tested.json', 'experimental.json', 'retired.json', 'draft.json'].map(async (name) =>
      asProduction(await fixture(`records/${name}`)),
    ),
  );
}

test('only listed products reach the index', async () => {
  const index = renderIndex(await allRecords());
  assert.match(index, /Example Tested Product/);
  assert.match(index, /Example Experimental Product/);
  assert.doesNotMatch(index, /Example Retired Product/);
  assert.doesNotMatch(index, /Example Draft Product/);
});

test('a machine-prepared record never appears, whatever else it claims', async () => {
  const records = await allRecords();
  const draft = records.find((r) => r.product.slug === 'example-draft');
  draft.states.work_state = 'ai_prepared';
  assert.doesNotMatch(renderIndex(records), /Example Draft Product/);
});

test('the index states what a reader is committing to', async () => {
  const index = renderIndex(await allRecords());
  assert.match(index, /on your own account, at your own cost/);
  assert.match(index, /published JuryPress review/);
});

test('the index carries the verification date and required services', async () => {
  const index = renderIndex(await allRecords());
  assert.match(index, /Tested 2026-09-11/);
  assert.match(index, /Experimental 2026-09-12/);
  assert.match(index, /requires: PostgreSQL/);
});

test('an empty catalog says so instead of implying a listing', () => {
  const index = renderIndex([]);
  assert.match(index, /No products are listed yet/);
});

test('the README carries the markers the generator writes between', async () => {
  const readme = await readFile(join(REPO_ROOT, 'README.md'), 'utf8');
  assert.ok(readme.includes(START_MARKER), 'README.md is missing the index start marker');
  assert.ok(readme.includes(END_MARKER), 'README.md is missing the index end marker');
});

test('regenerating the index is stable', async () => {
  const readme = await readFile(join(REPO_ROOT, 'README.md'), 'utf8');
  const body = renderIndex(await allRecords());
  const once = applyIndex(readme, body);
  assert.equal(applyIndex(once, body), once);
});

test('a README without the markers is an error, not a silent no-op', () => {
  assert.throws(() => applyIndex('# A README with no markers\n', 'body'), /missing the/);
});
