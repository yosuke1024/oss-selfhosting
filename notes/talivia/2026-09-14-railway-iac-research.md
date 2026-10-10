# Talivia — Railway Infrastructure as Code: feasibility and shape

**Date:** 2026-09-14 · **Stage:** P05 (configuration authored, nothing applied) · **Author:** Claude Code

A dated snapshot, like its companion
[`2026-09-14-railway-route-research.md`](2026-09-14-railway-route-research.md).
It records what was checked against a real Railway CLI and a real Railway SDK on
this machine, and what remains unverified. **No Railway project was created, no
plan was run against a live environment, and nothing was applied or published.**
The CLI was not authenticated during this work, by design.

This note exists because P02 concluded the opposite of what P05 does, and the
reversal should be legible rather than silent.

---

## 1. What P02 concluded, and why this supersedes it

P02 §3.7 ended:

> **Does Talivia need configuration maintained in this repository? No.** The
> upstream Dockerfile is deployable on Railway as-is. The only Railway-specific
> choices are service settings (health check path, leaving `PORT` unset,
> private-network `DATABASE_URL`) — settings, not code.

That was correct about the facts and reached a different conclusion because of
what "settings, not code" implied at the time: settings live in a dashboard, are
typed in by hand, and cannot be reviewed, diffed or pinned.

Railway's Infrastructure as Code removes that distinction. The same settings are
expressible as a file, and once they are a file they are reviewable, they are
covered by the configuration digest, and a verification can be bound to the
exact configuration it was performed against. The facts did not change; the
available mechanism did.

The record therefore moves from `template_type: official` to
`maintained_here`, with `maintained_path` at `deployments/talivia/.railway`.

Note what this does **not** change: no official Railway template exists, the one
community template stays rejected for the reasons in P02 §2, and the deployed
artifact is still upstream's own Dockerfile at a pinned commit. The route is
unchanged. Only its expression is.

---

## 2. Does the tooling exist? Yes — both commands are real

Checked against the CLI installed on this machine.

```text
railway 5.54.1
```

| Command | Exists | Subcommands |
| --- | --- | --- |
| `railway config` | yes | `plan`, `apply`, `init`, `pull`, `migrate` |
| `railway templates` | yes | `search`, `list`, `create`, `publish`, `unpublish`, `delete` |

`railway config --help` describes itself as "Define, import, preview, and apply
your Railway project from `.railway/railway.ts` (or `.py` / `.go`)". The
authoring file path, the TypeScript DSL and the `plan` → `apply` workflow are
all as assumed.

`railway config plan` accepts `--file <FILE>`, documented as "Path to the Railway
configuration file. Defaults to nearest `.railway/railway.{ts,py,go}`". A
non-default location is therefore supported, which is what lets the file live
under `deployments/talivia/` instead of the repository root.

Railway's own docs state Config as Code (`railway.json` / `railway.toml`) is
**deprecated**, with a hard cutoff of **2026-12-01**, and that IaC is its
replacement. Authoring the new format rather than the deprecated one is the
right side of that date.

### 2.1 Not authenticated — expected, and worth stating

```text
$ railway whoami
Unauthorized. Please login with `railway login`

$ railway config plan --file .railway/railway.ts
Not authenticated. Run `railway login`, set RAILWAY_API_TOKEN, or set RAILWAY_TOKEN.
```

`plan` needs a session and a linked project. Everything below was therefore
established without it.

---

## 3. The correction: there is no `template.yaml`

The P05 plan assumed a `template.yaml` could be committed alongside the IaC file
to define a Railway template. **It cannot. No such format exists.**

- `template.yaml`, `template.json` and "template schema" have **zero**
  occurrences across Railway's full documentation export (56,614 lines).
- `railway templates create --help` states verbatim: *"This matches the
  dashboard Generate Template action: it clones a project into an unpublished
  template draft."* Its only inputs are `--project` and `--environment`.
- Templates and Infrastructure as Code are never mentioned together anywhere in
  the documentation. There is no documented conversion in either direction.

A Railway template is generated **from a live project**, never authored as a
file in a repository. So the pipeline, if a template is ever wanted, is:

```text
railway.ts  →  config apply  →  a live project  →  templates create  →  draft
                                                                        ↓
                                                       templates publish (not run)
```

