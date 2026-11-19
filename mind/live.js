// Live behaviour for Fig 1: a real forward pass, run every frame, drawn onto the machine.
// In scope: the kit (iso, lineOnTop, ring, cylinder, translateAlong, pathOf…), the model
// (forward, project2, steerFor, rmsnorm, NEURONS, PROJECTS, CONTEXTS, LAYERS, TABLE, toTable) and P.
const root = document.querySelector(".mind-stage");
const svg = root.querySelector("svg");
const readout = root.closest(".iso-plate").querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const q = (s) => [...svg.querySelectorAll(s)];
const NN = NEURONS.length, NL = LAYERS.length;
const byData = (sel, key) => { const out = []; q(sel).forEach((e) => (out[e.dataset[key]] = e)); return out; };
const glow = byData("[data-g]", "g"), trace = byData("[data-t]", "t");
const lampEls = q(".mind-lamp"), pinEls = q(".mind-pin");
const bus = byData("[data-bus]", "bus");
const links = LAYERS.map((_, i) => q(`[data-link="${i}"] .mind-flow`));
const attFlow = [0, 1, 2].map((j) => q(`[data-link="att${j}"] .mind-flow`)), tokGlow = byData("[data-tokglow]", "tokglow");
const sliders = {}; q("[data-slider]").forEach((e) => (sliders[e.dataset.slider] = e));
const logitEls = byData("[data-logit]", "logit"), fills = byData("[data-fill]", "fill");
const trajEl = svg.querySelector("[data-traj]"), trajDots = byData("[data-td]", "td");
const bridgeEl = svg.querySelector('[data-part="bridge"]'), carriageEl = svg.querySelector('[data-part="carriage"]');
const cardEl = svg.querySelector('[data-part="card"]'), cardNo = svg.querySelector("[data-cardno]");
const ctxWord = svg.querySelector("[data-ctxword]"), knob = svg.querySelector("[data-knob]"), knobPtr = svg.querySelector("[data-knobptr]");
const dragEl = svg.querySelector("[data-drag]"), decLed = svg.querySelector("[data-decled]");
const CARD_RISE = 22, SLIDE = 4.2, BANK_X = (l) => l * 94 + 40, KNOB = [-14, -35, 10 + 1 + 4.5 + 0.1];

// ---- state ----
let ctx = 0, off = new Set(), steer = null; // steer: [du, dv] on the map
let target = forward(CONTEXTS[ctx]);
// what is shown: eased copies of the forward pass, one block at a time (the cascade)
const shown = { attn: target.attn.slice(), act: target.act.slice(), states: target.states.map((s) => s.slice()), probs: target.probs.slice(), card: 0, best: 0 };
const stageAt = new Array(NL + 2).fill(0); // stage 0 = attention, 1..NL = blocks, NL+1 = output
let clock = 0, mode = "tour", idleUntil = 0, nextTour = 4.5, frame = 0, last = 0, visible = true, hoverLamp = -1;

function recompute(cascade) {
  const base = forward(CONTEXTS[ctx], off);
  const sv = steer ? steerFor(base.final, steer[0], steer[1]) : null;
  target = sv ? forward(CONTEXTS[ctx], off, sv) : base;
  target.view = sv ? project2(target.final) : null;
  for (let s = 0; s < stageAt.length; s++) stageAt[s] = clock + (cascade && !still.matches ? s * 0.34 : 0);
}
function setCtx(i, why) { ctx = (i + CONTEXTS.length) % CONTEXTS.length; steer = null; recompute(true); if (why !== "tour") pause(); }
function pause(ms = 8000) { mode = "manual"; idleUntil = performance.now() + ms; }

function step(dt) {
  clock += dt;
  if (mode === "tour" && clock > nextTour) { nextTour = clock + 5; setCtx(ctx + 1, "tour"); }
  if (mode === "manual" && performance.now() > idleUntil && !still.matches && !dragging) { mode = "tour"; nextTour = clock + 2; }
  const f = (tau) => (still.matches ? 1 : 1 - Math.exp(-dt / tau));
  const ready = (s) => clock >= stageAt[s];
  if (ready(0)) shown.attn = shown.attn.map((v, j) => v + (target.attn[j] - v) * f(0.2));
  for (let s = 0; s <= NL; s++) if (ready(s)) shown.states[s] = shown.states[s].map((v, d) => v + (target.states[s][d] - v) * f(0.25));
  NEURONS.forEach((n, i) => { if (ready(n.layer + 1)) shown.act[i] += (target.act[i] - shown.act[i]) * f(0.2); });
  if (ready(NL + 1)) shown.probs = shown.probs.map((v, p) => v + (target.probs[p] - v) * f(0.3));
  const best = shown.probs.indexOf(Math.max(...shown.probs));
  shown.best = best;
  shown.card += ((shown.probs[best] > 0.45 ? 1 : 0) - shown.card) * f(0.3);
}

