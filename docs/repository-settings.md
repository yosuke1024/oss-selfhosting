# Repository settings

Settings that live in GitHub, not in this branch. They have to be applied by
the owner in the repository settings UI; a pull request cannot set them, and
until they are applied the approval gate in [governance.md](governance.md) is
documentation only.

## Identity

| Field | Value |
| --- | --- |
| Repository | `yosuke1024/oss-selfhosting` |
| URL | https://github.com/yosuke1024/oss-selfhosting |
| Display name | OSS Self-Hosting Catalog |
| Description | Human-verified self-hosting guides for open-source products. Curated by JuryPress. |
| Visibility | Public |
| Default branch | `main` |
| Website | `https://pixapps.ai/` — the JuryPress site. Repoint it at the self-hosting section's own URL once that section is live, so the link lands on the catalog rather than one level above it. |
| Operator | [@yosuke1024](https://github.com/yosuke1024) |

Applied: repository created, public, Apache-2.0 at the root, description,
website, topics, home-page toggles.
Not yet applied: **the ruleset**. Until it exists, `main` accepts a direct
push and the approval gate is documentation only.

## Topics

```text
self-hosted   selfhosted  self-hosting  open-source  catalog
deployment    docker      railway       homelab      jurypress
```

`self-hosted`, `selfhosted` and `self-hosting` are three distinct topics on
GitHub, all of them in real use. All three are listed on purpose.

Topics are how this repository is found on GitHub, and there is no separate
website for it. Keep them descriptive of what the repository *is*; do not add a
product's topic in order to appear in that product's searches.

## Features

| Feature | Setting | Why |
| --- | --- | --- |
| Issues | On | Per-product verification issues and correction reports. |
| Pull requests | On | The only path to `main`. |
| Wiki | Off | Documentation belongs in the repository, under review. |
| Projects | Owner's choice | Not depended on by anything here. |
| Discussions | Off initially | Revisit once there is something to discuss. |
| Forking | On | CC BY 4.0 material; forking is expected. |
| Web commit signoff | Off | No DCO process defined. |

"Include in the home page" (the checkboxes on the repository details dialog):
uncheck **Releases** and **Packages** — neither is planned, and they only add
empty sections to the About box. Leave **Deployments** unchecked; it refers to
GitHub's deployment environments, which are unrelated to this repository's
`deployments/` directory.

## Ruleset for `main`

### The constraint that shapes this

**GitHub does not let anyone approve their own pull request.** With one human
on the repository, a ruleset that requires an approving review makes every one
of that human's own pull requests permanently unmergeable. The gate has to be
built so that it blocks *automation* without blocking the only person who can
approve anything.

Bypass entries on a personal repository are granted by **role** (Repository
admin / Maintain / Write), not by naming a user. So the identity the automated
preparation job authenticates as decides whether a bypass is safe:

- A job running on a token owned by the repository owner **acts as the owner**,
  inherits the `Repository admin` role, and slips through any bypass granted to
  that role. Approval enforcement is then fiction.
- A job running as a **GitHub App installation** (or a separate bot account)
  with the `Write` role does not match a `Repository admin` bypass. The gate
  holds for the bot and lifts for the human.

Getting the automation onto its own identity is therefore a precondition for
the full gate, not a detail — it belongs with the daily-job work.

### Stage 1 — apply now

- **Restrict deletions** — on.
- **Block force pushes** — on.
- **Require a pull request before merging** — on, with:
  - required approvals: **0**
  - require conversation resolution before merging — on
- **Require status checks to pass** — on, with **require branches to be up to
  date before merging**. The required check is **`Validate catalog`**, the job
  in `.github/workflows/ci.yml`; a ruleset with an empty required-check list
  enforces nothing about content. The check name is the job's `name:`, so
  renaming the job means updating the ruleset.
- **Bypass list** — empty.

This already stops an accidental direct push to `main`, stops history
rewriting, and routes every change through a reviewable pull request. It does
**not** yet require a human approval, because with a single human and no
separate bot identity, requiring one would lock the repository against its own
owner. While this stage is in force, no automation may hold write access.

### Stage 2 — before the automated preparation job gets write access

1. Give the job its own identity: a GitHub App installation, or a bot account,
   with the **Write** role. Never a token that acts as the owner.
2. Then raise the ruleset:
   - required approvals: **1**
   - **require review from Code Owners** — on
   - **dismiss stale pull request approvals when new commits are pushed** — on
   - **Bypass list**: `Repository admin` only — the human, and nothing else.

Result: a pull request opened by the bot cannot merge without an approving
review from the owner, and the owner can still merge their own work.

The cost of that bypass entry is honest: the owner can also push directly to
`main`, so the last line of defence against a careless human push is the human.
The threat this gate exists to stop — a machine adopting an unverified record
without anyone looking — is covered.

Do not raise the ruleset to Stage 2 before step 1. An approval requirement with
the bot running on owner-level credentials is worse than Stage 1: it blocks the
owner and waves the bot through.

## Write access

Only the owner has write access today, and no automation holds a credential to
this repository yet.

When the automated preparation job is wired up it must have its own identity
with the **Write** role (see Stage 2 above), limited to: creating branches,
opening and updating draft pull requests, and creating or updating per-product
issues in **this** repository. It holds no credentials for JuryPress's private
editorial data, and it does not merge.

## Verification

Confirm after applying:

Stage 1:

- [x] Description, website and topics visible on the repository home page.
- [ ] A direct push to `main` is rejected, including for the owner.
- [ ] A pull request is required, and merges while the bypass list is empty.
- [ ] The ruleset bypass list is empty.
- [ ] `Validate catalog` is listed as a required status check, and a pull request with a failing validation cannot merge.

Stage 2 (only after the automated job has its own Write-role identity):

- [ ] A pull request cannot be merged without a code-owner approval.
- [ ] Pushing a new commit to an approved pull request dismisses the approval.
- [ ] The bot identity cannot merge its own pull request.
- [ ] The bypass list contains `Repository admin` and nothing else.
