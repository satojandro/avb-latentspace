// Fig 1 · Latent space, and my brain.
// A stepped cascade of four lamp trays (layers) falls onto a map table (latent space).
// Lit lamps are activations; an encoder squeezes all of them into two numbers, z = (z1, z2),
// a gantry plotter carries its stylus to that point, and the nearest project pin lights.
// Everything the figure shows (pin positions, the stylus, the readout) comes from model.mjs.
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import { NEURONS, LAYERS, PROJECTS, CONTEXTS, FEATURES, D as DIMS, toTable, TABLE, MODEL_SRC } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WIDTH = 1000, HEIGHT = 660;

/* ---------- world plan (units ≈ px of the real thing) ---------- */
const TW = 80, TD = 156, GAP = 14, TH = 7;                 // tray width (x), depth (y), gap, thickness
const TRAY_Z = [176, 132, 88, 44];                          // underside of each tray
const trayX = (i) => i * (TW + GAP);
const BASE = { x: -26, y: -96, w: 4 * (TW + GAP) + 212, d: 232, r: 10 };
const BASE_H = 9, FOOT_H = 5;
const T = TABLE;                                            // map table plan + heights, from the model
const HOUSING = { x: T.x + 46, y: T.y + T.d + 2, w: 74, d: 20, r: 3 };   // AI decoder, on the near side
const HOUSING_H = 26;

const P = k.fitProjection(
  [...k.boxCorners(BASE, -BASE_H - FOOT_H, 0), [0, -80, TRAY_Z[0] + TH + 16], [trayX(0), 80, TRAY_Z[0] + TH + 16], [T.x + T.w, T.y, T.top + 40]],
  WIDTH, HEIGHT, { pad: 26, azimuth: 45 },
);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const f1 = (n) => Math.round(n * 10) / 10;

/* ---------- base ---------- */
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BASE, 20))) {
    out.push(S(k.cylinder(x, y, 8, -BASE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6, -BASE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 6), 0, P), { tone: "lo" }));
  const screws = k.corners(BASE, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
  // ruler strip along the near edge: one tick per "year of life", major every 5
  const strip = { x: -8, y: BASE.y + BASE.d - 16, w: 4 * (TW + GAP) - 4, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 3, strip.x + strip.w - 3, (strip.w - 6) / 36, 5, strip.y + 0.8, 0.6, [2, 3.8], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 1.6, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 1.6, strip.y + 3.5, 0.6])], { size: 0.45 }));
  out.push(k.faceTextSvg(k.topMatrix([strip.x + 2, strip.y + 13], 0, P, "x"), "AGE 0 → 36 · ONE TICK PER YEAR", { size: 4.2, tone: "lo" }));
  // maker's label plate
  const plate = { x: T.x + T.w - 40, y: BASE.y + 8, w: 34, d: 18, r: 1.5 };
  out.push(S(k.slabOf(plate, 0, 0.8, P, 3, 0.3), { tone: "lo", crease: "none" }));
  for (let i = 0; i < 3; i++) out.push(L(k.lineOnTop([plate.x + 4, plate.y + 5 + i * 4], [plate.x + 30 - i * 6, plate.y + 5 + i * 4], 0.8, P), { tone: "faint", free: true }));
  return out.join("");
}

/* ---------- a tray (one layer of activations) ---------- */
function lampsOf(layer) {
  const ids = NEURONS.map((n, i) => ({ ...n, i })).filter((n) => n.layer === layer);
  const per = Math.ceil(ids.length / 2), x0 = trayX(layer);
  return ids.map((n, j) => {
    const row = Math.floor(j / per), col = j % per;
    const span = 108, y = -span / 2 + (per === 1 ? span / 2 : (span * col) / (per - 1));
    return { ...n, x: x0 + 24 + row * 32, y };
  });
}
const LAMP_R = 7.2, SOCKET_H = 2.6, LAMP_H = 6.4;

