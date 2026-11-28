// Tiny static file server for testing the game.
// Run:  node server.js   →   http://localhost:8000  (or http://<LAN-IP>:8000 for Wi-Fi mobile debug)
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname, PORT = 8000;
const DEBUG_LOG = 'C:\\Users\\bo1y\\.gemini\\antigravity\\brain\\b2eeb25c-f3db-4051-a023-b0a84674e451\\scratch\\debug-mobile.log';
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

const DEBUG_SNIPPET = `
<script id="hp-wifi-debug">
(function(){
  if (location.hostname === 'localhost' && !location.search.includes('debug=1')) return;
  const logs = [];
  const origErr = console.error, origWarn = console.warn;
  function pushLog(lvl, args) {
    try {
      logs.push({ t: new Date().toISOString().slice(11,23), lvl, msg: Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').slice(0, 400) });
      if (logs.length > 30) logs.shift();
    } catch (_) {}
  }
  console.error = function(){ pushLog('ERROR', arguments); origErr.apply(console, arguments); };
  console.warn = function(){ pushLog('WARN', arguments); origWarn.apply(console, arguments); };
  window.addEventListener('error', e => pushLog('UNCAUGHT', [e.message, e.filename + ':' + e.lineno]));
  window.addEventListener('unhandledrejection', e => pushLog('PROMISE', [e.reason && (e.reason.stack || e.reason.message || e.reason)]));
  function rect(sel) {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return { hidden: true };
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) };
  }
  function send(ev) {
    try {
      const imgs = Array.from(document.querySelectorAll('#room-sw img'));
      const swCount = document.querySelectorAll('#room-sw .sw').length;
      const loadedImgs = imgs.filter(i => i.complete && i.naturalWidth > 0).length;
      const g3 = window.HP && window.HP.graphics3d;
      const payload = {
        ts: new Date().toISOString(),
        ev,
        url: location.pathname + location.search,
        ua: navigator.userAgent,
        vw: window.innerWidth, vh: window.innerHeight, dpr: window.devicePixelRatio,
        in3D: !!(window.HP && window.HP.in3D),
        tier: g3 && g3.tier ? g3.tier : null,
        fps: g3 && g3.fps ? Math.round(g3.fps) : null,
        ui: {
          topbar: rect('.topbar'),
          toolbar: rect('#toolrail'),
          editPanel: rect('#edit-panel'),
          inspector: rect('#inspector'),
          catalogFab: rect('#catalog-fab'),
          statusbar: rect('.statusbar'),
          roomSwatches: swCount,
          roomImgs: imgs.length,
          roomImgsLoaded: loadedImgs
        },
        logs: logs.splice(0)
      };
      navigator.sendBeacon('/__debug', JSON.stringify(payload));
    } catch (_) {}
  }
  setInterval(() => send('tick'), 2500);
  window.addEventListener('touchend', () => setTimeout(() => send('tap'), 250), { passive: true });
  setTimeout(() => send('init'), 1200);
})();
</script>`;

http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  if (urlPath === '/__debug' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { if (body.length < 65536) body += c; });
    req.on('end', () => {
      try {
        fs.mkdirSync(path.dirname(DEBUG_LOG), { recursive: true });
        fs.appendFileSync(DEBUG_LOG, body + '\n');
      } catch (_) {}
      res.writeHead(204); res.end();
    });
    return;
  }
  if (urlPath === '/__debug' && req.method === 'GET') {
    const out = fs.existsSync(DEBUG_LOG) ? fs.readFileSync(DEBUG_LOG, 'utf8') : '';
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(out.split('\n').slice(-40).join('\n'));
    return;
  }
  let p = decodeURIComponent(urlPath);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream',
                       'Cache-Control': 'no-store' });   /* always serve the newest files */
  if (ext === '.html') {
    const html = fs.readFileSync(file, 'utf8').replace('</body>', DEBUG_SNIPPET + '\n</body>');
    res.end(html);
    return;
  }
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '0.0.0.0', () => console.log('Home Planner → http://localhost:' + PORT + ' (LAN: http://192.168.11.121:' + PORT + ')'));
