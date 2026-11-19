// Personal Latent Space Model (Enriched 12-D Edition)
// 5 Chronological Chapters (1989 -> Today) deconstructed via 5 parallel enrichment passes
// into 186 distinct atomic nodes (events, priors, skills, tensions) in R^12 -> PCA 3D,
// with mathematically emergent cross-era bridges (cosine similarity + shared cognitive dimensions),
// 12-D semantic synthesis lenses, and 1,600 time-accumulating background lived-experience stars.

export const D_MODEL = 12;
export const N_CHAPTERS = 5;

export const DIM_NAMES = [
  "Institutional Skepticism",
  "Sovereign Agency",
  "Systems & Tech Depth",
  "UX & Aesthetic Taste",
  "Narrative & Translation",
  "Contrarian First-Principles",
  "Ambition & Drive",
  "Geopolitical Awareness",
  "Anti-Middleman Ethos",
  "Frontier Curiosity",
  "Execution Velocity",
  "Lived Grit",
];

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
export function cosSim(a, b) {
  return dot(a, b) / (norm(a) * norm(b));
}

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

export const CLUSTERS = [
  {
    id: "systems",
    name: "Systems & Sovereignty",
    desc: "Institutional fragility, rule of law, sound money, and trustless code.",
  },
  {
    id: "agency",
    name: "Agency & Exit",
    desc: "Self-reliance, bypassing gatekeepers, anti-complacency, and contrarian conviction.",
  },
  {
    id: "craft",
    name: "Frontier Tech & Craft",
    desc: "Engineering proximity, UX taste, signal over hype, and AI-powered building.",
  },
  {
    id: "narrative",
    name: "Narrative & Bridges",
    desc: "Bicultural fluency, history & politics, community building, and translating worlds.",
  },
];

export const CHAPTERS = [
  {
    id: "venezuela",
    num: 1,
    years: "1989 – 2008",
    title: "Venezuela",
    subtitle: "Prosperity, institutional collapse & the instinct to exit",
    summary:
      "Born the year the Berlin Wall fell into a prosperous, oil-rich middle-class home. Bilingual early at an American school with an engineer father — then watching socialism, street protests, and institutional decay unfold in slow motion until leaving solo in 2008.",
    echoNote: "Origin layer (38 nodes): plants the foundational priors — institutional skepticism, bicultural fluency, and engineering proximity.",
  },
  {
    id: "australia",
    num: 2,
    years: "2008 – 2014",
    title: "Australia · Arts & Law",
    subtitle: "Solo arrival, systems that work & friction with complacency",
    summary:
      "Landed in Australia alone and studied Politics, International Studies, History, and Law at Monash. Studying a functional legal system sharpened a structural worldview — while debating comfortable idealists hardened a freedom-first, high-ambition stance.",
    echoNote: "38 new nodes crystallize; emergent bridges fire back to Ch. 1 (institutional fragility, exit reflex, historical awareness).",
  },
  {
    id: "law",
    num: 3,
    years: "2015 – 2017",
    title: "Crypto Law · The Pivot",
    subtitle: "Skipping the script, cold-emailing the #1 partner & pragmatic exit",
    summary:
      "Bypassed every graduate recruitment pipeline and emailed Australia's top crypto law partner directly. Earned admission as a lawyer in Sydney — and stepped out the moment the credential was complete to move straight into technology.",
    echoNote: "30 new nodes crystallize; high-agency cold outreach & pragmatic exit bridge Ch. 1–2 directly into the frontier.",
  },
  {
    id: "crypto",
    num: 4,
    years: "2013 – 2023",
    title: "Crypto & NEAR Ecosystem",
    subtitle: "Cypherpunk conviction, non-technical leadership & latent builder tension",
    summary:
      "Bitcoin clicked instantly in 2013 through Venezuelan hyperinflation. From Melbourne Blockchain Centre to becoming a recognized voice in the early NEAR ecosystem across BD, governance, content, and community — surrounded by engineers, full of ideas, always one step from shipping them solo.",
    echoNote: "42 new nodes crystallize; strong emergent echoes connect Ch. 1 monetary decay & Ch. 2 rule-of-law into cypherpunk code.",
  },
  {
    id: "ai",
    num: 5,
    years: "2023 – Today",
    title: "AI Builder Mode",
    subtitle: "Removing the last middleman — vibe coding, hackathons & sovereign shipping",
    summary:
      "The moment AI arrived, taught himself to code among the earliest wave of vibe coders. Peak curiosity testing every new model and tool, winning hackathons, and shipping increasingly ambitious projects — finally turning a decade of latent product ideas into real software.",
    echoNote: "38 new nodes crystallize; full-cube synthesis links legal clarity, gatekeeper bypass, UX taste & cypherpunk ethos into sovereign shipping.",
  },
];

