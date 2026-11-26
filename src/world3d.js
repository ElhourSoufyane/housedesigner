/* world3d.js — Three.js renderer for the 3D walk mode.
   FPS rules:
   - static geometry = instanced chunks per visibility tile (cull3d.js):
     frustum culling + wall occlusion + distance limits
   - sun shadow map follows the player (only a small box is rendered),
     tiered off on Low; PBR + image-based light on Balanced/High
   - adaptive pixel ratio and bounded textures via graphics3d.js
   - zero per-frame allocation in the render path
*/
window.HP = window.HP || {};
(function () {
const W3 = HP.world3d = {};
let renderer, scene, camera, sun, ambient, sunDir = new THREE.Vector3(900, 1400, 600).normalize();
let envDay = null;
const _c = new THREE.Vector3(), _f = new THREE.Vector3(), _lm = new THREE.Matrix4(),
      _li = new THREE.Matrix4(), _zero = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
let doorPivots = [];                      // {pivot, open, target, box}
let markerGroup = null;
const _m = null;                          // (matrices built per-build only)

W3.EYE = 38;                              // eye height ≈ 1.55 m

/* ---------- init ---------- */
W3.init = function (canvas) {
  const coarse = matchMedia('(pointer:coarse)').matches;
  const isTouch = HP.graphics3d ? HP.graphics3d.isMobile(null, coarse) : coarse;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch,
    powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.0 : 1.5));
  renderer.outputEncoding = THREE.sRGBEncoding;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ec8e8);
  scene.fog = new THREE.Fog(0xd4d7c1, 1800, 6500);
  camera = new THREE.PerspectiveCamera(72, 1, 2, 6000);
  camera.rotation.order = 'YXZ';
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  ambient = new THREE.HemisphereLight(0xe0edf1, 0x897358, 0.92);
  scene.add(ambient);
  sun = new THREE.DirectionalLight(0xffe5bc, 1.05);
  sun.position.copy(sunDir).multiplyScalar(1200);
  /* shadow box follows the player (see W3.render) — sized per tier   */
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.35;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 2800;
  scene.add(sun); scene.add(sun.target);
  const fit = () => {
    if (!renderer) return;
    const dom = renderer.domElement || canvas;
    const w = (dom && dom.clientWidth) || (typeof innerWidth !== 'undefined' ? innerWidth : 1280);
    const h = (dom && dom.clientHeight) || (typeof innerHeight !== 'undefined' ? innerHeight : 720);
    if (w <= 0 || h <= 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (camera.aspect < 1.0) {
      const desiredHFOV = 70 * (Math.PI / 180);
      const halfH = Math.tan(desiredHFOV / 2);
      const vFovRad = 2 * Math.atan(halfH / camera.aspect);
      camera.fov = Math.min(105, Math.max(72, vFovRad * (180 / Math.PI)));
    } else {
      camera.fov = 72;
    }
    camera.updateProjectionMatrix();
  };
  W3.fit = fit;
  addEventListener('resize', fit);
  addEventListener('orientationchange', () => {
    fit();
    setTimeout(fit, 80);
    setTimeout(fit, 200);
    setTimeout(fit, 400);
    setTimeout(fit, 800);
  });
  if (typeof window !== 'undefined') {
    if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
    if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.addEventListener) {
      screen.orientation.addEventListener('change', () => {
        fit();
        setTimeout(fit, 80);
        setTimeout(fit, 200);
        setTimeout(fit, 400);
      });
    }
  }
  fit();
  W3.renderer = renderer; W3.scene = scene; W3.camera = camera;
  if (HP.graphics3d) {
    const G = HP.graphics3d;
    G.onChange = () => {
      if (!sun) return;
      const q = G.current;
      sun.castShadow = q.shadow > 0;
      if (q.shadow && sun.shadow.mapSize.x !== q.shadow) {
        sun.shadow.mapSize.set(q.shadow, q.shadow);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      }
      const R = q.shadowRadius || 400, cam = sun.shadow.camera;
      cam.left = cam.bottom = -R; cam.right = cam.top = R; cam.updateProjectionMatrix();
      sun.shadow.radius = q.shadow >= 2048 ? 3 : 1.5;
      buildLampPool(q.lamps || 0);
      lightTimer = 0;                                   // re-apply time-of-day now
      if (W3.levelGroup) G.applyMaterials(W3.levelGroup);
      if (HP.cull3d) HP.cull3d.invalidate();
      const label = document.getElementById('quality-status');
      if (label) label.textContent = G.status();
      const gpu = document.getElementById('gpu-info');
      if (gpu) gpu.textContent = G.software
        ? 'Your browser is rendering without the graphics card (software mode). ' +
          'Turn on "Use graphics acceleration" in browser settings for smooth 3D.'
        : (G.gpu ? 'GPU: ' + G.gpu.replace(/^ANGLE \(|\)$/g, '').split(',').slice(0, 2).join(',') : '');
    };
    HP.sky3d.build(scene);
    G.init(renderer, fit);
    /* two prefiltered skies; we switch at twilight, when it's too dim
       to notice, and scale reflection strength with daylight between  */
    envDay = G.environment(0xe6e2cf, 0x5f9cc9, 0x8a7a62);
    envNight = G.environment(0x0b121e, 0x050912, 0x080a0d);
  }
  W3._groundMat = null;
  W3._wallMat = null;
  W3._wallMats = null;
  W3._ceilMat = null;
  if (HP.weather3d && HP.weather3d.init) {
    HP.weather3d.init(scene, camera);
  }
};

/* ---------- time of day ---------- */
let envNight = null, lightTimer = 0, lampPool = [];
const TIME = W3.time = { hour: 12, flow: true, speed: 1 / 60 };   // 1 game hour = 1 real min
try {
  const saved = JSON.parse(localStorage.getItem('hp_3d_time') || 'null');
  const now = new Date();
  TIME.hour = now.getHours() + now.getMinutes() / 60;                 // start at your real time
  if (saved && saved.flow === false) { TIME.flow = false; TIME.hour = saved.hour; }
} catch (_) {}
const saveTime = () => { try { localStorage.setItem('hp_3d_time', JSON.stringify({ flow: TIME.flow, hour: TIME.hour })); } catch (_) {} };
W3.setTime = h => { TIME.hour = ((h % 24) + 24) % 24; lightTimer = 0; saveTime(); };
W3.setTimeFlow = on => { TIME.flow = !!on; saveTime(); };
W3.setLighting = v => W3.setTime(v === 'golden' ? 17.9 : 12);         // legacy presets

/* a FIXED number of point lights (count changes recompile every shader);
   each frame-ish they're handed to the nearest visible lamps/rooms     */
function buildLampPool(n) {
  for (const l of lampPool) scene.remove(l.light);
  lampPool = [];
  for (let i = 0; i < n; i++) {
    // Distance 155, decay 2.0: smooth inverse-square room falloff without harsh cutouts
    const light = new THREE.PointLight(0xffc98a, 0, 155, 2.0);
    light.position.set(0, -1000, 0);
    scene.add(light);
    lampPool.push({ light, src: null, target: 0 });
  }
}
function assignLamps(night) {
  const p = camera.position, srcs = W3.lamps || [];
  const V = HP.cull3d;
  if (night < 0.03 || srcs.length === 0) {
    for (const L of lampPool) { L.src = null; L.target = 0; L.light.intensity = 0; L.light.position.set(0, -1000, 0); }
    return;
  }
  const WALL_H = (HP.geom3d && HP.geom3d.WALL_H) || 74;
  const camFloor = Math.max(0, Math.floor((p.y + 0.1) / WALL_H));
  const curLvl = (HP.state && HP.state.levels && HP.state.levels[camFloor]) || HP.cur();
  const env = geomEnv(curLvl);
  const camCx = Math.floor(p.x / HP.CELL), camCz = Math.floor(p.z / HP.CELL);
  const camRoom = env ? env.rAt(camCx, camCz) : -1;

  const cand = srcs
    .filter(s => {
      if (s.on === false || (s.it && s.it.on === false)) return false;
      const lampFloor = Math.max(0, Math.floor(((s.y || 0) + 0.1) / WALL_H));
      if (lampFloor !== camFloor) return false;

      // Strict line of sight check: solid walls and closed doors block light from bleeding through
      if (V && V.hasLineOfSight && !V.hasLineOfSight(p.x, p.z, s.x, s.z, camFloor)) {
        return false;
      }

      if (s.room === undefined && env) {
        s.room = env.rAt(Math.floor(s.x / HP.CELL), Math.floor(s.z / HP.CELL));
      }
      if (s.room !== undefined && s.room >= 0 && camRoom >= 0 && s.room !== camRoom) {
        if (!V || !V.hasLineOfSight || !V.hasLineOfSight(p.x, p.z, s.x, s.z, camFloor)) {
          return false;
        }
      }
      return !V || V.visibleAt(s.x, s.z);
    })
    .map(s => ({ s, d: (s.x - p.x) ** 2 + (s.z - p.z) ** 2 }))
    .sort((a, b) => a.d - b.d).slice(0, lampPool.length).map(c => c.s);

  /* keep lights that stay assigned; hand free ones to new sources      */
  for (const L of lampPool) {
    if (!cand.includes(L.src)) {
      L.src = null;
      L.target = 0;
      L.light.intensity = 0;
      L.light.position.set(0, -1000, 0);
    }
  }
  for (const s of cand) {
    if (lampPool.some(L => L.src === s)) continue;
    const L = lampPool.find(L => !L.src);
    if (!L) break;
    L.src = s; L.light.intensity = 0;                     // fade in, no pop
    const bY = Math.floor((s.y || 0) / WALL_H) * WALL_H;
    const clampedY = Math.min(s.y, bY + 54);
    let lx = s.x, lz = s.z;
    if (env && env.rAt && !s.it?.hang && !/sconce/i.test((s.it && s.it.type) || '')) {
      const C = HP.CELL;
      const scx = Math.floor(s.x / C), scz = Math.floor(s.z / C);
      const myRoom = env.rAt(scx, scz);
      if (myRoom >= 0) {
        const offX = s.x - (scx + 0.5) * C;
        const offZ = s.z - (scz + 0.5) * C;
        if (Math.abs(offX) > 6) lx -= Math.sign(offX) * 4;
        if (Math.abs(offZ) > 6) lz -= Math.sign(offZ) * 4;
      }
    }
    L.light.position.set(lx, clampedY, lz);
  }
  for (const L of lampPool) {
    if (L.src && (L.src.on === false || (L.src.it && L.src.it.on === false))) {
      L.target = 0;
      L.light.intensity = 0;
      L.light.position.set(0, -1000, 0);
    } else {
      L.target = L.src && L.src.on !== false ? L.src.power * night * 1.35 : 0;
    }
  }
}
W3.turnOffLamp = function (lampOrItem) {
  const id = lampOrItem.id !== undefined ? lampOrItem.id : (lampOrItem.it ? lampOrItem.it.id : null);
  for (const L of lampPool) {
    if (L.src === lampOrItem || L.src === lampOrItem.src || (id !== null && L.src && L.src.id === id)) {
      L.src = null;
      L.target = 0;
      L.light.intensity = 0;
      L.light.position.set(0, -1000, 0);
    }
  }
};
W3.syncLamps = function () {
  const night = HP.sky3d ? HP.sky3d.sample(TIME.hour).night : 1;
  for (const L of lampPool) {
    if (L.src && (L.src.on === false || (L.src.it && L.src.it.on === false))) {
      L.target = 0;
      L.light.intensity = 0;
      L.light.position.set(0, -1000, 0);
    } else if (L.src) {
      L.target = L.src.power * night * 1.35;
    }
  }
  assignLamps(night);
};
function tickTime(dt, now) {
  if (TIME.flow) TIME.hour = (TIME.hour + dt * TIME.speed) % 24;
  const G = HP.graphics3d, q = G && G.current, s = HP.sky3d.sample(TIME.hour);
  sunDir.copy(s.lightDir);
  sun.color.copy(s.lightCol);
  /* with real shadows the sun can be strong: lit vs shaded reads     */
  sun.intensity = s.lightI * (q && q.shadow ? 1 + 0.45 * s.day : 1);
  renderer.toneMappingExposure = 0.92 + 0.12 * s.night;   // eyes adapt a little
  ambient.color.copy(s.amb);
  /* IBL replaces most of the hemisphere fill by day on PBR tiers      */
  ambient.intensity = s.ambI * (q && q.env ? 1 - 0.6 * s.day : 1);
  scene.fog.color.copy(s.fog);
  HP.sky3d.apply(s, now / 1000);
  for (const L of lampPool) L.light.intensity += (L.target - L.light.intensity) * Math.min(1, dt * 3);
  if ((lightTimer -= dt) > 0) return s;
  lightTimer = 0.3;                                       // slow-changing work
  if (G) {
    scene.environment = q.env ? (s.night > 0.5 ? envNight : envDay) : null;
    G.setEnvScale(0.25 + 0.75 * s.day);
    G.setNight(s.night);
  }
  assignLamps(s.night);
  const clock = document.getElementById('clock');
  if (clock) clock.textContent = HP.sky3d.clock(TIME.hour);
  return s;
}

/* ---------- geometry env for geom3d ---------- */
const geomEnv = W3.geomEnv = function (targetLvl) {
  const lvl = targetLvl || (HP.cur && HP.cur());
  const { regionOf, regions } = (lvl && HP.computeRegions) ? HP.computeRegions(lvl) : { regionOf: null, regions: [] };
  return {
    C: HP.CELL,
    fences: (lvl && lvl.fences) || {},
    garageDoors: (lvl && lvl.furniture || []).filter(it => /garagedoor/i.test(it.type)),
    rAt: (x, y) => (x < 0 || y < 0 || x >= HP.GRID_W || y >= HP.GRID_H) ? -1 : (regionOf ? regionOf[y * HP.GRID_W + x] : -1),
    rsz: id => (id >= 0 && regions && regions[id]) ? regions[id].cells.length : 1e9,
  };
}

/* ---------- furniture blockout heights (px) ---------- */
const H3D = [
  [/^archway/i, 74],
  [/lamppost/i, 56],
  [/planter$/i, 22],
  [/car_ev/i, 39],
  [/lamparc/i, 52],
  [/lamptorch/i, 50],
  [/floorlamp/i, 48],
  [/halltree/i, 50],
  [/shoji/i, 50],
  [/mirarch/i, 50],
  [/mirwavy/i, 50],
  [/projscreen/i, 48],
  [/lamptripod/i, 48],
  [/miroval/i, 48],
  [/cornershelf/i, 28],
  [/birdcage/i, 46],
  [/cattree/i, 44],
  [/plfiddle/i, 44],
  [/tapestry/i, 40],
  [/statue/i, 38],
  [/stcolumn/i, 38],
  [/woodstove/i, 36],
  [/plmonstera/i, 36],
  [/plpalm/i, 34],
  [/stbust/i, 34],
  [/cinemaseats/i, 32],
  [/shoecab/i, 32],
  [/hifi/i, 32],
  [/lamppaper/i, 32],
  [/flscratch/i, 32],
  [/flvase/i, 32],
  [/stceramic/i, 32],
  [/flspeaker/i, 30],
  [/console/i, 28],
  [/credenza/i, 28],
  [/barcart/i, 28],
  [/keytray/i, 28],
  [/mirsun/i, 28],
  [/plsnake/i, 22],
  [/flwinerack/i, 28],
  [/flplantstand/i, 26],
  [/fllantern/i, 26],
  [/plpothos/i, 24],
  [/umbstand/i, 24],
  [/beanbag$/i, 24],
  [/lamptable/i, 22],
  [/stfount/i, 22],
  [/hamster/i, 20],
  [/ghbench/i, 20],
  [/plorchid/i, 20],
  [/entrybench/i, 18],
  [/plcactus/i, 18],
  [/lampcandle/i, 18],
  [/lampbanker/i, 18],
  [/plbonsai/i, 16],
  [/lampmush/i, 16],
  [/pathlight/i, 14],
  [/nightlight/i, 10],
  [/ottomanTuft/i, 16],
  [/ottomanStor/i, 16],
  [/flbasket/i, 16],
  [/flmagrack/i, 16],
  [/fllogbasket/i, 16],
  [/poufround/i, 14],
  [/poufsq/i, 14],
  [/flcrate/i, 14],
  [/lampbanker/i, 14],
  [/footstool/i, 12],
  [/petbed/i, 10],
  [/fldogbowl/i, 8],
  [/doormat/i, 2],
  [/bamboofence/i, 36],
  [/latticefence/i, 36],
  [/whitefencewall/i, 34],
  [/reedfence/i, 34],
  [/metalfence/i, 34],
  [/fencewood/i, 32],
  [/ironfence/i, 32],
  [/gate/i, 32],
  [/brickfence/i, 32],
  [/chainlink/i, 32],
  [/hedgefence/i, 30],
  [/ranchfence/i, 28],
  [/glassfence/i, 28],
  [/picket/i, 26],
  [/gardwall/i, 24],
  [/ropefence/i, 20],
  [/stoneedge/i, 8],
  [/modseat/i, 26],
  [/modarmL/i, 26],
  [/modarmR/i, 26],
  [/modcorner/i, 26],
  [/modchaise/i, 26],
  [/modtable/i, 14],
  [/flagpole/i, 60],
  [/treehouse/i, 310],
  [/palmtree/i, 56],
  [/^tree$/i, 92],
  [/lamppost/i, 52],
  [/pergola/i, 50],
  [/greenhouse/i, 96],
  [/shed/i, 48],
  [/swingset/i, 48],
  [/outshower/i, 48],
  [/parasol/i, 46],
  [/patioheater/i, 46],
  [/coatrack/i, 46],
  [/trampoline/i, 44],
  [/playhouse/i, 44],
  [/garch/i, 44],
  [/growshelf/i, 44],
  [/volleyball/i, 42],
  [/gardwell/i, 42],
  [/scarecrow/i, 42],
  [/slide/i, 42],
  [/goal/i, 36],
  [/clothesline/i, 36],
  [/chickencoop/i, 36],
  [/bbq/i, 32],
  [/topiary/i, 32],
  [/potting/i, 32],
  [/birdhouse/i, 32],
  [/birdfeeder/i, 32],
  [/car$/i, 41],
  [/suv$/i, 47],
  [/garagedoor/i, 60],
  [/fountain/i, 28],
  [/rabbithutch/i, 28],
  [/mailbox/i, 28],
  [/planterTall/i, 28],
  [/outsofa/i, 26],
  [/gardenbench/i, 26],
  [/beehive/i, 26],
  [/rainbarrel/i, 26],
  [/tomato/i, 26],
  [/wbins/i, 26],
  [/patiotable/i, 24],
  [/doghouse/i, 24],
  [/hammock/i, 24],
  [/skateramp/i, 24],
  [/sundial/i, 24],
  [/satellite/i, 24],
  [/hedge/i, 24],
  [/compost/i, 24],
  [/picnic/i, 22],
  [/cooler/i, 22],
  [/birdbath/i, 22],
  [/mower/i, 22],
  [/firewood/i, 22],
  [/hottub/i, 20],
  [/acunit/i, 20],
  [/solarpanel/i, 18],
  [/lounger/i, 16],
  [/wheelbarrow/i, 16],
  [/diveboard/i, 14],
  [/planter$/i, 14],
  [/gnome/i, 14],
  [/firepit/i, 12],
  [/sandbox/i, 18],
  [/flowerbox/i, 18],
  [/flowerbed/i, 22],
  [/veggie/i, 8],
  [/poolfloat/i, 8],
  [/seedlings/i, 6],
  [/workbench/i, 28],
  [/shelfunit/i, 48],
  [/bicycle/i, 32],
  [/ironboard/i, 28],
  [/dryrack/i, 30],
  [/utilsink/i, 28],
  [/vacuum/i, 34],
  [/freezer/i, 28],
  [/waterheater/i, 44],
  [/sewing/i, 28],
  [/printer3d/i, 20],
  [/acwall/i, 12],
  [/acportable/i, 26],
  [/actower/i, 36],
  [/acceiling/i, 8],
  [/acwindow/i, 16],
  [/laundrybasket/i, 18],
  [/mopbucket/i, 16],
  [/stepstool/i, 18],
  [/litterbox/i, 16],
  [/motorcycle/i, 34],
  [/toolchest/i, 36],
  [/tires/i, 24],
  [/pegboard/i, 36],
  [/bball/i, 52],
  [/evcharger/i, 42],
  [/carlift/i, 52],
  [/ladder/i, 46],
  [/generator/i, 22],
  [/compressor/i, 26],
  [/kayak/i, 14],
  [/golfbag/i, 32],
  [/surfboard/i, 20],
  [/scooter/i, 30],
  [/carport/i, 54],
  [/ridemower/i, 32],
  [/pingpong/i, 29],
  [/foosball/i, 28],
  [/airhockey/i, 32],
  [/dartboard/i, 44],
  [/arcade/i, 48],
  [/chess$/i, 24],
  [/pinball/i, 44],
  [/cardtable/i, 24],
  [/poolcues/i, 46],
  [/chessclock/i, 34],
  [/drums/i, 36],
  [/guitars/i, 38],
  [/synth/i, 32],
  [/jukebox/i, 44],
  [/ampstack/i, 44],
  [/micstand/i, 46],
  [/violinstand/i, 42],
  [/sauna/i, 52],
  [/massage/i, 26],
  [/playmat/i, 2],
  [/teepee/i, 48],
  [/kidsdesk/i, 22],
  [/toybox/i, 16],
  [/rockchair/i, 32],
  [/ballpit/i, 14],
  [/changetable/i, 32],
  [/highchair/i, 32],
  [/easel/i, 40],
  [/rockhorse/i, 20],
  [/dollhouse/i, 32],
  [/toykitchen/i, 28],
  [/kidstable/i, 18],
  [/nightlight/i, 8],
  [/beanbag2/i, 20],
  [/gamingchair/i, 36],
  [/offchair/i, 34],
  [/treadmill/i, 36],
  [/whiteboard/i, 44],
  [/^fan$|standing.*fan/i, 38],
  [/watercooler/i, 38],
  [/drafting/i, 34],
  [/telescope/i, 44],
  [/serverrack/i, 48],
  [/shredder/i, 18],
  [/kneelchair/i, 20],
  [/scanner/i, 6],
  [/deskorganizer/i, 4],
  [/acsplit/i, 12],
  [/laptop/i, 12],
  [/exbike/i, 36],
  [/weightbench/i, 32],
  [/punchbag/i, 46],
  [/rower/i, 20],
  [/elliptical/i, 44],
  [/dumbbells/i, 24],
  [/pullupbar/i, 16],
  [/gymball/i, 20],
  [/foamroller/i, 6],
  [/stepplatform/i, 8],
  [/kettlebells/i, 10],
  [/wardrobeBig/i, 50],
  [/bsink2/i, 36],
  [/vanity/i, 36],
  [/divider/i, 50],
  [/shower$/i, 52],
  [/linen/i, 48],
  [/towelwarmer/i, 32],
  [/mirrorcab/i, 28],
  [/washer|dryer/i, 25],
  [/toilet|bidet/i, 22],
  [/bathtub|bath$/i, 18],
  [/bsink/i, 26],
  [/bathmat/i, 1],
  [/bathscale/i, 2],
  [/bathcaddy/i, 4],
  [/hamper/i, 18],
  [/rug|mat|carpet|runner|tilefloor|path/i, 1],
  [/tvwall/i, 52],
  [/piano/i, 32],
  [/pooltable/i, 25],
  [/aquarium/i, 36],
  [/fireplace/i, 52],
  [/plantbig|bigplant|fiddle|palm/i, 38],
  [/plantsm|smplant|succulent|cactus/i, 16],
  [/^bench$|entrybench|bedbench/i, 16],
  [/canopy/i, 52],
  [/bunkbed/i, 46],
  [/bedking|kingbed/i, 32],
  [/bedqueen|queenbed/i, 30],
  [/beddouble|doublebed/i, 28],
  [/bedsingle|singlebed/i, 26],
  [/crib/i, 24],
  [/nightstand/i, 16],
  [/dresser/i, 25],
  [/wardrobe/i, 50],
  [/bed|bunk|crib|futon/i, 14],
  [/barstool/i, 32],
  [/^chair$|dining.*chair/i, 25],
  [/daybed|futon/i, 20],
  [/sofa|couch|sectional|chester|loveseat|settee|tuxedo|camel3|track[234]|velvet3|boucle3|midcen|armless3|sleeper|recamier|chaise/i, 32],
  [/armchair|recliner|tubchair/i, 28],
  [/chair|stool|bench|seat|ottoman/i, 22],
  [/buffet|sideboard/i, 24],
  [/barcounter/i, 28],
  [/winecab/i, 26],
  [/coffee.*table|coffeer|coffeeround/i, 14],
  [/sidetable|endtable/i, 18],
  [/microwave|toaster|kettle|coffee|blender|airfryer|mixer|ricecooker/i, 12],
  [/trashbin|bin\b/i, 18],
  [/table|desk|counter|dresser|nightstand|vanity|island|bar\b/i, 25],
  [/bookshelf|bookcase|wardrobe|closet|shelf|cabinet|pantry|locker|armoire|fridge|refrigerator/i, 52],
  [/floorlamp/i, 46],
  [/lamp|torchiere/i, 34],
  [/plant|tree|bush|flower|cactus|palm/i, 21],
  [/toilet|bidet|urinal/i, 16],
  [/bath|tub|jacuzzi|hottub/i, 14],
  [/shower/i, 50],
  [/sink|basin|stove|oven|washer|dryer|dishwasher|machine|counter/i, 25],
  [/tvstand|media.*console/i, 36],
  [/tv|monitor|screen/i, 26],
  [/piano|keyboard|organ|drum/i, 27],
  [/stairs/i, 74],
  [/pergola|porch|canopy_glass|sunsail/i, 74],
  [/awning_metal/i, 60],
  [/^clock$|clkgrand|grandfather/i, 52],
  [/rangehood/i, 72],
  [/ceilingfan/i, 74],
  [/pool|pond/i, 4],
];
function itemH3D(def, it) {
  if (def.hangs) return 0;                  // wall-mounted: handled separately
  const itType = (it && it.type) || (def && def.id) || '';
  if (/^greenhouse/i.test(itType)) {
    const span = it ? Math.max(it.w || def.w || 6, it.h || def.h || 8) : ((def && def.w) || 6);
    return Math.max(92, Math.min(125, Math.round(56 + span * 6.5)));
  }
  for (const [re, h] of H3D) if (re.test(itType) || re.test(def.name || '')) return h;
  return 16;
}
HP.itemH3D = itemH3D;
const FLAT = t => /rug|mat|carpet|runner|path/i.test(t);
/* light enough to shove with your body — chairs, stools, plants…   */
const PUSHABLE_T = /chair|stool|bench|ottoman|seat|pouf|plant|bush|flower|cactus|palm|lamp|bin|basket|cushion|pillow|toy|nightstand|endtable|sidetable|hamper|cart/i;
const FIXED_T = /toilet|bidet|urinal|sink|basin|stove|oven|washer|dryer|dishwasher|bath|tub|jacuzzi|hottub|shower|fridge|counter|island|vanity|pool|pond|stairs|piano|tv|monitor|bed|sofa|couch|wardrobe|closet|shelf|bookcase|cabinet|pantry|locker|armoire|dresser|desk|counter|buffet|sideboard|china|barcounter|coffeer|coffee.*table|bookshelf/i;
function pushable(it, d, f, h) {
  if (it._interiorOf || (it._baseY && it._baseY > 0)) return false; // interior & tabletop items stay solidly placed
  if (h <= 10 || h > 34) return false;                  // flat or too tall = stays
  if (f.w * f.h > 4) return false;                      // big footprint = heavy
  const s = it.type + ' ' + (d.name || '');
  if (FIXED_T.test(s)) return false;
  return PUSHABLE_T.test(s) || f.w * f.h <= 1;          // tiny items always slide
}

function populateWindowAssembly(assembly, sashMat, paneMat, targetDoorPivots) {
  const { root, a, isH, span, height, rim, rail, width, insideH, wallDepth, n, inward } = assembly;
  const bars = (parent, specs) => {
    const geometry = unitBox().clone();
    const mesh = new THREE.InstancedMesh(geometry, sashMat, specs.length);
    const bounds = new THREE.Box3(), part = new THREE.Box3();
    const m4 = new THREE.Matrix4();
    specs.forEach(([u, y, depth, bw, bh, bd], i) => {
      const sx = isH ? bw : bd, sz = isH ? bd : bw;
      const x = isH ? u : depth, z = isH ? depth : u;
      m4.makeScale(sx, bh, sz); m4.setPosition(x, y, z);
      mesh.setMatrixAt(i, m4);
      part.min.set(x - sx / 2, y - bh / 2, z - sz / 2);
      part.max.set(x + sx / 2, y + bh / 2, z + sz / 2);
      bounds.union(part);
    });
    geometry.boundingBox = bounds;
    geometry.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const frameBars = [
    [0, -height / 2 + rim / 2, 0, span, rim, wallDepth],
    [0, height / 2 - rim / 2, 0, span, rim, wallDepth],
    [-span / 2 + rim / 2, 0, 0, rim, height - rim * 2, wallDepth],
    [span / 2 - rim / 2, 0, 0, rim, height - rim * 2, wallDepth]
  ];
  if (n === 1) {
    for (const u of [-width / 2, width / 2])
      frameBars.push([u, 0, 0, 0.35, insideH, 0.35]);
  } else {
    for (let i = 1; i < n; i++)
      frameBars.push([-width / 2 + width * i / n, 0, 0, rim, insideH, wallDepth]);
    const cell = width / n, pw = cell - rim - 0.3, ph = insideH - 0.2;
    const lip = rail * 0.65, holeH = ph - lip * 2;
    for (let i = 0; i < n; i++) {
      const u = -width / 2 + cell * (i + 0.5);
      const left = i === 0 ? -span / 2 : u - cell / 2;
      const right = i === n - 1 ? span / 2 : u + cell / 2;
      const holeL = u - pw / 2 + lip, holeR = u + pw / 2 - lip;
      const depth = inward * wallDepth / 2, band = (height - holeH) / 2;
      frameBars.push(
        [(left + right) / 2, -(height + holeH) / 4, depth, right - left, band, 0.7],
        [(left + right) / 2, (height + holeH) / 4, depth, right - left, band, 0.7],
        [(left + holeL) / 2, 0, depth, holeL - left, holeH, 0.7],
        [(holeR + right) / 2, 0, depth, right - holeR, holeH, 0.7]
      );
    }
  }
  assembly.frame = bars(root, frameBars);
  const panel = (u, y, pw, ph, moving, du = 0, dy = 0, hinge = 0) => {
    const depth = hinge ? inward * (wallDepth / 2 + 0.95) : moving ? 0.95 : -0.95;
    const pivot = new THREE.Group();
    pivot.position.set(isH ? u : depth, y, isH ? depth : u);
    root.add(pivot);
    const sash = new THREE.Group();
    pivot.add(sash);
    if (hinge) {
      if (isH) { pivot.position.x -= hinge * pw / 2; sash.position.x = hinge * pw / 2; }
      else { pivot.position.z -= hinge * pw / 2; sash.position.z = hinge * pw / 2; }
    }
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(
      isH ? pw - rail * 2 : 0.3, ph - rail * 2, isH ? 0.3 : pw - rail * 2), paneMat);
    sash.add(leaf);
    const sashBars = [
      [0, -(ph - rail) / 2, 0, pw, rail, 1.2],
      [0, (ph - rail) / 2, 0, pw, rail, 1.2],
      [-(pw - rail) / 2, 0, 0, rail, ph - rail * 2, 1.2],
      [(pw - rail) / 2, 0, 0, rail, ph - rail * 2, 1.2]
    ];
    if (moving) sashBars.push(n === 1
      ? [0, -ph / 2 + rail, 0.75, 3, 0.45, 0.3]
      : [(hinge || (du > 0 ? 1 : -1)) * (pw - rail) / 2, 0, hinge ? inward * 0.75 : 0.75, 0.45, 3, 0.3]);
    bars(sash, sashBars);
    if (hinge) bars(pivot, [-ph * 0.32, ph * 0.32].map(yh =>
      [0, yh, 0, 0.5, 2, 0.5]));
    const slide = isH ? { x: du, y: dy, z: 0 } : { x: 0, y: dy, z: du };
    const d = { pivot, a, open: 0, target: 0, leaf, lw: pw, li: 0,
      vel: 0, holdT: 0, latched: false, window: true,
      slide: hinge ? null : slide, base: pivot.position.clone(), fixed: !moving,
      casement: !!hinge, hinge, inward, sash,
      swingDir: (isH ? -1 : 1) * inward * hinge,
      ly0: root.position.y + y - ph / 2, ly1: root.position.y + y + ph / 2,
      halfX: (isH ? pw : 1.8) / 2, halfZ: (isH ? 1.8 : pw) / 2, halfY: ph / 2 };
    assembly.panels.push(d);
    if (moving && targetDoorPivots) targetDoorPivots.push(d);
    if (W3.windowPanels) W3.windowPanels.push(d);
  };
  const ph = insideH - 0.2, overlap = 0.6;
  const winStyle = assembly.winStyle || (n === 1 ? 'single-hung' : 'casement');
  if (winStyle === 'awning') {
    // Top-hinged awning window: hinges at the top rail and tilts out/in
    const cell = width / n;
    for (let i = 0; i < n; i++) {
      const u = -width / 2 + cell * (i + 0.5);
      const pw = cell - rim - 0.3;
      const depth = inward * (wallDepth / 2 + 0.95);
      const pivotY = insideH / 2 - rail;
      const pivot = new THREE.Group();
      pivot.position.set(isH ? u : depth, pivotY, isH ? depth : u);
      root.add(pivot);
      const sash = new THREE.Group();
      sash.position.y = -ph / 2;
      pivot.add(sash);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(
        isH ? pw - rail * 2 : 0.3, ph - rail * 2, isH ? 0.3 : pw - rail * 2), paneMat);
      sash.add(leaf);
      const sashBars = [
        [0, -(ph - rail) / 2, 0, pw, rail, 1.2],
        [0, (ph - rail) / 2, 0, pw, rail, 1.2],
        [-(pw - rail) / 2, 0, 0, rail, ph - rail * 2, 1.2],
        [(pw - rail) / 2, 0, 0, rail, ph - rail * 2, 1.2],
        [0, -ph / 2 + rail, inward * 0.75, 4, 0.45, 0.3]
      ];
      bars(sash, sashBars);
      bars(pivot, [[0, 0, 0, pw * 0.8, 0.6, 0.6]]);
      const d = { pivot, a, open: 0, target: 0, leaf, lw: pw, li: 0,
        vel: 0, holdT: 0, latched: false, window: true,
        slide: null, base: pivot.position.clone(), fixed: false,
        awning: true, casement: false, inward, sash,
        swingDir: (isH ? -1 : 1) * inward,
        ly0: root.position.y - insideH / 2, ly1: root.position.y + insideH / 2,
        halfX: (isH ? pw : 1.8) / 2, halfZ: (isH ? 1.8 : pw) / 2, halfY: ph / 2 };
      assembly.panels.push(d);
      if (targetDoorPivots) targetDoorPivots.push(d);
      if (W3.windowPanels) W3.windowPanels.push(d);
    }
  } else if (winStyle === 'hopper') {
    // Bottom-hinged hopper window: hinges at the bottom sill and tilts inward from the top
    const cell = width / n;
    for (let i = 0; i < n; i++) {
      const u = -width / 2 + cell * (i + 0.5);
      const pw = cell - rim - 0.3;
      const depth = inward * (wallDepth / 2 + 0.95);
      const pivotY = -insideH / 2 + rail;
      const pivot = new THREE.Group();
      pivot.position.set(isH ? u : depth, pivotY, isH ? depth : u);
      root.add(pivot);
      const sash = new THREE.Group();
      sash.position.y = ph / 2;
      pivot.add(sash);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(
        isH ? pw - rail * 2 : 0.3, ph - rail * 2, isH ? 0.3 : pw - rail * 2), paneMat);
      sash.add(leaf);
      const sashBars = [
        [0, -(ph - rail) / 2, 0, pw, rail, 1.2],
        [0, (ph - rail) / 2, 0, pw, rail, 1.2],
        [-(pw - rail) / 2, 0, 0, rail, ph - rail * 2, 1.2],
        [(pw - rail) / 2, 0, 0, rail, ph - rail * 2, 1.2],
        [0, ph / 2 - rail, inward * 0.75, 4, 0.45, 0.3]
      ];
      bars(sash, sashBars);
      bars(pivot, [[0, 0, 0, pw * 0.8, 0.6, 0.6]]);
      const d = { pivot, a, open: 0, target: 0, leaf, lw: pw, li: 0,
        vel: 0, holdT: 0, latched: false, window: true,
        slide: null, base: pivot.position.clone(), fixed: false,
        hopper: true, casement: false, inward, sash,
        swingDir: (isH ? -1 : 1) * inward,
        ly0: root.position.y - insideH / 2, ly1: root.position.y + insideH / 2,
        halfX: (isH ? pw : 1.8) / 2, halfZ: (isH ? 1.8 : pw) / 2, halfY: ph / 2 };
      assembly.panels.push(d);
      if (targetDoorPivots) targetDoorPivots.push(d);
      if (W3.windowPanels) W3.windowPanels.push(d);
    }
  } else if (winStyle === 'slider') {
    // Horizontal gliding slider window: bypass sashes
    const halfW = width / 2;
    panel(-halfW / 2 + overlap / 4, 0, halfW + overlap / 2, ph, false);
    panel(halfW / 2 - overlap / 4, 0, halfW + overlap / 2, ph, true, -(halfW - overlap), 0);
  } else if (winStyle === 'single-hung' || winStyle === 'single_hung' || n === 1) {
    const half = insideH / 2;
    panel(0, half / 2 - overlap / 2, width - 0.2, half + overlap - 0.2, false);
    panel(0, -half / 2 + overlap / 2, width - 0.2, half + overlap - 0.2, true, 0, half - overlap);
  } else {
    const cell = width / n;
    for (let i = 0; i < n; i++) {
      panel(-width / 2 + cell * (i + 0.5), 0, cell - rim - 0.3, ph, true,
        0, 0, i === n - 1 ? -1 : 1);
    }
  }
}

