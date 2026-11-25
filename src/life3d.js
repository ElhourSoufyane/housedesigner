/* life3d.js — the living layer: birds, butterflies, fireflies, and
   furniture that actually works (fan spins, clock tells game time,
   fish swim, fire flickers, TV/lamps toggle with E).
   All procedural — no assets, per-frame cost is a handful of small
   meshes; creatures are skipped entirely on the Low tier.          */
window.HP = window.HP || {};
(function () {
const L = HP.life3d = {};
const C = () => HP.CELL;
let group = null;            // one group per level, dies with levelGroup
const spinners = [];         // {obj, speed}
const clockHands = [];       // {hour, min} hand meshes
const fish = [];             // {mesh, cx, cz, rx, rz, ph, sp, y}
const fires = [];            // {cones[], light, on, base}
const screens = [];          // {mat, on, mesh}
const lampBulbs = [];        // {mesh, src, on}
const birds = [];
const flies = [];            // butterflies
const shoeCabinets = [];
let fireflies = null, fireflySeed = null;
let dog = null;              // the pet

L.interactables = [];
L.dogState = () => dog && { x: dog.x, z: dog.z, state: dog.state };
Object.defineProperty(L, 'dog', { get: () => dog, enumerable: true });

/* ---------- helpers ---------- */
function std(color, opts) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0 }, opts || {}));
}
function glowMat(color) {
  return new THREE.MeshBasicMaterial({ color });   // unlit = self-glowing
}
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

