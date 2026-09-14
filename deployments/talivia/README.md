# Talivia on Railway

Self-hosted web analytics that joins site traffic to payment data. This guide
deploys it on **Railway**, on **your own account, billed to you**. This
repository hosts nothing and runs nothing on your behalf.

> **Not verified yet.** Nothing here has been deployed and confirmed by a
> person. This is preparation: the route was established by reading upstream's
> source, not by running it. Until the record at
> [`catalog/projects/talivia.json`](../../catalog/projects/talivia.json)
> carries a verification block, treat every expected result below as *what
> should happen*, not as *what was observed*.

## The route, and why this one

**Build upstream's own `Dockerfile` directly, pinned to a commit.** Upstream
ships a production Dockerfile and a Compose file as its supported deployment
path; Railway builds that Dockerfile from the repository.

There is **no official Railway template** for Talivia — the upstream repository
references Railway nowhere. A community template exists and was **rejected**:
it is published by an account unrelated to upstream and deploys a prebuilt
Docker Hub image owned by a third account, with no source link and only a
mutable `latest` tag, so nothing about it can be pinned to an upstream commit.
The full comparison is in
[`notes/talivia/2026-09-14-railway-route-research.md`](../../notes/talivia/2026-09-14-railway-route-research.md).

Upstream's Dockerfile is deployable as-is, so **this repository builds no image
and maintains no Dockerfile.** What it does maintain is the handful of
Railway-specific settings the deployment needs — the pinned commit, the health
check path, the private-network database reference and the port — as a Railway
**Infrastructure as Code** file:

```text
deployments/talivia/.railway/railway.ts
```

You apply it to your own Railway account with your own credentials. This
repository never applies it, and Railway has no file-based template format, so
this is not a template anyone publishes on your behalf — see
[`notes/talivia/2026-09-14-railway-iac-research.md`](../../notes/talivia/2026-09-14-railway-iac-research.md).

The file carries **no secret**. `APP_SECRET` is preserved from the environment
you set it in, and the public domain is created outside the file.

## Version this guide describes

```text
repository: https://github.com/talivia-group/talivia
commit:     2d3ec339072723f4c7f0335e513aaadae3a31603   (2026-09-13)
licence:    MIT
```

Upstream publishes **no tagged releases**, so pin by commit. Upstream is also
moving quickly — re-read its `README.md` and `Dockerfile` before deploying, and
if you deploy a different commit, that is the commit the verification record
must name.

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

The whole service graph — the database, the application, the pinned commit, the
health check and the variables — is in
[`.railway/railway.ts`](.railway/railway.ts). You apply it; nothing here does.