function buildOverheadTrack(a, span, leaves, s0, s1, flipVal, parentGroup, overrideMid, overrideSpan) {
  const isH = a.d === 'h';
  const effectiveSpan = overrideSpan !== undefined ? overrideSpan : span;
  const trackLen = leaves === 2 ? effectiveSpan * 2.2 : effectiveSpan * 2.1;
  const trackH = 1.4, trackD = 1.4;
  const trackMat = HP.graphics3d ? HP.graphics3d.material('metal', '#18191b') : new THREE.MeshLambertMaterial({ color: 0x18191b });
  const group = new THREE.Group();
  const bY = (a && a.baseY) || 0;
  group.position.y = bY;

  const tGeo = new THREE.BoxGeometry(isH ? trackLen : trackD, trackH, isH ? trackD : trackLen);
  const trackMesh = new THREE.Mesh(tGeo, trackMat);
  trackMesh.castShadow = true;
  group.add(trackMesh);

  // End stop bumpers on both ends of the track
  const bumpGeo = new THREE.BoxGeometry(isH ? 0.7 : trackD + 0.5, trackH + 0.5, isH ? trackD + 0.5 : 0.7);
  const bump1 = new THREE.Mesh(bumpGeo, trackMat);
  const bump2 = new THREE.Mesh(bumpGeo, trackMat);
  const halfLen = trackLen / 2;
  bump1.position.set(isH ? -halfLen : 0, 0, isH ? 0 : -halfLen);
  bump2.position.set(isH ? halfLen : 0, 0, isH ? 0 : halfLen);
  group.add(bump1); group.add(bump2);

  // Wall standoff mounting spacers
  const standoffGeo = new THREE.BoxGeometry(isH ? 0.8 : 1.1, 0.8, isH ? 1.1 : 0.8);
  const wallOffset = (flipVal > 0 ? 0.55 : -0.55);
  for (let f = -0.42; f <= 0.43; f += 0.21) {
    const so = new THREE.Mesh(standoffGeo, trackMat);
    so.position.set(isH ? halfLen * f : wallOffset, 0, isH ? wallOffset : halfLen * f);
    group.add(so);
  }

  const lh = HP.geom3d.DOOR_H + 1;
  const mid = overrideMid !== undefined ? overrideMid : (s0 + s1) / 2;
  const faceZ = isH ? (flipVal > 0 ? a.z0 - 1.1 : a.z1 + 1.1) : mid;
  const faceX = isH ? mid : (flipVal > 0 ? a.x0 - 1.1 : a.x1 + 1.1);
  group.position.set(faceX, lh + 2, faceZ);
  parentGroup.add(group);
  return group;
}

function mergeGeometries(geos) {
  if (!geos || !geos.length) return null;
  if (geos.length === 1) return geos[0];
  let totalVerts = 0, totalIdx = 0;
  for (const g of geos) {
    if (!g || !g.attributes || !g.attributes.position) continue;
    totalVerts += g.attributes.position.count;
    totalIdx += g.index ? g.index.count : g.attributes.position.count;
  }
  if (!totalVerts) return null;

  const pos = new Float32Array(totalVerts * 3);
  const nor = new Float32Array(totalVerts * 3);
  const uv = new Float32Array(totalVerts * 2);
  const idx = totalVerts > 65535 ? new Uint32Array(totalIdx) : new Uint16Array(totalIdx);

  let vOff = 0, iOff = 0;
  for (const g of geos) {
    if (!g || !g.attributes || !g.attributes.position) continue;
    const pArr = g.attributes.position.array;
    const nArr = g.attributes.normal.array;
    const uArr = g.attributes.uv ? g.attributes.uv.array : null;
    const pCount = g.attributes.position.count;

    for (let i = 0; i < pCount; i++) {
      const i3 = i * 3, vi3 = (vOff + i) * 3;
      pos[vi3] = pArr[i3];
      pos[vi3 + 1] = pArr[i3 + 1];
      pos[vi3 + 2] = pArr[i3 + 2];
      nor[vi3] = nArr[i3];
      nor[vi3 + 1] = nArr[i3 + 1];
      nor[vi3 + 2] = nArr[i3 + 2];
      if (uArr) {
        const i2 = i * 2, vi2 = (vOff + i) * 2;
        uv[vi2] = uArr[i2];
        uv[vi2 + 1] = uArr[i2 + 1];
      }
    }
    if (g.index) {
      const iArr = g.index.array;
      for (let i = 0; i < iArr.length; i++) {
        idx[iOff + i] = iArr[i] + vOff;
      }
      iOff += iArr.length;
    } else {
      for (let i = 0; i < pCount; i++) {
        idx[iOff + i] = i + vOff;
      }
      iOff += pCount;
    }
    vOff += pCount;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  merged.setIndex(new THREE.BufferAttribute(idx, 1));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}


function toOrientedExtrudeGeo(shape, depth, isH) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  if (!isH) {
    const pos = g.attributes.position, norm = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setX(i, z); pos.setZ(i, x);
      if (norm) {
        const nx = norm.getX(i), nz = norm.getZ(i);
        norm.setX(i, nz); norm.setZ(i, nx);
      }
    }
    for (let i = 0; i < pos.count; i += 3) {
      const x0 = pos.getX(i), y0 = pos.getY(i), z0 = pos.getZ(i);
      pos.setXYZ(i, pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
      pos.setXYZ(i + 1, x0, y0, z0);
      if (norm) {
        const nx0 = norm.getX(i), ny0 = norm.getY(i), nz0 = norm.getZ(i);
        norm.setXYZ(i, norm.getX(i + 1), norm.getY(i + 1), norm.getZ(i + 1));
        norm.setXYZ(i + 1, nx0, ny0, nz0);
      }
      if (uv) {
        const u0 = uv.getX(i), v0 = uv.getY(i);
        uv.setXY(i, uv.getX(i + 1), uv.getY(i + 1));
        uv.setXY(i + 1, u0, v0);
      }
    }
  }
  return g;
}

function makeArchedLeafGeometry(leaves, li, span, dh, sy, dep, isH) {
  const R = span / 2;
  const archH = dh - sy;
  const lw = leaves === 2 ? span / 2 : span;
  const lh = dh;
  const N = 32;
  const shape = new THREE.Shape();

  if (leaves === 2) {
    if (li === 0) {
      // Leaf 0 (left quadrant): Hinge at u = -lw/2, Meeting edge at u = +lw/2
      shape.moveTo(-lw / 2, -lh / 2);
      shape.lineTo(lw / 2, -lh / 2);
      shape.lineTo(lw / 2, lh / 2);
      for (let i = 0; i <= N; i++) {
        const theta = (Math.PI / 2) * (1 - i / N);
        const u = lw / 2 - R * Math.cos(theta);
        const y = sy + archH * Math.sin(theta) - lh / 2;
        shape.lineTo(u, y);
      }
      shape.lineTo(-lw / 2, -lh / 2);
    } else {
      // Leaf 1 (right quadrant): Meeting edge at u = -lw/2, Hinge at u = +lw/2
      shape.moveTo(-lw / 2, -lh / 2);
      shape.lineTo(lw / 2, -lh / 2);
      shape.lineTo(lw / 2, sy - lh / 2);
      for (let i = 0; i <= N; i++) {
        const theta = (Math.PI / 2) * (i / N);
        const u = R * Math.cos(theta) - lw / 2;
        const y = sy + archH * Math.sin(theta) - lh / 2;
        shape.lineTo(u, y);
      }
      shape.lineTo(-lw / 2, -lh / 2);
    }
  } else {
    // Single door (full semicircle): Hinge at -lw/2, Latch at +lw/2
    shape.moveTo(-lw / 2, -lh / 2);
    shape.lineTo(lw / 2, -lh / 2);
    shape.lineTo(lw / 2, sy - lh / 2);
    for (let i = 0; i <= N; i++) {
      const theta = Math.PI * (1 - i / N);
      const u = -R * Math.cos(theta);
      const y = sy + archH * Math.sin(theta) - lh / 2;
      shape.lineTo(u, y);
    }
    shape.lineTo(-lw / 2, -lh / 2);
  }

  const geo = toOrientedExtrudeGeo(shape, dep, isH);
  geo.parameters = {
    width: isH ? lw : dep,
    height: lh,
    depth: isH ? dep : lw
  };
  geo.computeBoundingBox();
  return geo;
}

function makeCurvedTopRailShape(leaves, li, span, dh, sy, railW) {
  const R = span / 2;
  const archH = dh - sy;
  const lw = leaves === 2 ? span / 2 : span;
  const lh = dh;
  const N = 24;
  const shape = new THREE.Shape();
  const Rin = Math.max(1, R - railW);

  if (leaves === 2) {
    if (li === 0) {
      shape.moveTo(-lw / 2, sy - lh / 2);
      for (let i = 0; i <= N; i++) {
        const theta = (Math.PI / 2) * (i / N);
        const u = lw / 2 - R * Math.cos(theta);
        const y = sy + archH * Math.sin(theta) - lh / 2;
        shape.lineTo(u, y);
      }
      shape.lineTo(lw / 2, lh / 2 - railW);
      for (let i = 0; i <= N; i++) {
        const theta = (Math.PI / 2) * (1 - i / N);
        const u = lw / 2 - Rin * Math.cos(theta);
        const y = sy + (Rin * (archH / R)) * Math.sin(theta) - lh / 2;
        shape.lineTo(u, y);
      }
      shape.closePath();
    } else {
      shape.moveTo(lw / 2, sy - lh / 2);
      shape.lineTo(lw / 2 - railW, sy - lh / 2);
      for (let i = 0; i <= N; i++) {
        const theta = (Math.PI / 2) * (i / N);
        const u = Rin * Math.cos(theta) - lw / 2;
        const y = sy + (Rin * (archH / R)) * Math.sin(theta) - lh / 2;
        shape.lineTo(u, y);
      }
      shape.lineTo(-lw / 2, lh / 2);
      for (let i = 0; i <= N; i++) {
        const theta = (Math.PI / 2) * (1 - i / N);
        const u = R * Math.cos(theta) - lw / 2;
        const y = sy + archH * Math.sin(theta) - lh / 2;
        shape.lineTo(u, y);
      }
      shape.closePath();
    }
  } else {
    shape.moveTo(-lw / 2, sy - lh / 2);
    for (let i = 0; i <= N; i++) {
      const theta = Math.PI * (i / N);
      const u = -R * Math.cos(theta);
      const y = sy + archH * Math.sin(theta) - lh / 2;
      shape.lineTo(u, y);
    }
    shape.lineTo(lw / 2 - railW, sy - lh / 2);
    for (let i = 0; i <= N; i++) {
      const theta = Math.PI * (1 - i / N);
      const u = -Rin * Math.cos(theta);
      const y = sy + (Rin * (archH / R)) * Math.sin(theta) - lh / 2;
      shape.lineTo(u, y);
    }
    shape.closePath();
  }
  return shape;
}

function makeUpperArchedPanelShape(leaves, li, span, dh, sy, stileW, railW, midRailH) {
  const R = span / 2;
  const archH = dh - sy;
  const lw = leaves === 2 ? span / 2 : span;
  const lh = dh;
  const N = 24;
  const yBot = (27 - lh / 2) + (midRailH || 3.4) / 2;
  const shape = new THREE.Shape();
  const rW = railW || 3.4;
  const sW = stileW || 2.4;
  const Rpan = Math.max(1, R - rW - 0.5);

  if (leaves === 2) {
    if (li === 0) {
      const uHinge = -lw / 2 + sW;
      const uMeet = lw / 2 - sW;
      shape.moveTo(uHinge, yBot);
      shape.lineTo(uMeet, yBot);
      const topMeetY = sy + (Rpan * (archH / R)) - lh / 2;
      shape.lineTo(uMeet, Math.max(yBot, topMeetY));
      for (let i = 0; i <= N; i++) {
        const theta = (Math.PI / 2) * (1 - i / N);
        const u = lw / 2 - Rpan * Math.cos(theta);
        const clampedU = Math.max(uHinge, Math.min(uMeet, u));
        const y = sy + (Rpan * (archH / R)) * Math.sin(theta) - lh / 2;
        shape.lineTo(clampedU, Math.max(yBot, y));
      }
      shape.lineTo(uHinge, yBot);
    } else {
      const uMeet = -lw / 2 + sW;
      const uHinge = lw / 2 - sW;
      shape.moveTo(uMeet, yBot);
      shape.lineTo(uHinge, yBot);
      const topHingeY = sy - lh / 2;
      shape.lineTo(uHinge, Math.max(yBot, topHingeY));
      for (let i = 0; i <= N; i++) {
        const theta = (Math.PI / 2) * (i / N);
        const u = Rpan * Math.cos(theta) - lw / 2;
        const clampedU = Math.max(uMeet, Math.min(uHinge, u));
        const y = sy + (Rpan * (archH / R)) * Math.sin(theta) - lh / 2;
        shape.lineTo(clampedU, Math.max(yBot, y));
      }
      shape.lineTo(uMeet, yBot);
    }
  } else {
    const uLeft = -lw / 2 + sW;
    const uRight = lw / 2 - sW;
    shape.moveTo(uLeft, yBot);
    shape.lineTo(uRight, yBot);
    shape.lineTo(uRight, Math.max(yBot, sy - lh / 2));
    for (let i = 0; i <= N; i++) {
      const theta = Math.PI * (1 - i / N);
      const u = -Rpan * Math.cos(theta);
      const clampedU = Math.max(uLeft, Math.min(uRight, u));
      const y = sy + (Rpan * (archH / R)) * Math.sin(theta) - lh / 2;
      shape.lineTo(clampedU, Math.max(yBot, y));
    }
    shape.lineTo(uLeft, yBot);
  }
  return shape;
}
const DOOR_STYLE_THEMES = {
  panel: {
    frameKind: 'wood', frameColor: '#5c4033',
    leafWood: '#5c4033', leafTrim: '#4a3325', leafPanel: '#65483a',
    hardwareKind: 'metal', hardwareColor: '#c89d46',
    sillColor: '#3a3835'
  },
  arched: {
    frameKind: 'wood', frameColor: '#5c4033',
    leafWood: '#5c4033', leafTrim: '#4a3325', leafPanel: '#65483a',
    hardwareKind: 'metal', hardwareColor: '#c89d46',
    sillColor: '#3a3835'
  },
  slide: {
    frameKind: 'wood', frameColor: '#3d2c1d',
    leafWood: '#63442a', leafTrim: '#4e331e', leafPanel: '#6d4c30',
    hardwareKind: 'metal', hardwareColor: '#1a1b1d',
    sillColor: '#322014'
  },
  glass: {
    frameKind: 'metal', frameColor: '#1d1f22',
    leafWood: '#242629', leafTrim: '#1a1b1d', leafPanel: '#2d3034',
    hardwareKind: 'metal', hardwareColor: '#dce0e5',
    sillColor: '#1e2023'
  },
  modern: {
    frameKind: 'metal', frameColor: '#282a2e',
    leafWood: '#26282c', leafTrim: '#1c1d20', leafPanel: '#2e3035',
    hardwareKind: 'metal', hardwareColor: '#94a3b8',
    sillColor: '#202226'
  },
  slideglass: {
    frameKind: 'metal', frameColor: '#282a2e',
    leafWood: '#242629', leafTrim: '#1a1b1d', leafPanel: '#2d3034',
    hardwareKind: 'metal', hardwareColor: '#dce0e5',
    sillColor: '#1e2023'
  },
  archway: {
    frameKind: 'stone', frameColor: '#ede8df',
    sillColor: '#3a3835'
  }
};
HP.DOOR_STYLE_THEMES = DOOR_STYLE_THEMES;
const WALL_DOOR_THEMES = DOOR_STYLE_THEMES;
HP.WALL_DOOR_THEMES = DOOR_STYLE_THEMES;

function resolveDoorWallStyle(lvl, a) {
  if (!lvl || !lvl.walls) return { style: HP.wallStyle || 'plaster', ca: '#f4efe4', cb: '#f4efe4' };
  const k = a ? a.k : null;
  const isH = a ? a.d === 'h' : false;
  const seg = k ? HP.parseWallKey(k) : null;
  const leaves = (a && a.dbl) ? 2 : 1;

  let isExt = false;
  if (a && a.ext !== undefined) {
    isExt = !!a.ext;
  } else if (seg && lvl) {
    const env = (HP.world3d && HP.world3d.geomEnv) ? HP.world3d.geomEnv(lvl) : (HP.geomEnv && HP.geomEnv(lvl));
    if (env && env.rAt) {
      const ra = isH ? env.rAt(seg.x, seg.y - 1) : env.rAt(seg.x - 1, seg.y);
      const rb = isH ? env.rAt(seg.x, seg.y)     : env.rAt(seg.x, seg.y);
      if (ra < 0 || rb < 0) isExt = true;
    }
  }

  const getDefColor = (st) => {
    if (st === 'brick' || st === 'brick_white' || st === 'stone' || st === 'tile' || st === 'concrete' || st === 'marble') return '#ffffff';
    if (st === 'wood' || st === 'shiplap') return '#ffffff';
    if (st === 'glass') return '#cde5eb';
    return isExt ? '#e9e2d2' : '#f4efe4';
  };

  if (k) {
    const keys = [k];
    if (a.dbl && seg) {
      keys.push(isH ? 'h,' + (seg.x + 1) + ',' + seg.y : 'v,' + seg.x + ',' + (seg.y + 1));
    }
    for (const key of keys) {
      const w = lvl.walls[key];
      if (w && (w.style || w._resolvedStyle || w.ca || w._resolvedCa || w.cb || w._resolvedCb)) {
        const st = w.style || w._resolvedStyle || HP.wallStyle || 'plaster';
        const defC = getDefColor(st);
        return { style: st, ca: w.ca || w._resolvedCa || defC, cb: w.cb || w._resolvedCb || defC };
      }
    }
  }

  // Walk along continuous collinear wall run in negative and positive directions
  if (seg) {
    for (const dir of [-1, 1]) {
      for (let step = 1; step <= 25; step++) {
        const offset = (dir < 0) ? -step : (leaves - 1 + step);
        const nx = isH ? seg.x + offset : seg.x;
        const ny = isH ? seg.y : seg.y + offset;
        const nk = (isH ? 'h,' : 'v,') + nx + ',' + ny;
        const nw = lvl.walls[nk];
        if (!nw) break;
        if (nw.style || nw._resolvedStyle || nw.ca || nw._resolvedCa || nw.cb || nw._resolvedCb) {
          const st = nw.style || nw._resolvedStyle || HP.wallStyle || 'plaster';
          const defC = getDefColor(st);
          return { style: st, ca: nw.ca || nw._resolvedCa || defC, cb: nw.cb || nw._resolvedCb || defC };
        }
      }
    }

    // Check perpendicular corner connections
    for (const endIdx of [0, leaves]) {
      const vx = isH ? seg.x + endIdx : seg.x;
      const vy = isH ? seg.y : seg.y + endIdx;
      const perpKeys = isH
        ? [`v,${vx},${vy}`, `v,${vx},${vy - 1}`]
        : [`h,${vx},${vy}`, `h,${vx - 1},${vy}`];
      for (const pk of perpKeys) {
        const pw = lvl.walls[pk];
        if (pw && (pw.style || pw._resolvedStyle || pw.ca || pw._resolvedCa || pw.cb || pw._resolvedCb)) {
          const st = pw.style || pw._resolvedStyle || HP.wallStyle || 'plaster';
          const defC = getDefColor(st);
          return { style: st, ca: pw.ca || pw._resolvedCa || defC, cb: pw.cb || pw._resolvedCb || defC };
        }
      }
    }
  }

  const defStyle = HP.wallStyle || 'plaster';
  const defC = getDefColor(defStyle);
  return { style: defStyle, ca: defC, cb: defC };
}
W3.resolveDoorWallStyle = resolveDoorWallStyle;

function setDoorWallStyle(k, style) {
  const lvl = HP.cur ? HP.cur() : null;
  if (!lvl || !lvl.walls) return;
  const w = lvl.walls[k];
  if (!w) return;
  const s = HP.parseWallKey(k);
  w.style = style;
  const isH = s.d === 'h';
  const adjKeys = [
    isH ? 'h,' + (s.x + 1) + ',' + s.y : 'v,' + s.x + ',' + (s.y + 1),
    isH ? 'h,' + (s.x - 1) + ',' + s.y : 'v,' + s.x + ',' + (s.y - 1)
  ];
  for (const ak of adjKeys) {
    if (lvl.walls[ak] && lvl.walls[ak].f === 'door') {
      lvl.walls[ak].style = style;
    }
  }
  for (const dir of [-1, 1]) {
    for (let step = 1; step <= 25; step++) {
      const nx = isH ? s.x + dir * step : s.x;
      const ny = isH ? s.y : s.y + dir * step;
      const nk = (isH ? 'h,' : 'v,') + nx + ',' + ny;
      const nw = lvl.walls[nk];
      if (!nw) break;
      nw.style = style;
    }
  }
  HP.wallStyle = style;
  if (HP.world3d && HP.world3d.buildLevel) {
    HP.world3d.buildLevel();
  }
}
W3.setDoorWallStyle = setDoorWallStyle;
HP.setDoorWallStyle = setDoorWallStyle;

