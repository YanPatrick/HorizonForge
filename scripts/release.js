#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const LOBBY_HTML = 'public/lobby.html';
const PKG_JSON   = 'package.json';
const CLIENT_JSX = 'client/src/pages/LobbyPage.jsx';

// Read current version from lobby.html
const html = readFileSync(LOBBY_HTML, 'utf8');
const match = html.match(/class="stg-version">v(\d+)\.(\d+)<\/span>/);

if (!match) {
  console.error('ERROR: version pattern not found in lobby.html');
  process.exit(1);
}

const major = parseInt(match[1]);
const minor = parseInt(match[2]);
const newVersion = `${major}.${minor + 1}`;   // display: "1.2"
const semver     = `${major}.${minor + 1}.0`; // npm semver: "1.2.0"
const tag = `v${newVersion}`;

// Update lobby.html
writeFileSync(
  LOBBY_HTML,
  html.replace(
    /class="stg-version">v\d+\.\d+<\/span>/,
    `class="stg-version">${tag}</span>`
  )
);

// Update LobbyPage.jsx (React client — same version badge)
const jsx = readFileSync(CLIENT_JSX, 'utf8');
writeFileSync(
  CLIENT_JSX,
  jsx.replace(
    /className="stg-version">v[\d.]+( Beta)?</,
    `className="stg-version">${tag}<`
  )
);

// Update package.json
const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8'));
pkg.version = semver;
writeFileSync(PKG_JSON, JSON.stringify(pkg, null, 2) + '\n');

console.log(`Bumped ${match[0].match(/v\d+\.\d+/)[0]} → ${tag}`);

// Build React client so public/dist/ is always in sync
console.log('Building React client...');
execSync('npm run build', { stdio: 'inherit' });

// Stage everything: HTML, JSX, package.json and the fresh dist
execSync(`git add ${LOBBY_HTML} ${CLIENT_JSX} ${PKG_JSON} public/dist/`);
execSync(`git commit -m "chore: bump to ${tag}"`, { stdio: 'inherit' });
execSync('git push', { stdio: 'inherit' });

console.log(`\nReleased ${tag}`);
