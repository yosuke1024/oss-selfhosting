# OSS Self-Hosting Catalog

**Human-verified self-hosting guides for open-source products. Curated by JuryPress.**

Every product listed here has been deployed by a person, on a real account, and
the result — what worked, what did not, and what was never tested — is recorded
in the open. Nothing is listed because a model said it would probably work.

> **Status — this repository is being set up.**
> Nothing is listed yet. The directory contract below is fixed; the catalog
> schema, the validator, and the generated indexes are not implemented yet.
> Until they are, treat this repository as structure only, not as a source of
> deployment advice.

## Why this exists

[JuryPress](https://pixapps.ai/) reviews open-source products and publishes a
Verdict for each one. A good review answers "is this any good?" — it does not
answer "can I run this myself, and what will it cost me in time and moving
parts?"

This repository answers the second question, and keeps the two separate on
purpose. Scores, Verdicts and review text are **not** copied here; a catalog
entry links back to its published review instead. Conversely, nothing recorded
here feeds back into how a product was reviewed or scored.

## What you can do with it

```text
Browse by use case
  → pick a product
  → read what a person actually verified (versions, checks, known gaps)
  → follow the deployment route (official template → trusted community → ours)
  → deploy it on your own hosting account, at your own cost
  → read the published JuryPress review for the quality judgement
```

The deployment target is your account, not ours. Infrastructure cost is billed
to you by your provider. This repository hosts no service and runs nothing on
your behalf.

## Browse by use case

*No products are listed yet.* This index is written by hand today and will be
generated from `catalog/projects/` once the catalog contract exists. When a
product appears here it will have the shape below — the placeholders are the
structure, not a listing:

```text
<use case>
  <product name> — Tested 2026-xx-xx · <provider> · deps: <services>
    setup:  deployments/<product-slug>/README.md
    record: catalog/projects/<product-slug>.json
    review: <published review URL, recorded on the entry>
```

A product reaches this index only after the gate in
[docs/governance.md](docs/governance.md) has been passed by a human. Draft and
AI-prepared entries are never shown here, and a `Tested` marking without a
recorded human verification is a bug — please open an issue if you find one.

## Repository layout

| Path | Responsibility | Written by |
| --- | --- | --- |
| `catalog/projects/` | One machine-readable record per product: identity, upstream repo and verified version, categories and use cases, deployment provider and route, dependent services, operating constraints, listing state, and the verification block (verifier, date, target commit or image digest, per-check results, explicitly untested items). No scores, no Verdict, no review prose. | Prepared as a draft, approved by a human |
| `catalog/bundles/` | Use-case bundles: a set of product slugs that solve one job together, with the reason for the selection, the combined service dependencies, and overlaps between members. References product slugs; never restates their records. | Human |
| `deployments/` | The deployment route material for one product per directory: the step-by-step setup guide a reader follows, and any Dockerfile or platform config this repository maintains itself. Only for products where no official or trusted community route is usable. | Prepared as a draft, approved by a human |
| `notes/` | Optional long-form observations that do not belong in a record — cost behaviour, upgrade friction, operational surprises. Always optional, never a substitute for the record, and never the place where a check result is stated. | Human |
| `checks/` | Check-suite definitions: what each check id means, which checks are required for a listing, and any optional automated smoke check. Definitions only — a check *result* belongs to the product record. | Human |
| `schemas/` | The source of truth for the catalog contract: JSON Schema, the `schema_version` policy, and the pinned distribution format other repositories consume. | Human |
| `scripts/` | The validator and index generation CLI for this repository. Runs standalone, with no credentials and no access to private data. | Human |
| `docs/` | Governance, approval rules, and the repository settings this project depends on. | Human |

The catalog contract and its validator live **here**, and here only. Consumers —
including the JuryPress site build — pin a version of this repository and read
the same contract rather than reimplementing it.

## Listing states

Work state and listing state are separate axes. Something can be fully prepared
and still not listed.

**Work state** — `draft` → `ai_prepared` → `awaiting_human_verification` →
verified. None of these are public claims about a product.

**Listing state:**

| State | Meaning |
| --- | --- |
| `tested` | A person deployed it and completed every required check. |
| `experimental` | A person deployed it and the required checks passed, but named constraints or untested areas remain. It is **not** a way around a failed required check. |
| `retired` | No longer recommended. Deployment links are removed and the reason is kept on the record. |

Check results are `passed`, `failed`, `not_tested`, or `not_applicable` with a
stated reason. "Not tested" is a normal, publishable answer; pretending a check
passed is not.

## Licensing

Code is Apache-2.0; catalog and verification records are CC BY 4.0; third-party
materials and the JuryPress brand are covered by neither. See
[LICENSING.md](LICENSING.md) for the exact boundary.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Two rules matter more than the
rest: only publicly shareable information goes in this repository, and no
verification claim is recorded for a deployment you did not run yourself.

## Related

- [JuryPress](https://pixapps.ai/) — the reviews, scores and Verdicts this catalog links to. A self-hosting section that reads from this catalog is planned; until it ships, this repository is the only entry point.
- Editorial independence: selection, scoring and Verdicts are produced by the review pipeline and are not influenced by what is self-hostable, by deployment routes, or by any referral relationship. Where an economic relationship with a hosting provider exists, it is disclosed at the point it applies.