function tray(layer, lamps) {
  const x0 = trayX(layer), z = TRAY_Z[layer], top = z + TH;
  const plan = { x: x0, y: -TD / 2, w: TW, d: TD, r: 5 };
  const out = [];
  // posts: collar on the base, shaft, cap under the tray
  const postsAt = byDepth(k.corners(plan, 9));
  postsAt.forEach(([px, py], pi) => {
    if (pi === 2) { // after the two far-side posts: a tie bar between them, at 40% height, with a screw at each end
      const bz = z * 0.4, bar = { x: x0 + 9, y: -TD / 2 + 9 - 1.4, w: TW - 18, d: 2.8, r: 0.8 };
      out.push(S(k.slabOf(bar, bz, 3.2, P, 2, 0.3), { tone: "mid" }));
      out.push(D([at([bar.x + 4, bar.y + 1.4, bz + 3.2]), at([bar.x + bar.w - 4, bar.y + 1.4, bz + 3.2])], { size: 0.42 }));
    }
    out.push(S(k.cylinder(px, py, 5.2, 0, 3, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(px, py, 3.1, 3, z - 6, P, 22, 0), { tone: "mid", crease: "none" }));
    out.push(L([z * 0.35, z * 0.7].map((h) => k.sideArc(px, py, 3.1, h, P, 14)).join(""), { tone: "faint" }));
    out.push(S(k.cylinder(px, py, 4.4, z - 3, 3, P, 22), { tone: "mid" }));
    out.push(D(k.corners({ x: px - 3.6, y: py - 3.6, w: 7.2, d: 7.2, r: 2 }, 0.8).map(([x, y]) => at([x, y, 3])), { size: 0.35, tone: "lo" }));
  });
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(plan, 4), z, 0.1, P)}" style="opacity:.45"/>`);
  out.push(S(k.slabOf(plan, z, TH, P, 6, 1.1), { tone: "mid", inner: L(k.sideSeam(plan, z + TH * 0.45, P, 6), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(plan, 4), top, P, 6), { tone: "lo" }));
  const sc = k.corners(plan, 8.5);
  out.push(D(sc.map(([x, y]) => at([x, y, top])), { size: 0.5 }));
  // input terminal block on the far edge: where the layer above (or the world) feeds in
  const tb = { x: x0 + 4, y: -66, w: 9, d: 132, r: 1.2 };
  out.push(S(k.slabOf(tb, top, 3, P, 2, 0.4), { tone: "lo" }));
  out.push(L([-60, 60].map((y) => k.ring(x0 + 8.5, y, 1.8, top + 3, P, 12)).join(""), { tone: "mid" }));
  out.push(L(k.lineOnTop([x0 + 4, -35], [x0 + 13, -35], top + 3, P) + k.lineOnTop([x0 + 4, 35], [x0 + 13, 35], top + 3, P), { tone: "faint" }));
  out.push(L([-10, 0, 10].map((y) => k.ring(x0 + 8.5, y, 1.3, top + 3, P, 10)).join(""), { tone: "lo" }));
  // engraved name on the near (+y) side face; the whole face is the button that opens the chapter
  const face = [[x0 + 1, TD / 2, z + 0.4], [x0 + TW - 1, TD / 2, z + 0.4], [x0 + TW - 1, TD / 2, top - 0.4], [x0 + 1, TD / 2, top - 0.4]].map(at);
  out.push(`<g class="mind-label" data-open="${LAYERS[layer].id}" tabindex="0" role="button" aria-label="Open chapter: ${LAYERS[layer].title}">` +
    k.faceTextSvg(k.sideMatrix([x0 + 5, TD / 2], top - 1.6, P, "left"), `L${layer + 1} · ${LAYERS[layer].title.toUpperCase()}  ↗`, { size: 4.2, tone: "hi" }) +
    `<path class="mind-hit" d="${k.pathOf(face)}Z"/></g>`);
  // the residual stream after this block: 8 sliders, one per dimension, in grooves between the lamp rows
  out.push(bank(x0 + 40, top, `${layer}`));
  // the bus bar every lamp reports to, on the near (+x) edge
  const bus = { x: x0 + TW - 9, y: -TD / 2 + 10, w: 4.5, d: TD - 20, r: 1 };
  // traces: each lamp to the bus, drawn on the tray top
  out.push(lamps.map((l) => `<g data-t="${l.i}">` + L(k.onTop([[l.x + LAMP_R + 1.8, l.y], [bus.x - 4, l.y], [bus.x, l.y]], top, P), { tone: "faint", className: "mind-trace" }) + `</g>`).join(""));
  out.push(D(lamps.map((l) => at([bus.x - 4, l.y, top])), { size: 0.45, tone: "lo" }));
  // lamps, back to front
  for (const l of byDepth(lamps.map((l) => [l.x, l.y, l])).map((p) => p[2])) {
    const t0 = top, t1 = t0 + SOCKET_H, t2 = t1 + LAMP_H;
    out.push(`<g class="mind-lamp" data-n="${l.i}" tabindex="-1">`);
    out.push(S(k.cylinder(l.x, l.y, LAMP_R + 1.8, t0, SOCKET_H, P, 28, 0.4), { tone: "lo" }));
    out.push(L(k.knurl(l.x, l.y, LAMP_R + 1.8, t0 + 0.4, t1 - 0.4, 30, P, 0.3), { tone: "faint" }));
    out.push(D([0, 1, 2, 3].map((q) => { const a = Math.PI / 4 + (q * Math.PI) / 2; return at([l.x + Math.cos(a) * (LAMP_R + 0.9), l.y + Math.sin(a) * (LAMP_R + 0.9), t1]); }), { size: 0.32, tone: "mid" }));
    out.push(S(k.cylinder(l.x, l.y, LAMP_R, t1, LAMP_H, P, 32, 0.5), { tone: "hi", crease: "lo" }));
    out.push(L(k.sideArc(l.x, l.y, LAMP_R, t1 + LAMP_H * 0.55, P, 20), { tone: "faint" }));
    out.push(`<path class="mind-glow" data-g="${l.i}" d="${k.ring(l.x, l.y, LAMP_R - 0.6, t2, P, 32)}"/>`);
    out.push(L(k.ring(l.x, l.y, LAMP_R - 2.4, t2, P, 28), { tone: "lo" }));
    out.push(D([at([l.x, l.y, t2])], { size: 0.6, tone: "mid" }));
    out.push(`<path class="mind-hit" d="${k.ring(l.x, l.y, LAMP_R + 3, t1 + LAMP_H / 2, P, 20)}"/>`);
    out.push(`</g>`);
  }
  out.push(S(k.slabOf(bus, top, 4, P, 2, 0.4), { tone: "mid" }));
  out.push(`<path class="mind-busglow" data-bus="${layer}" d="${k.planOutline(k.insetPlan(bus, 0.9), top + 4, P, 2)}"/>`);
  out.push(D([at([bus.x + 2.2, bus.y + 3, top + 4]), at([bus.x + 2.2, bus.y + bus.d - 3, top + 4])], { size: 0.45 }));
  return out.join("");
}

