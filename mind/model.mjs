// A tiny but real transformer forward pass. The figure, the readout, the motion and the
// project page all read from this one model. MODEL_SRC is evaluated here for the build and
// inlined verbatim into the page.
//
// What is real: token embeddings, a residual stream that every block adds to, one dot-product
// attention head, MLP neurons with a key (what they detect) and a value (what they write),
// GELU, RMSNorm, an unembedding by dot product, softmax, ablation and activation steering,
// and a 2-D PCA projection of the stream. What is simplified: d_model is 8, not 4,096; there
// are 4 blocks, not 32; one attention head in block 1 only; the 8 directions are given names;
// and the weights are written by hand instead of learned.
export const MODEL_SRC = String.raw`
const FEATURES = ["people", "systems", "explain", "build", "money", "place", "rules", "story"];
const D = FEATURES.length;
const vec = (o) => FEATURES.map((f) => o[f] || 0);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);
const rms = (h) => Math.sqrt(dot(h, h) / D + 1e-6);
const rmsnorm = (h) => { const r = rms(h); return h.map((v) => v / r); };
const gelu = (x) => 0.5 * x * (1 + Math.tanh(0.7978845608 * (x + 0.044715 * x * x * x)));
const softmax = (xs) => { const m = Math.max(...xs), e = xs.map((x) => Math.exp(x - m)), s = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s); };

const LAYERS = [
  { id: "caracas",   title: "Origins · Caracas" },
  { id: "melbourne", title: "Arts / Law · Melbourne" },
  { id: "world",     title: "Travel" },
  { id: "crypto",    title: "Crypto" },
];
// The prompt is three tokens: "I", a context word, "build". The model predicts the next token.
const CONTEXTS = ["teach", "connect", "fix", "explore", "trade"];
const EMBED = {
  I:       vec({ people: 0.3, story: 0.3 }),
  build:   vec({ build: 0.6 }),
  teach:   vec({ explain: 1, people: 0.4, story: 0.3 }),
  connect: vec({ people: 1, place: 0.4 }),
  fix:     vec({ systems: 1, rules: 0.5, build: 0.3 }),
  explore: vec({ place: 1, story: 0.4 }),
  trade:   vec({ money: 1, people: 0.3, rules: 0.2 }),
};
// Attention head (block 1). The query is W_Q·x_build: "build" looks for an intent word.
// Keys and values are the token embeddings themselves (W_K = W_V = identity).
const QUERY = vec({ people: 0.9, systems: 0.9, explain: 0.9, money: 0.9, place: 0.9, rules: 0.9, story: 0.6 });
const ATTN_SCALE = 3 / Math.sqrt(D);

// MLP neurons. EXAMPLES: replace with the real things that shaped you.
// key: the direction a neuron fires on. write: the direction it adds to the stream.
const N = (layer, name, key, write) => ({ layer, name, key: vec(key), write: vec(write) });
const NEURONS = [
  N(0, "Spanish at home",          { people: 0.6, story: 0.8 },  { story: 0.6, people: 0.3 }),
  N(0, "The family table",         { people: 1 },                { people: 0.7 }),
  N(0, "El Ávila every morning",   { place: 1 },                 { place: 0.6, story: 0.2 }),
  N(0, "Baseball on Sundays",      { people: 0.8, place: 0.3 },  { people: 0.4, place: 0.2 }),
  N(0, "Salsa and gaita",          { story: 0.7, people: 0.5 },  { story: 0.5, people: 0.4 }),
  N(0, "A country in flux",        { systems: 0.7, rules: 0.5 }, { systems: 0.4, rules: 0.5, money: 0.3 }),
  N(0, "Making do",                { build: 0.7, money: 0.5 },   { build: 0.4, money: 0.3 }),
  N(0, "School debates",           { explain: 0.8, rules: 0.4 }, { explain: 0.6 }),
  N(1, "Why people act",           { people: 1 },                { people: 0.5, explain: 0.3 }),
  N(1, "How rules work",           { rules: 0.8, systems: 0.5 }, { rules: 0.6, systems: 0.4 }),
  N(1, "Arguing both sides",       { explain: 0.7, rules: 0.5 }, { explain: 0.5, rules: 0.3 }),
  N(1, "Writing clearly",          { explain: 1 },               { explain: 0.7, story: 0.3 }),
  N(1, "Moving countries",         { place: 0.8, people: 0.4 },  { place: 0.5, people: 0.2 }),
  N(1, "English, second language", { story: 0.6, explain: 0.5 }, { explain: 0.4, story: 0.3 }),
  N(2, "Strangers' tables",        { people: 0.8, place: 0.5 },  { people: 0.6, place: 0.3 }),
  N(2, "Getting lost",             { place: 1 },                 { place: 0.6, build: 0.2 }),
  N(2, "Asia",                     { place: 0.7, money: 0.3 },   { place: 0.5, money: 0.2 }),
  N(2, "Europe",                   { place: 0.7, story: 0.4 },   { place: 0.4, story: 0.4 }),
  N(2, "The Americas",             { place: 0.6, people: 0.5 },  { place: 0.4, people: 0.4 }),
  N(2, "Packing light",            { place: 0.5, systems: 0.5 }, { place: 0.3, systems: 0.3 }),
  N(3, "Community",                { people: 1 },                { people: 0.6, money: 0.2 }),
  N(3, "Operations",               { systems: 0.8, rules: 0.4 }, { systems: 0.6, rules: 0.2 }),
  N(3, "Partnerships",             { people: 0.6, money: 0.6 },  { money: 0.5, people: 0.4 }),
  N(3, "Explaining the tech",      { explain: 0.8, systems: 0.5 },{ explain: 0.6, systems: 0.3 }),
  N(3, "Markets up and down",      { money: 1 },                 { money: 0.7, systems: 0.2 }),
  N(3, "Open source",              { people: 0.5, systems: 0.6 }, { systems: 0.3, people: 0.4 }),
];
const KEY_GAIN = 1.25, BIAS = -0.75, WRITE_GAIN = 0.55, LOGIT_GAIN = 1.6;

// Output tokens: the projects. Each one's unembedding vector is the direction that predicts it.
// PLACEHOLDERS: replace with what you've built.
const PROJECT_LIST = [
  { name: "Project One",   line: "One sentence on what it does and who it's for.", stack: "Next.js · Claude API", status: "Live", year: "2025", url: "#", u: { explain: 1, people: 0.5, story: 0.6 } },
  { name: "Project Two",   line: "An agent, a tool, an experiment. What problem made you build it?", stack: "Python · Supabase", status: "Beta", year: "2025", url: "#", u: { systems: 1, rules: 0.5 } },
  { name: "Project Three", line: "The weird side project you're proudest of.", stack: "React · Three.js", status: "Prototype", year: "2026", url: "#", u: { place: 1, story: 0.5 } },
  { name: "Project Four",  line: "Something that explains a hard system to normal people.", stack: "Astro · D3", status: "Live", year: "2026", url: "#", u: { money: 0.9, systems: 0.6, rules: 0.6, explain: 0.4 } },
  { name: "Project Five",  line: "Something that brings people together.", stack: "Swift · Firebase", status: "Idea", year: "2026", url: "#", u: { people: 1, place: 0.4, money: 0.1 } },
];
const UNEMBED = PROJECT_LIST.map((p) => vec(p.u));

// The forward pass. off: a set of ablated neuron indices. steer: a vector added before the unembedding.
function forward(ctx, off = new Set(), steer = null) {
  const toks = ["I", ctx, "build"].map((t) => EMBED[t]);
  const scores = toks.map((k) => dot(QUERY, k) * ATTN_SCALE * toks[2][3]);
  const attn = softmax(scores);
  let h = toks[2].slice();
  toks.forEach((v, j) => (h = add(h, v, attn[j])));
  const states = [h.slice()], act = new Array(NEURONS.length).fill(0);
  for (let l = 0; l < LAYERS.length; l++) {
    const x = rmsnorm(h);
    let write = new Array(D).fill(0);
    NEURONS.forEach((n, i) => {
      if (n.layer !== l) return;
      const a = off.has(i) ? 0 : gelu(KEY_GAIN * dot(n.key, x) + BIAS);
      act[i] = a;
      write = add(write, n.write, a * WRITE_GAIN);
    });
    h = add(h, write);
    states.push(h.slice());
  }
  const final = steer ? add(h, steer) : h;
  const logits = UNEMBED.map((u) => LOGIT_GAIN * dot(u, rmsnorm(final)));
  const probs = softmax(logits);
  return { attn, act, states, final, logits, probs };
}
// Direct logit attribution: how much each neuron's write pushed the winning project's logit.
function attribution(ctx, p) {
  const r = forward(ctx), x = rms(r.final), u = UNEMBED[p];
  return NEURONS.map((n, i) => ({ i, name: n.name, layer: n.layer, push: (r.act[i] * WRITE_GAIN * dot(n.write, u)) / x }))
    .filter((a) => a.push > 0.01).sort((a, b) => b.push - a.push);
}

// PCA of the normalised stream at every stage of every prompt, plus the unembedding directions.
function pca2() {
  const pts = [];
  CONTEXTS.forEach((c) => forward(c).states.forEach((s) => pts.push(rmsnorm(s))));
  UNEMBED.forEach((u) => pts.push(rmsnorm(u)));
  const mean = new Array(D).fill(0); pts.forEach((p) => p.forEach((v, i) => (mean[i] += v / pts.length)));
  const X = pts.map((p) => p.map((v, i) => v - mean[i]));
  const cov = FEATURES.map((_, i) => FEATURES.map((_, j) => X.reduce((s, x) => s + x[i] * x[j], 0) / X.length));
  const power = (M, skip) => { let v = FEATURES.map((_, i) => 1 + i * 0.13);
    for (let it = 0; it < 300; it++) { if (skip) { const k = dot(v, skip); v = add(v, skip, -k); }
      let w = M.map((row) => dot(row, v)); const n = Math.sqrt(dot(w, w)); v = w.map((x) => x / n); }
    if (skip) { const k = dot(v, skip); v = add(v, skip, -k); const n = Math.sqrt(dot(v, v)); v = v.map((x) => x / n); }
    return v; };
  const pc1 = power(cov), pc2 = power(cov, pc1);
  // scale to the stream's own path (the pins are directions and may sit at the edge)
  let span = 0; X.slice(0, X.length - UNEMBED.length).forEach((x) => (span = Math.max(span, Math.abs(dot(x, pc1)), Math.abs(dot(x, pc2)))));
  return { mean, pc1, pc2, scale: 0.92 / span };
}
const PCA = pca2();
const project2 = (h) => { const x = rmsnorm(h).map((v, i) => v - PCA.mean[i]); return [dot(x, PCA.pc1) * PCA.scale, dot(x, PCA.pc2) * PCA.scale]; };
// A steering vector that moves the final state's projection by (du, dv) on the map.
const steerFor = (h, du, dv) => add(PCA.pc1.map((v) => (v * du * rms(h)) / PCA.scale), PCA.pc2, (dv * rms(h)) / PCA.scale);

// A pin marks a project's output direction: its unembedding vector, projected, at a fixed radius.
const clampPin = ([u, v]) => { const a = Math.atan2(v, u); return [0.86 * Math.cos(a), 0.86 * Math.sin(a)]; };
const PROJECTS = PROJECT_LIST.map((p, i) => ({ ...p, z: clampPin(project2(UNEMBED[i])) }));
// The map table, in world units; projected coordinates (−1..1, −1..1) map onto its inlay.
const TABLE = { x: 376, y: -86, w: 184, d: 172, z: 10, top: 18, mx: 468, sx: 72, sy: 66 };
const toTable = (u, v) => [TABLE.mx + u * TABLE.sx, v * TABLE.sy];
`;
const M = new Function(MODEL_SRC + "; return { FEATURES, D, LAYERS, CONTEXTS, EMBED, NEURONS, PROJECTS, UNEMBED, forward, attribution, project2, steerFor, rms, TABLE, toTable, PCA };")();
export const { FEATURES, D, LAYERS, CONTEXTS, EMBED, NEURONS, PROJECTS, UNEMBED, forward, attribution, project2, steerFor, rms, TABLE, toTable, PCA } = M;
