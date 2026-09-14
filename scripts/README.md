# scripts/

The validator and index generation CLI for this repository.

**Not implemented yet.** No commands exist here; do not document one as if it
runs.

**Scope when implemented:**

- Validate every record against [`../schemas/`](../schemas/).
- Refuse: a duplicate product slug, an unsupported `schema_version`, a
  verification date in the future, a `tested` state without a complete
  verification block, a reference to a product with no published review, a
  fixture in the production catalog, unsafe URLs, and path references that
  escape the repository.
- Generate the use-case indexes in `README.md` from `catalog/projects/`, and
  check that the committed indexes match what the records say.
- Run in CI on every pull request as a required status check.

**Rules:**

- Runs standalone: no credentials, no network to a hosting provider, no access
  to private JuryPress data. A contributor must be able to run the same check
  locally that CI runs.
- Never load Markdown, YAML or JSON from the repository as executable code.
- Fails closed. An unknown state, an unknown schema version, or an
  unrecognised field is an error, not a warning — a validator that passes what
  it does not understand is not a gate.
