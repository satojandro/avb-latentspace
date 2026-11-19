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

const W = 780;
const H = 700;
const AZIMUTH = 38;
const ELEVATION = 31;

// --- World layout (all coordinates in world units, z up) ---
const BASE_H = 14;
const FOOT_H = 7;
const BASE = { x: -172, y: -136, w: 356, d: 294, r: 12 };

// Optical Cube Chamber (180 x 180 x 180 cube centered at (0, -14, 102))
const CUBE_CX = 0;
const CUBE_CY = -14;
const CUBE_Z0 = 12;
const CUBE_SIZE = 180;
const CUBE_Z1 = CUBE_Z0 + CUBE_SIZE; // 192
const CUBE_HALF = CUBE_SIZE / 2;      // 90
const CUBE_CZ = CUBE_Z0 + CUBE_HALF;  // 102
const PLINTH = { x: CUBE_CX - 98, y: CUBE_CY - 98, w: 196, d: 196, r: 4 };
const POST_W = 6;
const RAIL_H = 4.5;

// Front-Left Prompt Selector Console
const CONSOLE = { x: -158, y: 22, w: 46, d: 68, r: 4 };
const CONSOLE_H = 20;
const KNOB_CX = CONSOLE.x + 23;
const KNOB_CY = CONSOLE.y + 38;
const KNOB_R = 11.5;
const KNOB_Z = CONSOLE_H;

// Front Layer-Depth Carriage Rail (L0 -> L6)
const RAIL_Y = 114;
const RAIL_X0 = -124;
const RAIL_X1 = 104;
const RAIL_SPAN = RAIL_X1 - RAIL_X0 - 34; // travel of carriage center

// Right-Side Logit Lens Readout Bank (5 sight-tubes)
const BANK = { x: 114, y: -98, w: 52, d: 174, r: 4 };
const BANK_H = 14;
const TUBE_MAX_H = 68;
const TUBE_R = 5.4;
const BAR_ITEMS = M.TOKENS.map((tok, i) => ({
  id: tok.id,
  text: tok.text,
  x: BANK.x + 26,
  y: BANK.y + 23 + i * 32,
  r: TUBE_R - 1.2,
  z0: BANK_H + 3,
}));

// Fit isometric projection cleanly around the entire apparatus
const P = k.fitProjection(
  [
    ...k.boxCorners(BASE, -BASE_H - FOOT_H, 0),
    ...k.boxCorners(PLINTH, 0, CUBE_Z1 + 10),
    ...k.boxCorners(BANK, 0, BANK_H + TUBE_MAX_H + 14),
    ...k.boxCorners(CONSOLE, 0, CONSOLE_H + 12),
  ],
  W,
  H,
  { pad: 44, azimuth: AZIMUTH, elevation: ELEVATION },
);