/* ---------- a bank of 8 sliders: one vector of the residual stream ---------- */
const BANK_Y = (d) => -42 + d * 12, BANK_HALF = 5.2, SLIDE = 4.2;
function bank(cx, top, id) {
  const out = [];
  for (let d = 0; d < DIMS; d++) {
    const y = BANK_Y(d), groove = { x: cx - BANK_HALF, y: y - 1.1, w: 2 * BANK_HALF, d: 2.2, r: 1 };
    out.push(S(k.slabOf(groove, top, 0.3, P, 2), { tone: "lo", crease: "none", flat: true }));
    out.push(L(k.planOutline(groove, top + 0.3, P, 2), { tone: "lo" }));
    out.push(D([at([cx, y - 2.4, top])], { size: 0.32, tone: "mid" }));
  }
  // caps, back to front, each moved along x by the live code
  for (let d = 0; d < DIMS; d++) {
    const y = BANK_Y(d);
    out.push(`<g data-slider="${id}:${d}">` + S(k.slabOf({ x: cx - 1.5, y: y - 1.9, w: 3, d: 3.8, r: 0.8 }, top + 0.3, 2.2, P, 2, 0.3), { tone: "hi", crease: "lo" }) +
      L(k.lineOnTop([cx, y - 1.9], [cx, y + 1.9], top + 2.5, P), { tone: "lo" }) + `</g>`);
  }
  return out.join("");
}

