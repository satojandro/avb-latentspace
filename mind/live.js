// Live behaviour for Fig 1. Runs inside the page with the kit and the model in scope.
const root = document.querySelector(".mind-stage");
const svg = root.querySelector("svg");
const plateEl = root.closest(".iso-plate");
const readout = plateEl.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const N = NEURONS.length;
const q = (s) => [...svg.querySelectorAll(s)];
const glow = []; q("[data-g]").forEach((e) => (glow[+e.dataset.g] = e));
const trace = []; q("[data-t]").forEach((e) => (trace[+e.dataset.t] = e));
const lampEls = q(".mind-lamp"), pinEls = q(".mind-pin");
const bus = q("[data-bus]"), links = LAYERS.map((_, i) => q(`[data-link="${i}"] .mind-flow`));
const bridgeEl = svg.querySelector('[data-part="bridge"]'), carriageEl = svg.querySelector('[data-part="carriage"]');
const cardEl = svg.querySelector('[data-part="card"]'), cardNo = svg.querySelector("[data-cardno]");
const dragEl = svg.querySelector("[data-drag]");
const CARD_RISE = 22;
const needles = q("[data-needle]"), layerMean = LAYERS.map(() => 0);
const inFlow = q('[data-link="in"] .mind-flow'), decLed = svg.querySelector("[data-decled]");

// state
const act = new Array(N).fill(0);            // what each lamp shows
const target = new Array(N).fill(0);         // what each lamp is asked to show
const layerAt = LAYERS.map(() => 0);         // when each layer starts following (the cascade)
let pending = null;                          // a pattern waiting to fall down the layers
let z = [0, 0], zDrag = null, selected = 0, near = -1, card = 0, hoverLamp = -1;
let clock = 0, mode = "tour", idleUntil = 0, frame = 0, last = 0, visible = true;

const nearest = (p) => { let best = -1, bd = Infinity; PROJECTS.forEach((pr, i) => { const d = Math.hypot(pr.z[0] - p[0], pr.z[1] - p[1]); if (d < bd) { bd = d; best = i; } }); return [best, bd]; };
const fmt = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
const emit = (id, extra) => document.dispatchEvent(new CustomEvent("mind:open", { detail: { id, ...extra } }));

// a pattern enters at the top and falls one layer every 0.32 s
function feed(pattern, cascade = true) {
  pending = pattern.slice();
  LAYERS.forEach((_, l) => (layerAt[l] = clock + (cascade && !still.matches ? l * 0.32 : 0)));
}
function choose(i, why) { selected = (i + PROJECTS.length) % PROJECTS.length; zDrag = null; feed(PROJECTS[selected].pattern); if (why !== "tour") pause(); }
function pause(ms = 7000) { mode = "manual"; idleUntil = performance.now() + ms; }

function step(dt) {
  clock += dt;
  if (mode === "tour" && clock > (step.next || 0)) { step.next = clock + 4.4; choose(step.i === undefined ? (step.i = 0) : ++step.i, "tour"); }
  if (mode === "manual" && performance.now() > idleUntil && !zDrag && !still.matches) { mode = "tour"; step.next = clock + 1.5; step.i = selected; }
  if (pending) NEURONS.forEach((n, i) => { if (clock >= layerAt[n.layer]) target[i] = pending[i]; });
  if (zDrag) {
    // decode: a point on the map lights a blend of the projects around it
    const wts = PROJECTS.map((p) => Math.exp(-((p.z[0] - zDrag[0]) ** 2 + (p.z[1] - zDrag[1]) ** 2) / 0.09));
    const sum = wts.reduce((a, b) => a + b, 0) || 1;
    for (let i = 0; i < N; i++) target[i] = PROJECTS.reduce((s, p, j) => s + (p.pattern[i] * wts[j]) / sum, 0);
  }
  const k1 = still.matches ? 1 : 1 - Math.exp(-dt / 0.22);
  for (let i = 0; i < N; i++) act[i] += (target[i] - act[i]) * k1;
  const want = zDrag || encode(act);
  const k2 = still.matches ? 1 : 1 - Math.exp(-dt / 0.38);
  z = [z[0] + (want[0] - z[0]) * k2, z[1] + (want[1] - z[1]) * k2];
  const [ni, nd] = nearest(z); near = nd < 0.2 ? ni : -1;
  const kc = still.matches ? 1 : 1 - Math.exp(-dt / 0.3);
  card += ((near >= 0 ? 1 : 0) - card) * kc;
}

