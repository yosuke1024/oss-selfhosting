# Talivia — Railway first apply: what it established, and what it did not

**Date:** 2026-10-10 · **Stage:** P04 extension → P09 input (first apply by the maintainer; human checks pending) · **Author:** Claude Code

A dated snapshot, and the third in a sequence with
[`2026-09-14-railway-route-research.md`](2026-09-14-railway-route-research.md)
and [`2026-09-14-railway-iac-research.md`](2026-09-14-railway-iac-research.md).
Those two were written before anything ran. This one records what happened the
first time `deployments/talivia/.railway/railway.ts` was applied, by the
maintainer, on the maintainer's own Railway account, on 2026-10-10.

The commands below were run by the maintainer. This note was written from their
output and from the API queries they made, and it re-runs none of them.

**The service came up healthy. No person has performed the checks in
[`checks/checks.json`](../../checks/checks.json).** Nobody has signed in,
changed the bootstrap password, created a website, sent an event or restarted
the service to look for data. **No verification block was added to the product
record and nothing is marked tested.** In line with
[`notes/README.md`](../README.md), this note states no check result: results
live on the record, and the record has none.

Two kinds of statement are kept apart throughout. *Observed by the maintainer*
means a command or log said so on 2026-10-10. *Verified by a person* is what the
catalog's verification record requires, and it has not happened.

Account-specific identifiers — the project, environment, service and deployment
ids, and the maintainer's deploy URL — are deliberately not recorded, per
[`CONTRIBUTING.md`](../../CONTRIBUTING.md). Placeholders stand in for them. The
upstream commit and the built image's digest identify the artifact, not the
account, and are recorded.

---

## 1. What was run

### 1.1 Environment

| | |
| --- | --- |
| Railway CLI | 5.55.0 (the 2026-09-14 note was authored against 5.54.1) |
| IaC SDK | npm `railway` 3.11.0 |
| Project / environment | `talivia` / `production`, an existing project already named `talivia` |
| Plan, region | Railway Hobby plan; region `sfo`; one replica |

### 1.2 In order

| # | Command | What was observed |
| --- | --- | --- |
| 1 | `railway config plan --file deployments/talivia/.railway/railway.ts` | `2 to add, 0 to change, 0 to destroy`: create database `postgres`, create service `talivia`. The project was already named `talivia`, so no rename. |
| 2 | `railway config plan --out …`, then `railway config apply --plan …` | Failed — see §1.3. Not used. |
| 3 | `railway config apply --file deployments/talivia/.railway/railway.ts --yes` | `Changes (3)`: the service, `variables/PORT`, `variables/DATABASE_URL`. `APP_SECRET` untouched (`preserve()`). The managed PostgreSQL service was created and reached Online. |
| 4 | `openssl rand -hex 32 \| railway variable set APP_SECRET --stdin --service talivia --skip-deploys` | Run about two minutes after the apply, while the first build was still running. See §5. |
| 5 | (first build, then first boot) | Deployment status SUCCESS, so the health check passed. See §1.4. |
| 6 | `railway domain --port 3000 --service talivia --json` | A generated address of the shape `https://<service>-<environment>.up.railway.app`. |
| 7 | `node deployments/talivia/smoke.mjs https://<deployment>` | Four result lines, all `PASS`. See §1.5. |
| 8 | `railway templates create --project talivia --environment production` | Refused. See §6. |
| 9 | `railway config plan --file deployments/talivia/.railway/railway.ts`, after `commitSha` and `build` were dropped from the file | `✓ Your Railway configuration is already up to date.` — no changes between the trimmed file and the live project. |
| 10 | (the owner, in the browser) | Signed in with the bootstrap credentials, changed the password under **Settings → Account** (`/app/settings/account`), signed out, and confirmed the old password is refused and the new one accepted. See §8. |

The PostgreSQL service that step 3 created runs
`ghcr.io/railwayapp-templates/postgres-ssl:18` with a 4.9 GB volume mounted at
`/var/lib/postgresql/data`.

