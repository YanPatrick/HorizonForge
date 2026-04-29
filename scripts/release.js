#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const LOBBY_HTML = 'public/lobby.html';
const PKG_JSON = 'package.json';

// Read current version from lobby.html
const html = readFileSync(LOBBY_HTML, 'utf8');
const match = html.match(/class="stg-version">v(\d+)\.(\d+)<\/span>/);

if (!match) {
  console.error('ERROR: version pattern not found in lobby.html');
  process.exit(1);
}

const major = parseInt(match[1]);
const minor = parseInt(match[2]);
const newVersion = `${major}.${minor + 1}`;
const tag = `v${newVersion}`;

// Update lobby.html
writeFileSync(
  LOBBY_HTML,
  html.replace(
    /class="stg-version">v\d+\.\d+<\/span>/,
    `class="stg-version">${tag}</span>`
  )
);

// Update package.json
const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8'));
pkg.version = newVersion;
writeFileSync(PKG_JSON, JSON.stringify(pkg, null, 2) + '\n');

console.log(`Bumped ${match[0].match(/v\d+\.\d+/)[0]} → ${tag}`);

// Stage, commit, push
execSync(`git add ${LOBBY_HTML} ${PKG_JSON}`);
execSync(`git commit -m "chore: bump to ${tag}"`, { stdio: 'inherit' });
execSync('git push', { stdio: 'inherit' });

console.log(`\nReleased ${tag}`);