function draw() {
  // attention: cables and card rims
  shown.attn.forEach((w, j) => { attFlow[j].forEach((e) => (e.style.opacity = Math.min(1, w * 1.6).toFixed(3))); tokGlow[j].style.opacity = w.toFixed(3); });
  // neurons and their traces; ablated lamps are marked
  for (let i = 0; i < NN; i++) {
    const a = Math.max(0, Math.min(1, shown.act[i] / 1.4));
    glow[i].style.opacity = (a * 0.95).toFixed(3);
    trace[i].style.opacity = (0.25 + a * 0.75).toFixed(3);
    trace[i].classList.toggle("on", a > 0.3);
  }
  lampEls.forEach((e) => { const n = +e.dataset.n; e.classList.toggle("off", off.has(n)); e.classList.toggle("hover", n === hoverLamp); });
  // the block's writes into the stream, and the stream itself after each block
  LAYERS.forEach((_, l) => {
    let s = 0, c = 0; NEURONS.forEach((n, i) => { if (n.layer === l) { s += Math.min(1, shown.act[i] / 1.4); c++; } });
    const m = Math.min(1, (s / c) * 2.4);
    bus[l].style.opacity = m.toFixed(3);
    links[l].forEach((e) => (e.style.opacity = m.toFixed(3)));
    const x = rmsnorm(shown.states[l + 1]);
    x.forEach((v, d) => { const e = sliders[`${l}:${d}`]; if (e) e.setAttribute("transform", translateAlong(P, [Math.max(-1, Math.min(1, v / 2)) * SLIDE, 0, 0])); });
  });
  // latent space: where the vector is after each stage, and where it ends
  const pts = shown.states.map((s) => project2(s));
  const end = target.view && clock >= stageAt[NL + 1] ? target.view : pts[NL];
  const tablePts = [...pts.slice(0, NL), end].map(([u, v]) => toTable(Math.max(-1, Math.min(1, u)), Math.max(-1, Math.min(1, v))));
  trajEl.setAttribute("d", onTop(tablePts, TABLE.top + 0.6, P));
  tablePts.forEach(([x, y], i) => { const [sx, sy] = iso([x, y, TABLE.top + 0.6], P); trajDots[i].setAttribute("cx", sx.toFixed(1)); trajDots[i].setAttribute("cy", sy.toFixed(1)); });
  const [tx, ty] = tablePts[NL];
  bridgeEl.setAttribute("transform", translateAlong(P, [tx - TABLE.mx, 0, 0]));
  carriageEl.setAttribute("transform", translateAlong(P, [tx - TABLE.mx, ty, 0]));
  // output: logits, probabilities, the chosen token
  shown.probs.forEach((p, i) => {
    logitEls[i].style.opacity = (0.15 + 0.85 * p).toFixed(3);
    const [x, y, r, z0, hmax] = fills[i].dataset.f0.split(",").map(Number);
    fills[i].setAttribute("d", p > 0.01 ? cylinder(x, y, r, z0, Math.max(0.4, p * hmax), P, 20).fill : "");
    pinEls[i] && 0;
  });
  pinEls.forEach((e) => e.classList.toggle("on", +e.dataset.p === shown.best));
  cardEl.setAttribute("transform", translateAlong(P, [0, 0, shown.card * CARD_RISE]));
  cardNo.textContent = String(shown.best + 1).padStart(2, "0");
  if (decLed) decLed.style.opacity = (0.25 + 0.75 * shown.card).toFixed(3);
  // the prompt
  if (ctxWord.textContent !== CONTEXTS[ctx]) ctxWord.textContent = CONTEXTS[ctx];
  const ang = -0.6 * Math.PI + (ctx / (CONTEXTS.length - 1)) * 1.2 * Math.PI;
  knobPtr.setAttribute("d", lineOnTop([KNOB[0], KNOB[1]], [KNOB[0] + Math.sin(ang) * 3.6, KNOB[1] - Math.cos(ang) * 3.6], KNOB[2], P));
  // readout
  let text;
  if (hoverLamp >= 0) { const n = NEURONS[hoverLamp]; text = `Block ${n.layer + 1} · ${n.name} · ${off.has(hoverLamp) ? "ablated" : "activation " + Math.max(0, shown.act[hoverLamp]).toFixed(2)}`; }
  else text = `"I ${CONTEXTS[ctx]} build" → ${PROJECTS[shown.best].name} · p ${shown.probs[shown.best].toFixed(2)}${off.size ? " · " + off.size + " off" : ""}${steer ? " · steered" : ""}`;
  if (readout.textContent !== text) readout.textContent = text;
  root.setAttribute("aria-valuetext", text);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60; last = now;
  step(dt); draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting && !document.hidden; run(); }).observe(root);