/* ---------- the wire from one tray's bus to the next tray's input ---------- */
function link(layer) {
  const x0 = trayX(layer), z = TRAY_Z[layer] + TH + 4, xn = trayX(layer + 1), zn = TRAY_Z[layer + 1] + TH;
  const leg = x0 + TW + 3.5, mid = (z + zn) / 2;
  return [-1, 1].map((sgn) => {
    const y = sgn * 62, py = sgn * (TD / 2 - 9);
    const from = at([x0 + TW - 6.7, y, z]);
    const via = [at([leg, y, z]), at([leg, y, zn + 7])];
    const to = at([xn + 8.5, sgn * 60, zn + 3]);
    // a clamp from the near post to the cable, half-way down
    const clamp = { x: x0 + TW - 12, y: Math.min(py, y) - 1.6, w: leg - (x0 + TW - 12) + 2.2, d: Math.abs(py - y) + 3.2, r: 1 };
    return S(k.slabOf(clamp, mid - 1.5, 3, P, 2, 0.3), { tone: "lo" }) + D([at([x0 + TW - 9, py, mid + 1.5])], { size: 0.4 }) +
      `<g data-link="${layer}">` + k.wireSvg(from, to, { via, tone: "lo" }) + `<path class="mind-flow" d="${k.pathOf([from, ...via, to])}"/></g>`;
  }).join("");
}

