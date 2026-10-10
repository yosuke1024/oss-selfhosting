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
 * WHAT THIS FILE CAN AND CANNOT FIX
 *
 * It fixes settings: the source branch, the health check, the database
 * reference and the port. It cannot fix the commit. Railway deploys the head
 * of the branch at the moment of apply — its API has no commit on a service
 * source, so a commit written here is ignored (observed 2026-10-10: the file
 * declared one commit, the deployment built a newer head). The commit a
 * deployment actually built is read afterwards from Railway:
 *
 *     railway deployment list --service talivia --json   → meta.commitHash
 *
 * and that, together with meta.imageDigest, is what a verification names.
 *
 * The maintainer applied this file once, on 2026-10-10, on their own account:
 * the service came up healthy and passed the smoke check. That is evidence,
 * not a verification; the checks a person performs are listed in
 * ../README.md and ../../../checks/checks.json, and until they are done the
 * product record carries no verification block.
 *
 * Open items that cannot be settled from this file are tracked in
 * ../../../notes/talivia/2026-10-10-railway-first-apply.md.
 * ---------------------------------------------------------------------------
 */

import { defineRailway, github, postgres, preserve, project, service } from "railway/iac";

/**
 * Upstream ships no tagged releases. The branch is the only ref Railway will
 * follow from this file; the commit it resolves to is recorded per deployment
 * (see the header), never here.
 */
const UPSTREAM_REPO = "talivia-group/talivia";
const UPSTREAM_BRANCH = "main";

export default defineRailway(() => {
  /**
   * Railway's managed PostgreSQL. Upstream enforces a minimum of 9.4.0 at boot
   * and exercises 17 in its own compose file and CI; Railway's `postgres()`
   * resolves to `ghcr.io/railwayapp-templates/postgres-ssl:18` (observed on
   * apply), which clears the minimum but is a version upstream does not itself
   * test. On 2026-10-10 the application connected, passed its own version
   * check and applied its migrations against it. The image is Railway's
   * choice, not ours — `postgres()` takes no version option.
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
     * Two things are deliberately NOT here, because Railway does not honour
     * them and a field that does nothing misleads:
     *
     *   - `commitSha`. The SDK's `ServiceSource` type has it; the backend
     *     ignores it (see the header). The branch head at apply time is what
     *     you get.
     *   - `build: { builder: "DOCKERFILE" }`. Railway's `Builder` enum is
     *     HEROKU | NIXPACKS | PAKETO | RAILPACK — there is no DOCKERFILE value.
     *     Upstream's Dockerfile is used because Railway detects it at the
     *     repository root (observed: the deployment manifest resolved to
     *     builder DOCKERFILE, dockerfilePath /Dockerfile, and the build log
     *     shows upstream's deps → builder → runner stages). Detection is the
     *     mechanism; the field is not.
     */
    source: github(UPSTREAM_REPO, { branch: UPSTREAM_BRANCH }),

    /**
     * `/` redirects to `/login`, so a health check pointed at the root never
     * reaches the application's health logic. `/api/heartbeat` is the endpoint
     * upstream's own compose health check uses; it returns
     * `{"ok":true,"version":…}`. Note that `version` is "local" on Railway —
     * the Dockerfile's BUILD_VERSION build arg is not supplied — so it does
     * not identify the artifact. The deployment's imageDigest does.
     *
     * The timeout is Railway's documented default, stated explicitly because
     * migrations run before the server starts: `check-db.js` runs
     * `prisma migrate deploy` on every boot, so first boot is the slow one.
     * Observed 2026-10-10: three migrations and a healthy service well inside
     * the window.
     */
    healthcheck: "/api/heartbeat",
    healthcheckTimeout: 300,

    env: {
      /**
       * A reference to the managed PostgreSQL over the private network, not a
       * literal. Railway resolves it at deploy time, so no connection string is
       * ever written to this repository. Observed: resolves to
       * postgres.railway.internal:5432, and the application connected without
       * any sslmode parameter.
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
       * The operator sets it once, out of band, right after the first apply:
       *
       *     openssl rand -hex 32 | railway variable set APP_SECRET --stdin --service talivia --skip-deploys
       *
       * Railway reads variables when the container starts, not when the
       * deployment is created (observed 2026-10-10: set during the first build,
       * present at first boot). So set it while the first build is running —
       * builds take a few minutes — and the first boot passes `check-env.js`.
       * If the container starts first, `check-env.js` exits 1 because
       * APP_SECRET is missing, shorter than 32 bytes, or still upstream's
       * placeholder; setting the variable then (without --skip-deploys)
       * triggers the redeploy. Either way, fail-fast is upstream's design
       * working, not a fault here.
       *
       * Rotating it invalidates every session and leaves saved provider
       * credentials undecryptable. It is generated once and kept for the
       * life of the deployment.
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
       * Observed 2026-10-10: the server reported 0.0.0.0:3000 and the health
       * check passed. Whether it honours an injected PORT is still unknown and,
       * under this configuration, does not matter.
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
     *     railway domain --port 3000 --service talivia
     *
     * which yields a `https://<service>-<environment>.up.railway.app` address.
     */
  });

  return project("talivia", {
    resources: [db, app],
  });
});
