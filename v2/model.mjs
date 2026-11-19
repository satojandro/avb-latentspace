// Pure mathematical model of a miniature Transformer + Sparse Autoencoder (SAE)
// latent space: d_model = 8, L = 6 layers, 24 monosemantic SAE features,
// 5 real prompts, 3D PCA projection, Logit Lens at any continuous layer depth l in [0, 6],
// and 3D -> 8D steering back-projection.

export const D_MODEL = 8;
export const N_LAYERS = 6;
export const N_FEATURES = 24;

// --- Linear algebra helpers ---
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

// --- 24 Monosemantic SAE Features in R^8 ---
// 4 semantic clusters (6 features each), positioned as structured near-orthogonal
// directions in R^8 (true superposition: 24 directions in 8 dimensions).
export const CLUSTERS = [
  { id: "world", name: "Entities & World", center: unit([1.0, 0.0, 0.25, 0.0, 0.3, 0.0, 0.0, 0.0]) },
  { id: "code", name: "Syntax & Code", center: unit([0.0, 1.0, 0.0, 0.25, 0.0, 0.3, 0.0, 0.0]) },
  { id: "nature", name: "Physical & Nature", center: unit([-0.25, 0.0, 1.0, 0.0, 0.0, 0.0, 0.3, 0.0]) },
  { id: "logic", name: "Sequence & Tone", center: unit([0.0, -0.25, 0.0, 1.0, 0.0, 0.0, 0.0, 0.3]) },
];

// Deterministic PRNG for reproducible feature offsets
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
  // World / Entities (0..5)
  "European capitals", "France / Paris", "Geographic relation", "Proper noun", "Factual recall", "City landmark",
  // Syntax / Code (6..11)
  "Python def", "Recursion pattern", "Return statement", "Function call", "Arithmetic op", "Identifier binding",
  // Physical / Nature (12..17)
  "River & water", "Polysemy: bank", "Weather & flood", "Physical space", "Sensory imagery", "Landscape noun",
  // Sequence & Tone (18..23): 18..20 numeric/prime, 21..23 emotional/tone
  "Prime numbers", "Numeric series", "Comma delimiter", "Emotional subtext", "Contrast: though", "Human expression",
];

const rng = mulberry32(4207);
export const FEATURES = FEATURE_NAMES.map((name, i) => {
  const clusterIdx = Math.floor(i / 6);
  let base = CLUSTERS[clusterIdx].center;
  // Split cluster 3 sub-directions cleanly in R^8 (dims 4..7) so Primes vs Tone are distinct
  if (i >= 18 && i <= 20) base = unit([0.0, -0.2, -0.3, 0.75, 0.0, 0.45, 0.0, -0.4]);
  if (i >= 21 && i <= 23) base = unit([0.0, -0.2, 0.2, 0.55, -0.45, 0.0, 0.0, 0.65]);
  const jitter = Array.from({ length: D_MODEL }, () => (rng() - 0.5) * 0.52);
  const dir = unit(add(base, jitter, 1));
  return {
    id: i,
    name,
    cluster: clusterIdx,
    clusterId: CLUSTERS[clusterIdx].id,
    dir,
  };
});

// Sparse circuit edges (i -> j) representing mechanistic feature-to-feature attribution
export const CIRCUIT_EDGES = [
  // World circuit
  [3, 2, 0.9], [2, 1, 1.0], [1, 0, 0.95], [0, 4, 0.85], [1, 5, 0.7], [4, 5, 0.6],
  // Code circuit
  [6, 11, 0.85], [6, 8, 0.9], [8, 7, 1.0], [7, 9, 0.95], [9, 10, 0.8], [11, 7, 0.65],
  // Nature / polysemy circuit
  [13, 12, 0.95], [12, 14, 1.0], [12, 17, 0.85], [17, 15, 0.75], [14, 16, 0.8], [13, 4, 0.45],
  // Sequence & Tone circuits
  [20, 19, 0.9], [19, 18, 1.0], [18, 10, 0.7], [22, 21, 0.95], [21, 23, 1.0], [23, 16, 0.75],
  // Cross-cluster bridges (superposition & shared abstractions)
  [3, 11, 0.4], [10, 19, 0.5], [16, 21, 0.55], [4, 18, 0.45], [15, 2, 0.4], [8, 22, 0.35],
];

