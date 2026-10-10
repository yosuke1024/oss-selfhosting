# Talivia on Railway

Self-hosted web analytics that joins site traffic to payment data. This guide
deploys it on **Railway**, on **your own account, billed to you**. This
repository hosts nothing and runs nothing on your behalf.

> **Not verified yet.** The checks a person performs on a deployment have not
> been done. The route was established by reading upstream's source. On
> 2026-10-10 the maintainer then applied the configuration once, on their own
> Railway account: the service came up healthy, applied its migrations and
> passed the read-only smoke check described below. That is evidence about one
> deployment, not a verification. The same day the maintainer signed in,
> changed the bootstrap password, and confirmed the old one is refused and the
> new one accepted. Creating a website, sending an event and confirming that
> data survives a restart have **not** been performed, and the record at
> [`catalog/projects/talivia.json`](../../catalog/projects/talivia.json)
> carries no verification block. Until it does, treat every expected result
> below as *what should happen*; the few things the maintainer's apply actually
> showed are labelled as such.

## The route, and why this one

**Build upstream's own `Dockerfile` directly, from upstream's `main` branch.**
Upstream ships a production Dockerfile and a Compose file as its supported
deployment path; Railway builds that Dockerfile from the repository.

There is **no official Railway template** for Talivia — the upstream repository
references Railway nowhere. A community template exists and was **rejected**:
it is published by an account unrelated to upstream and deploys a prebuilt
Docker Hub image owned by a third account, with no source link and only a
mutable `latest` tag, so nothing about it can be pinned to an upstream commit.
The full comparison is in
[`notes/talivia/2026-09-14-railway-route-research.md`](../../notes/talivia/2026-09-14-railway-route-research.md).

Upstream's Dockerfile is deployable as-is, so **this repository builds no image
and maintains no Dockerfile.** What it does maintain is the handful of
Railway-specific settings the deployment needs — the branch to build, the health
check path, the private-network database reference and the port — as a Railway
**Infrastructure as Code** file:

```text
deployments/talivia/.railway/railway.ts
```

The Dockerfile build itself is not a setting in that file. Railway detects
upstream's `Dockerfile` at the repository root and builds it.

You apply it to your own Railway account with your own credentials. This
repository never applies it, and Railway has no file-based template format, so
this is not a template anyone publishes on your behalf — see
[`notes/talivia/2026-09-14-railway-iac-research.md`](../../notes/talivia/2026-09-14-railway-iac-research.md).

The file carries **no secret**. `APP_SECRET` is preserved from the environment
you set it in, and the public domain is created outside the file.

