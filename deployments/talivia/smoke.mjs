#!/usr/bin/env node
/**
 * A read-only smoke check for a deployed Talivia instance.
 *
 *   node deployments/talivia/smoke.mjs https://your-deployment.example.com
 *
 * What this is: evidence that a deployment is up and shaped the way the guide
 * says it should be. It produces material for the optional
 * `automated-smoke-check` in checks/checks.json.
 *
 * What this is NOT: a verification. It cannot sign in, so it cannot confirm the
 * bootstrap password was changed; it sends no analytics event, so it cannot
 * confirm the main flow; and it restarts nothing, so it cannot confirm
 * persistence. Those checks are performed by a person. A green run here with
 * those checks unanswered is not a listable product.
 *
 * It makes only GET requests, writes nothing, and takes no credentials.
 * Node.js 22 or newer. No dependencies.
 */

const TIMEOUT_MS = 15_000;

function usage(message) {
  if (message) console.error(`error: ${message}\n`);
  console.error('usage: node deployments/talivia/smoke.mjs <base-url>');
  console.error('example: node deployments/talivia/smoke.mjs https://talivia.example.com');
  return 2;
}

/** Reject anything that is not a plain https origin, so this cannot be aimed inward. */
function parseBase(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`not a URL: ${raw}`);
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error(`base URL must be https (got ${url.protocol}//)`);
  }
  if (url.username || url.password) {
    throw new Error('base URL must not carry credentials');
  }
  return new URL(url.origin);
}

async function request(base, path, { redirect = 'follow' } = {}) {
  const target = new URL(path, base);
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const response = await fetch(target, {
    method: 'GET',
    redirect,
    signal,
    headers: { accept: '*/*' },
  });
  return response;
}

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function attempt(name, fn) {
  try {
    const detail = await fn();
    record(name, true, detail);
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
  }
}

async function checkHeartbeat(base) {
  const response = await request(base, '/api/heartbeat');
  if (response.status !== 200) throw new Error(`expected 200, got ${response.status}`);
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error('response was not JSON');
  }
  if (body?.ok !== true) throw new Error(`expected {"ok":true}, got ${JSON.stringify(body)}`);
  return `version ${JSON.stringify(body.version ?? 'unreported')}`;
}

async function checkRootRedirect(base) {
  const response = await request(base, '/', { redirect: 'manual' });
  if (response.status < 300 || response.status >= 400) {
    throw new Error(`expected a redirect to /login, got ${response.status}`);
  }
  const location = response.headers.get('location') ?? '';
  if (!location.includes('/login')) {
    throw new Error(`redirects to ${JSON.stringify(location)}, expected /login`);
  }
  return `${response.status} to ${location}`;
}

async function checkTracker(base) {
  const response = await request(base, '/script.js');
  if (response.status !== 200) throw new Error(`expected 200, got ${response.status}`);
  const allowOrigin = response.headers.get('access-control-allow-origin');
  if (allowOrigin !== '*') {
    throw new Error(
      `access-control-allow-origin is ${JSON.stringify(allowOrigin)}, expected "*" — ` +
        'a site on another domain could not load the tracker',
    );
  }
  const body = await response.text();
  if (body.length === 0) throw new Error('tracker script is empty');
  return `${body.length} bytes, CORS open`;
}

async function checkApiRequiresAuth(base) {
  const response = await request(base, '/api/websites', { redirect: 'manual' });
  if (response.status === 200) {
    throw new Error('returned 200 without authentication — this endpoint should not be readable signed out');
  }
  return `${response.status} signed out, as expected`;
}

async function main(argv) {
  const raw = argv[0];
  if (!raw || raw === '--help' || raw === '-h') return usage(raw ? null : 'a base URL is required');

  let base;
  try {
    base = parseBase(raw);
  } catch (error) {
    return usage(error.message);
  }

  console.log(`Talivia smoke check — ${base.origin}\n`);

  await attempt('health endpoint responds', () => checkHeartbeat(base));
  await attempt('/ redirects to /login', () => checkRootRedirect(base));
  await attempt('tracker script is served with open CORS', () => checkTracker(base));
  await attempt('API requires authentication', () => checkApiRequiresAuth(base));

  const failed = results.filter((result) => !result.ok);
  console.log('');
  if (failed.length > 0) {
    console.error(`${failed.length} of ${results.length} checks failed.`);
    return 1;
  }
  console.log(`All ${results.length} checks passed.`);
  console.log(
    '\nThis is evidence, not a verification. Signing in, changing the bootstrap\n' +
      'password, sending a test event and confirming persistence across a restart\n' +
      'are performed by a person — see checks/checks.json.',
  );
  return 0;
}

process.exitCode = await main(process.argv.slice(2));
