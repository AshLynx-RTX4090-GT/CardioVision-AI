// Procedural anatomy (no external mesh required, so it works offline and on CPU-only machines).
// Coordinate system: +x = patient's LEFT, +y = superior, +z = anterior (viewer faces the patient's front).
//
// To add a structure: add an entry to VESSELS (coronary branches) or write another build*() function
// that returns a THREE.Object3D and register it in buildAnatomy(). To use a downloaded .glb heart
// instead, replace buildHeart() with a GLTFLoader result and keep VESSELS (paths are defined on a
// unit-sphere-to-heart mapping, see heartSurface()).
import * as THREE from "three";

export const HEART_POS = new THREE.Vector3(0.35, 0.15, 0.25);
export const HEART_TILT = 0.5; // rad about z: apex points down and to the patient's left

// ------------------------------------------------------------------ heart surface mapping
const A = 1.0, B = 1.25, C = 0.85;
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

/** Maps a direction from the heart centre to a point on the ventricular surface. */
export function heartSurface(dir, out = new THREE.Vector3()) {
  const n = dir.clone().normalize();
  const taper = 1 - 0.55 * Math.pow(smooth(-n.y), 1.2);
  return out.set(A * n.x * taper, B * n.y, C * n.z * taper);
}
const onHeart = (d, lift = 1.025) => heartSurface(new THREE.Vector3(...d)).multiplyScalar(lift);

// ------------------------------------------------------------------ coronary arteries (data-driven)
// Each branch is a list of directions (heart-local) that follow the real course of the vessel:
//  LAD: anterior interventricular groove to the apex (+ diagonal)
//  LCX: left AV groove around the lateral wall to the posterior wall (+ obtuse marginal)
//  RCA: right AV groove to the crux, then posterior descending (+ acute marginal)
const SL = [0.35, 0.55, 0.76];   // shared origin of LAD + LCX (end of left main)
const SR = [-0.35, 0.5, 0.78];   // RCA origin
export const VESSELS = {
  LAD: {
    label: "Left Anterior Descending", radius: 0.05, supplies: "Front of the heart",
    branches: [
      { r: 1, d: [SL, [0.28, 0.3, 0.92], [0.2, -0.1, 0.97], [0.14, -0.5, 0.85], [0.06, -0.85, 0.5], [0.0, -1, 0.12]] },
      { r: 0.62, d: [[0.28, 0.3, 0.92], [0.6, 0.1, 0.8], [0.8, -0.25, 0.55], [0.82, -0.6, 0.3]] },
    ],
    view: [2.2, 0.5, 4.6],
  },
  LCX: {
    label: "Left Circumflex", radius: 0.045, supplies: "Side and back of the heart",
    branches: [
      { r: 1, d: [SL, [0.7, 0.5, 0.5], [0.95, 0.38, 0.12], [0.92, 0.3, -0.3], [0.65, 0.25, -0.72], [0.3, 0.2, -0.93]] },
      { r: 0.62, d: [[0.95, 0.38, 0.12], [0.96, 0.0, 0.2], [0.92, -0.3, 0.2], [0.82, -0.65, 0.1]] },
    ],
    view: [5.2, 0.8, -1.2],
  },
  RCA: {
    label: "Right Coronary Artery", radius: 0.05, supplies: "Right side and bottom of the heart",
    branches: [
      { r: 1, d: [SR, [-0.75, 0.4, 0.55], [-0.97, 0.25, 0.15], [-0.92, 0.18, -0.35], [-0.6, 0.12, -0.8], [-0.2, 0.08, -0.97]] },
      { r: 0.62, d: [[-0.97, 0.25, 0.15], [-0.95, -0.2, 0.25], [-0.8, -0.55, 0.3], [-0.55, -0.85, 0.25]] },
      { r: 0.62, d: [[-0.2, 0.08, -0.97], [0.0, -0.3, -0.93], [0.05, -0.65, -0.75], [0.04, -0.92, -0.35]] },
    ],
    view: [-4.4, 0.5, 3.6],
  },
};

const AORTIC_ROOT = new THREE.Vector3(-0.02, 0.98, 0.12);