function buildDoorFrame(a, s0, s1, parentGroup) {
  const isH = a.d === 'h';
  const span = s1 - s0;
  const midU = (s0 + s1) / 2;
  const wThick = isH ? Math.abs(a.z1 - a.z0) : Math.abs(a.x1 - a.x0);
  const wMid = isH ? (a.z0 + a.z1) / 2 : (a.x0 + a.x1) / 2;
  const dh = HP.geom3d.DOOR_H; // 58

  const lvl = (a && a.lvl) || HP.cur();
  const rec = lvl && lvl.walls && lvl.walls[a.k];
  const doorStyle = (a && a.forcedStyle) || (rec && rec.doorStyle) || 'panel';
  const isModern = doorStyle === 'modern' || doorStyle === 'slideglass';
  const isSlide = doorStyle === 'slide';
  const isGlass = doorStyle === 'glass';
  const isArch = doorStyle === 'archway' || doorStyle === 'arched';

  const theme = DOOR_STYLE_THEMES[doorStyle] || DOOR_STYLE_THEMES.panel;
  const ws = resolveDoorWallStyle(lvl, a);
  const wallStyle = ws.style;
  const wallCol = ws.ca;

  let frameMat, wallMat;
  if (doorStyle === 'archway') {
    const isStone = (wallStyle === 'brick' || wallStyle === 'brick_white' || wallStyle === 'stone' || wallStyle === 'concrete');
    const casingKind = isStone ? 'stone' : theme.frameKind;
    const casingColor = isStone ? (ws.ca || '#ede8df') : theme.frameColor;
    frameMat = HP.graphics3d ? HP.graphics3d.material(casingKind, casingColor) : new THREE.MeshLambertMaterial({ color: 0xede8df });
    wallMat = (HP.world3d && HP.world3d.getWallMat)
      ? HP.world3d.getWallMat(wallStyle)
      : (HP.graphics3d ? HP.graphics3d.worldUV(HP.graphics3d.material(wallStyle, wallCol).clone(), (HP.CELL || 28) * 2) : frameMat);
  } else if (doorStyle === 'arched') {
    frameMat = HP.graphics3d ? HP.graphics3d.material(theme.frameKind, theme.frameColor) : new THREE.MeshLambertMaterial({ color: 0x5c4033 });
    wallMat = (HP.world3d && HP.world3d.getWallMat)
      ? HP.world3d.getWallMat(wallStyle)
      : (HP.graphics3d ? HP.graphics3d.worldUV(HP.graphics3d.material(wallStyle, wallCol).clone(), (HP.CELL || 28) * 2) : frameMat);
  } else {
    frameMat = HP.graphics3d ? HP.graphics3d.material(theme.frameKind, theme.frameColor) : new THREE.MeshLambertMaterial({ color: 0x5c4033 });
  }
  const sillMat = HP.graphics3d ? HP.graphics3d.material('metal', theme.sillColor) : new THREE.MeshLambertMaterial({ color: 0x3e4146 });

  const group = new THREE.Group();
  const bY = (a && a.baseY) || 0;
  group.position.y = bY;
  const jt = 0.8;
  const jd = Math.max(3.2, wThick + 0.4);

  if (isArch) {
    const R = span / 2;
    const sy = Math.max(30, dh - R);
    const archH = dh - sy;
    const frameGeos = [];
    const spandrelGeos = [];
    const casingW = 2.4;
    const casingT = 0.75;
    const reveal = doorStyle === 'arched' ? 1.6 : 0;
    const N = 36;

    // Left jamb up to springline
    const leftGeo = new THREE.BoxGeometry(isH ? jt : jd, sy, isH ? jd : jt);
    leftGeo.translate(isH ? s0 + jt / 2 : wMid, sy / 2, isH ? wMid : s0 + jt / 2);
    frameGeos.push(leftGeo);

    // Right jamb up to springline
    const rightGeo = new THREE.BoxGeometry(isH ? jt : jd, sy, isH ? jd : jt);
    rightGeo.translate(isH ? s1 - jt / 2 : wMid, sy / 2, isH ? wMid : s1 - jt / 2);
    frameGeos.push(rightGeo);

    // Curved arch soffit — smooth continuous curved band (CCW)
    const soffitShape = new THREE.Shape();
    soffitShape.moveTo(-(R + jt), sy);
    soffitShape.lineTo(-R, sy);
    for (let i = 0; i <= N; i++) {
      const theta = Math.PI * (i / N);
      const u = -R * Math.cos(theta);
      const y = sy + archH * Math.sin(theta);
      soffitShape.lineTo(u, y);
    }
    soffitShape.lineTo(R + jt, sy);
    for (let i = 0; i <= N; i++) {
      const theta = Math.PI * (1 - i / N);
      const u = -(R + jt) * Math.cos(theta);
      const y = sy + (archH + jt) * Math.sin(theta);
      soffitShape.lineTo(u, y);
    }
    soffitShape.closePath();
    const soffitGeo = toOrientedExtrudeGeo(soffitShape, jd, isH);
    soffitGeo.translate(isH ? midU : wMid, 0, isH ? wMid : midU);
    frameGeos.push(soffitGeo);

    // Solid smooth spandrels filling top corners using the exact wall material & color (pure CCW)
    const leftSpShape = new THREE.Shape();
    leftSpShape.moveTo(-R, sy);
    for (let i = 0; i <= N; i++) {
      const theta = (Math.PI / 2) * (i / N);
      const u = -R * Math.cos(theta);
      const y = sy + archH * Math.sin(theta);
      leftSpShape.lineTo(u, y);
    }
    leftSpShape.lineTo(-R, dh);
    leftSpShape.lineTo(-R, sy);
    leftSpShape.closePath();
    const lSpGeo = toOrientedExtrudeGeo(leftSpShape, wThick, isH);
    lSpGeo.translate(isH ? midU : wMid, 0, isH ? wMid : midU);
    spandrelGeos.push(lSpGeo);

    const rightSpShape = new THREE.Shape();
    rightSpShape.moveTo(R, sy);
    rightSpShape.lineTo(R, dh);
    rightSpShape.lineTo(0, dh);
    for (let i = N; i >= 0; i--) {
      const theta = (Math.PI / 2) * (i / N);
      const u = R * Math.cos(theta);
      const y = sy + archH * Math.sin(theta);
      rightSpShape.lineTo(u, y);
    }
    rightSpShape.closePath();
    const rSpGeo = toOrientedExtrudeGeo(rightSpShape, wThick, isH);
    rSpGeo.translate(isH ? midU : wMid, 0, isH ? wMid : midU);
    spandrelGeos.push(rSpGeo);

    // Arch casing trim bands on both wall faces with architectural reveal (CCW)
    const archCasingShape = new THREE.Shape();
    archCasingShape.moveTo(-(R + casingW), sy);
    archCasingShape.lineTo(-(R - reveal), sy);
    for (let i = 0; i <= N; i++) {
      const theta = Math.PI * (i / N);
      const u = -(R - reveal) * Math.cos(theta);
      const y = sy + (archH - reveal) * Math.sin(theta);
      archCasingShape.lineTo(u, y);
    }
    archCasingShape.lineTo(R + casingW, sy);
    for (let i = 0; i <= N; i++) {
      const theta = Math.PI * (1 - i / N);
      const u = -(R + casingW) * Math.cos(theta);
      const y = sy + (archH + casingW) * Math.sin(theta);
      archCasingShape.lineTo(u, y);
    }
    archCasingShape.closePath();

    const ksTopW = casingW * 1.8, ksBotW = casingW * 1.2, ksH = casingW * 2.2;
    const keystoneShape = new THREE.Shape();
    keystoneShape.moveTo(-ksBotW / 2, -ksH / 2);
    keystoneShape.lineTo(ksBotW / 2, -ksH / 2);
    keystoneShape.lineTo(ksTopW / 2, ksH / 2);
    keystoneShape.lineTo(-ksTopW / 2, ksH / 2);
    keystoneShape.closePath();

    const sideW = casingW + reveal;
    for (const f of [-1, 1]) {
      const facePos = wMid + f * (wThick / 2 + casingT / 2);

      const cl = new THREE.BoxGeometry(isH ? sideW : casingT, sy, isH ? casingT : sideW);
      cl.translate(isH ? s0 - casingW / 2 + reveal / 2 : facePos, sy / 2, isH ? facePos : s0 - casingW / 2 + reveal / 2);
      frameGeos.push(cl);

      const cr = new THREE.BoxGeometry(isH ? sideW : casingT, sy, isH ? casingT : sideW);
      cr.translate(isH ? s1 + casingW / 2 - reveal / 2 : facePos, sy / 2, isH ? facePos : s1 + casingW / 2 - reveal / 2);
      frameGeos.push(cr);

      for (const iu of [s0 - casingW / 2 + reveal / 2, s1 + casingW / 2 - reveal / 2]) {
        const imp = new THREE.BoxGeometry(isH ? sideW * 1.25 : casingT * 1.4, 1.4, isH ? casingT * 1.4 : sideW * 1.25);
        imp.translate(isH ? iu : facePos, sy, isH ? facePos : iu);
        frameGeos.push(imp);
      }

      const acGeo = toOrientedExtrudeGeo(archCasingShape, casingT, isH);
      acGeo.translate(isH ? midU : facePos, 0, isH ? facePos : midU);
      frameGeos.push(acGeo);

      const ksGeo = toOrientedExtrudeGeo(keystoneShape, casingT * 1.5, isH);
      ksGeo.translate(isH ? midU : facePos + f * 0.15, dh + casingW / 2, isH ? facePos + f * 0.15 : midU);
      frameGeos.push(ksGeo);
    }

    const mergedSpandrel = mergeGeometries(spandrelGeos);
    if (mergedSpandrel) {
      const spandrelMesh = new THREE.Mesh(mergedSpandrel, wallMat || frameMat);
      spandrelMesh.castShadow = spandrelMesh.receiveShadow = true;
      group.add(spandrelMesh);
    }

    const mergedFrame = mergeGeometries(frameGeos);
    if (mergedFrame) {
      const frameMesh = new THREE.Mesh(mergedFrame, frameMat);
      frameMesh.castShadow = frameMesh.receiveShadow = true;
      group.add(frameMesh);
    }

    if (doorStyle === 'arched') {
      const sillH = 0.35, sillD = jd + 0.4;
      const sillGeo = new THREE.BoxGeometry(isH ? span : sillD, sillH, isH ? sillD : span);
      const sillMesh = new THREE.Mesh(sillGeo, sillMat);
      sillMesh.position.set(isH ? midU : wMid, sillH / 2, isH ? wMid : midU);
      sillMesh.receiveShadow = true;
      group.add(sillMesh);
    }

    parentGroup.add(group);
    return group;
  }

  // Top header jamb
  const headGeo = new THREE.BoxGeometry(isH ? span : jd, jt, isH ? jd : span);
  const headMesh = new THREE.Mesh(headGeo, frameMat);
  headMesh.position.set(isH ? midU : wMid, dh - jt / 2, isH ? wMid : midU);
  headMesh.castShadow = headMesh.receiveShadow = true;
  group.add(headMesh);

  // Left jamb
  const sideGeo = new THREE.BoxGeometry(isH ? jt : jd, dh - jt, isH ? jd : jt);
  const leftMesh = new THREE.Mesh(sideGeo, frameMat);
  leftMesh.position.set(isH ? s0 + jt / 2 : wMid, (dh - jt) / 2, isH ? wMid : s0 + jt / 2);
  leftMesh.castShadow = leftMesh.receiveShadow = true;
  group.add(leftMesh);

  // Right jamb
  const rightMesh = new THREE.Mesh(sideGeo, frameMat);
  rightMesh.position.set(isH ? s1 - jt / 2 : wMid, (dh - jt) / 2, isH ? wMid : s1 - jt / 2);
  rightMesh.castShadow = rightMesh.receiveShadow = true;
  group.add(rightMesh);

  // Architectural casing trim on front & back wall faces framing the doorway
  const cW = 1.6;  // 1.6px wide trim on wall face
  const cT = 0.52; // 0.52px thickness protruding cleanly proud of wall face
  const cHeadGeo = new THREE.BoxGeometry(isH ? span + 2 * cW : cT, cW, isH ? cT : span + 2 * cW);
  const cSideGeo = new THREE.BoxGeometry(isH ? cW : cT, dh, isH ? cT : cW);
  for (const f of [-1, 1]) {
    const faceZ = wMid + f * (wThick / 2 + cT / 2);
    const cHeadMesh = new THREE.Mesh(cHeadGeo, frameMat);
    cHeadMesh.position.set(isH ? midU : faceZ, dh + cW / 2, isH ? faceZ : midU);
    cHeadMesh.castShadow = true;
    group.add(cHeadMesh);

    const cLeftMesh = new THREE.Mesh(cSideGeo, frameMat);
    cLeftMesh.position.set(isH ? s0 - cW / 2 : faceZ, dh / 2, isH ? faceZ : s0 - cW / 2);
    cLeftMesh.castShadow = true;
    group.add(cLeftMesh);

    const cRightMesh = new THREE.Mesh(cSideGeo, frameMat);
    cRightMesh.position.set(isH ? s1 + cW / 2 : faceZ, dh / 2, isH ? faceZ : s1 + cW / 2);
    cRightMesh.castShadow = true;
    group.add(cRightMesh);
  }

  // Floor sill / threshold
  const sillH = 0.35, sillD = jd + 0.4;
  const sillGeo = new THREE.BoxGeometry(isH ? span : sillD, sillH, isH ? sillD : span);
  const sillMesh = new THREE.Mesh(sillGeo, sillMat);
  sillMesh.position.set(isH ? midU : wMid, sillH / 2, isH ? wMid : midU);
  sillMesh.receiveShadow = true;
  group.add(sillMesh);

  if (doorStyle === 'slideglass') {
    // Twin metallic runner rails embedded into the floor sill (clearly visible when doors slide open)
    const railMat = HP.graphics3d ? HP.graphics3d.material('metal', '#b0b5be') : new THREE.MeshLambertMaterial({ color: 0xb0b5be });
    const railW = 0.16, railH = 0.18;
    for (const rOff of [-0.5, 0.5]) {
      const rGeo = new THREE.BoxGeometry(isH ? span : railW, railH, isH ? railW : span);
      const rMesh = new THREE.Mesh(rGeo, railMat);
      rMesh.position.set(isH ? midU : wMid + rOff, sillH + railH / 2, isH ? wMid + rOff : midU);
      rMesh.receiveShadow = true;
      group.add(rMesh);
    }

    // Top integrated guide track channel inside the header jamb
    const headTrackMat = HP.graphics3d ? HP.graphics3d.material('metal', '#282b30') : frameMat;
    const htGeo = new THREE.BoxGeometry(isH ? span : 1.4, 0.25, isH ? 1.4 : span);
    const htMesh = new THREE.Mesh(htGeo, headTrackMat);
    htMesh.position.set(isH ? midU : wMid, dh - jt - 0.12, isH ? wMid : midU);
    group.add(htMesh);
  }

  parentGroup.add(group);
  return group;
}
W3.buildDoorFrame = buildDoorFrame;
W3.populateDoorLeaf = populateDoorLeaf;

function populateDoorLeaf(dp, a, leaves, li, span, s0, s1, post0, post1, leafMat, knobMat, knobGeo) {
  const lvl = (a && a.lvl) || HP.cur();
  const rec = lvl && lvl.walls && lvl.walls[a.k];
  const doorStyle = (a && a.forcedStyle) || (rec && rec.doorStyle) || 'panel';
  const isSlide = doorStyle === 'slide' || doorStyle === 'slideglass';
  const isGlass = doorStyle === 'glass' || doorStyle === 'slideglass';
  const isModern = doorStyle === 'modern';
  const flipVal = a.flip !== undefined ? a.flip : 1;
  const isH = a.d === 'h';
  const isSlideGlass = doorStyle === 'slideglass';
  const dh = HP.geom3d.DOOR_H; // 58
  const jt = 0.8;
  const sillH = 0.35;
  const lh = isSlideGlass ? (dh - jt - sillH) : (HP.geom3d.DOOR_H + 1);
  const pivot = dp.pivot;

  const box3d = (sizeU, sizeY, sizeV) => new THREE.BoxGeometry(isH ? sizeU : sizeV, sizeY, isH ? sizeV : sizeU);
  const setPos = (mesh, u, py, v) => mesh.position.set(isH ? u : v, py, isH ? v : u);

  while (pivot.children.length) {
    const c = pivot.children[0];
    pivot.remove(c);
    if (c.geometry && !c.geometry.userData?.shared3d) c.geometry.dispose();
  }

  if (doorStyle === 'archway') {
    dp.doorStyle = 'archway';
    dp.leaf = null;
    dp.knob = null;
    return;
  }

  const lw = isSlideGlass
    ? (leaves === 2 ? span / 2 + 0.6 : span - 0.4)
    : (isSlide
      ? (leaves === 2 ? span / 2 + 1.2 : span + 1.6)
      : (leaves === 2 ? span / 2 + 1 : span + (post1 ? 0 : 1)));
  const dep = isSlideGlass ? 0.9 : (isSlide ? 2.6 : 4.4);

  let leaf, knob;

  if (isSlide) {
    let closedCenter = 0;
    if (leaves === 1) {
      closedCenter = (s0 + s1) / 2;
    } else {
      closedCenter = li === 0 ? s0 + span / 4 : s1 - span / 4;
    }

    const bY = (a && a.baseY) || 0;
    if (isSlideGlass) {
      // Inset patio slider: leaves sit directly on the floor sill tracks inside the frame opening
      const wMid = isH ? (a.z0 + a.z1) / 2 : (a.x0 + a.x1) / 2;
      const trackOff = leaves === 2 ? (li === 0 ? -0.5 : 0.5) : -0.5;
      const faceZ = isH ? wMid + trackOff : closedCenter;
      const faceX = isH ? closedCenter : wMid + trackOff;
      pivot.position.set(faceX, bY + sillH, faceZ);
    } else {
      const bypassOffset = leaves === 2 ? (li === 0 ? -0.4 : 0.4) : 0;
      const faceZ = isH ? (flipVal > 0 ? a.z0 - (dep / 2 + 0.4 + bypassOffset) : a.z1 + (dep / 2 + 0.4 + bypassOffset)) : closedCenter;
      const faceX = isH ? closedCenter : (flipVal > 0 ? a.x0 - (dep / 2 + 0.4 + bypassOffset) : a.x1 + (dep / 2 + 0.4 + bypassOffset));
      pivot.position.set(faceX, bY, faceZ);
    }

    if (doorStyle === 'slideglass') {
      // Sliding Glass Door: sleek aluminum perimeter frame with crystal clear glass
      const frameMat = HP.graphics3d ? HP.graphics3d.material('metal', '#282b30') : knobMat;
      const glassMat = HP.graphics3d ? HP.graphics3d.material('glass', '#bfe3ea') : new THREE.MeshLambertMaterial({ color: 0x9fd4e8, transparent: true, opacity: 0.35 });

      leaf = new THREE.Mesh(box3d(lw, lh, dep), glassMat);
      leaf.position.set(0, lh / 2, 0);
      pivot.add(leaf);

      const stileW = 1.8;
      const topRailH = 2.4;
      const botRailH = 3.2;
      const innerW = lw - stileW * 2;

      // Top rail
      const topRail = new THREE.Mesh(box3d(lw, topRailH, dep + 0.1), frameMat);
      setPos(topRail, 0, lh / 2 - topRailH / 2, 0);
      topRail.castShadow = topRail.receiveShadow = true;
      leaf.add(topRail);

      // Bottom rail
      const botRail = new THREE.Mesh(box3d(lw, botRailH, dep + 0.1), frameMat);
      setPos(botRail, 0, -lh / 2 + botRailH / 2, 0);
      botRail.castShadow = botRail.receiveShadow = true;
      leaf.add(botRail);

      // Left stile
      const leftStile = new THREE.Mesh(box3d(stileW, lh - topRailH - botRailH, dep + 0.1), frameMat);
      setPos(leftStile, -lw / 2 + stileW / 2, (botRailH - topRailH) / 2, 0);
      leftStile.castShadow = leftStile.receiveShadow = true;
      leaf.add(leftStile);

      // Right stile
      const rightStile = new THREE.Mesh(box3d(stileW, lh - topRailH - botRailH, dep + 0.1), frameMat);
      setPos(rightStile, lw / 2 - stileW / 2, (botRailH - topRailH) / 2, 0);
      rightStile.castShadow = rightStile.receiveShadow = true;
      leaf.add(rightStile);

      // Integrated vertical pull handle along leading stile
      const pullMat = HP.graphics3d ? HP.graphics3d.material('metal', '#d0d3d8') : knobMat;
      const handleU = leaves === 2 ? (li === 0 ? lw / 2 - 1.8 : -lw / 2 + 1.8) : (lw / 2 - 1.8);
      knob = new THREE.Mesh(box3d(0.6, 14, dep + 0.35), pullMat);
      setPos(knob, handleU, 27, 0);
      pivot.add(knob);
    } else {
      // Sliding Barn Door ('slide'): Refined craftsman timber slab with perimeter stiles/rails, vertical planking, balanced braces & sleek iron hardware
      const woodMat = HP.graphics3d ? HP.graphics3d.material('wood', '#6a4c33') : leafMat;
      const trimMat = HP.graphics3d ? HP.graphics3d.material('wood', '#563c26') : leafMat;
      const ironMat = HP.graphics3d ? HP.graphics3d.material('metal', '#18191b') : knobMat;

      // Base slab
      leaf = new THREE.Mesh(box3d(lw, lh, dep), woodMat);
      leaf.position.set(0, lh / 2 - 0.5, 0);
      leaf.castShadow = leaf.receiveShadow = true;
      pivot.add(leaf);

      // Perimeter craftsman stiles & rails (front and back)
      const stileW = 2.4;
      const topRailH = 3.4;
      const botRailH = 4.8;
      const midRailH = 3.2;
      const trimDep = dep + 0.16;

      // Center mid-rail
      const midRail = new THREE.Mesh(box3d(lw - 0.2, midRailH, trimDep), trimMat);
      leaf.add(midRail);

      // Top rail
      const topRail = new THREE.Mesh(box3d(lw - 0.2, topRailH, trimDep), trimMat);
      setPos(topRail, 0, lh / 2 - topRailH / 2, 0);
      leaf.add(topRail);

      // Bottom rail
      const botRail = new THREE.Mesh(box3d(lw - 0.2, botRailH, trimDep), trimMat);
      setPos(botRail, 0, -lh / 2 + botRailH / 2, 0);
      leaf.add(botRail);

      // Left stile
      const leftStile = new THREE.Mesh(box3d(stileW, lh - topRailH - botRailH, trimDep), trimMat);
      setPos(leftStile, -lw / 2 + stileW / 2, (botRailH - topRailH) / 2, 0);
      leaf.add(leftStile);

      // Right stile
      const rightStile = new THREE.Mesh(box3d(stileW, lh - topRailH - botRailH, trimDep), trimMat);
      setPos(rightStile, lw / 2 - stileW / 2, (botRailH - topRailH) / 2, 0);
      leaf.add(rightStile);

      // Subtle vertical plank grooves across the central panels
      const innerW = lw - stileW * 2;
      const plankStep = 3.6;
      for (let pu = -innerW / 2 + plankStep; pu < innerW / 2 - 0.5; pu += plankStep) {
        for (const side of [-1, 1]) {
          const groove = new THREE.Mesh(box3d(0.18, lh - topRailH - botRailH - 0.2, 0.12), trimMat);
          setPos(groove, pu, (botRailH - topRailH) / 2, side * (dep / 2 + 0.04));
          leaf.add(groove);
        }
      }

      // Elegant craftsman diagonal bracing (symmetrical on double doors, classic Z on single)
      // On double doors: leaf 0 has slant / and leaf 1 has slant \ to form a balanced craftsman V pattern
      const braceSlope = leaves === 2 ? (li === 0 ? 1 : -1) : 1;
      const bayH = (lh - topRailH - botRailH - midRailH) / 2;
      const bayW = innerW;
      const bLen = Math.hypot(bayW, bayH);
      const bAng = Math.atan2(bayH, bayW);

      for (const side of [-1, 1]) {
        const braceZ = side * (dep / 2 + 0.11);
        // Upper diagonal brace
        const b1 = new THREE.Mesh(box3d(bLen, 2.2, 0.22), trimMat);
        const b1Y = (botRailH - topRailH) / 2 + bayH / 2 + midRailH / 2;
        setPos(b1, 0, b1Y, braceZ);
        if (isH) b1.rotation.z = -bAng * braceSlope; else b1.rotation.x = -bAng * braceSlope;
        leaf.add(b1);

        // Lower diagonal brace
        const b2 = new THREE.Mesh(box3d(bLen, 2.2, 0.22), trimMat);
        const b2Y = (botRailH - topRailH) / 2 - bayH / 2 - midRailH / 2;
        setPos(b2, 0, b2Y, braceZ);
        if (isH) b2.rotation.z = bAng * braceSlope; else b2.rotation.x = bAng * braceSlope;
        leaf.add(b2);
      }

      // Refined architectural hanger straps with low-profile pulley wheels
      const hOffset = Math.max(2.8, lw * 0.28);
      for (const ho of [-hOffset, hOffset]) {
        // Vertical iron strap
        const strap = new THREE.Mesh(box3d(0.95, 6.2, 0.38), ironMat);
        setPos(strap, ho, lh + 0.8, 0);
        pivot.add(strap);

        // Pulley wheel on the overhead track
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.45, 16), ironMat);
        if (isH) wheel.rotation.x = Math.PI / 2; else wheel.rotation.z = Math.PI / 2;
        setPos(wheel, ho, lh + 3.2, 0);
        pivot.add(wheel);

        // Center axle hub pin
        const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.55, 10), ironMat);
        if (isH) axle.rotation.x = Math.PI / 2; else axle.rotation.z = Math.PI / 2;
        setPos(axle, ho, lh + 3.2, 0);
        pivot.add(axle);

        // Fastener bolt rivets along the strap
        for (const by of [lh - 0.8, lh - 3.2]) {
          const bolt = new THREE.Mesh(box3d(0.45, 0.45, 0.55), ironMat);
          setPos(bolt, ho, by, 0);
          pivot.add(bolt);
        }
      }

      // Dual ergonomic handles:
      // Front (room) side: vertical D-pull handle bar on standoffs
      // Back (wall) side: flush recessed cup pull so the door slides along the wall with proper clearance
      const handleU = leaves === 2 ? (li === 0 ? lw / 2 - 2.2 : -lw / 2 + 2.2) : (lw / 2 - 2.2);
      const pullBar = new THREE.Mesh(box3d(0.6, 11.0, 0.6), ironMat);
      setPos(pullBar, handleU, 27, dep / 2 + 0.7);
      pivot.add(pullBar);

      for (const py of [27 - 4.5, 27 + 4.5]) {
        const standoff = new THREE.Mesh(box3d(0.45, 0.45, 0.7), ironMat);
        setPos(standoff, handleU, py, dep / 2 + 0.35);
        pivot.add(standoff);
      }

      // Backside flush cup pull
      const cupPull = new THREE.Mesh(box3d(1.1, 7.5, 0.1), ironMat);
      setPos(cupPull, handleU, 27, -(dep / 2 + 0.05));
      pivot.add(cupPull);
      knob = pullBar;
    }

    // Determine slide direction away from obstructions:
    let du = 0;
    if (isSlideGlass) {
      if (leaves === 2) {
        // Double patio slider: each panel slides independently along its own track (left glides right, right glides left)
        du = li === 0 ? (span / 2 - 0.8) : -(span / 2 - 0.8);
      } else {
        du = -lw * 0.95;
      }
    } else if (leaves === 1) {
      if (post1 && !post0) du = -lw * 0.95;
      else if (post0 && !post1) du = lw * 0.95;
      else {
        const seg = HP.parseWallKey(a.k);
        const wLeft = isH ? lvl?.walls?.[`h,${seg.x - 1},${seg.y}`] : lvl?.walls?.[`v,${seg.x},${seg.y - 1}`];
        const wRight = isH ? lvl?.walls?.[`h,${seg.x + 1},${seg.y}`] : lvl?.walls?.[`v,${seg.x},${seg.y + 1}`];
        const leftIsWall = wLeft && !wLeft.f;
        const rightIsWall = wRight && !wRight.f;
        if (leftIsWall && !rightIsWall) du = -lw * 0.95;
        else du = lw * 0.95;
      }
    } else {
      // Double sliding barn doors: both leaves slide outwards to open the doorway completely
      du = li === 0 ? -lw * 0.95 : lw * 0.95;
    }
    const slideVec = isH ? { x: du, y: 0, z: 0 } : { x: 0, y: 0, z: du };

    dp.slide = slideVec;
    dp.base = pivot.position.clone();
    dp.halfX = (isH ? lw : dep) / 2;
    dp.halfZ = (isH ? dep : lw) / 2;
    dp.halfY = lh / 2;
  } else {
    dp.slide = null;
    dp.base = null;
    const pz = isH ? (flipVal > 0 ? a.z0 : a.z1) : (li === 0 ? s0 : s1);
    const px = isH ? (li === 0 ? s0 : s1) : (flipVal > 0 ? a.x0 : a.x1);
    const bY = (a && a.baseY) || 0;
    pivot.position.set(px, bY, pz);

    const v = (dep / 2 - 0.2) * flipVal;
    const kv = (dep - 0.3) * flipVal;

    if (doorStyle === 'modern') {
      // Modern Flush Architectural Door
      const slabMat = HP.graphics3d ? HP.graphics3d.material('wood', '#2d2e32') : leafMat;
      const inlayMat = HP.graphics3d ? HP.graphics3d.material('metal', '#dce0e5') : knobMat;
      const barMat = HP.graphics3d ? HP.graphics3d.material('metal', '#c8ccd2') : knobMat;

      leaf = new THREE.Mesh(box3d(lw, lh, dep), slabMat);
      setPos(leaf, (li === 0 ? lw / 2 : -lw / 2), lh / 2 - 0.5, v);
      leaf.castShadow = leaf.receiveShadow = true;
      pivot.add(leaf);

      // 4 horizontal brushed-aluminum inlay accent strips
      const inW = lw - 2;
      for (const yOff of [-14, -4, 6, 16]) {
        for (const side of [-1, 1]) {
          const strip = new THREE.Mesh(box3d(inW, 0.45, 0.2), inlayMat);
          setPos(strip, 0, yOff, side * (dep / 2 + 0.08));
          leaf.add(strip);
        }
      }

      // Vertical architectural pull bar with standoffs on both sides
      knob = new THREE.Group();
      const pullU = li === 0 ? (lw / 2 - 2.2) : (-lw / 2 + 2.2);
      for (const side of [-1, 1]) {
        const sideZ = side * (dep / 2 + 0.65);
        const pullBar = new THREE.Mesh(box3d(0.8, 22, 0.8), barMat);
        setPos(pullBar, 0, 0, sideZ);
        pullBar.castShadow = true;
        knob.add(pullBar);

        // Standoff mounting brackets at top and bottom
        for (const sy of [-8, 8]) {
          const so = new THREE.Mesh(box3d(0.5, 0.5, 0.6), barMat);
          setPos(so, 0, sy, side * (dep / 2 + 0.3));
          knob.add(so);
        }
      }
      setPos(knob, pullU, 27 - lh / 2, 0);
      leaf.add(knob);
    } else if (doorStyle === 'glass') {
      // Glass French Door with Divided Lites
      const frameMat = HP.graphics3d ? HP.graphics3d.material('metal', '#222428') : knobMat;
      const glassMat = HP.graphics3d ? HP.graphics3d.material('glass', '#bfe3ea') : new THREE.MeshLambertMaterial({ color: 0x9fd4e8, transparent: true, opacity: 0.35 });
      const hardwareMat = HP.graphics3d ? HP.graphics3d.material('metal', '#1a1c1e') : knobMat;

      // Base leaf is the transparent crystal glass pane (satisfies walk3d leafBox geometry)
      leaf = new THREE.Mesh(box3d(lw, lh, dep), glassMat);
      setPos(leaf, (li === 0 ? lw / 2 : -lw / 2), lh / 2 - 0.5, v);
      pivot.add(leaf);

      const stileW = 2.4;
      const topRailH = 3.2;
      const botRailH = 5.2; // traditional wide bottom kick rail
      const innerW = lw - stileW * 2;
      const innerH = lh - topRailH - botRailH;

      // Top rail
      const topRail = new THREE.Mesh(box3d(lw, topRailH, dep + 0.1), frameMat);
      setPos(topRail, 0, lh / 2 - topRailH / 2, 0);
      topRail.castShadow = topRail.receiveShadow = true;
      leaf.add(topRail);

      // Bottom kick rail
      const botRail = new THREE.Mesh(box3d(lw, botRailH, dep + 0.1), frameMat);
      setPos(botRail, 0, -lh / 2 + botRailH / 2, 0);
      botRail.castShadow = botRail.receiveShadow = true;
      leaf.add(botRail);

      // Left stile
      const leftStile = new THREE.Mesh(box3d(stileW, innerH, dep + 0.1), frameMat);
      setPos(leftStile, -lw / 2 + stileW / 2, (botRailH - topRailH) / 2, 0);
      leftStile.castShadow = leftStile.receiveShadow = true;
      leaf.add(leftStile);

      // Right stile
      const rightStile = new THREE.Mesh(box3d(stileW, innerH, dep + 0.1), frameMat);
      setPos(rightStile, lw / 2 - stileW / 2, (botRailH - topRailH) / 2, 0);
      rightStile.castShadow = rightStile.receiveShadow = true;
      leaf.add(rightStile);

      // Divided Lite Muntin Grille: 3 horizontal bars + 1 vertical bar across the inner glass area
      const midY = (botRailH - topRailH) / 2;
      for (const my of [-innerH * 0.25, 0, innerH * 0.25]) {
        const hMuntin = new THREE.Mesh(box3d(innerW, 0.5, dep + 0.05), frameMat);
        setPos(hMuntin, 0, midY + my, 0);
        hMuntin.castShadow = true;
        leaf.add(hMuntin);
      }
      const vMuntin = new THREE.Mesh(box3d(0.5, innerH, dep + 0.05), frameMat);
      setPos(vMuntin, 0, midY, 0);
      vMuntin.castShadow = true;
      leaf.add(vMuntin);

      // Contemporary lever handles on both sides (interior & exterior), mounted flush on the latch stile
      knob = new THREE.Group();
      const latchU = li === 0 ? (lw / 2 - stileW / 2) : (-lw / 2 + stileW / 2);
      const leverDir = li === 0 ? -1 : 1;
      for (const side of [-1, 1]) {
        const sideZ = side * (dep / 2 + 0.12);
        const rosette = new THREE.Mesh(box3d(1.4, 2.0, 0.25), hardwareMat);
        setPos(rosette, 0, 0, sideZ);
        knob.add(rosette);
        const lever = new THREE.Mesh(box3d(3.0, 0.45, 0.45), hardwareMat);
        setPos(lever, leverDir * 1.3, 0, sideZ + side * 0.28);
        lever.castShadow = true;
        knob.add(lever);
      }
      setPos(knob, latchU, 27 - lh / 2, 0);
      leaf.add(knob);
    } else if (doorStyle === 'arched') {
      // Arched Heritage Craftsman Door
      const theme = DOOR_STYLE_THEMES.arched;
      const woodMat = HP.graphics3d ? HP.graphics3d.material('wood', theme.leafWood) : leafMat;
      const trimMat = HP.graphics3d ? HP.graphics3d.material('wood', theme.leafTrim) : leafMat;
      const panelMat = HP.graphics3d ? HP.graphics3d.material('wood', theme.leafPanel) : leafMat;
      const brassMat = HP.graphics3d ? HP.graphics3d.material(theme.hardwareKind, theme.hardwareColor) : knobMat;

      const R = span / 2;
      const sy = Math.max(30, dh - R);
      const archH = dh - sy;
      const baseLh = dh;

      const geo = makeArchedLeafGeometry(leaves, li, span, dh, sy, dep, isH);
      leaf = new THREE.Mesh(geo, woodMat);
      setPos(leaf, (li === 0 ? lw / 2 : -lw / 2), baseLh / 2 - 0.5, v);
      leaf.castShadow = leaf.receiveShadow = true;
      pivot.add(leaf);

      const setLeafPos = (mesh, u, y, vPos) => mesh.position.set(isH ? u : vPos, y, isH ? vPos : u);

      const stileW = 2.4;
      const railW = 3.4;
      const botRailH = 5.2;
      const midRailH = 3.4;
      const trimDep = 0.22;
      const yMid = 27 - baseLh / 2;

      const uMeet = leaves === 2 ? (li === 0 ? (lw / 2 - stileW / 2) : (-lw / 2 + stileW / 2)) : (lw / 2 - stileW / 2);
      const uHinge = leaves === 2 ? (li === 0 ? (-lw / 2 + stileW / 2) : (lw / 2 - stileW / 2)) : (-lw / 2 + stileW / 2);

      const innerW = lw - stileW * 2 - 0.4;
      const lowH = (yMid - midRailH / 2) - (-baseLh / 2 + botRailH);
      const lowY = (-baseLh / 2 + botRailH + yMid - midRailH / 2) / 2;

      const topRailShape = makeCurvedTopRailShape(leaves, li, span, dh, sy, railW);
      const topRailGeo = toOrientedExtrudeGeo(topRailShape, trimDep, isH);

      const upPanelShape = makeUpperArchedPanelShape(leaves, li, span, dh, sy, stileW, railW, midRailH);
      const upPanelGeo = toOrientedExtrudeGeo(upPanelShape, 0.16, isH);

      for (const side of [-1, 1]) {
        const zFace = side * (dep / 2 + trimDep / 2);

        // Curved top rail following arch radius
        const cRail = new THREE.Mesh(topRailGeo, trimMat);
        setLeafPos(cRail, 0, 0, zFace);
        cRail.castShadow = true;
        leaf.add(cRail);

        // Meeting stile (height trimmed slightly below apex to follow arch curve)
        const mStile = new THREE.Mesh(box3d(stileW, baseLh - 0.5, trimDep), trimMat);
        setLeafPos(mStile, uMeet, -0.25, zFace);
        mStile.castShadow = true;
        leaf.add(mStile);

        // Hinge stile (up to springline sy)
        const hStile = new THREE.Mesh(box3d(stileW, sy, trimDep), trimMat);
        setLeafPos(hStile, uHinge, -baseLh / 2 + sy / 2, zFace);
        hStile.castShadow = true;
        leaf.add(hStile);

        // Bottom kick rail
        const bRail = new THREE.Mesh(box3d(lw - 0.2, botRailH, trimDep), trimMat);
        setLeafPos(bRail, 0, -baseLh / 2 + botRailH / 2, zFace);
        bRail.castShadow = true;
        leaf.add(bRail);

        // Middle lock rail
        const mRail = new THREE.Mesh(box3d(lw - 0.2, midRailH, trimDep), trimMat);
        setLeafPos(mRail, 0, yMid, zFace);
        mRail.castShadow = true;
        leaf.add(mRail);

        // Lower raised panel field
        const lowField = new THREE.Mesh(box3d(Math.max(1, innerW - 1.2), Math.max(1, lowH - 1.2), 0.16), panelMat);
        setLeafPos(lowField, 0, lowY, side * (dep / 2 + 0.08));
        leaf.add(lowField);

        // Upper arched raised panel field
        const upMesh = new THREE.Mesh(upPanelGeo, panelMat);
        setLeafPos(upMesh, 0, 0, side * (dep / 2 + 0.08));
        leaf.add(upMesh);
      }

      // Astragal for double doors (on meeting stile of active leaf 0)
      if (leaves === 2 && li === 0) {
        const astragal = new THREE.Mesh(box3d(0.65, baseLh - 0.5, dep + 0.35), trimMat);
        setLeafPos(astragal, lw / 2, -0.25, 0);
        astragal.castShadow = true;
        leaf.add(astragal);
      }

      // Authentic brass hinge barrels along hinge edge
      for (const hy of [10, 24, Math.max(28, sy - 4)]) {
        const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 2.0, 10), brassMat);
        setLeafPos(hinge, uHinge + (leaves === 2 && li === 1 ? 0.8 : -0.8), hy - baseLh / 2, 0);
        leaf.add(hinge);
      }

      // Dual-sided polished brass lever handle & architectural rosette
      knob = new THREE.Group();
      const latchU = uMeet;
      const leverDir = leaves === 2 ? (li === 0 ? -1 : 1) : -1;
      for (const side of [-1, 1]) {
        const sideZ = side * (dep / 2 + trimDep + 0.02);
        const rosette = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.25, 16), brassMat);
        if (isH) rosette.rotation.x = Math.PI / 2; else rosette.rotation.z = Math.PI / 2;
        setLeafPos(rosette, 0, 0, sideZ);
        knob.add(rosette);

        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.5, 10), brassMat);
        if (isH) collar.rotation.x = Math.PI / 2; else collar.rotation.z = Math.PI / 2;
        setLeafPos(collar, 0, 0, sideZ + side * 0.22);
        knob.add(collar);

        const lever = new THREE.Mesh(box3d(3.2, 0.45, 0.45), brassMat);
        setLeafPos(lever, leverDir * 1.4, 0, sideZ + side * 0.45);
        lever.castShadow = true;
        knob.add(lever);
      }
      setLeafPos(knob, latchU, yMid, 0);
      leaf.add(knob);
    } else {
      // Classic 4-Panel Stile-and-Rail Door ('panel')
      const theme = DOOR_STYLE_THEMES.panel;
      const woodMat = HP.graphics3d ? HP.graphics3d.material('wood', theme.leafWood) : leafMat;
      const brassMat = HP.graphics3d ? HP.graphics3d.material(theme.hardwareKind, theme.hardwareColor) : knobMat;

      leaf = new THREE.Mesh(box3d(lw, lh, dep), woodMat);
      setPos(leaf, (li === 0 ? lw / 2 : -lw / 2), lh / 2 - 0.5, v);
      leaf.castShadow = leaf.receiveShadow = true;
      pivot.add(leaf);

      // Authentic craftsman stiles & rails framing 4 recessed panels on both faces
      const stileW = 2.4;
      const topRailH = 3.2;
      const botRailH = 5.2; // traditional wide bottom kick rail
      const midRailH = 3.4; // middle lock rail
      const mullionW = 1.8; // center vertical mullion
      const trimDep = 0.22;
      const innerW = lw - stileW * 2;
      const midY = 27 - lh / 2; // centered at lock/handle height

      const upperH = (lh / 2 - topRailH) - (midY + midRailH / 2);
      const upperY = (midY + midRailH / 2) + upperH / 2;
      const lowerH = (midY - midRailH / 2) - (-lh / 2 + botRailH);
      const lowerY = (-lh / 2 + botRailH) + lowerH / 2;

      const pW = (innerW - mullionW) / 2;

      for (const side of [-1, 1]) {
        const sideZ = side * (dep / 2 + trimDep / 2);

        // Left stile (full height)
        const leftStile = new THREE.Mesh(box3d(stileW, lh, trimDep), woodMat);
        setPos(leftStile, -lw / 2 + stileW / 2, 0, sideZ);
        leftStile.castShadow = true;
        leaf.add(leftStile);

        // Right stile (full height)
        const rightStile = new THREE.Mesh(box3d(stileW, lh, trimDep), woodMat);
        setPos(rightStile, lw / 2 - stileW / 2, 0, sideZ);
        rightStile.castShadow = true;
        leaf.add(rightStile);

        // Top rail
        const topRail = new THREE.Mesh(box3d(innerW, topRailH, trimDep), woodMat);
        setPos(topRail, 0, lh / 2 - topRailH / 2, sideZ);
        topRail.castShadow = true;
        leaf.add(topRail);

        // Bottom kick rail
        const botRail = new THREE.Mesh(box3d(innerW, botRailH, trimDep), woodMat);
        setPos(botRail, 0, -lh / 2 + botRailH / 2, sideZ);
        botRail.castShadow = true;
        leaf.add(botRail);

        // Mid lock rail
        const midRail = new THREE.Mesh(box3d(innerW, midRailH, trimDep), woodMat);
        setPos(midRail, 0, midY, sideZ);
        midRail.castShadow = true;
        leaf.add(midRail);

        // Upper center mullion
        const upMullion = new THREE.Mesh(box3d(mullionW, upperH, trimDep), woodMat);
        setPos(upMullion, 0, upperY, sideZ);
        upMullion.castShadow = true;
        leaf.add(upMullion);

        // Lower center mullion
        const lowMullion = new THREE.Mesh(box3d(mullionW, lowerH, trimDep), woodMat);
        setPos(lowMullion, 0, lowerY, sideZ);
        lowMullion.castShadow = true;
        leaf.add(lowMullion);

        // Raised central fields inside the 4 recessed panels
        for (const col of [-pW / 2 - mullionW / 2, pW / 2 + mullionW / 2]) {
          // Upper panel raised field
          const upField = new THREE.Mesh(box3d(pW - 1.2, upperH - 1.2, 0.12), woodMat);
          setPos(upField, col, upperY, side * (dep / 2 + 0.06));
          leaf.add(upField);

          // Lower panel raised field
          const lowField = new THREE.Mesh(box3d(pW - 1.2, lowerH - 1.2, 0.12), woodMat);
          setPos(lowField, col, lowerY, side * (dep / 2 + 0.06));
          leaf.add(lowField);
        }
      }

      // 3 Brass hinge barrels on hinge edge
      const hingeU = li === 0 ? (-lw / 2 + 0.2) : (lw / 2 - 0.2);
      for (const hy of [12, 29, 48]) {
        const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.8, 10), brassMat);
        setPos(hinge, hingeU, hy - lh / 2, 0);
        leaf.add(hinge);
      }

      // Dual-sided architectural polished brass lever handles & rosettes
      knob = new THREE.Group();
      const latchU = li === 0 ? (lw / 2 - stileW / 2) : (-lw / 2 + stileW / 2);
      const leverDir = li === 0 ? -1 : 1;
      for (const side of [-1, 1]) {
        const sideZ = side * (dep / 2 + trimDep + 0.02);
        const rosette = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.25, 16), brassMat);
        if (isH) rosette.rotation.x = Math.PI / 2; else rosette.rotation.z = Math.PI / 2;
        setPos(rosette, 0, 0, sideZ);
        knob.add(rosette);

        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.5, 10), brassMat);
        if (isH) collar.rotation.x = Math.PI / 2; else collar.rotation.z = Math.PI / 2;
        setPos(collar, 0, 0, sideZ + side * 0.25);
        knob.add(collar);

        const lever = new THREE.Mesh(box3d(3.4, 0.45, 0.45), brassMat);
        setPos(lever, leverDir * 1.5, 0, sideZ + side * 0.45);
        lever.castShadow = true;
        knob.add(lever);
      }
      setPos(knob, latchU, midY, 0);
      leaf.add(knob);
    }
  }

  dp.leaf = leaf;
  dp.knob = knob;
  dp.lw = lw;
  dp.li = li;
  dp.dep = dep;
  dp.flip = flipVal;
  dp.doorStyle = doorStyle;
  dp.ly0 = 0;
  dp.ly1 = lh;
  dp.s0 = s0;
  dp.s1 = s1;
  dp.post0 = post0;
  dp.post1 = post1;
}