/* ---------- per-item working parts ---------- */
function addFan(cx, cz, baseY) {
  const g = new THREE.Group();
  const m = std('#1e293b', { roughness: 0.4, metalness: 0.3 });
  const wood = std('#8a6844', { roughness: 0.6 });
  const glow = glowMat('#fef08a');

  // 1. Flush ceiling canopy
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 1.2, 16), m);
  canopy.position.y = 1.0;
  g.add(canopy);

  // 2. Downrod
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 7, 10), m);
  rod.position.y = -2.6;
  g.add(rod);

  // 3. Stationary Motor Housing & Warm LED Light Disc
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 1.8, 18), m);
  housing.position.y = -6.5;
  g.add(housing);

  const lightDisc = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.35, 16), glow);
  lightDisc.position.y = -7.5;
  g.add(lightDisc);

  // 4. Aerodynamic Spinning Blades
  const blades = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const b = box(25, 0.6, 4.2, wood);
    b.position.set(13.5, 0, 0);
    const holder = new THREE.Group();
    holder.add(b); holder.rotation.y = i * Math.PI / 2;
    blades.add(holder);
  }
  blades.position.y = -6.5;
  g.add(blades);

  g.position.set(cx, (baseY || 0) + HP.geom3d.WALL_H - 2, cz);
  group.add(g);
  spinners.push({ obj: blades, speed: 7 });
}
function addClock(cx, cz, rot, w, off, isHung, customR, baseY, dialY) {
  const g = new THREE.Group();
  const r = customR !== undefined ? customR : Math.min(w, 26) * 0.42;
  const darkCase = std('#2c221e');
  const woodCase = std('#5c3e26', { roughness: 0.5 });
  const goldMetal = std('#c9a44e', { metalness: 0.8, roughness: 0.25 });
  const faceMat = std('#fcfaf2', { roughness: 0.4 });
  const handMat = std('#1a1a1a', { roughness: 0.2 });
  const secMat = std('#dc2626', { roughness: 0.3 });

  // 1. Backing case / bezel mounting box for wall clock
  if (isHung) {
    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.9, r + 0.9, 1.4, 28), woodCase);
    bezel.rotation.x = Math.PI / 2;
    bezel.position.z = 0.7;
    g.add(bezel);
    // Inner brass accent ring
    const brassRim = new THREE.Mesh(new THREE.TorusGeometry(r + 0.2, 0.35, 8, 28), goldMetal);
    brassRim.position.z = 1.35;
    g.add(brassRim);
  }

  // 2. Clock dial face
  const face = new THREE.Mesh(new THREE.CircleGeometry(r, 28), faceMat);
  face.position.z = isHung ? 1.4 : 0;

  // Outer rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.08, 8, 28), darkCase);
  rim.position.z = isHung ? 1.4 : 0;

  // 3. 12 Hour Marker studs around the perimeter
  for (let h = 0; h < 12; h++) {
    const ang = h * (Math.PI / 6);
    const isMajor = h % 3 === 0;
    const dotR = isMajor ? 0.45 : 0.25;
    const marker = new THREE.Mesh(new THREE.CircleGeometry(dotR, 8), isMajor ? goldMetal : handMat);
    marker.position.set(Math.sin(ang) * (r * 0.82), Math.cos(ang) * (r * 0.82), (isHung ? 1.41 : 0.01));
    g.add(marker);
  }

  // 4. Center brass spindle cap
  const centerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.6, 12), goldMetal);
  centerCap.rotation.x = Math.PI / 2;
  centerCap.position.z = isHung ? 1.8 : 0.4;
  g.add(centerCap);

  // 5. Hour, minute & second hands
  const hour = box(r * 0.55, r * 0.09, 0.3, handMat);
  const minute = box(r * 0.82, r * 0.06, 0.3, handMat);
  const second = box(r * 0.88, r * 0.03, 0.2, secMat);
  hour.geometry.translate(r * 0.27, 0, 0); hour.position.z = isHung ? 1.6 : 0.2;
  minute.geometry.translate(r * 0.41, 0, 0); minute.position.z = isHung ? 1.7 : 0.3;
  second.geometry.translate(r * 0.38, 0, 0); second.position.z = isHung ? 1.8 : 0.4;

  g.add(face, rim, hour, minute, second);
  g.position.set(cx, (baseY || 0) + (dialY !== undefined ? dialY : (isHung ? 46 : 44)), cz);
  g.rotation.y = -rot * Math.PI / 2;

  const fwd = new THREE.Vector3(0, 0, off === undefined ? 2.6 : off).applyEuler(g.rotation);
  g.position.add(fwd);
  group.add(g);
  clockHands.push({ hour, minute, second });
}
function addFish(cx, cz, w, dep, tankY) {
  const species = [
    { name: 'clownfish', body: '#ff6914', fin: '#ff8533', tail: '#ff6914', stripes: true, sp: 0.65, rx: w * 0.28, rz: dep * 0.22, yOff: 0, sc: 1.1 },
    { name: 'bluetang', body: '#1963d2', fin: '#ffce1f', tail: '#ffce1f', stripes: false, sp: 0.82, rx: w * 0.25, rz: dep * 0.20, yOff: 2.2, sc: 1.0 },
    { name: 'guppy', body: '#ffa812', fin: '#ff771a', tail: '#ff4422', stripes: false, sp: 0.92, rx: w * 0.29, rz: dep * 0.24, yOff: -2.0, sc: 0.95 }
  ];
  for (let i = 0; i < species.length; i++) {
    const s = species[i];
    const holder = new THREE.Group();
    // 1. Sleek hydrodynamic fish body
    const bodyGeo = new THREE.SphereGeometry(1.0, 10, 8);
    bodyGeo.scale(1.5 * s.sc, 0.72 * s.sc, 0.36 * s.sc);
    const bodyMesh = new THREE.Mesh(bodyGeo, std(s.body, { roughness: 0.35, metalness: 0.05 }));
    holder.add(bodyMesh);

    // 2. White clownfish stripes
    if (s.stripes) {
      for (const sx of [-0.25 * s.sc, 0.35 * s.sc]) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.72 * s.sc, 0.72 * s.sc, 0.28 * s.sc, 10), std('#ffffff', { roughness: 0.4 }));
        ring.rotation.z = Math.PI / 2;
        ring.scale.set(1.0, 0.96, 0.46);
        ring.position.x = sx;
        holder.add(ring);
      }
    } else if (s.name === 'bluetang') {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.7 * s.sc, 0.12 * s.sc, 0.38 * s.sc), std('#0d1117'));
      mark.position.set(-0.25 * s.sc, 0.18 * s.sc, 0);
      holder.add(mark);
    }

    // 3. Realistic fish eyes on left and right sides of head
    for (const side of [-1, 1]) {
      const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.18 * s.sc, 6, 6), std('#ffffff', { roughness: 0.2 }));
      eyeW.position.set(1.05 * s.sc, 0.14 * s.sc, side * 0.33 * s.sc);
      eyeW.scale.set(0.8, 0.8, 0.4);
      const eyeP = new THREE.Mesh(new THREE.SphereGeometry(0.10 * s.sc, 6, 6), std('#101214', { roughness: 0.1 }));
      eyeP.position.set(1.12 * s.sc, 0.14 * s.sc, side * 0.36 * s.sc);
      eyeP.scale.set(0.6, 0.6, 0.4);
      holder.add(eyeW, eyeP);
    }

    // 4. Dorsal fin on top
    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.4 * s.sc, 1.2 * s.sc, 4), std(s.fin, { roughness: 0.5 }));
    dorsal.rotation.z = -Math.PI / 3;
    dorsal.scale.set(1.0, 1.0, 0.12);
    dorsal.position.set(-0.15 * s.sc, 0.82 * s.sc, 0);
    holder.add(dorsal);

    // 5. Left & right pectoral fins
    for (const side of [-1, 1]) {
      const pec = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s.sc, 0.08 * s.sc, 0.35 * s.sc), std(s.fin, { roughness: 0.5, transparent: true, opacity: 0.85 }));
      pec.position.set(0.35 * s.sc, -0.12 * s.sc, side * 0.38 * s.sc);
      pec.rotation.y = side * 0.35;
      pec.rotation.z = -0.2;
      holder.add(pec);
    }

    // 6. Waggling Tail & Caudal fin on animated pivot
    const tailPivot = new THREE.Group();
    tailPivot.position.set(-1.3 * s.sc, 0, 0);
    const caudal = new THREE.Mesh(new THREE.ConeGeometry(0.72 * s.sc, 1.4 * s.sc, 3), std(s.tail, { roughness: 0.4 }));
    caudal.rotation.z = Math.PI / 2;
    caudal.scale.set(1.0, 1.0, 0.12);
    caudal.position.set(-0.70 * s.sc, 0, 0);
    tailPivot.add(caudal);
    holder.add(tailPivot);

    group.add(holder);
    fish.push({
      mesh: holder,
      tail: tailPivot,
      cx,
      cz,
      rx: Math.min(s.rx, w * 0.32),
      rz: Math.min(s.rz, dep * 0.24),
      ph: i * 2.09,
      sp: s.sp,
      y: tankY + s.yOff
    });
  }
}
/* flames sit at the firebox mouth — offset toward the facing side  */
function addFire(cx, cz, rot, dep, h, baseY, it) {
  const a = -rot * Math.PI / 2;
  // Place flames right over the grate logs at center of open firebox (z = +0.06 * dep)
  const ox = Math.sin(a) * dep * 0.06, oz = Math.cos(a) * dep * 0.06;
  const fy = (baseY || 0) + Math.min(9.5, Math.max(4, h * 0.17));
  const cones = [];
  const cols = ['#ff5a1f', '#ffa03d', '#ffe08a'];
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(2.4 - i * 0.5, 7.5 - i * 1.5, 6), glowMat(cols[i]));
    c.position.set(cx + ox + (i - 1) * 1.6 * Math.cos(a), fy,
                   cz + oz - (i - 1) * 1.6 * Math.sin(a));
    group.add(c); cones.push(c);
  }
  // Use the fixed PointLight pool instead of adding extra dynamic PointLights (avoids shader recompilation)
  const lightSrc = {
    id: (it && it.id !== undefined) ? 'fire_' + it.id : undefined,
    it: null,
    x: cx + Math.sin(a) * dep * 0.35,
    y: fy + 6,
    z: cz + Math.cos(a) * dep * 0.35,
    power: 0.9,
    on: true,
    isFire: true
  };
  if (HP.world3d && Array.isArray(HP.world3d.lamps)) {
    HP.world3d.lamps.push(lightSrc);
  }
  const f = { cones, lightSrc, on: true, x: cx, z: cz, y: fy };
  fires.push(f);
  // Interaction prompt placed cleanly in front of the hearth opening
  L.interactables.push({ x: cx + Math.sin(a) * dep * 0.45, y: baseY || 0, z: cz + Math.cos(a) * dep * 0.45, kind: 'fire', ref: f });
}
function addScreen(cx, cz, rot, screenW, screenH, offZ, iy, baseY) {
  const m = glowMat('#08090b');
  const s = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), m);
  s.position.set(cx, (baseY || 0) + (iy !== undefined ? iy : 25), cz);
  s.rotation.y = -rot * Math.PI / 2;
  const fwd = new THREE.Vector3(0, 0, offZ !== undefined ? offZ : 0.8).applyEuler(s.rotation);
  s.position.add(fwd);
  group.add(s);
  const sc = { mat: m, on: false, mesh: s, x: cx, z: cz };
  screens.push(sc);
  L.interactables.push({ x: cx, y: baseY || 0, z: cz, kind: 'tv', ref: sc });
}
function addLampBulb(cx, cy, cz, it, cfg) {
  /* nearest world light source → this lamp's switch controls it */
  let src = null;
  if (it && it.id !== undefined) {
    src = (HP.world3d.lamps || []).find(s => s.id === it.id);
  }
  if (!src) {
    let bd = 10 * 10;
    for (const s of (HP.world3d.lamps || [])) {
      if (Math.abs((s.y || 0) - cy) > 40) continue;
      const d = (s.x - cx) ** 2 + (s.z - cz) ** 2;
      if (d < bd) { bd = d; src = s; }
    }
  }
  const col = (cfg && cfg.color) || '#ffe3a8';
  let geom;
  if (cfg && cfg.geo === 'cylinder') {
    // Sconce: slender vertical filament inside glass cylinder
    geom = new THREE.CylinderGeometry(cfg.r || 0.38, cfg.r || 0.38, cfg.len || 12, 8);
  } else if (cfg && cfg.geo === 'cylinderX') {
    // Banker lamp: horizontal tubular bulb inside green shade
    geom = new THREE.CylinderGeometry(cfg.r || 0.35, cfg.r || 0.35, cfg.len || 5, 8).rotateZ(Math.PI / 2);
    if (cfg.rot) geom.rotateY(-cfg.rot * Math.PI / 2);
  } else {
    const rad = (cfg && cfg.r) || 0.9;
    geom = new THREE.SphereGeometry(rad, 8, 6);
  }
  const mesh = new THREE.Mesh(geom, glowMat(col));
  mesh.position.set(cx, cy, cz); mesh.visible = false;
  group.add(mesh);
  let shadeMesh = null;
  if (it && /^floorlamp$/i.test(it.type)) {
    shadeMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(5.1, 6.0, 15.8, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffdf9e, transparent: true, opacity: 0.42, side: THREE.DoubleSide })
    );
    shadeMesh.position.set(cx, cy + 2.1, cz);
    shadeMesh.visible = false;
    group.add(shadeMesh);
  }
  const isOn = it ? (it.on !== false) : true;
  const lp = { mesh, shadeMesh, src, on: isOn, x: cx, z: cz, it };
  if (src) src.lampRef = lp;
  lampBulbs.push(lp);
  L.interactables.push({ x: cx, z: cz, kind: 'lamp', ref: lp });
}

