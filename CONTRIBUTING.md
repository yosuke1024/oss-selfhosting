# Contributing

Thank you for considering a contribution. Before anything else, the one rule
this repository exists to protect:

> **Do not record a verification you did not perform.**
> A check you did not run is `not_tested`. That is a valid, publishable answer.
> A guess written as a result is worse than no entry at all.

## What is useful

- **Corrections.** A broken step, a stale version, a dependency that is no
  longer required, a link to a product that changed its licence. Corrections
  are reviewed before new listings.
- **Verification results.** You deployed something listed here and got a
  different result. Say which version, which route, and what happened.
- **Deployment guide improvements** for a product already listed.
- **Product suggestions** — via an issue, not a pull request. A product cannot
  be listed before it has a published JuryPress review, so a suggestion starts
  a review conversation rather than a catalog entry.

## What will not be merged

- A listing for a product with no published JuryPress review.
- Anything marked `tested` without a complete verification record — verifier,
  date, exact version, and every required check answered.
- Review text, scores or Verdicts copied into a catalog entry. Link to the
  review instead; see [LICENSING.md](LICENSING.md).
- A re-hosted copy of an upstream deployment template where the official or a
  trusted community route already works.
- A bumped verification date without a redone verification.
- Test fixtures inside `catalog/`.

## Never commit

This repository is public and its history is permanent.

- No credentials, API keys, tokens, connection strings or environment values —
  not even expired or example-looking ones. Use a placeholder such as
  `<your-api-key>`.
- No private JuryPress data: unpublished review text, generation records,
  internal planning material.
- No personal data, and no screenshots containing account identifiers, billing
  information or session state.
- No hosting-provider account identifiers, project ids or deploy URLs specific
  to a personal account.

If a secret does reach a commit, treat it as compromised: rotate it first, then
fix the repository.

## Where a change goes

See the layout table in the [README](README.md). In short: machine-readable
product records in `catalog/projects/`, the setup guide a reader follows in
`deployments/<product-slug>/`, check *definitions* in `checks/`, optional
long-form observations in `notes/`. A check *result* always lives on the
product record, never in a note.

## Pull requests

1. Branch from `main` and keep the change small — one product, or one concern.
2. Say in the description what you actually ran, on what version, and what you
   did not test.
3. Run the checks locally before pushing — they are the same ones CI runs:

   ```bash
   node scripts/catalog.mjs validate       # records, bundles, check definitions
   node scripts/catalog.mjs index --check  # the README index matches the records
   node --test 'tests/*.test.mjs'          # the contract's own tests
   ```

   Node.js 22 or newer, no install step, no credentials, no network.
4. Validation runs on the pull request; fix anything it flags.
5. The repository owner reviews and approves. Approval is a person's decision
   and is required for every listing change — see
   [docs/governance.md](docs/governance.md).

Drafts are welcome, and a draft pull request makes no claim about a product.

## Disclosure

If you have a relationship with a product, project or hosting provider
involved in your change — employment, sponsorship, referral revenue, anything
that a reader would want to know — say so in the pull request. It does not
disqualify the contribution; hiding it does.
