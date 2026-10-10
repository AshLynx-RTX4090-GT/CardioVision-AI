// Interactive 3D viewer (Three.js). Light geometry + on-demand rendering so it stays smooth without a GPU.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildAnatomy, HEART_POS, VESSELS } from "./anatomy.js";
import { NEUTRAL, pct, riskColor, riskLevel } from "./risk.js";

const VIEWS = {
  anterior: [0, 0.4, 6.4],
  posterior: [0, 0.4, -6.4],
  left: [6.4, 0.4, 0.6],
  right: [-6.4, 0.4, 0.6],
  superior: [0.2, 6.6, 1.2],
};
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function createViewer(container, { onSelect = () => {}, onHover = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute("aria-label", "Interactive 3D heart model");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const target0 = HEART_POS.clone();
  camera.position.copy(target0).add(new THREE.Vector3(...VIEWS.anterior));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 1.8;
  controls.maxDistance = 14;
  controls.autoRotateSpeed = 1.2;

  // lights: soft ambient + a key light that follows the camera
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(2, 3, 5);
  camera.add(key);
  scene.add(camera);

  const anatomy = buildAnatomy();
  scene.add(anatomy.root);
  const vessels = anatomy.heart.vessels;
  const pickables = Object.values(vessels).flatMap((v) => v.meshes);

  // ---------------------------------------------------------------- vessel chips (HTML overlay)
  const chips = {};
  for (const id of Object.keys(vessels)) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "vessel-chip";
    el.innerHTML = `<span class="dot"></span><b>${id}</b><span class="val">–</span>`;
    el.addEventListener("click", () => select(selected === id ? null : id));
    container.appendChild(el);
    chips[id] = el;
  }
  const tip = document.createElement("div");
  tip.className = "viewer-tip";
  tip.hidden = true;
  container.appendChild(tip);

  // ---------------------------------------------------------------- state
  let risks = {};
  let selected = null;
  let hovered = null;
  let dirty = true;
  let tween = null;
  let raf = 0;
  const invalidate = () => (dirty = true);

  function applyAppearance() {
    for (const [id, v] of Object.entries(vessels)) {
      const p = risks[id];
      const col = new THREE.Color(riskColor(p));
      v.material.color.copy(col);
      const boost = selected === id ? 0.55 : hovered === id ? 0.35 : 0.12;
      v.material.emissive.copy(col).multiplyScalar(boost);
      const dim = selected && selected !== id;
      v.material.transparent = dim;
      v.material.opacity = dim ? 0.3 : 1;
      v.outlines.forEach((o) => (o.visible = !dim));
      const chip = chips[id];
      chip.classList.toggle("selected", selected === id);
      chip.classList.toggle("dim", !!dim);
      chip.style.setProperty("--c", riskColor(p));
      chip.querySelector(".val").textContent = p == null ? "–" : Math.round(p * 100) + "%";
    }
    invalidate();
  }

  // ---------------------------------------------------------------- camera
  function flyTo(pos, tgt, ms = 650) {
    tween = { t0: performance.now(), ms, p0: camera.position.clone(), t0v: controls.target.clone(), p1: pos, t1: tgt };
    invalidate();
  }
  function stepTween(now) {
    if (!tween) return false;
    const k = Math.min(1, (now - tween.t0) / tween.ms);
    const e = ease(k);
    camera.position.lerpVectors(tween.p0, tween.p1, e);
    controls.target.lerpVectors(tween.t0v, tween.t1, e);
    if (k >= 1) tween = null;
    return true;
  }
  function setView(name) {
    const off = VIEWS[name] || VIEWS.anterior;
    flyTo(target0.clone().add(new THREE.Vector3(...off)), target0.clone());
  }
  function focusVessel(id) {
    const def = VESSELS[id];
    if (!def) return;
    flyTo(target0.clone().add(new THREE.Vector3(...def.view)), target0.clone());
  }

  function select(id, { fly = true } = {}) {
    selected = id;
    applyAppearance();
    if (id && fly) focusVessel(id);
    onSelect(id);
  }

  // ---------------------------------------------------------------- picking
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.vessel : null;
  }

  let moveQueued = false, lastMove = null;
  renderer.domElement.addEventListener("pointermove", (ev) => {
    lastMove = ev;
    if (moveQueued || ev.buttons) return; // skip while dragging
    moveQueued = true;
    requestAnimationFrame(() => {
      moveQueued = false;
      const id = pick(lastMove);
      const rect = container.getBoundingClientRect();
      if (id !== hovered) {
        hovered = id;
        renderer.domElement.style.cursor = id ? "pointer" : "grab";
        applyAppearance();
        onHover(id);
      }
      if (id) {
        const p = risks[id];
        tip.hidden = false;
        tip.innerHTML = `<b>${id}</b> – ${VESSELS[id].label}<br>${p == null ? "no prediction" : `${pct(p)} probability of ≥50% stenosis (${riskLevel(p).label.toLowerCase()})`}`;
        tip.style.transform = `translate(${lastMove.clientX - rect.left + 14}px, ${lastMove.clientY - rect.top + 14}px)`;
      } else tip.hidden = true;
    });
  });
  renderer.domElement.addEventListener("pointerleave", () => { tip.hidden = true; if (hovered) { hovered = null; applyAppearance(); } });

  let down = null;
  renderer.domElement.addEventListener("pointerdown", (ev) => { down = { x: ev.clientX, y: ev.clientY, t: performance.now() }; });
  renderer.domElement.addEventListener("pointerup", (ev) => {
    if (!down) return;
    const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
    const quick = performance.now() - down.t < 450;
    down = null;
    if (moved < 5 && quick) {
      const id = pick(ev);
      select(id && id === selected ? null : id);
    }
  });

  // ---------------------------------------------------------------- resize + render
  function resize() {
    const w = container.clientWidth || 600, h = container.clientHeight || 500;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + "px";
    renderer.domElement.style.height = h + "px";
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    invalidate();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  controls.addEventListener("change", invalidate);

  const tmp = new THREE.Vector3(), centre = new THREE.Vector3();
  function placeChips() {
    const w = container.clientWidth, h = container.clientHeight;
    centre.copy(HEART_POS).project(camera);
    const cx = (centre.x * 0.5 + 0.5) * w, cy = (-centre.y * 0.5 + 0.5) * h;
    for (const [id, v] of Object.entries(vessels)) {
      tmp.copy(v.anchorLocal);
      anatomy.heart.group.localToWorld(tmp);
      const behind = tmp.clone().sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3())) <= 0;
      tmp.project(camera);
      let x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h;
      // push the chip outward from the heart centre so it never covers the artery
      const dx = x - cx, dy = y - cy, len = Math.hypot(dx, dy) || 1;
      x += (dx / len) * 46; y += (dy / len) * 46;
      x = Math.min(Math.max(x, 44), w - 44); y = Math.min(Math.max(y, 18), h - 18);
      const el = chips[id];
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      el.style.visibility = behind ? "hidden" : "visible";
    }
  }

  function render() {
    renderer.render(scene, camera);
    placeChips();
    dirty = false;
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const moving = stepTween(now);
    const changed = controls.update();
    if (dirty || moving || changed || controls.autoRotate) render();
  }
  raf = requestAnimationFrame(frame);
  applyAppearance();

  // ---------------------------------------------------------------- public API
  return {
    setRisks(r) { risks = { ...r }; applyAppearance(); },
    select,
    get selected() { return selected; },
    setView, focusVessel,
    resetView() { selectNone(); setView("anterior"); },
    setLayer(name, on) { const l = anatomy.layers[name]; if (l) { l.visible = on; invalidate(); } },
    setHeartOpacity(v) { anatomy.heartMat.opacity = v; invalidate(); },
    setAutoRotate(on) { controls.autoRotate = on; invalidate(); },
    snapshot() { render(); return renderer.domElement.toDataURL("image/png"); },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); },
  };

  function selectNone() { select(null, { fly: false }); }
}
