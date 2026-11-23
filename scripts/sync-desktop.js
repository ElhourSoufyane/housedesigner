const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');

// 1. Recompute version.json hashes
const vFile = path.join(root, 'version.json');
if (fs.existsSync(vFile)) {
  const vData = JSON.parse(fs.readFileSync(vFile, 'utf8'));
  const hFiles = vData.files || [];
  const hashes = {};
  for (const f of hFiles) {
    if (f === 'version.json') continue;
    const p = path.join(root, f);
    if (fs.existsSync(p)) {
      hashes[f] = crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex').slice(0, 12);
    }
  }
  vData.hashes = hashes;
  vData.build = Date.now();
  vData.updatedAt = new Date().toISOString();
  fs.writeFileSync(vFile, JSON.stringify(vData, null, 2));
  console.log('Updated version.json hashes and build timestamp.');
}

const targets = [
  path.join('C:', 'Users', 'bo1y', 'Desktop', 'HouseDesigner-Windows-x64', 'resources', 'app'),
  path.join(root, 'dist', 'House Designer-win32-x64', 'resources', 'app'),
  path.join(root, 'www')
];

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const copyFiles = [
  'index.html',
  'play3d.html',
  'style.css',
  'manifest.json',
  'version.json',
  'sw.js',
  'preload.js',
  'electron-main.js'
];

for (const destDir of targets) {
  if (fs.existsSync(destDir)) {
    console.log('Syncing to:', destDir);
    for (const f of copyFiles) {
      const srcFile = path.join(root, f);
      const destFile = path.join(destDir, f);
      if (fs.existsSync(srcFile)) fs.copyFileSync(srcFile, destFile);
    }
    copyDir(path.join(root, 'src'), path.join(destDir, 'src'));
    copyDir(path.join(root, 'assets'), path.join(destDir, 'assets'));
    copyDir(path.join(root, 'lib'), path.join(destDir, 'lib'));
    copyDir(path.join(root, 'textures'), path.join(destDir, 'textures'));
    console.log('Successfully synced to:', destDir);
  } else {
    console.log('Target does not exist, skipping:', destDir);
  }
}
