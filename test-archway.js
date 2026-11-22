// Test Archway catalog items and door archway/arched styles
const fs = require('fs'), path = require('path'), assert = require('assert'), vm = require('vm');
const THREE = require('./lib/three.min.js');

const mockCtx = () => new Proxy({
  createRadialGradient: () => ({ addColorStop() {} }),
  createLinearGradient: () => ({ addColorStop() {} }),
  createImageData: () => ({ data: new Uint8ClampedArray(1024) }),
  getImageData: () => ({ data: new Uint8ClampedArray(1024) }),
}, {
  get: (target, prop) => target[prop] || (() => ({}))
});
const storage = {}, context = {
  THREE, console, devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720,
  navigator: { hardwareConcurrency: 8, deviceMemory: 8 },
  matchMedia: () => ({ matches: false }), addEventListener() {},
  localStorage: { getItem: k => storage[k] || null, setItem: (k, v) => storage[k] = v },
  document: { hidden: false, createElement: () => ({ getContext: () => mockCtx() }), getElementById: () => null },
};
context.window = context;
vm.createContext(context);

for (const file of ['grid', 'catalog', 'rooms', 'geom3d', 'graphics3d', 'cull3d', 'sky3d', 'furniture3d', 'world3d', 'ui', 'walk3d', 'walk']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'src', file + '.js'), 'utf8'), context);
}

const { HP } = context;
HP.graphics3d.init({ setPixelRatio: () => {}, capabilities: {} }, () => {});

// 1. Check catalog items
const archDef = HP.CATALOG.find(d => d.id === 'archway');
assert(archDef, 'archway item must exist in catalog');
assert.equal(archDef.cat, 'Build', 'archway must be in Build category');
assert.equal(archDef.walkable, true, 'archway must be walkable');
assert.equal(archDef.w, 2);
assert.equal(archDef.h, 1);

const arch3Def = HP.CATALOG.find(d => d.id === 'archway3');
assert(arch3Def, 'archway3 item must exist in catalog');
assert.equal(arch3Def.walkable, true);
assert.equal(arch3Def.w, 3);

const arch1Def = HP.CATALOG.find(d => d.id === 'archway1');
assert(arch1Def, 'archway1 item must exist in catalog');
assert.equal(arch1Def.walkable, true);
assert.equal(arch1Def.w, 1);

// 2. Check door styles
const doorStyles = HP.DOOR_STYLE_DEFS;
assert(doorStyles, 'HP.DOOR_STYLE_DEFS must exist');
assert(doorStyles.archway, 'archway door style must exist');
assert.equal(doorStyles.archway.name, 'Archway');
assert(doorStyles.arched, 'arched door style must exist');
assert.equal(doorStyles.arched.name, 'Arched Door');

// 3. Test 3D building of archway furniture model across wall styles
HP.cur = () => ({
  walls: {
    'h,3,4': { style: 'brick', ca: '#ffffff', cb: '#ffffff' },
    'h,6,4': { style: 'brick', ca: '#ffffff', cb: '#ffffff' }
  }
});

const group = new THREE.Group(), builder = HP.furniture3d.builder(group);
for (const id of ['archway', 'archway3', 'archway1']) {
  const def = HP.CATALOG.find(d => d.id === id);
  for (let rot = 0; rot < 4; rot++) {
    const it = { type: id, x: 4, y: 4, rot, v: 0 };
    builder.add(it, def, HP.footprint(it), 74, 0);
  }
}
const visuals = builder.finish();
assert(group.children.length > 0, 'Archway 3D meshes must be baked');
for (const obj of group.children) {
  for (const v of obj.geometry.attributes.position.array) {
    assert(Number.isFinite(v), 'All archway vertices must be finite');
  }
}

// 4. Test door frame archway building with wall style matching and batched mesh performance
HP.cur = () => ({
  walls: {
    'h,4,4': { f: 'door', doorStyle: 'archway', style: 'brick', ca: '#ffffff', cb: '#ffffff' }
  }
});
const frameGroup = HP.world3d.buildDoorFrame({ k: 'h,4,4', d: 'h', x0: 112, x1: 168, z0: 112, z1: 116 }, 112, 168, new THREE.Group(), 0);
assert(frameGroup.children.length > 0, 'Arched door frame must create meshes');
assert(frameGroup.children.length <= 3, 'Archway door frame meshes must be batched for 60fps performance (was 74, now <= 3)');
const spandrelMesh = frameGroup.children.find(c => c.geometry && (c.geometry.type === 'BufferGeometry' || c.geometry.type === 'BoxGeometry') && c.material);
assert(spandrelMesh, 'Archway door frame must have spandrel geometry');
assert(spandrelMesh.material, 'Spandrel mesh must have a valid material');