/* ---------- the prompt: three token cards in a reader, a context knob, and attention cables up to block 1 ---------- */
const CARD_Y = [-26, 0, 26], READER = { x: -24, y: -40, w: 18, d: 80, r: 2.5 }, READER_H = 10;
function reader() {
  const out = [], top = TRAY_Z[0] + TH, rx = -13;
  out.push(S(k.slabOf(READER, 0, READER_H, P, 3, 0.7), { tone: "mid", inner: L(k.sideSeam(READER, 4, P, 3), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(READER, 2.2), READER_H, P, 3), { tone: "lo" }));
  out.push(D(k.corners(READER, 3.2).map(([x, y]) => at([x, y, READER_H])), { size: 0.45 }));
  // card slots and cards, back to front
  CARD_Y.forEach((yc, j) => {
    const slot = { x: -19.5, y: yc - 10, w: 3.6, d: 20, r: 0.6 };
    out.push(S(k.slabOf(slot, READER_H, 1.4, P, 2), { tone: "lo" }));
    const card = { x: -18.8, y: yc - 9, w: 2.2, d: 18, r: 0.4 };
    out.push(`<g data-tok="${j}">` + S(k.slabOf(card, READER_H + 1.4, 20, P, 2, 0.3), { tone: "hi", crease: "lo" }) +
      `<text class="mind-tokword" ${j === 1 ? "data-ctxword" : ""} transform="${k.sideMatrix([card.x + card.w, yc - 7], READER_H + 13, P, "right")}" font-size="4.4">${["I", CONTEXTS[0], "build"][j]}</text>` +
      `<path class="mind-tokglow" data-tokglow="${j}" d="${k.planOutline(k.insetPlan(card, 0.2), READER_H + 21.4, P, 2)}"/></g>`);
  });
  // the context knob: five detents, one per context word
  const kx = -14, ky = 33;
  out.push(S(k.cylinder(kx, ky, 5.6, READER_H, 1, P, 28), { tone: "lo" }));
  const det = k.radialTicks(kx, ky, 6.4, CONTEXTS.length, 1, READER_H, [0, 1.4], P, -0.6 * Math.PI, 1.2 * Math.PI * (CONTEXTS.length / (CONTEXTS.length - 1)));
  out.push(L(det.major || det.minor, { tone: "mid" }));
  out.push(`<g class="mind-knob" data-knob tabindex="0" role="button" aria-label="Change the context word">` +
    S(k.cylinder(kx, ky, 4.2, READER_H + 1, 4.5, P, 28, 0.4), { tone: "hi", crease: "lo" }) +
    L(k.knurl(kx, ky, 4.2, READER_H + 1.4, READER_H + 5.1, 28, P, 0.3), { tone: "lo" }) +
    `<path class="iso-line" data-tone="lit" data-free="start" data-knobptr d=""/>` +
    `<path class="mind-hit" d="${k.ring(kx, ky, 7, READER_H + 3, P, 18)}"/></g>`);
  // riser post with clamps, carrying three attention cables up to block 1
  out.push(S(k.cylinder(rx, 0, 2.2, READER_H, top + 4 - READER_H, P, 16), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(rx, 0, 3, top + 4, 1.6, P, 16), { tone: "mid" }));
  for (const h of [64, 112, 160]) out.push(S(k.slabOf({ x: rx - 2.5, y: -7, w: 5, d: 14, r: 1 }, h, 2.6, P, 2, 0.3), { tone: "lo" }));
  CARD_Y.forEach((yc, j) => {
    const yr = (j - 1) * 3.4, yt = (j - 1) * 10;
    const pts = [[-17.7, yc, READER_H + 21.4], [-17.7, yc, READER_H + 27], [rx + 0.4, yr, READER_H + 34], [rx + 0.4, yr, top + 8], [3, yt, top + 8], [8.5, yt, top + 3]].map(at);
    out.push(`<g data-link="att${j}">` + k.wireSvg(pts[0], pts[pts.length - 1], { via: pts.slice(1, -1), tone: "lo" }) + `<path class="mind-flow" d="${k.pathOf(pts)}"/></g>`);
  });
  return out.join("");
}

/* ---------- the map table: latent space ---------- */
function table() {
  const out = [];
  const plan = { x: T.x, y: T.y, w: T.w, d: T.d, r: 6 };
  const feetPlan = k.insetPlan(plan, 10);
  for (const [x, y] of byDepth(k.corners(feetPlan, 0))) out.push(S(k.cylinder(x, y, 5, 0, T.z, P, 22), { tone: "lo" }));
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(plan, 3), T.z, 0.1, P)}" style="opacity:.55"/>`);
  out.push(S(k.slabOf(plan, T.z, T.top - T.z, P, 8, 1.2), { tone: "mid", inner: L(k.sideSeam(plan, T.z + 3, P, 8), { tone: "faint" }) }));
  // the map inlay
  const inlay = { x: T.mx - T.sx - 8, y: -T.sy - 8, w: 2 * T.sx + 16, d: 2 * T.sy + 16, r: 3 };
  out.push(S(k.slabOf(inlay, T.top, 0.4, P, 4), { tone: "lo", crease: "none", flat: true }));
  out.push(L(k.planOutline(inlay, T.top + 0.4, P, 4), { tone: "mid" }));
  // grid: latent units every 0.25
  const g = [];
  for (let i = -4; i <= 4; i++) {
    const v = i / 4;
    g.push(k.lineOnTop([T.mx + v * T.sx, -T.sy], [T.mx + v * T.sx, T.sy], T.top + 0.4, P));
    g.push(k.lineOnTop([T.mx - T.sx, v * T.sy], [T.mx + T.sx, v * T.sy], T.top + 0.4, P));
  }
  out.push(L(g.join(""), { tone: "faint" }));
  out.push(L(k.lineOnTop([T.mx - T.sx, 0], [T.mx + T.sx, 0], T.top + 0.4, P) + k.lineOnTop([T.mx, -T.sy], [T.mx, T.sy], T.top + 0.4, P), { tone: "lo" }));
  // axis names, engraved
  out.push(k.faceTextSvg(k.topMatrix([T.mx + T.sx - 2, T.sy + 5.5], T.top + 0.4, P, "x"), "PC 1 · 8-D STREAM, PROJECTED", { size: 3.6, tone: "mid", anchor: "end" }));
  out.push(k.faceTextSvg(k.topMatrix([T.mx - T.sx - 4.5, -T.sy + 2], T.top + 0.4, P, "y"), "PC 2", { size: 3.6, tone: "mid" }));
  // rails for the gantry, with tick rulers and end stops
  for (const y of [T.y + 7, T.y + T.d - 12]) {
    const rail = { x: T.x + 8, y, w: T.w - 16, d: 5, r: 1 };
    out.push(S(k.slabOf(rail, T.top, 3, P, 2, 0.4), { tone: "mid" }));
    const tk = k.topTicks(T.mx - T.sx, T.mx + T.sx, T.sx / 10, 5, y + 0.6, T.top + 3, [1.2, 2.4], P);
    out.push(L(tk.minor, { tone: "lo" }), L(tk.major, { tone: "mid" }));
    for (const x of [T.x + 4, T.x + T.w - 9]) {
      out.push(S(k.slabOf({ x, y: y - 1.5, w: 5, d: 8, r: 1.2 }, T.top, 7, P, 3, 0.4), { tone: "mid" }));
      out.push(D([at([x + 2.5, y + 2.5, T.top + 7])], { size: 0.45 }));
    }
  }
  return out.join("");
}
/* ---------- final RMSNorm and the unembedding: 8 numbers in, 5 logits out ---------- */
function encoder() {
  const e = { x: T.x + 6, y: -40, w: 12, d: 80, r: 2 }, top = T.top + 12;
  const out = [S(k.slabOf(e, T.top + 3, 9, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(e, T.top + 6.5, P, 3), { tone: "faint" }) })];
  out.push(L(k.planOutline(k.insetPlan(e, 2), top, P, 3), { tone: "lo" }));
  const ins = []; for (let i = 0; i < DIMS; i++) ins.push(at([e.x + 3.4, BANK_Y(i) * 0.85, top]));
  out.push(D(ins, { size: 0.5, tone: "mid" }));
  PROJECTS.forEach((_, i) => {
    const y = -28 + i * 14;
    out.push(S(k.cylinder(e.x + 8.4, y, 1.7, top, 2.4, P, 16), { tone: "hi", crease: "none" }));
    out.push(`<path class="mind-encout" data-logit="${i}" d="${k.ring(e.x + 8.4, y, 1.3, top + 2.4, P, 14)}"/>`);
  });
  out.push(k.faceTextSvg(k.sideMatrix([e.x + e.w, e.y + 5], top - 2.2, P, "right"), "RMSNORM · UNEMBED  8 → 5", { size: 3.1, tone: "hi" }));
  return out.join("");
}

