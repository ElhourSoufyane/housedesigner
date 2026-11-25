const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const noBump = args.includes('--no-bump');
const isPreCommit = args.includes('--pre-commit');
const explicitVerArg = args.find(a => a.startsWith('--version='));
const explicitVer = explicitVerArg ? explicitVerArg.split('=')[1].trim() : null;

if (isPreCommit) {
  try {
    const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { cwd: root, encoding: 'utf8' });
    const changed = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const appFileRe = /^(src\/|index\.html$|play3d\.html$|style\.css$|sw\.js$|manifest\.json$|electron-main\.js$|preload\.js$|assets\/|textures\/)/;
    if (!changed.some(f => appFileRe.test(f))) {
      process.exit(0);
    }
  } catch (e) {
    process.exit(0);
  }
}

function log(...m) {
  if (!quiet) console.log(...m);
}

function md5Short(filePath) {
  return crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex').slice(0, 12);
}

function parseVer(v) {
  return String(v || '0.0.0').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
}

function cmpVer(a, b) {
  const pa = parseVer(a), pb = parseVer(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] || 0, db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

function bumpPatch(v) {
  const p = parseVer(v);
  while (p.length < 3) p.push(0);
  p[2] += 1;
  return `${p[0]}.${p[1]}.${p[2]}`;
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name === 'floor_references') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Load version.json & package.json
const vFile = path.join(root, 'version.json');
const pkgFile = path.join(root, 'package.json');
const vData = fs.existsSync(vFile) ? JSON.parse(fs.readFileSync(vFile, 'utf8')) : { version: '1.3.33', files: [], hashes: {} };
const pkgData = fs.existsSync(pkgFile) ? JSON.parse(fs.readFileSync(pkgFile, 'utf8')) : { name: 'house-designer', version: vData.version || '1.3.33' };

const requiredTracked = [
  'version.json',
  'index.html',
  'play3d.html',
  '3d.html',
  'style.css',
  'manifest.json',
  'sw.js',
  'preload.js',
  'electron-main.js'
];
// Exclude local-only / bulky assets from remote update manifest
const excludeRemote = new Set(['my-house.house.json']);
const fileSet = new Set((Array.isArray(vData.files) ? vData.files : []).filter(f => !excludeRemote.has(f) && !f.startsWith('assets/floor_references/')));
for (const rf of requiredTracked) fileSet.add(rf);
for (const dirName of ['src', 'lib', 'assets', 'textures']) {
  const dirPath = path.join(root, dirName);
  if (!fs.existsSync(dirPath)) continue;
  const walk = (d, relBase) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === 'floor_references') continue;
        walk(path.join(d, entry.name), `${relBase}/${entry.name}`);
      } else if (dirName !== 'src' || entry.name.endsWith('.js')) {
        fileSet.add(`${relBase}/${entry.name}`);
      }
    }
  };
  walk(dirPath, dirName);
}
vData.files = Array.from(fileSet).filter(f => f === 'version.json' || fs.existsSync(path.join(root, f)));

// 2. Check whether any tracked file hash changed OR version stamps are out of sync
const prevHashes = vData.hashes || {};
let contentChanged = false;
for (const f of vData.files) {
  if (f === 'version.json') continue;
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  const curHash = md5Short(p);
  if (prevHashes[f] !== curHash) {
    contentChanged = true;
    break;
  }
}

let targetVersion = vData.version || pkgData.version || '1.3.34';
let targetBuild = Number(vData.build || 0) || Date.now();

if (explicitVer) {
  targetVersion = explicitVer;
  targetBuild = Date.now();
} else if (!noBump && contentChanged) {
  // Respect manually bumped package.json if already greater than version.json; else auto-increment patch
  if (cmpVer(pkgData.version, vData.version) > 0) {
    targetVersion = pkgData.version;
  } else {
    targetVersion = bumpPatch(targetVersion);
  }
  targetBuild = Date.now();
} else if (cmpVer(pkgData.version, vData.version) !== 0) {
  targetVersion = cmpVer(pkgData.version, vData.version) > 0 ? pkgData.version : vData.version;
}

// 3. Stamp unified version, build timestamp, and ?v= cache-busters across index.html, play3d.html, sw.js, package.json
if (pkgData.version !== targetVersion) {
  pkgData.version = targetVersion;
  fs.writeFileSync(pkgFile, JSON.stringify(pkgData, null, 2) + '\n');
}

function updateTextFile(relPath, replacer) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return;
  const orig = fs.readFileSync(full, 'utf8');
  const next = replacer(orig);
  if (next !== orig) fs.writeFileSync(full, next, 'utf8');
}

