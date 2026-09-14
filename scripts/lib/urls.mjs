/**
 * URL and path safety.
 *
 * Every URL in this catalog is rendered as a link a reader is invited to
 * follow, and several become a "deploy this" button. A URL field is therefore
 * an untrusted input even when a person typed it, and the rules below are the
 * ones that hold regardless of who wrote the record.
 */

/** Hosts that may carry a JuryPress review URL. */
export const REVIEW_HOSTS = ['pixapps.ai'];

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const CONTROL_OR_SPACE = /[\s\u0000-\u001F\u007F]/u;
const LOOPBACK_NAMES = new Set(['localhost', 'localhost.localdomain']);
const NON_PUBLIC_SUFFIXES = ['.local', '.internal', '.localhost', '.home.arpa', '.test', '.invalid'];

/**
 * @param {string} value
 * @returns {string | null} a reason the URL is unsafe, or null when it is fine
 */
export function urlProblem(value) {
  if (typeof value !== 'string' || value.length === 0) return 'is not a string';
  if (CONTROL_OR_SPACE.test(value)) return 'contains whitespace or control characters';

  let url;
  try {
    url = new URL(value);
  } catch {
    return 'is not a parseable absolute URL';
  }

  // https only. http is downgradeable in transit; javascript:, data:, file: and
  // friends are not addresses at all and must never reach a rendered link.
  if (url.protocol !== 'https:') return `uses the ${url.protocol} scheme; only https is allowed`;
  if (url.username !== '' || url.password !== '') return 'embeds credentials';

  const host = url.hostname.toLowerCase();
  if (host === '') return 'has no host';
  if (LOOPBACK_NAMES.has(host)) return 'points at the loopback host';
  if (host.startsWith('[') || host.includes(':')) return 'uses an IPv6 literal host';
  if (IPV4.test(host)) return 'uses an IP-literal host';
  if (!host.includes('.')) return 'uses a single-label host that is not publicly resolvable';
  if (NON_PUBLIC_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return 'points at a host that only resolves on a private network';
  }
  return null;
}

/**
 * @param {string} value
 * @param {string[]} hosts allowed hosts, exact match or a subdomain of one
 */
export function hostAllowed(value, hosts) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  return hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/**
 * @param {string} value
 * @returns {string | null} a reason the path is unsafe, or null when it is fine
 */
export function repoPathProblem(value) {
  if (typeof value !== 'string' || value.length === 0) return 'is not a string';
  if (value.startsWith('/')) return 'is absolute; paths are relative to the repository root';
  if (/^[A-Za-z]:/.test(value)) return 'is an absolute Windows path';
  if (value.includes('\\')) return 'uses backslashes; use forward slashes';
  if (value.split('/').includes('..')) return 'escapes the repository root with ".."';
  if (value.includes('//')) return 'contains an empty path segment';
  if (CONTROL_OR_SPACE.test(value)) return 'contains whitespace or control characters';
  return null;
}