// 4 Semantic Synthesis Lenses defined as real 12-D query vectors (evaluated via cosine similarity!)
// Dims: [0:InstSkep, 1:Agency, 2:Tech, 3:UX, 4:Narrative, 5:Contrarian, 6:Ambition, 7:GeoPol, 8:AntiMid, 9:Curiosity, 10:ExecVel, 11:Grit]
export const LENSES = [
  {
    id: "crypto-click",
    title: "Why did crypto click instantly?",
    subtitle: "Emergent resonance: institutional skepticism + anti-middleman ethos + geopolitical memory",
    summary:
      "Bitcoin didn't arrive as an abstract whitepaper — it landed on top of lived hyperinflation, institutional collapse, and a Monash law degree. Immutable code became the logical answer to systems that fail their citizens.",
    query12: unit([0.95, 0.35, 0.45, 0.0, 0.15, 0.65, 0.2, 0.78, 0.98, 0.35, 0.1, 0.45]),
  },
  {
    id: "builder-arc",
    title: "How did a lawyer become an AI builder?",
    subtitle: "Emergent resonance: systems depth + UX taste + execution velocity + curiosity",
    summary:
      "Growing up with an engineer father, spending years beside NEAR engineers, and holding sharp UX taste coiled a decade of ideas. When AI arrived, vibe coding removed the last bottleneck — turning clarity and taste directly into shipped software.",
    query12: unit([0.05, 0.45, 0.96, 0.82, 0.25, 0.25, 0.55, 0.0, 0.55, 0.90, 0.98, 0.15]),
  },
  {
    id: "agency-exit",
    title: "What drives the refusal to settle?",
    subtitle: "Emergent resonance: sovereign agency + ambition + contrarian conviction + lived grit",
    summary:
      "Leaving Venezuela solo at 18, rejecting comfortable complacency in Australia, cold-emailing the #1 crypto law partner instead of applying to grad programs, and leaving law the moment admission cleared — one consistent high-agency vector.",
    query12: unit([0.4, 0.98, 0.15, 0.05, 0.2, 0.85, 0.95, 0.3, 0.5, 0.3, 0.55, 0.82]),
  },
  {
    id: "narrative-edge",
    title: "What is the nonlinear communicator's edge?",
    subtitle: "Emergent resonance: narrative translation + UX taste + geopolitical & tech fluency",
    summary:
      "Early bilingualism, History & Politics, legal writing, NEAR ecosystem storytelling, and now interactive visual systems — the rare ability to translate complex technical and structural truths so humans can actually feel them.",
    query12: unit([0.25, 0.25, 0.55, 0.85, 0.98, 0.35, 0.35, 0.65, 0.15, 0.65, 0.45, 0.2]),
  },
];

// Injected by build.mjs from v2/mind/data/ch1..ch5.json
const RAW_NODES = __RAW_NODES__;

// Build normalized 186-node dataset with smooth bornAt timestamps
const chapCounts = [0, 0, 0, 0, 0];
for (const n of RAW_NODES) chapCounts[n.chapter]++;
const chapSeen = [0, 0, 0, 0, 0];