/* ---------- project pins on the map ---------- */
function pins() {
  return byDepth(PROJECTS.map((p, i) => { const [x, y] = toTable(...p.z); return [x, y, { p, i }]; })).map(([x, y, { i }]) => {
    const z0 = T.top + 0.4;
    return `<g class="mind-pin" data-p="${i}" tabindex="-1">` +
      S(k.cylinder(x, y, 5.4, z0, 1.2, P, 22), { tone: "lo" }) +
      S(k.cylinder(x, y, 1.3, z0 + 1.2, 7, P, 12), { tone: "mid", crease: "none" }) +
      S(k.cylinder(x, y, 4.4, z0 + 8.2, 2.8, P, 24, 0.3), { tone: "hi", crease: "lo" }) +
      `<path class="mind-pinglow" d="${k.ring(x, y, 3.8, z0 + 11, P, 20)}"/>` +
      k.faceTextSvg(k.topMatrix([x + 7, y + 1.6], z0, P, "x"), String(i + 1).padStart(2, "0"), { size: 4.4, tone: "hi" }) +
      `<path class="mind-hit" d="${k.ring(x, y, 7, z0 + 5, P, 16)}"/></g>`;
  }).join("");
}

/* ---------- the gantry: bridge across y moving in x, carriage moving in y, stylus ---------- */
const GZ = T.top + 3;                 // rail top
const BR_Z = GZ + 18;                 // bridge underside
function bridge() {
  const out = [];
  const x = T.mx; // built at z1 = 0, moved in x by the live code
  for (const y of [T.y + 4, T.y + T.d - 15]) {
    out.push(S(k.slabOf({ x: x - 7, y, w: 14, d: 11, r: 2 }, GZ, 3, P, 3, 0.4), { tone: "mid" }));
    out.push(S(k.slabOf({ x: x - 4.5, y: y + 2, w: 9, d: 7, r: 1.5 }, GZ + 3, BR_Z - GZ - 3, P, 3, 0.4), { tone: "mid" }));
    out.push(D([at([x - 4, y + 5.5, GZ + 3]), at([x + 4, y + 5.5, GZ + 3])], { size: 0.42 }));
  }
  const beam = { x: x - 4, y: T.y + 4, w: 8, d: T.d - 8, r: 1.5 };
  out.push(S(k.slabOf(beam, BR_Z, 6, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(beam, BR_Z + 2.5, P, 3), { tone: "faint" }) }));
  const tk = k.topTicks(-T.sy, T.sy, T.sy / 10, 5, x - 3.4, BR_Z + 6, [1, 2], P, "y");
  out.push(L(tk.minor, { tone: "lo" }), L(tk.major, { tone: "mid" }));
  return out.join("");
}
function carriage() {
  const out = [];
  const x = T.mx, y = 0;
  out.push(S(k.slabOf({ x: x - 7, y: y - 8, w: 14, d: 16, r: 2 }, BR_Z + 6, 6, P, 3, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(x + 3.5, y + 4, 2.4, BR_Z + 12, 3.2, P, 16), { tone: "mid" }));
  out.push(L(k.knurl(x + 3.5, y + 4, 2.4, BR_Z + 12, BR_Z + 15.2, 14, P, 0.25), { tone: "lo" }));
  // stylus: rod down through the beam to the map, lit tip = the latent point
  out.push(S(k.cylinder(x, y, 1.4, T.top + 2.2, BR_Z + 12 - T.top - 2.2, P, 14), { tone: "hi", crease: "none", lit: true }));
  out.push(S(k.cylinder(x, y, 2.6, T.top + 0.6, 1.6, P, 18), { tone: "hi", lit: true }));
  out.push(`<path class="mind-tip" d="${k.ring(x, y, 2.3, T.top + 2.2, P, 18)}"/>`);
  return out.join("");
}

/* ---------- the AI decoder: turns the point into a project card ---------- */
function housing() {
  const h = HOUSING, back = { ...h, d: 8 }, front = { ...h, y: h.y + 11, d: 9 };
  const vents = [0, 1, 2, 3, 4].map((v) => { const x = front.x + 8 + v * 4.2; return `<path class="iso-line" data-tone="lo" d="${k.pathOf([at([x, front.y + front.d, 5]), at([x, front.y + front.d, 13]), at([x + 1.6, front.y + front.d, 13]), at([x + 1.6, front.y + front.d, 5])])}Z"/>`; }).join("");
  const rack = { x: h.x + h.w + 5, y: h.y + 2, w: 48, d: 16, r: 2 };
  const tubeX = (i) => rack.x + 6 + i * 9, TY = rack.y + 8, TUBE_R = 3.2, TUBE_H = 30, TZ = 4;
  let tubes = S(k.slabOf(rack, 0, TZ, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(rack, 1.6, P, 3), { tone: "faint" }) });
  PROJECTS.forEach((_, i) => {
    const x = tubeX(i);
    tubes += S(k.cylinder(x, TY, TUBE_R + 1.2, TZ, 1.6, P, 22), { tone: "lo" }) +
      `<path class="mind-fill" data-fill="${i}" data-f0="${x},${TY},${TUBE_R - 0.5},${TZ + 1.6},${TUBE_H - 2}" d=""/>` +
      L(k.cylinder(x, TY, TUBE_R, TZ + 1.6, TUBE_H, P, 24).outline, { tone: "mid" }) +
      L([0.25, 0.5, 0.75].map((f) => k.sideArc(x, TY, TUBE_R, TZ + 1.6 + f * (TUBE_H - 2), P, 14)).join(""), { tone: "faint" }) +
      L(k.ring(x, TY, TUBE_R, TZ + 1.6 + TUBE_H, P, 20), { tone: "mid" }) +
      k.faceTextSvg(k.sideMatrix([x - 2, rack.y + rack.d], TZ - 1, P, "left"), String(i + 1).padStart(2, "0"), { size: 2.3, tone: "hi" });
  });
  const trayOut = tubes;
  return {
    tray: trayOut,
    back: S(k.slabOf({ ...back, r: 2 }, 0, HOUSING_H, P, 3, 0.6), { tone: "mid" }),
    card: `<g data-part="card">` + S(k.slabOf({ x: h.x + 8, y: h.y + 8.6, w: h.w - 16, d: 1.6, r: 0.4 }, 4, HOUSING_H - 6, P, 2), { tone: "hi", lit: true }) +
      `<text class="mind-cardno" data-cardno transform="${k.sideMatrix([h.x + h.w / 2, h.y + 10.2], HOUSING_H - 6, P, "left")}" font-size="6" text-anchor="middle">01</text></g>`,
    front: `<g class="mind-label" data-open="ai" tabindex="0" role="button" aria-label="Open chapter: AI, the decoder">` +
      S(k.slabOf({ ...front, r: 2 }, 0, HOUSING_H, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(front, 6, P, 3), { tone: "faint" }) }) +
      k.faceTextSvg(k.sideMatrix([front.x + front.w / 2, front.y + front.d], HOUSING_H - 7, P, "left"), "AI DECODER", { size: 5, tone: "hi", anchor: "middle" }) +
      D([at([front.x + 5, front.y + front.d, HOUSING_H - 4]), at([front.x + front.w - 5, front.y + front.d, HOUSING_H - 4])], { size: 0.5 }) + vents +
      `<path class="mind-led" data-decled d="${k.ring(front.x + front.w - 9, front.y + front.d / 2, 1.3, HOUSING_H, P, 12)}"/>` + `</g>` +
      // a cable from the gantry's near rail block down to the decoder
      k.wireSvg(at([T.x + T.w - 6, T.y + T.d - 6, T.top]), at([front.x + front.w - 4, front.y + 4, HOUSING_H]), { via: [at([T.x + T.w + 6, T.y + T.d - 6, T.top - 6]), at([T.x + T.w + 6, front.y + 4, HOUSING_H + 4])], tone: "lo" }),
  };
}

