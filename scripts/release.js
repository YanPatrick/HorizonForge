#!/usr/bin/env node
// Uso: npm run release -- <versão>
// Exemplo: npm run release -- 1.5.2
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const newVersion = process.argv[2];

if (!newVersion) {
  console.error('❌ Informe a versão.');
  console.error('   Uso:     npm run release -- <versão>');
  console.error('   Exemplo: npm run release -- 1.5.2');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error(`❌ Versão inválida: "${newVersion}". Use o formato X.Y.Z (ex: 1.5.2)`);
  process.exit(1);
}

const tag = `v${newVersion}`;

// ── 1. package.json ───────────────────────────────────────────────────────────
// Fonte da verdade: API lê daqui via require(), Vite injeta __APP_VERSION__ daqui.
const pkgPath = 'package.json';
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const oldVersion = pkg.version;
pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`✅ package.json       ${oldVersion} → ${newVersion}`);

// ── 2. package-lock.json ──────────────────────────────────────────────────────
// Atualiza os dois campos de versão do topo (version + packages[""].version).
const lockPath = 'package-lock.json';
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
lock.version = newVersion;
if (lock.packages?.['']) lock.packages[''].version = newVersion;
writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
console.log(`✅ package-lock.json  atualizado`);

// ── 3. Arquivos HTML legados ──────────────────────────────────────────────────
// lobby.html e battle.html têm a versão hardcoded em dois lugares:
//   - <meta name="app-version"> — usado para detectar cache stale no browser
//   - <span class="stg-version"> — badge visual (só no lobby)
const htmlFiles = ['public/lobby.html', 'public/battle.html'];
for (const filePath of htmlFiles) {
  let content = readFileSync(filePath, 'utf8');
  content = content.replace(
    /(<meta name="app-version" content=")[\d.]+(")/,
    `$1${newVersion}$2`
  );
  content = content.replace(
    /(<span class="stg-version">v)[\d.]+(<\/span>)/,
    `$1${newVersion}$2`
  );
  writeFileSync(filePath, content);
  console.log(`✅ ${filePath}    atualizado`);
}

// ── 4. Build ──────────────────────────────────────────────────────────────────
// Vite lê package.json e injeta __APP_VERSION__ no bundle automaticamente.
console.log('\nBuilding...');
execSync('npm run build', { stdio: 'inherit' });

// ── 5. Git: commit + tag + push ───────────────────────────────────────────────
execSync('git add .');
execSync(`git commit -m "release: ${tag}"`, { stdio: 'inherit' });
execSync(`git tag ${tag}`);
execSync('git push', { stdio: 'inherit' });
execSync(`git push origin ${tag}`, { stdio: 'inherit' });

console.log(`\n🚀 ${tag} released!`);