The file in this repository is the *first* box. Nothing downstream of `apply`
has been done, and `templates publish` is out of scope until explicitly asked
for — it is an outward-facing act that enters Railway's Template Kickback
programme (15% of users' usage cost, 25% with the support bonus), which is a
decision about publishing and revenue, not about configuration.

**No `template.yaml` was written, because writing one would be inventing a
format Railway does not read.**

---

## 4. The API, established from the SDK rather than the docs

The published reference is thinner than the shipped type surface. Where they
disagreed, the SDK's own `.d.ts` was treated as authoritative and the difference
is recorded. The npm package is `railway` (`npm install railway`, imported as
`railway/iac`); version installed for this check: **3.11.0**.

Exports actually present in `railway/iac`:

```text
defineRailway  define  project  service  fn
github  image  template  empty
postgres  mysql  redis  mongo  database
volume  bucket  group
ref  preserve
createRailwayContext  resourceAddress  indexGraph  validateGraph
```

Documented but incomplete: the reference shows only `branch` and
`rootDirectory` for `github()`, and never mentions `database()`, `fn()`,
`template()`, `ref()` or restart policy at all.

### 4.1 `commitSha` — present in the SDK, absent from the docs

`ServiceSource` carries:

```ts
type ServiceSource = {
  image?: string | null;
  repo?: string | null;
  branch?: string | null;
  commitSha?: string | null;
  upstreamUrl?: string | null;
  rootDirectory?: string | null;
  checkSuites?: boolean | null;
  autoUpdates?: { … } | null;
};
```

`github()` spreads its options into the source node, so
`github(repo, { commitSha })` type-checks and the value reaches the compiled
graph (verified — §6). **Whether the Railway backend honours it on apply is
unverified and cannot be verified without applying.** This is the single most
important thing to read in the first `plan` output: pinning by commit is the
whole reason the route was chosen over the community template, and if Railway
silently tracks the branch head instead, that has to be recorded, not assumed
away.

### 4.2 There is no secret generator — and the thing that looks like one is a trap

No `secret()`, `generate()` or required-input helper exists. The only relevant
helper is `preserve()`, which keeps whatever value the environment already holds.

`RailwayContext` exposes `randomString(label?, bytes?)`, which reads like the
answer and is not:

```js
randomString: (label = "random", bytes = 12) =>
  createHash("sha256")
    .update(`railway-iac:${environment ?? "default"}:${label}`)
    .digest("hex").slice(0, bytes * 2)
```

It is a SHA-256 of a public string with **no seed and no entropy**. Same
environment and label always produce the same value:

```text
production / app-secret  →  cc5de193a6621901679e6c67
production / app-secret  →  cc5de193a6621901679e6c67   (again)
```

In a public repository the label is public, the environment name is public, and
therefore the value is public. Using it for `APP_SECRET` — which signs sessions
*and encrypts stored payment-provider credentials* — would publish the secret
while appearing to generate one. It is a deterministic placeholder generator,
useful for non-secret uniqueness, and it is documented nowhere, so nothing warns
a reader about this.

`APP_SECRET` therefore uses `preserve()` and is set by the operator out of band,
before the first apply. Recorded as **O-5** (§7).

### 4.3 Generated domains are not expressible, and `domains` is the wrong key

The reference states plainly: *"Generated Railway service domains are not
included in `.railway/railway.ts`."*

`domains` declares **custom** domains, and the compiler defaults their target
port to **8080**:

```js
customDomains = config.domains.map(d =>
  typeof d === "string" ? [d, { port: 8080 }] : [d.domain, { port: d.port ?? 8080 }])
```

Talivia listens on 3000. Declaring a domain here would therefore point the edge
at a port nothing is listening on. The file declares no domain; the operator
runs `railway domain --port 3000`, and `--port` is a real flag on that command.

### 4.4 `postgres()` resolves to PostgreSQL 18

`postgres()` takes only `{ region }` — no version option. It compiles to
`ghcr.io/railwayapp-templates/postgres-ssl:18`. Upstream enforces a minimum of
9.4.0 at boot and exercises **17** in its compose file and CI, so 18 clears the
minimum but is a version upstream does not itself test. Recorded as **O-6**.

The image name (`postgres-ssl`) is also the most concrete hint yet on the open
`sslmode` question (P02 O-4), but a hint is not an answer and no `sslmode`
parameter was guessed into the configuration.

---

## 5. The PORT correction

P02 §3.7 recommended **leaving `PORT` unset**. The configuration sets
`PORT=3000` instead. The facts behind P02's recommendation all hold; what it did
not account for is how Railway chooses the port it health-checks.

Railway's health check documentation:

> Railway will inject a `PORT` environment variable that your application should
> listen on. **This variable's value is also used when performing health checks
> on your deployments.** If your application doesn't listen on the `PORT`
> variable […] you can manually set a `PORT` variable to inform Railway of the
> port to use for health checks.
>
> Not listening on the `PORT` variable or omitting it when using target ports
> can result in your health check returning a `service unavailable` error.

So `PORT` is not something that can be "left unset" — Railway injects it. The
real choice is whether its value matches the port the container binds.

P02 established that `process.env.PORT` appears nowhere in upstream's tree,
that the Dockerfile declares `EXPOSE 3000`, and that `scripts/start-env.js`
hardcodes 3000. Against the two possible answers to O-1:

| | server honours `PORT` | server ignores `PORT` |
| --- | --- | --- |
| **unset** | binds injected port; health check matches ✓ | binds 3000; health check probes injected port ✗ |
| **`3000`** | binds 3000; health check probes 3000 ✓ | binds 3000; health check probes 3000 ✓ |

`PORT=3000` is correct under **both** answers, and unset is correct under only
one. It is the safer configuration, and it is why the guide's "leave `PORT`
unset" instruction changed.

This is still a reasoned choice, not an observation. It is unverified until a
deployment is healthy (check C-2), and the guide says so.

---

## 6. What was actually verified on this machine

Not a deployment — but more than reading. The authored file was compiled against
the real SDK.

| What | How | Result |
| --- | --- | --- |
| The file type-checks | `tsc --noEmit --strict` against `railway@3.11.0` | **passes**, exit 0 |
| `commitSha` survives compilation | executed the program, dumped the graph | present in `source` |
| `APP_SECRET` carries no value | same | `{ "type": "preserve" }` |
| `DATABASE_URL` is a reference, not a literal | same | `{ "type": "reference", "resource": "database.postgres", "output": "DATABASE_URL" }` |
| No domain is declared | same | no `networking` key emitted |
| Health check lands where intended | same | `deploy.healthcheckPath: "/api/heartbeat"` |
| `postgres()` version | same | `ghcr.io/railwayapp-templates/postgres-ssl:18` |

The compiled graph:

```json
{
  "name": "talivia",
  "resources": [
    { "address": "database.postgres", "type": "database", "engine": "postgres",
      "image": "ghcr.io/railwayapp-templates/postgres-ssl:18" },
    { "address": "service.talivia", "type": "service", "kind": "github",
      "source": { "type": "github", "repo": "talivia-group/talivia",
                  "branch": "main",
                  "commitSha": "2d3ec339072723f4c7f0335e513aaadae3a31603" },
      "build": { "builder": "DOCKERFILE" },
      "deploy": { "healthcheckPath": "/api/heartbeat", "healthcheckTimeout": 300 },
      "variables": {
        "DATABASE_URL": { "type": "reference", "resource": "database.postgres",
                          "output": "DATABASE_URL" },
        "APP_SECRET": { "type": "preserve" },
        "PORT": { "type": "literal", "value": "3000" } } }
  ]
}
```

The SDK's bundled `railway-iac-ts` runner refuses to act on its own — *"The IaC
engine now ships in the CLI, not the TypeScript SDK"* — so `plan` against a live
environment is the next real test, and it is the operator's to run.

This check needs `npm install railway` and is **not** part of this repository's
CI, which installs nothing and stays dependency-free. Reproducing it means an
install in a scratch directory; that is a deliberate trade, not an oversight.

---

## 7. Open items

Carried forward from P02: **O-1** (does the standalone server honour `PORT`),
**O-3** (forwarded host), **O-4** (`sslmode` on the private network).

| id | Question | Settled by |
| --- | --- | --- |
| O-5 | Does `preserve()` on a never-set `APP_SECRET` leave it unset, failing `check-env.js` at boot? Expected yes, hence "set it before the first apply". | The first `plan`/`apply`, then the boot logs |
| O-6 | Does Talivia run correctly on PostgreSQL 18, which upstream does not test? | Check C-3 on the first boot |
| O-7 | Does Railway honour `source.commitSha` on apply, or does it track the branch head? | The first `plan` output |
| O-8 | Does `project("talivia", …)` rename a linked project that has a different name? | The first `plan` output |

None of these are defects, and none are answerable from a keyboard without a
Railway account. They are the reason the record still carries no verification
block.
