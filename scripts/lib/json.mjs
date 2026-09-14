/**
 * Safe JSON reading.
 *
 * Catalog documents are data. They are parsed, never evaluated: nothing in this
 * repository imports a record, a schema or a Markdown file as code, and nothing
 * interpolates a record into a shell or a template that executes. The one
 * remaining way a JSON document can reach into a program is by carrying a key
 * that mutates the prototype chain of the object it is parsed into, so that key
 * is refused here rather than silently dropped.
 */

import { readFile } from 'node:fs/promises';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

class JsonLoadError extends Error {
  constructor(file, message) {
    super(`${file}: ${message}`);
    this.name = 'JsonLoadError';
    this.file = file;
  }
}

/**
 * Parse JSON, refusing keys that would touch the prototype chain.
 *
 * @param {string} text raw file contents
 * @param {string} file path used in error messages
 * @returns {unknown}
 */
export function parseJson(text, file = '<string>') {
  let parsed;
  try {
    parsed = JSON.parse(text, function reviver(key, value) {
      if (FORBIDDEN_KEYS.has(key)) {
        throw new JsonLoadError(file, `refusing document: forbidden key ${JSON.stringify(key)}`);
      }
      return value;
    });
  } catch (error) {
    if (error instanceof JsonLoadError) throw error;
    throw new JsonLoadError(file, `not valid JSON (${error.message})`);
  }
  return parsed;
}

/**
 * Read and parse a JSON file.
 *
 * @param {string} file absolute path
 * @param {string} label path used in error messages, usually repository-relative
 */
export async function readJson(file, label = file) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    throw new JsonLoadError(label, `cannot be read (${error.code ?? error.message})`);
  }
  return parseJson(text, label);
}

/**
 * Deterministic serialization: object keys sorted, no insignificant whitespace.
 * Used for digests, where the same content must always produce the same bytes.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).sort();
  const body = keys
    .filter((key) => value[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(',');
  return `{${body}}`;
}

export { JsonLoadError };