### 1.3 The pinned-plan pattern does not work with this layout

The safer pattern in Railway's CLI is to write a plan artifact and apply that
artifact, so what is applied is exactly what was reviewed. `plan --out` assumes
a repository-root `.railway/` directory: its `--source-tree` option defaults to
`git rev-parse HEAD:.railway`. Passing the right tree explicitly writes the
artifact:

```bash
railway config plan --file deployments/talivia/.railway/railway.ts \
  --out <artifact> \
  --source-tree "$(git rev-parse HEAD:deployments/talivia/.railway)"
```

but `railway config apply --plan <artifact>` has no `--source-tree` flag, and
fails:

```text
Could not pin .railway/: … is not a directory and git has no HEAD:.railway tree
```

**Conclusion:** with the authoring file under `deployments/talivia/` rather than
at the repository root, the pinned-plan apply is unavailable and
`railway config apply --file …` is the only path. That is a consequence of the
file's location, which `--file` makes possible (2026-09-14 IaC note, §2).
Observed with CLI 5.55.0; whether a later CLI adds the flag is not known.

### 1.4 First boot

Condensed from the runtime logs of the first deployment. This is a sequence, not
a verbatim excerpt.

| Order | What the logs reported |
| --- | --- |
| 1 | `start-docker` began; `check-env` passed |
| 2 | `check-db`: "✓ Database connection successful" and "✓ Database version check successful" |
| 3 | Three migrations applied: `0001_oss_baseline`, `20260911173000_backfill_visitor_first_session`, `20260924181000_oss_installation_identity` |
| 4 | `node server.js`: Next.js 16.2.6, Ready, network `http://0.0.0.0:3000` |
| 5 | A cron scheduler started: `provider-webhook-cleanup`, every minute |

`DATABASE_URL` resolved to `postgres.railway.internal:5432`, database `railway`,
schema `public`, over the private network, **with no `sslmode` parameter**. The
connection succeeded.

The third migration is dated 2026-09-24, which is later than the commit the
guide was first written against (`2d3ec33…`, 2026-09-13). The database schema
is therefore at the level of the commit that was actually built, not the commit
the 2026-09-14 notes read.

### 1.5 Smoke check

The maintainer's own run of `deployments/talivia/smoke.mjs` against their own
deployment (abridged to the result lines):

```text
PASS  health endpoint responds — version "local"
PASS  / redirects to /login — 307 to /login
PASS  tracker script is served with open CORS — 9547 bytes, CORS open
PASS  API requires authentication — 401 signed out
```

The responses also carried `server: railway-hikari` and an `x-railway-edge`
header naming the edge location that served the request. Neither says anything
about `x-forwarded-host`, so they do not answer the forwarded-host question
(§2, O-3).

**This is script output about one deployment. It is not a result of the
`automated-smoke-check` check, which would live in a verification block that
does not exist, and it is not a verification** — the script cannot sign in,
cannot confirm a password change, cannot send an event and cannot observe
persistence.

---

## 2. Findings against the open items

Two earlier notes number their open items. The ids below are the ones carried
into the IaC note's §7: **O-1, O-3, O-4** come from the route research's §6, and
**O-5 … O-8** are the IaC note's own. The route research also has an **O-5**
("Upstream has no tagged release") that shares the number and is a different
item; it is unchanged — upstream still has none — and is not in this table.

