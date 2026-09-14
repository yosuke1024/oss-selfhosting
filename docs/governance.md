# Governance

Who decides what gets listed, and what actually enforces it.

## Roles

| Role | Who | Authority |
| --- | --- | --- |
| Repository owner / operator | [@yosuke1024](https://github.com/yosuke1024) | Sole approver. Performs the real deployments, signs off verification records, decides listing states. |
| Implementation | Claude Code | Designs and implements schema, validator, CI, docs, and prepares draft entries. Never approves. |
| Independent review | Codex | Reads the final commit of a pull request read-only and reports findings. Never approves, never writes. |
| Automated preparation | Daily analysis job | May open branches, draft pull requests and per-product issues. Never merges, never marks anything verified. |

Nobody but the owner approves a listing. Machines prepare; a person decides.

## The gate a listing must pass

A product may be listed only when **all** of the following hold:

1. A published JuryPress review exists for it and has not been withdrawn.
2. The upstream project permits self-hosting, and the upstream license has been
   checked.
3. A recommended deployment route exists — official template, trusted community
   template, or one maintained here, in that order.
4. A person has actually deployed it and confirmed: initial setup completes,
   the product's main flow works, the public/authentication behaviour is
   understood, and any required persistence survives a restart.
5. The verification record names the verifier, the date, the exact version
   verified (commit, tag or image digest), and every required check with a
   result of `passed`, `failed`, `not_tested`, or `not_applicable` with a
   reason.

`experimental` does not waive any of items 1–5. It records that the required
checks passed while named constraints or untested areas remain. A failed
required check is not listable in any state.

A withdrawn review removes the listing. That is an ordinary state change, not
an incident, and it applies to every bundle that includes the product.

## Re-verification

A verification record is bound to the version it names. It does not roll
forward. Re-verification is required, and the date is only then updated, when:

- the upstream version being recommended changes,
- the deployment route or template changes,
- a required service dependency changes, or
- the deployment configuration maintained here changes.

Never update a verification date without redoing the verification. An old date
that is honestly old is more useful than a fresh date that is not true.

## What actually enforces this

`CODEOWNERS` on its own enforces nothing. It requests a reviewer; it does not
require the review, and it does not block a merge. Treating it as the control
would leave the approval gate open.

The enforced controls are the repository ruleset and the required status
checks. Both are repository settings, not files in this branch, and they must
be configured by the owner — see
[repository-settings.md](repository-settings.md) for the exact settings this
project depends on:

- protect `main` against direct pushes, force pushes and deletion,
- require a pull request with at least one approving review from a code owner,
- dismiss stale approvals when new commits are pushed,
- require the validation checks to pass before merge,
- apply the rules to administrators as well, so an automated job running with
  owner-level credentials cannot bypass them.

Until those settings exist, the approval gate is documentation only. The
project does not claim otherwise.

The validator (not implemented yet) is the second half: it fails a pull request
that marks anything `tested` without a complete verification record, that
carries a verification date in the future, that duplicates a product slug, that
references a product with no published review, or that mixes test fixtures into
the production catalog. Documentation states the rule; the check is what keeps
it true.

## Pull request flow

1. A change is proposed on a branch — by a person or by the automated
   preparation job, which opens its pull requests as drafts.
2. Validation runs on the pull request.
3. Codex reviews the final commit independently and reports findings; fixes go
   back to the implementer.
4. The owner reviews and approves. Approval of one change is not approval of
   the next.
5. Merge to `main`.

A draft pull request is not a claim about a product. Nothing on a branch, and
nothing in an unmerged pull request, is a listing.

## Scope of what may be stored here

This repository is public and holds only publicly shareable material: public
product information, public upstream references, deployment configuration
intended for publication, and verification results the owner has approved for
publication.

It holds no credentials, no secrets, no environment values, no private
JuryPress editorial data, no unpublished review text, and no personal data of
readers. See [../CONTRIBUTING.md](../CONTRIBUTING.md) for what that means in
practice when preparing a change.
