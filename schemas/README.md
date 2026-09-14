# schemas/

The source of truth for the catalog contract.

| File | What it defines |
| --- | --- |
| [`common.schema.json`](common.schema.json) | Shared primitives: slug, review slug, date, https URL, repository path, check result, work and listing states. |
| [`product-record.schema.json`](product-record.schema.json) | One record per product — `catalog/projects/<slug>.json`. |
| [`bundle.schema.json`](bundle.schema.json) | A use-case bundle — `catalog/bundles/<slug>.json`. |
| [`check-definition.schema.json`](check-definition.schema.json) | The check suite — `checks/checks.json`. |
| [`contract.json`](contract.json) | The pinned distribution manifest: contract version, supported schema versions, entry points, and a hash for every file that carries the contract. Generated; see below. |
| [`VERSIONING.md`](VERSIONING.md) | What `schema_version` and `contract_version` mean, and when each one moves. |

## The schemas are half of the contract

They describe **shape**: which fields exist, of what type, and which are
required. They deliberately do not encode the conditional rules — that a
`tested` listing needs a complete verification and a human approval, that a
required check cannot be left `not_tested`, that a retired product loses its
deployment route. Those live in
[`../scripts/lib/rules.mjs`](../scripts/lib/rules.mjs), where they can be
expressed once, tested, and reported with an error a person can act on.

So: **passing the schema is not a listing decision.** A consumer that validates
against these files alone, without running the rules, has checked spelling and
not substance. Both ship together in the pinned distribution — see
[`../docs/consuming-the-contract.md`](../docs/consuming-the-contract.md).

## `data_class`

Every document says whether it is `production` or a `fixture`. The validator
refuses a fixture inside `catalog/`, which is why test data can exist in this
repository at all without any chance of it being read as a listing.

## Regenerating the manifest

```bash
node scripts/catalog.mjs contract --write   # after changing a schema or a rule
node scripts/catalog.mjs contract --check   # what CI runs
```

## Rules

- One definition of the contract, here. A consumer that reimplements validation
  will drift, and the drift will not be noticed until something wrong is
  published.
- The production catalog is not copied into a consumer repository. Consumers
  fetch a pinned version.
- Schema changes go through the same review and approval as a listing change,
  and a change to a schema, its rules and its tests belongs in one pull request.