function tube(points, radius, material, segs = 72) {
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
  const geo = new THREE.TubeGeometry(curve, segs, radius, 10, false);
  return { mesh: new THREE.Mesh(geo, material), curve };
}

// ------------------------------------------------------------------ heart + great vessels + coronaries
export function buildHeart(heartMat, outlineMat) {
  const g = new THREE.Group();
  g.name = "heart";
  g.position.copy(HEART_POS);
  g.rotation.z = HEART_TILT;

  // ventricles
  const sg = new THREE.SphereGeometry(1, 64, 48);
  const p = sg.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    heartSurface(v, v);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  sg.computeVertexNormals();
  const muscle = new THREE.Mesh(sg, heartMat);
  muscle.name = "muscle";
  g.add(muscle);

  // atria + appendage
  const blob = (x, y, z, r, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), heartMat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    g.add(m);
  };
  blob(-0.72, 0.78, 0.0, 0.5, 1, 1.15, 1);   // right atrium
  blob(0.78, 0.82, 0.38, 0.27, 1, 1, 1);     // left atrial appendage
  blob(0.2, 0.88, -0.48, 0.5, 1.3, 0.9, 0.9); // left atrium

  // great vessels (muted so the coloured coronaries stand out)
  const gv = new THREE.MeshStandardMaterial({ color: 0xc9a3a8, roughness: 0.6, transparent: true, opacity: 0.85 });
  const gvBlue = new THREE.MeshStandardMaterial({ color: 0x9db4cc, roughness: 0.6, transparent: true, opacity: 0.85 });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  g.add(tube([V(-0.02, 0.85, 0.12), V(-0.02, 1.45, 0.12), V(0.2, 1.95, 0), V(0.7, 2.05, -0.25), V(1.1, 1.65, -0.45), V(1.2, 0.9, -0.55)], 0.2, gv).mesh);
  g.add(tube([V(0.28, 0.85, 0.6), V(0.3, 1.35, 0.45)], 0.17, gvBlue, 24).mesh);
  g.add(tube([V(0.3, 1.35, 0.45), V(0.8, 1.7, 0.1)], 0.12, gvBlue, 24).mesh);
  g.add(tube([V(0.3, 1.35, 0.45), V(-0.4, 1.7, 0.0)], 0.12, gvBlue, 24).mesh);
  g.add(tube([V(-0.7, 0.85, 0.0), V(-0.7, 1.6, -0.05), V(-0.7, 2.2, -0.1)], 0.15, gvBlue, 24).mesh);

  // coronary arteries
  const stubMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.5 });
  const vessels = {};
  const leftMain = tube([AORTIC_ROOT.clone().add(V(0.1, 0, 0.1)), onHeart(SL).multiplyScalar(1.0).lerp(AORTIC_ROOT, 0.35), onHeart(SL)], 0.05, stubMat, 16);
  const rightStub = tube([AORTIC_ROOT.clone().add(V(-0.1, 0, 0.1)), onHeart(SR).lerp(AORTIC_ROOT, 0.3), onHeart(SR)], 0.05, stubMat, 16);
  g.add(leftMain.mesh, rightStub.mesh);

  for (const [id, def] of Object.entries(VESSELS)) {
    const material = new THREE.MeshStandardMaterial({ color: 0x8a94a3, roughness: 0.35, metalness: 0.0, emissive: 0x000000 });
    const meshes = [], outlines = [];
    let mainCurve = null;
    def.branches.forEach((br, i) => {
      const pts = br.d.map((d) => onHeart(d));
      const rad = def.radius * br.r;
      const t = tube(pts, rad, material);
      t.mesh.userData.vessel = id;
      g.add(t.mesh);
      meshes.push(t.mesh);
      const o = tube(pts, rad * 1.45, outlineMat);
      o.mesh.userData.outline = true;
      g.add(o.mesh);
      outlines.push(o.mesh);
      if (i === 0) mainCurve = t.curve;
    });
    vessels[id] = { id, def, material, meshes, outlines, anchorLocal: mainCurve.getPoint(0.55) };
  }
  return { group: g, muscle, vessels };
}

