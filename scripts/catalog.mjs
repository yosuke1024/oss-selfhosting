#!/usr/bin/env node
/**
 * The catalog CLI.
 *
 *   node scripts/catalog.mjs validate            check every record, bundle and check definition
 *   node scripts/catalog.mjs index --check       fail if README.md disagrees with the records
 *   node scripts/catalog.mjs index --write       regenerate the README index from the records
 *   node scripts/catalog.mjs digest <slug>       print the deployment configuration digest
 *   node scripts/catalog.mjs contract --check    fail if schemas/contract.json is stale
 *   node scripts/catalog.mjs contract --write    regenerate schemas/contract.json
 *
 * Runs with no arguments beyond these, no credentials, and no network. Whatever
 * CI reports, a contributor can reproduce with the same command.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTRACT_FILE, buildManifest } from './lib/contract.mjs';
import { computeConfigDigest, isConfigFile } from './lib/digest.mjs';
import { loadCatalog } from './lib/loader.mjs';
import { applyIndex, renderIndex } from './lib/index-render.mjs';
import { validateLoadedCatalog } from './lib/validate.mjs';

const DEFAULT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

function parseArgs(argv) {
  const args = { command: argv[0], flags: new Set(), positional: [], root: DEFAULT_ROOT };
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      args.root = resolve(argv[i + 1] ?? '.');
      i += 1;
    } else if (arg.startsWith('--')) {
      args.flags.add(arg.slice(2));
    } else {
      args.positional.push(arg);
    }
  }
  return args;
}

function printFindings(title, findings) {
  if (findings.length === 0) return;
  console.error(`\n${title}`);
  const byFile = new Map();
  for (const finding of findings) {
    if (!byFile.has(finding.file)) byFile.set(finding.file, []);
    byFile.get(finding.file).push(finding);
  }
  for (const [file, list] of [...byFile.entries()].sort()) {
    console.error(`\n  ${file}`);
    for (const finding of list) console.error(`    [${finding.code}] ${finding.message}`);
  }
}

async function commandValidate(args) {
  const catalog = await loadCatalog(args.root);
  const { errors, warnings, listed } = validateLoadedCatalog(catalog);

  printFindings('Warnings:', warnings);

  if (errors.length > 0) {
    printFindings(`Validation failed with ${errors.length} error(s):`, errors);
    console.error('');
    return 1;
  }

  console.log(
    `Catalog valid: ${catalog.records.length} record(s), ${catalog.bundles.length} bundle(s), ` +
      `${listed.length} listed, ${warnings.length} warning(s).`,
  );
  return 0;
}

async function commandIndex(args) {
  const catalog = await loadCatalog(args.root);
  const { errors } = validateLoadedCatalog(catalog);
  if (errors.length > 0) {
    // Generating an index from records that do not validate would publish the
    // very claim the validator just refused.
    printFindings('Refusing to touch the index while the catalog is invalid:', errors);
    return 1;
  }

  const readmePath = join(args.root, 'README.md');
  const current = await readFile(readmePath, 'utf8');
  const updated = applyIndex(current, renderIndex(catalog.records.map((entry) => entry.document)));

  if (args.flags.has('write')) {
    if (updated === current) {
      console.log('README index already up to date.');
      return 0;
    }
    await writeFile(readmePath, updated);
    console.log('README index regenerated.');
    return 0;
  }

  if (updated !== current) {
    console.error(
      'README.md does not match the catalog records.\n' +
        'Run: node scripts/catalog.mjs index --write',
    );
    return 1;
  }
  console.log('README index matches the catalog records.');
  return 0;
}

async function commandDigest(args) {
  const slug = args.positional[0];
  if (!slug) {
    console.error('Usage: node scripts/catalog.mjs digest <product-slug>');
    return 2;
  }
  const catalog = await loadCatalog(args.root);
  const entry = catalog.records.find(({ document }) => document?.product?.slug === slug);
  if (!entry) {
    console.error(`No record with product slug ${JSON.stringify(slug)} in catalog/projects/.`);
    return 1;
  }
  const prefix = entry.document.deployment?.maintained_path;
  const hashes = {};
  for (const [path, hash] of Object.entries(catalog.fileHashes)) {
    if (prefix && path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`) && isConfigFile(path)) {
      hashes[path] = hash;
    }
  }
  console.log(computeConfigDigest(entry.document, hashes));
  return 0;
}

async function commandContract(args) {
  const path = join(args.root, CONTRACT_FILE);
  const manifest = `${JSON.stringify(await buildManifest(args.root), null, 2)}\n`;

  if (args.flags.has('write')) {
    await writeFile(path, manifest);
    console.log(`${CONTRACT_FILE} regenerated.`);
    return 0;
  }

  const current = await readFile(path, 'utf8').catch(() => null);
  if (current !== manifest) {
    console.error(
      `${CONTRACT_FILE} does not describe the files in this tree.\n`
        + 'A consumer pinned to this commit would verify a hash that no longer matches.\n'
        + 'Run: node scripts/catalog.mjs contract --write',
    );
    return 1;
  }
  console.log(`${CONTRACT_FILE} matches the contract files.`);
  return 0;
}

const COMMANDS = { validate: commandValidate, index: commandIndex, digest: commandDigest, contract: commandContract };

const args = parseArgs(process.argv.slice(2));
const command = COMMANDS[args.command];
if (!command) {
  console.error(
    'Usage:\n' +
      '  node scripts/catalog.mjs validate\n' +
      '  node scripts/catalog.mjs index --check | --write\n' +
      '  node scripts/catalog.mjs digest <product-slug>\n'
      + '  node scripts/catalog.mjs contract --check | --write',
  );
  process.exit(2);
}
process.exit(await command(args));
