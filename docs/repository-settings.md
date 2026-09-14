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
| Operator | [@yosuke1024](https://github.com/yosuke1024) |

Applied: repository created, public, Apache-2.0 at the root.
Not yet applied: description, topics, feature toggles, ruleset.

## Topics

```text
self-hosting  selfhosted  open-source  catalog
deployment    docker      railway      homelab   jurypress
```

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

## Ruleset for `main`

Create a repository ruleset targeting the default branch with:

- **Restrict deletions** — on.
- **Block force pushes** — on.
- **Require a pull request before merging** — on, with:
  - required approvals: **1**
  - **dismiss stale pull request approvals when new commits are pushed** — on
  - **require review from Code Owners** — on
  - require conversation resolution before merging — on
- **Require status checks to pass** — on, with **require branches to be up to
  date before merging**. Add the validation check as a required check once it
  exists; a ruleset with an empty required-check list enforces nothing about
  content.
- **Bypass list** — empty. In particular, do not add the owner or any
  automation as a bypass actor: the automated preparation job runs with
  owner-level credentials, and a bypass entry would let a prepared change reach
  `main` without the human approval the whole gate exists to require.

Rulesets apply to administrators by default when the bypass list is empty.
Verify that after creating it, since an owner pushing directly to `main` is the
most likely way for the gate to be bypassed by accident.

## Write access

Only the owner has write access. The automated preparation job is limited to:
creating branches, opening and updating draft pull requests, and creating or
updating per-product issues in **this** repository. It holds no credentials for
JuryPress's private editorial data, and it does not merge.

## Verification

Confirm after applying:

- [ ] Description and topics visible on the repository home page.
- [ ] A direct push to `main` is rejected, including for the owner.
- [ ] A pull request cannot be merged without a code-owner approval.
- [ ] Pushing a new commit to an approved pull request dismisses the approval.
- [ ] The ruleset bypass list is empty.
