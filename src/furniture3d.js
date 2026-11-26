/* Low-poly furniture, batched by geometry/material rather than one mesh per part. */
window.HP = window.HP || {};
(function () {
const F = HP.furniture3d = {};
/* bake parts [{geo, matrix, color}] into one indexed geometry with
   per-vertex colour; ranges[i] = [firstVertex, vertexCount] of part i */
const _nm = new THREE.Matrix3(), _col = new THREE.Color();
const _colCache = new Map();
const _whiteRGB = [1, 1, 1];
function getColorRGB(c) {
  if (!c || c === '#ffffff') return _whiteRGB;
  let rgb = _colCache.get(c);
  if (!rgb) {
    _col.set(c);
    rgb = [_col.r, _col.g, _col.b];
    _colCache.set(c, rgb);
  }
  return rgb;
}
function merge(parts) {
  let nv = 0, ni = 0;
  for (const p of parts) { nv += p.geo.attributes.position.count; ni += p.geo.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3),
        uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const ranges = [];
  let vo = 0, io = 0;
  for (const p of parts) {
    const g = p.geo, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    _nm.getNormalMatrix(p.matrix);
    const rgb = getColorRGB(p.color);
    const m = p.matrix.elements;
    const nm = _nm.elements;
    const cr = rgb[0], cg = rgb[1], cb = rgb[2];
    const Pa = P.array, Na = N.array, Ua = U ? U.array : null;
    const count = P.count;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const x = Pa[i3], y = Pa[i3 + 1], z = Pa[i3 + 2];
      const vi = vo + i;
      const vi3 = vi * 3;
      pos[vi3]     = m[0] * x + m[4] * y + m[8]  * z + m[12];
      pos[vi3 + 1] = m[1] * x + m[5] * y + m[9]  * z + m[13];
      pos[vi3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      const nx = Na[i3], ny = Na[i3 + 1], nz = Na[i3 + 2];
      const tnx = nm[0] * nx + nm[3] * ny + nm[6] * nz;
      const tny = nm[1] * nx + nm[4] * ny + nm[7] * nz;
      const tnz = nm[2] * nx + nm[5] * ny + nm[8] * nz;
      const len = Math.sqrt(tnx * tnx + tny * tny + tnz * tnz) || 1;
      nor[vi3]     = tnx / len;
      nor[vi3 + 1] = tny / len;
      nor[vi3 + 2] = tnz / len;
      if (Ua) {
        const i2 = i * 2, vi2 = vi * 2;
        uv[vi2]     = Ua[i2];
        uv[vi2 + 1] = Ua[i2 + 1];
      }
      col[vi3]     = cr;
      col[vi3 + 1] = cg;
      col[vi3 + 2] = cb;
    }
    const I = g.index.array;
    for (let i = 0; i < I.length; i++) idx[io + i] = I[i] + vo;
    ranges.push([vo, count]);
    vo += count; io += I.length;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geometry.setIndex(new THREE.BufferAttribute(idx, 1));
  geometry.computeBoundingSphere();
  return { geometry, ranges };
}
F.merge = merge;
F.builder = function (group) {
  const G = HP.graphics3d, batches = new Map(), refs = new Map();
  const segments = G.current.detail ? 10 : 6;
  function createGableGeometry() {
    const geom = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      -0.5, -0.5,  0.5,
       0.5, -0.5,  0.5,
       0,    0.5,  0.5,
      -0.5, -0.5, -0.5,
       0.5, -0.5, -0.5,
       0,    0.5, -0.5
    ]);
    const indices = new Uint16Array([
      0, 1, 2,
      4, 3, 5,
      3, 4, 1,  3, 1, 0,
      3, 0, 2,  3, 2, 5,
      1, 4, 5,  1, 5, 2
    ]);
    const uvs = new Float32Array([
      0, 0,  1, 0,  0.5, 1,
      0, 0,  1, 0,  0.5, 1
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    geom.computeVertexNormals();
    return geom;
  }
  function createHipRoofGeometry() {
    const geom = new THREE.BufferGeometry();
    const raw = [
      -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.22, 0.5, 0.0,
      -0.5, -0.5,  0.5,   0.22, 0.5,  0.0,  -0.22, 0.5, 0.0,
       0.5, -0.5, -0.5,  -0.5, -0.5, -0.5,  -0.22, 0.5, 0.0,
       0.5, -0.5, -0.5,  -0.22, 0.5,  0.0,   0.22, 0.5, 0.0,
      -0.5, -0.5, -0.5,  -0.5, -0.5,  0.5,  -0.22, 0.5, 0.0,
       0.5, -0.5,  0.5,   0.5, -0.5, -0.5,   0.22, 0.5, 0.0,
      -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5, -0.5, 0.5,
      -0.5, -0.5, -0.5,   0.5, -0.5,  0.5,  -0.5, -0.5, 0.5
    ];
    const vertices = new Float32Array(raw);
    const nTri = raw.length / 9;
    const indices = new Uint16Array(nTri * 3);
    const uvs = new Float32Array(nTri * 6);
    for (let i = 0; i < nTri * 3; i++) {
      indices[i] = i;
      uvs[i * 2] = raw[i * 3] + 0.5;
      uvs[i * 2 + 1] = raw[i * 3 + 2] + 0.5;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    geom.computeVertexNormals();
    return geom;
  }
  function createOakLeafGeometry() {
    const raw = [];
    const pushTri = (a, b, c) => {
      raw.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    };
    // Build 3 clustered faceted scalloped foliage rosettes per instance (natural oak silhouette, no round spheres or sharp star spikes)
    const addRosette = (ox, oy, oz, radScale, hScale, phase) => {
      const S = 9;
      const top = [ox + 0.02 * radScale, oy + 0.44 * hScale, oz - 0.01 * radScale];
      const bot = [ox - 0.02 * radScale, oy - 0.34 * hScale, oz + 0.01 * radScale];
      const eq = [], sh = [];
      for (let i = 0; i < S; i++) {
        const a = (i / S) * Math.PI * 2;
        const wave = 0.86 + 0.14 * Math.sin(a * 3 + phase) + 0.09 * Math.cos(a * 5 - phase);
        const rEq = 0.42 * radScale * wave;
        const rSh = rEq * 0.64;
        const ca = Math.cos(a), sa = Math.sin(a);
        const jitterY = (0.06 * Math.sin(a * 4 + phase * 1.3)) * hScale;
        eq.push([ox + ca * rEq, oy + jitterY, oz + sa * rEq]);
        sh.push([ox + ca * rSh, oy + 0.25 * hScale + jitterY * 0.5, oz + sa * rSh]);
      }
      for (let i = 0; i < S; i++) {
        const j = (i + 1) % S;
        pushTri(eq[i], sh[i], eq[j]);
        pushTri(sh[i], sh[j], eq[j]);
        pushTri(sh[i], top, sh[j]);
        pushTri(eq[j], bot, eq[i]);
      }
    };
    addRosette(0.00, 0.02, 0.00, 0.88, 0.96, 0.2);
    addRosette(0.16, 0.10, -0.11, 0.66, 0.78, 1.7);
    addRosette(-0.15, -0.05, 0.12, 0.68, 0.74, 3.1);

    const geom = new THREE.BufferGeometry();
    const vertices = new Float32Array(raw);
    const vCount = raw.length / 3;
    const indices = new Uint16Array(vCount);
    const uvs = new Float32Array(vCount * 2);
    for (let i = 0; i < vCount; i++) {
      indices[i] = i;
      uvs[i * 2] = vertices[i * 3] + 0.5;
      uvs[i * 2 + 1] = vertices[i * 3 + 2] + 0.5;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    geom.computeVertexNormals();
    return geom;
  }
  function createArchTopGeometry(S) {
    const positions = [], normals = [], uvs = [], indices = [];
    function addQuad(p0, p1, p2, p3, n) {
      const b = positions.length / 3;
      positions.push(...p0, ...p1, ...p2, ...p3);
      normals.push(...n, ...n, ...n, ...n);
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const arcPts = [];
    for (let i = 0; i <= S; i++) {
      const th = (i / S) * Math.PI;
      const y = -0.5 + Math.sin(th);
      arcPts.push({ x: -0.5 * Math.cos(th), y, th });
    }
    const mid = S / 2;
    for (let i = 0; i < mid; i++) {
      const pA = [-0.5, 0.5, 0.5], pB = [arcPts[i].x, arcPts[i].y, 0.5], pC = [arcPts[i + 1].x, arcPts[i + 1].y, 0.5];
      const b = positions.length / 3;
      positions.push(...pA, ...pB, ...pC);
      normals.push(0, 0, 1, 0, 0, 1, 0, 0, 1);
      uvs.push(pA[0] + 0.5, pA[1] + 0.5, pB[0] + 0.5, pB[1] + 0.5, pC[0] + 0.5, pC[1] + 0.5);
      indices.push(b, b + 1, b + 2);
    }
    for (let i = mid; i < S; i++) {
      const pA = [0.5, 0.5, 0.5], pB = [arcPts[i].x, arcPts[i].y, 0.5], pC = [arcPts[i + 1].x, arcPts[i + 1].y, 0.5];
      const b = positions.length / 3;
      positions.push(...pA, ...pB, ...pC);
      normals.push(0, 0, 1, 0, 0, 1, 0, 0, 1);
      uvs.push(pA[0] + 0.5, pA[1] + 0.5, pB[0] + 0.5, pB[1] + 0.5, pC[0] + 0.5, pC[1] + 0.5);
      indices.push(b, b + 1, b + 2);
    }
    for (let i = 0; i < mid; i++) {
      const pA = [-0.5, 0.5, -0.5], pB = [arcPts[i].x, arcPts[i].y, -0.5], pC = [arcPts[i + 1].x, arcPts[i + 1].y, -0.5];
      const b = positions.length / 3;
      positions.push(...pA, ...pB, ...pC);
      normals.push(0, 0, -1, 0, 0, -1, 0, 0, -1);
      uvs.push(pA[0] + 0.5, pA[1] + 0.5, pB[0] + 0.5, pB[1] + 0.5, pC[0] + 0.5, pC[1] + 0.5);
      indices.push(b, b + 2, b + 1);
    }
    for (let i = mid; i < S; i++) {
      const pA = [0.5, 0.5, -0.5], pB = [arcPts[i].x, arcPts[i].y, -0.5], pC = [arcPts[i + 1].x, arcPts[i + 1].y, -0.5];
      const b = positions.length / 3;
      positions.push(...pA, ...pB, ...pC);
      normals.push(0, 0, -1, 0, 0, -1, 0, 0, -1);
      uvs.push(pA[0] + 0.5, pA[1] + 0.5, pB[0] + 0.5, pB[1] + 0.5, pC[0] + 0.5, pC[1] + 0.5);
      indices.push(b, b + 2, b + 1);
    }
    addQuad([-0.5, 0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5], [0, 1, 0]);
    addQuad([-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, -0.5], [-1, 0, 0]);
    addQuad([0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [0.5, -0.5, 0.5], [1, 0, 0]);
    for (let i = 0; i < S; i++) {
      const pt0 = arcPts[i], pt1 = arcPts[i + 1];
      const n0 = [Math.cos(pt0.th), -Math.sin(pt0.th), 0];
      const n1 = [Math.cos(pt1.th), -Math.sin(pt1.th), 0];
      const pA = [pt0.x, pt0.y, -0.5], pB = [pt1.x, pt1.y, -0.5], pC = [pt1.x, pt1.y, 0.5], pD = [pt0.x, pt0.y, 0.5];
      const b = positions.length / 3;
      positions.push(...pA, ...pB, ...pC, ...pD);
      normals.push(...n0, ...n1, ...n1, ...n0);
      const u0 = i / S, u1 = (i + 1) / S;
      uvs.push(u0, 1, u1, 1, u1, 0, u0, 0);
      indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geom.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    return geom;
  }
  function createArchCasingGeometry(S, radW, depth) {
    const positions = [], normals = [], uvs = [], indices = [];
    function addQuad(p0, p1, p2, p3, n) {
      const b = positions.length / 3;
      positions.push(...p0, ...p1, ...p2, ...p3);
      normals.push(...n, ...n, ...n, ...n);
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const arcIn = [], arcOut = [];
    for (let i = 0; i <= S; i++) {
      const th = (i / S) * Math.PI;
      const yIn = -0.5 + Math.sin(th);
      const yOut = -0.5 + (1 + 2 * radW) * Math.sin(th);
      arcIn.push({ x: -0.5 * Math.cos(th), y: yIn, th });
      arcOut.push({ x: -(0.5 + radW) * Math.cos(th), y: yOut, th });
    }
    // Front face (z = depth / 2)
    for (let i = 0; i < S; i++) {
      const pA = [arcIn[i].x, arcIn[i].y, depth / 2], pB = [arcIn[i + 1].x, arcIn[i + 1].y, depth / 2];
      const pC = [arcOut[i + 1].x, arcOut[i + 1].y, depth / 2], pD = [arcOut[i].x, arcOut[i].y, depth / 2];
      addQuad(pA, pB, pC, pD, [0, 0, 1]);
    }
    // Back face (z = -depth / 2)
    for (let i = 0; i < S; i++) {
      const pA = [arcIn[i + 1].x, arcIn[i + 1].y, -depth / 2], pB = [arcIn[i].x, arcIn[i].y, -depth / 2];
      const pC = [arcOut[i].x, arcOut[i].y, -depth / 2], pD = [arcOut[i + 1].x, arcOut[i + 1].y, -depth / 2];
      addQuad(pA, pB, pC, pD, [0, 0, -1]);
    }
    // Outer arch rim
    for (let i = 0; i < S; i++) {
      const pt0 = arcOut[i], pt1 = arcOut[i + 1];
      const n0 = [-Math.cos(pt0.th), Math.sin(pt0.th), 0], n1 = [-Math.cos(pt1.th), Math.sin(pt1.th), 0];
      const pA = [pt0.x, pt0.y, depth / 2], pB = [pt1.x, pt1.y, depth / 2], pC = [pt1.x, pt1.y, -depth / 2], pD = [pt0.x, pt0.y, -depth / 2];
      const b = positions.length / 3;
      positions.push(...pA, ...pB, ...pC, ...pD);
      normals.push(...n0, ...n1, ...n1, ...n0);
      uvs.push(0, 1, 1, 1, 1, 0, 0, 0);
      indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    // Inner arch soffit
    for (let i = 0; i < S; i++) {
      const pt0 = arcIn[i], pt1 = arcIn[i + 1];
      const n0 = [Math.cos(pt0.th), -Math.sin(pt0.th), 0], n1 = [Math.cos(pt1.th), -Math.sin(pt1.th), 0];
      const pA = [pt1.x, pt1.y, depth / 2], pB = [pt0.x, pt0.y, depth / 2], pC = [pt0.x, pt0.y, -depth / 2], pD = [pt1.x, pt1.y, -depth / 2];
      const b = positions.length / 3;
      positions.push(...pA, ...pB, ...pC, ...pD);
      normals.push(...n0, ...n1, ...n1, ...n0);
      uvs.push(0, 1, 1, 1, 1, 0, 0, 0);
      indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    // Bottom ends (resting on impost capitals)
    addQuad([arcIn[0].x, arcIn[0].y, -depth / 2], [arcOut[0].x, arcOut[0].y, -depth / 2], [arcOut[0].x, arcOut[0].y, depth / 2], [arcIn[0].x, arcIn[0].y, depth / 2], [0, -1, 0]);
    addQuad([arcOut[S].x, arcOut[S].y, -depth / 2], [arcIn[S].x, arcIn[S].y, -depth / 2], [arcIn[S].x, arcIn[S].y, depth / 2], [arcOut[S].x, arcOut[S].y, depth / 2], [0, -1, 0]);

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geom.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    return geom;
  }
  function createKeystoneGeometry() {
    const positions = [], normals = [], uvs = [], indices = [];
    function addQuad(p0, p1, p2, p3, n) {
      const b = positions.length / 3;
      positions.push(...p0, ...p1, ...p2, ...p3);
      normals.push(...n, ...n, ...n, ...n);
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const wBot = 0.35, wTop = 0.5;
    addQuad([-wBot, -0.5, 0.5], [wBot, -0.5, 0.5], [wTop, 0.5, 0.5], [-wTop, 0.5, 0.5], [0, 0, 1]);
    addQuad([-wTop, 0.5, -0.5], [wTop, 0.5, -0.5], [wBot, -0.5, -0.5], [-wBot, -0.5, -0.5], [0, 0, -1]);
    addQuad([-wTop, 0.5, -0.5], [-wTop, 0.5, 0.5], [wTop, 0.5, 0.5], [wTop, 0.5, -0.5], [0, 1, 0]);
    addQuad([-wBot, -0.5, -0.5], [wBot, -0.5, -0.5], [wBot, -0.5, 0.5], [-wBot, -0.5, 0.5], [0, -1, 0]);
    const nL = [-1, 0.15, 0], lenL = Math.hypot(nL[0], nL[1]); nL[0] /= lenL; nL[1] /= lenL;
    addQuad([-wTop, 0.5, -0.5], [-wTop, 0.5, 0.5], [-wBot, -0.5, 0.5], [-wBot, -0.5, -0.5], nL);
    const nR = [1, 0.15, 0], lenR = Math.hypot(nR[0], nR[1]); nR[0] /= lenR; nR[1] /= lenR;
    addQuad([wBot, -0.5, -0.5], [wBot, -0.5, 0.5], [wTop, 0.5, 0.5], [wTop, 0.5, -0.5], nR);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geom.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    return geom;
  }
  function createWedgeGeometry() {
    const positions = [], normals = [], uvs = [], indices = [];
    const addQuad = (p0, p1, p2, p3, n) => {
      const b = positions.length / 3;
      positions.push(...p0, ...p1, ...p2, ...p3);
      normals.push(...n, ...n, ...n, ...n);
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    const addTri = (p0, p1, p2, n) => {
      const b = positions.length / 3;
      positions.push(...p0, ...p1, ...p2);
      normals.push(...n, ...n, ...n);
      uvs.push(0, 0, 1, 0, 1, 1);
      indices.push(b, b + 1, b + 2);
    };
    addQuad([-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5], [0, 0, 1]);
    addQuad([-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5], [0, -1, 0]);
    const sn = [0, Math.SQRT1_2, -Math.SQRT1_2];
    addQuad([-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], sn);
    addTri([-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-1, 0, 0]);
    addTri([0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, 0.5], [1, 0, 0]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geom.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    return geom;
  }
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    wedge: createWedgeGeometry(),
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, segments),
    openCylinder: new THREE.CylinderGeometry(0.43, 0.50, 1, segments, 1, true),
    cylinderX: new THREE.CylinderGeometry(0.5, 0.5, 1, segments).rotateZ(Math.PI / 2),
    cylinderZ: new THREE.CylinderGeometry(0.5, 0.5, 1, segments).rotateX(Math.PI / 2),
    sphere: new THREE.SphereGeometry(0.5, segments, G.current.detail ? 7 : 4),
    cone: new THREE.CylinderGeometry(0.15, 0.5, 1, 9),
    roof: new THREE.ConeGeometry(0.71, 1, 4).rotateY(Math.PI / 4),
    gable: createGableGeometry(),
    hipRoof: createHipRoofGeometry(),
    oakLeaf: createOakLeafGeometry(),
    shadow: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    archTop: createArchTopGeometry(G.current.detail ? 36 : 24),
    archCasing: createArchCasingGeometry(G.current.detail ? 36 : 24, 0.08, 1.0),
    keystone: createKeystoneGeometry(),
  };
  const root = new THREE.Matrix4(), local = new THREE.Matrix4(), result = new THREE.Matrix4();
  const q = new THREE.Quaternion(), axis = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3();
  const ONE = new THREE.Vector3(1, 1, 1);
  const matIds = new Map(); let matId = 0;          // per-material batch keys
  const artTexCache = new Map();                    // it -> painted canvas texture
  function getGeomEnv(targetLvl) {
    const lvl = targetLvl || (HP.cur && HP.cur()) || (HP.state && HP.state.levels && HP.state.levels[HP.state.level || 0]);
    if (HP.world3d && HP.world3d.geomEnv) {
      return HP.world3d.geomEnv(lvl);
    }
    const C = (HP && HP.CELL) || 28;
    let rAt = () => -1, rsz = () => 1e9;
    if (HP.computeRegions) {
      try {
        const cr = HP.computeRegions(lvl);
        if (cr && cr.regionOf && cr.regions) {
          const { regionOf, regions } = cr;
          rAt = (x, y) => (x < 0 || y < 0 || x >= HP.GRID_W || y >= HP.GRID_H) ? -1 : regionOf[y * HP.GRID_W + x];
          rsz = id => id >= 0 && regions[id] ? regions[id].cells.length : 1e9;
        }
      } catch (e) {}
    }
    return { C, rAt, rsz };
  }
  let index, width, depth, height, fp, small;
  const base = { wood: '#c3a383', fabric: '#e4ded1', metal: '#8b918c',
    ceramic: '#f1eee5', foliage: '#60845a', dark: '#343c3d', glass: '#92bbc0',
    water: '#b6e0db', stone: '#bdb5a5', soil: '#5c4839', art: '#ffffff', glow: '#fff1d6',
    led_red: '#dc2626', led_white: '#f8fafc',
    plaster: '#f4efe4', brick: '#ffffff', brick_white: '#ffffff', tile: '#ffffff', concrete: '#ffffff', shiplap: '#ffffff' };
  /* see-through or decal parts never cast a shadow                    */
  const NO_CAST = { glass: 1, water: 1, art: 1 };
  /* render the item's own 2D sprite onto the canvas face of wall art —
     each painting hangs its real picture, not a generic panel        */
  function artFace(it, def) {
    if (typeof document === 'undefined' || !def.draw) return null;
    const key = it.type + ':' + (it.v || 0) + ':' + ((it.colors && it.colors[0]) || '');
    if (artTexCache.has(key)) return artTexCache.get(key);
    let mat = null;
    const c = document.createElement('canvas'); c.width = 128; c.height = 96;
    const ctx = c.getContext && c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#efe9dc'; ctx.fillRect(0, 0, 128, 96);
      try { def.draw.call(def, ctx, 128, 96, it.v || 0); } catch (e) { /* decorative */ }
      const t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding; t.anisotropy = 2;
      mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 });
    }
    artTexCache.set(key, mat);
    return mat;
  }
  function part(shape, kind, x, y, z, w, h, d, color, detail, mat) {
    const material = mat || (shape === 'shadow' ? G.contactMaterial() : G.material(kind, base[kind]));
    /* small items share a distance limit; big ones (car, pool, shed)
       always draw so they never pop in across the yard              */
    const key = mat ? (shape + ':m' + (matIds.get(mat) || matIds.set(mat, ++matId) && matId))
      : shape + ':' + kind + ':' + !!detail + ':' + small;
    if (!batches.has(key)) batches.set(key, { shape, kind, material, parts: [], detail, small });
    local.makeScale(w * width, h * height, d * depth);
    local.setPosition(x * width, y * height, z * depth);
    result.multiplyMatrices(root, local);
    batches.get(key).parts.push({ matrix: result.clone(), index, color: color || '#ffffff', fp });
  }
  const _partQ = new THREE.Quaternion(), _partPos = new THREE.Vector3(), _partScale = new THREE.Vector3();
  function partRot(shape, kind, x, y, z, w, h, d, ry, color, detail, mat) {
    const material = mat || (shape === 'shadow' ? G.contactMaterial() : G.material(kind, base[kind]));
    const key = mat ? (shape + ':m' + (matIds.get(mat) || matIds.set(mat, ++matId) && matId))
      : shape + ':' + kind + ':' + !!detail + ':' + small;
    if (!batches.has(key)) batches.set(key, { shape, kind, material, parts: [], detail, small });
    _partPos.set(x * width, y * height, z * depth);
    _partQ.setFromAxisAngle(axis, ry || 0);
    _partScale.set(w * width, h * height, d * depth);
    local.compose(_partPos, _partQ, _partScale);
    result.multiplyMatrices(root, local);
    batches.get(key).parts.push({ matrix: result.clone(), index, color: color || '#ffffff', fp });
  }
  const _partEuler = new THREE.Euler();
  function partRotEuler(shape, kind, x, y, z, w, h, d, rx, ry, rz, color, detail, mat) {
    const material = mat || (shape === 'shadow' ? G.contactMaterial() : G.material(kind, base[kind]));
    const key = mat ? (shape + ':m' + (matIds.get(mat) || matIds.set(mat, ++matId) && matId))
      : shape + ':' + kind + ':' + !!detail + ':' + small;
    if (!batches.has(key)) batches.set(key, { shape, kind, material, parts: [], detail, small });
    _partPos.set(x * width, y * height, z * depth);
    _partEuler.set(rx || 0, ry || 0, rz || 0);
    _partQ.setFromEuler(_partEuler);
    _partScale.set(w * width, h * height, d * depth);
    local.compose(_partPos, _partQ, _partScale);
    result.multiplyMatrices(root, local);
    batches.get(key).parts.push({ matrix: result.clone(), index, color: color || '#ffffff', fp });
  }
  const _dir = new THREE.Vector3(), _mid = new THREE.Vector3(), _up = new THREE.Vector3(1, 0, 0);
  function partSlope(shape, kind, x0, y0, z0, x1, y1, z1, thickY, thickZ, color, detail, mat) {
    const material = mat || (shape === 'shadow' ? G.contactMaterial() : G.material(kind, base[kind]));
    const key = mat ? (shape + ':m' + (matIds.get(mat) || matIds.set(mat, ++matId) && matId))
      : shape + ':' + kind + ':' + !!detail + ':' + small;
    if (!batches.has(key)) batches.set(key, { shape, kind, material, parts: [], detail, small });
    const p0x = x0 * width, p0y = y0 * height, p0z = z0 * depth;
    const p1x = x1 * width, p1y = y1 * height, p1z = z1 * depth;
    _dir.set(p1x - p0x, p1y - p0y, p1z - p0z);
    const len = _dir.length();
    if (len < 1e-4) return;
    _dir.normalize();
    _mid.set((p0x + p1x) / 2, (p0y + p1y) / 2, (p0z + p1z) / 2);
    _partQ.setFromUnitVectors(_up, _dir);
    _partScale.set(len, thickY * height, thickZ * depth);
    local.compose(_mid, _partQ, _partScale);
    result.multiplyMatrices(root, local);
    batches.get(key).parts.push({ matrix: result.clone(), index, color: color || '#ffffff', fp });
  }
  const _xAxis = new THREE.Vector3(1, 0, 0);
  function partSlopeYZ(shape, kind, x, y0, z0, y1, z1, widthX, thickY, color, detail, mat) {
    const material = mat || (shape === 'shadow' ? G.contactMaterial() : G.material(kind, base[kind]));
    const key = mat ? (shape + ':m' + (matIds.get(mat) || matIds.set(mat, ++matId) && matId))
      : shape + ':' + kind + ':' + !!detail + ':' + small;
    if (!batches.has(key)) batches.set(key, { shape, kind, material, parts: [], detail, small });
    const p0y = y0 * height, p0z = z0 * depth;
    const p1y = y1 * height, p1z = z1 * depth;
    const dy = p1y - p0y, dz = p1z - p0z;
    const len = Math.hypot(dy, dz);
    if (len < 1e-4) return;
    const ang = Math.atan2(dy, dz);
    _mid.set(x * width, (p0y + p1y) / 2, (p0z + p1z) / 2);
    _partQ.setFromAxisAngle(_xAxis, -ang);
    _partScale.set(widthX * width, thickY * height, len);
    local.compose(_mid, _partQ, _partScale);
    result.multiplyMatrices(root, local);
    batches.get(key).parts.push({ matrix: result.clone(), index, color: color || '#ffffff', fp });
  }
  const boxSlopeYZ = (k, x, y0, z0, y1, z1, wx, ty, c, detail, mat) => partSlopeYZ('box', k, x, y0, z0, y1, z1, wx, ty, c, detail, mat);
  const boxSlope = (k, x0, y0, z0, x1, y1, z1, ty, tz, c, detail, mat) => partSlope('box', k, x0, y0, z0, x1, y1, z1, ty, tz, c, detail, mat);
  const boxRot = (k, x, y, z, w, h, d, ry, c, detail, mat) => partRot('box', k, x, y, z, w, h, d, ry, c, detail, mat);
  const box = (k, x, y, z, w, h, d, c, detail, mat) => part('box', k, x, y, z, w, h, d, c, detail, mat);
  const round = (k, x, y, z, w, h, d, c) => part('sphere', k, x, y, z, w, h, d, c);
  const cyl = (k, x, y, z, w, h, d, c) => part('cylinder', k, x, y, z, w, h, d, c);
  const cylX = (k, x, y, z, w, h, d, c, detail, mat) => part('cylinderX', k, x, y, z, w, h, d, c, detail, mat);
  const cylZ = (k, x, y, z, w, h, d, c, detail, mat) => part('cylinderZ', k, x, y, z, w, h, d, c, detail, mat);
  const wheelX = (k, x, y, z, wNorm, diamPx, c, detail, mat) =>
    part('cylinderX', k, x, y, z, wNorm, diamPx / height, diamPx / depth, c, detail, mat);
  const wheelZ = (k, x, y, z, diamPx, dNorm, c, detail, mat) =>
    part('cylinderZ', k, x, y, z, diamPx / width, diamPx / height, dNorm, c, detail, mat);
  const wedge = (k, x, y, z, w, h, d, c, detail, mat) => part('wedge', k, x, y, z, w, h, d, c, detail, mat);
  const wedgeBack = (k, x, y, z, w, h, d, c, detail, mat) => partRot('wedge', k, x, y, z, w, h, d, Math.PI, c, detail, mat);
  function legs(top, thick) {
    for (const x of [-0.36, 0.36]) for (const z of [-0.34, 0.34])
      box('wood', x, top / 2, z, thick || 0.07, top, thick || 0.07);
  }
  function cabinet(color) {
    box('wood', 0, 0.48, 0, 0.94, 0.88, 0.9, color);
    box('ceramic', 0, 0.94, 0, 0.98, 0.07, 0.94, '#fafaf8');
    for (const x of [-0.23, 0.23]) {
      box('wood', x, 0.49, 0.458, 0.445, 0.81, 0.025, color);
      box('metal', x > 0 ? x - 0.14 : x + 0.14, 0.58, 0.482, 0.025, 0.13, 0.025, null, true);
    }
    box('dark', 0, 0.035, 0, 0.78, 0.07, 0.72);
  }
  return {
    add(it, def, f, h, inst, baseY) {
      index = inst;
      const rot = it.rot || 0;
      const itemLvl = () => (HP.state && HP.state.levels && it._levelIdx !== undefined ? HP.state.levels[it._levelIdx] : null)
        || (HP.cur && HP.cur()) || (HP.state && HP.state.levels && HP.state.levels[HP.state.level || 0]) || null;
      function getScreenNeighbors() {
        try {
          const cur = itemLvl();
          if (!cur || !cur.furniture) return { left: false, right: false };
          const r = (it.rot || 0) % 4;
          let left = false, right = false;
          for (const o of cur.furniture) {
            if (o === it || o.type !== it.type) continue;
            if (((o.rot || 0) % 4) !== r) continue;
            const of = HP.footprint(o);
            if (r === 0) {
              if (Math.abs(of.y - f.y) < 0.1) {
                if (Math.abs(of.x + of.w - f.x) < 0.1) left = true;
                if (Math.abs(f.x + f.w - of.x) < 0.1) right = true;
              }
            } else if (r === 1) {
              if (Math.abs(of.x - f.x) < 0.1) {
                if (Math.abs(of.y + of.h - f.y) < 0.1) left = true;
                if (Math.abs(f.y + f.h - of.y) < 0.1) right = true;
              }
            } else if (r === 2) {
              if (Math.abs(of.y - f.y) < 0.1) {
                if (Math.abs(f.x + f.w - of.x) < 0.1) left = true;
                if (Math.abs(of.x + of.w - f.x) < 0.1) right = true;
              }
            } else if (r === 3) {
              if (Math.abs(of.x - f.x) < 0.1) {
                if (Math.abs(f.y + f.h - of.y) < 0.1) left = true;
                if (Math.abs(of.y + of.h - f.y) < 0.1) right = true;
              }
            }
          }
          return { left, right };
        } catch (e) {
          return { left: false, right: false };
        }
      }
      const isScreen = /^(divider|shoji|screen|garagedoor|greenhouse|archway|treehouse)/i.test(it.type);
      width = Math.max(3, (it.w || def.w) * HP.CELL - (isScreen ? 0 : 3));
      depth = Math.max(3, (it.h || def.h) * HP.CELL - (isScreen ? 0 : 3));
      height = Math.max(1.5, h);
      q.setFromAxisAngle(axis, -rot * Math.PI / 2);
      pos.set((f.x + f.w / 2) * HP.CELL, baseY || 0, (f.y + f.h / 2) * HP.CELL);
      fp = { x0: f.x * HP.CELL, z0: f.y * HP.CELL, x1: (f.x + f.w) * HP.CELL, z1: (f.y + f.h) * HP.CELL };
      if (!def.hangs && !isScreen && HP.geom3d && HP.geom3d.floorClearance) {
        const lvl = itemLvl();
        const lvlWalls = (lvl && lvl.walls) || {};
        const cl = HP.geom3d.floorClearance(f, lvlWalls, getGeomEnv(lvl), width, depth, rot);
        if (cl.dx || cl.dz || cl.w !== width || cl.d !== depth) {
          pos.x += cl.dx;
          pos.z += cl.dz;
          width = cl.w;
          depth = cl.d;
          fp = { x0: pos.x - width / 2, z0: pos.z - depth / 2, x1: pos.x + width / 2, z1: pos.z + depth / 2 };
        }
      }
      if (/^archway/i.test(it.type)) {
        const lvl = itemLvl();
        const lvlWalls = (lvl && lvl.walls) || {};
        const env = getGeomEnv(lvl);
        const C = (env && env.C) || (HP && HP.CELL) || 28;
        const isHoriz = (rot === 0 || rot === 2);
        let neighborWall = null;
        let wallThickPx = 0.30 * C;

        const useWorldGeom = (it._levelIdx === undefined || it._levelIdx === (HP.state && HP.state.level || 0))
          && HP.world3d && HP.world3d.geom && (!HP.state || !HP.state.levels || HP.state.levels.length <= 1);
        const geo = useWorldGeom ? HP.world3d.geom : (HP.geom3d && HP.geom3d.build(lvlWalls, env));
        const allBoxes = (geo && geo.boxes) ? geo.boxes.filter(b => b.tag === 'wall') : [];

        if (isHoriz) {
          let bestLineY = null;
          let bestWall = null;
          let bestKey = null;

          const wN0 = lvlWalls['h,' + (f.x - 1) + ',' + f.y], wN1 = lvlWalls['h,' + (f.x + f.w) + ',' + f.y];
          const wS0 = lvlWalls['h,' + (f.x - 1) + ',' + (f.y + 1)], wS1 = lvlWalls['h,' + (f.x + f.w) + ',' + (f.y + 1)];

          if (wN0 || wN1) {
            bestLineY = f.y;
            bestWall = wN0 || wN1;
            bestKey = wN0 ? ('h,' + (f.x - 1) + ',' + f.y) : ('h,' + (f.x + f.w) + ',' + f.y);
          } else if (wS0 || wS1) {
            bestLineY = f.y + 1;
            bestWall = wS0 || wS1;
            bestKey = wS0 ? ('h,' + (f.x - 1) + ',' + (f.y + 1)) : ('h,' + (f.x + f.w) + ',' + (f.y + 1));
          } else {
            let nHits0 = 0, nHits1 = 0, firstW0 = null, firstW1 = null, k0 = null, k1 = null;
            for (const wk in lvlWalls) {
              const wObj = lvlWalls[wk];
              if (!wObj) continue;
              const parts = wk.split(',');
              if (parts[0] === 'h') {
                const wy = parseFloat(parts[2]);
                if (Math.abs(wy - f.y) < 0.01) { nHits0++; if (!firstW0) { firstW0 = wObj; k0 = wk; } }
                if (Math.abs(wy - (f.y + 1)) < 0.01) { nHits1++; if (!firstW1) { firstW1 = wObj; k1 = wk; } }
              }
            }
            if (nHits0 > 0 && nHits0 >= nHits1) {
              bestLineY = f.y;
              bestWall = firstW0;
              bestKey = k0;
            } else if (nHits1 > 0) {
              bestLineY = f.y + 1;
              bestWall = firstW1;
              bestKey = k1;
            } else {
              const vTL = lvlWalls['v,' + f.x + ',' + (f.y - 1)], vBL = lvlWalls['v,' + f.x + ',' + (f.y + 1)];
              const vTR = lvlWalls['v,' + (f.x + f.w) + ',' + (f.y - 1)], vBR = lvlWalls['v,' + (f.x + f.w) + ',' + (f.y + 1)];
              if (vTL || vTR) {
                bestLineY = f.y;
                bestWall = vTL || vTR;
                bestKey = vTL ? ('v,' + f.x + ',' + (f.y - 1)) : ('v,' + (f.x + f.w) + ',' + (f.y - 1));
              } else if (vBL || vBR) {
                bestLineY = f.y + 1;
                bestWall = vBL || vBR;
                bestKey = vBL ? ('v,' + f.x + ',' + (f.y + 1)) : ('v,' + (f.x + f.w) + ',' + (f.y + 1));
              }
            }
          }

          if (bestLineY !== null) {
            const touchingBox = allBoxes.find(b => b.d === 'h' && (
              (Math.abs(b.x1 - f.x * C) < 3.0 && Math.abs((b.z0 + b.z1) / 2 - bestLineY * C) < C) ||
              (Math.abs(b.x0 - (f.x + f.w) * C) < 3.0 && Math.abs((b.z0 + b.z1) / 2 - bestLineY * C) < C)
            )) || allBoxes.find(b => b.d === 'h' && b.line === bestLineY);

            if (touchingBox) {
              pos.z = (touchingBox.z0 + touchingBox.z1) / 2;
              wallThickPx = Math.max(2, Math.abs(touchingBox.z1 - touchingBox.z0));
            } else {
              const s = bestKey ? HP.parseWallKey(bestKey) : { d: 'h', x: f.x - 1, y: bestLineY, k: 'h,' + (f.x - 1) + ',' + bestLineY };
              const z = (HP.geom3d && HP.geom3d.segZone) ? HP.geom3d.segZone(s, env) : null;
              pos.z = bestLineY * C + (z ? (z.w0 + z.w1) / 2 : 0);
              if (z) wallThickPx = Math.max(2, Math.abs(z.w1 - z.w0));
            }
            neighborWall = bestWall;
          }
        } else {
          let bestLineX = null;
          let bestWall = null;
          let bestKey = null;

          const wW0 = lvlWalls['v,' + f.x + ',' + (f.y - 1)], wW1 = lvlWalls['v,' + f.x + ',' + (f.y + f.h)];
          const wE0 = lvlWalls['v,' + (f.x + 1) + ',' + (f.y - 1)], wE1 = lvlWalls['v,' + (f.x + 1) + ',' + (f.y + f.h)];

          if (wW0 || wW1) {
            bestLineX = f.x;
            bestWall = wW0 || wW1;
            bestKey = wW0 ? ('v,' + f.x + ',' + (f.y - 1)) : ('v,' + f.x + ',' + (f.y + f.h));
          } else if (wE0 || wE1) {
            bestLineX = f.x + 1;
            bestWall = wE0 || wE1;
            bestKey = wE0 ? ('v,' + (f.x + 1) + ',' + (f.y - 1)) : ('v,' + (f.x + 1) + ',' + (f.y + f.h));
          } else {
            let nHits0 = 0, nHits1 = 0, firstW0 = null, firstW1 = null, k0 = null, k1 = null;
            for (const wk in lvlWalls) {
              const wObj = lvlWalls[wk];
              if (!wObj) continue;
              const parts = wk.split(',');
              if (parts[0] === 'v') {
                const wx = parseFloat(parts[1]);
                if (Math.abs(wx - f.x) < 0.01) { nHits0++; if (!firstW0) { firstW0 = wObj; k0 = wk; } }
                if (Math.abs(wx - (f.x + 1)) < 0.01) { nHits1++; if (!firstW1) { firstW1 = wObj; k1 = wk; } }
              }
            }
            if (nHits0 > 0 && nHits0 >= nHits1) {
              bestLineX = f.x;
              bestWall = firstW0;
              bestKey = k0;
            } else if (nHits1 > 0) {
              bestLineX = f.x + 1;
              bestWall = firstW1;
              bestKey = k1;
            } else {
              const hTL = lvlWalls['h,' + (f.x - 1) + ',' + f.y], hTR = lvlWalls['h,' + (f.x + 1) + ',' + f.y];
              const hBL = lvlWalls['h,' + (f.x - 1) + ',' + (f.y + f.h)], hBR = lvlWalls['h,' + (f.x + 1) + ',' + (f.y + f.h)];
              if (hTL || hBL) {
                bestLineX = f.x;
                bestWall = hTL || hBL;
                bestKey = hTL ? ('h,' + (f.x - 1) + ',' + f.y) : ('h,' + (f.x - 1) + ',' + (f.y + f.h));
              } else if (hTR || hBR) {
                bestLineX = f.x + 1;
                bestWall = hTR || hBR;
                bestKey = hTR ? ('h,' + (f.x + 1) + ',' + f.y) : ('h,' + (f.x + 1) + ',' + (f.y + f.h));
              }
            }
          }

          if (bestLineX !== null) {
            const touchingBox = allBoxes.find(b => b.d === 'v' && (
              (Math.abs(b.z1 - f.y * C) < 3.0 && Math.abs((b.x0 + b.x1) / 2 - bestLineX * C) < C) ||
              (Math.abs(b.z0 - (f.y + f.h) * C) < 3.0 && Math.abs((b.x0 + b.x1) / 2 - bestLineX * C) < C)
            )) || allBoxes.find(b => b.d === 'v' && b.line === bestLineX);

            if (touchingBox) {
              pos.x = (touchingBox.x0 + touchingBox.x1) / 2;
              wallThickPx = Math.max(2, Math.abs(touchingBox.x1 - touchingBox.x0));
            } else {
              const s = bestKey ? HP.parseWallKey(bestKey) : { d: 'v', x: bestLineX, y: f.y - 1, k: 'v,' + bestLineX + ',' + (f.y - 1) };
              const z = (HP.geom3d && HP.geom3d.segZone) ? HP.geom3d.segZone(s, env) : null;
              pos.x = bestLineX * C + (z ? (z.w0 + z.w1) / 2 : 0);
              if (z) wallThickPx = Math.max(2, Math.abs(z.w1 - z.w0));
            }
            neighborWall = bestWall;
          }
        }

        it._wallThickPx = wallThickPx;
        it._neighborWall = neighborWall;
        it._midX = pos.x;
        it._midZ = pos.z;
        fp = { x0: pos.x - width / 2, z0: pos.z - depth / 2, x1: pos.x + width / 2, z1: pos.z + depth / 2 };
      }
      small = f.w * f.h < 4;
      root.compose(pos, q, new THREE.Vector3(1, 1, 1));
      const t = it.type.toLowerCase();
      const color = (it.colors && it.colors[0]) || def.colors[(it.v || 0) % def.colors.length] || '#c6b59c';
      if (def.hangs) {
        /* mount flush on the wall face at a realistic height.
           model space: +z faces the room, x runs along the wall,
           y is absolute px — radiator sits low, art/clock high       */
        const hang = it.hang || (HP.state && HP.hangSide(it.type, it.x, it.y, it.rot || 0,
          { w: it.w || f.w, h: it.h || f.h }));
        const ry = hang === 'n' ? 0 : hang === 's' ? Math.PI :
          hang === 'w' ? Math.PI / 2 : hang === 'e' ? -Math.PI / 2 :
          -(it.rot || 0) * Math.PI / 2;
        const lvl = itemLvl();
        const lvlWalls = (lvl && lvl.walls) || {};
        const IN = HP.geom3d && HP.geom3d.wallInset
          ? HP.geom3d.wallInset(hang, f, lvlWalls, getGeomEnv(lvl))
          : 7.0;                                        // dynamic wall-face inset
        let mx = (f.x + f.w / 2) * HP.CELL, mz = (f.y + f.h / 2) * HP.CELL;
        if (hang === 'n') mz = f.y * HP.CELL + IN;
        else if (hang === 's') mz = (f.y + f.h) * HP.CELL - IN;
        else if (hang === 'w') mx = f.x * HP.CELL + IN;
        else if (hang === 'e') mx = (f.x + f.w) * HP.CELL - IN;
        pos.set(mx, baseY || 0, mz);
        q.setFromAxisAngle(axis, ry);
        root.compose(pos, q, ONE);
        const W = Math.max(4, (hang === 'w' || hang === 'e' ? f.h : f.w) * HP.CELL - 3);
        width = depth = height = 1;                    // part coords = px
        if (/clock|^clk/.test(t)) { /* life3d draws face + moving hands */ }
        else if (/curtain/.test(t)) {
          box('metal', 0, 54, 0.4, W + 4, 0.8, 0.8);              // rod
          for (const sx of [-1, 1]) {
            box('fabric', sx * W * 0.27, 30, 0.6, W * 0.42, 46, 2.2, color);
            box('fabric', sx * W * 0.31, 30, 1.8, W * 0.34, 44, 0.9, color, true);
          }
        } else if (/mirrorcab|medicine/.test(t)) {
          box('ceramic', 0, 40, 1.5, W, 20, 3.4, color);          // cabinet box
          box('glass', 0, 40, 3.4, W - 3, 17, 0.3);               // mirror door
          box('metal', W / 2 - 2.4, 40, 3.6, 0.9, 4, 0.4, null, true);  // handle
        } else if (/floormirror|mirror/.test(t)) {
          // Architectural Full-Length Mirror: open-center perimeter mitered frame, bright silver reflector plate, specular glazing
          const frT = 1.6, mW = W - 2 * frT, mH = 42.8;
          box('wood', 0, 31 + (mH + frT) / 2, 0.4, W, frT, 1.8, color);               // top frame rail
          box('wood', 0, 31 - (mH + frT) / 2, 0.4, W, frT, 1.8, color);               // bottom frame rail
          box('wood', -(mW + frT) / 2, 31, 0.4, frT, mH, 1.8, color);                 // left stile
          box('wood', (mW + frT) / 2, 31, 0.4, frT, mH, 1.8, color);                  // right stile
          box('metal', 0, 31, 0.45, mW, mH, 0.5, '#e2e8f0', true);                    // bright mirror reflector plate
          box('glass', 0, 31, 0.85, mW - 0.4, mH - 0.4, 0.2, '#e0f2fe');              // crystal mirror glazing
          if (!hang) {
            for (const sx of [-W * 0.28, W * 0.28]) {
              boxSlope('wood', sx, 0.5, -6.5, sx, 44, -0.4, 1.4, 1.4, HP.shade(color, 0.85));
            }
            box('wood', 0, 12, -4.6, W * 0.56, 1.2, 1.2, HP.shade(color, 0.85));
          }
        } else if (/radiator/.test(t)) {
          const fins = Math.max(3, Math.round(W / 9));
          for (let i = 0; i < fins; i++)
            box('metal', -W / 2 + 3 + i * (W - 6) / (fins - 1), 13, 0, 3, 18, 4);
          box('metal', 0, 21, 0, W - 4, 2, 3.6, null, true);      // top rail
          box('metal', 0, 5, 0, W - 4, 2, 3.6, null, true);       // bottom rail
        } else if (/towelwarmer/.test(t)) {
          for (const sx of [-1, 1]) box('metal', sx * (W / 2 - 3), 14, 0, 1.6, 18, 1.6);
          for (let i = 0; i < 5; i++) box('metal', 0, 7 + i * 3.6, 0.8, W - 5, 1.1, 1.1, null, true);
          box('fabric', -W * 0.18, 15, 1.9, W * 0.3, 11, 0.7, '#a8c8d8');
          box('fabric', W * 0.18, 16, 1.9, W * 0.3, 9, 0.7, '#f0ece2');
        } else if (/towelrack|towelrail/.test(t)) {
          box('metal', 0, 36, 1.6, W - 2, 0.9, 0.9);               // bar
          box('metal', -W / 2 + 2, 36, 0.7, 0.9, 0.9, 2, null, true);
          box('metal', W / 2 - 2, 36, 0.7, 0.9, 0.9, 2, null, true);
          box('fabric', W * 0.1, 30.5, 1.9, W * 0.5, 11, 0.7, color);  // towel
        } else if (/walltv/.test(t)) {
          // Ultra-Realistic 55" OLED Smart Wall TV with Matching Soundbar & Articulating Bracket
          const TV_W = 50.0;
          const TV_H = 28.2;
          const TV_Y = 42.0;

          // 1. Dual-Arm Articulating Steel Wall Mount Bracket
          box('metal', 0, TV_Y, -0.6, 14, 8, 1.2, '#1e2124', true);                  // wall plate
          box('metal', -4, TV_Y, 0.2, 1.8, 10, 1.2, '#2d333b', true);                // left scissor arm
          box('metal', 4, TV_Y, 0.2, 1.8, 10, 1.2, '#2d333b', true);                 // right scissor arm
          box('metal', 0, TV_Y, 0.7, 16, 14, 0.6, '#1e2124', true);                  // VESA 200x200 plate
          // In-wall cable conduit grommet
          box('ceramic', 0, 34, 0.05, 4.2, 6.2, 0.15, '#f1f5f9');
          box('dark', 0, 34, 0.15, 2.0, 4.0, 0.1, '#0f172a');                       // brush pass-through

          // 2. Slim Electronics Rear Chassis Housing
          box('dark', 0, TV_Y, 1.4, TV_W - 0.8, TV_H - 0.8, 1.2, '#141619');
          // Slim cable drop sleeve
          box('dark', 0, 34, 0.6, 1.6, 14, 0.8, '#1e2124');

          // 3. Precision Anodized Aluminum Perimeter Bezel & OLED Display
          box('metal', 0, TV_Y, 2.2, TV_W, TV_H, 0.4, '#1f2937', true);             // razor bezel frame
          box('dark', 0, TV_Y, 2.44, 47.6, 26.4, 0.1, '#090b0e');                   // deep OLED glass face
          // Micro power status LED at bottom bezel
          round('glow', 0, TV_Y - TV_H / 2 + 0.5, 2.52, 0.35, 0.35, 0.35, '#3b82f6');
          /* Interactive screen face (PlaneGeometry 47.6x26.4 at z=2.52, y=42) is added by life3d */

          // 4. Integrated Wall-Mounted Dolby Atmos Soundbar underneath
          box('metal', 0, 26, 1.2, 44, 4.2, 3.2, '#181a1d', true);                  // soundbar body
          box('fabric', 0, 26, 2.85, 42.8, 3.6, 0.2, '#2d333b');                     // acoustic cloth grille
          box('metal', 0, 26, 2.95, 43.4, 0.35, 0.1, '#64748b', true);               // brushed chamfer strip
          round('glow', 0, 26, 2.98, 0.25, 0.25, 0.25, '#10b981');                   // green power dot
          box('metal', -21.8, 26, 1.2, 0.4, 4.2, 3.2, '#64748b', true);              // left metal end-cap
          box('metal', 21.8, 26, 1.2, 0.4, 4.2, 3.2, '#64748b', true);               // right metal end-cap
        } else if (/wallcab|uppercab/.test(t)) {
          // Architectural Minimalist Upper Kitchen Wall Cabinet with Flush J-Pull Doors & Integrated Diffused LED Channel
          const H_CAB = 20;
          const D_CAB = 10;
          // 1. Carcass with top negative reveal
          box('wood', 0, 44, 4.8, W - 0.8, H_CAB - 0.8, D_CAB - 0.4, HP.shade(color, 0.96));
          box('dark', 0, 44 + H_CAB / 2 + 0.3, 4.5, W, 0.6, D_CAB, '#181b20');
          // 2. High-End Handleless Doors with J-Pull profile and bottom overhang
          const numDoors = W >= 48 ? 3 : 2;
          const doorW = (W - (numDoors - 1) * 0.4) / numDoors;
          for (let di = 0; di < numDoors; di++) {
            const dx = -W / 2 + doorW / 2 + di * (doorW + 0.4);
            box('wood', dx, 43.6, 9.8, doorW - 0.3, H_CAB + 1.2, 0.7, HP.shade(color, 1.02), true);
            box('metal', dx, 32.8, 9.6, doorW - 0.8, 0.3, 0.4, '#c5ccd2', true);
          }
          for (let di = 1; di < numDoors; di++) {
            const rx = -W / 2 + di * (W / numDoors);
            box('dark', rx, 44, 9.5, 0.3, H_CAB - 1.0, 0.2, '#181b20', true);
          }
          // 3. Integrated Flush Diffused LED Task Strip Channel
          box('metal', 0, 33.6, 5.0, W - 2.0, 0.4, 2.8, '#475569');
          box('glow', 0, 33.3, 5.0, W - 2.8, 0.3, 2.2, '#fff2d1');
        } else if (/wallshelf/.test(t)) {
          for (let i = 0; i < 3; i++) {
            box('wood', 0, 26 + i * 12, 3.5, W, 1.2, 7, color);         // boards
            box('metal', -W * 0.35, 22.5 + i * 12, 1.5, 1, 6, 1.4, null, true);
            box('metal', W * 0.35, 22.5 + i * 12, 1.5, 1, 6, 1.4, null, true);
          }
          cyl('ceramic', -W * 0.22, 30, 3.5, 4, 6, 4, '#b8a07b');       // pot
          box('dark', W * 0.14, 43, 3.8, 5, 6, 3.5, '#a03a3a');         // books
          box('dark', W * 0.28, 43.5, 3.8, 4, 5, 3.5, '#4a6b8a');
          round('foliage', W * 0.34, 30, 3.5, 5, 4, 5, '#8fb8a0');      // plant
        } else if (/sconce/.test(t)) {
          // Ultra-Realistic Modern Fluted Crystal & Brushed Champagne Brass Wall Sconce (Up/Down Wall Wash)
          box('metal', 0, 38, 0.4, 3.6, 11.0, 0.6, color || '#c9a44e');  // brass backplate
          box('metal', 0, 38, 1.2, 0.8, 0.8, 1.8, color || '#c9a44e');   // mounting arm
          cyl('metal', 0, 38, 2.2, 2.0, 2.8, 2.0, color || '#c9a44e');   // central brass collar
          cyl('metal', 0, 46.5, 2.2, 2.2, 0.8, 2.2, color || '#c9a44e'); // top brass end cap
          cyl('metal', 0, 29.5, 2.2, 2.2, 0.8, 2.2, color || '#c9a44e'); // bottom brass end cap
          cyl('glass', 0, 38, 2.2, 2.0, 16.0, 2.0, '#f8fafc');                 // fluted crystal glass cylinder
          cyl('glass', 0, 38, 2.2, 0.9, 13.0, 0.9, '#ffe0a8');                  // internal vertical filament
        } else if (/acsplit|acunit|aircon/.test(t)) {
          box('ceramic', 0, 50, 3, W, 9.5, 6, color);                   // body
          box('dark', 0, 46.5, 6.2, W - 5, 1.6, 0.6, null, true);       // vent
          box('glow', W / 2 - 4.5, 50.5, 6.4, 1, 1, 0.4, '#7be0a3');    // LED
        } else if (/coathook|hook/.test(t)) {
          box('wood', 0, 40, 0.7, W, 6.5, 1.6, color);                  // board
          const hn = Math.max(2, Math.round(W / 9));
          for (let i = 0; i < hn; i++)
            box('metal', -W / 2 + 4 + i * (W - 8) / (hn - 1), 37, 1.8, 0.9, 3, 2.4, null, true);
          box('fabric', W * 0.22, 30, 2.6, 7, 12, 1.6, '#7d8fa3');      // hanging coat
        } else if (/art|picture|poster|neon|sign/.test(t)) {
          if (/neon/.test(t)) {
            // Ultra-Realistic Bent-Glass Neon Tube Sign on Acrylic Standoff Backboard
            box('glass', 0, 32, 0.4, W, 18, 0.3, '#f8fafc');                   // beveled acrylic backboard
            for (const sx of [-W / 2 + 3, W / 2 - 3]) {
              for (const sy of [25, 39]) {
                cyl('metal', sx, sy, 0.25, 1.2, 0.5, 1.2, '#1e293b', true);    // standoff wall spacers
              }
            }
            box('glow', 0, 32, 1.0, W - 4, 1.2, 0.8, color || '#ec4899');     // horizontal neon tube
            box('glow', -W / 3.5, 34, 1.0, 1.2, 7.5, 0.8, color || '#ec4899'); // left loop
            box('glow', W / 3.5, 34, 1.0, 1.2, 7.5, 0.8, color || '#ec4899');  // right loop
            round('glow', 0, 35.5, 1.0, 5.5, 5.5, 0.8, color || '#ec4899');   // central glowing neon crest
            box('dark', 0, 24, 0.7, 3.8, 2.2, 1.0, '#0f172a');                // miniature power transformer
          } else {
            const tall = (it.h || def.h) > 1;
            const fh = Math.min(40, (tall ? 38 : 22));
            box('wood', 0, 32, 0.2, W, fh, 1.6, '#3a3128');       // outer exhibition frame
            box('ceramic', 0, 32, 0.8, W - 1.6, fh - 1.6, 0.25, '#f5f2eb'); // gallery matting board
            box('art', 0, 32, 1.15, W - 3.4, fh - 3.4, 0.4, null, false, artFace(it, def)); // painting canvas
          }
        } else {
          box('wood', 0, 40, 0.4, W, 16, 1.6, color);             // generic plaque
        }
        if (!hang) box('wood', 0, 20, -2.4, 3, 40, 3, '#5b5148');  // freestanding post
        return;
      }
      if (h > 3 && !/pool$|pond|^ceilingfan$/i.test(t)) part('shadow', '', 0, 0.12 / height, 0, 1.18, 1, 1.18);
      if (def.onTop) {
        /* small appliance/decor sitting on a surface — models are a
           fraction of the cell, not the whole footprint               */
        if (/microwave/.test(t)) {
          // Modern Inverter Microwave (Titanium chassis, smoked glass door, touch panel, ice-blue LED clock, rotary dial)
          box('metal', 0, 0.46, 0, 0.74, 0.88, 0.54, color);
          box('glass', -0.09, 0.48, 0.28, 0.50, 0.74, 0.02, '#14171a');
          box('metal', 0.18, 0.48, 0.30, 0.03, 0.60, 0.025, '#c5ccd2', true);
          box('dark', 0.26, 0.48, 0.28, 0.16, 0.76, 0.02, '#1b1d22', true);
          box('glow', 0.26, 0.72, 0.295, 0.11, 0.08, 0.01, '#4fc3f7', true);
          cyl('metal', 0.26, 0.52, 0.295, 0.07, 0.02, 0.07, '#c5ccd2', true);
          box('metal', 0.26, 0.32, 0.295, 0.10, 0.04, 0.01, '#52e09a', true);
          for (const [fx, fz] of [[-0.32, -0.22], [0.32, -0.22], [-0.32, 0.22], [0.32, 0.22]])
            box('dark', fx, 0.02, fz, 0.06, 0.04, 0.06, '#111315');
        } else if (/toaster/.test(t)) {
          // Artisan 2-Slot Toaster (Curved brushed metal body, chrome top, golden toast slices, high-lift lever, browning dial)
          box('metal', 0, 0.40, 0, 0.52, 0.76, 0.34, color);
          box('metal', 0, 0.78, 0, 0.54, 0.04, 0.36, '#eef2f6');
          box('dark', 0, 0.80, -0.07, 0.38, 0.03, 0.05, '#191b1f', true);
          box('dark', 0, 0.80, 0.07, 0.38, 0.03, 0.05, '#191b1f', true);
          box('wood', 0, 0.84, -0.07, 0.32, 0.10, 0.03, '#c99a5e', true);
          box('wood', 0, 0.84, 0.07, 0.32, 0.10, 0.03, '#c99a5e', true);
          box('dark', 0.30, 0.52, 0, 0.08, 0.03, 0.04, '#1b1d22', true);
          round('metal', 0.34, 0.52, 0, 0.04, 0.04, 0.04, '#eef2f6', true);
          cyl('metal', 0, 0.28, 0.18, 0.08, 0.02, 0.08, '#c5ccd2', true);
          round('glow', 0, 0.46, 0.18, 0.03, 0.03, 0.02, '#4fc3f7', true);
        } else if (/kettle/.test(t)) {
          // Digital Gooseneck Electric Kettle (Flat digital heating pad, conical body, arched precision spout, counterbalanced handle)
          box('dark', 0, 0.04, 0, 0.44, 0.08, 0.44, '#1b1d22');
          box('glow', 0.14, 0.085, 0.14, 0.08, 0.01, 0.08, '#4fc3f7', true);
          cyl('dark', -0.03, 0.50, 0, 0.32, 0.84, 0.32, color);
          cyl('metal', -0.03, 0.94, 0, 0.20, 0.06, 0.20, '#d8dee4');
          round('wood', -0.03, 1.00, 0, 0.08, 0.08, 0.08, '#8a6544');
          box('metal', 0.18, 0.55, 0, 0.18, 0.04, 0.04, '#d8dee4', true);
          box('metal', 0.28, 0.78, 0, 0.04, 0.42, 0.04, '#d8dee4', true);
          box('metal', 0.32, 0.98, 0, 0.06, 0.04, 0.04, '#d8dee4', true);
          box('dark', -0.24, 0.55, 0, 0.05, 0.60, 0.04, '#1b1d22', true);
        } else if (/^coffeemach$/i.test(t)) {
          // Luxury Barista Espresso Machine (Dual boiler architecture, recessed brew bay, 58mm portafilter, steam wand, pressure gauge, cup warmer)
          // 1. Rubber base feet
          for (const [fx, fz] of [[-0.28, -0.22], [0.28, -0.22], [-0.28, 0.22], [0.28, 0.22]])
            cyl('dark', fx, 0.02, fz, 0.05, 0.04, 0.05, '#111315');
          // 2. Rear tower & water reservoir
          box('metal', 0, 0.52, -0.14, 0.64, 0.94, 0.32, color || '#d4dade');
          box('glass', 0, 0.60, -0.29, 0.54, 0.68, 0.06, '#93c5fd');
          box('dark', 0, 0.95, -0.29, 0.56, 0.03, 0.08, '#1e293b');
          // 3. Top cup warming deck with polished chrome perimeter rail
          box('metal', 0, 0.98, -0.05, 0.64, 0.03, 0.46, '#e2e8f0');
          for (const rx of [-0.31, 0.31])
            box('metal', rx, 1.01, -0.05, 0.02, 0.05, 0.44, '#cbd5e1', true);
          box('metal', 0, 1.01, -0.27, 0.62, 0.05, 0.02, '#cbd5e1', true);
          for (const [cx, cz] of [[-0.18, -0.12], [-0.04, -0.12], [-0.11, 0.04]]) {
            cyl('ceramic', cx, 1.05, cz, 0.06, 0.09, 0.05, '#ffffff');
            round('ceramic', cx + 0.06, 1.05, cz, 0.02, 0.05, 0.02, '#ffffff', true);
          }
          // 4. Bean Hopper on top right
          cyl('glass', 0.17, 1.12, -0.04, 0.12, 0.24, 0.10, '#3f2e21');
          cyl('dark', 0.17, 1.25, -0.04, 0.13, 0.03, 0.13, '#1e293b');
          // 5. Upper Front Fascia (Brew Head & Controls)
          box('metal', 0, 0.82, 0.12, 0.64, 0.32, 0.24, HP.shade(color || '#d4dade', 1.04));
          // Center illuminated analog pressure gauge
          cyl('metal', 0, 0.84, 0.245, 0.08, 0.015, 0.08, '#f1f5f9', true);
          round('glow', 0, 0.84, 0.255, 0.065, 0.065, 0.008, '#fef08a', true);
          box('dark', 0, 0.84, 0.26, 0.01, 0.045, 0.005, '#dc2626', true);
          for (let bi = -2; bi <= 2; bi++) {
            if (bi === 0) continue;
            round('metal', bi * 0.11, 0.74, 0.245, 0.028, 0.028, 0.01, '#e2e8f0', true);
            round('glow', bi * 0.11, 0.74, 0.252, 0.012, 0.012, 0.006, '#38bdf8', true);
          }
          // 6. Recessed Brew Cavity & Commercial 58mm Group Head
          cyl('metal', -0.06, 0.65, 0.14, 0.10, 0.04, 0.10, '#cbd5e1');
          cyl('metal', -0.06, 0.62, 0.14, 0.088, 0.035, 0.088, '#f8fafc', true);
          cyl('metal', -0.08, 0.585, 0.14, 0.015, 0.035, 0.015, '#e2e8f0', true);
          cyl('metal', -0.04, 0.585, 0.14, 0.015, 0.035, 0.015, '#e2e8f0', true);
          box('metal', 0.03, 0.62, 0.23, 0.035, 0.03, 0.12, '#94a3b8', true);
          box('dark', 0.07, 0.62, 0.35, 0.04, 0.045, 0.18, '#181b20', true);
          // Steam wand
          round('metal', 0.24, 0.66, 0.16, 0.035, 0.035, 0.035, '#cbd5e1', true);
          cyl('metal', 0.25, 0.48, 0.22, 0.016, 0.32, 0.016, '#e2e8f0', true);
          cyl('dark', 0.25, 0.52, 0.22, 0.025, 0.07, 0.025, '#1e293b', true);
          cyl('metal', 0.25, 0.31, 0.22, 0.02, 0.02, 0.02, '#cbd5e1', true);
          // 7. Base Drip Tray with Perforated Removable Chrome Grid
          box('metal', 0, 0.07, 0.08, 0.64, 0.12, 0.44, color || '#d4dade');
          box('metal', 0, 0.135, 0.14, 0.58, 0.015, 0.30, '#f1f5f9');
          for (let gi = -3; gi <= 3; gi++)
            box('dark', gi * 0.075, 0.144, 0.14, 0.025, 0.005, 0.24, '#181b20', true);
        } else if (/blender/.test(t)) {
          // Commercial High-Speed Blender (Weighted motor base, rotary speed dial, pulse switch, clear Tritan jar with measurement lines, lid & blade)
          box('metal', 0, 0.24, 0, 0.42, 0.46, 0.42, color);
          box('dark', 0, 0.48, 0, 0.36, 0.04, 0.36, '#181b1f');
          cyl('metal', 0, 0.24, 0.22, 0.09, 0.02, 0.09, '#d8dee4', true);
          round('glow', 0, 0.24, 0.23, 0.04, 0.04, 0.01, '#4fc3f7', true);
          box('dark', -0.12, 0.24, 0.22, 0.03, 0.08, 0.02, '#181b1f', true);
          box('dark', 0.12, 0.24, 0.22, 0.03, 0.08, 0.02, '#181b1f', true);
          box('glass', 0, 0.85, 0, 0.34, 0.70, 0.34, '#9dcad6');
          box('dark', 0, 1.22, 0, 0.36, 0.06, 0.36, '#1b1d22');
          cyl('glass', 0, 1.28, 0, 0.10, 0.08, 0.10, '#9dcad6');
          box('dark', -0.21, 0.85, 0, 0.04, 0.48, 0.04, '#1b1d22', true);
          box('metal', 0, 0.54, 0, 0.14, 0.04, 0.14, '#d8dee4', true);
        } else if (/airfryer/.test(t)) {
          // Modern Luxury Air Fryer (Curved aerodynamic capsule, angled glass capacitive touch deck, ergonomic handle, illuminated viewing basket)
          // 1. Rubber base feet
          for (const [fx, fz] of [[-0.24, -0.20], [0.24, -0.20], [-0.24, 0.18], [0.24, 0.18]])
            cyl('dark', fx, 0.02, fz, 0.045, 0.04, 0.045, '#111315');
          // 2. Main chassis: layered soft-capsule geometry
          box('dark', 0, 0.48, 0, 0.62, 0.90, 0.56, color);
          round('dark', 0, 0.88, -0.02, 0.60, 0.16, 0.52, HP.shade(color, 1.03));
          // Sleek chrome metallic belt trim
          box('metal', 0, 0.68, 0.01, 0.63, 0.025, 0.57, '#d8dee4', true);
          // 3. Top Angled Touch Interface Deck
          box('glass', 0, 0.86, 0.16, 0.50, 0.22, 0.03, '#101418');
          box('dark', 0, 0.86, 0.178, 0.46, 0.18, 0.01, '#0b0d10', true);
          box('glow', -0.10, 0.88, 0.186, 0.15, 0.06, 0.01, '#38bdf8', true); // ice-blue digital readout
          box('glow', 0.10, 0.88, 0.186, 0.12, 0.06, 0.01, '#f59e0b', true); // golden orange time
          for (let pi = -2; pi <= 2; pi++)
            round('glow', pi * 0.08, 0.80, 0.186, 0.022, 0.022, 0.008, '#4ade80', true);
          // 4. Pull-Out Crisper Basket
          box('dark', 0, 0.33, 0.02, 0.56, 0.58, 0.54, HP.shade(color, 0.94));
          box('dark', 0, 0.35, 0.285, 0.42, 0.32, 0.02, '#1e242b');
          box('glass', 0, 0.35, 0.295, 0.38, 0.28, 0.01, '#12161a');
          box('glow', 0, 0.35, 0.27, 0.34, 0.24, 0.01, '#fbbf24');
          // Realistic ergonomic handle with comfort grip
          box('metal', 0, 0.34, 0.35, 0.06, 0.36, 0.05, '#c5ccd2', true);
          box('dark', 0, 0.49, 0.33, 0.05, 0.04, 0.06, '#181b20', true);
          box('dark', 0, 0.19, 0.33, 0.05, 0.04, 0.06, '#181b20', true);
          box('dark', 0, 0.34, 0.375, 0.04, 0.26, 0.015, '#2b3038', true);
          // 5. Rear ventilation louvers
          for (let vi = 0; vi < 4; vi++)
            box('dark', 0, 0.65 + vi * 0.06, -0.282, 0.38, 0.02, 0.01, '#0e1013');
        } else if (/mixer/.test(t)) {
          // Artisan Tilt-Head Stand Mixer (Die-cast metal curved neck, stainless steel mixing bowl with handle, speed lever, chrome attachment hub)
          box('metal', 0, 0.05, 0.05, 0.44, 0.10, 0.58, color);
          box('metal', 0, 0.48, -0.16, 0.24, 0.76, 0.24, color);
          box('metal', 0, 0.84, 0.06, 0.26, 0.28, 0.54, color);
          round('metal', 0, 0.96, 0.06, 0.26, 0.14, 0.50, HP.shade(color, 1.05));
          cyl('metal', 0, 0.36, 0.14, 0.42, 0.48, 0.42, '#eef2f6');
          box('metal', 0, 0.36, 0.37, 0.03, 0.30, 0.05, '#c5ccd2', true);
          box('metal', 0.15, 0.82, -0.08, 0.06, 0.02, 0.02, '#d8dee4', true);
          round('dark', 0.18, 0.82, -0.08, 0.03, 0.03, 0.03, '#1b1d22', true);
          cyl('metal', 0, 0.84, 0.34, 0.08, 0.03, 0.08, '#eef2f6', true);
        } else if (/ricecooker/.test(t)) {
          // Luxury Smart Induction Heating (IH) Rice Cooker (Aerodynamic pebble capsule, champagne lid trim, angled Amber LCD panel, steam vent cap)
          // 1. Non-skid rubber feet
          for (const [fx, fz] of [[-0.20, -0.20], [0.20, -0.20], [-0.20, 0.20], [0.20, 0.20]])
            cyl('dark', fx, 0.02, fz, 0.04, 0.03, 0.04, '#111315');
          // 2. Base Chassis in pearl white / obsidian ceramic with smooth rounded profile
          box('ceramic', 0, 0.38, 0, 0.56, 0.70, 0.68, color || '#ffffff');
          round('ceramic', 0, 0.70, 0, 0.54, 0.14, 0.64, HP.shade(color || '#ffffff', 1.02));
          box('metal', 0, 0.58, 0, 0.57, 0.025, 0.69, '#d8dee4', true);
          // 3. Top Hinged Dome Lid
          round('ceramic', 0, 0.76, -0.02, 0.50, 0.18, 0.58, color || '#ffffff');
          box('metal', 0, 0.59, 0.345, 0.18, 0.06, 0.03, '#e2e8f0', true);
          box('dark', 0, 0.59, 0.33, 0.20, 0.07, 0.02, '#1e293b');
          // 4. Angled Top Multi-Function Control Deck
          box('dark', 0, 0.79, 0.06, 0.36, 0.025, 0.28, '#0f172a');
          box('glow', 0, 0.806, 0.04, 0.26, 0.008, 0.14, '#f59e0b', true);
          box('dark', 0, 0.812, 0.04, 0.16, 0.005, 0.06, '#181b20', true);
          round('glow', -0.11, 0.806, 0.15, 0.035, 0.008, 0.035, '#ef4444', true);
          round('glow', 0.11, 0.806, 0.15, 0.035, 0.008, 0.035, '#38bdf8', true);
          for (const bx of [-0.04, 0.04])
            round('metal', bx, 0.806, 0.15, 0.022, 0.006, 0.022, '#cbd5e1', true);
          // 5. Rear Micro-Computerized Steam Exhaust Vent Cap
          box('dark', 0, 0.84, -0.20, 0.16, 0.05, 0.14, '#1e293b');
          cyl('metal', -0.04, 0.87, -0.20, 0.025, 0.02, 0.025, '#94a3b8');
          cyl('metal', 0.04, 0.87, -0.20, 0.025, 0.02, 0.025, '#94a3b8');
          // 6. Integrated Folding Carry Handle resting flush in side contour
          for (const sx of [-0.285, 0.285])
            box('metal', sx, 0.52, 0, 0.015, 0.08, 0.28, '#cbd5e1', true);
        
        } else if (/topvase/.test(t)) {
          // Elegant Fluted Ceramic Bud Vase with Blooming Rose & Foliage
          cyl('ceramic', 0, 0.28, 0, 0.18, 0.46, 0.18, color || '#ffffff');
          cyl('dark', 0, 0.52, 0, 0.08, 0.04, 0.08, '#1e293b');
          cyl('foliage', 0, 0.62, 0, 0.015, 0.22, 0.015, '#15803d');         // stem
          round('fabric', 0, 0.74, 0, 0.16, 0.14, 0.16, '#f43f5e');          // blooming rose
        } else if (/topcandles/.test(t)) {
          // Ultra-Realistic Artisanal Amber Glass Scented Candle Trio with Glowing Teardrop Flames
          const cndl = [
            { x: -0.12, z: 0.05, h: 0.38, r: 0.12, lidX: -0.16, lidZ: 0.17 },
            { x: 0.12, z: 0.05, h: 0.28, r: 0.10, lidX: 0.17, lidZ: 0.15 },
            { x: 0.00, z: -0.11, h: 0.46, r: 0.11, lidX: -0.02, lidZ: -0.22 }
          ];
          for (const c of cndl) {
            // Heavy apothecary amber glass jar with molded base
            cyl('glass', c.x, c.h / 2, c.z, c.r * 2, c.h, c.r * 2, '#d97706'); // amber glass jar
            cyl('ceramic', c.x, c.h * 0.44, c.z, c.r * 1.8, c.h * 0.82, c.r * 1.8, '#fef3c7'); // soy wax fill
            cyl('dark', c.x, c.h * 0.88, c.z, 0.012, 0.03, 0.012, '#181b1e');   // charred cotton wick
            round('glow', c.x, c.h * 0.94, c.z, 0.04, 0.08, 0.04, '#f59e0b');  // golden teardrop flame
            // Gold foil label band around jar
            cyl('metal', c.x, c.h * 0.46, c.z, c.r * 2.02, 0.10, c.r * 2.02, '#c9a44e', true);
            // Brushed brass screw lid resting beside each candle
            cyl('metal', c.lidX, 0.015, c.lidZ, c.r * 1.9, 0.025, c.r * 1.9, '#c9a44e', true);
          }
        } else if (/topterra/.test(t)) {
          // Faceted Brass Geometric Terrarium with Succulents & Charcoal Layers
          box('metal', 0, 0.28, 0, 0.38, 0.46, 0.38, '#c9a44e', true);        // brass edge frame
          box('glass', 0, 0.28, 0, 0.36, 0.44, 0.36, '#d8eef4');              // glass facets
          box('dark', 0, 0.08, 0, 0.34, 0.08, 0.34, '#181b1e');               // charcoal drainage
          box('soil', 0, 0.16, 0, 0.34, 0.08, 0.34, '#fed7aa');               // white sand
          round('foliage', 0, 0.28, 0, 0.18, 0.16, 0.18, '#10b981');           // echeveria rosette
        } else if (/topdiffuser/.test(t)) {
          // Frosted Glass Aromatherapy Reed Diffuser with 6 Natural Rattan Reeds
          cyl('glass', 0, 0.18, 0, 0.18, 0.28, 0.18, '#cbd5e1');              // frosted glass bottle
          cyl('metal', 0, 0.33, 0, 0.08, 0.04, 0.08, '#c9a44e', true);         // brass collar
          for (let r = 0; r < 6; r++) {
            const rang = r * 1.05;
            cyl('wood', Math.cos(rang) * 0.06, 0.54, Math.sin(rang) * 0.06, 0.01, 0.44, 0.01, '#fed7aa');
          }
        } else if (/topframe/.test(t)) {
          // Brushed Brass Portrait Picture Frame with White Mat
          box('metal', 0, 0.28, -0.04, 0.36, 0.46, 0.02, '#c9a44e', true);    // brass frame
          box('ceramic', 0, 0.28, -0.025, 0.30, 0.40, 0.005, '#ffffff');       // white mat
          box('dark', 0, 0.28, -0.02, 0.20, 0.28, 0.005, '#1e293b');          // black & white photo
          box('metal', 0, 0.16, 0.06, 0.03, 0.28, 0.18, '#c9a44e', true);      // easel stand back
        } else if (/topsucculent/.test(t)) {
          // Glazed Speckled Ceramic Succulent Pot with Echeveria Rosette
          cyl('ceramic', 0, 0.14, 0, 0.24, 0.22, 0.24, color || '#ffffff');
          cyl('soil', 0, 0.23, 0, 0.22, 0.04, 0.22, '#475569');               // pebbles
          round('foliage', 0, 0.34, 0, 0.26, 0.18, 0.26, '#34d399');
          round('foliage', 0, 0.42, 0, 0.16, 0.12, 0.16, '#6ee7b7');
        } else if (/topalarm/.test(t)) {
          // Retro Twin-Bell Analog Brass Alarm Clock
          box('metal', 0, 0.20, 0, 0.26, 0.28, 0.14, color || '#c9a44e', true);
          cylZ('ceramic', 0, 0.20, 0.075, 0.22, 0.22, 0.01, '#f8fafc');         // vertical dial face
          cylZ('metal', -0.11, 0.36, 0, 0.08, 0.08, 0.04, '#c9a44e', true);     // left bell
          cylZ('metal', 0.11, 0.36, 0, 0.08, 0.08, 0.04, '#c9a44e', true);      // right bell
          cyl('metal', 0, 0.36, 0, 0.02, 0.04, 0.02, '#c9a44e', true);         // hammer
        } else if (/topknot/.test(t)) {
          // Contemporary Stoneware Ceramic Infinite Knot Sculpture
          round('ceramic', -0.08, 0.18, 0, 0.16, 0.22, 0.16, color || '#f5f5f4');
          round('ceramic', 0.08, 0.18, 0, 0.16, 0.22, 0.16, color || '#f5f5f4');
          round('ceramic', 0, 0.28, 0, 0.22, 0.16, 0.16, color || '#f5f5f4');
        } else if (/topincense/.test(t)) {
          // Cast-Concrete Incense Burner Tray with Brass Sphere
          box('stone', 0, 0.03, 0, 0.44, 0.04, 0.14, '#94a3b8');              // concrete tray
          round('metal', -0.16, 0.07, 0, 0.06, 0.06, 0.06, '#c9a44e', true);   // brass sphere
          cyl('dark', 0.02, 0.18, 0, 0.008, 0.32, 0.008, '#78350f');          // incense stick

        } else if (/bookpile|books/.test(t)) {
          const bc = ['#a03a3a', '#4a6b8a', '#718a68'];
          for (let i = 0; i < 3; i++)
            box('fabric', (i - 1) * 0.02, 0.06 + i * 0.09, 0, 0.4 - i * 0.06, 0.07, 0.28, bc[i]);
        } else if (/fruit|bowl/.test(t)) {
          cyl('ceramic', 0, 0.1, 0, 0.44, 0.18, 0.44, color);
          for (let i = 0; i < 4; i++) {
            const a = i * 1.9;
            round('glow', Math.cos(a) * 0.12, 0.24, Math.sin(a) * 0.12, 0.12, 0.12, 0.12,
              ['#e8a03a', '#a03a3a', '#8fb85a'][i % 3]);
          }
        } else if (/laptop/.test(t)) {
          // Ultra-Realistic 16-inch Precision Aluminum Designer Workstation Laptop (open lid, backlit keyboard, Liquid Retina XDR display)
          const cAlu = color || '#383f48';
          const cAluDark = HP.shade(cAlu, 0.78);
          const cAluLight = HP.shade(cAlu, 1.25);

          // 1. Four micro non-slip rubber feet
          for (const fx of [-0.32, 0.32]) for (const fz of [-0.20, 0.22])
            box('dark', fx, 0.015, fz, 0.04, 0.03, 0.04, '#0f172a');

          // 2. CNC Milled Anodized Aluminum Unibody Bottom Chassis
          box('metal', 0, 0.05, 0.01, 0.76, 0.07, 0.54, cAlu, true);
          // Chamfered front wrist-rest contour with display lift thumb notch
          box('metal', 0, 0.082, 0.275, 0.16, 0.015, 0.02, cAluDark, true);

          // 3. Precision Side Peripheral Ports
          // Left flank: MagSafe 3 charging port with green LED + Dual Thunderbolt 4 / USB-C ports
          box('dark', -0.382, 0.05, -0.14, 0.005, 0.025, 0.04, '#0f172a');
          round('glow', -0.384, 0.05, -0.14, 0.008, 0.008, 0.008, '#22c55e');          // charging LED
          box('dark', -0.382, 0.05, -0.06, 0.005, 0.022, 0.035, '#0f172a');         // TB4 port 1
          box('dark', -0.382, 0.05, 0.02, 0.005, 0.022, 0.035, '#0f172a');          // TB4 port 2
          // Right flank: Full-size HDMI port + 3.5mm headphone jack + SDXC slot
          box('dark', 0.382, 0.05, -0.10, 0.005, 0.024, 0.05, '#0f172a');           // HDMI
          box('dark', 0.382, 0.05, -0.02, 0.005, 0.012, 0.06, '#0f172a');           // SD slot
          cyl('dark', 0.382, 0.05, 0.07, 0.016, 0.005, 0.016, '#0f172a');           // 3.5mm jack

          // 4. Large Haptic Glass Multi-Touch Trackpad
          box('metal', 0, 0.09, 0.16, 0.32, 0.006, 0.22, '#2d333b', true);
          box('glass', 0, 0.094, 0.16, 0.31, 0.002, 0.21, '#1e293b');

          // 5. Recessed Keyboard Deck & Backlit Chiclet Keybed
          box('dark', 0, 0.088, -0.07, 0.68, 0.006, 0.28, '#141619');
          // Soft ambient backlight glow beneath keys
          box('glow', 0, 0.090, -0.07, 0.67, 0.002, 0.27, '#93c5fd');
          // Individual matte black chiclet key rows
          box('dark', 0, 0.094, -0.18, 0.66, 0.008, 0.035, '#1e2124');              // function keys
          box('dark', 0, 0.094, -0.13, 0.66, 0.008, 0.040, '#1e2124');              // number row
          box('dark', 0, 0.094, -0.08, 0.66, 0.008, 0.040, '#1e2124');              // QWERTY row
          box('dark', 0, 0.094, -0.03, 0.66, 0.008, 0.040, '#1e2124');              // ASDF row
          // Centered spacebar & modifier keys
          box('dark', 0, 0.094, 0.03, 0.30, 0.008, 0.045, '#1e2124');               // spacebar
          box('dark', -0.23, 0.094, 0.03, 0.18, 0.008, 0.045, '#1e2124');            // left modifiers
          box('dark', 0.23, 0.094, 0.03, 0.18, 0.008, 0.045, '#1e2124');             // right modifiers & arrows
          // Dual precision stereo speaker perforations flanking keyboard
          box('dark', -0.36, 0.088, -0.07, 0.025, 0.005, 0.26, '#181b1e');
          box('dark', 0.36, 0.088, -0.07, 0.025, 0.005, 0.26, '#181b1e');

          // 6. Cylindrical Magnetic Clutch Hinge Barrel
          cylX('metal', 0, 0.09, -0.23, 0.50, 0.038, 0.038, '#181a1d');

          // 7. Ergonomic Open Display Lid Angled at 108° (rx = -0.32 rad)
          // Aluminum rear display lid casing
          partRotEuler('box', 'metal', 0, 0.52, -0.31, 0.76, 0.88, 0.025, -0.32, 0, 0, cAlu, true);
          // Mirror-finish laser-etched designer brand emblem on rear lid
          partRotEuler('box', 'glass', 0, 0.52, -0.326, 0.10, 0.10, 0.005, -0.32, 0, 0, '#ffffff');
          // Micro-edge dark display bezel
          partRotEuler('box', 'dark', 0, 0.52, -0.295, 0.74, 0.86, 0.010, -0.32, 0, 0, '#090b0e');
          // Liquid Retina XDR screen with deep obsidian background & oceanic wallpaper
          partRotEuler('box', 'glow', 0, 0.51, -0.288, 0.71, 0.82, 0.005, -0.32, 0, 0, '#0b0f19');
          // macOS Sonoma sapphire & twilight gradient wallpaper curves
          partRotEuler('box', 'glow', 0, 0.38, -0.245, 0.71, 0.36, 0.006, -0.32, 0, 0, '#1e3a5f');
          partRotEuler('box', 'glow', 0, 0.24, -0.200, 0.71, 0.20, 0.007, -0.32, 0, 0, '#0f233a');
          // Frosted glass bottom macOS dock
          partRotEuler('box', 'glow', 0, 0.16, -0.170, 0.44, 0.04, 0.008, -0.32, 0, 0, '#1e293b');
          // Centered VS Code Dark IDE editor window
          partRotEuler('box', 'glow', -0.06, 0.56, -0.306, 0.48, 0.46, 0.008, -0.32, 0, 0, '#161b22');
          // Editor titlebar with macOS traffic lights (red, amber, green)
          partRotEuler('box', 'glow', -0.06, 0.76, -0.370, 0.48, 0.04, 0.009, -0.32, 0, 0, '#21262d');
          partRotEuler('sphere', 'glow', -0.26, 0.76, -0.368, 0.012, 0.012, 0.008, -0.32, 0, 0, '#ef4444');
          partRotEuler('sphere', 'glow', -0.23, 0.76, -0.368, 0.012, 0.012, 0.008, -0.32, 0, 0, '#f59e0b');
          partRotEuler('sphere', 'glow', -0.20, 0.76, -0.368, 0.012, 0.012, 0.008, -0.32, 0, 0, '#22c55e');
          // Syntax code lines
          partRotEuler('box', 'glow', -0.04, 0.69, -0.348, 0.38, 0.018, 0.009, -0.32, 0, 0, '#38bdf8');
          partRotEuler('box', 'glow', -0.08, 0.63, -0.328, 0.30, 0.018, 0.009, -0.32, 0, 0, '#34d399');
          partRotEuler('box', 'glow', -0.02, 0.57, -0.308, 0.40, 0.018, 0.009, -0.32, 0, 0, '#fbbf24');
          partRotEuler('box', 'glow', -0.06, 0.51, -0.288, 0.32, 0.018, 0.009, -0.32, 0, 0, '#c084fc');
          partRotEuler('box', 'glow', -0.10, 0.45, -0.268, 0.24, 0.018, 0.009, -0.32, 0, 0, '#38bdf8');
          // Top FaceTime camera notch with lens and activity LED
          partRotEuler('box', 'dark', 0, 0.90, -0.426, 0.14, 0.04, 0.012, -0.32, 0, 0, '#090b0e');
          partRotEuler('sphere', 'glass', 0, 0.90, -0.419, 0.015, 0.015, 0.01, -0.32, 0, 0, '#38bdf8');
          partRotEuler('sphere', 'glow', 0.04, 0.90, -0.419, 0.006, 0.006, 0.006, -0.32, 0, 0, '#22c55e');
        } else {
          box('ceramic', 0, 0.35, 0, 0.4, 0.6, 0.4, color);
        }
        return;
      }
      if (/^clock$|clkgrand|grandfather/.test(t)) {
        // Masterpiece Solid Hardwood Grandfather Longcase Clock (Stepped plinth, beveled glass waist, swinging lyre pendulum & dual brass chime weights, arched bonnet with colonnettes & turned brass finials)
        // 1. Stepped ogee molded plinth base (y=0 to 0.16)
        box('wood', 0, 0.04, 0, 0.88, 0.08, 0.52, color);                      // lower base
        box('wood', 0, 0.10, 0, 0.84, 0.04, 0.50, HP.shade(color, 1.08));     // ogee step molding
        box('wood', 0, 0.14, 0.245, 0.76, 0.04, 0.02, HP.shade(color, 0.95));  // front base panel reveal

        // 2. Central waist column with clear beveled glass pendulum door (y=0.16 to 0.72)
        box('wood', 0, 0.44, -0.04, 0.78, 0.56, 0.44, color);                  // waist carcass
        box('wood', -0.36, 0.44, 0.18, 0.06, 0.56, 0.08, color);               // left front door stile
        box('wood', 0.36, 0.44, 0.18, 0.06, 0.56, 0.08, color);                // right front door stile
        box('glass', 0, 0.44, 0.22, 0.66, 0.54, 0.015, '#dbeafe');             // beveled glass door pane
        box('metal', 0.34, 0.44, 0.23, 0.015, 0.04, 0.015, '#c9a44e', true);  // brass door latch key
        // Pendulum & chime weights inside waist cavity
        cyl('metal', 0, 0.44, 0.08, 0.025, 0.40, 0.025, '#c9a44e');            // center pendulum rod
        cyl('metal', 0, 0.26, 0.08, 0.18, 0.035, 0.18, '#c9a44e');             // heavy polished brass pendulum bob
        cyl('metal', -0.15, 0.52, 0.08, 0.045, 0.22, 0.045, '#c9a44e');         // left brass chime weight
        cyl('metal', 0.15, 0.48, 0.08, 0.045, 0.22, 0.045, '#c9a44e');          // right brass chime weight

        // 3. Arched bonnet hood housing dial face & pediment (y=0.72 to 1.0)
        box('wood', 0, 0.74, 0, 0.84, 0.04, 0.50, HP.shade(color, 1.08));     // waist-to-bonnet transition collar
        box('wood', 0, 0.86, -0.02, 0.86, 0.20, 0.46, color);                  // bonnet hood housing (front z=0.21)
        box('wood', 0, 0.76, 0.215, 0.74, 0.025, 0.02, HP.shade(color, 0.95)); // dial bottom sill
        // Bonnet front arched dial bezel rims (clear of center circular dial)
        box('wood', -0.37, 0.86, 0.215, 0.09, 0.18, 0.02, color);              // left dial frame
        box('wood', 0.37, 0.86, 0.215, 0.09, 0.18, 0.02, color);               // right dial frame
        // Fluted corner colonnettes on bonnet
        cyl('wood', -0.40, 0.86, 0.22, 0.04, 0.22, 0.04, HP.shade(color, 1.15));
        cyl('wood', 0.40, 0.86, 0.22, 0.04, 0.22, 0.04, HP.shade(color, 1.15));
        // Swan-neck scroll pediment crown & turned brass finials
        box('wood', 0, 0.97, 0, 0.88, 0.04, 0.52, HP.shade(color, 1.12));     // top crown cornice
        cyl('metal', 0, 1.01, 0.23, 0.035, 0.05, 0.035, '#c9a44e', true);      // center brass eagle finial
        cyl('metal', -0.40, 0.99, 0.22, 0.025, 0.04, 0.025, '#c9a44e', true);  // left brass ball finial
        cyl('metal', 0.40, 0.99, 0.22, 0.025, 0.04, 0.025, '#c9a44e', true);   // right brass ball finial
      } else if (/^(?:rug|carpet|runner|doormat|bathmat|playmat|yogamat)/i.test(t) || /^rug/i.test(t)) {
        box('fabric', 0, 0.25, 0, 0.98, 0.3, 0.98, color);
        box('fabric', 0, 0.42, 0, 0.83, 0.03, 0.83, '#ddd3c0', true);
      } else if (/pool$|pond/.test(t)) {
        /* a real recessed basin (floor, walls, coping, water surface)
           is built into the ground by world3d — nothing baked here   */
      } else if (/parasol|umbrella|umbstand/.test(t)) {
        cyl('stone', 0, 0.03, 0, 0.4, 0.06, 0.4);
        cyl('wood', 0, 0.55, 0, 0.025, 1.05, 0.025);
        part('cone', 'fabric', 0, 1.02, 0, 1, 0.18, 1, color);
      } else if (/wardrobebig/i.test(t)) {
        // Luxury 4-Cell XL Wardrobe Armoire (50px tall, 4 shaker panel doors, dual storage drawers, brass bar pulls)
        box('dark', 0, 0.03, 0, 0.94, 0.06, 0.84, '#15171a'); // shadow plinth
        box('wood', 0, 0.51, 0, 0.96, 0.88, 0.88, color);     // carcass
        box('wood', 0, 0.97, 0, 0.98, 0.04, 0.90, HP.shade(color, 1.12)); // top crown molding
        // 4 Full-height shaker panel doors
        for (let d = 0; d < 4; d++) {
          const dx = -0.36 + d * 0.24;
          box('wood', dx, 0.51, 0.45, 0.22, 0.84, 0.02, HP.shade(color, 0.96));
          box('wood', dx, 0.51, 0.445, 0.17, 0.76, 0.01, HP.shade(color, 1.04));
          const px = (d % 2 === 0) ? dx + 0.08 : dx - 0.08;
          box('metal', px, 0.50, 0.47, 0.015, 0.22, 0.018, '#c9a44e', true); // brass pull
        }

      } else if (/^vanity$/i.test(t)) {
        // Modern Luxury Makeup Vanity (Fluted walnut drawers, illuminated circular Hollywood mirror, matching stool)
        // 1. Splayed architectural steel legs with brass feet
        for (const [lx, lz] of [[-0.42, 0.32], [0.42, 0.32], [-0.42, -0.32], [0.42, -0.32]]) {
          cyl('dark', lx, 0.20, lz, 0.035, 0.40, 0.035, '#181b1e');
          cyl('metal', lx, 0.02, lz, 0.040, 0.04, 0.040, '#c9a44e', true);
        }
        // Dual drawer pedestals with center kneehole space
        for (const side of [-0.30, 0.30]) {
          box('wood', side, 0.34, 0, 0.32, 0.22, 0.84, color);
          box('wood', side, 0.34, 0.43, 0.28, 0.18, 0.02, HP.shade(color, 1.05));
          box('metal', side, 0.34, 0.445, 0.12, 0.015, 0.015, '#c9a44e', true);
        }
        // Honed white quartz vanity tabletop (y=0.46)
        box('ceramic', 0, 0.47, 0, 0.96, 0.04, 0.88, '#fafaf8');

        // 2. Large Circular Illuminated Hollywood Mirror (y=0.74, diameter=0.48, stands vertical facing +Z)
        cylZ('metal', 0, 0.74, -0.36, 0.48, 0.48, 0.02, '#c9a44e', true); // brass rim frame
        cylZ('glass', 0, 0.74, -0.35, 0.44, 0.44, 0.01, '#d8eef4');       // mirror face
        cylZ('glow', 0, 0.74, -0.345, 0.42, 0.42, 0.005, '#fff4dc');      // soft warm backlight halo

        // 3. Vanity accessories on desk: perfume bottle + jewelry tray
        cyl('glass', 0.32, 0.52, 0.10, 0.04, 0.06, 0.04, '#e0f0f5');
        box('metal', -0.30, 0.495, 0.10, 0.14, 0.01, 0.18, '#c9a44e', true);

      } else if (/^bedbench$/i.test(t)) {
        // Luxury Upholstered End-of-Bed Bench (Channeled bouclé cushion, brass sled base)
        for (const bx of [-0.36, 0.36]) {
          box('metal', bx, 0.04, 0, 0.03, 0.08, 0.76, '#c9a44e', true);
          box('metal', bx, 0.28, 0.34, 0.03, 0.44, 0.03, '#181b1f');
          box('metal', bx, 0.28, -0.34, 0.03, 0.44, 0.03, '#181b1f');
          box('metal', bx, 0.50, 0, 0.03, 0.04, 0.76, '#181b1f');
        }
        box('fabric', 0, 0.56, 0, 0.88, 0.12, 0.82, HP.shade(color, 0.90));
        for (let c = 0; c < 4; c++) {
          const cx = -0.30 + c * 0.20;
          box('fabric', cx, 0.68, 0, 0.18, 0.14, 0.80, color);
          box('fabric', cx, 0.755, 0, 0.16, 0.025, 0.76, HP.shade(color, 1.08));
        }

      } else if (/^hamper$/i.test(t)) {
        // Natural Woven Linen Laundry Hamper (Bamboo rim & lift lid, canvas body, leather handle)
        cyl('dark', 0, 0.03, 0, 0.64, 0.06, 0.64, '#15171a');
        cyl('fabric', 0, 0.52, 0, 0.62, 0.90, 0.62, color || '#e8e2d4');
        cyl('wood', 0, 0.94, 0, 0.65, 0.04, 0.65, '#cf9f70');           // bamboo rim
        cyl('wood', 0, 0.97, 0, 0.62, 0.03, 0.62, '#cf9f70');           // bamboo lid
        box('fabric', 0, 1.01, 0, 0.10, 0.03, 0.04, '#8a5c36');         // leather pull tab

      } else if (/^divider$/i.test(t)) {
        // Luxury Folding Architectural Room Divider (Oak stiles with woven cane rattan colored panels)
        // Restores user-selected color variants (Cane/Cream #f3ebd8, Warm Oak #c8963e, Slate Blue #4d6575)
        // Neutral ends match adjacent dividers perfectly for continuous zero-gap room partitions!
        const sn = getScreenNeighbors();
        const panelCol = color || '#f3ebd8'; // user-selected variant color
        const frameCol = '#2d1b0f';          // solid dark walnut/oak outer frame
        const foldZ = 0.12;                 // normalized fold depth
        const numLeaves = Math.max(2, Math.round((width / HP.CELL) * 2));
        const joints = [];
        for (let i = 0; i <= numLeaves; i++) {
          joints.push({
            x: -0.50 + i * (1.0 / numLeaves),
            z: (i % 2 === 0 ? -foldZ : foldZ)
          });
        }
        // Angled folding leaves with colored cane/fabric inset panels
        for (let i = 0; i < numLeaves; i++) {
          const j0 = joints[i], j1 = joints[i + 1];
          const cx = (j0.x + j1.x) / 2, cz = (j0.z + j1.z) / 2;
          const dx = (j1.x - j0.x) * width, dz = (j1.z - j0.z) * depth;
          const leafLen = Math.hypot(dx, dz) / width;
          const ang = -Math.atan2(dz, dx);
          // 1. Solid wood outer frame (top rail, bottom rail)
          boxRot('wood', cx, 0.965, cz, leafLen - 0.010, 0.05, 0.032, ang, frameCol);
          boxRot('wood', cx, 0.055, cz, leafLen - 0.010, 0.05, 0.032, ang, frameCol);
          // 2. Colored woven cane / fabric inset panel (variant color: cream, amber, or slate blue)
          boxRot('ceramic', cx, 0.51, cz, leafLen - 0.012, 0.86, 0.010, ang, panelCol);
          // 3. Delicate woven rattan accent ribs in coordinating tone
          for (let s = 0; s < 5; s++) {
            const sy = 0.20 + s * 0.15;
            boxRot('wood', cx, sy, cz, leafLen - 0.016, 0.008, 0.016, ang, HP.shade(panelCol, 0.80));
          }
          boxRot('wood', cx, 0.51, cz, 0.008, 0.86, 0.016, ang, HP.shade(panelCol, 0.80));
        }
        // Vertical post stiles at fold joints
        for (let i = 0; i <= numLeaves; i++) {
          if (i === 0 && sn.left) continue;  // share hinge with left neighbor
          if (i === numLeaves && sn.right) continue; // share hinge with right neighbor
          const j = joints[i];
          box('wood', j.x, 0.50, j.z, 0.024, 0.98, 0.034, frameCol);
          // Brass foot ferrule
          box('metal', j.x, 0.025, j.z, 0.028, 0.05, 0.038, '#c9a44e');
          // Cylindrical brass folding hinges
          for (const hy of [0.18, 0.50, 0.82]) {
            cylZ('metal', j.x, hy, j.z, 0.018, 0.045, 0.024, '#c9a44e');
          }
        }

      } else if (/^toilet$/i.test(t)) {
        // Modern Minimalist Dual-Flush Rimless Porcelain Toilet (Sculpted ceramic cistern, chrome flush buttons, contoured bowl, soft-close lid)
        // 1. Sleek skirted porcelain floor pedestal & bowl (y=0 to 0.44 = 42cm sitting height)
        box('ceramic', 0, 0.16, 0.04, 0.46, 0.32, 0.58, '#fafaf8');           // skirted base pedestal
        round('ceramic', 0, 0.34, 0.10, 0.48, 0.22, 0.56, '#fafaf8');         // contoured ergonomic bowl
        // Inner bowl cavity / water surface
        cyl('dark', 0, 0.35, 0.12, 0.36, 0.08, 0.42, '#202428', true);        // interior trapway cavity
        cyl('water', 0, 0.32, 0.12, 0.32, 0.02, 0.36, '#60a5fa', true);       // clean water pool
        // Soft-close contoured seat & closed lid (perfectly continuous from hinges forward to bowl tip)
        box('ceramic', 0, 0.445, 0.10, 0.50, 0.030, 0.58, '#ffffff');         // seat ring
        box('ceramic', 0, 0.470, 0.10, 0.48, 0.022, 0.56, '#f8f8f6');         // lid
        // Chrome dual soft-close seat hinge brackets
        for (const hx of [-0.14, 0.14]) {
          cyl('metal', hx, 0.45, -0.16, 0.035, 0.03, 0.035, '#c5ccd2', true); // chrome hinge post
          cylX('metal', hx, 0.465, -0.16, 0.04, 0.016, 0.016, '#94a3b8', true);
        }

        // 2. Geometric ceramic water tank cistern (y=0.44 to 0.88)
        box('ceramic', 0, 0.66, -0.22, 0.50, 0.42, 0.26, '#fafaf8');
        box('ceramic', 0, 0.88, -0.22, 0.52, 0.03, 0.28, '#ffffff');          // beveled cistern lid
        // Dual-flush circular polished chrome buttons on top
        cyl('metal', 0, 0.902, -0.22, 0.09, 0.015, 0.09, '#c5ccd2', true);
        box('dark', 0, 0.908, -0.22, 0.005, 0.016, 0.08, '#1a1d20', true);   // button split line
        // Chrome water supply shut-off valve & braided line on lower left rear
        cyl('metal', -0.24, 0.12, -0.20, 0.025, 0.08, 0.025, '#94a3b8', true); // supply pipe
        cylX('metal', -0.22, 0.12, -0.20, 0.05, 0.02, 0.02, '#c5ccd2', true);  // chrome oval valve handle

      } else if (/^bidet$/i.test(t)) {
        // Modern Matching Ceramic Bidet (Contoured bowl, chrome mixer faucet & pop-up drain)
        box('ceramic', 0, 0.18, 0.04, 0.50, 0.36, 0.68, '#fafaf8');
        cyl('ceramic', 0, 0.38, 0.08, 0.50, 0.18, 0.58, '#fafaf8');
        box('ceramic', 0, 0.46, 0.08, 0.52, 0.03, 0.62, '#ffffff');
        // Chrome mixer tap & nozzle
        box('metal', 0, 0.54, -0.18, 0.06, 0.12, 0.06, '#c5ccd2', true);
        box('metal', 0, 0.58, -0.10, 0.04, 0.03, 0.12, '#c5ccd2', true);   // spout
        cyl('metal', 0, 0.32, 0.08, 0.06, 0.01, 0.06, '#c5ccd2', true);    // pop-up drain

      } else if (/^bsink$|bath.*vanity/i.test(t)) {
        // Luxury Floating Bathroom Vanity (Undermount porcelain basin, tall matte black / brass gooseneck faucet, walnut fluted drawers)
        // 1. Recessed dark floating shadow reveal plinth
        box('dark', 0, 0.08, 0, 0.88, 0.16, 0.82, '#15171a');
        // Main vanity credenza with soft-close fluted drawers
        box('wood', 0, 0.48, 0, 0.94, 0.60, 0.86, color);
        for (let r = 0; r < 2; r++) {
          const dy = 0.32 + r * 0.28;
          box('wood', 0, dy, 0.44, 0.90, 0.24, 0.02, HP.shade(color, 1.04));
          box('metal', 0, dy + 0.08, 0.455, 0.22, 0.015, 0.015, '#c9a44e', true);
        }

        // 2. Seamless Honed White Carrara Quartz Countertop & Deep Undermount Basin
        box('ceramic', 0, 0.79, 0, 0.96, 0.05, 0.90, '#fafaf8');
        // Undermount porcelain sink bowl cavity
        box('ceramic', 0, 0.72, 0.04, 0.54, 0.10, 0.48, '#eae8e2');
        cyl('metal', 0, 0.68, 0.04, 0.07, 0.01, 0.07, '#15171a', true);    // black drain

        // 3. Tall Architectural Matte Black Gooseneck Faucet
        cyl('metal', 0, 0.87, -0.24, 0.03, 0.16, 0.03, '#181b1f', true);   // vertical column
        box('metal', 0, 0.96, -0.18, 0.03, 0.025, 0.14, '#181b1f', true);  // forward gooseneck
        box('metal', 0, 0.93, -0.11, 0.025, 0.04, 0.025, '#181b1f', true); // aerator head
        cyl('metal', 0.14, 0.85, -0.24, 0.03, 0.06, 0.03, '#c9a44e', true); // single lever handle

      } else if (/^bsink2$|double.*vanity/i.test(t)) {
        // Luxury 3-Cell Double Vanity with Dual Basins and Backlit Mirror
        box('dark', 0, 0.08, 0, 0.92, 0.16, 0.82, '#15171a');
        box('wood', 0, 0.48, 0, 0.96, 0.60, 0.86, color);
        // 4 Drawer bays with brass pulls
        for (const col of [-0.26, 0.26]) {
          for (let r = 0; r < 2; r++) {
            const dy = 0.32 + r * 0.28;
            box('wood', col, dy, 0.44, 0.44, 0.24, 0.02, HP.shade(color, 1.04));
            box('metal', col, dy + 0.08, 0.455, 0.18, 0.015, 0.015, '#c9a44e', true);
          }
        }
        // Quartz top with dual undermount basins
        box('ceramic', 0, 0.79, 0, 0.98, 0.05, 0.90, '#fafaf8');
        for (const bx of [-0.26, 0.26]) {
          box('ceramic', bx, 0.72, 0.04, 0.38, 0.10, 0.48, '#eae8e2');
          cyl('metal', bx, 0.68, 0.04, 0.06, 0.01, 0.06, '#15171a', true);
          // Gooseneck faucet
          cyl('metal', bx, 0.87, -0.24, 0.025, 0.16, 0.025, '#181b1f', true);
          box('metal', bx, 0.96, -0.18, 0.025, 0.025, 0.14, '#181b1f', true);
        }

      } else if (/^bathtub$|soaking.*tub/i.test(t)) {
        // Luxury Freestanding Architectural Soaking Bathtub (Sculpted oval egg silhouette, floor-mounted chrome pillar faucet & hand spray)
        // 1. Sculptural organic oval porcelain tub shell (y=0 to 0.84 = 18px height)
        round('ceramic', 0, 0.48, 0, 0.94, 0.76, 0.88, '#fafaf8');
        // Tub cavity
        round('ceramic', 0, 0.52, 0, 0.82, 0.68, 0.78, '#f0eee8');
        // Gentle rippling water line fitting smoothly inside the oval cavity with zero clipping
        round('water', 0, 0.58, 0, 0.72, 0.12, 0.68, '#38bdf8');
        cyl('metal', -0.28, 0.20, 0, 0.06, 0.01, 0.06, '#c5ccd2');     // chrome pop-up drain

        // 2. Floor-Mounted Polished Chrome Pillar Faucet & Hand Spray (at side)
        cyl('metal', 0.42, 0.50, 0, 0.035, 0.96, 0.035, '#c5ccd2');    // vertical pillar
        box('metal', 0.36, 0.94, 0, 0.14, 0.03, 0.04, '#c5ccd2');     // curved spout
        cyl('metal', 0.42, 0.78, -0.06, 0.02, 0.12, 0.02, '#c5ccd2');  // hand shower wand

      } else if (/^shower$/i.test(t)) {
        // Modern Frameless Glass Walk-In Shower (2x2 footprint, 52px tall, low-profile slate pan, 10mm tempered glass, stainless rain head & thermostatic valve)
        // 1. Honed charcoal slate low-profile shower pan / curb (y=0 to 0.06)
        box('stone', 0, 0.03, 0, 0.98, 0.06, 0.98, '#26282b');
        cyl('metal', 0, 0.062, 0, 0.09, 0.005, 0.09, '#15171a', true);       // central square drain

        // 2. Frameless 10mm crystal tempered glass walls (rises to y=0.96 = 50px!)
        box('glass', -0.46, 0.50, 0.02, 0.025, 0.94, 0.94, '#a4d4dc');       // left glass wall
        box('glass', 0.02, 0.50, -0.46, 0.94, 0.94, 0.025, '#a4d4dc');       // rear glass wall
        box('glass', 0.46, 0.50, -0.16, 0.025, 0.94, 0.60, '#a4d4dc');       // right glass panel (open walk-in entry)

        // Minimalist matte black / chrome wall hardware clamps
        for (const cy of [0.24, 0.74]) {
          box('metal', -0.46, cy, -0.46, 0.04, 0.04, 0.04, '#181b1f', true);
        }

        // 3. Luxury Stainless Steel Ceiling/Wall Rain Showerhead & Controls
        cyl('metal', 0, 0.94, -0.32, 0.02, 0.10, 0.02, '#c5ccd2', true);     // pipe arm
        cyl('metal', 0, 0.89, -0.32, 0.22, 0.02, 0.22, '#c5ccd2', true);     // 10" circular rain head
        // Thermostatic mixing valve + hand spray wand on rear wall
        cyl('metal', -0.18, 0.48, -0.44, 0.05, 0.03, 0.05, '#c5ccd2', true);
        box('metal', -0.18, 0.56, -0.43, 0.025, 0.16, 0.03, '#c5ccd2', true);

      } else if (/showerbench/i.test(t)) {
        // Natural Slatted Teak Wood Spa Shower Bench
        for (const [lx, lz] of [[-0.38, 0.32], [0.38, 0.32], [-0.38, -0.32], [0.38, -0.32]]) {
          box('wood', lx, 0.30, lz, 0.06, 0.60, 0.06, '#8b5a2b');
          box('dark', lx, 0.03, lz, 0.07, 0.06, 0.07, '#15171a'); // rubber foot pads
        }
        // Slatted teak seat top with drainage gaps
        for (let s = -0.30; s <= 0.30; s += 0.15) {
          box('wood', 0, 0.64, s, 0.88, 0.04, 0.10, '#a06832');
        }

      } else if (/^bathmat$/i.test(t)) {
        // Plush Ribbed Memory Foam Bath Rug (Subtle textured weave)
        box('fabric', 0, 0.50, 0, 0.96, 0.80, 0.94, color);
        for (let r = -0.36; r <= 0.36; r += 0.18) {
          box('fabric', 0, 0.58, r, 0.92, 0.20, 0.08, HP.shade(color, 1.08));
        }

      } else if (/^linen$/i.test(t)) {
        // Tall Modern Bathroom Linen Cabinet (48px tall, open towel cubbies + lower cabinet)
        box('dark', 0, 0.03, 0, 0.90, 0.06, 0.84, '#15171a');
        box('wood', 0, 0.51, 0, 0.94, 0.88, 0.88, color);
        box('wood', 0, 0.97, 0, 0.96, 0.04, 0.90, HP.shade(color, 1.10));
        // Lower closed cabinet door
        box('wood', 0, 0.26, 0.44, 0.88, 0.44, 0.02, HP.shade(color, 0.96));
        box('metal', 0.34, 0.34, 0.455, 0.02, 0.14, 0.02, '#c9a44e', true);
        // Upper open cubbies with rolled & folded fluffy towels
        for (const ty of [0.58, 0.78]) {
          box('wood', 0, ty - 0.02, 0.02, 0.88, 0.025, 0.84, HP.shade(color, 1.05));
          // Stack of plush white/seafoam towels
          box('fabric', 0, ty + 0.05, 0.04, 0.68, 0.08, 0.60, '#f2ede4');
          box('fabric', 0, ty + 0.12, 0.04, 0.64, 0.06, 0.56, '#c4ded8');
        }

      } else if (/bathscale/i.test(t)) {
        // Ultra-Thin Tempered Glass Digital Bathroom Scale (Silver electrodes & LED readout)
        box('glass', 0, 0.40, 0, 0.88, 0.40, 0.88, '#d4eef4');
        box('metal', 0, 0.15, 0, 0.84, 0.30, 0.84, '#c5ccd2');
        // Electrode stripes
        box('metal', -0.22, 0.62, 0, 0.10, 0.02, 0.74, '#e2e8f0', true);
        box('metal', 0.22, 0.62, 0, 0.10, 0.02, 0.74, '#e2e8f0', true);
        box('dark', 0, 0.62, -0.24, 0.26, 0.02, 0.12, '#15171a');
        box('glow', 0, 0.63, -0.24, 0.18, 0.01, 0.06, '#60a5fa');          // digital LED display

      } else if (/bathcaddy/i.test(t)) {
        // Expandable Natural Bamboo Bathtub Caddy Bridge Tray
        box('wood', 0, 0.50, 0, 0.98, 0.30, 0.80, '#cf9f70');
        box('wood', 0, 0.68, -0.32, 0.92, 0.10, 0.06, '#b88a5a');          // back rail
        box('wood', 0, 0.68, 0.32, 0.92, 0.10, 0.06, '#b88a5a');           // front rail
        // Wire book stand / candle slot
        box('metal', 0, 0.85, 0, 0.38, 0.30, 0.02, '#181b1f', true);
        cyl('ceramic', 0.26, 0.75, 0, 0.12, 0.16, 0.12, '#fafaf8');        // scented candle

      } else if (/washer/i.test(t)) {
        // Modern Front-Loading Smart Washing Machine (Zero z-fighting, complete circular porthole door)
        box('dark', 0, 0.03, 0, 0.90, 0.06, 0.86, '#15171a');
        box('ceramic', 0, 0.435, -0.02, 0.96, 0.75, 0.88, '#f8fafc');
        box('dark', 0, 0.87, 0.00, 0.94, 0.12, 0.89, '#1e293b');
        cylZ('metal', 0, 0.87, 0.465, 0.10, 0.10, 0.025, '#c5ccd2', true);
        box('glow', 0.26, 0.87, 0.458, 0.22, 0.06, 0.012, '#38bdf8');
        box('metal', -0.26, 0.87, 0.456, 0.20, 0.06, 0.012, '#cbd5e1');
        box('ceramic', 0, 0.95, 0, 0.98, 0.04, 0.92, '#e2e8f0');

        cylZ('metal', 0, 0.45, 0.445, 0.58, 0.58, 0.035, '#94a3b8', true);
        cylZ('glass', 0, 0.45, 0.452, 0.46, 0.46, 0.025, '#0f172a');
        cylZ('dark',  0, 0.45, 0.415, 0.42, 0.42, 0.040, '#334155');
        box('metal', 0.25, 0.45, 0.468, 0.03, 0.12, 0.015, '#cbd5e1', true);

      } else if (/dryer/i.test(t)) {
        box('dark', 0, 0.03, 0, 0.90, 0.06, 0.86, '#15171a');
        box('ceramic', 0, 0.435, -0.02, 0.96, 0.75, 0.88, '#f8fafc');
        box('dark', 0, 0.87, 0.00, 0.94, 0.12, 0.89, '#1e293b');
        cylZ('metal', 0, 0.87, 0.465, 0.10, 0.10, 0.025, '#c5ccd2', true);
        box('glow', 0.26, 0.87, 0.458, 0.22, 0.06, 0.012, '#fb923c');
        box('metal', -0.26, 0.87, 0.456, 0.20, 0.06, 0.012, '#cbd5e1');
        box('ceramic', 0, 0.95, 0, 0.98, 0.04, 0.92, '#e2e8f0');

        cylZ('metal', 0, 0.45, 0.445, 0.58, 0.58, 0.035, '#94a3b8', true);
        cylZ('glass', 0, 0.45, 0.452, 0.46, 0.46, 0.025, '#1e293b');
        cylZ('dark',  0, 0.45, 0.415, 0.42, 0.42, 0.040, '#475569');
        box('metal', 0.25, 0.45, 0.468, 0.03, 0.12, 0.015, '#cbd5e1', true);

      } else if (/^gamingdesk$/i.test(t)) {
        // Ultra-Realistic RGB Battle Station Gaming Desk (Custom Water-Cooled Tower PC, Dual Curved 32" Monitors, Boom Mic, Stream Deck, RGB Mechanical Peripherals)
        // 1. Z-shaped heavy black steel gaming legs with red racing accents
        for (const sx of [-0.42, 0.42]) {
          box('dark', sx, 0.04, 0, 0.06, 0.08, 0.84, '#15171a');             // bottom floor runner
          box('metal', sx, 0.44, 0, 0.05, 0.80, 0.08, '#1e2124', true);       // angled Z-leg upright
          box('metal', sx, 0.88, 0, 0.06, 0.06, 0.84, '#15171a', true);       // top mounting bar
          box('glow', sx, 0.44, 0.05, 0.02, 0.70, 0.01, '#ef4444');          // red racing stripe accent
        }
        // Heavy steel cross-brace
        box('dark', 0, 0.50, -0.32, 0.80, 0.04, 0.04, '#181b1e');

        // 2. Beveled carbon fiber texture desktop (y=0.92 = 23px)
        box('dark', 0, 0.92, 0, 0.96, 0.04, 0.90, '#1a1d20');
        box('dark', 0, 0.942, 0, 0.94, 0.008, 0.88, '#111315');              // carbon fiber top surface
        // RGB edge ambient light strips on left, right, and rear
        box('glow', 0, 0.92, -0.445, 0.92, 0.02, 0.01, '#a855f7');           // purple ambient glow
        box('glow', -0.475, 0.92, 0, 0.01, 0.02, 0.86, '#06b6d4');           // cyan side glow
        box('glow', 0.475, 0.92, 0, 0.01, 0.02, 0.86, '#06b6d4');

        // 3. Custom Water-Cooled High-End RGB Gaming Tower PC (sitting on right wing)
        // Matte black ATX gaming chassis
        box('metal', 0.36, 1.18, -0.16, 0.18, 0.44, 0.38, '#111315', true);
        // Tempered glass side window panel facing player
        box('glass', 0.268, 1.18, -0.16, 0.008, 0.40, 0.34, '#a5f3fc');
        // Interior motherboard tray with metal heatsinks
        box('dark', 0.36, 1.18, -0.16, 0.15, 0.38, 0.32, '#181b1e');
        // Illuminated CPU waterblock with addressable RGB halo ring
        round('glow', 0.35, 1.28, -0.16, 0.04, 0.04, 0.04, '#06b6d4');
        // Dual illuminated liquid cooling tubes curving through chassis
        cyl('glow', 0.35, 1.20, -0.14, 0.012, 0.18, 0.012, '#8b5cf6');       // deep UV violet tube
        cyl('glow', 0.35, 1.20, -0.19, 0.012, 0.18, 0.012, '#06b6d4');       // electric cyan coolant tube
        // High-end GeForce RTX style GPU with RGB illuminated logo bar
        box('metal', 0.34, 1.14, -0.16, 0.09, 0.06, 0.28, '#26292e', true);
        box('glow', 0.292, 1.14, -0.16, 0.004, 0.015, 0.22, '#22c55e');       // RTX green logo glow
        // Glowing RGB DDR5 RAM sticks
        box('glow', 0.35, 1.30, -0.22, 0.008, 0.05, 0.03, '#a855f7');
        box('glow', 0.35, 1.30, -0.20, 0.008, 0.05, 0.03, '#06b6d4');
        // Dual front intake circular RGB fans
        cylZ('glow', 0.36, 1.28, 0.032, 0.06, 0.06, 0.004, '#06b6d4');
        cylZ('glow', 0.36, 1.10, 0.032, 0.06, 0.06, 0.004, '#38bdf8');
        // Power button & top USB 3.2 ports
        round('glow', 0.36, 1.402, 0.01, 0.006, 0.006, 0.006, '#ffffff');

        // 4. Dual 32" Curved Frameless Ultra-Wide Gaming Monitors on Gas-Spring Mount (True 16:9 Cockpit)
        // Heavy-duty dual articulated steel desk clamp
        cyl('metal', -0.06, 0.96, -0.36, 0.04, 0.04, 0.04, '#15171a', true);   // desk clamp
        cyl('metal', -0.06, 1.16, -0.38, 0.03, 0.40, 0.03, '#15171a', true);   // vertical post
        // Articulated gas-spring dual arms branching to both monitors
        boxRot('metal', -0.14, 1.28, -0.32, 0.16, 0.03, 0.025, 0.40, '#26292e', true);
        boxRot('metal', 0.04, 1.28, -0.32, 0.16, 0.03, 0.025, -0.40, '#26292e', true);

        // Monitor 1: Left 32" 16:9 Curved Gaming Monitor (Cockpit angled at +18° towards gamer)
        // Real-world 32" 16:9: casing 21.5px wide x 12.5px tall (w=0.265, h=0.50), center y=1.34, x=-0.20, z=-0.22, ry=0.32 rad
        boxRot('metal', -0.20, 1.34, -0.22, 0.265, 0.50, 0.02, 0.32, '#181b1e', true);
        boxRot('dark', -0.20, 1.34, -0.208, 0.252, 0.475, 0.005, 0.32, '#0b0f19');
        boxRot('glow', -0.20, 1.34, -0.204, 0.244, 0.455, 0.004, 0.32, '#0284c7'); // neon blue tactical battlefield
        boxRot('glow', -0.20, 1.22, -0.201, 0.244, 0.14, 0.005, 0.32, '#0369a1');  // darker terrain
        boxRot('glow', -0.24, 1.16, -0.198, 0.10, 0.06, 0.006, 0.32, '#22c55e');   // health & ammo HUD
        boxRot('glow', -0.16, 1.48, -0.198, 0.08, 0.04, 0.006, 0.32, '#f59e0b');   // radar compass
        // Ambient RGB halo ring on back of left monitor
        boxRot('glow', -0.20, 1.34, -0.235, 0.16, 0.30, 0.005, 0.32, '#06b6d4');   // cyan wall wash

        // Monitor 2: Center-Right 32" 16:9 Curved Gaming Monitor (Cockpit angled at -18° towards gamer)
        // Real-world 32" 16:9: casing 21.5px wide x 12.5px tall (w=0.265, h=0.50), center y=1.34, x=+0.06, z=-0.22, ry=-0.32 rad
        boxRot('metal', 0.06, 1.34, -0.22, 0.265, 0.50, 0.02, -0.32, '#181b1e', true);
        boxRot('dark', 0.06, 1.34, -0.208, 0.252, 0.475, 0.005, -0.32, '#070a12');
        boxRot('glow', 0.06, 1.34, -0.204, 0.244, 0.455, 0.004, -0.32, '#1e293b'); // cyberpunk night cityscape
        boxRot('glow', 0.06, 1.22, -0.201, 0.244, 0.16, 0.005, -0.32, '#0284c7');  // deep azure reflection
        boxRot('glow', 0.06, 1.26, -0.199, 0.20, 0.06, 0.006, -0.32, '#06b6d4');   // tactical cyan data stream
        boxRot('glow', 0.03, 1.46, -0.198, 0.12, 0.05, 0.006, -0.32, '#38bdf8');   // quest tracker
        // Ambient RGB halo ring on back of right monitor
        boxRot('glow', 0.06, 1.34, -0.235, 0.16, 0.30, 0.005, -0.32, '#06b6d4');   // cyan wall wash

        // 5. Studio Broadcast Condenser Microphone on Adjustable Boom Arm
        cyl('metal', -0.42, 0.96, -0.28, 0.03, 0.04, 0.03, '#15171a', true);   // desk clamp
        cyl('metal', -0.36, 1.12, -0.22, 0.015, 0.28, 0.015, '#1e2124', true); // lower boom arm
        cyl('metal', -0.28, 1.24, -0.10, 0.015, 0.24, 0.015, '#1e2124', true); // upper boom arm
        round('metal', -0.22, 1.16, 0.00, 0.03, 0.03, 0.03, '#2d333b', true);  // shock mount
        cyl('dark', -0.22, 1.16, 0.00, 0.025, 0.08, 0.025, '#15171a');         // mic capsule
        cyl('metal', -0.22, 1.19, 0.00, 0.026, 0.03, 0.026, '#c5ccd2', true);  // chrome pop grille

        // 6. Extended XXL RGB Gaming Mousepad, Keyboard & Peripherals
        box('fabric', -0.06, 0.95, 0.08, 0.62, 0.01, 0.46, '#0f172a');
        box('glow', -0.06, 0.952, 0.08, 0.61, 0.005, 0.45, '#38bdf8');         // neon blue stitch
        // Mechanical RGB tenkeyless keyboard with pudding keycaps
        box('dark', -0.12, 0.96, 0.12, 0.28, 0.018, 0.12, '#181b1e');
        for (let k = 0; k < 3; k++)
          box('glow', -0.12, 0.97, 0.09 + k * 0.03, 0.26, 0.006, 0.018, '#38bdf8');
        // Ergonomic gaming mouse with glowing scroll wheel & RGB logo
        box('dark', 0.10, 0.96, 0.14, 0.06, 0.018, 0.10, '#111315');
        round('glow', 0.10, 0.97, 0.15, 0.02, 0.008, 0.03, '#22c55e');
        // Stream Deck macro keypad with 12 illuminated shortcut buttons
        box('dark', -0.32, 0.96, 0.14, 0.08, 0.02, 0.10, '#181a1d');
        for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++)
          round('glow', -0.345 + c * 0.018, 0.972, 0.11 + r * 0.025, 0.006, 0.004, 0.006, ['#38bdf8','#8b5cf6','#f59e0b'][(r+c)%3]);

        // 7. Headphone hanger + gaming headset on left, aluminum cup holder on right
        box('metal', -0.48, 0.88, 0.28, 0.02, 0.08, 0.08, '#15171a', true);
        cyl('dark', -0.48, 0.82, 0.28, 0.06, 0.08, 0.06, '#181b1e');          // headphones
        box('glow', -0.48, 0.82, 0.28, 0.065, 0.01, 0.065, '#06b6d4');         // RGB ring on earcups
        cyl('metal', 0.48, 0.88, 0.28, 0.08, 0.06, 0.08, '#3b82f6', true);    // aluminum water tumbler

      } else if (/^gamingchair$/i.test(t)) {
        // High-Back Racing Bucket Gaming Chair (36px tall, 5-star caster base, lumbar pillow, headrest cushion, 3D armrests)
        // 1. 5-Star heavy black nylon caster base with red accents
        cyl('dark', 0, 0.06, 0, 0.10, 0.12, 0.10, '#15171a');
        for (let i = 0; i < 5; i++) {
          const a = (i * 2 * Math.PI) / 5;
          const lx = Math.cos(a) * 0.36, lz = Math.sin(a) * 0.36;
          box('dark', lx * 0.5, 0.06, lz * 0.5, 0.05, 0.04, 0.34, '#15171a');
          cyl('dark', lx, 0.03, lz, 0.04, 0.06, 0.04, '#111315');            // twin casters
          box('glow', lx * 0.6, 0.08, lz * 0.6, 0.02, 0.01, 0.12, '#ef4444'); // racing red tip
        }
        // Pneumatic hydraulic gas lift cylinder
        cyl('metal', 0, 0.22, 0, 0.04, 0.24, 0.04, '#c5ccd2', true);

        // 2. Contoured racing bucket seat cushion with side bolsters (y=0.38)
        box('fabric', 0, 0.36, 0.02, 0.52, 0.10, 0.56, '#181a1d');          // center seat
        box('fabric', -0.26, 0.40, 0.02, 0.08, 0.14, 0.54, '#ef4444');        // left racing red bolster
        box('fabric', 0.26, 0.40, 0.02, 0.08, 0.14, 0.54, '#ef4444');         // right racing red bolster

        // 3. Ergonomic 3D armrests with polyurethane pads
        for (const side of [-0.32, 0.32]) {
          box('metal', side, 0.46, 0.02, 0.03, 0.18, 0.04, '#1e2124', true); // T-bracket
          box('dark', side, 0.55, 0.04, 0.08, 0.03, 0.28, '#111315');        // armrest pad
        }

        // 4. Tall Ergonomic Bucket Backrest with Shoulder Wings (rises to y=0.98 = 36px)
        box('fabric', 0, 0.68, -0.22, 0.48, 0.60, 0.08, '#181a1d');          // main backrest
        box('fabric', -0.24, 0.70, -0.20, 0.08, 0.56, 0.09, '#ef4444');       // left shoulder wing
        box('fabric', 0.24, 0.70, -0.20, 0.08, 0.56, 0.09, '#ef4444');        // right shoulder wing
        // Dual harness pass-through ventilation cutouts
        for (const hx of [-0.10, 0.10]) {
          box('dark', hx, 0.84, -0.22, 0.06, 0.04, 0.10, '#111315');
        }

        // 5. Memory Foam Lumbar Support & Integrated Headrest Pillow
        box('fabric', 0, 0.48, -0.17, 0.36, 0.14, 0.07, '#ef4444');          // lumbar pillow
        box('fabric', 0, 0.94, -0.18, 0.30, 0.10, 0.06, '#ef4444');          // headrest pillow
        box('fabric', 0, 0.94, -0.15, 0.16, 0.04, 0.02, '#ffffff');          // embroidered logo

      } else if (/^offchair$|office.*chair/i.test(t)) {
        // Modern Ergonomic Executive Task Chair (Breathable mesh back, 5-star aluminum caster base, adjustable lumbar, 34px height)
        // 1. Polished aluminum 5-star caster base
        cyl('metal', 0, 0.06, 0, 0.08, 0.10, 0.08, '#c5ccd2', true);
        for (let i = 0; i < 5; i++) {
          const a = (i * 2 * Math.PI) / 5;
          const lx = Math.cos(a) * 0.36, lz = Math.sin(a) * 0.36;
          box('metal', lx * 0.5, 0.06, lz * 0.5, 0.04, 0.03, 0.34, '#c5ccd2', true);
          cyl('dark', lx, 0.03, lz, 0.04, 0.06, 0.04, '#15171a');
        }
        cyl('metal', 0, 0.20, 0, 0.035, 0.22, 0.035, '#c5ccd2', true);

        // 2. Sculptured waterfall upholstered seat cushion (sitting height y=0.38)
        box('fabric', 0, 0.36, 0.02, 0.56, 0.09, 0.54, color || '#22252a');
        box('fabric', 0, 0.38, 0.26, 0.52, 0.05, 0.06, HP.shade(color || '#22252a', 0.9)); // waterfall front

        // 3. Cantilevered adjustable armrests with soft PU pads
        for (const side of [-0.32, 0.32]) {
          box('metal', side, 0.44, 0.02, 0.03, 0.16, 0.04, '#8a949e', true);
          box('dark', side, 0.52, 0.04, 0.08, 0.025, 0.26, '#181a1d');
        }

        // 4. Breathable Ergonomic Mesh High-Back Frame with Spine Support
        box('dark', 0, 0.68, -0.24, 0.50, 0.58, 0.04, '#181b1e');           // outer frame
        box('dark', 0, 0.68, -0.235, 0.44, 0.52, 0.015, '#262a30');          // tension mesh back
        // Integrated dynamic lumbar support pad
        box('dark', 0, 0.52, -0.21, 0.38, 0.12, 0.04, '#111315');
        // Integrated headrest
        box('dark', 0, 0.98, -0.24, 0.28, 0.08, 0.05, '#181b1e');
        box('fabric', 0, 0.98, -0.22, 0.24, 0.07, 0.03, color || '#22252a');

      } else if (/^deskl$|l-desk|corner.*desk/i.test(t)) {
        // Modern Executive L-Shaped Corner Desk (3x3 footprint, chamfered walnut tops, modesty panel, filing pedestal, monitor arm)
        // 1. Minimalist architectural matte black steel legs
        for (const [lx, lz] of [[-0.44, 0.42], [-0.44, -0.42], [0.42, -0.42], [0.42, 0.06], [-0.06, 0.42]]) {
          cyl('dark', lx, 0.44, lz, 0.035, 0.88, 0.035, '#181a1d');
          cyl('metal', lx, 0.02, lz, 0.04, 0.04, 0.04, '#c9a44e', true);
        }
        // 2. L-Shaped Desktop (Main desk along rear, return along left)
        box('wood', 0, 0.92, -0.16, 0.92, 0.05, 0.58, color);                 // main desk top
        box('wood', -0.22, 0.92, 0.20, 0.48, 0.05, 0.44, color);              // return desk top
        box('dark', 0, 0.885, -0.16, 0.90, 0.02, 0.56, '#181b1e');           // shadow reveal

        // 3. Integrated 3-drawer filing pedestal under return
        box('wood', -0.28, 0.44, 0.20, 0.32, 0.82, 0.40, color);
        for (let r = 0; r < 3; r++) {
          const dy = 0.20 + r * 0.26;
          box('wood', -0.28, dy, 0.41, 0.28, 0.23, 0.02, HP.shade(color, 1.04));
          box('metal', -0.28, dy + 0.08, 0.425, 0.12, 0.015, 0.015, '#c9a44e', true);
        }

        // 4. Heavy-Duty Articulated Dual Monitor Arm & 38" Curved Ultra-Wide Display with Screenbar Lamp (True 21:9 Aspect Ratio)
        cyl('metal', 0.10, 1.02, -0.38, 0.04, 0.18, 0.04, '#15171a', true);   // heavy desk clamp
        cyl('metal', 0.10, 1.20, -0.36, 0.03, 0.36, 0.03, '#1e2124', true);   // vertical post & gas-arm
        box('metal', 0.10, 1.34, -0.30, 0.08, 0.04, 0.14, '#2d333b', true);   // VESA tilt head
        // 38" 21:9 Curved frameless ultra-wide display housing
        // Real-world 38" 21:9: casing 26.0px wide x 12.0px tall (w=0.32, h=0.48 in 81x25), center y=1.34, x=0.10, z=-0.24
        box('metal', 0.10, 1.34, -0.24, 0.32, 0.48, 0.02, '#181b1e', true);
        box('dark', 0.10, 1.34, -0.228, 0.308, 0.455, 0.005, '#0b0f19');
        box('glow', 0.10, 1.34, -0.224, 0.298, 0.435, 0.004, '#0284c7');      // ultra-wide split desktop
        // Multi-pane split workspace
        box('glow', 0.18, 1.34, -0.221, 0.13, 0.41, 0.005, '#0f172a');        // right analytics panel
        box('glow', 0.18, 1.44, -0.218, 0.11, 0.024, 0.006, '#38bdf8');
        box('glow', 0.18, 1.36, -0.218, 0.10, 0.024, 0.006, '#10b981');
        box('glow', 0.18, 1.28, -0.218, 0.09, 0.024, 0.006, '#f59e0b');
        box('glow', 0.03, 1.34, -0.221, 0.13, 0.41, 0.005, '#1e293b');        // left development window
        box('glow', 0.03, 1.45, -0.218, 0.11, 0.022, 0.006, '#e2e8f0');
        box('glow', 0.03, 1.38, -0.218, 0.09, 0.022, 0.006, '#a855f7');
        // Top-mounted LED ScreenBar task lamp
        box('metal', 0.10, 1.60, -0.23, 0.24, 0.020, 0.025, '#0f172a', true);
        box('glow', 0.10, 1.588, -0.22, 0.22, 0.008, 0.016, '#fef08a');       // warm task light glow

        // 5. Executive Workstation PC Tower Under Desk Return
        box('metal', -0.34, 0.28, -0.16, 0.18, 0.44, 0.38, '#111315', true);
        box('dark', -0.34, 0.28, 0.032, 0.16, 0.40, 0.005, '#1e293b');         // front ventilation grille
        round('glow', -0.34, 0.46, 0.034, 0.008, 0.008, 0.008, '#38bdf8');     // power LED

        // 6. Leather Desk Pad, Wireless Ergonomic Keyboard, Vertical Mouse & Phone Stand
        box('fabric', 0.08, 0.95, -0.04, 0.58, 0.01, 0.36, '#1c1f24');        // leather blotter
        // Low-profile keyboard
        box('metal', 0.06, 0.965, 0.02, 0.32, 0.012, 0.11, '#e2e8f0', true);
        box('dark', 0.06, 0.974, 0.02, 0.30, 0.004, 0.09, '#181b1e');
        // Ergonomic vertical mouse
        box('dark', 0.26, 0.972, 0.02, 0.05, 0.025, 0.07, '#1e2124');
        // Angled wireless smartphone charging stand on return desk
        box('metal', -0.16, 0.96, 0.22, 0.08, 0.06, 0.08, '#334155', true);
        partRotEuler('box', 'glow', -0.16, 1.01, 0.22, 0.06, 0.11, 0.006, -0.35, 0, 0, '#38bdf8'); // glowing phone screen

      } else if (/^desk$/i.test(t)) {
        // Ultra-Realistic Executive PC Workstation (32" Aluminum 4K Studio Display, Compact Studio PC Tower, Backlit Wireless Keyboard, Precision Mouse & Leather Blotter)
        // 1. Splayed architectural steel / wood legs with brass shoes
        for (const [lx, lz] of [[-0.44, 0.37], [0.44, 0.37], [-0.44, -0.37], [0.44, -0.37]]) {
          cyl('wood', lx, 0.44, lz, 0.04, 0.88, 0.04, '#241a12');
          cyl('metal', lx, 0.02, lz, 0.045, 0.04, 0.045, '#c9a44e', true);
        }
        // Dual suspended drawers under desk cleanly inset between legs with center kneehole space
        for (const side of [-0.28, 0.28]) {
          box('wood', side, 0.76, 0, 0.24, 0.24, 0.66, color);
          box('wood', side, 0.76, 0.34, 0.21, 0.20, 0.02, HP.shade(color, 1.05));
          box('metal', side, 0.76, 0.355, 0.10, 0.015, 0.015, '#c9a44e', true);
        }

        // 2. Beveled solid slab desktop (y=0.92 = 23px)
        box('dark', 0, 0.895, 0, 0.92, 0.02, 0.82, '#181b1e');               // shadow reveal
        box('wood', 0, 0.93, 0, 0.96, 0.05, 0.86, HP.shade(color, 1.06));    // hardwood slab
        cyl('metal', 0.38, 0.958, -0.34, 0.035, 0.008, 0.035, '#181b1e', true); // metal wire grommet

        // 3. Premium Stitched Charcoal Wool Felt & Leather Desk Pad
        box('fabric', -0.04, 0.96, 0.04, 0.62, 0.01, 0.48, '#1e293b');

        // 4. Flagship Dual 4K Aluminum Designer Studio Displays (True 16:9 Aspect Ratio)
        // Heavy articulated aluminum desk clamp & dual monitor stand
        cyl('metal', -0.02, 0.96, -0.28, 0.035, 0.03, 0.035, '#d1d5db', true);   // base clamp
        cyl('metal', -0.02, 1.15, -0.30, 0.028, 0.38, 0.028, '#cbd5e1', true);   // center post
        // Articulated horizontal support crossbar
        box('metal', -0.02, 1.30, -0.28, 0.46, 0.03, 0.025, '#94a3b8', true);

        // Display A: Left 32" 4K Designer Studio Display (16:9 Landscape)
        // Casing: 22.7px wide x 12.5px tall (w=0.28, h=0.50), center y=1.34, x=-0.16, z=-0.22, angled slightly ry=+0.12
        boxRot('metal', -0.16, 1.34, -0.22, 0.28, 0.50, 0.02, 0.12, '#e2e8f0', true);
        boxRot('dark', -0.16, 1.34, -0.208, 0.27, 0.48, 0.005, 0.12, '#0f172a');
        boxRot('glow', -0.16, 1.34, -0.204, 0.26, 0.46, 0.004, 0.12, '#0f172a'); // 4K deep dark wallpaper
        boxRot('glow', -0.16, 1.25, -0.201, 0.26, 0.24, 0.005, 0.12, '#1e3a5f'); // twilight oceanic wave
        boxRot('glow', -0.16, 1.15, -0.200, 0.26, 0.10, 0.006, 0.12, '#0f233a'); // deep midnight base
        // Dark code IDE window on left screen
        boxRot('glow', -0.12, 1.38, -0.198, 0.15, 0.26, 0.007, 0.12, '#0f172a');
        boxRot('glow', -0.12, 1.46, -0.195, 0.13, 0.016, 0.008, 0.12, '#38bdf8');
        boxRot('glow', -0.14, 1.41, -0.195, 0.10, 0.016, 0.008, 0.12, '#a855f7');
        boxRot('glow', -0.11, 1.36, -0.195, 0.12, 0.016, 0.008, 0.12, '#22c55e');
        // Top 12MP Center Stage webcam & LED
        boxRot('glass', -0.16, 1.572, -0.208, 0.012, 0.016, 0.006, 0.12, '#1e293b');
        boxRot('glow', -0.14, 1.572, -0.208, 0.005, 0.008, 0.005, 0.12, '#22c55e');

        // Display B: Right 27" 4K Designer Studio Display (16:9 Landscape angled inward towards user)
        // Casing: 20px wide x 11.5px tall (w=0.25, h=0.46), center y=1.34, x=+0.12, z=-0.20, angled ry=-0.22
        boxRot('metal', 0.12, 1.34, -0.20, 0.25, 0.46, 0.02, -0.22, '#e2e8f0', true);
        boxRot('dark', 0.12, 1.34, -0.188, 0.24, 0.44, 0.005, -0.22, '#0f172a');
        boxRot('glow', 0.12, 1.34, -0.184, 0.23, 0.42, 0.004, -0.22, '#0f172a'); // analytics / dashboard dark theme
        // Live charts & statistics panels
        boxRot('glow', 0.12, 1.44, -0.181, 0.20, 0.14, 0.005, -0.22, '#1e293b'); // analytics card
        boxRot('glow', 0.09, 1.46, -0.178, 0.12, 0.016, 0.006, -0.22, '#38bdf8');
        boxRot('glow', 0.15, 1.41, -0.178, 0.08, 0.016, 0.006, -0.22, '#10b981');
        boxRot('glow', 0.12, 1.25, -0.181, 0.20, 0.18, 0.005, -0.22, '#1e293b'); // terminal / chat card
        boxRot('glow', 0.10, 1.28, -0.178, 0.14, 0.014, 0.006, -0.22, '#f59e0b');
        boxRot('glow', 0.13, 1.22, -0.178, 0.10, 0.014, 0.006, -0.22, '#06b6d4');
        boxRot('glass', 0.12, 1.552, -0.188, 0.012, 0.016, 0.006, -0.22, '#1e293b');

        // 5. Compact Aluminum Studio Workstation PC (Mac Studio / SFF PC) on right wing
        box('metal', 0.35, 1.05, -0.14, 0.16, 0.18, 0.18, '#d4dade', true);
        box('dark', 0.35, 0.965, -0.14, 0.15, 0.01, 0.17, '#1e293b');         // circular perimeter air intake
        // Front I/O: dual Thunderbolt ports + SDXC slot + power indicator
        box('dark', 0.31, 1.01, -0.048, 0.014, 0.03, 0.005, '#0f172a');
        box('dark', 0.34, 1.01, -0.048, 0.014, 0.03, 0.005, '#0f172a');
        box('dark', 0.39, 1.01, -0.048, 0.035, 0.008, 0.005, '#0f172a');
        round('glow', 0.28, 0.99, -0.048, 0.006, 0.006, 0.006, '#ffffff');

        // 6. Low-Profile Wireless Keyboard & Precision Ergonomic Mouse
        // Sleek anodized aluminum wireless keyboard with white chiclet keys
        box('metal', -0.06, 0.970, 0.10, 0.34, 0.012, 0.12, '#e2e8f0', true);
        box('ceramic', -0.06, 0.980, 0.10, 0.32, 0.005, 0.10, '#ffffff');
        box('dark', -0.06, 0.981, 0.135, 0.16, 0.003, 0.02, '#94a3b8');        // spacebar
        // Precision ergonomic wireless mouse with rubber scroll wheel
        round('metal', 0.18, 0.974, 0.10, 0.05, 0.018, 0.08, '#f8fafc', true);
        box('dark', 0.18, 0.982, 0.08, 0.008, 0.006, 0.02, '#64748b');

        // 7. Desk Accessories: Matte Ceramic Pen Cup with Drafting Pens
        cyl('ceramic', -0.38, 1.02, 0.12, 0.05, 0.10, 0.05, '#fafaf9');
        cyl('metal', -0.38, 1.08, 0.12, 0.01, 0.08, 0.01, '#c9a44e', true);
        cyl('dark', -0.36, 1.07, 0.11, 0.008, 0.07, 0.008, '#1e293b');

      } else if (/^filecab$/i.test(t)) {
        // Modern 2-Drawer Commercial Steel Filing Cabinet
        box('dark', 0, 0.03, 0, 0.88, 0.06, 0.84, '#15171a');
        box('metal', 0, 0.51, 0, 0.92, 0.88, 0.88, color || '#64748b', true);
        box('metal', 0, 0.97, 0, 0.94, 0.04, 0.90, '#475569', true);
        for (let r = 0; r < 2; r++) {
          const dy = 0.30 + r * 0.44;
          box('metal', 0, dy, 0.44, 0.84, 0.40, 0.02, '#334155', true);
          box('metal', 0, dy + 0.12, 0.455, 0.22, 0.02, 0.02, '#c5ccd2', true); // chrome pull
          box('fabric', 0, dy + 0.04, 0.455, 0.12, 0.04, 0.005, '#ffffff');      // label slot
        }

      } else if (/^whiteboard$/i.test(t)) {
        // Mobile Presentation Magnetic Whiteboard on Lockable Caster Stand (44px tall)
        for (const sx of [-0.44, 0.44]) {
          box('metal', sx, 0.04, 0, 0.04, 0.06, 0.44, '#64748b', true);      // floor leg
          cyl('dark', sx, 0.02, 0.18, 0.03, 0.04, 0.03, '#15171a');          // casters
          cyl('dark', sx, 0.02, -0.18, 0.03, 0.04, 0.03, '#15171a');
          box('metal', sx, 0.48, 0, 0.035, 0.84, 0.035, '#64748b', true);    // vertical upright
        }
        // Magnetic whiteboard frame & porcelain writing surface
        box('metal', 0, 0.60, 0, 0.88, 0.56, 0.03, '#c5ccd2', true);        // aluminum frame
        box('ceramic', 0, 0.60, 0, 0.84, 0.52, 0.015, '#ffffff');            // glossy whiteboard
        // Marker tray with colorful dry-erase markers
        box('metal', 0, 0.31, 0.04, 0.60, 0.02, 0.06, '#94a3b8', true);
        box('dark', -0.12, 0.325, 0.04, 0.08, 0.01, 0.01, '#ef4444');        // red marker
        box('dark', 0, 0.325, 0.04, 0.08, 0.01, 0.01, '#3b82f6');            // blue marker
        box('dark', 0.12, 0.325, 0.04, 0.08, 0.01, 0.01, '#15171a');         // black marker

      } else if (/^treadmill$/i.test(t)) {
        // Motorized Folding Gym Treadmill (Running deck, safety rails, digital LED touch console, tablet mount, 36px tall)
        // 1. Low-profile deck chassis & rubberized textured running belt (y=0 to 0.16)
        box('dark', 0, 0.04, 0, 0.78, 0.08, 0.94, '#15171a');               // floor base
        box('dark', 0, 0.10, 0.04, 0.66, 0.04, 0.82, '#0f172a');            // textured running belt
        // Left and right non-slip foot rails
        box('dark', -0.36, 0.11, 0, 0.06, 0.03, 0.92, '#334155');
        box('dark', 0.36, 0.11, 0, 0.06, 0.03, 0.92, '#334155');
        // Motor hood at front of deck
        box('dark', 0, 0.18, -0.40, 0.72, 0.16, 0.20, '#1e293b');

        // 2. Angled Heavy Steel Upright Columns & Padded Handrails
        for (const sx of [-0.34, 0.34]) {
          box('metal', sx, 0.52, -0.22, 0.04, 0.68, 0.06, '#334155', true);  // angled upright
          box('dark', sx, 0.84, -0.06, 0.045, 0.04, 0.38, '#1e293b');        // padded side rail
        }
        // Cross grab bar with integrated pulse sensors
        box('metal', 0, 0.82, -0.22, 0.68, 0.04, 0.04, '#1e293b', true);
        box('metal', -0.14, 0.82, -0.22, 0.06, 0.045, 0.045, '#c5ccd2', true); // chrome heart rate sensor
        box('metal', 0.14, 0.82, -0.22, 0.06, 0.045, 0.045, '#c5ccd2', true);

        // 3. Digital Touchscreen Console Dashboard with Speed/Incline Controls
        box('dark', 0, 0.92, -0.28, 0.58, 0.16, 0.12, '#0f172a');
        box('glow', 0, 0.94, -0.26, 0.38, 0.10, 0.01, '#38bdf8');            // blue illuminated workout stats
        box('dark', 0, 0.86, -0.24, 0.08, 0.02, 0.02, '#ef4444');            // red emergency safety stop tether

      } else if (/^printer$/i.test(t)) {
        // Multi-Function Wireless Laser Office Printer on Mobile Credenza
        // Rolling credenza stand with lower paper ream shelf
        for (const [lx, lz] of [[-0.42, 0.36], [0.42, 0.36], [-0.42, -0.36], [0.42, -0.36]]) {
          cyl('dark', lx, 0.03, lz, 0.03, 0.06, 0.03, '#15171a');
          box('metal', lx, 0.22, lz, 0.035, 0.34, 0.035, '#334155', true);
        }
        box('wood', 0, 0.40, 0, 0.92, 0.04, 0.86, '#26292e');                // stand top
        box('fabric', 0, 0.18, 0, 0.60, 0.14, 0.46, '#ffffff');              // paper ream pack

        // Laser printer body
        box('ceramic', 0, 0.66, 0, 0.82, 0.46, 0.78, '#f1f5f9');
        box('dark', 0, 0.52, 0.39, 0.64, 0.10, 0.02, '#1e293b');             // paper cassette
        box('dark', 0, 0.70, 0.38, 0.58, 0.04, 0.22, '#334155');             // output paper tray
        box('fabric', 0, 0.725, 0.38, 0.44, 0.005, 0.28, '#ffffff');         // printed sheet
        box('glass', 0, 0.88, 0, 0.74, 0.02, 0.68, '#d4eef4');               // scanner glass platen
        box('ceramic', 0, 0.92, 0, 0.76, 0.03, 0.70, '#f8fafc');             // lift lid
        box('glow', 0.28, 0.84, 0.36, 0.14, 0.08, 0.01, '#60a5fa');          // LCD touch display

      } else if (/^fan$/i.test(t)) {
        // Modern Oscillating Pedestal Standing Fan (Circular base, telescoping column, wire blade cage)
        cyl('dark', 0, 0.03, 0, 0.56, 0.06, 0.56, '#181b1e');                // weighted floor base
        cyl('metal', 0, 0.46, 0, 0.04, 0.82, 0.04, '#c5ccd2', true);          // chrome telescoping pole
        cyl('dark', 0, 0.84, -0.04, 0.12, 0.12, 0.14, '#181b1e');            // motor housing
        cyl('metal', 0, 0.84, 0.06, 0.48, 0.06, 0.48, '#64748b', true);      // outer wire cage
        cyl('glass', 0, 0.84, 0.06, 0.42, 0.02, 0.42, '#38bdf8');            // aerofoil blades

      } else if (/^radiator$/i.test(t)) {
        // Architectural Cast-Iron Finned Heating Radiator (Thermostatic valve & bleed pin)
        box('metal', 0, 0.04, 0, 0.88, 0.06, 0.24, '#c5ccd2', true);         // floor feet
        // 8 vertical heating fins
        for (let i = 0; i < 8; i++) {
          const fx = -0.38 + i * 0.11;
          box('ceramic', fx, 0.50, 0, 0.07, 0.86, 0.28, '#fafaf8');
        }
        // Top and bottom manifold pipes
        cylX('metal', 0, 0.88, 0, 0.90, 0.04, 0.04, '#c5ccd2', true);
        cylX('metal', 0, 0.12, 0, 0.90, 0.04, 0.04, '#c5ccd2', true);
        cyl('metal', 0.48, 0.88, 0, 0.06, 0.08, 0.06, '#ffffff');            // white thermostatic knob

      } else if (/^robotvac$/i.test(t)) {
        // Smart Robotic Vacuum Cleaner & Base Station (3px height)
        // Charging dock station against wall
        box('dark', 0, 0.50, -0.38, 0.44, 0.90, 0.16, '#111315');
        round('glow', 0, 0.90, -0.30, 0.02, 0.02, 0.02, '#22c55e');          // charging green LED
        // Circular robot vacuum body
        cyl('dark', 0, 0.45, 0.05, 0.68, 0.80, 0.68, '#1e2124');             // main matte black disc
        cyl('dark', 0, 0.88, 0.05, 0.22, 0.18, 0.22, '#0f172a');             // top LiDAR laser turret
        box('dark', 0, 0.45, 0.36, 0.62, 0.70, 0.08, '#111315');             // front bumper sensor

      } else if (/^globe$/i.test(t)) {
        // Vintage Illuminated World Globe on Turned Walnut Stand
        cyl('wood', 0, 0.06, 0, 0.42, 0.10, 0.42, '#3d2516');                // base
        cyl('wood', 0, 0.28, 0, 0.06, 0.36, 0.06, '#3d2516');                // turned column
        // Brass meridian semi-circle ring
        cyl('metal', 0, 0.64, 0, 0.52, 0.02, 0.52, '#c9a44e', true);
        // Illuminated celestial earth sphere
        round('fabric', 0, 0.64, 0, 0.44, 0.44, 0.44, '#3b82f6');            // oceans
        round('foliage', 0, 0.64, 0.08, 0.24, 0.24, 0.20, '#65a30d');        // continents
        round('glow', 0, 0.64, 0, 0.10, 0.10, 0.10, '#fef08a');              // internal bulb warmth

      } else if (/^safe$/i.test(t)) {
        // Heavy Armored Digital Floor Safe (Keypad + 3-spoke vault wheel)
        box('dark', 0, 0.04, 0, 0.88, 0.08, 0.88, '#111315');
        box('metal', 0, 0.52, 0, 0.86, 0.88, 0.86, '#1e293b', true);        // safe body
        box('metal', 0, 0.52, 0.43, 0.76, 0.80, 0.04, '#0f172a', true);      // 4-inch heavy steel door
        // 3-Spoke chrome vault wheel + electronic digital keypad
        cylZ('metal', 0.12, 0.52, 0.46, 0.14, 0.14, 0.03, '#c5ccd2', true);   // center hub
        for (let s = 0; s < 3; s++) {
          const a = (s * 2 * Math.PI) / 3;
          box('metal', 0.12 + Math.cos(a) * 0.08, 0.52 + Math.sin(a) * 0.08, 0.46, 0.02, 0.08, 0.02, '#c5ccd2', true);
        }
        box('dark', -0.16, 0.64, 0.46, 0.12, 0.16, 0.02, '#181b1e');
        box('glow', -0.16, 0.70, 0.47, 0.08, 0.04, 0.005, '#38bdf8');        // LCD display

      } else if (/^watercooler$/i.test(t)) {
        // Commercial Office Water Cooler (Blue inverted 5-gal bottle, hot/cold taps, drip tray)
        box('dark', 0, 0.03, 0, 0.68, 0.06, 0.68, '#15171a');
        box('ceramic', 0, 0.42, 0, 0.66, 0.72, 0.66, '#f8fafc');            // white tower body
        box('dark', 0, 0.52, 0.22, 0.48, 0.28, 0.24, '#1e293b');             // dispensing recess
        box('metal', 0, 0.39, 0.24, 0.44, 0.02, 0.18, '#64748b', true);     // drip grate
        // Hot (red) and Cold (blue) push taps
        box('metal', -0.10, 0.60, 0.22, 0.04, 0.06, 0.08, '#ef4444');        // red tap
        box('metal', 0.10, 0.60, 0.22, 0.04, 0.06, 0.08, '#3b82f6');         // blue tap
        // Inverted translucent cyan 5-gallon water bottle on top
        cyl('glass', 0, 0.88, 0, 0.52, 0.28, 0.52, '#38bdf8');
        cyl('glass', 0, 1.01, 0, 0.46, 0.08, 0.46, '#38bdf8');

      } else if (/^drafting$/i.test(t)) {
        // Adjustable Architect Drafting Table with Parallel Straightedge (34px tall)
        for (const [lx, lz] of [[-0.42, 0.32], [0.42, 0.32], [-0.42, -0.32], [0.42, -0.32]]) {
          box('metal', lx, 0.36, lz, 0.04, 0.72, 0.04, '#181b1e', true);
          cyl('metal', lx, 0.02, lz, 0.045, 0.04, 0.045, '#c9a44e', true);
        }
        // Angled drawing board (y=0.78 to 0.96)
        box('wood', 0, 0.86, 0, 0.96, 0.04, 0.88, '#f5deb3');                // smooth birch drawing board
        box('dark', 0, 0.76, 0.42, 0.94, 0.03, 0.05, '#181b1e');             // pencil lip ledge
        // Clear acrylic parallel straightedge with cable pulleys
        box('glass', 0, 0.88, 0.08, 0.92, 0.015, 0.08, '#d4eef4');
        box('fabric', 0, 0.89, -0.04, 0.72, 0.005, 0.52, '#ffffff');         // architectural blueprint

      } else if (/^telescope$/i.test(t)) {
        // Refractor Astronomical Telescope on Adjustable Aluminum Tripod (44px tall)
        for (let i = 0; i < 3; i++) {
          const a = (i * 2 * Math.PI) / 3;
          const lx = Math.cos(a) * 0.34, lz = Math.sin(a) * 0.34;
          cyl('metal', lx * 0.5, 0.30, lz * 0.5, 0.03, 0.60, 0.03, '#94a3b8', true);
          cyl('metal', lx, 0.02, lz, 0.035, 0.04, 0.035, '#15171a');
        }
        box('metal', 0, 0.60, 0, 0.12, 0.06, 0.12, '#334155', true);         // equatorial mount head
        // Angled telescope optical tube
        cyl('ceramic', 0, 0.78, 0, 0.14, 0.72, 0.14, '#f8fafc');              // gloss white tube
        cyl('glass', 0, 0.96, -0.22, 0.16, 0.04, 0.16, '#38bdf8');           // objective lens
        cyl('metal', 0, 0.62, 0.22, 0.06, 0.14, 0.06, '#c9a44e', true);      // brass 90-deg star diagonal eyepiece

      } else if (/^serverrack$/i.test(t)) {
        // 42U Data Center Server Rack (48px tall, perforated glass door, blade servers with blinking LEDs)
        box('dark', 0, 0.03, 0, 0.92, 0.06, 0.88, '#111315');
        box('metal', 0, 0.51, 0, 0.94, 0.90, 0.92, '#1e293b', true);
        box('glass', 0, 0.51, 0.46, 0.84, 0.86, 0.02, '#0f172a');            // tinted glass front door
        // Racked 1U & 2U server blades inside
        for (let u = 0; u < 6; u++) {
          const uy = 0.20 + u * 0.13;
          box('metal', 0, uy, 0.42, 0.80, 0.08, 0.04, '#334155', true);
          box('glow', -0.28, uy, 0.445, 0.015, 0.015, 0.01, '#22c55e');       // green power LED
          box('glow', -0.24, uy, 0.445, 0.015, 0.015, 0.01, '#38bdf8');       // blue network LED
          box('glow', -0.20, uy, 0.445, 0.015, 0.015, 0.01, '#f59e0b');       // amber drive activity
        }

      } else if (/^shredder$/i.test(t)) {
        // Cross-Cut Paper Shredder with Clear Waste Window (18px tall)
        box('dark', 0, 0.04, 0, 0.74, 0.08, 0.56, '#15171a');
        box('dark', 0, 0.48, 0, 0.72, 0.80, 0.54, '#1e293b');
        box('glass', 0, 0.44, 0.27, 0.28, 0.40, 0.01, '#64748b');            // clear wastebasket window
        box('fabric', 0, 0.32, 0.26, 0.24, 0.20, 0.10, '#ffffff');           // shredded paper
        box('dark', 0, 0.88, 0, 0.74, 0.08, 0.56, '#0f172a');                // heavy cutter head
        box('dark', 0, 0.925, 0, 0.48, 0.01, 0.02, '#15171a');               // paper entry slot
        round('glow', 0.24, 0.925, 0, 0.015, 0.015, 0.015, '#22c55e');        // ready LED

      } else if (/^kneelchair$/i.test(t)) {
        // Ergonomic Scandinavian Wooden Kneeling Posture Chair
        // Curved natural birch rocking frame runners
        for (const sx of [-0.22, 0.22]) {
          box('wood', sx, 0.12, 0, 0.04, 0.04, 0.84, '#d4a87a');
          box('wood', sx, 0.34, -0.16, 0.04, 0.42, 0.04, '#d4a87a');
          box('wood', sx, 0.24, 0.20, 0.04, 0.22, 0.04, '#d4a87a');
        }
        // Angled seat pad
        box('fabric', 0, 0.52, -0.16, 0.48, 0.08, 0.34, color || '#22252a');
        // Angled knee support pads
        box('fabric', -0.16, 0.30, 0.20, 0.18, 0.08, 0.26, color || '#22252a');
        box('fabric', 0.16, 0.30, 0.20, 0.18, 0.08, 0.26, color || '#22252a');

      } else if (/^scanner$/i.test(t)) {
        // Flatbed Photo & Document Scanner
        box('dark', 0, 0.30, 0, 0.86, 0.50, 0.86, '#1e293b');
        box('glass', 0, 0.56, 0, 0.76, 0.02, 0.76, '#38bdf8');               // glass platen
        box('ceramic', 0, 0.62, 0, 0.88, 0.08, 0.88, '#f1f5f9');             // lift lid
        box('glow', -0.32, 0.58, 0.38, 0.08, 0.02, 0.04, '#22c55e');         // scan button

      } else if (/^deskorganizer$/i.test(t)) {
        // Handcrafted Leather & Walnut Desktop Caddy
        box('wood', 0, 0.30, 0, 0.90, 0.40, 0.80, '#3d2516');
        box('fabric', -0.24, 0.65, 0, 0.32, 0.30, 0.68, '#854d0e');          // mail/file slots
        cyl('ceramic', 0.26, 0.68, -0.18, 0.14, 0.36, 0.14, '#181b1e');      // pen tumbler
        cyl('metal', 0.26, 0.88, -0.18, 0.02, 0.18, 0.02, '#c9a44e', true);  // gold pen
        box('wood', 0.24, 0.55, 0.20, 0.32, 0.10, 0.28, '#26180e');          // sticky note tray

      } else if (/^acsplit$/i.test(t)) {
        // Modern Wall-Mounted Inverter Mini-Split Air Conditioner (12px tall)
        box('ceramic', 0, 0.50, 0, 0.96, 0.88, 0.74, '#ffffff');
        box('dark', 0, 0.18, 0.34, 0.92, 0.08, 0.08, '#1e293b');             // motorized air discharge louver
        box('glow', 0.36, 0.62, 0.375, 0.10, 0.06, 0.005, '#38bdf8');        // digital 72°F display
        box('metal', -0.38, 0.70, 0.375, 0.08, 0.015, 0.005, '#c5ccd2', true); // chrome logo

      } else if (/^laptop$/i.test(t)) {
        // Ultra-Thin Brushed Aluminum Laptop open at 110°
        box('metal', 0, 0.15, 0.08, 0.84, 0.06, 0.64, '#cbd5e1', true);      // base chassis
        box('dark', 0, 0.185, 0.04, 0.76, 0.01, 0.34, '#181b1e');            // chiclet keyboard
        box('metal', 0, 0.185, 0.28, 0.30, 0.005, 0.18, '#94a3b8', true);    // multi-touch trackpad
        box('metal', 0, 0.55, -0.22, 0.84, 0.64, 0.04, '#cbd5e1', true);     // display lid
        box('glow', 0, 0.55, -0.198, 0.78, 0.58, 0.005, '#38bdf8');          // retina display screen

      
      /* ---------------- GYM & FITNESS (14 ITEMS) ---------------- */
      } else if (/^exbike$/i.test(t)) {
        // High-End Magnetic Indoor Cycling Smart Bike (Heavy flywheel, drop handlebars, tablet console, dual pedals, fully connected frame)
        // Stabilizer floor bars with leveling feet
        for (const sz of [-0.42, 0.42]) {
          box('dark', 0, 0.04, sz, 0.72, 0.07, 0.10, '#15171a');
          cyl('metal', -0.32, 0.02, sz, 0.08, 0.04, 0.08, '#c9a44e');
          cyl('metal', 0.32, 0.02, sz, 0.08, 0.04, 0.08, '#c9a44e');
        }
        // Heavy steel base longitudinal spine connecting front and rear stabilizers
        box('metal', 0, 0.05, 0, 0.12, 0.06, 0.84, '#15171a');
        // Central aerodynamic frame chassis
        box('dark', 0, 0.35, 0, 0.14, 0.55, 0.65, '#1e2124');
        box('glow', 0, 0.35, 0, 0.145, 0.08, 0.45, '#ef4444');              // red performance accent
        // Heavy perimeter flywheel at front (true circular disc around X axis)
        wheelX('metal', 0, 0.38, -0.22, 0.08, 15.8, '#d1d5db');         // chrome flywheel disc
        wheelX('dark', 0, 0.38, -0.22, 0.09, 7.2, '#111827');           // flywheel hub
        // Steel seat post & ergonomic racing saddle
        cyl('metal', 0, 0.62, 0.22, 0.06, 0.35, 0.06, '#94a3b8');
        box('dark', 0, 0.78, 0.20, 0.26, 0.08, 0.36, '#181b1e');            // contoured saddle
        box('metal', 0, 0.81, 0.20, 0.06, 0.02, 0.22, '#ef4444');           // saddle center relief cutout
        // Aero handlebars & smart screen console
        cyl('metal', 0, 0.70, -0.26, 0.06, 0.40, 0.06, '#94a3b8');
        box('dark', 0, 0.86, -0.26, 0.52, 0.05, 0.18, '#1e2124');           // multi-grip bullhorn bars
        box('metal', 0, 0.94, -0.30, 0.32, 0.22, 0.03, '#0f172a');          // HD training tablet
        box('glow', 0, 0.94, -0.284, 0.28, 0.18, 0.005, '#38bdf8');         // interactive cycling HUD
        // Bottom bracket, crank arms and pedals
        cyl('metal', 0, 0.22, 0.05, 0.12, 0.28, 0.12, '#334155');
        box('metal', -0.15, 0.22, 0.12, 0.03, 0.04, 0.18, '#cbd5e1');         // left crank
        box('metal', 0.15, 0.22, -0.02, 0.03, 0.04, 0.18, '#cbd5e1');         // right crank
        box('dark', -0.18, 0.22, 0.20, 0.10, 0.04, 0.12, '#181b1e');        // pedal with toe cage
        box('dark', 0.18, 0.22, -0.10, 0.10, 0.04, 0.12, '#181b1e');

      } else if (/^weightbench$/i.test(t)) {
        // Commercial Adjustable FID Olympic Weight Bench (Heavy steel tubing, high-density stitched leather pads, barbell uprights, fully grounded)
        // 1. Heavy tubular black steel base with rubber feet
        box('dark', 0, 0.04, -0.42, 0.68, 0.08, 0.10, '#15171a');           // rear wide crossbar
        box('dark', 0, 0.04, 0.42, 0.42, 0.08, 0.10, '#15171a');            // front stabilizer
        box('metal', 0, 0.05, 0, 0.10, 0.08, 0.84, '#1e2124');              // central longitudinal spine
        // Front transport wheels + grab handle
        cyl('dark', -0.28, 0.04, -0.42, 0.08, 0.04, 0.08, '#111827');
        cyl('dark', 0.28, 0.04, -0.42, 0.08, 0.04, 0.08, '#111827');
        box('metal', 0, 0.08, 0.46, 0.14, 0.04, 0.04, '#c9a44e');
        // 2. Heavy Olympic upright barbell rack at head end
        for (const rx of [-0.32, 0.32]) {
          box('metal', rx, 0.52, -0.40, 0.07, 0.94, 0.07, '#1e293b');        // upright post
          box('metal', rx, 0.86, -0.36, 0.09, 0.12, 0.04, '#c9a44e');        // J-hook barbell catch
        }
        // Olympic 45lb Barbell racked on J-hooks
        cylX('metal', 0, 0.88, -0.34, 1.30, 0.035, 0.035, '#cbd5e1');        // 7ft bar across X
        for (const bx of [-0.52, 0.52]) {
          wheelX('dark', bx, 0.88, -0.34, 0.05, 11.5, '#181b1e');       // 45lb bumper plates
          wheelX('metal', bx > 0 ? bx + 0.04 : bx - 0.04, 0.88, -0.34, 0.03, 2.2, '#c9a44e'); // spring collar
        }
        // 3. Vertical Support Risers & Steel Pad Subframe (Connecting spine to pads!)
        // Front vertical riser post from spine (y=0.08) to seat frame (y=0.34)
        box('metal', 0, 0.21, 0.28, 0.08, 0.26, 0.08, '#1e2124');
        // Mid vertical hinge pivot post for backrest
        box('metal', 0, 0.21, -0.06, 0.08, 0.26, 0.08, '#1e2124');
        // Ladder adjustment selector bracket behind backrest
        boxSlope('metal', 0, 0.08, -0.28, 0, 0.36, -0.06, 0.05, 0.05, '#334155');
        // Steel backing plates under cushions
        box('dark', 0, 0.35, 0.28, 0.26, 0.03, 0.26, '#15171a');             // seat subplate
        box('dark', 0, 0.38, -0.06, 0.28, 0.03, 0.52, '#15171a');            // backrest subplate
        // 4. Stitched dense leather backrest and seat pads
        box('fabric', 0, 0.42, -0.06, 0.34, 0.08, 0.54, color || '#1e2124'); // inclined backrest pad
        box('fabric', 0, 0.38, 0.28, 0.30, 0.08, 0.26, color || '#1e2124');  // seat pad
        box('glow', 0, 0.455, -0.06, 0.02, 0.01, 0.50, '#ef4444');           // contrast stitching strip

      } else if (/^dumbbells$/i.test(t)) {
        // 2-Tier Heavy Steel A-Frame Commercial Dumbbell Rack with 5 Pairs of Hex Dumbbells
        // 1. Heavy angled black steel rack frame
        for (const sx of [-0.44, 0.44]) {
          box('dark', sx, 0.04, 0, 0.06, 0.08, 0.84, '#15171a');
          box('metal', sx, 0.48, -0.12, 0.05, 0.82, 0.05, '#1e293b', true); // angled upright
          box('metal', sx, 0.48, 0.12, 0.05, 0.82, 0.05, '#1e293b', true);
        }
        // Two tiers of angled dumbbell trays
        box('metal', 0, 0.42, 0.10, 0.86, 0.05, 0.32, '#181b1e', true);      // bottom shelf
        box('metal', 0, 0.74, -0.08, 0.86, 0.05, 0.30, '#181b1e', true);     // top shelf
        // 2. 5 pairs of Hexagonal Urethane Dumbbells
        const weights = [
          { x: -0.34, r: 0.12, w: 0.07, col: '#181b1e' },
          { x: -0.17, r: 0.14, w: 0.08, col: '#181b1e' },
          { x: 0.00,  r: 0.16, w: 0.09, col: '#181b1e' },
          { x: 0.17,  r: 0.18, w: 0.10, col: '#181b1e' },
          { x: 0.34,  r: 0.20, w: 0.11, col: '#181b1e' }
        ];
        // Top tier dumbbells
        for (const db of weights) {
          cyl('metal', db.x, 0.84, -0.08, 0.03, 0.22, 0.03, '#cbd5e1', true); // knurled handle
          cyl('dark', db.x, 0.84, -0.16, db.r, db.w, db.r, db.col);          // left head
          cyl('dark', db.x, 0.84, 0.00, db.r, db.w, db.r, db.col);           // right head
        }
        // Bottom tier heavier dumbbells
        for (const db of weights) {
          cyl('metal', db.x, 0.52, 0.10, 0.035, 0.24, 0.035, '#cbd5e1', true);
          cyl('dark', db.x, 0.52, 0.00, db.r * 1.15, db.w * 1.1, db.r * 1.15, '#111827');
          cyl('dark', db.x, 0.52, 0.20, db.r * 1.15, db.w * 1.1, db.r * 1.15, '#111827');
        }

      } else if (/^yogamat$/i.test(t)) {
        // High-Density 6mm Dual-Tone Eco Yoga Mat with Laser Alignment Guide Lines and Rolled End
        // Flat mat body
        box('fabric', 0, 0.015, 0.04, 0.78, 0.03, 0.88, color || '#7c3aed');
        // Dual-tone bottom grip layer
        box('dark', 0, 0.005, 0.04, 0.76, 0.01, 0.86, '#181b1e');
        // Laser etched alignment center line & mandala sun motif
        box('fabric', 0, 0.032, 0.04, 0.03, 0.005, 0.80, HP.shade(color || '#7c3aed', 1.3));
        cyl('fabric', 0, 0.032, 0.04, 0.16, 0.005, 0.16, HP.shade(color || '#7c3aed', 1.3));
        // Naturally rolled top cylinder end
        cylX('fabric', 0, 0.08, -0.42, 0.78, 0.15, 0.15, color || '#7c3aed');
        cylX('dark', 0, 0.08, -0.42, 0.785, 0.08, 0.08, '#181b1e');            // hollow rolled core

      } else if (/^punchbag$/i.test(t)) {
        // Heavy 100lb Professional Leather Boxing Punching Bag with Swivel Ceiling Chains
        // 1. High ceiling mounting anchor plate & 4-point steel suspension chains
        box('metal', 0, 1.02, 0, 0.24, 0.04, 0.24, '#1e293b', true);
        cyl('metal', 0, 0.98, 0, 0.06, 0.06, 0.06, '#c9a44e', true);         // brass swivel shackle
        for (const [cx, cz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) {
          cyl('metal', cx * 0.5, 0.90, cz * 0.5, 0.018, 0.14, 0.018, '#cbd5e1', true);
          box('metal', cx, 0.82, cz, 0.04, 0.05, 0.04, '#1e293b', true);     // heavy D-ring rivets
        }
        // 2. Reinforced leather bag cylinder
        cyl('fabric', 0, 0.46, 0, 0.48, 0.74, 0.48, color || '#7f1d1d');     // red/black leather shell
        cyl('dark', 0, 0.80, 0, 0.485, 0.08, 0.485, '#15171a');              // top reinforcement collar
        cyl('dark', 0, 0.11, 0, 0.485, 0.06, 0.485, '#15171a');              // bottom reinforcement collar
        // High-contrast target striking zones & logo band
        cyl('fabric', 0, 0.46, 0, 0.49, 0.16, 0.49, '#ffffff');               // white center target band
        box('glow', 0, 0.46, 0.246, 0.12, 0.12, 0.005, '#ef4444');          // red bullseye target

      } else if (/^sauna$/i.test(t)) {
        // Traditional Nordic Pine Timber Sauna Cabin (2x3 footprint, full glass door, 2-tier benches, volcanic rock stove, bucket & ladle)
        // 1. Solid tongue-and-groove Nordic timber cabin carcass
        box('wood', 0, 0.50, 0, 0.96, 0.96, 0.96, '#d97706');                // pine body
        // Interior cavity recess
        box('dark', 0, 0.50, 0.10, 0.86, 0.90, 0.74, '#78350f');             // dark sauna interior
        // 2. Full-height tempered bronze glass door with natural cedar handle
        box('dark', 0, 0.50, 0.47, 0.42, 0.86, 0.04, '#1e293b');             // door frame
        box('glass', 0, 0.50, 0.47, 0.38, 0.82, 0.02, '#ca8a04');            // bronze tint glass
        box('wood', 0.14, 0.48, 0.49, 0.04, 0.24, 0.04, '#b45309');          // vertical cedar door pull
        // 3. Two-Tier tiered cedar slat seating benches inside
        box('wood', 0, 0.25, -0.15, 0.82, 0.10, 0.30, '#f59e0b');            // lower bench
        box('wood', 0, 0.48, -0.32, 0.82, 0.10, 0.28, '#f59e0b');            // upper hot bench
        // 4. Volcanic stone electric heating tower & wooden safety guard
        box('metal', -0.30, 0.28, 0.20, 0.20, 0.44, 0.20, '#1e293b', true);  // stainless stove casing
        for (let r = 0; r < 6; r++) {
          round('stone', -0.30 + (r % 2 === 0 ? 0.03 : -0.03), 0.52 + Math.floor(r / 2) * 0.04, 0.20 + (r % 3 - 1) * 0.03, 0.07, 0.05, 0.07, '#374151');
        }
        box('glow', -0.30, 0.46, 0.20, 0.14, 0.06, 0.14, '#f97316');          // glowing orange heating elements
        // Sauna wooden bucket & ladle on lower bench
        cyl('wood', 0.28, 0.34, -0.15, 0.12, 0.10, 0.12, '#b45309');
        box('wood', 0.28, 0.38, -0.15, 0.02, 0.14, 0.02, '#92400e');         // ladle handle

      } else if (/^massage$/i.test(t)) {
        // Luxury Professional Spa Massage Treatment Table (Beechwood arched legs, adjustable face cradle, plush vinyl)
        // 1. Arched beechwood legs with high-tensile aircraft support cables
        for (const sx of [-0.38, 0.38]) {
          box('wood', sx, 0.24, 0, 0.06, 0.46, 0.78, '#d4a373');
          cyl('metal', sx * 0.5, 0.20, 0, 0.015, 0.40, 0.015, '#cbd5e1', true); // support cables
        }
        box('wood', 0, 0.46, 0, 0.82, 0.06, 0.84, '#d4a373');                 // undercarriage frame
        // 2. Thick 3-inch high-density plush cushioned tabletop
        box('fabric', 0, 0.54, 0, 0.86, 0.12, 0.88, color || '#f5f5f4');
        box('fabric', 0, 0.61, 0, 0.84, 0.02, 0.86, HP.shade(color || '#f5f5f4', 1.05)); // quilted top layer
        // 3. Ergonomic adjustable face cradle & hanging armrest shelf
        cyl('dark', 0, 0.55, -0.50, 0.24, 0.08, 0.24, color || '#f5f5f4');   // horseshoe pillow
        cyl('dark', 0, 0.55, -0.50, 0.10, 0.09, 0.10, '#181b1e');            // breathing hole
        box('fabric', 0, 0.42, -0.50, 0.28, 0.04, 0.20, color || '#f5f5f4');  // hanging arm shelf
        // Spa rolled white towels & hot massage stones
        cyl('fabric', 0.28, 0.66, 0.25, 0.08, 0.20, 0.08, '#ffffff');        // rolled towel
        round('stone', -0.28, 0.63, 0.20, 0.07, 0.04, 0.09, '#1c1917');      // basalt hot stone
        round('stone', -0.28, 0.63, 0.30, 0.06, 0.04, 0.08, '#1c1917');

      } else if (/^rower$/i.test(t)) {
        // Commercial Water-Resistance Rowing Machine (1x4 footprint, real circular water tank, aluminum monorail, contoured seat)
        // 1. Circular Water Flywheel Tank with transparent drum at front
        cyl('glass', 0, 0.32, -0.38, 0.46, 0.22, 0.46, '#38bdf8');           // clear water tank drum
        cyl('metal', 0, 0.32, -0.38, 0.12, 0.24, 0.12, '#1e293b', true);     // paddle rotor hub
        cyl('dark', 0, 0.32, -0.38, 0.47, 0.04, 0.47, '#0f172a');            // tank outer rim band
        // 2. Dual aluminum monorail tracks extending full length
        box('metal', -0.10, 0.14, 0.06, 0.05, 0.12, 0.82, '#cbd5e1', true);  // left rail
        box('metal', 0.10, 0.14, 0.06, 0.05, 0.12, 0.82, '#cbd5e1', true);   // right rail
        box('dark', 0, 0.04, 0.44, 0.38, 0.07, 0.08, '#15171a');             // rear rubber floor mount
        // 3. Ergonomic contoured sliding seat on smooth roller bearings
        box('dark', 0, 0.24, 0.12, 0.30, 0.08, 0.26, '#181b1e');             // contoured rowing seat
        cyl('dark', -0.10, 0.16, 0.12, 0.04, 0.03, 0.04, '#111827');         // roller wheels
        cyl('dark', 0.10, 0.16, 0.12, 0.04, 0.03, 0.04, '#111827');
        // 4. Pivoting footplates with adjustable nylon heel straps
        for (const fx of [-0.14, 0.14]) {
          box('dark', fx, 0.26, -0.18, 0.12, 0.24, 0.06, '#1e293b');         // footplate
          box('metal', fx, 0.28, -0.16, 0.10, 0.04, 0.06, '#38bdf8', true);   // strap buckle
        }
        // Handle cord & digital training performance monitor
        box('dark', 0, 0.36, -0.22, 0.36, 0.04, 0.04, '#0f172a');            // wooden/rubber pull handle
        box('metal', 0, 0.54, -0.34, 0.16, 0.14, 0.03, '#1e293b', true);     // PM5 monitor
        box('glow', 0, 0.54, -0.322, 0.13, 0.11, 0.005, '#4ade80');          // green LCD backlight

      } else if (/^elliptical$/i.test(t)) {
        // High-End Commercial Magnetic Cross-Trainer (1x3 footprint, dual articulating stride arms, oversized pedals)
        // 1. Heavy tubular steel floor frame with wide stabilizers
        box('dark', 0, 0.04, -0.38, 0.62, 0.08, 0.10, '#15171a');
        box('dark', 0, 0.04, 0.38, 0.56, 0.08, 0.10, '#15171a');
        box('metal', 0, 0.06, 0, 0.12, 0.08, 0.84, '#1e293b', true);
        // 2. Large rear flywheel housing (true circle around X axis)
        wheelX('dark', 0, 0.32, 0.26, 0.26, 22.8, '#181b1e');
        wheelX('metal', 0, 0.32, 0.26, 0.27, 11.4, '#38bdf8', true);     // cyan flywheel hub accent
        // 3. Oversized ribbed non-slip foot pedal platforms
        box('dark', -0.22, 0.22, 0.04, 0.18, 0.06, 0.38, '#1e293b');
        box('dark', 0.22, 0.22, -0.08, 0.18, 0.06, 0.38, '#1e293b');
        // 4. Tall dual articulating upper-body stride handlebars
        for (const sx of [-0.22, 0.22]) {
          cyl('metal', sx, 0.62, -0.16, 0.04, 0.72, 0.04, '#cbd5e1', true);
          cyl('dark', sx, 0.84, -0.16, 0.05, 0.32, 0.05, '#0f172a');          // foam hand grips
        }
        // Center console mast, water bottle cage and workout monitor
        cyl('metal', 0, 0.55, -0.26, 0.08, 0.75, 0.08, '#1e293b', true);
        box('dark', 0, 0.88, -0.24, 0.30, 0.22, 0.08, '#0f172a');
        box('glow', 0, 0.88, -0.198, 0.26, 0.18, 0.005, '#38bdf8');         // telemetry workout screen

      } else if (/^kettlebells$/i.test(t)) {
        // Set of 4 Competition Color-Coded Cast Iron Kettlebells on Heavy Rubber Shock Floor Mat
        // 1. Rubber diamond-plate floor protection mat
        box('dark', 0, 0.02, 0, 0.88, 0.04, 0.88, '#15171a');
        // 2. Four kettlebells of progressive sizes (12kg blue, 16kg yellow, 20kg purple, 24kg green)
        const kbs = [
          { x: -0.24, z: -0.24, r: 0.13, col: '#2563eb' }, // 12kg
          { x: 0.24,  z: -0.24, r: 0.15, col: '#eab308' }, // 16kg
          { x: -0.24, z: 0.24,  r: 0.17, col: '#9333ea' }, // 20kg
          { x: 0.24,  z: 0.24,  r: 0.19, col: '#16a34a' }  // 24kg
        ];
        for (const kb of kbs) {
          round('metal', kb.x, 0.04 + kb.r, kb.z, kb.r * 2, kb.r * 1.9, kb.r * 2, kb.col);
          // Wide cast iron handle loop
          cyl('metal', kb.x - kb.r * 0.45, 0.04 + kb.r * 2.1, kb.z, 0.025, kb.r * 0.8, 0.025, '#334155', true);
          cyl('metal', kb.x + kb.r * 0.45, 0.04 + kb.r * 2.1, kb.z, 0.025, kb.r * 0.8, 0.025, '#334155', true);
          cyl('metal', kb.x, 0.04 + kb.r * 2.5, kb.z, 0.028, kb.r * 0.95, 0.028, '#334155', true); // top grip
        }

      } else if (/^pullupbar$/i.test(t)) {
        // Heavy-Duty Wall-Mounted Multi-Grip Chin-Up Bar (Wide neutral, angled, and close knurled grip positions)
        // 1. Heavy triangular steel wall mounting brackets
        for (const sx of [-0.38, 0.38]) {
          box('metal', sx, 0.50, -0.42, 0.06, 0.88, 0.04, '#0f172a', true);   // wall plate
          box('metal', sx, 0.50, -0.15, 0.05, 0.05, 0.58, '#0f172a', true);   // horizontal beam
          box('metal', sx, 0.26, -0.25, 0.04, 0.48, 0.04, '#0f172a', true);   // diagonal truss
        }
        // 2. Wide knurled pull-up bar spanning full 2 cells
        cyl('metal', 0, 0.52, 0.10, 0.045, 0.96, 0.045, '#cbd5e1', true);
        // Angled ergonomic wide-grip ends
        box('dark', -0.46, 0.48, 0.10, 0.05, 0.05, 0.18, '#1e293b');
        box('dark', 0.46, 0.48, 0.10, 0.05, 0.05, 0.18, '#1e293b');
        // Dual neutral-grip parallel handles
        for (const nx of [-0.18, 0.18]) {
          cyl('dark', nx, 0.52, 0.00, 0.038, 0.24, 0.038, '#111827');
        }

      } else if (/^gymball$/i.test(t)) {
        // 65cm Anti-Burst Concentric-Ribbed Inflatable Swiss Stability Fitness Ball with Base Ring
        // 1. Circular rubber floor stabilization ring
        cyl('dark', 0, 0.04, 0, 0.54, 0.08, 0.54, '#15171a');
        cyl('dark', 0, 0.04, 0, 0.38, 0.09, 0.38, '#000000');
        // 2. Smooth spherical fitness ball with subtle concentric anti-slip ribs
        round('fabric', 0, 0.52, 0, 0.74, 0.74, 0.74, color || '#38bdf8');
        cyl('fabric', 0, 0.52, 0, 0.75, 0.015, 0.75, HP.shade(color || '#38bdf8', 0.85)); // rib 1
        cyl('fabric', 0, 0.64, 0, 0.65, 0.015, 0.65, HP.shade(color || '#38bdf8', 0.85)); // rib 2
        cyl('fabric', 0, 0.40, 0, 0.65, 0.015, 0.65, HP.shade(color || '#38bdf8', 0.85)); // rib 3
        round('metal', 0, 0.89, 0, 0.04, 0.02, 0.04, '#f1f5f9');             // inflation plug

      } else if (/^foamroller$/i.test(t)) {
        // High-Density Textured Grid Trigger-Point Deep Tissue Massage Foam Roller with Hollow Core
        cylZ('dark', 0, 0.18, 0, 0.22, 0.22, 0.82, '#0f172a');                 // hollow core inner tube
        cylZ('fabric', 0, 0.18, 0, 0.34, 0.34, 0.80, color || '#6366f1');     // outer EVA foam matrix
        // 3D textured massage zones: finger ridges and palm pads
        for (let r = 0; r < 5; r++) {
          const rz = -0.28 + r * 0.14;
          cylZ('fabric', 0, 0.18, rz, 0.36, 0.36, 0.05, HP.shade(color || '#6366f1', 1.15));
        }

      } else if (/^stepplatform$/i.test(t)) {
        // Professional Commercial Aerobic Step Platform with Non-Slip Textured Deck and Stackable Risers
        // 1. Two stackable heavy-duty black riser blocks at each end
        for (const sx of [-0.36, 0.36]) {
          box('dark', sx, 0.06, 0, 0.22, 0.12, 0.76, '#15171a');             // bottom riser tier
          box('dark', sx, 0.16, 0.00, 0.20, 0.10, 0.72, '#1e2124');          // top riser tier
        }
        // 2. Wide shock-absorbing stepped top deck
        box('dark', 0, 0.24, 0, 0.94, 0.08, 0.82, '#1e293b');
        // Non-slip rubber ribbed mat on top
        box('fabric', 0, 0.29, 0, 0.90, 0.02, 0.78, color || '#ef4444');
        for (let g = 0; g < 5; g++) {
          box('dark', 0, 0.305, -0.28 + g * 0.14, 0.86, 0.005, 0.03, '#15171a'); // grip ribs
        }

      /* ---------------- KIDS & NURSERY (15 ITEMS) ---------------- */
      } else if (/^playmat$/i.test(t)) {
        // Interlocking Pastel Foam Sensory Puzzle Play Mat (3x3 footprint, dual-tone tiles, soft fabric border)
        box('fabric', 0, 0.02, 0, 0.96, 0.04, 0.96, color || '#fbcfe8');     // pastel base
        box('dark', 0, 0.005, 0, 0.98, 0.01, 0.98, '#e2e8f0');               // non-slip backing
        // 9 Interlocking puzzle squares with alternating pastel tones
        const pastels = ['#fbcfe8', '#bae6fd', '#bbf7d0', '#fef08a', '#e9d5ff'];
        for (let ix = 0; ix < 3; ix++) {
          for (let iz = 0; iz < 3; iz++) {
            const px = -0.32 + ix * 0.32, pz = -0.32 + iz * 0.32;
            const tileCol = pastels[(ix * 3 + iz) % pastels.length];
            box('fabric', px, 0.045, pz, 0.30, 0.015, 0.30, tileCol);
            round('fabric', px, 0.055, pz, 0.12, 0.01, 0.12, HP.shade(tileCol, 1.15)); // soft center animal/star icon
          }
        }
        // Arch baby play gym in corner
        cyl('wood', -0.28, 0.35, -0.28, 0.04, 0.65, 0.04, '#fed7aa');
        cyl('wood', 0.28, 0.35, -0.28, 0.04, 0.65, 0.04, '#fed7aa');
        cyl('wood', 0, 0.68, -0.28, 0.035, 0.58, 0.035, '#fed7aa');          // arch crossbar
        round('fabric', -0.12, 0.50, -0.28, 0.08, 0.08, 0.08, '#f472b6');     // hanging plush star
        round('fabric', 0.12, 0.50, -0.28, 0.08, 0.08, 0.08, '#38bdf8');      // hanging plush moon

      } else if (/^teepee$/i.test(t)) {
        // Natural Pine Canvas Play Tent (2x2 footprint, 4 natural timber poles lashed at peak, draped tie-back curtains, fairy lights)
        // 1. 4 angled natural pine poles
        for (const [px, pz, ry] of [[-0.40, -0.40, 0], [0.40, -0.40, 0], [-0.40, 0.40, 0], [0.40, 0.40, 0]]) {
          cyl('wood', px * 0.4, 0.52, pz * 0.4, 0.05, 1.05, 0.05, '#fed7aa');
        }
        // Top lash rope & wooden decorative stars
        cyl('fabric', 0, 0.94, 0, 0.16, 0.06, 0.16, '#d97706');               // thick jute lash cord
        // 2. Breathable cotton canvas pyramid tent
        part('roof', 'fabric', 0, 0.54, 0, 0.94, 0.88, 0.94, color || '#fdf4ff');
        // Front door draped open opening
        box('dark', 0, 0.32, 0.44, 0.42, 0.58, 0.06, '#382218');             // tent entrance cavity
        // Tie-back draped canvas curtain flaps
        box('fabric', -0.26, 0.34, 0.45, 0.16, 0.54, 0.04, HP.shade(color || '#fdf4ff', 0.92));
        box('fabric', 0.26, 0.34, 0.45, 0.16, 0.54, 0.04, HP.shade(color || '#fdf4ff', 0.92));
        // Plush round tufted floor cushion with pom-poms
        cyl('fabric', 0, 0.08, 0.02, 0.74, 0.10, 0.74, '#fbcfe8');
        // Fairy lights glowing warm dots along front edge
        for (let fl = 0; fl < 5; fl++) {
          round('glow', -0.32 + fl * 0.08, 0.18 + fl * 0.16, 0.42, 0.035, 0.035, 0.035, '#fef08a');
          round('glow', 0.32 - fl * 0.08, 0.18 + fl * 0.16, 0.42, 0.035, 0.035, 0.035, '#fef08a');
        }

      } else if (/^kidsdesk$/i.test(t)) {
        // Scandinavian Pastel Children Activity Desk & Chair (Angled birch legs, tiltable top, pencil groove)
        // 1. Splayed birch desk legs with pastel painted tips
        for (const [lx, lz] of [[-0.42, 0.34], [0.42, 0.34], [-0.42, -0.34], [0.42, -0.34]]) {
          cyl('wood', lx, 0.30, lz, 0.045, 0.60, 0.045, '#fed7aa');
          cyl('fabric', lx, 0.06, lz, 0.05, 0.12, 0.05, color || '#38bdf8'); // pastel sock tips
        }
        // Desk carcass & storage cubby
        box('wood', 0, 0.62, 0, 0.94, 0.14, 0.86, '#fed7aa');
        box('dark', 0, 0.62, 0.20, 0.86, 0.10, 0.40, '#fef3c7');             // open paper storage slot
        // Smooth pastel desktop with routed pencil groove
        box('ceramic', 0, 0.71, 0, 0.96, 0.04, 0.88, color || '#38bdf8');
        box('dark', 0, 0.732, -0.32, 0.64, 0.008, 0.04, '#0f172a');          // pencil groove
        // Colored pencils in wooden pot
        cyl('wood', 0.34, 0.82, -0.28, 0.09, 0.14, 0.09, '#fde68a');
        cyl('fabric', 0.32, 0.92, -0.28, 0.015, 0.12, 0.015, '#ef4444');      // red pencil
        cyl('fabric', 0.36, 0.92, -0.28, 0.015, 0.12, 0.015, '#10b981');      // green pencil

        // 2. Kids All-in-One Learning PC / Tablet with Kickstand & Pastel Peripherals
        // Wooden easel tablet kickstand
        box('wood', -0.06, 0.88, -0.20, 0.12, 0.32, 0.04, '#fed7aa');
        // 21.5" All-in-One pastel learning computer: casing 15px wide x 9.5px tall (w=0.28, h=0.43 in 53x22)
        box('ceramic', -0.06, 0.98, -0.14, 0.28, 0.43, 0.02, '#e0e7ff');
        box('dark', -0.06, 0.98, -0.128, 0.255, 0.38, 0.004, '#0f172a');
        // Bright colorful learning screen
        box('glow', -0.06, 0.98, -0.124, 0.24, 0.35, 0.003, '#38bdf8');
        box('glow', -0.06, 0.88, -0.121, 0.24, 0.12, 0.004, '#4ade80');        // grassy meadow green band
        box('glow', -0.06, 1.05, -0.121, 0.14, 0.06, 0.005, '#fef08a');        // yellow sunshine icon
        // Pastel wireless keyboard on desk
        box('ceramic', -0.06, 0.74, 0.10, 0.26, 0.016, 0.14, '#e0e7ff');
        box('ceramic', -0.06, 0.75, 0.10, 0.24, 0.006, 0.12, '#ffffff');
        // Cute ergonomic pebble mouse
        round('ceramic', 0.16, 0.745, 0.10, 0.045, 0.018, 0.07, '#c7d2fe');

      } else if (/^toybox$/i.test(t)) {
        // Soft-Close Safety Lid Toy Chest with Chalkboard Panel & Cutout Finger-Safe Handles
        // 1. Solid wooden chest carcass with rounded corners
        box('wood', 0, 0.44, 0, 0.94, 0.78, 0.88, color || '#f97316');
        box('dark', 0, 0.04, 0, 0.96, 0.08, 0.90, '#15171a');                // recessed base plinth
        // 2. Front chalkboard panel with chalk drawings
        box('dark', 0, 0.44, 0.445, 0.74, 0.52, 0.01, '#1e293b');            // slate chalkboard
        box('ceramic', -0.20, 0.46, 0.452, 0.06, 0.04, 0.005, '#ffffff');     // chalk flower doodle
        box('wood', 0.20, 0.18, 0.455, 0.18, 0.02, 0.04, '#fde68a');         // chalk ledge tray
        // 3. Hinged top lid with finger-safe center scoop handle
        box('wood', 0, 0.85, 0, 0.98, 0.06, 0.92, HP.shade(color || '#f97316', 1.08));
        box('dark', 0, 0.81, 0.445, 0.24, 0.04, 0.02, '#15171a');            // finger-safe cutout slot
        // Plush teddy bear peeking out of the toybox
        round('fabric', 0.26, 0.92, 0.10, 0.18, 0.18, 0.18, '#b45309');      // bear head
        round('fabric', 0.21, 0.99, 0.10, 0.06, 0.06, 0.04, '#b45309');      // left ear
        round('fabric', 0.31, 0.99, 0.10, 0.06, 0.06, 0.04, '#b45309');      // right ear

      } else if (/^rockchair$/i.test(t)) {
        // Nursery Glider Wingback Rocking Chair (Curved ash rocking runners, tufted backrest, padded armrests)
        // 1. Curved ash wood rocking runners
        for (const rx of [-0.34, 0.34]) {
          box('wood', rx, 0.04, 0, 0.05, 0.06, 0.94, '#d4a373');
          // Splayed chair leg spindles
          cyl('wood', rx, 0.20, -0.28, 0.04, 0.32, 0.04, '#d4a373');
          cyl('wood', rx, 0.20, 0.28, 0.04, 0.32, 0.04, '#d4a373');
        }
        // 2. Thick upholstered seat cushion
        box('fabric', 0, 0.38, 0.04, 0.74, 0.14, 0.68, color || '#64748b');
        // 3. High tufted wingback support
        box('fabric', 0, 0.70, -0.26, 0.72, 0.54, 0.16, color || '#64748b');
        // Side wing headrests
        box('fabric', -0.32, 0.76, -0.18, 0.10, 0.42, 0.28, HP.shade(color || '#64748b', 0.94));
        box('fabric', 0.32, 0.76, -0.18, 0.10, 0.42, 0.28, HP.shade(color || '#64748b', 0.94));
        // Padded rolled armrests with nursery book storage pouch
        for (const ax of [-0.36, 0.36]) {
          box('fabric', ax, 0.50, 0.04, 0.12, 0.14, 0.64, HP.shade(color || '#64748b', 1.06));
        }
        box('fabric', 0.43, 0.42, 0.04, 0.02, 0.18, 0.30, '#cbd5e1');        // book pouch

      } else if (/^ballpit$/i.test(t)) {
        // Circular Soft Foam Kids Ball Pit (2x2 footprint, velvet jersey cover, filled with 35+ colorful pastel plastic balls)
        // 1. Circular soft foam tub wall & padded floor
        cyl('dark', 0, 0.02, 0, 0.92, 0.04, 0.92, '#15171a');                 // non-slip floor base
        cyl('fabric', 0, 0.38, 0, 0.90, 0.68, 0.90, color || '#f472b6');     // outer velvet cylinder
        cyl('dark', 0, 0.40, 0, 0.76, 0.70, 0.76, '#fce7f3');                 // hollow interior cavity
        // 2. Array of colorful pastel plastic balls filling the pit
        const ballCols = ['#f43f5e', '#38bdf8', '#fbbf24', '#a855f7', '#34d399', '#ffffff'];
        for (let b = 0; b < 28; b++) {
          const ang = b * 0.92;
          const rad = 0.08 + (b % 4) * 0.07;
          const bx = Math.cos(ang) * rad, bz = Math.sin(ang) * rad;
          const by = 0.22 + Math.floor(b / 8) * 0.11;
          const bCol = ballCols[b % ballCols.length];
          round('ceramic', bx, by, bz, 0.12, 0.12, 0.12, bCol);
        }

      } else if (/^changetable$/i.test(t)) {
        // Solid Birch Nursery Changing Table (Contoured wipeable pad, 3-sided safety guard rails, dual storage shelves with diaper baskets)
        // 1. Solid square wooden post frame
        for (const [lx, lz] of [[-0.44, 0.42], [0.44, 0.42], [-0.44, -0.42], [0.44, -0.42]]) {
          box('wood', lx, 0.48, lz, 0.06, 0.96, 0.06, '#fed7aa');
        }
        // Dual lower storage shelves
        box('wood', 0, 0.22, 0, 0.88, 0.04, 0.84, '#fed7aa');
        box('wood', 0, 0.50, 0, 0.88, 0.04, 0.84, '#fed7aa');
        // Storage baskets on lower shelves holding diapers & wipes
        for (const bx of [-0.22, 0.22]) {
          box('fabric', bx, 0.32, 0, 0.36, 0.16, 0.68, '#e2e8f0');           // canvas storage cube
          box('fabric', bx, 0.60, 0, 0.36, 0.16, 0.68, '#fed7aa');
        }
        // 2. Top changing table surface with 3-sided safety rails
        box('wood', 0, 0.76, 0, 0.94, 0.04, 0.88, '#fed7aa');
        box('wood', -0.45, 0.84, 0, 0.04, 0.14, 0.88, '#fed7aa');            // left rail
        box('wood', 0.45, 0.84, 0, 0.04, 0.14, 0.88, '#fed7aa');             // right rail
        box('wood', 0, 0.84, -0.43, 0.94, 0.14, 0.04, '#fed7aa');            // back rail
        // 3. Ergonomic contoured white wipeable changing pad with safety strap
        box('fabric', 0, 0.80, 0, 0.82, 0.06, 0.80, '#f8fafc');
        box('fabric', -0.36, 0.84, 0, 0.10, 0.06, 0.80, '#f1f5f9');          // contoured left lip
        box('fabric', 0.36, 0.84, 0, 0.10, 0.06, 0.80, '#f1f5f9');           // contoured right lip
        box('metal', 0, 0.84, 0, 0.76, 0.02, 0.06, '#64748b', true);         // safety strap buckle

      } else if (/^highchair$/i.test(t)) {
        // Modern Scandinavian Wooden Grow-With-Me High Chair (A-frame legs, safety harness bar, removable white food tray)
        // 1. Splayed birch A-frame legs
        for (const [lx, lz] of [[-0.34, 0.34], [0.34, 0.34], [-0.34, -0.34], [0.34, -0.34]]) {
          cyl('wood', lx, 0.34, lz, 0.04, 0.68, 0.04, '#fed7aa');
        }
        // Footrest platform
        box('wood', 0, 0.28, 0.12, 0.52, 0.04, 0.24, '#fed7aa');
        // Seat platform & backrest
        box('ceramic', 0, 0.54, -0.04, 0.54, 0.06, 0.48, color || '#38bdf8');
        box('ceramic', 0, 0.74, -0.24, 0.52, 0.36, 0.06, color || '#38bdf8');
        // Safety bumper bar & crotch post
        box('wood', 0, 0.68, 0.08, 0.50, 0.04, 0.04, '#fed7aa');
        box('wood', 0, 0.60, 0.08, 0.04, 0.12, 0.04, '#fed7aa');
        // Removable white eating food tray with cup holder recess
        box('ceramic', 0, 0.69, 0.20, 0.64, 0.04, 0.34, '#ffffff');
        cyl('dark', 0.20, 0.712, 0.20, 0.09, 0.008, 0.09, '#e2e8f0');        // sippy cup recess
        cyl('ceramic', 0.20, 0.78, 0.20, 0.08, 0.12, 0.08, '#f472b6');        // baby sippy cup

      } else if (/^easel$/i.test(t)) {
        // Double-Sided A-Frame Children Art Easel (Chalkboard on front, whiteboard on rear, paint pot tray, top paper roll)
        // 1. Splayed wooden A-frame tripod legs
        for (const sx of [-0.36, 0.36]) {
          cyl('wood', sx, 0.50, -0.16, 0.045, 0.98, 0.045, '#fed7aa');
          cyl('wood', sx, 0.50, 0.16, 0.045, 0.98, 0.045, '#fed7aa');
          box('wood', sx, 0.34, 0, 0.04, 0.04, 0.34, '#fed7aa');             // side spreader bar
        }
        // 2. Large chalkboard display board on front
        box('wood', 0, 0.64, 0.15, 0.82, 0.56, 0.04, '#fed7aa');             // frame
        box('dark', 0, 0.64, 0.175, 0.74, 0.48, 0.01, '#1e293b');            // slate black board
        box('glow', 0, 0.64, 0.182, 0.18, 0.18, 0.005, '#fef08a');           // yellow chalk drawing
        // 3. Dual paint cup tray shelf underneath
        box('wood', 0, 0.35, 0.18, 0.84, 0.05, 0.22, '#fed7aa');
        // 3 colorful non-spill paint pots
        const paints = ['#ef4444', '#3b82f6', '#10b981'];
        for (let p = 0; p < 3; p++) {
          const px = -0.24 + p * 0.24;
          cyl('ceramic', px, 0.42, 0.18, 0.10, 0.09, 0.10, '#ffffff');
          cyl('fabric', px, 0.45, 0.18, 0.08, 0.04, 0.08, paints[p]);         // bright paint color
        }
        // Top kraft paper roll dowel
        cyl('wood', 0, 0.94, 0, 0.03, 0.80, 0.03, '#d4a373');
        cyl('fabric', 0, 0.94, 0, 0.10, 0.64, 0.10, '#fef3c7');              // paper roll

      } else if (/^rockhorse$/i.test(t)) {
        // Handcrafted Wooden Rocking Horse (Curved arched rockers, carved horse torso, yarn mane, red saddle, brass safety pegs)
        // 1. Twin curved arched wooden rockers on floor
        for (const rx of [-0.28, 0.28]) {
          box('wood', rx, 0.05, 0, 0.045, 0.08, 0.94, '#d97706');
          box('wood', rx, 0.09, -0.42, 0.045, 0.10, 0.10, '#d97706');        // curved tip front
          box('wood', rx, 0.09, 0.42, 0.045, 0.10, 0.10, '#d97706');         // curved tip back
          // Leg posts
          cyl('wood', rx, 0.22, -0.22, 0.035, 0.28, 0.035, '#fed7aa');
          cyl('wood', rx, 0.22, 0.22, 0.035, 0.28, 0.035, '#fed7aa');
        }
        // 2. Sculpted wooden horse body & arched neck/head
        box('wood', 0, 0.38, 0, 0.26, 0.18, 0.58, color || '#b45309');
        box('wood', 0, 0.58, -0.22, 0.18, 0.34, 0.18, color || '#b45309');   // neck
        box('wood', 0, 0.72, -0.28, 0.16, 0.16, 0.22, color || '#b45309');   // head & muzzle
        // Pointed horse ears
        box('wood', -0.06, 0.83, -0.22, 0.03, 0.08, 0.04, color || '#b45309');
        box('wood', 0.06, 0.83, -0.22, 0.03, 0.08, 0.04, color || '#b45309');
        // Handlebar pegs for little hands (horizontal wooden crossbar)
        cylX('wood', 0, 0.70, -0.24, 0.46, 0.03, 0.03, '#fde68a');
        // 3. Padded red leather saddle & stirrup straps
        box('fabric', 0, 0.48, 0, 0.28, 0.05, 0.28, '#ef4444');
        box('fabric', 0, 0.54, 0.12, 0.26, 0.09, 0.06, '#b91c1c');          // saddle cantle back
        // Angled yarn tail
        boxSlope('fabric', 0, 0.42, 0.26, 0, 0.22, 0.42, 0.05, 0.05, '#fef08a');

      } else if (/^dollhouse$/i.test(t)) {
        // 3-Story Victorian Wooden Open-Face Dollhouse (2x1 footprint, pitched gabled roof with dormer, decorated rooms, miniature stairs)
        // 1. Dollhouse main structure & floors
        box('wood', 0, 0.48, -0.24, 0.94, 0.88, 0.05, '#f8fafc');            // back exterior wall
        box('wood', -0.45, 0.48, 0.08, 0.05, 0.88, 0.68, '#f8fafc');         // left side wall
        box('wood', 0.45, 0.48, 0.08, 0.05, 0.88, 0.68, '#f8fafc');          // right side wall
        box('wood', 0, 0.32, 0.08, 0.88, 0.04, 0.64, '#fde68a');             // 2nd floor ceiling
        box('wood', 0, 0.62, 0.08, 0.88, 0.04, 0.64, '#fde68a');             // 3rd floor attic floor
        box('wood', 0, 0.32, 0.08, 0.04, 0.58, 0.64, '#fed7aa');             // vertical room divider
        // 2. Pitched gabled roof in pastel pink/teal with dormer window
        part('roof', 'wood', 0, 0.88, 0.08, 0.98, 0.32, 0.72, color || '#f472b6');
        box('ceramic', 0, 0.88, 0.36, 0.16, 0.14, 0.14, '#ffffff');          // dormer window
        box('glass', 0, 0.88, 0.435, 0.12, 0.10, 0.01, '#38bdf8');
        // Miniature dollhouse furniture visible inside rooms
        box('fabric', -0.24, 0.10, 0.10, 0.22, 0.08, 0.16, '#ec4899');        // tiny living sofa
        box('wood', 0.24, 0.10, 0.10, 0.20, 0.12, 0.14, '#38bdf8');          // tiny kitchen counter
        box('fabric', -0.24, 0.40, 0.10, 0.24, 0.10, 0.28, '#a855f7');        // tiny bedroom bed

      } else if (/^toykitchen$/i.test(t)) {
        // Miniature Wooden Play Kitchen (Mini stainless sink & faucet, 2-burner stovetop, acrylic oven door, microwave, utensil hooks)
        // 1. Play kitchen carcass
        box('wood', 0, 0.36, 0, 0.92, 0.68, 0.86, color || '#f472b6');
        box('dark', 0, 0.04, 0, 0.94, 0.08, 0.88, '#15171a');                // plinth
        // 2. Oven door with acrylic transparent viewing window and clicking dials
        box('dark', -0.22, 0.36, 0.435, 0.42, 0.48, 0.02, '#181b1e');        // oven cavity
        box('glass', -0.22, 0.36, 0.446, 0.32, 0.32, 0.01, '#38bdf8');       // oven glass
        box('wood', -0.22, 0.56, 0.46, 0.28, 0.03, 0.03, '#fed7aa');         // oven handle
        // Stovetop control dials
        for (let d = 0; d < 3; d++) {
          cyl('metal', -0.34 + d * 0.12, 0.64, 0.445, 0.05, 0.02, 0.05, '#c9a44e', true);
        }
        // 3. Countertop with 2 burner induction rings & undermount sink
        box('ceramic', 0, 0.72, 0, 0.96, 0.04, 0.90, '#ffffff');
        // Dual stovetop burner rings
        cyl('dark', -0.22, 0.742, -0.10, 0.22, 0.005, 0.22, '#1e293b');
        cyl('dark', -0.22, 0.742, 0.14, 0.18, 0.005, 0.18, '#1e293b');
        // Sink basin & gooseneck faucet
        box('metal', 0.22, 0.70, 0.02, 0.30, 0.06, 0.34, '#cbd5e1', true);
        cyl('metal', 0.22, 0.82, -0.12, 0.025, 0.18, 0.025, '#c9a44e', true);// brass faucet
        // Upper microwave unit & utensil hanging rack
        box('wood', 0, 0.92, -0.24, 0.92, 0.32, 0.36, color || '#f472b6');
        box('dark', 0.18, 0.92, -0.05, 0.42, 0.22, 0.02, '#1e293b');         // microwave door
        box('glow', 0.18, 0.92, -0.038, 0.32, 0.16, 0.005, '#fef08a');

      } else if (/^kidstable$/i.test(t)) {
        // Round Wooden Activity Play Table with 4 Mini Stools and Center Crayon Caddy
        // 1. Center round table with splayed birch legs
        for (const [lx, lz] of [[-0.22, 0.22], [0.22, 0.22], [-0.22, -0.22], [0.22, -0.22]]) {
          cyl('wood', lx, 0.28, lz, 0.04, 0.54, 0.04, '#fed7aa');
        }
        // Round pastel tabletop (diameter 0.62)
        cyl('ceramic', 0, 0.56, 0, 0.62, 0.04, 0.62, color || '#ffffff');
        // Center rotating wooden crayon caddy
        cyl('wood', 0, 0.62, 0, 0.16, 0.08, 0.16, '#fde68a');
        cyl('fabric', -0.03, 0.70, 0, 0.02, 0.10, 0.02, '#ef4444');          // red crayon
        cyl('fabric', 0.03, 0.70, 0, 0.02, 0.10, 0.02, '#3b82f6');           // blue crayon
        // 2. 4 mini wooden stools tucked around table
        const stoolCols = ['#f472b6', '#38bdf8', '#fbbf24', '#4ade80'];
        const stoolPos = [[-0.38, 0], [0.38, 0], [0, -0.38], [0, 0.38]];
        for (let s = 0; s < 4; s++) {
          const [sx, sz] = stoolPos[s];
          cyl('wood', sx, 0.16, sz, 0.03, 0.30, 0.03, '#fed7aa');              // stool post
          cyl('ceramic', sx, 0.32, sz, 0.24, 0.04, 0.24, stoolCols[s]);        // colorful round seat
        }

      } else if (/^nightlight$/i.test(t)) {
        // Soft Glowing Bunny Silicone Night Light on Natural Beech Wood Base (Soothing warm glow)
        // 1. Round natural beech wood base
        cyl('wood', 0, 0.08, 0, 0.52, 0.14, 0.52, '#fed7aa');
        cyl('dark', 0, 0.02, 0, 0.48, 0.04, 0.48, '#15171a');                 // rubber feet
        box('metal', 0, 0.08, 0.24, 0.06, 0.03, 0.02, '#cbd5e1', true);      // touch sensor button
        // 2. Translucent soft silicone bunny body with warm glowing core
        round('glow', 0, 0.42, 0, 0.46, 0.52, 0.46, color || '#fef08a');     // glowing core
        round('ceramic', 0, 0.42, 0, 0.48, 0.54, 0.48, '#ffffff');            // silicone diffusion shell
        // Cute bunny ears
        cyl('ceramic', -0.12, 0.78, 0, 0.08, 0.28, 0.06, '#ffffff');
        cyl('ceramic', 0.12, 0.78, 0, 0.08, 0.28, 0.06, '#ffffff');
        cyl('glow', -0.12, 0.78, 0.02, 0.04, 0.22, 0.03, '#fbcfe8');          // pink inner ear glow
        cyl('glow', 0.12, 0.78, 0.02, 0.04, 0.22, 0.03, '#fbcfe8');
        // Cute sleepy facial details
        cyl('dark', -0.09, 0.44, 0.23, 0.02, 0.01, 0.02, '#181b1e');          // left eye
        cyl('dark', 0.09, 0.44, 0.23, 0.02, 0.01, 0.02, '#181b1e');           // right eye
        round('fabric', 0, 0.38, 0.24, 0.03, 0.02, 0.03, '#f472b6');          // pink nose

      } else if (/^beanbag2$/i.test(t)) {
        // Kids Slouched Velvet Bean Pod with Top Carry Handle and Piped Seams
        // Slouched organic pear-shaped beanbag body
        round('fabric', 0, 0.28, 0.04, 0.82, 0.52, 0.82, color || '#a855f7');
        round('fabric', 0, 0.58, -0.08, 0.60, 0.46, 0.58, HP.shade(color || '#a855f7', 1.08));
        // Deep sunken seat indentation
        round('dark', 0, 0.48, 0.06, 0.48, 0.14, 0.48, HP.shade(color || '#a855f7', 0.88));
        // Reinforced top carry strap handle
        box('fabric', 0, 0.84, -0.10, 0.14, 0.06, 0.04, HP.shade(color || '#a855f7', 1.25));

      
      /* ---------------- GAMES & ENTERTAINMENT (10 ITEMS) ---------------- */
      } else if (/^pingpong$/i.test(t)) {
        // Tournament-Grade 9ft ITTF Table Tennis Ping Pong Table (5x3 footprint, dual undercarriage folding chassis, caster wheels, taut mesh net with clamp posts)
        // 1. Heavy tubular steel undercarriage frame with 8 caster wheels
        for (const sx of [-0.25, 0.25]) {
          box('metal', sx, 0.12, 0, 0.05, 0.24, 0.82, '#1e293b', true);
          box('dark', sx, 0.03, -0.38, 0.08, 0.06, 0.08, '#0f172a');         // caster wheels
          box('dark', sx, 0.03, 0.38, 0.08, 0.06, 0.08, '#0f172a');
        }
        for (const [lx, lz] of [[-0.42, -0.38], [-0.42, 0.38], [0.42, -0.38], [0.42, 0.38]]) {
          cyl('metal', lx, 0.40, lz, 0.045, 0.72, 0.045, '#334155', true);
          cyl('metal', lx, 0.03, lz, 0.06, 0.06, 0.06, '#cbd5e1', true);      // rubber leveling foot
        }
        // Heavy steel apron perimeter rails
        box('metal', 0, 0.74, 0, 0.96, 0.06, 0.90, '#1e293b', true);
        // 2. High-density composite tournament playing surface (blue or green)
        box('ceramic', 0, 0.79, 0, 0.98, 0.04, 0.92, color || '#1e3a8a');
        // Crisp white boundary lines & center serve dividing stripe
        box('fabric', 0, 0.812, 0, 0.97, 0.005, 0.015, '#ffffff');           // longitudinal centerline
        box('fabric', 0, 0.812, -0.455, 0.97, 0.005, 0.015, '#ffffff');        // top edge line
        box('fabric', 0, 0.812, 0.455, 0.97, 0.005, 0.015, '#ffffff');         // bottom edge line
        box('fabric', -0.485, 0.812, 0, 0.015, 0.005, 0.92, '#ffffff');        // left baseline
        box('fabric', 0.485, 0.812, 0, 0.015, 0.005, 0.92, '#ffffff');         // right baseline
        // 3. Taut center mesh net with heavy metal clamp posts
        cyl('metal', 0, 0.88, -0.48, 0.03, 0.18, 0.03, '#1e293b', true);      // left net post
        cyl('metal', 0, 0.88, 0.48, 0.03, 0.18, 0.03, '#1e293b', true);       // right net post
        box('fabric', 0, 0.88, 0, 0.01, 0.14, 0.96, '#f1f5f9');               // fine net mesh
        box('fabric', 0, 0.955, 0, 0.012, 0.02, 0.96, '#ffffff');             // white net top tape
        // Table tennis paddles & ball on table
        round('ceramic', -0.18, 0.825, 0.18, 0.04, 0.04, 0.04, '#fbbf24');     // 40mm orange ball
        cyl('dark', 0.18, 0.82, 0.22, 0.10, 0.015, 0.10, '#ef4444');          // red rubber paddle face
        box('wood', 0.18, 0.82, 0.30, 0.03, 0.015, 0.08, '#fed7aa');          // flared wooden handle

      } else if (/^foosball$/i.test(t)) {
        // Pub Competition Foosball Table (3x2 footprint, heavy solid wood cabinet, green pitch, 8 stainless player rods, manual abacus scorers)
        // 1. Splayed heavy square wooden legs with chrome leveling feet
        for (const [lx, lz] of [[-0.44, -0.38], [0.44, -0.38], [-0.44, 0.38], [0.44, 0.38]]) {
          box('wood', lx, 0.36, lz, 0.09, 0.72, 0.09, '#451a03');
          cyl('metal', lx, 0.03, lz, 0.08, 0.06, 0.08, '#cbd5e1', true);
        }
        // Heavy furniture-grade cabinet body
        box('wood', 0, 0.68, 0, 0.94, 0.36, 0.88, color || '#78350f');
        // Goal mouth openings on each end
        box('dark', -0.475, 0.64, 0, 0.02, 0.16, 0.26, '#0f172a');
        box('dark', 0.475, 0.64, 0, 0.02, 0.16, 0.26, '#0f172a');
        // 2. Sunken green playing field with ramped corners
        box('fabric', 0, 0.62, 0, 0.86, 0.02, 0.80, '#15803d');
        box('fabric', 0, 0.632, 0, 0.01, 0.005, 0.78, '#ffffff');             // halfway line
        cyl('fabric', 0, 0.632, 0, 0.16, 0.005, 0.16, '#ffffff');             // center circle
        // 3. 8 Stainless steel through-rods traversing horizontally across table (along Z)
        for (let r = 0; r < 8; r++) {
          const rx = -0.35 + r * 0.10;
          // Polished stainless steel horizontal player rod spanning along Z
          cylZ('metal', rx, 0.76, 0, 0.018, 0.018, 1.06, '#cbd5e1');
          // Ergonomic contoured rubber handle grip on operating side
          const handleZ = (r % 2 === 0 ? -0.52 : 0.52);
          cylZ('dark', rx, 0.76, handleZ, 0.036, 0.036, 0.12, '#181b1e');
          round('wood', rx, 0.76, handleZ + (r % 2 === 0 ? -0.06 : 0.06), 0.032, 0.032, 0.032, '#d4a373'); // wooden handle end
          // Safety rubber bumper stopper on opposite rod end
          const bumperZ = (r % 2 === 0 ? 0.50 : -0.50);
          cylZ('dark', rx, 0.76, bumperZ, 0.026, 0.026, 0.04, '#181b1e');
          // Miniature molded tournament soccer player figurines (red team vs blue team)
          const pCol = (r % 2 === 0) ? '#ef4444' : '#2563eb';
          const numFigs = (r === 0 || r === 7) ? 1 : (r === 1 || r === 6) ? 2 : (r === 2 || r === 5) ? 5 : 3;
          for (let f = 0; f < numFigs; f++) {
            const fz = -0.30 + f * (0.60 / Math.max(1, numFigs - 1));
            // Player torso clamped on rod
            box('ceramic', rx, 0.73, fz, 0.035, 0.09, 0.035, pCol);
            // Angular robotic kicking foot block
            box('ceramic', rx, 0.67, fz, 0.032, 0.04, 0.030, pCol);
            // Molded head with hair
            round('ceramic', rx, 0.79, fz, 0.032, 0.032, 0.032, '#fed7aa');
            round('dark', rx, 0.805, fz, 0.030, 0.015, 0.030, '#1e293b');
          }
        }
        // Score abacus slider beads on end rails
        for (let b = 0; b < 10; b++) {
          round('ceramic', -0.42, 0.87, -0.20 + b * 0.04, 0.025, 0.025, 0.025, '#ef4444');
          round('ceramic', 0.42, 0.87, -0.20 + b * 0.04, 0.025, 0.025, 0.025, '#2563eb');
        }

      } else if (/^airhockey$/i.test(t)) {
        // High-Output Blower Commercial Air Hockey Table (3x2 footprint, perforated acrylic playfield, aluminum rebound rails, electronic LED score arch)
        // 1. Heavy angled pedestal legs with brushed steel trim
        for (const [lx, lz] of [[-0.42, -0.36], [0.42, -0.36], [-0.42, 0.36], [0.42, 0.36]]) {
          box('dark', lx, 0.34, lz, 0.10, 0.68, 0.10, '#15171a');
          box('metal', lx, 0.34, lz, 0.11, 0.12, 0.11, '#38bdf8', true);      // cyan glowing neon band
        }
        // Heavy aerodynamic cabinet chassis
        box('dark', 0, 0.66, 0, 0.94, 0.28, 0.88, '#1e2124');
        // Aluminum rebound rails around perimeter
        box('metal', 0, 0.74, -0.42, 0.96, 0.08, 0.04, '#cbd5e1', true);
        box('metal', 0, 0.74, 0.42, 0.96, 0.08, 0.04, '#cbd5e1', true);
        box('metal', -0.46, 0.74, 0, 0.04, 0.08, 0.88, '#cbd5e1', true);
        box('metal', 0.46, 0.74, 0, 0.04, 0.08, 0.88, '#cbd5e1', true);
        // 2. High-gloss white micro-perforated air playfield
        box('ceramic', 0, 0.71, 0, 0.90, 0.03, 0.80, '#f8fafc');
        // Vivid printed red and blue rink circle graphics
        cyl('fabric', 0, 0.728, 0, 0.28, 0.005, 0.28, '#ef4444');             // center face-off ring
        cyl('fabric', -0.30, 0.728, 0, 0.22, 0.005, 0.22, '#3b82f6');         // left goal crease
        cyl('fabric', 0.30, 0.728, 0, 0.22, 0.005, 0.22, '#ef4444');          // right goal crease
        // 3. Center arch overhead electronic LED digital scoreboard
        cyl('metal', 0, 0.88, -0.42, 0.03, 0.34, 0.03, '#1e293b', true);      // left arch pillar
        cyl('metal', 0, 0.88, 0.42, 0.03, 0.34, 0.03, '#1e293b', true);       // right arch pillar
        box('dark', 0, 1.02, 0, 0.28, 0.12, 0.86, '#0f172a');                 // overhead arch console
        box('glow', 0, 1.02, 0.10, 0.08, 0.06, 0.01, '#ef4444');              // home score LED: 7
        box('glow', 0, 1.02, -0.10, 0.08, 0.06, 0.01, '#38bdf8');             // away score LED: 4
        // Red ergonomic striker mallet & polycarbonate puck on table
        cyl('ceramic', -0.22, 0.76, 0.08, 0.10, 0.06, 0.10, '#ef4444');       // mallet base
        cyl('dark', -0.22, 0.81, 0.08, 0.04, 0.06, 0.04, '#181b1e');          // knob handle
        cyl('ceramic', 0.08, 0.73, -0.04, 0.07, 0.015, 0.07, '#ef4444');       // floating puck

      } else if (/^dartboard$/i.test(t)) {
        // Cabinet-Enclosed Sisal Bristle Dartboard with Open Walnut Doors and Chalk Scoreboards
        // 1. Walnut wall cabinet backboard & hinged doors opened wide
        box('wood', 0, 0.50, -0.04, 0.94, 0.94, 0.08, '#451a03');            // center cabinet
        box('wood', -0.52, 0.50, 0.08, 0.42, 0.88, 0.04, '#451a03');          // left door open
        box('wood', 0.52, 0.50, 0.08, 0.42, 0.88, 0.04, '#451a03');           // right door open
        // Chalk scoreboards on interior faces of doors
        box('dark', -0.52, 0.50, 0.105, 0.34, 0.76, 0.01, '#1e293b');
        box('dark', 0.52, 0.50, 0.105, 0.34, 0.76, 0.01, '#1e293b');
        box('glow', -0.52, 0.50, 0.112, 0.14, 0.30, 0.005, '#fef08a');        // chalk cricket score grid
        // 2. High-grade African sisal bristle dartboard with metal spider (facing +Z on backboard)
        cylZ('fabric', 0, 0.50, 0.04, 0.68, 0.68, 0.03, '#1e293b');            // black outer ring
        cylZ('fabric', 0, 0.50, 0.05, 0.56, 0.56, 0.02, '#fed7aa');            // sisal fiber bed
        // Alternating red and green double & triple rings
        cylZ('fabric', 0, 0.50, 0.055, 0.52, 0.52, 0.015, '#ef4444');
        cylZ('fabric', 0, 0.50, 0.058, 0.36, 0.36, 0.015, '#15803d');
        // Bullseye at center
        round('ceramic', 0, 0.50, 0.08, 0.06, 0.06, 0.04, '#15803d');         // outer bull
        round('ceramic', 0, 0.50, 0.09, 0.03, 0.03, 0.04, '#ef4444');         // inner double bull
        // Metal wire number ring (1-20)
        cylZ('metal', 0, 0.50, 0.065, 0.62, 0.62, 0.01, '#cbd5e1', true);
        // 3 Brass darts stuck in 20/treble bed
        cyl('metal', 0, 0.66, 0.14, 0.01, 0.16, 0.01, '#c9a44e', true);
        box('fabric', 0, 0.72, 0.18, 0.04, 0.04, 0.01, '#ef4444');            // red flights

      } else if (/^arcade$/i.test(t)) {
        // Classic 1980s Retro Upright Arcade Cabinet (1x2 footprint, backlit marquee, angled CRT, dual 6-button control deck, 25¢ coin door)
        // 1. T-molding trimmed arcade cabinet carcass
        box('dark', 0, 0.50, 0, 0.92, 0.98, 0.86, color || '#181b1e');
        // Side art decals (electric magenta/cyan vinyl side wraps)
        box('glow', -0.465, 0.50, 0, 0.005, 0.88, 0.78, '#ec4899');
        box('glow', 0.465, 0.50, 0, 0.005, 0.88, 0.78, '#06b6d4');
        // 2. High-intensity illuminated top marquee header banner
        box('dark', 0, 0.94, 0.28, 0.88, 0.14, 0.28, '#0f172a');
        box('glow', 0, 0.94, 0.425, 0.84, 0.11, 0.01, '#facc15');             // illuminated "ARCADE CLASSIC"
        // 3. Angled deep shadowbox CRT monitor with vibrant retro game scanlines
        box('dark', 0, 0.70, 0.18, 0.82, 0.36, 0.24, '#0f172a');
        box('glow', 0, 0.70, 0.26, 0.72, 0.30, 0.01, '#3b82f6');              // pixel graphics CRT display
        // 4. Slanted control panel deck with 2 players joysticks & 12 buttons
        box('metal', 0, 0.52, 0.34, 0.88, 0.08, 0.32, '#1e293b', true);
        // Player 1: red ball-top joystick + 6 colored buttons
        cyl('metal', -0.24, 0.58, 0.34, 0.015, 0.09, 0.015, '#cbd5e1', true);
        round('ceramic', -0.24, 0.63, 0.34, 0.05, 0.05, 0.05, '#ef4444');     // red joystick ball
        for (let b = 0; b < 6; b++) {
          const bx = -0.16 + (b % 3) * 0.045, bz = 0.32 + Math.floor(b / 3) * 0.045;
          cyl('ceramic', bx, 0.57, bz, 0.025, 0.02, 0.025, '#38bdf8');
        }
        // Player 2: blue ball-top joystick + 6 colored buttons
        cyl('metal', 0.12, 0.58, 0.34, 0.015, 0.09, 0.015, '#cbd5e1', true);
        round('ceramic', 0.12, 0.63, 0.34, 0.05, 0.05, 0.05, '#3b82f6');      // blue joystick ball
        for (let b = 0; b < 6; b++) {
          const bx = 0.20 + (b % 3) * 0.045, bz = 0.32 + Math.floor(b / 3) * 0.045;
          cyl('ceramic', bx, 0.57, bz, 0.025, 0.02, 0.025, '#fbbf24');
        }
        // 5. Dual 25¢ metal coin door with red illuminated return buttons
        box('metal', 0, 0.22, 0.435, 0.48, 0.34, 0.02, '#334155', true);
        box('glow', -0.12, 0.24, 0.448, 0.06, 0.05, 0.01, '#ef4444');         // coin slot 1
        box('glow', 0.12, 0.24, 0.448, 0.06, 0.05, 0.01, '#ef4444');          // coin slot 2

      } else if (/^chess$/i.test(t)) {
        // Handcrafted Walnut & Maple Chess Table with 32 Carved Staunton Pieces & Dual Drawers
        // 1. Turned pedestal center leg with 4 carved cabriole feet
        cyl('wood', 0, 0.36, 0, 0.12, 0.68, 0.12, '#451a03');
        box('wood', 0, 0.06, 0, 0.68, 0.08, 0.68, '#451a03');                 // 4-way floor base
        // Tabletop box with dual brass pull drawers
        box('wood', 0, 0.70, 0, 0.88, 0.10, 0.88, '#78350f');
        box('metal', -0.445, 0.70, 0, 0.01, 0.02, 0.08, '#c9a44e', true);     // left drawer pull
        box('metal', 0.445, 0.70, 0, 0.01, 0.02, 0.08, '#c9a44e', true);      // right drawer pull
        // 2. Inlaid walnut & sycamore 8x8 checkerboard surface
        box('wood', 0, 0.76, 0, 0.92, 0.02, 0.92, '#451a03');                 // border margin
        for (let ix = 0; ix < 8; ix++) {
          for (let iz = 0; iz < 8; iz++) {
            const sqX = -0.315 + ix * 0.09, sqZ = -0.315 + iz * 0.09;
            const isDark = (ix + iz) % 2 === 1;
            box('wood', sqX, 0.775, sqZ, 0.085, 0.01, 0.085, isDark ? '#451a03' : '#fed7aa');
            // Miniature Staunton chess pieces lined up on starting ranks
            if (iz === 0 || iz === 1 || iz === 6 || iz === 7) {
              const pCol = (iz <= 1) ? '#181b1e' : '#fef3c7';
              const pHeight = (iz === 0 || iz === 7) ? ((ix === 3 || ix === 4) ? 0.09 : 0.07) : 0.05;
              cyl('ceramic', sqX, 0.78 + pHeight / 2, sqZ, 0.035, pHeight, 0.035, pCol);
              round('ceramic', sqX, 0.78 + pHeight, sqZ, 0.03, 0.03, 0.03, pCol); // piece head
            }
          }
        }

      } else if (/^pinball$/i.test(t)) {
        // Classic Solid-State Pinball Machine (1x2 footprint, tall backglass translite, angled playfield, pop bumpers, chrome plunger)
        // 1. Chrome tubular splayed legs with leveling feet
        for (const [lx, lz] of [[-0.42, -0.40], [0.42, -0.40], [-0.42, 0.40], [0.42, 0.40]]) {
          cyl('metal', lx, 0.32, lz, 0.045, 0.64, 0.045, '#cbd5e1', true);
          cyl('metal', lx, 0.02, lz, 0.07, 0.04, 0.07, '#cbd5e1', true);
        }
        // Slanted main cabinet body
        box('wood', 0, 0.58, 0, 0.88, 0.30, 0.88, color || '#701a75');
        // Side flipper buttons & front chrome plunger rod
        box('glow', -0.45, 0.66, 0.28, 0.02, 0.04, 0.04, '#ef4444');          // left flipper button
        box('glow', 0.45, 0.66, 0.28, 0.02, 0.04, 0.04, '#ef4444');           // right flipper button
        cyl('metal', 0.34, 0.64, 0.46, 0.02, 0.12, 0.02, '#cbd5e1', true);    // chrome plunger handle
        // 2. Playfield under transparent tempered glass
        box('glass', 0, 0.74, 0, 0.82, 0.015, 0.82, '#d8eef4');
        box('fabric', 0, 0.71, 0, 0.80, 0.02, 0.80, '#f59e0b');               // vibrant playfield artwork
        // Glowing pop bumpers, slingshots and wireform ramps
        round('glow', -0.16, 0.74, -0.18, 0.10, 0.06, 0.10, '#38bdf8');       // blue pop bumper
        round('glow', 0.16, 0.74, -0.18, 0.10, 0.06, 0.10, '#38bdf8');
        round('glow', 0, 0.74, -0.28, 0.10, 0.06, 0.10, '#ef4444');           // red pop bumper
        // Chrome steel wireform ball habitrail ramp
        cyl('metal', -0.28, 0.76, 0, 0.015, 0.64, 0.015, '#cbd5e1', true);
        // 3. Tall vertical backbox translite with dynamic scoring DMD displays
        box('dark', 0, 1.02, -0.40, 0.86, 0.58, 0.18, '#0f172a');
        box('glow', 0, 1.05, -0.305, 0.80, 0.48, 0.01, '#ec4899');            // glowing translite art
        box('glow', 0, 0.84, -0.305, 0.62, 0.08, 0.01, '#f97316');            // orange dot-matrix score display

      } else if (/^cardtable$/i.test(t)) {
        // Octagonal Luxury Casino Poker Table (2x2 footprint, padded leather armrest rail, sunken green speed cloth, brass cup holders, chip trays)
        // 1. Heavy fluted dark oak pedestal base
        cyl('wood', 0, 0.32, 0, 0.38, 0.62, 0.38, '#1e293b');
        box('wood', 0, 0.05, 0, 0.72, 0.08, 0.72, '#0f172a');                 // cruciform floor plinth
        // 2. Octagonal padded leather armrest perimeter rim
        cyl('fabric', 0, 0.68, 0, 0.94, 0.10, 0.94, '#1c1917');               // black leather bolsters
        // 3. Sunken tournament green speed cloth poker felt
        cyl('fabric', 0, 0.70, 0, 0.78, 0.08, 0.78, color || '#15803d');
        // 8 Brass cup holders embedded into the wood racetrack
        for (let c = 0; c < 8; c++) {
          const ang = c * (Math.PI / 4);
          const cx = Math.cos(ang) * 0.39, cz = Math.sin(ang) * 0.39;
          cyl('metal', cx, 0.735, cz, 0.08, 0.015, 0.08, '#c9a44e', true);     // polished brass rim
          cyl('dark', cx, 0.738, cz, 0.06, 0.015, 0.06, '#0f172a');
        }
        // Center dealer tray with colored poker chips & card decks
        cyl('ceramic', -0.08, 0.75, 0, 0.05, 0.04, 0.05, '#ef4444');          // red chip stack
        cyl('ceramic', 0, 0.75, 0, 0.05, 0.05, 0.05, '#3b82f6');              // blue chip stack
        cyl('ceramic', 0.08, 0.75, 0, 0.05, 0.03, 0.05, '#22c55e');           // green chip stack
        box('fabric', 0, 0.745, -0.12, 0.09, 0.02, 0.06, '#ffffff');           // Bicycle card deck

      } else if (/^poolcues$/i.test(t)) {
        // Solid Walnut Wall/Floor Corner Cue Rack (Holds 6 maple cues, triangle rack, ball shelves, chalk blocks)
        // 1. Traditional fluted solid wood rack stand
        box('wood', 0, 0.50, -0.40, 0.88, 0.96, 0.14, color || '#451a03');   // back panel
        box('wood', 0, 0.10, -0.28, 0.84, 0.08, 0.34, color || '#451a03');   // bottom shelf
        box('wood', 0, 0.92, -0.28, 0.84, 0.06, 0.34, color || '#451a03');   // top clip shelf
        // 2. 6 Maple billiard cue sticks racked vertically
        for (let q = 0; q < 6; q++) {
          const qx = -0.32 + q * 0.13;
          cyl('wood', qx, 0.52, -0.28, 0.025, 0.88, 0.025, '#fed7aa');        // tapered cue shaft
          cyl('dark', qx, 0.22, -0.28, 0.032, 0.26, 0.032, '#181b1e');        // linen butt wrap
          cyl('metal', qx, 0.11, -0.28, 0.034, 0.04, 0.034, '#c9a44e', true); // brass bumper
          round('ceramic', qx, 0.96, -0.28, 0.02, 0.02, 0.02, '#38bdf8');     // blue leather tip
        }
        // Triangular 8-ball walnut rack hanging on center hook
        box('wood', 0, 0.52, -0.32, 0.26, 0.26, 0.04, '#78350f');
        box('dark', 0, 0.52, -0.32, 0.18, 0.18, 0.05, '#15171a');            // hollow triangle
        // 2 Blue Master billiard chalk cubes on bottom shelf
        box('ceramic', 0.28, 0.16, -0.22, 0.04, 0.04, 0.04, '#0284c7');
        box('ceramic', -0.28, 0.16, -0.22, 0.04, 0.04, 0.04, '#0284c7');

      } else if (/^chessclock$/i.test(t)) {
        // Vintage Mechanical Tournament Chess Clock & Wooden Board Game Shelf Unit (2x1 footprint)
        // 1. Mid-century wooden display shelving unit
        box('wood', 0, 0.44, 0, 0.94, 0.84, 0.84, color || '#78350f');
        box('wood', 0, 0.44, 0, 0.88, 0.04, 0.80, '#92400e');                 // middle shelf
        // 2. Classic dual-dial analog tournament chess clock on top
        box('wood', -0.18, 0.93, 0, 0.42, 0.18, 0.18, '#b45309');             // clock wooden chassis
        // Dual clock faces with red surrender flags
        cylZ('ceramic', -0.28, 0.93, 0.092, 0.13, 0.13, 0.01, '#f8fafc');      // left clock dial
        cylZ('ceramic', -0.08, 0.93, 0.092, 0.13, 0.13, 0.01, '#f8fafc');      // right clock dial
        box('glow', -0.28, 0.98, 0.096, 0.02, 0.04, 0.005, '#ef4444');        // red flag
        // Rocker toggle stop button on top
        box('metal', -0.28, 1.04, 0, 0.08, 0.04, 0.04, '#cbd5e1', true);      // left button down
        box('metal', -0.08, 1.06, 0, 0.08, 0.06, 0.04, '#cbd5e1', true);      // right button up
        // Board game boxes on shelves: Scrabble, Backgammon, Monopoly
        box('fabric', 0.22, 0.92, 0, 0.32, 0.12, 0.30, '#15803d');           // green game box
        box('fabric', -0.20, 0.24, 0, 0.36, 0.16, 0.60, '#1d4ed8');          // blue game box
        box('fabric', 0.20, 0.24, 0, 0.36, 0.16, 0.60, '#b91c1c');           // red game box

      /* ---------------- MUSIC & INSTRUMENTS (7 ITEMS) ---------------- */
      } else if (/^drums$/i.test(t)) {
        // Complete 5-Piece Acoustic Drum Kit (2x2 footprint, bass drum with pedal, snare, 2 rack toms, floor tom, hi-hat, ride & crash cymbals, throne)
        // 1. Large 22-inch Bass Drum at center (true circular shell along Z)
        wheelZ('fabric', 0, 0.36, -0.05, 24.5, 0.44, color || '#991b1b'); // burgundy wrap shell along Z
        wheelZ('ceramic', 0, 0.36, 0.18, 23.0, 0.02, '#f8fafc');          // resonant front head
        wheelZ('metal', 0, 0.36, 0.19, 25.0, 0.03, '#cbd5e1', true);      // chrome hoop
        // 2. 14-inch Snare Drum on chrome basket stand
        cyl('metal', -0.32, 0.28, 0.26, 0.04, 0.54, 0.04, '#cbd5e1', true);  // snare tripod
        cyl('metal', -0.32, 0.54, 0.26, 0.42, 0.18, 0.42, '#cbd5e1', true);   // chrome snare shell
        cyl('fabric', -0.32, 0.64, 0.26, 0.40, 0.01, 0.40, '#f1f5f9');        // coated white batter head
        // 3. Two mounted rack toms (10-inch & 12-inch)
        cyl('fabric', -0.16, 0.74, -0.06, 0.32, 0.24, 0.32, color || '#991b1b');
        cyl('fabric', 0.18, 0.74, -0.06, 0.36, 0.24, 0.36, color || '#991b1b');
        // 4. 16-inch Floor Tom on 3 chrome legs
        for (let l = 0; l < 3; l++) {
          const lang = l * (Math.PI * 2 / 3);
          cyl('metal', 0.34 + Math.cos(lang) * 0.22, 0.22, 0.24 + Math.sin(lang) * 0.22, 0.02, 0.44, 0.02, '#cbd5e1', true);
        }
        cyl('fabric', 0.34, 0.46, 0.24, 0.48, 0.38, 0.48, color || '#991b1b');
        // 5. Cast Bronze Cymbals on chrome boom stands: Hi-Hat, Ride, Crash
        // Hi-Hat stand with foot pedal
        cyl('metal', -0.42, 0.48, 0.08, 0.03, 0.96, 0.03, '#cbd5e1', true);
        cyl('metal', -0.42, 0.82, 0.08, 0.42, 0.025, 0.42, '#f59e0b', true); // bronze hi-hat cymbals
        // Large Ride Cymbal
        cyl('metal', 0.40, 0.54, -0.22, 0.03, 1.08, 0.03, '#cbd5e1', true);
        cyl('metal', 0.40, 0.94, -0.22, 0.54, 0.02, 0.54, '#f59e0b', true);  // 20-inch ride
        // Crash Cymbal
        cyl('metal', -0.32, 0.54, -0.26, 0.03, 1.08, 0.03, '#cbd5e1', true);
        cyl('metal', -0.32, 0.96, -0.26, 0.46, 0.02, 0.46, '#f59e0b', true);
        // 6. Round padded drummer's throne stool
        cyl('metal', 0, 0.24, 0.40, 0.04, 0.46, 0.04, '#cbd5e1', true);
        cyl('dark', 0, 0.48, 0.40, 0.36, 0.08, 0.36, '#181b1e');              // padded vinyl seat

      } else if (/^guitars$/i.test(t)) {
        // Multi-Guitar Stage Stand with Electric Sunburst Stratocaster, Acoustic Dreadnought & Vintage Tweed Tube Amp
        // 1. Black tubular steel folding stage rack
        box('dark', 0, 0.05, 0, 0.84, 0.08, 0.52, '#15171a');
        for (const sx of [-0.36, 0.36]) {
          cyl('metal', sx, 0.44, -0.18, 0.03, 0.84, 0.03, '#1e293b', true);   // uprights
        }
        cyl('metal', 0, 0.74, -0.18, 0.03, 0.72, 0.03, '#1e293b', true);      // neck cradle bar
        // 2. Vintage Sunburst Electric Guitar (Double-cutaway, white pickguard, maple neck, 6 chrome tuning pegs)
        box('wood', -0.18, 0.42, 0.02, 0.28, 0.38, 0.06, color || '#b45309'); // sunburst contour body
        box('ceramic', -0.18, 0.42, 0.055, 0.22, 0.26, 0.01, '#f8fafc');      // white pickguard
        cyl('wood', -0.18, 0.78, 0.02, 0.04, 0.42, 0.025, '#fed7aa');         // maple neck & fretboard
        box('wood', -0.18, 0.98, 0.02, 0.07, 0.12, 0.02, '#fed7aa');          // headstock
        // 3. Natural Sitka Spruce Dreadnought Acoustic Guitar
        box('wood', 0.18, 0.42, 0.02, 0.32, 0.46, 0.12, '#fed7aa');           // blonde spruce top
        cyl('dark', 0.18, 0.48, 0.082, 0.09, 0.01, 0.09, '#181b1e');          // soundhole rosette
        cyl('wood', 0.18, 0.78, 0.02, 0.04, 0.42, 0.03, '#78350f');           // mahogany neck
        // 4. Vintage 1950s Tweed Tube Combo Guitar Amplifier
        box('fabric', 0, 0.26, 0.32, 0.46, 0.48, 0.28, '#fef3c7');            // lacquered tweed cabinet
        box('fabric', 0, 0.26, 0.465, 0.38, 0.34, 0.01, '#78350f');          // brown oxblood grille cloth
        box('metal', 0, 0.46, 0.32, 0.38, 0.04, 0.08, '#c9a44e', true);       // mirror chrome top control chassis

      } else if (/^synth$/i.test(t)) {
        // Professional 61-Key Digital Music Synthesizer / Workstation on Heavy Black Steel X-Stand
        // 1. Tubular black steel folding X-stand with rubber floor sleeves
        box('dark', 0, 0.04, -0.28, 0.62, 0.08, 0.08, '#15171a');             // bottom front bar
        box('dark', 0, 0.04, 0.28, 0.62, 0.08, 0.08, '#15171a');              // bottom rear bar
        for (const sx of [-0.22, 0.22]) {
          cyl('metal', sx, 0.40, 0, 0.04, 0.76, 0.04, '#1e293b', true);       // cross braces
        }
        // Top keyboard support bars
        box('dark', 0, 0.72, -0.26, 0.62, 0.06, 0.06, '#15171a');
        box('dark', 0, 0.72, 0.26, 0.62, 0.06, 0.06, '#15171a');
        // 2. Synthesizer chassis with angled control surface
        box('dark', 0, 0.77, 0, 0.94, 0.08, 0.48, color || '#181b1e');
        box('metal', 0, 0.81, 0, 0.92, 0.02, 0.46, '#1e2124', true);          // brushed aluminum deck
        // 3. 61-Key piano keybed with white keys and black sharps
        box('ceramic', 0, 0.825, 0.12, 0.82, 0.02, 0.18, '#ffffff');           // white keys
        for (let k = 0; k < 18; k++) {
          if (k % 7 !== 2 && k % 7 !== 6) {
            box('dark', -0.38 + k * 0.045, 0.84, 0.09, 0.025, 0.025, 0.11, '#181b1e'); // black key
          }
        }
        // Pitch bend & modulation wheels
        cyl('metal', -0.42, 0.83, 0.12, 0.025, 0.04, 0.04, '#38bdf8', true);
        cyl('metal', -0.42, 0.83, 0.04, 0.025, 0.04, 0.04, '#38bdf8', true);
        // Backlit LCD color waveform display & rotary encoders
        box('glow', 0, 0.825, -0.10, 0.24, 0.01, 0.12, '#38bdf8');            // synthesizer HUD screen
        for (let kn = 0; kn < 8; kn++) {
          cyl('metal', -0.34 + kn * 0.05, 0.83, -0.10, 0.02, 0.02, 0.02, '#cbd5e1', true);
        }

      } else if (/^jukebox$/i.test(t)) {
        // 1950s Wurlitzer-Style Neon Dome Jukebox (Bubble tubes, rainbow arch, revolving 45-RPM record carousel, selector buttons)
        // 1. Curving timber and chrome jukebox carcass
        box('wood', 0, 0.44, 0, 0.88, 0.86, 0.78, color || '#831843');
        box('dark', 0, 0.04, 0, 0.90, 0.08, 0.80, '#15171a');                 // plinth
        // 2. Curving rainbow glowing neon arch around perimeter
        part('cone', 'glow', 0, 0.88, 0.08, 0.86, 0.24, 0.78, '#f43f5e');     // neon dome arch
        cyl('glow', -0.40, 0.52, 0.38, 0.05, 0.78, 0.05, '#38bdf8');          // left bubble tube
        cyl('glow', 0.40, 0.52, 0.38, 0.05, 0.78, 0.05, '#38bdf8');           // right bubble tube
        // 3. Clear glass display window showing revolving vinyl record carousel
        box('glass', 0, 0.68, 0.38, 0.72, 0.42, 0.04, '#d8eef4');
        cyl('metal', 0, 0.68, 0.22, 0.38, 0.32, 0.38, '#1e293b', true);       // record carousel drum
        for (let r = 0; r < 5; r++) {
          cyl('dark', 0, 0.58 + r * 0.05, 0.22, 0.36, 0.015, 0.36, '#111827'); // vinyl records
          cyl('glow', 0, 0.58 + r * 0.05, 0.22, 0.14, 0.016, 0.14, '#ef4444'); // colorful labels
        }
        // 4. Horizontal push-button song selector title strip grid
        box('metal', 0, 0.34, 0.38, 0.74, 0.20, 0.04, '#cbd5e1', true);
        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 8; col++) {
            box('fabric', -0.30 + col * 0.085, 0.38 - row * 0.07, 0.405, 0.065, 0.045, 0.005, '#fef3c7'); // title strips
          }
        }
        // Lower speaker grille with chrome Art Deco horizontal ribs
        box('fabric', 0, 0.16, 0.38, 0.74, 0.14, 0.02, '#b45309');
        for (let g = 0; g < 4; g++) {
          box('metal', 0, 0.12 + g * 0.03, 0.395, 0.74, 0.01, 0.01, '#c9a44e', true);
        }

      } else if (/^ampstack$/i.test(t)) {
        // High-Gain 100W Tube Amplifier Half-Stack on Dual 4x12 Speaker Cabinets
        // 1. Two 4x12 heavy plywood speaker cabinets
        for (const [cy, slant] of [[0.22, 0], [0.58, 0.03]]) {
          box('dark', 0, cy, 0, 0.88, 0.34, 0.68, color || '#181b1e');        // black Tolex covering
          box('fabric', 0, cy, 0.33 - slant, 0.80, 0.28, 0.02, '#374151');    // heavy woven speaker cloth
          // White cabinet perimeter piping & Marshall-style gold cursive script
          box('fabric', 0, cy + 0.16, 0.34 - slant, 0.84, 0.01, 0.01, '#ffffff');
          box('fabric', 0, cy - 0.16, 0.34 - slant, 0.84, 0.01, 0.01, '#ffffff');
          box('metal', 0, cy, 0.345 - slant, 0.26, 0.04, 0.01, '#ffffff', true); // logo badge
          // 8 metal protective corner caps
          for (const sx of [-0.43, 0.43]) for (const sz of [-0.33, 0.33]) {
            box('metal', sx, cy + 0.16, sz, 0.04, 0.04, 0.04, '#cbd5e1', true);
            box('metal', sx, cy - 0.16, sz, 0.04, 0.04, 0.04, '#cbd5e1', true);
          }
        }
        // 2. 100-Watt all-tube amplifier head on top
        box('dark', 0, 0.86, 0, 0.84, 0.20, 0.54, color || '#181b1e');
        box('metal', 0, 0.86, 0.265, 0.76, 0.14, 0.01, '#c9a44e', true);      // gold plexi control faceplate
        // Control knobs (Gain, Bass, Mid, Treble, Presence, Master)
        for (let k = 0; k < 6; k++) {
          cyl('metal', -0.25 + k * 0.10, 0.86, 0.275, 0.03, 0.02, 0.03, '#181b1e', true);
        }
        box('glow', 0.32, 0.86, 0.278, 0.03, 0.03, 0.005, '#ef4444');         // red power pilot jewel light

      } else if (/^micstand$/i.test(t)) {
        // Studio Tripod Boom Microphone Stand with Studio Vocal Mic & Shockmount
        // 1. Heavy tripod floor base
        for (let l = 0; l < 3; l++) {
          const lang = l * (Math.PI * 2 / 3);
          box('metal', Math.cos(lang) * 0.22, 0.03, Math.sin(lang) * 0.22, 0.03, 0.03, 0.42, '#1e293b', true);
        }
        // Vertical chrome clutch mast
        cyl('metal', 0, 0.45, 0, 0.03, 0.88, 0.03, '#cbd5e1', true);
        box('dark', 0, 0.62, 0, 0.06, 0.08, 0.06, '#0f172a');                 // adjustment clutch knob
        // 2. Telescoping boom arm angled forward
        cyl('metal', 0, 0.92, 0.10, 0.022, 0.46, 0.022, '#cbd5e1', true);
        box('dark', 0, 0.90, -0.06, 0.08, 0.08, 0.08, '#1e293b');             // counterweight
        // 3. Spider elastic shockmount & studio dynamic microphone
        cyl('metal', 0, 0.94, 0.28, 0.10, 0.08, 0.10, '#334155', true);       // circular shockmount
        cyl('metal', 0, 0.94, 0.28, 0.05, 0.16, 0.05, '#94a3b8', true);       // condenser microphone body
        cyl('fabric', 0, 0.98, 0.28, 0.055, 0.08, 0.055, '#1e293b');          // black foam pop windscreen
        // Coiled black XLR cable draping down mast
        cyl('dark', 0.02, 0.50, 0.02, 0.015, 0.90, 0.015, '#111827');

      } else if (/^violinstand$/i.test(t)) {
        // Handcrafted Cello / Double Bass on Tubular Cradle Stand with Hanging Bow
        // 1. Black tubular floor cradle stand with cushioned contact pads
        box('dark', 0, 0.04, 0, 0.56, 0.06, 0.46, '#15171a');
        cyl('metal', 0, 0.52, -0.16, 0.03, 0.96, 0.03, '#1e293b', true);       // neck mast
        box('dark', 0, 0.88, -0.10, 0.18, 0.04, 0.12, '#0f172a');             // cushioned neck cradle
        // 2. Beautiful carved maple and spruce cello body with F-holes
        box('wood', 0, 0.38, 0.04, 0.44, 0.58, 0.22, color || '#9a3412');     // rich amber varnish body
        // Cello waist C-bouts
        box('wood', 0, 0.40, 0.04, 0.36, 0.22, 0.20, color || '#9a3412');
        // Dual carved black F-holes
        box('dark', -0.10, 0.40, 0.155, 0.02, 0.16, 0.01, '#181b1e');
        box('dark', 0.10, 0.40, 0.155, 0.02, 0.16, 0.01, '#181b1e');
        // Maple bridge & black ebony fingerboard
        box('wood', 0, 0.38, 0.165, 0.08, 0.04, 0.01, '#fed7aa');             // bridge
        box('dark', 0, 0.62, 0.12, 0.045, 0.44, 0.02, '#181b1e');             // fingerboard
        // Scroll headstock with 4 ebony tuning pegs
        box('wood', 0, 0.88, 0.08, 0.05, 0.14, 0.06, color || '#9a3412');     // pegbox
        for (let p = 0; p < 4; p++) {
          cyl('dark', (p % 2 === 0 ? -0.05 : 0.05), 0.84 + Math.floor(p / 2) * 0.04, 0.08, 0.015, 0.06, 0.015, '#181b1e');
        }
        // 3. Pernambuco horsehair bow hanging on side hook
        cyl('wood', 0.26, 0.54, 0.04, 0.012, 0.72, 0.012, '#78350f');          // bow stick
        cyl('fabric', 0.26, 0.54, 0.06, 0.008, 0.68, 0.008, '#fef3c7');        // white horsehair ribbon

      
      /* ---------------- UTILITY & LAUNDRY (20 ITEMS) ---------------- */
      } else if (/^workbench$/i.test(t)) {
        // Heavy Industrial Workshop Workbench (3x1 footprint, laminated maple butcher block top, steel C-channel legs, heavy machinist vise, bottom shelf)
        // 1. Heavy tubular steel frame legs with cross-bracing
        for (const [lx, lz] of [[-0.45, -0.36], [0.45, -0.36], [-0.45, 0.36], [0.45, 0.36]]) {
          box('metal', lx, 0.38, lz, 0.06, 0.76, 0.06, '#1e293b', true);
          cyl('metal', lx, 0.02, lz, 0.08, 0.04, 0.08, '#cbd5e1', true);
        }
        // Heavy steel bottom shelf
        box('metal', 0, 0.18, 0, 0.92, 0.04, 0.82, '#334155', true);
        // Tool boxes & socket sets on bottom shelf
        box('ceramic', -0.28, 0.28, 0, 0.26, 0.16, 0.44, '#b91c1c');          // red metal toolbox
        box('dark', 0.22, 0.26, 0, 0.34, 0.12, 0.50, '#0f172a');             // black blow-mold case
        // 2. Thick 2-inch laminated solid maple butcher block top
        box('wood', 0, 0.82, 0, 0.98, 0.08, 0.92, color || '#d4a373');
        // 3. Heavy cast-iron machinist bench vise mounted on left corner
        box('metal', -0.42, 0.90, 0.36, 0.12, 0.08, 0.14, '#1e293b', true);  // vise swivel base
        box('metal', -0.42, 0.95, 0.36, 0.10, 0.08, 0.18, '#475569', true);  // fixed jaw
        cyl('metal', -0.42, 0.92, 0.48, 0.015, 0.18, 0.015, '#cbd5e1', true); // lead screw T-handle
        // Screwdrivers & hammer lying on bench
        box('metal', 0.18, 0.88, -0.10, 0.04, 0.03, 0.32, '#cbd5e1', true);   // steel ruler
        cyl('wood', 0.34, 0.88, 0.10, 0.025, 0.28, 0.025, '#fed7aa');         // hammer handle
        box('metal', 0.34, 0.89, -0.04, 0.08, 0.05, 0.05, '#334155', true);   // hammer head

      } else if (/^shelfunit$/i.test(t)) {
        // Heavy-Duty 5-Tier Industrial Wire / Rivet Steel Storage Rack (2x1 footprint, storage totes & paint cans)
        // 1. 4 heavy slotted steel upright angle posts
        for (const [lx, lz] of [[-0.45, -0.40], [0.45, -0.40], [-0.45, 0.40], [0.45, 0.40]]) {
          box('metal', lx, 0.50, lz, 0.045, 0.98, 0.045, color || '#475569', true);
        }
        // 2. 5 Heavy steel wire-mesh / wood deck shelves
        for (let s = 0; s < 5; s++) {
          const sy = 0.08 + s * 0.22;
          box('metal', 0, sy, 0, 0.94, 0.03, 0.84, '#64748b', true);
          // Items on shelves
          if (s === 0) {
            box('ceramic', -0.22, sy + 0.10, 0, 0.34, 0.16, 0.64, '#3b82f6'); // blue storage tote
            box('ceramic', 0.22, sy + 0.10, 0, 0.34, 0.16, 0.64, '#10b981');  // green storage tote
          } else if (s === 1) {
            box('fabric', 0, sy + 0.09, 0, 0.82, 0.15, 0.74, '#d97706');      // cardboard moving box
          } else if (s === 2) {
            for (let p = 0; p < 4; p++) {
              cyl('metal', -0.30 + p * 0.20, sy + 0.09, 0, 0.12, 0.15, 0.12, '#cbd5e1', true); // paint cans
            }
          }
        }

      } else if (/^bicycle$/i.test(t)) {
        // High-End Commuter Road Bicycle (1x2 footprint, hydroformed alloy diamond frame, 700c spoked wheels, drop/flat bars, chain drive, kickstand)
        const frameCol = color || '#2563eb';
        // 1. Front and Rear 700c Wheels (true circular tires/rims/hubs)
        wheelX('dark', 0, 0.32, -0.38, 0.038, 19.8, '#181b1e');           // rubber tire
        wheelX('metal', 0, 0.32, -0.38, 0.028, 17.3, '#cbd5e1');          // aluminum rim
        wheelX('metal', 0, 0.32, -0.38, 0.065, 2.6, '#94a3b8');           // center front hub
        wheelX('dark', 0, 0.32, 0.38, 0.038, 19.8, '#181b1e');            // rubber tire
        wheelX('metal', 0, 0.32, 0.38, 0.028, 17.3, '#cbd5e1');           // aluminum rim
        wheelX('metal', 0, 0.32, 0.38, 0.075, 2.9, '#94a3b8');            // center rear hub & cassette
        // 2. Rigid Front Fork connecting front wheel axle to head tube
        for (const sx of [-0.035, 0.035]) {
          boxSlope('metal', sx, 0.32, -0.38, 0, 0.58, -0.28, 0.03, 0.03, frameCol); // fork blade
        }
        // Head tube
        cyl('metal', 0, 0.65, -0.28, 0.042, 0.16, 0.042, frameCol);
        // 3. Fully Connected Diamond Frame
        // Bottom Bracket Shell (y=0.28, z=0.06)
        cylX('metal', 0, 0.28, 0.06, 0.09, 0.05, 0.05, '#334155');
        // Seat Tube: from bottom bracket (0, 0.28, 0.06) to seat cluster (0, 0.68, 0.12)
        boxSlope('metal', 0, 0.28, 0.06, 0, 0.68, 0.12, 0.036, 0.036, frameCol);
        // Top Tube: from seat cluster (0, 0.68, 0.12) to head tube (0, 0.70, -0.28)
        boxSlope('metal', 0, 0.68, 0.12, 0, 0.70, -0.28, 0.036, 0.036, frameCol);
        // Down Tube: from bottom bracket (0, 0.28, 0.06) to head tube (0, 0.60, -0.28)
        boxSlope('metal', 0, 0.28, 0.06, 0, 0.60, -0.28, 0.038, 0.038, frameCol);
        // Chain Stays: dual stays from bottom bracket (0, 0.28, 0.06) to rear axle (0, 0.32, 0.38)
        for (const sx of [-0.035, 0.035]) {
          boxSlope('metal', sx * 0.5, 0.28, 0.06, sx, 0.32, 0.38, 0.024, 0.024, frameCol);
          // Seat Stays: dual stays from seat cluster (0, 0.68, 0.12) down to rear axle (sx, 0.32, 0.38)
          boxSlope('metal', 0, 0.68, 0.12, sx, 0.32, 0.38, 0.022, 0.022, frameCol);
        }
        // 4. Handlebars & Controls
        // Threadless stem clamped to steerer tube
        boxSlope('metal', 0, 0.72, -0.28, 0, 0.76, -0.24, 0.03, 0.03, '#1e293b');
        // Horizontal handlebar spanning across X
        cylX('metal', 0, 0.76, -0.24, 0.44, 0.024, 0.024, '#1e293b');
        // Ergonomic rubber grips on bar ends
        box('dark', -0.19, 0.76, -0.24, 0.06, 0.036, 0.036, '#0f172a');
        box('dark', 0.19, 0.76, -0.24, 0.06, 0.036, 0.036, '#0f172a');
        // Aluminum brake levers
        box('metal', -0.12, 0.74, -0.21, 0.015, 0.015, 0.06, '#cbd5e1');
        box('metal', 0.12, 0.74, -0.21, 0.015, 0.015, 0.06, '#cbd5e1');
        // 5. Saddle on Alloy Seatpost
        cyl('metal', 0, 0.73, 0.125, 0.025, 0.12, 0.025, '#94a3b8');          // seatpost
        box('dark', 0, 0.79, 0.11, 0.14, 0.04, 0.26, '#181b1e');               // contoured saddle
        box('dark', 0, 0.775, 0.02, 0.06, 0.03, 0.10, '#181b1e');              // saddle nose
        // 6. Drivetrain: Chainring, Cranks, Pedals & Leaning Kickstand
        wheelX('metal', 0.04, 0.28, 0.06, 0.015, 4.8, '#64748b');         // large front chainring
        // Left & right crank arms and pedals
        boxSlope('metal', 0.05, 0.28, 0.06, 0.05, 0.18, 0.12, 0.02, 0.03, '#cbd5e1');
        box('dark', 0.08, 0.18, 0.12, 0.06, 0.02, 0.07, '#181b1e');            // right pedal
        boxSlope('metal', -0.05, 0.28, 0.06, -0.05, 0.38, 0.00, 0.02, 0.03, '#cbd5e1');
        box('dark', -0.08, 0.38, 0.00, 0.06, 0.02, 0.07, '#181b1e');           // left pedal
        // Black steel kickstand resting securely on ground
        boxSlope('dark', -0.02, 0.28, 0.08, -0.12, 0.01, 0.18, 0.02, 0.02, '#181b1e');

      } else if (/^ironboard$/i.test(t)) {
        // Folding Steel Ironing Board with Steam Iron on Silicone Rest Tray (1x2 footprint)
        // 1. Tubular steel X-frame folding legs
        cyl('metal', -0.16, 0.43, 0, 0.03, 0.84, 0.03, '#cbd5e1', true);
        cyl('metal', 0.16, 0.43, 0, 0.03, 0.84, 0.03, '#cbd5e1', true);
        box('dark', 0, 0.02, -0.34, 0.42, 0.04, 0.06, '#181b1e');             // floor rubber feet
        box('dark', 0, 0.02, 0.34, 0.42, 0.04, 0.06, '#181b1e');
        // 2. Tapered ironing board top with patterned heat-proof cover
        box('fabric', 0, 0.78, 0, 0.44, 0.05, 0.90, color || '#bae6fd');
        // Tapered nose on front
        box('fabric', 0, 0.78, -0.42, 0.30, 0.05, 0.16, color || '#bae6fd');
        // 3. Heavy silicone / wire iron resting tray at rear
        box('metal', 0, 0.79, 0.38, 0.36, 0.03, 0.20, '#64748b', true);
        // Modern ergonomic steam iron with water tank
        box('ceramic', 0, 0.86, 0.36, 0.14, 0.12, 0.22, '#f8fafc');           // iron body
        box('glass', 0, 0.86, 0.34, 0.12, 0.08, 0.14, '#38bdf8');             // blue water tank
        box('dark', 0, 0.94, 0.36, 0.06, 0.05, 0.20, '#181b1e');              // top handle

      } else if (/^dryrack$/i.test(t)) {
        // Folding Accordion Laundry Drying Rack with Hanging Garments (2x1 footprint)
        // 1. Lightweight birch / aluminum folding scissor frame
        for (const sx of [-0.42, 0.42]) {
          box('wood', sx, 0.04, 0, 0.03, 0.06, 0.76, '#fed7aa');
          cyl('metal', sx, 0.46, -0.28, 0.02, 0.88, 0.02, '#cbd5e1', true);   // scissor strut 1
          cyl('metal', sx, 0.46, 0.28, 0.02, 0.88, 0.02, '#cbd5e1', true);    // scissor strut 2
        }
        // 2. 8 Horizontal drying rungs spanning across
        for (let r = 0; r < 6; r++) {
          const ry = 0.30 + r * 0.12, rz = -0.25 + (r % 3) * 0.25;
          cylX('metal', 0, ry, rz, 0.86, 0.015, 0.015, '#cbd5e1', true);
        }
        // Colorful laundry towels & socks hanging on rungs
        box('fabric', -0.18, 0.42, -0.12, 0.26, 0.26, 0.02, color || '#38bdf8');
        box('fabric', 0.18, 0.48, 0.12, 0.26, 0.30, 0.02, '#f472b6');

      } else if (/^utilsink$/i.test(t)) {
        // Heavy-Duty Thermoplastic Deep Utility Laundry Sink with Chrome Gooseneck Faucet & Stainless Legs
        // 1. Tubular stainless steel legs with leveling feet
        for (const [lx, lz] of [[-0.42, -0.38], [0.42, -0.38], [-0.42, 0.38], [0.42, 0.38]]) {
          cyl('metal', lx, 0.26, lz, 0.045, 0.52, 0.045, '#cbd5e1', true);
          cyl('metal', lx, 0.02, lz, 0.07, 0.04, 0.07, '#cbd5e1', true);
        }
        // Lower bracing shelf
        box('metal', 0, 0.14, 0, 0.86, 0.03, 0.78, '#94a3b8', true);
        // 2. Deep white thermoplastic laundry tub basin
        box('ceramic', 0, 0.68, 0, 0.94, 0.44, 0.88, color || '#ffffff');     // outer basin
        box('dark', 0, 0.72, 0, 0.82, 0.36, 0.76, '#e2e8f0');                 // deep cavity
        // Molded washboard scrubbing ridges on front interior wall
        for (let w = 0; w < 4; w++) {
          box('ceramic', 0, 0.64 + w * 0.05, 0.36, 0.72, 0.02, 0.02, '#cbd5e1');
        }
        // Stainless steel drain strainer with rubber plug
        cyl('metal', 0, 0.54, 0, 0.10, 0.01, 0.10, '#cbd5e1', true);
        // 3. Tall gooseneck chrome swivel faucet with pull-down spray head
        cyl('metal', 0, 0.96, -0.36, 0.03, 0.24, 0.03, '#cbd5e1', true);
        cyl('metal', 0, 1.06, -0.26, 0.025, 0.18, 0.025, '#cbd5e1', true);    // spout curve
        box('metal', -0.10, 0.92, -0.36, 0.03, 0.08, 0.03, '#cbd5e1', true);  // hot lever
        box('metal', 0.10, 0.92, -0.36, 0.03, 0.08, 0.03, '#cbd5e1', true);   // cold lever

      } else if (/^vacuum$/i.test(t)) {
        // Modern Upright Cyclonic Bagless Vacuum Cleaner (Clear dust canister, LED motorized brush head, ergonomic D-handle)
        // 1. Motorized low-profile floor brush power nozzle with LED headlight
        box('dark', 0, 0.06, 0.14, 0.74, 0.10, 0.46, '#1e2124');
        box('glow', 0, 0.06, 0.365, 0.48, 0.04, 0.01, '#ffffff');             // LED headlights
        cyl('dark', -0.34, 0.06, -0.06, 0.12, 0.04, 0.12, '#0f172a');         // rear rubber wheels
        cyl('dark', 0.34, 0.06, -0.06, 0.12, 0.04, 0.12, '#0f172a');
        // 2. Sleek upright chassis in accent color
        cyl('ceramic', 0, 0.42, 0, 0.32, 0.56, 0.32, color || '#ef4444');
        // Transparent multi-cyclone dust cup canister
        cyl('glass', 0, 0.46, 0.04, 0.28, 0.34, 0.28, '#38bdf8');
        cyl('ceramic', 0, 0.46, 0.04, 0.14, 0.28, 0.14, color || '#ef4444');  // inner vortex cone
        // 3. Ergonomic upright aluminum handle wand with D-grip
        cyl('metal', 0, 0.78, -0.06, 0.04, 0.44, 0.04, '#cbd5e1', true);
        box('dark', 0, 0.96, -0.06, 0.18, 0.12, 0.06, '#181b1e');             // D-shaped hand grip
        // Coiled black flex hose on rear
        cyl('dark', 0.14, 0.48, -0.12, 0.045, 0.58, 0.045, '#111827');

      } else if (/^freezer$/i.test(t)) {
        // Commercial Garage Deep Chest Freezer (2x1 footprint, counterbalanced lid with recessed handle & key lock, wire baskets)
        // 1. Heavy white insulated metal cabinet chassis
        box('ceramic', 0, 0.48, 0, 0.94, 0.84, 0.88, color || '#f8fafc');
        box('dark', 0, 0.04, 0, 0.96, 0.08, 0.90, '#15171a');                 // bottom toe kick
        // 2. Thick counterbalanced top lift lid
        box('ceramic', 0, 0.92, 0, 0.98, 0.08, 0.92, '#ffffff');
        box('dark', 0, 0.92, 0.465, 0.24, 0.03, 0.02, '#181b1e');             // recessed handle
        cyl('metal', 0.32, 0.92, 0.465, 0.02, 0.015, 0.02, '#cbd5e1', true);   // safety cylinder lock
        // Front LED status light & mechanical thermostat dial
        box('glow', -0.38, 0.16, 0.445, 0.03, 0.03, 0.01, '#22c55e');         // green power LED
        cyl('metal', -0.32, 0.16, 0.445, 0.04, 0.02, 0.04, '#64748b', true);  // temperature dial

      } else if (/^waterheater$/i.test(t)) {
        // High-Efficiency Tall Residential Tank Water Heater (T&P relief valve, discharge pipe, dielectric nipples)
        // 1. Tall cylindrical insulated tank body
        cyl('ceramic', 0, 0.50, 0, 0.72, 0.94, 0.72, color || '#f8fafc');
        cyl('dark', 0, 0.03, 0, 0.74, 0.06, 0.74, '#15171a');                 // bottom support ring
        // 2. Top cold and hot plumbing dielectric nipples
        cyl('metal', -0.18, 0.99, 0, 0.04, 0.08, 0.04, '#3b82f6', true);      // blue cold inlet
        cyl('metal', 0.18, 0.99, 0, 0.04, 0.08, 0.04, '#ef4444', true);       // red hot outlet
        // 3. Brass Temperature & Pressure (T&P) safety relief valve with copper discharge pipe
        box('metal', 0.36, 0.82, 0, 0.08, 0.06, 0.06, '#c9a44e', true);       // brass valve
        cyl('metal', 0.40, 0.42, 0, 0.025, 0.80, 0.025, '#c9a44e', true);     // copper tube to floor
        // Thermostat electrical access cover plates on front
        box('metal', 0, 0.70, 0.365, 0.18, 0.22, 0.01, '#e2e8f0', true);
        box('metal', 0, 0.32, 0.365, 0.18, 0.22, 0.01, '#e2e8f0', true);

      } else if (/^sewing$/i.test(t)) {
        // Electronic Computerized Sewing Machine with Dedicated Sewing Desk (2x1 footprint)
        // 1. Sewing table with birch legs & dual thread drawers
        for (const [lx, lz] of [[-0.44, -0.38], [0.44, -0.38], [-0.44, 0.38], [0.44, 0.38]]) {
          cyl('wood', lx, 0.34, lz, 0.04, 0.68, 0.04, '#fed7aa');
        }
        box('wood', 0, 0.68, 0, 0.94, 0.04, 0.86, '#fde68a');                 // tabletop
        box('wood', -0.30, 0.58, 0, 0.28, 0.16, 0.80, '#fed7aa');              // drawer unit
        box('metal', -0.30, 0.58, 0.41, 0.12, 0.02, 0.02, '#c9a44e', true);
        // Foot pedal underneath on floor
        box('dark', 0.18, 0.04, 0.05, 0.18, 0.06, 0.24, '#1e293b');
        // 2. High-precision computerized sewing machine
        box('ceramic', 0.12, 0.77, 0, 0.58, 0.14, 0.38, '#ffffff');            // machine base
        box('ceramic', 0.32, 0.88, 0, 0.18, 0.26, 0.32, color || '#ffffff');   // upright column
        box('ceramic', 0.14, 0.98, 0, 0.48, 0.10, 0.28, color || '#ffffff');   // top arm
        // Needle assembly & presser foot
        cyl('metal', -0.06, 0.84, 0, 0.015, 0.12, 0.015, '#cbd5e1', true);
        box('metal', -0.06, 0.78, 0, 0.04, 0.01, 0.06, '#cbd5e1', true);      // presser foot
        cyl('metal', 0.39, 0.96, 0, 0.12, 0.02, 0.12, '#cbd5e1', true);       // handwheel
        box('glow', 0.24, 0.90, 0.142, 0.08, 0.06, 0.005, '#38bdf8');         // stitch selection LCD

      } else if (/^printer3d$/i.test(t)) {
        // Desktop Enclosed CoreXY 3D Printer (Aluminum extrusion cage, heated glass build plate, printhead, filament spool)
        // 1. Black anodized aluminum extrusion cage
        for (const [lx, lz] of [[-0.42, -0.40], [0.42, -0.40], [-0.42, 0.40], [0.42, 0.40]]) {
          box('metal', lx, 0.48, lz, 0.045, 0.92, 0.045, '#1e293b', true);
        }
        box('metal', 0, 0.06, 0, 0.90, 0.08, 0.86, '#0f172a', true);          // base electronics enclosure
        box('metal', 0, 0.94, 0, 0.90, 0.04, 0.86, '#0f172a', true);          // top gantry frame
        // 2. Heated glass build plate & dual lead screws
        box('glass', 0, 0.38, 0, 0.74, 0.02, 0.70, '#38bdf8');                 // heated bed
        cyl('metal', -0.36, 0.50, -0.32, 0.02, 0.80, 0.02, '#c9a44e', true);  // brass lead screw
        cyl('metal', 0.36, 0.50, -0.32, 0.02, 0.80, 0.02, '#c9a44e', true);
        // 3. Direct-drive extruder printhead assembly on X-gantry
        box('ceramic', 0, 0.62, 0, 0.18, 0.16, 0.18, color || '#ef4444');
        cyl('glow', 0, 0.53, 0, 0.03, 0.03, 0.03, '#f59e0b');                 // heated brass nozzle
        // Colorful 1kg spool of PLA filament mounted on side arm
        cyl('fabric', 0.48, 0.68, 0, 0.28, 0.09, 0.28, '#10b981');            // green PLA spool
        cyl('metal', 0.48, 0.68, 0, 0.10, 0.10, 0.10, '#0f172a', true);
        // Front touch control screen
        box('glow', 0.26, 0.06, 0.435, 0.20, 0.08, 0.01, '#38bdf8');

      } else if (/^acwall$/i.test(t)) {
        // Modern Inverter Split Wall Air Conditioner (2x1 footprint, motorized louvers, LED display)
        box('ceramic', 0, 0.50, 0, 0.96, 0.88, 0.74, color || '#ffffff');
        box('dark', 0, 0.18, 0.34, 0.92, 0.08, 0.08, '#1e293b');
        box('glow', 0.36, 0.62, 0.375, 0.10, 0.06, 0.005, '#38bdf8');
        box('metal', -0.38, 0.70, 0.375, 0.08, 0.015, 0.005, '#c5ccd2', true);

      } else if (/^acportable$/i.test(t)) {
        // Sleek Upright Portable Air Conditioner on Casters with Digital Soft-Touch Panel
        // 1. Sleek rounded white body on caster wheels
        cyl('ceramic', 0, 0.50, 0, 0.78, 0.88, 0.78, color || '#ffffff');
        box('dark', 0, 0.04, 0, 0.64, 0.06, 0.64, '#15171a');
        // 2. Top motorized oscillating air discharge vent
        box('dark', 0, 0.92, 0.08, 0.58, 0.04, 0.28, '#1e293b');
        box('glow', 0, 0.942, -0.22, 0.22, 0.005, 0.12, '#38bdf8');           // digital touch display
        // Side air intake louvers
        for (let l = 0; l < 6; l++) {
          box('dark', -0.38, 0.35 + l * 0.06, 0, 0.01, 0.02, 0.44, '#94a3b8');
        }

      } else if (/^actower$/i.test(t)) {
        // Bladeless Oscillating Cooling Tower Fan (1x2 footprint, slim columnar body, stable round base)
        cyl('dark', 0, 0.04, 0, 0.84, 0.08, 0.84, '#15171a');                 // wide circular floor base
        cyl('ceramic', 0, 0.54, 0, 0.42, 0.92, 0.42, color || '#f8fafc');     // tall columnar chassis
        // Vertical continuous airflow discharge grille
        box('dark', 0, 0.54, 0.20, 0.16, 0.78, 0.02, '#181b1e');
        box('glow', 0, 0.96, 0.12, 0.14, 0.04, 0.04, '#38bdf8');              // blue LED top controls

      } else if (/^acceiling$/i.test(t)) {
        // Commercial 4-Way Ceiling Cassette AC Unit (2x2 footprint, 4 directional louvers, center intake)
        box('ceramic', 0, 0.50, 0, 0.96, 0.22, 0.96, color || '#ffffff');     // flush ceiling panel
        box('dark', 0, 0.50, 0, 0.54, 0.04, 0.54, '#334155');                 // center square return grille
        // 4 motorized directional air louvers around perimeter
        box('ceramic', 0, 0.48, -0.38, 0.72, 0.03, 0.08, '#e2e8f0');
        box('ceramic', 0, 0.48, 0.38, 0.72, 0.03, 0.08, '#e2e8f0');
        box('ceramic', -0.38, 0.48, 0, 0.08, 0.03, 0.72, '#e2e8f0');
        box('ceramic', 0.38, 0.48, 0, 0.08, 0.03, 0.72, '#e2e8f0');
        box('glow', 0.42, 0.48, 0.42, 0.03, 0.03, 0.03, '#22c55e');           // green status LED

      } else if (/^acwindow$/i.test(t)) {
        // Compact Window Air Conditioner with Accordion Expansion Panels
        box('ceramic', 0, 0.48, 0, 0.74, 0.88, 0.82, color || '#ffffff');     // main AC box
        // Accordion vinyl side expansion panels
        box('fabric', -0.42, 0.48, 0, 0.16, 0.78, 0.08, '#cbd5e1');
        box('fabric', 0.42, 0.48, 0, 0.16, 0.78, 0.08, '#cbd5e1');
        // Front louvers & digital controls
        box('dark', -0.10, 0.54, 0.415, 0.46, 0.64, 0.02, '#1e293b');         // exhaust grille
        box('glow', 0.24, 0.74, 0.418, 0.12, 0.08, 0.005, '#38bdf8');        // 70°F display

      } else if (/^laundrybasket$/i.test(t)) {
        // Woven Natural Wicker Laundry Hamper Basket Overflowing with Folded Clothes (Zero z-fighting)
        cyl('wood', 0, 0.37, 0, 0.78, 0.74, 0.78, color || '#d4a373');
        cyl('fabric', 0, 0.77, 0, 0.82, 0.06, 0.82, '#f8fafc');
        cyl('dark', 0, 0.72, 0, 0.70, 0.03, 0.70, '#475569');
        round('fabric', -0.14, 0.82, -0.08, 0.28, 0.16, 0.26, '#38bdf8');
        round('fabric', 0.15, 0.83, 0.06, 0.30, 0.17, 0.28, '#f472b6');
        round('fabric', 0, 0.85, -0.14, 0.24, 0.15, 0.24, '#fde68a');

      } else if (/^mopbucket$/i.test(t)) {
        // Commercial Janitorial Mop Bucket with Down-Press Wringer & Cotton String Mop
        // 1. Heavy polyethylene bucket on 4 caster wheels
        box('ceramic', 0, 0.36, -0.06, 0.72, 0.54, 0.64, color || '#0284c7');
        for (const [cx, cz] of [[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.22], [0.32, 0.22]]) {
          cyl('dark', cx, 0.04, cz, 0.08, 0.06, 0.08, '#181b1e');             // casters
        }
        // Down-press wringer mechanism & long lever handle
        box('dark', 0, 0.68, 0.18, 0.54, 0.32, 0.38, '#1e293b');
        cyl('metal', 0.28, 0.88, 0.28, 0.03, 0.42, 0.03, '#cbd5e1', true);    // wringer handle
        round('ceramic', 0.28, 1.08, 0.28, 0.06, 0.06, 0.06, '#ef4444');      // red grip knob
        // 2. Cotton string mop resting in bucket
        cyl('metal', -0.18, 0.74, -0.06, 0.025, 0.88, 0.025, '#cbd5e1', true); // mop handle
        cyl('fabric', -0.18, 0.42, -0.06, 0.22, 0.24, 0.22, '#f8fafc');       // white cotton mop head

      } else if (/^stepstool$/i.test(t)) {
        // Folding 2-Step Household Safety Ladder Stool with Anti-Slip Treads
        // 1. Splayed tubular steel / solid birch frame
        box('wood', -0.28, 0.42, 0, 0.05, 0.84, 0.72, color || '#b45309');
        box('wood', 0.28, 0.42, 0, 0.05, 0.84, 0.72, color || '#b45309');
        // 2. Wide ribbed anti-slip steps
        box('dark', 0, 0.34, 0.12, 0.54, 0.05, 0.32, '#181b1e');              // bottom step
        box('dark', 0, 0.68, -0.08, 0.54, 0.05, 0.34, '#181b1e');             // top step platform
        // Top safety handrail arch
        cyl('metal', 0, 0.88, -0.24, 0.03, 0.52, 0.03, '#cbd5e1', true);

      } else if (/^litterbox$/i.test(t)) {
        // Enclosed Hooded Cat Litter Box with Swing Door & Carbon Odor Filter
        // 1. Bottom high-sided pan with clumping litter
        box('ceramic', 0, 0.22, 0, 0.86, 0.38, 0.86, color || '#64748b');
        box('stone', 0, 0.22, 0, 0.76, 0.12, 0.76, '#cbd5e1');                // grey clay litter bed
        // 2. Removable top dome hood with carrying handle
        box('ceramic', 0, 0.62, 0, 0.84, 0.46, 0.84, '#f8fafc');
        box('dark', 0, 0.88, 0, 0.22, 0.06, 0.06, '#181b1e');                 // top carry handle
        // Translucent swing flap door on front
        box('glass', 0, 0.50, 0.425, 0.34, 0.34, 0.02, '#38bdf8');
        // Litter scoop hanging on side hook
        box('metal', 0.43, 0.46, 0, 0.02, 0.26, 0.12, '#94a3b8', true);

      /* ---------------- GARAGE & VEHICLES (16 ITEMS) ---------------- */
      } else if (/^motorcycle$/i.test(t)) {
        // Modern Naked Cafe Racer Motorcycle (Trellis frame, sculpted gas tank, V-twin engine, spoked wheels, clip-on bars, LED headlight, swingarm & kickstand)
        const motoCol = color || '#ef4444';
        // 1. Front and Rear High-Performance Wheels (true circular wheels & rotor)
        wheelX('dark', 0, 0.26, -0.26, 0.11, 16.4, '#181b1e');            // front tire
        wheelX('metal', 0, 0.26, -0.26, 0.06, 12.2, '#cbd5e1');           // aluminum rim & rotor
        wheelX('metal', 0, 0.26, -0.26, 0.14, 2.8, '#334155');            // front axle hub
        wheelX('dark', 0, 0.26, 0.26, 0.14, 16.4, '#181b1e');             // rear fat tire
        wheelX('metal', 0, 0.26, 0.26, 0.08, 12.2, '#cbd5e1');            // rear rim & sprocket
        wheelX('metal', 0, 0.26, 0.26, 0.16, 3.1, '#334155');             // rear axle hub
        // 2. Inverted Front Suspension Fork connecting wheel axle to triple clamps
        for (const sx of [-0.07, 0.07]) {
          boxSlope('metal', sx, 0.26, -0.26, sx, 0.58, -0.16, 0.034, 0.034, '#c9a44e'); // gold stanchion
        }
        box('metal', 0, 0.58, -0.16, 0.18, 0.03, 0.06, '#1e293b');             // lower triple clamp
        box('metal', 0, 0.64, -0.16, 0.18, 0.03, 0.06, '#1e293b');             // upper triple clamp
        // 3. Structural Tubular Steel Trellis Frame & Rear Swingarm
        // Twin-tube aluminum rear swingarm connecting transmission to rear axle
        for (const sx of [-0.08, 0.08]) {
          boxSlope('metal', sx * 0.7, 0.26, 0.06, sx, 0.26, 0.26, 0.032, 0.045, '#64748b'); // swingarm
        }
        // Central mono-shock absorber
        boxSlope('metal', 0, 0.28, 0.12, 0, 0.44, 0.06, 0.04, 0.04, '#eab308'); // yellow spring
        // Trellis frame tubes linking steering head to engine
        for (const sx of [-0.09, 0.09]) {
          boxSlope('metal', 0, 0.60, -0.16, sx, 0.42, -0.04, 0.026, 0.026, '#334155');
          boxSlope('metal', sx, 0.42, -0.04, sx, 0.28, 0.06, 0.026, 0.026, '#334155');
        }
        // 4. Exposed V-Twin Engine Block, Cooling Fins & Chrome Exhaust
        box('metal', 0, 0.33, 0.01, 0.24, 0.26, 0.28, '#1e293b');              // engine crankcase
        box('metal', 0, 0.38, -0.05, 0.20, 0.14, 0.14, '#475569');             // front cylinder head
        box('metal', 0, 0.38, 0.07, 0.20, 0.14, 0.14, '#475569');              // rear cylinder head
        // Chrome exhaust header pipe sweeping into upswept megaphone muffler
        boxSlope('metal', 0.12, 0.32, -0.04, 0.13, 0.22, 0.10, 0.035, 0.035, '#cbd5e1');
        boxSlope('metal', 0.13, 0.22, 0.10, 0.13, 0.32, 0.28, 0.045, 0.045, '#cbd5e1'); // muffler
        // 5. Sculpted Aerodynamic Fuel Tank, Stitched Saddle & Cafe Racer Cowl
        box('ceramic', 0, 0.54, -0.06, 0.28, 0.19, 0.30, motoCol);              // gas tank
        round('ceramic', 0, 0.57, -0.06, 0.26, 0.14, 0.28, HP.shade(motoCol, 1.08)); // tank hump
        cyl('metal', 0, 0.645, -0.06, 0.06, 0.02, 0.06, '#cbd5e1');             // chrome filler cap
        box('dark', 0, 0.50, 0.13, 0.22, 0.07, 0.20, '#181b1e');                // leather saddle
        box('ceramic', 0, 0.54, 0.26, 0.20, 0.13, 0.16, motoCol);               // cafe tail cowl
        box('glow', 0, 0.53, 0.345, 0.08, 0.03, 0.01, '#ef4444');               // LED taillight
        // 6. Handlebars, Headlight & Leaning Kickstand
        cylX('metal', 0, 0.64, -0.15, 0.36, 0.026, 0.026, '#1e293b');           // clip-on handlebars
        box('dark', -0.17, 0.64, -0.15, 0.05, 0.034, 0.034, '#0f172a');         // left grip
        box('dark', 0.17, 0.64, -0.15, 0.05, 0.034, 0.034, '#0f172a');          // right grip
        wheelZ('metal', 0, 0.54, -0.28, 4.4, 0.06, '#0f172a');            // 7" round headlight
        wheelZ('glow', 0, 0.54, -0.312, 3.8, 0.01, '#fef08a');            // LED projector lens
        // Leaning steel kickstand down to floor
        boxSlope('dark', -0.05, 0.24, 0.04, -0.13, 0.01, 0.08, 0.025, 0.025, '#181b1e');

      } else if (/^toolchest$/i.test(t)) {
        // Heavy-Duty Professional 6-Drawer Rolling Mechanic Tool Chest with Lift-Up Top Chest
        // 1. Heavy red/blue powder-coated steel cabinet chassis on casters
        box('ceramic', 0, 0.42, 0, 0.92, 0.72, 0.86, color || '#dc2626');
        for (const [cx, cz] of [[-0.42, -0.38], [0.42, -0.38], [-0.42, 0.38], [0.42, 0.38]]) {
          cyl('dark', cx, 0.04, cz, 0.08, 0.06, 0.08, '#181b1e');             // heavy casters
        }
        // 6 Full-width ball-bearing drawers with aluminum handles
        for (let d = 0; d < 6; d++) {
          const dy = 0.16 + d * 0.10;
          box('metal', 0, dy, 0.435, 0.84, 0.02, 0.02, '#cbd5e1', true);      // brushed aluminum drawer pull
          box('dark', 0, dy, 0.43, 0.86, 0.08, 0.01, '#991b1b');
        }
        // 2. Top chest unit with lift-up lid & side carry handles
        box('ceramic', 0, 0.86, 0, 0.90, 0.22, 0.84, color || '#dc2626');
        box('metal', -0.455, 0.86, 0, 0.02, 0.06, 0.14, '#cbd5e1', true);     // left handle
        box('metal', 0.455, 0.86, 0, 0.02, 0.06, 0.14, '#cbd5e1', true);      // right handle

      } else if (/^tires$/i.test(t)) {
        // Stack of 3 High-Performance Radial Car Tires with Alloy Wheels
        for (let t = 0; t < 3; t++) {
          const ty = 0.14 + t * 0.26;
          cyl('dark', 0, ty, 0, 0.88, 0.24, 0.88, color || '#1c1917');         // black rubber tread
          cyl('metal', 0, ty, 0, 0.54, 0.25, 0.54, '#cbd5e1');           // silver 5-spoke alloy rim
          // 5 chrome lug nuts on wheel hub
          for (let l = 0; l < 5; l++) {
            const lang = l * (Math.PI * 2 / 5);
            cyl('metal', Math.cos(lang) * 0.10, ty + 0.126, Math.sin(lang) * 0.10, 0.02, 0.02, 0.02, '#ffffff');
          }
        }

      } else if (/^pegboard$/i.test(t)) {
        // Heavy Wall-Mounted Workshop Pegboard Tool Wall with Hanging Wrenches, Hammers, Drills (2x1 footprint)
        // 1. Galvanized perforated metal pegboard panel
        box('metal', 0, 0.50, -0.42, 0.96, 0.94, 0.04, color || '#cbd5e1', true);
        box('dark', 0, 0.50, -0.435, 0.98, 0.96, 0.02, '#1e293b');            // dark border frame
        // 2. Array of hanging workshop tools on metal hooks
        // Claw hammer
        cyl('wood', -0.32, 0.52, -0.38, 0.03, 0.38, 0.03, '#fed7aa');
        box('metal', -0.32, 0.70, -0.38, 0.12, 0.06, 0.06, '#334155', true);
        // Cordless power drill in steel holster
        box('ceramic', 0, 0.62, -0.36, 0.14, 0.22, 0.18, '#3b82f6');
        cyl('metal', 0, 0.62, -0.24, 0.02, 0.14, 0.02, '#cbd5e1', true);      // drill chuck
        // Set of 4 combination wrenches in ascending size
        for (let w = 0; w < 4; w++) {
          box('metal', 0.20 + w * 0.07, 0.54, -0.39, 0.025, 0.20 + w * 0.05, 0.015, '#cbd5e1', true);
        }
        // Magnetic strip with screwdrivers
        box('metal', -0.10, 0.24, -0.39, 0.44, 0.03, 0.02, '#181b1e', true);
        for (let sc = 0; sc < 3; sc++) {
          cyl('metal', -0.24 + sc * 0.10, 0.22, -0.37, 0.015, 0.22, 0.015, '#cbd5e1', true);
        }

      } else if (/^bball$/i.test(t)) {
        // Professional Outdoor Basketball System (Heavy steel mast, clear shatterproof backboard, spring breakaway orange rim, net)
        // 1. Heavy square black steel mast pole
        box('metal', 0, 0.52, -0.38, 0.12, 1.04, 0.12, '#1e293b', true);
        box('dark', 0, 0.22, -0.38, 0.22, 0.42, 0.22, '#0f172a');             // pole protective foam pad
        // Overhang extension arms holding backboard
        box('metal', 0, 0.88, -0.16, 0.08, 0.08, 0.38, '#1e293b', true);
        // 2. Regulation clear acrylic backboard with target shooter square
        box('glass', 0, 0.96, 0.04, 0.94, 0.56, 0.03, '#d8eef4');
        box('fabric', 0, 0.92, 0.056, 0.38, 0.28, 0.005, '#ffffff');           // target inner square
        // 3. Spring-loaded breakaway orange rim & white nylon net
        cyl('metal', 0, 0.82, 0.24, 0.34, 0.025, 0.34, '#f97316', true);      // 18-inch orange rim
        part('cone', 'fabric', 0, 0.68, 0.24, 0.32, 0.28, 0.32, '#ffffff');    // nylon net

      } else if (/^evcharger$/i.test(t)) {
        // Level 2 Residential Electric Vehicle Wall/Pedestal Charger (Sleek minimalist casing, pedestal conduit, glowing LED halo status light, coiled cable & gun)
        // 1. Grounded steel pedestal base & electrical conduit (zero floating air gap!)
        box('metal', 0, 0.03, -0.38, 0.36, 0.06, 0.22, '#0f172a');      // floor mounting plate
        box('metal', 0, 0.18, -0.38, 0.12, 0.26, 0.10, '#334155');      // vertical supply conduit column
        // 2. Modern charger enclosure (connecting flush with conduit)
        box('ceramic', 0, 0.54, -0.38, 0.48, 0.72, 0.18, color || '#1e293b');
        // Circular glowing LED charging status ring (pulsing cyan)
        cyl('glow', 0, 0.62, -0.285, 0.22, 0.01, 0.22, '#38bdf8');
        cyl('ceramic', 0, 0.62, -0.28, 0.16, 0.015, 0.16, '#0f172a');
        // 3. Heavy-duty 25ft charging cable coiled neatly on side hanger
        cyl('dark', 0.28, 0.38, -0.32, 0.22, 0.12, 0.22, '#111827');
        // Ergonomic J1772 / NACS charging handle gun docked in holster
        box('dark', 0, 0.32, -0.26, 0.12, 0.18, 0.16, '#181b1e');
        box('metal', 0, 0.36, -0.22, 0.06, 0.08, 0.10, '#cbd5e1');      // latch button

      } else if (/^carlift$/i.test(t)) {
        // Commercial 2-Post Heavy-Duty Hydraulic Automotive Lift (2x4 footprint, twin structural steel columns, base plates, overhead beam, 4 telescoping swing arms, rubber pads)
        const liftCol = color || '#2563eb';
        // 1. Heavy structural steel C-channel upright columns & base anchor plates
        for (const sx of [-0.42, 0.42]) {
          // Steel base plate with anchor bolts firmly on floor
          box('dark', sx, 0.025, 0, 0.30, 0.05, 0.48, '#0f172a');
          for (const bz of [-0.18, 0.18]) {
            cyl('metal', sx - 0.10, 0.055, bz, 0.03, 0.02, 0.03, '#94a3b8');
            cyl('metal', sx + 0.10, 0.055, bz, 0.03, 0.02, 0.03, '#94a3b8');
          }
          // Main vertical column (structural steel)
          box('metal', sx, 0.52, 0, 0.18, 1.00, 0.26, liftCol);
          // Inner column track channel
          box('dark', sx > 0 ? sx - 0.07 : sx + 0.07, 0.52, 0, 0.04, 0.98, 0.18, '#1e293b');
          // Sliding carriage sleeve on each column
          box('metal', sx > 0 ? sx - 0.04 : sx + 0.04, 0.30, 0, 0.14, 0.28, 0.22, '#f59e0b');
          // Column top cap & pulley bracket
          box('metal', sx, 1.02, 0, 0.20, 0.04, 0.28, liftCol);
        }
        // Overhead hydraulic sync crossbeam spanning between column tops
        box('metal', 0, 1.02, 0, 0.96, 0.08, 0.16, liftCol);
        box('dark', 0, 0.97, 0, 0.82, 0.02, 0.04, '#0f172a'); // overhead padded shutoff bar
        // Hydraulic power unit (motor, reservoir tank, pushbuttons) on right column
        cyl('dark', 0.49, 0.72, 0.14, 0.12, 0.22, 0.12, '#1e293b'); // electric motor
        box('metal', 0.49, 0.52, 0.14, 0.14, 0.22, 0.14, '#334155'); // oil tank reservoir
        box('glow', 0.49, 0.64, 0.215, 0.03, 0.04, 0.01, '#22c55e'); // green raise button
        box('metal', 0.49, 0.58, 0.215, 0.04, 0.06, 0.02, '#e2e8f0'); // lowering release lever
        // 2. 4 Telescoping 2-Stage Swing Arms with Heavy Swivel Cleats & Lift Pads
        for (const sx of [-0.34, 0.34]) {
          for (const sz of [-0.18, 0.18]) {
            // Swivel cleat hinge pinned to carriage
            cyl('dark', sx, 0.24, sz * 0.7, 0.08, 0.14, 0.08, '#0f172a');
            // Stage 1 arm (heavy yellow steel tube)
            const armEndX = sx > 0 ? sx - 0.18 : sx + 0.18;
            const armEndZ = sz > 0 ? sz + 0.16 : sz - 0.16;
            boxSlope('metal', sx, 0.24, sz * 0.7, armEndX, 0.24, armEndZ, 0.07, 0.08, '#f59e0b');
            // Stage 2 extension arm
            const padX = sx > 0 ? sx - 0.26 : sx + 0.26;
            const padZ = sz > 0 ? sz + 0.24 : sz - 0.24;
            boxSlope('metal', armEndX, 0.24, armEndZ, padX, 0.24, padZ, 0.05, 0.06, '#d97706');
            // Heavy vertical threaded adapter post & ribbed rubber lift puck
            cyl('metal', padX, 0.28, padZ, 0.07, 0.06, 0.07, '#cbd5e1');
            cyl('dark', padX, 0.32, padZ, 0.11, 0.03, 0.11, '#181b1e'); // rubber pad
          }
        }

      } else if (/^ladder$/i.test(t)) {
        // Heavy-Duty Aluminum / Fiberglass Extension Step Ladder (1x2 footprint, ribbed D-rungs, top tool tray)
        // 1. Two heavy side rails angled upward
        for (const sx of [-0.24, 0.24]) {
          box('metal', sx, 0.48, 0, 0.045, 0.96, 0.06, color || '#f97316');
        }
        // 2. 7 Non-slip ribbed aluminum rungs
        for (let r = 0; r < 7; r++) {
          const ry = 0.14 + r * 0.12;
          cylX('metal', 0, ry, 0, 0.46, 0.025, 0.025, '#cbd5e1');
        }
        // Molded top tray with tool holsters
        box('dark', 0, 0.98, 0, 0.52, 0.06, 0.18, '#1e293b');

      } else if (/^generator$/i.test(t)) {
        // Heavy-Duty Portable Emergency Gas Generator (Steel roll cage, OHV engine, fuel tank, outlet panel, wheels)
        // 1. Heavy tubular steel roll cage frame
        box('metal', 0, 0.44, 0, 0.88, 0.76, 0.84, color || '#eab308', true);
        // Never-flat transport wheels & folding rubber handle
        cylX('dark', -0.42, 0.12, 0.32, 0.08, 0.22, 0.22, '#181b1e');
        cylX('dark', 0.42, 0.12, 0.32, 0.08, 0.22, 0.22, '#181b1e');
        box('dark', 0, 0.78, -0.44, 0.44, 0.06, 0.08, '#181b1e');             // folding handle
        // 2. 4-Stroke OHV gas engine block with recoil starter
        box('metal', 0, 0.34, 0, 0.54, 0.42, 0.54, '#334155', true);
        cyl('dark', 0.28, 0.34, 0, 0.18, 0.06, 0.18, '#181b1e');              // recoil pull starter
        // 3. Top steel fuel tank with fuel cap & gauge
        box('metal', 0, 0.72, 0, 0.74, 0.18, 0.72, '#0f172a', true);
        cyl('metal', 0.18, 0.82, -0.16, 0.08, 0.04, 0.08, '#cbd5e1', true);   // chrome gas cap
        // Front electrical control panel with dual 120V/240V outlets
        box('metal', 0, 0.44, 0.425, 0.62, 0.38, 0.02, '#1e293b', true);
        box('dark', -0.14, 0.44, 0.438, 0.10, 0.12, 0.01, '#0f172a');         // 120V duplex outlet
        box('dark', 0.14, 0.44, 0.438, 0.12, 0.12, 0.01, '#0f172a');          // 240V twist-lock outlet
        box('glow', 0, 0.58, 0.438, 0.04, 0.04, 0.01, '#22c55e');             // circuit breaker LED

      } else if (/^compressor$/i.test(t)) {
        // 20-Gallon Portable Air Compressor (Horizontal steel tank, finned motor pump, dual brass gauges, coiled hose)
        // 1. Heavy cylindrical air pressure tank with rubber wheels
        cylZ('metal', 0, 0.34, 0, 0.48, 0.48, 0.82, color || '#dc2626', true); // horizontal red tank along Z
        cylX('dark', -0.28, 0.12, 0.28, 0.06, 0.22, 0.22, '#181b1e');          // left wheel
        cylX('dark', 0.28, 0.12, 0.28, 0.06, 0.22, 0.22, '#181b1e');           // right wheel
        // 2. Finned compressor motor pump assembly on top
        box('metal', 0, 0.68, -0.06, 0.38, 0.34, 0.38, '#1e293b', true);
        cyl('metal', 0, 0.84, -0.06, 0.24, 0.12, 0.24, '#64748b', true);      // finned cylinder head
        // Dual brass pressure gauges (tank & tool, facing front +Z)
        cylZ('metal', -0.12, 0.72, 0.24, 0.08, 0.08, 0.03, '#c9a44e', true);
        cylZ('ceramic', -0.12, 0.72, 0.256, 0.07, 0.07, 0.005, '#ffffff');
        cylZ('metal', 0.12, 0.72, 0.24, 0.08, 0.08, 0.03, '#c9a44e', true);
        cylZ('ceramic', 0.12, 0.72, 0.256, 0.07, 0.07, 0.005, '#ffffff');
        // Coiled polyurethane yellow air hose
        cyl('fabric', 0, 0.48, -0.32, 0.22, 0.16, 0.22, '#facc15');

      } else if (/^kayak$/i.test(t)) {
        // Streamlined Touring Sea Kayak (1x3 footprint, rotomolded hull, deck bungee rigging, cockpit seat, double-bladed paddle)
        // 1. Sleek hydro-dynamic kayak hull along Z
        cylZ('ceramic', 0, 0.18, 0, 0.52, 0.32, 0.94, color || '#f97316');     // contoured hull
        box('ceramic', 0, 0.24, 0, 0.46, 0.10, 0.92, color || '#f97316');
        // Cockpit coaming rim & padded backrest seat
        cylZ('dark', 0, 0.28, 0.05, 0.36, 0.06, 0.42, '#0f172a');              // cockpit coaming
        box('fabric', 0, 0.34, 0.16, 0.24, 0.16, 0.08, '#1e293b');             // padded backrest
        // Deck bungee cargo tie-downs
        box('dark', 0, 0.302, -0.32, 0.22, 0.005, 0.24, '#181b1e');
        box('dark', 0, 0.302, 0.34, 0.22, 0.005, 0.24, '#181b1e');
        // Double-bladed asymmetric carbon-fiber paddle strapped across (along X)
        cylX('dark', 0, 0.35, -0.10, 0.88, 0.02, 0.02, '#181b1e');              // paddle shaft
        box('fabric', -0.38, 0.35, -0.10, 0.14, 0.01, 0.08, color || '#f97316'); // left blade
        box('fabric', 0.38, 0.35, -0.10, 0.14, 0.01, 0.08, color || '#f97316');  // right blade

      } else if (/^golfbag$/i.test(t)) {
        // Premium Stand Golf Bag with 14 Clubs (Driver, woods, irons, putter, rain hood, dual straps)
        // 1. Durable synthetic leather golf bag cylinder
        cyl('fabric', 0, 0.42, 0, 0.48, 0.74, 0.48, color || '#047857');
        cyl('dark', 0, 0.05, 0, 0.50, 0.10, 0.50, '#15171a');                 // molded rubber base
        // Dual zippered side apparel pockets & towel ring
        box('fabric', -0.25, 0.38, 0, 0.08, 0.46, 0.26, HP.shade(color || '#047857', 0.88));
        box('fabric', 0.25, 0.38, 0, 0.08, 0.46, 0.26, HP.shade(color || '#047857', 0.88));
        // Splayed aluminum stand legs
        cyl('metal', -0.18, 0.38, 0.26, 0.02, 0.72, 0.02, '#cbd5e1', true);
        cyl('metal', 0.18, 0.38, 0.26, 0.02, 0.72, 0.02, '#cbd5e1', true);
        // 2. Set of golf clubs protruding from top collar
        cyl('metal', 0, 0.84, -0.10, 0.02, 0.30, 0.02, '#cbd5e1', true);       // steel driver shaft
        round('dark', 0, 0.98, -0.10, 0.12, 0.08, 0.10, '#181b1e');           // 460cc driver head
        // Multiple irons with chrome heads
        for (let i = 0; i < 4; i++) {
          const ix = -0.12 + i * 0.08;
          cyl('metal', ix, 0.86, 0.05, 0.015, 0.24, 0.015, '#cbd5e1', true);
          box('metal', ix, 0.96, 0.06, 0.05, 0.04, 0.02, '#cbd5e1', true);    // iron blade
        }

      } else if (/^surfboard$/i.test(t)) {
        // Classic Fiberglass Thruster Surfboard with Retro Airbrush Graphics & Traction Pad (1x2 footprint)
        // 1. Hydrodynamic rockered surfboard blank along Z
        cylZ('ceramic', 0, 0.05, 0, 0.48, 0.06, 0.94, '#fef3c7');              // fiberglass deck
        box('ceramic', 0, 0.05, 0, 0.44, 0.05, 0.90, '#fef3c7');
        // Colorful retro airbrushed stripe graphics
        box('glow', 0, 0.08, 0, 0.16, 0.005, 0.68, color || '#f43f5e');
        // Black EVA diamond traction tail pad
        box('dark', 0, 0.08, 0.32, 0.30, 0.01, 0.24, '#181b1e');
        box('dark', 0, 0.09, 0.42, 0.26, 0.02, 0.04, '#181b1e');              // tail kick wedge
        // Underside 3 thruster fins
        box('ceramic', 0, 0.02, 0.38, 0.015, 0.04, 0.08, '#ffffff');           // center fin
        box('ceramic', -0.12, 0.02, 0.32, 0.015, 0.04, 0.08, '#ffffff');        // left fin
        box('ceramic', 0.12, 0.02, 0.32, 0.015, 0.04, 0.08, '#ffffff');         // right fin

      } else if (/^scooter$/i.test(t)) {
        // Foldable Electric Commuter Scooter (Aluminum deck, 8.5" pneumatic tires, T-handlebars, LED headlight)
        // 1. Front and rear pneumatic tires (true circular tires)
        wheelX('dark', 0, 0.14, -0.36, 0.08, 8.4, '#181b1e');             // front tire
        wheelX('dark', 0, 0.14, 0.36, 0.08, 8.4, '#181b1e');              // rear tire
        // Low aluminum standing deck with grip tape
        box('metal', 0, 0.14, 0, 0.24, 0.06, 0.62, color || '#1e293b', true);
        box('dark', 0, 0.172, 0, 0.20, 0.005, 0.54, '#0f172a');               // grip tape
        // 2. Upright steering stem with folding hinge mechanism
        cyl('metal', 0, 0.54, -0.32, 0.04, 0.74, 0.04, color || '#1e293b', true);
        // Wide T-handlebars with rubber grips & thumb throttle (horizontal bar across X)
        cylX('metal', 0, 0.90, -0.32, 0.52, 0.03, 0.03, '#0f172a', true);
        box('glow', 0, 0.90, -0.34, 0.05, 0.04, 0.01, '#ffffff');             // bright LED headlight
        box('dark', 0.18, 0.90, -0.30, 0.03, 0.04, 0.04, '#ef4444');          // red thumb throttle

      } else if (/^carport$/i.test(t)) {
        // Heavy Outdoor Steel Carport Shelter (4x5 footprint, 6 heavy steel posts, gabled corrugated roof)
        // 1. 6 Heavy square steel posts
        for (const sx of [-0.45, 0.45]) {
          for (const sz of [-0.42, 0, 0.42]) {
            box('metal', sx, 0.50, sz, 0.06, 0.96, 0.06, color || '#475569');
          }
        }
        // Heavy perimeter & truss support beams
        box('metal', 0, 0.94, -0.42, 0.96, 0.06, 0.06, '#334155');
        box('metal', 0, 0.94, 0.42, 0.96, 0.06, 0.06, '#334155');
        box('metal', -0.45, 0.94, 0, 0.06, 0.06, 0.90, '#334155');
        box('metal', 0.45, 0.94, 0, 0.06, 0.06, 0.90, '#334155');
        // 2. Pitched gabled corrugated steel roof canopy
        part('roof', 'metal', 0, 1.05, 0, 0.98, 0.22, 0.96, '#64748b');

      } else if (/^ridemower$/i.test(t)) {
        // Heavy-Duty Lawn Tractor Ride-On Mower (1x2 footprint, high-back seat, steering wheel, cutting deck, turf tires)
        // 1. 4 Wide turf-saver tires (true circular tires & rims)
        wheelX('dark', -0.38, 0.18, 0.28, 0.14, 11.5, '#181b1e');         // rear fat tire left
        wheelX('dark', 0.38, 0.18, 0.28, 0.14, 11.5, '#181b1e');          // rear fat tire right
        wheelX('metal', -0.38, 0.18, 0.28, 0.15, 5.8, '#facc15', true);   // yellow rim left
        wheelX('metal', 0.38, 0.18, 0.28, 0.15, 5.8, '#facc15', true);    // yellow rim right
        wheelX('dark', -0.34, 0.13, -0.32, 0.10, 8.3, '#181b1e');         // front tire left
        wheelX('dark', 0.34, 0.13, -0.32, 0.10, 8.3, '#181b1e');          // front tire right
        wheelX('metal', -0.34, 0.13, -0.32, 0.11, 3.8, '#facc15', true);  // front rim left
        wheelX('metal', 0.34, 0.13, -0.32, 0.11, 3.8, '#facc15', true);   // front rim right
        // 2. Heavy steel chassis & green/yellow hood
        box('ceramic', 0, 0.42, -0.16, 0.62, 0.34, 0.58, color || '#16a34a'); // engine hood
        box('dark', 0, 0.38, -0.445, 0.54, 0.20, 0.02, '#181b1e');            // front black grille
        box('glow', -0.20, 0.44, -0.45, 0.10, 0.06, 0.01, '#fef08a');          // headlight left
        box('glow', 0.20, 0.44, -0.45, 0.10, 0.06, 0.01, '#fef08a');           // headlight right
        // Mid-mount dual-blade steel mower deck underneath
        box('dark', 0, 0.16, -0.04, 0.78, 0.12, 0.54, '#0f172a');
        // 3. Ergonomic high-back driver seat & steering wheel
        box('dark', 0, 0.56, 0.22, 0.44, 0.28, 0.40, '#1e293b');              // padded vinyl seat
        cyl('metal', 0, 0.58, -0.02, 0.03, 0.24, 0.03, '#1e293b', true);      // steering column
        wheelZ('dark', 0, 0.68, -0.04, 7.6, 0.03, '#181b1e');             // round steering wheel

      
      /* ---------------- OUTDOOR & PATIO (34 ITEMS) ---------------- */
      } else if (/^bbq$/i.test(t)) {
        // Luxury Stainless Outdoor BBQ Grill (2x1 footprint, roll-top hood, cast iron grates, side burner & prep shelf)
        // 1. Heavy welded steel cart base frame & 4 caster wheels with vertical leg posts
        box('metal', 0, 0.05, 0, 0.88, 0.04, 0.76, '#181b1e');          // lower welded steel base frame
        box('metal', 0, 0.08, 0, 0.84, 0.02, 0.72, '#334155');          // lower wire storage shelf
        for (const [cx, cz] of [[-0.40, -0.32], [0.40, -0.32], [-0.40, 0.32], [0.40, 0.32]]) {
          cyl('dark', cx, 0.035, cz, 0.08, 0.07, 0.08, '#0f172a');             // grounded caster wheel
          box('metal', cx, 0.065, cz, 0.09, 0.02, 0.09, '#475569');       // wheel swivel plate
          box('metal', cx, 0.22, cz, 0.06, 0.34, 0.06, '#1e293b');        // solid vertical leg upright
        }
        // 2. Heavy cart cabinet body (resting flush on base frame, rising to y=0.64)
        box('metal', 0, 0.38, 0, 0.88, 0.54, 0.78, color || '#2e3440');
        // Dual cabinet doors on front (+Z) with chrome vertical bar handles
        box('metal', -0.21, 0.38, 0.395, 0.40, 0.48, 0.02, HP.shade(color || '#3a3f47', 1.15));
        box('metal', 0.21, 0.38, 0.395, 0.40, 0.48, 0.02, HP.shade(color || '#3a3f47', 1.15));
        box('metal', -0.04, 0.38, 0.415, 0.02, 0.16, 0.02, '#cbd5e1');
        box('metal', 0.04, 0.38, 0.415, 0.02, 0.16, 0.02, '#cbd5e1');
        // 3. Control fascia & knobs on front face (+Z)
        box('metal', 0, 0.67, 0.41, 0.92, 0.08, 0.03, '#cbd5e1');
        for (let k = 0; k < 3; k++) {
          cylZ('metal', -0.30 + k * 0.12, 0.67, 0.43, 0.035, 0.035, 0.02, '#1e293b');
          round('glow', -0.30 + k * 0.12, 0.67, 0.44, 0.012, 0.012, 0.005, '#38bdf8');
        }
        cylZ('metal', 0.30, 0.67, 0.43, 0.035, 0.035, 0.02, '#1e293b'); // side burner knob
        // 4. Right prep shelf with recessed side burner
        box('metal', 0.30, 0.69, 0, 0.30, 0.03, 0.78, '#cbd5e1');
        cyl('dark', 0.30, 0.71, 0, 0.16, 0.015, 0.16, '#0f172a');
        round('glow', 0.30, 0.715, 0, 0.07, 0.01, 0.07, '#38bdf8');
        // Left prep shelf
        box('metal', -0.30, 0.69, 0, 0.30, 0.03, 0.78, '#cbd5e1');
        // 5. Main firebox & cast iron grill grates
        box('metal', 0, 0.68, 0, 0.58, 0.06, 0.80, '#1e293b');
        box('dark', 0, 0.715, 0, 0.54, 0.015, 0.74, '#111315');
        for (let g = 0; g < 5; g++) {
          box('metal', -0.22 + g * 0.11, 0.725, 0, 0.015, 0.01, 0.70, '#475569');
        }
        // 6. Horizontal roll-top hood (cylX) with handle & thermometer
        box('metal', 0, 0.77, -0.05, 0.56, 0.10, 0.70, '#94a3b8');
        cylX('metal', 0, 0.82, -0.05, 0.56, 0.16, 0.66, '#cbd5e1');
        cylX('metal', 0, 0.79, 0.32, 0.46, 0.025, 0.025, '#f1f5f9');
        box('metal', -0.18, 0.79, 0.30, 0.02, 0.02, 0.04, '#475569');
        box('metal', 0.18, 0.79, 0.30, 0.02, 0.02, 0.04, '#475569');
        cyl('metal', 0, 0.86, 0.18, 0.04, 0.015, 0.04, '#c9a44e');

      } else if (/^lounger$/i.test(t)) {
        // Modern Teak & Aluminum Outdoor Sun Lounger with Adjustable Reclining Backrest and Plush Cushion (1x2)
        // 1. Splayed architectural aluminum runner frame with rear wheels
        box('metal', -0.28, 0.10, 0, 0.04, 0.16, 0.88, '#1e293b', true);
        box('metal', 0.28, 0.10, 0, 0.04, 0.16, 0.88, '#1e293b', true);
        cylX('dark', -0.30, 0.10, -0.40, 0.04, 0.12, 0.12, '#0f172a');          // left transport wheel
        cylX('dark',  0.30, 0.10, -0.40, 0.04, 0.12, 0.12, '#0f172a');          // right transport wheel
        // Teak wood slatted lounger bed frame
        for (let s = 0; s < 7; s++) {
          box('wood', 0, 0.20, -0.36 + s * 0.12, 0.58, 0.03, 0.08, '#d97706');
        }
        // 2. Thick all-weather Sunbrella lounger cushion
        box('fabric', 0, 0.25, 0.10, 0.54, 0.08, 0.58, color || '#f5f5f4');  // flat seat cushion
        box('fabric', 0, 0.42, -0.28, 0.54, 0.08, 0.36, color || '#f5f5f4'); // inclined backrest cushion
        // Striped headrest bolster pillow
        cyl('fabric', 0, 0.56, -0.38, 0.12, 0.48, 0.12, HP.shade(color || '#f5f5f4', 0.88));

      } else if (/^patiotable$/i.test(t)) {
        // Circular Outdoor Patio Dining Set with 4 Woven Armchairs (3x3 footprint, center umbrella hole)
        // 1. Center circular pedestal table with umbrella hole
        cyl('metal', 0, 0.34, 0, 0.16, 0.68, 0.16, '#1e293b', true);
        box('metal', 0, 0.04, 0, 0.54, 0.06, 0.54, '#1e293b', true);          // base cross
        cyl('ceramic', 0, 0.70, 0, 0.68, 0.04, 0.68, color || '#ffffff');     // honed tabletop
        cyl('dark', 0, 0.70, 0, 0.06, 0.05, 0.06, '#0f172a');                 // umbrella hole
        // 2. 4 Woven all-weather wicker patio chairs tucked around table
        const chairPos = [[-0.36, 0], [0.36, 0], [0, -0.36], [0, 0.36]];
        for (let c = 0; c < 4; c++) {
          const [cx, cz] = chairPos[c];
          // Splayed metal chair legs
          cyl('metal', cx, 0.20, cz, 0.03, 0.40, 0.03, '#1e293b', true);
          // Curved woven bucket seat & cushion
          cyl('wood', cx, 0.44, cz, 0.28, 0.14, 0.28, '#78350f');              // wicker shell
          cyl('fabric', cx, 0.48, cz, 0.24, 0.06, 0.24, '#f8fafc');            // white cushion
        }

      } else if (/^coatrack$/i.test(t)) {
        // Classical Turned Wooden Hall Tree Coat Rack with 6 Fluted Brass Double Hooks & Umbrella Drip Base
        // 1. Turned pedestal mast with 4 carved cabriole feet
        cyl('wood', 0, 0.48, 0, 0.08, 0.94, 0.08, color || '#451a03');
        box('wood', 0, 0.05, 0, 0.64, 0.06, 0.64, '#451a03');
        // Lower umbrella drip ring with brass tray
        cyl('metal', 0, 0.24, 0, 0.38, 0.02, 0.38, '#c9a44e', true);
        cyl('dark', 0, 0.09, 0, 0.32, 0.02, 0.32, '#181b1e');                 // drip pan
        // 2. 6 Curved double brass coat hooks at crown
        for (let h = 0; h < 6; h++) {
          const hang = h * (Math.PI / 3);
          const hx = Math.cos(hang) * 0.14, hz = Math.sin(hang) * 0.14;
          box('metal', hx, 0.88, hz, 0.03, 0.14, 0.03, '#c9a44e', true);
          round('metal', hx * 1.3, 0.94, hz * 1.3, 0.04, 0.04, 0.04, '#c9a44e', true); // upper hat hook
          round('metal', hx * 1.2, 0.82, hz * 1.2, 0.03, 0.03, 0.03, '#c9a44e', true); // lower coat hook
        }
        // Turned wooden crown finial ball on top
        round('wood', 0, 0.98, 0, 0.10, 0.10, 0.10, '#451a03');

      } else if (/^hottub$/i.test(t)) {
        // Luxury Octagonal Cedar Hot Tub with Warm Bubbling Water & Digital Touchpad (2x2 footprint)
        // 1. Octagonal vertical cedar plank cabinetry
        cyl('wood', 0, 0.44, 0, 0.94, 0.84, 0.94, color || '#78350f');
        box('dark', 0, 0.04, 0, 0.96, 0.08, 0.96, '#15171a');
        // 2. Contoured ergonomic acrylic spa shell inside
        cyl('ceramic', 0, 0.48, 0, 0.84, 0.78, 0.84, '#ffffff');               // white acrylic shell
        // 3. Crystal-clear bubbling cyan water surface with hydrotherapy jets
        cyl('water', 0, 0.78, 0, 0.76, 0.02, 0.76, '#06b6d4');
        for (let j = 0; j < 6; j++) {
          const jang = j * (Math.PI / 3);
          round('glow', Math.cos(jang) * 0.28, 0.79, Math.sin(jang) * 0.28, 0.05, 0.02, 0.05, '#ffffff'); // jet bubbles
        }
        // Corner LED digital touchpad
        box('dark', 0.36, 0.86, 0.36, 0.14, 0.02, 0.14, '#0f172a');
        box('glow', 0.36, 0.875, 0.36, 0.10, 0.005, 0.10, '#38bdf8');          // 104°F readout

      } else if (/^parasol$/i.test(t)) {
        // Luxury Cantilever Patio Parasol (2x2 footprint, heavy granite cross base, arched aluminum boom, 8-rib canopy)
        // 1. Heavy granite slab base weights
        box('stone', -0.32, 0.05, -0.32, 0.34, 0.08, 0.34, '#475569');
        box('metal', -0.32, 0.54, -0.32, 0.06, 0.98, 0.06, '#1e293b', true);  // offset vertical mast
        // Arched cantilever overhead boom arm
        box('metal', -0.14, 0.96, -0.14, 0.38, 0.05, 0.38, '#1e293b', true);
        // 2. Large 8-rib fabric parasol canopy with top wind vent
        part('cone', 'fabric', 0.05, 0.84, 0.05, 0.88, 0.22, 0.88, color || '#f97316');
        part('cone', 'fabric', 0.05, 0.94, 0.05, 0.32, 0.08, 0.32, HP.shade(color || '#f97316', 1.15)); // top wind cap

      } else if (/^planter$/i.test(t)) {
        // Cedar Raised Garden Planter Box with Lush 3D Perennials & Blooming Flowers (2x1 footprint, height 22px)
        // 1. Heavy interlocking cedar timber planks with top coping rim
        box('wood', 0, 0.36, 0, 0.94, 0.68, 0.88, color || '#b45309');
        box('wood', 0, 0.72, 0, 0.98, 0.06, 0.92, HP.shade(color || '#b45309', 1.10)); // top coping ledge
        box('dark', 0, 0.03, 0, 0.96, 0.06, 0.90, '#15171a');
        // 2. Rich dark loam potting soil layer
        box('soil', 0, 0.65, 0, 0.86, 0.12, 0.80, '#382218');
        // 3. Volumetric 3D leafy foliage domes with real height (never flat!)
        round('foliage', -0.24, 0.82, 0, 0.34, 0.36, 0.42, '#15803d');
        round('foliage',  0.24, 0.82, 0, 0.34, 0.36, 0.42, '#16a34a');
        round('foliage',  0.00, 0.88, 0.04, 0.28, 0.32, 0.34, '#14532d');
        // 4. Stalks with blooming flowers: geraniums, lavender spikes & marigolds
        cyl('foliage', -0.24, 0.96, 0.08, 0.02, 0.24, 0.02, '#15803d');
        round('fabric', -0.24, 1.08, 0.08, 0.14, 0.14, 0.14, '#f43f5e'); // vibrant magenta geraniums
        cyl('foliage', 0.24, 0.96, -0.08, 0.02, 0.24, 0.02, '#15803d');
        round('fabric', 0.24, 1.08, -0.08, 0.14, 0.14, 0.14, '#8b5cf6');  // purple lavender blossom
        cyl('foliage', 0.00, 1.00, -0.04, 0.02, 0.26, 0.02, '#15803d');
        round('fabric', 0.00, 1.12, -0.04, 0.12, 0.12, 0.12, '#f59e0b');  // golden marigold blossom

      } else if (/^flowerbed$/i.test(t)) {
        // Interlocking Fieldstone & Timber Garden Flower Bed with Multi-Variety Perennials (2x1 footprint, height 22px)
        // 1. Sturdy wooden timber border with corner lap joints
        box('wood', 0, 0.28, 0, 0.96, 0.54, 0.88, color || '#78350f');
        box('wood', 0, 0.56, 0, 0.98, 0.06, 0.90, HP.shade(color || '#78350f', 1.12));
        box('soil', 0, 0.48, 0, 0.88, 0.18, 0.80, '#2d1a10');
        // 2. 4 Distinct flowering plant clumps along length
        const bedPlants = [
          { x: -0.34, z:  0.04, folCol: '#15803d', flwCol: '#8b5cf6' }, // English lavender
          { x: -0.12, z: -0.06, folCol: '#16a34a', flwCol: '#ef4444' }, // Red tea roses
          { x:  0.12, z:  0.06, folCol: '#15803d', flwCol: '#f59e0b' }, // Golden black-eyed susans
          { x:  0.34, z: -0.04, folCol: '#16a34a', flwCol: '#f8fafc' }  // White Shasta daisies
        ];
        for (const bp of bedPlants) {
          round('foliage', bp.x, 0.74, bp.z, 0.24, 0.38, 0.32, bp.folCol);
          cyl('foliage', bp.x, 0.92, bp.z, 0.02, 0.22, 0.02, bp.folCol);
          round('fabric', bp.x, 1.04, bp.z, 0.13, 0.14, 0.13, bp.flwCol);
          if (bp.flwCol === '#f8fafc') {
            round('fabric', bp.x, 1.05, bp.z, 0.04, 0.04, 0.04, '#eab308'); // yellow daisy center
          }
        }

      } else if (/^tomato$/i.test(t)) {
        // Staked Garden Tomato Vine in Terracotta Planter Pot with Ripe Cherry Tomatoes (1x1 footprint)
        // 1. Terracotta planter pot with rolled coping rim & loam soil
        cyl('ceramic', 0, 0.18, 0, 0.72, 0.36, 0.72, '#c26d38');
        cyl('ceramic', 0, 0.34, 0, 0.78, 0.08, 0.78, '#b45b29');
        cyl('soil', 0, 0.35, 0, 0.68, 0.04, 0.68, '#3d1d0c');
        // 2. Bamboo climbing stakes & wire support rings
        for (let s = 0; s < 3; s++) {
          const ang = s * (Math.PI * 2 / 3);
          const sx = Math.cos(ang) * 0.22;
          const sz = Math.sin(ang) * 0.22;
          cyl('wood', sx, 0.58, sz, 0.03, 0.76, 0.03, '#78350f');
        }
        cyl('metal', 0, 0.55, 0, 0.44, 0.015, 0.44, '#15803d', true); // trellis ring 1
        cyl('metal', 0, 0.78, 0, 0.48, 0.015, 0.48, '#15803d', true); // trellis ring 2
        // 3. Sprawling leafy tomato vine clusters
        round('foliage', 0, 0.52, 0, 0.56, 0.32, 0.56, color || '#16a34a');
        round('foliage', -0.08, 0.68, 0.06, 0.48, 0.30, 0.48, HP.shade(color || '#16a34a', 1.15));
        round('foliage', 0.06, 0.82, -0.06, 0.42, 0.28, 0.42, HP.shade(color || '#16a34a', 1.25));
        // 4. Glossy cluster of vine-ripened red tomatoes
        round('ceramic', -0.16, 0.48, 0.16, 0.11, 0.11, 0.11, '#ef4444');
        round('ceramic', -0.14, 0.44, 0.22, 0.09, 0.09, 0.09, '#dc2626');
        round('ceramic', 0.16, 0.62, 0.14, 0.10, 0.10, 0.10, '#ef4444');
        round('ceramic', 0.20, 0.58, 0.10, 0.08, 0.08, 0.08, '#f87171');
        round('ceramic', -0.12, 0.74, -0.12, 0.10, 0.10, 0.10, '#ef4444');

      } else if (/^pathlight$/i.test(t)) {
        // Ultra-Realistic Architectural Cast-Bronze Pagoda Pathway Stake Light with Glare-Free Halo
        // 1. Textured bronze ground stake collar and slender riser stem
        cyl('metal', 0, 0.03, 0, 0.32, 0.06, 0.32, color || '#334155');        // ground collar
        cyl('metal', 0, 0.38, 0, 0.065, 0.68, 0.065, color || '#334155');       // stanchion stem
        // 2. Frosted borosilicate glass optical lens with internal warm LED
        cyl('glass', 0, 0.72, 0, 0.24, 0.14, 0.24, '#f8fafc');                 // cylindrical lens
        cyl('glow', 0, 0.72, 0, 0.12, 0.10, 0.12, '#fef08a');                  // warm LED emitter
        // 3. Multi-tier pagoda louvers casting downward ground halo
        cyl('metal', 0, 0.78, 0, 0.38, 0.035, 0.38, color || '#334155');       // lower deflector louver
        cyl('metal', 0, 0.83, 0, 0.44, 0.04, 0.44, color || '#334155');        // main pagoda umbrella
        cyl('metal', 0, 0.88, 0, 0.28, 0.035, 0.28, HP.shade(color || '#334155', 1.20)); // upper tiered tier
        round('metal', 0, 0.92, 0, 0.06, 0.06, 0.06, '#c9a44e');               // solid brass weather-sealed finial
      } else if (/^tree$/i.test(t)) {
        // Majestic Natural Shade Tree (2x2 footprint, height 92px, organically tapered trunk, root flares, spreading boughs, multi-tiered leafy crown)
        const trunkCol = '#5a3825';
        const barkDark = '#3d2416';
        const leafMain = color || '#15803d';
        const leafLight = HP.shade(color || '#15803d', 1.15);
        const leafDark = HP.shade(color || '#15803d', 0.80);
        const leafSun = '#86efac';

        // 1. Natural tapered tree trunk with root buttresses & boughs
        cyl('wood', 0, 0.32, 0, 0.22, 0.64, 0.22, trunkCol);
        cyl('wood', 0, 0.60, 0, 0.16, 0.40, 0.16, barkDark);
        // Flaring root buttresses
        boxSlope('wood', 0, 0.16, 0.08, 0, 0.02, 0.24, 0.08, 0.08, barkDark);
        boxSlope('wood', 0, 0.16, -0.08, 0, 0.02, -0.24, 0.08, 0.08, barkDark);
        boxSlope('wood', 0.08, 0.16, 0, 0.24, 0.02, 0, 0.08, 0.08, barkDark);
        boxSlope('wood', -0.08, 0.16, 0, -0.24, 0.02, 0, 0.08, 0.08, barkDark);
        // Spreading scaffold boughs
        boxSlope('wood', 0, 0.54, 0, 0.16, 0.72, 0.14, 0.06, 0.06, trunkCol);
        boxSlope('wood', 0, 0.54, 0, -0.16, 0.74, -0.12, 0.06, 0.06, trunkCol);
        boxSlope('wood', 0, 0.58, 0, -0.14, 0.76, 0.14, 0.05, 0.05, trunkCol);
        boxSlope('wood', 0, 0.58, 0, 0.14, 0.74, -0.14, 0.05, 0.05, trunkCol);

        // 2. Multi-tiered volumetric leafy foliage canopy
        // Lower spreading tier
        round('foliage', 0.14, 0.66, 0.12, 0.62, 0.34, 0.62, leafDark);
        round('foliage', -0.14, 0.68, -0.12, 0.60, 0.34, 0.60, leafDark);
        round('foliage', -0.12, 0.70, 0.14, 0.58, 0.34, 0.58, leafMain);
        round('foliage', 0.12, 0.70, -0.14, 0.58, 0.34, 0.58, leafMain);
        // Mid tier body
        round('foliage', 0, 0.76, 0, 0.78, 0.38, 0.78, leafMain);
        round('foliage', 0.10, 0.82, 0.08, 0.66, 0.34, 0.66, leafLight);
        round('foliage', -0.10, 0.84, -0.08, 0.64, 0.34, 0.64, leafLight);
        // High sunlit crest
        round('foliage', 0, 0.92, 0, 0.52, 0.28, 0.52, leafLight);
        round('foliage', 0.04, 0.97, -0.02, 0.36, 0.22, 0.36, leafSun);

      } else if (/^hedge$/i.test(t)) {
        // Formal Manicured Evergreen Boxwood Hedge (2x1 footprint, height 24px, dense layered foliage volumes, rounded beveled crown, woody base stems & mulch bed)
        const darkSoil = '#291b10';
        const deepGreen = '#14532d'; // deep shadow foliage
        const midGreen = color || '#166534'; // lush primary foliage
        const lightGreen = HP.shade(color || '#166534', 1.18); // sunlit crown highlights
        const branchCol = '#422006'; // interior woody branches

        // 1. Dark Organic Soil & Mulch Bedding Trench (Ground anchor)
        box('soil', 0, 0.02, 0, 0.98, 0.04, 0.92, darkSoil);
        // Beveled edging curbs along the front and rear base
        for (const sz of [-0.44, 0.44]) {
          box('stone', 0, 0.03, sz, 0.99, 0.05, 0.04, '#78716c');
        }

        // 2. Woody Interior Stems & Trunk Stubs (Glimpses at ground level, y=0.04 to 0.22)
        for (const bx of [-0.34, -0.12, 0.12, 0.34]) {
          cyl('wood', bx, 0.12, 0, 0.03, 0.18, 0.03, branchCol);
          boxRot('wood', bx + 0.03, 0.16, 0.02, 0.02, 0.10, 0.02, 0.45, branchCol);
        }

        // 3. Dense Interior Structural Foliage Core (Shadow core)
        box('foliage', 0, 0.48, 0, 0.88, 0.76, 0.76, deepGreen);

        // 4. Sculpted Layered Boxwood Foliage Clusters (natural angled foliage cubes, zero flat disc blobs)
        for (const sz of [-0.34, 0.34]) {
          for (let i = -2; i <= 2; i++) {
            const fx = i * 0.19;
            const fy1 = 0.34 + (Math.abs(i) % 2) * 0.07;
            const fy2 = 0.64 - (Math.abs(i) % 2) * 0.05;
            boxRot('foliage', fx, fy1, sz, 0.20, 0.26, 0.18, (i * 0.27) + (sz > 0 ? 0.15 : -0.15), midGreen);
            boxRot('foliage', fx + (i % 2 ? -0.04 : 0.04), fy2, sz * 0.94, 0.19, 0.24, 0.18, (-i * 0.22) + 0.3, midGreen);
          }
        }
        for (const sx of [-0.42, 0.42]) {
          box('foliage', sx, 0.50, 0, 0.14, 0.64, 0.68, midGreen);
          boxRot('foliage', sx * 1.03, 0.54, 0, 0.12, 0.52, 0.52, 0.24, lightGreen);
        }

        // 5. Sculpted Manicured Top Crown (Crisp sunlit evergreen boxwood ridge with organic tufts)
        box('foliage', 0, 0.86, 0, 0.90, 0.12, 0.74, lightGreen);
        for (let i = -3; i <= 3; i++) {
          const cx = i * 0.13;
          const czOffset = (i % 2 === 0 ? 0.08 : -0.08);
          boxRot('foliage', cx, 0.91, czOffset, 0.18, 0.14, 0.42, (i * 0.19), lightGreen);
        }

      } else if (/^fountain$/i.test(t)) {
        // Classical 2-Tier Limestone Garden Fountain (2x2 footprint, carved pedestal, cascading water sheets)
        // 1. Broad octagonal limestone ground basin
        cyl('stone', 0, 0.16, 0, 0.96, 0.32, 0.96, color || '#e2e8f0');
        cyl('water', 0, 0.28, 0, 0.84, 0.02, 0.84, '#06b6d4');                 // lower pool
        // 2. Central fluted pedestal column & mid-tier spill bowl
        cyl('stone', 0, 0.48, 0, 0.22, 0.44, 0.22, '#cbd5e1');
        cyl('stone', 0, 0.64, 0, 0.58, 0.14, 0.58, color || '#e2e8f0');       // upper basin
        cyl('water', 0, 0.69, 0, 0.48, 0.02, 0.48, '#06b6d4');                 // upper water
        // 3. Classical pinecone water jet finial with vertical plume
        cyl('stone', 0, 0.80, 0, 0.12, 0.18, 0.12, '#cbd5e1');
        cyl('glow', 0, 0.92, 0, 0.06, 0.12, 0.06, '#ffffff');                  // splashing plume

      } else if (/^birdbath$/i.test(t)) {
        // Classical Turned Limestone Garden Pedestal Bird Bath (1x1 footprint, height 22px, scalloped water basin & perched songbird)
        const stoneCol = color || '#d8d2c6';
        // 1. Octagonal / Circular Tiered Limestone Ground Plinth Base
        cyl('stone', 0, 0.05, 0, 0.72, 0.10, 0.72, stoneCol);
        cyl('stone', 0, 0.12, 0, 0.58, 0.06, 0.58, HP.shade(stoneCol, 0.95));
        // 2. Classical Fluted Baluster Pedestal Column
        cyl('stone', 0, 0.28, 0, 0.28, 0.26, 0.28, stoneCol);
        round('stone', 0, 0.42, 0, 0.34, 0.14, 0.34, HP.shade(stoneCol, 1.05)); // middle column bulge
        cyl('stone', 0, 0.56, 0, 0.26, 0.18, 0.26, stoneCol);
        cyl('stone', 0, 0.68, 0, 0.48, 0.08, 0.48, HP.shade(stoneCol, 0.96)); // capital ring
        // 3. Wide Shallow Scalloped Basin Dish (y=0.72 to 0.90)
        round('stone', 0, 0.80, 0, 0.88, 0.20, 0.88, stoneCol);
        // Interior water dish hollow
        round('stone', 0, 0.83, 0, 0.76, 0.16, 0.76, HP.shade(stoneCol, 0.90));
        // Clear sky-blue rippling water surface
        cyl('water', 0, 0.84, 0, 0.72, 0.02, 0.72, '#38bdf8');
        // 4. Little Hand-Carved Songbird Figurine Perched on the Basin Rim
        const bx = 0.34, bz = 0.10;
        round('stone', bx, 0.91, bz, 0.10, 0.08, 0.14, HP.shade(stoneCol, 0.85)); // bird body
        round('stone', bx + 0.02, 0.95, bz + 0.06, 0.06, 0.06, 0.06, HP.shade(stoneCol, 0.82)); // head
        part('cone', 'stone', bx + 0.03, 0.95, bz + 0.10, 0.03, 0.04, 0.03, '#f59e0b', true); // tiny beak
        boxRot('stone', bx - 0.02, 0.91, bz - 0.08, 0.03, 0.03, 0.08, 0.35, HP.shade(stoneCol, 0.80)); // tail

      } else if (/^firepit$/i.test(t)) {
        // Dry-Stacked Fieldstone Circular Fire Pit with Split Hardwood Logs & Glowing Fire Embers
        // 1. Stacked stone ring
        cyl('stone', 0, 0.22, 0, 0.92, 0.44, 0.92, color || '#64748b');
        cyl('dark', 0, 0.24, 0, 0.72, 0.42, 0.72, '#181b1e');                  // interior fire chamber
        // 2. Bed of glowing orange fire coals & split oak firewood logs
        cyl('glow', 0, 0.22, 0, 0.68, 0.06, 0.68, '#f97316');                  // glowing embers
        cyl('wood', -0.14, 0.30, 0.10, 0.10, 0.52, 0.10, '#78350f');           // log 1
        cyl('wood', 0.14, 0.30, -0.10, 0.10, 0.52, 0.10, '#78350f');          // log 2
        cyl('wood', 0, 0.36, 0, 0.09, 0.48, 0.09, '#451a03');                  // cross log
        round('glow', 0, 0.44, 0, 0.18, 0.24, 0.18, '#facc15');                // dancing fire flame

      } else if (/^swingset$/i.test(t)) {
        // Heavy Solid Cedar Timber A-Frame Backyard Swing Set (3x2 footprint, angled A-frame legs, steel corner brackets, horizontal spreader rungs, 2 belt swings)
        const timberCol = color || '#b45309';
        // 1. Dual Angled A-Frame End Assemblies (left at sx=-0.42, right at sx=0.42)
        for (const sx of [-0.42, 0.42]) {
          // Front and rear angled cedar legs meeting at the top apex (z=0, y=0.94)
          boxSlope('wood', sx, 0.02, -0.38, sx, 0.94, 0, 0.07, 0.08, timberCol); // front leg
          boxSlope('wood', sx, 0.02, 0.38, sx, 0.94, 0, 0.07, 0.08, timberCol);  // rear leg
          // Ground anchor boots
          box('dark', sx, 0.015, -0.38, 0.09, 0.03, 0.10, '#181b1e');
          box('dark', sx, 0.015, 0.38, 0.09, 0.03, 0.10, '#181b1e');
          // Horizontal cedar A-frame spreader rung at mid-height
          box('wood', sx, 0.38, 0, 0.06, 0.07, 0.46, HP.shade(timberCol, 0.92));
          // Heavy forest green powder-coated steel A-bracket clamping the apex
          box('metal', sx, 0.92, 0, 0.08, 0.14, 0.22, '#1e3a1e');
          cyl('metal', sx, 0.95, -0.06, 0.02, 0.03, 0.02, '#cbd5e1'); // lag bolt
          cyl('metal', sx, 0.95, 0.06, 0.02, 0.03, 0.02, '#cbd5e1');
        }
        // Heavy 4x6 cedar top ridge beam extending past both A-brackets
        box('wood', 0, 0.95, 0, 0.98, 0.10, 0.10, timberCol);
        // 2. Two Commercial Heavy-Duty Belt Swings with Coated Steel Chains
        const chW = 1.6 / width, chD = 1.6 / depth;
        for (const bx of [-0.20, 0.20]) {
          // Cast iron swing hanger brackets clamped onto top ridge beam
          box('metal', bx - 0.09, 0.92, 0, 0.035, 0.06, 0.11, '#181b1e');
          box('metal', bx + 0.09, 0.92, 0, 0.035, 0.06, 0.11, '#181b1e');
          // Sturdy isotropic zinc-plated steel chains descending smoothly to seat clips
          cyl('metal', bx - 0.09, 0.59, 0, chW, 0.62, chD, '#d4d9e0');
          cyl('metal', bx + 0.09, 0.59, 0, chW, 0.62, chD, '#d4d9e0');
          // Flexible molded rubber sling seat with curved contour and hardware clips
          box('dark', bx, 0.26, 0, 0.22, 0.04, 0.14, '#0f172a');
          box('dark', bx, 0.28, 0.055, 0.22, 0.035, 0.035, '#1e293b'); // curved back lip
          box('dark', bx, 0.28, -0.055, 0.22, 0.035, 0.035, '#1e293b'); // curved front lip
          box('metal', bx - 0.09, 0.29, 0, chW * 1.4, 0.035, chD * 1.8, '#cbd5e1');
          box('metal', bx + 0.09, 0.29, 0, chW * 1.4, 0.035, chD * 1.8, '#cbd5e1');
        }

      
      } else if (/^clothesline$/i.test(t)) {
        // Rotary / T-Post Outdoor Clothesline Drying Rack with Hanging Laundry (2x1 footprint, height 36px)
        // 1. Dual galvanized steel T-posts at left and right edges
        cyl('metal', -0.44, 0.50, 0, 0.04, 0.98, 0.04, '#64748b');
        cyl('metal', 0.44, 0.50, 0, 0.04, 0.98, 0.04, '#64748b');
        cylZ('metal', -0.44, 0.03, 0, 0.04, 0.06, 0.54, '#475569'); // base feet
        cylZ('metal', 0.44, 0.03, 0, 0.04, 0.06, 0.54, '#475569');
        // Top T-crossbar arms across Z
        cylZ('metal', -0.44, 0.96, 0, 0.03, 0.03, 0.60, '#64748b');
        cylZ('metal', 0.44, 0.96, 0, 0.03, 0.03, 0.60, '#64748b');
        // 3 Parallel tensioned clotheslines running along X
        for (const lz of [-0.22, 0, 0.22]) {
          cylX('metal', 0, 0.96, lz, 0.88, 0.008, 0.008, '#cbd5e1');
        }
        // Colorful laundry sheets, towels and garments hung over rungs
        box('fabric', -0.26, 0.64, -0.22, 0.22, 0.58, 0.02, '#f8fafc'); // crisp white linen
        box('fabric', 0.16, 0.68, -0.22, 0.24, 0.50, 0.02, '#93c5fd');  // soft pastel blue towel
        box('fabric', -0.12, 0.66, 0.22, 0.20, 0.54, 0.02, '#fef08a');  // summer yellow shirt
        box('fabric', 0.24, 0.62, 0.22, 0.18, 0.62, 0.02, '#f472b6');   // blush pink towel
        box('fabric', 0.00, 0.72, 0.00, 0.18, 0.44, 0.02, color || '#a8b8c8');

      } else if (/^wheelbarrow$/i.test(t)) {
        // Heavy-Duty Contractor Wheelbarrow with Potting Soil (1x2 footprint, height 16px)
        // 1. Front pneumatic wheel & axle bracket (+Z) (true circular tire)
        wheelX('dark', 0, 0.32, 0.38, 0.08, 9.9, '#181b1e');
        wheelX('metal', 0, 0.32, 0.38, 0.09, 4.5, '#cbd5e1');
        box('metal', 0, 0.32, 0.38, 0.14, 0.04, 0.06, '#334155');
        // 2. Tubular steel chassis extending back to wooden handles (-Z)
        boxSlope('metal', -0.16, 0.28, 0.36, -0.24, 0.55, -0.42, 0.04, 0.04, '#475569');
        boxSlope('metal', 0.16, 0.28, 0.36, 0.24, 0.55, -0.42, 0.04, 0.04, '#475569');
        cylZ('dark', -0.24, 0.55, -0.44, 0.05, 0.05, 0.10, '#0f172a'); // grip handles
        cylZ('dark', 0.24, 0.55, -0.44, 0.05, 0.05, 0.10, '#0f172a');
        // Dual resting kickstand legs
        box('metal', -0.18, 0.16, -0.15, 0.03, 0.30, 0.03, '#334155');
        box('metal', 0.18, 0.16, -0.15, 0.03, 0.30, 0.03, '#334155');
        // 3. Heavy gauge steel hopper / tray
        box('metal', 0, 0.38, 0.02, 0.54, 0.14, 0.64, color || '#5d8a5d');
        box('metal', -0.30, 0.52, 0.02, 0.06, 0.22, 0.68, HP.shade(color || '#5d8a5d', 0.9));
        box('metal', 0.30, 0.52, 0.02, 0.06, 0.22, 0.68, HP.shade(color || '#5d8a5d', 0.9));
        box('metal', 0, 0.50, 0.35, 0.58, 0.22, 0.06, HP.shade(color || '#5d8a5d', 0.9));
        box('metal', 0, 0.56, -0.28, 0.58, 0.26, 0.06, HP.shade(color || '#5d8a5d', 0.85));
        // Rich dark loam potting soil crowned inside tray
        round('dark', 0, 0.48, 0.02, 0.50, 0.16, 0.58, '#3d2516');

      } else if (/^compost$/i.test(t)) {
        // Cedar Slatted Garden Compost Bin with Aeration Gaps & Hinged Lid (1x1 footprint, height 24px)
        // 1. 4 Corner timber posts
        for (const [cx, cz] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) {
          box('wood', cx, 0.48, cz, 0.08, 0.94, 0.08, HP.shade(color || '#4a3f34', 0.8));
        }
        // 2. 4 Tiers of ventilated wooden slats
        for (let s = 0; s < 4; s++) {
          const sy = 0.14 + s * 0.22;
          box('wood', 0, sy, -0.42, 0.86, 0.14, 0.04, color || '#4a3f34');
          box('wood', 0, sy, 0.42, 0.86, 0.14, 0.04, color || '#4a3f34');
          box('wood', -0.42, sy, 0, 0.04, 0.14, 0.86, color || '#4a3f34');
          box('wood', 0.42, sy, 0, 0.04, 0.14, 0.86, color || '#4a3f34');
        }
        // 3. Hinged top lid with handle
        box('wood', 0, 0.94, 0, 0.92, 0.06, 0.92, HP.shade(color || '#4a3f34', 1.15));
        box('dark', 0, 0.98, 0.32, 0.22, 0.03, 0.04, '#181b1e');
        // Interior rich organic compost & green clippings
        box('dark', 0, 0.52, 0, 0.78, 0.52, 0.78, '#2e1c0c');
        box('foliage', 0.10, 0.80, -0.10, 0.30, 0.04, 0.30, '#4d7c0f');

      } else if (/^mower$/i.test(t)) {
        // High-Wheel Walk-Behind Gas Rotary Lawn Mower with Grass Catcher (1x1 footprint, height 22px)
        // 1. 4 Durable rubber lawn wheels (true circular wheels)
        for (const [wx, wz] of [[-0.38, -0.28], [0.38, -0.28], [-0.38, 0.28], [0.38, 0.28]]) {
          wheelX('dark', wx, 0.18, wz, 0.08, 7.5, '#181b1e');
          wheelX('metal', wx, 0.18, wz, 0.09, 3.2, '#e2e8f0');
        }
        // 2. Heavy stamped steel cutting deck chassis
        box('metal', 0, 0.22, 0, 0.72, 0.16, 0.78, color || '#5d8a5d');
        // 3. OHV 4-stroke engine housing & recoil starter hub
        cyl('dark', 0, 0.40, -0.04, 0.44, 0.24, 0.44, '#1e293b');
        cyl('metal', 0, 0.54, -0.04, 0.24, 0.05, 0.24, '#cbd5e1');
        box('dark', 0.16, 0.54, 0.10, 0.06, 0.03, 0.04, '#ef4444'); // starter grip
        // Rear woven grass collection catcher bag
        box('fabric', 0, 0.32, -0.38, 0.54, 0.26, 0.34, '#1c1f24');
        // Angled tubular steel handle with safety operator control bail
        boxSlope('metal', -0.24, 0.28, -0.10, -0.22, 0.88, -0.46, 0.03, 0.03, '#475569');
        boxSlope('metal', 0.24, 0.28, -0.10, 0.22, 0.88, -0.46, 0.03, 0.03, '#475569');
        cylX('dark', 0, 0.88, -0.46, 0.48, 0.045, 0.045, '#0f172a');
        cylX('metal', 0, 0.90, -0.44, 0.42, 0.02, 0.02, '#dc2626');

      } else if (/^rainbarrel$/i.test(t)) {
        // High-Capacity Ribbed Garden Rain Barrel with Brass Spigot (1x1 footprint, height 26px)
        // 1. Dual stone foundation blocks
        for (const cx of [-0.24, 0.24]) {
          box('stone', cx, 0.04, 0, 0.20, 0.08, 0.60, '#475569');
        }
        // 2. Ribbed collection drum body
        cyl('ceramic', 0, 0.48, 0, 0.76, 0.88, 0.76, color || '#4a6b8a');
        for (const rb of [-0.18, 0.18]) {
          cyl('ceramic', 0, 0.48 + rb, 0, 0.80, 0.06, 0.80, HP.shade(color || '#4a6b8a', 0.9));
        }
        // Top inlet lid with fine mesh screen
        cyl('dark', 0, 0.93, 0, 0.78, 0.05, 0.78, '#1e293b');
        cyl('metal', 0, 0.94, 0, 0.38, 0.02, 0.38, '#94a3b8');
        // Solid brass front spigot / garden hose tap (+Z)
        cylZ('metal', 0, 0.20, 0.39, 0.04, 0.04, 0.08, '#c9a44e');
        cyl('metal', 0, 0.24, 0.41, 0.06, 0.02, 0.02, '#dc2626');

      } else if (/^potting$/i.test(t)) {
        // Solid Cedar Outdoor Potting Bench with Soil Basin & Terracotta Pots (2x1 footprint, height 32px)
        // 1. Sturdy cedar timber legs
        for (const [lx, lz] of [[-0.42, -0.38], [0.42, -0.38], [-0.42, 0.38], [0.42, 0.38]]) {
          box('wood', lx, 0.46, lz, 0.06, 0.90, 0.06, HP.shade(color || '#8a6844', 0.85));
        }
        // Lower storage slatted shelf
        box('wood', 0, 0.18, 0, 0.90, 0.03, 0.82, color || '#8a6844');
        box('fabric', -0.25, 0.24, 0, 0.32, 0.10, 0.50, '#365314'); // potting soil sack
        // 2. Main slatted wooden countertop
        box('wood', 0, 0.68, 0, 0.94, 0.04, 0.86, color || '#8a6844');
        // Left side: galvanized soil sink tray
        box('metal', -0.24, 0.70, 0, 0.40, 0.08, 0.72, '#94a3b8');
        box('dark', -0.24, 0.72, 0, 0.36, 0.04, 0.68, '#3d2516');
        // Right side: 3 Terracotta flower pots with growing green herbs
        cyl('ceramic', 0.12, 0.76, -0.16, 0.18, 0.14, 0.18, '#c2410c');
        round('foliage', 0.12, 0.88, -0.16, 0.18, 0.14, 0.18, '#15803d');
        cyl('ceramic', 0.30, 0.75, -0.16, 0.14, 0.12, 0.14, '#9a3412');
        round('foliage', 0.30, 0.85, -0.16, 0.14, 0.12, 0.14, '#22c55e');
        cyl('ceramic', 0.22, 0.77, 0.18, 0.16, 0.16, 0.16, '#ea580c');
        round('foliage', 0.22, 0.90, 0.18, 0.16, 0.16, 0.16, '#16a34a');
        // Upper rear tool rail & hanging hand trowel
        box('wood', 0, 0.88, -0.38, 0.92, 0.04, 0.04, color || '#8a6844');
        box('metal', -0.10, 0.82, -0.36, 0.03, 0.12, 0.02, '#cbd5e1');

      } else if (/^wbins$/i.test(t)) {
        // Dual Commercial Curbside Wheelie Bins (Recycle & Organics, 1x1 footprint, height 26px)
        // Bin 1: Forest Green Compost / Organics
        box('ceramic', -0.22, 0.44, 0, 0.36, 0.78, 0.76, '#15803d');
        box('ceramic', -0.22, 0.85, 0, 0.38, 0.06, 0.78, '#16a34a');
        // Bin 2: Royal Blue Recycling
        box('ceramic', 0.22, 0.44, 0, 0.36, 0.78, 0.76, '#1d4ed8');
        box('ceramic', 0.22, 0.85, 0, 0.38, 0.06, 0.78, '#2563eb');
        // Rubber wheels & transport handles
        for (const bx of [-0.22, 0.22]) {
          cylX('dark', bx - 0.14, 0.08, -0.34, 0.06, 0.14, 0.14, '#181b1e');
          cylX('dark', bx + 0.14, 0.08, -0.34, 0.06, 0.14, 0.14, '#181b1e');
          cylX('dark', bx, 0.82, -0.38, 0.24, 0.04, 0.04, '#181b1e');
        }

      } else if (/^shed$/i.test(t)) {
        // Cedar Tongue-and-Groove Garden Tool Shed (3x2 footprint, height 52px, gabled roof)
        // 1. Shiplap timber walls
        box('wood', 0, 0.42, 0, 0.94, 0.78, 0.92, color || '#8a6844');
        // 2. Gabled pitched shingle roof
        boxSlope('wood', -0.48, 0.78, 0, 0, 0.98, 0, 0.04, 0.98, HP.shade(color || '#8a6844', 0.7));
        boxSlope('wood', 0.48, 0.78, 0, 0, 0.98, 0, 0.04, 0.98, HP.shade(color || '#8a6844', 0.7));
        // Double front entrance doors with black hardware
        box('wood', -0.16, 0.40, 0.465, 0.28, 0.68, 0.02, HP.shade(color || '#8a6844', 1.15));
        box('wood', 0.16, 0.40, 0.465, 0.28, 0.68, 0.02, HP.shade(color || '#8a6844', 1.15));
        box('metal', -0.03, 0.40, 0.48, 0.02, 0.10, 0.02, '#181b1e', true);
        box('metal', 0.03, 0.40, 0.48, 0.02, 0.10, 0.02, '#181b1e', true);
        // Multi-pane framed side window
        box('glass', 0.36, 0.52, 0.465, 0.16, 0.24, 0.02, '#38bdf8');
        box('wood', 0.36, 0.52, 0.47, 0.18, 0.26, 0.01, '#f8fafc');

      } else if (/^growshelf$/i.test(t)) {
        // 3-Tier Indoor/Outdoor LED Nursery Plant Grow Shelf (2x1 footprint, height 44px)
        for (const [lx, lz] of [[-0.44, -0.38], [0.44, -0.38], [-0.44, 0.38], [0.44, 0.38]]) {
          box('metal', lx, 0.50, lz, 0.04, 0.96, 0.04, '#1e293b', true);
        }
        for (const sy of [0.20, 0.52, 0.84]) {
          box('metal', 0, sy, 0, 0.92, 0.03, 0.84, '#64748b', true);
          box('glow', 0, sy - 0.04, 0, 0.84, 0.015, 0.06, '#f43f5e'); // full-spectrum grow light
          box('dark', 0, sy + 0.03, 0, 0.88, 0.04, 0.78, '#111827');  // seedling flats
          box('foliage', 0, sy + 0.07, 0, 0.84, 0.04, 0.74, '#22c55e'); // lush microgreens
        }

      } else if (/^seedlings$/i.test(t)) {
        // Nursery Seed Starting Flat with Transparent Vented Humidity Dome (1x1 footprint, height 12px)
        box('dark', 0, 0.15, 0, 0.88, 0.20, 0.88, '#111827');
        box('dark', 0, 0.26, 0, 0.84, 0.04, 0.84, '#3d2516');
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            round('foliage', -0.30 + c * 0.20, 0.32, -0.30 + r * 0.20, 0.06, 0.06, 0.06, '#4ade80');
          }
        }
        box('glass', 0, 0.60, 0, 0.86, 0.50, 0.86, '#e0f2fe');
        cyl('dark', -0.20, 0.86, 0, 0.08, 0.02, 0.08, '#1e293b');
        cyl('dark', 0.20, 0.86, 0, 0.08, 0.02, 0.08, '#1e293b');

      } else if (/^firewood$/i.test(t)) {
        // Heavy Tubular Steel Firewood Storage Rack with Split Logs (1x1 footprint, height 22px)
        box('metal', 0, 0.04, 0, 0.88, 0.04, 0.60, '#1e293b', true);
        box('metal', -0.42, 0.44, 0, 0.04, 0.80, 0.04, '#1e293b', true);
        box('metal', 0.42, 0.44, 0, 0.04, 0.80, 0.04, '#1e293b', true);
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 4; col++) {
            const lx = -0.30 + col * 0.20, ly = 0.18 + row * 0.26;
            cylZ('wood', lx, ly, 0, 0.16, 0.16, 0.82, (row + col) % 2 ? '#78350f' : '#b45309');
            cylZ('dark', lx, ly, 0.415, 0.17, 0.17, 0.01, '#451a03');
          }
        }

      } else if (/^garch$/i.test(t)) {
        // Rose Garden Walk-Through Trellis Archway with Climbing Flora (2x1 footprint, height 44px)
        box('wood', -0.42, 0.50, 0, 0.08, 0.98, 0.60, color || '#8a6844');
        box('wood', 0.42, 0.50, 0, 0.08, 0.98, 0.60, color || '#8a6844');
        cylX('wood', 0, 0.96, 0, 0.94, 0.08, 0.64, color || '#8a6844');
        box('foliage', -0.42, 0.55, 0, 0.14, 0.80, 0.64, '#15803d');
        box('foliage', 0.42, 0.55, 0, 0.14, 0.80, 0.64, '#15803d');
        round('foliage', -0.42, 0.80, 0.32, 0.08, 0.08, 0.08, '#f43f5e');
        round('foliage', 0.42, 0.70, -0.30, 0.08, 0.08, 0.08, '#fb7185');
        round('foliage', 0, 0.98, 0.20, 0.09, 0.09, 0.09, '#f43f5e');

      } else if (/^mailbox$/i.test(t)) {
        // American Rural Curbside Mailbox with Working Outgoing Flag (1x1 footprint, height 28px)
        box('wood', 0, 0.34, 0, 0.12, 0.68, 0.12, '#451a03');
        boxSlope('wood', 0, 0.46, -0.15, 0, 0.65, 0.15, 0.06, 0.06, '#451a03');
        box('metal', 0, 0.72, 0.05, 0.34, 0.18, 0.64, color || '#a05050');
        cylZ('metal', 0, 0.81, 0.05, 0.34, 0.18, 0.64, color || '#a05050');
        cylZ('metal', 0, 0.81, 0.375, 0.32, 0.16, 0.02, '#181b1e');
        box('metal', 0, 0.81, 0.39, 0.06, 0.02, 0.02, '#cbd5e1');
        box('metal', 0.18, 0.82, 0.15, 0.015, 0.18, 0.02, '#dc2626');
        box('metal', 0.18, 0.90, 0.10, 0.015, 0.06, 0.10, '#dc2626');

      } else if (/^trampoline$/i.test(t)) {
        // 14-Foot Circular Backyard Trampoline with Heavy W-Legs & Full Safety Enclosure Net (2x2 footprint, height 44px)
        const padCol = color || '#2563eb';
        // 1. Heavy galvanized steel tubular frame with 6 ground-support legs
        for (let a = 0; a < 6; a++) {
          const ang = a * (Math.PI / 3);
          const lx = Math.cos(ang) * 0.44, lz = Math.sin(ang) * 0.44;
          // Vertical support leg from ground (y=0) to frame rim (y=0.34)
          cyl('metal', lx, 0.17, lz, 0.045, 0.34, 0.045, '#cbd5e1');
          // Rubber foot boot on ground
          cyl('dark', lx, 0.02, lz, 0.065, 0.04, 0.065, '#0f172a');
          // Safety net enclosure pole rising from frame (y=0.34) up to net top (y=0.96)
          cyl('metal', lx * 1.02, 0.65, lz * 1.02, 0.035, 0.62, 0.035, '#334155');
          round('dark', lx * 1.02, 0.97, lz * 1.02, 0.05, 0.04, 0.05, '#0f172a'); // top pole cap
        }
        // W-shape horizontal ground stabilizer bars connecting leg pairs (3 base bars)
        for (let w = 0; w < 3; w++) {
          const a1 = w * (2 * Math.PI / 3);
          const a2 = a1 + (Math.PI / 3);
          const x1 = Math.cos(a1) * 0.44, z1 = Math.sin(a1) * 0.44;
          const x2 = Math.cos(a2) * 0.44, z2 = Math.sin(a2) * 0.44;
          boxSlope('metal', x1, 0.02, z1, x2, 0.02, z2, 0.04, 0.04, '#94a3b8');
        }
        // 2. Heavy steel circular top frame ring & high-density foam spring safety pad
        cyl('metal', 0, 0.34, 0, 0.92, 0.04, 0.92, '#cbd5e1'); // steel frame ring
        cyl('fabric', 0, 0.36, 0, 0.96, 0.05, 0.96, padCol);   // perimeter spring cover pad
        cyl('fabric', 0, 0.33, 0, 0.98, 0.05, 0.98, HP.shade(padCol, 0.85)); // outer protective skirt
        // 3. Central UV-resistant high-bounce black woven jumping mat
        cyl('dark', 0, 0.365, 0, 0.74, 0.015, 0.74, '#090b0e'); // woven polypropylene mat
        cyl('glow', 0, 0.368, 0, 0.12, 0.005, 0.12, '#38bdf8'); // center target crest
        // 4. Fine-mesh transparent safety enclosure netting & yellow entrance zipper
        cyl('glass', 0, 0.66, 0, 0.90, 0.58, 0.90, '#1e293b'); // safety netting
        box('glow', 0, 0.65, 0.45, 0.02, 0.48, 0.015, '#eab308'); // yellow safety zipper

      } else if (/^poolfloat$/i.test(t)) {
        // Inflatable Ribbed Pool Lounge Mattress with Bolster Pillow (1x1 footprint, height 8px)
        for (let r = 0; r < 5; r++) {
          cylX('fabric', 0, 0.04, -0.36 + r * 0.18, 0.58, 0.08, 0.16, color || '#e8a0b8');
        }
        cylX('fabric', 0, 0.09, -0.38, 0.54, 0.12, 0.20, HP.shade(color || '#e8a0b8', 1.2));
        cyl('glass', 0.34, 0.05, 0.10, 0.12, 0.06, 0.12, '#38bdf8');

      } else if (/^lamppost$/i.test(t)) {
        // Ultra-Realistic Victorian Cast-Iron Gaslight Streetlamp Post with 4-Sided Coach Lantern
        // 1. Ornate octagonal cast-iron fluted pedestal base
        cyl('dark', 0, 0.04, 0, 0.42, 0.08, 0.42, color || '#1e293b');         // octagonal plinth
        cyl('dark', 0, 0.10, 0, 0.32, 0.08, 0.32, color || '#1e293b');         // lower pedestal flare
        cyl('dark', 0, 0.16, 0, 0.22, 0.06, 0.22, '#c9a44e');                  // brass relief accent ring
        // 2. Tapered fluted columnar post with lamplighter's ladder crossbar
        cyl('dark', 0, 0.52, 0, 0.10, 0.72, 0.10, color || '#1e293b');         // fluted iron column
        cylX('metal', 0, 0.82, 0, 0.46, 0.032, 0.032, '#c9a44e');              // brass ladder-rest crossbar
        round('metal', -0.23, 0.82, 0, 0.045, 0.045, 0.045, '#c9a44e');        // left crossbar acorn
        round('metal', 0.23, 0.82, 0, 0.045, 0.045, 0.045, '#c9a44e');         // right crossbar acorn
        // 3. Victorian 4-sided coach lantern carriage
        cyl('metal', 0, 0.87, 0, 0.16, 0.06, 0.16, '#c9a44e');                 // lantern brass pedestal
        box('dark', 0, 0.90, 0, 0.28, 0.03, 0.28, color || '#1e293b');         // lantern bottom frame
        // 4 Corner glass panes & framing
        box('glass', 0, 0.945, 0, 0.25, 0.10, 0.25, '#fef08a');                // seeded water glass
        cyl('glow', 0, 0.945, 0, 0.10, 0.09, 0.10, '#fef08a');                 // incandescent triple burner
        box('dark', 0, 0.985, 0, 0.30, 0.03, 0.30, color || '#1e293b');        // roof eaves
        // 4. Peaked copper vented chimney spire & brass acorn finial
        part('cone', 'metal', 0, 1.015, 0, 0.30, 0.06, 0.30, '#b45309');        // aged copper spire roof
        round('metal', 0, 1.055, 0, 0.05, 0.05, 0.05, '#c9a44e');              // top brass finial

      } else if (/^flagpole$/i.test(t)) {
        // Anodized Aluminum Yard Flagpole with Brass Finial & Woven Flag (1x1 footprint, height 60px)
        cyl('metal', 0, 0.04, 0, 0.24, 0.08, 0.24, '#94a3b8', true);
        cyl('metal', 0, 0.50, 0, 0.05, 0.96, 0.05, '#cbd5e1', true);
        round('metal', 0, 0.99, 0, 0.10, 0.10, 0.10, '#c9a44e', true);
        box('fabric', 0.24, 0.88, 0, 0.44, 0.20, 0.015, color || '#a03a3a');
        box('fabric', 0.24, 0.88, 0.005, 0.44, 0.06, 0.015, '#ffffff');

      } else if (/^acunit$/i.test(t)) {
        // Outdoor Split-System Air Conditioner Inverter Condenser (1x1 footprint, height 20px)
        box('stone', 0, 0.04, 0, 0.88, 0.08, 0.76, '#475569');
        box('metal', 0, 0.50, 0, 0.82, 0.84, 0.70, color || '#c9ced4', true);
        cyl('dark', 0, 0.925, 0, 0.56, 0.02, 0.56, '#1e293b');
        cyl('metal', 0, 0.915, 0, 0.50, 0.01, 0.50, '#64748b', true);
        box('dark', 0, 0.50, 0.355, 0.76, 0.74, 0.01, '#334155');
        cylZ('metal', 0.32, 0.30, 0.365, 0.04, 0.04, 0.04, '#c9a44e', true);

      } else if (/^satellite$/i.test(t)) {
        // Digital High-Gain Parabolic Satellite Dish on Roof J-Mount (1x1 footprint, height 24px)
        box('metal', 0, 0.05, 0, 0.26, 0.06, 0.26, '#334155', true);
        boxSlope('metal', 0, 0.06, 0, 0, 0.50, 0.16, 0.05, 0.05, '#475569', true);
        cylZ('metal', 0, 0.65, 0.10, 0.72, 0.72, 0.06, color || '#dfe5ea', true);
        boxSlope('metal', 0, 0.48, 0.12, 0, 0.72, 0.40, 0.025, 0.025, '#334155', true);
        cylZ('dark', 0, 0.72, 0.42, 0.10, 0.10, 0.12, '#0f172a');

      } else if (/^solarpanel$/i.test(t)) {
        // Tilted High-Efficiency Monocrystalline Photovoltaic Array (3x2 footprint, height 18px)
        for (const rx of [-0.40, 0, 0.40]) {
          boxSlope('metal', rx, 0.08, 0.40, rx, 0.38, -0.40, 0.04, 0.04, '#cbd5e1', true);
        }
        for (const c of [-0.32, 0, 0.32]) {
          boxSlope('glass', c, 0.18, 0.40, c, 0.48, -0.40, 0.28, 0.03, color || '#1e2e4a');
          boxSlope('metal', c, 0.19, 0.40, c, 0.49, -0.40, 0.005, 0.005, '#94a3b8', true);
        }

      } else if (/^diveboard$/i.test(t)) {
        // Residential Pool Springboard with Stainless Steel Base (1x2 footprint, height 18px)
        box('metal', -0.22, 0.24, -0.40, 0.06, 0.48, 0.06, '#cbd5e1', true);
        box('metal', 0.22, 0.24, -0.40, 0.06, 0.48, 0.06, '#cbd5e1', true);
        cylX('metal', 0, 0.36, -0.05, 0.54, 0.08, 0.08, '#94a3b8', true);
        boxSlope('ceramic', 0, 0.50, -0.42, 0, 0.40, 0.45, 0.48, 0.04, color || '#f8fafc');
        boxSlope('dark', 0, 0.525, -0.40, 0, 0.425, 0.43, 0.42, 0.005, '#0ea5e9');

      } else if (/^outshower$/i.test(t)) {
        // Architectural Teak Deck Outdoor Privacy Rain Shower (1x1 footprint, height 48px)
        box('wood', 0, 0.04, 0, 0.88, 0.08, 0.88, '#78350f');
        box('wood', 0, 0.50, -0.42, 0.88, 0.96, 0.04, color || '#8a6844');
        cyl('metal', 0, 0.52, -0.38, 0.03, 0.70, 0.03, '#cbd5e1', true);
        box('metal', -0.08, 0.48, -0.36, 0.06, 0.03, 0.03, '#cbd5e1', true);
        box('metal', 0.08, 0.48, -0.36, 0.06, 0.03, 0.03, '#cbd5e1', true);
        cylZ('metal', 0, 0.94, -0.22, 0.025, 0.025, 0.32, '#cbd5e1', true);
        cyl('metal', 0, 0.91, -0.10, 0.28, 0.02, 0.28, '#cbd5e1', true);


      } else if (/^topiary$/i.test(t)) {
        // Manicured Triple-Sphere Boxwood Topiary in Classical Urn (1x1 footprint, height 32px)
        box('stone', 0, 0.03, 0, 0.52, 0.06, 0.52, '#9a3412');
        cyl('ceramic', 0, 0.16, 0, 0.48, 0.32, 0.48, '#c2410c');
        cyl('wood', 0, 0.42, 0, 0.06, 0.40, 0.06, '#451a03');
        round('foliage', 0, 0.44, 0, 0.44, 0.28, 0.44, color || '#15803d');
        round('foliage', 0, 0.66, 0, 0.34, 0.24, 0.34, color || '#15803d');
        round('foliage', 0, 0.85, 0, 0.24, 0.20, 0.24, color || '#15803d');

      } else if (/^veggie$/i.test(t)) {
        // Raised Timber Kitchen Garden Vegetable Patch with Root & Leafy Greens (3x1 footprint, height 12px)
        box('wood', 0, 0.22, 0, 0.96, 0.40, 0.90, color || '#78350f');
        box('dark', 0, 0.38, 0, 0.90, 0.10, 0.84, '#2e1c0c');
        for (const lz of [-0.24, 0, 0.24]) {
          round('foliage', -0.30, 0.52, lz, 0.16, 0.14, 0.16, '#22c55e'); // cabbage
        }
        for (const cz of [-0.30, -0.10, 0.10, 0.30]) {
          cyl('ceramic', 0, 0.46, cz, 0.06, 0.06, 0.06, '#ea580c'); // carrots
          round('foliage', 0, 0.56, cz, 0.12, 0.16, 0.12, '#16a34a');
        }
        for (const rz of [-0.24, 0, 0.24]) {
          round('foliage', 0.30, 0.54, rz, 0.16, 0.14, 0.16, '#581c87'); // eggplant
        }

      } else if (/^gnome$/i.test(t)) {
        // Hand-Painted Ceramic Garden Gnome with Pointed Red Hat (1x1 footprint, height 16px)
        cyl('foliage', 0, 0.04, 0, 0.44, 0.08, 0.44, '#15803d');
        box('dark', -0.06, 0.14, 0, 0.08, 0.14, 0.12, '#181b1e');
        box('dark', 0.06, 0.14, 0, 0.08, 0.14, 0.12, '#181b1e');
        cyl('fabric', 0, 0.28, 0, 0.26, 0.18, 0.24, '#1d4ed8');
        cyl('fabric', 0, 0.46, 0, 0.32, 0.24, 0.28, color || '#dc2626');
        box('dark', 0, 0.42, 0, 0.34, 0.04, 0.30, '#451a03');
        box('metal', 0, 0.42, 0.15, 0.06, 0.05, 0.01, '#c9a44e', true);
        round('fabric', 0, 0.58, 0.06, 0.26, 0.20, 0.18, '#f8fafc');
        round('ceramic', 0, 0.62, 0.14, 0.06, 0.06, 0.06, '#fca5a5');
        part('cone', 'fabric', 0, 0.82, -0.02, 0.26, 0.36, 0.26, color || '#dc2626');

      } else if (/^goal$/i.test(t)) {
        // Backyard Regulation Steel Soccer Goal with Depth Netting (3x2 footprint, height 36px)
        cyl('metal', -0.46, 0.50, 0.42, 0.03, 0.98, 0.03, '#f8fafc', true);
        cyl('metal', 0.46, 0.50, 0.42, 0.03, 0.98, 0.03, '#f8fafc', true);
        cylX('metal', 0, 0.98, 0.42, 0.94, 0.03, 0.03, '#f8fafc', true);
        cylZ('metal', -0.46, 0.03, 0, 0.03, 0.03, 0.84, '#f8fafc', true);
        cylZ('metal', 0.46, 0.03, 0, 0.03, 0.03, 0.84, '#f8fafc', true);
        cylX('metal', 0, 0.03, -0.42, 0.94, 0.03, 0.03, '#f8fafc', true);
        boxSlope('metal', -0.46, 0.98, 0.42, -0.46, 0.03, -0.42, 0.025, 0.025, '#cbd5e1', true);
        boxSlope('metal', 0.46, 0.98, 0.42, 0.46, 0.03, -0.42, 0.025, 0.025, '#cbd5e1', true);
        box('glass', 0, 0.50, -0.42, 0.92, 0.94, 0.01, '#e2e8f0');

      } else if (/^volleyball$/i.test(t)) {
        // Lawn Tournament Volleyball Net with Ground Anchors & Ball (3x1 footprint, height 42px)
        cyl('metal', -0.46, 0.50, 0, 0.04, 0.98, 0.04, '#eab308', true);
        cyl('metal', 0.46, 0.50, 0, 0.04, 0.98, 0.04, '#eab308', true);
        cyl('metal', -0.46, 0.03, 0, 0.16, 0.05, 0.16, '#1e293b', true);
        cyl('metal', 0.46, 0.03, 0, 0.16, 0.05, 0.16, '#1e293b', true);
        cylX('fabric', 0, 0.95, 0, 0.90, 0.03, 0.03, '#ffffff');
        cylX('fabric', 0, 0.65, 0, 0.90, 0.03, 0.03, '#ffffff');
        box('glass', 0, 0.80, 0, 0.90, 0.30, 0.01, '#1e293b');
        round('fabric', 0.15, 0.12, 0.15, 0.22, 0.22, 0.22, '#f8fafc');
        cyl('fabric', 0.15, 0.12, 0.15, 0.23, 0.04, 0.23, '#3b82f6');

      } else if (/^skateramp$/i.test(t)) {
        // High-Performance Backyard Skatelite Quarterpipe with Exposed 2x4 Timber Framing, Steel Coping, Platform & Skateboard (2x1 footprint, height 24px)
        const rampSurface = color || '#71717a';
        const timberDeck = '#d97706';
        const timberDark = '#78350f';
        const studCol = '#92400e';
        const steelCoping = '#f8fafc';
        const railCol = '#334155';

        // Aspect ratio helpers: width=61px, height=24px, depth=29px
        const wxToHy = 61 / 24; // 2.542
        const wxToDz = 61 / 29; // 2.103
        const hyToDz = 24 / 29; // 0.828

        // 1. Galvanized Ground Entry Toe Plate (beveled flush transition threshold)
        boxSlope('metal', -0.47, 0.005, 0, -0.41, 0.022, 0, 0.015, 0.94, '#94a3b8');
        // Countersunk flush mounting rivets along toe plate
        for (const rz of [-0.35, -0.18, 0, 0.18, 0.35]) {
          cyl('metal', -0.44, 0.016, rz, 0.016, 0.01, 0.016 * wxToDz, '#cbd5e1');
        }

        // 2. Silky-Smooth 7-Segment Circular Quarter-Pipe Transition Arc
        // Arc points from ground entry to coping lip (radius ~0.61, ~78 deg vert sweep)
        const arcPts = [
          { x: -0.415, y: 0.022 },
          { x: -0.301, y: 0.043 },
          { x: -0.187, y: 0.104 },
          { x: -0.082, y: 0.203 },
          { x:  0.011, y: 0.336 },
          { x:  0.087, y: 0.498 },
          { x:  0.144, y: 0.683 },
          { x:  0.180, y: 0.880 }
        ];

        // Render the smooth Skatelite riding surface sheets
        for (let i = 0; i < arcPts.length - 1; i++) {
          const p0 = arcPts[i], p1 = arcPts[i + 1];
          boxSlope('wood', p0.x, p0.y, 0, p1.x, p1.y, 0, 0.032, 0.93, rampSurface);
        }

        // 3. Authentic 2x4 Timber Framing & Curved Stringers (left and right at z = -0.46, +0.46)
        for (const sz of [-0.46, 0.46]) {
          // Bottom 2x4 ground sill plate running from toe plate to rear post
          box('wood', 0.03, 0.015, sz, 0.88, 0.03, 0.035, timberDark);

          // Curved 2x6 transition stringers along the arc
          for (let i = 0; i < arcPts.length - 1; i++) {
            const p0 = arcPts[i], p1 = arcPts[i + 1];
            boxSlope('wood', p0.x, p0.y - 0.02, sz, p1.x, p1.y - 0.02, sz, 0.045, 0.035, timberDark);
          }

          // Vertical 2x4 framing studs supporting the curve from the sill plate
          for (let i = 1; i < arcPts.length - 1; i++) {
            const pt = arcPts[i];
            const studH = Math.max(0.04, pt.y - 0.03);
            box('wood', pt.x, studH / 2 + 0.015, sz, 0.028, studH, 0.032, studCol);
          }

          // Platform side perimeter framing joists (x = 0.19 to 0.47)
          box('wood', 0.33, 0.85, sz, 0.28, 0.04, 0.035, timberDark);
          // Platform diagonal structural X-brace
          boxSlope('wood', 0.19, 0.05, sz, 0.47, 0.83, sz, 0.028, 0.03, studCol);
          boxSlope('wood', 0.19, 0.83, sz, 0.47, 0.05, sz, 0.028, 0.03, studCol);
        }

        // Horizontal cross joists under transition sheet
        for (let i = 1; i < arcPts.length - 1; i += 2) {
          const pt = arcPts[i];
          box('wood', pt.x, pt.y - 0.025, 0, 0.03, 0.03, 0.88, timberDark);
        }

        // 4. Heavy-Gauge Tubular Steel Coping Pipe & Coping Reveal
        // Coping diameter: 2.2px in both X and Y
        const copW = 0.036;
        const copH = copW * wxToHy; // 0.0915
        // Sub-coping solid timber blocking header to prevent any light gap
        box('wood', 0.185, 0.86, 0, 0.045, 0.06, 0.92, timberDark);
        cylZ('metal', 0.185, 0.895, 0, copW, copH, 0.94, steelCoping);
        // Welded end caps
        cylZ('metal', 0.185, 0.895, -0.47, copW * 1.05, copH * 1.05, 0.016, '#cbd5e1');
        cylZ('metal', 0.185, 0.895,  0.47, copW * 1.05, copH * 1.05, 0.016, '#cbd5e1');

        // 5. Standing Observation Deck & Framing
        // 4 Sturdy 4x4 Corner Framing Posts (posts from ground to deck at y=0.86)
        for (const px of [0.19, 0.47]) {
          for (const pz of [-0.45, 0.45]) {
            box('wood', px, 0.43, pz, 0.038, 0.86, 0.038 * wxToDz, timberDark);
          }
        }
        // Rear framing cross joists
        box('wood', 0.47, 0.85, 0, 0.035, 0.04, 0.88, timberDark);
        box('wood', 0.47, 0.015, 0, 0.035, 0.03, 0.88, timberDark);

        // Individual treated timber decking planks with realistic expansion reveals
        for (const px of [0.235, 0.335, 0.435]) {
          box('wood', px, 0.875, 0, 0.09, 0.022, 0.92, timberDeck);
        }

        // Rear climbing access rungs on back wall so skaters can climb onto the deck
        for (const ry of [0.22, 0.44, 0.66]) {
          cylZ('metal', 0.49, ry, 0, 0.022, 0.022 * wxToHy, 0.40, '#94a3b8');
        }

        // 6. Sleek Skatepark Safety Guard Railing
        // Upright corner stanchions (h = 0.56, circular cross section)
        const railPostW = 0.022;
        const railPostD = railPostW * wxToDz;
        for (const rz of [-0.44, 0.44]) {
          cyl('metal', 0.47, 1.15, rz, railPostW, 0.56, railPostD, railCol);
          cyl('metal', 0.20, 1.15, rz, railPostW, 0.56, railPostD, railCol);
        }
        // Top safety handrails (h = 1.42)
        cylZ('metal', 0.47, 1.42, 0, railPostW, railPostW * wxToHy, 0.90, '#64748b'); // back rail
        cylX('metal', 0.335, 1.42, -0.44, 0.27, 0.022, 0.022 * hyToDz, '#64748b'); // left rail
        cylX('metal', 0.335, 1.42,  0.44, 0.27, 0.022, 0.022 * hyToDz, '#64748b'); // right rail
        // Mid-height knee safety rails (h = 1.14)
        cylZ('metal', 0.47, 1.14, 0, 0.016, 0.016 * wxToHy, 0.90, railCol);
        cylX('metal', 0.335, 1.14, -0.44, 0.27, 0.016, 0.016 * hyToDz, railCol);
        cylX('metal', 0.335, 1.14,  0.44, 0.27, 0.016, 0.016 * hyToDz, railCol);
        // Deck safety kickplate at back
        box('wood', 0.47, 0.905, 0, 0.02, 0.045, 0.88, timberDark);

        // 7. Pro 7-Ply Skateboard resting on the deck
        // Canadian maple deck with black griptape
        box('dark', 0.33, 0.902, -0.10, 0.075, 0.012, 0.26, '#181b20');
        // Kicked up nose & tail
        box('dark', 0.33, 0.908, -0.24, 0.072, 0.012, 0.04, '#181b20');
        box('dark', 0.33, 0.908,  0.04, 0.072, 0.012, 0.04, '#181b20');
        // Cast aluminum trucks
        box('metal', 0.33, 0.888, -0.20, 0.055, 0.016, 0.02, '#cbd5e1');
        box('metal', 0.33, 0.888, -0.00, 0.055, 0.016, 0.02, '#cbd5e1');
        // Bright neon pink skate wheels
        cylX('ceramic', 0.33, 0.886, -0.20, 0.075, 0.018, 0.018 * hyToDz, '#ec4899');
        cylX('ceramic', 0.33, 0.886, -0.00, 0.075, 0.018, 0.018 * hyToDz, '#ec4899');

      } else if (/^slide$/i.test(t)) {
        // Commercial Backyard Wave Slide with Angled Safety Ladder, Staging Platform & Ergonomic Scoop Chute (1x2 footprint, height 42px)
        const mapCol = {
          '#e08040': '#ea580c', // rich vivid playground tangerine orange
          '#e8c832': '#f59e0b', // sunny playground golden yellow
          '#4a8ab0': '#0284c7'  // ocean playground blue
        };
        const rawCol = color || '#ea580c';
        const slideCol = mapCol[rawCol] || ((rawCol === '#c6b59c' || rawCol === '#999') ? '#ea580c' : rawCol);
        const rimCol = HP.shade(slideCol, 0.80);
        const steelCol = '#059669'; // classic playground powder-coated emerald green stanchions
        const rungCol = '#f8fafc';  // gleaming silver stainless ladder rungs & grab bars
        const deckCol = '#1e293b';  // textured non-slip staging deck

        // Aspect ratio helpers: width=29px, height=42px, depth=61px
        const wxToDz = 29 / 61; // 0.475
        const wxToHy = 29 / 42; // 0.690
        const hyToDz = 42 / 61; // 0.689

        // 1. Angled Ergonomic Climbing Safety Ladder (12 deg rearward climb angle, z = -0.44 to -0.30)
        // Tubular powder-coated main stiles (circular in cross-section)
        const stileW = 0.042;
        const stileD = stileW * wxToDz;
        boxSlope('metal', -0.26, 0.02, -0.44, -0.26, 0.88, -0.30, stileW, stileD, steelCol);
        boxSlope('metal',  0.26, 0.02, -0.44,  0.26, 0.88, -0.30, stileW, stileD, steelCol);
        // Base ground anchoring flange pads
        cyl('metal', -0.26, 0.015, -0.44, 0.09, 0.03, 0.09 * wxToDz, '#1e293b');
        cyl('metal',  0.26, 0.015, -0.44, 0.09, 0.03, 0.09 * wxToDz, '#1e293b');
        // Angled rear stabilizer kickstand outriggers
        boxSlope('metal', -0.26, 0.65, -0.34, -0.26, 0.02, -0.48, 0.030, 0.030 * wxToDz, '#334155');
        boxSlope('metal',  0.26, 0.65, -0.34,  0.26, 0.02, -0.48, 0.030, 0.030 * wxToDz, '#334155');
        // Stabilizer rear cross-brace
        cylX('metal', 0, 0.12, -0.46, 0.48, 0.022, 0.022 * hyToDz, '#334155');

        // 5 Wide Textured Stainless Climbing Rungs
        for (let r = 1; r <= 5; r++) {
          const u = r / 6;
          const ry = 0.02 + u * 0.84;
          const rz = -0.44 + u * 0.14;
          cylX('metal', 0, ry, rz, 0.48, 0.028, 0.028 * hyToDz, rungCol);
        }

        // Safety grab handles looping up above the platform (h = 0.88 to 1.14)
        const grabW = 0.034;
        const grabD = grabW * wxToDz;
        cyl('metal', -0.26, 1.01, -0.30, grabW, 0.26, grabD, rungCol);
        cyl('metal',  0.26, 1.01, -0.30, grabW, 0.26, grabD, rungCol);
        cylZ('metal', -0.26, 1.14, -0.22, grabW, grabW * wxToHy, 0.16, rungCol);
        cylZ('metal',  0.26, 1.14, -0.22, grabW, grabW * wxToHy, 0.16, rungCol);
        // Overhead sit-down safety bar across chute entrance
        cylX('metal', 0, 1.14, -0.14, 0.52, 0.032, 0.032 * hyToDz, rungCol);

        // 2. High-Elevation Staging Platform & Protective Balustrade Side Panels
        // Textured staging platform deck
        box('metal', 0, 0.86, -0.22, 0.52, 0.04, 0.18, deckCol);
        // Left & right protective barrier panels with safety hand-grips
        for (const sx of [-0.25, 0.25]) {
          box('ceramic', sx, 0.98, -0.22, 0.03, 0.20, 0.18, slideCol);
          // Safety circular cutout hand-grips
          box('metal', sx, 1.00, -0.22, 0.035, 0.06, 0.08 * wxToDz, rungCol);
        }

        // 3. Ergonomic 6-Segment Molded Polyethylene Wave Chute
        // Smooth progression from staging platform down to landing scoop
        const chutePts = [
          { z: -0.14, y: 0.86, w: 0.44, rimH: 0.15 }, // platform exit
          { z: -0.04, y: 0.72, w: 0.44, rimH: 0.14 }, // initial acceleration plunge
          { z:  0.08, y: 0.52, w: 0.44, rimH: 0.12 }, // mid-glide wave descent
          { z:  0.20, y: 0.34, w: 0.45, rimH: 0.10 }, // lower transition
          { z:  0.32, y: 0.18, w: 0.46, rimH: 0.08 }, // deceleration scoop
          { z:  0.42, y: 0.09, w: 0.48, rimH: 0.06 }, // run-out pan
          { z:  0.48, y: 0.06, w: 0.48, rimH: 0.05 }  // level landing lip
        ];

        for (let i = 0; i < chutePts.length - 1; i++) {
          const p0 = chutePts[i], p1 = chutePts[i + 1];
          const curW = (p0.w + p1.w) / 2;
          const curRimH = (p0.rimH + p1.rimH) / 2;
          const rimX = curW / 2 - 0.015;

          // Chute sliding bed
          boxSlopeYZ('ceramic', 0, p0.y, p0.z, p1.y, p1.z, curW, 0.035, slideCol);
          // Left raised safety sidewall
          boxSlopeYZ('ceramic', -rimX, p0.y + curRimH / 2, p0.z, p1.y + curRimH / 2, p1.z, 0.035, curRimH, rimCol);
          // Right raised safety sidewall
          boxSlopeYZ('ceramic',  rimX, p0.y + curRimH / 2, p0.z, p1.y + curRimH / 2, p1.z, 0.035, curRimH, rimCol);
          // Rolled bullnose safety cap along top rim joints
          round('ceramic', -rimX, p0.y + curRimH, p0.z, 0.045, 0.045 * wxToHy, 0.045 * wxToDz, rimCol);
          round('ceramic',  rimX, p0.y + curRimH, p0.z, 0.045, 0.045 * wxToHy, 0.045 * wxToDz, rimCol);
        }
        // Rolled safety rim on the final joint
        const lastP = chutePts[chutePts.length - 1];
        const lastRimX = lastP.w / 2 - 0.015;
        round('ceramic', -lastRimX, lastP.y + lastP.rimH, lastP.z, 0.045, 0.045 * wxToHy, 0.045 * wxToDz, rimCol);
        round('ceramic',  lastRimX, lastP.y + lastP.rimH, lastP.z, 0.045, 0.045 * wxToHy, 0.045 * wxToDz, rimCol);

        // Ground exit run-out pan & bullnose bumper
        box('ceramic', 0, 0.06, 0.48, 0.48, 0.035, 0.06, slideCol);
        cylX('ceramic', 0, 0.06, 0.51, 0.52, 0.055, 0.055 * hyToDz, rimCol);

        // Safety ground landing pad under exit
        box('dark', 0, 0.015, 0.48, 0.56, 0.03, 0.18, '#1e293b');

        // 4. Central Mid-Span Tubular Steel A-Frame Support Legs
        // Placed at z = 0.10, y = 0.50 under the mid-descent wave
        const legW = 0.036;
        const legD = legW * wxToDz;
        boxSlope('metal', -0.22, 0.50, 0.10, -0.24, 0.02, 0.10, legW, legD, steelCol);
        boxSlope('metal',  0.22, 0.50, 0.10,  0.24, 0.02, 0.10, legW, legD, steelCol);
        // Base ground anchor foot plates
        cyl('metal', -0.24, 0.015, 0.10, 0.08, 0.03, 0.08 * wxToDz, '#1e293b');
        cyl('metal',  0.24, 0.015, 0.10, 0.08, 0.03, 0.08 * wxToDz, '#1e293b');
        // Horizontal mid-brace crossbar
        cylX('metal', 0, 0.24, 0.10, 0.46, 0.026, 0.026 * hyToDz, rungCol);

      } else if (/^playhouse$/i.test(t)) {
        // Storybook Cedar Garden Playhouse with Shingle Roof & Dutch Door (2x2 footprint, height 44px)
        box('wood', 0, 0.42, 0, 0.92, 0.80, 0.90, color || '#e8a0a8');
        boxSlope('wood', -0.48, 0.76, 0, 0, 0.98, 0, 0.05, 0.96, '#78350f');
        boxSlope('wood', 0.48, 0.76, 0, 0, 0.98, 0, 0.05, 0.96, '#78350f');
        box('wood', 0, 0.38, 0.455, 0.32, 0.64, 0.02, '#ffffff');
        round('metal', -0.12, 0.38, 0.47, 0.03, 0.03, 0.03, '#c9a44e', true);
        box('glass', 0.465, 0.50, 0, 0.02, 0.24, 0.32, '#bae6fd');
        box('wood', 0.47, 0.36, 0, 0.08, 0.08, 0.36, '#78350f');
        round('foliage', 0.48, 0.42, -0.08, 0.08, 0.08, 0.08, '#f43f5e');
        round('foliage', 0.48, 0.42, 0.08, 0.08, 0.08, 0.08, '#f43f5e');

      } else if (/^patioheater$/i.test(t)) {
        // Commercial 48,000 BTU Stainless Steel Patio Mushroom Heater (1x1 footprint, height 46px)
        cyl('metal', 0, 0.18, 0, 0.48, 0.34, 0.48, color || '#8b939c', true);
        cyl('metal', 0, 0.60, 0, 0.07, 0.54, 0.07, '#cbd5e1', true);
        cyl('dark', 0, 0.84, 0, 0.28, 0.16, 0.28, '#181b1e');
        cyl('glow', 0, 0.84, 0, 0.24, 0.14, 0.24, '#f97316');
        cyl('metal', 0, 0.95, 0, 0.88, 0.05, 0.88, '#f1f5f9', true);
        round('metal', 0, 0.98, 0, 0.16, 0.06, 0.16, '#cbd5e1', true);

      } else if (/^cooler$/i.test(t)) {
        // 80-Quart Wheeled Rolling Patio Party Ice Cooler Cart (1x1 footprint, height 22px)
        for (const [lx, lz] of [[-0.38, -0.34], [0.38, -0.34], [-0.38, 0.34], [0.38, 0.34]]) {
          cyl('metal', lx, 0.24, lz, 0.04, 0.46, 0.04, '#1e293b', true);
          cyl('dark', lx, 0.04, lz, 0.07, 0.06, 0.07, '#0f172a');
        }
        box('metal', 0, 0.16, 0, 0.84, 0.02, 0.74, '#64748b', true);
        box('ceramic', 0, 0.62, 0, 0.86, 0.44, 0.78, color || '#a03a3a');
        box('ceramic', -0.21, 0.86, 0, 0.40, 0.06, 0.80, HP.shade(color || '#a03a3a', 1.15));
        box('ceramic', 0.21, 0.86, 0, 0.40, 0.06, 0.80, HP.shade(color || '#a03a3a', 1.15));
        box('metal', -0.21, 0.90, 0, 0.16, 0.02, 0.04, '#cbd5e1', true);
        box('metal', 0.21, 0.90, 0, 0.16, 0.02, 0.04, '#cbd5e1', true);
        box('metal', 0, 0.66, 0.40, 0.06, 0.10, 0.02, '#cbd5e1', true);
        box('metal', 0, 0.54, 0.40, 0.12, 0.10, 0.04, '#334155', true);
  
      } else if (/^treehouse$/i.test(t)) {
        // Rebuilt From Scratch: Multi-Style Treehouse (v=0 Modern Glass, v=1 Classic Craftsman, v=2 Nordic Sanctuary)
        // Nestled in a towering Organic Oak Tree (no smooth spheres) with scalable 3x3..12x12 deck & 1:1 2D interior sync.
        const pBox = (k, px, py, pz, pw, ph, pd, c, det, mat) =>
          box(k, px / width, py / height, pz / depth, pw / width, ph / height, pd / depth, c, det, mat);
        const pCyl = (k, px, py, pz, diamPx, ph, c, det, mat) =>
          cyl(k, px / width, py / height, pz / depth, diamPx / width, ph / height, diamPx / depth, c, det, mat);
        const pCone = (k, px, py, pz, diamPx, ph, c, det, mat) =>
          part('cone', k, px / width, py / height, pz / depth, diamPx / width, ph / height, diamPx / depth, c, det, mat);
        const pSlope = (k, x0, y0, z0, x1, y1, z1, ty, tz, c, det, mat) =>
          boxSlope(k, x0 / width, y0 / height, z0 / depth, x1 / width, y1 / height, z1 / depth, ty / height, tz / depth, c, det, mat);
        const pSlopeYZ = (k, px, y0, z0, y1, z1, wx, ty, c, det, mat) =>
          boxSlopeYZ(k, px / width, y0 / height, z0 / depth, y1 / height, z1 / depth, wx / width, ty / height, c, det, mat);
        const pCylSlope = (k, x0, y0, z0, x1, y1, z1, diamPx, c, det, mat) =>
          partSlope('cylinderX', k, x0 / width, y0 / height, z0 / depth, x1 / width, y1 / height, z1 / depth, diamPx / height, diamPx / depth, c, det, mat);
        const pRot = (k, px, py, pz, pw, ph, pd, ry, c, det, mat) =>
          boxRot(k, px / width, py / height, pz / depth, pw / width, ph / height, pd / depth, ry, c, det, mat);
        const pShapeRot = (shape, k, px, py, pz, pw, ph, pd, ry, c, det, mat) =>
          partRot(shape, k, px / width, py / height, pz / depth, pw / width, ph / height, pd / depth, ry, c, det, mat);
        const pGable = (k, px, py, pz, pw, ph, pd, c) =>
          part('gable', k, px / width, py / height, pz / depth, pw / width, ph / height, pd / depth, c);
        const pHip = (k, px, py, pz, pw, ph, pd, c) =>
          part('hipRoof', k, px / width, py / height, pz / depth, pw / width, ph / height, pd / depth, c);
        const pLeaf = (px, py, pz, sx, sy, sz, rx, ry, rz, c) =>
          partRotEuler('oakLeaf', 'foliage', px / width, py / height, pz / depth, sx / width, sy / height, sz / depth, rx, ry, rz, c);

        const CELL = (HP && HP.CELL) || 28;
        const bw = Math.max(3, Math.round(width / CELL));
        const bh = Math.max(3, Math.round(depth / CELL));
        const L = HP.treehouseLayout ? HP.treehouseLayout(bw, bh) : {
          W: width, D: depth, C: CELL, bw, bh, deckY: 54, wallH: 74, wallTop: 128, doorH: 56,
          cabCols: Math.max(2, Math.round(bw * 0.72)), cabRows: Math.max(2, Math.round(bh * 0.66)),
          cabX0: -width * 0.42, cabX1: width * 0.28, cabZ0: -depth * 0.42, cabZ1: depth * 0.22,
          cabW: width * 0.70, cabD: depth * 0.64, doorCx: -width * 0.07, doorHalfW: Math.max(15, width * 0.12),
          doorX0: -width * 0.07 - 16, doorX1: -width * 0.07 + 16,
          trunkX: -width * 0.10, trunkZ: -depth * 0.12, trunkR: 15,
          stairCx: width * 0.37, stairHalfW: 12, stairGapX0: width * 0.25, stairGapX1: width * 0.48,
          lx0: width * 0.26, lx1: width * 0.48, lz0: depth * 0.45, lz1: depth * 0.72
        };

        const style = ((it && it.v) || 0) % 3;
        const W = L.W, D = L.D, deckY = L.deckY, wallH = L.wallH, wallTop = L.wallTop, doorH = L.doorH;
        const { cabX0, cabX1, cabZ0, cabZ1, cabW, cabD, doorX0, doorX1, doorCx } = L;
        const cabCx = (cabX0 + cabX1) * 0.5, cabCz = (cabZ0 + cabZ1) * 0.5;
        const isCustomized = !!(it && it.interior && it.interior.customized);

        // =========================================================================
        // 1. REALISTIC ORGANIC OAK TREE (No Smooth Spheres — Faceted Rosettes & Gnarled Limbs)
        // =========================================================================
        const barkCol = '#4a311e';
        const barkDark = '#2d1b0e';
        const barkLight = '#634329';
        const tx = L.trunkX, tz = L.trunkZ, trD = L.trunkR * 2.0;

        // Gnarled tapered oak trunk + flared roots + curved bark flutes (stops cleanly beneath deck slab)
        pCone('wood', tx, 10, tz, trD * 1.42, 20, barkDark);
        pCyl('wood', tx - 1, 22, tz + 1, trD * 1.08, 22, barkCol);
        pCyl('wood', tx - 2, 39, tz - 1, trD * 0.92, 22, barkCol);
        // Sculpted angled trunk flutes & buttress ribs (no stiff straight boxes)
        for (let f = 0; f < 6; f++) {
          const a = (f / 6) * Math.PI * 2 + 0.4;
          pCylSlope('wood', tx + Math.cos(a) * trD * 0.46, 8, tz + Math.sin(a) * trD * 0.46,
            tx + Math.cos(a + 0.25) * trD * 0.36, 42, tz + Math.sin(a + 0.25) * trD * 0.36,
            6.5, f % 2 === 0 ? barkDark : barkLight);
        }

        // 8 Sweeping Buttress Roots anchored into yard turf
        for (let r = 0; r < 8; r++) {
          const ang = (r / 8) * Math.PI * 2 + 0.25;
          const rLen = trD * (1.05 + (r % 2) * 0.28);
          pCylSlope('wood', tx + Math.cos(ang) * trD * 0.34, 17 - (r % 2) * 3, tz + Math.sin(ang) * trD * 0.34,
            tx + Math.cos(ang + 0.08) * rLen, 2.0, tz + Math.sin(ang + 0.08) * rLen, 8.2, barkDark);
        }

        // Major Smoothly Curved Gnarled Oak Boughs:
        // Gradually curve diagonally from trunk core (y=18..22) -> clear under deck rim joist at y=43 -> sweep outward/upward in natural S-curves (NO 90° bends!) -> arch over roof!
        const safeX0 = Math.min(-W * 0.53, cabX0 - 18);
        const safeX1 = Math.max( W * 0.515, cabX1 + 16);
        const safeZ0 = Math.min(-D * 0.54, cabZ0 - 18);
        const oakLimbs = [
          // West graceful sweeping main arm (gradual organic curvature, <= 24 deg per joint)
          [
            [tx, 16, tz, (tx + safeX0) * 0.52, 29, -D * 0.14, 15.0],
            [(tx + safeX0) * 0.52, 29, -D * 0.14, safeX0, 44, -D * 0.14, 13.5],
            [safeX0, 44, -D * 0.14, safeX0 - 12, 68, -D * 0.12, 12.4],
            [safeX0 - 12, 68, -D * 0.12, safeX0 - 20, 108, -D * 0.08, 11.2],
            [safeX0 - 20, 108, -D * 0.08, safeX0 - 22, 160, -D * 0.04, 9.6],
            [safeX0 - 22, 160, -D * 0.04, safeX0 - 10, 210,  D * 0.02, 7.8],
            [safeX0 - 10, 210,  D * 0.02, -W * 0.26, 250, -D * 0.04, 5.8],
            [safeX0 - 20, 108, -D * 0.08, safeX0 - 38, 180,  D * 0.20, 6.8],
            [safeX0 - 22, 160, -D * 0.04, safeX0 - 42, 214, -D * 0.22, 6.2]
          ],
          // North-West sweeping crown limb
          [
            [tx, 18, tz, (tx + safeX0 * 0.85) * 0.5, 30, (tz + safeZ0) * 0.5, 14.5],
            [(tx + safeX0 * 0.85) * 0.5, 30, (tz + safeZ0) * 0.5, safeX0 * 0.84, 44, safeZ0, 13.0],
            [safeX0 * 0.84, 44, safeZ0, safeX0 * 0.90, 74, safeZ0 - 8, 11.8],
            [safeX0 * 0.90, 74, safeZ0 - 8, safeX0 * 0.86, 122, safeZ0 - 12, 10.6],
            [safeX0 * 0.86, 122, safeZ0 - 12, safeX0 * 0.68, 174, safeZ0 - 8, 9.2],
            [safeX0 * 0.68, 174, safeZ0 - 8, -W * 0.28, 228, -D * 0.36, 7.6],
            [-W * 0.28, 228, -D * 0.36, -W * 0.04, 264, -D * 0.16, 5.4],
            [safeX0 * 0.86, 122, safeZ0 - 12, safeX0 - 20, 188, safeZ0 - 20, 6.4]
          ],
          // North central towering canopy trunk/bough
          [
            [tx, 19, tz, (tx + W * 0.06) * 0.5, 31, (tz + safeZ0) * 0.52, 15.0],
            [(tx + W * 0.06) * 0.5, 31, (tz + safeZ0) * 0.52, W * 0.06, 44, safeZ0, 13.5],
            [W * 0.06, 44, safeZ0, W * 0.10, 76, safeZ0 - 8, 12.2],
            [W * 0.10, 76, safeZ0 - 8, W * 0.12, 124, safeZ0 - 10, 11.0],
            [W * 0.12, 124, safeZ0 - 10, W * 0.10, 178, safeZ0 - 4, 9.6],
            [W * 0.10, 178, safeZ0 - 4, W * 0.02, 236, -D * 0.18, 7.8],
            [W * 0.02, 236, -D * 0.18, W * 0.24, 268, -D * 0.02, 5.4],
            [W * 0.02, 236, -D * 0.18, -W * 0.18, 266,  D * 0.04, 5.4]
          ],
          // East-Rear gradually sweeping parabolic bough (smooth 16->26->46->68->78->55 deg curve, zero sharp L-elbow)
          [
            [tx, 14, tz, tx * 0.2 + safeX1 * 0.3, 22, safeZ0 * 0.35, 14.5],
            [tx * 0.2 + safeX1 * 0.3, 22, safeZ0 * 0.35, safeX1 * 0.72, 33, safeZ0 * 0.48, 13.4],
            [safeX1 * 0.72, 33, safeZ0 * 0.48, safeX1 + 3, 44, safeZ0 * 0.50, 12.2],
            [safeX1 + 3, 44, safeZ0 * 0.50, safeX1 + 12, 64, -D * 0.26, 11.0],
            [safeX1 + 12, 64, -D * 0.26, safeX1 + 16, 102, -D * 0.23, 9.8],
            [safeX1 + 16, 102, -D * 0.23, safeX1 + 14, 158, -D * 0.20, 8.6],
            [safeX1 + 14, 158, -D * 0.20, safeX1 + 4, 208, -D * 0.16, 7.0],
            [safeX1 + 4, 208, -D * 0.16, W * 0.24, 248, -D * 0.12, 5.4],
            [safeX1 + 14, 158, -D * 0.20, safeX1 + 30, 194,  D * 0.08, 5.8]
          ]
        ];
        for (const chain of oakLimbs) {
          for (let li = 0; li < chain.length; li++) {
            const [x0, y0, z0, x1, y1, z1, dPx] = chain[li];
            const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
            const segLen = Math.hypot(dx, dy, dz) || 1;
            const ov = dPx * 0.26 / segLen;
            const col = li % 2 === 0 ? barkCol : barkDark;
            pCylSlope('wood', x0 - dx * ov, y0 - dy * ov, z0 - dz * ov, x1 + dx * ov, y1 + dy * ov, z1 + dz * ov, dPx, col);
            pRot('wood', x1, y1, z1, dPx * 0.74, dPx * 0.74, dPx * 0.74, li * 0.8 + 0.3, col);
          }
        }

        // Botanical Unbroken Oak Leaf Crown (rich dense canopy spanning y=166..278, cupping & crowning roof)
        const leafPalette = ['#1b3e17', '#25501e', '#326627', '#427e30', '#54963c'];
        const leafCenters = [
          // Broad upper central crown arching directly over treehouse roof
          [ W * 0.00, 266, -D * 0.12, 58], [ W * 0.22, 262, -D * 0.02, 52], [-W * 0.22, 260,  D * 0.02, 52],
          [-W * 0.06, 246, -D * 0.34, 54], [ W * 0.10, 244,  D * 0.14, 50], [ W * 0.00, 278, -D * 0.08, 46],
          [ W * 0.32, 242, -D * 0.16, 48], [-W * 0.32, 242, -D * 0.16, 48], [-W * 0.16, 224, -D * 0.02, 46],
          [ W * 0.18, 226, -D * 0.08, 46],
          // Bridging shoulder boughs connecting outer arms to central crown (zero bare stick gaps!)
          [-W * 0.44, 230, -D * 0.08, 52], [-W * 0.40, 210, -D * 0.28, 48], [ W * 0.42, 228, -D * 0.14, 54],
          [ W * 0.38, 208, -D * 0.30, 50], [ W * 0.28, 222, -D * 0.14, 52], [ W * 0.34, 198, -D * 0.08, 46],
          [-W * 0.12, 212, -D * 0.48, 50], [ W * 0.14, 214, -D * 0.46, 50],
          // West full foliage cascade (drapes gently beside roof eave above y=170)
          [safeX0 - 18, 198, -D * 0.04, 52], [safeX0 - 36, 212,  D * 0.18, 48], [safeX0 - 32, 184,  D * 0.14, 44],
          [safeX0 - 4,  218, -D * 0.24, 48], [safeX0 - 38, 204, -D * 0.22, 46], [safeX0 - 20, 174, -D * 0.12, 42],
          // North-West & Back lush rim
          [safeX0 * 0.78, 198, safeZ0 - 8, 48], [safeX0 - 16, 188, safeZ0 - 18, 44], [ W * 0.04, 194, safeZ0 - 4, 48],
          // East full foliage cascade hugging tightly over right arm
          [safeX1 + 10, 196, -D * 0.16, 54], [safeX1 + 24, 192,  D * 0.06, 48], [safeX1 + 6,  174, -D * 0.18, 46],
          [safeX1 - 8,  218, -D * 0.30, 48]
        ];
        const leafScale = Math.max(0.98, Math.min(1.48, Math.min(W, D) / 160));
        leafCenters.forEach(([cx, cy, cz, baseD], ci) => {
          const s = baseD * leafScale;
          for (let sub = 0; sub < 2; sub++) {
            const seed = ci * 7 + sub * 13;
            const ox = Math.sin(seed * 1.7) * s * 0.22;
            const oy = Math.cos(seed * 1.3) * s * 0.10;
            const oz = Math.cos(seed * 2.1) * s * 0.22;
            const col = leafPalette[(ci + sub * 2) % leafPalette.length];
            pLeaf(cx + ox, cy + oy, cz + oz, s * (1.12 - sub * 0.10), s * (0.66 + (sub % 2) * 0.10), s * (1.08 - sub * 0.10),
              Math.sin(seed) * 0.26, seed * 0.72, Math.cos(seed) * 0.24, col);
          }
        });

        // =========================================================================
        // 2. ELEVATED FOUNDATION, TIMBER DECK, STAIRS & STYLE-MATCHED GUARDRAILS
        // =========================================================================
        const stPostInset = Math.min(12, W * 0.08);
        const postCol = style === 0 ? '#272b33' : (style === 1 ? '#5c3317' : '#8a623c');
        const deckWood = style === 2 ? '#d6b488' : (style === 1 ? '#c68449' : '#bc7b4b');
        const deckTrim = HP.shade(deckWood, 0.72);
        const railWood = style === 2 ? '#c69a68' : '#783f1a';
        const steelDark = '#181b20';
        const glassCol = '#dff2fe';

        for (const [px, pz] of [
          [-W / 2 + stPostInset, -D / 2 + stPostInset],
          [ W / 2 - stPostInset, -D / 2 + stPostInset],
          [-W / 2 + stPostInset,  D / 2 - stPostInset],
          [ W / 2 - stPostInset,  D / 2 - stPostInset]
        ]) {
          pBox('stone', px, 1.5, pz, 7.5, 3, 7.5, '#94a3b8');
          pBox('metal', px, 4.0, pz, 5.8, 2, 5.8, '#1e293b', true);
          pBox('wood',  px, 28,  pz, 5.4, 48, 5.4, postCol);
          const bxDir = px < 0 ? 1 : -1;
          const bzDir = pz < 0 ? 1 : -1;
          pCylSlope('wood', px, 38, pz, px + bxDir * 14, 52, pz, 3.8, postCol);
          pCylSlope('wood', px, 38, pz, px, 52, pz + bzDir * 14, 3.8, postCol);
        }

        // Deck rim joist beams + thick plank deck slab
        pBox('wood', 0, deckY - 1.8, 0, W, 2.8, D, style === 0 ? '#22262e' : deckTrim);
        pBox('wood', 0, deckY - 0.3, 0, W - 0.5, 0.8, D - 0.5, deckWood);
        for (let pz = -D / 2 + 8; pz <= D / 2 - 8; pz += 10) {
          pBox('wood', 0, deckY + 0.05, pz, W - 2, 0.16, 0.45, deckTrim);
        }

        // Perimeter Guardrails (leaving clean opening L.stairGapX0..L.stairGapX1 at South-East stairs)
        const railRuns = [
          { x0: -W / 2 + 1.5, x1: W / 2 - 1.5, z0: -D / 2 + 1.5, z1: -D / 2 + 1.5 },          // North
          { x0: -W / 2 + 1.5, x1: -W / 2 + 1.5, z0: -D / 2 + 1.5, z1: D / 2 - 1.5 },          // West
          { x0: W / 2 - 1.5,  x1: W / 2 - 1.5,  z0: -D / 2 + 1.5, z1: D / 2 - 1.5 },          // East
          { x0: -W / 2 + 1.5, x1: L.stairGapX0, z0: D / 2 - 1.5,  z1: D / 2 - 1.5 },          // South West
          { x0: L.stairGapX1, x1: W / 2 - 1.5,  z0: D / 2 - 1.5,  z1: D / 2 - 1.5 }           // South East stub
        ];
        for (const run of railRuns) {
          const rLen = Math.hypot(run.x1 - run.x0, run.z1 - run.z0);
          if (rLen < 3) continue;
          const isH = Math.abs(run.z1 - run.z0) < 0.5;
          const rCx = (run.x0 + run.x1) * 0.5, rCz = (run.z0 + run.z1) * 0.5;
          const rW = isH ? rLen : 1.6, rD = isH ? 1.6 : rLen;

          // Posts spaced evenly along run
          const nSeg = Math.max(1, Math.round(rLen / 34));
          for (let i = 0; i <= nSeg; i++) {
            const tPos = i / nSeg;
            const px = run.x0 + (run.x1 - run.x0) * tPos;
            const pz = run.z0 + (run.z1 - run.z0) * tPos;
            pBox(style === 0 ? 'metal' : 'wood', px, deckY + 10, pz, 2.0, 20, 2.0, style === 0 ? steelDark : railWood);
          }

          // Top continuous handrail
          pBox('wood', rCx, deckY + 20.2, rCz, isH ? rLen + 2 : 2.8, 1.6, isH ? 2.8 : rLen + 2, railWood);

          if (style === 0) {
            // 4 sleek stainless aircraft tension cables
            for (const cy of [deckY + 4, deckY + 8, deckY + 12, deckY + 16]) {
              pBox('metal', rCx, cy, rCz, isH ? rLen : 0.35, 0.35, isH ? 0.35 : rLen, '#94a3b8', true);
            }
          } else if (style === 1) {
            // Classic craftsman vertical wood balusters + bottom rail
            pBox('wood', rCx, deckY + 3.0, rCz, rW, 1.2, rD, railWood);
            const nBal = Math.max(2, Math.floor(rLen / 7.5));
            for (let b = 1; b < nBal; b++) {
              const bt = b / nBal;
              pBox('wood', run.x0 + (run.x1 - run.x0) * bt, deckY + 11.2, run.z0 + (run.z1 - run.z0) * bt,
                0.9, 15.5, 0.9, railWood, true);
            }
          } else {
            // Nordic wide slatted timber horizontal bars
            for (const sy of [deckY + 5, deckY + 10, deckY + 15]) {
              pBox('wood', rCx, sy, rCz, isH ? rLen : 0.8, 1.6, isH ? 0.8 : rLen, '#deb887');
            }
          }
        }

        // Front-Right Access Stairs descending cleanly from (L.stairCx, deckY, D/2 - 0.5) -> (L.stairCx, 0, L.lz1)
        const sTopZ = D / 2 - 0.5, sBotZ = L.lz1;
        const stMat = style === 0 ? steelDark : railWood;
        const stKind = style === 0 ? 'metal' : 'wood';
        pSlopeYZ(stKind, L.lx0, 0.5, sBotZ, deckY - 1.2, sTopZ, 1.8, 2.8, stMat);
        pSlopeYZ(stKind, L.lx1, 0.5, sBotZ, deckY - 1.2, sTopZ, 1.8, 2.8, stMat);
        const treadW = Math.max(8, (L.lx1 - L.lx0) - 1.6);
        for (let st = 1; st <= 11; st++) {
          const sf = st / 11;
          const tz = sBotZ - sf * (sBotZ - sTopZ);
          const ty = sf * (deckY - 0.7);
          pBox('wood', L.stairCx, ty, tz, treadW, 1.4, 3.2, deckWood);
          pBox(stKind, L.stairCx, ty - (deckY - 0.7) / 22, tz + 1.3, treadW * 0.94, (deckY - 0.7) / 11, 0.8, HP.shade(deckTrim, 0.92), true);
        }
        // Angled stair handrails + sturdy posts + spindles joining deck rim seamlessly
        pSlopeYZ(stKind, L.lx0 - 0.4, 18, sBotZ, deckY + 20.2, sTopZ, 1.5, 1.5, railWood);
        pSlopeYZ(stKind, L.lx1 + 0.4, 18, sBotZ, deckY + 20.2, sTopZ, 1.5, 1.5, railWood);
        for (const frac of [0, 0.5, 1]) {
          const pyBot = frac * deckY;
          const pH = 18 + frac * 2.2;
          const pzPos = sBotZ - frac * (sBotZ - sTopZ);
          pBox(stKind, L.lx0 - 0.4, pyBot + pH * 0.5, pzPos, 1.6, pH, 1.6, stMat);
          pBox(stKind, L.lx1 + 0.4, pyBot + pH * 0.5, pzPos, 1.6, pH, 1.6, stMat);
        }

        // =========================================================================
        // 3. ARCHITECTURAL CABIN STRUCTURES BY STYLE (Full Headroom Vertical Walls)
        // =========================================================================
        const intWallCol = style === 2 ? '#e6d6bc' : '#f1e7d5';
        const winLow = deckY + 16, winHi = deckY + doorH - 2, winH = winHi - winLow;
        const doorMidY = deckY + doorH * 0.5;
        const doorW = doorX1 - doorX0;

        if (style === 0) {
          // ---------- STYLE 0: MODERN TIMBER & GLASS CANOPY HOUSE ----------
          const cedar = '#be7743', cedarGroove = '#783f18';
          // North cedar wall + upper clerestory transom glass
          pBox('wood', cabCx, deckY + 28, cabZ0, cabW, 56, 2.4, cedar);
          pBox('glass', cabCx, wallTop - 9, cabZ0, cabW - 4, 16, 0.8, glassCol);
          pBox('metal', cabCx, deckY + 57, cabZ0, cabW, 2.0, 2.2, steelDark);
          pBox('metal', cabCx, wallTop - 1, cabZ0, cabW, 2.0, 2.2, steelDark);
          for (let vx = cabX0 + 8; vx < cabX1 - 6; vx += 10) {
            pBox('wood', vx, deckY + 28, cabZ0 - 1.3, 0.7, 55, 0.4, cedarGroove, true);
          }

          // West cedar wall with tall architectural black-framed window + clerestory
          const wWinZ0 = cabCz - cabD * 0.16, wWinZ1 = cabCz + cabD * 0.20;
          pBox('wood', cabX0, deckY + 28, (cabZ0 + wWinZ0) * 0.5, 2.4, 56, Math.max(4, wWinZ0 - cabZ0), cedar);
          pBox('wood', cabX0, deckY + 28, (wWinZ1 + cabZ1) * 0.5, 2.4, 56, Math.max(4, cabZ1 - wWinZ1), cedar);
          pBox('wood', cabX0, deckY + 8, (wWinZ0 + wWinZ1) * 0.5, 2.4, 16, wWinZ1 - wWinZ0, cedar);
          pBox('glass', cabX0, deckY + 36, (wWinZ0 + wWinZ1) * 0.5, 0.8, 38, wWinZ1 - wWinZ0, glassCol);
          pBox('metal', cabX0, deckY + 57, cabCz, 2.2, 2.0, cabD, steelDark);
          pBox('glass', cabX0, wallTop - 9, cabCz, 0.8, 16, cabD - 4, glassCol);
          pBox('metal', cabX0, wallTop - 1, cabCz, 2.2, 2.0, cabD, steelDark);

          // East floor-to-ceiling black steel curtain wall
          pBox('glass', cabX1, deckY + wallH * 0.5, cabCz, 0.8, wallH - 4, cabD - 2, glassCol);
          pBox('metal', cabX1, deckY + 1, cabCz, 2.2, 2.0, cabD, steelDark);
          pBox('metal', cabX1, deckY + doorH + 1, cabCz, 2.2, 2.0, cabD, steelDark);
          pBox('metal', cabX1, wallTop - 1, cabCz, 2.2, 2.0, cabD, steelDark);
          const nEMull = Math.max(2, Math.round(cabD / 28));
          for (let m = 0; m <= nEMull; m++) {
            const mz = cabZ0 + (m / nEMull) * cabD;
            pBox('metal', cabX1, deckY + wallH * 0.5, mz, 2.2, wallH, 1.8, steelDark);
          }

          // Front Wall: Cedar corner pier + open sliding patio doorway + corner glass curtain
          const fLeftW = Math.max(4, doorX0 - cabX0);
          pBox('wood', cabX0 + Math.min(8, fLeftW * 0.35), deckY + wallH * 0.5, cabZ1, Math.min(14, fLeftW * 0.65), wallH, 2.4, cedar);
          if (fLeftW > 14) {
            const glW = fLeftW - 14;
            pBox('glass', doorX0 - glW * 0.5, deckY + wallH * 0.5, cabZ1, glW, wallH - 4, 0.8, glassCol);
          }
          const fRightW = Math.max(4, cabX1 - doorX1);
          pBox('glass', doorX1 + fRightW * 0.5, deckY + wallH * 0.5, cabZ1, fRightW - 2, wallH - 4, 0.8, glassCol);
          pBox('metal', cabCx, wallTop - 1, cabZ1, cabW, 2.2, 2.2, steelDark);
          pBox('metal', cabCx, deckY + doorH + 1, cabZ1, cabW, 2.0, 2.2, steelDark);
          pBox('metal', doorX0 + fLeftW * 0.5, deckY + 1, cabZ1, fLeftW, 1.8, 2.0, steelDark);
          pBox('metal', doorX1 + fRightW * 0.5, deckY + 1, cabZ1, fRightW, 1.8, 2.0, steelDark);
          pBox('metal', doorX0, deckY + wallH * 0.5, cabZ1, 2.0, wallH, 2.2, steelDark);
          pBox('metal', doorX1, deckY + wallH * 0.5, cabZ1, 2.0, wallH, 2.2, steelDark);
          // Upper transom glass above open doorway
          pBox('glass', doorCx, wallTop - 9, cabZ1, doorW, 16, 0.8, glassCol);
          // Slid-open sliding glass patio door panel parked cleanly left of doorway
          const sdW = Math.min(fLeftW - 2, doorW * 0.88);
          pBox('glass', doorX0 - sdW * 0.5, doorMidY, cabZ1 - 1.5, sdW - 2, doorH - 3, 0.6, glassCol);
          pBox('metal', doorX0 - sdW * 0.5, doorMidY, cabZ1 - 1.5, sdW, doorH, 1.2, steelDark);

          // Cantilevered Flat Charcoal Fascia Roof with Warm Cedar Soffits & Downlights
          const rX0 = cabX0 - 10, rX1 = cabX1 + 14;
          const rZ0 = cabZ0 - 10, rZ1 = Math.min(D / 2 - 2, cabZ1 + 22);
          const rCx = (rX0 + rX1) * 0.5, rCz = (rZ0 + rZ1) * 0.5;
          const rW = rX1 - rX0, rD = rZ1 - rZ0;
          pBox('wood',  rCx, wallTop + 0.8, rCz, rW - 2, 1.4, rD - 2, '#c87e48');   // cedar soffit underside
          pBox('metal', rCx, wallTop + 3.2, rCz, rW, 3.8, rD, '#222730');           // dark charcoal fascia cap
          pBox('metal', rCx, wallTop + 5.2, rCz, rW + 1.5, 1.0, rD + 1.5, steelDark);
          // Porch recessed soffit downlights
          pCyl('glow', doorCx - doorW * 0.6, wallTop + 0.1, cabZ1 + 10, 3.6, 0.6, '#fef08a');
          pCyl('glow', doorCx + doorW * 0.6, wallTop + 0.1, cabZ1 + 10, 3.6, 0.6, '#fef08a');

        } else if (style === 1) {
          // ---------- STYLE 1: CLASSIC CRAFTSMAN TIMBER CABIN ----------
          const honey = '#d99346', honeyLine = '#9e6226', trimW = '#f7f4ec', shingle = '#3f3029', shingleDark = '#291f1a';
          const cPane = (px, py, pz, pw, ph, pd, alongZ) => {
            pBox('glass', px, py, pz, alongZ ? 0.8 : pw, ph, alongZ ? pw : 0.8, glassCol);
            // Perimeter painted plaster trim strips (open center, crisp white contrast)
            pBox('plaster', px, py + ph * 0.5 + 0.8, pz, alongZ ? pd : pw + 2.4, 1.8, alongZ ? pw + 2.4 : pd, trimW);
            pBox('plaster', px, py - ph * 0.5 - 0.8, pz, alongZ ? pd + 0.8 : pw + 3.0, 1.8, alongZ ? pw + 3.0 : pd + 0.8, trimW);
            const hw = pw * 0.5 + 0.7;
            pBox('plaster', alongZ ? px : px - hw, py, alongZ ? pz - hw : pz, alongZ ? pd : 1.6, ph + 1.6, alongZ ? 1.6 : pd, trimW);
            pBox('plaster', alongZ ? px : px + hw, py, alongZ ? pz + hw : pz, alongZ ? pd : 1.6, ph + 1.6, alongZ ? 1.6 : pd, trimW);
            pBox('plaster', px, py, pz, alongZ ? 1.6 : 1.0, ph, alongZ ? 1.0 : 1.6, trimW); // vertical mullion
          };
          // Corner architectural painted cream-white trim boards (flush outside wall corners, zero z-fighting)
          for (const [cx, cz] of [[cabX0 - 0.85, cabZ0 - 0.85], [cabX1 + 0.85, cabZ0 - 0.85], [cabX0 - 0.85, cabZ1 + 0.85], [cabX1 + 0.85, cabZ1 + 0.85]]) {
            pBox('plaster', cx, deckY + wallH * 0.5, cz, 2.0, wallH, 2.0, trimW);
          }
          // North wall with open double casement window + interior plaster finish
          const nWinW = cabW * 0.28, nPierW = (cabW - nWinW) * 0.5;
          pBox('wood', cabCx, deckY + 8, cabZ0, cabW, 16, 2.4, honey);
          pBox('wood', cabCx, deckY + doorH + 8, cabZ0, cabW, wallH - doorH + 2, 2.4, honey);
          pBox('wood', cabX0 + nPierW * 0.5, deckY + wallH * 0.5, cabZ0, nPierW, wallH, 2.4, honey);
          pBox('wood', cabX1 - nPierW * 0.5, deckY + wallH * 0.5, cabZ0, nPierW, wallH, 2.4, honey);
          cPane(cabCx, winLow + winH * 0.5, cabZ0, nWinW, winH, 2.8, false);
          for (let ly = deckY + 6; ly < wallTop - 4; ly += 6) {
            pBox('wood', cabCx, ly, cabZ0 - 1.25, cabW - 4, 0.35, 0.35, honeyLine, true);
          }

          // West wall with open picture window
          const wWinD = cabD * 0.28, wPierD = (cabD - wWinD) * 0.5;
          pBox('wood', cabX0, deckY + 8, cabCz, 2.4, 16, cabD, honey);
          pBox('wood', cabX0, deckY + doorH + 8, cabCz, 2.4, wallH - doorH + 2, cabD, honey);
          pBox('wood', cabX0, deckY + wallH * 0.5, cabZ0 + wPierD * 0.5, 2.4, wallH, wPierD, honey);
          pBox('wood', cabX0, deckY + wallH * 0.5, cabZ1 - wPierD * 0.5, 2.4, wallH, wPierD, honey);
          cPane(cabX0, winLow + winH * 0.5, cabCz, wWinD, winH, 2.8, true);

          // East wall with wide Craftsman window overlooking terrace & stairs
          const eWinD = cabD * 0.36, ePierD = (cabD - eWinD) * 0.5;
          pBox('wood', cabX1, deckY + 8, cabCz, 2.4, 16, cabD, honey);
          pBox('wood', cabX1, deckY + doorH + 8, cabCz, 2.4, wallH - doorH + 2, cabD, honey);
          pBox('wood', cabX1, deckY + wallH * 0.5, cabZ0 + ePierD * 0.5, 2.4, wallH, ePierD, honey);
          pBox('wood', cabX1, deckY + wallH * 0.5, cabZ1 - ePierD * 0.5, 2.4, wallH, ePierD, honey);
          cPane(cabX1, winLow + winH * 0.5, cabCz, eWinD, winH, 2.8, true);

          // Front Wall: flanked open windows + open front doorway + crisp white lintel/jambs
          const fLW = Math.max(4, doorX0 - cabX0);
          pBox('wood', cabX0 + fLW * 0.5, deckY + 8, cabZ1, fLW, 16, 2.4, honey);
          pBox('wood', cabX0 + fLW * 0.5, deckY + doorH + 8, cabZ1, fLW, wallH - doorH + 2, 2.4, honey);
          pBox('wood', cabX0 + fLW * 0.17, deckY + wallH * 0.5, cabZ1, fLW * 0.34, wallH, 2.4, honey);
          pBox('wood', doorX0 - fLW * 0.17, deckY + wallH * 0.5, cabZ1, fLW * 0.34, wallH, 2.4, honey);
          if (fLW * 0.30 > 4) cPane(cabX0 + fLW * 0.5, winLow + winH * 0.5, cabZ1, fLW * 0.32, winH, 2.8, false);

          const fRW = Math.max(4, cabX1 - doorX1);
          pBox('wood', doorX1 + fRW * 0.5, deckY + 8, cabZ1, fRW, 16, 2.4, honey);
          pBox('wood', doorX1 + fRW * 0.5, deckY + doorH + 8, cabZ1, fRW, wallH - doorH + 2, 2.4, honey);
          pBox('wood', doorX1 + fRW * 0.17, deckY + wallH * 0.5, cabZ1, fRW * 0.34, wallH, 2.4, honey);
          pBox('wood', cabX1 - fRW * 0.17, deckY + wallH * 0.5, cabZ1, fRW * 0.34, wallH, 2.4, honey);
          if (fRW * 0.30 > 4) cPane(doorX1 + fRW * 0.5, winLow + winH * 0.5, cabZ1, fRW * 0.32, winH, 2.8, false);

          // Door header & side jambs + swung-open paneled wood & glass Craftsman entry door
          pBox('wood', doorCx, deckY + doorH + 9, cabZ1, doorW + 2, wallH - doorH, 2.4, honey);
          pBox('plaster', doorX0 - 1, doorMidY, cabZ1, 2.4, doorH, 2.8, trimW);
          pBox('plaster', doorX1 + 1, doorMidY, cabZ1, 2.4, doorH, 2.8, trimW);
          pBox('plaster', doorCx, deckY + doorH + 1, cabZ1, doorW + 4, 2.4, 2.8, trimW);
          // Open door leaf hinged inward cleanly inside doorX0
          const leafLen = Math.min(doorW * 0.86, 22);
          pBox('wood', doorX0 + 1, doorMidY, cabZ1 - leafLen * 0.5, 1.4, doorH - 2, leafLen, '#8c4c1f');
          pBox('glass', doorX0 + 1, deckY + doorH * 0.68, cabZ1 - leafLen * 0.5, 1.6, doorH * 0.34, leafLen * 0.65, glassCol);
          pBox('metal', doorX0 + 2, deckY + 26, cabZ1 - leafLen + 2.5, 0.8, 4, 1.2, '#eab308', true);

          // Covered Gable Entry Porch + Truss + Glowing Copper Lanterns
          const prZ1 = Math.min(D / 2 - 3, cabZ1 + 20), prD = Math.max(10, prZ1 - cabZ1), prCz = (cabZ1 + prZ1) * 0.5;
          const prW = Math.min(cabW * 0.58, doorW * 1.45);
          pBox('wood', doorCx - prW * 0.45, deckY + 26, prZ1, 3.2, 52, 3.2, '#8c4c1f');
          pBox('wood', doorCx + prW * 0.45, deckY + 26, prZ1, 3.2, 52, 3.2, '#8c4c1f');
          pBox('wood', doorCx, deckY + 53, prZ1, prW, 2.6, 3.0, '#78350f');
          pGable('wood', doorCx, deckY + 62, prCz, prW + 4, 15, prD + 4, shingle);
          pBox('plaster', doorCx, deckY + 55.5, prZ1 + 1.2, prW + 6, 1.8, 1.8, trimW);
          // Two copper porch lanterns flanking door
          for (const lx of [doorX0 - 4, doorX1 + 4]) {
            pBox('dark', lx, deckY + 38, cabZ1 + 2.0, 2.4, 4.5, 2.4, steelDark);
            pBox('glow', lx, deckY + 38, cabZ1 + 2.4, 1.8, 3.2, 1.8, '#fef08a');
          }

          // Main Pitched Wood-Shingle Gable Roof (ridge along X) + Open-Window Front Dormer + Stone Chimney
          const mrSpanZ = cabD + 16, mrLenX = cabW + 16, mrH = 30;
          pShapeRot('gable', 'wood', cabCx, wallTop + mrH * 0.5, cabCz, cabD, mrH, cabW - 1, Math.PI / 2, honey);
          // Front (South) & Back (North) sloped shingle planes
          pSlopeYZ('wood', cabCx, wallTop - 1, cabCz + mrSpanZ * 0.5, wallTop + mrH + 1, cabCz, mrLenX, 2.8, shingle);
          pSlopeYZ('wood', cabCx, wallTop + mrH + 1, cabCz, wallTop - 1, cabCz - mrSpanZ * 0.5, mrLenX, 2.8, shingleDark);
          // Main Ridge beam & crisp cream eave fascia
          pBox('wood', cabCx, wallTop + mrH + 1.8, cabCz, mrLenX + 1, 2.4, 3.0, shingleDark);
          pBox('plaster', cabCx, wallTop - 0.5, cabCz + mrSpanZ * 0.5, mrLenX, 2.2, 1.4, trimW);
          pBox('plaster', cabCx, wallTop - 0.5, cabCz - mrSpanZ * 0.5, mrLenX, 2.2, 1.4, trimW);
          // Centered Front Dormer with Open Triple Windows & Crisp White Frame (zero solid cover over glass!)
          const dmW = Math.max(18, cabW * 0.30), dmD = Math.max(12, cabD * 0.24), dmZ = cabCz + cabD * 0.25;
          pBox('wood', cabCx, wallTop + 10, dmZ, dmW, 14, dmD, honey);
          pGable('wood', cabCx, wallTop + 21, dmZ, dmW + 4, 11, dmD + 4, shingle);
          const dmFz = dmZ + dmD * 0.5 + 0.5, dmGlW = dmW * 0.72, dmGlH = 7.4;
          pBox('glass', cabCx, wallTop + 10, dmFz, dmGlW, dmGlH, 0.8, glassCol);
          pBox('plaster', cabCx, wallTop + 10 + dmGlH * 0.5 + 0.6, dmFz + 0.2, dmGlW + 2.2, 1.2, 1.0, trimW);
          pBox('plaster', cabCx, wallTop + 10 - dmGlH * 0.5 - 0.6, dmFz + 0.2, dmGlW + 2.6, 1.2, 1.2, trimW);
          pBox('plaster', cabCx - dmGlW * 0.5 - 0.5, wallTop + 10, dmFz + 0.2, 1.0, dmGlH, 1.0, trimW);
          pBox('plaster', cabCx + dmGlW * 0.5 + 0.5, wallTop + 10, dmFz + 0.2, 1.0, dmGlH, 1.0, trimW);
          pBox('plaster', cabCx - dmGlW * 0.17, wallTop + 10, dmFz + 0.2, 0.9, dmGlH, 1.0, trimW);
          pBox('plaster', cabCx + dmGlW * 0.17, wallTop + 10, dmFz + 0.2, 0.9, dmGlH, 1.0, trimW);
          // Rear Stone Chimney
          pBox('stone', cabX0 + cabW * 0.74, wallTop + 20, cabCz - cabD * 0.26, 9, 34, 9, '#64748b');
          pBox('stone', cabX0 + cabW * 0.74, wallTop + 37, cabCz - cabD * 0.26, 11, 2.5, 11, '#475569');

        } else {
          // ---------- STYLE 2: JAPANESE & NORDIC SANCTUARY ----------
          const charred = '#262423', charredLine = '#141212', hinoki = '#deb887', shojiPaper = '#fcf6e8', slateRoof = '#272e36';
          // Structural Hinoki Cypress Post-and-Beam Framing
          for (const [cx, cz] of [[cabX0, cabZ0], [cabX1, cabZ0], [cabX0, cabZ1], [cabX1, cabZ1]]) {
            pBox('wood', cx, deckY + wallH * 0.5, cz, 3.6, wallH, 3.6, hinoki);
          }
          pBox('wood', cabCx, wallTop - 1.5, cabZ0, cabW, 3.0, 3.0, hinoki);
          pBox('wood', cabCx, wallTop - 1.5, cabZ1, cabW, 3.0, 3.0, hinoki);
          pBox('wood', cabX0, wallTop - 1.5, cabCz, 3.0, 3.0, cabD, hinoki);
          pBox('wood', cabX1, wallTop - 1.5, cabCz, 3.0, 3.0, cabD, hinoki);

          // North Charred Shou Sugi Ban Wall + interior Japanese shikkui plaster panel
          pBox('wood', cabCx, deckY + wallH * 0.5 - 1, cabZ0, cabW - 2, wallH - 3, 2.2, charred);
          for (let px = cabX0 + 7; px < cabX1 - 5; px += 9) {
            pBox('dark', px, deckY + wallH * 0.5 - 1, cabZ0 - 1.2, 0.6, wallH - 4, 0.4, charredLine, true);
          }
          pBox('plaster', cabCx, deckY + 26, cabZ0 + 1.2, cabW - 4, 50, 0.5, '#efe7d6');

          // West Shoji Translucent Veranda Screen Panel (clean piers, zero overlap with charred wall)
          const wShZ0 = cabCz - cabD * 0.14, wShZ1 = cabCz + cabD * 0.30, wShD = wShZ1 - wShZ0;
          pBox('wood', cabX0, deckY + wallH * 0.5, (cabZ0 + wShZ0) * 0.5, 2.4, wallH - 2, Math.max(4, wShZ0 - cabZ0), charred);
          pBox('wood', cabX0, deckY + wallH * 0.5, (wShZ1 + cabZ1) * 0.5, 2.4, wallH - 2, Math.max(4, cabZ1 - wShZ1), charred);
          pBox('wood', cabX0, deckY + 7, (wShZ0 + wShZ1) * 0.5, 2.4, 14, wShD, charred);
          pBox('wood', cabX0, wallTop - 8, (wShZ0 + wShZ1) * 0.5, 2.4, 14, wShD, charred);
          pBox('fabric', cabX0, deckY + 37, (wShZ0 + wShZ1) * 0.5, 1.0, 46, wShD, shojiPaper);
          pBox('wood', cabX0, deckY + 60, (wShZ0 + wShZ1) * 0.5, 2.4, 2.0, wShD + 2, hinoki);
          pBox('wood', cabX0, deckY + 14, (wShZ0 + wShZ1) * 0.5, 2.4, 2.0, wShD + 2, hinoki);
          for (let hz = wShZ0 + 9; hz < wShZ1 - 2; hz += 9) {
            pBox('wood', cabX0, deckY + 37, hz, 1.6, 46, 0.8, hinoki, true);
          }

          // East Clear Glass Veranda Wall with Hinoki Slats
          pBox('glass', cabX1, deckY + wallH * 0.5 - 2, cabCz, 0.8, wallH - 6, cabD - 4, glassCol);
          pBox('wood', cabX1, deckY + doorH + 1, cabCz, 2.6, 2.4, cabD, hinoki);
          for (let ez = cabZ0 + cabD * 0.25; ez < cabZ1 - 6; ez += cabD * 0.25) {
            pBox('wood', cabX1, deckY + wallH * 0.5, ez, 2.4, wallH, 1.8, hinoki);
          }

          // Front Wall: Charred left wing with inset glowing shoji window + open doorway + right glass/hinoki wing
          const nLW = Math.max(4, doorX0 - cabX0);
          pBox('wood', cabX0 + nLW * 0.5, deckY + 8, cabZ1, nLW, 16, 2.2, charred);
          pBox('wood', cabX0 + nLW * 0.5, wallTop - 9, cabZ1, nLW, 16, 2.2, charred);
          pBox('wood', cabX0 + nLW * 0.16, deckY + wallH * 0.5, cabZ1, nLW * 0.32, wallH - 2, 2.2, charred);
          pBox('wood', doorX0 - nLW * 0.16, deckY + wallH * 0.5, cabZ1, nLW * 0.32, wallH - 2, 2.2, charred);
          if (nLW > 12) {
            const shW = nLW * 0.38;
            pBox('fabric', cabX0 + nLW * 0.5, deckY + 36, cabZ1, shW, 42, 0.8, shojiPaper);
            pBox('wood', cabX0 + nLW * 0.5, deckY + 36, cabZ1, shW + 1, 1.0, 1.6, hinoki);
            pBox('wood', cabX0 + nLW * 0.5, deckY + 36, cabZ1, 1.0, 42, 1.6, hinoki);
          }
          const nRW = Math.max(4, cabX1 - doorX1);
          pBox('glass', doorX1 + nRW * 0.5, deckY + doorH * 0.5, cabZ1, nRW - 2, doorH - 2, 0.8, glassCol);
          pBox('wood', doorX1 + nRW * 0.5, deckY + doorH + 10, cabZ1, nRW, wallH - doorH, 2.2, charred);
          pBox('wood', cabCx, deckY + doorH + 1, cabZ1, cabW, 2.6, 2.8, hinoki);
          pBox('wood', doorX0, deckY + wallH * 0.5, cabZ1, 2.4, wallH, 2.6, hinoki);
          pBox('wood', doorX1, deckY + wallH * 0.5, cabZ1, 2.4, wallH, 2.6, hinoki);
          pBox('wood', doorCx, deckY + doorH + 10, cabZ1, doorW, wallH - doorH - 2, 2.0, charred);
          // Parted sliding shoji leaf slid neatly inside left jamb
          const shLeafW = Math.min(nLW - 4, doorW * 0.72);
          pBox('fabric', doorX0 - shLeafW * 0.5, doorMidY, cabZ1 - 1.5, shLeafW, doorH - 2, 0.8, shojiPaper);
          pBox('wood', doorX0 - shLeafW * 0.5, doorMidY, cabZ1 - 1.5, shLeafW, 1.2, 1.4, hinoki);

          // Deep Overhanging Hipped Dark Slate Roof with Exposed Hinoki Rafter Tails
          const hW = cabW + 26, hD = cabD + 28, hCz = cabCz + 4;
          const hipH = 32;
          pBox('wood', cabCx, wallTop + 0.8, hCz, hW - 4, 1.4, hD - 4, hinoki); // deep cypress soffit
          // Rhythmically spaced exposed hinoki rafter tails projecting beneath all 4 eaves
          for (let rx = cabCx - hW * 0.46; rx <= cabCx + hW * 0.46; rx += 9) {
            pBox('wood', rx, wallTop - 0.6, hCz - hD * 0.5 + 1.5, 1.4, 1.6, 5, '#b88b58', true);
            pBox('wood', rx, wallTop - 0.6, hCz + hD * 0.5 - 1.5, 1.4, 1.6, 5, '#b88b58', true);
          }
          for (let rz = hCz - hD * 0.44; rz <= hCz + hD * 0.44; rz += 9) {
            pBox('wood', cabCx - hW * 0.5 + 1.5, wallTop - 0.6, rz, 5, 1.6, 1.4, '#b88b58', true);
            pBox('wood', cabCx + hW * 0.5 - 1.5, wallTop - 0.6, rz, 5, 1.6, 1.4, '#b88b58', true);
          }
          // Sculpted 4-slope Hipped Slate Roof
          pHip('metal', cabCx, wallTop + 1.5 + hipH * 0.5, hCz, hW, hipH, hD, slateRoof);
          pBox('metal', cabCx, wallTop + 2.0 + hipH, hCz, hW * 0.48, 2.4, 3.0, '#14181e'); // ridge beam

          // Warm Hanging Paper Washi Lanterns under deep front corners
          for (const lx of [cabX0 - 4, cabX1 + 6]) {
            const lz = Math.min(D / 2 - 4, cabZ1 + 14);
            pCyl('metal', lx, wallTop - 3, lz, 0.6, 8, '#1e293b', true);
            pCyl('glow',  lx, wallTop - 10, lz, 5.4, 8.0, '#fef6e4');
            pCyl('dark',  lx, wallTop - 6.0, lz, 3.6, 0.8, '#1e293b', true);
            pCyl('dark',  lx, wallTop - 14.0, lz, 3.6, 0.8, '#1e293b', true);
          }
        }

        // =========================================================================
        // 4. INTERIOR FLOOR, CUSTOM 2D PARTITION WALLS, OR DEFAULT STARTER PROPS
        // =========================================================================
        const cabFloorCol = style === 2 ? '#e3c79e' : '#eedab9';
        pBox('wood', cabCx, deckY + 0.15, cabCz, cabW - 2, 0.35, cabD - 2, cabFloorCol);

        if (isCustomized) {
          // User customized 2D interior in Structure Editor:
          // World3d already places all it.interior.floors & it.interior.furniture cleanly on deckY!
          // Here render any additional interior partition walls drawn strictly INSIDE cabin perimeter.
          const inLvl = it.interior;
          const ox = inLvl.ox !== undefined ? inLvl.ox : 1;
          const oy = inLvl.oy !== undefined ? inLvl.oy : 1;
          const cc = inLvl.cabCols || L.cabCols;
          const cr = inLvl.cabRows || L.cabRows;
          if (inLvl.walls) {
            for (const wk of Object.keys(inLvl.walls)) {
              const s = HP.parseWallKey ? HP.parseWallKey(wk) : null;
              if (!s) continue;
              const isPerim = (s.d === 'h' && (s.y === oy || s.y === oy + cr) && s.x >= ox && s.x < ox + cc) ||
                              (s.d === 'v' && (s.x === ox || s.x === ox + cc) && s.y >= oy && s.y < oy + cr);
              if (isPerim) continue;
              if (s.x < ox || s.x > ox + bw || s.y < oy || s.y > oy + bh) continue;
              const rec = inLvl.walls[wk] || {};
              const wx = -W / 2 + (s.x - ox + (s.d === 'h' ? 0.5 : 0)) * CELL;
              const wz = -D / 2 + (s.y - oy + (s.d === 'v' ? 0.5 : 0)) * CELL;
              const pw = s.d === 'h' ? CELL : 3.2;
              const pd = s.d === 'v' ? CELL : 3.2;
              if (rec.f === 'door') {
                pBox('wood', wx, deckY + doorH + (wallH - doorH) * 0.5, wz, pw, wallH - doorH, pd, intWallCol);
              } else if (rec.f === 'window') {
                pBox('wood', wx, deckY + 10, wz, pw, 20, pd, intWallCol);
                pBox('glass', wx, deckY + 34, wz, pw * 0.85, 28, pd * 0.5, glassCol);
                pBox('wood', wx, deckY + 60, wz, pw, 24, pd, intWallCol);
              } else {
                pBox('wood', wx, deckY + wallH * 0.5 - 2, wz, pw, wallH - 4, pd, rec.ca || rec.cb || intWallCol);
              }
            }
          }
        } else {
          // Starter Interior & Terrace Furnishings (skipped cleanly once user edits 2D Interior!)
          const furnW = Math.min(24, cabW * 0.34);
          // Cozy bench/lounge on back-left wall away from door
          const lx = cabX0 + furnW * 0.5 + 4, lz = cabZ0 + 10;
          pBox('wood', lx, deckY + 4.5, lz, furnW, 7, 13, '#9a6134');
          pBox('fabric', lx, deckY + 9, lz, furnW - 2, 3.2, 12, '#f4efe4');
          pBox('fabric', lx, deckY + 13.5, lz - 4.5, furnW - 2, 7, 3.0, style === 0 ? '#475569' : '#c26d53');
          // Woven area rug centered inside cabin floor
          pBox('fabric', cabCx, deckY + 0.4, cabCz, cabW * 0.44, 0.5, cabD * 0.36, style === 2 ? '#c7b89c' : '#cbd5e1');
          // Corner warm glowing minimalist standing lamp
          const lampX = cabX1 - 8, lampZ = cabZ0 + 8;
          pCyl('metal', lampX, deckY + 18, lampZ, 1.4, 34, steelDark);
          pCyl('glow',  lampX, deckY + 36, lampZ, 6.4, 6.0, '#fef08a');
          // Front terrace lounge chair & planter on South-West porch (clear of door & stairs)
          if (D - cabD > 24) {
            const pY = deckY + 4, pZ = Math.min(D / 2 - 10, cabZ1 + (D / 2 - cabZ1) * 0.5);
            const pX = -W * 0.28;
            pBox('wood', pX, pY, pZ, 13, 6, 12, '#78350f');
            pBox('fabric', pX, pY + 3.8, pZ, 12, 2.2, 11, '#e6ded3');
            pBox('wood', -W * 0.42, deckY + 4, pZ, 9, 8, 9, '#78350f');
            pLeaf(-W * 0.42, deckY + 11, pZ, 10, 8, 10, 0.2, 0.6, -0.1, '#386e2a');
          }
        }
      } else if (/^sandbox$/i.test(t)) {
        // Cedar Timber Children's Sandbox with 4 Corner Benches, Sandcastle & Beach Toys (Height 18px)
        // 1. Interlocking solid cedar timber box with wide corner seating boards
        box('wood',  0.00, 0.32, -0.45, 0.96, 0.62, 0.09, color || '#a06a38');
        box('wood',  0.00, 0.32,  0.45, 0.96, 0.62, 0.09, color || '#a06a38');
        box('wood', -0.45, 0.32,  0.00, 0.09, 0.62, 0.82, color || '#a06a38');
        box('wood',  0.45, 0.32,  0.00, 0.09, 0.62, 0.82, color || '#a06a38');
        for (const sx of [-0.36, 0.36]) {
          for (const sz of [-0.36, 0.36]) {
            box('wood', sx, 0.64, sz, 0.24, 0.06, 0.24, '#7c4d28');
          }
        }
        // 2. Rippling golden beach sand bed
        box('soil', 0, 0.30, 0, 0.82, 0.52, 0.82, '#fce79a');
        round('soil', 0.10, 0.46, 0.08, 0.36, 0.24, 0.36, '#fde68a');
        // 3. Sculpted sandcastle with center keep and corner turrets
        box('soil', -0.14, 0.54, -0.14, 0.18, 0.32, 0.18, '#fde68a');
        cyl('soil', -0.23, 0.62, -0.23, 0.07, 0.42, 0.07, '#fde68a');
        cyl('soil', -0.05, 0.62, -0.23, 0.07, 0.42, 0.07, '#fde68a');
        cyl('soil', -0.23, 0.62, -0.05, 0.07, 0.42, 0.07, '#fde68a');
        cyl('soil', -0.05, 0.62, -0.05, 0.07, 0.42, 0.07, '#fde68a');
        // Miniature red pennant flag on sandcastle peak
        cyl('wood', -0.14, 0.74, -0.14, 0.015, 0.16, 0.015, '#78350f');
        box('fabric', -0.10, 0.78, -0.14, 0.07, 0.04, 0.005, '#dc2626');
        // 4. Bright red sand bucket, yellow shovel and toy dump truck
        cyl('ceramic', 0.24, 0.50, -0.18, 0.12, 0.22, 0.12, '#ef4444');
        box('metal', 0.24, 0.62, -0.18, 0.14, 0.05, 0.02, '#cbd5e1', true);
        box('ceramic', 0.14, 0.48, 0.18, 0.045, 0.025, 0.20, '#eab308'); // yellow spade
        box('ceramic', -0.22, 0.48, 0.22, 0.14, 0.08, 0.10, '#f59e0b'); // toy dump truck body
        cylX('dark', -0.22, 0.46, 0.18, 0.05, 0.16, 0.05, '#181b1e');
        cylX('dark', -0.22, 0.46, 0.26, 0.05, 0.16, 0.05, '#181b1e');

      } else if (/^doghouse$/i.test(t)) {
        // Architectural Recessed Open-Cavity Wooden Dog House with Shingle Gable Roof & Cozy Cushion
        const woodCol = color || '#b45309';
        const trimCol = '#f1e7d5';
        // 1. Floor deck & dark interior shadow plinth
        box('dark', 0, 0.03, 0, 0.88, 0.06, 0.88, '#1e2126');
        box('wood', 0, 0.07, 0, 0.86, 0.04, 0.86, HP.shade(woodCol, 0.88));
        // 2. Open interior hollow walls (Left, Right, Back, Front left/right piers & header)
        box('wood', -0.40, 0.40, 0, 0.08, 0.62, 0.84, woodCol);                 // left wall
        box('wood',  0.40, 0.40, 0, 0.08, 0.62, 0.84, woodCol);                 // right wall
        box('wood',  0,    0.40, -0.38, 0.72, 0.62, 0.08, woodCol);             // back wall
        box('wood', -0.30, 0.40,  0.39, 0.22, 0.62, 0.08, woodCol);             // front left jamb wall
        box('wood',  0.30, 0.40,  0.39, 0.22, 0.62, 0.08, woodCol);             // front right jamb wall
        box('wood',  0,    0.61,  0.39, 0.38, 0.20, 0.08, woodCol);             // front doorway lintel
        // White trim doorway casing & timber nameplate
        box('wood', -0.18, 0.30, 0.435, 0.04, 0.44, 0.02, trimCol);
        box('wood',  0.18, 0.30, 0.435, 0.04, 0.44, 0.02, trimCol);
        box('wood',  0,    0.51, 0.435, 0.40, 0.04, 0.02, trimCol);
        box('wood',  0,    0.62, 0.438, 0.28, 0.07, 0.02, '#fed7aa');           // carved wooden nameplate
        // 3. Cozy fleece cushion visible right inside open doorway
        box('fabric', 0, 0.12, 0.02, 0.56, 0.07, 0.62, '#dc2626');
        // 4. Pitched Overhanging Shingled Gable Roof (cleanly sitting atop walls at y=0.71, ZERO overlap!)
        part('gable', 'wood', 0, 0.86, 0, 0.84, 0.30, 0.90, woodCol);
        boxSlope('wood', -0.49, 0.67, 0, 0, 1.01, 0, 0.05, 0.98, '#451a03');    // left overhanging roof slope
        boxSlope('wood',  0.49, 0.67, 0, 0, 1.01, 0, 0.05, 0.98, '#451a03');    // right overhanging roof slope
        box('wood', 0, 1.02, 0, 0.06, 0.04, 0.99, '#3a1804');                   // ridge cap

      } else if (/^hammock$/i.test(t)) {
        // Freestanding Curved Larch Wood Arc Hammock with Spreader Bars, Braided Suspension Ropes & Striped Bolster (1x3 footprint)
        const woodCol = '#b45309';
        const bedCol = color || '#fdf4ff';
        // 1. Curved Laminated Larch-Wood Arc Stand with Dual Ground Stabilizer Cross-Feet
        // Dual heavy horizontal cross-feet on the lawn (front and rear)
        for (const fz of [-0.34, 0.34]) {
          box('wood', 0, 0.03, fz, 0.88, 0.06, 0.09, woodCol);
          // Rubber non-skid floor pads
          for (const sx of [-0.38, 0.38]) {
            box('dark', sx, 0.005, fz, 0.08, 0.015, 0.09, '#181b1e');
          }
        }
        // Center longitudinal ground spine beam
        box('wood', 0, 0.05, 0, 0.10, 0.07, 0.68, HP.shade(woodCol, 0.90));
        // Upward-sweeping curved wooden horns at front and rear rising to y=0.72
        boxSlope('wood', 0, 0.05, -0.32, 0, 0.70, -0.44, 0.08, 0.09, woodCol);
        boxSlope('wood', 0, 0.05, 0.32, 0, 0.70, 0.44, 0.08, 0.09, woodCol);
        // Heavy stainless steel eye-bolts and S-hooks at horn tips
        cyl('metal', 0, 0.71, -0.44, 0.04, 0.06, 0.04, '#cbd5e1');
        cyl('metal', 0, 0.71, 0.44, 0.04, 0.06, 0.04, '#cbd5e1');
        // 2. Hardwood Spreader Bars & Braided Suspension Harness Ropes
        for (const sz of [-0.34, 0.34]) {
          // Turned hardwood spreader bar spanning across X
          cylX('wood', 0, 0.54, sz, 0.68, 0.04, 0.04, '#78350f');
          // Fan-shaped braided suspension ropes from horn eye-bolt to spreader bar
          const hornZ = sz > 0 ? 0.44 : -0.44;
          for (const rx of [-0.28, -0.14, 0, 0.14, 0.28]) {
            boxSlope('fabric', 0, 0.71, hornZ, rx, 0.54, sz, 0.015, 0.015, '#fef08a');
          }
        }
        // 3. Natural Catenary Sagging Woven Cotton Bed (3 smooth sloping segments)
        boxSlope('fabric', 0, 0.54, -0.34, 0, 0.32, -0.14, 0.64, 0.035, bedCol); // head slope
        box('fabric', 0, 0.30, 0, 0.66, 0.04, 0.28, bedCol);                      // center sag basin
        boxSlope('fabric', 0, 0.32, 0.14, 0, 0.54, 0.34, 0.64, 0.035, bedCol);  // foot slope
        // 4. Horizontal Striped Bolster Pillow lying across the head of the hammock
        cylX('fabric', 0, 0.44, -0.22, 0.58, 0.14, 0.14, '#38bdf8');
        cylX('fabric', -0.14, 0.44, -0.22, 0.05, 0.145, 0.145, '#ffffff'); // white accent stripe
        cylX('fabric', 0.14, 0.44, -0.22, 0.05, 0.145, 0.145, '#ffffff');

      } else if (/^car$/i.test(t)) {
        // Real-Blueprint Luxury Sport Sedan (BMW 3/5-Series proportions: 53W x 41H x 109L)
        const carCol = color || '#2563eb';
        const glassCol = '#192938';
        // 1. Machined 5-spoke silver alloy wheels sitting flush in clean arch pockets (17.5px tire diam)
        for (const sx of [-0.415, 0.415]) {
          const out = sx > 0 ? 1 : -1;
          for (const sz of [-0.305, 0.305]) {
            wheelX('dark', sx, 0.214, sz, 0.095, 17.5, '#14171c');
            wheelX('metal', sx + out * 0.032, 0.214, sz, 0.040, 12.2, '#dce3ec', true);
            wheelX('dark', sx + out * 0.042, 0.214, sz, 0.024, 9.6, '#0f172a');
            wheelX('metal', sx + out * 0.050, 0.214, sz, 0.020, 4.0, '#e2e8f0', true);
            box('metal', sx + out * 0.049, 0.214, sz, 0.014, 0.26, 0.022, '#e2e8f0', true);
            box('metal', sx + out * 0.049, 0.214, sz, 0.014, 0.042, 0.13, '#e2e8f0', true);
            box('ceramic', sx - out * 0.005, 0.255, sz + (sz > 0 ? 0.016 : -0.016), 0.022, 0.09, 0.024, '#dc2626');
            box('dark', sx * 0.87, 0.24, sz, 0.125, 0.24, 0.175, '#0b0e13');
          }
        }
        // 2. Contact shadow + chassis pan + front splitter
        part('shadow', 'dark', 0, 0.008, 0, 0.90, 1, 0.96, '#090a0f');
        box('dark', 0, 0.125, 0, 0.82, 0.075, 0.90, '#14171c');
        box('dark', 0, 0.095, -0.47, 0.85, 0.038, 0.055, '#0f1318');
        // 3. Smooth uninterrupted lower body (bumpers + rocker + continuous beltline over wheel wells)
        box('ceramic', 0, 0.295, 0, 0.87, 0.30, 0.42, carCol);                     // center doors between arches
        box('ceramic', 0, 0.285, -0.44, 0.87, 0.28, 0.095, carCol);                 // front bumper
        box('ceramic', 0, 0.30, 0.44, 0.87, 0.30, 0.095, carCol);                   // rear bumper
        box('ceramic', 0, 0.515, 0.01, 0.87, 0.15, 0.935, carCol);                  // continuous shoulder beltline
        box('dark', -0.425, 0.145, 0, 0.04, 0.065, 0.43, '#181b20');
        box('dark', 0.425, 0.145, 0, 0.04, 0.065, 0.43, '#181b20');
        // Sloped hood (rising from front grille to cowl z=-0.16) & rear decklid (z=+0.32..+0.46)
        wedge('ceramic', 0, 0.615, -0.315, 0.84, 0.055, 0.31, carCol);
        box('ceramic', 0, 0.59, 0.395, 0.83, 0.055, 0.14, carCol);
        // 4. Watertight Sloped Greenhouse Cabin (ZERO triangular holes! Glass + exact pillars)
        wedge('glass', 0, 0.77, -0.095, 0.71, 0.38, 0.15, glassCol);                // windshield + front quarter glass
        box('glass', 0, 0.77, 0.08, 0.71, 0.38, 0.20, glassCol);                    // center side/cabin glass
        wedgeBack('glass', 0, 0.77, 0.255, 0.71, 0.38, 0.15, glassCol);             // rear glass + C-pillar glass
        box('ceramic', 0, 0.968, 0.08, 0.72, 0.036, 0.21, carCol);                  // flush roof
        box('glass', 0, 0.988, 0.07, 0.50, 0.012, 0.15, '#101b27');                 // sunroof
        for (const sx of [-0.352, 0.352]) {
          boxSlopeYZ('ceramic', sx, 0.58, -0.17, 0.96, -0.02, 0.034, 0.032, carCol); // A-pillar
          boxSlopeYZ('ceramic', sx, 0.96, 0.18, 0.58, 0.33, 0.052, 0.034, carCol);   // C-pillar
          box('dark', sx, 0.77, 0.065, 0.022, 0.37, 0.040, '#181b20');               // B-pillar
          box('dark', sx, 0.585, 0.08, 0.018, 0.022, 0.49, '#181b20');               // window sill trim
        }
        // 5. Interior dashboard + seats (visible gently through smoked glass) + mirrors + handles
        box('dark', 0, 0.58, -0.06, 0.60, 0.09, 0.10, '#14181e');
        for (const sx of [-0.18, 0.18]) {
          box('fabric', sx, 0.65, 0.10, 0.20, 0.22, 0.06, '#1e293b');
        }
        for (const sx of [-0.46, 0.46]) {
          box('ceramic', sx, 0.61, -0.10, 0.07, 0.058, 0.052, carCol);
          box('metal', sx > 0 ? sx - 0.02 : sx + 0.02, 0.51, -0.01, 0.016, 0.028, 0.065, '#cbd5e1', true);
          box('metal', sx > 0 ? sx - 0.02 : sx + 0.02, 0.51, 0.13, 0.016, 0.028, 0.065, '#cbd5e1', true);
        }
        // 6. Front BMW-style grille + sharp LED headlights + rear slim LED lightbar & twin exhausts
        box('dark', 0, 0.275, -0.490, 0.44, 0.145, 0.016, '#0b1017');
        box('metal', 0, 0.275, -0.486, 0.465, 0.165, 0.012, '#cbd5e1', true);
        box('ceramic', 0, 0.275, -0.492, 0.035, 0.145, 0.018, carCol);
        box('led_white', -0.31, 0.37, -0.488, 0.16, 0.065, 0.016, '#f8fafc');
        box('led_white', 0.31, 0.37, -0.488, 0.16, 0.065, 0.016, '#f8fafc');
        box('led_red', -0.30, 0.51, 0.488, 0.20, 0.050, 0.014, '#dc2626');
        box('led_red', 0.30, 0.51, 0.488, 0.20, 0.050, 0.014, '#dc2626');
        box('dark', 0, 0.36, 0.490, 0.24, 0.105, 0.014, '#181b1e');
        box('fabric', 0, 0.36, 0.496, 0.21, 0.082, 0.008, '#f8fafc');
        box('dark', 0, 0.155, 0.472, 0.76, 0.09, 0.038, '#14171c');
        wheelZ('metal', -0.26, 0.155, 0.488, 3.6, 0.065, '#cbd5e1', true);
        wheelZ('metal', 0.26, 0.155, 0.488, 3.6, 0.065, '#cbd5e1', true);

      } else if (/^car_ev$/i.test(t)) {
        // Real-Blueprint Electric Fastback (Porsche Taycan / Model S: 53W x 39H x 109L)
        const evCol = color || '#f8fafc';
        const glassCol = '#182838';
        for (const sx of [-0.415, 0.415]) {
          const out = sx > 0 ? 1 : -1;
          for (const sz of [-0.305, 0.305]) {
            wheelX('dark', sx, 0.220, sz, 0.095, 17.2, '#14171c');
            wheelX('metal', sx + out * 0.032, 0.220, sz, 0.040, 12.2, '#d4dce6', true);
            wheelX('dark', sx + out * 0.042, 0.220, sz, 0.024, 9.2, '#0f172a');
            wheelX('metal', sx + out * 0.050, 0.220, sz, 0.020, 4.4, '#e2e8f0', true);
            box('metal', sx + out * 0.049, 0.220, sz, 0.014, 0.25, 0.020, '#e2e8f0', true);
            box('metal', sx + out * 0.049, 0.220, sz, 0.014, 0.040, 0.125, '#e2e8f0', true);
            box('ceramic', sx - out * 0.005, 0.26, sz + (sz > 0 ? 0.016 : -0.016), 0.022, 0.09, 0.024, '#ef4444');
            box('dark', sx * 0.87, 0.24, sz, 0.125, 0.24, 0.175, '#0b0e13');
          }
        }
        part('shadow', 'dark', 0, 0.008, 0, 0.90, 1, 0.96, '#090a0f');
        box('dark', 0, 0.125, 0, 0.82, 0.075, 0.90, '#14171c');
        box('dark', 0, 0.095, -0.47, 0.85, 0.038, 0.055, '#0f1318');
        box('ceramic', 0, 0.295, 0, 0.87, 0.30, 0.42, evCol);
        box('ceramic', 0, 0.285, -0.44, 0.87, 0.28, 0.095, evCol);
        box('ceramic', 0, 0.30, 0.44, 0.87, 0.30, 0.095, evCol);
        box('ceramic', 0, 0.51, 0.01, 0.87, 0.145, 0.935, evCol);
        box('dark', -0.425, 0.145, 0, 0.04, 0.065, 0.43, '#181b20');
        box('dark', 0.425, 0.145, 0, 0.04, 0.065, 0.43, '#181b20');
        wedge('ceramic', 0, 0.605, -0.325, 0.84, 0.055, 0.30, evCol);

        // Sweeping Watertight Fastback All-Glass Canopy (front -0.18..0, center 0..+0.17, fastback +0.17..+0.40)
        wedge('glass', 0, 0.76, -0.095, 0.71, 0.38, 0.17, glassCol);
        box('glass', 0, 0.76, 0.08, 0.71, 0.38, 0.18, glassCol);
        wedgeBack('glass', 0, 0.76, 0.285, 0.71, 0.38, 0.23, glassCol);
        box('ceramic', 0, 0.955, 0.08, 0.72, 0.036, 0.19, evCol);
        box('glass', 0, 0.976, 0.08, 0.58, 0.014, 0.15, '#0f1c28');
        for (const sx of [-0.352, 0.352]) {
          boxSlopeYZ('ceramic', sx, 0.575, -0.18, 0.955, -0.01, 0.034, 0.032, evCol);
          boxSlopeYZ('ceramic', sx, 0.955, 0.17, 0.575, 0.40, 0.046, 0.034, evCol);
          box('dark', sx, 0.76, 0.06, 0.022, 0.37, 0.038, '#181b20');
          box('dark', sx, 0.58, 0.11, 0.018, 0.022, 0.57, '#181b20');
        }
        box('led_white', 0, 0.50, -0.490, 0.74, 0.038, 0.015, '#ffffff');
        box('glow', -0.33, 0.50, -0.488, 0.11, 0.062, 0.016, '#38bdf8');
        box('glow', 0.33, 0.50, -0.488, 0.11, 0.062, 0.016, '#38bdf8');
        box('dark', 0, 0.21, -0.490, 0.52, 0.095, 0.016, '#0b1017');
        for (const sx of [-0.455, 0.455]) {
          box('ceramic', sx, 0.60, -0.10, 0.07, 0.056, 0.05, evCol);
        }
        box('led_red', 0, 0.515, 0.488, 0.80, 0.042, 0.014, '#ef4444');
        box('dark', 0, 0.16, 0.48, 0.76, 0.095, 0.03, '#0f172a');
        box('glow', -0.435, 0.49, 0.32, 0.016, 0.042, 0.036, '#38bdf8');

      } else if (/^suv$/i.test(t)) {
        // Real-Blueprint Full-Size Luxury SUV (Range Rover / BMW X5: 53W x 47H x 109L, muscular wide stance)
        const suvCol = color || '#1e293b';
        const glassCol = '#192938';
        for (const sx of [-0.415, 0.415]) {
          const out = sx > 0 ? 1 : -1;
          for (const sz of [-0.305, 0.305]) {
            wheelX('dark', sx, 0.222, sz, 0.102, 20.8, '#14171c');
            wheelX('metal', sx + out * 0.034, 0.222, sz, 0.042, 14.4, '#d4dce6', true);
            wheelX('dark', sx + out * 0.044, 0.222, sz, 0.025, 11.2, '#0f172a');
            wheelX('metal', sx + out * 0.052, 0.222, sz, 0.022, 4.6, '#e2e8f0', true);
            box('metal', sx + out * 0.051, 0.222, sz, 0.015, 0.27, 0.024, '#e2e8f0', true);
            box('metal', sx + out * 0.051, 0.222, sz, 0.015, 0.044, 0.14, '#e2e8f0', true);
            box('ceramic', sx - out * 0.005, 0.265, sz + (sz > 0 ? 0.016 : -0.016), 0.024, 0.095, 0.026, '#eab308');
            box('dark', sx * 0.87, 0.25, sz, 0.125, 0.25, 0.18, '#0b0e13');
          }
        }
        part('shadow', 'dark', 0, 0.008, 0, 0.90, 1, 0.96, '#090a0f');
        box('dark', 0, 0.155, 0, 0.82, 0.075, 0.90, '#14171c');
        box('metal', -0.445, 0.155, 0, 0.04, 0.032, 0.43, '#cbd5e1', true);
        box('metal', 0.445, 0.155, 0, 0.04, 0.032, 0.43, '#cbd5e1', true);

        // Continuous lower body + black rocker cladding + seamless beltline shoulder
        box('ceramic', 0, 0.33, 0, 0.88, 0.27, 0.41, suvCol);
        box('ceramic', 0, 0.315, -0.44, 0.88, 0.25, 0.095, suvCol);
        box('ceramic', 0, 0.33, 0.44, 0.88, 0.27, 0.095, suvCol);
        box('dark', 0, 0.20, 0, 0.885, 0.075, 0.42, '#181b20');
        box('ceramic', 0, 0.525, 0.0, 0.88, 0.15, 0.94, suvCol);
        wedge('ceramic', 0, 0.625, -0.32, 0.85, 0.055, 0.30, suvCol);

        // Bold Front SUV Grille, Aluminum Skid Plate & Slim Matrix Headlights
        box('dark', 0, 0.35, -0.490, 0.52, 0.19, 0.016, '#0b1017');
        box('metal', 0, 0.35, -0.486, 0.54, 0.21, 0.012, '#cbd5e1', true);
        box('metal', 0, 0.17, -0.485, 0.42, 0.05, 0.025, '#94a3b8', true);
        box('led_white', -0.32, 0.44, -0.488, 0.16, 0.075, 0.016, '#ffffff');
        box('led_white', 0.32, 0.44, -0.488, 0.16, 0.075, 0.016, '#ffffff');

        // Upright Commanding 2-Box SUV Greenhouse (front -0.17..-0.02, long roof -0.02..+0.33, raked liftgate +0.33..+0.45)
        wedge('glass', 0, 0.77, -0.095, 0.74, 0.37, 0.15, glassCol);
        box('glass', 0, 0.77, 0.155, 0.74, 0.37, 0.35, glassCol);
        wedgeBack('glass', 0, 0.77, 0.39, 0.74, 0.37, 0.12, glassCol);
        box('ceramic', 0, 0.962, 0.155, 0.75, 0.036, 0.36, suvCol);
        box('glass', 0, 0.982, 0.14, 0.54, 0.014, 0.26, '#111c28');
        for (const sx of [-0.34, 0.34]) {
          box('metal', sx, 0.992, 0.15, 0.028, 0.032, 0.36, '#cbd5e1', true);
        }
        box('dark', 0, 0.992, 0.04, 0.68, 0.018, 0.026, '#1e293b');
        box('dark', 0, 0.992, 0.24, 0.68, 0.018, 0.026, '#1e293b');
        for (const sx of [-0.372, 0.372]) {
          boxSlopeYZ('ceramic', sx, 0.59, -0.17, 0.955, -0.02, 0.034, 0.032, suvCol);
          boxSlopeYZ('ceramic', sx, 0.955, 0.33, 0.59, 0.45, 0.055, 0.034, suvCol);
          box('dark', sx, 0.77, 0.04, 0.022, 0.36, 0.038, '#181b20');
          box('dark', sx, 0.77, 0.21, 0.022, 0.36, 0.038, '#181b20');
          box('dark', sx, 0.595, 0.14, 0.018, 0.022, 0.61, '#181b20');
        }
        box('dark', 0, 0.59, -0.06, 0.64, 0.10, 0.10, '#14181e');
        for (const sx of [-0.20, 0.20]) {
          box('fabric', sx, 0.70, 0.12, 0.22, 0.24, 0.07, '#1e293b');
        }
        for (const sx of [-0.465, 0.465]) {
          box('ceramic', sx, 0.62, -0.10, 0.075, 0.058, 0.052, suvCol);
        }
        // Flush sleek rear lightbar, license plate & dual chrome exhausts
        box('led_red', 0, 0.53, 0.488, 0.80, 0.048, 0.014, '#dc2626');
        box('dark', 0, 0.39, 0.488, 0.26, 0.105, 0.014, '#181b1e');
        box('fabric', 0, 0.39, 0.494, 0.23, 0.082, 0.008, '#f8fafc');
        box('dark', 0, 0.175, 0.472, 0.78, 0.105, 0.038, '#14171c');
        box('metal', -0.28, 0.175, 0.486, 0.10, 0.05, 0.036, '#cbd5e1', true);
        box('metal', 0.28, 0.175, 0.486, 0.10, 0.05, 0.036, '#cbd5e1', true);

      } else if (/^garagedoor/i.test(t)) {
        // Overhead Sectional Garage Door (Full height 58px frame, guide tracks, ceiling rails, torsion spring, motor)
        // 1. Stationary Left & Right Vertical Steel Jamb Track Columns
        box('metal', -0.48, 0.48, 0, 0.04, 0.96, 0.06, '#475569', true);
        box('metal',  0.48, 0.48, 0, 0.04, 0.96, 0.06, '#475569', true);
        // Header lintel beam across opening top
        box('metal', 0, 0.97, 0, 1.0, 0.05, 0.08, '#334155', true);

        // 2. Torsion Spring Assembly (above header)
        cylX('metal', 0, 0.985, 0.01, 0.96, 0.025, 0.025, '#94a3b8', true);
        box('dark', 0, 0.985, 0.01, 0.08, 0.04, 0.04, '#1e293b');
        cylX('dark', -0.22, 0.985, 0.01, 0.28, 0.045, 0.045, '#0f172a');
        cylX('dark',  0.22, 0.985, 0.01, 0.28, 0.045, 0.045, '#0f172a');

        // 3. Overhead Horizontal Ceiling Guide Tracks extending into garage interior (-Z)
        box('metal', -0.47, 0.96, -0.40, 0.03, 0.03, 0.80, '#64748b', true);
        box('metal',  0.47, 0.96, -0.40, 0.03, 0.03, 0.80, '#64748b', true);
        box('metal', -0.47, 0.98, -0.75, 0.02, 0.06, 0.02, '#94a3b8', true);
        box('metal',  0.47, 0.98, -0.75, 0.02, 0.06, 0.02, '#94a3b8', true);

        // 4. Automatic Trolley Opener Motor Housing (mounted between ceiling tracks)
        box('metal', 0, 0.96, -0.38, 0.025, 0.025, 0.76, '#475569', true);
        box('dark', 0, 0.95, -0.65, 0.20, 0.08, 0.22, '#1e293b');
        box('glow', 0, 0.905, -0.65, 0.14, 0.018, 0.14, '#fffbeb');
} else if (/^greenhouse/i.test(t)) {
        // Grand Architectural Victorian Glasshouse / Conservatory (Hartley Botanic & Kew Gardens inspired)
        // Soaring pitched glass roof with connected sloped panels, gable end triangles, ornate cresting & spires,
        // weathered terracotta brick dwarf walls with stone sill coping, full perimeter crystal glazing,
        // open double French entrance doors, flagstone aisle with cast iron drain grates,
        // two-tier cedar staging benches on both sides, back potting workstation, rich plant displays
        // (geraniums, lavender, orchids, African violets, ferns, herbs, staked tomatoes, cloche, succulents),
        // copper watering can, amber mister, nested clay pots, soil sacks, gardening tools,
        // macrame hanging planters, climbing column ivy, and suspended vintage glowing pendant lantern!
        const frameCol = color || '#1b4332'; // British Racing Green, Bronze, Off-White, Slate
        const brickCol = '#a84c2a';
        const sillCol  = '#e2ddd6';
        const glassCol = '#a5d8e2';

        // Isotropic pixel geometry helpers (no aspect ratio stretching)
        const pBox = (k, px, py, pz, pw, ph, pd, c, det, mat) =>
          box(k, px / width, py / height, pz / depth, pw / width, ph / height, pd / depth, c, det, mat);
        const pCyl = (k, px, py, pz, diamPx, ph, c, det, mat) =>
          cyl(k, px / width, py / height, pz / depth, diamPx / width, ph / height, diamPx / depth, c, det, mat);
        const pSphere = (k, px, py, pz, diamPx, c) =>
          round(k, px / width, py / height, pz / depth, diamPx / width, diamPx / height, diamPx / depth, c);
        const pCone = (k, px, py, pz, diamPx, ph, c, det, mat) =>
          part('cone', k, px / width, py / height, pz / depth, diamPx / width, ph / height, diamPx / depth, c, det, mat);

        const sillY = 0.16;       // Dwarf brick knee-wall top
        const eaveY = 0.56;       // Eaves beam & wall top (comfortable door walkthrough clearance)
        const ridgeY = 0.94;      // Soaring central roof ridge beam
        const doorHalfW = 0.16;   // Walk-in entrance opening half-width [-0.16, 0.16]
        const doorHeaderY = eaveY - 0.04;
        const fwW = 0.48 - doorHalfW; // front wall wing width

        // 1. Flooring & Walkway
        if (!(it && it.interior && it.interior.customized && it.interior.floors && Object.keys(it.interior.floors).length)) {
          // Weathered flagstone central walking aisle
          box('stone', 0, 0.006, 0, 0.34, 0.012, 0.96, '#78716c');
          // Cast-iron ornate drainage grates inset along the central path
          box('metal', 0, 0.013, -0.15, 0.22, 0.004, 0.12, '#334155', true);
          box('metal', 0, 0.013,  0.20, 0.22, 0.004, 0.12, '#334155', true);
          // Under-bench planting soil & pea gravel beds
          box('soil', -0.34, 0.005, 0, 0.26, 0.01, 0.96, '#3e2723');
          box('soil',  0.34, 0.005, 0, 0.26, 0.01, 0.96, '#3e2723');
          // Welcome coir boot mat at entrance
          box('fabric', 0, 0.012, 0.42, 0.28, 0.01, 0.12, '#b45309');
        }

        // 2. Weathered Terracotta Brick Dwarf Wall Perimeter with Sandstone Sill Coping
        // Left dwarf wall (cleanly butted inside front/rear walls, zero corner z-fighting)
        box('ceramic', -0.475, sillY / 2, 0, 0.05, sillY, 0.90, brickCol);
        box('stone', -0.475, sillY + 0.008, 0, 0.065, 0.016, 0.905, sillCol);
        // Right dwarf wall
        box('ceramic',  0.475, sillY / 2, 0, 0.05, sillY, 0.90, brickCol);
        box('stone',  0.475, sillY + 0.008, 0, 0.065, 0.016, 0.905, sillCol);
        // Rear dwarf wall
        box('ceramic', 0, sillY / 2, -0.475, 0.96, sillY, 0.05, brickCol);
        box('stone', 0, sillY + 0.008, -0.475, 0.97, 0.016, 0.065, sillCol);
        // Front dwarf wall wings (leaving central walk-in doorway clear)
        box('ceramic', -0.48 + fwW / 2, sillY / 2, 0.475, fwW, sillY, 0.05, brickCol);
        box('stone', -0.48 + fwW / 2, sillY + 0.008, 0.475, fwW + 0.01, 0.016, 0.065, sillCol);
        box('ceramic',  0.48 - fwW / 2, sillY / 2, 0.475, fwW, sillY, 0.05, brickCol);
        box('stone',  0.48 - fwW / 2, sillY + 0.008, 0.475, fwW + 0.01, 0.016, 0.065, sillCol);

        // 3. Structural Framing: Columns, Door Jambs, Eaves, Downspouts & Transoms
        // 4 Heavy Corner Columns (from ground up to eaves)
        for (const [cx, cz] of [[-0.48, -0.48], [0.48, -0.48], [-0.48, 0.48], [0.48, 0.48]]) {
          box('metal', cx, eaveY / 2, cz, 0.035, eaveY, 0.035, frameCol);
        }
        // Entrance door portal jambs and header
        box('metal', -doorHalfW, eaveY / 2, 0.48, 0.030, eaveY, 0.030, frameCol);
        box('metal',  doorHalfW, eaveY / 2, 0.48, 0.030, eaveY, 0.030, frameCol);
        box('metal', 0, doorHeaderY, 0.48, doorHalfW * 2, 0.024, 0.028, frameCol);
        // Ornamental corner brackets in entrance arch
        box('metal', -doorHalfW + 0.022, doorHeaderY - 0.022, 0.48, 0.022, 0.022, 0.018, frameCol);
        box('metal',  doorHalfW - 0.022, doorHeaderY - 0.022, 0.48, 0.022, 0.022, 0.018, frameCol);

        // Eaves perimeter beams at y = eaveY (cleanly butt-jointed at corners)
        box('metal', -0.48, eaveY, 0, 0.035, 0.025, 0.94, frameCol);
        box('metal',  0.48, eaveY, 0, 0.035, 0.025, 0.94, frameCol);
        box('metal', 0, eaveY, -0.48, 0.98, 0.025, 0.035, frameCol);
        box('metal', 0, eaveY,  0.48, 0.98, 0.025, 0.035, frameCol);

        // Half-round gutters along eaves with corner downspouts
        cylZ('metal', -0.495, eaveY - 0.005, 0, 0.022, 0.022, 0.98, '#475569', true);
        cylZ('metal',  0.495, eaveY - 0.005, 0, 0.022, 0.022, 0.98, '#475569', true);
        cyl('metal', -0.495, eaveY / 2, -0.48, 0.016, eaveY, 0.016, '#475569', true);
        cyl('metal',  0.495, eaveY / 2, -0.48, 0.016, eaveY, 0.016, '#475569', true);

        // Horizontal mid-wall glazing transoms at y = (sillY + eaveY) / 2
        const midTransomY = (sillY + eaveY) / 2;
        const wallH = eaveY - sillY;
        box('metal', -0.48, midTransomY, 0, 0.018, 0.016, 0.96, frameCol);
        box('metal',  0.48, midTransomY, 0, 0.018, 0.016, 0.96, frameCol);
        box('metal', 0, midTransomY, -0.48, 0.96, 0.016, 0.018, frameCol);
        box('metal', -0.48 + fwW / 2, midTransomY, 0.48, fwW, 0.016, 0.018, frameCol);
        box('metal',  0.48 - fwW / 2, midTransomY, 0.48, fwW, 0.016, 0.018, frameCol);

        // Vertical glazing mullions evenly spaced along walls
        for (const sz of [-0.32, -0.16, 0.00, 0.16, 0.32]) {
          box('metal', -0.48, midTransomY, sz, 0.018, wallH, 0.018, frameCol);
          box('metal',  0.48, midTransomY, sz, 0.018, wallH, 0.018, frameCol);
          box('metal', sz, midTransomY, -0.48, 0.018, wallH, 0.018, frameCol);
        }

        // 4. Transparent Wall Glass Panels (Double-Sided, from sillY to eaveY)
        box('glass', -0.48, midTransomY, 0, 0.005, wallH, 0.96, glassCol);
        box('glass',  0.48, midTransomY, 0, 0.005, wallH, 0.96, glassCol);
        box('glass', 0, midTransomY, -0.48, 0.96, wallH, 0.005, glassCol);
        box('glass', -0.48 + fwW / 2, midTransomY, 0.48, fwW - 0.01, wallH, 0.005, glassCol);
        box('glass',  0.48 - fwW / 2, midTransomY, 0.48, fwW - 0.01, wallH, 0.005, glassCol);
        // Transom glass above front entrance door
        box('glass', 0, (doorHeaderY + eaveY) / 2, 0.48, doorHalfW * 2 - 0.02, eaveY - doorHeaderY, 0.005, glassCol);

        // 5. Open French Double Doors (welcoming the player inside)
        const drawFrenchLeaf = (hx, hz, theta, isLeft) => {
          const L = doorHalfW * 0.94;
          const dH = doorHeaderY * 0.96;
          const th = 0.012; // slender metal frame thickness
          const glassTh = 0.004;
          const kickH = 0.08;
          const midY = dH * 0.44;
          const midH = 0.024;
          const topH = 0.024;
          const topY = dH - topH / 2;

          // Helper: rotated segment along the door leaf
          const rotPiece = (kind, dist, py, len, ph, pth, col, det, mat) => {
            const px = hx + (dist + len / 2) * Math.sin(theta);
            const pz = hz + (dist + len / 2) * Math.cos(theta);
            boxRot(kind, px, py, pz, pth, ph, len, theta, col, det, mat);
          };

          // Slender Stiles & Rails:
          // 1. Hinge Stile (vertical post at hinge edge)
          rotPiece('metal', 0, dH / 2, 0.016, dH, 0.016, frameCol);
          // 2. Latch Stile (vertical post at outer swing edge)
          rotPiece('metal', L - 0.016, dH / 2, 0.016, dH, 0.016, frameCol);
          // 3. Top Rail
          rotPiece('metal', 0.016, topY, L - 0.032, topH, th, frameCol);
          // 4. Bottom Kickplate (solid lower rail)
          rotPiece('metal', 0.016, kickH / 2, L - 0.032, kickH, th, frameCol);
          // 5. Mid Lock Rail
          rotPiece('metal', 0.016, midY, L - 0.032, midH, th, frameCol);

          // Crystal Clear Glazing Panels (filling between rails and stiles):
          const glassW = L - 0.032;
          const upGlassH = topY - topH / 2 - (midY + midH / 2);
          const upGlassY = (midY + midH / 2 + topY - topH / 2) / 2;
          rotPiece('glass', 0.016, upGlassY, glassW, upGlassH, glassTh, glassCol);

          const lowGlassH = midY - midH / 2 - kickH;
          const lowGlassY = (kickH + midY - midH / 2) / 2;
          rotPiece('glass', 0.016, lowGlassY, glassW, lowGlassH, glassTh, glassCol);

          // Delicate Glazing Bars (Mullions dividing into classic French panes)
          rotPiece('metal', 0.016 + glassW / 2 - 0.004, upGlassY, 0.008, upGlassH, th * 0.8, frameCol);
          rotPiece('metal', 0.016 + glassW / 2 - 0.004, lowGlassY, 0.008, lowGlassH, th * 0.8, frameCol);
          rotPiece('metal', 0.016, upGlassY, glassW, 0.008, th * 0.8, frameCol);

          // Polished Brass Lever Handle and Escutcheon Plate
          const hX = hx + (L - 0.010) * Math.sin(theta);
          const hZ = hz + (L - 0.010) * Math.cos(theta);
          boxRot('metal', hX, midY, hZ, 0.018, 0.05, 0.014, theta, '#f59e0b', true);
          cyl('metal', hX, midY, hZ, 0.014, 0.02, 0.014, '#d97706');
          rotPiece('metal', L - 0.025, midY, 0.024, 0.008, 0.008, '#f59e0b', true);
        };

        // Left door leaf (hinged at -doorHalfW, swung open neatly against left entrance jamb)
        drawFrenchLeaf(-doorHalfW, 0.475, Math.PI - 0.28, true);
        // Right door leaf (hinged at +doorHalfW, swung open neatly against right entrance jamb)
        drawFrenchLeaf(doorHalfW, 0.475, -(Math.PI - 0.28), false);

        // 6. Steep Vaulted Victorian Glass Roof: Connected Slopes, Triangular Gables & Rafters
        // High central roof ridge beam
        box('metal', 0, ridgeY, 0, 0.035, 0.024, 0.98, frameCol);

        // CONTINUOUS CONNECTED PITCHED GLASS ROOF PANELS (Left & Right Slopes)
        // From eaves beam at y = eaveY directly to the ridge beam at y = ridgeY
        boxSlope('glass', -0.48, eaveY, 0, 0, ridgeY, 0, 0.006, 0.96, glassCol);
        boxSlope('glass', 0, ridgeY, 0, 0.48, eaveY, 0, 0.006, 0.96, glassCol);

        // Front & rear gable end triangular glass panels (seamlessly closing gable ends)
        const gableH = ridgeY - eaveY;
        const gableY = (eaveY + ridgeY) / 2;
        part('gable', 'glass', 0, gableY,  0.48, 0.96, gableH, 0.005, glassCol);
        part('gable', 'glass', 0, gableY, -0.48, 0.96, gableH, 0.005, glassCol);

        // Sloped roof glazing rafters along the roof slopes (matching bay mullions)
        const rzs = [-0.48, -0.32, -0.16, 0.00, 0.16, 0.32, 0.48];
        for (const sz of rzs) {
          boxSlope('metal', -0.48, eaveY, sz, 0, ridgeY, sz, 0.016, 0.016, frameCol);
          boxSlope('metal', 0, ridgeY, sz, 0.48, eaveY, sz, 0.016, 0.016, frameCol);
        }
        // Front & rear heavy gable bargeboards
        for (const gz of [-0.48, 0.48]) {
          boxSlope('metal', -0.48, eaveY, gz, 0, ridgeY, gz, 0.022, 0.024, frameCol);
          boxSlope('metal', 0, ridgeY, gz, 0.48, eaveY, gz, 0.022, 0.024, frameCol);
        }

        // Horizontal mid-slope purlin glazing bars halfway up the roof slopes
        const midPurX = 0.24, midPurY = (eaveY + ridgeY) / 2;
        box('metal', -midPurX, midPurY, 0, 0.014, 0.014, 0.96, frameCol);
        box('metal',  midPurX, midPurY, 0, 0.014, 0.014, 0.96, frameCol);

        // Gable vertical king-post mullions and side struts
        box('metal', 0, gableY,  0.48, 0.020, gableH, 0.020, frameCol);
        box('metal', 0, gableY, -0.48, 0.020, gableH, 0.020, frameCol);
        const subH = gableH / 2;
        box('metal', -0.24, eaveY + subH / 2,  0.48, 0.016, subH, 0.016, frameCol);
        box('metal',  0.24, eaveY + subH / 2,  0.48, 0.016, subH, 0.016, frameCol);
        box('metal', -0.24, eaveY + subH / 2, -0.48, 0.016, subH, 0.016, frameCol);
        box('metal',  0.24, eaveY + subH / 2, -0.48, 0.016, subH, 0.016, frameCol);

        // Victorian fleur-de-lis ridge cresting along top spine
        box('metal', 0, ridgeY + 0.020, 0, 0.010, 0.020, 0.98, frameCol, true);
        for (let z = -0.42; z <= 0.42; z += 0.12) {
          part('cone', 'metal', 0, ridgeY + 0.042, z, 0.018, 0.035, 0.018, frameCol, true);
        }
        // Front & rear turned Victorian finial spires
        cyl('metal', 0, ridgeY + 0.042,  0.48, 0.024, 0.065, 0.024, frameCol, true);
        part('cone', 'metal', 0, ridgeY + 0.088,  0.48, 0.024, 0.045, 0.024, frameCol, true);
        cyl('metal', 0, ridgeY + 0.042, -0.48, 0.024, 0.065, 0.024, frameCol, true);
        part('cone', 'metal', 0, ridgeY + 0.088, -0.48, 0.024, 0.045, 0.024, frameCol, true);

        // Operable roof ridge vent windows propped open with brass stays
        boxSlope('metal', 0.02, ridgeY - 0.03,  0.10, 0.24, (eaveY + ridgeY) / 2 + 0.02,  0.10, 0.018, 0.20, frameCol, true);
        boxSlope('glass', 0.02, ridgeY - 0.025, 0.10, 0.24, (eaveY + ridgeY) / 2 + 0.025, 0.10, 0.005, 0.18, glassCol);
        cyl('metal', 0.22, (eaveY + ridgeY) / 2 + 0.01, 0.10, 0.008, 0.04, 0.008, '#f59e0b', true);
        boxSlope('metal', -0.24, (eaveY + ridgeY) / 2 + 0.02, -0.16, -0.02, ridgeY - 0.03, -0.16, 0.018, 0.20, frameCol, true);
        boxSlope('glass', -0.24, (eaveY + ridgeY) / 2 + 0.025, -0.16, -0.02, ridgeY - 0.025, -0.16, 0.005, 0.18, glassCol);
        cyl('metal', -0.22, (eaveY + ridgeY) / 2 + 0.01, -0.16, 0.008, 0.04, 0.008, '#f59e0b', true);

        // 7. Interior Two-Tier Cedar Staging Benches & Back Potting Table
        if (!(it && it.interior && it.interior.customized)) {
          // Left cedar staging bench
          box('wood', -0.34, 0.22, 0, 0.25, 0.020, 0.92, '#c28b58');
          box('wood', -0.34, 0.08, 0, 0.23, 0.016, 0.90, '#9a633a'); // under-shelf
          box('wood', -0.41, 0.32, 0, 0.11, 0.016, 0.88, '#d97706'); // upper tier riser shelf
          // Right cedar staging bench
          box('wood',  0.34, 0.22, 0, 0.25, 0.020, 0.92, '#c28b58');
          box('wood',  0.34, 0.08, 0, 0.23, 0.016, 0.90, '#9a633a');
          box('wood',  0.41, 0.32, 0, 0.11, 0.016, 0.88, '#d97706'); // upper tier riser shelf
          // Bench legs
          for (const lz of [-0.40, -0.15, 0.15, 0.40]) {
            box('wood', -0.44, 0.11, lz, 0.022, 0.22, 0.022, '#9a633a');
            box('wood', -0.24, 0.11, lz, 0.022, 0.22, 0.022, '#9a633a');
            box('wood',  0.44, 0.11, lz, 0.022, 0.22, 0.022, '#9a633a');
            box('wood',  0.24, 0.11, lz, 0.022, 0.22, 0.022, '#9a633a');
          }
          // Back master potting workstation
          box('wood', 0, 0.22, -0.41, 0.36, 0.022, 0.14, '#b45309');
          box('wood', 0, 0.25, -0.41, 0.30, 0.040, 0.12, '#9a633a');
          box('soil', 0, 0.26, -0.41, 0.28, 0.025, 0.10, '#3e2723');
          box('wood', 0, 0.38, -0.47, 0.36, 0.025, 0.015, '#c28b58'); // tool rack
          // Hand tools on back table: trowel & secateurs
          box('metal', -0.08, 0.24, -0.41, 0.025, 0.006, 0.05, '#94a3b8', true);
          cylZ('wood', -0.08, 0.24, -0.37, 0.010, 0.010, 0.035, '#78350f');
          box('metal',  0.08, 0.24, -0.41, 0.030, 0.006, 0.05, '#dc2626', true);

          // 8. Potted Plants, Flowers, Herbs, Succulents & Conservatory Decor
          // ON LEFT BENCH:
          // Potted coral pink geranium
          pCyl('ceramic', -0.32 * width, 0.22 * height + 3, -0.28 * depth, 15, 6, '#c26d38');
          pSphere('foliage', -0.32 * width, 0.22 * height + 8, -0.28 * depth, 16, '#15803d');
          pSphere('ceramic', -0.32 * width, 0.22 * height + 14, -0.28 * depth, 6, '#f43f5e');
          // Potted scarlet red geranium
          pCyl('ceramic', -0.32 * width, 0.22 * height + 3, 0.10 * depth, 15, 6, '#c26d38');
          pSphere('foliage', -0.32 * width, 0.22 * height + 8, 0.10 * depth, 16, '#166534');
          pSphere('ceramic', -0.32 * width, 0.22 * height + 14, 0.10 * depth, 6, '#ef4444');
          // English purple lavender pot
          pCyl('ceramic', -0.32 * width, 0.22 * height + 3, -0.08 * depth, 14, 6, '#c26d38');
          pSphere('foliage', -0.32 * width, 0.22 * height + 8, -0.08 * depth, 14, '#3b7a57');
          pCyl('fabric', -0.32 * width, 0.22 * height + 13, -0.08 * depth, 7, 6, '#a855f7');
          // Spreading lush Boston fern
          pCyl('ceramic', -0.32 * width, 0.22 * height + 3, 0.28 * depth, 16, 6, '#c26d38');
          pSphere('foliage', -0.32 * width, 0.22 * height + 9, 0.28 * depth, 20, '#15803d');
          // Vintage hammered copper watering can with brass rose
          pCyl('metal', -0.32 * width, 0.22 * height + 4.5, 0.38 * depth, 13, 9, '#b45309', true);
          pCyl('metal', -0.32 * width, 0.22 * height + 10, 0.38 * depth, 4, 3, '#f59e0b', true);
          cylX('metal', -0.26, 0.29, 0.38, 0.012, 0.055, 0.012, '#f59e0b', true);

          // ON LEFT UPPER SHELF:
          // Blooming magenta orchid in white ceramic pot
          pCyl('ceramic', -0.41 * width, 0.32 * height + 3, -0.20 * depth, 10, 6, '#f8fafc');
          pCyl('metal', -0.41 * width, 0.32 * height + 8, -0.20 * depth, 1.5, 7, '#166534');
          pSphere('ceramic', -0.41 * width, 0.32 * height + 13, -0.20 * depth, 6, '#ec4899');
          // African violet in sky-blue pot
          pCyl('ceramic', -0.41 * width, 0.32 * height + 2.5, 0.00 * depth, 10, 5, '#38bdf8');
          pSphere('foliage', -0.41 * width, 0.32 * height + 6.5, 0.00 * depth, 11, '#15803d');
          pSphere('ceramic', -0.41 * width, 0.32 * height + 10.5, 0.00 * depth, 5, '#8b5cf6');
          // Miniature jade plant
          pCyl('ceramic', -0.41 * width, 0.32 * height + 2.5, 0.18 * depth, 10, 5, '#c26d38');
          pSphere('foliage', -0.41 * width, 0.32 * height + 7, 0.18 * depth, 11, '#22c55e');

          // UNDER LEFT BENCH:
          // Stack of 3 nested terracotta pots
          pCyl('ceramic', -0.34 * width, 0.08 * height + 2, -0.20 * depth, 16, 4, '#c26d38');
          pCyl('ceramic', -0.34 * width, 0.08 * height + 5, -0.20 * depth, 14, 4, '#c26d38');
          pCyl('ceramic', -0.34 * width, 0.08 * height + 8, -0.20 * depth, 12, 4, '#c26d38');
          // Burlap jute sack of potting soil
          box('fabric', -0.34, 0.12, 0.12, 0.14, 0.08, 0.18, '#d4b483');
          box('soil', -0.34, 0.155, 0.12, 0.10, 0.02, 0.14, '#3e2723');

          // ON RIGHT BENCH:
          // Seedling propagation flat with bright lime-green sprouts
          box('dark', 0.32, 0.24, -0.28, 0.16, 0.020, 0.22, '#181b20');
          box('soil', 0.32, 0.25, -0.28, 0.14, 0.010, 0.20, '#451a03');
          box('foliage', 0.32, 0.265, -0.28, 0.12, 0.014, 0.18, '#84cc16');
          // Staked tomato vine with ripe red tomatoes
          pCyl('ceramic', 0.32 * width, 0.22 * height + 3, -0.06 * depth, 16, 6, '#c26d38');
          pCyl('wood', 0.32 * width, 0.22 * height + 13, -0.06 * depth, 2, 20, '#78350f');
          pSphere('foliage', 0.32 * width, 0.22 * height + 12, -0.06 * depth, 18, '#16a34a');
          pSphere('ceramic', 0.32 * width + 4, 0.22 * height + 10, -0.06 * depth + 3, 5, '#ef4444');
          pSphere('ceramic', 0.32 * width - 4, 0.22 * height + 14, -0.06 * depth - 2, 5, '#ef4444');
          pSphere('ceramic', 0.32 * width + 2, 0.22 * height + 17, -0.06 * depth + 3, 4.5, '#ef4444');
          // Glazed ceramic pot with culinary basil & rosemary
          pCyl('ceramic', 0.32 * width, 0.22 * height + 3, 0.12 * depth, 16, 6, '#e2ddd6');
          pSphere('foliage', 0.32 * width, 0.22 * height + 9, 0.12 * depth, 17, '#22c55e');
          // Victorian glass bell jar cloche covering tender sprout on saucer
          pCyl('ceramic', 0.32 * width, 0.22 * height + 2, 0.28 * depth, 15, 2, '#e2ddd6');
          pSphere('foliage', 0.32 * width, 0.22 * height + 4.5, 0.28 * depth, 6, '#84cc16');
          pCyl('glass', 0.32 * width, 0.22 * height + 6.5, 0.28 * depth, 13, 8, glassCol);
          pSphere('glass', 0.32 * width, 0.22 * height + 11.5, 0.28 * depth, 6, glassCol);
          // Amber glass mister bottle with brass thumb lever
          pCyl('glass', 0.32 * width, 0.22 * height + 3.5, 0.38 * depth, 7, 7, '#78350f', true);
          pCyl('metal', 0.32 * width, 0.22 * height + 8, 0.38 * depth, 3, 3, '#f59e0b', true);

          // ON RIGHT UPPER SHELF:
          // Round ball golden barrel cactus with yellow bloom
          pCyl('ceramic', 0.41 * width, 0.32 * height + 2.5, -0.22 * depth, 10, 5, '#c26d38');
          pSphere('foliage', 0.41 * width, 0.32 * height + 6.5, -0.22 * depth, 10, '#15803d');
          pSphere('ceramic', 0.41 * width, 0.32 * height + 11, -0.22 * depth, 4, '#f59e0b');
          // Blue-green echeveria rosette succulent
          pCyl('ceramic', 0.41 * width, 0.32 * height + 2.5, -0.05 * depth, 10, 5, '#e2ddd6');
          pSphere('foliage', 0.41 * width, 0.32 * height + 6, -0.05 * depth, 11, '#0d9488');
          // Aloe vera with pointed foliage
          pCyl('ceramic', 0.41 * width, 0.32 * height + 2.5, 0.12 * depth, 10, 5, '#c26d38');
          pCone('foliage', 0.41 * width, 0.32 * height + 7, 0.12 * depth, 9, 8, '#15803d');
          // Trailing string-of-pearls pot
          pCyl('ceramic', 0.41 * width, 0.32 * height + 2.5, 0.26 * depth, 10, 5, '#f8fafc');
          pSphere('foliage', 0.41 * width, 0.32 * height + 6, 0.26 * depth, 11, '#84cc16');
          pCyl('foliage', 0.41 * width - 2, 0.32 * height + 2, 0.26 * depth, 4, 7, '#65a30d');

          // Wall-mounted brass thermometer & hygrometer dial
          pCyl('metal', -0.19 * width, 0.46 * height, 0.47 * depth, 7, 2, '#f59e0b', true);
          pCyl('ceramic', -0.19 * width, 0.46 * height, 0.465 * depth, 6, 1.5, '#ffffff');
        }

        // 9. Ceiling Decorative Arched Trusses, Macrame Hanging Baskets & Grow Lamp
        for (const tz of [-0.20, 0.20]) {
          // Horizontal tie beam at eaves height
          box('metal', 0, eaveY, tz, 0.96, 0.018, 0.018, frameCol);
          // Vertical king-post rising to ridge
          box('metal', 0, (eaveY + ridgeY) / 2, tz, 0.018, ridgeY - eaveY, 0.018, frameCol);
          // Arched web struts
          boxSlope('metal', -0.32, eaveY, tz, 0, (eaveY + ridgeY) / 2 + 0.03, tz, 0.014, 0.014, frameCol);
          boxSlope('metal', 0, (eaveY + ridgeY) / 2 + 0.03, tz, 0.32, eaveY, tz, 0.014, 0.014, frameCol);

          // Suspended macrame hanging baskets trailing ivy & pothos (suspended cleanly below tie beam)
          const beamY = eaveY * height;
          const potY = Math.max(9, beamY - 12);
          const cordY = (beamY + potY) * 0.5;
          const cordH = Math.max(4, beamY - potY - 2);
          const ivyY = potY + 3.5;
          const trailY = potY - 4.0;
          pCyl('dark', -0.12 * width, cordY, tz * depth, 1.0, cordH, '#d4b483', true);
          pCyl('ceramic', -0.12 * width, potY, tz * depth, 12, 4.5, '#c26d38');
          pSphere('foliage', -0.12 * width, ivyY, tz * depth, 10, '#4ade80');
          pCyl('foliage', -0.12 * width, trailY, tz * depth, 4, 5, '#22c55e');

          pCyl('dark', 0.12 * width, cordY, tz * depth, 1.0, cordH, '#d4b483', true);
          pCyl('ceramic', 0.12 * width, potY, tz * depth, 12, 4.5, '#c26d38');
          pSphere('foliage', 0.12 * width, ivyY, tz * depth, 10, '#22c55e');
          pCyl('foliage', 0.12 * width, trailY, tz * depth, 4, 5, '#16a34a');
        }

        // Central vintage brass & glass hanging pendant grow lamp
        pCyl('metal', 0, (eaveY + ridgeY) / 2 * height + 2, 0, 1.5, (ridgeY - eaveY) * height - 2, '#f59e0b', true); // chain
        pCone('metal', 0, eaveY * height + 2, 0, 20, 6, '#1e293b', true); // industrial enamel shade
        pSphere('glow', 0, eaveY * height, 0, 8, '#fef08a'); // warm glowing light bulb

        // 10. Climbing English Ivy Winding Up the 4 Corner Iron Columns
        for (const [ix, iz] of [[-0.47, -0.47], [0.47, -0.47], [-0.47, 0.47], [0.47, 0.47]]) {
          pSphere('foliage', ix * width, 8, iz * depth, 12, '#15803d');
          pSphere('foliage', ix * width, 18, iz * depth, 11, '#166534');
          pSphere('foliage', ix * width, 28, iz * depth, 10, '#15803d');
          pSphere('foliage', ix * width, eaveY * height - 2, iz * depth, 12, '#16a34a');
        }
      } else if (/^scarecrow$/i.test(t)) {
        // Classic Burlap & Straw Garden Scarecrow on Timber Cross-Pole with Floppy Hat (1x1)
        cyl('wood', 0, 0.50, 0, 0.06, 0.98, 0.06, '#78350f');                  // vertical pole
        cylX('wood', 0, 0.72, 0, 0.84, 0.05, 0.05, '#78350f');                 // horizontal arm cross-beam
        // Burlap head & straw hair
        round('fabric', 0, 0.82, 0, 0.24, 0.24, 0.24, '#fde68a');
        cyl('fabric', 0, 0.94, 0, 0.44, 0.04, 0.44, '#b45309');               // floppy hat brim
        part('cone', 'fabric', 0, 1.04, 0, 0.28, 0.18, 0.28, '#b45309');
        // Plaid flannel shirt with straw tufts & denim overalls
        box('fabric', 0, 0.56, 0, 0.42, 0.38, 0.24, color || '#dc2626');
        box('fabric', 0, 0.40, 0, 0.38, 0.22, 0.22, '#1e3a8a');               // blue denim overalls
        cylX('fabric', 0, 0.72, 0, 0.88, 0.08, 0.08, '#fde68a');              // straw cuffs poking out sleeves

      } else if (/^rabbithutch$/i.test(t)) {
        // Two-Story Wooden Rabbit Hutch with Wire Mesh Run & Ramp (2x1 footprint)
        box('wood', 0, 0.44, 0, 0.94, 0.86, 0.88, color || '#b45309');
        part('roof', 'wood', 0, 0.92, 0, 0.98, 0.16, 0.94, '#451a03');         // green mineral felt roof
        // Wire mesh run door on left & enclosed nesting box door on right
        box('metal', -0.22, 0.44, 0.445, 0.42, 0.72, 0.02, '#cbd5e1', true);   // wire mesh
        box('wood', 0.22, 0.44, 0.445, 0.42, 0.72, 0.02, '#92400e');          // solid bedroom door
        // Gravity water bottle attached to mesh
        cyl('glass', -0.42, 0.54, 0.46, 0.06, 0.18, 0.06, '#38bdf8');

      } else if (/^chickencoop$/i.test(t)) {
        // Backyard Timber Chicken Coop with Elevated Roosting Box & Wire Run (2x2 footprint)
        // Elevated nesting coop
        box('wood', -0.20, 0.54, 0, 0.54, 0.68, 0.86, color || '#dc2626');
        part('roof', 'wood', -0.20, 0.94, 0, 0.60, 0.22, 0.92, '#451a03');
        // Chicken wire foraging run on right
        box('metal', 0.26, 0.34, 0, 0.44, 0.64, 0.84, '#cbd5e1');
        box('wood', 0, 0.24, 0.28, 0.12, 0.04, 0.48, '#fed7aa');              // entry ramp

      } else if (/^beehive$/i.test(t)) {
        // Traditional Langstroth Wooden Beehive Tower with Metal Telescoping Cover (1x1 footprint)
        box('wood', 0, 0.06, 0, 0.74, 0.08, 0.74, '#b45309');                 // screened bottom board
        box('wood', 0, 0.26, 0, 0.68, 0.28, 0.68, color || '#fde68a');        // deep brood box 1
        box('wood', 0, 0.54, 0, 0.68, 0.26, 0.68, color || '#fde68a');        // deep brood box 2
        box('wood', 0, 0.76, 0, 0.68, 0.18, 0.68, color || '#fde68a');        // honey super
        box('metal', 0, 0.88, 0, 0.72, 0.06, 0.72, '#cbd5e1', true);          // galvanized metal roof

      } else if (/^gardwell$/i.test(t)) {
        // Cobblestone Wishing Well with Timber Pitched Roof, Windlass Crank & Wooden Bucket (1x1)
        cyl('stone', 0, 0.26, 0, 0.84, 0.50, 0.84, color || '#94a3b8');       // stone well curb
        cyl('water', 0, 0.22, 0, 0.68, 0.02, 0.68, '#06b6d4');                 // deep water inside
        // Cedar upright roof posts & windlass axle
        for (const sx of [-0.36, 0.36]) {
          box('wood', sx, 0.58, 0, 0.06, 0.72, 0.06, '#78350f');
        }
        cyl('wood', 0, 0.62, 0, 0.08, 0.68, 0.08, '#b45309');                  // windlass axle
        cyl('metal', 0.40, 0.62, 0, 0.02, 0.14, 0.02, '#cbd5e1', true);       // iron crank
        part('roof', 'wood', 0, 1.02, 0, 0.94, 0.28, 0.88, '#451a03');         // gabled cedar roof
        // Wooden water bucket hanging on rope
        cyl('wood', 0, 0.44, 0, 0.16, 0.14, 0.16, '#92400e');

      } else if (/^birdfeeder$/i.test(t)) {
        // Hanging Cedar Hopper Bird Feeder with Clear Seed Windows (1x1 footprint)
        cyl('wood', 0, 0.40, 0, 0.06, 0.78, 0.06, '#78350f');                  // mounting post
        box('wood', 0, 0.74, 0, 0.48, 0.04, 0.48, color || '#b45309');        // seed perch tray
        box('glass', 0, 0.86, 0, 0.34, 0.22, 0.34, '#d8eef4');                // seed reservoir
        box('soil', 0, 0.82, 0, 0.30, 0.14, 0.30, '#fde68a');                  // wild bird seeds
        part('roof', 'wood', 0, 1.02, 0, 0.54, 0.16, 0.54, '#451a03');

      } else if (/^gardenbench$/i.test(t)) {
        // Ornate Cast-Iron & Teak Slatted Park Garden Bench (3x1 footprint)
        for (const sx of [-0.42, 0.42]) {
          box('metal', sx, 0.28, 0, 0.05, 0.54, 0.68, '#1e293b', true);       // cast-iron legs
          box('metal', sx, 0.56, 0, 0.05, 0.04, 0.64, '#1e293b', true);       // armrest
        }
        // Warm contoured teak wood slats across seat & backrest
        for (let s = 0; s < 4; s++) {
          box('wood', 0, 0.34, -0.16 + s * 0.10, 0.88, 0.03, 0.06, color || '#b45309'); // seat
        }
        for (let b = 0; b < 4; b++) {
          box('wood', 0, 0.48 + b * 0.08, -0.26, 0.88, 0.06, 0.03, color || '#b45309'); // back
        }

      } else if (/^birdhouse$/i.test(t)) {
        // Post-Mounted Pitched-Roof Cedar Birdhouse with Perch Peg (1x1 footprint)
        cyl('wood', 0, 0.38, 0, 0.05, 0.74, 0.05, '#78350f');                  // post
        box('wood', 0, 0.80, 0, 0.36, 0.38, 0.36, color || '#b45309');        // nesting cavity
        cyl('dark', 0, 0.86, 0.185, 0.08, 0.01, 0.08, '#181b1e');              // entrance hole
        cyl('wood', 0, 0.78, 0.22, 0.015, 0.08, 0.015, '#fed7aa');             // perch peg
        part('roof', 'wood', 0, 1.04, 0, 0.44, 0.18, 0.44, '#451a03');

      } else if (/^sundial$/i.test(t)) {
        // Cast Bronze Armillary Sphere Sundial on Carved Fluted Limestone Column (1x1 footprint)
        cyl('stone', 0, 0.12, 0, 0.44, 0.22, 0.44, color || '#cbd5e1');       // pedestal base
        cyl('stone', 0, 0.52, 0, 0.22, 0.62, 0.22, color || '#cbd5e1');       // fluted column
        cyl('metal', 0, 0.84, 0, 0.42, 0.04, 0.42, '#c9a44e', true);          // bronze dial plate
        // Armillary sphere celestial rings & angled gnomon shadow arrow
        cyl('metal', 0, 0.98, 0, 0.32, 0.02, 0.32, '#c9a44e', true);          // equatorial ring
        cyl('metal', 0, 0.98, 0, 0.02, 0.38, 0.02, '#c9a44e', true);          // gnomon axis

      } else if (/^flowerbox$/i.test(t)) {
        // Cedar Window/Deck Flower Box with Blooming Geraniums & Trailing Ivy (2x1 footprint)
        box('wood', 0, 0.28, 0, 0.94, 0.48, 0.68, color || '#b45309');
        box('soil', 0, 0.46, 0, 0.86, 0.14, 0.60, '#382218');
        round('foliage', 0, 0.58, 0, 0.84, 0.22, 0.64, '#16a34a');
        round('fabric', -0.22, 0.68, 0.10, 0.12, 0.10, 0.12, '#ec4899');       // pink geraniums
        round('fabric', 0.22, 0.68, -0.10, 0.12, 0.10, 0.12, '#ef4444');       // red geraniums

      } else if (/^plantertall$/i.test(t)) {
        // Modern Fluted Tall Architectural Planter with Snake Plant Foliage (1x1 footprint)
        cyl('ceramic', 0, 0.42, 0, 0.54, 0.82, 0.54, color || '#ffffff');     // tall planter
        cyl('soil', 0, 0.78, 0, 0.46, 0.10, 0.46, '#382218');
        // Architectural upright snake plant blades (sansevieria)
        for (let b = 0; b < 5; b++) {
          const bang = b * 1.25;
          const bx = Math.cos(bang) * 0.10, bz = Math.sin(bang) * 0.10;
          box('foliage', bx, 0.96, bz, 0.04, 0.44, 0.10, '#15803d');
          box('glow', bx, 0.96, bz, 0.042, 0.44, 0.015, '#eab308');            // yellow variegated edge
        }

      
      /* ---------------- FENCES & SCREENS (17 ITEMS) ---------------- */
      } else if (/^fencewood$/i.test(t)) {
        // Authentic Vertical Cedar Privacy Fence (4x1 footprint, square end posts with beveled caps, vertical boards, top capping)
        for (const sx of [-0.46, 0.46]) {
          box('wood', sx, 0.52, 0, 0.08, 1.04, 0.08, '#78350f');               // square posts
          part('roof', 'wood', sx, 1.06, 0, 0.10, 0.08, 0.10, '#592506');      // beveled post cap
        }
        // Top and bottom horizontal stringer rails
        box('wood', 0, 0.98, 0, 0.88, 0.05, 0.07, '#592506');                 // top capping rail
        box('wood', 0, 0.10, 0, 0.88, 0.05, 0.04, '#78350f');                 // bottom rail
        box('wood', 0, 0.86, -0.015, 0.88, 0.04, 0.03, '#78350f');            // upper backing rail
        // 11 Vertical tongue-and-groove cedar privacy planks matching the preview
        for (let p = 0; p < 11; p++) {
          const px = -0.40 + p * 0.08;
          const altOffset = (p % 2 === 0 ? 0.006 : -0.006);
          const plankCol = (p % 2 === 0 ? (color || '#b45309') : HP.shade(color || '#b45309', 0.92));
          box('wood', px, 0.52, altOffset, 0.075, 0.88, 0.03, plankCol);
        }

      } else if (/^picket$/i.test(t)) {
        // Classic White Gothic Picket Fence with Pointed Tips (4x1 footprint, dual horizontal backing rails)
        for (const sx of [-0.46, 0.46]) {
          box('wood', sx, 0.50, 0, 0.07, 0.98, 0.07, '#ffffff');               // main posts
          part('roof', 'wood', sx, 1.02, 0, 0.09, 0.08, 0.09, '#f8fafc');
        }
        // Dual horizontal backing stringer rails
        box('wood', 0, 0.24, -0.02, 0.88, 0.04, 0.03, '#ffffff');
        box('wood', 0, 0.72, -0.02, 0.88, 0.04, 0.03, '#ffffff');
        // 11 White pointed gothic pickets
        for (let p = 0; p < 11; p++) {
          const px = -0.40 + p * 0.08;
          box('wood', px, 0.46, 0.015, 0.05, 0.84, 0.02, color || '#ffffff');
          part('roof', 'wood', px, 0.91, 0.015, 0.05, 0.07, 0.02, color || '#ffffff'); // pointed gothic spear
        }

      } else if (/^ironfence$/i.test(t)) {
        // Ornate Victorian Wrought-Iron Spearhead Fence with Ball Finials (4x1 footprint)
        const ironCol = color || '#181b1e';
        // 1. Heavy square end posts with base plinths and ball finials
        for (const sx of [-0.46, 0.46]) {
          box('metal', sx, 0.52, 0, 0.065, 1.04, 0.065, ironCol);
          box('dark', sx, 0.02, 0, 0.09, 0.04, 0.09, '#0f172a');              // post ground shoe
          box('metal', sx, 1.04, 0, 0.08, 0.03, 0.08, '#c9a44e');              // brass post collar
          round('metal', sx, 1.08, 0, 0.075, 0.075, 0.075, '#c9a44e');         // gold ball finial
        }
        // 2. Dual continuous horizontal iron stringer rails connecting end posts
        box('metal', 0, 0.16, 0, 0.90, 0.035, 0.035, ironCol);                 // bottom rail
        box('metal', 0, 0.84, 0, 0.90, 0.035, 0.035, ironCol);                 // top rail
        // 3. Vertical spearhead balusters with fleur-de-lis tips spanning through rails
        for (let b = 0; b < 13; b++) {
          const bx = -0.42 + b * 0.07;
          cyl('metal', bx, 0.50, 0, 0.020, 0.86, 0.020, '#1e293b');             // vertical square picket
          part('cone', 'metal', bx, 0.96, 0, 0.035, 0.08, 0.035, '#c9a44e');    // gold spearhead tip
          box('metal', bx, 0.84, 0, 0.03, 0.04, 0.04, '#c9a44e');              // brass rail rosette collar
        }

      } else if (/^gardwall$/i.test(t)) {
        // Dry-Stacked Ashlar Fieldstone Garden Retaining Wall with Coping Stones (4x1 footprint)
        box('stone', 0, 0.46, 0, 0.96, 0.88, 0.84, color || '#94a3b8');
        box('stone', 0, 0.94, 0, 0.98, 0.08, 0.88, HP.shade(color || '#94a3b8', 1.14)); // coping stones
        // Surface stone block seams
        for (let l = 0; l < 4; l++) {
          box('dark', 0, 0.20 + l * 0.18, 0.425, 0.94, 0.01, 0.01, '#475569');
        }

      } else if (/^gate$/i.test(t)) {
        // Solid Cedar Garden Gate with Iron Strap Hinges & Thumb Latch (2x1 footprint)
        for (const sx of [-0.44, 0.44]) {
          box('wood', sx, 0.52, 0, 0.08, 1.04, 0.08, '#78350f');               // hinge & latch posts
        }
        // Gate door panel with Z-brace
        box('wood', 0, 0.48, 0, 0.76, 0.88, 0.04, color || '#b45309');
        box('wood', 0, 0.48, 0.025, 0.72, 0.06, 0.02, '#92400e');              // horizontal brace
        // Black iron long strap hinges
        box('metal', -0.22, 0.74, 0.03, 0.36, 0.04, 0.01, '#181b1e', true);
        box('metal', -0.22, 0.26, 0.03, 0.36, 0.04, 0.01, '#181b1e', true);
        box('metal', 0.28, 0.52, 0.03, 0.04, 0.12, 0.02, '#181b1e', true);    // thumb latch

      } else if (/^hedgefence$/i.test(t)) {
        // Continuous Dense Evergreen Privet Garden Hedge Border (4x1 footprint, height 30px, continuous planting trough, modular interlocking ends)
        const darkSoil = '#291b10';
        const deepGreen = '#14532d';
        const midGreen = color || '#166534';
        const lightGreen = HP.shade(color || '#166534', 1.18);
        const branchCol = '#422006';

        // 1. Continuous Ground Bedding Strip & Stone Coping Edges
        box('soil', 0, 0.02, 0, 1.0, 0.04, 0.90, darkSoil);
        for (const sz of [-0.44, 0.44]) {
          box('stone', 0, 0.03, sz, 1.0, 0.05, 0.04, '#64748b');
        }

        // 2. Interior Trunk Stems Array
        for (let bx = -0.42; bx <= 0.42; bx += 0.14) {
          cyl('wood', bx, 0.14, 0, 0.025, 0.22, 0.025, branchCol);
          boxRot('wood', bx + 0.02, 0.18, 0.02, 0.02, 0.12, 0.02, 0.35, branchCol);
        }

        // 3. Dense Interior Structural Foliage Core
        box('foliage', 0, 0.52, 0, 0.98, 0.82, 0.82, deepGreen);

        // 4. Rhythm of Billowing Foliage Lobes (Front & Rear)
        for (const sz of [-0.36, 0.36]) {
          for (let i = -5; i <= 5; i++) {
            const fx = i * 0.09;
            const fy1 = 0.38 + (Math.abs(i) % 2) * 0.06;
            const fy2 = 0.68 - (Math.abs(i) % 2) * 0.06;
            round('foliage', fx, fy1, sz, 0.16, 0.28, 0.18, midGreen);
            round('foliage', fx + 0.04, fy2, sz, 0.15, 0.26, 0.16, midGreen);
          }
        }
        // Lateral ends
        for (const sx of [-0.48, 0.48]) {
          round('foliage', sx, 0.52, 0, 0.08, 0.70, 0.74, midGreen);
        }

        // 5. Sunlit Manicured Top Crown & Bevel Ridge
        for (let i = -6; i <= 6; i++) {
          const cx = i * 0.075;
          const cz = (i % 2 === 0 ? 0.04 : -0.04);
          round('foliage', cx, 0.92, cz, 0.15, 0.18, 0.40, lightGreen);
        }
        box('foliage', 0, 0.92, 0, 0.98, 0.08, 0.68, lightGreen);

      } else if (/^brickfence$/i.test(t)) {
        // Fired Red Clay Brick Wall with Soldier Course Cap & End Piers (4x1 footprint)
        for (const sx of [-0.46, 0.46]) {
          box('stone', sx, 0.52, 0, 0.10, 1.04, 0.10, '#7c2f21');              // brick piers
          box('stone', sx, 1.05, 0, 0.12, 0.06, 0.12, '#d5cdc1');              // limestone pier cap
        }
        // Main brick wall with soldier course coping
        box('stone', 0, 0.48, 0, 0.86, 0.92, 0.44, color || '#8c382a');
        box('stone', 0, 0.96, 0, 0.88, 0.06, 0.48, '#592116');                 // soldier course cap

      } else if (/^whitefencewall$/i.test(t)) {
        // Modern & Mediterranean Smooth Stucco Privacy Wall with Architectural Coping (4x1 footprint, matching preview)
        for (const sx of [-0.46, 0.46]) {
          box('ceramic', sx, 0.52, 0, 0.10, 1.04, 0.54, color || '#efe9da');   // stucco end pilasters
          box('ceramic', sx, 1.05, 0, 0.12, 0.05, 0.56, '#ddd5c2');            // pilaster cap
        }
        // Smooth plastered stucco body
        box('ceramic', 0, 0.48, 0, 0.88, 0.94, 0.48, color || '#efe9da');
        // Clean architectural coping cap along top
        box('ceramic', 0, 0.97, 0, 0.96, 0.06, 0.52, '#ddd5c2');

      } else if (/^bamboofence$/i.test(t)) {
        // Japanese Takegaki Bamboo Screen with Black Hemp Cord Ties (4x1 footprint)
        box('wood', -0.46, 0.52, 0, 0.07, 1.04, 0.07, '#78350f');              // left cedar post
        box('wood', 0.46, 0.52, 0, 0.07, 1.04, 0.07, '#78350f');               // right cedar post
        // Top and bottom cedar rails
        box('wood', 0, 0.94, 0, 0.88, 0.05, 0.05, '#78350f');
        box('wood', 0, 0.10, 0, 0.88, 0.05, 0.05, '#78350f');
        // Array of vertical natural bamboo culms
        for (let b = 0; b < 16; b++) {
          const bx = -0.40 + b * 0.053;
          cyl('wood', bx, 0.52, 0, 0.036, 0.88, 0.036, color || '#eab308');
        }
        // Black hemp cord cross ties
        box('dark', 0, 0.74, 0.02, 0.88, 0.015, 0.015, '#181b1e');
        box('dark', 0, 0.32, 0.02, 0.88, 0.015, 0.015, '#181b1e');

      } else if (/^reedfence$/i.test(t)) {
        // Fine Woven Willow / Reed Privacy Screen Roll with Wire Lines (4x1 footprint)
        box('wood', -0.46, 0.50, 0, 0.06, 0.98, 0.06, '#78350f');
        box('wood', 0.46, 0.50, 0, 0.06, 0.98, 0.06, '#78350f');
        // Woven vertical reed screen body
        box('wood', 0, 0.50, 0, 0.88, 0.96, 0.05, color || '#d4a373');
        // 3 Galvanized horizontal binding wire lines
        for (let w = 0; w < 3; w++) {
          box('metal', 0, 0.22 + w * 0.28, 0.028, 0.88, 0.008, 0.008, '#cbd5e1', true);
        }

      } else if (/^chainlink$/i.test(t)) {
        // Commercial Galvanized Steel Chain-Link Fence (4x1 footprint, tubular steel line & end posts, continuous top rail, tension wire)
        // 1. Galvanized tubular steel posts (left, center, right) firmly grounded
        for (const sx of [-0.46, 0, 0.46]) {
          cyl('metal', sx, 0.50, 0, 0.045, 0.98, 0.045, '#cbd5e1');            // tubular post
          cyl('dark', sx, 0.02, 0, 0.065, 0.04, 0.065, '#334155');              // ground concrete foot
          round('metal', sx, 0.99, 0, 0.055, 0.035, 0.055, '#e2e8f0');          // aluminum loop cap
        }
        // 2. Continuous horizontal top pipe rail spanning across X through post loop caps
        cylX('metal', 0, 0.98, 0, 0.96, 0.038, 0.038, '#cbd5e1');
        // Bottom galvanized high-tensile tension wire along X
        cylX('metal', 0, 0.06, 0, 0.94, 0.016, 0.016, '#64748b');
        // 3. Woven galvanized steel wire diamond mesh infill
        box('glass', 0, 0.52, 0, 0.92, 0.88, 0.01, '#94a3b8');
        // End post tension bars & collar bands
        for (const sx of [-0.46, 0.46]) {
          cyl('metal', sx > 0 ? sx - 0.02 : sx + 0.02, 0.52, 0, 0.015, 0.86, 0.015, '#94a3b8');
        }

      } else if (/^latticefence$/i.test(t)) {
        // Diagonal Criss-Cross Cedar Garden Lattice Trellis Framed in Heavy Timber (4x1 footprint)
        const frameCol = '#78350f';
        const slatCol = color || '#d4a373';
        // Heavy timber upright end posts with pyramid caps
        for (const sx of [-0.46, 0.46]) {
          box('wood', sx, 0.50, 0, 0.08, 0.98, 0.08, frameCol);
          part('roof', 'wood', sx, 1.01, 0, 0.10, 0.06, 0.10, '#592506');      // beveled post cap
        }
        // Heavy top cap rail & bottom kick rail
        box('wood', 0, 0.96, 0, 0.88, 0.06, 0.06, frameCol);                   // top rail
        box('wood', 0, 0.06, 0, 0.88, 0.06, 0.06, frameCol);                   // bottom rail
        // Diagonal cedar lattice panel screen with perimeter frame surround
        box('wood', 0, 0.51, 0, 0.86, 0.84, 0.035, slatCol);
        // Molded perimeter reveal trim inside frame
        box('wood', 0, 0.51, 0.02, 0.84, 0.80, 0.01, HP.shade(slatCol, 0.88));

      } else if (/^ranchfence$/i.test(t)) {
        // 3-Rail Rustic Timber Post-and-Rail Equestrian Ranch Fence (4x1 footprint, 3 peeled cedar posts, mortised split rails)
        const timberCol = color || '#78350f';
        // 3 Grounded round peeled cedar posts (left, middle, right)
        for (const sx of [-0.46, 0, 0.46]) {
          cyl('wood', sx, 0.50, 0, 0.09, 1.00, 0.09, timberCol);
          round('wood', sx, 1.00, 0, 0.095, 0.04, 0.095, HP.shade(timberCol, 0.85)); // rounded post top
        }
        // 3 Horizontal split rails running through posts along X
        for (let r = 0; r < 3; r++) {
          const ry = 0.22 + r * 0.32;
          cylX('wood', 0, ry, 0, 0.98, 0.065, 0.065, HP.shade(timberCol, 1.05));
        }

      } else if (/^metalfence$/i.test(t)) {
        // Modern Architectural Horizontal Anthracite Dark Steel Slat Privacy Fence (4x1 footprint)
        for (const sx of [-0.46, 0.46]) {
          box('metal', sx, 0.50, 0, 0.06, 0.98, 0.06, '#0f172a');
        }
        // Horizontal powder-coated privacy slats with negative air reveals
        for (let s = 0; s < 8; s++) {
          box('metal', 0, 0.10 + s * 0.12, 0, 0.88, 0.08, 0.025, color || '#1e293b');
        }

      } else if (/^glassfence$/i.test(t)) {
        // Frameless 12mm Tempered Swimming Pool Glass Balustrade with 316-Stainless Spigots (4x1 footprint, zero floating parts)
        // Heavy marine-grade 2205 stainless steel friction clamp spigots firmly on ground
        for (const sx of [-0.30, 0.30]) {
          // Floor base escutcheon ring
          cyl('metal', sx, 0.015, 0, 0.11, 0.03, 0.11, '#e2e8f0');
          // Vertical square friction spigot clamp body
          box('metal', sx, 0.14, 0, 0.065, 0.24, 0.085, '#cbd5e1');
          // Internal black silicone glass compression cushion
          box('dark', sx, 0.16, 0, 0.068, 0.18, 0.032, '#0f172a');
        }
        // Thick clear tempered architectural safety glass panel
        box('glass', 0, 0.58, 0, 0.96, 0.84, 0.025, '#38bdf8');
        // Brushed stainless steel slim micro-top cap / handrail channel
        box('metal', 0, 0.99, 0, 0.96, 0.02, 0.03, '#cbd5e1');

      } else if (/^ropefence$/i.test(t)) {
        // Nautical Turned Timber Bollard Posts with Swaged Manila Hemp Ropes (4x1 footprint)
        const bollardCol = color || '#78350f';
        // 3 Grounded turned timber bollards (left, middle, right)
        for (const sx of [-0.44, 0, 0.44]) {
          cyl('wood', sx, 0.42, 0, 0.13, 0.84, 0.13, bollardCol);                // main bollard
          round('wood', sx, 0.84, 0, 0.14, 0.07, 0.14, HP.shade(bollardCol, 0.85)); // rounded bollard top
          cyl('dark', sx, 0.02, 0, 0.15, 0.04, 0.15, '#181b1e');                // ground collar
          // Copper grommet collars for rope holes
          cylZ('metal', sx, 0.64, 0, 0.065, 0.065, 0.14, '#c9a44e');
          cylZ('metal', sx, 0.36, 0, 0.065, 0.065, 0.14, '#c9a44e');
        }
        // Dual 2-inch natural manila hemp ropes running horizontally along X through bollards
        // Upper rope at y=0.64
        cylX('fabric', -0.22, 0.63, 0, 0.44, 0.042, 0.042, '#fed7aa');
        cylX('fabric', 0.22, 0.63, 0, 0.44, 0.042, 0.042, '#fed7aa');
        // Lower rope at y=0.36
        cylX('fabric', -0.22, 0.35, 0, 0.44, 0.040, 0.040, '#fed7aa');
        cylX('fabric', 0.22, 0.35, 0, 0.44, 0.040, 0.040, '#fed7aa');

      } else if (/^stoneedge$/i.test(t)) {
        // Rustic Granite Boulder River Rock Garden Bed Edge Curbing (4x1 footprint)
        for (let r = 0; r < 7; r++) {
          const rx = -0.42 + r * 0.14;
          const rRadius = 0.08 + (r % 3) * 0.02;
          round('stone', rx, rRadius, (r % 2 === 0 ? 0.02 : -0.02), rRadius * 2, rRadius * 1.8, rRadius * 2, color || '#94a3b8');
        }

      /* ---------------- MODULAR SOFA SYSTEM (6 ITEMS) ---------------- */
      } else if (/^modseat$/i.test(t)) {
        // Armless Modular Lounge Sofa Seat Module (2x2 footprint, deep bouclé cushion, recessed plinth)
        box('dark', 0, 0.04, 0, 0.96, 0.08, 0.96, '#15171a');                 // shadow plinth
        box('fabric', 0, 0.36, 0, 0.96, 0.56, 0.96, color || '#475569');      // seat base
        box('fabric', 0, 0.54, 0.06, 0.94, 0.20, 0.84, HP.shade(color || '#475569', 1.08)); // plush cushion
        box('fabric', 0, 0.76, -0.36, 0.96, 0.44, 0.24, color || '#475569');   // backrest

      } else if (/^modarmL$/i.test(t)) {
        // Left-Arm Modular Sofa End Module (2x2 footprint, wide low track armrest on left)
        box('dark', 0, 0.04, 0, 0.96, 0.08, 0.96, '#15171a');
        box('fabric', 0.10, 0.36, 0, 0.76, 0.56, 0.96, color || '#475569');
        box('fabric', 0.10, 0.54, 0.06, 0.74, 0.20, 0.84, HP.shade(color || '#475569', 1.08));
        box('fabric', 0.10, 0.76, -0.36, 0.76, 0.44, 0.24, color || '#475569');
        // Wide padded left armrest
        box('fabric', -0.38, 0.60, 0, 0.20, 0.52, 0.96, HP.shade(color || '#475569', 0.96));

      } else if (/^modarmR$/i.test(t)) {
        // Right-Arm Modular Sofa End Module (2x2 footprint, wide low track armrest on right)
        box('dark', 0, 0.04, 0, 0.96, 0.08, 0.96, '#15171a');
        box('fabric', -0.10, 0.36, 0, 0.76, 0.56, 0.96, color || '#475569');
        box('fabric', -0.10, 0.54, 0.06, 0.74, 0.20, 0.84, HP.shade(color || '#475569', 1.08));
        box('fabric', -0.10, 0.76, -0.36, 0.76, 0.44, 0.24, color || '#475569');
        // Wide padded right armrest
        box('fabric', 0.38, 0.60, 0, 0.20, 0.52, 0.96, HP.shade(color || '#475569', 0.96));

      } else if (/^modcorner$/i.test(t)) {
        // 90-Degree Modular Sofa Corner Module (2x2 footprint, L-shaped wrapping backrest, throw pillow)
        box('dark', 0, 0.04, 0, 0.96, 0.08, 0.96, '#15171a');
        box('fabric', 0, 0.36, 0, 0.96, 0.56, 0.96, color || '#475569');
        box('fabric', 0.06, 0.54, 0.06, 0.84, 0.20, 0.84, HP.shade(color || '#475569', 1.08));
        // L-shaped wrapping corner backrest
        box('fabric', 0, 0.76, -0.36, 0.96, 0.44, 0.24, color || '#475569');  // back wall
        box('fabric', -0.36, 0.76, 0, 0.24, 0.44, 0.96, color || '#475569');   // left wall
        // Fluffy corner accent throw pillow
        box('fabric', -0.16, 0.64, -0.16, 0.28, 0.24, 0.28, '#f59e0b');

      } else if (/^modchaise$/i.test(t)) {
        // Extended Modular Chaise Lounge Module (2x2 footprint, elongated daybed cushion)
        box('dark', 0, 0.04, 0, 0.96, 0.08, 0.96, '#15171a');
        box('fabric', 0, 0.36, 0, 0.96, 0.56, 0.96, color || '#475569');
        box('fabric', 0, 0.54, 0, 0.94, 0.20, 0.94, HP.shade(color || '#475569', 1.08)); // full-length cushion
        box('fabric', 0, 0.76, -0.38, 0.96, 0.44, 0.20, color || '#475569');  // backrest

      } else if (/^modtable$/i.test(t)) {
        // Low Square Walnut Modular Connecting Table with Recessed Tray (2x2 footprint)
        box('dark', 0, 0.04, 0, 0.94, 0.08, 0.94, '#15171a');
        box('wood', 0, 0.36, 0, 0.96, 0.56, 0.96, color || '#451a03');        // walnut cube
        box('wood', 0, 0.65, 0, 0.92, 0.04, 0.92, '#78350f');                  // recessed tray rim
        box('dark', 0, 0.675, 0, 0.86, 0.01, 0.86, '#181b1e');                 // leather inlay tray

      
      /* ---------------- LIVING EXTRAS & SPECIALTY FURNITURE ---------------- */
      } else if (/^console$/i.test(t)) {
        // Slim Mid-Century Modern Entryway Console Table with Fluted Drawers (2x1 footprint)
        for (const [lx, lz] of [[-0.42, -0.34], [0.42, -0.34], [-0.42, 0.34], [0.42, 0.34]]) {
          cyl('metal', lx, 0.32, lz, 0.035, 0.64, 0.035, '#1e293b', true);     // tapered steel legs
          cyl('metal', lx, 0.02, lz, 0.045, 0.04, 0.045, '#c9a44e', true);     // brass feet
        }
        box('wood', 0, 0.72, 0, 0.94, 0.20, 0.86, color || '#78350f');         // fluted walnut body
        box('ceramic', 0, 0.83, 0, 0.96, 0.03, 0.88, '#f8fafc');              // white marble top
        box('metal', -0.22, 0.72, 0.435, 0.08, 0.015, 0.015, '#c9a44e', true); // brass pull
        box('metal', 0.22, 0.72, 0.435, 0.08, 0.015, 0.015, '#c9a44e', true);

      } else if (/^shoecab$/i.test(t)) {
        // Modern Slim Fluted Entryway Shoe Storage Cabinet with Brass Stilt Legs & Catchall Tray (2x1 footprint)
        // Authentic slim depth (~0.52 cell depth = 26cm)
        const cabCol = color || '#8a6844';

        // 1. Sleek tapered metal stilt legs (elevated off the floor by y=0 to 0.16)
        for (const [lx, lz] of [[-0.42, 0.20], [0.42, 0.20], [-0.42, -0.20], [0.42, -0.20]]) {
          cyl('metal', lx, 0.08, lz, 0.025, 0.16, 0.025, '#c9a44e', true);    // brushed brass stilt leg
          cyl('dark', lx, 0.015, lz, 0.03, 0.03, 0.03, '#1e2124');             // black foot glide
        }
        // Under-cabinet support stretcher frame
        box('dark', 0, 0.155, 0, 0.86, 0.02, 0.44, '#181b1e');

        // 2. Hollow carcass with open front for tilt-out compartments
        // Left & right gable walls
        box('wood', -0.44, 0.535, 0, 0.04, 0.73, 0.48, cabCol);
        box('wood', 0.44, 0.535, 0, 0.04, 0.73, 0.48, cabCol);
        // Bottom base panel
        box('wood', 0, 0.175, 0, 0.86, 0.03, 0.48, cabCol);
        // Top under-rail
        box('wood', 0, 0.895, 0, 0.86, 0.03, 0.48, cabCol);
        // Finished back panel
        box('wood', 0, 0.535, -0.225, 0.86, 0.73, 0.03, HP.shade(cabCol, 0.85));
        // Center vertical divider
        box('wood', 0, 0.535, 0, 0.035, 0.73, 0.46, cabCol);
        // Middle horizontal shelf divider
        box('wood', 0, 0.53, 0, 0.86, 0.03, 0.44, HP.shade(cabCol, 0.9));
        // Interior dark cavity backing
        box('dark', 0, 0.535, -0.205, 0.84, 0.70, 0.02, '#141619');

        // 3. Beveled top console surface (natural wood slab with slight perimeter overhang)
        box('wood', 0, 0.925, 0, 0.94, 0.035, 0.52, HP.shade(cabCol, 1.15));

        // 5. Entryway console styling: minimalist ceramic key catchall dish + succulent pot
        // Ceramic catchall tray
        box('ceramic', -0.24, 0.95, 0, 0.24, 0.018, 0.24, '#f8fafc');
        box('metal', -0.24, 0.963, 0, 0.08, 0.008, 0.03, '#c9a44e', true);   // brass house key
        // Ceramic pot with miniature green succulent
        cyl('ceramic', 0.26, 0.965, 0, 0.09, 0.05, 0.09, '#f1f5f9');
        round('fabric', 0.26, 1.005, 0, 0.08, 0.055, 0.08, '#4d7c0f');        // succulent foliage

      } else if (/^barcart$/i.test(t)) {
        // 2-Tier Art Deco Rolling Brass Bar Cart with Glass Shelves & Liquor Decanters (1x1)
        for (const [lx, lz] of [[-0.34, -0.34], [0.34, -0.34], [-0.34, 0.34], [0.34, 0.34]]) {
          cyl('metal', lx, 0.42, lz, 0.03, 0.84, 0.03, '#c9a44e', true);       // brass frame
          cyl('dark', lx, 0.04, lz, 0.08, 0.04, 0.08, '#181b1e');              // casters
        }
        // Dual mirrored glass shelves
        box('glass', 0, 0.24, 0, 0.74, 0.02, 0.74, '#d8eef4');                 // lower shelf
        box('glass', 0, 0.78, 0, 0.74, 0.02, 0.74, '#d8eef4');                 // upper shelf
        // Curved brass push handle
        box('metal', 0, 0.88, -0.38, 0.68, 0.03, 0.06, '#c9a44e', true);
        // Crystal liquor decanter & cocktail shaker
        cyl('glass', -0.16, 0.88, 0, 0.12, 0.18, 0.12, '#38bdf8');             // decanter
        round('glass', -0.16, 0.98, 0, 0.08, 0.08, 0.08, '#c9a44e');          // stopper
        cyl('metal', 0.16, 0.88, 0, 0.10, 0.18, 0.10, '#cbd5e1', true);        // shaker

      } else if (/^petbed$/i.test(t)) {
        // Luxury Orthopaedic Donut Bolster Pet Bed with Plush Sherpa Lining & Chew Toy (1x1 footprint)
        // 1. Non-slip floor base pad & piped bottom perimeter
        cyl('dark', 0, 0.02, 0, 0.90, 0.04, 0.90, '#1e293b');
        cyl('fabric', 0, 0.05, 0, 0.92, 0.03, 0.92, HP.shade(color || '#64748b', 0.85)); // bottom piping
        // 2. High plump bolster ring (back and sides)
        cyl('fabric', 0, 0.20, -0.06, 0.88, 0.32, 0.82, color || '#64748b');
        // Lowered front entrance scoop
        box('fabric', 0, 0.12, 0.32, 0.44, 0.18, 0.24, color || '#64748b');
        // 3. Sunken ultra-soft sherpa fleece sleeping cushion
        cyl('fabric', 0, 0.14, 0, 0.66, 0.16, 0.66, '#faf5ee');
        // Tufting indentation buttons on center cushion
        for (const [tx, tz] of [[-0.12, -0.08], [0.12, -0.08], [0, 0.10]]) {
          cyl('fabric', tx, 0.19, tz, 0.04, 0.02, 0.04, '#e2d9cc');
        }
        // 4. Stitched genuine leather brand patch with brass rivet on front side
        box('wood', 0.28, 0.18, 0.36, 0.08, 0.05, 0.015, '#92400e', true);
        cyl('metal', 0.28, 0.18, 0.37, 0.012, 0.012, 0.012, '#c9a44e', true);
        // 5. Plush fabric bone chew toy nestled on the cushion
        cylX('fabric', -0.10, 0.21, 0.08, 0.14, 0.04, 0.04, '#f87171');
        round('fabric', -0.17, 0.21, 0.06, 0.04, 0.04, 0.04, '#ef4444');
        round('fabric', -0.17, 0.21, 0.10, 0.04, 0.04, 0.04, '#ef4444');
        round('fabric', -0.03, 0.21, 0.06, 0.04, 0.04, 0.04, '#ef4444');
        round('fabric', -0.03, 0.21, 0.10, 0.04, 0.04, 0.04, '#ef4444');

      } else if (/^cattree$/i.test(t)) {
        // Multi-Level Luxury Cat Tree with Condo, Hammock, and Sisal Scratching Posts (1x1 footprint)
        box('fabric', 0, 0.04, 0, 0.88, 0.08, 0.88, '#f5f5f4');               // plush floor base
        // Sisal rope wrapped vertical scratching posts
        cyl('wood', -0.24, 0.36, -0.24, 0.09, 0.64, 0.09, '#fed7aa');
        cyl('wood', 0.24, 0.54, 0.24, 0.09, 0.98, 0.09, '#fed7aa');
        // Plush cat condo house at mid height
        box('fabric', -0.20, 0.44, 0, 0.44, 0.38, 0.44, color || '#a8a29e');
        cyl('dark', -0.20, 0.44, 0.225, 0.18, 0.01, 0.18, '#181b1e');          // entrance hole
        // Top cushioned lookout perch bed
        cyl('fabric', 0.20, 0.86, 0.20, 0.42, 0.10, 0.42, color || '#a8a29e');

      } else if (/^beanbag$/i.test(t)) {
        // High-End Slouched Velvet Lounger Bean Bag with Ergonomic Sunken Basin, Piped French Seams & Leather Grab Handle (1x1 footprint)
        const cDark = HP.shade(color, 0.82);
        const cDeep = HP.shade(color, 0.72);
        const cLight = HP.shade(color, 1.08);
        const cHighlight = HP.shade(color, 1.15);

        // 1. Settled Wide Base & Floor Gathering Folds (organic pooling under gravity)
        // Bottom perimeter puddle roll (subtle horizontal bulging rim against the floor)
        round('fabric', 0, 0.14, 0.02, 0.94, 0.26, 0.94, HP.shade(color, 0.90));
        // Main structural base bean mound
        round('fabric', 0, 0.24, 0.02, 0.90, 0.42, 0.90, color);
        // Front apron expansion (beans settling forward between sitter's calves)
        round('fabric', 0, 0.20, 0.22, 0.78, 0.34, 0.52, color);

        // 2. Sculpted Deep Ergonomic Seat Basin (Sunken form-fitting nest)
        // Soft front waterfall thigh roll
        round('fabric', 0, 0.22, 0.30, 0.74, 0.24, 0.36, cLight);
        // Sunken seating depression
        round('fabric', 0, 0.27, 0.08, 0.68, 0.18, 0.62, cDark);
        // Deep inner compression shadow dimple where the body sinks in
        round('dark', 0, 0.26, 0.08, 0.46, 0.07, 0.44, cDeep);

        // 3. Plump Contoured Side Arm Bolsters (Left & Right Huggers)
        for (const sx of [-1, 1]) {
          // Main flared side arm lobe
          round('fabric', sx * 0.33, 0.34, 0.04, 0.32, 0.38, 0.68, cLight);
          // Inner arm cradle transition
          round('fabric', sx * 0.26, 0.30, 0.12, 0.22, 0.30, 0.48, color);
          // Outer lower fullness
          round('fabric', sx * 0.38, 0.22, 0.04, 0.20, 0.32, 0.60, HP.shade(color, 0.94));
        }

        // 4. Broad Ergonomic Slouched Backrest & Shoulder Crown
        // Lower lumbar support bolster (wide, plump cushion spanning across the back)
        cylX('fabric', 0, 0.42, -0.10, 0.76, 0.38, 0.50, color);
        round('fabric', -0.36, 0.42, -0.10, 0.22, 0.36, 0.46, cLight);
        round('fabric', 0.36, 0.42, -0.10, 0.22, 0.36, 0.46, cLight);

        // Mid-back support cushion (inward leaning angle, generous shoulder width)
        cylX('fabric', 0, 0.64, -0.16, 0.66, 0.34, 0.44, cHighlight);
        round('fabric', -0.31, 0.64, -0.16, 0.20, 0.32, 0.40, cHighlight);
        round('fabric', 0.31, 0.64, -0.16, 0.20, 0.32, 0.40, cHighlight);

        // Upper headrest crown roll (broad, pillowy top)
        cylX('fabric', 0, 0.82, -0.21, 0.52, 0.26, 0.36, cHighlight);
        round('fabric', -0.24, 0.82, -0.21, 0.18, 0.24, 0.32, cHighlight);
        round('fabric', 0.24, 0.82, -0.21, 0.18, 0.24, 0.32, cHighlight);

        // Rear gravity slump (generous pooling of beads at the back base)
        round('fabric', 0, 0.34, -0.28, 0.82, 0.46, 0.46, HP.shade(color, 0.94));
        round('fabric', 0, 0.56, -0.25, 0.68, 0.40, 0.38, HP.shade(color, 0.96));

        // 5. Tailored French Piped Welt Seams (Craftsmanship structural definition)
        // Profile piping contouring up both flanks from seat to top crown
        for (const sx of [-1, 1]) {
          boxSlopeYZ('fabric', sx * 0.36, 0.22, 0.26, 0.84, -0.21, 0.024, 0.024, cDark, true);
        }
        // Horseshoe seam defining the sunken seating basin
        cylX('fabric', 0, 0.27, 0.34, 0.52, 0.022, 0.022, cDark, true);        // front seam
        cylZ('fabric', -0.26, 0.30, 0.12, 0.022, 0.44, 0.022, cDark, true);      // left seam
        cylZ('fabric', 0.26, 0.30, 0.12, 0.022, 0.44, 0.022, cDark, true);       // right seam
        cylX('fabric', 0, 0.38, -0.07, 0.54, 0.024, 0.024, cDark, true);       // back lumbar crease welt
        // Horizontal backrest contour channel welts
        cylX('fabric', 0, 0.53, -0.13, 0.66, 0.022, 0.022, cDark, true);       // mid-back channel
        cylX('fabric', 0, 0.73, -0.19, 0.54, 0.022, 0.022, cDark, true);       // upper-back channel
        // Top crown arched seam
        cylX('fabric', 0, 0.88, -0.21, 0.32, 0.024, 0.024, cDark, true);

        // 6. Natural Slouched Fabric Pleats & Wrinkles
        // Horizontal compression gathers where back meets seat
        cylX('fabric', 0, 0.33, 0.01, 0.42, 0.035, 0.07, cDark, true);
        cylX('fabric', 0, 0.41, -0.08, 0.36, 0.030, 0.06, cDark, true);
        // Diagonal side gathering folds
        boxSlope('fabric', -0.32, 0.26, 0.16, -0.25, 0.34, 0.02, 0.024, 0.024, cDark, true);
        boxSlope('fabric', 0.32, 0.26, 0.16, 0.25, 0.34, 0.02, 0.024, 0.024, cDark, true);

        // 7. Saddle Leather Top Carry Handle with Solid Brass Rivets
        for (const sx of [-0.09, 0.09]) {
          box('wood', sx, 0.91, -0.21, 0.032, 0.035, 0.04, '#5c2d10', true);
          cylZ('metal', sx, 0.91, -0.19, 0.014, 0.014, 0.01, '#c9a44e', true);
        }
        // Arched leather grab handle strap
        box('wood', 0, 0.96, -0.21, 0.16, 0.022, 0.035, '#78350f', true);
        boxSlope('wood', -0.09, 0.91, -0.21, -0.07, 0.96, -0.21, 0.022, 0.035, '#6b2f0e', true);
        boxSlope('wood', 0.09, 0.91, -0.21, 0.07, 0.96, -0.21, 0.022, 0.035, '#6b2f0e', true);

        // 8. Designer Brand Woven Tag & Bottom Zipper Welt
        // Ivory fabric flag tag inserted into right side welt seam
        box('fabric', 0.355, 0.34, 0.10, 0.035, 0.04, 0.005, '#f5f5f4', true);
        box('dark', 0.356, 0.34, 0.10, 0.018, 0.012, 0.006, '#181b1e', true);
        // Concealed bottom safety zipper welt at rear base
        box('dark', 0, 0.04, -0.44, 0.30, 0.018, 0.025, '#292524', true);

      } else if (/^hifi$/i.test(t)) {
        // Audiophile Vintage Hi-Fi Stereo Console with Turntable & Dual Walnut Tower Speakers (2x1)
        // Center stereo amplifier receiver & turntable
        box('wood', 0, 0.38, 0, 0.46, 0.68, 0.82, '#451a03');                 // console cabinet
        box('metal', 0, 0.58, 0.415, 0.40, 0.22, 0.01, '#c9a44e', true);      // gold amplifier faceplate
        cyl('dark', 0, 0.74, 0, 0.34, 0.04, 0.34, '#181b1e');                  // vinyl turntable platter
        // Dual walnut tower speaker cabinets on left and right
        for (const sx of [-0.38, 0.38]) {
          box('wood', sx, 0.48, 0, 0.26, 0.94, 0.76, color || '#78350f');
          box('fabric', sx, 0.48, 0.385, 0.22, 0.86, 0.02, '#181b1e');        // speaker grille cloth
          cylZ('metal', sx, 0.32, 0.395, 0.14, 0.14, 0.01, '#eab308', true);    // yellow Kevlar woofer
          cylZ('metal', sx, 0.74, 0.395, 0.06, 0.06, 0.01, '#cbd5e1', true);    // silk dome tweeter
        }

      } else if (/^statue$/i.test(t)) {
        // Contemporary Monolithic Abstract Gallery Sculpture in Honed Black Basalt (1x1 footprint)
        box('stone', 0, 0.12, 0, 0.54, 0.22, 0.54, '#cbd5e1');                 // white marble pedestal
        box('stone', 0, 0.54, 0, 0.28, 0.64, 0.28, color || '#181b1e');        // twisted basalt spire
        round('stone', 0, 0.88, 0, 0.26, 0.22, 0.26, color || '#181b1e');

      } else if (/^vase$/i.test(t)) {
        // Minimalist Handcrafted Fluted Ceramic Floor Amphora Vase with Dried Botanicals (1x1)
        cyl('ceramic', 0, 0.42, 0, 0.46, 0.80, 0.46, color || '#e2e8f0');
        cyl('ceramic', 0, 0.84, 0, 0.26, 0.12, 0.26, color || '#e2e8f0');     // neck & lip
        cyl('wood', 0, 0.98, 0, 0.02, 0.38, 0.02, '#b45309');                  // pampas grass stem
        round('fabric', 0, 1.12, 0, 0.14, 0.22, 0.14, '#fef3c7');              // fluffy pampas plume

      } else if (/^umbstand$/i.test(t)) {
        // Cylindrical Hammered Brass Umbrella Stand with Carved Walking Sticks (1x1 footprint)
        cyl('metal', 0, 0.44, 0, 0.44, 0.84, 0.44, color || '#c9a44e', true);  // hammered brass cylinder
        cyl('dark', 0, 0.86, 0, 0.38, 0.02, 0.38, '#181b1e');                  // open top rim
        // Curved walking sticks & closed umbrella inside
        cyl('wood', -0.08, 0.88, -0.06, 0.025, 0.68, 0.025, '#451a03');
        box('fabric', 0.08, 0.72, 0.06, 0.08, 0.62, 0.08, '#1e293b');          // folded black umbrella

      } else if (/^doormat$/i.test(t)) {
        // Natural Coconut Coir Fiber Entrance Doormat with Heavy Black Rubber Border (1x1 footprint)
        box('dark', 0, 0.015, 0, 0.92, 0.03, 0.68, '#181b1e');                 // rubber border
        box('soil', 0, 0.025, 0, 0.84, 0.02, 0.60, color || '#d4a373');        // natural coir bristles

      } else if (/^woodstove$/i.test(t)) {
        // Scandinavian Cast-Iron Airtight Wood-Burning Stove with Glass Door & Flue Pipe (1x1 footprint)
        box('metal', 0, 0.38, 0, 0.64, 0.68, 0.64, color || '#181b1e', true);  // cast iron body
        // 4 Splayed cast iron legs
        for (const [lx, lz] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) {
          cyl('metal', lx, 0.08, lz, 0.04, 0.16, 0.04, '#181b1e', true);
        }
        // Ceramic glass fireview window showing glowing logs
        box('glass', 0, 0.44, 0.325, 0.42, 0.34, 0.02, '#f97316');             // glowing firebox
        round('glow', 0, 0.38, 0.28, 0.18, 0.14, 0.18, '#facc15');             // flame
        // Black steel exhaust flue pipe rising to ceiling
        cyl('metal', 0, 0.88, -0.06, 0.14, 0.48, 0.14, '#181b1e', true);

      } else if (/^cinemaseats$/i.test(t)) {
        // Row of 3 Luxury Motorized Leather Home Theater Recliners with LED Cup Holders (3x1 footprint)
        for (let s = 0; s < 3; s++) {
          const sx = -0.32 + s * 0.32;
          box('dark', sx, 0.04, 0, 0.30, 0.08, 0.88, '#15171a');                // plinth
          box('fabric', sx, 0.32, 0.04, 0.28, 0.24, 0.76, color || '#181b1e');  // leather seat
          box('fabric', sx, 0.62, -0.30, 0.28, 0.54, 0.22, color || '#181b1e'); // backrest
          round('fabric', sx, 0.86, -0.28, 0.24, 0.12, 0.16, color || '#181b1e');// headrest pillow
        }
        // Padded dividing armrests with glowing blue LED cup holders
        for (let a = 0; a < 4; a++) {
          const ax = -0.48 + a * 0.32;
          box('fabric', ax, 0.44, 0.04, 0.08, 0.32, 0.84, '#181b1e');
          cyl('glow', ax, 0.605, 0.32, 0.05, 0.01, 0.05, '#38bdf8');           // LED cup holder
        }

      } else if (/^projscreen$/i.test(t)) {
        // Ultra-Realistic 120-Inch Motorized ALR Tensioned Cinema Drop Screen (Matte Black Ceiling Cassette, Tab-Tensioning Cables & Weighted Drop Bar)
        // 1. Motorized ceiling cassette housing & end caps
        box('metal', 0, 0.94, -0.42, 0.98, 0.08, 0.08, '#1e293b', true);      // main extruded cassette
        box('metal', 0, 0.98, -0.42, 0.96, 0.02, 0.10, '#0f172a', true);      // flush ceiling mounting flanges
        box('metal', -0.49, 0.94, -0.42, 0.02, 0.085, 0.085, '#0f172a', true); // left end cap
        box('metal', 0.49, 0.94, -0.42, 0.02, 0.085, 0.085, '#0f172a', true);  // right end cap
        round('glow', 0.48, 0.94, -0.375, 0.008, 0.008, 0.008, '#38bdf8');     // blue status LED

        // 2. High-gain ALR Screen Surface & Black Velvet Masking Borders
        box('dark', 0, 0.88, -0.41, 0.94, 0.08, 0.015, '#090b0e');             // top black drop leader
        box('dark', -0.44, 0.50, -0.41, 0.06, 0.72, 0.015, '#090b0e');         // left velvet border
        box('dark', 0.44, 0.50, -0.41, 0.06, 0.72, 0.015, '#090b0e');          // right velvet border
        box('dark', 0, 0.12, -0.41, 0.94, 0.04, 0.015, '#090b0e');             // bottom velvet border
        box('fabric', 0, 0.50, -0.405, 0.82, 0.72, 0.01, '#e2e8f0');           // 1.1-gain ALR cinema screen

        // 3. Heavy Aluminum Drop Weight Bar & Parabolic Tab-Tensioning Cables
        cylX('metal', 0, 0.08, -0.405, 0.96, 0.038, 0.038, '#1e293b', true);   // bottom drop weight bar
        box('dark', 0, 0.058, -0.405, 0.94, 0.012, 0.03, '#0f172a');           // rubber acoustic bumper
        cyl('metal', -0.475, 0.50, -0.405, 0.006, 0.86, 0.006, '#94a3b8', true);// left tension cable
        cyl('metal', 0.475, 0.50, -0.405, 0.006, 0.86, 0.006, '#94a3b8', true); // right tension cable

      } else if (/^ceilingfan$/i.test(t)) {
        // Ceiling Fan is mounted at ceiling height and animated via life3d
        return;

      } else if (/^birdcage$/i.test(t)) {
        // Victorian Ornate Wrought-Iron Hanging Bird Cage on Stand with Singing Canary (1x1 footprint)
        cyl('metal', 0, 0.04, 0, 0.48, 0.08, 0.48, '#1e293b', true);          // base
        cyl('metal', 0, 0.48, 0, 0.035, 0.92, 0.035, '#1e293b', true);         // stand pole
        cyl('metal', 0, 0.86, 0.14, 0.025, 0.32, 0.025, '#1e293b', true);      // curved boom
        // Wire birdcage dome
        cyl('metal', 0, 0.62, 0.24, 0.38, 0.42, 0.38, '#cbd5e1', true);
        part('cone', 'metal', 0, 0.86, 0.24, 0.38, 0.16, 0.38, '#cbd5e1', true);
        // Yellow canary on wooden swing perch
        cyl('wood', 0, 0.64, 0.24, 0.015, 0.22, 0.015, '#fed7aa');             // perch
        round('ceramic', 0, 0.70, 0.24, 0.08, 0.06, 0.12, '#facc15');          // yellow canary

      } else if (/^hamster$/i.test(t)) {
        // Multi-Tier Acrylic Small Pet Habitat Cage with Exercise Wheel & Tunnels (1x1 footprint)
        box('ceramic', 0, 0.10, 0, 0.78, 0.18, 0.58, color || '#38bdf8');     // bottom pan
        box('soil', 0, 0.10, 0, 0.74, 0.08, 0.54, '#fef3c7');                  // wood shaving bedding
        box('glass', 0, 0.44, 0, 0.76, 0.52, 0.56, '#d8eef4');                 // clear acrylic habitat
        // Transparent running wheel & water bottle
        cylX('ceramic', 0.22, 0.40, 0, 0.08, 0.24, 0.24, '#f472b6');           // pink upright exercise wheel
        cyl('glass', -0.34, 0.46, 0.18, 0.04, 0.16, 0.04, '#38bdf8');          // water bottle

      } else if (/^halltree$/i.test(t)) {
        // Full-Height Entryway Hall Tree with Bench Seat, Shoe Cubbies & Coat Hooks (2x1 footprint)
        box('wood', 0, 0.24, 0, 0.94, 0.46, 0.84, color || '#78350f');         // lower bench carcass
        box('fabric', 0, 0.48, 0, 0.90, 0.06, 0.80, '#f5f5f4');                // bench seat cushion
        // 2 Open shoe cubbies underneath
        box('dark', -0.22, 0.22, 0.425, 0.38, 0.26, 0.02, '#181b1e');
        box('dark', 0.22, 0.22, 0.425, 0.38, 0.26, 0.02, '#181b1e');
        // Tall beadboard back panel with crown shelf
        box('wood', 0, 0.74, -0.38, 0.94, 0.52, 0.06, color || '#78350f');
        box('wood', 0, 0.98, -0.30, 0.94, 0.04, 0.24, color || '#78350f');     // top display shelf
        // 4 Brass double coat hooks
        for (let h = 0; h < 4; h++) {
          box('metal', -0.30 + h * 0.20, 0.76, -0.34, 0.03, 0.08, 0.03, '#c9a44e', true);
        }

      } else if (/^keytray$/i.test(t)) {
        // Hallway Console with Valet Catchall Leather Key Tray & Flower Vase (2x1 footprint)
        for (const [lx, lz] of [[-0.42, -0.34], [0.42, -0.34], [-0.42, 0.34], [0.42, 0.34]]) {
          cyl('metal', lx, 0.36, lz, 0.03, 0.72, 0.03, '#1e293b', true);
        }
        box('wood', 0, 0.74, 0, 0.94, 0.06, 0.84, color || '#451a03');        // walnut tabletop
        // Brown leather snap tray with brass house keys
        box('fabric', -0.22, 0.78, 0, 0.28, 0.03, 0.22, '#78350f');
        box('metal', -0.22, 0.80, 0, 0.08, 0.01, 0.04, '#c9a44e', true);      // gold keys
        // Ceramic bud vase with fresh tulip
        cyl('ceramic', 0.24, 0.84, 0, 0.10, 0.16, 0.10, '#ffffff');
        round('fabric', 0.24, 0.95, 0, 0.08, 0.10, 0.08, '#ec4899');           // pink tulip

      } else if (/^credenza$/i.test(t)) {
        // 3-Door Scandinavian Walnut Credenza Sideboard with Fluted Tambour Doors (3x1 footprint)
        box('dark', 0, 0.04, 0, 0.94, 0.08, 0.84, '#15171a');                 // plinth
        box('wood', 0, 0.50, 0, 0.96, 0.86, 0.86, color || '#78350f');         // walnut carcass
        // 3 Fluted tambour sliding doors with integrated finger pulls
        for (let d = 0; d < 3; d++) {
          const dx = -0.31 + d * 0.31;
          box('wood', dx, 0.50, 0.435, 0.29, 0.80, 0.02, HP.shade(color || '#78350f', 0.96));
          box('metal', dx, 0.50, 0.45, 0.015, 0.14, 0.015, '#c9a44e', true);  // brass bar pull
        }

      } else if (/^cornershelf$/i.test(t)) {
        // Scandinavian 5-Tier Quarter-Round Corner Etagere Shelving Unit (1x1 footprint, height 28px)
        const col = color || '#9a774f';
        // 1. Back corner uprights & front outer stiles
        cyl('wood', -0.42, 0.50, -0.42, 0.04, 0.96, 0.04, HP.shade(col, 0.8)); // back corner post
        cyl('wood', 0.42, 0.50, -0.42, 0.03, 0.96, 0.03, HP.shade(col, 0.8));  // right wall post
        cyl('wood', -0.42, 0.50, 0.42, 0.03, 0.96, 0.03, HP.shade(col, 0.8));  // left wall post
        // 2. 5 Radial quarter-round tiered shelves
        for (let i = 0; i < 5; i++) {
          const sy = 0.08 + i * 0.21;
          const sRad = 0.84 * (1 - i * 0.04);
          box('wood', -0.42 + sRad * 0.35, sy, -0.42 + sRad * 0.35, sRad * 0.70, 0.025, sRad * 0.70, col);
          cyl('wood', -0.42 + sRad * 0.45, sy, -0.42 + sRad * 0.45, sRad * 0.45, 0.028, sRad * 0.45, HP.shade(col, 1.1));
        }
        // 3. Decor on shelves
        cyl('ceramic', -0.15, 0.33, -0.20, 0.10, 0.08, 0.10, '#f8fafc');
        round('foliage', -0.15, 0.40, -0.20, 0.12, 0.10, 0.12, '#22c55e');
        box('fabric', -0.22, 0.56, -0.12, 0.04, 0.14, 0.18, '#dc2626');
        box('fabric', -0.17, 0.55, -0.12, 0.04, 0.12, 0.17, '#2563eb');
        box('metal', -0.12, 0.53, -0.12, 0.02, 0.08, 0.12, '#c9a44e', true);
        cyl('ceramic', -0.20, 0.76, -0.20, 0.10, 0.16, 0.10, '#fef08a');


      } else if (/^poufround$/i.test(t)) {
        // Chunky Hand-Knitted Round Wool Pouf Ottoman (1x1 footprint)
        round('fabric', 0, 0.26, 0, 0.84, 0.50, 0.84, color || '#f59e0b');
        round('fabric', 0, 0.26, 0, 0.80, 0.46, 0.80, HP.shade(color || '#f59e0b', 1.15));

      } else if (/^poufsq$/i.test(t)) {
        // Moroccan Square Stitched Leather Pouf Hassock (1x1 footprint)
        box('fabric', 0, 0.26, 0, 0.82, 0.50, 0.82, color || '#b45309');
        box('fabric', 0, 0.515, 0, 0.36, 0.01, 0.36, '#fed7aa');               // medallion center

      } else if (/^ottomantuft$/i.test(t)) {
        // Button-Tufted Chesterfield Ottoman Coffee Table (2x2 footprint, turned wooden feet)
        for (const [lx, lz] of [[-0.40, -0.40], [0.40, -0.40], [-0.40, 0.40], [0.40, 0.40]]) {
          cyl('wood', lx, 0.08, lz, 0.08, 0.16, 0.08, '#451a03');
        }
        box('fabric', 0, 0.34, 0, 0.94, 0.38, 0.94, color || '#1e3a8a');
        // Diamond tufting buttons
        for (let tx = 0; tx < 3; tx++) {
          for (let tz = 0; tz < 3; tz++) {
            round('dark', -0.28 + tx * 0.28, 0.535, -0.28 + tz * 0.28, 0.04, 0.02, 0.04, '#0f172a');
          }
        }

      } else if (/^ottomanstor$/i.test(t)) {
        // Upholstered Rectangular Storage Ottoman Bench with Lift-Off Lid (2x1 footprint)
        box('dark', 0, 0.04, 0, 0.94, 0.08, 0.84, '#15171a');
        box('fabric', 0, 0.32, 0, 0.94, 0.48, 0.86, color || '#475569');
        box('fabric', 0, 0.58, 0, 0.98, 0.10, 0.90, HP.shade(color || '#475569', 1.10)); // lid

      } else if (/^footstool$/i.test(t)) {
        // Compact Wooden Footstool with Padded Bouclé Cushion (1x1 footprint)
        for (const [lx, lz] of [[-0.34, -0.34], [0.34, -0.34], [-0.34, 0.34], [0.34, 0.34]]) {
          cyl('wood', lx, 0.16, lz, 0.04, 0.32, 0.04, '#fed7aa');
        }
        box('fabric', 0, 0.36, 0, 0.82, 0.14, 0.82, color || '#f5f5f4');

      } else if (/^entrybench$/i.test(t)) {
        // Upholstered Entryway Bench with Lower Slatted Shoe Shelf (3x1 footprint)
        for (const [lx, lz] of [[-0.44, -0.34], [0.44, -0.34], [-0.44, 0.34], [0.44, 0.34]]) {
          box('metal', lx, 0.24, lz, 0.04, 0.48, 0.04, '#1e293b', true);
        }
        // Slatted steel lower shoe shelf
        box('metal', 0, 0.14, 0, 0.88, 0.03, 0.74, '#334155', true);
        // Plush channeled bouclé cushion seat
        box('fabric', 0, 0.48, 0, 0.96, 0.14, 0.86, color || '#f5f5f4');

      /* ---------------- DECORATIVE INDOOR BOTANICALS (8 ITEMS) ---------------- */
      } else if (/^plsnake$/i.test(t)) {
        // Potted Sansevieria Snake Plant in Cylindrical Matte Ceramic Pot
        cyl('ceramic', 0, 0.28, 0, 0.54, 0.54, 0.54, color || '#f8fafc');
        cyl('soil', 0, 0.53, 0, 0.48, 0.06, 0.48, '#382218');
        for (let b = 0; b < 6; b++) {
          const bang = b * 1.05;
          const bx = Math.cos(bang) * 0.11, bz = Math.sin(bang) * 0.11;
          box('foliage', bx, 0.78, bz, 0.04, 0.48, 0.12, '#15803d');
          box('glow', bx, 0.78, bz, 0.042, 0.48, 0.015, '#facc15');
        }

      } else if (/^plmonstera$/i.test(t)) {
        // Split-Leaf Monstera Deliciosa with Fenestrated Leaves in Stoneware Pot
        cyl('ceramic', 0, 0.26, 0, 0.58, 0.50, 0.58, color || '#e2e8f0');
        cyl('soil', 0, 0.49, 0, 0.52, 0.06, 0.52, '#382218');
        cyl('wood', 0, 0.68, 0, 0.05, 0.44, 0.05, '#78350f');                  // moss pole
        for (let l = 0; l < 5; l++) {
          const lang = l * 1.25;
          const lx = Math.cos(lang) * 0.24, lz = Math.sin(lang) * 0.24;
          box('foliage', lx, 0.72 + (l % 3) * 0.10, lz, 0.38, 0.04, 0.38, '#16a34a');
        }

      } else if (/^plfiddle$/i.test(t)) {
        // Fiddle-Leaf Fig Tree (Ficus Lyrata) in Seagrass Basket
        cyl('fabric', 0, 0.26, 0, 0.58, 0.52, 0.58, color || '#d4a373');      // woven seagrass
        cyl('wood', 0, 0.56, 0, 0.06, 0.62, 0.06, '#78350f');                  // woody trunk
        round('foliage', 0, 0.76, 0, 0.64, 0.46, 0.64, '#15803d');             // lush fiddle leaves
        round('foliage', 0, 0.94, 0, 0.52, 0.38, 0.52, '#16a34a');

      } else if (/^plcactus$/i.test(t)) {
        // Trio of Desert Saguaro & Golden Barrel Cacti in Terracotta Saucer
        cyl('ceramic', 0, 0.12, 0, 0.68, 0.22, 0.68, '#ea580c');               // terracotta dish
        cyl('soil', 0, 0.20, 0, 0.64, 0.06, 0.64, '#fde68a');                  // desert sand
        cyl('foliage', -0.16, 0.44, 0, 0.14, 0.44, 0.14, '#15803d');           // tall saguaro
        round('foliage', 0.14, 0.32, -0.10, 0.24, 0.22, 0.24, '#16a34a');      // golden barrel
        round('foliage', 0.12, 0.28, 0.16, 0.16, 0.14, 0.16, '#22c55e');

      } else if (/^plbonsai$/i.test(t)) {
        // Aged Japanese Juniper Bonsai Tree on Glazed Oval Ceramic Tray
        box('ceramic', 0, 0.08, 0, 0.68, 0.14, 0.46, color || '#1e3a8a');     // glazed bonsai pot
        box('soil', 0, 0.14, 0, 0.62, 0.04, 0.40, '#382218');
        cyl('wood', 0, 0.32, 0, 0.06, 0.34, 0.06, '#78350f');                  // gnarled trunk
        round('foliage', -0.12, 0.44, 0, 0.32, 0.16, 0.24, '#14532d');         // cloud foliage pads
        round('foliage', 0.12, 0.50, 0, 0.26, 0.14, 0.22, '#15803d');

      } else if (/^plorchid$/i.test(t)) {
        // Elegant Phalaenopsis White Moth Orchid in Glazed Ceramic Pot
        cyl('ceramic', 0, 0.18, 0, 0.34, 0.34, 0.34, color || '#ffffff');
        cyl('foliage', 0, 0.48, 0, 0.015, 0.56, 0.015, '#15803d');             // bamboo stake & stem
        for (let o = 0; o < 3; o++) {
          round('fabric', (o % 2 === 0 ? 0.06 : -0.06), 0.52 + o * 0.14, 0, 0.12, 0.10, 0.04, '#ffffff');
          round('fabric', (o % 2 === 0 ? 0.06 : -0.06), 0.52 + o * 0.14, 0.02, 0.03, 0.03, 0.02, '#f43f5e'); // lip
        }

      } else if (/^plpalm$/i.test(t)) {
        // Lush Feathery Parlor Palm (Chamaedorea Elegans) in Fluted Stone Urn
        cyl('stone', 0, 0.24, 0, 0.48, 0.46, 0.48, color || '#cbd5e1');
        cyl('soil', 0, 0.46, 0, 0.42, 0.06, 0.42, '#382218');
        round('foliage', 0, 0.72, 0, 0.74, 0.52, 0.74, '#16a34a');

      } else if (/^plpothos$/i.test(t)) {
        // Cascading Golden Pothos Vine on Elevated Plant Stand
        for (const sx of [-0.18, 0.18]) {
          cyl('metal', sx, 0.22, 0, 0.025, 0.44, 0.025, '#c9a44e', true);
        }
        cyl('ceramic', 0, 0.48, 0, 0.36, 0.26, 0.36, color || '#ffffff');
        round('foliage', 0, 0.54, 0, 0.44, 0.20, 0.44, '#22c55e');
        cyl('foliage', 0, 0.38, 0.18, 0.16, 0.32, 0.12, '#4ade80');            // trailing vines

      /* ---------------- FLOOR & TABLE LAMPS (8 ITEMS) ---------------- */
      } else if (/^lamparc$/i.test(t)) {
        // Ultra-Realistic Achille Castiglioni Flos Arco Floor Lamp (Monolithic Carrara Marble Plinth, Telescopic Stainless Arch & Spun Chrome Hood)
        // 1. Iconic Monolithic Carrara marble base block with pass-through lifting hole
        box('ceramic', -0.28, 0.10, 0, 0.28, 0.20, 0.40, '#f8fafc');           // white Carrara marble plinth
        box('dark', -0.28, 0.01, 0, 0.26, 0.02, 0.38, '#1e293b');              // rubber floor protector
        cylZ('dark', -0.28, 0.12, 0, 0.09, 0.09, 0.42, '#334155');             // signature through-hole for lifting broomstick
        // 2. Multi-stage telescopic extruded stainless steel arch (sweeping up and into room)
        cyl('metal', -0.28, 0.38, 0, 0.065, 0.40, 0.065, '#cbd5e1');            // vertical base stem
        boxSlope('metal', -0.28, 0.58, 0, -0.22, 0.74, 0, 0.06, 0.08, '#e2e8f0'); // lower diagonal curve
        boxSlope('metal', -0.22, 0.74, 0, -0.10, 0.88, 0, 0.055, 0.075, '#e2e8f0'); // mid diagonal curve
        boxSlope('metal', -0.10, 0.88, 0, 0.05, 0.96, 0, 0.05, 0.07, '#e2e8f0');  // high arch peak
        boxSlope('metal', 0.05, 0.96, 0, 0.20, 0.92, 0, 0.045, 0.065, '#e2e8f0');   // forward cantilever
        cyl('metal', 0.25, 0.85, 0, 0.045, 0.14, 0.045, '#cbd5e1');             // drop-down pendant neck
        // 3. Spun polished chrome perforated double dome hood
        round('metal', 0.25, 0.80, 0, 0.58, 0.28, 0.58, '#f1f5f9');             // outer perforated chrome dome
        cyl('metal', 0.25, 0.92, 0, 0.20, 0.04, 0.20, '#cbd5e1');               // top ventilation crown
        round('glass', 0.25, 0.74, 0, 0.20, 0.16, 0.20, '#fef08a');              // inner light bulb
      } else if (/^lamptripod$/i.test(t)) {
        // Ultra-Realistic Nordic Architectural Tripod Floor Lamp (Tapered Hardwood Legs, Brass Ferrules, Woven Linen Drum Shade)
        // 1. 3 Angled tapered solid oak dowel legs with satin brass foot tips
        for (let l = 0; l < 3; l++) {
          const lang = l * (Math.PI * 2 / 3);
          const bx = Math.cos(lang) * 0.26, bz = Math.sin(lang) * 0.26;
          const tx = Math.cos(lang) * 0.06, tz = Math.sin(lang) * 0.06;
          cyl('metal', bx, 0.025, bz, 0.05, 0.05, 0.05, '#c9a44e');           // brass ferrule tip
          boxSlope('wood', bx, 0.05, bz, tx, 0.72, tz, 0.05, 0.07, color || '#d4a373'); // tapered wood leg
        }
        // 2. Brass central connector spider hub & hanging braided power cable
        cyl('metal', 0, 0.73, 0, 0.16, 0.04, 0.16, '#c9a44e');                  // central hub
        cyl('metal', 0, 0.77, 0, 0.08, 0.06, 0.08, '#c9a44e');                  // socket base
        cyl('glow', 0, 0.83, 0, 0.14, 0.14, 0.14, '#fef08a');                  // glowing LED bulb
        // Decorative braided cable dangling down and connecting to floor inline switch
        boxSlope('dark', 0, 0.72, 0, 0.03, 0.15, 0.03, 0.02, 0.02, '#334155'); // upper drop cord
        boxSlope('dark', 0.03, 0.15, 0.03, 0.08, 0.015, 0.10, 0.02, 0.02, '#334155'); // lead-in to foot switch
        box('dark', 0.08, 0.015, 0.10, 0.08, 0.03, 0.06, '#1e293b');           // inline foot switch on floor
        cyl('metal', 0.08, 0.035, 0.10, 0.025, 0.015, 0.025, '#c9a44e', true);  // brass foot tap button
        boxSlope('dark', 0.08, 0.015, 0.10, 0.14, 0.005, 0.22, 0.018, 0.018, '#334155'); // tail to wall plug
        // 3. Wide coarse-weave textured linen drum shade with internal diffuser
        cyl('fabric', 0, 0.88, 0, 0.58, 0.34, 0.58, '#faf5ee');                // outer linen drum
        cyl('fabric', 0, 0.88, 0, 0.54, 0.33, 0.54, '#fffbeb');                // inner translucent diffusing liner
      } else if (/^lamptorch$/i.test(t)) {
        // Ultra-Realistic Classical Fluted Bronze & Alabaster Torchiere Floor Lamp (High-Output Golden Uplight)
        // 1. Heavy stepped neoclassical cast bronze pedestal base
        cyl('metal', 0, 0.02, 0, 0.42, 0.04, 0.42, color || '#3b2210');         // lower stepped base
        cyl('metal', 0, 0.055, 0, 0.34, 0.03, 0.34, '#c9a44e');                 // brass accent trim ring
        cyl('metal', 0, 0.08, 0, 0.22, 0.03, 0.22, color || '#3b2210');         // upper pedestal collar
        // 2. Fluted columnar bronze stanchion
        cyl('metal', 0, 0.48, 0, 0.058, 0.80, 0.058, color || '#3b2210');       // main bronze shaft
        cyl('metal', 0, 0.38, 0, 0.075, 0.025, 0.075, '#c9a44e');               // mid decorative brass ring
        cyl('metal', 0, 0.72, 0, 0.070, 0.025, 0.070, '#c9a44e');               // upper decorative brass ring
        // 3. Flared brass chalice mount & translucent Italian alabaster uplight bowl
        part('cone', 'metal', 0, 0.86, 0, 0.24, 0.08, 0.24, '#c9a44e');          // brass chalice cup
        part('cone', 'glass', 0, 0.94, 0, 0.50, 0.16, 0.50, '#fef3c7');         // flared frosted alabaster glass bowl
      } else if (/^lamptable$/i.test(t)) {
        // Ultra-Realistic Handcrafted Ceramic Gourd Table Lamp with Knife-Pleated Silk Shade
        // 1. Brushed satin brass mounting pedestal disc
        cyl('metal', 0, 0.02, 0, 0.32, 0.035, 0.32, '#c9a44e');                 // brass base plinth
        // 2. Sculpted double-gourd high-gloss ceramic body
        round('ceramic', 0, 0.18, 0, 0.34, 0.28, 0.34, color || '#0284c7');     // lower gourd bulb
        round('ceramic', 0, 0.36, 0, 0.24, 0.22, 0.24, color || '#0284c7');     // upper gourd bulb
        cyl('metal', 0, 0.47, 0, 0.06, 0.06, 0.06, '#c9a44e');                  // turned brass neck
        box('metal', 0.04, 0.47, 0, 0.025, 0.012, 0.012, '#c9a44e');            // brass turn switch
        // 3. Knife-pleated empire silk lampshade with fabric piping trim
        part('cone', 'fabric', 0, 0.72, 0, 0.48, 0.40, 0.48, '#ffffff');        // pleated silk conical shade
        round('metal', 0, 0.92, 0, 0.03, 0.03, 0.03, '#c9a44e');                // top brass finial
      } else if (/^lamppaper$/i.test(t)) {
        // Authentic Isamu Noguchi "Akari 1A" Sculptural Washi Paper Table Lamp on Black Wire Hairpin Legs
        // 1. 3 delicate matte-black enameled steel wire hairpin tripod legs
        for (let f = 0; f < 3; f++) {
          const fang = f * (Math.PI * 2 / 3);
          const bx = Math.cos(fang) * 0.20, bz = Math.sin(fang) * 0.20;
          const tx = Math.cos(fang) * 0.09, tz = Math.sin(fang) * 0.09;
          cyl('metal', bx, 0.015, bz, 0.035, 0.03, 0.035, '#181b1e');           // rubber foot
          boxSlope('metal', bx, 0.02, bz, tx, 0.20, tz, 0.04, 0.05, '#181b1e'); // wire hairpin leg
        }
        // Black wire stabilizer ring
        cyl('metal', 0, 0.14, 0, 0.28, 0.02, 0.28, '#181b1e');
        // 2. Sculptural ribbed mulberry washi paper lantern body
        round('fabric', 0, 0.55, 0, 0.62, 0.70, 0.62, '#fffbeb');              // handcrafted washi paper lantern
        // Subtle bamboo ribbing rings
        cyl('dark', 0, 0.42, 0, 0.60, 0.012, 0.60, '#d4b58c');                 // lower bamboo rib
        cyl('dark', 0, 0.55, 0, 0.625, 0.012, 0.625, '#d4b58c');               // middle bamboo rib
        cyl('dark', 0, 0.68, 0, 0.56, 0.012, 0.56, '#d4b58c');                 // upper bamboo rib
        // Top black collar ring & hanging hook
        cyl('metal', 0, 0.88, 0, 0.10, 0.025, 0.10, '#181b1e');
        // 3. Luminous warm golden ambient glow
        round('glow', 0, 0.55, 0, 0.40, 0.44, 0.40, '#fde047');

      } else if (/^lampmush$/i.test(t)) {
        // Iconic 1970s Italian Artemide Nessino Blown-Glass / Glossy Mushroom Lamp
        // 1. Organic flared trumpet pedestal base
        part('cone', 'glass', 0, 0.16, 0, 0.32, 0.30, 0.32, color || '#ea580c'); // flared glossy stem
        cyl('glass', 0, 0.30, 0, 0.18, 0.16, 0.18, color || '#ea580c');        // central neck
        cyl('dark', 0, 0.01, 0, 0.28, 0.015, 0.28, '#15171a');                 // anti-slip base pad
        // 2. Sweeping umbrella mushroom dome cap
        round('glass', 0, 0.48, 0, 0.62, 0.26, 0.62, color || '#ea580c');      // domed mushroom head
        // 3. Underside translucent acrylic diffuser plate & interior core
        cyl('ceramic', 0, 0.38, 0, 0.48, 0.015, 0.48, '#fffbeb');              // bottom diffuser disc
        round('ceramic', 0, 0.42, 0, 0.22, 0.18, 0.22, '#fef08a');
      } else if (/^lampcandle$/i.test(t)) {
        // Heavy Forged Iron & Beveled Glass Hurricane Candle Lantern with Arched Wire Handle
        // 1. Heavy iron stepped base tray with wax catch lip
        box('metal', 0, 0.03, 0, 0.46, 0.06, 0.46, color || '#181b1e');        // base tray
        // 2. 4 Corner wrought-iron upright stiles
        for (const dx of [-0.20, 0.20]) {
          for (const dz of [-0.20, 0.20]) {
            box('metal', dx, 0.44, dz, 0.045, 0.76, 0.045, '#181b1e');
          }
        }
        // 3. Crystal clear tempered glass panes
        box('glass', 0, 0.44, 0, 0.41, 0.72, 0.41, '#d8eef4');
        // 4. Heavy beeswax pillar candle with melted pooling wax & flickering flame
        cyl('ceramic', 0, 0.24, 0, 0.18, 0.34, 0.18, '#fef3c7');               // ivory pillar candle
        cyl('dark', 0, 0.415, 0, 0.016, 0.03, 0.016, '#181b1e');               // charred cotton wick
        round('glow', 0, 0.445, 0, 0.06, 0.10, 0.06, '#f59e0b');               // teardrop golden flame
        // 5. Pyramid chimney roof with ventilation louvers & hinged carry hoop
        part('cone', 'metal', 0, 0.85, 0, 0.46, 0.12, 0.46, '#181b1e');         // pyramid vented cap
        cyl('metal', 0, 0.92, 0, 0.10, 0.04, 0.10, '#c9a44e');                 // brass chimney collar
        cylX('metal', 0, 0.96, 0, 0.14, 0.04, 0.04, '#181b1e');                // hinged iron carry loop

      } else if (/^lampbanker$/i.test(t)) {
        // Authentic Emeralite Heavy Solid Brass & Emerald Green Glass Banker's Desk Lamp
        // 1. Stepped cast-brass rectangular base with pen rest tray
        box('metal', 0, 0.025, 0, 0.38, 0.04, 0.28, '#c9a44e');                // brass base plinth
        box('metal', 0, 0.048, 0.04, 0.32, 0.015, 0.09, '#b8923a');            // grooved pen rest tray
        box('dark', 0, 0.005, 0, 0.36, 0.01, 0.26, '#15171a');                 // felt anti-scratch pad
        // 2. Dual-rod curved brass gooseneck uprights with knurled adjustment screws
        for (const sx of [-0.08, 0.08]) {
          cyl('metal', sx, 0.26, -0.04, 0.032, 0.44, 0.032, '#c9a44e');        // brass uprights
          round('metal', sx, 0.46, -0.01, 0.045, 0.045, 0.045, '#b8923a');      // swivel adjustment knobs
        }
        // 3. Classic cased glass cylindrical shade (Emerald Green outside, Opal White inside)
        cylX('glass', 0, 0.48, 0.04, 0.42, 0.16, 0.16, color || '#15803d');    // emerald green glass shade
        cylX('ceramic', 0, 0.475, 0.04, 0.40, 0.145, 0.145, '#f8fafc');        // inner opal reflector
        cylX('glow', 0, 0.47, 0.04, 0.28, 0.08, 0.08, '#fef08a');              // tubular glowing bulb
        // 4. Dangling brass ball-chain pull cord switch with teardrop fob
        cyl('metal', 0.14, 0.34, 0.04, 0.01, 0.20, 0.01, '#c9a44e');          // brass bead chain
        round('metal', 0.14, 0.23, 0.04, 0.025, 0.03, 0.025, '#c9a44e');       // teardrop pull fob
      /* ---------------- MIRRORS & WALL ACCENTS (4 ITEMS) ---------------- */
      } else if (/^mirsun$/i.test(t)) {
        // Gilded Sunburst Wall/Console Mirror with Concentric Radiating Rays (facing +Z)
        round('glass', 0, 0.50, 0, 0.44, 0.44, 0.02, '#d8eef4');               // central mirror
        cylZ('metal', 0, 0.50, -0.01, 0.48, 0.48, 0.02, '#c9a44e', true);      // inner ring
        for (let r = 0; r < 12; r++) {
          const rang = r * (Math.PI / 6);
          cyl('metal', Math.cos(rang) * 0.32, 0.50, Math.sin(rang) * 0.32, 0.015, 0.22, 0.015, '#c9a44e', true);
        }

      } else if (/^miroval$/i.test(t)) {
        // Luxury Capsule Pill-Oval Arch Mirror (1x2 footprint, height 48px, bold brushed brass rim, beveled mirror pane & easel floor stand)
        const frameCol = color || '#d4af37'; // brushed warm brass
        const mirrorCol = '#d8eef4';         // high-clarity reflective mirror glass
        const standCol = '#334155';          // slate kickstand

        // 1. Stable Floor Anti-Slip Rubber Pads (Ground resting at y=0)
        for (const sx of [-0.22, 0.22]) {
          box('dark', sx, 0.02, 0, 0.08, 0.04, 0.08, '#0f172a');
        }
        // 2. Angled Rear Steel Kickstand Easel Leg (extends from y=0.60 down to floor at z=-0.28)
        boxSlope('metal', 0, 0.60, -0.02, 0, 0.02, -0.28, 0.035, 0.035, standCol, true);
        box('metal', 0, 0.02, -0.28, 0.12, 0.03, 0.06, standCol, true); // kickstand foot pad

        // 3. Bold Vertical Frame Stiles (y=0.28 to 0.72)
        for (const sx of [-0.24, 0.24]) {
          box('metal', sx, 0.50, 0, 0.045, 0.46, 0.05, frameCol, true);
        }

        // 4. Continuous Radial Semi-Circular Rounded Arches (Top dome crown + Bottom rounded basin)
        const archSegments = 8;
        for (let i = 0; i <= archSegments; i++) {
          const ang = (i / archSegments) * Math.PI; // 0 to PI
          const cx = Math.cos(ang) * 0.24;
          const cy = 0.72 + Math.sin(ang) * 0.24;
          boxRot('metal', cx, cy, 0, 0.045, 0.065, 0.05, -ang, frameCol, true);
        }
        for (let i = 0; i <= archSegments; i++) {
          const ang = Math.PI + (i / archSegments) * Math.PI; // PI to 2*PI
          const cx = Math.cos(ang) * 0.24;
          const cy = 0.28 + Math.sin(ang) * 0.24;
          boxRot('metal', cx, cy, 0, 0.045, 0.065, 0.05, -ang, frameCol, true);
        }

        // 5. Central Flat Mirror Pane & Backing Board
        box('dark', 0, 0.50, -0.015, 0.44, 0.88, 0.02, '#181b1f');
        box('glass', 0, 0.50, 0.015, 0.42, 0.46, 0.015, mirrorCol);

        // 6. Upper & Lower Curved Mirror Fill Panes
        for (let i = 1; i < archSegments; i++) {
          const ang = (i / archSegments) * Math.PI;
          const cx = Math.cos(ang) * 0.18;
          const cy = 0.72 + Math.sin(ang) * 0.18;
          box('glass', cx, cy, 0.015, 0.09, 0.07, 0.015, mirrorCol);
          const cyB = 0.28 - Math.sin(ang) * 0.18;
          box('glass', cx, cyB, 0.015, 0.09, 0.07, 0.015, mirrorCol);
        }

      } else if (/^mirarch$/i.test(t)) {
        // French Neoclassical Arched Top Floor Leaner Mirror with Gilded Crest (1x2 footprint)
        box('metal', 0, 0.48, 0, 0.64, 0.94, 0.06, '#c9a44e', true);           // gilt frame
        box('glass', 0, 0.48, 0.025, 0.56, 0.86, 0.01, '#d8eef4');
        part('cone', 'metal', 0, 0.98, 0, 0.22, 0.12, 0.06, '#c9a44e', true);   // carved top crest

      } else if (/^mirwavy$/i.test(t)) {
        // Scandinavian Postmodern Curvy Wavy Full-Length Mirror (1x2 footprint, height 50px, undulating scalloped squiggles, pastel lacquer frame & floor kickstand)
        const waveColor = color || '#f472b6'; // signature playful pastel pink / sage / lilac
        const mirrorCol = '#d8eef4';
        const standCol = '#334155';

        // 1. Stable Floor Anti-Slip Rubber Pads (Ground resting at y=0)
        for (const sx of [-0.20, 0.20]) {
          box('dark', sx, 0.02, 0, 0.08, 0.04, 0.08, '#0f172a');
        }
        // 2. Angled Rear Steel Kickstand Easel Leg
        boxSlope('metal', 0, 0.60, -0.02, 0, 0.02, -0.28, 0.035, 0.035, standCol, true);
        box('metal', 0, 0.02, -0.28, 0.12, 0.03, 0.06, standCol, true);

        // 3. Central High-Clarity Mirror Plate & Backing Board
        box('dark', 0, 0.50, -0.01, 0.44, 0.88, 0.02, '#181b1f');
        box('glass', 0, 0.50, 0.018, 0.36, 0.80, 0.015, mirrorCol);

        // 4. Undulating Serpentine Scalloped Wave Frames along Left & Right Edges
        const numWaves = 6;
        for (let w = 0; w < numWaves; w++) {
          const wy = 0.14 + (w / (numWaves - 1)) * 0.72; // along mirror height
          const peakOffset = (w % 2 === 0 ? 0.045 : -0.025);
          for (const sx of [-1, 1]) {
            const bx = sx * (0.23 + peakOffset);
            round('fabric', bx, wy, 0.015, 0.11, 0.12, 0.06, waveColor);
            box('fabric', sx * 0.20, wy, 0.012, 0.08, 0.13, 0.05, HP.shade(waveColor, 0.95));
          }
        }

        // 5. Wavy Horizontal Crests across Top and Bottom Borders
        for (const crestY of [0.06, 0.94]) {
          for (let tx = -2; tx <= 2; tx++) {
            const cx = tx * 0.09;
            const waveYOffset = (Math.abs(tx) % 2 === 1 ? 0.025 : -0.015) * (crestY > 0.5 ? 1 : -1);
            round('fabric', cx, crestY + waveYOffset, 0.015, 0.10, 0.08, 0.06, waveColor);
            box('fabric', cx, crestY, 0.012, 0.09, 0.06, 0.05, HP.shade(waveColor, 0.93));
          }
        }

      /* ---------------- RUGS & CARPETS (7 ITEMS) ---------------- */
      } else if (/^rugshag$/i.test(t)) {
        // Thick High-Pile Moroccan Berber Shag Rug with Diamond Geometric Pattern
        box('fabric', 0, 0.02, 0, 0.96, 0.04, 0.96, color || '#fdf4ff');
        box('fabric', 0, 0.035, 0, 0.88, 0.01, 0.88, '#1e293b');               // charcoal diamond motif

      } else if (/^rugpersian$/i.test(t)) {
        // Traditional Intricate Persian Medallion Area Rug with Ornamental Border
        box('fabric', 0, 0.02, 0, 0.96, 0.03, 0.96, color || '#991b1b');       // rich crimson base
        box('fabric', 0, 0.032, 0, 0.44, 0.01, 0.44, '#1e3a8a');               // indigo center medallion
        box('fabric', 0, 0.032, 0, 0.92, 0.005, 0.06, '#fef3c7');              // gold fringe border

      } else if (/^rugjute$/i.test(t)) {
        // Chunky Braided Natural Jute Area Rug with Earthy Texture
        box('soil', 0, 0.02, 0, 0.96, 0.04, 0.96, color || '#d4a373');
        box('fabric', 0, 0.035, 0, 0.90, 0.01, 0.90, '#fed7aa');

      } else if (/^ruggeo$/i.test(t)) {
        // Bauhaus Mid-Century Modern Geometric Color-Block Area Rug
        box('fabric', 0, 0.02, 0, 0.96, 0.03, 0.96, color || '#f8fafc');
        box('fabric', -0.22, 0.032, -0.22, 0.44, 0.005, 0.44, '#ea580c');      // terracotta block
        box('fabric', 0.22, 0.032, 0.22, 0.44, 0.005, 0.44, '#0284c7');        // blue block

      } else if (/^rughide$/i.test(t)) {
        // Organic Natural Speckled Cowhide Shape Rug (3x2 footprint)
        box('fabric', 0, 0.015, 0, 0.88, 0.02, 0.92, color || '#f5f5f4');
        box('dark', -0.16, 0.022, 0.12, 0.34, 0.005, 0.28, '#451a03');         // brown hide spot
        box('dark', 0.20, 0.022, -0.16, 0.28, 0.005, 0.32, '#451a03');

      } else if (/^rugbraid$/i.test(t)) {
        // Traditional Colonial Oval Concentric Braided Wool Hearth Rug
        cyl('fabric', 0, 0.02, 0, 0.94, 0.03, 0.94, color || '#b45309');
        cyl('fabric', 0, 0.032, 0, 0.64, 0.01, 0.64, '#fed7aa');
        cyl('fabric', 0, 0.034, 0, 0.32, 0.01, 0.32, '#78350f');

      } else if (/^rugplay$/i.test(t)) {
        // Children's City Roads & Train Track Adventure Play Carpet (4x3 footprint)
        box('fabric', 0, 0.02, 0, 0.96, 0.03, 0.96, '#15803d');                // green park base
        box('dark', 0, 0.032, 0, 0.92, 0.005, 0.18, '#1f2937');                // main highway road
        box('dark', 0, 0.032, 0, 0.18, 0.005, 0.92, '#1f2937');                // cross avenue
        cyl('dark', 0, 0.032, 0, 0.38, 0.005, 0.38, '#1f2937');                // roundabout

      /* ---------------- FLOOR ACCESSORIES & SCULPTURES (16 ITEMS) ---------------- */
      } else if (/^flbasket$/i.test(t)) {
        // Chunky Braided Cotton Rope Basket with Rolled Throw Blankets
        cyl('fabric', 0, 0.34, 0, 0.76, 0.66, 0.76, color || '#d4a373');
        round('fabric', -0.14, 0.68, 0, 0.28, 0.22, 0.28, '#38bdf8');          // blue throw
        round('fabric', 0.14, 0.70, 0, 0.30, 0.24, 0.30, '#fbcfe8');           // pink throw

      } else if (/^flplantstand$/i.test(t)) {
        // Mid-Century Modern Walnut 3-Legged Plant Stand with Ceramic Pot
        for (let l = 0; l < 3; l++) {
          const lang = l * (Math.PI * 2 / 3);
          cyl('wood', Math.cos(lang) * 0.26, 0.34, Math.sin(lang) * 0.26, 0.035, 0.68, 0.035, '#78350f');
        }
        cyl('ceramic', 0, 0.58, 0, 0.52, 0.42, 0.52, color || '#ffffff');      // ceramic pot
        round('foliage', 0, 0.84, 0, 0.58, 0.42, 0.58, '#16a34a');

      } else if (/^flmagrack$/i.test(t)) {
        // Mid-Century Modern Brass A-Frame & Saddle Leather Magazine Rack with Periodicals
        // 1. Slender angled brass wire A-frame legs with cross-stretchers
        boxSlope('metal', -0.32, 0.02, -0.18, -0.32, 0.44, 0, 0.022, 0.022, '#c9a44e', true);
        boxSlope('metal', -0.32, 0.02, 0.18, -0.32, 0.44, 0, 0.022, 0.022, '#c9a44e', true);
        boxSlope('metal', 0.32, 0.02, -0.18, 0.32, 0.44, 0, 0.022, 0.022, '#c9a44e', true);
        boxSlope('metal', 0.32, 0.02, 0.18, 0.32, 0.44, 0, 0.022, 0.022, '#c9a44e', true);
        // Top horizontal brass rails
        cylX('metal', 0, 0.44, -0.16, 0.70, 0.022, 0.022, '#c9a44e', true);
        cylX('metal', 0, 0.44, 0.16, 0.70, 0.022, 0.022, '#c9a44e', true);
        // Arched center carrying handle
        cylX('metal', 0, 0.54, 0, 0.28, 0.022, 0.022, '#c9a44e', true);
        boxSlope('metal', -0.14, 0.44, 0, -0.14, 0.54, 0, 0.02, 0.02, '#c9a44e', true);
        boxSlope('metal', 0.14, 0.44, 0, 0.14, 0.54, 0, 0.02, 0.02, '#c9a44e', true);
        // 2. Saddle leather sling suspended between rails
        box('fabric', 0, 0.22, 0, 0.64, 0.28, 0.30, color || '#92400e');
        box('dark', 0, 0.14, 0, 0.62, 0.08, 0.22, '#451a03'); // inner cavity shadow
        // 3. Staggered architectural & design magazines protruding
        boxRot('fabric', -0.12, 0.32, -0.04, 0.24, 0.34, 0.025, -0.15, '#f8fafc');
        boxRot('dark', -0.12, 0.32, -0.02, 0.22, 0.32, 0.005, -0.15, '#0284c7');
        boxRot('fabric', 0.10, 0.34, 0.03, 0.24, 0.36, 0.025, 0.12, '#f8fafc');
        boxRot('dark', 0.10, 0.34, 0.05, 0.22, 0.34, 0.005, 0.12, '#ea580c');

      } else if (/^flwinerack$/i.test(t)) {
        // Geometric 12-Bottle Metal Floor Wine Rack with Wine Bottles
        box('metal', 0, 0.48, 0, 0.78, 0.94, 0.52, color || '#1e293b', true);
        for (let r = 0; r < 6; r++) {
          const rx = -0.22 + (r % 2) * 0.44, ry = 0.24 + Math.floor(r / 2) * 0.24;
          cyl('glass', rx, ry, 0, 0.12, 0.44, 0.12, '#14532d');                // green wine bottle
        }

      } else if (/^flcrate$/i.test(t)) {
        // Solid Pine Record Storage Crate Filled with 12" Vinyl LPs
        box('wood', 0, 0.28, 0, 0.86, 0.54, 0.86, color || '#d4a373');
        for (let a = 0; a < 6; a++) {
          box('dark', 0, 0.36, -0.25 + a * 0.10, 0.76, 0.44, 0.02, '#111827'); // vinyl album jackets
        }

      } else if (/^flspeaker$/i.test(t)) {
        // Audiophile Bookshelf Speaker Monitor with Kevlar Cone & Silk Tweeter
        box('wood', 0, 0.48, 0, 0.62, 0.94, 0.68, color || '#181b1e');
        cylZ('metal', 0, 0.34, 0.345, 0.36, 0.36, 0.02, '#eab308', true);       // yellow Kevlar cone
        cylZ('metal', 0, 0.72, 0.345, 0.14, 0.14, 0.02, '#cbd5e1', true);       // silver dome tweeter

      } else if (/^flscratch$/i.test(t)) {
        // Multi-Tier Sisal Rope Cat Scratching Post with Dangling Mouse
        box('fabric', 0, 0.04, 0, 0.84, 0.08, 0.84, color || '#e2e8f0');       // plush base
        cyl('wood', 0, 0.48, 0, 0.18, 0.86, 0.18, '#fed7aa');                  // sisal rope column
        round('fabric', 0.22, 0.72, 0, 0.08, 0.06, 0.10, '#94a3b8');          // plush mouse

      } else if (/^fldogbowl$/i.test(t)) {
        // Elevated Double Stainless Pet Feeder Stand (Food & Water)
        box('wood', 0, 0.10, 0, 0.88, 0.18, 0.48, color || '#b45309');
        cyl('metal', -0.22, 0.18, 0, 0.32, 0.06, 0.32, '#cbd5e1', true);       // stainless food bowl
        cyl('metal', 0.22, 0.18, 0, 0.32, 0.06, 0.32, '#cbd5e1', true);        // stainless water bowl
        cyl('water', 0.22, 0.19, 0, 0.28, 0.01, 0.28, '#38bdf8');              // clean water
        box('soil', -0.22, 0.19, 0, 0.26, 0.01, 0.26, '#78350f');              // dry kibble

      } else if (/^fllogbasket$/i.test(t)) {
        // Heavy Forged Iron Log Basket with Split Firewood Logs
        cyl('metal', 0, 0.24, 0, 0.68, 0.46, 0.68, '#1e293b', true);           // iron hoop
        for (let l = 0; l < 4; l++) {
          cyl('wood', -0.12 + (l % 2) * 0.24, 0.28 + Math.floor(l / 2) * 0.14, 0, 0.14, 0.54, 0.14, '#78350f');
        }

      } else if (/^flvase$/i.test(t)) {
        // Luxury Classical Ceramic Floor Amphora Vase with Dried Pampas & Eucalyptus Plumes
        // 1. Stepped ceramic foot base
        cyl('ceramic', 0, 0.05, 0, 0.42, 0.10, 0.42, color || '#e2e8f0');
        // 2. Sculptural amphora vase body & flared rolled rim
        round('ceramic', 0, 0.38, 0, 0.56, 0.56, 0.56, color || '#e2e8f0');
        cyl('ceramic', 0, 0.68, 0, 0.32, 0.20, 0.32, color || '#e2e8f0');
        cyl('ceramic', 0, 0.80, 0, 0.40, 0.08, 0.40, HP.shade(color || '#e2e8f0', 1.05));
        cyl('dark', 0, 0.83, 0, 0.28, 0.02, 0.28, '#1e293b');                  // mouth opening
        // Twin sculptural ceramic amphora handles
        boxSlope('ceramic', -0.27, 0.50, 0, -0.22, 0.70, 0, 0.035, 0.035, color || '#e2e8f0');
        boxSlope('ceramic', 0.27, 0.50, 0, 0.22, 0.70, 0, 0.035, 0.035, color || '#e2e8f0');
        // 3. Tall dried pampas plumes & eucalyptus stems emerging from vase mouth
        cyl('wood', -0.04, 0.96, -0.02, 0.015, 0.28, 0.015, '#a16207');
        cyl('wood', 0.05, 1.00, 0.03, 0.015, 0.34, 0.015, '#a16207');
        round('fabric', -0.06, 1.14, -0.03, 0.16, 0.28, 0.16, '#fef3c7');       // fluffy beige pampas plume
        round('fabric', 0.07, 1.20, 0.04, 0.18, 0.32, 0.18, '#fed7aa');        // golden pampas plume
        round('foliage', 0.02, 1.02, -0.05, 0.14, 0.20, 0.14, '#65a30d');      // dried eucalyptus sprig

      } else if (/^fllantern$/i.test(t)) {
        // Architectural Oversized Grand Hurricane Floor Lantern with Trio of Pillar Candles
        // 1. Heavy precision-welded architectural stainless / black metal frame
        box('metal', 0, 0.03, 0, 0.54, 0.06, 0.54, color || '#334155');        // base plinth
        for (const dx of [-0.24, 0.24]) {
          for (const dz of [-0.24, 0.24]) {
            box('metal', dx, 0.48, dz, 0.04, 0.86, 0.04, color || '#334155');   // corner pillars
          }
        }
        box('metal', 0, 0.90, 0, 0.54, 0.05, 0.54, color || '#334155');        // top header frame
        box('metal', 0, 0.94, 0, 0.36, 0.04, 0.36, color || '#1e293b');        // vented pyramid riser
        cylX('metal', 0, 0.98, 0, 0.14, 0.035, 0.035, '#c9a44e');               // heavy brass D-ring carry handle
        // 2. Crystal clear tempered glass side panels
        box('glass', 0, 0.48, 0, 0.48, 0.82, 0.48, '#d8eef4');
        // 3. Trio of staggered natural beeswax pillar candles with glowing flames
        const cnd = [
          { x: -0.09, z: 0.05, h: 0.44, r: 0.09 },
          { x: 0.09, z: 0.05, h: 0.32, r: 0.08 },
          { x: 0.00, z: -0.09, h: 0.22, r: 0.075 }
        ];
        for (const c of cnd) {
          cyl('ceramic', c.x, 0.06 + c.h / 2, c.z, c.r * 2, c.h, c.r * 2, '#fef3c7'); // candle pillar
          cyl('dark', c.x, 0.06 + c.h + 0.012, c.z, 0.01, 0.024, 0.01, '#181b1e');   // wick
          round('glow', c.x, 0.06 + c.h + 0.035, c.z, 0.035, 0.07, 0.035, '#f59e0b'); // golden flame
        }

      } else if (/^stbust$/i.test(t)) {
        // Classical Greco-Roman Carved Carrara Marble Portrait Bust Statue
        cyl('stone', 0, 0.16, 0, 0.38, 0.32, 0.38, '#cbd5e1');                 // pedestal
        round('stone', 0, 0.48, 0, 0.36, 0.34, 0.26, color || '#fafaf8');      // chest & shoulders
        round('stone', 0, 0.74, 0, 0.24, 0.28, 0.24, color || '#fafaf8');      // head & hair

      } else if (/^stcolumn$/i.test(t)) {
        // Contemporary Bronze Helix Ribbon Gallery Sculpture on Nero Marquina Marble Plinth
        box('stone', 0, 0.08, 0, 0.48, 0.16, 0.48, '#0f172a');                 // black marble plinth
        box('metal', 0, 0.165, 0, 0.44, 0.015, 0.44, '#c9a44e', true);         // brass inlay border
        cyl('metal', 0, 0.22, 0, 0.06, 0.10, 0.06, '#c9a44e', true);          // mounting stalk
        // Interlocking twisted bronze geometric rings
        boxRot('metal', 0, 0.42, 0, 0.28, 0.28, 0.05, 0.38, color || '#c9a44e', true);
        boxRot('metal', 0, 0.60, 0, 0.32, 0.32, 0.05, -0.42, color || '#c9a44e', true);
        boxRot('metal', 0, 0.78, 0, 0.24, 0.24, 0.05, 0.50, color || '#c9a44e', true);
        round('metal', 0, 0.92, 0, 0.08, 0.08, 0.08, '#f59e0b', true);         // polished apex sphere

      } else if (/^stceramic$/i.test(t)) {
        // Modernist Organic Biomorphic Ceramic Sculpture on Smoked Oak Plinth
        box('wood', 0, 0.10, 0, 0.42, 0.20, 0.42, '#2c1e14');                  // smoked oak pedestal
        cyl('metal', 0, 0.22, 0, 0.03, 0.06, 0.03, '#94a3b8', true);          // stainless steel mount rod
        round('ceramic', 0, 0.52, 0, 0.44, 0.56, 0.24, color || '#fafaf8');    // organic sculpted loop
        cyl('dark', 0, 0.52, 0, 0.18, 0.26, 0.18, '#1e293b', true);            // negative space opening
        round('ceramic', 0, 0.82, 0, 0.22, 0.26, 0.18, color || '#fafaf8');

      } else if (/^stfount$/i.test(t)) {
        // Multi-Tier Slate Rock & Bamboo Tabletop Zen Fountain
        cyl('stone', 0, 0.12, 0, 0.72, 0.24, 0.72, '#1e293b');                 // dark slate basin
        cyl('water', 0, 0.19, 0, 0.66, 0.02, 0.66, '#38bdf8');                 // rippling pool
        // River stones in basin
        round('stone', -0.18, 0.21, 0.12, 0.12, 0.06, 0.10, '#475569');
        round('stone', 0.16, 0.21, -0.14, 0.14, 0.07, 0.11, '#64748b');
        round('stone', 0.02, 0.21, 0.18, 0.10, 0.05, 0.09, '#334155');
        // Tiered natural slate ledges
        box('stone', -0.08, 0.28, -0.10, 0.36, 0.08, 0.32, '#334155');
        box('stone', -0.10, 0.40, -0.12, 0.26, 0.08, 0.24, '#1e293b');
        box('water', -0.04, 0.29, 0.04, 0.16, 0.12, 0.02, '#60a5fa');          // cascade spill sheet
        // Natural bamboo water chute (shishi-odoshi)
        cyl('wood', -0.18, 0.52, -0.18, 0.05, 0.38, 0.05, '#fed7aa');
        cylX('wood', -0.06, 0.58, -0.18, 0.22, 0.04, 0.04, '#fed7aa');
        round('glow', 0, 0.20, 0, 0.08, 0.04, 0.08, '#fef08a');                 // warm underwater LED glow

      } else if (/^shoji$/i.test(t)) {
        // Luxury Folding Japanese Shoji Byobu Screen (Taller than human: 50px tall, multi-panel)
        // Genuine Hinoki/Sumi dark cypress frame, luminous white washi paper, intricate Kumiko lattice grid
        // Continuous angled accordion zig-zag connects seamlessly across adjacent screens with zero duplicate posts!
        const sn = getScreenNeighbors();
        const fCol = color && color !== '#8a6844' ? color : '#362214'; // rich dark sumi cypress
        const foldZ = 0.12;
        const numLeaves = Math.max(2, Math.round((width / HP.CELL) * 2));
        const joints = [];
        for (let i = 0; i <= numLeaves; i++) {
          joints.push({
            x: -0.50 + i * (1.0 / numLeaves),
            z: (i % 2 === 0 ? -foldZ : foldZ)
          });
        }
        for (let i = 0; i < numLeaves; i++) {
          const j0 = joints[i], j1 = joints[i + 1];
          const cx = (j0.x + j1.x) / 2, cz = (j0.z + j1.z) / 2;
          const dx = (j1.x - j0.x) * width, dz = (j1.z - j0.z) * depth;
          const leafLen = Math.hypot(dx, dz) / width;
          const ang = -Math.atan2(dz, dx);
          // Flush outer stiles, top/bottom rails & translucent Japanese Washi paper panels
          boxRot('wood', cx, 0.965, cz, leafLen, 0.05, 0.026, ang, fCol);
          boxRot('wood', cx, 0.055, cz, leafLen, 0.05, 0.026, ang, fCol);
          boxRot('wood', cx, 0.12, cz, leafLen - 0.008, 0.09, 0.020, ang, fCol);
          boxRot('ceramic', cx, 0.54, cz, leafLen - 0.010, 0.80, 0.008, ang, '#fffdfa');
          for (let gy = 0; gy < 6; gy++) {
            const ly = 0.24 + gy * 0.115;
            boxRot('wood', cx, ly, cz, leafLen - 0.010, 0.009, 0.016, ang, fCol);
          }
          boxRot('wood', cx, 0.54, cz, 0.009, 0.78, 0.016, ang, fCol);
        }
        // Flush cylindrical brass corner hinge pins & slender inner hinge posts (zero jagged square ears!)
        for (let i = 0; i <= numLeaves; i++) {
          if (i === 0 && sn.left) continue;
          if (i === numLeaves && sn.right) continue;
          const j = joints[i];
          cyl('wood', j.x, 0.50, j.z, 0.018, 0.97, 0.018, fCol);
          cyl('metal', j.x, 0.02, j.z, 0.022, 0.04, 0.022, '#c9a44e');
          for (const hy of [0.22, 0.50, 0.78]) {
            cyl('metal', j.x, hy, j.z, 0.022, 0.045, 0.022, '#c9a44e');
          }
        }

      } else if (/^tapestry$/i.test(t)) {
        // Bohemian Handwoven Macrame Wall Tapestry on Driftwood (2x1 footprint)
        // 1. Natural weathered driftwood branch hung horizontally
        cylX('wood', 0, 0.94, -0.40, 0.92, 0.035, 0.035, '#fed7aa');
        // Brass wall anchor peg & twisted suspension rope triangle
        cyl('metal', 0, 1.08, -0.41, 0.02, 0.04, 0.02, '#c9a44e', true);
        boxSlope('fabric', -0.42, 0.94, -0.40, 0, 1.08, -0.40, 0.015, 0.015, '#d4c5b9');
        boxSlope('fabric', 0.42, 0.94, -0.40, 0, 1.08, -0.40, 0.015, 0.015, '#d4c5b9');
        // 2. Thick woven natural cotton macrame body with geometric chevron motifs
        box('fabric', 0, 0.62, -0.40, 0.84, 0.58, 0.02, color || '#fdfbf7');
        boxRot('fabric', -0.18, 0.66, -0.39, 0.36, 0.04, 0.01, 0.35, '#d97706');
        boxRot('fabric', 0.18, 0.66, -0.39, 0.36, 0.04, 0.01, -0.35, '#d97706');
        boxRot('fabric', -0.18, 0.54, -0.39, 0.36, 0.04, 0.01, 0.35, '#0284c7');
        boxRot('fabric', 0.18, 0.54, -0.39, 0.36, 0.04, 0.01, -0.35, '#0284c7');
        // 3. Staggered fringe tassels dangling from bottom edge
        for (let t = 0; t < 9; t++) {
          const tx = -0.36 + t * 0.09;
          const th = 0.16 + (4 - Math.abs(t - 4)) * 0.04;
          cyl('fabric', tx, 0.33 - th / 2, -0.40, 0.025, th, 0.025, '#faf5ee');
        }

      } else if (/canopy/i.test(t)) {
        // Luxury 4-Poster Canopy Bed (4x4 footprint, architectural matte black steel / solid oak posts rising to full y=1.0 = 52px, draped sheer canopy, upholstered headboard, plush layered bedding)
        // 1. 4 Slender architectural corner canopy posts rising full height (52px tall)
        for (const [px, pz] of [[-0.44, -0.42], [0.44, -0.42], [-0.44, 0.42], [0.44, 0.42]]) {
          box('metal', px, 0.50, pz, 0.035, 1.0, 0.035, '#1e2126', true);
          box('metal', px, 0.02, pz, 0.045, 0.04, 0.045, '#c9a44e', true);  // brass foot ferrule
          box('metal', px, 0.98, pz, 0.045, 0.04, 0.045, '#c9a44e', true);  // brass top finial collar
        }
        // Continuous perimeter canopy crown rails connecting posts at the top (y=0.98)
        box('metal', 0, 0.98, -0.42, 0.88, 0.025, 0.025, '#1e2126', true); // rear top rail
        box('metal', 0, 0.98, 0.42, 0.88, 0.025, 0.025, '#1e2126', true);  // front top rail
        box('metal', -0.44, 0.98, 0, 0.025, 0.025, 0.84, '#1e2126', true);  // left top rail
        box('metal', 0.44, 0.98, 0, 0.025, 0.025, 0.84, '#1e2126', true);   // right top rail

        // 2. Light ethereal semi-sheer linen canopy valance draped gracefully across top
        box('fabric', 0, 0.965, -0.42, 0.86, 0.06, 0.04, '#faf7f2');
        box('fabric', 0, 0.965, 0.42, 0.86, 0.06, 0.04, '#faf7f2');
        box('fabric', -0.44, 0.965, 0, 0.04, 0.06, 0.82, '#faf7f2');
        box('fabric', 0.44, 0.965, 0, 0.04, 0.06, 0.82, '#faf7f2');

        // 3. Platform chassis & upholstered surround (mattress sitting height y=0.30 = 15.6px)
        box('dark', 0, 0.04, 0, 0.86, 0.08, 0.82, '#181b1f');              // recessed base shadow plinth
        box('fabric', 0, 0.12, 0, 0.88, 0.12, 0.84, HP.shade(color, 0.92)); // upholstered frame surround

        // 4. Built-in padded linen headboard between rear posts (y=0.10 to 0.48)
        box('fabric', 0, 0.32, -0.41, 0.84, 0.38, 0.05, color);
        box('fabric', 0, 0.32, -0.40, 0.80, 0.34, 0.04, HP.shade(color, 1.06));

        // 5. Deep plush mattress & luxury turned-down duvet
        box('fabric', 0, 0.22, 0.02, 0.80, 0.14, 0.78, '#faf9f5');          // mattress
        box('fabric', 0, 0.28, 0.08, 0.78, 0.10, 0.62, HP.shade(color, 1.04)); // plush down duvet
        box('fabric', 0, 0.335, 0.08, 0.76, 0.02, 0.60, HP.shade(color, 1.08));
        // Turned-down white linen sheet fold
        box('fabric', 0, 0.29, -0.22, 0.76, 0.04, 0.08, '#ffffff');
        // Folded waffle throw blanket at foot of bed
        box('fabric', 0, 0.32, 0.28, 0.79, 0.05, 0.22, '#c47a50');

        // 6. 4 plush sleeping pillows arranged against headboard
        for (const px of [-0.22, 0.22]) {
          box('fabric', px, 0.34, -0.28, 0.30, 0.10, 0.14, '#ffffff');     // rear sleeping pillow
          box('fabric', px, 0.35, -0.19, 0.26, 0.09, 0.12, HP.shade(color, 1.12)); // front accent sham
        }

      } else if (/bunkbed/i.test(t)) {
        // Modern Scandinavian Twin-Over-Twin Bunk Bed (2x4 footprint, solid birch/oak frame, integrated guardrails, angled climbing ladder, dual mattresses)
        // 1. 4 Sturdy square structural posts rising to y=1.0 = 46px
        for (const [px, pz] of [[-0.44, -0.44], [0.44, -0.44], [-0.44, 0.44], [0.44, 0.44]]) {
          box('wood', px, 0.50, pz, 0.08, 1.0, 0.08, '#d4a87a');
        }
        // Connecting cross rails for both levels
        for (const py of [0.18, 0.68]) {
          box('wood', 0, py, -0.44, 0.84, 0.08, 0.04, '#c69868');           // rear end rail
          box('wood', 0, py, 0.44, 0.84, 0.08, 0.04, '#c69868');            // front end rail
          box('wood', -0.44, py, 0, 0.04, 0.08, 0.84, '#c69868');           // left long rail
          box('wood', 0.44, py, 0, 0.04, 0.08, 0.84, '#c69868');            // right long rail
        }

        // 2. Lower bunk mattress & cozy bedding (sitting height y=0.22)
        box('fabric', 0, 0.23, 0.01, 0.78, 0.12, 0.84, '#faf9f5');
        box('fabric', 0, 0.28, 0.06, 0.76, 0.08, 0.68, color);
        box('fabric', 0, 0.31, -0.26, 0.50, 0.08, 0.20, '#ffffff');        // lower pillow

        // 3. Upper bunk mattress, cozy bedding & safety guardrails (mattress at y=0.72)
        box('fabric', 0, 0.73, 0.01, 0.78, 0.12, 0.84, '#faf9f5');
        box('fabric', 0, 0.78, 0.06, 0.76, 0.08, 0.68, HP.shade(color, 1.12));
        box('fabric', 0, 0.81, -0.26, 0.50, 0.08, 0.20, '#ffffff');        // upper pillow
        // Safety guardrails along top bunk (leaving ladder entrance on right)
        box('wood', -0.44, 0.84, 0, 0.04, 0.05, 0.84, '#d4a87a');          // left side guardrail
        box('wood', 0, 0.84, -0.44, 0.84, 0.05, 0.04, '#d4a87a');          // head guardrail
        box('wood', 0, 0.84, 0.44, 0.84, 0.05, 0.04, '#d4a87a');           // foot guardrail
        box('wood', 0.44, 0.84, -0.16, 0.04, 0.05, 0.48, '#d4a87a');        // right partial guardrail

        // 4. Sturdy climbing ladder on right side
        for (const lz of [0.14, 0.38]) {
          cyl('wood', 0.47, 0.46, lz, 0.035, 0.88, 0.035, '#b88a5a');       // vertical ladder stiles
        }
        for (let r = 0; r < 4; r++) {
          box('wood', 0.47, 0.20 + r * 0.18, 0.26, 0.03, 0.03, 0.22, '#d4a87a'); // ladder rungs
        }

      } else if (/crib/i.test(t)) {
        // Modern Scandinavian Nursery Spindle Crib (2x3 footprint, solid birch/beech spindle railings, hypoallergenic mattress, fitted bedding)
        // 1. Splayed architectural round tapered legs with brass shoes
        for (const [lx, lz] of [[-0.42, -0.40], [0.42, -0.40], [-0.42, 0.40], [0.42, 0.40]]) {
          cyl('wood', lx, 0.12, lz, 0.04, 0.24, 0.04, '#cf9f70');
          cyl('metal', lx, 0.02, lz, 0.045, 0.04, 0.045, '#c9a44e', true);
        }
        // Base mattress support frame
        box('wood', 0, 0.24, 0, 0.88, 0.05, 0.84, '#c59565');

        // 2. Hypoallergenic infant mattress with soft fitted pastel sheet
        box('fabric', 0, 0.30, 0, 0.84, 0.10, 0.80, '#fafaf6');
        box('fabric', 0, 0.35, 0.10, 0.80, 0.03, 0.54, color);             // soft folded baby blanket
        box('fabric', 0, 0.35, -0.24, 0.46, 0.05, 0.18, '#ffffff');        // baby pillow

        // 3. Perimeter Spindle Railings with rounded top crest rails (rises to y=1.0 = 24px)
        // Top perimeter cap rail
        box('wood', 0, 0.96, -0.42, 0.90, 0.04, 0.04, '#cf9f70');          // rear cap rail
        box('wood', 0, 0.96, 0.42, 0.90, 0.04, 0.04, '#cf9f70');           // front cap rail
        box('wood', -0.44, 0.96, 0, 0.04, 0.04, 0.84, '#cf9f70');          // left cap rail
        box('wood', 0.44, 0.96, 0, 0.04, 0.04, 0.84, '#cf9f70');           // right cap rail

        // 4 Corner structural posts
        for (const [px, pz] of [[-0.44, -0.42], [0.44, -0.42], [-0.44, 0.42], [0.44, 0.42]]) {
          box('wood', px, 0.60, pz, 0.05, 0.72, 0.05, '#cf9f70');
        }
        // Slender vertical safety spindles along all 4 sides
        for (let i = 0; i < 7; i++) {
          const sx = -0.36 + i * 0.12;
          cyl('wood', sx, 0.60, -0.42, 0.018, 0.68, 0.018, '#e0b88e');      // rear spindles
          cyl('wood', sx, 0.60, 0.42, 0.018, 0.68, 0.018, '#e0b88e');       // front spindles
        }
        for (let j = 0; j < 6; j++) {
          const sz = -0.32 + j * 0.128;
          cyl('wood', -0.44, 0.60, sz, 0.018, 0.68, 0.018, '#e0b88e');      // left spindles
          cyl('wood', 0.44, 0.60, sz, 0.018, 0.68, 0.018, '#e0b88e');       // right spindles
        }

      } else if (/bedking|kingbed/i.test(t)) {
        // Luxury Master Suite King Bed (5x4 footprint, grand fluted winged headboard spanning 120px to y=1.0=32px, dual floating bedside ledges, California king mattress & layered duvet)
        // 1. Recessed dark bronze metal platform plinth with floating shadow reveal
        box('dark', 0, 0.04, 0.04, 0.74, 0.08, 0.82, '#181b1e');
        box('wood', 0, 0.12, 0.04, 0.76, 0.10, 0.84, '#241a12');            // solid dark walnut chassis

        // 2. Grand Architectural Fluted Winged Headboard (Spanning full width to y=1.0 = 32px)
        box('wood', 0, 0.52, -0.44, 0.98, 0.96, 0.05, '#241a12');           // rear acoustic wood backer
        // Vertical relief timber flutes across the headboard
        for (let i = 0; i < 18; i++) {
          const fx = -0.46 + i * (0.92 / 17);
          box('wood', fx, 0.52, -0.42, 0.022, 0.96, 0.02, '#38281c');
        }
        // Upholstered central comfort back panel
        box('fabric', 0, 0.48, -0.40, 0.72, 0.72, 0.04, color);
        box('fabric', 0, 0.84, -0.40, 0.70, 0.03, 0.045, HP.shade(color, 1.10));

        // 3. Integrated Floating Bedside Nightstand Ledges on Left & Right Flanks
        for (const side of [-0.41, 0.41]) {
          box('wood', side, 0.28, -0.32, 0.15, 0.04, 0.18, '#241a12');      // floating wood ledge
          box('metal', side, 0.26, -0.32, 0.14, 0.01, 0.17, '#c9a44e', true);// brass accent trim
          // Designer mini bud vase / candle
          cyl('ceramic', side, 0.35, -0.32, 0.03, 0.08, 0.03, '#fafaf8');
        }

        // 4. California King Deep Pillow-Top Mattress (sitting height y=0.32 = 10.2px)
        box('fabric', 0, 0.24, 0.04, 0.70, 0.16, 0.78, '#faf9f5');
        // Luxurious overstuffed down duvet with turned-down top sheet
        box('fabric', 0, 0.32, 0.10, 0.68, 0.12, 0.62, HP.shade(color, 1.04));
        box('fabric', 0, 0.385, 0.10, 0.66, 0.025, 0.60, HP.shade(color, 1.08));
        box('fabric', 0, 0.33, -0.22, 0.66, 0.04, 0.08, '#ffffff');        // crisp turned sheet
        // Draped textural cashmere throw blanket at foot of bed
        box('fabric', 0, 0.37, 0.28, 0.69, 0.04, 0.24, '#c47d52');

        // 5. 6 Plush King Sleeping Pillows & Velvet Accent Cushions
        for (const px of [-0.22, 0.22]) {
          box('fabric', px, 0.42, -0.30, 0.26, 0.16, 0.12, '#ffffff');     // rear king pillows
          box('fabric', px, 0.38, -0.20, 0.24, 0.14, 0.11, HP.shade(color, 1.12)); // front shams
        }
        box('fabric', 0, 0.36, -0.14, 0.20, 0.10, 0.10, '#8c4830');        // center velvet accent pillow

      } else if (/bedqueen|queenbed/i.test(t)) {
        // Luxury Queen Platform Bed (4x4 footprint, upholstered winged channeled headboard rising to y=1.0=30px, floating walnut base, plush layered duvet, folded waffle throw)
        // 1. Floating architectural walnut platform base with recessed shadow plinth
        box('dark', 0, 0.04, 0.03, 0.88, 0.08, 0.82, '#181b1e');
        box('wood', 0, 0.12, 0.03, 0.90, 0.10, 0.84, '#2d1e14');            // solid walnut frame surround

        // 2. Grand Winged Channeled Upholstered Headboard (Rises to full y=1.0 = 30px!)
        box('fabric', 0, 0.54, -0.44, 0.92, 0.92, 0.08, HP.shade(color, 0.92)); // headboard carcass
        // 4 Vertical channel-tufted flutes with deep piped seams
        for (let c = 0; c < 4; c++) {
          const cx = -0.33 + c * 0.22;
          box('fabric', cx, 0.54, -0.40, 0.20, 0.88, 0.05, color);
          box('fabric', cx, 0.975, -0.40, 0.19, 0.03, 0.045, HP.shade(color, 1.08));
        }
        // Architectural wing returns on left and right sides
        box('fabric', -0.47, 0.54, -0.38, 0.05, 0.92, 0.18, HP.shade(color, 0.96));
        box('fabric', 0.47, 0.54, -0.38, 0.05, 0.92, 0.18, HP.shade(color, 0.96));

        // 3. Deep Pillow-Top Queen Mattress (sitting height reaches y=0.32 = 9.6px)
        box('fabric', 0, 0.23, 0.03, 0.82, 0.16, 0.78, '#faf9f5');

        // 4. Plush down-filled duvet with turned-down top sheet
        box('fabric', 0, 0.32, 0.10, 0.80, 0.12, 0.62, HP.shade(color, 1.04));
        box('fabric', 0, 0.385, 0.10, 0.78, 0.025, 0.60, HP.shade(color, 1.08));
        box('fabric', 0, 0.33, -0.22, 0.78, 0.04, 0.08, '#ffffff');        // crisp white sheet fold
        // Folded waffle throw blanket at foot of bed
        box('fabric', 0, 0.37, 0.28, 0.81, 0.04, 0.24, '#c47d52');

        // 5. 4 Plush sleeping pillows arranged against headboard
        for (const px of [-0.22, 0.22]) {
          box('fabric', px, 0.40, -0.28, 0.28, 0.14, 0.14, '#ffffff');     // rear sleeping pillow
          box('fabric', px, 0.37, -0.18, 0.25, 0.12, 0.12, HP.shade(color, 1.12)); // front accent sham
        }
        box('fabric', 0, 0.35, -0.12, 0.22, 0.08, 0.10, '#8c4830');        // center lumbar cushion

      } else if (/beddouble|doublebed/i.test(t)) {
        // Modern Double Bed (3x4 footprint, tailored linen headboard to y=1.0=28px, solid oak tapered legs, crisp bedding, lumbar accent cushion)
        // 1. Solid oak tapered legs with brushed brass shoes
        for (const [lx, lz] of [[-0.42, -0.40], [0.42, -0.40], [-0.42, 0.40], [0.42, 0.40]]) {
          cyl('wood', lx, 0.10, lz, 0.04, 0.20, 0.04, '#38281a');
          cyl('metal', lx, 0.015, lz, 0.045, 0.03, 0.045, '#c9a44e', true);
        }
        // Solid oak frame surround
        box('wood', 0, 0.14, 0.03, 0.88, 0.10, 0.84, '#38281a');

        // 2. Tailored Upholstered Linen Headboard (rises to full y=1.0 = 28px)
        box('fabric', 0, 0.54, -0.44, 0.88, 0.90, 0.07, color);
        box('fabric', 0, 0.54, -0.42, 0.84, 0.86, 0.04, HP.shade(color, 1.06));
        box('fabric', 0, 0.975, -0.42, 0.84, 0.03, 0.045, HP.shade(color, 1.12));

        // 3. Mattress & crisp layered duvet
        box('fabric', 0, 0.24, 0.03, 0.80, 0.16, 0.78, '#faf9f5');
        box('fabric', 0, 0.32, 0.10, 0.78, 0.12, 0.62, HP.shade(color, 1.04));
        box('fabric', 0, 0.385, 0.10, 0.76, 0.025, 0.60, HP.shade(color, 1.08));
        box('fabric', 0, 0.33, -0.22, 0.76, 0.04, 0.08, '#ffffff');
        box('fabric', 0, 0.37, 0.28, 0.79, 0.04, 0.22, '#c47d52');

        // 4. Pillows & lumbar cushion
        for (const px of [-0.20, 0.20]) {
          box('fabric', px, 0.40, -0.28, 0.26, 0.14, 0.14, '#ffffff');
          box('fabric', px, 0.37, -0.18, 0.23, 0.12, 0.12, HP.shade(color, 1.12));
        }

      } else if (/bedsingle|singlebed/i.test(t)) {
        // Scandinavian Single Bed (2x4 footprint, solid light oak frame, angled slatted headboard to y=1.0=26px, cozy duvet)
        // 1. Solid light oak frame & tapered legs
        for (const [lx, lz] of [[-0.42, -0.40], [0.42, -0.40], [-0.42, 0.40], [0.42, 0.40]]) {
          cyl('wood', lx, 0.10, lz, 0.04, 0.20, 0.04, '#cf9f70');
          cyl('metal', lx, 0.015, lz, 0.045, 0.03, 0.045, '#c9a44e', true);
        }
        box('wood', 0, 0.14, 0.03, 0.88, 0.10, 0.84, '#cf9f70');

        // 2. Angled Solid Oak Slatted Headboard (rises to y=1.0 = 26px)
        box('wood', 0, 0.54, -0.44, 0.88, 0.90, 0.05, '#cf9f70');
        for (let s = -0.30; s <= 0.30; s += 0.15) {
          box('wood', s, 0.54, -0.42, 0.08, 0.84, 0.02, '#e0b88e');
        }

        // 3. Mattress & cozy duvet
        box('fabric', 0, 0.24, 0.03, 0.80, 0.16, 0.78, '#faf9f5');
        box('fabric', 0, 0.32, 0.10, 0.78, 0.12, 0.62, color);
        box('fabric', 0, 0.385, 0.10, 0.76, 0.025, 0.60, HP.shade(color, 1.08));
        box('fabric', 0, 0.33, -0.22, 0.76, 0.04, 0.08, '#ffffff');
        box('fabric', 0, 0.37, 0.28, 0.79, 0.04, 0.22, '#c47d52');

        // 4. Sleeping pillow & accent cushion
        box('fabric', 0, 0.40, -0.28, 0.44, 0.14, 0.16, '#ffffff');
        box('fabric', 0, 0.37, -0.16, 0.32, 0.11, 0.12, HP.shade(color, 1.15));

      } else if (/^nightstand$|bedside/i.test(t)) {
        // Modern Bedside Nightstand (1x1 footprint, soft-close drawer with brass pull, lower open shelf, designer ceramic table lamp)
        // 1. Splayed dark steel legs with brass glides
        for (const [lx, lz] of [[-0.36, 0.34], [0.36, 0.34], [-0.36, -0.34], [0.36, -0.34]]) {
          cyl('dark', lx, 0.12, lz, 0.035, 0.24, 0.035, '#181b1e');
          cyl('metal', lx, 0.015, lz, 0.040, 0.03, 0.040, '#c9a44e', true);
        }
        // Main cabinet carcass in natural oak/walnut (y=0.24 to 0.90)
        box('wood', 0, 0.58, 0, 0.88, 0.66, 0.84, color);
        box('dark', 0, 0.915, 0, 0.86, 0.02, 0.82, '#181b1e');           // recessed top reveal
        box('wood', 0, 0.94, 0, 0.90, 0.04, 0.86, HP.shade(color, 1.06)); // solid wood top slab

        // Soft-close top drawer with brushed brass pull
        box('wood', 0, 0.74, 0.43, 0.80, 0.28, 0.02, HP.shade(color, 1.04));
        box('metal', 0, 0.74, 0.45, 0.18, 0.018, 0.018, '#c9a44e', true);

        // Lower open display cubby with hardcover book
        box('dark', 0, 0.40, 0.04, 0.78, 0.24, 0.74, '#15171a');
        box('fabric', 0, 0.32, 0.06, 0.34, 0.05, 0.42, '#9c5a3c');        // accent book

        // Tabletop designer modern ceramic lamp
        cyl('ceramic', 0, 1.01, 0, 0.16, 0.12, 0.16, '#fafaf8');           // ceramic lamp base
        cyl('metal', 0, 1.08, 0, 0.02, 0.06, 0.02, '#c9a44e', true);       // brass stem
        cyl('fabric', 0, 1.18, 0, 0.26, 0.18, 0.26, '#f4eee4');            // linen lampshade
        cyl('glow', 0, 1.15, 0, 0.04, 0.06, 0.04, '#ffe0a0');              // warm LED bulb glow

      } else if (/^dresser$|chest.*drawers/i.test(t)) {
        // Modern 6-Drawer Double Dresser (3x1 footprint, 2 columns of 3 fluted drawers, brass edge pulls, vanity display tray, 25px height)
        // 1. Splayed architectural dark metal base frame with brass feet
        for (const [lx, lz] of [[-0.44, 0.34], [0.44, 0.34], [-0.44, -0.34], [0.44, -0.34], [0, 0.34], [0, -0.34]]) {
          cyl('dark', lx, 0.06, lz, 0.03, 0.12, 0.03, '#181b1e');
          cyl('metal', lx, 0.015, lz, 0.035, 0.03, 0.035, '#c9a44e', true);
        }
        // Main dresser carcass in natural oak/walnut (y=0.12 to 0.94)
        box('wood', 0, 0.54, 0, 0.94, 0.80, 0.86, color);
        box('dark', 0, 0.945, 0, 0.92, 0.02, 0.84, '#181b1e');
        box('wood', 0, 0.97, 0, 0.96, 0.04, 0.88, HP.shade(color, 1.08)); // beveled top slab

        // 6 Soft-Close Drawers (2 columns x 3 tiers) with fluted reliefs & brass edge pulls
        for (const col of [-0.23, 0.23]) {
          for (let row = 0; row < 3; row++) {
            const dy = 0.27 + row * 0.25;
            box('wood', col, dy, 0.44, 0.42, 0.22, 0.02, HP.shade(color, 1.02));
            box('metal', col, dy + 0.08, 0.455, 0.14, 0.015, 0.015, '#c9a44e', true); // brass pull
          }
        }

        // Curated Vanity Display on Dresser Top: Honed marble tray + ceramic perfume vase
        box('ceramic', 0.18, 1.005, 0, 0.24, 0.018, 0.34, '#fafaf8');      // marble vanity tray
        box('metal', 0.18, 1.015, 0, 0.25, 0.012, 0.35, '#c9a44e', true);  // brass tray rim
        cyl('ceramic', -0.22, 1.06, 0, 0.06, 0.12, 0.06, '#e8e2d8');        // ceramic sculptural vase

      } else if (/^wardrobe$|^armoire$/i.test(t)) {
        // Luxury Modern Armoire Wardrobe (3x1 footprint, 50px tall, 3 shaker panel doors, brass vertical bar pulls, shadow reveal toe-kick)
        // 1. Recessed dark shadow plinth (y=0 to 0.06)
        box('dark', 0, 0.03, 0, 0.92, 0.06, 0.84, '#15171a');
        // Main wardrobe carcass (y=0.06 to 0.96)
        box('wood', 0, 0.51, 0, 0.96, 0.88, 0.88, color);
        box('wood', 0, 0.97, 0, 0.98, 0.04, 0.90, HP.shade(color, 1.12)); // top architectural crown molding

        // 2. 3 Shaker-Style Panel Doors with Recessed Center Inlays
        for (let d = 0; d < 3; d++) {
          const dx = -0.31 + d * 0.31;
          // Outer door frame
          box('wood', dx, 0.51, 0.45, 0.29, 0.84, 0.02, HP.shade(color, 0.96));
          // Recessed center panel
          box('wood', dx, 0.51, 0.445, 0.23, 0.76, 0.01, HP.shade(color, 1.04));
          // Sleek vertical brushed brass bar pull
          const px = d === 1 ? dx + 0.10 : (d === 0 ? dx + 0.11 : dx - 0.11);
          box('metal', px, 0.50, 0.47, 0.015, 0.20, 0.018, '#c9a44e', true);
        }

      } else if (/bed|bunk|crib|futon/.test(t) && !/flower/.test(t)) {
        box('wood', 0, 0.2, 0, 0.96, 0.29, 0.96);
        box('fabric', 0, 0.48, 0, 0.91, 0.3, 0.91, '#fff8e9');
        box('fabric', 0, 0.67, 0.12, 0.93, 0.12, 0.67, color);
        box('wood', 0, 1.1, -0.46, 0.99, 1.8, 0.06);
        for (const x of [-0.23, 0.23]) round('fabric', x, 0.69, -0.3, 0.39, 0.18, 0.21, '#fff6e6');
        box('fabric', 0, 0.74, 0.3, 0.94, 0.03, 0.18, '#ded3bd', true);
      } else if (/^sofau$|sectional.*5|^u.*sofa|double.*chaise/i.test(t) || /u-sectional|sectional.*sofa/i.test(def.name || '')) {
        // Modern Minimalist U-Sectional Sofa (5x3 footprint, dual chaise lounges, open center legwell, airy legs, sleek track arms)
        // 1. 8 Slender architectural tapered legs with brushed brass ferrules (airy 4px floor clearance, no heavy block!)
        const legPositions = [
          [-0.43, -0.34], [0.43, -0.34], [-0.15, -0.34], [0.15, -0.34], // rear row
          [-0.43, 0.34], [-0.17, 0.34],                                  // left chaise front
          [0.43, 0.34], [0.17, 0.34]                                     // right chaise front
        ];
        for (const [lx, lz] of legPositions) {
          cyl('dark', lx, 0.06, lz, 0.022, 0.12, 0.022, '#181a1d');
          cyl('metal', lx, 0.015, lz, 0.026, 0.03, 0.026, '#c9a44e');
        }

        // 2. U-Shaped Low-Profile Chassis Deck (Center front is completely OPEN legwell!)
        box('fabric', 0, 0.16, -0.22, 0.86, 0.10, 0.28, HP.shade(color, 0.88));
        box('fabric', -0.30, 0.16, 0.08, 0.26, 0.10, 0.54, HP.shade(color, 0.88));
        box('fabric', 0.30, 0.16, 0.08, 0.26, 0.10, 0.54, HP.shade(color, 0.88));

        // 3. Plush Tailored Cushions (Comfort sitting height reaches y=0.38)
        box('fabric', 0, 0.28, -0.18, 0.26, 0.15, 0.24, color);
        box('fabric', 0, 0.365, -0.18, 0.24, 0.025, 0.22, HP.shade(color, 1.08));

        // Left chaise cushions (rear seat + extended front chaise)
        box('fabric', -0.30, 0.28, -0.18, 0.25, 0.15, 0.24, color);
        box('fabric', -0.30, 0.365, -0.18, 0.23, 0.025, 0.22, HP.shade(color, 1.08));
        box('fabric', -0.30, 0.28, 0.14, 0.25, 0.15, 0.40, color);
        box('fabric', -0.30, 0.365, 0.14, 0.23, 0.025, 0.38, HP.shade(color, 1.08));

        // Right chaise cushions (rear seat + extended front chaise)
        box('fabric', 0.30, 0.28, -0.18, 0.25, 0.15, 0.24, color);
        box('fabric', 0.30, 0.365, -0.18, 0.23, 0.025, 0.22, HP.shade(color, 1.08));
        box('fabric', 0.30, 0.28, 0.14, 0.25, 0.15, 0.40, color);
        box('fabric', 0.30, 0.365, 0.14, 0.23, 0.025, 0.38, HP.shade(color, 1.08));

        // 4. Sleek Tailored Outer Track Arms (Width=0.05 = 6.75px sleek profile, NOT 18px thick walls!)
        box('fabric', -0.45, 0.35, 0, 0.05, 0.44, 0.72, color);
        box('fabric', -0.45, 0.58, 0, 0.055, 0.03, 0.72, HP.shade(color, 1.05));
        box('fabric', 0.45, 0.35, 0, 0.05, 0.44, 0.72, color);
        box('fabric', 0.45, 0.58, 0, 0.055, 0.03, 0.72, HP.shade(color, 1.05));

        // 5. Architectural Back Frame & 3 Tall Overstuffed Back Cushions (cleanly inset from back frame & arms)
        box('fabric', 0, 0.48, -0.35, 0.86, 0.62, 0.06, HP.shade(color, 0.94));
        box('fabric', 0, 0.795, -0.35, 0.87, 0.025, 0.07, HP.shade(color, 0.98));

        // 3 Plush upright back cushions with headrest rolls
        for (const bx of [-0.285, 0, 0.285]) {
          box('fabric', bx, 0.60, -0.265, 0.24, 0.48, 0.08, HP.shade(color, 1.05));
          box('fabric', bx, 0.85, -0.265, 0.22, 0.04, 0.07, HP.shade(color, 1.10));
          box('fabric', bx, 0.52, -0.215, 0.20, 0.28, 0.035, HP.shade(color, 1.08));
        }

        // 6. Curated Details: Folded terracotta throw blanket on left chaise + cream bouclé throw pillows (clear of arms)
        box('fabric', -0.295, 0.395, 0.28, 0.23, 0.02, 0.18, '#c47d52');
        box('fabric', -0.422, 0.32, 0.28, 0.014, 0.14, 0.18, '#b06f47');
        box('fabric', -0.35, 0.48, -0.17, 0.07, 0.17, 0.14, '#f0eae1');
        box('fabric', 0.35, 0.48, -0.17, 0.07, 0.17, 0.14, '#f0eae1');

      } else if (/^sofal$|^l.*sofa/i.test(t) || /l-sofa|l.*sectional/i.test(def.name || '')) {
        // Modern Minimal L-Sectional Chaise Sofa (cleanly inset cushions, zero poke-through past arms/back)
        // 1. Recessed architectural plinth base in dark bronze metal
        box('dark', -0.18, 0.04, -0.11, 0.52, 0.08, 0.44, '#15171a');
        box('dark', 0.25, 0.04, 0.08, 0.34, 0.08, 0.78, '#15171a');

        // 2. Structural upholstered chassis deck
        box('fabric', -0.18, 0.16, -0.11, 0.54, 0.14, 0.46, HP.shade(color, 0.88));
        box('fabric', 0.25, 0.16, 0.08, 0.36, 0.14, 0.80, HP.shade(color, 0.88));

        // 3. Left 2 Extra-Plush Seat Cushions (inner edge flush inside left arm -0.425 and backrest -0.335)
        for (const [cx, cz] of [[-0.295, -0.10], [-0.045, -0.10]]) {
          box('fabric', cx, 0.32, cz, 0.24, 0.18, 0.44, HP.shade(color, 1.04));
          box('fabric', cx, 0.415, cz, 0.22, 0.03, 0.42, HP.shade(color, 1.08));
        }

        // 4. Extended Right Chaise Lounge Cushion (cleanly inset inside right arm +0.425 and backrest)
        box('fabric', 0.25, 0.32, 0.09, 0.335, 0.18, 0.78, HP.shade(color, 1.04));
        box('fabric', 0.25, 0.415, 0.09, 0.315, 0.03, 0.76, HP.shade(color, 1.08));

        // 5. Architectural Track Arms with Padded Top Caps (y reaches 0.67 = 21.4px)
        box('fabric', -0.46, 0.38, -0.11, 0.07, 0.48, 0.48, color);
        box('fabric', -0.46, 0.63, -0.11, 0.08, 0.04, 0.48, HP.shade(color, 1.05));
        box('fabric', 0.46, 0.38, 0.08, 0.07, 0.48, 0.84, color);
        box('fabric', 0.46, 0.63, 0.08, 0.08, 0.04, 0.84, HP.shade(color, 1.05));

        // 6. Substantial Structural Back Frame (z=-0.43..-0.34)
        box('fabric', 0, 0.56, -0.385, 0.88, 0.70, 0.09, HP.shade(color, 0.94));
        box('fabric', 0, 0.915, -0.385, 0.89, 0.03, 0.10, HP.shade(color, 0.98));

        // 7. 3 Tall Overstuffed Ergonomic Back Cushions (cleanly seated forward of backrest at z=-0.285)
        const lBacks = [
          { bx: -0.295, bw: 0.24 },
          { bx: -0.045, bw: 0.24 },
          { bx: 0.25, bw: 0.335 }
        ];
        for (const { bx, bw } of lBacks) {
          box('fabric', bx, 0.68, -0.285, bw, 0.58, 0.10, HP.shade(color, 1.05));
          box('fabric', bx, 0.975, -0.285, bw - 0.02, 0.05, 0.09, HP.shade(color, 1.10));
          box('fabric', bx, 0.62, -0.225, bw - 0.03, 0.36, 0.04, HP.shade(color, 1.12));
        }

        // 8. Decorative Touches: Draped luxury throw blanket + bouclé corner pillow
        box('fabric', 0.25, 0.435, 0.34, 0.32, 0.025, 0.24, '#c47d52');
        box('fabric', 0.465, 0.35, 0.34, 0.02, 0.16, 0.24, '#b06f47');
        box('fabric', 0.28, 0.35, 0.465, 0.36, 0.16, 0.02, '#b06f47');
        box('fabric', -0.38, 0.52, -0.24, 0.10, 0.20, 0.20, '#f0eae1');
        box('fabric', -0.38, 0.52, -0.24, 0.12, 0.16, 0.16, '#faf7f2');

      } else if (/track4|grand.*sofa|^sofa4/i.test(t) || /grand.*sofa|4-seat/i.test(def.name || '')) {
        // Modern Minimal 4-Seat Grand Sofa (5x2 footprint, 4 seating bays, 8 architectural legs, full back cushions to 1.0)
        for (const [lx, lz] of [[-0.45, 0.14], [-0.15, 0.14], [0.15, 0.14], [0.45, 0.14], [-0.45, -0.32], [-0.15, -0.32], [0.15, -0.32], [0.45, -0.32]]) {
          cyl('dark', lx, 0.06, lz, 0.024, 0.12, 0.024, '#181a1d');
          cyl('metal', lx, 0.015, lz, 0.028, 0.03, 0.028, '#c9a44e', true);
        }
        box('dark', 0, 0.12, -0.10, 0.94, 0.02, 0.58, '#181a1d');
        box('fabric', 0, 0.18, -0.10, 0.96, 0.12, 0.60, HP.shade(color, 0.90));
        // 4 Generous plush seat cushions
        for (const dx of [-0.35, -0.12, 0.12, 0.35]) {
          box('fabric', dx, 0.32, -0.06, 0.22, 0.18, 0.50, HP.shade(color, 1.04));
          box('fabric', dx, 0.415, -0.06, 0.20, 0.03, 0.48, HP.shade(color, 1.08));
        }
        for (const x of [-0.46, 0.46]) {
          box('fabric', x, 0.38, -0.10, 0.06, 0.48, 0.60, color);
          box('fabric', x, 0.63, -0.10, 0.065, 0.04, 0.58, HP.shade(color, 1.05));
        }
        box('fabric', 0, 0.56, -0.38, 0.95, 0.70, 0.12, color);
        box('fabric', 0, 0.915, -0.38, 0.96, 0.03, 0.13, HP.shade(color, 0.98));
        for (const dx of [-0.35, -0.12, 0.12, 0.35]) {
          box('fabric', dx, 0.68, -0.30, 0.22, 0.58, 0.12, HP.shade(color, 1.05));
          box('fabric', dx, 0.975, -0.30, 0.20, 0.05, 0.11, HP.shade(color, 1.10));
        }
        box('fabric', -0.40, 0.52, -0.18, 0.07, 0.20, 0.18, '#f2ece4');
        box('fabric', 0.40, 0.52, -0.18, 0.07, 0.20, 0.18, '#b86a3e');

      } else if (/^sofa3$|3.*seat.*sofa|track3|tuxedo3|camel3|midcen3|velvet3|boucle3|sleeper|reclinersofa|curvedsofa|chester3/i.test(t) || /3-seat|tuxedo|camelback|mid-century|velvet sofa|boucle sofa|sleeper|recliner sofa|curved sofa|chesterfield 3/i.test(def.name || '')) {
        // Modern Minimal 3-Seat Sofa (Grand 32px height, 6 architectural legs, deep plush cushions to 1.0, throw pillows)
        // 1. 6 Architectural tapered dark steel legs with brushed brass tips
        for (const [lx, lz] of [[-0.44, 0.14], [0, 0.14], [0.44, 0.14], [-0.44, -0.32], [0, -0.32], [0.44, -0.32]]) {
          cyl('dark', lx, 0.06, lz, 0.026, 0.12, 0.026, '#181a1d');
          cyl('metal', lx, 0.015, lz, 0.030, 0.03, 0.030, '#c9a44e');
        }
        // 2. Low-profile shadow reveal & upholstered chassis deck
        box('dark', 0, 0.12, -0.10, 0.92, 0.02, 0.58, '#181a1d');
        box('fabric', 0, 0.18, -0.10, 0.94, 0.12, 0.60, HP.shade(color, 0.90));

        // 3. 3 Generous plush seat cushions (comfort height reaches y=0.44 = 14.1px)
        for (const dx of [-0.29, 0, 0.29]) {
          box('fabric', dx, 0.32, -0.06, 0.28, 0.18, 0.50, HP.shade(color, 1.04));
          box('fabric', dx, 0.415, -0.06, 0.26, 0.03, 0.48, HP.shade(color, 1.08));
        }

        // 4. Architectural track arms with softened top caps (y reaches 0.67 = 21.4px)
        for (const x of [-0.45, 0.45]) {
          box('fabric', x, 0.38, -0.10, 0.07, 0.48, 0.60, color);
          box('fabric', x, 0.63, -0.10, 0.08, 0.04, 0.58, HP.shade(color, 1.05));
        }

        // 5. Substantial structural back frame
        box('fabric', 0, 0.56, -0.38, 0.94, 0.70, 0.12, color);
        box('fabric', 0, 0.915, -0.38, 0.95, 0.03, 0.13, HP.shade(color, 0.98));

        // 6. 3 Tall overstuffed back cushions (Reaching full 1.0 = 32px height!)
        for (const dx of [-0.29, 0, 0.29]) {
          box('fabric', dx, 0.68, -0.30, 0.28, 0.58, 0.12, HP.shade(color, 1.05));
          box('fabric', dx, 0.975, -0.30, 0.26, 0.05, 0.11, HP.shade(color, 1.10));
          box('fabric', dx, 0.62, -0.23, 0.25, 0.36, 0.05, HP.shade(color, 1.12));
        }

        // 7. Accent throw pillows in cream bouclé and warm terracotta
        box('fabric', -0.38, 0.52, -0.18, 0.08, 0.20, 0.18, '#f2ece4');
        box('fabric', 0.38, 0.52, -0.18, 0.08, 0.20, 0.18, '#b86a3e');

      } else if (/^sofa2$|2.*seat.*sofa|track2|chester2|loveseat|settee|futon|armless3/i.test(t) || /2-seat|track-arm 2|chesterfield 2|loveseat|settee|futon|armless/i.test(def.name || '')) {
        // Modern Minimal 2-Seat Track-Arm Sofa / Loveseat (Grand 32px height, 4 architectural legs, plush cushions to 1.0)
        // 1. 4 Architectural tapered dark steel legs with brass tips
        for (const [lx, lz] of [[-0.41, 0.14], [0.41, 0.14], [-0.41, -0.32], [0.41, -0.32]]) {
          cyl('dark', lx, 0.06, lz, 0.028, 0.12, 0.028, '#181a1d');
          cyl('metal', lx, 0.015, lz, 0.032, 0.03, 0.032, '#c9a44e');
        }
        // 2. Low-profile shadow reveal & upholstered chassis deck
        box('dark', 0, 0.12, -0.10, 0.86, 0.02, 0.58, '#181a1d');
        box('fabric', 0, 0.18, -0.10, 0.88, 0.12, 0.60, HP.shade(color, 0.90));

        // 3. 2 Generous plush seat cushions (comfort height reaches y=0.44 = 14.1px)
        for (const dx of [-0.21, 0.21]) {
          box('fabric', dx, 0.32, -0.06, 0.39, 0.18, 0.50, HP.shade(color, 1.04));
          box('fabric', dx, 0.415, -0.06, 0.37, 0.03, 0.48, HP.shade(color, 1.08));
        }

        // 4. Architectural track arms with softened top caps (y reaches 0.67 = 21.4px)
        for (const x of [-0.42, 0.42]) {
          box('fabric', x, 0.38, -0.10, 0.07, 0.48, 0.60, color);
          box('fabric', x, 0.63, -0.10, 0.08, 0.04, 0.58, HP.shade(color, 1.05));
        }

        // 5. Substantial structural back frame
        box('fabric', 0, 0.56, -0.38, 0.90, 0.70, 0.12, color);
        box('fabric', 0, 0.915, -0.38, 0.91, 0.03, 0.13, HP.shade(color, 0.98));

        // 6. 2 Tall overstuffed back cushions (Reaching full 1.0 = 32px height!)
        for (const dx of [-0.21, 0.21]) {
          box('fabric', dx, 0.68, -0.30, 0.38, 0.58, 0.12, HP.shade(color, 1.05));
          box('fabric', dx, 0.975, -0.30, 0.36, 0.05, 0.11, HP.shade(color, 1.10));
          box('fabric', dx, 0.62, -0.23, 0.35, 0.36, 0.05, HP.shade(color, 1.12));
        }

        // 7. Designer accent throw pillows
        box('fabric', -0.34, 0.52, -0.18, 0.09, 0.20, 0.18, '#f0eae1');
        box('fabric', 0.34, 0.52, -0.18, 0.09, 0.20, 0.18, '#b86a3e');

      } else if (/^chaise$|chaise.*lounge|recamier|daybed/i.test(t) || /chaise|recamier|daybed/i.test(def.name || '')) {
        // Modern Minimalist Chaise Lounge / Daybed (Tapered legs, contoured lounge cushion, raised ergonomic headrest, draped throw)
        for (const [lx, lz] of [[-0.38, 0.38], [0.38, 0.38], [-0.38, -0.38], [0.38, -0.38]]) {
          cyl('dark', lx, 0.08, lz, 0.035, 0.16, 0.035, '#181a1d');
          cyl('metal', lx, 0.02, lz, 0.040, 0.04, 0.040, '#c9a44e', true);
        }
        // Upholstered chassis deck
        box('fabric', 0, 0.20, 0, 0.88, 0.12, 0.88, HP.shade(color, 0.90));
        // Deep continuous lounge cushion (sitting height reaches y=0.36)
        box('fabric', 0, 0.32, 0.04, 0.84, 0.16, 0.76, color);
        box('fabric', 0, 0.41, 0.04, 0.80, 0.03, 0.72, HP.shade(color, 1.08));
        // Ergonomic raised angled headrest / back wedge at the head end
        box('fabric', 0, 0.54, -0.34, 0.84, 0.32, 0.20, color);
        box('fabric', 0, 0.68, -0.34, 0.80, 0.04, 0.18, HP.shade(color, 1.10));
        // Cylindrical luxury bolster pillow
        cyl('fabric', 0, 0.58, -0.26, 0.72, 0.12, 0.14, '#ede6dd');
        // Draped folded throw blanket across foot of chaise
        box('fabric', 0, 0.36, 0.32, 0.86, 0.025, 0.20, '#c47d52');

      } else if (/^mod(seat|arml|armr|corner|chaise|table)/i.test(t)) {
        // Modular Sectional System: Snappable components that join seamlessly side-by-side
        // Base feet
        for (const [lx, lz] of [[-0.36, 0.36], [0.36, 0.36], [-0.36, -0.36], [0.36, -0.36]]) {
          cyl('dark', lx, 0.06, lz, 0.03, 0.12, 0.03, '#181a1d');
        }
        if (/modtable/i.test(t)) {
          // Low modular table connector module
          box('dark', 0, 0.08, 0, 0.88, 0.04, 0.88, '#15171a');
          box('wood', 0, 0.28, 0, 0.92, 0.36, 0.92, color);
        } else {
          // Modular seating unit chassis & plush cushion
          box('fabric', 0, 0.18, 0, 0.94, 0.12, 0.94, HP.shade(color, 0.90));
          box('fabric', 0, 0.32, 0.04, 0.90, 0.18, 0.82, color);
          box('fabric', 0, 0.415, 0.04, 0.86, 0.03, 0.78, HP.shade(color, 1.08));

          // Backrest (all seating modules have rear backrest)
          box('fabric', 0, 0.56, -0.38, 0.94, 0.70, 0.14, color);
          box('fabric', 0, 0.68, -0.28, 0.88, 0.58, 0.12, HP.shade(color, 1.05));
          box('fabric', 0, 0.975, -0.28, 0.84, 0.05, 0.11, HP.shade(color, 1.10));

          // Left arm on modarmL or modcorner
          if (/modarml|modcorner/i.test(t)) {
            box('fabric', -0.44, 0.38, 0, 0.10, 0.48, 0.94, color);
            box('fabric', -0.44, 0.63, 0, 0.11, 0.04, 0.92, HP.shade(color, 1.05));
          }
          // Right arm on modarmR
          if (/modarmr/i.test(t)) {
            box('fabric', 0.44, 0.38, 0, 0.10, 0.48, 0.94, color);
            box('fabric', 0.44, 0.63, 0, 0.11, 0.04, 0.92, HP.shade(color, 1.05));
          }
        }

      } else if (/outsofa|outdoor.*sofa/i.test(t) || /outdoor.*sofa/i.test(def.name || '')) {
        // Natural Slatted Teak Outdoor Sofa (Weather-resistant Sunbrella cushions, slatted arms & back)
        for (const [lx, lz] of [[-0.42, 0.34], [0.42, 0.34], [-0.42, -0.34], [0.42, -0.34]]) {
          box('wood', lx, 0.14, lz, 0.05, 0.28, 0.05, '#8a6542');
        }
        // Slatted teak chassis
        box('wood', 0, 0.26, 0, 0.92, 0.05, 0.76, '#8a6542');
        // Weatherproof deep seat cushions
        for (const dx of [-0.28, 0, 0.28]) {
          box('fabric', dx, 0.36, -0.02, 0.27, 0.16, 0.68, color);
          box('fabric', dx, 0.45, -0.02, 0.25, 0.03, 0.64, HP.shade(color, 1.06));
        }
        // Slatted teak arms
        for (const x of [-0.44, 0.44]) {
          box('wood', x, 0.42, 0, 0.04, 0.32, 0.76, '#8a6542');
          box('wood', x, 0.58, 0, 0.06, 0.03, 0.80, HP.shade('#8a6542', 1.10));
        }
        // Slatted teak back frame and plush back cushions
        box('wood', 0, 0.54, -0.36, 0.92, 0.52, 0.04, '#8a6542');
        for (const dx of [-0.28, 0, 0.28]) {
          box('fabric', dx, 0.64, -0.28, 0.27, 0.46, 0.12, HP.shade(color, 1.04));
        }

      } else if (/^armchair$|lounge.*chair/i.test(t) || /armchair|lounge.*chair/i.test(def.name || '')) {
        // Modern Accent Lounge Armchair (Tall 30px height, enveloping barrel backrest, floating plush cushion, sculptural walnut legs)
        for (const [lx, lz] of [[-0.24, 0.22], [0.24, 0.22], [-0.22, -0.22], [0.22, -0.22]]) {
          cyl('wood', lx, 0.10, lz, 0.04, 0.20, 0.04, '#241d18');
          cyl('metal', lx, 0.015, lz, 0.045, 0.03, 0.045, '#c9a44e', true);
        }
        // Sculpted rounded seat deck & floating comfort cushion (cleanly inset inside arms & backrest)
        box('fabric', 0, 0.22, -0.01, 0.50, 0.10, 0.56, HP.shade(color, 0.92));
        box('fabric', 0, 0.32, 0.055, 0.49, 0.16, 0.45, HP.shade(color, 1.04));
        box('fabric', 0, 0.415, 0.055, 0.47, 0.03, 0.42, HP.shade(color, 1.08));

        // Enveloping curved barrel backrest & sloping arms (inner arms ±0.25, backrest front -0.18)
        box('fabric', 0, 0.58, -0.24, 0.68, 0.66, 0.12, color);
        box('fabric', -0.30, 0.52, 0.02, 0.10, 0.52, 0.58, color);
        box('fabric', 0.30, 0.52, 0.02, 0.10, 0.52, 0.58, color);
        box('fabric', -0.30, 0.79, 0.02, 0.11, 0.03, 0.56, HP.shade(color, 1.04));
        box('fabric', 0.30, 0.79, 0.02, 0.11, 0.03, 0.56, HP.shade(color, 1.04));

        // Tall cradled back cushion seated cleanly against backrest without piercing arms
        box('fabric', 0, 0.70, -0.135, 0.48, 0.54, 0.085, HP.shade(color, 1.06));
        box('fabric', 0, 0.98, -0.135, 0.46, 0.04, 0.075, HP.shade(color, 1.10));
        box('fabric', 0, 0.72, -0.090, 0.44, 0.035, 0.025, HP.shade(color, 0.88));
        box('fabric', 0, 0.58, -0.090, 0.44, 0.035, 0.025, HP.shade(color, 0.88));

        // Soft ergonomic lumbar cushion clear in front of channel seam
        box('fabric', 0, 0.48, -0.045, 0.42, 0.18, 0.065, HP.shade(color, 1.12));

      } else if (/sofa|couch|boucle|daybed/i.test(t) || /sofa|couch/i.test(def.name || '')) {
        // Universal Modern Minimalist Sofa Fallback (Ensures NO sofa ever renders as a wooden cabinet or monolith block!)
        legs(0.12);
        box('fabric', 0, 0.18, -0.05, 0.88, 0.12, 0.70, HP.shade(color, 0.90));
        box('fabric', 0, 0.56, -0.34, 0.88, 0.64, 0.09, color);
        for (const x of [-0.44, 0.44]) box('fabric', x, 0.38, -0.05, 0.06, 0.44, 0.70, color);
        for (const x of [-0.26, 0, 0.26]) {
          box('fabric', x, 0.32, -0.02, 0.25, 0.16, 0.56, HP.shade(color, 1.04));
          box('fabric', x, 0.64, -0.26, 0.25, 0.50, 0.08, HP.shade(color, 1.06));
        }
      } else if (/^chair$/i.test(t) || /^dining.*chair/i.test(t)) {
        // Modern Scandinavian Designer Dining Chair (30px height, solid walnut/oak tapered splayed legs, curved ergonomic backrest)
        // 1. 4 Splayed architectural tapered hardwood legs with brass floor ferrules
        for (const [lx, lz] of [[-0.22, 0.22], [0.22, 0.22], [-0.20, -0.22], [0.20, -0.22]]) {
          cyl('wood', lx, 0.22, lz, 0.032, 0.44, 0.032, '#382516');
          cyl('metal', lx, 0.02, lz, 0.036, 0.04, 0.036, '#c9a44e', true);
        }
        // Under-seat hardwood support apron frame
        box('wood', 0, 0.42, 0, 0.44, 0.04, 0.44, '#2e1d12');

        // 2. Sculpted ergonomic upholstered seat pan with waterfall front edge (comfort height y=0.48 = 14.4px)
        box('fabric', 0, 0.46, 0.02, 0.48, 0.04, 0.46, HP.shade(color, 0.90));
        cyl('fabric', 0, 0.46, 0.23, 0.46, 0.04, 0.06, HP.shade(color, 0.90)); // front waterfall roll
        box('fabric', 0, 0.49, 0.02, 0.44, 0.03, 0.42, color);
        box('fabric', 0, 0.51, 0.02, 0.40, 0.015, 0.38, HP.shade(color, 1.08)); // crowned cushion top

        // 3. Tall Supportive Curved Backrest (Rises from seat deck y=0.46 to y=0.98 = 16.6px tall back support!)
        // Dual rear structural stile uprights rooted to rear legs
        box('wood', -0.18, 0.72, -0.20, 0.030, 0.52, 0.030, '#382516');
        box('wood', 0.18, 0.72, -0.20, 0.030, 0.52, 0.030, '#382516');
        // Main ergonomic contoured backrest cushion (continuous full back support)
        box('fabric', 0, 0.74, -0.18, 0.42, 0.48, 0.05, color);
        // Vertical channeled flutes for lumbar & thoracic comfort
        box('fabric', -0.12, 0.74, -0.17, 0.11, 0.44, 0.04, HP.shade(color, 1.05));
        box('fabric', 0, 0.74, -0.17, 0.11, 0.44, 0.04, HP.shade(color, 1.09));
        box('fabric', 0.12, 0.74, -0.17, 0.11, 0.44, 0.04, HP.shade(color, 1.05));
        // Sculpted top crest rail roll (reaches full y=0.99 = 30px)
        box('fabric', 0, 0.98, -0.18, 0.42, 0.03, 0.05, HP.shade(color, 1.12));
        // Gentle side bolster wings
        box('fabric', -0.20, 0.74, -0.14, 0.035, 0.44, 0.08, color);
        box('fabric', 0.20, 0.74, -0.14, 0.035, 0.44, 0.08, color);

      } else if (/^ottoman$/i.test(t)) {
        // Luxury Tufted Living Ottoman (2x1 footprint, 16px height, architectural recessed plinth, deep diamond-tufted cushion)
        box('dark', 0, 0.06, 0, 0.92, 0.12, 0.92, '#15171a'); // shadow reveal plinth
        box('fabric', 0, 0.26, 0, 0.96, 0.28, 0.96, HP.shade(color, 0.90)); // upholstered body
        // Deep plush tufted top cushion
        box('fabric', 0, 0.44, 0, 0.98, 0.12, 0.98, color);
        box('fabric', 0, 0.52, 0, 0.94, 0.04, 0.94, HP.shade(color, 1.08)); // crowned top
        // Piped perimeter welt
        box('fabric', 0, 0.48, 0, 0.99, 0.02, 0.99, HP.shade(color, 1.15));
        // Tufting button depressions
        for (const tx of [-0.26, 0, 0.26]) for (const tz of [-0.26, 0, 0.26]) {
          box('dark', tx, 0.53, tz, 0.025, 0.015, 0.025, '#15171a');
        }

      } else if (/^english3$/i.test(t) || /english.*roll/i.test(def.name || '')) {
        // Classic Heritage English Roll-Arm 3-Seater Sofa (Grand 32px height, turned front spindle legs with brass casters, swept rear legs, low pleated roll arms)
        // 1. Turned front legs with brass caster wheels & swept back legs
        for (const [lx, lz] of [[-0.44, 0.32], [0.44, 0.32]]) {
          cyl('wood', lx, 0.08, lz, 0.04, 0.14, 0.04, '#2e1c10');
          cyl('metal', lx, 0.02, lz, 0.03, 0.04, 0.03, '#c9a44e', true); // brass caster wheel
        }
        for (const [lx, lz] of [[-0.44, -0.32], [0.44, -0.32]]) {
          box('wood', lx, 0.07, lz, 0.04, 0.14, 0.04, '#2e1c10');
        }
        // Low upholstered base chassis
        box('fabric', 0, 0.18, 0, 0.94, 0.12, 0.76, HP.shade(color, 0.88));
        // 3 Deep plush crowned seat cushions
        for (const cx of [-0.28, 0, 0.28]) {
          box('fabric', cx, 0.30, 0.04, 0.27, 0.16, 0.58, color);
          box('fabric', cx, 0.39, 0.04, 0.25, 0.03, 0.56, HP.shade(color, 1.08));
        }
        // Signature low pleated English roll arms
        for (const x of [-0.45, 0.45]) {
          box('fabric', x, 0.34, 0.02, 0.08, 0.38, 0.72, HP.shade(color, 0.95));
          cyl('fabric', x, 0.51, 0.02, 0.09, 0.06, 0.70, HP.shade(color, 1.04)); // rolled arm top
          round('fabric', x, 0.51, 0.37, 0.09, 0.09, 0.09, HP.shade(color, 1.08)); // front roll scroll
        }
        // High curved tight backrest (reaches y=0.96)
        box('fabric', 0, 0.58, -0.32, 0.92, 0.64, 0.14, color);
        box('fabric', 0, 0.88, -0.32, 0.90, 0.06, 0.13, HP.shade(color, 1.10));
        // Pair of contrast bouclé throw pillows
        box('fabric', -0.36, 0.44, -0.18, 0.07, 0.18, 0.16, '#f4ece1');
        box('fabric', 0.36, 0.44, -0.18, 0.07, 0.18, 0.16, '#b86a3e');

      } else if (/^wingback$/i.test(t) || /wingback/i.test(def.name || '')) {
        // Heritage Wingback Lounge Armchair (34px tall, cabriole front legs, flared protective side wings, high channeled backrest)
        for (const [lx, lz] of [[-0.34, 0.32], [0.34, 0.32]]) {
          cyl('wood', lx, 0.08, lz, 0.04, 0.16, 0.04, '#2e1c10');
          cyl('metal', lx, 0.02, lz, 0.035, 0.04, 0.035, '#c9a44e', true);
        }
        for (const [lx, lz] of [[-0.32, -0.32], [0.32, -0.32]]) {
          box('wood', lx, 0.08, lz, 0.038, 0.16, 0.038, '#2e1c10');
        }
        // Deep sprung seat base & reversible plush cushion
        box('fabric', 0, 0.20, 0, 0.78, 0.14, 0.74, HP.shade(color, 0.88));
        box('fabric', 0, 0.32, 0.04, 0.70, 0.14, 0.62, color);
        box('fabric', 0, 0.40, 0.04, 0.66, 0.03, 0.58, HP.shade(color, 1.08));
        // Rolled armrests with brass nailhead trim
        for (const x of [-0.38, 0.38]) {
          box('fabric', x, 0.38, 0.04, 0.08, 0.36, 0.64, HP.shade(color, 0.94));
          cyl('fabric', x, 0.54, 0.04, 0.09, 0.06, 0.62, HP.shade(color, 1.05));
          round('fabric', x, 0.54, 0.35, 0.09, 0.09, 0.09, HP.shade(color, 1.10));
        }
        // Tall dramatic winged backrest (y reaches 1.0)
        box('fabric', 0, 0.62, -0.30, 0.68, 0.72, 0.12, color);
        box('fabric', 0, 0.96, -0.30, 0.66, 0.06, 0.11, HP.shade(color, 1.12));
        // Signature forward-flaring side wings
        for (const x of [-0.34, 0.34]) {
          box('fabric', x, 0.72, -0.16, 0.06, 0.50, 0.24, HP.shade(color, 0.96));
          round('fabric', x, 0.94, -0.06, 0.06, 0.08, 0.08, HP.shade(color, 1.08));
        }
        // Padded lumbar pillow
        box('fabric', 0, 0.46, -0.18, 0.48, 0.14, 0.10, '#ede5d8');

      } else if (/^recliner$/i.test(t) || /recliner/i.test(def.name || '')) {
        // Luxury Ergonomic Home Theater Recliner (Deep channeled pillow-top cushioning, padded armrests, integrated footrest apron)
        // Black steel circular swivel ring base
        cyl('dark', 0, 0.03, 0, 0.72, 0.06, 0.72, '#181a1d');
        cyl('metal', 0, 0.07, 0, 0.18, 0.06, 0.18, '#4a5058'); // center swivel cylinder
        // Heavy upholstered chassis
        box('fabric', 0, 0.18, 0, 0.82, 0.16, 0.80, HP.shade(color, 0.88));
        // Contoured waterfall seat & integrated folded footrest
        box('fabric', 0, 0.30, 0.02, 0.74, 0.16, 0.68, color);
        box('fabric', 0, 0.39, 0.02, 0.70, 0.03, 0.64, HP.shade(color, 1.08));
        box('fabric', 0, 0.22, 0.42, 0.72, 0.22, 0.05, HP.shade(color, 0.92)); // front footrest panel
        // Pillow-top padded wide armrests
        for (const x of [-0.41, 0.41]) {
          box('fabric', x, 0.36, 0.02, 0.10, 0.34, 0.74, color);
          box('fabric', x, 0.54, 0.02, 0.12, 0.08, 0.72, HP.shade(color, 1.06)); // pillow top arm cushion
        }
        // Segmented ergonomic high backrest with headrest pillow
        box('fabric', 0, 0.62, -0.30, 0.72, 0.70, 0.14, color);
        box('fabric', 0, 0.52, -0.22, 0.64, 0.22, 0.08, HP.shade(color, 1.06)); // lumbar tier
        box('fabric', 0, 0.74, -0.22, 0.62, 0.20, 0.08, HP.shade(color, 1.08)); // thoracic tier
        cyl('fabric', 0, 0.94, -0.24, 0.58, 0.10, 0.12, HP.shade(color, 1.12)); // plush headrest roll

      } else if (/^papasan$/i.test(t) || /papasan/i.test(def.name || '')) {
        // Bohemian Rattan Bowl Papasan Lounge Chair (Natural honey wicker bowl frame on flared base, ultra-plush button-tufted circular dish cushion)
        // 1. Flared woven rattan base pedestal
        cyl('wood', 0, 0.10, 0, 0.56, 0.20, 0.56, '#b47b48');
        cyl('wood', 0, 0.21, 0, 0.64, 0.04, 0.64, '#8f5c32'); // bowl cradle ring
        // 2. Large tilted rattan bowl shell
        for (let a = 0; a < 8; a++) {
          const ang = (a * Math.PI) / 4;
          box('wood', Math.cos(ang) * 0.34, 0.36, Math.sin(ang) * 0.34, 0.03, 0.28, 0.03, '#b47b48');
        }
        cyl('wood', 0, 0.48, 0, 0.88, 0.03, 0.88, '#8f5c32'); // top perimeter rim
        // 3. Ultra-plush circular tufted saucer cushion (sunken center, crowned perimeter)
        cyl('fabric', 0, 0.34, 0, 0.74, 0.16, 0.74, HP.shade(color, 0.92));
        cyl('fabric', 0, 0.42, 0, 0.84, 0.12, 0.84, color);
        round('fabric', 0, 0.48, 0, 0.78, 0.10, 0.78, HP.shade(color, 1.10));
        // Center button tuft depression
        cyl('dark', 0, 0.48, 0, 0.04, 0.02, 0.04, '#15171a');

      } else if (/^clubchair$/i.test(t) || /club.*chair/i.test(def.name || '')) {
        // Classic Cigar Lounge Leather Club Armchair (Espresso bun feet, deep box seat, wide rolled arms, saddle-stitched back)
        for (const [lx, lz] of [[-0.36, 0.34], [0.36, 0.34], [-0.36, -0.34], [0.36, -0.34]]) {
          cyl('wood', lx, 0.04, lz, 0.06, 0.08, 0.06, '#1f130b');
        }
        // Heavy low chassis deck
        box('fabric', 0, 0.14, 0, 0.84, 0.14, 0.82, HP.shade(color, 0.86));
        // Deep overstuffed seat cushion
        box('fabric', 0, 0.28, 0.02, 0.66, 0.18, 0.68, color);
        box('fabric', 0, 0.38, 0.02, 0.62, 0.03, 0.64, HP.shade(color, 1.08));
        // Wide rolled leather club arms
        for (const x of [-0.40, 0.40]) {
          box('fabric', x, 0.34, 0.02, 0.12, 0.40, 0.80, color);
          cyl('fabric', x, 0.54, 0.02, 0.13, 0.06, 0.78, HP.shade(color, 1.05));
          round('fabric', x, 0.54, 0.41, 0.13, 0.13, 0.13, HP.shade(color, 1.08));
        }
        // Deep barrel club backrest
        box('fabric', 0, 0.56, -0.32, 0.78, 0.64, 0.16, color);
        box('fabric', 0, 0.86, -0.32, 0.76, 0.06, 0.15, HP.shade(color, 1.10));

      } else if (/^slipper$/i.test(t) || /slipper.*chair/i.test(def.name || '')) {
        // Modern Armless Bouclé Slipper Accent Chair (Sleek angled black steel legs, wide low-slung comfort cushion, clean armless profile)
        for (const [lx, lz] of [[-0.28, 0.28], [0.28, 0.28], [-0.26, -0.28], [0.26, -0.28]]) {
          cyl('dark', lx, 0.10, lz, 0.024, 0.20, 0.024, '#181a1d');
          cyl('metal', lx, 0.015, lz, 0.028, 0.03, 0.028, '#c9a44e', true);
        }
        // Minimal steel under-seat frame
        box('dark', 0, 0.19, 0, 0.64, 0.025, 0.64, '#181a1d');
        // Extra-deep wide cushioned seat pan (armless luxury)
        box('fabric', 0, 0.28, 0.04, 0.74, 0.16, 0.68, HP.shade(color, 0.90));
        box('fabric', 0, 0.38, 0.04, 0.72, 0.06, 0.66, color);
        box('fabric', 0, 0.43, 0.04, 0.68, 0.02, 0.62, HP.shade(color, 1.10));
        // Angled ergonomic tailored backrest
        box('fabric', 0, 0.64, -0.26, 0.72, 0.58, 0.14, color);
        box('fabric', 0, 0.92, -0.26, 0.70, 0.05, 0.13, HP.shade(color, 1.12));
        box('fabric', 0, 0.54, -0.19, 0.64, 0.24, 0.06, HP.shade(color, 1.06)); // lumbar contour

      } else if (/^tubchair$/i.test(t)) {
        // Luxury Upholstered Barrel Tub Armchair (2x2 footprint, curved horseshoe backrest, deep tailored velvet cushion, splayed tapered legs with brass ferrules)
        // 1. Splayed Mid-Century Tapered Hardwood Legs with Polished Brass Ferrules
        const legPositions = [
          [-0.30, -0.28], // rear-left
          [ 0.30, -0.28], // rear-right
          [-0.32,  0.26], // front-left
          [ 0.32,  0.26], // front-right
        ];
        for (const [lx, lz] of legPositions) {
          box('wood', lx, 0.10, lz, 0.055, 0.20, 0.055, '#3e2723');
          box('metal', lx, 0.02, lz, 0.058, 0.04, 0.058, '#eab308', true); // brass ferrule
        }
        // Under-seat hardwood apron chassis frame
        box('wood', 0, 0.20, 0, 0.68, 0.04, 0.68, '#271711');

        // 2. Sculpted Lower Tub Base Shell (Upholstered velvet basin, y=0.22 to 0.42)
        cyl('fabric', 0, 0.32, 0.02, 0.82, 0.20, 0.78, HP.shade(color, 0.88));

        // 3. Thick Deep-Well Velvet Seat Cushion (y=0.40 to 0.54)
        cyl('fabric', 0, 0.47, 0.04, 0.72, 0.14, 0.68, color);
        // Top piping welt rim around the circular cushion perimeter
        cyl('fabric', 0, 0.53, 0.04, 0.73, 0.025, 0.69, HP.shade(color, 1.15), true);

        // 4. Sweeping Continuous Horseshoe Barrel Backrest & Wrap-Around Curved Arms (y=0.42 to 0.86)
        const armColor = color;
        const shadeInner = HP.shade(color, 0.94);
        const steps = 11;
        for (let i = 0; i <= steps; i++) {
          const frac = i / steps; // 0 to 1
          const angle = Math.PI * (0.08 + frac * 0.84);
          const radX = 0.38, radZ = 0.36;
          const px = Math.cos(angle) * radX;
          const pz = -Math.sin(angle) * radZ + 0.04;
          const hFrac = Math.sin(frac * Math.PI);
          const backH = 0.26 + hFrac * 0.18;
          const centerY = 0.42 + backH / 2;
          boxRot('fabric', px, centerY, pz, 0.12, backH, 0.12, -angle, armColor);
          const inRadX = radX - 0.035, inRadZ = radZ - 0.035;
          boxRot('fabric', Math.cos(angle) * inRadX, centerY, -Math.sin(angle) * inRadZ + 0.04, 0.10, backH - 0.02, 0.10, -angle, shadeInner);
        }

        // 5. Rounded Padded Rolled Arm Caps (Front armrest terminations)
        for (const sx of [-1, 1]) {
          const armEndAngle = Math.PI * (sx < 0 ? 0.08 : 0.92);
          const ax = Math.cos(armEndAngle) * 0.38;
          const az = -Math.sin(armEndAngle) * 0.36 + 0.04;
          round('fabric', ax, 0.68, az, 0.13, 0.10, 0.13, HP.shade(color, 1.10));
        }

        // 6. Plush Tilted Velvet Lumbar Accent Bolster Cushion (Nestled in back corner)
        boxRot('fabric', 0, 0.58, -0.16, 0.42, 0.20, 0.10, 0, HP.shade(color, 1.20));
        round('fabric', 0, 0.58, -0.10, 0.04, 0.04, 0.03, '#1f2937'); // tufted button

      } else if (/^accentchair$/i.test(t) || /accent.*chair/i.test(def.name || '')) {
        // Mid-Century Modern Sculptural Accent Armchair (Exposed solid walnut timber frame, floating upholstered seat pan & floating angled back cushion)
        // 1. Solid walnut sculptural frame runners & armrests
        for (const x of [-0.34, 0.34]) {
          box('wood', x, 0.22, 0.26, 0.035, 0.44, 0.035, '#382214'); // front leg
          box('wood', x, 0.18, -0.26, 0.035, 0.36, 0.035, '#382214'); // rear angled leg
          box('wood', x, 0.44, 0, 0.038, 0.03, 0.60, '#382214');      // sculpted wood arm paddle
          box('metal', x, 0.44, 0.26, 0.042, 0.032, 0.042, '#c9a44e', true); // brass front knuckle
        }
        // Transverse cross stretchers
        box('wood', 0, 0.22, 0.24, 0.66, 0.03, 0.03, '#382214');
        box('wood', 0, 0.16, -0.24, 0.66, 0.03, 0.03, '#382214');
        // 2. Suspended floating seat cushion
        box('fabric', 0, 0.28, 0.02, 0.60, 0.14, 0.54, color);
        box('fabric', 0, 0.36, 0.02, 0.58, 0.03, 0.52, HP.shade(color, 1.08));
        // 3. Floating angled backrest pad
        box('fabric', 0, 0.62, -0.20, 0.58, 0.52, 0.08, color);
        box('fabric', 0, 0.87, -0.20, 0.56, 0.04, 0.07, HP.shade(color, 1.12));

      } else if (/^swivelchair$/i.test(t) || /swivel.*chair/i.test(def.name || '')) {
        // Modern 360-Degree Swivel Pedestal Barrel Chair (Heavy brushed metal disc base, enveloping circular tub shell, plush accent cushion)
        cyl('metal', 0, 0.03, 0, 0.68, 0.05, 0.68, '#4b5563', true); // brushed steel base plate
        cyl('metal', 0, 0.08, 0, 0.14, 0.08, 0.14, '#1f2937', true); // heavy swivel column
        // Sculpted circular tub shell (y=0.12 to 0.78)
        cyl('fabric', 0, 0.24, 0, 0.82, 0.26, 0.82, HP.shade(color, 0.90));
        // Enveloping barrel back & curved wrap-around armrests
        for (let a = 1; a < 7; a++) {
          const ang = (a * Math.PI) / 8 + Math.PI / 4;
          box('fabric', Math.cos(ang) * 0.36, 0.54, Math.sin(ang) * 0.36, 0.06, 0.46, 0.12, color);
        }
        // Deep circular plush seating cushion
        cyl('fabric', 0, 0.32, 0.04, 0.68, 0.14, 0.68, color);
        cyl('fabric', 0, 0.40, 0.04, 0.64, 0.03, 0.64, HP.shade(color, 1.08));
        // Lumbar bolster crescent roll
        cyl('fabric', 0, 0.48, -0.16, 0.44, 0.12, 0.14, '#ede5d8');

      } else if (/^rocker$/i.test(t) || /rocking.*chair/i.test(def.name || '')) {
        // Scandinavian Steam-Bent Ash Rocking Chair (Curved floor rocking runners, splayed spindles, slatted seat & high backrest)
        // Dual curved floor runners
        for (const x of [-0.28, 0.28]) {
          box('wood', x, 0.04, 0, 0.035, 0.03, 0.84, '#9c6c44');       // runner
          box('wood', x, 0.08, 0.41, 0.035, 0.06, 0.04, '#784e2a');     // front upward curve
          box('wood', x, 0.08, -0.41, 0.035, 0.06, 0.04, '#784e2a');    // rear upward curve
          // 4 Spindle legs into runner
          cyl('wood', x, 0.18, 0.22, 0.024, 0.26, 0.024, '#9c6c44');
          cyl('wood', x, 0.18, -0.22, 0.024, 0.26, 0.024, '#9c6c44');
          // Contoured armrest paddle
          box('wood', x, 0.46, 0, 0.045, 0.025, 0.56, '#9c6c44');
        }
        // Slatted steam-bent seat
        box('wood', 0, 0.32, 0.02, 0.56, 0.03, 0.52, '#9c6c44');
        box('fabric', 0, 0.35, 0.02, 0.50, 0.04, 0.46, color); // padded seat tie cushion
        // Tall spindle backrest (reaches y=0.98)
        for (let s = -0.18; s <= 0.18; s += 0.09) {
          cyl('wood', s, 0.64, -0.24, 0.020, 0.62, 0.020, '#9c6c44');
        }
        // Top steam-bent crest rail
        box('wood', 0, 0.96, -0.24, 0.56, 0.04, 0.04, '#784e2a');

      } else if (/^barstool$|counter.*stool/.test(t)) {
        // Luxury High-Back Designer Bar Stool (Grand 32px height, 18px seat, seamless supportive backrest from seat to crown)
        // 1. 4 Splayed architectural matte black legs with brushed brass floor glides
        for (const [lx, lz] of [[-0.24, 0.24], [0.24, 0.24], [-0.24, -0.24], [0.24, -0.24]]) {
          cyl('dark', lx, 0.25, lz, 0.034, 0.50, 0.034, '#181b1f');
          cyl('metal', lx, 0.02, lz, 0.040, 0.04, 0.040, '#c9a44e', true); // brass floor glide
        }

        // 2. Continuous perimeter footrest rung at ergonomic resting height (y=0.20 = 6.4px)
        box('dark', 0, 0.20, 0.22, 0.46, 0.026, 0.026, '#181b1f');
        box('dark', 0, 0.20, -0.22, 0.46, 0.026, 0.026, '#181b1f');
        box('dark', -0.22, 0.20, 0, 0.026, 0.026, 0.46, '#181b1f');
        box('dark', 0.22, 0.20, 0, 0.026, 0.026, 0.46, '#181b1f');
        box('metal', 0, 0.208, 0.22, 0.28, 0.012, 0.030, '#c9a44e', true); // brushed brass front foot protector

        // 3. Concealed under-seat mounting chassis plate (legs attach here cleanly, never poke above)
        box('dark', 0, 0.50, 0, 0.42, 0.025, 0.42, '#181b1f');

        // 4. Ergonomic curved seat pan & plush comfort cushion (sitting height reaches y=0.56 = 17.9px)
        box('fabric', 0, 0.525, 0.01, 0.50, 0.03, 0.48, HP.shade(color, 0.88));
        cyl('fabric', 0, 0.525, 0.23, 0.48, 0.03, 0.06, HP.shade(color, 0.88));  // soft front waterfall edge
        box('fabric', 0, 0.555, 0.01, 0.46, 0.05, 0.44, color);
        box('fabric', 0, 0.585, 0.01, 0.43, 0.02, 0.41, HP.shade(color, 1.08)); // crowned cushion top

        // 5. TALL SUPPORTIVE HIGH-BACK BACKREST (Seamless continuous backrest from seat deck y=0.52 to y=1.02 = 16px tall back support!)
        // Dual structural spine uprights in dark steel anchored under the seat chassis extending all the way up
        box('dark', -0.16, 0.76, -0.20, 0.028, 0.52, 0.028, '#181b1f');
        box('dark', 0.16, 0.76, -0.20, 0.028, 0.52, 0.028, '#181b1f');

        // Main high backrest shell (spans y=0.52 to y=1.02, height=0.50 - zero gap above seat!)
        box('fabric', 0, 0.77, -0.19, 0.46, 0.50, 0.06, color);

        // 3 Vertical luxury channel-tufted padded flutes (ergonomic full-back comfort from lumbar to headrest)
        box('fabric', -0.14, 0.77, -0.18, 0.12, 0.48, 0.05, HP.shade(color, 1.05));
        box('fabric', 0, 0.77, -0.18, 0.12, 0.48, 0.05, HP.shade(color, 1.09));
        box('fabric', 0.14, 0.77, -0.18, 0.12, 0.48, 0.05, HP.shade(color, 1.05));

        // Soft curved ergonomic lateral wings (gently hugging the sides of the back)
        box('fabric', -0.22, 0.77, -0.14, 0.045, 0.46, 0.10, color);
        box('fabric', 0.22, 0.77, -0.14, 0.045, 0.46, 0.10, color);

        // Rounded top headrest crown roll (reaches full y=1.02 = 33px!)
        box('fabric', 0, 1.02, -0.19, 0.46, 0.035, 0.055, HP.shade(color, 1.12));

        // Lower ergonomic lumbar contour
        box('fabric', 0, 0.66, -0.16, 0.42, 0.18, 0.04, HP.shade(color, 1.04));

      } else if (/^ghbench$/i.test(t)) {
        // Victorian Cedar & Cast-Iron Two-Tier Greenhouse Staging Bench (2x1 footprint)
        // Sturdy corner posts, lower potting shelf, slatted cedar staging top with drainage gaps & rear upstand
        const woodCol = color || '#c28b58';
        const frameCol = HP.shade(woodCol, 0.72);
        // 1. Four heavy corner legs with levelling foot collars
        for (const lx of [-0.44, 0.44]) {
          for (const lz of [-0.38, 0.38]) {
            box('wood', lx, 0.44, lz, 0.06, 0.88, 0.06, frameCol);
            box('metal', lx, 0.03, lz, 0.07, 0.06, 0.07, '#334155', true); // levelling shoe
          }
          // End cross-stretchers
          box('wood', lx, 0.28, 0, 0.05, 0.04, 0.72, frameCol);
          box('wood', lx, 0.84, 0, 0.05, 0.05, 0.72, frameCol);
        }
        // Front & rear longitudinal apron rails
        box('wood', 0, 0.84, -0.38, 0.88, 0.05, 0.05, frameCol);
        box('wood', 0, 0.84,  0.38, 0.88, 0.05, 0.05, frameCol);
        box('wood', 0, 0.28, -0.38, 0.88, 0.04, 0.04, frameCol);
        box('wood', 0, 0.28,  0.38, 0.88, 0.04, 0.04, frameCol);

        // 2. Lower slatted pot storage shelf (y = 0.30)
        for (let s = -0.32; s <= 0.32; s += 0.12) {
          box('wood', 0, 0.31, s, 0.84, 0.02, 0.08, frameCol);
        }
        // Nested terracotta nursery pots on lower shelf
        cyl('ceramic', -0.28, 0.36, 0, 0.16, 0.07, 0.16, '#c26d38');
        cyl('ceramic', -0.28, 0.43, 0, 0.13, 0.07, 0.13, '#c26d38');
        cyl('ceramic', -0.28, 0.50, 0, 0.10, 0.06, 0.10, '#c26d38');
        // Jute potting soil sack
        box('fabric', 0.24, 0.36, 0, 0.22, 0.08, 0.26, '#d4b483');
        box('soil', 0.24, 0.395, 0, 0.18, 0.02, 0.20, '#3e2723');

        // 3. Upper Slatted Cedar Staging Surface (individual cedar slats with drainage gaps)
        for (let s = -0.36; s <= 0.36; s += 0.10) {
          box('wood', 0, 0.90, s, 0.94, 0.025, 0.075, woodCol);
        }
        // Perimeter staging frame rim & rear pot curb
        box('wood', 0, 0.94, -0.40, 0.96, 0.06, 0.03, frameCol); // rear backstop curb
        box('wood', -0.46, 0.92, 0, 0.03, 0.03, 0.82, frameCol); // left edge curb
        box('wood',  0.46, 0.92, 0, 0.03, 0.03, 0.82, frameCol); // right edge curb

      } else if (!/^potting$/i.test(t) && (/^bench$|entry.*bench|bedbench/i.test(t) || /bench/i.test(def.name || ''))) {
        // Modern Minimalist Upholstered Bench (Splayed matte black steel sled frame, extra-thick channeled cushion, slatted oak shoe shelf)
        // 1. Dual architectural matte black steel sled frames at both ends
        for (const bx of [-0.36, 0.36]) {
          box('dark', bx, 0.03, 0, 0.03, 0.06, 0.76, '#181b1f');                 // floor runner
          box('dark', bx, 0.28, 0.34, 0.03, 0.46, 0.035, '#181b1f');             // front vertical leg
          box('dark', bx, 0.28, -0.34, 0.03, 0.46, 0.035, '#181b1f');            // rear vertical leg
          box('dark', bx, 0.50, 0, 0.03, 0.04, 0.76, '#181b1f');                 // top mounting bar
          box('metal', bx, 0.03, 0.34, 0.035, 0.065, 0.06, '#c9a44e', true);     // front brass ferrule
          box('metal', bx, 0.03, -0.34, 0.035, 0.065, 0.06, '#c9a44e', true);    // rear brass ferrule
        }
        // 2. Lower slatted natural oak storage shelf (y=0.18)
        for (let s = -0.28; s <= 0.28; s += 0.14) {
          box('wood', 0, 0.18, s, 0.68, 0.02, 0.06, '#a47e58');
        }

        // 3. Extra-Thick Luxury Channeled Upholstered Cushion (Sitting height reaches y=0.76 = 12.2px)
        box('fabric', 0, 0.56, 0, 0.88, 0.12, 0.82, HP.shade(color, 0.90));    // cushion sub-deck
        // 4 Tailored transverse quilted cushion flutes with piped welt seams
        for (let c = 0; c < 4; c++) {
          const cx = -0.30 + c * 0.20;
          box('fabric', cx, 0.68, 0, 0.18, 0.14, 0.80, color);
          box('fabric', cx, 0.755, 0, 0.16, 0.025, 0.76, HP.shade(color, 1.08)); // crowned top loft
        }

      } else if (/plantbig|big.*plant|monstera.*big|fiddle|palm/i.test(t) || /plant large|fiddle leaf|palm/i.test(def.name || '')) {
        // Architectural Large Indoor Houseplant (Fiddle Leaf Fig in fluted ceramic planter on elevated walnut tripod stand, 38px tall)
        // 1. Solid walnut tripod planter stand
        for (let i = 0; i < 3; i++) {
          const a = (i * 2 * Math.PI) / 3;
          cyl('wood', Math.cos(a) * 0.24, 0.14, Math.sin(a) * 0.24, 0.045, 0.28, 0.045, '#3d2516');
        }
        cyl('wood', 0, 0.18, 0, 0.36, 0.04, 0.36, '#3d2516'); // center cross-support

        // 2. Modern Fluted Cylindrical Ceramic Planter Pot with Raised Rim
        cyl('ceramic', 0, 0.32, 0, 0.46, 0.28, 0.46, '#fafaf8'); // pot body ends at y=0.46 (top cap at 0.46)
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI) / 6;
          box('ceramic', Math.cos(a) * 0.235, 0.38, Math.sin(a) * 0.235, 0.02, 0.36, 0.02, '#eeeae2'); // vertical fluted slats form outer rim to y=0.56
        }

        // 3. Real Organic Potting Dirt (Soil sits ON TOP of pot cylinder at y=0.46, crowning up to 0.53 - ZERO Z-fighting!)
        // Base dark organic potting soil bed (y=0.49, top at 0.52 - fully above the pot cap!)
        cyl('soil', 0, 0.49, 0, 0.44, 0.06, 0.44, '#24160e');
        // Natural crowned soil mound around trunks
        cyl('soil', 0, 0.525, 0, 0.32, 0.025, 0.32, '#352216');
        cyl('soil', -0.04, 0.535, 0.02, 0.18, 0.016, 0.18, '#3d281a');
        cyl('soil', 0.05, 0.535, -0.03, 0.16, 0.016, 0.16, '#2e1c12');

        // Smooth decorative river pebbles dressing on top of soil
        round('stone', -0.11, 0.54, -0.07, 0.06, 0.028, 0.06, '#756d62');
        round('stone', 0.10, 0.54, 0.06, 0.065, 0.028, 0.065, '#8c8477');
        round('stone', -0.03, 0.54, 0.11, 0.055, 0.028, 0.055, '#403b35');
        round('stone', 0.08, 0.54, -0.09, 0.05, 0.028, 0.05, '#b0a79a');

        // Lush green moss tufts nestled against hardwood trunks
        round('foliage', -0.02, 0.54, -0.05, 0.07, 0.03, 0.07, '#446626');
        round('foliage', 0.04, 0.54, 0.02, 0.06, 0.03, 0.06, '#36521e');

        // 4. Multi-Stem Natural Hardwood Trunk System
        cyl('wood', -0.04, 0.70, -0.03, 0.04, 0.32, 0.04, '#423122');
        cyl('wood', 0.05, 0.74, 0.04, 0.035, 0.36, 0.035, '#4a3828');

        // 5. Broad Sculptural Fan-Shaped Fiddle Leaves at layered natural heights (reaches y=1.0 = 38px!)
        const leafClusters = [
          { lx: -0.16, ly: 0.72, lz: -0.12, lw: 0.38, lh: 0.12, ld: 0.32, c: '#365a28' },
          { lx: 0.18, ly: 0.76, lz: 0.10, lw: 0.36, lh: 0.12, ld: 0.34, c: '#406830' },
          { lx: -0.06, ly: 0.84, lz: 0.18, lw: 0.34, lh: 0.11, ld: 0.30, c: '#487436' },
          { lx: 0.14, ly: 0.88, lz: -0.16, lw: 0.32, lh: 0.10, ld: 0.28, c: '#52823e' },
          { lx: 0, ly: 0.96, lz: 0, lw: 0.30, lh: 0.08, ld: 0.26, c: '#5e9446' }
        ];
        for (const { lx, ly, lz, lw, lh, ld, c } of leafClusters) {
          round('foliage', lx, ly, lz, lw, lh, ld, c);
        }

      } else if (/plantsm|small.*plant|succulent|cactus|vase/i.test(t) || /plant small/i.test(def.name || '')) {
        // Modern Ceramic Tabletop Planter (Matte ceramic pot with drainage saucer, rich soil, vibrant arching Monstera foliage)
        // 1. Ceramic pot & saucer
        cyl('ceramic', 0, 0.04, 0, 0.42, 0.06, 0.42, '#d48866'); // terracotta saucer
        cyl('ceramic', 0, 0.17, 0, 0.36, 0.20, 0.36, '#faf8f4'); // clean white ceramic pot (top at y=0.27)
        // Fluted rim ribs around perimeter extending to y=0.34
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          box('ceramic', Math.cos(a) * 0.18, 0.22, Math.sin(a) * 0.18, 0.018, 0.26, 0.018, '#eeeae2');
        }
        // Real potting soil sitting on pot at y=0.29 (top at 0.32 - fully above pot cap, zero Z-fighting!)
        cyl('soil', 0, 0.29, 0, 0.34, 0.04, 0.34, '#24160e');   // rich organic dark loam
        cyl('soil', 0, 0.315, 0, 0.22, 0.02, 0.22, '#352216');  // center mound
        round('stone', 0.06, 0.325, -0.04, 0.05, 0.02, 0.05, '#7e766b'); // river stone
        round('stone', -0.05, 0.325, 0.05, 0.045, 0.02, 0.045, '#564e44');

        // 2. Sculptural Arching Monstera / Succulent Foliage
        for (let j = 0; j < 5; j++) {
          const a = (j * 2 * Math.PI) / 5;
          const r = 0.14;
          const fx = Math.cos(a) * r, fz = Math.sin(a) * r;
          cyl('foliage', fx * 0.6, 0.48 + j * 0.06, fz * 0.6, 0.02, 0.20, 0.02, '#336325');
          round('foliage', fx, 0.58 + j * 0.08, fz, 0.26, 0.08, 0.24, j % 2 === 0 ? '#467c33' : '#579442');
        }

      } else if (/^tabledin6$|dining.*6/.test(t)) {
        // Luxury 6-Seater Modern Dining Table (Chamfered solid walnut slab, architectural matte black sled frame, brushed brass detailing)
        // 1. Honed beveled solid slab top with under-chamfer
        box('wood', 0, 0.96, 0, 0.96, 0.07, 0.92, color);
        box('dark', 0, 0.92, 0, 0.90, 0.025, 0.86, '#181b1e'); // shadow reveal apron

        // 2. Architectural dual metal sled base at both ends with ample legroom
        for (const sx of [-0.36, 0.36]) {
          box('metal', sx, 0.03, 0, 0.03, 0.06, 0.76, '#1e2126');                  // floor sled runner
          box('metal', sx, 0.47, 0.34, 0.03, 0.84, 0.035, '#1e2126');              // front vertical leg
          box('metal', sx, 0.47, -0.34, 0.03, 0.84, 0.035, '#1e2126');             // rear vertical leg
          box('metal', sx, 0.89, 0, 0.03, 0.04, 0.76, '#1e2126');                  // top mounting bracket
          box('metal', sx, 0.03, 0.34, 0.035, 0.065, 0.06, '#c9a44e', true);      // front brass ferrule
          box('metal', sx, 0.03, -0.34, 0.035, 0.065, 0.06, '#c9a44e', true);     // rear brass ferrule
        }
        // High central architectural tie-bar tucked under tabletop (plenty of knee clearance)
        box('metal', 0, 0.88, 0, 0.70, 0.03, 0.03, '#1e2126');

      } else if (/^tableround$|round.*dining/.test(t)) {
        // Modern Round Dining Table (Italian Calacatta marble circular top, architectural fluted conical pedestal base)
        // 1. Honed Italian Calacatta marble floating top with beveled edge
        cyl('ceramic', 0, 0.96, 0, 0.94, 0.07, 0.94, '#fafaf8');
        cyl('dark', 0, 0.92, 0, 0.86, 0.025, 0.86, '#1c1f24'); // sub-top shadow reveal plate

        // 2. Weighted circular metal floor base with brushed brass trim ring
        cyl('metal', 0, 0.03, 0, 0.52, 0.06, 0.52, '#181b1f');
        cyl('metal', 0, 0.05, 0, 0.53, 0.02, 0.53, '#c9a44e', true);

        // 3. Fluted architectural pedestal column (8 vertical relief ribs)
        cyl('wood', 0, 0.48, 0, 0.28, 0.84, 0.28, color);
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          box('wood', Math.cos(a) * 0.145, 0.48, Math.sin(a) * 0.145, 0.024, 0.84, 0.024, HP.shade(color, 0.85));
        }
        cyl('metal', 0, 0.89, 0, 0.34, 0.04, 0.34, '#c9a44e', true); // upper brass collar

      } else if (/^tabledin$|dining.*table/.test(t)) {
        // Modern 4-Seater Dining Table (Solid beveled slab top, splayed architectural legs with brass shoes, clean apron)
        // 1. Honed beveled solid slab top with under-chamfer
        box('wood', 0, 0.96, 0, 0.96, 0.07, 0.92, color);
        box('dark', 0, 0.92, 0, 0.88, 0.025, 0.84, '#202328'); // shadow reveal apron

        // 2. 4 Splayed architectural legs with brass shoes (high knee clearance, no obstructive stretchers!)
        for (const [lx, lz] of [[-0.40, 0.36], [0.40, 0.36], [-0.40, -0.36], [0.40, -0.36]]) {
          cyl('wood', lx, 0.46, lz, 0.045, 0.86, 0.045, '#2b2017');
          cyl('metal', lx, 0.03, lz, 0.050, 0.06, 0.050, '#c9a44e', true); // brushed brass shoe
        }
        // High perimeter apron sub-frame tucked right under the top
        box('wood', 0, 0.89, 0.34, 0.76, 0.04, 0.035, '#2b2017');
        box('wood', 0, 0.89, -0.34, 0.76, 0.04, 0.035, '#2b2017');
        box('wood', -0.38, 0.89, 0, 0.035, 0.04, 0.68, '#2b2017');
        box('wood', 0.38, 0.89, 0, 0.035, 0.04, 0.68, '#2b2017');

      } else if (/^coffeer$|coffee.*rect/.test(t)) {
        // Modern Minimalist Rectangular Coffee Table (Floating Calacatta marble slab, architectural fluted pedestals with shadow reveal, curated art books & brass tray)
        // 1. Slender fluted architectural pedestals with matte dark shadow plinths (Proportional 10px diameter, NO ugly tree trunks or clipping glass!)
        for (const px of [-0.26, 0.26]) {
          box('dark', px, 0.03, 0, 0.22, 0.06, 0.44, '#15171a');                           // recessed base plinth
          cyl('wood', px, 0.47, 0, 0.18, 0.82, 0.38, color);                               // slender fluted pedestal body
          box('wood', px - 0.07, 0.47, 0, 0.022, 0.82, 0.36, HP.shade(color, 0.86));      // vertical fluting relief
          box('wood', px + 0.07, 0.47, 0, 0.022, 0.82, 0.36, HP.shade(color, 0.86));
          box('metal', px, 0.87, 0, 0.20, 0.03, 0.40, '#c9a44e', true);                   // brushed brass top collar
        }

        // 2. Honed Italian Calacatta marble slab with floating beveled edge (h=0.08)
        box('dark', 0, 0.895, 0, 0.88, 0.025, 0.82, '#181b1e');                           // floating sub-top shadow reveal
        box('ceramic', 0, 0.95, 0, 0.94, 0.08, 0.88, '#fafaf8');                           // pristine white marble slab

        // 3. Curated Minimalist Decor: Sculptural brass tray with designer candle, and stacked hardcover art books
        // A. Sculptural brushed brass accessory tray with black glass candle
        box('metal', 0.18, 0.995, 0, 0.16, 0.015, 0.32, '#c9a44e', true);                 // brass valet tray
        cyl('dark', 0.18, 1.04, 0.06, 0.045, 0.08, 0.09, '#1a1d22');                      // luxury matte black candle tumbler
        cyl('glow', 0.18, 1.09, 0.06, 0.012, 0.02, 0.025, '#ffe0a0');                     // warm golden candle flame

        // B. Stacked architectural hardcover monographs
        box('fabric', -0.18, 0.995, 0.01, 0.22, 0.025, 0.32, '#9c5a3c');                  // bottom terracotta linen book
        box('fabric', -0.18, 1.025, -0.01, 0.20, 0.025, 0.30, '#ede8df');                 // top cream art book
        box('dark', -0.18, 1.025, -0.15, 0.20, 0.025, 0.022, '#181b1e');                  // contrasting dark cloth spine

      } else if (/^coffeeround$|coffee.*round/.test(t)) {
        // Modern Round Coffee Table (Floating Calacatta marble disc, sculptural fluted conical pedestal with brass trim ring)
        // 1. Recessed dark bronze floor plinth with brass accent ring
        cyl('dark', 0, 0.03, 0, 0.54, 0.06, 0.54, '#15171a');
        cyl('metal', 0, 0.05, 0, 0.55, 0.02, 0.55, '#c9a44e', true);

        // 2. Sculptural fluted pedestal column with 8 architectural relief ribs
        cyl('wood', 0, 0.46, 0, 0.34, 0.82, 0.34, color);
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          box('wood', Math.cos(a) * 0.175, 0.46, Math.sin(a) * 0.175, 0.025, 0.82, 0.025, HP.shade(color, 0.85));
        }
        cyl('metal', 0, 0.87, 0, 0.36, 0.03, 0.36, '#c9a44e', true);                       // top brass collar

        // 3. Floating Italian Calacatta marble circular slab
        cyl('dark', 0, 0.895, 0, 0.84, 0.025, 0.84, '#181b1e');
        cyl('ceramic', 0, 0.95, 0, 0.90, 0.08, 0.90, '#fafaf8');

        // 4. Curated decor: sculptural fluted ceramic bud vase with sprig
        cyl('ceramic', 0.08, 1.03, 0.06, 0.08, 0.14, 0.08, '#ece7df');
        cyl('wood', 0.08, 1.13, 0.06, 0.015, 0.12, 0.015, '#4a5d3d');
      } else if (/^sidetable$|end.*table/.test(t)) {
        // Modern Accent End Table (Honed marble circular top at sofa arm height, sculptural matte black metal pedestal with brass collar)
        // Weighted conical metal base & slender pedestal column
        cyl('metal', 0, 0.06, 0, 0.56, 0.10, 0.56, '#1a1d22');
        cyl('metal', 0, 0.14, 0, 0.42, 0.08, 0.42, '#1a1d22');
        cyl('metal', 0, 0.50, 0, 0.09, 0.68, 0.09, '#1a1d22');
        cyl('metal', 0, 0.82, 0, 0.14, 0.05, 0.14, '#c9a44e', true);
        cyl('metal', 0, 0.88, 0, 0.40, 0.04, 0.40, '#1a1d22');
        // Honed circular white Carrara marble top with beveled profile
        cyl('ceramic', 0, 0.94, 0, 0.64, 0.08, 0.64, '#fafaf8');
        cyl('ceramic', 0, 0.985, 0, 0.60, 0.02, 0.60, '#f2f0eb');
      } else if (/^piano$|grand.*piano/.test(t)) {
        // Luxury Concert Grand Piano (Mirror ebony lacquer case, propped acoustic lid, spruce soundboard, golden harp, authentic 88-key bed & tufted bench)
        // 1. 3 Heavy Architectural Grand Legs with Polished Brass Spade Casters
        // Front-left, front-right, and rear-tail legs
        for (const [lx, lz] of [[-0.38, 0.28], [0.38, 0.28], [-0.08, -0.36]]) {
          box('dark', lx, 0.62, lz, 0.08, 0.08, 0.08, '#121417');             // heavy square top leg block
          cyl('dark', lx, 0.32, lz, 0.045, 0.56, 0.045, '#121417');            // fluted column leg
          cyl('metal', lx, 0.03, lz, 0.052, 0.06, 0.052, '#c9a44e', true);     // heavy brass spade caster
        }

        // 2. Suspended Lyre Pedal Assembly under Keybed
        box('dark', -0.05, 0.28, 0.16, 0.02, 0.32, 0.025, '#121417');         // left lyre post
        box('dark', 0.05, 0.28, 0.16, 0.02, 0.32, 0.025, '#121417');          // right lyre post
        box('dark', 0, 0.12, 0.16, 0.14, 0.04, 0.03, '#121417');              // bottom pedal block
        // 3 authentic polished brass foot pedals (una corda, sostenuto, sustain) + vertical rods
        for (const px of [-0.04, 0, 0.04]) {
          box('metal', px, 0.07, 0.20, 0.016, 0.025, 0.08, '#c9a44e', true);  // brass foot pedal
          cyl('metal', px, 0.32, 0.16, 0.008, 0.36, 0.008, '#c9a44e', true);  // vertical brass push rod
        }

        // 3. Asymmetrical Grand Piano Case & Sculpted Curved Rim
        box('dark', 0, 0.68, -0.06, 0.94, 0.18, 0.76, '#121417');             // main bottom case carcass
        // Straight bass rim on the left
        box('dark', -0.42, 0.74, -0.06, 0.05, 0.28, 0.78, '#121417');
        // Elegant sweeping curved treble rim on the right & tail
        box('dark', 0.42, 0.74, 0.10, 0.05, 0.28, 0.46, '#121417');           // front treble rim
        box('dark', 0.30, 0.74, -0.22, 0.32, 0.28, 0.32, '#121417');          // belly curve contour
        box('dark', 0.08, 0.74, -0.40, 0.48, 0.28, 0.20, '#121417');          // rounded tail rim
        box('metal', -0.42, 0.885, -0.06, 0.02, 0.015, 0.40, '#c9a44e', true); // continuous brass lid hinge

        // 4. Acoustic Spruce Soundboard, Golden Cast-Iron Harp & Strings
        box('wood', -0.04, 0.67, -0.08, 0.78, 0.02, 0.64, '#d8aa72');         // European spruce soundboard
        box('wood', 0.08, 0.685, -0.16, 0.42, 0.018, 0.04, '#5c3a1d');        // curved dark wood bridge
        box('metal', -0.04, 0.70, -0.08, 0.74, 0.035, 0.58, '#c99e38', true);  // golden cast-iron harp plate
        // Sound ports & web sound holes in golden plate
        for (const [hx, hz] of [[-0.18, -0.20], [0.08, -0.28], [0.18, -0.06]]) {
          cyl('dark', hx, 0.71, hz, 0.08, 0.038, 0.08, '#121417');
        }
        // 12 fanned steel string courses
        for (let s = 0; s < 12; s++) {
          const sx = -0.32 + s * 0.055;
          box('metal', sx, 0.725, -0.08, 0.008, 0.006, 0.52, '#d8dde2');
        }

        // 5. Open Angled Acoustic Lid with Polished Brass Prop Stick
        box('dark', 0.05, 0.93, -0.08, 0.82, 0.025, 0.70, '#16191d');         // angled propped lid
        box('metal', 0.26, 0.82, -0.02, 0.014, 0.24, 0.014, '#c9a44e', true);  // brass prop stick
        box('metal', 0.26, 0.93, -0.02, 0.030, 0.015, 0.030, '#c9a44e', true); // brass lid cup bracket

        // 6. Authentic Keyboard Assembly (Cheek blocks, 88 ivory keys, ebony sharps in 2/3 groups, red felt, fallboard)
        // Polished ebony cheek blocks on left and right flanks
        box('dark', -0.42, 0.72, 0.38, 0.06, 0.12, 0.18, '#121417');
        box('dark', 0.42, 0.72, 0.38, 0.06, 0.12, 0.18, '#121417');
        // Upright fallboard with golden brand script emblem
        box('dark', 0, 0.76, 0.30, 0.80, 0.16, 0.035, '#121417');
        box('metal', 0, 0.79, 0.32, 0.18, 0.025, 0.006, '#d4af37', true);    // gold brand script
        // Crimson red felt damper strip running across the back of the keys
        box('fabric', 0, 0.72, 0.315, 0.76, 0.015, 0.025, '#c41824');
        // Ivory-white naturals keybed (continuous smooth bed with front overhang lip)
        box('ceramic', 0, 0.68, 0.39, 0.76, 0.038, 0.14, '#faf9f5');
        box('ceramic', 0, 0.675, 0.455, 0.76, 0.045, 0.02, '#f5f3ec');        // front beveled key lip
        // Fine vertical key divisions
        for (let k = 1; k < 21; k++) {
          box('dark', -0.38 + k * (0.76 / 21), 0.70, 0.40, 0.003, 0.005, 0.12, '#b8b4a8');
        }
        // Ebony black sharps arranged in authentic 3-octave [2 sharps, gap, 3 sharps, gap] groupings
        // 3 octaves: each octave width = 0.74 / 3 = 0.246
        for (let oct = 0; oct < 3; oct++) {
          const ox = -0.37 + oct * 0.246;
          // Group of 2 sharps (C#, D#)
          box('dark', ox + 0.032, 0.718, 0.365, 0.018, 0.032, 0.09, '#0e1012');
          box('dark', ox + 0.068, 0.718, 0.365, 0.018, 0.032, 0.09, '#0e1012');
          // Group of 3 sharps (F#, G#, A#)
          box('dark', ox + 0.138, 0.718, 0.365, 0.018, 0.032, 0.09, '#0e1012');
          box('dark', ox + 0.174, 0.718, 0.365, 0.018, 0.032, 0.09, '#0e1012');
          box('dark', ox + 0.210, 0.718, 0.365, 0.018, 0.032, 0.09, '#0e1012');
        }

        // 7. Angled Fretwork Music Desk & Open Sheet Music
        box('dark', 0, 0.85, 0.26, 0.56, 0.14, 0.025, '#121417');             // music rack backboard
        box('dark', 0, 0.78, 0.28, 0.58, 0.025, 0.04, '#121417');              // sheet ledge
        box('fabric', -0.10, 0.86, 0.255, 0.18, 0.11, 0.012, '#faf8f2');       // left sheet page
        box('fabric', 0.10, 0.86, 0.255, 0.18, 0.11, 0.012, '#faf8f2');        // right sheet page
        box('dark', -0.10, 0.86, 0.252, 0.14, 0.01, 0.005, '#181b1f');         // stave lines
        box('dark', 0.10, 0.86, 0.252, 0.14, 0.01, 0.005, '#181b1f');

        // 8. Luxury Matching Adjustable Piano Bench with Tufted Cushion & Brass Knobs
        for (const [bx, bz] of [[-0.20, 0.50], [0.20, 0.50], [-0.20, 0.58], [0.20, 0.58]]) {
          cyl('dark', bx, 0.22, bz, 0.026, 0.44, 0.026, '#121417');            // tapered legs
          cyl('metal', bx, 0.02, bz, 0.030, 0.04, 0.030, '#c9a44e', true);     // brass ferrules
        }
        box('dark', 0, 0.43, 0.54, 0.46, 0.06, 0.18, '#121417');               // solid apron box
        // Dual brass adjustment turn-knobs on bench sides
        cyl('metal', -0.24, 0.43, 0.54, 0.025, 0.02, 0.025, '#c9a44e', true);
        cyl('metal', 0.24, 0.43, 0.54, 0.025, 0.02, 0.025, '#c9a44e', true);
        // Deeply tufted black leather cushion top with perimeter piping
        box('fabric', 0, 0.48, 0.54, 0.48, 0.06, 0.20, '#1c1f24');             // main cushion
        box('fabric', 0, 0.515, 0.54, 0.45, 0.02, 0.17, '#2a2e36');            // crowned loft
        for (let tc = -0.14; tc <= 0.14; tc += 0.14) {
          box('dark', tc, 0.525, 0.54, 0.015, 0.01, 0.015, '#0e1012');         // leather tufting buttons
        }

      } else if (/^pooltable$|billiard/.test(t)) {
        // Luxury Tournament Billiards Table (Simonis green worsted bed, solid walnut rails with mother-of-pearl sights, 6 leather drop pockets, true 3D spherical balls & maple cues)
        // 1. 4 Heavy Architectural Square Pedestal Legs with Brushed Brass Levelers
        for (const [lx, lz] of [[-0.40, 0.36], [0.40, 0.36], [-0.40, -0.36], [0.40, -0.36]]) {
          box('wood', lx, 0.38, lz, 0.10, 0.76, 0.10, '#2e1d12');
          box('metal', lx, 0.04, lz, 0.11, 0.08, 0.11, '#c9a44e', true);       // heavy brass leveler foot
        }
        // Solid walnut under-frame carcass & arched apron
        box('wood', 0, 0.68, 0, 0.90, 0.18, 0.82, '#2e1d12');

        // 2. Precision Slate Bed with Tournament Simonis Green Worsted Cloth (y=0.79 to 0.82)
        box('fabric', 0, 0.80, 0, 0.86, 0.04, 0.76, '#1d5a3c');

        // 3. Solid Hardwood Perimeter Cushion Rails with Inlaid Mother-of-Pearl Diamond Sights
        box('wood', 0, 0.85, 0.43, 0.98, 0.08, 0.10, '#3d2516');               // front long rail
        box('wood', 0, 0.85, -0.43, 0.98, 0.08, 0.10, '#3d2516');              // back long rail
        box('wood', -0.47, 0.85, 0, 0.08, 0.08, 0.96, '#3d2516');              // left short rail
        box('wood', 0.47, 0.85, 0, 0.08, 0.08, 0.96, '#3d2516');               // right short rail
        // Diamond sights along rails
        for (const sx of [-0.24, 0, 0.24]) {
          box('ceramic', sx, 0.895, 0.43, 0.015, 0.005, 0.015, '#fafaf8');
          box('ceramic', sx, 0.895, -0.43, 0.015, 0.005, 0.015, '#fafaf8');
        }

        // 4. 6 Molded Drop Pockets with Cast Brass Corner Caps
        for (const [px, pz] of [
          [-0.43, 0.39], [0.43, 0.39], [-0.43, -0.39], [0.43, -0.39],           // 4 corner pockets
          [0, 0.40], [0, -0.40]                                                   // 2 center pockets
        ]) {
          box('metal', px, 0.86, pz, 0.06, 0.07, 0.06, '#c9a44e', true);
          cyl('dark', px, 0.79, pz, 0.045, 0.08, 0.045, '#121416');              // pocket opening drop cavity
        }

        // 5. True 3D Spherical Tournament Billiard Balls
        // Ball diameter dia = 2.4px; normalized radii to create 100% spherical 3D balls in world units!
        const bDia = 2.4;
        const rw = bDia / width;
        const rh = bDia / height;
        const rd = bDia / depth;
        const by = 0.82 + (bDia / 2) / height;

        // 15 Racked Balls in Tournament 8-Ball Triangle Configuration:
        // Row 0: #1 Yellow
        // Row 1: #2 Blue, #11 Red
        // Row 2: #12 Purple, #8 SOLID BLACK (CENTER!), #5 Orange
        // Row 3: #13 Orange Stripe, #6 Green, #10 Blue Stripe, #3 Red
        // Row 4: #7 Maroon, #14 Green Stripe, #9 Yellow Stripe, #15 Maroon Stripe, #4 Purple
        const rackColors = [
          ['#f5bc18'],
          ['#1d4ed8', '#c62828'],
          ['#6a1b9a', '#0a0b0d', '#ea580c'],
          ['#f97316', '#2e7d32', '#2563eb', '#dc2626'],
          ['#880e4f', '#388e3c', '#fbc02d', '#ad1457', '#7b1fa2']
        ];
        const rStart = 0.13;
        const dxRow = (bDia * 0.88) / width;
        const dzCol = bDia / depth;

        for (let r = 0; r < 5; r++) {
          const rowCols = rackColors[r];
          const rxPos = rStart + r * dxRow;
          for (let c = 0; c < rowCols.length; c++) {
            const rzPos = (c - r / 2) * dzCol;
            // True 3D Sphere mesh for each billiard ball
            round('ceramic', rxPos, by, rzPos, rw, rh, rd, rowCols[c]);
          }
        }

        // White Tournament Cue Ball behind Head String with Red Aim Dot
        round('ceramic', -0.24, by, 0, rw, rh, rd, '#fcfcfa');
        round('ceramic', -0.24, by + rh * 0.42, 0, rw * 0.25, rh * 0.25, rd * 0.25, '#c62828');

        // Solid Walnut Triangular Ball Rack resting on felt
        box('wood', 0.26, 0.835, 0, 0.16, 0.015, 0.015, '#382114');

        // Two Crossed Canadian Maple Tournament Cues resting on the rail
        // Butt sleeve, linen wrap, maple shaft, brass joint, and blue leather tip
        box('wood', 0, 0.905, -0.41, 0.65, 0.012, 0.012, '#cf9c63');            // cue 1 shaft
        box('dark', 0.24, 0.905, -0.41, 0.16, 0.013, 0.013, '#1c1f24');         // linen wrap grip
        box('metal', 0.16, 0.905, -0.41, 0.015, 0.014, 0.014, '#c9a44e', true); // brass joint
        box('ceramic', -0.32, 0.905, -0.41, 0.010, 0.011, 0.011, '#2563eb');    // blue chalked leather tip

        box('wood', -0.06, 0.915, -0.41, 0.65, 0.012, 0.012, '#b8854b');         // cue 2 shaft
        box('dark', 0.18, 0.915, -0.41, 0.16, 0.013, 0.013, '#1c1f24');

        // Blue Master Chalk Cube on Rail
        box('ceramic', -0.38, 0.905, 0.43, 0.015, 0.015, 0.015, '#1e40af');

      } else if (/^picnic$/i.test(t)) {
        // Classic Western Red Cedar Outdoor A-Frame Picnic Table with Dual Attached Benches (2x2 footprint, height 26px)
        const timber = color || '#a8713d';
        // 1. Dual A-frame structural trestles on left and right (-X and +X)
        for (const sx of [-0.36, 0.36]) {
          // Angled A-frame legs
          boxSlope('wood', sx, 0.04, -0.38, sx, 0.82, -0.16, 0.06, 0.06, HP.shade(timber, 0.85));
          boxSlope('wood', sx, 0.04,  0.38, sx, 0.82,  0.16, 0.06, 0.06, HP.shade(timber, 0.85));
          // Horizontal bench support cross-beam
          box('wood', sx, 0.44, 0, 0.06, 0.06, 0.92, HP.shade(timber, 0.85));
          // Upper tabletop support cross-beam
          box('wood', sx, 0.80, 0, 0.06, 0.06, 0.54, HP.shade(timber, 0.85));
        }
        // Center diagonal under-table sway braces
        boxSlope('wood', -0.32, 0.44, 0, 0, 0.80, 0, 0.04, 0.06, HP.shade(timber, 0.80));
        boxSlope('wood',  0.32, 0.44, 0, 0, 0.80, 0, 0.04, 0.06, HP.shade(timber, 0.80));
        // 2. Dual full-length attached wooden bench seats (-Z and +Z)
        for (const bz of [-0.36, 0.36]) {
          box('wood', 0, 0.48, bz, 0.94, 0.04, 0.22, timber);
        }
        // 3. Slatted tabletop (4 wide timber planks with subtle expansion reveal gaps)
        for (let p = 0; p < 4; p++) {
          const pz = -0.18 + p * 0.12;
          box('wood', 0, 0.85, pz, 0.96, 0.045, 0.105, timber);
        }
        // Parasol / umbrella center pass-through hole
        cyl('dark', 0, 0.85, 0, 0.045, 0.05, 0.045, '#1e2124');

      } else if (/table|desk/.test(t)) {
        legs(0.82);
        box('wood', 0, 0.9, 0, 0.99, 0.12, 0.96, color);
        if (/pooltable/.test(t)) box('fabric', 0, 0.97, 0, 0.87, 0.025, 0.8, '#4e8a70');
        if (/piano/.test(t)) {
          box('dark', 0, 0.7, -0.2, 0.98, 0.6, 0.6);
          box('ceramic', 0, 0.92, 0.26, 0.9, 0.03, 0.21);
          for (let j = 0; j < 14; j++) box('dark', -0.43 + j * 0.065, 0.95, 0.2, 0.025, 0.03, 0.12, null, true);
        }
      } else if (/^ksink$|kitchen.*sink/.test(t)) {
        // High-Detail Modern Minimal Kitchen Sink Cabinet with Deep Undermount Porcelain Basin
        // Dimensions: width = 53px (2 cells), depth = 25px (1 cell), height = 25px
        box('dark', 0, 0.035, 0.04, 0.96, 0.07, 0.88, '#181b1e');
        // Hollow cabinet body for sink cavity
        box('wood', 0, 0.09, 0.03, 0.94, 0.05, 0.88, HP.shade(color, 0.7));
        box('wood', 0, 0.48, -0.39, 0.94, 0.74, 0.04, HP.shade(color, 0.7));
        box('wood', -0.46, 0.48, 0.03, 0.04, 0.74, 0.88, HP.shade(color, 0.8));
        box('wood', 0.46, 0.48, 0.03, 0.04, 0.74, 0.88, HP.shade(color, 0.8));

        // Quartz countertop with undermount cutout flush end-to-end with adjacent cabinets
        box('ceramic', -0.395, 0.964, 0, 0.21, 0.072, 0.98, '#fafaf8');        // left rim
        box('ceramic', 0.395, 0.964, 0, 0.21, 0.072, 0.98, '#fafaf8');         // right rim
        box('ceramic', 0, 0.964, -0.395, 0.58, 0.072, 0.19, '#fafaf8');        // back deck
        box('ceramic', 0, 0.964, 0.415, 0.58, 0.072, 0.15, '#fafaf8');         // front rim

        // Cabinet Front: top false panel + double cabinet doors (flush to outer cabinet side edges)
        box('dark', 0, 0.885, 0.455, 0.94, 0.03, 0.03, '#202328');
        box('wood', 0, 0.77, 0.46, 0.94, 0.20, 0.025, color);
        box('wood', -0.235, 0.41, 0.465, 0.46, 0.48, 0.025, color);
        box('metal', -0.05, 0.58, 0.475, 0.015, 0.14, 0.015, '#c5ccd2', true);
        box('wood', 0.235, 0.41, 0.465, 0.46, 0.48, 0.025, color);
        box('metal', 0.05, 0.58, 0.475, 0.015, 0.14, 0.015, '#c5ccd2', true);

        // Deep rectangular pristine white porcelain basin
        box('ceramic', 0, 0.38, 0.02, 0.56, 0.04, 0.60, '#ffffff');            // basin floor
        box('ceramic', 0, 0.655, -0.29, 0.56, 0.54, 0.025, '#ffffff');         // back wall
        box('ceramic', 0, 0.655, 0.33, 0.56, 0.54, 0.025, '#ffffff');          // front wall
        box('ceramic', -0.27, 0.655, 0.02, 0.025, 0.54, 0.60, '#ffffff');      // left wall
        box('ceramic', 0.27, 0.655, 0.02, 0.025, 0.54, 0.60, '#ffffff');       // right wall

        // Centered circular stainless basket strainer drain (dia = 5.5px: w = 5.5/53 = 0.104, d = 5.5/25 = 0.22)
        cyl('metal', 0, 0.402, 0.02, 0.104, 0.008, 0.22, '#dce3ea');
        cyl('dark', 0, 0.404, 0.02, 0.080, 0.010, 0.168, '#26292f');
        cyl('metal', 0, 0.406, 0.02, 0.068, 0.008, 0.144, '#b4bcc4');
        box('dark', 0, 0.410, 0.02, 0.050, 0.006, 0.030, '#16181b', true);
        box('dark', 0, 0.410, 0.02, 0.015, 0.006, 0.100, '#16181b', true);
        cyl('metal', 0, 0.420, 0.02, 0.026, 0.022, 0.056, '#f0f4f8');
        round('metal', 0, 0.435, 0.02, 0.028, 0.016, 0.060, '#ffffff');

        // Overflow slot
        box('metal', 0, 0.82, -0.278, 0.12, 0.040, 0.008, '#c2c9d0', true);
        box('dark', 0, 0.82, -0.276, 0.09, 0.022, 0.009, '#181b1e', true);
        box('metal', 0, 0.82, -0.274, 0.012, 0.020, 0.010, '#c2c9d0', true);

        // Centered single smooth gooseneck mixer tap over basin drain
        cyl('metal', 0, 1.015, -0.37, 0.064, 0.030, 0.136, '#eef2f6');
        cyl('metal', 0, 1.155, -0.37, 0.040, 0.250, 0.085, '#eef2f6');
        // Side single-lever mixer handle
        cylX('metal', 0.055, 1.11, -0.37, 0.070, 0.026, 0.056, '#d8dee4', true);
        // Smooth swept gooseneck arch via sloped stainless segments
        boxSlope('metal', 0, 1.27, -0.37, 0, 1.41, -0.29, 0.034, 0.068, '#edf1f6');
        boxSlope('metal', 0, 1.41, -0.29, 0, 1.43, -0.18, 0.034, 0.068, '#edf1f6');
        boxSlope('metal', 0, 1.43, -0.18, 0, 1.33, -0.11, 0.034, 0.068, '#edf1f6');
        cyl('metal', 0, 1.29, -0.11, 0.042, 0.06, 0.088, '#c4cbd2');
        cyl('dark', 0, 1.258, -0.11, 0.032, 0.01, 0.068, '#25282d');

        // Clean translucent basin water surface (no static white vertical stick!)
        box('glass', 0, 0.430, 0.02, 0.540, 0.020, 0.560, '#bfeaf1');
      } else if (/sink|vanity|basin/.test(t)) {
        cabinet(color);
        round('ceramic', 0, 0.99, 0, 0.68, 0.08, 0.6);
        round('dark', 0, 1.02, 0, 0.43, 0.018, 0.33, '#798e8f');
        cyl('metal', 0, 1.13, -0.29, 0.035, 0.27, 0.035);
        box('metal', 0, 1.25, -0.19, 0.04, 0.035, 0.25);
      } else if (/fridgexl|french.*fridge/.test(t)) {
        // High-End French-Door Refrigerator (Realistic 36-inch wide profile: width ~42px, depth ~38px, height 52px)
        // Recessed ventilation plinth
        box('dark', 0, 0.025, 0, 0.77, 0.05, 0.68, '#14171a');
        // Main insulated steel cabinet body (slender, not filling the full 53px grid width!)
        box('metal', 0, 0.52, -0.01, 0.79, 0.94, 0.70, color);

        // Upper French Double Doors (split left & right, upper 60%)
        box('metal', -0.20, 0.685, 0.355, 0.385, 0.59, 0.035, HP.shade(color, 1.04));
        box('metal', 0.20, 0.685, 0.355, 0.385, 0.59, 0.035, HP.shade(color, 1.04));
        // Center vertical gasket seal gap
        box('dark', 0, 0.685, 0.345, 0.015, 0.59, 0.025, '#191b1f');

        // Vertical slim handles
        box('metal', -0.04, 0.65, 0.385, 0.018, 0.38, 0.018, '#3a3f47', true);
        box('metal', 0.04, 0.65, 0.385, 0.018, 0.38, 0.018, '#3a3f47', true);

        // In-door water & ice dispenser on left door
        box('dark', -0.20, 0.685, 0.365, 0.16, 0.20, 0.025, '#15171a', true);
        box('glass', -0.20, 0.755, 0.378, 0.12, 0.045, 0.008, '#587a88', true);
        box('glow', -0.20, 0.760, 0.382, 0.07, 0.012, 0.006, '#7be0d0', true);
        box('metal', -0.20, 0.645, 0.372, 0.04, 0.070, 0.012, '#85909c', true);

        // Lower pull-out freezer drawer
        box('metal', 0, 0.210, 0.355, 0.79, 0.30, 0.035, HP.shade(color, 1.02));
        box('metal', 0, 0.300, 0.385, 0.42, 0.022, 0.018, '#3a3f47', true);
        // Horizontal shadow reveal gap
        box('dark', 0, 0.370, 0.345, 0.79, 0.025, 0.025, '#191b1f');
        // Top hinge cap
        box('dark', -0.32, 0.985, 0.30, 0.06, 0.020, 0.06, '#2a2e33', true);
        box('dark', 0.32, 0.985, 0.30, 0.06, 0.020, 0.06, '#2a2e33', true);
      } else if (/fridge|refrigerator/.test(t)) {
        // Standard Modern Refrigerator (Realistic 30-inch slender profile: width ~34px, depth ~36px, height 52px)
        // Recessed base plinth
        box('dark', 0, 0.025, 0, 0.62, 0.05, 0.66, '#14171a');
        // Main insulated cabinet body (tall and slim!)
        box('metal', 0, 0.52, -0.01, 0.64, 0.94, 0.68, color);

        // Top freezer door (upper 35%)
        box('metal', 0, 0.795, 0.345, 0.64, 0.35, 0.035, HP.shade(color, 1.04));
        box('metal', 0.27, 0.760, 0.375, 0.020, 0.18, 0.018, '#3a3f47', true);

        // Main refrigerator door (lower 55%)
        box('metal', 0, 0.325, 0.345, 0.64, 0.53, 0.035, HP.shade(color, 1.02));
        box('metal', 0.27, 0.420, 0.375, 0.020, 0.28, 0.018, '#3a3f47', true);

        // Horizontal pocket handle gap
        box('dark', 0, 0.605, 0.335, 0.64, 0.025, 0.025, '#191b1f');
        // Top hinge cap
        box('dark', 0.26, 0.985, 0.28, 0.06, 0.020, 0.06, '#2a2e33', true);
      } else if (/stove|cooktop|oven\b/.test(t)) {
        // Modern Induction/Glass Slide-In Stove & Oven (Clean layer separation, zero z-fighting)
        box('dark', 0, 0.035, 0.02, 0.96, 0.07, 0.9, '#1a1d20');
        box('metal', 0, 0.46, -0.02, 0.96, 0.78, 0.92, color);
        box('dark', 0, 0.90, 0, 0.98, 0.04, 0.96, '#181b1e');
        box('metal', 0, 0.89, 0, 1.0, 0.02, 0.98, '#a2abb3');
        box('metal', 0, 0.96, -0.44, 0.98, 0.08, 0.08, '#4a5056');
        const bpos = [[-0.24, -0.16, 0.30, 0.12], [0.24, 0.16, 0.30, 0.12],
                      [-0.24, 0.16, 0.22, 0.09], [0.24, -0.16, 0.22, 0.09]];
        for (const [bx, bz, br, ir] of bpos) {
          cyl('metal', bx, 0.935, bz, br, 0.020, br, '#353a40');
          cyl('glow', bx, 0.945, bz, ir, 0.010, ir, '#e07a4a');
        }
        box('metal', 0, 0.835, 0.47, 0.96, 0.13, 0.03, '#2a2e34');
        for (let i = 0; i < 5; i++)
          cyl('metal', -0.36 + i * 0.18, 0.835, 0.495, 0.04, 0.025, 0.04, '#c4cbd2', true);
        box('glow', 0, 0.855, 0.488, 0.12, 0.035, 0.005, '#52e09a', true);
        box('metal', 0, 0.48, 0.47, 0.96, 0.52, 0.03, color);
        box('glass', 0, 0.49, 0.486, 0.68, 0.34, 0.01, '#111315');
        box('metal', 0, 0.70, 0.52, 0.74, 0.03, 0.025, '#cdd4da', true);
        box('metal', -0.34, 0.70, 0.495, 0.025, 0.025, 0.03, '#a0a8b0', true);
        box('metal', 0.34, 0.70, 0.495, 0.025, 0.025, 0.03, '#a0a8b0', true);
        box('metal', 0, 0.14, 0.47, 0.96, 0.12, 0.03, color);
        box('dark', 0, 0.185, 0.485, 0.28, 0.015, 0.01, '#1e2124', true);

      } else if (/dishwash/.test(t)) {
        // Modern Integrated Dishwasher
        box('dark', 0, 0.035, 0.02, 0.96, 0.07, 0.9, '#1a1d20');
        box('dark', 0, 0.48, -0.02, 0.96, 0.82, 0.92, '#25292e');
        box('metal', 0, 0.92, 0, 0.98, 0.03, 0.96, '#8b939c');
        box('metal', 0, 0.47, 0.46, 0.95, 0.79, 0.035, color);
        box('dark', 0, 0.84, 0.47, 0.93, 0.09, 0.02, '#181a1d');
        box('glow', -0.28, 0.84, 0.482, 0.08, 0.025, 0.005, '#4fc3f7', true);
        for (let i = 0; i < 4; i++)
          box('metal', 0.1 + i * 0.08, 0.84, 0.482, 0.04, 0.02, 0.005, '#8c959e', true);
        box('metal', 0, 0.74, 0.505, 0.72, 0.03, 0.025, '#cdd4da', true);
        box('metal', -0.32, 0.74, 0.48, 0.025, 0.025, 0.03, '#9ca4ac', true);
        box('metal', 0.32, 0.74, 0.48, 0.025, 0.025, 0.03, '#9ca4ac', true);
      } else if (/rangehood|extractor|cookerhood/.test(t)) {
        // Modern Stainless Range Hood (suspended canopy + chimney duct + cooktop light)
        // Canopy bottom hangs at y=0.68 (~49px high, well above eye level and stove)
        box('metal', 0, 0.68, 0, 0.96, 0.05, 0.96, color);
        box('metal', 0, 0.74, -0.05, 0.75, 0.08, 0.70, color);
        // Mesh grease filters underneath
        box('dark', -0.24, 0.655, 0, 0.38, 0.015, 0.80, '#22262a');
        box('dark', 0.24, 0.655, 0, 0.38, 0.015, 0.80, '#22262a');
        box('metal', 0, 0.652, 0, 0.03, 0.018, 0.82, '#8b949c');
        // Under-canopy LED light strip
        box('glow', 0, 0.655, 0.36, 0.60, 0.015, 0.06, '#fff4d6');
        // Front touch controls
        box('dark', 0, 0.68, 0.485, 0.38, 0.03, 0.008, '#181b1e', true);
        box('glow', 0, 0.68, 0.49, 0.14, 0.01, 0.005, '#52e09a', true);
        // Vertical chimney to ceiling
        box('metal', 0, 0.84, -0.08, 0.34, 0.16, 0.36, color);
        box('metal', 0, 0.94, -0.08, 0.32, 0.12, 0.34, HP.shade(color, 0.95));
        box('metal', 0, 0.995, -0.08, 0.38, 0.015, 0.40, '#7c858e');
      } else if (/island/.test(t)) {
        // High-Detail Modern Minimal Waterfall Island with Deep Porcelain Undermount Sink & Gooseneck Mixer Tap
        // Dimensions: width = 81px (3 cells), depth = 25px (1 cell), height = 25px
        // 1. Pure White Quartz Waterfall Ends
        box('ceramic', -0.48, 0.50, 0, 0.04, 1.0, 0.98, '#fafaf8');  // left waterfall slab
        box('ceramic', 0.48, 0.50, 0, 0.04, 1.0, 0.98, '#fafaf8');   // right waterfall slab

        // 2. Quartz Countertop Frame with Undermount Cutout (perfectly seamless to waterfall slabs)
        // Countertop top is at y=1.0, thickness is 0.072 (1.8px), extends from y=0.928 to 1.0
        // Left slab meets at x = -0.46, right slab meets at x = +0.46
        box('ceramic', 0.23, 0.964, 0, 0.46, 0.072, 0.98, '#fafaf8');          // right food prep slab
        box('ceramic', -0.405, 0.964, 0, 0.11, 0.072, 0.98, '#fafaf8');        // left rim
        box('ceramic', -0.175, 0.964, -0.395, 0.35, 0.072, 0.19, '#fafaf8');   // back rim (faucet deck)
        box('ceramic', -0.175, 0.964, 0.415, 0.35, 0.072, 0.15, '#fafaf8');    // front rim

        // 3. Recessed Base Plinth & Cabinet Body (Hollow Sink Cavity - NO WOOD INTRUSION!)
        box('dark', 0, 0.035, 0.04, 0.90, 0.07, 0.82, '#181b1e');             // dark recessed plinth
        // Right cabinet body (solid under prep slab)
        box('wood', 0.23, 0.48, 0.03, 0.46, 0.82, 0.82, color);
        // Left cabinet body (open cavity for sink, walls only)
        box('wood', -0.18, 0.09, 0.03, 0.46, 0.05, 0.82, HP.shade(color, 0.7)); // low cabinet floor shelf
        box('wood', -0.18, 0.48, -0.39, 0.46, 0.74, 0.04, HP.shade(color, 0.7));// back cabinet wall
        box('wood', 0.00, 0.48, 0.03, 0.03, 0.74, 0.82, HP.shade(color, 0.8));   // internal divider wall
        box('wood', -0.45, 0.48, 0.03, 0.02, 0.74, 0.82, HP.shade(color, 0.8)); // left internal wall

        // 4. Cabinet Fronts: Right Drawers & Left Sink False Panel + Doors (seamlessly spans from -0.46 to +0.46)
        box('dark', 0, 0.885, 0.452, 0.92, 0.03, 0.02, '#202328');            // top shadow reveal gap
        // Left (sink cabinet): top false drawer panel + double bottom doors
        box('wood', -0.23, 0.77, 0.46, 0.455, 0.20, 0.025, color);
        box('metal', -0.23, 0.855, 0.472, 0.32, 0.015, 0.015, '#c5ccd2', true);
        box('wood', -0.342, 0.41, 0.46, 0.225, 0.48, 0.025, color);
        box('metal', -0.24, 0.58, 0.472, 0.015, 0.14, 0.015, '#c5ccd2', true);
        box('wood', -0.117, 0.41, 0.46, 0.225, 0.48, 0.025, color);
        box('metal', -0.22, 0.58, 0.472, 0.015, 0.14, 0.015, '#c5ccd2', true);
        // Right: 3 full-extension storage drawers
        for (const [dy, dh] of [[0.77, 0.20], [0.52, 0.26], [0.23, 0.26]]) {
          box('wood', 0.23, dy, 0.46, 0.455, dh, 0.025, color);
          box('metal', 0.23, dy + dh * 0.4, 0.472, 0.32, 0.015, 0.015, '#c5ccd2', true);
        }

        // 5. Deep Rectangular Pristine White Porcelain Basin
        // Basin floor sits deep at y=0.38 (depth = 14.5px ~ 22cm), completely white porcelain
        box('ceramic', -0.18, 0.38, 0.02, 0.382, 0.04, 0.60, '#ffffff');       // basin floor
        box('ceramic', -0.18, 0.655, -0.29, 0.382, 0.54, 0.025, '#ffffff');    // back wall
        box('ceramic', -0.18, 0.655, 0.33, 0.382, 0.54, 0.025, '#ffffff');     // front wall
        box('ceramic', -0.366, 0.655, 0.02, 0.022, 0.54, 0.60, '#ffffff');     // left wall
        box('ceramic', 0.006, 0.655, 0.02, 0.022, 0.54, 0.60, '#ffffff');      // right wall

        // 6. Centered Stainless Steel Basket Strainer Drain (True Circular Proportions!)
        // Center: x = -0.18, z = 0.02
        cyl('metal', -0.18, 0.402, 0.02, 0.068, 0.008, 0.22, '#dce3ea');       // outer polished flange
        cyl('dark', -0.18, 0.404, 0.02, 0.052, 0.010, 0.168, '#26292f');       // recessed strainer cup
        cyl('metal', -0.18, 0.406, 0.02, 0.044, 0.008, 0.144, '#b4bcc4');      // perforated basket floor
        box('dark', -0.18, 0.410, 0.02, 0.034, 0.006, 0.030, '#16181b', true); // strainer cross slot X
        box('dark', -0.18, 0.410, 0.02, 0.010, 0.006, 0.100, '#16181b', true); // strainer cross slot Z
        cyl('metal', -0.18, 0.420, 0.02, 0.017, 0.022, 0.056, '#f0f4f8');      // center stopper stem
        round('metal', -0.18, 0.435, 0.02, 0.018, 0.016, 0.060, '#ffffff');    // center stopper knob

        // 7. Brushed Chrome Overflow Slot on Rear Basin Wall
        box('metal', -0.18, 0.82, -0.278, 0.080, 0.040, 0.008, '#c2c9d0', true); // outer chrome bezel
        box('dark', -0.18, 0.82, -0.276, 0.060, 0.022, 0.009, '#181b1e', true);  // dark slot aperture
        box('metal', -0.18, 0.82, -0.274, 0.008, 0.020, 0.010, '#c2c9d0', true); // vertical divider bar

        // 8. Polished Chrome Arched Gooseneck Mixer Tap (Photo-matched smooth high arc!)
        // Escutcheon base collar on back deck
        cyl('metal', -0.25, 1.015, -0.38, 0.044, 0.030, 0.144, '#eef2f6');
        // Vertical mixer pillar
        cyl('metal', -0.25, 1.150, -0.38, 0.030, 0.240, 0.096, '#eef2f6');
        // Single side pin-lever mixer handle
        cyl('metal', -0.21, 1.120, -0.38, 0.024, 0.050, 0.076, '#d8dee4', true); // handle hub
        box('metal', -0.20, 1.180, -0.36, 0.012, 0.110, 0.035, '#f5f7fa', true); // pin lever
        round('metal', -0.20, 1.240, -0.35, 0.016, 0.025, 0.050, '#ffffff', true);// lever tip
        // Smooth 6-segment arched gooseneck spout curving forward and down over the sink
        box('metal', -0.25, 1.30, -0.375, 0.025, 0.080, 0.080, '#e8edf2');       // curve segment 1
        box('metal', -0.25, 1.37, -0.350, 0.025, 0.080, 0.085, '#e8edf2');       // curve segment 2
        box('metal', -0.25, 1.43, -0.300, 0.025, 0.070, 0.110, '#e8edf2');       // curve segment 3
        box('metal', -0.25, 1.45, -0.230, 0.025, 0.040, 0.130, '#edf1f6');       // crest of arch (horizontal)
        box('metal', -0.25, 1.42, -0.170, 0.025, 0.070, 0.100, '#edf1f6');       // curve segment 5 (downward)
        box('metal', -0.25, 1.34, -0.140, 0.025, 0.100, 0.080, '#edf1f6');       // vertical spout downpipe
        // Chrome aerator nozzle collar and mesh screen
        cyl('metal', -0.25, 1.280, -0.140, 0.030, 0.030, 0.096, '#c4cbd2');
        cyl('dark', -0.25, 1.262, -0.140, 0.024, 0.010, 0.076, '#25282d');

        // 9. Realistic Clear Aerated Water Stream & Basin Water
        // Slender clear outer water stream from aerator to sink floor
        cyl('glass', -0.25, 0.850, -0.140, 0.010, 0.810, 0.032, '#e0f4f7');
        // Thin aerated white bubble core
        cyl('ceramic', -0.25, 0.850, -0.140, 0.005, 0.800, 0.016, '#ffffff');
        // Pooled crystal-clear water in the basin bottom
        box('glass', -0.18, 0.430, 0.02, 0.360, 0.020, 0.560, '#bfeaf1');
        // Foaming water ripples around the stream impact zone
        cyl('ceramic', -0.25, 0.442, -0.140, 0.036, 0.006, 0.115, '#ffffff');
        cyl('glass', -0.25, 0.444, -0.140, 0.050, 0.006, 0.160, '#d8f4f8');
      } else if (/^buffet$|sideboard/.test(t)) {
        // Modern Credenza / Sideboard (Floating body, black stiletto legs, white marble top, 4 fluted push doors with brass edge pulls)
        for (const [lx, lz] of [[-0.42, 0.38], [0.42, 0.38], [-0.42, -0.38], [0.42, -0.38]])
          box('dark', lx, 0.08, lz, 0.03, 0.16, 0.03, '#1c1f24');
        box('dark', 0, 0.14, 0, 0.86, 0.04, 0.78, '#1c1f24');
        box('wood', 0, 0.54, 0, 0.94, 0.76, 0.90, color);
        box('ceramic', 0, 0.94, 0, 0.96, 0.06, 0.94, '#fafaf8');
        for (const dx of [-0.34, -0.11, 0.11, 0.34]) {
          box('wood', dx, 0.54, 0.46, 0.21, 0.72, 0.025, HP.shade(color, 1.02));
          for (const fx of [-0.06, 0, 0.06])
            box('wood', dx + fx, 0.54, 0.475, 0.025, 0.70, 0.015, HP.shade(color, 0.85));
          box('metal', dx, 0.88, 0.472, 0.12, 0.015, 0.015, '#c9a44e', true);
        }
      } else if (/^winecab$|wine.*cooler|wine.*cabinet/.test(t)) {
        // Modern Undercounter Wine Chiller (Dark UV glass door, stainless tubular handle, blue LED glow, beechwood bottle racks)
        box('dark', 0, 0.03, 0, 0.94, 0.06, 0.88, '#141619');
        box('dark', 0, 0.50, -0.02, 0.94, 0.90, 0.90, '#1a1d20');
        box('metal', 0, 0.51, 0.46, 0.94, 0.88, 0.04, '#3a3f47');
        box('glass', 0, 0.51, 0.468, 0.80, 0.74, 0.01, '#1b2631');
        cyl('metal', 0.38, 0.51, 0.495, 0.03, 0.70, 0.03, '#d8dee4', true);
        box('glow', 0, 0.92, 0.36, 0.76, 0.02, 0.04, '#4fc3f7');
        for (const y of [0.76, 0.58, 0.40, 0.22]) {
          box('wood', 0, y, 0.42, 0.76, 0.025, 0.03, '#c89a66');
          cyl('dark', -0.20, y + 0.03, 0.15, 0.16, 0.06, 0.16, '#182e1b');
          cyl('metal', -0.20, y + 0.03, 0.36, 0.08, 0.06, 0.08, '#c9a44e');
          cyl('dark', 0.20, y + 0.03, 0.15, 0.16, 0.06, 0.16, '#2e1818');
          cyl('metal', 0.20, y + 0.03, 0.36, 0.08, 0.06, 0.08, '#c5ccd2');
        }
      } else if (/^china$|china.*cabinet|vitrine/.test(t)) {
        // Modern China & Vitrine Display Cabinet (Lower closed drawers, upper illuminated tempered glass shelves, black aluminum frame)
        box('dark', 0, 0.025, 0.02, 0.92, 0.05, 0.88, '#14171a');
        box('wood', 0, 0.18, 0, 0.94, 0.26, 0.90, color);
        for (const dx of [-0.28, 0, 0.28]) {
          box('wood', dx, 0.18, 0.46, 0.26, 0.23, 0.025, color);
          box('metal', dx, 0.28, 0.472, 0.18, 0.015, 0.015, '#c5ccd2', true);
        }
        box('dark', -0.45, 0.65, 0, 0.04, 0.68, 0.88, '#181b1e');
        box('dark', 0.45, 0.65, 0, 0.04, 0.68, 0.88, '#181b1e');
        box('dark', 0, 0.985, 0, 0.94, 0.03, 0.88, '#181b1e');
        box('wood', 0, 0.65, -0.43, 0.90, 0.68, 0.03, HP.shade(color, 0.8));
        for (const y of [0.48, 0.65, 0.82])
          box('glass', 0, y, 0, 0.88, 0.015, 0.80, '#92bbc0');
        box('glow', 0, 0.97, 0, 0.70, 0.015, 0.20, '#fff4d6');
        box('glass', -0.22, 0.65, 0.45, 0.43, 0.64, 0.01, '#92bbc0');
        box('glass', 0.22, 0.65, 0.45, 0.43, 0.64, 0.01, '#92bbc0');
        box('metal', -0.02, 0.65, 0.465, 0.015, 0.24, 0.015, '#c5ccd2', true);
        box('metal', 0.02, 0.65, 0.465, 0.015, 0.24, 0.015, '#c5ccd2', true);
      } else if (/^barcounter$|bar.*counter/.test(t)) {
        // Style A: Luxury Walnut Fluted Bar Counter with Calacatta Marble Waterfall & Brushed Brass Footrest Rail
        const walnut = color && color !== '#c3a383' ? color : '#6e4c33';

        // 1. Recessed Plinth Base & Solid Structural Carcass
        box('dark', 0, 0.035, 0, 0.92, 0.07, 0.84, '#15171a');
        box('glow', 0, 0.035, 0.22, 0.88, 0.025, 0.02, '#ffe0a8'); // warm golden LED toe-kick glow
        box('wood', 0, 0.464, -0.04, 0.90, 0.78, 0.76, HP.shade(walnut, 0.82));

        // 2. Thick Calacatta Marble Waterfall Serving Top with Deep Guest Overhang
        box('ceramic', 0, 0.964, 0.02, 1.0, 0.072, 0.92, '#fafaf8');
        box('ceramic', -0.475, 0.464, 0.02, 0.05, 0.928, 0.92, '#fafaf8');
        box('ceramic', 0.475, 0.464, 0.02, 0.05, 0.928, 0.92, '#fafaf8');
        box('glow', 0, 0.915, 0.32, 0.88, 0.02, 0.02, '#ffe2a0'); // integrated LED cove light under guest overhang

        // 3. Guest-Facing Warm Walnut 3D Fluted Timber Facade (16 individual vertical relief slats with shadow depth)
        box('wood', 0, 0.48, 0.23, 0.90, 0.86, 0.03, walnut);
        for (let i = 0; i < 16; i++) {
          const fx = -0.40 + i * (0.80 / 15);
          box('wood', fx, 0.48, 0.255, 0.026, 0.86, 0.025, HP.shade(walnut, 1.14));
        }

        // 4. Style A Brushed Brass Tubular Footrest Assembly (True circular cross-section, return brackets + floor stanchions)
        box('metal', 0, 0.16, 0.38, 0.84, 0.086, 0.096, '#d4af37');             // brushed brass tubular rail
        for (const bx of [-0.38, 0, 0.38]) {
          box('metal', bx, 0.16, 0.31, 0.03, 0.086, 0.14, '#c9a44e');      // support bracket into carcass
          cyl('metal', bx, 0.08, 0.38, 0.03, 0.16, 0.09, '#c9a44e');       // vertical cylindrical stanchion post
          cyl('metal', bx, 0.015, 0.38, 0.05, 0.03, 0.15, '#c9a44e');      // cast floor flange disc
        }
        box('metal', -0.42, 0.16, 0.32, 0.03, 0.086, 0.12, '#c9a44e');     // left 90° return bracket
        box('metal', 0.42, 0.16, 0.32, 0.03, 0.086, 0.12, '#c9a44e');      // right 90° return bracket

        // 5. Bartender Service Station (Rear Side): stainless worktop, speed rail with liquor bottles, undercounter cabinet
        box('metal', 0, 0.78, -0.28, 0.88, 0.04, 0.38, '#a2abb3');              // stainless prep surface
        box('metal', 0, 0.72, -0.44, 0.88, 0.12, 0.06, '#8b949c');              // bottle speed rail
        const bcolors = ['#1c3822', '#4a2511', '#281734', '#3d2514', '#152e2a'];
        const bpos = [-0.34, -0.17, 0, 0.17, 0.34];
        for (let i = 0; i < 5; i++) {
          cyl('dark', bpos[i], 0.84, -0.44, 0.045, 0.16, 0.135, bcolors[i]);     // glass bottle body
          cyl('metal', bpos[i], 0.94, -0.44, 0.02, 0.04, 0.06, '#d4af37');       // brass foil capsule
        }
        // Stemware hanging rack under prep counter with true circular goblets
        for (const gx of [-0.26, -0.10, 0.10, 0.26]) {
          box('metal', gx, 0.73, -0.16, 0.012, 0.04, 0.14, '#c9a44e');
          cyl('glass', gx, 0.66, -0.16, 0.043, 0.08, 0.13, '#92bbc0');
        }
        // Undercounter walnut storage cabinets with brushed brass edge pulls
        box('wood', -0.22, 0.36, -0.28, 0.42, 0.52, 0.025, HP.shade(walnut, 0.92));
        box('wood', 0.22, 0.36, -0.28, 0.42, 0.52, 0.025, HP.shade(walnut, 0.92));
        box('metal', -0.05, 0.46, -0.265, 0.015, 0.12, 0.015, '#c9a44e');
        box('metal', 0.05, 0.46, -0.265, 0.015, 0.12, 0.015, '#c9a44e');
      } else if (/counter3|counterlong/.test(t)) {
        // Modern Minimal Counter Long (3 bays: 3-drawer stack + 2 double cabinets)
        box('dark', 0, 0.035, 0.04, 0.98, 0.07, 0.88, '#1e2226');
        box('wood', 0, 0.48, 0, 0.98, 0.82, 0.92, color);
        box('ceramic', 0, 0.935, 0.01, 0.995, 0.07, 0.98, '#fafaf8');
        box('dark', 0, 0.885, 0.455, 0.98, 0.03, 0.03, '#22252a');
        box('wood', -0.325, 0.77, 0.465, 0.31, 0.18, 0.025, color);
        box('wood', -0.325, 0.52, 0.465, 0.31, 0.26, 0.025, color);
        box('wood', -0.325, 0.23, 0.465, 0.31, 0.26, 0.025, color);
        box('metal', -0.325, 0.85, 0.475, 0.22, 0.015, 0.015, '#c5ccd2', true);
        box('metal', -0.325, 0.64, 0.475, 0.22, 0.015, 0.015, '#c5ccd2', true);
        box('metal', -0.325, 0.35, 0.475, 0.22, 0.015, 0.015, '#c5ccd2', true);
        for (const bx of [-0.08, 0.08, 0.245, 0.405]) {
          box('wood', bx, 0.48, 0.465, 0.155, 0.77, 0.025, color);
          box('metal', bx > 0 ? (bx === 0.08 ? 0.02 : 0.46) : -0.02, 0.84, 0.475, 0.015, 0.12, 0.015, '#c5ccd2', true);
        }
      } else if (/counter/.test(t)) {
        // Modern Minimal Counter (2 bays: cutlery drawers + lower cabinets)
        box('dark', 0, 0.035, 0.04, 0.96, 0.07, 0.88, '#1e2226');
        box('wood', 0, 0.48, 0, 0.96, 0.82, 0.92, color);
        box('ceramic', 0, 0.935, 0.01, 0.99, 0.07, 0.98, '#fafaf8');
        box('dark', 0, 0.885, 0.455, 0.96, 0.03, 0.03, '#22252a');
        for (const sx of [-0.24, 0.24]) {
          box('wood', sx, 0.75, 0.465, 0.465, 0.22, 0.025, color);
          box('metal', sx, 0.855, 0.475, 0.32, 0.015, 0.015, '#c5ccd2', true);
          box('wood', sx, 0.35, 0.465, 0.465, 0.51, 0.025, color);
          box('metal', sx, 0.595, 0.475, 0.32, 0.015, 0.015, '#c5ccd2', true);
        }
      } else if (/pantry/.test(t)) {
        // Tall Modern Pantry Cabinet (full height + vertical architectural handles)
        box('dark', 0, 0.025, 0.02, 0.96, 0.05, 0.9, '#1a1d20');
        box('wood', 0, 0.51, -0.02, 0.96, 0.92, 0.92, color);
        box('wood', 0, 0.985, 0, 0.98, 0.03, 0.94, HP.shade(color, 0.92));
        box('wood', -0.24, 0.505, 0.46, 0.46, 0.90, 0.025, color);
        box('wood', 0.24, 0.505, 0.46, 0.46, 0.90, 0.025, color);
        box('dark', 0, 0.505, 0.445, 0.02, 0.90, 0.02, '#1e2124');
        box('metal', -0.05, 0.50, 0.49, 0.02, 0.32, 0.02, '#3a3f47', true);
        box('metal', 0.05, 0.50, 0.49, 0.02, 0.32, 0.02, '#3a3f47', true);
      } else if (/kitcart|kitchencart/.test(t)) {
        // Mobile Kitchen Cart (solid butcher block + legs with casters + towel rail)
        for (const cx of [-0.40, 0.40]) for (const cz of [-0.36, 0.36]) {
          box('metal', cx, 0.06, cz, 0.04, 0.06, 0.04, '#3a3f47');
          cyl('dark', cx, 0.03, cz, 0.06, 0.03, 0.06, '#181a1d');
          box('metal', cx, 0.50, cz, 0.05, 0.88, 0.05, '#454b52');
        }
        box('wood', 0, 0.94, 0, 0.96, 0.10, 0.96, '#b88d5c');
        box('wood', 0, 0.83, 0.36, 0.72, 0.11, 0.04, color);
        box('metal', 0, 0.83, 0.39, 0.22, 0.02, 0.02, '#c5ccd2', true);
        box('wood', 0, 0.55, 0, 0.82, 0.03, 0.76, color);
        for (let i = -3; i <= 3; i++)
          box('wood', i * 0.11, 0.57, 0, 0.03, 0.02, 0.72, HP.shade(color, 0.9));
        box('wood', 0, 0.22, 0, 0.82, 0.03, 0.76, color);
        cyl('metal', 0.50, 0.88, 0, 0.025, 0.76, 0.025, '#cdd4da', true);
        box('metal', 0.45, 0.88, -0.32, 0.08, 0.025, 0.025, '#8a949e', true);
        box('metal', 0.45, 0.88, 0.32, 0.08, 0.025, 0.025, '#8a949e', true);
        box('fabric', 0.51, 0.76, 0.05, 0.02, 0.22, 0.32, '#f4efe6', true);
      } else if (/^(?:bathtub|jacuzzi|soaking.*tub)$/i.test(t) || /^bath$/i.test(t)) {
        box('ceramic', 0, 0.45, 0, 0.96, 0.85, 0.96);
        box('water', 0, 0.89, 0, 0.74, 0.025, 0.8);
        box('metal', 0, 1, -0.4, 0.13, 0.12, 0.08);
      } else if (/trashbin|bin\b/.test(t)) {
        // Luxury Rectangular Step Can (Brushed stainless steel, soft-close recessed lid, bag liner clamp rim, wide cantilever foot pedal)
        // 1. Non-skid black base collar
        box('dark', 0, 0.03, 0, 0.62, 0.06, 0.48, '#111418');
        // 2. Main canister body in brushed satin stainless steel
        box('metal', 0, 0.48, 0, 0.60, 0.86, 0.46, color || '#d4dade');
        for (const sx of [-0.29, 0.29])
          box('metal', sx, 0.48, 0, 0.02, 0.84, 0.44, HP.shade(color || '#d4dade', 0.95), true);
        // 3. Liner Rim that conceals the liner bag
        box('metal', 0, 0.90, 0, 0.63, 0.05, 0.49, HP.shade(color || '#d4dade', 1.03));
        box('dark', 0, 0.915, 0, 0.60, 0.015, 0.46, '#181b20');
        // 4. Flat recessed soft-close lid
        box('metal', 0, 0.94, -0.01, 0.58, 0.035, 0.44, '#e2e8f0');
        box('metal', 0, 0.94, 0.19, 0.12, 0.01, 0.02, '#94a3b8', true);
        box('dark', 0, 0.86, -0.245, 0.28, 0.12, 0.04, '#1b1f24');
        // 5. Wide Heavy-Duty Cantilever Step Pedal
        box('dark', 0, 0.05, 0.26, 0.42, 0.025, 0.12, '#1b1f24', true);
        box('metal', 0, 0.075, 0.28, 0.38, 0.03, 0.10, '#f1f5f9', true);
        for (let ri = -1; ri <= 1; ri++)
          box('dark', ri * 0.10, 0.092, 0.28, 0.05, 0.008, 0.08, '#181b20', true);
      } else if (/car$|vehicle/.test(t)) {
        // Modern Aerodynamic Vehicle Model (Alloy wheels, sloping roof, LED lights)
        const vCol = color || '#2563eb';
        for (const sx of [-0.44, 0.44]) {
          for (const sz of [-0.27, 0.27]) {
            cylX('dark', sx, 0.22, sz, 0.09, 0.44, 0.10, '#181b20');
            cylX('metal', sx > 0 ? sx + 0.015 : sx - 0.015, 0.22, sz, 0.07, 0.30, 0.07, '#e2e8f0', true);
          }
        }
        part('shadow', 'dark', 0, 0.01, 0, 0.88, 1, 0.94, '#090a0f');
        box('ceramic', 0, 0.32, 0, 0.86, 0.22, 0.94, vCol);
        box('ceramic', 0, 0.28, -0.46, 0.84, 0.22, 0.08, vCol);
        box('ceramic', 0, 0.28, 0.46, 0.84, 0.22, 0.08, vCol);
        box('ceramic', 0, 0.70, 0.04, 0.70, 0.04, 0.40, vCol);
        box('glass', 0, 0.56, -0.12, 0.68, 0.24, 0.12, '#38bdf8');
        box('glass', 0, 0.56, 0.22, 0.68, 0.24, 0.12, '#38bdf8');
        box('glow', -0.32, 0.34, -0.495, 0.16, 0.08, 0.02, '#ffffff');
        box('glow', 0.32, 0.34, -0.495, 0.16, 0.08, 0.02, '#ffffff');
        box('glow', 0, 0.42, 0.485, 0.80, 0.06, 0.02, '#ef4444');
      } else if (/stairs/.test(t)) {
        // Architectural Hardwood Open/Closed Staircase (capped cleanly below Floor 2 landing slab)
        const woodCol = color || '#a06a38';
        // 1. Dual side structural stringers along Y and Z (stop at y=0.945 < 73px so zero floor poke-through!)
        for (const sx of [-0.47, 0.47]) {
          boxSlope('wood', sx, 0.04, -0.45, sx, 0.945, 0.44, 0.05, 0.05, HP.shade(woodCol, 0.85));
        }
        // 2. 8 Individual hardwood step treads & vertical risers nested strictly inside stringers
        for (let j = 0; j < 8; j++) {
          const ty = (j + 1) * 0.118;
          const tz = -0.42 + j * 0.118;
          box('wood', 0, ty, tz + 0.01, 0.88, 0.032, 0.135, woodCol);
          box('ceramic', 0, ty - 0.055, tz - 0.045, 0.88, 0.086, 0.018, '#f8fafc');
          box('wood', 0, (ty - 0.06) / 2, tz, 0.84, ty - 0.06, 0.105, HP.shade(woodCol, 0.75));
        }
        // 3. Modern architectural black iron balustrade & continuous oak handrail (along right edge)
        boxSlope('wood', 0.46, 0.46, -0.45, 0.46, 1.35, 0.44, 0.04, 0.05, woodCol); // smooth handrail
        for (let b = 0; b < 8; b++) {
          const by = (b + 1) * 0.118 + 0.19;
          const bz = -0.42 + b * 0.118;
          cyl('metal', 0.46, by, bz, 0.015, 0.36, 0.015, '#1e293b'); // vertical baluster spindle
        }
      } else if (/pergola/.test(t)) {
        // Modern Cedar & Timber Slat Outdoor Pergola with Header Beams & Open Louvers
        const woodCol = color || '#8c5835';
        const beamCol = HP.shade(woodCol, 0.85);
        // 1. Four corner posts with plinth boots
        for (const sx of [-0.46, 0.46]) {
          for (const sz of [-0.46, 0.46]) {
            box('wood', sx, 0.48, sz, 0.06, 0.96, 0.06, woodCol);
            box('metal', sx, 0.02, sz, 0.08, 0.04, 0.08, '#334155', true);
            box('wood', sx, 0.94, sz, 0.08, 0.04, 0.08, beamCol);
          }
        }
        // 2. Dual main longitudinal support beams along Z
        for (const sx of [-0.46, 0.46]) {
          box('wood', sx, 0.96, 0, 0.05, 0.06, 0.98, beamCol);
        }
        // 3. 7 Open transverse timber rafters / louvers along X with classic angled ends
        for (let j = 0; j < 7; j++) {
          const rz = -0.44 + j * 0.146;
          box('wood', 0, 0.99, rz, 0.98, 0.05, 0.025, woodCol);
        }
      } else if (/porch/.test(t)) {
        // Classical Craftsman Covered Porch Soffit with Columns & Fascia
        const trimCol = color || '#f8fafc';
        const ceilingCol = '#cbe3eb';
        for (const sx of [-0.45, 0.45]) {
          box('wood', sx, 0.12, 0.44, 0.08, 0.24, 0.08, trimCol);
          box('wood', sx, 0.56, 0.44, 0.06, 0.64, 0.06, trimCol);
          box('wood', sx, 0.91, 0.44, 0.08, 0.06, 0.08, trimCol);
        }
        box('wood', 0, 0.95, 0, 0.96, 0.02, 0.94, ceilingCol);
        for (const sx of [-0.47, 0.47]) box('wood', sx, 0.97, 0, 0.03, 0.06, 0.96, trimCol);
        box('wood', 0, 0.97, 0.46, 0.96, 0.06, 0.03, trimCol);
        box('stone', 0, 0.99, 0, 0.98, 0.02, 0.96, '#475569');
      } else if (/canopy_glass/.test(t)) {
        // Modern Steel & Tempered Laminated Glass Canopy
        const steelCol = color || '#1e293b';
        for (const sx of [-0.46, 0.46]) {
          for (const sz of [-0.46, 0.46]) {
            cyl('metal', sx, 0.48, sz, 0.02, 0.96, 0.02, steelCol, true);
          }
        }
        for (const sx of [-0.46, 0.46]) box('metal', sx, 0.96, 0, 0.03, 0.03, 0.94, steelCol, true);
        for (const sz of [-0.46, 0.46]) box('metal', 0, 0.96, sz, 0.94, 0.03, 0.03, steelCol, true);
        box('metal', 0, 0.96, 0, 0.92, 0.025, 0.025, steelCol, true);
        box('metal', 0, 0.96, 0, 0.025, 0.025, 0.92, steelCol, true);
        box('glass', 0, 0.975, 0, 0.95, 0.015, 0.95, '#bfe3ea');
      } else if (/awning_metal/.test(t)) {
        // Architectural Industrial Corrugated Metal Awning with Wall Brackets
        const metalCol = color || '#475569';
        boxSlope('metal', 0, 0.95, -0.46, 0, 0.82, 0.46, 0.96, 0.03, metalCol);
        for (const sx of [-0.44, 0.44]) {
          boxSlope('metal', sx, 0.65, -0.44, sx, 0.85, 0.42, 0.02, 0.02, '#1e293b');
        }
      } else if (/^archway/.test(t)) {
        // Architectural Cased Walkthrough Archway (Matches the connecting wall's material & color: plaster, brick, tile, stone, concrete, etc.)
        const lvl = itemLvl();
        const lvlWalls = (lvl && lvl.walls) || {};

        // If an archway item is placed directly over an existing door opening, world3d builds the unified
        // architectural arched door frame and authentic leaves — skip duplicate frame to prevent z-fighting & clipping
        const isHArch = (rot === 0 || rot === 2);
        let hasDoorUnderneath = false;
        if (isHArch) {
          for (let cx = f.x; cx < f.x + f.w; cx++) {
            if ((lvlWalls[`h,${cx},${f.y}`] && lvlWalls[`h,${cx},${f.y}`].f === 'door') ||
                (lvlWalls[`h,${cx},${f.y + 1}`] && lvlWalls[`h,${cx},${f.y + 1}`].f === 'door')) {
              hasDoorUnderneath = true; break;
            }
          }
        } else {
          for (let cy = f.y; cy < f.y + f.h; cy++) {
            if ((lvlWalls[`v,${f.x},${cy}`] && lvlWalls[`v,${f.x},${cy}`].f === 'door') ||
                (lvlWalls[`v,${f.x + 1},${cy}`] && lvlWalls[`v,${f.x + 1},${cy}`].f === 'door')) {
              hasDoorUnderneath = true; break;
            }
          }
        }
        if (hasDoorUnderneath) {
          return;
        }

        let neighborWall = it._neighborWall || null;

        if (!neighborWall) {
          const isHoriz = (rot === 0 || rot === 2);
          const checkKeys = isHoriz
            ? [`h,${f.x - 1},${f.y}`, `h,${f.x + f.w},${f.y}`, `h,${f.x - 1},${f.y + 1}`, `h,${f.x + f.w},${f.y + 1}`, `v,${f.x},${f.y}`, `v,${f.x},${f.y - 1}`, `v,${f.x + f.w},${f.y}`, `v,${f.x + f.w},${f.y - 1}`]
            : [`v,${f.x},${f.y - 1}`, `v,${f.x},${f.y + f.h}`, `v,${f.x + 1},${f.y - 1}`, `v,${f.x + 1},${f.y + f.h}`, `h,${f.x},${f.y}`, `h,${f.x - 1},${f.y}`, `h,${f.x},${f.y + f.h}`, `h,${f.x - 1},${f.y + f.h}`];
          for (const k of checkKeys) {
            if (lvlWalls[k]) { neighborWall = lvlWalls[k]; break; }
          }
        }
        if (!neighborWall) {
          for (let cx = f.x - 1; cx <= f.x + f.w; cx++) {
            for (let cy = f.y - 1; cy <= f.y + f.h; cy++) {
              const wh = lvlWalls[`h,${cx},${cy}`], wv = lvlWalls[`v,${cx},${cy}`];
              if (wh) { neighborWall = wh; break; }
              if (wv) { neighborWall = wv; break; }
            }
            if (neighborWall) break;
          }
        }
        if (!neighborWall) {
          let minD = 999;
          const fcx = f.x + f.w / 2, fcy = f.y + f.h / 2;
          for (const wk in lvlWalls) {
            const wObj = lvlWalls[wk];
            if (!wObj) continue;
            const parts = wk.split(',');
            const wd = parts[0], wx = parseFloat(parts[1]), wy = parseFloat(parts[2]);
            const wmx = wd === 'h' ? wx + 0.5 : wx;
            const wmy = wd === 'h' ? wy : wy + 0.5;
            const d = Math.hypot(wmx - fcx, wmy - fcy);
            if (d < minD) {
              minD = d;
              if (d <= 4.0) neighborWall = wObj;
            }
          }
        }

        const vIdx = it.v || 0;
        let matKind = 'plaster';
        let wallCol = '#f4efe4';

        if (vIdx === 0) {
          // Auto: match touching wall
          const st = (neighborWall && neighborWall.style) || HP.wallStyle || 'plaster';
          matKind = (st === 'brick' || st === 'brick_white' || st === 'stone' || st === 'tile' || st === 'concrete' || st === 'wood' || st === 'shiplap' || st === 'marble') ? st : 'plaster';
          const isExt = neighborWall && neighborWall.ext;
          const sDefC = (matKind === 'brick' || matKind === 'brick_white' || matKind === 'stone' || matKind === 'tile' || matKind === 'concrete' || matKind === 'marble' || matKind === 'wood' || matKind === 'shiplap') ? '#ffffff' : (isExt ? '#e9e2d2' : '#f4efe4');
          const nCol = neighborWall && (neighborWall.ca || neighborWall.cb);
          wallCol = nCol || sDefC;
          if (it.colors && it.colors[0] && it.colors[0] !== '#ffffff') {
            wallCol = it.colors[0];
          }
        } else if (vIdx === 1) {
          matKind = 'plaster'; wallCol = (it.colors && it.colors[0] && it.colors[0] !== '#ffffff') ? it.colors[0] : '#f4efe4';
        } else if (vIdx === 2) {
          matKind = 'brick'; wallCol = (it.colors && it.colors[0] && it.colors[0] !== '#ffffff') ? it.colors[0] : '#ffffff';
        } else if (vIdx === 3) {
          matKind = 'brick_white'; wallCol = (it.colors && it.colors[0] && it.colors[0] !== '#ffffff') ? it.colors[0] : '#ffffff';
        } else if (vIdx === 4) {
          matKind = 'stone'; wallCol = (it.colors && it.colors[0] && it.colors[0] !== '#ffffff') ? it.colors[0] : '#ffffff';
        } else if (vIdx === 5) {
          matKind = 'tile'; wallCol = (it.colors && it.colors[0] && it.colors[0] !== '#ffffff') ? it.colors[0] : '#ffffff';
        } else if (vIdx === 6) {
          matKind = 'concrete'; wallCol = (it.colors && it.colors[0] && it.colors[0] !== '#ffffff') ? it.colors[0] : '#ffffff';
        } else if (vIdx === 7) {
          matKind = 'wood'; wallCol = (it.colors && it.colors[0] && it.colors[0] !== '#ffffff') ? it.colors[0] : '#ffffff';
        }

        let wallMat = null;
        if (HP.world3d && HP.world3d.getWallMat) {
          wallMat = HP.world3d.getWallMat(matKind);
        } else if (HP.graphics3d) {
          wallMat = HP.graphics3d.worldUV(HP.graphics3d.material(matKind).clone(), (HP.CELL || 28) * 2);
          HP.graphics3d.track(wallMat);
        }

        const trimKind = matKind;
        const trimCol = wallCol;
        const darkTrim = wallCol;

        const wallThickPx = it._wallThickPx || 8.4;
        const depthPx = depth || (HP.CELL || 28);
        const wallThick = wallThickPx / depthPx;
        const casingTPx = 0.32;
        const casingThick = casingTPx / depthPx;
        const trimThick = (wallThickPx + casingTPx * 2) / depthPx;
        const isArch1 = /archway1/.test(t);
        const isArch3 = /archway3/.test(t);
        const pw = isArch1 ? 0.10 : (isArch3 ? 0.08 : 0.10);
        const R = 0.5 - pw;
        const R_px = R * (width || (f.w * (HP.CELL || 28)));
        const h_total = height || 74;
        const cy_px = 43.5;
        let y_top_px;
        if (isArch1) {
          y_top_px = 65;
        } else if (isArch3) {
          y_top_px = 67.5;
        } else {
          y_top_px = 66;
        }
        const y_top = y_top_px / h_total;
        const cy = cy_px / h_total;
        const rise = y_top - cy;

        // 1. Classical Side Pilaster Columns & 3-Tier Impost Capitals
        for (const sx of [-0.5 + pw / 2, 0.5 - pw / 2]) {
          // Plinth Base Block
          box(trimKind, sx, 0.025, 0, pw + 0.020, 0.05, trimThick + 0.012, trimCol, false, wallMat);
          // Base Torus / Fillet molding
          box(trimKind, sx, 0.056, 0, pw + 0.012, 0.014, trimThick + 0.006, trimCol, false, wallMat);
          // Pilaster Shaft
          const shaftH = (cy - 0.045) - 0.063;
          const shaftY = 0.063 + shaftH / 2;
          box(matKind, sx, shaftY, 0, pw, shaftH, wallThick, wallCol, false, wallMat);
          // Front & back vertical casing trim along pilaster
          box(trimKind, sx, shaftY, wallThick / 2 + casingThick / 2, pw * 0.82, shaftH, casingThick, trimCol, false, wallMat);
          box(trimKind, sx, shaftY, -(wallThick / 2 + casingThick / 2), pw * 0.82, shaftH, casingThick, trimCol, false, wallMat);
          // Classical 3-Tier Impost Capital Molding at springing line
          box(trimKind, sx, cy - 0.038, 0, pw + 0.014, 0.014, trimThick + 0.010, trimCol, false, wallMat);
          box(trimKind, sx, cy - 0.020, 0, pw + 0.024, 0.022, trimThick + 0.018, trimCol, false, wallMat);
          box(trimKind, sx, cy - 0.005, 0, pw + 0.032, 0.012, trimThick + 0.026, trimCol, false, wallMat);
          // Wall fill directly above pilasters on left & right
          box(matKind, sx, cy + rise / 2, 0, pw, rise, wallThick, wallCol, false, wallMat);
        }

        // 2. Seamless Radial Arch Vault & Spandrels
        part('archTop', matKind, 0, cy + rise / 2, 0, 2 * R, rise, wallThick, wallCol, false, wallMat);

        // 3. Arched Archivolt Casings (Front & Back)
        part('archCasing', trimKind, 0, cy + rise / 2, wallThick / 2 + casingThick / 2, 2 * R, rise, casingThick, trimCol, false, wallMat);
        part('archCasing', trimKind, 0, cy + rise / 2, -(wallThick / 2 + casingThick / 2), 2 * R, rise, casingThick, trimCol, false, wallMat);

        // 4. Classical Wedge-Shaped Keystone (Voussoir at Apex)
        const kH = Math.min(0.065, rise * 0.45);
        const kY = y_top + kH * 0.32;
        const kW = pw * 0.88;
        part('keystone', trimKind, 0, kY, 0, kW, kH, trimThick + 0.018, trimCol, false, wallMat);
        part('keystone', trimKind, 0, kY, 0, kW * 0.72, kH * 0.82, trimThick + 0.032, darkTrim, false, wallMat);

        // 5. Header Frieze Beam & Ceiling Crown Molding
        const beamH = 1.0 - y_top;
        box(matKind, 0, (y_top + 1.0) / 2, 0, 1.0, beamH, wallThick, wallCol, false, wallMat);
        // Continuous horizontal frieze fillet
        box(trimKind, 0, Math.min(0.962, y_top + 0.02), 0, 1.0, 0.012, trimThick + 0.006, trimCol, false, wallMat);
        // Continuous crowning cornice molding
        box(trimKind, 0, 0.985, 0, 1.0, 0.030, trimThick + 0.018, trimCol, false, wallMat);
      } else if (/sunsail/.test(t)) {
        // Architectural Triangular/Quad Tensioned Fabric Sun Sail Shade
        const fabricCol = color || '#f8fafc';
        for (const [sx, sz, my] of [[-0.46, -0.46, 0.96], [0.46, -0.46, 0.88], [0.46, 0.46, 0.84], [-0.46, 0.46, 0.92]]) {
          cyl('metal', sx, my / 2, sz, 0.02, my, 0.02, '#94a3b8', true);
          box('metal', sx, 0.015, sz, 0.06, 0.03, 0.06, '#64748b', true);
        }
        boxSlope('fabric', 0, 0.92, -0.38, 0, 0.84, 0.38, 0.86, 0.015, fabricCol);
      } else if (/aquarium/.test(t)) {
        // Luxury Rimless Glass Living Aquarium (zero overlapping coplanar faces / z-fighting)
        // 1. Minimalist matte black cabinet credenza with recessed shadow plinth + proud front wood doors
        box('dark', 0, 0.03, 0, 0.88, 0.06, 0.82, '#15171a'); // shadow plinth
        box('dark', 0, 0.28, -0.01, 0.92, 0.44, 0.84, '#1e2124'); // main cabinet body
        box('wood', -0.22, 0.28, 0.422, 0.43, 0.40, 0.02, color);     // left wood door front
        box('wood', 0.22, 0.28, 0.422, 0.43, 0.40, 0.02, color);      // right wood door front
        box('metal', -0.03, 0.28, 0.436, 0.012, 0.16, 0.015, '#c9a44e', true); // brass vertical pulls
        box('metal', 0.03, 0.28, 0.436, 0.012, 0.16, 0.015, '#c9a44e', true);

        // 2. Ultra-Clear Low-Iron Rimless Glass Tank (outer tank walls strictly enclosing inner volumes)
        box('glass', 0, 0.74, 0, 0.94, 0.48, 0.86, '#a4d4dc'); // outer crystal glass walls (y=0.50..0.98)
        // Inner translucent water volume (strictly inset above sand y=0.55..0.92)
        box('glass', 0, 0.735, 0, 0.87, 0.37, 0.79, '#d4f4fa');
        // Thin rippling water surface on top (y=0.928)
        box('water', 0, 0.928, 0, 0.87, 0.014, 0.79);

        // 3. Natural Aquascaping: Inset sand bed (y=0.505..0.545, zero coplanar face with glass!)
        box('soil', 0, 0.525, 0, 0.86, 0.04, 0.78, '#eadecc');   // white river sand bed
        box('soil', -0.15, 0.550, 0.08, 0.34, 0.018, 0.26, '#ded0be'); // undulating sand dunes
        box('soil', 0.18, 0.548, -0.10, 0.28, 0.016, 0.22, '#d5c4ae');

        // Smooth river stones at the base of the driftwood
        round('stone', -0.16, 0.55, 0.06, 0.08, 0.04, 0.08, '#484b52');
        round('stone', 0.06, 0.55, -0.06, 0.09, 0.04, 0.07, '#383a40');
        round('stone', 0.16, 0.545, 0.10, 0.07, 0.035, 0.06, '#5a5d66');

        // Sculptural natural driftwood trunk & branch fork
        cyl('wood', -0.10, 0.65, 0.05, 0.04, 0.24, 0.04, '#3d2516'); // driftwood trunk
        cyl('wood', 0.05, 0.70, -0.05, 0.03, 0.20, 0.03, '#4a2d1a'); // branch fork
        // Lush green aquatic stem plants
        for (const [px, pz] of [[-0.28, -0.22], [-0.22, -0.26], [0.26, -0.22], [0.22, -0.26]]) {
          cyl('foliage', px, 0.64, pz, 0.06, 0.20, 0.06, '#388040');
        }

        // 4. Sleek Cantilevered Overhead LED Lighting Pendant
        box('metal', -0.38, 0.78, -0.42, 0.02, 0.44, 0.02, '#15171a');        // vertical mounting arm
        box('metal', 0, 0.98, -0.15, 0.76, 0.02, 0.05, '#15171a');            // horizontal fixture bar
        box('glow', 0, 0.97, -0.15, 0.72, 0.015, 0.04, '#e0f4ff');            // clean daylight LED strip

      } else if (/fireplace/.test(t)) {
        // Modern Architectural Hearth & Open Fireplace (scaled for h=52, chimney reaches 74px ceiling!)
        const ys = 32 / 52; // preserve waist-high hearth/mantel proportions while chimney rises to ceiling
        // 1. Floating Low-Profile Honed Slate Hearth Plinth
        box('dark', 0, 0.03 * ys, 0.06, 0.96, 0.05 * ys, 0.78, '#15171a');
        box('ceramic', 0, 0.08 * ys, 0.08, 1.0, 0.06 * ys, 0.82, '#282a2d');

        // 2. Open Architectural Firebox Surround
        box('stone', -0.38, 0.38 * ys, 0.04, 0.20, 0.54 * ys, 0.68, color);
        box('stone', 0.38, 0.38 * ys, 0.04, 0.20, 0.54 * ys, 0.68, color);
        box('stone', 0, 0.58 * ys, 0.04, 0.56, 0.14 * ys, 0.68, color);

        // 3. Recessed Refractory Firebox Chamber
        box('dark', 0, 0.36 * ys, -0.24, 0.56, 0.46 * ys, 0.08, '#131518');
        box('dark', -0.27, 0.36 * ys, 0.02, 0.02, 0.46 * ys, 0.44, '#131518');
        box('dark', 0.27, 0.36 * ys, 0.02, 0.02, 0.46 * ys, 0.44, '#131518');
        box('dark', 0, 0.11 * ys, 0.02, 0.56, 0.02 * ys, 0.44, '#181b1e');

        // 4. Heavy Cast Iron Fire Basket Grate & Glowing Ember Bed
        box('metal', 0, 0.15 * ys, 0.06, 0.42, 0.04 * ys, 0.24, '#181b1e', true);
        for (let g = -0.16; g <= 0.16; g += 0.08) {
          box('metal', g, 0.20 * ys, 0.17, 0.016, 0.08 * ys, 0.016, '#181b1e', true);
        }
        box('glow', 0, 0.165 * ys, 0.06, 0.38, 0.03 * ys, 0.20, '#ff5a18');

        // 5. Realistic Horizontal Split Birch & Oak Logs Lying on the Grate
        cylX('wood', -0.03, 0.21 * ys, 0.04, 0.30, 0.045, 0.045, '#d8d2c4');
        cylX('wood',  0.04, 0.21 * ys, 0.10, 0.28, 0.045, 0.045, '#3a2718');
        boxRot('wood', 0, 0.255 * ys, 0.07, 0.26, 0.04 * ys, 0.045, 0.28, '#d8d2c4');

        // 6. Minimalist Floating Honed Limestone Mantel Shelf & Styling
        box('ceramic', 0, 0.68 * ys, 0.06, 1.04, 0.045 * ys, 0.74, HP.shade(color, 1.15));
        cyl('metal', -0.28, 0.76 * ys, 0.08, 0.08, 0.09 * ys, 0.08, '#c9a44e', true);
        cyl('dark', -0.28, 0.76 * ys, 0.12, 0.06, 0.01 * ys, 0.06, '#121416');
        cyl('ceramic', 0.28, 0.77 * ys, 0.08, 0.05, 0.13 * ys, 0.05, '#fafaf8');
        cyl('foliage', 0.28, 0.86 * ys, 0.08, 0.015, 0.09 * ys, 0.015, '#486834');

        // 7. Full-Height Architectural Chimney Breast Rising Cleanly to 74px Ceiling
        box('stone', 0, 0.93, -0.06, 0.84, 0.99, 0.50, color);

      } else if (/tvwall|tv.*wall/.test(t)) {
        // Grand 5-Cell Entertainment Media Wall (Vertical acoustic timber slats, 75" 4K OLED screen, floating walnut credenza, LED illuminated display shelving)
        // 1. Full-Height Acoustic Timber Slat Feature Wall Panel (Spanning the full 5-cell width, 52px height)
        box('dark', 0, 0.50, -0.42, 0.98, 1.0, 0.04, '#15171a'); // dark acoustic felt backer
        // 20 individual vertical relief timber slats
        for (let i = 0; i < 20; i++) {
          const sx = -0.46 + i * (0.92 / 19);
          box('wood', sx, 0.50, -0.40, 0.022, 1.0, 0.025, HP.shade(color, 1.08));
        }

        // 2. Floating Lowline Walnut Credenza with Shadow Reveal Toe-Kick
        box('dark', 0, 0.10, -0.12, 0.88, 0.04, 0.48, '#121416');              // recessed shadow reveal
        box('wood', 0, 0.22, -0.12, 0.92, 0.20, 0.52, color);                  // walnut credenza carcass
        // 4 soft-close drop-down cabinet doors with brass finger pulls
        for (let d = 0; d < 4; d++) {
          const dx = -0.33 + d * 0.22;
          box('wood', dx, 0.22, 0.145, 0.21, 0.18, 0.015, HP.shade(color, 0.94));
          box('metal', dx, 0.29, 0.155, 0.06, 0.012, 0.015, '#c9a44e', true);
        }

        // 3. Ultra-Slim 85" 4K OLED Cinema Display (Floating centered on the slatted feature wall)
        box('metal', 0, 0.64, -0.37, 0.80, 0.50, 0.02, '#15171a');             // slim bezel frame
        box('dark', 0, 0.64, -0.355, 0.77, 0.47, 0.01, '#08090a');             // deep OLED black screen
        // Sleek matching metallic soundbar mounted right beneath the screen
        box('metal', 0, 0.36, -0.35, 0.64, 0.04, 0.04, '#1c1f24');
        box('dark', 0, 0.36, -0.33, 0.62, 0.03, 0.01, '#0f172a');

        // 4. Floating Display Shelving with Warm LED Cove Lighting on the Left & Right Flanks
        for (const side of [-0.38, 0.38]) {
          for (const sy of [0.52, 0.72, 0.90]) {
            box('wood', side, sy, -0.28, 0.18, 0.025, 0.24, HP.shade(color, 1.15)); // floating shelf slab
            box('glow', side, sy - 0.015, -0.28, 0.16, 0.01, 0.20, '#ffe4b0');      // warm LED cove glow
          }
          // Curated decor: sculptural ceramic vases and hardcover art books
          cyl('ceramic', side, 0.58, -0.28, 0.05, 0.09, 0.05, '#fafaf8');
          box('fabric', side, 0.77, -0.28, 0.08, 0.07, 0.16, '#9c5a3c');
          cyl('metal', side, 0.95, -0.28, 0.04, 0.07, 0.04, '#c9a44e', true);
        }
      } else if (/^tvstand$|tv.*stand|media.*console/.test(t)) {
        // Modern Lowline Media Console with Ultra-Thin 65-inch 16:9 OLED TV and Dolby Atmos Soundbar
        // 1. Six minimalist dark steel blade legs
        for (const lx of [-0.42, 0, 0.42]) for (const lz of [-0.34, 0.34])
          box('dark', lx, 0.05, lz, 0.02, 0.10, 0.02, '#181b1e');
        // 2. Main credenza cabinet in natural oak/walnut with fluted sliding tambour panels
        box('wood', 0, 0.24, 0, 0.94, 0.26, 0.84, color);
        box('dark', 0, 0.375, 0, 0.92, 0.01, 0.82, '#15171a');
        for (const dx of [-0.30, 0, 0.30]) {
          box('wood', dx, 0.24, 0.43, 0.28, 0.24, 0.02, HP.shade(color, 1.03));
          box('metal', dx, 0.32, 0.445, 0.12, 0.015, 0.012, '#c9a44e', true);
        }
        // 3. Dolby Atmos slim soundbar sitting on credenza top
        box('dark', 0, 0.405, 0.20, 0.46, 0.04, 0.12, '#222730');
        box('metal', 0, 0.405, 0.261, 0.44, 0.028, 0.006, '#3b4250', true);
        round('glow', 0, 0.405, 0.266, 0.008, 0.008, 0.008, '#60a5fa');
        // 4. Heavy brushed titanium TV pedestal stand (neck tucked behind display panel)
        box('metal', 0, 0.395, -0.05, 0.24, 0.02, 0.20, '#50565e');
        box('dark', 0, 0.47, -0.06, 0.06, 0.14, 0.04, '#1b1d22');
        // 5. Razor-thin 65-inch OLED Display in authentic 16:9 widescreen ratio
        box('dark', 0, 0.70, -0.035, 0.41, 0.52, 0.022, '#20252e');
        box('dark', 0, 0.70, -0.022, 0.395, 0.495, 0.004, '#111620');
      } else if (/^bookshelf$|bookcase|shelving/.test(t)) {
        // Modern Architectural Open Bookcase (Matte black ladder frame, 5 floating oak shelves, asymmetric dividers, curated books & ceramics)
        for (const [lx, lz] of [[-0.45, 0.38], [0.45, 0.38], [-0.45, -0.38], [0.45, -0.38]])
          box('dark', lx, 0.50, lz, 0.025, 1.0, 0.025, '#1b1d22');
        for (const y of [0.08, 0.28, 0.48, 0.68, 0.88])
          box('wood', 0, y, 0, 0.94, 0.03, 0.82, color);
        box('wood', -0.15, 0.38, 0, 0.025, 0.18, 0.78, color);
        box('wood', 0.18, 0.58, 0, 0.025, 0.18, 0.78, color);
        box('wood', -0.22, 0.78, 0, 0.025, 0.18, 0.78, color);
        box('fabric', -0.30, 0.35, 0, 0.18, 0.12, 0.40, '#8a3a3a');
        box('fabric', -0.18, 0.34, 0, 0.08, 0.10, 0.38, '#3a5f8a');
        cyl('ceramic', 0, 0.55, 0, 0.10, 0.12, 0.10, '#ffffff');
        cyl('ceramic', 0.28, 0.74, 0, 0.08, 0.08, 0.08, '#c9b48f');
        round('foliage', 0.28, 0.80, 0, 0.10, 0.08, 0.10, '#60845a');
      } else if (/^floorlamp$/i.test(t)) {
        // Ultra-Realistic Designer Standing Floor Lamp (Heavy Brass Base, Fluted Collar, Linen Drum Shade & Warm Diffuser)
        // 1. Heavy weighted circular plinth base
        cyl('metal', 0, 0.02, 0, 0.44, 0.035, 0.44, '#c9a44e', true);          // polished brass beveled base disc
        cyl('dark', 0, 0.005, 0, 0.40, 0.01, 0.40, '#15171a');                 // neoprene protective foot ring
        cyl('metal', 0, 0.045, 0, 0.12, 0.02, 0.12, '#b8923a', true);          // stepped decorative neck collar
        // 2. Slender seamless brass stanchion with rotary switch
        cyl('metal', 0, 0.42, 0, 0.034, 0.76, 0.034, '#c9a44e', true);         // main vertical brass stem
        box('metal', 0.025, 0.68, 0, 0.03, 0.015, 0.015, '#b8923a', true);     // knurled rotary turn-switch knob
        // 3. Socket cup, spider harp & finial
        cyl('metal', 0, 0.74, 0, 0.065, 0.06, 0.065, '#c9a44e', true);         // brass socket cup
        cyl('glass', 0, 0.78, 0, 0.09, 0.10, 0.09, '#fef08a');                  // LED filament bulb
        cyl('metal', 0, 0.82, 0, 0.012, 0.16, 0.012, '#c9a44e', true);         // spider harp riser
        round('metal', 0, 0.965, 0, 0.04, 0.04, 0.04, '#c9a44e', true);        // brass top finial ball
        // 4. Open-ended tapered linen drum shade (allows warm bulb & glow sleeve to illuminate!)
        part('openCylinder', 'fabric', 0, 0.84, 0, 0.48, 0.31, 0.48, color || '#faf7f2');
        cyl('metal', 0, 0.99, 0, 0.41, 0.012, 0.41, '#c9a44e', true);         // top brass ring trim
        cyl('metal', 0, 0.69, 0, 0.48, 0.012, 0.48, '#c9a44e', true);         // bottom brass ring trim
      } else if (/tv|monitor|screen/.test(t)) {
        // Modern 75-Inch 4K OLED Entertainment Center on Walnut Slatted Credenza
        // 1. Lowline architectural media credenza (y=0 to 0.40)
        box('dark', 0, 0.03, 0, 0.94, 0.06, 0.82, '#15171a');                   // shadow plinth
        box('wood', 0, 0.22, 0, 0.96, 0.34, 0.86, color || '#3e2723');          // credenza carcass
        box('wood', 0, 0.40, 0, 0.98, 0.03, 0.88, HP.shade(color || '#3e2723', 1.08)); // top mantle
        // Slatted acoustic cabinet doors with brass bar pulls
        for (const dx of [-0.30, 0.00, 0.30]) {
          box('wood', dx, 0.22, 0.435, 0.26, 0.30, 0.015, HP.shade(color || '#3e2723', 0.92));
          box('metal', dx + 0.10, 0.22, 0.445, 0.015, 0.10, 0.015, '#c9a44e', true);
        }
        // 2. Heavy brushed titanium TV pedestal stand
        box('metal', 0, 0.42, 0, 0.36, 0.015, 0.24, '#94a3b8', true);           // base plate
        box('metal', 0, 0.52, -0.02, 0.08, 0.20, 0.06, '#64748b', true);        // upright neck
        // 3. Razor-thin 75-inch 16:9 OLED TV Screen (Floating wide display)
        box('dark', 0, 0.74, 0, 0.94, 0.54, 0.025, '#181b1e');                  // titanium bezel
        box('dark', 0, 0.74, 0.014, 0.91, 0.51, 0.005, '#08090b');              // deep true OLED black screen
        // 4. Sleek Dolby Atmos soundbar centered under screen
        box('dark', 0, 0.44, 0.10, 0.62, 0.045, 0.08, '#0f172a');
        box('metal', 0, 0.44, 0.142, 0.60, 0.035, 0.005, '#334155', true);     // acoustic grille
      } else {
        // Architectural fallback: feet, a top and front panels, never a featureless cube.
        cabinet(color);
      }
    },
    finish() {
      /* Static furniture is BAKED: one merged mesh per (material × tile)
         → a room costs ~6–10 draw calls instead of one per part type.
         An item is split out into its own small mesh only the first
         time it's pushed (detach), so physics still moves it.          */
      const byKind = new Map();
      for (const batch of batches.values()) {
        const k = batch.shape === 'shadow' ? 'shadow' : batch.kind + (batch.detail ? ':d' : '');
        if (!byKind.has(k)) byKind.set(k, { kind: batch.kind, shadow: batch.shape === 'shadow',
          detail: batch.detail, parts: [] });
        const targetList = byKind.get(k).parts, geo = geometries[batch.shape];
        for (let i = 0; i < batch.parts.length; i++) {
          const p = batch.parts[i];
          p.geo = geo;
          targetList.push(p);
        }
      }
      const V = HP.cull3d;
      for (const [k, b] of byKind) {
        const mat = b.shadow ? G.contactMaterial() : G.vertexColorMaterial(b.kind, base[b.kind]);
        const tiles = new Map();
        for (const p of b.parts) {
          const t = V.tileOf((p.fp.x0 + p.fp.x1) / 2, (p.fp.z0 + p.fp.z1) / 2);
          if (!tiles.has(t)) tiles.set(t, []);
          tiles.get(t).push(p);
        }
        for (const list of tiles.values()) {
          const { geometry, ranges } = merge(list);
          const mesh = new THREE.Mesh(geometry, mat);
          mesh.castShadow = !b.shadow && !NO_CAST[b.kind];
          mesh.receiveShadow = !b.shadow;
          group.add(mesh);
          let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9, allSmall = true;
          list.forEach((p, i) => {
            x0 = Math.min(x0, p.fp.x0); z0 = Math.min(z0, p.fp.z0);
            x1 = Math.max(x1, p.fp.x1); z1 = Math.max(z1, p.fp.z1);
            if (!p.small) allSmall = false;
            if (!refs.has(p.index)) refs.set(p.index, []);
            refs.get(p.index).push({ mesh, range: ranges[i], part: p, key: k, mat });
          });
          V.add(mesh, x0, z0, x1, z1, { detail: b.detail, far: allSmall ? 1 : 0 });
        }
      }
      for (const k in geometries) geometries[k].dispose();
      const detached = new Map();
      /* pull an item out of its baked meshes into a movable group     */
      function detach(inst) {
        const parts = refs.get(inst) || [], kinds = new Map();
        for (const r of parts) {
          const pos = r.mesh.geometry.attributes.position;
          pos.array.fill(0, r.range[0] * 3, (r.range[0] + r.range[1]) * 3);   // collapse
          pos.needsUpdate = true;
          if (!kinds.has(r.key)) kinds.set(r.key, { mat: r.mat, src: r.mesh, parts: [] });
          kinds.get(r.key).parts.push(r.part);
        }
        const g2 = new THREE.Group();
        for (const kd of kinds.values()) {
          const m = new THREE.Mesh(merge(kd.parts).geometry, kd.mat);
          m.castShadow = kd.src.castShadow; m.receiveShadow = kd.src.receiveShadow;
          g2.add(m);
        }
        group.add(g2);
        detached.set(inst, g2);
        return g2;
      }
      return {
        /* only movers whose position changed since last call           */
        move(movers) {
          for (const m of movers) {
            if (m.visualX === undefined) { m.visualX = m.box.x0; m.visualZ = m.box.z0; }
            if (m.shownX === m.x && m.shownZ === m.z) continue;
            const first = m.shownX === undefined;
            m.shownX = m.x; m.shownZ = m.z;
            const dx = m.x - m.visualX, dz = m.z - m.visualZ;
            if (first && !dx && !dz) continue;            // initial sync: still baked
            const g2 = detached.get(m.inst) || detach(m.inst);
            g2.position.set(dx, 0, dz);
          }
        },
        detach,
        detached,
        batchCount: byKind.size,
      };
    },
    async finishAsync() {
      const byKind = new Map();
      for (const batch of batches.values()) {
        const k = batch.shape === 'shadow' ? 'shadow' : batch.kind + (batch.detail ? ':d' : '');
        if (!byKind.has(k)) byKind.set(k, { kind: batch.kind, shadow: batch.shape === 'shadow',
          detail: batch.detail, parts: [] });
        const targetList = byKind.get(k).parts, geo = geometries[batch.shape];
        for (let i = 0; i < batch.parts.length; i++) {
          const p = batch.parts[i];
          p.geo = geo;
          targetList.push(p);
        }
      }
      const V = HP.cull3d;
      let lastYield = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      for (const [k, b] of byKind) {
        const mat = b.shadow ? G.contactMaterial() : G.vertexColorMaterial(b.kind, base[b.kind]);
        const tiles = new Map();
        for (const p of b.parts) {
          const t = V.tileOf((p.fp.x0 + p.fp.x1) / 2, (p.fp.z0 + p.fp.z1) / 2);
          if (!tiles.has(t)) tiles.set(t, []);
          tiles.get(t).push(p);
        }
        for (const list of tiles.values()) {
          const { geometry, ranges } = merge(list);
          const mesh = new THREE.Mesh(geometry, mat);
          mesh.castShadow = !b.shadow && !NO_CAST[b.kind];
          mesh.receiveShadow = !b.shadow;
          group.add(mesh);
          let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9, allSmall = true;
          list.forEach((p, i) => {
            x0 = Math.min(x0, p.fp.x0); z0 = Math.min(z0, p.fp.z0);
            x1 = Math.max(x1, p.fp.x1); z1 = Math.max(z1, p.fp.z1);
            if (!p.small) allSmall = false;
            if (!refs.has(p.index)) refs.set(p.index, []);
            refs.get(p.index).push({ mesh, range: ranges[i], part: p, key: k, mat });
          });
          V.add(mesh, x0, z0, x1, z1, { detail: b.detail, far: allSmall ? 1 : 0 });
          const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          if (now - lastYield > 6 && typeof requestAnimationFrame !== 'undefined') {
            await new Promise(r => requestAnimationFrame(r));
            lastYield = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          }
        }
      }
      for (const k in geometries) geometries[k].dispose();
      const detached = new Map();
      function detach(inst) {
        const parts = refs.get(inst) || [], kinds = new Map();
        for (const r of parts) {
          const pos = r.mesh.geometry.attributes.position;
          pos.array.fill(0, r.range[0] * 3, (r.range[0] + r.range[1]) * 3);
          pos.needsUpdate = true;
          if (!kinds.has(r.key)) kinds.set(r.key, { mat: r.mat, src: r.mesh, parts: [] });
          kinds.get(r.key).parts.push(r.part);
        }
        const g2 = new THREE.Group();
        for (const kd of kinds.values()) {
          const m = new THREE.Mesh(merge(kd.parts).geometry, kd.mat);
          m.castShadow = kd.src.castShadow; m.receiveShadow = kd.src.receiveShadow;
          g2.add(m);
        }
        group.add(g2);
        detached.set(inst, g2);
        return g2;
      }
      return {
        move(movers) {
          for (const m of movers) {
            if (m.visualX === undefined) { m.visualX = m.box.x0; m.visualZ = m.box.z0; }
            if (m.shownX === m.x && m.shownZ === m.z) continue;
            const first = m.shownX === undefined;
            m.shownX = m.x; m.shownZ = m.z;
            const dx = m.x - m.visualX, dz = m.z - m.visualZ;
            if (first && !dx && !dz) continue;
            const g2 = detached.get(m.inst) || detach(m.inst);
            g2.position.set(dx, 0, dz);
          }
        },
        detach,
        detached,
        batchCount: byKind.size,
      };
    },
  };
};
})();
