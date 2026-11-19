import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import { glCamera } from "./kit/gl.mjs";
import { tubePieces, tubeSvg } from "./kit/tube.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT_DIR = join(HERE, "kit");
const theme = process.argv.includes("--light") ? "light" : "dark";

// Large widescreen stage so the cube fills the screen edge-to-edge
const W = 1040;
const H = 860;
const AZIMUTH = 38;
const ELEVATION = 29;

// --- World layout (scaled up so the cube dominates the viewer's field of view) ---
const BASE_H = 14;
const FOOT_H = 7;
const BASE = { x: -206, y: -164, w: 428, d: 356, r: 12 };

// Optical Cube Chamber (230 x 230 x 230 cube centered at (0, -14, 127))
const CUBE_CX = 0;
const CUBE_CY = -14;
const CUBE_Z0 = 12;
const CUBE_SIZE = 230;
const CUBE_Z1 = CUBE_Z0 + CUBE_SIZE; // 242
const CUBE_HALF = CUBE_SIZE / 2;      // 115
const CUBE_CZ = CUBE_Z0 + CUBE_HALF;  // 127
const PLINTH = { x: CUBE_CX - 123, y: CUBE_CY - 123, w: 246, d: 246, r: 4 };
const POST_W = 6.5;
const RAIL_H = 5.0;

// Front-Left Prompt Selector Console
const CONSOLE = { x: -190, y: 36, w: 50, d: 74, r: 4 };
const CONSOLE_H = 22;
const KNOB_CX = CONSOLE.x + 25;
const KNOB_CY = CONSOLE.y + 42;
const KNOB_R = 12.5;
const KNOB_Z = CONSOLE_H;

// Front Layer-Depth Carriage Rail (L0 -> L6)
const RAIL_Y = 142;
const RAIL_X0 = -152;
const RAIL_X1 = 128;
const RAIL_SPAN = RAIL_X1 - RAIL_X0 - 36;

// Right-Side Logit Lens Readout Bank (5 sight-tubes)
const BANK = { x: 142, y: -116, w: 58, d: 204, r: 4 };
const BANK_H = 14;
const TUBE_MAX_H = 84;
const TUBE_R = 6.0;
const BAR_ITEMS = M.TOKENS.map((tok, i) => ({
  id: tok.id,
  text: tok.text,
  x: BANK.x + 29,
  y: BANK.y + 26 + i * 38,
  r: TUBE_R - 1.3,
  z0: BANK_H + 3,
}));

// Tight pad so the chamber fills the entire viewport
const P = k.fitProjection(
  [
    ...k.boxCorners(BASE, -BASE_H - FOOT_H, 0),
    ...k.boxCorners(PLINTH, 0, CUBE_Z1 + 8),
    ...k.boxCorners(BANK, 0, BANK_H + TUBE_MAX_H + 14),
    ...k.boxCorners(CONSOLE, 0, CONSOLE_H + 12),
  ],
  W,
  H,
  { pad: 18, azimuth: AZIMUTH, elevation: ELEVATION },
);

