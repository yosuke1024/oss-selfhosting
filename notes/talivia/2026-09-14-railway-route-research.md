# Talivia — Railway suitability and deployment route research

**Date:** 2026-09-14 · **Stage:** P02 (research and design only) · **Author:** Claude Code

This is a dated snapshot of one moment. It is not maintained as current, it is
not a listing, and it makes no claim that Talivia works on Railway. **No check
in this note has been run.** Everything below is either read from source at a
pinned commit, or explicitly marked as unverified.

The real deployment and the checks defined here happen at P09, performed by a
person on their own Railway account.

---

## 1. Review record ↔ upstream correspondence

| Question | Answer | Source |
| --- | --- | --- |
| `review_slug` | `talivia-group-talivia-acfdc1` | `data/reviews/2026/07/talivia-group-talivia-acfdc1/` |
| Upstream it refers to | `https://github.com/talivia-group/talivia` | `selection.json` → `canonical_url`, and `publication-state` → `source_canonical_url` |
| GitHub numeric id | `1315854686` — identical in `selection.json` (`source_id`) and `publication-state` (`content_id`) | both files |
| Publication status | **`published`**, published `2026-07-30T09:43:02.904Z` | `data/publication-state/talivia-group-talivia-acfdc1.json` |
| Withdrawn? | **No.** No withdrawal field or state is present on the record. | same file |
| Editorial provenance | `autonomously_generated`, `human_reviewed: false`, jury score 80.7 | `review.json` |

The correspondence is unambiguous: the slug, the canonical URL and the GitHub
numeric id all agree, and the upstream repository still resolves to that id.
The published review has not been withdrawn, so **governance gate item 1 holds
as of this date.**

The published review URL is deliberately not recorded here — the canonical URL
pattern is not derivable from this repository. P03 defines the field and P04
fills it from the site's own canonical pattern.

### Evidence snapshot vs. today

The review was generated against a snapshot taken **2026-07-30**, one day after
the repository was created (2026-07-29). The upstream has moved substantially
since. This note reads the current tree instead, and the difference matters:

- The review's headline critique — "limits its scale to Postgres" — is **only
  half true today.** An optional ClickHouse path exists in the tree (§3.6). It
  is undocumented in the README, so the critique is fair as a description of
  the *supported* path, but the catalog's operating-constraints field should
  describe the supported path rather than restate the Verdict.
- The review also flagged bootstrap `admin`/`admin` credentials. That is
  **still true** at the current commit (§3.5) and is the single most important
  security constraint for a Railway deployment, because Railway assigns a
  public HTTPS domain the moment the service starts.

---

## 2. Railway route comparison

Route preference is fixed by [`deployments/README.md`](../../deployments/README.md):
**official, then trusted community, then one maintained here.**

| # | Route | URL | Provenance | Maintained | Verdict |
| --- | --- | --- | --- | --- | --- |
| A | Railway template "talivia" | `https://railway.com/deploy/talivia` | **Unverified — publisher not established** | Unknown | **Deferred to P09** |
| B | Railway service built from the upstream `Dockerfile` | `https://github.com/talivia-group/talivia` | **Upstream itself** — the Dockerfile and `docker-compose.yml` are the project's own supported deployment artifacts | Upstream, actively (last commit 2026-09-13) | **Recommended baseline** |
| C | A template or Dockerfile maintained in this repository | — | Ours | Us | **Rejected** |
| D | Reuse the Umami Railway template | — | Third party, different product | — | **Not applicable** |

### Route A — exists, provenance not established

**This is a "could not verify", not a "does not exist".** The distinction the
issue asks for:

- The page **exists**. Search results consistently resolve
  `https://railway.com/deploy/talivia` as a live template page, and its
  indexed description carries Railway-specific detail that a generic listing
  would not have — port 3000, `/api/heartbeat` as the health check, a private
  PostgreSQL service, and `PGDATA` pointed at a subdirectory of the volume
  mount (the standard workaround for Railway volumes, whose mount root is not
  empty).
