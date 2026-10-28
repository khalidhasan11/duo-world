"use strict";
/**
 * Duo World — level data (Phase 1: Worlds 1-2, levels 1-10).
 * Plain JSON-compatible data. Walls are rects {x,z,w,d} (centre + size);
 * a "divider" is a wall line with a doorway gap filled by a door rect.
 * Every level here is proven completable solo by test/solve-test.js.
 */
(function (global) {
  const B = { minX: -10, maxX: 10, minZ: -6, maxZ: 6 };
  // wall segments for a vertical divider at x, with a gap centred at gapZ
  function divider(x, gapZ, gapHalf) {
    const segs = [];
    const top = B.minZ, bottom = B.maxZ;
    const g0 = gapZ - gapHalf, g1 = gapZ + gapHalf;
    if (g0 > top) segs.push({ x, z: (top + g0) / 2, w: 0.7, d: g0 - top });
    if (g1 < bottom) segs.push({ x, z: (g1 + bottom) / 2, w: 0.7, d: bottom - g1 });
    return segs;
  }
  function door(id, x, gapZ, gapHalf) {
    return { id, x, z: gapZ, w: 0.7, d: gapHalf * 2 };
  }

  const DHAKA = { floorA: "#41603f", floorB: "#4d7049", wall: "#9a8f7a", name: "Dhaka" };
  const QUEBEC = { floorA: "#b9c9dd", floorB: "#c9d8ec", wall: "#e8eef7", name: "Quebec" };

  const LEVELS = [
    {
      id: 1, world: 1, theme: DHAKA, name: "First Steps",
      hint: "Walk both travellers to the green pads. Press TAB / SWITCH to change who you control.",
      par: 15, bounds: B, spawns: [{ x: -8, z: -2 }, { x: -8, z: 2 }],
      walls: [], doors: [], switches: [], boxes: [], iceZones: [],
      exitPads: [{ x: 8, z: -2, r: 1.1 }, { x: 8, z: 2, r: 1.1 }],
    },
    {
      id: 2, world: 1, theme: DHAKA, name: "The Gold Switch",
      hint: "One traveller holds the gold switch to open the door. The door stays open 3 seconds after they step off — hurry through!",
      par: 25, bounds: B, spawns: [{ x: -8, z: -2 }, { x: -8, z: 2 }],
      walls: divider(0, 0, 1.3), doors: [door("D1", 0, 0, 1.3)],
      switches: [{ x: -4, z: 0, r: 1.15, latch: 3, doors: ["D1"] }],
      boxes: [], iceZones: [],
      exitPads: [{ x: 8, z: -2, r: 1.1 }, { x: 8, z: 2, r: 1.1 }],
    },
    {
      id: 3, world: 1, theme: DHAKA, name: "Crate Work",
      hint: "Push the crate onto the gold switch — its weight holds the door open for both of you.",
      par: 35, bounds: B, spawns: [{ x: -8, z: -4 }, { x: -8, z: 0 }],
      walls: divider(0, 0, 1.3), doors: [door("D1", 0, 0, 1.3)],
      switches: [{ x: -6, z: 4, r: 1.15, latch: 1, doors: ["D1"] }],
      boxes: [{ x: -3, z: 4 }], iceZones: [],
      exitPads: [{ x: 8, z: -2, r: 1.1 }, { x: 8, z: 2, r: 1.1 }],
    },
    {
      id: 4, world: 1, theme: DHAKA, name: "Hold It For Me",
      hint: "This door barely stays open. Hold the switch while your partner crosses — then they hold the far switch so you can cross.",
      par: 45, bounds: B, spawns: [{ x: -8, z: -1 }, { x: -8, z: 1 }],
      walls: divider(0, 0, 1.3), doors: [door("D1", 0, 0, 1.3)],
      switches: [
        { x: -7, z: -4, r: 1.15, latch: 0.8, doors: ["D1"] },
        { x: 4, z: 4, r: 1.15, latch: 0.8, doors: ["D1"] },
      ],
      boxes: [], iceZones: [],
      exitPads: [{ x: 8, z: -2, r: 1.1 }, { x: 8, z: 2, r: 1.1 }],
    },
    {
      id: 5, world: 1, theme: DHAKA, name: "Dhaka Rush",
      hint: "Two doors. A crate for the first, a partner for the second.",
      par: 60, bounds: B, spawns: [{ x: -8.5, z: -2 }, { x: -8.5, z: 0.5 }],
      walls: [...divider(-3, 0, 1.3), ...divider(4, 0, 1.3)],
      doors: [door("D1", -3, 0, 1.3), door("D2", 4, 0, 1.3)],
      switches: [
        { x: -8, z: 3, r: 1.15, latch: 1, doors: ["D1"] },
        { x: 1, z: -4, r: 1.15, latch: 3, doors: ["D2"] },
      ],
      boxes: [{ x: -5.5, z: 3 }], iceZones: [],
      exitPads: [{ x: 8, z: -2, r: 1.1 }, { x: 8, z: 2, r: 1.1 }],
    },
    {
      id: 6, world: 2, theme: QUEBEC, name: "First Ice",
      hint: "Quebec is frozen! On ice you slide — start stopping early.",
      par: 20, bounds: B, spawns: [{ x: -8, z: -2 }, { x: -8, z: 2 }],
      walls: [], doors: [], switches: [], boxes: [],
      iceZones: [{ x: 0, z: 0, w: 12, d: 12 }],
      exitPads: [{ x: 8, z: -2, r: 1.1 }, { x: 8, z: 2, r: 1.1 }],
    },
    {
      id: 7, world: 2, theme: QUEBEC, name: "Slippery Switch",
      hint: "The switch is on the ice. Glide on, settle, and hold it for your partner.",
      par: 40, bounds: B, spawns: [{ x: -8, z: -2 }, { x: -8, z: 2 }],
      walls: divider(0, 0, 1.3), doors: [door("D1", 0, 0, 1.3)],
      switches: [{ x: -4, z: 0, r: 1.2, latch: 3, doors: ["D1"] }],
      boxes: [], iceZones: [{ x: -5.5, z: 0, w: 9, d: 12 }],
      exitPads: [{ x: 8, z: -2, r: 1.1 }, { x: 8, z: 2, r: 1.1 }],
    },
    {
      id: 8, world: 2, theme: QUEBEC, name: "Frozen Crate",
      hint: "Crate on the switch, then a long slide home. Aim carefully — the exit pads are on ice too.",
      par: 50, bounds: B, spawns: [{ x: -8, z: 3 }, { x: -8, z: 0 }],
      walls: divider(0, 0, 1.3), doors: [door("D1", 0, 0, 1.3)],
      switches: [{ x: -6, z: -3, r: 1.15, latch: 1, doors: ["D1"] }],
      boxes: [{ x: -2.5, z: -3 }],
      iceZones: [{ x: 5.5, z: 0, w: 9, d: 12 }],
      exitPads: [{ x: 8, z: -2, r: 1.1 }, { x: 8, z: 2, r: 1.1 }],
    },
    {
      id: 9, world: 2, theme: QUEBEC, name: "Hold It On Ice",
      hint: "Hold the switch for your partner, they hold the far one for you — and the finish is a slide.",
      par: 55, bounds: B, spawns: [{ x: -8, z: -1 }, { x: -8, z: 1 }],
      walls: divider(0, 0, 1.3), doors: [door("D1", 0, 0, 1.3)],
      switches: [
        { x: -7, z: 4, r: 1.15, latch: 0.8, doors: ["D1"] },
        { x: 3, z: -4, r: 1.15, latch: 0.8, doors: ["D1"] },
      ],
      boxes: [], iceZones: [{ x: 6.5, z: 0, w: 7, d: 12 }],
      exitPads: [{ x: 8, z: -2, r: 1.1 }, { x: 8, z: 2, r: 1.1 }],
    },
    {
      id: 10, world: 2, theme: QUEBEC, name: "Quebec Finale",
      hint: "Everything together: crate, ice, and a switch in the middle of the rink.",
      par: 75, bounds: B, spawns: [{ x: -8, z: 2 }, { x: -8, z: 4 }],
      walls: [...divider(-3, 0, 1.3), ...divider(5, 0, 1.3)],
      doors: [door("D1", -3, 0, 1.3), door("D2", 5, 0, 1.3)],
      switches: [
        { x: -6.5, z: -3, r: 1.15, latch: 1, doors: ["D1"] },
        { x: 2, z: 0, r: 1.2, latch: 2.5, doors: ["D2"] },
      ],
      boxes: [{ x: -4.8, z: -3 }],
      iceZones: [{ x: 1.5, z: 0, w: 7, d: 12 }],
      exitPads: [{ x: 8, z: -2, r: 1.1 }, { x: 8, z: 2, r: 1.1 }],
    },
  ];

  if (typeof module !== "undefined" && module.exports) module.exports = { LEVELS };
  global.DuoLevels = LEVELS;
})(typeof window !== "undefined" ? window : globalThis);