// 5. Test front & behind wall flush alignment and symmetry across interior & exterior walls
for (const wallType of ['interior', 'exterior']) {
  for (const rot of [0, 1]) {
    const isH = (rot === 0 || rot === 2);
    const isExt = (wallType === 'exterior');
    const walls = {};
    if (isH) {
      for (let x = 2; x < 8; x++) walls['h,' + x + ',2'] = { style: 'plaster' };
      for (let y = 2; y < 4; y++) { walls['v,2,' + y] = { style: 'plaster' }; walls['v,8,' + y] = { style: 'plaster' }; }
      walls['h,2,4'] = { style: 'plaster' }; walls['h,3,4'] = { style: 'plaster' };
      walls['h,6,4'] = { style: 'plaster' }; walls['h,7,4'] = { style: 'plaster' };
      if (!isExt) {
        for (let x = 2; x < 8; x++) walls['h,' + x + ',6'] = { style: 'plaster' };
        for (let y = 4; y < 6; y++) { walls['v,2,' + y] = { style: 'plaster' }; walls['v,8,' + y] = { style: 'plaster' }; }
      }
    } else {
      for (let y = 2; y < 8; y++) walls['v,2,' + y] = { style: 'plaster' };
      for (let x = 2; x < 4; x++) { walls['h,' + x + ',2'] = { style: 'plaster' }; walls['h,' + x + ',8'] = { style: 'plaster' }; }
      walls['v,4,2'] = { style: 'plaster' }; walls['v,4,3'] = { style: 'plaster' };
      walls['v,4,6'] = { style: 'plaster' }; walls['v,4,7'] = { style: 'plaster' };
      if (!isExt) {
        for (let y = 2; y < 8; y++) walls['v,6,' + y] = { style: 'plaster' };
        for (let x = 4; x < 6; x++) { walls['h,' + x + ',2'] = { style: 'plaster' }; walls['h,' + x + ',8'] = { style: 'plaster' }; }
      }
    }

    const arch = { type: 'archway', x: 4, y: 4, rot, v: 0 };
    const curLvl = { walls, furniture: [arch] };
    HP.cur = () => curLvl;
    HP.state = { level: 0, levels: [curLvl] };

    const env = HP.world3d.geomEnv(curLvl);
    const geo = HP.geom3d.build(curLvl.walls, env);
    HP.world3d.geom = geo;

    const gTest = new THREE.Group();
    const bld = HP.furniture3d.builder(gTest);
    const dArch = HP.CATALOG.find(d => d.id === 'archway');
    bld.add(arch, dArch, HP.footprint(arch), 74, 0);
    bld.finish();

    const C = 28;
    const f = HP.footprint(arch);
    const touchingBox = geo.boxes.find(b => b.tag === 'wall' && (
      isH ? (b.d === 'h' && (Math.abs(b.x1 - f.x * C) < 3 || Math.abs(b.x0 - (f.x + f.w) * C) < 3))
          : (b.d === 'v' && (Math.abs(b.z1 - f.y * C) < 3 || Math.abs(b.z0 - (f.y + f.h) * C) < 3))
    ));
    assert(touchingBox, 'Must find touching wall box');

    const wallU0 = isH ? touchingBox.z0 : touchingBox.x0;
    const wallU1 = isH ? touchingBox.z1 : touchingBox.x1;

    for (const c of gTest.children) c.geometry.computeBoundingBox();
    const aMesh = gTest.children.find(c => c.geometry.boundingBox.max.y > 70);
    assert(aMesh, 'Must have archway mesh');
    const bb = aMesh.geometry.boundingBox;
    const archU0 = isH ? bb.min.z : bb.min.x;
    const archU1 = isH ? bb.max.z : bb.max.x;

    const midDiff = Math.abs(((archU0 + archU1)/2) - ((wallU0 + wallU1)/2));
    const u0Diff = Math.abs(archU0 - wallU0);
    const u1Diff = Math.abs(archU1 - wallU1);

    assert(midDiff < 0.01, 'Centerline must match wall exactly: ' + midDiff);
    assert(Math.abs(u0Diff - u1Diff) < 0.01, 'Front and back must be perfectly symmetric: ' + Math.abs(u0Diff - u1Diff));
    assert(u0Diff < 0.9 && u1Diff < 0.9, 'Must be flush with wall within plinth trim tolerance');
  }
}

// 6. Test archway pillar sub-colliders and walkthrough opening
for (const id of ['archway', 'archway1', 'archway3']) {
  const def = HP.CATALOG.find(d => d.id === id);
  const it = { type: id, x: 10, y: 10, rot: 0, _midZ: 280, _wallThickPx: 8.4 };
  const f = HP.footprint(it);
  const colliders = HP.itemColliders(it, def, f, 74);
  assert.equal(colliders.length, 3, `${id} must have 3 sub-colliders (left post, right post, header)`);
  const leftPost = colliders[0], rightPost = colliders[1], header = colliders[2];
  assert(leftPost.y0 === 0 && leftPost.y1 === 74, 'Left pillar must be floor-to-ceiling collider');
  assert(rightPost.y0 === 0 && rightPost.y1 === 74, 'Right pillar must be floor-to-ceiling collider');
  assert(header.y0 >= 50 && header.y1 === 74, 'Header must be overhead collider');
  assert(rightPost.x0 > leftPost.x1, 'Must have open space between left and right pillars');
  const span = rightPost.x0 - leftPost.x1;
  assert(span >= 18, `Walkthrough opening must be at least 18px clear: was ${span}`);
  // In 2D walk mode: center must NOT be blocked
  const blocked2D = HP.itemBlockedCells(it, def, f, 74);
  assert.equal(blocked2D.length, 0, `${id} must not block 2D walkthrough cells`);
}

console.log('✓ PASS test-archway.js: Catalog archways (1x1, 2x1, 3x1), Door styles (archway, arched) & dual-sided wall flush alignment verified!');