// ------------------------------------------------------------------ torso, ribs, lungs
const PROFILE = [ // [halfWidth, y, halfDepth]
  [2.2, -4.2, 1.3], [2.1, -3.0, 1.25], [2.35, -1.5, 1.4], [2.7, 0.0, 1.5],
  [2.9, 1.8, 1.45], [3.3, 3.0, 1.15], [2.4, 3.55, 0.9], [1.0, 3.9, 0.6], [0.6, 4.5, 0.6],
];
const profileCurve = new THREE.CatmullRomCurve3(PROFILE.map(([w, y, d]) => new THREE.Vector3(w, y, d)));
const SAMPLES = Array.from({ length: 61 }, (_, i) => profileCurve.getPoint(i / 60));
function dimsAt(y) {
  let best = SAMPLES[0];
  for (const s of SAMPLES) if (Math.abs(s.y - y) < Math.abs(best.y - y)) best = s;
  return { w: best.x, d: best.z };
}

function buildTorso(mat) {
  const N = 56, M = SAMPLES.length;
  const pos = [], idx = [];
  for (const s of SAMPLES) {
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2;
      pos.push(s.x * Math.cos(a), s.y, s.z * Math.sin(a));
    }
  }
  for (let j = 0; j < M - 1; j++) {
    for (let k = 0; k < N; k++) {
      const a = j * N + k, b = j * N + ((k + 1) % N), c = (j + 1) * N + k, d = (j + 1) * N + ((k + 1) % N);
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

function buildRibs(mat) {
  const g = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const y0 = 2.45 - i * 0.4;
    const { w, d } = dimsAt(y0);
    for (const s of [-1, 1]) {
      const pts = [];
      for (let phi = 0.12; phi <= 2.95; phi += 0.22) {
        pts.push(new THREE.Vector3(s * w * 0.9 * Math.sin(phi), y0 - 0.5 * (1 - phi / Math.PI), d * 0.9 * Math.cos(phi)));
      }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.04, 6, false), mat));
    }
  }
  const sternum = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.0, 0.08), mat);
  sternum.position.set(0, 1.0, dimsAt(1.0).d * 0.93);
  g.add(sternum);
  return g;
}

function buildSpine(mat) {
  const g = new THREE.Group();
  for (let y = 3.2; y > -4.0; y -= 0.46) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.3, 14), mat);
    m.position.set(0, y, -dimsAt(y).d * 0.78);
    g.add(m);
  }
  return g;
}

function buildLungs(mat) {
  const g = new THREE.Group();
  const l = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), mat);
  l.position.set(1.5, 0.7, -0.05); l.scale.set(0.95, 1.9, 0.95);
  const r = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), mat);
  r.position.set(-1.5, 0.7, -0.05); r.scale.set(1.05, 1.95, 1.0);
  g.add(l, r);
  return g;
}

// ------------------------------------------------------------------ public
export function buildAnatomy() {
  const heartMat = new THREE.MeshStandardMaterial({ color: 0xbfa9ae, roughness: 0.55, metalness: 0.0, transparent: true, opacity: 0.92 });
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x0b0f17, side: THREE.BackSide });
  const heart = buildHeart(heartMat, outlineMat);

  const torso = buildTorso(new THREE.MeshStandardMaterial({ color: 0x8fb4d9, roughness: 0.8, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xe9e2d0, roughness: 0.7, transparent: true, opacity: 0.55, depthWrite: false });
  const ribs = buildRibs(boneMat);
  const spine = buildSpine(boneMat);
  const lungs = buildLungs(new THREE.MeshStandardMaterial({ color: 0xd98ca0, roughness: 0.9, transparent: true, opacity: 0.13, depthWrite: false }));

  const skeleton = new THREE.Group();
  skeleton.add(ribs, spine);
  const root = new THREE.Group();
  root.add(torso, lungs, skeleton, heart.group);
  torso.renderOrder = 0;
  lungs.renderOrder = 0;
  skeleton.renderOrder = 0;
  heart.group.renderOrder = 1;

  return { root, heart, heartMat, layers: { torso, ribs: skeleton, lungs } };
}