// 5 Candidate output tokens with their unembedding directions in R^8
export const TOKENS = [
  { id: 0, text: "Paris", cluster: 0, dir: unit(add(FEATURES[0].dir, FEATURES[1].dir, 0.95)) },
  { id: 1, text: "fib(n-1)", cluster: 1, dir: unit(add(FEATURES[7].dir, FEATURES[9].dir, 0.95)) },
  { id: 2, text: "flooded", cluster: 2, dir: unit(add(FEATURES[12].dir, FEATURES[14].dir, 0.95)) },
  { id: 3, text: "watered", cluster: 3, dir: unit(add(FEATURES[21].dir, FEATURES[23].dir, 0.95)) },
  { id: 4, text: "13", cluster: 3, dir: unit(add(FEATURES[18].dir, FEATURES[19].dir, 0.95)) },
];

// 5 Real prompts: each starts near the ambiguous center (high entropy at L0)
// and receives layer-by-layer attention + MLP updates toward its active circuit.
export const PROMPTS = [
  {
    id: "france",
    text: "The capital of France is",
    target: 0,
    x0: unit([0.1, 0.12, 0.15, 0.18, -0.35, -0.25, 0.35, -0.2]),
    pulls: [
      FEATURES[3].dir,
      FEATURES[2].dir,
      FEATURES[1].dir,
      FEATURES[0].dir,
      FEATURES[4].dir,
      TOKENS[0].dir,
    ],
    pullWeights: [0.32, 0.44, 0.58, 0.7, 0.62, 0.72],
  },
  {
    id: "fib",
    text: "def fib(n): return",
    target: 1,
    x0: unit([-0.15, 0.18, -0.1, 0.12, 0.35, -0.2, -0.3, 0.25]),
    pulls: [
      FEATURES[6].dir,
      FEATURES[11].dir,
      FEATURES[8].dir,
      FEATURES[7].dir,
      FEATURES[9].dir,
      TOKENS[1].dir,
    ],
    pullWeights: [0.34, 0.46, 0.58, 0.72, 0.64, 0.74],
  },
  {
    id: "river",
    text: "The bank of the river",
    target: 2,
    // Starts leaning slightly toward World/Factual ("bank"), then "river" pivots it into Nature!
    x0: unit([0.28, -0.05, 0.05, 0.05, 0.2, -0.15, -0.1, 0.1]),
    pulls: [
      FEATURES[4].dir,  // L1: "bank" briefly leans factual/world
      FEATURES[13].dir, // L2: polysemy resolution
      FEATURES[12].dir, // L3: "river" pulls sharply into Nature!
      FEATURES[14].dir,
      FEATURES[17].dir,
      TOKENS[2].dir,
    ],
    pullWeights: [0.16, 0.55, 0.95, 0.9, 0.85, 0.95],
  },
  {
    id: "eyes",
    text: "She laughed, though her eyes",
    target: 3,
    x0: unit([0.12, -0.1, 0.22, 0.1, 0.2, 0.15, 0.15, -0.1]),
    pulls: [
      FEATURES[16].dir,
      FEATURES[22].dir, // "though" contrast pivot!
      FEATURES[21].dir,
      FEATURES[23].dir,
      FEATURES[21].dir,
      TOKENS[3].dir,
    ],
    pullWeights: [0.22, 0.62, 0.85, 0.9, 0.8, 0.9],
  },
  {
    id: "primes",
    text: "2, 3, 5, 7, 11,",
    target: 4,
    x0: unit([-0.1, 0.22, -0.12, 0.12, -0.2, 0.1, 0.2, 0.12]),
    pulls: [
      FEATURES[20].dir,
      FEATURES[19].dir,
      FEATURES[18].dir,
      FEATURES[19].dir,
      FEATURES[18].dir,
      TOKENS[4].dir,
    ],
    pullWeights: [0.35, 0.62, 0.85, 0.88, 0.82, 0.92],
  },
];

// Forward pass for a prompt with optional 8-D steering vector
export function forward(promptIdx, steer8 = null) {
  const prompt = PROMPTS[promptIdx] || PROMPTS[0];
  const states = [];
  const featActs = []; // [layer 0..6][24]

  let x = prompt.x0.slice();
  if (steer8) x = add(x, steer8, 0.3);

  // Sparse SAE encoder: unit cosine similarity minus threshold
  const evalFeatures = (vec) => {
    const u = unit(vec);
    return FEATURES.map((f) => {
      const a = dot(u, f.dir) - 0.44;
      return a > 0 ? Math.min(1.5, a * 2.4) : 0;
    });
  };

  states.push(x.slice());
  featActs.push(evalFeatures(x));

  for (let l = 0; l < N_LAYERS; l++) {
    let dxAttn = prompt.pulls[l].map((v) => v * prompt.pullWeights[l]);
    if (steer8) {
      const sw = l >= 1 && l <= 4 ? 0.65 : 0.28;
      dxAttn = add(dxAttn, steer8, sw);
    }
    const mid = add(x, dxAttn, 1);

    // MLP / SAE sparse feature reconstruction
    const acts = evalFeatures(mid);
    let dxMlp = new Array(D_MODEL).fill(0);
    for (let i = 0; i < N_FEATURES; i++) {
      if (acts[i] > 0) {
        for (let d = 0; d < D_MODEL; d++) dxMlp[d] += acts[i] * FEATURES[i].dir[d] * 0.16;
      }
    }

    x = add(mid, dxMlp, 1);
    states.push(x.slice());
    featActs.push(evalFeatures(x));
  }

  return { prompt, states, featActs };
}

