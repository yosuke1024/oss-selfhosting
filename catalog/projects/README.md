# catalog/projects/

One record per product. This is the machine-readable source of truth for what
is listed, in what state, and on what evidence.

**Layout:** `catalog/projects/<product-slug>.json` — one file, one product, the
slug unique across the repository and stable for the life of the listing. A
renamed product keeps its slug; a slug is never reused for a different product.

**The record holds:**

- `schema_version` and `data_class` — the contract version, and whether this is
  production data or a test fixture. Fixtures never live in this directory.
- Identity: product slug, display name, upstream repository, and the exact
  version the listing refers to.
- The JuryPress `review_slug` and the published review URL.
- Categories, use cases and search terms — how a reader finds it.
- Deployment provider, route type (official / community / maintained here) and
  the route URL.
- Dependent services, operating constraints, and anything a reader must supply
  themselves.
- Work state and listing state, kept as separate fields.
- The verification block: verifier, verification date, the exact commit, tag or
  image digest verified, per-check results, and explicitly untested items.

**The record does not hold:** scores, Verdicts, jury comments, review prose, or
any editorial judgement. Those stay in the published review and are referenced
by `review_slug`. Copying them here would fork the editorial source of truth
and would breach the licence boundary in [`LICENSING.md`](../../LICENSING.md).

**Rules:**

- No record is marked `tested` without a complete verification block.
- A verification date is only moved by redoing the verification.
- A verified version is never silently upgraded; change the version, redo the
  verification, or drop to `experimental` with the gap stated.
- Fields are the ones the schema defines. Inventing a field to carry a claim
  the contract has no room for means the contract needs changing first.

The schema and validator that enforce all of this live in
[`../../schemas/`](../../schemas/) and [`../../scripts/`](../../scripts/), and
are not implemented yet.
