// Pure mathematical model of a miniature Transformer + Sparse Autoencoder (SAE)
// latent space: d_model = 8, L = 6 layers, 48 monosemantic SAE features in superposition,
// 5 real prompts with layer-by-layer mechanistic notes, 3D PCA projection,
// Logit Lens at any continuous layer depth l in [0, 6], and 3D -> 8D steering back-projection.

export const D_MODEL = 8;
export const N_LAYERS = 6;
export const N_FEATURES = 48;

export function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function norm(a) {
  return Math.sqrt(dot(a, a)) || 1e-8;
}

export function unit(a) {
  const n = norm(a);
  return a.map((v) => v / n);
}

export function add(a, b, scale = 1) {
  return a.map((v, i) => v + b[i] * scale);
}

export function rmsnorm(x, eps = 1e-5) {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  const inv = 1 / Math.sqrt(s / x.length + eps);
  return x.map((v) => v * inv);
}

export function softmax(logits, temp = 1.0) {
  let m = -Infinity;
  for (const v of logits) if (v / temp > m) m = v / temp;
  const ex = logits.map((v) => Math.exp(v / temp - m));
  const sum = ex.reduce((a, b) => a + b, 0);
  return ex.map((v) => v / sum);
}

export function entropy(probs) {
  let h = 0;
  for (const p of probs) if (p > 1e-9) h -= p * Math.log2(p);
  return h;
}