const at = (pt) => k.iso(pt, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (pts, style) => k.dotsSvg(pts, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const seg = (a, b) => k.pathOf([at(a), at(b)]);

function cable(points, r = 1.5) {
  return tubePieces(G.fillet(points, 5, 8), r, P, { maxLength: 16, spacing: 1.2 })
    .map((piece) => tubeSvg(piece, { tone: "mid" }))
    .join("");
}

function stanchion(cx, cy) {
  const out = [];
  out.push(S(k.slabOf({ x: cx - 6, y: cy - 6, w: 12, d: 12, r: 1.4 }, CUBE_Z0, 5, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: cx - POST_W / 2, y: cy - POST_W / 2, w: POST_W, d: POST_W, r: 0.8 }, CUBE_Z0 + 5, CUBE_SIZE - 10, P, 2, 0.3), { tone: "hi", crease: "lo" }));
  out.push(S(k.slabOf({ x: cx - 6, y: cy - 6, w: 12, d: 12, r: 1.4 }, CUBE_Z1 - 5, 5, P, 3, 0.4), { tone: "hi" }));
  out.push(Dots([at([cx, cy, CUBE_Z1])], { size: 0.5 }));
  return out.join("");
}

// =========================================================================
// 1. BACK SVG
// =========================================================================
const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`);
for (const [x, y] of byDepth(k.corners(BASE, 30))) {
  back.push(S(k.cylinder(x, y, 11, -BASE_H - FOOT_H, 2.2, P, 28), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 8.2, -BASE_H - FOOT_H + 2.2, FOOT_H - 2.2, P, 28), { tone: "mid" }));
}

back.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.6), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(BASE, 6), 0, P), { tone: "lo" }));
const BASE_SCREWS = k.corners(BASE, 16);
back.push(Ln(BASE_SCREWS.map(([x, y]) => k.ring(x, y, 3.0, 0, P, 16)).join(""), { tone: "lo" }));
back.push(Dots(BASE_SCREWS.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
const SIDE_TICKS = k.sideTicks(BASE.y + 28, BASE.y + BASE.d - 28, 14, 5, BASE.x + BASE.w, 0, [2.6, 5.2], P, "y");
back.push(Ln(SIDE_TICKS.minor, { tone: "lo" }), Ln(SIDE_TICKS.major, { tone: "mid" }));

// Engraved Nameplate
const LABEL = { x: 142, y: 124, w: 60, d: 42, r: 2 };
back.push(S(k.slabOf(LABEL, 0, 1.2, P, 3), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(LABEL, 2.2), 1.2, P), { tone: "faint" }));
back.push(k.faceTextSvg(k.topMatrix([LABEL.x + 6, LABEL.y + 14], 1.2, P, "x"), "LATENT SPACE", { size: 4.8, tone: "lo" }));
back.push(Ln(
  [
    k.onTop([[LABEL.x + 6, LABEL.y + 23], [LABEL.x + 48, LABEL.y + 23]], 1.2, P),
    k.onTop([[LABEL.x + 6, LABEL.y + 29], [LABEL.x + 34, LABEL.y + 29]], 1.2, P),
  ].join(""),
  { tone: "lo", free: true },
));
back.push(Dots([at([LABEL.x + 4.5, LABEL.y + 4.5, 1.2]), at([LABEL.x + LABEL.w - 4.5, LABEL.y + LABEL.d - 4.5, 1.2])], { size: 0.45 }));

// Routed harness cables
back.push(cable([
  [CONSOLE.x + CONSOLE.w - 1, CONSOLE.y + 20, 6],
  [CONSOLE.x + CONSOLE.w + 7, CONSOLE.y + 20, 6],
  [CONSOLE.x + CONSOLE.w + 7, CONSOLE.y + 20, 1.8],
  [PLINTH.x - 1, CONSOLE.y + 20, 1.8],
  [PLINTH.x - 1, CONSOLE.y + 20, 6],
]));
back.push(cable([
  [PLINTH.x + PLINTH.w - 1, -14, 6],
  [PLINTH.x + PLINTH.w + 9, -14, 6],
  [PLINTH.x + PLINTH.w + 9, -14, 1.8],
  [BANK.x + 1, -14, 1.8],
  [BANK.x + 1, -14, 6],
]));

// Optical Cube Plinth
back.push(S(k.slabOf(PLINTH, 0, CUBE_Z0, P, 4, 0.8), { tone: "mid" }));
back.push(Dots(k.corners(PLINTH, 6).map(([x, y]) => at([x, y, CUBE_Z0])), { size: 0.45 }));

// Cavity floor & back glass walls with edge-to-edge coordinate grid
const x0 = CUBE_CX - CUBE_HALF;
const x1 = CUBE_CX + CUBE_HALF;
const y0 = CUBE_CY - CUBE_HALF;
const y1 = CUBE_CY + CUBE_HALF;

const floorPoly = [at([x0, y0, CUBE_Z0]), at([x1, y0, CUBE_Z0]), at([x1, y1, CUBE_Z0]), at([x0, y1, CUBE_Z0])];
const wallXPoly = [at([x0, y0, CUBE_Z0]), at([x0, y1, CUBE_Z0]), at([x0, y1, CUBE_Z1]), at([x0, y0, CUBE_Z1])];
const wallYPoly = [at([x0, y0, CUBE_Z0]), at([x1, y0, CUBE_Z0]), at([x1, y0, CUBE_Z1]), at([x0, y0, CUBE_Z1])];

back.push(`<path class="lc-cavity-floor" d="${k.pathOf(floorPoly, true)}"/>`);
back.push(`<path class="lc-cavity-wall" d="${k.pathOf(wallXPoly, true)}"/>`);
back.push(`<path class="lc-cavity-wall lc-cavity-wall-b" d="${k.pathOf(wallYPoly, true)}"/>`);

const gridLines = [];
for (let i = 1; i < 6; i++) {
  const gx = x0 + (CUBE_SIZE * i) / 6;
  const gy = y0 + (CUBE_SIZE * i) / 6;
  const gz = CUBE_Z0 + (CUBE_SIZE * i) / 6;
  gridLines.push(seg([gx, y0, CUBE_Z0], [gx, y1, CUBE_Z0]));
  gridLines.push(seg([x0, gy, CUBE_Z0], [x1, gy, CUBE_Z0]));
  gridLines.push(seg([x0, y0, gz], [x0, y1, gz]));
  gridLines.push(seg([x0, y0, gz], [x1, y0, gz]));
}
back.push(Ln(gridLines.join(""), { tone: "faint" }));

// Back 3 stanchions & back rails
back.push(stanchion(x0, y0));
back.push(S(k.slabOf({ x: x0, y: y0 - 2.4, w: CUBE_SIZE, d: 4.8, r: 0.6 }, CUBE_Z0, RAIL_H, P, 2), { tone: "mid" }));
back.push(S(k.slabOf({ x: x0 - 2.4, y: y0, w: 4.8, d: CUBE_SIZE, r: 0.6 }, CUBE_Z0, RAIL_H, P, 2), { tone: "mid" }));
back.push(S(k.slabOf({ x: x0, y: y0 - 2.4, w: CUBE_SIZE, d: 4.8, r: 0.6 }, CUBE_Z1 - RAIL_H, RAIL_H, P, 2), { tone: "hi" }));
back.push(S(k.slabOf({ x: x0 - 2.4, y: y0, w: 4.8, d: CUBE_SIZE, r: 0.6 }, CUBE_Z1 - RAIL_H, RAIL_H, P, 2), { tone: "hi" }));
back.push(stanchion(x0, y1));
back.push(stanchion(x1, y0));

// SVG fallback
const fbRun = M.forward(0);
const toW = (p) => [CUBE_CX + p[0] * 104, CUBE_CY + p[1] * 104, CUBE_CZ + p[2] * 104];
back.push(`<g class="lc-fallback">
  ${Ln(k.pathOf(fbRun.states.map((s) => at(toW(M.project3(s))))), { tone: "lit" })}
  ${Dots(M.FEATURE_POS3.map((p) => at(toW(p))), { size: 1.8 })}
</g>`);

// =========================================================================
// 2. FRONT SVG
// =========================================================================
const front = [];

front.push(S(k.slabOf({ x: x0, y: y1 - 2.4, w: CUBE_SIZE, d: 4.8, r: 0.6 }, CUBE_Z0, RAIL_H, P, 2), { tone: "mid" }));
front.push(S(k.slabOf({ x: x1 - 2.4, y: y0, w: 4.8, d: CUBE_SIZE, r: 0.6 }, CUBE_Z0, RAIL_H, P, 2), { tone: "mid" }));
front.push(S(k.slabOf({ x: x0, y: y1 - 2.4, w: CUBE_SIZE, d: 4.8, r: 0.6 }, CUBE_Z1 - RAIL_H, RAIL_H, P, 2), { tone: "hi" }));
front.push(S(k.slabOf({ x: x1 - 2.4, y: y0, w: 4.8, d: CUBE_SIZE, r: 0.6 }, CUBE_Z1 - RAIL_H, RAIL_H, P, 2), { tone: "hi" }));
front.push(stanchion(x1, y1));

// Prompt Selector Console
front.push(`<g data-hit="knob" class="lc-hit">`);
front.push(S(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 5, 1.0), { tone: "mid" }));
front.push(Ln(k.planOutline(k.insetPlan(CONSOLE, 3.8), CONSOLE_H, P), { tone: "lo" }));
front.push(Dots(k.corners(CONSOLE, 5.5).map(([x, y]) => at([x, y, CONSOLE_H])), { size: 0.45 }));
const detentTicks = [];
for (let i = 0; i < M.PROMPTS.length; i++) {
  const a = -2.1 + (i / (M.PROMPTS.length - 1)) * 4.2;
  const dx = Math.cos(a), dy = Math.sin(a);
  detentTicks.push(seg(
    [KNOB_CX + dx * (KNOB_R + 2), KNOB_CY + dy * (KNOB_R + 2), CONSOLE_H],
    [KNOB_CX + dx * (KNOB_R + 5.2), KNOB_CY + dy * (KNOB_R + 5.2), CONSOLE_H],
  ));
}
front.push(Ln(k.ring(KNOB_CX, KNOB_CY, KNOB_R + 2, CONSOLE_H, P, 36), { tone: "faint" }));
front.push(Ln(detentTicks.join(""), { tone: "mid" }));
front.push(S(k.cylinder(KNOB_CX, KNOB_CY, KNOB_R, CONSOLE_H, 8, P, 36, 0.7), { tone: "hi", crease: "lo" }));
front.push(Ln(k.knurl(KNOB_CX, KNOB_CY, KNOB_R, CONSOLE_H, CONSOLE_H + 8, 36, P), { tone: "lo" }));
front.push(`<path data-part="knob-ptr" data-free="" class="iso-line" data-tone="lit" stroke-width="1.4" d=""/>`);
front.push(S(k.cylinder(CONSOLE.x + 11, CONSOLE.y + 12, 2.4, CONSOLE_H, 1.5, P, 16), { tone: "lit" }));
front.push(`</g>`);

// Layer-Depth Carriage Rail
front.push(`<g data-hit="rail" class="lc-hit">`);
const RULER = { x: RAIL_X0 + 10, y: RAIL_Y + 13, w: RAIL_X1 - RAIL_X0 - 20, d: 9, r: 1 };
front.push(S(k.slabOf(RULER, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
const RT = k.topTicks(RULER.x + 6, RULER.x + RULER.w - 6, (RULER.w - 12) / 24, 4, RULER.y + 0.8, 0.8, [2.2, 4.6], P);
front.push(Ln(RT.minor, { tone: "lo" }), Ln(RT.major, { tone: "mid" }));
for (const ry of [RAIL_Y - 7.5, RAIL_Y + 5.5]) {
  front.push(S(k.slabOf({ x: RAIL_X0, y: ry, w: RAIL_X1 - RAIL_X0, d: 3.8, r: 0.8 }, 0, 3.4, P, 2, 0.3), { tone: "mid" }));
}
for (const sx of [RAIL_X0 - 4.5, RAIL_X1 - 2]) {
  front.push(S(k.slabOf({ x: sx, y: RAIL_Y - 10.5, w: 6.5, d: 23, r: 1.2 }, 0, 9, P, 3, 0.5), { tone: "mid" }));
  front.push(Dots([at([sx + 3.2, RAIL_Y - 6.5, 9]), at([sx + 3.2, RAIL_Y + 8, 9])], { size: 0.45 }));
}
const CAR_CX = (RAIL_X0 + RAIL_X1) / 2;
front.push(`<g data-part="carriage">`);
front.push(S(k.slabOf({ x: CAR_CX - 14, y: RAIL_Y - 10, w: 28, d: 22, r: 2.4 }, 3.4, 6.2, P, 4, 0.6), { tone: "hi", crease: "lo" }));
front.push(Dots([
  at([CAR_CX - 10, RAIL_Y - 6.5, 9.6]),
  at([CAR_CX + 10, RAIL_Y - 6.5, 9.6]),
  at([CAR_CX - 10, RAIL_Y + 7.5, 9.6]),
  at([CAR_CX + 10, RAIL_Y + 7.5, 9.6]),
], { size: 0.45 }));
front.push(S(k.cylinder(CAR_CX, RAIL_Y + 0.8, 4.8, 9.6, 5.6, P, 24, 0.5), { tone: "hi" }));
front.push(Ln(k.knurl(CAR_CX, RAIL_Y + 0.8, 4.8, 9.6, 15.2, 18, P), { tone: "lo" }));
front.push(Ln(seg([CAR_CX, RAIL_Y + 12, 9.6], [CAR_CX, RAIL_Y + 17.5, 0.8]), { tone: "lit", free: true }));
front.push(`</g>`);
front.push(`</g>`);

// Right-Side Logit Lens Readout Bank (5 vertical glass sight-tubes)
front.push(S(k.slabOf(BANK, 0, BANK_H, P, 5, 0.9), { tone: "mid" }));
front.push(Ln(k.planOutline(k.insetPlan(BANK, 3.4), BANK_H, P), { tone: "lo" }));
front.push(Dots(k.corners(BANK, 5).map(([x, y]) => at([x, y, BANK_H])), { size: 0.45 }));

for (let i = 0; i < BAR_ITEMS.length; i++) {
  const b = BAR_ITEMS[i];
  front.push(S(k.cylinder(b.x, b.y, TUBE_R + 2.4, BANK_H, 3.0, P, 24, 0.4), { tone: "mid" }));
  const glass = k.cylinder(b.x, b.y, TUBE_R, BANK_H + 3, TUBE_MAX_H + 4, P, 24);
  front.push(`<path class="lc-tube-glass" d="${glass.fill}"/>`);
  const initBar = k.cylinder(b.x, b.y, b.r, b.z0, 26, P, 20);
  front.push(`<path data-bar="${i}" data-top="0" class="lc-bar" d="${initBar.fill}"/>`);
  front.push(`<path data-bar-cap="${i}" class="iso-line" data-tone="hi" d="${k.ring(b.x, b.y, b.r, b.z0 + 26, P, 20)}"/>`);
  front.push(S(k.cylinder(b.x, b.y, TUBE_R + 1.5, BANK_H + 3 + TUBE_MAX_H + 4, 2.5, P, 24, 0.4), { tone: "hi" }));
}

// Live projected 3D callout labels layer (populated by live.js)
front.push(`<g data-labels class="lc-labels"></g>`);

// =========================================================================
// 3. FULL-VIEWPORT IMMERSIVE HTML + MECHANISTIC TELEMETRY HUD
// =========================================================================
const CSS = `
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
body.iso {
  background: var(--iso-paper, #0f1115) !important;
  color: var(--iso-hi);
  padding: 0 !important;
  margin: 0 !important;
  max-width: none !important;
}
body.iso[data-theme="light"] {
  background: var(--iso-paper, #f6f7f9) !important;
  color: #161b24 !important;
}
.iso-page, main.iso-page {
  max-width: none !important;
  width: 100vw !important;
  height: 100vh !important;
  margin: 0 !important;
  padding: 0 !important;
}

.app-shell {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.viewport-main {
  position: relative;
  flex: 1 1 auto;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 14px;
  min-width: 0;
}

/* Aspect-locked stage filling maximum available viewport height/width while keeping SVG+WebGL 1:1 registered */
.lc-stage {
  position: relative;
  aspect-ratio: ${W} / ${H};
  height: min(98vh, calc((100vw - 340px) * ${H} / ${W}));
  max-height: 98vh;
  max-width: 100%;
  touch-action: none;
  user-select: none;
  cursor: grab;
}
.hud-panel.collapsed ~ .viewport-main .lc-stage,
.app-shell:has(.hud-panel.collapsed) .lc-stage {
  height: min(98vh, calc(98vw * ${H} / ${W}));
}
.lc-stage:active { cursor: grabbing; }
.lc-stage > svg, .lc-stage > canvas { display: block; width: 100%; height: 100%; }
.lc-stage > .lc-layer { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.lc-stage .lc-hit { pointer-events: visiblePainted; cursor: pointer; }
.lc-stage[data-gl] .lc-fallback { display: none; }
.iso:not([data-theme="light"]) .lc-gl { mix-blend-mode: screen; }

/* Cavity & Sight-tube styling */
.lc-cavity-floor { fill: rgba(16, 24, 38, 0.56); stroke: var(--iso-faint); stroke-width: 0.6; }
.lc-cavity-wall { fill: rgba(12, 18, 30, 0.38); stroke: var(--iso-faint); stroke-width: 0.6; }
.lc-cavity-wall-b { fill: rgba(9, 14, 24, 0.46); }
.iso[data-theme="light"] .lc-cavity-floor { fill: rgba(212, 224, 238, 0.58); }
.iso[data-theme="light"] .lc-cavity-wall { fill: rgba(226, 235, 245, 0.44); }
.iso[data-theme="light"] .lc-cavity-wall-b { fill: rgba(218, 229, 241, 0.52); }

.lc-tube-glass { fill: rgba(140, 180, 230, 0.08); stroke: var(--iso-lo); stroke-width: 0.6; }
.iso[data-theme="light"] .lc-tube-glass { fill: rgba(40, 70, 110, 0.06); }
.lc-bar { fill: rgba(96, 178, 255, 0.52); stroke: var(--iso-mid); stroke-width: 0.6; transition: fill 0.18s; }
.lc-bar[data-top="1"] { fill: rgba(255, 220, 138, 0.88); stroke: var(--iso-lit); }
.iso[data-theme="light"] .lc-bar { fill: rgba(34, 108, 178, 0.48); }
.iso[data-theme="light"] .lc-bar[data-top="1"] { fill: rgba(196, 62, 36, 0.84); }

/* Projected 3D SVG semantic callouts */
.lc-labels text {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 9.5px;
  letter-spacing: 0.02em;
  paint-order: stroke;
  stroke: rgba(10, 12, 16, 0.85);
  stroke-width: 3px;
  stroke-linejoin: round;
}
.iso[data-theme="light"] .lc-labels text {
  stroke: rgba(248, 249, 251, 0.92);
}
.lc-tag text { fill: rgba(225, 232, 242, 0.72); font-size: 9.5px; }
.lc-tag-top text { fill: #ffe08a; font-weight: 700; font-size: 10.5px; }
.iso[data-theme="light"] .lc-tag text { fill: rgba(35, 45, 60, 0.72); }
.iso[data-theme="light"] .lc-tag-top text { fill: #b8321c; font-weight: 700; }
.lc-feat-tag text { font-size: 9px; font-weight: 600; }
.lc-feat-tag.is-hov text { font-size: 10.5px; font-weight: 700; }
.lc-cursor-tag text { fill: #ffffff; font-size: 10px; font-weight: 700; }
.iso[data-theme="light"] .lc-cursor-tag text { fill: #0e2a66; }

/* Top-left floating badge */
.top-badge {
  position: absolute;
  top: 16px;
  left: 20px;
  z-index: 10;
  pointer-events: none;
}
.top-badge .kicker {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.55;
}
.top-badge .title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-top: 2px;
}
.top-badge .sub {
  font-size: 10.5px;
  opacity: 0.62;
  margin-top: 3px;
}

/* Bottom-left quick hint */
.bottom-hint {
  position: absolute;
  bottom: 14px;
  left: 20px;
  z-index: 10;
  font-size: 10px;
  letter-spacing: 0.06em;
  opacity: 0.5;
  pointer-events: none;
}

/* Right-side Mechanistic Telemetry Inspector */
.hud-panel {
  position: relative;
  flex: 0 0 330px;
  height: 100vh;
  background: rgba(15, 18, 24, 0.88);
  border-left: 1px solid rgba(255, 255, 255, 0.09);
  backdrop-filter: blur(12px);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  z-index: 20;
  transition: flex-basis 0.25s ease, padding 0.25s ease, opacity 0.2s ease;
}
.iso[data-theme="light"] .hud-panel {
  background: rgba(246, 248, 251, 0.92);
  border-left-color: rgba(15, 25, 40, 0.12);
}
.hud-panel.collapsed {
  flex-basis: 0;
  padding: 0;
  border-left: none;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.panel-toggle-btn {
  position: absolute;
  top: 14px;
  right: 16px;
  z-index: 30;
  background: rgba(255, 255, 255, 0.07);
  color: inherit;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 5px;
  padding: 5px 10px;
  font: 10px/1 ui-monospace, monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}
.iso[data-theme="light"] .panel-toggle-btn {
  background: rgba(15, 25, 40, 0.06);
  border-color: rgba(15, 25, 40, 0.16);
}
.hud-panel:not(.collapsed) ~ .panel-toggle-btn { right: 344px; }

.hud-section {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 10px;
}
.hud-section:first-child { border-top: none; padding-top: 0; }
.iso[data-theme="light"] .hud-section { border-top-color: rgba(15, 25, 40, 0.1); }

.hud-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.6;
  margin-bottom: 7px;
}

.hud-prompts { display: flex; flex-direction: column; gap: 4px; }
.hud-prompt-btn {
  text-align: left;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 5px;
  padding: 6px 8px;
  font: 11px/1.25 ui-monospace, monospace;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.hud-prompt-btn:hover { background: rgba(255, 255, 255, 0.09); }
.hud-prompt-btn.active {
  background: rgba(96, 178, 255, 0.16);
  border-color: rgba(130, 200, 255, 0.55);
  font-weight: 700;
}
.iso[data-theme="light"] .hud-prompt-btn {
  background: rgba(15, 25, 40, 0.03);
  border-color: rgba(15, 25, 40, 0.10);
}
.iso[data-theme="light"] .hud-prompt-btn.active {
  background: rgba(24, 96, 176, 0.12);
  border-color: rgba(24, 96, 176, 0.45);
}

.hud-controls {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}
.hud-btn {
  flex: 1;
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  padding: 5px 6px;
  font: 10px/1 ui-monospace, monospace;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}
.hud-btn.active {
  background: rgba(96, 178, 255, 0.2);
  border-color: rgba(130, 200, 255, 0.5);
}
.iso[data-theme="light"] .hud-btn {
  background: rgba(15, 25, 40, 0.05);
  border-color: rgba(15, 25, 40, 0.14);
}

input[type="range"].hud-slider {
  width: 100%;
  accent-color: #6cc2ff;
  cursor: pointer;
}

.hud-note {
  font-size: 11px;
  line-height: 1.45;
  padding: 8px 9px;
  border-radius: 5px;
  background: rgba(96, 178, 255, 0.08);
  border-left: 2px solid #6cc2ff;
  opacity: 0.92;
}
.iso[data-theme="light"] .hud-note {
  background: rgba(24, 96, 176, 0.07);
  border-left-color: #1860b0;
}

.hud-steer-badge {
  font-size: 9px;
  padding: 2px 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.07);
}
.hud-steer-badge.active {
  background: rgba(255, 168, 66, 0.24);
  color: #ffc272;
}
.iso[data-theme="light"] .hud-steer-badge.active {
  background: rgba(204, 88, 24, 0.16);
  color: #a83c0c;
}

/* 8-D Residual Stream bipolar bars */
.hud-vec-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 10px;
}
.hud-vec-row {
  display: grid;
  grid-template-columns: 20px 1fr 34px;
  align-items: center;
  gap: 5px;
  font-size: 9.5px;
}
.hud-vec-track {
  position: relative;
  height: 6px;
  background: rgba(255, 255, 255, 0.07);
  border-radius: 2px;
  overflow: hidden;
}
.iso[data-theme="light"] .hud-vec-track { background: rgba(15, 25, 40, 0.09); }
.hud-vec-track::after {
  content: "";
  position: absolute;
  left: 50%; top: 0; bottom: 0; width: 1px;
  background: rgba(255, 255, 255, 0.22);
}
.hud-vec-fill {
  position: absolute;
  top: 0; bottom: 0;
  background: #5ec2ff;
}
.hud-vec-fill.neg { background: #ff9c54; }
.hud-vec-val { text-align: right; opacity: 0.72; font-variant-numeric: tabular-nums; }

/* Active SAE Features */
.hud-feat-list { display: flex; flex-direction: column; gap: 5px; }
.hud-feat-row {
  display: grid;
  grid-template-columns: 7px 1fr 48px 28px;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}
.hud-dot { width: 6px; height: 6px; border-radius: 50%; }
.hud-feat-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hud-feat-bar { height: 5px; background: rgba(255, 255, 255, 0.08); border-radius: 2px; overflow: hidden; }
.iso[data-theme="light"] .hud-feat-bar { background: rgba(15, 25, 40, 0.09); }
.hud-feat-bar i { display: block; height: 100%; border-radius: 2px; }
.hud-feat-num { text-align: right; opacity: 0.72; font-variant-numeric: tabular-nums; }

/* Logit Lens tokens */
.hud-tok-list { display: flex; flex-direction: column; gap: 5px; }
.hud-tok-row {
  display: grid;
  grid-template-columns: 62px 1fr 32px;
  align-items: center;
  gap: 7px;
  font-size: 10.5px;
}
.hud-tok-track { height: 7px; background: rgba(255, 255, 255, 0.08); border-radius: 3px; overflow: hidden; }
.iso[data-theme="light"] .hud-tok-track { background: rgba(15, 25, 40, 0.09); }
.hud-tok-fill { height: 100%; background: rgba(96, 178, 255, 0.65); border-radius: 3px; transition: width 0.06s linear; }
.hud-tok-fill.top { background: #ffd875; }
.iso[data-theme="light"] .hud-tok-fill.top { background: #c43e24; }
.hud-tok-pct { text-align: right; font-variant-numeric: tabular-nums; opacity: 0.85; }

@media (max-width: 900px) {
  .app-shell { flex-direction: column; height: auto; overflow-y: auto; }
  html, body { overflow: auto; }
  .viewport-main { width: 100%; height: 66vh; }
  .lc-stage { height: min(64vh, calc(96vw * ${H} / ${W})); }
  .hud-panel { width: 100%; flex: none; height: auto; border-left: none; border-top: 1px solid rgba(255,255,255,0.1); }
  .panel-toggle-btn { display: none; }
}
`;

const DATA = {
  W,
  H,
  P,
  camera: glCamera(P),
  cube: {
    cx: CUBE_CX,
    cy: CUBE_CY,
    cz: CUBE_CZ,
    z0: CUBE_Z0,
    half: 104,
    vbCenter: at([CUBE_CX, CUBE_CY, CUBE_CZ]),
  },
  knob: { cx: KNOB_CX, cy: KNOB_CY, z: KNOB_Z + 8 },
  rail: {
    span: RAIL_SPAN,
    vbX0: at([RAIL_X0 + 18, RAIL_Y, 0])[0],
    vbX1: at([RAIL_X1 - 18, RAIL_Y, 0])[0],
  },
  bars: { maxH: TUBE_MAX_H, items: BAR_ITEMS },
};

const stripExport = (src) => src.replace(/^export\s+(?=(const|let|var|function|class)\b)/gm, "");
const kitSrc = stripExport(readFileSync(join(KIT_DIR, "iso-kit.mjs"), "utf8"));
const glSrc = stripExport(readFileSync(join(KIT_DIR, "gl.mjs"), "utf8"));
const modelSrc = stripExport(readFileSync(join(HERE, "model.mjs"), "utf8"));
const liveSrc = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));

const backSvg = k.figureSvg({
  width: W,
  height: H,
  label: "Full-viewport isometric optical latent-space chamber showing a 3D PCA slice of an 8-dimensional residual stream, 48 sparse autoencoder features, 16 pulsing circuit filaments, discrete layer trajectory, and 5 Logit Lens probability gauges.",
  body: back.join("\n"),
});
const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg lc-layer" viewBox="0 0 ${W} ${H}" aria-hidden="true">${front.join("\n")}</svg>`;

const promptBtnsHtml = M.PROMPTS.map(
  (p, i) => `<button class="hud-prompt-btn${i === 0 ? " active" : ""}" data-prompt-btn="${i}">${i + 1}. "${p.text}"</button>`,
).join("\n");

const vecBarsHtml = Array.from({ length: 8 }, (_, d) =>
  `<div class="hud-vec-row"><span>d${d}</span><span class="hud-vec-track"><span class="hud-vec-fill" data-vec-bar="${d}"></span></span><span class="hud-vec-val" data-vec-val="${d}">+0.00</span></div>`,
).join("\n");

const tokenBarsHtml = M.TOKENS.map(
  (t, i) => `<div class="hud-tok-row"><span>${t.text}</span><span class="hud-tok-track"><div class="hud-tok-fill" data-tok-bar="${i}" style="width:20%"></div></span><span class="hud-tok-pct" data-tok-pct="${i}">20%</span></div>`,
).join("\n");

const bodyHtml = `
<style>${CSS}</style>
<div class="app-shell">
  <main class="viewport-main">
    <div class="top-badge">
      <div class="kicker">Fig 1 · Real-Time Transformer Mechanistic Chamber</div>
      <div class="title">LLM Latent Space</div>
      <div class="sub">d_model = 8 → PCA 3D · 48 SAE Features · L = 6 Layers · Logit Lens</div>
    </div>
    <div class="lc-stage" tabindex="0">
      ${backSvg}
      <canvas class="lc-layer lc-gl" aria-hidden="true"></canvas>
      ${frontSvg}
    </div>
    <div class="bottom-hint">DRAG RAIL (L0→L6) · CLICK KNOB (PROMPT) · DRAG CUBE (3D→8D STEER) · HOVER NODES · SPACE (PLAY)</div>
  </main>

  <aside class="hud-panel">
    <div class="hud-section">
      <div class="hud-label"><span>Prompt Context</span><span>1–5</span></div>
      <div class="hud-prompts">${promptBtnsHtml}</div>
    </div>

    <div class="hud-section">
      <div class="hud-label"><span>Layer Depth (4th Dim)</span><span data-layer-val>L4.2 / 6.0</span></div>
      <input type="range" class="hud-slider" data-layer-slider min="0" max="6" step="0.05" value="4.2"/>
      <div class="hud-controls">
        <button class="hud-btn" data-play-btn>Pause</button>
        <button class="hud-btn active" data-labels-btn>Labels</button>
        <button class="hud-btn" data-theme-btn>${theme === "light" ? "Dark" : "Light"}</button>
      </div>
    </div>

    <div class="hud-section">
      <div class="hud-label"><span>Active Layer Mechanism</span><span class="hud-steer-badge" data-steer-badge>UNSTEERED</span></div>
      <div class="hud-note" data-stage-note>Loading layer state…</div>
    </div>

    <div class="hud-section">
      <div class="hud-label"><span>Residual Stream x(l) ∈ ℝ⁸</span><span>Unit Norm</span></div>
      <div class="hud-vec-grid">${vecBarsHtml}</div>
    </div>

    <div class="hud-section">
      <div class="hud-label"><span>Top Firing SAE Features</span><span>48 Dict</span></div>
      <div class="hud-feat-list" data-feat-list></div>
    </div>

    <div class="hud-section">
      <div class="hud-label"><span>Logit Lens · W_U Softmax</span><span data-entropy>0.48 bits</span></div>
      <div class="hud-tok-list">${tokenBarsHtml}</div>
    </div>
  </aside>

  <button class="panel-toggle-btn" data-panel-toggle>Hide</button>
</div>
`;

const html = k.pageHtml({
  title: "LLM Latent Space Chamber — Anatomy v2",
  theme,
  body: bodyHtml,
  script: [kitSrc, glSrc, modelSrc, liveSrc].join("\n;\n"),
});

const outFile = join(HERE, theme === "light" ? "index-light.html" : "index.html");
writeFileSync(outFile, html, "utf8");
console.log(`Built ${outFile} (${(html.length / 1024).toFixed(1)} KB)`);
