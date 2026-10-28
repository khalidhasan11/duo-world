import * as THREE from "three";

/* Duo World Phase 1 — offline solo client.
   Runs the shared engine (window.DuoEngine) locally at a fixed 60 Hz step.
   Solo twist on the co-op formula: you control ONE traveller at a time and
   SWITCH between them — the other stays exactly where you left them, which
   is what makes the puzzles work single-player. */

const { createWorld, step, starsFor } = window.DuoEngine;
const LEVELS = window.DuoLevels;
const $ = (id) => document.getElementById(id);

// ---------- save ----------
const SAVE_KEY = "duoWorldSaveV1";
let save;
try { save = JSON.parse(localStorage.getItem(SAVE_KEY)) || null; } catch { save = null; }
if (!save || typeof save.unlocked !== "number") save = { unlocked: 1, stars: {}, times: {} };
function persist() { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }

// ---------- three setup ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
$("app").appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141a29);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 17.5, 13.8);
camera.lookAt(0, 0, 0.3);
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 1.05);
sun.position.set(6, 14, 4);
scene.add(sun);

let levelGroup = null;
let dyn = null; // per-level dynamic meshes

function mat(color) { return new THREE.MeshStandardMaterial({ color }); }
function box(w, h, d, color, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  (parent || scene).add(m);
  return m;
}
function seededRand(seed) { let s = seed * 7919 + 13; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }

function buildLevel(level) {
  if (levelGroup) { scene.remove(levelGroup); levelGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  levelGroup = new THREE.Group();
  scene.add(levelGroup);
  const T = level.theme;
  const W = level.bounds.maxX - level.bounds.minX, D = level.bounds.maxZ - level.bounds.minZ;
  const cx = (level.bounds.minX + level.bounds.maxX) / 2, cz = (level.bounds.minZ + level.bounds.maxZ) / 2;

  // floor (visual margin beyond playable bounds)
  box(W + 5, 0.4, D + 5, T.floorA, cx, -0.21, cz, levelGroup);
  box(W, 0.08, D, T.floorB, cx, 0.02, cz, levelGroup);

  // ice zones
  for (const z of level.iceZones || []) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(z.w, 0.06, z.d),
      new THREE.MeshStandardMaterial({ color: 0xaadcf5, transparent: true, opacity: 0.65 }));
    m.position.set(z.x, 0.07, z.z);
    levelGroup.add(m);
  }
  // walls
  for (const w of level.walls || []) box(w.w, 2.2, w.d, T.wall, w.x, 1.1, w.z, levelGroup);
  // doors (slide up with progress)
  const doorMeshes = new Map();
  for (const d of level.doors || []) {
    doorMeshes.set(d.id, box(d.w, 2.2, d.d, 0xffb300, d.x, 1.1, d.z, levelGroup));
  }
  // switches
  const switchMeshes = (level.switches || []).map((s) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r, 0.12, 28), mat(0x8a6d1a));
    m.position.set(s.x, 0.08, s.z);
    levelGroup.add(m);
    return m;
  });
  // exit pads
  const exitMeshes = level.exitPads.map((e) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(e.r, e.r, 0.12, 28), mat(0x1f6f3a));
    m.position.set(e.x, 0.08, e.z);
    levelGroup.add(m);
    return m;
  });
  // crates
  const boxMeshes = (level.boxes || []).map((b) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), mat(0xb08968));
    base.position.y = 0.45;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.14, 0.98), mat(0x8a6844));
    lid.position.y = 0.9;
    g.add(base, lid);
    g.position.set(b.x, 0, b.z);
    levelGroup.add(g);
    return g;
  });
  // players
  const playerMeshes = level.spawns.map((s, i) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.8), mat(i === 0 ? 0xe53935 : 0x1e88e5));
    body.position.y = 0.75;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), mat(0xffe0b2));
    head.position.y = 1.55;
    g.add(body, head);
    g.position.set(s.x, 0, s.z);
    levelGroup.add(g);
    return g;
  });
  // active-player ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.07, 10, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.12;
  levelGroup.add(ring);

  // themed props on the margin outside the playable area (visual only)
  const rand = seededRand(level.id);
  if (level.world === 1) {
    const cols = [0xd84315, 0x00897b, 0x6a1b9a, 0x2e7d32, 0xc62828, 0x1565c0];
    for (let i = 0; i < 7; i++) {
      const h = 1.6 + rand() * 2.6;
      box(1.6, h, 1.4, cols[i % cols.length], -11 + i * 3.6, h / 2 - 0.1, -8.1, levelGroup);
      const h2 = 1.4 + rand() * 2.2;
      box(1.5, h2, 1.3, cols[(i + 3) % cols.length], -10.4 + i * 3.6, h2 / 2 - 0.1, 8.1, levelGroup);
    }
  } else {
    for (let i = 0; i < 6; i++) {
      const x = -11 + i * 4.3, z = i % 2 ? 8.2 : -8.2;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.7, 8), mat(0x6d4c41));
      trunk.position.set(x, 0.35, z);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.0, 10), mat(0xe8f1e8));
      cone.position.set(x, 1.7, z);
      levelGroup.add(trunk, cone);
    }
  }
  dyn = { doorMeshes, switchMeshes, exitMeshes, boxMeshes, playerMeshes, ring };
}

