// electron-main.js — Native Desktop Host for House Designer
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

// Enable modern GPU & WebGL hardware acceleration
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// Single instance lock — prevents multiple duplicate windows
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
const stateFile = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (e) {
    return { width: 1280, height: 800, isMaximized: false };
  }
}

function saveWindowState() {
  if (!mainWindow) return;
  try {
    const isMax = mainWindow.isMaximized();
    const bounds = mainWindow.getBounds();
    fs.writeFileSync(stateFile, JSON.stringify({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: isMax
    }));
  } catch (e) {}
}

const PAGES_BASE = 'https://elhoursoufyane.github.io/housedesigner/';
const RAW_BASE = 'https://raw.githubusercontent.com/ElhourSoufyane/housedesigner/main/';
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 8, timeout: 8000 });

function parseVer(v) {
  return String(v || '0').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
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

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function getLocalHash(filePath) {
  try {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex').slice(0, 12);
  } catch (e) {
    return null;
  }
}

function findLocalWorkspace() {
  const desktopDir = (() => {
    try { return app.getPath('desktop'); } catch (e) { return null; }
  })();
  const candidates = [
    path.resolve(__dirname, '..', '..', '..', 'Game'),
    desktopDir ? path.join(desktopDir, 'Game') : null
  ].filter(Boolean);

  const selfResolved = path.resolve(__dirname).toLowerCase();
  for (const dir of candidates) {
    const resolved = path.resolve(dir);
    if (resolved.toLowerCase() === selfResolved) continue;
    if (resolved.toLowerCase().includes(`${path.sep}resources${path.sep}`)) continue;
    const pkg = readJsonSafe(path.join(resolved, 'package.json'));
    if (pkg && pkg.name === 'house-designer' && fs.existsSync(path.join(resolved, 'src', 'furniture3d.js'))) {
      return resolved;
    }
  }
  return null;
}

function listFilesRec(dir, relBase, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      listFilesRec(full, rel, out);
    } else {
      out.push(rel);
    }
  }
  return out;
}

function syncFromLocalWorkspace() {
  const wsDir = findLocalWorkspace();
  if (!wsDir) return { synced: 0, mainChanged: false, wsActive: false };

  const appVerJson = readJsonSafe(path.join(__dirname, 'version.json')) || {};
  const wsVerJson = readJsonSafe(path.join(wsDir, 'version.json')) || {};
  const appPkg = readJsonSafe(path.join(__dirname, 'package.json')) || {};
  const wsPkg = readJsonSafe(path.join(wsDir, 'package.json')) || {};

  const appVer = appVerJson.version || appPkg.version || '0.0.0';
  const wsVer = wsVerJson.version || wsPkg.version || '0.0.0';
  const verDiff = cmpVer(wsVer, appVer);
  if (verDiff < 0) return { synced: 0, mainChanged: false, wsActive: true };

  const wsBuild = Number(wsVerJson.build || 0);
  const appBuild = Number(appVerJson.build || 0);
  const metaNewer = verDiff > 0 || (verDiff === 0 && wsBuild > appBuild);

  const rootFiles = [
    'index.html', 'play3d.html', 'style.css', 'manifest.json',
    'version.json', 'sw.js', 'preload.js', 'electron-main.js', 'my-house.house.json'
  ];
  const relFiles = [...rootFiles];
  for (const sub of ['src', 'assets', 'lib', 'textures']) {
    listFilesRec(path.join(wsDir, sub), sub, relFiles);
  }

  let synced = 0;
  let mainChanged = false;
  for (const rel of relFiles) {
    const srcPath = path.join(wsDir, rel);
    if (!fs.existsSync(srcPath)) continue;
    const destPath = path.join(__dirname, rel);
    const srcStat = fs.statSync(srcPath);
    const destExists = fs.existsSync(destPath);
    const destStat = destExists ? fs.statSync(destPath) : null;

    const shouldCheck = !destExists || metaNewer || srcStat.size !== destStat.size || srcStat.mtimeMs > destStat.mtimeMs + 10;
    if (!shouldCheck) continue;

    if (!destExists || getLocalHash(srcPath) !== getLocalHash(destPath)) {
      if (metaNewer || !destExists || srcStat.mtimeMs > destStat.mtimeMs + 10) {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
        synced++;
        if (rel === 'electron-main.js' || rel === 'preload.js') mainChanged = true;
      }
    }
  }

  // Keep local desktop package.json version aligned with synced workspace
  if (wsPkg.version && appPkg.version !== wsPkg.version) {
    appPkg.version = wsPkg.version;
    try { fs.writeFileSync(path.join(__dirname, 'package.json'), JSON.stringify(appPkg, null, 2)); } catch (e) {}
  }

  return { synced, mainChanged, wsActive: true };
}