document.addEventListener("visibilitychange", () => { visible = !document.hidden; run(); });

/* ---------- input ---------- */
const emit = (id, extra) => document.dispatchEvent(new CustomEvent("mind:open", { detail: { id, ...extra } }));
const lampOf = (e) => e.target.closest(".mind-lamp");
svg.addEventListener("pointerover", (e) => { const l = lampOf(e); hoverLamp = l ? +l.dataset.n : -1; });
svg.addEventListener("pointerout", (e) => { if (lampOf(e)) hoverLamp = -1; });
svg.addEventListener("click", (e) => {
  const lamp = lampOf(e), pin = e.target.closest(".mind-pin"), label = e.target.closest("[data-open]");
  if (lamp) { const i = +lamp.dataset.n; off.has(i) ? off.delete(i) : off.add(i); recompute(true); pause(); return; }
  if (e.target.closest("[data-knob]")) { setCtx(ctx + 1); return; }
  if (pin) { const i = +pin.dataset.p; emit("built", { project: i, ctx: CONTEXTS[ctx] }); return; }
  if (e.target.closest('[data-part="card"]')) { emit("built", { project: shown.best, ctx: CONTEXTS[ctx] }); return; }
  if (label) emit(label.dataset.open);
});
svg.addEventListener("keydown", (e) => {
  if (!(e.key === "Enter" || e.key === " ")) return;
  if (e.target.closest("[data-knob]")) { e.preventDefault(); setCtx(ctx + 1); return; }
  const label = e.target.closest("[data-open]"); if (label) { e.preventDefault(); emit(label.dataset.open); }
});
// drag on the map: a steering vector that moves the final state there
let dragging = false;
function toLatent(e) {
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const s = pt.matrixTransform(svg.getScreenCTM().inverse());
  const o = iso([0, 0, TABLE.top], P), ex = iso([1, 0, TABLE.top], P), ey = iso([0, 1, TABLE.top], P);
  const a = [ex[0] - o[0], ex[1] - o[1]], b = [ey[0] - o[0], ey[1] - o[1]], d = [s.x - o[0], s.y - o[1]];
  const det = a[0] * b[1] - a[1] * b[0], x = (d[0] * b[1] - d[1] * b[0]) / det, y = (a[0] * d[1] - a[1] * d[0]) / det;
  return [Math.max(-1, Math.min(1, (x - TABLE.mx) / TABLE.sx)), Math.max(-1, Math.min(1, y / TABLE.sy))];
}
function steerTo(e) {
  const want = toLatent(e), base = forward(CONTEXTS[ctx], off), at0 = project2(base.final);
  steer = [want[0] - at0[0], want[1] - at0[1]];
  recompute(false);
}
dragEl.addEventListener("pointerdown", (e) => { dragEl.setPointerCapture(e.pointerId); dragging = true; mode = "manual"; idleUntil = Infinity; steerTo(e); });
dragEl.addEventListener("pointermove", (e) => { if (dragging) steerTo(e); });
const release = (e) => { if (!dragging) return; dragging = false; if (dragEl.hasPointerCapture(e.pointerId)) dragEl.releasePointerCapture(e.pointerId); idleUntil = performance.now() + 8000; };
dragEl.addEventListener("pointerup", release); dragEl.addEventListener("pointercancel", release);
root.addEventListener("keydown", (e) => {
  if (e.target !== root) return;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); setCtx(ctx + 1); }
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); setCtx(ctx - 1); }
  if (e.key === "Escape") { off.clear(); steer = null; recompute(true); }
  if (e.key === "Enter") emit("built", { project: shown.best, ctx: CONTEXTS[ctx] });
});
window.MIND = { PROJECTS, NEURONS, LAYERS, CONTEXTS, attribution, forward, setCtx: (i) => setCtx(i) };
if (still.matches) { mode = "manual"; idleUntil = Infinity; }
recompute(false); draw(); run();
