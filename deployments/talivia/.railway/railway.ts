/**
 * Talivia on Railway — Infrastructure as Code.
 *
 * This is the deployment configuration this repository maintains for Talivia.
 * It is the digest input for `deployment.maintained_path` in
 * `catalog/projects/talivia.json`: change anything in this file and the
 * configuration digest changes, which is exactly the moment a verification
 * recorded against the old digest stops counting.
 *
 * It is applied by the reader, on the reader's own Railway account, with the
 * reader's own credentials:
 *
 *     railway config plan  --file deployments/talivia/.railway/railway.ts
 *     railway config apply --file deployments/talivia/.railway/railway.ts
 *
 * Nothing in this repository applies it. See ../README.md for the full
 * procedure, including the two things this file deliberately does not carry:
 * `APP_SECRET`, and the public domain.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS ESTABLISHED, AND WHAT IS NOT
 *
 * Every value below is traceable to upstream's source at the pinned commit, to
 * Railway's own documentation, or to the Railway TypeScript SDK's types — see
 * the comment on each. None of it has been applied to a live Railway project.
 * `railway config plan` is the first thing that tests any of it, and a healthy
 * deployment is the first thing that tests the runtime values. Until then the
 * product record carries no verification block, and that is correct.
 *
 * Open items this file cannot settle, tracked in
 * ../../../notes/talivia/2026-09-14-railway-route-research.md §6:
 *
 *   O-1  Whether the Next.js standalone server honours PORT. See the PORT note.
 *   O-4  Whether DATABASE_URL over the private network needs an sslmode
 *        parameter. Deliberately not guessed here — the boot connection either
 *        succeeds or names the reason, and that answer belongs in the record.
 * ---------------------------------------------------------------------------
 */

import { defineRailway, github, postgres, preserve, project, service } from "railway/iac";

/**
 * Upstream ships no tagged releases, so the deployment is pinned by commit.
 * This is the commit the published review was generated against and the commit
 * any verification of this configuration must name.
 */
const UPSTREAM_REPO = "talivia-group/talivia";
const UPSTREAM_BRANCH = "main";
const UPSTREAM_COMMIT = "2d3ec339072723f4c7f0335e513aaadae3a31603";