// 4 Semantic Neighborhoods in R^8 (48 SAE features packed in superposition: 6x overcomplete)
export const CLUSTERS = [
  { id: "world", name: "Entities & World", center: unit([1.0, 0.0, 0.25, 0.0, 0.3, 0.0, 0.0, 0.0]) },
  { id: "code", name: "Syntax & Code", center: unit([0.0, 1.0, 0.0, 0.25, 0.0, 0.3, 0.0, 0.0]) },
  { id: "nature", name: "Physical & Nature", center: unit([-0.25, 0.0, 1.0, 0.0, 0.0, 0.0, 0.3, 0.0]) },
  { id: "logic", name: "Sequence & Tone", center: unit([0.0, -0.25, 0.0, 1.0, 0.0, 0.0, 0.0, 0.3]) },
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FEATURE_NAMES = [
  // Cluster 0: Entities & World (0..11)
  "European capitals", "France / Paris", "Geographic relation", "Proper noun",
  "Factual recall", "City landmark", "Nation-state", "Historical place",
  "Copula: is-a", "Definite article", "Atlas lookup", "Western Europe",
  // Cluster 1: Syntax & Code (12..23)
  "Python def", "Recursion pattern", "Return statement", "Function call",
  "Arithmetic op", "Identifier binding", "Base-case guard", "Colon block",
  "Parameter list", "Call-stack frame", "Expression syntax", "Fibonacci motif",
  // Cluster 2: Physical & Nature (24..35)
  "River & water", "Polysemy: bank", "Weather & flood", "Physical space",
  "Sensory imagery", "Landscape noun", "Current & flow", "Muddy shoreline",
  "Preposition: of", "Hydrology verb", "Outdoor scene", "Rising water",
  // Cluster 3: Sequence & Tone (36..47) -> 36..41 Numeric/Primes, 42..47 Emotion/Contrast
  "Prime numbers", "Numeric series", "Comma delimiter", "Next-integer rule",
  "Divisibility check", "Odd sequence", "Emotional subtext", "Contrast: though",
  "Human expression", "Eyes & tears", "Bittersweet tone", "Narrative pivot",
];

const rng = mulberry32(9137);
export const FEATURES = FEATURE_NAMES.map((name, i) => {
  const clusterIdx = Math.floor(i / 12);
  let base = CLUSTERS[clusterIdx].center;
  // Separate Sequence (36..41) vs Emotional Tone (42..47) cleanly in R^8 dims 4..7
  if (i >= 36 && i <= 41) base = unit([0.0, -0.2, -0.32, 0.76, 0.0, 0.45, 0.0, -0.42]);
  if (i >= 42 && i <= 47) base = unit([0.0, -0.2, 0.22, 0.56, -0.46, 0.0, 0.0, 0.66]);
  const jitter = Array.from({ length: D_MODEL }, () => (rng() - 0.5) * 0.62);
  const dir = unit(add(base, jitter, 1));
  return { id: i, name, cluster: clusterIdx, clusterId: CLUSTERS[clusterIdx].id, dir };
});

// 48 Mechanistic circuit edges (intra-cluster reasoning paths + cross-cluster bridges)
export const CIRCUIT_EDGES = [
  // World / Entities circuit
  [3, 2, 0.95], [2, 1, 1.0], [1, 0, 0.98], [0, 4, 0.9], [1, 5, 0.78], [4, 10, 0.85],
  [8, 0, 0.8], [9, 3, 0.7], [6, 1, 0.85], [11, 0, 0.88], [5, 7, 0.72], [10, 1, 0.92],
  // Code / Syntax circuit
  [12, 17, 0.9], [12, 19, 0.82], [19, 14, 0.92], [14, 13, 1.0], [13, 15, 0.96], [15, 16, 0.84],
  [20, 13, 0.85], [23, 13, 0.95], [23, 15, 0.9], [21, 13, 0.8], [18, 14, 0.72], [22, 15, 0.78],
  // Nature / Polysemy circuit
  [25, 24, 0.98], [24, 26, 1.0], [24, 30, 0.88], [30, 35, 0.92], [35, 26, 0.95], [29, 27, 0.82],
  [31, 24, 0.85], [33, 26, 0.9], [32, 25, 0.75], [28, 34, 0.78], [27, 34, 0.74], [25, 4, 0.52],
  // Sequence & Tone circuits
  [38, 37, 0.92], [37, 36, 1.0], [36, 39, 0.96], [40, 36, 0.88], [41, 37, 0.84],
  [43, 42, 0.98], [42, 44, 0.95], [44, 45, 1.0], [46, 45, 0.92], [47, 43, 0.88],
  // Cross-cluster superposition bridges
  [3, 17, 0.45], [16, 37, 0.55], [28, 42, 0.6], [4, 36, 0.48], [27, 2, 0.42], [14, 43, 0.38],
];

// 5 Candidate unembedding directions W_U in R^8
export const TOKENS = [
  { id: 0, text: "Paris", cluster: 0, dir: unit(add(FEATURES[0].dir, FEATURES[1].dir, 0.95)) },
  { id: 1, text: "fib(n-1)", cluster: 1, dir: unit(add(FEATURES[13].dir, FEATURES[15].dir, 0.95)) },
  { id: 2, text: "flooded", cluster: 2, dir: unit(add(FEATURES[24].dir, FEATURES[26].dir, 0.95)) },
  { id: 3, text: "watered", cluster: 3, dir: unit(add(FEATURES[42].dir, FEATURES[45].dir, 0.95)) },
  { id: 4, text: "13", cluster: 3, dir: unit(add(FEATURES[36].dir, FEATURES[39].dir, 0.95)) },
];

export const PROMPTS = [
  {
    id: "france",
    text: "The capital of France is",
    target: 0,
    x0: unit([0.1, 0.12, 0.15, 0.18, -0.35, -0.25, 0.35, -0.2]),
    pulls: [FEATURES[3].dir, FEATURES[2].dir, FEATURES[1].dir, FEATURES[0].dir, FEATURES[10].dir, TOKENS[0].dir],
    pullWeights: [0.34, 0.46, 0.62, 0.74, 0.66, 0.76],
    stageNotes: [
      "L0–L1: Token embedding enters near neutral center; copula & proper-noun syntax activate (high entropy).",
      "L2–L3: Attention binds 'capital' + 'France' → geographic lookup circuit pulls residual stream into Entities.",
      "L4–L6: SAE features 'France / Paris' & 'European capitals' fire strongly; stream aligns with W_U('Paris').",
    ],
  },
  {
    id: "fib",
    text: "def fib(n): return",
    target: 1,
    x0: unit([-0.15, 0.18, -0.1, 0.12, 0.35, -0.2, -0.3, 0.25]),
    pulls: [FEATURES[12].dir, FEATURES[19].dir, FEATURES[14].dir, FEATURES[23].dir, FEATURES[13].dir, TOKENS[1].dir],
    pullWeights: [0.36, 0.48, 0.62, 0.76, 0.68, 0.78],
    stageNotes: [
      "L0–L1: Python 'def' & colon-block syntax establish code context inside the Syntax & Code quadrant.",
      "L2–L3: Attention matches identifier 'fib' + 'return' → Fibonacci recursion motif ignites.",
      "L4–L6: Recursive call-stack features reinforce; Logit Lens locks onto 'fib(n-1)' as entropy collapses.",
    ],
  },
  {
    id: "river",
    text: "The bank of the river",
    target: 2,
    x0: unit([0.28, -0.05, 0.05, 0.05, 0.2, -0.15, -0.1, 0.1]),
    pulls: [FEATURES[4].dir, FEATURES[25].dir, FEATURES[24].dir, FEATURES[35].dir, FEATURES[26].dir, TOKENS[2].dir],
    pullWeights: [0.16, 0.56, 0.98, 0.95, 0.92, 0.98],
    stageNotes: [
      "L0–L1: Polysemy! 'bank' initially pulls the state toward factual/entity directions (high uncertainty).",
      "L2–L3: Attention head attends to 'river' → sharp 3D pivot across the cube into Physical & Nature.",
      "L4–L6: 'River & water' + 'Rising water' SAE features dominate; trajectory converges on 'flooded'.",
    ],
  },
  {
    id: "eyes",
    text: "She laughed, though her eyes",
    target: 3,
    x0: unit([0.1, -0.1, 0.14, 0.12, 0.15, 0.1, 0.05, 0.05]),
    pulls: [FEATURES[47].dir, FEATURES[43].dir, FEATURES[42].dir, FEATURES[45].dir, FEATURES[46].dir, TOKENS[3].dir],
    pullWeights: [0.35, 0.72, 0.95, 1.0, 0.95, 1.05],
    stageNotes: [
      "L0–L1: Literal sensory imagery ('laughed', 'eyes') places early state near neutral/narrative features.",
      "L2–L3: Contrastive conjunction 'though' triggers narrative pivot into Emotional Subtext.",
      "L4–L6: 'Bittersweet tone' + 'Eyes & tears' features align residual stream toward 'watered'.",
    ],
  },
  {
    id: "primes",
    text: "2, 3, 5, 7, 11,",
    target: 4,
    x0: unit([-0.1, 0.22, -0.12, 0.12, -0.2, 0.1, 0.2, 0.12]),
    pulls: [FEATURES[38].dir, FEATURES[37].dir, FEATURES[36].dir, FEATURES[40].dir, FEATURES[39].dir, TOKENS[4].dir],
    pullWeights: [0.36, 0.64, 0.88, 0.9, 0.86, 0.94],
    stageNotes: [
      "L0–L1: Comma delimiters & numeric tokens sit between Code and Sequence clusters.",
      "L2–L3: Induction & divisibility heads recognize the prime-number progression (2, 3, 5, 7, 11).",
      "L4–L6: 'Prime numbers' + 'Next-integer rule' features converge cleanly onto '13'.",
    ],
  },
];

export function forward(promptIdx, steer8 = null, clamped = null) {
  const prompt = PROMPTS[promptIdx] || PROMPTS[0];
  const states = [];
  const featActs = [];

  let x = prompt.x0.slice();
  if (steer8) x = add(x, steer8, 0.32);

  // Sparse SAE encoder: cosine similarity minus sparsity bias, with optional feature clamping/ablation
  const evalFeatures = (vec) => {
    const u = unit(vec);
    return FEATURES.map((f, i) => {
      if (clamped && clamped[i] === "ablate") return 0;
      const a = dot(u, f.dir) - 0.45;
      let val = a > 0 ? Math.min(1.5, a * 2.45) : 0;
      if (clamped && clamped[i] === "clamp") val = Math.max(val, 1.45);
      return val;
    });
  };

  states.push(x.slice());
  featActs.push(evalFeatures(x));

  for (let l = 0; l < N_LAYERS; l++) {
    let dxAttn = prompt.pulls[l].map((v) => v * prompt.pullWeights[l]);
    if (steer8) {
      const sw = l >= 1 && l <= 4 ? 0.68 : 0.3;
      dxAttn = add(dxAttn, steer8, sw);
    }
    const mid = add(x, dxAttn, 1);

    const acts = evalFeatures(mid);
    let dxMlp = new Array(D_MODEL).fill(0);
    for (let i = 0; i < N_FEATURES; i++) {
      if (acts[i] > 0) {
        const boost = clamped && clamped[i] === "clamp" ? 0.58 : 0.085;
        for (let d = 0; d < D_MODEL; d++) dxMlp[d] += acts[i] * FEATURES[i].dir[d] * boost;
      }
    }

    x = add(mid, dxMlp, 1);
    states.push(x.slice());
    featActs.push(evalFeatures(x));
  }

  return { prompt, states, featActs };
}

function computePCA3() {
  const samples = [];
  for (const f of FEATURES) samples.push(f.dir);
  for (let p = 0; p < PROMPTS.length; p++) {
    const res = forward(p);
    for (const s of res.states) samples.push(unit(s));
  }

  const mean = new Array(D_MODEL).fill(0);
  for (const s of samples) for (let d = 0; d < D_MODEL; d++) mean[d] += s[d] / samples.length;

  const cov = Array.from({ length: D_MODEL }, () => new Array(D_MODEL).fill(0));
  for (const s of samples) {
    for (let i = 0; i < D_MODEL; i++) {
      const di = s[i] - mean[i];
      for (let j = 0; j < D_MODEL; j++) cov[i][j] += (di * (s[j] - mean[j])) / samples.length;
    }
  }

  const basis = [];
  const C = cov.map((r) => r.slice());
  for (let k = 0; k < 3; k++) {
    let v = unit(Array.from({ length: D_MODEL }, (_, i) => ((i + k * 3) % 2 === 0 ? 1 : -0.7) + 0.13 * i));
    for (let iter = 0; iter < 80; iter++) {
      const next = new Array(D_MODEL).fill(0);
      for (let i = 0; i < D_MODEL; i++) {
        let sum = 0;
        for (let j = 0; j < D_MODEL; j++) sum += C[i][j] * v[j];
        next[i] = sum;
      }
      for (const prev of basis) {
        const proj = dot(next, prev);
        for (let i = 0; i < D_MODEL; i++) next[i] -= proj * prev[i];
      }
      v = unit(next);
    }
    const Av = C.map((row) => dot(row, v));
    const lam = dot(v, Av);
    basis.push(v);
    for (let i = 0; i < D_MODEL; i++) {
      for (let j = 0; j < D_MODEL; j++) C[i][j] -= lam * v[i] * v[j];
    }
  }

  let maxAbs = 0.01;
  for (const s of samples) {
    const centered = s.map((v, d) => v - mean[d]);
    for (let k = 0; k < 3; k++) {
      const c = Math.abs(dot(centered, basis[k]));
      if (c > maxAbs) maxAbs = c;
    }
  }
  const scale = 0.86 / maxAbs;
  return { mean, basis, scale };
}

export const PCA3 = computePCA3();

export function project3(vec8) {
  const u = unit(vec8);
  const centered = u.map((v, d) => v - PCA3.mean[d]);
  return [
    Math.max(-0.94, Math.min(0.94, dot(centered, PCA3.basis[0]) * PCA3.scale)),
    Math.max(-0.94, Math.min(0.94, dot(centered, PCA3.basis[1]) * PCA3.scale)),
    Math.max(-0.94, Math.min(0.94, dot(centered, PCA3.basis[2]) * PCA3.scale)),
  ];
}

export function unprojectSteer(steer3) {
  const out = new Array(D_MODEL).fill(0);
  for (let k = 0; k < 3; k++) {
    for (let d = 0; d < D_MODEL; d++) out[d] += steer3[k] * PCA3.basis[k][d];
  }
  return out;
}

export const FEATURE_POS3 = FEATURES.map((f) => project3(f.dir));
export const TOKEN_POS3 = TOKENS.map((t) => {
  const p = project3(t.dir);
  const m = Math.max(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2]), 1e-4);
  return p.map((v) => (v / m) * 0.96);
});