function addShoeCabinet(cx, cz, rot, w, dep, h, color, it, baseY) {
  const g = new THREE.Group();
  g.position.set(cx, baseY || 0, cz);
  g.rotation.y = -rot * Math.PI / 2;
  group.add(g);

  const cabCol = color || '#8a6844';
  const woodMat = HP.graphics3d ? HP.graphics3d.material('wood', cabCol) : std(cabCol, { roughness: 0.65 });
  const flutedMat = HP.graphics3d ? HP.graphics3d.material('wood', HP.shade(cabCol, 0.88)) : std(HP.shade(cabCol, 0.88), { roughness: 0.7 });
  const brassMat = std('#c9a44e', { roughness: 0.22, metalness: 0.9 });
  const darkMat = std('#181b1e', { roughness: 0.9 });

  const slimDep = Math.max(6, dep * 0.48);
  const frontZ = slimDep / 2;

  // 2 columns x 2 tiers of tilt-out compartments
  const colW = (w * 0.90 - 1.6) / 2;
  const tierH = (h * 0.72 - 1.8) / 2;

  const pivots = [];
  const shoeStyles = [
    { shoe: '#f8fafc', sole: '#cbd5e1' }, // white sneaker
    { shoe: '#1e2124', sole: '#475569' }, // black dress shoe
    { shoe: '#78350f', sole: '#451a03' }, // brown oxford
    { shoe: '#1e3a8a', sole: '#f8fafc' }, // navy casual
  ];

  let shoeIdx = 0;
  for (const dx of [-colW / 2 - 0.8, colW / 2 + 0.8]) {
    for (const dy0 of [h * 0.165 + 0.6, h * 0.165 + tierH + 1.4]) {
      const p = new THREE.Group();
      p.position.set(dx, dy0, frontZ);
      g.add(p);
      pivots.push(p);

      // 1. Raised door panel with perimeter margin (leaves crisp dark reveals)
      const doorPanel = box(colW - 0.6, tierH - 0.6, 1.0, woodMat);
      doorPanel.position.set(0, tierH / 2, 0.5);
      p.add(doorPanel);

      // 2. Framed vertical fluting in center of door
      const flutedW = colW - 3.2;
      const flutedH = tierH - 3.0;
      const nRibs = 4;
      for (let i = 0; i < nRibs; i++) {
        const rx = -flutedW / 2 + (i + 0.5) * (flutedW / nRibs);
        const rib = box(flutedW / nRibs * 0.55, flutedH, 0.4, flutedMat);
        rib.position.set(rx, tierH / 2, 1.1);
        p.add(rib);
      }

      // 3. PROMINENT BOLD BRUSHED BRASS HORIZONTAL BAR HANDLE
      const handleW = Math.max(7.5, colW * 0.48);
      for (const px of [-handleW / 2 + 0.8, handleW / 2 - 0.8]) {
        const post = box(0.8, 0.8, 1.4, brassMat);
        post.position.set(px, tierH - 1.8, 1.6);
        p.add(post);
      }
      const bar = box(handleW, 1.2, 1.0, brassMat);
      bar.position.set(0, tierH - 1.8, 2.4);
      p.add(bar);

      // 4. Internal shoe rack shelf & shoes inside compartment
      const shelf = box(colW - 1.6, 0.6, 5.2, darkMat);
      shelf.position.set(0, 0.6, -2.4);
      shelf.rotation.x = -0.22;
      p.add(shelf);

      // Pair of shoes on the shelf
      const style = shoeStyles[shoeIdx++ % shoeStyles.length];
      const sMat = std(style.shoe, { roughness: 0.6 });
      const bMat = std(style.sole, { roughness: 0.8 });
      for (const sx of [-colW * 0.22, colW * 0.22]) {
        const sole = box(2.6, 0.5, 4.2, bMat);
        sole.position.set(sx, 1.0, -2.4);
        sole.rotation.x = -0.22;
        p.add(sole);
        const upper = box(2.4, 1.2, 3.8, sMat);
        upper.position.set(sx, 1.7, -2.4);
        upper.rotation.x = -0.22;
        p.add(upper);
        const toe = box(2.2, 0.8, 1.8, sMat);
        toe.position.set(sx, 1.5, -0.9);
        toe.rotation.x = -0.22;
        p.add(toe);
      }
    }
  }

  const isOpen = !!(it && it.open);
  if (isOpen) {
    for (const p of pivots) p.rotation.x = 1.16;
  }

  const sc = {
    g,
    pivots,
    open: isOpen,
    curOpen: isOpen ? 1 : 0,
    x: cx,
    z: cz,
    rot: rot,
    it
  };
  shoeCabinets.push(sc);

  const fwd = new THREE.Vector3(0, 0, frontZ + 4).applyEuler(new THREE.Euler(0, -rot * Math.PI / 2, 0));
  L.interactables.push({
    x: cx + fwd.x,
    z: cz + fwd.z,
    y: (baseY || 0) + h * 0.5,
    kind: 'shoecab',
    ref: sc
  });
}