> **Read `plan` before you `apply`.** `plan` is a preview and changes nothing.
> It is also the only place some of this configuration gets tested before it
> reaches a real project — see [What to check in the plan](#what-to-check-in-the-plan).

### 1. Install the CLI and the SDK

The CLI evaluates the file; the file imports `railway/iac`, so the SDK has to be
installed where you run the command.

```bash
npm install railway
```

This repository does **not** depend on it — the catalog validator installs
nothing and runs offline. Install it in your own clone or a scratch directory.
Requires Railway CLI 5.42.1 or newer; this file was authored against 5.54.1.

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

### 4. Apply

```bash
railway config apply --file deployments/talivia/.railway/railway.ts
```

This creates the managed PostgreSQL and the application service, builds
upstream's `Dockerfile` and wires `DATABASE_URL` over the private network.

> Managed PostgreSQL is used deliberately. Running your own `postgres`
> container on Railway needs `PGDATA` pointed at a *subdirectory* of the volume
> mount, because the mount root is not empty. The managed database removes that
> problem entirely.

### 5. Set `APP_SECRET` — the first deploy will fail until you do

This is the one required value the file cannot carry, and the order is awkward
for a real reason: a variable can only be set on a service that exists, and the
service is created by step 4.

**So expect the first deployment to fail its boot check.** Upstream's
`scripts/check-env.js` exits 1 when `APP_SECRET` is missing, shorter than 32
bytes, or still equal to its placeholder. That is fail-fast working correctly,
not a fault in this configuration.

```bash
openssl rand -hex 32 | railway variable set APP_SECRET --stdin --service talivia
```

`--stdin` keeps the secret out of your shell history and out of the process
list. Setting it triggers a redeploy, which is the one that should come up
healthy.

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
railway domain --port 3000
```

**Pass `--port 3000`.** The container listens on 3000; Railway's default target
port is not 3000, and a domain pointed at the wrong port produces a service that
builds, goes healthy and then serves nothing.

### What the file sets, and what it deliberately leaves alone

| | |
| --- | --- |
| `DATABASE_URL` | A reference to the managed PostgreSQL over the **private** network. Never a literal. |
| `APP_SECRET` | `preserve()` — kept from your environment, never written here. |
| `PORT` | `3000`, explicitly. See below. |
| Health check | `/api/heartbeat`, timeout 300s. **Not `/`** — `/` redirects to `/login` and never reaches the health logic. The timeout is generous because migrations run *before* the server starts. |
| Volume | **None.** All state, including session replays, is in PostgreSQL. |
| `CLICKHOUSE_URL` | Unset, keeping the supported PostgreSQL-only path. |
| `SKIP_DB_CHECK`, `SKIP_DB_MIGRATION` | **Never set.** They disable the boot checks that apply migrations and verify the database. |

**On `PORT`:** earlier preparation recommended leaving it unset. That advice has
been reversed, because Railway *injects* `PORT` and health-checks against that
same value. `process.env.PORT` appears nowhere in upstream's tree while the
Dockerfile declares `EXPOSE 3000`, so if the server ignores `PORT` and Railway
probes an injected value, the deployment never goes healthy and the cause is not
obvious. Setting `PORT=3000` is correct whether or not the server honours it.
The reasoning is in
[`notes/talivia/2026-09-14-railway-iac-research.md`](../../notes/talivia/2026-09-14-railway-iac-research.md) §5.

### What to check in the plan

Three things in this configuration are not settled until you run it. None is a
defect; each is a thing to read rather than assume.

| | |
| --- | --- |
| **The pinned commit** | `commitSha` is in Railway's SDK types and compiles into the graph, but it is not in Railway's published IaC documentation. If the plan does not show the deployment pinned to `2d3ec33…`, it is tracking the branch head instead — which is the one property that made this route preferable to the rejected community template. Record what you see. |
| **The project name** | If your linked project is not named `talivia`, check whether the plan proposes renaming it. |
| **PostgreSQL 18** | `postgres()` resolves to `postgres-ssl:18`. Upstream enforces a minimum of 9.4 and exercises 17, so 18 clears the bar but is untested by upstream. |

## First run

On first start the container applies upstream's baseline migration, which seeds
a single administrator account. Upstream documents the bootstrap credentials in
its `README.md`.

> ### Change the bootstrap password immediately
>
> The account is created by the migration with a fixed user id, and **nothing
> forces a change.** Railway assigns a public HTTPS domain as soon as the
> service is healthy, so between "migrations applied" and "password changed"
> your instance is reachable from the internet with credentials anyone can read
> in upstream's documentation.
>
> Open the deployment, sign in, and change the password under
> **Settings → Account** before doing anything else.

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
and its CORS header, and that no unauthenticated page leaks. It makes no
changes and sends no analytics events.

**It is evidence about a deployment, not a verification.** It cannot sign in,
cannot confirm your password change, cannot send a test event and cannot
observe persistence across a restart. Those are the checks a person performs —
see [`checks/checks.json`](../../checks/checks.json).

## Backups and upgrades

Back up the PostgreSQL database before upgrading. Upstream documents a logical
dump; on Railway, take it against the managed database.

Redeploying a newer commit **applies migrations during start**, so an upgrade is
a schema change. Back up first, and never edit a migration already applied to a
persistent database. There is **no migration path from a hosted Talivia
database** — the baseline assumes an empty one.

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

## What preparation could not establish

These are open questions for whoever verifies this, not defects:

| | |
| --- | --- |
| `PORT` | Whether the standalone server honours a `PORT` override. Mitigated by setting it to `3000`, which is the right value under either answer. |
| Commit pinning | Whether Railway honours `source.commitSha` on apply, or tracks the branch head. The `plan` output is the tell. |
| PostgreSQL 18 | Railway's managed PostgreSQL is 18; upstream exercises 17. Above the enforced minimum, but not a version upstream tests. |
| `APP_SECRET` ordering | Whether `preserve()` on a never-set variable leaves it unset, making the first deploy fail its boot check. Expected, and the guide says so. |
| Forwarded host | Whether Railway's edge sets `x-forwarded-host` to the public domain. The webhook URL in the UI is the tell. |
| Database TLS | Whether `DATABASE_URL` over the private network needs an `sslmode` parameter. The boot connection either succeeds or names the reason. |
| Long-term scale | PostgreSQL behaviour under sustained event volume. A single deployment cannot answer it. |
| Cost | Not observed. |
