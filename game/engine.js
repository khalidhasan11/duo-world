"use strict";
/**
 * Duo World — shared game engine (Phase 1).
 * Pure simulation, no rendering, no networking: the same step() runs in the
 * browser for offline solo play and in Node for the automated solvability
 * tests. In Phase 2 the server will run this exact engine, so a level that
 * works offline behaves identically online.
 *
 * Coordinates: x = right, z = toward camera (down-screen), y = up.
 * All gameplay objects are axis-aligned rects / circles on the x-z plane.
 */
(function (global) {
  const CFG = {
    playerR: 0.45,
    boxHalf: 0.45,
    maxSpeed: 5.5,
    approachNormal: 12,   // 1/s velocity approach rate on normal ground (snappy)
    approachIce: 1.9,     // 1/s on ice (slidey, needs braking)
    jumpVel: 7.5,
    gravity: -22,
    doorAnimSec: 0.6,
    doorBlockAt: 0.7,     // door is solid while progress < this
  };

  function rectsOverlap(a, b) {
    return Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.z - b.z) * 2 < a.d + b.d;
  }
  function circleRectOverlap(cx, cz, r, rect) {
    const nx = Math.max(rect.x - rect.w / 2, Math.min(cx, rect.x + rect.w / 2));
    const nz = Math.max(rect.z - rect.d / 2, Math.min(cz, rect.z + rect.d / 2));
    return Math.hypot(cx - nx, cz - nz) < r;
  }
  function pointInRect(x, z, rect) {
    return Math.abs(x - rect.x) <= rect.w / 2 && Math.abs(z - rect.z) <= rect.d / 2;
  }

  function createWorld(level) {
    const world = {
      level,
      time: 0,
      won: false,
      winTime: null,
      players: level.spawns.map((s, i) => ({
        slot: i, x: s.x, z: s.z, y: 0, vx: 0, vz: 0, vy: 0,
        onSwitch: false, onExit: false, onIce: false, grounded: true,
      })),
      boxes: (level.boxes || []).map((b) => ({ x: b.x, z: b.z })),
      doors: (level.doors || []).map((d) => ({
        id: d.id, x: d.x, z: d.z, w: d.w, d: d.d,
        progress: 0, open: false, lastPressAt: -Infinity,
      })),
      switches: (level.switches || []).map((s) => ({
        x: s.x, z: s.z, r: s.r, doors: s.doors.slice(), latch: s.latch || 0,
        pressed: false, pressedByBox: false,
      })),
    };
    return world;
  }

  function solidsFor(world, forBox) {
    // walls + closed-enough doors as rects
    const solids = [];
    for (const w of world.level.walls || []) solids.push(w);
    for (const d of world.doors) if (d.progress < CFG.doorBlockAt) solids.push(d);
    return solids;
  }

  function hitsSolid(world, x, z, r, ignoreBoxIdx) {
    const probe = { x, z, w: r * 2, d: r * 2 };
    for (const s of solidsFor(world)) if (rectsOverlap(probe, s)) return s;
    // boxes are solid for players; boxes are solid for other boxes
    for (let i = 0; i < world.boxes.length; i++) {
      if (i === ignoreBoxIdx) continue;
      const b = world.boxes[i];
      if (rectsOverlap(probe, { x: b.x, z: b.z, w: CFG.boxHalf * 2, d: CFG.boxHalf * 2 })) return { isBox: true, idx: i };
    }
    return null;
  }

  function moveAxis(world, p, axis, delta) {
    if (delta === 0) return;
    const nx = axis === "x" ? p.x + delta : p.x;
    const nz = axis === "z" ? p.z + delta : p.z;
    const hit = hitsSolid(world, nx, nz, CFG.playerR, -1);
    if (!hit) { p.x = nx; p.z = nz; return; }
    if (hit.isBox) {
      // try to push the box by the same delta along this axis
      const b = world.boxes[hit.idx];
      const bx = axis === "x" ? b.x + delta : b.x;
      const bz = axis === "z" ? b.z + delta : b.z;
      const boxHit = hitsSolid(world, bx, bz, CFG.boxHalf, hit.idx);
      const playerInWay = world.players.some((q) => q !== p &&
        rectsOverlap({ x: bx, z: bz, w: CFG.boxHalf * 2, d: CFG.boxHalf * 2 },
                     { x: q.x, z: q.z, w: CFG.playerR * 2, d: CFG.playerR * 2 }));
      const inBounds = bx - CFG.boxHalf >= world.level.bounds.minX && bx + CFG.boxHalf <= world.level.bounds.maxX &&
                       bz - CFG.boxHalf >= world.level.bounds.minZ && bz + CFG.boxHalf <= world.level.bounds.maxZ;
      if (!boxHit && !playerInWay && inBounds) {
        b.x = bx; b.z = bz;
        // re-check the player's own destination now that the box moved
        if (!hitsSolid(world, nx, nz, CFG.playerR, -1)) { p.x = nx; p.z = nz; }
      }
      return;
    }
    // solid wall/door: stay put on this axis (sliding along the other axis still works)
  }

  /**
   * Advance the world. inputs: array per player slot {x, z, jump} with
   * x/z in [-1, 1]. dt in seconds (callers use fixed steps).
   */
  function step(world, inputs, dt) {
    if (world.won) { /* still allow door anim to settle */ }
    world.time += dt;
    const L = world.level;

    // --- players ---
    for (const p of world.players) {
      const inp = inputs[p.slot] || { x: 0, z: 0, jump: false };
      p.onIce = (L.iceZones || []).some((r) => pointInRect(p.x, p.z, r));
      const rate = p.onIce ? CFG.approachIce : CFG.approachNormal;
      const len = Math.hypot(inp.x, inp.z);
      const dx = len > 1 ? inp.x / len : inp.x;
      const dz = len > 1 ? inp.z / len : inp.z;
      const k = 1 - Math.exp(-rate * dt);
      p.vx += (dx * CFG.maxSpeed - p.vx) * k;
      p.vz += (dz * CFG.maxSpeed - p.vz) * k;
      if (Math.abs(p.vx) < 0.02 && dx === 0) p.vx = 0;
      if (Math.abs(p.vz) < 0.02 && dz === 0) p.vz = 0;

      moveAxis(world, p, "x", p.vx * dt);
      moveAxis(world, p, "z", p.vz * dt);
      p.x = Math.max(L.bounds.minX + CFG.playerR, Math.min(L.bounds.maxX - CFG.playerR, p.x));
      p.z = Math.max(L.bounds.minZ + CFG.playerR, Math.min(L.bounds.maxZ - CFG.playerR, p.z));

      if (inp.jump && p.grounded) { p.vy = CFG.jumpVel; p.grounded = false; }
      p.vy += CFG.gravity * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = 0; p.grounded = true; }
    }

    // --- switches (players OR boxes count as weight) ---
    for (const s of world.switches) {
      s.pressedByBox = world.boxes.some((b) => Math.hypot(b.x - s.x, b.z - s.z) <= s.r);
      s.pressed = s.pressedByBox || world.players.some((p) => Math.hypot(p.x - s.x, p.z - s.z) <= s.r);
      if (s.pressed) {
        for (const d of world.doors) if (s.doors.includes(d.id)) d.lastPressAt = world.time;
      }
    }
    for (const p of world.players) {
      p.onSwitch = world.switches.some((s) => Math.hypot(p.x - s.x, p.z - s.z) <= s.r);
      p.onExit = (L.exitPads || []).some((e) => Math.hypot(p.x - e.x, p.z - e.z) <= e.r);
    }

    // --- doors ---
    for (const d of world.doors) {
      const latch = Math.max(0, ...world.switches.filter((s) => s.doors.includes(d.id)).map((s) => s.latch));
      d.open = world.switches.some((s) => s.doors.includes(d.id) && s.pressed) ||
               (d.lastPressAt > -Infinity && world.time - d.lastPressAt <= latch);
      const target = d.open ? 1 : 0;
      const st = dt / CFG.doorAnimSec;
      d.progress += Math.max(-st, Math.min(st, target - d.progress));
      d.progress = Math.max(0, Math.min(1, d.progress));
    }

    // --- win: every exit pad occupied by a player at the same time ---
    if (!world.won && (L.exitPads || []).length > 0) {
      const allOccupied = L.exitPads.every((e) =>
        world.players.some((p) => Math.hypot(p.x - e.x, p.z - e.z) <= e.r));
      if (allOccupied) { world.won = true; world.winTime = world.time; }
    }
    return world;
  }

  function starsFor(level, timeSec) {
    if (timeSec <= level.par) return 3;
    if (timeSec <= level.par * 2) return 2;
    return 1;
  }

  const api = { createWorld, step, starsFor, CFG };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.DuoEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
