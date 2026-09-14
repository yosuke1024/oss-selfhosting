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

Because upstream's Dockerfile is deployable as-is, **this repository maintains
no Dockerfile or platform configuration for Talivia.** Everything below is
either an upstream default or a Railway service setting.

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
| One PostgreSQL database | Railway's managed PostgreSQL. Minimum 9.4 is enforced at boot; upstream exercises 17. |
| A random `APP_SECRET` | 32 bytes or more. Generated once — see below. |
| A site to track | Any page you can add a `<script>` tag to, for the main-flow check. |

A payment-provider account (Stripe, LemonSqueezy, Polar, Dodo, Yolfi) is
**optional** and only needed for revenue attribution. A CoinGecko API key is
optional and only enables crypto exchange-rate conversion.

## Deploy

### 1. Create the database first

Add Railway's **managed PostgreSQL** to a new project. Let Railway keep it on
the private network; do not enable a public TCP proxy for it.

> Managed PostgreSQL is used deliberately. Running your own `postgres`
> container on Railway needs `PGDATA` pointed at a *subdirectory* of the volume
> mount, because the mount root is not empty. The managed database removes that
> problem entirely.

### 2. Create the application service

Point a new service at the upstream repository and pin it to the commit above.
Railway builds the repository's `Dockerfile`; the build needs no database,
because upstream's build stage supplies its own dummy connection string.

### 3. Set exactly two variables

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | A reference to the managed PostgreSQL, over the **private** network. |
| `APP_SECRET` | Output of `openssl rand -hex 32`. |

```bash
openssl rand -hex 32
```

**Generate `APP_SECRET` once and keep it.** It signs sessions *and encrypts
stored payment-provider credentials*: rotating it later invalidates sessions
and leaves saved credentials undecryptable.

Nothing else is required. In particular:

- **Leave `PORT` unset.** The container declares `EXPOSE 3000` and the
  application binds 3000 by default. Whether the server honours a `PORT`
  override was not established during preparation, so setting it is the one
  change most likely to produce a service that builds and then never becomes
  healthy.
- **Never set `SKIP_DB_CHECK` or `SKIP_DB_MIGRATION`.** They disable the boot
  checks that apply migrations and verify the database.
- **Leave `CLICKHOUSE_URL` unset** to stay on the supported PostgreSQL path.

### 4. Set the health check path

```text
/api/heartbeat
```

**Not `/`.** The application redirects `/` to `/login`, so a health check
pointed at the root does not reach the application's health logic. Allow a
generous startup grace period: migrations run *before* the server starts.

### 5. No volume on the application service

All state — including session replays — lives in PostgreSQL. Preparation found
no local filesystem writes in the application. Only the database needs
persistence.

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
| `PORT` | Whether the standalone server honours a `PORT` override. Mitigated by leaving it unset. |
| Forwarded host | Whether Railway's edge sets `x-forwarded-host` to the public domain. The webhook URL in the UI is the tell. |
| Database TLS | Whether `DATABASE_URL` over the private network needs an `sslmode` parameter. The boot connection either succeeds or names the reason. |
| Long-term scale | PostgreSQL behaviour under sustained event volume. A single deployment cannot answer it. |
| Cost | Not observed. |
