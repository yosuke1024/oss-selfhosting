# Versioning the contract

Two version numbers, deliberately not the same thing.

| Version | Lives on | Answers |
| --- | --- | --- |
| `schema_version` | every record, bundle and check-suite document | which shape this document is written in |
| `contract_version` | [`contract.json`](contract.json) | which release of schemas + validator + required-check suite a consumer pinned |

A consumer pins a `contract_version` — that is, a commit of this repository —
and reads `schema_version` to know what it is holding.

## What `schema_version` means

It is a semantic version, and the validator refuses any value it does not
recognise. There is no forward compatibility by omission: an unknown version is
an error, never "probably fine". A validator that accepts a document it does not
understand is not a gate.

| Change | Bump |
| --- | --- |
| A new optional field | minor |
| A new value in an existing enum | **major** |
| A field becomes required, is removed, or changes type | major |
| A rule refuses something that used to validate | major |
| A rule accepts something that used to be refused, with no document change | minor |
| Wording of a description, a new test, a clearer error message | patch |

A new enum value is major on purpose. A consumer pinned to the old version has
code that branches on the values it knows; handing it a `listing_state` it has
never seen is exactly the case where the safe default — do not publish — is the
one a minor bump would skip.

## What `contract_version` means

`contract.json` names the release: the supported schema versions, the file list
with content hashes, and the entry points a consumer calls. Its version moves
when anything in that list changes, following the same table. The manifest is
generated — `node scripts/catalog.mjs contract --write` — and checked in CI, so
a schema edit that forgets the manifest fails rather than shipping a hash that
no longer matches the file.

## Changing the contract

1. Change the schema, the rules and the tests together. A rule with no test that
   fails without it has not been added.
2. Decide the bump from the table above, and say which it is in the pull
   request.
3. A major bump means every existing record must be migrated in the same change,
   because the validator will refuse them all until they are. There is no
   "supported for now" period unless `SUPPORTED_SCHEMA_VERSIONS` in
   [`../scripts/lib/rules.mjs`](../scripts/lib/rules.mjs) lists both versions —
   which is the mechanism for a staged migration, and is temporary by design.
4. Regenerate the manifest and the README index.
5. Tell the consumers. A pinned consumer is unaffected until it moves its pin;
   the migration note is what makes moving it safe.

## Adding a check

Adding a **required** check to `checks/checks.json` invalidates every existing
listing, because a required check with no answer is an error. That is the
intended behaviour — the alternative is a listing that claims a check it never
answered — so a new required check comes with the re-verification it implies,
and is a major bump. A new **optional** check is a minor bump: an unanswered
optional check caps a listing at `experimental` rather than breaking it.