// Dense background superposition field ("dark matter" dormant SAE dictionary concepts)
export const N_BG = 1800;
function buildBackgroundField() {
  const r = mulberry32(42071);
  const gauss = () => (r() + r() + r() + r() - 2.0) * 0.85;
  const pos3 = [];
  const cluster = [];
  const weight = [];

  for (let i = 0; i < N_BG; i++) {
    let vec8;
    let cIdx;
    if (i < 1100) {
      // Cluster-anchored superposed concepts (dense galaxies around the 4 neighborhoods)
      cIdx = i % 4;
      const base = CLUSTERS[cIdx].center;
      const spread = 0.26 + 0.62 * Math.pow(r(), 1.2);
      vec8 = unit(base.map((v) => v + gauss() * spread));
    } else {
      // Diffuse global superposition filling the entire cube volume
      vec8 = unit(Array.from({ length: D_MODEL }, () => gauss()));
      let bestC = 0;
      let bestDot = -2;
      for (let c = 0; c < 4; c++) {
        const d = dot(vec8, CLUSTERS[c].center);
        if (d > bestDot) {
          bestDot = d;
          bestC = c;
        }
      }
      cIdx = bestC;
    }
    const p = project3(vec8);
    // Slight deterministic micro-jitter in 3D so points fill the optical volume organically
    const jx = (r() - 0.5) * 0.14;
    const jy = (r() - 0.5) * 0.14;
    const jz = (r() - 0.5) * 0.14;
    pos3.push([
      Math.max(-0.96, Math.min(0.96, p[0] + jx)),
      Math.max(-0.96, Math.min(0.96, p[1] + jy)),
      Math.max(-0.96, Math.min(0.96, p[2] + jz)),
    ]);
    cluster.push(cIdx);
    weight.push(0.35 + 0.65 * r());
  }

  // Build ~1,100 hair-thin local manifold edges (cosmic web)
  const edges = [];
  const maxEdges = 1100;
  for (let i = 0; i < N_BG && edges.length < maxEdges; i++) {
    const a = pos3[i];
    let bestJ = -1;
    let bestD2 = 0.068; // max distance ~0.26
    for (let k = 0; k < 54; k++) {
      const j = (i + 1 + ((k * 29) % (N_BG - 1))) % N_BG;
      if (j === i) continue;
      const b = pos3[j];
      const dx = a[0] - b[0];
      const dy = a[1] - b[1];
      const dz = a[2] - b[2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > 0.002 && d2 < bestD2) {
        bestD2 = d2;
        bestJ = j;
      }
    }
    if (bestJ >= 0) {
      edges.push([i, bestJ, 1.0 - Math.sqrt(bestD2) / 0.27]);
    }
  }
  return { pos3, cluster, weight, edges };
}