/* ---------- authentic 3D fences & boundaries ---------- */
function buildFences3D(fences, walls, sg, C, V, baseY = 0, lvlIdx = 0) {
  if (!fences) return;
  const activeSegs = [];
  const postMap = new Map();

  for (const k in fences) {
    if (walls && walls[k]) continue; // wall wins the shared edge
    const fv = fences[k];
    if (!fv) continue;
    const s = HP.parseWallKey(k);
    s.t = fv.t || 'wood';
    s.k = k;
    if (s.t === 'gate') continue; // gates are handled by swinging gate assembly
    activeSegs.push(s);

    const v0 = `${s.x},${s.y}`;
    const v1 = s.d === 'h' ? `${s.x + 1},${s.y}` : `${s.x},${s.y + 1}`;
    if (!postMap.has(v0)) postMap.set(v0, { vx: s.x, vy: s.y, t: s.t });
    if (!postMap.has(v1)) postMap.set(v1, { vx: s.d === 'h' ? s.x + 1 : s.x, vy: s.d === 'h' ? s.y : s.y + 1, t: s.t });
  }

  if (!activeSegs.length && !postMap.size) return;

  const fenceBatches = new Map();
  const fenceMats = {};
  const getFenceMat = (kind, col) => {
    const k = kind + ':' + (col || '');
    if (fenceMats[k]) return fenceMats[k];
    const mat = HP.graphics3d
      ? HP.graphics3d.material(kind, col)
      : new THREE.MeshLambertMaterial({ color: new THREE.Color(col || 0xcccccc) });
    mat.userData.shared3d = true;
    if (HP.graphics3d) HP.graphics3d.track(mat);
    return (fenceMats[k] = mat);
  };

  function addFenceMeshPart(geoName, matKind, col, px, py, pz, sx, sy, sz, rx, ry, rz, opts) {
    const bKey = geoName + '|' + matKind + '|' + (col || '');
    let batch = fenceBatches.get(bKey);
    if (!batch) {
      let geo = unitBox();
      if (geoName === 'cyl') geo = unitCyl();
      else if (geoName === 'roof') geo = unitRoof();
      else if (geoName === 'cone') geo = unitCone();
      else if (geoName === 'sphere') geo = unitSphere();
      else if (geoName === 'cylX') geo = unitCylX();
      else if (geoName === 'cylZ') geo = unitCylZ();
      const mat = getFenceMat(matKind, col);
      batch = { geo, mat, parts: [], cast: matKind !== 'glass', detail: !!(opts && opts.detail) };
      fenceBatches.set(bKey, batch);
    }
    const m = new THREE.Matrix4();
    const finalY = py + baseY;
    if (rx || ry || rz) {
      const euler = new THREE.Euler(rx || 0, ry || 0, rz || 0, 'YXZ');
      m.makeRotationFromEuler(euler);
      m.scale(new THREE.Vector3(sx, sy, sz));
      m.setPosition(px, finalY, pz);
    } else {
      m.makeScale(sx, sy, sz);
      m.setPosition(px, finalY, pz);
    }
    const rMax = Math.max(sx, sz) * 0.6;
    batch.parts.push({
      m, c: col,
      x0: px - rMax, z0: pz - rMax,
      x1: px + rMax, z1: pz + rMax
    });
  }

  function addLocalPart(geoName, matKind, col, isH, cx, cz, u, v, w, uLen, vLen, wLen, opts) {
    const px = isH ? (cx + u) : (cx + w);
    const py = v;
    const pz = isH ? (cz + w) : (cz + u);
    const sx = isH ? uLen : wLen;
    const sy = vLen;
    const sz = isH ? wLen : uLen;
    let gName = geoName;
    if (geoName === 'cylX') gName = isH ? 'cylX' : 'cylZ';
    else if (geoName === 'cylZ') gName = isH ? 'cylZ' : 'cylX';
    const rx = (opts && opts.rx) ? opts.rx : 0;
    const ry = (opts && opts.ry) ? opts.ry : 0;
    const rz = (opts && opts.rz) ? opts.rz : 0;
    addFenceMeshPart(gName, matKind, col, px, py, pz, sx, sy, sz, rx, ry, rz, opts);
  }

  // 2. Posts at fence vertices
  for (const pt of postMap.values()) {
    const px = pt.vx * C, pz = pt.vy * C;
    const t = pt.t;
    if (t === 'wood') {
      addFenceMeshPart('box', 'wood', '#6f4f33', px, 14, pz, 3.2, 28, 3.2);
      addFenceMeshPart('roof', 'wood', '#592506', px, 29.1, pz, 3.8, 2.2, 3.8);
    } else if (t === 'picket') {
      addFenceMeshPart('box', 'wood', '#ffffff', px, 12, pz, 3.0, 24, 3.0);
      addFenceMeshPart('roof', 'wood', '#ffffff', px, 25.0, pz, 3.6, 2.0, 3.6);
    } else if (t === 'iron') {
      addFenceMeshPart('box', 'metal', '#181b1e', px, 15, pz, 3.0, 30, 3.0);
      addFenceMeshPart('box', 'dark', '#0f172a', px, 0.8, pz, 3.8, 1.6, 3.8);
      addFenceMeshPart('box', 'metal', '#c9a44e', px, 30.4, pz, 3.4, 0.8, 3.4);
      addFenceMeshPart('sphere', 'metal', '#c9a44e', px, 32.2, pz, 2.6, 2.6, 2.6);
    } else if (t === 'stone') {
      addFenceMeshPart('box', 'stone', '#a8a294', px, 12, pz, 5.2, 24, 5.2);
      addFenceMeshPart('box', 'stone', '#e2d9c8', px, 25.0, pz, 6.0, 2.0, 6.0);
    } else if (t === 'brick') {
      addFenceMeshPart('box', 'brick', '#7c2f21', px, 12, pz, 5.0, 24, 5.0);
      addFenceMeshPart('box', 'stone', '#efe9da', px, 25.0, pz, 5.8, 2.0, 5.8);
    } else if (t === 'whitewall') {
      addFenceMeshPart('box', 'plaster', '#efe9da', px, 13, pz, 4.6, 26, 4.6);
      addFenceMeshPart('box', 'plaster', '#ddd5c2', px, 26.9, pz, 5.2, 1.8, 5.2);
    } else if (t === 'bamboo') {
      addFenceMeshPart('cyl', 'wood', '#78350f', px, 14, pz, 3.0, 28, 3.0);
    } else if (t === 'reed') {
      addFenceMeshPart('box', 'wood', '#8a6844', px, 13, pz, 2.6, 26, 2.6);
    } else if (t === 'chainlink') {
      addFenceMeshPart('cyl', 'metal', '#cbd5e1', px, 14.5, pz, 2.2, 29, 2.2);
      addFenceMeshPart('cyl', 'dark', '#334155', px, 0.75, pz, 3.2, 1.5, 3.2);
      addFenceMeshPart('sphere', 'metal', '#e2e8f0', px, 29.5, pz, 2.6, 1.8, 2.6);
    } else if (t === 'lattice') {
      addFenceMeshPart('box', 'wood', '#78350f', px, 14, pz, 3.2, 28, 3.2);
      addFenceMeshPart('roof', 'wood', '#592506', px, 29.0, pz, 3.8, 2.0, 3.8);
    } else if (t === 'ranch') {
      addFenceMeshPart('cyl', 'wood', '#78350f', px, 12.5, pz, 3.2, 25, 3.2);
      addFenceMeshPart('sphere', 'wood', '#592506', px, 25.4, pz, 3.4, 1.6, 3.4);
    } else if (t === 'glass') {
      addFenceMeshPart('cyl', 'metal', '#e2e8f0', px, 0.4, pz, 3.2, 0.8, 3.2);
      addFenceMeshPart('box', 'metal', '#cbd5e1', px, 2.5, pz, 2.2, 5.0, 2.6);
    } else if (t === 'metal') {
      addFenceMeshPart('box', 'metal', '#0f172a', px, 14, pz, 2.8, 28, 2.8);
    } else if (t === 'rope') {
      addFenceMeshPart('cyl', 'wood', '#78350f', px, 10, pz, 3.4, 20, 3.4);
      addFenceMeshPart('sphere', 'wood', '#592506', px, 20.5, pz, 3.6, 1.8, 3.6);
      addFenceMeshPart('cyl', 'dark', '#181b1e', px, 0.5, pz, 4.0, 1.0, 4.0);
      addFenceMeshPart('sphere', 'metal', '#c9a44e', px, 7.0, pz, 1.8, 1.8, 1.8);
      addFenceMeshPart('sphere', 'metal', '#c9a44e', px, 14.5, pz, 1.8, 1.8, 1.8);
    }
  }

  // 3. Fence run bodies
  for (const s of activeSegs) {
    const isH = s.d === 'h';
    const cx = isH ? (s.x + 0.5) * C : s.x * C;
    const cz = isH ? s.y * C : (s.y + 0.5) * C;
    const t = s.t;

    if (t === 'wood') {
      addLocalPart('box', 'wood', '#78350f', isH, cx, cz, 0, 5.0, -0.7, 27.6, 1.6, 1.2);
      addLocalPart('box', 'wood', '#78350f', isH, cx, cz, 0, 22.0, -0.7, 27.6, 1.6, 1.2);
      addLocalPart('box', 'wood', '#6f4f33', isH, cx, cz, 0, 26.0, 0, 27.8, 1.4, 2.4);
      for (let i = 0; i < 7; i++) {
        const ui = -11.7 + i * 3.9;
        const col = (i % 2 === 0 ? '#9a774f' : '#b45309');
        const altW = (i % 2 === 0 ? 0.2 : 0.45);
        addLocalPart('box', 'wood', col, isH, cx, cz, ui, 13.0, altW, 3.6, 24.5, 1.2);
      }
    } else if (t === 'picket') {
      addLocalPart('box', 'wood', '#ffffff', isH, cx, cz, 0, 5.5, -0.6, 27.6, 1.4, 1.2);
      addLocalPart('box', 'wood', '#ffffff', isH, cx, cz, 0, 16.5, -0.6, 27.6, 1.4, 1.2);
      for (let i = 0; i < 7; i++) {
        const ui = -11.5 + i * 3.85;
        addLocalPart('box', 'wood', '#ffffff', isH, cx, cz, ui, 9.5, 0.4, 2.2, 17.0, 1.0);
        addLocalPart('roof', 'wood', '#ffffff', isH, cx, cz, ui, 19.6, 0.4, 2.2, 3.2, 1.0);
      }
    } else if (t === 'iron') {
      addLocalPart('box', 'metal', '#1e2023', isH, cx, cz, 0, 4.0, 0, 27.8, 1.4, 1.4);
      addLocalPart('box', 'metal', '#1e2023', isH, cx, cz, 0, 25.0, 0, 27.8, 1.4, 1.4);
      for (let i = 0; i < 7; i++) {
        const ui = -11.5 + i * 3.85;
        addLocalPart('box', 'metal', '#181b1e', isH, cx, cz, ui, 13.5, 0, 1.2, 25.0, 1.2);
        addLocalPart('cone', 'metal', '#c9a44e', isH, cx, cz, ui, 27.8, 0, 1.8, 4.0, 1.8);
        addLocalPart('box', 'metal', '#c9a44e', isH, cx, cz, ui, 25.0, 0, 1.8, 1.0, 1.8);
      }
    } else if (t === 'stone') {
      addLocalPart('box', 'stone', '#a8a294', isH, cx, cz, 0, 10.5, 0, 27.6, 21.0, 4.2);
      addLocalPart('box', 'stone', '#e2d9c8', isH, cx, cz, 0, 22.2, 0, 27.8, 2.4, 5.0);
      for (let l = 0; l < 3; l++) {
        const yl = 5.0 + l * 5.0;
        addLocalPart('box', 'stone', '#64748b', isH, cx, cz, 0, yl, 2.15, 27.4, 0.4, 0.4);
        addLocalPart('box', 'stone', '#64748b', isH, cx, cz, 0, yl, -2.15, 27.4, 0.4, 0.4);
      }
    } else if (t === 'brick') {
      addLocalPart('box', 'brick', '#b0705a', isH, cx, cz, 0, 10.5, 0, 27.6, 21.0, 4.0);
      addLocalPart('box', 'stone', '#efe9da', isH, cx, cz, 0, 22.2, 0, 27.8, 2.4, 4.8);
    } else if (t === 'whitewall') {
      addLocalPart('box', 'plaster', '#efe9da', isH, cx, cz, 0, 11.5, 0, 27.6, 23.0, 3.8);
      addLocalPart('box', 'plaster', '#ddd5c2', isH, cx, cz, 0, 24.0, 0, 27.8, 2.0, 4.4);
    } else if (t === 'hedge') {
      addLocalPart('box', 'dirt', '#291b10', isH, cx, cz, 0, 0.5, 0, 28.0, 1.0, 6.4);
      addLocalPart('box', 'stone', '#64748b', isH, cx, cz, 0, 0.6, 3.2, 28.0, 1.2, 0.8);
      addLocalPart('box', 'stone', '#64748b', isH, cx, cz, 0, 0.6, -3.2, 28.0, 1.2, 0.8);
      addLocalPart('box', 'foliage', '#14532d', isH, cx, cz, 0, 13.0, 0, 27.8, 24.0, 5.0);
      for (let i = 0; i < 5; i++) {
        const ui = -11.0 + i * 5.5;
        addLocalPart('sphere', 'foliage', '#166534', isH, cx, cz, ui, 9.0, 2.6, 5.2, 7.5, 3.8);
        addLocalPart('sphere', 'foliage', '#166534', isH, cx, cz, ui, 9.0, -2.6, 5.2, 7.5, 3.8);
        addLocalPart('sphere', 'foliage', '#166534', isH, cx, cz, ui, 18.0, 2.6, 4.8, 7.0, 3.6);
        addLocalPart('sphere', 'foliage', '#166534', isH, cx, cz, ui, 18.0, -2.6, 4.8, 7.0, 3.6);
        addLocalPart('sphere', 'foliage', '#22c55e', isH, cx, cz, ui, 26.5, 0, 5.4, 4.0, 5.0);
      }
    } else if (t === 'bamboo') {
      addLocalPart('box', 'wood', '#78350f', isH, cx, cz, 0, 2.5, 0, 27.6, 1.6, 2.0);
      addLocalPart('box', 'wood', '#78350f', isH, cx, cz, 0, 26.5, 0, 27.6, 1.6, 2.0);
      for (let i = 0; i < 11; i++) {
        const ui = -12.0 + i * 2.4;
        const bcol = (i % 2 === 0 ? '#c9a55f' : '#eab308');
        addLocalPart('cyl', 'wood', bcol, isH, cx, cz, ui, 14.5, 0, 1.8, 24.0, 1.8);
      }
      addLocalPart('box', 'metal', '#181b1e', isH, cx, cz, 0, 8.0, 1.0, 27.8, 0.8, 0.8);
      addLocalPart('box', 'metal', '#181b1e', isH, cx, cz, 0, 8.0, -1.0, 27.8, 0.8, 0.8);
      addLocalPart('box', 'metal', '#181b1e', isH, cx, cz, 0, 20.0, 1.0, 27.8, 0.8, 0.8);
      addLocalPart('box', 'metal', '#181b1e', isH, cx, cz, 0, 20.0, -1.0, 27.8, 0.8, 0.8);
    } else if (t === 'reed') {
      for (let i = 0; i < 14; i++) {
        const ui = -11.5 + i * (23.0 / 13);
        const rH = 20.0 + ((i * 7) % 5) * 1.0;
        const rCol = (i % 3 === 0 ? '#d0bd90' : (i % 3 === 1 ? '#e2d3aa' : '#bfa979'));
        addLocalPart('cyl', 'wood', rCol, isH, cx, cz, ui, rH / 2 + 1.0, 0, 1.4, rH, 1.4);
      }
      for (const vy of [5.0, 12.0, 18.0]) {
        addLocalPart('box', 'metal', '#475569', isH, cx, cz, 0, vy, 0, 27.8, 0.6, 1.8);
      }
    } else if (t === 'chainlink') {
      addLocalPart('cylX', 'metal', '#cbd5e1', isH, cx, cz, 0, 27.5, 0, 27.8, 1.4, 1.4);
      addLocalPart('cylX', 'metal', '#64748b', isH, cx, cz, 0, 2.0, 0, 27.8, 0.8, 0.8);
      addLocalPart('cyl', 'metal', '#94a3b8', isH, cx, cz, -12.8, 15.0, 0, 0.8, 24.5, 0.8);
      addLocalPart('cyl', 'metal', '#94a3b8', isH, cx, cz, 12.8, 15.0, 0, 0.8, 24.5, 0.8);
      // Diamond wire mesh
      for (let d = 0; d < 7; d++) {
        const ud = -9.0 + d * 3.0;
        addLocalPart('box', 'metal', '#aab4bb', isH, cx, cz, ud, 14.8, 0.1, 0.35, 23.0, 0.35, { rx: isH ? 0 : 0.65, rz: isH ? 0.65 : 0 });
        addLocalPart('box', 'metal', '#aab4bb', isH, cx, cz, ud, 14.8, -0.1, 0.35, 23.0, 0.35, { rx: isH ? 0 : -0.65, rz: isH ? -0.65 : 0 });
      }
    } else if (t === 'lattice') {
      addLocalPart('box', 'wood', '#78350f', isH, cx, cz, 0, 2.5, 0, 27.6, 2.0, 2.4);
      addLocalPart('box', 'wood', '#78350f', isH, cx, cz, 0, 26.5, 0, 27.6, 2.0, 2.4);
      addLocalPart('box', 'wood', '#78350f', isH, cx, cz, -13.0, 14.5, 0, 1.8, 22.0, 2.2);
      addLocalPart('box', 'wood', '#78350f', isH, cx, cz, 13.0, 14.5, 0, 1.8, 22.0, 2.2);
      for (let d = 0; d < 6; d++) {
        const ud = -7.5 + d * 3.0;
        addLocalPart('box', 'wood', '#caa96f', isH, cx, cz, ud, 14.5, 0.4, 0.8, 20.0, 0.4, { rx: isH ? 0 : 0.785, rz: isH ? 0.785 : 0 });
        addLocalPart('box', 'wood', '#b45309', isH, cx, cz, ud, 14.5, -0.4, 0.8, 20.0, 0.4, { rx: isH ? 0 : -0.785, rz: isH ? -0.785 : 0 });
      }
    } else if (t === 'ranch') {
      addLocalPart('cylX', 'wood', '#8a6844', isH, cx, cz, 0, 5.5, 0, 27.8, 1.8, 1.8);
      addLocalPart('cylX', 'wood', '#8a6844', isH, cx, cz, 0, 13.5, 0, 27.8, 1.8, 1.8);
      addLocalPart('cylX', 'wood', '#8a6844', isH, cx, cz, 0, 21.5, 0, 27.8, 1.8, 1.8);
    } else if (t === 'glass') {
      addLocalPart('box', 'glass', '#38bdf8', isH, cx, cz, 0, 15.0, 0, 27.6, 24.0, 0.8);
      addLocalPart('box', 'metal', '#cbd5e1', isH, cx, cz, 0, 27.5, 0, 27.8, 1.0, 1.4);
      addLocalPart('box', 'metal', '#cbd5e1', isH, cx, cz, -8.0, 2.5, 0, 2.2, 5.0, 2.6);
      addLocalPart('box', 'metal', '#cbd5e1', isH, cx, cz, 8.0, 2.5, 0, 2.2, 5.0, 2.6);
    } else if (t === 'metal') {
      addLocalPart('box', 'metal', '#0f172a', isH, cx, cz, 0, 1.5, 0, 27.6, 1.4, 2.0);
      addLocalPart('box', 'metal', '#0f172a', isH, cx, cz, 0, 26.5, 0, 27.6, 1.4, 2.0);
      for (let s = 0; s < 6; s++) {
        const vs = 4.5 + s * 4.0;
        addLocalPart('box', 'metal', '#1e293b', isH, cx, cz, 0, vs, 0, 27.6, 2.8, 1.2);
      }
    } else if (t === 'fieldstone') {
      for (let i = 0; i < 7; i++) {
        const ui = -11.5 + i * 3.85;
        const wi = (i % 2 === 0 ? 0.8 : -0.8);
        const r = 2.2 + (i % 3) * 0.6;
        const stCol = (i % 3 === 0 ? '#a8a294' : (i % 3 === 1 ? '#847c6c' : '#948c7c'));
        addLocalPart('sphere', 'stone', stCol, isH, cx, cz, ui, r * 0.8, wi, r * 2.0, r * 1.6, r * 2.0);
      }
    } else if (t === 'rope') {
      for (let k = 0; k < 5; k++) {
        const uk = -9.6 + k * 4.8;
        const sag = Math.sin((k + 0.5) / 5 * Math.PI) * 2.4;
        const vUp = 14.5 - sag;
        const vLow = 7.0 - sag * 0.8;
        addLocalPart('cylX', 'fabric', '#fed7aa', isH, cx, cz, uk, vUp, 0, 4.9, 1.4, 1.4);
        addLocalPart('cylX', 'fabric', '#fed7aa', isH, cx, cz, uk, vLow, 0, 4.9, 1.4, 1.4);
      }
    }
  }

  // 4. Batch commit to scene via V.instanced (culling + chunking)
  for (const batch of fenceBatches.values()) {
    if (!batch.parts.length) continue;
    V.instanced(sg, batch.geo, batch.mat, batch.parts, { cast: batch.cast, receive: true, detail: batch.detail, lvlIdx });
  }
}

