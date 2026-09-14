# schemas/

The source of truth for the catalog contract.

**Not implemented yet.** The directory contract is fixed; the schemas are not
written. Nothing consumes this directory today.

**Scope when implemented:**

- JSON Schema for the product record, the bundle, and the check definition.
- The `schema_version` policy: what a version bump means, which changes are
  breaking, and how a consumer pinned to an older version behaves.
- The `data_class` distinction between production data and test fixtures, so a
  fixture can never be mistaken for a listing.
- A pinned distribution format other repositories consume — including the
  JuryPress site build, which pins a version of this repository and reads this
  contract.

**Rules:**

- One definition of the contract, here. A consumer that reimplements validation
  will drift, and the drift will not be noticed until something wrong is
  published.
- The production catalog is not copied into a consumer repository. Consumers
  fetch a pinned version.
- Schema changes go through the same review and approval as a listing change.