updateTextFile('index.html', (txt) => txt
  .replace(/(href="style\.css)\?v=[^"]*(")/g, `$1?v=${targetVersion}$2`)
  .replace(/(src="(?:src\/[^"]+?))(?:\?v=[^"]*)?(")/g, `$1?v=${targetVersion}$2`)
  .replace(/(<span class="ver-badge" id="btn-ver"[^>]*>)v[0-9]+\.[0-9]+\.[0-9]+[^<]*(<\/span>)/g, `$1v${targetVersion} ✓$2`)
  .replace(/(const LOCAL_APP_VERSION\s*=\s*')[^']*(';)/g, `$1${targetVersion}$2`)
  .replace(/(const LOCAL_APP_BUILD\s*=\s*)\d+(;)/g, `$1${targetBuild}$2`)
);

updateTextFile('play3d.html', (txt) => txt
  .replace(/(src="(?:src\/[^"]+?))(?:\?v=[^"]*)?(")/g, `$1?v=${targetVersion}$2`)
  .replace(/(<span id="play3d-ver">)v[0-9]+\.[0-9]+\.[0-9]+[^<]*(<\/span>)/g, `$1v${targetVersion} · Up to date$2`)
  .replace(/(const LOCAL_APP_VERSION\s*=\s*')[^']*(';)/g, `$1${targetVersion}$2`)
  .replace(/(const LOCAL_APP_BUILD\s*=\s*)\d+(;)/g, `$1${targetBuild}$2`)
);

updateTextFile('src/grid.js', (txt) => txt
  .replace(/(HP\.VERSION\s*=\s*')[^']*(';)/, `$1v${targetVersion}$2`)
);

updateTextFile('sw.js', (txt) => txt
  .replace(/(const CACHE_NAME\s*=\s*'housedesigner-v)[^']*(';)/g, `$1${targetVersion}$2`)
  .replace(/(JSON\.stringify\(\{\s*version:\s*')[^']*(')/g, `$1${targetVersion}$2`)
);

// 4. Recompute final hashes AFTER stamping HTML/SW so hashes in version.json match disk byte-for-byte
const finalHashes = {};
let hashChangedAfterStamp = false;
for (const f of vData.files) {
  if (f === 'version.json') continue;
  const p = path.join(root, f);
  if (fs.existsSync(p)) {
    const h = md5Short(p);
    finalHashes[f] = h;
    if (prevHashes[f] !== h) hashChangedAfterStamp = true;
  }
}

if (hashChangedAfterStamp || Object.keys(prevHashes).length !== Object.keys(finalHashes).length || vData.version !== targetVersion || Number(vData.build || 0) !== targetBuild) {
  vData.version = targetVersion;
  vData.hashes = finalHashes;
  vData.build = targetBuild;
  vData.updatedAt = new Date(targetBuild).toISOString();
  fs.writeFileSync(vFile, JSON.stringify(vData, null, 2) + '\n');
  log(`Updated version.json -> v${targetVersion} (build ${targetBuild}).`);
} else {
  log(`version.json already up to date (v${targetVersion}).`);
}

// 5. Sync all build targets (Desktop standalone app, local dist build, Capacitor www)
const targets = [
  path.join('C:', 'Users', 'bo1y', 'Desktop', 'HouseDesigner-Windows-x64', 'resources', 'app'),
  path.join(root, 'dist', 'House Designer-win32-x64', 'resources', 'app'),
  path.join(root, 'www')
];

const copyFiles = [
  'index.html',
  'play3d.html',
  '3d.html',
  'style.css',
  'manifest.json',
  'version.json',
  'sw.js',
  'preload.js',
  'electron-main.js'
];

const runtimePkg = {
  name: 'house-designer',
  productName: 'House Designer',
  version: targetVersion,
  main: 'electron-main.js',
  description: pkgData.description || 'Cozy 2D & 3D Architectural Home Designer with Live Co-op'
};

for (const destDir of targets) {
  if (!fs.existsSync(destDir)) {
    log('Target does not exist, skipping:', destDir);
    continue;
  }
  try {
    log('Syncing to:', destDir);
    for (const f of copyFiles) {
      const srcFile = path.join(root, f);
      const destFile = path.join(destDir, f);
      if (fs.existsSync(srcFile)) fs.copyFileSync(srcFile, destFile);
    }
    if (!destDir.endsWith(`${path.sep}www`)) {
      fs.writeFileSync(path.join(destDir, 'package.json'), JSON.stringify(runtimePkg, null, 2) + '\n');
    }
    copyDir(path.join(root, 'src'), path.join(destDir, 'src'));
    copyDir(path.join(root, 'assets'), path.join(destDir, 'assets'));
    copyDir(path.join(root, 'lib'), path.join(destDir, 'lib'));
    copyDir(path.join(root, 'textures'), path.join(destDir, 'textures'));
    log('Successfully synced to:', destDir);
  } catch (err) {
    console.warn(`Warning: failed partial sync to ${destDir}:`, err.message);
  }
}

if (isPreCommit) {
  try {
    execFileSync('git', ['add', 'version.json', 'package.json', 'index.html', 'play3d.html', 'sw.js'], { cwd: root, stdio: 'ignore' });
  } catch (e) {}
}