/* ---------- level build ---------- */
W3.buildLevel = function () {
  if (!scene) return;
  if (HP.graphics3d) HP.graphics3d.resetTiming();
  const oldDoors = (W3.doorPivots || []).map(d => ({
    cx: d.a && d.a.cx,
    cz: d.a && d.a.cz,
    open: d.open,
    latched: d.latched,
    vel: d.vel
  }));
  const bStart = performance.now();
  W3._lastBuildTimings = {};
  let tMark = bStart;
  const mark = (lbl) => {
    const now = performance.now();
    W3._lastBuildTimings[lbl] = +(now - tMark).toFixed(1);
    tMark = now;
  };
  /* wipe previous level group */
  if (W3.clearAudit) W3.clearAudit();
  if (W3.levelGroup) { scene.remove(W3.levelGroup); disposeGroup(W3.levelGroup); }
  const g = W3.levelGroup = new THREE.Group();
  scene.add(g);
  const sg = W3.staticGroup = new THREE.Group();
  g.add(sg);
  const flg = W3.floorGroup = new THREE.Group();
  g.add(flg);
  const fg = W3.furnitureGroup = new THREE.Group();
  g.add(fg);
  doorPivots = W3.doorPivots = [];
  W3.garageDoors = [];
  W3.elevatedDecks = [];
  const C = HP.CELL, V = HP.cull3d;
  V.reset();
  const m4 = new THREE.Matrix4(), col = new THREE.Color();

  const getWallMat = (style) => {
    W3._wallMats = W3._wallMats || {};
    const s = style || 'plaster';
    if (W3._wallMats[s]) return W3._wallMats[s];
    const mat = HP.graphics3d
      ? HP.graphics3d.worldUV(HP.graphics3d.material(s).clone(), C * 2)
      : new THREE.MeshLambertMaterial({ color: 0xffffff });
    mat.userData.shared3d = true;
    if (HP.graphics3d) HP.graphics3d.track(mat);
    W3._wallMats[s] = mat;
    return mat;
  };
  if (!W3._wallMat) W3._wallMat = getWallMat('plaster');
  const styleDefaultCol = (style, ext) => {
    if (style === 'brick' || style === 'brick_white') return '#ffffff';
    if (style === 'stone') return '#ffffff';
    if (style === 'wood' || style === 'shiplap') return '#ffffff';
    if (style === 'tile') return '#ffffff';
    if (style === 'concrete') return '#ffffff';
    if (style === 'marble') return '#ffffff';
    if (style === 'glass') return '#cde5eb';
    return ext ? '#e9e2d2' : '#f4efe4';
  };

  const allLevels = (HP.state && HP.state.levels && HP.state.levels.length) ? HP.state.levels : [HP.cur()];
  const WALL_H = (HP.geom3d && HP.geom3d.WALL_H) || 74;
  W3.roofHeights = new Float32Array(HP.GRID_W * HP.GRID_H);

  /* ---- precompute stairs and openings across all levels ---- */
  const stairCeilingOpenings = allLevels.map(() => new Set());
  const stairFloorOpenings = allLevels.map(() => new Set());
  const stairMeta = allLevels.map(() => ({ landings: new Set(), axisOf: {} }));
  const stairClimbs = [];

  allLevels.forEach((curLvl, lIdx) => {
    const bY = lIdx * WALL_H;
    const targetY = (lIdx + 1) * WALL_H;
    if (lIdx + 1 >= allLevels.length) return;
    for (const it of (curLvl.furniture || [])) {
      if (!HP.itemDef(it.type) || !/stairs/i.test(it.type)) continue;
      const f = HP.footprint(it);
      const rot = (it.rot || 0) % 4;
      for (let fy = f.y; fy < f.y + f.h; fy++) {
        for (let fx = f.x; fx < f.x + f.w; fx++) {
          const k = fx + ',' + fy;
          stairCeilingOpenings[lIdx].add(k);
          const isTopLanding = (rot === 0 && fy === f.y + f.h - 1) ||
                              (rot === 2 && fy === f.y) ||
                              (rot === 1 && fx === f.x + f.w - 1) ||
                              (rot === 3 && fx === f.x);
          if (!isTopLanding) {
            stairFloorOpenings[lIdx + 1].add(k);
            stairMeta[lIdx + 1].axisOf[k] = (rot === 0 || rot === 2) ? 'z' : 'x';
          } else {
            stairMeta[lIdx + 1].landings.add(k);
          }
        }
      }
      const x0 = f.x * C, x1 = (f.x + f.w) * C;
      const z0 = f.y * C, z1 = (f.y + f.h) * C;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      let ax = 'z', dir = 1, from = z0, run = z1 - z0;
      let groundSpot = { x: cx, z: z0 - C * 0.4 };
      let deckSpot = { x: cx, z: z1 - C * 0.5 };
      if (rot === 0) {
        ax = 'z'; dir = 1; from = z0; run = z1 - z0;
        groundSpot = { x: cx, z: z0 - C * 0.4 };
        deckSpot = { x: cx, z: z1 - C * 0.5 };
      } else if (rot === 2) {
        ax = 'z'; dir = -1; from = z1; run = z1 - z0;
        groundSpot = { x: cx, z: z1 + C * 0.4 };
        deckSpot = { x: cx, z: z0 + C * 0.5 };
      } else if (rot === 1) {
        ax = 'x'; dir = 1; from = x0; run = x1 - x0;
        groundSpot = { x: x0 - C * 0.4, z: cz };
        deckSpot = { x: x1 - C * 0.5, z: cz };
      } else if (rot === 3) {
        ax = 'x'; dir = -1; from = x1; run = x1 - x0;
        groundSpot = { x: x1 + C * 0.4, z: cz };
        deckSpot = { x: x0 + C * 0.5, z: cz };
      }
      stairClimbs.push({
        x0: Math.min(x0, x1), x1: Math.max(x0, x1),
        z0: Math.min(z0, z1), z1: Math.max(z0, z1),
        y0: bY, y1: targetY,
        ax, dir, from, run: Math.max(1, run),
        groundSpot, deckSpot,
        labelUp: `Go up to Floor ${lIdx + 2}`,
        labelDown: `Go down to Floor ${lIdx + 1}`
      });
    }
  });
  W3.stairFloorOpenings = stairFloorOpenings;
  W3.stairCeilingOpenings = stairCeilingOpenings;
  W3.stairMeta = stairMeta;
  W3.stairClimbs = stairClimbs;

  /* ---- pools: recessed basins carved 1m into the ground (ground level 0) ---- */
  const pools = W3.pools = [];
  for (const it of (allLevels[0] && allLevels[0].furniture) || []) {
    if (!HP.itemDef(it.type) || !/pool$|pond/i.test(it.type)) continue;
    const f = HP.footprint(it);
    pools.push({
      x0: f.x * C, z0: f.y * C, x1: (f.x + f.w) * C, z1: (f.y + f.h) * C,
      round: /round|circle|ellipse|oval/i.test(it.type),
    });
  }
  W3.waterAreas = pools.map(p => ({
    x0: p.x0 + 3, z0: p.z0 + 3, x1: p.x1 - 3, z1: p.z1 - 3,
    floorY: -C, waterY: -3.5,
  }));
  W3.climbs = [];
  W3.elevatedDecks = [];
  W3.floorGrids = [];

  /* ---- ground under everything — a Shape with pool holes when any ---- */
  let groundGeo;
  if (pools.length) {
    const cx = HP.GRID_W * C / 2, cz = HP.GRID_H * C / 2;
    const xzPath = (x0, z0, x1, z1) => {
      const p = new THREE.Path();
      p.moveTo(x0 - cx, cz - z1); p.lineTo(x1 - cx, cz - z1);
      p.lineTo(x1 - cx, cz - z0); p.lineTo(x0 - cx, cz - z0); p.closePath();
      return p;
    };
    const shape = new THREE.Shape(
      xzPath(-2000, -2000, HP.GRID_W * C + 2000, HP.GRID_H * C + 2000).getPoints(4));
    for (const p of pools)
      shape.holes.push(xzPath(p.x0 + 1, p.z0 + 1, p.x1 - 1, p.z1 - 1));
    groundGeo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  } else {
    groundGeo = new THREE.PlaneGeometry(
      HP.GRID_W * C + 4000, HP.GRID_H * C + 4000).rotateX(-Math.PI / 2);
  }
  if (!W3._groundMat) {
    W3._groundMat = HP.graphics3d ? HP.graphics3d.worldUV(HP.graphics3d.material('grass', '#689047').clone(), C * 3) :
      new THREE.MeshLambertMaterial({ color: 0x689047 });
    W3._groundMat.userData.shared3d = true;
    if (HP.graphics3d) HP.graphics3d.track(W3._groundMat);
  }
  const ground = new THREE.Mesh(groundGeo, W3._groundMat);
  ground.position.set(HP.GRID_W * C / 2, -1.5, HP.GRID_H * C / 2);
  ground.receiveShadow = true;
  sg.add(ground);

  /* ---- pool basins: tiled shell 1m down, coping rim, animated water surface ---- */
  W3.water = [];
  for (const p of pools) {
    const mats = HP.graphics3d ? HP.graphics3d.poolWater() : {
      surf: new THREE.MeshLambertMaterial({ color: 0x5db8d2, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
      caustic: null, basin: new THREE.MeshLambertMaterial({ color: 0xcfeef2, side: THREE.DoubleSide }),
    };
    const DEPTH = C, WY = -3.5;
    const w = p.x1 - p.x0, d = p.z1 - p.z0, pcx = (p.x0 + p.x1) / 2, pcz = (p.z0 + p.z1) / 2;
    const stone = HP.graphics3d ? HP.graphics3d.worldUV(HP.graphics3d.material('stone', '#d8d0bd').clone(), C * 2)
                              : new THREE.MeshLambertMaterial({ color: 0xd8d0bd });
    const g2 = new THREE.Group();
    const rec = { caustics: [] };
    const causticMat = size => {
      const cm = mats.caustic.clone();
      if (mats.caustic.map) {
        cm.map = mats.caustic.map.clone();
        cm.map.repeat.set(size[0] / 110, size[1] / 110);
        cm.map.needsUpdate = true;
      }
      rec.caustics.push(cm);
      return cm;
    };
    if (p.round) {
      const r = Math.min(w, d) / 2 - 2;
      const floor = new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), mats.basin);
      floor.position.set(pcx, -DEPTH + 0.4, pcz); floor.receiveShadow = true;
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r, DEPTH - 0.4, 40, 1, true), mats.basin);
      wall.position.set(pcx, -DEPTH / 2 + 0.2, pcz);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r + 2, 2.2, 8, 40).rotateX(Math.PI / 2), stone);
      rim.position.set(pcx, 0.6, pcz); rim.castShadow = rim.receiveShadow = true;
      const water = new THREE.Mesh(new THREE.CircleGeometry(r + 0.5, 40).rotateX(-Math.PI / 2), mats.surf);
      water.position.set(pcx, WY, pcz); water.renderOrder = 2;
      g2.add(floor, wall, rim, water);
      if (r >= 16) {
        const sw = Math.min(18, r * 0.65);
        for (const [si, sy, sd] of [[0, -DEPTH * 0.42, 7], [1, -DEPTH * 0.72, 12]]) {
          const step = new THREE.Mesh(new THREE.BoxGeometry(sw, 2.2, sd), mats.basin);
          step.position.set(pcx, sy, pcz + Math.max(0, r - 2 - sd / 2 - si * 4.5));
          step.receiveShadow = true;
          g2.add(step);
        }
      }
      if (mats.caustic) {
        const ca = new THREE.Mesh(new THREE.CircleGeometry(r - 1, 36).rotateX(-Math.PI / 2), causticMat([r * 2, r * 2]));
        ca.position.set(pcx, -DEPTH + 0.9, pcz); ca.renderOrder = 1;
        g2.add(ca);
      }
    } else {
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(w - 3, d - 3).rotateX(-Math.PI / 2), mats.basin);
      floor.position.set(pcx, -DEPTH + 0.4, pcz); floor.receiveShadow = true; g2.add(floor);
      for (const [ox, oz, ww, rot] of [[0, -d / 2 + 1.6, w - 3, 0], [0, d / 2 - 1.6, w - 3, 0],
                                       [-w / 2 + 1.6, 0, d - 3, 1], [w / 2 - 1.6, 0, d - 3, 1]]) {
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(ww, DEPTH - 0.4), mats.basin);
        wall.position.set(pcx + ox, -DEPTH / 2 + 0.2, pcz + oz);
        if (rot) wall.rotation.y = Math.PI / 2;
        g2.add(wall);
      }
      for (const [bx, bz, bw, bd] of [[0, -d / 2 + 1, w + 4, 5], [0, d / 2 - 1, w + 4, 5],
                                      [-w / 2 + 1, 0, 5, d - 6.04], [w / 2 - 1, 0, 5, d - 6.04]]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(bw, 3.4, bd), stone);
        b.position.set(pcx + bx, 0.2, pcz + bz); b.castShadow = b.receiveShadow = true;
        g2.add(b);
      }
      const stairDefs = [
        { ax: 'z', dir: -1, from: p.z1 - 3, u0: p.x0 + 2, u1: p.x0 + 22, ap: [p.x0 + 11, p.z1 + 12] },
        { ax: 'z', dir: -1, from: p.z1 - 3, u0: p.x1 - 22, u1: p.x1 - 2, ap: [p.x1 - 11, p.z1 + 12] },
        { ax: 'z', dir: 1,  from: p.z0 + 3, u0: p.x0 + 2, u1: p.x0 + 22, ap: [p.x0 + 11, p.z0 - 12] },
        { ax: 'z', dir: 1,  from: p.z0 + 3, u0: p.x1 - 22, u1: p.x1 - 2, ap: [p.x1 - 11, p.z0 - 12] },
        { ax: 'x', dir: 1,  from: p.x0 + 3, u0: p.z0 + 2, u1: p.z0 + 22, ap: [p.x0 - 12, p.z0 + 11] },
        { ax: 'x', dir: 1,  from: p.x0 + 3, u0: p.z1 - 22, u1: p.z1 - 2, ap: [p.x0 - 12, p.z1 - 11] },
        { ax: 'x', dir: -1, from: p.x1 - 3, u0: p.z0 + 2, u1: p.z0 + 22, ap: [p.x1 + 12, p.z0 + 11] },
        { ax: 'x', dir: -1, from: p.x1 - 3, u0: p.z1 - 22, u1: p.z1 - 2, ap: [p.x1 + 12, p.z1 - 11] },
      ];
      const nonPoolFootprints = (allLevels[0].furniture || [])
        .filter(it => !/pool$|pond/i.test(it.type) && HP.itemDef(it.type))
        .map(it => { const f = HP.footprint(it); return { x0: f.x * C - 8, x1: (f.x + f.w) * C + 8, z0: f.y * C - 8, z1: (f.y + f.h) * C + 8 }; });
      const clutter = (x, z) => {
        let s = 0;
        for (const f of nonPoolFootprints) {
          if (x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1) s++;
        }
        return s;
      };
      const st = stairDefs.reduce((best, s) => clutter(s.ap[0], s.ap[1]) < clutter(best.ap[0], best.ap[1]) ? s : best);
      const RUN = 30, RISE = 7, TREAD = 10, WALL_TOP = -DEPTH + 0.4;
      for (let i = 0; i < 3; i++) {
        const top = -(i + 1) * RISE;
        const s0 = st.from + st.dir * i * TREAD, s1 = st.from + st.dir * RUN;
        const [bx0, bz0, bx1, bz1] = st.ax === 'z'
          ? [st.u0, Math.min(s0, s1), st.u1, Math.max(s0, s1)]
          : [Math.min(s0, s1), st.u0, Math.max(s0, s1)];
        const step = new THREE.Mesh(
          new THREE.BoxGeometry(bx1 - bx0, top - WALL_TOP, bz1 - bz0), mats.basin);
        step.position.set((bx0 + bx1) / 2, (top + WALL_TOP) / 2, (bz0 + bz1) / 2);
        step.receiveShadow = true;
        g2.add(step);
      }
      const zone = st.ax === 'z'
        ? { x0: st.u0, x1: st.u1, z0: Math.min(st.from, st.from + st.dir * RUN), z1: Math.max(st.from, st.from + st.dir * RUN) }
        : { z0: st.u0, z1: st.u1, x0: Math.min(st.from, st.from + st.dir * RUN), x1: Math.max(st.from, st.from + st.dir * RUN) };
      const area = W3.waterAreas[pools.indexOf(p)];
      area.stairs = { ...zone, ax: st.ax, from: st.from, dir: st.dir, rise: RISE, tread: TREAD, run: RUN };

      const seg = Math.max(6, Math.min(26, Math.round(Math.min(w, d) / 6)));
      const wg = new THREE.PlaneGeometry(w - 2, d - 2, seg, seg).rotateX(-Math.PI / 2);
      const water = new THREE.Mesh(wg, mats.surf);
      water.position.set(pcx, WY, pcz); water.renderOrder = 2;
      g2.add(water);
      const pos = wg.attributes.position, taper = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i), vz = pos.getZ(i);
        const ex = Math.min(vx + (w - 2) / 2, (w - 2) / 2 - vx);
        const ez = Math.min(vz + (d - 2) / 2, (d - 2) / 2 - vz);
        taper[i] = Math.max(0, Math.min(1, Math.min(ex, ez) / 5));
      }
      rec.pos = pos; rec.taper = taper;
      if (mats.caustic) {
        const ca = new THREE.Mesh(new THREE.PlaneGeometry(w - 3, d - 3).rotateX(-Math.PI / 2), causticMat([w - 3, d - 3]));
        ca.position.set(pcx, -DEPTH + 0.9, pcz); ca.renderOrder = 1;
        g2.add(ca);
      }
    }
    W3.water.push(rec);
    sg.add(g2);
  }

  /* ---- shared materials for fixtures across all levels ---- */
  const gateMat = HP.graphics3d ? HP.graphics3d.material('wood', '#9a774f') :
    new THREE.MeshLambertMaterial({ color: 0x9a774f });
  const gateFrameMat = HP.graphics3d ? HP.graphics3d.material('wood', '#78350f') :
    new THREE.MeshLambertMaterial({ color: 0x78350f });
  const gateIronMat = HP.graphics3d ? HP.graphics3d.material('metal', '#181b1e') :
    new THREE.MeshLambertMaterial({ color: 0x181b1e });
  const leafMat = W3._leafMat = HP.graphics3d ? HP.graphics3d.material('wood', '#cfb394') :
    new THREE.MeshLambertMaterial({ color: 0x8a6844 });
  const knobMat = W3._knobMat = HP.graphics3d ? HP.graphics3d.material('metal', '#5b5f63') :
    new THREE.MeshLambertMaterial({ color: 0x3c3f45 });
  const knobGeo = W3._knobGeo = new THREE.SphereGeometry(1.2, 8, 6);
  const paneMat = W3._paneMat = HP.graphics3d ? HP.graphics3d.material('glass', '#bfe3ea') :
    new THREE.MeshLambertMaterial({ color: 0x9fd4e8, transparent: true, opacity: 0.45 });
  const sashMat = W3._sashMat = HP.graphics3d ? HP.graphics3d.material('metal', '#eae4d6') :
    new THREE.MeshLambertMaterial({ color: 0xeae4d6 });

  W3.windows = [];
  const allStaticColliders = [];

  /* ---- build architectural structures for each level ---- */
  allLevels.forEach((curLvl, lIdx) => {
    const bY = lIdx * WALL_H;
    mark('preLevel_' + lIdx);
    const env = geomEnv(curLvl);
    const geo = HP.geom3d.build(curLvl.walls || {}, env);
    mark('geomBuild_' + lIdx);
    if (lIdx === (HP.state && HP.state.level || 0)) {
      W3.geom = geo;
    }

    if (bY > 0) {
      for (const b of geo.boxes) {
        b.y0 += bY;
        b.y1 += bY;
      }
    }

    const wallPartsByMat = {};
    const addWallPart = (style, part) => {
      const s = style || 'plaster';
      (wallPartsByMat[s] = wallPartsByMat[s] || []).push(part);
    };
    const adjWallBox = (box, st) => (st !== 'glass' && lIdx > 0 && Math.abs(box.y0 - bY) < 0.05 && box.y1 > bY + 2)
      ? { ...box, y0: bY - 0.18 } : box;

    const splitBoxes = V.splitBoxes(geo.boxes);
    for (const b of splitBoxes) {
      if (b.tag === 'fence') continue;
      const defC = b.ext ? '#e9e2d2' : '#f4efe4';
      if (b.tag === 'wall' && b.line !== undefined) {
        const isH = b.d === 'h';
        const u0 = isH ? b.x0 : b.z0, u1 = isH ? b.x1 : b.z1;
        const cuts = [u0];
        for (let u = (Math.floor(u0 / C) + 1) * C; u < u1 - 0.5; u += C)
          if (u > u0 + 0.5) cuts.push(u);
        cuts.push(u1);
        for (let i = 0; i + 1 < cuts.length; i++) {
          const s0 = cuts[i], s1 = cuts[i + 1];
          const ci = Math.floor(((s0 + s1) / 2) / C);
          const wk = b.d + ',' + (isH ? ci : b.line) + ',' + (isH ? b.line : ci);
          const w = curLvl.walls[wk];
          let st = (w && (w.style || w._resolvedStyle));
          let ca = w && (w.ca || w._resolvedCa), cb = w && (w.cb || w._resolvedCb);
          if (w && (w.f === 'door' || w.f === 'window')) {
            const ws = resolveDoorWallStyle(curLvl, { k: wk, d: b.d, dbl: false, ext: b.ext });
            if (!st) st = ws.style;
            if (!ca) ca = ws.ca;
            if (!cb) cb = ws.cb;
          }
          st = st || 'plaster';
          const sDefC = styleDefaultCol(st, b.ext);
          ca = ca || sDefC;
          cb = cb || sDefC;
          const sb = adjWallBox(isH ? { ...b, x0: s0, x1: s1 } : { ...b, z0: s0, z1: s1 }, st);
          if (ca === cb) {
            addWallPart(st, boxPart(sb, ca));
          } else if (isH) {
            const zm = (sb.z0 + sb.z1) / 2;
            addWallPart(st, boxPart({ ...sb, z1: zm }, ca));
            addWallPart(st, boxPart({ ...sb, z0: zm }, cb));
          } else {
            const xm = (sb.x0 + sb.x1) / 2;
            addWallPart(st, boxPart({ ...sb, x1: xm }, ca));
            addWallPart(st, boxPart({ ...sb, x0: xm }, cb));
          }
        }
        continue;
      }
      if (b.tag === 'corner' && b.vx !== undefined) {
        const hL = curLvl.walls['h,' + (b.vx - 1) + ',' + b.vy];
        const hR = curLvl.walls['h,' + b.vx + ',' + b.vy];
        const vT = curLvl.walls['v,' + b.vx + ',' + (b.vy - 1)];
        const vB = curLvl.walls['v,' + b.vx + ',' + b.vy];
        const st = (hL && hL.style) || (hR && hR.style) || (vT && vT.style) || (vB && vB.style) || 'plaster';
        const sDefC = styleDefaultCol(st, b.ext);
        const cNW = (hL && hL.ca) || (vT && vT.ca) || sDefC;
        const cNE = (hR && hR.ca) || (vT && vT.cb) || sDefC;
        const cSW = (hL && hL.cb) || (vB && vB.ca) || sDefC;
        const cSE = (hR && hR.cb) || (vB && vB.cb) || sDefC;
        const cbBox = adjWallBox(b, st);
        if (cNW === cNE && cNW === cSW && cNW === cSE) {
          addWallPart(st, boxPart(cbBox, cNW));
        } else {
          const xm = (cbBox.x0 + cbBox.x1) / 2, zm = (cbBox.z0 + cbBox.z1) / 2;
          addWallPart(st, boxPart({ ...cbBox, x1: xm, z1: zm }, cNW));
          addWallPart(st, boxPart({ ...cbBox, x0: xm, z1: zm }, cNE));
          addWallPart(st, boxPart({ ...cbBox, x1: xm, z0: zm }, cSW));
          addWallPart(st, boxPart({ ...cbBox, x0: xm, z0: zm }, cSE));
        }
        continue;
      }
      addWallPart('plaster', boxPart(adjWallBox(b, 'plaster'), defC));
    }

    mark('splitWallBoxes_' + lIdx);
    for (const st in wallPartsByMat) {
      const parts = wallPartsByMat[st];
      if (!parts || !parts.length) continue;
      const mat = getWallMat(st);
      V.instanced(sg, unitBox(), mat, parts, { cast: st !== 'glass', receive: true, lvlIdx: lIdx });
      if (st === 'glass' && HP.graphics3d) {
        const frameMat = HP.graphics3d.material('metal', '#1e2023');
        const channelParts = [];
        for (const p of parts) {
          if (p.y0 <= bY + 2) {
            channelParts.push(boxPart({ x0: p.x0, x1: p.x1, z0: p.z0, z1: p.z1, y0: bY, y1: bY + 1.8 }, '#1e2023'));
          }
          if (p.y1 >= bY + WALL_H - 2) {
            channelParts.push(boxPart({ x0: p.x0, x1: p.x1, z0: p.z0, z1: p.z1, y0: bY + 72.2, y1: bY + 74 }, '#1e2023'));
          }
        }
        if (channelParts.length) {
          V.instanced(sg, unitBox(), frameMat, channelParts, { cast: true, receive: true, lvlIdx: lIdx });
        }
      }
    }
    mark('instancedWalls_' + lIdx);

    if (HP.graphics3d) {
      const rails = [];
      for (const b of splitBoxes) {
        if (b.tag === 'fence' || b.y0 > bY + 0.1 || b.y1 < bY + 10) continue;
        if (b.tag === 'corner' && b.vx !== undefined) {
          const nw = env.rAt(b.vx - 1, b.vy - 1) >= 0;
          const ne = env.rAt(b.vx, b.vy - 1) >= 0;
          const sw = env.rAt(b.vx - 1, b.vy) >= 0;
          const se = env.rAt(b.vx, b.vy) >= 0;
          const hL = curLvl.walls && curLvl.walls['h,' + (b.vx - 1) + ',' + b.vy];
          const hR = curLvl.walls && curLvl.walls['h,' + b.vx + ',' + b.vy];
          const vT = curLvl.walls && curLvl.walls['v,' + b.vx + ',' + (b.vy - 1)];
          const vB = curLvl.walls && curLvl.walls['v,' + b.vx + ',' + b.vy];
          if ((nw || ne) && !vT) rails.push({ x0: b.x0, x1: b.x1, z0: b.z0 - 0.25, z1: b.z0 + 0.01, y0: bY, y1: bY + 2.2 });
          if ((sw || se) && !vB) rails.push({ x0: b.x0, x1: b.x1, z0: b.z1 - 0.01, z1: b.z1 + 0.25, y0: bY, y1: bY + 2.2 });
          if ((nw || sw) && !hL) rails.push({ x0: b.x0 - 0.25, x1: b.x0 + 0.01, z0: b.z0, z1: b.z1, y0: bY, y1: bY + 2.2 });
          if ((ne || se) && !hR) rails.push({ x0: b.x1 - 0.01, x1: b.x1 + 0.25, z0: b.z0, z1: b.z1, y0: bY, y1: bY + 2.2 });
          continue;
        }
        const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
        const isH = b.d ? b.d === 'h' : (b.x1 - b.x0) >= (b.z1 - b.z0);
        if (isH) {
          if (env.rAt(Math.floor(cx / C), Math.floor((b.z0 - 1.5) / C)) >= 0) {
            rails.push({ x0: b.x0, x1: b.x1, z0: b.z0 - 0.25, z1: b.z0 + 0.01, y0: bY, y1: bY + 2.2 });
          }
          if (env.rAt(Math.floor(cx / C), Math.floor((b.z1 + 1.5) / C)) >= 0) {
            rails.push({ x0: b.x0, x1: b.x1, z0: b.z1 - 0.01, z1: b.z1 + 0.25, y0: bY, y1: bY + 2.2 });
          }
        } else {
          if (env.rAt(Math.floor((b.x0 - 1.5) / C), Math.floor(cz / C)) >= 0) {
            rails.push({ x0: b.x0 - 0.25, x1: b.x0 + 0.01, z0: b.z0, z1: b.z1, y0: bY, y1: bY + 2.2 });
          }
          if (env.rAt(Math.floor((b.x1 + 1.5) / C), Math.floor(cz / C)) >= 0) {
            rails.push({ x0: b.x1 - 0.01, x1: b.x1 + 0.25, z0: b.z0, z1: b.z1, y0: bY, y1: bY + 2.2 });
          }
        }
      }
      if (rails.length) {
        V.instanced(sg, unitBox(), HP.graphics3d.material('ceramic', '#dfd8c9'),
          V.splitBoxes(rails).map(b => boxPart(b)), { receive: true, detail: true, lvlIdx: lIdx });
      }
    }
    mark('skirtingRails_' + lIdx);

    buildFences3D(curLvl.fences, curLvl.walls, sg, C, V, bY, lIdx);
    mark('fences_' + lIdx);

    if (geo.windows.length) {
      for (const opening of geo.windows) {
        const w = { ...opening, y0: opening.y0 + bY, y1: opening.y1 + bY }, isH = w.d === 'h';
        const n = Math.max(1, Math.round(((isH ? w.x1 - w.x0 : w.z1 - w.z0) + 4) / C));
        for (const b of geo.boxes) {
          if (b.tag !== 'corner' || b.y0 >= w.y1 || b.y1 <= w.y0) continue;
          if (isH && b.z1 > w.z0 && b.z0 < w.z1) {
            if (b.x0 <= w.x0 && b.x1 > w.x0) w.x0 = b.x1;
            if (b.x1 >= w.x1 && b.x0 < w.x1) w.x1 = b.x0;
          } else if (!isH && b.x1 > w.x0 && b.x0 < w.x1) {
            if (b.z0 <= w.z0 && b.z1 > w.z0) w.z0 = b.z1;
            if (b.z1 >= w.z1 && b.z0 < w.z1) w.z1 = b.z0;
          }
        }
        const span = isH ? w.x1 - w.x0 : w.z1 - w.z0;
        const height = w.y1 - w.y0, rim = 1.25, rail = 0.85;
        const width = span - rim * 2, insideH = height - rim * 2;
        const a = { ...w, cx: (w.x0 + w.x1) / 2, cz: (w.z0 + w.z1) / 2 };
        const seg = HP.parseWallKey(w.k);
        const minusRoom = isH ? env.rAt(seg.x, seg.y - 1) : env.rAt(seg.x - 1, seg.y);
        const plusRoom = env.rAt(seg.x, seg.y);
        let inward = minusRoom >= 0 && (plusRoom < 0 || env.rsz(minusRoom) < env.rsz(plusRoom)) ? -1 : 1;
        if (w.swing === 'out') inward = -inward;
        const wallDepth = isH ? w.z1 - w.z0 : w.x1 - w.x0;
        const root = new THREE.Group();
        root.position.set(a.cx, (w.y0 + w.y1) / 2, a.cz);
        sg.add(root);
        V.add(root, w.x0 - span, w.z0 - span, w.x1 + span, w.z1 + span);
        const wallSeg = curLvl.walls && curLvl.walls[w.k];
        const winStyle = (wallSeg && (wallSeg.winStyle || (wallSeg.style === 'awning' || wallSeg.style === 'hopper' || wallSeg.style === 'slider' || wallSeg.style === 'single_hung' ? wallSeg.style : null))) || w.winStyle || (n === 1 ? 'single-hung' : 'casement');
        const assembly = { a, root, panels: [], inward, style: winStyle === 'single_hung' ? 'single-hung' : winStyle, winStyle,
          w, span, height, rim, rail, width, insideH, wallDepth, n, isH, lvlIdx: lIdx };
        W3.windows.push(assembly);
        populateWindowAssembly(assembly, sashMat, paneMat, doorPivots);
      }
    }

    for (const k in (curLvl.fences || {})) {
      const fv = curLvl.fences[k];
      if (!fv || fv.t !== 'gate') continue;
      const s = HP.parseWallKey(k), isH = s.d === 'h';
      const gh = 24, gt = 3.6;
      const nKey = isH ? `h,${s.x + 1},${s.y}` : `v,${s.x},${s.y + 1}`;
      const li = (curLvl.fences[nKey] && curLvl.fences[nKey].t === 'gate') ? 0 : 1;
      const a = isH
        ? { d: 'h', x0: s.x * C, x1: (s.x + 1) * C, z0: s.y * C - 2, z1: s.y * C + 2, cx: (s.x + 0.5) * C, cz: s.y * C }
        : { d: 'v', x0: s.x * C - 2, x1: s.x * C + 2, z0: s.y * C, z1: (s.y + 1) * C, cx: s.x * C, cz: (s.y + 0.5) * C };

      const postGeo = new THREE.BoxGeometry(3.6, gh + 4, 3.6);
      const postCapGeo = new THREE.ConeGeometry(2.6, 2.0, 4).rotateY(Math.PI / 4);
      for (const [px, pz] of [[isH ? a.x0 : a.cx, isH ? a.cz : a.z0], [isH ? a.x1 : a.cx, isH ? a.cz : a.z1]]) {
        const pMesh = new THREE.Mesh(postGeo, gateFrameMat);
        pMesh.position.set(px, bY + (gh + 4) / 2, pz);
        pMesh.castShadow = pMesh.receiveShadow = true;
        sg.add(pMesh);
        const capMesh = new THREE.Mesh(postCapGeo, gateFrameMat);
        capMesh.position.set(px, bY + gh + 4 + 1.0, pz);
        capMesh.castShadow = capMesh.receiveShadow = true;
        sg.add(capMesh);
      }

      const pivot = new THREE.Group();
      pivot.position.set(isH ? (li === 0 ? a.x0 : a.x1) : s.x * C, bY,
                         isH ? s.y * C : (li === 0 ? a.z0 : a.z1));
      const lw = C - 1.0, lh3 = gh;
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(isH ? lw : gt, lh3, isH ? gt : lw), gateMat);
      const leafOff = (li === 0 ? lw / 2 + 0.5 : -lw / 2 - 0.5);
      leaf.position.set(isH ? leafOff : 0, gh / 2,
                        isH ? 0 : leafOff);
      leaf.castShadow = leaf.receiveShadow = true;
      pivot.add(leaf);

      const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(isH ? lw : gt + 0.6, lh3, isH ? gt + 0.6 : lw), gateFrameMat);
      frameMesh.position.copy(leaf.position);
      frameMesh.scale.set(0.96, 0.98, 0.96);
      frameMesh.castShadow = true;
      pivot.add(frameMesh);

      const zBrace = new THREE.Mesh(new THREE.BoxGeometry(isH ? lw * 0.82 : gt + 0.8, 2.2, isH ? gt + 0.8 : lw * 0.82), gateFrameMat);
      zBrace.position.copy(leaf.position);
      if (isH) zBrace.rotation.z = 0.58 * (li === 0 ? 1 : -1);
      else zBrace.rotation.x = 0.58 * (li === 0 ? 1 : -1);
      zBrace.castShadow = true;
      pivot.add(zBrace);

      for (const hy of [5, gh - 4]) {
        const hinge = new THREE.Mesh(new THREE.BoxGeometry(isH ? lw * 0.45 : gt + 1.0, 1.8, isH ? gt + 1.0 : lw * 0.45), gateIronMat);
        const hOff = (li === 0 ? lw * 0.25 : -lw * 0.25);
        hinge.position.set(isH ? hOff : 0, hy, isH ? 0 : hOff);
        hinge.castShadow = true;
        pivot.add(hinge);
      }
      const latch = new THREE.Mesh(new THREE.BoxGeometry(isH ? 2.5 : gt + 1.2, 5.0, isH ? gt + 1.2 : 2.5), gateIronMat);
      const lOff = (li === 0 ? lw - 2.0 : -lw + 2.0);
      latch.position.set(isH ? lOff : 0, gh * 0.55, isH ? 0 : lOff);
      latch.castShadow = true;
      pivot.add(latch);

      sg.add(pivot);
      V.add(pivot, a.x0 - C, a.z0 - C, a.x1 + C, a.z1 + C);
      doorPivots.push({ pivot, a, open: 0, target: 0, leaf, lw, li,
                        vel: 0, holdT: 0, latched: false, gate: true,
                        ly0: bY, ly1: bY + gh });
    }

    mark('windows_' + lIdx);

    // Group connected sliding barn door apertures into unified runs so adjacent doors share one clean, continuous track
    const slideRuns = [];
    for (const a of geo.doors) {
      const rec = curLvl && curLvl.walls && curLvl.walls[a.k];
      const doorStyle = (rec && rec.doorStyle) || 'panel';
      if (doorStyle === 'slide') {
        const isH = a.d === 'h';
        const u0 = isH ? a.x0 : a.z0, u1 = isH ? a.x1 : a.z1;
        const v = isH ? (a.z0 + a.z1) / 2 : (a.x0 + a.x1) / 2;
        let match = slideRuns.find(r => r.d === a.d && Math.abs(r.v - v) < 2 && (Math.abs(r.u1 - u0) < 2 || Math.abs(r.u0 - u1) < 2));
        if (match) {
          match.u0 = Math.min(match.u0, u0);
          match.u1 = Math.max(match.u1, u1);
          match.doors.push(a);
        } else {
          slideRuns.push({ d: a.d, v, u0, u1, doors: [a] });
        }
      }
    }

    const cornerBoxes = geo.boxes.filter(c => c.tag === 'corner' && c.y0 <= bY + 30);
    const archwayItems = (curLvl && curLvl.furniture) ? curLvl.furniture.filter(it => /^archway/i.test(it.type)) : [];

    for (const a of geo.doors) {
      const da = { ...a, y0: a.y0 + bY, y1: a.y1 + bY, baseY: bY, lvl: curLvl, lvlIdx: lIdx };
      let s0 = da.d === 'h' ? da.x0 : da.z0, s1 = da.d === 'h' ? da.x1 : da.z1;
      let post0 = false, post1 = false;
      for (const c of cornerBoxes) {
        const ox = Math.min(c.x1, da.x1) - Math.max(c.x0, da.x0);
        const oz = Math.min(c.z1, da.z1) - Math.max(c.z0, da.z0);
        const depthOverlap = da.d === 'h' ? oz > 0 : ox > 0;
        if (!depthOverlap) continue;
        if (da.d === 'h') { if (c.x1 > da.x0 - 0.6 && c.x0 <= da.x0 + 0.6) { s0 = Math.max(s0, c.x1); post0 = true; }
                           if (c.x0 < da.x1 + 0.6 && c.x1 >= da.x1 - 0.6) { s1 = Math.min(s1, c.x0); post1 = true; } }
        else             { if (c.z1 > da.z0 - 0.6 && c.z0 <= da.z0 + 0.6) { s0 = Math.max(s0, c.z1); post0 = true; }
                           if (c.z0 < da.z1 + 0.6 && c.z1 >= da.z1 - 0.6) { s1 = Math.min(s1, c.z0); post1 = true; } }
      }
      const span = s1 - s0;
      const leaves = da.dbl ? 2 : 1;
      const seg = HP.parseWallKey(da.k);
      const minusRoom = da.d === 'h' ? env.rAt(seg.x, seg.y - 1) : env.rAt(seg.x - 1, seg.y);
      const plusRoom = env.rAt(seg.x, seg.y);
      const minusIsInside = minusRoom >= 0 && (plusRoom < 0 || env.rsz(minusRoom) < env.rsz(plusRoom));
      const insideFlip = minusIsInside ? 1 : -1;
      const outsideFlip = minusIsInside ? -1 : 1;
      if (da.swing === 'out') da.flip = outsideFlip;
      else if (da.swing === 'in') da.flip = insideFlip;

      // Check if an archway catalog item is placed over this doorway: adapt panel doors visually without mutating saved walls
      const hasArchwayItem = archwayItems.length > 0 && archwayItems.some(it => {
        const f = HP.footprint(it);
        const fx0 = f.x * C, fx1 = (f.x + f.w) * C, fz0 = f.y * C, fz1 = (f.y + f.h) * C;
        return da.d === 'h'
          ? (Math.abs(fz0 - da.z0) < C && fx0 <= da.x0 + 2 && fx1 >= da.x1 - 2)
          : (Math.abs(fx0 - da.x0) < C && fz0 <= da.z0 + 2 && fz1 >= da.z1 - 2);
      });
      if (hasArchwayItem && curLvl && curLvl.walls && curLvl.walls[da.k]) {
        const curStyle = curLvl.walls[da.k].doorStyle || 'panel';
        if (curStyle === 'panel') da.forcedStyle = 'arched';
      }

      for (let li = 0; li < leaves; li++) {
        const pivot = new THREE.Group();
        sg.add(pivot);
        V.add(pivot, da.x0 - C, da.z0 - C, da.x1 + C, da.z1 + C);
        const dp = { pivot, a: da, open: 0, target: 0, vel: 0, holdT: 0, latched: false,
                     flip: da.flip, s0, s1, post0, post1, ly0: bY, ly1: bY + 70, lvlIdx: lIdx };
        populateDoorLeaf(dp, da, leaves, li, span, s0, s1, post0, post1, leafMat, knobMat, knobGeo, bY);
        if (li === 0) {
          dp.frameMesh = buildDoorFrame(da, s0, s1, sg, bY);
        }
        if (dp.doorStyle === 'slide' && li === 0) {
          const run = slideRuns.find(r => r.doors.includes(a));
          if (run && run.doors.length > 1) {
            if (run.doors[0] === a) {
              const runSpan = run.u1 - run.u0;
              const runMid = (run.u0 + run.u1) / 2;
              dp.trackMesh = buildOverheadTrack(da, span, 2, s0, s1, da.flip !== undefined ? da.flip : 1, sg, runMid, runSpan);
            }
          } else {
            dp.trackMesh = buildOverheadTrack(da, span, leaves, s0, s1, da.flip !== undefined ? da.flip : 1, sg);
          }
        }
        doorPivots.push(dp);
      }
    }

    mark('doors_' + lIdx);

    W3._buildFloorMeshes(flg, curLvl, bY, stairFloorOpenings[lIdx], stairMeta[lIdx], allStaticColliders, allLevels[lIdx - 1]);
    mark('floors_' + lIdx);
    W3._buildCeilingMeshes(sg, curLvl, lIdx, bY, stairCeilingOpenings[lIdx], env);
    mark('ceilings_' + lIdx);

    allStaticColliders.push(...geo.boxes.filter(b => b.y0 < bY + 50 && b.y1 > bY + 2));
  });

  for (const dp of doorPivots) {
    if (!dp.a) continue;
    const prev = oldDoors.find(o => Math.abs(o.cx - dp.a.cx) < 2 && Math.abs(o.cz - dp.a.cz) < 2);
    if (prev && prev.latched) {
      dp.open = prev.open;
      dp.latched = prev.latched;
      dp.vel = prev.vel;
    }
  }
  V.setWalls(allLevels, doorPivots);
  mark('cullSetWalls');

  W3.staticColliders = allStaticColliders;
  W3.staticLamps = [];

  const tFurnStart = performance.now();
  const res = W3._buildFurnitureSync(fg);
  if (W3._lastBuildTimings) W3._lastBuildTimings.furnitureMs = +(performance.now() - tFurnStart).toFixed(1);
  W3.colliders = (W3.staticColliders || []).concat(res.furnColliders);
  W3.lamps = (W3.staticLamps || []).concat(res.furnLamps);
  W3.movers = res.movers;
  W3.garageDoors = res.garageDoors;
  W3.elevatedDecks = (W3.elevatedDecks || []).concat(res.elevatedDecks || []);
  W3.climbs = (res.climbs || []).concat(stairClimbs);
  W3.furnitureVisuals = res.visuals;
  W3._furnMetaById = res.furnMetaById;
  if (res.visuals) res.visuals.move(W3.movers);
  if (HP.graphics3d) HP.graphics3d.applyMaterials(g);

  /* Pre-initialize door limits and flips so tick() doesn't freeze on Frame 0 */
  if (HP.walk3d && HP.walk3d.initDoors) HP.walk3d.initDoors();

  /* Pre-warm shaders, textures, and shadow pass ahead of gameplay */
  if (renderer && scene && camera) {
    const q = HP.graphics3d && HP.graphics3d.current;
    if (q && q.env && !scene.environment && (envDay || envNight)) {
      const s = HP.sky3d ? HP.sky3d.sample(TIME.hour) : { night: 0 };
      scene.environment = (s && s.night > 0.5) ? envNight : envDay;
    }
    // Pre-cull scene to spawn room so initial render compiles ONLY visible spawn shaders
    if (HP.cull3d && HP.cull3d.update) {
      const camY = camera.position.y;
      const camFloor = Math.max(0, Math.floor(((camY || 0) + 0.1) / WALL_H));
      HP.cull3d.update(camera.position.x, camera.position.z, true, camFloor);
    }
    if (typeof renderer.render === 'function') {
      const tRendStart = performance.now();
      try { renderer.render(scene, camera); } catch (_) {}
      if (W3._lastBuildTimings) W3._lastBuildTimings.initialRenderMs = +(performance.now() - tRendStart).toFixed(1);
    }
    if (W3._lastBuildTimings) W3._lastBuildTimings.totalBuildMs = +(performance.now() - bStart).toFixed(1);
  }
};