// Compute 3D PCA basis from all SAE features + all unsteered trajectories
function computePCA3() {
  const samples = [];
  for (const f of FEATURES) samples.push(f.dir);
  for (let p = 0; p < PROMPTS.length; p++) {
    const res = forward(p);
    for (const s of res.states) samples.push(unit(s));
  }

  // Mean
  const mean = new Array(D_MODEL).fill(0);
  for (const s of samples) for (let d = 0; d < D_MODEL; d++) mean[d] += s[d] / samples.length;

  // Covariance matrix (8x8)
  const cov = Array.from({ length: D_MODEL }, () => new Array(D_MODEL).fill(0));
  for (const s of samples) {
    for (let i = 0; i < D_MODEL; i++) {
      const di = s[i] - mean[i];
      for (let j = 0; j < D_MODEL; j++) cov[i][j] += (di * (s[j] - mean[j])) / samples.length;
    }
  }

  // Power iteration with deflation for top 3 eigenvectors
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
  const scale = 0.84 / maxAbs;

  return { mean, basis, scale };
}

export const PCA3 = computePCA3();

// Project an 8-D vector into normalized cube coordinates [-1, 1]^3
export function project3(vec8) {
  const u = unit(vec8);
  const centered = u.map((v, d) => v - PCA3.mean[d]);
  return [
    Math.max(-0.94, Math.min(0.94, dot(centered, PCA3.basis[0]) * PCA3.scale)),
    Math.max(-0.94, Math.min(0.94, dot(centered, PCA3.basis[1]) * PCA3.scale)),
    Math.max(-0.94, Math.min(0.94, dot(centered, PCA3.basis[2]) * PCA3.scale)),
  ];
}

// Back-project a 3D steering delta in [-1, 1]^3 into R^8 via PCA3.basis^T
export function unprojectSteer(steer3) {
  const out = new Array(D_MODEL).fill(0);
  for (let k = 0; k < 3; k++) {
    for (let d = 0; d < D_MODEL; d++) {
      out[d] += steer3[k] * PCA3.basis[k][d];
    }
  }
  return out;
}

// Precomputed 3D coordinates of all 24 SAE features and 5 unembedding beacons
export const FEATURE_POS3 = FEATURES.map((f) => project3(f.dir));
export const TOKEN_POS3 = TOKENS.map((t) => {
  const p = project3(t.dir);
  const m = Math.max(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2]), 1e-4);
  return p.map((v) => (v / m) * 0.96);
});

// Logit Lens at any continuous layer depth l in [0, N_LAYERS]
export function logitLens(run, layerDepth) {
  const cl = Math.max(0, Math.min(N_LAYERS, layerDepth));
  const i0 = Math.min(N_LAYERS - 1, Math.floor(cl));
  const i1 = i0 + 1;
  const t = cl - i0;
  const s = t * t * (3 - 2 * t);

  const vec = run.states[i0].map((v, d) => v * (1 - s) + run.states[i1][d] * s);
  const u = unit(vec);
  // Real Logit Lens behavior: early layers have lower effective gain / higher entropy,
  // sharpening monotonically as the residual stream aligns with W_U.
  const gain = 2.0 + 3.2 * (cl / N_LAYERS);
  const logits = TOKENS.map((tok) => dot(u, tok.dir) * gain);
  const probs = softmax(logits, 1.0);
  const acts = run.featActs[i0].map((v, i) => v * (1 - s) + run.featActs[i1][i] * s);

  let topIdx = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[topIdx]) topIdx = i;

  return {
    layer: cl,
    pos3: project3(vec),
    logits,
    probs,
    entropy: entropy(probs),
    topIdx,
    topToken: TOKENS[topIdx].text,
    topProb: probs[topIdx],
    acts,
  };
}
