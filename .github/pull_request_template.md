<!--
Before anything else: do not record a verification you did not perform.
A check you did not run is `not_tested`. That is a valid, publishable answer.
-->

## What this changes

<!-- One or two sentences. One product, or one concern, per pull request. -->

## What I actually ran

<!--
For a listing or a verification change, state the exact version deployed
(commit, tag or image digest), the route used, and what you did not test.
For a contract or tooling change, the commands you ran and their result.
Write "not run" where something was not run. An unrun check is not a pass.
-->

- Version deployed:
- Route used (official / community / maintained here):
- Not tested:

## Checklist

- [ ] `node scripts/catalog.mjs validate` passes.
- [ ] `node scripts/catalog.mjs index --check` passes, or the index was regenerated.
- [ ] `node --test 'tests/*.test.mjs'` passes.
- [ ] No credentials, account identifiers, personal deploy URLs or private JuryPress data are in the diff.
- [ ] No review text, score or Verdict has been copied into a record.
- [ ] Any `tested` or `experimental` state has a complete verification block and a recorded human approval.
- [ ] Contract change only: `schema_version` / `contract_version` bumped per [schemas/VERSIONING.md](../schemas/VERSIONING.md), and the manifest regenerated.

## Disclosure

<!--
Any relationship with a product, project or hosting provider involved here —
employment, sponsorship, referral revenue. It does not disqualify the change;
hiding it does. Write "none" if there is none.
-->
