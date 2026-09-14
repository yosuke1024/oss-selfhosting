# Consuming the contract

For a repository that needs to read this catalog — the JuryPress site build
first, anything else later.

## The rule this page exists to enforce

**Pin a version of this repository and call its validator. Do not reimplement
the rules, and do not copy the production catalog into your repository.**

A second implementation of "may this be listed?" drifts from this one. The drift
is invisible until the day the two disagree, and on that day something appears
on a public page that this repository would have refused. A copied catalog has
the same failure in slower motion: it goes stale, and stale here means
publishing a verification that has since been retired or withdrawn.

## What you pin

A commit of this repository. [`schemas/contract.json`](../schemas/contract.json)
describes what that commit contains:

| Field | Use |
| --- | --- |
| `contract_version` | The release you pinned. |
| `supported_schema_versions` | The document versions the bundled validator accepts. |
| `entry_points` | What to call. |
| `files[]` | Path and SHA-256 of every file carrying the contract — verify these after fetching. |
| `runtime` | Node.js version, and the fact that there are no dependencies, no network and no credentials. |

## How to fetch it

Check the repository out beside your own, at a pinned SHA, the same way the
existing site workflows check out the content repository:

```yaml
- name: Checkout the catalog contract
  uses: actions/checkout@<pinned-sha>
  with:
    repository: yosuke1024/oss-selfhosting
    ref: <the catalog SHA you adopted>
    path: catalog
    persist-credentials: false
```

Then point at it with an absolute path, and record the SHA alongside the app and
content SHAs already recorded for a build:

```bash
JURYPRESS_CATALOG_ROOT="${GITHUB_WORKSPACE}/catalog"
```

Adopting a new catalog SHA is a deliberate change to your repository, not a
moving reference. `main` is not a pin.

## How to use it

```js
import { validateRepository } from '<catalog root>/scripts/lib/validate.mjs';

const { errors, listed } = await validateRepository(process.env.JURYPRESS_CATALOG_ROOT);
if (errors.length > 0) {
  // Fail the build. A catalog that does not validate is not a catalog to publish from.
  throw new Error(`catalog invalid: ${errors.length} error(s)`);
}
// `listed` holds exactly the records whose listing_state is public.
```

Three things follow from that, and they are the whole integration:

1. **Build on `listed`, not on the files.** Reading `catalog/projects/*.json`
   directly and filtering by hand is the reimplementation this page is about.
2. **Fail the build when validation fails.** A broken root, a failed fetch or an
   invalid document must stop the build rather than publish a partial catalog.
   Do not fall back to a cached copy of a catalog that no longer validates.
3. **Join, do not copy.** A record carries `review.review_slug`. The score, the
   Verdict and the review text come from the review at display time. If the
   review is withdrawn or unpublished on your side, drop the listing and every
   bundle containing it — that is an ordinary state change, not an incident.

## Fixtures

Use your own fixtures, and keep them out of the production root. Every document
here carries `data_class`; a fixture says `fixture` and this validator refuses
one inside `catalog/`. Your build should refuse one too rather than rendering
it.

## What this contract does not tell you

- Whether a review is currently published. This repository records the slug and
  the URL; liveness is yours to check at build time.
- Scores, Verdicts, ranking eligibility. Those are editorial data and are never
  copied here.
- Whether a referral or template relationship applies to a route. Disclosure
  happens at the point it applies, on your surface.

## When the contract changes

A pinned consumer is unaffected until it moves its pin. Before moving it, read
[`schemas/VERSIONING.md`](../schemas/VERSIONING.md): a major `schema_version`
bump can add a state value your code does not branch on, and the safe default
for an unrecognised state is not to publish it.