// ---------- game state ----------
let world = null, currentLevel = null, active = 0, finished = false;

function startLevel(id) {
  currentLevel = LEVELS.find((l) => l.id === id);
  world = createWorld(currentLevel);
  active = 0; finished = false;
  buildLevel(currentLevel);
  $("menu").classList.add("hidden");
  $("hud").classList.remove("hidden");
  $("hint").classList.remove("hidden");
  $("hint").textContent = "💡 " + currentLevel.hint;
  $("lvlname").textContent = `L${currentLevel.id} · ${currentLevel.name}`;
  $("complete").classList.add("hidden");
  $("touch").classList.add("on");
  updateActivePill();
}
function toMenu() {
  world = null;
  $("hud").classList.add("hidden");
  $("hint").classList.add("hidden");
  $("complete").classList.add("hidden");
  $("touch").classList.remove("on");
  $("menu").classList.remove("hidden");
  renderMenu();
}
function updateActivePill() {
  const el = $("activename");
  el.textContent = active === 0 ? "🔴 Red" : "🔵 Blue";
  el.className = active === 0 ? "red" : "blue";
}
function switchPlayer() { active = active === 0 ? 1 : 0; updateActivePill(); }

function onWin() {
  finished = true;
  const t = world.winTime;
  const stars = starsFor(currentLevel, t);
  const id = currentLevel.id;
  save.stars[id] = Math.max(save.stars[id] || 0, stars);
  save.times[id] = save.times[id] ? Math.min(save.times[id], t) : t;
  save.unlocked = Math.max(save.unlocked, Math.min(id + 1, LEVELS.length));
  persist();
  $("compstars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
  $("comptime").textContent = `${currentLevel.name} finished in ${t.toFixed(1)}s (par ${currentLevel.par}s)`;
  $("nextbtn").style.display = id < LEVELS.length ? "" : "none";
  $("complete").classList.remove("hidden");
}

// ---------- menu ----------
function renderMenu() {
  const total = Object.values(save.stars).reduce((a, b) => a + b, 0);
  $("totalstars").textContent = `★ ${total} / ${LEVELS.length * 3}`;
  const wrap = $("levels");
  wrap.innerHTML = "";
  for (const worldNo of [1, 2]) {
    const title = document.createElement("div");
    title.className = "worldtitle";
    title.textContent = worldNo === 1 ? "🌏 World 1 — Dhaka" : "❄️ World 2 — Quebec";
    wrap.appendChild(title);
    const grid = document.createElement("div");
    grid.className = "lvlgrid";
    for (const l of LEVELS.filter((x) => x.world === worldNo)) {
      const locked = l.id > save.unlocked;
      const d = document.createElement("div");
      d.className = "lvl" + (locked ? " locked" : "");
      d.innerHTML = `<div class="n">${locked ? "🔒" : l.id}</div><div class="nm">${l.name}</div>` +
        `<div class="st">${"★".repeat(save.stars[l.id] || 0)}${"☆".repeat(3 - (save.stars[l.id] || 0))}</div>`;
      if (!locked) d.onclick = () => startLevel(l.id);
      grid.appendChild(d);
    }
    wrap.appendChild(grid);
  }
}

// ---------- input ----------
const keys = { left: false, right: false, up: false, down: false, jump: false };
const keymap = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", Space: "jump" };
addEventListener("keydown", (e) => {
  if (e.code === "Tab" || e.code === "KeyQ") { if (world && !finished) switchPlayer(); e.preventDefault(); return; }
  const k = keymap[e.code];
  if (k) { keys[k] = true; e.preventDefault(); }
});
addEventListener("keyup", (e) => { const k = keymap[e.code]; if (k) { keys[k] = false; e.preventDefault(); } });
function bindHold(el, on, off) {
  el.addEventListener("pointerdown", (e) => { on(); e.preventDefault(); });
  el.addEventListener("pointerup", off); el.addEventListener("pointerleave", off); el.addEventListener("pointercancel", off);
}
document.querySelectorAll(".tbtn[data-k]").forEach((el) => {
  const k = el.dataset.k;
  bindHold(el, () => { keys[k] = true; }, () => { keys[k] = false; });
});
bindHold($("jumpbtn"), () => { keys.jump = true; }, () => { keys.jump = false; });
$("switchbtn").addEventListener("pointerdown", (e) => { if (world && !finished) switchPlayer(); e.preventDefault(); });
$("backbtn").onclick = toMenu;
$("restartbtn").onclick = () => { if (currentLevel) startLevel(currentLevel.id); };
$("replaybtn").onclick = () => startLevel(currentLevel.id);
$("menubtn").onclick = toMenu;
$("nextbtn").onclick = () => startLevel(Math.min(currentLevel.id + 1, LEVELS.length));

// ---------- main loop: fixed-step engine, render from state ----------
const FIXED = 1 / 60;
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 0.1);
  if (world) {
    if (!finished) {
      acc += dt;
      while (acc >= FIXED) {
        const inputs = [{ x: 0, z: 0, jump: false }, { x: 0, z: 0, jump: false }];
        inputs[active] = {
          x: (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
          z: (keys.down ? 1 : 0) - (keys.up ? 1 : 0),
          jump: keys.jump,
        };
        step(world, inputs, FIXED);
        acc -= FIXED;
        if (world.won) { onWin(); break; }
      }
    }
    // sync meshes
    world.players.forEach((p, i) => dyn.playerMeshes[i].position.set(p.x, p.y, p.z));
    world.boxes.forEach((b, i) => dyn.boxMeshes[i].position.set(b.x, 0, b.z));
    world.doors.forEach((d) => { const m = dyn.doorMeshes.get(d.id); if (m) m.position.y = 1.1 + d.progress * 2.3; });
    world.switches.forEach((s, i) => dyn.switchMeshes[i].material.color.set(s.pressed ? 0xffd54f : 0x8a6d1a));
    currentLevel.exitPads.forEach((e, i) => {
      const occ = world.players.some((p) => Math.hypot(p.x - e.x, p.z - e.z) <= e.r);
      dyn.exitMeshes[i].material.color.set(occ ? 0x37d67a : 0x1f6f3a);
    });
    const ap = world.players[active];
    dyn.ring.position.set(ap.x, 0.12, ap.z);
    dyn.ring.material.color.set(active === 0 ? 0xff8a80 : 0x82b1ff);
    dyn.ring.scale.setScalar(1 + Math.sin(now / 280) * 0.07);
    $("timer").textContent = world.time.toFixed(1);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

window.__duo = { startLevel, toMenu, get world() { return world; }, get active() { return active; } }; // QA/testing hook

// boot: menu, or ?level=N deep link (QA / sharing a specific level)
renderMenu();
const q = new URLSearchParams(location.search);
const startAt = Number(q.get("level"));
if (startAt >= 1 && startAt <= LEVELS.length) startLevel(startAt);