function getLocalVersionInfo() {
  const v = readJsonSafe(path.join(__dirname, 'version.json')) || {};
  const pkg = readJsonSafe(path.join(__dirname, 'package.json')) || {};
  const fileList = Array.isArray(v.files) ? v.files : [];
  const diskHashes = {};
  let maxMtime = 0;
  for (const rel of fileList) {
    if (rel === 'version.json') continue;
    const full = path.join(__dirname, rel);
    const h = getLocalHash(full);
    if (h) diskHashes[rel] = h;
    try {
      const mt = fs.statSync(full).mtimeMs;
      if (mt > maxMtime) maxMtime = mt;
    } catch (e) {}
  }
  const vBuild = Number(v.build || 0);
  // Ensure uncommitted local edits have a build timestamp >= latest local mtime so remote auto-update won't downgrade
  const wsDir = findLocalWorkspace();
  let effectiveBuild = vBuild;
  if (wsDir && v.hashes) {
    const dirty = Object.keys(diskHashes).some(k => v.hashes[k] && diskHashes[k] !== v.hashes[k]);
    if (dirty && maxMtime > vBuild) effectiveBuild = Math.floor(maxMtime);
  }
  return {
    version: v.version || pkg.version || '1.3.14',
    build: effectiveBuild,
    hashes: diskHashes,
    hasLocalWorkspace: !!wsDir
  };
}

async function createWindow() {
  const syncRes = syncFromLocalWorkspace();
  if (syncRes.mainChanged && !process.argv.includes('--synced-relaunch')) {
    app.relaunch({ args: process.argv.slice(1).concat(['--synced-relaunch']) });
    app.exit(0);
    return;
  }

  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width || 1280,
    height: state.height || 800,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 600,
    title: 'House Designer — 2D & 3D Home Planner',
    icon: path.join(__dirname, 'assets/icon.ico'),
    backgroundColor: '#1e1b4b',
    autoHideMenuBar: true,
    show: false, // reveal smoothly on ready-to-show
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webgl: true,
      spellcheck: false
    }
  });

  if (state.isMaximized) {
    mainWindow.maximize();
  }

  // Clear disk and memory caches BEFORE loading so local app updates are loaded immediately
  try { await mainWindow.webContents.session.clearCache(); } catch (e) {}

  // Smooth fade-in presentation
  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  });

  mainWindow.on('close', saveWindowState);

  // Open external links in default OS browser or handle showroom navigation
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('play3d.html') || url.includes('showroom')) {
      mainWindow.loadURL(url.startsWith('http') || url.startsWith('file:') ? url : path.join(__dirname, url));
      return { action: 'deny' };
    }
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Keyboard shortcuts (Fullscreen, Hard Reload with live sync)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    } else if (input.key === 'Escape' && input.type === 'keyDown' && mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
      event.preventDefault();
    } else if (((input.control && input.key === 'r') || input.key === 'F5') && input.type === 'keyDown') {
      syncFromLocalWorkspace();
      mainWindow.webContents.session.clearCache().then(() => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reloadIgnoringCache();
      }).catch(() => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reloadIgnoringCache();
      });
      event.preventDefault();
    }
  });

  // Load the app directly from local files
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { agent: httpsAgent }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(6000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const tmpPath = destPath + '.tmp-' + process.pid;
    const req = https.get(url, { agent: httpsAgent }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const fileStream = fs.createWriteStream(tmpPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close(() => {
          try {
            fs.renameSync(tmpPath, destPath);
            resolve(true);
          } catch (e) {
            try {
              fs.copyFileSync(tmpPath, destPath);
              fs.unlinkSync(tmpPath);
              resolve(true);
            } catch (e2) {
              fs.unlink(tmpPath, () => {});
              reject(e2);
            }
          }
        });
      });
      fileStream.on('error', (err) => {
        fs.unlink(tmpPath, () => {});
        reject(err);
      });
    });
    req.on('error', (err) => {
      fs.unlink(tmpPath, () => {});
      reject(err);
    });
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