| id | Question | Verdict | Evidence |
| --- | --- | --- | --- |
| O-1 | Does the standalone server honour `PORT`? | **Not answered, and moot.** | With `PORT=3000` set, the server listened on `0.0.0.0:3000` and the health check passed. If the server honours an injected `PORT`, it bound 3000; if it ignores it, it bound 3000. The configuration was built so both answers look identical, and they do. |
| O-2 | Who publishes the Railway template? | Closed 2026-09-14. Unchanged. | Route research §2. |
| O-3 | Does Railway's edge set `x-forwarded-host` to the public domain? | **Still open.** | Observable only from the payment-provider webhook URL in the signed-in UI (**Website settings → Payments**). The maintainer did not sign in. See §9, O-9. |
| O-4 | Does `DATABASE_URL` over the private network need an `sslmode` parameter? | **Answered: no.** | Connected to `postgres-ssl:18` at `postgres.railway.internal:5432` with no `sslmode`. Scope: the private network, this image, this one boot. |
| O-5 | Does `preserve()` on a never-set `APP_SECRET` leave it unset, so the first deploy fails `check-env.js`? | **Half answered, and the guide was wrong.** | The apply did not create `APP_SECRET` (it is not among the three changes), so the operator must set it. But whether the first boot *fails* is a matter of timing, not of `preserve()`: set while the first build ran, it was present at first boot. See §5. |
| O-6 | Does Talivia run correctly on PostgreSQL 18, which upstream does not test? | **Answered for boot and migration only.** | The version check passed and three migrations applied. One boot of an empty database. Nothing about behaviour under use or load. |
| O-7 | Does Railway honour `source.commitSha` on apply? | **Answered: no.** | See §3. |
| O-8 | Does `project("talivia", …)` rename a linked project that has a different name? | **Not answered.** | The project was already named `talivia`, so no rename was proposed. The differing-name case was not tried. |

---

## 3. The commit decision

### 3.1 What was declared, and what was built

| | |
| --- | --- |
| Declared in the file | `commitSha` `2d3ec339072723f4c7f0335e513aaadae3a31603` |
| Built by the first deployment | `a9bdc511b30067ddde72d48db30c69ee71289e80`, branch `main` |
| That commit | "fix(app): replace em dashes with en dashes", committed 2026-09-26, author `taliviagroup` |
| Upstream `main` on 2026-10-10 | `a9bdc51` — four commits ahead of `2d3ec33`, touching 44 files, four of them migration-related |

Railway ignored `source.commitSha` and deployed the head of the branch at the
moment of the apply. The 2026-09-14 IaC note (§4.1) called this "the single most
important thing to read in the first `plan` output". It was not readable there:

- In `plan --json`, `stagedPatch` is `null` and the change-set details are
  `null` at plan time. The plan cannot show whether `commitSha` is honoured, or
  which commit will be built. The question was only answerable by applying.

### 3.2 What Railway's API allows

From Railway's public API:

- `ServiceSourceInput` has two fields, `repo` and `image`. **There is no commit
  on a service source,** so nothing that sets a service's source can pin one.
  The SDK type that carries `commitSha` is wider than what the backend accepts.
- A specific commit can be deployed **per deployment**, not per service: through
  the mutation `serviceInstanceDeployV2(serviceId, environmentId, commitSha)`, or
  from the dashboard. Neither was exercised on 2026-10-10.

### 3.3 The decision

The owner chose to make **the commit that was actually deployed the verification
target**, and to stop pretending the file pins one:

- The verification target becomes `a9bdc511b30067ddde72d48db30c69ee71289e80`,
  read from the deployment, not `2d3ec33…`.
- The file drops `commitSha`. As of this writing its header says that Railway
  deploys the head of the branch at apply time, that a commit written in the
  file is ignored, and that the commit is read afterwards with
  `railway deployment list --service talivia --json` → `meta.commitHash`.
- The guide and the product record say so plainly: a reader who applies the file
  later gets whatever `main` is then, and their verification names the commit
  their deployment reports.

Editing `railway.ts` changes its configuration digest. No verification block
exists, so nothing was invalidated by the change.

### 3.4 What this costs

The IaC note (§4.1) said pinning by commit was "the whole reason the route was
chosen over the community template", and the route research (§2, Route B) said
the route "pins exactly to the commit the verification record will name". Neither
sentence holds for the *configuration* any more. This note supersedes them on
that point; the earlier notes are not edited, per `notes/README.md`.

What the route still has, by the earlier notes' own evidence: the source is
upstream's repository rather than a third party's image, the build log shows
upstream's Dockerfile building, and the artifact can be named *after the fact* by
commit and by image digest. The rejected template deployed a mutable `latest`
tag with no source link, so nothing about it could be tied to an upstream
commit. That is an argument that the route is still the better one. It is not an argument that the
configuration pins anything, and it does not restore the property that a later
apply reproduces the verified build.