const at = (pt) => k.iso(pt, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (pts, style) => k.dotsSvg(pts, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const seg = (a, b) => k.pathOf([at(a), at(b)]);

function cable(points, r = 1.4) {
  return tubePieces(G.fillet(points, 5, 8), r, P, { maxLength: 14, spacing: 1.2 })
    .map((piece) => tubeSvg(piece, { tone: "mid" }))
    .join("");
}

function stanchion(cx, cy) {
  const out = [];
  // Base collar
  out.push(S(k.slabOf({ x: cx - 5.5, y: cy - 5.5, w: 11, d: 11, r: 1.4 }, CUBE_Z0, 4.5, P, 3, 0.4), { tone: "mid" }));
  // Main square post
  out.push(S(k.slabOf({ x: cx - POST_W / 2, y: cy - POST_W / 2, w: POST_W, d: POST_W, r: 0.8 }, CUBE_Z0 + 4.5, CUBE_SIZE - 9, P, 2, 0.3), { tone: "hi", crease: "lo" }));
  // Top cap flange
  out.push(S(k.slabOf({ x: cx - 5.5, y: cy - 5.5, w: 11, d: 11, r: 1.4 }, CUBE_Z1 - 4.5, 4.5, P, 3, 0.4), { tone: "hi" }));
  out.push(Dots([at([cx, cy, CUBE_Z1])], { size: 0.5 }));
  return out.join("");
}

// =========================================================================
// 1. BACK SVG (everything behind the volumetric WebGL cube interior)
// =========================================================================
const back = [];

// Bench shadow halo + 4 flanged feet
back.push(`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`);
const FEET = byDepth(k.corners(BASE, 26));
for (const [x, y] of FEET) {
  back.push(S(k.cylinder(x, y, 10, -BASE_H - FOOT_H, 2.2, P, 28), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 7.6, -BASE_H - FOOT_H + 2.2, FOOT_H - 2.2, P, 28), { tone: "mid" }));
}

// Heavy machined bench base plate
back.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.6), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(BASE, 6), 0, P), { tone: "lo" }));
const BASE_SCREWS = k.corners(BASE, 14);
back.push(Ln(BASE_SCREWS.map(([x, y]) => k.ring(x, y, 2.8, 0, P, 16)).join(""), { tone: "lo" }));
back.push(Dots(BASE_SCREWS.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
const SIDE_TICKS = k.sideTicks(BASE.y + 24, BASE.y + BASE.d - 24, 12, 5, BASE.x + BASE.w, 0, [2.4, 4.8], P, "y");
back.push(Ln(SIDE_TICKS.minor, { tone: "lo" }), Ln(SIDE_TICKS.major, { tone: "mid" }));

// Engraved Nameplate on front-right bench corner
const LABEL = { x: 114, y: 98, w: 54, d: 38, r: 2 };
back.push(S(k.slabOf(LABEL, 0, 1.2, P, 3), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(LABEL, 2.0), 1.2, P), { tone: "faint" }));
back.push(k.faceTextSvg(k.topMatrix([LABEL.x + 6, LABEL.y + 13], 1.2, P, "x"), "LATENT SPACE", { size: 4.5, tone: "lo" }));
back.push(Ln(
  [
    k.onTop([[LABEL.x + 6, LABEL.y + 21], [LABEL.x + 42, LABEL.y + 21]], 1.2, P),
    k.onTop([[LABEL.x + 6, LABEL.y + 26], [LABEL.x + 31, LABEL.y + 26]], 1.2, P),
  ].join(""),
  { tone: "lo", free: true },
));
back.push(Dots([at([LABEL.x + 4, LABEL.y + 4, 1.2]), at([LABEL.x + LABEL.w - 4, LABEL.y + LABEL.d - 4, 1.2])], { size: 0.45 }));

// Routed harness cables (Console -> Plinth, Plinth -> Logit Bank)
back.push(cable([
  [CONSOLE.x + CONSOLE.w - 1, CONSOLE.y + 18, 6],
  [CONSOLE.x + CONSOLE.w + 7, CONSOLE.y + 18, 6],
  [CONSOLE.x + CONSOLE.w + 7, CONSOLE.y + 18, 1.6],
  [PLINTH.x - 1, CONSOLE.y + 18, 1.6],
  [PLINTH.x - 1, CONSOLE.y + 18, 6],
]));
back.push(cable([
  [PLINTH.x + PLINTH.w - 1, -14, 6],
  [PLINTH.x + PLINTH.w + 8, -14, 6],
  [PLINTH.x + PLINTH.w + 8, -14, 1.6],
  [BANK.x + 1, -14, 1.6],
  [BANK.x + 1, -14, 6],
]));

// Optical Cube Plinth
back.push(S(k.slabOf(PLINTH, 0, CUBE_Z0, P, 4, 0.8), { tone: "mid" }));
back.push(Dots(k.corners(PLINTH, 5.5).map(([x, y]) => at([x, y, CUBE_Z0])), { size: 0.45 }));

// Back inner cavity floor + edge-to-edge PC1/PC2 coordinate grid
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

// Edge-to-edge subtle coordinate grid on cavity floor & back walls (zero floating ends!)
const gridLines = [];
for (let i = 1; i < 6; i++) {
  const gx = x0 + (CUBE_SIZE * i) / 6;
  const gy = y0 + (CUBE_SIZE * i) / 6;
  const gz = CUBE_Z0 + (CUBE_SIZE * i) / 6;
  // Floor grid
  gridLines.push(seg([gx, y0, CUBE_Z0], [gx, y1, CUBE_Z0]));
  gridLines.push(seg([x0, gy, CUBE_Z0], [x1, gy, CUBE_Z0]));
  // Back wall horizontal strata (layers L1..L5)
  gridLines.push(seg([x0, y0, gz], [x0, y1, gz]));
  gridLines.push(seg([x0, y0, gz], [x1, y0, gz]));
}
back.push(Ln(gridLines.join(""), { tone: "faint" }));

// Back 3 stanchions & back frame rails
back.push(stanchion(x0, y0));
back.push(S(k.slabOf({ x: x0, y: y0 - 2.2, w: CUBE_SIZE, d: 4.4, r: 0.6 }, CUBE_Z0, RAIL_H, P, 2), { tone: "mid" }));
back.push(S(k.slabOf({ x: x0 - 2.2, y: y0, w: 4.4, d: CUBE_SIZE, r: 0.6 }, CUBE_Z0, RAIL_H, P, 2), { tone: "mid" }));
back.push(S(k.slabOf({ x: x0, y: y0 - 2.2, w: CUBE_SIZE, d: 4.4, r: 0.6 }, CUBE_Z1 - RAIL_H, RAIL_H, P, 2), { tone: "hi" }));
back.push(S(k.slabOf({ x: x0 - 2.2, y: y0, w: 4.4, d: CUBE_SIZE, r: 0.6 }, CUBE_Z1 - RAIL_H, RAIL_H, P, 2), { tone: "hi" }));
back.push(stanchion(x0, y1));
back.push(stanchion(x1, y0));

// SVG fallback (shown only when WebGL is unavailable)
const fbRun = M.forward(0);
const toW = (p) => [CUBE_CX + p[0] * 82, CUBE_CY + p[1] * 82, CUBE_CZ + p[2] * 82];
const fbTraj = fbRun.states.map((s) => at(toW(M.project3(s))));
const fbNodes = M.FEATURE_POS3.map((p) => at(toW(p)));
back.push(`<g class="lc-fallback">
  ${Ln(k.pathOf(fbTraj), { tone: "lit" })}
  ${Dots(fbNodes, { size: 1.6 })}
</g>`);

// =========================================================================
// 2. FRONT SVG (front glass frame + interactive bench instruments)
// =========================================================================
const front = [];

// Front 2 bottom & top frame rails + front-near stanchion
front.push(S(k.slabOf({ x: x0, y: y1 - 2.2, w: CUBE_SIZE, d: 4.4, r: 0.6 }, CUBE_Z0, RAIL_H, P, 2), { tone: "mid" }));
front.push(S(k.slabOf({ x: x1 - 2.2, y: y0, w: 4.4, d: CUBE_SIZE, r: 0.6 }, CUBE_Z0, RAIL_H, P, 2), { tone: "mid" }));
front.push(S(k.slabOf({ x: x0, y: y1 - 2.2, w: CUBE_SIZE, d: 4.4, r: 0.6 }, CUBE_Z1 - RAIL_H, RAIL_H, P, 2), { tone: "hi" }));
front.push(S(k.slabOf({ x: x1 - 2.2, y: y0, w: 4.4, d: CUBE_SIZE, r: 0.6 }, CUBE_Z1 - RAIL_H, RAIL_H, P, 2), { tone: "hi" }));
front.push(stanchion(x1, y1));

// Front-Left Prompt Selector Console (interactive rotary knob)
front.push(`<g data-hit="knob" class="lc-hit">`);
front.push(S(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 5, 1.0), { tone: "mid" }));
front.push(Ln(k.planOutline(k.insetPlan(CONSOLE, 3.5), CONSOLE_H, P), { tone: "lo" }));
front.push(Dots(k.corners(CONSOLE, 5.2).map(([x, y]) => at([x, y, CONSOLE_H])), { size: 0.42 }));
// 5 detent ticks around the knob
const detentTicks = [];
for (let i = 0; i < M.PROMPTS.length; i++) {
  const a = -2.1 + (i / (M.PROMPTS.length - 1)) * 4.2;
  const dx = Math.cos(a), dy = Math.sin(a);
  detentTicks.push(seg(
    [KNOB_CX + dx * (KNOB_R + 1.8), KNOB_CY + dy * (KNOB_R + 1.8), CONSOLE_H],
    [KNOB_CX + dx * (KNOB_R + 4.8), KNOB_CY + dy * (KNOB_R + 4.8), CONSOLE_H],
  ));
}
front.push(Ln(k.ring(KNOB_CX, KNOB_CY, KNOB_R + 1.8, CONSOLE_H, P, 36), { tone: "faint" }));
front.push(Ln(detentTicks.join(""), { tone: "mid" }));
// Knurled rotary knob body
front.push(S(k.cylinder(KNOB_CX, KNOB_CY, KNOB_R, CONSOLE_H, 7.5, P, 36, 0.7), { tone: "hi", crease: "lo" }));
front.push(Ln(k.knurl(KNOB_CX, KNOB_CY, KNOB_R, CONSOLE_H, CONSOLE_H + 7.5, 36, P), { tone: "lo" }));
front.push(`<path data-part="knob-ptr" data-free="" class="iso-line" data-tone="lit" stroke-width="1.35" d=""/>`);
// Tiny status LED
front.push(S(k.cylinder(CONSOLE.x + 10, CONSOLE.y + 11, 2.2, CONSOLE_H, 1.4, P, 16), { tone: "lit" }));
front.push(`</g>`);