/* ---------- creatures ---------- */
function addBirds() {
  const bodyMat = std('#e2e8f0', { roughness: 0.9 });
  const wingMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.9, side: THREE.DoubleSide });
  const mkWing = (dir) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, -0.70);
    sh.lineTo(1.8 * dir, -0.42);
    sh.lineTo(4.0 * dir, 0.55);
    sh.lineTo(2.0 * dir, 0.85);
    sh.lineTo(0, 0.65);
    sh.closePath();
    const g = new THREE.ShapeGeometry(sh);
    g.rotateX(-Math.PI / 2);
    return g;
  };
  const lwGeo = mkWing(-1), rwGeo = mkWing(1);
  const tailSh = new THREE.Shape();
  tailSh.moveTo(0, 0.8); tailSh.lineTo(-0.7, 2.2); tailSh.lineTo(0.7, 2.2); tailSh.closePath();
  const tailGeo = new THREE.ShapeGeometry(tailSh); tailGeo.rotateX(-Math.PI / 2);
  const bodyGeo = new THREE.SphereGeometry(0.62, 6, 5);
  bodyGeo.scale(0.85, 0.72, 2.3);
  const beakGeo = new THREE.ConeGeometry(0.22, 0.75, 5);
  beakGeo.rotateX(Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    const beak = new THREE.Mesh(beakGeo, wingMat); beak.position.z = 1.65;
    const tail = new THREE.Mesh(tailGeo, wingMat);
    const wl = new THREE.Mesh(lwGeo, wingMat);
    const wr = new THREE.Mesh(rwGeo, wingMat);
    b.add(body, beak, tail, wl, wr);
    group.add(b);
    birds.push({ g: b, wl, wr, r: 230 + i * 42, h: 175 + (i % 3) * 24,
      ph: i * 1.05, sp: (0.05 + (i % 3) * 0.012) * (i % 2 ? 1 : -1) });
  }
}
function addButterflies(spots) {
  const cols = ['#ff9f43', '#a06bff', '#ffd166', '#7bdff2', '#f78fb3', '#b8e986'];
  for (let i = 0; i < spots.length; i++) {
    const b = new THREE.Group();
    const wm = new THREE.MeshStandardMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide });
    const wl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), wm); wl.position.x = -0.8;
    const wr = wl.clone(); wr.position.x = 0.8;
    b.add(wl, wr);
    group.add(b);
    flies.push({ g: b, wl, wr, ax: spots[i].x, az: spots[i].z, ph: i * 1.7, wph: i * 2.3 });
  }
}
/* ---------- the dog ---------- */
function addDog(home) {
  const fur = std('#a8763e'), dark = std('#7d5527'), pink = std('#d98a8a');
  const g = new THREE.Group();
  const body = box(9, 7, 16, fur); body.position.y = 8.5;
  const chest = box(8.5, 6, 5, fur); chest.position.set(0, 8, 7);
  const head = new THREE.Group();
  const skull = box(6, 5.5, 6, fur);
  const snout = box(3.5, 3, 4, dark); snout.position.set(0, -1, 4.5);
  const nose = box(1.6, 1.4, 1, new THREE.MeshBasicMaterial({ color: 0x1a1512 }));
  nose.position.set(0, -0.8, 6.6);
  const eL = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3, 4), dark);
  eL.position.set(-2, 3.4, -0.5); eL.rotation.z = 0.25;
  const eR = eL.clone(); eR.position.x = 2; eR.rotation.z = -0.25;
  const tongue = box(1.4, 0.5, 2.5, pink); tongue.position.set(0, -2.2, 5); tongue.visible = false;
  head.add(skull, snout, nose, eL, eR, tongue);
  head.position.set(0, 12, 9.5);
  const legs = [];
  for (const [lx, lz] of [[-3, 5.5], [3, 5.5], [-3, -5.5], [3, -5.5]]) {
    const leg = box(2.2, 6.5, 2.2, dark);
    leg.geometry.translate(0, -3.25, 0);            // pivot at hip
    leg.position.set(lx, 6.5, lz);
    g.add(leg); legs.push(leg);
  }
  const tail = box(1.5, 1.5, 6, dark);
  tail.geometry.translate(0, 0, -3);
  tail.position.set(0, 10.5, -8); tail.rotation.x = 0.7;
  g.add(body, chest, head, tail);
  g.position.set(home.x, 0, home.z);
  group.add(g);
  dog = { g, head, legs, tail, tongue, home,
    x: home.x, z: home.z, tx: home.x, tz: home.z,
    state: 'idle', t: 2 + Math.random() * 3, yaw: 0, napUntil: 0 };
}
/* tiny circle-vs-box step — same colliders as the player, so the dog
   can't ghost through walls/furniture (doors block it too)          */
