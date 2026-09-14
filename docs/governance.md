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

### After an approval, a configuration change needs both again

This is the case the rules above are easiest to break by accident: the record is
approved, and then someone edits it. A newer commit, a different template, an
added service, a changed `Dockerfile` — each one means the approved listing now
describes a deployment nobody performed.

So the inputs that decide what actually gets deployed are hashed into a
**deployment configuration digest**: the upstream repository and licence, the
provider, the route type and URL, the dependent services, the verified target
(commit, version, image digest, template revision), and the contents of any
non-prose file under `deployments/<slug>/`. The verification records the digest
it covers, and the approval records the digest that was signed off.

| Change | Effect |
| --- | --- |
| Any digest input changes | Both digests go stale. The validator fails the change until the deployment is **re-verified** on the current configuration and **re-approved** by the owner. |
| The prose guide or a note is edited | Nothing goes stale. Fixing a typo does not invalidate a deployment that was actually performed. |
| A required check is added to the suite | Every listing is invalid until it answers the new check. |

Re-verification means redoing the required checks on the current configuration
and writing a new `verified_at`. Re-approval means the owner looking at that
result and recording a new `approved_at` — an approval carried over from the
previous configuration is exactly what the digest exists to prevent. Approval of
one change is not approval of the next.

Recompute the digest with:

```bash
node scripts/catalog.mjs digest <product-slug>
```

## What actually enforces this

`CODEOWNERS` on its own enforces nothing. It requests a reviewer; it does not
require the review, and it does not block a merge. Treating it as the control
would leave the approval gate open.

The enforced controls are the repository ruleset and the required status
checks. Both are repository settings, not files in this branch, and they must
be configured by the owner — see
[repository-settings.md](repository-settings.md) for the exact settings and the
order to apply them in:

- protect `main` against direct pushes, force pushes and deletion,
- require a pull request, with the validation checks passing, for every change,
- once the automated preparation job has an identity of its own, require an
  approving review from a code owner and dismiss it when new commits land.

That last item depends on the one before it. GitHub does not let anyone approve
their own pull request, so on a repository with a single human an approval
requirement blocks the owner's own work — and it stops the automated job only
if that job authenticates as something other than the owner. An approval rule
imposed while the job still runs on owner-level credentials achieves the exact
inversion of its purpose: the human is blocked and the machine is not.

Until those settings exist, the approval gate is documentation only. The
project does not claim otherwise.

The validator is the second half, and it exists: `Validate catalog`
(`.github/workflows/ci.yml`) fails a pull request that marks anything `tested`
or `experimental` without a complete verification record and a recorded human
approval, that leaves a required check unanswered or failed, that carries a
verification or approval date in the future, that approves one configuration and
ships another, that duplicates a product slug, that points a link somewhere
unsafe, or that mixes test fixtures into the production catalog. The full list
is in [`../scripts/README.md`](../scripts/README.md); it runs with no
credentials and no network, so a fork's pull request gets the same answer.

Documentation states the rule; the check is what keeps it true. Add it as a
required status check on `main` — it is the check
[repository-settings.md](repository-settings.md) leaves a placeholder for.

What the validator cannot do is confirm that a deployment happened. It checks
that a claim is complete, internally consistent and approved by a person; it
cannot tell a true verification from a carefully written false one. That gap is
covered by one rule and no mechanism: do not record a verification you did not
perform.

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