// Front Layer-Depth Carriage Rail (L0 -> L6 interactive slider)
front.push(`<g data-hit="rail" class="lc-hit">`);
// Ruler strip with L0..L6 ticks
const RULER = { x: RAIL_X0 + 10, y: RAIL_Y + 12, w: RAIL_X1 - RAIL_X0 - 20, d: 8, r: 1 };
front.push(S(k.slabOf(RULER, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
const RT = k.topTicks(RULER.x + 6, RULER.x + RULER.w - 6, (RULER.w - 12) / 24, 4, RULER.y + 0.8, 0.8, [2.0, 4.2], P);
front.push(Ln(RT.minor, { tone: "lo" }), Ln(RT.major, { tone: "mid" }));
// Twin machined steel rails
for (const ry of [RAIL_Y - 7, RAIL_Y + 5]) {
  front.push(S(k.slabOf({ x: RAIL_X0, y: ry, w: RAIL_X1 - RAIL_X0, d: 3.6, r: 0.8 }, 0, 3.2, P, 2, 0.3), { tone: "mid" }));
}
// Left & right end stops
for (const sx of [RAIL_X0 - 4, RAIL_X1 - 2]) {
  front.push(S(k.slabOf({ x: sx, y: RAIL_Y - 10, w: 6, d: 21.5, r: 1.2 }, 0, 8.5, P, 3, 0.5), { tone: "mid" }));
  front.push(Dots([at([sx + 3, RAIL_Y - 6, 8.5]), at([sx + 3, RAIL_Y + 7.5, 8.5])], { size: 0.45 }));
}
// Sliding vernier carriage (built centered at x = (RAIL_X0 + RAIL_X1)/2, translated live)
const CAR_CX = (RAIL_X0 + RAIL_X1) / 2;
front.push(`<g data-part="carriage">`);
front.push(S(k.slabOf({ x: CAR_CX - 13, y: RAIL_Y - 9.5, w: 26, d: 20.5, r: 2.2 }, 3.2, 5.8, P, 4, 0.6), { tone: "hi", crease: "lo" }));
// Corner bushings + thumb knob + lit index pointer
front.push(Dots([
  at([CAR_CX - 9, RAIL_Y - 6, 9]),
  at([CAR_CX + 9, RAIL_Y - 6, 9]),
  at([CAR_CX - 9, RAIL_Y + 7, 9]),
  at([CAR_CX + 9, RAIL_Y + 7, 9]),
], { size: 0.45 }));
front.push(S(k.cylinder(CAR_CX, RAIL_Y + 0.8, 4.4, 9, 5.2, P, 24, 0.5), { tone: "hi" }));
front.push(Ln(k.knurl(CAR_CX, RAIL_Y + 0.8, 4.4, 9, 14.2, 18, P), { tone: "lo" }));
front.push(Ln(seg([CAR_CX, RAIL_Y + 11, 9], [CAR_CX, RAIL_Y + 16, 0.8]), { tone: "lit", free: true }));
front.push(`</g>`);
front.push(`</g>`);

// Right-Side Logit Lens Readout Bank (5 vertical graduated sight-tubes)
front.push(S(k.slabOf(BANK, 0, BANK_H, P, 5, 0.9), { tone: "mid" }));
front.push(Ln(k.planOutline(k.insetPlan(BANK, 3.2), BANK_H, P), { tone: "lo" }));
front.push(Dots(k.corners(BANK, 4.8).map(([x, y]) => at([x, y, BANK_H])), { size: 0.45 }));

for (let i = 0; i < BAR_ITEMS.length; i++) {
  const b = BAR_ITEMS[i];
  // Base flange
  front.push(S(k.cylinder(b.x, b.y, TUBE_R + 2.2, BANK_H, 3.0, P, 24, 0.4), { tone: "mid" }));
  // Outer glass cylinder body (full silhouette fill + crisp outline)
  const glass = k.cylinder(b.x, b.y, TUBE_R, BANK_H + 3, TUBE_MAX_H + 4, P, 24);
  front.push(`<path class="lc-tube-glass" d="${glass.fill}"/>`);
  // Live probability column (updated per frame via .fill)
  const initBar = k.cylinder(b.x, b.y, b.r, b.z0, 22, P, 20);
  front.push(`<path data-bar="${i}" data-top="0" class="lc-bar" d="${initBar.fill}"/>`);
  front.push(`<path data-bar-cap="${i}" class="iso-line" data-tone="hi" d="${k.ring(b.x, b.y, b.r, b.z0 + 22, P, 20)}"/>`);
  // Top metal cap ring
  front.push(S(k.cylinder(b.x, b.y, TUBE_R + 1.4, BANK_H + 3 + TUBE_MAX_H + 4, 2.4, P, 24, 0.4), { tone: "hi" }));
}

// =========================================================================
// 3. ASSEMBLE STANDALONE HTML PAGE
// =========================================================================
const CSS = `
.lc-stage { position: relative; touch-action: none; user-select: none; cursor: grab; }
.lc-stage:active { cursor: grabbing; }
.lc-stage > svg, .lc-stage > canvas { display: block; width: 100%; height: auto; }
.lc-stage > .lc-layer { position: absolute; inset: 0; height: 100% !important; pointer-events: none; }
.lc-stage .lc-hit { pointer-events: visiblePainted; cursor: pointer; }
.lc-stage[data-gl] .lc-fallback { display: none; }
.iso:not([data-theme="light"]) .lc-gl { mix-blend-mode: screen; }

.lc-cavity-floor { fill: rgba(18, 26, 38, 0.52); stroke: var(--iso-faint); stroke-width: 0.6; }
.lc-cavity-wall { fill: rgba(14, 20, 32, 0.36); stroke: var(--iso-faint); stroke-width: 0.6; }
.lc-cavity-wall-b { fill: rgba(10, 16, 26, 0.44); }
.iso[data-theme="light"] .lc-cavity-floor { fill: rgba(214, 224, 236, 0.55); }
.iso[data-theme="light"] .lc-cavity-wall { fill: rgba(226, 234, 243, 0.42); }
.iso[data-theme="light"] .lc-cavity-wall-b { fill: rgba(218, 228, 239, 0.50); }

.lc-tube-glass { fill: rgba(140, 180, 230, 0.08); stroke: var(--iso-lo); stroke-width: 0.6; }
.iso[data-theme="light"] .lc-tube-glass { fill: rgba(40, 70, 110, 0.06); }

.lc-bar { fill: rgba(96, 178, 255, 0.52); stroke: var(--iso-mid); stroke-width: 0.6; transition: fill 0.18s; }
.lc-bar[data-top="1"] { fill: rgba(255, 220, 138, 0.88); stroke: var(--iso-lit); }
.iso[data-theme="light"] .lc-bar { fill: rgba(34, 108, 178, 0.48); }
.iso[data-theme="light"] .lc-bar[data-top="1"] { fill: rgba(196, 62, 36, 0.82); }
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
    half: 82,
    vbCenter: at([CUBE_CX, CUBE_CY, CUBE_CZ]),
  },
  knob: { cx: KNOB_CX, cy: KNOB_CY, z: KNOB_Z + 7.5 },
  rail: {
    span: RAIL_SPAN,
    vbX0: at([RAIL_X0 + 17, RAIL_Y, 0])[0],
    vbX1: at([RAIL_X1 - 17, RAIL_Y, 0])[0],
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
  label: "Isometric optical latent-space chamber showing a 3D PCA slice of an 8-dimensional residual stream, 24 sparse autoencoder features, circuit filaments, layer-depth trajectory, and 5 Logit Lens probability gauges.",
  body: back.join("\n"),
});
const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg lc-layer" viewBox="0 0 ${W} ${H}" aria-hidden="true">${front.join("\n")}</svg>`;
const stageHtml = `<div class="lc-stage" tabindex="0">${backSvg}<canvas class="lc-layer lc-gl" aria-hidden="true"></canvas>${frontSvg}</div>`;

const plate = k.plateHtml({
  fig: "Fig 1",
  title: "LLM Latent Space Chamber",
  hint: "Rail · Knob · Cube",
  readout: `"The capital of France is" → Paris 93% · L4.2`,
  legend: [
    { tone: "lit", label: "Residual stream x(l) trajectory & state orb" },
    { tone: "hi", label: "24 SAE monosemantic features (4 semantic clusters)" },
    { tone: "mid", label: "Active circuit filaments & 4D nested layer lattice" },
    { tone: "lo", label: "Logit Lens probabilities (Paris, fib(n-1), flooded, watered, 13)" },
  ],
  caption:
    "A real 8-dimensional, 6-layer miniature Transformer projected into 3D via PCA inside an isometric optical chamber. Twenty-four sparse autoencoder (SAE) feature directions sit in superposition; as layer depth l advances from 0 to 6, attention and MLP updates pull the residual stream along active feature circuits toward the winning unembedding beacon, dropping Logit Lens entropy. Dragging inside the cube back-projects a 3D steering delta into R⁸ via the PCA transpose.",
  body: stageHtml,
});

const html = k.pageHtml({
  title: "LLM Latent Space Chamber — Anatomy v2",
  theme,
  body: `<style>${CSS}</style>${plate}`,
  script: [kitSrc, glSrc, modelSrc, liveSrc].join("\n;\n"),
});

const outFile = join(HERE, theme === "light" ? "index-light.html" : "index.html");
writeFileSync(outFile, html, "utf8");
console.log(`Built ${outFile} (${(html.length / 1024).toFixed(1)} KB)`);