Two consequences follow from tracking the branch:

- The guide's reading of upstream was made at `2d3ec33…`, not `a9bdc51`. Where
  it describes the bootstrap account, the **Settings → Account** path and the
  baseline migration, those statements are not recorded as re-read at the
  deployed commit. See §9, O-12.
- A rebuild can pick up a newer head, and because migrations run at start that is
  a schema change. Whether a redeploy, or a variable change, rebuilds from the
  current head or reuses the commit already built was not observed. See §9, O-11.

---

## 4. Builder and artifact identity

### 4.1 Railway detects the Dockerfile; the file does not select it

The deployment manifest first reported the builder as `RAILPACK` while the build
was running, and the final manifest shows `DOCKERFILE` with `dockerfilePath`
`/Dockerfile`. Railway auto-detected upstream's Dockerfile at the repository
root. The build log shows upstream's multi-stage Dockerfile — `deps`, `builder`,
`runner` — running `pnpm install --frozen-lockfile` and `npm run build-docker`,
which ran a Next.js 16.2.6 webpack build.

Railway's `Builder` enum is `HEROKU | NIXPACKS | PAKETO | RAILPACK`. **There is
no `DOCKERFILE` value.** The file's `build: { builder: "DOCKERFILE" }` compiled
(the 2026-09-14 note's §6 shows it in the compiled graph) but names a value the
API does not have, so it was not what selected the Dockerfile. It has been
removed from the file, and the guide now says detection is the mechanism and the
field is not.

### 4.2 The deployment manifest, as observed

| Field | Value | Set by the file? |
| --- | --- | --- |
| `healthcheckPath` | `/api/heartbeat` | Yes |
| `healthcheckTimeout` | `300` | Yes |
| `restartPolicyType` / `maxRetries` | `ON_FAILURE` / `10` | No — Railway's defaults |
| `numReplicas` | `1`, in `sfo` | No |

The health check path and timeout the file declares are the ones in the manifest.

### 4.3 The running application cannot name its own build

`.build-version` was written as `local`, because Railway does not supply the
Dockerfile's `BUILD_VERSION` build argument. So:

```json
{"ok":true,"version":"local"}
```

is what `/api/heartbeat` returns, and it cannot pin the artifact. What does is on
the deployment record:

| | |
| --- | --- |
| `meta.commitHash` | `a9bdc511b30067ddde72d48db30c69ee71289e80` |
| `meta.imageDigest` | `sha256:cc02150b30ec4fbe9bafdcd50e30608ff7cba550241f0723697465a0d6bf95ab` |

A verification should record both, from the same deployment, and say which
deployment that was.

---

## 5. Secret handling, as observed

- The command in §1.2 step 4 reads the value from `openssl rand -hex 32` through
  a pipe and `--stdin`, so it never appeared on a command line or in shell
  history. The value was not printed, is not in this repository, and is not in
  this note. Whether the maintainer has since sealed it in the dashboard is not
  recorded here.
- The file still declares `APP_SECRET` as `preserve()`; the apply's three changes
  did not include it, and no plan or apply from this repository can set or print
  it.
- `scripts/check-env.js` at `a9bdc51` still requires `APP_SECRET` of at least 32
  bytes and exits 1 otherwise. `openssl rand -hex 32` yields 64 hex characters.

**The timing.** About two minutes after the apply, with the first build still
running, the maintainer set `APP_SECRET` with `--skip-deploys`. The container
started afterwards and `check-env` passed. The conclusion is that **Railway reads
variables when the container starts, not when the deployment is created.** Builds
take about three to four minutes.

This corrects the guide. It said to expect the first deployment to fail its boot
check and that setting the variable would trigger the redeploy that comes up
healthy. That holds only if the container starts before the variable exists.
Set during the build, the first deployment succeeds. The guide now recommends
setting it immediately after the apply, with `--skip-deploys` so the running
build is not followed by a second one, and describes the fallback.

**What this does not establish:**

- It is one observation, not a documented guarantee.
- The failure path — container starts first, `check-env` exits 1, the variable
  is then set *without* `--skip-deploys` and triggers a redeploy — was not
  taken, so it is expected but not observed. See §9, O-13.
- Whether setting the variable *without* `--skip-deploys` mid-build would queue a
  second build was not tried.

---

## 6. Template generation is refused for this source

A Railway template is generated from a live project (2026-09-14 IaC note, §3).
With the project now live, the maintainer tried both ways of generating one.
Nothing was published.

```bash
railway templates create --project talivia --environment production
```

and the underlying API call, `templateGenerate(input: { projectId, environmentId })`,
both fail with `BAD_USER_INPUT`:

```text
Service talivia does not have a source that can be used to generate a template
```

The service's stored source is the repository `talivia-group/talivia`, with
`image` null. That repository is a **third-party public repository that is not
connected through the Railway GitHub App**, which appears to be what the
generator requires. This is an inference from the error and the source type;
**Railway's documentation does not describe the constraint.**

### 6.1 What the API offers

Railway's public API has **no mutation that creates a template from scratch or
edits a template's services or variables.** The template mutations present are:

```text
templateGenerate  templateClone  templateDeployV2  templatePublish
templateUnpublish templateDelete templateRevert
templateServiceSourceEject  templateVolumeUpdate
```

Composing a template from a public repository URL is possible only in the
dashboard's template composer.

Two facts that bear on a template if one is ever made:

- Template variables support `${{secret(32)}}`, which generates a secret at
  deploy time. That is the right mechanism for `APP_SECRET` *in a template*, and
  it is a different mechanism from the IaC file's `preserve()`.
- Unpublished and private templates are not eligible for Template Kickback.

### 6.2 Paths forward — options, not a decision

No decision has been taken. Each path has a cost.

| | Path | What it gives | What it costs |
| --- | --- | --- | --- |
| (a) | Compose the template by hand in the dashboard from a written spec | A one-click route that keeps upstream as the source | Hand-built, so it is not generated from the live project and can drift from the IaC file. A written spec has to be kept in step with the file. |
| (b) | Point the service's source at a fork under the maintainer's own GitHub account | The GitHub App can connect it, which enables generate-from-project; the fork's branch can be held at a chosen commit | The route is **no longer upstream's repository itself**. That changes what the 2026-09-14 route comparison selected, and the fork has to be kept in step with upstream. |
| (c) | Stay IaC-only; no template | Nothing new to maintain; the file is already the maintained configuration | No one-click route. |

Whichever is chosen, the route research (§2, Route C) already set the motive: a
template must **not** be made for referral or template revenue. Publishing is
also an outward-facing act that enters Railway's Template Kickback programme
(2026-09-14 IaC note, §3), which is a decision about publishing, not about
configuration. This note takes neither.

---

## 7. A correction to the review URL

The catalog record's `review_url` was
`https://pixapps.ai/reviews/talivia-group-talivia-acfdc1/`, which returns 404.
The review is published, and its canonical address is
`https://pixapps.ai/jurypress/reviews/talivia-group-talivia-acfdc1/`: HTTP 200,
with a `<link rel="canonical">` that matches. The recorded URL lacked the
`/jurypress/` segment.

The review was never withdrawn, so the finding in the route research's §1 stands.
The record is being corrected by a separate change; this note only reports it.

---

## 8. What remains for a person

The required checks in [`checks/checks.json`](../../checks/checks.json), tracked
by Issue #5 in this repository. The middle column is what bears on each check
from the maintainer's apply. It is not a result.

| Check | What the maintainer's apply observed that bears on it | Result on the record |
| --- | --- | --- |
| `deploy-completes` | The deployment reached SUCCESS and the health check passed. The check's verifier is a person following the guide on their own account. | None |
| `initial-setup-completes` | Migrations applied at first boot. On 2026-10-10 the owner signed in with the bootstrap credentials, changed the password under **Settings → Account** (`/app/settings/account`, which renders the profile page with the *Change password* form), signed out, and confirmed the old password is refused and the new one accepted. No website has been created and no tracking snippet obtained. | None |
| `primary-flow-works` | Nothing. No website was created and no event sent. The tracker script is served with open CORS. | None |
| `access-and-auth-understood` | Signed out, `/` redirected to `/login` and an API route returned 401. That is two probes, not an account of what is exposed. | None |
| `persistence-survives-restart` | Nothing. No data was created and nothing was restarted. | None |

Two practical points for whoever does this:

- **The maintainer's deployment was publicly reachable** for a few hours on
  2026-10-10, at a generated address. The bootstrap password was changed
  shortly after the domain was created, which closed the window the guide
  describes. Later the same day, after the verification was recorded, the
  owner deleted the Railway project — the database, the service and the
  domain are gone, and nothing in this repository refers to them. On any other
  deployment, change the password first.
- For `persistence-survives-restart`, read `meta.commitHash` before and after the
  restart. If a redeploy rebuilds from a newer head (§9, O-11), the commit under
  test changes in the middle of the check, and the verification must say so.

---

## 9. Open items

Carried forward unchanged: **long-term scale** (PostgreSQL behaviour under
sustained event volume) and **cost**. Neither was observed, and a single day-one
deployment cannot answer either.

| id | Question | Settled by |
| --- | --- | --- |
| O-9 | Does Railway's edge set `x-forwarded-host` to the public domain? (route research O-3, still open) | A person signs in and reads the payment-provider webhook URL under **Website settings → Payments**. If it is not the public domain, the proxy is not forwarding the original host. |
| O-10 | Which path for a template: (a) hand-composed in the dashboard, (b) a fork the GitHub App can connect, or (c) none? Also whether the GitHub App connection really is what the generator requires. | The owner's decision (§6.2). The constraint is settled only by trying (b) or by Railway documenting it. |
| O-11 | Does a redeploy, or a variable change, rebuild from the current branch head, or reuse the commit already built? | Reading `meta.commitHash` across a redeploy, ideally during the persistence check. |
| O-12 | Do the guide's statements about the bootstrap account, the **Settings → Account** path and the baseline migration, read at `2d3ec33…`, still hold at `a9bdc51…`? | **Answered: yes.** Upstream's `README.md` at `a9bdc51` documents the same bootstrap account and the same **Settings → Account** instruction; `src/app/(main)/app/settings/account/page.tsx` renders the profile page, whose `ProfileSettings` mounts `PasswordChangeForm`; `0001_oss_baseline` was among the migrations applied; and the owner signed in and changed the password on 2026-10-10. The route is `/app/settings/account` — `/settings/profile` is 404. |
| O-13 | What does the `APP_SECRET` failure path look like in practice: container starts first, `check-env` exits 1, the variable is set without `--skip-deploys`, the redeploy succeeds? | A deliberate second apply to a scratch project, or a reader who hits it. Expected, not observed. |
| O-14 | After the file was edited to drop `commitSha` and `build`, does `railway config plan` against the live project show no changes? | **Answered: yes.** Run after the edit on 2026-10-10: `✓ Your Railway configuration is already up to date.` (§1.2, step 9). |

The 2026-09-14 items are otherwise closed or answered as in §2: O-1 is moot, O-4
is answered (no `sslmode`), O-5 and O-6 are answered in part, O-7 is answered
(not honoured), and O-8 is unanswered.

**State at the time of writing:** this note was drafted while `work_state`
was `awaiting_human_verification` and the record carried no verification
block. Later the same day the owner reviewed the checks and the record moved to
`work_state: verified`, `listing_state: unlisted`, with a verification block
naming `a9bdc51…` and the image digest, two required checks `not_tested`
(`primary-flow-works`, `persistence-survives-restart`), and therefore no
listing. The §8 table above describes what bore on each check before that
record was written; the record, not this note, is the result.