/* ---------- assemble, back to front ---------- */
const lampsByLayer = LAYERS.map((_, i) => lampsOf(i));
const H = housing();
const body = [
  base(),
  reader(),
  ...LAYERS.flatMap((_, i) => [tray(i, lampsByLayer[i]), i < LAYERS.length - 1 ? link(i) : ""]),
  // last tray feeds the encoder on the table
  [-34, 34].map((y) => {
    const x0 = trayX(3), z = TRAY_Z[3] + TH + 4;
    const from = at([x0 + TW - 6.7, y, z]), via = [at([x0 + TW + 4, y, z]), at([x0 + TW + 4, y, T.top + 16])], to = at([T.x + 12, y * 0.6, T.top + 12]);
    return `<g data-link="3">` + k.wireSvg(from, to, { via, tone: "lo" }) + `<path class="mind-flow" d="${k.pathOf([from, ...via, to])}"/></g>`;
  }).join(""),
  table(),
  encoder(),
  H.back, H.card, H.front, H.tray,
  pins(),
  `<path class="mind-traj" data-traj d=""/>` + [0, 1, 2, 3, 4].map((i) => `<circle class="mind-trajdot" data-td="${i}" r="${i === 4 ? 1.6 : 1.2}" cx="0" cy="0"/>`).join(""),
  `<g data-part="bridge">${bridge()}</g>`,
  `<g data-part="carriage">${carriage()}</g>`,
  `<path class="mind-drag" data-drag d="${k.pathOf([[T.mx - T.sx, -T.sy], [T.mx + T.sx, -T.sy], [T.mx + T.sx, T.sy], [T.mx - T.sx, T.sy]].map(([x, y]) => at([x, y, T.top])))}Z"/>`,
];