export default defineRailway(() => {
  /**
   * Railway's managed PostgreSQL. Upstream enforces a minimum of 9.4.0 at boot
   * and exercises 17 in its own compose file and CI; Railway's `postgres()`
   * currently resolves to `ghcr.io/railwayapp-templates/postgres-ssl:18`, which
   * clears the minimum but is a version upstream does not itself test. The
   * image is Railway's choice, not ours — `postgres()` takes no version option.
   *
   * Managed PostgreSQL is used deliberately rather than a self-run container:
   * a self-run `postgres` image on Railway needs PGDATA pointed at a
   * subdirectory of the volume mount, because the mount root is not empty.
   *
   * No public TCP proxy is declared, so the database stays on the private
   * network.
   */
  const db = postgres("postgres");

  const app = service("talivia", {
    /**
     * Route B from the P02 research: build upstream's own Dockerfile straight
     * from the upstream repository. No third-party template and no image this
     * repository builds or hosts.
     *
     * `commitSha` is present in the SDK's `ServiceSource` type and survives
     * compilation into the graph, but it is NOT in Railway's published IaC
     * documentation, which shows only `branch` and `rootDirectory`. Whether the
     * Railway backend honours it on apply is therefore unverified: the `plan`
     * output is the first place that shows, and it is the first thing to read
     * there. If it is not honoured, the deployment tracks the branch head
     * instead of the reviewed commit, and that must be recorded rather than
     * papered over — a verification that cannot name the deployed commit is not
     * a verification.
     */
    source: github(UPSTREAM_REPO, {
      branch: UPSTREAM_BRANCH,
      commitSha: UPSTREAM_COMMIT,
    }),

    /**
     * Upstream's Dockerfile is the supported build. Its builder stage supplies
     * its own dummy DATABASE_URL, so the build needs no database linkage.
     */
    build: { builder: "DOCKERFILE" },

    /**
     * `/` redirects to `/login`, so a health check pointed at the root never
     * reaches the application's health logic. `/api/heartbeat` is the endpoint
     * upstream's own compose health check uses; it returns
     * `{"ok":true,"version":…}`, and that `version` is what pins a running
     * deployment to a built artifact.
     *
     * The timeout is Railway's documented default, stated explicitly because
     * migrations run before the server starts: `check-db.js` runs
     * `prisma migrate deploy` on every boot, so first boot is the slow one. If
     * a first deployment times out here while the logs show migrations still
     * running, this is the number to raise.
     */
    healthcheck: "/api/heartbeat",
    healthcheckTimeout: 300,

    env: {
      /**
       * A reference to the managed PostgreSQL over the private network, not a
       * literal. Railway resolves it at deploy time, so no connection string is
       * ever written to this repository.
       */
      DATABASE_URL: db.env.DATABASE_URL,

      /**
       * APP_SECRET is NOT set here, and must never be.
       *
       * It signs sessions and encrypts stored payment-provider credentials.
       * `preserve()` tells Railway to keep whatever value the environment
       * already holds and leaves this file with no secret in it — so a plan or
       * an apply run from this repository can neither set it nor print it.
       *
       * The operator sets it once, out of band, BEFORE the first apply:
       *
       *     railway variables --set "APP_SECRET=$(openssl rand -hex 32)"
       *
       * Two things make this the only safe shape:
       *
       *   - The container refuses to boot without it. `scripts/check-env.js`
       *     exits 1 if APP_SECRET is missing, shorter than 32 bytes, or still
       *     equal to upstream's placeholder. `preserve()` on a variable that
       *     was never set leaves it unset, so setting it first is a real
       *     ordering requirement, not a style preference.
       *   - Rotating it invalidates every session and leaves saved provider
       *     credentials undecryptable. It is generated once and kept for the
       *     life of the deployment.
       *
       * The SDK's `ctx.randomString()` looks like it would solve this and must
       * not be used for it: it is a plain SHA-256 of
       * `railway-iac:<environment>:<label>` with no seed, so it is fully
       * predictable from a label committed to a public repository. It is a
       * deterministic placeholder generator, not a source of secrets.
       */
      APP_SECRET: preserve(),

      /**
       * PORT is set explicitly to the port upstream's container actually binds.
       * This departs from the P02 note, which recommended leaving it unset; the
       * note did not account for how Railway health checks choose their port,
       * and setting it is the safer of the two options.
       *
       * Railway injects PORT and — per its health check documentation — uses
       * that same value as the port it health-checks. `process.env.PORT` does
       * not appear anywhere in upstream's tree, while the Dockerfile declares
       * `EXPOSE 3000` and `scripts/start-env.js` hardcodes 3000. So:
       *
       *   - unset: Railway injects some value. If the standalone server ignores
       *     it, the app binds 3000, the health check probes the injected port,
       *     and the deploy fails as `service unavailable` with no obvious cause.
       *   - 3000:  if the server honours PORT it binds 3000; if it ignores PORT
       *     it binds 3000 anyway. The health check probes 3000 either way.
       *
       * Setting it to 3000 is correct under both answers to O-1, which is why
       * it is here. It is still unverified until a deployment is healthy.
       */
      PORT: "3000",
    },

    /**
     * No volume. All state, including session replays, is in PostgreSQL;
     * preparation found no local filesystem writes in the application.
     *
     * No `domains` entry either. Railway's generated service domains are not
     * represented in an IaC file — the reference says so explicitly — and the
     * `domains` key here would declare a CUSTOM domain, defaulting to target
     * port 8080, which is not the port this container listens on. The public
     * domain is created out of band, with its target port stated:
     *
     *     railway domain --port 3000
     */
  });

  return project("talivia", {
    resources: [db, app],
  });
});