**The file cannot pin a commit.** Railway deploys the head of the branch at the
moment you apply. Railway's API has no commit on a service's source — a source
is a repository or an image, and nothing finer — so a commit written into the
file is ignored: the maintainer's first apply declared one commit and Railway
built a newer head, and the file no longer declares one. A specific commit can
only be deployed one deployment at a time, from the dashboard or through
Railway's API. So the commit you get is whatever `main` is when you apply; you
read it from the deployment afterwards (see
[Version this guide describes](#version-this-guide-describes)), and that is the
commit a verification names. The full account is in
[`notes/talivia/2026-10-10-railway-first-apply.md`](../../notes/talivia/2026-10-10-railway-first-apply.md).

## Version this guide describes

```text
repository: https://github.com/talivia-group/talivia
branch:     main
commit:     a9bdc511b30067ddde72d48db30c69ee71289e80   (2026-09-26)
licence:    MIT
```

That commit is **not a pin.** It is the commit the maintainer's apply produced
on 2026-10-10, when it was the head of `main` (`fix(app): replace em dashes with
en dashes`), and it is what the maintainer's observations in this guide
describe. Yours will be whatever `main` is when you apply.

Upstream publishes **no tagged releases** and is moving quickly: on that day
`main` was four commits ahead of the commit this guide was first written
against, touching 44 files, four of them migration-related. Re-read its
`README.md` and `Dockerfile` before deploying.

**Read the commit you actually got from the deployment**, not from this guide:

```bash
railway deployment list --service talivia --json
```

In the newest deployment's `meta`, `commitHash` is the upstream commit that was
built and `imageDigest` is the image it produced. Those two identify what you
deployed; the commit is what the verification record must name. The application
cannot tell you: on Railway, `/api/heartbeat` reports the version `"local"`,
because Railway does not supply the Dockerfile's `BUILD_VERSION` build argument.

## What you need

| | |
| --- | --- |
| A Railway account | You pay Railway directly for what you run. |
| One PostgreSQL database | Railway's managed PostgreSQL, declared by the configuration. Minimum 9.4 is enforced at boot; upstream exercises 17, Railway currently provisions 18. |
| A random `APP_SECRET` | 32 bytes or more. Generated once, by you — see step 5. |
| The Railway CLI | 5.42.1 or newer, plus `npm install railway` for the IaC SDK. |
| A site to track | Any page you can add a `<script>` tag to, for the main-flow check. |

A payment-provider account (Stripe, LemonSqueezy, Polar, Dodo, Yolfi) is
**optional** and only needed for revenue attribution. A CoinGecko API key is
optional and only enables crypto exchange-rate conversion.

## Deploy

The whole service graph — the database, the application, the source branch, the
health check and the variables — is in
[`.railway/railway.ts`](.railway/railway.ts). You apply it; nothing here does.

> **Read `plan` before you `apply`.** `plan` is a preview and changes nothing.
> It shows what will be created and under which project name. It cannot show
> everything — see [What to check in the plan](#what-to-check-in-the-plan).

### 1. Install the CLI and the SDK

The CLI evaluates the file; the file imports `railway/iac`, so the SDK has to be
installed where you run the command.

```bash
npm install railway
```

This repository does **not** depend on it — the catalog validator installs
nothing and runs offline. Install it in your own clone or a scratch directory.
Requires Railway CLI 5.42.1 or newer; this file was authored against 5.54.1 and
first applied, by the maintainer, with 5.55.0 and the `railway` 3.11.0 SDK.

### 2. Sign in and link a project

```bash
railway login
railway init
```

`railway init` creates a project and links this directory to it. Name it
`talivia` if you have no reason not to: the file declares
`project("talivia", …)`, and a linked project with a different name may show up
in the plan as a rename.

### 3. Preview

```bash
railway config plan --file deployments/talivia/.railway/railway.ts
```

On a project already named `talivia`, the maintainer's plan read
`2 to add, 0 to change, 0 to destroy`: create the database, create the service.

### 4. Apply

```bash
railway config apply --file deployments/talivia/.railway/railway.ts
```

This creates the managed PostgreSQL and the application service, builds
upstream's `Dockerfile` and wires `DATABASE_URL` over the private network.

> **Apply with `--file`, not with a saved plan.** `railway config plan --out`
> writes a pinned plan artifact and `railway config apply --plan` applies it,
> which would be the safer pattern. It does not work when the authoring file is
> not at the repository root: the pin assumes a root-level `.railway/`
> directory, `apply --plan` has no `--source-tree` flag, and the maintainer's
> attempt (CLI 5.55.0) failed with *"Could not pin .railway/ … is not a
> directory and git has no HEAD:.railway tree"*. Read the `plan`, then apply
> the file.

> Managed PostgreSQL is used deliberately. Running your own `postgres`
> container on Railway needs `PGDATA` pointed at a *subdirectory* of the volume
> mount, because the mount root is not empty. The managed database removes that
> problem entirely.

### 5. Set `APP_SECRET` — right after the apply, while the first build runs

This is the one required value the file cannot carry, and the order matters for
a real reason: a variable can only be set on a service that exists, and the
service is created by step 4. Upstream's `scripts/check-env.js` exits 1 when
`APP_SECRET` is missing, shorter than 32 bytes, or still equal to its
placeholder. That is fail-fast working correctly, not a fault in this
configuration.

**Run this as soon as the apply returns, while the first build is still
running:**

```bash
openssl rand -hex 32 | railway variable set APP_SECRET --stdin --service talivia --skip-deploys
```

It works because Railway reads a service's variables when the container
*starts*, not when the deployment is *created*, and a build takes a few minutes.
That is the conclusion from one apply, not a documented guarantee: builds took
about three to four minutes, the variable was set about two minutes in, the
container started afterwards, and `check-env.js` passed at first boot.
`--stdin` keeps the secret out of your shell history and out of the process
list. `--skip-deploys` stops Railway queuing a second build for a change the
running one will already pick up.

**If the container starts before the variable exists** — you were slow, or the
build was fast — the boot fails at `check-env.js`. That is the failure described
above, not something to debug. Set the variable the same way but **without
`--skip-deploys`**: the change triggers the redeploy that should come up
healthy. (This fallback follows from how Railway and `check-env.js` behave; the
maintainer's apply did not take that path, so it has not been observed.)

Consider **sealing** it afterwards in the Railway dashboard. A sealed variable
cannot be read back by the CLI or the API, which is a good fit here — the file
declares it as `preserve()`, so neither `plan` nor `apply` ever needs its value.

> **Generate `APP_SECRET` once and keep it.** It signs sessions *and encrypts
> stored payment-provider credentials*: rotating it later invalidates sessions
> and leaves saved credentials undecryptable.

### 6. Create the public domain

Railway's generated domains are not expressible in an IaC file, so this step
stays manual — and the port matters:

```bash
railway domain --port 3000 --service talivia
```

**Pass `--port 3000`.** The container listens on 3000; Railway's default target
port is not 3000, and a domain pointed at the wrong port produces a service that
builds, goes healthy and then serves nothing.

The command prints a generated address. On the maintainer's deployment it had
the shape `https://<service>-<environment>.up.railway.app`, built from the
service name and the environment name.

### What the file sets, and what it deliberately leaves alone

| | |
| --- | --- |
| Source | The `main` branch of `talivia-group/talivia`. **Not a commit** — see [the route](#the-route-and-why-this-one). |
| Build | **Not set.** Railway detects upstream's `Dockerfile` at the repository root and builds it. Its API has no `DOCKERFILE` builder value to write here. On the maintainer's deployment the manifest first reported the `RAILPACK` builder while the build was running and resolved to `DOCKERFILE`, path `/Dockerfile`, when it finished; the build log shows upstream's multi-stage Dockerfile (`deps`, `builder`, `runner`). |
| `DATABASE_URL` | A reference to the managed PostgreSQL over the **private** network. Never a literal. |
| `APP_SECRET` | `preserve()` — kept from your environment, never written here. |
| `PORT` | `3000`, explicitly. See below. |
| Health check | `/api/heartbeat`, timeout 300s. **Not `/`** — `/` redirects to `/login` and never reaches the health logic. The timeout is generous because migrations run *before* the server starts. Both values appeared in the maintainer's deployment manifest. |
| Volume | **None.** All state, including session replays, is in PostgreSQL. |
| `CLICKHOUSE_URL` | Unset, keeping the supported PostgreSQL-only path. |
| `SKIP_DB_CHECK`, `SKIP_DB_MIGRATION` | **Never set.** They disable the boot checks that apply migrations and verify the database. |
| Replicas, restart policy | **Not set.** Railway's defaults applied on the maintainer's deployment: one replica, restart on failure up to 10 times. |

**On `PORT`:** earlier preparation recommended leaving it unset. That advice has
been reversed, because Railway *injects* `PORT` and health-checks against that
same value. `process.env.PORT` appears nowhere in upstream's tree while the
Dockerfile declares `EXPOSE 3000`, so if the server ignores `PORT` and Railway
probes an injected value, the deployment never goes healthy and the cause is not
obvious. Setting `PORT=3000` is correct whether or not the server honours it.
On the maintainer's deployment the server listened on `0.0.0.0:3000` and the
health check passed; whether the server honours an *injected* `PORT` is still
undetermined, and under this configuration the answer makes no difference. The
reasoning is in
[`notes/talivia/2026-09-14-railway-iac-research.md`](../../notes/talivia/2026-09-14-railway-iac-research.md) §5.

### What to check in the plan

`plan` shows less than it might appear to. Three things in this configuration
are not settled by reading it. None is a defect; each is a thing to check rather
than assume.

| | |
| --- | --- |
| **The commit** | The plan cannot show it. Railway builds the head of the branch at apply time, and at plan time the staged patch and the change details are empty (`null` in `--json` output), so nothing in the plan says which commit you will get. Read it from the deployment after the apply — see [Version this guide describes](#version-this-guide-describes) — and record it. |
| **The project name** | If your linked project is not named `talivia`, check whether the plan proposes renaming it. With a project already named `talivia`, the maintainer's plan proposed no rename. |
| **PostgreSQL 18** | `postgres()` resolves to `postgres-ssl:18`. Upstream enforces a minimum of 9.4 and exercises 17, so 18 clears the bar but is untested by upstream. It booted and applied all three migrations cleanly on the maintainer's deployment on 2026-10-10; that is one boot, not a test of 18 under load. |

## First run

On first start the container applies upstream's migrations — three, at the
commit the maintainer built — and the baseline migration seeds a single
administrator account. Upstream documents the bootstrap credentials in its
`README.md`. At the commit the maintainer built they are unchanged from the
commit this guide was first written against, and signing in with them worked.
Check upstream's `README.md` at the commit your deployment built all the same.

> ### Change the bootstrap password immediately
>
> The account is created by the migration with a fixed user id, and **nothing
> forces a change.** Once you create the public domain in step 6, your instance
> is reachable from the internet, so between "migrations applied" and "password
> changed" it is reachable with credentials anyone can read in upstream's
> documentation.
>
> Open the deployment, sign in, and change the password under
> **Settings → Account** before doing anything else. That is the page at
> `/app/settings/account`, which carries the *Change password* form; there is
> no `/settings/profile`. Then sign out and confirm the old password is refused
> and the new one accepted.

Then:

1. Create a website in Talivia.
2. Copy its tracking snippet into a page you control.
3. Load that page, and confirm the visit appears on the dashboard.
4. Optionally enable Session Replay in the website's settings.
5. Optionally connect a payment provider under **Website settings → Payments**.

## Confirming it works

An optional, read-only smoke check is included:

```bash
node deployments/talivia/smoke.mjs https://your-deployment.example.com
```

It checks the health endpoint, the `/` → `/login` redirect, the tracker script
and its CORS header, and that an authenticated API endpoint refuses a signed-out
request. It makes no changes and sends no analytics events.

**It is evidence about a deployment, not a verification.** It cannot sign in,
cannot confirm your password change, cannot send a test event and cannot
observe persistence across a restart. Those are the checks a person performs —
see [`checks/checks.json`](../../checks/checks.json).

For reference, this is the maintainer's own run of it on 2026-10-10, against the
maintainer's own deployment (abridged to the four result lines):

```text
PASS  health endpoint responds — version "local"
PASS  / redirects to /login — 307 to /login
PASS  tracker script is served with open CORS — 9547 bytes, CORS open
PASS  API requires authentication — 401 signed out
```

That is one deployment's output, on the day it was first applied. It is not a
verification of yours, and it is not one of the maintainer's either: the checks
listed above have not been performed by anyone. The `"local"` version is not a
fault — see [Version this guide describes](#version-this-guide-describes).

## Backups and upgrades

Back up the PostgreSQL database before upgrading. Upstream documents a logical
dump; on Railway, take it against the managed database.

Redeploying a newer commit **applies migrations during start**, so an upgrade is
a schema change. Back up first, and never edit a migration already applied to a
persistent database. There is **no migration path from a hosted Talivia
database** — the baseline assumes an empty one.

Because the service follows the branch rather than a commit, a rebuild can pick
up a newer upstream head than the one you checked. Whether a plain redeploy, or
a change to a variable, rebuilds from the current head or reuses the commit
already built has not been observed; read `meta.commitHash` again after any
redeploy.

## Known constraints

- The open-source edition is a **subset** of the commercial product. Upstream
  lists Google Search Console, Bing Webmaster Tools, GitHub activity and social
  mentions as Cloud-only; they are not available self-hosted.
- The **revenue-attribution worker** shipped in the repository is not run by the
  official container. Attribution is computed inline on the payment webhook
  path, but a queued or failed attribution job is not retried automatically.
  A manual retry endpoint exists. Running the worker would mean a second Railway
  service off the same image.
- Payment-provider **webhook URLs are derived from forwarded host and protocol
  headers**. If the webhook URL shown in the UI is not your public domain, the
  proxy is not forwarding the original host.
- Analytics and session replays are stored in **PostgreSQL**. Upstream carries
  an optional ClickHouse backend, but it is undocumented and not applied by the
  container's start sequence.

## What the first apply established, and what it could not

On 2026-10-10 the maintainer applied the configuration once, on their own
account. These are the answers that first apply gave to the open questions the
preparation left, and the ones it left open. They are observations, not a
verification.

| | |
| --- | --- |
| `PORT` | Healthy with `PORT=3000`: the server listened on `0.0.0.0:3000` and the health check passed. Whether the standalone server honours an injected `PORT` is still undetermined, and under this configuration the question is moot — both answers give the same result. |
| Commit pinning | **Not honoured.** The file declared one commit; Railway built the head of `main` that day (`a9bdc51`). Railway's API has no commit on a service source, so the file no longer declares one. A commit can be deployed per deployment, not per service. |
| PostgreSQL 18 | Booted. The application's version check passed and three migrations applied (`0001_oss_baseline`, `20260911173000_backfill_visitor_first_session`, `20260924181000_oss_installation_identity`). One boot; not a test of 18 under sustained load. |
| `APP_SECRET` ordering | Railway reads variables when the container starts, not when the deployment is created. Set about two minutes into the first build, the variable was present at first boot and `check-env.js` passed — so the first deploy need not fail. The failure path (container starting first) is expected and described in step 5, but was not observed. |
| Heartbeat version | `/api/heartbeat` returns `"local"` on Railway, so it cannot identify the build. Use the deployment's `commitHash` and `imageDigest`. |
| Database TLS | No `sslmode` needed. `DATABASE_URL` resolved to the private-network host `postgres.railway.internal:5432` and the application connected to `postgres-ssl:18` without any `sslmode` parameter. |
| Forwarded host | **Still open.** Whether Railway's edge sets `x-forwarded-host` to the public domain is only observable from the payment-provider webhook URL in the signed-in UI (**Website settings → Payments**), which was not looked at. If that URL is not your public domain, the proxy is not forwarding the original host. |
| Template | Railway refused to generate a template from this project: *"Service talivia does not have a source that can be used to generate a template"*. The service's source is a third-party public repository that is not connected through Railway's GitHub App, which appears to be what the generator needs; Railway's documentation does not say so. This repository offers no template, and whether to make one is undecided — see [the note](../../notes/talivia/2026-10-10-railway-first-apply.md). |
| Long-term scale | PostgreSQL behaviour under sustained event volume. A single deployment cannot answer it. |
| Cost | Not observed. |

**Still to be done by a person**, and what the record's required checks ask for:
create a website and send an event end to end; establish what a signed-out
visitor can reach; restart or redeploy the service and confirm the data is
still there. On the maintainer's deployment the bootstrap password was changed
on 2026-10-10; on yours, do that first. See
[`checks/checks.json`](../../checks/checks.json).
