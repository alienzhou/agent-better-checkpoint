#!/usr/bin/env node
/**
 * Release Gate for agent-better-checkpoint.
 * Fails fast when common release omissions are detected.
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

function fail(msg) {
  console.error(`\n[release:check] ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`[release:check] OK: ${msg}`);
}

function fileExists(path) {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function readText(path) {
  return readFileSync(path, 'utf8');
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function ensureCleanWorktree() {
  const out = git(['status', '--porcelain']);
  if (out.length !== 0) fail('Working tree is not clean. Commit or stash changes before release.');
  ok('working tree clean');
}

function ensureChangelogHasVersion(version) {
  const changelog = readText('CHANGELOG.md');
  if (!changelog.includes(`## [${version}]`)) {
    fail(`CHANGELOG.md does not contain an entry for version ${version}.`);
  }
  ok(`CHANGELOG contains ${version}`);
}

function ensureUnixCheckpointScriptsInSync() {
  const aPath = 'platform/unix/checkpoint.sh';
  const bPath = '.vibe-x/agent-better-checkpoint/checkpoint.sh';

  if (!fileExists(bPath)) {
    // Some installs may not keep project-local copy in repo; if missing, just warn.
    console.warn(`[release:check] WARN: ${bPath} not found; skipping sync check.`);
    return;
  }

  const a = readText(aPath);
  const b = readText(bPath);

  // Normalize line endings
  const na = a.replace(/\r\n/g, '\n');
  const nb = b.replace(/\r\n/g, '\n');

  if (sha256(na) !== sha256(nb)) {
    fail(`Unix checkpoint scripts out of sync:\n- ${aPath}\n- ${bPath}\nPlease update both or regenerate project-local copy.`);
  }

  ok('unix checkpoint.sh copies are in sync');
}

function main() {
  if (!fileExists('package.json')) fail('package.json not found (run from repo root).');
  if (!fileExists('CHANGELOG.md')) fail('CHANGELOG.md not found.');
  if (!fileExists('platform/unix/checkpoint.sh')) fail('platform/unix/checkpoint.sh not found.');

  const pkg = JSON.parse(readText('package.json'));
  const version = pkg.version;
  if (!version) fail('package.json missing version field.');

  ensureCleanWorktree();
  ensureUnixCheckpointScriptsInSync();
  ensureChangelogHasVersion(version);

  ok(`release checks passed for ${pkg.name}@${version}`);
}

main();