async function fetchLatestManifest() {
  const q = `?_t=${Date.now()}`;
  const results = await Promise.allSettled([
    fetchJson(`${PAGES_BASE}version.json${q}`).then(data => ({ data, base: PAGES_BASE })),
    fetchJson(`${RAW_BASE}version.json${q}`).then(data => ({ data, base: RAW_BASE }))
  ]);
  const valid = results.filter(r => r.status === 'fulfilled' && r.value && r.value.data).map(r => r.value);
  if (!valid.length) throw new Error('Unable to reach update servers');
  valid.sort((a, b) => {
    const c = cmpVer(b.data.version, a.data.version);
    if (c !== 0) return c;
    return Number(b.data.build || 0) - Number(a.data.build || 0);
  });
  return valid[0];
}

ipcMain.handle('get-version', () => {
  return getLocalVersionInfo().version;
});

ipcMain.handle('get-version-info', () => {
  return getLocalVersionInfo();
});

// In-app updater for standalone desktop application — Differential, Hash-Verified & Blazing Fast
ipcMain.handle('apply-update', async (event) => {
  try {
    const { data: vRes, base: primaryBase } = await fetchLatestManifest();
    const fallbackBase = primaryBase === PAGES_BASE ? RAW_BASE : PAGES_BASE;

    const fileList = vRes.files || [];
    const remoteHashes = vRes.hashes || {};

    // 1. Identify only files that actually changed or are missing on disk
    const toDownload = [];
    for (const relPath of fileList) {
      if (relPath === 'version.json') continue;
      const destPath = path.join(__dirname, relPath);
      const expectedHash = remoteHashes[relPath];
      if (!fs.existsSync(destPath) || !expectedHash || getLocalHash(destPath) !== expectedHash) {
        toDownload.push(relPath);
      }
    }

    // Always fetch latest version.json
    toDownload.push('version.json');

    const total = toDownload.length;
    let completed = 0;
    let mainChanged = false;

    event.sender.send('update-progress', {
      current: 0,
      total,
      percent: 10,
      file: `Diff check: ${total} files need updating`
    });

    // 2. Download changed files concurrently in batches of 4, verifying MD5 against stale CDN caches
    const BATCH_SIZE = 4;
    const stamp = Date.now();
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = toDownload.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (relPath) => {
        const destPath = path.join(__dirname, relPath);
        const expectedHash = relPath === 'version.json' ? null : remoteHashes[relPath];
        await downloadFile(`${primaryBase}${relPath}?_t=${stamp}`, destPath);
        if (expectedHash && getLocalHash(destPath) !== expectedHash) {
          // CDN served a stale cached file — fetch straight from fallback origin
          await downloadFile(`${fallbackBase}${relPath}?_t=${stamp}`, destPath);
        }
        if (relPath === 'electron-main.js' || relPath === 'preload.js') mainChanged = true;
        completed++;
        event.sender.send('update-progress', {
          current: completed,
          total,
          percent: Math.min(95, Math.round((completed / total) * 100)),
          file: relPath
        });
      }));
    }

    // Update package.json version as well
    const pkgPath = path.join(__dirname, 'package.json');
    const pkgData = readJsonSafe(pkgPath);
    if (pkgData && vRes.version && pkgData.version !== vRes.version) {
      pkgData.version = vRes.version;
      try { fs.writeFileSync(pkgPath, JSON.stringify(pkgData, null, 2)); } catch (e) {}
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      try { await mainWindow.webContents.session.clearCache(); } catch (e) {}
    }

    event.sender.send('update-progress', {
      current: total,
      total,
      percent: 100,
      file: 'Reloading...'
    });

    setTimeout(() => {
      if (mainChanged) {
        app.relaunch({ args: process.argv.slice(1).concat(['--synced-relaunch']) });
        app.exit(0);
      } else if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.reloadIgnoringCache();
      }
    }, 350);

    return { success: true, version: vRes.version, filesUpdated: total };
  } catch (err) {
    console.error('Update failed:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-external', (event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null); // Clean immersive borderless UI
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