- The **publisher could not be verified from this environment.**
  `railway.com`, `docs.railway.com` and `talivia.com` are all blocked by this
  session's network egress proxy, so the template page, the Railway template
  docs and the vendor documentation could not be read directly.
- `railwayapp/templates` on GitHub **cannot** settle it either: that repository
  states its former submission role has moved into the Railway UI, and it no
  longer holds template definitions.

What *can* be established, and it is the decisive point:

> **The upstream repository contains no reference to Railway at all** — no
> deploy button in `README.md`, no `railway.json` or `railway.toml`, no mention
> in any file in the tree (verified by a full-tree case-insensitive search at
> commit `2d3ec33`).

So route A **cannot be called "official"** today, whatever the template page
says about itself. Absent an upstream link or a verified publisher identity, it
is at most a community template of unknown provenance, and the "trusted"
qualifier is not yet earned.

One indexed claim about route A is worth carrying forward regardless of who
published it: `PGDATA` must point at a **subdirectory** of a Railway volume
mount, not the mount root. That is a real Railway constraint and it applies to
any self-run PostgreSQL container on the platform. Route B avoids it entirely
by using Railway's managed PostgreSQL.

### Route B — recommended baseline

Upstream ships a production `Dockerfile` (multi-stage, Next.js standalone
output, non-root runtime user) and treats it as the supported deployment path.
Railway can build that Dockerfile directly from a pinned commit. This is the
upstream's own route applied to Railway, so it inherits upstream maintenance,
pins exactly to the commit the verification record will name, and requires this
repository to maintain nothing.

It also satisfies the re-verification rule cleanly: the verified artifact is a
commit SHA, not a third-party template whose contents can change without notice.

### Route C — rejected

`deployments/README.md` permits a configuration maintained here **only when no
official or trusted community route is usable.** Route B is usable and costs us
no maintenance, so building our own template is out of scope — and explicitly
must not be done for referral or template revenue.

### Route D — not applicable

Talivia is a fork of Umami's UI stack (it depends on
`@umami/react-zen` under the alias `@talivia/react-zen`, and the ClickHouse
migration layout matches Umami's). It is nonetheless a **different product**
with its own Prisma schema and its own baseline migration. An Umami template
would deploy Umami, not Talivia. Recorded only so the option is not re-opened.

---

## 3. Upstream technical confirmation

Everything in this section was read from the working tree at:

```text
repository: https://github.com/talivia-group/talivia
commit:     2d3ec339072723f4c7f0335e513aaadae3a31603
committed:  2026-09-13 11:26:00 +0700
subject:    fix(stripe): deduplicate Dahlia checkout payments
```

Re-confirm at implementation time — upstream is moving fast (the repository is
about six weeks old and was committed to yesterday).

### 3.1 Identity, licence, runtime

| Item | Value | Source |
| --- | --- | --- |
| Package version | `3.1.0` | `package.json` |
| Licence | **MIT**, "Copyright (c) 2025 Talivia contributors" | `LICENSE` |
| Self-hosting permitted | **Yes** — MIT places no restriction on self-hosting | `LICENSE` |
| Node | `^22.12.0 \|\| >=24.0.0` | `package.json` → `engines` |
| pnpm | `^10.10.0 <11` (pinned `packageManager: pnpm@10.10.0`) | `package.json` |
| Framework | Next.js `16.2.6`, React `19.2.5`, `output: 'standalone'` | `package.json`, `next.config.ts` |
| ORM | Prisma `^7.6.0` with `@prisma/adapter-pg` | `package.json` |

MIT satisfies **governance gate item 2**. Note the licence boundary: MIT covers
the OSS edition only. The README states the self-hosted edition is a subset of
the commercial product, and several integrations (Google Search Console, Bing
Webmaster Tools, social mentions) are Cloud-only. The catalog record should say
so under operating constraints, because a reader who deploys this expecting the
full product will be surprised.

### 3.2 Container build and start sequence

`Dockerfile`:

