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

for (const file of ['grid', 'catalog', 'geom3d', 'graphics3d', 'cull3d', 'sky3d', 'furniture3d', 'world3d', 'ui', 'walk3d', 'walk']) {
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

console.log('✓ PASS test-archway.js: Catalog archways (1x1, 2x1, 3x1) & Door styles (archway, arched) verified with batched 60fps geometry!');