const BG = buildBackgroundField();
export const BG_POS3 = BG.pos3;
export const BG_CLUSTER = BG.cluster;
export const BG_WEIGHT = BG.weight;
export const BG_EDGES = BG.edges;


export function logitLens(run, layerDepth) {
  const cl = Math.max(0, Math.min(N_LAYERS, layerDepth));
  const i0 = Math.min(N_LAYERS - 1, Math.floor(cl));
  const i1 = i0 + 1;
  const t = cl - i0;
  const s = t * t * (3 - 2 * t);

  const vec = run.states[i0].map((v, d) => v * (1 - s) + run.states[i1][d] * s);
  const u = unit(vec);
  const gain = 2.0 + 3.4 * (cl / N_LAYERS);
  const logits = TOKENS.map((tok) => dot(u, tok.dir) * gain);
  const probs = softmax(logits, 1.0);
  const acts = run.featActs[i0].map((v, i) => v * (1 - s) + run.featActs[i1][i] * s);

  let topIdx = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[topIdx]) topIdx = i;

  const stageIdx = cl < 1.8 ? 0 : cl < 4.0 ? 1 : 2;
  return {
    layer: cl,
    vec8: u,
    pos3: project3(vec),
    logits,
    probs,
    entropy: entropy(probs),
    topIdx,
    topToken: TOKENS[topIdx].text,
    topProb: probs[topIdx],
    acts,
    note: run.prompt.stageNotes[stageIdx],
  };
}