- Base `node:22-alpine` (`ARG NODE_IMAGE_VERSION`), pnpm `10.10.0`.
- Three stages — `deps` → `builder` → `runner`.
- **The build does not need a database.** `builder` sets a dummy
  `DATABASE_URL=postgresql://user:pass@localhost:5432/dummy`. Railway's build
  phase therefore needs no service linkage.
- Runtime user is non-root: `nextjs` (uid 1001) in group `nodejs` (gid 1001).
- `EXPOSE 3000`, `ENV HOSTNAME=0.0.0.0`, `CMD ["pnpm", "start-docker"]`.
- `BUILD_VERSION` is a build arg written to `.build-version` and surfaced by the
  health endpoint — useful for pinning the verification record to an artifact.

`start-docker` expands to `check-env` → `check-db` → `start-server`:

1. **`scripts/check-env.js`** — exits 1 if `DATABASE_URL` is unset (unless
   `SKIP_DB_CHECK`), and exits 1 if `APP_SECRET` is missing, still equal to the
   placeholder `replace-with-a-long-random-value`, or shorter than 32 bytes.
   Misconfiguration fails fast at boot rather than at first request.
2. **`scripts/check-db.js`** — connects, requires PostgreSQL **≥ 9.4.0**
   (`MIN_VERSION`, compared against `select version()`), then runs
   `prisma migrate deploy` unless `SKIP_DB_MIGRATION` is set.
3. **`start-server`** = `node server.js` — the Next.js standalone server.

**Migrations are applied automatically at container start**, by `check-db.js`,
not by the `update-db` script. The README's claim is accurate; the mechanism is
not where the script names suggest. Consequence for Railway: a redeploy of a
new commit migrates the database on boot, so a deploy is a schema change and
should be treated as one.

### 3.3 Port binding — the one open Railway risk

**`process.env.PORT` does not appear anywhere in the repository** (verified by
full-tree search over `.ts`, `.tsx`, `.js`, `.json`, `.yml`). Two consequences:

- `scripts/start-env.js` **hardcodes** `port: 3000`. This script is
  `start-env`, which the container does **not** run — but it must not be
  substituted as a start command on Railway.
- The container's actual entry is `node server.js`, the Next.js standalone
  server. That generated server is expected to read `PORT` and `HOSTNAME`, but
  **this could not be verified in this session** — the Next.js documentation
  and the Next.js source file for the standalone template were both
  unreachable (`nextjs.org` egress-blocked; the source path 404s at tag
  `v16.2.6`), and `node_modules` is not installed in the read-only checkout.

**Mitigation, and why this is low-risk in practice:** a Railway **Dockerfile**
deploy can route to the port declared by `EXPOSE 3000`. The safe configuration
is therefore to **leave `PORT` unset** on the Railway service and let the app
bind its default 3000. Setting `PORT` to anything else is the failure mode: if
the standalone server ignores it, Railway routes to a port nothing is listening
on and the deploy fails its health check with no obvious cause.

Recorded as open item **O-1** (§6) with a concrete P09 check (C-2).

### 3.4 Database, persistence and restart

- PostgreSQL is the only required dependent service. Minimum **9.4.0** enforced
  at boot; upstream's own compose file and CI both use **`postgres:17-alpine`**,
  so 17 is the version actually exercised upstream.
- **All state is in PostgreSQL.** A full-tree search for local filesystem
  writes (`writeFile`, `createWriteStream`, `mkdir`, upload handling, `/tmp`)
  in `src/lib/` and `src/app/api/` found **none**. Session replays are rows —
  `session_replay` and `session_replay_saved` models in `prisma/schema.prisma`
  — not blobs on disk.
- Therefore **the application container needs no volume.** Only the database
  needs persistence. On Railway this points at managed PostgreSQL and removes
  the `PGDATA`-subdirectory problem from §2 entirely.
- Exactly **one** migration exists: `prisma/migrations/0001_oss_baseline/`.
  There is no migration path from a hosted Talivia database — the baseline
  assumes an empty database (README, and the baseline seeds the bootstrap user).