/* ---------- Modular Furniture Building (Synchronous & Async Sliced) ---------- */
function initFurnitureContext(targetGroup) {
  const C = HP.CELL, env = geomEnv();
  const WALL_H = (HP.geom3d && HP.geom3d.WALL_H) || 74;
  const allLevels = (HP.state && HP.state.levels && HP.state.levels.length) ? HP.state.levels : [HP.cur()];
  const allFurniture = [];
  allLevels.forEach((curLvl, lIdx) => {
    const lvlBaseY = lIdx * WALL_H;
    for (const it of (curLvl.furniture || [])) {
      it._baseY = (it._baseY !== undefined && it._baseY >= lvlBaseY) ? it._baseY : lvlBaseY;
      it._levelIdx = lIdx;
      allFurniture.push(it);
      if (it.interior && it.interior.customized && it.interior.furniture && it.interior.furniture.length > 0) {
        for (const sub of it.interior.furniture) {
          const wSub = HP.interiorToWorld ? HP.interiorToWorld(it, sub) : null;
          if (wSub) {
            wSub._baseY = (wSub._baseY !== undefined ? wSub._baseY : 0) + lvlBaseY;
            wSub._levelIdx = lIdx;
            allFurniture.push(wSub);
          }
        }
      }
    }
  });
  const known = allFurniture.filter(it => HP.itemDef(it.type));
  const items = known.filter(it => !HP.itemDef(it.type).hangs);
  const hangs = known.filter(it => HP.itemDef(it.type).hangs);
  const fit2 = new THREE.InstancedMesh(unitBox(), new THREE.MeshLambertMaterial({ color: 0xffffff }), items.length + hangs.length);
  W3.fitMesh = fit2;
  const furnColliders = [];
  const movers = [];
  const models = HP.furniture3d ? HP.furniture3d.builder(targetGroup) : null;
  const lifeItems = [];
  const garageDoors = [];
  const elevatedDecks = [];
  const climbs = [];
  const furnLamps = [];
  const furnMetaById = new Map();
  const m4 = new THREE.Matrix4(), col = new THREE.Color();

  const itemMeta = items.map(it => {
    const d = HP.itemDef(it.type);
    return {
      it, d,
      f: HP.footprint(it),
      h: itemH3D(d, it),
      isSurface: HP.isSurface(it)
    };
  });
  const surfaceMeta = itemMeta.filter(m => m.isSurface);
  const hostStructures = itemMeta.filter(m => /treehouse|greenhouse/i.test(m.it.type));

  return {
    targetGroup, lvl: HP.cur(), C, env, items, hangs, fit2, models, lifeItems,
    furnColliders, movers, garageDoors, elevatedDecks, climbs, furnLamps,
    furnMetaById, m4, col, itemMeta, surfaceMeta, hostStructures
  };
}

function buildSingleFurnitureItem(it, i, ctx) {
  const {
    targetGroup, lvl, C, env, fit2, models, lifeItems, furnColliders,
    movers, garageDoors, elevatedDecks, climbs, furnMetaById,
    m4, col, itemMeta, surfaceMeta, hostStructures
  } = ctx;
  const meta = itemMeta[i];
  const d = meta.d, f = meta.f, h = meta.h;
  const c = (it.colors && it.colors[0]) || (d.colors && d.colors[0]) || '#999';
  let baseY = it._baseY !== undefined ? it._baseY : 0;
  const canSit = d.onTop || (HP.canSitOnSurface && HP.canSitOnSurface(it.type));
  if (canSit) {
    const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
    for (const sm of surfaceMeta) {
      if (sm.it === it) continue;
      if ((sm.it._levelIdx || 0) !== (it._levelIdx || 0)) continue;
      const of = sm.f;
      if (cx >= of.x && cx < of.x + of.w && cy >= of.y && cy < of.y + of.h)
        baseY = Math.max(baseY, (sm.it._baseY || 0) + sm.h);
    }
  }
  if (it.type !== 'treehouse' && it.type !== 'greenhouse' && hostStructures.length > 0) {
    const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
    for (const hm of hostStructures) {
      if (hm.it === it) continue;
      if ((hm.it._levelIdx || 0) !== (it._levelIdx || 0)) continue;
      const of = hm.f;
      if (cx >= of.x && cx < of.x + of.w && cy >= of.y && cy < of.y + of.h) {
        const hBase = hm.it._baseY || 0;
        if (/treehouse/i.test(hm.it.type)) {
          baseY = Math.max(baseY, hBase + 54.0);
        } else if (/greenhouse/i.test(hm.it.type)) {
          if (d.onTop && (!hm.it.interior || !hm.it.interior.customized)) {
            const relX = (cx - (of.x + of.w / 2)) / of.w;
            const ghH = hm.h;
            if (Math.abs(relX) > 0.20) baseY = Math.max(baseY, hBase + Math.round(ghH * 0.22));
          }
        }
      }
    }
  }
  it._baseY = baseY;
  lifeItems.push({ it, f, h, baseY });
  furnMetaById.set(it.id, { inst: i, origX: it.x, origY: it.y, it });

  if (/garagedoor/i.test(it.type)) {
    buildGarageDoorModel(it, d, f, c, C, lvl, env, targetGroup, garageDoors);
  }
  if (/treehouse/i.test(it.type)) {
    buildTreehouseClimbModel(it, f, C, elevatedDecks, climbs);
  }
  m4.makeScale(Math.max(2, f.w * C - 3), Math.max(1.5, h), Math.max(2, f.h * C - 3));
  m4.setPosition((f.x + f.w / 2) * C, baseY + h / 2, (f.y + f.h / 2) * C);
  fit2.setMatrixAt(i, m4);
  fit2.setColorAt(i, col.set(c));
  if (models) models.add(it, d, f, h, i, baseY);
  if (h > 10 && !FLAT(it.type) && !d.onTop && (!d.walkable || /^archway/i.test(it.type)) && it.type !== 'rangehood') {
    const colliders = HP.itemColliders ? HP.itemColliders(it, d, f, h) : [{ x0: f.x * C, x1: (f.x + f.w) * C, z0: f.y * C, z1: (f.y + f.h) * C, y0: baseY, y1: baseY + h }];
    for (const box of colliders) {
      furnColliders.push(box);
      if (colliders.length === 1 && pushable(it, d, f, h)) {
        box.mv = movers.length;
        movers.push({ inst: i, box, x: f.x * C, z: f.y * C,
                      w: f.w * C, h: f.h * C,
                      sx: Math.max(2, f.w * C - 3), sy: Math.max(1.5, h),
                      sz: Math.max(2, f.h * C - 3), vx: 0, vz: 0 });
      }
    }
  }
}

function buildSingleHangItem(it, i2, ctx) {
  const { targetGroup, items, fit2, models, lifeItems, furnMetaById, m4, col, C } = ctx;
  const i = items.length + i2;
  const d = HP.itemDef(it.type), f = HP.footprint(it);
  const bY = it._baseY !== undefined ? it._baseY : 0;
  lifeItems.push({ it, f, h: 0, baseY: bY });
  furnMetaById.set(it.id, { inst: i, origX: it.x, origY: it.y, it });
  const c = (it.colors && it.colors[0]) || (d.colors && d.colors[0]) || '#999';
  const w = f.w * C, dep = 4, hy = 52;
  m4.makeScale(it.rot % 2 ? dep : w, Math.max(10, f.h * C * 0.5), it.rot % 2 ? w : dep);
  m4.setPosition((f.x + f.w / 2) * C, bY + hy, (f.y + f.h / 2) * C);
  fit2.setMatrixAt(i, m4);
  fit2.setColorAt(i, col.set(c));
  if (models) models.add(it, d, f, 0, i, bY);
}

HP.getLampLightTransform = function (it, def, f, C, lvlWalls, geomEnv) {
  C = C || (HP.CELL || 24);
  const t = ((it && it.type) || (def && def.id) || '').toLowerCase();
  def = def || (HP.itemDef && HP.itemDef(t)) || {};
  f = f || (HP.footprint && HP.footprint(it)) || { x: it.x, y: it.y, w: it.w || def.w || 1, h: it.h || def.h || 1 };
  const bY = (it && it._baseY !== undefined) ? it._baseY : 0;
  const rot = (it && it.rot) || 0;

  if (!lvlWalls) {
    const lvl = (HP.cur && HP.cur()) || (HP.state && HP.state.levels && HP.state.levels[HP.state.level || 0]) || null;
    lvlWalls = (lvl && lvl.walls) || {};
  }
  if (!geomEnv) {
    if (HP.world3d && HP.world3d.geomEnv) geomEnv = HP.world3d.geomEnv();
    else if (HP.state && HP.computeRegions) {
      try {
        const cr = HP.computeRegions();
        if (cr && cr.regionOf && cr.regions) {
          geomEnv = {
            C,
            rAt: (x, y) => (x < 0 || y < 0 || x >= HP.GRID_W || y >= HP.GRID_H) ? -1 : cr.regionOf[y * HP.GRID_W + x],
            rsz: id => id >= 0 && cr.regions[id] ? cr.regions[id].cells.length : 1e9
          };
        }
      } catch (e) {}
    }
  }

  if (def.hangs || /sconce/i.test(t)) {
    const hang = (it && it.hang) || (HP.hangSide && HP.hangSide(t, it.x, it.y, rot, { w: f.w, h: f.h })) || 'n';
    const IN = (HP.geom3d && HP.geom3d.wallInset) ? HP.geom3d.wallInset(hang, f, lvlWalls, geomEnv) : 7.0;
    let x = (f.x + f.w / 2) * C;
    let z = (f.y + f.h / 2) * C;
    const forward = 2.2; // exactly matches sconce glass cylinder & filament center in furniture3d
    if (hang === 'n') z = f.y * C + IN + forward;
    else if (hang === 's') z = (f.y + f.h) * C - IN - forward;
    else if (hang === 'w') x = f.x * C + IN + forward;
    else if (hang === 'e') x = (f.x + f.w) * C - IN - forward;
    return {
      x, y: bY + 38, z,
      power: 0.9,
      geo: 'cylinder',
      r: 0.38,
      len: 12.0,
      color: '#ffe0a8'
    };
  }

  let width = Math.max(3, ((it && it.w) || (def && def.w) || 1) * C - 3);
  let depth = Math.max(3, ((it && it.h) || (def && def.h) || 1) * C - 3);
  let clDx = 0, clDz = 0;

  if (HP.geom3d && HP.geom3d.floorClearance) {
    const cl = HP.geom3d.floorClearance(f, lvlWalls, geomEnv, width, depth, rot);
    if (cl && (cl.dx || cl.dz || cl.w !== width || cl.d !== depth)) {
      clDx = cl.dx || 0;
      clDz = cl.dz || 0;
      width = cl.w;
      depth = cl.d;
    }
  }

  const h = itemH3D(def, it);
  const height = Math.max(1.5, h);

  let lx = 0, lz = 0, ly = height * 0.8;
  let power = 1.2;
  let geo = 'sphere';
  let r = 0.55;
  let len = 0;
  let color = '#ffe3a8';

  if (/^lamparc$/i.test(t)) {
    // Flos Arco lamp: pendant neck and chrome dome hood at x = +0.25 * width, y = 0.74 * height
    lx = 0.25 * width;
    lz = 0;
    ly = 0.74 * height;
    power = 1.4;
    r = 0.75;
    color = '#fef08a';
  } else if (/^floorlamp$/i.test(t)) {
    ly = 0.78 * height;
    power = 1.4;
    r = 0.55;
  } else if (/^lamptripod$/i.test(t)) {
    ly = 0.83 * height;
    power = 1.3;
    r = 0.55;
  } else if (/^lamptorch$/i.test(t)) {
    ly = 0.94 * height;
    power = 1.5;
    r = 0.75;
    color = '#fef3c7';
  } else if (/^lamptable$/i.test(t)) {
    ly = 0.72 * height;
    power = 1.1;
    r = 0.55;
  } else if (/^lamppaper$/i.test(t)) {
    ly = 0.55 * height;
    power = 1.2;
    r = 0.75;
    color = '#fef08a';
  } else if (/^lampmush$/i.test(t)) {
    ly = 0.42 * height;
    power = 1.0;
    r = 0.65;
  } else if (/^lampcandle$/i.test(t)) {
    ly = 0.445 * height;
    power = 0.8;
    r = 0.45;
    color = '#f59e0b';
  } else if (/^lampbanker$/i.test(t)) {
    lx = 0;
    lz = 0.04 * depth;
    ly = 0.47 * height;
    power = 1.0;
    geo = 'cylinderX';
    r = 0.35;
    len = 5.0;
    color = '#fef08a';
  } else if (/^topcandles$/i.test(t)) {
    ly = 0.38 * height;
    power = 0.75;
    r = 0.45;
    color = '#f59e0b';
  } else if (/^fllantern$/i.test(t)) {
    ly = 0.45 * height;
    power = 0.9;
    r = 0.55;
    color = '#f59e0b';
  } else if (/^nightlight$/i.test(t)) {
    ly = 0.42 * height;
    power = 0.8;
    r = 0.55;
    color = '#fef08a';
  } else if (/^lamppost$/i.test(t)) {
    ly = 0.945 * height;
    power = 1.6;
    r = 1.0;
    color = '#fef08a';
  } else if (/^pathlight$/i.test(t)) {
    ly = 0.72 * height;
    power = 0.85;
    r = 0.55;
    color = '#fef08a';
  }

  // Rotate local offset (rot * 90 deg counter-clockwise in Three.js coordinates, angle -rot * PI/2)
  let rx = lx, rz = lz;
  if (rot === 1) { rx = -lz; rz = lx; }
  else if (rot === 2) { rx = -lx; rz = -lz; }
  else if (rot === 3) { rx = lz; rz = -lx; }

  const cx = (f.x + f.w / 2) * C + clDx;
  const cz = (f.y + f.h / 2) * C + clDz;

  return {
    x: cx + rx,
    y: bY + ly,
    z: cz + rz,
    power,
    geo,
    r,
    len,
    rot,
    color
  };
};

function buildFurnitureLamps(ctx) {
  const { items, hangs, furnLamps, C, env } = ctx;
  const seenPos = new Set();
  const allLevels = (HP.state && HP.state.levels && HP.state.levels.length) ? HP.state.levels : [HP.cur()];
  const envCache = new Map();
  const getLvlInfo = (it) => {
    const lIdx = it._levelIdx !== undefined ? it._levelIdx : ((HP.state && HP.state.level) || 0);
    const lObj = allLevels[lIdx] || HP.cur() || null;
    if (!envCache.has(lIdx)) envCache.set(lIdx, lObj ? geomEnv(lObj) : env);
    const lEnv = envCache.get(lIdx);
    const lWalls = (lObj && lObj.walls) || {};
    const getRoom = (wx, wz) => (lEnv && lEnv.rAt ? lEnv.rAt(Math.floor(wx / C), Math.floor(wz / C)) : -1);
    return { lIdx, lWalls, lEnv, getRoom };
  };

  for (const it of items) {
    if (!/lamp|torch|candle|lantern|light|sconce/i.test(it.type) || /fireplace/i.test(it.type)) continue;
    const { lIdx, lWalls, lEnv, getRoom } = getLvlInfo(it);
    const posKey = lIdx + ':' + it.type + '@' + it.x + ',' + it.y;
    if (seenPos.has(posKey)) continue;
    seenPos.add(posKey);
    const def = HP.itemDef ? HP.itemDef(it.type) : {};
    const f = HP.footprint ? HP.footprint(it) : { x: it.x, y: it.y, w: it.w || def.w || 1, h: it.h || def.h || 1 };
    const lt = HP.getLampLightTransform(it, def, f, C, lWalls, lEnv);
    furnLamps.push({
      id: it.id,
      it,
      x: lt.x,
      z: lt.z,
      y: lt.y,
      power: lt.power,
      room: getRoom(lt.x, lt.z),
      on: it.on !== false
    });
  }
  for (const it of items) {
    if (/^greenhouse/i.test(it.type)) {
      const { getRoom } = getLvlInfo(it);
      const f = HP.footprint(it), h = itemH3D(HP.itemDef(it.type), it);
      const bY = it._baseY !== undefined ? it._baseY : 0;
      const lx = (f.x + f.w / 2) * C, lz = (f.y + f.h / 2) * C;
      furnLamps.push({ id: it.id, it, x: lx, z: lz, y: bY + Math.round(h * 0.56), power: 1.3, room: getRoom(lx, lz), on: it.on !== false });
    }
  }
  for (const it of items) {
    if (/^treehouse/i.test(it.type)) {
      const { getRoom } = getLvlInfo(it);
      const f = HP.footprint(it), rot = it.rot || 0;
      const bY = it._baseY !== undefined ? it._baseY : 0;
      const W = f.w * C, D = f.h * C;
      const tcx = (f.x + f.w / 2) * C, tcz = (f.y + f.h / 2) * C;
      let lx = -0.15 * W, lz = -0.15 * D;
      if (rot === 1) { const rx = -lz; lz = lx; lx = rx; }
      else if (rot === 2) { lx = -lx; lz = -lz; }
      else if (rot === 3) { const rx = lz; lz = -lx; lx = rx; }
      const wx = tcx + lx, wz = tcz + lz;
      furnLamps.push({ id: it.id, it, x: wx, z: wz, y: bY + 98, power: 1.2, room: getRoom(wx, wz), on: it.on !== false });
    }
  }
  for (const it of hangs) {
    if (!/sconce/i.test(it.type)) continue;
    const { lIdx, lWalls, lEnv, getRoom } = getLvlInfo(it);
    const posKey = lIdx + ':' + it.type + '@' + it.x + ',' + it.y;
    if (seenPos.has(posKey)) continue;
    seenPos.add(posKey);
    const def = HP.itemDef ? HP.itemDef(it.type) : {};
    const f = HP.footprint ? HP.footprint(it) : { x: it.x, y: it.y, w: it.w || def.w || 1, h: it.h || def.h || 1 };
    const lt = HP.getLampLightTransform(it, def, f, C, lWalls, lEnv);
    furnLamps.push({
      id: it.id,
      it,
      x: lt.x,
      z: lt.z,
      y: lt.y,
      power: lt.power,
      room: getRoom(lt.x, lt.z),
      on: it.on !== false
    });
  }
}