function dogStep(nx, nz) {
  const R = 5;
  for (const b of (HP.world3d.colliders || [])) {
    if (nx < b.x0 - R || nx > b.x1 + R || nz < b.z0 - R || nz > b.z1 + R) continue;
    if (b.y0 > 26) continue;                      // above dog height
    const lx = Math.max(b.x0, Math.min(nx, b.x1)), lz = Math.max(b.z0, Math.min(nz, b.z1));
    const dx = nx - lx, dz = nz - lz, d2 = dx * dx + dz * dz;
    if (d2 >= R * R) continue;
    if (d2 > 1e-6) { const d = Math.sqrt(d2); nx = lx + dx / d * R; nz = lz + dz / d * R; }
    else {
      const exL = nx - b.x0 + R, exR = b.x1 - nx + R, exT = nz - b.z0 + R, exB = b.z1 - nz + R;
      const m = Math.min(exL, exR, exT, exB);
      if (m === exL) nx = b.x0 - R; else if (m === exR) nx = b.x1 + R;
      else if (m === exT) nz = b.z0 - R; else nz = b.z1 + R;
    }
  }
  /* the dog doesn't swim — pool water reads as an obstacle           */
  for (const a of (HP.world3d.waterAreas || [])) {
    if (nx > a.x0 - R && nx < a.x1 + R && nz > a.z0 - R && nz < a.z1 + R) {
      const dl = nx - a.x0 + R, dr = a.x1 - nx + R, dtp = nz - a.z0 + R, db = a.z1 - nz + R;
      const m = Math.min(dl, dr, dtp, db);
      if (m === dl) nx = a.x0 - R; else if (m === dr) nx = a.x1 + R;
      else if (m === dtp) nz = a.z0 - R; else nz = a.z1 + R;
    }
  }
  return [nx, nz];
}
/* closed door leaves also block the dog */
function dogDoorBlock(nx, nz) {
  const R = 5;
  for (const d of (HP.world3d.doorPivots || [])) {
    if (d.window || d.open > 0.5) continue;
    const a = d.a;
    if (nx > a.x0 - R && nx < a.x1 + R && nz > a.z0 - R && nz < a.z1 + R) {
      if (a.d === 'h') nz = nz < a.cz ? a.z0 - R : a.z1 + R;
      else nx = nx < a.cx ? a.x0 - R : a.x1 + R;
    }
  }
  return [nx, nz];
}
function dogTick(dt, t, s, cam) {
  if (!dog) return;
  const px = cam ? cam.x : 1e9, pz = cam ? cam.z : 1e9;
  const dp = Math.hypot(px - dog.x, pz - dog.z);
  const night = (s && s.night) || 0;
  /* state */
  dog.t -= dt;
  if (dog.state === 'nap') {
    if (night < 0.4 && dog.t <= 0) { dog.state = 'idle'; dog.t = 1; }
  } else if (dp < 120 && dog.state !== 'follow') {          // see the player → join
    dog.state = 'follow'; dog.t = 20;
  } else if (dog.state === 'follow' && (dp > 220 || dog.t <= 0)) {
    dog.state = 'idle'; dog.t = 0;
  } else if (dog.state === 'idle' && dog.t <= 0) {
    /* night → nap at the dog house; day → wander or nap sometimes    */
    if (night > 0.5 || Math.random() < 0.2) {
      dog.state = 'gonap'; dog.tx = dog.home.x; dog.tz = dog.home.z;
    } else {
      dog.state = 'walk';
      dog.tx = dog.home.x + (Math.random() - 0.5) * 420;
      dog.tz = dog.home.z + (Math.random() - 0.5) * 420;
    }
  } else if (dog.state === 'walk' || dog.state === 'gonap' || dog.state === 'follow') {
    /* steer */
    if (dog.state === 'follow') { dog.tx = px; dog.tz = pz; }
    const dx = dog.tx - dog.x, dz = dog.tz - dog.z, dist = Math.hypot(dx, dz);
    const arrive = dog.state === 'follow' ? 26 : 12;
    if (dist < arrive) {
      if (dog.state === 'gonap') { dog.state = 'nap'; dog.t = 14 + Math.random() * 20; }
      else if (dog.state === 'walk') { dog.state = 'idle'; dog.t = 1.5 + Math.random() * 4; }
      /* follow: just stand and look at the player                    */
    } else {
      const sp = dog.state === 'follow' ? 120 : 55;         // hurry to catch up!
      let nx = dog.x + dx / dist * sp * dt, nz = dog.z + dz / dist * sp * dt;
      [nx, nz] = dogStep(nx, nz); [nx, nz] = dogDoorBlock(nx, nz);
      const moved = Math.hypot(nx - dog.x, nz - dog.z);
      dog.x = nx; dog.z = nz;
      dog.yaw = Math.atan2(dx, dz);
      /* stuck → give up on this target                               */
      if (moved < sp * dt * 0.2) {
        if (dog.state === 'follow') { dog.state = 'idle'; dog.t = 0; }
        else { dog.state = 'idle'; dog.t = 1 + Math.random() * 2; }
      }
    }
  }
  /* pose */
  const walking = dog.state === 'walk' || dog.state === 'gonap' ||
    (dog.state === 'follow' && Math.hypot(dog.tx - dog.x, dog.tz - dog.z) > 26);
  const napping = dog.state === 'nap';
  const g = dog.g;
  g.position.set(dog.x, napping ? -1.5 : 0, dog.z);
  if (!napping) g.rotation.y += (((dog.yaw - g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 8);
  g.rotation.z = napping ? 0.5 : g.rotation.z * 0.9;
  for (let i = 0; i < 4; i++) {
    const ph = walking ? t * 11 + (i % 2 ? Math.PI : 0) : 0;
    dog.legs[i].rotation.x = walking ? Math.sin(ph) * 0.55 : 0;
    dog.legs[i].scale.y = napping ? 0.35 : 1;
  }
  /* tail wag: excited when following or being approached             */
  dog.tail.rotation.y = (dog.state === 'follow' || dp < 60) ? Math.sin(t * 14) * 0.5 : Math.sin(t * 4) * 0.15;
  /* head looks at the player when close, down when napping           */
  const wantY = dp < 150 ? Math.atan2(px - dog.x, pz - dog.z) - g.rotation.y : 0;
  dog.head.rotation.y += (((wantY + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 5);
  dog.head.rotation.x = napping ? 0.5 : (dp < 60 ? -0.15 : 0);
  dog.tongue.visible = dog.state === 'follow' && dp < 60;
}
function addFireflies() {
  const n = 22, pos = new Float32Array(n * 3);
  fireflySeed = [];
  const gw = (HP.GRID_W || 62) * C(), gh = (HP.GRID_H || 40) * C();
  for (let i = 0; i < n; i++) {
    const x = (0.05 + Math.random() * 0.90) * gw, z = (0.05 + Math.random() * 0.90) * gh;
    fireflySeed.push({ x, z, ph: Math.random() * 9, sp: 0.3 + Math.random() * 0.5 });
    pos[i * 3] = x; pos[i * 3 + 1] = 10 + Math.random() * 14; pos[i * 3 + 2] = z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  let map = null;
  try {
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const cx2 = cv.getContext && cv.getContext('2d');
    if (cx2) {
      const gr = cx2.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,240,160,1)'); gr.addColorStop(0.4, 'rgba(200,220,90,.6)');
      gr.addColorStop(1, 'rgba(200,220,90,0)');
      cx2.fillStyle = gr; cx2.fillRect(0, 0, 32, 32);
      map = new THREE.CanvasTexture(cv);
    }
  } catch (_) {}
  fireflies = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 4, map, color: 0xf0e68c, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  fireflies.visible = false;
  group.add(fireflies);
}

/* ---------- build ---------- */
/* entries: [{it, f(ootprint px cells), h(px height), hangs}] — all
   furniture, hung pieces included (clock lives on the wall)        */
L.build = function (g, entries) {
  group = g;
  spinners.length = clockHands.length = fish.length = fires.length =
    screens.length = lampBulbs.length = birds.length = flies.length = shoeCabinets.length = 0;
  fireflies = null; fireflySeed = null;
  L.interactables = [];
  const hi = HP.graphics3d && HP.graphics3d.tier !== 'low';
  const spots = [];
  L.ambience = { water: [], fire: [], fan: [] };
  let dogHome = null, dogHomePriority = 0;
  const allLevels = (HP.state && HP.state.levels && HP.state.levels.length) ? HP.state.levels : [HP.cur()];
  const envCache = new Map();
  const getLvlInfo = (it) => {
    const lIdx = (it && it._levelIdx !== undefined) ? it._levelIdx : ((HP.state && HP.state.level) || 0);
    const itemLvl = (allLevels && allLevels[lIdx]) || (HP.cur && HP.cur()) || null;
    const itemWalls = (itemLvl && itemLvl.walls) || {};
    if (!envCache.has(lIdx)) {
      let ge = null;
      if (HP.state && HP.computeRegions && itemLvl) {
        try {
          const cr = HP.computeRegions(itemLvl);
          if (cr && cr.regionOf && cr.regions) {
            ge = {
              C: C(),
              rAt: (x, y) => (x < 0 || y < 0 || x >= HP.GRID_W || y >= HP.GRID_H) ? -1 : cr.regionOf[y * HP.GRID_W + x],
              rsz: id => id >= 0 && cr.regions[id] ? cr.regions[id].cells.length : 1e9
            };
          }
        } catch (err) {}
      }
      envCache.set(lIdx, ge);
    }
    return { itemLvl, itemWalls, geomEnv: envCache.get(lIdx) };
  };
  for (const e of entries) {
    const it = e.it, f = e.f;
    const bY = e.baseY !== undefined ? e.baseY : (it._baseY || 0);
    const { itemWalls: lvlWalls, geomEnv } = getLvlInfo(it);
    const cx = (f.x + f.w / 2) * C(), cz = (f.y + f.h / 2) * C();
    const t = it.type.toLowerCase();
    const w = Math.max(3, f.w * C() - 3);
    const dep = Math.max(3, f.h * C() - 3);
    if (/ceilingfan/.test(t)) { addFan(cx, cz, bY); L.ambience.fan.push({ x: cx, y: bY, z: cz }); }
    else if (/clock|^clk/.test(t)) {
      /* hung clocks face out of the wall they hang on */
      const isHung = (HP.state && HP.itemDef(it.type).hangs) || it.hang;
      const hang = it.hang || (HP.state && isHung &&
        HP.hangSide(it.type, it.x, it.y, it.rot || 0, { w: it.w || f.w, h: it.h || f.h }, lvlWalls));
      const rot = hang === 'n' ? 0 : hang === 's' ? 2 :
        hang === 'w' ? 3 : hang === 'e' ? 1 : it.rot || 0;
      if (hang) {
        const IN = HP.geom3d && HP.geom3d.wallInset ? HP.geom3d.wallInset(hang, f, lvlWalls, geomEnv) : 7.0;
        let mx = cx, mz = cz;
        if (hang === 'n') mz = f.y * C() + IN;
        else if (hang === 's') mz = (f.y + f.h) * C() - IN;
        else if (hang === 'w') mx = f.x * C() + IN;
        else if (hang === 'e') mx = (f.x + f.w) * C() - IN;
        addClock(mx, mz, rot, w, 0.4, true, undefined, bY);
      } else {
        const def = HP.itemDef ? HP.itemDef(it.type) : null;
        const unrotW = Math.max(3, ((it.w || (def && def.w) || 1)) * C() - 3);
        const unrotH = Math.max(3, ((it.h || (def && def.h) || 1)) * C() - 3);
        const isGrand = /^clock$|clkgrand|grandfather/i.test(t);
        const dialRadius = isGrand ? Math.min(unrotW * 0.22, 4.4) : Math.min(unrotW, 26) * 0.42;
        const dialOffset = isGrand ? unrotH * 0.235 : unrotH * 0.275 + 0.3;
        addClock(cx, cz, it.rot || 0, unrotW, dialOffset, false, dialRadius, bY, isGrand ? 41.3 : undefined);
      }
    }
    else if (/walltv|sconce/.test(t)) {
      /* wall-mounted screen / sconce — mount on the wall face          */
      const hang = it.hang || (HP.state && HP.hangSide(it.type, it.x, it.y,
        it.rot || 0, { w: it.w || f.w, h: it.h || f.h }, lvlWalls));
      const rot = hang === 'n' ? 0 : hang === 's' ? 2 :
        hang === 'w' ? 3 : hang === 'e' ? 1 : it.rot || 0;
      const IN = HP.geom3d && HP.geom3d.wallInset ? HP.geom3d.wallInset(hang, f, lvlWalls, geomEnv) : 7.0;
      let mx = cx, mz = cz;
      if (hang === 'n') mz = f.y * C() + IN;
      else if (hang === 's') mz = (f.y + f.h) * C() - IN;
      else if (hang === 'w') mx = f.x * C() + IN;
      else if (hang === 'e') mx = (f.x + f.w) * C() - IN;
      if (/walltv/.test(t)) addScreen(mx, mz, rot, 47.6, 26.4, 2.52, 42.0, bY);
      else {
        const def = HP.itemDef ? HP.itemDef(it.type) : null;
        const lt = HP.getLampLightTransform ? HP.getLampLightTransform(it, def, f, C(), lvlWalls, geomEnv) : null;
        if (lt) addLampBulb(lt.x, lt.y, lt.z, it, lt);
        else addLampBulb(mx, bY + 38, mz, it);
      }
    }
    else if (/aquarium/.test(t)) addFish(cx, cz, w, dep, bY + e.h * 0.73);
    else if (/fireplace/.test(t)) { addFire(cx, cz, it.rot || 0, dep, e.h, bY, it); L.ambience.fire.push({ x: cx, y: bY, z: cz }); }
    else if (/pool$|pond|jacuzzi|hottub/.test(t)) L.ambience.water.push({ x: cx, y: bY, z: cz });
    else if (/tvwall/.test(t)) {
      // 85" 4K OLED screen centered on slatted feature wall: exact bezel width=105.0, height=24.0, y=33.28
      addScreen(cx, cz, it.rot || 0, 105.0, 24.0, -0.355 * dep + 0.05, 33.28, bY);
    }
    else if (/tvstand|media.*console/.test(t)) {
      // 65" 16:9 OLED TV screen on lowline credenza: exact bezel width=32.8, height=18.4, y=25.2
      addScreen(cx, cz, it.rot || 0, 32.8, 18.4, -0.04 * dep + 0.42, 25.2, bY);
    }
    else if (/^shoecab$/i.test(t)) {
      const def = HP.itemDef ? HP.itemDef(it.type) : null;
      const unrotW = Math.max(3, (it.w || (def && def.w) || 2) * C() - 3);
      const unrotDep = Math.max(3, (it.h || (def && def.h) || 1) * C() - 3);
      const col = (it.colors && it.colors[0]) || (def && def.colors && def.colors[0]) || '#8a6844';
      addShoeCabinet(cx, cz, it.rot || 0, unrotW, unrotDep, e.h || 32, col, it, bY);
    }
    else if (/lamp|torch|candle|lantern|light/i.test(t)) {
      const def = HP.itemDef ? HP.itemDef(it.type) : null;
      const lt = HP.getLampLightTransform ? HP.getLampLightTransform(it, def, f, C(), lvlWalls, geomEnv) : null;
      if (lt) {
        addLampBulb(lt.x, lt.y, lt.z, it, lt);
      } else {
        const bulbY = bY + (/torch/i.test(t) ? 30 : (/nightlight/i.test(t) ? 6 : Math.max(12, e.h * 0.8)));
        addLampBulb(cx, bulbY, cz, it);
      }
    }
    if (hi && /flower|veggie|tomato|seedling|rose/i.test(t)) spots.push({ x: cx, z: cz });
    if (bY < 20 && (/doghouse|kennel/.test(t) || /petbed/.test(t))) {
      const prio = /doghouse|kennel/.test(t) ? 2 : 1;
      if (prio >= dogHomePriority) {
        dogHomePriority = prio;
        dogHome = { x: cx, z: cz + (f.h * C()) / 2 + 14 };
      }
    }
  }
  if (hi) {
    addBirds();
    addButterflies(spots.slice(0, 6));
  }
  addFireflies();
  /* the dog — lives at the dog house, else wanders the yard          */
  dog = null;
  if (HP.world3d) {
    const rawHome = dogHome || { x: HP.GRID_W * C() / 2, z: HP.GRID_H * C() * 0.75 };
    const [sx, sz] = HP.world3d.colliders ? dogStep(rawHome.x, rawHome.z) : [rawHome.x, rawHome.z];
    addDog({ x: sx, z: sz });
  }
};

/* ---------- per-frame ---------- */
const _v = new THREE.Vector3();
L.tick = function (dt, t, s, cam) {
  if (!group) return;
  for (const o of spinners) o.obj.rotation.y += dt * o.speed;
  const hour = s.hour !== undefined ? s.hour : (HP.world3d.time ? HP.world3d.time.hour : 12);
  for (const ch of clockHands) {
    const hFrac = (hour % 12) / 12, mFrac = (hour % 1);
    ch.hour.rotation.z = -hFrac * Math.PI * 2;
    ch.minute.rotation.z = -mFrac * Math.PI * 2;
    if (ch.second) {
      const sFrac = (t % 60) / 60;
      ch.second.rotation.z = -sFrac * Math.PI * 2;
    }
  }
  for (const f of fish) {
    const a = t * f.sp + f.ph;
    const px = f.cx + Math.cos(a) * f.rx;
    const pz = f.cz + Math.sin(a) * f.rz;
    f.mesh.position.set(px, f.y + Math.sin(t * 1.5 + f.ph) * 1.0, pz);
    const dx = -Math.sin(a) * f.rx;
    const dz = Math.cos(a) * f.rz;
    f.mesh.rotation.y = Math.atan2(-dz, dx);
    if (f.tail) f.tail.rotation.y = Math.sin(t * 9 * f.sp + f.ph) * 0.45;
  }
  for (const f of fires) {
    if (f.light) f.light.intensity = f.on ? 0.65 + Math.sin(t * 11 + f.x) * 0.15 + Math.sin(t * 23) * 0.08 : 0;
    if (f.lightSrc) {
      f.lightSrc.on = f.on;
      f.lightSrc.power = f.on ? 0.85 + Math.sin(t * 11 + f.x) * 0.12 : 0;
    }
    for (let i = 0; i < f.cones.length; i++) {
      const c = f.cones[i];
      c.visible = f.on;
      if (f.on) c.scale.y = 0.8 + Math.abs(Math.sin(t * (7 + i * 3) + i)) * 0.5;
    }
  }
  for (const sc of screens) {
    if (!sc.on) { sc.mat.color.set(0x08090b); continue; }
    const n = Math.sin(t * 13) * 0.5 + Math.sin(t * 4.7) * 0.5;   // channel shimmer
    sc.mat.color.setRGB(0.25 + n * 0.1, 0.3 + n * 0.12, 0.42 + n * 0.12);
  }
  const night = s.night || 0;
  for (const lp of lampBulbs) {
    if (lp.src) lp.src.on = lp.on;
    const vis = lp.on && night > 0.15;
    lp.mesh.visible = vis;
    if (lp.shadeMesh) lp.shadeMesh.visible = vis;
  }
  for (const sc of shoeCabinets) {
    const target = sc.open ? 1 : 0;
    if (Math.abs(target - sc.curOpen) > 0.001) {
      sc.curOpen += (target - sc.curOpen) * Math.min(1, dt * 8);
      const tilt = sc.curOpen * 1.16;
      for (const p of sc.pivots) {
        p.rotation.x = tilt;
      }
    }
  }
  /* creatures */
  const camX = cam ? cam.x : 0, camZ = cam ? cam.z : 0;
  if (birds.length) {
    const show = (s.day || 0) > 0.2;
    for (const b of birds) {
      b.g.visible = show;
      if (!show) continue;
      const a = t * b.sp + b.ph;
      b.g.position.set(camX + Math.cos(a) * b.r, b.h + Math.sin(t * 0.4 + b.ph) * 4,
        camZ + Math.sin(a) * b.r);
      b.g.rotation.y = -a + (b.sp > 0 ? 0 : Math.PI);
      b.g.rotation.z = b.sp > 0 ? 0.14 : -0.14;
      const flap = Math.sin(t * 7.5 + b.ph) * 0.42 - 0.12;
      b.wl.rotation.z = flap; b.wr.rotation.z = -flap;
    }
  }
  for (const f of flies) {
    const show = (s.day || 0) > 0.25;
    f.g.visible = show;
    if (!show) continue;
    const a = t * 0.35 + f.wph;
    f.g.position.set(f.ax + Math.cos(a) * 22 + Math.sin(t * 1.3 + f.ph) * 6,
      15 + Math.sin(t * 1.7 + f.ph) * 5, f.az + Math.sin(a * 1.3) * 22);
    const flap = Math.sin(t * 16 + f.ph) * 1.1;
    f.wl.rotation.y = flap; f.wr.rotation.y = -flap;
  }
  if (fireflies) {
    fireflies.visible = night > 0.25;
    if (fireflies.visible) {
      const p = fireflies.geometry.attributes.position;
      for (let i = 0; i < fireflySeed.length; i++) {
        const sd = fireflySeed[i];
        p.array[i * 3] = sd.x + Math.sin(t * sd.sp + sd.ph) * 12;
        p.array[i * 3 + 1] = 10 + Math.sin(t * 0.6 + sd.ph * 2) * 5;
        p.array[i * 3 + 2] = sd.z + Math.cos(t * sd.sp * 0.8 + sd.ph) * 12;
      }
      p.needsUpdate = true;
      fireflies.material.opacity = 0.55 + Math.sin(t * 3) * 0.3;
    }
  }
  dogTick(dt, t, s, cam);
};

/* ---------- E interaction ---------- */
L.label = function (g2) {
  if (g2.kind === 'shoecab') {
    return (g2.ref.open ? 'close ' : 'open ') + 'shoe cabinet';
  }
  const on = g2.kind === 'tv' ? g2.ref.on : g2.ref.on;
  const name = g2.kind === 'lamp' ? 'lamp' : g2.kind === 'tv' ? 'TV' : 'fireplace';
  return (on ? 'turn off ' : 'turn on ') + name;
};
L.toggle = function (g2) {
  const r = g2.ref;
  if (g2.kind === 'shoecab') {
    r.open = !r.open;
    if (r.it) r.it.open = r.open;
    if (HP.sound3d && HP.sound3d.door) HP.sound3d.door(r.open);
    return;
  }
  r.on = !r.on;
  if (g2.kind === 'fire') {
    if (r.light) r.light.intensity = r.on ? 1 : 0;
    if (r.lightSrc) r.lightSrc.on = r.on;
    if (r.cones) for (const c of r.cones) c.visible = r.on;
    if (HP.world3d && HP.world3d.syncLamps) HP.world3d.syncLamps();
  } else if (g2.kind === 'lamp') {
    if (r.it) r.it.on = r.on;
    if (r.src) {
      r.src.on = r.on;
      if (r.src.it) r.src.it.on = r.on;
    }
    if (r.mesh) r.mesh.visible = r.on;
    for (const s of (HP.world3d.lamps || [])) {
      if (s === r.src || (r.it && r.it.id !== undefined && s.id === r.it.id)) {
        s.on = r.on;
        if (s.it) s.it.on = r.on;
      }
    }
    for (const lb of lampBulbs) {
      if (lb === r || (r.it && r.it.id !== undefined && lb.it && lb.it.id === r.it.id)) {
        lb.on = r.on;
        if (lb.mesh) lb.mesh.visible = r.on;
        if (lb.src) lb.src.on = r.on;
        if (lb.it) lb.it.on = r.on;
      }
    }
    if (!r.on && HP.world3d && HP.world3d.turnOffLamp) HP.world3d.turnOffLamp(r);
    if (HP.world3d && HP.world3d.syncLamps) HP.world3d.syncLamps();
  } else if (g2.kind === 'tv') {
    if (!r.on && r.mat) r.mat.color.set(0x08090b);
  }
};
})();