### 3.5 Authentication initialisation — the security constraint

The baseline migration **seeds an administrator directly in SQL**:

```sql
-- Bootstrap the only initial user. Change this password immediately after first login.
INSERT INTO "user" ("user_id", "username", "password", "role", ...)
VALUES ('00000000-0000-4000-8000-000000000001', 'admin', '$2b$10$…', 'admin', ...);
```

- Username `admin`, role `admin`, **fixed UUID**. The stored hash is bcrypt
  cost 10 (`$2b$10$…`, read from the migration); the corresponding password
  is documented as `admin` in the upstream README — that pairing is taken
  from the README, not verified against the hash here.
- **No forced password change was found** in the login path. The README asks the
  operator to change it under *Settings → Account*; nothing enforces it.

On Railway this is materially more dangerous than in the local Docker Compose
flow the README describes. Railway assigns a **public HTTPS domain as soon as
the service is healthy**, so the window between "migrations applied" and
"password changed" is a publicly reachable instance with known credentials and
a known admin UUID. Changing the bootstrap password is therefore a **required
check** (C-4), not an advisory step, and it must be the first action after the
first successful boot.

`APP_SECRET` (≥ 32 bytes, `openssl rand -hex 32`) signs sessions **and encrypts
stored payment-provider credentials** (`src/lib/crypto.ts`). Rotating it
invalidates sessions and breaks decryption of saved provider credentials, so it
must be generated once and kept stable for the life of the deployment.

### 3.6 Configuration surface

README documents three variables. The tree uses considerably more. Complete
list of `process.env` reads across `src/`, `scripts/`, `next.config.ts` and
`prisma.config.ts`:

**Required**

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_SECRET` | ≥32 bytes; signs sessions, encrypts saved provider credentials |

**Documented optional**

| Variable | Purpose |
| --- | --- |
| `COINGECKO_API_KEY` | Crypto exchange-rate conversion; product stays usable without it |

**Undocumented but present in the tree** — none are needed for a first
deployment; listed so P04 does not rediscover them and so the catalog's
constraints field is accurate:

| Variable | Notes |
| --- | --- |
| `CLICKHOUSE_URL` | **Optional analytics backend.** `src/lib/clickhouse.ts` gates on `enabled = Boolean(process.env.CLICKHOUSE_URL)`; migrations live in `db/clickhouse/migrations/`. **Not applied by `start-docker`** — `update-db-clickhouse` is a separate script. Unset ⇒ pure PostgreSQL. |
| `REDIS_URL` | Detected and reported by `check-db.js`; optional cache |
| `DATABASE_REPLICA_URL` | Read replica via `@prisma/extension-read-replicas` |
| `KAFKA_URL`, `KAFKA_BROKER`, `KAFKA_SASL_MECHANISM` | Optional event pipeline |
| `CLIENT_IP_HEADER` | Overrides client-IP header selection — relevant behind a proxy |
| `STRIPE_WEBHOOK_SECRET`, `LEMONSQUEEZY_WEBHOOK_SECRET`, `POLAR_WEBHOOK_SECRET` | Per-provider webhook signature verification |
| `DEFAULT_CURRENCY`, `SALT_ROTATION`, `USE_UUIDV7`, `DISABLE_BOT_CHECK`, `IGNORE_IP`, `SKIP_LOCATION_HEADERS`, `REMOVE_TRAILING_SLASH`, `LOG_QUERY`, `YOLFI_API_BASE_URL` | Behaviour toggles |
| `SKIP_DB_CHECK`, `SKIP_DB_MIGRATION` | Escape hatches that disable the boot checks — **do not set on a verified deployment** |
| `TALIVIA_WORKER_*` | Attribution worker tuning (see §3.8) |

### 3.7 Public URL and proxy requirements

`src/lib/get-base-url.ts` derives the instance's own base URL per request:

- host: `x-forwarded-host` → `host`
- protocol: `x-forwarded-proto` → `x-forwarded-protocol` → default (`https`
  unless the host is `localhost` / `127.0.0.1` / `[::1]`)

**Payment-provider webhook URLs are generated from this.** If Railway's edge
does not forward the original host, the webhook URL shown in the UI would carry
the internal host and the provider would call the wrong address. The `https`
default means a missing `x-forwarded-proto` degrades safely on Railway; a
missing/incorrect `x-forwarded-host` does not. Railway's proxy is expected to
set both — **to be confirmed empirically** (check C-6).

Two more proxy-facing details:

- `next.config.ts` redirects `/` → `/login` (temporary, non-permanent).
  **A Railway health check pointed at `/` therefore does not hit the app's
  health logic.** Point it at **`/api/heartbeat`**, which upstream's own compose
  health check uses; it returns `{"ok":true,"version":…}` with
  `Cache-Control: no-store` and `dynamic = 'force-dynamic'`.
- Client IP resolution (`src/lib/ip.ts`) consults, in order: `true-client-ip`,
  `cf-connecting-ip`, `fastly-client-ip`, `do-connecting-ip`, `x-real-ip`,
  `x-appengine-user-ip`, `x-forwarded-for`, … Railway is not special-cased but
  `x-forwarded-for` is covered. Geolocation accuracy should be spot-checked
  (C-7); `CLIENT_IP_HEADER` is the override if it resolves wrongly.

CORS/CSP are set in `next.config.ts`: `/api/*` gets
`Access-Control-Allow-Origin: *`, and in production `/script.js` gets
`Access-Control-Allow-Origin: *` plus a 24-hour cache. Cross-origin tracking
from a reader's own site therefore needs no extra configuration.

### 3.8 Attribution worker — architectural finding

`package.json` defines `worker:attribution` →
`tsx scripts/talivia-attribution-worker.ts`. **It is referenced nowhere else:**
not in the `Dockerfile`, not in `docker-compose.yml`, not in `README.md`
(verified by full-tree search).

Reading the code:

- Attribution is computed **inline** on the Stripe webhook path
  (`src/app/api/payments/stripe/[websiteId]/webhook/route.ts`) and on
  checkout-return detection (`src/queries/prisma/attribution.ts`). So the happy
  path works without the worker.
- The worker exists to drain queued `attributionJob` rows: retry with backoff
  (`60, 300, 900, 3600, 10800` seconds by default, `MAX_ATTEMPTS` 5) and to
  rescue jobs stuck in `running` past a 30-minute heartbeat.

**Consequence for Railway:** with the official container alone, an attribution
job that fails or is queued is **never retried** — nothing runs the drain loop.
There is a manual retry endpoint
(`/api/websites/[websiteId]/revenue-attribution/retry`), so it is recoverable
by hand, not silently lost.

This is an operating constraint to record, and if P09 wants retries it means a
**second Railway service** off the same image with a different start command.
The first verification should deliberately **not** run the worker, so that the
constraint is documented as it stands (check C-9 records it as
`not_tested`/constraint rather than pretending it is covered).

---

## 4. Recommended configuration (proposal for P09)

Two Railway services, no volume on the app.

```text
Service: talivia            Service: PostgreSQL (Railway managed)
  source:  upstream repo      version: 17
  build:   Dockerfile         private networking only
  commit:  pinned SHA         no public TCP proxy
  no volume                   provides DATABASE_URL
```

| Setting | Value | Why |
| --- | --- | --- |
| Build | Dockerfile from the upstream repo, pinned to a commit | §2 route B; build needs no database (§3.2) |
| `DATABASE_URL` | Railway reference variable to the managed PostgreSQL, over the **private** network | Only required dependency; keeps the database off the public internet |
| `APP_SECRET` | `openssl rand -hex 32`, generated once, never rotated | §3.5 — rotation breaks saved provider credentials |
| `PORT` | **leave unset** | §3.3 — unverified `PORT` support; `EXPOSE 3000` is the safe path |
| Health check path | **`/api/heartbeat`** | §3.7 — `/` redirects to `/login` |
| Health check grace | generous on first boot | migrations run before the server starts (§3.2) |
| App volume | **none** | §3.4 — all state is in PostgreSQL |
| `CLICKHOUSE_URL` | unset | §3.6 — keeps the supported PostgreSQL-only path |
| `SKIP_DB_CHECK` / `SKIP_DB_MIGRATION` | **never set** | they disable the boot safety checks |
| Public domain | Railway-provided HTTPS domain is sufficient | §3.7 |
| Attribution worker | **not deployed** for the first verification | §3.8 — record the constraint honestly |

**Does Talivia need configuration maintained in this repository? No.** The
upstream Dockerfile is deployable on Railway as-is. The only Railway-specific
choices are service settings (health check path, leaving `PORT` unset,
private-network `DATABASE_URL`) — settings, not code. This keeps route C closed
and is the main design conclusion of P02.

---

## 5. Verification procedure (draft for P03 check definitions / P09 execution)

Proposed check ids and the exact expected result for each. **None have been
run.** Ids are a proposal for the `checks/` contract that P03 defines;
results belong on the product record, never in this note.

| id | Check | Procedure | Expected result | Required? |
| --- | --- | --- | --- | --- |
| C-1 | Build succeeds | Deploy the pinned commit from the upstream Dockerfile | Image builds; no database needed during build | required |
| C-2 | App binds and is reachable | Open the Railway-assigned HTTPS domain | Loads and redirects `/` → `/login`. **If the deploy hangs unhealthy, suspect `PORT` (§3.3, O-1)** | required |
| C-3 | Migrations applied on boot | Read deploy logs on first start | `check-env` and `check-db` pass; `prisma migrate deploy` applies `0001_oss_baseline`; PostgreSQL version check passes | required |
| C-4 | **Bootstrap credential changed** | Sign in `admin`/`admin`, immediately change the password under Settings → Account, sign out, confirm the old password fails | Old password rejected; new password works | **required — security** |
| C-5 | Website registration | Create a website in Talivia; copy its tracking snippet | Snippet issued with a `data-website-id`, pointing at the Railway domain | required |
| C-6 | **Test event end-to-end** | Install the snippet on a test page, load it, then watch the dashboard | The visit appears on the dashboard. Confirms tracker delivery, `/api/send` ingestion, and that `x-forwarded-host` resolved correctly (§3.7) | required |
| C-7 | Client IP / geolocation sanity | Check the resolved country/region on the test visit | Plausible for the test client; if wrong, `CLIENT_IP_HEADER` is the override (§3.7) | optional |
| C-8 | Session Replay | Enable Session Replay in website settings, generate a session, open the replay | Replay records and plays back; rows land in PostgreSQL (§3.4) | optional |
| C-9 | Revenue attribution | Connect a provider under Website settings → Payments, send a provider test webhook | Webhook URL reflects the **public** Railway domain; payment appears and attributes. **Record that no attribution worker is deployed (§3.8)** — queued/failed jobs are not retried | optional |
| C-10 | **Persistence across restart** | Note the visit count, restart the service from the Railway dashboard, sign in again | Data and the changed password survive; migrations are a no-op on the second boot | **required** |
| C-11 | Redeploy is a no-op | Redeploy the same commit | Comes up healthy; no duplicate migration, no data loss | required |
| C-12 | Health endpoint | `GET /api/heartbeat` | `{"ok":true,"version":…}` — the `version` pins the deployed artifact | required |

**Explicitly untested for the first verification** (state as `not_tested` with
these reasons, per the governance gate's item 5):

- Long-term PostgreSQL performance under sustained event volume — the review's
  central technical concern, and not answerable by a single deployment.
- ClickHouse backend (§3.6) — deliberately unset.
- Redis, Kafka, read replicas — deliberately unset.
- Attribution worker retry behaviour (§3.8) — not deployed.
- Cloud-only integrations — not in the OSS edition at all; `not_applicable`
  with that reason.
- Cost behaviour over time — a single deployment cannot establish it; belongs
  in a later dated note.

---

## 6. Open items

| id | Item | Why it is open | How to close |
| --- | --- | --- | --- |
| O-1 | Does the standalone server honour `PORT`? | Next.js docs and source unreachable from this environment; `node_modules` not installed | Empirically at P09 via C-2, with `PORT` left unset. Only investigate further if C-2 fails |
| O-2 | Who publishes the Railway template at `railway.com/deploy/talivia`? | `railway.com` egress-blocked here; upstream links no Railway route (§2) | The owner opens the template page and reads the publisher. If it is `talivia-group`, it becomes the official route and outranks route B |
| O-3 | Does Railway's edge set `x-forwarded-host` to the public domain? | Not verifiable without a live deployment | C-6 — the webhook URL shown in the UI is the tell |
| O-4 | Does `DATABASE_URL` over Railway's private network need an `sslmode` parameter? | Depends on the managed PostgreSQL's TLS posture | C-3 — the boot connection either succeeds or names the reason |
| O-5 | Upstream has no tagged release | `latest_release_tag: unknown`; the repository is ~6 weeks old | Pin the verification to a **commit SHA**, not a tag. Already assumed throughout |

Note that O-2 is the only one that can change the recommendation, and it can
only *upgrade* it — route B stays valid either way.

---

## 7. Handoff

**To P03 (catalog contract and validation CI)** — this note exercises these
record fields, which the schema needs room for:

- `upstream.commit` as the pinned verified version, with **no tag available**
  (O-5) — the schema must accept a commit SHA as the sole version identifier.
- `route.type` ∈ {official, community, maintained-here} **plus** a way to record
  *provenance unverified* — route A is a real state the contract must express,
  and collapsing it into "community" would overstate what is known.
- `dependencies`: exactly one required service (PostgreSQL ≥ 9.4, upstream
  exercises 17).
- `constraints`: OSS edition is a subset of the commercial product; no
  attribution worker in the official container; no migration path from hosted
  Talivia; single baseline migration.
- `checks`: C-1 … C-12 above, with C-4, C-10 and the C-1/2/3/5/6/11/12 set as
  required; `not_tested` and `not_applicable` both carry reasons.

**To P04 (Talivia preparation PR and verification issue)** — the recommended
configuration in §4 and the procedure in §5 are ready to become
`deployments/talivia/README.md` and the body of the verification issue. §4's
conclusion means **no Dockerfile or platform config is maintained here**, so
`deployments/talivia/` holds a guide only.

**To P09 (human verification)** — run §5 in order; C-4 immediately after the
first successful boot, before anything else. Close O-2 while in the Railway
dashboard.

---

## Sources

All read at the dates given; nothing here is second-hand except where marked.

- Upstream repository, commit `2d3ec339072723f4c7f0335e513aaadae3a31603`
  (2026-09-13): `LICENSE`, `README.md`, `Dockerfile`, `.dockerignore`,
  `docker-compose.yml`, `.env.example`, `package.json`, `next.config.ts`,
  `prisma/schema.prisma`, `prisma/migrations/0001_oss_baseline/migration.sql`,
  `scripts/check-env.js`, `scripts/check-db.js`, `scripts/start-env.js`,
  `scripts/talivia-attribution-worker.ts`, `src/lib/get-base-url.ts`,
  `src/lib/ip.ts`, `src/lib/clickhouse.ts`, `src/app/api/heartbeat/route.ts`,
  `src/tracker/index.js`, `.github/workflows/ci.yml` — read 2026-09-14.
- JuryPress review record `talivia-group-talivia-acfdc1` and its publication
  state — read 2026-09-14.
- `https://railway.com/deploy/talivia` — **not read directly** (egress-blocked);
  existence and indexed description via web search only, 2026-09-14. See O-2.
- `https://github.com/railwayapp/templates` — read 2026-09-14; confirms template
  definitions no longer live in that repository.