const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT,
  label: "A stepped cascade of four lamp trays standing on posts above a long base, each tray one layer of a life: Caracas, Arts and Law, travel and crypto. Lit lamps send their signal along wires to the tray below. The last tray feeds a map table, the latent space, where a gantry plotter carries a stylus to the point the encoder computes, the nearest project pin lights, and an AI decoder at the front pushes up a card for that project.",
  body,
});

const live = readFileSync(join(HERE, "live.js"), "utf8");
const script = `(()=>{\n${readFileSync(join(HERE, "kit/iso-kit.mjs"), "utf8").replace(/^export /gm, "")}\n${MODEL_SRC}\nconst P=${JSON.stringify(P)};\nconst LAMP_COUNT=${NEURONS.length};\n${live}\n})();`;

const keys = [
  { mark: "lit", label: "Stylus: the point in latent space" },
  { mark: "raised", label: "Lamps: neurons, lit when active" },
  { mark: "flat", label: "Map: two numbers left after compression" },
];
const plate = k.plateHtml({
  fig: "Fig 1", title: "Latent space, and my brain", hint: "Click lamps · drag the map",
  readout: "…",
  keys,
  caption: "Each tray is one layer of a life. Lamps are the things that shaped me; the encoder squeezes every lit lamp into two numbers, z₁ and z₂, and that pair is a point on the map. Projects sit where their own lamps would put the point, so nearby pins grew from similar parts of me.",
  body: `<div class="iso-stage mind-stage" tabindex="0" role="application" aria-label="Latent space figure: arrow keys step through projects, Enter opens the selected one">${svg}</div>`,
});
writeFileSync(join(HERE, "mind-body.html"), plate);
writeFileSync(join(HERE, "mind-script.js"), script.replace(/<\/script/gi, "<\\/script"));
writeFileSync(join(HERE, "iso.css"), k.ISO_CSS);
console.log("wrote mind-body.html", plate.length, "bytes; script", script.length);