export const NODES = RAW_NODES.map((n, id) => {
  const cIdx = chapSeen[n.chapter]++;
  const bornAt = n.chapter + 0.04 + (cIdx / Math.max(1, chapCounts[n.chapter] - 1)) * 0.92;
  return {
    id,
    chapter: n.chapter,
    name: n.name,
    year: n.year,
    kind: n.kind,
    cluster: n.cluster,
    story: n.story,
    vec: n.vec,
    dir: unit(n.vec),
    bornAt,
  };
});

export const N_NODES = NODES.length;

// =========================================================================
// EMERGENT INTERLINKING (DISCOVERED PURELY FROM 12-D COSINE SIMILARITY!)
// =========================================================================
function sharedDimsLabel(aVec, bVec) {
  const prods = aVec.map((v, d) => ({ d, p: Math.max(0, v) * Math.max(0, bVec[d]) }));
  prods.sort((x, y) => y.p - x.p);
  const top = prods.filter((x) => x.p > 0.12).slice(0, 2);
  if (!top.length) return "Latent alignment";
  return top.map((x) => DIM_NAMES[x.d]).join(" + ");
}

function discoverEmergentEdges() {
  const edgeMap = new Map();
  const addEdge = (i, j, sim, isBridge) => {
    const a = Math.min(i, j), b = Math.max(i, j);
    const key = `${a}_${b}`;
    if (edgeMap.has(key)) return;
    // Order from earlier chapter -> later chapter for directional pulses
    const [from, to] = NODES[a].bornAt <= NODES[b].bornAt ? [a, b] : [b, a];
    const shared = sharedDimsLabel(NODES[from].vec, NODES[to].vec);
    edgeMap.set(key, [from, to, sim, isBridge, shared]);
  };

  for (let i = 0; i < N_NODES; i++) {
    const crossCands = [];
    const intraCands = [];
    for (let j = 0; j < N_NODES; j++) {
      if (i === j) continue;
      const sim = cosSim(NODES[i].vec, NODES[j].vec);
      if (NODES[i].chapter !== NODES[j].chapter) {
        if (sim > 0.87) crossCands.push([j, sim]);
      } else {
        if (sim > 0.88) intraCands.push([j, sim]);
      }
    }
    crossCands.sort((x, y) => y[1] - x[1]);
    intraCands.sort((x, y) => y[1] - x[1]);

    // Top 2 emergent cross-era bridges per node (preferring distinct target chapters)
    const usedChap = new Set();
    let crossAdded = 0;
    for (const [j, sim] of crossCands) {
      if (crossAdded >= 2) break;
      const ch = NODES[j].chapter;
      if (usedChap.has(ch) && crossCands.length > 3) continue;
      usedChap.add(ch);
      addEdge(i, j, sim, true);
      crossAdded++;
    }
    // Top 1 emergent intra-chapter semantic neighbor
    if (intraCands.length > 0) {
      addEdge(i, intraCands[0][0], intraCands[0][1], false);
    }
  }
  return [...edgeMap.values()];
}

export const EDGES = discoverEmergentEdges();

// Pre-index adjacency per node for O(1) Story Card lookup
export const NODE_EDGES = Array.from({ length: N_NODES }, () => ({ incoming: [], outgoing: [] }));
for (let eIdx = 0; eIdx < EDGES.length; eIdx++) {
  const [from, to, sim, isBridge, shared] = EDGES[eIdx];
  NODE_EDGES[to].incoming.push({ id: from, sim, isBridge, shared });
  NODE_EDGES[from].outgoing.push({ id: to, sim, isBridge, shared });
}
for (let i = 0; i < N_NODES; i++) {
  NODE_EDGES[i].incoming.sort((a, b) => b.sim - a.sim);
  NODE_EDGES[i].outgoing.sort((a, b) => b.sim - a.sim);
}

// =========================================================================
// REAL 12-D -> 3-D PCA PROJECTION
// =========================================================================
function computePCA3() {
  const samples = NODES.map((n) => n.dir);
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
  const scale = 0.88 / maxAbs;
  return { mean, basis, scale };
}

export const PCA3 = computePCA3();