function buildGarageDoorModel(it, d, f, c, C, lvl, env, targetGroup, garageDoors) {
  const doorGroup = new THREE.Group();
  const bw = it.w || d.w || 3;
  const W = bw * C, D = (it.h || d.h || 1) * C;
  const ph = 14;
  const panels = [];
  const dCol = c || '#f8fafc';
  const panelMat = HP.graphics3d ? HP.graphics3d.material('ceramic', dCol) : new THREE.MeshLambertMaterial({ color: new THREE.Color(dCol) });
  const winMat = HP.graphics3d ? HP.graphics3d.material('glass', '#bfe3ea') : new THREE.MeshLambertMaterial({ color: 0x9fd4e8, transparent: true, opacity: 0.6 });
  const metalMat = HP.graphics3d ? HP.graphics3d.material('metal', '#334155') : new THREE.MeshLambertMaterial({ color: 0x334155 });
  const darkMat = HP.graphics3d ? HP.graphics3d.material('dark', '#181b20') : new THREE.MeshLambertMaterial({ color: 0x181b20 });
  const wallHeaderMat = HP.graphics3d ? HP.graphics3d.material('ceramic', '#e9e2d2') : new THREE.MeshLambertMaterial({ color: 0xe9e2d2 });

  let tcx = (f.x + f.w / 2) * C, tcz = (f.y + f.h / 2) * C;
  const rot = (it.rot || 0) % 4;
  const lvlWalls = lvl.walls || {};
  let wallLine = null;
  let wt = 0.44 * C;

  if (rot % 2 === 0) {
    for (const testY of [f.y, f.y + f.h, f.y - 1, f.y + 1]) {
      let count = 0;
      for (let cx = 0; cx < HP.GRID_W; cx++) {
        if (lvlWalls['h,' + cx + ',' + testY]) count++;
      }
      if (count > 0 && (wallLine === null || count > wallLine.count)) {
        wallLine = { d: 'h', line: testY, count };
      }
    }
    if (!wallLine) {
      for (const testY of [f.y, f.y + f.h, f.y + 1]) {
        const cx = Math.floor(tcx / C);
        const ra = env.rAt(cx, testY - 1);
        const rb = env.rAt(cx, testY);
        if (ra !== rb) { wallLine = { d: 'h', line: testY, count: 1 }; break; }
      }
    }
    if (!wallLine) wallLine = { d: 'h', line: f.y, count: 0 };
    const ra = env.rAt(Math.floor(tcx / C), wallLine.line - 1);
    const rb = env.rAt(Math.floor(tcx / C), wallLine.line);
    wt = (ra < 0 || rb < 0) ? 0.44 * C : 0.30 * C;
    if (ra < 0 && rb >= 0) tcz = wallLine.line * C - wt / 2;
    else if (rb < 0 && ra >= 0) tcz = wallLine.line * C + wt / 2;
    else tcz = wallLine.line * C;
  } else {
    for (const testX of [f.x, f.x + f.w, f.x - 1, f.x + 1]) {
      let count = 0;
      for (let cy = 0; cy < HP.GRID_H; cy++) {
        if (lvlWalls['v,' + testX + ',' + cy]) count++;
      }
      if (count > 0 && (wallLine === null || count > wallLine.count)) {
        wallLine = { d: 'v', line: testX, count };
      }
    }
    if (!wallLine) {
      for (const testX of [f.x, f.x + f.w, f.x + 1]) {
        const cy = Math.floor(tcz / C);
        const ra = env.rAt(testX - 1, cy);
        const rb = env.rAt(testX, cy);
        if (ra !== rb) { wallLine = { d: 'v', line: testX, count: 1 }; break; }
      }
    }
    if (!wallLine) wallLine = { d: 'v', line: f.x, count: 0 };
    const ra = env.rAt(wallLine.line - 1, Math.floor(tcz / C));
    const rb = env.rAt(wallLine.line, Math.floor(tcz / C));
    wt = (ra < 0 || rb < 0) ? 0.44 * C : 0.30 * C;
    if (ra < 0 && rb >= 0) tcx = wallLine.line * C - wt / 2;
    else if (rb < 0 && ra >= 0) tcx = wallLine.line * C + wt / 2;
    else tcx = wallLine.line * C;
  }

  const wallThick = Math.max(12.5, wt);

  const headerBox = new THREE.Mesh(new THREE.BoxGeometry(W, 18, wallThick), wallHeaderMat);
  headerBox.position.set(0, 65, 0);
  headerBox.castShadow = headerBox.receiveShadow = true;
  doorGroup.add(headerBox);

  const dripTrim = new THREE.Mesh(new THREE.BoxGeometry(W, 1.8, wallThick + 0.8), metalMat);
  dripTrim.position.set(0, 56.5, 0);
  dripTrim.castShadow = true;
  doorGroup.add(dripTrim);

  const jw = 3.6;
  for (const sx of [-W / 2 + jw / 2, W / 2 - jw / 2]) {
    const jambPost = new THREE.Mesh(new THREE.BoxGeometry(jw, 74, wallThick), wallHeaderMat);
    jambPost.position.set(sx, 37, 0);
    jambPost.castShadow = jambPost.receiveShadow = true;
    doorGroup.add(jambPost);

    const trackChannel = new THREE.Mesh(new THREE.BoxGeometry(2.0, 56, 4.2), metalMat);
    trackChannel.position.set(sx > 0 ? sx - jw / 2 - 1.0 : sx + jw / 2 + 1.0, 28, 0);
    trackChannel.castShadow = true;
    doorGroup.add(trackChannel);
  }

  if (rot % 2 === 0) {
    const leftEdgeWorld = f.x * C;
    const rightEdgeWorld = (f.x + bw) * C;
    let leftWallEnd = null;
    for (const o of (lvl.furniture || [])) {
      if (o === it || !/garagedoor/i.test(o.type)) continue;
      if (((o.rot || 0) % 4) % 2 !== 0) continue;
      if (Math.abs(o.y - f.y) > 1.2) continue;
      const obw = o.w || 3;
      const ox_max = (o.x + obw) * C;
      if (ox_max <= leftEdgeWorld + 0.5) {
        leftWallEnd = Math.max(leftWallEnd !== null ? leftWallEnd : -1e9, ox_max);
      }
    }
    for (let cx = Math.floor(leftEdgeWorld / C); cx >= Math.floor(leftEdgeWorld / C) - 4; cx--) {
      const hasH = lvlWalls['h,' + cx + ',' + wallLine.line];
      const hasV = lvlWalls['v,' + cx + ',' + wallLine.line] || lvlWalls['v,' + cx + ',' + (wallLine.line - 1)];
      if (hasH) {
        leftWallEnd = Math.max(leftWallEnd !== null ? leftWallEnd : -1e9, (cx + 1) * C);
        break;
      } else if (hasV) {
        leftWallEnd = Math.max(leftWallEnd !== null ? leftWallEnd : -1e9, cx * C);
        break;
      }
    }
    if (leftWallEnd !== null && leftWallEnd < leftEdgeWorld) {
      const gapLeft = leftEdgeWorld - leftWallEnd;
      if (gapLeft > 0.5 && gapLeft <= 3.5 * C) {
        const bridgeMesh = new THREE.Mesh(new THREE.BoxGeometry(gapLeft, 74, wallThick), wallHeaderMat);
        const localX = (rot === 2) ? (W / 2 + gapLeft / 2) : (-W / 2 - gapLeft / 2);
        bridgeMesh.position.set(localX, 37, 0);
        bridgeMesh.castShadow = bridgeMesh.receiveShadow = true;
        doorGroup.add(bridgeMesh);
      }
    }
    let rightWallStart = null;
    for (const o of (lvl.furniture || [])) {
      if (o === it || !/garagedoor/i.test(o.type)) continue;
      if (((o.rot || 0) % 4) % 2 !== 0) continue;
      if (Math.abs(o.y - f.y) > 1.2) continue;
      const ox_min = o.x * C;
      if (ox_min >= rightEdgeWorld - 0.5) {
        rightWallStart = Math.min(rightWallStart !== null ? rightWallStart : 1e9, ox_min);
      }
    }
    for (let cx = Math.floor(rightEdgeWorld / C); cx <= Math.floor(rightEdgeWorld / C) + 4; cx++) {
      if (lvlWalls['h,' + cx + ',' + wallLine.line] || lvlWalls['v,' + cx + ',' + wallLine.line] || lvlWalls['v,' + cx + ',' + (wallLine.line - 1)]) {
        rightWallStart = Math.min(rightWallStart !== null ? rightWallStart : 1e9, cx * C);
        break;
      }
    }
    if (rightWallStart !== null && rightWallStart > rightEdgeWorld) {
      const gapRight = rightWallStart - rightEdgeWorld;
      if (gapRight > 0.5 && gapRight <= 3.5 * C) {
        const bridgeMesh = new THREE.Mesh(new THREE.BoxGeometry(gapRight, 74, wallThick), wallHeaderMat);
        const localX = (rot === 2) ? (-W / 2 - gapRight / 2) : (W / 2 + gapRight / 2);
        bridgeMesh.position.set(localX, 37, 0);
        bridgeMesh.castShadow = bridgeMesh.receiveShadow = true;
        doorGroup.add(bridgeMesh);
      }
    }
  } else {
    const leftEdgeWorld = f.y * C;
    const rightEdgeWorld = (f.y + bw) * C;
    let leftWallEnd = null;
    for (const o of (lvl.furniture || [])) {
      if (o === it || !/garagedoor/i.test(o.type)) continue;
      if (((o.rot || 0) % 4) % 2 === 0) continue;
      if (Math.abs(o.x - f.x) > 1.2) continue;
      const obw = o.w || 3;
      const oy_max = (o.y + obw) * C;
      if (oy_max <= leftEdgeWorld + 0.5) {
        leftWallEnd = Math.max(leftWallEnd !== null ? leftWallEnd : -1e9, oy_max);
      }
    }
    for (let cy = Math.floor(leftEdgeWorld / C); cy >= Math.floor(leftEdgeWorld / C) - 4; cy--) {
      const hasV = lvlWalls['v,' + wallLine.line + ',' + cy];
      const hasH = lvlWalls['h,' + wallLine.line + ',' + cy] || lvlWalls['h,' + (wallLine.line - 1) + ',' + cy];
      if (hasV) {
        leftWallEnd = Math.max(leftWallEnd !== null ? leftWallEnd : -1e9, (cy + 1) * C);
        break;
      } else if (hasH) {
        leftWallEnd = Math.max(leftWallEnd !== null ? leftWallEnd : -1e9, cy * C);
        break;
      }
    }
    if (leftWallEnd !== null && leftWallEnd < leftEdgeWorld) {
      const gapLeft = leftEdgeWorld - leftWallEnd;
      if (gapLeft > 0.5 && gapLeft <= 3.5 * C) {
        const bridgeMesh = new THREE.Mesh(new THREE.BoxGeometry(gapLeft, 74, wallThick), wallHeaderMat);
        const localX = (rot === 3) ? (W / 2 + gapLeft / 2) : (-W / 2 - gapLeft / 2);
        bridgeMesh.position.set(localX, 37, 0);
        bridgeMesh.castShadow = bridgeMesh.receiveShadow = true;
        doorGroup.add(bridgeMesh);
      }
    }
    let rightWallStart = null;
    for (const o of (lvl.furniture || [])) {
      if (o === it || !/garagedoor/i.test(o.type)) continue;
      if (((o.rot || 0) % 4) % 2 === 0) continue;
      if (Math.abs(o.x - f.x) > 1.2) continue;
      const oy_min = o.y * C;
      if (oy_min >= rightEdgeWorld - 0.5) {
        rightWallStart = Math.min(rightWallStart !== null ? rightWallStart : 1e9, oy_min);
      }
    }
    for (let cy = Math.floor(rightEdgeWorld / C); cy <= Math.floor(rightEdgeWorld / C) + 4; cy++) {
      if (lvlWalls['v,' + wallLine.line + ',' + cy] || lvlWalls['h,' + wallLine.line + ',' + cy] || lvlWalls['h,' + (wallLine.line - 1) + ',' + cy]) {
        rightWallStart = Math.min(rightWallStart !== null ? rightWallStart : 1e9, cy * C);
        break;
      }
    }
    if (rightWallStart !== null && rightWallStart > rightEdgeWorld) {
      const gapRight = rightWallStart - rightEdgeWorld;
      if (gapRight > 0.5 && gapRight <= 3.5 * C) {
        const bridgeMesh = new THREE.Mesh(new THREE.BoxGeometry(gapRight, 74, wallThick), wallHeaderMat);
        const localX = (rot === 3) ? (-W / 2 - gapRight / 2) : (W / 2 + gapRight / 2);
        bridgeMesh.position.set(localX, 37, 0);
        bridgeMesh.castShadow = bridgeMesh.receiveShadow = true;
        doorGroup.add(bridgeMesh);
      }
    }
  }

  for (const sx of [-W / 2 + jw + 1.0, W / 2 - jw - 1.0]) {
    const ceilTrack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 48), metalMat);
    ceilTrack.position.set(sx, 61, -24);
    ceilTrack.castShadow = true;
    doorGroup.add(ceilTrack);

    const hanger = new THREE.Mesh(new THREE.BoxGeometry(1.2, 13, 1.2), metalMat);
    hanger.position.set(sx, 67.5, -42);
    doorGroup.add(hanger);
  }
  const torsionShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, W - 8, 8), metalMat);
  torsionShaft.rotation.z = Math.PI / 2;
  torsionShaft.position.set(0, 58, 1.2);
  doorGroup.add(torsionShaft);

  const trolleyRail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 46), metalMat);
  trolleyRail.position.set(0, 61, -23);
  doorGroup.add(trolleyRail);
  const motorUnit = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 14), darkMat);
  motorUnit.position.set(0, 61, -40);
  motorUnit.castShadow = true;
  doorGroup.add(motorUnit);

  const pw = W - jw * 2 + 1.6;
  for (let pi = 0; pi < 4; pi++) {
    const pGroup = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(pw, ph - 0.02, 2.6), panelMat);
    slab.castShadow = slab.receiveShadow = true;
    pGroup.add(slab);

    // Subtle exterior panel seam beading (avoids see-through horizontal gaps when closed)
    const seamLine = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.35, 0.25), metalMat);
    seamLine.position.set(0, -ph / 2 + 0.18, 1.32);
    pGroup.add(seamLine);

    for (const sx of [-pw / 2 + 0.6, pw / 2 - 0.6]) {
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.6, 8), metalMat);
      roller.rotation.z = Math.PI / 2;
      roller.position.x = sx;
      pGroup.add(roller);
    }

    if (pi === 3) {
      const numWindows = W >= 120 ? 8 : 4;
      const stampW = (pw - (numWindows + 1) * 3) / numWindows;
      for (let wi = 0; wi < numWindows; wi++) {
        const wx = -pw / 2 + 3 + stampW / 2 + wi * (stampW + 3);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(stampW + 0.8, 7.2, 2.72), darkMat);
        frame.position.set(wx, 0, 0);
        const win = new THREE.Mesh(new THREE.BoxGeometry(stampW - 0.4, 6.2, 2.86), winMat);
        win.position.set(wx, 0, 0);
        pGroup.add(frame, win);
      }
    }

    if (pi === 0) {
      const seal = new THREE.Mesh(new THREE.BoxGeometry(pw, 2.0, 3.2), darkMat);
      seal.position.set(0, -ph / 2 + 1.0, 0);
      pGroup.add(seal);

      const handle = new THREE.Mesh(new THREE.BoxGeometry(14, 2.5, 3.8), metalMat);
      handle.position.set(0, -ph / 4, 1.2);
      pGroup.add(handle);
    }

    doorGroup.add(pGroup);
    panels.push({ group: pGroup, y0: (pi + 0.5) * ph, idx: pi });
  }

  function updatePanels(open) {
    const travel = 54;
    for (let pi = 0; pi < 4; pi++) {
      const p = panels[pi];
      const s = p.y0 + open * travel;
      let y, z, rx;
      if (s <= 48) {
        y = s; z = 0; rx = 0;
      } else if (s < 60) {
        const u = (s - 48) / 12;
        const ang = u * (Math.PI / 2);
        y = 48 + 12 * Math.sin(ang);
        z = -12 * (1 - Math.cos(ang));
        rx = -ang;
      } else {
        y = 60;
        z = -12 - (s - 60);
        rx = -Math.PI / 2;
      }
      p.group.position.set(0, y, z);
      p.group.rotation.x = rx;
    }
  }

  updatePanels(0);

  doorGroup.position.set(tcx, 0, tcz);
  doorGroup.rotation.y = -rot * Math.PI / 2;
  targetGroup.add(doorGroup);
  HP.cull3d.add(doorGroup, f.x * C - C, f.y * C - C, (f.x + f.w) * C + C, (f.y + f.h) * C + C);

  let box;
  if (rot % 2 === 0) {
    box = { x0: tcx - pw / 2, x1: tcx + pw / 2, z0: tcz - 5, z1: tcz + 5, y0: 0, y1: 58 };
  } else {
    box = { x0: tcx - 5, x1: tcx + 5, z0: tcz - pw / 2, z1: tcz + pw / 2, y0: 0, y1: 58 };
  }

  garageDoors.push({
    it, def: d, group: doorGroup, panels,
    open: 0, target: 0, vel: 0,
    cx: tcx, cz: tcz, w: W, d: D, rot,
    box,
    updatePanels
  });
}

function buildTreehouseClimbModel(it, f, C, elevatedDecks, climbs) {
  const bw = (it.rot % 2 === 0) ? (it.w || f.w) : (it.h || f.h);
  const bh = (it.rot % 2 === 0) ? (it.h || f.h) : (it.w || f.w);
  const L = HP.treehouseLayout ? HP.treehouseLayout(bw, bh) : {
    deckY: 54.0, lx0: 0.24 * f.w * C, lx1: 0.44 * f.w * C, lz0: 0.45 * f.h * C, lz1: 0.72 * f.h * C,
    stairCx: 0.34 * f.w * C, W: f.w * C, D: f.h * C
  };
  elevatedDecks.push({
    x0: f.x * C, x1: (f.x + f.w) * C,
    z0: f.y * C, z1: (f.y + f.h) * C,
    deckY: L.deckY
  });
  const rot = it.rot || 0;
  const tcx = (f.x + f.w / 2) * C, tcz = (f.y + f.h / 2) * C;
  const topLipZ = L.D * 0.5 - 10;
  const corners = [
    { x: L.lx0 - 1.5, z: topLipZ }, { x: L.lx1 + 1.5, z: topLipZ },
    { x: L.lx1 + 1.5, z: L.lz1 + 3 }, { x: L.lx0 - 1.5, z: L.lz1 + 3 }
  ];
  const rotateSpot = pt => {
    let rx = pt.x, rz = pt.z;
    if (rot === 1) { rx = -pt.z; rz = pt.x; }
    else if (rot === 2) { rx = -pt.x; rz = -pt.z; }
    else if (rot === 3) { rx = pt.z; rz = -pt.x; }
    return { x: tcx + rx, z: tcz + rz };
  };
  const rotCorners = corners.map(rotateSpot);
  const minX = Math.min(...rotCorners.map(p => p.x));
  const maxX = Math.max(...rotCorners.map(p => p.x));
  const minZ = Math.min(...rotCorners.map(p => p.z));
  const maxZ = Math.max(...rotCorners.map(p => p.z));

  const deckPt = { x: L.stairCx, z: 0.36 * L.D };
  const gndPt  = { x: L.stairCx, z: L.lz1 + 5 };
  const deckSpot = rotateSpot(deckPt);
  const groundSpot = rotateSpot(gndPt);
  const treadSpan = Math.max(14, (L.lz1 - (L.D * 0.5 - 2)) / 0.82);

  let ax = 'z', dir = -1, from = maxZ - 3, run = treadSpan;
  if (rot === 1) { ax = 'x'; dir = 1; from = minX + 3; run = treadSpan; }
  else if (rot === 2) { ax = 'z'; dir = 1; from = minZ + 3; run = treadSpan; }
  else if (rot === 3) { ax = 'x'; dir = -1; from = maxX - 3; run = treadSpan; }

  climbs.push({
    x0: minX, x1: maxX,
    z0: minZ, z1: maxZ,
    y0: 0, y1: L.deckY,
    ax, dir, from, run,
    deckSpot, groundSpot
  });
}

W3._buildFurnitureSync = function (targetGroup) {
  const ctx = initFurnitureContext(targetGroup);
  for (let i = 0; i < ctx.items.length; i++) {
    buildSingleFurnitureItem(ctx.items[i], i, ctx);
  }
  for (let i2 = 0; i2 < ctx.hangs.length; i2++) {
    buildSingleHangItem(ctx.hangs[i2], i2, ctx);
  }
  buildFurnitureLamps(ctx);
  W3.lamps = (W3.staticLamps || []).concat(ctx.furnLamps);
  W3.colliders = (W3.staticColliders || []).concat(ctx.furnColliders);
  if (HP.life3d) HP.life3d.build(targetGroup, ctx.lifeItems);
  ctx.fit2.instanceMatrix.needsUpdate = true;
  if (ctx.fit2.instanceColor) ctx.fit2.instanceColor.needsUpdate = true;
  let visuals = null;
  if (ctx.models) {
    ctx.fit2.dispose(); ctx.fit2.material.dispose(); W3.fitMesh = null;
    visuals = ctx.models.finish();
  } else {
    targetGroup.add(ctx.fit2);
  }
  return {
    visuals,
    furnColliders: ctx.furnColliders,
    furnLamps: ctx.furnLamps,
    movers: ctx.movers,
    garageDoors: ctx.garageDoors,
    elevatedDecks: ctx.elevatedDecks,
    climbs: ctx.climbs,
    furnMetaById: ctx.furnMetaById
  };
};

W3._furnUpdateSeq = 0;
W3._buildFurnitureAsync = async function (targetGroup, seq) {
  const ctx = initFurnitureContext(targetGroup);
  let lastYield = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  for (let i = 0; i < ctx.items.length; i++) {
    buildSingleFurnitureItem(ctx.items[i], i, ctx);
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (now - lastYield > 6 && typeof requestAnimationFrame !== 'undefined') {
      await new Promise(r => requestAnimationFrame(r));
      lastYield = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (seq !== W3._furnUpdateSeq) {
        ctx.fit2.dispose(); ctx.fit2.material.dispose();
        return null;
      }
    }
  }
  for (let i2 = 0; i2 < ctx.hangs.length; i2++) {
    buildSingleHangItem(ctx.hangs[i2], i2, ctx);
  }
  buildFurnitureLamps(ctx);
  W3.lamps = (W3.staticLamps || []).concat(ctx.furnLamps);
  W3.colliders = (W3.staticColliders || []).concat(ctx.furnColliders);
  if (HP.life3d) HP.life3d.build(targetGroup, ctx.lifeItems);
  ctx.fit2.instanceMatrix.needsUpdate = true;
  if (ctx.fit2.instanceColor) ctx.fit2.instanceColor.needsUpdate = true;
  let visuals = null;
  if (ctx.models) {
    ctx.fit2.dispose(); ctx.fit2.material.dispose(); W3.fitMesh = null;
    visuals = ctx.models.finishAsync ? await ctx.models.finishAsync() : ctx.models.finish();
  } else {
    targetGroup.add(ctx.fit2);
  }
  if (seq !== W3._furnUpdateSeq) return null;
  return {
    visuals,
    furnColliders: ctx.furnColliders,
    furnLamps: ctx.furnLamps,
    movers: ctx.movers,
    garageDoors: ctx.garageDoors,
    elevatedDecks: ctx.elevatedDecks,
    climbs: ctx.climbs,
    furnMetaById: ctx.furnMetaById
  };
};

W3.updateFurniture = function () {
  if (!W3.staticGroup || !W3.levelGroup) {
    W3.buildLevel();
    return;
  }
  const nextFG = new THREE.Group();
  const res = W3._buildFurnitureSync(nextFG);
  if (!res) return;
  if (W3.furnitureGroup) {
    HP.cull3d.removeGroup(W3.furnitureGroup);
    W3.levelGroup.remove(W3.furnitureGroup);
    disposeGroup(W3.furnitureGroup);
  }
  W3.furnitureGroup = nextFG;
  W3.levelGroup.add(nextFG);
  W3.colliders = (W3.staticColliders || []).concat(res.furnColliders);
  W3.lamps = (W3.staticLamps || []).concat(res.furnLamps);
  W3.movers = res.movers;
  W3.garageDoors = res.garageDoors;
  W3.elevatedDecks = (W3.elevatedDecks || []).filter(d => d.deckY >= 74).concat(res.elevatedDecks || []);
  W3.climbs = (res.climbs || []).concat(W3.stairClimbs || []);
  W3.furnitureVisuals = res.visuals;
  W3._furnMetaById = res.furnMetaById;
  if (res.visuals) res.visuals.move(W3.movers);
  if (HP.graphics3d) HP.graphics3d.applyMaterials(nextFG);
  if (HP.cull3d && HP.cull3d.invalidate) HP.cull3d.invalidate(); else if (HP.cull3d) HP.cull3d.dirty = true;
};

W3.updateFurnitureAsync = async function () {
  if (!W3.staticGroup || !W3.levelGroup) {
    W3.buildLevel();
    return;
  }
  const seq = ++W3._furnUpdateSeq;
  const nextFG = new THREE.Group();
  const res = await W3._buildFurnitureAsync(nextFG, seq);
  if (!res || seq !== W3._furnUpdateSeq) {
    disposeGroup(nextFG);
    return;
  }
  if (W3.furnitureGroup) {
    HP.cull3d.removeGroup(W3.furnitureGroup);
    W3.levelGroup.remove(W3.furnitureGroup);
    disposeGroup(W3.furnitureGroup);
  }
  W3.furnitureGroup = nextFG;
  W3.levelGroup.add(nextFG);
  W3.colliders = (W3.staticColliders || []).concat(res.furnColliders);
  W3.lamps = (W3.staticLamps || []).concat(res.furnLamps);
  W3.movers = res.movers;
  W3.garageDoors = res.garageDoors;
  W3.elevatedDecks = (W3.elevatedDecks || []).filter(d => d.deckY >= 74).concat(res.elevatedDecks || []);
  W3.climbs = (res.climbs || []).concat(W3.stairClimbs || []);
  W3.furnitureVisuals = res.visuals;
  W3._furnMetaById = res.furnMetaById;
  if (res.visuals) res.visuals.move(W3.movers);
  if (HP.graphics3d) HP.graphics3d.applyMaterials(nextFG);
  if (HP.cull3d && HP.cull3d.invalidate) HP.cull3d.invalidate(); else if (HP.cull3d) HP.cull3d.dirty = true;
};

W3.onRemoteDrag = function (items) {
  if (!items || !items.length || !W3.furnitureVisuals) return;
  const C = HP.CELL;
  const visuals = W3.furnitureVisuals;
  for (const it of items) {
    const meta = W3._furnMetaById && W3._furnMetaById.get(it.id);
    if (!meta) continue;
    const g2 = (visuals.detached && visuals.detached.get(meta.inst)) ||
               (visuals.detach && visuals.detach(meta.inst));
    if (g2) {
      const dx = (it.x - meta.origX) * C;
      const dz = (it.y - meta.origY) * C;
      g2.position.set(dx, 0, dz);
    }
  }
  if (HP.cull3d && HP.cull3d.invalidate) HP.cull3d.invalidate();
};

W3.updateApertures = function () {
  if (!W3.levelGroup) return;
  const allLevels = (HP.state && HP.state.levels && HP.state.levels.length) ? HP.state.levels : [HP.cur()];
  const WALL_H = (HP.geom3d && HP.geom3d.WALL_H) || 74;
  const envCache = new Map();
  const getLvlEnv = (idx, lObj) => {
    if (!envCache.has(idx)) envCache.set(idx, geomEnv(lObj));
    return envCache.get(idx);
  };

  // 1. Update doors
  for (const dp of (W3.doorPivots || [])) {
    if (!dp.a || dp.gate || dp.window) continue;
    const lIdx = dp.lvlIdx !== undefined ? dp.lvlIdx : Math.max(0, Math.round((dp.ly0 || 0) / WALL_H));
    const lvl = allLevels[lIdx] || HP.cur();
    if (!lvl || !lvl.walls) continue;
    const w = lvl.walls[dp.a.k];
    if (!w) continue;
    const env = getLvlEnv(lIdx, lvl);
    const seg = HP.parseWallKey(dp.a.k);
    const minusRoom = dp.a.d === 'h' ? env.rAt(seg.x, seg.y - 1) : env.rAt(seg.x - 1, seg.y);
    const plusRoom = env.rAt(seg.x, seg.y);
    const minusIsInside = minusRoom >= 0 && (plusRoom < 0 || env.rsz(minusRoom) < env.rsz(plusRoom));
    const insideFlip = minusIsInside ? 1 : -1;
    const outsideFlip = minusIsInside ? -1 : 1;
    let targetFlip = dp.a.flip;
    if (w.swing === 'out') targetFlip = outsideFlip;
    else if (w.swing === 'in') targetFlip = insideFlip;

    const curDoorStyle = (dp.a && dp.a.forcedStyle) || w.doorStyle || 'panel';
    const styleChanged = dp.doorStyle !== curDoorStyle;
    const flipChanged = targetFlip !== undefined && (targetFlip !== dp.flip || w.swing !== dp.a.swing);

    if (styleChanged || flipChanged) {
      dp.a.swing = w.swing;
      dp.a.flip = targetFlip;
      dp.a.baseY = lIdx * WALL_H;
      dp.a.lvl = lvl;
      dp.flip = targetFlip;
      const s0 = dp.s0 !== undefined ? dp.s0 : (dp.a.d === 'h' ? dp.a.x0 : dp.a.z0);
      const s1 = dp.s1 !== undefined ? dp.s1 : (dp.a.d === 'h' ? dp.a.x1 : dp.a.z1);
      const span = s1 - s0;
      const leaves = dp.a.dbl ? 2 : 1;
      populateDoorLeaf(dp, dp.a, leaves, dp.li, span, s0, s1, dp.post0, dp.post1, W3._leafMat, W3._knobMat, W3._knobGeo);
      if (dp.frameMesh) {
        if (dp.frameMesh.parent) dp.frameMesh.parent.remove(dp.frameMesh);
        dp.frameMesh = null;
      }
      if (dp.li === 0 && dp.pivot && dp.pivot.parent) {
        dp.frameMesh = buildDoorFrame(dp.a, s0, s1, dp.pivot.parent);
      }
      if (dp.trackMesh) {
        if (dp.trackMesh.parent) dp.trackMesh.parent.remove(dp.trackMesh);
        dp.trackMesh = null;
      }
      if (dp.doorStyle === 'slide' && dp.li === 0 && dp.pivot && dp.pivot.parent) {
        dp.trackMesh = buildOverheadTrack(dp.a, span, leaves, s0, s1, targetFlip !== undefined ? targetFlip : 1, dp.pivot.parent);
      }
      dp.open = 0;
      dp.target = 0;
      dp.pivot.rotation.y = 0;
      dp.vel = 0;
      dp.maxAng = undefined;
    }
  }

  // 2. Update windows
  const sashMat = W3._sashMat || (HP.graphics3d ? HP.graphics3d.material('metal', '#eae4d6') : new THREE.MeshLambertMaterial({ color: 0xeae4d6 }));
  const paneMat = W3._paneMat || (HP.graphics3d ? HP.graphics3d.material('glass', '#bfe3ea') : new THREE.MeshLambertMaterial({ color: 0x9fd4e8, transparent: true, opacity: 0.45 }));

  for (const assembly of (W3.windows || [])) {
    if (!assembly || !assembly.a) continue;
    const lIdx = assembly.lvlIdx !== undefined ? assembly.lvlIdx : Math.max(0, Math.floor(((assembly.w && assembly.w.y0) || 0) / WALL_H));
    const lvl = allLevels[lIdx] || HP.cur();
    if (!lvl || !lvl.walls) continue;
    const wRec = lvl.walls[assembly.a.k];
    if (!wRec) continue;
    const env = getLvlEnv(lIdx, lvl);
    const seg = HP.parseWallKey(assembly.a.k);
    const minusRoom = assembly.isH ? env.rAt(seg.x, seg.y - 1) : env.rAt(seg.x - 1, seg.y);
    const plusRoom = env.rAt(seg.x, seg.y);
    let targetInward = minusRoom >= 0 && (plusRoom < 0 || env.rsz(minusRoom) < env.rsz(plusRoom)) ? -1 : 1;
    if (wRec.swing === 'out') targetInward = -targetInward;
    const targetWinStyle = wRec.winStyle || (wRec.style === 'awning' || wRec.style === 'hopper' || wRec.style === 'slider' || wRec.style === 'single_hung' ? wRec.style : null);

    if (targetInward !== assembly.inward || (wRec.swing && wRec.swing !== assembly.a.swing) || (targetWinStyle && targetWinStyle !== assembly.winStyle)) {
      assembly.inward = targetInward;
      assembly.a.swing = wRec.swing;
      if (targetWinStyle) {
        assembly.winStyle = targetWinStyle;
        assembly.style = targetWinStyle === 'single_hung' ? 'single-hung' : targetWinStyle;
      }
      while (assembly.root.children.length) {
        const c = assembly.root.children[0];
        assembly.root.remove(c);
        if (c.geometry && !c.geometry.userData?.shared3d) c.geometry.dispose();
      }
      const deadPanels = new Set(assembly.panels);
      assembly.panels = [];
      W3.doorPivots = W3.doorPivots.filter(p => !deadPanels.has(p));
      doorPivots = W3.doorPivots;
      W3.windowPanels = (W3.windowPanels || []).filter(p => !deadPanels.has(p));
      populateWindowAssembly(assembly, sashMat, paneMat, W3.doorPivots);
    }
  }

  if (HP.cull3d) {
    HP.cull3d.setWalls(allLevels, W3.doorPivots);
  }
};