function draw() {
  for (let i = 0; i < N; i++) {
    const a = act[i];
    glow[i].style.opacity = (a * 0.95).toFixed(3);
    trace[i].style.opacity = (0.25 + a * 0.75).toFixed(3);
    trace[i].classList.toggle("on", a > 0.5);
    lampEls[i] && lampEls[i].classList.toggle("hover", +lampEls[i].dataset.n === hoverLamp);
  }
  LAYERS.forEach((_, l) => {
    let s = 0, n = 0; NEURONS.forEach((ne, i) => { if (ne.layer === l) { s += act[i]; n++; } });
    const m = s / n; layerMean[l] = m;
    bus[l].style.opacity = Math.min(1, m * 2.2).toFixed(3);
    links[l].forEach((e) => (e.style.opacity = Math.min(1, m * 2.4).toFixed(3)));
  });
  needles.forEach((e, l) => { const m = layerMean[l], ang = -0.75 * Math.PI + m * 1.5 * Math.PI, [gx, gy, gr, gz] = e.dataset.g0.split(",").map(Number);
    e.setAttribute("d", lineOnTop([gx - Math.sin(ang) * 1.6, gy + Math.cos(ang) * 1.6], [gx + Math.sin(ang) * gr, gy - Math.cos(ang) * gr], gz + 0.1, P)); });
  inFlow.forEach((e) => (e.style.opacity = Math.min(1, layerMean[0] * 2.4).toFixed(3)));
  if (decLed) decLed.style.opacity = (0.25 + 0.75 * card).toFixed(3);
  const [tx, ty] = toTable(z[0], z[1]);
  bridgeEl.setAttribute("transform", translateAlong(P, [tx - TABLE.mx, 0, 0]));
  carriageEl.setAttribute("transform", translateAlong(P, [tx - TABLE.mx, ty, 0]));
  cardEl.setAttribute("transform", translateAlong(P, [0, 0, card * CARD_RISE]));
  pinEls.forEach((e) => e.classList.toggle("on", +e.dataset.p === near));
  if (near >= 0) cardNo.textContent = String(near + 1).padStart(2, "0");
  const lit = act.filter((a) => a > 0.5).length;
  let text;
  if (hoverLamp >= 0) { const n = NEURONS[hoverLamp]; text = `L${n.layer + 1} · ${n.name} · ${act[hoverLamp] > 0.5 ? "firing" : "quiet"}`; }
  else text = `${near >= 0 ? PROJECTS[near].name : "between projects"} · z = (${fmt(z[0])}, ${fmt(z[1])}) · ${lit} of ${N} lit`;
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
const lampOf = (e) => e.target.closest(".mind-lamp");
svg.addEventListener("pointerover", (e) => { const l = lampOf(e); hoverLamp = l ? +l.dataset.n : -1; });
svg.addEventListener("pointerout", (e) => { if (lampOf(e)) hoverLamp = -1; });
svg.addEventListener("click", (e) => {
  const lamp = lampOf(e), pin = e.target.closest(".mind-pin"), label = e.target.closest("[data-open]");
  if (lamp) { const i = +lamp.dataset.n; zDrag = null; const pat = act.map((a) => (a > 0.5 ? 1 : 0)); pat[i] = pat[i] ? 0 : 1; pending = pat; LAYERS.forEach((_, l) => (layerAt[l] = clock)); pause(); return; }
  if (pin) { const i = +pin.dataset.p; if (i === near) emit("built", { project: i }); else choose(i); return; }
  if (e.target.closest('[data-part="card"]') && near >= 0) { emit("built", { project: near }); return; }
  if (label) emit(label.dataset.open);
});
svg.addEventListener("keydown", (e) => { const label = e.target.closest("[data-open]"); if (label && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); emit(label.dataset.open); } });
// drag across the map: pick a point in latent space and decode it
function toLatent(e) {
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const s = pt.matrixTransform(svg.getScreenCTM().inverse());
  const o = iso([0, 0, TABLE.top], P), ex = iso([1, 0, TABLE.top], P), ey = iso([0, 1, TABLE.top], P);
  const a = [ex[0] - o[0], ex[1] - o[1]], b = [ey[0] - o[0], ey[1] - o[1]], d = [s.x - o[0], s.y - o[1]];
  const det = a[0] * b[1] - a[1] * b[0], x = (d[0] * b[1] - d[1] * b[0]) / det, y = (a[0] * d[1] - a[1] * d[0]) / det;
  return [Math.max(-1, Math.min(1, (x - TABLE.mx) / TABLE.sx)), Math.max(-1, Math.min(1, y / TABLE.sy))];
}
dragEl.addEventListener("pointerdown", (e) => { dragEl.setPointerCapture(e.pointerId); zDrag = toLatent(e); pending = null; mode = "manual"; idleUntil = Infinity; });
dragEl.addEventListener("pointermove", (e) => { if (dragEl.hasPointerCapture(e.pointerId)) zDrag = toLatent(e); });
const release = (e) => { if (dragEl.hasPointerCapture(e.pointerId)) dragEl.releasePointerCapture(e.pointerId); idleUntil = performance.now() + 7000; };
dragEl.addEventListener("pointerup", release); dragEl.addEventListener("pointercancel", release);
root.addEventListener("keydown", (e) => {
  if (e.target !== root) return;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); choose(selected + 1); }
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); choose(selected - 1); }
  if (e.key === "Enter" && near >= 0) emit("built", { project: near });
});
window.MIND = { PROJECTS, NEURONS, LAYERS, select: (i) => choose(i) };
if (still.matches) { mode = "manual"; idleUntil = Infinity; choose(0); }
draw(); run();