export function project3(vec12) {
  const u = unit(vec12);
  const centered = u.map((v, d) => v - PCA3.mean[d]);
  return [
    Math.max(-0.94, Math.min(0.94, dot(centered, PCA3.basis[0]) * PCA3.scale)),
    Math.max(-0.94, Math.min(0.94, dot(centered, PCA3.basis[1]) * PCA3.scale)),
    Math.max(-0.94, Math.min(0.94, dot(centered, PCA3.basis[2]) * PCA3.scale)),
  ];
}

export const NODE_POS3 = NODES.map((n) => project3(n.dir));

export const CHAPTER_POS3 = CHAPTERS.map((_, chIdx) => {
  const sum = [0, 0, 0];
  let cnt = 0;
  for (let i = 0; i < N_NODES; i++) {
    if (NODES[i].chapter === chIdx) {
      sum[0] += NODE_POS3[i][0];
      sum[1] += NODE_POS3[i][1];
      sum[2] += NODE_POS3[i][2];
      cnt++;
    }
  }
  return [sum[0] / Math.max(1, cnt), sum[1] / Math.max(1, cnt), sum[2] / Math.max(1, cnt)];
});

// Dense Background Field of Unspoken Lived Moments (1,500 stars anchored around the 186 real nodes)
export const N_BG = 1500;
function buildLivedField() {
  const r = mulberry32(892026);
  const gauss = () => (r() + r() + r() + r() - 2.0) * 0.85;
  const pos3 = [];
  const cluster = [];
  const weight = [];
  const bornAt = [];

  for (let i = 0; i < N_BG; i++) {
    const host = NODES[i % N_NODES];
    const isDiffuse = i >= 1050;
    const vec12 = isDiffuse
      ? unit(Array.from({ length: D_MODEL }, () => Math.max(-0.2, gauss() * 0.55 + 0.35)))
      : unit(host.dir.map((v) => v + gauss() * (0.20 + 0.42 * r())));
    const p = project3(vec12);
    pos3.push([
      Math.max(-0.96, Math.min(0.96, p[0] + (r() - 0.5) * 0.14)),
      Math.max(-0.96, Math.min(0.96, p[1] + (r() - 0.5) * 0.14)),
      Math.max(-0.96, Math.min(0.96, p[2] + (r() - 0.5) * 0.14)),
    ]);
    cluster.push(host.cluster);
    weight.push(0.35 + 0.65 * r());
    bornAt.push(isDiffuse ? r() * 4.95 : Math.max(0, Math.min(4.98, host.bornAt + (r() - 0.35) * 0.5)));
  }

  const edges = [];
  const maxEdges = 850;
  for (let i = 0; i < N_BG && edges.length < maxEdges; i++) {
    const a = pos3[i];
    let bestJ = -1;
    let bestD2 = 0.064;
    for (let k = 0; k < 42; k++) {
      const j = (i + 1 + ((k * 37) % (N_BG - 1))) % N_BG;
      if (j === i) continue;
      const b = pos3[j];
      const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > 0.002 && d2 < bestD2) { bestD2 = d2; bestJ = j; }
    }
    if (bestJ >= 0) edges.push([i, bestJ, 1.0 - Math.sqrt(bestD2) / 0.26, Math.max(bornAt[i], bornAt[bestJ])]);
  }
  return { pos3, cluster, weight, bornAt, edges };
}

const BG = buildLivedField();
export const BG_POS3 = BG.pos3;
export const BG_CLUSTER = BG.cluster;
export const BG_WEIGHT = BG.weight;
export const BG_BORN = BG.bornAt;
export const BG_EDGES = BG.edges;