function boxPart(b, c) {
  const m = new THREE.Matrix4().makeScale(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0);
  m.setPosition((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
  return { m, c, x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1, y0: b.y0, y1: b.y1 };
}

function cellPart(c, y) {
  const C = HP.CELL;
  const m = new THREE.Matrix4().makeScale(C, 1, C);
  m.setPosition(c.x * C + C / 2, y, c.y * C + C / 2);
  return { m, x0: c.x * C, z0: c.y * C, x1: (c.x + 1) * C, z1: (c.y + 1) * C };
}

W3._buildFloorMeshes = function (targetGroup, lvl, baseY = 0, stairHoles = new Set(), stairMeta = null, outColliders = null, prevLvl = null) {
  const C = HP.CELL, V = HP.cull3d;
  let pools = W3.pools;
  if (!pools && baseY === 0) {
    pools = W3.pools = [];
    for (const it of (lvl && lvl.furniture) || []) {
      if (!HP.itemDef(it.type) || !/pool$|pond/i.test(it.type)) continue;
      const f = HP.footprint(it);
      pools.push({
        x0: f.x * C, z0: f.y * C, x1: (f.x + f.w) * C, z1: (f.y + f.h) * C,
        round: /round|circle|ellipse|oval/i.test(it.type),
      });
    }
  }
  const inPool = (x0, z0, x1, z1) =>
    baseY === 0 && pools && pools.some(p => x1 > p.x0 && x0 < p.x1 && z1 > p.z0 && z0 < p.z1);
  const { regionOf } = HP.computeRegions(lvl);
  const cells = [];
  for (let y = 0; y < HP.GRID_H; y++) for (let x = 0; x < HP.GRID_W; x++) {
    if ((x * C < 0)) continue;
    if (stairHoles && stairHoles.has(x + ',' + y)) continue;
    const id = regionFloorId(x, y, lvl, regionOf);
    if (id && !inPool(x * C, y * C, x * C + C, y * C + C))
      cells.push({ x, y, id, in: regionOf[y * HP.GRID_W + x] >= 0 });
  }
  const floorGroups = new Map();
  for (const cell of cells) {
    if (!floorGroups.has(cell.id)) floorGroups.set(cell.id, []);
    floorGroups.get(cell.id).push(cell);
  }
  const floorH = baseY + (baseY === 0 ? 0.02 : 0.05);
  const curLvlIdx = Math.max(0, Math.round(baseY / 74));
  const activeLvlIdx = (HP.state && HP.state.level !== undefined) ? HP.state.level : 0;
  const isCurActive = curLvlIdx === activeLvlIdx;
  for (const [id, list] of floorGroups) {
    const material = HP.graphics3d ? HP.graphics3d.floorMaterial(id, { activeLevel: isCurActive }) :
      new THREE.MeshLambertMaterial({ color: floorColor(id) });
    V.instanced(targetGroup, floorQuad(), material, list.map(c => cellPart(c, floorH)), { receive: true, lvlIdx: curLvlIdx, isFloor: true });
  }
  W3.floorGrids = W3.floorGrids || [];
  const gw = HP.GRID_W, gh = HP.GRID_H;
  const grid = new Uint8Array(gw * gh);
  for (const c of cells) {
    if (c.in || c.id) grid[c.y * gw + c.x] = 1;
  }
  W3.floorGrids[curLvlIdx] = grid;

  // Custom structure interior floors (greenhouse brick/flagstone, cabin wood floor)
  const interiorFloorGroups = new Map();
  for (const it of (lvl && lvl.furniture) || []) {
    if (it.interior && it.interior.customized) {
      const inLvl = it.interior;
      const isTH = it.type === 'treehouse';
      const interiorFloorH = baseY + (isTH ? 54.1 : 0.05);
      const ox = inLvl.ox !== undefined ? inLvl.ox : 2;
      const oy = inLvl.oy !== undefined ? inLvl.oy : 2;
      const rw = inLvl.rw || (inLvl.w - ox * 2);
      const rh = inLvl.rh || (inLvl.h - oy * 2);
      for (let iy = oy; iy < oy + rh; iy++) {
        for (let ix = ox; ix < ox + rw; ix++) {
          const k = ix + ',' + iy;
          let matId = (inLvl.floors && inLvl.floors[k]) || null;
          if (!matId) {
            if (it.type === 'greenhouse') {
              matId = (ix === 4 || ix === 5) ? 'flagstone' : 'brick';
            } else if (it.type === 'treehouse') {
              matId = 'wood';
            }
          }
          if (!matId) continue;
          const wCoord = HP.interiorCellToWorld ? HP.interiorCellToWorld(it, ix, iy) : null;
          if (!wCoord) continue;
          const groupKey = matId + '@' + interiorFloorH;
          if (!interiorFloorGroups.has(groupKey)) interiorFloorGroups.set(groupKey, { matId, floorH: interiorFloorH, cells: [] });
          interiorFloorGroups.get(groupKey).cells.push(wCoord);
        }
      }
    }
  }
  for (const [key, { matId, floorH: iH, cells: iCells }] of interiorFloorGroups) {
    const material = HP.graphics3d ? HP.graphics3d.floorMaterial(matId) :
      new THREE.MeshLambertMaterial({ color: floorColor(matId) });
    V.instanced(targetGroup, floorQuad(), material, iCells.map(c => cellPart(c, iH)), { receive: true, lvlIdx: curLvlIdx, isFloor: true });
  }
  if (baseY > 0 && stairHoles && stairHoles.size > 0) {
    const holeSet = stairHoles;
    const landings = (stairMeta && stairMeta.landings) || new Set();
    const axisOf = (stairMeta && stairMeta.axisOf) || {};
    const lvlWalls = (lvl && lvl.walls) || {};
    const prevWalls = (prevLvl && prevLvl.walls) || {};
    const hasFloorAt = (cx, cy) => {
      if (cx < 0 || cy < 0 || cx >= gw || cy >= gh) return false;
      const nk = cx + ',' + cy;
      if (holeSet.has(nk)) return false;
      return grid[cy * gw + cx] === 1 || !!(lvl.floors && lvl.floors[nk]);
    };
    const rimParts = [], railWoodParts = [], railIronParts = [];
    const ry0 = baseY - 0.35, ry1 = baseY + 0.08, rt = 1.0;
    const guardEdges = [
      { dx: 0, dy: -1, wKey: (hx, hy) => 'h,' + hx + ',' + hy, isH: true,  zPos: (hx, hy) => hy * C },
      { dx: 0, dy:  1, wKey: (hx, hy) => 'h,' + hx + ',' + (hy + 1), isH: true,  zPos: (hx, hy) => (hy + 1) * C },
      { dx: -1, dy: 0, wKey: (hx, hy) => 'v,' + hx + ',' + hy, isH: false, xPos: (hx, hy) => hx * C },
      { dx:  1, dy: 0, wKey: (hx, hy) => 'v,' + (hx + 1) + ',' + hy, isH: false, xPos: (hx, hy) => (hx + 1) * C }
    ];
    for (const hk of holeSet) {
      const [hx, hy] = hk.split(',').map(Number);
      const x0 = hx * C, x1 = (hx + 1) * C, z0 = hy * C, z1 = (hy + 1) * C;
      const stAxis = axisOf[hk] || 'z';
      if (hasFloorAt(hx, hy - 1)) rimParts.push(boxPart({ x0, x1, z0, z1: z0 + rt, y0: ry0, y1: ry1 }));
      if (hasFloorAt(hx, hy + 1)) rimParts.push(boxPart({ x0, x1, z0: z1 - rt, z1, y0: ry0, y1: ry1 }));
      if (hasFloorAt(hx - 1, hy)) rimParts.push(boxPart({ x0, x1: x0 + rt, z0, z1, y0: ry0, y1: ry1 }));
      if (hasFloorAt(hx + 1, hy)) rimParts.push(boxPart({ x0: x1 - rt, x1, z0, z1, y0: ry0, y1: ry1 }));

      for (const e of guardEdges) {
        const nx = hx + e.dx, ny = hy + e.dy, nk = nx + ',' + ny;
        if (holeSet.has(nk) || landings.has(nk)) continue;
        const wk = e.wKey(hx, hy);
        const adjFloor = hasFloorAt(nx, ny);
        const hasPrevWall = !!prevWalls[wk];
        if (!adjFloor && !hasPrevWall) continue;
        if (lvlWalls[wk]) continue; // already guarded by an upper-floor wall
        const isParallelWalkEdge = (e.isH && stAxis === 'z') || (!e.isH && stAxis === 'x');
        // Bottom-entry threshold edge stays open high above Floor 1 headroom (y0=baseY-1) so players walk in underneath cleanly;
        // parallel side walls extend below baseY (-18px) so jumping mid-stair never hops over Floor 1's adjacent wall!
        const colY0 = isParallelWalkEdge ? (baseY - 1.5) : (baseY - 18);
        if (outColliders) {
          outColliders.push(e.isH
            ? { x0, x1, z0: e.zPos(hx, hy) - 1.6, z1: e.zPos(hx, hy) + 1.6, y0: colY0, y1: baseY + 46, tag: 'stairguard' }
            : { x0: e.xPos(hx, hy) - 1.6, x1: e.xPos(hx, hy) + 1.6, z0, z1, y0: colY0, y1: baseY + 46, tag: 'stairguard' });
        }
        if (adjFloor) {
          const rH = 26;
          if (e.isH) {
            const rz = e.zPos(hx, hy);
            railWoodParts.push(boxPart({ x0, x1, z0: rz - 1.3, z1: rz + 1.3, y0: baseY + rH - 2, y1: baseY + rH }));
            for (const pxPos of [x0 + 1.5, x0 + C * 0.5, x1 - 1.5]) {
              railIronParts.push(boxPart({ x0: pxPos - 0.7, x1: pxPos + 0.7, z0: rz - 0.7, z1: rz + 0.7, y0: baseY, y1: baseY + rH - 2 }));
            }
          } else {
            const rx = e.xPos(hx, hy);
            railWoodParts.push(boxPart({ x0: rx - 1.3, x1: rx + 1.3, z0, z1, y0: baseY + rH - 2, y1: baseY + rH }));
            for (const pzPos of [z0 + 1.5, z0 + C * 0.5, z1 - 1.5]) {
              railIronParts.push(boxPart({ x0: rx - 0.7, x1: rx + 0.7, z0: pzPos - 0.7, z1: pzPos + 0.7, y0: baseY, y1: baseY + rH - 2 }));
            }
          }
        }
      }
    }
    if (rimParts.length) {
      const rimMat = HP.graphics3d
        ? HP.graphics3d.material('wood', '#cbbba3')
        : new THREE.MeshLambertMaterial({ color: 0xcbbba3 });
      V.instanced(targetGroup, unitBox(), rimMat, rimParts, { receive: true, lvlIdx: curLvlIdx });
    }
    if (railWoodParts.length) {
      const rwMat = HP.graphics3d ? HP.graphics3d.material('wood', '#8c5a32') : new THREE.MeshLambertMaterial({ color: 0x8c5a32 });
      V.instanced(targetGroup, unitBox(), rwMat, railWoodParts, { cast: true, receive: true, lvlIdx: curLvlIdx });
    }
    if (railIronParts.length) {
      const riMat = HP.graphics3d ? HP.graphics3d.material('metal', '#1e293b') : new THREE.MeshLambertMaterial({ color: 0x1e293b });
      V.instanced(targetGroup, unitBox(), riMat, railIronParts, { cast: true, receive: true, lvlIdx: curLvlIdx });
    }
  }
  return cells;
};

W3._buildCeilingMeshes = function (targetGroup, lvl, lvlIdx, baseY, stairHoles, env) {
  const C = HP.CELL, V = HP.cull3d;
  const gw = HP.GRID_W, gh = HP.GRID_H;
  const { regionOf } = HP.computeRegions(lvl);
  const WALL_H = (HP.geom3d ? HP.geom3d.WALL_H : 74);
  const ceilY = baseY + WALL_H - 0.5;
  const ceilCells = [];

  lvl = lvl || {};
  lvl.ceilings = lvl.ceilings || {};
  lvl.roomCeilings = lvl.roomCeilings || {};

  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const k = x + ',' + y;
      if (stairHoles && stairHoles.has(k)) continue;
      const rid = regionOf[y * gw + x];
      const isInterior = rid >= 0;
      const explicit = lvl.ceilings[k];
      const roomConf = rid >= 0 ? lvl.roomCeilings[rid] : null;
      if (!isInterior && !explicit && !roomConf) continue;

      const conf = explicit || roomConf || { style: 'plaster', color: '#f3ecdc' };
      const style = (typeof conf === 'string' ? conf : (conf.style || 'plaster')).toLowerCase();
      if (style === 'none' || style === 'open' || style === 'sky') continue;
      const color = typeof conf === 'object' ? conf.color : null;
      ceilCells.push({ x, y, k, style, color, isInterior, rid });

      if (W3.roofHeights) {
        W3.roofHeights[y * gw + x] = Math.max(W3.roofHeights[y * gw + x] || 0, ceilY);
      }
    }
  }

  for (const it of (lvl.furniture || [])) {
    if (/pergola|porch|canopy_glass|awning_metal|sunsail/i.test(it.type)) {
      const f = HP.footprint(it);
      for (let py = f.y; py < f.y + f.h; py++) {
        for (let px = f.x; px < f.x + f.w; px++) {
          if (W3.roofHeights) {
            W3.roofHeights[py * gw + px] = Math.max(W3.roofHeights[py * gw + px] || 0, ceilY);
          }
        }
      }
    } else if (/treehouse|greenhouse/i.test(it.type)) {
      const f = HP.footprint(it);
      const rh = baseY + (/treehouse/i.test(it.type) ? 118 : 74);
      for (let py = f.y; py < f.y + f.h; py++) {
        for (let px = f.x; px < f.x + f.w; px++) {
          if (W3.roofHeights) {
            W3.roofHeights[py * gw + px] = Math.max(W3.roofHeights[py * gw + px] || 0, rh);
          }
        }
      }
    }
  }

  if (!ceilCells.length) return;

  const byStyle = new Map();
  for (const c of ceilCells) {
    const key = c.style + '@' + (c.color || '');
    if (!byStyle.has(key)) byStyle.set(key, { style: c.style, color: c.color, cells: [] });
    byStyle.get(key).cells.push(c);
  }

  const roofMat = (HP.graphics3d
    ? HP.graphics3d.material('concrete', '#475569').clone()
    : new THREE.MeshLambertMaterial({ color: 0x475569 }));
  roofMat.shadowSide = THREE.DoubleSide;
  roofMat.userData.shared3d = true;

  const allLevels = (HP.state && HP.state.levels && HP.state.levels.length) ? HP.state.levels : [HP.cur()];
  const upLevelRegions = [];
  for (let l = lvlIdx + 1; l < allLevels.length; l++) {
    const upLvl = allLevels[l];
    if (upLvl) {
      const { regionOf: upReg } = HP.computeRegions(upLvl);
      upLevelRegions.push({ lvl: upLvl, reg: upReg });
    }
  }
  const hasFloorAbove = (cx, cy) => {
    const k = cx + ',' + cy;
    const idx = cy * gw + cx;
    for (let i = 0; i < upLevelRegions.length; i++) {
      const entry = upLevelRegions[i];
      if (entry.lvl.floors && entry.lvl.floors[k]) return true;
      if (entry.reg && entry.reg[idx] >= 0) return true;
    }
    return false;
  };
  const allRoofSet = new Set();

  const ceilPart = (c, y) => {
    const pad = c.isInterior ? 1.2 : 0.45;
    const touchesHole = stairHoles && (
      stairHoles.has((c.x - 1) + ',' + c.y) || stairHoles.has((c.x + 1) + ',' + c.y) ||
      stairHoles.has(c.x + ',' + (c.y - 1)) || stairHoles.has(c.x + ',' + (c.y + 1))
    );
    const s = touchesHole ? C : (C + pad * 2);
    const m = new THREE.Matrix4().makeScale(s, 1, s);
    m.setPosition(c.x * C + C / 2, y, c.y * C + C / 2);
    return { m, x0: c.x * C, z0: c.y * C, x1: (c.x + 1) * C, z1: (c.y + 1) * C };
  };

  for (const [key, { style, color, cells }] of byStyle) {
    const ceilMat = HP.graphics3d
      ? HP.graphics3d.ceilingMaterial(style, color)
      : new THREE.MeshLambertMaterial({ color: color || 0xf3ecdc, side: THREE.FrontSide, shadowSide: THREE.DoubleSide });

    if (style !== 'pergola') {
      // Interior ceiling: cast shadow to seal sunlight, no receiveShadow to eliminate shadow acne
      V.instanced(targetGroup, ceilQuad(), ceilMat, cells.map(c => ceilPart(c, ceilY)), { cast: style !== 'glass', receive: false, lvlIdx, isCeil: true });

      // Roof plane: ONLY for cells that do NOT have a second/higher floor stacked directly above them!
      if (style !== 'glass') {
        const roofCells = cells.filter(c => !hasFloorAbove(c.x, c.y));
        if (roofCells.length > 0) {
          for (const rc of roofCells) allRoofSet.add(rc.k);
          V.instanced(targetGroup, floorQuad(), roofMat, roofCells.map(c => ceilPart(c, ceilY + 0.3)), { cast: true, receive: true, lvlIdx, isRoof: true });
        }
      }
    }

    // Outdoor canopy support posts down to floor where there are no walls
    const isOutdoorStyle = /pergola|porch|glass|metal|sail/i.test(style);
    const outdoorCells = cells.filter(c => !c.isInterior);
    if (isOutdoorStyle && outdoorCells.length > 0) {
      const outSet = new Set(outdoorCells.map(c => c.x + ',' + c.y));
      const postCoords = new Set();
      for (const c of outdoorCells) {
        const corners = [
          [c.x, c.y], [c.x + 1, c.y], [c.x, c.y + 1], [c.x + 1, c.y + 1]
        ];
        for (const [px, py] of corners) {
          let cnt = 0;
          if (outSet.has((px - 1) + ',' + (py - 1))) cnt++;
          if (outSet.has(px + ',' + (py - 1))) cnt++;
          if (outSet.has((px - 1) + ',' + py)) cnt++;
          if (outSet.has(px + ',' + py)) cnt++;
          if (cnt === 1) postCoords.add(px + ',' + py);
        }
      }
      const postH = ceilY - baseY;
      if (postCoords.size > 0 && postH > 10) {
        const postMat = HP.graphics3d
          ? (/glass|metal/i.test(style) ? HP.graphics3d.material('metal', '#181b1e') : HP.graphics3d.material('wood', color || '#5a3d28'))
          : new THREE.MeshLambertMaterial({ color: 0x4a3525 });
        postMat.userData.shared3d = true;
        const postParts = [];
        const pw = 2.0;
        for (const pk of postCoords) {
          const [px, py] = pk.split(',').map(Number);
          const hasWall = lvl.walls && (lvl.walls['h,' + px + ',' + py] || lvl.walls['v,' + px + ',' + py] ||
                                        lvl.walls['h,' + (px - 1) + ',' + py] || lvl.walls['v,' + px + ',' + (py - 1)]);
          if (hasWall) continue;
          const wx = px * C, wz = py * C;
          const boxDef = { x0: wx - pw / 2, x1: wx + pw / 2, z0: wz - pw / 2, z1: wz + pw / 2, y0: baseY, y1: ceilY };
          postParts.push(boxPart(boxDef, color || '#5a3d28'));
        }
        if (postParts.length) {
          V.instanced(targetGroup, unitBox(), postMat, postParts, { cast: true, receive: true, lvlIdx });
        }
      }
    }

    if (style === 'coffered') {
      const beamMat = HP.graphics3d
        ? HP.graphics3d.material('plaster', color || '#ffffff')
        : new THREE.MeshLambertMaterial({ color: 0xffffff });
      beamMat.userData.shared3d = true;
      const beamParts = [];
      for (const c of cells) {
        const cx = (c.x + 0.5) * C, cz = (c.y + 0.5) * C;
        beamParts.push(
          { m: new THREE.Matrix4().makeScale(C, 2.2, 2.4).setPosition(cx, ceilY - 1.1, cz - C / 2 + 1.2), x0: c.x * C, z0: c.y * C, x1: (c.x + 1) * C, z1: (c.y + 1) * C },
          { m: new THREE.Matrix4().makeScale(C, 2.2, 2.4).setPosition(cx, ceilY - 1.1, cz + C / 2 - 1.2), x0: c.x * C, z0: c.y * C, x1: (c.x + 1) * C, z1: (c.y + 1) * C },
          { m: new THREE.Matrix4().makeScale(2.4, 2.2, C - 4.8).setPosition(cx - C / 2 + 1.2, ceilY - 1.1, cz), x0: c.x * C, z0: c.y * C, x1: (c.x + 1) * C, z1: (c.y + 1) * C },
          { m: new THREE.Matrix4().makeScale(2.4, 2.2, C - 4.8).setPosition(cx + C / 2 - 1.2, ceilY - 1.1, cz), x0: c.x * C, z0: c.y * C, x1: (c.x + 1) * C, z1: (c.y + 1) * C }
        );
      }
      V.instanced(targetGroup, unitBox(), beamMat, beamParts, { cast: true, receive: false, lvlIdx });
    } else if (style === 'beams') {
      const timberMat = HP.graphics3d
        ? HP.graphics3d.material('wood', color || '#583e29')
        : new THREE.MeshLambertMaterial({ color: 0x583e29 });
      timberMat.userData.shared3d = true;
      const timberParts = [];
      for (const c of cells) {
        const cx = (c.x + 0.5) * C, cz = (c.y + 0.5) * C;
        timberParts.push({
          m: new THREE.Matrix4().makeScale(C + 0.2, 4.2, 3.2).setPosition(cx, ceilY - 2.1, cz),
          x0: c.x * C, z0: c.y * C, x1: (c.x + 1) * C, z1: (c.y + 1) * C
        });
      }
      V.instanced(targetGroup, unitBox(), timberMat, timberParts, { cast: true, receive: false, lvlIdx });
    } else if (style === 'wood') {
      const battenMat = HP.graphics3d
        ? HP.graphics3d.material('wood', color || '#b88958')
        : new THREE.MeshLambertMaterial({ color: 0xb88958 });
      battenMat.userData.shared3d = true;
      const battenParts = [];
      for (const c of cells) {
        const cx = (c.x + 0.5) * C, cz = (c.y + 0.5) * C;
        for (const oz of [-C / 3, 0, C / 3]) {
          battenParts.push({
            m: new THREE.Matrix4().makeScale(C, 0.4, 0.6).setPosition(cx, ceilY - 0.2, cz + oz),
            x0: c.x * C, z0: c.y * C, x1: (c.x + 1) * C, z1: (c.y + 1) * C
          });
        }
      }
      V.instanced(targetGroup, unitBox(), battenMat, battenParts, { cast: false, receive: false, lvlIdx });
    } else if (style === 'pergola') {
      const pergolaMat = HP.graphics3d
        ? HP.graphics3d.material('wood', color || '#8c5835')
        : new THREE.MeshLambertMaterial({ color: 0x8c5835 });
      pergolaMat.userData.shared3d = true;
      const slatParts = [];
      for (const c of cells) {
        const cx = (c.x + 0.5) * C, cz = (c.y + 0.5) * C;
        slatParts.push(
          { m: new THREE.Matrix4().makeScale(C, 3.2, 2.0).setPosition(cx, ceilY - 1.6, cz - C / 2 + 1), x0: c.x * C, z0: c.y * C, x1: (c.x + 1) * C, z1: (c.y + 1) * C },
          { m: new THREE.Matrix4().makeScale(C, 3.2, 2.0).setPosition(cx, ceilY - 1.6, cz + C / 2 - 1), x0: c.x * C, z0: c.y * C, x1: (c.x + 1) * C, z1: (c.y + 1) * C }
        );
        for (let j = 0; j < 5; j++) {
          const ox = -C / 2 + 2.8 + j * ((C - 5.6) / 4);
          slatParts.push({
            m: new THREE.Matrix4().makeScale(1.2, 2.6, C + 1.2).setPosition(cx + ox, ceilY - 1.3, cz),
            x0: c.x * C, z0: c.y * C, x1: (c.x + 1) * C, z1: (c.y + 1) * C
          });
        }
      }
      V.instanced(targetGroup, unitBox(), pergolaMat, slatParts, { cast: true, receive: false, lvlIdx });
    } else if (style === 'porch') {
      const fasciaMat = HP.graphics3d
        ? HP.graphics3d.material('wood', color || '#f8fafc')
        : new THREE.MeshLambertMaterial({ color: 0xf8fafc });
      fasciaMat.userData.shared3d = true;
      const fasciaParts = [];
      for (const c of cells) {
        const cx = (c.x + 0.5) * C, cz = (c.y + 0.5) * C;
        fasciaParts.push(
          { m: new THREE.Matrix4().makeScale(C, 2.8, 1.8).setPosition(cx, ceilY - 1.4, cz - C / 2 + 0.9), x0: c.x * C, z0: c.y * C, x1: (c.x + 1) * C, z1: (c.y + 1) * C },
          { m: new THREE.Matrix4().makeScale(C, 2.8, 1.8).setPosition(cx, ceilY - 1.4, cz + C / 2 - 0.9), x0: c.x * C, z0: c.y * C, x1: (c.x + 1) * C, z1: (c.y + 1) * C }
        );
      }
      V.instanced(targetGroup, unitBox(), fasciaMat, fasciaParts, { cast: true, receive: false, lvlIdx });
    } else if (style === 'glass') {
      const frameMat = HP.graphics3d
        ? HP.graphics3d.material('metal', '#1e2023')
        : new THREE.MeshLambertMaterial({ color: 0x1e2023 });
      frameMat.userData.shared3d = true;
      const mullionParts = [];
      for (const c of cells) {
        const cx = (c.x + 0.5) * C, cz = (c.y + 0.5) * C;
        mullionParts.push(
          { m: new THREE.Matrix4().makeScale(C, 1.4, 1.4).setPosition(cx, ceilY, cz), x0: c.x * C, z0: c.y * C, x1: (c.x + 1) * C, z1: (c.y + 1) * C },
          { m: new THREE.Matrix4().makeScale(1.4, 1.4, C).setPosition(cx, ceilY, cz), x0: c.x * C, z0: c.y * C, x1: (c.x + 1) * C, z1: (c.y + 1) * C }
        );
      }
      V.instanced(targetGroup, unitBox(), frameMat, mullionParts, { cast: true, receive: false, lvlIdx });
    }
  }

  if (allRoofSet.size > 0) {
    const isRoof = (cx, cy) => allRoofSet.has(cx + ',' + cy);
    const isExposed = (cx, cy) => !isRoof(cx, cy) && !hasFloorAbove(cx, cy);
    const E = 2.0, y0 = ceilY - 0.15, y1 = ceilY + 0.29;
    const eaveParts = [];
    for (const rk of allRoofSet) {
      const [rx, ry] = rk.split(',').map(Number);
      const x0 = rx * C, x1 = (rx + 1) * C, z0 = ry * C, z1 = (ry + 1) * C;
      const expN = isExposed(rx, ry - 1), expS = isExposed(rx, ry + 1);
      const expW = isExposed(rx - 1, ry), expE = isExposed(rx + 1, ry);
      if (expN) eaveParts.push(boxPart({ x0: x0 - (expW ? E : 0), x1: x1 + (expE ? E : 0), z0: z0 - E, z1: z0 - 0.12, y0, y1 }));
      if (expS) eaveParts.push(boxPart({ x0: x0 - (expW ? E : 0), x1: x1 + (expE ? E : 0), z0: z1 + 0.12, z1: z1 + E, y0, y1 }));
      if (expW) eaveParts.push(boxPart({ x0: x0 - E, x1: x0 - 0.12, z0, z1, y0, y1 }));
      if (expE) eaveParts.push(boxPart({ x0: x1 + 0.12, x1: x1 + E, z0, z1, y0, y1 }));
    }
    if (eaveParts.length) {
      V.instanced(targetGroup, unitBox(), roofMat, eaveParts, { cast: true, receive: true, lvlIdx });
    }
  }
};

W3.updateFloors = function () {
  if (!W3.levelGroup || !W3.floorGroup) {
    W3.buildLevel();
    return;
  }
  const allLevels = (HP.state && HP.state.levels && HP.state.levels.length) ? HP.state.levels : [HP.cur()];
  if (!allLevels[0]) return;
  const WALL_H = (HP.geom3d && HP.geom3d.WALL_H) || 74;
  const V = HP.cull3d;
  const nextFLG = new THREE.Group();
  allLevels.forEach((lv, lIdx) => {
    if (lv) W3._buildFloorMeshes(nextFLG, lv, lIdx * WALL_H, W3.stairFloorOpenings && W3.stairFloorOpenings[lIdx], W3.stairMeta && W3.stairMeta[lIdx], null, allLevels[lIdx - 1]);
  });

  if (W3.floorGroup) {
    if (V && V.removeGroup) V.removeGroup(W3.floorGroup);
    W3.levelGroup.remove(W3.floorGroup);
    disposeGroup(W3.floorGroup);
  }
  W3.floorGroup = nextFLG;
  W3.levelGroup.add(nextFLG);
  if (HP.graphics3d) HP.graphics3d.applyMaterials(nextFLG);
  if (V && V.invalidate) V.invalidate(); else if (V) V.dirty = true;
};


function floorQuad() {
  if (!W3._fq) W3._fq = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  return W3._fq;
}
function ceilQuad() {
  if (!W3._cq) W3._cq = new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2);
  return W3._cq;
}

function regionFloorId(x, y, lvl, regionOf) {
  if (!regionOf) regionOf = HP.computeRegions().regionOf;
  if (x < 0 || y < 0 || x >= HP.GRID_W || y >= HP.GRID_H) return null;
  const mat = lvl.floors[x + ',' + y];
  if (regionOf[y * HP.GRID_W + x] < 0 && !mat) return null;   // bare outside = ground
  return mat || 'wood';
}
const _fcols = {};
function floorColor(id) {
  if (_fcols[id]) return _fcols[id];
  const m = HP.FLOOR_MATS.find(f => f.id === id);
  return _fcols[id] = m ? m.col : '#c9a877';
}
function unitBox() {
  if (!W3._ub) { W3._ub = new THREE.BoxGeometry(1, 1, 1); }
  return W3._ub;
}
function unitCyl() {
  if (!W3._uCyl) { W3._uCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 8); }
  return W3._uCyl;
}
function unitRoof() {
  if (!W3._uRoof) { W3._uRoof = new THREE.ConeGeometry(0.71, 1, 4).rotateY(Math.PI / 4); }
  return W3._uRoof;
}
function unitCone() {
  if (!W3._uCone) { W3._uCone = new THREE.CylinderGeometry(0.05, 0.5, 1, 8); }
  return W3._uCone;
}
function unitSphere() {
  if (!W3._uSph) { W3._uSph = new THREE.SphereGeometry(0.5, 8, 6); }
  return W3._uSph;
}
function unitCylX() {
  if (!W3._uCylX) { W3._uCylX = new THREE.CylinderGeometry(0.5, 0.5, 1, 8).rotateZ(Math.PI / 2); }
  return W3._uCylX;
}
function unitCylZ() {
  if (!W3._uCylZ) { W3._uCylZ = new THREE.CylinderGeometry(0.5, 0.5, 1, 8).rotateX(Math.PI / 2); }
  return W3._uCylZ;
}
function disposeGroup(gr) {
  const geometries = new Set(), materials = new Set();
  const sharedGeo = new Set([W3._ub, W3._fq, W3._cq, W3._uCyl, W3._uRoof, W3._uCone, W3._uSph, W3._uCylX, W3._uCylZ]);
  gr.traverse(o => {
    if (o.geometry && !sharedGeo.has(o.geometry)) geometries.add(o.geometry);
    if (o.material && !o.material.userData.shared3d) materials.add(o.material);
    if (o.isInstancedMesh && o.dispose) o.dispose();
  });
  geometries.forEach(g => g.dispose());
  materials.forEach(m => {
    m.dispose();
    const twin = HP.graphics3d && HP.graphics3d.companion(m);
    if (twin && !twin.userData.shared3d) twin.dispose();
  });
}

/* ---------- audit overlay + 3D markers ---------- */
W3.runAudit = function () {
  const lvl = HP.cur ? HP.cur() : {};
  const walls = (lvl && lvl.walls) || {};
  const env = geomEnv(lvl);
  const { checks } = HP.geom3d.audit(walls, env);
  const roomNames = (lvl && lvl.roomNames) || {};
  const labelRoom = (rid) => rid >= 0 ? (roomNames[rid] || `Room ${rid + 1}`) : 'Exterior';
  const segLabel = (k) => {
    const seg = HP.parseWallKey ? HP.parseWallKey(k) : null;
    if (!seg) return k;
    const ra = seg.d === 'h' ? env.rAt(seg.x, seg.y - 1) : env.rAt(seg.x - 1, seg.y);
    const rb = env.rAt(seg.x, seg.y);
    const names = [...new Set([ra, rb].filter(r => r >= 0).map(labelRoom))];
    return names.length ? `${names.join('/')} (${k})` : k;
  };
  for (const ch of checks) {
    if (ch.marks && ch.marks.length && ch.detail) {
      ch.detail = ch.marks.slice(0, 6).map(m => segLabel(m.k || '')).filter(Boolean).join(', ') || ch.detail;
    }
  }
  if (HP.computeRegions) {
    const { regionOf, regions } = HP.computeRegions(lvl);
    const openRid = new Set();
    for (const wk of Object.keys(walls)) {
      const w = walls[wk];
      if (!w || (w.f !== 'door' && w.f !== 'archway')) continue;
      const seg = HP.parseWallKey ? HP.parseWallKey(wk) : null;
      if (!seg) continue;
      const ra = seg.d === 'h' ? env.rAt(seg.x, seg.y - 1) : env.rAt(seg.x - 1, seg.y);
      const rb = env.rAt(seg.x, seg.y);
      if (ra >= 0) openRid.add(ra);
      if (rb >= 0) openRid.add(rb);
    }
    const gw = HP.GRID_W || 64;
    for (const it of (lvl.furniture || [])) {
      if (!/stairs/i.test(it.type)) continue;
      const f = HP.footprint(it);
      for (let fy = f.y; fy < f.y + f.h; fy++) {
        for (let fx = f.x; fx < f.x + f.w; fx++) {
          const rid = regionOf[fy * gw + fx];
          if (rid >= 0) openRid.add(rid);
        }
      }
    }
    const sealed = (regions || []).filter(r => r && r.id !== undefined && !openRid.has(r.id));
    checks.push({
      ok: sealed.length === 0,
      name: 'All rooms have doors or stairs',
      detail: sealed.length ? ('Sealed: ' + sealed.map(r => labelRoom(r.id)).join(', ')) : `all ${regions.length} rooms accessible`,
      marks: sealed.map(r => ({ x0: r.lx - 10, x1: r.lx + 10, z0: r.ly - 10, z1: r.ly + 10, y0: 0, y1: 60 })),
    });
  }
  W3.clearAudit();
  markerGroup = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.55, depthTest: false });
  for (const c of checks) for (const m of c.marks || []) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(
      Math.max(3, m.x1 - m.x0), Math.max(8, m.y1 - m.y0), Math.max(3, m.z1 - m.z0)), mat);
    b.position.set((m.x0 + m.x1) / 2, (m.y0 + m.y1) / 2, (m.z0 + m.z1) / 2);
    b.renderOrder = 999;
    markerGroup.add(b);
  }
  W3.levelGroup.add(markerGroup);
  return checks;
};
W3.clearAudit = function () {
  if (!markerGroup) return;
  if (W3.levelGroup) W3.levelGroup.remove(markerGroup);
  disposeGroup(markerGroup);
  markerGroup = null;
};

let lastRender = 0;
W3.render = function () {
  if (!renderer) return;
  const domEl = renderer.domElement;
  if (domEl && domEl.clientWidth > 0 && domEl.clientHeight > 0) {
    const curW = domEl.clientWidth, curH = domEl.clientHeight;
    const curAspect = curW / curH;
    const dpr = renderer.getPixelRatio ? renderer.getPixelRatio() : 1;
    const expW = Math.floor(curW * dpr), expH = Math.floor(curH * dpr);
    if (Math.abs(camera.aspect - curAspect) > 0.005 || domEl.width !== expW || domEl.height !== expH) {
      fit();
    }
  }
  const p = camera.position, now = performance.now();
  const dt = Math.min(0.1, lastRender ? (now - lastRender) / 1000 : 0); lastRender = now;
  if (HP.cull3d) HP.cull3d.update(p.x, p.z);
  let skyS = null;
  if (HP.sky3d && HP.sky3d.sky) { HP.sky3d.sky.position.copy(p); skyS = tickTime(dt, now); }
  if (HP.graphics3d) HP.graphics3d.animate(now);
  if (HP.life3d && skyS) HP.life3d.tick(dt, now / 1000, skyS, p);
  /* pool water: gentle vertex ripple + caustics fade with the sun    */
  for (const wq of (W3.water || [])) {
    if (wq.pos) {
      const t2 = now / 1000, pos = wq.pos;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        pos.setY(i, (Math.sin(x * 0.42 + t2 * 1.9) + Math.sin(z * 0.36 + t2 * 2.4))
          * 0.3 * wq.taper[i]);
      }
      pos.needsUpdate = true;
    }
    const co = 0.45 * (skyS ? Math.max(0.06, 1 - skyS.night) : 1);
    for (const cm of wq.caustics) {
      cm.opacity = co;
      const mp = cm.map;
      if (mp) {
        mp.offset.set(Math.sin(now * 0.00013) * 0.09, now * 0.000011 % 1);
        mp.rotation = Math.sin(now * 0.00005) * 0.35;   // sway, don't spin
      }
    }
  }
  if (HP.weather3d && HP.weather3d.tick) {
    HP.weather3d.tick(dt, p, sun, ambient);
  }
  if (HP.sound3d && skyS) {
    const C2 = HP.CELL;
    const WALL_H = (HP.geom3d && HP.geom3d.WALL_H) || 74;
    const curFloor = Math.max(0, Math.floor((p.y + 0.1) / WALL_H));
    const curLvl = (HP.state && HP.state.levels && HP.state.levels[curFloor]) || HP.cur();
    const cx = Math.floor(p.x / C2), cy = Math.floor(p.z / C2);
    const { regionOf } = HP.computeRegions(curLvl);
    const outside = cx < 0 || cy < 0 || cx >= HP.GRID_W || cy >= HP.GRID_H ||
                    regionOf[cy * HP.GRID_W + cx] === -1;
    const amb2 = (HP.life3d && HP.life3d.ambience) || { water: [], fire: [], fan: [] };
    const near = arr => Math.min(...arr.map(s2 => Math.hypot(s2.x - p.x, s2.z - p.z)), 1e9);
    HP.sound3d.tick(dt, now / 1000, {
      outdoors: outside ? 1 : 0, night: skyS.night, day: skyS.day,
      nearWater: near(amb2.water), nearFire: near(amb2.fire), nearFan: near(amb2.fan),
    });
  }
  if (sun.castShadow) {
    /* shadow box centred a little ahead of the player, snapped to
       whole shadow texels in light space so edges don't shimmer      */
    const R = sun.shadow.camera.right;
    camera.getWorldDirection(_f); _f.y = 0;
    if (_f.lengthSq() > 1e-6) _f.normalize();
    _c.set(p.x, 0, p.z).addScaledVector(_f, R * 0.45);
    _lm.lookAt(sunDir, _zero, _up); _li.copy(_lm).invert();
    _c.applyMatrix4(_li);
    const texel = 2 * R / sun.shadow.mapSize.x;
    _c.x = Math.round(_c.x / texel) * texel; _c.y = Math.round(_c.y / texel) * texel;
    _c.applyMatrix4(_lm);
    sun.target.position.copy(_c);
    sun.position.copy(_c).addScaledVector(sunDir, 1400);
    sun.target.updateMatrixWorld();
  }
  renderer.render(scene, camera);
};
})();