// Evaluate activations, emergent retroactive echoes & lens resonance across all 186 real nodes
export function evaluateState(mode, timeDepth, lensIdx, kindFilter = "all", mutedIds = null) {
  const acts = new Array(N_NODES).fill(0);
  const echoes = new Array(N_NODES).fill(0);
  const activeEdges = [];
  const lensPath = [];

  const matchesKind = (n) => kindFilter === "all" || n.kind === kindFilter;

  if (mode === "timeline") {
    const t = Math.max(0.05, Math.min(5.0, timeDepth));
    const curChap = Math.min(4, Math.floor(t));

    for (let i = 0; i < N_NODES; i++) {
      const n = NODES[i];
      if ((mutedIds && mutedIds[i]) || n.bornAt > t || !matchesKind(n)) continue;
      const age = t - n.bornAt;
      if (n.chapter === curChap) {
        acts[i] = 0.62 + 0.38 * Math.min(1.0, age / 0.20);
      } else {
        acts[i] = 0.24;
      }
    }

    for (let eIdx = 0; eIdx < EDGES.length; eIdx++) {
      const [a, b, sim, isBridge] = EDGES[eIdx];
      if ((mutedIds && mutedIds[a]) || (mutedIds && mutedIds[b])) continue;
      const na = NODES[a], nb = NODES[b];
      if (na.bornAt > t || nb.bornAt > t || !matchesKind(na) || !matchesKind(nb)) continue;

      const aIsCur = na.chapter === curChap;
      const bIsCur = nb.chapter === curChap;
      let flow = 0.12;
      let isRetro = false;

      if (isBridge && (aIsCur !== bIsCur) && sim > 0.915) {
        // High-similarity emergent cross-era bridge firing into the active chapter!
        flow = Math.min(1.0, (sim - 0.85) * 7.0);
        isRetro = true;
        const older = aIsCur ? b : a;
        echoes[older] = Math.max(echoes[older], flow);
        acts[older] = Math.max(acts[older], 0.78 * flow);
      } else if (aIsCur && bIsCur) {
        flow = 0.55;
      }
      activeEdges.push({ idx: eIdx, a, b, sim, flow, isBridge, isRetro });
    }
  } else {
    // 12-D Semantic Synthesis Lens: score all 186 nodes directly by cosine similarity!
    const lens = LENSES[lensIdx] || LENSES[0];
    const scored = NODES.map((n, i) => ({
      i,
      s: (mutedIds && mutedIds[i]) || !matchesKind(n) ? 0 : cosSim(n.dir, lens.query12),
    }));
    const sorted = [...scored].sort((x, y) => y.s - x.s);
    const threshold = sorted[Math.min(28, sorted.length - 1)].s;
    const topSet = new Set();

    for (const item of scored) {
      if (item.s >= threshold && item.s > 0.55) {
        acts[item.i] = Math.min(1.0, 0.55 + (item.s - threshold) * 2.5);
        topSet.add(item.i);
      } else if (item.s > 0) {
        acts[item.i] = 0.15;
      }
    }

    // Build chronological synthesis path through the top 2 nodes from each chapter
    for (let ch = 0; ch < N_CHAPTERS; ch++) {
      const chTop = sorted.filter((x) => NODES[x.i].chapter === ch && topSet.has(x.i)).slice(0, 2);
      for (const item of chTop) lensPath.push(item.i);
    }

    for (let eIdx = 0; eIdx < EDGES.length; eIdx++) {
      const [a, b, sim, isBridge] = EDGES[eIdx];
      if ((mutedIds && mutedIds[a]) || (mutedIds && mutedIds[b])) continue;
      if (!matchesKind(NODES[a]) || !matchesKind(NODES[b])) continue;
      const both = topSet.has(a) && topSet.has(b);
      if (!both && !isBridge) continue;
      const flow = both ? 0.92 : 0.08;
      activeEdges.push({ idx: eIdx, a, b, sim, flow, isBridge, isRetro: both && isBridge });
    }
  }

  const clusterEnergy = [0, 0, 0, 0];
  const clusterCounts = [0, 0, 0, 0];
  for (let i = 0; i < N_NODES; i++) {
    const c = NODES[i].cluster;
    clusterEnergy[c] += acts[i];
    clusterCounts[c]++;
  }
  const clusterLevels = clusterEnergy.map((e, c) => Math.min(1, e / Math.max(1, clusterCounts[c] * 0.52)));

  return { acts, echoes, activeEdges, clusterLevels, lensPath };
}
